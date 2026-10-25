// film.js: a recorded match turned into a film. For every output frame it decides which moment of the match is shown (real time,
// slow motion around a beam and the finish, the picture held on an impact), where the camera looks, and the treatments an anime
// fight is read by: shake, impact frames, flash, zoom blur, speed lines, words on screen. Pure: the same match gives the same film.
//
//   const film = makeFilm({ frames, events, rules, names, colors, reason, fps })
//   film.shots[k] = { tick, hold, events, cam: { x, y, zoom }, fx: { shake, tone, invert, flash, blur, blurC, speed, bgSpeed, words } }
import { mulberry32 } from '../src/rng.js';

export const VIEW = 1000;                        // the stage width (engine units) seen at zoom 1
export const ASPECT = 16 / 9;

const HOLD = { light: 1, blast: 1, heavy: 3, beam: 4 };
function holdFor(evs = []) {
  let h = 0;
  for (const e of evs) {
    if (e.type === 'hit') h = Math.max(h, (HOLD[e.kind] || 0) + (e.counter && e.kind === 'heavy' ? 1 : 0));
    else if (e.type === 'crush') h = Math.max(h, 4);
    else if (e.type === 'clash') h = Math.max(h, 3);
    else if (e.type === 'clash_win' || e.type === 'clash_draw') h = Math.max(h, 6);
    else if (e.type === 'ko') h = Math.max(h, 10);
  }
  return h;
}

