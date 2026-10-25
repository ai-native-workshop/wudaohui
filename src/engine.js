// engine.js: the fight itself, one tick at a time. Pure and deterministic: the same seed and the same two bots give the same fight,
// frame for frame, in Node (the tournament) and in the browser (the viewer, the playable Toy). The rules use only + - * / and
// comparisons (no Math.sin, no Date); the one random number source is the seeded generator, used by the beam clash.
//
//   const m = createMatch({ seed, rules, record, cadence }); while (!m.over) step(m, ask); const s = summary(m);
//   ask(side, view, m) -> an action name, see ACTIONS. It is called for a side only when that side may choose (RULES.decideEvery);
//   `view` is that side's picture of the fight (see view() below); the host decides how a bot gets it (the Node sandbox sends JSON).
//   m.frames (with record) holds one compact frame per tick for the replay and the renderer; m.events the notable moments.
import { RULES } from './rules.js';
import { mulberry32 } from './rng.js';

export const ACTIONS = ['idle', 'forward', 'back', 'guard', 'charge', 'light', 'heavy', 'blast', 'beam', 'dash_forward', 'dash_back', 'push'];
const ACT = new Set(ACTIONS);
const FREE = new Set(['idle', 'forward', 'back', 'guard', 'charge']);       // held states: a fighter in one of these can act
const MOVES = new Set(['light', 'heavy', 'blast', 'beam', 'dash']);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const r1 = x => Math.round(x * 10) / 10;

export function createMatch({ seed = 1, rules = RULES, record = false, cadence } = {}) {
  const R = rules, fighter = i => ({
    side: i, x: R.start[i], facing: i ? -1 : 1, hp: R.hp, ki: R.kiStart, state: 'idle', t: 0, dur: 0,
    hit: false, combo: 0, chain: 0, cancel: false, dash: null, kb: null, push: false, su: R.beam.startup, nextAsk: 0, every: cadence ? cadence[i] : R.decideEvery,
    st: { moves: {}, held: {}, hits: 0, blocked: 0, crushes: 0, dodges: 0, dealt: 0, minHp: R.hp, maxCombo: 0, invalid: 0, asks: 0 },
  });
  return { R, tick: 0, f: [fighter(0), fighter(1)], blasts: [], beams: [null, null], clash: null, rand: mulberry32(seed),
           events: [], frames: record ? [] : null, over: false, winner: null, reason: null, finisher: null, lead: 0, leadChanges: 0 };
}

export function phase(R, a) {
  const t = a.t;
  switch (a.state) {
    case 'light': case 'heavy': { const M = R[a.state]; return t < M.startup ? 'startup' : t < M.startup + M.active ? 'active' : 'recovery'; }
    case 'blast': return t < R.blast.startup ? 'startup' : 'recovery';
    case 'beam': return t < a.su ? 'startup' : t < a.su + R.beam.fire ? 'firing' : 'recovery';
    case 'dash': return t < R.dash.ticks ? 'moving' : 'recovery';
  }
  return null;
}
const surge = (R, a) => (a.hp < R.kiGain.rageHp * R.hp ? R.kiGain.rage : 1);   // near death, ki comes faster
const invuln = (R, a) => a.state === 'down' || a.state === 'ko' || (a.state === 'dash' && a.t < R.dash.invuln);

// what a side sees. Positions are absolute (x grows to the right); "forward" always means toward the opponent.
export function view(m, i) {
  const R = m.R, me = m.f[i], op = m.f[1 - i];
  const v = a => ({ x: r1(a.x), hp: Math.max(0, a.hp), ki: r1(a.ki), state: a.state, phase: phase(R, a), t: a.t, left: a.dur ? a.dur - a.t : 0,
    facing: a.facing, free: FREE.has(a.state), invulnerable: invuln(R, a), blastOut: m.blasts.some(b => b.owner === a.side), combo: a.combo });
  const k = m.clash, d0 = k && m.beams[0].dir;
  return {
    t: m.tick, timeLeft: R.maxTicks - m.tick,
    me: { ...v(me), canCancel: me.cancel, chain: me.chain }, opp: v(op),
    dist: r1(Math.abs(op.x - me.x)),
    wallAhead: r1(me.facing > 0 ? R.stage.right - me.x : me.x - R.stage.left), wallBehind: r1(me.facing > 0 ? me.x - R.stage.left : R.stage.right - me.x),
    blasts: m.blasts.map(b => {
      const gap = (me.x - b.x) * b.dir;                                   // > 0: the blast is still on its way to me
      return { mine: b.owner === i, x: r1(b.x), dir: b.dir, incoming: b.owner !== i && gap > 0, eta: b.owner !== i && gap > 0 ? Math.max(0, Math.ceil((gap - R.body) / R.blast.speed)) : null };
    }),
    beams: m.beams.filter(Boolean).map(b => ({ mine: b.owner === i, from: r1(b.from), front: r1(b.front), dir: b.dir })),
    clash: k ? { pos: r1(clamp(((k.c - me.x) * (i ? -d0 : d0)) / Math.abs(op.x - me.x), 0, 1) * 100) / 100, myPower: r1(power(m, me) * 100) / 100, oppPower: r1(power(m, op) * 100) / 100, t: k.t } : null,
  };
}

