// GLM-5.3 · z-ai/glm-5.3 · 2026-10-24T20:21:21.813Z
// 武道会参赛程序：均衡立回 + 连招取消 + 破防压制
var crushedCount = 0, lastCrushT = -999, prevOpX = null, prevT = -1;

function decide(s) {
  var me = s.me, op = s.opp, d = s.dist, ki = me.ki;

  if (me.state === 'crushed' && s.t - lastCrushT > 30) { crushedCount++; lastCrushT = s.t; }

  // 对冲：优势或危急时加力
  if (s.clash) {
    var c = s.clash;
    if (ki > 3 && (c.pos < 0.42 || c.myPower + 0.55 > c.oppPower)) return 'push';
    return 'idle';
  }

  // 轻拳命中后的取消窗口：连段收尾
  if (me.canCancel) {
    if (d <= 138) return 'heavy';
    if (me.chain < 4 && d <= 108) return 'light';
    if (ki >= 20 && !me.blastOut) return 'blast';
    return 'idle';
  }

  var opApproach = false;
  if (prevT >= 0 && s.t > prevT) {
    var mv = (op.x - prevOpX) * (me.x >= op.x ? 1 : -1);
    opApproach = mv > (s.t - prevT) * 2;
  }
  prevOpX = op.x; prevT = s.t;

  // 对手大招起手：打断或穿背后惩罚
  if (op.state === 'beam' && op.phase === 'startup') {
    if (d <= 108) return 'light';
    if (d <= 135 && op.t <= 16) return 'heavy';
    if (ki >= 10) return 'dash_forward';
    return 'guard';
  }

  // 对手大招光束逼近：穿过射手脱身
  var eb = null;
  for (var i = 0; i < s.beams.length; i++) if (!s.beams[i].mine) eb = s.beams[i];
  if (eb) {
    var rem = (me.x - eb.front) * eb.dir;
    if (rem > 0 && rem <= 200) {
      if (ki >= 10 && d <= 430) return 'dash_forward';
      return 'guard';
    }
  }

  // 来袭气功波：无敌穿越或格挡
  var inc = null;
  for (var j = 0; j < s.blasts.length; j++) {
    var b = s.blasts[j];
    if (b.incoming && b.eta != null && (!inc || b.eta < inc.eta)) inc = b;
  }
  if (inc && inc.eta <= 7) {
    if (ki >= 10 && d >= 180 && d <= 330 && (!op.free || d >= 200)) return 'dash_forward';
    return 'guard';
  }

  // 对手重击起手：撤步躲开
  if (op.state === 'heavy' && op.phase === 'startup') {
    if (d <= 150) { if (ki >= 10) return 'dash_back'; return 'guard'; }
    return 'back';
  }

  // 对手气功波起手：抢招打断或穿波反打
  if (op.state === 'blast' && op.phase === 'startup') {
    if (d <= 108) return 'light';
    if (ki >= 10 && d <= 320) return 'dash_forward';
    return 'guard';
  }

  // 对手突进过来：保持在其正面
  if (op.state === 'dash' && op.phase === 'moving' && opApproach && d <= 250 && ki >= 10) return 'dash_back';

  // 惩罚窗口
  var pun = false, hvy = false;
  if (op.state === 'crushed') { pun = true; hvy = true; }
  else if (op.state === 'recover') { pun = true; hvy = true; }
  else if (op.state === 'blockstun' && op.left >= 10) { pun = true; hvy = true; }
  else if (op.state === 'hitstun' && op.left >= 8) { pun = true; hvy = true; }
  else if (op.state === 'dash' && op.phase === 'recovery') pun = true;
  else if ((op.state === 'light' || op.state === 'heavy' || op.state === 'blast' || op.state === 'beam') && op.phase === 'recovery') pun = true;
  if (pun) {
    if (hvy && d <= 138) return 'heavy';
    if (d <= 108) return 'light';
    if (d <= 330 && ki >= 10 && (op.left === 0 || op.left >= 12)) return 'dash_forward';
  }

  // 对手蓄气：重击或远程狙击（蓄气挨打×1.5）
  if (op.state === 'charge') {
    if (d <= 138) return 'heavy';
    if (ki >= 20 && !me.blastOut) return 'blast';
  }

  // 对手缩在格挡里：破防
  if (op.state === 'guard' && d <= 135 && op.t >= 5) return 'heavy';

  // 对手出轻拳：格挡，憋久了就反击一拳
  if (op.state === 'light' && op.phase !== 'recovery' && d <= 112) {
    if (me.state === 'guard' && me.t >= 24 && d <= 108) return 'light';
    return 'guard';
  }

  // 被逼到墙角：穿身换边
  if (s.wallBehind < 90 && d >= 120 && d <= 260 && ki >= 10 && op.free) return 'dash_forward';

  // 残局时间管理
  if (s.timeLeft < 420) {
    if (me.hp < op.hp) {
      if (ki >= 50 && op.hp <= 260 && d >= 150) return 'beam';
      if (ki >= 20 && !me.blastOut && d >= 150) return 'blast';
      return 'forward';
    }
    if (me.hp > op.hp && d < 420) return 'back';
  }

  // 擦伤斩：对手血量低于大招格挡擦伤，哪怕挡住也死
  if (op.hp <= 112 && ki >= 50 && d <= 800 && op.state !== 'down' && (d >= 300 || !op.free)) return 'beam';

  // 近身中立：轻拳立回为主
  if (d <= 115) {
    if (op.state === 'down' && d < 140) return 'back';
    var r = Math.random();
    if (crushedCount >= 2 && r < 0.4) return 'back';
    if (r < 0.55) return 'light';
    if (r < 0.8) return 'guard';
    return 'back';
  }

  // 对手倒地：拉开或蓄气
  if (op.state === 'down') {
    if (d < 140) return 'back';
    if (ki < 95) return 'charge';
    return 'forward';
  }

  // 远程压制与资源
  if (ki >= 55 && !me.blastOut && d >= 220 && d <= 750 && Math.random() < 0.35) return 'blast';
  if (ki >= 50 && op.hp <= 320 && d <= 700 && Math.random() < 0.3) return 'beam';
  if (d > 500 && ki < 99) return 'charge';
  return 'forward';
}
