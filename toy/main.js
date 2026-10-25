// main.js: the playable page: the episode's 点击即玩, and our own web page until the Toy is open to us. Pick one of the season's six,
// fight its program yourself (on-screen buttons on a phone, the keyboard on a computer) and see how you did; store.js keeps the record and,
// inside the Toy, the boards. The fight runs the league's engine on the bot's own source: you face exactly what the other AIs faced.
import { createMatch, step, summary } from '../src/engine.js';
import { RULES } from '../src/rules.js';
import { botSeed } from '../src/rng.js';
import { loadPageBot } from '../src/pagebot.js';
import { drawFrame } from '../viewer/draw.js';
import { FightSound, hitstopOf } from '../viewer/audio.js';
import { CAST, castOf } from '../anime/fighters.js';
import { drawStick } from '../anime/stick.js';
import { pad, bindKeys, bindButtons } from './input.js';
import { store } from './store.js';
import { DRILL_RULES, MODES, dummy } from './practice.js';

CAST.human = { name: '你', palette: ['#ffffff', '#ff5d73', '#e0244a'], build: { k: 1, sh: 1, arm: 1, leg: 1 }, hair: 'spiky', extras: [] };   // the player: a seventh look, rose red
CAST.partner = { name: '陪练', palette: ['#ffffff', '#9fe6ff', '#45a8d3'], build: { k: 1, sh: 1, arm: 1, leg: 1 }, hair: 'spiky', extras: [] };   // the practice partner

const $ = id => document.getElementById(id), ctx = $('c').getContext('2d');
const root = new URL('..', import.meta.url).href, snd = new FightSound(), sources = new Map();
let roster = null, live = null, gauntlet = null, last = null;
const fighterOf = id => roster.fighters.find(f => f.id === id);
const show = id => { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id); };
// a frame of the two standing at their marks, for before the first tick
const standing = () => ({ f: [0, 1].map(i => [RULES.start[i], 'idle', 0, i ? -1 : 1, RULES.hp, RULES.kiStart, null, 0]), b: [], m: [null, null], c: null });
// the picture: upright phones get a taller canvas with the ground low, so the camera can come closer without cutting heads off
let view = { ground: 520, zmax: 1.75, room: 430 };
function layout() {
  const tall = innerHeight > innerWidth * 1.2, c = $('c');
  view = tall ? { ground: 900, zmax: 2.4, room: 320 } : { ground: 520, zmax: 1.75, room: 430 };
  if (c.height !== (tall ? 1000 : 640)) c.height = tall ? 1000 : 640;
}
// the camera: closer when the two are close, back far enough to keep both (and any beam's front) in view, never past the stage's ends
function aim(cam, fr, dt) {
  const xs = fr.f.map(f => f[0]); if (fr.c) xs.push(fr.c[0]); for (const b of fr.m) if (b) xs.push(b[1]);
  const lo = Math.min(...xs), hi = Math.max(...xs), zoom = Math.max(1, Math.min(view.zmax, 1000 / (hi - lo + view.room))), half = 500 / zoom;
  const x = Math.max(half, Math.min(1000 - half, (lo + hi) / 2)), k = 1 - Math.exp(-dt * 5);
  if (!cam) return { x, zoom, ground: view.ground };
  cam.ground = view.ground;
  cam.zoom += (zoom - cam.zoom) * k; const h = 500 / cam.zoom; cam.x = Math.max(h, Math.min(1000 - h, cam.x + (x - cam.x) * k));
  return cam;
}
const hudEls = () => [...document.querySelectorAll('#hud .side')].map(el => ({ hp: el.querySelector('.hp'), ki: el.querySelector('.ki i'), name: el.querySelector('.name') }));
function hud(L, fr, tick) {
  const els = L.hud || (L.hud = hudEls());
  fr.f.forEach((F, i) => {
    const hp = Math.max(0, F[4]), c = castOf(L.who[i]).palette[1], e = els[i];
    e.hp.style.width = `${(100 * hp) / RULES.hp}%`; e.hp.style.background = hp > RULES.hp * 0.3 ? c : '#ff4a4a';
    e.ki.style.width = `${F[5]}%`; e.ki.style.background = F[5] >= RULES.beam.cost ? '#fff3a0' : '#9fe6ff';
    e.name.textContent = `${L.names[i]}  ${hp}`; e.name.style.color = c;
  });
  $('clock').textContent = L.drill ? '∞' : Math.max(0, Math.ceil((RULES.maxTicks - tick) / RULES.fps));
}

