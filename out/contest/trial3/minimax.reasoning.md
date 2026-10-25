We need write a JS bot. Need design robust strategy.

Key mechanics: states given, decisions every 6 ticks while free. We need manage ki, spacing, combos, anti-air.

Let me think about a solid strategy design.

Distances: light reach 110, heavy 140, blast travels.

Strategy:
- Close to punching range: dist <= 110 start light, then on cancel (canCancel true, chain) continue light up to 4 chain, then heavy maybe. Each light hit gives 40 damage with combo scaling on target: 1, 0.8, 0.65, 0.55 → chain of 4 lights: 40+32+26+22=120. Then heavy 120 = 240 if connects (heavy reaches 140). But heavy recovery 22+9+4=35 ticks, risky.

Actually chain: light cancels chain up to 4 light punches (R.light.chain=4 means chain < 4 for another light; chain starts 1 after first light, so cancels allowed while chain<4 → up to 4 total). After 4th light, cancel window still given but chain=4 so light not allowed; can heavy/blast/beam.

But opponent gets hitstun 15, combo scaling. During cancel, next light starts immediately: light startup 5, active 3. Target hitstun 15 from first hit. Timeline: hit at tick t; next tick cancel → new light starts (t=0 at tick t+1), startup 5 ticks → active at t+6ish. Target hitstun 15 → they recover before second light? hitstun dur 15 from hit tick; second light connects ~6 ticks later, within 15. Good. Third: hit at t+6, new cancel next tick, startup 5 → hits at ~t+12, target hitstun from second hit lasts 15 → until t+21, so third hits at t+12 fine. Fourth: hits t+18, target stun until t+27 fine. So 4 lights combo possible, scaling 1,.8,.65,.55 → 120 damage.

But is light reliable? Opp can guard. If they guard, light blocked → they get 3 ki, attacker gets pushback... Actually blocked light: no cancel. Blockstun 11. We still have advantage.

Heavy at range 140: startup 9 → 9 ticks vulnerable.

Anti-beam: if opp starts beam, we could also beam (answer) if ki >=50, or dash_back (16 ki, invuln 8 ticks) to dodge. Beam startup 30; dash gives invuln 8 of 10 ticks moving. If we dash_back during their startup, we escape. Beam answer: beam costs 50 and both fire → clash; in clash we can push. That's good actually: clash, push to win, 320 damage.

If opp beam startup and we're in beam's path (they face us), answer beam → clash. Good. If not enough ki (need 50), dash_back.

Clash: push when myPower >= oppPower, to win. But push costs 0.6 more ki per tick; if ki empties power=0.5 → lose. Compute: power = 1 + 0.02*ki + 0.6 if push. Push beneficial if 0.6 > 0.02*ki lost ~... Better strategy: push when ki >= some threshold and myPower > oppPower (without push). If ki low, don't push (keep power from ki). Since power difference drift = (pa-pb)*0.1*dir, plus noise sd 0.8 per tick. Clash speed decays 0.95. To win need point to travel from center 0.5 to body. Actually pos relative: reaches when c hits body ± body=30. Distance from 350 to 650 = 300, half = 150 units. Drift per tick with power diff 0.3 → 0.03 speed contribution accumulating ~0.03/(1-0.95)=0.6 steady state → 150/0.6 = 250 ticks. Noise sd 0.8 random walk though. Push gives +0.6 power → drift 0.06 → steady 1.2 → ~125 ticks. Hmm, that's slow, and max 360 ticks → draw 120 damage each. Pushing helps significantly. Also as ki drains 0.2/tick (0.8 if pushing), ki power falls. Start ki maybe 50ish.

Key insight: ki drains 0.2/tick in clash regardless; with 100 ki, lasts 500 ticks. Pushing 0.8/tick → 125 ticks. So push when advantage, but also ki drops.

Better: push if myPower(with push) > oppPower + margin, and ki > ~15. Typically clash occurs when both used beam (50 ki each) → ki maybe ~40. Power 1+0.8+0.6=2.4 vs opp 1.8 → drift 0.06 → win in ~125 ticks. But opponent can push too, symmetric.

Also hp<30% gives +0.4.

Blast usage: cost 14, startup 11, projectile travels at 13. If opponent is far, blast can hit while they approach. Also to interrupt a beam? Beam swallows blasts; blast into beam gets swallowed (beam swallows opponent's blasts) - actually in beams(): for each b, for each beam, if beam.owner !== b.owner and inRay → b.dead. So our blast dies in their beam ray. Fine.

Heavy is strong: 120 damage, knockback 150, down 42. Reach 140. Startup 9. Beats guard (crush). If opponent guards, heavy does 60 chip + crush stun 34.

Overall plan:
- Maintain spacing: prefer dist ~ 100-130 for heavy reach but light reach 110.
- Use dash_forward to close quickly when far and ki adequate (16). Or walk forward.
- Anti-air: dash_back on incoming blast? Blast has 11 startup and travels 13/tick; at dist 300 takes ~20 ticks to arrive. We can see blasts with eta. If incoming blast eta small (< 6?) hard to react since decisions every 6 ticks. Use guard to block blast (cost 6 ki, chip 12) or dash to be invulnerable. Dash back 8 ticks invuln — but if eta < 8, dodges. But we get asked every 6 ticks; decision latency up to 6 ticks. Dash needs to be started before blast within ~8+ ticks. Use guard when blast incoming (cheap, chip only) and use dash_back to escape if eta < ~10? Actually guard blocks it: 12 chip damage, 6 ki, blockstun 14. That's cheap and safe. Better: guard against blast. But guard doesn't stop heavy; heavy crushes.

Consider ai opponents likely aggressive. We don't know them. Write a solid generic bot.

Design a decision function with state machine per match (top-level variables reset per match since module reloaded? "文件顶层的代码在每局开始时执行一次" so variables reset each match). Good, we can store per-match memory.

But note decide is called with views; each side has own. We only control one side.

Let me define a plan structure: this.mode ('approach','attack','retreat','zone'), plus timers.

Simple heuristic decision tree each call:

1. If state.clash: decide push vs not. Push if state.clash.myPower + 0.6 > oppPower + 0.1 and my ki > 12, else if myPower >= oppPower and ki<12 don't push. Basically: if myPower(with push) > oppPower → push. Also if hp advantage big? Let's push when myPower + 0.6 > oppPower + 0.15 (i.e., myPower > oppPower - 0.45). Also don't push if ki < 8 (since with 0 ki power = 0.5, losing +0.6 push). Note power formula: if ki>0: base+0.02ki (+0.6 push); else empty=0.5. So at ki<5 pushing gains little relative to ki loss. Condition: push if (ki>5 ? 1+0.02*ki+0.6 : 0.5) > oppPower + 0.05.

Actually myPower in state already includes push status from previous tick (our a.push persists until next choice). state.clash.myPower computed with current push flag. If we returned push last tick, myPower includes +0.6. So compare: if myPower > oppPower → keep push; else if myPower + 0.6 > oppPower → push; else don't push (idle). But careful: myPower includes +0.6 when we're already pushing, so "myPower + 0.6" would double count. Handle: we know our own previous action? We can track last action in a variable. Simpler: compute own power from state.me.ki and whether our last action was push.

Let me track: let lastPush = false (set when we return push).

Power calc: p(ki) = ki>0 ? 1+0.02*ki : 0.5, + rage 0.4 if hp<300, + (push?0.6:0).
Decision: candidate push power = p(ki) + 0.6 (if ki>0) vs oppPower (which includes their push). If candidate > oppPower + 0.1 → push (and lastPush=true). Else → 'idle' (lastPush=false). But we can only change push every 6 ticks; ki drains so if we're not pushing we keep more ki → power rises by 0.02*0.2*6=0.024 per decision, tiny.

If ki < 4, pushing: power = 0.5+0.6=1.1 with drain 0.8/tick → dead fast. Don't push if ki<6.

2. If opp is in beam startup/firing aimed at us (opp.state==='beam' and phase startup or firing, and opp facing toward us i.e. (me.x-opp.x)*opp.facing > 0):
   - If we have ki >= 50: answer beam → creates clash. But clash risk: could draw. Alternatively dash_back for 8 invuln ticks to dodge beam entirely: beam fired for 40 ticks, covers ray; if we dash behind them or out of ray, we dodge. Dash back 200 units, invuln 8 ticks — beam startup 30 ticks (if we start dash at their startup, plenty). Dash back moves away; beam ray extends 30/tick*40=1200, covers stage anyway. Being in ray doesn't matter — the beam hits a body it covers once; invuln first 8 ticks; if we dash back and remain in ray, after invuln ends we get hit! Beam ray covers from shooter to front (front travels 30/tick for 40 ticks = 1200, so whole stage). So dashing back doesn't escape ray since front keeps advancing 1200 distance; it will reach us. Unless we dash past them (behind the shooter) — then ray direction opposite, safe! Dash forward through opponent lands behind them → beam ray goes away from us. That's the dodge! dash_forward passes through to behind if room. If opponent near a wall, no room behind → stops in front.

   So counter to beam: dash_forward to get behind (16 ki) if possible; or answer beam (clash) if ki>=50; else guard? Guard vs beam: chip 160 and stun until beam ends. Bad.

   Let's prioritize: if ki>=50 → answer beam (clash). In clash we're in control with push. But clash also: if we lose, we take 320 and down 60 — vs beam hit 280 damage + down 50. Similar. If we win clash: opponent takes 320 down 60, we survive with 20 recovery ticks. Answering beam seems strong, especially if we then win clash. But opponent may push harder. Also both beams fire at same time → clash immediately with pos at middle? Clash point = average of fronts, both at from positions so c ≈ midpoint between fighters. Yes.

   Alternatively dash_forward behind to avoid entirely, if we can land behind (need opp not at wall edge? Actually behind of opp relative to their facing; they face us so behind is past them away from us). Wall check: opp near wall (e.g., x=940 facing left) then behind = 1000 > 960 no room → dash stops in front (dist 60). Then beam hits us. Need to check wallAhead for opponent: wallAhead in my view is my own. I can compute opp wall: opp facing: if opp.facing>0 opp's ahead = 960-opp.x else opp.x-40. Behind them = opposite side: room behind = (opp.facing>0 ? opp.x-40 : 960-opp.x). Need room for body center ≥ 40+30? dashEnd requires behind = o.x + d*max(minGap, -after) within [L,H], so need ~ 30+ maybe. Room behind opp ≈ distance from opp to wall behind them; need ≥ minGap=60? behind = o.x + d*max(60, ...) — the check behind>=L && <=H with max(minGap,-after). If after negative large (200 past), max(60,200)=200 → needs 200 beyond. Hmm: dash forward 200 dist; if opp at distance 100 ahead, after = 100-200 = -100 → max(60,100)=100 → behind = opp.x + d*100 → needs 100 room. If opp is 200+ away, dash lands short (not through). So dash-forward through only works when opp within 140ish and there's room behind them.

   So: to dodge beam, dash forward if opp close (dist <= 140ish) and there's room behind them; else answer beam if ki>=50; else guard and pray (chip 160 hurts but survives).

   Alternative: dash_back with invuln? No, ray extends.

   Hmm but beam also: if we get hit during their startup, their beam breaks! Beam startup 30 ticks, "起手 30 tick（这段时间挨打就会被打断）" — code: land() on a beam-owner during startup → stun(o,'hitstun') interrupts; their beam stops (m.beams[a.side] null since state!=='beam'). So we can interrupt their beam startup with a light punch (40 dmg, hitstun) if in reach 110! That's excellent: if opp beam startup and dist<=110, punch them to interrupt. Or blast (60) — but blast takes 11 startup + travel. Light startup 5, needs to land before their su (30 ticks) — plenty.

   Also heavy 120 interrupts with crush.

   So priorities vs opp beam:
   a) if dist<=110: light (interrupt).
   b) else if ki>=50: answer beam (clash).
   c) else if dash through possible: dash_forward.
   d) else: heavy? heavy reach 140 only. blast? Blast swallowed by beam (beam swallows blasts when ray covers it; beam starts firing at t=su, during startup ray doesn't exist yet? m.beams[a.side] set when t===su i.e. at firing start). During their startup we could blast and hit them before they fire? blast travel 13/tick, at dist 200 takes ~12 ticks + 11 startup = 23 < 30 → interrupts! But blast must not be swallowed — swallowed only during firing. If it hits them during startup, good. So blast can interrupt beam startup if distance < ~ (30-11)*13 = 247. But if our blast gets eaten by the beam when it fires (if we miss), no damage. Also opponent might guard the blast (chip 12). Fine.
   e) guard if nothing else.

