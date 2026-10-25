// final.mjs: a best-of-seven between two bots. Game n is played on seed hash(season, 7777, n): fixed in advance, never picked;
// sides swap every game; the first to four wins takes it (a draw is replayed on the next seed and does not count).
//
//   node arena/final.mjs s1/gemini s1/kimi [--season=1] [--out=out/s1_final.json]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMatch, step, summary } from '../src/engine.js';
import { RULES } from '../src/rules.js';
import { botSeed, hash } from '../src/rng.js';
import { loadBot } from './sandbox.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), pos = argv.filter(a => !a.startsWith('--'));
const args = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/s.exec(a); return [m[1], m[2] ?? true]; }));
const [A, B] = pos, season = +(args.season || 1);
const src = Object.fromEntries([A, B].map(n => [n, readFileSync(join(root, `bots/${n}.js`), 'utf8')]));

const games = [], wins = { [A]: 0, [B]: 0 };
for (let n = 1; wins[A] < 4 && wins[B] < 4 && n <= 20; n++) {
  const seed = hash(season, 7777, n), sides = n % 2 ? [A, B] : [B, A];
  const fns = sides.map((name, s) => loadBot(src[name], { seed: botSeed(seed, s), rules: RULES, name }));
  const m = createMatch({ seed, rules: RULES });
  while (!m.over) step(m, (s, v) => fns[s](JSON.stringify(v)));
  const sm = summary(m), winner = sm.winner == null ? null : sides[sm.winner];
  if (winner) wins[winner]++;
  games.push({ n, seed, left: sides[0], right: sides[1], winner, reason: sm.reason, secs: +(sm.ticks / 60).toFixed(1), hp: sm.hp, clashes: sm.clashes, finisher: sm.finisher, score: { [A]: wins[A], [B]: wins[B] } });
  console.log(`game ${n}: ${sides[0]} vs ${sides[1]} seed ${seed} -> ${winner ?? 'draw'} (${sm.reason}, ${(sm.ticks / 60).toFixed(1)} s, hp ${sm.hp.join('/')}, clashes ${sm.clashes})   ${A} ${wins[A]} : ${wins[B]} ${B}`);
}
const champion = wins[A] === 4 ? A : B;
const out = join(root, args.out || `out/s${season}_final.json`);
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify({ season, a: A, b: B, champion, wins, games }, null, 2));
console.log(`champion: ${champion}  (${wins[A]} : ${wins[B]}) -> ${out}`);