async function source(bot) {
  if (!sources.has(bot)) sources.set(bot, await (await fetch(`${root}bots/${bot}.js`)).text());
  return sources.get(bot);
}

async function init() {
  roster = await (await fetch(new URL('roster.json', import.meta.url))).json();
  await store.init();
  snd.load(`${root}assets/sfx/`).catch(e => console.warn('sound off:', e));
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => snd.unlock());
  bindKeys(() => !!live && live.intro <= 0 && !live.done, () => live.m.tick);
  bindButtons($('pad'), () => !!live && !live.done, () => live.m.tick);
  addEventListener('visibilitychange', () => { pad.reset(); if (live) live.acc = 0; });
  layout(); addEventListener('resize', layout);
  $('quit').onclick = () => { live = null; gauntlet = null; snd.hush(); $('app').classList.remove('fighting', 'practice'); menu(); };
  $('drill').onclick = () => practice('stand');
  for (const b of document.querySelectorAll('[data-mode]')) b.onclick = () => live?.drill && setMode(b.dataset.mode);
  $('inf').onclick = () => { if (live?.drill) { live.drill.inf = !live.drill.inf; $('inf').classList.toggle('on', live.drill.inf); } };
  $('how').onclick = () => show('help'); $('help-ok').onclick = () => show('select');
  $('gauntlet').onclick = async () => { if (!(await store.gauntletOpen())) return; gauntlet = { order: roster.fighters.map(f => f.id).reverse(), i: 0 }; fight(gauntlet.order[0]); };
  $('r-again').onclick = () => fight(last.id); $('r-back').onclick = () => { gauntlet = null; menu(); };
  $('r-next').onclick = () => fight(gauntlet.order[gauntlet.i]);
  if (store.inToy) { $('ranks').hidden = false; $('ranks').onclick = () => boards('streak'); }
  for (const b of document.querySelectorAll('[data-board]')) b.onclick = () => boards(b.dataset.board);
  $('boards-ok').onclick = () => show('select');
  $('games').textContent = roster.games;
  await menu();
  requestAnimationFrame(frame);
}

// ---- picking an opponent
async function menu() {
  const humans = await store.humans(), me = store.me;
  $('cards').innerHTML = '';
  for (const f of roster.fighters) {
    const [w, l] = store.record(f.id), h = humans?.[f.id], card = document.createElement('button');
    card.className = 'card';
    card.innerHTML = `<canvas width="128" height="160"></canvas><div><b style="color:${castOf(f.id).palette[1]}">${f.short}</b><small>${f.model}</small>`
      + `<small>联赛第 ${f.rank} · 胜率 ${f.win}%</small><small>${w + l ? `你：${w} 胜 ${l} 负` : '还没交过手'}${h && h[0] + h[1] ? ` · 人类胜率 ${Math.round((100 * h[0]) / (h[0] + h[1]))}%` : ''}</small></div>`
      + (f.place ? `<span class="badge${f.place === '亚军' ? ' silver' : ''}">${f.place}</span>` : '');
    portrait(card.querySelector('canvas'), f.id);
    card.onclick = () => { gauntlet = null; fight(f.id); };
    $('cards').append(card);
  }
  const open = await store.gauntletOpen();
  $('gauntlet-sub').textContent = open ? `从最后一名打到冠军 ${fighterOf(roster.champion).short}，输一局就结束` : '给第一集三连或关注 UP 主后解锁';
  $('me').textContent = me.games ? `你一共打了 ${me.games} 局 · 最高连胜 ${me.best} · 赢过冠军 ${me.champ} 次` : '';
  show('select');
}
function portrait(cv, id) {
  const g = cv.getContext('2d'); g.translate(64, 150); g.scale(0.62, 0.62);
  drawStick(g, id, [0, 'idle', 0, 1, RULES.hp, 70, null, 0], RULES, { tick: 0, px: 0.62 });
}

