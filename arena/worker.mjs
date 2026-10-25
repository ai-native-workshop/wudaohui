// worker.mjs: plays the matches league.mjs hands it, one at a time, and reports each result. Before every bot call it marks
// the shared flag (calls, busy, side, job) so the main thread can see a call that never returns and kill this worker.
import { parentPort, workerData } from 'node:worker_threads';
import { createMatch, step, summary, forfeit } from '../src/engine.js';
import { botSeed } from '../src/rng.js';
import { loadBot } from './sandbox.mjs';

const { bots, rules, sab } = workerData;
const flag = new Int32Array(sab);               // [calls, busy, side, job]

parentPort.on('message', job => parentPort.postMessage(play(job)));

export function play({ id, seed, sides }) {
  Atomics.store(flag, 3, id);
  const m = createMatch({ seed, rules }), spent = [0, 0], errors = [0, 0];
  let out = null;
  const fns = sides.map((b, side) => {
    try { return loadBot(bots[b].source, { seed: botSeed(seed, side), rules, name: bots[b].name + '.js' }); }
    catch (e) { out ??= { side, why: 'load', msg: String(e.message || e).slice(0, 200) }; return () => 'idle'; }
  });
  const ask = (side, v) => {
    Atomics.store(flag, 2, side); Atomics.add(flag, 0, 1); Atomics.store(flag, 1, 1);
    const t0 = performance.now(), a = fns[side](JSON.stringify(v)), dt = performance.now() - t0;
    Atomics.store(flag, 1, 0);
    spent[side] += dt;
    if (a === '!error') errors[side]++;
    if (dt > rules.budget.callMs || spent[side] > rules.budget.matchMs) out ??= { side, why: 'timeout' };
    return a;
  };
  if (out) forfeit(m, out.side, out.why);
  while (!m.over) { step(m, ask); if (out && !m.over) forfeit(m, out.side, out.why); }
  return { id, seed, sides, ...summary(m), ms: spent.map(x => Math.round(x * 10) / 10), errors, note: out?.msg };
}
