// 龟缩: guards and waits for a mistake. Punishes a recovery, charges when the opponent is far, fires a beam when full.
function decide(s) {
  const me = s.me, op = s.opp, L = RULES.light;
  if (s.clash) return me.ki > 5 ? 'push' : 'idle';
  if (me.canCancel) return me.chain < 2 ? 'light' : 'heavy';
  if (op.state === 'beam' && op.phase === 'startup' && me.ki >= RULES.beam.cost) return 'beam';
  if (s.blasts.some(b => b.incoming && b.eta <= 8) || (op.state === 'beam' && op.phase !== 'recovery')) return 'guard';
  if (s.dist <= L.reach && (op.phase === 'recovery' || op.state === 'crushed')) return 'light';
  if (s.dist <= L.reach && op.state === 'heavy' && op.phase === 'startup') return 'light';
  if (s.dist > 380 && op.state !== 'blast') return me.ki >= RULES.beam.cost ? 'beam' : 'charge';
  return 'guard';
}
