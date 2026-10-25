```js
// AI 武道会 · 选手程序
// 架构：精确引擎物理仿真 (Rollout Simulator) + 帧数确定性确反/连段 + 在线对手行为建模

const FREE_SET = new Set(['idle', 'forward', 'back', 'guard', 'charge']);
const MOVE_SET = new Set(['light', 'heavy', 'blast', 'beam', 'dash']);

// 局内记忆与对手画像（每局顶层重新加载自动清零）
let lastTick = -1;
let myExactKi = 30;
let oppExactKi = 30;
let mePrevX = null;
let oppPrevX = null;
let mePrevState = 'idle';
let oppPrevState = 'idle';
let oppPrevFree = true;
let meDashInfo = null;
let oppDashInfo = null;
let prevClashPos = null;
let prevClashTick = -1;

// 距离分桶统计对手在自由状态下的出招偏好: 0:[0,115], 1:(115,165], 2:(165,280], 3:(280,999]
const oppBuckets = [
  { idle: 1, forward: 2, back: 1.5, guard: 3, charge: 0.2, light: 4, heavy: 2.5, blast: 0.5, beam: 0.3, dash_forward: 1, dash_back: 1 },
  { idle: 1, forward: 2.5, back: 2, guard: 2.5, charge: 0.5, light: 1.5, heavy: 3.5, blast: 1.5, beam: 0.6, dash_forward: 1.5, dash_back: 1 },
  { idle: 1, forward: 3, back: 1.5, guard: 2, charge: 2.5, light: 0.2, heavy: 0.5, blast: 3, beam: 1.5, dash_forward: 2.5, dash_back: 0.8 },
  { idle: 1, forward: 3, back: 1, guard: 1.5, charge: 4, light: 0.1, heavy: 0.1, blast: 3.5, beam: 2, dash_forward: 2, dash_back: 0.3 }
];

// 特殊情境统计：对手起身动作、对手防住轻拳后的动作
const oppWakeupStats = { guard: 3, light: 2.5, heavy: 1.5, back: 1.5, dash_forward: 1, dash_back: 1, beam: 0.5, idle: 1 };
const oppAfterBlockStats = { guard: 3, light: 3, heavy: 1.5, back: 2, dash_back: 1, dash_forward: 0.8, idle: 1 };
let wasWakeupWindow = false;
let wasBlockWindow = false;

function clamp(x, a, b) {
  return x < a ? a : x > b ? b : x;
}

function getBucketIdx(dist) {
  if (dist <= 115) return 0;
  if (dist <= 165) return 1;
  if (dist <= 280) return 2;
  return 3;
}

function simPhase(a) {
  const t = a.t;
  switch (a.state) {
    case 'light': return t < 5 ? 'startup' : t < 8 ? 'active' : 'recovery';
    case 'heavy': return t < 9 ? 'startup' : t < 13 ? 'active' : 'recovery';
    case 'blast': return t < 11 ? 'startup' : 'recovery';
    case 'beam': return t < a.su ? 'startup' : t < a.su + 40 ? 'firing' : 'recovery';
    case 'dash': return t < 10 ? 'moving' : 'recovery';
  }
  return null;
}

function simSurge(a) {
  return a.hp < 450 ? 1.5 : 1;
}

function simInvuln(a) {
  return a.state === 'down' || a.state === 'ko' || (a.state === 'dash' && a.t < 8);
}

function simMult(o) {
  if (o.state === 'charge') return 1.5;
  const p = simPhase(o);
  return MOVE_SET.has(o.state) && (p === 'startup' || p === 'recovery') ? 1.25 : 1;
}

function simDashEnd(a, o, sign) {
  const d = a.facing * sign, L = 40, H = 960;
  let x = a.x + d * 200;
  const before = (o.x - a.x) * d, after = (o.x - x) * d;
  if (before > 0 && after < 60) {
    const behind = o.x + d * Math.max(60, -after);
    if (after <= -60 && behind >= L && behind <= H) x = behind;
    else if (o.x + d * 60 >= L && o.x + d * 60 <= H && after < 0) x = o.x + d * 60;
    else x = o.x - d * 60;
  }
  return clamp(x, L, H);
}

// 计算从当前位置起始的一套轻拳连段 + 重击收尾的确定性总伤害
function calcRemainingComboDmg(attacker, defender, currentDist, startCombo, startChain) {
  const scaleArr = RULES.combo;
  let d = currentDist;
  let c = startCombo;
  let ch = startChain;
  let total = 0;
  while (d <= 109.9 && ch < 4) {
    const sc = scaleArr[Math.min(c, scaleArr.length - 1)];
    total += Math.max(1, Math.round(40 * sc));
    c++;
    ch++;
    d += 14;
  }
  if (d <= 140) {
    const sc = scaleArr[Math.min(c, scaleArr.length - 1)];
    total += Math.max(1, Math.round(120 * sc));
  }
  return total;
}

// 更新局内精确状态与对手统计
function updateMemory(state) {
  if (lastTick < 0 || state.t <= lastTick) {
    myExactKi = state.me.ki;
    oppExactKi = state.opp.ki;
    mePrevX = state.me.x;
    oppPrevX = state.opp.x;
    mePrevState = state.me.state;
    oppPrevState = state.opp.state;
    oppPrevFree = state.opp.free;
    meDashInfo = null;
    oppDashInfo = null;
    prevClashPos = null;
    prevClashTick = -1;
    wasWakeupWindow = false;
    wasBlockWindow = false;
  }

  // 校准精确气量（防止 view 中 r1 四舍五入导致 13.96 显示为 14.0 而出招失败）
  if (Math.abs(myExactKi - state.me.ki) > 0.06) {
    myExactKi = state.me.ki - 0.04;
  }
  if (Math.abs(oppExactKi - state.opp.ki) > 0.06) {
    oppExactKi = state.opp.ki - 0.04;
  }

  // 追踪瞬移起止点
  if (state.me.state !== 'dash') {
    meDashInfo = null;
  } else if (!meDashInfo && mePrevX !== null) {
    const oDummy = { x: oppPrevX ?? state.opp.x };
    const aDummy = { x: mePrevX, facing: state.me.facing };
    const endFwd = simDashEnd(aDummy, oDummy, 1);
    const endBack = simDashEnd(aDummy, oDummy, -1);
    const step = Math.max(1, state.me.t);
    const predFwd = mePrevX + ((endFwd - mePrevX) * step) / 10;
    const predBack = mePrevX + ((endBack - mePrevX) * step) / 10;
    const isFwd = Math.abs(state.me.x - predFwd) <= Math.abs(state.me.x - predBack);
    meDashInfo = { x0: mePrevX, x1: isFwd ? endFwd : endBack, dir: isFwd ? 1 : -1 };
  }

  if (state.opp.state !== 'dash') {
    oppDashInfo = null;
  } else if (!oppDashInfo && oppPrevX !== null) {
    const oDummy = { x: mePrevX ?? state.me.x };
    const aDummy = { x: oppPrevX, facing: state.opp.facing };
    const endFwd = simDashEnd(aDummy, oDummy, 1);
    const endBack = simDashEnd(aDummy, oDummy, -1);
    const step = Math.max(1, state.opp.t);
    const predFwd = oppPrevX + ((endFwd - oppPrevX) * step) / 10;
    const predBack = oppPrevX + ((endBack - oppPrevX) * step) / 10;
    const isFwd = Math.abs(state.opp.x - predFwd) <= Math.abs(state.opp.x - predBack);
    oppDashInfo = { x0: oppPrevX, x1: isFwd ? endFwd : endBack, dir: isFwd ? 1 : -1 };
  }

  // 记录对手在当前距离分桶的选择
  const bIdx = getBucketIdx(state.dist);
  const bucket = oppBuckets[bIdx];
  let observedAct = null;
  if (state.opp.free) {
    observedAct = state.opp.state;
  } else if (MOVE_SET.has(state.opp.state) && (state.opp.t <= 6 || state.opp.state !== oppPrevState)) {
    if (state.opp.state === 'dash') {
      observedAct = oppDashInfo && oppDashInfo.dir < 0 ? 'dash_back' : 'dash_forward';
    } else {
      observedAct = state.opp.state;
    }
  }

  if (observedAct && (oppPrevFree || wasWakeupWindow || wasBlockWindow)) {
    for (const k in bucket) bucket[k] *= 0.96;
    bucket[observedAct] = (bucket[observedAct] || 0.5) + 1.2;

    if (wasWakeupWindow && oppWakeupStats[observedAct] !== undefined) {
      for (const k in oppWakeupStats) oppWakeupStats[k] *= 0.94;
      oppWakeupStats[observedAct] += 1.5;
      wasWakeupWindow = false;
    }
    if (wasBlockWindow && oppAfterBlockStats[observedAct] !== undefined) {
      for (const k in oppAfterBlockStats) oppAfterBlockStats[k] *= 0.94;
      oppAfterBlockStats[observedAct] += 1.5;
      wasBlockWindow = false;
    }
  }

  if (state.opp.state === 'down' && state.opp.left <= 8) wasWakeupWindow = true;
  else if (state.opp.state !== 'down') wasWakeupWindow = false;

  if (state.opp.state === 'blockstun' && state.opp.left <= 8) wasBlockWindow = true;
  else if (state.opp.state !== 'blockstun') wasBlockWindow = false;

  if (state.me.state !== 'dash') mePrevX = state.me.x;
  if (state.opp.state !== 'dash') oppPrevX = state.opp.x;
  mePrevState = state.me.state;
  oppPrevState = state.opp.state;
  oppPrevFree = state.opp.free;
  lastTick = state.t;
}

// 检查我方是否真的够气出招（规避 r1 四舍五入误差）
function canAfford(stateKi, exactKi, cost) {
  if (stateKi > cost + 0.05) return true;
  if (stateKi < cost) return false;
  return exactKi >= cost - 1e-6;
}

// 从 view 重建仿真状态
function createSimFromView(state) {
  function makeFighter(v, side, dashMemo, exactKi) {
    const dur = v.left > 0 ? v.t + v.left : 0;
    const su = v.state === 'beam' ? Math.max(12, dur - 60) : 30;
    let dash = null;
    if (v.state === 'dash') {
      if (dashMemo) {
        dash = { x0: dashMemo.x0, x1: dashMemo.x1, dir: dashMemo.dir };
      } else {
        const rem = Math.max(0, 10 - v.t);
        dash = { x0: v.x, x1: clamp(v.x + v.facing * rem * 20, 40, 960), dir: 1 };
      }
    }
    let kb = null;
    if (v.state === 'down') {
      const initKb = v.t + v.left >= 48 ? 120 : 150;
      const remKb = Math.max(0, initKb - v.t * 12);
      if (remKb > 0) {
        const otherX = side === 0 ? state.opp.x : state.me.x;
        const dir = v.x > otherX ? 1 : v.x < otherX ? -1 : -v.facing;
        kb = { dir, left: remKb };
      }
    }
    const otherV = side === 0 ? state.opp : state.me;
    const alreadyHit = (v.state === 'light' || v.state === 'heavy') &&
      v.phase === 'active' &&
      (otherV.state === 'hitstun' || otherV.state === 'blockstun' || otherV.state === 'crushed' || otherV.state === 'down') &&
      otherV.t <= 4;

    return {
      side,
      x: v.x,
      facing: v.facing,
      hp: v.hp,
      ki: Math.min(v.ki, Math.max(v.ki - 0.05, exactKi)),
      state: v.state,
      t: v.t,
      dur,
      su,
      hit: alreadyHit,
      combo: v.combo || 0,
      chain: v.chain || (v.state === 'light' ? 1 : 0),
      cancel: !!v.canCancel,
      dash,
      kb,
      push: false,
      nextAsk: v.free ? 0 : v.left
    };
  }

  const f0 = makeFighter(state.me, 0, meDashInfo, myExactKi);
  const f1 = makeFighter(state.opp, 1, oppDashInfo, oppExactKi);

  const blasts = state.blasts.map(b => ({
    owner: b.mine ? 0 : 1,
    x: b.x,
    px: b.x,
    dir: b.dir,
    dead: false
  }));

  const beams = [null, null];
  for (const b of state.beams) {
    const owner = b.mine ? 0 : 1;
    const target = owner === 0 ? f1 : f0;
    const hitAlready = target.state === 'down' || target.state === 'blockstun' || target.state === 'crushed';
    beams[owner] = { owner, from: b.from, front: b.front, dir: b.dir, hit: hitAlready };
  }

  return { tick: 0, realTick: state.t, f: [f0, f1], blasts, beams, clash: false };
}

function cloneSim(m) {
  const copyF = a => ({
    side: a.side, x: a.x, facing: a.facing, hp: a.hp, ki: a.ki,
    state: a.state, t: a.t, dur: a.dur, su: a.su, hit: a.hit,
    combo: a.combo, chain: a.chain, cancel: a.cancel,
    dash: a.dash ? { x0: a.dash.x0, x1: a.dash.x1, dir: a.dash.dir } : null,
    kb: a.kb ? { dir: a.kb.dir, left: a.kb.left } : null,
    push: a.push, nextAsk: a.nextAsk
  });
  return {
    tick: m.tick,
    realTick: m.realTick,
    f: [copyF(m.f[0]), copyF(m.f[1])],
    blasts: m.blasts.map(b => ({ owner: b.owner, x: b.x, px: b.px, dir: b.dir, dead: b.dead })),
    beams: [
      m.beams[0] ? { ...m.beams[0] } : null,
      m.beams[1] ? { ...m.beams[1] } : null
    ],
    clash: m.clash
  };
}

function simChoose(m, a, o, act) {
  a.nextAsk = m.tick + 6;
  if (a.state !== 'clash' && o.x !== a.x) {
    a.facing = o.x > a.x ? 1 : -1;
  }
  if (a.cancel) {
    a.cancel = false;
    if ((act === 'light' && a.chain < 4) || act === 'heavy' || act === 'blast' || act === 'beam') {
      simStart(m, a, o, act, true);
    }
    return;
  }
  if (FREE_SET.has(act)) {
    if (a.state !== act) { a.state = act; a.t = 0; }
    return;
  }
  simStart(m, a, o, act, false);
}

function simStart(m, a, o, act, chained) {
  const dash = act === 'dash_forward' || act === 'dash_back';
  const cost = act === 'blast' ? 14 : act === 'beam' ? 50 : dash ? 16 : 0;
  if (a.ki < cost || (act === 'blast' && m.blasts.some(b => b.owner === a.side))) return;
  a.ki -= cost;
  const kind = dash ? 'dash' : act;
  a.state = kind; a.t = 0; a.hit = false; a.dash = null; a.push = false;
  a.chain = act === 'light' ? (chained ? a.chain + 1 : 1) : a.chain;
  if (kind === 'light') a.dur = 17;
  else if (kind === 'heavy') a.dur = 35;
  else if (kind === 'blast') a.dur = 29;
  else if (kind === 'beam') {
    const oPhase = simPhase(o);
    const aimed = o.state === 'beam' && oPhase !== 'recovery' && (a.x - o.x) * o.facing > 0;
    a.su = aimed ? Math.max(12, oPhase === 'startup' ? o.su - o.t : 0) : 30;
    a.dur = a.su + 60;
  } else {
    a.dur = 18;
    const sign = act === 'dash_forward' ? 1 : -1;
    a.dash = { x0: a.x, x1: simDashEnd(a, o, sign), dir: sign };
  }
}

function simPushApart(a, o, dist) {
  const d = o.x > a.x ? 1 : o.x < a.x ? -1 : a.facing;
  const room = d > 0 ? 960 - o.x : o.x - 40;
  const s = Math.min(dist, room);
  o.x += d * s;
  if (s < dist) a.x = clamp(a.x - d * (dist - s), 40, 960);
}

function simHurt(a, o, dmg) {
  o.hp -= dmg;
  o.ki = Math.min(100, o.ki + 0.08 * dmg * simSurge(o));
  a.ki = Math.min(100, a.ki + 0.02 * dmg * simSurge(a));
}

function simStun(o, state, dur) {
  o.state = state; o.t = 0; o.dur = dur; o.hit = false; o.cancel = false; o.dash = null; o.push = false;
}

function simKnock(o, from, down, dist) {
  simStun(o, 'down', down);
  const d = o.x > from.x ? 1 : o.x < from.x ? -1 : -o.facing;
  o.kb = { dir: d, left: dist };
}

function simLand(m, a, o, kind, dir, multOverride, beamStun) {
  const M = RULES[kind];
  if (o.state === 'guard' && dir * o.facing > 0) {
    if (kind === 'heavy') {
      simHurt(a, o, 60);
      simStun(o, 'crushed', 34);
      return;
    }
    const pay = RULES.guardKi[kind];
    if (o.ki < pay) {
      o.ki = 0;
      if (M.chip) simHurt(a, o, M.chip);
      simStun(o, 'crushed', 34);
      return;
    }
    o.ki -= pay;
    a.ki = Math.min(100, a.ki + 3 * simSurge(a));
    if (M.chip) simHurt(a, o, M.chip);
    simStun(o, 'blockstun', kind === 'beam' ? beamStun : M.blockstun);
    if (kind === 'light') simPushApart(a, o, 14);
    return;
  }
  const x = multOverride !== undefined ? multOverride : simMult(o);
  const scale = RULES.combo[Math.min(o.combo, 5)];
  const dmg = Math.max(1, Math.round(M.damage * x * scale));
  simHurt(a, o, dmg);
  o.combo++;
  if (kind === 'light') {
    simStun(o, 'hitstun', 15);
    simPushApart(a, o, 14);
    if (a.state === 'light') a.cancel = true;
  } else if (kind === 'blast') {
    simStun(o, 'hitstun', 20);
  } else {
    simKnock(o, a, M.down, M.knockback);
  }
}

// 推进 1 tick 的精确物理模拟
function simStep(m, act0, act1) {
  const [a, b] = m.f;
  if (act0) simChoose(m, a, b, act0);
  if (act1) simChoose(m, b, a, act1);

  // 2. 移动与分离
  for (let i = 0; i < 2; i++) {
    const f = m.f[i];
    if (f.kb) {
      const s = Math.min(f.kb.left, 12);
      f.x += f.kb.dir * s;
      f.kb.left -= s;
      if (f.kb.left <= 0) f.kb = null;
    }
    if (f.state === 'forward') f.x += f.facing * 4.5;
    else if (f.state === 'back') f.x -= f.facing * 3;
    else if (f.state === 'dash' && f.t < 10 && f.dash) {
      f.x = f.dash.x0 + ((f.dash.x1 - f.dash.x0) * (f.t + 1)) / 10;
    }
    f.x = clamp(f.x, 40, 960);
  }

  if (!((a.state === 'dash' && a.t < 10) || (b.state === 'dash' && b.t < 10))) {
    const dx = b.x - a.x, over = 60 - Math.abs(dx);
    if (over > 0) {
      const s = dx > 0 ? 1 : dx < 0 ? -1 : a.facing;
      const roomA = s > 0 ? a.x - 40 : 960 - a.x;
      const roomB = s > 0 ? 960 - b.x : b.x - 40;
      let pa = over / 2, pb = over / 2;
      if (pa > roomA) { pb += pa - roomA; pa = roomA; }
      if (pb > roomB) { pa = Math.min(roomA, pa + pb - roomB); pb = roomB; }
      a.x -= s * pa;
      b.x += s * pb;
    }
  }

  if (FREE_SET.has(a.state) && b.x !== a.x) a.facing = b.x > a.x ? 1 : -1;
  if (FREE_SET.has(b.state) && a.x !== b.x) b.facing = a.x > b.x ? 1 : -1;

  // 3. 判定：拳脚、气功波、大招
  let hitA = false, hitB = false, multA = 1, multB = 1;
  if ((a.state === 'light' || a.state === 'heavy') && !a.hit && simPhase(a) === 'active') {
    const d = (b.x - a.x) * a.facing;
    if (d > 0 && d <= RULES[a.state].reach && !simInvuln(b)) {
      hitA = true; multA = simMult(b);
    }
  }
  if ((b.state === 'light' || b.state === 'heavy') && !b.hit && simPhase(b) === 'active') {
    const d = (a.x - b.x) * b.facing;
    if (d > 0 && d <= RULES[b.state].reach && !simInvuln(a)) {
      hitB = true; multB = simMult(a);
    }
  }
  if (hitA) { a.hit = true; simLand(m, a, b, a.state, a.x > b.x ? 1 : -1, multA, 0); }
  if (hitB) { b.hit = true; simLand(m, b, a, b.state, b.x > a.x ? 1 : -1, multB, 0); }

  // 气功波
  for (let i = 0; i < 2; i++) {
    const f = m.f[i];
    if (f.state === 'blast' && f.t === 11) {
      m.blasts.push({ owner: f.side, x: f.x + f.facing * 40, px: f.x, dir: f.facing, dead: false });
    }
  }
  for (let i = 0; i < m.blasts.length; i++) {
    const bl = m.blasts[i];
    bl.px = bl.x;
    bl.x += bl.dir * 13;
  }
  if (m.blasts.length >= 2) {
    for (let i = 0; i < m.blasts.length; i++) {
      for (let j = i + 1; j < m.blasts.length; j++) {
        const b1 = m.blasts[i], b2 = m.blasts[j];
        if (b1.owner !== b2.owner && !b1.dead && !b2.dead && b1.dir !== b2.dir && (b1.px - b2.px) * (b1.x - b2.x) <= 0) {
          b1.dead = b2.dead = true;
        }
      }
    }
  }
  for (let i = 0; i < m.blasts.length; i++) {
    const bl = m.blasts[i];
    if (bl.dead) continue;
    const oppBeam = m.beams[1 - bl.owner];
    if (oppBeam) {
      const lo = Math.min(oppBeam.from, oppBeam.front), hi = Math.max(oppBeam.from, oppBeam.front);
      if (bl.x + 8 >= lo && bl.x - 8 <= hi) { bl.dead = true; continue; }
    }
    const o = m.f[1 - bl.owner];
    if (Math.abs(o.x - bl.x) > 30 && (o.x - bl.px) * (o.x - bl.x) > 0) continue;
    if (simInvuln(o)) continue;
    bl.dead = true;
    simLand(m, m.f[bl.owner], o, 'blast', -bl.dir, undefined, 0);
  }
  m.blasts = m.blasts.filter(bl => !bl.dead && bl.x > -20 && bl.x < 1020);

  // 大招
  if (!m.clash) {
    for (let i = 0; i < 2; i++) {
      const f = m.f[i];
      if (f.state === 'beam' && f.t === f.su) {
        m.beams[i] = { owner: i, dir: f.facing, from: f.x + f.facing * 25, front: f.x + f.facing * 40, hit: false };
      }
      if (m.beams[i] && (f.state !== 'beam' || f.t >= f.su + 40)) {
        m.beams[i] = null;
      }
    }
    for (let i = 0; i < 2; i++) {
      if (m.beams[i]) m.beams[i].front = clamp(m.beams[i].front + m.beams[i].dir * 30, 0, 1000);
    }
    const b0 = m.beams[0], b1 = m.beams[1];
    if (b0 && b1 && b0.dir === -b1.dir && (b.x - a.x) * b0.dir > 0 && (b0.front - b1.front) * b0.dir >= 0) {
      m.clash = true;
      a.state = b.state = 'clash';
      return;
    }
    for (let i = 0; i < 2; i++) {
      const bm = m.beams[i];
      if (!bm || bm.hit) continue;
      const shooter = m.f[i], target = m.f[1 - i];
      const lo = Math.min(bm.from, bm.front), hi = Math.max(bm.from, bm.front);
      if (target.x + 30 < lo || target.x - 30 > hi) continue;
      if (simInvuln(target)) continue;
      bm.hit = true;
      simLand(m, shooter, target, 'beam', -bm.dir, undefined, shooter.su + 40 - shooter.t + 6);
    }
  }

  // 4. 时间流逝与回气
  for (let i = 0; i < 2; i++) {
    const f = m.f[i];
    if (f.state === 'ko' || f.state === 'clash') continue;
    f.t++;
    if (f.dur && f.t >= f.dur) {
      f.state = 'idle'; f.t = 0; f.dur = 0; f.dash = null; f.hit = false;
      f.cancel = false; f.chain = 0; f.combo = 0;
      f.nextAsk = m.tick + 1;
    }
    const g = 0.04 + (f.state === 'charge' ? 0.32 : f.state === 'forward' ? 0.04 : f.state === 'back' ? -0.04 : f.state === 'guard' ? -0.03 : 0);
    f.ki = clamp(f.ki + (g > 0 ? g * simSurge(f) : g), 0, 100);
  }
  m.tick++;
  m.realTick++;
}

// 仿真中的连段取消策略
function simBestCancel(a, o) {
  const dist = Math.abs(o.x - a.x);
  const sc = RULES.combo[Math.min(o.combo, 5)];
  const heavyDmg = Math.max(1, Math.round(120 * sc));
  if (dist <= 140 && o.hp <= heavyDmg) return 'heavy';
  if (dist <= 109.9 && a.chain < 4) return 'light';
  return 'heavy';
}

// 仿真中后续第 6+ tick 的快速反应策略
function simFollowupPolicy(m, side) {
  const me = m.f[side], opp = m.f[1 - side];
  const dist = Math.abs(opp.x - me.x);
  const oppLeft = FREE_SET.has(opp.state) ? 0 : opp.dur - opp.t;

  // 1. 应对敌方正在发射或即将发射的大招
  const oppBeam = m.beams[1 - side];
  const oppBeamAimed = opp.state === 'beam' && simPhase(opp) !== 'recovery' && (me.x - opp.x) * opp.facing > 0;
  if (oppBeam || oppBeamAimed) {
    const ticksToFire = oppBeam ? 0 : Math.max(0, opp.su - opp.t);
    const beamEta = ticksToFire + Math.max(0, Math.ceil((dist - 100) / 30));
    if (dist <= 110 && ticksToFire > 5) return 'light';
    if (dist <= 140 && ticksToFire > 9) return 'heavy';
    const roomBehindOpp = opp.facing > 0 ? opp.x - 40 : 960 - opp.x;
    if (dist < 200 && roomBehindOpp >= 60 && me.ki >= 16) return 'dash_forward';
    if (beamEta <= 7) return 'guard';
  }

  // 2. 应对即将命中的气功波
  for (let i = 0; i < m.blasts.length; i++) {
    const bl = m.blasts[i];
    if (bl.owner !== side) {
      const gap = (me.x - bl.x) * bl.dir;
      if (gap > 0) {
        const eta = Math.max(0, Math.ceil((gap - 30) / 13));
        if (eta <= 6) return 'guard';
      }
    }
  }

  // 3. 敌方处于硬直/收招时确反
  const oppHelpless = (!FREE_SET.has(opp.state) && opp.state !== 'down') &&
    (simPhase(opp) === 'recovery' || opp.state === 'crushed' || opp.state === 'hitstun' || opp.state === 'blockstun' ||
     ((opp.state === 'beam' || opp.state === 'light' || opp.state === 'heavy') && (me.x - opp.x) * opp.facing < 0));

  if (oppHelpless) {
    if (dist <= 109.9 && oppLeft >= 6) return 'light';
    if (dist <= 140 && oppLeft >= 10) return 'heavy';
    if (dist <= 167 && oppLeft >= 16) return 'forward';
  }

  // 4. 敌方近身出招起手/判定时防守
  if ((opp.state === 'light' || opp.state === 'heavy') && simPhase(opp) !== 'recovery') {
    const reach = RULES[opp.state].reach;
    if (dist <= reach + 10 && (me.x - opp.x) * opp.facing > 0) {
      return 'guard';
    }
  }

  return me.state;
}

// 评估仿真终点状态 S（单位：等效血量分）
function evalSimState(m, s0) {
  const me = m.f[0], opp = m.f[1];
  const dist = Math.abs(opp.x - me.x);

  if ( m.clash ) {
    // 进入对冲时按双方剩余气量与濒死加成评估优劣
    const myP = (me.ki > 0 ? 1 + 0.02 * me.ki + 0.6 : 0.5) + (me.hp < 450 ? 0.4 : 0);
    const opP = (opp.ki > 0 ? 1 + 0.02 * opp.ki + 0.6 : 0.5) + (opp.hp < 450 ? 0.4 : 0);
    const clashAdv = (myP - opP) * 260 + (me.ki - opp.ki) * 3.5;
    return (me.hp - opp.hp) + clashAdv;
  }

  let myEffHp = me.hp;
  let oppEffHp = opp.hp;
  let extraScore = 0;

  // 1. 仍在连段取消窗口时直接结算后续必中连段伤害
  if (me.cancel) {
    oppEffHp -= calcRemainingComboDmg(me, opp, dist, opp.combo, me.chain);
    extraScore += 22; // 必得击倒与版边推进优势
  }
  if (opp.cancel) {
    myEffHp -= calcRemainingComboDmg(opp, me, dist, me.combo, opp.chain);
    extraScore -= 22;
  }

  const meFreeIn = FREE_SET.has(me.state) ? 0 : me.dur - me.t;
  const oppFreeIn = FREE_SET.has(opp.state) ? 0 : opp.dur - opp.t;

  // 2. 场上飞行中的气功波与正在读条的大招延伸评估（突破仿真步数视野限制）
  for (let i = 0; i < m.blasts.length; i++) {
    const bl = m.blasts[i];
    const shooter = m.f[bl.owner], target = m.f[1 - bl.owner];
    const gap = (target.x - bl.x) * bl.dir;
    if (gap > 0) {
      const eta = Math.max(0, Math.ceil((gap - 30) / 13));
      const tFree = bl.owner === 0 ? oppFreeIn : meFreeIn;
      if (target.state !== 'down' && tFree > eta) {
        const dmg = Math.round(60 * simMult(target));
        if (bl.owner === 0) oppEffHp -= dmg;
        else myEffHp -= dmg;
      } else {
        // 迫使防御的削血与气量收益
        if (bl.owner === 0) {
          if (opp.hp <= 12 && opp.ki < 16) oppEffHp -= 12;
          else extraScore += 14;
        } else {
          if (me.hp <= 12 && me.ki < 16) myEffHp -= 12;
          else extraScore -= 14;
        }
      }
    }
  }

  // 正在读条或发射的大招后续结算
  for (let i = 0; i < 2; i++) {
    const shooter = m.f[i], target = m.f[1 - i];
    if (shooter.state === 'beam' && simPhase(shooter) !== 'recovery') {
      const aimed = (target.x - shooter.x) * shooter.facing > 0;
      const ticksToFire = Math.max(0, shooter.su - shooter.t);
      const tFree = i === 0 ? oppFreeIn : meFreeIn;
      if (!aimed) {
        // 大招射反方向，背身完全暴露给对手全套连段
        if (i === 0) myEffHp -= 175;
        else oppEffHp -= 175;
      } else {
        const beamEta = ticksToFire + Math.max(0, Math.ceil((dist - 100) / 30));
        const roomBehindShooter = shooter.facing > 0 ? shooter.x - 40 : 960 - shooter.x;
        const canInterrupt = (dist <= 110 && tFree + 5 < ticksToFire) || (dist <= 140 && tFree + 9 < ticksToFire);
        const canCrossup = target.ki >= 16 && roomBehindShooter >= 60 && tFree + 8 <= ticksToFire &&
          (dist - Math.max(0, ticksToFire - tFree - 8) * 4.5 < 200);

        if (canInterrupt || canCrossup) {
          if (i === 0) myEffHp -= 165;
          else oppEffHp -= 165;
        } else if (target.state !== 'down' && tFree > beamEta) {
          const dmg = Math.round(280 * simMult(target));
          if (i === 0) oppEffHp -= dmg;
          else myEffHp -= dmg;
        } else {
          // 迫使格挡：160 削血（或对冲）
          const canCounterBeam = target.ki >= 50 && (beamEta - tFree >= 12);
          if (!canCounterBeam) {
            if (i === 0) {
              if (opp.hp <= 160) oppEffHp -= 160;
              else extraScore += 145;
            } else {
              if (me.hp <= 160) myEffHp -= 160;
              else extraScore -= 145;
            }
          }
        }
      }
    }
  }

  // 3. 检查仿真结束时刻尚未结算的确定性后摇惩罚（如重击挥空、破防眩晕）
  if (!me.cancel && !opp.cancel) {
    const oppVulnerable = !FREE_SET.has(opp.state) && opp.state !== 'down' &&
      (simPhase(opp) === 'recovery' || opp.state === 'crushed' || opp.state === 'hitstun' ||
       ((opp.state === 'light' || opp.state === 'heavy') && (me.x - opp.x) * opp.facing < 0));
    if (oppVulnerable && oppFreeIn - meFreeIn >= 6) {
      const gapTime = oppFreeIn - meFreeIn;
      const walkDist = Math.max(0, gapTime - 6) * 4.5;
      if (dist - walkDist <= 109.9) {
        oppEffHp -= 0.85 * calcRemainingComboDmg(me, opp, Math.max(60, dist - walkDist), opp.combo, 0);
      } else if (gapTime >= 10 && dist - Math.max(0, gapTime - 10) * 4.5 <= 140) {
        oppEffHp -= 0.85 * Math.round(120 * simMult(opp));
      }
    }

    const meVulnerable = !FREE_SET.has(me.state) && me.state !== 'down' &&
      (simPhase(me) === 'recovery' || me.state === 'crushed' || me.state === 'hitstun' ||
       ((me.state === 'light' || me.state === 'heavy') && (opp.x - me.x) * me.facing < 0));
    if (meVulnerable && meFreeIn - oppFreeIn >= 6) {
      const gapTime = meFreeIn - oppFreeIn;
      const walkDist = Math.max(0, gapTime - 6) * 4.5;
      if (dist - walkDist <= 109.9) {
        myEffHp -= 0.92 * calcRemainingComboDmg(opp, me, Math.max(60, dist - walkDist), me.combo, 0);
      } else if (gapTime >= 10 && dist - Math.max(0, gapTime - 10) * 4.5 <= 140) {
        myEffHp -= 0.92 * Math.round(120 * simMult(me));
      }
    }
  }

  // 4. KO 与胜负判定
  if (oppEffHp <= 0 && myEffHp > 0) return 10000 + myEffHp - m.tick * 0.5;
  if (myEffHp <= 0 && oppEffHp > 0) return -10000 - oppEffHp + m.tick * 0.5;
  if (myEffHp <= 0 && oppEffHp <= 0) return 0;

  // 5. 综合血量、气量、帧数优劣与场地位置评分
  const myDamageTaken = Math.max(0, s0.me.hp - myEffHp);
  const lowHpWeight = myEffHp < 450 ? 1.35 : 1.15;
  let score = (opp.hp - oppEffHp) + (s0.opp.hp - opp.hp) - (myDamageTaken * lowHpWeight) + extraScore;

  // 气量价值与空防破防风险
  score += (me.ki - s0.me.ki) * 0.88 - (opp.ki - s0.opp.ki) * 0.82;
  if (me.ki < 4.5) score -= 24;
  else if (me.ki < 6.5) score -= 12;
  if (me.ki < 15.5 && opp.ki >= 50) score -= 18;
  if (opp.ki < 4.5) score += 20;

  // 击倒与帧数优势
  if (opp.state === 'down') score += 20;
  if (me.state === 'down') score -= 20;
  score += clamp(oppFreeIn - meFreeIn, -18, 18) * 0.65;

  // 角落位置与距离控制
  const myWallBehind = me.facing > 0 ? me.x - 40 : 960 - me.x;
  const oppWallBehind = opp.facing > 0 ? opp.x - 40 : 960 - opp.x;
  if (myWallBehind < 85) score -= (85 - myWallBehind) * 0.08;
  if (oppWallBehind < 85) score += (85 - oppWallBehind) * 0.08;

  // 根据血量领先与剩余时间调节距离偏好
  const timeLeft = 3600 - m.realTick;
  if (timeLeft < 500 && myEffHp > oppEffHp + 60) {
    score += Math.min(dist, 260) * 0.03;
  } else {
    score -= Math