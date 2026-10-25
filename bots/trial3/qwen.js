// Qwen 3.8 Max · qwen/qwen3.8-max-0902 · 2026-10-24T20:55:11.495Z
// === 武道家：铁拳·疾风 ===
// 策略：积极近身、连招压制、读防破防、气功牵制、大招终结

let oppHist = { guard: 0, atk: 0, blast: 0, charge: 0, beam: 0, dash: 0 };
let prevOppState = '';
let myPrevAction = '';

function decide(state) {
  const me = state.me, opp = state.opp, dist = state.dist, R = RULES;

  // 记录对手行为模式
  if (opp.state !== prevOppState) {
    if (opp.state === 'guard') oppHist.guard++;
    else if (opp.state === 'light' || opp.state === 'heavy') oppHist.atk++;
    else if (opp.state === 'blast') oppHist.blast++;
    else if (opp.state === 'charge') oppHist.charge++;
    else if (opp.state === 'beam') oppHist.beam++;
    else if (opp.state === 'dash') oppHist.dash++;
  }
  prevOppState = opp.state;
  const turtle = oppHist.guard > 3 && oppHist.guard > oppHist.atk * 1.5;

  // ===== 对冲 =====
  if (state.clash) {
    const c = state.clash;
    if (c.pos < 0.3) return 'push';
    if (me.ki <= 2) return 'idle';
    if (me.ki > opp.ki + 12) return 'push';
    if (c.pos < 0.5 && me.ki > 8) return 'push';
    if (me.ki > 30) return 'push';
    return 'idle';
  }

  // ===== 连招取消 =====
  if (me.canCancel) {
    if (me.chain < 3) return 'light';
    return 'heavy';
  }

  // ===== 对手大招正在飞行 =====
  if (state.beams.some(b => !b.mine)) {
    if (me.ki >= R.dash.cost) return 'dash_forward';
    return 'guard';
  }

  // ===== 气功波来袭 =====
  const inc = state.blasts.filter(b => b.incoming && b.eta != null);
  if (inc.length > 0) {
    const n = inc.reduce((a, b) => a.eta < b.eta ? a : b);
    if (n.eta <= 2) {
      if (me.ki >= R.dash.cost) return 'dash_forward';
      if (me.ki >= R.guardKi.blast) return 'guard';
      return 'idle';
    }
    if (n.eta <= 6) {
      if (me.ki >= R.dash.cost && Math.random() < 0.65) return 'dash_forward';
      if (me.ki >= R.guardKi.blast) return 'guard';
    }
    // eta > 6: 继续前进或准备
  }

  // ===== 对手大招起手 =====
  if (opp.state === 'beam' && opp.phase === 'startup') {
    if (me.ki >= R.beam.cost && dist > 130) return 'beam';
    if (me.ki >= R.dash.cost && dist > 80) return 'dash_forward';
    return 'forward';
  }

  // ===== 对手倒地 =====
  if (opp.state === 'down') {
    if (opp.left > 22) {
      if (me.ki < 45) return 'charge';
      if (me.ki >= R.beam.cost && dist > 140 && Math.random() < 0.35) return 'beam';
      return 'forward';
    }
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }

  // ===== 对手蓄气 =====
  if (opp.state === 'charge') {
    if (dist > R.light.reach) return 'forward';
    return 'light';
  }

  // ===== 对手硬直/格挡硬直/破防/收招中 =====
  if (opp.state === 'hitstun' || opp.state === 'blockstun' || opp.state === 'crushed' ||
      (opp.phase === 'recovery' && ['light','heavy','blast','beam','dash'].includes(opp.state))) {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }

  // ===== 对手瞬移中（无敌） =====
  if (opp.state === 'dash' && opp.phase === 'moving') {
    return 'guard';
  }

  // ===== 残局策略 =====
  if (state.timeLeft < 400) {
    if (me.hp > opp.hp + 80) {
      if (dist > R.heavy.reach) return 'back';
      if (dist > R.light.reach) return 'guard';
      return Math.random() < 0.5 ? 'guard' : 'light';
    }
    if (me.hp < opp.hp - 60) {
      if (dist > R.light.reach) return 'forward';
      return 'light';
    }
  }

  // ===== 主战斗逻辑 =====

  // 近身（轻拳范围）
  if (dist <= R.light.reach) {
    if (opp.state === 'guard') {
      if (opp.ki < 5) return 'heavy';
      if (turtle || Math.random() < 0.42) return 'heavy';
      return 'light';
    }
    if (opp.free) {
      const r = Math.random();
      if (r < 0.50) return 'light';
      if (r < 0.72) return 'heavy';
      if (r < 0.84) return 'guard';
      return 'back';
    }
    return 'light';
  }

  // 重击范围
  if (dist <= R.heavy.reach) {
    if (opp.state === 'guard') return 'heavy';
    if (opp.free) {
      return Math.random() < 0.55 ? 'forward' : 'light';
    }
    return 'forward';
  }

  // 中距离
  if (dist <= 240) {
    const r = Math.random();
    if (me.ki >= R.blast.cost && !me.blastOut && r < 0.28) return 'blast';
    if (me.ki >= R.dash.cost && r < 0.12) return 'dash_forward';
    if (me.ki < 14 && r < 0.2) return 'charge';
    return 'forward';
  }

  // 远距离
  const r = Math.random();
  if (me.ki >= R.blast.cost && !me.blastOut && r < 0.32) return 'blast';
  if (me.ki < 18 && r < 0.3) return 'charge';
  return 'forward';
}
