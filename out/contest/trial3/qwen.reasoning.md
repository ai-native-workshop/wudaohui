Let me analyze this fighting game tournament carefully and design a strong AI fighter.

Key observations:
1. 1000 HP each, 60 second matches (3600 ticks)
2. Actions: idle, forward, back, guard, charge, light, heavy, blast, beam, dash_forward, dash_back, push
3. Decision frequency: every 6 ticks when free, immediately after recovery
4. Ki management is crucial
5. Combos are important (light chains up to 4)
6. Guard costs ki, running out means crush
7. Beam clashes are a major mechanic
8. Near-death rage (below 30% HP) gives 1.5x ki gains and +0.4 clash power

Let me think about strategy:

**Core mechanics to exploit:**
- Light punch: 5 startup, 3 active, 9 recovery, reach 110, damage 40, hitstun 15. Can cancel into next light (up to 4 chains), heavy, blast, or beam.
- Heavy: 9 startup, 4 active, 22 recovery, reach 140, damage 120, knocks down 42 ticks. CRUSHES guard.
- Blast: 11 startup, 18 recovery, costs 14 ki, speed 13/tick, damage 60. Chip 12 on block.
- Beam: 30 startup, 40 fire, 20 recovery, costs 50 ki, damage 280. Very powerful but slow.
- Dash forward: 10 ticks, 200 distance, 8 invulnerable ticks, 8 recovery. Costs 16 ki.
- Guard: blocks light, blast, beam but costs ki (4, 6, 15 respectively). Does NOT block heavy.

**Strategy considerations:**

1. **Spacing**: Light reach is 110, heavy is 140. Starting distance is 300 (650-350). Walking forward at 4.5/tick.

2. **Combo potential**: Light hitstun is 15 ticks. Light startup is 5. So if I cancel, I can chain. 4 lights = 40*4 = 160 damage (with scaling: 40 + 32 + 26 + 22 = 120). Then cancel into heavy for 120 more (with 0.4 scaling... wait, combo scaling applies). Let me recalculate:
   - Hit 1: 40 * 1.0 = 40
   - Hit 2: 40 * 0.8 = 32
   - Hit 3: 40 * 0.65 = 26
   - Hit 4: 40 * 0.55 = 22
   - Then heavy: 120 * 0.45 = 54
   Total: 174 damage. Plus knockdown.

3. **Guard pressure**: If opponent guards, light costs them 4 ki and gives you 3 ki back. Heavy crushes guard for 60 damage + 34 stun. So mix light pressure with heavy crush.

4. **Blast usage**: 14 ki, flies at 13/tick. Good for zoning. Chip 12 on block.

5. **Beam**: 50 ki is expensive but 280 damage is massive. Can be countered by dash invulnerability.

6. **Dash**: 16 ki, invulnerable 8 ticks. Can dodge blasts and beams. Dash forward through opponent reverses position.

**My strategy:**

I'll go with an aggressive rushdown character that:
- Walks forward to get in range
- Uses light chains for damage and ki building
- Mixes in heavy to crush guards
- Uses blasts for zoning when at range
- Guards against incoming attacks when needed
- Uses beam when opponent is in recovery or predictable
- Manages ki carefully
- Adapts to opponent behavior

Let me think about specific situations:

**At range (>200):**
- Walk forward to close distance
- Maybe throw a blast to pressure
- If opponent charges, rush in and punish

**Mid range (110-200):**
- Walk forward
- Watch for opponent attacks
- Maybe dash forward to close gap quickly

**Close range (<110):**
- Light punch chains
- Mix in heavy to beat guard
- If opponent is in startup/recovery, counter

**Defense:**
- Guard against blasts and lights
- Dash to dodge beams
- Don't hold guard too long (ki drain)

**Beam strategy:**
- Use beam when opponent is in long recovery or knocked down
- Counter beam if opponent fires one
- Save 50 ki for beam opportunities

**Clash strategy:**
- Push when I have more ki
- Push when opponent is low
- Maybe don't push when I'm very low on ki (save for later)

Let me code this up:

```js
function decide(state) {
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  const R = RULES;
  
  // Handle clash
  if (state.clash) {
    // Push if I have ki advantage or opponent is weak
    if (me.ki > 10 || opp.hp < 300) return 'push';
    if (me.ki > 5) return 'push';
    return 'idle'; // conserve ki
  }
  
  // Handle cancel (combo continuation)
  if (me.canCancel) {
    if (me.chain < 3) return 'light'; // chain lights
    // After 3 lights, go for heavy or blast
    if (opp.state === 'guard' || opp.ki < 10) return 'heavy'; // crush guard
    if (me.ki >= R.blast.cost && !me.blastOut) return 'blast';
    return 'heavy';
  }
  
  // Check for incoming blasts
  const incomingBlasts = state.blasts.filter(b => b.incoming);
  if (incomingBlasts.length > 0) {
    const nearest = incomingBlasts.reduce((a, b) => a.eta < b.eta ? a : b);
    if (nearest.eta <= 3) {
      // Too late to dodge, guard
      if (me.ki >= R.guardKi.blast) return 'guard';
      // Try to dash
      if (me.ki >= R.dash.cost) return 'dash_back';
      return 'guard';
    }
    if (nearest.eta <= 8) {
      if (me.ki >= R.dash.cost) return 'dash_forward'; // dash through
      return 'guard';
    }
  }
  
  // Check for incoming beam
  const oppBeams = state.beams.filter(b => !b.mine);
  if (oppBeams.length > 0) {
    // Beam is coming - dash to dodge
    if (me.ki >= R.dash.cost) return 'dash_forward';
    return 'guard';
  }
  
  // Opponent is firing beam (startup) - counter with beam
  if (opp.state === 'beam' && opp.phase === 'startup' && me.ki >= R.beam.cost) {
    return 'beam';
  }
  
  // Opponent is in long recovery - punish
  if (opp.state === 'beam' && opp.phase === 'recovery' && dist <= R.light.reach) {
    return 'light';
  }
  
  // Opponent is down - charge ki
  if (opp.state === 'down') {
    if (me.ki < 50) return 'charge';
    if (me.ki >= R.beam.cost && dist > 200) return 'beam'; // beam on wakeup
    return 'charge';
  }
  
  // Opponent is charging - rush and punish
  if (opp.state === 'charge') {
    if (dist > R.light.reach) return 'forward';
    return 'light';
  }
  
  // Opponent is in hitstun/blockstun - continue pressure
  if (opp.state === 'hitstun' || opp.state === 'blockstun') {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // Main decision based on distance
  if (dist <= R.light.reach) {
    // Close range - attack
    if (opp.state === 'guard') {
      // Mix up: heavy to crush guard
      if (me.ki > 20 || Math.random() < 0.4) return 'heavy';
      return 'light';
    }
    if (opp.free) {
      // They can act - be careful
      if (Math.random() < 0.6) return 'light';
      if (Math.random() < 0.3) return 'heavy';
      return 'guard';
    }
    return 'light';
  }
  
  if (dist <= R.heavy.reach) {
    // Heavy range
    if (opp.state === 'guard') return 'heavy';
    if (opp.free) {
      if (Math.random() < 0.5) return 'forward';
      return 'light';
    }
    return 'forward';
  }
  
  // Far range
  if (dist <= 200) {
    // Mid range - approach or blast
    if (me.ki >= R.blast.cost && !me.blastOut && Math.random() < 0.3) return 'blast';
    return 'forward';
  }
  
  // Very far - walk forward, maybe blast
  if (me.ki >= R.blast.cost && !me.blastOut && Math.random() < 0.4) return 'blast';
  if (me.ki < 20) return 'charge';
  return 'forward';
}
```

