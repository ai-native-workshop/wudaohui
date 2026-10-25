// viewer.js: pick two fighters and a seed and watch the match frame by frame, or take one side yourself with the keyboard.
// A bot-vs-bot match is computed whole first (it takes milliseconds), then played back with sound and hit stop; a match with you
// in it runs live at 60 ticks a second and becomes a replay when it ends. The hit stop only holds the picture: the fight itself
// is the same frames either way. URL: ?left=sparring/mixer&right=sparring/zoner&seed=7&league=out/league.json
import { createMatch, step, summary } from '../src/engine.js';
import { RULES } from '../src/rules.js';
import { botSeed } from '../src/rng.js';
import { loadPageBot } from '../src/pagebot.js';
import { drawFrame } from './draw.js';
import { FightSound, hitstopOf } from './audio.js';

const $ = id => document.getElementById(id), ctx = $('c').getContext('2d');
const q = new URLSearchParams(location.search), HUMAN = 'human';
const sources = new Map(), snd = new FightSound();
const castId = name => (name === HUMAN ? 'other' : name.split('/').pop());        // s1/claude -> claude: colour and hair (anime/fighters.js)
let show = null, live = null;          // show: a replay; live: a match you are in
const opt = { sound: true, stop: true };

async function source(name) {
  if (!sources.has(name)) sources.set(name, await (await fetch(`/bots/${name}.js`, { cache: 'no-store' })).text());
  return sources.get(name);
}
const label = async name => {
  if (name === HUMAN) return '你';
  const src = await source(name), m = /^\/\/\s*([^·\n]+?)\s*·/.exec(src) || /^\/\/\s*([^:：\n]+)[:：]/.exec(src);   // "// Name · model · time" (contest) or "// 名字: what it does" (sparring)
  return m ? m[1].trim() : name.split('/').pop();
};

async function init() {
  snd.load('/assets/sfx/').catch(e => console.warn('sound off:', e));
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => snd.unlock());
  const bots = await (await fetch('/api/bots')).json();
  for (const sel of [$('left'), $('right')]) {
    sel.innerHTML = '';
    for (const b of [HUMAN, ...bots]) { const o = document.createElement('option'); o.value = b; o.textContent = b === HUMAN ? '你（键盘）' : `${await label(b)} · ${b}`; sel.append(o); }
  }
  $('left').value = q.get('left') || 'sparring/tactician';
  $('right').value = q.get('right') || 'sparring/reactor';
  $('seed').value = q.get('seed') || 1;
  const hl = await (await fetch(`/api/highlights?league=${encodeURIComponent(q.get('league') || 'out/league.json')}`)).json();
  for (const h of hl) {
    const o = document.createElement('option'); o.value = JSON.stringify(h);
    o.textContent = `${h.score.toFixed(1)}  ${(await Promise.all(h.bots.map(label))).join(' vs ')}  ${h.secs}s ${h.clashes ? '对冲 ' : ''}终结 ${h.finisher}`;
    $('hl').append(o);
  }
  $('go').onclick = fight;
  $('dice').onclick = () => { $('seed').value = Math.floor(Math.random() * 4294967296); fight(); };
  $('hl').onchange = () => { if (!$('hl').value) return; const h = JSON.parse($('hl').value); $('left').value = h.bots[0]; $('right').value = h.bots[1]; $('seed').value = h.seed; fight(); };
  $('play').onclick = () => { if (!show) return; show.playing = !show.playing; if (show.playing && show.at >= show.frames.length - 1) seek(0); if (!show.playing) snd.hush(); };
  $('back1').onclick = () => nudge(-1); $('fwd1').onclick = () => nudge(1);
  $('scrub').oninput = () => { if (show) { seek(+$('scrub').value); show.playing = false; } };
  $('sound').onchange = () => { opt.sound = $('sound').checked; snd.enable(opt.sound); };
  $('vol').oninput = () => snd.volume(+$('vol').value);
  $('stop').onchange = () => { opt.stop = $('stop').checked; };
  addEventListener('keydown', e => {
    if (live) return;
    if (e.key === ',') nudge(-1); if (e.key === '.') nudge(1);
    if (e.key === ' ' && show && e.target === document.body) { e.preventDefault(); $('play').click(); }
  });
  requestAnimationFrame(frame);
  if (q.get('autoplay') !== '0') fight();
}
function seek(i) { if (!show) return; show.at = Math.max(0, Math.min(show.frames.length - 1, i)); show.done = Math.floor(show.at); show.hold = 0; snd.hush(); }
function nudge(d) { if (show) { show.playing = false; seek(Math.floor(show.at) + d); } }

