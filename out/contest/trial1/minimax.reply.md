```js
/* =========================================================
   AI 武道会 · 第 1 季 · 选手程序
   风格：贴身三连轻拳接重击、专打起手/收招、破防、掐气功波与
   大招起手、瞬移穿背闪避、对冲时拼气。
   ========================================================= */
const R = RULES;

function decide(state) {
  try {
    if (!state || !state.me || !state.opp) return 'idle';
    if (state.clash) return pickClash(state);
    if (state.me.canCancel) return pickCancel(state);
    return pickFree(state);
  } catch (e) {
    return 'idle';
  }
}

/* ---------------- 工具 ---------------- */

// 场上飞向我的气功波，最早还有几 tick 到
function incomingEta(s) {
  let best = null;
  const bl = s.blasts || [];
  for (let i = 0; i < bl.length; i++) {
    const b = bl[i];
    if (b.incoming && b.eta !== null && b.eta !== undefined && (best === null || b.eta < best)) best = b.eta;
  }
  return best;
}

// dash_forward 落点会不会绕到对手背后（绕背 = 对手的正面招式全打空）
function dashBehind(me, op) {
  const d = me.facing;
  let x = me.x + d * R.dash.dist;
  const before = (op.x - me.x) * d, after = (op.x - x) * d;
  if (before > 0 && after < R.minGap) {
    const behind = op.x + d * Math.max(R.minGap, -after);
    if (after <= -R.minGap && behind >= R.stage.left && behind <= R.stage.right) x = behind;
    else if (op.x + d * R.minGap >= R.stage.left && op.x + d * R.minGap <= R.stage.right && after < 0) x = op.x + d * R.minGap;
    else x = op.x - d * R.minGap;
  }
  x = Math.max(R.stage.left, Math.min(R.stage.right, x));
  return (x - op.x) * d >= R.minGap * 0.9;
}

function clashBase(ki, hp) {
  let p = ki > 0 ? R.clash.base + R.clash.kiPower * ki : R.clash.empty;
  if (hp < R.clash.rageHp * R.hp) p += R.clash.rage;
  return p;
}

/* ---------------- 对冲 ---------------- */
function pickClash(s) {
  const me = s.me, op = s.opp, c = s.clash;
  const myBase = clashBase(me.ki, me.hp);
  const opBase = clashBase(op.ki, op.hp);
  const opEff = c.oppPower;                 // 已含对方是否加力
  const oppPushing = (opEff - opBase) > 0.25;
  if (me.ki > 30) {
    // 只有在「不占优」或「对方在加力」时才烧气加力
    if (oppPushing || myBase < opEff + 0.45) {
      if (myBase + R.clash.pushPower >= opEff - 0.05) return 'push';
    }
  }
  return 'idle';
}

/* ---------------- 连招取消窗口 ---------------- */
function pickCancel(s) {
  const me = s.me, op = s.opp, d = s.dist;

  // 对手被破防后僵直很久：赌一发大招
  if (op.state === 'crushed' && op.left >= 30 && me.ki >= R.beam.cost && op.ki < 22 && d >= 120) return 'beam';

  // 轻拳接轻拳接轻拳接重击：伤害系数递减但总伤最高，还带击倒
  if (me.chain < 3 && d <= R.light.reach) return 'light';
  if (d <= R.heavy.reach) return 'heavy';

  // 够不着重击时，气功波也许能追上硬直
  if (me.ki >= R.blast.cost && d <= 300 && (op.state === 'crushed' || op.state === 'hitstun')) {
    const travel = Math.max(0, (d - 40) / R.blast.speed);
    if (R.blast.startup + travel <= op.left + 4) return 'blast';
  }
  return 'idle';
}

/* ---------------- 自由行动 ---------------- */
function pickFree(s) {
  const me = s.me, op = s.opp, d = s.dist;
  const myKi = me.ki, opKi = op.ki;
  const oppStun = (op.state === 'hitstun' || op.state === 'blockstun' || op.state === 'crushed');
  const oppDown = (op.state === 'down');
  const oppBusy = (!op.free && !oppStun && !oppDown && op.state !== 'ko');

  /* 1. 对手的气功波飞过来了 —— 穿过去或挡一下 */
  const inc = incomingEta(s);
  if (inc !== null && inc <= 20) {
    if (myKi >= R.dash.cost) return 'dash_forward';   // 9 tick 无敌，直接穿过去
    return 'guard';                                  // 只擦 12 血
  }

  /* 2. 对手起手大招 —— 想办法打断 */
  if (op.state === 'beam' && op.phase === 'startup') {
    const rem = R.beam.startup - op.t;                