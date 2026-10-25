// MiniMax M3.1 Flash · minimax/minimax-m3.1-flash · 2026-10-24T20:55:11.521Z
/* ============================================================
   AI 武道会 · 第 1 季 —— 选手程序
   风格：轻拳起手连段 → 重击收尾 knockdown；气功波/大招只做
   高价值窗口；气不够就走路蓄气；对面放大招优先闪避或打断。
   ============================================================ */

let _prevOpp = null;   // 上一帧对手位置，用来判断对方是在靠近还是远离

/* ---------------- 工具函数 ---------------- */

// 对手（beam）起手阶段还剩多少 tick 才会发射
function oppStartLeft(state) {
  return state.opp.left - 60;
}

// 是否可以穿过对手、落到他背后（用来躲大招）
function dashBehindOk(state) {
  const R = RULES, o = state.opp, d = state.dist;
  if (d > 142) return false;
  const room = o.facing > 0 ? o.x - R.stage.left : R.stage.right - o.x;
  const need = Math.max(R.minGap, R.dash.dist - d) + 10;
  return room >= need;
}

// 对方靠近速度（>0 表示正在靠近我）
function closingRate(state) {
  const o = state.opp, m = state.me;
  const p = _prevOpp;
  _prevOpp = { t: state.t, x: o.x };
  if (!p || state.t <= p.t) return 0;
  const dt = state.t - p.t;
  const dir = (o.x - m.x) >= 0 ? 1 : -1;
  return -(dir * (o.x - p.x)) / dt;
}

// 对冲时的力量
function clashPower(ki, hp, pushing) {
  const C = RULES.clash;
  let p = ki > 0 ? C.base + C.kiPower * ki : C.empty;
  if (pushing && ki > 0) p += C.pushPower;
  if (hp < C.rageHp * RULES.hp) p += C.rage;
  return p;
}

/* ---------------- 对冲 ---------------- */
function clashChoice(state) {
  const me = state.me;
  const oppP = state.clash.oppPower;
  const mine = clashPower(me.ki, me.hp, false);
  const minePush = clashPower(me.ki, me.hp, true);
  // 加力后仍强于对方才加力，否则保留气
  if (me.ki >= 8 && minePush > oppP + 0.02) return 'push';
  return 'idle';
}

/* ---------------- 连招取消窗口 ---------------- */
function cancelChoice(state) {
  const me = state.me, d = state.dist;
  const chain = me.chain | 0;
  // 1、2 连之后：距离还够就继续轻拳攒连段
  if (chain <= 2) {
    if (d <= 110) return 'light';
    if (d <= 140) return 'heavy';
    if (d <= 200 && me.ki >= 30) return 'blast';
    return 'idle';
  }
  // 第 3 记之后：重击收尾（击倒），距离不够才用气功波
  if (d <= 140) return 'heavy';
  if (d <= 210 && me.ki >= 30) return 'blast';
  return 'idle';
}

/* ---------------- 主决策 ---------------- */
function decide(state) {
  const R = RULES;
  const me = state.me, opp = state.opp, d = state.dist;

  if (state.clash) return clashChoice(state);
  if (me.canCancel) return cancelChoice(state);

  const closing = closingRate(state);
  const blast = state.blasts.find(b => !b.mine && b.incoming);
  const oppDown = opp.state === 'down';
  const oppStun = opp.state === 'hitstun' || opp.state === 'blockstun' || opp.state === 'crushed';
  const oppGuard = opp.state === 'guard';
  const oppCharge = opp.state === 'charge';
  const oppMove = !opp.free && !oppDown && !oppStun;   // 出招 / 收招
  const oppBeam = opp.state === 'beam' && opp.phase !== 'recovery';
  const aimedAtMe = oppBeam && (me.x - opp.x) * opp.facing > 0;

  /* 1. 对面的大招 —— 闪避 > 打断 > 对冲 > 硬扛 */
  if (aimedAtMe) {
    if (opp.phase === 'startup') {
      const rem = oppStartLeft(state);
      if (me.ki >= 16 && dashBehindOk(state)) return 'dash_forward';   // 穿到背后白嫖
      if (rem >= 14 && d <= 138) return 'heavy';                        // 重击打断（×1.25）
      if (rem >= 9 && d <= 108) return 'light';                         // 轻拳打断
      if (me.ki >= 50 && rem >= 12) return 'beam';                      // 迎击对冲
      return 'guard';
    }
    // 已经在发射
    if (me.ki >= 16 && dashBehindOk(state)) return 'dash_forward';
    return 'guard';
  }

  /* 2. 对面的气功波来袭 */
  if (blast) {
    if (blast.eta !== null && blast.eta <= 6 && me.ki >= 16) return 'dash_back';
    return 'guard';
  }

  /* 3. 对面重击起手 —— 能打断就打断，否则拉开 */
  if (opp.state === 'heavy' && opp.phase === 'startup' && d <= 140) {
    if (d <= 108) return 'light';
    if (me.ki >= 16) return 'dash_back';
    return 'back';
  }

  /* 4. 对面倒地 / 硬直：安全窗口用来蓄气或贴近 */
  if (oppDown || oppStun) {
    if (d > 108) return 'forward';
    if (opp.left > 30 && me.ki < 55) return 'charge';
    if (oppDown) return 'idle';
    if (d <= 108) return 'light';
    if (d <= 138) return 'heavy';
    return 'forward';
  }

  /* 5. 近身 */
  if (d <= 140) {
    if (oppGuard) return 'heavy';     // 破防
    if (oppCharge) return 'heavy';    // 打蓄气 ×1.5
    if (oppMove) return 'heavy';      // 反击起手/收招 ×1.25
    if (d <= 110) return 'light';     // 轻拳起连段
    return 'heavy';
  }

  /* 6. 远距离 */
  if (oppCharge && d <= 300 && me.ki >= 30) return 'blast';   // 蓄气的对手好打
  if (me.ki >= 50 && d >= 260) return 'beam';                 // 远距离大招
  if (me.ki < 55 && d > 190 && closing < 2 && !oppCharge) return 'charge';
  if (d > 300 && me.ki >= 20 && !oppCharge) return 'dash_forward';
  return 'forward';
}
