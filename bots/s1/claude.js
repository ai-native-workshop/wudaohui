// Claude Opus 5.5 · claude.ai 网页版（订阅） · 2026-10-24T22:31:12.537Z
// AI 武道会 · 选手程序：看帧、惩罚、读对手
var R = RULES;
var LT = R.light, HV = R.heavy, BL = R.blast, BM = R.beam, DS = R.dash, CL = R.clash;
var SC = R.combo, BODY = R.body;

// ---------- 对手习惯模型（这一局内学习） ----------
var CATS = ['G', 'N', 'L', 'H', 'D'];
var TR = {};
(function () {
  for (var i = 0; i < CATS.length; i++) {
    var row = {};
    for (var j = 0; j < CATS.length; j++) row[CATS[j]] = 0.4;
    row[CATS[i]] = 2;
    TR[CATS[i]] = row;
  }
  TR.N.G = 0.9; TR.N.L = 0.8; TR.G.L = 0.7; TR.G.N = 0.8; TR.L.G = 0.8; TR.L.N = 0.8;
})();
var lastObs = null, prevOp = null, dashTrack = null;
var wake = { n: 2, dash: 0.5 };

// ---------- 小工具 ----------
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function sc(c) { return SC[Math.min(c, SC.length - 1)]; }
function rageOf(f) { return f.hp < R.kiGain.rageHp * R.hp ? 1 : 0; }
function comboVal(c, m) {
  var v = LT.damage * m * sc(c);
  for (var i = 1; i < LT.chain; i++) v += LT.damage * sc(c + i);
  return v + HV.damage * sc(c + LT.chain);
}
function blastTravel(d) { return Math.max(0, Math.ceil((d - 40 - BL.speed - BODY) / BL.speed)); }
function blastTime(d) { return BL.startup + blastTravel(d); }
function beamReach(d) { return BM.startup + Math.max(0, Math.ceil((d - 40 - BM.speed - BODY) / BM.speed)); }

function landFrom(ax, ox, dd) {
  var L = R.stage.left, H = R.stage.right, g = R.minGap;
  var x = ax + dd * DS.dist, before = (ox - ax) * dd, after = (ox - x) * dd;
  if (before > 0 && after < g) {
    var behind = ox + dd * Math.max(g, -after);
    if (after <= -g && behind >= L && behind <= H) x = behind;
    else if (ox + dd * g >= L && ox + dd * g <= H && after < 0) x = ox + dd * g;
    else x = ox - dd * g;
  }
  return clamp(x, L, H);
}
function dashLand(c, sign) { return landFrom(c.me.x, c.op.x, c.dir * sign); }
function clearsRay(x0, lx, from, f) {
  var p8 = x0 + (lx - x0) * 0.9;
  return (p8 - from) * f < -(BODY + 2) && (lx - from) * f < -(BODY + 2);
}

// 最早一发打到我身上的气功波：还要几个 tick（999 = 没有）
function blastHit(c) {
  var h = 999, bs = c.s.blasts, op = c.op;
  for (var i = 0; i < bs.length; i++) {
    var b = bs[i];
    if (b.incoming && b.eta !== null && b.eta !== undefined) h = Math.min(h, Math.max(0, b.eta - 1));
  }
  if (op.state === 'blast' && op.phase === 'startup' && (c.me.x - op.x) * op.facing > 0)
    h = Math.min(h, (BL.startup - op.t) + blastTravel(c.d));
  return h;
}

function multAt(op, k) {
  var t = op.t + k;
  switch (op.state) {
    case 'light': case 'heavy': { var M = R[op.state]; return (t < M.startup || t >= M.startup + M.active) ? R.counter : 1; }
    case 'blast': return R.counter;
    case 'beam': { var su = op.left + op.t - BM.fire - BM.recovery; return (t < su || t >= su + BM.fire) ? R.counter : 1; }
    case 'dash': return t >= DS.ticks ? R.counter : 1;
  }
  return 1;
}

function clashP(myKi, opKi, myR, opR) {
  var z = 0.06 * (myKi - opKi) + 1.2 * (myR - opR);
  if (myKi < 4 && opKi > 8) z -= 1.2;
  if (opKi < 4 && myKi > 8) z += 1.2;
  return 1 / (1 + Math.exp(-z));
}
function counterGood(c, rem) {
  var me = c.me, op = c.op;
  var P = clashP(me.ki - BM.cost + 0.04 * rem, op.ki + 0.04 * rem, rageOf(me), rageOf(op));
  if (me.hp <= BM.chip) return P > 0.03;
  if (op.hp <= CL.damage && P >= 0.32) return true;
  return P >= 0.45;
}

