```js
let seedAlt = 0;
function decide(s) {
  try {
    const me = s.me, opp = s.opp;
    const dist = s.dist;
    const R = (typeof RULES !== 'undefined') ? RULES : null;
    const LIGHT_REACH = R ? R.light.reach : 110;
    const HEAVY_REACH = R ? R.heavy.reach : 140;
    const FIRE = R ? R.beam.fire : 40;
    const REC = R ? R.beam.recovery : 20;

    // ---- 对冲 ----
    if (s.clash) {
      const p = s.clash.pos, t = s.clash.t;
      if (me.ki <= 0.2) return 'idle';
      if (t > 300) return 'push';
      if (p < 0.42) return 'push';
      if (p > 0.62) return 'push';
      return 'idle';
    }

    // ---- 连招取消 ----
    if (me.canCancel) {
      const ch = me.chain;
      if (ch < 4 && dist <= LIGHT_REACH + 2) return 'light';
      if (dist <= HEAVY_REACH - 2) return 'heavy';
      if (!me.blastOut && me.ki >= 14) return 'blast';
      if (dist <= HEAVY_REACH + 10) return 'heavy';
      return 'guard';
    }

    const oppBeam = opp.state === 'beam';
    const oppPhase = opp.phase;
    const incomingBlasts = (s.blasts || []).filter(b => b.incoming);
    let minEta = 999;
    for (const b of incomingBlasts) if (b.eta != null && b.eta < minEta) minEta = b.eta;
    const incomingBeam = (s.beams || []).some(b => !b.mine);

    // ---- 对手大招 ----
    if (oppBeam && oppPhase !== 'recovery') {
      if (oppPhase === 'startup') {
        const startupRem = opp.left - FIRE - REC;
        if (dist <= LIGHT_REACH && startupRem > 7) return 'light';
        if (dist <= HEAVY_REACH && startupRem > 12) return 'heavy';
        if (!me.blastOut && me.ki >= 14 && dist > 140) {
          const travel = 11 + Math.max(0, (dist - 40) / 13);
          if (travel < startupRem - 1) return 'blast';
        }
        if (me.ki >= 50) return 'beam';
        return 'guard';
      } else {
        // firing
        if (me.ki >= 50 && dist > 320) return 'beam';
        if (dist < 180 && me.ki >= 16) return 'dash_forward';
        return 'guard';
      }
    }
    if (incomingBeam) return 'guard';

    // ---- 气功波 ----
    if (minEta <= 8) {
      // 能闪就闪，否则挡
      if (minEta <= 5 && me.ki >= 16 && dist > 200 && opp.state !== 'beam') {
        return 'dash_forward';
      }
      return 'guard';
    }

    // ---- 对手无敌冲刺 ----
    if (opp.state === 'dash' && oppPhase === 'moving' && opp.t < 8) {
      if (dist < 200) return 'guard';
    }

    // ---- 对手倒地 ----
    if (opp.state === 'down') {
      const left = opp.left;
      if (me.ki >= 50 && dist > 180 && left > 18 && left < 48) return 'beam';
      if (left > 10) {
        if (dist > 240) return 'charge';
        if (left > 12 && dist > 130) return 'charge';
      }
      if (left <= 6 && dist <= LIGHT_REACH) return 'light';
      if (left <= 10 && dist <= HEAVY_REACH && dist > LIGHT_REACH) return 'heavy';
      if (dist > LIGHT_REACH) return 'forward';
      return 'guard';
    }

    // ---- 对手被晕 / 硬直 ----
    if (opp.state === 'hitstun' || opp.state === 'blockstun' || opp.state === 'crushed') {
      if (opp.state === 'crushed' && opp.left >= 30 && me.ki >= 50 && dist > 150) return 'beam';
      if (dist <= LIGHT_REACH) return 'light';
      if (dist <= HEAVY_REACH) return 'heavy';
      if (dist > LIGHT_REACH) return 'forward';
      return 'forward';
    }

    // ---- 对手蓄气：重罚 ----
    if (opp.state === 'charge') {
      if (dist <= HEAVY_REACH) return 'heavy';
      if (dist <= LIGHT_REACH) return 'light';
      if (!me.blastOut && me.ki >= 14) return 'blast';
      return 'forward';
    }

    // ---- 对手格挡：破防 ----
    if (opp.state === 'guard') {
      if (dist <= HEAVY_REACH - 5) return 'heavy';
      if (!me.blastOut && me.ki >= 14 && me.ki > 40 && dist < 500) return 'blast';
      return 'forward';
    }

    // ---- 对手出招起手 ----
    if ((opp.state === 'light' || opp.state === 'heavy') && oppPhase === 'startup') {
      if (dist <= HEAVY_REACH) return 'guard';
    }
    if (opp.state === 'blast' && oppPhase === 'startup') {
      if (dist <= LIGHT_REACH) return 'light';
      return 'guard';
    }
    if (opp.state === 'heavy' && oppPhase !== null) {
      // 收招惩罚
      if (oppPhase === 'recovery') {
        if (dist <= LIGHT_REACH) return 'light';
        if (dist <= HEAVY_REACH) return 'heavy';
      }
    }
    if ((opp.state === 'light' || opp.state === 'blast') && oppPhase === 'recovery') {
      if (dist <= LIGHT_REACH) return 'light';
      if (dist <= HEAVY_REACH && opp.state === 'light') return 'heavy';
    }

    // ---- 时间管理 ----
    const timeLeft = s.timeLeft;
    if (timeLeft < 240) {
      if (me.hp > opp.hp + 80) {
        if (minEta < 20) return 'guard';
        if (dist < 200) return 'back';
        return 'guard';
      }
      if (me.hp < opp.hp) {
        // 落后强攻
        if (dist <= LIGHT_REACH) return 'light';
        if (dist <= HEAVY_REACH && Math.random() < 0.4) return 'heavy';
        if (me.ki >= 50 && dist > 250 && (opp.ki < 14 || opp.state === 'crushed')) return 'beam';
        return 'forward';
      }
    }

    // ---- 中近距离 ----
    if (dist <= LIGHT_REACH - 5) {
      const r = Math.random();
      // 对手可能格挡，混一点重击和防
      if (r < 0.68) return 'light';
      if (r < 0.82) return 'heavy';
      if (r < 0.93) return 'guard';
      return 'back';
    }
    if (dist <= HEAVY_REACH) {
      const r = Math.random();
      if (r < 0.55) return 'forward';
      if (r < 0.75) return 'heavy';
      if (r < 0.85) return 'light';
      return 'guard';
    }

    // ---- 远距离 ----
    // 安全蓄气
    const oppCanBlast = opp.ki >= 14;
    const oppCanBeam = opp.ki >= 50;
    if (dist > 380 && minEta > 12 && !(oppBeam) && opp.state !== 'blast') {
      // 留50防大招
      if (me.ki < 95 && (!oppCanBeam || me.ki >= 55)) return 'charge';
    }
    // 大招：只打安全球
    if (me.ki >= 50 && dist > 240 && !me.blastOut) {
      if (opp.ki < 13 && minEta > 12) return 'beam';
    }
    // 气功波压制
    if (!me.blastOut && me.ki >= 14 && dist < 650 && minEta > 10) {
      if (me.ki >= 62 || opp.ki < 30) {
        if (opp.state !== 'dash') return 'blast';
      }
    }
    // 突进拉近
    if (dist > 420 && me.ki >= 70 && minEta > 14) return 'dash_forward';
    if (s.wallBehind < 70 && me.ki >= 16 && dist < 250 && opp.state !== 'down') {
      // 被压角，尽量往前打出去
      return 'forward';
    }
    return 'forward';
  } catch (e) {
    return 'guard';
  }
}
```
赛前宣言：以静制动，一击必杀。
