```js
/* ==========================================================================
 * AI 武道会 · 第 1 季 · 选手程序
 * 思路：
 *   近身：轻拳起手 → 连招取消（最多 4 拳）→ 重击收尾（击倒）
 *   对手格挡：重击破防；对手收招/硬直：轻拳反击（×1.25）
 *   对手重击：瞬移（无敌帧）躲开，或后退出射程
 *   对手大招：起手用轻/重击打断，发射中只能格挡（120 擦伤）
 *   对手气功波：格挡（只擦伤 12），近距离瞬移穿过
 *   对手倒地：气够就放大招（必中 280），否则蓄气
 *   对冲：力量占优就 push，气不足则保存体力
 * ========================================================================== */

const FREE_STATES = { idle: 1, forward: 1, back: 1, guard: 1, charge: 1 };

function decide(state) {
  if (!state || !state.me || !state.opp) return 'idle';
  if (state.clash) return clashAction(state);
  if (state.me.canCancel) return cancelAction(state);
  return freeAction(state);
}

/* ---------- 轻拳命中后的取消窗口 ---------- */
function cancelAction(s) {
  const R = RULES, me = s.me, opp = s.opp, dist = s.dist;

  // 一拳命中会把对手推开 14，下一拳要够得到
  if (me.chain < R.light.chain) {
    if (dist + R.light.push <= R.light.reach - 2) return 'light';
    if (dist <= R.heavy.reach - 4 && opp.state !== 'down' && !opp.invulnerable) return 'heavy';
    return 'idle';
  }
  // 连拳已到上限：重击收尾（对手还在硬直里，打不满会被硬直吃掉）
  if (dist <= R.heavy.reach - 4 && opp.state !== 'down' && !opp.invulnerable) return 'heavy';
  return 'idle';
}

/* ---------- 对冲 ---------- */
function clashAction(s) {
  const c = s.clash, me = s.me;
  if (!c) return 'idle';
  const adv = c.myPower - c.oppPower;
  if (me.ki >= 22 && adv >= -0.25) return 'push';
  return 'idle';
}

/* ---------- 常规决策 ---------- */
function freeAction(s) {
  const R = RULES;
  const me = s.me, opp = s.opp;
  const dist = s.dist, ki = me.ki;

  /* 1. 对手的气功波飞过来了：格挡（只擦伤 12），贴脸可瞬移穿过 */
  for (let i = 0; i < s.blasts.length; i++) {
    const b = s.blasts[i];
    if (b.incoming && b.eta !== null) {
      if (b.eta <= 2 && ki >= R.dash.cost) return 'dash_forward';
      return 'guard';
    }
  }

  /* 2. 对手的大招 */
  if (opp.state === 'beam') {
    if (opp.phase === 'startup') {
      const toFire = R.beam.startup - opp.t;                 // 距离发射
      const travel = Math.max(0, Math.ceil((dist - 55) / 30)); // 光束飞到我们身上的时间
      const hitIn = toFire + travel;
      if (hitIn <= 4) return 'guard';                        // 来不及打断，只能挡
      if (dist <= 94) return 'light';                        // 快速打断
      if (dist <= 128 && hitIn >= 10) return 'heavy';        // 重击打断，伤害更高
      if (ki >= R.dash.cost && hitIn >= 26 && dist <= 290) return 'dash_forward';
      return 'guard';
    }
    if (opp.phase === 'firing') return 'guard';             // 挡下：120 擦伤 + 长硬直
  }

  /* 3. 对手的重击：格挡会被破防，用瞬移或后撤躲开 */
  if (opp.state === 'heavy' && opp.phase !== 'recovery' && dist <= R.heavy.reach + 4) {
    if (opp.phase === 'active') {
      if (ki >= R.dash.cost) return 'dash_forward';
      return 'guard';
    }
    if (ki >= R.dash.cost) {
      if (opp.t >= 4) return 'dash_forward';                // 无敌帧正好盖住判定
      return 'back';                                        // 先退，下次询问再瞬移
    }
    const need = R.heavy.reach + 8 - dist;
    if (s.wallBehind > need + 14 && R.walk.back * (R.heavy.startup - opp.t) >= need) return 'back';
    return 'guard';
  }

  /* 4. 对手的轻拳起手/判定中：格挡掉 */
  if (opp.state === 'light' && opp.phase !== 'recovery' && dist <= R.light.reach + 4) return 'guard';

  /* 5. 终局保分：血多、时间少就拉开距离耗时间 */
  if (s.timeLeft < 700 && me.hp > opp.hp + 180) {
    if (dist < 120) return (ki >= R.dash.cost ? 'dash_back' : 'back');
    if (opp.state === 'charge') return 'guard';
    return 'idle';
  }

  /* 6. 对手倒地：无敌打不到，利用这段时间 */
  if (opp.state === 'down') {
    if (ki >= R.beam.cost + 2 && opp.left >= 30 && opp.hp <= 720) return 'beam';
    if (ki < 55) return 'charge';
    return 'forward';
  }
  if (opp.invulnerable) return 'idle';

  /* 7. 近身 */
  if (dist <= 100) {
    if (opp.state === 'guard') {
      if (dist <= R.heavy.reach - 2) return 'heavy';         // 破防
      return 'guard';
    }
    if (opp.state === 'charge') return 'light';              // 蓄气被打 ×1.5
    if (opp.phase === 'recovery' && opp.left >= 7) return 'light';   // 反击 ×1.25
    if ((opp.state === 'hitstun' || opp.state === 'blockstun') && opp.left >= 7) return 'light';
    if (opp.state === 'crushed') return 'light';
    if (opp.state === 'blast' && opp.phase === 'startup') return 'light'; // 打断气功波
    if (opp.state === 'back') return dist <= 88 ? 'light' : 'forward';
    return 'light';
  }

  /* 8. 远距离 */
  const busy = !FREE_STATES[opp.state];
  if (busy) {
    if ((opp.state === 'crushed' || opp.state === 'hitstun' || opp.state === 'blockstun') &&
        opp.left >= 24 && ki < 50) return 'charge';
    return 'forward';
  }
  if (dist >= 190 && ki < 50 && opp.state !== 'forward') return 'charge';
  if (dist >= 245 && ki >= R.beam.cost + 14 && s.timeLeft > 800) return 'beam';
  if (dist >= 175 && ki >= 38 && opp.state !== 'forward') return 'blast';
  if (ki >= R.dash.cost && dist >= 255) return 'dash_forward';
  return 'forward';
}
```

赛前宣言：轻拳连段，重击破防！