3. Incoming blast: guard (cheap) or dash if we can be invuln? Blast speed 13, we can also just guard. Guard: cost 6 ki, chip 12, blockstun 14 (we're stunned 14 ticks). Alternatively dash_forward/back gives invuln 8 ticks; blast eta maybe > 8. But blast's hit: if invuln at time of contact → dodged. Dash start has ~0 delay; 8 invuln ticks covers eta. But we get asked every 6 ticks, so eta known. If eta <= 10 → dash (any direction, prefer dash_back? dash_back costs same; invuln covers). But dash also has 18 total ticks, we're vulnerable after. If eta is 9, dash now: invuln ticks 0-7 relative to move start; blast arrives within ~9 ticks → dodged. Good. Use dash when eta<=9 and ki>=16 and no beam incoming; else guard.

   Note blast can also be blocked, and blocking gives attacker pressure... fine.

4. Normal combat: if dist <= 110 (light reach): attack with light to start a chain. On cancel (me.canCancel): continue chain light while chain<4, else heavy (reach 140) to cash in; heavy after 4 lights hits for 120 (combo scale 0.4? wait combo scaling applies to target's consecutive hits: after 4 lights, combo=4 → next damage scale = combo[4]=0.45 → heavy 120*0.45=54. Hmm! Combo scaling hurts the follow-up. Actually combo array index: after hits 1,2,3,4,5 → scale for 5th hit is combo[4]=0.45. So heavy as 5th hit does 120*0.45=54 — bad. Better to end with light chain of 3 and heavy 4th? scales: 1st light 40, 2nd 32, 3rd 26, 4th (heavy) 120*0.55=66. Still worse than light's own scaling. Hmm heavy damage 120 with reach 140; landing it as first hit = 120. So better: heavy as first hit, or use heavy when target isn't in combo (target free).

   Alternatively: heavy first hit does 120 + knockback 150 + down 42 → big. Then when they get up we attack again.

   Or blast chain: light, light, then blast (60, scale 0.65 → 39) meh.

   Combo scaling is applied to the target's consecutive hits without becoming free. So the first heavy is best uncountered.

   Let's plan: when in range and opponent free/guarding: choose heavy if dist<=140 and (opp.state is free-ish i.e., 'idle','guard','forward','back','charge'?) and ki/HP considerations; heavy crushes guard. When opp in hitstun (combo>0), light chain is better value? 40*scale. Actually a light as second hit = 32; third 26; fourth 22 = 80 total over 4 lights vs heavy 54 as 4th. So continue lights to 4, total 120 over 4 lights and combo ends after? After the 4th light hits, opponent still in hitstun 15 (from 4th hit) → their hitstun timer resets? stun(o,'hitstun',15) each hit resets duration to 15. Then our light's recovery 9 ticks; opponent recovers 15 ticks later; we can't cancel after 4th (chain limit) so we must wait. Meanwhile opponent recovers and blocks next.

   Alternative combo design: light (40), cancel to light (32), cancel to light (26) = 98, then cancel to... heavy (54) = 152 total in 4 actions; vs 4 lights = 120. Hmm heavy as 4th: 120*0.55=66 → total 40+32+26+66=164. Wait heavy is 4th hit total: combo index 3 → 0.55 → 66. So 4 lights (120) + heavy as 5th (0.45*120=54) = 174 vs light,light,light,heavy = 164. Let's recompute light as 4th: 40*0.55=22 → total 40+32+26+22=120. Yes.

   So heavy 4th: 164 > 120. And heavy has reach 140 and knockback. But heavy startup 9 ticks — will it land? Opponent in hitstun from 3rd light: hitstun 15 ticks, our 3rd light hit at t; heavy starts next tick, startup 9 → hits at t+10, opponent recovers at t+15 → still in stun → lands. Good. But wait, after 3rd light cancel → heavy startup 9 ticks: active frames at ticks 9-12. Opponent hitstun ends at 15 → still stunned. Heavy hits with 0.55 mult. Ok.

   But careful: heavy knockback 150 + down 42 gives us a free window; good.

   However: if opponent guards our first light, no cancel, we get pushed back and they blockstun 11.

   Also the value of chain: hitting opponent in hitstun means they can't act. So even light-only chains give us free hits.

   Let me think about which is best overall: Option A: light,light,light,heavy: dmg 164, needs dist<=110 for first lights. Option B: heavy first: 120 + down. Option C: light,light,light,light = 120.

   Since heavy also knocks down (42 ticks untouchable) while light just hitstun, and heavy's 120 chip... heavy seems strong but heavy also pushes away 150 (distance grows) and has 35 tick total recovery.

   Plan: prefer heavy as finisher after 3 lights (chain 3). Also if opp is charging (chargeHit 1.5) punish with heavy. If opp in startup/recovery (counter 1.25) punish with heavy.

   Also light chains: only chain if opp is in hitstun after first hit? We can't know at cancel time? state.me.canCancel true tells us our light landed (not blocked). So on cancel, we know we hit. So chain always fine.

   Actually on cancel we could also choose 'heavy' immediately as second hit: 40 + 120*0.8=96 =136 in 2 hits, faster and knocks down! Versus light-light-light-heavy 164. Hmm light,light,heavy: 40+32+120*0.65=78 = 150. light,heavy: 136. light,light,light,heavy: 164 but takes longer (3*~11 ticks = 33 ticks, opponent stun from 3rd lasts 15 so heavy startup 9 fits).

   I'll go: on cancel with chain==1: light (continue) if opp still close? Chain continues to chain 3 then heavy at chain==3 (i.e., 4th action is heavy). Risk: opponent might block the 2nd light? If opponent was in hitstun they can't act until stun ends; 2nd light lands during their hitstun (15 ticks) → yes lands. 3rd light: after 2nd hit stun reset to 15; our 3rd light startup 5 → hits within stun → lands. 4th heavy startup 9 → hits within 15 → lands. Good, deterministic.

   But wait: opponent's hitstun: is it 15 from hit? stun sets dur=15, t=0. Then next tick increments. So ~15 ticks. Our 3rd light: after 2nd hit at tick T (cancel decision same tick T+1 → light starts, startup 5 → active at T+6ish). 3rd hit at T+6 → their stun resets 15 → free at T+21. Our 4th heavy starts T+7, startup 9 → active T+16 → hits before T+21. 

   So combo: light, light, light, heavy = 164 damage, ending with knockdown, taking ~T+16 ticks. Excellent.

   Distance: heavy reach 140. Light pushApart pushes opponent 14 on each hit, so distance grows: after 3 lights, dist grows 14*3=42 (both pushed? pushApart: o pushed 14 away; if wall, attacker slides). Starting dist <=110 → after lights ~152 > 140 → heavy out of range! Hmm. pushApart pushes the opponent away from attacker each hit: o.x += dir*14 where dir from a.x to o.x. So the target moves 14 away each light hit. So need to start closer: dist <= 110-28 = 82 to allow heavy reach after 2 lights? Let's compute: heavy lands after 2 lights pushes (2*14=28) → need dist_at_heavy_time <=140 → dist_start - 28 <= 140 → dist_start <= 168 (no constraint). Wait pushes increase distance, so heavy reach check is dist <=140: dist grows so heavy hits only if dist_start + 28 <= 140 → dist_start <= 112. Fine — start at 110 → 138 ≤140 ✓. Third light adds 14 → but heavy check occurs after 3 lights: dist = 110+42=152 > 140 → misses! So use 2 lights then heavy: dist 110+28=138 ≤140 ✓. Damage 40+32+120*0.65=78 → 150 total. Or start closer: if dist <= 98, 3 lights then heavy works (98+42=140 ✓).

   Also we can walk forward during cancels? No, moves are locked.

   Let's design: at range, if dist <= 95: light,light,light,heavy (164). If dist 95..110: light,light,heavy (150). Simpler: light then on cancel chain=1: if dist <= 100 → light else heavy? Distance after first light grows by 14 → need recompute: after first light dist' = dist+14. For 3 lights then heavy: need dist+42<=140 → dist<=98. So cancel decision (chain=1, dist measured after push? The push happens in the same tick as the hit; state view at cancel tick reflects post-push positions. Yes since cancel tick is next tick after hit). So at cancel, dist reflects +14 already.

   Plan at cancel (chain==1): we want to chain light if dist + 28 <= 140 (i.e., 2 more lights then heavy): dist<=112 → after 2 more lights dist+28, heavy reach ok. So light. Then cancel chain==2: if dist + 14 <= 140 → dist<=126 → light (3rd) then heavy at dist+14. else heavy now (dist<=140). So:
   - cancel chain 1: if chain<4 and dist<=112 → light else heavy.
   - cancel chain 2: if chain<4 and dist<=126 → light else heavy.
   - cancel chain 3: if chain<4 and dist<=140 → light else heavy. (4th light at dist<=140? light reach only 110! light must have dist<=110 to hit. So light requires dist<=110.)
   Let me redo: light needs dist<=110 at its hit time; heavy needs <=140.
   - cancel chain1 (dist d1 after 1 light): light if d1<=110 (and then heavy needs d1+14+14<=140 → d1<=112) — combined: light if d1<=110 and d1<=112 → d1<=110. But actually if we light again and then heavy, need d1+28<=140. So light if d1<=110.
   - cancel chain2 (dist d2 = d1+14): light if d2<=110 and d2+14<=140 → d2<=110 → heavy after needs d2+28? Wait after 3rd light, dist = d2+14, heavy reach 140 → need d2<=126. Combined with d2<=110 → d2<=110.
   - cancel chain3 (dist d3 = d2+14): if d3<=110 → 4th light (22 dmg), else heavy (54). Actually chain limit 4 means at chain==3 we can still do a 4th light (chain<4 → chain becomes 4). At chain==4 cancel we can only heavy/blast/beam.
   - cancel chain4: heavy if dist<=140 else blast? Blast travels.

   Damage totals:
   case 4 lights: 40+32+26+22=120, no knockdown.
   case 3 lights + heavy: 40+32+26+ (120*0.55=66) = 164 with knockdown. 
   So prefer 3 lights + heavy over 4 lights. Rule: at cancel chain==3 (3rd hit done) → heavy (dist after 3rd light = d2+14; need <=140: d2<=126 ✓ typical). So:
   - chain1 cancel: if dist<=110 → light (then chain2) else heavy.
   - chain2 cancel: if dist<=110 → light (then chain3 → heavy) else heavy.
   - chain3 cancel: heavy if dist<=140 else blast/other.
   - chain4 cancel: heavy if dist<=140 else blast.

   That gives 164 damage combos with knockdown. 

   Also could end with beam for 280*0.45=126 — but beam 50 ki and long startup, risky. Blast 60*0.65=39 not worth.

   Starting the chain: at dist<=110 and opp is free (idle/guard/forward/back/charge) → light. But if opp is charging, punish: heavy (×1.5 = 180!) instead of light. If opp in startup/recovery (e.g. their blast startup) → heavy ×1.25 =150. If opp in hitstun already (they're combo 1+) → light chain.

   If opp guarding → light gets blocked (they pay 4 ki, we get pushed). Better vs guard: heavy (crush 60 dmg + 34 stun) or blast (chip). Heavy is good: 60 chip damage + crush stun 34 + we get their guard broken. But heavy vs guard: code land() with kind heavy → crush: hurt 60, stun crushed 34. Note heavy's knockback/down doesn't apply to guard crush. Still good: 60 damage.

   Actually vs guard, blast chip 12 for 14 ki; heavy is better (60 dmg free).

   If opp in 'down' state: untouchable; approach/position.

   Also, when opp has hp low (<30%) they get rage ki; not much to do.

   Spacing management: we want to stay in our attack range but also manage ki. Light free, heavy free. Ki is needed for beam (50), dash (16), blast (14). Guard costs ki over time (0.03/tick) and per block.

   Strategy when far (dist > 140): approach with forward walk (free ki +0.04/tick) or dash_forward (16 ki, 8 invuln, 200 units). Dash through opponent can put us behind them, which is good against beams but then we need to walk around (we're facing them; behind means... "落地后到收招结束前你还面朝原来的方向；对手空闲的话会立刻转身" — opponent turns to face us, so we can't exploit being behind except during dash recovery).

   So dash_forward mainly for closing distance (200 units in 10 ticks) and for dodging beams.

   Ki economy: we get 0.02 per damage dealt, 0.08 per damage taken. 40 dmg hit = +0.8 ki. Ki start 30. Charging gives 0.32/tick → 100 ki in ~220 ticks (3.7s). Charge is vulnerable (×1.5 damage) but if far from opponent, safe.

   Idea: maintain a "ki bank" for beam. Beam at 50 ki, and answering opponent beam is strong. Beam damage 280 (or 160 chip if guarded).

   Plan for our beam usage: when dist <= ~200 and opponent free & we have 50 ki and opponent not in hitstun? Beam startup 30 ticks — opponent can interrupt with a light if within 110, or blast. Risky but high reward. Beam also knocks down 50 ticks.

   Use beam when opponent is in hitstun/guard? If opp in hitstun they can't interrupt but hitstun 15 < 30 startup → they'd recover and interrupt. If opponent guarding, beam chip 160 + stun, that's great actually (160 damage!). If opp is knocked down (down 42) — beam startup 30 < 42 → they can't act → full 280! Nice: after our heavy knockdown (42 ticks down), we can start beam (30 startup) → hits for 280 while they're still down (assuming they get up at 42 and beam fires at 30... they'd be up at 42 and can act at 43 but beam fires at 30, hits then). 

   So combo: heavy (knockdown 42) → beam (startup 30) → 280 damage + knockdown 50. Total from combo: 164 + 280 = 444! That's a huge burst. Timing: heavy hits at tick X, opponent down for 42 ticks starting X. We have heavy recovery 22 ticks then free. We can start beam at X+22 (or X+23), startup 30 → fires at X+52, opponent down until X+42, up at 43, then free to act at 43 — they could interrupt our beam startup (light within 110 → hits during startup, interrupts). Hmm. So risky unless we keep distance. Beam reach: beam covers ray; the opponent can interrupt our startup only by hitting us (light/heavy reach). If dist > 140, they must walk to reach us. So if heavy knocked them away 150, dist ~290 → they need to walk 150 units = 34 ticks > 30 startup. Marginal! If dist > 155 they can't reach in time. Heavy knockback 150 plus our initial dist. If we hit heavy at dist ~140, opponent pushed to dist ~290 → they need to close 150 → 34 ticks > 30 → our beam fires before they reach. 

   So: heavy → walk forward slightly? Actually we should keep distance and charge ki in the meantime. Beam costs 50 ki; after heavy we might have low ki. Damage taken gives ki 0.08/dmg: heavy 120 → +9.6.

   Realistically we need to bank ki before a big combo.

   Let's structure the bot with a "strategy" per state:
   
   Core loop when free:
   - If incoming blast: guard or dash.
   - If opp beam startup aimed: interrupt if possible (light if dist<=110), else answer beam if ki>=50, else blast if dist<240 and opp won't fire... hmm blast during startup: if their startup remaining >= 11+travel, blast hits and interrupts. Need remaining startup time. state.opp.t and phase startup: remaining = 30 - opp.t (if not answered). Blast needs 11 startup + ceil((dist-30)/13) ticks. If that's < remaining → interrupt. But if the beam is answered (su = counterStartup 12), remaining = 12-opp.t. Our blast can't beat that. Then better answer beam ourselves (they'd be in "startup" with su=12). Hmm, if opp already answered, we can't easily. Let's keep simpler.
   - If opp in down: approach to set up heavy/beam; also charge if ki low.
   - If dist <= 140: attack (light/heavy per above).
   - If dist > 140: close (forward walk or dash if far & ki ok), or charge if we want beam and are safe.

   Ki management: keep reserve. Let's define kiReserve: we want >= 50 for beam opportunity. Use blast rarely (chip only 12 vs guard, 60 damage but slow). Blast is decent for interrupting and for hitting far opponents (60 damage at long range while opponent approaches). But blast startup 11 + travel; opponent can guard it (chip 12) → fine. Blast also cancels opponent's approach? It stuns them 20 ticks (if not blocked). Blast damage 60 with combo scaling.

   I'd use blast when: opponent far and closing (dist > 200) and ki >= 40 (keep reserve) — but blast travels from our front 40 toward them; if they close, it hits. Also blast to interrupt their beam startup.

   Also blast risk: opponent may blast too; two blasts cancel.

   Also heavy vs guard crushes: 60 dmg.

   Now let's also think about what the AI opponents are like (unknown). Probably they implement similar rules with some heuristics. Our bot should be solid: guard against incoming blasts, punish whiffs, counter-attack during opponent recovery (counter ×1.25).

   Counter opportunity: opp in light/heavy/blast startup or recovery → heavy if in range (×1.25 = 150) — big. Also their blast recovery 18 ticks, heavy startup 9 → 9+... we need to be in reach 140.

   Let me write the decision logic in priority order.

Let me define helper functions reading state.

```
function decide(state) {
  const me = state.me, opp = state.opp, R = RULES;
  // clash
  if (state.clash) { ... return push or idle }
  if (!me.free && !me.canCancel) return 'idle'; // shouldn't be called except cancel
  ...
}
```
Wait: decide is only called when free or clash or cancel. So handle.

Now main free-state logic:

```
const incomingBlast = state.blasts.find(b => !b.mine && b.incoming);
const oppBeam = opp.state === 'beam' && opp.phase !== 'recovery';
const aimedAtMe = (me.x - opp.x) * opp.facing > 0;
```

Priority 1: oppBeam aimed:
 - if opp.phase==='startup':
    - remaining = opp.su? we don't know opp.su. We know opp.phase startup and opp.t. Startup could be 30 or 12 (counter). We can estimate: if opp.t small... hmm. Alternative: if dist<=110 → light to interrupt (5 startup + push; their startup ≥? if their su=12 and t=11 remaining 1 → our light lands too late). Risky. 
    Let's handle: if opp.phase startup and dist <= 110 → light (interrupt) — but if their su=12 and they're at t=8, we can't interrupt; they'd fire at t=12 and hit us before our light (active at 5+... our light started at t+0 → hits at +5..7 → if their fire at t=12-8=4 ticks away, we get hit). Hmm. But if su=12 means they answered our beam; then we're probably in clash already. Let's ignore nuance.
    - if dist > 110 and ki>=50 → beam (answer) → clash.
    - else if dist > 110 and ki >= 30 (blast cost 14 + keep?) → blast to interrupt (only if their startup is long i.e. opp.t small). If opp.t <= 3 → remaining >= 27 (if su=30) → blast (11+travel) can interrupt if travel < 16 → dist < ~240. But if su=12, remaining ~9 → no.
    - else → dash_forward to get behind if possible (dist<=140 and room behind opp) else guard.
 - if opp.phase==='firing': beam already out; options: answer beam (if ki>=50) → but they already fire, we'd fire at counterStartup 12 → then clash. Yes answer works. Or dash through if dist<=140 & room behind → dodge. Or guard (chip 160, but "一直硬直到大招结束" - stun long).
    Actually if beam is firing and we answer with beam, we clash: our beam fires 12 ticks later; but during those 12 ticks their beam hits us (280 damage) unless we're out of range/invuln. Hmm! Their beam front travels 30/tick; at dist 300, it reaches us after (300-30)/30 = 9 ticks → we get hit before our counter fires at 12. So answering a firing beam fails unless dist large enough that their beam takes >12 ticks to reach: dist > 12*30+30 = 390. And even then our beam starts at 12 ticks later but their beam front is at 360 and we at 390... their front continues to reach us at tick 12 → they'd hit us exactly then. Ugh. So answering a firing beam is generally bad. Better: dash behind them (invuln 8 ticks) but beam ray... if we get behind them, out of ray → safe. Dash forward through: needs dist<=~140 and room behind.
    Or if beam already firing and we can't dodge: guard (160 chip) or accept.
    Alternatively dash_back won't help (ray extends).
    Hmm, actually if we dash forward through them, the dash takes 10 ticks, invuln 8; during the dash we pass through them (ray covers both positions? The beam hits body it covers; we are invulnerable during first 8 ticks; then 2 ticks of dash not invuln but we're behind them by then (dash moves 200 over 10 ticks). If we land behind, we're out of the ray → safe. Good.

    So beam dodge priority: dash_forward through if possible (dist <= 150ish and room behind opp >= ~60 and opp not too close to their back wall). Compute: our dash direction toward opp; we land at x1 = me.x + facing*200 clamped, with pass-through rule. Rather than simulate, approximate: need dist <= 140 (to be within dash's 200 travel) and opp's room behind (opposite to their facing): roomBehindOpp = opp.facing>0 ? opp.x - 40 : 960 - opp.x. Need roomBehindOpp >= 70ish (since landing behind requires opp.x + d*max(60,200-dist)). If dist=100, after=-100 → need 100 behind. Hmm the rule: behind = o.x + d*max(minGap, -after) = opp.x + d*max(60, 200-dist). So need room behind opp >= max(60, 200-dist). With dist 100 → need 100 room. That's often unavailable. If not available: falls to "else x = o.x - d*minGap" (stop in front, dist 60) → we'd be in ray → hit. Bad.

    So dash-through is only good when opp has ≥100 room behind them, meaning they are far from their back wall (i.e., toward us... they're facing us so behind them is away from us; room = distance from opp to wall behind them). Typically opp at center with 300+ room behind → good if dist ≤140.

    Let's compute needed: max(60, 200-dist) ≤ roomBehind. With dist<=110, 200-dist>=90 → need ~90-100 room behind. Common.

    So dodge beam: if dist<=140 and roomBehindOpp >= 200-dist+10 → dash_forward.
    Else answer beam if ki>=50 and opp.phase==='startup' (not firing).
    Else guard.

Also if opp beam startup aimed and we can't interrupt and don't want clash → maybe blast interrupt.

Priority 2: incoming blast:
 - if eta <= 8 and ki >= 16 and no opp beam → dash (invuln). Choose dash_back (safer? dash_forward could pass through and land behind but dash_back also invuln 8). Either. Actually dash_back moves away; blast may still reach? Blast travels 13/tick; if we move back 200 over 10 ticks (20/tick), we outrun it. Good → dash_back for guaranteed dodge. But dash_back recovery 8, and opponent might catch up. It's fine.
   But careful: dash invuln only 8 ticks; if eta is 3 → dodge. If eta 9 → dash now: invuln ticks 0-7 (8 ticks), blast arrives at 9 → maybe hit. Use dash only if eta<=7.
 - else guard (block: chip 12, cost 6 ki). If ki < 6 → guard would break (crushed, 12 chip + 34 stun) — still similar to being hit (60 dmg + 20 stun). Guard is fine. But guard also costs 0.03/tick ki continuously — minor.
   Actually guard only blocks frontal. Blast comes from front normally. Fine.

   Alternatively walk forward? no.

Priority 3: normal engagement.

Let me define:
 - oppState categories: oppFree = opp.free (idle/forward/back/guard/charge); oppStun = hitstun/blockstun/crushed/down.
 - If opp.state === 'down': they're untouchable. If we want beam (ki>=50) and dist range: start beam now? Their down 42 ticks; beam startup 30 → fires while down → 280. Also they might get up earlier (42). OK: if ki>=50 and dist<=300ish and opp down → beam. Else forward approach.
 - If opp.state in hitstun/crushed (stunned) and dist <= 110 → we can attack with light (they can't block) but combo scaling: opp.combo already high from previous hits. Actually if opp is in hitstun from our earlier light, we're probably in cancel window. The cancel decision handles it.
 - If opp free:
    - if opp.state === 'guard': heavy if dist<=140 (crush) else blast/approach.
    - if opp.state === 'charge': heavy if dist<=140 (×1.5) — 180 dmg! but they charge = vulnerable. heavy best. Or light×1.5=60. heavy.
    - if opp in startup/recovery (they're attacking): punish with heavy if dist<=140 (×1.25) — but they might be in blast recovery (stunned anyway). If opp.state is 'blast' phase startup: they can't be interrupted by... we can hit them: heavy ×1.25.
    - else (idle/forward/back): choose light if dist<=110 to start chain, or heavy if dist<=140.
    
    Which to start? Light starts chain (164 dmg + knockdown via heavy at end). Heavy alone: 120 + knockdown 42. Light chain is better damage but takes ~16 ticks and risks that they block the 2nd? They can't block during hitstun (stun overwrites). But after first light hit they're in hitstun 15; our 2nd light lands at ~+6, good. So chain is reliable. However if the opponent has "guard up" reaction? They can't act during stun.

    Risk: first light hits while opp is in startup of heavy etc → counter ×1.25, fine.

    So prefer light chain when dist <= 110 - (push)? Let's think about ending with heavy requiring dist+42<=140 → start dist <= 98. If dist in (98,110], we can do light,light,heavy (150). If dist > 110 but <= 140: heavy directly (120) or walk closer? Heavy reach 140 — but then after the heavy we're at 120 damage + knockdown. Alternatively approach to <=110 then light chain. Since we approach anyway, we could just start light when dist<=110. If dist in 110-140, heavy is decent.

    Also consider: starting light gives them a chance to... they get stunned, fine.

    I'd choose: if dist <= 100 → light (chain into heavy). If 100 < dist <= 140 → heavy. Hmm but heavy vs guard crushes, and light vs guard gets blocked (bad). If opp is guarding specifically → heavy. If opp is idle/forward/back → light chain.

    Wait, but light vs guard: blocked light pushes the guard away 14 and blockstun 11 — we're pushed away too? pushApart pushes the target away (guard) 14; if the target is against wall, the attacker slides back. We get no cancel. So we lose a bit of tempo but no damage. Heavy vs guard: 60 chip + crush 34 stun → strictly better. So vs guard: heavy.

 - If dist > 140: approach. Use forward walk; or dash_forward if dist > 300 and ki >= 32 (keep 16 reserve?) Actually dash costs 16; with ki < 50 maybe. Let's do: if dist > 260 and ki >= 20 → dash_forward to close quickly. Else forward walk.

   But also we might want to charge ki when far (opponent far too). If dist > 250 and opp is charging or walking → we can charge too (0.32/tick) but charging is vulnerable. If both far, charge is good.

   Let's think about overall damage race: 60s = 3600 ticks. Both deal similar. Our best play: chain combos for ~164 dmg per ~20 ticks (very fast) if we can land first hit. Landing first hit requires range 110 and opponent not guarding. That's the crux: a good opponent guards a lot, and heavy crushes guard. So heavy is our main tool vs guard.

   Actually vs guard heavy gives only 60 dmg (crush chip) and stun 34. Then during their crushed stun, we can chain light? After crush, they're in 'crushed' state (34 ticks) → they're stunned, we can land light hits! Light into stunned target: 40 (or scaled by their combo? their combo resets only when free; they were free before → combo 0 → first hit 40). Then cancel → chain: light (32), light(26), heavy (66) → but pushes and reach. If we started heavy at dist 140 → after crush they're pushed? crush doesn't push (heavy vs guard returns early, no pushApart). Dist still ~140 → light reach 110 fails! So need to walk closer first.

   Hmm. So vs guarding: heavy at 140 → crush → then walk to <=110 → light chain 164. Total 60+164 = 224 over ~50 ticks. Decent.

   Alternatively blast vs guard: chip 12 + blockstun 14, no push → then light chain. Blast 14 ki. Heavy free. Heavy better.

   Another consideration: guard costs them ki per block (4) and passive drain; if they have low ki their guard breaks → crushed.

   Let's also handle when opp is in 'crushed' or 'hitstun' state (not from our cancel window, e.g., they got hit by something else): we can approach and attack; but our own state might be in recovery. Fine.

Now cancel handling (me.canCancel true):
 - We know our light landed (not blocked). Opp is in hitstun 15.
 - If chain < 4:
    - decide light vs heavy based on dist and chain (as derived).
 - chain == 4 → heavy if dist<=140 else blast? Blast might be blocked... but they're in hitstun so blast lands (60*scale). Blast travel time: from our front 40, need to reach opp: dist-40 at 13/tick, but they have 15 ticks of stun; if dist large, blast arrives late and they recover. So blast only if dist-40 <= 13*12 → dist <= 196. And blast cost 14.
   Actually at chain==4, heavy reach 140 likely (we kept dist<=110 + pushes: after 4 lights dist could be 110+56=166 → heavy misses). Hmm, at cancel chain==3 we choose heavy if dist <=140 else light (4th light) then chain4 heavy.

   Let me re-derive cleanly with the push each light adds 14 to distance:
   - Start light at dist d0 ≤ 110 (hit).
   - cancel1: d1 = d0+14. If d1 ≤ 110 → light#2. (need light reach) also want heavy later: after light#2 d2 = d1+14, light#3 needs d2≤110, heavy needs d3=d2+14≤140 → d1 ≤ 112. So light#2 ok if d1≤110.
   - cancel2: d2. If d2 ≤ 110 → light#3 (then heavy at d3 = d2+14 ≤124 ✓). Else → heavy now if d2 ≤ 140 ✓ (heavy hits at d2, damage 120*0.65=78, since combo index 2 → 0.65). Total 40+32+78 = 150.
   - cancel3 (3 hits done): d3 = d2+14. If d3 ≤ 140 → heavy (damage 120*0.55=66) → total 40+32+26+66 = 164 ✓. Else (d3>140) → light#4 if d3≤110 (unlikely) else blast if close enough else nothing.
   - cancel4 (4 hits): heavy if dist ≤140 else blast.

   Note the damage numbers assume no counter multiplier. Fine.

   Also maybe better: cancel1 → heavy immediately (damage 40+120*0.8=96, knockdown!) vs light#2... heavy gives knockdown 42 which enables beam follow-up. Knockdown value is high. 3 lights + heavy = 164 + knockdown + beam 280 potential = 444. So prefer 3 lights then heavy. Yes.

   Even better: light#1, cancel → light#2, cancel → light#3, cancel → heavy, then after heavy knockdown → beam. That's the dream combo. Requires ki 50 at that time.

   So: at cancel3, if ki >= 50 and dist <= 140 → heavy (sets up beam). Even if ki < 50, heavy is good anyway.

   Then after heavy hits, we're in recovery 22 ticks; opponent down 42. We then free at ~22 ticks after hit; opp down until 42 → we have 20 ticks. Start beam if ki>=50 → startup 30 → fires at 30 while opp down until 42 → hmm opp up at 42 and beam fires at 30 → hit ✓ (they're down during firing start; the beam hits when front covers their body: at fire tick, front = from+30... front advances 30/tick; the ray from our position to front covers them quickly if within ~1-2 ticks). Opp gets up at 42 → but beam hits at ~30-32 → 280 damage. 

   But ki: heavy+lights gave some ki from damage dealt (0.02 per dmg: 164*0.02 = 3.3). Need 50 ki banked. So we should bank ki before combos. Charging 0.32/tick for 100 ticks = 32 ki. Passive 0.04/tick.

   Realistically, average: we need to charge between fights. Since opponent also fights, both have similar.

   Let me add ki discipline: keep a target reserve of 50 when possible; if ki < 50 and we're not in a good attack window, charge.

   Charging is risky: ×1.5 damage taken. So charge only when dist > 180 (can't be hit) or opp is also charging/down.

Alright. Let's define modes:

```
function decide(state) {
  if (state.clash) return clashDecision(state);
  const me=state.me, opp=state.opp;
  if (me.canCancel) return cancelDecision(state);
  // free states
  ...
}
```

Note: after choosing a held state like 'guard' or 'forward', we stay in it until next decision (6 ticks). Good.

Free-state decision tree:

```
  const dist = state.dist;
  const blast = incoming blast;
  // 1. Beam threat
  if (opp.state === 'beam' && opp.phase !== 'recovery') {
     if (opp.phase === 'startup') {
        // interrupt options
        if (dist <= 105) return 'light';   // interrupt (5 startup)
        if (me.ki >= 50) return 'beam';     // answer -> clash
        if (opp.t <= 2 && dist <= 230 && me.ki >= 14) return 'blast'; // hopefully interrupt
        if (canDashBehind(state)) return 'dash_forward';
        return 'guard';
     } else { // firing
        if (canDashBehind(state)) return 'dash_forward';
        return 'guard'; // take 160 chip
     }
  }
```
Hmm, if opp beam firing and we can answer with beam... we computed it's usually too late. But if their front is far from us (dist > 400)? rare.

Also if opp beam startup and dist<=105 → light interrupt: their startup remaining might be 12 (if they answered). If they answered, our light might not interrupt but we're in trouble anyway. Alternatively dash behind. Let's reorder: if canDashBehind → dash_forward first? Dash has invuln 8 but 10 ticks moving + 8 recovery = 18 ticks of no offense; during beam startup 30 ticks that's fine. Dash behind is safe vs both startup and firing. But it costs 16 ki and gives no damage. Versus light interrupt gives 40 damage + cancels their 280 damage potential.

Priority: if dist<=105 and opp.t >= 6 (their startup has lasted a while, meaning su is likely 30) → light. Hmm opp.t for startup su=30 grows 0..30; for su=12 grows 0..12. If opp.t>=13 then su must be 30 (since 12 max) → remaining = 30-opp.t. If opp.t < 13 ambiguous.

Simplify: if opp.phase startup and opp.t >= 6 → assume su=30 → light if dist<=105 interrupts (needs 5 startup + reach, lands at opp.t+5ish < 30 if opp.t<25 ✓).
If opp.t < 6 → maybe early; use light anyway (if su=12 they'd fire soon; our light lands at ~t+5, if their fire at t=12 → our hit at 5-7 → interrupts ✓ since startup until 12). Actually if su=12 and opp.t=0, our light hits at tick 5 → interrupts ✓. Great, light interrupts in both cases if dist<=105 and opp.t+5 < su. su=12 case: opp.t up to 6 → 6+5=11 <12 ✓ borderline. So light is generally a good interrupt. But if su=30 and opp.t=28, our light lands at 33 > 30 → too late; they'd fire at 30 and hit us (280). Then dash/guard better. So condition: opp.t + 6 < 30 → opp.t < 24 → light. If opp.t >= 24 → too late to interrupt, use dash_behind or guard/answer.

Let me simplify: if dist <= 105 and opp.t < 20 → light.
else if opp.phase==='startup' and me.ki>=50 → beam (answer; if they fire in 30 ticks, our answer also 30 → simultaneous → clash. But if they're at t=25 of startup, our beam's su = 30 (or counter 12 if theirs is startup? aimed includes phase startup → su = max(12, their su - their t) = max(12, 5) = 12 → we fire at 12 while they fire at 5 → we're late → we get hit). Hmm. So answering only good if their remaining startup > 12. remaining = su - t; we don't know su but if su=30, remaining=30-t; need >12 → t<18. If su=12, remaining=12-t ≤12 → never good to answer. So: answer beam only if opp.t <= 10 (likely su=30, remaining ≥20 > 12 ✓).

OK.

Also the beam answer creates clash — is a clash good for us? Winner takes 320 damage, loser down 60. If we win clash: great. If we lose: we take 320 + down 60 (and they survive). Versus taking a beam hit: 280 + down 50. Similar loss. But clash gives us agency (push). And also if clash maxes 360 ticks → both take 120 & down 60. Also clash consumes time (up to 360 ticks = 6 seconds). Hmm, and during clash, ki drains.

Alternatively answering might be worse if we lack ki. Let's include but with condition ki>=50.

Also note clash requires both beams to actually meet. If opp answers our beam, we go to clash.

2. Incoming blast handling:
```
  if (incoming) {
     if (eta <= 7 && me.ki >= 16 && !beamThreat) return 'dash_back';
     return 'guard';
  }
```
Careful: dash_back when we also need to close distance later. Fine.

Also guard vs blast gives us 14 tick blockstun; acceptable.

3. Now combat. Let's define:
```
  const oppStunned = opp.state === 'hitstun' || opp.state === 'blockstun' || opp.state === 'crushed';
  const oppDown = opp.state === 'down';
  const oppFree = opp.free;
```
If oppDown:
   - if me.ki >= 50 and dist <= 320 → 'beam' (they're down 42 ticks; if down just started, beam startup 30 < 42 → fires while down). But if the down has 10 ticks left, they'd get up and interrupt. We know opp.t (ticks in down state) → remaining = 42 - opp.t (or opp.left? view gives left = dur - t for state down). state.opp.left gives remaining! Great: opp.left.
   - So if oppDown and opp.left > 32 and me.ki>=50 → beam (fires at 30 while down).
   - else approach: if dist > 110 → 'forward' (walk) or dash if far.
   - Also if me.ki < 50 maybe charge? Charging while opp down: they can't hit us for a bit. If opp.left small, be careful.
   
   Actually during opp down, we want to maximize: walk close to set up heavy for when they get up (counter) and keep them in range.

If oppStunned (hitstun etc.) — that usually means we just hit them and have a cancel window (handled) or our attack is still recovering (not free). If free and opp stunned, attack with light/heavy for extra damage (they can't act). If opp.state==='crushed' (from our heavy vs guard), they're stunned 34 ticks → we can walk in and start a light chain. Dist might be 140 → walk forward until ≤110. But we could also throw blast (chip 12, and they can't... they'd be hit, no guard). Blast 60 damage with 11 startup + travel; if dist 140 → travel (140-40-30)/13 ≈ 6 ticks → hits in 17 ticks, within their 34 stun ✓. So blast is efficient when they're stunned and far. But blast damage 60 vs light chain 164. Prefer light if dist ≤110.

Let me define attack selection when opp is helpless (stunned/down) and we are free:
  - if dist <= 100: light (chain) → will chain to heavy.
  - if 100 < dist <= 140 and ki >= 50: beam? beam startup 30 vs their stun left maybe < 30 → risky. Let's: if opp.left > 32 and ki>=50 → beam (280!). else if dist<=140 → heavy (120, ×1 combo scaling maybe opp.combo high). else blast.
  - if dist > 140: blast (if ki>=14 and travel fits in stun) else forward.

Hmm, careful with the "heavy" when opp stunned: the heavy's knockback etc.

Honestly, let's structure the decision as a priority-ordered function; complexity is manageable.

4. Normal free vs free opponent:
   - If dist > 140:
       - if opp is charging → we can blast them (they're vulnerable, 60*1.5=90! chargeHit 1.5 applies) or close and heavy (×1.5=180). Better: close and heavy. Walk forward or dash.
       - if me.ki >= 50 and dist between 150 and 300 and opp is doing something slow → beam? risky.
       - approach: 'forward'. If dist > 280 and ki >= 20 → dash_forward (closes 200). But careful about dash landing behind them (if dist<140 and room). dist>280 → dash lands 200 closer, dist ~80 → good.
       - if me.ki < 50 and dist > 200 and opp not charging: 'charge'? Charging while they approach; they might reach us. If dist>200 they need 90/4.5=20 ticks to reach 110. Charging 20 ticks gives 6.4 ki. Not great. Better to keep walking and take free passive ki (0.04/tick forward → 0.08/tick with walk bonus).
       Hmm ki: forward walk gives 0.04+0.04=0.08/tick. Charging gives 0.36/tick (0.04+0.32). So charge is 4.5x better. But vulnerable.
   - If dist <= 140: engage.
       - opp guarding → heavy.
       - opp charging → heavy (×1.5).
       - opp in startup/recovery of an attack → heavy (×1.25) if within 140.
       - else (idle/forward/back) → light if dist<=110 else heavy.

   Also if opp in blast startup (11) and dist <=140 → heavy ×1.25 interrupts them.

   Also consider: our own ki for heavy = free. Good.

5. Ki management for beam: keep ki high; if we have ki>=50 and target opportunity (opp stunned/down or opp far and safe), use beam.

Let me now think about the beam usage when free and opp is normal at long range: beam startup 30, they can interrupt by hitting us if they can reach (dist<=140) — then heavy×1.25 etc. If dist > 140 they can't interrupt by strike; they might blast (travel) — blast can interrupt our beam startup if it reaches us during startup. Also they could dash. So beam at long range (dist>200) is relatively safe but takes 30 ticks of standing still. And beam damage 280 + knockdown 50 if it connects. If they guard: chip 160 (still great!) and stun until beam end.

Beam hit: 280 damage, down 50, knockback 120. That's huge. Beam chip vs guard 160. Beam is our finisher.

So plan: aim to reach 50 ki and fire beam when there's a decent chance. When to charge ki? During lulls (opp down, opp far away, opp in recovery).

Let's add a ki reserve logic:
```
const wantBeam = me.ki >= 50;
if (!wantBeam && safeToCharge) return 'charge';
```
safeToCharge: dist > 160 or opp.state === 'down' (they're down, can't hit) or opp.state is hitstun/crushed with left > 15.

Charge time: need 20 ki at 0.36/tick = 56 ticks. That's a lot of vulnerability. Alternatively blast costs 14 and gives 60 damage... Ki is scarce.

Hmm, alternatively skip beam mostly and rely on chains (164 per combo) — that's efficient (no ki). Beam adds 280 but costs 50 ki + 50 ticks of setup. Roughly: 50 ki from charging = ~140 ticks of charging (if we can charge safely). During 140 ticks, we could have landed 2-3 combos (~400 damage). So beam is roughly break-even unless we can charge while doing other things (e.g., during opponent's down/stun or while they approach). Hmm, but passive+forward ki is 0.08/tick; over 3600 ticks = 288 ki if always walking! So ki income is actually decent over a long fight: 0.08/tick * 3600 = 288. Plus damage-based.

So we can bank ki while walking/approaching. Let's aim to keep ki near 100 and use beam when a good opportunity arises (opp down/stunned, or dist>200 and they're not close).

Let me reconsider: Since damage dealt gives 0.02/dmg and we deal ~150 per combo, ki +3. Walking around gives passive.

Plan: use beam when:
 (a) opp is down with left > 32 → guaranteed hit (280).
 (b) opp is stunned (crushed/hitstun) with left > 32 → guaranteed-ish.
 (c) dist > 200, opp free and not charging, ki >= 50 → likely hit (they need 90/4.5 = 20 ticks to close to 140; but blast or dash can interrupt). Beam travels 30/tick, front advances 30/tick: from our position +40, front moves; to reach opp at dist 300: (300-40-30)/30 = 7.7 ticks. So beam fires at startup end and hits ~8 ticks later. Their startup 30 + 8 = 38 ticks of vulnerability needed. If they walk toward us, they reach strike range (110) in (300-110)/4.5 = 42 ticks — slightly too late! So beam at dist 300 vs a walker likely hits. But they may dash forward (16 ki) to close in 10 ticks → then interrupt. Or blast.

 So beam at long range is quite strong. Let's do it when dist >= 200 and ki >= 50, and opp not charging (charging opp would take ×1.5 damage = 420! even better, but charging opp can hit us... they'd have to reach us first; if dist>200 they can't).

Hmm, but if we beam at long range and they interrupt, we've wasted 50 ki and 30 ticks. Risk.

Let's also keep beam for answering their beam (clash) — high value.

Let me also reconsider heavy vs guard (60 dmg + crush) — cheap damage.

One more important consideration: the opponents might be aggressive and good. We should prioritize defense: guard incoming blasts, interrupt beams, avoid getting hit by heavies.

Also: being hit by a heavy = 120 damage, knockdown 42 → we lose the tempo; we should avoid heavy range when we're in startup. Our heavies have 9 startup — if opponent is at dist 140 and free, they can hit us with a light (40) or heavy (120) counter ×1.25 on our startup = 150! So committing heavy vs a free opponent is risky: they can counter with light (40×1.25=50) or heavy (150). Hmm. With 4 AI opponents and 1000 games, consistency matters.

Balance: light is safer (5 startup). Our chain approach: first light 5 startup - they can counter with light (50 dmg) if in reach 110.

Given both sides are similar bots, the game is about who lands. I'll aim for a mix: use light chain to open (safe-ish), heavy to finish.

Let me also handle "blast" usage: as a poke at range and to interrupt. Use when dist between 140 and 300 and ki >= 30 (keeping 16 for dash) and opp not guarding? vs guarding blast is chip only. Let's use blast mainly to interrupt their beam startup or to poke when dist>250.

Also, blast hits for 60 with hitstun 20 → they can't act → we get tempo. But their blast? Fine.

Let me write the code now with a clear structure and a few memory variables (top-level). Since top-level executes per match, we can store per-match state like "planned combo" and "beam reserved". Let's keep minimal: track lastAction, and maybe aggression.

Actually important: the engine calls decide only when free and every 6 ticks; held states persist. So we need to be careful: e.g., choosing 'forward' keeps walking for 6 ticks. Choosing 'guard' keeps guarding 6 ticks.

Let's now write.

```js
let lastPush = false;

function decide(state) {
  const R = RULES;
  const me = state.me, opp = state.opp;
  const dist = state.dist;

  if (state.clash) {
    const C = R.clash;
    const oppP = state.clash.oppPower;
    // our power without push
    const baseP = me.ki > 0 ? C.base + C.kiPower * me.ki : C.empty;
    const rage = me.hp < C.rageHp * R.hp ? C.rage : 0;
    const withPush = (me.ki > 0 ? baseP + C.pushPower : C.empty) + rage;
    const withoutPush = baseP + rage;
    if (me.ki >= 8 && withPush > oppP + 0.05) { lastPush = true; return 'push'; }
    lastPush = false; return 'idle';
  }
  ...
}
```
Wait: if ki <= 0, pushing gives power 0.5 (no +0.6 since formula: ki>0 ? base+kiPower*ki+push : empty; push bonus only when ki>0!). Looking at code: power = (f.ki > 0 ? C.base + C.kiPower*f.ki + (f.push?C.pushPower:0) : C.empty) + rage. So with ki=0 push gives nothing. So pushing only if ki > 0. Also push drains 0.6 more per tick (only if ki>0 per clashTick: f.ki - drain - (f.push && f.ki>0 ? pushCost:0)).

Strategy in clash: we want to push when we have power advantage. But pushing drains ki faster which reduces power (0.02 per ki) — net per tick: with push, power = 1+0.02ki+0.6, drain 0.8/tick → after n ticks ki = ki0 - 0.8n, power = 1.6+0.02ki0-0.016n. Without push: drain 0.2/tick, power = 1+0.02ki0-0.004n. So pushing: +0.6 initial but loses 0.012n extra. Over 100 ticks: push power ~1.6+0.02ki0-1.6 vs no-push 1+0.02ki0-0.4 → push better until ki runs out. With ki0=50: push power at n=100: 1.6+1-1.6=1.0; no push: 1+1-0.4=1.6. Hmm, at 100 ticks no-push is better! Crossover: 0.6 = 0.012n → n=50. So push for the first ~50 ticks then stop. But the decision cycle is 6 ticks; we can compare: push power now vs not pushing now. Simpler: push if ki > 25 and withPush > oppPower + 0.1, and continue pushing while that holds; stop when ki < 20 or advantage lost.

Actually since power diff is what matters (drift), and both sides have similar drain, let's just: push if withPush > oppP + 0.1 (with withPush computed including the +0.6). If our ki is low (<10), pushing drains fast to 0 → power 0.5; don't push then. Use condition: me.ki >= 12 && withPush > oppP + 0.08.

Hmm but if opp is pushing and has 1.6 vs our 1.5 without push, our withPush = 2.1 → we push. ok.

Also consider hp<30% rage: +0.4 both.

Now the main logic. Let me write pseudo-code:

```js
function decide(state) {
  const R = RULES, me = state.me, opp = state.opp, dist = state.dist;

  if (state.clash) return clashDec(state);

  if (me.canCancel) return cancelDec(state);

  // free state
  const inc = state.blasts.filter(b => !b.mine && b.incoming);
  const incoming = inc.length ? inc[0] : null;

  // helper flags
  const oppBeamThreat = opp.state === 'beam' && opp.phase !== 'recovery' && ((me.x - opp.x) * opp.facing > 0);

  // 1. beam threat
  if (oppBeamThreat) {
    if (opp.phase === 'startup') {
      if (dist <= 105 && opp.t < 20) return 'light';   // interrupt
      if (me.ki >= 50 && opp.t <= 12) return 'beam';    // answer -> clash
      if (canDashBehind(state)) return 'dash_forward';
      return 'guard';
    } else {
      // firing
      if (canDashBehind(state)) return 'dash_forward';
      if (dist > 380 && me.ki >= 50) return 'beam';
      return 'guard';
    }
  }
```
Hmm 'light' interrupt: our light startup 5, active 3. It lands ~5-6 ticks later. If opp.t<20 and su=30 → their startup ends at t=30 → we land at t+5..8 <30 ✓. But if su=12 (they answered our beam) and opp.t=10 → we land at 15 > 12 → they fire at 12 and hit us (280). But their beam firing would be... we may also be in clash? No. Let's add condition: only light-interrupt if opp.t + 8 < 30 OR opp.t + 8 < 12 (i.e., opp.t < 4). Simplify: opp.t < 12 → light (covers both cases? if su=12 and opp.t=11 → we land at 16 > 12 ✗). Add: if opp.t < 5 → light (works for su=12: land at ≤13 hmm opp.t=4 → land at 12 exactly borderline). Ugh.

Alternative: handle the answered-beam case by checking whether we have a beam ready? We can't know opp.su. Let's estimate su by opp.t: if opp.t > 12 then su=30; if opp.t <= 12 could be either. To be safe, only light-interrupt when opp.t <= 8 AND (assume su=12 possible → risky). Alternatively, use dash_behind as the primary answer when possible (safe), else light.

Let me order: 
  - if canDashBehind → dash_forward (safe dodge) — but if it's during their startup (before firing), dodging behind is safe ✓.
  - else if dist<=105 && opp.t < 20 → light (interrupt; hope su=30).
  - else if me.ki>=50 && opp.t<=12 → beam (clash).
  - else guard.

Hmm but dash_behind requires dist<=140 and room behind. Often true in mid-range. But dash costs 16 ki and 18 ticks; light interrupt gives 40 damage and prevents 280. I'd rather light-interrupt first when possible since dist<=105 is a solid condition:
  - if dist <= 105 && opp.t < 18 → 'light'
  - else if canDashBehind → 'dash_forward'
  - else if me.ki>=50 && opp.t<=12 → 'beam'
  - else 'guard'

Also when opp beam is firing (not startup), no interrupt; dodge or guard.

2. incoming blast:
```js
  if (incoming) {
    if (incoming.eta !== null && incoming.eta <= 6 && me.ki >= 16) return 'dash_back';
    return 'guard';
  }
```
Hmm, dash_back at eta<=6: dash invuln 8 ticks ✓. But dash_back also has recovery 8 → we're stuck 18 ticks. And guard gives chip 12 only. Guard is cheap; but guard's blockstun 14 ticks (we're stunned) — that's worse than dash? dash: 18 ticks but no damage and no stun (we can act after). Guard: 14 tick stun + 12 chip + 6 ki. Dash better if we can afford ki. Use dash when eta<=6 and ki>=16. But also if opp beam threat exists, handled earlier.

Careful: incoming blast could be blocked by guard — but if we guard and have <6 ki, guard breaks (crushed 34). Still fine.

Also: two blasts incoming → both? guard only blocks one? Each blast hits separately; blocking one costs 6 ki; the second might break the guard. Edge case ignore.

3. Now regular engagement. Let's write helper functions:

```js
function oppIsStunned(o) { return o.state === 'hitstun' || o.state === 'blockstun' || o.state === 'crushed'; }
```

Main:
```js
  const oppDown = opp.state === 'down';
  const oppStun = oppIsStunned(opp);
  const oppFree = opp.free;
  const oppGuard = opp.state === 'guard';
  const oppCharge = opp.state === 'charge';
  const oppAttacking = !opp.free && !oppStun && !oppDown; // startup/recovery of a move

  // beam opportunity
  if (oppDown && opp.left > 32 && me.ki >= 50) return 'beam';
  if (oppStun && opp.left > 32 && me.ki >= 50 && dist < 400) return 'beam';
```
Careful: oppStun with left>32: only 'crushed' (34) qualifies. hitstun 15, blockstun 11/14. So mostly crushed. Beam vs crushed: they can't act for 34 ticks; beam startup 30 → fires at 30 ✓ then front travels to them: if dist 200, need (200-40-30)/30 ≈ 4 ticks → at tick 34, they've just recovered → they might block? They can't move; the beam hits at tick 34-35 anyway if they don't act. They recovered at 34, can act at 35; the beam hits at 34 → ok marginal. Let's require opp.left > 36 for safety, or just beam only when oppDown with left>34.

Simplify: beam only when oppDown && opp.left > 33 && ki>=50 → guaranteed 280. Also when opp is 'crushed' with left>30: hmm crushed duration 34; beam startup 30, hits at 30+travel. Let's require left > 34 for crushed too → not satisfied (34). So only down.

Also: if we're free and opp is down with left small, don't waste.

Continue:
```js
  // engage
  if (dist <= 140) {
    if (oppGuard) return 'heavy';       // crush
    if (oppCharge) return 'heavy';      // x1.5
    if (oppAttacking) return 'heavy';   // counter x1.25
    if (dist <= 110) return 'light';    // open chain
    return 'heavy';
  }
```
But careful: 'heavy' when opp is free at dist 110-140 — heavy startup 9, they might block it (guard → crush, still 60 chip) or they might get hit. OK.

Also if opp free and dist<=110 → light. But what if opp is 'forward' walking at us? light fine.

Wait: risk that our light gets blocked (opp decides guard at that tick). Then no cancel, we wasted. Acceptable.

Also if opp is idle at dist<=110, maybe heavy is better (120 vs chain 164 but chain takes longer)? Chain is better.

Hmm, but the chain requires the 2nd/3rd lights to land, which they will (opponent stunned). So chain ~164 with knockdown vs heavy 120 with knockdown. Chain better. But chain takes longer (16 ticks) vs heavy (9). During chain the opponent takes 164 damage. Fine.

Now dist > 140:
```js
    // approach
    if (dist > 260 && me.ki >= 20) return 'dash_forward';
    // blast poke
    if (me.ki >= 30 && dist >= 170 && dist <= 320 && !oppGuard) return 'blast';
    return 'forward';
```
Hmm blast poke: 60 damage, hitstun 20 → they get stunned, we can then approach. But blast could be blocked → chip 12. Also blast vs opponent's blast cancels. It's decent: at dist 200 blast hits after 11+ (200-40-30)/13 ≈ 15 ticks. They may move away. Eh, let's include it conditionally: only when opp is moving toward us or standing (not backing), and ki>=30, and we haven't used blast (blastOut flag me.blastOut).

Hmm, but maybe better to just walk to range and combo (combo = 164 damage in ~16 ticks = much better than blast 60 in 15 ticks). The issue is closing distance takes time. dist 200 → walking to 110 takes 20 ticks. Blast meanwhile hits for 60 and stuns them 20 ticks (they're frozen). Blast then approach. Actually a good pattern: blast to freeze them, walk in, combo. But blast's hitstun 20 then they recover.

Alternatively, just walk forward, and when dist<=110 open a combo. The opponent may also approach. Fine — simpler and strong. I'll use blast primarily for interrupting beams and for a poke when the opponent backs away (can't chase).

Let me reduce: use blast when dist > 200 and opp.state === 'back' (running away) and ki>=30, or when we need to interrupt their beam.

Also charging: when to charge? If ki < 50 and safe: opp is down/stunned (can't hit for a while) or dist > 200 and opp not closing fast. Let's add:
```js
    if (me.ki < 50 && (oppDown || oppStun || dist > 200) && opp.state !== 'charge') return 'charge';
```
Hmm charging while opp charging at long range: both charge, fine (we take ×1.5 if hit). Let's require opp not attacking.

Also we might want to charge when we have a beam opportunity soon. Keep simple.

Also, if ki >= 50 and dist > 200 and opp is walking toward us → beam! Let's evaluate: our beam startup 30; they walk at 4.5/tick → cover 135 in 30 ticks → if dist 250, they'd get within 115 (light range) at tick 30 — they could hit us during our startup at tick ~ (250-110)/4.5 = 31 → just after our beam fires at 30. Our beam front reaches them: fire at 30, front at from+30, traveling 30/tick; at tick 30 front = me.x+25+30 = +55; they'd be at 250-135=115 away → beam needs (115-55)/30 = 2 ticks → hits at 32. They could interrupt our startup at tick 31 (light active 31-33) → their light hits us at tick 31-33, interrupting? Light hitting us during our beam startup interrupts our beam (stun overrides state) → our beam dies. Risky. So beam at dist 250 vs a walker is risky. At dist 300: they reach light range at (300-110)/4.5 = 42 ticks > 30 → our beam fires at 30 and hits at 30+((300-55)/30)=37 ticks. They can interrupt only if they reach us by tick 37: need dist ≤ 110+4.5*7=141 → they'd need 159 units = 35 ticks → just in time. Marginal.

So beam at long range is decent if dist >= 280 and opp walking. Let's include beam at dist >= 270 with ki>=50 when opp isn't charging and isn't backing away? If opp backs away, beam still chases? No—beam front advances 30/tick for 40 ticks = 1200 total, covers the whole stage. Beam doesn't stop. So vs a backer, beam will hit unless they guard (chip 160) — still good! Beam covers ray to front which advances 30/tick for 40 ticks; a backer moves away 3/tick — the beam outruns them. So beam is strong vs retreat. Only interrupt risk is them reaching us (dash forward 200 in 10 ticks! → they can dash in and hit us during startup: dash landing behind us? If they dash forward through us, they land behind us (if room) → then our beam ray goes away from them → miss! Hmm. Or stop in front at dist 60 and hit us.)

OK, let's include beam at dist >= 250 with ki >= 50, but only when the opponent's state isn't 'beam' (handled) and we've decided they can't easily reach. Let's set threshold 260.

But wait, there's a subtlety: after firing a beam and hitting for 280 with knockdown 50, we win big. Missing = waste. Expected value positive.

Hmm, one more: they may have 'dash' already. Whatever.

Also, should we use beam when opp is guarding at long range? Beam chip 160 for 50 ki — that's good value! Guarding costs them 15 ki and gives 160 chip damage. Yes, beam vs guard is excellent.

Let me now also handle: our beam when the opp is close (dist<=140): risky (they can interrupt with light/blast). Prefer light chain then heavy then beam after knockdown.

Let's write cancelDec:

```js
function cancelDec(state) {
  const me = state.me, opp = state.opp, dist = state.dist, chain = me.chain;
  // we just landed a light; opp in hitstun
  if (chain < 4) {
    if (chain <= 2 && dist <= 110) {
      // continue light chain; plan heavy finisher
      return 'light';
    }
    // chain 3 or dist too far: heavy finisher
    if (dist <= 140) return 'heavy';
    // too far: blast? beam?
    if (dist <= 200 && me.ki >= 30) return 'blast';
    return 'idle';
  }
  // chain == 4
  if (dist <= 140) return 'heavy';
  if (dist <= 210 && me.ki >= 30) return 'blast';
  return 'idle';
}
```
Wait chain semantics: me.chain = number of lights in this chain (1 after first light). At cancel after 1st light, chain=1. After 2nd, chain=2. After 3rd, chain=3. After 4th, chain=4.

Our plan: lights at chain=1 (start), cancel chain=1 → light#2, cancel chain=2 → light#3, cancel chain=3 → heavy, cancel after heavy? Heavy doesn't give cancel (only light gives cancel). So chain=4 cancel never happens if we go heavy at chain 3. But if at chain=3 dist>140 we do light#4 (chain=4) then cancel chain=4 → heavy/blast.

Damage: with lights at chain 1,2,3 then heavy at cancel chain=3: total 40 + 32 + 26 + heavy(120*0.55=66) = 164 ✓.

Distances: light#2 needs dist<=110 at cancel chain1 (dist = d0+14). light#3 needs dist<=110 at cancel chain2 (d0+28). heavy needs dist<=140 at cancel chain3 (d0+42). So the plan works if d0+28<=110 → d0<=82 for the full 3-light version. If d0 = 100: cancel chain1 dist=114 >110 → we'd go heavy (damage 40+96=136, knockdown). Hmm.

Maybe better: cancel chain1 → if dist<=110 → light; else heavy. At d0=100 → dist after push=114 → heavy (136 total + knockdown). Alternatively at cancel chain1, dist 114 → we could 'forward'? No, cancel only allows light/heavy/blast/beam.

Let's refine: at cancel chain=1: if dist <= 110 → light. else heavy (if <=140). At cancel chain=2: dist = d0+28; light needs <=110 → d0<=82; if dist<=110 → light else heavy.
At cancel chain=3: heavy if <=140 (d0+42<=140 → d0<=98 ✓).

So combos: d0<=82 → 164; d0<=96 (chain2 dist d0+28<=124>110 → heavy at cancel2: 40+32+78=150 + knockdown); d0 in 97..110: cancel1 heavy (40+96=136). Hmm wait, if d0=100, cancel chain1 dist=114>110 → heavy → 136 damage + knockdown. Good.

Hmm, but the light's push: pushApart pushes the target away 14 only if there's room; if the target is against the wall, the attacker is pushed back instead (so dist stays same-ish, and actually attacker moves back 14 → dist increases anyway? If target at wall: s = min(dist, room)=0 → target doesn't move; attacker slides back by (dist - 0) = 14 → so dist increases by 14 as well). Either way distance increases ~14.

So to start a chain with dist <= 82 we'd want to be close. Approach policy: walk forward until dist <= 90 then start light. But the opponent moves too. Since we decide every 6 ticks, walking 4.5*6=27 units per decision. Hmm, we can walk until dist<=90 then attack; by then they may have moved.

Alternatively use dash_forward to land at exactly dist ~90-100 then light. Dash lands at 200 travel: if dist=250, dash → dist 50 (plus min gap). Actually dashEnd: x1 = me.x + facing*200; if that passes opponent (after = dist-200 < 60) and there's room behind → land behind them (dist = 200-dist behind = negative → behind them!). If dist=250 → after=50 <60 → tries behind: behind = opp.x + d*max(60,150) = 150 beyond opp → needs room. If room, we land 150 behind them → dist 150, facing old direction (we face away? "落地后到收招结束前你还面朝原来的方向" — we keep facing the original direction, which is toward them; since we passed through, we're now behind them facing away... wait "原来的方向" = the direction we were facing = toward the opponent. After passing through, the opponent is behind us, but we still face forward (away from them). The opponent turns to face us (if free). During our dash recovery (8 ticks) they're turning. Fine.

This is getting complex. Let's simplify dashing: only dash_forward when dist >= 260 (so we land at dist ~60-... let's compute: dist 260 → after=60 → not <60 → no pass-through → x1 = me.x+200 → new dist = 60). Wait "after < R.minGap" triggers pass-through; after=60 is not <60 → no pass → x1 = me.x+200 → dist = 60. Good, we land 60 away — but then we'd be inside light range? dist 60 is very close; actually min gap is 60 so they get pushed to 60 by separate() if overlapping. Landing at dist 60 is great for a combo, but our dash recovery is 8 ticks during which we can't act. And we're in their face; they might punish (they're at dist 60, our recovery 8 ticks → their light startup 5 → hits during our recovery → counter? Our state is 'dash' recovery → phase? dash phase 'recovery' → mult() → MOVES.has('dash')? MOVES = light,heavy,blast,beam,dash ✓ and phase recovery → counter ×1.25! So they hit us for 50 during our dash recovery. Hmm, and they could heavy (×1.25=150). Dangerous.

So dash to dist ~100-110 is better. dist 300 → dash lands 100 away. Good: dash when dist >= 300 → land at ~100.

Let's use dash_forward when dist >= 290 and ki >= 20 and no other priority. It closes quickly; but they might punish our 8-tick recovery. Risk. Alternatively walk forward. I'll use dash when dist >= 300 (landing ~100) and ki >= 20 and opp not charging.

Hmm, actually let's reconsider: is closing distance even needed? Both players approach; the fight naturally converges. Let's not over-engineer: use forward walk mostly, dash occasionally.

Now, another important thing: after our heavy knockdown (42 ticks), we should set up the beam follow-up. After heavy hit at tick X, opponent down until X+42. We're in heavy recovery until X+22 (recovery 22 ticks: total heavy dur 35, active ends ~13, recovery until 35 → we're free ~X+22). Then we have 20 ticks before they get up (X+42) and 21 ticks until they can act (X+43). If ki>=50 → beam: startup 30 → fires at X+52 — but they're up at X+42 and can act at X+43, and dist? Heavy knocked them back 150 → dist = dist_at_hit + 150. If they were at 140 → 290 → they need to reach 110: 180/4.5 = 40 ticks → they can't interrupt before X+52 (only 10 ticks). ✓ So beam is safe-ish and hits for 280 (or if they dash?).

But we need ki>=50 at that moment. Ki from the combo is low. So we should bank ki before engaging. Alternatively, after heavy knockdown, walk forward (not beam) to be close for the next combo when they get up.

Let's manage ki: keep ki >= 50 as a goal when possible. But ki gain is slow (0.08/tick walking). During a 20-tick approach, +1.6. Ugh. Passive 0.04/tick = 2.4/sec. To gain 50 ki takes ~20 seconds of passive regen. Damage taken also gives ki (0.08/dmg; taking 120 damage = 9.6 ki).

Hmm! So maybe beam is rarely affordable. Note also: ki cap 100 and guard blocking costs. Let's re-evaluate: is beam worth it? 280 damage for 50 ki + 50 ticks (30 startup + 40 fire + 20 recovery). Compare to using those 50 ticks for combos: each combo (164 dmg) takes ~20 ticks but requires landing a first hit.

Realistically both players land ~1 combo per 2-3 seconds. Over 60s that's ~20 combos → 3000 damage potential but HP 1000. So fights end in maybe 20-30 seconds. Beam might be used 1-3 times per fight. It's worth banking for.

Alternative to banking ki: charge during opponent's down/stun windows (we have 'charge' action; but that means we're not attacking). During a 42-tick down, charging gives 15 ki. Meh.

Let's just implement: prefer keeping ki high when not attacking; when a beam opportunity appears (opp down with left>33, or long range), use beam if ki>=50.

I think the plan is decent. Let me also add: don't waste dash.

Also we should handle "beam answer" when opp fires a beam at us — already covered.

One more: the beam we fire could clash with theirs. Fine.

Let me also think about the initial approach: start at dist 300 (350 vs 650). Both walk toward each other. Our bot: dist>140 → forward. Fine.

Let me consider whether to use 'guard' proactively when opp is close and threatening. Guard costs 0.03/tick ki and blocks light/blast/beam (chip). Heavy crushes guard. So guarding vs heavy is bad. Opp heavy startup 9 → we can see opp.state='heavy', phase startup; if dist<=140, we could dash_back (invuln 8 ticks, covers heavy startup? heavy active at t=9..12; dash invuln 0-7 → if we dash at their t=0..? We decide every 6 ticks; their startup 9 ticks; if we dash when their t is 3-9, invuln covers 8 ticks from dash start → may cover the active frames. Also dash_back moves away → heavy reach 140 → dist grows by 200 → out of reach ✓ (heavy reach check at active: dist > 140 → miss). Great: dash_back dodges heavy entirely (knockback? no, dash moves us). But if we dash back, our position is worse for offense; still good defensively.

Alternatively 'back' walk (3/tick) — heavy reach 140; if dist 140 and heavy startup 9 → they reach at active, we moved back 27 → dist 167 → miss ✓ (if we start back now). That's free (no ki)! But careful: walking back while they walk forward: net closure 7.5/tick → 9 ticks = 67 → dist 140-67=73 → still hits. So 'back' alone may not escape if they close. Dash_back: we move 200 in 10 ticks while they close 45 → net +155 → safe ✓.

So: if opp is in heavy startup (state 'heavy', phase startup) and dist <= 140 → dash_back if ki>=16, else 'back' (and hope). Also their heavy might be a combo finisher — we could also interrupt with our heavy (×1.25) if we have range and free. Hmm, if they start heavy at dist 140 and we're free, we can respond with our light? Our light startup 5 → lands at t+5, their heavy lands at t+9 → we interrupt ✓ and get ×1.25 (50 dmg). Nice! So counter-attacking beats retreating here.

So: if opp in attack startup and dist<=140 and we're free → attack (heavy/light) to interrupt. If opp heavy startup at dist 140 and we attack with light (5 startup) → we land first (5<9) → interrupt ✓. Good.

But if opp is 'heavy' and we're in our own recovery, we can't. Then dash.

Let's define response to opponent heavy startup (when free):
- if dist <= 110 → light (fast interrupt, 5 startup)
- else if dist <= 140 → heavy (9 startup, tie-ish: theirs active at 9-12, ours at 9-12 → both may trade; theirs 120×1.25=150 vs ours 120 → we lose the trade). Better: light? light reach 110 only. Hmm at dist 120 we can't interrupt with light. Our heavy trades badly (they hit first? both active same ticks; land order: strikes() collects both then applies both → trade, we take 150, they take 150×1.25=150... our damage: 120 × counter? they're in startup → 1.25 → 150. We take 150, they take 150. Even trade but we get downed. Bad. Better: 'back' or dash_back.
  Let's do: dist 111..140 & opp heavy startup → 'back' (walk back) if they aren't also closing fast... let's just dash_back if ki>=16 else 'back'.

Also opp blast startup (11 ticks) → blast projectile, they intend to hit at range; we can interrupt with light (5) if dist<=110, or just guard when it comes.

Now also: 'guard' against a light: they get 0 damage, they get pushed, we pay 4 ki. Guard vs our offense decisions: if opp is holding guard constantly, we should heavy (crush). Our plan handles that.

Let me now also make sure we don't get stuck: if we return 'forward' and continue, fine.

Let me write the final code with helper functions and comments. Also must respect: no imports; use global RULES.

Also note: the bot's decide is called with `state` JSON. RULES is global.

Let me write the code.

```js
/* AI 武道会 · 第1季 选手程序 */

let _last = 'idle';
let _lastPush = false;

function decide(state) {
  const R = RULES;
  const me = state.me, opp = state.opp;
  const dist = state.dist;

  if (state.clash) return clashChoice(state);
  if (me.canCancel) return cancelChoice(state);

  // ---- helpers ----
  const incoming = state.blasts.filter(b => !b.mine && b.incoming);
  const blast = incoming.length ? incoming[0] : null;
  const oppFree = opp.free;
  const oppDown = opp.state === 'down';
  const oppStun = opp.state === 'hitstun' || opp.state === 'blockstun' || opp.state === 'crushed';
  const oppGuard = opp.state === 'guard';
  const oppCharge = opp.state === 'charge';
  const oppMove = !oppFree && !oppDown && !oppStun; // startup or recovery
  const oppHeavyStart = opp.state === 'heavy' && opp.phase === 'startup';
  const oppBeam = opp.state === 'beam' && opp.phase !== 'recovery';
  const beamAtMe = oppBeam && (me.x - opp.x) * opp.facing > 0;
  ...
}
```

canDashBehind: compute room behind opponent relative to their facing:
```js
function roomBehindOpp(state) {
  const opp = state.opp;
  return opp.facing > 0 ? opp.x - RULES.stage.left : RULES.stage.right - opp.x;
}
```
And dash-through feasibility: need dist <= 140 (so that dash of 200 passes them) and roomBehind >= max(60, 200-dist) + small margin. Actually the rule: behind = o.x + d*max(minGap, -after) where d = our facing toward them, after = (o.x - x1)*d = dist-200 (if x1 = me.x+200, but clamp to stage may change). Also need x1 within stage.

Simplify: feasible if dist <= 145 && roomBehindOpp >= Math.max(70, 205 - dist).

Hmm note: if dist <= 140 and after = dist-200 <= -60 → passes. If after between -60 and 0 (dist 140..200), the second branch: "else if (o.x + d*minGap >= L && <= H && after < 0) x = o.x + d*minGap" → stops 60 in front of them, NOT behind. So need after <= -60 → dist <= 140 for pass-through. Also first branch requires behind within stage.

So feasible: dist <= 140 && roomBehindOpp >= Math.max(60, 200-dist) + 5.

Now the beam dodge: dash_forward through them → we land behind, our beam-facing direction... they face us? After we land behind them, our facing is still toward the old direction (away from them). Their beam ray goes from them toward us (old position). We're now behind them → safe ✓. But we might be inside their body? No, separate() ensures gap 60 except during dash.

Alright.

Also for the beam startup interrupt: 'light' reach 110 requires dist <= 110 at hit time; they may move. Fine.

Now write out the decision order concretely:

```
  // A. clash
  // B. cancel
  // C. beam threat
  if (beamAtMe) {
    if (opp.phase === 'startup') {
      if (dist <= 108 && opp.t <= 16) return 'light';       // interrupt the charge-up
      if (dist <= 140 && roomBehindOpp >= ...) return 'dash_forward'; // dodge behind
      if (me.ki >= 50 && opp.t <= 10) return 'beam';       // answer -> clash
      return 'guard';
    }
    // firing
    if (canDashBehind) return 'dash_forward';
    return 'guard';
  }
```
Hmm, order: if their beam is in startup and dist<=108 → light interrupt. But if their startup is nearly over (opp.t=28, su=30) our light lands at 33 → too late, we'd be hit. Condition opp.t <= 16 → land at ~22 < 30 ✓ (assuming su=30). But if su=12 (answered), opp.t<=16 always; their fire at 12; our light lands at opp.t+5: if opp.t=10 → 15 > 12 → they fire and hit us (280) and we get interrupted (beam fires and hits). Hmm. Detect su=12 case: if opp.t >= 12 then su=30 (since su=12 means their t<12 during startup). So: if opp.t >= 12 → su=30 → remaining = 30-opp.t. If opp.t < 12 → ambiguous (could be 12 or 30).

For ambiguous: if opp.t <= 6 → remaining if su=12 is ≥6 → our light lands at opp.t+5..7 which may exceed 12 if opp.t>5. So light interrupt is only safe if opp.t+7 < 12 → opp.t <= 4 (covers su=12), and for su=30 safe up to opp.t<23.

Combined rule: light interrupt safe if opp.t <= 4 (safe for both) OR (opp.t >= 12 && opp.t <= 18) (su=30 with ≥12 ticks left). Between opp.t 5..11 ambiguous → use dash_behind if possible, else guard? But guard vs beam = 160 chip. Alternatively answer beam (clash) which is decent if their startup has ≥12 ticks left — ambiguous.

Hmm. Actually, wait: if su=12, that means they answered a beam of ours → we're in a clash scenario soon. If they answered, they fired 12 ticks after... this occurs only when both beam. Fine, I'll accept some risk: use light interrupt when opp.t <= 4 or (opp.t >= 12 && opp.t <= 18). Else dash_behind / answer / guard.

Actually simpler and safer: prioritize dash_behind (dodge) when available, else the interrupt rules. But dash_behind has cost and no damage. Interrupting their beam with a light = 40 damage + prevents 280 damage. Very valuable. Keep interrupt first with the safe windows.

Hmm, also we could interrupt with heavy (×1.25, 120+) if dist<=140 — but heavy startup 9 → lands at opp.t+9ish; for su=30 need opp.t<=20. Heavy damage 150 and crush — much better than light 40! And if they guard, heavy crushes (60 chip). Heavy startup 9 vs their fire at 30 → lands at ~opp.t+10 < 30 ✓ if opp.t<20. But heavy has long recovery; if we miss (they block → 60 chip + crushed stun, fine) or if they dodge. Heavy interrupt is better than light interrupt. But if their su=12 (answered), heavy lands too late → we eat the beam. Use heavy interrupt only in the safe window (opp.t>=12 && opp.t<=18 → su=30). In the opp.t<=4 window use light (safe for both su) — or heavy? opp.t<=4: heavy lands at ~opp.t+9 = 9..13; if su=12 and opp.t=4 → 13 > 12 → too late. Light lands at opp.t+5 = 9 → safe for su=12 ✓ (if opp.t=4 → 9 <12 ✓; but light active frames 5,6,7 → hit at opp.t+5=9 ✓).

OK:
- if opp.t >= 12 && opp.t <= 17 → heavy (interrupt, su=30, lands ~opp.t+9 ≤26 <30 ✓).
- else if opp.t <= 4 && dist <= 108 → light.
- else if dash behind feasible → dash_forward.
- else if ki>=50 && opp.t<=10 → beam (clash).
- else guard.

Wait heavy reach is 140 not 108; use dist<=138.

Also for the 'firing' case: if beam already firing, our blast could... no. Options: dash behind, guard (chip 160 + stun), or if dist > 400 answer beam. Let's also consider 'back'? no.

Alright, also what if the beam is firing but not aimed at us (they're facing away — impossible since they face us when free, but if they dashed past?). Skip.

D. Incoming blast:
```
  if (blast) {
    if (blast.eta !== null && blast.eta <= 6 && me.ki >= 16) return 'dash_back';
    return 'guard';
  }
```
But if the blast is at close range and we're mid-something? We're free here.

Note: guard requires holding; next decision in 6 ticks we may be in blockstun (not free) → no decision until free. Fine.

E. Opp heavy startup (they're winding up a heavy) and dist <= 140:
 - if dist <= 108 → light (interrupt, 5 startup < 9) → they get hit during startup (×1.25 = 50) and their heavy is interrupted.
 - else → dash_back if ki>=16 else 'back'.
 Actually 'back' may not escape; but also our own light can't reach. Also 'heavy' trades badly. Use back.

F. General engagement as described.

G. Ki charging.

Let me also add: if we have ki >= 50 and there's a good beam window: opp is 'crushed' (left 34) → beam startup 30 → fires at 30, they're free at 34 → our beam hits around 30+travel; if dist<=140 travel ~2-3 ticks → 32-33 < 34 ✓ → hit 280! Nice. So beam vs crushed with left>=33 works if dist<=140 (travel ≤ 3). Let's include: oppStun && opp.left >= 32 && dist <= 160 && ki>=50 → beam.

But careful: 'crushed' left: view's left = dur - t. crushed dur 34. If left>=32 → t<=2. So they were just crushed. Our beam startup 30 → fires at t+30; they recover at t+34. Travel time from our front to them: dist ~ up to 160: (160-40-30)/30 = 3 ticks → hit at t+33 ✓ before recovery (t+34). Tight but ok. If dist > 160, use light chain instead.

Also opp down: down dur 42; left>=33 → beam startup 30 fires, hits at 30+travel; they're up at 42 → need travel ≤ 11 → dist ≤ 40+30+330=400. So beam vs down with left>=33 and dist<=380 → guaranteed hit 280. Include.

Hmm, but when we crush them with heavy (heavy vs guard), the crush stun is 34 and left would be 34 → beam hits at 30+travel, travel 3 → 33 < 34 ✓.

Also the sequence: heavy (vs guard) → crush → we're in heavy recovery 22 ticks, then free. Opp crushed left by then = 34-22 = 12 → too late for beam. So the beam window after our heavy only exists if the heavy is the knockdown version (opp down 42) and our recovery ends 22 → left 20 → beam startup 30 → too late. Hmm! So beam after our own heavy isn't feasible (our recovery eats the window).

Unless we use a cancel: light → cancel → light → cancel → light → cancel → heavy... the heavy is a cancel (starts immediately, no recovery wait). Heavy hits at cancel tick+9ish. Then our recovery 22 while opp down 42 → 20 ticks left. Still not enough for beam startup 30.

So beam after knockdown isn't feasible; the beam must be used when we find the opponent already down/stunned at a moment we're free. That happens when: they get knocked down by their own... no. Or when they attack and whiff into... Hmm, when does the opponent become down while we're free? If they get hit by our attack (heavy) → we're in recovery. If they whiff? No down. If we hit them with a heavy cancel (we're in recovery 22). So the down window never coincides with our free time. Unless we dash away... no, dash is 18 ticks.

Therefore beam must be used from a standing start, either:
- Answering their beam (clash).
- Long range poke (dist 250+).
- Vs their crushed state: crushed comes from heavy vs guard — but that's our heavy → recovery. Could also come from their own... no.

So: beam = long-range poke or clash answer. OK. So implement beam usage at long range (dist >= 240) with ki>=50, and beam answer.

Hmm, long-range beam: 30 startup, they can interrupt by reaching us (need dist ≥ ~300) or by blasting us (their blast startup 11 + travel; if they're at 300 → travel 18 → hits at 29 → interrupts our startup at 29 if we fire at 30 — marginal). Or they guard → chip 160 (still good). Or they dash forward → 10 ticks moving, land behind us → our beam misses (ray direction fixed). Dash costs 16 ki.

Expected value of a long-range beam: decent. But if we miss, we lose 50 ki and 30 ticks. Let's use beam when dist >= 280 and ki >= 50 and opp isn't charging (a charging opp would get hit ×1.5 = 420 — great, include charging opp too; but a charging opp approaching slowly... they're not closing).

Also use beam when opp is at dist >= 280 and is 'back' (retreating) → they can't escape the beam (front advances 30/tick) → beam hits ✓ unless they guard (chip 160 ✓) or interrupt. Good.

Let's set beam range threshold at 260.

Also maybe use beam when opp is in 'blast' startup (they're winding up) at long range: their blast might hit our startup. Meh.

Now, also I realize: since ki is precious, maybe we should mostly skip the beam except as an answer. Let's include it at dist>=280 (rare-ish).

Now let's also think about "guard" usage vs light punches: If opp is close and free and we're worried, we could guard to absorb their light (0 damage) while they push us back. But they get nothing either. Guarding gives them nothing but also us nothing; better to attack. Only guard to block blasts and beams.

One more: we should use 'back' when we need to escape a heavy or when we're low HP and want to survive to time? Actually time-out win is by HP difference; if we're behind on HP, rushing is better. HP diff at the end matters. Let's not over-think.

Let me write the final code.

```js
function decide(state) {
  const R = RULES;
  const me = state.me, opp = state.opp, dist = state.dist;

  if (state.clash) return clashChoice(state);
  if (me.canCancel) return cancelChoice(state);

  const blast = state.blasts.find(b => !b.mine && b.incoming);
  const oppDown = opp.state === 'down';
  const oppStun = opp.state === 'hitstun' || opp.state === 'blockstun' || opp.state === 'crushed';
  const oppGuard = opp.state === 'guard';
  const oppCharge = opp.state === 'charge';
  const oppMove = !opp.free && !oppDown && !oppStun;
  const oppHeavy = opp.state === 'heavy';
  const oppBeam = opp.state === 'beam' && opp.phase !== 'recovery';
  const aimed = oppBeam && (me.x - opp.x) * opp.facing > 0;

  // ---- 1. 大招威胁 ----
  if (aimed) {
    if (opp.phase === 'startup') {
      if (opp.t >= 12 && opp.t <= 17 && dist <= 138) return 'heavy';   // 打断
      if (opp.t <= 4 && dist <= 108) return 'light';
      if (dashBehindOk(state)) return 'dash_forward';
      if (me.ki >= 50 && opp.t <= 10) return 'beam';
      return 'guard';
    }
    if (dashBehindOk(state)) return 'dash_forward';
    return 'guard';
  }

  // ---- 2. 对手气功波 ----
  if (blast) {
    if (blast.eta !== null && blast.eta <= 6 && me.ki >= 16) return 'dash_back';
    return 'guard';
  }

  // ---- 3. 对手重击起手 ----
  if (oppHeavy && opp.phase === 'startup' && dist <= 140) {
    if (dist <= 108) return 'light';
    if (me.ki >= 16) return 'dash_back';
    return 'back';
  }

  // ---- 4. 近身 ----
  if (dist <= 140) {
    if (oppGuard) return 'heavy';
    if (oppCharge) return 'heavy';
    if (oppMove) return 'heavy';   // 反击
    if (dist <= 110) return 'light';
    return 'heavy';
  }

  // ---- 5. 远距离 ----
  if (me.ki >= 50 && dist >= 260) return 'beam';
  if (oppStun && opp.left > 30) { /* 少有人 */ }
  if (me.ki < 50 && (oppDown || oppStun) && dist > 120) return 'charge';
  if (dist > 300 && me.ki >= 20 && !oppCharge) return 'dash_forward';
  return 'forward';
}
```

Hmm wait, in step 4: 'light' when the opponent is free at dist<=110. But if the opponent is in 'forward' moving at us, fine.

Also note oppMove includes their dash recovery and blast recovery etc → heavy counter ×1.25 ✓.

But careful: oppMove also includes 'beam' phase startup/firing (handled above only if aimed at us). If their beam is not aimed at us (we're behind them?), then heavy counter is fine.

Also opp.state==='dash' phase moving → heavy counter.

Also 'recover' state (after winning a clash) → heavy counter ×1.25? MOVES doesn't include 'recover' → mult returns 1 unless charging. Fine.

Step 4 also handles oppDown: if opp is down and dist<=140, we should not attack (they're untouchable) — actually heavy would whiff. Let's handle oppDown before: if oppDown → if dist > 100 → 'forward' (approach) else 'idle'/'charge' (wait). Let's add at top of step 4: if (oppDown) { if (dist > 100) return 'forward'; return me.ki < 50 ? 'charge' : 'idle'; } Hmm charging while they're down: they might get up and hit us for ×1.5. But we charge only 20 ticks → +7 ki. Let's do 'idle' instead if ki>=50 else charge. Eh, let's just approach and idle.

Wait, but during their down, our own free time is precious for charging ki. If opp is down (42 ticks) and we're free, charging gives 15 ki in 42 ticks. But when they get up, we're mid-charge (vulnerable). Let's charge only if opp.left > 25 (so we have time to stop) — but we can't stop charging except by deciding idle; decisions every 6 ticks. Fine: charge if opp.left > 30.

Similarly oppStun (crushed 34) → charge if left>30.

Let me restructure step 5 & oppDown handling:

```
  // 对手倒地/硬直
  if (oppDown || oppStun) {
     if (opp.left > 30 && me.ki < 50) return 'charge';
     if (dist > 110) return 'forward';
     // close enough: light won't hit (down) → wait
     if (oppDown) return 'idle';
     // stunned: can hit
     if (dist <= 108) return 'light';
     if (dist <= 138) return 'heavy';
     return 'forward';
  }
```
Hmm careful: oppStun includes hitstun (15) and blockstun (11) → left small → skip charge. Stunned opponents can be hit: light chain adds damage but their combo count is high (scaling). Meh, still damage.

Hmm, but hitting a stunned opponent whose combo is already 3 gives 0.55 scaling. Whatever.

Wait, there's an issue: if opp is in hitstun/blockstun, that's usually right after our own hit, when we're in recovery (not free). If free (e.g., after dash), rare.

Also: if opp is stunned and we're free, our light opens a chain ✓.

Now step 5 (far): 
```
  if (dist > 140) {
    if (me.ki >= 50 && dist >= 260) return 'beam';
    if (dist > 300 && me.ki >= 20 && !oppCharge) return 'dash_forward';
    if (me.ki < 50 && opp.state === 'charge' ... )
    return 'forward';
  }
```
Should we ever charge at long range? If both far and opp idle, charging is efficient (0.36/tick). But they're likely approaching. Let's charge if dist > 220 && opp not moving toward us? We can't know their movement direction from a single frame; we could track opp.x over time. Let's track previous opp.x in a top-level variable to estimate their movement. Since top-level resets per match, and decide is called ~10/s, we can compute velocity.

Let's keep a small memory: prevOppX, prevT. Compute oppVx = (opp.x - prevOppX)/(t - prevT). If opp is approaching (closing), forward is better; if they're stationary/backing, charge.

Simple approach: if dist > 200 and oppVx small (< 2) → charge (if ki<50). Let's include with a threshold: opp moving toward us (vx toward) vs away. Compute signed: rel = (opp.x - prevOppX) * sign(opp.x - me.x)? Let's compute closing rate: d(dist)/dt = -(opp.x - me.x) direction... Let's define dirToOpp = Math.sign(opp.x - me.x); closing = -dirToOpp * (opp.x - prevOppX)/(dt) (positive = approaching). If closing < 1 → they're not approaching → charge.

But during charging we're vulnerable; if they then approach we can decide to move.

I'll include charging only when: ki < 50, dist > 190, closing rate < 2 (not approaching fast), and opp isn't charging (if they charge, we can wait too — but then neither advances; fine, we charge and they charge).

Hmm, also if opp is charging and far, we might blast them (60×1.5=90) — nice! Blast travels 13/tick; if they're at 250, hits at 11+14=25 ticks. They may stop charging and guard (chip 12) or walk. Let's use blast vs charging opponent at dist 120-300 with ki>=30: good damage potential.

Let's add: if (oppCharge && dist <= 300 && dist > 120 && me.ki >= 30) return 'blast';

Hmm but blast might be blocked. Still 12 chip + our pressure... it's ok.

Now the cancel choice:

```js
function cancelChoice(state) {
  const me = state.me, opp = state.opp, dist = state.dist;
  const chain = me.chain; // 1..4
  if (chain <= 2) {
    if (dist <= 110) return 'light';
    if (dist <= 140) return 'heavy';
    if (dist <= 200 && me.ki >= 30) return 'blast';
    return 'idle';
  }
  if (chain === 3) {
    if (dist <= 140) return 'heavy';
    if (dist <= 210 && me.ki >= 30) return 'blast';
    return 'idle';
  }
  // chain === 4
  if (dist <= 140) return 'heavy';
  if (dist <= 210 && me.ki >= 30) return 'blast';
  return 'idle';
}
```
Wait chain<=2 → light if dist<=110. But note the light requires dist<=110 at its hit time; dist grows 14 per light push. Let's re-derive the damage-optimal plan: we want lights while dist<=110 then heavy.

chain=1 (after 1st light): if dist<=110 → light#2 (then dist+14; heavy later). if dist>110 → heavy (dmg 96, knockdown).
chain=2 (after 2nd light): dist = d0+28. If dist<=110 → light#3; else heavy (78).
chain=3 (after 3rd light): dist = d0+42 → heavy (66) if <=140.
So the code above: chain<=2 → light if dist<=110 else heavy — matches. But note at chain=2, choosing light requires dist<=110 AND heavy after requires dist+14<=140 → dist<=126 ✓ implied.

chain=3 → heavy if dist<=140 (d0+42<=140 → d0<=98). If d0=100, chain=3 never reached (chain=1 gave heavy since dist after push=114>110). Consistent.

So the chain=3 heavy requires d0<=98 which is consistent with chain=1 light (d0+14<=110 → d0<=96) and chain=2 light (d0+28<=110 → d0<=82). Hmm: if d0=90: chain1 dist=104 ≤110 → light#2; chain2 dist=118 >110 → heavy (78) → total 40+32+78=150 + knockdown. If d0=82: chain1 96 light, chain2 110 light, chain3 124 heavy → 164.

Fine.

Also at cancel, we might consider 'beam' as the 4th hit (280×0.55=154!) — better than heavy (66)! But beam startup 30 while the opponent is in hitstun 15 → they recover at 15 and can act; they'd be free before our beam fires (30). But if they're close they might interrupt. Beam also has 50 ki. Alternatively blast as the 4th: 60×0.55=33. Beam 154 > heavy 66. Hmm, beam needs ki>=50 and 30 ticks of commitment; if they interrupt we lose 50 ki and they might kill us. But the reward is high. Given beam's damage, maybe use beam at cancel when chain==3 (4th hit) if ki>=50 and dist>140 (so they can't easily interrupt... but then the beam has to travel; the opponent recovers at 15 and can block/guard → chip 160×0.55? wait chip is applied directly without combo scaling? In land(), for guard: chip damage via hurt(M.chip) = 160 flat (no scaling!). Nice: guarding a beam gives 160 flat chip damage + stun until beam end. Wow, beam vs guard = 160 damage. So beam at cancel chain 3 vs a guard = 160. Great.

But vs a free opponent at dist 140, beam startup 30 → they can hit us during startup (light 40×1.25=50, or heavy 150). Risky but EV positive? Hmm.

I'll add: at cancel chain==3, if ki>=60 (keep reserve) and dist>=120 → 'beam'? Hmm, I'm not sure. Let's evaluate roughly: beam as 4th hit: expected damage maybe 200 (280 hit, 160 chip, 0 if interrupted) vs heavy 66 with knockdown. If beam connects (prob ~0.5), 280 vs 66 → +214. If interrupted (0.5), 0 and we lose 50 ki and 30 ticks (~maybe 60 damage from their counter). Expected: 0.5*280+0.5*0 = 140 > 66. Slightly favorable. But interrupting requires them to reach/hit during 30 ticks; at dist 140 they can light immediately (5 startup) → interrupt with high probability! At dist >= 200 they can't reach (need 90/4.5=20 ticks to reach 110 → then hit at 25 <30 → can interrupt). At dist >= 260 they can't reach in time (need 150/4.5=33 ticks > 30). But wait: after our 3-light chain, the opponent has been pushed away; dist = d0+42 ≈ 130-150. Too close for beam. So heavy is right at cancel chain 3.

Unless the opponent is guarding (then beam = 160 chip). We can't know if they guard... we know their state at cancel: state.opp.state! If opp.state === 'guard' → beam would chip 160! But wait, they're in hitstun (we hit them), so their state is 'hitstun', not guard. They can't guard during our chain. So no.

OK: cancel chain3 → heavy. Good.

Now, one more important consideration: after the heavy (knockdown), we want to follow up. Since the knockdown gives us 42 ticks vs their 42 and our recovery 22, we have ~20 ticks free before they get up. During that time we can: walk forward to be in range to attack when they get up (and their recovery from down → they can act immediately). If we can land a light as they get up (counter on their free state? no bonus) it's 40 + chain. Better: be at dist ~90 and start a light exactly when they're up.

Our free() sets nextAsk = tick+1 so we get asked immediately when recovery ends, and again 6 ticks later. So we can time it.

Also after they get up, they might attack us (they were hit, they may retaliate). We'll be ready.

Let's also handle: when we're free and the opponent is in 'down' with dist>110 → 'forward' to close.

OK, let's write the final code now, with reasonable comments in Chinese.

One more: the `state.blasts` may include our own blast (mine). Also incoming flag already accounts.

Also note `blast.eta` for incoming: ceil((gap - body)/speed).

Let me write final code.

```js
'use strict';
```
Avoid 'use strict' issues? Fine, but in a sandbox the file top-level might be evaluated as a module/script. Use plain function declarations (hoisted) — good since function declarations are hoisted.

I'll write helper functions before decide (hoisting handles order anyway).

Let me write:

```js
function aiPower(ki, hp, pushing) {
  const C = RULES.clash;
  let p = ki > 0 ? C.base + C.kiPower * ki : C.empty;
  if (pushing && ki > 0) p += C.pushPower;
  if (hp < C.rageHp * RULES.hp) p += C.rage;
  return p;
}

function clashChoice(state) {
  const me = state.me, opp = state.opp;
  const oppP = state.clash.oppPower;
  const mine = aiPower(me.ki, me.hp, false);
  const minePush = aiPower(me.ki, me.hp, true);
  if (me.ki >= 10 && minePush > oppP + 0.05) return 'push';
  return 'idle';
}
```
Note: state.clash.oppPower already includes their push flag. Our myPower in state includes our push flag (if we pushed last tick) — but I compute mine from ki & assume not pushing; when we return 'push' last tick, our power actually included +0.6. My comparison minePush vs oppP is the right question: if we push now, our power = minePush. If oppP >= minePush, pushing is futile; don't push (save ki). If minePush > oppP, push.

But one subtlety: if we were already pushing (last tick) and now choose idle, our power drops to mine; if oppP is between, we'd lose the position. We compare consistently: push if minePush > oppP + 0.05 else idle. Slight hysteresis: if we were pushing and minePush > oppP, continue. Fine.

Edge: ki low (<10): minePush = mine (no push bonus) → we'd return idle. Condition me.ki>=10 ensures push gives bonus. Also push drains 0.8/tick → at ki=10 we have 12 ticks. Hmm, but pushing with a power advantage early is good. Set threshold ki>=8.

Also rage: both apply.

Also note the clash drains ki 0.2/tick; our push decision each 6 ticks: with ki 40, push drains 4.8 per 6 ticks → 8 decisions.

Let's also add: if our power advantage is big (minePush > oppP + 0.3) push aggressively; else if advantage small, still push (any advantage drifts). Actually pushing costs ki which reduces our future power, but the advantage persists mostly. Let's push whenever minePush > oppP + 0.02 and ki >= 8.

Hmm, but consider: our ki=20, opp ki=100 (oppP=3.0), ours minePush=1+0.4+0.6=2.0 → we don't push → we lose eventually. Nothing to do.

Now, code for canDashBehind:

```js
function dashBehindOk(state) {
  const R = RULES, me = state.me, opp = state.opp;
  const dist = state.dist;
  if (dist > 142) return false;
  const room = opp.facing > 0 ? opp.x - R.stage.left : R.stage.right - opp.x;
  const need = Math.max(60, 200 - dist) + 8;
  return room >= need;
}
```
Note: also the landing x must be within the stage — room check covers that.

Hmm, also dashEnd requires the initial x1 = me.x + d*200 clamped within stage, and pass-through logic uses 'after' computed from the unclamped x? It computes x = me.x + d*200, then before/after; then x = behind; then clamp. The 'behind' check uses L,H. Our room calc: behind = o.x + d*max(minGap, -after) where after = (o.x - x)*d = dist - 200 (if x unclamped). But x is clamped to stage first? Look: `let x = a.x + d * R.dash.dist;` then computes before/after with this x (unclamped), then maybe sets x=behind, then `return clamp(x, L, H)`. So behind must be in [L,H] for pass-through; else fallback to in-front. Our check: room behind opp = distance from opp to the wall behind them; need behind = opp.x + d*max(60,200-dist) within [L,H] → need room >= max(60,200-dist). I add +8 margin. ✓.

Also our own position: if we start at 40 and dash forward... fine.

Now let me also double check the beam "answer" condition when opp beam startup: start() for beam computes aimed = o.state==='beam' && phase !== 'recovery' && (a.x - o.x)*o.facing > 0 → yes, if their beam is aimed at us, our beam gets su = max(counterStartup=12, their su - their t) if they're in startup. So if their su=30 and t=5 → su = max(12, 25) = 25 → we fire at 25, they fire at 30 → clash at ~25-30? Our beam fires first at 25, front advances; their beam starts at 30. Do they clash? Beams clash when both exist and fronts cross. Our front advances 30/tick from our position; their front from theirs. They'd meet. But between our firing (25) and their firing (30), our beam could hit them! If dist 300: our front needs (300-40-30)/30 ≈ 8 ticks → hits at 33, after they fire at 30 → then it's a clash (both firing) → clash at ~30ish when fronts meet: our front at 30 is at 40+5*30=190 from us; theirs starts at 30. They clash when fronts meet: our front 190+... ok they'd clash before either hits. Fine.

If their t is small (e.g., 0) → our su = max(12, 30) = 30 → simultaneous → clash. Good.

If their beam is firing (not startup) → our su = max(12, 0) = 12 → we fire 12 ticks later; meanwhile their beam front may reach us → we take 280. As computed, answering a firing beam is usually bad. But if dist is huge (their front hasn't reached us yet in 12 ticks): need dist > 12*30 + 30 + 40? Their front starts at opp.x+25+40... front starts at from+40? In beams(): from = a.x + facing*25, front = a.x + facing*40 initially, then advances 30/tick. So their front is 40 from them; it reaches us when front >= our x - body: distance covered = dist - 40 - 30(body) → ticks = (dist-70)/30. For >12 ticks: dist > 430. Rare. So don't answer a firing beam (except dash behind).

OK.

Now, another important detail: our own beam when the opponent has a beam in startup — our beam creates a clash. Fine.

Let me now write the whole file.

Also add a tiny memory for opponent velocity for charging decisions.

```js
let _prev = null;
function oppClosing(state) {
  const opp = state.opp, me = state.me;
  if (!_prev || state.t <= _prev.t) { _prev = { t: state.t, x: opp.x }; return 0; }
  const dt = state.t - _prev.t;
  const dx = opp.x - _prev.x;
  _prev = { t: state.t, x: opp.x };
  const dir = Math.sign(opp.x - me.x) || 1;
  return -dir * dx / dt;  // >0 approaching
}
```
Careful: decide is called only sometimes (every 6 ticks) — dt ~6. OK. But note the cancel call happens at odd ticks; dt might be 1. Fine.

Note: this is called once per decide → update each call. But multiple decide calls per tick? Only one per side. Fine.

Let's finalize the flow, then write code.

Final decide:

```js
function decide(state) {
  const R = RULES, me = state.me, opp = state.opp, dist = state.dist;
  if (state.clash) return clashChoice(state);
  if (me.canCancel) return cancelChoice(state);

  const closing = oppClosing(state);
  const blast = state.blasts.find(b => !b.mine && b.incoming);
  const oppDown = opp.state === 'down';
  const oppStun = opp.state === 'hitstun' || opp.state === 'blockstun' || opp.state === 'crushed';
  const oppGuard = opp.state === 'guard';
  const oppCharge = opp.state === 'charge';
  const oppMove = !opp.free && !oppDown && !oppStun;
  const oppBeam = opp.state === 'beam' && opp.phase !== 'recovery';
  const aimed = oppBeam && (me.x - opp.x) * opp.facing > 0;

  // 1. 大招
  if (aimed) {
    if (opp.phase === 'startup') {
      if (opp.t >= 12 && opp.t <= 17 && dist <= 138) return 'heavy';
      if (opp.t <= 4 && dist <= 108) return 'light';
      if (me.ki >= 16 && dashBehindOk(state)) return 'dash_forward';
      if (me.ki >= 50 && opp.t <= 10) return 'beam';
      return 'guard';
    }
    if (me.ki >= 16 && dashBehindOk(state)) return 'dash_forward';
    return 'guard';
  }

  // 2. 气功波来袭
  if (blast) {
    if (blast.eta !== null && blast.eta <= 6 && me.ki >= 16) return 'dash_back';
    return 'guard';
  }

  // 3. 对手重击起手
  if (opp.state === 'heavy' && opp.phase === 'startup' && dist <= 140) {
    if (dist <= 108) return 'light';
    if (me.ki >= 16) return 'dash_back';
    return 'back';
  }

  // 4. 对手倒地/硬直
  if (oppDown || oppStun) {
    if (opp.left > 30 && me.ki < 50) return 'charge';
    if (dist > 108) return 'forward';
    if (oppDown) return 'idle';
    if (dist <= 108) return 'light';
    if (dist <= 138) return 'heavy';
    return 'forward';
  }

  // 5. 近身
  if (dist <= 140) {
    if (oppGuard || oppCharge || oppMove) return 'heavy';
    if (dist <= 110) return 'light';
    return 'heavy';
  }

  // 6. 远距离
  if (oppCharge && dist <= 300 && me.ki >= 30) return 'blast';
  if (me.ki >= 50 && dist >= 260) return 'beam';
  if (me.ki < 50 && dist > 190 && closing < 2 && !oppCharge) return 'charge';
  if (dist > 300 && me.ki >= 20 && !oppCharge) return 'dash_forward';
  return 'forward';
}
```

Wait step 5: oppMove includes 'beam' not aimed at us (we're behind?) — then heavy is fine. Also includes 'dash' etc.

But hold on: oppMove includes their 'beam' phase 'recovery'? Their recovery: phase 'recovery' → mult counter ×1.25 → heavy counter ✓.

Hmm, but oppMove also includes 'blast' startup — interrupting their blast with heavy ×1.25 ✓ good.

Also oppMove includes 'light' startup — counter heavy ×1.25 (150 dmg) ✓ excellent.

Now step 5 when opp is 'idle' and dist<=110 → light (chain). But should we prefer heavy vs an idle opponent? Chain gives 164+knockdown vs heavy 120+knockdown. Chain better. But chain takes ~16 ticks vs heavy 9 — and they might escape? No, they're stunned through. OK.

Hmm, one risk: our first light might be blocked if the opponent decides to guard at that exact tick (both decide simultaneously). If they switch to guard, our light is blocked → no cancel, we get pushed back 14 and they're in blockstun 11. Not terrible.

Now step 6: 'charge' when ki<50 and far and not approaching. But if we charge, we stay charging for 6 ticks (decision interval) and ki grows 0.36*6 = 2.16 per decision. From 30 to 50 needs 10 decisions = 60 ticks. Hmm.

Also 'forward' gives 0.08/tick.

Consider a smarter ki policy: charge only when the opponent is also not closing, as we do.

Also, should we consider that we need 50 ki only rarely? Beam usage: dist>=260 & ki>=50. If we never reach 50, we never beam. Let's also allow beam answer (needs 50). Hmm. Maybe lower the beam range threshold to 240 and also allow the beam at close range if the opponent is stunned? Fine.

Let me reconsider charging: since ki is needed for dashes too (16), and blast (14). Let's set the charge goal to 60 and charge when ki < 60.

But charging is risky (1.5x damage). Our condition: dist>190 and closing<2 → they're far and slow → OK.

Alright, let me finalize with ki thresholds:
- dash: ki >= 16 (exactly enough).
- blast: ki >= 30 (keep 16 reserve for dash).
- beam: ki >= 50 (exactly cost) — maybe require 52 for safety? cost is 50, ki must be >= 50. Use >= 50.

Also, after using blast (ki 30-14=16), we might dash.

One more: we should avoid charging when the opponent is about to reach us. closing<2 means they're not approaching. But they might dash (16 ki). Random. Accept.

Let me also add: if hp < 30% (rage), we're more aggressive (attack more, less charge). And if we're losing badly? skip.

I think it's good enough. Let me write the final code carefully, ensuring valid action names.

Also note: 'idle' is valid.

One thing: in step 4 (oppDown/oppStun), if opp.left > 30 && me.ki < 50 → charge. But charging while the opponent is about to get up (left>30 means at least 30 ticks left) → fine, we can stop charging when they wake (we decide every 6 ticks; charging state persists until we decide). But if we're charging and they attack us, we take ×1.5. Hmm, with left>30 we have 30 ticks to react. OK.

Also in step 4, if opp is stunned and dist<=108 → light. But their combo counter is high → scaling 0.4-0.55. Fine, and it leads to a chain. But careful: if opp is in 'crushed' (from our heavy vs their guard) they can't act for 34 ticks; light → hit → cancel → chain → 164 damage. But our light push increases dist. Fine.

Let me also handle: opp.state === 'blockstun' (they blocked our light) — we might be in recovery. If free: light again would be blocked again. Better: heavy (crush). Let's refine step 4: if opp.state === 'blockstun' → heavy (crush their guard).

Actually oppStun blockstun: they just blocked our light; they're in blockstun 11 and their guard state is gone? stun sets state='blockstun' → not 'guard' → so our next hit isn't blocked ✓. Light works.

OK, final code. Let me write it.

Also we should double check `state.blasts.find` — blasts is an array ✓. `b.incoming` boolean ✓. eta null for non-incoming.

Writing now.

Additional consideration on `decide` being called when `me.free` is true but our state is e.g. 'guard' (we chose guard last time). All good.

Let me write the final file.

```js
/* ===== AI 武道会 · 选手程序（第1季） ===== */

let _prevOpp = null;

function aiClashPower(ki, hp, pushing) {
  const C = RULES.clash;
  let p = ki > 0 ? C.base + C.kiPower * ki : C.empty;
  if (pushing && ki > 0) p += C.pushPower;
  if (hp < C.rageHp * RULES.hp) p += C.rage;
  return p;
}

function dashBehindOk(state) {
  const R = RULES, opp = state.opp, dist = state.dist;
  if (dist > 142) return false;
  const room = opp.facing > 0 ? opp.x - R.stage.left : R.stage.right - opp.x;
  const need = Math.max(R.minGap, R.dash.dist - dist) + 8;
  return room >= need;
}

function oppClosingRate(state) {
  const opp = state.opp, me = state.me;
  const p = _prevOpp;
  _prevOpp = { t: state.t, x: opp.x };
  if (!p || state.t <= p.t) return 0;
  const dt = state.t - p.t;
  const dir = (opp.x - me.x) >= 0 ? 1 : -1;
  return -(dir * (opp.x - p.x)) / dt;
}

function clashChoice(state) {
  const me = state.me;
  const oppP = state.clash.oppPower;
  const mine = aiClashPower(me.ki, me.hp, false);
  const minePush = aiClashPower(me.ki, me.hp, true);
  if (me.ki >= 8 && minePush > oppP + 0.02) return 'push';
  return 'idle';
}

function cancelChoice(state) {
  const me = state.me, dist = state.dist;
  const chain = me.chain | 0;
  if (chain <= 2) {
    if (dist <= 110) return 'light';
    if (dist <= 140) return 'heavy';
    if (dist <= 200 && me.ki >= 30) return 'blast';
    return 'idle';
  }
  if (dist <= 140) return 'heavy';
  if (dist <= 210 && me.ki >= 30) return 'blast';
  return 'idle';
}

function decide(state) { ... }
```

Wait: cancelChoice when chain<=2 and dist>140 → blast? The blast may be blocked... but they're in hitstun so it lands (60×scale). But blast travels: from our front, at dist 150 it takes (150-40-30)/13 ≈ 6 ticks + 11 startup = 17 ticks; their hitstun 15 → they'd recover at 15 and might interrupt (they can hit us during our blast startup? our startup 11 < 15 → they'd recover at 15 and hit us at 20 while our blast is in recovery). Hmm messy. Instead at chain<=2 with dist>140, better to just 'idle' and let the combo end? But then we lose the chance to convert the combo. Actually if dist>140 after 2 lights, that means d0+28>140 → d0>112 — impossible since we started light only at dist<=110! Wait dist after 2 lights = d0+28 ≤ 138. So at chain=2, dist ≤ 138 → heavy (damage 78). Good, so the blast branch is nearly unreachable at chain<=2. At chain=3, dist = d0+42 ≤ 152 → heavy if <=140, else blast at 152 (travel (152-70)/13=6+11=17 ticks; hitstun 15 → they recover at 15... they'd be hit at 17, might get interrupted/blocked). Marginal. Keep.

Hmm, but actually we could cancel into blast earlier to hit them during hitstun? Blast damage 60 vs light 40/32. No, light better.

Now let me double-check the light-chain reach assumption: light reach 110 at hit time. At cancel chain=1, dist = d0+14 (opponent pushed). If d0 = 100 → 114 > 110 → we go heavy at chain=1 (136 dmg + knockdown). ✓.

Now write decide with the flow I described.

Let me also handle a subtle thing: `state.me.chain` is only present on me (chain). opp has combo (number of hits they've taken in this stun string). Use opp.combo to decide scaling? Not needed.

Final: also consider using 'guard' when our hp is low and the opponent is close and free, to stall? Meh, no.

Write it.

I also want to double check `state.opp.left` for 'down': view gives left = dur - t ✓.

For opp.state 'down', opp.left ≤ 42.

One more improvement: after our heavy knockdown, we want to be close to attack when they get up. In step 4 (oppDown), dist>108 → 'forward'. ✓

Also during oppDown, if me.ki<50 and opp.left>30 → charge (instead of forward). Conflict: order matters. Put charge first only if dist <= 108 (we don't want to move)? Hmm, if they're down and far, better to approach. Let's do: if dist > 108 → forward (approach). Else if opp.left>30 && ki<50 → charge. Else idle.

Let me finalize.

Also potential issue: 'idle' repeatedly while opponent is down → we're free each tick but only asked every 6 ticks; fine.

Write the final answer with code and the 赛前宣言 line (≤20 chars).

宣言: "拳到之处，气亦为风。" or "以拳会友，以气争锋。" (10 chars). Good.

Let me write the code cleanly.

One more check on rule: "guard: 举着格挡时每 tick 少回 0.03 气" ✓ and our guard usage is situational.

Also: is 'push' valid outside clash? It becomes idle. We only use it in clash.

Now writing final code.

Also, I should double check the beam "answer" condition `opp.t <= 10`: their su could be 30 (likely) → our su = max(12, 30 - t) = 30 - t (if t<=18) → we fire at 30-t... wait our su = max(counterStartup, o.su - o.t) = max(12, 30-t). If t=10 → 20 → we fire at our t=20; they fire at their t=30 (20 ticks later) → we fire 10 ticks earlier → our beam front advances 30/tick for 10 ticks = 300 → if dist < ~300 our beam would HIT them before they fire! That's great (280 damage) — wait but if our beam hits them, their beam dies (they get hit → stunned, beam interrupted). Yes! So answering early is even better: our beam hits them during their startup → 280 damage. 

So beam answer when opp.t is small (their startup just began) → we fire earlier → we might hit them before they fire! Condition: our su = 30 - opp.t (if opp.t<=18), and our beam reaches them at su + travel. Their fire at 30. We need su+travel < 30 → (30-t) + travel < 30 → travel < t. travel ≈ (dist-70)/30. So if dist < 30*t + 70. E.g., t=10 → dist < 370 → we hit them first! Excellent.

So beam answer is great. But careful: if we hit them, their beam is interrupted, we get 280 damage + knockdown. 

So beam answer condition: me.ki >= 50 and opp.t >= ? and dist < 30*opp.t + 70ish. Let's use: if me.ki >= 50 && opp.t <= 18 && dist <= 30*opp.t + 60 → beam (we hit first). Else if opp.t <= 10 → beam (clash). Else dash/guard.

Hmm, but if opp.t is large (say 15) and dist 300: our su = max(12, 15) = 15 → we fire at 15, travel (300-70)/30 = 7.7 → hit at 23; they fire at 30 → we hit them first ✓ (they're still in startup at 23 ✓).

Great, so the general rule: our answer fires at su = max(12, 30 - opp.t); they fire at 30; we hit first if su + travel < 30, i.e., max(12,30-t) + travel < 30. With t<=18: 30-t + travel < 30 → travel < t. So condition dist < 30t + 70 (approx). If t <= 12 → su = 12 → 12+travel < 30 → travel < 18 → dist < 610. Always true. So for opp.t <= 12, beam answer always hits first (they can't fire before us) — unless they interrupt our startup (they need to hit us during our 12 ticks: if dist <= 108 they can light at t+5 → interrupt!). Hmm: if they're close, they can interrupt our beam startup with a light (5 startup). So beam answer at close range is bad. But their beam at close range would hit us anyway.

So: beam answer if ki>=50 and dist >= 120 (they can't interrupt quickly; a heavy reaches 140 though — a heavy startup 9 would hit us at t+9 if dist<=140, interrupting our 12-tick startup → we lose 50 ki). So require dist > 145 for safe answer? But then their beam (30 startup) reaches us at travel (dist-70)/30 ticks... they fire at 30, hits us at 30+travel. Our beam fires at su=12..30-t and hits them earlier if travel < t. Hmm, but we need to be hit-safe: our startup is su ticks; if they hit us during it, we lose. At dist 200, they need to reach us: they're already in range? light reach 110; dist 200 → need 20 ticks walking → they can't interrupt our 12-20 tick startup unless they dash (10 ticks moving + 8 recovery; dash lands at dist 60 → then light at +5 = 15 ticks; if our su=12, we fire before they hit ✓; if su=20, they hit at 15 <20 ✗).

OK it's getting deep. Let's simplify the beam answer rule:
- If me.ki >= 50 and dist >= 150: answer with beam when opp.t <= 12 (we fire at 12, they at 30, we hit first, and they can't reach us quickly at dist>=150: they need 9 ticks to reach light range 110... at dist 150 → 40/4.5 = 9 ticks + 5 startup = 14 > 12 ✓ barely).
  Hmm at dist 150 they can heavy (reach 140 — no, 150>140 → can't). Light reach 110 → 9 ticks walk + 5 = 14 > 12 ✓ (unless dash).
- If me.ki >= 50 and opp.t <= 18 and dist < 30*opp.t + 60 and dist >= 150 → beam (we hit them during their startup).
   For opp.t>=13: su = 30-t (13→17, 18→12). travel < t → dist < 30t+70. Fine.
- Else fallback.

Combined: beam answer if ki>=50 && dist>=145 && (opp.t <= 12 || dist <= 30*opp.t + 60).

Hmm, but dist 145-... they can't interrupt with light (reach 110) but could with heavy (reach 140 — 145>140 ✓ no).

Wait, but during our beam startup we don't move; the opponent is at dist 145 and closing (they walked to 145?). Whatever.

Also careful: our beam hits them → they take 280 + knockdown. But hold on: if we answer their beam and hit them, do we also get hit by their beam? No — their beam never fires (interrupted).

Excellent, so beam answer is a huge swing. Let's make it a high priority when ki >= 50.

Also: our beam might clash with theirs if their beam fires before our beam hits. We accounted.

Also possibility: they answer our beam → clash. Fine.

Let me finalize the beam-threat branch:

```
if (aimed && opp.phase === 'startup') {
  // 我方大招抢先命中
  if (me.ki >= 50 && dist >= 145 && (opp.t <= 12 || dist <= 30 * opp.t + 60)) return 'beam';
  // 打断
  if (opp.t >= 12 && opp.t <= 17 && dist <= 138) return 'heavy';
  if (opp.t <= 4 && dist <= 108) return 'light';
  if (me.ki >= 16 && dashBehindOk(state)) return 'dash_forward';
  if (me.ki >= 50 && opp.t <= 10) return 'beam';
  return 'guard';
}
```
Hmm order: prefer the beam answer (huge) over heavy interrupt? Beam answer hits for 280 (they're in startup → no counter mult? mult() applies when the target is in startup/recovery → MOVES.has('beam') ✓ and phase 'startup' → counter ×1.25 → 350 damage!! Wow. Plus knockdown 50.

So beam answer first (if conditions). But risk: they interrupt our startup (dist 145-200 close-ish). Let's keep dist >= 150 for safety and require opp.t <= 12 or the travel condition.

Hmm, wait: if their beam is aimed at us and dist < 145, we can't beam safely; heavy interrupt (if dist<=138) is good: heavy ×1.25 (they're in startup) = 150 damage + crush! Actually heavy vs a beam-startup opponent: land() → they're in 'beam' state (not guard) → damage 120 × counter 1.25 = 150, and stun → their beam is interrupted ✓. Great. So heavy interrupt at dist<=138 is strong.

And light interrupt: 40×1.25=50.

So at close range, heavy interrupt (150) is better than light. And at close range, beam answer is risky but gives 350. Hmm, at dist 120 with opp.t=5: our beam su = max(12,25)=25, they'd fire at 30, our beam hits at 25+travel(2)=27 → 350 damage, but they can interrupt our startup: at dist 120 they can't light (reach 110) but can heavy (reach 140): heavy startup 9 → hits us at t+9 → interrupts our beam (we take 150×1.25... our state is beam startup → counter mult on them = 1.25 → 187 damage!). Bad trade-ish (they take 350, we take 187 — actually favorable!). Hmm, but if they interrupt with light... can't at 120.

OK let's allow beam answer at dist >= 120 with the travel condition, but be careful. Let me set: beam answer if ki>=50 && opp.t <= 18 && (dist <= 30*opp.t + 60) && dist >= 115. Where the travel condition ensures we hit them before their fire.

But also they might interrupt us during the startup (they'd need to reach us). At dist 115-140 they can heavy. Risk accepted? Their heavy would hit us during our startup only if they start it before our su ends. Their heavy startup 9 + our su... if opp.t=18 → our su=12 → they can't (heavy hits at t+9 > 12 ✓ we fire first). If opp.t=5 → our su=25 → they can heavy at t+5 → hits at 14 < 25 → interrupt. So risk when opp.t is small. Add condition: our su = max(12, 30-opp.t); they can interrupt if they can land a hit before su: they need ~9 ticks (heavy) → so if su <= 9+... For heavy to land before su: 9 < su → su > 9 → always (su>=12). So a heavy interrupt is possible whenever they're in heavy range (140). Light interrupt possible if dist<=110 and 5 < su → yes.

So: beam answer requires dist > 140 (can't be hit by heavy) OR their startup so advanced that su <= 9 (impossible, min 12) — so require dist >= 145.

But then the "travel" condition: at dist 145+, travel = (145-70)/30 = 2.5 ticks. We need travel < t → t >= 3. And our su = 30-t (t<=18) → for t=3: su=27, travel 2.5 → hit at 29.5 < 30 ✓ barely.

Hmm OK: beam answer condition: ki>=50, dist>=145, and su + travel < 30 where su = max(12, 30-opp.t), travel = max(0,(dist-70)/30). Let's implement that computation directly. 

dist >= 145 and (max(12,30-t) + (dist-70)/30 < 30).

For t=5: su=25, need travel < 5 → dist < 220. So at dist 200, t=5 → hit at 25+4.3=29.3 <30 ✓.

But also they're not interrupted... if they interrupt our startup we lose. At dist>=145 they can't heavy (140) ✓ but they could dash (16 ki) → dash lands 60 in front → then light at +5 → 15 ticks; our su=25 → they interrupt at 15 <25 ✗. Risk. Dash cost 16; they might.

Overall EV: beam answer when conditions hold is strongly positive. Let's include with dist>=145.

Also the alternative "guard" fallback: chip 160 for their beam — actually guard vs beam: pay 15 ki, chip 160, stun until beam end. We take 160 damage. That's not terrible vs taking 280.

Hmm interesting: guard vs beam costs 160 HP but blocks the knockdown and stun. If our HP is low, taking 280 might be fatal. Let's use guard when hp < 400 (avoid a potentially fatal hit)? Actually at hp<300 we're in rage mode. If hp is low, blocking 160 is safer than 280. Let's add: if me.hp < 350 → prefer guard over beam answer. Meh, keep beam answer (it kills them).

Let's just implement and move on. Time to write.

Also: their beam could be aimed at us while we're at dist < 110 → heavy interrupt ✓ (150 dmg).

Final code writing. I'll include a helper for computing the beam answer feasibility.

Also don't forget: our beam's damage vs their startup = 350 (counter) — wow, and knockback 120 + down 50.

Let me write out the final code.

```js
function beamAnswerOk(state) {
  const me = state.me, opp = state.opp;
  if (me.ki < 50) return false;
  if (state.dist < 145) return false;
  const t = opp.t;
  const su = Math.max(RULES.beam.counterStartup, 30 - t);
  const travel = Math.max(0, (state.dist - 70) / RULES.beam.speed);
  return su + travel < 30;
}
```
Note opp.t for a beam in startup: if their su is 12 (answered), opp.t < 12 and their actual fire is at t=12, not 30! Our computation assumes their su=30. If their su=12, they fire at 12 — our su = max(12, 30-t) = 12 (for t<=18) → we fire at 12 too (simultaneous → clash) — and the condition su+travel<30 would wrongly say we hit first. But actually it's a clash (both fire same tick) → clash, not a free hit. Not harmful per se (clash is decent). But the 'heavy interrupt' path would also fail. Meh.

Hmm, can I detect their su? state.opp has 't' and 'left'. For a beam: left = dur - t = (su + fire + recovery) - t. So su = left - fire - recovery + t = left - 40 - 20 + t = left - 60 + t. And 'phase' tells startup/firing/recovery. So su = opp.left + opp.t - 60. Since view's left = dur - t where dur = su+fire+recovery = su+60. So su = left + t - 60. 

Let's use that: su = opp.left + opp.t - 60 (for opp.state 'beam'). Then remaining startup = su - opp.t.

Then our answer's su = max(12, su - opp.t). And they fire at remaining = su - opp.t. We hit them before they fire if ourSu + travel < remaining, and ourSu <= remaining... Actually our beam fires at ourSu (after our decision tick). Their beam fires at remaining ticks. We hit them at ourSu + travel; they hit us at remaining + travel. We win if ourSu + travel < remaining + travel → ourSu < remaining. Since ourSu = max(12, remaining): if remaining >= 12 → ourSu = remaining → simultaneous fire → clash (not a hit-first). Hmm! Wait: start() sets our su = max(counterStartup, o.su - o.t) when the opponent is in startup. But if they're already firing, su = max(12, 0) = 12.

So if they're in startup with remaining >= 12, our su = remaining → simultaneous → clash, not hit-first. I made an error earlier! Let me recheck: `a.su = aimed ? Math.max(R.beam.counterStartup, phase(R,o)==='startup' ? o.su - o.t : 0) : R.beam.startup;`

So if they're in startup: our su = max(12, their remaining). So we fire at the same time or later (12 vs remaining if remaining <12 → we fire 12 later → they fire first → we get hit).

So answering a startup beam = simultaneous clash (if remaining >= 12) or we get hit first (if remaining < 12). So the "hit them first" scenario I imagined doesn't exist! Unless remaining < 12 → they're about to fire, we fire 12 later → they hit us first (unless we dodge).

Therefore: beam answer = clash (when remaining >= 12). Clash is decent but not a free 350.

Hmm OK. So beam answer's value = clash chance. Let's evaluate clash: both beams fire simultaneously at the same tick, clash point at the midpoint of the fronts = midpoint of the fighters. Then it's a push war. We win if our power > theirs (ki-based). We started the beam with 50 ki → our ki after = maybe 30 (if we had 80) → power 1.6 vs theirs (they also spent 50) → similar. Clash decided by small differences + noise. Expected outcome ~50/50, and the loser takes 320 damage + down 60. Winner's reward: 320 damage. So clash is roughly symmetric but high variance: expected damage difference ~0 (we take 320 with 50% probability, they take 320 with 50%). But the clash takes ~100-250 ticks (a lot of time). During the clash, neither does anything else. And a 360-tick timeout → both take 120.

Alternatively: don't answer; guard (take 160 chip, block the beam, no knockdown) — 160 damage but we survive and keep our 50 ki, and we can counterattack after the beam ends (their recovery 20).

Hmm: guard vs beam: pay 15 ki, take 160 chip, and we're stunned "一直硬直到大招结束" → stun duration ctx.stun = a.su + fire - a.t + 6 → the rest of their beam firing + 6. So we're locked ~40 ticks. Then they're in recovery 20 ticks.

Compare clash: 50/50 of taking 320 + down 60 (60 ticks) vs taking nothing.

Roughly: clash EV ~ neutral in HP but consumes ki (both sides lose 50) and time. Guard loses 160 for sure. Clash is better EV (0 expected loss vs 160). But clash requires ki>=50 which is a big investment, and the loser is downed 60 ticks (giving the winner tempo).

Also in clash we can push to win it: our power vs theirs. Since both spent 50 ki, remaining ki decides. So the one with more ki wins. If we have 50 and they have 50 → equal → coin flip (with noise). We can also use push if we have extra ki.

Hmm, so beam answering is a gamble with ~0 EV in HP but a big tempo swing either way. I'll keep it as a valid option but prefer other things when possible. Actually, since we lose 50 ki in the clash regardless, and the clash outcome is ~coin flip, the EV is ~0 damage but we lose our beam investment in a "wasted" way. Meanwhile guarding costs 15 ki and 160 HP.

Alternatively dodge: dash behind (if dist<=140 and room) → free dodge, no damage! That's the best if feasible. Prioritize dash_behind FIRST for beam threats (both startup and firing), then light/heavy interrupt, then answer.

Wait but dash behind during their startup: they might be interrupted by... no, they fire at 30 and their ray goes the other way → we dodged completely ✓ free. And we keep our 50 ki. 

So order for beam threat:
1. dash_behind (if ki>=16 && dashBehindOk) → free dodge.
2. heavy interrupt (if dist<=138 && their remaining startup >= ~10 so our heavy lands first): their heavy startup 9 → we need remaining > 9ish → remaining >= 11. Our heavy lands at t+9..12. If remaining = 12 → borderline. Use remaining >= 14 for safety. Also heavy is +150 damage.
   But careful: our heavy startup 9 → they might interrupt our heavy? They're in beam startup, they can't act. ✓.
3. light interrupt (if dist<=108 && remaining >= 7): 50 damage.
4. beam answer (clash) if ki>=50.
5. guard (take 160 chip).

Also the "remaining" for a beam in startup = su - t; we can compute su = opp.left + opp.t - 60 → remaining = opp.left - 60. Since left = dur - t = su+60-t → left - 60 = su - t = remaining ✓. Nice: remaining = opp.left - 60 (for startup). For firing, left = dur - t = su + fire + recovery - t; remaining firing = su + fire - t = left - 20 (recovery). So during firing, we have left-20 ticks of beam left.

Let me use opp.left directly.

Let me define: if opp.phase==='startup': remStartup = opp.left - 60. If firing: remFire = opp.left - 20.

Heavy interrupt: our heavy lands at ~9-12 ticks from now (startup 9 + active). Need remStartup >= 13.
Light interrupt: lands at ~5-7 → need remStartup >= 8.

Good.

Now let's finalize everything into code.

Also dash_behind during their startup: our dash takes 10 ticks moving; their beam fires at remStartup ticks. If remStartup < 10, our dash is still in progress (invuln 8 ticks) → after 8 ticks invuln ends and we're still moving (2 ticks) at position ~ behind? We move 200/10 = 20 per tick; after 8 ticks we're 160 forward → past them (if dist<=140) → we're behind them already → their ray (fired later from their position) doesn't cover us ✓. But if their beam fires at tick 5 while we're mid-dash at 100 forward (dist 40 → still in front) → we're invulnerable at tick 5 (invuln 8) ✓ and the beam passes through us (invuln) and continues; then we end up behind them → safe ✓. But the rule says "无敌结束时如果还在光束里，照样挨打" — if we're behind them at invuln end, we're not in the ray ✓.

But if the dash fails to pass through (no room behind), we'd be stuck in front → hit. Our dashBehindOk checks room ✓.

Also careful: dash through happens only if dist <= 140 (after <= -60). If dist is 150-200, dashEnd stops us in front (dist 60) → bad for dodging (but at dist 60 the beam ray covers us → we take it). Hmm, but at dist 150-200 we could interrupt with heavy (reach 140 — no, 150>140). So at dist 150-200 vs beam: options: beam answer (clash) or guard (160). OK.

Alright, writing the final code now. Also: guard against the beam requires ki >= 15, else the guard breaks (chip 160 + crushed 34) — same damage anyway.

Let me write the code.

I'll now write out everything cleanly.

```js
/* AI 武道会 · 第1季 —— 选手程序 */

let _prevOpp = null;

/* ---------- 小工具 ---------- */
function oppRemainingStartup(state) {
  // 对手（若为 beam）起手还剩多少 tick
  const o = state.opp;
  return o.left - 60;
}

function dashBehindOk(state) {
  const R = RULES, o = state.opp, d = state.dist;
  if (d > 142) return false;
  const room = o.facing > 0 ? o.x - R.stage.left : R.stage.right - o.x;
  const need = Math.max(R.minGap, R.dash.dist - d) + 10;
  return room >= need;
}
```
Careful: 'room' for behind: the opponent faces us (facing toward us). Behind them = the side they're facing away from. If opp.facing > 0 (facing right), their back is to the left → room behind = opp.x - stage.left. ✓ (as written).

OK writing final.

Also, for the 'idle' fallback in cancelChoice when nothing works: 'idle' is valid and means we keep the current state (recovery) — fine.

Let me write the final answer.

Additional: I'd like a slight randomness? No, deterministic is better.

Final code below.

Let me double check one thing in step 5 (close range): if opp is 'guard' → heavy (crush 60 chip + 34 stun). But heavy vs guard: the crush happens with `hurt(m, a, o, M.crushDamage, 'crush')` = 60 damage and stun crushed 34. Our heavy's damage doesn't apply otherwise. 60 damage per heavy, and our heavy recovery 22 ticks. Also they get pushed? No push on crush. Fine.

Also, the heavy crushes their guard, then they're stunned 34 → we can then light chain. ✓ Nice combo: heavy (60) → they crushed 34 → we walk/approach → light chain 164. 

But after our heavy, our recovery is 22 ticks; their crushed left = 34-22 = 12 when we're free → light chain would land at +5 → hit at stun tick 12 ✓ (they're crushed until 12). OK.

Good. Write it.

One more consideration: the `charge` action when ki<50 and the opponent is far: charging also means we're standing still. If the opponent approaches during our charge, we take ×1.5 damage. Our condition requires closing < 2 (they're not approaching). But they might start approaching right after. Acceptable.

Let me write the final code and the declaration.

Also: the file's top-level code executes once per match; `let _prevOpp = null;` ✓.

Final answer code:

I'll now carefully compose.