// film.mjs: a league match as an anime replay (anime/), 1920x1080 at 24 frames a second, with its soundtrack. Serves the project and
// drives anime/render.html in headless Chrome (GPU on), like wukong's render.mjs.
//
//   node arena/film.mjs s1/doubao s1/claude 2247389928                       -> out/film/doubao-claude-2247389928.mp4
//   node arena/film.mjs s1/doubao s1/claude 2247389928 --sheet=0:400:20      contact sheet of shots 0, 20, 40 ... 400 (or --sheet=12,80,95)
//   node arena/film.mjs s1/doubao s1/claude 2247389928 --still=300           one full frame, PNG
//   node arena/film.mjs s1/doubao s1/claude 2247389928 --ticks=1530:1590:5   contact sheet of the shots showing those match ticks
//   [--out=path] [--cols=5] [--w=480] [--fps=24] [--title=决赛·第3局 --before='Gemini 1 : 1 Kimi' --after='Gemini 1 : 2 Kimi'] [--from=tick --to=tick]
//   [--wins=1:1 --of=4]   a series: games won so far by the left and right fighter, as pips under the bars
//   [--intro]             keep the opening names-and-VS hold on a --from clip (a game cut short)
//   [--note='略过前 26 秒 · 只看决胜段']   a line kept on screen under the timer
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), pos = argv.filter(a => !a.startsWith('--'));
const args = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/s.exec(a); return [m[1], m[2] ?? true]; }));
const [left, right, seed] = pos;
if (!seed) { console.error('usage: node arena/film.mjs <left bot> <right bot> <seed> [--sheet=a:b:step | --still=k] [--out=...]'); process.exit(1); }
const tag = `${left.split('/').pop()}-${right.split('/').pop()}-${seed}`, fps = +(args.fps || 24);
const CHROME = [args.chrome, process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => p && existsSync(p));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const p = join(root, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, ''));
  if (!p.startsWith(root) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); createReadStream(p).pipe(res);
}).listen(0);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: ['--ignore-gpu-blocklist', '--use-angle=metal', '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage(); await page.setViewport({ width: 1920, height: 1080 });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warn') console.log(`[page ${m.type()}]`, m.text().slice(0, 600)); });
page.on('pageerror', e => console.error('[page error]', e.message.slice(0, 600)));
const extra = ['title', 'before', 'after', 'wins', 'of', 'note', 'from', 'to', 'intro'].filter(k => args[k] != null).map(k => `&${k}=${encodeURIComponent(args[k])}`).join('');
await page.goto(`http://localhost:${server.address().port}/anime/render.html?left=${left}&right=${right}&seed=${seed}&fps=${fps}${extra}`);
await page.waitForFunction(() => window.READY, { timeout: 30000 });
const info = await page.evaluate(() => window.__prepare());
console.log(`${left} vs ${right} seed ${seed}: ${info.reason}, winner ${info.winner}, ${info.frames} match frames -> ${info.shots} shots, ${info.seconds} s`);
const save = (file, url) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); };
const done = async () => { await browser.close(); server.close(); };

if (args.ticks) {                                        // --ticks=a:b:step: a sheet of the shots that show those match ticks
  const [a, b, st] = String(args.ticks).split(':').map(Number), want = []; for (let t = a; t <= b; t += st) want.push(t);
  args.sheet = (await page.evaluate(ts => ts.map(t => window.__shotOf(t)), want)).filter(k => k >= 0).join(',');
}
if (args.sheet) {
  const spec = String(args.sheet), ks = spec.includes(':') ? (([a, b, st]) => { const o = []; for (let k = a; k <= Math.min(b, info.shots - 1); k += st) o.push(k); return o; })(spec.split(':').map(Number)) : spec.split(',').map(Number);
  const out = join(root, args.out || `out/film/check/${tag}_sheet.jpg`), t0 = Date.now();
  save(out, await page.evaluate((ks, cols, w) => window.__sheet(ks, cols, w), ks, +(args.cols || 5), +(args.w || 480)));
  console.log(`${ks.length} shots in ${((Date.now() - t0) / ks.length).toFixed(0)} ms each -> ${out}`); await done(); process.exit(0);
}
if (args.still != null) {
  const out = join(root, args.out || `out/film/check/${tag}_${args.still}.png`);
  save(out, await page.evaluate(k => window.__draw(k, 'image/png'), +args.still)); console.log('->', out); await done(); process.exit(0);
}

const out = join(root, args.out || `out/film/${tag}.mp4`), frames = join(dirname(out), `.frames_${tag}`), wav = join(dirname(out), `.audio_${tag}.wav`);
rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });
const t0 = Date.now();
for (let k = 0; k < info.shots; k++) {
  save(join(frames, `f${String(k).padStart(5, '0')}.jpg`), await page.evaluate(i => window.__draw(i), k));
  if (k % 120 === 0) process.stdout.write(`\r  frame ${k}/${info.shots}  ${((Date.now() - t0) / (k + 1)).toFixed(0)} ms/frame`);
}
process.stdout.write(`\r  ${info.shots} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s                \n`);
save(wav, 'data:audio/wav;base64,' + await page.evaluate(() => window.__audio()));
await done();
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(fps), '-i', join(frames, 'f%05d.jpg'), '-i', wav, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
rmSync(frames, { recursive: true, force: true }); rmSync(wav, { force: true });
console.log(`-> ${out}`);
