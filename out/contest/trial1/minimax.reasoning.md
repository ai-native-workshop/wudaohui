Let me write a solid fighting bot.

Key mechanics to exploit:
- Light punch chain: light hits -> next tick extra decision with canCancel. Chain up to 4 lights. Combo damage scaling on opponent: 1, 0.8, 0.65, 0.55.
- Counter multiplier 1.25 when opponent is in startup/recovery of a move.
- Charge hit 1.5 when opponent charging.
- Guard blocks front light/blast/beam. Heavy breaks guard.
- Blast: 20 ki, damage 70, speed 13.
- Beam: 50 ki, 280 damage, but 30 startup, and 40 firing.
- Clash: pushing.

Strategy: A strong simple AI:
- If opponent is in startup/recovery of a move and we can hit: hit with light/heavy for counter bonus.
- If opponent is charging: hit them for 1.5x.
- Manage ki: charge when low, use beam when we have lots of ki and opponent is far/approaching.
- Use dash to escape beams / reposition.
- Guard when opponent attacks.

Let me think about the state machine design.

States I can be in (free ones): idle, forward, back, guard, charge.

Decision function:

```
function decide(state) {
  const me = state.me, opp = state.opp;
  // clash handling
  if (state.clash) { ... }
```

Wait — in clash state, we are asked every 6 ticks; return 'push' sometimes. Power = base + 0.02*ki + push 0.6 + rage. Pushing costs 0.6 ki/tick extra. Base power at ki=30 is 1.6. At ki=0, 0.5. Pushing gives +0.6 but drains extra. Actually ki drains 0.2/tick normally, 0.8 with push. Clash max 360 ticks, so ki runs out. Hmm, with ki start say 60, drain 0.2/tick -> 300 ticks of ki. With push 0.8/tick -> 75 ticks.

So in clash: push only if myPower + 0.6 > oppPower by a good margin, and I have enough ki to sustain. Since pushing drains faster, the effective comparison: my ki drains faster so my power declines faster. Let's compute: my ki k, power = 1 + 0.02k + 0.6 (if push) = 1.6+0.02k; opp power = 1+0.02*ko (assuming opp not pushing). With push my ki drains at 0.8/tick so power drops 0.016/tick; opp drops 0.004/tick. Difference in power declines at 0.012/tick. Initially with ki 50 vs 50: mine 2.6, opp 2.0, diff 0.6 → need 50 ticks to equalize. Plus random shove noise sd 0.8 per tick in position velocity, but position velocity has decay 0.95, so noise accumulates with sd ~0.8/sqrt(1-0.95^2)= 0.8/0.3122 ≈ 2.56 in position. The drift term: velocity gains d*(pa-pb)*0.1. Position moves.

Hmm, clash pos 0..1 between bodies. Actually the clash position c is in absolute x. The drift pushes toward weaker side. Random noise sd 0.8 in velocity per tick → steady-state position sd ~2.56 units of x. That's small relative to distance ~ hundreds. So power difference matters a lot.

Rule: push if myPower + 0.6 > oppPower + margin, and my ki > some threshold (e.g., > 15) so I don't run out. Actually power with 0 ki = 0.5 which is a big penalty. If I push and run out of ki, my power drops to 0.5 (from 1.6), disaster. So push only if ki > 20ish.

Actually careful: pushPower adds +0.6 only when ki>0 (the whole term base+kiPower*ki+push is replaced by empty if ki==0). So push when ki > 0.

Decision in clash: if myPower + 0.6 + 0.3 > oppPower and me.ki > 15 → push; else don't. Also if I'm ahead already maybe don't push to conserve ki? The clash is symmetric-ish; drifting to weaker side. If myPower > oppPower, opponent drifts toward me, meaning I win... wait: "撞击点推到谁的身上，谁就吃下两道光束" - the point reaching someone means that someone loses. Drift toward weaker side → weaker side loses. So higher power wins. Pushing raises my power by 0.6 but costs ki.

Let me just: push if (me.ki > 20 && state.clash.myPower + 0.55 > state.clash.oppPower). Otherwise no push (return 'guard' or 'idle' — must not be 'push'). Return 'idle' in clash is fine (choose: if state==='clash', push = act==='push').

Hmm but note: in clash, `a.nextAsk = m.tick+1` initially but wants() checks m.tick >= a.nextAsk for clash state → every 6 ticks anyway since choose sets nextAsk = tick + every. Actually wants: (FREE.has(a.state) || a.state === 'clash') && m.tick >= a.nextAsk. After choose sets nextAsk = tick+6. So every 6 ticks. Good.

Also note: during clash, ki drains 0.2/tick, so between decisions (6 ticks) 1.2 ki lost.

Now the main fight logic.

Key: Since we get called every 6 ticks, and canCancel call happens next tick after a light lands.

Combo plan: when in range and opponent not blocking, throw light. If it lands, next tick we get canCancel=true. Then decide: chain light again (if chain < 4) or heavy. But the opponent may guard. If opp is in 'guard' state and facing us, our light will be blocked. We could heavy to break guard, but heavy has 9 startup + 4 active and if opponent blocks → crush (60 dmg + 34 stun). Hmm heavy against guard: crush damage 60 and stun 34, they can't do anything. That's decent, but heavy takes long.

Better plan: chain lights while they can't block (they're in hitstun), then heavy/blast/beam at the end.

Important: When we land a light, the opponent enters hitstun 15 ticks (if it was their first hit in the string; subsequent hits in same stun window: damage scaling applies and hitstun refreshed? Let's check: land() for light: stun(o,'hitstun', M.hitstun) → resets hitstun to 15 ticks each time. And o.combo++ so scaling applies. So a chain of lights: hit 1 = 40 dmg (×1 if combo 0), stun 15; next tick cancel → light again, startup 5 → hits at tick+5, within the 15 tick stun → combo 2: 40*0.8 = 32. Then chain again: combo 3: 40*0.65=26, combo 4: 40*0.55=22. Total in 4 lights: 40+32+26+22 = 120 damage. Plus pushing them away 14 each hit which increases distance → after 2 hits distance ~ +28, still within 110 reach if we started close.

Hmm, but a light that hits pushes the opponent 14 units away. Starting distance say 90, after 3 hits distance = 90+42=132 > reach 110. So the chain breaks. We need to start close (60-70) so 3-4 hits land. With push, distance grows. Options: dash_forward to get close (costs 10 ki), or approach.

Alternatively, after landing the first light, cancel into heavy (reach 140) which does 120 damage + knockback + down 42. That's big: 120 damage + 42 ticks down = free hits.

Actually the classic combo: light (40) → cancel heavy (120 ×1.25 counter? no, counter is only if target is in startup/recovery of a move, hitstun isn't) → 40 + 120 = 160 and knockback 150 sends them far, they get downed 42 ticks. During down they're invulnerable though ("被击倒的人躺在地上，这段时间打不着他"). Down 42 ticks then stand.

Alternatively light → light → light → then heavy? Each light pushes away 14, and heavy reach 140.

Let me think about overall best strategy in terms of raw win rate.

Key damage sources:
- Beam: 280 damage, requires 50 ki, 30 tick startup (interruptible), then fires 40 ticks. Beam vs beam → clash. If opponent doesn't have beam (likely), beam does 280 + chip if blocked 120. Cost 50 ki.
- Heavy: 120 damage, knockdown 42.
- Blast: 70 damage, projectile, chip 12 if blocked.
- Light: 40.

Time is 60s. Ki regen: passive 0.04/tick = 2.4/s, charging +0.32/tick = 19.2/s. So full 100 ki takes ~4-5 s of charging.

Being hit gives 0.08 ki per hp. So dealing 100 damage gives 2 ki. Taking 100 damage gives 8 ki.

Strategy outline:
1. Keep distance and manage spacing. Use dash_forward to close when opponent is far, dash_back to escape.
2. Throw heavy when opponent is charging (1.5× = 180 dmg) or in startup/recovery (1.25×).
3. Beam when ki >= 50 and opponent not close & no beam clash risk... Actually beam at long range is great: it fires 40 ticks, front travels 30/tick so 1200 units — covers whole stage. Damage 280 if they don't dodge/block. If blocked, chip 120 but they stay stunned until beam ends (stun ctx.stun = startup+fire - t + 6 ≈ 46 ticks) — that's great! Blocked beam: 120 chip damage and they're in blockstun for the whole time (long stun). Actually blockstun duration = Bm.startup + Bm.fire - a.t + 6 where a.t is shooter's t. When firing just started a.t ≈ startup=30, so stun = 30+40-30+6 = 46 ticks. Then it re-stuns each tick? No: stun() only applies once per hit; the beam hits once (b.hit = true). So blockstun 46 ticks after being blocked. Good — but wait if they're in blockstun they're not 'guard' anymore, so subsequent... the beam only hits once anyway.

Hmm, but a blocked beam costs us 50 ki and gives 120 damage + 46 ticks stun → then we can walk up and combo. That's decent but beam unblocked gives 280 + knockdown 50.

Risk of beam: 30 tick startup during which we can be hit and interrupted (beam breaks). Also if opponent also has beam → clash, and clash resolution is a coin flip-ish but power-based.

Timing: this is a bot competition against 3 other AI-written programs written by other LLMs presumably. I want a robust, decent bot.

Let me design a scoring approach: each decision, evaluate candidate actions with heuristics.

Given call frequency (every 6 ticks), simple approach:

State analysis:
- oppState = opp.state, oppFree = opp.free.
- dist.

Decision tree:

A) If opp is in hitstun/down/crushed/blockstun (not free): they're helpless → we can hit. If we're in range, hit with best move. If not in range, approach (forward or dash_forward).
   - But careful: hitting resets their stun to a shorter duration? For light: hitstun 15 again. For heavy: down 42 + knockback 150 → they fly far away. Hmm heavy knocks them back 150 which pushes us out of range for future. But we gain 120 damage.
   - For blast: hitstun 20, no knockback. Damage 70. Requires 20 ki.
   - Beam: 280 damage + down 50 + knockback 120. Requires 50 ki and 30 startup.

B) If opp is free:
   - If opp is charging → heavy or light to punish (1.5×). Heavy does 180, light 60. Also blast 105.
   - If opp is in startup/recovery of a move (they're committed) → counter: heavy 150, light 50. But they might be in 'light' startup etc. But note if opp is in a move's recovery they're free=false and phase='recovery' → counter mult 1.25.
   - If opp is guarding → heavy to crush (60 dmg + 34 stun), or blast (12 chip + 14 blockstun), or wait.
   - Else (idle/forward/back/guard) → approach and set up.

C) If there's an incoming blast → dash_back (or dash_forward? no, dash_back) to dodge, or guard. Blasts are slow (13/tick). eta given. If eta < ~15, dash_back to move 200 away. Cost 10 ki. Alternatively guard: blast chip 12 dmg + 14 blockstun and we keep position; that's cheap actually. Hmm blocking a blast: 12 chip damage, 14 stun, and we regain 2 ki. That's cheap-ish but loses positioning. If eta is small, guarding might be ok, but the blast also applies hitstun 20 if not blocked... If not blocked: 70 damage + 20 hitstun. So guarding is better than eating it. But we can't guard while doing something else.

Actually better: dash_back to dodge entirely (invuln 9 ticks, and blast passes through). Requires 10 ki and 8 recovery ticks.

D) If opponent has a beam in firing phase (state.beams has opp beam) → dash_back to escape the ray, or dash through? The beam covers from front; dashing back 200 may not escape if the beam front is already near/past us. Beam front moves 30/tick, firing 40 ticks. If we're in the ray and it's not yet hit... Beam hits when body covered. Hmm, `b.hit` set true when it hits; so once hit it doesn't hit again. So if the beam already hit us, we're in hitstun anyway. If we're in the ray but beam hasn't hit us (e.g., we just walked in), we should dash. Note: beam hits the body once. If the opponent's beam hasn't reached us and it's firing, the front is advancing 30/tick; if front > our position, we get hit. Actually inRay checks b.from..b.front covers o.x with pad 30. If front > our x, we're in the ray and hit.

E) Also incoming blast during our own beam startup: can we dodge? No, we're committed.

F) Clash handling as described.

Now positioning: We want to stay in the sweet spot: light reach 110, heavy 140. If opp is attacking with a slow move, we want to be in range at the right time.

Also important: don't be in range of the opponent's heavy when they're ready to swing. Hmm, we can't know their intent.

Simplification: A "zoning" approach with mixed aggression.

Let me think about what wins most games. Since we're facing unknown AI bots, I want:
- Don't get KO'd. Being hit by heavy (120) + beam (280) is lethal. Guarding blocks light/blast/beam from front. Guard doesn't block heavy but reduces damage to 60 (crush) and stuns them 34 ticks — actually crush is decent for us: they do 60 damage to us but we get 34 ticks free. Hmm, but if their heavy crushes our guard we take 60 and they get stunned 34.

Wait — heavy hitting a guard: crush damage 60 to the guard holder, stun 34. So they wasted their heavy and took 60 damage and are stunned 34 ticks! That's a great trade for us (we take 60, they get 34 stun and lose 120-potential damage). So guarding against heavy isn't catastrophic.

So default: guard when opponent is close and threatening, then punish after their recovery.

Let me design a concrete behavior tree with priority:

```
function decide(s) {
  const me = s.me, op = s.opp;
  if (s.clash) return clashDecision(s);
  if (!me.free) return 'idle'; // shouldn't happen; we only get asked when free... actually canCancel case: me.state is 'light' with free false? Let's check: wants() returns true if a.cancel. During cancel, a.state is still 'light' (recovery). So me.free is false and me.state==='light'. So handle: if me.canCancel → combo decision.
```

Careful: the cancel decision happens while me.state === 'light' (recovery phase) presumably, since after landing the light it goes to recovery. Actually the light hits during active phase (t in [5,8)). The hit sets a.cancel = true. Then during the same tick, a.t increments; next tick step() wants() → a.cancel is true → asked. At that point a.state='light', a.t maybe 6ish. So we return light/heavy/blast/beam → start(m,a,act,true) which sets state to the new move. If we return something else, choose() just clears cancel and returns, keeping the light's recovery.

Note that in cancel, we can also start a move even if ki insufficient? start() checks ki and returns without doing anything (invalid count). Fine.

So combo decision when me.canCancel:
- Options: light (chain < 4), heavy, blast, beam.
- Which is best? Depends on distance and opponent state and ki.
- Opponent is in hitstun 15 ticks from our light. If we cancel into light: startup 5 ticks, hits at t+5 → within 15 → combo scaling 0.8. If we cancel into heavy: startup 9, active 4 → hits at t+9..12, still within 15 hitstun? hitstun 15 ticks from the hit; the light hit happened maybe 1 tick ago, so we have ~14 ticks of stun left; heavy hits at +9 → still in stun, combo 2 → damage 120*0.8 = 96. Then knockback 150 + down 42. That's better value than a 3rd light (26 damage).
- Blast: startup 11, damage 70 * 0.8 = 56, hitstun 20. Requires 20 ki. Distance: blast travels, so it hits at any range, but the opponent might block it (they're in hitstun, so they can't block immediately... they can after recovering). Blast from cancel: hits at +11 + travel. During hitstun 15, blast hits if travel time < remaining stun. If we cancel into blast right after light, blast startup 11 → spawned at +11, opponent stun expires at ~+14 (they had 15 from the light hit ~1 tick before). So blast hits at +11 and opponent is in hitstun → they can't guard → 70 damage, and continues to hitstun 20. But wait, do they become free at +14? The blast lands at +11 while they're still stunned (14 left) → combo 2 → 70*0.8=56, and they get hitstun 20 more. But if they become free at +14 before blast lands... the blast needs to travel. If distance is 90, blast spawns at me.x+40, travels 13/tick → 50 units to reach them → 4 ticks → hits at +15. Just misses. Risky.

So: chain light for damage scaling, but the push distance is the issue.

Let me compute a full 4-light chain damage: 40 + 32 + 26 + 22 = 120. With heavy as 4th: 40+32+26 then heavy: 120*0.55 = 66 + knockdown.

Hmm, but the opponent is pushed 14 per light hit, so distance grows by 14 each time. Start distance ~65: after 1st hit dist 79, after 2nd 93, after 3rd 107 (reach 110, ok barely), after 4th would be 121 > 110 → miss.

Also opponent can be pushed to wall: pushApart: if opponent hits wall, attacker slides back instead. So if we push them into the wall, we stay close! Nice: if opponent is near the wall, pushing them doesn't increase distance (we move back instead). Actually pushApart: d = direction from a to o; room = space behind o; s = min(dist, room); o.x += d*s; if s<dist, a.x -= d*(dist-s) → attacker moves back. So total separation preserved. Good.

So in the corner, chains work great.

Alternatively heavy first: 120 damage + knockdown 42 + knockback 150. They fly 150 away (or until wall? kb moves at 12/tick until left exhausted; knock(m,o,a,M.down,M.knockback) sets kb left=150, moves up to 12/tick → 12.5 ticks, so ~150 units). Then during their 42-tick down we approach (we walk 4.5/tick = 270 units in 60 ticks, dash 200 in 10). Then we can hit a fresh combo on a downed... no, they're invulnerable while down. After standing, they're free and can guard.

I think a reasonable core loop:
- Maintain "in range" pressure: walk forward until dist <= ~100.
- When in range and opponent not blocking: throw light. On cancel: chain light if it hit and range allows; or heavy if we want to end with knockdown.
- Punish: if opponent is in startup/recovery or charging → heavy (or blast).
- If opponent guards: heavy to crush them (60 dmg, 34 stun, they lose 120 potential) — actually that's a decent trade. Or blast chip 12. Or dash around them (dash_forward passes through to behind → their guard doesn't cover the back! Then light from behind isn't blocked). That's a strong tactic: dash_forward through the opponent (200 units) → land behind → they're now facing... "落地后到收招结束前你还面朝原来的方向；对手空闲的话会立刻转身" — opponent free turns to face us immediately. Hmm, "对手空闲的话会立刻转身" means the opponent turns to face us. So being behind doesn't work if they can turn. But turning takes effect at the next tick? face() is called for free fighters each tick. So by the time we act they face us. So dash-through doesn't bypass guard. Unless they're in a move (not free) — then they don't turn. Dash through an opponent who is mid-move → their guard... they can't guard while in a move anyway.

Hmm OK. So guard is only up when free and facing us.

Key insight: guard blocks light/blast/beam from the front. So to beat a guarding opponent: heavy (crush, 60 dmg + 34 stun) or dash-back-and-charge.

Also: guard is a held state, and while guarding you can't move. Guard's chip: beam blocked = 120 chip damage (ouch). So a long beam is dangerous to guard against. But blockstun "一直硬直到大招结束" — the rule text says blocked beam stuns until the beam ends. Code: stun(o,'blockstun', ctx.stun) where ctx.stun = startup+fire - a.t + 6 ≈ 46. And also each tick the beam... no, only hits once.

OK. Let's also consider: after our light lands and we cancel into heavy, the opponent is knocked down 42 ticks and knocked back 150. We get 40 + 96 = 136 damage in a short window and they lose ~42+ ticks of agency. That's a solid combo. And their counter-play: they can be hit during our startup (counter 1.25 for us) or... whatever.

Alternatively, cancel into beam: 280 damage, knockdown 50. That's huge if ki allows (50 ki). Startup 30 during which they may recover from hitstun (14 ticks) and then have ~16 ticks to interrupt us. If they're not doing anything, they'll likely guard → beam blocked → 120 chip + long stun, and we get nothing else. Hmm, guarding gives chip 120 and stun for them. So blocked beam = 120 damage for us + long enemy stun. Not bad either! But it costs 50 ki and 90 ticks of our time.

Actually wait: when the opponent blocks the beam, `land` → chip 120 → stun blockstun 46 → they can't do anything for 46 ticks. Then we walk in and combo. Beam blocked seems great for us too. The danger is opponent dashes away or the beam misses entirely (they walk out of the ray? The beam front advances 30/tick, so it sweeps the whole stage; only dash invuln escapes, and dash costs 10 ki).

So a strong plan: save up ki (charge), then fire beam when the opponent is at mid-range (or when we want to zone). If they guard, we get 120 + stun + free approach. If they dodge, we wasted 50 ki but they wasted 10.

Hmm, but if they guard our beam, they take 120 chip. That's 120 damage! And 46 ticks of stun. Compare beam unblocked 280 + knockdown.

So beams are strong. But counter: opponent might also beam → clash → coin flip with power.

Another consideration: our beam startup 30 ticks; if the opponent hits us during startup, our beam is interrupted (we lose the 50 ki). Opponents hit with light (40) which interrupts... any hit interrupts beam? In beams(): `if (m.beams[a.side] && (a.state !== 'beam' || a.t >= startup+fire)) m.beams[a.side] = null;` — this clears the beam if the shooter's state is no longer 'beam'. If we're hit during startup, our state becomes 'hitstun' → beam cleared → interrupted. Yes.

So when we start a beam, opponent must not be able to hit us. We're at range; light reach 110. If dist > 110 at beam start and they can't close in 30 ticks (they walk 4.5/tick = 135 in 30 ticks, or dash 200) — they could dash in and hit. So beam at long range is risky against dash.

Practical approach: prioritize:
1. Dodge incoming blasts/beams.
2. Punish committed opponents (startup/recovery/charging) with heavy.
3. Otherwise close distance and use light chain; cancel to heavy for knockdown.
4. Use blast at mid range when ki allows.
5. Beam when ki >= 60 and dist > 150 (safe-ish).
6. Guard when opponent close and free and we have no good offensive option, to bait their attacks then punish.

Hmm, guarding to bait is nice but costs time. With 60s and no rounds, time is only a factor at the end.

Let me think about a cleaner design: a scoring evaluation over candidate actions with a one-step lookahead.

I'll write a scoring function that evaluates each candidate action by heuristics on the resulting state. This is more robust than a rigid tree.

Candidates: idle, forward, back, guard, charge, light, heavy, blast, beam, dash_forward, dash_back.

Score components (higher better):
- Only consider actions feasible: ki cost, blast availability (blastOut), and reach (light/heavy only make sense if dist <= reach; if dist > reach they're useless - well, they'd still start and waste time).
- We don't know the opponent's next action.

Heuristic scoring:

Let me define:
- threat = opponent's ability to hit us.
- value of my move = expected damage - risk.

Let me write it concretely.

```
function decide(s){
  const me=s.me, op=s.opp;
  if (s.clash) return clash(s);
  if (me.canCancel) return cancelMove(s);
  // free states only here
  ...
}
```

Since we act every 6 ticks and states are held between calls, a "choose action" model: we set a state and it persists. So we should choose a held action wisely.

Let me write the free-state logic:

```
const oppThreat = op.state in ['light','heavy','blast','beam'] and op.phase==='startup'/'active'...
```

Detailed plan for free decision:

1. Emergency: incoming blast with eta <= 12 → if we have ki>=10 and can dash away (dash_back) → dash_back (invuln 9 ticks, moves 200 back). But careful: dash_back recovery 8 ticks, and if the blast hits us during recovery we're in hitstun. Alternatively guard if eta <= 8 (blast will hit in 8 ticks; guarding gives chip 12 + 14 stun + 2 ki). Actually guard blocks the blast entirely except 12 chip. So guard is cheap! Blast chip 12 vs full 70. So guarding is strictly better than eating it, unless we can dodge entirely. Dodge: dash_back costs 10 ki, 10 ticks of movement + 8 recovery (18 ticks vulnerable). If we dash and the blast passes (invuln first 9 ticks), we take 0 damage. But if the blast was going to hit us in 3 ticks, dashing back 200 makes it miss (it flies past our old position; but blast continues and could hit us? We moved away; the blast travels 13/tick so it will pass our new position too? No—we moved backward 200, blast moves forward 13/tick, it will reach our new position eventually (200/13 = 15 ticks later), but by then it's... hmm, the blast persists until it hits something or leaves the stage. If we dash back 200 and the blast was 5 ticks away, the blast reaches our new position in ~20 ticks, by which time we've recovered (18 ticks) and can guard. OK.

Simplest: if incoming blast eta <= 10 → guard (cheap, 12 chip). If eta > 10 → maybe we can reposition/dodge or just continue.

But careful: guard has to be active at the moment of impact. Guard is a held state, so set 'guard' now and it stays until we change. Good.

2. Opp is firing a beam and we're in the ray (beams array contains opp beam with our x within from..front) → if we can, dash_back/dash_forward to escape the ray. Beam front moves 30/tick; our body must leave [from-pad, front+pad]. Dash back 200 in 10 ticks moves 20/tick... wait dash moves 200 in 10 ticks = 20/tick, faster than the beam front 30/tick. Hmm, the beam front advances 30/tick and beam covers from shooter to front — the ray grows toward us. If the front is behind us already, we'd already have been hit (if not invulnerable). Since b.hit is set once, if we're in the ray and not yet hit, the front is just reaching us. Actually inRay uses the front which grows. If the front already passed our x, we'd have been hit in an earlier tick (b.hit=true). Unless we were invulnerable (dash) or the beam started after we... Actually if the beam's front passed us before we entered? The beam ray covers from the shooter to the front — everything between. If the front > our x, we're covered → hit. So if not hit yet, the front is still short of us. The front advances 30/tick, so in ~2 ticks it reaches us. Can we escape? Dash back 20/tick vs front 30/tick → no, we'd get hit. Dash forward (through the opponent? no, toward them) also slower. So we can't outrun the beam. We must have been hit or be invulnerable. So beam ray = death unless it hits a body already (b.hit) — then it's done.

Hmm, so if the opponent fires a beam and we can't dodge (we'd need to dash during startup: 30 ticks startup, dash invuln 9 — the dash would have to happen such that we're invulnerable when the beam passes... the beam hits only once and if we're invulnerable at that moment, `b.hit` isn't set, and "无敌结束时如果还在光束里，照样挨打" — but the beam keeps firing 40 ticks, so eventually it hits. But if we dashed forward through the opponent (200 units) past the beam's front... the beam's front is growing 30/tick for 40 ticks = 1200 units, so it sweeps the whole stage. So dodging a beam requires being invulnerable the entire time it's over us, impossible. Unless we get behind the shooter? The beam starts at shooter.x + 25 and goes forward — the ray only covers the direction the shooter faces. If we dash_forward through the opponent and land behind them, then the ray goes from the opponent's position forward, away from us! Then we're behind the shooter → not in ray. But the shooter faces us... "对手空闲的话会立刻转身" — the opponent is in 'beam' state (not free), so they don't turn. But the beam direction is fixed at firing start: `m.beams[a.side] = {owner, dir: a.facing, ...}` — dir fixed at startup+1 time. So if we dash behind them after the beam fires, we escape!

But during the beam's 30 startup we could dash? If we're hit during startup, interrupted. Dash gives invuln 9 ticks so light can't hit us, but heavy (crush) can? Crush: land() → if o.state==='guard' ... heavy vs invuln target: in strikes(), invuln check happens before land: `if (invuln(R,o)) continue` — so invuln protects against heavy too. OK so dashing protects us from everything while invulnerable (9 ticks).

So an important defensive trick: when the opponent starts a beam (op.state==='beam', phase 'startup'), dash_forward through them to get behind, then the beam fires away from us. But dash_forward lands at x+200*dir, going through the opponent if there's room behind. Since we're facing them, dash_forward moves toward them and past. If there's room behind them, we land behind → beam fires away from us. Nice counter!

Alternatively, dash_back to escape the beam's path? The beam sweeps toward us from their position, so no.

