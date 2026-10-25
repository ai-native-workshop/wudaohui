// GPT-6 Astra · openai/gpt-6-astra · 2026-10-24T21:22:20.932Z
const R = RULES;

const ID = {
  idle: 0, forward: 1, back: 2, guard: 3, charge: 4,
  light: 5, heavy: 6, blast: 7, beam: 8, dash: 9,
  hitstun: 10, blockstun: 11, crushed: 12, down: 13,
  recover: 14, clash: 16, ko: 17
};
const ACTION = [
  'idle', 'forward', 'back', 'guard', 'charge',
  'light', 'heavy', 'blast', 'beam', 'dash_forward',
  '', '', '', '', '', 'dash_back'
];

const memory = {
  previous: null,
  stamp: '',
  habits: [2, 2, 2],
  clash: null
};

function cap(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}
function sign(x) {
  return x < 0 ? -1 : 1;
}
function rage(a) {
  return a.hp < R.hp * R.kiGain.rageHp ? R.kiGain.rage : 1;
}
function freeState(a) {
  return a.st <= 4;
}
function invulnerable(a) {
  return a.st === 13 || (a.st === 9 && a.t < R.dash.invuln);
}
function remaining(a) {
  return a.dur - a.t;
}
function behindRoom(a, b) {
  return b.x > a.x ? a.x - R.stage.left : R.stage.right - a.x;
}
function crossPossible(a, b) {
  const d = Math.abs(a.x - b.x);
  const room = b.x > a.x
    ? R.stage.right - b.x
    : b.x - R.stage.left;
  return d < R.dash.dist - 1 && room >= R.minGap;
}
function counterMultiplier(a) {
  if (a.st === 4) return R.chargeHit;
  if (a.st === 5 || a.st === 6) {
    const q = a.st === 5 ? R.light : R.heavy;
    return a.t < q.startup || a.t >= q.startup + q.active
      ? R.counter : 1;
  }
  if (a.st === 7) return R.counter;
  if (a.st === 8) {
    return a.t < a.su || a.t >= a.su + R.beam.fire
      ? R.counter : 1;
  }
  if (a.st === 9 && a.t >= R.dash.ticks) return R.counter;
  return 1;
}

function observe(s) {
  const old = memory.previous;
  const o = s.opp;
  const key = o.state + ':' + (s.t - o.t);

  if (key !== memory.stamp) {
    if (o.state === 'light') memory.habits[0] += 1;
    if (o.state === 'heavy') memory.habits[1] += 1;
    if (o.state === 'blast') memory.habits[2] += 1;
    if (o.state === 'beam') memory.habits[2] += 0.8;
    if (o.state === 'dash') memory.habits[0] += 0.25;
    memory.stamp = key;
  }

  if (old) {
    const dt = Math.min(24, Math.max(0, s.t - old.t));
    if (o.state === 'guard' || o.state === 'back')
      memory.habits[2] += dt * 0.025;
    if (o.state === 'forward')
      memory.habits[0] += dt * 0.012;
  }
  for (let i = 0; i < 3; i++)
    memory.habits[i] = 2 + (memory.habits[i] - 2) * 0.997;

  memory.previous = s;
  return old;
}

function fighter(v, next) {
  const st = ID[v.state];
  const dur = v.t + v.left;
  let kb = 0;
  if (st === 13) {
    const distance = dur === R.heavy.down ? R.heavy.knockback
      : dur === R.beam.down ? R.beam.knockback
      : R.beam.knockback;
    kb = Math.max(0, distance - Math.max(0, v.t - 1) * 12);
  }
  return {
    st, x: v.x, hp: v.hp, ki: v.ki, t: v.t, dur,
    face: v.facing, next, hit: false, cancel: false,
    chain: v.chain || 0, combo: v.combo || 0,
    su: st === 8 ? dur - R.beam.fire - R.beam.recovery : R.beam.startup,
    x0: v.x, x1: v.x, kb, kbdir: 0
  };
}

