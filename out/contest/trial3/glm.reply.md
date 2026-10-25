```js
// 武道家：见招拆招，以逸待劳
function decide(s) {
  var R = RULES, me = s.me, op = s.opp, d = s.dist, ki = me.ki;

  // ---------- 对冲 ----------
  if (s.clash) {
    var c = s.clash;
    var myP = 1 + 0.02 * ki + (me.hp < 300 ? 0.4 : 0);
    if (c.pos > 0.55) return 'push';                       // 撞点逼近我，拼命
    if (myP + 0.6 > c.oppPower + 0.15 && ki > 5) return 'push';
    if (ki > op.ki + 15 && ki > 20) return 'push';         // 气多，耗得起
    return 'idle';
  }

  // ---------- 轻拳命中的取消连招 ----------
  if (me.canCancel) {
    if (d <= 130) return 'heavy';                          // 击倒收尾，最安全
    if (me.chain < 4 && d <= 105) return 'light';
    if (ki >= 14 && !me.blastOut) return 'blast';
    return 'heavy';
  }

  var oppBeam = null, inc = null, i;
  for (i = 0; i < s.beams.length; i++) if (!s.beams[i].mine) oppBeam = s.beams[i];
  for (i = 0; i < s.blasts.length; i++)
    if (s.blasts[i].incoming && (inc === null || s.blasts[i].eta < inc.eta)) inc = s.blasts[i];

  var thru = ki >= 16 && d <= 240 && s.wallAhead >= d + 80; // 可瞬移穿到对手身后
  var canBack = s.wallBehind > 70;

  // ---------- 对手大招 ----------
  if (oppBeam) {
    if (thru) return 'dash_forward';                       // 穿身躲光束
    if (ki >= 15) return 'guard';
    return 'idle';
  }
  if (op.state === 'beam' && op.phase === 'startup') {
    if (op.t <= 15 && d <= 130) return 'heavy';            // 反击打断起手
    if (op.t <= 20 && d <= 105) return 'light';
    if (thru) return 'dash_forward';
    if (ki >= 15) return 'guard';
    return canBack ? 'back' : 'forward';
  }

  // ---------- 对手气功波 ----------
  if (inc && inc.eta !== null && inc.eta <= 5) {
    if (thru) return 'dash_forward';                       // 穿波贴脸
    if (ki >= 6) return 'guard';
    if (ki >= 16 && canBack) return 'dash_back';
    return 'idle';
  }

  // ---------- 对手起手重击：抢招或撤 ----------
  if (op.state === 'heavy' && op.phase === 'startup') {
    if (op.t <= 4 && d <= 105) return 'light';             // 我更快，打断
    if (ki >= 16 && canBack) return 'dash_back';
    return canBack ? 'back' : 'forward';
  }

  // ---------- 对手被定住：连段/追击 ----------
  if (op.state === 'crushed' || op.state === 'hitstun' || op.state === 'blockstun') {
    if (op.state === 'crushed' && op.left > 26 && ki >= 50 && d < 600) return 'beam'; // 破防接大：280
    if (d <= 105) return 'light';
    if (d <= 135) return 'heavy';
    if (op.state === 'crushed' && ki >= 16 && d <= 380 && s.wallAhead >= d + 200) return 'dash_forward';
    return 'forward';
  }

  // ---------- 对手倒地：趁机蓄气、保持距离 ----------
  if (op.state === 'down') {
    if (op.left > 14) return ki < 85 ? 'charge' : 'forward';
    return d <= 115 && canBack ? 'back' : 'idle';
  }

  // ---------- 对手蓄气：重罚 ----------
  if (op.state === 'charge') {
    if (d <= 140) return 'heavy';                          // ×1.5 = 180
    if (ki >= 16 && d <= 380 && s.wallAhead >= d + 80) return 'dash_forward';
    return 'forward';
  }

  // ---------- 对手收招/起手硬直：惩罚 ----------
  if (op.phase === 'recovery' || op.phase === 'startup') {
    if (d <= 105) return 'light';
    if (d <= 135) return 'heavy';
    return 'forward';
  }

  // ---------- 对手举格挡：磨气、破防、穿后 ----------
  if (op.state === 'guard' || op.state === 'blockstun') {
    if (op.ki < 6 && ki >= 14 && !me.blastOut && d < 600) return 'blast';  // 付不起 → 破防
    if (op.ki < 4 && d <= 108) return 'light';
    if (d <= 105) return 'light';                          // 他每挡一下亏 4 气，我赚 3
    if (ki >= 16 && d <= 200 && s.wallAhead >= d + 80) return 'dash_forward';
    return 'forward';
  }

  // ---------- 中立局 ----------
  if (d <= 100) return 'light';                            // 抢轻拳，拼连段
  if (d <= 145) return 'forward';

  // 收官：领先就拖
  if (s.timeLeft < 240 && me.hp > op.hp + 50 && canBack) return 'back';

  if (ki >= 70 && d >= 250 && op.free) return 'beam';      // 气满放大奖池
  if (ki >= 40 && d >= 180 && d <= 550 && !me.blastOut && op.free && (ki > 60 || d > 300)) return 'blast';
  if (ki < 30 && d > 350 && op.free) return 'charge';
  return 'forward';
}
```

赛前宣言：见招拆招，以波会友，点到为止。