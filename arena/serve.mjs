// serve.mjs: serves the project to the viewer (ES modules do not load from file://), plus two small lists it needs.
//
//   node arena/serve.mjs [--port=8642]      then open http://localhost:8642/viewer/
//   GET /api/bots                           every bot file under bots/, as names like "sparring/mixer"
//   GET /api/highlights?league=out/league.json&top=40   a league's best matches (pair, seed, score) for the "名局" list
import http from 'node:http';
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = /^--([^=]+)(?:=(.*))?$/s.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const port = +(args.port || 8642);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
const json = (res, x) => { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(x)); };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/bots') return json(res, walk(join(root, 'bots')).map(p => relative(join(root, 'bots'), p).replace(/\.js$/, '')).sort());
  if (url.pathname === '/api/highlights') {
    const file = join(root, normalize(url.searchParams.get('league') || 'out/league.json').replace(/^(\.\.[/\\])+/, ''));
    if (!existsSync(file)) return json(res, []);
    const L = JSON.parse(readFileSync(file, 'utf8')), top = +(url.searchParams.get('top') || 40);
    const name = b => relative(join(root, 'bots'), join(root, L.bots[b].file)).replace(/\.js$/, '');
    return json(res, L.results.filter(Boolean).sort((a, b) => b.highlight - a.highlight).slice(0, top)
      .map(r => ({ bots: r.sides.map(name), seed: r.seed, score: r.highlight, winner: r.winner, reason: r.reason, secs: +(r.ticks / 60).toFixed(1), clashes: r.clashes, finisher: r.finisher })));
  }
  const path = join(root, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''));
  if (!path.startsWith(root) || !existsSync(path) || statSync(path).isDirectory()) {
    if (existsSync(join(path, 'index.html'))) { res.writeHead(302, { location: url.pathname.replace(/\/?$/, '/') + 'index.html' }); return res.end(); }
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(path).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}/viewer/`));