function makeRoot(s, old) {
  const a = fighter(s.me, 0);
  const b = fighter(s.opp, s.opp.free
    ? (R.decideEvery - s.opp.t % R.decideEvery) % R.decideEvery
    : s.opp.left);

  a.kbdir = sign(a.x - b.x);
  b.kbdir = -a.kbdir;

  if (b.st === 9 && b.t < R.dash.ticks) {
    let velocity = b.face * R.dash.dist / R.dash.ticks;
    if (old) {
      const dt = s.t - old.t;
      const same = old.opp.state === 'dash' &&
        old.t - old.opp.t === s.t - s.opp.t;
      if (same && dt > 0) {
        velocity = (b.x - old.opp.x) / dt;
      } else if (b.t > 0 && dt >= b.t && dt - b.t <= 12) {
        let origin = old.opp.x;
        const before = dt - b.t;
        if (old.opp.state === 'forward')
          origin += old.opp.facing * R.walk.forward * before;
        if (old.opp.state === 'back')
          origin -= old.opp.facing * R.walk.back * before;
        velocity = (b.x - origin) / b.t;
      }
    }
    velocity = cap(velocity, -28, 28);
    b.x0 = b.x - velocity * b.t;
    b.x1 = cap(b.x + velocity * (R.dash.ticks - b.t),
      R.stage.left, R.stage.right);
  }

  const beams = [null, null];
  for (const v of s.beams) {
    const owner = v.mine ? 0 : 1;
    beams[owner] = {
      owner, from: v.from, front: v.front, dir: v.dir, hit: false
    };
  }
  return {
    f: [a, b],
    p: s.blasts.map(v => ({
      owner: v.mine ? 0 : 1, x: v.x, px: v.x, dir: v.dir, dead: false
    })),
    beams,
    tick: 0
  };
}

function cloneRoot(root) {
  return {
    f: [{ ...root.f[0] }, { ...root.f[1] }],
    p: root.p.map(p => ({ ...p })),
    beams: root.beams.map(b => b ? { ...b } : null),
    tick: 0
  };
}

function hasBlast(s, owner) {
  for (const p of s.p)
    if (!p.dead && p.owner === owner) return true;
  return false;
}

function blastETA(s, owner) {
  const a = s.f[owner];
  let eta = 1e6;
  for (const p of s.p) {
    if (p.owner === owner || p.dead) continue;
    const gap = (a.x - p.x) * p.dir;
    if (gap >= -R.body) {
      eta = Math.min(eta,
        Math.max(0, Math.ceil((gap - R.body) / R.blast.speed)));
    }
  }
  return eta;
}

function cancelMove(a, b) {
  const d = Math.abs(a.x - b.x);
  const scale = R.combo[Math.min(b.combo, R.combo.length - 1)];
  if (d <= R.light.reach && a.chain < R.light.chain) {
    if (b.hp > Math.round(R.light.damage * scale) &&
        b.hp <= Math.round(R.heavy.damage * scale))
      return 6;
    return 5;
  }
  return 6;
}