async function fight() {
  snd.unlock();
  const names = [$('left').value, $('right').value], seed = +$('seed').value >>> 0, me = names.indexOf(HUMAN);
  const labels = await Promise.all(names.map(label));
  const fns = await Promise.all(names.map(async (n, side) => n === HUMAN ? null : loadPageBot(await source(n), { seed: botSeed(seed, side), rules: RULES, name: n })));
  keys.reset(); snd.reset(seed);
  if (me < 0) {
    const m = createMatch({ seed, rules: RULES, record: true });
    while (!m.over) step(m, (side, v) => fns[side](JSON.stringify(v)));
    live = null; show = replay(m, labels, names.map(castId)); show.playing = true;
  } else {
    const m = createMatch({ seed, rules: RULES, record: true, cadence: names.map(n => (n === HUMAN ? 1 : RULES.decideEvery)) });
    live = { m, labels, who: names.map(castId), acc: 0, hold: 0, held: 0, ask: (side, v) => (fns[side] ? fns[side](JSON.stringify(v)) : keys.intent(v, m.tick)) };
    show = null;
  }
  history.replaceState(null, '', `?left=${names[0]}&right=${names[1]}&seed=${seed}${q.get('league') ? '&league=' + q.get('league') : ''}`);
}

function replay(m, labels, who) {
  const s = summary(m), byTick = new Map();
  for (const e of m.events) { if (!byTick.has(e.t)) byTick.set(e.t, []); byTick.get(e.t).push(e); }
  const w = s.winner == null ? null : labels[s.winner];
  const result = { big: s.reason === 'time' ? '时间到' : s.reason === 'double_ko' ? '双倒' : 'K.O.', small: w ? `${w} 胜` : '平局' };
  $('result').textContent = `${result.big} ${result.small} · ${(s.ticks / 60).toFixed(1)} 秒 · 名局分 ${s.highlight}`;
  $('scrub').max = m.frames.length - 1;
  return { frames: m.frames, byTick, events: m.events, names: labels, who, result, at: 0, done: -1, hold: 0, held: 0, playing: false, logAt: -1 };
}

const SAY = { light: '轻拳', heavy: '重击', blast: '气功波', beam: '大招', clash: '对冲' };
function logUpTo(t) {
  if (!show || show.logAt === t) return; show.logAt = t;
  const n = show.names, lines = [];
  for (const e of show.events) {
    if (e.t > t) break;
    const who = e.side >= 0 ? n[e.side] : '', at = (e.t / 60).toFixed(1).padStart(5);
    if (e.type === 'hit') lines.push(`${at}  ${who} ${SAY[e.kind] || e.kind} 命中 -${e.dmg}${e.combo > 1 ? `（${e.combo} 连击）` : ''}${e.counter ? ' 反击' : ''}`);
    else if (e.type === 'crush') lines.push(`${at}  ${who} 重击破防`);
    else if (e.type === 'dodge') lines.push(`${at}  ${who} 瞬移躲开${SAY[e.what] || e.what}`);
    else if (e.type === 'beam_out') lines.push(`${at}  ${who} 放出大招`);
    else if (e.type === 'clash') lines.push(`${at}  对冲！`);
    else if (e.type === 'clash_win') lines.push(`${at}  ${who} 推赢对冲（${(e.ticks / 60).toFixed(1)} 秒）`);
    else if (e.type === 'clash_draw') lines.push(`${at}  对冲爆炸，两败俱伤`);
    else if (e.type === 'ko') lines.push(`${at}  K.O. ${e.side >= 0 ? who + ' 胜' : ''}`);
    else if (e.type === 'time') lines.push(`${at}  时间到 ${e.side >= 0 ? who + ' 胜' : '平局'}`);
    else if (e.type === 'forfeit') lines.push(`${at}  ${who} 判负（${e.why}）`);
  }
  $('log').textContent = lines.slice(-40).join('\n');
  $('log').scrollTop = 1e9;
}