// ---- a fight: you are the left side, asked every tick; the AI is asked as often as in the league
async function fight(id) {
  const f = fighterOf(id), seed = (Math.random() * 2 ** 32) >>> 0;
  snd.unlock();
  const bot = loadPageBot(await source(f.bot), { seed: botSeed(seed, 1), rules: RULES, name: `${f.bot}.js` });
  const m = createMatch({ seed, rules: RULES, record: true, cadence: [1, RULES.decideEvery] });
  pad.reset(); snd.reset(seed);
  live = { m, f, ask: (side, v) => (side ? bot(JSON.stringify(v)) : pad.intent(v, m.tick)), acc: 0, hold: 0, held: 0, intro: 1.5, done: false, end: 0,
    names: ['你', f.short], who: ['human', f.id], cam: null };
  last = f; show(null); $('app').classList.add('fighting');
}

// ---- the practice room: no clock, health refills before anyone falls, ki on tap if wanted; nothing is recorded
async function practice(mode) {
  const seed = (Math.random() * 2 ** 32) >>> 0, inf = live?.drill?.inf ?? true;
  snd.unlock();
  const m = createMatch({ seed, rules: DRILL_RULES, record: true, cadence: [1, RULES.decideEvery] });
  pad.reset(); snd.reset(seed);
  const L = { m, seed, f: { short: '陪练' }, drill: { mode, inf, combo: null }, partner: () => 'idle', acc: 0, hold: 0, held: 0, intro: 0.8, done: false, end: 0, names: ['你', '陪练'], who: ['human', 'partner'], cam: null };
  L.ask = (side, v) => (side ? L.partner(v) : pad.intent(v, m.tick));
  live = L; await setMode(mode);
  $('inf').classList.toggle('on', inf); show(null); $('app').classList.add('fighting', 'practice');
}
async function setMode(mode) {
  const L = live, M = MODES[mode];
  L.drill.mode = mode; L.names[1] = `陪练 · ${M.label}`; L.hud = null;
  if (M.bot) { const fn = loadPageBot(await source(M.bot), { seed: botSeed(L.seed, 1), rules: DRILL_RULES, name: `${M.bot}.js` }); L.partner = v => fn(JSON.stringify(v)); }
  else L.partner = dummy(mode);
  for (const b of document.querySelectorAll('[data-mode]')) b.classList.toggle('on', b.dataset.mode === mode);
  $('drilltip').textContent = M.tip;
}
function drillTick(L, evs, now) {
  const R = DRILL_RULES;
  for (const a of L.m.f) if (a.hp < R.hp * 0.4) a.hp = R.hp;              // no one falls in practice
  if (L.drill.inf) L.m.f[0].ki = R.kiMax;
  for (const e of evs) if (e.type === 'hit' && e.side === 0) {            // your combo: how many in a row, how much it took
    const c = e.combo > 1 && L.drill.combo ? L.drill.combo : (L.drill.combo = { n: 0, dmg: 0 });
    c.n = Math.max(1, e.combo || 1); c.dmg += e.dmg; c.at = now;
  }
  const c = L.drill.combo, on = !!c && now - c.at < 1600;
  if (c) $('combo').textContent = `${c.n > 1 ? `${c.n} 连击 · ` : ''}${c.dmg} 伤害`;
  $('combo').classList.toggle('on', on);
}