export function step(m, ask) {
  if (m.over) return;
  const R = m.R;
  // 1. both sides choose from the same moment
  const views = m.f.map((a, i) => (wants(m, a) ? view(m, i) : null));
  const acts = views.map((v, i) => (v ? ask(i, v, m) : null));
  acts.forEach((act, i) => views[i] && choose(m, m.f[i], act));
  // 2. bodies move, then turn to face each other
  for (const a of m.f) move(m, a);
  separate(m);
  for (const a of m.f) if (FREE.has(a.state)) face(a, m.f[1 - a.side]);
  // 3. what connects
  strikes(m);
  blasts(m);
  beams(m);
  if (m.clash) clashTick(m);
  // 4. time passes
  for (const a of m.f) {
    if (a.state === 'ko' || a.state === 'clash') continue;
    if (FREE.has(a.state)) a.st.held[a.state] = (a.st.held[a.state] || 0) + 1;
    a.t++;
    if (a.dur && a.t >= a.dur) free(m, a);
    const K = R.kiGain, g = K.passive + (a.state === 'charge' ? K.charge : a.state === 'forward' ? K.forward : a.state === 'back' ? K.back : a.state === 'guard' ? K.guard : 0);
    a.ki = clamp(a.ki + (g > 0 ? g * surge(R, a) : g), 0, R.kiMax);
  }
  if (m.frames) m.frames.push(frame(m));
  m.tick++;
  end(m);
}

const wants = (m, a) => !m.over && a.state !== 'ko' && (a.cancel || ((FREE.has(a.state) || a.state === 'clash') && m.tick >= a.nextAsk));

function choose(m, a, act) {
  const R = m.R;
  if (typeof act !== 'string' || !ACT.has(act)) { a.st.invalid++; act = 'idle'; }
  a.st.asks++; a.nextAsk = m.tick + a.every;
  if (a.state !== 'clash') face(a, m.f[1 - a.side]);                      // whoever chooses turns to the opponent first, even straight out of a move
  if (a.cancel) {                                         // the one extra choice right after a light punch lands
    a.cancel = false;
    if ((act === 'light' && a.chain < R.light.chain) || act === 'heavy' || act === 'blast' || act === 'beam') start(m, a, act, true);
    return;
  }
  if (a.state === 'clash') { a.push = act === 'push'; return; }
  if (act === 'push') act = 'idle';
  if (FREE.has(act)) { if (a.state !== act) { a.state = act; a.t = 0; } return; }
  start(m, a, act, false);
}

// start a move; one it cannot pay for (or a second blast while the first still flies) is ignored, and the fighter keeps doing what it did
function start(m, a, act, chained) {
  const R = m.R;
  const dash = act === 'dash_forward' || act === 'dash_back';
  const cost = act === 'blast' ? R.blast.cost : act === 'beam' ? R.beam.cost : dash ? R.dash.cost : 0;
  if (a.ki < cost || (act === 'blast' && m.blasts.some(b => b.owner === a.side))) { a.st.invalid++; return; }
  a.ki -= cost;
  a.st.moves[act] = (a.st.moves[act] || 0) + 1;
  const kind = dash ? 'dash' : act;
  a.state = kind; a.t = 0; a.hit = false; a.dodged = false; a.dash = null; a.push = false;
  a.chain = act === 'light' ? (chained ? a.chain + 1 : 1) : a.chain;
  if (kind === 'light' || kind === 'heavy') { const M = R[kind]; a.dur = M.startup + M.active + M.recovery; }
  else if (kind === 'blast') a.dur = R.blast.startup + R.blast.recovery;
  else if (kind === 'beam') {
    // an answer to a beam coming at me fires together with it (or counterStartup from now, if it already fires), so the two meet
    const o = m.f[1 - a.side], aimed = o.state === 'beam' && phase(R, o) !== 'recovery' && (a.x - o.x) * o.facing > 0;
    a.su = aimed ? Math.max(R.beam.counterStartup, phase(R, o) === 'startup' ? o.su - o.t : 0) : R.beam.startup;
    a.dur = a.su + R.beam.fire + R.beam.recovery;
  }
  else {
    a.dur = R.dash.ticks + R.dash.recovery;
    a.dash = { x0: a.x, x1: dashEnd(m, a, act === 'dash_forward' ? 1 : -1), dir: act === 'dash_forward' ? 1 : -1 };
  }
  ev(m, act, a.side);
}

