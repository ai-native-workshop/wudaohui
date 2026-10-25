// preview.mjs: one match as an mp4, with sound and hit stop, drawn by the viewer's code (the debug look, not the anime replay).
// Serves the project itself and drives viewer/render.html in headless Chrome.
//
//   node arena/preview.mjs sparring/turtle sparring/mixer 4282165021 [--out=out/preview/turtle-mixer.mp4]
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), pos = argv.filter(a => !a.startsWith('--'));
const args = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/s.exec(a); return [m[1], m[2] ?? true]; }));
const [left, right, seed] = pos;
if (!seed) { console.error('usage: node arena/preview.mjs <left bot> <right bot> <seed> [--out=...]'); process.exit(1); }
const out = join(root, args.out || `out/preview/${left.split('/').pop()}-${right.split('/').pop()}-${seed}.mp4`);
const CHROME = [args.chrome, process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => p && existsSync(p));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const p = join(root, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, ''));
  if (!p.startsWith(root) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 0, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
page.on('pageerror', e => console.error('page:', e.message));
await page.goto(`http://localhost:${port}/viewer/render.html?left=${left}&right=${right}&seed=${seed}`, { waitUntil: 'networkidle0' });
const info = await page.evaluate(() => window.__prepare());
console.log(`${left} vs ${right} seed ${seed}: ${info.winner ?? '平局'} ${info.reason}, ${info.frames} frames, film ${info.seconds} s (${info.shots} shots)`);

const frames = join(dirname(out), '.frames'), wavPath = join(dirname(out), '.audio.wav');
rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });
for (let k = 0; k < info.shots; k++) {
  const url = await page.evaluate(i => window.__draw(i), k);
  writeFileSync(join(frames, `f${String(k).padStart(5, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
  if (k % 300 === 0) process.stdout.write(`\r  frames ${k}/${info.shots}`);
}
process.stdout.write(`\r  frames ${info.shots}/${info.shots}\n`);
writeFileSync(wavPath, Buffer.from(await page.evaluate(() => window.__audio()), 'base64'));
await browser.close(); server.close();
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '60', '-i', join(frames, 'f%05d.jpg'), '-i', wavPath, '-vf', 'pad=1280:720:0:40:black',
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
rmSync(frames, { recursive: true, force: true }); rmSync(wavPath, { force: true });
console.log(`-> ${out}`);
