// main.js: the replay page for arena/film.mjs. ?left=s1/doubao&right=s1/claude&seed=7[&fps=24][&title=&before=&after=][&wins=1:2&of=4][&note=][&from=&to=][&intro] replays a match, cuts it into
// a film (film.js) and draws its shots (world.js); the soundtrack is rendered offline from the same events by the viewer's sound.
//   window.__prepare() -> { shots, seconds, ... };  window.__draw(k) -> JPEG data URL;  window.__sheet(ks, cols, w);  window.__audio() -> WAV base64
import { createMatch, step, summary } from '../src/engine.js';
import { RULES } from '../src/rules.js';
import { botSeed } from '../src/rng.js';
import { loadPageBot } from '../src/pagebot.js';
import { makeFilm } from './film.js';
import { createWorld } from './world.js';
import { castOf } from './fighters.js';
import { FightSound, toWav } from '../viewer/audio.js';

const q = new URLSearchParams(location.search), canvas = document.getElementById('c');
let film = null, world = null, seed = 0;
const castId = name => name.split('/').pop().replace(/\.js$/, '');            // s1/claude -> claude (sparring bots fall back to a plain fighter)

window.__prepare = async () => {
  const names = [q.get('left'), q.get('right')]; seed = +q.get('seed') >>> 0;
  const src = await Promise.all(names.map(async n => (await fetch(`/bots/${n}.js`, { cache: 'no-store' })).text()));
  const fns = src.map((s, side) => loadPageBot(s, { seed: botSeed(seed, side), rules: RULES, name: names[side] }));
  const m = createMatch({ seed, rules: RULES, record: true });
  while (!m.over) step(m, (side, v) => fns[side](JSON.stringify(v)));
  const who = names.map(castId), cast = who.map(castOf);
  const card = { title: q.get('title') || null, before: q.get('before') || null, after: q.get('after') || null };
  if (q.get('wins')) { card.wins = q.get('wins').split(':').map(Number); card.of = +(q.get('of') || 4); }
  if (q.get('note')) card.note = q.get('note');
  const range = q.get('from') != null ? [+q.get('from'), +(q.get('to') ?? 1e9)] : null;
  film = makeFilm({ frames: m.frames, events: m.events, rules: RULES, names: cast.map(c => c.name), colors: cast.map(c => c.palette), reason: m.reason, fps: +(q.get('fps') || 24), card, range, intro: q.get('intro') != null ? true : null });
  world = createWorld(canvas, { rules: RULES, film, who });
  const s = summary(m);
  return { shots: film.shots.length, seconds: +film.duration.toFixed(1), frames: m.frames.length, winner: s.winner, reason: s.reason, who };
};
window.__draw = (k, type = 'image/jpeg', quality = 0.92) => { world.draw(k); return canvas.toDataURL(type, quality); };
// a contact sheet of shots ks, cols across, each w wide, labelled with the shot number
window.__sheet = (ks, cols, w) => {
  const h = Math.round(w * 9 / 16), c = Object.assign(document.createElement('canvas'), { width: cols * w, height: Math.ceil(ks.length / cols) * h }), g = c.getContext('2d');
  ks.forEach((k, i) => { world.draw(k); const x = (i % cols) * w, y = Math.floor(i / cols) * h; g.drawImage(canvas, x, y, w, h); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x, y, 64, 20); g.fillStyle = '#fff'; g.font = '13px Menlo, monospace'; g.fillText(String(k), x + 5, y + 15); });
  return c.toDataURL('image/jpeg', 0.88);
};
window.__audio = async () => {
  const rate = 48000, fps = film.fps, off = new OfflineAudioContext(2, Math.ceil((film.shots.length / fps + 1.5) * rate), rate), snd = new FightSound();
  await snd.load('/assets/sfx/', off);
  snd.reset(seed);
  film.shots.forEach((sh, k) => {
    snd.when = k / fps;
    const F = film.frames[Math.floor(sh.tick)];
    if (sh.events.length) snd.events(sh.events, F);
    snd.frame(F, RULES, Math.floor(sh.tick));
  });
  snd.when = film.shots.length / fps; snd.hush();
  return toWav(await off.startRendering());
};
window.__shotOf = tick => film.shots.findIndex(s => s.tick >= tick && !s.hold);   // the first shot showing that match tick
window.READY = true;
