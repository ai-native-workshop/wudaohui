// 见招拆招: reads the opponent's move and answers with what beats it. A beam meets a beam, or a dash through, or a guard;
// a heavy's windup eats a light punch; a long guard eats a heavy.
function decide(s) {
  const me = s.me, op = s.opp, d = s.dist, L = RULES.light, H = RULES.heavy, B = RULES.beam, D = RULES.dash;
  if (s.clash) return me.ki > 3 ? 'push' : 'idle';
  if (me.canCancel) return me.chain < 2 ? 'light' : 'heavy';
  if (op.state === 'beam' && op.phase === 'startup') {
    if (me.ki >= B.cost) return 'beam';
    const roomBehind = op.facing > 0 ? op.x - RULES.stage.left : RULES.stage.right - op.x;   // the far side of the opponent, seen from me
    if (me.ki >= D.cost && d < D.dist - RULES.minGap && roomBehind > RULES.minGap + 10) return 'dash_forward';
    return 'guard';
  }
  if (op.state === 'beam' && op.phase === 'firing') return 'guard';
  const inc = s.blasts.find(b => b.incoming);
  if (inc && inc.eta <= 5) return 'guard';
  if (d <= L.reach && (op.phase === 'recovery' || op.state === 'crushed' || op.state === 'charge')) return 'light';
  if (d <= L.reach && op.state === 'heavy' && op.phase === 'startup') return 'light';
  if (d <= L.reach + 10 && op.state === 'light' && op.phase === 'startup') return 'guard';
  if (d <= H.reach && op.state === 'guard' && op.t >= 6) return 'heavy';
  if (d > 350) return me.ki >= B.cost ? 'beam' : 'charge';
  if (d > L.reach) return 'forward';
  const r = Math.random();
  return r < 0.45 ? 'light' : r < 0.75 ? 'guard' : 'heavy';
}