// where a dash lands: `dist` along the facing (or against it), through the opponent if there is room for a body behind them
function dashEnd(m, a, sign) {
  const R = m.R, o = m.f[1 - a.side], d = a.facing * sign, L = R.stage.left, H = R.stage.right;
  let x = a.x + d * R.dash.dist;
  const before = (o.x - a.x) * d, after = (o.x - x) * d;                  // opponent ahead of me along d, before and after
  if (before > 0 && after < R.minGap) {                                    // I would end inside or beyond them
    const behind = o.x + d * Math.max(R.minGap, -after);
    if (after <= -R.minGap && behind >= L && behind <= H) x = behind;      // through, landing behind
    else if (o.x + d * R.minGap >= L && o.x + d * R.minGap <= H && after < 0) x = o.x + d * R.minGap;
    else x = o.x - d * R.minGap;                                           // no room behind: stop in front
  }
  return clamp(x, L, H);
}

function move(m, a) {
  const R = m.R;
  if (a.kb) { const s = Math.min(a.kb.left, 12); a.x += a.kb.dir * s; a.kb.left -= s; if (a.kb.left <= 0) a.kb = null; }
  if (a.state === 'forward') a.x += a.facing * R.walk.forward;
  else if (a.state === 'back') a.x -= a.facing * R.walk.back;
  else if (a.state === 'dash' && a.t < R.dash.ticks) a.x = a.dash.x0 + ((a.dash.x1 - a.dash.x0) * (a.t + 1)) / R.dash.ticks;
  a.x = clamp(a.x, R.stage.left, R.stage.right);
}

// bodies never overlap, except while one of them is dashing through
function separate(m) {
  const R = m.R, [a, b] = m.f;
  if ((a.state === 'dash' && a.t < R.dash.ticks) || (b.state === 'dash' && b.t < R.dash.ticks)) return;
  const dx = b.x - a.x, over = R.minGap - Math.abs(dx);
  if (over <= 0) return;
  const s = dx > 0 ? 1 : dx < 0 ? -1 : a.facing;                         // b lies on side s of a
  const roomA = s > 0 ? a.x - R.stage.left : R.stage.right - a.x, roomB = s > 0 ? R.stage.right - b.x : b.x - R.stage.left;
  let pa = over / 2, pb = over / 2;
  if (pa > roomA) { pb += pa - roomA; pa = roomA; }
  if (pb > roomB) { pa = Math.min(roomA, pa + pb - roomB); pb = roomB; }
  a.x -= s * pa; b.x += s * pb;
}

function face(a, o) { if (o.x !== a.x) a.facing = o.x > a.x ? 1 : -1; }

// push the one hit away from the attacker; against the wall the attacker slides back instead
function pushApart(m, a, o, dist) {
  const R = m.R, d = o.x > a.x ? 1 : o.x < a.x ? -1 : a.facing;
  const room = d > 0 ? R.stage.right - o.x : o.x - R.stage.left, s = Math.min(dist, room);
  o.x += d * s;
  if (s < dist) a.x = clamp(a.x - d * (dist - s), R.stage.left, R.stage.right);
}

function strikes(m) {
  const R = m.R, todo = [];
  for (const a of m.f) {
    if ((a.state !== 'light' && a.state !== 'heavy') || a.hit || phase(R, a) !== 'active') continue;
    const o = m.f[1 - a.side], d = (o.x - a.x) * a.facing;
    if (d > 0 && d <= R[a.state].reach) {
      if (invuln(R, o)) { if (o.state === 'dash' && !a.dodged) { a.dodged = true; dodge(m, o, a.state); } continue; }
      todo.push([a, o, a.state, mult(R, o)]);                              // decided before either lands, so a trade hurts both
    }
  }
  for (const [a, o, kind, x] of todo) { a.hit = true; land(m, a, o, kind, { dir: a.x > o.x ? 1 : -1, mult: x }); }
}

