// check.mjs: the guarantees the whole show rests on. The same match twice gives the same fight; the page loader gives the
// same fight as the Node sandbox; a bot that hangs, throws or returns junk is handled. Run after every rules or engine change.
import { readFileSync } from 'node:fs';
import { createMatch, step, summary } from '../src/engine.js';
import { RULES } from '../src/rules.js';
import { botSeed } from '../src/rng.js';
import { loadBot } from './sandbox.mjs';
import { loadPageBot } from '../src/pagebot.js';

const src = n => readFileSync(new URL(`../bots/sparring/${n}.js`, import.meta.url), 'utf8');
function play(names, seed, loader, record = false) {
  const m = createMatch({ seed, rules: RULES, record });
  const fns = names.map((n, side) => loader(src(n), { seed: botSeed(seed, side), rules: RULES, name: n }));
  while (!m.over) step(m, (side, v) => fns[side](JSON.stringify(v)));
  return { s: summary(m), m };
}
let bad = 0;
const ok = (cond, what) => { console.log(`${cond ? 'ok  ' : 'FAIL'}  ${what}`); if (!cond) bad++; };
const pairs = [['mixer', 'tactician'], ['zoner', 'reactor'], ['random', 'turtle'], ['tactician', 'reactor']];
for (const [i, p] of pairs.entries()) {
  const seed = 1000 + i * 77;
  const a = play(p, seed, loadBot, true), b = play(p, seed, loadBot, true), c = play(p, seed, loadPageBot, true);
  const fa = JSON.stringify(a.m.frames), fb = JSON.stringify(b.m.frames), fc = JSON.stringify(c.m.frames);
  ok(fa === fb, `${p.join(' vs ')} seed ${seed}: same in Node twice (${a.m.frames.length} frames, ${a.s.reason}, winner ${a.s.winner})`);
  ok(fa === fc, `${p.join(' vs ')} seed ${seed}: page loader matches the sandbox`);
}
// hostile bots
const hostile = {
  throws: 'function decide(s) { throw new Error("boom"); }',
  junk: 'function decide(s) { return 42; }',
  escape: 'function decide(s) { try { return String(this.constructor.constructor("return typeof process")()); } catch (e) { return "guard"; } }',
  noDecide: 'const x = 1;',
};
for (const [k, code] of Object.entries(hostile)) {
  try {
    const f = loadBot(code, { seed: 1, rules: RULES, name: k });
    const out = f(JSON.stringify({ me: {}, opp: {} }));
    ok(out === '!error' || out === '!bad' || out === 'guard', `${k}: contained (${out})`);
  } catch (e) { ok(k === 'noDecide', `${k}: refused at load (${e.message})`); }
}
process.exit(bad ? 1 : 0);