let lastT = performance.now(), phase = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; phase += dt * 60;
  if (live) {
    const m = live.m;
    if (live.hold > 0) { live.hold -= dt * 60; live.held += dt * 60; }
    else {
      live.held = 0; live.acc += dt;
      while (live.acc >= 1 / 60 && !m.over) {
        const n0 = m.events.length;
        step(m, live.ask); live.acc -= 1 / 60;
        const evs = m.events.slice(n0);
        if (evs.length) { snd.events(evs, m.frames[m.frames.length - 1]); const hs = opt.stop ? hitstopOf(evs) : 0; if (hs) { live.hold = hs; live.acc = 0; break; } }
      }
    }
    const byTick = new Map(); for (const e of m.events.slice(-60)) { if (!byTick.has(e.t)) byTick.set(e.t, []); byTick.get(e.t).push(e); }
    if (m.frames.length) {
      snd.frame(m.frames[m.frames.length - 1], RULES, m.frames.length - 1);
      drawFrame(ctx, { frames: m.frames, at: m.frames.length - 1, byTick, names: live.labels, who: live.who, rules: RULES, fx: live.hold > 0 ? { hold: live.held, phase } : null });
    }
    if (m.over && live.hold <= 0) { show = replay(m, live.labels, live.who); seek(m.frames.length - 1); live = null; snd.hush(); }
  } else if (show) {
    const speed = +$('speed').value, last = show.frames.length - 1;
    if (show.playing) {
      if (show.hold > 0) { show.hold -= dt * 60 * speed; show.held += dt * 60 * speed; }
      else {
        show.held = 0;
        let next = show.at + dt * 60 * speed;
        // play what happens in the frames we pass; stop on the first impact and hold there
        for (let f = show.done + 1; f <= Math.min(Math.floor(next), last); f++) {
          show.done = f;
          const evs = show.byTick.get(f);
          if (!evs) continue;
          snd.events(evs, show.frames[f]);
          const hs = opt.stop ? hitstopOf(evs) : 0;
          if (hs) { next = f; show.hold = hs; break; }
        }
        show.at = Math.min(next, last);
        if (show.at >= last && show.hold <= 0) { show.playing = false; snd.hush(); }
      }
      snd.frame(show.frames[Math.floor(show.at)], RULES, Math.floor(show.at));
    }
    drawFrame(ctx, { frames: show.frames, at: show.at, byTick: show.byTick, names: show.names, who: show.who, rules: RULES, result: show.result, fx: show.hold > 0 ? { hold: show.held, phase } : null });
    $('scrub').value = Math.floor(show.at); $('time').textContent = `${(Math.floor(show.at) / 60).toFixed(1)} s`;
    $('play').textContent = show.playing ? '⏸' : '▶';
    logUpTo(Math.floor(show.at));
  }
  requestAnimationFrame(frame);
}

// the keyboard as a fighter: held keys hold a state, a pressed key starts a move within the next 8 ticks (so mashing works)
const keys = {
  down: new Set(), presses: [],
  reset() { this.down.clear(); this.presses = []; },
  take(code, tick) { const i = this.presses.findIndex(p => p.code === code && tick - p.at <= 8); if (i < 0) return false; this.presses.splice(i, 1); return true; },
  intent(v, tick) {
    this.presses = this.presses.filter(p => tick - p.at <= 8);
    const left = this.down.has('KeyA') || this.down.has('ArrowLeft'), right = this.down.has('KeyD') || this.down.has('ArrowRight');
    const toward = v.me.facing > 0 ? right : left, away = v.me.facing > 0 ? left : right;
    if (v.clash) return this.down.has('KeyJ') ? 'push' : 'idle';
    const move = () => this.take('KeyJ', tick) ? 'light' : this.take('KeyK', tick) ? 'heavy' : this.take('KeyL', tick) ? 'blast' : this.take('KeyI', tick) ? 'beam' : null;
    if (v.me.canCancel) return move() || 'none';
    if (!v.me.free) return 'idle';
    const mv = move(); if (mv) return mv;
    if (this.take('Space', tick)) return away ? 'dash_back' : 'dash_forward';
    if (this.down.has('KeyS') || this.down.has('ArrowDown')) return 'guard';
    if (this.down.has('KeyW') || this.down.has('ArrowUp')) return 'charge';
    return toward ? 'forward' : away ? 'back' : 'idle';
  },
};
addEventListener('keydown', e => {
  if (!live || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!e.repeat) { keys.down.add(e.code); keys.presses.push({ code: e.code, at: live.m.tick }); }
});
addEventListener('keyup', e => keys.down.delete(e.code));
addEventListener('blur', () => keys.reset());

// for screenshots and tests: jump the replay to a frame, read what is loaded
window.__seek = i => { if (show) { seek(i); show.playing = false; } };
window.__info = () => (show ? { frames: show.frames.length, events: show.events, result: show.result } : null);
window.__sound = snd;

init();