function blasts(m) {
  const R = m.R, B = R.blast;
  for (const a of m.f) if (a.state === 'blast' && a.t === B.startup) { m.blasts.push({ owner: a.side, x: a.x + a.facing * 40, px: a.x, dir: a.facing }); ev(m, 'blast_out', a.side); }
  for (const b of m.blasts) { b.px = b.x; b.x += b.dir * B.speed; }
  for (const b of m.blasts) for (const c of m.blasts)                     // two opposite blasts that cross cancel out
    if (b.owner === 0 && c.owner === 1 && !b.dead && !c.dead && b.dir !== c.dir && (b.px - c.px) * (b.x - c.x) <= 0) { b.dead = c.dead = true; ev(m, 'blast_clash', -1); }
  for (const b of m.blasts) for (const beam of m.beams)                   // a beam swallows the other side's blasts
    if (!b.dead && beam && beam.owner !== b.owner && inRay(beam, b.x, 8)) b.dead = true;
  for (const b of m.blasts) {
    if (b.dead) continue;
    const o = m.f[1 - b.owner];
    if (Math.abs(o.x - b.x) > R.body && (o.x - b.px) * (o.x - b.x) > 0) continue;
    if (invuln(R, o)) { if (o.state === 'dash' && !b.dodged) { b.dodged = true; dodge(m, o, 'blast'); } continue; }
    b.dead = true;
    land(m, m.f[b.owner], o, 'blast', { dir: -b.dir });
  }
  m.blasts = m.blasts.filter(b => !b.dead && b.x > R.stage.left - 60 && b.x < R.stage.right + 60);
}

function inRay(b, x, pad) { const lo = Math.min(b.from, b.front), hi = Math.max(b.from, b.front); return x + pad >= lo && x - pad <= hi; }

function beams(m) {
  const R = m.R, Bm = R.beam;
  if (m.clash) return;                                                     // a clash freezes both beams
  for (const a of m.f) {
    if (a.state === 'beam' && a.t === a.su) { m.beams[a.side] = { owner: a.side, dir: a.facing, from: a.x + a.facing * 25, front: a.x + a.facing * 40, hit: false }; ev(m, 'beam_out', a.side); }
    if (m.beams[a.side] && (a.state !== 'beam' || a.t >= a.su + Bm.fire)) m.beams[a.side] = null;   // over, or the shooter was hit
  }
  for (const b of m.beams) if (b) b.front = clamp(b.front + b.dir * Bm.speed, R.stage.left - 40, R.stage.right + 40);
  const [b0, b1] = m.beams;
  if (b0 && b1 && b0.dir === -b1.dir && (m.f[1].x - m.f[0].x) * b0.dir > 0 && (b0.front - b1.front) * b0.dir >= 0) {
    m.clash = { c: (b0.front + b1.front) / 2, v: 0, t: 0 };
    for (const a of m.f) { a.state = 'clash'; a.t = 0; a.dur = 0; a.push = false; a.nextAsk = m.tick + 1; }
    b0.front = b1.front = m.clash.c;
    ev(m, 'clash', -1);
    return;
  }
  for (const b of m.beams) {
    if (!b || b.hit) continue;
    const a = m.f[b.owner], o = m.f[1 - b.owner];
    if (!inRay(b, o.x, R.body)) continue;
    if (invuln(R, o)) { if (o.state === 'dash' && !b.dodged) { b.dodged = true; dodge(m, o, 'beam'); } continue; }
    b.hit = true;
    land(m, a, o, 'beam', { dir: -b.dir, stun: a.su + Bm.fire - a.t + 6 });
  }
}

const power = (m, f) => { const C = m.R.clash; return (f.ki > 0 ? C.base + C.kiPower * f.ki + (f.push ? C.pushPower : 0) : C.empty) + (f.hp < C.rageHp * m.R.hp ? C.rage : 0); };