// card: { title, before, after } words for the opening and closing holds (a final: "决赛 · 第 3 局", the score before and after);
//   wins: [left, right] games won so far in a series and of: how many it takes, shown as pips under the bars
//   note: a line kept on screen under the timer (a game cut short says what it leaves out)
// range: [fromTick, toTick] films only that stretch, with no opening hold unless intro is set (a highlight; a game cut short)
export function makeFilm({ frames, events, rules: R, names = ['', ''], colors = [['#fff', '#fff', '#fff'], ['#fff', '#fff', '#fff']], reason = 'ko', fps = 24, intro = null, outro = 2.6, card = {}, range = null }) {
  const N = frames.length, last = N - 1, byTick = new Map();
  for (const e of events) { if (!byTick.has(e.t)) byTick.set(e.t, []); byTick.get(e.t).push(e); }
  const real = R.fps / fps;                                                    // match ticks per output frame at real speed (2.5)
  const clashStart = []; for (const e of events) if (e.type === 'clash') clashStart.push(e.t);
  const rate = tick => {
    const F = frames[Math.min(last, Math.floor(tick))];
    if (reason === 'ko' && tick > last - 40) return real * 0.3;               // the finish in slow motion
    if (F.c) { const since = tick - Math.max(...clashStart.filter(s => s <= tick), 0); return since < 40 ? real * 0.4 : real * 0.8; }
    if (F.f.some(f => f[1] === 'beam' && f[6] === 'startup')) return real * 0.6;   // the charge-up is a moment
    return real;
  };

  // 1. which match moment each output frame shows
  const shots = [];
  if (intro == null) intro = !range;
  if (range) outro = range[1] >= last ? outro : 0;
  if (intro) for (let i = 0; i < Math.round(fps * 1.6); i++) shots.push({ tick: range ? range[0] : 0, hold: i + 1, intro: i, events: [] });   // held on the first moment shown
  let t = range ? range[0] : 0, prev = t - 1;
  while (true) {
    let tick = Math.min(t, last), stop = null;
    for (let k = Math.floor(prev) + 1; k <= Math.floor(tick); k++) { const h = holdFor(byTick.get(k)); if (h) { stop = { k, h }; break; } }
    if (stop) tick = stop.k;
    const evs = []; for (let k = Math.floor(prev) + 1; k <= Math.floor(tick); k++) evs.push(...(byTick.get(k) || []));
    shots.push({ tick, hold: 0, events: evs });
    if (stop) for (let i = 0; i < stop.h; i++) shots.push({ tick, hold: i + 1, by: stop.k, events: [] });
    prev = tick;
    if (tick >= last || (range && tick >= range[1])) break;
    t = tick + rate(tick);
  }
  for (let i = 0; i < Math.round(fps * outro); i++) shots.push({ tick: last, hold: 100 + i, outro: i, events: [] });

  // 2. the camera: framing both fighters (and a beam's reach), a punch-in on impacts, smoothed like a camera operator would
  const rand = mulberry32(0x5f11);
  let cx = null, cz = null, kick = 0, kickX = 0, shake = 0, blur = 0, flash = 0, speedAmt = 0, speedAt = [0.5, 0.5], tone = 0, toneCol = ['#ffffff', '#000000'], invert = 0;   // tone, invert: frames left
  const words = [];                                                           // live words: { text, x, y, size, color, born, life }
  shots.forEach((s, k) => {
    const F = frames[Math.min(last, Math.floor(s.tick))], xs = F.f.map(f => f[0]);
    let lo = Math.min(...xs), hi = Math.max(...xs), focus = (lo + hi) / 2;
    for (const b of F.m) if (b) { lo = Math.min(lo, b[1]); hi = Math.max(hi, b[1]); }
    let tz = Math.max(1.12, Math.min(2.0, VIEW / (hi - lo + 330))), tx = (lo + hi) / 2;
    let cut = false;
    if (F.c) {
      const since = F.c[1], angle = Math.floor(since / 45) % 4, ang = [null, 0, 1, null][angle];
      if (ang == null) { tx = F.c[0] * 0.6 + focus * 0.4; tz = Math.min(2.1, tz * 1.08 + Math.min(since, 120) / 120 * 0.3); }
      else { tx = F.f[ang][0] - F.f[ang][3] * 40; tz = 2.2; }
      cut = s.hold === 0 && since > 0 && Math.floor(since / 45) !== Math.floor(Math.max(0, since - real) / 45);
    }
    if (s.intro != null) { tz = 1.75 - s.intro / (fps * 1.6) * 0.3; }
    if (s.outro != null) { const loser = F.f.findIndex(f => f[1] === 'ko'); if (loser >= 0) { tx = F.f[loser][0] * 0.6 + focus * 0.4; tz = 1.7 + s.outro * 0.003; } }
    // impacts: who was hit, where, how hard
    for (const e of s.events) {
      const def = e.side >= 0 ? (e.type === 'hit' || e.type === 'crush' ? 1 - e.side : e.side) : -1, dx = def >= 0 ? F.f[def][0] : focus;
      if (e.type === 'hit' || e.type === 'crush') {
        const big = e.type === 'crush' || e.kind === 'heavy' || e.kind === 'beam';
        shake = Math.max(shake, big ? 0.014 : e.kind === 'blast' ? 0.006 : 0.004);
        if (big) { kick = 0.12; kickX = dx; flash = Math.max(flash, 0.22); speedAmt = 0.42; speedAt = [dx, 95]; blur = Math.max(blur, 0.08); }
        if (e.type === 'crush') words.push({ text: '破防!', x: dx, y: 230, size: 120, color: colors[e.side][1], born: k, life: 30 });
        if (e.type === 'hit' && e.combo >= 3) { for (const w of words) if (w.combo) w.life = Math.min(w.life, k - w.born); words.push({ text: `${e.combo} 连击`, x: dx, y: 250, size: 72, color: '#ffe36b', born: k, life: 20, combo: true }); }
      }
      if (e.type === 'clash') { shake = Math.max(shake, 0.012); flash = 0.5; words.push({ text: '对冲!', x: F.c ? F.c[0] : focus, y: 260, size: 150, color: '#fff6c8', born: k, life: 36 }); }
      if (e.type === 'clash_win' || e.type === 'clash_draw') { shake = 0.026; flash = 0.75; speedAmt = 0.7; speedAt = [dx, 95]; }
      if (e.type === 'dash_forward' || e.type === 'dash_back') blur = Math.max(blur, 0.1);
      if (e.type === 'dodge') words.push({ text: '闪!', x: F.f[e.side][0], y: 250, size: 90, color: colors[e.side][1], born: k, life: 18 });
      if (e.type === 'ko') { shake = 0.03; flash = 0.8; invert = 2; speedAmt = 0.8; speedAt = [dx, 95]; }
    }
    if (kick > 0.001) { tz *= 1 + kick; tx = tx * (1 - kick * 2.2) + kickX * kick * 2.2; }
    const held = s.hold > 0 && s.hold < 100;
    if (cx == null) { cx = tx; cz = tz; }
    else if (cut) { cx = tx; cz = tz; }                                           // a cut, not a pan
    else if (!held) { cx += (tx - cx) * 0.16; cz += (tz - cz) * 0.12; }
    const viewW = VIEW / cz, viewH = viewW / ASPECT, cy = viewH * 0.34;           // the ground line sits about a sixth of the way up
    const uv = (x, y) => [0.5 + (x - cx) / viewW, 0.5 + (y - cy) / viewH];
    // continuous treatments
    const fx = { shake: [0, 0], tone: null, invert: 0, flash: 0, blur: 0, blurC: [0.5, 0.5], speed: null, bgSpeed: null, words: [] };
    if (shake > 0.0005) { const a = rand() * Math.PI * 2; fx.shake = [Math.cos(a) * shake, Math.sin(a) * shake * 0.7]; }
    if (invert > 0) fx.invert = 1; else if (tone > 0) fx.tone = [1, toneCol[0], toneCol[1], 0.32];
    fx.flash = flash; fx.blur = blur; fx.blurC = uv(kickX || focus, 100);
    if (speedAmt > 0.02) fx.speed = { amount: speedAmt, center: uv(...speedAt), inner: 0.22, fat: 1.0 };
    if (F.c) fx.bgSpeed = { amount: 0.4, center: uv(F.c[0], 100), inner: 0.12 };
    else if (F.f.some(f => f[1] === 'charge' || (f[1] === 'beam' && f[6] !== 'recovery'))) fx.bgSpeed = { amount: 0.16, center: uv(focus, 100), inner: 0.25 };
    if (s.intro != null) fx.intro = { k: s.intro, n: Math.round(fps * 1.6), names, colors, title: card.title, score: card.before };
    if (s.outro != null) fx.outro = { k: s.outro, reason, score: card.after };
    for (const w of words) { const age = k - w.born; if (age >= 0 && age < w.life) { const p = uv(w.x, w.y); fx.words.push({ ...w, u: Math.max(0.2, Math.min(0.8, p[0])), v: w.size > 100 ? 0.7 : 0.62, age }); } }
    s.cam = { x: cx, y: cy, zoom: cz, viewW, viewH };
    s.fx = fx;
    // decay (a held frame keeps shaking but does not let the camera or the flashes run down as fast)
    const d = held ? 0.92 : 0.8;
    shake *= d; kick *= held ? 0.97 : 0.75; flash *= 0.6; blur *= 0.7; speedAmt *= held ? 0.97 : 0.82; tone = Math.max(0, tone - 1); invert = Math.max(0, invert - 1);
  });
  return { shots, fps, frames, byTick, last, card, duration: shots.length / fps };
}
