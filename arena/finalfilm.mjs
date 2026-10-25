// finalfilm.mjs: every game of a final (out/s<season>_final.json) as an anime replay, with "决赛 · 第 N 局" and the score before and
// after on its opening and closing holds.   node arena/finalfilm.mjs [--season=1] [--only=7]
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAST } from '../anime/fighters.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = /^--([^=]+)(?:=(.*))?$/s.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const season = +(args.season || 1), F = JSON.parse(readFileSync(join(root, `out/s${season}_final.json`), 'utf8'));
const short = n => (CAST[n.split('/').pop()]?.name || n).split(' ')[0];
const line = (sc) => `${short(F.a)} ${sc[F.a]} : ${sc[F.b]} ${short(F.b)}`;
let before = { [F.a]: 0, [F.b]: 0 };
for (const g of F.games) {
  if (!args.only || +args.only === g.n) {
    const out = `out/film/s${season}_final_g${g.n}.mp4`;
    console.log(`game ${g.n}: ${line(before)} -> ${line(g.score)}`);
    execFileSync('node', [join(root, 'arena/film.mjs'), g.left, g.right, String(g.seed), `--title=决赛 · 第 ${g.n} 局`, `--before=${line(before)}`, `--after=${line(g.score)}`, `--wins=${before[g.left]}:${before[g.right]}`, '--of=4', `--out=${out}`], { stdio: 'inherit', cwd: root });
  }
  before = g.score;
}