function clashTick(m) {
  const R = m.R, C = R.clash, k = m.clash, [a, b] = m.f, d = m.beams[0].dir;   // beam 0 runs along d, from fighter 0 toward fighter 1
  const pa = power(m, a), pb = power(m, b);
  for (const f of m.f) f.ki = Math.max(0, f.ki - C.drain - (f.push && f.ki > 0 ? C.pushCost : 0));
  const shove = (m.rand() + m.rand() + m.rand() + m.rand() - 2) * 1.7320508 * C.noise;   // four uniforms: close to normal, sd = noise
  k.v = k.v * C.decay + d * ((pa - pb) * C.drift + shove);
  k.c += k.v; k.t++;
  m.beams[0].front = m.beams[1].front = k.c;
  const atB = (k.c - (b.x - d * R.body)) * d >= 0, atA = ((a.x + d * R.body) - k.c) * d >= 0;
  if (atA || atB || k.t >= C.maxTicks) endClash(m, atB ? 0 : atA ? 1 : -1);
}

function endClash(m, w) {
  const R = m.R, C = R.clash, ticks = m.clash.t;
  m.clash = null; m.beams = [null, null];
  if (w < 0) {                                                             // nobody gave way: the beams blow up between them
    for (const f of m.f) { hurt(m, m.f[1 - f.side], f, C.draw, 'clash'); knock(m, f, m.f[1 - f.side], C.down, 100); }
    ev(m, 'clash_draw', -1, { ticks });
    return;
  }
  const W = m.f[w], L = m.f[1 - w];
  W.state = 'recover'; W.t = 0; W.dur = R.beam.recovery;
  hurt(m, W, L, C.damage, 'clash'); L.st.minHp = Math.min(L.st.minHp, L.hp);
  knock(m, L, W, C.down, R.beam.knockback);
  W.st.hits++;
  ev(m, 'clash_win', w, { ticks });
}

// damage multiplier against `o` right now: caught charging, or caught in the startup or recovery of a move
function mult(R, o) {
  if (o.state === 'charge') return R.chargeHit;
  const p = phase(R, o);
  return MOVES.has(o.state) && (p === 'startup' || p === 'recovery') ? R.counter : 1;
}

// a strike, blast or beam reaches `o`. ctx.dir: the side the hit comes from, seen from o (+1 = from its right)
function land(m, a, o, kind, ctx) {
  const R = m.R, M = R[kind];
  if (o.state === 'guard' && ctx.dir * o.facing > 0) {                     // a guard covers the front only
    if (kind === 'heavy') {
      hurt(m, a, o, M.crushDamage, 'crush');
      stun(o, 'crushed', M.crush); a.st.crushes++;
      ev(m, 'crush', a.side);
      return;
    }
    const pay = R.guardKi[kind];
    if (o.ki < pay) {                                                      // no ki left to hold the guard: it gives way
      o.ki = 0;
      if (M.chip) hurt(m, a, o, M.chip, kind);
      stun(o, 'crushed', R.heavy.crush); a.st.crushes++;
      ev(m, 'crush', a.side, { by: 'ki' });
      return;
    }
    o.ki -= pay; a.ki = Math.min(R.kiMax, a.ki + R.guardKi.pressure * surge(R, a));
    if (M.chip) hurt(m, a, o, M.chip, kind);
    stun(o, 'blockstun', kind === 'beam' ? ctx.stun : M.blockstun);
    o.st.blocked++;
    if (kind === 'light') pushApart(m, a, o, M.push);
    ev(m, 'block', o.side, { kind });
    return;
  }
  const x = ctx.mult ?? mult(R, o), scale = R.combo[Math.min(o.combo, R.combo.length - 1)];
  const dmg = Math.max(1, Math.round(M.damage * x * scale));
  hurt(m, a, o, dmg, kind);
  o.combo++; a.st.hits++; a.st.maxCombo = Math.max(a.st.maxCombo, o.combo);
  ev(m, 'hit', a.side, { kind, dmg, combo: o.combo, counter: x > 1 });
  if (kind === 'light') { stun(o, 'hitstun', M.hitstun); pushApart(m, a, o, M.push); if (a.state === 'light') { a.cancel = true; } }
  else if (kind === 'blast') stun(o, 'hitstun', M.hitstun);
  else knock(m, o, a, M.down, M.knockback);
}

function hurt(m, a, o, dmg, kind) {
  const R = m.R;
  o.hp = Math.max(-999, o.hp - dmg); o.st.minHp = Math.min(o.st.minHp, Math.max(0, o.hp));
  a.st.dealt += dmg;
  o.ki = Math.min(R.kiMax, o.ki + R.kiGain.taken * dmg * surge(R, o)); a.ki = Math.min(R.kiMax, a.ki + R.kiGain.dealt * dmg * surge(R, a));
  m.finisher = kind;
  const lead = Math.sign(m.f[0].hp - m.f[1].hp);
  if (lead && m.lead && lead !== m.lead) m.leadChanges++;
  if (lead) m.lead = lead;
}