// 四种对手模型共用精确时序，区别在于空闲时的进攻偏好。
function policy(s, i, mode) {
  const a = s.f[i], b = s.f[1 - i];
  const d = Math.abs(a.x - b.x);
  const left = remaining(b);
  const room = behindRoom(a, b);
  const canBlast = a.ki >= R.blast.cost && !hasBlast(s, i);

  if (a.cancel) return cancelMove(a, b);
  if (blastETA(s, i) <= R.decideEvery) return 3;

  if (b.st === 8 && b.t < b.su + R.beam.fire &&
      (a.x - b.x) * b.face > 0) {
    const startup = Math.max(0, b.su - b.t);
    const impact = startup +
      Math.max(0, Math.ceil((d - 70) / R.beam.speed) - 1);

    if (d <= R.light.reach && impact > R.light.startup) return 5;
    if (d <= R.heavy.reach && impact > R.heavy.startup) return 6;
    const shotTime = R.blast.startup +
      Math.max(0, Math.ceil((d - 70) / R.blast.speed) - 1);
    if (canBlast && shotTime < startup) return 7;
    if (a.ki >= R.dash.cost && crossPossible(a, b)) return 9;
    if (d < 240 && startup > 20) return 1;
    return 3;
  }

  if (b.st === 13) {
    if (d <= R.heavy.reach && left >= 5 && left <= 12) return 6;
    if (d <= R.light.reach && left <= 7) return 5;
    if (d > 82) return 1;
    return left > 12 && a.ki < R.kiMax ? 4 : 3;
  }

  if (b.st >= 10 && b.st <= 14) {
    if (d <= R.light.reach && left > R.light.startup) return 5;
    if (d <= R.heavy.reach && left > R.heavy.startup) return 6;
    if (d > R.light.reach) return 1;
  }

  if (mode === 0 || mode === 3) {
    if (b.st === 5 && b.t < R.light.startup + R.light.active) {
      if (d > R.light.reach && d <= R.heavy.reach) return 6;
      if (d <= R.light.reach) {
        const wait = Math.max(0, R.light.startup - b.t);
        const retreat = R.walk.back * (wait + 1);
        if (d + retreat > R.light.reach && room >= retreat) return 2;
        return 3;
      }
    }

    if (b.st === 6 && b.t < R.heavy.startup + R.heavy.active) {
      const wait = Math.max(0, R.heavy.startup - b.t);
      if (d <= R.light.reach && wait > R.light.startup) return 5;
      if (d > R.heavy.reach)
        return d > R.heavy.reach + R.walk.forward * 6 ? 1 : 3;

      const retreat = R.walk.back * (wait + 1);
      if (d + retreat > R.heavy.reach && room >= retreat) return 2;
      if (a.ki >= R.dash.cost) {
        if (crossPossible(a, b)) return 9;
        if (room >= 80) return 15;
      }
      return 3;
    }

    if (b.st === 7 && b.t < R.blast.startup) {
      const impact = R.blast.startup - b.t +
        Math.max(0, Math.ceil((d - 70) / R.blast.speed) - 1);
      if (d <= R.light.reach && impact > R.light.startup) return 5;
      if (d <= R.heavy.reach && impact > R.heavy.startup) return 6;
      if (impact <= 6) return 3;
    }

    if (b.st === 9 && b.t < R.dash.ticks)
      return d <= 220 ? 3 : 1;

    if (b.st >= 5 && b.st <= 9 && counterMultiplier(b) > 1 &&
        (b.st !== 8 || b.t >= b.su + R.beam.fire)) {
      if (d <= 96 && left > R.light.startup) return 5;
      if (d <= R.heavy.reach && left > R.heavy.startup) return 6;
      if (d <= R.light.reach) return 5;
      if (d <= R.heavy.reach && left >= 5) return 6;
    }
  }

  if (b.st === 3 && d <= R.heavy.reach) return 6;

  if (mode === 3) {
    if (d <= R.light.reach) return b.st === 4 ? 5 : 3;
    if (d <= R.heavy.reach) return b.st === 1 ? 6 : 3;
    if (canBlast) return 7;
    if (d < 210 && room > 100) return 2;
    return d > 245 && a.ki < 80 ? 4 : 3;
  }

  if (mode === 2) {
    if (d <= R.heavy.reach) return 6;
    return 1;
  }

  if (d <= R.light.reach) return 5;
  if (d <= R.heavy.reach) {
    if (mode === 0 && b.st === 2 && d + 30 > R.heavy.reach) return 1;
    return 6;
  }
  if (mode === 0 && b.st === 1 && d <= 170) return 6;
  if (mode === 0 && d > 300 && a.ki < 28 && b.st !== 1) return 4;
  return 1;
}

function face(a, b) {
  if (a.x !== b.x) a.face = sign(b.x - a.x);
}

function dashEnd(a, b, direction) {
  const d = a.face * direction;
  let x = a.x + d * R.dash.dist;
  const before = (b.x - a.x) * d;
  const after = (b.x - x) * d;
  if (before > 0 && after < R.minGap) {
    const behind = b.x + d * Math.max(R.minGap, -after);
    if (after <= -R.minGap &&
        behind >= R.stage.left && behind <= R.stage.right) {
      x = behind;
    } else if (after < 0 &&
        b.x + d * R.minGap >= R.stage.left &&
        b.x + d * R.minGap <= R.stage.right) {
      x = b.x + d * R.minGap;
    } else {
      x = b.x - d * R.minGap;
    }
  }
  return cap(x, R.stage.left, R.stage.right);
}

