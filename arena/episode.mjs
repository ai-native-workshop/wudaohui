// episode.mjs: EP1 as one video. Cold open, title, rules, the six contestants, the league and its best games, the final, the champion
// and the vote. Cards are drawn by anime/cards.html, match clips (the final's games too) by arena/film.mjs.
// Every piece is kept under a hash of what made it (its words, the code that draws it), so a change re-renders only what it touches.
//
//   node arena/episode.mjs           -> out/ep1/ep1.mp4 (1080p) and out/ep1/ep1_720p.mp4; --variant=douyin -> ep1_douyin.mp4 (no off-site link)
//   node arena/episode.mjs --peek    a still of every card -> out/ep1/check/ (and sheet.jpg); --peek=title only the title card
//   node arena/episode.mjs --cover   the covers -> out/ep1/covers/ (16:9, 4:3, 16:10 for B 站, 9:16 and its middle 3:4; each also _clean)
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, extname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = /^--([^=]+)(?:=(.*))?$/s.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const dir = join(root, 'out/ep1'), FPS = 24;
mkdirSync(dir, { recursive: true });
const read = p => readFileSync(join(root, p), 'utf8'), json = p => JSON.parse(read(p));
const VARIANT = args.variant || 'bilibili';                                // douyin: no off-site link on screen, and its own file

// ---- the numbers the cards quote: the league table, who beats whom, each contestant's receipt
const league = json('out/league_s1.json'), bots = league.bots.map(b => b.name);
const rec = Object.fromEntries(bots.map(n => [n, { w: 0, l: 0, d: 0, moves: {}, held: {} }])), beat = {};
for (const r of league.results) {
  const [a, b] = r.sides.map(i => bots[i]);
  r.side.forEach((s, k) => { const R = rec[k ? b : a]; for (const [m, v] of Object.entries(s.moves)) R.moves[m] = (R.moves[m] || 0) + v; for (const [m, v] of Object.entries(s.held)) R.held[m] = (R.held[m] || 0) + v; });
  if (r.winner == null) { rec[a].d++; rec[b].d++; continue; }
  const w = r.winner ? b : a, l = r.winner ? a : b; rec[w].w++; rec[l].l++; beat[w] = beat[w] || {}; beat[w][l] = (beat[w][l] || 0) + 1;
}
const pct = (a, b) => { const x = beat[a]?.[b] || 0, y = beat[b]?.[a] || 0; return Math.round((100 * x) / (x + y)); };
const share = (n, kind, k) => { const o = rec[n][kind]; return Math.round((100 * (o[k] || 0)) / Object.values(o).reduce((s, v) => s + v, 0)); };   // % of its moves / held time
const beamShare = n => Math.round((100 * rec[n].moves.beam) / bots.reduce((s, b) => s + (rec[b].moves.beam || 0), 0));
const SHORT = { claude: 'Claude', gpt: 'GPT', gemini: 'Gemini', kimi: 'Kimi', deepseek: 'DeepSeek', doubao: '豆包' };
const ORDER = ['claude', 'gpt', 'gemini', 'kimi', 'deepseek', 'doubao'];
const ranked = [...bots].sort((a, b) => rec[b].w - rec[a].w);
function contestant(id) {
  const r = json(`out/contest/s1/${id}.json`), ok = r.tries.find(t => t.n === r.attempt) || {}, mins = `用时 ${(ok.seconds / 60).toFixed(1)} 分钟`;
  const cost = r.tries.reduce((s, t) => s + (t.costUSD || 0), 0);
  const note = ok.route ? `${mins} · API 两次被内容过滤拦下，改用网页版交卷` : `${mins} · 花费 $${cost.toFixed(2)}${r.attempt > 1 ? ` · 第 ${r.attempt} 次才交卷` : ''}`;
  return { card: 'contestant', data: { id, short: SHORT[id], model: r.name, line: r.line, note } };
}
// a game of the final, with its title, the score before and after and the pips; given `from`, only its last exchange (a quick cut)
const final = json('out/s1_final.json'), line = sc => `${SHORT[final.a.split('/').pop()]} ${sc[final.a]} : ${sc[final.b]} ${SHORT[final.b.split('/').pop()]}`;
function game(n, from = null) {
  const g = final.games[n - 1], before = n > 1 ? final.games[n - 2].score : { [final.a]: 0, [final.b]: 0 };
  const clip = { left: g.left, right: g.right, seed: g.seed, title: `决赛 · 第 ${n} 局`, before: line(before), after: line(g.score), wins: `${before[g.left]}:${before[g.right]}`, of: 4 };
  return { clip: from == null ? clip : { ...clip, from, intro: true, note: `略过前 ${Math.round(from / 60)} 秒 · 只看决胜段` } };
}
const kimiCost = json('out/contest/s1/kimi.json').costUSD;