let lastT = performance.now(), phase = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; phase += dt * 60;
  if (live) {
    const L = live, m = L.m;
    if (L.intro > 0) {                                                       // READY, then FIGHT!
      L.intro -= dt; $('banner').textContent = L.intro > 0.55 ? 'READY' : 'FIGHT!';
      if (L.intro <= 0) $('banner').textContent = '';
    } else if (!L.done) {
      if (L.hold > 0) { L.hold -= dt * 60; L.held += dt * 60; }
      else {
        L.held = 0; L.acc += dt;
        while (L.acc >= 1 / 60 && !m.over) {
          const n0 = m.events.length;
          step(m, L.ask); L.acc -= 1 / 60;
          const evs = m.events.slice(n0);
          if (L.drill) drillTick(L, evs, now);
          if (evs.length) { snd.events(evs, m.frames[m.frames.length - 1]); const hs = hitstopOf(evs); if (hs) { L.hold = hs; L.acc = 0; break; } }
        }
      }
      if (m.over && L.hold <= 0) { if (L.drill) { practice(L.drill.mode); requestAnimationFrame(frame); return; } L.done = true; L.end = now; snd.hush(); }
    } else if (now - L.end > 900 && !L.shown) { L.shown = true; finish(L); }
    const frames = m.frames.length ? m.frames : [standing()], byTick = new Map();
    for (const e of m.events.slice(-60)) { if (!byTick.has(e.t)) byTick.set(e.t, []); byTick.get(e.t).push(e); }
    const fr = frames[frames.length - 1];
    if (m.frames.length) snd.frame(fr, RULES, frames.length - 1);
    L.cam = aim(L.cam, fr, dt); hud(L, fr, m.tick);
    drawFrame(ctx, { frames, at: frames.length - 1, byTick, names: L.names, who: L.who, rules: RULES, hud: false, cam: L.cam, fx: L.hold > 0 ? { hold: L.held, phase } : null });
    $('hint').classList.toggle('on', !L.done && !!fr.c);
  }
  requestAnimationFrame(frame);
}

// ---- how it went
async function finish(L) {
  const s = summary(L.m), won = s.winner === 0, drawn = s.winner == null, f = L.f;
  $('app').classList.remove('fighting'); $('hint').classList.remove('on');
  if (!drawn) await store.finish(f.id, won, roster.champion);
  const me = store.me, c = castOf(f.id).palette[1];
  $('r-big').textContent = drawn ? '平局' : won ? '你赢了！' : '你输了';
  $('r-big').style.color = won ? 'var(--gold)' : '#fff';
  $('r-why').textContent = `${s.reason === 'time' ? '时间到' : 'K.O.'} · ${(s.ticks / 60).toFixed(1)} 秒 · 你剩 ${Math.max(0, s.hp[0])} 血，${f.short} 剩 ${Math.max(0, s.hp[1])} 血`;
  const line = won ? f.after || f.line : f.line;                           // beaten, it says its post-season line; winning, its pre-fight one
  $('r-line').textContent = line; $('r-line').style.setProperty('--c', c);
  $('r-who').textContent = `—— ${f.model}`; $('r-who').style.setProperty('--c', c);
  $('r-stats').textContent = `连胜 ${me.streak} · 最高连胜 ${me.best} · 你对 ${f.short}：${store.record(f.id).join(' 胜 ')} 负`;
  $('r-next').hidden = true;
  if (gauntlet) {
    if (won && gauntlet.i < gauntlet.order.length - 1) { gauntlet.i++; const n = fighterOf(gauntlet.order[gauntlet.i]); $('r-next').hidden = false; $('r-next').textContent = `车轮战 · 下一位：${n.short}（${gauntlet.i + 1}/${gauntlet.order.length}）`; }
    else { $('r-why').textContent += won ? ' · 车轮战通关！' : ` · 车轮战止步第 ${gauntlet.i + 1} 位`; gauntlet = null; }
  }
  show('result');
}

async function boards(which) {
  show('boards');
  const box = $('board-list'); box.textContent = '读取中…';
  const r = await store.board(which), rows = r?.list?.list ?? r?.list?.items ?? (Array.isArray(r?.list) ? r.list : []);
  box.innerHTML = rows.length ? rows.map((x, i) => `${x.rank ?? i + 1}. ${x.nickname ?? x.uname ?? x.name ?? '观众'}　${x.score}`).join('<br>') : '还没有人上榜';
  if (r?.mine?.score != null) box.innerHTML += `<br><br>你：${r.mine.score}${r.mine.rank ? `（第 ${r.mine.rank} 名）` : ''}`;
}

window.__toy = () => live && { tick: live.m.tick, me: { x: live.m.f[0].x, state: live.m.f[0].state, hp: live.m.f[0].hp, ki: live.m.f[0].ki }, ai: { x: live.m.f[1].x, hp: live.m.f[1].hp }, events: live.m.events.length };   // for tests

init();