Wait, let me think more carefully. I need to consider:

1. The opponent is also an AI, so I need to be robust against different strategies.
2. Ki management is crucial - I need ki for guard, blasts, beams, dashes.
3. The combo system rewards aggressive play.
4. Guard is important but drains ki.

Let me refine my strategy:

**Key insights:**
- Light punch is fast (5 startup) and gives cancel on hit. It's the bread and butter.
- Heavy crushes guard - important mixup.
- Blasts are good for pressure and building ki (opponent blocking gives you +3 ki).
- Beam is a finisher but very expensive and slow.
- Dash is great for dodging and repositioning.
- Walking forward gives +0.04 ki/tick bonus.

**Against different opponent types:**
- Aggressive rusher: Guard more, counter with heavy after their recovery.
- Zoner (blast spam): Walk forward, guard/dash blasts, close distance.
- Turtle (guard): Use heavy to crush, or walk up and grab with light chains.
- Beam spammer: Counter beam or dash to dodge.

Let me think about ki economy:
- Start: 30 ki
- Passive: 0.04/tick
- Forward: +0.08/tick total
- Charge: +0.36/tick total
- Light hit: +0.8 ki (40 damage * 0.02)
- Taking damage: +0.08 per HP lost
- Guarding a light: -4 ki (opponent gets +3)
- Guarding a blast: -6 ki
- Guarding a beam: -15 ki

If I'm walking forward at 0.08/tick, in 60 seconds (3600 ticks) I gain 288 ki passively. That's enough for several blasts and a beam.

Let me think about the optimal strategy more carefully:

**Opening:** Walk forward. At around 200 distance, decide whether to blast or continue walking.

**At light range (≤110):** 
- If opponent is free: Light is fast enough to beat most things. But heavy beats guard.
- If opponent is guarding: Heavy crushes.
- If opponent is in startup: Counter (1.25x damage).

**Combo execution:**
- Light → cancel → Light → cancel → Light → cancel → Heavy
- This gives: 40 + 32 + 26 + 54 = 152 damage (with scaling)
- Or Light × 4 → Heavy: 40 + 32 + 26 + 22 + 54*0.4 = 40+32+26+22+21.6 ≈ 142
- Wait, let me recalculate. After 4 lights, the combo counter is 4. Heavy would be hit 5: 120 * 0.4 = 48.
- Total: 40 + 32 + 26 + 22 + 48 = 168

Actually wait - the chain limit is 4 lights. So I can do:
- Light (hit 1, scale 1.0): 40
- Light (hit 2, scale 0.8): 32
- Light (hit 3, scale 0.65): 26
- Light (hit 4, scale 0.55): 22
- Heavy (hit 5, scale 0.45): 54
Total: 174 damage + knockdown

Or skip to heavy earlier:
- Light (hit 1): 40
- Light (hit 2): 32
- Heavy (hit 3, scale 0.65): 78
Total: 150 + knockdown (saves time, less risk)

Or:
- Light (hit 1): 40
- Heavy (hit 2, scale 0.8): 96
Total: 136 + knockdown

The full chain is more damage but riskier (more time for opponent to recover if something goes wrong).