// ---- EP1, in order
const COLD = { left: 's1/gpt', right: 's1/gemini', seed: 2095132965 };
const PLAN = [
  { clip: { ...COLD, from: 2060, to: 2190 } },                                                   // the clash, cut on the wide shot before it is decided
  { card: 'freeze', data: { img: 'last', text: '谁赢了？', sub: 'GPT 只剩 12 血 · 对面是联赛第一的 Gemini' } },
  { music: 'opening', card: 'title', data: { episode: '第 1 集 · 6 个 AI 各写一个格斗程序，打了 15000 局', question: '谁是天下第一？', lineup: ORDER.map(id => ({ id, short: SHORT[id], model: json(`out/contest/s1/${id}.json`).name })) } },
  { card: 'rules', data: { footer: '6 家拿到一字不差的规则书，各写一个出招程序 · 开打以后谁也不能再改' } },
  { card: 'inter', data: { text: '参赛选手', sub: '每家都是现在最强的版本', sub2: '赛前宣言是它们自己写的' } },
  ...ORDER.map(contestant),
  { card: 'standings', data: {
    title: `联赛：每两家打 1000 局，一共 ${league.results.length} 局`,
    rows: ranked.map(n => ({ id: n, name: SHORT[n], share: rec[n].w / (rec[n].w + rec[n].l + rec[n].d), record: `${rec[n].w} 胜 ${rec[n].l} 负` })),
    foot: `排名按全部 ${league.results.length} 局算 · 动画只挑了其中几局` } },
  { card: 'styles', data: {                                                                      // why the table looks like that
    title: '六家打法', foot: `数字来自联赛全部 ${league.results.length} 局`,
    rows: [
      { id: 'gemini', style: '贴脸快拳', pose: 'light', lines: [`${share('gemini', 'moves', 'light')}% 的招是轻拳`, `${share('gemini', 'held', 'forward')}% 的时间在往前压`] },
      { id: 'kimi', style: '铁壁反击', pose: 'guard', lines: [`${share('kimi', 'held', 'guard')}% 的时间在格挡`, `${share('kimi', 'moves', 'heavy')}% 的招是重击`] },
      { id: 'gpt', style: '样样都会', pose: 'blast', lines: [`轻拳 ${share('gpt', 'moves', 'light')}% · 重击 ${share('gpt', 'moves', 'heavy')}% · 气弹 ${share('gpt', 'moves', 'blast')}%`, '六家里打法最平均'] },
      { id: 'claude', style: '蓄气重击', pose: 'charge', lines: [`${share('claude', 'held', 'charge')}% 的时间在蓄气`, `联赛 ${beamShare('claude')}% 的气功波是它放的`] },
      { id: 'doubao', style: '快拳连打', pose: 'light', lines: [`${share('doubao', 'moves', 'light')}% 的招是轻拳`, `${share('doubao', 'held', 'forward')}% 的时间在往前冲`] },
      { id: 'deepseek', style: '一直蓄气', pose: 'charge', lines: [`${share('deepseek', 'held', 'charge')}% 的时间在蓄气`, `${rec.deepseek.w} 场胜利${Object.keys(beat.deepseek || {}).join() === 'doubao' ? '全是赢豆包' : ''}`] },
    ].map(r => ({ ...r, name: SHORT[r.id] })) } },
  { card: 'triangle', data: {
    title: '前三名：石头剪刀布', nodes: ranked.slice(0, 3).map(n => ({ id: n, name: SHORT[n] })),
    edges: [['gemini', 'gpt'], ['gpt', 'kimi'], ['kimi', 'gemini']].map(([a, b]) => [a, b, pct(a, b)]),
    center: '没有谁能通吃', foot: `联赛第一的 Gemini，偏偏怕第二名 Kimi（只赢 ${pct('gemini', 'kimi')}%）` } },
  { card: 'inter', data: { text: '联赛名局', sub: '从 15000 局里按“名局分”挑的', sub2: '对波、残血、领先易手越多，分越高' } },
  { card: 'inter', data: { text: '开头那一波', sub: 'GPT 只剩 12 血，气也只剩 13', sub2: 'Gemini 还有 203 血、52 气', vs: ['gpt', 'gemini'] } },
  { clip: { ...COLD, from: 2140 } },
  { card: 'inter', data: { text: '16 滴血', sub: 'Claude 被打到只剩 16 血', sub2: 'GPT 也只剩 62', vs: ['gpt', 'claude'] } },
  { clip: { left: 's1/gpt', right: 's1/claude', seed: 3070219597, from: 2300 } },
  { card: 'inter', data: { text: '爆冷', sub: '第 5 名豆包 vs 第 2 名 Kimi', sub2: '豆包 88% 的出招是轻拳 · Kimi 47% 的时间在格挡', vs: ['doubao', 'kimi'] } },
  { clip: { left: 's1/doubao', right: 's1/kimi', seed: 3076383891, from: 2760 } },
  { music: 'battle', card: 'inter', data: { text: '决赛', sub: '联赛第 1 Gemini vs 第 2 Kimi · 七局四胜', sub2: '前三局只放决胜段，第 4 局起完整播放', vs: ['gemini', 'kimi'], secs: 3.6 } },
  game(1, 1560), game(2, 1300), game(3, 1305),                                                   // quick cuts: the last exchange before each KO
  game(4),
  { card: 'inter', data: { text: '赛点', sub: 'Kimi 3 : 1 领先，再赢一局就夺冠', vs: ['gemini', 'kimi'] } },
  game(5), game(6),
  { card: 'inter', data: { text: '抢七', sub: 'Gemini 连扳两局 · 3 : 3', vs: ['gemini', 'kimi'] } },
  game(7),
  { music: 'victory', card: 'champion', data: { id: final.champion.split('/').pop(), title: '第一季 · 天下第一', name: 'Kimi K3.1 Pro', sub: `决赛 4 : 3 · 写这个程序只花了 $${kimiCost.toFixed(2)}`, line: '先守其心，再破其势。' } },
  { card: 'aftermatch', data: {                                                                  // the pre-fight line and, after the season, one more
    title: '赛后感言', sub: '把成绩告诉它们，各说一句（原话）',
    rows: [...ranked.filter(n => n !== final.champion.split('/').pop())].reverse().concat(final.champion.split('/').pop()).map(n => {   // by where they finished: the champion last
      const champ = n === final.champion.split('/').pop(), runner = !champ && [final.a, final.b].some(f => f.endsWith(`/${n}`));
      return { id: n, rank: champ ? '冠军' : runner ? '亚军' : String(ranked.indexOf(n) + 1), champion: champ, name: SHORT[n], before: json(`out/contest/s1/${n}.json`).line, after: json('out/contest/s1/aftermatch.json').replies[n].line };
    }) } },
  { music: 'opening', card: 'challenge', data: {                                                                   // the playable page: where depends on the platform
    title: '你能打赢几个？', sub: '联赛垫底的 DeepSeek，你也不一定打得过',
    foot: VARIANT === 'douyin' ? '网页版：亲手挑战这 6 个 AI 写的程序，入口见评论区' : '网页版：打开就能挑战这 6 个 AI 写的程序 · 链接在简介第一行',
    lineup: ORDER.map(id => ({ id, short: SHORT[id], win: Math.round((100 * rec[id].w) / (rec[id].w + rec[id].l + rec[id].d)) })) } },
  { card: 'vote', data: { title: '第 2 集你想看哪个？', options: [['A', 'AI 看完自己的录像，改代码再打'], ['B', '6 个 AI 同台大乱斗'], ['C', '6 个 AI 一起闯名场面 boss 关']], foot: '评论区打 A / B / C，再说说你打赢了谁' } },
];

