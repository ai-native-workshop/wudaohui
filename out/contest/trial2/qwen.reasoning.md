Let me analyze this fighting game tournament carefully and design a strong AI fighter.

Key observations:
1. 4 fighters, each pair plays 1000 rounds (left/right swap), ranking by win rate
2. 60 ticks per second, max 3600 ticks (60 seconds) per round
3. 1000 HP, 100 ki max, 30 ki start
4. Decision made every 6 ticks when free, or immediately after recovering from stun/recovery
5. Time budget: 200ms per call, 1500ms total per match

Let me think about strategy:

**Core mechanics:**
- Light: 5 startup, 3 active, 9 recovery, range 110, 40 dmg, 15 hitstun
- Heavy: 9 startup, 4 active, 22 recovery, range 140, 120 dmg, knockdown 42
- Blast: 20 ki, 11 startup, 18 recovery, speed 13, 70 dmg, 20 hitstun
- Beam: 50 ki, 30 startup, 40 fire, 20 recovery, 280 dmg, knockdown 50
- Dash: 10 ki, 10 ticks movement, 8 recovery, 9 invuln ticks
- Guard blocks light, blast, beam but NOT heavy (heavy crushes guard)
- Light can cancel into light/heavy/blast/beam on hit
- Combo scaling: 1, 0.8, 0.65, 0.55, 0.45, 0.4
- Counter hit: 1.25x damage
- Charge hit: 1.5x damage

**Key strategic considerations:**
1. Light punch chains are the bread and butter - 4 lights in a chain
2. Heavy crushes guard - mix-up tool
3. Blast is a projectile for zoning
4. Beam is high risk/reward - 30 tick startup means it's very punishable
5. Dash gives invulnerability frames
6. Ki management is crucial

**My strategy should focus on:**
1. Aggressive but smart - approach and pressure
2. Mix-up between light, heavy, and guard
3. Use blasts for zoning when at range
4. Punish opponent's recovery
5. Guard against predictable attacks
6. Use combos effectively
7. Manage ki for key moments

Let me think about a state machine approach:

**Phases:**
- Opening: Approach, build ki, probe with lights
- Mid-range: Mix between blast, dash-in, and careful approach
- Close range: Light chains, heavy mix-ups, guard
- Defense: Guard, back away, dash back
- Punish: When opponent is in recovery, attack

**Key decisions:**
- When to approach vs retreat
- When to guard vs attack
- When to use ki (blast, beam, dash)
- Combo optimization

Let me write a comprehensive AI:

```js
function decide(state) {
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  
  // Handle clash
  if (state.clash) {
    return clashDecide(state);
  }
  
  // Handle cancel opportunity
  if (me.canCancel) {
    return cancelDecide(state);
  }
  
  // Main decision logic
  // ...
}
```

Let me think more carefully about the strategy:

**Against light attacks:**
- Guard is safe (no damage, gain 2 ki)
- But heavy crushes guard
- Need to mix guard with other options

**Against heavy:**
- Can't guard it
- Need to back away or dash
- Heavy has 9 startup, 4 active, 22 recovery = 35 total ticks
- If I see heavy startup, I can punish after it whiffs

**Against blast:**
- Can guard it (12 chip damage)
- Can dash through it
- Can jump... wait, no jumping in this game

**Against beam:**
- 30 tick startup is very long
- Can dash through it
- Can hit during startup
- If it fires, dash through or guard (120 chip)

**Combo optimization:**
- Light -> Light -> Light -> Light -> Heavy (max chain)
- Or Light -> Light -> Heavy for more damage
- Light -> Beam if we have ki
- Each light does 40 * scaling
- Heavy does 120 * scaling

Let me calculate combo damage:
- 4 lights + heavy: 40 + 32 + 26 + 22 + 120*0.4 = 40+32+26+22+48 = 168 (if heavy comes after 4 lights)
- Wait, let me recalculate. After light hits, opponent is in 15 hitstun. Light is 5+3+9=17 ticks total. But with cancel, we skip the 9 recovery.
- So light -> cancel -> light: opponent is in hitstun for 15 ticks, we start next light immediately after active (5+3=8 ticks from start, but with cancel we skip recovery)
- Actually, the cancel happens the tick after the hit. So we're at tick 6 (startup 5 + 1 active tick that hits), then we cancel and start next light. Next light has 5 startup + 3 active. The opponent has 15 hitstun from the hit.
- Time from hit to next hit: 1 (cancel tick) + 5 (startup) + up to 3 (active) = up to 9 ticks. Opponent has 15 hitstun. So we have 6 ticks of buffer. Good.
- After 4 lights, we can do heavy: 9 startup + 4 active. From the 4th light hit: 1 + 9 + 4 = 14 ticks. Opponent has 15 hitstun from 4th hit. Just barely makes it!
- Actually wait, let me re-read. "轻拳打中对手（不是被挡）后的下一个 tick，额外调用你一次" - the next tick after light hits, you get called. So if light hits on tick X (during active phase), on tick X+1 you get called with canCancel=true. You return 'heavy', and heavy starts immediately. Heavy has 9 startup + 4 active. So the heavy's active starts at X+1+9 = X+10. Opponent has 15 hitstun starting from X, so hitstun ends at X+15. Heavy active is at X+10 to X+13. This connects!

- After 4 lights + heavy: 40 + 40*0.8 + 40*0.65 + 40*0.55 + 120*0.45 = 40 + 32 + 26 + 22 + 54 = 174 damage
- Or 3 lights + heavy: 40 + 32 + 26 + 120*0.55 = 40 + 32 + 26 + 66 = 164
- Or 2 lights + heavy: 40 + 32 + 120*0.65 = 40 + 32 + 78 = 150
- Or 1 light + heavy: 40 + 120*0.8 = 40 + 96 = 136
- Or 4 lights + blast: 40 + 32 + 26 + 22 + 70*0.45 = 40 + 32 + 26 + 22 + 31.5 = 151.5
- Or 4 lights + beam: 40 + 32 + 26 + 22 + 280*0.45 = 40 + 32 + 26 + 22 + 126 = 246 (but beam has 30 startup, way too slow for combo)

Wait, beam has 30 startup. After the 4th light hit, we have 15 hitstun on opponent. 1 (cancel) + 30 (startup) = 31 ticks. Opponent recovers at tick 15. So beam doesn't combo after lights! Only light, heavy, and blast can cancel.

Actually re-reading: "这时返回 light、heavy、blast 或 beam，新招马上开始" - you CAN cancel into beam. But beam has 30 startup. The opponent has 15 hitstun. 1 + 30 = 31 > 15. So beam won't connect as a combo. It'll whiff unless opponent is still in hitstun somehow.

Actually wait - blast has 11 startup. 1 + 11 = 12 < 15. So blast combos after light!
Heavy has 9 startup. 1 + 9 = 10 < 15. Heavy combos!

So optimal combos:
- Light x4 -> Heavy: 40 + 32 + 26 + 22 + 120*0.45 = 174 (heavy is 5th hit, scaling 0.45)

Wait, let me recount. The combo counter tracks consecutive hits without the opponent becoming free.
- Hit 1 (light): scaling 1.0, damage 40
- Hit 2 (light): scaling 0.8, damage 32
- Hit 3 (light): scaling 0.65, damage 26
- Hit 4 (light): scaling 0.55, damage 22
- Hit 5 (heavy): scaling 0.45, damage 54

Total: 174. Not bad but not amazing.

Alternative: Light x2 -> Heavy:
- Hit 1: 40
- Hit 2: 32
- Hit 3 (heavy): 120*0.65 = 78
Total: 150

Light x1 -> Heavy:
- Hit 1: 40
- Hit 2 (heavy): 120*0.8 = 96
Total: 136

Hmm, more lights = more total damage but takes longer and risks getting interrupted.

What about Light -> Blast?
- Hit 1: 40
- Hit 2 (blast): 70*0.8 = 56
Total: 96

Not as good as light -> heavy.

Let me think about what makes a winning strategy:

1. **Consistency**: Don't make mistakes. Don't walk into heavy. Don't charge in front of opponent.
2. **Pressure**: Keep opponent on defense with light chains.
3. **Mix-ups**: Alternate between light, heavy, and guard to keep opponent guessing.
4. **Punishment**: When opponent whiffs or is in recovery, punish hard.
5. **Ki management**: Save ki for key moments (dash to avoid beam, blast for pressure).
6. **Adaptation**: Try to read opponent patterns.

Let me think about the meta:
- Since all 4 bots read the same rules, they'll likely have similar strategies
- A bot that's too aggressive will get punished by guard + heavy
- A bot that's too defensive will lose to chip damage and time
- The best strategy is probably balanced aggression with good defense

Let me design my bot:

**State-based approach:**

1. If in clash: push if I have advantage, otherwise save ki
2. If canCancel: continue combo (light up to 3, then heavy)
3. If opponent is in recovery/startup of a move: punish
4. If opponent is attacking: guard or back
5. If at range: approach or blast
6. If close: mix light/heavy/guard

Let me code this up:

```js
// Track some state
let lastOppState = null;
let oppAttackCount = 0;
let myAggression = 0.6; // tune this
let roundsPlayed = 0;

function decide(state) {
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  const R = RULES;
  
  // Clash handling
  if (state.clash) {
    return handleClash(state);
  }
  
  // Cancel handling (combo continuation)
  if (me.canCancel) {
    return handleCancel(state);
  }
  
  // React to incoming blasts
  const incomingBlast = state.blasts.find(b => b.incoming);
  if (incomingBlast && incomingBlast.eta !== null && incomingBlast.eta <= 3) {
    // Guard or dash
    if (me.ki >= 10 && Math.random() < 0.3) return 'dash_back';
    return 'guard';
  }
  
  // React to opponent's beam startup
  if (opp.state === 'beam' && opp.phase === 'startup') {
    // Rush in to punish the 30-tick startup
    if (dist > 200) return 'forward';
    if (dist <= 140) return 'heavy'; // punish
    return 'forward';
  }
  
  // Opponent is in beam firing - dodge or guard
  if (opp.state === 'beam' && opp.phase === 'firing') {
    if (me.ki >= 10) return 'dash_back';
    return 'guard';
  }
  
  // Opponent in recovery - punish!
  if (opp.state === 'light' || opp.state === 'heavy') {
    if (opp.phase === 'recovery') {
      if (dist <= 110) return 'light';
      if (dist <= 140) return 'heavy';
      return 'forward';
    }
  }
  
  // Opponent is in hitstun - continue pressure
  if (opp.state === 'hitstun' || opp.state === 'blockstun') {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent is guarding - mix up
  if (opp.state === 'guard') {
    if (dist <= 140) {
      // Heavy crushes guard, but risky if they time it
      if (Math.random() < 0.3) return 'heavy';
      return 'light'; // chip them or bait
    }
    return 'forward';
  }
  
  // Opponent is charging - punish!
  if (opp.state === 'charge') {
    if (dist <= 110) return 'light';
    if (dist <= 140) return 'heavy';
    return 'forward';
  }
  
  // Default behavior based on distance
  if (dist > 300) {
    // Far range: approach or blast
    if (me.ki >= 20 && Math.random() < 0.2) return 'blast';
    return 'forward';
  } else if (dist > 140) {
    // Mid range: careful approach
    if (Math.random() < 0.15 && me.ki >= 20) return 'blast';
    if (Math.random() < 0.1 && me.ki >= 10) return 'dash_forward';
    return 'forward';
  } else {
    // Close range: fight!
    return closeRange(state);
  }
}
```

Hmm, let me think more carefully. I need to be smarter about:

1. **Reading the opponent**: Track what they do and adapt
2. **Not being predictable**: Mix up my attacks
3. **Defensive awareness**: Guard at the right times
4. **Ki efficiency**: Don't waste ki

Let me also think about what other bots might do:
- Simple aggressive bot: always forward + light
- Zoning bot: stays back, throws blasts
- Defensive bot: guards a lot, counters
- Beam bot: tries to land beams

My bot should handle all of these.

Let me refine my approach:

**Key principles:**
1. At close range, light is the best tool (fast, chains, safe on block)
2. Heavy is the guard-crush tool but very punishable on whiff (35 total ticks)
3. Guard is safe against light and blast but loses to heavy
4. Back away from heavy startup
5. Rush beam startup
6. Use blast for space control
7. Dash to dodge key attacks