function stun(o, state, dur) {
  o.state = state; o.t = 0; o.dur = dur; o.hit = false; o.cancel = false; o.dash = null; o.push = false;
}

// knocked down: thrown back, untouchable on the floor for `down` ticks
function knock(m, o, from, down, dist) {
  stun(o, 'down', down);
  const d = o.x > from.x ? 1 : o.x < from.x ? -1 : -o.facing;
  o.kb = { dir: d, left: dist };
}

function dodge(m, o, what) { o.st.dodges++; ev(m, 'dodge', o.side, { what }); }

function free(m, a) {
  a.state = 'idle'; a.t = 0; a.dur = 0; a.dash = null; a.hit = false; a.cancel = false; a.chain = 0; a.combo = 0;
  a.nextAsk = m.tick + 1;                                                  // asked again at once
}

function ev(m, type, side, data) { m.events.push(data ? { t: m.tick, type, side, ...data } : { t: m.tick, type, side }); }

function end(m) {
  const R = m.R, [a, b] = m.f, ka = a.hp <= 0, kb = b.hp <= 0;
  if (ka || kb) {
    m.over = true; m.reason = ka && kb ? 'double_ko' : 'ko'; m.winner = ka && kb ? null : ka ? 1 : 0;
    for (const f of m.f) if (f.hp <= 0) { f.state = 'ko'; f.t = 0; f.dur = 0; }
    if (m.frames) m.frames[m.frames.length - 1] = frame(m);              // the last recorded frame shows who is down
    ev(m, 'ko', m.winner ?? -1);
  } else if (m.tick >= R.maxTicks) {
    m.over = true; m.reason = 'time'; m.winner = a.hp === b.hp ? null : a.hp > b.hp ? 0 : 1;
    ev(m, 'time', m.winner ?? -1);
  }
}

// a forfeit from outside the rules (a bot crashed its sandbox, or ran out of thinking time)
export function forfeit(m, side, why) {
  m.over = true; m.reason = why || 'forfeit'; m.winner = 1 - side;
  ev(m, 'forfeit', side, { why: m.reason });
}

function frame(m) {
  const R = m.R;
  return {
    f: m.f.map(a => [r1(a.x), a.state, a.t, a.facing, a.hp, r1(a.ki), phase(R, a), a.combo]),
    b: m.blasts.map(b => [b.owner, r1(b.x), b.dir]),
    m: m.beams.map(b => b && [r1(b.from), r1(b.front), b.dir]),
    c: m.clash && [r1(m.clash.c), m.clash.t, ...m.f.map(f => r1(power(m, f) * 100) / 100), ...m.f.map(f => f.push ? 1 : 0)],
  };
}

// the match in numbers: who won and how, plus what makes it worth replaying (see highlight)
export function summary(m) {
  const R = m.R, n = t => m.events.filter(e => e.type === t).length;
  const s = {
    winner: m.winner, reason: m.reason, ticks: m.tick, hp: m.f.map(f => Math.max(0, f.hp)), finisher: m.reason === 'time' ? 'time' : m.finisher,
    leadChanges: m.leadChanges, clashes: n('clash'), beams: n('beam_out'),
    side: m.f.map(f => ({ ...f.st, moves: { ...f.st.moves }, held: { ...f.st.held } })),
  };
  s.highlight = highlight(R, s);
  return s;
}

// how much a match is worth animating: a comeback, a clash (more so if it decided the match), long combos, the lead changing hands, a close finish
export function highlight(R, s) {
  const w = s.winner;
  const comeback = w == null ? 0 : 1 - s.side[w].minHp / R.hp;
  const close = w == null ? 1 : 1 - (s.hp[w] - s.hp[1 - w]) / R.hp;
  const combo = Math.max(s.side[0].maxCombo, s.side[1].maxCombo);
  return Math.round(10 * (4 * comeback ** 2 + 1.5 * Math.min(2, s.clashes) + (s.finisher === 'clash' ? 2 : s.finisher === 'beam' ? 1 : 0)
    + 0.25 * Math.max(0, combo - 2) + 0.6 * Math.min(4, s.leadChanges) + 1.5 * close ** 3)) / 10;
}
