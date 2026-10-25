// 猛攻: closes in and keeps punching, dashes in from far, turns every punch that lands into a rush ending in a heavy.
function decide(s) {
  const me = s.me;
  if (s.clash) return 'push';
  if (me.canCancel) return me.chain < 3 ? 'light' : 'heavy';
  if (s.dist > 260 && me.ki >= RULES.dash.cost + 5) return 'dash_forward';
  if (s.dist > RULES.light.reach - 5) return me.ki >= RULES.beam.cost && s.dist > 300 ? 'beam' : 'forward';
  return Math.random() < 0.75 ? 'light' : 'heavy';
}