Let me think about the light punch more carefully:
- Light: 5 startup + 3 active + 9 recovery = 17 ticks total
- If blocked: opponent gets 11 blockstun, pushed back 14
- If hit: opponent gets 15 hitstun, pushed back 14
- I can cancel on hit into another light

The key insight: after my light hits, I get a cancel. If I don't cancel, my recovery is 9 ticks. Opponent has 15 hitstun. So opponent recovers 6 ticks before I do. That means if I don't cancel, opponent can hit me!

So I MUST cancel after a hit, or at least be aware that not canceling is dangerous.

After cancel into next light:
- I start new light immediately (tick after hit)
- New light: 5 startup + 3 active
- Opponent has 15 hitstun from previous hit
- My active starts at tick 6 (1 cancel + 5 startup)
- Opponent hitstun ends at tick 15
- So I have 9 ticks of buffer. Very safe.

After 4 lights (max chain), if I try a 5th light, chain resets. But I can do heavy:
- After 4th light hit, cancel into heavy
- Heavy: 9 startup + 4 active
- Active starts at tick 10 (1 cancel + 9 startup)
- Opponent has 15 hitstun
- Heavy connects at tick 10-13, opponent recovers at tick 15. Connects!

After heavy, opponent is knocked down for 42 ticks. I have heavy recovery of 22 ticks. So I recover 20 ticks before opponent gets up. Good positioning time.

Let me also think about blast:
- 20 ki cost
- 11 startup + 18 recovery = 29 total
- Flies at 13/tick
- From 40 in front of me
- If opponent is 300 away, blast reaches them in (300-40)/13 ≈ 20 ticks after it spawns
- Total time from decision to hit: 11 + 20 = 31 ticks
- Opponent can react (they get called every 6 ticks)

Blast is mainly for:
1. Punishing from range when opponent is in recovery
2. Forcing opponent to guard (giving me time to approach)
3. Anti-approach tool

Let me think about beam:
- 50 ki cost
- 30 startup (VERY punishable)
- 40 fire, 20 recovery = 90 total
- 280 damage, knockdown 50
- If it hits, it's devastating
- But 30 startup means opponent has 30 ticks to react
- At 6 ticks per decision, opponent gets ~5 decisions during startup
- If opponent is close, they can hit me during startup
- Only safe if opponent is far away or in hitstun