function pick(ev, T) {
  var ks = [], mx = -1e9, k, i;
  for (k in ev) { ks.push(k); if (ev[k] > mx) mx = ev[k]; }
  var w = [], tot = 0;
  for (i = 0; i < ks.length; i++) { var x = Math.exp((ev[ks[i]] - mx) / T); w.push(x); tot += x; }
  var r = Math.random() * tot;
  for (i = 0; i < ks.length; i++) { r -= w[i]; if (r <= 0) return ks[i]; }
  return ks[0];
}

// ---------- 观察 ----------
function catOf(op) {
  switch (op.state) {
    case 'guard': return 'G';
    case 'idle': case 'forward': case 'back': case 'charge': return 'N';
    case 'light': return op.phase === 'recovery' ? null : 'L';
    case 'heavy': return op.phase === 'recovery' ? null : 'H';
    case 'dash': return 'D';
  }
  return null;
}

function observe(c) {
  var s = c.s, op = c.op;
  var k = c.d <= 180 ? catOf(op) : null;
  if (k) {
    if (lastObs && s.t - lastObs.t >= 3 && s.t - lastObs.t <= 13) TR[lastObs.c][k] += 1;
    lastObs = { t: s.t, c: k };
  } else lastObs = null;
  if (prevOp && prevOp.state === 'down' && op.state !== 'down' && op.state !== 'ko') {
    wake.n += 1;
    if (op.state === 'dash') wake.dash += 1;
  }
  if (op.state === 'dash') {
    var start = s.t - op.t;
    if (!dashTrack || dashTrack.start !== start) {
      var still = prevOp && prevOp.t <= start && start - prevOp.t <= 8 &&
        prevOp.state !== 'forward' && prevOp.state !== 'back' && prevOp.state !== 'dash' && prevOp.state !== 'down';
      dashTrack = { start: start, x0: still ? prevOp.x : null, px: null, pt: null, lx: op.x, lt: op.t };
    } else {
      dashTrack.px = dashTrack.lx; dashTrack.pt = dashTrack.lt;
      dashTrack.lx = op.x; dashTrack.lt = op.t;
    }
  } else dashTrack = null;
}

function dashLanding(c) {
  var op = c.op, T = dashTrack;
  if (op.phase !== 'moving') return op.x;
  if (!T) return null;
  if (T.pt !== null && T.lt > T.pt) {
    var v = (T.lx - T.px) / (T.lt - T.pt);
    return clamp(T.lx + v * (DS.ticks - T.lt), R.stage.left, R.stage.right);
  }
  if (T.x0 !== null && Math.abs(op.x - T.x0) > 1) return landFrom(T.x0, c.me.x, op.x > T.x0 ? 1 : -1);
  return null;
}

// ---------- 入口 ----------
function decide(state) {
  var act;
  try { act = think(state); } catch (e) { act = 'guard'; }
  return act;
}

function think(s) {
  var me = s.me, op = s.opp;
  var c = { s: s, me: me, op: op, d: s.dist, dir: op.x > me.x ? 1 : op.x < me.x ? -1 : me.facing };
  observe(c);
  var act;
  if (s.clash) act = clashAct(c);
  else if (me.canCancel) act = comboAct(c);
  else if (!me.free) act = 'idle';
  else act = freeAct(c);
  prevOp = { t: s.t, x: op.x, state: op.state };
  return act;
}

// ---------- 对冲 ----------
function clashAct(c) {
  var k = c.s.clash, me = c.me, d = c.d;
  var toMe = k.pos * d - BODY, toOp = (1 - k.pos) * d - BODY;
  var near = Math.max(0, Math.min(toMe, toOp));
  if (me.ki <= 1.5) return 'idle';
  if (me.ki <= 7 && toMe > 40) return 'idle';
  if (near * near / 256 < 45 || CL.maxTicks - k.t < 40) return 'push';
  return 'idle';
}

// ---------- 连招 ----------
function comboAct(c) {
  var me = c.me, d = c.d;
  if (me.chain < LT.chain && d <= LT.reach - 1) return 'light';
  if (d <= HV.reach - 1) return 'heavy';
  if (me.ki >= BL.cost && !me.blastOut) return 'blast';
  return 'idle';
}