function choose(s, i, action) {
  const a = s.f[i], b = s.f[1 - i];
  a.next = s.tick + R.decideEvery;
  face(a, b);

  const chained = a.cancel;
  if (chained) {
    a.cancel = false;
    if (!((action === 5 && a.chain < R.light.chain) ||
          action === 6 || action === 7 || action === 8)) return;
  } else if (action <= 4) {
    if (a.st !== action) {
      a.st = action;
      a.t = 0;
    }
    return;
  }

  const dash = action === 9 || action === 15;
  const cost = action === 7 ? R.blast.cost
    : action === 8 ? R.beam.cost : dash ? R.dash.cost : 0;
  if (a.ki < cost || (action === 7 && hasBlast(s, i))) return;

  a.ki -= cost;
  a.st = dash ? 9 : action;
  a.t = 0;
  a.hit = false;

  if (action === 5) {
    a.chain = chained ? a.chain + 1 : 1;
    a.dur = R.light.startup + R.light.active + R.light.recovery;
  } else if (action === 6) {
    a.dur = R.heavy.startup + R.heavy.active + R.heavy.recovery;
  } else if (action === 7) {
    a.dur = R.blast.startup + R.blast.recovery;
  } else if (dash) {
    a.x0 = a.x;
    a.x1 = dashEnd(a, b, action === 9 ? 1 : -1);
    a.dur = R.dash.ticks + R.dash.recovery;
  }
}

function stun(a, state, duration) {
  a.st = state;
  a.t = 0;
  a.dur = duration;
  a.hit = false;
  a.cancel = false;
}

function hurt(a, b, damage) {
  b.hp -= damage;
  a.ki = Math.min(R.kiMax,
    a.ki + damage * R.kiGain.dealt * rage(a));
  b.ki = Math.min(R.kiMax,
    b.ki + damage * R.kiGain.taken * rage(b));
}

function pushApart(a, b, distance) {
  const d = sign(b.x - a.x);
  const room = d > 0 ? R.stage.right - b.x : b.x - R.stage.left;
  const moved = Math.min(distance, room);
  b.x += d * moved;
  if (moved < distance)
    a.x = cap(a.x - d * (distance - moved), R.stage.left, R.stage.right);
}

function land(s, owner, kind, dir, multiplier) {
  const a = s.f[owner], b = s.f[1 - owner];
  const M = kind === 5 ? R.light : kind === 6 ? R.heavy
    : kind === 7 ? R.blast : R.beam;

  if (b.st === 3 && dir * b.face > 0) {
    if (kind === 6) {
      hurt(a, b, R.heavy.crushDamage);
      stun(b, 12, R.heavy.crush);
      return;
    }

    const cost = kind === 5 ? R.guardKi.light
      : kind === 7 ? R.guardKi.blast : R.guardKi.beam;
    if (b.ki < cost) {
      b.ki = 0;
      if (M.chip) hurt(a, b, M.chip);
      stun(b, 12, R.heavy.crush);
      return;
    }

    b.ki -= cost;
    a.ki = Math.min(R.kiMax, a.ki + R.guardKi.pressure * rage(a));
    if (M.chip) hurt(a, b, M.chip);
    stun(b, 11, kind === 8
      ? a.su + R.beam.fire - a.t + 6 : M.blockstun);
    if (kind === 5) pushApart(a, b, R.light.push);
    return;
  }

  const scale = R.combo[Math.min(b.combo, R.combo.length - 1)];
  const x = multiplier === undefined ? counterMultiplier(b) : multiplier;
  hurt(a, b, Math.max(1, Math.round(M.damage * x * scale)));
  b.combo++;

  if (kind === 5) {
    stun(b, 10, R.light.hitstun);
    pushApart(a, b, R.light.push);
    if (a.st === 5) a.cancel = true;
  } else if (kind === 7) {
    stun(b, 10, R.blast.hitstun);
  } else {
    stun(b, 13, M.down);
    b.kb = M.knockback;
    b.kbdir = b.x === a.x ? -b.face : sign(b.x - a.x);
  }
}

