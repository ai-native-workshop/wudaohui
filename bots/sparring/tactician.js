// 战术家: every answer in the book. Interrupts a beam up close and meets it with a beam from afar, dashes through blasts,
// punishes recoveries and charging, crushes a guard from just outside light-punch range. The reference for a careful bot.
function decide(s) {
  const me = s.me, op = s.opp, d = s.dist, L = RULES.light, H = RULES.heavy, Bl = RULES.blast, B = RULES.beam, D = RULES.dash;
  if (s.clash) return me.ki > 2 ? 'push' : 'idle';
  if (me.canCancel) return me.chain < 3 && d <= L.reach - 15 ? 'light' : op.hp <= 220 && me.ki >= B.cost ? 'beam' : 'heavy';
  const roomBehindOpp = op.facing > 0 ? op.x - RULES.stage.left : RULES.stage.right - op.x;
  if (op.state === 'beam' && op.phase === 'startup') {
    const left = B.startup - op.t;
    if (d <= L.reach && left > L.startup) return 'light';
    if (me.ki >= B.cost) return 'beam';
    if (me.ki >= D.cost && d + RULES.minGap <= D.dist && roomBehindOpp > RULES.minGap + 5) return 'dash_forward';
    return 'guard';
  }
  if (op.state === 'beam' && op.phase === 'firing') return 'guard';
  const inc = s.blasts.find(b => b.incoming);
  if (inc && inc.eta <= 4) return me.ki >= D.cost + 15 && d < 420 ? 'dash_forward' : 'guard';
  const opening = op.state === 'crushed' || op.state === 'charge' || (op.phase === 'recovery' && op.left > L.startup) || (op.state === 'heavy' && op.phase === 'startup');
  if (d <= L.reach && opening) return 'light';
  if (d > L.reach && d <= H.reach && (op.state === 'guard' || op.state === 'charge')) return 'heavy';
  if (d <= L.reach && op.state === 'light' && op.phase === 'startup') return 'guard';
  if (d > 420) return me.ki >= B.cost + 20 || (me.ki >= B.cost && (op.state === 'charge' || op.phase === 'recovery')) ? 'beam' : me.ki < 90 ? 'charge' : 'forward';
  if (d > H.reach) return !me.blastOut && me.ki >= Bl.cost + D.cost && d > 260 && Math.random() < 0.3 ? 'blast' : 'forward';
  if (d > L.reach) return Math.random() < 0.5 ? 'forward' : 'guard';
  const r = Math.random();
  return r < 0.45 ? 'light' : r < 0.8 ? 'guard' : 'back';
}