Hmm, but careful: the beam's ray: from = shooter.x + facing*25, front grows. If we're behind the shooter, we're not in the ray. But they turn? Not free → no turn. But wait, we might be at their position minus something. If we land exactly behind (x < shooter.x), we're safe.

Also, an important detail: they fire at t=startup=30 with dir = facing at that moment. Facing was set when they became free/started the move. If we dashed behind them, they don't turn (not free) so dir stays pointing at their original direction = toward where we were = away from us. 

So: opponent starting beam → if we can dash through them → escape. Also if they're far and we can dash_back before it fires... no, the ray sweeps.

Wait, actually there's another subtlety: can we avoid the beam by NOT being in front of them? The beam fires toward their facing at fire time. So the escape is to be behind them.

Also for blasts: incoming blast we can dodge by dashing forward past the opponent? Blast direction is toward us; dashing forward (toward them) past them puts us behind the blast's origin? No, the blast keeps traveling forward. Dash forward = moving in the direction the blast moves → the blast catches up? No, blast moves 13/tick, dash 20/tick toward the opponent. If we dash forward through them, we land behind them at their position + 200*dir... the blast is also coming from them, moving toward us. We land 200 units behind them = in the direction the blast travels, so the blast would hit us! Wait: opponent at x=500, me at 400, facing +1. Blast spawns at 540 moving +1 (dir = opponent's facing = -1, so it moves toward me at -1). So blast travels from 540 down to 400. If I dash_forward (toward opponent, +1) 200 → I land at 600 (behind opponent). The blast travels from 540 to -1 direction, passing 600? No! It moves away from me. Blast dir = -1 (toward me). I moved to 600, the blast moves to 540, 527, ... 500, 400 (my old position) — it passes through where I was but I'm now at 600, beyond the blast's origin. Since blast only moves in dir -1, it never reaches 600. So I dodged by dashing through them! Yes — dashing forward through the opponent dodges blasts too (that's the "穿过对手" trick).

Alternatively dash_back 200 → from 400 to 200, blast continues toward -1 and will reach 200 in (540-200)/13 = 26 ticks. We'd be in recovery (18 ticks) and could guard by then. Meh.

So dash_forward is a great dodge when there's room behind the opponent.

OK. Let me now think about overall structure more concretely, then write the code.

I'll write a scoring-based approach but with clear special cases.

Let me define helper functions using RULES.

```
const R = RULES;
const F = {idle:1, forward:1, back:1, guard:1, charge:1};
```

Main decide:

```
function decide(s){
  const me = s.me, op = s.opp;
  if (s.clash) return clashDecide(s);
  if (me.canCancel) return cancelDecide(s);
  return freeDecide(s);
}
```

cancelDecide: we're in the middle of a light's recovery and the light landed (cancel flag). Options:
- if chain < 4 and dist <= reach: chain light. But consider: is the opponent in hitstun (op.state==='hitstun')? Yes probably. If op is in hitstun and will remain so, chain.
- Consider ending with heavy: heavy gives 120*scale and knockdown 42. In a chain, heavy at combo index i has scale combo[i]. Best to do heavy early in the chain (higher scale): e.g., light (combo0→1.0, 40) then heavy (combo1→0.8, 96) = 136 in ~15 ticks, then knockdown. Or light, light, light, light = 120 but takes ~4*(5+?) Actually chain lights: each cancel gives an extra decision at the next tick, and light startup is 5 → each light hits 5 ticks after cancel. So 4 lights take ~4*6 = 24 ticks and total 120 damage, and the opponent stays in hitstun the whole time. Hmm, 120 damage over 24 ticks with the opponent unable to act (they're in hitstun the whole time). Versus light+heavy: 136 damage in ~15 ticks + 42 tick knockdown.

Also the push: each light pushes 14 away. Light×2 = 28 away. Then heavy reach 140, fine.

Even better: light → heavy → (after knockdown they get up, no cancel from heavy). 

Alternatively light → blast (70*0.8=56, and blast continues to hit them even if... no).

I think light → heavy is a strong combo: 136 damage, ends with knockdown 42 (they're helpless 42 ticks, and during down we can reposition/charge).

But: is the heavy guaranteed to hit? The opponent is in hitstun (14 ticks left). Heavy startup 9, active 4 → hits at +9 to +12, within 14. OK. But distance: light pushed them 14 away. If we started at dist 70 → after light, dist 84, heavy reach 140 ✓.

But if we started at dist 100 → after light, 114 → heavy reach 140 ✓ still.

Alternatively 4-light chain: 120 damage, no knockdown, and pushes them to dist ~156 (beyond reach). Then they recover. Damage-wise light-heavy is better (136 + knockdown) and faster.

But there's a subtlety: what if the opponent is close to the wall so push doesn't increase distance? Then more lights possible. Meh.

Another option: light → light → heavy: 40 + 32 + 120*0.65 = 78 → 150 total. But the 3rd hit's scale index: combo increments on each hit. Light1: combo 0→1, scale combo[0]=1. Light2: combo 1→2, scale combo[1]=0.8. Heavy3: combo 2→3, scale combo[2]=0.65 → 78. Total 40+32+78 = 150. And it takes 5+5+9 = ~19 ticks (but the opponent's hitstun: 15 ticks from hit1; hit2 at +5 (combo ok, they still stunned); hit3 heavy at +5+9=+14 from hit1 — just within 15! Risky: if hit3 lands after the opponent recovers, they can block (guard) → heavy vs guard = crush (60 dmg to them, 34 stun for them) → still not bad actually. Or they might dodge.

Hmm. Let me think about which is more reliable: 2-hit (light+heavy) 136 with knockdown vs 3-hit 150. I'll go with a conditional: chain light only if the opponent will remain stunned and distance allows, else heavy.

Actually, key: after the first light hits, the opponent is in hitstun for 15 ticks (they were free before). If they were already in hitstun (combo continuing), hitstun resets to 15 again. So we always have 15 ticks from the last hit.

Decision on cancel:
- If dist <= 140 and op is stunned/helpless and ki considerations: choose heavy (if we want to end combo with knockdown) — but note that ending with heavy means the opponent gets knocked down (42) and knocked back 150, giving them space; and we lose the pressure.
- Alternatively light again if dist <= 110 - 14 (so that after the push we can still land the next).

Let me just consider damage efficiency and also "opponent's counterplay". If we chain heavy after light, opponent can't block because they're stunned. Good.

Decision: on cancel, if chain < 4:
  - if dist <= 110 (light reach) → light (continue chain) — but prefer to end with heavy at some point.
  Let me define: if we can reach with heavy (dist <= 140) and (op is helpless) → heavy for the knockdown, unless chain < 4 and dist <= 96 → light (to increase the combo count then heavy later?).

Simplify: choose 'light' if chain < 4 && dist <= 96 (leaving room after push), else 'heavy' if dist <= 140, else 'light' (miss anyway) hmm.

Wait, but is heavy always better than light at the end of a chain? heavy: 120*scale (scale 0.65 at combo 3 → 78) + knockdown. light: 40*scale(0.55=22). Heavy much better, plus knockdown 42 ticks of free time for us to reposition/charge. Yes heavy.

But heavy has reach 140 and startup 9 — if the opponent recovers and blocks, we get crushed (we take 60, they get 34 stun). Actually wait, we would be the one attacking; if they block our heavy: crush damage 60 to THEM (the guard holder) and they're stunned 34. Wait re-read land(): if o.state==='guard' && heavy → hurt(m, a, o, M.crushDamage) → o is the defender, so they take 60 damage and get crushed 34. So blocking a heavy is bad for them. So even if they block, it's decent for us.

But if they dodge? They can't dash while in hitstun. If they recover before our heavy lands (heavy startup 9, hitstun 15 from the light) — hit at +9..12 < 15, they can't act. OK.

So on cancel: prefer heavy (if reach) else light.

Hmm, one more: what about cancel into blast? Blast damage 70*0.8=56, hitstun 20, no knockdown, and it works at any distance (projectile) and can be blocked (12 chip). Heavy is better if in range.

What about cancel into beam? 280 damage, knockdown 50, but startup 30 → the opponent recovers at +15 and can interrupt us (they'd need 9 ticks to hit us: light startup 5 → they'd hit us at +15+5=+20 if they immediately light, canceling our beam). Also they might guard → chip 120 + stun. Hmm, beam cancel: if the opponent has ki and is likely to guard, they eat 120 chip and get stunned 46 ticks → that's 120 damage and we can then combo. If they don't guard and don't interrupt → 280 damage + knockdown. Expected value decent but ki-costly (50). I'll consider beam cancel when ki >= 55 and opponent has low ki (< 30) maybe. Or when the opponent is stunned for a long time... Let's keep: cancel into beam only if ki >= 60 and op.ki < 40 and dist > 150 (so we have time; and beam at long distance is safer). Meh, I'll include a mild version.

Now the free-state decision. Let's enumerate situations:

Variables: dist, me.ki, op.ki, op.state, op.phase, op.hp, me.hp, timeLeft.

Case A: op.state === 'beam' and op.phase === 'startup' → they committed to a beam (50 ki). Best response: dash_forward to get behind them (if room behind) → they fire away from us. Otherwise, dash_back? Beam will sweep toward us; can't escape; but if we dash back 200 and they fire, the ray goes from their position toward us — we'd be 200 further away, but the ray extends 1200 units so it still reaches us. So no escape except behind. Alternatively dash_back to be far and then... the ray covers the whole stage in the firing direction, so no.

Hmm wait, actually, there's another consideration: if we dash forward through them, we land behind them; but "落地后到收招结束前你还面朝原来的方向" — we face the old direction. Fine.

But if we dash through them, we might land on them if there's no room behind → dashEnd handles that (stops in front). If we can't get behind, options: guard (chip 120, then long blockstun — actually good! we take 120 damage but they're stunned 46 ticks). Or dash_back to at least not be in the beam? No.

Alternatively, if the opponent has low ki, maybe we can't do anything. Let's do: if dash_forward can get us behind (check wallBehind relative to their position) → dash_forward. Estimate: opponent's x = op.x; their wall behind = they face us so behind them is the far side. If op.x - 60 >= 40 (they're far enough from the left wall) or their position such that there's room. Since facing: op faces us; we are on one side. The space behind them = distance from their position away from us to the wall. If we (facing +1, we're left of them) dash forward 200 → landing x = op.x + 200 (through them) if that's <= 960 and the behind position has room. dashEnd: computes exactly. I can replicate dashEnd logic to decide if the dash gets us behind them. Let's implement a helper mimicking engine's dashEnd.

Case B: incoming blast (s.blasts with incoming=true) → if eta <= 12: if we can dash forward through them (escape) or dash_back... Actually the simplest robust: guard. Chip only 12 and we get 2 ki and 14 stun. That's cheap! But 14 blockstun = 14 ticks where we're stunned (can't act) — that's a real cost but acceptable vs 70 damage.

Better: dash_back if the blast's eta > ~6 (we have time to complete the dash: dash 10 ticks moving, invuln first 9). Hmm, dash takes 10 ticks to move; during those ticks we're invulnerable for 9 of them. If the blast would hit at eta ticks, and we start the dash now, we're invulnerable for ticks 0-8 of the dash. So if eta <= 9, dashing makes us invulnerable when it arrives → dodge! And the blast passes through us (invuln) and continues. But then we're in dash recovery (8 ticks). The blast, having passed us... it moves forward past our old position; we're behind it now (we dashed back 200), so it continues away. 

So: if incoming blast eta <= 9 and ki >= 10 → dash_back (dodge, no damage). If eta is 10-14: dash_back starts now, invuln until tick 9, blast arrives at 10 → not invulnerable at tick 10 (we'd be in recovery at tick 10). Hmm: dash state t<10 is 'moving' with invuln if t<9. At t=9 (10th tick) invuln is false. So if the blast hits at exactly tick 10, we get hit. If eta <= 9 → safe.

But careful: dash_back moves 200 back; we might hit the wall (x clamped to 40). Fine.

Also: the blast could hit us during dash recovery if it's slow... no, it passes by.

Alternatively if eta <= 9 → dash_back. If eta > 9 → we can also consider that the blast will hit in 10-30 ticks; guard then. Since our decision cadence is 6 ticks, we might be re-asked before impact. Guard when eta <= 12 and we have nothing better.

Case C: op is charging (op.state==='charge') → punish with heavy if in reach 140 (1.5× = 180 dmg!). Or blast (105). Or light (60). Heavy is best. But heavy startup 9 and active 4 → they might stop charging and act? No — once free, the state is held until they change it; they can change at their decision ticks (every 6 ticks). They could switch to back/guard during our heavy startup. If they switch to guard, our heavy → crush (60 dmg, 34 stun). If they dash away (10 ki) → miss. Still, heavy is good.

Hmm, but actually if we heavy and they're charging, we get 180 damage. Excellent.

Case D: op is in startup/recovery of a move (light/heavy/blast/beam/dash) → they're committed → counter 1.25 for our hits. If dist <= 140 → heavy (150 dmg). But if they're in beam startup (30 ticks) and heavy hits them, we interrupt their beam (280 dmg potential) and get 150 + knockdown. Excellent. If they're in 'dash' recovery → also counter.

But careful: if they're in 'light' startup (5 ticks) and we're at dist 100, our heavy (startup 9) hits at +9 — by then they've recovered (their light total 17 ticks, active at 5-8). Their light might hit us during our heavy startup! Light reach 110 — if dist <= 110 and they hit us at +5, we take 40 (×1.25 if we're in startup → 50) and our heavy gets... being hit doesn't cancel our heavy (only beam is canceled? Let's check: stun() sets o.state='hitstun' — that overrides our heavy! Yes, being hit during startup interrupts any move, including heavy). So they trade. Hmm. If they're in light startup and dist <= 110, they will hit us. Then we shouldn't attack with a slow move; we should... they're already committed, so their light lands at +5 and then they recover.

Timing-aware: if op.state==='light' && op.phase==='startup' → their hit comes in (5 - op.t) ticks... careful op.t is the time in state. Active starts at t=5. So hit at 5 - op.t ticks from now (roughly, our decision happens at the start of tick, and the hit resolves at that tick). If op.t is small (like 0-2), they hit in 3-5 ticks. Our heavy startup 9 → we'd be hit first. Our light startup 5 → if we start now, our active is at tick 5, they'd hit at tick 5 too (if op.t=0 → their active starts at t=5, hits at tick 5). Both hit → trade. Both take damage (40 each × multipliers). Not great but not terrible.

Better in that case: back off (dash_back) to avoid the trade, then punish their recovery. Or just guard (blocks their light, chip 0, push 14, blockstun 11 for them). Guarding is nice: they get blockstun 11 and are pushed.

Hmm, but if we're in their light range and we choose guard: their light hits → blocked → they're in blockstun 11, we're fine (0 damage). That's better than trading.

So the rule "if opponent is about to hit us, guard" is generally good for light and blast. For heavy, guard → crush (60 dmg to us, 34 stun to them) — trading 60 for their 120 potential is good for us.

But wait, if we guard and they heavy → we take 60 and they get 34 ticks stunned. That's good for us! Guard is strong.

But if we guard and they don't attack, we're wasting time. Guard is a held state; we get asked every 6 ticks, so we can guard and then switch.

Key: When should we guard vs attack? If the opponent is close and free and we have no punish opportunity, we might guard to bait. But often attacking first is better.

Let me define an overall approach with priority list:

1. Clash → clash logic.
2. Cancel → combo logic.
3. If op is in beam startup → try dash through (get behind) to dodge; else consider guard; else attack (heavy interrupts).
   - Actually interrupting their beam startup with a light/heavy might be better than dodging! If dist <= 140: heavy startup 9 → hits at +9, well within their 30 startup → interrupts → 150 damage + knockdown, and their 50 ki is wasted. That's excellent. But they may be out of reach... dist <= 140 → heavy works. If dist > 140, use blast (travels) or dash in.
   - Compare: dash behind avoids damage entirely (they waste 50 ki, we keep ours) but they still fire the beam and we can't hurt them. Interrupting gives 150 damage + knockdown but risks... their beam startup means they're not attacking, so interrupting is safe. Interrupting is better! Let's prioritize: if dist <= 140 → heavy to interrupt. Hmm, but heavy startup 9 → hits at 9..12 → fine. But wait: their beam startup means they're free? No: state 'beam' is not free. They can't act. So no risk. Interrupt = great.
   - But if we interrupt, they might have been about to... whatever. Interrupt.
   - Alternatively blast: 20 ki, travels. Light: 40 dmg interrupt.
   - Priority: heavy (150 + knockdown) if in reach; else blast if ki >= 20 and dist <= ~400; else light if dist <= 110; else dash_forward to close and interrupt.

   Hmm, but there's a catch: does hitting them during beam startup really cancel the beam? In beams(), the beam object is cleared if a.state !== 'beam'. They're in hitstun → cleared. Also, the beam object is created at t===startup(30). If we interrupt at t=25, no beam was created yet. Fine either way.

4. If op is charging → heavy if reach (180 dmg).
5. If op is in a committed move (light/heavy/blast/dash startup/recovery) → 
   - If op's attack will hit us soon (light active soon, or blast incoming) → guard or dodge.
   - Else punish with heavy/light.
6. If op is free (idle/forward/back/guard/charge handled above):
   - If op is guarding and we're in reach → heavy (crush) or wait/zone.
   - Else approach and light-chain.

Let me also add: our own HP matters — if hp < 30%, we might play more careful (but rage in clash gives +0.4 power).

Also time: if timeLeft is small (< 300 ticks) and we're ahead on HP, we might play safe (guard/back) to preserve. Actually at time end, HP comparison decides. If we're ahead, backing away and guarding is good. If behind, we must attack hard.

Let's implement:
- hpLead = me.hp - op.hp.
- If timeLeft < 400 and hpLead > 150 → defensive mode: prefer guard/back, avoid risky beam (beam costs 50 ki and if interrupted is fine, but it doesn't lose HP... beam doesn't risk HP unless we get hit. Guard is safer).

Now the general "free" logic. Let me write it as a scoring function to keep it manageable, or as a decision tree? I think a decision tree with explicit priorities is more predictable and easier to get right. Let me write a hybrid: compute a set of candidate actions with scores.

I'll do scoring. Define for each candidate action a score:

score = -risk + reward.

Components:
- damageValue(move): expected damage if it hits: light 40, heavy 120 (+ knockdown bonus), blast 70, beam 280.
- hitProb(move): depends on reach and whether the opponent can block/interrupt.

This gets complicated. Let me instead write a rule-based decision, since the situation space is manageable. I'll write it carefully.

```
function freeDecide(s) {
  const me = s.me, op = s.opp, d = s.dist;
  const R = RULES;

  // --- helpers
  const oppCanBlock = op.state === 'guard';
  const oppHelpless = op.state === 'hitstun' || op.state === 'down' || op.state === 'crushed' || op.state === 'blockstun';
  const oppCommitted = op.free === false && op.state !== 'down' && op.state !== 'hitstun' && op.state !== 'crushed' && op.state !== 'blockstun';
  // committed = in startup/recovery of a move
```

Order of checks:

(1) If opp is in 'beam' startup: they will fire a beam. Options:
   - If d <= 140 → heavy (interrupt). Score high.
   - Else if ki>=20 and d <= 500 → blast (interrupt).
   - Else → dash_forward to close.
   Note also: even if we interrupt, we need to hit during their 30-tick startup. Heavy at d<=140: startup 9 → hit at +9 → ok.
   Wait, but a subtlety: their beam startup 30 ticks; we're asked every 6 ticks. We decide "heavy" now → heavy takes 9 startup + 4 active + 22 recovery = 35 ticks. We hit at +9. ✓.

(2) If op is charging → if d <= 140 → heavy (chargeHit 1.5 = 180). If d > 140 → close distance (forward/dash) — but charging opponents might be baiting. Actually charging is a trap: they want us to approach. But 180 damage is great. If d > 140, we could throw a blast (105) or just approach. Let's: if d <= 140 → heavy. else → forward.

Hmm, but also, if the opponent is charging and we're far, we could blast them (70*1.5=105) if ki>=20 and the blast will arrive... they're charging, they might stop charging to block. Blast vs guard = 12 chip + 14 stun. Meh. Let's just close in and heavy.

(3) If there's an incoming blast: 
   - eta <= 9 and ki >= 10 → dash_back (dodge) — but wait, also consider dash_forward through opponent to dodge. Dash back is simpler. But hmm: dash_back has 8 recovery; and after dashing back we're far from them (200 away) which hurts our offense. If eta <= 9, dash_back is a clean dodge. Alternatively guard (12 chip, 14 stun) — the guard is free and gives 2 ki. Which is better? Guard loses 14 ticks of agency and 12 hp; dash loses 10 ki and 18 ticks of agency (10 moving + 8 recovery) but no hp. Both similar. Actually guarding is simpler and safe. But the blast might come when we're in the middle of something... we're free so fine.
     Hmm, one concern: what if the blast is incoming and we're about to attack? We'd rather dodge.
     Let's prefer: if eta <= 9 and ki >= 10 → dash_back (clean dodge, keeps hp). Else if eta <= 14 → guard (chip). Else → continue with normal logic (the blast will arrive later; we may decide again).
     Actually if eta is 10-14 and we set guard now, the guard persists until the next decision (6 ticks later) → we'd re-evaluate and could still be in guard when the blast arrives ✓. But careful: if we switch to another action at the next decision and the blast arrives later without warning... we re-evaluate every 6 ticks, so we'd see eta decreasing and guard again.
     
     Wait, a subtlety: guarding has a downside — the blast might come and we guard, but the opponent may also throw a light... whatever.
     
     Another subtlety: guard vs. our own plans. Guarding means we can't move.

     Also: if the blast is incoming and eta <= 9, could we also dash_forward through the opponent? That gets us behind them, offensively better (we end up close to... no, behind them means further). Dash_back is fine.

(4) If op is in 'heavy' startup (they're winding up a heavy) and d <= 140: their heavy will hit us in (9 - op.t) ticks at reach 140. Options: dash_back (invuln) to dodge, or guard (crush: we take 60, they get 34 stun). Or dash_forward to get behind them (invuln + behind → their heavy reaches 140 and we're behind... their heavy hits if d>0 && d<=140, where d=(op.x-me.x)*facing. If we're behind them, d would be negative → miss!). Interesting: dashing through the opponent makes their heavy whiff. But dash_forward costs 10 ki and 10 ticks of movement.
   Actually if d <= 140 and their heavy is coming: guard is decent (we take 60, they're stunned 34 → we then punish with a heavy for 120+). Net: -60 hp, +34 ticks free, then heavy. That's good.
   But dashing back: dodges entirely. dash_back moves 200 back; their heavy reach 140 → we might still be within 140 if d was 100 → after dash back, d=300 → miss ✓. So dash_back dodges their heavy entirely at the cost of 10 ki and 18 ticks. But then we're far away (300) and need to close (dash_forward 200 → 100 → then heavy). Hmm, dash back then dash forward = 20 ki.
   Alternatively: if their heavy startup is early (op.t small), we might be able to punish... no, heavy is too slow.
   I think: if op.state==='heavy' && op.phase==='startup' && d <= 140 → if ki>=10 and d <= 190 → dash_back (dodge + keep hp). Hmm, but d <= 190: after dashing back 200, d becomes d+200 which is > 140 always → they miss. Wait, dash_back moves 200 away, so new d = d + 200 (if room; the wall clamps). If we hit the wall, the wall clamps so d_new = d + (room). If we're at the wall behind, d_new could be < 140 → still hit. But we're at the wall → we'd have been cornered.
   Simplify: dash_back when the attack is going to land and we have ki. But 10 ki is 1/10 of our max; we also need ki for beams. Let's set a ki threshold of 20 for dashes.

   Hmm, wait. Actually there's a subtlety: is dashing back better than guarding a heavy? Guard → they get crushed-stunned 34 ticks and we take 60. That's a good trade, plus we keep our ki and position. I'll prefer guard vs heavy (if the heavy will land) — but only if we can't dodge for free. Actually we can also just walk back (back action: 3/tick) — not enough to escape 140 reach in 9 ticks (27 units). No.

   Hmm, let me reconsider: guard vs heavy costs 60 hp out of 1000 = 6%. Their heavy would have cost 120 + knockdown. Guarding is clearly good. But if we guard and they crush us, we're in 'crushed' stun 34 ticks (we can't act) — wait, who gets stunned? In land(), for heavy vs guard: hurt(a→o) 60 damage to o (the defender), stun(o,'crushed',34) → the defender (us) is stunned 34 and takes 60. The attacker is NOT stunned. So guarding a heavy = we take 60 and are stunned 34 ticks, they continue. That's not great: they get to hit us again after (we're in 'crushed' for 34, then we're free and can act — they may be in recovery).
   Hmm, so guarding vs heavy: -60 hp, 34 ticks of being helpless. Dashing back: 0 hp loss, 10 ki, 18 ticks of vulnerability but we're in control-ish. Dash back seems better if we have ki.
   But dashing back means they can then chase and hit us with a light etc. Meh.

   Alternatively: dash_forward THROUGH them when they're winding a heavy: we land behind → their heavy whiffs entirely (d<0 → no hit), we keep hp, and we're behind them (they'll turn since they're in recovery → free? no, after recovery they become free and turn to face us). During their heavy recovery (22 ticks) they're vulnerable: our light/heavy would counter (1.25×). So dash_forward through them to punish the recovery = great: 0 damage taken, then heavy for 150 during their recovery.
   But dash_forward lands at 200 forward; if they're at the wall there's no room → we stop in front of them (d=60) → their heavy still hits us (reach 140). Hmm.
   
   Decision for heavy startup threatening: if we can dash through them (room behind) → dash_forward. Else if ki >= 20 → dash_back. Else guard.

   Hmm, but this is getting complicated. Let me simplify: when the opponent's committed move will hit us (light/blast/heavy in range), prefer:
   - dash_forward through them if it puts us behind them (free dodge + punish opportunity).
   - else dash_back if ki >= 20.
   - else guard (blocks light/blast; heavy crushes us).

(5) If op is free and we're in a good position:
   - If op is guarding and d <= 140 → heavy (crush: they take 60, 34 stun) — good trade. Or blast (12 chip, 14 stun) — but if their guard is up, they might be expecting heavy? Whatever, heavy.
   Wait, careful: if op is guarding and we heavy → they get crushed → they take 60 damage and are stunned 34 ticks, and we can then hit them with light/light during their stun... but they're in 'crushed' state; light would land on them → they're in stun, combo scaling: their combo counter increments. OK.
   Hmm, but wait: crushed stun 34 ticks; we could also blast/beam into them for more. Good.
   - If op is guarding and d > 140 → we can't heavy. Options: wait (guard), charge ki, or throw a blast (they block → 12 chip). Or dash forward (approach) but they'd keep guarding; eventually we heavy. Let's approach with 'forward' and keep ki.

(6) Default approach/attack:
   - If d > 110 (light reach) → 'forward' (walk closer) or 'dash_forward' if d > 150 and ki >= 20? Dash_forward is 200 in 10 ticks = fast approach, and if it lands behind them we can attack from behind (though they turn). Cost 10 ki, and recovery 8.
   - If d <= 110 → 'light' (start the punch). Then the cancel logic handles the combo.

But wait: we should not walk into their range when they're ready to hit. Hmm. Let's keep it simpler: aggression.

Also important: 'charge' to build ki for beams. When should we charge? When the opponent is far away or when we have no good options and ki is low. Charging takes a hit at 1.5× damage — dangerous. So charge only when the opponent is far (d > 200) or when they're also not attacking.

Let me think about ki usage. Beam is the biggest damage (280). We need 50 ki. Passive regen 0.04/tick → 50 ki takes 1250 ticks (20s) passively, or ~160 ticks (2.6s) while charging. So charging is a big part of the game.

Realistic match: 60s. If I spend the first ~5s charging to 100 ki, then beam for 280 damage. Then regen again.

But the risk: while charging, we're vulnerable (1.5× damage). And the opponent will chase us.

Alternative: use blast (20 ki, 70 dmg) and light/heavy (free) as the bread and butter, saving beam for a big moment.

Given the difficulty, let me set the design:
- Primary: light chains + heavy punishes + crush when they guard.
- Beam: use when ki >= 55 and the opportunity is decent: opponent is far (>140) so our startup is safe, OR the opponent is stunned/helpless (their hitstun gives us ~15 ticks, not enough for a 30 startup). Hmm. Actually if the opponent is in a long state (down 42 ticks, crushed 34 ticks, blockstun 46 ticks), we have a window of 30+ ticks to fire a beam safely. That's the moment to use a beam! So: if op is in a long stun (down/crushed/blockstun) with enough remaining time (op.left >= 35) and ki >= 50 → beam. 

  Wait, but if they're in 'down' they're invulnerable — the beam can't hit them until they get up (invuln ends when they stand). Beam fires 40 ticks starting at +30; if they get up during the firing, the beam hits them (the ray sweeps). Hmm, they get hit → 280 damage! That's a great combo: knockdown → beam as they get up. But their recovery after down: they stand at the end of the down state, and they're free and can act immediately (nextAsk = tick+1). They could dash away (invuln 9 ticks) — the beam's front needs to reach them. If we fire the beam from far away (d=200), the front travels 30/tick → reaches them in ~6 ticks after firing. They'd have ~2 ticks after standing to dash. If the beam was fired at the moment they were down with 35 ticks left, the beam fires 30 ticks later (5 ticks after they stand) → they have time to dash (10 ticks to move 200). Dash invuln 9 ticks. If the front reaches them at that time... ugh, complex. Let's consider: they stand, we fire beam (front at our position +40), they dash back (away from us? they dash_back = away from us, i.e., in the direction the beam comes from? no: dash_back moves away from the opponent = away from us = toward us?? "dash_back: 10 tick 内后退 200" — 后退 = backward relative to facing = away from the opponent. Since they face us, backward = away from us ✓. The beam comes from us, so dashing back moves them away from us, deeper into the ray → still hit (the ray covers the whole area between us and the front). Hmm, the ray covers from the shooter to the front. If they dash back (away from the shooter), they stay in the ray → get hit. To dodge a beam, they must dash forward THROUGH the shooter (behind them). So they can escape by dashing through us! Requires 10 ki and the room behind us.
  So a beam is hard to dodge if we're far (they can't dash through us from far? dash_forward 200 through us lands behind us — that works from any distance as long as there's room behind us). Hmm, so they can always dodge a beam by dashing through the shooter (if they have 10 ki and there's room behind us). Unless they're cornered.

  OK, whatever. Beams are strong but not guaranteed. Let's use them at decent opportunities: ki >= 50, and either (a) the opponent is helpless for >= 32 ticks, or (b) the opponent is far (d >= 180) and free (so they need to dash in to interrupt us — 10 ticks dash + 5 light = 15 ticks < 30 startup, so they CAN interrupt if they dash in and light us. Hmm. But if we start the beam and they dash in, we get hit during startup → interrupted. Risky.)
  
  So (a) is much better. Also (c): the opponent is in blast startup/recovery (29 ticks) — but a blast startup is 11 ticks, too short. Heavy recovery is 22 ticks + startup 9. Not 30.
  
  Opponent 'down' (42) or 'crushed' (34) or 'blockstun' from a blocked beam (46) — these give windows.

  Alternatively: we can force a long stun ourselves: heavy → knockdown 42 → then beam. That's the classic. Let's implement: after landing a heavy (knockdown), we have 42 ticks; we should then walk/dash toward them and fire the beam when we have ki >= 50. The beam fires 30 ticks later; they'd be up by then and could interrupt. Hmm.

  Honestly, maybe a simpler and strong approach: heavy knockdowns + light chains + blasts, and use the beam when the opponent is helpless.

Let me also think: what beats what. Let me consider a "turtle and punish" strategy: guard a lot, punish their whiffs with heavy. Since we get a decision every 6 ticks and they decide at the same rate, and attacks are committed...

I think the most important thing is to not be reckless. Let's define the primary loop:

Loop (when nothing special):
- If d <= 110 and the opponent is not guarding → light (chain → then heavy).
- If d <= 140 and the opponent is guarding → heavy (crush).
- If d <= 110 and the opponent is guarding → hmm, also heavy (crush). Yes: any time the opponent guards and we're in heavy range → heavy.
- If d > 110 → approach: forward (or dash_forward if far and ki allows).

Opponent guarding is common (good AI guards). Crushing them is our main damage source then. Heavy crush = 60 damage + 34 stun; then we can chain lights during the crushed stun (they're in stun, can't block) → 40 + 32 + ... each light pushes them 14.

Wait, during 'crushed' stun, can they block? No, they're stunned. So light hits land. After the crush (34 ticks), we can do: light (startup 5) → hit → cancel light → hit → cancel light → hit → 3 lights ≈ 40+32+26 = 98 damage and push them away 42. Then maybe heavy. That's a big combo: 60 (crush) + ~100-150 = 160-210 damage. Nice.

But caution: after the crush, the opponent recovers in 34 ticks; if we're doing a light chain we need to be fast: light at t=0 hits at t=5, cancel light hits at t=11, cancel at t=17 (still within 34) ✓, cancel at t=23 ✓. So 4 lights possible: 40+32+26+22 = 120. Plus crush 60 = 180 damage and they get pushed far. But pushing: each light pushes 14 away; if they're not at the wall, we lose reach. Start dist ~60 (we heavy'd from within 140 — hmm, we heavy from up to 140 distance; the crush doesn't push them). So after crush, dist might be 130 → light reach 110 ✗. So we need to be close before the heavy.

Since heavy reach is 140 and light reach is 110, the ideal: approach to ~100, then if they guard → heavy (crush, dist still 100) → then light chain: light hits at 100 (push to 114), cancel light at 114 (reach 110 ✗ miss!). Hmm. So after 1 light we're out of reach. Unless we close more.

To chain we need dist <= 110 - 14 = 96 for the second light, <= 82 for the third, <= 68 for the 4th. So we want to be at ~60-68 for a 4-chain. So approach until d <= 65, then attack.

But approaching to 65 is dangerous (their light/heavy reach us). Their light reach is 110, so at 65 we're in their light range anyway. Fine.

Hmm, how about: after crushing, we could dash_forward to close the gap (10 ki, but we're in a stun window so the dash would be interrupted... no wait, they're stunned, we're free; we can dash). Dash_forward 200 → but if d=100 and they're at x=500, we'd land at 200+? We're at 400, they at 500, dash forward → 600 (through them) → then d=100 but we're behind them. Then light → hits (they're stunned, can't block) → push... pushApart pushes them away from us: we're behind them, so they get pushed further back. Fine.

OK, let me simplify by using a "desired distance" concept: we want d ≈ 70 for combos.

OK here's another thought — maybe I'm overengineering. Let's consider what a decent LLM-written opponent would look like: similar simple logic (approach, light, heavy, guard, charge, blast, beam). Our bot should be solid on the fundamentals:

1. Don't waste actions.
2. Hit when the opponent is committed (punish).
3. Chain lights then heavy.
4. Crush guards.
5. Dodge blasts with dash_back.
6. Interrupt beams.
7. Use beams when the opponent is helpless.
8. Manage ki: charge when safe, blast for mid-range.

Let me now write the code.

```js
const R = RULES;
const KI = { blast: 20, beam: 50, dash: 10 };

function decide(s) {
  try { return pick(s); } catch (e) { return 'idle'; }
}
```

Top-level variables reset per match (per the rules: "函数外面的变量可以记住这一局里发生过的事；下一局重新加载，变量清零" — the file is reloaded each match, so top-level vars reset). I could use them for counters but not needed. Actually, I might use a module-level variable to track state across calls (e.g., to remember the plan). Careful: variables persist across calls within a match. I'll use a few.

Let me write helper: `canDashThrough(op, me)`: compute if dash_forward lands behind the opponent.

Engine's dashEnd for dash_forward: d = a.facing * 1 = facing (toward opponent). x = me.x + facing*200. before = (op.x - me.x)*d, after = (op.x - x)*d. If before > 0 (op ahead) and after < minGap(60): we would end inside or beyond them:
  behind = op.x + d * max(minGap, -after)
  if (after <= -minGap && behind within [40,960]) x = behind  → through, landing behind
  else if (op.x + d*minGap in range && after < 0) x = op.x + d*minGap → stop in front at minGap
  else x = op.x - d*minGap → in front

So I can replicate: compute dashEnd(me, 'dash_forward') and check if it's beyond the opponent (i.e., (x - op.x)*facing > 0).

Let me write:
```
function dashForwardEnd(me, op) {
  const R = RULES;
  const d = me.facing; // toward opponent
  let x = me.x + d * R.dash.dist;
  const before = (op.x - me.x) * d, after = (op.x - x) * d;
  if (before > 0 && after < R.minGap) {
    const behind = op.x + d * Math.max(R.minGap, -after);
    if (after <= -R.minGap && behind >= R.stage.left && behind <= R.stage.right) x = behind;
    else if (op.x + d * R.minGap >= R.stage.left && op.x + d * R.minGap <= R.stage.right && after < 0) x = op.x + d * R.minGap;
    else x = op.x - d * R.minGap;
  }
  return Math.max(R.stage.left, Math.min(R.stage.right, x));
}
```
Note me.x and op.x from the view are rounded to 1 decimal — fine.

Then "behind" = dashForwardEnd > op.x + something when facing right.

Now the main pick function. Let me write it as an ordered set of rules.

```js
function pick(s) {
  const me = s.me, op = s.opp, R = RULES;
  const d = s.dist;
  const myKi = me.ki, oppKi = op.ki;

  // 0. clash
  if (s.clash) return clashPick(s);

  // 1. cancel window
  if (me.canCancel) return cancelPick(s);

  // incoming blast?
  let inc = null;
  for (const b of s.blasts) if (b.incoming) inc = b; // eta
  const incEta = inc ? inc.eta : 999;

  // opponent's beam startup?
  const oppBeamStart = op.state === 'beam' && op.phase === 'startup';
  const oppBeamFire = op.state === 'beam' && op.phase === 'firing';
  ...
}
```

Let me carefully write the decision tree:

```
  // A. incoming blast handling
  if (incEta <= 10) {
     if (myKi >= 20 && incEta <= 9) return 'dash_back';   // clean dodge
     return 'guard';  // chip 12, +2 ki
  }
```
Hmm, but if incEta <= 9 we might prefer dash_forward through the opponent (dodge + get on their back) but dash_back is simpler and keeps distance. Actually dash_back is bad offensively (we lose 200 distance). Alternatively dash_forward through them: we dodge the blast AND end up on their back (close!). That's better offensively! But if we can't get through (wall), we stay in front and get hit.

Hmm, actually a blast incoming: the blast travels toward us. If we dash forward (through them) we pass through the blast's origin... wait no. The blast comes from the opponent's side toward us. Dashing forward means moving toward the opponent = toward the blast's source. The blast moves toward us at 13/tick; we move toward it at 20/tick → we meet it! We'd collide with the blast mid-dash — but we're invulnerable for the first 9 ticks of the dash. The blast would reach our position at (dist/13) ticks. If we dash toward it, the collision happens sooner — but we're invulnerable, so the blast passes through us (invuln → dodge). Then we continue dashing and land behind them. 

So dash_forward through the opponent dodges the blast ✓ and gets us on their back. But if we can't land behind (no room), we stop in front of them at minGap 60 — and the blast is still coming (we're in front of them, the blast comes from their side) → we'd get hit unless we're still invulnerable. The blast reaches our position: since we're invulnerable for 9 ticks and the dash takes 10 ticks to move... hmm, after the dash ends (tick 10) we're in recovery (not invulnerable). The blast, meanwhile, passed us during invuln. Does the blast continue and hit us again? The blast's hit check: `if (Math.abs(o.x - b.x) > R.body && (o.x - b.px)*(o.x - b.x) > 0) continue;` — this checks if the opponent is between the blast's previous and current position (crossing). After passing us, the blast continues beyond; it won't come back. So we only need to be invulnerable when it crosses us. If we dash forward toward the blast, the crossing happens at some tick ≤ 9? Let's compute: the blast is at distance D from us (center-to-center), moving toward us at 13/tick; we move toward it at 20/tick (dash). Closing speed 33/tick → crossing at ~D/33 ticks. If D=100 → 3 ticks ✓ (invuln). If D=200 → 6 ticks ✓. If D=300 → 9 ticks (borderline). If D > 300, the blast would hit us before we close? No wait: we close at 33/tick while the blast closes at 13 → we always meet earlier. Crossing time = D/33. If D/33 > 9, we'd meet after invuln ends... but if we meet after the dash ends (10 ticks), the dash moves us 200 and the blast moves 130 → total 330 → if D > 330 they don't cross during the dash; the blast hits us at D/13 ticks later... but we'd have stopped at 200 forward. Then the blast reaches our new position. Hmm, at that point we're in recovery (8 ticks) then free. So we'd be hit.

This is getting complicated. Simplify: incoming blast, if we can dash through them (room behind) → dash_forward; else if ki >= 20 → dash_back (dodge, blast passes since we moved back; wait, does the blast still hit us after we dash back? We moved 200 back, the blast is coming toward us; the blast continues in its direction and will reach our new position! It's not like the forward case where we crossed it. So dash_back does NOT dodge the blast unless the blast is destroyed. Hmm! Right: the blast travels in a fixed direction and covers the whole stage. If we dash back, the blast reaches us later (we're further along its path). We'd be hit in recovery.

So dashing back does not dodge a blast, unless we dash back past... no. Blasts go to the stage edge.

Wait, then how do you dodge a blast? Only by being invulnerable when it crosses (dash through the opponent, going toward the source) — because then the blast's path is behind you? No! If I dash forward (toward the opponent), I cross the blast; the blast continues past my new position (I'm beyond its origin side? no). Hmm: the opponent is at 500, the blast spawns at 460 moving left (-1), I'm at 400. The blast moves 460 → 447 → 434... I'm at 400 moving right at 20/tick: 420, 440, 460... We cross around x=450 at tick ~1-2. After crossing, I'm at 460+ moving right and the blast is at 450 moving left. The blast continues left, away from me ✓. So the blast never reaches me again ✓. Yes, dashing forward through/over the blast dodges it permanently, because we end up on the far side (beyond the blast's origin).

But if I dash forward and stop in front of the opponent (no room behind them), I'm at 500-60=440... and the blast is coming from the left? No wait, in this example the blast comes from the opponent (500) toward me (400). If I dash forward and can't pass through them, I stop at 440, which is between the opponent and my old position. The blast is coming from 460 toward 440 — it reaches me quickly! And I'm invulnerable for 9 ticks. The blast crosses at ~1-2 ticks ✓. Then the blast continues past 440 → 427 → ... and I'm at 440 (in dash recovery). The blast moves away from me ✓ (it's at 427 < 440 and moving left). Wait, but did it cross me while I was at 440? I was moving: at tick 1 I'm at 420, tick 2 at 440... The blast: tick 1 at 447, tick 2 at 434. Crossing: at tick 1, the blast is at 447 and I'm at 420 — the blast's segment [460→447] doesn't cover 420. Tick 2: the blast [447→434], I'm at 440 — the blast crossed my position 440 during tick 2 ✓ → hit check: does the blast's segment cover the opponent (me) at 440? |me.x - b.x| = |440-434| = 6 <= 30 (body) → hit, but I'm invulnerable (tick 2 < 9) → dodge ✓. Then the blast continues to 421, 408... and I'm at 440 → it passed me ✓. 

So dashing forward always dodges the incoming blast if the crossing happens within the first 9 ticks of the dash. The crossing time depends on the gap. If the gap is huge (400), the blast is at 500-40=460 and I'm at 100 → gap 360 → closing speed 33/tick → 11 ticks > 9 → we'd be hit at tick 11? But wait, at tick 10 the dash ends (10 ticks of movement), and at tick 11 the blast crosses... I'm not invulnerable → hit. Hmm. But actually the blast's speed 13 and my dash speed 20: gap 360: blast travels 13t, I travel 20t → closing 33t → meet at t=10.9. So yes, too late.

But realistically, an incoming blast at a huge distance has a large eta, so we'd have time to react (the eta field gives us time). We can decide again next tick. Our rule "incEta <= 10 → dodge" handles the close cases.

Alternatively, guard blocks blasts for 12 chip. That's the reliable fallback. Let's prefer:
- incEta <= 9 → dash_forward (dodge + advance) if ki >= 10; else guard.
- incEta 10-16 → guard (chip 12, we'll be in blockstun 14 but survive).
   Hmm, but guard also means our own attacks stop. Alternatively dash_forward if we can cross within invuln: the crossing time ≈ gap/33 where gap = the distance to the blast. We know the blast's x and eta: eta = ceil((gap_to_body - 30)/13) where gap = (me.x - b.x)*dir (distance from the blast to me along its path). So the blast is eta*13+30 away. The crossing during a dash: we approach at 33/tick → t_cross = (13*eta+30)/33. For t_cross <= 9 → 13*eta+30 <= 297 → eta <= 20.5. So for eta <= 20 we can dash forward and cross safely! Nice. But careful: the dash ends after 10 ticks; the crossing happens at t_cross which is <= 9 ✓.
   So rule: if incEta <= 20 and ki >= 10 → dash_forward (dodge). Else if incEta <= 25 → guard. Else ignore (re-evaluate later).
   Hmm, but the dash_forward may land us in front of the opponent (no room behind) — that's fine, we crossed the blast anyway.
   Actually one risk: dash_forward moves us toward the opponent; the blast is between us; we cross it; fine.
   Another risk: the dash could be interrupted? No.
   
   But: is dashing forward always good? It gives up our position and costs 10 ki, and the dash recovery (8 ticks) leaves us vulnerable. But we dodge 70 damage. Yes, worth it.
   
   Alternatively guard for 12 chip is much cheaper in ki but we lose 14 ticks of blockstun and 12 hp. I'd say dash is better when the blast would otherwise hit.

   Hmm, but if the blast is close (eta<=9) and we're at dist 70 from the opponent, dashing forward means we end up 60 in front of them (or behind) → very close, good for combos.

   Let's use: if incEta <= 20 and ki >= 10 → 'dash_forward'; elif incEta <= 26 → 'guard'; else normal.
   
   Wait, careful: if incEta <= 20 but dashing forward takes us into a bad place... it's fine.

   Hmm, but one more consideration: if the blast is incoming and we also want to attack (e.g., the opponent is stunned), dashing wastes the window. But the blast would hit us for 70 → worse.

   Also: if we have the cancel window (light just landed) and an incoming blast — the cancel decision happens the tick after the light hits; a blast might be incoming then. In cancelPick we should consider the incoming blast: if the blast is about to hit us, we should NOT cancel into a slow move... Actually canceling into light would make us vulnerable. Hmm, but the cancel gives us an immediate move. If a blast is incoming with eta <= 5, canceling into light (5 startup) means the light hits at +5 and we get hit by the blast around the same time. Let's handle: in cancelPick, if there's an incoming blast with eta <= 6, maybe don't cancel (just let the light recover) → but then we're in recovery 9 ticks and the blast hits us for 70. Alternatively cancel into light and trade.
   Honestly, the incoming blast case in cancel is rare. I'll handle it simply: if an incoming blast exists with eta <= 8, prefer 'light' (fast) so we can hit and hopefully interrupt/stun them, or just return 'light' anyway (the default). Keep it simple: cancel logic ignores blasts mostly.

Now, the beam situation:
- If the opponent is in beam startup: interrupt with heavy if d <= 140 (150 dmg + knockdown, cancels their 50-ki beam). This is a top priority! Because their beam is worth 280 damage.
  - But careful: if we're in range and they start a beam, our heavy startup 9 ticks → we hit them at +9 → their beam (30 startup) is interrupted ✓.
  - If d > 140: use blast (ki >= 20): blast startup 11 + travel. The blast hits them at 11 + dist/13 ticks. Their beam startup is 30 → we need the blast to land within 30 ticks → dist/13 <= 19 → dist <= 247. So for d <= 240, blast interrupts ✓. For d > 240: dash_forward to close (10 ticks) then heavy — but during the dash we're invulnerable ✓, and after the dash we need another decision (dash recovery 8 ticks, then free → decision). Timeline: dash_forward now (10 ticks moving) → at tick 10 we land at d-200 (if room) → recovery 8 ticks → free at tick 18 → we decide → heavy → hits at 27 → within their 30 startup (if they started now) ✓ barely. Alternatively, if the opponent's beam startup is nearly over (op.t >= 24), dashing won't help; just guard or accept.
  - Priority check: is the opponent's beam startup more urgent than dodging an incoming blast? Probably the beam is more valuable. But if a blast is incoming at eta 3, we must dodge. Let's handle the incoming blast first (it's an immediate threat), then the beam interrupt.

Hmm, but wait: if the opponent is in beam startup and we interrupt with heavy, but they have a blast incoming on us... rare.

- If the opponent is firing a beam (beam phase firing) and we're in the ray → we're probably already hit. Skip.

- Our own beam usage: when to fire?
  Conditions: ki >= 50 and we want 280 damage. Safety: the opponent must not be able to interrupt us in the 30 startup ticks. They can interrupt if they can hit us during 30 ticks: light (5 startup, reach 110) or heavy or blast or dash+light.
  If d >= 200: they need to dash (10 ticks) then light (5) = 15 ticks → they CAN interrupt (if they have 10 ki). Unless they have no ki (dashing costs 10). Hmm. So a beam at range can be interrupted by a dash-in.
  If the opponent is stunned/helpless for >= 32 ticks → safe.
  If the opponent is in a committed move with a long remaining duration... e.g., in 'heavy' recovery (22 ticks left) → not enough for our 30 startup.
  
  So: fire the beam when op is in a long helpless state (down/crushed/blockstun with left >= 34) OR when the opponent is far and has no ki for a dash (oppKi < 20) — hmm, they could walk (4.5/tick → 135 in 30 ticks) + light. If d >= 200, they'd need to close 90+ → 20 ticks + light 5 = 25 < 30 → they can still interrupt. Ugh.
  
  Alternatively, accept the risk: the beam is 280 damage; if interrupted we lose 50 ki and 30 ticks. Not catastrophic. When the opponent is far and we're at 50+ ki, firing a beam is decent: the beam sweeps 1200 units, so they must dash through us to dodge, and if they dash through us we can hit them during their dash recovery (8 ticks) — counter ×1.25 heavy 150. Hmm.
  
  Let's be moderate: fire the beam when (a) op is helpless with left >= 34, or (b) d >= 220 and op.ki < 25 (they can't dash) — then they can only walk in: 220-110 = 110 units = 25 ticks + 5 = 30 → exactly at the limit. Risky but OK.

  Hmm, also: we should consider that after we fire the beam, if the opponent blocks it, they take 120 chip and get stunned 46 ticks → great for us. If they dodge it, we've wasted 50 ki. 

  Also (c): if the opponent is in 'blast' startup (11 ticks) — no.
  Also (d): if the opponent is charging (they're not going to interrupt) but d > 140 → beam them: 280*1.5 = 420 damage! But they can stop charging to dodge... they can't stop the beam; they can only dash (needs 10 ki) or block (chip 120, stun 46). If they charge, they have ki and might dash. Hmm, if op.state==='charge' and d > 140 and ki >= 50: beam → if they don't interrupt (they can't: charging means not acting, but they can switch to dash at their next decision (within 6 ticks) → dash 10 ticks → invuln... but the beam fires at +30, and their dash would be at ticks 0-10, ending before the beam fires. To dodge the beam, they'd need to dash forward THROUGH us at the right time (around tick 30-40). They could: decide dash_forward at tick ~28 (their decision cadence), dash 10 ticks, invuln 9 ticks... the beam's front reaches them at some point. Ugh.
  
  Let's simplify: fire the beam when the opportunity is good (op helpless long enough) or when it's late-ish and we're ahead? I'll implement:
  - beam if ki >= 50 and (opHelplessLong || (d >= 230 && op.ki < 30) || (op.state === 'charge' && d >= 160)).
  Hmm, for op charging, interrupting them with heavy (if in reach) is better (180 damage, no ki cost). Only use the beam on a charging opponent if d > 140.

Also, what about using the beam when the opponent is close (d < 110)? Then they can interrupt us easily (light startup 5 < 30). Bad. Avoid.

OK. And the blast: 20 ki, 70 damage, startup 11, travels. Use when d is 120-400 and the opponent is free (not stunned) and we can't close? Or when the opponent is far and we want to zone. Also the blast can interrupt their beam startup if it lands within 30 ticks.
  Also the blast can be blocked (12 chip). Hmm.
  Use blast when: d >= 120 && d <= 420 && ki >= 20 && op is free or in a long recovery. Meh, let's use it when d >= 130 and the opponent isn't stunned (if they're stunned, prefer melee) — actually if they're stunned and far, a blast is good too (they can't block, and it adds hitstun). But d >= 130.

Let's think about "approach": if d > 110 → 'forward' (walk 4.5/tick). We could dash_forward to close faster (200 in 10 ticks = 20/tick) but it costs 10 ki and 18 ticks total; also it might land us behind them (they turn). I think walking is safer/cheaper; use dash_forward when d > 250 and ki >= 30 (to close quickly) — or when we need to interrupt a beam.

Now, the case where the opponent is guarding: heavy to crush. But if we're not in range (d > 140) → approach.

Now: our own HP low? If me.hp < 300, be more careful: prefer guard/back over risky attacks. But also being desperate. Let's implement a mild version: if hp < 250 and timeLeft < 600, prioritize defense.

Time management: if timeLeft is small and we're ahead in HP → be defensive (avoid taking risks). If we're behind → attack hard (a KO is better than losing on time).

Let me now also handle: the opponent is in 'hitstun'/'blockstun'/'crushed'/'down' (helpless):
- If op.state === 'down' → they're invulnerable, so don't attack; instead reposition/charge. If d > 110, close in; if ki < 50 and we have a window, charge.
- If op is in hitstun/blockstun/crushed → attack if in range: light/heavy/blast/beam.
  - During 'crushed' (34 ticks): heavy first? A heavy would end the stun (knockdown 42). Or light chain for more damage. Let's do: if d <= 110 → light (chain → then heavy). If 110 < d <= 140 → heavy.
  Hmm, during a crushed stun, if we light-chain, we push them away. Let's think: after crushing (60 dmg), a light chain of 3-4 gives ~100 more. Or heavy: 120*scale. Both similar; the chain pushes them away but is safer.
  Actually wait: during 'crushed' (34 ticks), if we attack with light at d=130 (> 110 reach) it misses. So we need d <= 110.

Now, a very important consideration: when the opponent is stunned and we're not in range, we should close in (forward) or blast (if ki). 

Let's write the code now. I'll write it as a function with clear sections.

```js
function decide(s) {
  const me = s.me, op = s.opp, R = RULES;
  const d = s.dist;
  const hpLead = me.hp - op.hp;
  const timeLeft = s.timeLeft;

  // ---- clash
  if (s.clash) {
    const c = s.clash;
    // push if we have the power advantage and ki to sustain
    const pushGain = c.myPower + R.clash.pushPower - c.oppPower;
    if (me.ki > 25 && pushGain > 0.25) return 'push';
    return 'idle';
  }
```
Hmm, one consideration: pushing costs 0.6 extra ki/tick. If my ki is 30, pushing for 6 ticks costs 4.8 ki + 1.2 drain = 6 ki → my power drops from 1.6 to 1.48 + 0.6 (push) = 2.08 vs opp 1.6 → advantage 0.48. The drift toward the weaker side is 0.1 per tick per unit of power difference → 0.048/tick → over 6 ticks 0.29 units of position. The clash position range: between the two fighters (a few hundred units). So a 0.48 power advantage moves the clash point ~0.29 units per 6 ticks... To push the point all the way to the opponent (say 200 units), we'd need 200/0.048 = 4166 ticks. That's way over the 360-tick max! Hmm, that means power differences barely matter?!

Let me re-read clashTick: k.v = k.v * decay + d * ((pa - pb) * drift + shove). Then k.c += k.v. The drift term: d * (pa-pb)*0.1. With d=±1 (the beam direction), the velocity gains ±0.1*(power diff) per tick. With a power diff of 0.5 → velocity 0.05/tick, and with decay 0.95 the steady-state velocity is 0.05/0.05 = 1.0 units/tick. Over 360 ticks → 360 units. Hmm, so it takes a while. With a power diff of 1.0 → 2 units/tick steady → 360 ticks → 720 units. So the clash is a slow grind, and the noise (sd 0.8 per tick → steady-state velocity sd ~ 2.56 units/tick, position random walk with sd ~ 2.56/sqrt(1-0.95²) ≈ 8.2 units per tick step... hmm let me compute: v_t = 0.95 v_{t-1} + ε_t with sd(ε)=0.8 → sd(v) = 0.8/sqrt(1-0.9025) = 0.8/0.3122 = 2.56. Then c_t = c + v → the position's random walk has an increment sd 2.56 per tick, so over 360 ticks the sd = 2.56*sqrt(360) ≈ 48.6 units. So the noise creates a random walk of ~50 units sd over the whole clash, while the power drift gives a deterministic drift.

Also, the noise shove: `(m.rand()+...+m.rand()-2)*1.7320508*C.noise` — 4 uniforms each [0,1), sum-2 ∈ [-2,2), times 1.732 → sd = 1.732*0.8165*0.8 = 1.13? Hmm: the sum of 4 uniforms has variance 4/12 = 1/3, sd 0.577. Times 1.732 → sd 1.0. Times noise 0.8 → sd 0.8. OK so sd(ε) = 0.8 ✓ (the 1.732 factor normalizes).

Also note: ki drains during the clash: 0.2/tick each → over 360 ticks that's 72 ki each! Starting ki might be 50-100. So power declines over time. If I push (0.8/tick), my ki drains in ~1/4 the time.

Key: whoever runs out of ki first has power 0.5 (and their power drops a lot). So in a long clash, the one with more ki wins. Pushing burns ki faster but adds +0.6 power.

Power with ki k (no push): 1 + 0.02k. At k=50: 2.0. At k=25: 1.5. At k=0: 0.5 (discontinuous drop from 1.0 at k=0+... at k=0 exactly, power = 0.5).

Push adds 0.6: at k=50 → 2.6 vs opp 2.0 (opp not pushing) → diff 0.6 → drift velocity steady = 0.6*0.1/0.05 = 1.2 units/tick. Over 100 ticks → 120 units. Hmm, that could be enough to reach the opponent if the distance is ~200.

Actually the clash point c starts at the midpoint of the two fronts. The distance between fighters ~100-300. So we need the point to travel ~50-150 units to reach a body (the check: atB = (k.c - (b.x - d*R.body))*d >= 0 → the point reaches b.x - 30, i.e., 30 short of the body center).

So a power advantage of ~0.5-1.0 sustained for 100+ ticks can win the clash. Ki: pushing drains 0.8/tick → 80 ki over 100 ticks. If I have 100 ki and the opponent has 100 ki, and I push the whole time: my ki at t=100 is 20 → my power = 1+0.4+0.6 = 2.0; opp = 1+0.4 = 1.4 (they have 80 ki left) → diff 0.6 maintained-ish. Actually as both drain at different rates, the difference persists.

If neither pushes: both drain 0.2/tick, powers stay equal-ish (if the same starting ki) → the noise decides (coin flip). So pushing is the way to win a clash.

Strategy in the clash: push when my ki is plentiful (> 30) and my power + 0.6 > opp power. Keep pushing until my ki gets low, then stop pushing (to conserve). But careful: when I stop pushing and the opp keeps pushing, I lose.

Let's define: 
```
const myP = c.myPower, opP = c.oppPower;
const canPush = me.ki > 20;
if (canPush && myP + R.clash.pushPower > opP + 0.05) return 'push';
return 'idle';
```
Note: myPower already includes my push flag from the previous decision (it persists between decisions: a.push is set in choose() and stays until the next choose). Hmm: `a.push = act === 'push'` each time we're asked. So if we return 'idle', push becomes false. The state view's myPower reflects the current push flag. So when we compute myP, it includes the push bonus if we pushed last time. So myP + 0.6 would double count. Let me use: basePower = myPower - (pushing ? 0.6 : 0). I don't know if I'm currently pushing... The view gives myPower and opPower; I can't see the push flags directly. But I can infer: I know whether I pushed last time (I can track it in a module-level variable). Let's track `lastPushed`.

Simpler: compute my effective power without push: myBase = me.ki > 0 ? (1 + 0.02*me.ki + rage) : 0.5, where rage = 0.4 if me.hp < 300. Same for the opponent: opBase = op.ki > 0 ? 1+0.02*op.ki+(op.hp<300?0.4:0) : 0.5. Then push if myBase + 0.6 > opBase + 0.05 and me.ki > 20. And note the current push state affects the actual comparison each tick: if I'm pushing, my actual power = myBase + 0.6.

Since I get asked every 6 ticks and the push flag persists in between, my power during those 6 ticks includes +0.6. If I decide not to push now, the flag clears at the next decision (immediately, in choose()). Wait — choose() sets a.push = act==='push' at each ask, so if I return 'idle', push=false from that tick on. Fine.

So the decision each time: push or not, based on myBase+0.6 vs opBase.

Also rage: hp < 30% (300) → +0.4.

Let me also consider: the clash drains ki; my ki dropping below 0 → power 0.5. So when my ki < ~15, don't push.

Also: should I push to win even if the odds are bad? If myBase + 0.6 < opBase (the opponent has way more ki), pushing just burns my ki faster → worse. So don't push.

Edge: if the opponent is out of ki (opBase 0.5) and mine is decent → push.

OK.

Now the cancel logic:

```
function cancelPick(s) {
  const me = s.me, op = s.opp, d = s.dist, R = RULES;
  // we're in the light's recovery and it hit; we can cancel into light/heavy/blast/beam
  const chain = me.chain; // punches in this chain
  const opHelpless = op.state === 'hitstun' || op.state === 'blockstun' || op.state === 'crushed';
  // damage scaling: op.combo is the number of hits they've taken in this string
  const scale = R.combo[Math.min(op.combo, R.combo.length-1)];
  ...
}
```
op.combo: incremented on each hit taken. After our light hits (combo=1), the next hit's scale = combo[1] = 0.8. Right: in land(), `const scale = R.combo[Math.min(o.combo, ...)]` computed BEFORE `o.combo++`. So the first hit uses combo[0]=1, the second uses combo[1]=0.8, etc. ✓.

So on cancel (after 1 light hit), the next hit uses scale 0.8.

Options and expected damage:
- light: 40*0.8 = 32, +hitstun 15 refresh, push 14.
- heavy: 120*0.8 = 96 + knockdown 42 + knockback 150.
- blast: 70*0.8 = 56 + hitstun 20, no push, works at any range (travel time!). Requires 20 ki.
- beam: 280*0.8 = 224 + knockdown 50, requires 50 ki, 30 startup (risky: the opponent recovers in ~14 ticks and can interrupt).

Heavy is clearly best if in range (d <= 140). If d > 140 (the light pushed them away), heavy is out of reach → blast (if ki >= 20) or light (out of reach too) → nothing useful. Blast at long range: the opponent is in hitstun for 14 more ticks; the blast spawns at +11 and travels; if d = 160, it takes (160-40)/13 = 9 ticks → hits at +20, but the opponent is free at +14 → they can block (12 chip) or dodge. Marginal. Maybe just take the light's recovery and re-engage.

So cancel logic:
- if d <= 140 → 'heavy' (best value). But wait: should we consider chaining lights for more total damage? Let's compare 4-light chain (40+32+26+22=120, needs d <= 110-3*14 = 68 for the 4th) vs light+heavy (40+96=136 + knockdown). Heavy wins. But there's a subtlety: the heavy knocks them down 42 ticks and knocks them 150 away, ending our pressure but giving us free time. And the 4-chain keeps them in hitstun but pushes them out of range.
  Hmm, one more option: light → light → heavy (if the distance allows): 40+32+78 = 150 damage. But the 3rd hit (heavy) must land within the opponent's hitstun window: hit1 at t=0 (their hitstun 15 → until t=15), hit2 at t=5 (refreshes hitstun to 15 → until t=20), heavy hits at t=5+9=14 → within hitstun ✓ (until t=20). So the scale for hit3 = combo[2] = 0.65 → 78. Total 150 vs 136. Slightly better but requires the distance for 2 lights (d <= 110-14 = 96 initially, and after hit2 the dist is d+28).
  Marginal difference; the heavy knocks them down (42 ticks of free time for us) which is worth a lot. I'll go with heavy, unless the distance doesn't allow the heavy but allows a light (110 <= d <= 140 → heavy reach is 140, so heavy is allowed up to 140; light up to 110). If d <= 140 → heavy.

  Hmm, but wait: heavy has startup 9, active 4 → the hit is at +9..12. The opponent's hitstun expires at +15 from our light hit (t=0 → until t=15). If the cancel decision happens at t=1 (the tick after the light hit), the heavy hits at t=1+9=10 to 13 ✓ within 15.

  But what if the light hit happened earlier and the cancel was delayed? The cancel is given the very next tick ✓.

  Edge: if the light was blocked, there's no cancel (cancel is only set when the light hits, not blocked: in land(), for light: `if (kind === 'light') { stun(...); pushApart(...); if (a.state === 'light') a.cancel = true; }` — this is after the guard check, so only on a real hit ✓).

- So: cancel → if d <= 140 → heavy. Unless we want the extra damage... let's keep heavy. But hmm, one risk with heavy: if the opponent is at the edge of our reach and they get pushed... no push on heavy. The heavy reach is 140 and the distance after our light hit is d+14 (they got pushed 14 away). So if the original d was 130, after the push it's 144 > 140 → the heavy misses! We should check the distance at the time of the decision (after the push) — the state's dist is current (post-push) ✓. So use the current d. If d > 140 → we can't heavy. Then if d <= 110 → light (chain). Else (110 < d <= 140) → heavy (reach 140 ✓). OK so: d <= 140 → heavy; d <= 110 → light (only if heavy isn't better...). Since heavy reach 140 > light reach 110, heavy is always available when light is. So: if d <= 140 → heavy, else → light? A light at d > 110 would miss entirely. So if d > 140 → no good option → return 'idle' (let the recovery finish) — or blast if ki >= 20 (the opponent is stunned and can't block for 14 ticks; blast startup 11 → hits at 11+travel; travel = (d-40)/13; if d = 200 → 12 ticks → hits at 23 > 14 → they can block). Not worth it. Return 'idle'.

  Hmm, but a chain light at d slightly > 110 misses. Yeah, return 'idle' (or 'light' hoping? no).

  Special case: if the opponent is at the wall, the push doesn't increase the distance (we slide back) → d stays the same → so at d <= 140 heavy works. Fine, the current dist handles it.

- Chain consideration: should we ever chain lights? If d <= 110 and we want more damage... light gives 32 (scale 0.8) vs heavy 96. Heavy is better. But heavy knocks them down (they're invulnerable for 42 ticks) and knocks them 150 away — we lose the pressure and they recover to a fresh state (combo resets, they can guard). Whereas chaining lights keeps them in hitstun but pushes them away.
  Let's consider 3 lights + heavy: 40+32+26+78 = 176 damage but requires d <= 110-3*14 = 68 for the 4th hit. At d=68: hit1 pushes to 82, hit2 to 96, hit3 to 110, hit4 (heavy, reach 140) ✓ hits → total 176 + knockdown.
  That's better than 136! But it takes more ticks (~5+5+5+9 = 24 ticks) and the opponent is in hitstun the whole time (they can't act) ✓.
  Risk: if the opponent's hitstun expires before our hits land (e.g., they were free and the light hits → 15 ticks; our 2nd light at +5 ✓; 3rd at +10 ✓ (within 15); 4th heavy at +19 ✗ (beyond 15) → they recover at +15 and can block our heavy (→ crush, they take 60 + stun 34 — actually that's still OK for us!).
  Wait: after hit2 (at +5), their hitstun resets to 15 → until +20. Hit3 at +10 ✓ (resets to 15 → until +25). Hit4 (heavy) at +10+9 = +19 ✓ within +25 → hits ✓. 
  So a 4-hit chain works if each light refreshes the hitstun: light startup 5 → hit at +5, +10, +15 and the heavy at +19; the hitstun windows are [0,15], [5,20], [10,25], so the heavy at +19 ✓ (but the active frames are +19..+22, so the hit could land at +19-21 — the stun expires at +25 ✓).
  And the damage: 40 (scale 1) + 32 (0.8) + 26 (0.65) + 78 (0.55*120=66... wait, scale for the 4th hit = combo[3] = 0.55 → 120*0.55 = 66). Let me recompute: hits: 1st scale combo[0]=1 → 40; 2nd scale combo[1]=0.8 → 32; 3rd combo[2]=0.65 → 26; 4th (heavy) combo[3]=0.55 → 66. Total = 164. And we need the distance for 4 hits: after 3 pushes, d+42 <= 140 (heavy reach) → d <= 98; and for the 3rd light: d+28 <= 110 → d <= 82.
  So: if d <= 82 → do the 3-light chain then heavy (164 damage, knockdown). If 82 < d <= 98 → 2 lights then heavy (40+32+78=150). If 98 < d <= 140 → light then heavy (40+96=136). 
  Hmm, but this assumes the pushes all increase the distance. If they're at the wall, the distance doesn't increase and we can chain more.
  
  Also, the chain limit: 4 lights max (chain < 4). Our cancel counter: a.chain increments per light. So after 3 lights, chain=3; we can still do a 4th light (chain < 4 → chain becomes 4). "一串取消里最多 4 记轻拳" — so at most 4 lights. Our plan of 3 lights + heavy is within limits.

  Let me implement the cancel logic to plan a chain:
  - On cancel, we know chain = me.chain (the number of lights so far in this string). Wait, in start(): `a.chain = act === 'light' ? (chained ? a.chain + 1 : 1) : a.chain;` — so after the first light, chain=1; after the cancel-light, chain=2; etc. But note: the chain is NOT reset when we cancel into a heavy — a.chain stays. And in free(): a.chain = 0 (reset when we become free). So during a combo, chain counts the lights used.
  
  So on cancel with chain = c:
  - Decide whether to do another light (if c < 4) or a heavy.
  - Plan: if the expected total from the chain is higher... Let's just use distance thresholds:
    - If d <= 140 and (the chain is "worth it"): we want to end with a heavy eventually. Let's decide: if we can still land another light AND the heavy afterward, prefer the light (more total damage) — but with diminishing returns and the risk of the opponent recovering and blocking.
    
    Simplify with a scoring: value(light) = 40*scale(after) ; value(heavy) = 120*scale(after). The scale for the next hit = combo[op.combo] where op.combo is the number of hits they've already taken in this string (after our light hit, op.combo = 1). So the next light = 40*combo[1] = 32, the heavy = 120*combo[1] = 96.
    Doing a light then a heavy: 32 + 120*combo[2] = 32 + 78 = 110 (vs heavy now = 96). But the light costs 5 ticks and pushes us 14 further.
    Doing a light then a light then heavy: 32 + 26 + 66 = 124.
    So chaining more lights before the heavy is better in raw damage, but each light pushes them 14 away and takes ~5 ticks.
    Also the light keeps them in hitstun (the heavy might miss if the stun expires and they guard → crush 60 + stun 34 — that's actually not terrible).
    
    I'll implement: on cancel, if d <= 110 and chain < 4 and the distance after the push still allows a heavy (d+14 <= 140) → light (continue the chain). Else if d <= 140 → heavy. Else → idle.
    With the additional consideration: if chain >= 3, prefer the heavy (to end the combo with a knockdown) — since the 4th light only gives 22.
    Let's define: if chain < 3 && d <= 110 && d + 14 <= 140 → 'light'; else if d <= 140 → 'heavy'; else 'idle'.
    Wait, but with chain=3 (3 lights done) the next light is the 4th (allowed) but then no heavy. Let's do: chain < 3 → light (if possible), else heavy.
    Hmm: chain=1 (after the first light). Cancel → light (chain=2) → cancel → light (chain=3) → cancel → heavy (chain stays 3). That's 3 lights + heavy = 40+32+26+66 = 164 ✓.

  But hold on: is the extra damage worth the risk of the opponent recovering? Their hitstun is refreshed each hit ✓. The main risk is the distance: each light pushes 14 away, so at d=100: hit1 (100→114), then the light needs reach 110 → MISS. So at d=100 we can't chain; we must heavy at d=114 (reach 140 ✓). So the condition "d <= 110" for the light is about the CURRENT distance (before the push). Right: at the cancel decision, the current d is post-push from the previous light. So: if d <= 110 → the next light lands (and pushes them to d+14); then for the heavy we need d+14 <= 140 → d <= 126 ✓ automatically (since d <= 110). So the light is fine if d <= 110.
  So the rule: if chain < 3 && d <= 110 → 'light'; else if d <= 140 → 'heavy'; else 'idle'.
  Hmm, but also I should consider: what if the light would be blocked? The opponent is in hitstun → they can't block ✓ (unless the hitstun expired — check op.state === 'hitstun' or 'blockstun' or 'crushed'; if op.free (they recovered), the cancel wouldn't have been granted... actually the cancel is granted when our light hits, and the opponent enters hitstun then. At the cancel decision (1 tick later), op.state should be 'hitstun' ✓.

  What about blasting as the cancel (d > 140)? If d > 140, heavy is out of reach. Blast (ki>=20): the opponent is stunned 14 ticks; the blast spawns at +11 and travels (d-40)/13 ticks → for d=200, hits at +23 → the opponent recovered at +14 → they can block/dodge. Not worth it. → 'idle'.

  Beam cancel: if ki >= 50 and d > 140 (we can't heavy) and the opponent is stunned for 14 ticks (not enough for a 30 startup) → risky. Skip beams in cancel. Actually there's one case: if the opponent is in 'crushed' (34 ticks) or 'blockstun' (14) ... only crushed gives 34. If op.state === 'crushed' and op.left >= 30 and ki >= 50 → beam (280*0.8 = 224 damage!). Hmm, but the scale: after our light hit, combo=1 → the beam hit would be scale combo[1]=0.8 → 224. That's better than heavy 96! But the beam's startup is 30 ticks and the crushed stun is 34 → the beam fires at +30, the opponent recovers at +34 → 4 ticks of vulnerability → they could dodge/interrupt (they'd need 5 ticks for a light → marginal). And the beam fires for 40 ticks → it would hit them when they're up ✓ (they're in the ray → 224 damage).
  Risky but high reward. Let's include it with a condition: op.state === 'crushed' && op.left >= 32 && ki >= 50 → 'beam'. Hmm, but if they dash forward through us during our startup (10 ki) they escape. Eh. It's a rare scenario. Let's include it but require op.ki < 30 (they can't dash).

OK. Now the free-state logic in detail. Let me write the code.

```js
function pickFree(s) {
  const R = RULES, me = s.me, op = s.opp;
  const d = s.dist;
  const myKi = me.ki, opKi = op.ki;

  // ---- helpers
  const oppFree = op.free;
  const oppStunned = op.state === 'hitstun' || op.state === 'blockstun' || op.state === 'crushed';
  const oppDown = op.state === 'down';
  const oppCommitted = !oppFree && !oppStunned && !oppDown && op.state !== 'ko';
  // committed states: light/heavy/blast/beam/dash/recover
  const oppMoveState = op.state;

  // 1) incoming blast
  const inc = s.blasts.find(b => b.incoming);
  if (inc && inc.eta <= 20) {
    if (myKi >= 10) return 'dash_forward';   // cross it
    return 'guard';
  }
```
Hmm, careful: dash_forward when the blast is incoming — but what if the opponent is right in front of us (d=60) and the blast is 5 ticks away? We'd cross the blast and land 60 in front or behind them ✓.

But hmm, one risk: dash_forward's landing could put us right next to them, and their light could hit us during the dash recovery. Acceptable.

Another risk: if myKi < 10 → guard. OK.

Also: what if the incoming blast's eta is large (>20)? We continue with normal logic and re-evaluate in 6 ticks.

```
  // 2) opponent beam startup -> interrupt
  if (op.state === 'beam' && op.phase === 'startup') {
    if (d <= 140) return 'heavy';                 // interrupt, 150 dmg
    if (myKi >= 20 && d <= 240) return 'blast';    // interrupt via projectile
    if (myKi >= 10) return 'dash_forward';        // close in
    return 'guard';
  }
```
Wait, but if we 'blast' and the opponent is close to us (d=200), the blast travels 160/13 = 12 ticks + 11 startup = 23 < 30 ✓ interrupts. But the opponent might block the blast (12 chip) — they can only block if they're free; they're in beam startup (not free) → they can't block! Actually they could... no, they're committed to the beam startup; they can't switch to guard. So the blast hits them for the full 70*1.25 (counter: they're in startup → 1.25) = 87 ✓ and interrupts the beam. 

And 'heavy' at d <= 140: 120*1.25 = 150 ✓ interrupts.

But hold on: if the opponent is in beam startup, they might have set up the beam to fire when we're close. If we're close (d <= 140) and we heavy → interrupt ✓ good.

Also, what if our heavy misses because they're at d=140 exactly... reach 140 inclusive ✓.

3) opponent charging:
```
  if (op.state === 'charge') {
    if (d <= 140) return 'heavy';      // 180 damage
    if (myKi >= 20 && d <= 240) return 'blast';  // 105
    return 'forward';  // close in (they're charging, so they can't hit us)
  }
```
Hmm, if they're charging and far, approaching is fine (they can't attack while charging, but they can switch). Also if myKi < 50 and they're charging, maybe I should also charge? No, one action at a time. Let's: if op is charging and d > 240 → forward (approach) unless my ki is low and I want a beam... let's keep forward.

Hmm, but if the opponent is charging and I'm at d=200 with ki=60, maybe beam them (280*1.5=420)! The charge hit multiplier 1.5 applies if they're charging when hit. If they stop charging to dodge, we lose 50 ki. Hmm, tempting. But they can also just... they can't block (they'd need to switch to guard, which takes a decision, and blocking a beam = 120 chip + stun). Actually switching to guard is a great response to a beam (120 chip damage, 46 stun). So the opponent charging → we beam → they guard → they take 120 and are stunned. That's still good for us (120 damage + free time). Or they dash (10 ki) → dodge. Hmm.
Let's include: if op is charging && d > 140 && myKi >= 50 && d >= 160 → beam. Risk: 50 ki. Alternatively blast (105 dmg guaranteed if they stay charging).
I'll prefer blast for the charging case (cheaper, 105 damage) and beam only in better circumstances. Actually, hmm: blast requires ki >= 20 and the travel time must be within their charge window (they'll stop charging when the blast is close enough to block, or when it hits). Meh, let's use blast.

4) opponent committed to a move that threatens us:
   - op.state === 'light' && op.phase === 'startup' (or active): their light will hit if d <= 110 (reach). If d <= 110 → they're about to hit us: options: dash_forward through them (dodge + behind), guard (block), or trade.
     - dash_forward: we cross them; their light then has d < 0 → misses ✓ (their strike check: d = (op.x - my.x)*op.facing; if I'm behind them, d < 0 → no hit ✓). Requires ki >= 10.
     - guard: blocks the light (no damage, they get blockstun 11, push 14).
     - Both are fine. Guard is free (no ki). Dash gives a better position (behind them, and we're not in blockstun).
     Let me prefer dash_forward if ki >= 10, else guard. But careful: if we're at the wall behind them... whatever.
     Hmm, also: their light might not reach us if d > 110 — then no threat.
   - op.state === 'heavy' && op.phase === 'startup' && d <= 140: same → dash_forward through them (their heavy whiffs since d<0) or dash_back (d+200 > 140 → whiff) or guard (crush: -60hp, we get stunned 34).
     Prefer dash_forward (dodge + position) if possible; else dash_back if ki >= 20 and d+200 > 140 (always true unless we're at the wall); else guard.
     Hmm, if we dash back and they're at d=60, we go to d=260 (if there's room) → their heavy (reach 140) misses ✓.
   - op.state === 'blast' && phase startup: their blast is coming (11 ticks) → we'll see it in s.blasts later; our incoming blast check will catch it (the blast appears when the startup ends). Hmm, the blast appears in the blasts array at the end of their startup (11 ticks). We get decisions every 6 ticks, so we might not react in time... Actually we'd see the blast when it's spawned and then react (eta ~ up to 30). If the blast spawns right after our decision, we have 6 ticks before the next decision → the blast travels 13*6 = 78 units → eta ~ 6-12 when we decide → we can dash_forward ✓. Probably OK. But also: during their blast startup, we could punish with a heavy (150 dmg) if in reach.
     Priority: if op is in blast startup and d <= 140 → heavy (punish, they can't block) — but their blast will still fly and hit us! The blast spawns at their startup end (11 ticks) and travels. Our heavy hits at +9 → they get hitstun 15 → their blast is interrupted? Being hit during a blast startup cancels the blast (state changes to hitstun) ✓ so the blast never spawns! Great: heavy during their blast startup = 150 damage and no incoming blast.
   - op.state === 'dash': they're dashing (invulnerable). If they're dashing toward us, they might land close and then hit us. We could wait. Their dash recovery (8 ticks) is punishable: counter 1.25.
     If op.state === 'dash' && op.phase === 'recovery' (they finished the dash) → they're vulnerable: punish with heavy if in reach ✓.
   - op.state === 'recover' (post-clash) → vulnerable: punish.

5) opponent free (idle/forward/back/guard):
   - if op.state === 'guard':
     - if d <= 140 → heavy (crush: they take 60, stun 34) ✓
     - else → approach (forward) or charge.
   - else (idle/forward/back):
     - if d <= 110 → light (start the chain) — but check the distance for the chain: ideally d <= 82 for a 3-chain. But let's just light; the cancel logic adapts.
       Hmm, but if d <= 110 and d > 82, the chain will be: light (hit, push to d+14 > 96) → cancel: d+14 <= 110? If d=90 → 104 <= 110 → light again → push to 118 → then heavy (118 <= 140 ✓). Total 40+32+96 = 168? Let me recompute: hit1 40 (scale 1), hit2 32 (0.8), hit3 heavy 120*0.65 = 78 → total 150 ✓.
     - else (d > 110) → approach: forward. Or dash_forward if d > 220 and ki >= 30? Let's consider: dash_forward 200 in 10 ticks then recovery 8 → then we're free and can attack. It gets us close fast. Risk: they hit us during the dash recovery. I'd use dash_forward when d >= 200 and ki >= 30 (we have ki to spare) — hmm, but 10 ki is also needed for beams. Let's use dash_forward when d >= 230.
     - Also, if the opponent is idle/forward and we have low ki and they're far → charge (build ki). Charging when the opponent is far is safe. Condition: myKi < 50 && d > 180 → charge? But then they close in and hit us for 1.5× damage. Hmm. Charging gives 0.36/tick (0.04 passive + 0.32) → 100 ki in 278 ticks (4.6s).
       Alternatively, at low ki we should just fight with lights/heavies (free) and blasts (20 ki).
       Let's charge when: myKi < 45 && d >= 170 && the opponent isn't about to hit us (they're far so their light can't reach) ✓.
     Also: if the opponent is far and we're at high ki (>= 50) → maybe beam them. Let's handle in a "beam opportunity" check.

Let me organize the beam opportunity check (before the generic approach):
```
  // beam opportunity
  if (myKi >= 50) {
    const helplessLong = (op.state === 'crushed' && op.left >= 32) || (op.state === 'blockstun' && op.left >= 32) || (op.state === 'down' && op.left >= 34);
    if (helplessLong) return 'beam';
    if (d >= 240 && opKi < 25 && !oppCommitted) return 'beam';
  }
```
Hmm, for the 'down' case: they're invulnerable while down; the beam fires at +30 and the down ends at +34 → they stand with the beam's front somewhere. If the beam's front hasn't reached them yet, they might dodge. The beam's front advances 30/tick from our position. If d=200, the front reaches them at (200-40)/30 ≈ 5.3 ticks after firing → at +35 (they stand at +34) → they'd need to react within 1 tick → unlikely → they get hit ✓ (280 damage!). Nice combo. But if d is small (60), the front reaches them at ~1 tick after firing (+31) but they're still down (until +34) → the beam passes over them? The beam hits a body covered by the ray: if they're down and invulnerable, `invuln(R,o)` → skip (dodge) and b.hit stays false → when they stand at +34, the beam's front is at 40 + 30*4 = 160 → past them (d=60) → they're behind the front → not in the ray → no hit. Hmm! So the beam only hits them if they're still in front of the front when they stand.
  So for the 'down' case, we want them to stand up in front of the beam's front → the front must travel beyond their position before they stand: the front reaches their position at (d-40)/30 ticks after firing. They stand at +34. So if (d-40)/30 > 4 → d > 160 → the front hasn't reached them when they stand → then they get hit when the front sweeps over them (as long as they don't dash) ✓. So for a down opponent, d > 160 is good.
  This is getting really detailed. Let me simplify: use the beam when the opponent is helpless long AND d >= 120, else don't.

  Also, for the 'crushed' case: same logic but they have 34 ticks; the beam fires at +30 → 4 ticks of them being free. If d >= 160, the front reaches them later → they get swept ✓.

  I'll use: helplessLong && d >= 130 → beam.

  And the far case: d >= 240 && opKi < 25 → beam (they can't dash to interrupt; they could walk in: 240-110 = 130 units = 29 ticks + 5 = 34 > 30 ✓ they can't interrupt in time!). But they could dash (10 ki) — opKi < 25 means they could still dash once (10 ki). Hmm, then dash (10 ticks) + light (5) = 15 < 30 → they CAN interrupt. So require opKi < 10 for safety. Or just require d >= 300: they'd need to close 190 units = 42 ticks > 30 ✓ no interrupt without a dash. But the beam's front sweeps toward them anyway. So at d >= 300 the beam is basically safe (they must dash forward through us to dodge, which they might).
  Let's set: d >= 280 && opKi < 30 → beam. Reasonably safe.

  Hmm, and the beam also gets blocked (120 chip) — fine.

6) Attack with blast when the distance is medium and the opponent is free: blast (70 dmg) vs walking in. Walking in (forward) gets us to melee where we do more damage. But walking in takes time and they might hit us. A blast at d=150-400 while they approach... Let's use the blast when: myKi >= 20 && d >= 130 && d <= 400 && the opponent is free and not close. Hmm, but each blast costs 20 ki. Alternatively charge.

Honestly, a simple and effective approach: prioritize closing distance and melee combos, use the beam at good opportunities, use the blast to interrupt beams or punish chargers at range.

Let me also handle: the opponent is at the wall (cornered) → good for chains (the pushes don't increase the distance). Not needed explicitly.

Let me also handle the case where the opponent is 'down' (invulnerable): we can't hit them. So: if op.state === 'down' → we should reposition: close the distance (forward) if far, or charge ki, or beam (see above). Also don't waste attacks.

Also: if op is 'down' and d is small, we could... just wait/charge. Let's: if op is down → if myKi < 50 → charge (they'll get up in up to 42 ticks; charging is safe-ish since they can't hit us while down but they can right after standing → 1.5× damage. Hmm.) Let's: if op is down: if d >= 130 and myKi >= 50 → beam (if the down has enough time left); else if d > 110 → forward (close in for when they get up); else → charge if myKi < 60 else idle (wait).

Hmm, charging while they're down: they get up and hit us for 1.5×. But we need ki. Let's charge only if myKi < 40.

OK, let me now also think about the "back" action: rarely useful. Use it when we're in a bad position (e.g., we need to escape a beam). dash_back is better.

Let me write the final code with a clear structure. I'll also add a few defensive behaviors:
- If me.hp is low (< 200) and the opponent is close and free → prefer guard/back over attacking? Actually being desperate, attacking is fine since a trade helps us (they might have low hp too). Let's not overcomplicate.

Time-based: if timeLeft < 300 (5s) and hpLead > 100 → defensive: prefer guard/back, avoid dashes (ki) and beams? Hmm, if we're ahead on HP, we want to preserve. Let's implement: if timeLeft < 400 && hpLead > 120 → 'guard' if the opponent is close, else 'back' (keep distance). That could throw away a win, but it's a reasonable risk-free strategy. Hmm, but the opponent might also be trying to survive on time; if we just guard, the draw... Let me implement a mild version: if timeLeft < 500 && hpLead > 150 → prefer 'back'/'guard' over attacking (avoid taking damage). But if the opponent is helpless (stunned), attack (free damage).

Actually, hmm: with hpLead > 150 and 8 seconds left, just guarding is likely to win (we only need to not get hit). But the opponent might catch us with a heavy (120 < 150 lead) or a beam (280). Guarding blocks beams (120 chip) and lights. So guard is decent.

Let me implement it as: defensiveMode = (timeLeft < 600 && hpLead > 150). In defensive mode, if the opponent is helpless → attack; else if d <= 140 → guard; else → back (maintain distance) — hmm, backing away from the wall... 'back' walks away from the opponent; if we're at the wall it does nothing. Use 'idle' instead? Let's use 'back' (it at least tries to keep distance).

Hmm, but if the opponent is charging in defensive mode, we should probably still let them come and then guard. 'back' is fine.

OK, now let me write the code. I'll be careful with the rules' numbers via RULES.

One more thing: the time budget. Our decide function must be fast (< 200ms per call, 1500ms per match). Our function is O(1)-ish with a few loops ✓.

Let me write the code:

```js
// AI 武道会 选手：极·北斗
const R = RULES;

function decide(state) {
  try {
    const s = state;
    const me = s.me, op = s.opp;
    if (!me) return 'idle';

    // ---- 对冲
    if (s.clash) return clashPick(s);
    // ---- 连招窗口
    if (me.canCancel) return cancelPick(s);
    return freePick(s);
  } catch (e) {
    return 'idle';
  }
}
```

Now the helper functions.

```js
function basePower(ki, hp) {
  const C = R.clash;
  let p = ki > 0 ? C.base + C.kiPower * ki : C.empty;
  if (hp < C.rageHp * R.hp) p += C.rage;
  return p;
}

function clashPick(s) {
  const me = s.me, op = s.opp;
  const myBase = basePower(me.ki, me.hp);
  const opBase = basePower(op.ki, op.hp);
  if (me.ki > 22 && myBase + R.clash.pushPower > opBase + 0.05) return 'push';
  return 'idle';
}
```
Hmm: if my ki is high and my base is much higher than theirs, pushing still helps. But pushing drains ki: over the remaining clash, my ki decreases 0.8/tick vs 0.2/tick for them. If my ki is 80, I can push for 100 ticks. Each push decision covers 6 ticks.

Let me refine: push if me.ki > 25 && (myBase + 0.6) > opBase. Also if my ki is very low but my base is still higher, pushing is bad (drains fast). Condition me.ki > 25 handles it.

Hmm, one thing: the opponent also pushes. If the opponent pushes and my base is much higher, I don't need to push (the drift is already toward them). But the drift is slow. Pushing increases the drift. Since my power is higher, the drift is toward them anyway; pushing adds +0.6 to my power, increasing the drift. But it costs ki. If my ki is plentiful (say 90) and the clash will last 100 ticks, pushing costs 80 ki total → my ki drops to 10 → my power collapses. Hmm. Let's compute more carefully.

Suppose my ki = 90, op ki = 50. My base = 2.8, op base = 2.0. Without pushing: both drain 0.2/tick → after 200 ticks: mine 50 (base 2.0), theirs 10 (base 1.2). The difference stays ~0.8 → the drift velocity steady = 0.8*0.1/0.05 = 1.6 units/tick → over 200 ticks, ~320 units → likely wins. So I don't need to push! Pushing would burn my ki to 0 in 112 ticks → my power → 0.5 → disaster.

So: only push if my base is NOT clearly ahead, i.e., if the opponent's push would flip the comparison. If my base > op base + 0.6, pushing is unnecessary (and harmful). Condition: push if me.ki > 25 && myBase + 0.6 > opBase && myBase < opBase + 0.5 (i.e., I'd need the push to win) — hmm, that's roughly the same as myBase + 0.6 > opBase and myBase <= opBase + 0.5.

Let me think again: pushing is good when it increases my relative power without killing my ki. The relative drift rate = (myPower - opPower)*0.1 (per tick, in the direction toward the weaker). My power with push = myBase + 0.6, and my ki drains 0.8/tick; op drains 0.2/tick (or 0.8 if they push).
Push when: (myBase + 0.6 - opBase) > 0 AND the expected clash duration is short enough that my ki won't run out. Since I don't know the duration, use: push if me.ki > 30 && myBase + 0.6 > opBase + 0.1. And stop pushing when me.ki < 30.

Hmm, but the "my ki runs out" risk: if my ki is 40 and I push, after 50 ticks my ki = 0 → power 0.5 → likely lose. But if I don't push and the opponent has a higher power, I lose anyway. With my ki 40 (base 1.8) vs their ki 50 (base 2.0): without pushing, my power < theirs → the drift is toward me → I lose (unless noise saves me). With pushing, I get +0.6 → 2.4 vs 2.0 → I win the drift but my ki runs out in 50 ticks → then my power = 0.5 vs theirs (50-10=40 ki → 1.8) → I lose. Hmm, so with a long clash, pushing is bad. But the clash ends when the point reaches a body: with a drift of 0.4 power diff → velocity 0.4*0.1/0.05 = 0.8 units/tick → over 50 ticks → 40 units. The bodies are ~100-300 apart → 40 units isn't enough to reach a body. So the clash would continue to 360 ticks (max) → then both take 120 damage and get knocked down. Hmm, so a clash that doesn't resolve quickly is a "draw" (both take 120).

So the real goal: win the clash quickly (before ki runs out) or at least not lose. The position needs to travel from the midpoint to within 30 of a body → ~ (dist/2 - 30) units. With dist=200 → 70 units → at 0.8 units/tick → 87 ticks. My ki with pushing: 40 - 87*0.8 = negative at ~50 ticks. Hmm.

So pushing is only good when the power difference is large enough to resolve the clash quickly. If my base is much higher (e.g., 2.8 vs 2.0), the drift is 1.6 units/tick → 70 units in 44 ticks ✓ and my ki (90) survives (90-9 = 81). Fine without pushing.

So the rule: push only when my base is not comfortably ahead: (myBase - opBase) < 0.5 and (myBase + 0.6 > opBase). Hmm, but if myBase < opBase, pushing gives me the edge temporarily but burns ki. If opBase - myBase > 0.6, pushing can't even catch up → don't push.

Let me define: gap = opBase - myBase. Push if gap < 0.6 && gap > -0.4 (i.e., I'm behind by less than 0.6 but not far ahead) and me.ki > 30. Hmm, if gap < -0.4 (I'm ahead by 0.4+), don't push (conserving ki is better since the drift already favors me).

Hmm, but is that right? If I'm ahead by 0.4 and the clash is long, my advantage drifts the point toward them at 0.8 units/tick. Pushing would make it 2.0 units/tick (gap becomes -1.0) → 2.5x faster resolution, at the cost of 4x the ki drain. With ki 90: without push, 90/0.2 = 450 ticks of ki; with push, 90/0.8 = 112 ticks. Resolution time without push: 70 units / 0.8 = 87 ticks (needs 87*0.2 = 17 ki ✓ affordable). With push: 70/2.0 = 35 ticks (needs 28 ki ✓ affordable). Both work. So pushing isn't needed if the drift alone resolves it in time.

The real risk: the opponent pushes, gaining +0.6 and making their power higher → the drift reverses → I lose. If I don't push back, the opponent's power advantage grows. So I should counter-push when they push.

I can detect whether the opponent is pushing: opPower = basePower(op.ki, op.hp) + (0.6 if pushing). I can't see their push flag directly, but I can infer: opPower - basePower(op.ki,op.hp) ≈ 0.6 → they're pushing. Note the view rounds to 2 decimals. So: oppPushing = (opPower - opBase) > 0.3.

So: if the opponent is pushing and their effective power > my effective power, I should push too (if I can afford it). Let's implement:

```
const oppPushing = (s.clash.oppPower - opBase) > 0.25;
const myPushing = (s.clash.myPower - myBase) > 0.25;
let wantPush = false;
if (oppPushing) {
   // counter-push if we'd otherwise be weaker
   wantPush = me.ki > 30 && (myBase + 0.6) >= opBase + 0.6 - 0.1 ... 
```
Hmm, getting complicated. Let me simplify: push if (myBase + 0.6 > opPower + 0.05) && me.ki > 30, where opPower is their current effective power (including their push). If they're pushing and I'm not, myBase + 0.6 vs opBase + 0.6 → myBase > opBase → I'd push if my ki > 30 (fine, countering). But if my ki is low, I don't push and might lose.

Also: if they're not pushing and my base is way ahead, myBase + 0.6 > opPower → I'd push (wasteful). Add: only push if myBase < opPower + 0.4 (I'm not comfortably ahead) OR oppPushing.

Final rule:
```
const opEff = s.clash.oppPower;      // includes their push
const myBase = basePower(me.ki, me.hp);
const oppPushing = opEff > basePower(op.ki, op.hp) + 0.25;
if (me.ki > 30 && (oppPushing || myBase < opEff + 0.4)) {
   if (myBase + 0.6 > opEff + 0.05) return 'push';
}
return 'idle';
```
Hmm, if I'm way ahead (myBase 2.8 vs opEff 2.0) and they're not pushing → myBase < opEff+0.4? 2.8 < 2.4? No → don't push ✓.
If I'm behind (myBase 1.6, opEff 2.0) and they're not pushing → 1.6 < 2.4 ✓ → check myBase+0.6 = 2.2 > 2.05 ✓ → push ✓.
If they're pushing (opEff = 2.6) and my base is 2.0 → oppPushing ✓ → myBase+0.6 = 2.6 > 2.65? No → don't push. Hmm, but if I don't push, I'm at 2.0 vs their 2.6 → they win the drift. Should I push? With the push, my effective = 2.6 = theirs → neutral drift → the noise decides. That's better than being at 2.0. So the condition should be >= rather than >: myBase + 0.6 >= opEff → push (at least match). But if they're pushing and my ki is low, matching is still better than losing. Let me use: if (myBase + 0.6 >= opEff - 0.05) → push.

And the ki constraint: pushing drains 0.8/tick. If my ki is 30, I can push for 37 ticks. If the clash resolves faster, fine. Let's require me.ki > 25.

Also: if my ki is very low (< 10) and they're not pushing, don't push (I'd go to 0 → power 0.5, worse than 1.0+). Actually if ki is 5, my power = 1.1; pushing makes it 1.7 for a few ticks then ki=0 → 0.5. Meh. Require ki > 25 ✓.

OK, that's reasonable.

Now, cancelPick:

```js
function cancelPick(s) {
  const R = RULES, me = s.me, op = s.opp, d = s.dist;
  const chain = me.chain;      // lights already used in this string
  // the opponent should be in stun; check
  if (op.state === 'crushed' && op.left >= 30 && me.ki >= 50 && d >= 130) return 'beam';
  if (chain < 3 && d <= R.light.reach) return 'light';
  if (d <= R.heavy.reach) return 'heavy';
  if (me.ki >= 20 && d > R.heavy.reach) {
     // blast: they are stunned, the projectile may connect
     ...
  }
  return 'idle';
}
```
Hmm, for the beam cancel: the scale would be combo[op.combo]. The beam damage 280 * 0.8 = 224 — the best option. But the risk: 50 ki and the 30-tick startup. Conditions: op is 'crushed' (34 ticks) with left >= 30 ✓, ki >= 50, and the distance such that the beam's front sweeps them after they recover (d >= 130). Also they might dash (if op.ki >= 10). Add: op.ki < 20.

Hmm, also for the 'light' continuation: should I chain a light when the opponent is in 'crushed'? Yes, same logic.

Wait, one important check: is the opponent guaranteed to be stunned at the cancel? If our light hit them, yes → hitstun 15. But if the light hit them while they were already in hitstun... same. OK.

But hmm, there's a subtlety: op.combo tells us the number of hits they've taken. The scale for our next hit = R.combo[min(op.combo, 5)]. If op.combo is large (say 4), the scale is 0.45 → light 18, heavy 54. Then heavy is still better.

Let me reconsider the chain plan with the scale in mind: light then heavy vs heavy directly:
- Heavy now: 120 * s where s = combo[op.combo].
- Light then heavy: 40*s + 120*combo[op.combo+1].
  With s = combo[1] = 0.8: 32 + 120*0.65 = 32+78 = 110 > 96 ✓.
  With s = combo[3] = 0.55: 22 + 120*0.45 = 22+54 = 76 vs 66 ✓ (light then heavy still better).
  With s = combo[5] = 0.4: 16 + 48 = 64 vs 48 ✓.
  So chaining one light before the heavy is always better in raw damage (as long as the light lands). Chaining 2 lights: 40*s + 40*combo[c+1] + 120*combo[c+2] → with s=0.8: 32+26+66 = 124 > 110 ✓. With s=0.4: 16+16+48 = 80 > 64 ✓.
  So more lights are better (diminishing). But each light pushes them 14 away and takes 5 ticks.
  The limit: 4 lights max (chain). Also the distance: we need each light to reach.
  Also the risk: if the opponent recovers from the stun before our next hit lands, they might block. Let's verify the timing: our light hits at t=0 → their hitstun 15 (until t=15). Our cancel decision at t=1 → the next light's startup 5 → hits at t=6 ✓ (within 15) → refreshes hitstun to 15 (until t=21). Next cancel at t=7 → light hits at t=12 ✓ (refresh until 27). Next cancel at t=13 → heavy (startup 9) hits at t=22 ✓ (within 27) ✓.
  So 3 lights + heavy works if the distances allow: light1 at d, light2 at d+14, light3 at d+28 (each must be <= 110), heavy at d+42 (<= 140).
  So for the full 3-light chain: d <= 68 for light3 (d+28 <= 110 → d <= 82; hmm: light3 is thrown when d2 = d+14 <= 110 → d <= 96; the hit lands at d+14 <= 110 → so light3 lands if d+14 <= 110 → d <= 96). Let me redo:
   - light1 thrown at d0, hits (d0 <= 110). After the hit, they get pushed → d1 = d0 + 14.
   - light2 thrown at d1, hits if d1 <= 110 → d0 <= 96.
   - light3 thrown at d2 = d0+28, hits if d0+28 <= 110 → d0 <= 82.
   - heavy thrown at d3 = d0+42, hits if <= 140 → d0 <= 98.
  So for a full 3-light + heavy chain: d0 <= 82. For 2 lights + heavy: d0 <= 96. For 1 light + heavy: d0 <= 110 (since the heavy is thrown at d0+14 <= 140 → d0 <= 126).
  
  So the cancel logic should be: at the cancel, the current distance d (= d0+14 after the first light). If d <= 110-14 = 96 → we can chain another light and still have the heavy land (d+14 <= 110 ✓ and d+28 <= 140 ✓). So: if chain < 3 && d <= 96 → light; else if d <= 140 → heavy.
  
  Hmm, but the pushes depend on whether they're at the wall (pushApart: if the opponent is against the wall, the attacker slides back → the distance is preserved). So the distance may not grow. Using the current d at each decision handles it: at each cancel, check if the next light will land (d <= 110) and if the heavy after that will land (d + 14 <= 140). So the rule "if chain < 3 && d <= 96 → light" is conservative but fine. Actually if d <= 96, chaining a light then a heavy: light lands (d <= 110 ✓), then the heavy is thrown at d+14 <= 110 <= 140 ✓. Good. If d is in (96, 110], chain a light then heavy: the light lands, d becomes d+14 <= 124, the heavy lands ✓. So we could chain whenever d <= 110. Let me use: if chain < 3 && d <= 110 → light (the light lands; then the heavy will be at d+14 <= 124 <= 140 ✓).
  But careful: if the light is thrown at d=110 and the opponent is at the wall... fine.
  Also: if d > 110 (the light wouldn't land) → we must heavy (if d <= 140) → the heavy lands ✓. But wait, if d > 110 and we cancel into a heavy, the heavy lands (reach 140) ✓.
  
  Hmm, but there's a subtlety: cancel into a light that MISSES (d > 110) wastes the combo. So the rule stands.

  Let me also consider: is the heavy always better than ending the string? E.g., if chain=3 and d=100 → heavy (d <= 140 ✓).

  One more: the "idle" fallback (no cancel) lets the light's recovery finish (9 ticks) and then we're free.

Now freePick. Let me write it.

```js
function freePick(s) {
  const R = RULES, me = s.me, op = s.opp, d = s.dist;
  const myKi = me.ki, opKi = op.ki;
  const hpLead = me.hp - op.hp;

  const oppFree = op.free;
  const oppStun = op.state === 'hitstun' || op.state === 'blockstun' || op.state === 'crushed';
  const oppDown = op.state === 'down';
  const oppCommitted = !oppFree && !oppStun && !oppDown;   // in a move (startup/active/recovery) or recover
  const defensive = s.timeLeft < 600 && hpLead > 150;

  // ---- incoming blast
  const inc = firstIncoming(s);
  if (inc !== null && inc <= 20) {
    if (myKi >= 10) return 'dash_forward';
    return 'guard';
  }
```
Hmm wait, there's an issue with dash_forward to dodge a blast: the crossing time must be <= 9 ticks (the invuln window). The gap to the blast: the blast is at x with dir; gap = (me.x - b.x)*dir (positive if it's on its way to me). eta = ceil((gap - 30)/13). So gap ≈ eta*13 + 30. The crossing time when dashing forward (toward the opponent): the blast is approaching me at 13/tick and I approach it at 20/tick → closing 33/tick → t = gap/33. For eta=20: gap = 290 → t = 8.8 ✓ (just under 9). For eta=21: gap = 303 → 9.2 ✗. So the eta <= 20 threshold is right (t <= 8.8 < 9 ✓). 

But hmm, there's a catch: the dash might end early? No, the dash moves over 10 ticks. Also, if I'm at the wall (can't move forward), the dash doesn't move me → the blast hits me. E.g., the opponent is between me and the wall? No: the blast comes from the opponent's side; if I'm at the wall (x=40) and the opponent is at x=200, dashing forward moves me toward the opponent ✓ (the wall is behind me). The dash moves me toward the opponent, so it works unless the opponent is right next to me (d=60) — then the crossing happens quickly ✓ (t = gap/33 where gap = d-40+... small ✓).

Also careful: dash_forward with d < 60 → dashEnd handles the min gap.

But wait — there's a subtle issue with dash_forward crossing the blast: the blast's hit check requires the blast to cross my position. If I move toward the blast, the blast and I approach each other; the check `(o.x - b.px)*(o.x - b.x) > 0` → continue means "the target is not between the blast's old and new positions" → skip. When we cross, the target IS between → hit → but invulnerable → dodge ✓.

Good.

But there's a risk: what if the opponent is close (d=60) and the blast is 30 units from me (eta=1)? Dashing forward: I cross it in ~1 tick ✓.

And what if my ki is exactly 10? dash costs 10 → allowed if ki >= cost ✓ (the engine checks a.ki < cost → invalid; ki >= 10 ✓).

```
  // ---- opponent's beam startup: interrupt
  if (op.state === 'beam' && op.phase === 'startup') {
    if (d <= R.heavy.reach) return 'heavy';
    if (myKi >= R.blast.cost && d <= 250) return 'blast';
    if (myKi >= R.dash.cost) return 'dash_forward';
    return 'guard';
  }
```
Hmm, the blast's travel: it spawns at our position + facing*40 and travels at 13/tick. The opponent is at distance d. The travel time = (d - 40)/13 (if the opponent is in front). The blast's startup = 11. Total = 11 + (d-40)/13. To land within their 30-tick beam startup: 11 + (d-40)/13 <= 30 → (d-40)/13 <= 19 → d <= 287. So d <= 280 ✓ (with a margin).
But also, their beam might already be past the startup (op.t large) — then the blast won't land in time. Check: the remaining startup = 30 - op.t. We need 11 + (d-40)/13 <= 30 - op.t. If not, the blast won't interrupt. Then maybe use a dash to close, or just guard and accept the beam (or dodge behind them!). 

Dodging behind them: dash_forward lands behind them (if there's room) → their beam fires away from us ✓. That's the escape. So: if we can't interrupt, try to get behind them: dash_forward (if there's room behind them). We can compute dashForwardEnd to check if it lands behind.

Let me implement a helper `dashForwardLandsBehind(me, op)`: compute the landing x; check if it's beyond the opponent (on the far side): (landing - op.x) * me.facing > 0.

So the beam-startup branch:
```
    const rem = R.beam.startup - op.t;   // ticks until it fires
    if (d <= R.heavy.reach) return 'heavy';   // interrupt
    if (myKi >= R.blast.cost && 11 + Math.max(0,(d-40)/13) <= rem) return 'blast';
    if (myKi >= R.dash.cost && dashLandsBehind(me,op)) return 'dash_forward';  // dodge
    // else: guard and hope, or beam ourselves? 
    return 'guard';
```
Hmm, if we can't interrupt and can't dodge behind, the beam will hit us (280 damage!). Guarding → 120 chip + 46 stun. That's the least-bad. Alternatively dash_back to... no, the beam sweeps the whole stage in their direction. Hmm, but wait: the beam's front starts at their position and advances 30/tick for 40 ticks → 1200 units → it covers everything from them forward. If we're in front of them, we're in the ray regardless of the distance. So we must get behind them or interrupt. If we can't → we eat it (guard for 120 chip).

Actually, could we dash forward through them and then... if there's no room behind them, dashEnd stops us in front (at minGap 60) → still in the ray. Hmm.

Wait, actually there's another thought: if we dash forward through them and land behind, but they fire the beam with dir = their facing at that moment. Their facing was set when they became free or when they started the move. They started the beam facing us (the old direction). If we land behind them, the beam fires in the old direction = away from us ✓ SAFE.

But hmm, "对手空闲的话会立刻转身" — they're in the beam startup (not free) → they don't turn ✓.

But there's a subtlety: if we dash through them BEFORE they fire, their facing is unchanged ✓. If we dash through them after they fire, the beam's dir is fixed at the firing moment ✓ (the dir is captured at the fire event: `m.beams[a.side] = {owner, dir: a.facing, ...}`) → it keeps the original dir ✓. So even if they turn later (they can't while not free), the beam keeps its dir.

So the dash-behind trick works whenever there's room behind them. 

Another important note: this same trick applies when they fire a beam at us while we're at a distance — we should dash forward through them to get behind. But the beam's front advances 30/tick and our dash moves 20/tick → we'd cross the beam's front?? The beam's ray covers from the shooter to the front; if we're in front of the shooter, we're in the ray when the front passes us. If we dash forward (toward them), we approach the shooter and end up behind them → we exit the ray before the front reaches us? The front advances 30/tick toward us; we're moving toward the shooter at 20/tick → we meet the front at gap/50 ticks. Hmm, if the gap is 200: 4 ticks. The beam's front is at our position + 200 initially (moving toward us); we move toward the shooter (opposite to the beam's travel? The beam travels from the shooter toward us, so it moves in our direction of travel... wait.

Let me set up: the opponent is at x=500 facing left (dir=-1), I'm at x=200. The beam fires from x=475 (from = shooter.x + facing*25 = 500-25 = 475) with front = 500-40 = 460, and the front moves in dir=-1 (toward me at 200). The ray covers [front, 475] → i.e., x from 460 down to ... as the front decreases. I'm at 200; the ray reaches me when the front <= 200 → after (460-200)/30 = 8.7 ticks.
If I dash forward (toward the opponent, +1 direction): I move at 20/tick → after 8.7 ticks I'd be at 374 — but the front at that time is at 200 → hmm, we cross: the front moves -30/tick, I move +20/tick → closing 50/tick → we meet after (460-200)/50 = 5.2 ticks at x = 304. At that moment I'm in the ray → the beam hits me (b.hit = true) unless I'm invulnerable. If I started the dash at tick 0, at tick 5.2 I'm still invulnerable (t < 9) ✓ → the beam passes through me (dodge) and continues to the left, while I continue dashing to land behind them (at 500+200 = 700? the dash moves 200 from 200 → 400, hmm: dash_forward from x=200 moves toward the opponent: landing = 400, but dashEnd: the opponent is at 500, before = (500-200)*1 = 300 > 0, after = (500-400)*1 = 100 > 60 → no special case → x = 400. So we land at 400, still in front of them (500) but past the front's position? The front at that time (tick 10) = 460 - 300 = 160 → the ray is [160, 475] → I'm at 400 → INSIDE the ray → the beam hits me again? b.hit was already set? No — the beam hit was dodged (invuln), so b.hit stays false → the beam continues and at some later tick covers my position → hit! Since I'm at 400 and the front moves -30/tick from 160 → it moves away from 400. Hmm, wait: the front decreases from 460 → 430 → 400 (at tick 2) → ... The ray is [front, 475]. At tick 2, the front = 400 → I'm at 240 (moving +20) → the ray [400,475] doesn't cover 240. Hmm, I need to redo this.

I think I mixed up. Let me redo: the front starts at 460 and moves LEFT (decreasing) at 30/tick. The ray = [front, from=475]. I'm at 200, moving RIGHT at 20/tick. Initially the ray [460,475] doesn't cover me. The front reaches 200 at tick (460-200)/30 = 8.7 (if I stood still). But I'm moving right: my position at tick t = 200+20t; the front at tick t = 460-30t. They meet when 200+20t = 460-30t → t = 5.2, at x = 304. At that moment, the ray = [304, 475] and I'm at 304 → I'm at the edge of the ray → inRay(b, o.x, 30): x + pad >= lo && x - pad <= hi → 304+30 >= 304 ✓ and 304-30 <= 475 ✓ → hit! But I'm invulnerable (tick 5.2 < 9) → dodge ✓ (b.hit stays false).
Then I continue: at tick 9.9, my dash ends at x = 200+200 = 400 (dash_dist 200). The front at tick 9.9 = 460-297 = 163 → the ray = [163,475] → I'm at 400 → INSIDE the ray → the beam hits me again! (b.hit is still false since it dodged) → at the next tick after the dash ends, I get hit for 280.

Hmm! So dashing forward through the beam doesn't help unless I land BEHIND the shooter (x > 475). But the dash only moves 200 and the opponent is at 500, so I'd land at 400 (in front). To land behind, I'd need to be within 200 of them... e.g., if I'm at 400 and they're at 500 → dash to 600 → behind them (dashEnd: before = 100, after = (500-600) = -100 <= -60 → behind = 500 + 1*max(60, 100) = 600, within the stage → x = 600 ✓ lands behind).

So the dash-behind trick only works when we're close enough (within ~200 of them) to pass through. OK.

So for a distant beam, the options are: interrupt it (during the startup) or eat it.

Fine. The logic stands: interrupt if possible.

Now, the beam-startup interrupt via heavy: our heavy hits at +9..12 (the startup is 9 + active 4). Their remaining startup = 30 - op.t. If op.t is 25, remaining = 5 → our heavy arrives too late → they fire the beam at +5, and our heavy hits at +9 → we're in the beam's ray? The beam fires at their tick 30 (5 ticks from now) → the front starts at 460 and moves toward us; we'd be hit at... it depends. Our heavy hits them at +9 (during their beam firing) → the beam is interrupted when the shooter is hit ✓ (in beams(), `if (m.beams[a.side] && (a.state !== 'beam' ...)) m.beams[a.side] = null;` → when they're hit, their state becomes hitstun → the beam is cleared ✓). But the beam might hit US before our heavy lands (the beam's front travels 30/tick; if we're at d=100, the front reaches us at ~2-3 ticks after firing → +8) → we get hit for 280 (or blocked: 120 chip) and our heavy might still land (we're in hitstun → our heavy is interrupted! Because being hit sets our state to hitstun → our heavy is cancelled).

Hmm, so if their beam is about to fire and we're in range, we might trade badly. Let's think: if op.t is large (the beam is about to fire) and d is small, we're in the ray → we should have dodged earlier (dash behind) — impossible if too far. Or guard (120 chip). 

So the beam-startup branch should account for the remaining startup:
- If we can interrupt before it fires (our hit lands before their fire time): heavy lands at +9 (from our decision) → we need 9 + 1 <= rem... let me define: the decision happens at tick T; their fire is at tick T + (30 - op.t). Our heavy lands at T+9 (the first active frame) → we interrupt if 9 < 30 - op.t → op.t < 21. Also, being hit by their beam before that: if the beam fires at T+(30-op.t) and the front reaches us at (d-40)/30 ticks after firing, we'd be hit at T + (30-op.t) + (d-40)/30. We need our heavy to land first: 9 < (30-op.t) + (d-40)/30. Since op.t < 21 typically... e.g., op.t=0 → the beam fires at +30, our heavy lands at +9 ✓ way before.
  But if op.t = 25 → the beam fires at +5, the front reaches us at +5 + (d-40)/30. If d=140 → +5+3.3 = 8.3 < 9 → we get hit first! Then our heavy is interrupted (we're in hitstun) and they get the beam.
  In that case: guard (chip 120) or dash behind (if possible). So: if op.t >= 21 → the beam fires soon; if we can dash behind → do it; else guard.
  
Let me structure:
```
if (op.state === 'beam' && op.phase === 'startup') {
   const rem = 30 - op.t;   // ticks until it fires
   const reachBeforeFire = 9 + 1;  // our heavy needs ~9-12 ticks
   if (rem > 12 && d <= 140) return 'heavy';       // we land before it fires
   if (rem > 11 + travel && myKi >= 20) return 'blast';
   if (myKi >= 10 && dashLandsBehind(me,op)) return 'dash_forward';  // dodge
   return 'guard';
}
```
where travel = max(0,(d-40)/13).

Hmm, if rem <= 12 and d <= 140, our heavy might land after the beam fires but before the beam reaches us. E.g., rem=8, d=140: the beam fires at +8, the front reaches us at +8+3.3 = 11.3; our heavy lands at +9-12 → we hit them at +9 (before the beam reaches us at +11.3) → their beam is interrupted ✓ (we hit the shooter → the beam is cleared). So we DO want the heavy even if rem is small, as long as our heavy lands before the beam's front reaches us: 9 < rem + (d-40)/30.
So the condition: d <= 140 && 9 < rem + (d-40)/30 → heavy ✓. Otherwise (the beam would hit us first) → guard or dash behind.

Hmm, but also: if we hit them at +9 and the beam was already fired at +8, the beam object exists; when we hit them, their state → hitstun → the beam is cleared ✓ (the beams() function clears it when the shooter's state isn't 'beam'). But the order within a tick: strikes() runs before beams(). In the tick where we hit them: strikes → they get hitstun; beams() → `if (m.beams[a.side] && (a.state !== 'beam' || ...)) m.beams[a.side] = null;` → cleared before the beam's hit check ✓. 

But careful: the beam's hit check happens in the same beams() call after clearing ✓.

Also note: if the beam's front already reached us in an earlier tick, we'd already be hit.

OK.

Also for the 'blast' interrupt: the blast lands at 11 + travel. We need it to land before the beam fires: 11 + travel < rem. And also before the beam hits us: 11+travel < rem + (d-40)/30 — trivially true.

Now, the "opponent in a committed move threatening us" branch. Let me define it by op.state and op.phase:

- op.state === 'light': 
  - if op.phase === 'startup' or 'active': their light hits if d <= 110 (and their active frame arrives). If d <= 110 → we need to react: options: dash_forward (cross them → their light whiffs since d<0), guard (block), or trade.
    Hmm, actually if we dash forward through them, we're behind them → their light's check: d = (op.x - my.x)*op.facing → if I'm behind, op.facing is still toward me (they're not free → they don't turn!) → op.x - my.x: if I'm behind them, op.x - my.x has the sign such that (op.x - my.x)*op.facing < 0 → d <= 0 → no hit ✓. 
    So dash_forward through them = a free dodge + a position behind them (they can't turn while in their move; when they recover, they turn and we can hit them during their recovery for a 1.25 counter).
    Cost: 10 ki.
    Alternative: guard → blocks the light (no damage), they get blockstun 11, and we're pushed 14 (or they're pushed). Actually blocking a light pushes the blocker 14 (the opponent is pushed 14 away; if they're at the wall, we're pushed back).
    Guard is free (no ki) but we lose 11 ticks of blockstun (we're stunned in blockstun). Hmm, blockstun = we can't act for 11 ticks. And the opponent is also in blockstun 11.
    I prefer dash_forward if ki >= 10 and there's room to pass; else guard.
    Hmm, but wait: dashing forward puts us behind them, and their light whiffs. But then, during their recovery (9 ticks), we could punish: but we're in the dash (10 ticks moving + 8 recovery = 18 ticks) → we can't attack until then. Their light recovery ends at ~17 ticks after the hit... Let me not over-think.
    Actually, alternatively: trade. If both are in range and we also attack, we both take damage. If our light lands first (their light is at startup t=4 → hits in 1 tick; ours takes 5), we'd be hit first. Bad.
    Let's do: if d <= 110 and their light is incoming → dash_forward (ki>=10) else guard.
    Hmm, but if their light is at 'active' (hitting now), it's too late to dodge → the trade happens. Whatever.
- op.state === 'heavy':
  - if op.phase === 'startup' and d <= 140 → their heavy will hit. Options: dash_forward through them (their heavy whiffs, d<0), dash_back (d+200 > 140 → whiff), guard (crush: -60hp, we're stunned 34).
    Prefer dash_forward (if it lands behind them) else dash_back (if ki >= 20 and there's room behind us) else guard.
    Hmm, dash_forward when we're at d=60: we land 60 in front of them (or behind if there's room). If we land in front (no room behind them), their heavy still hits us (d=60 <= 140) but we're invulnerable during the first 9 ticks of the dash — their heavy hits at ~9-13 ticks after their startup (if op.t=0, the active frames are at +9..+12) → we're invulnerable until tick 9 → borderline! If their active frame is at tick 9 and we're at t=9 (invuln requires t < 9) → we get hit. Hmm.
    Alternatively dash_back: 200 back → d=260 → their heavy whiffs ✓ (if there's room behind us; if we're at the wall, d stays 60 → it hits; but then guard).
    I'd say: dash_back is the reliable dodge for a heavy (as long as there's room). But it costs 10 ki and puts us far away.
    Hmm, what about guard? -60 hp, 34 ticks stunned. That's actually not terrible, and their heavy is wasted (120 potential) plus they're... wait, no: when we guard and they heavy, WE are stunned 34 (crushed) and they continue (they're in recovery). So we lose 34 ticks of agency and 60 hp.
    Compare dash_back: -10 ki, 18 ticks of dash/recovery, no hp loss, and we end up at d=260 (far).
    Hmm, in terms of long-term, dash_back is better. But it also means we can't punish their recovery (they're at 22 ticks of recovery; we'd be 260 away).
    Alternatively dash_forward through them → we're behind them → their heavy whiffs and we're right there to punish their recovery! That's the best if there's room behind them. If not, dash_back.
    Let me use: if dashLandsBehind → dash_forward; else if ki >= 20 && there's room behind us (wallBehind > 100) → dash_back; else guard.
    Hmm, wait: if we're going to dash back, is it better to just walk back? No, too slow.
- op.state === 'blast' && phase startup: their blast will come. Our options: heavy (if d <= 140) to interrupt (they can't block, they're committed) → 150 damage and no incoming blast ✓. That's great. But if d > 140 → we're safe from the blast anyway (it travels) but we should close in or wait. Actually, the blast will hit us if we're in its path (they fire it toward us). Their blast's direction = their facing = toward us. So it will hit us regardless of the distance (unless we dodge). So: heavy (if d <= 140) to interrupt, or dash_forward to cross it (if the room/time works), or guard.
  Priority: heavy if d <= 140 ✓ (a clean interrupt).
- op.state === 'dash': they're dashing (invulnerable). If op.phase === 'recovery' → they're vulnerable → punish with heavy if in reach.
- op.state === 'recover' (post-clash) → vulnerable → punish.

Now the default (op free) branch:
- op.state === 'guard':
  - if d <= 140 → heavy (crush) ✓
  - else → approach or beam/charge.
- op free (idle/forward/back):
  - if d <= 110 → light (start a chain).
  - else → approach: forward, or dash_forward if d >= 240 && ki >= 30, or blast if ki >= 20 && d >= 130 && d <= 400 (zoning), or charge if ki < 45 && d >= 170.

Hmm, the ordering between charging and approaching: if we need ki for the beam, charge when the opponent is far. But if the opponent is charging too, we should also charge (a race). Let's add: if op is charging and d > 140 and myKi < opKi → charge? Hmm, if both charge, whoever has more ki wins the exchange. Meh, let's keep it simple.

Also, an important one: when we're at low ki (< 20), we can't blast/dash/beam → fight with lights/heavies.

Let me now think about the overall ki economy: blasts cost 20, dashes 10, beams 50. Passive regen 0.04/tick (2.4/s) + charge 0.36/tick (21.6/s). Taking damage gives 0.08/dmg.

I'll add charging in these situations:
- op is charging and d >= 170 → charge (both charge; we race ki). Hmm, but they might attack. Risky (1.5× damage while charging).
- op is down (invulnerable) and myKi < 60 → charge (safe window).
- d >= 220 and myKi < 50 and op is not charging → charge (build ki while they approach). Hmm, but they'd reach us and hit us for 1.5×. 
   Actually, the classic: keep distance and charge. But they chase. Charging while they chase = taking 1.5× damage.
   Alternative: use blasts to zone while they approach.
   Let's implement: if myKi < 45 && d >= 200 → charge. If d < 200 → fight with lights/heavies/blasts.

Beam usage summary: myKi >= 50 && (opHelplessLong && d >= 130) → beam. Also myKi >= 55 && d >= 280 && opKi < 30 → beam (they can't interrupt).

Hmm, one more: our beam's chip damage when blocked is 120, which is great, so firing a beam at a guarding opponent is good. But a guarded beam costs 50 ki and 90 ticks of our time. The alternative: heavy crush (60 damage, 34 stun) costs nothing. So if the opponent guards and we're at 50 ki and far... the crush is better (free). Beam only when we can't get close.

Let me now write the final code. I'll write it carefully with comments.

```js
/* AI 武道会 · 选手程序 */
const R = RULES;

function decide(state) {
  try {
    if (!state || !state.me) return 'idle';
    if (state.clash) return pickClash(state);
    if (state.me.canCancel) return pickCancel(state);
    return pickFree(state);
  } catch (e) {
    return 'idle';
  }
}
```

Helper functions:

```js
function hpRage(hp) { return hp < R.clash.rageHp * R.hp; }
function clashBase(ki, hp) {
  let p = ki > 0 ? R.clash.base + R.clash.kiPower * ki : R.clash.empty;
  if (hp < R.clash.rageHp * R.hp) p += R.clash.rage;
  return p;
}
```

pickClash:
```js
function pickClash(s) {
  const me = s.me, op = s.opp, c = s.clash;
  const myBase = clashBase(me.ki, me.hp);
  const opBase = clashBase(op.ki, op.hp);
  const opEff = c.oppPower;                 // 包含对方是否加力
  const oppPushing = opEff - opBase > 0.25;
  if (me.ki > 25) {
    if (oppPushing || myBase < opEff + 0.4) {
      if (myBase + R.clash.pushPower >= opEff - 0.05) return 'push';
    }
  }
  return 'idle';
}
```

pickCancel:
```js
function pickCancel(s) {
  const me = s.me, op = s.opp, d = s.dist;
  // 大招：对手长时间动不了
  if (op.state === 'crushed' && op.left >= 30 && me.ki >= R.beam.cost && op.ki < 25 && d >= 120) return 'beam';
  if (me.chain < 3 && d <= R.light.reach) return 'light';
  if (d <= R.heavy.reach) return 'heavy';
  if (me.ki >= R.blast.cost && d > R.heavy.reach && d <= 320 && op.state !== 'down') {
    // 对手还在硬直里，气功波也许能追上
    const travel = Math.max(0, (d - 40) / R.blast.speed);
    if (travel + R.blast.startup <= Math.max(op.left, 0) + 4) return 'blast';
  }
  return 'idle';
}
```
Hmm, the blast check: op.left = the remaining stun ticks. The blast's startup is 11 and the travel time. If the opponent is in hitstun with 14 left, the blast lands at 11 + travel; we need 11+travel <= 14 → travel <= 3 → d <= 79. But d > 140 in this branch → no. So the blast rarely applies here. Fine, keep it simple.

Hmm, wait: actually the combo damage scale matters for the light-vs-heavy choice. Let me reconsider using the scale to decide. We computed that chaining is always better. But there's a subtlety: if the opponent recovers from the stun before our next hit (because the light missed or the timing shifted), they'd block → our light gets blocked (no damage, they're pushed, we get 11 blockstun... no wait, if THEY block, we get pushed and they're in blockstun; we don't take damage). Hmm, if they block our light, we lose the combo but nothing catastrophic.

OK.

Also: should the cancel ever choose 'light' when chain >= 3? The chain limit is 4 lights; chain=3 means we've thrown 3 lights → the 4th would be chain=4 (allowed since the check is a.chain < R.light.chain → 3 < 4 ✓). So the 4th light is allowed. But I set chain < 3 → light, so at chain=3 we go heavy. Let me reconsider: 4 lights + no heavy = 40+32+26+22 = 120 (no knockdown) vs 3 lights + heavy = 40+32+26+66 = 164 + knockdown ✓. So chain < 3 is right.

Hmm, but what if the heavy can't reach (d > 140) but a light can (d <= 110)? Then at chain=3, d <= 140 anyway... the branch order: if chain < 3 && d <= 110 → light; else if d <= 140 → heavy; else idle. If chain=3 and d=120 → heavy ✓ (120 <= 140). OK.

pickFree: the big one. Let me write it.

```js
function pickFree(s) {
  const R = RULES, me = s.me, op = s.opp, d = s.dist;
  const myKi = me.ki, opKi = op.ki;
  const oppStun = op.state === 'hitstun' || op.state === 'blockstun' || op.state === 'crushed';
  const oppDown = op.state === 'down';
  const oppCommitted = !op.free && !oppStun && !oppDown && op.state !== 'ko';
  const defensive = s.timeLeft < 600 && (me.hp - op.hp) > 150;

  // 1. 对手的气功波飞来
  const inc = incomingEta(s);
  if (inc !== null && inc <= 20) {
    if (myKi >= R.dash.cost) return 'dash_forward';
    return 'guard';
  }

  // 2. 对手在起手大招 —— 打断它
  if (op.state === 'beam' && op.phase === 'startup') {
    const rem = R.beam.startup - op.t;                 // 距离发射还有几 tick
    const travel = Math.max(0, (d - 40) / R.beam.speed);
    if (d <= R.heavy.reach && R.heavy.startup < rem + Math.max(0,(d-40)/R.beam.speed)) return 'heavy';
    if (myKi >= R.blast.cost && R.blast.startup + travel < rem) return 'blast';
    if (myKi >= R.dash.cost && dashBehind(me, op)) return 'dash_forward';
    return 'guard';
  }

  // 3. 对手蓄气 —— 惩罚
  if (op.state === 'charge') {
    if (d <= R.heavy.reach) return 'heavy';
    if (myKi >= R.blast.cost && d <= 280) return 'blast';
    return 'forward';
  }
  ...
}
```
Hmm, in case 3, if d > 140 and myKi < 20 → 'forward' (approach). OK.

Wait, in case 3, if the opponent is charging and far, maybe I should beam them (1.5× = 420)! Let's add: if myKi >= 55 && d >= 160 → beam (they're charging = 1.5× damage). But they might switch to dash/guard. If they switch to guard, the beam does 120 chip + a long stun. If they dash (10 ki), they dodge. Hmm, expected: 0.5*420 + 0.3*120 + 0.2*0 = 246. Vs a blast: 70*1.5 = 105 if they stay charging (they'd likely stop charging to block → 12 chip). Hmm, the blast's expected value is lower. The beam is better if they stay charging. But the beam costs 50 ki. 

I'll include the beam-vs-charger case: myKi >= 55 && d >= 150 && opKi < 40 → 'beam'. Hmm, opKi < 40 to reduce their dash chance. Actually a dash costs 10 ki, so opKi >= 10 means they can dash. Ugh. Let's require opKi < 12 for the beam-vs-charger, otherwise use the blast. Hmm, but that's rare. Let me simplify: for a charging opponent, if d <= 140 → heavy; else if myKi >= 55 && d >= 150 → beam; else if myKi >= 20 && d <= 280 → blast; else forward.

Now the "committed move threatening us" part:

```js
  // 4. 对手出招中
  if (oppCommitted) {
    // 4a. 对手在起手/发招
    if (op.state === 'light') {
      if (d <= R.light.reach && op.phase !== 'recovery') {
        if (myKi >= R.dash.cost) return 'dash_forward';
        return 'guard';
      }
    }
    if (op.state === 'heavy') {
      if (d <= R.heavy.reach && op.phase !== 'recovery') {
        if (myKi >= R.dash.cost && dashBehind(me, op)) return 'dash_forward';
        if (myKi >= R.dash.cost && s.wallBehind > 120) return 'dash_back';
        return 'guard';
      }
    }
    if (op.state === 'blast' && op.phase === 'startup') {
      if (d <= R.heavy.reach) return 'heavy';       // 打断他们的气功波
      // 他们要放波了，准备躲
      if (myKi >= R.dash.cost) return 'dash_forward';
      return 'guard';
    }
    if (op.phase === 'recovery' || op.state === 'recover' || op.state === 'dash') {
      // 他们收招中，惩罚
      if (d <= R.heavy.reach) return 'heavy';
      if (d <= R.light.reach) return 'light';
      return 'forward';
    }
  }
```
Hmm, careful with the ordering: if op.state === 'light' and d > 110, no threat → we can attack (they're in startup → counter 1.25!). Actually if op is in light startup and d > 110, their light will miss; we could dash in for a counter. Let's handle: if op is in a committed move and we're out of their reach → punish: close in (dash_forward if far) or attack.

Let me restructure case 4:

```js
  if (oppCommitted) {
    const threat = (op.state === 'light' && d <= R.light.reach && op.phase !== 'recovery') ||
                   (op.state === 'heavy' && d <= R.heavy.reach && op.phase !== 'recovery') ||
                   (op.state === 'blast' && op.phase === 'startup');
    if (threat) { ...dodge logic... }
    // otherwise punish
    if (d <= R.light.reach) return 'light';    // 反击 1.25x
    if (d <= R.heavy.reach) return 'heavy';
    if (myKi >= R.dash.cost && d > 200) return 'dash_forward';
    return 'forward';
  }
```
Hmm, the punish: if op is in light startup/recovery (a total of 17 ticks) and d <= 110 → light: our light hits at +5; if they're still in startup/recovery → counter ×1.25 → 50 damage. But if their light hits us first (their active at t=5, ours at t=5 too if we start now) → trade. Hmm! If op is in light startup with op.t=0, their active starts at tick 5 → they hit at +5; our light (started at +0) has its active at +5 → both hit at +5 → trade (each takes 40*1.25=50). Actually, being hit at the same time: both take damage ✓ (the engine handles simultaneous hits). So it's a trade: we take 50, they take 50. Not great but not terrible. Alternatively, if we dash forward through them, their light whiffs and we get a free hit later. Hmm.

To avoid trades: if op is in light startup with a small op.t and d <= 110 → their hit comes at (5 - op.t) ticks. If that's <= 6, a trade is likely → better to dash (dodge) or guard. The dodge/guard logic in the "threat" branch handles it: dash_forward if ki >= 10 else guard.

But if op.t is large (e.g., 6+, their light is in recovery), their attack is done → we can punish freely with a counter (they're in recovery → 1.25×).

So the threat condition should account for the timing: their light hits us at (5 - op.t) ticks from now if op.t < 5 (active at 5,6,7). Actually the active frames are t=5,6,7 (startup 5, active 3 → t in [5,8)). So if op.t <= 7, their light can still hit us. If op.t >= 8 → they're in recovery → no threat ✓.

So: threat if op.state === 'light' && op.t < 8 && d <= 110.
Similarly for heavy: the active frames are t in [9,13) → if op.t < 13 && d <= 140 → the threat exists (the hit lands at max(0, 9-op.t) ticks).
For blast: the startup is 11 → the blast spawns at t=11; if op.t < 11, the blast is coming (but we might not see it in s.blasts yet). If op.t >= 11, the blast is already flying (we'd see it in s.blasts as incoming) — handled by the incoming check.

Let me use R.light.startup + R.light.active etc. to compute the "danger window".

Also for the beam: handled separately.

Now, in the threat branch, what if d <= 110 and their light is incoming and we have ki >= 10 → dash_forward. But hold on: dashing forward crosses THEM; their light (already thrown) will hit at d <= 0? Their light's hit check happens on the active frames: at the tick when they're active, d = (op.x - my.x)*op.facing. If I dashed behind them (my.x > op.x, and their facing = -1 (toward me, the old position)), then (op.x - my.x) = negative, times facing (-1) → positive → d > 0 → hmm! Let me redo: the opponent is at x=500, I'm at 400, they face -1 (toward me at 400 ✓). I dash forward (toward them) to x=600 (behind them). Now (op.x - my.x) = 500-600 = -100, times op.facing (-1) = 100 > 0 and <= 110 → their light HITS me at 100 distance! Because they were facing left, and their punch goes in the direction they face (leftward, i.e., toward x=400) — but I'm now at 600 (to their right). The engine computes d = (o.x - a.x)*a.facing where a is the attacker and o is me: d = (600 - 500)*(-1) = -100 → negative → no hit! 

Let me redo carefully: in strikes(): `const d = (o.x - a.x) * a.facing;` where a = the attacker (the opponent), o = me. So d = (my.x - op.x) * op.facing = (600-500)*(-1) = -100 → d <= 0 → no hit ✓. 

I made an error before. Good: if I'm behind them (op.facing points away from me), d < 0 → they whiff ✓. Since they don't turn (not free), the whiff is permanent ✓.

And if I dash forward but land in FRONT of them (no room behind), my.x = op.x - 60 → d = (-60)*(-1) = +60 → they hit me ✗ (but I'm invulnerable for the first 9 ticks).

Hmm, so the dash-through only works if we land behind them. Let me use dashBehind(me, op) as the condition for dash_forward dodges. If we can't get behind them, use dash_back (if there's room behind us) or guard.

So the dodge logic:
```
function dodgeChoice(s, me, op, d, needDist) {
  // needDist: the distance at which their attack still reaches (e.g., 110 or 140)
  if (me.ki >= R.dash.cost && dashBehind(me, op)) return 'dash_forward';  // 绕到背后
  if (me.ki >= R.dash.cost && s.wallBehind >= needDist + 60) return 'dash_back';  // 拉开距离
  return 'guard';
}
```
Hmm, dash_back moves 200 away; we need the new distance > their reach. If d <= reach, then d+200 > reach ✓ as long as we actually move 200 (wallBehind >= 200). If wallBehind < 200, we move less. Condition: wallBehind >= 200 → we can move the full 200 → the new distance = d+200 > reach ✓ (since d <= reach). Hmm, but actually we only need to move (reach - d + margin). Let me require wallBehind >= (reach - d + 40). E.g., d=100, reach=110 → we need to move 50 → wallBehind >= 90 ✓.
But careful: dash_back moves 200 regardless (or until the wall). The invulnerability covers the first 9 ticks; the dash takes 10 ticks to move. If their hit lands at tick 9+ (e.g., a heavy with op.t=0 → hits at +9..12), and we're still invulnerable at tick 9 (t<9 → invuln at ticks 0-8), we might get hit at tick 9-12 if we're still in their reach. So the dash_back must fully exit their reach before their hit lands. That's a timing issue. If their hit is imminent (within 2 ticks), nothing helps except guard/trade.
For a heavy with op.t >= 6 (hits at +3..7), dashing back 200 in 10 ticks: at tick 3 we've moved 60 → d+60 > 140? If d was 140 → 200 > 140 ✓ (moved 60 in 3 ticks at 20/tick → yes, the dash moves 20/tick). So after 3 ticks, we've moved 60 → out of reach ✓. But wait, the dash's movement: `a.x = a.dash.x0 + ((x1-x0)*(a.t+1))/ticks` → at t=2 (3rd tick), the progress = 3/10 → 60 units ✓. So we exit their reach in ~(reach-d)/20 ticks. For a heavy: if their hit is at +(9-op.t) ticks and we need (reach-d)/20 < 9-op.t... 
This is getting deep. Simplify: dash_back only when their hit is not imminent (op.t >= 3 for a heavy, so they hit at >= 6 ticks) — actually let me just check: our dash moves 20/tick; we need to exit their reach: t_exit = (reach - d)/20 + 1 (ticks). Their hit lands at t_hit = (startup+active start) - op.t = for a heavy: 9 - op.t (the first active frame; they hit on the first active frame where they're in range) → actually the hit lands on the first active frame: t = 9 - op.t (if >= 0). If op.t >= 9 they're already active (or recovery).
So we need t_exit < t_hit... plus the invulnerability covers ticks 0-8 anyway.

Simplify: for a heavy, t_hit = 9 - op.t (op.t in [0,9)). We need to exit their reach by t_hit, or be invulnerable (t < 9). If op.t >= 4 → t_hit <= 5 → we need to exit in <= 5 ticks: (reach-d)/20 <= 4 → d >= reach - 80. Hmm.

You know what? Guarding is much simpler and always available. Let me evaluate: guard vs a light = free block (0 damage, 11 blockstun for them, 14 push). Guard vs a heavy = -60 hp, 34 stun for us. Guard vs a blast = -12 hp, 14 stun.

And the dash costs 10 ki. Given that ki is precious (beams!), maybe guarding is often better. But a guard against a heavy costs 60 hp.

Let me use a hybrid:
- vs a light (d <= 110): prefer dash_forward-behind (free, and gives a great position), else guard (free block).
- vs a heavy (d <= 140): prefer dash_back (if there's room and the timing works) → free; else dash_forward-behind; else guard.
  Hmm, but dash_back costs 10 ki and pushes us far. Alternatively, dash_forward-behind is ideal (free, no ki loss... it does cost 10 ki too).
  Ugh, both dashes cost 10 ki.
  Guard is free. vs a heavy, the guard costs 60 hp.
  I'll prefer: dash_forward-behind (if possible) → dash_back (if the room behind is >= 140 and the timing works) → guard.
- vs a blast (they're in blast startup): heavy if in reach (interrupt) → else guard/dash.

Fine. Let me now also reconsider: is it better to just trade with the light? If they're in light startup and we have a light ready, a trade gives 50 damage each. Trading is fine when our HP is higher. Too complex; skip.

Now, the default free-opponent branch:

```js
  // 5. 对手自由行动
  if (op.state === 'guard') {
    if (d <= R.heavy.reach) return 'heavy';        // 破防
    // 太远：靠近
    if (myKi >= R.beam.cost && d >= 250 && opKi < 30) return 'beam';
    if (myKi < 45 && d >= 200) return 'charge';
    return 'forward';
  }
  // idle / forward / back
  if (d <= R.light.reach) return 'light';           // 起手连招
  // 距离太远
  if (myKi >= R.beam.cost && d >= 280 && opKi < 30) return 'beam';
  if (myKi >= R.blast.cost && d >= 140 && d <= 420) return 'blast';
  if (myKi >= R.dash.cost && d >= 260) return 'dash_forward';
  if (myKi < 45 && d >= 190) return 'charge';
  return 'forward';
```

Hmm, the blast branch: at d in [140,420] we throw a blast. Is that better than walking in? The blast does 70 (or 105 vs a charger). It costs 20 ki. Walking in takes (d-110)/4.5 ticks. I think a mix is fine. But we shouldn't spam blasts (20 ki each). With 100 ki, 5 blasts. Let's restrict the blast to d >= 160 and myKi >= 25.

Hmm, also: if the opponent is approaching (state 'forward'), a blast might hit them as they close ✓.

Also, the beam at d >= 280 && opKi < 30: they can't dash (10 ki) → they can't interrupt within 30 ticks (they'd need to close 170 units = 38 ticks > 30) ✓ safe. And the beam's front sweeps toward them → they'd have to dash through us (impossible from that distance... they'd need to dash forward 200 through us → they CAN: the dash moves 200 toward us and lands 200 past us? dashEnd: if they're at 500 and we're at 200 (d=300), dashing forward → x = 700; the opponent is at 500 → after = (500-700) = -200 <= -60 → behind = 500 + max(60,200) = 700 ≤ 960 ✓ → they land at 700, behind us ✓ dodging the beam. But that requires 10 ki (opKi < 30 doesn't prevent that).
Hmm. So the beam at long range can be dodged by a dash-through. But that's fine: they waste 10 ki and 18 ticks.

OK.

One more important case: the opponent is 'down' (invulnerable). 
```js
  if (oppDown) {
    if (myKi >= R.beam.cost && op.left >= 34 && d >= 120) return 'beam';
    if (d > R.light.reach) return 'forward';   // 靠近等他们起来
    if (myKi < 60) return 'charge';
    return 'idle';
  }
```
Hmm, charging while they're down: they get up and might hit us for 1.5×. But if they're down for the remaining ~20 ticks, charging gains 7 ki. Meh. Let's charge only if myKi < 40.

Wait, but there's a subtlety: if the opponent is down and we walk toward them, we might be close when they get up → they hit us. Better to wait at a distance? Hmm, when they get up, they can act immediately. If we're at d=100, their light reaches us. If we're at d=150, their light doesn't reach (110) but their heavy does (140).
Let's just approach slowly (forward) and be ready.

Now, the defensive mode (time < 600 and hpLead > 150): prefer not to take risks. Let's implement at the top of pickFree:
```
  if (defensive) {
     // 只有在对手动不了的时候才进攻
     if (oppStun && d <= R.light.reach) return 'light';   // free damage
     if (oppStun && d <= R.heavy.reach) return 'heavy';
     if (op.state === 'guard' && d <= R.heavy.reach) return 'heavy';  // crush: they take damage
     if (d <= R.heavy.reach) return 'guard';
     return 'back';
  }
```
Hmm, but 'back' at the wall does nothing. Use 'idle' if wallBehind is small? Let's use 'back' anyway (it's harmless).

Hmm, actually, is defensive mode a good idea? If we're ahead by 150 HP with 10 seconds left, we mostly want to avoid a heavy (120) or a beam (280). Guarding blocks light/blast/beam (120 chip) and heavy (60 crush). It's a decent strategy. But it might also stall into a draw... A draw vs a win? The ranking counts draws as half a win. If we stall and the opponent is also stalling, we get a draw (0.5). If we keep playing we might win. Hmm, but the opponent won't stall — they'll attack us.
I'll keep the defensive mode but only when the lead is substantial (> 200) and timeLeft < 500.

Hmm, let me reconsider. Actually, "time" endings: the winner is whoever has more HP. If we're ahead, we win on time if nothing changes. So being defensive is right. But we should still punish their mistakes (free damage). I'll implement it as described but keep the attacking options when the opponent is helpless.

Let me now write the code for real. I'll also add a small module-level state to track things (not strictly needed).

One more consideration on the incoming blast check: s.blasts includes our own blasts and theirs. incoming = true means it's the opponent's and heading toward us. Note: `incoming: b.owner !== i && gap > 0` where gap = (me.x - b.x)*b.dir. If the blast has passed us (gap <= 0), incoming = false. OK.

Also note: our own blast is in the array with mine: true.

Now about `dashBehind(me, op)`: compute the landing x of dash_forward and check if it's on the far side of the opponent.

```js
function dashBehind(me, op) {
  const R = RULES;
  const d = me.facing;              // 朝向对手
  let x = me.x + d * R.dash.dist;
  const before = (op.x - me.x) * d, after = (op.x - x) * d;
  if (before > 0 && after < R.minGap) {
    const behind = op.x + d * Math.max(R.minGap, -after);
    if (after <= -R.minGap && behind >= R.stage.left && behind <= R.stage.right) x = behind;
    else if (op.x + d * R.minGap >= R.stage.left && op.x + d * R.minGap <= R.stage.right && after < 0) x = op.x + d * R.minGap;
    else x = op.x - d * R.minGap;
  }
  x = Math.max(R.stage.left, Math.min(R.stage.right, x));
  return (x - op.x) * d > 0;    // 落点在对手身后
}
```
Note: me.x and op.x from the view are rounded to 1 decimal ✓.

Edge: if before <= 0 (the opponent is not "ahead" along d — shouldn't happen since facing is toward them).

Also note: the engine's dashEnd uses the actual fighter x (not rounded) — close enough.

Now let me also handle: what if `me.facing` is stale? The view gives the current facing ✓.

Let me write the final code.

Also: I must make sure not to exceed the time budget. The code is simple ✓.

Let me write it out:

```js
/* =========================================================
   AI 武道会 · 第 1 季 选手程序
   思路：贴身连招（轻拳×3 → 重击收尾）、惩罚起手/收招、破防、
        打断气功波与大招、气功波对冲博弈、瞬移穿背闪避。
   ========================================================= */
const R = RULES;

function decide(state) {
  try {
    if (!state || !state.me) return 'idle';
    if (state.clash) return pickClash(state);
    if (state.me.canCancel) return pickCancel(state);
    return pickFree(state);
  } catch (e) {
    return 'idle';
  }
}
```

Let me write all the helpers and be careful about `R.blast.speed` etc.

Also note R.light.reach = 110, R.heavy.reach = 140, R.blast.startup = 11, R.blast.speed = 13, R.dash.dist = 200, R.dash.cost = 10, R.blast.cost = 20, R.beam.cost = 50, R.beam.startup = 30, R.beam.speed = 30.

Now let me write the whole thing.

```js
function pickFree(s) {
  const R2 = R;
  const me = s.me, op = s.opp, d = s.dist;
  const myKi = me.ki, opKi = op.ki;
  const oppStun = (op.state === 'hitstun' || op.state === 'blockstun' || op.state === 'crushed');
  const oppDown = (op.state === 'down');
  const oppBusy = (!op.free && !oppStun && !oppDown && op.state !== 'ko');
  const hpLead = me.hp - op.hp;

  // ---- 对手在蓄气 / 大招起手 / 出招 等特殊状态
  ...
}
```

Let me write the code fully now, in order:

```js
function pickFree(s) {
  const me = s.me, op = s.opp, d = s.dist;
  const myKi = me.ki, opKi = op.ki;
  const oppStun = op.state === 'hitstun' || op.state === 'blockstun' || op.state === 'crushed';
  const oppDown = op.state === 'down';
  const oppBusy = !op.free && !oppStun && !oppDown && op.state !== 'ko';
  const hpLead = me.hp - op.hp;
  const defensive = s.timeLeft < 520 && hpLead > 200;

  /* 1. 对手的气功波正在飞过来 */
  const inc = incomingEta(s);
  if (inc !== null && inc <= 20) {
    if (myKi >= R.dash.cost) return 'dash_forward';   // 穿过去（无敌帧）
    return 'guard';                                   // 挡一下只擦 12 血
  }

  /* 2. 对手起手大招 —— 想办法打断 */
  if (op.state === 'beam' && op.phase === 'startup') {
    const rem = R.beam.startup - op.t;
    const sweep = Math.max(0, (d - 40) / R.beam.speed);
    if (d <= R.heavy.reach && R.heavy.startup < rem + sweep) return 'heavy';
    if (myKi >= R.blast.cost && R.blast.startup + Math.max(0,(d-40)/R.blast.speed) < rem) return 'blast';
    if (myKi >= R.dash.cost && dashBehind(me, op)) return 'dash_forward';
    return 'guard';
  }

  /* 3. 对手蓄气 —— 打他个 1.5 倍 */
  if (op.state === 'charge') {
    if (d <= R.heavy.reach) return 'heavy';
    if (myKi >= R.beam.cost && d >= 150 && opKi < 20) return 'beam';
    if (myKi >= R.blast.cost && d <= 280) return 'blast';
    return 'forward';
  }

  /* 4. 对手出招中 */
  if (oppBusy) {
    // 4a. 有东西要打过来
    const lightDanger = op.state === 'light' && op.t < R.light.startup + R.light.active && d <= R.light.reach;
    const heavyDanger = op.state === 'heavy' && op.t < R.heavy.startup + R.heavy.active && d <= R.heavy.reach;
    const blastDanger = op.state === 'blast' && op.phase === 'startup' && d <= 300;
    if (blastDanger && d <= R.heavy.reach) return 'heavy';   // 打断他们的气功波
    if (lightDanger || heavyDanger) {
      if (myKi >= R.dash.cost && dashBehind(me, op)) return 'dash_forward';
      if (heavyDanger && myKi >= R.dash.cost && s.wallBehind >= (R.heavy.reach - d + 60)) return 'dash_back';
      return 'guard';
    }
    // 4b. 他们收招了 —— 反击（1.25 倍）
    if (d <= R.light.reach) return 'light';
    if (d <= R.heavy.reach) return 'heavy';
    if (myKi >= R.dash.cost && d > 220) return 'dash_forward';
    return 'forward';
  }

  /* 5. 对手倒在地上（打不到） */
  if (oppDown) {
    if (myKi >= R.beam.cost && op.left >= 34 && d >= 120) return 'beam';
    if (myKi < 45) return 'charge';
    if (d > R.light.reach) return 'forward';
    return 'idle';
  }

  /* 6. 对手动不了（硬直）—— 随便打 */
  if (oppStun) {
    if (d <= R.light.reach) return 'light';
    if (d <= R.heavy.reach) return 'heavy';
    if (myKi >= R.blast.cost && d <= 400) return 'blast';
    if (myKi >= R.dash.cost && d > 200) return 'dash_forward';
    return 'forward';
  }

  /* 7. 对手自由行动 */
  if (op.state === 'guard') {
    if (d <= R.heavy.reach) return 'heavy';      // 破防
    if (myKi >= R.beam.cost && d >= 260 && opKi < 30) return 'beam';
    if (myKi < 45 && d >= 200) return 'charge';
    return 'forward';
  }
  // idle / forward / back
  if (d <= R.light.reach) return 'light';
  if (myKi >= R.beam.cost && d >= 280 && opKi < 30) return 'beam';
  if (myKi >= 25 && d >= 150 && d <= 420) return 'blast';
  if (myKi >= R.dash.cost && d >= 260) return 'dash_forward';
  if (myKi < 45 && d >= 190) return 'charge';
  return 'forward';
}
```

Wait, in step 6 (oppStun), if d <= 110 → light. But should I prefer heavy? During a stun, a light chain then heavy is better (as computed). The cancel logic handles the follow-up. But hold on: if the opponent is in hitstun (15 ticks) and we throw a light (startup 5) → it hits at +5 ✓ (they're still stunned) → then the cancel → chain. Good.
If the opponent is in 'crushed' (34 ticks) → the same ✓.
If in 'blockstun' (11-14 ticks) → our light hits at +5 ✓ (they're stunned) → the cancel → light at +11 → the opponent's blockstun expires at 11-14... their stun ends → they might block our 2nd light. Hmm. The blockstun from a blocked light is 11; from a blast 14. So a light into a 14-blockstun: hit1 at +5 (they're stunned, the hit refreshes their hitstun to 15 ✓) → then our chain works ✓ (their stun is refreshed by our hit).
Good: any hit refreshes the stun to 15 (light) or 20 (blast).

In step 7 (op free), if d <= 110 → light. But we should consider: if they're about to attack... we can't know. Fine.

Also in step 7, the 'light' is thrown when d <= 110 — but the chain needs d <= 82 for 3 lights. If d = 100, the chain is: light (hit, push to 114) → cancel: 114 > 110 → heavy (reach 140 ✓) → 40+96 = 136 damage. OK.

Now, one thing I should double check: the 'light' action when the opponent is 'guard' — we don't do that (we heavy instead) ✓.

What about when the opponent is free and d <= 110 but they're in 'forward' (approaching)? Light is fine.

Another consideration in step 7: should we light when the opponent is at d <= 110 but our ki is 0 and we're at low HP? Light is free ✓.

Now, the defensive mode: let me insert it before step 4 (or at the top after the incoming blast check):

```js
  if (defensive) {
    if (oppStun && d <= R.light.reach) return 'light';
    if ((oppStun || op.state === 'guard') && d <= R.heavy.reach) return 'heavy';
    if (d <= R.heavy.reach) return 'guard';
    return 'back';
  }
```
Hmm, but this also skips the beam interrupt (case 2). If the opponent is charging a beam and we're ahead, we should still interrupt it (they'd deal 280). Let me put the defensive check after case 2 (the beam interrupt) but before case 3? Hmm, case 3 (punishing a charger) — if we're ahead by 200, a heavy punish is still good (free damage). Let me place the defensive check after cases 1-3 and after the oppStun case. Actually, let me restructure: put the defensive block right after case 3, and inside it, allow attacks that are safe:
- oppStun → attack (free damage, no risk).
- op.state === 'guard' → heavy crush (they take 60 damage, we take 0) ✓ safe!
- otherwise → guard (if close) or back (if far).

Hmm, but there's a risk: 'back' when the opponent is far means we never fight → a draw. With hpLead > 200, a draw is better than a loss. Hmm, but the opponent will come to us. Fine.

Actually, let me reconsider the defensive mode entirely: it's an edge case (the last 8 seconds with a 200 HP lead). The main risk is that it makes us passive and loses potential wins. I'll keep it but require hpLead > 250 and timeLeft < 450 (7.5s). And in it, prefer 'guard' when the opponent is within heavy range, else 'back' but if wallBehind < 50, 'idle'.

Hmm, but 'back' when the opponent is behind us? They're always in front (we face them) ✓.

OK, also note: 'back' moves away 3/tick — slow. Fine.

Let me reconsider one more time whether the defensive mode is worth the complexity. I'll include it, simple.

Now let me also double check the 'idle' fallback: if we return 'idle', we stay put.

Let me now write the actual final code text. I'll be careful with syntax.

Additional detail: `incomingEta(s)`:
```js
function incomingEta(s) {
  let best = null;
  for (const b of s.blasts) {
    if (b.incoming && (best === null || b.eta < best)) best = b.eta;
  }
  return best;
}
```
Note: b.eta could be null for our own blasts, but incoming is false for those ✓.

Also, the beam situation where the OPPONENT is firing a beam and we're in the ray: we can't do much (the ray sweeps). Options: dash behind them (if close enough and room) → but as computed, dashing forward only helps if we land behind them. Let me add a case: if op.state === 'beam' && op.phase === 'firing' → we're likely already hit (in hitstun). If we're free and in the ray, try dash_forward-behind. Marginal. I'll add it in the oppBusy branch: for op.state === 'beam' && phase 'firing' → if dashBehind → dash_forward; else guard (120 chip). Actually if the beam is firing and hasn't hit us yet, the front is about to reach us → guard gives 120 chip. Hmm, or nothing. Let me add:
```
    if (op.state === 'beam' && op.phase === 'firing') {
      if (myKi >= R.dash.cost && dashBehind(me, op)) return 'dash_forward';
      return 'guard';
    }
```
Wait, but during 'firing' the beam's dir is fixed; dashing behind them means x > their position (if they're to our left... hmm). Their beam fires toward us. If we dash forward and land behind them, we'd be at their position + 200 in their facing direction... hmm, "behind them" relative to their facing = away from us = the opposite side of their beam direction. But our dash_forward moves TOWARD them (we face them). If we land "behind them" per dashBehind (i.e., beyond them along our facing direction), that's the side their beam came from = behind them = outside the ray ✓ (the ray goes from them toward us). So dashBehind(me,op) → landing beyond them along our facing → their beam's ray (which goes from them toward us, i.e., in the opposite direction) doesn't cover us ✓. 

But as computed, the crossing happens mid-dash and we're invulnerable then ✓ (as long as the beam's front doesn't reach us before the crossing... the crossing is when the front meets us: t = gap/50 where gap = the distance from the front to us. If the front is close (gap < 450), the crossing is within 9 ticks ✓. If the gap is large (>450), we cross after the invuln ends → we get hit. The gap = the distance from the beam's front to us; since the front advances 30/tick and we're at the ray's edge... if the beam hasn't hit us yet, the front is still approaching: the gap could be up to 1200. Hmm. If the gap > 450, the dash won't save us. So the condition should also include the gap. We don't know the front's distance exactly... we do: s.beams gives from and front for each beam! So gap = |front - my.x| roughly.

Let me use: if the opponent's beam is firing and it's in the ray, gap = (my.x - front)*dir... Let me compute: the beam's dir is toward us; the front is between them and us (or past us). If the front is still short of us: gap = my.x - front (in the direction of travel). With dir = -1 (they're to our right, firing left toward us): front < my.x → gap = my.x - front. If gap <= 400 → dash forward crosses within 8 ticks ✓.
I'll implement a simple version: if op.state==='beam' && phase==='firing' → if dashBehind && ki >= 10 → dash_forward; else guard.

It's an edge case; fine.

Now let me write everything out properly. I'll write the final code.

One more: the `pickCancel` 'blast' branch condition. Let me simplify: if d > 140 and ki >= 20 and op is stunned with enough time → blast. The blast lands at 11 + (d-40)/13. Their stun remaining = op.left. For the blast to land during their stun: 11 + travel <= op.left + a small margin (they might be stunned a bit longer? no). op.left for a hitstun = 15 → travel <= 4 → d <= 92. But d > 140 in that branch → no. So the blast branch is useless. Remove it. Actually, keep a version: if the opponent is in 'crushed' (34 ticks) and d <= 300: 11 + (d-40)/13 <= 34 → d <= 302 ✓ → the blast lands. Damage 70*0.8 = 56 + it refreshes their stun. Hmm, vs heavy (if d <= 140) = 96. So the blast is for d in (140, 300]. OK, include it for crushed.

Let me write the final code now.

Also, for `pickCancel`, one more consideration: the 'beam' cancel. Let me refine the condition: op.state === 'crushed' && op.left >= 30 && me.ki >= 50 && op.ki < 20 && d >= 120. OK.

Hmm, also: in pickCancel, what if the opponent is in 'down' (invulnerable)? Then our light wouldn't hit... but wait, if our light hit them, they wouldn't be down. Unless they were already down — but then our light would have missed (invulnerable) → no cancel. So in the cancel window, the opponent is stunned ✓.

Let me also handle: me.chain — the number of lights in the current string. After the first light, chain=1. The check `act === 'light' && a.chain < R.light.chain` → a.chain < 4 → so we can throw lights while chain is 1,2,3 → the 4th light makes chain=4 → then no more lights. ✓ My rule "chain < 3 → light" means we throw lights at chain=1,2 → chain becomes 3 → then heavy. Total lights = 3 ✓ (40+32+26) then heavy (66) = 164.

Hmm, wait: chain=1 means 1 light has been thrown. If chain < 3 → light → chain=2 → light → chain=3 → heavy. So we throw 3 lights total ✓.

Now let me think about whether to use 'light' or 'heavy' first in the cancel. We computed that chaining is better. But there's a caveat: the light pushes them 14 away each time, and my heavy reach is 140. Fine.

Another caveat: what if the opponent's stun is about to end (op.left small)? E.g., op.left = 3 (they're about to recover). Our light (startup 5) would land after they recover → they might block it. Hmm! The cancel happens 1 tick after our light hit, so op.left ≈ 14 (hitstun 15). Fine.

But in the 'crushed' case, op.left = 34 → fine.

OK, writing the final code now.

Let me also think about whether to prefer 'heavy' when the opponent has low HP (a finisher). Not important.

Final code:

```js
/* ===========================================================
   AI 武道会 · 选手程序（第 1 季）
   =========================================================== */
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

/* ---------- 小工具 ---------- */
function incomingEta(s) {
  let best = null;
  const bl = s.blasts || [];
  for (let i = 0; i < bl.length; i++) {
    const b = bl[i];
    if (b.incoming && b.eta !== null && (best === null || b.eta < best)) best = b.eta;
  }
  return best;
}

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
  return (x - op.x) * d > R.minGap * 0.5;
}
```
Hmm, `(x - op.x)*d > R.minGap*0.5` → we need to be at least 30 past them. With the "behind" case, x = op.x + d*max(minGap, -after) → if -after >= minGap, then (x-op.x)*d = max(minGap,-after) >= 60 ✓. If the "stop in front" case, x = op.x + d*minGap → (x-op.x)*d = 60 > 30 → this would incorrectly return true! Because in the "stop in front" case, x is on the side of the opponent where we already are... wait: "stop in front" means x = op.x + d*minGap where d is our facing direction (toward them) → x is between us and them → (x - op.x)*d = +60 > 0 → but we're in FRONT of them, not behind!

Hmm, I need to be careful. Let me redefine: "behind the opponent" means on the opposite side from us. Our facing d points toward the opponent. So "in front of them" (from their perspective, they're facing us) = the side where we came from = -d direction from them. And "behind them" = +d beyond them.

So the condition for landing behind them: (x - op.x)*d > minGap (we're beyond them along d).
In the "stop in front" case, x = op.x + d*minGap → (x-op.x)*d = minGap = 60 > 0 — hmm, that's along +d, which is BEYOND them?? Let me recheck the engine's dashEnd:

```
const before = (o.x - a.x) * d, after = (o.x - x) * d;
if (before > 0 && after < R.minGap) {   // I would end inside or beyond them
   const behind = o.x + d * Math.max(R.minGap, -after);
   if (after <= -R.minGap && behind >= L && behind <= H) x = behind;   // through, landing behind
   else if (o.x + d * R.minGap >= L && o.x + d * R.minGap <= H && after < 0) x = o.x + d * R.minGap;
   else x = o.x - d * R.minGap;
}
```
Here d = a.facing * sign = the direction of the dash. For dash_forward, sign=1, d = a.facing (toward the opponent).
before = (o.x - a.x)*d > 0 → the opponent is ahead of us along d ✓.
after = (o.x - x)*d → after < minGap means we'd end up within minGap of them (or past them).
- "through, landing behind": after <= -minGap → x is beyond the opponent along d by at least minGap. And behind = o.x + d*max(minGap, -after) — hmm, that's beyond the opponent along d by max(minGap, -after) where -after = (x-o.x)*d (how far past we were aiming). So the landing is at least minGap past them ✓ (this is "behind" them relative to their own facing, since they're facing us = -d).
  Wait, I need to double check the direction semantics: if d = +1 (we're to the left of the opponent, facing right), then "beyond the opponent along d" = to their right = behind them (they face left toward us) ✓.
- The second case: x = o.x + d*minGap → that's minGap PAST them along d... but the condition is `after < 0` (we'd overshoot them) and there's no room behind → "stop in front"? The comment says "no room behind: stop in front". But x = o.x + d*minGap is minGap past their position along d = behind them?! That contradicts the comment. Hmm.

Let me re-read: the third case `else x = o.x - d * R.minGap;` → that's minGap short of them along d = in front of them (on our side) ✓ matches "stop in front".
The second case: x = o.x + d*minGap → that's minGap beyond them along d = behind them (at least minGap away). The condition for this case: `after < 0` (we aimed past them) and `o.x + d*minGap` is within the stage → so there's room for a body at minGap beyond them. And the first case (through, landing behind) requires after <= -minGap AND the computed behind position to be within the stage. The second case is a fallback: land at exactly minGap beyond them.

Hmm OK, so both cases 1 and 2 land beyond them (behind). Case 3 lands in front (minGap short). So the "behind" test: (x - op.x)*d >= minGap (approximately) → but case 2 gives exactly minGap ✓, case 1 gives >= minGap ✓, case 3 gives -minGap ✗.

But careful: in case 3, x = op.x - d*minGap → (x-op.x)*d = -60 < 0 ✓ not behind.

And the "no special case" path (before > 0 && after >= minGap): x = me.x + d*200 which is short of them by at least minGap → (x-op.x)*d <= -minGap → not behind ✓.

So: behind = (x - op.x)*d >= R.minGap - 0.5. Let me use >= R.minGap * 0.9.

Hmm, but case 2: x = op.x + d*minGap exactly = 60 beyond → the distance from us to them is 60. Is that "behind"? Yes, we're past them (on their back side), 60 units away. Their next strike: d_strike = (my.x - op.x)*op.facing. op.facing = -d (they face us, i.e., toward -d... wait, they face toward us: if we're at op.x - 60*... hmm.

Let me set up concretely: opponent at 500, us at 400, our facing d = +1, their facing = -1 (toward us).
Case 2: x = 500 + 60 = 560. We're at 560, they're at 500 facing -1 (leftward, toward our old position 400). Their strike distance = (my.x - op.x)*op.facing = (560-500)*(-1) = -60 → negative → no hit ✓. So they're attacking the air behind them... wait, they're facing left (toward 400) and we're at 560 (to their right) → they punch leftward, away from us ✓ whiff.

Great, so landing "behind" = (x - op.x)*d >= minGap means we're on the far side ✓.

Now, the invariant: dashBehind returns true iff the dash lands us beyond the opponent.

Also note: when we land behind them, we're 60+ units from them, and their facing is still toward their old front → their attacks whiff ✓. But once they become free, they turn to face us ✓.

Now let me write pickClash, pickCancel, pickFree as designed.

Let me write the final code.

Another detail: in pickFree, the case "op.state === 'guard'" and d <= 140 → heavy (crush). But what if their guard is facing away from us? They're free → they face us ✓.

Also: what if the opponent is 'guard' and we're at d <= 110 — heavy crush → they take 60 and are stunned 34 ✓.

I think the design is solid. Let me also add a small thing: track whether we've been in a long combo? Not needed.

Let me write out the final code text carefully.

Also, I should double check the 'light' action in pickFree when the opponent is at d <= 110: the light's startup is 5 ticks, and the opponent might hit us during that. E.g., if they're free and decide to attack at the same time... unavoidable.

One more: after we throw a light and it HITS, we get the cancel. If it MISSES (the opponent moved away), there's no cancel and we're in recovery for 9 ticks. Fine.

Let me write the final code.

```js
function pickClash(s) {
  const me = s.me, op = s.opp, c = s.clash;
  const myBase = clashBase(me.ki, me.hp);
  const opBase = clashBase(op.ki, op.hp);
  const opEff = c.oppPower;
  const oppPushing = (opEff - opBase) > 0.25;
  if (me.ki > 25) {
    if (oppPushing || myBase < opEff + 0.45) {
      if (myBase + R.clash.pushPower >= opEff - 0.05) return 'push';
    }
  }
  return 'idle';
}
```
Hmm, one thing: if my ki is very low (< 25) but I'm ahead, no push ✓.

Also, should I push when my ki is 30 and the clash is long? Pushing drains 0.8/tick → 30 ki lasts 37 ticks. If the clash needs 100 ticks, I'd hit 0 → power 0.5 → lose. So require me.ki > 25 AND (the expected resolution is fast). We don't know. It's a gamble. Hmm, maybe require me.ki > 40? If my base is behind, I need the push to win. Let me use me.ki > 30.

Hmm, let me think about the typical clash scenario: both fire beams when they have ~50-100 ki. The clash drains 0.2/tick each (1.2 per 6 ticks) plus 0.6*6 = 3.6 per push tick-cycle. A clash lasting 100 ticks → 20 ki each (or 80 for the pusher).

I'll set the push condition: me.ki > 30.

Let me write the final code now. I'll also make sure the code handles `state.blasts` being undefined (shouldn't be).

Final answer code:

Actually, one more consideration about `pickFree` case 7 (the opponent free, idle/forward/back) with d <= 110 → 'light'. But what if our HP is very low and theirs is high? Doesn't matter.

Also, I want to reconsider the beam usage in case 7: `if (myKi >= R.beam.cost && d >= 280 && opKi < 30) return 'beam';`. Hmm, if the opponent is far and has low ki, the beam hits them for 280 (they can't dodge without ki) unless they block (120 chip) or dash forward through us (needs 10 ki → opKi < 30 doesn't stop them). Let me require opKi < 12 → then they can't dash. But then the condition rarely triggers (the opponent usually has ki). Alternatively, keep opKi < 30 and accept the dash-through dodge.

Hmm, alternatively: beam when the opponent is far AND we want to zone. If they dash through us, we can punish them during the dash recovery (they're in recovery, 8 ticks, vulnerable, and we can counter-hit 1.25×). So it's not a total loss.

Actually, hmm, wait. There's an important detail: if they dash forward through us and land behind, the beam fires away from them — but they've escaped. Our 50 ki is spent. Meanwhile, they're behind us and can attack our back. Meh.

Let me set the beam-at-range condition: myKi >= 55 && d >= 300 && opKi < 20. At d=300, they need 190 units to close = 42 ticks > 30 ✓ can't interrupt by walking. If they dash (10 ki) they can interrupt → so opKi < 12 would be needed for safety. I'll use opKi < 25 as a compromise.

Hmm, let me think about it differently: the beam's damage (280) is so high that it's worth it even with a 50% chance of being dodged. Expected value ~140-280 for 50 ki and ~1.5s. That's decent.

OK, writing the final code.

Actually, let me reconsider one more time the most common scenario: both fighters at mid range, the opponent is 'forward' approaching. We throw a blast? No — at d >= 150 we throw a blast; if they're approaching, the blast hits them as they close ✓. But blasts cost 20 ki. Alternatively, wait for them to come into light range (110) and start a light chain. Their approach takes (d-110)/4.5 ticks. During that time we could charge ki. Hmm, but they might attack.

I think throwing a blast at mid-range is decent (70 damage, they can't block it if they're walking... they can switch to guard at their next decision → the blast gets blocked (12 chip)). Hmm, so the blast has a high block rate. 70 damage if they don't block, 12 if they do. Expected ~40 for 20 ki. Meh. Versus closing in for a light chain (164 damage). The light chain is better but requires getting close safely.

Let me lower the blast usage: only use it when d >= 200 (so they can't close quickly) or against a specific purpose (interrupting a beam). Hmm, but then we do nothing while they approach. That's fine — we wait and then light-chain.

Hmm, but if we just wait (forward/charge), we might face a "turtle vs turtle" stalemate. The blast breaks the stalemate.

Let me use: blast when d >= 170 && d <= 420 && myKi >= 25 && opKi >= 30 (they have ki so they might block)... no. Let me simplify: blast when d >= 170 && myKi >= 25. Keep it.

Hmm, one thing I realize: the blast has a startup of 11 ticks and the projectile travels; they can block it if they switch to guard in time. But blocking costs them the 12 chip and gives them 14 blockstun, and they gain ground. It's fine.

OK final code. Let me write it.

Also: I should double check the `light` reach vs. the actual hit detection: the engine uses `d = (o.x - a.x)*a.facing; if (d > 0 && d <= reach)`. So the reach is center-to-center ✓.

And the push after a light hit: pushApart(m, a, o, 14) → o moves 14 away from us ✓ (or we move back if they're at the wall).

Let me now write out the code.

I also want to handle the case where we're in a 'clash' but the state also has... fine.

Writing now. I'll include brief comments in Chinese.

One more thought on the very first decision of a match: both fighters start at 350 and 650 (d=300). Both are idle. Our logic: d=300 → case 7 → not <= 110 → the beam condition (myKi=30 < 50, no) → blast (myKi=30 >= 25 ✓ and d=300 <= 420 ✓) → 'blast'. Hmm, at the start we throw a blast. That's 20 of our 30 ki. The opponent does the same probably. The blasts cancel each other in the middle (they're opposite and cross) → both wasted. Hmm! That's the "blast_clash" event. Both lose 20 ki and 29 ticks.

That's not great. Let's reconsider: at d=300, maybe better to charge ki (build to 50+ for a beam) or approach. Hmm. Since both sides will likely do something similar, let's think about what's optimal: at d=300 with 30 ki each, the options:
(a) charge: +0.36/tick → 100 ki in ~195 ticks (3.2s). Meanwhile the opponent closes or charges too.
(b) blast: 20 ki, 70 damage if unblocked (probably blocked or traded).
(c) forward: close the distance (190 units = 42 ticks).

I like: charge while the opponent is far, then close in with a combo. But if the opponent charges too, both charge; whoever has more ki wins... 

Let me add a rule: if d >= 220 and myKi < 50 → charge (before the blast). This makes us accumulate ki while the opponent approaches; when they're in range, we fight with lights/heavies. But charging exposes us to 1.5× damage if they reach us while we charge. Hmm, if they reach us, we switch to attacking (we get a decision every 6 ticks, so we'd notice).

Actually, since our decisions come every 6 ticks and the state is held, "charge" persists until we change it. If the opponent closes from 300 to 110, we get a decision when d <= 110 → we switch to light ✓ (but we might have taken a hit while charging).

Let me order the far-distance logic as:
1. beam (if the conditions hold)
2. dash_forward (if d >= 260 && ki >= 30) — hmm, this spends 10 ki to close 200 quickly. 
3. charge (if myKi < 50 && d >= 200)
4. blast (if d >= 170 && ki >= 25)
5. forward

Hmm, at the start (d=300, ki=30): dash_forward (ki >= 30 ✓) → we close to d=100 in 10 ticks. But the opponent might also dash/attack. Our dash has 9 invuln ticks ✓. Then we're at d=100 → light chain. That's aggressive but fine.

Hmm, but the dash lands us possibly behind them (if there's room) — the room behind them at x=650: behind = 650+200 = 850 <= 960 ✓ → we land at 850 (behind them, 200 away). Hmm, that's far: d = 200. Then we're behind them and they're facing us (they turn when free) → d=200 → we'd need to approach again. Ugh! The dash-through lands 200 units past them, which is too far.

Hmm right: dash_forward moves 200; if it passes through the opponent, we end up 200 units past them (or at least minGap). That's a big distance. Not great for a combo.

So dash_forward is better used for dodging or interrupting, not for closing. Let's remove it from the "approach" logic. Use 'forward' to walk closer (4.5/tick).

Revised far logic:
1. beam (conditions)
2. charge (myKi < 50 && d >= 200)
3. blast (myKi >= 25 && d >= 170 && d <= 420)
4. forward

At the start (d=300, ki=30): charge. Hmm, but the opponent might charge too, and we'd both charge until someone runs out of ki. Then the one with more ki attacks. With equal ki, it's symmetric → a coin flip. Hmm.

Alternatively, at the start: blast (20 ki) → they might block or trade. 

Honestly, the initial phase is a coin flip either way. Let me prefer charging early (to enable beams) but cap it: charge while myKi < 60 and d >= 180. Then when the opponent approaches, we fight.

Hmm, but there's a risk: they approach while we charge, hit us for 1.5×, and then we're behind in ki. Hmm. But the charge rate (21.6/s) is huge: in 3 seconds we gain 65 ki.

Alternatively: don't charge; just fight with lights/heavies/blasts (blasts cost 20 ki but we regenerate passively 2.4/s). The beam would be a rare luxury. Hmm, but 280 damage is huge.

Let's think about the value of the beam: to get 50 ki we need 1250 ticks passively (21s!) or 140 ticks of charging (2.3s). So charging is essential for beams. And charging is only safe when the opponent is far.

Balanced approach: charge when d >= 200 (they can't reach us with a light; a heavy reaches 140) and myKi < 70. Once they close to d < 200, stop charging and fight (using blasts/heavies). If they hit us while charging, we lose 1.5× damage but gain ki.

Hmm, alternatively, when they close in, we can counter with a heavy (they're approaching = free, so a light chain works).

I'll go with: charge when myKi < 70 && d >= 200.

Hmm, but then at the start: d=300, ki=30 → charge. The opponent (another bot) might charge too. After ~2.5s both have ~85 ki. Then whoever is closer... we're both charging, so the distance stays 300. Then we both have 100 ki (capped) → then we need to approach. Hmm, charging forever is a stalemate! Both at 100 ki, still charging (no benefit) → we stop charging at 70 and approach → the opponent also approaches → we meet in the middle → light chains. OK, that works: charge until 70, then approach.

But hmm, if the opponent is a "charge and wait" bot too, we'd both charge to 100 then approach ✓.

One risk: the opponent approaches while we charge → we take a 1.5× hit but we're at 70 ki with a beam ready ✓ → then we beam them. That's a great trade actually!

OK, let's finalize with: charge when myKi < 70 && d >= 190 (and not the opponent charging — if the opponent is charging, we might want to charge too to keep pace... but then we both charge. Hmm, if the opponent is charging and we're at 60 ki, and we charge → 70, they → 70... a race. Whatever, let me not charge when the opponent is charging; instead punish them: heavy if in reach, blast if far, else forward (to close and punish). Actually if the opponent is charging and we're far, we should close in to punish (they're vulnerable). But they can stop charging anytime (their decision cadence) → when we close, they'd switch to guard. Hmm.

Let's keep: if op is charging → heavy (in reach) / blast (far) / forward (close). That's what I had.

Alright, final code. Let me write it.

Actually, let me reconsider the charge threshold: myKi < 70. If we're at 69 ki and charging, we reach 70 in a few ticks and stop ✓.

Also, charging when the opponent is at d=190: their blast (20 ki, speed 13) could hit us while charging (1.5× damage = 105). Hmm. We handle incoming blasts by dodging ✓.

Let me write the code now, for real.

```js
function pickFree(s) {
  const me = s.me, op = s.opp, d = s.dist;
  const myKi = me.ki, opKi = op.ki;
  const oppStun = op.state === 'hitstun' || op.state === 'blockstun' || op.state === 'crushed';
  const oppDown = op.state === 'down';
  const oppBusy = !op.free && !oppStun && !oppDown && op.state !== 'ko';
  const hpLead = me.hp - op.hp;

  /* 1. 对手的气功波 */
  const inc = incomingEta(s);
  if (inc !== null && inc <= 20) {
    if (myKi >= R.dash.cost) return 'dash_forward';
    return 'guard';
  }

  /* 2. 对手起手大招 */
  if (op.state === 'beam' && op.phase === 'startup') {
    const rem = R.beam.startup - op.t;
    const sweep = Math.max(0, (d - 40) / R.beam.speed);
    if (d <= R.heavy.reach && R.heavy.startup < rem + sweep) return 'heavy';
    if (myKi >= R.blast.cost && R.blast.startup + Math.max(0, (d - 40) / R.blast.speed) < rem) return 'blast';
    if (myKi >= R.dash.cost && dashBehind(me, op)) return 'dash_forward';
    return 'guard';
  }

  /* 3. 对手蓄气 */
  if (op.state === 'charge') {
    if (d <= R.heavy.reach) return 'heavy';
    if (myKi >= R.beam.cost && d >= 150 && opKi < 20) return 'beam';
    if (myKi >= R.blast.cost && d <= 280) return 'blast';
    return 'forward';
  }

  /* 4. 对手出招中 */
  if (oppBusy) {
    if (op.state === 'beam' && op.phase === 'firing') {
      if (myKi >= R.dash.cost && dashBehind(me, op)) return 'dash_forward';
      return 'guard';
    }
    const lightDanger = op.state === 'light' && op.t < R.light.startup + R.light.active && d <= R.light.reach;
    const heavyDanger = op.state === 'heavy' && op.t < R.heavy.startup + R.heavy.active && d <= R.heavy.reach;
    if (op.state === 'blast' && op.phase === 'startup' && d <= R.heavy.reach) return 'heavy';
    if (lightDanger || heavyDanger) {
      if (myKi >= R.dash.cost && dashBehind(me, op)) return 'dash_forward';
      if (heavyDanger && myKi >= R.dash.cost && s.wallBehind >= (R.heavy.reach - d + 80)) return 'dash_back';
      return 'guard';
    }
    if (d <= R.light.reach) return 'light';
    if (d <= R.heavy.reach) return 'heavy';
    if (myKi >= R.dash.cost && d > 230) return 'dash_forward';
    return 'forward';
  }

  /* 5. 对手倒地 */
  if (oppDown) {
    if (myKi >= R.beam.cost && op.left >= 34 && d >= 120) return 'beam';
    if (myKi < 45) return 'charge';
    if (d > R.light.reach) return 'forward';
    return 'idle';
  }

  /* 6. 对手硬直 */
  if (oppStun) {
    if (d <= R.light.reach) return 'light';
    if (d <= R.heavy.reach) return 'heavy';
    if (myKi >= R.blast.cost && d <= 400) return 'blast';
    if (myKi >= R.dash.cost && d > 200) return 'dash_forward';
    return 'forward';
  }

  /* 7. 对手格挡 —— 破防 */
  if (op.state === 'guard') {
    if (d <= R.heavy.reach) return 'heavy';
    if (myKi >= R.beam.cost && d >= 260 && opKi < 25) return 'beam';
    if (myKi < 70 && d >= 190) return 'charge';
    if (myKi >= 25 && d >= 170 && d <= 420) return 'blast';
    return 'forward';
  }

  /* 8. 对手自由 */
  if (d <= R.light.reach) return 'light';
  if (myKi >= R.beam.cost && d >= 300 && opKi < 25) return 'beam';
  if (myKi < 70 && d >= 190) return 'charge';
  if (myKi >= 25 && d >= 170 && d <= 420) return 'blast';
  return 'forward';
}
```

Wait, there's an issue in case 8: `d <= R.light.reach → light` comes before the beam/charge/blast checks. That's fine since d <= 110 is close range.

Hmm, but one problem: in case 8, if d <= 110 we light. But what if the opponent is at d=110 and their heavy is about to come? We can't know. Fine.

Another issue: in case 4 (oppBusy), the punish branch: `if (d <= R.light.reach) return 'light'` — but if op is in light startup with op.t < 5, their light will hit us at the same time as ours (a trade). The lightDanger branch catches op.t < 8 → so the punish branch only applies when op.t >= 8 (recovery) ✓ no trade.

Hmm, wait: lightDanger requires op.t < startup+active = 8. If op.t is 5,6,7 (active frames), their light is hitting NOW (or already did). If op.t >= 8 → recovery ✓ punish.

But there's an edge: op.t = 4 → their active starts next tick; our light (startup 5) would hit at +5, theirs at +1 → they hit us first (we're in startup → counter 1.25 → 50 damage) and our light is interrupted. Bad. So lightDanger catches it ✓ (op.t=4 < 8) → we dodge/guard ✓.

OK. But hmm, for lightDanger, is guard really better than a trade? Guard: they hit us for 0, they get blockstun 11 and are pushed 14. Trade: we take 50, they take 50. Guard is better ✓ (unless we're desperate).

Now, one problem: the `lightDanger` branch returns 'guard' — but the opponent might be at d=60 and their light will hit; guarding pushes them 14 away (or pushes us back if they're at the wall) and we're in blockstun for 11 ticks. That's fine.

Now the case where the opponent is in 'dash' (op.state === 'dash'): they're invulnerable for the first 9 ticks. Our punish branch: `if (d <= 110) return 'light'` → we'd throw a light at an invulnerable opponent (waste). Better: wait for them to land, then punish their recovery. Hmm, but our decision cadence is 6 ticks; the dash is 10 ticks. If we 'idle' for a few ticks and then the dash ends (recovery 8 ticks) → we punish ✓. But if we throw a light now (startup 5), it might hit during their dash recovery (the dash ends at tick 10, our light's active is at ticks 5-7 → invulnerable → whiff). So we'd waste the light.
Let's handle: if op.state === 'dash' && op.phase === 'moving' → 'idle' (wait for them to land) or 'back'. Hmm, but if they're dashing toward us, they'll land close and then hit us in their recovery? No, after the dash they have 8 ticks of recovery (vulnerable), then they can act.
So: if op.state === 'dash' && op.phase === 'moving' → return 'idle' (let them land, then punish). But we might want to prepare a heavy. Let's just 'idle'.
Hmm, but if they're dashing away from us, 'idle' wastes time. Meh, 'idle' is fine.

Actually, if op.state === 'dash' && op.phase === 'recovery' → they're vulnerable → punish (light/heavy) ✓ (that's in the oppBusy branch).

Let me add to case 4: 
```
    if (op.state === 'dash' && op.phase === 'moving') {
       // 他在瞬移，等他落地
       return 'idle';
    }
```
Hmm, but the dash is invulnerable only for the first 9 of 10 ticks; at t=9 they're still in 'moving' but vulnerable. A light thrown now (startup 5) hits at +5 → they're still dashing → whiff. So 'idle' is right. But then we waste 6 ticks. Alternatively, if d > 150 (they dashed away) → 'forward' to chase. Let's do: if the opponent dashed away (they're now far), chase; else idle. Simplify: return 'idle' when d <= 140 else 'forward'.

Hmm, how do I know if they dashed away? Compare... I don't track the previous distance. I could track it in a module-level variable. Let's keep it simple: 'idle'.

Hmm, actually, a smarter idea: if op.state === 'dash' && op.phase === 'moving' and d <= 140 → they're dashing toward us (or sideways) → 'idle' and prepare. If d > 140 → they're far → 'forward'.

Fine.

Now let me also double check the "heavyDanger" dodge with dash_back: `s.wallBehind >= (R.heavy.reach - d + 80)`. wallBehind is the space behind us (away from the opponent). If d=140 and wallBehind >= 80 → we can dash back 200 → but we'd only move min(200, wallBehind) → we need the new distance > 140 → the new distance = d + moved >= 140 + something. We need moved > 140 - d + margin. With d=140: moved >= 40 (margin 80 → we require wallBehind >= 80 ✓ conservative). OK, the condition is conservative ✓.

But the timing: their heavy hits at (9 - op.t) ticks. If op.t is small (0), they hit at +9..12 → we're invulnerable until +9 (t<9) → at +9 we're at dash t=9 → not invulnerable (invuln requires t < 9) → but we've moved 180 units by then (18/tick at t=9) → out of reach ✓. OK.
If op.t = 8 → they hit at +1 → we're still invulnerable (t=0,1 < 9) ✓ but we haven't moved yet — we're at our original position, and their heavy hits at +1 → but we're invulnerable ✓ (the dash's first 9 ticks). Wait, the dash state starts at t=0 when we decide; the dash's invulnerability covers t < 9 → ticks 0..8 ✓. So a heavy landing at +1 hits an invulnerable us → whiff ✓. 

So dash_back works for any timing as long as we exit their reach before the invuln ends (t=9) OR their hit lands while we're invulnerable. Since the heavy's active frames are +9..+12 (from their startup), and we're invulnerable until +9, a heavy that lands at +9+ would need us to have exited their reach by then: we move 18/tick * 9 = 162 units by t=9 → d+162 > 140 ✓ (as long as wallBehind >= 162-ish). My condition requires wallBehind >= (140-d+80) which for d=60 → 160 ✓ close enough.

Fine, and the guard is the fallback.

Now let me write the final code text. I'll keep the comments concise.

Also note: I use R.light.reach etc. — make sure the property names are right: R.light.reach ✓, R.heavy.reach ✓, R.blast.cost/startup/speed ✓, R.beam.cost/startup/speed/fire ✓, R.dash.cost/dist/ticks ✓, R.clash.* ✓, R.minGap ✓, R.stage.left/right ✓, R.hp ✓.

Let me write it.

Final check on the cancel logic's 'light' choice when chain < 3: I should also consider whether the opponent might be about to recover (op.left small). If op.left < 6, our light (5 startup) might land after they recover → they might block it (no damage) but we keep our position. Acceptable.

Let me write the code.

One more: in pickCancel, if d > 140 (can't heavy) and d > 110 (can't light) → 'idle'. Fine.

Writing the final answer now.

Oh wait, one more important thing: the `decide` function must return one of the valid action names. 'idle', 'forward', 'back', 'guard', 'charge', 'light', 'heavy', 'blast', 'beam', 'dash_forward', 'dash_back', 'push' ✓ all used are valid.

Let me write the code.