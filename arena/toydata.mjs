// toydata.mjs: the playable page's roster (toy/roster.json): each contestant of the season with its model, pre-fight and post-season
// lines, league rank and win rate, and where it finished. The page itself stays static: it reads this file and the bots' source.
//
//   node arena/toydata.mjs [--season=1]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = /^--([^=]+)(?:=(.*))?$/s.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const season = +(args.season || 1), json = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const league = json(`out/league_s${season}.json`), final = json(`out/s${season}_final.json`), after = json(`out/contest/s${season}/aftermatch.json`).replies;
const bots = league.bots.map(b => b.name), rec = Object.fromEntries(bots.map(n => [n, { w: 0, l: 0, d: 0 }]));
for (const r of league.results) {
  const [a, b] = r.sides.map(i => bots[i]);
  if (r.winner == null) { rec[a].d++; rec[b].d++; } else { rec[r.winner ? b : a].w++; rec[r.winner ? a : b].l++; }
}
const SHORT = { claude: 'Claude', gpt: 'GPT', gemini: 'Gemini', kimi: 'Kimi', deepseek: 'DeepSeek', doubao: '豆包' };
const ranked = [...bots].sort((a, b) => rec[b].w - rec[a].w), champ = final.champion.split('/').pop();
const runner = [final.a, final.b].map(n => n.split('/').pop()).find(n => n !== champ);
const order = [champ, runner, ...ranked.filter(n => n !== champ && n !== runner)];   // by where they finished

const roster = {
  season, games: league.results.length, champion: champ,
  fighters: order.map(id => {
    const r = json(`out/contest/s${season}/${id}.json`), R = rec[id];
    return { id, bot: `s${season}/${id}`, short: SHORT[id], model: r.name, line: r.line, after: after[id]?.line || null,
      rank: ranked.indexOf(id) + 1, win: Math.round((100 * R.w) / (R.w + R.l + R.d)), place: id === champ ? '冠军' : id === runner ? '亚军' : null };
  }),
};
writeFileSync(join(root, 'toy/roster.json'), JSON.stringify(roster, null, 2) + '\n');
console.log(`toy/roster.json: ${roster.fighters.map(f => `${f.short}${f.place ? `(${f.place})` : ''}`).join(', ')}`);