// ---- a piece is kept as out/ep1/<n>_<kind>_<hash>.mp4; the hash covers its spec and the code that draws it
const CARD_CODE = ['anime/cards.js', 'anime/stick.js', 'anime/fighters.js', 'src/rules.js'];
const CLIP_CODE = ['anime/film.js', 'anime/world.js', 'anime/glowfx.js', 'anime/stick.js', 'anime/fighters.js', 'anime/main.js', 'viewer/audio.js', 'src/engine.js', 'src/rules.js'];
const hashOf = ({ music, ...spec }, files, extra = '') => createHash('sha1').update(JSON.stringify(spec) + extra + files.map(read).join('')).digest('hex').slice(0, 8);   // the music is mixed in later
let prevKey = '';
const pieces = PLAN.map((seg, i) => {
  const n = String(i).padStart(2, '0');
  if (seg.file) return { seg, out: join(root, seg.file) };
  const key = seg.card ? hashOf(seg, CARD_CODE, seg.data.img === 'last' ? prevKey : '') : hashOf(seg, CLIP_CODE, read(`bots/${seg.clip.left}.js`) + read(`bots/${seg.clip.right}.js`));
  prevKey = key;
  return { seg, key, out: join(dir, `${n}_${seg.card || 'clip'}_${key}.mp4`) };
});

