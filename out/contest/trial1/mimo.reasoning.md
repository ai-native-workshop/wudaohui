Let me analyze this fighting game carefully and write a competitive AI fighter.

Key mechanics to understand:
- 60 ticks/sec, 3600 ticks max (60 seconds)
- 1000 HP each, 30 starting ki, max 100 ki
- Positions: 350 and 650, stage 40-960
- Decisions every 6 ticks when idle/free states- Need to think about optimal strategy

Let me think about the damage/ki economy:
- Light: 40 dmg, 5 startup + 3 active + 9 recovery = 17 total, reach 110
- Heavy: 120 dmg, 9 startup + 4 active + 22 recovery = 35 total, reach 140
- Blast: 70 dmg, 11 startup + 18 recovery = 29 total, costs 20 ki
- Beam: 280 dmg, 30 startup + 40 fire + 20 recovery = 90 total, costs 50 ki
- Dash forward: moves 200 in 10 ticks, costs 10 ki, 9 ticks invuln, 8 recovery

Ki economy:
- Passive: 0.04/tick
- Charge: +0.32/tick (total 0.36/tick)
- Taken damage: 0.08/HP dealt to you
- Dealt damage: 0.02/HP dealt
- Blocked hit: +2 ki

Combo system:
- Light hit gives cancel next tick (can chain up to 4 lights, or cancel into heavy/blast/beam)
- Combo scaling: 1, 0.8, 0.65, 0.55, 0.45, 0.4...
- Counter hit (opponent in startup/recovery): ×1.25
- Charge hit: ×1.5

Strategy thoughts:

1. **Aggressive combo approach**: Use light punches with cancels. A light chain is good but damage scales. Let me calculate:
   - Light 1: 40 × 1 = 40
   - Light 2 (cancel): 40 × 0.8 = 32
   - Light 3: 40 × 0.65 = 26
   - Light 4: 40 × 0.55 = 22
   - Total from 4-light chain: 120 damage over ~8 ticks (1 startup + 1 active per hit after cancel)
   - Actually the cancel starts the next move immediately, so chain is very fast

 But actually, the first light has 5 startup + 3 active = 8 ticks to hit. Then cancel to next light which has 5 startup + 3 active = 8 more ticks. So 4 lights = 32 ticks for 120 damage. That's 3.75 dmg/tick.

   Wait, let me re-read. When you cancel into a light, the new light starts immediately (startup 5, active 3). So each light after the first takes 5+3=8 ticks to land. The first takes 5+3=8 ticks. So 4 lights = 32 ticks for 120 base damage (with scaling).

   After a 4-light chain, cancel into heavy: 120 × 0.45 = 54, takes 9+4=13 more ticks. Total: 174 damage in 45 ticks.

   But the opponent gets knocked down by heavy, so they can't do anything for 42 ticks.

   Alternative: after hitting light, cancel into heavy directly:
   - Light: 40 × 1 = 40 (8 ticks)
   - Cancel into heavy: 120 × 0.8 = 96 (13 ticks)
   - Total: 136 damage in 21 ticks (6.5 dmg/tick)

   Or: Light, cancel into heavy:
   - Light: 40 × 1 = 40
   - Heavy: 120 × 0.8 = 96 (knockdown!)
   - Total: 136 + knockdown of 42 ticks

   This is very strong! The knockdown gives 42 ticks of free time.

   After knockdown, the opponent gets up. Distance is pushed by knockback 150. So opponent is knocked150 units away.

   After the heavy knockdown + recovery (22 ticks), the opponent is still down for 42 ticks total (from when hit). So we have about 20 more ticks of advantage.

   We could charge ki during opponent's knockdown, or walk forward.

2. **Beam strategy**: 280 damage for 50 ki. That's 5.6 dmg/ki. Very efficient. But 30 tick startup is long and can be interrupted. Best used when opponent is in hitstun or knocked down.

3. **Blast strategy**: 70 damage for 20 ki = 3.5 dmg/ki. Used for zoning.

4. **Dash forward to close distance**: 200 units in 10 ticks = 20 units/tick. Much faster than walking (4.5/tick). Good for surprise attacks. Costs 10 ki though.

Let me think about a core strategy:

**Primary combo**: Light → cancel → Heavy = 40 + 96 = 136 damage +42 tick knockdown.
During knockdown: walk forward to close distance, maybe charge.
When opponent gets up: try to hit them again.

The key is getting the first light hit. Range is 110, which is pretty close.

**Distance management**: Walk forward to close distance, then try to hit with light.

**Defensive strategy**: Guard when opponent is attacking (light or blast). Back off when opponent is in active frames of heavy.

Let me think about what makes this AI strong:

1. Approach and punish with light→heavy combos
2. Use beam when opponent is knocked down or in hitstun (can't interrupt)
3. Charge ki when safe (opponent far away or knocked down)
4. Guard incoming attacks (light punches, blasts)
5. Use dash to close distance or escape

Let me think about the timing more carefully.

For the light→heavy combo:
- I'm in idle/free state
- I see opponent within 110 distance
- I press `light`: 5 startup, 3 active ticks where it can hit
- If it hits on the active frame (need opponent in range during those 3 ticks)
- On hit (not blocked), next tick I get cancel with canCancel=true
- I return `heavy`: heavy starts immediately, 9 startup + 4 active
- If opponent is in hitstun (15 ticks from light), they can't dodge. Heavy reaches140. But wait, light pushes apart 14. So after light hit, distance increases by 14.

Actually let me re-read the push mechanic:
"轻拳打中时也一样推开" - light punch hit also pushes 14.
So after light hit, opponent is pushed 14 away. If I was at 100 distance, now I'm at 114. Heavy reach is 140, so still in range.

But heavy has 9 startup, so the opponent might be pushed further? No, the push is instant. Then heavy startup is 9 ticks. During those 9 ticks, opponent is in hitstun for 15 ticks total (from the light hit). After 9 ticks of heavy startup, opponent has 6 ticks left of hitstun. Heavy active is 4 ticks. So opponent is still in hitstun during active frames. They can't guard.

Great, so light→heavy combo should work reliably.

After heavy hit: opponent is knocked down (42 ticks) and knocked back 150. So they're now ~264 away (114 + 150).

During opponent's 42 tick knockdown + my heavy recovery 22 ticks = I have 20 more ticks after recovery. I should walk forward (4.5/tick × 20 = 90 units) or dash (200 units).

Then when opponent gets up, I'm at distance ~174 (if I walked) or ~64 (if I dashed).

Let me plan a full combo approach:
1. Walk forward to close distance to ~110
2. Light attack (hope it hits)
3. Cancel into heavy (136 damage + knockdown)
4. Walk forward or charge during knockdown
5. When opponent gets up, attack again

Actually, for knockdown, let me recalculate. The heavy does knockback 150 and down 42. The knockback is `o.kb = { dir: d, left: dist }`. In `move`, the knockback moves up to 12 per tick. So 150/12 = 12.5 ticks to complete the knockback. The down state lasts 42 ticks total (including the knockback movement time).

So after the heavy hit:
- Tick 0: opponent goes into `down` state with kb150
- Ticks 0-12: opponent slides back 150 units- Tick 42: opponent stands up
- My heavy recovery: 22 ticks (recovery phase)

So I have 42 - 22 = 20 ticks of free time after my recovery. Plus my recovery takes 22 ticks.

During my 22 recovery ticks + 20 extra ticks = 42 ticks total, I should close distance.

If I walk forward during recovery... wait, I can't do anything during recovery. The state is `heavy` in `recovery` phase. I can only act when `free` (idle/forward/back/guard/charge) or after `free()` is called.

Let me re-read: "出招到收招结束之前不能做别的事" - can't do anything from starting a move until recovery ends.

So after the heavy hit at tick ~8 (5+3=8 for light, then cancel to heavy immediately,9 startup = 17 total ticks from light start):
Wait, let me be more precise.

Tick 0: I decide to do `light`. State becomes `light`, t=0.
Ticks 0-4: startup (t=0,1,2,3,4)
Tick 5-7: active (t=5,6,7) - hits here
Tick 5: Light hits. Cancel=true is set. Next tick (6) I get called.
Tick 6: I get called with canCancel=true. I return `heavy`. Heavy starts.
Ticks 6-14: heavy startup (9 ticks)
Tick 15-18: heavy active (4 ticks)
Tick 15: Heavy hits. Opponent goes down.
Ticks 15-36: heavy recovery (22 ticks)
Tick 37: I'm free.

Opponent down from tick 15 to tick 57 (42 ticks).
So I'm free at tick 37, opponent still down for 20 more ticks.

Wait, let me recount. The light hits on tick 5 (t=5, which is startup5, so t=5 is the first active tick). Then cancel on tick 6. Heavy starts at tick 6.

Heavy: startup 9 (ticks 6-14), active 4 (ticks 15-18), recovery 22 (ticks 19-40). Total duration 35.

Wait, dur = startup + active + recovery = 9 + 4 + 22 = 35. So the heavy runs for 35 ticks starting at tick 6. Ends at tick 6 + 35 = 41.

Heavy hits during active (tick 6 + 9 = 15 to 18). Let's say it hits on tick 15 (first active tick, since opponent is in hitstun and can't dodge).

Opponent goes down at tick 15, for 42 ticks. Gets up at tick 57.

I'm free at tick 41 (end of heavy). So I have 57 - 41 = 16 ticks of advantage.

During those 16 ticks:
- Walk forward: 16 × 4.5 = 72 units
- Dash forward: 10 ticks to move 200, + 8 recovery = 18 ticks total, costs 10 ki

The opponent was pushed 14 (from light) + 150 (from heavy knockback) = 164 away from where I was when the light hit. Actually, the pushes are from the hit positions...

This is getting complex. Let me simplify and write practical code.

Let me think about the strategy holistically:

**Offense**:
- Walk forward to get within 110 of opponent
- Do light attacks
- On hit: cancel into heavy for knockdown
- After knockdown: charge or walk forward
- When opponent is in hitstun/down: use beam if we have 50 ki

**Defense**:
- Guard when opponent is close and about to attack (detect their startup phase)
- Back off when opponent is in heavy active frames
- Use dash_back to escape

**Ki management**:
- Charge when safe (opponent far or down)
- Use blast for zoning if we have ki

Let me code this up.

```javascript
function decide(state) {
  // State analysis
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  const R = RULES;
  
  // Handle clash
  if (state.clash) {
    // Push if we have more ki or more power
    if (state.clash.myPower >= state.clash.oppPower) {
      return 'push';
    }
    return 'idle'; // don't push to save ki
  }
  
  // Can cancel after light hit
  if (me.canCancel) {
    // Cancel into heavy for maximum damage + knockdown
    if (dist <= 140) {
      return 'heavy';
    }
    return 'light'; // if somehow out of range
  }
  
  // Handle incoming blasts
  for (const blast of state.blasts) {
    if (blast.incoming && blast.eta <= 3) {
      if (blast.eta <= 1) {
        return 'guard'; // too late to dodge
      }
    }
  }
  
  // Check if opponent is knocked down or in long stun
  const oppDown = opp.state === 'down';
  const oppStunned = opp.state === 'hitstun' || opp.state === 'blockstun' || opp.state === 'crushed';
  
  // If opponent is down and we have beam ki
  if (oppDown && me.ki >= 50 && dist <= 500) {
    return 'beam';
  }
  
  // If we're far from opponent, charge or approach
  if (dist > 200) {
    if (me.ki < 50 && !oppDown) {
      return 'charge';
    }
    return 'forward';
  }
  
  // Close range combat
  if (dist <= 110) {
    // Try to hit with light
    return 'light';
  }
  
  // Medium range (110-200)
  if (dist > 110 && dist <= 200) {
    // Approach    return 'forward';
  }
  
  return 'forward';
}
```

Hmm, this is too simple. Let me think more carefully.

Key issues:
1. The AI is called every 6 ticks when free. So between decisions, I maintain the same state.
2. I need to handle defense better - guard when opponent attacks, counter when possible.
3. Need to manage beam timing - beam has 30 tick startup that can be interrupted.

Let me think about when to beam:
- Beam does 280 damage, costs 50 ki
- 30 tick startup can be interrupted by any hit
- Best use: when opponent is in hitstun (15+ ticks) or knocked down (42 ticks)
- After a light hit (15 tick hitstun), I only have 15 ticks before they can act. Beam startup is 30. Not enough.
- After a heavy knockdown (42 ticks), beam startup is 30. Just barely enough if I start immediately.
- But I'm in heavy recovery for 22 ticks after the hit. The heavy hit happens at tick 15 (from light start), recovery ends at tick 41. Opponent gets up at tick 57. So from tick 41 to 57 is 16 ticks. Beam startup is 30. Not enough!

Wait, what if I cancel light into beam directly?
- Light hits at tick 5
- Cancel into beam at tick 6
- Beam startup: ticks 6-35 (30 ticks)
- Beam fires: ticks 36-75
- Opponent hitstun from light: ticks 5-19 (15 ticks)
- At tick 20, opponent is freeSo the beam startup ends at tick 35, but opponent is free at tick 20. They can dodge or guard.

Actually wait, the beam fires continuously for 40 ticks, covering the distance progressively. The beam front moves at 30/tick. Starting from `from = x + 25` to `front = x + 40`, then front advances 30/tick.

If opponent is at distance 120 (after light push14, say 110→124), the beam front needs to reach opponent's position. Beam front starts at my_x + 40. Opponent is at my_x + 124. So beam front needs to cover 84 more units. At 30/tick, that's about 3 ticks after firing starts (tick 39).

But opponent is free at tick 20 and can move or guard. If they guard, the beam does 120 chip damage. That's still significant!

Actually, let me reconsider. If I can land a beam when opponent is knocked down from a heavy, the280 damage would be great. But the timing is tight.

Let me think about a different approach:

**Light chain combo**: 
- Light hit1: 40 × 1 = 40
- Cancel to light hit 2: 40 × 0.8 = 32  
- Cancel to light hit 3: 40 × 0.65 = 26
- Cancel to light hit 4: 40 × 0.55 = 22
- Total: 120 damage from 4-light chain
- Each light after cancel: 5 startup + 3 active = 8 ticks to hit
- First light: 8 ticks to hit
- Chain: 8 + 8 + 8 + 8 = 32 ticks for 120 damage

But opponent hitstun is 15 ticks per light. After hit 1 at tick 8, opponent in hitstun until tick 23. Hit 2 at tick 16. Opponent still in hitstun (8 ticks left). Hit 3 at tick 24. Opponent free at tick 23! They can block hit 3.

Wait, let me recalculate. Light startup is 5, active is 3. So light from a cancel takes 5 ticks startup, then can hit on ticks 5, 6, 7 of the move. But I need to track absolute ticks.

Tick 0: decide light. Start light 1.
Ticks 0-4: startupTick 5: first active. Hits. Set cancel.
Tick 6: decide (cancel). Start light 2.
Ticks 6-10: startup
Tick 11: first active. Hits.
Tick 12: decide (cancel). Start light 3.
...

So hits are at ticks 5, 11, 17, 23. Hitstun from hit 1 is 15 ticks: ticks 5-19. Hit 2 at tick 11: hitstun ticks 11-25. Hit 3 at tick 17: hitstun 17-31. Hit 4 at tick 23: hitstun 23-37.

So opponent is always in hitstun during the chain! Great.

Combo scaling: 1, 0.8, 0.65, 0.55
Damage: 40 + 32 + 26 + 22 = 120

