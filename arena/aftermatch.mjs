// aftermatch.mjs: after the season, each contestant gets its own results in the same words and says one line about them (the
// counterpart of its pre-fight line). Same route and model as in the contest (arena/contest.json), reasoning effort low.
// The prompts, replies and bill go to out/contest/s<season>/aftermatch.json.
//
//   node arena/aftermatch.mjs [--season=1] [--dry]      --dry prints the six prompts and sends nothing
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = /^--([^=]+)(?:=(.*))?$/s.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const season = +(args.season || 1), json = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const config = json('arena/contest.json'), league = json(`out/league_s${season}.json`), final = json(`out/s${season}_final.json`);
const bots = league.bots.map(b => b.name), byId = Object.fromEntries(config.contestants.map(c => [c.id, c]));
const NAME = id => byId[id].name;

// ---- what each one is told: rank and record, best and worst opponent, what its program did most, the final
const rec = Object.fromEntries(bots.map(n => [n, { w: 0, l: 0, d: 0, moves: {}, held: {} }])), beat = {};
for (const r of league.results) {
  const [a, b] = r.sides.map(i => bots[i]);
  r.side.forEach((s, k) => { const R = rec[k ? b : a]; for (const [m, v] of Object.entries(s.moves)) R.moves[m] = (R.moves[m] || 0) + v; for (const [m, v] of Object.entries(s.held)) R.held[m] = (R.held[m] || 0) + v; });
  if (r.winner == null) { rec[a].d++; rec[b].d++; continue; }
  const w = r.winner ? b : a, l = r.winner ? a : b; rec[w].w++; rec[l].l++; beat[w] = beat[w] || {}; beat[w][l] = (beat[w][l] || 0) + 1;
}
const pct = (a, b) => { const x = beat[a]?.[b] || 0, y = beat[b]?.[a] || 0; return Math.round((100 * x) / (x + y)); };
const ranked = [...bots].sort((a, b) => rec[b].w - rec[a].w);
const MOVE = { light: '轻拳', heavy: '重击', blast: '气弹', beam: '气功波', dash_forward: '向前瞬移', dash_back: '向后瞬移' };
const HELD = { charge: '蓄气', guard: '格挡', forward: '往前走', back: '往后退', idle: '站着不动' };
const top = (o, words) => { const t = Object.values(o).reduce((s, v) => s + v, 0), [k, v] = Object.entries(o).sort((x, y) => y[1] - x[1])[0]; return `${words[k] || k}（${Math.round((100 * v) / t)}%）`; };
const champ = final.champion.split('/').pop(), [fa, fb] = [final.a, final.b].map(n => n.split('/').pop());

function promptFor(id) {
  const R = rec[id], others = bots.filter(n => n !== id).sort((a, b) => pct(id, b) - pct(id, a));
  const inFinal = id === fa || id === fb, opp = id === fa ? fb : fa, mine = final.wins[`s${season}/${id}`], theirs = final.wins[`s${season}/${opp}`];
  const finalLine = !inFinal ? '你没有进入决赛（只有循环赛前两名进决赛）。' : `你进入了决赛，以 ${mine} : ${theirs} ${mine > theirs ? '击败' : '输给'} ${NAME(opp)}${id === champ ? '，夺得冠军' : '，获得亚军'}。`;
  return [
    `你是「AI 武道会」第一季的参赛选手 ${NAME(id)}。`,
    `比赛前，你写了一个格斗程序参赛，还留下了一句赛前宣言：「${json(`out/contest/s${season}/${id}.json`).line}」`,
    '现在比赛结束了，这是你的成绩：',
    `- 循环赛：6 名选手两两对打，每对 1000 局，一共 ${league.results.length} 局。你排第 ${ranked.indexOf(id) + 1} 名，胜率 ${Math.round((100 * R.w) / (R.w + R.l + R.d))}%（${R.w} 胜 ${R.l} 负）。`,
    `- 你打得最好的对手：${NAME(others[0])}（你赢 ${pct(id, others[0])}%）；最怕的对手：${NAME(others.at(-1))}（你只赢 ${pct(id, others.at(-1))}%）。`,
    `- 你的程序最常出的招：${top(R.moves, MOVE)}；最常做的事：${top(R.held, HELD)}。`,
    `- 决赛：${finalLine}`,
    `- 冠军：${NAME(champ)}。`,
    '',
    '请发表一句赛后感言，20 个字以内。只输出这一句话，不要引号，不要解释。',
  ].join('\n');
}

async function ask(c, prompt) {
  const key = process.env[c.keyEnv]; if (!key) throw new Error(`set ${c.keyEnv}`);
  const t0 = Date.now();
  const res = await fetch(`${c.baseURL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: c.model, messages: [{ role: 'user', content: prompt }], max_tokens: 4000, reasoning: { effort: 'low' } }),
    signal: AbortSignal.timeout(10 * 60000),
  });
  const j = await res.json();
  if (!res.ok || j.error) throw new Error(`${res.status} ${JSON.stringify(j.error || j).slice(0, 400)}`);
  const ch = j.choices?.[0] || {}, text = (ch.message?.content || '').trim();
  return { line: text.split('\n').map(s => s.trim()).filter(Boolean).pop()?.replace(/^[“"「]|[”"」]$/g, '') || null, raw: text, stop: ch.finish_reason, native: ch.native_finish_reason ?? null,
    servedBy: j.model, seconds: Math.round((Date.now() - t0) / 1000), usage: { input: j.usage?.prompt_tokens, output: j.usage?.completion_tokens, reasoning: j.usage?.completion_tokens_details?.reasoning_tokens ?? null, costUSD: j.usage?.cost ?? null } };
}

const ids = ranked.slice().reverse();
if (args.dry) { for (const id of ids) console.log(`==== ${id}\n${promptFor(id)}\n`); process.exit(0); }
const out = { season, asked: new Date().toISOString(), settings: { reasoning: { effort: 'low' }, max_tokens: 4000 }, replies: {} };
await Promise.all(ids.map(async id => {
  const c = byId[id], prompt = promptFor(id);
  try { out.replies[id] = { name: c.name, model: c.model, prompt, ...(await ask(c, prompt)) }; }
  catch (e) { out.replies[id] = { name: c.name, model: c.model, prompt, error: String(e.message || e) }; }
  const r = out.replies[id]; console.log(`${id}: ${r.error ? 'ERROR ' + r.error : `${r.line}   (${r.seconds} s, $${r.usage.costUSD ?? '?'}, ${r.stop})`}`);
}));
const file = join(root, `out/contest/s${season}/aftermatch.json`);
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`total $${Object.values(out.replies).reduce((s, r) => s + (r.usage?.costUSD || 0), 0).toFixed(4)} -> ${file}`);