function inRay(b, x, pad) {
  return x + pad >= Math.min(b.from, b.front) &&
         x - pad <= Math.max(b.from, b.front);
}

function advance(s) {
  const a = s.f[0], b = s.f[1];

  for (let i = 0; i < 2; i++) {
    const f = s.f[i];
    if (f.kb > 0) {
      const k = Math.min(f.kb, 12);
      f.x += f.kbdir * k;
      f.kb -= k;
    }
    if (f.st === 1) f.x += f.face * R.walk.forward;
    else if (f.st === 2) f.x -= f.face * R.walk.back;
    else if (f.st === 9 && f.t < R.dash.ticks)
      f.x = f.x0 + (f.x1 - f.x0) * (f.t + 1) / R.dash.ticks;
    f.x = cap(f.x, R.stage.left, R.stage.right);
  }

  if (!(a.st === 9 && a.t < R.dash.ticks) &&
      !(b.st === 9 && b.t < R.dash.ticks)) {
    const dx = b.x - a.x;
    const overlap = R.minGap - Math.abs(dx);
    if (overlap > 0) {
      const d = dx === 0 ? a.face : sign(dx);
      const ra = d > 0 ? a.x - R.stage.left : R.stage.right - a.x;
      const rb = d > 0 ? R.stage.right - b.x : b.x - R.stage.left;
      let pa = overlap / 2, pb = overlap / 2;
      if (pa > ra) { pb += pa - ra; pa = ra; }
      if (pb > rb) { pa = Math.min(ra, pa + pb - rb); pb = rb; }
      a.x -= d * pa;
      b.x += d * pb;
    }
  }

  if (freeState(a)) face(a, b);
  if (freeState(b)) face(b, a);

  let hit0 = 0, hit1 = 0, mul0 = 1, mul1 = 1;
  for (let i = 0; i < 2; i++) {
    const f = s.f[i], o = s.f[1 - i];
    if ((f.st !== 5 && f.st !== 6) || f.hit) continue;
    const M = f.st === 5 ? R.light : R.heavy;
    const d = (o.x - f.x) * f.face;
    if (f.t >= M.startup && f.t < M.startup + M.active &&
        d > 0 && d <= M.reach && !invulnerable(o)) {
      if (i === 0) { hit0 = f.st; mul0 = counterMultiplier(o); }
      else { hit1 = f.st; mul1 = counterMultiplier(o); }
    }
  }
  if (hit0) {
    a.hit = true;
    land(s, 0, hit0, a.x > b.x ? 1 : -1, mul0);
  }
  if (hit1) {
    b.hit = true;
    land(s, 1, hit1, b.x > a.x ? 1 : -1, mul1);
  }

  for (let i = 0; i < 2; i++) {
    const f = s.f[i];
    if (f.st === 7 && f.t === R.blast.startup) {
      s.p.push({
        owner: i, x: f.x + f.face * 40,
        px: f.x, dir: f.face, dead: false
      });
    }
  }
  for (const p of s.p) {
    p.px = p.x;
    p.x += p.dir * R.blast.speed;
  }
  for (let i = 0; i < s.p.length; i++) {
    const p = s.p[i];
    for (let j = i + 1; j < s.p.length; j++) {
      const q = s.p[j];
      if (!p.dead && !q.dead && p.owner !== q.owner &&
          p.dir !== q.dir && (p.px - q.px) * (p.x - q.x) <= 0)
        p.dead = q.dead = true;
    }
  }
  for (const p of s.p) {
    if (p.dead) continue;
    const beam = s.beams[1 - p.owner];
    if (beam && inRay(beam, p.x, 8)) {
      p.dead = true;
      continue;
    }
    const o = s.f[1 - p.owner];
    if (Math.abs(o.x - p.x) > R.body &&
        (o.x - p.px) * (o.x - p.x) > 0) continue;
    if (invulnerable(o)) continue;
    p.dead = true;
    land(s, p.owner, 7, -p.dir);
  }
  for (let j = s.p.length - 1; j >= 0; j--) {
    const p = s.p[j];
    if (p.dead || p.x <= R.stage.left - 60 || p.x >= R.stage.right + 60)
      s.p.splice(j, 1);
  }

  for (let i = 0; i < 2; i++) {
    const f = s.f[i];
    if (f.st === 8 && f.t === f.su) {
      s.beams[i] = {
        owner: i, dir: f.face, from: f.x + f.face * 25,
        front: f.x + f.face * 40, hit: false
      };
    }
    if (s.beams[i] && (f.st !== 8 || f.t >= f.su + R.beam.fire))
      s.beams[i] = null;
  }
  for (let i = 0; i < 2; i++) {
    const beam = s.beams[i];
    if (!beam) continue;
    beam.front = cap(beam.front + beam.dir * R.beam.speed,
      R.stage.left - 40, R.stage.right + 40);
    const o = s.f[1 - i];
    if (!beam.hit && !invulnerable(o) && inRay(beam, o.x, R.body)) {
      beam.hit = true;
      land(s, i, 8, -beam.dir);
    }
  }

  for (const f of s.f) {
    f.t++;
    if (f.dur && f.t >= f.dur) {
      f.st = 0;
      f.t = f.dur = 0;
      f.hit = f.cancel = false;
      f.chain = f.combo = 0;
      f.next = s.tick + 1;
    }
    const g = R.kiGain.passive +
      (f.st === 4 ? R.kiGain.charge
        : f.st === 1 ? R.kiGain.forward
        : f.st === 2 ? R.kiGain.back
        : f.st === 3 ? R.kiGain.guard : 0);
    f.ki = cap(f.ki + g * (g > 0 ? rage(f) : 1), 0, R.kiMax);
  }
}

