// 气功流: keeps away and throws blasts. Backs off when rushed, answers a blast with a blast, beams when it has the ki.
function decide(s) {
  const me = s.me;
  if (s.clash) return 'push';
  if (me.canCancel) return 'blast';
  if (s.opp.state === 'beam' && s.opp.phase === 'startup') return me.ki >= RULES.beam.cost ? 'beam' : 'guard';
  const inc = s.blasts.find(b => b.incoming);
  if (inc && inc.eta <= 6) return !me.blastOut && me.ki >= RULES.blast.cost ? 'blast' : 'guard';
  if (s.dist < 180) {
    if (me.ki >= RULES.dash.cost && s.wallBehind > 150) return 'dash_back';
    return s.dist <= RULES.light.reach ? 'light' : 'back';
  }
  if (me.ki >= RULES.beam.cost && s.dist > 300) return 'beam';
  if (!me.blastOut && me.ki >= RULES.blast.cost + 5) return 'blast';
  if (s.dist > 420) return 'charge';
  return s.wallBehind > 100 ? 'back' : 'charge';
}
