// 豆包 Seed 2.1 · bytedance-seed/seed-2-1-turbo · 2026-10-24T21:22:20.933Z
// 对手状态历史，用于分析行为习惯
const oppStateHistory = [];
const MAX_HISTORY = 10;
// 对冲决策
function decideClash(state) {
  const { pos, myPower, oppPower, t } = state.clash;
  const myKi = state.me.ki;
  const oppKi = state.opp.ki;
  const myHpLow = state.me.hp < RULES.hp * RULES.clash.rageHp;
  const maxT = RULES.clash.maxTicks;
  if (myKi <= 0) return 'idle'; // 没气push也没用
  // 快到时间，能推就推
  if (t > maxT - 30) {
    if (pos > 0.5 && myKi > 5) return 'push';
    if (pos < 0.5 && myKi > 15) return 'push';
    return 'idle';
  }
  if (pos < 0.35) return 'push'; // 劣势太大，全力推
  if (pos > 0.7) return myKi > 20 ? 'push' : 'idle'; // 优势大就省气
  if (myPower > oppPower + 0.15) return 'push'; // 力量占优就推
  if (myKi > oppKi + 20) return 'push'; // 气多就耗
  if (myHpLow && myKi > 15) return 'push'; // 残血有加成，积极点
  return 'idle';
}
// 连招取消决策
function decideCancel(state) {
  if (state.me.chain < RULES.light.chain) return 'light';
  return 'heavy'; // 满连后接重击，稳定击倒
}
function decide(state) {
  // 记录对手空闲状态的行为
  if (state.opp.free) {
    oppStateHistory.push(state.opp.state);
    if (oppStateHistory.length > MAX_HISTORY) oppStateHistory.shift();
  }
  // 对冲状态
  if (state.clash) return decideClash(state);
  // 连招取消状态
  if (state.me.canCancel) return decideCancel(state);
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  const myKi = me.ki;
  // ========== 1. 大招威胁处理 ==========
  // 1a. 对面大招起手，能打断就打断
  if (opp.state === 'beam' && opp.phase === 'startup') {
    const startupLeft = RULES.beam.startup - opp.t;
    if (dist <= RULES.heavy.reach && startupLeft > RULES.heavy.startup) {
      return 'heavy';
    }
    // 气比对面多就对冲
    if (myKi >= RULES.beam.cost && myKi > opp.ki + 10) {
      return 'beam';
    }
  }
  // 1b. 对面大招光束已发射，紧急躲避
  const oppBeam = state.beams.find(b => !b.mine);
  let beamEta = Infinity;
  if (oppBeam) {
    const isIncoming = (oppBeam.dir === 1 && me.x > oppBeam.front) || 
                       (oppBeam.dir === -1 && me.x < oppBeam.front);
    if (isIncoming) {
      const distToBeam = Math.abs(me.x - oppBeam.front) - RULES.body;
      beamEta = Math.max(0, distToBeam / RULES.beam.speed);
    }
  }
  if (beamEta <= 10) {
    if (myKi >= RULES.dash.cost) return 'dash_forward'; // 穿到身后躲开
    if (myKi >= RULES.guardKi.beam) return 'guard'; // 实在不行就挡
  }
  // ========== 2. 气功波威胁处理 ==========
  const incomingBlasts = state.blasts.filter(b => !b.mine && b.incoming);
  let minBlastEta = Infinity;
  for (const b of incomingBlasts) {
    if (b.eta < minBlastEta) minBlastEta = b.eta;
  }
  if (minBlastEta <= 6) {
    if (myKi >= RULES.guardKi.blast) return 'guard'; // 格挡最省气
    if (myKi >= RULES.dash.cost && minBlastEta <= RULES.dash.invuln) {
      return 'dash_back'; // 气不够挡就瞬移
    }
  }
  // ========== 3. 近战威胁/抢招 ==========
  // 3a. 对面出重击：绝对不能挡，要么抢要么躲
  if (opp.state === 'heavy' && opp.phase === 'startup') {
    const startupLeft = RULES.heavy.startup - opp.t;
    // 轻拳比重击快，抢招
    if (dist <= RULES.light.reach && startupLeft > RULES.light.startup) {
      return 'light';
    }
    if (dist <= RULES.heavy.reach) {
      // 试试后退躲开
      const canBackDodge = (dist + startupLeft * RULES.walk.back) > RULES.heavy.reach;
      if (canBackDodge && state.wallBehind > 20) return 'back';
      // 瞬移躲开
      if (myKi >= RULES.dash.cost) return 'dash_back';
      // 实在不行就拼拳
      if (dist <= RULES.light.reach) return 'light';
    }
  }
  // 3b. 对面出轻拳
  if (opp.state === 'light' && opp.phase !== 'recovery') {
    const startupLeft = opp.phase === 'startup' ? RULES.light.startup - opp.t : 0;
    if (dist <= RULES.light.reach) {
      // 同时起手就对拼
      if (startupLeft >= RULES.light.startup) return 'light';
      // 试试后退躲开
      const canBackDodge = (dist + startupLeft * RULES.walk.back) > RULES.light.reach;
      if (canBackDodge && state.wallBehind > 15) return 'back';
      // 血多对拼，血少格挡
      return me.hp > opp.hp ? 'light' : 'guard';
    }
  }
  // ========== 4. 抓进攻机会 ==========
  // 4a. 对面在收招，稳赚
  if (opp.phase === 'recovery') {
    const recoveryLeft = opp.left;
    if (dist <= RULES.light.reach && RULES.light.startup < recoveryLeft) return 'light';
    if (dist <= RULES.heavy.reach && RULES.heavy.startup < recoveryLeft) return 'heavy';
    // 走两步能到就前进
    const needWalk = dist - RULES.light.reach;
    if (needWalk > 0 && needWalk / RULES.walk.forward + RULES.light.startup < recoveryLeft) {
      return 'forward';
    }
  }
  // 4b. 对面在硬直/破防
  if (['hitstun', 'blockstun', 'crushed'].includes(opp.state)) {
    const stunLeft = opp.left;
    if (dist <= RULES.light.reach) return 'light';
    // 走过去来得及吗
    const needWalk = dist - RULES.light.reach;
    if (needWalk > 0 && needWalk / RULES.walk.forward + RULES.light.startup < stunLeft) {
      return 'forward';
    }
    // 瞬移过去来得及吗
    const dashTotal = RULES.dash.ticks + RULES.dash.recovery + RULES.light.startup;
    if (myKi >= RULES.dash.cost && stunLeft > dashTotal) {
      return 'dash_forward';
    }
  }
  // 4c. 对面在蓄力，抓他
  if (opp.state === 'charge') {
    if (dist <= RULES.light.reach) return 'light';
    if (dist <= 200) return 'forward';
    if (myKi >= RULES.blast.cost && !me.blastOut && dist > 200) return 'blast';
    return 'forward';
  }
  // ========== 5. 主动进攻 ==========
  if (dist <= RULES.light.reach) {
    return 'light'; // 轻拳压制，打中连招，被挡也先恢复
  }
  // ========== 6. 距离调整 ==========
  if (dist > 300) {
    if (myKi >= RULES.blast.cost && !me.blastOut && Math.random() < 0.25) {
      return 'blast'; // 远距离气功波压制
    }
    return 'forward';
  }
  if (dist > RULES.light.reach + 20) return 'forward'; // 往前压
  // ========== 7. 安全时蓄气 ==========
  if (opp.state === 'down') return 'charge'; // 对手倒地，安全蓄气
  if (dist > 250 && !opp.free && opp.state !== 'charge' && myKi < 50) return 'charge';
  if (myKi < 20 && dist > 200) return 'charge';
  // 默认前进保持压力
  if (dist > RULES.light.reach) return 'forward';
  return 'idle';
}
