// render.js: one match as a film, for arena/preview.mjs. The film is every match frame once, held copies on impacts (the hit
// stop), and a tail on the last frame; its soundtrack is rendered offline by the same sound code the viewer plays live.
//   ?left=sparring/turtle&right=sparring/mixer&seed=7   then window.__prepare(), window.__draw(k) for each shot, window.__audio()
import { createMatch, step, summary } from '../src/engine.js';
import { RULES } from '../src/rules.js';
import { botSeed } from '../src/rng.js';
import { loadPageBot } from '../src/pagebot.js';
import { drawFrame } from './draw.js';
import { FightSound, hitstopOf, toWav } from './audio.js';

const q = new URLSearchParams(location.search), canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
const TAIL = 120;
let film = null;

window.__prepare = async () => {
  const names = [q.get('left'), q.get('right')], seed = +q.get('seed') >>> 0;
  const src = await Promise.all(names.map(async n => (await fetch(`/bots/${n}.js`)).text()));
  const label = i => (/^\/\/\s*([^·\n]+?)\s*·/.exec(src[i]) || /^\/\/\s*([^:：\n]+)[:：]/.exec(src[i]))?.[1].trim() || names[i].split('/').pop();
  const fns = src.map((s, side) => loadPageBot(s, { seed: botSeed(seed, side), rules: RULES, name: names[side] }));
  const m = createMatch({ seed, rules: RULES, record: true });
  while (!m.over) step(m, (side, v) => fns[side](JSON.stringify(v)));
  const byTick = new Map();
  for (const e of m.events) { if (!byTick.has(e.t)) byTick.set(e.t, []); byTick.get(e.t).push(e); }
  const shots = [];
  for (let f = 0; f < m.frames.length; f++) {
    shots.push({ f, first: true });
    const hs = hitstopOf(byTick.get(f) || []);
    for (let h = 0; h < hs; h++) shots.push({ f, hold: h });
  }
  for (let h = 0; h < TAIL; h++) shots.push({ f: m.frames.length - 1 });
  const s = summary(m), w = s.winner == null ? null : label(s.winner);
  film = { m, byTick, shots, seed, names: [label(0), label(1)], who: names.map(n => n.split('/').pop()), summary: s,
    result: { big: s.reason === 'time' ? '时间到' : s.reason === 'double_ko' ? '双倒' : 'K.O.', small: w ? `${w} 胜` : '平局' } };
  return { shots: shots.length, frames: m.frames.length, seconds: +(shots.length / 60).toFixed(1), winner: w, reason: s.reason, highlight: s.highlight };
};

window.__draw = k => {
  const sh = film.shots[k];
  drawFrame(ctx, { frames: film.m.frames, at: sh.f, byTick: film.byTick, names: film.names, who: film.who, rules: RULES, result: film.result, fx: sh.hold != null ? { hold: sh.hold, phase: k } : null });
  return canvas.toDataURL('image/jpeg', 0.9);
};

window.__audio = async () => {
  const rate = 48000, off = new OfflineAudioContext(2, Math.ceil((film.shots.length / 60 + 1.5) * rate), rate), snd = new FightSound();
  await snd.load('/assets/sfx/', off);
  snd.reset(film.seed);
  film.shots.forEach((sh, k) => {
    if (!sh.first) return;
    snd.when = k / 60;
    const evs = film.byTick.get(sh.f);
    if (evs) snd.events(evs, film.m.frames[sh.f]);
    snd.frame(film.m.frames[sh.f], RULES, sh.f);
  });
  snd.when = film.shots.length / 60; snd.hush();
  return toWav(await off.startRendering());
};