Beam is good for:
1. Punishing knocked down opponent (they can't act for 42+ ticks)
2. Catching opponent who's far and not paying attention
3. After a blast hits (20 hitstun, but beam startup is 30... doesn't combo)

Actually, beam after knockdown: opponent is down for 42 ticks. Beam startup is 30. So beam fires at tick 30, opponent is still down until tick 42. But beam needs to reach them. Beam front starts at 40 from me and moves at 30/tick. If opponent is 300 away (after knockback), beam reaches them at (300-40)/30 ≈ 8.7 ticks after firing. So tick 30+9=39. Opponent is down until 42. Just barely! But they might get up and dodge.

Actually, after heavy knockdown: opponent is knocked back 150 and down for 42 ticks. If I start beam immediately after heavy recovery (22 ticks after heavy starts), opponent has been down for 22 ticks already. They have 20 more ticks of down. Beam startup is 30. So beam fires at tick 30 after I start it. Opponent gets up at tick 20 (remaining down time). So opponent gets up 10 ticks before beam fires. They can dodge or guard.

Hmm, beam is really hard to land. Maybe only use it when opponent is in a long hitstun or when they're cornered.

Let me think about a more practical strategy:

**My game plan:**
1. Open with forward approach, looking for light range
2. At light range, throw lights and chain them
3. Mix in occasional heavy to crush guard
4. Guard when opponent attacks
5. Back away from heavy
6. Use blast for poke at mid range
7. Use dash to close distance or escape
8. Save ki for defensive dashes and occasional blasts
9. Only beam when very safe (opponent knocked down far away, or opponent in long hitstun)

Let me also think about the "reading" aspect:
- If opponent keeps guarding, use more heavies
- If opponent keeps attacking, guard more
- If opponent keeps backing up, chase with blasts
- Track patterns over the match

Now let me write the actual code. I'll try to make it robust and not too complex:

```js
let oppGuardCount = 0;
let oppAttackCount = 0;
let lastOppState = 'idle';
let myLastAction = 'idle';
let approachTimer = 0;

function decide(state) {
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  const R = RULES;
  
  // Track opponent behavior
  if (opp.state === 'guard' && lastOppState !== 'guard') oppGuardCount++;
  if ((opp.state === 'light' || opp.state === 'heavy') && lastOppState !== opp.state) oppAttackCount++;
  lastOppState = opp.state;
  
  // Clash
  if (state.clash) return clashDecide(state);
  
  // Cancel (combo continuation)
  if (me.canCancel) return cancelDecide(state);
  
  // Dodge incoming threats
  const threat = state.blasts.find(b => b.incoming && b.eta !== null && b.eta <= 4);
  
  // Opponent beam startup - rush to punish
  if (opp.state === 'beam' && opp.phase === 'startup') {
    if (dist <= 140) return 'heavy';
    return 'forward';
  }
  
  // Opponent beam firing - get away
  if (opp.state === 'beam' && opp.phase === 'firing') {
    if (me.ki >= R.dash.cost) return 'dash_back';
    return 'back';
  }
  
  // Incoming blast
  if (threat) {
    if (threat.eta <= 2) {
      if (me.ki >= R.dash.cost && Math.random() < 0.4) return 'dash_back';
      return 'guard';
    }
    if (dist > 200) return 'forward'; // walk through it... no, bad idea
    return 'guard';
  }
  
  // Opponent in startup of a move - they're committed
  if ((opp.state === 'light' || opp.state === 'heavy') && opp.phase === 'startup') {
    if (opp.state === 'heavy') {
      // Back away from heavy
      return 'back';
    }
    // Light startup is fast, can't react much
    if (dist <= 110) return 'guard';
    return 'back';
  }
  
  // Opponent in recovery - punish!
  if ((opp.state === 'light' || opp.state === 'heavy' || opp.state === 'blast') && opp.phase === 'recovery') {
    if (dist <= 110) return 'light';
    if (dist <= 140) return 'heavy';
    return 'forward';
  }
  
  // Opponent in hitstun/blockstun - pressure
  if (opp.state === 'hitstun' || opp.state === 'blockstun') {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent is down - position or setup
  if (opp.state === 'down') {
    if (dist > 200 && me.ki >= 50) return 'beam'; // risky but can catch them getting up
    if (dist > 140) return 'forward';
    return 'guard'; // wait for them to get up
  }
  
  // Opponent charging - free hit!
  if (opp.state === 'charge') {
    if (dist <= 110) return 'light';
    if (dist <= 140) return 'heavy';
    return 'forward';
  }
  
  // Opponent guarding
  if (opp.state === 'guard') {
    if (dist <= 140) {
      // Mix up: heavy crushes guard, but light is safer
      if (oppGuardCount > 3 && Math.random() < 0.4) return 'heavy';
      return 'light';
    }
    return 'forward';
  }
  
  // Opponent idle or moving - neutral game
  if (dist > 300) {
    // Far: approach, maybe blast
    if (me.ki >= 20 && Math.random() < 0.15) return 'blast';
    return 'forward';
  }
  
  if (dist > 140) {
    // Mid: approach carefully
    if (Math.random() < 0.05 && me.ki >= 20) return 'blast';
    if (Math.random() < 0.05 && me.ki >= 10) return 'dash_forward';
    return 'forward';
  }
  
  // Close range combat
  return closeCombat(state);
}

function closeCombat(state) {
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  const r = Math.random();
  
  if (dist <= 110) {
    // In light range
    if (opp.state === 'guard') {
      if (r < 0.3) return 'heavy';
      return 'light';
    }
    if (r < 0.6) return 'light';
    if (r < 0.75) return 'heavy';
    if (r < 0.9) return 'guard';
    return 'back';
  }
  
  if (dist <= 140) {
    // In heavy range but not light
    if (r < 0.4) return 'light'; // step in will happen? No, light is an attack not movement
    if (r < 0.6) return 'forward'; // close to light range
    if (r < 0.8) return 'guard';
    return 'back';
  }
  
  return 'forward';
}

function cancelDecide(state) {
  const me = state.me;
  const chain = me.chain;
  const opp = state.opp;
  
  // Chain lights up to 3, then finish with heavy
  if (chain < 3) return 'light';
  if (chain === 3) {
    // 4th light or go to heavy
    if (me.ki >= 20 && Math.random() < 0.2) return 'blast'; // mix up
    return 'light'; // 4th light
  }
  // chain >= 4: can't do more lights, use heavy
  return 'heavy';
}

function clashDecide(state) {
  const clash = state.clash;
  const me = state.me;
  
  // Push if I have power advantage or if clash is near me
  if (clash.pos < 0.35) return 'push'; // point is near me, push!
  if (clash.myPower > clash.oppPower) return 'push';
  if (me.ki > 20) return 'push';
  return 'idle'; // save ki
}
```

Wait, I need to reconsider some things:

1. When I return 'forward', I move toward opponent. But I don't attack. I need to be in light range to attack.
2. The 'light' action starts the light punch animation. I don't move during it.
3. I should think about spacing more carefully.

Also, I realize I should think about what happens when both players are at light range:
- If I throw light and opponent throws light, we trade (both get hit)
- If I throw light and opponent guards, my light is blocked (I get pushed back)
- If I guard and opponent throws light, I block (gain 2 ki)
- If I throw heavy and opponent guards, I crush their guard
- If I throw heavy and opponent throws light, depends on timing

The light has 5 startup. Heavy has 9 startup. So if both throw at the same time:
- Light active at tick 5-7
- Heavy active at tick 9-12
- Light hits first! But heavy has more range (140 vs 110)

So at range 111-140, heavy hits but light doesn't. At range <= 110, light hits first if both start at same time.

This means:
- At close range (< 110), light beats heavy (hits first)
- At mid range (111-140), heavy hits but light doesn't
- Guard beats light but loses to heavy
- Heavy beats guard but loses to light (at close range)

This is a classic rock-paper-scissors: Light > Heavy (at close range), Heavy > Guard, Guard > Light.

My strategy should exploit this:
- If opponent tends to guard: use heavy
- If opponent tends to attack: use guard then punish
- If opponent tends to heavy: use light (hits first) or back away

Let me also think about the "reading" aspect more carefully. Since I play 1000 rounds against each opponent, I can learn their patterns within those rounds. But each round is independent (variables reset). Wait, no: "文件的顶层代码在每局开始时执行一次" - top-level code runs once per round. So variables reset each round. I can't learn across rounds.

But within a round, I can track what the opponent does and adapt.

Let me also consider: since all bots see the same rules, they'll likely have similar strategies. The best bot will be the one that:
1. Makes fewer mistakes
2. Adapts better within a round
3. Has good mix-ups
4. Manages resources well

Let me refine my code:

Actually, I want to think about this more carefully. Let me consider the key scenarios:

**Scenario 1: Both players approach**
- They'll meet at some point
- First to throw an attack at the right range wins
- Light at <= 110, heavy at <= 140

**Scenario 2: One player guards**
- Attacker can't hurt with light (blocked)
- Attacker can crush with heavy
- But if attacker does heavy and defender stops guarding, defender can punish

**Scenario 3: One player uses blast**
- Opponent can guard (12 chip) or dash
- If guarded, defender gains 2 ki
- If not guarded, 70 damage + 20 hitstun

**Scenario 4: One player uses beam**
- 30 tick startup is very long
- If opponent is close, they can hit during startup
- If opponent is far, they might not react in time
- Beam does 280 damage if it connects

**Scenario 5: Clash**
- Both players used beam at the same time
- Push to win, but it costs ki
- Power depends on ki, push, and HP

OK let me write a more refined version. I want to be:
1. Aggressive but not reckless
2. Good at defending
3. Adaptable within a round
4. Efficient with ki

Let me think about what a really strong bot would do:

The key insight is that this game rewards **conditioning** and **adaptation**. Since I can't learn across rounds, I need to:
1. Start with a balanced strategy
2. Within the round, detect what the opponent is doing and adjust
3. Mix up my own actions to be unpredictable

Let me think about the optimal strategy more carefully:

**At close range (< 110):**
- Light is the best move (fast, chains, safe)
- Heavy is the mix-up (crushes guard, but slow)
- Guard is defensive (beats light, loses to heavy)
- Back creates space

The optimal mix depends on what the opponent does:
- If they guard a lot: increase heavy frequency
- If they attack a lot: increase guard frequency, then punish
- If they back a lot: chase with forward + light

**At mid range (110-200):**
- Forward to close distance
- Blast to poke
- Dash to close quickly
- Guard if expecting blast

**At long range (> 200):**
- Forward to close
- Blast to poke
- Charge to build ki (risky)

Let me write the final version:

Actually, I want to think about one more thing: the timing of decisions.

I get called every 6 ticks when free. That means I have 6 ticks between decisions. In 6 ticks:
- Forward: I move 27 units
- Back: I move 18 units
- Light: I go through 6 of 17 ticks (still in startup/active)
- Heavy: I go through 6 of 35 ticks (still in startup)

So if I decide to walk forward, I'll walk for 6 ticks before deciding again. That's 27 units of movement.

If I'm at distance 130 and walk forward for 6 ticks, I'll be at distance 103. Then I can decide to throw a light.

This means I need to plan ahead: "If I walk forward now, will I be in range for an attack next decision?"

Let me incorporate this into my logic:
- If dist is 111-137 (110 + 27), walking forward will put me in light range next decision
- If dist is 141-167, walking forward will put me in heavy range next decision

OK, I think I have enough understanding. Let me write the final code.

One more thing: I should think about what makes a bot WIN consistently:
1. Landing hits without getting hit
2. Winning trades (my hit does more than theirs)
3. Not getting caught in bad situations
4. Managing the clock (if I'm ahead in HP, play safe; if behind, take risks)

Let me also think about the "meta" of this tournament:
- Most bots will probably be aggressive (rush in and attack)
- A bot that guards well and counter-attacks will beat aggressive bots
- But a bot that uses heavy will beat a guarding bot
- So the meta will be: aggressive > defensive > heavy mix-up > aggressive

I should aim for a balanced approach that can handle all types.

Let me finalize my code. I'll aim for:
1. Smart approach (don't just walk in blindly)
2. Good mix-ups at close range
3. Solid defense (guard when appropriate)
4. Punish opponent's mistakes
5. Use ki wisely
6. Adapt within the round

Here's my refined approach:

```js
// State tracking within the round
let oppGuards = 0;
let oppAttacks = 0;
let oppHeavies = 0;
let lastOppState = '';
let lastOppPhase = '';
let aggression = 0.65;
let prevDist = 999;

function decide(state) {
  const { me, opp, dist, t, timeLeft } = state;
  const R = RULES;
  
  // Track opponent patterns
  if (opp.state !== lastOppState) {
    if (opp.state === 'guard') oppGuards++;
    if (opp.state === 'light' || opp.state === 'heavy') {
      oppAttacks++;
      if (opp.state === 'heavy') oppHeavies++;
    }
    lastOppState = opp.state;
  }
  
  // === CLASH ===
  if (state.clash) return doClash(state);
  
  // === CANCEL (combo continuation) ===
  if (me.canCancel) return doCancel(state);
  
  // === REACTIVE DECISIONS ===
  
  // Opponent beam startup - rush to interrupt
  if (opp.state === 'beam' && opp.phase === 'startup') {
    if (dist <= R.heavy.reach) return 'heavy';
    if (dist <= R.light.reach) return 'light';
    return 'forward';
  }
  
  // Opponent beam firing - evade
  if (opp.state === 'beam' && opp.phase === 'firing') {
    if (me.ki >= R.dash.cost) return 'dash_back';
    return 'guard';
  }
  
  // Incoming blast - guard or dodge
  const incoming = state.blasts.find(b => b.incoming && b.eta !== null);
  if (incoming && incoming.eta <= 5) {
    if (incoming.eta <= 2 && me.ki >= R.dash.cost && Math.random() < 0.3) {
      return 'dash_back';
    }
    return 'guard';
  }
  
  // Opponent in recovery - punish
  if (opp.phase === 'recovery' && (opp.state === 'light' || opp.state === 'heavy' || opp.state === 'blast' || opp.state === 'dash')) {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // Opponent in hitstun/blockstun - continue pressure
  if (opp.state === 'hitstun' || opp.state === 'blockstun') {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'forward'; // close in
    return 'forward';
  }
  
  // Opponent is down - reposition
  if (opp.state === 'down') {
    if (dist > 250 && me.ki >= R.beam.cost && Math.random() < 0.15) return 'beam';
    if (dist > R.heavy.reach) return 'forward';
    return 'idle'; // wait
  }
  
  // Opponent charging - free damage!
  if (opp.state === 'charge') {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // Opponent crushed (stunned from guard break) - punish!
  if (opp.state === 'crushed') {
    if (dist <= R.light.reach) return 'light';
    return 'forward';
  }
  
  // === PROACTIVE DECISIONS ===
  
  // Opponent guarding - mix up
  if (opp.state === 'guard') {
    if (dist <= R.heavy.reach) {
      const heavyChance = Math.min(0.5, 0.15 + oppGuards * 0.05);
      if (Math.random() < heavyChance) return 'heavy';
      if (dist <= R.light.reach) return 'light';
      return 'forward';
    }
    return 'forward';
  }
  
  // Opponent in startup - react
  if (opp.phase === 'startup') {
    if (opp.state === 'heavy') {
      // Back away from heavy, or hit them first if very close
      if (dist <= R.light.reach && opp.t < 3) return 'light'; // try to beat it
      return 'back';
    }
    if (opp.state === 'light') {
      if (dist <= R.light.reach) return 'guard';
      return 'back';
    }
    if (opp.state === 'blast') {
      return 'forward'; // close the gap
    }
  }
  
  // Opponent idle/forward/back - neutral game
  if (dist > 350) {
    if (me.ki >= R.blast.cost && Math.random() < 0.12) return 'blast';
    return 'forward';
  }
  
  if (dist > R.heavy.reach + 30) {
    if (me.ki >= R.blast.cost && Math.random() < 0.08) return 'blast';
    if (me.ki >= R.dash.cost && Math.random() < 0.06) return 'dash_forward';
    return 'forward';
  }
  
  if (dist > R.light.reach) {
    // Between light and heavy range
    const r = Math.random();
    if (r < 0.5) return 'forward';
    if (r < 0.65) return 'guard';
    if (r < 0.8 && me.ki >= R.blast.cost) return 'blast';
    return 'back';
  }
  
  // In light range - the main fight
  return doCloseRange(state);
}

function doCloseRange(state) {
  const { me, opp, dist } = state;
  const r = Math.random();
  
  // If opponent is attacking, guard
  if (opp.state === 'light' || opp.state === 'heavy') {
    if (opp.phase === 'startup' || opp.phase === 'active') {
      if (r < 0.6) return 'guard';
      return 'back';
    }
  }
  
  // If I'm low HP, play safer
  if (me.hp < 300) {
    if (r < 0.3) return 'guard';
    if (r < 0.5) return 'back';
  }
  
  // Main close range mix
  const heavyChance = Math.min(0.35, 0.1 + oppGuards * 0.04);
  
  if (r < 0.5) return 'light';
  if (r < 0.5 + heavyChance) return 'heavy';
  if (r < 0.7 + heavyChance) return 'guard';
  if (r < 0.85) return 'back';
  return 'forward';
}

function doCancel(state) {
  const { me, opp } = state;
  const chain = me.chain;
  
  if (chain < 3) return 'light'; // continue chain
  
  if (chain === 3) {
    // 4th light or switch to heavy
    if (opp.state === 'guard') return 'heavy'; // they're blocking, crush them
    return 'light'; // go for 4th
  }
  
  // chain >= 4, must use heavy/blast/beam
  if (me.ki >= RULES.heavy.reach ? 0 : 0) {} // just checking
  return 'heavy';
}

function doClash(state) {
  const { clash, me } = state;
  
  // Always push if clash point is very close to me
  if (clash.pos < 0.25) return 'push';
  
  // Push if I have power advantage
  if (clash.myPower > clash.oppPower * 1.2) return 'push';
  
  // Push if I have ki to spare
  if (me.ki > 40) return 'push';
  
  // Push if opponent is low HP (they can't afford to lose)
  if (state.opp.hp < 300 && me.ki > 15) return 'push';
  
  // Otherwise, save ki
  if (me.ki < 10) return 'idle';
  
  // Moderate push
  return Math.random() < 0.6 ? 'push' : 'idle';
}
```

Hmm, I think this is decent but let me refine it more. Let me think about some edge cases:

1. What if I'm cornered (wallBehind is small)?
   - I should be more aggressive (can't back away)
   - Or use dash to escape

2. What if opponent is cornered?
   - I should pressure more
   - They can't back away

3. What if time is running out?
   - If I'm ahead in HP, play safe
   - If I'm behind, take more risks

4. What about ki management?
   - Don't waste ki on blasts if I might need dash
   - Save 10 ki for emergency dash
   - Use beam only when very safe

Let me also think about the "beating the meta" aspect. If most bots are aggressive:
- Guarding a lot will beat them (light is blocked, gain ki)
- But heavy crushes guard, so I need to watch for that
- If opponent does heavy, I should back away or light (beats heavy at close range)

If most bots are defensive:
- Heavy will crush their guard
- But they might be expecting heavy and attack
- Mix up between light, heavy, and forward

I think a balanced approach with good adaptation is the way to go.

Let me also add some "smart" behaviors:
- Don't walk into heavy range when opponent is in heavy startup
- Don't charge when opponent is close (they'll hit me for 1.5x)
- Use blast to control space when backing away
- Dash through blasts sometimes to surprise opponent

One more thing: the decide function is called every 6 ticks when I'm free. But if I'm in hitstun or recovery, I don't get called until I'm free again. So I need to make the most of each decision.

Let me finalize the code. I want it to be:
1. Not too long (keep it manageable)
2. Robust (handle edge cases)
3. Adaptive (track opponent patterns)
4. Efficient (don't waste time or ki)

Actually, let me reconsider the combo system. When I get canCancel:
- chain 1: I just landed my 1st light. I can do another light (chain becomes 2).
- chain 2: 2nd light landed. Can do 3rd.
- chain 3: 3rd light landed. Can do 4th (max) or heavy/blast/beam.
- chain 4: 4th light landed. Can only do heavy/blast/beam (no more lights).

Wait, re-reading the rules: "一串取消里最多 4 记轻拳（state.me.chain 是这一串已经出了几拳）"

So chain tracks how many lights I've thrown in this chain. If chain is 4, I've thrown 4 lights and can't throw more. But I can still cancel into heavy/blast/beam.

Let me re-examine: when canCancel is true and chain is 1, it means I've thrown 1 light that hit. I can now throw another light (chain will become 2), or heavy, blast, beam.

When chain is 4, I've thrown 4 lights. I can't throw a 5th light. But I can cancel into heavy, blast, or beam.

So my cancel logic should be:
- chain < 4: can do light (continue chain) or heavy/blast/beam
- chain >= 4: can only do heavy/blast/beam

For optimal damage:
- 4 lights + heavy: 40 + 32 + 26 + 22 + 120*0.45 = 174
- 3 lights + heavy: 40 + 32 + 26 + 120*0.55 = 164
- 2 lights + heavy: 40 + 32 + 120*0.65 = 150
- 1 light + heavy: 40 + 120*0.8 = 136

More lights = more total damage but takes longer. The risk is that the opponent might escape hitstun if I take too long. But as I calculated, 4 lights + heavy still combos (barely).

However, there's a risk: if the opponent somehow escapes (e.g., they were in reduced hitstun for some reason), I'll be stuck in heavy recovery. Let me check: light gives 15 hitstun. After 4 lights, the 4th hit gives 15 hitstun. I cancel into heavy (9 startup + 4 active). Heavy active starts at tick 10 after the hit. Opponent recovers at tick 15. So I have 5 ticks of buffer. Safe.

But what about push? Each light pushes opponent back 14. After 4 lights, opponent has been pushed back 56 units. If opponent was at the wall, the push goes to me instead. So at the wall, I don't push them back, and the combo works better.

Actually, re-reading: "轻拳被挡：没有伤害，挡的人被推开 14（他背靠擂台边时，改成出拳的人被推开），硬直 11 tick。轻拳打中时也一样推开。"

So when light HITS (not blocked), opponent is also pushed back 14. If opponent is at the wall, I get pushed back instead. This means at the wall, I can't combo as easily because I get pushed away.

Hmm, but the push is 14 per hit. After 4 hits, opponent is pushed back 56. If they started at the wall... well, they can't be pushed past the wall. So the push goes to me. This means after each light at the wall, I get pushed back 14. After 4 lights, I'm 56 units further from the wall.

This is important for corner combos. If opponent is cornered:
- My light hits, they can't be pushed back, so I get pushed back 14
- Now I'm 14 units further away
- Next light might not reach if I'm too far

Light reach is 110. If I start at distance 100, after hitting and getting pushed back 14, I'm at distance 114. Next light won't reach! I need to walk forward 4 units, but I can't walk during a combo.

Wait, but with cancel, I start the next light immediately. The distance check happens during the active phase. Let me think...

After light hits at distance D:
- Opponent pushed back 14 (or I get pushed back 14 if they're at wall)
- I cancel into next light
- Next light has 5 startup, then 3 active
- During active, distance must be <= 110

If I got pushed back 14, new distance is D + 14. If D was 100, new distance is 114. Light won't reach!

So at the wall, I can only do 1-2 lights before being pushed out of range. Unless I was very close initially.

This is an important consideration. Let me factor it in:
- If opponent is near the wall, my combos will be shorter
- If I'm near the wall, opponent's combos will be shorter

OK, I think I've analyzed enough. Let me write the final code.

One more consideration: the random seed. Math.random() is seeded per round, so it's deterministic. This means I can use it for mix-ups and it'll be consistent within a round. But I can't use it to "learn" since each round has a different seed.

Let me write the final version now. I'll aim for a balanced, adaptive strategy:

```js
// === State tracking ===
let oppGuardStreak = 0;
let oppAttackStreak = 0;
let lastOppState = '';
let roundPhase = 'opening'; // opening, midgame, endgame
let kiSpent = 0;

function decide(state) {
  const { me, opp, dist, t, timeLeft } = state;
  const R = RULES;
  
  // Update phase
  if (t < 600) roundPhase = 'opening';
  else if (t < 2400) roundPhase = 'midgame';
  else roundPhase = 'endgame';
  
  // Track opponent
  if (opp.state !== lastOppState) {
    if (opp.state === 'guard') { oppGuardStreak++; oppAttackStreak = 0; }
    else if (opp.state === 'light' || opp.state === 'heavy') { oppAttackStreak++; oppGuardStreak = 0; }
    else { oppGuardStreak = Math.max(0, oppGuardStreak - 1); oppAttackStreak = Math.max(0, oppAttackStreak - 1); }
    lastOppState = opp.state;
  }
  
  // === SPECIAL STATES ===
  if (state.clash) return clashLogic(state);
  if (me.canCancel) return cancelLogic(state);
  
  // === THREAT RESPONSE ===
  
  // Beam startup - punish
  if (opp.state === 'beam' && opp.phase === 'startup') {
    if (dist <= R.heavy.reach) return 'heavy';
    if (dist <= R.light.reach) return 'light';
    return 'forward';
  }
  
  // Beam firing - evade
  if (opp.state === 'beam' && opp.phase === 'firing') {
    if (me.ki >= R.dash.cost) return 'dash_back';
    return 'guard';
  }
  
  // Incoming blast
  const inc = state.blasts.find(b => b.incoming && b.eta !== null && b.eta <= 5);
  if (inc) {
    if (inc.eta <= 2 && me.ki >= R.dash.cost && Math.random() < 0.25) return 'dash_back';
    return 'guard';
  }
  
  // Opponent recovery - punish
  if (opp.phase === 'recovery' && ['light','heavy','blast','dash'].includes(opp.state)) {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // Opponent stunned - pressure
  if (opp.state === 'hitstun' || opp.state === 'blockstun' || opp.state === 'crushed') {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach && opp.state === 'crushed') return 'heavy';
    return 'forward';
  }
  
  // Opponent down
  if (opp.state === 'down') {
    if (dist > 200) return 'forward';
    return 'idle';
  }
  
  // Opponent charging
  if (opp.state === 'charge') {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // === NEUTRAL GAME ===
  
  // Time management
  if (timeLeft < 300) {
    if (me.hp > opp.hp) return 'back'; // protect lead
    if (me.hp < opp.hp) {
      // Need to attack
      if (dist <= R.light.reach) return 'light';
      return 'forward';
    }
  }
  
  // Opponent guarding
  if (opp.state === 'guard') {
    if (dist <= R.heavy.reach) {
      const hChance = Math.min(0.45, 0.15 + oppGuardStreak * 0.06);
      if (Math.random() < hChance) return 'heavy';
      if (dist <= R.light.reach) return 'light';
    }
    return 'forward';
  }
  
  // Opponent in startup
  if (opp.phase === 'startup') {
    if (opp.state === 'heavy') {
      if (dist <= R.light.reach && opp.t <= 2) return 'light';
      return 'back';
    }
    if (opp.state === 'light') {
      if (dist <= R.light.reach) return 'guard';
      return 'back';
    }
  }
  
  // Distance-based decisions
  if (dist > 400) {
    if (me.ki >= R.blast.cost && Math.random() < 0.1) return 'blast';
    return 'forward';
  }
  
  if (dist > R.heavy.reach + 40) {
    if (me.ki >= R.blast.cost && Math.random() < 0.08) return 'blast';
    return 'forward';
  }
  
  if (dist > R.light.reach) {
    if (Math.random() < 0.6) return 'forward';
    if (Math.random() < 0.3) return 'guard';
    return 'back';
  }
  
  // Close range
  return closeFight(state);
}
```

Actually, I realize I should think about this differently. Let me consider what makes a truly strong bot:

1. **Frame knowledge**: Know exactly when moves come out and what beats what
2. **Spacing**: Maintain optimal distance
3. **Conditioning**: Train the opponent to expect one thing, then do another
4. **Resource management**: Ki, HP, time
5. **Adaptation**: Change strategy based on what works

Since I can't learn across rounds, I need to be good at reading the opponent within a single round and adapting.

Let me think about the most common scenarios and what the optimal response is:

1. **Opponent walks forward**: I should either meet them with a light or guard their attack
2. **Opponent throws light**: Guard it, then punish during their recovery
3. **Opponent throws heavy**: Back away, then punish during recovery (22 ticks!)
4. **Opponent guards**: Throw heavy to crush, or light to chip
5. **Opponent uses blast**: Guard or dash
6. **Opponent uses beam**: Rush to punish startup
7. **Opponent charges**: Hit them (1.5x damage!)
8. **Opponent is in recovery**: Hit them (1.25x damage!)

The key is to be in the right state at the right time. Let me focus on making good decisions in each situation.

I think my code above is pretty good. Let me refine it and add a few more considerations:

- Wall awareness: Don't get cornered
- Ki threshold: Keep 10 ki for emergency dash
- Combo scaling awareness: Don't do too many lights if damage is too low
- HP awareness: Play safer when low HP

Let me write the final version:

Actually, one thing I want to reconsider: should I use beam at all?

Beam: 50 ki, 30 startup, 40 fire, 20 recovery, 280 damage, knockdown 50
- Very high damage
- But 30 tick startup is extremely punishable
- If opponent is close, they can hit me during startup
- If opponent guards, they take 120 chip damage and are stunned until beam ends

Beam is good when:
1. Opponent is knocked down and far away
2. Opponent is in a long hitstun
3. Opponent is in beam startup (beam vs beam = clash)
4. As a surprise when opponent is far and not expecting it

I'll include beam as a rare option.

Let me also think about dash:
- 10 ki, 10 ticks movement, 8 recovery
- 200 distance in 10 ticks
- First 9 ticks invulnerable
- Can go through opponent

Dash is good for:
1. Dodging blasts and beams
2. Closing distance quickly
3. Escaping pressure
4. Going through opponent to confuse them

I'll use dash sparingly but effectively.

OK here's my final strategy outline:

**Opening (first 10 seconds):**
- Walk forward to mid range
- Maybe throw a blast to probe
- See what opponent does

**Mid game:**
- Close to light range
- Mix lights, heavies, guards
- Adapt to opponent's tendencies
- Use blast for space control

**End game:**
- If ahead: play safe, guard, back away
- If behind: take risks, go aggressive
- Use remaining ki wisely

Let me write the final code now. I'll keep it clean and well-organized.

Let me also think about one more thing: the "free" function in the engine. When a fighter becomes free (recovers from stun/recovery), they get asked immediately (nextAsk = tick + 1). This means I get an immediate decision after recovering. I should take advantage of this to immediately attack or defend.

Also, when I'm in hitstun/blockstun, I can't do anything. When I recover, I should immediately decide what to do. The engine will call me right away.

OK, I'm going to write the final code now. Let me make it comprehensive but not overly complex.

Let me reconsider the structure. I want:

1. A main decide function that handles all cases
2. Helper functions for specific situations
3. State tracking for adaptation
4. Good default behavior

Here's my final attempt:

```js
// Per-round state
let oppGuards = 0, oppAttacks = 0, oppHeavies = 0;
let lastOppState = '', lastOppPhase = '';
let prevMyHp = 1000, prevOppHp = 1000;
let gotHitRecently = false;
let hitStreak = 0;

function decide(state) {
  const { me, opp, dist, t, timeLeft } = state;
  const R = RULES;
  
  // Track patterns
  if (opp.state !== lastOppState || opp.phase !== lastOppPhase) {
    if (opp.state === 'guard') oppGuards++;
    if (opp.state === 'light' || opp.state === 'heavy') {
      oppAttacks++;
      if (opp.state === 'heavy') oppHeavies++;
    }
    lastOppState = opp.state;
    lastOppPhase = opp.phase;
  }
  
  // Track if I got hit
  if (me.hp < prevMyHp) gotHitRecently = true;
  if (opp.hp < prevOppHp) hitStreak++;
  else hitStreak = 0;
  prevMyHp = me.hp;
  prevOppHp = opp.hp;
  
  // === CLASH ===
  if (state.clash) {
    const c = state.clash;
    if (c.pos < 0.3) return 'push';
    if (c.myPower > c.oppPower) return 'push';
    if (me.ki > 30) return 'push';
    return me.ki > 10 ? (Math.random() < 0.5 ? 'push' : 'idle') : 'idle';
  }
  
  // === COMBO CANCEL ===
  if (me.canCancel) {
    const chain = me.chain;
    if (chain < 3) return 'light';
    if (chain === 3) {
      // 4th light or heavy
      if (opp.state === 'guard') return 'heavy'; // crush
      if (dist > 100) return 'heavy'; // might be out of light range after push
      return 'light';
    }
    // chain >= 4
    return 'heavy';
  }
  
  // === REACTIVE ===
  
  // Beam startup - rush to punish
  if (opp.state === 'beam' && opp.phase === 'startup') {
    if (dist <= R.heavy.reach) return 'heavy';
    if (dist <= R.light.reach) return 'light';
    return 'forward';
  }
  
  // Beam firing - get away
  if (opp.state === 'beam' && opp.phase === 'firing') {
    if (me.ki >= R.dash.cost) return 'dash_back';
    return 'guard';
  }
  
  // Incoming blast
  const inc = state.blasts.find(b => b.incoming && b.eta !== null && b.eta <= 6);
  if (inc) {
    if (inc.eta <= 2) {
      if (me.ki >= R.dash.cost && Math.random() < 0.3) return 'dash_back';
      return 'guard';
    }
    // Can try to dash through or just guard
    if (dist > 200) return 'forward'; // walk into it? No, bad
    return 'guard';
  }
  
  // Opponent in recovery - punish
  if (opp.phase === 'recovery' && ['light','heavy','blast','dash'].includes(opp.state)) {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // Opponent in hitstun/blockstun/crushed
  if (['hitstun','blockstun','crushed'].includes(opp.state)) {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'forward';
    return 'forward';
  }
  
  // Opponent down
  if (opp.state === 'down') {
    if (dist > R.heavy.reach) return 'forward';
    // Wait for them to get up, then attack
    return 'idle';
  }
  
  // Opponent charging
  if (opp.state === 'charge') {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // === OPPONENT GUARDING ===
  if (opp.state === 'guard') {
    if (dist <= R.heavy.reach) {
      const hProb = Math.min(0.5, 0.12 + oppGuards * 0.05);
      if (Math.random() < hProb) return 'heavy';
      if (dist <= R.light.reach) return 'light';
      return 'forward';
    }
    return 'forward';
  }
  
  // === OPPONENT ATTACKING ===
  if (opp.state === 'light' || opp.state === 'heavy') {
    if (opp.phase === 'startup') {
      if (opp.state === 'heavy') {
        if (dist <= R.light.reach && opp.t < 4) return 'light'; // beat it
        return 'back';
      }
      if (opp.state === 'light') {
        if (dist <= R.light.reach) return 'guard';
        return 'back';
      }
    }
    if (opp.phase === 'active') {
      return 'guard';
    }
  }
  
  // === NEUTRAL GAME ===
  
  // Time pressure
  if (timeLeft < 300 && me.hp > opp.hp + 50) {
    return dist > 200 ? 'back' : 'guard';
  }
  
  // Far range
  if (dist > 400) {
    if (me.ki >= R.blast.cost && Math.random() < 0.12) return 'blast';
    return 'forward';
  }
  
  // Mid range
  if (dist > R.heavy.reach + 30) {
    if (me.ki >= R.blast.cost && Math.random() < 0.07) return 'blast';
    if (me.ki >= R.dash.cost && Math.random() < 0.05) return 'dash_forward';
    return 'forward';
  }
  
  // Close-mid range
  if (dist > R.light.reach) {
    const r = Math.random();
    if (r < 0.55) return 'forward';
    if (r < 0.7) return 'guard';
    if (r < 0.85 && me.ki >= R.blast.cost) return 'blast';
    return 'back';
  }
  
  // === CLOSE RANGE ===
  const r = Math.random();
  const hProb = Math.min(0.3, 0.08 + oppGuards * 0.04);
  
  if (r < 0.45) return 'light';
  if (r < 0.45 + hProb) return 'heavy';
  if (r < 0.7) return 'guard';
  if (r < 0.85) return 'back';
  return 'forward';
}
```

This looks pretty good. Let me review it once more:

1. Clash handling: Push when losing or when I have advantage ✓
2. Cancel: Chain lights, finish with heavy ✓
3. Beam startup: Rush to punish ✓
4. Beam firing: Dash away or guard ✓
5. Incoming blast: Guard or dash ✓
6. Opponent recovery: Punish ✓
7. Opponent stunned: Pressure ✓
8. Opponent down: Approach ✓
9. Opponent charging: Hit them ✓
10. Opponent guarding: Mix light/heavy ✓
11. Opponent attacking: Guard or back ✓
12. Neutral: Distance-based decisions ✓
13. Close range: Mix of attacks, guard, movement ✓

I think this is solid. Let me add a few more refinements:

- Wall awareness: If I'm near the wall, be more aggressive (can't back away)
- If opponent is near the wall, pressure more
- Ki management: Don't use blast if ki < 30 (save for dash)

Actually, let me reconsider the close range logic. The issue is that if I just spam light, a smart opponent will guard and then heavy me. If I just spam heavy, they'll back away and punish. I need a good mix.

The optimal mix depends on what the opponent does:
- If they guard: increase heavy
- If they attack: increase guard
- If they back: increase forward + light

My current code does this with oppGuards tracking. Let me make sure the probabilities are reasonable.

At close range:
- 45% light
- 8-30% heavy (based on opponent's guard frequency)
- 25% guard
- 15% back
- 10% forward (to maintain distance)

This seems reasonable. Against a guarding opponent, heavy goes up to 30%. Against an aggressive opponent, I'll guard more because they'll be in startup/active states.

Wait, actually if the opponent is in 'idle' or 'forward' state at close range, my close range logic applies. If they're in 'light' or 'heavy' state, the earlier reactive logic handles it. So the close range mix is for when both of us are free and in range.

Let me also think about what happens if both players throw light at the same time:
- Both lights have 5 startup
- They'll both hit on the same tick (active at tick 5-7)
- Both take 40 damage
- Both get 15 hitstun
- Both get pushed back 14
- This is a "trade"

Trading lights is neutral (both take same damage). But if I can get a cancel and they can't (because I hit first or simultaneously), I have an advantage.

Actually, if both hit simultaneously, both get hitstun. Neither gets a cancel (cancel only happens when YOUR light hits, and both are in hitstun). Wait, let me re-read:

"你的轻拳打中对手（不是被挡）之后的下一个 tick，额外调用你一次"

If both lights hit simultaneously, both players' lights hit. So both should get cancel? But both are in hitstun. Let me check the engine code...

In the strikes function:
```js
for (const [a, o, kind, x] of todo) { a.hit = true; land(m, a, o, kind, { dir: a.x > o.x ? 1 : -1, mult: x }); }
```

Both hits are processed. In land():
```js
if (kind === 'light') { stun(o, 'hitstun', M.hitstun); pushApart(m, a, o, M.push); if (a.state === 'light') { a.cancel = true; } }
```

So both get hitstun, and both get cancel = true. But then stun() is called which sets:
```js
function stun(o, state, dur) {
  o.state = state; o.t = 0; o.dur = dur; o.hit = false; o.cancel = false; o.dash = null; o.push = false;
}
```

Wait, stun sets cancel = false! But in land(), after stun(o, ...), it sets a.cancel = true. So the attacker's cancel is set AFTER the defender's stun. Let me trace through:

For hit 1 (a hits o):
1. stun(o, 'hitstun', 15) -> o.cancel = false
2. pushApart(m, a, o, 14)
3. a.cancel = true (a is the attacker)

For hit 2 (o hits a, processed second):
1. stun(a, 'hitstun', 15) -> a.cancel = false (this overwrites the cancel from hit 1!)
2. pushApart(m, o, a, 14)
3. o.cancel = true

So in a trade, the first attacker's cancel gets overwritten by their own hitstun. The second attacker gets cancel = true but is also in hitstun.

Wait, but the wants() function checks:
```js
const wants = (m, a) => !m.over && a.state !== 'ko' && (a.cancel || ((FREE.has(a.state) || a.state === 'clash') && m.tick >= a.nextAsk));
```

If a is in hitstun, FREE.has('hitstun') is false, and a.cancel might be true. So a.cancel is checked first. If cancel is true, they get asked even in hitstun!

But wait, in choose():
```js
if (a.cancel) {
  a.cancel = false;
  if ((act === 'light' && a.chain < R.light.chain) || act === 'heavy' || act === 'blast' || act === 'beam') start(m, a, act, true);
  return;
}
```

If they're in hitstun but cancel is true, they can cancel into a new move! This would effectively let them act during hitstun.

Hmm, but in the trade scenario, let me re-trace:

Both a and o throw light. Both are in 'light' state.

strikes() processes both:
- First [a, o, 'light', mult]: a.hit = true, land(m, a, o, 'light', ...)
  - o is not guarding, so: stun(o, 'hitstun', 15), pushApart, a.cancel = true
- Second [o, a, 'light', mult]: o.hit = true, land(m, o, a, 'light', ...)
  - a is not guarding, so: stun(a, 'hitstun', 15), pushApart, o.cancel = true

After strikes:
- a: state = 'hitstun', cancel = false (set by stun), then... wait, stun sets cancel = false. But then land sets a.cancel = true. But a was the attacker in the first hit and the defender in the second.

Let me re-read land more carefully:

```js
function land(m, a, o, kind, ctx) {
  // a is attacker, o is defender
  ...
  stun(o, 'hitstun', M.hitstun); // o (defender) gets stunned, cancel = false
  pushApart(m, a, o, M.push);
  if (a.state === 'light') { a.cancel = true; } // a (attacker) gets cancel
}
```

So for the first hit (a attacks o):
- o gets stunned (cancel = false)
- a gets cancel = true

For the second hit (o attacks a):
- a gets stunned (cancel = false) <- this overwrites a's cancel!
- o gets cancel = true

So after both hits:
- a: hitstun, cancel = false
- o: hitstun, cancel = true

Wait, that's asymmetric! The second attacker gets cancel but the first doesn't. This is because the second land() call stuns the first attacker, overwriting their cancel.

Actually, let me re-read. In the strikes function, both are collected in todo first, then processed:

```js
for (const [a, o, kind, x] of todo) { a.hit = true; land(m, a, o, kind, ...); }
```

The todo array has both [a, o] and [o, a]. They're processed in order. Let's say a is fighter 0 and o is fighter 1.

Processing [a, o]:
- stun(o, 'hitstun', 15) -> o.state = 'hitstun', o.cancel = false
- a.cancel = true

Processing [o, a]:
- But wait, o is now in hitstun. Does the strike still process?
- Looking at strikes(): `if ((a.state !== 'light' && a.state !== 'heavy') || a.hit || phase(R, a) !== 'active') continue;`
- o.state was 'light' when it was added to todo. But now it's 'hitstun'. However, the todo was already built. The check happens during collection, not during processing.
- So yes, [o, a] is still in todo and will be processed.
- stun(a, 'hitstun', 15) -> a.state = 'hitstun', a.cancel = false (overwrites!)
- o.cancel = true (but o is in hitstun)

So after a trade:
- a: hitstun, cancel = false
- o: hitstun, cancel = true

But o is in hitstun. Can o use the cancel? Let's check wants():
```js
const wants = (m, a) => !m.over && a.state !== 'ko' && (a.cancel || ...)
```

o.cancel is true, so wants returns true. o gets asked. In choose():
```js
if (a.cancel) {
  a.cancel = false;
  if (...) start(m, a, act, true);
  return;
}
```

o can cancel out of hitstun into a new move! This is a huge advantage for the second player processed.

But wait, this depends on the order in the todo array. The todo array is built by iterating `for (const a of m.f)`, so fighter 0 is checked first, then fighter 1. If both have active attacks, both are added to todo. The processing order is [fighter0 attacks fighter1, fighter1 attacks fighter0].

So in a trade, fighter 1 (the second one processed as attacker) gets cancel, and fighter 0 doesn't. This is a slight advantage for fighter 1.

Hmm, but this might be intentional or just an artifact. In any case, it means trading lights is slightly favorable for one side.

This doesn't change my strategy much. I should still try to hit without getting hit. But it's good to know.

OK, I think I've analyzed enough. Let me finalize the code.

One more thing: I should handle the case where I'm near the wall. If wallBehind is small, I can't back away. I should be more aggressive or use dash to escape.

Also, I should consider: if I'm at the wall and opponent is pressing me, I can't back away. I should guard or attack. If I guard, they might heavy me. If I attack, they might guard. It's a guessing game.

Let me add wall awareness:

```js
// If I'm near the wall, be more aggressive (can't retreat)
if (state.wallBehind < 100) {
  // Increase attack probability
  // Decrease back probability
}
```

OK, let me write the final code. I'll make it comprehensive but not too long.

Actually, I want to reconsider one thing: should I use beam at all? The 30-tick startup is really long. In 30 ticks, the opponent gets 5 decisions (every 6 ticks). They can easily react.

The only safe time to use beam is:
1. Opponent is knocked down (42+ ticks of downtime)
2. Opponent is in a very long hitstun
3. Opponent is in beam startup (beam vs beam = clash, which might be favorable)

For case 1: After heavy knockdown (42 ticks), I have 22 ticks of recovery. So I recover at tick 22, opponent gets up at tick 42. I have 20 ticks to start beam. Beam startup is 30. So beam fires at tick 30 after I start it, which is tick 52 after the heavy. Opponent gets up at tick 42. They have 10 ticks to react. They can dash or guard.

Hmm, 10 ticks is enough for them to react (they get called every 6 ticks, so they get 1-2 decisions). They can guard the beam (120 chip) or dash.

So beam after knockdown is not very effective. Maybe I should skip it.

For case 3: If opponent uses beam and I also use beam, we get a clash. In a clash, power depends on ki and pushing. If I have more ki, I'll win. But clashes are risky (320 damage if I lose).

I think beam is generally not worth it. The risk/reward ratio is bad. I'll include it as a very rare option (maybe when opponent is far and I have 50+ ki and they're in a vulnerable state).

Let me finalize:

```js
// I'll use beam very rarely, only when:
// 1. Opponent is down and far away
// 2. I have 50+ ki
// 3. It's late in the round and I need damage
```

OK, final code time. Let me write it clean and complete.

Let me think about one more strategy element: the "footsies" game. In fighting games, footsies is about controlling space at mid range. In this game:

- At range > 140, neither light nor heavy can hit
- At range 111-140, heavy can hit but light can't
- At range <= 110, both can hit, but light is faster

So the key ranges are:
- > 140: safe, can walk freely
- 111-140: heavy range, dangerous
- <= 110: light range, very dangerous

My strategy should be:
- Approach to just outside heavy range (> 140)
- Then decide: dash in to light range, or walk in carefully
- At light range, throw lights
- If opponent backs away, follow

The "dash in" option is interesting: dash_forward covers 200 units in 10 ticks with 9 ticks of invulnerability. If I dash from range 200, I end up at range 0 (or rather, at minGap 60). I'm invulnerable for 9 of the 10 ticks. Then 8 ticks of recovery.

During the dash, opponent can't hit me. After the dash, I'm right next to them. They might be in the middle of an attack (which I dodged) and I can punish.

But dash costs 10 ki. I need to manage ki carefully.

OK, I think I have a good understanding now. Let me write the final code.

Let me also consider: what if the opponent is very aggressive and just rushes in with lights? My best response is:
1. Guard their light (gain 2 ki, no damage)
2. They're in 9 ticks of recovery after the light
3. I have 11 ticks of blockstun
4. After blockstun, they have 9 - 11 = -2 ticks... wait, they have 9 recovery and I have 11 blockstun. So I recover 2 ticks AFTER them. They can hit me again!

Hmm, that's bad. If I guard a light, I'm in blockstun for 11 ticks. They're in recovery for 9 ticks. They recover 2 ticks before me. They can throw another light.

But wait, the light pushes the blocker back 14. So after the first light, I'm 14 units further away. If they were at range 100, now they're at range 114. Light reach is 110. They can't hit me with light anymore! They need to walk forward.

But they recover 2 ticks before me. In 2 ticks, they can walk forward 9 units (4.5 * 2). So they're at range 105. Then I recover. They can throw light (5 startup). I have 5 ticks to react. I can guard.

So the sequence is:
1. They throw light, I guard. I'm pushed back 14.
2. They recover 2 ticks before me.
3. They walk forward 9 units.
4. I recover. They're at range 105.
5. They throw light. I guard. Pushed back 14 again.
6. Repeat.

This means guarding lights is sustainable! They can keep pressing, but I keep blocking and gaining 2 ki per block. Eventually they'll run out of... well, they won't run out of anything. But I'm gaining ki and they're not doing damage.

The problem is: they can mix in a heavy. If I'm guarding and they throw heavy, I get crushed (60 damage, 34 tick stun). That's bad.

So against a light-spamming opponent, I should:
- Guard most lights
- Occasionally back away or attack to break their rhythm
- Watch for heavy and react to it

My current code handles this: if opponent is in heavy startup, I back away. If they're in light, I guard. This should work.

But there's a subtlety: I get called every 6 ticks. If opponent throws light (17 ticks total), I might not get called during their startup. Let me check:

If I'm free and opponent throws light:
- Tick 0: Opponent starts light. I get called (if it's my turn). I see opp.state = 'light', opp.phase = 'startup', opp.t = 0.
- I decide to guard.
- Tick 5: Light becomes active. I'm guarding.
- Tick 5-7: Light hits me (if in range). I block.
- Tick 8-16: I'm in blockstun (11 ticks).
- Tick 17: Opponent's light recovery ends. They're free.
- Tick 19: My blockstun ends (11 ticks from tick 8). I'm free. Get called immediately.

Wait, blockstun is 11 ticks. If I get hit on tick 5, blockstun lasts until tick 16. Opponent's light ends at tick 17 (5+3+9). So I recover at tick 16, opponent at tick 17. I recover 1 tick before them!

Hmm, let me re-check. Light: 5 startup + 3 active + 9 recovery = 17 ticks. The light hits during active (ticks 5-7). Let's say it hits on tick 5 (first active tick).

My blockstun: 11 ticks, starting from tick 5. So I'm in blockstun from tick 5 to tick 15 (11 ticks). I'm free at tick 16.

Opponent's light: starts at tick 0, ends at tick 16 (17 ticks, 0-16). They're free at tick 17.

So I recover at tick 16, they recover at tick 17. I have 1 tick of advantage! But I get called immediately when I become free (nextAsk = tick + 1). So I get called at tick 17. They also get called at tick 17 (or 18?).

Actually, when they become free at tick 17, free() sets nextAsk = tick + 1 = 18. But I became free at tick 16, and free() set nextAsk = 17. So I get asked at tick 17, they get asked at tick 18. I have a 1-tick advantage!

But in that 1 tick, I can't do much. I can start a move. If I start light (5 startup), it becomes active at tick 22. Opponent starts something at tick 18. If they start light, it's active at tick 23. My light hits first!

So guarding a light gives me a slight frame advantage. Good.

But this assumes I'm in range. If the push put me out of range, I need to walk forward first.

OK, I think I've thoroughly analyzed the game. Let me write the final code.

Let me also add one more strategic element: ki charging. If I'm at long range and opponent is not pressuring me, I can charge to build ki. But charging makes me take 1.5x damage if hit. So only charge when safe.

When is it safe to charge?
- When opponent is far away (> 300)
- When opponent is in recovery or hitstun
- When opponent is knocked down

I'll add charging as an option when safe.

Final code:

```js
let oppGuards = 0, oppAttacks = 0;
let lastOppState = '';
let prevMyHp = 1000;

function decide(state) {
  const { me, opp, dist, t, timeLeft, blasts, clash } = state;
  const R = RULES;
  
  // Track
  if (opp.state !== lastOppState) {
    if (opp.state === 'guard') oppGuards++;
    if (opp.state === 'light' || opp.state === 'heavy') oppAttacks++;
    lastOppState = opp.state;
  }
  
  // Clash
  if (clash) {
    if (clash.pos < 0.3) return 'push';
    if (clash.myPower > clash.oppPower) return 'push';
    if (me.ki > 35) return 'push';
    return me.ki > 12 && Math.random() < 0.5 ? 'push' : 'idle';
  }
  
  // Cancel
  if (me.canCancel) {
    if (me.chain < 3) return 'light';
    if (me.chain === 3) return Math.random() < 0.2 ? 'heavy' : 'light';
    return 'heavy';
  }
  
  // Beam startup - punish
  if (opp.state === 'beam' && opp.phase === 'startup') {
    if (dist <= R.heavy.reach) return 'heavy';
    if (dist <= R.light.reach) return 'light';
    return 'forward';
  }
  
  // Beam firing - evade
  if (opp.state === 'beam' && opp.phase === 'firing') {
    if (me.ki >= R.dash.cost) return 'dash_back';
    return 'guard';
  }
  
  // Incoming blast
  const inc = blasts.find(b => b.incoming && b.eta !== null && b.eta <= 5);
  if (inc) {
    if (inc.eta <= 2 && me.ki >= R.dash.cost && Math.random() < 0.25) return 'dash_back';
    return 'guard';
  }
  
  // Opponent recovery - punish
  if (opp.phase === 'recovery' && ['light','heavy','blast','dash'].includes(opp.state)) {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // Opponent stunned
  if (['hitstun','blockstun','crushed'].includes(opp.state)) {
    if (dist <= R.light.reach) return 'light';
    return 'forward';
  }
  
  // Opponent down
  if (opp.state === 'down') {
    if (dist > 200) return 'forward';
    return 'idle';
  }
  
  // Opponent charging
  if (opp.state === 'charge') {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // Opponent guarding
  if (opp.state === 'guard') {
    if (dist <= R.heavy.reach) {
      if (Math.random() < Math.min(0.4, 0.1 + oppGuards * 0.05)) return 'heavy';
      if (dist <= R.light.reach) return 'light';
    }
    return 'forward';
  }
  
  // Opponent attacking
  if ((opp.state === 'light' || opp.state === 'heavy') && (opp.phase === 'startup' || opp.phase === 'active')) {
    if (opp.state === 'heavy') {
      if (dist <= R.light.reach && opp.t < 3) return 'light';
      return 'back';
    }
    if (dist <= R.light.reach) return 'guard';
    return 'back';
  }
  
  // Opponent in blast startup
  if (opp.state === 'blast' && opp.phase === 'startup') {
    return 'forward'; // close the gap
  }
  
  // Time management
  if (timeLeft < 300 && me.hp > opp.hp + 50) {
    if (dist > 200) return 'back';
    return 'guard';
  }
  
  // Safe charge
  if (dist > 350 && me.ki < 60 && opp.state !== 'blast' && Math.random() < 0.1) {
    return 'charge';
  }
  
  // Far range
  if (dist > 400) {
    if (me.ki >= R.blast.cost && me.ki > 30 && Math.random() < 0.1) return 'blast';
    return 'forward';
  }
  
  // Mid range
  if (dist > R.heavy.reach + 30) {
    if (me.ki >= R.blast.cost && me.ki > 30 && Math.random() < 0.06) return 'blast';
    if (me.ki >= R.dash.cost && me.ki > 25 && Math.random() < 0.04) return 'dash_forward';
    return 'forward';
  }
  
  // Close-mid
  if (dist > R.light.reach) {
    const r = Math.random();
    if (r < 0.55) return 'forward';
    if (r < 0.72) return 'guard';
    return 'back';
  }
  
  // Close range
  const r = Math.random();
  const hP = Math.min(0.3, 0.08 + oppGuards * 0.04);
  if (r < 0.45) return 'light';
  if (r < 0.45 + hP) return 'heavy';
  if (r < 0.72) return 'guard';
  if (r < 0.88) return 'back';
  return 'forward';
}
```

Hmm, I think this is good but let me reconsider a few things:

1. The cancel logic: at chain 3, I have 20% chance to go heavy, 80% to do 4th light. Maybe I should always do 4th light then heavy? The 4th light does 40*0.55 = 22 damage. Heavy after 4 lights does 120*0.45 = 54. Total for 4 lights + heavy: 40+32+26+22+54 = 174. For 3 lights + heavy: 40+32+26+78 = 176. Wait, that's more!

Let me recalculate:
- 3 lights + heavy: 40 + 32 + 26 + 120*0.55 = 40 + 32 + 26 + 66 = 164
- 4 lights + heavy: 40 + 32 + 26 + 22 + 120*0.45 = 40 + 32 + 26 + 22 + 54 = 174

4 lights + heavy is more damage. So I should always go for 4 lights then heavy.

But there's a risk: the 4th light might get pushed out of range. And the heavy after 4 lights is at 0.45 scaling. Let me check if it's worth it:
- 4th light: 22 damage
- Then heavy at 0.45: 54 damage
- Total for these two: 76

vs. heavy at 0.55 (after 3 lights): 66 damage

So 4th light + heavy = 76 > heavy alone = 66. Yes, do the 4th light.

But what about blast instead of heavy after 4 lights?
- Blast at 0.45: 70*0.45 = 31.5
- Heavy at 0.45: 120*0.45 = 54

Heavy is better. Stick with heavy.

What about 4 lights + beam?
- Beam at 0.45: 280*0.45 = 126
- But beam has 30 startup. Opponent has 15 hitstun. 1 + 30 = 31 > 15. Doesn't combo!

So beam doesn't work after lights. Heavy is the best finisher.

Updated cancel logic:
- chain < 4: always light
- chain >= 4: heavy (or blast if not enough ki for heavy... wait, heavy doesn't cost ki)

Actually, heavy doesn't cost ki. So I can always do heavy. Let me just always do:
- chain 1-3: light
- chain 4: heavy

Wait, chain represents how many lights I've already thrown. When canCancel is true:
- chain 1: I've thrown 1 light. I can throw light (chain becomes 2), heavy, blast, beam.
- chain 2: thrown 2. Can throw light (chain 3), heavy, blast, beam.
- chain 3: thrown 3. Can throw light (chain 4), heavy, blast, beam.
- chain 4: thrown 4. Can NOT throw light. Can throw heavy, blast, beam.

So:
- chain < 4: return 'light' (continue chain)
- chain >= 4: return 'heavy' (finish)

But wait, at chain 3, should I do the 4th light or go to heavy?
- 4th light + heavy: 22 + 54 = 76
- Heavy now (at 0.55): 66

4th light + heavy is better. So always do 4 lights.

But there's the push issue. After 3 lights, opponent has been pushed back 42 units. If they were at the wall, I've been pushed back 42. I might be out of light range.

Let me check: light reach is 110. If I start at distance 100:
- After 1st light: pushed back 14, distance 114. But wait, I cancel into 2nd light immediately. The 2nd light starts at distance 114. Its reach is 110. It won't reach!

Hmm, this is a problem. After the first light hits and pushes opponent back 14, I'm now 14 units further away. If I was at distance 100, I'm now at 114. Light won't reach.

But wait, the push happens during the active phase. The cancel happens the tick after the hit. Let me trace more carefully:

Tick 0: I start light. Distance = 100.
Tick 5: Light becomes active.
Tick 5 (or 6 or 7): Light hits. Opponent pushed back 14. Distance = 114. I get cancel.
Tick 6 (or 7 or 8): I cancel into next light. Distance = 114.
Tick 11 (or 12 or 13): 2nd light active. Distance = 114. Light reach = 110. 114 > 110. MISS!

So if I start at distance > 96 (110 - 14), the 2nd light won't reach after the push!

This means I need to start my combo at distance <= 96 to get 2 lights. For 3 lights, I need distance <= 96 - 14 = 82. For 4 lights, distance <= 68.

But minGap is 60. So the minimum distance is 60. At distance 60:
- After 1st light: distance 74
- After 2nd: 88
- After 3rd: 102
- After 4th: 116 > 110. MISS!

So even at minimum distance, I can only get 3 lights before being pushed out of range!

Wait, but what about the wall? If opponent is at the wall, the push goes to me instead. Let me re-read:

"轻拳被挡：没有伤害，挡的人被推开 14（他背靠擂台边时，改成出拳的人被推开），硬直 11 tick。轻拳打中时也一样推开。"

So if opponent is at the wall, I get pushed back instead. This means:
- Opponent stays at the wall
- I get pushed back 14 each hit
- Distance increases by 14 each hit

This is the same as before. The combo still breaks after 3 hits at minimum distance.

But wait, what if I'm the one at the wall? Then opponent gets pushed back. Distance increases. Same problem.

Hmm, so 4-light chains are only possible if I start very close AND the push doesn't take me out of range. Let me recalculate:

Starting distance D. After each light, distance increases by 14 (push).
- After 1st: D + 14
- After 2nd: D + 28
- After 3rd: D + 42
- After 4th: D + 56

For the 4th light to connect, D + 42 <= 110, so D <= 68.
For the 3rd light: D + 28 <= 110, D <= 82.
For the 2nd light: D + 14 <= 110, D <= 96.
For the 1st light: D <= 110.

So at distance 60 (minimum), I can get 3 lights (60+28=88 <= 110) but not 4 (60+42=102 <= 110... wait, 102 <= 110, so 4th light DOES connect!).

Let me redo: at distance 60:
- 1st light at 60: connects (60 <= 110). Push: 60+14=74.
- 2nd light at 74: connects (74 <= 110). Push: 74+14=88.
- 3rd light at 88: connects (88 <= 110). Push: 88+14=102.
- 4th light at 102: connects (102 <= 110). Push: 102+14=116.
- Heavy at 116: doesn't connect (116 > 140). Wait, heavy reach is 140. 116 <= 140. Connects!

So at minimum distance, I can get 4 lights + heavy! Total damage: 40 + 32 + 26 + 22 + 54 = 174.

But this only works if I start at distance 60 (minimum gap). In practice, I'll be at some distance > 60. Let me check distance 80:
- 1st: 80, push to 94
- 2nd: 94, push to 108
- 3rd: 108, push to 122 > 110. MISS!

So at distance 80, I can only get 2 lights. At distance 70:
- 1st: 70, push to 84
- 2nd: 84, push to 98
- 3rd: 98, push to 112 > 110. MISS!

Only 2 lights at distance 70. At distance 68:
- 1st: 68, push to 82
- 2nd: 82, push to 96
- 3rd: 96, push to 110
- 4th: 110, push to 124. 110 <= 110. Connects!
- Heavy at 124: 124 <= 140. Connects!

So I need distance <= 68 for 4 lights + heavy. That's very close.

In practice, I'll often be at distance 80-110 when I start a combo. So I'll usually get 1-2 lights. This changes my strategy:

- At distance 60-68: go for 4 lights + heavy
- At distance 69-82: go for 3 lights + heavy
- At distance 83-96: go for 2 lights + heavy
- At distance 97-110: go for 1 light + heavy

But I don't know the exact distance when I'm in the combo. I can check state.dist in the cancel decision.

Let me update my cancel logic:

```js
if (me.canCancel) {
  const d = state.dist;
  if (me.chain < 4 && d <= R.light.reach) {
    return 'light'; // continue if in range
  }
  if (d <= R.heavy.reach) return 'heavy';
  if (me.ki >= R.blast.cost && !me.blastOut) return 'blast';
  return 'idle'; // out of range, just recover
}
```

Wait, but the push happens when the light hits, which is during the active phase. By the time I get the cancel call, the push has already happened. So state.dist reflects the post-push distance.

Let me verify: light hits on tick X. Push happens. On tick X+1, I get called with canCancel. At this point, dist includes the push. So if I was at 100 and hit, dist is now 114. I check: 114 > 110, so light won't reach. I should go to heavy (114 <= 140).

This makes sense. My cancel logic should check the CURRENT distance (post-push) to decide what to do.

Updated cancel logic:
```js
if (me.canCancel) {
  const d = state.dist;
  if (me.chain < 4 && d <= R.light.reach) return 'light';
  if (d <= R.heavy.reach) return 'heavy';
  // Out of range for both, just recover
  return 'idle';
}
```

This is cleaner and more correct. Let me use this.

Actually, I realize there's another subtlety. When I cancel into heavy, the heavy has 9 startup. During those 9 ticks, the opponent is in hitstun (15 ticks from the light). But the opponent was also pushed back. If the push put them at distance 120, heavy reach is 140, so it connects.

But what if the push put them at distance 150? Then heavy won't reach. I should check.

In the cancel logic, I check dist <= R.heavy.reach. If dist > 140, I can't do heavy. I should just recover.

OK, I think my cancel logic is correct now. Let me finalize.

One more thing: after heavy hits, opponent is knocked down for 42 ticks and knocked back 150. I have 22 ticks of heavy recovery. So I recover at tick 22, opponent gets up at tick 42. I have 20 ticks to act. I should walk forward to be in position when they get up.

In my main logic, when opponent is 'down', I return 'forward' if dist > 200, else 'idle'. This should work.

Let me also think about what to do after my light is BLOCKED (not hit). In that case, I don't get a cancel. I go through the full 17 ticks of light. Opponent has 11 ticks of blockstun. I have 9 ticks of recovery after the active. So:
- Light hits (blocked) at tick 5
- My recovery: ticks 8-16 (9 ticks)
- Opponent blockstun: ticks 5-15 (11 ticks)
- I recover at tick 17, opponent at tick 16
- Opponent recovers 1 tick before me!

So if my light is blocked, opponent has a 1-tick advantage. They can start an attack before I can act. This means I should be cautious after a blocked light.

But in practice, the 1-tick advantage is minimal. And the push (14 units) might put them out of range. So it's usually fine.

OK, I'm going to write the final code now. For real this time.

Let me structure it clearly:

```js
// === Per-round state ===
let oppGuardCount = 0;
let lastOppState = '';

function decide(state) {
  // 1. Clash
  // 2. Cancel
  // 3. Reactive (beam, blast, opponent states)
  // 4. Neutral game (distance-based)
  // 5. Close range combat
}
```

Let me write it all out now, clean and final:

Actually, I want to add one more strategic element: adaptation within the round. I'll track how many times the opponent guards vs attacks, and adjust my mix accordingly.

- If oppGuardCount is high: use more heavies
- If opponent attacks a lot: guard more, then counter

I'll also track if my attacks are getting blocked or hitting, to adjust.

But I need to be careful not to over-complicate. The bot needs to run within 200ms per call and 1500ms per match. Simple logic is fast.

Let me keep it simple but effective. Here's my final code:

I also want to make sure I handle edge cases:
- What if I'm at the wall and can't back away?
- What if opponent is at the wall?
- What if both are at low HP?
- What if time is almost up?

Let me handle these in the code.

OK here's my truly final version. Let me write it out completely.

Actually, I want to reconsider one more time whether to include beam. Let me think about when beam is actually useful:

1. **Opponent knocked down far away**: After heavy, opponent is knocked back 150 and down for 42 ticks. If I start beam immediately after heavy recovery, beam fires at tick 30. Opponent gets up at tick 42 - 22 (my recovery) = 20 ticks after I start beam. So opponent gets up 10 ticks before beam fires. They can react.

2. **Opponent in long hitstun**: Blast gives 20 hitstun. Beam startup is 30. Doesn't combo.

3. **Opponent in beam startup**: If I also start beam, we get a clash. This can be good if I have more ki.

4. **Surprise at long range**: If opponent is far and not expecting it, beam might catch them. But 30 ticks is long enough for them to react.

5. **End of round**: If I'm behind in HP and time is running out, beam is a Hail Mary.

I think beam is mostly useful in case 3 (clash) and case 5 (desperation). I'll include it as a rare option.

For the clash strategy: if I'm in a clash, I should push if I have the advantage. My power = 1 + 0.02 * ki + 0.6 (if pushing) + 0.4 (if HP < 30%). So with 50 ki and pushing: 1 + 1 + 0.6 = 2.6. Without pushing: 2.0.

The opponent's power depends on their ki and whether they push. If they have less ki, I should push. If they have more, I should save ki.

In the clash, both lose 0.2 ki per tick, and the pusher loses 0.6 more. So pushing costs 0.8 ki per tick. Over 100 ticks, that's 80 ki. I need to manage ki carefully in a clash.

My clash strategy:
- If clash point is very close to me (< 0.2), always push (I'm about to lose)
- If I have power advantage, push
- If I have lots of ki (> 50), push
- Otherwise, save ki

OK, final code for real:

```js
let oppGuards = 0;
let lastOppState = '';

function decide(state) {
  const me = state.me, opp = state.opp, dist = state.dist;
  const R = RULES;
  
  if (opp.state !== lastOppState) {
    if (opp.state === 'guard') oppGuards++;
    lastOppState = opp.state;
  }
  
  // Clash
  if (state.clash) {
    const c = state.clash;
    if (c.pos < 0.25) return 'push';
    if (c.myPower > c.oppPower) return 'push';
    if (me.ki > 40) return 'push';
    if (me.ki > 15) return Math.random() < 0.5 ? 'push' : 'idle';
    return 'idle';
  }
  
  // Cancel
  if (me.canCancel) {
    if (me.chain < 4 && dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'idle';
  }
  
  // Opponent beam startup
  if (opp.state === 'beam' && opp.phase === 'startup') {
    if (dist <= R.heavy.reach) return 'heavy';
    if (dist <= R.light.reach) return 'light';
    return 'forward';
  }
  
  // Opponent beam firing
  if (opp.state === 'beam' && opp.phase === 'firing') {
    return me.ki >= R.dash.cost ? 'dash_back' : 'guard';
  }
  
  // Incoming blast
  const inc = state.blasts.find(b => b.incoming && b.eta !== null && b.eta <= 5);
  if (inc) {
    if (inc.eta <= 2 && me.ki >= R.dash.cost && Math.random() < 0.3) return 'dash_back';
    return 'guard';
  }
  
  // Opponent in recovery
  if (opp.phase === 'recovery' && ['light','heavy','blast','dash'].includes(opp.state)) {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // Opponent stunned
  if (['hitstun','blockstun','crushed'].includes(opp.state)) {
    if (dist <= R.light.reach) return 'light';
    return 'forward';
  }
  
  // Opponent down
  if (opp.state === 'down') {
    return dist > 180 ? 'forward' : 'idle';
  }
  
  // Opponent charging
  if (opp.state === 'charge') {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // Opponent guarding
  if (opp.state === 'guard') {
    if (dist <= R.heavy.reach) {
      if (Math.random() < Math.min(0.4, 0.12 + oppGuards * 0.05)) return 'heavy';
      if (dist <= R.light.reach) return 'light';
    }
    return 'forward';
  }
  
  // Opponent attacking
  if ((opp.state === 'light' || opp.state === 'heavy') && opp.phase !== 'recovery') {
    if (opp.state === 'heavy') {
      if (dist <= R.light.reach && opp.t < 3) return 'light';
      return 'back';
    }
    return dist <= R.light.reach ? 'guard' : 'back';
  }
  
  // Opponent blast startup
  if (opp.state === 'blast' && opp.phase === 'startup') return 'forward';
  
  // Time management
  if (state.timeLeft < 300 && me.hp > opp.hp + 50) {
    return dist > 250 ? 'back' : 'guard';
  }
  
  // Far range
  if (dist > 400) {
    if (me.ki >= R.blast.cost && me.ki > 35 && Math.random() < 0.1) return 'blast';
    return 'forward';
  }
  
  // Mid range
  if (dist > R.heavy.reach + 20) {
    if (me.ki >= R.blast.cost && me.ki > 35 && Math.random() < 0.06) return 'blast';
    if (me.ki >= R.dash.cost && me.ki > 25 && Math.random() < 0.04) return 'dash_forward';
    return 'forward';
  }
  
  // Close-mid
  if (dist > R.light.reach) {
    const r = Math.random();
    return r < 0.6 ? 'forward' : r < 0.8 ? 'guard' : 'back';
  }
  
  // Close range
  const r = Math.random();
  const hp = Math.min(0.3, 0.08 + oppGuards * 0.04);
  if (r < 0.45) return 'light';
  if (r < 0.45 + hp) return 'heavy';
  if (r < 0.72) return 'guard';
  if (r < 0.88) return 'back';
  return 'forward';
}
```

This looks good. Let me review it one more time:

1. ✅ Clash handling
2. ✅ Cancel/combo
3. ✅ Beam startup punishment
4. ✅ Beam firing evasion
5. ✅ Blast defense
6. ✅ Recovery punishment
7. ✅ Stun pressure
8. ✅ Downed opponent handling
9. ✅ Charge punishment
10. ✅ Guard mix-up
11. ✅ Attack defense
12. ✅ Time management
13. ✅ Range-based decisions
14. ✅ Close range mix

I think this is solid. Let me add a few more touches:

- Wall awareness
- Better ki management
- Slightly more aggression when opponent is low HP

Actually, let me keep it simple. The code is already comprehensive. Adding more complexity might introduce bugs.

One thing I want to double-check: the `state.me.blastOut` field. This tells me if I already have a blast on screen. I should check this before trying to blast. But the engine already handles this: if I try to blast while one is out, it's ignored. So I don't need to check.

Similarly for ki: if I don't have enough ki, the move is ignored. So I don't need to check ki for moves (except for strategic reasons, like saving ki for dash).

Let me finalize. I'm happy with this code. Let me format it nicely.

Wait, one more thought: should I ever use 'idle'? In my current code, I return 'idle' in some cases (cancel when out of range, when opponent is down and close). But 'idle' means I just stand there. Maybe 'guard' would be better in some cases (to protect against surprise attacks).

When opponent is down and close: they'll get up and might attack. I should guard or back away. Let me change 'idle' to 'guard' in that case.

When cancel and out of range: I'm in the middle of a light punch animation. If I return 'idle', I just stand there. 'guard' might be safer. But actually, after a cancel, if I return something that's not light/heavy/blast/beam, I just continue the normal recovery of the current light. So returning 'idle' or 'guard' doesn't matter much - I'll be in recovery either way.

Actually, re-reading the cancel logic:
```js
if (a.cancel) {
  a.cancel = false;
  if ((act === 'light' && a.chain < R.light.chain) || act === 'heavy' || act === 'blast' || act === 'beam') start(m, a, act, true);
  return;
}
```

If I return something other than light/heavy/blast/beam, the cancel is just consumed and I continue the normal recovery. So I'll be in the recovery of my current light. That's fine.

OK, I'm truly finalizing now. Let me write the clean version.

Hmm, actually let me reconsider the overall strategy one more time. I want to make sure I'm not too predictable.

My close range mix: 45% light, ~8-30% heavy, ~25% guard, ~15% back, ~10% forward.

This means I attack about 53-75% of the time at close range. That's pretty aggressive. Against a guarding opponent, this is good (lots of chip damage, occasional crush). Against an attacking opponent, I'll guard about 25% of the time, which might not be enough.

But wait, if the opponent is in 'light' or 'heavy' state, my reactive logic kicks in and I guard or back away. So the close range mix only applies when both of us are in a free state (idle, forward, back, guard, charge).

If the opponent is free and I'm free at close range, they might be about to attack. My 25% guard chance should catch some of their attacks. And my 45% light chance means I'll often attack first (light has 5 startup, which is fast).

I think the mix is reasonable. Let me go with it.

One last thing: I should make sure I don't waste too much time thinking. The code should be fast. No complex loops or calculations. Just simple if-else chains. My code is all simple comparisons and random rolls, so it should be well within the time limit.

OK, truly final version now. Let me write it.

Let me also add: when I'm at very low HP (< 200), I should be more desperate. Maybe use beam as a Hail Mary. And when opponent is at very low HP, I should go for the kill.

```js
// Desperation beam
if (me.hp < 150 && me.ki >= R.beam.cost && dist > 200 && state.timeLeft < 600) {
  return 'beam';
}

// Go for the kill
if (opp.hp < 100 && dist <= R.heavy.reach) {
  return 'heavy';
}
```

I'll add these as special cases.

OK, writing the final code now. I'll aim for clean, readable, effective code.

Let me reconsider the structure one more time. I want the decision priority to be:

1. Clash (must handle)
2. Cancel (must handle, time-sensitive)
3. Immediate threats (beam firing, incoming blast)
4. Punish opportunities (opponent in recovery, stunned, charging)
5. Opponent state reactions (guarding, attacking, down)
6. Strategic decisions (time, HP, ki management)
7. Default neutral game (distance-based)

This priority order makes sense. Let me structure the code this way.

Final code:

```js
// AI Fighter - "Iron Fist"
// Strategy: Aggressive pressure with adaptive mix-ups

let oppGuards = 0;
let lastOppState = '';

function decide(state) {
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  const R = RULES;

  // Track opponent tendencies
  if (opp.state !== lastOppState) {
    if (opp.state === 'guard') oppGuards++;
    lastOppState = opp.state;
  }

  // === 1. CLASH ===
  if (state.clash) {
    const c = state.clash;
    if (c.pos < 0.25) return 'push';           // about to lose, push!
    if (c.myPower > c.oppPower) return 'push';  // winning, keep pushing
    if (me.ki > 40) return 'push';              // ki to spare
    return me.ki > 15 && Math.random() < 0.4 ? 'push' : 'idle';
  }

  // === 2. CANCEL (combo continuation) ===
  if (me.canCancel) {
    if (me.chain < 4 && dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'idle';
  }

  // === 3. IMMEDIATE THREATS ===
  
  // Opponent beam firing - evade
  if (opp.state === 'beam' && opp.phase === 'firing') {
    return me.ki >= R.dash.cost ? 'dash_back' : 'guard';
  }

  // Incoming blast
  const inc = state.blasts.find(b => b.incoming && b.eta !== null && b.eta <= 5);
  if (inc) {
    if (inc.eta <= 2 && me.ki >= R.dash.cost && Math.random() < 0.3) return 'dash_back';
    return 'guard';
  }

  // === 4. PUNISH OPPORTUNITIES ===
  
  // Opponent beam startup - rush to interrupt
  if (opp.state === 'beam' && opp.phase === 'startup') {
    if (dist <= R.heavy.reach) return 'heavy';
    if (dist <= R.light.reach) return 'light';
    return 'forward';
  }

  // Opponent in recovery - punish
  if (opp.phase === 'recovery' && ['light', 'heavy', 'blast', 'dash'].includes(opp.state)) {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }

  // Opponent stunned - pressure
  if (['hitstun', 'blockstun', 'crushed'].includes(opp.state)) {
    if (dist <= R.light.reach) return 'light';
    return 'forward';
  }

  // Opponent charging - free hit (1.5x damage!)
  if (opp.state === 'charge') {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }

  // === 5. OPPONENT STATE REACTIONS ===
  
  // Opponent down
  if (opp.state === 'down') {
    return dist > 180 ? 'forward' : 'guard';
  }

  // Opponent guarding - mix up
  if (opp.state === 'guard') {
    if (dist <= R.heavy.reach) {
      const hProb = Math.min(0.4, 0.12 + oppGuards * 0.05);
      if (Math.random() < hProb) return 'heavy';
      if (dist <= R.light.reach) return 'light';
    }
    return 'forward';
  }

  // Opponent attacking
  if ((opp.state === 'light' || opp.state === 'heavy') && opp.phase !== 'recovery') {
    if (opp.state === 'heavy') {
      if (dist <= R.light.reach && opp.t < 3) return 'light'; // beat the startup
      return 'back';
    }
    return dist <= R.light.reach ? 'guard' : 'back';
  }

  // Opponent blast startup - close the gap
  if (opp.state === 'blast' && opp.phase === 'startup') return 'forward';

  // === 6. STRATEGIC ===
  
  // Time management: protect lead
  if (state.timeLeft < 300 && me.hp > opp.hp + 50) {
    return dist > 250 ? 'back' : 'guard';
  }

  // Desperation: low HP, need big damage
  if (me.hp < 120 && me.ki >= R.beam.cost && dist > 250 && state.timeLeft < 900) {
    return 'beam';
  }

  // Kill shot
  if (opp.hp <= R.heavy.damage && dist <= R.heavy.reach) return 'heavy';
  if (opp.hp <= R.light.damage && dist <= R.light.reach) return 'light';

  // === 7. NEUTRAL GAME ===
  
  // Far range
  if (dist > 400) {
    if (me.ki >= R.blast.cost && me.ki > 35 && Math.random() < 0.1) return 'blast';
    return 'forward';
  }

  // Mid range
  if (dist > R.heavy.reach + 20) {
    if (me.ki >= R.blast.cost && me.ki > 35 && Math.random() < 0.06) return 'blast';
    if (me.ki >= R.dash.cost && me.ki > 25 && Math.random() < 0.04) return 'dash_forward';
    return 'forward';
  }

  // Close-mid range (between light and heavy reach)
  if (dist > R.light.reach) {
    const r = Math.random();
    return r < 0.6 ? 'forward' : r < 0.8 ? 'guard' : 'back';
  }

  // === CLOSE RANGE ===
  const r = Math.random();
  const heavyProb = Math.min(0.3, 0.08 + oppGuards * 0.04);
  
  if (r < 0.45) return 'light';
  if (r < 0.45 + heavyProb) return 'heavy';
  if (r < 0.72) return 'guard';
  if (r < 0.88) return 'back';
  return 'forward';
}
```

I'm satisfied with this. It's comprehensive, handles all major situations, and has good strategic depth. Let me format it for submission.

Wait, one more thing: the "赛前宣言" (pre-match declaration). I need to write something cool in 20 characters or less.

Something like: "铁拳之下，无人能挡" (Under the iron fist, none can stand) - that's 8 characters, good.
Or: "以攻代守，百战不殆" (Attack as defense, never in peril) - 8 characters.
Or: "拳出如山倒" (Fist strikes like a mountain falling) - 5 characters.

I'll go with something punchy. Let me think...

"一拳破万法" (One fist breaks all techniques) - 5 characters. Cool.
"拳锋所指，所向披靡" - 8 characters. A bit long but within 20.

Let me go with: "拳出无悔" (No regrets when the fist flies) - 4 characters. Simple and cool.

Or maybe: "以拳证道" (Prove the way with fists) - 4 characters.

I'll go with "拳出无悔" - it's punchy and fits the fighting theme.

Let me finalize everything and write the response.