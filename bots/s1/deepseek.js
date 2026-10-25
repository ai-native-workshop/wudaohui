// DeepSeek V4 Pro · deepseek/deepseek-v4-pro-0813 · 2026-10-24T21:22:20.933Z
const R = RULES;
const BLAST_COST = R.blast.cost;
const BEAM_COST = R.beam.cost;
const DASH_COST = R.dash.cost;
const LIGHT_REACH = R.light.reach;
const HEAVY_REACH = R.heavy.reach;

function canPay(ki, action) {
  if (action === 'blast') return ki >= BLAST_COST;
  if (action === 'beam') return ki >= BEAM_COST;
  if (action === 'dash_forward' || action === 'dash_back') return ki >= DASH_COST;
  return true;
}

function decideClash(state) {
  const c = state.clash;
  const me = state.me, opp = state.opp;
  const myKi = me.ki, oppKi = opp.ki;
  const myHp = me.hp, oppHp = opp.hp;
  const rage = hp => hp < R.clash.rageHp * R.hp ? R.clash.rage : 0;
  const basePower = (ki, hp) => (ki > 0 ? R.clash.base + R.clash.kiPower * ki : R.clash.empty) + rage(hp);
  const oppBase = basePower(oppKi, oppHp);
  const myBase = basePower(myKi, myHp);
  const oppPush = c.oppPower > oppBase + 0.25;
  const myPush = c.myPower > myBase + 0.25;

  if (myPush && myKi > 15) {
    if (c.pos > 0.7 && c.oppPower < c.myPower - 0.3) return 'idle';
    return 'push';
  }
  if (oppPush) {
    if (myKi > 20) return 'push';
    return 'idle';
  }
  if (myKi > oppKi + 15 && myKi > 30 && c.pos < 0.6) return 'push';
  if (c.pos < 0.35 && myKi > 20) return 'push';
  return 'idle';
}

function decideCancel(state) {
  const me = state.me, opp = state.opp;
  const chain = me.chain;
  const dist = state.dist;

  if (chain < 3 && dist <= 115 && opp.state === 'hitstun' && opp.left >= 6) {
    return 'light';
  }
  if (dist <= HEAVY_REACH) {
    return 'heavy';
  }
  if (chain < R.light.chain) {
    return 'light';
  }
  return 'blast';
}

function decideFree(state) {
  const me = state.me, opp = state.opp;
  const dist = state.dist;
  const myKi = me.ki, oppKi = opp.ki;
  const myHp = me.hp, oppHp = opp.hp;
  const oppPhase = opp.phase;
  const incBlast = state.blasts.find(b => b.incoming);

  // 1. Opponent beam
  if (opp.state === 'beam') {
    if (oppPhase === 'startup') {
      if (dist <= LIGHT_REACH && opp.t < 18) return 'light';
      if (myKi >= BEAM_COST) return 'beam';
      if (myKi >= DASH_COST) return 'dash_back';
      return 'back';
    }
    if (oppPhase === 'firing') {
      const oppBeam = state.beams.find(b => !b.mine);
      if (oppBeam) {
        const lo = Math.min(oppBeam.from, oppBeam.front) - R.body;
        const hi = Math.max(oppBeam.from, oppBeam.front) + R.body;
        if (me.x >= lo && me.x <= hi) {
          if (myKi >= R.guardKi.beam) return 'guard';
          if (myKi >= DASH_COST) return 'dash_back';
          return 'back';
        }
      }
      if (myKi >= DASH_COST) return 'dash_back';
      return 'back';
    }
    if (oppPhase === 'recovery') {
      if (dist <= LIGHT_REACH) return 'light';
      if (dist <= HEAVY_REACH) return 'heavy';
      return 'forward';
    }
  }

  // 2. Incoming blast
  if (incBlast) {
    if (myKi >= R.guardKi.blast) return 'guard';
    if (myKi >= DASH_COST) return 'dash_forward';
    return 'back';
  }

  // 3. Vulnerable states
  if (opp.state === 'crushed') {
    if (dist <= LIGHT_REACH) return 'light';
    if (dist <= HEAVY_REACH) return 'heavy';
    if (dist > 200 && myKi >= DASH_COST) return 'dash_forward';
    return 'forward';
  }
  if (opp.state === 'hitstun' || opp.state === 'blockstun') {
    if (dist <= LIGHT_REACH) return 'light';
    if (dist <= HEAVY_REACH) return 'heavy';
    if (dist > 180 && myKi >= DASH_COST) return 'dash_forward';
    return 'forward';
  }
  if (opp.state === 'down') {
    if (opp.left > 20) {
      if (myKi < 85) return 'charge';
      if (dist > 130) return 'forward';
      return 'idle';
    } else {
      if (dist > 140 && opp.left <= 12 && myKi >= DASH_COST) return 'dash_forward';
      if (dist <= HEAVY_REACH && opp.left <= 12) return 'heavy';
      if (dist <= LIGHT_REACH && opp.left <= 6) return 'light';
      if (dist > 140) return 'forward';
      return 'idle';
    }
  }

  // 4. Counter opportunities
  if (['light', 'heavy', 'blast', 'dash'].includes(opp.state)) {
    if (oppPhase === 'startup') {
      if (dist <= LIGHT_REACH) {
        if (opp.state === 'heavy' && opp.t < 5) return 'light';
        if (opp.state === 'blast' && opp.t < 7) return 'light';
        if (opp.state === 'light' && opp.t < 2) return 'light';
      }
    } else if (oppPhase === 'recovery') {
      if (dist <= LIGHT_REACH) return 'light';
      if (dist <= HEAVY_REACH) return 'heavy';
      return 'forward';
    } else if (opp.state === 'dash' && oppPhase === 'moving') {
      if (dist <= LIGHT_REACH && opp.t >= R.dash.invuln) return 'light';
      return 'back';
    }
  }

  // 5. Neutral
  if (dist > 160) {
    if (opp.state === 'charge') {
      if (myKi >= BLAST_COST && !me.blastOut) return 'blast';
      return 'forward';
    }
    if (myKi < 70) return 'charge';
    if (!me.blastOut && myKi >= BLAST_COST) return 'blast';
    return 'forward';
  }

  if (dist > 140) {
    if (opp.state === 'charge') return 'dash_forward';
    if (myKi < 40) return 'charge';
    if (!me.blastOut && myKi >= BLAST_COST) return 'blast';
    return 'forward';
  }

  if (dist > LIGHT_REACH) {
    if (opp.state === 'charge') return 'heavy';
    if (opp.state === 'guard') return 'heavy';
    if (oppKi < 4) return 'blast';
    if (myKi < 25) return 'forward';
    return Math.random() < 0.35 ? 'heavy' : 'forward';
  }

  // Close range
  if (opp.state === 'charge') return 'light';
  if (opp.state === 'guard') {
    if (Math.random() < 0.6) return 'heavy';
    return 'light';
  }
  if (oppKi < 4) return 'light';
  if (oppHp < 120) return Math.random() < 0.7 ? 'heavy' : 'light';

  const r = Math.random();
  if (r < 0.5) return 'light';
  if (r < 0.75) return 'heavy';
  if (r < 0.88) return 'back';
  if (r < 0.95 && myKi >= DASH_COST) return 'dash_forward';
  return 'guard';
}

function decide(state) {
  if (state.clash) return decideClash(state);
  if (state.me.canCancel) return decideCancel(state);
  if (!state.me.free) return 'idle';
  return decideFree(state);
}
