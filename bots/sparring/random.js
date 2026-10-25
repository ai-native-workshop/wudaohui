// 乱拳: any action at random. The floor every real bot has to clear.
const ALL = ['idle', 'forward', 'back', 'guard', 'charge', 'light', 'heavy', 'blast', 'beam', 'dash_forward', 'dash_back'];
function decide(s) {
  if (s.clash) return 'push';
  if (s.me.canCancel) return Math.random() < 0.5 ? 'light' : 'heavy';
  return ALL[Math.floor(Math.random() * ALL.length)];
}