function kiValue(k) {
  return Math.min(k, 70) * 1.15 + Math.max(0, k - 70) * 0.5;
}
function restraint(a) {
  const left = Math.max(0, remaining(a));
  if (a.st === 13) return Math.min(left, 30) * 0.32;
  if (a.st >= 10 && a.st <= 12) return Math.min(left, 24) * 0.65;
  return 0;
}
function evaluate(s, original) {
  const a = s.f[0], b = s.f[1];
  const d = Math.abs(a.x - b.x);
  let value = a.hp - b.hp + kiValue(a.ki) - kiValue(b.ki);
  value += restraint(b) - restraint(a);

  if (a.hp <= 0 && b.hp > 0) value -= 1600;
  if (b.hp <= 0 && a.hp > 0) value += 1600;

  if (original.timeLeft < 360 && original.me.hp > original.opp.hp + 40) {
    value += Math.min(d, 500) * 0.045;
  } else {
    value -= Math.max(0, d - 145) * 0.025;
  }

  if (d < 150) {
    if (freeState(b) && counterMultiplier(a) > 1)
      value -= Math.min(18, Math.max(0, remaining(a))) * 0.55;
    if (freeState(a) && counterMultiplier(b) > 1)
      value += Math.min(18, Math.max(0, remaining(b))) * 0.55;
  }
  return value;
}

function rollout(root, action, mode, horizon, original) {
  const s = cloneRoot(root);
  for (let t = 0; t < horizon; t++) {
    s.tick = t;
    const a = s.f[0], b = s.f[1];

    // 先算完双方决定，再一起执行。
    const mine = t === 0 ? action
      : a.cancel || (freeState(a) && t >= a.next) ? policy(s, 0, 0) : -1;
    const theirs = b.cancel || (freeState(b) && t >= b.next)
      ? policy(s, 1, mode) : -1;

    if (mine >= 0) choose(s, 0, mine);
    if (theirs >= 0) choose(s, 1, theirs);
    advance(s);
    if (a.hp <= 0 || b.hp <= 0) break;
  }
  return evaluate(s, original);
}

function clashDecision(s) {
  const c = s.clash;
  const distance = Math.max(60, s.dist);
  const previous = memory.clash;
  let velocity = 0;
  if (previous && s.t > previous.t) {
    const average = (c.pos - previous.pos) * distance / (s.t - previous.t);
    velocity = cap(average + 0.35 * (average - previous.average), -10, 10);
  }
  const average = previous && s.t > previous.t
    ? (c.pos - previous.pos) * distance / (s.t - previous.t) : 0;
  memory.clash = { t: s.t, pos: c.pos, average };

  if (s.me.ki <= 0) return 'idle';

  const C = R.clash;
  const mr = s.me.hp < R.hp * C.rageHp ? C.rage : 0;
  const or = s.opp.hp < R.hp * C.rageHp ? C.rage : 0;
  const opponentBase = s.opp.ki > 0
    ? C.base + C.kiPower * s.opp.ki + or : C.empty + or;
  const enemyPush = c.oppPower > opponentBase + C.pushPower * 0.45;

  function futurePush(x, v, k, other) {
    if (k <= 0) return false;
    const p = x / distance;
    if (p < 0.27 && v < 1) return true;
    if (p > 0.73 && v > -1) return true;
    return distance < 300 && k > other + 22 && k > 18;
  }

  function test(firstPush) {
    let total = 0;
    const horizon = Math.min(120, C.maxTicks - c.t);
    for (let sample = 0; sample < 14; sample++) {
      let seed = (0x9e3779b9 ^ ((sample + 1) * 104729) ^ (s.t * 8191)) >>> 0;
      let x = c.pos * distance, v = velocity;
      let mk = s.me.ki, ok = s.opp.ki;
      let push = firstPush, result = 0, ended = false;

      for (let t = 0; t < horizon; t++) {
        if (t >= 6 && t % 6 === 0) push = futurePush(x, v, mk, ok);
        const mp = (mk > 0
          ? C.base + C.kiPower * mk + (push ? C.pushPower : 0)
          : C.empty) + mr;
        const op = (ok > 0
          ? C.base + C.kiPower * ok + (enemyPush ? C.pushPower : 0)
          : C.empty) + or;

        mk = Math.max(0, mk - C.drain - (push && mk > 0 ? C.pushCost : 0));
        ok = Math.max(0, ok - C.drain - (enemyPush && ok > 0 ? C.pushCost : 0));

        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const u = seed / 4294967296;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const noise = (u + seed / 4294967296 - 1) * 2.449489743 * C.noise;

        v = C.decay * v + C.drift * (mp - op) + noise;
        x += v;
        if (x <= R.body || x >= distance - R.body) {
          const win = x >= distance - R.body;
          result = win ? C.damage : -C.damage;
          if (win && s.opp.hp <= C.damage) result += 800;
          if (!win && s.me.hp <= C.damage) result -= 800;
          ended = true;
          break;
        }
      }
      if (!ended) {
        result = 150 * (x / distance - 0.5) + 3 * v;
      }
      total += result + 0.7 * (mk - ok);
    }
    return total;
  }

  return test(true) > test(false) ? 'push' : 'idle';
}