Let me also think about when NOT to attack:
- If opponent is dashing (invulnerable)
- If opponent is knocked down (can't hit them)
- If I'm too far away

**Defensive considerations:**
- If opponent throws a blast, I should guard (costs 6 ki, 12 chip damage) or dash.
- If opponent throws a beam, I should dash (invulnerable) or guard (costs 15 ki, 160 chip damage!). Actually guarding a beam is terrible - 160 chip damage. Better to dash.
- If opponent does heavy, I should NOT guard (it crushes). I should back away or dash.

Wait, re-reading: "重击打在格挡上叫破防：挡的人掉 60 血，晕眩 34 tick" - Heavy on guard: 60 damage + 34 stun. That's bad but not as bad as taking full heavy (120 damage + knockdown). Still, guarding heavy is bad.

Actually, can I even guard heavy? Let me re-read: "格挡：挡住正面来的轻拳、气功波和大招，但每挡一下要付气...挡不住重击，重击打在格挡上一定破防。" - Guard blocks light, blast, and beam. Does NOT block heavy. Heavy always crushes guard.

So if I see a heavy coming, I should NOT guard. I should back away or dash.

**Reading opponent state:**
- If opp.state is 'heavy' and phase is 'startup': they're winding up a heavy. I should back away or dash.
- If opp.state is 'light' and phase is 'startup': I could try to counter, but it's fast (5 ticks).
- If opp.state is 'blast': they're throwing a blast. Guard or dash.
- If opp.state is 'beam' and phase is 'startup': I have time to react. Counter beam or dash.

Let me also think about timing:
- I get called every 6 ticks when free. Light startup is 5 ticks. So if I decide to light on tick 0, it becomes active on tick 5-7. If opponent also decided to light on tick 0, theirs is also active tick 5-7. They trade.
- Heavy startup is 9 ticks. If I see opponent start a light (5 startup), I can't react in time with my 6-tick decision cycle. But if I see them start a heavy (9 startup), I might be able to react next decision (6 ticks later) - but by then they're already in active frames (9 ticks). Hmm, tight.

Actually, I get called immediately when I become free (recover from hitstun etc.), and every 6 ticks otherwise. So if I'm walking and they start a heavy, I'll see it on my next decision (within 6 ticks). Heavy startup is 9, so I have at least 3 ticks to react. I can dash back or just walk back.

Let me think about the beam more carefully:
- Beam costs 50 ki. 30 startup, 40 fire, 20 recovery. Total commitment: 90 ticks (1.5 seconds).
- If it hits: 280 damage + knockdown 50. Massive.
- If guarded: 160 chip + stun until beam ends. Still great.
- If opponent dashes through: they dodge it. Wasted 50 ki.
- If opponent counters with beam: clash.

Beam is best used when:
- Opponent is knocked down (can't dodge)
- Opponent is in long recovery
- Opponent is predictable (walking forward)
- As a counter to opponent's beam

**My revised strategy:**

I'll play a balanced rushdown/zoning game:
1. Walk forward to close distance
2. At mid range, occasionally blast to pressure
3. At close range, use light chains with heavy mixups
4. Guard against blasts, dash against beams
5. Use beam as a finisher or counter
6. Manage ki carefully

Let me also think about the "push" in clash:
- Power = 1 + 0.02*ki + 0.6 (if push) + 0.4 (if below 30% HP)
- If I have 50 ki and push: 1 + 1 + 0.6 = 2.6
- If I have 50 ki and don't push: 1 + 1 = 2.0
- Pushing costs 0.6 extra ki/tick
- Clash can last up to 360 ticks

In a clash, I should push if I have ki advantage. If both have similar ki, pushing is a gamble. If I'm low on ki, I should push desperately (empty power is only 0.5).

Actually, let me reconsider. The clash mechanics:
- Both lose 0.2 ki/tick
- Pusher loses additional 0.6 ki/tick
- If I have 50 ki and push, I lose 0.8/tick. After 62 ticks, I'm at 0.
- If opponent has 50 ki and doesn't push, they lose 0.2/tick. After 250 ticks, they're at 0.
- But the clash point moves based on power difference...

The key insight: pushing gives +0.6 power but drains ki faster. If I run out of ki, my power drops to 0.5 (+ rage if applicable). So pushing is a commitment.

Strategy in clash:
- If I have significantly more ki than opponent: push (I can outlast them)
- If opponent is pushing and I'm not: I should push to match, or I'll get overwhelmed
- If both are low: whoever pushes at the right time wins
- If I'm below 30% HP: I get +0.4 power, so I can afford to push less

Actually, looking at the power formula more carefully:
- power = (ki > 0 ? 1 + 0.02*ki + (push ? 0.6 : 0) : 0.5) + (hp < 300 ? 0.4 : 0)

If I have 30 ki and push: 1 + 0.6 + 0.6 = 2.2
If I have 30 ki and don't push: 1 + 0.6 = 1.6
If opponent has 30 ki and pushes: 2.2
If opponent has 30 ki and doesn't push: 1.6

The drift is 0.1 * (power diff) per tick. So if I push and they don't: 0.1 * 0.6 = 0.06 per tick toward them. Over 100 ticks, that's 6 units of drift. The noise is sd 0.8, so it's quite random.

I think in clash, I should generally push if I have more ki, and not push if I have less. If similar, push if I'm losing the clash (pos > 0.5 means it's closer to opponent, which is good for me... wait, pos 0 is at me, 1 is at opponent. So higher pos means clash point is closer to opponent = I'm winning).

Let me re-read: "撞击点推到谁的身上，谁就吃下两道光束" - whoever the clash point reaches takes the damage. And pos: 0 is at me, 1 is at opponent. So if pos is close to 0, I'm losing. If close to 1, opponent is losing.

So in clash:
- If pos < 0.3: I'm losing, push desperately
- If pos > 0.7: I'm winning, maybe don't push (save ki)
- Otherwise: push if I have ki advantage

Let me now write a more complete strategy:

```js
function decide(state) {
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  const R = RULES;
  
  // === CLASH ===
  if (state.clash) {
    const c = state.clash;
    if (c.pos < 0.35) return 'push'; // losing, push
    if (me.ki > opp.ki + 10) return 'push'; // ki advantage, push
    if (me.ki < 5) return 'idle'; // save ki
    if (c.pos < 0.5) return 'push'; // slightly losing
    return 'idle'; // winning or even, save ki
  }
  
  // === COMBO CANCEL ===
  if (me.canCancel) {
    // In a combo, decide what to do next
    if (opp.hp <= 0) return 'idle'; // they're done
    
    if (me.chain < 3) {
      // Keep chaining lights for damage
      return 'light';
    }
    // After 3 lights, finish with heavy for knockdown
    // But check if they're guarding (heavy crushes)
    return 'heavy';
  }
  
  // === INCOMING BLAST ===
  const incomingBlasts = state.blasts.filter(b => b.incoming && b.eta !== null);
  if (incomingBlasts.length > 0) {
    const nearest = incomingBlasts.reduce((a, b) => (a.eta < b.eta ? a : b));
    if (nearest.eta <= 2) {
      // Too late, guard if I can afford it
      if (me.ki >= R.guardKi.blast) return 'guard';
      return 'idle'; // can't do anything
    }
    if (nearest.eta <= 6) {
      // Dash forward through it
      if (me.ki >= R.dash.cost) return 'dash_forward';
      if (me.ki >= R.guardKi.blast) return 'guard';
    }
    if (nearest.eta <= 12) {
      // Walk forward to close distance, or guard
      if (dist > 150) return 'forward';
      return 'guard';
    }
  }
  
  // === INCOMING BEAM ===
  const oppBeams = state.beams.filter(b => !b.mine);
  if (oppBeams.length > 0) {
    // Beam is active, try to dodge
    if (me.ki >= R.dash.cost) return 'dash_forward';
    return 'guard'; // bad option but better than nothing
  }
  
  // === OPPONENT STARTING BEAM ===
  if (opp.state === 'beam' && opp.phase === 'startup') {
    if (me.ki >= R.beam.cost) return 'beam'; // counter beam
    if (me.ki >= R.dash.cost && dist < 200) return 'dash_forward'; // close in
    return 'forward'; // walk in to interrupt
  }
  
  // === OPPONENT FIRING BEAM ===
  if (opp.state === 'beam' && opp.phase === 'firing') {
    // Try to dodge with dash
    if (me.ki >= R.dash.cost) return 'dash_forward';
    return 'guard';
  }
  
  // === OPPONENT DOWN ===
  if (opp.state === 'down' || opp.state === 'ko') {
    if (opp.state === 'down') {
      // They're getting up, prepare
      if (me.ki < 30 && me.ki < R.beam.cost) return 'charge';
      if (me.ki >= R.beam.cost && dist > 150) return 'beam'; // beam on wakeup
      return 'forward'; // approach
    }
    return 'idle';
  }
  
  // === OPPONENT CHARGING ===
  if (opp.state === 'charge') {
    // Free damage! Rush in
    if (dist > R.light.reach) return 'forward';
    return 'light';
  }
  
  // === OPPONENT IN RECOVERY ===
  if ((opp.state === 'light' || opp.state === 'heavy' || opp.state === 'blast') && opp.phase === 'recovery') {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // === OPPONENT IN HITSTUN/BLOCKSTUN ===
  if (opp.state === 'hitstun' || opp.state === 'blockstun') {
    if (dist <= R.light.reach) return 'light';
    return 'forward';
  }
  
  // === OPPONENT CRUSHED ===
  if (opp.state === 'crushed') {
    if (dist <= R.heavy.reach) return 'heavy';
    if (dist <= R.light.reach) return 'light';
    return 'forward';
  }
  
  // === DISTANCE-BASED DECISIONS ===
  
  if (dist <= R.light.reach) {
    // Close range
    if (opp.state === 'guard') {
      // They're blocking - heavy crushes
      if (Math.random() < 0.5) return 'heavy';
      return 'light'; // chip their guard ki
    }
    if (opp.free) {
      // They can act too - light is fastest
      const r = Math.random();
      if (r < 0.55) return 'light';
      if (r < 0.75) return 'heavy';
      if (r < 0.85) return 'guard';
      return 'back';
    }
    // They're in some other state, attack
    return 'light';
  }
  
  if (dist <= R.heavy.reach) {
    // Heavy range but not light range
    if (opp.state === 'guard') return 'heavy';
    if (opp.free) {
      const r = Math.random();
      if (r < 0.4) return 'forward';
      if (r < 0.7) return 'light';
      return 'heavy';
    }
    return 'forward';
  }
  
  if (dist <= 250) {
    // Mid range
    const r = Math.random();
    if (me.ki >= R.blast.cost && !me.blastOut && r < 0.25) return 'blast';
    if (me.ki < 15 && r < 0.3) return 'charge';
    return 'forward';
  }
  
  // Far range
  const r = Math.random();
  if (me.ki >= R.blast.cost && !me.blastOut && r < 0.35) return 'blast';
  if (me.ki < 20 && r < 0.4) return 'charge';
  return 'forward';
}
```

Hmm, let me think about what would make this stronger. Let me consider common AI strategies:

1. **Rusher**: Walks forward, spams light/heavy. Counter: guard lights, back away from heavies, counter-attack during their recovery.

2. **Zoner**: Stays back, spams blasts. Counter: walk forward, guard blasts, close distance.

3. **Turtle**: Guards a lot. Counter: heavy to crush guard, or walk up and throw lights.

4. **Beam spammer**: Fires beams. Counter: dash to dodge, or counter beam.

5. **Charger**: Charges ki, then uses big attacks. Counter: rush them while charging.

My strategy should handle all of these. Let me add some adaptive elements:

- Track opponent's patterns (are they guarding a lot? attacking a lot?)
- Adjust strategy based on ki differential
- Be more aggressive when opponent is low HP
- Be more defensive when I'm low HP

Actually, since I can use variables outside the function that persist within a match, I can track opponent behavior.

Let me also think about ki management more carefully:
- I start with 30 ki
- Walking forward: +0.08/tick
- If I walk forward for 375 ticks (6.25 seconds), I gain 30 ki → 60 total
- Blast costs 14, beam costs 50, dash costs 16
- Guarding a light costs 4, blast costs 6, beam costs 15

I should be careful not to spend all my ki. Keep at least 16 for emergency dash, or 4-6 for guard.

Let me also think about the timing of light chains:
- Light: 5 startup + 3 active + 9 recovery = 17 total
- But with cancel, after hit (tick 5-7), I get called next tick and can start new light
- New light: 5 startup, so next hit at tick 10-12 from chain start
- Opponent hitstun is 15 ticks from the hit
- So if I hit at tick 5, opponent is stunned until tick 20
- My next light starts at tick 6 (cancel), active at tick 11-13
- That's within the 15 tick hitstun. Good, the chain works.

What about after the 4th light?
- 4th light hits, opponent is in hitstun (15 ticks)
- I cancel into heavy: 9 startup + 4 active
- Heavy hits at tick 10-13 from cancel start
- Opponent's hitstun from 4th light: 15 ticks
- So heavy hits within the stun window. Good.

After heavy hits: opponent is knocked down (42 ticks). I'm in heavy recovery (22 ticks). By the time I recover, they're still down for about 20 more ticks. I can walk up and prepare.

Let me also consider: what if opponent dashes through my attack? They're invulnerable for 8 ticks. Light active is only 3 ticks (ticks 5-7). If they dash on tick 0, they're invulnerable until tick 7. My light active is 5-7. They might dodge it. But dash costs 16 ki and has 8 recovery after the 10 tick movement. So they're vulnerable after tick 18.

OK, I think my strategy is solid. Let me refine the code:

Actually, let me think about one more thing: the "wakeup" game. When opponent is knocked down (42 ticks), they get up and immediately get a decision. I should be ready for their wakeup option:
- They might light (fast, 5 startup)
- They might heavy (crushes my guard)
- They might dash (invulnerable, reposition)
- They might guard (safe but passive)
- They might back (create space)

If I'm near them when they get up, I should be ready to guard or attack. If I threw a beam, it might hit them on wakeup.

Let me also think about wall pressure:
- If opponent is near the wall (wallBehind < 100), they can't back away
- I can pressure them with lights and heavies
- Push from light hits pushes them into the wall, then pushes me back instead

OK let me finalize my strategy. I want to be aggressive but smart:

1. Close distance by walking forward
2. At close range, use light chains with heavy mixups
3. Guard against blasts, dash against beams
4. Punish opponent's mistakes (charging, long recovery)
5. Use beam as a finisher or counter
6. Manage ki: keep enough for emergency guard/dash

Let me write the final version:

Actually, one more thought: I should consider the opponent's ki. If they're low on ki (< 4), they can't guard lights. If they're low on ki (< 6), they can't guard blasts. If they're low on ki (< 15), they can't guard beams. If they're at 0, their guard crushes on any hit.

Also, if opponent is in guard and low ki, I should keep hitting them with lights to drain their guard ki, then heavy for the crush.

Let me also think about whether to use `forward` or `idle` when waiting. Forward gives +0.04 ki/tick bonus but moves me toward opponent. If I'm already in range, idle is fine. If I'm out of range, forward is better.

One more consideration: the decision cycle. I'm called every 6 ticks. In 6 ticks:
- Walking forward: 4.5 * 6 = 27 units
- Walking back: 3 * 6 = 18 units
- Light punch: 5 startup + 1 active tick = already hitting by next decision
- Heavy: 9 startup, still in startup at next decision

This means I can't really react to a light punch in time (it's already active by my next decision). But I can react to heavy (9 startup > 6 tick decision cycle).

For blasts: they travel at 13/tick. If opponent is 300 away, blast arrives in about (300-40-30)/13 ≈ 18 ticks. I'll get about 3 decisions before it arrives. Enough time to guard or dash.

For beams: 30 startup + 40 fire. If I see them start a beam, I have 30 ticks (5 decisions) to react. I can counter beam, dash, or walk in.

OK, I think I have a good understanding. Let me write the final code:

```js
// Track opponent behavior
let oppGuardCount = 0;
let oppAttackCount = 0;
let lastOppState = 'idle';
let myLastAction = 'idle';
let aggressiveMode = false;

function decide(state) {
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  const R = RULES;
  
  // Track opponent behavior
  if (opp.state === 'guard' && lastOppState !== 'guard') oppGuardCount++;
  if ((opp.state === 'light' || opp.state === 'heavy') && lastOppState !== opp.state) oppAttackCount++;
  lastOppState = opp.state;
  
  // Determine if opponent is guard-heavy
  const oppTurtle = oppGuardCount > 3 && oppGuardCount > oppAttackCount;
  
  // === CLASH ===
  if (state.clash) {
    const c = state.clash;
    // Push if losing or have ki advantage
    if (c.pos < 0.4) return 'push';
    if (me.ki > opp.ki + 15) return 'push';
    if (me.ki > 20 && c.pos < 0.55) return 'push';
    if (me.ki < 5) return 'idle';
    return c.pos < 0.5 ? 'push' : 'idle';
  }
  
  // === COMBO CANCEL ===
  if (me.canCancel) {
    if (me.chain < 3) return 'light';
    // Finish combo
    if (opp.state === 'guard') return 'heavy'; // crush
    if (me.ki >= R.beam.cost && dist > 100) return 'beam'; // surprise beam
    return 'heavy';
  }
  
  // === INCOMING PROJECTILES ===
  const incomingBlasts = state.blasts.filter(b => b.incoming && b.eta !== null);
  
  // Check for beam hitting me
  const oppBeamHitting = state.beams.some(b => !b.mine);
  
  if (oppBeamHitting) {
    if (me.ki >= R.dash.cost) return 'dash_forward';
    return 'guard';
  }
  
  if (incomingBlasts.length > 0) {
    const nearest = incomingBlasts.reduce((a, b) => (a.eta < b.eta ? a : b));
    if (nearest.eta <= 3) {
      if (me.ki >= R.dash.cost) return 'dash_forward';
      if (me.ki >= R.guardKi.blast) return 'guard';
      return 'idle';
    }
    if (nearest.eta <= 8) {
      if (me.ki >= R.dash.cost && Math.random() < 0.6) return 'dash_forward';
      if (me.ki >= R.guardKi.blast) return 'guard';
    }
    // Far away, just walk forward
  }
  
  // === OPPONENT BEAM STARTUP ===
  if (opp.state === 'beam' && opp.phase === 'startup') {
    if (me.ki >= R.beam.cost) return 'beam';
    if (dist > 200) return 'forward';
    if (me.ki >= R.dash.cost) return 'dash_forward';
    return 'forward';
  }
  
  // === OPPONENT DOWN ===
  if (opp.state === 'down') {
    if (opp.left > 20) {
      // They're down for a while
      if (me.ki < 40) return 'charge';
      if (me.ki >= R.beam.cost && dist > 120) return 'beam';
      return 'forward';
    }
    // They're about to get up
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // === OPPONENT CHARGING ===
  if (opp.state === 'charge') {
    if (dist > R.light.reach) return 'forward';
    return 'light'; // 1.5x damage on charge!
  }
  
  // === OPPONENT IN RECOVERY ===
  if (opp.phase === 'recovery' && (opp.state === 'light' || opp.state === 'heavy' || opp.state === 'blast' || opp.state === 'beam' || opp.state === 'dash')) {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // === OPPONENT IN HITSTUN/BLOCKSTUN/CRUSHED ===
  if (opp.state === 'hitstun' || opp.state === 'blockstun' || opp.state === 'crushed') {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // === OPPONENT DASHING ===
  if (opp.state === 'dash') {
    // They're invulnerable, don't attack
    if (dist < 100) return 'guard';
    return 'idle';
  }
  
  // === DISTANCE-BASED ===
  
  if (dist <= R.light.reach) {
    // Close range combat
    if (opp.state === 'guard') {
      // They're blocking
      if (opp.ki < R.guardKi.light + 2) return 'heavy'; // they can't afford to block
      if (oppTurtle || Math.random() < 0.45) return 'heavy';
      return 'light';
    }
    if (opp.free) {
      const r = Math.random();
      if (r < 0.5) return 'light';
      if (r < 0.7) return 'heavy';
      if (r < 0.8) return 'guard';
      return 'back';
    }
    return 'light';
  }
  
  if (dist <= R.heavy.reach) {
    if (opp.state === 'guard') return 'heavy';
    if (opp.free) {
      const r = Math.random();
      if (r < 0.45) return 'forward';
      if (r < 0.75) return 'light';
      return 'heavy';
    }
    return 'forward';
  }
  
  if (dist <= 220) {
    const r = Math.random();
    if (me.ki >= R.blast.cost && !me.blastOut && r < 0.3) return 'blast';
    if (me.ki < 15 && r < 0.25) return 'charge';
    return 'forward';
  }
  
  // Far range
  const r = Math.random();
  if (me.ki >= R.blast.cost && !me.blastOut && r < 0.35) return 'blast';
  if (me.ki < 20 && r < 0.3) return 'charge';
  if (me.ki >= R.beam.cost && opp.state === 'forward' && r < 0.15) return 'beam';
  return 'forward';
}
```

Wait, I need to think about this more carefully. Let me consider what happens against different opponents:

**Against a rusher:**
- They walk forward and spam attacks
- I should guard their lights, avoid their heavies
- Counter-attack during their recovery
- My lights are fast enough to trade or beat their attacks

**Against a zoner:**
- They stay back and throw blasts
- I walk forward, guard/dash their blasts
- Close distance and pressure them
- Don't let them keep me at range

**Against a turtle:**
- They guard a lot
- I use heavy to crush their guard
- Or walk up and chip their guard ki with lights
- Once their ki is low, heavy for the crush

**Against a beam spammer:**
- They fire beams
- I counter beam or dash
- Close distance during their long recovery

I think my strategy handles these cases reasonably well. Let me also add some ki management:

- Don't spend ki on blast if I'm below 20 (need emergency dash/guard)
- Don't beam if opponent can dash (they have > 16 ki)
- Charge when safe (opponent is down or far away)

Actually, let me reconsider the beam usage. Beam costs 50 ki and has 30 tick startup. That's a long time to be vulnerable. If opponent is free and can walk in, they can hit me during startup. So beam is best used:
1. As a counter to opponent's beam (fires simultaneously)
2. When opponent is knocked down (can't interrupt)
3. When opponent is in long recovery
4. As a surprise when opponent is far and walking forward

Let me also think about the dash more:
- Dash forward: 200 units in 10 ticks, invulnerable 8 ticks
- Great for closing distance quickly
- Can dodge blasts and beams
- Goes through opponent (reverses position)
- Costs 16 ki

Dash is great for:
- Dodging beams (invulnerable)
- Closing distance quickly
- Getting behind opponent (confusing)
- Dodging blasts

But it has 8 tick recovery after the 10 tick movement. So 18 ticks total commitment.

I think I should use dash more aggressively. Let me add:
- If opponent fires a blast and I'm at mid range, dash forward to close distance AND dodge
- If opponent is in recovery and far, dash forward to punish

Let me also think about the "guard" state more carefully:
- Holding guard: -0.03 ki/tick (less than passive 0.04, so net +0.01... wait)
- Actually: passive is 0.04, guard adds -0.03. So total while guarding: 0.04 - 0.03 = 0.01 ki/tick
- That's still positive, so holding guard doesn't drain ki by itself
- But each blocked hit costs ki: 4 (light), 6 (blast), 15 (beam)
- If I guard 10 lights, I lose 40 ki

So guard is safe to hold but expensive when actually blocking hits. I should guard reactively (when I see an attack coming) rather than holding it forever.

Actually wait, let me re-read: "举着格挡时每 tick 少回 0.03 气" - while holding guard, 0.03 less ki per tick. So the total ki gain while guarding is 0.04 - 0.03 = 0.01 per tick. That's fine.

But "后退时每 tick 少回 0.04 气" - walking back: 0.04 - 0.04 = 0 ki/tick. And "蓄气时每 tick 多回 0.32 气" - charging: 0.04 + 0.32 = 0.36 ki/tick. And "走的时候每 tick 多回 0.04 气" - walking forward: 0.04 + 0.04 = 0.08 ki/tick.

So ki rates:
- Idle: 0.04/tick
- Forward: 0.08/tick
- Back: 0/tick
- Guard: 0.01/tick
- Charge: 0.36/tick

Charging is 9x faster than idle, 4.5x faster than forward. But you're vulnerable while charging (1.5x damage if hit).

OK, I think my strategy is solid. Let me finalize it.

One more thing: I should consider the time limit. 3600 ticks (60 seconds). If I'm winning on HP, I can play more defensively in the late game. If I'm losing, I need to be more aggressive.

Let me add:
- If timeLeft < 600 (10 seconds) and I'm winning on HP: play safe, guard, back away
- If timeLeft < 600 and I'm losing: rush in, use beam if I have ki

Also, I realize I should be more careful about when to use beam. The 30-tick startup is very long. If opponent is free and within range, they can hit me. Let me only use beam when:
1. Opponent is knocked down with > 30 ticks left
2. Opponent is in a long recovery (> 30 ticks)
3. Countering opponent's beam
4. Opponent is very far away (> 300) and walking forward

Actually, for case 4: if opponent is 300 away and walking forward at 4.5/tick, they'll be in range in about 42 ticks. My beam startup is 30 ticks. So they'll be at about 300 - 4.5*30 = 165 distance when my beam fires. The beam front moves at 30/tick, so it reaches them in about (165-40)/30 ≈ 4 ticks. They might not be able to react in time. But if they see the beam startup, they can dash. Hmm.

Actually, the beam fires from my position. If I'm at x=350 and opponent is at x=650, the beam starts at x=390 and moves right at 30/tick. After 30 ticks of startup, the beam starts. By then, opponent has walked to 650 - 4.5*30 = 515. Beam front starts at 390 and moves at 30/tick. It reaches 515 in (515-390)/30 ≈ 4 ticks. So about 34 ticks total from my decision to hit. Opponent had 30 ticks to react. If they're an AI that reacts to beam startup, they'll dash or counter.

So beam is mainly good as a counter or against knocked down opponents. Let me be conservative with it.

Let me finalize my code. I want it to be robust, aggressive but not reckless, and good at ki management.

Actually, let me reconsider one thing. The problem says "文件的顶层代码在每局开始时执行一次" - top-level code runs once per match. So I can use top-level variables to track state within a match. This is useful for tracking opponent patterns.

Let me write the final version:

```js
let oppPatterns = { guards: 0, attacks: 0, blasts: 0, charges: 0 };
let prevState = '';
let roundTime = 0;

function decide(state) {
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  const R = RULES;
  const t = state.t;
  
  // Track opponent patterns
  if (opp.state !== prevState) {
    if (opp.state === 'guard') oppPatterns.guards++;
    if (opp.state === 'light' || opp.state === 'heavy') oppPatterns.attacks++;
    if (opp.state === 'blast') oppPatterns.blasts++;
    if (opp.state === 'charge') oppPatterns.charges++;
  }
  prevState = opp.state;
  
  const oppTurtles = oppPatterns.guards > 4 && oppPatterns.guards > oppPatterns.attacks * 1.5;
  const oppZones = oppPatterns.blasts > 3;
  const oppCharges = oppPatterns.charges > 2;
  
  // === CLASH ===
  if (state.clash) {
    const c = state.clash;
    if (c.pos < 0.35) return 'push'; // losing badly
    if (me.ki <= 3) return 'idle'; // conserve
    if (me.ki > opp.ki + 10) return 'push'; // ki advantage
    if (c.pos < 0.5) return 'push'; // slightly losing
    if (me.ki > 30) return 'push'; // plenty of ki
    return 'idle';
  }
  
  // === COMBO CANCEL ===
  if (me.canCancel) {
    if (me.chain < 3) return 'light';
    // After 3 lights, finish
    if (opp.hp <= 150 && me.ki >= R.beam.cost) return 'beam'; // kill shot
    return 'heavy'; // knockdown
  }
  
  // === REACT TO INCOMING BEAM ===
  const oppBeamActive = state.beams.some(b => !b.mine);
  if (oppBeamActive && !me.invulnerable) {
    if (me.ki >= R.dash.cost) return 'dash_forward';
    if (me.ki >= R.guardKi.beam) return 'guard'; // bad but better than nothing
    return 'forward'; // try to walk out
  }
  
  // === REACT TO INCOMING BLASTS ===
  const incoming = state.blasts.filter(b => b.incoming && b.eta !== null);
  if (incoming.length > 0) {
    const near = incoming.reduce((a, b) => a.eta < b.eta ? a : b);
    if (near.eta <= 2) {
      if (me.ki >= R.dash.cost) return 'dash_forward';
      if (me.ki >= R.guardKi.blast) return 'guard';
      return 'idle';
    }
    if (near.eta <= 5) {
      if (me.ki >= R.dash.cost && Math.random() < 0.7) return 'dash_forward';
      if (me.ki >= R.guardKi.blast) return 'guard';
    }
    if (near.eta <= 10) {
      // Walk forward to close distance (blast will pass or we get in range)
      if (dist > 130) return 'forward';
    }
  }
  
  // === OPPONENT BEAM STARTUP ===
  if (opp.state === 'beam' && opp.phase === 'startup') {
    // Counter beam or close distance
    if (me.ki >= R.beam.cost && dist > 150) return 'beam';
    if (me.ki >= R.dash.cost && dist > 100 && dist < 300) return 'dash_forward';
    return 'forward';
  }
  
  // === OPPONENT DOWN ===
  if (opp.state === 'down') {
    if (opp.left > 25) {
      // Plenty of time, charge or position
      if (me.ki < 50) return 'charge';
      return 'forward';
    }
    if (opp.left > 10) {
      // Getting up soon, position for attack
      if (me.ki >= R.beam.cost && dist > 150 && Math.random() < 0.3) return 'beam';
      return 'forward';
    }
    // They're about to get up
    if (dist <= R.heavy.reach) return 'heavy';
    if (dist <= R.light.reach) return 'light';
    return 'forward';
  }
  
  // === OPPONENT CHARGING ===
  if (opp.state === 'charge') {
    if (dist > R.light.reach) return 'forward';
    return 'light'; // 1.5x damage!
  }
  
  // === OPPONENT IN RECOVERY ===
  if (opp.phase === 'recovery') {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // === OPPONENT IN HITSTUN/BLOCKSTUN/CRUSHED ===
  if (opp.state === 'hitstun' || opp.state === 'blockstun' || opp.state === 'crushed') {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // === OPPONENT DASHING (invulnerable) ===
  if (opp.state === 'dash' && opp.phase === 'moving') {
    return 'guard'; // play safe
  }
  
  // === LATE GAME ===
  if (state.timeLeft < 300) {
    if (me.hp > opp.hp + 100) {
      // Winning, play safe
      if (dist > R.heavy.reach) return 'back';
      return 'guard';
    }
    if (me.hp < opp.hp - 50) {
      // Losing, rush
      if (dist > R.light.reach) return 'forward';
      return me.ki >= R.beam.cost ? 'beam' : 'light';
    }
  }
  
  // === MAIN COMBAT LOGIC ===
  
  if (dist <= R.light.reach) {
    // Close range
    if (opp.state === 'guard') {
      // They're blocking
      if (opp.ki < 5) return 'heavy'; // can't afford to block
      if (oppTurtles || Math.random() < 0.4) return 'heavy';
      return 'light'; // chip their guard
    }
    if (opp.free) {
      const r = Math.random();
      if (r < 0.5) return 'light';
      if (r < 0.72) return 'heavy';
      if (r < 0.82) return 'guard';
      return 'back';
    }
    // Opponent is in some non-free state
    if (opp.state === 'light' || opp.state === 'heavy') return 'guard'; // they're attacking
    return 'light';
  }
  
  if (dist <= R.heavy.reach) {
    if (opp.state === 'guard') return 'heavy';
    if (opp.free) {
      const r = Math.random();
      if (r < 0.5) return 'forward';
      if (r < 0.8) return 'light';
      return 'heavy';
    }
    return 'forward';
  }
  
  if (dist <= 230) {
    // Mid range
    const r = Math.random();
    if (me.ki >= R.blast.cost && !me.blastOut && r < 0.25) return 'blast';
    if (oppCharges && r < 0.5) return 'forward'; // rush chargers
    if (me.ki < 15 && r < 0.2) return 'charge';
    return 'forward';
  }
  
  // Far range
  const r = Math.random();
  if (me.ki >= R.blast.cost && !me.blastOut && r < 0.3) return 'blast';
  if (me.ki < 20 && r < 0.3) return 'charge';
  return 'forward';
}
```

Hmm, I realize I should think more carefully about some edge cases:

1. What if I'm cornered (wallBehind is small)? I should try to dash forward through opponent or jump over with dash.

2. What if opponent is doing a light chain on me? I'm in hitstun, can't do anything. When I recover, I should guard or back away.

3. What about ki management in the late game? If time is running out and I'm winning, I don't need to spend ki.

4. What about the "rage" mechanic (below 30% HP)? I get 1.5x ki gains and +0.4 clash power. I should be more aggressive when in rage.

Let me also think about whether my light chain strategy is optimal:
- 4 lights + heavy = 174 damage (with scaling)
- But this takes time and I'm vulnerable if they recover
- 2 lights + heavy = 40 + 32 + 78 = 150 damage (faster, safer)
- 1 light + heavy = 40 + 96 = 136 damage (fastest)

Against a good opponent, shorter combos are safer. Against a bad opponent (or one in long hitstun), longer combos are better.

I'll go with: chain 3 lights then heavy. This gives good damage without being too greedy.

Actually, let me reconsider. The hitstun from light is 15 ticks. My next light after cancel starts at tick 1 (cancel is immediate) + 5 startup = tick 6. Active at tick 6-8. Opponent's hitstun ends at tick 15. So I have plenty of time.

After 3 lights:
- Light 1 hits at tick 5, opponent stunned until tick 20
- Cancel at tick 6, Light 2 starts, hits at tick 11, opponent stunned until tick 26
- Cancel at tick 12, Light 3 starts, hits at tick 17, opponent stunned until tick 32
- Cancel at tick 18, Heavy starts, hits at tick 27 (9 startup), opponent is still stunned (until tick 32)

So the full chain works. After heavy hits, opponent is knocked down for 42 ticks. I'm in heavy recovery for 22 ticks (tick 27 + 4 active + 22 recovery = tick 53). They get up at tick 32 + 42 = tick 74. So I recover at tick 53, they get up at tick 74. I have 21 ticks to position myself.

Wait, I need to double-check. After heavy hits:
- Heavy active ends at tick 27 + 4 = tick 31
- Heavy recovery: 22 ticks, ends at tick 53
- Opponent knockdown: 42 ticks from hit at tick 27, so they're down until tick 69
- They get up at tick 69 + 1 = tick 70

So I recover at tick 53, they get up at tick 70. I have 17 ticks to prepare. Good.

OK, I'm satisfied with the strategy. Let me write the final clean version.

Actually, one more thing: I should handle the case where I'm in the middle of a move and get called (which shouldn't happen based on the rules, but just in case). The rules say I'm only called when free or during clash/cancel. So I don't need to worry about that.

Let me also add some unpredictability. If I always do the same thing, a smart opponent can predict me. I'll use Math.random() to mix up my attacks.

Final version:

```js
let stats = { oppGuard: 0, oppAtk: 0, oppBlast: 0, oppCharge: 0, oppBeam: 0 };
let lastOpp = '';

function decide(state) {
  const me = state.me, opp = state.opp, dist = state.dist, R = RULES;
  
  // Track patterns
  if (opp.state !== lastOpp) {
    if (opp.state === 'guard') stats.oppGuard++;
    else if (opp.state === 'light' || opp.state === 'heavy') stats.oppAtk++;
    else if (opp.state === 'blast') stats.oppBlast++;
    else if (opp.state === 'charge') stats.oppCharge++;
    else if (opp.state === 'beam') stats.oppBeam++;
  }
  lastOpp = opp.state;
  
  const turtle = stats.oppGuard > 3 && stats.oppGuard > stats.oppAtk;
  
  // CLASH
  if (state.clash) {
    const c = state.clash;
    if (c.pos < 0.35 || (me.ki > 5 && c.pos < 0.5)) return 'push';
    if (me.ki > opp.ki + 12) return 'push';
    return me.ki > 25 ? 'push' : 'idle';
  }
  
  // COMBO CANCEL
  if (me.canCancel) {
    if (me.chain < 3) return 'light';
    return 'heavy';
  }
  
  // INCOMING BEAM
  if (state.beams.some(b => !b.mine)) {
    if (me.ki >= R.dash.cost) return 'dash_forward';
    return 'guard';
  }
  
  // INCOMING BLAST
  const inc = state.blasts.filter(b => b.incoming && b.eta != null);
  if (inc.length) {
    const n = inc.reduce((a, b) => a.eta < b.eta ? a : b);
    if (n.eta <= 3) {
      return me.ki >= R.dash.cost ? 'dash_forward' : me.ki >= R.guardKi.blast ? 'guard' : 'idle';
    }
    if (n.eta <= 7) {
      if (me.ki >= R.dash.cost && Math.random() < 0.6) return 'dash_forward';
      return me.ki >= R.guardKi.blast ? 'guard' : 'forward';
    }
  }
  
  // OPPONENT BEAM STARTUP
  if (opp.state === 'beam' && opp.phase === 'startup') {
    if (me.ki >= R.beam.cost && dist > 120) return 'beam';
    if (me.ki >= R.dash.cost) return 'dash_forward';
    return 'forward';
  }
  
  // OPPONENT DOWN
  if (opp.state === 'down') {
    if (opp.left > 20) {
      return me.ki < 50 ? 'charge' : 'forward';
    }
    return dist <= R.heavy.reach ? 'heavy' : 'forward';
  }
  
  // OPPONENT CHARGING
  if (opp.state === 'charge') {
    return dist <= R.light.reach ? 'light' : 'forward';
  }
  
  // OPPONENT IN RECOVERY OR STUN
  if (opp.phase === 'recovery' || opp.state === 'hitstun' || opp.state === 'blockstun' || opp.state === 'crushed') {
    if (dist <= R.light.reach) return 'light';
    if (dist <= R.heavy.reach) return 'heavy';
    return 'forward';
  }
  
  // OPPONENT DASHING
  if (opp.state === 'dash' && opp.phase === 'moving') return 'guard';
  
  // MAIN COMBAT
  if (dist <= R.light.reach) {
    if (opp.state === 'guard') {
      if (opp.ki < 5 || turtle || Math.random() < 0.4) return 'heavy';
      return 'light';
    }
    if (opp.free) {
      const r = Math.random();
      return r < 0.5 ? 'light' : r < 0.72 ? 'heavy' : r < 0.85 ? 'guard' : 'back';
    }
    return 'light';
  }
  
  if (dist <= R.heavy.reach) {
    if (opp.state === 'guard') return 'heavy';
    return Math.random() < 0.6 ? 'forward' : 'light';
  }
  
  if (dist <= 240) {
    if (me.ki >= R.blast.cost && !me.blastOut && Math.random() < 0.25) return 'blast';
    return 'forward';
  }
  
  // FAR
  if (me.ki >= R.blast.cost && !me.blastOut && Math.random() < 0.3) return 'blast';
  if (me.ki < 20 && Math.random() < 0.25) return 'charge';
  return 'forward';
}
```

This is getting complex. Let me simplify and make it more robust. I want to avoid edge cases where I do something stupid.

Key principles:
1. Always be doing something useful (never just idle unless necessary)
2. Prioritize: survive > deal damage > build ki
3. Be aggressive when opponent is vulnerable
4. Be defensive when opponent is attacking
5. Manage ki for emergencies

Let me write a cleaner version:

Actually, I think my strategy is good. Let me just clean it up and make sure there are no bugs. Let me trace through a few scenarios:

**Scenario 1: Both walk forward from starting positions**
- dist starts at 300
- We both walk forward at 4.5/tick
- After about 200/9 ≈ 22 ticks, we're at light range (110)
- I throw light, they throw light → trade? Or one hits first?
- Actually, we both decide at the same time. If we both throw light, they both come out at tick 5. If we're both in range, they both hit. Trade.
- But if I walk forward and they walk forward, we close at 9/tick. From 300 to 110 is 190 units, so about 21 ticks. Then we're both in range.

**Scenario 2: Opponent throws blast from range**
- I see incoming blast with eta
- If eta > 7, I keep walking forward
- If eta <= 7, I guard or dash
- Guard costs 6 ki, 12 chip damage. Dash costs 16 ki, no damage.
- If I have enough ki, dash is better. But it moves me 200 units.

**Scenario 3: Opponent guards a lot**
- I detect turtle pattern
- At close range, I use heavy (crushes guard: 60 damage + 34 stun)
- After crush, I follow up with light or heavy

**Scenario 4: Opponent fires beam**
- I see beam startup (30 ticks)
- I counter beam (fires simultaneously) → clash
- Or I dash forward to get out of range/close distance
- Or I walk forward (beam takes time to reach me)

I think my code handles these well. Let me finalize.

One thing I want to improve: the clash strategy. In a clash, the key is:
- Power = 1 + 0.02*ki + 0.6 (push) + 0.4 (rage)
- If I have 50 ki and push: 1 + 1 + 0.6 = 2.6
- If opponent has 50 ki and doesn't push: 1 + 1 = 2.0
- Difference: 0.6, drift: 0.06/tick toward opponent
- Over 100 ticks: 6 units of drift
- But noise is sd 0.8, so it's very random

The clash is quite random. I should push when I have ki advantage, and not push when I don't. If I'm losing (pos < 0.5), I should push to try to recover.

Let me also consider: if both push, the extra ki drain is 0.6/tick each. If I have 50 ki, I run out in 50/0.8 ≈ 62 ticks. If opponent has 30 ki, they run out in 30/0.8 ≈ 37 ticks. So the one with more ki wins the push war.

OK, I'm going to finalize my code now. Let me make it clean and well-organized:

Let me think about one more thing: should I ever use `back`? 

Back is useful for:
- Creating distance when opponent is attacking
- Avoiding heavy (walk back out of range)
- Ki management (but back gives 0 ki/tick, worse than idle's 0.04)

Actually, back is worse than idle for ki. And walking back at 3/tick is slow. I think back is mainly useful for:
- Getting out of heavy range when opponent is in startup
- Creating space to throw a blast

I'll use back sparingly.

What about `idle`? Idle gives 0.04 ki/tick. It's better than back for ki but you don't move. I'll use idle when:
- I'm waiting for opponent to make a move at close range
- I'm in clash and don't want to push

OK, final code:

Let me also think about one more important thing: the decision timing. I'm called every 6 ticks. In those 6 ticks, a lot can happen:
- Opponent can start and finish a light (5+3+9 = 17 ticks, so about 3 decisions)
- A blast can travel 78 units (13*6)
- Walking covers 27 units forward or 18 back

This means I need to make decisions that are robust over 6 ticks. If I decide to walk forward, I'll keep walking for 6 ticks. If opponent throws a light during that time, I might walk into it.

To handle this, I should:
- Guard when I expect an attack
- Walk forward when it's safe
- Attack when opponent is vulnerable

I think my code handles this reasonably. Let me finalize.

One last thought: I should be more aggressive when I have ki advantage, and more defensive when opponent has ki advantage. Ki determines who can afford to guard, dash, and use special moves.

OK here's my final version. Let me make it comprehensive but not overly complex: