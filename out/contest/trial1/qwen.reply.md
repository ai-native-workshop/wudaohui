```js
const R = RULES;
const LIGHT = R.light;
const HEAVY = R.heavy;
const BLAST = R.blast;
const BEAM = R.beam;
const DASH = R.dash;
const CLASH = R.clash;

let mem = {
  lastT: -1,
  lastOppKey: '',
  lastOppX: null,
  oppDelta: 0,
  acts: { light: 0, heavy: 0, blast: 0, beam: 0, guard: 0, charge: 0, dash: 0 },
  nextBeam: 0,
  nextBlast: 0,
  nextDash: 0
};

function decide(state) {
  try {
    return main(state);
  } catch (e) {
    return 'guard';
  }
}

function main(s) {
  update(s);

  if (s.clash) return clashChoice(s);
  if (s.me.canCancel) return cancelChoice(s);
  if (!s.me.free) return 'idle';

  let act = defense(s);
  if (act) return act;

  act = punish(s);
  if (act) return act;

  return neutral(s);
}

function update(s) {
  const o = s.opp;

  if (mem.lastT < 0) {
    mem.lastT = s.t;
    mem.lastOppX = o.x;
    return;
  }

  mem.oppDelta = (mem.lastOppX == null) ? 0 : o.x - mem.lastOppX;

  const key = o.state + ':' + (o.phase || '');
  if (key !== mem.lastOppKey) {
    if (o.phase === 'startup' &&
        (o.state === 'light' || o.state === 'heavy' || o.state === 'blast' || o.state === 'beam')) {
      mem.acts[o.state] = (mem.acts[o.state] || 0) + 1;
    } else if (o.state === 'guard') {
      mem.acts.guard = (mem.acts.guard || 0) + 1;
    } else if (o.state === 'charge') {
      mem.acts.charge = (mem.acts.charge || 0) + 1;
    } else if (o.state === 'dash' && o.phase === 'moving') {
      mem.acts.dash = (mem.acts.dash || 0) + 1;
    }
    mem.lastOppKey = key;
  }

  mem.lastT = s.t;
  mem.lastOppX = o.x;
}

function startupRem(o) {
  if (o.phase !== 'startup') return 9999;
  if (o.state === 'light') return LIGHT.startup - o.t;
  if (o.state === 'heavy') return HEAVY.startup - o.t;
  if (o.state === 'blast') return BLAST.startup - o.t;
  if (o.state === 'beam') return BEAM.startup - o.t;
  return 9999;
}

function defense(s) {
  const me = s.me;
  const o = s.opp;

  // 已经发射的大招
  let eb = null;
  for (let i = 0; i < s.beams.length; i++) {
    if (!s.beams[i].mine) eb = s.beams[i];
  }
  if (eb) {
    const dir = eb.dir;
    const aimed = (me.x - eb.from) * dir > 0;
    const gap = (me.x - eb.front) * dir;
    if (aimed && gap > -R.body) {
      const etaBeam = gap <= R.body ? 0 : Math.ceil((gap - R.body) / BEAM.speed);
      if (o.state === 'beam' && o.phase === 'firing') {
        if (s.dist <= LIGHT.reach && etaBeam >= LIGHT.startup) return 'light';
        if (etaBeam <= 7 && me.ki >= DASH.cost) {
          if (s.dist < 180) return 'dash_forward';
          if (s.wallBehind > 150) return 'dash_back';
          return 'dash_forward';
        }
        return 'guard';
      }
    }
  }

  // 迎面来的气功波
  let inc = null;
  for (let i = 0; i < s.blasts.length; i++) {
    const b = s.blasts[i];
    if (b.incoming && b.eta != null && (!inc || b.eta < inc.eta)) inc = b;
  }
  if (inc && inc.eta <= 12) {
    if (me.ki >= DASH.cost + 5 && inc.eta <= 7 && s.dist > 180 && Math.random() < 0.35) {
      mem.nextDash = s.t + 60;
      return 'dash_forward';
    }
    return 'guard';
  }

  // 对手起手
  if (o.phase === 'startup') {
    const rem = startupRem(o);

    if (o.state === 'beam') {
      if (s.dist <= LIGHT.reach && rem > LIGHT.startup) return 'light';
      if (s.dist <= HEAVY.reach && rem > HEAVY.startup) return 'heavy';

      // 突进打断
      if (me.ki >= DASH.cost + 5 && s.dist <= 310 &&
          rem > DASH.ticks + DASH.recovery + LIGHT.startup) {
        mem.nextDash = s.t + 60;
        return 'dash_forward';
      }

      // 临射了，先闪
      if (rem <= 8 && me.ki >= DASH.cost) {
        return s.wallBehind > 120 ? 'dash_back' : 'dash_forward';
      }

      //  distant beam counter
      if (me.ki >= BEAM.cost + 15 && s.timeLeft > 120) {
        const timeToHit = rem + Math.max(0, (s.dist - 80) / BEAM.speed);
        if (timeToHit > BEAM.startup + 8) {
          mem.nextBeam = s.t + 240;
          return 'beam';
        }
      }
      return 'guard';
    }

    if (o.state === 'heavy') {
      if (s.dist <= HEAVY.reach) {
        if (s.dist <= LIGHT.reach && rem > LIGHT.startup) return 'light';
        if (me.ki >= DASH.cost + 5) {
          return s.wallBehind > 120 ? 'dash_back' : 'dash_forward';
        }
        if (s.wallBehind > 60 && s.dist + 3 * rem > HEAVY.reach + 10) return 'back';
        return 'guard';
      } else if (s.dist <= HEAVY.reach + 60 && s.wallBehind > 60) {
        return 'back';
      }
    }

    if (o.state === 'light' && s.dist <= LIGHT.reach + 20) {
      return 'guard';
    }

    if (o.state === 'blast') {
      if (s.dist <= LIGHT.reach && rem > LIGHT.startup) return 'light';
    }
  }

  // 对手瞬逼近身
  if (o.state === 'dash' && o.phase === 'moving' && mem.oppDelta != null) {
    const closing = mem.oppDelta * me.facing < -0.01;
    if (closing && s.dist < 220) return 'guard';
  }

  return null;
}

function punish(s) {
  const o = s.opp;
  const d = s.dist;

  if (o.state === 'charge') {
    if (d <= LIGHT.reach) return 'light';
    if (d <= HEAVY.reach) return 'heavy';
  }

  if (o.invulnerable) {
    if (o.state === 'down') {
      if (d <= LIGHT.reach && o.left <= 4 && Math.random() < 0.25) return 'light';
      if (d <= HEAVY.reach && o.left >= 5 && o.left <= 9 && Math.random() < 0.15) return 'heavy';
    }
    return null;
  }

  const vulnerable =
    o.state === 'hitstun' ||
    o.state === 'blockstun' ||
    o.state === 'crushed' ||
    o.state === 'recover' ||
    ((o.state === 'light' || o.state === 'heavy' || o.state === 'blast' ||
      o.state === 'beam' || o.state === 'dash') && o.phase === 'recovery');

  if (vulnerable) {
    const left = o.left;
    if (d <= LIGHT.reach && left > LIGHT.startup) return 'light';
    if (d <= HEAVY.reach && left > HEAVY.startup) return 'heavy';
  }

  if (o.phase === 'startup' && o.state !== 'beam' && o.state !== 'light') {
    const rem = startupRem(o);
    if (d <= LIGHT.reach && rem > LIGHT.startup) return 'light';
    if (d <= HEAVY.reach && rem > HEAVY.startup) return 'heavy';
  }

  return null;
}

function neutral(s) {
  const me = s.me;
  const o = s.opp;

  // 终盘落后：拼命
  if (s.timeLeft < 900 && me.hp < o.hp) {
    if (me.ki >= BEAM.cost + 10 && s.dist > 220 && s.timeLeft > 120 &&
        s.t >= mem.nextBeam && Math.random() < 0.55) {
      mem.nextBeam = s.t + 200;
      return 'beam';
    }
    if (me.ki >= DASH.cost + 5 && s.dist > 180 &&
        s.t >= mem.nextDash && Math.random() < 0.45) {
      mem.nextDash = s.t + 80