// ---------- 空闲时 ----------
function freeAct(c) {
  var r = vsBeamFiring(c) || vsBeamStartup(c) || vsStrike(c) || vsBlast(c) || punish(c);
  if (r) return r;
  if (c.op.state === 'dash') return (c.d >= 260 && blastHit(c) > 6 && c.me.ki < 100) ? 'charge' : 'idle';
  if (c.op.state === 'down') { r = oki(c); if (r) return r; }
  return neutral(c);
}

function vsBeamFiring(c) {
  var me = c.me, op = c.op, bs = c.s.beams, b = null;
  for (var i = 0; i < bs.length; i++) if (!bs[i].mine && (me.x - bs[i].from) * bs[i].dir > 0) b = bs[i];
  if (!b) return null;
  if (me.ki >= DS.cost) {
    var lx = dashLand(c, 1);
    if ((lx - op.x) * c.dir > 0 && clearsRay(me.x, lx, b.from, b.dir)) return 'dash_forward';
  }
  var gap = (me.x - b.front) * b.dir - BODY;
  if (gap > 365 && me.ki >= BM.cost && op.state === 'beam' && counterGood(c, 12)) return 'beam';
  if (gap > 215 && blastHit(c) > 6) return 'charge';
  return 'guard';
}

function vsBeamStartup(c) {
  var me = c.me, op = c.op, d = c.d;
  if (op.state !== 'beam' || op.phase !== 'startup' || (me.x - op.x) * op.facing <= 0) return null;
  var rem = op.left - BM.fire - BM.recovery;
  if (d <= LT.reach - 2 && rem >= LT.startup) return 'light';
  if (d <= HV.reach - 2 && rem >= HV.startup) return 'heavy';
  var n1 = Math.max(1, Math.ceil((d - (LT.reach - 4)) / 27));
  if (6 * n1 + LT.startup <= rem) return 'forward';
  var n2 = Math.max(1, Math.ceil((d - (HV.reach - 4)) / 27));
  if (6 * n2 + HV.startup <= rem) return 'forward';
  if (me.ki >= DS.cost) {
    var lx = dashLand(c, 1);
    if ((lx - op.x) * c.dir > 0) {
      if (clearsRay(me.x, lx, op.x + 25 * op.facing, op.facing)) return 'dash_forward';
    } else {
      var ld = Math.abs(lx - op.x);
      if (ld <= LT.reach - 2 && rem >= 23) return 'dash_forward';
      if (ld <= HV.reach - 2 && rem >= 27) return 'dash_forward';
    }
  }
  if (me.ki >= BL.cost && !me.blastOut && blastHit(c) > 900 && blastTime(d) <= rem) return 'blast';
  if (me.ki >= BM.cost && rem >= BM.counterStartup && counterGood(c, rem)) return 'beam';
  var travel = Math.max(0, Math.ceil((d - 100) / BM.speed));
  if (rem + travel > 7 && blastHit(c) > 6) return 'charge';
  return 'guard';
}

function vsStrike(c) {
  var me = c.me, op = c.op, d = c.d, s = c.s;
  if ((op.state !== 'light' && op.state !== 'heavy') || op.phase === 'recovery') return null;
  if ((me.x - op.x) * op.facing <= 0) return null;
  if (op.state === 'light') return d <= LT.reach + 2 ? 'guard' : null;
  if (d > HV.reach + 2) return null;
  var toActive = HV.startup - op.t;
  if (toActive > LT.startup && d <= LT.reach - 2) return 'light';
  if (me.ki >= DS.cost) {
    var lx = dashLand(c, 1);
    if ((lx - op.x) * c.dir > 0) return 'dash_forward';
    var room = Math.min(s.wallBehind, DS.dist);
    if (d + 0.9 * room > HV.reach + 5) return 'dash_back';
  }
  return 'back';   // 重击打格挡必破防，宁可站着吃
}

function vsBlast(c) {
  var me = c.me, op = c.op, d = c.d;
  if (op.state === 'blast' && op.phase === 'startup' && (me.x - op.x) * op.facing > 0) {
    var spawnIn = BL.startup - op.t;
    if (d <= LT.reach - 2 && spawnIn >= LT.startup) return 'light';
    if (d <= HV.reach - 2 && spawnIn >= HV.startup) return 'heavy';
  }
  var h = blastHit(c);
  if (h <= 5) {
    if (me.ki >= 45 && d >= 350) return 'dash_forward';
    return 'guard';
  }
  return null;
}

