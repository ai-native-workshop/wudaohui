// Gemini 4 Argon · google/gemini-4-argon · 2026-10-24T21:22:20.932Z
let lastTick = -1;
let lastClashPos = 0.5;
let lastClashTick = 0;
let oppGuardClose = 0;
let oppCloseTotal = 0;
let oppWakeupGuard = 0;
let oppWakeupTotal = 0;
let wasOppDown = false;

function resetMemory() {
  lastTick = -1;
  lastClashPos = 0.5;
  lastClashTick = 0;
  oppGuardClose = 0;
  oppCloseTotal = 0;
  oppWakeupGuard = 0;
  oppWakeupTotal = 0;
  wasOppDown = false;
}

function decide(state) {
  if (!state || !state.me || !state.opp) return 'idle';
  if (state.t < lastTick) resetMemory();

  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  const comboArr = (typeof RULES !== 'undefined' && RULES.combo) ? RULES.combo : [1, 0.8, 0.65, 0.55, 0.45, 0.4];

  // Track opponent wakeup & close-range guarding tendencies
  if (wasOppDown && opp.state !== 'down') {
    wasOppDown = false;
    oppWakeupTotal++;
    if (opp.state === 'guard') oppWakeupGuard++;
  }
  if (opp.state === 'down') {
    wasOppDown = true;
  }
  if (dist <= 155 && opp.free) {
    oppCloseTotal++;
    if (opp.state === 'guard') oppGuardClose++;
  }
  lastTick = state.t;

  const oppGuardRate = oppCloseTotal > 4 ? oppGuardClose / oppCloseTotal : 0.35;
  const wakeupGuardRate = oppWakeupTotal > 1 ? oppWakeupGuard / oppWakeupTotal : 0.35;

  // 1. BEAM CLASH
  if (state.clash || me.state === 'clash') {
    if (!state.clash) return 'push';
    const pos = state.clash.pos;
    const dt = Math.max(1, state.t - lastClashTick);
    const v = state.clash.t <= 1 ? 0 : (pos - lastClashPos) / dt;
    lastClashPos = pos;
    lastClashTick = state.t;

    const predPos = pos + v * 6;
    // Emergency survival when clash point is dangerously close to us
    if (pos < 0.23 || predPos < 0.20) return 'push';
    // Push for the win when close to opponent
    if (pos > 0.76 && me.ki > 2.5) return 'push';
    // Preserve >0 ki to avoid the empty-ki power cliff (1.0 -> 0.5)
    if (me.ki <= 4.9) {
      return pos > 0.86 ? 'push' : 'idle';
    }
    if (pos > 0.68 || predPos > 0.74) return 'push';
    if (pos < 0.43 || predPos < 0.38) return 'push';
    // Opponent burned out to 0 ki (0.5 base power): finish them
    if (opp.ki <= 1.2 && me.ki >= 7.5) return 'push';
    // Press a large ki advantage
    if (me.ki > opp.ki + 14 && me.ki >= 18) return 'push';
    // Near 360-tick clash timeout, don't let it drift to our side
    if (state.clash.t >= 310 && pos < 0.52) return 'push';
    return 'idle';
  }

  // 2. HIT-CONFIRM COMBO CANCEL (right after a light punch connects)
  if (me.canCancel) {
    const scale = comboArr[Math.min(opp.combo, comboArr.length - 1)];
    const lightDmg = Math.max(1, Math.round(40 * scale));
    const heavyDmg = Math.max(1, Math.round(120 * scale));

    if (dist <= 109.8 && me.chain < 4 && opp.hp <= lightDmg) {
      return 'light';
    }
    if (opp.hp <= heavyDmg && dist <= 139.8) {
      return 'heavy';
    }
    // If light is in range (<= 109.8), it is guaranteed to connect and push by 14 (to <= 123.8),
    // which still guarantees heavy (reach 140) on the subsequent cancel.
    if (dist <= 109.8 && me.chain < 4) {
      return 'light';
    }
    return 'heavy';
  }

  // Helper: safety margin against r1() 1-decimal rounding in view()
  const hasKi = cost => me.ki === 100 || me.ki >= cost + 0.1;
  const canLight = dist <= 109.8;
  const canHeavy = dist <= 139.8;

  // Check incoming blasts
  let incBlast = null;
  if (state.blasts && state.blasts.length) {
    for (let i = 0; i < state.blasts.length; i++) {
      const b = state.blasts[i];
      if (b.incoming && (incBlast === null || b.eta < incBlast.eta)) {
        incBlast = b;
      }
    }
  }

  // 3. HANDLE ENEMY BEAM
  const enemyBeam = state.beams && state.beams.find(b => !b.mine);
  if ((opp.state === 'beam' && opp.phase !== 'recovery') || enemyBeam) {
    const oppAimingAtMe = (me.x - opp.x) * opp.facing > 0;
    if (!oppAimingAtMe) {
      // Opponent fired beam in the wrong direction after a crossup
      if (canLight) return 'light';
      if (canHeavy) return 'heavy';
      return 'forward';
    }

    const startupLeft = opp.phase === 'startup' ? Math.max(0, opp.left - 60) : 0;
    let travelTicks = 0;
    if (opp.phase === 'startup') {
      travelTicks = Math.max(0, Math.ceil((dist - 70) / 30));
    } else if (enemyBeam) {
      const gap = (me.x - enemyBeam.front) * enemyBeam.dir;
      travelTicks = Math.max(0, Math.ceil((gap - 30) / 30));
    }
    const beamEta = startupLeft + travelTicks;

    // Interrupt beam startup with a strike if fast enough
    if (opp.phase === 'startup') {
      if (canLight && 5 < startupLeft) return 'light';
      if (canHeavy && 9 < startupLeft) return 'heavy';
    }

    // Cross up through the opponent with dash_forward if within crossup distance and room behind opp
    const roomBehindOpp = state.wallAhead - dist;
    if (hasKi(16) && dist <= 175 && roomBehindOpp >= 62 && beamEta <= 9) {
      return 'dash_forward';
    }

    // Dash forward early in startup to interrupt with light if enough startup remains
    if (opp.phase === 'startup' && startupLeft >= 25 && dist <= 305 && hasKi(16)) {
      return 'dash_forward';
    }

    // Counter-beam if blocking would kill us (chip is 160) or if we will enter the clash with a big ki lead
    if (hasKi(50)) {
      const chipKillsOrCrushes = me.hp <= 160 || me.ki < 15.1;
      const clashAdvantage = (me.ki - 50) >= opp.ki + 14;
      if (chipKillsOrCrushes || clashAdvantage) {
        return 'beam';
      }
    }

    // Block before beam arrives; walk forward to close gap while beam is still far away
    if (beamEta <= 7) {
      return 'guard';
    }
    return 'forward';
  }

  // 4. HANDLE INCOMING BLAST
  if (incBlast) {
    // Dodge through the blast with dash_forward to punish or close gap
    if (
      hasKi(16) &&
      dist >= 115 &&
      dist <= 290 &&
      incBlast.eta <= 11 &&
      ((opp.state === 'blast' && opp.left >= 13) || opp.state === 'charge')
    ) {
      return 'dash_forward';
    }

    // Must defend now if blast will arrive before or right after next 6-tick decision
    if (incBlast.eta <= 7) {
      if (me.hp <= 12 || !hasKi(6)) {
        if (hasKi(16)) return dist <= 260 ? 'dash_forward' : 'dash_back';
      }
      return 'guard';
    }
  }

  // Also check if opponent is in blast startup at mid-range where dash_forward goes through the spawn
  if (opp.state === 'blast' && opp.phase === 'startup') {
    if (canLight && 5 < opp.left && (!incBlast || incBlast.eta > 17)) return 'light';
    if (canHeavy && 9 < opp.left && (!incBlast || incBlast.eta > 26)) return 'heavy';
    if (hasKi(16) && dist > 139.8 && dist <= 290 && opp.left >= 19 && opp.left <= 26) {
      return 'dash_forward';
    }
  }

  // Do not commit to long moves if an active blast is about to hit us
  const blastSoon = incBlast && incBlast.eta <= 17;

  // 5. PUNISH / REACT TO NON-FREE OPPONENT STATES
  if (!opp.free) {
    // 5a. Opponent is dashing (10 moving ticks, 8 invuln ticks, 8 recovery ticks = 18 total)
    if (opp.state === 'dash') {
      // Wait out the early invulnerable/crossing ticks so our next 6-tick decision lands at opp.left in [6..11]
      if (opp.left >= 12) {
        const oppInFront = (me.x - opp.x) * opp.facing > 0;
        if (dist < 185 && oppInFront) return 'forward';
        return hasKi(4) ? 'guard' : 'idle';
      }
      // When opp.left is in [6..11], dash invulnerability expires before our light (5 startup) lands
      if (opp.left >= 6 && opp.left <= 11 && !blastSoon) {
        const stillMidCrossup = dist < 58 && (me.x - opp.x) * opp.facing > 0;
        if (!stillMidCrossup) {
          if (canLight) return 'light';
          if (canHeavy && 9 < opp.left) return 'heavy';
        }
      }
      if (opp.left <= 5) {
        return hasKi(4) ? 'guard' : 'idle';
      }
    }

    // 5b. Opponent is in heavy (startup 9, active 4, recovery 22 = 35 total; reach 140; crushes guard)
    if (opp.state === 'heavy') {
      // Interrupt early startup with light
      if (canLight && opp.left >= 32 && !blastSoon) {
        return 'light';
      }
      // Active or about to be active (22 < opp.left < 32)
      if (opp.left > 22) {
        if (dist <= 142) {
          // Never guard a heavy! Dash through/invuln it and punish recovery
          if (hasKi(16) && opp.left <= 30) return 'dash_forward';
          // Walk out of 140 range if close to edge of reach
          if (dist + 3 * (opp.left - 22) > 140.5 && state.wallBehind >= 24) return 'back';
          if (canLight && !blastSoon) return 'light';
          return 'back';
        }
        // Outside 142 range: their heavy will whiff! Dash in to punish recovery if mid-range
        if (dist <= 300 && opp.left >= 24 && hasKi(16) && !blastSoon) {
          return 'dash_forward';
        }
        return dist > 175 && me.ki < 95 ? 'charge' : 'idle';
      }
      // Heavy recovery (opp.left <= 22): counter-hit punish!
      if (!blastSoon) {
        if (canLight && 5 < opp.left) return 'light';
        if (canHeavy && 9 < opp.left) {
          if (opp.left >= 13 && dist <= 135) return 'forward';
          return 'heavy';
        }
        if (dist > 139.8 && dist <= 165 && opp.left >= 12) return 'forward';
      }
    }

    // 5c. Opponent is in light (startup 5, active 3, recovery 9 = 17 total; reach 110)
    if (opp.state === 'light') {
      if (opp.left <= 9 && !blastSoon) {
        if (canLight && 5 < opp.left) return 'light';
      }
      if (opp.left > 9 && dist <= 113) {
        // Step back out of 110 range to make their light whiff if possible
        if (dist + 3 * Math.max(1, opp.left - 12) > 110.5 && state.wallBehind >= 18) {
          return 'back';
        }
        if (hasKi(4)) return 'guard';
      }
    }

    // 5d. Opponent is in blast recovery
    if (opp.state === 'blast' && !blastSoon) {
      if (canLight && 5 < opp.left) return 'light';
      if (canHeavy && 9 < opp.left) return 'heavy';
    }

    // 5e. Opponent is stunned or recovering (crushed, hitstun, blockstun,clash recover)
    if (
      (opp.state === 'crushed' || opp.state === 'hitstun' || opp.state === 'recover' || opp.state === 'blockstun') &&
      !blastSoon
    ) {
      if (canLight && 5 < opp.left) return 'light';
      if (canHeavy && 9 < opp.left) {
        if (opp.left >= 12 && dist <= 135) return 'forward';
        return 'heavy';
      }
      // Meaty heavy on the exact wakeup frame of a guard crush at 110..140 range
      if (opp.state === 'crushed' && canHeavy && opp.left >= 8) {
        return 'heavy';
      }
      if (dist > 139.8 && dist <= 165 && opp.left >= 12) return 'forward';
      if (dist > 165 && dist <= 300 && opp.left >= 24 && hasKi(16)) return 'dash_forward';
    }

    // 5f. Okizeme when opponent is knocked down (opp.state === 'down')
    if (opp.state === 'down' && !blastSoon) {
      // Meaty light option-select at 5..7 ticks before wakeup:
      // beats wakeup attacks/charge/walk, safe on wakeup guard (+3 ki), and recovers in time to punish wakeup dash!
      if (opp.left >= 5 && opp.left <= 7) {
        if (dist <= 108) return 'light';
        if (canHeavy) return wakeupGuardRate > 0.45 ? 'heavy' : 'forward';
        return 'forward';
      }
      // Meaty heavy at 9..11 ticks before wakeup if opponent likes to wakeup guard
      if (opp.left >= 9 && opp.left <= 11 && canHeavy && wakeupGuardRate > 0.55) {
        return 'heavy';
      }
      if (opp.left < 5) {
        if (canLight && wakeupGuardRate < 0.65) return 'light';
        return 'forward';
      }
      // While opp.left >= 8, position for meaty or safely charge ki
      if (dist <= 104) {
        if (opp.left >= 11 && me.ki < 97) return 'charge';
        return 'idle';
      }
      const cyclesLeft = Math.floor((opp.left - 5) / 6);
      const distNeeded = Math.max(0, dist - 100);
      const walkCyclesNeeded = Math.ceil(distNeeded / 27);
      if (opp.left >= 11 && cyclesLeft > walkCyclesNeeded && me.ki < 92) {
        return 'charge';
      }
      return 'forward';
    }
  }

  // 6. NEUTRAL GAME (opponent is in a FREE state: idle, forward, back, guard, charge)
  // Because decideEvery = 6, opp is locked in their current free state for oppLockedTicks ticks!
  const oppLockedTicks = opp.free ? (6 - (opp.t % 6)) % 6 : 0;

  // 6a. Long-range guaranteed / high-value Beam
  if (hasKi(50) && dist >= 340 && !blastSoon) {
    const oppCannotDoubleDashCrossup = dist >= 405 || state.wallBehind < 60 || opp.ki < 31 || !opp.free;
    const chipCheckmate = opp.hp <= 160 && opp.ki < 34;
    const safeBeamAdvantage = opp.ki < 31 || (me.ki >= 74 && me.ki >= opp.ki + 28);
    if (oppCannotDoubleDashCrossup && (chipCheckmate || safeBeamAdvantage)) {
      return 'beam';
    }
  }

  // 6b. Close range (dist <= 109.8)
  if (canLight && !blastSoon) {
    if (opp.state === 'guard') {
      // If opponent is locked in guard for >= 3 ticks, they cannot interrupt heavy (startup 9) with light (startup 5)!
      if (oppLockedTicks >= 3 || opp.ki < 4.1 || oppGuardRate > 0.48) {
        return 'heavy';
      }
      return 'light';
    }
    return 'light';
  }

  // 6c. Intercept opponent locked in forward walk entering light range
  if (
    !blastSoon &&
    opp.state === 'forward' &&
    oppLockedTicks >= 2 &&
    dist - 4.5 * Math.min(4, oppLockedTicks) <= 109.5
  ) {
    return 'light';
  }

  // 6d. Heavy range (109.8 < dist <= 139.8)
  if (canHeavy && !blastSoon) {
    if (opp.state === 'guard' && (oppLockedTicks >= 3 || opp.ki < 6 || oppGuardRate > 0.55)) {
      return 'heavy';
    }
    if (opp.state === 'charge' && (oppLockedTicks >= 2 || dist <= 128)) {
      return 'heavy';
    }
    return 'forward';
  }

  // 6e. Mid-range footsies (139.8 < dist <= 215)
  if (dist <= 215) {
    if (opp.hp <= 12 && hasKi(14) && !me.blastOut && dist >= 165) {
      return 'blast';
    }
    return 'forward';
  }

  // 6f. Long range (dist > 215): zero-risk 6-tick ki charging vs advancing
  // At dist > 215 with no incoming projectile within 7 ticks, no move in the game can reach us within 6 ticks.
  const safeToCharge = !incBlast || incBlast.eta > 10;
  if (safeToCharge && me.ki < 96) {
    if (opp.state === 'charge') {
      if (me.ki < 76 || me.ki < opp.ki + 15) {
        return 'charge';
      }
      return 'forward';
    }
    if (me.ki < 52 && dist > 240) {
      return 'charge';
    }
    if (me.ki < 76 && dist > 320 && me.hp >= opp.hp) {
      return 'charge';
    }
  }

  return 'forward';
}
