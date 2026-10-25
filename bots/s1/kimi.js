// Kimi K3.1 Pro · moonshotai/kimi-k3.1-pro · 2026-10-24T21:22:20.933Z
function decide(s) {
  const R = RULES, me = s.me, o = s.opp, d = s.dist;
  const cross = d < R.dash.dist && s.wallAhead - d >= R.minGap - 1;
  const blastEta = x => R.blast.startup +
    (x <= 83 ? 0 : Math.ceil((x - 83) / R.blast.speed));
  const beamEta = x => R.beam.startup +
    Math.max(0, Math.ceil((x - 70) / R.beam.speed));

  if (s.clash || me.state === 'clash') {
    const c = s.clash;
    if (me.ki <= 0.05) return 'idle';
    if (c && (c.pos < 0.18 || c.pos > 0.70)) return 'push';
    return me.ki > 7 ? 'push' : 'idle';
  }

  if (me.canCancel) {
    if (me.chain < R.light.chain && d <= R.light.reach) return 'light';
    if (d <= R.heavy.reach) return 'heavy';
    if (me.ki >= R.blast.cost && !me.blastOut) return 'blast';
    return 'idle';
  }

  let beamDanger = false, incomingBeamEta = 999;
  for (const b of s.beams) {
    if (b.mine || (me.x - b.from) * b.dir < -R.body) continue;
    const gap = (me.x - b.front) * b.dir;
    if (gap > -R.body) {
      beamDanger = true;
      incomingBeamEta = Math.min(incomingBeamEta,
        Math.max(0, Math.ceil((gap - R.body) / R.beam.speed)));
    }
  }
  if (beamDanger) {
    if (cross && me.ki >= R.dash.cost) return 'dash_forward';
    if (me.ki >= R.beam.cost && incomingBeamEta > R.beam.counterStartup &&
        me.ki - R.beam.cost > o.ki + 20) return 'beam';
    return 'guard';
  }

  if (o.state === 'heavy' && o.phase !== 'recovery') {
    if (d <= R.heavy.reach) {
      if (o.phase === 'startup' && o.t <= 3 && d <= R.light.reach)
        return 'light';
      if (me.ki >= R.dash.cost) {
        if (cross) return 'dash_forward';
        return 'dash_back';
      }
      return 'guard';
    }
    if (d < 190) return 'guard';
  }

  let blastIn = 999;
  for (const b of s.blasts)
    if (b.incoming && b.eta !== null) blastIn = Math.min(blastIn, b.eta);
  if (blastIn <= 6) return 'guard';

  if (o.state === 'light' && o.phase !== 'recovery') {
    if (d <= R.light.reach) return 'guard';
    if (d <= R.heavy.reach) return 'heavy';
    if (d < 160) return 'idle';
  }

  if (o.state === 'beam' && o.phase === 'startup') {
    const left = Math.max(0, o.left - R.beam.fire - R.beam.recovery);
    if (d <= R.heavy.reach && left >= R.heavy.startup) return 'heavy';
    if (d <= R.light.reach && left >= R.light.startup) return 'light';
    if (cross && me.ki >= R.dash.cost) return 'dash_forward';
    if (me.ki >= R.blast.cost && !me.blastOut && blastEta(d) <= left)
      return 'blast';
    if (me.ki >= R.beam.cost && me.ki - R.beam.cost > o.ki + 20)
      return 'beam';
    return 'guard';
  }

  if (o.state === 'blast' && o.phase === 'startup' && d <= R.heavy.reach) {
    const release = R.blast.startup - o.t;
    if (d <= R.light.reach && release >= R.light.startup) return 'light';
    if (release >= R.heavy.startup) return 'heavy';
    return 'guard';
  }

  if (o.state === 'dash' && o.phase === 'moving' && d < 220)
    return 'guard';

  if (o.state === 'down') {
    if (d <= R.heavy.reach) {
      if (o.left <= 12) return 'heavy';
      return me.ki < 95 ? 'charge' : 'idle';
    }
    if (d > 240 && o.left > 20 && me.ki >= 40) return 'dash_forward';
    if (d > 350 && o.left > 20 && me.ki < 20) return 'charge';
    return 'forward';
  }

  const recovery = (o.state === 'light' || o.state === 'heavy' ||
    o.state === 'blast' || o.state === 'beam' || o.state === 'dash') &&
    o.phase === 'recovery';
  const helpless = o.state === 'hitstun' || o.state === 'crushed' ||
    o.state === 'recover' || recovery ||
    (o.state === 'beam' && o.phase === 'firing');

  if (helpless) {
    if (o.state === 'crushed' && me.ki >= R.beam.cost &&
        beamEta(d) < o.left) return 'beam';
    if (d <= R.heavy.reach && o.left > R.heavy.startup) return 'heavy';
    if (d <= R.light.reach && o.left > R.light.startup) return 'light';
    if (d > R.heavy.reach && me.ki >= R.blast.cost && !me.blastOut &&
        blastEta(d) < o.left) return 'blast';
    if (d <= R.heavy.reach && o.left <= R.heavy.startup) return 'guard';
    return 'forward';
  }

  if (o.state === 'guard' && d <= R.heavy.reach)
    return Math.random() < 0.86 ? 'heavy' : 'guard';
  if (o.state === 'charge' && d <= R.heavy.reach) return 'heavy';

  const protect = s.timeLeft < 420 && me.hp > o.hp + 60;
  if (protect && d < 180)
    return s.wallBehind > 30 ? 'back' : 'guard';

  const lightRange = R.light.reach + (o.state === 'forward' ? 20 : 0) -
    (o.state === 'back' ? 12 : 0);
  const heavyRange = R.heavy.reach + (o.state === 'forward' ? 35 : 0) -
    (o.state === 'back' ? 24 : 0);

  if (d <= heavyRange || d < 165) {
    const r = Math.random();
    if (d <= lightRange) {
      if (o.state === 'forward') {
        if (r < 0.42) return 'guard';
        if (r < 0.76) return 'light';
        return 'heavy';
      }
      if (r < 0.40) return 'light';
      if (r < 0.68) return 'heavy';
      return 'guard';
    }
    if (d <= heavyRange) {
      if (r < 0.52) return 'heavy';
      if (r < 0.78) return 'guard';
      return 'forward';
    }
    return 'forward';
  }

  if (o.state === 'charge' && me.ki >= R.blast.cost && !me.blastOut)
    return 'blast';

  const beamSafe = d > 230 && me.ki >= R.beam.cost &&
    (o.ki < 45 || me.ki - R.beam.cost > o.ki + 20);
  if (beamSafe && !protect &&
      (o.state === 'guard' || o.state === 'charge' || o.hp <= R.beam.chip) &&
      Math.random() < (o.hp <= R.beam.chip ? 0.55 : 0.20))
    return 'beam';

  if (protect)
    return s.wallBehind > 20 ? 'back' : 'guard';

  if (me.ki >= 28 && !me.blastOut && d > 190 && Math.random() < 0.44)
    return 'blast';

  if (d > 300 && o.state !== 'forward' &&
      (me.ki < 14 || (d > 380 && me.ki < 60 && Math.random() < 0.35)))
    return 'charge';

  return 'forward';
}