// 对手动不了的时候：挑最赚的打法
function punish(c) {
  var me = c.me, op = c.op;
  if (op.free || op.state === 'down' || op.state === 'ko' || op.state === 'clash') return null;
  var h = blastHit(c);
  if (h <= 20) return null;
  var a = 0, b = op.left - 1, ox = op.x;
  if (op.state === 'dash') {
    a = Math.max(0, DS.invuln - op.t);
    if (op.phase === 'moving') { ox = dashLanding(c); if (ox === null) return null; }
  }
  if (b < a) return null;
  var side = ox > me.x ? 1 : ox < me.x ? -1 : c.dir;
  if (side !== c.dir) return null;
  var d = Math.abs(ox - me.x), cmb = op.combo;
  var live = (op.state === 'light' || op.state === 'heavy') && op.phase !== 'recovery';
  var best = null, bestV = 0;
  var fits = function (k0, k1) { return Math.max(k0, a) <= Math.min(k1, b); };
  var first = function (k0) { return Math.max(k0, a); };
  var take = function (act, v) { if (v > bestV) { bestV = v; best = act; } };

  if (d <= LT.reach - 2 && fits(5, 7)) take('light', comboVal(cmb, multAt(op, first(5))));
  if (d <= HV.reach - 2 && fits(9, 12)) take('heavy', HV.damage * multAt(op, first(9)) * sc(cmb) + 25);
  if (op.state !== 'dash') {
    if (me.ki >= BM.cost && h > 40) {
      var kb = beamReach(d);
      if (kb >= a && kb <= b) take('beam', BM.damage * multAt(op, kb) * sc(cmb) - 75);
    }
    if (me.ki >= BL.cost && !me.blastOut && h > 900 && d > HV.reach) {
      var kt = blastTime(d);
      if (kt >= a && kt <= b) take('blast', BL.damage * multAt(op, kt) * sc(cmb) - 21);
    }
    if (!live) {
      if (d > LT.reach - 2) {
        var n1 = Math.max(1, Math.ceil((d - (LT.reach - 4)) / 27));
        if (fits(6 * n1 + 5, 6 * n1 + 7)) take('forward', comboVal(cmb, multAt(op, 6 * n1 + 5)) - 8);
      }
      if (d > HV.reach - 2) {
        var n2 = Math.max(1, Math.ceil((d - (HV.reach - 4)) / 27));
        if (fits(6 * n2 + 9, 6 * n2 + 12)) take('forward', HV.damage * multAt(op, 6 * n2 + 9) * sc(cmb) + 17);
      }
      if (me.ki >= DS.cost + 4 && d > LT.reach - 2) {
        var lx = dashLand(c, 1), dl = Math.abs(lx - op.x);
        if (dl <= LT.reach - 2 && fits(23, 25)) take('dash_forward', comboVal(cmb, multAt(op, 23)) - 24);
        else if (dl <= HV.reach - 2 && fits(27, 30)) take('dash_forward', HV.damage * multAt(op, 27) * sc(cmb) + 1);
      }
    }
  }
  return best;
}

// 对手倒地：起身压制
function beamOkiOK(c, W) {
  var me = c.me, op = c.op, d = c.d;
  if (d < 205 || W > 64) return false;
  var hitAt = beamReach(d);
  var wakeKi = op.ki + 0.04 * W * (rageOf(op) ? 1.5 : 1);
  var canAnswer = wakeKi + 1 >= BM.cost && W <= hitAt - 11;
  if (canAnswer && clashP(me.ki - BM.cost + 1.2, wakeKi - BM.cost, rageOf(me), rageOf(op)) < 0.6) return false;
  if (W < BM.startup) {
    var room = BM.startup - W;
    if (op.ki >= BL.cost && blastTime(d) <= room) return false;
    if (op.ki >= DS.cost && room >= 23 && Math.max(R.minGap, d - DS.dist) <= LT.reach) return false;
    var n = Math.max(1, Math.ceil((d - (LT.reach - 4)) / 27));
    if (6 * n + 5 <= room) return false;
  }
  return true;
}