function beamOpportunity(s) {
  const a = s.me, b = s.opp, d = s.dist;
  if (a.ki < R.beam.cost) return false;

  let incoming = 1e6;
  for (const p of s.blasts)
    if (!p.mine && p.incoming) incoming = Math.min(incoming, p.eta);

  const aimed = b.state === 'beam' && b.phase !== 'recovery' &&
    (a.x - b.x) * b.facing > 0;

  if (aimed) {
    const room = b.x > a.x ? R.stage.right - b.x : b.x - R.stage.left;
    if (d < R.dash.dist - 1 && room >= R.minGap) return false;

    let impact;
    if (b.phase === 'startup') {
      const startup = b.left - R.beam.fire - R.beam.recovery;
      impact = startup + Math.max(0, Math.ceil((d - 70) / R.beam.speed) - 1);
    } else {
      impact = 0;
      for (const beam of s.beams) {
        if (!beam.mine)
          impact = Math.max(0,
            Math.ceil(((a.x - beam.front) * beam.dir - R.body) / R.beam.speed) - 1);
      }
    }

    const myRage = a.hp < R.hp * R.clash.rageHp ? 20 : 0;
    const opRage = b.hp < R.hp * R.clash.rageHp ? 20 : 0;
    const advantage = a.ki - R.beam.cost + myRage - b.ki - opRage;

    return impact >= R.beam.counterStartup &&
      incoming > R.beam.counterStartup &&
      (advantage >= 2 || a.hp <= R.beam.chip);
  }

  if (incoming <= R.beam.startup + 1 || b.state === 'dash') return false;

  if (b.state === 'blast' && b.phase === 'startup') {
    const impact = R.blast.startup - b.t +
      Math.max(0, Math.ceil((d - 70) / R.blast.speed) - 1);
    if (impact <= R.beam.startup) return false;
  }

  const resources = b.ki < 40 || a.ki >= b.ki + 24;
  if (d >= 325 && a.ki >= 65 && resources) return true;

  if (b.state === 'down' && d > 205 && b.left >= 18 && b.left <= 58) {
    const arrival = R.beam.startup +
      Math.max(0, Math.ceil((d - 70) / R.beam.speed) - 1);
    if (resources || b.left > arrival + 2) return true;
  }
  return false;
}

function decide(state) {
  const old = observe(state);
  const a = state.me, b = state.opp;

  if (state.clash) return clashDecision(state);
  memory.clash = null;

  if (a.canCancel) {
    const scale = R.combo[Math.min(b.combo, R.combo.length - 1)];
    if (state.dist <= R.light.reach && a.chain < R.light.chain) {
      if (b.hp > Math.round(R.light.damage * scale) &&
          b.hp <= Math.round(R.heavy.damage * scale))
        return 'heavy';
      return 'light';
    }
    if (state.dist <= R.heavy.reach) return 'heavy';
    return a.ki >= R.blast.cost && !a.blastOut ? 'blast' : 'heavy';
  }

  if (beamOpportunity(state)) return 'beam';

  if (state.dist > 470 && b.free &&
      !state.blasts.some(p => !p.mine && p.incoming && p.eta <= 24)) {
    if (a.ki < 96) return 'charge';
    if (state.timeLeft < 240 && a.hp > b.hp)
      return state.wallBehind > 80 ? 'back' : 'guard';
    return 'forward';
  }

  const root = makeRoot(state, old);
  const candidates = [1, 3];

  if (state.wallBehind > 2) candidates.push(2);
  if (state.dist > 155 ||
      (b.state === 'down' && b.left > 12))
    candidates.push(4);
  if (state.dist <= 145 || b.state === 'dash') candidates.push(5);
  if (state.dist <= 195 || b.state === 'dash') candidates.push(6);
  if (a.ki >= R.blast.cost && !a.blastOut) candidates.push(7);

  if (a.ki >= R.dash.cost) {
    if (state.dist < 350 || b.state === 'beam' ||
        state.blasts.some(p => !p.mine && p.incoming))
      candidates.push(9);
    if (state.wallBehind > 65 && state.dist < 320)
      candidates.push(15);
  }

  const h = memory.habits;
  const sum = h[0] + h[1] + h[2];
  const weights = [0.28, 0.72 * h[0] / sum, 0.72 * h[1] / sum, 0.72 * h[2] / sum];
  const baseHorizon = state.dist < 225 || b.state === 'down' ? 60 : 48;
  const horizon = Math.min(baseHorizon, Math.max(1, state.timeLeft));

  let best = 3, bestValue = -Infinity;
  for (const action of candidates) {
    let expected = 0, worst = Infinity;
    for (let mode = 0; mode < 4; mode++) {
      const value = rollout(root, action, mode, horizon, state);
      expected += weights[mode] * value;
      if (value < worst) worst = value;
    }
    const value = 0.84 * expected + 0.16 * worst +
      (Math.random() - 0.5) * 0.35;
    if (value > bestValue) {
      bestValue = value;
      best = action;
    }
  }
  return ACTION[best];
}
