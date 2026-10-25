```js
// 铁拳 · 自适应格斗AI
// 核心思路：近身压制 + 读对手习惯 + 精准惩罚

let oppGuards = 0;
let lastOppState = '';

function decide(state) {
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  const R = RULES;

  // 追踪对手习惯
  if (opp.state !== lastOppState) {
    if (opp.state === 'guard') oppGuards++;
    lastOppState = opp.state;
  }

  // === 1. 对冲 ===
  if (state.clash) {
    const c = state.clash;
    if (c.pos < 0.25) return 'push';
    if (c.myPower > c.oppPower) return 'push';
    if (me.ki > 40) return 'push';
    return me.ki > 15 && Math.random() < 0.4 ? 'push' : 'idle';
  }

  // === 2. 连招取消 ===
  if (me.canCancel) {
    if (me.chain < 4 && dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'idle';
  }

  // === 3. 紧急威胁 ===
  if (opp.state === 'beam' && opp.phase === 'firing') {
    return me.ki >= R.dash.cost ? 'dash_back' : 'guard';
  }
  const inc = state.blasts.find(b => b.incoming && b.eta !== null && b.eta <= 5);
  if (inc) {
    if (inc.eta <= 2 && me.ki >= R.dash.cost && Math.random() < 0.3) return 'dash_back';
    return 'guard';
  }

  // === 4. 惩罚窗口 ===
  if (opp.state === 'beam' && opp.phase === 'startup') {
    if (dist <= R.heavy.reach) return 'heavy';
    if (dist <= R.light.reach) return 'light';
    return 'forward';
  }
  if (opp.phase === 'recovery' && ['light','heavy','blast','dash'].includes(opp.state)) {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  if (['hitstun','blockstun','crushed'].includes(opp.state)) {
    if (dist <= R.light.reach) return 'light';
    return 'forward';
  }
  if (opp.state === 'charge') {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }

  // === 5. 对手状态应对 ===
  if (opp.state === 'down') return dist > 180 ? 'forward' : 'guard';

  if (opp.state === 'guard') {
    if (dist <= R.heavy.reach) {
      if (Math.random() < Math.min(0.4, 0.12 + oppGuards * 0.05)) return 'heavy';
      if (dist <= R.light.reach) return 'light';
    }
    return 'forward';
  }

  if ((opp.state === 'light' || opp.state === 'heavy') && opp.phase !== 'recovery') {
    if (opp.state === 'heavy') {
      if (dist <= R.light.reach && opp.t < 3) return 'light';
      return 'back';
    }
    return dist <= R.light.reach ? 'guard' : 'back';
  }

  if (opp.state === 'blast' && opp.phase === 'startup') return 'forward';

  // === 6. 战略判断 ===
  if (state.timeLeft < 300 && me.hp > opp.hp + 50) {
    return dist > 250 ? 'back' : 'guard';
  }
  if (me.hp < 120 && me.ki >= R.beam.cost && dist > 250 && state.timeLeft < 900) return 'beam';
  if (opp.hp <= R.heavy.damage && dist <= R.heavy.reach) return 'heavy';
  if (opp.hp <= R.light.damage && dist <= R.light.reach) return 'light';

  // === 7. 距离博弈 ===
  if (dist > 400) {
    if (me.ki >= R.blast.cost && me.ki > 35 && Math.random() < 0.1) return 'blast';
    return 'forward';
  }
  if (dist > R.heavy.reach + 20) {
    if (me.ki >= R.blast.cost && me.ki > 35 && Math.random() < 0.06) return 'blast';
    if (me.ki >= R.dash.cost && me.ki > 25 && Math.random() < 0.04) return 'dash_forward';
    return 'forward';
  }
  if (dist > R.light.reach) {
    const r = Math.random();
    return r < 0.6 ? 'forward' : r < 0.8 ? 'guard' : 'back';
  }

  // === 8. 近身混战 ===
  const r = Math.random();
  const hp = Math.min(0.3, 0.08 + oppGuards * 0.04);
  if (r < 0.45) return 'light';
  if (r < 0.45 + hp) return 'heavy';
  if (r < 0.72) return 'guard';
  if (r < 0.88) return 'back';
  return 'forward';
}
```

赛前宣言：拳出无悔，一击定乾坤。