function oki(c) {
  var me = c.me, op = c.op, d = c.d;
  var W = op.left, h = blastHit(c);
  if (h <= 8) return null;
  if (me.ki >= BM.cost && h > 40 && beamOkiOK(c, W)) return 'beam';
  var dashy = wake.dash / wake.n > 0.4;
  if (d <= HV.reach - 6) {
    if (!dashy && W >= 5 && W <= 12) return 'heavy';
    if (W >= 13 || (dashy && W >= 7)) return 'charge';
    return 'guard';
  }
  var n = Math.max(1, Math.ceil((d - (HV.reach - 8)) / 27));
  if (6 * n + 5 <= W) return 'forward';
  if (W >= 7 && d >= 200 && me.ki < 100) return 'charge';
  return null;
}

// ---------- 中立 ----------
function beamNeutralOK(c) {
  var me = c.me, op = c.op, d = c.d;
  if (!op.free || d < 330) return false;
  var canAnswer = op.ki + 6.5 >= BM.cost;
  if (!canAnswer) return true;
  return clashP(me.ki - BM.cost + 1.2, op.ki + 2 - BM.cost, rageOf(me), rageOf(op)) >= 0.62;
}

function neutral(c) {
  var me = c.me, op = c.op, d = c.d, s = c.s;
  var h = blastHit(c), lead = me.hp - op.hp, late = s.timeLeft < 480;
  if (late && lead < 0 && -lead < BM.chip && me.ki >= BM.cost && h > 40 && d > HV.reach &&
      s.timeLeft > beamReach(d) + 1 && s.timeLeft < 160) return 'beam';
  if (me.ki >= BM.cost && h > 40 && beamNeutralOK(c)) return 'beam';
  if (d > 150) {
    if (late && lead > 0) {
      if (d >= 300 && h > 6 && me.ki < 100) return 'charge';
      return s.wallBehind > 25 ? 'back' : 'guard';
    }
    var danger = op.ki >= 45 && op.ki > me.ki + 10 && d > 250;
    var goal = clamp(op.ki + 25, 70, 100);
    if (!danger && me.ki < goal && d >= 220 && h > 6) return 'charge';
    if (me.ki >= 95 && d >= 260 && !me.blastOut && h > 900 && op.state === 'charge') return 'blast';
    return 'forward';
  }
  if (h <= 20) return 'guard';
  return closeGame(c);
}

// 近身猜拳：按对手习惯算期望
function closeGame(c) {
  var me = c.me, op = c.op, d = c.d, s = c.s;
  if (op.state === 'down') return 'guard';
  var k = catOf(op) || 'N';
  var row = TR[k], tot = 0, p = {}, i;
  for (i = 0; i < CATS.length; i++) tot += row[CATS[i]];
  for (i = 0; i < CATS.length; i++) p[CATS[i]] = row[CATS[i]] / tot;
  var v = op.state === 'forward' ? -R.walk.forward : op.state === 'back' ? R.walk.back : 0;
  var d5 = Math.max(R.minGap, d + v * 5), d9 = Math.max(R.minGap, d + v * 9);
  var lightOK = d5 <= LT.reach - 2, heavyOK = d9 <= HV.reach - 2;
  var lightThreat = d <= LT.reach + 10;
  var cm = op.state === 'charge' ? R.chargeHit : 1;
  var combo = comboVal(0, 1), crushable = op.ki < R.guardKi.light;
  var heavyVsG = HV.crushDamage + (d <= LT.reach - 4 ? combo : 0);
  var ev = {};
  if (lightOK) ev.light = p.N * (combo + LT.damage * (cm - 1)) + p.L * combo * 0.75 + p.H * (combo + 10) +
    p.G * (crushable ? 170 : -4) - p.D * 25;
  if (heavyOK) ev.heavy = p.G * heavyVsG + p.N * HV.damage * cm + p.H * 40 +
    p.L * (lightThreat ? -180 : 140) - p.D * 70;
  ev.guard = p.L * (lightThreat ? 4 : 0) - p.H * (d <= HV.reach ? 220 : 0) - 3;
  ev.back = -p.L * (d + 15 <= LT.reach ? 170 : 0) - p.H * (d + 27 <= HV.reach ? 120 : 0) - 6;
  if (!lightOK) ev.forward = -p.L * (d - 27 <= LT.reach ? 150 : 0) - p.H * (d - 30 <= HV.reach ? 120 : 0) + 8;
  if (s.timeLeft < 480 && me.hp > op.hp) { ev.back += 40; ev.guard += 20; }
  return pick(ev, 22);
}