Then after the 4th light, cancel into heavy (chain is 4, so can't chain more lights):
- Hit 5 (heavy): 120 × 0.45 = 54. Knockdown.

Total: 120 + 54 = 174 damage + knockdown.

Alternatively, after 2 lights, cancel into heavy:
- Light 1: 40 × 1 = 40
- Light 2: 40 × 0.8 = 32
- Heavy: 120 × 0.65 = 78. Knockdown.
Total: 150 damage + knockdown. Faster (only 2 light startups).

After 1 light, cancel into heavy:
- Light 1: 40 × 1 = 40
- Heavy: 120 × 0.8 = 96. Knockdown.
Total: 136 damage + knockdown. Fastest.

Which is best?

1-light → heavy: 136 dmg in 5+3+9+4 = 21 ticks to hit. Then 22 recovery. Total 43 ticks. DPS = 136/43 = 3.16.
2-light → heavy: 40+32+78 = 150 dmg in 5+3+5+3+9+4 = 29 ticks. Then 22 recovery. Total 51 ticks. DPS = 150/51 = 2.94.
4-light → heavy: 174 dmg in 5+3+5+3+5+3+5+3+9+4 = 45 ticks. Then 22 recovery. Total 67 ticks. DPS = 174/67 = 2.60.

So 1-light → heavy is the best DPS! And gives knockdown.

But there's also the ki gain to consider. Each damage dealt gives 0.02 ki. So 136 damage = 2.72 ki. 174 damage = 3.48 ki. Not a big difference.

And the combo scaling means each additional hit is less efficient. So the best strategy is: light → heavy for knockdown, then repeat.

Actually, what about light → beam?
- Light 1: 40 × 1 = 40 (tick 5)
- Cancel into beam at tick 6
- Beam startup: 30 ticks (ticks 6-35)
- Beam fires: 40 ticks (ticks 36-75)
- Opponent hitstun: ticks 5-19 (15 ticks). Free at tick 20.
- From tick 20 to 36 (16 ticks), opponent can move.
- Beam front at tick 36 starts at my_x + 40 and advances 30/tick.
- If opponent moved away, they might be out of range.

Not reliable unless opponent is cornered or knocked down.

What about heavy → (opponent knocked down) → beam?
After heavy knockdown (42 ticks down):
- I finish heavy recovery at tick 41 (from earlier analysis).
- I start beam at tick 42.
- Beam startup: 30 ticks (ticks 42-71).
- Opponent gets up at tick 57 (down from tick 15, +42 = 57).
- Beam fires at tick 72.
- Opponent has been free since tick 57. Can dodge.

Hmm, not reliable.

What if I approach while opponent is down and beam at close range?
- After heavy recovery ends at tick 41, opponent still down for 16 ticks.
- Dash forward (10 ticks to cover 200 units): might bring me close.
- Start beam during the dash? No, I can't do two things at once.

Let me think differently. Beam is best used:
1. When opponent is knocked down and I can start the beam before they get up (need 30 ticks of safety)
2. When opponent is at long range and approaching (beam reaches far)
3. As a punish when opponent whiffs a heavy (22 tick recovery is long)

For #1: after heavy knockdown, the opponent is down for 42 ticks. My heavy recovery is 22 ticks. So I have 20 ticks after recovery. Beam startup is 30. Not enough.

Unless I skip the heavy and do light → light → heavy combo? The knockdown is 42 from the heavy hit.

Hmm, what if I do: light hit → cancel into beam while opponent is in 15 tick hitstun? Beam startup is 30 ticks, so the beam won't fire during hitstun. Opponent can move during beam startup.

Actually, the beam is interruptible during startup. If opponent hits me during beam startup (30 ticks), the beam is cancelled and I lose 50 ki. Very risky.

Let me focus on a practical approach:

**Main strategy: Aggressive light→heavy combo with good distance management**

1. Walk forward to close distance
2. At range 110, throw light
3. On hit: cancel into heavy for136 damage + knockdown
4. After knockdown: close distance (walk forward)
5. When opponent gets up: throw light again
6. Guard when opponent is attacking
7. Charge when safe

**Defensive strategy**:
- When opponent is in light/heavy active phase and within reach: guard
- When opponent is in heavy startup: might be able to punish (9 ticks startup, I could start my own attack)
- When opponent is in recovery: punish with light→heavy

**Counter hit bonus**: ×1.25 damage when opponent is in startup or recovery. So punishing whiffs is very valuable.

Let me think about what the opponent might do and how to counter:

If opponent does light:
- 5 startup, 3 active, 9 recovery = 17 ticks
- If they whiff: 5+3 = 8 ticks exposed, then 9 recovery ticks where I can hit them for ×1.25 counter
- If they hit me: 15 hitstun

If opponent does heavy:
- 9 startup, 4 active, 22 recovery = 35 ticks
- If they whiff: 22 recovery ticks where I can hit them for ×1.25 counter
- If they hit me: 42 ticks down

If I can bait opponent into whiffing heavy (by staying just out of 140 range), then punish during their 22 tick recovery, I get ×1.25 damage.

**Bait and punish**:
- Stay at distance 145-160 (just outside heavy reach)
- If opponent does heavy and whiffs, walk in and light→heavy
- Counter damage: 40×1.25 = 50, then heavy 120×1.25×0.8 = 120. Wait, counter is only for the hit that catches them in startup/recovery.

Actually, `mult()` checks the opponent's state at the time the hit lands. If they're in recovery of a move, it's ×1.25. If I land light→heavy:
- Light hits opponent in their heavy recovery: 40 × 1.25 = 50 (counter)
- Cancel into heavy:120 × 0.8 = 96 (combo scaling, but is the opponent still in recovery? They might have gotten hit and gone to hitstun)

Wait, when I hit them with light, they go to `hitstun`. So the heavy that follows won't see them in recovery. The counter only applies to the first hit.

OK, so counter bonus is only for the first hit of a combo that catches the opponent in a vulnerable state.

Counter hit light: 40 × 1.25 = 50
Then heavy (combo 2): 120 × 0.8 = 96
Total: 146 + knockdown. Better than normal 136.

Not a huge difference, but worth trying to punish.

Let me also think about blast usage:
- Blast: 70 damage, 20 ki, 11 startup + 18 recovery = 29 ticks
- Long range: travels at 13/tick
- Good for zoning, chip damage when blocked (12)
- Can be blocked for only 12 chip

Blast is OK for chip damage and zoning. Not as efficient as melee combos.

Let me think about the code structure:

```javascript
function decide(state) {
  const R = RULES;
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  
  // Clash handling
  if (state.clash) {
    if (state.clash.myPower > state.clash.oppPower - 0.3) {
      return 'push';
    }
    return 'idle';
  }
  
  // Cancel after light hit
  if (me.canCancel) {
    if (dist <= 140) return 'heavy'; // Heavy for knockdown
    return 'light'; // Should not happen often
  }
  
  // Incoming blast dodge/guard
  for (const b of state.blasts) {
    if (b.incoming && b.eta !== null && b.eta <= 2) {
      return 'guard';
    }
  }
  
  // If opponent is charging and close, attack
  if (opp.state === 'charge' && dist <= 110) {
    return 'light';
  }
  
  // If opponent is down, charge ki or close distance
  if (opp.state === 'down') {
    if (me.ki < 30 && dist > 200) return 'charge';
    return 'forward';
  }
  
  // If opponent is in recovery or startup (counter hit opportunity)
  if ((opp.phase === 'startup' || opp.phase === 'recovery') && dist <= 110) {
    return 'light';
  }
  
  // If opponent is in recovery and far, approach
  if (opp.phase === 'recovery' && dist > 110) {
    return 'forward';
  }
  
  // If within light range
  if (dist <= 110) {
    return 'light';
  }
  
  // If opponent is attacking (light/heavy active), guard
  if ((opp.state === 'light' || opp.state === 'heavy') && opp.phase === 'active' && dist <= 160) {
    return 'guard';
  }
  
  // If opponent is in startup of attack, try to counter or guard
  if ((opp.state === 'light' || opp.state === 'heavy') && opp.phase === 'startup' && dist <= 160) {
    if (dist <= 110) return 'light'; // Try to beat them to it
    return 'guard';
  }
  
  // Default: approach
  return 'forward';
}
```

Wait, I need to think about this more carefully. The decision cadence is every 6 ticks. So I decide at tick 0, 6, 12, 18... and between decisions, I keep the same action.

If I decide `forward` at tick 0, I keep walking until tick 6 when I decide again. Then I might decide `light`, which starts the attack.

The problem with always going `forward` is that I might walk into attacks. I need to be smarter about when to advance.

Let me think about the game state more carefully. The opponent's `state` tells me what they're doing:
- `idle`, `forward`, `back`, `guard`, `charge`: they're free, can act
- `light`, `heavy`, `blast`, `beam`, `dash`: they're attacking
- `hitstun`, `blockstun`, `crushed`, `down`, `recover`: they're vulnerable- `clash`, `ko`: special states

When opponent is attacking (light/heavy/blast/beam/dash), I know their phase:
- `startup`: not hitting yet, but coming
- `active`: hitting now (for light/heavy)
- `firing`: beam active
- `recovery`: vulnerable window
- `moving`: dash moving

Key defensive reads:
1. Opponent in `light` startup (5 ticks): If close, they're about to punch. Guard or attack first.
2. Opponent in `heavy` startup (9 ticks): More time to react. Stay out of range or guard.
3. Opponent in `heavy` recovery (22 ticks): Free punish window!
4. Opponent in `blast` startup (11 ticks): They're going to throw a projectile.
5. Opponent in `beam` startup (30 ticks): Big window, try to interrupt!

Let me write a more sophisticated AI:

```javascript
function decide(state) {
  const R = RULES;
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  
  // Clash handling
  if (state.clash) {
    if (me.ki > 10 && state.clash.myPower >= state.clash.oppPower - 0.2) {
      return 'push';
    }
    return 'idle';
  }
  
  // Cancel after light hit - always go for heavy knockdown
  if (me.canCancel) {
    return 'heavy';
  }
  
  // Incoming blast - guard if it's about to hit
  for (const b of state.blasts) {
    if (b.incoming && b.eta !== null && b.eta <= 3) {
      return 'guard';
    }
  }
  
  // Opponent beam startup - rush in and punish
  if (opp.state === 'beam' && opp.phase === 'startup') {
    if (dist <= 110) return 'heavy'; // Big damage while they can't dodge
    return 'forward'; // Close distance to punish
  }
  
  // Opponent knocked down
  if (opp.state === 'down') {
    const ticksLeft = opp.left;
    if (ticksLeft > 30 && me.ki < 60) return 'charge';
    return 'forward';
  }
  
  // Opponent in hitstun or blockstun or crushed
  if (opp.state === 'hitstun' || opp.state === 'blockstun' || opp.state === 'crushed') {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent in recovery (punish window!)
  if (opp.phase === 'recovery') {
    if (dist <= 110) return 'light';
    if (dist <= 140) return 'heavy'; // Counter hit bonus
    return 'forward';
  }
  
  // Opponent in startup of melee (they're about to attack)
  if (opp.phase === 'startup' && (opp.state === 'light' || opp.state === 'heavy')) {
    if (dist <= 110) return 'light'; // Try to beat them (but might trade)
    return 'guard';
  }
  
  // Opponent in active of melee (they're hitting now)
  if (opp.phase === 'active' && (opp.state === 'light' || opp.state === 'heavy')) {
    return 'guard';
  }
  
  // Opponent dashing toward us
  if (opp.state === 'dash') {
    return 'guard'; // They might dash in and attack
  }
  
  // Neutral game
  if (dist <= 110) {
    return 'light'; // In range, attack
  }
  
  if (dist <= 160) {
    // Slightly outside light range
    return 'forward'; // Close the gap
  }
  
  // Far away
  if (me.ki < 30) {
    return 'charge'; // Build ki
  }
  
  return 'forward';
}
```

Hmm, but I need to be more careful about several things:

1. The `left` field for down state tells me how many ticks left. I can use this to decide whether to charge or approach.

2. When I'm already doing something (walking forward), I need to react to opponent's attacks. But I only get called every 6 ticks! So I might not be able to react in time to a 5-tick startup light attack.

3. The decision cadence means I need to be proactive about defense, not reactive.

Let me think about a "stance" system:
- Default: walk forward and attack when in range
- Defensive: guard when opponent is close and might attack
- Evasive: back off or dash away when opponent attacks

Actually, let me think about what happens in a real fight:

Tick 0: Both start at distance 300 (350 and 650).
Tick 0: I decide `forward`, opponent decides `forward`.
Tick 6: Distance is now 300 - 2×(6×4.5) = 300 - 54 = 246.
Tick 12: Distance 246 - 54 = 192.
Tick 18: Distance 192 - 54 = 138.
Tick 24: Distance 138 - 54 = 84. (In light range!)

Actually wait, both walking at 4.5/tick toward each other means closing at 9/tick. Over 6 ticks that's 54 units. So from 300, it takes about 34 ticks to reach 110 distance.

At tick 24 (decision 5), distance is about 84. I decide `light`. Light startup is 5 ticks. By tick 29 (first active), opponent might have moved.

If opponent also decides `light` at tick 24, we trade. Both take damage.

If opponent decides `guard` at tick 24, my light is blocked. No damage but I get pushed14.

The game is about who gets the initiative. 

One key insight: **dash_forward is very fast** (200 units in 10 ticks = 20/tick) and gives 9 ticks of invulnerability. If I dash_forward when opponent is about to attack, I'm invulnerable and land close to them (or behind them).

Dash_forward costs 10 ki. Starting ki is 30. So I can dash 3 times.

**Dash-forward attack**: 
- Dash forward when far from opponent (takes 10 ticks to move 200 units)
- During dash, I'm invulnerable for 9 ticks
- After landing, 8 ticks recovery
- But wait, after dash recovery ends, I'm free and can attack

Actually, the dash ends with 8 ticks recovery. During recovery I can't do anything. Then I'm free.

The advantage: I can dash through attacks, land behind the opponent (if there's room), and they have to turn around. But facing is auto-adjusted when free, so they'll face me immediately.

Let me reconsider. The dash takes 10 ticks (moving) + 8 ticks (recovery) = 18 ticks total. During the first 9 ticks I'm invulnerable. During ticks 9-10 (still moving) and 11-18 (recovery), I can be hit.

Dash is good for closing distance or escaping. But the 8 tick recovery at the end is risky.

Let me focus on a simpler, effective strategy:

**Approach and light→heavy combo**

1. Walk forward to get within light range (110)
2. When in range, throw `light`
3. If it hits (not blocked): cancel into `heavy` for knockdown + 136 damage
4. After heavy recovery: walk forward to close distance again
5. When opponent gets up and I'm in range: repeat

**Defense**:
- When opponent is close and in startup of light/heavy: guard
- When opponent is in active frames of light/heavy: guard
- When there's an incoming blast: guard- When safe (opponent far or down): charge or walk

**Extra**: 
- If opponent is in beam startup: rush in and interrupt (they lose 50 ki)
- If opponent is in recovery: punish with lightLet me also consider: what if the opponent blocks my light? Then I get pushed 14 and they have 11 tick blockstun. I can try again immediately.

Actually, if light is blocked: no damage, opponent has 11 blockstun, I get pushed 14. I can try again. The opponent has blockstun so they can't act for 11 ticks. But I was already pushed 14 away.

If I do light and it's blocked, I could try light again (after recovery9 ticks). But opponent's blockstun is 11 ticks. So when my recovery ends (9 ticks after the active), opponent still has 2 ticks of blockstun left. Then they can act.

Actually, let me track this more carefully.

Light: startup 5, active 3, recovery 9 = 17 total.
If blocked at the first active tick (tick 5 from start):
- Opponent blockstun: 11 ticks (from tick 5 to 15)
- My recovery: 9 ticks (ticks 8-16, since active is ticks 5-7)
- I'm free at tick 17.
- Opponent is free at tick 16.

So they can act 1 tick before me. Not great.

If I'm faster on the re-engage... well, we both get called at the same cadence (every 6 ticks). So it's about who decides what.

Let me also consider: light is blocked and I get pushed 14. Distance increases by 14. If I was at 110, now I'm at 124. Outside light range (110). Need to walk forward.

OK, I think the key insight is that **blocking is good for the defender** (chip only for blast/beam, no damage for light) and the **defender gets +2 ki per block**. So a blocking-heavy opponent is hard to break.

But heavy crushes guard: 60 damage + 34 tick stun. So if opponent is guarding a lot, I should throw heavies to crush.

Heavy: startup 9, reach 140. Longer reach and crushes guard. But slower.

Strategy adjustment: **mix up light and heavy to keep opponent guessing**.

If I always do light→heavy combo, opponent might learn to just block everything and take the chip. But if I throw raw heavies sometimes, I can crush their guard.

OK, let me just write a solid AI. Here's my plan:

```javascript
function decide(state) {
  const R = RULES;
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  
  // Clash handling
  if (state.clash) {
    // Push if we have ki advantage or it's close
    if (state.clash.myPower > state.clash.oppPower - 0.3 && me.ki > 5) {
      return 'push';
    }
    return 'idle';
  }
  
  // Cancel after light hit
  if (me.canCancel) {
    if (me.chain < 4 && dist <= 110) {
      // Option1: chain more lights
      // Option 2: heavy for knockdown
    }
    // Heavy for knockdown is generally best
    return 'heavy';
  }
  
  // Incoming blast handling
  for (const b of state.blasts) {
    if (b.incoming && b.eta !== null && b.eta <= 2) {
      // Can't dodge in time, guard
      return 'guard';
    }
    if (b.incoming && b.eta !== null && b.eta <= 6) {
      // Could dash_back to dodge
      if (me.ki >= 10) return 'dash_back';
      return 'guard';
    }
  }
  
  // Opponent is knocked down - approach or charge
  if (opp.state === 'down') {
    const remaining = opp.left;
    if (remaining > 25 && me.ki < 50) return 'charge';
    return 'forward';
  }
  
  // Opponent in vulnerable state (hitstun, blockstun, crushed)
  if (['hitstun', 'blockstun', 'crushed'].includes(opp.state)) {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent in recovery (punish!)
  if (opp.phase === 'recovery' && opp.state !== 'dash') {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent in beam startup - interrupt them!
  if (opp.state === 'beam' && opp.phase === 'startup') {
    return 'forward'; // Rush in and hit them
  }
  
  // Opponent is in active frames of melee - guard
  if (opp.phase === 'active' && (opp.state === 'light' || opp.state === 'heavy')) {
    return 'guard';
  }
  
  // Opponent in startup of melee
  if (opp.phase === 'startup' && (opp.state === 'light' || opp.state === 'heavy')) {
    if (dist <= 110) return 'light'; // Beat them to it (counter hit)
    return 'guard';
  }
  
  // Opponent is dashing
  if (opp.state === 'dash') {
    return 'guard';
  }
  
  // Neutral game - in range
  if (dist <= 110) {
    return 'light';
  }
  
  // Close the gap
  if (dist > 110) {
    if (me.ki < 20 && dist > 250) return 'charge';
    return 'forward';
  }
  
  return 'forward';
}
```

Wait, I realize there's an important issue: I'm being asked every 6 ticks, but the states are maintained. So if I decide `forward`, I walk for 6 ticks and then get asked again. But what if the opponent does a light attack during those 6 ticks? I won't react because I'm already committed to `forward`.

Actually no - the `decide` function is called every 6 ticks when I'm in a free state. During those 6 ticks, I keep walking. When I get asked again, I see the current state and can switch to `guard` if needed.

But a light attack has 5 tick startup. If the opponent starts their light at the same tick I start walking forward (because I decided `forward`), by the time I get asked again (6 ticks later), their light is already in active/recovery phase. I can't react in time.

This means I need to be proactive about defense. If the opponent is close and in a neutral state, I should consider guarding preemptively or attacking first.

Actually, the key question is: when the opponent is close (within light range), should I guard or attack?

If I attack first (light), I have 5 tick startup. They could also attack, leading to a trade.
If I guard, they could throw heavy to crush me (60 damage + 34 stun).
If I attack with heavy, 9 tick startup. They could hit me first with light.

It's a rock-paper-scissors situation at close range. The mix-up is important.

One approach: use randomization to mix up between light, guard, and heavy at close range.

Another approach: react to what the opponent did in the last few ticks. If they just recovered from an attack, attack. If they're free and close, guard.

Actually, I think the best approach is to be aggressive but smart:

1. **Be the first to attack** - throw lights when in range
2. **If blocked**: they're in blockstun. Throw another light immediately (after my recovery). This creates pressure.
3. **If hit**: cancel into heavy for knockdown combo.
4. **Mix in heavies** to punish guards.

But the issue is the decision cadence. Let me think about this.

If I'm walking forward (decision at tick 0), and at tick 6 I see opponent close:
- I decide `light`
- Light starts at tick 6, first active at tick 11
- If opponent decided `guard` at tick 6, my light is blocked
- If opponent decided `light` at tick 6, we trade (both hit at tick 11)

If opponent is reacting to me every 6 ticks too, and we're both in free states at the same ticks, it's symmetric.

The randomization (Math.random) can help break ties. But I need to think about what's optimal in expectation.

Let me think about the game theory:

At close range (dist ≤ 110), both fighters are free, same tick:
- Both light: trade, both take 40 damage. Net zero.
- I light, they guard: they block, I get pushed 14. Slightly bad for me (lost14 range).
- I light, they heavy: I hit first (light startup 5 < heavy startup 9). They take 40 + combo damage. Good for me.
- I light, they back: they escape light range? No, light is instant (3 active ticks). If they're within 110 when I press light, the active frames check distance. If they walked back during my 5 tick startup, they might escape.

Wait, light reach is 110 and it checks distance during active frames. If opponent walks back at 3/tick during my 5 tick startup, they move 15 units away. So if we were at 100 distance, they'd be at 115. Out of light range!

This is a problem. Walking back during my startup can escape light attacks.

But heavy has reach 140 and I do heavy as the combo followup (after light hit). If they're in hitstun, they can't walk away.

OK, the distance check is only at the active frame. So for the initial light to hit, I need opponent within 110 at the active frame (tick 5 of the light).

If opponent is walking back at 3/tick, and I'm within 110 at tick 0 (when I decide light), by tick 5 they've moved 15 back. So I need to be within 95 to guarantee a hit against a retreating opponent.

But if they're walking forward at 4.5/tick, they're getting closer during my startup.

The game has a lot of nuance. Let me just write a good-enough AI and not over-optimize.

Let me also think about the beam strategy more carefully. The beam is very powerful (280 damage) but has a long startup (30 ticks). The best time to use it is when the opponent is knocked down.

After a heavy knockdown (42 ticks down):
- I'm in heavy recovery for 22 ticks after the hit
- Heavy hits at tick X (from cancel)
- I recover at tick X + 22
- Opponent gets up at tick X + 42
- I have X+22 to X+42 = 20 ticks of free time

If I start beam at X+22:
- Beam startup ends at X+52
- But opponent gets up at X+42
- They have 10 ticks to escapeIf I approach during those 20 ticks (walk forward: 20 × 4.5 = 90 units), I could get close enough to hit them with a beam immediately after they get up. But beam startup is 30 ticks.

What if I do light→light→heavy chain? The knockdown comes later, giving me less time to set up.

What if I do light→heavy (knockdown)→walk forward→beam? The beam has 30 tick startup. Opponent is down for 42 ticks. I start beam immediately after heavy recovery (22 ticks after heavy hit). Beam startup: 30 ticks. Opponent gets up at 42. Beam fires at 52. There's a 10 tick gap where opponent is free and beam hasn't fired yet. They can move away.

But if I dash_forward during the 20 ticks of advantage, I can get very close. Then when they get up and I start beam, the beam reaches them quickly (front starts at my_x + 40, advances 30/tick). Even if they walk back at 3/tick, the beam front at 30/tick easily catches them.

Let me calculate:
- After heavy knockdown at tick X, opponent is knocked150 away. Plus 14 push from light. So distance is about 110 (light range) + 14 + 150 = 274.
- Wait, the pushes are applied at the hit position. Let me think again.

At light hit: opponent at distance ~110. Pushed 14. New distance ~124.
At heavy hit (after9 tick startup): opponent in hitstun, not moving. Distance ~124. Heavy does knockback 150. Distance becomes ~274.
After heavy recovery (22 ticks): I'm at the same position. Distance still ~274.
I walk forward20 ticks at 4.5/tick = 90. Distance ~184.
If I then dash_forward: move 200 in 10 ticks + 8 recovery. Distance ~184 - 200 = -16. I'd be behind them!

Wait, dash_forward goes through the opponent if there's room. So I'd end up behind them. The `dashEnd` function handles this.

Actually, if I dash_forward at distance 184, I move 200 forward. That would put me 16 past them. The function checks if I'd end up inside or beyond them. If there's room behind them, I land behind them. Otherwise, I stop in front.

OK, this is getting complex. Let me simplify.

After the heavy knockdown, walk forward to close distance. When in range, attack again. Don't worry about beam setups unless there's a clear opportunity.

Let me also think about when to use beam. The beam is best used:
1. When opponent is in long stun (knockdown) and I'm close
2. When opponent is far and I want to pressure them (but startup is risky)
3. In a clash (if I initiate beam and they also beam)

Actually, beam is really only practical in a clash situation or when the opponent is guaranteed to be hit (knocked down and I'm close). Otherwise the 30 tick startup is too risky.

Let me focus the AI on:
1. Aggressive approach2. Light→heavy combos
3. Guard when needed
4. Charge when safe
5. Use beam opportunistically (rarely)

Let me write the final code:

```javascript
function decide(state) {
  const R = RULES;
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  
  // Clash
  if (state.clash) {
    if (me.ki > 10) return 'push';
    return 'idle';
  }
  
  // Cancel after light hit - heavy for knockdown
  if (me.canCancel) {
    return 'heavy';
  }
  
  // Incoming blast - guard
  for (const b of state.blasts) {
    if (b.incoming && b.eta !== null && b.eta <= 3) {
      return 'guard';
    }
  }
  
  // Opponent knocked down
  if (opp.state === 'down') {
    if (opp.left > 25 && me.ki < 50) return 'charge';
    return 'forward';
  }
  
  // Opponent vulnerable
  if (opp.state === 'hitstun' || opp.state === 'blockstun' || opp.state === 'crushed') {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent in recovery
  if (opp.phase === 'recovery' && opp.state !== 'dash') {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent beam startup - interrupt
  if (opp.state === 'beam' && opp.phase === 'startup') {
    return 'forward';
  }
  
  // Opponent melee active - guard
  if (opp.phase === 'active' && (opp.state === 'light' || opp.state === 'heavy')) {
    return 'guard';
  }
  
  // Opponent melee startup
  if (opp.phase === 'startup' && (opp.state === 'light' || opp.state === 'heavy')) {
    return 'guard';
  }
  
  // Opponent dashing
  if (opp.state === 'dash') {
    return 'guard';
  }
  
  // In range
  if (dist <= 110) {
    return 'light';
  }
  
  // Approach
  return 'forward';
}
```

Wait, I need to handle one more thing: the `me.canCancel` state. When I get called with canCancel=true, the cancel decision is separate. The engine handles it specially:

```javascript
if (a.cancel) {
    a.cancel = false;
    if ((act === 'light' && a.chain < R.light.chain) || act === 'heavy' || act === 'blast' || act === 'beam') start(m, a, act, true);
    return;
}
```

So during a cancel, only light/heavy/blast/beam are valid cancel options. If I return anything else, the cancel is ignored and the current move continues normally (in recovery).

My code returns 'heavy' for cancel, which is correct.

But I should also think: when to cancel into light instead of heavy?

If I cancel into light (chain), I can get more hits in the combo. But combo scaling means diminishing returns.

After 2 lights:
- Light 1: 40 × 1 = 40
- Light 2: 40 × 0.8 = 32
- Cancel to heavy: 120 × 0.65 = 78
- Total: 150 + knockdown

After 1 light:
- Light 1: 40 × 1 = 40
- Cancel to heavy: 120 × 0.8 = 96
- Total: 136 + knockdown

After 3 lights:
- Light 1: 40 × 1 = 40
- Light 2: 40 × 0.8 = 32
- Light 3: 40 × 0.65 = 26
- Cancel to heavy: 120 × 0.55 = 66
- Total: 164 + knockdown

After 4 lights:
- Light 1: 40 × 1 = 40
- Light 2: 40 × 0.8 = 32
- Light 3: 40 × 0.65 = 26
- Light 4: 40 × 0.55 = 22
- Cancel to heavy: 120 × 0.45 = 54
- Total: 174 + knockdown

Total damage wise, 4-light chain is best (174). But it takes32 more ticks than 1-light.

DPS analysis:
1-light→heavy: 136 damage, ~21 ticks to hit (5+3+9+4), then 22 recovery = 43 total ticks. DPS = 3.16
2-light→heavy: 150 damage, ~29 ticks to hit (5+3+5+3+9+4), then 22 recovery = 51 total. DPS = 2.94
3-light→heavy: 164 damage, ~37 ticks to hit, then 22 recovery = 59 total. DPS = 2.78
4-light→heavy: 174 damage, ~45 ticks to hit, then 22 recovery = 67 total. DPS = 2.60

1-light→heavy is the most damage-efficient per tick!

But there's also the consideration of ki gain: more damage = more ki. 136 × 0.02 = 2.72 vs 174 × 0.02 = 3.48. Small difference.

And the knockdown gives42 ticks of free time regardless of which combo I use.

I think 1-light→heavy is optimal. It's the fastest way to get the knockdown and then do it again.

But wait: the combo scaling resets when opponent becomes free. After the knockdown, they get up and the combo counter resets to 0. So the next combo starts fresh at ×1.

This means the cycle is: light→heavy→knockdown→approach→light→heavy→knockdown→...

Each cycle: 136 damage in ~65 ticks (43 to execute + 22 to approach). DPS≈ 2.09.

But with counter hits (opponent in startup/recovery): ×1.25 = 50 + 96 = 146 damage. Better.

Hmm, let me also think about what happens if the opponent blocks my light. Then no damage, they get blockstun 11 ticks. I need to try again.

If they block:
- My light is blocked. I'm in light recovery (9 ticks after active).
- Their blockstun is 11 ticks.
- I'm free after 17 ticks (startup 5 + active 3 + recovery 9). Actually, the active is 3 ticks but the hit happens on one of them (let's say tick 5). Then my recovery is 9 ticks starting from tick 8 (after active ends). So I'm free at tick 17.
- Their blockstun ends at tick 5 + 11 = 16. So they're free 1 tick before me.

Not ideal. But if I can time my next attack right when I'm free, I might catch them.

What if they block and I immediately try heavy? My recovery ends at tick 17. I decide heavy at tick 17 (if I'm called). But I'm called every 6 ticks. So I'd be called at ticks 0, 6, 12, 18, 24... If I started light at tick 6, my recovery ends at tick 23. I'm called at tick 24 (next decision after 6 ticks). But wait, when I become free (after recovery), I'm called immediately: "从出招、硬直、倒地这些状态恢复成空闲，下一个 tick 立刻调用你一次". So at tick 23, I become free and am called at tick 24 (next tick).

Actually re-reading: "你从出招、硬直、倒地这些状态恢复成空闲，下一个 tick 立刻调用你一次" - when you recover from an attack/stun/down to idle, you're called immediately on the next tick.

And in the engine code:
```javascript
function free(m, a) {
  a.state = 'idle'; a.t = 0; a.dur = 0; a.dash = null; a.hit = false; a.cancel = false; a.chain = 0; a.combo = 0;
  a.nextAsk = m.tick + 1;                                                  // asked again at once
}
```

So `nextAsk = m.tick + 1`, meaning I'm asked on the very next tick.

OK, so when my light recovery ends, I'm immediately asked what to do. Good.

If I do light→blocked→free→light again, the timing is:
- Tick 6: decide light
- Tick 11: active, blocked
- Tick 17: recovery ends (light total: 5+3+9 = 17 from start)
Wait, let me re-check. dur = startup + active + recovery = 5+3+9 = 17. So the move lasts 17 ticks (t goes from 0 to 16, and at t=17 it's over). 

Actually, looking at the engine:
```javascript
a.dur = M.startup + M.active + M.recovery;  // for light: 5+3+9 = 17
```

And in step:
```javascript
a.t++;
if (a.dur && a.t >= a.dur) free(m, a);
```

So when t reaches 17, the fighter is freed. The move was active during t=5,6,7 (active phase). The hit happens during these ticks.

If light starts at tick 6 (absolute), then:
- t=0 at tick 6 (startup)
- t=5 at tick 11 (active starts)
- t=7 at tick 13 (active ends)
- t=8 at tick 14 (recovery starts)
- t=17 at tick 23 (recovery ends, freed)

Actually wait, the move starts at the tick I decide. But the t counter increments at the END of each step. Let me trace through more carefully.

In step():
1. Both choose (if wants to be asked)
2. Bodies move
3. Strikes/blasts/beams
4. Time passes (t++)

So at tick 6 (the step):
1. I decide `light`. `start()` is called. `a.state = 'light'; a.t = 0; a.dur = 17`.
2. Move (no movement for light)
3. Strikes (at t=0, which is startup. Not active yet.)
4. `a.t++` → t=1.

At tick 7: t=1 (still startup)
...
At tick 11: t=5 (active starts!)
- In step 3 (strikes), phase checks t < startup (5) → false. t < startup+active (8) → true. So active. Strike check happens.
- Then t++ → t=6.

At tick 12: t=6 (active)
At tick 13: t=7 (active)
At tick 14: t=8 (recovery)
...
At tick 23: t=17. In step 4, t++ makes t=17, then `a.t >= a.dur` (17 >= 17) → free.

So the light starts at tick 6, active at ticks 11-13 (t=5,6,7), recovery14-22 (t=8-16), freed at tick 23 (t becomes 17).

If the light hits at tick 11 (first active):
- I get `cancel` set to true
- At tick 12, I'm asked with canCancel=true
- If I return 'heavy', heavy starts at tick 12. t=0, dur=35.
- Heavy active: ticks 12+9=21 to 12+12=24 (t=9-12)
- Heavy recovery: ticks 25-46 (t=13-34)
- Freed at tick 47 (t=35)

Wait, I need to be more precise. Heavy: startup 9, active 4, recovery 22. dur = 35.

Heavy starts at tick 12 (cancel). 
- t=0 at tick 12
- t=9 at tick 21 (active starts)
- t=12 at tick 24 (active ends)
- t=13 at tick 25 (recovery starts)
- t=35 at tick 47 (freed)

So heavy hits at tick 21 (first active frame). Opponent goes down.

If the light hit at tick 11, opponent hitstun = 15 ticks → ticks 11-25. Opponent is in hitstun during heavy active (tick 21-24). Confirmed, can't dodge.

Heavy hit at tick 21: opponent goes down for 42 ticks (ticks 21-63).

Heavy recovery ends at tick 47. Opponent down until tick 63.

Free time: ticks 47-63 = 16 ticks.

During16 ticks of free time:
- Walk forward: 16 × 4.5 = 72 units (but I'm called every 6 ticks, so 2-3 decisions)
- Dash forward: 10 ticks moving + 8 recovery = 18 ticks (slightly too long)
- Charge: 16 × 0.36 = 5.76 ki

If the opponent was pushed 14 (light) + 150 (heavy) = 164 away from where I was. Original distance ~110 + 164 = 274. After walking 72 = 202. Still out of range (110).

Hmm, that's a problem. After the knockdown, the opponent is far away. I can't immediately attack again.

What if I dash forward during the free time? 200 units in 10 ticks. From 274 to 74. That's within light range! But the dash recovery is 8 ticks (total 18), and I only have 16 ticks before opponent gets up. So I'd still be in dash recovery when they get up.

Let me recalculate. Dash starts at tick 47 (or later). Dash moves for 10 ticks (ticks 47-56), recovery for 8 ticks (ticks 57-64). Opponent gets up at tick 63. So I'm in dash recovery at tick 63. They can attack me.

But the distance would be ~74. Even if they attack immediately, I'm in recovery and can be hit.

Alternatively: walk forward for 6 ticks (decision at tick 47, then again at tick 53), then dash at tick 53. Walk 6 × 4.5 = 27 units. Distance becomes 274 - 27 = 247. Dash 200 units. Distance 47. Within light range!

Dash: ticks 53-62 (moving), ticks 63-70 (recovery). Opponent gets up at tick 63. At tick 63, I'm at distance 47 but in dash recovery. They can attack me.

Hmm. The dash is risky during opponent wake-up.

What about not dashing and just walking? At tick 63 (opponent gets up), distance = 274 - 16 × 4.5 = 274 - 72 = 202. Out of range. I need to walk more.

It takes (202 - 110) / 4.5 = 20.4 more ticks to get in light range. Plus my decision cadence (every 6 ticks).

So the full cycle is:
1. Approach to light range: ~34 ticks from start
2. Light→heavy combo: 21 ticks to knockdown
3. Heavy recovery + approach: 22 + 20 = 42 ticks
4. Re-approach from knockback distance: ~20 ticks
5. Total cycle: ~34 + 21 + 42 + 20 = 117 ticks per cycle
6. Damage per cycle: 136
7. DPS: 136/117 = 1.16

That's not great. The opponent's knockback is causing most of the wasted time.

Alternative strategy: don't do heavy, just do light combos.

Light chain (4 lights): 120 damage in 32 ticks, no knockback. But opponent recovers after hitstun (15 ticks per hit). The chain keeps them in hitstun for37 ticks (from first hit at tick 5 to last hit at tick 23 + 15 hitstun = 38).

After the 4-light chain, I'm in recovery for 9 ticks (last light). Total: 32 + 9 = 41 ticks. Then I can attack again.

If I do light chain repeatedly:
- Each cycle: 41 ticks, 120 damage (with combo scaling). DPS = 2.93.
- But opponent's combo counter resets when they become free. So each new chain starts fresh at ×1.

Wait, actually after the 4th light, if I don't cancel into anything, the 4th light's recovery runs and I'm freed. Opponent is in hitstun for 15 ticks from the 4th hit. By the time my recovery ends (9 ticks after active), opponent has 6 ticks of hitstun left. Then they become free.

So after the 4-light chain:
- Last hit at tick X
- My recovery ends at tick X + 3 + 9 = X + 12 (recovery starts after active)
Wait, for the last light (4th), it starts at tick X. Startup 5 ticks. Active 3 ticks. Recovery 9 ticks. Total 17 ticks. Hits at tick X+5 (first active). I'm freed at tick X+17.

Actually the 4th light starts at tick (wherever the cancel is). Let me think of it as: each light takes 8 ticks to hit (5 startup + 3 active). The chain starts at the first light, and each cancel keeps it going.

Chain timing:
- Light 1 starts at tick 0. Hits at tick 5. Cancel at tick 6.
- Light 2 starts at tick 6. Hits at tick 11. Cancel at tick 12.
- Light 3 starts at tick 12. Hits at tick 17. Cancel at tick 18.
- Light 4 starts at tick 18. Hits at tick 23.
- Light 4 recovery: ticks 26-34. Freed at tick 35.

Wait, I keep getting confused by the tick counting. Let me just use relative ticks from the first light.

Light 1: starts at T. Active at T+5. 
Cancel at T+6 (next tick after hit).
Light 2: starts at T+6. Active at T+11.
Cancel at T+12.
Light 3: starts at T+12. Active at T+17.
Cancel at T+18.
Light 4: starts at T+18. Active at T+23.
No more cancels (chain max4).
Light 4 recovery: T+26 to T+34. Freed at T+35.

Damage: 40+32+26+22 = 120. Total time: 35 ticks. DPS = 3.43.

But after T+35, opponent is in hitstun from light 4 (hit at T+23, stun 15 ticks → free at T+38). So opponent is in hitstun for 3 more ticks after I'm free. Then I can start a new chain immediately!

So actually:
Chain 1: T to T+35. 120 damage.
Chain 2: T+35 to T+70. Another 120 damage (fresh combo scaling since opponent was free at T+38... wait, opponent free at T+38, I'm free at T+35.At T+35, I'm free and decide what to do. If I decide `light`, light starts at T+35. Active at T+40. But opponent is in hitstun until T+38. So at T+40, opponent is free. Can they guard?

If opponent is free at T+38, and I started light at T+35 (active at T+40), the opponent is free for 2 ticks (T+38, T+39) before my light is active. They could guard during those ticks.

But the decision cadence is every 6 ticks. I'm called at T+35 (when freed). Then T+41 (next 6-tick interval). At T+40 (active frame of my light), the opponent might have decided to guard at T+38 (when freed).

This is a race condition. But in practice, the opponent can guard my chain2 light.

Unless I start the chain earlier. If at T+35, I decide `light`, and the opponent is still in hitstun until T+38, then my light active starts at T+40 (T+35 + 5 startup). At T+40, opponent is free (freed at T+38). They might guard.

Hmm, so4-light chain is not as good because the opponent can guard the next chain.

What about 2-light → heavy?
- Light 1: T, hits T+5
- Cancel to light 2: T+6, hits T+11
- Cancel to heavy: T+12, hits T+21 (9 startup)
- Heavy recovery: T+33 to T+46. Freed at T+47.
- Opponent down from T+21 to T+63 (42 ticks).

Actually wait, combo scaling: light 1 (×1), light 2 (×0.8), heavy (×0.65).
Damage: 40 + 32 + 120×0.65 = 40 + 32 + 78 = 150. Plus knockdown.

Time: 47 ticks to execute. 150 damage. DPS = 3.19.

vs 1-light → heavy: 136 damage in 43 ticks. DPS = 3.16.

Very similar. The extra14 damage from 2-light chain doesn't justify the extra 4 ticks.

What about doing just lights without heavy?

2-light chain then stop:
- Light 1: T, hits T+5. 40 damage.
- Cancel to light 2: T+6, hits T+11. 32 damage.
- Light 2 recovery: T+14 to T+22. Freed at T+23.
- Opponent in hitstun from light 2 until T+26 (hit at T+11, stun 15).

At T+23, I'm free. Opponent in hitstun for 3 more ticks. I can start another chain immediately.

If I start light at T+23: active at T+28. Opponent free at T+26. Can guard.

Hmm, same issue.

3-light chain then stop:
- Light 1: T. Hits T+5.
- Cancel to light 2: T+6. Hits T+11.
- Cancel to light 3: T+12. Hits T+17.
- Light 3 recovery: T+20 to T+28. Freed at T+29.
- Opponent hitstun from light 3 until T+32.

At T+29, free. Start light at T+29. Active at T+34. Opponent free at T+32. Can guard.

4-light chain:
- Last light at T+18. Hits T+23. Recovery T+26 to T+34. Freed T+35.
- Opponent hitstun until T+38.
- Start light at T+35. Active T+40. Opponent free T+38. Can guard.

In all cases, there's a gap where the opponent becomes free before my next attack is active.

Unless... I use dash_forward to close distance and attack immediately when they're free. But dash has recovery.

Or: the key is that after I'm freed, I'm asked immediately (next tick). If I decide `light`, it starts that tick. The opponent is also asked every 6 ticks. If they were in hitstun and just became free, they're asked immediately too.

So at T+23 (after 2-light chain), I decide `light`. Opponent is freed at T+26 and asked immediately. At T+26, opponent decides `guard`. At T+28 (T+23+5), my light is active. Opponent is in `guard` state. Light is blocked.

So the opponent CAN block my follow-up chain! This means chains don't actually connect indefinitely.

This is why the light→heavy combo is effective: the heavy causes a knockdown that's42 ticks long. During those 42 ticks, the opponent can't guard.

So the meta is: light→heavy (or light chain → heavy) for knockdown, then approach and repeat.

The question is: how many lights before the heavy?

Let me optimize the combo:

1-light → heavy: 40 + 96 = 136 damage. 21 ticks to hit (5+3+9+4=21 from light start to heavy hit). Actually let me recalculate.

Light starts at T. Hits at T+5. Cancel at T+6. Heavy starts T+6. Heavy hits at T+6+9=T+15. Total ticks from start to heavy hit: 15.

Wait, that can't be right. Let me trace more carefully.

T: decide light. state=light, t=0, dur=17.
T+1: t=1
...
T+5: t=5 (first active). Strike check: active! Hits! a.hit=true, a.cancel=true.
T+6: t=6. In step 1, `wants` checks `a.cancel` → true. So I'm asked. I return 'heavy'. `choose` sees `a.cancel` is true. Sets `a.cancel=false`. Calls `start(m, a, 'heavy', true)`. 

So heavy starts at T+6 (same tick as the cancel). state=heavy, t=0, dur=35.

T+7: t=1 (heavy startup)
...
T+14: t=8 (still startup,9 ticks: t=0 to t=8)
T+15: t=9 (first active of heavy). Strike check: active! Hits!

So total ticks from light start to heavy hit: 15 ticks. 

Heavy damage: 120 × 0.8 (combo 2) = 96.
Light damage: 40 × 1 = 40.
Total: 136. Knockdown at T+15.

Heavy recovery: T+19 to T+40. Freed at T+41.
Opponent down: T+15 to T+57 (42 ticks).

Free time: T+41 to T+57 = 16 ticks.

2-light → heavy:
Light 1 at T. Hits T+5.Light 2 at T+6. Hits T+11.
Heavy at T+12. Hits T+21.
Total: 21 ticks to heavy hit.
Damage: 40 + 32 + 78 = 150. Knockdown at T+21.
Heavy recovery: T+25 to T+46. Freed T+47.
Opponent down: T+21 to T+63.
Free time: T+47 to T+63 = 16 ticks.

Hmm, same free time (16 ticks) because the heavy recovery is always 22 ticks and knockdown is 42 ticks. 42 - 22 = 20. Wait, the heavy recovery starts after the active (4 ticks). So recovery is 22 ticks from T+25 (after active ends at T+24) to T+46. Freed at T+47.

Wait, let me re-check. Heavy: startup 9, active 4, recovery 22. dur = 35.
Heavy starts at T+12. t=0 at T+12.
Active: t=9 to t=12 (T+21 to T+24).
Recovery: t=13 to t=34 (T+25 to T+46).
Freed: t=35 (T+47).

Opponent knocked down at T+21 (first active). Down for 42 ticks: T+21 to T+63.
Free time: T+47 to T+63 = 16 ticks.

For 1-light→heavy:
Heavy starts T+6. t=0 at T+6.
Active: t=9 to t=12 (T+15 to T+18).
Recovery: t=13 to t=34 (T+19 to T+40).
Freed: t=35 (T+41).
Opponent down: T+15 to T+57.
Free time: T+41 to T+57 = 16 ticks.

Same free time! So the only difference is total damage and total time.

1-light→heavy: 136 damage, 41 ticks to execute, 16 free ticks. Cycle = 57 ticks. DPS = 136/57 = 2.39.
2-light→heavy: 150 damage, 47 ticks to execute, 16 free ticks. Cycle = 63 ticks. DPS = 150/63 = 2.38.
3-light→heavy: 164 damage, 53 ticks to execute, 16 free ticks. Cycle = 69 ticks. DPS = 164/69 = 2.38.
4-light→heavy: 174 damage, 59 ticks to execute, 16 free ticks. Cycle = 75 ticks. DPS = 174/75 = 2.32.

Very similar DPS. But the opponent's knockback distance is the same (heavy knockback 150 + light push). So the approach time is similar.

Actually, the total cycle includes approach time. Let me include that.

Distance after knockdown: starting distance was ~110 (light reach). Light push 14. Heavy knockback 150. Total distance ≈ 110 + 14 + 150 = 274.

Wait, the push and knockback are separate. Let me think about the actual distances.

When light hits at tick T+5: distance is D. Push 14. Distance becomes D+14.
When heavy hits at tick T+15: distance is D+14 (opponent in hitstun, not moving). Knockback 150. Distance becomes D+14+150 = D+164.

If D ≈ 100 (we're at light range), final distance ≈ 264.

During free time (16 ticks), walk forward: 16 × 4.5 = 72. Distance ≈ 192.

After opponent gets up, I need to close from 192 to 110 = 82 more units. At 4.5/tick + 4.5/tick (if opponent also walks forward) = 9/tick. 82/9 ≈ 9 ticks.

But I only decide every 6 ticks. So it takes about 12-18 ticks to close the gap.

Total cycle: 41 + 16 + 18 = 75 ticks. DPS = 136/75 = 1.81.

With 4-light chain: 59 + 16 + 18 = 93 ticks. DPS = 174/93 = 1.87.

Hmm, 4-light is actually better with approach time included because the extra damage comes "for free" during the same approach cycle.

But the chain takes59 ticks to execute vs 41 for 1-light. The opponent gets knocked down at different points. For 1-light: knockdown at T+15. For 4-light: knockdown at T+45 (heavy at T+36, hits at T+45).

Wait, let me recalculate 4-light→heavy:

Light 1: T. Hits T+5.
Cancel → Light 2: T+6. Hits T+11.
Cancel → Light 3: T+12. Hits T+17.
Cancel → Light 4: T+18. Hits T+23.
Cancel → Heavy: T+24. Hits T+33.
Recovery: T+37 to T+58. Freed T+59.
Opponent down: T+33 to T+75.
Free time: T+59 to T+75 = 16 ticks.

Total: 59 ticks to execute + 16 free + 18 approach = 93 ticks. Damage: 40+32+26+22+54 = 174. DPS = 1.87.

For 1-light→heavy:
Total: 41 + 16 + 18 = 75 ticks. Damage: 136. DPS = 1.81.

For 2-light→heavy:
Light 1: T. Hits T+5.
Cancel → Light 2: T+6. Hits T+11.
Cancel → Heavy: T+12. Hits T+21.
Recovery: T+25 to T+46. Freed T+47.
Opponent down: T+21 to T+63.
Free time: T+47 to T+63 = 16 ticks.

Total: 47 + 16 + 18 = 81 ticks. Damage: 150. DPS = 1.85.

So all combos have similar DPS (~1.85). The approach time dominates. The key is that all combos give the same 16 ticks of free time and similar knockback distance.

Given this, I'll go with 1-light→heavy for simplicity and reliability. It's faster to execute, meaning fewer chances for the opponent to interrupt.

Actually, there's one more thing to consider: counter hits. If I can get the light to land as a counter hit (×1.25), it does 50 damage instead of 40. Then heavy does 96 (no counter since opponent is now in hitstun). Total: 146. Better.

Counter hit occurs when opponent is in startup or recovery of a move. So if I can bait the opponent into doing an attack and then hit them during their startup/recovery, I get the bonus.

Strategy: stay at edge of light range. If opponent does a move (startup), walk in and counter-hit with light.

But this is hard to time with the 6-tick decision cadence. Let me just be aggressive and hope for counter hits naturally.

OK, let me also think about defensive play. When should I guard?

Guard blocks:
- Light punch (frontal)
- Blast (frontal)
- Beam (frontal)

Guard doesn't block:
- Heavy (guard break)

So against heavy attacks, I should NOT guard. Instead, I should:
- Back off (out of heavy reach 140)
- Dash back (invulnerable for 9 ticks)
- Attack first (if I can hit before their heavy active)

The problem is distinguishing when the opponent will throw heavy vs light. If they throw heavy (9 startup), I have more time to react. If I'm guarding and they throw heavy, I get guard-broken (60 damage + 34 stun).

So guarding is risky against opponents who use heavy attacks. But necessary against light/blast/beam.

Let me use a mixed defensive strategy:
- If opponent is in startup of light: guard (light can be blocked)
- If opponent is in startup of heavy: back off or dash back (avoid guard break)
- If opponent is in active: if light, guard; if heavy, try to escape (but it's too late usually)

With the 6-tick decision cadence, I might see the opponent in startup when I'm asked. For light (5 tick startup), if I see them at startup t=0 or t=1, I can guard before the active frames. For heavy (9 tick startup), more time to react.

But there's a timing issue. If I see opponent in `light` `startup` phase and decide `guard`, the guard state takes effect immediately. But my previous state might have been `forward` (walking). The guard starts at the next tick. The light is active at tick 5 of the opponent's light. If I see them at startup t=2 (3 ticks before active), and I decide `guard`, I start guarding at tick t=3 (1 tick later due to decision being applied). Wait, the decision is applied immediately in the same tick.

Actually, looking at the engine code:
```javascript
// 1. both sides choose from the same moment
const views = m.f.map((a, i) => (wants(m, a) ? view(m, i) : null));
const acts = views.map((v, i) => (v ? ask(i, v, m) : null));
acts.forEach((act, i) => views[i] && choose(m, m.f[i], act));
```

So the decision is applied in the same step. If I return `guard`, my state becomes `guard` immediately in this tick. Then in step 3, strikes are checked. If the opponent's light is active in this same tick and I'm guarding, the guard works.

So if I'm called at tick T and see opponent in light startup t=2, I return `guard`. My state becomes `guard` at tick T. If the opponent's light is active at tick T+3 (their startup ends), my guard is active (since I started guarding at tick T and it persists).

But the timing depends on when exactly I'm called vs when the opponent's light becomes active. If I'm called at the same tick as the opponent's light startup, I can guard in time.

Let me think about this differently. I'll just guard when I think the opponent is about to attack, and be aggressive otherwise.

OK, I think I've overthought this enough. Let me write the final AI:

```javascript
function decide(state) {
  const R = RULES;
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  
  // Beam clash
  if (state.clash) {
    if (me.ki > 8 || (me.hp < 300 && me.ki > 2)) return 'push';
    return 'idle';
  }
  
  // Light cancel - go for heavy knockdown
  if (me.canCancel) {
    return 'heavy';
  }
  
  // Incoming blast - guard or dodge
  for (const b of state.blasts) {
    if (b.incoming && b.eta !== null && b.eta <= 3) {
      return 'guard';
    }
  }
  
  // Opponent in beam startup - rush to interrupt
  if (opp.state === 'beam' && opp.phase === 'startup') {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent knocked down - approach or charge
  if (opp.state === 'down') {
    if (opp.left > 30 && me.ki < 50 && dist > 150) return 'charge';
    return 'forward';
  }
  
  // Opponent in hitstun/blockstun/crushed - attack
  if (['hitstun', 'blockstun', 'crushed'].includes(opp.state)) {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent in recovery (not dash) - punish
  if (opp.phase === 'recovery') {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent in dash  if (opp.state === 'dash') {
    return 'guard';
  }
  
  // Opponent in melee startup
  if (opp.phase === 'startup' && (opp.state === 'light' || opp.state === 'heavy')) {
    // If close, try to attack first (might get counter hit)
    // But risk of trading or getting hit
    // Let's guard to be safe
    return 'guard';
  }
  
  // Opponent in melee active
  if (opp.phase === 'active' && (opp.state === 'light' || opp.state === 'heavy')) {
    return 'guard'; // But if it's heavy, guard will be broken
  }
  
  // Opponent in blast startup
  if (opp.state === 'blast' && opp.phase === 'startup') {
    // They're charging a projectile, we can attack
    if (dist <= 110) return 'light';
  }
  
  // Neutral game - in light range
  if (dist <= 110) {
    return 'light';
  }
  
  // Approach
  return 'forward';
}
```

Wait, I have a problem with guarding against heavy. If opponent is in heavy active and I guard, I get guard-broken (60 damage + 34 stun). That's bad.

If opponent is in heavy startup and I guard, they might be able to hit me (9 tick startup means I can see it early). But if I back off instead, I might escape the heavy reach (140).

The issue is: if I see opponent in heavy startup at close range (within 140), and I decide `back`, I move 3/tick away. In 9 ticks (their startup), I move 27. If I was at 130, I'd be at 157. Outside heavy reach (140). Safe!

But if I'm at 110 and they do heavy (reach 140), I need to move (140-110)/3 = 10 ticks to escape. Their active is at tick 9-12. I move 27 in 9 ticks (110 → 83 away? No, back moves me away from opponent).

Wait, `back` moves me3/tick away from opponent. So if dist is 110, after 9 ticks I'm at 110 + 27 = 137. Just barely outside 140. If I'm at 130, after 9 ticks I'm at 157. Safe.

But I'm called every 6 ticks. If I see opponent in heavy startup at t=0 and decide `back`, I back for 6 ticks. Then at t=6, I'm asked again. If opponent is still in startup (t=6 of 9), I decide `back` again. After 12 ticks, dist increases by 36. Definitely safe.

But what if opponent is in heavy active (t=9 to t=12)? If I was backing from startup, by active I'm out of range. Safe.

What if opponent is in light startup? Light reach is 110. If I back, I move away3/tick. In 5 ticks (light startup), 15 units. If dist was 100, now 115. Outside light reach (110). Safe!

But the opponent is walking forward too (if they chose `forward`). Then the distance change is 3 - 4.5 = -1.5/tick (I'm backing, they're walking forward). Net closing at 1.5/tick. In 5 ticks, 7.5 units. If dist was 100, now 92.5. Still in light range.

Hmm, but if they're in `light` state (startup), they can't walk forward. Their state is `light`, not `forward`. So they're stationary during the attack.

Wait, the engine only moves fighters in `forward` or `back` states:
```javascript
if (a.state === 'forward') a.x += a.facing * R.walk.forward;
else if (a.state === 'back') a.x -= a.facing * R.walk.back;
```

So during attack startup, the fighter is stationary. If I back away during their startup, I move away from them at 3/tick and they stay still. So the distance increases by 3/tick.

For light startup (5 ticks): I move 15 away. If I was at 105, now at 120. Outside light reach.
For heavy startup (9 ticks): I move 27 away. If I was at 135, now at 162. Outside heavy reach.

Backing away during opponent's startup is very effective!

But the timing is tricky with the 6-tick decision cadence. If I see opponent in startup at the start and decide `back`, I back for 6 ticks. But their startup might end before my next decision.

Let me just handle it: if I see opponent in melee startup, back off. If I see them in melee active, guard (for light) or back (for heavy).

Actually, for melee active (3-4 ticks), it's too late to react usually. The active is only 3-4 ticks and my decision cadence is 6 ticks. I'll likely miss the active window.

OK, let me refine:

If opponent is in startup of light/heavy:
- Back off (escape the attack range)

If opponent is in active of light:
- Guard (reduce to0 damage + blockstun 11)

If opponent is in active of heavy:
- Can't guard (crush). Just take the hit.
- But at this point, I'm probably already in range and can't escape.

The key is to react during the startup phase and back off before the active.

Let me also handle: what if I'm already in a state (e.g., `forward`) and opponent starts an attack? I'm called every 6 ticks. If the opponent starts a light (5 tick startup) and I'm in `forward` state, I might get hit before I'm called again.

For example:
- Tick 0: I decide `forward`. Start walking.
- Tick 3: Opponent decides `light`. Light startup begins.
- Tick 6: I'm called again. Opponent is in `light` startup t=3. I decide `back` or `guard`.
- Tick 8: Opponent light is active (t=5). If I decided `guard` at tick 6, I'm guarding now. If `back`, I've moved 6 units away (2 ticks × 3/tick). If I was at 110, now at 116. Outside light reach!

Wait, at tick 6 I'm called and decide `back`. Back starts at tick 6. By tick 8 (opponent active), I've moved 2 ticks × 3 = 6 away. From 110 to 116. Safe!

But if opponent started light at tick 3 and I was at 100:
- Tick 6: I'm at 100 (opponent in startup t=3). I decide `back`.
- Tick 8: Opponent active. I've moved 6 to 106. Light reach is 110. Still in range!

Hmm, 100 + 6 = 106. Still in range (110). Not safe.

What if I decide `guard` at tick 6 instead? Guard blocks light. That works.

So the decision between `back` and `guard` depends on the distance:
- If dist > 110: back off (safe from light, need to check heavy reach 140)
- If dist <= 110: guard (to block the incoming light)

For heavy:
- If dist > 140: back off (safe)
- If dist <= 140: hmm, can't guard (crush). Should back off as much as possible.

OK, I think the optimal defensive strategy is:
1. Against light startup: guard if within 110, back if outside110
2. Against heavy startup: back if possible (to escape 140 reach), take the hit if not
3. Against blast: guard if incoming (blasts travel at 13/tick, easier to see coming)
4. Against beam: rush in to interrupt, or back off

Let me implement this:

```javascript
if (opp.phase === 'startup') {
  if (opp.state === 'light') {
    if (dist <= 115) return 'guard'; // Might not escape in time
    return 'back';
  }
  if (opp.state === 'heavy') {
    return 'back'; // Try to escape 140 reach
  }
  if (opp.state === 'blast') {
    if (dist <= 110) return 'light'; // Interrupt them
    return 'guard'; // Incoming blast will come
  }
  if (opp.state === 'beam') {
    return 'forward'; // Rush to interrupt
  }
}
```

Actually, for opponent in blast startup (11 ticks), I have time to approach and hit them. But11 ticks of startup + they have 18 tick recovery after. Total 29 ticks. If I can hit them during startup, I get counter damage (×1.25).

Let me also think about the offensive strategy when opponent is guarding. If they guard every time I try to light, I need to mix in heavies.

If opponent is in `guard` state:
- Light gets blocked (0 damage, I get pushed 14)
- Heavy guard-breaks (60 damage + 34 stun!)
- Blast gets blocked (12 chip)
- Beam gets blocked (120 chip)

Against a guarding opponent, heavy is great: 60 damage + 34 tick stun. During stun, I can follow up.

But heavy has 9 tick startup. If opponent stops guarding (to attack), I might get hit during my heavy startup.

Rock-paper-scissors at close range:
- I light, they guard: blocked. Bad.
- I light, they light: trade. Even.
- I light, they heavy: I hit first (light faster). Good.
- I heavy, they guard: guard break! Great.
- I heavy, they light: they hit first (light faster). Bad.
- I heavy, they heavy: trade. Even.

So light beats heavy, heavy beats guard, guard beats light. Classic RPS.

To play this optimally, I should mix up my attacks. But the AI needs to be deterministic (randomized with Math.random which is seeded per match).

Let me use a simple randomization:
- At close range, randomly choose between light, heavy, and guard.
- Weight towards light (most damage per tick).
- Occasionally throw heavy to punish guards.

But I need to be careful: heavy is slow (35 ticks total) and if it whiffs, I'm in recovery for 22 ticks.

Actually, thinking more about it: since the AI is called every 6 ticks and the decision persists for 6 ticks, mixing up is tricky. If I choose heavy at tick T, I'm committed for 35 ticks (can't decide again until freed). If I choose light, I'm committed for 17 ticks.

So the mix-up happens at the decision point. When I'm free and in range, I choose between light and heavy. If I choose light and they guard, I'm blocked and in recovery 9 ticks. Then I decide again. If I choose heavy and they guard, guard break!60 damage + 34 stun.

Let me randomize: 70% light, 30% heavy at close range.

But actually, I think the better play is to primarily use light→heavy combo and only occasionally throw raw heavy. Because light is faster and the combo does more total damage.

If they block my light: I get pushed 14 and they're in blockstun 11. I can try again. It's not that bad.

If they block my heavy: 60 damage + 34 stun. That's great!

So heavy is better against guards. But against non-guarding opponents, light is better (faster, can combo).

The key question: how often will the opponent guard? If they guard a lot, I should heavy more. If they attack a lot, I should light more.

Since I don't know the opponent's strategy in advance, I should mix. But the randomness (seeded) gives me some unpredictability.

Let me implement a mixed strategy at close range:

```javascript
if (dist <= 110) {
  // Mix up between light and heavy
  const r = Math.random();
  if (r < 0.2) return 'heavy'; // Punish guards
  return 'light'; // Main attack
}
```

Actually, let me think about this differently. Let me look at what works well and keep it simple.

The most important thing is landing the light→heavy combo. Let me focus on:
1. Getting in range (walk forward)
2. Landing light (at range ≤ 110)
3. Cancelling into heavy (knockdown)
4. RepeatingFor defense:
1. Guard when opponent is about to attack (their startup phase)
2. Back off during their startup to avoid attacks
3. Guard incoming blasts

Let me also consider: what about using `dash_forward` to close distance quickly?

Dash forward: 200 units in 10 ticks + 8 recovery = 18 ticks,10 ki.
Walking forward: 4.5/tick. To cover 200 units: 44 ticks.

Dash is much faster! But the 8 tick recovery is risky.

If the opponent is far (say 250+), dash_forward saves26 ticks. Worth the risk.

But if the opponent is close (say 150), walking is faster (22 ticks) than dash (18 ticks). Marginal benefit.

Also, dash_forward is invulnerable for 9 ticks. If the opponent is attacking, I can dash through their attack.

Let me use dash_forward when:
- Distance is200+
- I have 10+ ki
- Opponent is not attacking (or I want to dodge an attack)

Dash back when:
- I want to escape (opponent attacking)
- Need to dodge a blast or beam

OK, let me write the final version now. I'll keep it simple but effective.

Actually, let me reconsider the whole approach. Let me think about what makes a winning strategy in this game:

1. **Damage output**: Need to deal 1000 damage to win. Or more damage than opponent in 3600 ticks.
2. **Speed**: Faster combos = more DPS = more likely to win.
3. **Defense**: Taking less damage = more likely to win.
4. **Ki management**: Having ki for blasts, beams, and dashes.

The light→heavy combo does 136 damage in ~57 ticks (cycle). DPS≈ 2.39.

If I just spam light punches (when in range):
- Light: 40 damage, 17 ticks, push 14.
- After push, distance increases by 14. Need to close again.
- Cycle: 17 (light) + ~3 (approach14/4.5) = 20 ticks. DPS = 2.0.
- But light push creates distance. If opponent doesn't approach, I need to close more.

Actually, the light push is only 14 units. Walking forward at 4.5/tick closes it in 3 ticks. So the effective cycle is 20 ticks for 40 damage. DPS = 2.0.

vs light→heavy: 136 damage in 57 ticks. DPS = 2.39. But knockdown means opponent can't defend.

I think light→heavy is better because of the knockdown. Even though the DPS is only slightly higher, the knockdown prevents counterattacks and gives me initiative.

Let me also consider: what if I do light without cancel? Just light, walk forward, light again.
- Light: 40 damage, 17 ticks. Push 14.
- Walk forward: 14/4.5 ≈ 3 ticks.
- Total: 20 ticks per 40 damage. DPS = 2.0.
- But opponent might guard.

With light→heavy combo:
- 136 damage in 57 ticks. DPS = 2.39. Knockdown = safe.
- Opponent can't guard the heavy (it's after light hitstun).

So light→heavy is strictly better. Let me go with that.

Let me finalize the code. Here's my plan:

```javascript
function decide(state) {
  const R = RULES;
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  
  // Beam clash
  if (state.clash) {
    if (me.ki > 5) return 'push';
    return 'idle';
  }
  
  // Cancel after light hit
  if (me.canCancel) {
    // Chain lights if we want more damage before heavy
    // But heavy is better for knockdown
    return 'heavy';
  }
  
  // Incoming blast handling
  for (const b of state.blasts) {
    if (b.incoming && b.eta !== null && b.eta <= 3) {
      return 'guard';
    }
    if (b.incoming && b.eta !== null && b.eta <= 8 && me.ki >= 10) {
      return 'dash_back';
    }
  }
  
  // Opponent knocked down
  if (opp.state === 'down') {
    if (opp.left > 30 && me.ki < 50 && dist > 150) return 'charge';
    return 'forward';
  }
  
  // Opponent in beam startup - interrupt
  if (opp.state === 'beam' && opp.phase === 'startup') {
    return 'forward';
  }
  
  // Opponent in vulnerable state
  if (['hitstun', 'blockstun', 'crushed'].includes(opp.state)) {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent in recovery (punish)
  if (opp.phase === 'recovery') {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent dashing toward us
  if (opp.state === 'dash') {
    return 'guard';
  }
  
  // Opponent in melee startup - defensive
  if (opp.phase === 'startup' && (opp.state === 'light' || opp.state === 'heavy')) {
    if (opp.state === 'light') {
      return 'guard';
    }
    // Heavy startup - try to escape
    return 'back';
  }
  
  // Opponent in melee active
  if (opp.phase === 'active' && (opp.state === 'light' || opp.state === 'heavy')) {
    return 'guard'; // Guard blocks light, heavy crushes (nothing we can do now)
  }
  
  // Opponent in blast startup
  if (opp.state === 'blast' && opp.phase === 'startup') {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent guarding - throw heavy to crush
  if (opp.state === 'guard' && dist <= 140) {
    return 'heavy';
  }
  
  // In light range - attack
  if (dist <= 110) {
    return 'light';
  }
  
  // In heavy range but not light range
  if (dist <= 140) {
    return 'forward';
  }
  
  // Far - approach or charge
  if (dist > 250 && me.ki < 30) {
    return 'charge';
  }
  
  return 'forward';
}
```

Wait, there's a problem. When I decide `forward`, I keep walking for 6 ticks and then get asked again. During those 6 ticks, the opponent might start attacking. I won't react until my next decision.

But the opponent is also limited to decisions every 6 ticks. So if we're both in free states, we both decide at roughly the same cadence. The timing is symmetric.

The issue is: if I walk forward for 6 ticks and the opponent starts a light attack at tick 3 (their decision tick), the light is active at tick 8. I'm asked at tick 6 and can react.

At tick 6, I see opponent in light startup t=3. I decide `guard` or `back`. If `guard`, I start guarding at tick 6. Opponent light is active at tick 8. My guard is active (guard persists). Blocked!

If `back`, I start backing at tick 6. By tick 8, I've moved 6 units. If dist was 110, now 116. Outside light reach. Safe!

So the reaction time is sufficient as long as I see the opponent's startup before the active.

For light (5 tick startup), if opponent starts at their decision tick, I see them3 ticks later (at my next decision tick, 3 ticks into their startup). I have 2 more ticks before active. I can guard or back.

For heavy (9 tick startup), I see them 3 ticks in. 6 more ticks to active. Plenty of time to back away.

This seems manageable.

But what if I'm already in a committed state? Like I decided `light` and am in the middle of it. Then I can't react. But that's expected - if I'm attacking, I'm committed.

Let me also handle the case where I'm in `forward` state and the opponent is in `light` startup. I should guard immediately. But what if I'm called at a tick where the opponent's light is already active? Then I should guard (to block) or take the hit.

Let me handle active frames:
- Opponent light active: guard (0 damage + blockstun)
- Opponent heavy active: too late to escape, just accept the hit

Actually, for opponent heavy active (4 ticks), if I'm within 140 and they're hitting, I can't avoid it. Unless I was already backing.

OK, I think the code above is reasonable. Let me refine it.

One more thing: when should I use `beam`?

Beam: 280 damage, 50 ki, 30 tick startup (interruptible), 40 tick firing, 20 tick recovery.

Best use cases:
1. After knockdown when I can start the beam before opponent gets up (need 30+ ticks of safety)
2. When opponent is far and I can catch them with the beam

After heavy knockdown: opponent down 42 ticks, I recover in 22 ticks. I have 20 ticks of free time. Beam startup is 30. Not enough!

Unless I don't do the heavy and instead:
- Light hit → cancel into beam
- Beam starts at T+6 (after light hit at T+5)
- Beam startup30 ticks: T+6 to T+35
- Opponent hitstun from light: T+5 to T+19 (15 ticks)
- At T+20, opponent is free
- Beam fires at T+36
- There's a 16 tick gap where opponent is free and can move

This is risky because opponent can:
- Walk away during beam startup
- Attack me during beam startup (interrupting it)
- Guard the beam (120 chip damage)

If opponent walks back at 3/tick during the 16 tick gap: 48 units. Beam front starts at T+36 at my_x + 40. Opponent at distance 110 + 48 + 40 = 198. Beam front advances 30/tick. Reaches 198 after 198/30 ≈ 7 ticks (T+43). Beam fires for 40 ticks. Plenty of time.

Wait, let me recalculate. The beam front starts at `my_x + 40` (from = my_x + 25, front = my_x + 40 initially). Then advances 30/tick. So:
- T+36: front at my_x + 40
- T+37: front at my_x + 70
- T+38: front at my_x + 100
- T+39: front at my_x + 130
- T+40: front at my_x + 160

If opponent is at my_x + 198 (after walking back), beam front reaches them at T+42 (front = my_x + 190) or T+43 (front = my_x + 220). So within 7 ticks of firing start. Beam fires for 40 ticks total. Plenty of time.

But the opponent might have guarded by then. Guarded beam does 120 chip damage. That's still significant!

Also, beam's `hit` flag means it only hits once. If opponent is hit once during the beam, the beam doesn't do more damage.

Actually, looking at the code:
```javascript
if (!b || b.hit) continue;
```

So the beam hits only once.280 damage if it hits unguarded.

If opponent guards: 120 chip + stun until beam ends.

The stun from guarding a beam: `ctx.stun = Bm.startup + Bm.fire - a.t + 6`. This is `30 + 40 - a.t + 6 = 76 - a.t`. If the beam is at the start of firing (a.t = 30), stun = 46. If later, less stun. But it's `stun(o, 'blockstun', ctx.stun)` where stun is the blockstun duration.

Wait, looking more carefully:
```javascript
stun(o, 'blockstun', kind === 'beam' ? ctx.stun : M.blockstun);
```

And `ctx.stun = Bm.startup + Bm.fire - a.t + 6`. Here `a` is the beam shooter. So the stun depends on how many ticks the beam has been firing.

If beam just started firing (a.t = 30): stun = 30 + 40 - 30 + 6 = 46 ticks of blockstun. That's a long time!
If beam is about to end (a.t = 69): stun = 30 + 40 - 69 + 6 = 7 ticks.

So guarding the beam early gives a long blockstun. Not great for the guarder.

Actually wait, let me re-read. The `stun` function sets the opponent's state to `blockstun` for `dur` ticks. During blockstun, the opponent can't act. So a long blockstun is bad for the defender.

If the beam hits while guarded early (long stun), the defender is stuck in blockstun for a long time. During that time, I can approach and attack!

So beam is good even if guarded: 120 chip + long blockstun.

But the 30 tick startup is the main risk. If I get hit during startup, the beam is cancelled and I lose 50 ki.

OK, let me think about when to use beam:
1. Opponent is knocked down (guaranteed hit) - but I can't time it perfectly
2. Opponent is at long range and approaching (they can't easily interrupt)
3. As a punish when opponent whiffs (they're in long recovery)

For #2: if opponent is at distance 300+ and walking toward me, beam startup is 30 ticks. In 30 ticks, opponent closes 300-135 = 165 at 4.5/tick (if walking). That's 135 ticks. Wait, 300/4.5 = 67 ticks to close from 300 to 0. They need300-110 = 190 ticks at 4.5/tick. That's 42 ticks. So during my 30 tick beam startup, they close 135 units (30×4.5). If they started at 300, they're at 165 when my beam starts firing. Beam reaches165 units in 165/30 = 6 ticks. So the beam hits them about 36 ticks after I start.

But they might dash_forward during the beam startup (200 units in 10 ticks). From 165, they'd be at -35 (behind me). But they can't move through me (minGap 60). Actually, dash_forward can go through if there's room behind. So they could end up behind me.

Hmm, this is getting complex. Let me just use beam when:
1. I have 50+ ki
2. Opponent is knocked down or in long stun
3. Distance is reasonable (not too far)

And for most of the fight, use the light→heavy combo.

Actually, you know what, let me try a slightly different approach. Let me consider what happens when I face different opponent strategies:

**Against aggressive opponents**: They'll rush in and attack. I should:
- Be ready to guard their attacks
- Punish their recovery
- Use the light→heavy combo

**Against defensive opponents**: They'll guard a lot. I should:
- Use heavy to guard-break
- Use blast for chip damage
- Use beam for big chip + stun

**Against beam users**: They'll try to beam at range. I should:
- Rush in to interrupt beam startup
- Dodge beams with dash

Since I don't know the opponent, I need a balanced strategy. Let me incorporate:
- Aggressive approach (walk forward)
- Light→heavy combo
- Guard against attacks
- Heavy against guards (guard break)
- Beam when safeLet me also think about timing. The game is 3600 ticks (60 seconds). At DPS ~2.4, I can deal about 8640 damage. But I only need 1000 to KO. So the fight should last about 420 ticks (7 seconds) if I'm consistently dealing damage. But there's approach time, recovery, etc.

Actually, the real fight time might be 800-1500 ticks per round. The opponent also deals damage. So I need to maximize my damage while minimizing theirs.

Let me just write the code and see how it plays out.

Here's my refined code:

```javascript
function decide(state) {
  const R = RULES;
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  
  // Beam clash
  if (state.clash) {
    if (me.ki > 5) return 'push';
    return 'idle';
  }
  
  // Cancel after light hit - heavy for knockdown
  if (me.canCancel) {
    return 'heavy';
  }
  
  // Incoming blast - guard or dodge
  for (const b of state.blasts) {
    if (b.incoming && b.eta !== null) {
      if (b.eta <= 2) return 'guard';
      if (b.eta <= 6 && me.ki >= 10) return 'dash_back';
    }
  }
  
  // Opponent knocked down - close distance or charge
  if (opp.state === 'down') {
    if (opp.left > 30 && dist > 180 && me.ki < 50) return 'charge';
    return 'forward';
  }
  
  // Opponent in beam startup - rush to interrupt
  if (opp.state === 'beam' && opp.phase === 'startup') {
    return 'forward';
  }
  
  // Opponent in hitstun/blockstun/crushed - attack
  if (['hitstun', 'blockstun', 'crushed'].includes(opp.state)) {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent in recovery - punish
  if (opp.phase === 'recovery') {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent dashing
  if (opp.state === 'dash') {
    return 'guard';
  }
  
  // Opponent in melee startup
  if (opp.phase === 'startup' && (opp.state === 'light' || opp.state === 'heavy')) {
    if (opp.state === 'light') {
      return dist <= 115 ? 'guard' : 'back';
    }
    return 'back'; // Heavy startup - try to escape
  }
  
  // Opponent in melee active
  if (opp.phase === 'active' && (opp.state === 'light' || opp.state === 'heavy')) {
    return 'guard'; // Might block light, heavy will crush (nothing to do)
  }
  
  // Opponent in blast startup - interrupt
  if (opp.state === 'blast' && opp.phase === 'startup') {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent guarding - heavy to crush
  if (opp.state === 'guard') {
    if (dist <= 140) return 'heavy';
    return 'forward';
  }
  
  // In range - attack
  if (dist <= 110) {
    return 'light';
  }
  
  // Approach or charge
  if (dist > 250 && me.ki < 30) return 'charge';
  return 'forward';
}
```

Hmm, I think this is decent but could be improved. Let me think about edge cases and optimizations.

1. When opponent is in `guard` and I decide `heavy`, I'm committed for 35 ticks. If they stop guarding and attack me during my9 tick startup, I get hit. This is the risk of throwing raw heavy.

To mitigate: only throw heavy when I'm sure they're guarding. But the state only tells me they're guarding NOW. They might switch to something else at their next decision tick.

2. When I'm close and opponent is free, I throw `light`. If they also throw `light`, we trade (both take 40 damage). If they guard, my light is blocked.

To handle trades: trades are roughly even (both take 40). Not great but not terrible.

3. Counter hit bonus: if I can catch opponent in startup or recovery, I get ×1.25. For light: 50 damage. For heavy: 150 damage. Very good.

How to get counter hits:
- Attack during opponent's startup (they're about to attack)
- Attack during opponent's recovery (after their attack)

For startup: if I see opponent in light/heavy startup and I'm in range, I should attack immediately instead of guarding. Light startup is 5 ticks. If I start my light, it hits at tick 5. Their light hits at tick 5 too (from their start). But their startup started before mine (I'm reacting). So they'll hit first.

Actually, if I see opponent in startup t=3 of their light (2 ticks before active), and I decide `light`, my light hits at tick 5 (from my start). Their light is active at tick 2 (from their start). So their light hits 3 ticks before mine. They hit me first.

So attacking during their startup is risky. I might trade (if my attack lands in the same tick as theirs) or I might get hit first.

For recovery: opponent is in recovery and can't do anything. Easy punish. I should attack immediately.

The code handles recovery by attacking. Good.

Let me also think about: when the opponent is in `charge` state. They're vulnerable (damage ×1.5) and stationary. I should attack!

But the code doesn't explicitly handle `charge` state of opponent. Let me check: `charge` is a free state. When opponent is in `charge`, their state is `charge`. My code falls through to "In range - attack" if dist ≤ 110. So I'd throw `light`. But I should be more aggressive - maybe `heavy` for the ×1.5 bonus!

Heavy on charging opponent: 120 × 1.5 = 180 damage! Plus knockdown. That's huge.

Let me add:
```javascript
if (opp.state === 'charge' && dist <= 140) {
  return 'heavy';
}
```

This should be placed before the general "in range" check.

Also, for counter hits on opponent in startup/recovery:
```javascript
if (opp.phase === 'startup' || opp.phase === 'recovery') {
  if (dist <= 140) return 'heavy'; // Counter hit × 1.25 = 150 damage
  return 'forward';
}
```

Heavy counter hit: 120 × 1.25 = 150 damage + knockdown. Better than light counter (50 damage).

But heavy is slower (9 tick startup). If opponent is in recovery and I throw heavy, it might not hit before they recover.

Let me think: opponent is in recovery. Their recovery might last 9-22 ticks. My heavy startup is 9 ticks. If they have 10+ ticks of recovery left, my heavy hits them. If less, they might recover first.

But I can't see exactly how many ticks of recovery they have left. The `left` field tells me this!

If `opp.left >= 10` (at least 10 ticks of recovery left), heavy will hit (9 tick startup + need1 active tick).
If `opp.left < 10`, light is safer (5 tick startup).

Let me add this logic:
```javascript
if (opp.phase === 'recovery') {
  if (dist <= 140 && opp.left >= 10) return 'heavy'; // Counter hit
  if (dist <= 110) return 'light';
  return 'forward';
}
```

Hmm, but after heavy hit (knockdown), I'm stuck in recovery for 22 ticks. If the opponent was in recovery and I do heavy, the knockdown gives me the same advantage as before. The extra 150 damage (vs 50 from light counter) is significant.

Let me also think: what if I do light counter (50 damage) then cancel into heavy (96 damage)? Total: 146. But the heavy doesn't get the counter bonus (opponent is now in hitstun).146 + knockdown.

vs raw heavy counter (150 damage + knockdown). 150 > 146. So raw heavy counter is better!

But raw heavy has 9 tick startup. Light has 5 tick startup. So light→heavy combo (15 ticks total to hit) vs raw heavy (9 ticks to hit). Raw heavy is faster and does more damage!

Wait, that can't be right. Let me re-check.

Raw heavy counter: 120 × 1.25 = 150 damage + knockdown. Hits at tick 9.
Light→heavy: light hits at tick 5 (50 damage if counter). Cancel to heavy. Heavy hits at tick 15 (96 damage). Total 146 + knockdown.

Raw heavy is150 damage, hits at tick 9. Light→heavy is 146 damage, hits at tick 15. Raw heavy is better!

But the counter bonus only applies to the hit that catches the opponent in startup/recovery. If I do light first and it's a counter, then heavy (combo 2) doesn't get counter bonus. So:
- Light counter: 40 × 1.25 = 50
- Heavy (combo 2): 120 × 0.8 = 96
- Total: 146

vs:
- Heavy counter: 120 × 1.25 = 150

150 > 146. Raw heavy counter is better! And it's faster (9 vs 15 ticks).

So when I catch opponent in recovery or startup and I'm within140, I should throw raw heavy for maximum damage.

But what if the opponent recovers from their state before my heavy is active (9 tick startup)? Then I don't get the counter bonus.

For opponent in recovery: recovery lasts 9-22 ticks. If they have 10+ ticks left, my heavy hits while they're still in recovery. Counter bonus.
For opponent in startup: startup lasts 5-30 ticks. If they have 10+ ticks of startup left, my heavy hits while they're still in startup. Counter bonus. But then the heavy hits during their startup, which is also a counter.

Actually, the `mult` function checks:
```javascript
function mult(R, o) {
  if (o.state === 'charge') return R.chargeHit;
  const p = phase(R, o);
  return MOVES.has(o.state) && (p === 'startup' || p === 'recovery') ? R.counter : 1;
}
```

So counter applies if the opponent is in startup OR recovery of a move. The hit lands at the active frame of my heavy (tick 9 of my heavy). At that point, if the opponent is still in startup or recovery of their move, I get counter.

For opponent in recovery: their recovery lasts R-22 ticks (for heavy) or R-9 ticks (for light). If they started their recovery 1 tick ago and it lasts 22 ticks, they have 21 ticks left. My heavy hits at tick 9. They have 12 ticks left. Still in recovery. Counter!

For opponent in startup: if they're1 tick into their 5-tick light startup, they have 4 ticks left. My heavy hits at tick 9. They're no longer in startup (finished5 ticks ago, now in active/recovery). No counter.

Hmm, so it depends on timing. If opponent is in early startup (many ticks left) and I throw heavy, the heavy might hit during their active or recovery. Not a counter.

If opponent is in late recovery (few ticks left) and I throw heavy, the heavy might hit after they recover. Not a counter.

The safest counter hit is when opponent is in long recovery (like heavy's 22 tick recovery) or long startup (like beam's 30 tick startup). In those cases, heavy will definitely hit during their vulnerable state.

OK, I think the code should handle this:
- If opponent is in recovery with `left >= 12`: throw heavy (counter guaranteed)
- If opponent is in recovery with `left < 12`: throw light (faster, might still counter)
- If opponent is in startup with `left >= 12`: throw heavy (counter guaranteed)
- If opponent is in startup with `left < 12`: throw light

But wait, `left` for the opponent... let me check the view format. In the view:
```javascript
left: a.dur ? a.dur - a.t : 0
```

So `opp.left` is the remaining ticks in their current state (for states with duration). For `free` states, `left` is 0.

For opponent in recovery of heavy: `left` = remaining recovery ticks.
For opponent in startup of beam: `left` = remaining startup ticks.

I can use `opp.left` to determine if I have enough time for a heavy.

Let me incorporate this:

```javascript
if (opp.phase === 'recovery' || opp.phase === 'startup') {
  const canHeavy = dist <= 140 && opp.left >= 12;
  if (canHeavy) return 'heavy';
  if (dist <= 110) return 'light';
  return 'forward';
}
```

This is good for maximizing damage on punishes.

Let me also handle the `charge` state:
```javascript
if (opp.state === 'charge') {
  if (dist <= 140) return 'heavy';
  return 'forward';
}
```

Heavy on charging opponent: 120 × 1.5 = 180 damage. Huge!

OK, let me finalize the code. Let me also add some refinements:

1. Use beam when opponent is knocked down and I have 50 ki. But the timing is tight (30 tick startup). Let me think about this more.

After heavy knockdown at tick X:
- I recover at tick X + 22 (heavy recovery after hit)
- Wait, heavy hits at active frame. Let me say heavy hits at tick X.
- Heavy active ends at X + 3 (or so). Recovery22 ticks. Freed at X + 26.
- Actually, let me trace: heavy starts at some tick, active at tick 9-12 of the move. Hit at tick 9 (first active). Recovery 13-34. Freed at 35.
- So if heavy starts at T, hits at T+9, freed at T+35.
- Opponent down from T+9 to T+51 (42 ticks).
- I'm free at T+35. Opponent down for 16 more ticks.
- If I start beam at T+35: startup 30 ticks. Ends at T+65. Opponent up at T+51. 14 ticks where opponent is free.
- If I start beam immediately at T+35 and opponent walks back:14 × 3 = 42 units. Plus beam front starts at my_x + 40 and advances 30/tick. At T+65 (beam fires), opponent is at distance 274 + 42 - 0 = 316? No, distance was 274 (light push + heavy knockback). During free time, I walk forward 16 × 4.5 = 72. Distance 202. Opponent walks back 14 × 3 = 42. Distance 244.

At T+65 (beam fires), beam front starts at my_x + 40. Opponent at my_x + 244. Front needs to cover 204 units. At 30/tick, 7 ticks. At T+72, front reaches opponent. Beam fires for 40 ticks (T+65 to T+105). Plenty of time.

But at T+51 (opponent gets up), they can do anything. If they attack me, the beam startup is interrupted. If they guard, the beam chip does 120 damage + blockstun.

The risk: opponent attacks me during beam startup (T+35 to T+64). If they get up at T+51 and attack, my beam is interrupted at T+56 (their light hits after 5 tick startup). I lose 50 ki.

Unless I approach during free time and beam at close range. If I'm within 110 of opponent at T+35 and start beam, the beam front is only 70 units away from opponent. Beam fires at T+65, reaches opponent at T+68 (front at my_x + 40 + 3×30 = my_x + 130). Actually, front starts at my_x + 40 and advances 30/tick.

Hmm, but at T+51, opponent can attack me. My beam is interrupted. Very risky.

What if I don't beam and just continue the light→heavy cycle? More reliable.

I think beam is best used:
1. When opponent is at long range and I want to pressure them
2. As a risky move when I'm ahead on health3. In a clash

For now, let me not use beam and focus on the melee combo.

Actually wait, one more use case: when opponent is in beam startup and I'm far away. If I can't interrupt in time (they're at distance 300+), I could beam back to counter their beam. But beam vs beam = clash. Clash is risky.

Let me skip beam for now. The melee combo is more reliable.

But actually, let me think about beam more. After a knockdown, if I have 50 ki, I could:
1. Walk forward for 16 ticks (approach)
2. Start beam at close range (say distance 120)
3. Beam startup 30 ticks
4. Opponent gets up at tick 51 and can move
5. Beam fires at tick 65
6. Beam front reaches opponent quickly at close range

The question is: can the opponent interrupt my beam? They get up at T+51 (16 ticks after I start beam at T+35). They need to close distance and hit me within the remaining 14 ticks of beam startup. If I'm at distance 120 and they walk forward at 4.5/tick, they close 63 units in 14 ticks. From 120 to 57. Within light reach (110). They can hit me!

But I'm in beam startup. Any hit interrupts the beam. So if they hit me during startup, the beam is cancelled and I lose 50 ki.

If they attack with light (5 tick startup), it hits 5 ticks after they start. They start at T+51. Hit at T+56. Beam startup ends at T+65. They hit me 9 ticks before beam fires. Beam is cancelled.

If they attack with heavy (9 tick startup), hit at T+60. Still before T+65. Beam is cancelled.

So at close range, the opponent can interrupt my beam after getting up. The beam is only safe if:
1. The opponent is very far away (can't reach me before beam fires)
2. The opponent is in a long stun (still stunned when beam fires)

For case 2: opponent knocked down 42 ticks. Beam startup 30 ticks. If I start beam within 12 ticks of the knockdown (so beam fires before opponent gets up). But I'm in heavy recovery for 22 ticks after the heavy hit. So I can't start beam within 12 ticks of knockdown.

Unless I cancel light into beam. Light hits at T+5. Cancel at T+6. Beam starts at T+6. Beam startup 30 ticks. Fires at T+36. Opponent hitstun from light: T+5 to T+19. Opponent free at T+20. Beam fires at T+36. 16 ticks where opponent can react.

But opponent is at distance 110 (light range). During16 ticks, they can walk back 48 units to 158. Beam front starts at T+36 at my_x + 40. Opponent at my_x + 158. Front needs to cover 118 units. At 30/tick, 4 ticks. T+40. Beam fires for 40 ticks. Plenty of time.

But at T+20, opponent is free. They can attack me during the remaining 16 ticks of beam startup. If they walk forward and light (5 tick startup), they hit at T+25. Beam is cancelled.

If they guard instead, beam fires at T+36. They can guard. Beam does 120 chip + blockstun.

Hmm, it depends on the opponent's behavior. If they attack, beam is cancelled. If they guard, beam does 120 chip.

I think the safest beam usage is:
1. When opponent is at long range (>300) and I want to chip them
2. When opponent is in a very long stun (like beam blockstun)

For now, let me skip beam and focus on melee. The AI will be more reliable without the risky beam.

Wait, actually there's one more thing. If I do light → cancel into beam and the beam fires, even if the opponent guards, they take 120 chip damage + long blockstun. During the blockstun, I can walk up and attack again. So the beam is actually a good pressure tool.

But the risk is: if they attack me during beam startup, I lose 50 ki and take damage. That's very bad.

Let me make beam usage conditional: only use it when opponent is in a long vulnerability state (knockdown with enough time left, or long hitstun). And when I have 50 ki to spare.

Let me think about: light hit (15 tick hitstun) → cancel into beam (30 tick startup). Beam fires 30 ticks after cancel =36 ticks after light hit. Opponent hitstun only 15 ticks. Not enough.

heavy hit (42 tick knockdown) → beam (30 tick startup). But I'm in heavy recovery 22 ticks. Beam can't start for 22 ticks. 22 + 30 = 52 ticks. Knockdown is 42 ticks. Beam fires after opponent gets up. Not safe.

What about: heavy knockdown → walk forward (16 ticks) → beam (30 tick startup). Total: 22 + 16 + 30 = 68 ticks from heavy hit. Knockdown is 42 ticks. Beam fires 26 ticks after opponent gets up. Very unsafe.

So beam after knockdown is never safe with the standard combo. Beam is only safe when:
1. Opponent is at very long range (can't reach me in 30 ticks)
2. I use dash_forward to close distance AND start beam... but can't do both at once.

Actually, what if I do: light → cancel into heavy → knockdown → dash_forward → beam?

After heavy knockdown at tick X:
- Freed at X + 26
- Dash forward at X + 26: 10 ticks moving (X+26 to X+35), 8 ticks recovery (X+36 to X+43). Freed at X+44.
- Opponent gets up at X+42.
- Start beam at X+44: 30 tick startup (X+44 to X+73). Fires at X+74.
- Opponent has been free since X+42. 32 ticks to react.

Not safe. Opponent can easily reach me and interrupt.

I think beam is fundamentally hard to use safely in this game. The 30 tick startup is too long and can always be interrupted unless the opponent is very far away or in a long stun.

Let me think about one more scenario: what if I beam from very far away (300+)?

At distance 300, opponent walks forward at 4.5/tick. In 30 ticks (beam startup), they close 135 units. From 300 to 165. Still far from me (light reach 110). They can't interrupt the beam.

Beam fires at tick 30 (from start). Front starts at my_x + 40. Opponent at my_x + 165. Front covers 125 units. At 30/tick, 5 ticks. Beam hits at tick 35. Beam fires for 40 ticks (tick 30 to 69).

At tick 35, beam front is at my_x + 190. Opponent at my_x + 165. Covered! Beam hits (280 damage).

But the opponent is moving toward me. At tick 30 (beam fires), they're at 165. At tick 35, they've moved 22.5 closer to 142.5. Beam front at190. Still covering them. Hit!

After the hit, opponent goes down (50 ticks). I can approach and continue.

But what if the opponent dashes forward? At tick 10 (beam startup), they dash forward (200 units in 10 ticks). At tick 20, they've covered 200. From 300-45 = 255 (after 10 ticks of walking) to 55 (after dash). Now they're at 55 distance. Very close. At tick 25 (still beam startup), they can attack me. Light at tick 30. Beam startup ends at tick 30. Light hits at tick 30. Beam is just barely starting to fire. Actually, looking at the code:

```javascript
if (a.state === 'beam' && a.t === Bm.startup) { m.beams[a.side] = ... }
```

This checks `a.t === Bm.startup` (30). The beam object is created at tick 30. But the hit check is in the same tick:

```javascript
if (!inRay(b, o.x, R.body)) continue;
```

So the beam exists at tick 30 and checks for hit in the same tick. If the opponent is within the beam range at tick 30, they get hit.

But if the opponent hits me at tick 30 with light (first active tick of their light), and the beam is created at tick 30... does the hit interrupt the beam?

In `beams()`:
```javascript
for (const a of m.f) {
    if (a.state === 'beam' && a.t === Bm.startup) { m.beams[a.side] = ... }
    if (m.beams[a.side] && (a.state !== 'beam' || a.t >= Bm.startup + Bm.fire)) m.beams[a.side] = null;
}
```

If I was hit at tick 30 (state changed to hitstun), then `a.state !== 'beam'` is true. The beam is immediately set to null. So even the tick30 beam is cancelled.

Wait, but the hit happens in step 3 (strikes) BEFORE beams. Let me re-check the step order:

```javascript
// 3. what connects
strikes(m);
blasts(m);
beams(m);
```

Strikes first! So if the opponent's light hits me at tick 30, my state changes to hitstun. Then in beams(), `a.state !== 'beam'` is true, and the beam is set to null (was it ever created? The creation check is `a.t === Bm.startup`, but a.state is now 'hitstun', not 'beam'). Actually:

```javascript
if (a.state === 'beam' && a.t === Bm.startup) { ... }
```

Since a.state is 'hitstun' now, this doesn't trigger. The beam is never created. Even if it was created earlier in this tick (it wasn't - it would be created here).

Actually, the order in beams() is:
1. For each fighter, check if beam should be created (a.state === 'beam' && a.t === startup)
2. For each fighter, check if beam should end (a.state !== 'beam' or t >= startup+fire)
3. Advance beam fronts
4. Check for clash
5. Check for hits

So if I was hit by a strike earlier in this tick (step 3 of step()), my state is hitstun. Then in beams(), step 1 doesn't trigger (state is not 'beam'). The beam is never created. Good, so the hit does prevent the beam from firing.

But what if the hit happens on the same tick as the beam would fire? The beam is created and immediately hits the opponent. Then the strike hits me. Does the beam already do damage?

Actually, looking at the order: strikes() is called before beams(). So:
1. strikes() - opponent's light hits me, I go to hitstun
2. beams() - my state is hitstun, beam not created, no damage

So the opponent's strike hits first and prevents my beam from firing. The beam is fully cancelled.

This means: if the opponent can hit me on the exact tick my beam would fire (tick 30 of beam startup), the beam is cancelled and I lose 50 ki. That's the worst case.

To prevent this: I need to be far enough that the opponent can't reach me before the beam fires.

At distance 300+, opponent walks at 4.5/tick. In 30 ticks, 135 units. Distance 165. Still far. They can't reach with light (110) or heavy (140). They'd need to dash.

If they dash forward at tick 0 (when I start beam): 200 units in 10 ticks + 8 recovery. At tick 18, they're at distance 100. They can attack at tick 18 (freed from dash recovery). Light at tick 23 (5 startup). That's 7 ticks before beam fires (tick 30). Light hits at tick 23. Beam cancelled.

If they dash forward at tick 5: 200 units in 10 ticks (tick 5-14) + 8 recovery (tick 15-22). Freed at tick 23. Light at tick 28 (5 startup). Hits at tick 28. Beam fires at tick 30. Light hits 2 ticks before. Beam cancelled.

If they dash at tick 10: freed at tick 28. Light at tick 33. Hits at tick 33. Beam fires at tick 30. Beam already fired3 ticks ago. The beam is active! Opponent gets hit by beam.

Hmm wait, if they dash at tick 10 and are freed at tick 28, they start light at tick 28. Light hits at tick 33 (5 startup). Beam fires at tick 30. At tick 30, beam checks for hits. Opponent is in dash recovery at tick 30 (dash runs from tick 10-19 (moving) to tick 20-27 (recovery)). Wait, dash is 10 ticks moving + 8 recovery = 18 total. From tick 10: ticks 10-19 moving, ticks 20-27 recovery. Freed at tick 28. So at tick 30, opponent is free (freed at tick 28) and has started light (tick 28, startup 5 ticks, hits at tick 33).

At tick 30, opponent is in light startup (t=2). Beam fires. Beam front at my_x + 40. Opponent at... let me calculate.

Starting distance: 300. I start beam at tick 0. Opponent dashes at tick 10.
- Ticks 0-10: opponent walks forward 4.5/tick = 45 units. Distance 255.
- Ticks 10-19: opponent dashes forward 200 units (10 ticks). Distance 55.
- Ticks 20-27: opponent in recovery. Distance 55.
- Tick 28: opponent freed. Starts light. Distance 55.

At tick 30: beam fires. Front at my_x + 40. Opponent at my_x + 55. Front is at40, opponent at 55. inRay checks: `x + pad >= lo && x - pad <= hi`. The beam covers from `from` (my_x + 25) to `front` (my_x + 40). Opponent at my_x + 55. Body = 30. So opponent center at 55. Beam covers 25 to 40.55 + 30 = 85, 55 - 30 = 25. Check: 25 >= 25 && 25 <= 40. Wait, `inRay(b, o.x, R.body)`:
```
const lo = Math.min(b.from, b.front), hi = Math.max(b.from, b.front);
return x + pad >= lo && x - pad <= hi;
```
b.from = my_x + 25, b.front = my_x + 40. lo = my_x + 25, hi = my_x + 40.
x = opponent.x = my_x + 55. pad = 30.
x + pad = my_x + 85 >= my_x + 25 ✓
x - pad = my_x + 25 <= my_x + 40 ✓

So yes, the beam hits! Even at distance 55, the beam (covering from 25 to 40 from me) with body radius 30 reaches the opponent (at 55, with body extending to 25 from me).

So the beam hits the opponent at tick 30 even though they're close. 280 damage!

But wait, the beam hits once (b.hit = true). And then the opponent continues their light attack. At tick 33, their light hits me. But I'm in beam firing state. The hit interrupts the beam? Let me check:

In strikes(), when opponent's light hits me:
```javascript
land(m, a, o, kind, ctx);
```

In land(), for light:
```javascript
stun(o, 'hitstun', M.hitstun);
```

My state becomes hitstun. Then in beams() (called after strikes in the same tick? No, strikes and beams are both in step 3):

Actually, let me re-read the step order:
```javascript
// 3. what connects
strikes(m);
blasts(m);
beams(m);
```

Both strikes and beams happen in the same tick. Strikes first. If the opponent's light hits me at tick 33, my state becomes hitstun. Then beams() runs. In beams():
```javascript
if (m.beams[a.side] && (a.state !== 'beam' || a.t >= Bm.startup + Bm.fire)) m.beams[a.side] = null;
```

My state is hitstun, so `a.state !== 'beam'` is true. The beam is set to null. The beam is cancelled at tick 33.

But the beam already hit at tick 30 (280 damage to opponent). Then the beam is cancelled at tick 33 when I'm hit. The beam did damage before being cancelled.

And the opponent got hit by the beam at tick 30 and went into hitstun (50 ticks down). Wait, beam does `knock(m, o, a, Bm.down, Bm.knockback)` which puts opponent in `down` state for 50 ticks.

So at tick 30: beam hits opponent. Opponent goes down for 50 ticks (ticks 30-80). Opponent is in `down` state.
At tick 33: opponent is in `down` state. Can they still hit me?

Looking at strikes():
```javascript
if (invuln(R, o)) { ... continue; }
```

And invuln:
```javascript
const invuln = (R, a) => a.state === 'down' || a.state === 'ko' || (a.state === 'dash' && a.t < R.dash.invuln);
```

Opponent in `down` state is invulnerable! So their light (if it was started before the beam hit) doesn't hit me because they're in `down` state.

Wait, but the light was started at tick 28 (before the beam hit at tick 30). At tick 33, the light would be in active phase. But the opponent is in `down` state (since tick 30). Their state was changed to `down` by the beam hit.

But what about the `hit` flag? In strikes():
```javascript
if ((a.state !== 'light' && a.state !== 'heavy') || a.hit || phase(R, a) !== 'active') continue;
```

The opponent's state is now 'down', not 'light'. So the condition `a.state !== 'light'` is true. The strike doesn't happen!

So the beam hits at tick 30, opponent goes down, and their light attack is effectively cancelled. I take no damage!

This is great! So if I can get the beam to fire before the opponent's attack connects, the beam wins.

The key timing: beam fires at tick 30 of beam startup. Opponent's light (started at tick 28) hits at tick 33. Beam fires3 ticks before light. Beam wins.

But what if the opponent started light at tick 24 (earlier)? Light hits at tick 29. Beam fires at tick 30. Light hits 1 tick before beam fires.

At tick 29: opponent's light is active. Strike check: opponent state is 'light', active. Hits me. My state becomes hitstun.
At tick 30: my state is hitstun. beams() cancels my beam.

So if the opponent's light hits 1 tick before my beam fires, the beam is cancelled. Bad.

The timing depends on when the opponent starts their attack. If they start early enough to hit before tick 30, the beam is cancelled. If they start later, the beam fires and hits them.

From the analysis above: if the opponent dashes at tick 0 (start of my beam), they can attack at tick 18 (after dash recovery). Light at tick 23. Hits at tick 28. Beam fires at tick 30. Light hits 2 ticks before. Beam cancelled!

So against a dashing opponent who attacks immediately, the beam is cancelled. The closer the opponent, the easier it is for them to interrupt.

OK so beam from distance 300 is safe if opponent doesn't dash. If they dash, it might not be.

This is a gamble. I think beam is best used as a risk/reward option when I'm confident the opponent won't interrupt.

For a more practical approach: let me use beam when:
1. I have 50 ki and the opponent is far (300+)
2. The opponent is in a state where they can't easily interrupt (knocked down with lots of time left)

For case 2: opponent knocked down with 42 ticks left. I start beam immediately (need to be free). But I'm in heavy recovery for 22 ticks. So beam starts 22 ticks after knockdown. Beam fires 52 ticks after knockdown. Knockdown is only 42 ticks. Beam fires 10 ticks after opponent gets up. Unsafe.

Unless I don't do heavy. If I do light only (no heavy), opponent is in hitstun (15 ticks) but not knocked down. Beam startup is 30. Not enough.

What if I do: light (hit, 15 tick hitstun) → light (cancel, 15 tick hitstun,15+6=21 ticks total stun from first hit) → heavy (cancel, knockdown 42 ticks) → beam?

Let me trace:
- Light 1 at T. Hits T+5. Hitstun T+5 to T+19.
- Light 2 at T+6. Hits T+11. Hitstun T+11 to T+25.
- Heavy at T+12. Hits T+21. Knockdown T+21 to T+63.
- Heavy recovery: T+25 to T+46. Freed T+47.
- Beam at T+47. Startup T+47 to T+76. Fires T+77.

Opponent gets up at T+63. Beam fires at T+77. 14 ticks gap. Unsafe.

What if I do: light (cancel into beam)?

- Light at T. Hits T+5.
- Beam at T+6. Startup T+6 to T+35. Fires T+36.
- Opponent hitstun T+5 to T+19. Free at T+20.

Gap from T+20 to T+36 = 16 ticks. Opponent can walk back or attack. If they walk back (3/tick), 48 units. Beam front at T+36 at my_x + 40. Opponent at my_x + 110 + 14 (push) + 48 = 172. Front at 40. Gap132. At 30/tick, 5 ticks. Beam hits at T+41.

But opponent can attack during the 16 tick gap. They walk forward to close distance and light me. Light at T+20. Startup 5. Hits at T+25. Beam startup ends at T+35. Beam is cancelled at T+25.

Unless they don't attack. If they guard (expecting beam), the beam fires at T+36 and does 120 chip + blockstun. That's decent.

This is opponent-dependent. Against an aggressive opponent, beam is risky. Against a defensive opponent, beam is good.

Let me use beam as a mix-up: sometimes beam after light hit (instead of heavy). It's a risk/reward play. If it works: 40 + 280 = 320 damage. If it fails: 40 damage + lose 50 ki.

Expected value depends on opponent's response. If opponent always attacks during beam startup: always fail. If opponent always guards: always succeed.

Since I don't know the opponent, let me use beam sparingly. Maybe 10-20% of the time after a light hit. The randomness (Math.random) provides unpredictability.

Actually, I just realized: the rule says Math.random() is seeded per match. So the same match replays identically. My randomness is fixed for a given match. But across matches, it varies. That's fine for a tournament.

OK, let me just write the final code. I'll include beam as an occasional option.

Actually, you know what, let me think about this from a higher level. What's the most reliable way to win?

1. **Damage race**: Deal more damage than opponent. Light→heavy combo does 136 per cycle. At DPS ~2.4, I can deal 1000 damage in ~420 ticks (7 seconds). This is fast.

2. **Survival**: Minimize damage taken. Guard when possible, avoid attacks.

3. **Ki economy**: Generate ki for dashes and occasional beams.

I think the key is:
- Be aggressive (deal damage fast)
- Be defensive when needed (guard, back off)
- Use dash to close distance efficiently
- Mix in heavy to punish guards

Let me write the code one more time, cleanly:

```javascript
function decide(state) {
  const R = RULES;
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  
  // Beam clash
  if (state.clash) {
    return me.ki > 5 ? 'push' : 'idle';
  }
  
  // Cancel after light hit
  if (me.canCancel) {
    // Heavy for knockdown is most reliable
    return 'heavy';
  }
  
  // Incoming blasts
  for (const b of state.blasts) {
    if (b.incoming && b.eta !== null && b.eta <= 3) return 'guard';
    if (b.incoming && b.eta !== null && b.eta <= 7 && me.ki >= 10) return 'dash_back';
  }
  
  // Opponent knocked down
  if (opp.state === 'down') {
    if (opp.left > 30 && dist > 180 && me.ki < 50) return 'charge';
    return 'forward';
  }
  
  // Opponent in beam startup - rush to interrupt
  if (opp.state === 'beam' && opp.phase === 'startup') return 'forward';
  
  // Opponent in hitstun/blockstun/crushed
  if (['hitstun', 'blockstun', 'crushed'].includes(opp.state)) {
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent in recovery - punish with heavy for counter damage
  if (opp.phase === 'recovery') {
    if (dist <= 140 && opp.left >= 11) return 'heavy';
    if (dist <= 110) return 'light';
    return 'forward';
  }
  
  // Opponent dashing
  if (opp.state === 'dash') return 'guard';
  
  // Opponent in melee startup
  if (opp.phase === 'startup' && (opp.state === 'light' || opp.state === 'heavy')) {
    return opp.state === 'light' ? 'guard' : 'back';
  }
  
  // Opponent in melee active
  if (opp.phase === 'active' && (opp.state === 'light' || opp.state === 'heavy')) {
    return 'guard';
  }
  
  // Opponent in blast startup - interrupt
  if (opp.state === 'blast' && opp.phase === 'startup') {
    return dist <= 110 ? 'light' : 'forward';
  }
  
  // Opponent charging - punish hard
  if (opp.state === 'charge') {
    return dist <= 140 ? 'heavy' : 'forward';
  }
  
  // Opponent guarding - heavy to crush
  if (opp.state === 'guard' && dist <= 140) return 'heavy';
  
  // In light range
  if (dist <= 110) return 'light';
  
  // Far - charge or approach
  if (dist > 250 && me.ki < 30) return 'charge';
  return 'forward';
}
```

Wait, there's an issue with the "Opponent in melee startup" case. If opponent is in heavy startup and I return `back`, I back for 6 ticks. But their heavy active starts9 ticks after their start. If I see them at startup t=3 (6 ticks before active), and I back for 6 ticks, I move 18 units. From140 to 158. Outside heavy reach (140). Safe!

But if I see them at startup t=6 (3 ticks before active), and I back for 6 ticks... wait, the active is at t=9-12. At t=6, 3 more ticks to active. I back for 6 ticks (to t=12). In6 ticks, I move 18 units. If I was at 130, now 148. Outside 140. Safe.

But I'm only asked every 6 ticks. If I see them at startup t=3 and decide `back`, I back until t=9 (next decision). At t=9, they're in active phase (t=9-12). I can't escape now. But I've already moved 18 units in 6 ticks. If I started at 140, I'm at 158. Outside reach. Safe!

Hmm, but what if they started heavy at close range (e.g., 80)? At t=3 (I see them), I back for 6 ticks. 80 + 18 = 98. Still within140. Not safe.

The issue is that at very close range, backing away isn't fast enough to escape heavy.

For light (reach 110,5 tick startup): if opponent starts light at 80 distance, and I back for 5 ticks, 80 + 15 = 95. Still in range. Not safe.

So at very close range (80-110), backing away doesn't work fast enough. I should guard instead.

Let me refine: if opponent is in startup of any melee attack:
- If distance is 115+ (can escape light reach): back
- If distance is 145+ (can escape heavy reach): back
- Otherwise: guard (light) or just accept (heavy)

Actually, the distinction is:
- Opponent light startup: reach 110. To escape: need to move > (dist - 110) in5 ticks. At 3/tick = 15. Need dist - 110 < 15, so dist > 125. If dist > 125, back is safe. If dist <= 125, guard is needed.
- Opponent heavy startup: reach 140. To escape: need to move > (dist - 140) in 9 ticks. At 3/tick = 27. Need dist - 140 < 27, so dist > 167. If dist > 167, back is safe. If dist <= 167, back doesn't help (might escape if dist is close to 140 though).

Wait, I need to be more careful. "Escape" means being outside reach when the active frames start.

Light: startup 5 ticks. Active at tick 5-7. If I start backing at tick 0 (when I see them in startup), after 5 ticks I've moved 15 away. New distance = dist + 15. Need dist + 15 > 110. So dist > 95. If dist > 95, back is safe.

But I don't see them at tick 0 (the very start of their startup). I see them at my next decision tick, which is 0-5 ticks into their startup (depending on timing). If I see them at tick 3 (3 ticks into startup), I have 2 more ticks before active. Moving 6 units. New distance = dist + 6. Need dist + 6 > 110. dist > 104.

This is getting complicated. Let me just use a simple heuristic:
- Opponent in melee startup and dist > 130: back (escape)
- Opponent in melee startup and dist <= 130: guard (block light, survive heavy)

For heavy, guard means getting crush-broken (60 damage + 34 stun). Not great. But if I can't escape, there's not much I can do.

Actually, for heavy at close range, maybe I should attack first! If I start light (5 tick startup) and opponent is in heavy startup (9 tick startup), my light hits at tick 5 and theirs at tick 9. I hit first! And the counter bonus doesn't apply (they're in startup, but I hit during their startup).

Wait, `mult()` checks if the opponent is in startup or recovery. If they're in heavy startup and I hit them with light, the opponent is in heavy startup. So it's a counter hit! 40 × 1.25 = 50 damage.

Then my light puts them in hitstun. Their heavy is cancelled (state changes from 'heavy' to 'hitstun'). So attacking during their heavy startup is actually a great counter!

But there's a risk: if we trade (both hit in the same tick). Can that happen? If I start light at the same tick they start heavy... no, we're both called at the same ticks. If they decided heavy at tick T and I decide at tick T+3 (6-tick cadence might not align), then...

Actually, both fighters are asked at the same ticks (every 6 ticks from when they became free). If both became free at the same tick, they're asked at the same ticks. They both decide at tick T. One does heavy, one does light. Both start at tick T. Light active at T+5, heavy active at T+9. Light hits first. Counter! Heavy is cancelled.

But if the opponent became free 3 ticks before me, their cadence is offset. They decide at T-3, T+3, T+9... I decide at T, T+6, T+12... So at T-3, they decide heavy. At T, I see them in heavy startup t=3. I decide light. My light active at T+5. Their heavy active at T+6 (startup t=3 + 3 more = t=6, active at t=9, absolute T-3+9 = T+6). So my light hits at T+5, their heavy at T+6. I hit first! Counter.

In most cases, attacking during their startup is good because my attack (light) hits before theirs (heavy startup is9 ticks).

What about if they're in light startup? Light startup is 5 ticks. If I see them at startup t=3 and start my light (5 tick startup), my light active at T+5. Their light active at T+2 (startup t=3 + 2 = t=5, absolute = their_start + 5). Hmm, the timing depends on when exactly their startup began.

Let me use absolute ticks. Opponent starts light at tick T_o. I see them at tick T_me. T_o <= T_me (they started before I decided).

Opponent light active at T_o + 5 to T_o + 7.
My light active at T_me + 5 to T_me + 7.

If T_me = T_o + 3 (I see them 3 ticks into their startup):
- Their active: T_o + 5 to T_o + 7 (= T_me + 2 to T_me + 4)
- My active: T_me + 5 to T_me + 7
- Their active ends 1 tick before mine starts. They hit me first!

So if I'm reacting to their startup, their attack will usually hit before mine. Unless they started later.

This means: attacking during their startup is risky if their startup is short (light: 5 ticks). But OK if their startup is long (heavy: 9 ticks, beam: 30 ticks).

For light startup: I should guard (to block their light).
For heavy startup: I should attack (my light hits before their heavy).
For beam startup: I should attack (plenty of time).

Let me implement this:

```javascript
if (opp.phase === 'startup') {
  if (opp.state === 'light') return 'guard';
  if (opp.state === 'heavy') return dist <= 110 ? 'light' : 'guard';
  if (opp.state === 'beam') return dist <= 110 ? 'light' : 'forward';
  if (opp.state === 'blast') return dist <= 110 ? 'light' : 'guard';
}
```

Actually, for heavy startup, attacking with light is good because:
1. My light hits before their heavy (5 < 9 startup)
2. Counter hit bonus (×1.25)
3. Cancels their heavy
4. I can then cancel into heavy for combo

This is very strong! Let me make sure this works.

If opponent is in heavy startup at close range (dist ≤ 110):
- I decide `light`
- Light active at T+5 (where T is my decision tick)
- Opponent heavy active at T_o + 9 (where T_o is their heavy start)
- T_o < T (they started before my decision)
- If T - T_o < 4 (I see them early in their startup), then T_o + 9 > T + 5 (their heavy is later)
- My light hits first at T+5. Counter bonus. Their heavy is cancelled.

If T - T_o >= 4 (I see them late in their startup), then T_o + 9 <= T + 5 might hold:
- T_o + 9 <= T + 5 when T - T_o >= 4
- Their heavy active starts at or before my light active
- Both hit on the same tick or their heavy hits first

Hmm, this edge case is tricky. But it's a narrow window. In most cases, my light will hit first.

OK, let me just write the code. I've been overthinking this.

Here's my final strategy:

```javascript
function decide(state) {
  const R = RULES;
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  
  // Beam clash - push to win
  if (state.clash) {
    return me.ki > 5 ? 'push' : 'idle';
  }
  
  // Cancel after light hit - heavy for knockdown
  if (me.canCancel) {
    return 'heavy';
  }
  
  // Incoming blasts - guard or dodge
  for (const b of state.blasts) {
    if (b.incoming && b.eta !== null) {
      if (b.eta <= 3) return 'guard';
      if (b.eta <= 7 && me.ki >= 10) return 'dash_back';
    }
  }
  
  // Opponent knocked down - approach or charge
  if (opp.state === 'down') {
    if (opp.left > 25 && dist > 180 && me.ki < 50) return 'charge';
    return 'forward';
  }
  
  // Opponent in beam startup - rush to interrupt
  if (opp.state === 'beam' && opp.phase === 'startup') return 'forward';
  
  // Opponent in hitstun/blockstun/crushed - attack
  if (['hitstun', 'blockstun', 'crushed'].includes(opp.state)) {
    return dist <= 110 ? 'light' : 'forward';
  }
  
  // Opponent in recovery - punish
  if (opp.phase === 'recovery') {
    if (dist <= 140 && opp.left >= 12) return 'heavy'; // Counter hit
    return dist <= 110 ? 'light' : 'forward';
  }
  
  // Opponent in startup
  if (opp.phase === 'startup') {
    if (opp.state === 'heavy' && dist <= 110) return 'light'; // Beat them to it
    if (opp.state === 'light') return 'guard';
    return 'guard';
  }
  
  // Opponent in active - guard
  if (opp.phase === 'active') return 'guard';
  
  // Opponent dashing - guard
  if (opp.state === 'dash') return 'guard';
  
  // Opponent charging - punish with heavy
  if (opp.state === 'charge') {
    return dist <= 140 ? 'heavy' : 'forward';
  }
  
  // Opponent guarding - heavy to crush
  if (opp.state === 'guard' && dist <= 140) return 'heavy';
  
  // In light range - attack
  if (dist <= 110) return 'light';
  
  // Far - charge or approach
  if (dist > 250 && me.ki < 30) return 'charge';
  return 'forward';
}
```

Hmm wait, I'm not handling opponent in blast startup correctly. Blast startup is 11 ticks. If opponent is in blast startup at close range, I should attack to interrupt (counter hit + cancel their blast).

Let me fix:

```javascript
if (opp.phase === 'startup') {
    if (opp.state === 'heavy' && dist <= 110) return 'light'; // Beat them to it
    if (opp.state === 'blast' && dist <= 110) return 'light'; // Interrupt blast
    return 'guard'; // Guard against light, or heavy (will be crushed but nothing to do)
}
```

Actually, for opponent in blast startup: they're stationary and I can hit them. Light is 5 tick startup. Blast is 11 tick startup. I have plenty of time. Counter hit.

For opponent in beam startup: 30 tick startup. I have lots of time. Rush in and attack.

Let me also handle: opponent in `recover` state (after winning a clash). They're in recovery (20 ticks). Free punish.

Actually, `recover` is not in the MOVES set. So `phase()` returns null for `recover` state. Let me check: `recover` is a state set when winning a clash. The `phase` function:

```javascript
switch (a.state) {
    case 'light': case 'heavy': ...
    case 'blast': ...
    case 'beam': ...
    case 'dash': ...
}
return null;
```

`recover` falls through to `return null`. So `opp.phase` is null for `recover` state. My code checks `opp.phase === 'recovery'` which is different from `opp.state === 'recover'`.

Let me add: `if (opp.state === 'recover') return dist <= 110 ? 'light' : 'forward';`

Also, `crushed` state: opponent is in guard-break stun. They can't do anything. My code already handles this.

OK wait, I also need to handle `opp.state === 'clash'`. But if opponent is in clash, I should also be in clash (since clash happens when both beams meet). Actually, if I'm not in a beam and opponent is in clash... that doesn't make sense. Clash requires both beams. So if opponent is in clash, I should also be in clash. In that case, `state.clash` would be non-null and I'd handle it at the top.

Let me finalize and clean up:

```javascript
function decide(state) {
  const R = RULES;
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  
  // Beam clash
  if (state.clash) {
    return me.ki > 5 ? 'push' : 'idle';
  }
  
  // Cancel after light hit
  if (me.canCancel) {
    return 'heavy';
  }
  
  // Incoming blasts
  for (const b of state.blasts) {
    if (b.incoming && b.eta !== null) {
      if (b.eta <= 3) return 'guard';
      if (b.eta <= 7 && me.ki >= 10) return 'dash_back';
    }
  }
  
  // Opponent knocked down
  if (opp.state === 'down') {
    if (opp.left > 25 && dist > 180 && me.ki < 50) return 'charge';
    return 'forward';
  }
  
  // Opponent in hitstun/blockstun/crushed/recover
  if (['hitstun', 'blockstun', 'crushed', 'recover'].includes(opp.state)) {
    return dist <= 110 ? 'light' : 'forward';
  }
  
  // Opponent in beam startup
  if (opp.state === 'beam' && opp.phase === 'startup') return 'forward';
  
  // Opponent in recovery
  if (opp.phase === 'recovery') {
    if (dist <= 140 && opp.left >= 12) return 'heavy';
    return dist <= 110 ? 'light' : 'forward';
  }
  
  // Opponent dashing
  if (opp.state === 'dash') return 'guard';
  
  // Opponent in startup of attacks
  if (opp.phase === 'startup') {
    if ((opp.state === 'heavy' || opp.state === 'blast') && dist <= 110) return 'light';
    return 'guard';
  }
  
  // Opponent in active
  if (opp.phase === 'active') return 'guard';
  
  // Opponent charging
  if (opp.state === 'charge') {
    return dist <= 140 ? 'heavy' : 'forward';
  }
  
  // Opponent guarding
  if (opp.state === 'guard' && dist <= 140) return 'heavy';
  
  // In range
  if (dist <= 110) return 'light';
  
  // Approach
  if (dist > 250 && me.ki < 30) return 'charge';
  return 'forward';
}
```

Wait, I should think about a few more things:

1. When to use `dash_forward` to close distance faster?
 - When distance is very large (>300) and I have ki
   - Saves time compared to walking

2. When to use `dash_back`?
   - To dodge incoming blasts
   - To escape from opponent's attacks
   - When I need to create space

3. Should I ever use `beam`?
   - Only in specific situations (e.g., opponent far, I have 50 ki)
   - Maybe when opponent is knocked down and I can start beam before they get up... but the timing doesn't work (22 tick recovery + 30 tick startup = 52 ticks vs 42 tick knockdown)

Actually, let me reconsider beam usage. What if I do: light hit → cancel into beam instead of heavy?

Light hits at T+5. Cancel at T+6. Beam starts at T+6. Beam startup 30 ticks. Fires at T+36. Opponent in hitstun from light until T+19. Free from T+20.

From T+20 to T+36 (16 ticks), opponent can:
1. Walk back (3/tick, 48 units away)
2. Walk forward and attack
3. Guard
4. Dash

If opponent walks back: beam fires at T+36. Front starts at my_x + 40. Opponent at 110 + 14 (push) + 48 = 172 from me. Front at 40. Need to cover 132. At 30/tick, 5 ticks. Hits at T+41. Beam fires for 40 ticks. Yes, hits.

If opponent walks forward and attacks with light: light starts at T+20. Active at T+25. Hits me at T+25. My beam is in startup (T+6 to T+35). I get hit at T+25. Beam cancelled. I lose 50 ki.

If opponent guards: beam fires at T+36. Front reaches opponent at T+41 (similar to walk-back case). Beam does 120 chip + blockstun.

If opponent dashes back: 200 units in 10 ticks. From T+20 to T+29. Then 8 recovery ticks. Distance: 124 + 200 = 324. Beam front at T+36 starts at 40. Need to cover 284. At 30/tick, 10 ticks. Hits at T+46. Beam fires 40 ticks (T+36 to T+75). Hits at T+46. Yes, hits.

If opponent dashes forward: 200 units in 10 ticks. From T+20 to T+29. Lands at distance max(124-200, 60) = 60 (minGap). Then 8 recovery. At T+36 (beam fires), opponent at 60 distance. Front at 40. Need to cover 20. At 30/tick, 1 tick. Hits at T+37. But wait, during the dash (T+20 to T+29), opponent is moving through me. At T+29, they land at 60 (or behind me). Then 8 recovery (T+30 to T+37). At T+36, they're in recovery. Beam front at 40. Opponent at 60. Covered (40+30 body = 70 >= 60). Hit!

But during the dash (T+20 to T+28), they're invulnerable (9 ticks). At T+29 (not invulnerable), they're in dash recovery (T+30 to T+37). Can be hit. But the beam hasn't fired yet (fires at T+36).

At T+36: beam fires. Opponent in recovery (dash recovery T+30 to T+37). Front at 40. Opponent at 60. Covered. Hit!

So dash forward doesn't help the opponent escape. But if they dash forward and then attack... at T+38 (freed from dash recovery), they start light. Active at T+43. But beam already hit at T+37. Opponent is in beam hitstun/down. They can't attack.

Wait, beam does280 damage and `down` 50 ticks. So opponent is knocked down at T+37 for 50 ticks. They can't attack.

So actually, the beam after light hit is quite reliable! Even if opponent tries various things, the beam fires before they can effectively interrupt (except if they walk forward and attack).

The main risk is: opponent walks forward immediately and attacks. Let me calculate.

Opponent at distance 124 (after light push). Walks forward at 4.5/tick. At T+20 (free), walks for 5 ticks to T+25 (light active). Distance 124 - 22.5 = 101.5. In light range (110). Light hits at T+25. My beam is in startup. Beam cancelled.

If opponent does this: I lose 50 ki and take 40 damage (their light). But they also took 40 damage (my light that started the combo). Net: -50 ki, -40 HP vs -40 HP for opponent. Bad for me.

But what if I do light → light → beam?Light 1 hits T+5. Cancel to light 2 at T+6. Light 2 hits T+11. Cancel to beam at T+12. Beam startup T+12 to T+41. Fires T+42. Opponent in hitstun from light 2 until T+25. Free at T+26.

From T+26 to T+42 (16 ticks), opponent can attack. Walk forward at 4.5/tick: 72 units. Distance was 124 + 14 (light 2 push) = 138. After walking 72: 66. In light range. Light at T+31 (5 startup). Hits at T+31. Beam startup ends T+41. Hit at T+31. Beam cancelled.

Same problem. The opponent can always walk forward and interrupt.

Unless I use4 lights before beam. 4 lights hit at T+5, T+11, T+17, T+23. Last hit at T+23. Cancel to beam at T+24. Beam startup T+24 to T+53. Fires T+54. Opponent in hitstun from light 4 until T+37. Free at T+38.

From T+38 to T+54 (16 ticks). Same 16 ticks gap. Opponent walks forward and attacks.

The gap is always 16 ticks regardless of chain length (because hitstun is 15 ticks and beam startup is 30 ticks: 30-15+1 = 16).

So beam after any light chain has a 16 tick gap. During this gap, opponent can walk forward (4.5/tick = 72 units) and attack.

From light hit distance (~124 after push), 72 units walk = 52 distance. In light range. They can hit me.

Unless... I walk backward during the beam startup? But I can't do anything during beam startup. I'm committed to the beam.

Or use dash_back during the gap? But I can't - I'm in beam startup.

What if the beam push (knockback) is 120? The beam hit does knockback 120 and down 50. But this only applies when the beam hits. If the opponent interrupts before the beam fires, no knockback.

So the16 tick gap is the key problem. Any time I use beam after a hit, there's a 16 tick gap where the opponent can interrupt.

Unless the opponent is knocked down (from heavy) instead of hitstun (from light). Heavy knockdown is 42 ticks. If I start beam during the knockdown... but I'm in heavy recovery for 22 ticks. By the time I'm free (22 ticks after hit), opponent has 20 ticks of knockdown left. Beam startup is 30. Not enough.

What if I do: light → heavy (knockdown) → wait for recovery → walk forward → beam?

After heavy recovery (22 ticks), opponent has 20 ticks of knockdown left. I walk forward 20 ticks (90 units). Then start beam at tick 42 after heavy hit (22 recovery + 20 walk). Beam startup 30 ticks. Ends at tick 72. Opponent got up at tick 42. Gap: 30 ticks.

Same problem, even worse.

I think beam is fundamentally hard to use offensively in this game. It's only safe when the opponent can't reach me during the 30 tick startup. That means distance200+ (opponent would need ~100 ticks to close from 200 to 110 at 4.5/tick... wait, that's 20 ticks).

Opponent walks at 4.5/tick. From 200 to 110: 90 units, 20 ticks. From 250 to 110: 140 units, 31 ticks.

So at distance 250+, beam startup (30 ticks) is longer than the time for opponent to close distance (31 ticks). Barely safe.

At distance 300+: opponent needs 42 ticks to close. Beam fires at tick 30. Safe.

So beam is safe from distance 250+. And it does 280 damage + knockdown.

Should I beam when at distance 250+ and have 50 ki? Let me think about the opportunity cost:
- Beam: 280 damage, 50 ki, 50 ticks (startup + fire + recovery). DPS = 5.6.
- Light→heavy: 136 damage, 0 ki, 57 ticks. DPS = 2.39.

Beam is much more efficient IF it lands. But the startup is 30 ticks of vulnerability.

If I'm at 250+ distance and the opponent is approaching, I can beam safely. After the beam hits (280 damage + knockdown), I approach and continue.

Let me add beam usage:
```javascript
// Far range - consider beam
if (dist >= 250 && me.ki >= 50 && !me.blastOut) {
  return 'beam';
}
```

Wait, beam doesn't need to check blastOut. Only blast does.

Actually, looking at the engine code for beam start:
```javascript
if (a.ki < cost || (act === 'blast' && m.blasts.some(b => b.owner === a.side))) { a.st.invalid++; return; }
```

The blast check only applies to blast. Beam doesn't have this restriction. So I can beam even with a blast on screen.

OK, let me add beam when far and I have 50 ki. But I should be careful: if the opponent dashes forward (200 units in 10 ticks), they could close from 250 to 50 in 10 ticks (dash) + 8 recovery = 18 ticks. Then they can attack at tick 18+5 = 23. Before my beam fires at tick 30.

Hmm, dash is a problem. Even at 250 distance, opponent can dash to close distance.

What about distance 350+? Dash covers 200 units. From 350 to 150. Still outside light range (110). They need to walk more (40 units at 4.5/tick = 9 ticks). So attack at 18+9+5 = 32 ticks. My beam fires at 30. Just barely safe!

At distance 400+: dash to 200, walk to 110 (20 ticks). Attack at 18+20+5 = 43. Beam fires at 30. Safe!

So beam is safe from distance 350+. But the game starts at 300 distance. If both walk forward, distance decreases. Beam is only safe when I'm far away and opponent doesn't dash.

Actually, the key question is: will the opponent dash? If they do, beam is risky at any distance below ~350.

I think I'll use beam when:
1. Distance is 350+ (safe from dash + walk)
2. I have 50 ki
3. Only once per fight (save ki for other things)

Or: use beam when the opponent is knocked down and I can start beam before they get up. But the timing doesn't work as shown above.

Actually, one more scenario: what if the opponent is already in hitstun or knockdown and I have time to beam?

Light hit (15 tick hitstun) → beam (30 tick startup). Not enough time.

But what if I do light hit → light hit → beam? The chain keeps the opponent in hitstun longer.

Light 1 at T+5 (hitstun T+5 to T+19). Light 2 at T+11 (hitstun T+11 to T+25). Beam at T+12. Beam startup T+12 to T+41. Opponent free at T+25. Gap T+25 to T+41 = 16 ticks. Same problem.

What if I do light → light → light → beam?

Light 4 at T+23 (hitstun T+23 to T+37). Beam at T+24. Beam startup T+24 to T+53. Opponent free at T+37. Gap 16 ticks.

Always 16 ticks. The hitstun from the last light is always 15 ticks and beam startup is 30, so 30-15+1 = 16.

What if I do light → heavy (knockdown) → immediately start beam?

Heavy hits at T+15 (from 1-light→heavy combo). Heavy recovery T+19 to T+40. Freed T+41. Opponent down T+15 to T+57. I start beam at T+41. Beam startup T+41 to T+70. Opponent gets up T+57. Gap 13 ticks.

13 ticks gap. Opponent walks forward at 4.5/tick = 58.5 units. Distance after knockback ~264. After walking 58.5 = 205.5. Not in light range (110). They can't hit me!

But they can dash forward (200 units in 10 ticks). From 205.5 to 5.5. Within light range! Dash recovery 8 ticks. Attack at T+57+10+8+5 = T+80. Beam fires at T+70. They can attack10 ticks after beam fires. But by then, beam has been firing for 10 ticks. Does the beam hit them?

At T+70, beam fires. Front at my_x + 40. Opponent at my_x + 205.5 (approximately). Front covers 40 units. Opponent at 205.5. Gap165.5. At 30/tick, 6 ticks. Hits at T+76.

Opponent dashes at T+57 (gets up). 10 ticks moving (T+57 to T+66). Lands at 205.5 - 200 = 5.5. Then 8 recovery (T+67 to T+74). Freed T+75. Attack at T+80 (5 startup).

At T+76, beam front reaches opponent. Hit! Opponent goes down (50 ticks). Their attack at T+80 never happens (they're in down state).

But wait, the beam front advances 30/tick. Let me trace:
- T+70: front at my_x + 40
- T+71: front at my_x + 70
- T+72: front at my_x + 100
- T+73: front at my_x + 130
- T+74: front at my_x + 160
- T+75: front at my_x + 190
- T+76: front at my_x + 220

Opponent at 5.5 (after dash). Wait, they're at 5.5 from me. But the beam is `from my_x + 25 to front`. At T+76, front at220. Opponent at 5.5. But 5.5 is INSIDE the beam (from 25 to 220). So the beam already covered them!

Actually, the inRay check:
```javascript
function inRay(b, x, pad) { const lo = Math.min(b.from, b.front), hi = Math.max(b.from, b.front); return x + pad >= lo && x - pad <= hi; }
```

b.from = my_x + 25. b.front = my_x + 220 (at T+76). x = opponent.x = my_x + 5.5. pad = 30.
x + pad = my_x + 35.5 >= my_x + 25 ✓
x - pad = my_x - 24.5 <= my_x + 220 ✓

Yes, covered! But wait, the opponent is at 5.5 which is BEHIND the beam's starting point (25). Let me re-check: the beam goes from `from` (my_x + 25) in the direction of the opponent. `front` is the leading edge. But `from` is behind `front` (it's the origin). So the beam covers from my_x + 25 to my_x + 220. Opponent at my_x + 5.5 is to the LEFT of my_x + 25. 

inRay: lo = 25, hi = 220. x + 30 = 35.5 >= 25 ✓. x - 30 = -24.5 <= 220 ✓.

So yes, the beam covers the opponent even at 5.5! Because the body radius (30) makes it reach from -24.5 to 35.5, which overlaps with the beam range (25 to 220).

But actually, the opponent at 5.5 is almost on top of me (minGap is 60). Wait, 5.5 is the distance? No, `dist` is the absolute distance. But the beam is directional (from = my_x + 25 in the facing direction). If the opponent is at my_x + 5.5 (in front of me), that's within the beam range.

Actually, I think I confused the position. Let me recalculate.

After the heavy knockback, opponent is at distance ~264 from me. After walking20 ticks (my free time), distance ~264 - 90 = 174. Wait, I said I walk 20 ticks during free time. But the opponent is knocked down and stationary. So distance after free time: 264 - 20×4.5 = 264 - 90 = 174.

Then I start beam at T+41 (or whenever I'm free). Opponent gets up at T+57. Dash forward at T+57 (10 ticks to cover 200). Distance 174 - 200 = -26. But minGap prevents overlap. Actually, dash can go through opponent. So they land behind me at distance... the dashEnd function handles this.

Hmm, this is getting very complex. Let me just implement the beam usage and not overthink the edge cases.

The key insight: beam is powerful (280 damage + knockdown) and can be used safely from long range (250+) or when opponent is knocked down. Let me add it as an option.

Here's my refined code:

```javascript
function decide(state) {
  const R = RULES;
  const me = state.me;
  const opp = state.opp;
  const dist = state.dist;
  
  // Beam clash
  if (state.clash) {
    return me.ki > 5 ? 'push' : 'idle';
  }
  
  // Cancel after light hit
  if (me.canCancel) {
    return 'heavy';
  }
  
  // Incoming blasts
  for (const b of state.blasts) {
    if (b.incoming && b.eta !== null) {
      if (b.eta <= 3) return 'guard';
      if (b.eta <= 7 && me.ki >= 10) return 'dash_back';
    }
  }
  
  // Opponent knocked down
  if (opp.state === 'down') {
    if (opp.left > 30 && dist > 180 && me.ki < 50) return 'charge';
    return 'forward';
  }
  
  // Opponent in hitstun/blockstun/crushed/recover
  if (['hitstun', 'blockstun', 'crushed', 'recover'].includes(opp.state)) {
    return dist <= 110 ? 'light' : 'forward';
  }
  
  // Opponent in beam startup
  if (opp.state === 'beam' && opp.phase === 'startup') return 'forward';
  
  // Opponent in recovery
  if (opp.phase === 'recovery') {
    if (dist <= 140 && opp.left >= 12) return 'heavy';
    return dist <= 110 ? 'light' : 'forward';
  }
  
  // Opponent dashing
  if (opp.state === 'dash') return 'guard';
  
  // Opponent in startup of attacks
  if (opp.phase === 'startup') {
    if ((opp.state === 'heavy' || opp.state === 'blast') && dist <= 110) return 'light';
    return 'guard';
  }
  
  // Opponent in active
  if (opp.phase === 'active') return 'guard';
  
  // Opponent charging
  if (opp.state === 'charge') {
    return dist <= 140 ? 'heavy' : 'forward';
  }
  
  // Opponent guarding
  if (opp.state === 'guard' && dist <= 140) return 'heavy';
  
  // Far range - beam opportunity
  if (dist >= 280 && me.ki >= 50) return 'beam';
  
  // In range
  if (dist <= 110) return 'light';
  
  // Approach or charge
  if (dist > 250 && me.ki < 30) return 'charge';
  return 'forward';
}
```

Actually, I realize I should be more careful with the beam. The beam only makes sense if:
1. The opponent won't interrupt it (far away or knocked down)
2. I have 50 ki to spare

At distance 280, the opponent can walk forward (4.5/tick) and close to 280 - 30×4.5 = 145 in 30 ticks (beam startup). Still outside light reach (110). They need30×4.5 + (145-110)/4.5 = 135+8 = 143 units... wait, let me recalculate.

Starting distance280. Beam startup 30 ticks. Opponent walks at 4.5/tick = 135 units. Distance at beam fire: 280-135 = 145. Outside light reach. Beam fires. Front starts at my_x + 40. Opponent at my_x + 145. Front at 40. Gap 105. At 30/tick, 4 ticks. Hits at T+34.

But at T+30 (beam fires), opponent is at 145. They can continue walking and maybe attack. Light at T+30+5 = T+35. But beam hits at T+34 (1 tick before their light). Beam does 280 damage + knockdown. Their light is cancelled (they're in down state).

What if opponent dashes at T+0? Dash 200 in 10 ticks + 8 recovery. Distance 280-200 = 80 at T+10. Then 8 recovery (T+18). Freed T+18. Light at T+23 (5 startup). Hits T+23. Beam startup ends T+30. Hit at T+23. Beam cancelled.

So at distance 280, a dashing opponent can interrupt the beam! I need distance 350+ to be safe from dash.

At distance 350: dash to 150 (T+10). Recovery to T+18. Walk 5 ticks to T+23 (light active). Distance 150-22.5 = 127.5. Outside light reach (110). Walk 4 more ticks to T+27. Distance 127.5-18 = 109.5. In light range! Light at T+27 (started at T+22? Hmm, let me redo).

At T+18 (freed from dash recovery): distance 150. Walk at 4.5/tick.
T+18 to T+22 (4 ticks): distance 150-18 = 132.
T+22 to T+26 (4 ticks): distance 132-18 = 114. Still outside 110.
T+26 to T+30 (4 ticks): distance 114-18 = 96. In range.

But the opponent decides every 6 ticks. At T+18 (freed), they decide `forward`. Walk until T+24. At T+24, decide `light` (if within range). Distance at T+24: 150 - 6×4.5 = 150-27 = 123. Outside 110. They'd walk more. At T+30 (next decision): 123-27 = 96. In range. Light at T+30. Active at T+35.

Beam fires at T+30. Front at my_x + 40. Opponent at my_x + 96. Front at 40, opponent at 96. Gap 56. At 30/tick, 2 ticks. Hits at T+32. Their light at T+35. Beam hits 3 ticks before their light. Beam does 280 damage. Their light is cancelled.

Wait, but at T+30, the beam fires AND the opponent decides `light`. The decision is applied in the same tick. So at T+30:
1. Both decide: opponent decides `light`. I'm in beam (not free). No decision for me.
2. Moves.
3. Strikes/blasts/beams. Beam checks for hits. Opponent at 96 distance. Beam front at 40. Covered (with body radius 30: 96-30=66 >= 40? Actually inRay checks x+pad >= lo and x-pad <= hi. lo=25, hi=40. x=96, pad=30. 96+30=126 >= 25 ✓. 96-30=66 <= 40? 66 <= 40 ✗. NOT covered!

Wait, the beam at T+30 (just fired) has front at my_x + 40 and from at my_x + 25. The opponent at my_x + 96. Body radius 30. So the opponent's body extends from 66 to 126. The beam covers from 25 to 40. 66 > 40. Not covered!

The beam front hasn't advanced yet at T+30. It only advances at T+31 (next tick). So at T+30, the beam covers only 25 to 40. Opponent at 96 is not covered.

At T+31: front advances to 70. Beam covers 25 to 70. Opponent at 96.66 <= 70? Yes! Covered. Hit!

But at T+31, opponent is in light startup (started at T+30). At T+35, light is active. Beam hit at T+31. Opponent goes down (50 ticks). Light is cancelled (opponent in down state).

So the beam DOES hit the opponent before their light is active! Because the beam front advances at 30/tick and reaches the opponent in 2 ticks (from 40 to 70), while the opponent's light takes 5 ticks to become active.

Great! So beam from350 distance is safe against dashing opponents. The beam hits before their followup attack.

But what about at 280 distance with a dashing opponent? They dash to 80 and attack at T+23. Beam startup ends at T+30. Light at T+23. Beam is in startup. Hit at T+23. Beam cancelled.

So280 is NOT safe against dash. Need 350+.

Actually, let me recalculate 280 distance more carefully.

Starting distance 280. Opponent dashes at T+0 (or early).
Dash: 200 in 10 ticks. Distance 280-200 = 80.
Dash recovery: 8 ticks. Frees at T+18.
Light at T+18. Active at T+23.

Beam fires at T+30. Light hits at T+23 (7 ticks before beam fires). Beam cancelled.

So yes, 280 is not safe against dash. The opponent can interrupt.

What about 300 distance?
Dash: 200 in 10 ticks. Distance 300-200 = 100.
Recovery to T+18. Light at T+18. Active at T+23. Distance 100.
Beam fires at T+30. Light hits at T+23. Beam cancelled.

Same problem. Need 350+.

At 350:
Dash: 200 in 10 ticks. Distance 150.
Recovery to T+18. Light at T+18. Active at T+23. Distance 150-5×4.5 = 127.5 (wait, light doesn't move).

Actually, after dash recovery at T+18, opponent decides `light` if within range. Distance 150. Outside light reach (110). They'd walk forward instead. At T+24 (next decision):150-6×4.5 = 123. Still outside. Walk more. At T+30: 123-27 = 96. In range. Light at T+30. Active at T+35.

Beam fires at T+30. Front at 40. Opponent at 96. Beam front at T+31: 70. Covered. Hit at T+31. Opponent goes down. Their light at T+35 is cancelled.

Wait, but the opponent might decide `light` at T+30 when they see distance ≤ 110. The distance at T+30 is 96 (computed above). But they actually decide at their cadence. Let me trace more carefully.

At T+0: I start beam (decide). Opponent is at 350.
T+0 to T+10: opponent dashes (if they decide to dash). But they're in `dash` state. They can't do anything else.
Actually, the opponent might decide `dash_forward` at T+0 (their decision tick). Then they dash from T+0 to T+10 (moving), T+11 to T+18 (recovery). Freed at T+18.

At T+18: opponent freed. Decides `forward`. Walks to T+24 (6 ticks × 4.5 = 27). Distance 150-27 = 123.
At T+24: decides `forward` again. Walks to T+30 (6 ticks × 4.5 = 27). Distance 123-27 = 96.
At T+30: decides `light` (in range). Light starts at T+30. Active at T+35.

Meanwhile, beam fires at T+30. Front at my_x + 40. Opponent at my_x + 96. InRay: x=96, pad=30, lo=25, hi=40. 96+30=126 >= 25 ✓. 96-30=66 <= 40? 66 > 40 ✗. NOT covered at T+30.

At T+31: front advances to 70. InRay: hi=70. 66 <= 70 ✓. Covered! Hit!

But at T+30, opponent starts `light`. At T+31, opponent is in `light` startup (t=1). The beam hits at T+31. Opponent goes to `down` state. Light is cancelled.

So at 350 distance, the beam hits at T+31, before the opponent's light at T+35. Safe!

But what if the opponent dashes at T+6 (not T+0)?

T+0 to T+6: opponent walks forward 6 ticks × 4.5 = 27. Distance 350-27 = 323.
T+6 to T+16: dash 200. Distance 123.
T+17 to T+24: recovery. Frees at T+25 (actually, dash runs from T+6, 10 ticks moving to T+15, 8 recovery to T+23, freed T+24).

Hmm, let me be more precise. Dash starts at T+6 (decision at T+6). dur = 18 (10 moving + 8 recovery). t goes 0 to 17. Moving at t=0 to t=9 (T+6 to T+15). Recovery at t=10 to t=17 (T+16 to T+23). Freed at t=18 (T+24).

At T+24: distance 123. Decide `forward`. Walk to T+30 (6 ticks × 4.5 = 27). Distance 96.
At T+30: decide `light`. Active at T+35. Beam front at T+30: 40. T+31: 70. Hit at T+31. Light cancelled.

Same result! Beam hits at T+31, light at T+35. Beam wins.

What if opponent dashes at T+12?

T+0 to T+12: walk 12 ticks × 4.5 = 54. Distance 296.
T+12 to T+21: dash 200. Distance 96.
T+22 to T+29: recovery. Frees at T+30.

At T+30: opponent freed. Distance 96. In range. Decide `light`. Active at T+35.
Beam fires at T+30. Front at 40. Opponent at 96. Hit at T+31 (front advances to 70). Light cancelled.

Still works! Beam hits before the light.

What if opponent dashes at T+18?

T+0 to T+18: walk 81. Distance 269.
T+18 to T+27: dash 200. Distance 69.
T+28 to T+35: recovery. Frees at T+36.

Beam fires at T+30. Front at 40. Opponent at 69 (at T+30, they're in dash moving at T+30 =12 ticks after dash start T+18. Dash moving is 10 ticks (T+18 to T+27). At T+30, they're in recovery (t=12 of dash). Distance at T+30: dash moved200 in 10 ticks (T+18 to T+27). Distance 269-200 = 69. At T+30, recovery (no movement). Distance 69.

inRay: x=69, pad=30, lo=25, hi=40. 69+30=99 >= 25 ✓. 69-30=39 <= 40 ✓. Covered at T+30! Hit!

Opponent in dash recovery at T+30. invuln: dash and t < invuln (9). Dash started at T+18. At T+30, t=12 (since start). 12 >= 9. Not invulnerable. Hit!

So the beam hits at T+30 (first tick of firing). Opponent in dash recovery. Hit!

Great, so beam at 350 distance is safe in all these scenarios. Let me use it.

But wait, I need to verify: at 350 distance, if the opponent just walks toward me (no dash):

T+0: distance 350. Opponent walks at 4.5/tick.
T+30: distance 350-135 = 215. Beam fires. Front at 40. Opponent at 215.
T+31: front 70. Opponent 211.5. Not covered.
...
T+36: front 220. Opponent 189. Covered (189-30=159 <= 220, 189+30=219 >= 25). Hit!

So the beam hits at T+36 against a walking opponent at 350 distance. That's 6 ticks after firing starts. Beam fires for 40 ticks. Plenty of time.

But the opponent might guard when they see the beam. Guard beam does 120 chip + blockstun. Still good.

What if the opponent dashes backward? 200 units in 10 ticks + 8 recovery. From 350 to 550. Beam front at T+30 starts at 40. Need to cover 550-40 = 510. At 30/tick, 17 ticks. Hits at T+47. Beam fires for 40 ticks (T+30 to T+69). Yes, hits at T+47.

Hmm wait, the beam front advances until it reaches the stage boundary (960). And then continues? Let me check:

```javascript
for (const b of m.beams) if (b) b.front = clamp(b.front + b.dir * Bm.speed, R.stage.left - 40, R.stage.right + 40);
```

Front is clamped to [stage.left - 40, stage.right + 40] = [0, 1000]. So if I'm at 350 and facing right, front starts at 390. Advances 30/tick. Reaches 1000 at (1000-390)/30 = 20.3 ticks. Clamped at 1000. After that, front doesn't advance. But the beam is still "active" (covers from `from` to `front`).

If opponent is at 550 (dashed back), the beam covers 375 to 390 (at T+30). Front advances:
T+31: 420
T+32: 450
T+33: 480
T+34: 510
T+35: 540
T+36: 570

At T+36, front at 570. Opponent at 550. Covered (550+30=580 >= 375, 550-30=520 <= 570). Hit!

Wait, from = my_x + 25 = 375. front = my_x + 40 = 390 at T+30. Front advances 30/tick:
T+30: 390
T+31: 420
T+32: 450
T+33: 480
T+34: 510
T+35: 540
T+36: 570

inRay: lo=375, hi=570. x=550, pad=30. 550+30=580 >= 375 ✓. 550-30=520 <= 570 ✓. Hit at T+36.

So even if opponent dashes back, the beam catches them at T+36. Beam is very powerful at range!

OK, I'm now convinced that beam at 350+ distance is safe and effective. Let me use it.

But I should also consider: beam costs 50 ki. After using beam, I have 0 ki (if I had exactly 50). That means no dashes for a while. The natural ki regen is 0.04/tick = 2.4 ki/second. So it takes 50/0.04 = 1250 ticks (21 seconds) to regenerate 50 ki naturally. That's too slow.

I should only beam when I have 50+ ki AND I'm confident it'll land. Or when I have extra ki.

With passive regen (0.04/tick) + damage dealt (0.02/HP) + damage taken (0.08/HP), ki builds up over the fight.

If I do a light→heavy combo (136 damage): ki gain = 136 × 0.02 = 2.72 + 136 × 0.08 = 10.88 (from opponent taking damage... wait, the opponent gains ki from taking damage, not me). Let me re-read:

```javascript
o.ki = Math.min(R.kiMax, o.ki + R.kiGain.taken * dmg); a.ki = Math.min(R.kiMax, a.ki + R.kiGain.dealt * dmg);
```

The attacker gains `kiGain.dealt * dmg` = 0.02 per HP dealt.
The defender gains `kiGain.taken * dmg` = 0.08 per HP taken.

So dealing 136 damage: I gain 2.72 ki. Opponent gains 10.88 ki.
Taking 136 damage: I gain 10.88 ki. Opponent gains 2.72 ki.

So the defender gains more ki! This means defensive play generates ki faster. Interesting.

With natural regen (0.04/tick), over 60 seconds (3600 ticks): 144 ki. That's enough for ~2 beams. But in practice, fights last800-1500 ticks, so 32-60 ki from regen alone.

Plus from dealing damage: if I deal 1000 damage, I gain 20 ki. If I take 1000 damage, I gain 80 ki.

So total ki over a fight: ~32-60 (regen) + 20 (dealt) + 80 (taken) = 132-160 ki. Enough for 2-3 beams.

But I also use ki for dashes (10 each). If I dash 5 times: 50 ki. Remaining: 82-110 ki for beams.

OK, ki management is important but not too tight. I can use beam 1-2 times per fight.

Let me adjust: use beam only when:
1. Distance is 300+ (safe from dash + walk)
2. I have 50+ ki (obviously)
3. Maybe only once per fight (use a flag)

Actually, let me just use beam when it's safe (far distance). After beam, continue with melee combo.

But wait, the initial distance is 300. At 300, is beam safe? Let me check with dash:

Dash from 300: 200 units in 10 ticks. Distance 100. Recovery 8 ticks. Freed T+18.
Light at T+18. Active at T+23. Distance 100 (or 100-5×4.5=77.5 if walking during light? No, light is stationary).

Distance at T+23: 100 (opponent didn't move during light startup, since they're in `light` state). Wait, opponent was walking from T+18 to T+23? No, if they decide `light` at T+18, they're in `light` state (startup). Not walking. So distance stays at 100.

Wait, actually after dash recovery, opponent is freed at T+18. They decide what to do. If within range (110), they'd do `light`. Distance 100. Light at T+18. Active at T+23.

Beam fires at T+30. Front at 40. Opponent at 100. inRay: 100+30=130 >= 25 ✓. 100-30=70 <= 40? 70 > 40 ✗. Not covered at T+30.

T+31: front 70. 70 <= 70 ✓. Covered. Hit at T+31.

But opponent's light active at T+23 (t=5 of light). Strike at T+23. Opponent's light hits me at T+23. My beam is in startup (T+0 to T+29). Hit at T+23. Beam cancelled.

So at 300 distance, opponent dashes and attacks at T+23. Beam fires at T+30. Light hits 7 ticks before. Beam cancelled!

At 350 distance: as computed earlier, beam hits at T+31 and opponent's light at T+35. Beam wins.

So the threshold is around 350 distance for safe beam against dash + walk + light.

Actually, let me compute more precisely. The opponent dashes at the earliest possible time (T+0, when I start beam). After dash (10+8=18 ticks), distance = 350-200 = 150. They walk from T+18 to T+30 (12 ticks × 4.5 = 54). Distance 96. They decide `light` at T+24 (their cadence). But they can only decide every 6 ticks. Their next decision after T+18 is T+24 (6 ticks later). At T+24, distance 150-27 = 123. Outside 110. They decide `forward`. Next decision T+30. Distance 123-27 = 96. In range. `light` at T+30. Active T+35.

Beam front at T+30: 40. T+31: 70. inRay at T+31: 96+30=126 >= 25 ✓. 96-30=66 <= 70 ✓. Hit! Opponent goes down. Light cancelled.

So at 350, it works. What about 330?

Dash to 130. Walk12 ticks (T+18 to T+30) = 54. Distance 76.
Decision at T+24: 130-27 = 103. In range. `light` at T+24. Active T+29.
Beam front at T+29: my_x + 40 + 0 (still startup until T+30). Actually, beam fires at T+30. At T+29, beam is still in startup. No beam active.

Opponent's light at T+29 (active). Hits me. Beam cancelled.

So at 330, opponent dashes and attacks at T+24 (before beam fires at T+30). Beam cancelled.

Threshold: I need opponent to not be in light range before T+30 (beam fires). After dash (18 ticks) + walk (12 ticks), distance = start - 200 - 54 = start - 254. Need start - 254 > 110. start > 364.

Hmm, but the opponent's decision cadence (6 ticks) means they might not attack exactly when in range. Let me compute more carefully.

After dash (18 ticks), distance = start - 200. At T+18, opponent freed. Decisions at T+18, T+24, T+30.

T+18: distance start-200. If < 110, they decide `light`.
T+24: distance start-200-27 = start-227. If < 110, they decide `light`.
T+30: distance start-200-54 = start-254. If < 110, they decide `light`.

For beam to fire at T+30 before opponent's light (5 tick startup = active at T+35 from T+30 decision):
- If opponent decides `light` at T+24 (distance < 110): active at T+29. Hits me at T+29. Beam cancelled. Need distance at T+24 > 110. start-227 > 110. start > 337.
- If opponent decides `light` at T+30 (distance < 110): active at T+35. Beam front reaches at T+31. Safe if beam covers opponent at T+31. Need distance at T+31 <= 70 (front at70, body 30, so center at 70+30=100). Hmm, inRay: x+30 >= 25 and x-30 <= 70. x-30 <= 70 means x <= 100. So opponent at distance <= 100 from me is covered at T+31 (front at 70).

Wait, I'm confusing absolute positions with relative. Let me use relative to me.

My position: 0. Beam from: 25. Front at T+30: 40. Front at T+31: 70.

Opponent at distance D (in front of me). inRay: D + 30 >= 25 (always true if D > -5). D - 30 <= front.

At T+30 (front=40): D - 30 <= 40 → D <= 70. Not covered if D > 70.
At T+31 (front=70): D - 30 <= 70 → D <= 100. Covered if D <= 100.

Opponent at T+30: D = start - 254.
At T+31: D = start - 254 - 4.5 = start - 258.5.

Need D(T+31) <= 100 for beam to hit. start - 258.5 <= 100. start <= 358.5.

Wait, that's the opposite. If start is too large, the opponent is too far and the beam doesn't reach!

Hmm, let me reconsider. If start = 350, D(T+30) = 350-254 = 96. D(T+31) = 91.5. Beam covers up to 100 at T+31. 91.5 <= 100. Covered!

If start = 400, D(T+30) = 146. D(T+31) = 141.5. Beam covers up to 100 at T+31. 141.5 > 100. Not covered at T+31.

At T+32 (front=100): D = 137. Covered (137-30=107 <= 100? No, 107 > 100. Not covered).

Hmm, the beam front advances at 30/tick and opponent walks at 4.5/tick. The beam is faster. But the opponent is already far. Let me compute when the beam catches up.

Beam front at T+30+n: 40 + 30n. Opponent at start-254-4.5n.
Covered when 40+30n >= start-254-4.5n+30 (D-30 <= front).
40+30n >= start-224-4.5n.
34.5n >= start-264.
n >= (start-264)/34.5.

For start=400: n >= 136/34.5 = 3.94. So n=4. Hit at T+34. Front at 160. D at T+34: 400-254-18 = 128. 128-30=98 <= 160. Covered!

So at 400, the beam hits at T+34. Opponent's light (if they decided at T+30): active at T+35. Beam hits 1 tick before. Safe!

But if opponent decided `light` at T+24 (distance at T+24: 400-227 = 173. Outside 110. They decide `forward` instead). At T+30 (distance 146, still outside 110. `forward`). At T+36 (distance 400-254-27 = 119. Outside 110. `forward`). At T+42 (distance 400-254-54 = 92. In range. `light`). Active at T+47. Beam front at T+47: 40+17×30 = 550. D at T+47: 400-254-4.5×17 = 400-254-76.5 = 69.5. Covered. Hit at... well, the beam would have hit earlier.

Actually, the beam hits as soon as it covers the opponent. At T+34 (computed above), beam covers opponent. Hit at T+34. Opponent goes down. Later attacks cancelled.

So at 400 distance, the beam always hits eventually. Even if the opponent dashes and walks, the beam catches up.

Wait, but what about the opponent interrupting during beam startup (T+0 to T+29)? If they can hit me during startup, the beam is cancelled.

At 400 distance, after dash (18 ticks):200 distance. Walk 12 ticks (T+18 to T+30): 146 distance. They can't reach me in light range (110) before T+30. So they can't interrupt during beam startup.

At T+30, beam fires. They're at 146. Beam starts advancing. They continue walking. At T+36, distance 119. At T+42, 92. In range. But beam hits at T+34 (distance 128, beam front at 160, covered). Before they can attack.

So 400 distance is safe. What about 350?

At 350: dash to 150 (T+18). Walk 12 ticks to T+30: 96. In range. Light at T+30. Active T+35. Beam fires T+30. Front at 40. Opponent at 96. Covered at T+31 (front=70, 96-30=66 <= 70). Hit at T+31. Light at T+35 cancelled.

But at T+30, opponent decides `light` (distance 96 <= 110). Light starts. At T+31, beam hits. Opponent goes down. Light cancelled.

So 350 is safe. What about 340?

Dash to 140 (T+18). Walk 6 ticks to T+24: 113. Outside 110. Walk 6 more to T+30: 86. In range. Light at T+30. Same as 350 case. Beam hits T+31. Safe.

What about 337?

Dash to 137 (T+18). Walk 6 to T+24: 110. At exactly 110. In range! Light at T+24. Active T+29. Beam fires T+30. But light active at T+29 (1 tick before beam). Light hits me at T+29. Beam cancelled.

Hmm, at 337, opponent is in light range at T+24 and attacks. Beam cancelled.

So threshold is about 338 (just above where opponent reaches110 at T+24).

Actually, let me compute more carefully. Opponent dashes at T+0. At T+18, distance = start - 200.

Decisions at T+18, T+24, T+30.

T+18: distance = start - 200. If <= 110: `light`. start <= 310. Light active at T+23.
T+24: distance = start - 200 - 27 = start - 227. If <= 110: `light`. start <= 337. Light active at T+29.

For beam safety: need no light active before T+30 (beam fires). Light at T+18 is active at T+23. Light at T+24 is active at T+29. Both before T+30.

So if opponent decides `light` at T+24 or earlier, beam is cancelled. Need start > 337.

At start = 338: T+24 distance = 111. Outside 110. `forward`. T+30 distance = 84. `light`. Active T+35. Beam front at T+31 covers. Hit!

But wait, what if opponent doesn't dash at T+0 but at T+6?

T+0 to T+6: walk 27. Distance start-27.
T+6 to T+16: dash 200. Distance start-227.
T+17 to T+24: recovery. Frees at T+25.

Decisions at T+25, T+31.

T+25: distance start-227-0 (no walk during recovery... wait, recovery is dash recovery. They can't walk). Actually, during dash recovery, the fighter is in `dash` state (recovery phase). They can't do anything. Freed at T+25 (or wherever the recovery ends).

Hmm, let me be precise. Dash starts at T+6. dur = 18. t goes 0 to 17.
Moving: t=0 to t=9 (T+6 to T+15). Distance start-27-200 = start-227 at T+15.
Recovery: t=10 to t=17 (T+16 to T+23). Freed at t=18 (T+24).

At T+24: distance start-227. If <= 110: `light`. start <= 337. Active T+29.

Same threshold. start > 337 for safety.

What if opponent dashes at T+12?

T+0 to T+12: walk 54. Distance start-54.
T+12 to T+21: dash 200. Distance start-254.
T+22 to T+29: recovery. Frees at T+30.

At T+30: distance start-254. If <= 110: `light`. start <= 364. Active T+35.

Beam fires at T+30. Front at 40. If distance <= 70 (D-30 <= 40): covered at T+30. Hit.
At T+31: front at 70. If distance <= 100 (D-30 <= 70): covered at T+31. Hit.

Distance at T+30: start-254. Need start-254 <= 100 for beam hit at T+31. start <= 354.

If start = 340: D(T+30) = 86. Covered at T+31 (86-30=56 <= 70). Hit.
If start = 360: D(T+30) = 106. Not covered at T+30 (106-30=76 > 40). At T+31: 101.5-30=71.5 > 70. Not covered! At T+32: 97-30=67 <= 100. Covered! Hit at T+32.

Wait, front at T+32: 40+60 = 100. D at T+32: 106-9 = 97. 97-30=67 <= 100. Covered! Hit!

But at T+35, opponent's light (decided at T+30) is active. Beam hit at T+32. Opponent goes down. Light cancelled.

So even at 360, the beam hits before the light is active (T+32 vs T+35).

What about 380?

D(T+30) = 126. Beam front at T+30: 40. T+31: 70. T+32: 100. T+33: 130.
D at T+33: 126-13.5 = 112.5. 112.5-30=82.5 <= 130. Covered! Hit at T+33.

Opponent's light at T+35. Beam hits at T+33. Safe!

What about 400?

D(T+30) = 146. T+30 to T+34: front 40→160. D 146→128.
D at T+34: 128-30=98 <= 160. Hit!

Opponent's light at T+35. Safe!

So actually, even at 400+ distance, the beam catches the opponent before their light is active. The beam front advances at 30/tick vs opponent walking at 4.5/tick. The beam is 6.67× faster.

The key constraint is: opponent must not attack BEFORE T+30 (beam fires). After T+30, the beam front advances and hits them quickly.

So the threshold is: opponent must not be in light range before T+30.

If opponent dashes at T+0: 18 ticks to recover. 12 ticks of walking (T+18 to T+30). Total closed: 200 + 54 = 254. Need start - 254 > 110. start > 364.

But there's also the case where opponent dashes at T+12:
Dash12 ticks to recover (T+12 to T+24). Wait, dash10 ticks moving + 8 recovery = 18. T+12 to T+29 (recovery at T+22 to T+29). Freed T+30.

At T+30, they're freed. Distance start-254. They decide `light` immediately (if in range). But the beam fires at T+30 (same tick). In the step order: both decide first, then strikes, then beams.

At T+30: opponent decides `light`. State becomes `light`, t=0, dur=17. Then strikes() runs. Light t=0, startup. Not active. Then beams() runs. My beam is created (T+30 = startup end). Front at 40. Check opponent.

If D <= 100 (at T+31 with body): hmm, at T+30, the beam is just created. Front at 40. Check inRay at T+30.

Actually, beams() does:
1. Create beams at t === startup
2. Advance front
3. Check hits

Wait, looking at the code:
```javascript
for (const a of m.f) {
    if (a.state === 'beam' && a.t === Bm.startup) { m.beams[a.side] = { ... }; }
    if (m.beams[a.side] && (a.state !== 'beam' || a.t >= Bm.startup + Bm.fire)) m.beams[a.side] = null;
}
for (const b of m.beams) if (b) b.front = clamp(b.front + b.dir * Bm.speed, ...);
// check hits
```

At T+30: my state is 'beam', t=30 (startup ends). Beam is created. Front is initialized at `a.x + a.facing * 40`. Then front is advanced by `Bm.speed` (30). So front becomes `a.x + a.facing * 40 + a.facing * 30 = a.x + a.facing * 70`.

Wait, the initialization is:
```javascript
m.beams[a.side] = { owner: a.side, dir: a.facing, from: a.x + a.facing * 25, front: a.x + a.facing * 40, hit: false };
```

Then:
```javascript
for (const b of m.beams) if (b) b.front = clamp(b.front + b.dir * Bm.speed, ...);
```

So front starts at a.x + 40 and is immediately advanced to a.x + 70. So at T+30, the front is at a.x + 70 (from the shooter's perspective). But wait, `from` is a.x + 25.

inRay: lo=25, hi=70 (relative to shooter). Opponent at D. D + 30 >= 25 (always). D - 30 <= 70 → D <= 100.

So if opponent is at D <= 100 at T+30, the beam hits immediately!

For the case where opponent dashes at T+12: D(T+30) = start-254. If start <= 354, D <= 100. Hit at T+30.

If start > 354: not covered at T+30. But at T+31, front advances to 100. D(T+31) = start-258.5. Covered if D <= 130. start <= 388.5.

At T+32: front 130. D = start-263. Covered if D <= 160. start <= 423.

And the opponent's light (decided at T+30) becomes active at T+35. Beam hits at T+31, T+32, or T+33 depending on distance. Before T+35.

So even at 420 distance, the beam hits before the opponent's light. The beam is very powerful!

The only case where beam is not safe: opponent can hit me before T+30 (beam startup). This requires opponent to be in light/heavy range before T+30.

For dash at T+0: reaches light range (110) at... distance254 after 18 ticks (dash). Need to walk (254-110)/4.5 = 32 more ticks. Total: 18+32 = 50 ticks. But beam fires at30. So at T+30, opponent is at 254-12×4.5 = 200 (after walking 12 ticks). Not in range.

Wait, that doesn't match my earlier calculation. Let me redo.

Starting distance S. I start beam at T+0. Opponent dashes at T+0.

T+0 to T+9: dash moving. Distance S-200 (at T+9). Wait, dash moves 200 over 10 ticks. So at T+9 (9 ticks in), distance = S - 200×9/10 = S - 180. At T+10 (10 ticks, end of moving): S-200.

T+10 to T+17: recovery (8 ticks). Distance stays at S-200 (no movement).

T+18: freed. Distance S-200.

Walk forward (4.5/tick):
T+18: S-200
T+19: S-204.5
...
T+30: S-200-54 = S-254

For opponent to be in light range (110) at T+30: S-254 <= 110. S <= 364.

If S <= 364: opponent is in light range at T+30. They decide `light` at T+30 (if their cadence aligns). Light active at T+35.

But beam front at T+30 is at relative70 (from+front advanced). inRay: D-30 <= 70 → D <= 100. If D = S-254 <= 100 → S <= 354. Hit at T+30!

If 354 < S <= 364: D between100 and 110. Not covered at T+30. At T+31: front at 100. D-30 <= 100 → D <= 130. D at T+31 = S-258.5 <= 130 → S <= 388.5. Covered at T+31! But opponent's light at T+35. Hit at T+31. Safe!

So even at S=364, beam hits at T+31 before opponent's light at T+35.

For the opponent's light to hit me before T+31 (when beam hits them):
- Light starts at T+30 (decided at T+30). Active at T+35. Not before T+31.
- Light starts earlier: at T+24 (decided at T+24). Active at T+29. Hits me at T+29. Before beam hit at T+31!

At T+24: D = S-227. In range if S-227 <= 110. S <= 337.

So if S <= 337 and opponent dashes at T+0, they can attack at T+24 (before beam fires at T+30). Beam cancelled.

If S > 337: opponent not in range at T+24. Walks more. In range at T+30. Attacks at T+30. Beam fires at T+30. Beam hits at T+30 or T+31. Before their light at T+35.

But what if opponent dashes at T+6 (6 ticks later)?

T+0 to T+5: walk 22.5. D = S-22.5.
T+6 to T+15: dash 200. D = S-222.5.
T+16 to T+23: recovery. Frees at T+24. D = S-222.5.

Decisions at T+24, T+30.
T+24: D = S-222.5. In range if S <= 332.5. Light active T+29.
T+30: D = S-249.5. In range if S <= 359.5.

If S <= 332.5: light at T+24, active T+29. Hits me at T+29. Beam cancelled.
If 332.5 < S <= 359.5: light at T+30, active T+35. Beam hits at T+30 or T+31. Safe.
If S > 359.5: not in range at T+30. Walks more. Eventually in range. Beam catches them.

So threshold: S > 332.5 for beam safety (opponent dashes at T+6).

What about opponent dashes at T+12?

T+0 to T+11: walk 49.5. D = S-49.5.
T+12 to T+21: dash 200. D = S-249.5.
T+22 to T+29: recovery. Frees at T+30. D = S-249.5.

T+30: freed. D = S-249.5. In range if S <= 359.5. Light active T+35.

If S <= 359.5: light at T+30. Beam fires at T+30. Beam front at T+30: relative 70. D-30 <= 70 → D <= 100 → S <= 349.5. Hit at T+30.

If 349.5 < S <= 359.5: beam at T+31 (front 100). D at T+31: S-254. S-254-30 <= 100 → S <= 384. Hit at T+31. Light at T+35. Safe!

If S > 359.5: not in range at T+30. Walks. Eventually in range. Beam catches them.

So threshold: S > 349.5 for beam safety (opponent dashes at T+12, with beam hitting at T+30).

Wait, but I computed earlier that for opponent dashes at T+0, the threshold is S > 337 (to prevent light at T+24). And for opponent dashes at T+6, S > 332.5. And for T+12, S > 349.5.

The lowest threshold is 332.5 (opponent dashes at T+6). So beam is safe for S > 333 approximately.

But what if the opponent does something smarter, like dash_forward to just outside light range, then walk in and attack?

Dash_forward goes 200 in 10 ticks. If I'm at 350 and they dash at T+0: distance 150 at T+10. Recovery to T+18. Walk 6 ticks to T+24: 123. Walk 6 more to T+30: 96. Light at T+30. Active T+35. Beam hits at T+31.

Same as before. Safe.

What if they dash at T-3 (3 ticks before I start beam)?

Wait, I start beam at T+0 (my decision tick). They might have decided to dash at T-3 (their cadence). By T+0, they're 3 ticks into their dash. At T+7 (end of moving, 10 ticks after T-3): distance S - 30 (walk 3 ticks) - 200 = S - 230. Recovery to T+15. Freed at T+16.

T+16: D = S-230. Walk 6 to T+22: S-257. Walk 6 to T+28: S-284. Walk 2 to T+30: S-293.

If S = 350: D(T+30) = 57. In range. Light at T+28 (decided at T+22). Active T+27 (wait, T+22+5=T+27). Hmm, at T+22, D = S-257 = 93. In range! Light at T+22. Active T+27. Hits me at T+27. Beam is in startup (T+0 to T+29). Hit at T+27. Beam cancelled!

So if opponent dashes at T-3 (or even just starts their dash before my beam), they can interrupt!

This is because the dash gives them 200 units of movement plus 18 ticks of action. If they time it right, they can be in range before my beam fires.

The issue is: I don't know when the opponent will dash. If they dash in the first few ticks of my beam startup, they can close distance and attack before T+30.

So beam is only safe if the opponent is far enough that even with a pre-timed dash, they can't reach me before T+30.

For the earliest dash (T-3 or earlier):
D at T+0 (my beam start): S-30 (3 ticks of walk at4.5/tick = 13.5 actually... wait, if they dash at T-3, they're3 ticks into the dash at T+0. Dash moves 200 over 10 ticks = 20/tick. So 3 ticks of dash = 60 units. Plus 0 walking (they were in dash state).

D at T+0: S - 60.
Dash moving: T-3 to T+6 (10 ticks). D at T+6: S -