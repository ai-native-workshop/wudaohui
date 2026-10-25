// league.mjs: a full round robin. Every pair plays --games matches (sides swapped every other match), spread over worker threads.
// A bot call that does not return within RULES.budget.callMs gets its worker killed and the bot loses that match.
//
//   node arena/league.mjs bots/sparring/*.js [--games=200] [--seed=1] [--workers=11] [--out=out/league.json]
//   node arena/league.mjs --report=out/league.json          print the tables of a saved league again
import { Worker } from 'node:worker_threads';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';
import { RULES } from '../src/rules.js';
import { hash } from '../src/rng.js';
import { report } from './stats.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), files = argv.filter(a => !a.startsWith('--'));
const args = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/s.exec(a); return [m[1], m[2] ?? true]; }));

if (args.report) { const L = JSON.parse(readFileSync(args.report, 'utf8')); console.log(report(L)); process.exit(0); }

const games = +(args.games || 200), seed = +(args.seed || 1), W = Math.max(1, +(args.workers || cpus().length - 1));
const bots = files.map(f => ({ name: basename(f).replace(/\.m?js$/, ''), file: f, source: readFileSync(f, 'utf8') }));
if (bots.length < 2) { console.error('need two or more bot files'); process.exit(1); }

const jobs = [];
for (let i = 0; i < bots.length; i++) for (let j = i + 1; j < bots.length; j++)
  for (let g = 0; g < games; g++) jobs.push({ id: jobs.length, seed: hash(seed, i, j, g), sides: g % 2 ? [j, i] : [i, j] });

const results = new Array(jobs.length), queue = jobs.map(j => j.id);
let done = 0, killed = 0;
const t0 = Date.now();

function spawn() {
  const sab = new SharedArrayBuffer(16), flag = new Int32Array(sab);
  const w = new Worker(join(root, 'arena/worker.mjs'), { workerData: { bots, rules: RULES, sab }, resourceLimits: { maxOldGenerationSizeMb: 512 } });
  const me = { w, flag, job: null, calls: -1, since: Date.now(), dead: false };
  w.on('message', r => { results[r.id] = r; done++; me.job = null; feed(me); });
  w.on('error', () => lose(me, 'crash'));
  w.on('exit', () => { if (!me.dead) lose(me, 'crash'); });
  return me;
}
function feed(me) {
  if (me.dead) return;
  if (!queue.length) { if (done === jobs.length) finish(); return; }
  me.job = queue.shift(); me.calls = -1; me.since = Date.now();
  me.w.postMessage(jobs[me.job]);
}
// the job on a dead worker goes to the side that was thinking when it died (or is replayed if nobody was); a fresh worker takes over
function lose(me, why) {
  if (me.dead) return;
  me.dead = true; me.w.terminate();
  if (me.job != null) {
    const job = jobs[me.job];
    if (Atomics.load(me.flag, 1) === 1) {
      const side = Atomics.load(me.flag, 2);
      results[job.id] = { id: job.id, seed: job.seed, sides: job.sides, winner: 1 - side, reason: why, ticks: 0, hp: [0, 0], finisher: why, leadChanges: 0, clashes: 0, beams: 0, side: null, highlight: 0, ms: [0, 0], errors: [0, 0] };
      done++; killed++;
    } else queue.unshift(job.id);
  }
  if (done === jobs.length) return finish();
  const n = spawn(); pool[pool.indexOf(me)] = n; feed(n);
}
const pool = Array.from({ length: Math.min(W, jobs.length) }, spawn);
const dog = setInterval(() => {
  const now = Date.now();
  for (const me of pool) {
    if (me.dead || me.job == null) continue;
    const calls = Atomics.load(me.flag, 0);
    if (calls !== me.calls) { me.calls = calls; me.since = now; continue; }
    if (Atomics.load(me.flag, 1) === 1 && now - me.since > RULES.budget.callMs + 100) lose(me, 'timeout');
  }
  if (process.stdout.isTTY) process.stdout.write(`\r${done}/${jobs.length} matches`);
}, 50);
pool.forEach(feed);

let finished = false;
function finish() {
  if (finished) return; finished = true;
  clearInterval(dog); for (const me of pool) { me.dead = true; me.w.terminate(); }
  const L = { seed, games, rules: RULES, bots: bots.map(b => ({ name: b.name, file: b.file })), results, secs: (Date.now() - t0) / 1000, killed };
  const out = args.out || join(root, 'out/league.json');
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(L));
  if (process.stdout.isTTY) process.stdout.write('\r');
  console.log(report(L));
  console.log(`\n${jobs.length} matches in ${L.secs.toFixed(1)} s on ${pool.length} workers${killed ? `, ${killed} lost to a hung call` : ''} -> ${out}`);
}
