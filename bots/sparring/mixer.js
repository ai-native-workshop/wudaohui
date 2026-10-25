// 心理战: walks in and, up close, mixes punches, heavies, guards and dashes at random so it cannot be read.
const MIX = [['light', 4], ['heavy', 2], ['guard', 3], ['dash_back', 1], ['dash_forward', 1]];
const TOTAL = MIX.reduce((n, [, w]) => n + w, 0);
function pick() { let r = Math.random() * TOTAL; for (const [a, w] of MIX) if ((r -= w) < 0) return a; return 'guard'; }
let plan = null, until = 0;
function decide(s) {
  const me = s.me;
  if (s.clash) return Math.random() < 0.8 ? 'push' : 'idle';
  if (me.canCancel) return Math.random() < 0.5 ? 'light' : 'heavy';
  if (s.blasts.some(b => b.incoming && b.eta <= 6)) return Math.random() < 0.5 ? 'guard' : 'dash_forward';
  if (s.dist > 300) return me.ki >= RULES.beam.cost && Math.random() < 0.3 ? 'beam' : me.ki < 40 ? 'charge' : 'forward';
  if (s.dist > RULES.heavy.reach) return 'forward';
  if (s.t >= until) { plan = pick(); until = s.t + 12; }        // hold a choice for 0.2 s
  return plan;
}