const ffmpeg = a => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a], { stdio: 'inherit' });
const ENC = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart'];

// the cards page, opened once
let page = null, browser = null, server = null;
async function cardsPage() {
  if (page) return page;
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.jpg': 'image/jpeg', '.png': 'image/png' };
  server = http.createServer((req, res) => {
    const p = join(root, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, ''));
    if (!p.startsWith(root) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); createReadStream(p).pipe(res);
  }).listen(0);
  const CHROME = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => p && existsSync(p));
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 0, args: ['--ignore-gpu-blocklist', '--use-angle=metal', '--enable-gpu-rasterization', '--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required'] });
  page = await browser.newPage(); await page.setViewport({ width: 1920, height: 1080 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warn') console.log(`[page ${m.type()}]`, m.text().slice(0, 600)); });
  page.on('pageerror', e => console.error('[page error]', e.message.slice(0, 600)));
  await page.goto(`http://localhost:${server.address().port}/anime/cards.html`);
  await page.waitForFunction(() => window.READY, { timeout: 30000 });
  return page;
}
const save = (file, url) => writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
const lastFrame = (video, jpg) => { ffmpeg(['-sseof', '-0.2', '-i', video, '-update', '1', '-q:v', '2', jpg]); return '/' + jpg.slice(root.length + 1); };
async function setCard(p, piece, i) {
  const data = { ...piece.seg.data };
  if (data.img === 'last') data.img = lastFrame(pieces[i - 1].out, join(dir, `.last_${piece.key}.jpg`));
  return p.evaluate((type, d) => window.__card(type, d), piece.seg.card, data);
}

if (args.cover) {                                                           // the covers, in the ratios the platforms crop to, each with and without words
  const fi = pieces.findIndex(x => x.seg.card === 'freeze'), src = pieces[fi - 1].out;
  if (!existsSync(src)) { console.error('render the episode first'); process.exit(1); }
  const p = await cardsPage(), img = lastFrame(src, join(dir, '.cover_bg.jpg')), cdir = join(dir, 'covers'); mkdirSync(cdir, { recursive: true });
  const words = { head: 'AI 武道会 · 第 1 集', big: `${league.results.length} 局`, line: '6 个 AI 各写一个格斗程序', small: '谁是天下第一？' };
  const shot = async (type, size, name, extra = {}) => {
    for (const clean of [false, true]) {
      await p.evaluate((t, d) => window.__card(t, d), type, { ...words, ...extra, size, clean });
      save(join(cdir, `${name}${clean ? '_clean' : ''}.jpg`), await p.evaluate(() => window.__drawCard(0)));
    }
  };
  await shot('cover', [1920, 1080], 'cover_16x9', { img });          // the cold open's last frame: both beams meeting
  await shot('cover', [1440, 1080], 'cover_4x3', { img });
  await shot('cover', [1728, 1080], 'cover_16x10', { img });         // B 站
  await shot('coverTall', [1080, 1920], 'cover_9x16', { pair: ['gpt', 'gemini'], names: ORDER.map(id => ({ id, short: SHORT[id] })) });
  await browser.close(); server.close();
  for (const clean of ['', '_clean']) ffmpeg(['-i', join(cdir, `cover_9x16${clean}.jpg`), '-vf', 'crop=1080:1440:0:240', '-q:v', '2', join(cdir, `cover_3x4${clean}.jpg`)]);   // its middle
  console.log(`-> ${cdir}: 16x9, 4x3, 16x10, 9x16, 3x4 (and _clean)`); process.exit(0);
}
if (args.peek) {                                                            // one still per card, at 85% of its length
  const p = await cardsPage(), check = join(dir, 'check'); rmSync(check, { recursive: true, force: true }); mkdirSync(check, { recursive: true });
  let k = 0;
  for (const [i, piece] of pieces.entries()) {
    if (!piece.seg.card || (args.peek !== true && piece.seg.card !== args.peek)) continue;
    if (piece.seg.data.img === 'last' && !existsSync(pieces[i - 1].out)) { console.log(`skip ${i}: render the clip before it first`); continue; }
    const frames = await setCard(p, piece, i);
    save(join(check, `${String(k++).padStart(2, '0')}.jpg`), await p.evaluate(f => window.__drawCard(f), Math.floor(frames * 0.85)));
  }
  await browser.close(); server.close();
  ffmpeg(['-i', join(check, '%02d.jpg'), '-vf', `scale=480:-1,tile=4x${Math.ceil(k / 4)}`, '-frames:v', '1', join(check, 'sheet.jpg')]);
  console.log(`${k} cards -> ${check}/sheet.jpg`); process.exit(0);
}

for (const [i, piece] of pieces.entries()) {
  const { seg, out } = piece;
  if (existsSync(out)) continue;
  if (seg.file) { console.error(`missing ${seg.file}: run node arena/finalfilm.mjs`); process.exit(1); }
  const tmp = join(dir, `.tmp_${piece.key}.mp4`);
  if (seg.clip) {
    const c = seg.clip, extra = ['from', 'to', 'title', 'before', 'after', 'wins', 'of', 'note'].filter(k => c[k] != null).map(k => `--${k}=${c[k]}`).concat(c.intro ? ['--intro'] : []);
    console.log(`[${i}] clip ${c.left} vs ${c.right} ${c.seed} ${extra.join(' ')}`);
    execFileSync('node', [join(root, 'arena/film.mjs'), c.left, c.right, String(c.seed), ...extra, `--out=${relative(root, tmp)}`], { stdio: 'inherit', cwd: root });
  } else {
    const p = await cardsPage(), frames = await setCard(p, piece, i), fdir = join(dir, `.frames_${piece.key}`), wav = join(dir, `.audio_${piece.key}.wav`);
    rmSync(fdir, { recursive: true, force: true }); mkdirSync(fdir, { recursive: true });
    for (let k = 0; k < frames; k++) save(join(fdir, `f${String(k).padStart(5, '0')}.jpg`), await p.evaluate(f => window.__drawCard(f), k));
    save(wav, 'data:audio/wav;base64,' + await p.evaluate(() => window.__cardAudio()));
    console.log(`[${i}] card ${seg.card}: ${frames} frames`);
    ffmpeg(['-framerate', String(FPS), '-i', join(fdir, 'f%05d.jpg'), '-i', wav, '-af', 'alimiter=limit=0.9', ...ENC, '-shortest', tmp]);
    rmSync(fdir, { recursive: true, force: true }); rmSync(wav, { force: true });
  }
  renameSync(tmp, out);
}
if (browser) { await browser.close(); server.close(); }
const keep = new Set(pieces.map(p => p.out));                               // pieces from earlier versions of the plan or the code
if (VARIANT === 'bilibili') for (const f of readdirSync(dir)) if (/^(\d\d_\w+_[0-9a-f]{8}\.mp4|\.last_[0-9a-f]{8}\.jpg)$/.test(f) && !keep.has(join(dir, f)) && !pieces.some(p => p.key && f === `.last_${p.key}.jpg`)) rmSync(join(dir, f));

// ---- the music: a stretch starts at a piece marked music: <track> and runs to the next mark or the end; nothing under the cold open.
// Each track is set to `level` LUFS (the sound effects sit near -16), `duck` dB lower while a match clip plays, faded in and out, and
// looped if the stretch is longer (unless loop: false). Sources and licenses: assets/music/CREDITS.md.
const TRACKS = {
  opening: { file: 'assets/music/opening.wav', level: -21, duck: -4 },
  battle: { file: 'assets/music/battle.mp3', level: -23 },
  victory: { file: 'assets/music/victory.mp3', level: -20, loop: false },
};
function mixMusic(input, output) {
  const dur = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString();
  let t = 0; const marks = [], clips = [];
  for (const p of pieces) { const d = dur(p.out); if (p.seg.music !== undefined) marks.push({ name: p.seg.music, start: t }); if (p.seg.clip) clips.push([t, t + d]); t += d; }
  const duckOf = r => { const k = TRACKS[r.name].duck, under = clips.filter(([a, b]) => b > r.start && a < r.end); return k && under.length ? `,volume='if(gt(${under.map(([a, b]) => `between(t,${a.toFixed(2)},${b.toFixed(2)})`).join('+')},0),${Math.pow(10, k / 20).toFixed(3)},1)':eval=frame` : ''; };
  const runs = marks.map((m, i) => ({ ...m, end: marks[i + 1]?.start ?? t })).filter(m => m.name && existsSync(join(root, TRACKS[m.name].file)));
  if (!runs.length) { renameSync(input, output); console.log('no music files yet: sound effects only'); return; }
  const lufs = f => +/I:\s+(-?[\d.]+) LUFS/.exec(spawnSync('ffmpeg', ['-nostats', '-i', f, '-af', 'ebur128', '-f', 'null', '-']).stderr.toString().split('Summary:').pop())[1];
  const gain = Object.fromEntries([...new Set(runs.map(r => r.name))].map(n => [n, TRACKS[n].level - lufs(join(root, TRACKS[n].file))]));
  const ins = runs.flatMap(r => [...(TRACKS[r.name].loop === false ? [] : ['-stream_loop', '-1']), '-i', join(root, TRACKS[r.name].file)]);
  const legs = runs.map((r, i) => { const d = (r.end - r.start).toFixed(3); return `[${i + 1}:a]aresample=48000,apad,atrim=0:${d},asetpts=PTS-STARTPTS,afade=t=in:d=0.6,afade=t=out:st=${(r.end - r.start - 1.5).toFixed(3)}:d=1.5,volume=${gain[r.name].toFixed(2)}dB,adelay=${Math.round(r.start * 1000)}:all=1${duckOf(r)}[m${i}]`; });
  const graph = `${legs.join(';')};[0:a]${runs.map((_, i) => `[m${i}]`).join('')}amix=inputs=${runs.length + 1}:normalize=0:duration=first,alimiter=limit=0.89[a]`;
  ffmpeg(['-i', input, ...ins, '-filter_complex', graph, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', output]);
  console.log(`music: ${runs.map(r => `${r.name} ${r.start.toFixed(1)}-${r.end.toFixed(1)} s`).join(', ')}`);
}

// join: every piece has the same encoding, so the concat demuxer copies them (sound effects only); then the music goes under them and
// a 720p copy is made to send around
const tag = VARIANT === 'douyin' ? '_douyin' : '', list = join(dir, '.list.txt'), joined = join(dir, '.joined.mp4'), master = join(dir, `ep1${tag}.mp4`), small = join(dir, `ep1${tag}_720p.mp4`);
writeFileSync(list, pieces.map(p => `file '${p.out.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', joined]);
mixMusic(joined, master);
ffmpeg(['-i', master, '-vf', 'scale=1280:720', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', small]);
rmSync(joined, { force: true });
const secs = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', master]).toString();
console.log(`EP1: ${pieces.length} pieces, ${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')} -> ${master}, ${small}`);
