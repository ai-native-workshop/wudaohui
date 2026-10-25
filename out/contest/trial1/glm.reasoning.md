Let me think carefully about designing a strong bot for this fighting game.

Key mechanics:
- Light punch: fast (5 startup, 3 active, 9 recovery = 17 total), reach 110, 40 dmg, 15 hitstun, cancels on hit allow chaining up to 4 lights then heavy/blast/beam.
- Heavy: 9 startup, 4 active, 22 recovery (35 total), reach 140, 120 dmg, knockdown 42.
- Blast: 20 ki, 11 startup, 18 recovery, projectile speed 13, 70 dmg.
- Beam: 50 ki, 30 startup, 40 fire, 20 recovery, 280 dmg, knockdown.
- Dash: 10 ki, 200 dist over 10 ticks, invuln 9 ticks, 8 recovery.
- Guard: blocks light, blast (12 chip), beam (120 chip). Heavy crushes guard: 60 dmg + 34 stun.
- Charge: +0.32 ki/tick, taking damage ×1.5.

Combos: light hit → cancel into light (up to 4), then heavy or blast. Damage scaling: 1, 0.8, 0.65, 0.55, 0.45, 0.4.

Light chain: 4 lights (40+32+26+22=120) + heavy (120×0.45=54)... wait scaling index. Combo counter: first hit taken scales combo[0]=1. So light1=40, light2=32, light3=26, light4=22, heavy=120×0.55=66. Total ~186. Or lights then beam: 280×0.55=154. Hmm.

Actually, optimal combo: light ×4 then beam if ki ≥ 50: 40+32+26+22+154 = 274. Or heavy after 4 lights: 120×0.55=66, total 186, plus knockdown.

Alternatively fewer lights then heavy: light(40)+light(32)+heavy(120×0.65=78) = 150, with knockdown. 4 lights + heavy = 186 + knockdown.

Strategy considerations:

Punishing: if opponent is in recovery/startup of a move (counter ×1.25), or charging (×1.5).

Anti-air... no, 1D.

Key interactions:
- Opponent blasting: can guard (12 chip + 2 ki for me... wait, blocked gives ki to the blocker, +2). Or dash through it (invuln 9 ticks, blast passes). Or jump? No jump. Dash forward through blast and punish blast recovery (counter ×1.25 on blast recovery = 87.5 dmg!).
- Opponent beam startup (30 ticks): dash forward through? Beam fires at t=30. If I dash forward during their startup, I might pass through. Beam hits during firing only. During startup, if I'm close, I can hit them to interrupt (beam doesn't get interrupted by... wait "发射期间你被打中，大招就断了" — being hit during startup cancels it? "大招起手 30 tick（这段时间挨打就会被打断，耗掉的气不退）". Yes, hitting them during startup interrupts, ki not refunded. So if opponent starts beam at distance, rush in and hit them.
- Beam firing: dash (invuln first 9 ticks of 10 moving ticks) can dodge through? Beam covers from shooter to front. "瞬移无敌的时候碰到不算，但无敌结束时如果还在光束里，照样挨打" — dash_forward through the beam: you end up behind the shooter where beam doesn't cover (beam goes forward from shooter). Beam covers from shooter's front to front of ray. If I dash behind them, I'm safe. Dash moves 200 over 10 ticks, invuln 9 ticks. During invuln I pass through the beam. At tick 9-10, I land behind them (if room). The beam doesn't cover behind the shooter. So dash_forward through a beam is a full dodge + punish their firing/recovery.

Wait, but beam ray: `from: a.x + a.facing * 25`. If I'm behind them, my x has (o.x - x)*facing < 0, so not in ray. Good.

So beam is actually quite punishable: 30 startup is long. If opponent beams at distance > ~150, I can walk in and hit them during startup? Walk forward 4.5/tick × ~20 ticks = 90. Or dash forward.

If opponent beams and I'm at range, I could also dash_back to avoid? Beam extends 30/tick for 40 ticks = 1200 range, covers whole stage. Dash back 200 doesn't escape... but invuln first 9 ticks; after dash ends at tick 10, if beam still covers my position, I get hit. Dash back doesn't help unless beam front passes me during invuln. Hmm, dash_back 200, beam front at 30/tick — beam front moves faster. If I dash back while beam approaches, front might catch me after invuln. Better: dash forward through the shooter, or guard (120 chip).

Guard vs beam: 120 chip + hard blockstun "一直硬直到大招结束" (blockstun until beam ends). Blocking beam gives +2 ki only once. 120 damage for free chip vs 280 full. Guard is fine if can't punish.

Beam clash: power = 1 + 0.02×ki (+0.6 push, +0.4 rage). Both firing = clash. Clash winner deals 320 + knockdown. Push costs 0.6 ki/tick extra. Since drain is 0.2/tick and power scales with ki, pushing is good if ki high.

Actually, interesting: clash can be a huge swing (320 dmg). If I have high ki and opponent low, winning clash is massive. 

Blast strategy: blast at range, opponent guards (12 chip) or dashes through or eats 70. Blast spam builds pressure. But "one blast at a time on screen".

Charge strategy: risky (×1.5 damage taken).

Let me think about what opponents might do. Simple bots: approach and light/heavy, guard when blast incoming, etc.

My bot design:

Core decision function with priority:

1. If state.clash: decide push. Push when my power advantage / ki high? Let's compute: pushing costs 0.6 ki/tick extra, giving +0.6 power → but 0.6 ki = 0.012 power from ki... wait kiPower 0.02/ki, so 0.6 ki/tick costs 0.012 power/tick, gaining 0.6 immediate. Definitely push early. But ki drains 0.2/tick (clash max 360 ticks; typically decided in far fewer). With ki 100, power = 3. Pushing: ki drains 0.8/tick, lasts 125 ticks. Power while ki>0: 1.6 + 0.6 = 2.2... wait 1 + 0.02×100 = 3, +0.6 = 3.6. Push almost always good. But if ki low (<20?), power 1.4 vs empty 0.5. Hmm: if ki is small, e.g. ki=5: power = 1.1+0.6=1.7 while pushing, drains to 0 quickly then 0.5. If opponent has ki 50: 2.0. I'd lose anyway. 

Push decision: push if myPower + 0.6 > oppPower (roughly), i.e., if ki diff < 30. Also rage. Actually pushing also accelerates ki depletion which reduces power over time. Let me just push if my ki > opp ki - 25 or so, or if I'm already winning. Simpler: push if myPower(assuming push) >= oppPower - 0.1. Also consider: if losing badly, don't push (save ki? no, clash is all-in anyway). Actually if I'm much weaker, pushing still increases my chance slightly at ki cost... When weaker, maybe not pushing preserves ki so power stays higher longer? Power = 1+0.02 ki. Push drains 0.6 extra ki/tick → power drops 0.012/tick extra while giving 0.6. Even near the end, pushing is better short-term. Clash usually resolves quickly. I'll push when myPower-with-push > oppPower, else not push (if hopeless, the 0.6 still helps — the noise is sd 0.8 per tick accumulating with 0.95 decay, so variance is large; push increases win chance regardless). Actually always push? If both push, equal. Cost of pushing: 0.6 ki/tick → if clash lasts long, ki empties → power 0.5. If I don't push and opponent does, opponent wins clash point → I take 320. So push unless my ki is very low and theirs high (then I'm lost either way; maybe not pushing prolongs to maxTicks 360 → draw 120 each + knockdown. Hmm, at maxTicks both take 120 and knocked down. If I'm much weaker, dragging to draw (120 each) beats losing (320). So: if hopeless (myPower+0.6 < oppPower by a lot), don't push to try to survive to time-out draw. But the clash point drifts toward the weaker side each tick by (diff × 0.1) plus noise sd 0.8/tick. With decay 0.95, speed variance accumulates. If diff is 1.0, drift 0.1/tick against me; noise sd 0.8/tick accumulating → std of position after n ticks ~ 0.8×sqrt(n×(1/(1-0.95²)))... position noise is a random walk with decay. Survival 360 ticks with drift -0.1/tick: mean drift -36 positions... but position clamps at 0..? Clash pos normalized to distance between fighters (at least 60, typically more). Drift pushes toward me continuously. Without pushing, I lose almost surely if weaker. Pushing reduces the deficit by 0.6. When hopeless, still push? If my power with push still less than theirs, pushing only wastes ki faster. But it reduces the drift rate, prolonging... but prolonging means more ki drain too. Honestly: push if (myPower + 0.6) >= oppPower, else if oppPower - myPower > 0.5, don't push (hopeless, drag to draw), else push anyway (noise might save).

Hmm wait — actually there's a subtlety: power uses current ki which updates each tick. And decideEvery 6 in clash. Let me keep it simple:

push if myPower + 0.6 > oppPower + 0.05, i.e., I'd be stronger while pushing. Note state gives myPower (without push) and oppPower (with their current push flag). Compute prospective.

Also rage: hp < 30% adds 0.4 — included in given powers already.

2. canCancel (after light hit): combo continuation. Options: light (if chain<4 and distance ≤110 — pushApart moves them 14 away, so after a light, distance increases by 14. If initial distance ~60-96, after hit dist+14 ≤ 110 still in range. Light reach 110, opponent in hitstun 15 ticks, my cancel comes next tick, new light startup 5 + active 3... new light active at tick 5-7 relative; opponent hitstun 15 ticks. But wait — do I need to walk forward between lights? Light total duration 17, but cancel means new light starts immediately. After cancel light at dist d+14: reach 110. If d+14 > 110, the light whiffs. Push is 14 per light hit. So if I start light at dist ≤ 96, I can chain. Also blocked light pushes them too but no cancel.

Combo damage: L1=40, L2=32, L3=26, L4=22 (at combo counts 0,1,2,3). Then heavy: combo count 4 → ×0.45 → 54. Or blast: 70×0.45=31.5→ but blast needs distance... blast spawns 40 ahead, flies, hits at any distance — but opponent in hitstun 15 from light 4; blast startup 11, so blast hits during hitstun. 31 dmg + 20 hitstun. Or beam: 280×0.45=126! Beam needs 50 ki. Beam startup 30 — opponent hitstun only 15, then they're free and can guard (chip 120) or dodge. Beam after combo is bad unless they can't react... They become free, can guard → 120 chip. Meh.

Better: 3 lights then heavy: L1 40, L2 32, L3 26, heavy at combo 3 → ×0.55 → 66. Total 164, knockdown. Or 4 lights + heavy: 40+32+26+22+54 = 174 + knockdown. 4 lights + blast: 40+32+26+22+31 = 151. 2 lights + heavy: 40+32+78=150. So 4L+H = 174 best. With counter multiplier: if they're in startup/recovery when first light hits ×1.25.

Hmm, what about light ×4 then beam if they have low hp? Overkill considerations.

Also: heavy alone 120. Light-light-heavy: 150. 4 lights + heavy 174.

What about dash combos? Dash costs ki.

Cancel decision: if chain < 4 and dist ≤ 96 (so next light connects: after push 14, ≤110): do light. At chain 4: heavy if dist ≤ 140-14=126... heavy reach 140, active at startup 9 — during opponent hitstun 15 ticks, they can't move. dist after 4th light = d0+56. Hmm, after each light hit pushApart 14. Starting at 60: 60→74→88→102→116. 5th hit heavy reach 140: fine. If they're near wall, attacker gets pushed instead — dist decreases actually (attacker pushed back means dist shrinks? "against the wall the attacker slides back" — attacker pushed away from opponent, increasing distance. Wait no: o is pushed away from a; if o can't move (wall), a slides back — a moves away from o, so distance increases by the same amount). Either way dist +14.

So combo logic: while chain<4 → light (check reach: dist + 14 ≤ 110 → dist ≤ 96... actually the push happens at hit; the next light's active window is ticks 5-8 from cancel; opponent is pushed 14 at the moment of previous hit. So need dist (post-push) ≤ 110. state.dist at cancel time already includes push (push happens same tick as hit; cancel call next tick). So at cancel, dist already includes push. Need dist ≤ 110 for next light... but reach check is at active ticks 5-7, opponent in hitstun (can't move) for 15 ticks, so position fixed. dist ≤ 110 → light connects. Hmm, but strictly: light reach check `d <= R[a.state].reach` where d = (o.x - a.x)*a.facing. At cancel time dist is post-push. So condition: dist ≤ 110.

At chain 4 (4 lights done): cancel into heavy if dist ≤ 140 (they're frozen in hitstun 15 ticks, heavy active at tick 9-12, hitstun lasts 15, ok they stay). But wait: after 4th light, hitstun 15 ticks; heavy startup 9, active at 9 — within 15. Good. Heavy damage ×0.45 = 54. Total ~174.

Alternatively cancel into beam? They're free after 15 ticks, beam starts firing at 30 — they'd guard or punish me. Bad.

What if ki high and hp advantage — could finish with blast: 70×0.45=31 < heavy 54. Heavy always better in combo.

Edge: if opponent hp low, heavy finishes.

What if dist > 110 at cancel (they got pushed to range)? Then heavy if dist ≤140, else blast if no blast out and ki ≥ 20 (70×0.45=31) — blast will hit them in hitstun before they can guard? Blast startup 11 < 15 hitstun, blast spawns at +40, travels 13/tick, needs to cover dist-40ish... they're at dist ≤ ~140ish. Blast travel time ~ (dist-40)/13 ≈ 8 ticks after spawn at t=11 → hit at ~19 ticks, but hitstun ends at 15. They could guard. Chip 12. Meh. If dist > 110 at cancel, heavy if ≤ 140, else just let recovery finish (or blast anyway for chip?). Eh, if they're going to be free, a blast might get guarded (12 chip) or hit if they idle. Fine, minor.

3. Free movement/neutral game:

Priorities:
a. If incoming blast and can't punish: guard or dash through. Guard: 12 chip, +2 ki, blockstun 14. Dash forward through blast: invuln 9 ticks; blast passes; land near/behind opponent and punish (counter). If blast eta is small and dist large, dash_forward: blast at 13/tick, dash 20/tick. If I dash forward when blast is close (eta ≤ 3), blast passes through me during invuln, and I close 200 → punish their recovery (blast recovery 18 after spawn). Blast total: startup 11 + recovery 18 = 29 ticks. If they fired at t0, blast spawns t0+11, recovery ends t0+29. If I dash at eta 2: I arrive 10 ticks later; they're at t0+11+2+10 = t0+23 < 29 → in recovery → punish with light (40×1.25=50) → cancel combo! Nice.

But careful: dash through blast — blast passes through me (invuln), continues, flies off. If I land behind them, they turn (if free)... they're in blast recovery, not free. So punish guaranteed.

Guard is simpler and safe. Dash-through is better EV if reliable. Condition: incoming blast, eta ≤ 8 (invuln covers), dist ≥ ~120 (want to land in punish range... dash lands 200 closer or behind). Let's dash when eta in [2,7] and ki ≥ 10. Risk: if eta mis-estimated... eta computed by engine, reliable. Blast speed 13, dash 20. If I dash forward at eta=2: during tick 1-9 invuln. Blast reaches me at eta 2 → within invuln. Good. eta 0-9 all fine actually (eta ≤ 9 means blast hits me within 9 ticks of invuln window... eta is ticks until contact; if eta ≤ 8, contact during invuln (invuln ticks 0-8, t<9). Need eta ≤ 8 at dash start. Also after invuln (tick 9-10) I'm moving to landing — blast already passed.

Actually wait — if eta ≤ 8, but what if the blast is very close, eta=0? It hits next tick... invuln starts when dash starts. Dash state begins at tick after decision. Hmm, decide is called, action starts, tick advances: a.t increments. If eta=0, blast is at my body boundary now... The blast hits check: `Math.abs(o.x - b.x) > R.body && (o.x-b.px)*(o.x-b.x) > 0 continue` — hits when |o.x - b.x| ≤ 30. eta = ceil((gap-30)/13). eta=0 means already within 30+13... eta = max(0, ceil((gap-body)/speed)). If gap ≤ 30, eta 0, blast hits this tick — dashing won't help (invuln applies from when state becomes dash... my decide happens, choose sets state='dash', then move/steps... invuln checked in blasts() after move. If I dash this tick, a.t=0 < 9 → invuln → dodge! Actually the same tick I decide, state becomes dash with t=0, then move() runs (dash moves), then blasts() checks invuln(dash, t<9) → true → dodged. So even eta=0 works! Great — dash forward on incoming blast always dodges if ki ≥ 10 and eta ≤ 8.

But what if blast eta > 8 (far away)? I could just guard now and decide later, or dash later. Wait for eta ≤ 8. Meanwhile walk forward or charge? If blast incoming, charging is risky only if opponent can hit me. Charging while blast approaches: blast hits ×1.5 = 105. Don't charge when blast incoming. Just guard early (guard blocks). Simplest: guard when eta ≤ 8-ish, else approach/charge.

Hmm, but guarding gives opponent room. Dash-through punish is strong. Let me do: if incoming blast: if ki ≥ 10 and eta ≤ 8 and dist ≥ 100 (so dash lands in range for punish; dash 200 → dist' = max(60, dist-200) or behind them): dash_forward. Else guard (when eta ≤ 10). If eta > 10, do neutral stuff (charge? walk?). Careful: if I charge at eta 11, I'm charging; next ask is 6 ticks later at eta 5 → can switch to guard in time (guard anytime, held state). Held states switchable every 6 ticks. eta 5 > 0, fine. Guard becomes active immediately? state='guard' set at choose. Blast hits that same... yes blocks.

Actually danger: decide cadence — I'm asked at most every 6 ticks. If eta goes from 12 to 6 between asks, and I chose charge at eta 12, at eta 6 I decide again → guard. OK safe if I guard by eta ≤ 8... Let me guard when eta ≤ 9 to be safe? If last decision at eta 10 (charge), next ask at eta 4 → guard then, safe. Worst case: decision at eta 9 (I said charge), next decision eta 3 → guard. Blast hits at eta 0 → guarded. OK: rule: if incoming && eta ≤ 9 → guard (or dash if conditions). Since eta ≤ 9 triggers guard at next ask which could be eta 9→3, guard applies from that tick. Fine.

But wait — there's a subtlety: if I'm charging and blast comes, at eta 3 I switch to guard — fine. If I'm mid-move (light recovery etc.) I can't act — that's the risk of throwing moves at range.

b. Opponent beam handling:
- If opp.state === 'beam' && phase startup: they're interruptible for `left` ticks of startup. Can I reach? If dist ≤ 110, light now: light active at tick 5 — interrupts if their startup still ongoing (need their startup left > 5). Their beam startup total 30; if phase startup with t, left = 30 - t. If dist ≤ 110 and their startup remaining ≥ 6 → light hits, interrupt, they lose 50 ki, take 40, I get cancel combo → big punish. If dist ≤ 140, heavy: active at 9-12; need their remaining ≥ 9... and heavy deals 120 ×1.25 = 150 + knockdown. 
- If I can't reach: dash_forward! Dash 200 over 10 ticks + 8 recovery... but dash only helps if I arrive while they're still in startup — but dash recovery 8 ticks means I can't act until tick 18 after deciding. Beam startup 30. If dist ≤ 200-ish: dash lands me at dist-200 (or behind), then 8 recovery, then free — arrives tick 18, their startup remaining = 30 - 18 = 12 at decision time means... Let me compute: at decision tick T, opp beam t = s (elapsed startup). Their startup ends at T + (30 - s). I dash: invuln/moving T+1..T+10, recovery T+11..T+18, free at T+19... wait free() when a.t >= dur: dur = 18, so free at T+18ish. Then light: active T+23..T+26. Beam fires at T+30-s... hits me if s < 7? No wait: I need to interrupt before firing: T + 30 - s > T + 26 → s < 4. And they'd fire the beam at their end — if they fire, beam covers me... but I dashed behind them? dash_forward through them lands behind — beam fires forward, I'm behind! Then I punish their firing/recovery from behind (beam recovery 20 after fire... beam can't turn). They fire for 40 ticks + 20 recovery = 60 ticks of being stuck facing forward while I'm behind. Light them (no guard possible — they face away... guard covers front; can they even guard? They're in beam state, stuck). I get full combo: light ×4 + heavy from behind = 174 ×... counters ×1.25 on first? They're in beam (a move) startup/recovery → counter mult. 

So dash-through-beam: if opp in beam startup and dist such that I can land behind them (need room behind them; wallAhead... wall behind them). If they're near their back-wall, dash stops in front — then beam fires at me → I eat 280. Risky. Check: dashEnd lands behind only if room. From my view: I know positions; behind-position = opp.x + facing_dir × 60 where facing_dir = direction from me to opp. If that's within [40,960]... From my state I can compute: opponent's x, my facing f (toward opp). Behind them = opp.x + f×60. Need opp.x + f*60 in [40, 960] and also `after <= -minGap` — my landing x = clamp(x0 + f*200). Condition in engine: x = me.x + d*200 (d = facing); before = (opp.x - me.x)*d > 0; after = (opp.x - x)*d < 60 → triggers pass-through logic; behind = opp.x + d*max(60, -after); pass if after ≤ -60 && behind in range. x = me.x + f*200. after = (opp.x - x)*f = (opp.x - me.x - 200f)*f = dist - 200. If dist - 200 ≤ -60 i.e. dist ≤ 140... hmm wait if dist > 200, x doesn't reach them, no pass-through, I just land 200 closer. If dist ≤ 140: x = me.x + 200f is past them by (200 - dist) ≥ 60 → land behind at opp.x + f*60 if that's on stage.

So: if opp beaming (startup) and dist ≤ 140 and opp.x + f*60 within [40,960] → dash_forward → land behind → free combo. If dist > 140: dash brings me 200 closer (dist-200 could be < 60 → stop in front at 60). Then beam might fire at me while I'm in dash recovery... dash ends (moving) at tick 10, invuln only 9. If beam fires at tick < 10 while I'm still in front → after invuln ends I'm in recovery → beam hits me. Dangerous. Only dash if I land behind or their startup ends before... complex.

Alternative vs beam: guard (120 chip). Or dash_back (200 away — beam still catches: beam front 30/tick vs my dash 20/tick over 10 ticks... beam covers 1200. Only invuln 9 ticks. If beam front reaches me after tick 9, I'm hit. Dash back at beam firing start: beam front starts at their x+40ish, front moves 30/tick, I move 20/tick. Gap closes at 10/tick. If initial gap g, front reaches me at g/10... vs my invuln ends tick 9 → covered distance 90. If g > 90 at firing, I get hit after invuln. Hmm, unless beam ends (40 fire ticks = 1200 range covers everything). So dash_back doesn't escape beams. Guard is the safe answer: 120 chip.

Better: don't let them get beam. If opp free with ki ≥ 50 at range, they might beam. Keep pressure. Or stay close so their beam startup gets punished.

Actually — preemptive: if opp is charging (free state, ki ≥ 50 accumulating), rush them: charging means ×1.5 damage. Walk forward + light when in range.

c. Neutral offense: 
- Preferred range: light range (~90-110) to threaten lights and react.
- Approach: walk forward when far. When dist ≤ 110, throw lights? Light is 17 total, -9 on block (blockstun 11 vs my recovery... they're stunned 11, I'm in recovery 9 after active — active ends tick 8, recovery till 17; they're free at 11 — they have 6+ ticks to punish me. Light blocked is punishable-ish: they're pushed 14 away though (out of their light range maybe).
- Light on hit → combo → 174. Light on block → I'm at -6ish, spacing +14. Heavy: if they guard, crush 60 + 34 stun → free hit! Heavy on block is GREAT for me: 60 dmg + 34 tick stun. Then I'm in recovery 22... crush stun 34 > my recovery 22 → I recover first with 12 ticks to spare → free punish! They're stunned (crushed) 34 ticks; my heavy total 35 (9+4+22). Blocked at active tick ~9-12 → I finish at 35, they're stunned until block_tick + 34 ≈ 9+34=43 vs my 35 → 8 ticks spare → walk in (they got pushed? crush: no pushApart for heavy crush — engine: heavy on guard → hurt 60, stun crushed 34, no push. So dist unchanged ≤ 140) → light (startup 5, need ≤ 6 ticks... 8 spare: walk 0 needed, light active at 5-8 — hmm 8 spare means at tick 35 I decide, light starts 36, active 41-43, their stun ends 43. Cutting close but light active 3 ticks (41,42,43) — hits at 41 or 42 if stun till 43... stun duration: stun sets dur=34 from hit tick. Hit at ~tick 9-12 of my heavy (active). Say blocked at tick 10: they're crushed until tick 44. I'm free at 35, decide at 36, light active 41-43 < 44. Hit! 40×1.25 (crushed is not startup/recovery of a move... 'crushed' state — mult: MOVES.has('crushed')? No, MOVES = light, heavy, blast, beam, dash. So ×1... but combo counter: they just took crush damage — does crush count in combo? hurt() is called but combo++ not (combo++ only in the non-block branch). Crush: `hurt(m, a, o, M.crushDamage, 'crush'); stun(o,'crushed',...)` — no o.combo++. So light after crush: 40 fresh, then cancel combo → L1 40, L2 32, L3 26, L4 22, H 54 = 174 more! Plus 60 crush = 234 total from one blocked heavy. Wow, heavy is strong vs guard-happy bots.

And heavy on hit: 120 ×1.25 counter / ×1.5 charge / ×1 base + knockdown 42 + knockback 150. 

Heavy whiff: 35 ticks of recovery-ish → very punishable (opponent light ×1.25).

So heavy is a big commitment. Opponent can: back away (back 3/tick — during my 9 startup, they move 27 away; if dist was 140, now 167 > 140... but reach checked during active ticks 9-12, they move 27-36 → if dist > 140+36=176 at my startup, whiff), or dash_back (200 away, whiff), or interrupt with light (light active at 5 — if in their range ≤110, they hit me first, ×1.25 = 50 + combo).

So heavy when opponent is: in recovery (blast recovery 18, beam recovery, light recovery 9, heavy recovery 22), in hitstun, charging, or just outside their light range but within heavy reach (111-140)? If dist in (110, 140], they can't light me; they could back off (3/tick × 9 = 27 → dist 167 > 140 whiff if they react at my startup start... they decide at most every 6 ticks — reaction delay. If they're walking forward, they eat it.

Punish windows:
- Opp light whiffed/recovery: after their active (17 total), recovery 9 ticks. If they whiffed (out of range), I can... I see their state light + phase recovery + left. If dist ≤ 110 and their recovery left ≥ 5: light them (counter 50 + combo ~174+). If dist ≤ 140: heavy (150 + knockdown!).
- Opp heavy recovery: 22 ticks, big punish.
- Opp blast recovery: 18 ticks.
- Opp dash recovery: 8 ticks.
- Opp crushed: light combo.
- Opp charge: rush + heavy? If they charge at dist 140: heavy active 9-12, they might stop charging (next ask ≤ 6 ticks) and back off 27... dist 167 whiff. Light if ≤ 110: they could stop and guard? If they guard, my light blocked — fine. Charge ×1.5 heavy = 180! If they don't react. Meh, depends.

Let me structure the bot:

```
function decide(s) {
  if (s.clash) return clashDecide(s);
  if (s.me.canCancel) return comboDecide(s);
  if (!s.me.free) return 'idle'; // shouldn't happen
  // threat response
  // punish windows
  // approach / spacing
}
```

Threat response details:

Incoming blast (blasts array, incoming true, eta):
- If opp in blast recovery (i.e., they just fired it) and I can dash through and punish: conditions: ki ≥ 10, eta ≤ 8, dist after dash lands within punish range. Dash forward 200: if dist ≥ 200 → land at dist-200 (too far?). If dist in [100, 200]: land at |dist - 200|... if dist ≤ 140 land behind (dist 60 behind), if 140 < dist < 200 → land in front at 60? Engine: after = dist-200 < -60 only if dist < 140... wait after = dist - 200 (with sign conventions above). Pass-through requires after ≤ -60 → dist ≤ 140. Behind landing: opp.x + f×60. If 140 < dist < 260: x = me.x + 200f, after = dist - 200 ∈ (-60, 60]... condition `after < R.minGap` (60) true when dist < 260 → then behind = opp.x + f*max(60, 200-dist) = opp.x + f*60 (since 200-dist < 60 when dist>140); pass condition after ≤ -60 fails (dist > 140), so next: x = opp.x + f*60 if that's in stage (stop 60 in front). Hmm wait, that branch: `else if (o.x + d*R.minGap >= L && behind <= H && after < 0) x = o.x + d*minGap` — after < 0 means dist < 200. So for 140 < dist < 200: land 60 in front of them (their front). For dist ≥ 260: normal, land at dist-200.

So dash forward through blast lands: dist ≤ 140 → behind them (60 behind, facing wrong way though! "落地后到收招结束前你还面朝原来的方向" — I face original direction, opp if free turns. But they're in blast recovery → can't turn until free; when they recover, they turn. My dash recovery 8 ticks. Their blast recovery: blast fires, they're at blast state total 29 ticks (11+18) from their decision. Timeline: they decided blast at T0, projectile spawns T0+11, recovery ends T0+29. I see eta at time T: eta = ticks till projectile reaches me. If I dash at eta e, projectile passes me (dodged) around now, I land at T+10, recover till T+18. Their position in blast state: they started at T0; projectile spawns T0+11; at time T the projectile has been flying for (T - T0 - 11) ticks... eta relates to distance. If dist ~ 300 at spawn, projectile reaches me at T0+11+ (300-40)/13 ≈ T0+30 — but their recovery ends T0+29. Hmm, so long-range blasts recover before projectile arrives. Then when I dash through and land next to them, they're FREE and can guard my punish or light me.

Let me reconsider: dash-punish works when they're still in blast state when I arrive. Their remaining blast time when I see eta e at distance d: projectile is at distance from them: d_proj = (d - eta*13) behind... projectile spawned at their front (40 ahead). Position of projectile: opp.x + f*(40 + 13k) where k = ticks since spawn. My distance to opp: d. eta = (d - 40 - 13k - 30)/13... roughly. k = (d - 70)/13 - eta. Their blast state remaining: 29 - 11 - k = 18 - k (if k < 18; if k ≥ 18 they're free). They're still in blast state iff k < 18 → (d-70)/13 - eta < 18 → d - 13eta < 304. So if d < ~300 + 13e... For d ≤ 290ish, they're still in recovery when the blast reaches me.

After my dash (10 ticks + 8 recovery = 18 ticks to act again), their remaining: 18 - k - (e + 18) = -k - e < 0. Ugh — by the time I can act, they're free. Wait: I dodge at tick ~e (when blast passes), land T+10, recovery until T+18, decide T+18. Their blast remaining at T+18: 18 - k - 18 = -k ≤ 0. Free. Hmm. So no guaranteed punish on close-range blasts? Unless k small (they fired point blank, blast reaches me fast).

Hmm wait, but I dodge at eta e — the blast passes through me during invuln. Actually if I dash toward the blast, eta shrinks faster (closing 20/tick vs blast 13): blast meets me sooner. If eta = 8 and I dash forward, we meet in ~8*13/(20+13) ≈ 3 ticks. Then I continue, land at T+10, recover T+18. Their k at T was (d-70)/13 - 8. Their recovery ends at k=18, i.e., at time T + (18 - k) = T + 18 - (d-70)/13 + 8 = T + 26 - (d-70)/13. I'm free at T+18. Punish window: 26 - (d-70)/13 - 18 = 8 - (d-70)/13 > 0 → d < 70 + 104 = 174. So for d < ~174, I get free with a small punish window (e.g., d=100: window 8-2.3 ≈ 5.7 ticks — light active at 5 barely; d=140: window 2.6 — can't). Only very close blasts. Meh.

But there's another angle: even if they're free when I land, I've dodged the blast (no chip) and closed distance. They're facing... when they recovered, they were free; if I'm behind them, they turn. It's neutral again but I took 0 damage. Guard costs 12 chip but no ki. Dash costs 10 ki. Guard also gives me +2 ki. Actually blocked blast: I gain 2 ki, lose 12 hp. Dash: lose 10 ki, 0 hp, plus positional advantage. 

Also — what if the opponent is spamming blasts from range? Each blast: 20 ki, I gain 2 from blocking. Chip war: they lose 20 ki per blast, I lose 12 hp. If they blast a lot, they run out of ki and I can then out-ki them for beams/clash... Actually blocking is fine.

Alternatively, counter-blast: my blast vs theirs collide (they cancel). Or beam eats their blast and hits them (beam beats blast!). If they blast from range and I have ≥ 50 ki: beam → my beam swallows their blast, then beam travels to them: they must guard (120 chip) or eat 280. That's a strong counter! Beam startup 30 though — their next blast... they fire blast, I start beam, beam swallows it, hits them. If they're blast-happy, they might fire another blast during my startup — my blast... their second blast: also swallowed once beam is out. During my 30 startup, their blast hits me though! Timing: their blast in flight toward me while I'm in beam startup → I eat 70 ×1.25 = 87. Hmm. Only beam when no blast incoming.

OK let me simplify: this is getting complex. Prioritize robust, solid play:

1. Clash: push logic.
2. Cancel: combo logic (4 lights → heavy; adapt by distance).
3. If not free: return idle (won't be called anyway mostly).
4. Defense:
   - Incoming blast with eta ≤ 9: guard (simple, safe). Dash-through if ki ≥ 30 and dist in [130, 260] and they're still in blast state... let's keep guard as primary; maybe dash when close. Actually, let me reconsider — dashing through is cool but guard is 12 chip and safe. I'll guard. But if eta ≤ 9 and I'm already in a move (not free), nothing I can do — return idle.
   - Opp beam startup: punish if reachable (see below); else guard if beam firing at me... beam firing: if beam out and covers/will cover me → guard (chip 120) unless I can dash behind shooter (invuln dodges beam; landing behind = safe). If opp beam firing and dist ≤ 140 (dash lands behind): dash_forward! Beam passes through me (invuln), I land behind, beam keeps firing forward, I punish during their firing (counter ×1.25 — beam is a move, phase firing... mult: MOVES has beam, phase firing is not startup/recovery → ×1. Not counter. Still free combo ~174 + they're stuck in beam for up to 60 ticks!). Amazing: dash behind beaming opponent → full 4L+H combo (~174) while they can't do anything. This is huge vs beam users.
     Conditions: dist ≤ 140 (to land behind: need dist ≤ 140 and room behind them: opp.x + f*60 ∈ [40, 960]). ki ≥ 10.
   - Opp beam startup: if I can hit them before firing: need light active (5-8) before their startup ends (left ticks). If dist ≤ 110 and opp.left (startup remaining) ≥ 6: light → interrupt (they lose 50 ki, eat 40, hitstun 15 → cancel combo → 174ish total. If dist ≤ 140 and opp left ≥ 9+3=12: heavy (150 + knockdown). Or dash if dist ≤ 140 → land behind at T+10, free T+18; their startup remaining now = left - 18; if left ≥ 19, I'm behind them before firing → full combo. If left < 19... they'd start firing while I dash — beam fires forward, I'm dashing past/behind: during ticks 1-9 invuln — if beam front passes me during invuln I dodge; but "无敌结束时如果还在光束里，照样挨打" — if I've landed behind (dist ≤ 140 → behind), beam doesn't cover behind → safe. If 140 < dist < 200, I land 60 in FRONT — beam fires at me point blank → hit after invuln? Beam spawns at their x+25(front 40), I'm 60 in front → in ray → hit 280 (unless invuln... my invuln ends tick 9, dash recovery till 18 — beam active: if their startup ends between my tick 9-18, I'm in recovery, in ray → hit!). Dangerous. So only dash vs beam startup if dist ≤ 140 (land behind) — wait, even dist ≤ 140: they fire during my dash before I pass? I pass through their body... the beam ray: from their x+25f to front. If I'm between them and front when invuln ends → hit. My dash: ticks 1-10 moving, pass their position around tick when I've covered (dist-?)... I start at dist ≤ 140, need to get past opp.x + f*30 (body edge of ray). I cover 200 in 10 ticks = 20/tick. Distance to clear: dist + 30 ≤ 170 → cleared by tick 8.5. Invuln 9 ticks. Cutting close: if dist ≤ 140, ray starts at their x+25... I need x > opp.x + 25f + 30 (body pad): (dist + 55)/20 = tick when safe. dist=140 → 9.75 ticks > 9 invuln. Risky! If beam fires at tick ~9.75... but beam only fires when their startup ends. If their startup has left ≥ 11 ticks at my dash start, front spawns at tick 11 and moves 30/tick ahead of me; at tick 11 I'm at dist+220... I'm past them (landed behind at tick 10). Wait if their startup left ≥ 11, they fire after I've landed (tick 10 landing). During ticks 1-9 I'm invuln anyway. At tick 10 I land behind → safe. So: dash vs beam startup: require opp beam startup left ≥ 11 AND dist ≤ 140 AND room behind. Then guaranteed safe landing behind before beam fires... at tick 10 I land, their startup left = orig_left - 10 ≥ 1, they fire at tick ≥ 11 — I'm behind, safe. 

   Also if beam FIRING and dist ≤ 140 and I'm not in ray yet? If beam firing and front hasn't reached me: front moves 30/tick. Dash forward → I'd dash INTO the beam... invuln 9 ticks, passing through: need to clear ray before invuln ends. Ray: from opp.x+25f to front (far). I need to get to opp.x + 60f (behind): (dist + 60)/20 ticks ≤ 9 → dist ≤ 120. And front must not pass me before... front is ahead of me somewhere; as I dash forward through the beam: I'm invuln while inside. Beam hits check: invuln → dodge, and at invuln end (tick 9) I'm at 180f... if dist ≤ 120, at tick 9 I'm past their back (dist+180 > opp.x+60 when dist>... me.x + 180f vs opp.x: dist + 180 ≥ 60 always). Land behind at tick 10 if dist ≤ 140. So vs firing beam: dash if dist ≤ 120 (clear by tick 9: (dist+60)/20 ≤ 9 → dist ≤ 120) and room behind → dodge through and punish their firing (they're stuck firing 40 ticks + recovery 20 = up to 60; I'm free at tick 18, they're stuck for ~(fire remaining + 20). Free combo. 

   If dist > 120 vs firing beam: guard immediately (chip 120) — or dash_back? Beam catches eventually. Guard: 120 chip, blockstun till beam ends. Fine.

   Actually also: when opp starts beam startup and I'm far (dist > 140), can I reach? Walk 4.5/tick × left... if left ≥ (dist-110)/4.5 + 6, walk forward then light? I only decide every 6 ticks; beam startup 30 total. If dist ≤ 110 + 4.5×(left-6) → light now-ish... walk then light next decision. Eh: if dist ≤ 240 and their beam left ≥ (dist - 100)/4.5 + 12: forward. Next ask 6 ticks later: dist' = dist - 27; if dist' ≤ 110 → light (startup 5, their left now ≥ 6?) ... Their left at second decision: left - 6; light active at +5..8 → need left - 6 ≥ 6 → left ≥ 12. So condition: dist ≤ 137 and left ≥ 12: forward→light interrupt. If dist ≤ 110 and left ≥ 6: light directly. Between 110-140 with left ≥ 13: heavy? heavy active 9-12 → need left ≥ 12+. heavy deals 150 knockdown. If 137 < dist ≤ 140... rare.
   If dist > 140 and left ≥ (dist - 140)/4.5 + 13 → hmm walking toward a beaming opponent: they're stationary during startup (30 ticks). Walk covers 4.5/tick. To get within 140 for heavy: need (dist-140)/4.5 ticks of walking + heavy 9 startup ≤ left. If satisfied → forward, then heavy next decision... decisions every 6. Let me implement: if opp beam startup: 
     - if dist ≤ 110 && left ≥ 6: light
     - elif dist ≤ 140 && left ≥ 12: heavy
     - elif dist ≤ 140 && left ≥ 11 && ki ≥ 10 && room behind: dash (land behind at tick 10, left-10 ≥ 1 → fire after landing; safe; then full combo... even if left-10 < 11? left ≥ 11 → they fire at tick ≥ 11, I've landed behind at 10. Safe. Punish.)
     - elif dist ≤ 240 && left ≥ (dist-110)/4.5 + 14: forward (approach to interrupt next decision)
     - else guard (brace for beam) — or charge? Beam will hit for 280... guard chip 120. Guard.
   
   Hmm wait, also if opp beam startup and I'm at dist > 140 with low time: just guard. And note: if my ki ≥ 50, I could counter-beam → clash! Clash: power depends on ki. If my ki much higher, I win clash → 320 + knockdown. If my ki ≥ their ki + margin, counter-beam is strong. But careful — their beam starts first, so my beam starts later; clash happens when fronts meet; both beams exist → clash regardless of timing? "两个人的大招迎面撞上" — beams meet when fronts cross; if their beam front already passed... their beam front moves 30/tick; my beam spawns at my x+40. If their front has passed my position before my beam spawns, no clash — I just get hit (my beam startup 30 while their beam hits me during startup → interrupted!). Counter-beam only works if their front hasn't reached me by my tick 30. If dist ≥ 30 + 30*30 ≈ 930 — never. Actually their front reaches me at (dist - 40)/30 ticks after their firing starts; my beam fires 30 ticks after my decision. I decide ~1-2 ticks after their startup begins (I see it in startup at my next ask, up to 6 ticks delay). My beam spawns at my T+30 = their firing start + ~32ish. Their front reaches me at (dist-40)/30 after firing. If (dist-40)/30 > 32 → dist > 1000 — impossible. So counter-beam always gets interrupted?! Their beam hits me during my startup (280 ×1.25 = 350!!). UNLESS I guard... no wait, I'm in beam startup, can't guard. So NEVER counter-beam in response to their beam startup unless their beam will miss?? Their beam covers entire stage eventually (front travels 40 ticks × 30 = 1200). Always hits. So counter-beaming = eating 350. NEVER counter-beam reactively. Clash happens only when both start beams near-simultaneously by coincidence.

   Hmm, wait — but dash: opp beam startup, dist > 140: I could dash forward (200 closer) — but not behind → land in front at 60 → they fire → I'm in dash recovery → hit. Bad. Dash_back? They fire, beam chases; invuln 9, then beam front hits me in recovery (front 30/tick closes). Bad. So vs far beam: guard, eat 120 chip. OR if their left ≥ big, walk forward and interrupt: with decisions every 6, I can chain forwards. Let me include the walk-interrupt for dist ≤ ~250.

5. Punish windows (opp committed moves):
   - opp.state in [light, heavy, blast, beam, dash] recovery phase, or hitstun, blockstun(?), crushed:
     - Actually opp in hitstun: they're stunned `left` ticks. If I'm free and dist ≤ 110 → light (they're in hitstun, not a move → mult 1... but combo counter is theirs; light hits → cancel → combo continue!). Wait, this happens when opponent is in hitstun from my blast or my previous hits. E.g., my blast hit them (70 dmg, hitstun 20): if I'm free and close, light them → new combo chain? Their combo counter continues (combo persists until they become free). So scaling continues from their current combo count. Fine — free damage.
     - opp crushed: 34 tick stun → walk in + light combo (crushed doesn't count as move → no counter bonus but they can't act).
     - opp in recovery of light (9 ticks) / heavy (22) / blast (18) / beam recovery (20) / dash recovery (8):
       - If dist ≤ 110: light (startup 5, active 5-8; their recovery left ≥ 5 → connects) → counter ×1.25 → 50 + cancel combo → total ~200. Check their `left`.
       - elif dist ≤ 140: heavy if their recovery left ≥ 9 (active 9-12) → 150 + knockdown.
       - elif dist ≤ 140 + 4.5×(left-9)... walk? Recovery is short; skip.
       - Also if their recovery left is small (< 5), they'll be free soon — don't whiff. Actually if I light and they recover before my active, they can guard/punish.
   - opp in startup (they committed!): light startup 5 — if I react within their startup... light trades? If both throw lights: both active ~tick 5-8, both hit → trade 40 each. Meh. Heavy startup 9: I can light them (startup 5 < 9) → interrupt 50 + combo. If opp heavy startup and dist ≤ 110 and their left ≥ 6: light beats heavy! If dist in (110,140]: my light can't reach; their heavy reaches 140... dash_back? Or guard → crush (60 + 34 stun but then punish them in recovery!). Interesting: guard their heavy → crush (60, 34 stun) → they're in heavy recovery (35 total, started ~9-12 ago, remaining ~23-26) — crushed 34 > remaining → I punish after my blockstun... wait crushed: I'M crushed (stunned 34). No no — heavy on my guard: I take 60, I'm stunned 34; they're in recovery ~23 left. They recover before me (34 > 23) → they punish me! Ouch. So guarding heavy is bad unless... they recover with 34-23 = 11 ticks to spare → they light me. Hmm, so crush is actually good for the attacker as computed earlier. So vs heavy: don't guard — back off (dist 140 + 3×9=27 → 167 at their active — wait if I back during their startup, active at 9-12, I've moved 27-36, dist ~167+ > 140 whiff) or dash_back (200, safe) or interrupt with light if dist ≤ 110.
   - opp charging: they take ×1.5. If dist ≤ 110: light → 60 dmg + combo. If dist ≤ 140: heavy → 180 + knockdown! Charging opponents get rekt. But careful: they may stop charging and guard — heavy on guard = crush which is good for me anyway. Or stop and back off. If dist ≤ 140 and opp charging → heavy (they either eat 180, or guard → crush 60 + my combo opportunity, or back off 27 → 167 > 140 whiff — risk). Their reaction: next ask within 6 ticks; they see my heavy startup... if they're smart they back off. dist 140 + they move... if they react instantly at my decision+1: 3/tick × 9 = 27 → 167. Whiff → I eat punish. Risky vs smart bots. Alternative: light (≤110): they back 15 → 125 > 110 whiff too. Hmm. Or walk closer first? Let me: if opp charging: forward if dist > 100, light if dist ≤ 100 (they'd need to move 3×5=15 to escape 110... 100+15=115>110, hmm marginal). Whatever — vs charging: if dist ≤ 100: light; elif dist ≤ 130: heavy... let me just say: opp charge && dist ≤ 95: light; opp charge && dist ≤ 135: heavy. Else forward.

   Wait, actually if opponent charges and I'm walking forward, they see me approach and stop charging. The ×1.5 only applies if they're charging when hit. Rushing charging opponents is right; fine.

6. Spacing/neutral:
   - If opp free (neutral): 
     - If dist > 110: forward (approach) — but mind incoming blasts/beams (handled above). If opp ki ≥ 50 and dist > 300: they might beam → maybe charge to keep up? If they beam, I punish via interrupt or guard. Charging when opp at range is ki generation but eats ×1.5 if they blast/beam... blast from range: I see it coming (eta ~20), stop charging, guard. OK so: if dist > 250 and opp free-ish: charge? But if they dash_forward at me... I'd be caught charging. Hmm. If dist > 250: charge a bit, react to their commits. If they approach, stop and play neutral.
     - At dist ≤ 110 (light range): mix: light (they might guard → blockstun 11, pushed 14, they're -? ; or back off). If they guard a lot, heavy crushes. 
   
   Simple neutral policy at close range: throw light when dist ≤ ~105. On block: I'm pushed... they're pushed 14 (block push) + blockstun 11 vs my remaining recovery (17-5=12 from hit... if blocked at active tick 5, my remaining = 12, their blockstun 11 — I'm -1, basically neutral, they're 14 further. Then next decision: if they guard still → they expect another light; I could heavy → crush. Adaptive: track opp's recent reactions.

   Opponent modeling: I can track history across the match (variables persist within a match, reset each match). Track: how often they guard my lights vs get hit vs back off. If they guard often → heavy crush. If they back off → don't whiff; walk forward. If they get hit → keep lighting.

   Also track their beam usage: if they beam at range often, when they have ki ≥ 50 at range, be ready.

   Danger: opp light range 110 same as mine. Trades. Both lights active 5-8: trade 40/40. If I walk into range and they light first... reaction: I get hitstun 15 → they combo me ~174. So approaching carelessly eats combos. Approaching with guard? Guard-walk isn't a thing (guard is stationary). Hmm — approach to ~115, then decide.

   Alternative approach: dash_forward from range (invuln 9) → lands behind them → but they're free, they turn (they get asked immediately when I land... "对手空闲的话会立刻转身" — they turn instantly when free). Landing behind a free opponent: they turn and we're at 60, neutral, my dash recovery 8 ticks — I'm vulnerable for 8 ticks while they act! They get a free punish: light ×1.25... wait I'm in dash recovery — mult: dash is a move, recovery → ×1.25! They light me 50 + combo. Dash-in on a free opponent = bad. Only dash when they're committed (blast/beam).

   Neutral at 60-110: whoever lights first, the other can... if I light first: my startup 5; their response latency: they see my light startup; their next ask might be up to 6 ticks away; their counter-light active at 5+ε — trade likely. Or they guard → blocked.

   Smart neutral: stay at edge of their range (115-ish), let them whiff, punish recovery. But walking back and forth — they may just approach and light.

   Let me think about what wins in this game. Key damage sources:
   - Full combo (4L+H ~174, or with counter start ~200+)
   - Heavy hit 120-180
   - Crush combo ~234
   - Beam 280
   - Clash 320
   
   Whiff punishes are the main skill. Bots here are simple; I'll write a decent reactive bot.

   Plan at neutral:
   - dist > 140: forward. But if opp free and their ki ≥ 50: they might beam — walking toward a beamer is good (interrupt). Keep forward but watch states.
   - 110 < dist ≤ 140: forward a bit more, or heavy if they're walking forward into it? If opp is in 'forward' state and dist ≤ 140: heavy! They're moving toward me, can't react instantly (decide every 6; walking forward → their next ask ≤ 6 ticks; they see my heavy startup at tick 0; they can back off starting at most 6 ticks later — during 9 startup they back ~3-9 → dist at active = dist + (their move). If they were walking forward: net +4.5×k - 3×(9-k)... if they immediately back: dist at active ≈ dist + 4.5×1 - 3×8 = dist - 19.5. If dist 140 → 120 < 140 → still hits? Active window ticks 9-12, reach 140. Hmm, if they react fast, heavy whiffs at close... At dist 135: they back → ~115 → hit at tick 9 if ≤ 140 → yes 115 ≤ 140 → HITS. Wait backing off reduces distance? No! Backing = away from me = distance increases. back 3/tick away. Forward = toward me. If they're in 'forward' (toward me) and I heavy: they continue forward until next ask (up to 6 ticks, +27 closer), then maybe back (-3×remaining). Worst case for me: they were at ask boundary — they ask immediately, see my heavy, back off for 9 ticks: dist +27? no wait — if they JUST decided 'forward' at the same tick I decided heavy, they walk 1 tick (+4.5 closer... they're in forward for 1 tick? They ask every 6 ticks: their next ask could be 0-5 ticks away. Worst: they ask next tick, switch to back for 8 ticks: net +4.5×1 - 3×8 = -19.5 (they get 19.5 farther... no: -19.5 means closer? forward for 1 tick = -4.5 dist; back 8 ticks = +24; net +19.5 farther). So dist at my active: 140+19.5 = 159.5 > 140 → whiff! Ugh. But typically they ask mid-cycle: walking forward 3-4 ticks (+13.5 closer), then back 5 (-15): net +1.5 farther ≈ 141.5 marginal.
     Heavy on a forward-walking opponent: ~50/50. And whiffed heavy = eat ~200 combo punish. Bad EV against reactive bots, good vs simple forward-marching bots.
     
   - dist ≤ 110 (both in light range): 
     - If I think they'll light: I light too (trade) or guard (they're pushed, I get +2 ki... blocked light: they're blockstunned 11, pushed 14; my guard → then I can punish their light recovery! Their light: if blocked at their tick 5, their remaining = 12; their blockstun 11 → they're free 1 tick before recovery ends... meh, ~neutral).
     - Proactive light: if it hits → 174 combo. If blocked → roughly neutral. If they counter-light → trade. Light is decent. But whiffed light (they backed off) → they punish ~200. 
     - Adaptive: track their behavior. Keep a simple counter: how they responded to my last N lights.

   Honestly, for a tournament of unknown AI opponents, a solid reactive/punish bot with guard discipline, blast usage at range, charge when safe, and combo optimization should do well. Many opponents will be simple rushdown (walk forward + light spam) or passive guarders or spammers.

   vs rushdown (walk forward + light): stay at 115-120, let them light from slightly too far (they light at dist ≤ 110; if I keep 115-125 they whiff... they only light when in range presumably. They walk to 110 and light → hits me (110 ≥ reach? reach 110, d ≤ 110 hits — at exactly 110 hits). Hmm. If they light at 110 while I'm at 110... I get hitstun 15, they combo me. I need to counter-poke: when they're in light startup and I'm free: if dist ≤ 110... wait if their light will reach me, mine reaches them (same range) — trade or I'm slightly late. Better: stay at 140, they walk in, when dist ~120-135 heavy?? They walking forward: as computed, marginal. 
   
   Alternative: dash_back when they get close and aggressive? Creates space, costs 10 ki.

   Or: meet their light with guard: blocked light → they're -1, pushed to 124. Then heavy on their recovery? Their light recovery ~12 remaining after block... I'm in guard (blockstun 11 for me? No — blockstun applies to the BLOCKER: "轻拳被挡：...挡的人被推开 14，硬直 11 tick" — blocker (me) stunned 11, pushed 14. Attacker in recovery 12. So after block: I'm free at 11, they at 12, dist +14. Basically neutral. Hmm.

   Simplest robust neutral: maintain ~dist 105-115, throw light when dist ≤ 108ish. Trade combos evenly; my combo logic is probably better than theirs. Plus crush punishes on guarders, beam punishes, blast dodges.

Let me also consider using blast offensively in neutral: at dist ~150-300, blast (70, they guard 12 or eat 70 or dash through). Blast costs 20 ki. Ki better saved for beam? Beam 280 for 50 ki is efficient. Blast 70/20. Hmm. Blast also gives them +2 ki if they guard... no wait blocked gives THE BLOCKER +2 ki. So blast into guard: -20 my ki, +2 theirs, -12 their hp. Bad trade unless it hits (70 + hitstun → they're in hitstun 20 — if close, I can follow? Blast at range 150: they're hitstunned 20 ticks; I walk 4.5×... too far to combo. Blast = poke chip mostly.

Beam usage: when opp committed (in recovery long move like heavy whiff at range?) or after knockdown oki? Beam 280 unblockable-ish (block 120). Best beam: when they're in a long commitment: e.g., they whiffed heavy at range 300 (they're stuck 35 ticks; beam startup 30, fire 40 — they recover at 35, see my beam, guard → 120. Meh. Or they're knocked down: down 42 ticks; I beam during their down → beam fires before they rise, they rise into beam → 280! Oki beam! They're down `left` ticks, can't act. My beam startup 30 + front travel: if they're within 30 + 30×(left-30)... front reaches them before they can... they rise at down-left; after rising they can guard — but beam front may have passed them? Beam covers from me to front — the ray persists 40 ticks; if front passed them, ray still covers them (ray from shooter to front). So if I start beam when they're knocked down with left ≥ 31ish and dist < 30×(their down remaining) + ...: they wake into the ray → 280 unavoidable (guard? They can guard on wake: they're free at wake, beam chip 120 + blockstun until beam ends). So oki beam: guaranteed 120+ (chip) or 280 if they don't guard. Also they might dash on wake (invuln 9 — dodge through beam if dist ≤ 140, or dash_back 200 — beam ray extends 30/tick, eventually covers... dash_back during beam: they dash back 200 (invuln 9), then beam front chases 30 vs their 20... front catches them after invuln → still hit. Unless beam expires). Oki beam is strong: ~120-280 for 50 ki.
   
   Even better oki: after knockdown, walk in and time a light as they wake? They can guard/react. Or charge during their down (safe, they can't hit me while down), then beam/blast as oki. Charging during their knockdown: free ki. Down 42-50 ticks = ~14+ ki. 

   So knockdown advantage: while they're down: if dist far, charge; near end of their down, position for oki. If I have ≥ 50 ki when they're down: beam timed to fire as they wake: beam startup 30; start beam at their down-left ≈ 31 → fires at left=1 → ray spawns next tick, they wake at 0... ray from me to front=40 ahead... they wake INTO expanding ray: 280 or guard 120 chip. Great.

   Also simpler oki: heavy timed to active as they wake (they might guard → crush... they wake and guard → crush 60+34 → combo). Or light on wake → trade/block.

   Hmm, but careful: hitting a downed opponent does nothing (invuln while down). Beam hit check: invuln → skipped, but "b.hit = true" only set when hit lands; if invuln, `continue` — beam stays active, can hit later when they wake. 

   Also: after knockdown they might wake with dash invuln... whatever.

Time management: matches are 1000 games vs each opponent. Win rate is what matters. Robustness > cleverness. Avoid timeouts (keep computation trivial). Avoid exceptions (wrap everything in try/catch? If decide throws → treated as idle — a thrown exception in my code = idle, not forfeit... "函数抛出异常，或者返回的不是下面的动作名，都当作 idle" — so exceptions are just idle, no DQ. Still, wrap in try/catch returning a default to be safe? Exceptions become idle which is safe-ish. But better to catch and return 'guard'.

Budget: 200ms per call, 1500ms per match, ~600 calls max → avg 2.5ms/call. My logic is microseconds. Fine.

Let me now also handle: my own blast in flight — "你的上一发气功波还在场上飞，这个动作无效" — don't blast again while blastOut.

Also ki management: keep ki for beams (50) and dashes (10). Blast (20) is optional poke. Charge when opponent is down or far and not blasting.

Beam as opener: at range, if opp free and my ki ≥ 50: beam → they must guard (120) or get 280, unless they punish my startup (30 ticks — if dist > ~140+4.5×24 they can't reach me... they walk 4.5/tick; to interrupt they need to reach 110 within my startup minus their reaction: from dist D, time to reach ≈ (D-110)/4.5 + latency. My startup 30 → safe if (D-110)/4.5 > 30-6 → D > 224. So beam from dist > 250-ish is "safe" but they'll just guard (120 chip). Still +120 for 50 ki... they might dash_back (200 away — beam covers all, eventually hits unless they... front reaches them during dash invuln? Beam front 30/tick from me; they dash back at my startup start: they're at D+200 by tick 10, front starts at tick 30 at my x+40, front reaches them at 30 + (D+200-40)/30 ≈ 30 + D/30 + 5.3. Their invuln ended at 10 — beam front hits them (they're in dash recovery 8 then free — they guard). Chip 120.
   So beam at range = guaranteed ~120 chip (they guard) or 280. Not bad: 50 ki → 120-280 dmg + knockdown on hit. And forces clash if they counter-beam (only if simultaneous-ish). Hmm wait — if they counter-beam AFTER my beam starts firing: their beam startup 30 while my beam hits them during startup (my beam fires at tick 30, front reaches them at (D-40)/30 later; their beam started at my tick ~6 (their reaction), their startup ends at their 30 = my 36; my front reaches them at 30 + (D-40)/30 ≥ 30+7=37 if D ≥ 250. So they finish startup just as my front arrives → marginal; if my front arrives during their startup → 280×1.25 = 350 + they lose 50 ki. If my front arrives after their startup: clash! So counter-beam from far = clash, from medium = they eat 350. Clash power depends on ki at clash time. Risky for them.
   
   So strategy: at range with ki ≥ 50: beam. They'll likely guard (chip 120) → and during their blockstun "一直硬直到大招结束" they're stuck for remaining fire + recovery. Then I can... beam total 90 ticks; they're stuck till fire ends (~40 - (D/30)) ... after my beam ends I'm in recovery 20 — can't chase. Hmm, chip 120 and reset. Decent but not amazing. Alternatively close in and combo.

   Better: save beams for oki and punishes, use blast as cheap poke? Blast 20 ki, 70 dmg or 12 chip. Actually blast vs guard: -20 ki, +2 their ki, -12 their hp. Blast vs hit: +70, they gain 5.6 ki. Neutral blast at ~200: opponents often walk forward → walk into blast → 70 + hitstun 20. If they guard: chip. If they dash: they close 200 → punish my blast recovery... as computed, only if dist < ~174 do they get a punish window; from 200 they arrive as I'm free — neutral-ish, scary. From dist > 250: blast is safe-ish; they dash through → they're at 60 from me, both free-ish, I'm in blast recovery ~... timeline: blast total 29. They dash (10+8): arrive free at 18 while I have 29-11-k... if blast still flying when they dash... ugh.

Let me simplify the overall gameplan:

**Gameplan**: 
- Maintain mid range, punish commitments hard (combos, crushes, beam interrupts).
- Use guard reliably vs projectiles.
- Charge ki when safe (opponent down, far, or committed).
- Beam on oki and on big punishes.
- At close neutral: light pressure, adaptive (crush guarders with heavy).
- Never whiff heavy at reactive range; use heavy only on: hitstun combos, charging opp, confirmed recovery punishes, guard-predictions.

Let me draft the decision tree:

```
decide(s):
  try:
    if s.clash: return clashPush(s)
    if s.me.canCancel: return comboCancel(s)
    if !s.me.free: return 'idle'
    
    me = s.me, op = s.opp, d = s.dist
    
    # 0. If I'm in hitstun/etc... (not free → idle, handled)
    
    # 1. Danger: incoming blast
    inc = s.blasts.find(b => b.incoming)
    if inc:
      if inc.eta <= 9:
        # dash through if worthwhile and safe
        if me.ki >= 10 && d >= 120 && d <= 230 && oppCommitted(s):
          return 'dash_forward'
        return 'guard'
      else:
        # blast far: continue neutral but don't start long moves; if opp in blast state (they fired), walk forward
        # handled below but keep guard default near eta
        if inc.eta <= 12: return 'guard'
    
    # 2. Beam threats
    if op.state == 'beam':
      left = op.left  (careful: left = remaining of whole beam dur? op.left is dur - t for the whole beam state: startup+fire+recovery total 90)
      phase = op.phase
      if phase == 'startup':
        startupLeft = 30 - op.t
        if d <= 110 && startupLeft >= 6: return 'light'
        if d <= 140 && startupLeft >= 12: return 'heavy'
        if d <= 140 && me.ki >= 10 && startupLeft >= 11 && roomBehind(op): return 'dash_forward'
        if startupLeft >= 25 && d <= 100 + 4.5*(startupLeft - 14): return 'forward'
        return 'guard'
      else:  # firing or recovery
        # firing: ray expanding toward me
        if phase == 'firing' && d <= 120 && me.ki >= 10 && roomBehind(op): return 'dash_forward'  # dodge through
        return 'guard'
    
    # 3. Beam of mine... n/a
    
    # 4. Opponent down → oki
    if op.state == 'down':
      downLeft = op.left
      if me.ki >= 50 && downLeft >= 32 && d <= 600: return 'beam'  # fires as they wake
      # walk in for close oki or charge
      if downLeft >= 20:
        if d > 90: return 'forward'
        return 'charge'  # safe charge near them? They're down 20+; charge until they're near wake
      # wake imminent: position at light range, prep
      if d <= 110: return 'light'?? timing: they wake at downLeft 0... light active at 5-8 vs wake. If downLeft in [1..5] → light hits on wake (they can guard? Wake + guard: they're free at wake tick; my active at 5-8 — they could guard if asked immediately... they get asked at free (nextAsk = tick+1). They see my light startup, guard → blocked. Meh.)
      # safer: stay at ~120 and react to wake, or charge more
      if d >= 100: return 'charge'  # they can't hit me from ground... if I'm at 100-120 and they wake with dash_forward? They'd need ki; dash 200 → behind me... risky but ok
      return 'guard' if d < 100 else 'charge'
    
    # 5. Punish windows: opp in recovery or charging or stunned
    if op.state == 'crushed':
      if d <= 110: return 'light'
      if d <= 135: return 'heavy'  # crush stun 34, they're stunned; heavy 120 + they're already stunned → knockdown
      if d > 135: return 'forward'
    if op.state == 'hitstun':
      # free damage if in range
      if d <= 110 && op.left >= 6: return 'light'
      if d <= 140 && op.left >= 12: return 'heavy'   # they're stunned, heavy guaranteed-ish
      # else let them recover
    if op.state in ['light','heavy','blast','beam','dash'] && op.phase == 'recovery':
      rl = op.left
      if d <= 108 && rl >= 6: return 'light'      # counter 50 + combo
      if d <= 138 && rl >= 12: return 'heavy'     # counter 150 + knockdown
      if rl >= 8 && d <= 110 + 4.5*(rl-8)... # walk? skip, recoveries short except heavy/beam
      if rl >= 14 && d <= 130 + 4.5*(rl - 14): return 'forward'
    if op.state == 'charge':
      if d <= 95: return 'light'
      if d <= 135: return 'heavy'
      return 'forward'
    if op.state == 'light' && op.phase == 'startup' && d <= 108 && op.left... # their light startup 5, active 3, recovery 9; total 17
      # counter-poke: my light active 5-8; their active 5-8 too → trade. Unless their startup nearly over → they hit first.
      # skip: return 'light' if op.t <= 1? Trades are meh. Actually if I light during their startup, we trade 40/40 but I get cancel combo → my trade is better! I hit → cancel → combo continues on them (174+) while they hit me once (40) and my hitstun 15 interrupts my... wait if I'm in hitstun my combo stops. Trade: both hit at ~tick 5-7. I take 40 + hitstun 15 (their combo on me: they get cancel too! They can chain lights on me!). Symmetric. Skip counter-poking lights; prefer guard or back.
      pass
    if op.state == 'heavy' && op.phase == 'startup':
      # interrupt with light if I can hit before their active, or back off
      if d <= 110 && (9 - op.t) >= 6: return 'light'   # my active 5-8 before their 9 → interrupt 50 + combo!
      # else evade: back or dash_back
      if d <= 140: 
        if me.ki >= 10 && d <= 140: return 'dash_back'  # 200 away, safe
        return 'back'  # during their 9 startup, I gain 27 → 167 > 140 whiff... if d ≤ 140 now, +27 → ≥ 140 only if d ≥ 113. If d < 113: back 27 → d+27 < 140 still hit! Need dash.
        Hmm: back speed 3/tick × 9 = 27. If d = 100 → 127 < 140 → their heavy still hits! And I'm in 'back' — hit 120 + knockdown. BAD. So for d < 113, backing doesn't escape heavy. Options: light interrupt (if their startup remaining ≥ 6: their t ≤ 3), guard (crush 60 + 34 stun — then they're in recovery ~23-25 > ... they punish me), dash_back (200 → safe), dash_forward (through them! invuln 9 > their active... dash through: land behind at tick 10; their heavy active 9-12 — I pass through during invuln 9... at tick 9-10 I'm landing behind; their heavy might hit me at tick 9-12 if I'm within 140 in front — I'm behind → their reach check: d = (o.x - a.x)*a.facing — I'm behind → d < 0 → no hit. Safe! And they're in heavy recovery 22 → I punish with light (active at my tick 18+5=23 vs their recovery ends at ~9+4+22=35 from their start; my dash started at their t≈0-3... their remaining ≈ 22+... they whiffed → recovery till ~35; I act at 18, light active 23-26 < 35 → COUNTER HIT 50 + combo!! 
        So vs heavy startup at close: dash_forward (if room behind them) → total punish. Or light interrupt if early.
        Also if d in (140, ~200]: their heavy can't reach anyway; just back/whiff-punish: their heavy whiffs, recovery 22 → my turn: if d ≤ 140+... after whiff, punish window: they're free at 35 from start; I see recovery with left ≥ 12 → heavy or light per above.
    
    # 6. Opponent free, neutral
    if op.free:
      if d > 320:
        # far: charge if safe (no incoming blast — handled), they're far
        return 'charge' if (my ki < 90) else 'forward'
        # but watch: if they charge too, both charge → stalemate; time matters little (hp equal → draw counts half). Slight aggression better: if both at 1000 hp at time end → draw = half win. Prefer fighting.
        # mixed: alternate charge and forward? Let me: if ki < 60: charge, else forward. But if opp also charging far away, one of us must approach. Track: if opp charging and I'm charging for a long time (t > 1500?), go forward.
      if d > 140: return 'forward'
      # in-range neutral 60-140:
      ...
    # fallback
    return 'idle'
```

Close neutral (both free, dist 60-140) — the tricky part. Consider opponent archetypes:
- Rushdown: walks in, lights at ≤110. 
- Camper: guards or backs off, blasts.
- Charger: charges at range.
- Spammer: blasts/beams.

My close-neutral policy:
- If d ≤ 105: light (initiate). Track result: my last light: hit / blocked / whiffed. 
  - If they blocked my last light: next time heavy instead (crush attempt).
  - If my light whiffed (they backed): next time don't light at 105; wait or walk.
- If 105 < d ≤ 140: 
  - If opp in 'forward' state (approaching): back off to avoid their light? or light when they arrive... I decide every 6; if I 'back' they close at 7.5/tick net... Rather: hold ~120 and light when d ≤ 108? Their approach brings them into my light range with them committed to forward — my light at d≈110: their forward continues 1-5 ticks (+4.5-22 closer), my active 5-8 — they're at ~90-110 → HIT (they're walking = not a move → no counter mult) → cancel combo 174! If they guard mid-approach — can't, guard is a choice; they can switch at their next ask. Approaching opponents eating lights → combo. Rushdown bots get comboed. 
- Anti-approach: when opp.state == 'forward' && d ≤ 135 && d ≥ 95: light. When they walk in, it connects.

Also: opp in 'back' (retreating): don't chase with lights (whiff). Walk forward (4.5 vs 3 — I close 1.5/tick). Corner them eventually. When their wallBehind is small (< 100), they're cornered → lights connect more, heavy is good (they can't back off; if they guard → crush).

Corner pressure: if op.wallBehind... op's wall behind: from my view I can compute: if my facing f=1 (opp to my right), opp behind-wall = 960 - op.x; else op.x - 40. If opp's back-wall < ~80 and d ≤ 140: they can't retreat → heavy is strong (guard→crush, hit→120/150/180, back→whiff impossible... they can still dash_back 200 (ki 10) — then they're past... cornered dash_back goes 200 → clamped at wall, ~dist +? if they're at wall, dash_back keeps them near wall (clamped) → whiff punish on my heavy?? dashEnd for back: x = me.x - f*200 → clamped to stage: if they're at 60 and dash back → 60 stays... wait dash_back from x=60 with facing away from me... they're cornered at x=60 (left wall), I'm to their right (facing -1 toward... their dash_back: x1 = their.x - theirFacing*200; theirFacing points at me (right, +1) → x1 = 60 - 200 = -140 → clamp 40. So they stay cornered. My heavy at d ≤ 140: hits during their dash? invuln 9, moving 10 — dodge. Then they're at 40, I'm at ~100-200... their dash recovery 8 → punish window small. Anyway: heavy vs cornered opponent is strong.

Let me also add: my own blast usage in neutral. At d in 141-400 with no incoming blast and opp free: occasionally blast? Blast 70 dmg, opponent must react. If they guard: 12 chip + I gain nothing, lose 20 ki, they gain 2. If they're approaching: 70 + hitstun. EV decent vs approachers, bad vs guarders. Adaptive: track if they blocked my blasts. Also blast interrupts their charge (×1.5 = 105!). If opp charging and d in 141-400: blast! 105 dmg, safe from their position (they're stuck charging... they can stop at next ask and guard → 12. Hmm). Walk-forward + light is also fine.

I think charging opponents: if far (d > 140), blast them (105 if they don't react; they take it during charge ×1.5). If they keep charging, repeat. Ki-efficient? 20 ki for up-to-105. 

Also punish: opp in blast startup at range? Their blast startup 11 then projectile. If I'm in range to light (d ≤ 110): light them during startup (interrupt, they lose 20 ki, take 50 + combo). Blast startup interrupt = good. Their blast spawns at tick 11; my light active 5-8 → interrupts before spawn. 

Opp dash (moving) toward me: they're invuln 9, then recovery 8. If they dash at me from far, when they land (d ≈ max(d-200, 60)), they're in recovery 8 ticks → I punish: light if their recovery left ≥ 6. But careful: after dash recovery they're free. Their dash: 10 moving + 8 recovery. I see state 'dash', phase moving/recovery. If recovery && left ≥ 6 && d ≤ 108: light (counter 50 + combo). Also if they dash THROUGH me (land behind): they face original direction during recovery; I turn (I'm free → auto-face). They're in recovery → punish similarly. d = 60ish. Light: active 5-8, their left 8 → connect.

If their dash is still moving (invuln): don't attack (whiff + they might punish my recovery). Back off or guard. Guard: if they land in front and light... whatever. If opp dash moving toward me: I could time my light for their landing? Their moving left = 10 - t; then recovery 8. My light active 5-8: to catch their recovery with left ≥ 5: start light when their moving left ≈ 3-4? Then active at their recovery t≈2-5 → counter hit! But if they land BEHIND me (dash-through), my light whiffs facing... I auto-face when free — my light direction: facing updates each tick for free fighters. During my light startup, facing is locked. If they pass through me, my light faces wrong way → whiff → punished. Risky. Only do this timing-punish if their dash won't pass me (d > 200+... if d ≥ 260, their dash lands 200 closer, in front → then punish timing works. If d < 140ish they might pass through). Simplify: if opp dash recovery && left ≥ 6 && d ≤ 108: light. Skip the moving-phase prediction... Actually if their dash moving and d > 260: their landing is in front at d-200 ≥ 60. My light active at 5-8; their recovery starts at moving-left ticks + then 8 recovery. If I light now when their moving left = m: my active 5-8, their state: if m ≤ 5 they're in recovery t = 5-m... connect if recovery remaining ≥ 1 at my active: 8 - (5-m) ≥ 1 → m ≥ -2 always true... my active window is 3 ticks; their recovery lasts 8. If m ∈ [0,5], my active (5-8) overlaps their recovery (starts at m, lasts 8 → ends at m+8 ≥ 5... if m=0: recovery t 0-8, my active 5-8 → hit (they're in recovery t 5-8, remaining ≥ 0 → hit at 5 as long as in recovery: t=5 < 8 yes → HIT). If m = 3: my active 5-8, their recovery 3→11 → hit. So if their moving left ≤ 5 and landing in front (d ≥ 265... need d-200 ≥ 60+their body... the landing spot in front of me: d' = d - 200 ≥ 65 to be safely "in front" (minGap 60): d ≥ 265): light → counter combo. If d ∈ [140, 265]: their dash might land behind (d ≤ 140 no... pass-through needs... their dash toward me: x1 = their.x + facing*200; pass if d ≤ 140 lands behind; 140 < d < 260: land at minGap in front (60). Hmm engine: before = (my.x - their.x)*d > 0 yes; after = (my.x - x1)*d = d - 200; if after < 60 → d < 260 → then behind = my.x + d*... they land: if after ≤ -60 (d ≤ 140): behind me; else stop in front at 60. So d ∈ (140, 260): they land 60 in front of me → in front → light timing works! And d ∈ (260,∞): they land at d-200 > 60 in front.
   So: opp dash moving toward me (phase moving), any d: their landing is in front if d > 140. If d > 140 and their moving-left ≤ 5: light → counter. If d ≤ 140: they'll land behind me (if room behind me!) — check MY wall behind: if I have room behind me (my wallBehind ≥ 60), they pass; else they stop in front. If they'll pass behind me: I could... guard? They land behind, in recovery 8, facing old direction; I turn; punish: light active 5-8 vs their recovery 8 — d = 60 → light reaches (≥... d=60 ≤ 110 yes) → counter hit! But wait, during their recovery can they act? No, recovery. So even dash-through is punishable: after they land behind me, I'm free, I turn (auto), light them in recovery. My light active 5-8; their recovery left at my decision ~8 - (their landing lag 0-2) → ≥ 6 → hit. So: opp dash (either phase) landing soon → light = counter combo. Except their invuln: if they're still moving with invuln > my active window... my active 5-8 ticks from now; their invuln ends at moving-left... if their moving-left > 3 (invuln continues past my tick 5-8?) invuln = t < 9, i.e., first 9 of 10 moving ticks. If their moving left m ≥ 4 at my decision: invuln till tick m-1 ≥ 3... hmm: their invuln ends when moving t reaches 9 → after m-1 more ticks (m = 10 - t... if t=5, m=5, invuln for 4 more ticks → ends at my tick 4). My active 5-8 → after invuln → hittable, but are they still moving at my tick 5-8? Moving ends at m ticks → if m ≤ 5, they're landed/in recovery during my active → HIT (recovery). If m > 5: still moving during my early active → dodge (invuln till m-1)... my active ticks 5,6,7: if m ≥ 6, at my tick 5 they're moving with invuln (t < 9 iff 10-m < 9 → m > 1 → yes invuln) → my light whiffs (dodge, a.hit? strikes: `if invuln(o): dodged... continue` — a.hit stays false, so my light continues active ticks 6,7: at tick 6: m-1... if m = 6: at my tick 6 their t = 10? They moved during ticks... eh, edge cases. Rule: light if their moving-left ≤ 4 (so by my active they're landed, invuln over (invuln only while t<9; at m ≤ 4... t = 10-m ≥ 6... invuln is t < 9 → t ≥ 6 → invuln over? t < 9 means invuln; t = 6,7,8 → still invuln! Wait invuln = a.t < 9, moving ticks 0-9. t=9, not invuln, last moving tick. So if m = 1 (t=9): not invuln, moving last tick → my active tick 5: they've landed (recovery t=4) → hit. If m = 2 (t=8): invuln for 1 more tick, land at tick 2, recovery at my ticks 3-10 → my active 5-8 → in recovery, t<9? their state = dash, t = 10+2=12 by my tick 5... invuln checks state==='dash' && t<9 → t=12 → NOT invuln → hit. So light works if m ≤ 4ish: they land by my tick 4, invuln done, recovery continues through my active 5-8. If m = 5: land at tick 5 — my active tick 5: they're at final moving tick t=9 → not invuln → but are they at landing spot already? move: `a.x = x0 + (x1-x0)*(t+1)/10` — at t=9, x = x1. So they're AT the landing position, not invuln → my active tick 5 hits if in reach. OK so m ≤ 5 works. If m ≥ 6: whiff risk. 
   Rule: opp.state=='dash' && (phase=='recovery' || (phase=='moving' && op.left <= 5)) && d ≤ 108... wait d is current distance; if they're still moving toward me, d shrinks. Use current d ≤ 108? If they're moving toward me at d=150, m=3: they'll land at 60 (or behind). My light reach 110 — they'll be at 60 or behind me at my active. If behind me — whiff! So require landing in front: d > 140 (lands 60 in front) or d... if d ∈ (140,260) landing 60 in front → fine, but current d > 140 > 110 — my light reach is checked at active time when they're at 60 → fine, reach check is positional at active. Current d doesn't matter for the hit check! The hit check happens at my active ticks with positions then. So condition: their landing in front of me (d_now > 140 guarantees front landing... also d_now ∈ (140,260) → 60 front; d ≥ 260 → d-200 front) and they'll be out of invuln & in reach by my active (m ≤ 5) → light. If d ≤ 140: landing may be behind me (if I have wall room behind); then my light whiffs. In that case: wait, then punish when they land (they're in recovery; I turn; next ask ≤ 6... my nextAsk: I'm asked at most every 6 — but I'm free already? If I'm free and just decided, next ask in 6 ticks; their recovery 8 — I can light at next ask if their recovery left ≥ 6 — recovery left = 8 - 6 = 2 → too late. Hmm, dashes through me are hard to punish directly; but landing behind me at 60: after their recovery they're free, we're both free at 60 → neutral. Or I can dash away... fine, neutral.
   OK simplify: opp dash moving toward me, m ≤ 5, d > 145: light. opp dash recovery, left ≥ 6, d ≤ 108: light. Good.

Now — heavy usage on opponents in hitstun after my blast? Covered by hitstun rule.

Oki (opponent down) refinement:
- op.state == 'down', downLeft = op.left (down duration remaining).
- If my ki ≥ 50 and downLeft ≥ 34 and d ≤ 700: beam. Beam startup 30 → fires at tick 30, they wake at downLeft ticks. Beam front spawns at me+40, reaches them at (d-40)/30 ticks after fire. They wake at downLeft; if beam front reaches them BEFORE they wake: they're invuln (down) → skipped, beam still active (b.hit false), keeps checking each tick → once they wake (still in ray if front passed them — ray covers me→front; they're between → in ray) → hit 280 on wake (they can't guard — hit happens the tick they're free... wait they wake: state idle, they can choose guard at their ask (nextAsk = tick+1 — they're asked next tick). Beam hits them the same tick they become free? Sequence: free() sets state idle at tick T; beams() ran earlier in that same tick when they were still down (dur check in step 4, after beams in step 3). So at tick T they became free AFTER beams check → at tick T+1, they can decide guard (asked immediately since nextAsk = T+1)... beams at T+1: are they in ray? If yes → hit before their guard takes effect? Order in step(): 1. choose (they return guard → state guard), 2. move, 3. beams → they're guarding → chip 120. Hmm — so beam on wake: they get one decision tick before beam hits → smart bots guard (120), simple bots eat 280. Also they could dash (invuln 9 — dodge through the beam, land behind me if d ≤ 140... they'd need ki 10).
  Timing detail: I want beam fire to overlap their wake. If I beam when downLeft ≈ 31-40: fire at 30 → front spawns, they wake at 31-40 while front approaching/reaching → hit at max(wake, front-arrival). Any downLeft ≥ 31 works as long as beam still firing (40 ticks) when they're hittable: front arrival ≤ 40 → d ≤ 40 + 30×40 = 1240 — always. And they wake before beam ends: wake at downLeft vs beam fire ends at 30+40=70 → downLeft ≤ 70 fine. So beam oki when ki ≥ 50 && downLeft ≥ 31 (fire before wake, they're in ray at wake or shortly after). Also if downLeft ≥ 31 but front reaches them after beam... front reaches them at 30 + (d-40)/30 ≤ 70 → d ≤ 1240 always true. 
  Also they might be knocked down far away — beam still reaches. OK: op down && ki ≥ 50 && downLeft ≥ 31 → beam.
- If ki < 50: charge during down, or close distance. If d > 110 and downLeft ≥ (d-110)/4.5 + 4: forward. Else if downLeft ≥ 8: charge (if ki < 95). Else (wake imminent, no beam): guard? stand at range? If d ≤ 110 as they wake: they might light me first... I should be at ~115+ or be ready to trade. Position: if d ≤ 100: back a bit? I decide every 6 ticks; wake imminent... Simplest: if wake within 6 ticks: if d ≤ 105: 'back' (create space); else 'guard'. Meh. Or go aggressive: light timed to active right at wake+1: if downLeft ∈ [4,6] and d ≤ 105: light (active 5-8 ≈ wake+... they wake at downLeft 4-6; my active 5-8 → they're free at 4-6, I hit at 5-8 → they had 0-3 free ticks — they'd get one decision maybe → guard possible → blocked. Or they eat 40 + combo.
  I'll do: downLeft ≥ 31 && ki ≥ 50 → beam; else charge if ki < 90 (safe, they're down ≥ 8); else if downLeft ≤ 6 && d ≤ 105 → light; else guard if d ≤ 130 else charge/forward.

Hmm wait, one more: during their down, if I'm close (d ≤ 60-ish can't be < 60), charging right next to them — when they wake they might immediately light me (I'm charging → ×1.5 = 60 + their combo!). Danger! So charge during down only if I keep distance ≥ 130 or their wake is ≥ 8+ ticks away (I get an ask before wake: asks every 6; if downLeft ≥ 7, I can react at next ask (downLeft ≥ 1) and guard/back). If downLeft ≥ 7: charge is safe-ish (at wake-1 I'll have had an ask: downLeft ≥ 7 → next ask at downLeft ≥ 1 → I see them about to wake → guard). But if I'm at d=60 when they wake: they light (startup 5); I guard (decide at their wake tick... my ask comes when? I decided charge at downLeft 7 → next ask at downLeft 1 → guard → they wake and light → blocked. OK so charge until downLeft 7, then guard. But their wake light might come at wake+5; my guard set at downLeft 1 → fine.

Alright — but their dash on wake: wake + dash_forward → behind me, punish... whatever, acceptable risk.

Neutral both free, dist-based:

- d > 400: charge if ki < 60 else forward? Let me think ki economy: beam oki needs 50. Beam neutral needs 50. Dashes 10. Blast 20. Target ki ~50-70. Passive gain 0.04/tick is tiny (144/match). Charge 0.36/tick total... wait passive 0.04 + charge 0.32 = 0.36/tick → 100 ki in ~280 ticks of charging. Blocked hits +2. Damage taken 0.08/hp → taking 300 dmg = 24 ki. Charging is the main ki source. So I should charge whenever safe (opp down, opp far, opp committed).
- Opp far and charging too: if both charge, whoever moves first gets hit approaching? Approaching a charger: they see me, stop charging, guard or fight. Neutral. If I charge and they charge: stalemate, time runs out, draw (half-win). Draw is 0.5; fighting is variable. If I think I'm better, fight. I'll fight: after ki ≥ 55ish, approach.
- So: d ≥ 300: if my ki < 55: charge (unless incoming blast — then guard/etc; handled first). If their ki ≥ 50 and they're beaming — handled. If opp charging: if my ki < 55: charge; else forward.
  But: charge risk — they blast me from 400: blast at 13/tick from 400: 28 ticks flight — I see eta, guard in time (eta ≤ 9 rule; from eta 28, my next asks at 22, 16, 10, 4 → I guard at eta ≤ 9: ask at eta 4 → guard. Good. They beam from 400: beam startup 30 + front travel (400-40)/30 = 43 ticks → I see beam startup (they're in beam state) — handled by beam-interrupt rules: d=400, their startupLeft maybe 25 → walk-interrupt condition fails → guard. Eat 120 chip while charging — fine-ish. Actually while charging I eat ×1.5 → 280×... wait if I guard, no charge multiplier. Guard decision: I'd switch to guard when I see beam startup → chip 120, no 1.5×. OK.
  Charge while watching: safe enough.
- 140 < d < 300: forward (approach). Or if opp committed (charge/blast/etc) → handled. If opp free and backing away: chase 4.5 vs 3 — corner them.
- d ≤ 140 close neutral:
  Let me define my pressure rule:
  - If d ≤ 105 and opp free:
    - If they've been guarding my lights a lot (blocksLight high): heavy (crush) — heavy at d ≤ 140 vs a guarding opponent = 60 + 34 stun + followup combo ≈ 234. But if they DON'T guard (they back or light), heavy whiffs/trades → punished ~200. Adaptive.
    - Else: light.
  - If opp.state == 'forward' (approaching) && d ≤ 135: light (they walk into it).
  - If opp.state == 'back' && d ≤ 140: forward (chase; don't whiff lights at retreating opponents). Actually if they're retreating and I walk: d shrinks 1.5/tick. Then they might stop and light... neutral continues.
  - If opp.state == 'guard' && d ≤ 138: heavy!! Crush a known guarder. If d ≤ 138 and opp guarding now: heavy → crush (60, 34 stun) + light combo after = ~234 total. Their guard: do they stay guarding? They see my heavy startup (9 ticks); smart ones release guard and back (their ask ≤ 6 → back 3×9 = 27 → d 165 → whiff!). Hmm. But they were guarding — probably guarding the blast/whatever. If opp is guarding RIGHT NOW and d ≤ 130: heavy is good vs bots that hold guard, bad vs bots that react. Opp guarding = they're free (guard is free state), they get asked ≤ 6 ticks. If they back immediately: +27 by my active. d ≤ 113 → still hit? 113+27 = 140 → marginal. Say d ≤ 115 && opp guarding → heavy (they barely escape). Most guard-holders get crushed.
    But WAIT: crush → they're stunned 34; my heavy recovery 22 remaining after active... I computed: crush at their guard tick ~9-10 (my heavy active 9-12); my total 35 → free at ~25-26; their stun ends ~43-44. I get ~18 ticks → walk (0 needed, d unchanged ≤ 115... crush has no push) → light active 5-8, hits at ~31-34 < 43 → HIT → 40 + cancel combo: L2 32, L3 26, L4 22, H 54 (d grows by 14 per light: 115+... starting d ≤ 115: lights push +14 each: 129 — wait L2 needs ≤ 110! d=115 → L1 at 115 (≤110? NO — light reach 110!). Hmm crush at d ≤ 110 then. If crush at d = 115... heavy reach 140, light 110. After crush, walk in during their 34-stun: walk 4.5/tick × ~15 ticks available → close to 60. Then light combo from ~60: pushes 60→74→88→102→116(≤110? 4th light at 102 ≤ 110 ok → 116), heavy at 116 ≤ 140 → 174 total. Plus 60 crush = 234. 
    So heavy on a guarding opponent at d ≤ 130 (walk-in included) = ~234. Nice. But if they stop guarding and back: whiff → I eat ~150-200. Adaptive: only do this if opp guards frequently. Track oppGuardTime / opp behavior.
    Hmm, actually — should I heavy on a *currently-guarding* opponent even unadaptively? They're guarding *now*; their next ask ≤ 6 ticks; my heavy active at 9-12. If they ask within 6 ticks and choose back: 3×(9-k)... if k=1: back for 8 → +24. d ≤ 116 → hit. If k=6 (just decided guard): back for 3 → +9; d ≤ 131 → hit. So if d ≤ 116: heavy on guarding opp connects unless... they could dash_back (200 → safe, costs 10 ki) or light me during my startup?? They're guarding; light has startup 5 — if they ask soon and light: my heavy active 9 vs their light active 5+... they hit me first at their tick 5-8 → my heavy interrupted (×1.25 → 50 + combo on me!). If d ≤ 110 they can light me out of heavy startup. Ugh. Guard-release-light counters my heavy. But honestly most bots guard and hold. I'll do it, maybe when d ≤ 110... if they light instead, I eat 50 + combo ~ worst 200 vs my 234 upside. Meh EV vs smart. Adaptive: track if they countered my heavy startup before (did I get hit during heavy startup?). Keep a flag: if I've been interrupted out of heavy recently, stop throwing heavies at guarding opps (use lights instead).
    
    Simpler adaptive scheme: maintain stats: myLightsBlocked, myLightsHit, oppGuardTicks. If opp guarding now && d ≤ 115 && (their guard tendency high OR they rarely interrupt): heavy. Track heavyInterrupted → avoid.
    
  - If opp idle at d ≤ 105: light.
  - Default at d ≤ 105: light. At 105 < d ≤ 140: forward.

Actually hold on — light at d ≤ 105: they might be expecting it and counter-light (trade) — trades are fine (equal). Or they guard → blocked → neutral, +2 ki them, pushed 14 → d ~119. Then they're a guarder → next time heavy.

Whiff risk on light: if opp is at d ~105 and moving back when I light: active at 5-8, they move 15-24 back → d ~130 > 110 → whiff → they punish my 9-tick recovery: light (d 130 → they walk in 4.5×? their recovery punish: they see my light recovery left ~9-12, d ~126; they forward + light... they can reach: walk 4.5×4 = 18 → 108 ≤ 110 → light active... tight. Or they dash. Risk exists. Light at d ≤ 100 reduces whiff risk (they escape to 124 max if immediately backing... 100+3×8 = 124 > 110 → still whiff possible). Can't fully avoid. Only throw light when opp is NOT backing (opp.state != 'back') — retreating opponents never get lighted. And when opp is forward/idle/charge/guard: 
  - forward → walks INTO light → hit.
  - idle → 50/50.
  - charge → ×1.5.
  - guard → blocked (then adaptive heavy later).
  
Good rule: light only if d ≤ 105 && opp.state in [idle, forward, charge, guard]... hmm guard → blocked. Skip light vs guard (use heavy adaptive). 

Let me also add anti-light for myself: when opp throws light at d ≤ 110 (opp light startup/active): options: guard (safe: block → they're -1, pushed 14 → I get ask... I'm blockstunned 11, they're recovering 12 → after block, next ask both ~neutral). Or back (d + 3×5 = 125 → their active at 5-8 whiffs if d > 110-... if d ≥ 96, back → 96+15=111 > 110 → whiff! → punish their recovery 9 ticks: my light: d 111 → too far... I'd need to walk in: (111-105)/4.5 ≈ 1.4 ticks + light 5 → their recovery ends at 12 — active 7-10 > 12? tight/whiff. Meh. Or counter-light → trade.
  Guard vs opp light is fine and safe. Rule: if opp light startup && d ≤ 110 && (their startup left ≥ 2): guard? But then I eat chip 0 (blocked light = 0 chip! light has no chip... `if (M.chip) hurt` — light chip undefined → no chip on block). Blocked light: I take 0, get +2 ki, pushed 14, blockstun 11, they're -1 and 14 further. Great deal! GUARD ALL LIGHTS. Rule: opp.state == 'light' && phase in [startup, active] && d ≤ 115 → guard.
  Hmm but if they're adaptive and mix heavy: guarding heavy = crush (60 + 34 stun + their combo ~ bad). So guard vs light only if... I can't distinguish until startup plays out — both have startup; light startup 5, heavy 9. If opp.state == 'light' (confirmed light) → guard. At their active ticks it's still 'light'. So I KNOW it's a light → guard safely. If d ≤ 115 && opp light startup/active → guard. But reaction: I might get hit before deciding (their light active at 5-8; my ask latency up to 6 → might eat it anyway). Guard when possible.

  Similarly opp heavy startup at d ≤ 140 → dash_back (10 ki) or back-walk (only if d ≥ 113) or dash_forward through (if room behind them, lands me behind → punish counter combo! computed earlier: their heavy active 9-12, I land behind at tick 10 — wait their active 9-12: at tick 9-10 I'm passing/behind — invuln covers t<9... at tick 9 (t=9) NOT invuln but am I past their reach? Their heavy reach: d ≤ 140 from them toward their facing (toward me originally). If I'm behind them → d < 0 → safe. At tick 9 I'm at 180/200 of the way: my position = start + 180×f. If d = 100: I'm 80 past them → behind, safe. If d = 140: 40 past → behind, safe (body 30, need |Δ| ≥ ... their hit check: d_check = (my.x - their.x)*their.facing < 0 → no hit regardless of body. Safe!). So dash_forward through a heavy (d ≤ 140, room behind them needed: landing x = their.x + f×60 must be in [40,960] — if not, I stop in front → get hit!). Also if their facing... they might release... no, they're committed to heavy (locked). So: opp heavy startup (or active!) && d ≤ 140 && ki ≥ 10 && roomBehind(opp) → dash_forward → land behind at tick 10, recover till 18, their heavy: if whiffed (I dodged) they're in recovery till ~35 → my light at 19 active 24-26 < 35 → counter 50 + combo ~200 total! 
  If no room behind them or no ki: dash_back if ki ≥ 10; else back-walk if d ≥ 115; else guard (eat crush 60 + 34 stun + their punish ~150 total — bad but survivable) — actually guard eat crush: 60 + they punish ~150 = 210. Vs trying to light interrupt (if their startup left ≥ 6: my light active 5-8 interrupts: I get 50 + combo 174+ = 224 and take 0!). Light interrupt FIRST option: opp heavy startup left ≥ 6 (i.e., t ≤ 3) && d ≤ 108 → light. Else dash_through. Else dash_back. Else back (if d ≥ 115 → escape to >140). Else guard.

  Order matters: check opp heavy before opp light (both states distinct).

Blast usage (my own offense at range):
- If opp charging && d > 140 && ki ≥ 20 && !blastOut && no incoming... blast → ×1.5 = 105 if they hold charge; they might guard (12) or dash. Also they might stop charging and blast back → blasts collide (neutral). EV: decent. Do it.
- If opp in long recovery far away (heavy whiff at d 200+): blast (70, counter ×1.25 = 87) or walk. They might be free by the time blast arrives. Eh — if their recovery left ≥ 11 + (d-40)/13 → guaranteed hit 87. blastOut check. Do it: opp recovery (any move) && left ≥ 12 + (d-40)/13 && d ≤ 400 → blast.
- Beam on big recovery: if their recovery is long (beam recovery 20, after clash recover 20, heavy 22): beam if ki ≥ 50 && left ≥ 30 + (d-40)/30 + margin: hit 280×1.25 = 350!! Beam during their heavy recovery at range: they're stuck ~22 — beam startup 30 → they're free before my fire → they guard (120) or... at d 300: front arrives at 30+8.7=39 > their free at ~22 → they're free at 22, they see my beam startup, they guard → 120 chip, or they dash_back/punish. Not guaranteed. Only if left ≥ 30 + travel: left ≥ 30 + (d-40)/30 → guaranteed 350. Heavy recovery 22 < 30 — only works point blank. Beam recovery 20, dash... rarely. Skip mostly; oki beam is the main beam.
- Beam on charging opp at range? They stop charging, guard → 120. Or they keep charging (dumb) → 280×1.5 = 420!! Bots that hold charge eat beams. Use beam if opp charging && ki ≥ 50 && d ≥ 250 (out of their interrupt range: they walk 4.5×24 = 108 → need d ≥ 110+108+ margin ≈ 230) → beam. They will likely guard → 120 chip. Acceptable? 50 ki → 120 guaranteed-ish chip. Meh but fine vs chargers. Actually better: blast (20 ki → 105 if held). Charger bots probably keep charging when blasted at (they don't react) → blast better ki-efficiency. Use blast for chargers, beam for oki. But if ki ≥ 70 (surplus), beam chargers too. Hmm, keep it simple: chargers get blasted; if no ki for blast (rare), walk in.

Let me also handle: opp in 'blockstun' — they're stunned (left): free punish: like hitstun. d ≤ 110 && left ≥ 6 → light (their combo counter: blockstun doesn't add combo; my light starts fresh combo 40, then chain!). Wait — blocked MY attack → THEY are in blockstun. So if they blocked my light, they're stunned 11, I'm recovering 12 — I can't act until free. If they blocked my blast: they're blockstunned 14, I'm in blast recovery 18 — nope. So opp blockstun windows: only reachable if I'm free and they're stunned from something else... they blocked my heavy → crushed actually. Blockstun 11-14 with me free — happens rarely (e.g., they blocked... nothing else causes opp blockstun while I'm free). Include for safety: same as hitstun rule.

Also opp 'recover' (post-clash winner recovery, 20 ticks): punish: like recovery: d ≤ 108 && left ≥ 6 → light; d ≤ 138 && left ≥ 12 → heavy. From range: they're free at 20 — walk in.

Clash push logic:
```
function clashPush(s):
  k = s.clash
  my = k.myPower + 0.6 (if I push) — but also pushing drains ki faster... myPower given is current (without push? It's power(m, me) at view time — includes their current push flag if set. My push flag from last decision shows in myPower? power(m, me) includes (f.push ? pushPower : 0) — my current push flag. Hmm, at clash start push=false. The view's myPower includes my push flag state. For decision: I want to compare prospective powers.
  Estimate: myKi, oppKi available in s.me.ki, s.opp.ki.
  myP = ki > 0 ? 1 + 0.02*ki + (push?0.6:0) : 0.5, + rage if hp < 300.
  If I push: myP += 0.6 (if ki > 0).
  oppP similar with their current... their push flag unknown — oppPower from clash state includes it. Use: oppP_est = k.oppPower (as given) — but if they're currently pushing and ki drains, it'll decay. Fine.
  push if (myP + 0.6 if ki>0) ≥ oppP - 0.05 → basically push unless opp much stronger.
  If (myP + 0.6) < oppP - 0.4: don't push (hopeless → drag toward 360 draw? but drift kills me first... whatever, don't push).
  Also: if ki very low (< 5) → power about to drop to 0.5 — pushing still adds 0.6 while ki > 0? power: ki > 0 ? base + ... + push : empty. Push flag with ki 0: empty (+rage). Drain 0.2 (push 0.8) — ki hits 0 fast.
  Simplify: push if myP + 0.6 ≥ oppP (with ki > 0), else if myP + 0.6 ≥ oppP - 0.35 push anyway (close fight, noise matters), else no push.
```

Ki edge: at clash start I might have ki ~50 → power 2.0. Opp similar → mutual push → stalemate until ki drains (50/0.8 = 62 ticks) → ki 0 → 0.5 both → drift by noise... could drag to 360 draw (both -120, down). Draws count half — meh. Fine.

Now, combo cancel logic:
```
function comboCancel(s):
  d = s.dist, ch = s.me.chain, ki = s.me.ki, oppHp = s.opp.hp
  # chain counts lights already in this string (state.me.chain). At cancel after 1st light, chain=1.
  if d ≤ 110 && ch < 4: return 'light'
  if d ≤ 140: return 'heavy'   # heavy hits during their hitstun; even at ch<4 fine
  if ki ≥ 20 && !s.me.blastOut: return 'blast'  # they're in hitstun 15; blast startup 11 → hits if travel ≤ ~4 ticks → d ≤ 40+13*4+... eh, d ≤ 150: travel (d-70)/13 ≤ 6 → hits at 17 > 15 — they're free → guard likely. Only if it would kill? Just do it if oppHp low.
  # finisher if it kills:
  return 'idle'  (let recovery finish)
```
Wait — damage check: after 4 lights (chain=4), heavy deals 120×combo[4]=0.45 → 54. If I stop at chain 3 + heavy: 120×0.55 = 66. Total light damage: L1..L4 = 40+32+26+22 = 120; 3 lights = 98; +heavy@0.55 = 66 → 164. 4 lights + heavy = 174. So 4L+H better by 10. OK.
Blast as combo ender at d > 140: blast 70×0.45 = 31.5 → 32 dmg if hits before they're free. Hitstun 15 from light; blast startup 11 + travel (d-40)/13 ≤ 4 → d ≤ 92?? but d > 140 → contradiction → they're free before blast arrives → they guard → 12 chip. Not worth ki. Skip; return idle (recover).
Hmm — but wait: if d > 140 after lights (they got pushed), can heavy still reach? d ≤ 140 → heavy. If d in (140, 150): nothing. idle.

Also mid-combo: if oppHp ≤ 54 and chain = 4 → heavy kills. If oppHp ≤ 22 → 4th light kills. Whatever, ordering handles: light while ch < 4 && d ≤ 110 (each light 22+ dmg at worst... if oppHp tiny, light still kills). Fine. Edge: oppHp ≤ 0 impossible (KO'd already).

One more consideration — the "counter" mult applies when target in startup/recovery. My combo lights after the first: opp in hitstun → not a move → mult 1... combo scaling dominates. Right.

Also first hit of combo: if I light an opponent in recovery → ×1.25: 50, then chain lights: combo[1] = 0.8 ×40 = 32... wait combo counter: they took crush? No. After my light hits (counter), o.combo++ → 1. Next light: combo[1] 0.8. So scaling same but first hit bigger. Good.

Now the "guard" default vs "idle": when in doubt at close range, guard is safe vs lights and blasts but loses to heavy (crush). Neutral: I'll guard when threats detected, idle otherwise (idle vs guard — guard blocks stuff; being caught idle vs blast = 70. Being caught guard vs heavy = 60+stun. Hmm. Random mix? Bots throwing heavies at neutral only when in range... I'll prefer guard when opp has ki and is close? Eh — keep guard for specific threats; default idle/forward.

Actually, hmm, important: what do I do when opp is free and I'm at d ~100 and THEY have shown light-heavy mixups? Can't solve everything. Keep it reasonable.

Let me also double check the 'light' cancel spawn: after my light HITS, cancel=true, decide called next tick with canCancel. If I return 'light': requires a.chain < 4 (chain counts... `a.chain = act === 'light' ? (chained ? a.chain+1 : 1) : a.chain`. First light (not chained): chain=1. Cancel light: chain=2... 4th light: chain=4. 5th light attempt: `act === 'light' && a.chain < R.light.chain` → chain < 4 → blocked → falls through to... `if (a.cancel) { a.cancel=false; if (...) start; return; }` → returns nothing → normal recovery continues. Good: so chain ≤ 4 lights per string; my rule ch < 4 → light (ch=4 → don't).

Also light reach: d ≤ 110 — at cancel time d includes the +14 push (push happens same tick as hit; cancel ask is next tick). So d ≤ 110 → light connects (opp frozen 15 ticks... my next light active at 5-8 relative — well within their 15 hitstun (they've used 1). Actually hitstun 15 starts at hit; my new light hits at +5..8 → hitstun remains 7-10 → OK. After 2nd light, hitstun resets to 15? Each hit: `stun(o, 'hitstun', M.hitstun)` → resets to 15. Yes.

Now blast interrupt: opp in blast startup (t < 11), d ≤ 108: my light active 5-8 → interrupts if their startup left ≥ 6 → no projectile. If their t ≥ 5 (left ≤ 6): projectile spawns in ≤ 6... my light hits at 5-8: if their spawn at ≤ 5 happens first — spawn at t=11: blasts pushed at `a.t === B.startup` — that's tick 11 of their state; if I interrupt before (their state changes to hitstun at my active tick), no spawn. My active 5-8 vs their remaining 11-t: if 11-t ≥ 6 (t ≤ 5): interrupt guaranteed (my hit at 5 ≤ their spawn 6+). If t = 6-7: my hit at 5 → their spawn at 11-6=5 — same tick? My hit lands in strikes() (step 3) before blasts() — land() changes their state → blast never spawns? blasts() checks `a.state === 'blast' && a.t === B.startup` — their state is now hitstun → no spawn. Good, t ≤ 7 → interrupt works if I decide NOW (my active at 5-8, their spawn at 11-t ≤ 4... hmm if t=7, spawn in 4 ticks < my active 5 → projectile spawns, then my light hits them during... blast recovery → counter ×1.25 50 + combo; projectile flies at me from their front — it spawned 40 ahead of them; I'm at d ~100 → projectile at 60 from me, eta 60/13 ≈ 5 → hits me at ~tick 5 — same time as my hit! I eat 70, they eat 50+combo. Trade-ish. Ugh. Let me only light-interrupt blast startup if their t ≤ 4 (spawn ≥ 7 ticks away → my hit at 5-8 beats spawn safely... if spawn at tick 7-8: my hits at 5,6 land first → they're in hitstun when blasts() checks spawn — no spawn. Safe. So condition: 11 - op.t ≥ 7 → op.t ≤ 4.)

Heavy interrupt on blast startup: heavy active 9-12 vs spawn 11-t: need 11-t ≥ 10 → t ≤ 1. Rarely. Light better.

Also opp beam startup interrupt: their startup 30, safe: light if 30 - t ≥ 7 (t ≤ 23) && d ≤ 108 → my active 5-8 all before their fire at 30-t ≥ 7 → guaranteed interrupt. Actually need my hit tick < their fire tick: hit at 5 < 30-t → t < 25. Use t ≤ 23 for margin. Heavy: active 9-12 < 30-t → t ≤ 17, d ≤ 138.

And opp dash recovery punish: covered.

Opp 'hitstun' from MY blast at range: I could follow with another blast? They're stunned 20; blast travels... if I blast again (no blastOut — the first hit them, gone): second blast: startup 11 + travel (d-40)/13 vs their stun 20-left... if d ≤ 40+13×8 ≈ 150: hits during stun. 70 more. But ki... blast spam vs stunned: fine at close-ish range. Covered by "opp hitstun → light/heavy if in range"; add blast if d in (140, 260] && their left ≥ 12 + (d-40)/13 && ki ≥ 20 && !blastOut → blast. Eh, include in recovery-blast rule (hitstun counts too).

Wait — actually, careful with the blast-follow on hitstun: if blast hits them in hitstun, no knockdown, stun resets 20. Fine, chip away.

Also important: don't blast when opp close (d ≤ 140) and free — they can dash through / punish. Only blast vs committed/stunned opps, or at range > 300 as poke vs approachers? Let me allow: blast if d ≥ 260 && opp in [forward, idle] && ki ≥ 40 (keep reserve for beam oki? beam needs 50; if ki ≥ 70: blast ok). Hmm: blast poke at 300: opp walking forward eats 70. Opp guarding eats 12 (bad trade). Track opp blocks... simplify: blast vs opp.state=='forward' && d ≥ 200 && ki ≥ 30. Approachers eat blasts. Vs guarders/campers, don't poke, just approach.

Cornered opp handling: if opp's back-wall < 60: they can't retreat → my lights can't whiff from backing... they can still dash_back (stays cornered mostly) or guard. So vs cornered: light pressure + heavy on guarders. Covered by generic rules (light vs idle/forward at d ≤ 105; heavy vs guarders).

Aggression check: I need to actually finish matches. Time limit 3600; if I'm passive, draws. HP lead at time = win. Let me make sure my bot approaches and deals damage. Default forward at d > 140. At close, light pressure. Good.

Draw risk: if both camp... my rules charge at d ≥ 300 until ki 55 then approach — fine.

Let me also think about whiff-punishing opp light at slightly-out-of-range: opp light whiffs at d ~115-125 (they threw from too far, or I backed). Their recovery 9-ish left. My punish: forward + light at next ask (6 ticks later: their left ~3 — too late!). Dash forward? 200 → overshoot behind them — their recovery 9, dash total 18 — they're free. Meh. So opp light whiffs mostly go unpunished unless I pre-move. Fine — the blockstun/-1 keeps it safe-ish.

What about my own approach whiffing into their lights: I walk forward; they light at d ≤ 110; my ask: at most 6 ticks later — I see opp light startup/active → guard (rule above). Their light startup 5: if my ask happens at their t=0-4, I guard in time; t=5-8 active — already hit me maybe. Unavoidable latency. Trades happen.

Also: what about my forward-walk into their heavy? They heavy when I approach (d ≤ 140, I'm in 'forward'). My ask ≤ 6 ticks later: see heavy startup (t ≤ 6, left ≥ 3): d ≤ 140... my escape: dash_back (ki ≥ 10) → safe. back-walk: d + 3×(9-t)... if t=6: +9 → d+9 ≥ 141 iff d ≥ 132. light-interrupt: need their left ≥ 6 → t ≤ 3. So: if I catch their heavy startup early (t ≤ 3, d ≤ 108): light interrupt. Else if ki ≥ 10: dash_back. Else back (if d ≥ 120). Else guard (eat crush). This is the "opp heavy startup" rule — already have it. Good.

Alright, also the initial engagement: match starts at d = 300, ki 30. I'll approach (d > 140 → forward). Opp same. We meet ~d 110-140. First asks... fine.

Special: opp at exactly minGap 60 rushing: if opp free and d = 60-105 and their state 'forward': light → they walk in → hit + combo. If they're 'idle': light (they might be about to act; 50/50 trade). OK.

Let me also consider guard default at d ≤ 140 when I have NO read and opp free with ki ≥ 10 and history of aggression... nah. Default: if opp free && d ≤ 105 && opp.state in [idle,forward]: light. If opp.state == 'charge': light if d ≤ 105 (×1.5 60 dmg + combo) — yes light, or heavy (d ≤ 135: 180!) — heavy better if they hold charge 2+ more ticks... they hold charge until their next ask (≤ 6 ticks, might be now). Heavy active 9-12: they have ~2-6 asks during — they'll likely release. Light active 5-8: 1-2 asks. Both can be dodged by release+back. Light safer (less recovery: 17 vs 35 whiff). If they release and guard: light blocked (fine), heavy → crush (good). If they release and back: both whiff, light less punishable. I'll light chargers at d ≤ 105; heavy chargers only if d in (105,135] (light can't reach)... they'd have to hold charge ~9 ticks — unlikely but bots do dumb things. OK.

Edge: heavying a charger at d 106-135: if they hold → 180 + knockdown. Include.

What about opp in 'guard' at range 141-400 (camping guard)? Approach; when close, they might light or keep guarding → crush them at d ≤ 115 (adaptive on guard-tendency). Also blast them? Guard → 12 chip, bad. Just walk in. At d ≤ 105 vs guard: if guardTendency high → heavy else light (blocked, +2 ki them). Hmm — light on guarder: blocked, they're pushed 14, I'm ~neutral, they gained 2 ki, 0 dmg. Pointless but harmless. Heavy on guarder: crush 60 + 34 stun + combo ≈ 234. Definitely heavy guarders — IF they hold guard. Risk: they release guard → my heavy at a free opp who can: light interrupt (if d ≤ 110 and their reaction t ≤ 3... my heavy startup 9: their ask within 6 → they see heavy startup at t 0-6; if their ask at t ≤ 3, light active 5-8 < my 9 → interrupt me 50 + combo ~200 on me!!). So heavying a guard-holder who react-lights = disaster. Adaptive: track how often my heavies get interrupted (I get hit during heavy startup → count). If heavyInterrupts ≥ 1, stop heavying guards (light instead / back off).

Track: when I'm in heavy and get hit — hard to detect from state... I can detect: I chose heavy, then next decision I'm in hitstun before my heavy should've finished? Simplest: set flag when I return 'heavy' at neutral; if next decision my state is 'hitstun'/'down' and time since < 35 → interrupted. Approximate: remember lastAction & tick; if my state in [hitstun, down, crushed] && lastAction=='heavy' && (s.t - lastTick) < 30 → heavyGotCountered++. If ≥ 1 → heavy ban at neutral (still allowed in combos/punishes where guaranteed).

Similarly track light whiffs: chose light at d ≤ 105, opp free; next ask: my state 'light' phase recovery, opp free and unhit → whiffed (opp not in hitstun and my light finished without cancel... hard to detect hit vs block: if it HIT, I got a cancel call (canCancel) — I can set a flag: at cancel I know it hit. Blocked: no cancel, opp in blockstun at my next ask (opp.state == 'blockstun')... my next ask after light recovery: opp would be free already (blockstun 11 < my recovery+ask-latency ~11-12). Hmm. Rough tracking: after light, next ask: if opp.state == 'hitstun' or I got cancel → hit. Else → blocked or whiffed. Can't distinguish well. Meh — keep light pressure regardless; only adapt heavies.

Guard tendency: count ticks opp spends in guard state at d ≤ 200: oppGuardTicks += ... each decision, if opp.state == 'guard': oppGuardTicks++. If oppGuardTicks > 20 → guarder → heavy them at d ≤ 115 (with heavy-ban check).

OK. Also handle rare states: opp 'blockstun' → treat like hitstun (punish if in range). opp 'crushed' → punish (light/heavy per range). opp 'down' → oki. opp 'ko' → idle (match over anyway). opp 'clash' → shouldn't happen without me in clash.

My beam handling when I'M beaming: not free → return idle. When my beam is out and opp... whatever, engine handles.

What about MY blast in flight + opp... no issue.

When opp is in 'recover' (post-clash, 20 ticks): treat like recovery: light if d ≤ 108 && left ≥ 7; heavy if d ≤ 138 && left ≥ 12; blast/beam if far && left ≥ 30+(d-40)/30 && ki ≥ 50 → beam 350. Rare.

Alright, what about opp knocked down NEAR me and I have no ki: charge (safe while down). Covered.

Also, subtle: after knockdown they fly back 120-150 (kb). Distance grows. During down 42-50 ticks: walk forward to stay ~100, charge meanwhile. My oki rule: downLeft ≥ 20 → if d > 90: forward... hmm charging gives more value: charge while they're down regardless of distance, THEN walk? If d is huge (400): walk during their 42 down: covers 42×4.5 = 189 — then charge after. Priority: if downLeft ≥ 25: if d ≥ 250: forward; else charge. If downLeft in [8, 24]: d > 110 ? forward : charge. If downLeft ≤ 7: guard (they wake; if close, prepare)... if d ≥ 130: charge still (they wake far, can't reach instantly). If d < 130: guard.
Wait — but wake options: they wake → neutral. Guard is my safe stance vs wake light; if they wake and back off, I forward-chase. OK.

Hmm, one more thing: beam oki when ki ≥ 50 && downLeft ≥ 31. But my beam startup 30: front spawns tick 30; they wake at downLeft ~31 → wake at my tick 31: they're free at 31, front spawns at 30 and travels; at tick 31 they decide (asked immediately) → guard (if smart) → chip 120 at tick ~32 (front at 70 ahead... front reaches them quickly if close). They eat chip 120 + blockstun till beam ends (fire 40 + ... blockstun = ctx.stun = startup+fire - a.t + 6 = 30+40-30+6 = 46 from hit → till my tick ~32+46 = 78 — beam recovery ends at 90. They're stunned till 78, I'm free at 90 — they wake... wait they're blockstunned, I'm in beam state till 90. After 90 both free. No punish window (78 < 90). Chip 120 + they lose nothing else. And I'm -50 ki for 120 guaranteed + knockdown chance if they don't guard (280 + down 50 → another oki!). Good move. If they dash on wake (invuln 9, dodge beam, land behind me if d ≤ 140 — d during oki usually > 140 after kb 120... they dash back/forward; beam still catches (front chases)... dash_back: invuln 9, then beam front hits them in recovery → 280. dash_forward: behind me → beam missed → they punish my beam recovery!? I'm in beam till 90 — stuck ~58 more ticks — they combo me fully ~200. Risk vs bots that wake-dash-through. Acceptable.

Now, IMPORTANT clash-avoidance: if I'm beaming (oki) and opp ALSO beams (wake beam? they're down...). They wake and beam: their startup 30 while my beam hits them during startup → 280 ×1.25 = 350 + interrupt. Their wake-beam loses hard. Fine.

What about BOTH of us beaming at neutral simultaneously → clash → coin-flippy (power by ki). My beam usage: oki (they're down, can't beam) and punishes. So clash mostly avoided. If I have 80 ki vs their 20, clash is GOOD for me (power 2.6+0.6 vs 1.4). Fine either way.

Let me now also double-check the dash-through-blast conditions:
- inc blast, eta ≤ 8, ki ≥ 10: dash_forward → dodge (invuln covers eta... during dash ticks 0-8 invuln; blast hits when eta reaches 0 — if eta ≤ 8 at decision, blast arrives within 8 ticks... but I'm also moving TOWARD it: closure 33/tick; blast "hits me" check each tick vs my position: |o.x - b.x| ≤ 30. If I dash forward, blast reaches my (moving) body sooner: roughly eta_now × 13/33 ≈ 0.4×eta. So eta ≤ 8 → contact at ≤ ~3.2 ticks → invuln (t < 9) → dodge. Even eta = 15 → contact at ~6 → invuln → dodge! Hmm interesting: dashing forward, contact time ≈ 13×eta/(13+20) ≈ 0.39×eta. Invuln 9 ticks → safe for eta ≤ 23!! But wait — what if the blast is slow to arrive because it's far, and I dash PAST it? I move 200 forward; blast at distance 13×eta: if 13×eta < 200+... I dash 200 toward it; blast position at contact... could I dash beyond the blast's... no — we approach each other, contact guaranteed before I stop (unless blast is behind... it's incoming, ahead of me). Contact at ~0.39×eta ≤ 9 for eta ≤ 23. After contact (dodge), blast continues behind me, harmless. After my dash ends (tick 10), blast is behind. SAFE. But — my landing: 200 closer to opp. Where's the opp? If they blasted from d = 300: they're at blast state; my landing at d-200 = 100 in front of them, in dash recovery (tick 10-18). Their blast state: they fired ~k ticks before... their recovery ends at 29 from fire-start; blast flight time to me was ~eta; contact at 0.39×eta after my dash start ≈ (300-40)/13 ≈ 20 ticks after spawn → they're free ~9 ticks by then... They see me land at 100 in front, in recovery till tick 18. They're free → they light/heavy me → I eat 50-150 + combo. DISASTER. So dash-through-blast only good if I land BEHIND them (d ≤ 140) or they're still committed when I'm free (rare). 
  Revised: dash-through-blast only when d ≤ 140 (lands behind them, they're in blast recovery ~free soon after — I computed earlier: I'm free at tick 18, their blast-recovery end at 26 - (d-70)/13 after dodge... for d ≤ 140: 26 - 5.4 = 20.6 → free at ~20 vs my 18 → I get them in recovery for 2 ticks — light needs active by 5-8 → nope, they're free. BUT I'm behind them facing their back! They recovered at ~20; when free they turn instantly (face(a,o) — only FREE fighters turn each tick; they turn the tick they're free). Hmm, so they turn and it's neutral at d=60 with me having just... I'm free at 18, they at ~20: I get first decision (asked when free) at 18, they at 20. I light at 18 → active 23-25 → they're free from 20, could guard at 21+ → blocked or traded. Meh — neutral-ish.
  Honestly dash-through-blast ≈ neutral outcome with style points; guard ≈ -12 chip +2 ki. Guard is fine and simpler. But wait — there's another consideration: if I guard every blast, blast-spamming opponents chip me slowly while I gain 2 ki per block and they spend 20. They go ki-broke, I accumulate ki → beam oki after their knockdown... I need knockdowns though. Ugh, passive-guard vs spammer = time-out draw-ish (they lose ki, I lose 12 hp/blast — actually I WIN on hp: 12 per blast vs their 20 ki... hp: I'm down 12 per blast. Over a match, if they land 30 blasts: -360 hp me. Hmm no — chip 12 per blocked blast is real damage. But they spend 600 ki = ~1700 ticks of charging. Time cost. Roughly even; my oki beams should outdamage.
  Dash-through when d ≤ 140 && eta ≤ 8 && ki ≥ 10: do it (dodge 0 dmg + slight positional edge). Also d ≤ 140 means they blasted point-blank — they're in recovery when I land behind → punish attempt. Fine.
  Actually also: if eta ≤ 8 and d ≤ 140 and ki < 10 → guard.
  If d > 140: guard (simple).

Hmm wait, one more option vs incoming blast: MY blast collides with theirs (blast_clash: both die). If I blast immediately (startup 11): my projectile spawns at 40 ahead, flies 13/tick; theirs incoming at 13: closure 26. If theirs is eta ≥ ~11+ (gap/26)... my blast spawns at tick 11; collision needs their blast still around: their gap at my spawn = 13×eta - 11×20... theirs approaches me 13/tick while I'm stationary during startup: gap shrinks 13/tick → at my tick 11: 13(eta-11). Collision when both flying: they meet after 13(eta-11)/26 = (eta-11)/2... their blast would hit me at eta — collision at 11 + (eta-11)/2 < eta iff eta > 11+... 11 + (eta-11)/2 ≤ eta - 0.5 (need collision before reaching me, considering body 30 margin ~2 ticks): roughly works when eta ≥ 13-ish? Let me not — guard is simpler. Skip counter-blast.

Alright — what about opp blast + they follow it in (blast → dash_forward)? Rare; skip.

Let me also make sure about MY beam safety: when I beam at oki or punish, could opp... they're down (oki) — safe. Punish-beam on long recovery — safe. Fine.

And MY blast safety: only vs committed/stunned/approaching-far. OK.

Now let me also think: should I EVER throw heavy at neutral d 106-140 when opp free not guarding? Whiff-punishable (recovery 22). Only vs opp in 'forward' maybe (they walk in: net movement toward me... they approach 4.5/tick; if they keep walking: d shrinks → heavy hits. If they stop/back at ask ≤ 6: +3×k... their options at 130: back 9 ticks = +27 → 157 whiff. So smart ones whiff-punish me. Simple forward-bots eat 120-150. Track: heavyGotCountered ban applies. Initially maybe allow at d ≤ 130 vs opp.state == 'forward'? If they're mid-forward (asked ≤ 5 ticks ago, they keep walking ≥ 1-5 more ticks): d at my active 9-12: d_now - 4.5×(walk remaining) + 3×(back after)... worst case d_now +27 - 4.5×0... Best case for me: they walk all 12: d_now - 54 → hit hard. Worst: d_now + 27 → 157 whiff. Average bots: walk 3, back 6 → d_now + 4.5... hmm at d_now = 130 → 134 ≤ 140 HIT. Coin flip-ish. I'll allow heavy vs forward-walkers at d ≤ 128, subject to heavy-ban. Actually you know, let me simplify: NO neutral heavies at free opponents except guarders (tendency) and forward-walkers at d ≤ 125. Subject to ban flag.

Timeout/robustness: wrap all in try/catch → return 'guard' on error. Keep per-call compute trivial. No loops over big data.

Persistent state (per match): 
```
let lastAct = null, lastT = -99, heavyFails = 0, oppGuardTicks = 0, oppChargeTicks = 0, chargeTicks=0...
```
Reset naturally per match (file reloaded). 

Let me also record: oppBehavior for wake: skip.

Also note: `decide` is called also when I'm NOT free? "你从出招、硬直、倒地这些状态恢复成空闲，下一个 tick 立刻调用你一次" — called when idle-capable. The engine `wants`: cancel OR (FREE or clash) && tick ≥ nextAsk. So when called, either canCancel or me.free. So `if (!me.free && !me.canCancel) return 'idle'` trivially. Fine.

Edge: 'recover' state (post-clash win) — not free → no calls. OK.

Now, blast vs approaching opp detail: opp.state == 'forward' && d ≥ 200 && d ≤ 450 && ki ≥ 30 && !blastOut && eta-none → blast. Their walk 4.5/tick; blast flight (d-40)/13; they might guard when asked (≤ 6). Bots that just walk forward eat 70. Ki ≥ 30 threshold keeps beam oki fund (50). Hmm — but oki beam is my best move; keep 50: blast only when ki ≥ 55? Let me say ki ≥ 55 for neutral blasts. Vs chargers/stunned: ki ≥ 20 (those are high-value: 105/87 dmg).

Now write the code.

```js
// AI 武道会 entry
let lastAct = null;      // last action I returned at a free/cancel decision
let lastT = -99;
let heavyFails = 0;      // times my heavy startup got interrupted
let oppGuard = 0;        // ticks opp spent guarding (sampled at my asks)
let oppCharge = 0;
let myChargeStart = 0;

function decide(s) {
  try { return brain(s); } catch (e) { return 'guard'; }
}

function brain(s) {
  const me = s.me, op = s.opp, R = RULES;
  const d = s.dist;
  const t = s.t;
  
  if (s.clash) {
    const k = s.clash;
    // prospective powers
    const myP = (me.ki > 0 ? 1 + 0.02 * me.ki : 0.5) + (me.hp < 300 ? 0.4 : 0);
    const opP = k.oppPower; // current, may include their push
    if (myP + 0.6 >= opP - 0.1) return 'push';
    if (myP + 0.6 >= opP - 0.45) return 'push'; // basically push unless hopeless
    return 'idle';
  }
```

Hmm wait: k.myPower already includes my current push flag and rage. myP computed fresh = k.myPower effectively (before push flag). Just use k.myPower: push if k.myPower + 0.6 ≥ k.oppPower - small. But careful: if I'm ALREADY pushing, k.myPower includes +0.6; adding again double counts. Track my pushing? Simpler: compute myP myself from ki (and whether k.myPower - computed suggests push flag on). Let me: base = ki>0?1+0.02ki:0.5; rage = hp<300?0.4:0; myP = base+rage; pushGain = me.ki > 0 ? 0.6 : 0. push if myP + pushGain ≥ k.oppPower - 0.05. And hopeless: if myP + pushGain < k.oppPower - 0.5 → don't push (drag). Between: push.

Wait, but also if I'm ALREADY pushing, my ki is draining 0.8/tick; the formula self-corrects each ask. And their oppPower includes their push flag. OK.

Also don't push if myP ≥ opP + 1.2 (dominant without pushing — save ki)? If I'm winning by a lot, not pushing preserves ki → power decays slower → keeps winning. Drift = 0.1×(pa-pb) per tick toward them — winning without push: fine, point reaches them eventually. Saving ki prolongs my advantage. So: if k.myPower ≥ k.oppPower + 0.5: don't push (already dominant). Else push. Unless near maxTicks (k.t > 300: push hard to finish before draw? If I'm dominant, point drifts anyway; fine).

Simplify: push iff (myP + pushGain ≥ oppP - 0.05) && (myP < oppP + 0.5).

Combo cancel:
```
  if (me.canCancel) {
    if (d <= 108 && me.chain < 4) return 'light';
    if (d <= 140) return 'heavy';
    return 'idle';
  }
```
Hmm — if oppHp very low, any works. Also if chain < 4 but d in (108, 140]: heavy (better than whiffing light). Covered.

Note: what if ki ≥ 50 and d ≤ 140 after 4 lights → beam? They're in hitstun 15; beam startup 30 → they're free at 15 → guard → 120 chip. vs heavy 54 dmg now. Heavy better. OK.

If d > 140 after lights: idle.

Not free:
```
  if (!me.free) return 'idle';
```

Track guard tendency: if (op.state === 'guard') oppGuard++;

Incoming blast:
```
  const inc = s.blasts.find(b => b.incoming && b.eta != null);
  if (inc) {
    if (inc.eta <= 9) {
      if (me.ki >= 10 && d <= 140 && op.state !== 'guard') return 'dash_forward'; // land behind, dodge
      return 'guard';
    }
    // eta > 9: don't start long moves; handle below but restrict
  }
```
Hmm wait — if eta > 9, I might still charge/approach; but must guard by eta ≤ 9. My next ask is ≤ 6 ticks later → eta ≥ 3 at next ask → can guard then. So for eta in (9, 15]: only allow short-safe actions (forward/back/guard/charge? charge is risky only if blast hits while charging — I'll guard before impact). Allow normal logic but avoid starting blast/beam (long commitment). Light is 17 ticks — if eta 10, light startup 5+active 3 → I'm in recovery till 17 while blast hits at 10 → 70×1.25=87 in recovery! Bad. So if inc && eta ≤ 20: restrict to guard/forward/back/charge... charge: at next ask (eta-6) guard. Safe. But careful: what if opp dashes in behind the blast? Guard handles blast; opp light hits me while guarding → blocked. OK.

So: `const blastSoon = inc && inc.eta <= 20;` → skip offensive commits; but the "opp committed" punishes might still be ok... e.g., opp in blast recovery at d ≤ 108 with their blast eta 12: my light: hits them at tick 5-8; their blast hits me at 12 during my recovery (87 dmg) — unless their blast... trade 50 vs 87 — bad-ish. Just guard/evade. Simplify: if blastSoon → guard if eta ≤ 14, else forward/charge per neutral. Hmm eta 15-20 with next ask in ≤6 → eta ≥ 9 at next ask → then guard rule (eta ≤ 9 → guard). OK so eta 15-20: free play but no long commits. Let me define:

```
  if (inc) {
    if (inc.eta <= 9) {
      if (me.ki >= 10 && d <= 140 && d >= 70 && op.state === 'blast') return 'dash_forward';
      return 'guard';
    }
    if (inc.eta <= 15) return 'guard'; // simple
    // eta > 15: fall through but remember: no beam/blast starts (they'd eat the incoming)
  }
  const noCommit = !!inc; // no blast/beam while one is incoming
```
Wait eta 10-15 guard is overly passive but SAFE and simple. A blast takes (d-40)/13 ticks; opp firing from 300: eta ~20. I'd guard from eta 15 → ~5-8 ticks of guard per blast. Fine, keep it simple: eta ≤ 15 → guard (or dash-through if close). Actually eta ≤ 9 guard is enough; eta 10-15: do neutral short actions... complexity. Compromise: eta ≤ 12 → guard; 13-20: allow forward/back/charge/light? Light at eta 13: my active 5-8, their blast hits at 13 → I'm in light recovery (9 left) → 87. Bad. So no strikes either. Neutral non-committed only (forward/back/guard/charge/idle). Then at eta ≤ 9 (or ≤ 12) → guard. So:

```
  let neutralOnly = false;
  if (inc) {
    if (inc.eta <= 12) {
      if (me.ki >= 10 && d <= 140 && op.state === 'blast' && op.phase !== 'startup') return 'dash_forward';
      return 'guard';
    }
    neutralOnly = true; // no strikes/moves until it's handled
  }
```
Dash-through condition: opp still in blast state (they fired recently — op.state === 'blast'); if they're free, landing behind them is unsafe-ish (they turn... actually if they're FREE and I dash behind: they get asked immediately, turn, and I'm in recovery — they punish. So require op.state === 'blast'). Also require d ≥ 70 (don't dash if already point blank? d ≤ 140 && d ≥ 70 → dash lands behind them (pass-through requires after ≤ -60 → d ≤ 140 ✓). At d < 70... can't be < 60; d 60-70: dash 200 → way behind → fine too actually. The pass-through condition: d ≤ 140 → land behind. But ALSO room behind them: their back-wall ≥ 60. Compute: oppBackWall = opFacing direction... opp faces me; behind them = away from me. From my view: my facing = toward opp. oppBehindRoom = (my facing == 1) ? (960 - op.x) : (op.x - 40). If < 65 → they stop in front → I eat blast? If I stop in front at 60 and blast incoming... blast hits me in dash recovery — 70×1.25... invuln ends tick 9; blast was dodged?? Wait if I stop in FRONT of opp, the blast... the blast already passed me (dodged at tick ~2-4). It's flying behind me now — harmless! Landing in front of opp at 60: they're in blast recovery → I punish THEM (my recovery 18 vs theirs ~26-(d-70)/13... earlier computed for d<174 I have a small window. d=100: window ~5 ticks, light active at 5-8 → their recovery ends at my tick ~5 — marginal whiff risk. Hmm. But safe from the blast regardless. So dash-through is SAFE vs blast regardless of landing spot (blast already passed). The only question is whether I get punish. Let me just: eta ≤ 12 && ki ≥ 10 && d ≤ 140 && op.state === 'blast' → dash_forward. Else guard.
Actually wait, ALSO check: dashing forward when the blast hasn't passed me yet and I stop in front of opp who is FREE (op.state !== 'blast')... they turn and punish. So keep op.state === 'blast' requirement. ✓.

Also opp beaming (state 'beam') with my dash... separate beam rules below take priority over blast rules? If opp beam AND blast incoming? Can't both — one blast each, beam separate... opp can't blast and beam simultaneously. If MY... inc is opp's blast; opp.state === 'beam' impossible while their blast flies? They fired blast earlier (blast still flying), recovered, then started beam! Possible! Then: beam handling should dominate. Order: beam rules BEFORE blast rules. Let me order: clash → cancel → free check → BEAM threat → blast threat → punishes → oki/down → neutral.

Beam threat (op.state === 'beam'):
```
  if (op.state === 'beam') {
    const ph = op.phase;
    if (ph === 'startup') {
      const suLeft = 30 - op.t;
      if (d <= 106 && suLeft >= 7) return 'light';
      if (d <= 136 && suLeft >= 13) return 'heavy';
      if (d <= 140 && me.ki >= 10 && suLeft >= 12 && behindRoom(s)) return 'dash_forward';
      // walk-in interrupt
      if (suLeft >= 16 && d <= 100 + 4.5 * (suLeft - 14)) return 'forward';
      return 'guard';
    }
    // firing: dodge through if close, else guard
    if (ph === 'firing') {
      if (me.ki >= 10 && d <= 118 && behindRoom(s)) return 'dash_forward';
      return 'guard';
    }
    // recovery: free punish window
    if (op.left >= 7 && d <= 106) return 'light';
    if (op.left >= 13 && d <= 136) return 'heavy';
    if (op.left >= 15 && d <= 110 + 4.5*(op.left-13)) return 'forward';
    return 'guard';
  }
```
behindRoom: room behind opp ≥ 65: `const away = me.facing; const oppBack = away > 0 ? 960 - op.x : op.x - 40; return oppBack >= 65;` — behind them means further from me: if I'm left of opp (facing 1), behind them = right = 960 - op.x. ✓. Also need MY dash to actually pass: pass-through needs after ≤ -60: d ≤ 140 ✓ (d ≤ 140 given).

Wait, dash vs beam startup: suLeft ≥ 12: I land at tick 10 (behind), they fire at ≥ 12 → safe. During ticks 1-9 invuln anyway; tick 10-11 I'm landed behind (not invuln but behind → beam fires forward, ray from their front — I'm behind their x → inRay checks my x ± 30 vs [from, front]: from = opp.x + facing×25 — facing toward original direction (toward where I was). I'm at opp.x + 60 in that direction?? NO WAIT. I dashed forward THROUGH them: I'm now on their FAR side. Their facing: toward me originally = toward my original position. I'm now BEHIND them = opposite side of their facing. Ray goes along their facing. My x is behind → inRay false. ✓ Safe. But subtle: ray from = opp.x + facing×25; my body pad 30: I'm at opp.x - facing×60 → |Δ|=60 > 25+30=55 → outside. ✓.

Also — during their startup, my dash: invuln irrelevant (no attacks yet). ✓. After landing, I'm in dash recovery till 18, free at 18; their startup ends at ≥ 12 → they FIRE (if suLeft was ≥ 12, they fire at 12+ — beam fires forward, misses me) and they're stuck firing 40 + recovery 20 = till 72+. I'm free at 18 → walk to them (they're 60 away... I'm behind them; they're at fixed x; d=60) → light at ~19: active 24-26 → they're in beam firing → mult: beam phase 'firing' — not startup/recovery → ×1... wait MOVES.has('beam') && (p === startup || recovery) → firing → no counter. Fine: light 40 + combo: L2 (d 74 ≤ 108) 32, L3 26, L4 22 (d 102 ok), heavy 54 (d 116 ≤ 136) → 174 + they eat it all stuck in beam. 

vs beam firing (ph === 'firing'): d ≤ 118 dash-through: front already out maybe past me? Beam ray covers from shooter to front — front moves 30/tick; if firing started, front is expanding. If I'm at d=118, front reaches me at (118-40)/30 ≈ 2.6 ticks after fire-start — if I see 'firing', front may already be AT/past me → I'm in ray → hit next tick unless invuln! My dash: invuln ticks 0-8; I need to exit the ray (get behind) before tick 9. Ray exit: pass opp.x + 55f: my travel: 20/tick; need (d + 55)/20 ≤ 9 → d ≤ 125. But if the front has already passed me, I'm inside ray from tick 0: invuln 0-8 covers; at tick 9 I'm at 180f → position: d+180-55 = d+125 > 0 past their back edge... at tick 9: my x moved 180; ray's near edge at opp.x+25f; I'm at me.x+180f = d+180 from... relative to opp: 180 - d... wait I move TOWARD opp: my x: start + 20×9 = +180f. Relative to opp.x: my offset = -(d) + 180 → I'm at (180 - d) on the far side if positive. Ray edge at +25. Need 180 - d ≥ 25 + 30 = 55 → d ≤ 125. ✓ d ≤ 118. So dash-through vs firing beam works if d ≤ ~120. At tick 10 I land behind (d ≤ 140 pass-through ✓). Safe.

If d > 120 vs firing beam: guard (chip 120, blockstun till end). Could also dash_back? Front chases 30 vs 20 → catches after invuln → hit 280. Guard better. ✓ guard.

vs beam recovery: ray gone (beams nulled when a.t ≥ startup+fire or state != beam... beams(a.side) = null when t ≥ 70 → recovery no ray). Punish. ✓.

Also their beam FIRING while I'm far (d > 120): guard. Their beam will hit me (ray extends 1200) — chip 120 — unless I... could I dash_back and outlast? Fire 40 ticks: front travels 1200 then beam OVER? Ray covers from to front — front stops at stage edge +40 clamp... front clamped at 1000 (stage.right+40). If I'm at the far end and opp shoots from other end: front takes ~32 ticks to cross; ray persists till fire ends (40) + then null. I could stand at max distance: still in ray eventually (ray spans whole stage). Guard → 120. Or dash_back timed so front passes me during invuln 9 ticks: front speed 30, my dash_back 20/tick: closure 10/tick — front needs 90+ ticks... invuln only 9 → passes 90 of distance during invuln. If front is 80 away (eta 2.7 at closure 30), with my dash: front catches me at 30-10=... front relative speed vs me = 30 - (-20)... I move away at 20: closure 10/tick → contact at eta×30/10 = 3×eta ticks. Invuln 9 → contact within 9 → eta ≤ 3. But after passing me, front stops? Front continues (clamped at edge) — ray still covers me (I'm between shooter and front) → at invuln end (tick 9), I'm inside ray → HIT 280×?? in dash recovery → 350!! Unless I've dashed BEYOND the front?? Front is AHEAD of me moving same direction at 30 vs my 20 — can't outrun. UNLESS front got clamped at stage edge: if opp near their... hmm if I'm near MY back wall and opp far: front will clamp at my back edge (stage.right+40 relative...). If I dash_back 200 and my wallBehind < 200+... I end near wall; front clamps at wall+40; ray covers me → hit after invuln. So no escape by dashing back UNLESS beam expires (fire ends at 40 ticks) before front reaches me AND ray... ray persists while firing (front frozen at clamp? front keeps moving till clamp; ray = from→front; if front clamps at edge before reaching me?? front clamps at stage edge — if I'm INSIDE stage, front reaches me before clamp. No escape. GUARD. ✓.

Edge: what if I have ki ≥ 50 and opp beam FIRING and I'm FAR (d > 300)? Their beam occupies them for 40+20 more; my beam startup 30 → my beam fires while they're firing/committed → MY beam travels freely (no clash possible — their beam is a ray, mine a ray: clash when fronts cross — both beams exist → FRONT CROSS → CLASH! (b0 && b1, dirs opposite, b0.front vs b1.front crossing). If I beam into their firing beam: clash! Clash power by ki. If my ki >> theirs... they spent 50 already. Hmm — clash is a gamble; 320 swing. If my ki ≥ 60 (power 2.2+) and theirs (post-50-spend) maybe low: counter-beam could WIN the clash → 320 + knockdown. But their oppPower at clash: their current ki after spending 50. If I have 90 ki → 2.8+0.6 vs their maybe 1.4 → I win big. When is opp ki low? Track... I see op.ki each ask! Condition: my ki ≥ 50 && my ki - op.ki ≥ 35 && d > 120 (can't dash) && opp beam firing → 'beam' → clash → win → 320. Else guard.
Wait — timing: my beam startup 30; their fire 40: if their fire started t=20 (20 left) + recovery 20: my beam spawns at my 30 = their t+30 = 50 → they're in RECOVERY (t ≥ 70? no: their t goes 20+30 = 50 < 70 → still FIRING) → both beams out at my tick 30 → clash ✓. Their beam ends at their t=70 = my tick 50. My beam fires from my tick 30 to 70. Clash from my tick ~30+travel... fronts: their front at their t=20: 20×30=600 ahead (clamped maybe). Hmm — if their front already PASSED the middle... clash condition: (b0.front - b1.front)*b0.dir >= 0 — fronts crossing. My front spawns at my x+40 and moves 30; their front might be clamped at edge (stationary) → my front reaches their front → crossing → clash ✓. But WAIT: their ray covers me meanwhile — during MY startup (30 ticks), their ray hits me (I'm standing in it!) — I get hit during my beam startup → interrupted + 280×1.25=350!!! FATAL. So counter-beam only if their ray does NOT reach me during my 30-tick startup: their front reaches me at (d-40)/30 after their fire start; my beam starts at ~their firestart + reaction (0-6) ... I observe 'firing' at my next ask: their t could be 0-6 (if I catch the transition) or more. My startup ends at my t+30; their front reaches me at (d-40)/30. Safe if (d-40)/30 ≥ 30 + (their t) → d ≥ 40 + 30×(30 + t). For t=0: d ≥ 940 — never. IMPOSSIBLE. So NEVER counter-beam a firing beam. Right — ray covers everything fast. Scrap that. Guard it is. (Or dash-through if close ✓.)

OK. Punish section (opp committed):

```
  // opponent locked in a move: punish recovery/startup
  const opFreeStates = ['idle','forward','back','guard','charge'];
  
  if (op.state === 'crushed') {
    if (d <= 106) return 'light';
    if (d <= 130) return 'heavy';  // crush stun 34 — heavy lands (active 9-12, they're stunned way longer)
    return 'forward';
  }
```
Hmm wait: heavy on crushed: they're stunned 34 from crush moment; by the time I see 'crushed' + decide + heavy startup 9 + active — crush might expire. Crush happened at most... I see op.state='crushed' with op.left = remaining stun. Use op.left: heavy needs op.left ≥ 13 at my decision (active 9-12 within their stun): `if (d <= 136 && op.left >= 13) heavy; elif d <= 106 && op.left >= 7 light; else if op.left >= 16 && d <= 110 + 4.5*(op.left-14) forward`. Crushed gives no counter mult (not a MOVE) but full damage + knockdown, then oki. Good. Light on crushed → cancel combo → more damage. Prefer light if in range (combo value 174 > heavy 120): d ≤ 106 → light (left ≥ 7). Else heavy. ✓.

```
  if (op.state === 'hitstun' || op.state === 'blockstun') {
    if (op.left >= 7 && d <= 106) return 'light';
    if (op.left >= 13 && d <= 136) return 'heavy';
    if (op.left >= 16 && d <= 110 + 4.5 * (op.left - 14) && d > 136) return 'forward';
  }
```
blockstun: light blocked→ their blockstun 11 — but if THEY blocked MY light, I'm in recovery... I can only be free if... whatever, harmless.

Hmm wait, careful with 'blockstun': if they blocked my heavy → they'd be 'crushed' not blockstun. Blockstun arises from blocking blasts (14) / beams. If they blocked MY blast: they're stunned 14, I'm in blast recovery 18 — I'm not free. If they blocked MY beam... beam blocked → I'm beaming. So opp blockstun while I'm free: they blocked... nothing of mine? Impossible? Maybe my beam expired exactly... skip — keep rule anyway (harmless).

hitstun: from MY hits — I'm usually busy. Free + opp hitstun: e.g., my blast hit them at range and I walked in? Or their own... they can't be in hitstun without me hitting them. My blast hit → I'm in blast recovery until 18... blast hits opponent at (d-40)/13 after spawn = 11 + travel; my recovery ends at 29. If d large, blast hits AFTER my recovery → I'm free, opp in hitstun 20 → walk in + light. ✓ rule good. Also my beam knockdown... that's 'down'.

```
  // opp in a move
  if (op.state === 'light') {
    if (op.phase === 'startup' || op.phase === 'active') {
      if (d <= 115) return 'guard';   // block free
      // else out of range, whiff punish: their recovery 9
    }
    if (op.phase === 'recovery' && op.left >= 7 && d <= 106) return 'light';
    if (op.phase === 'recovery' && op.left >= 13 && d <= 136) return 'heavy';
  }
```
Guard vs their light: blocks (0 chip, +2 ki, push them 14, they're -1). But careful: if they're at d ≤ 115 and I guard, fine. What if d ≤ 106 — could light-trade instead? Trade = I eat 40 + their possible combo (they get cancel → 174!). My guard = 0 dmg. Guard strictly better. ✓. But latency: their light may already hit me — can't help.

Whiff punish: their light whiffs (d > 110): recovery ~9; my light needs d ≤ 106 NOW — d > 110 → can't. Walk forward? 6 ticks → d - 27, their recovery left ~3 → no. Skip.

```
  if (op.state === 'heavy') {
    if (op.phase === 'startup') {
      const suLeft = 9 - op.t;
      if (d <= 106 && suLeft >= 7) return 'light';  // interrupt
      if (me.ki >= 10 && d <= 140 && behindRoom(s)) return 'dash_forward';  // phase through
      if (me.ki >= 10) return 'dash_back';
      if (d >= 118) return 'back';
      return 'guard'; // eat crush, better than nothing
    }
    // active: committed; if I'm not in range, prep punish
    if (d <= 106 && ??? ) // active lasts 4; interrupting now: my light active 5-8 → their active over (9-12) → they're in recovery → trade? their heavy active 9-12 vs my light 5+... if their active NOW (t 9-12), my light hits at their t+5..8 = 14-20 → they're in recovery → I hit counter 50; their heavy already missed me? Only if d > 140 — else their heavy HITS me at t 9-12 BEFORE my light (5-8 later)... wait my light active at MY t 5-8 = their t (current) + 5-8; their active continues to their t 12 → if their t ≤ 7 and d ≤ 140 → they hit me first (120!). If their t ≥ 9... they're done at 12; my light hits at their t+5 ≥ 14 → recovery → counter 50 ✓ and I dodged nothing — I just stood there while their active... if d ≤ 140 and their t ∈ [9,12]: their heavy hits me NOW (this tick, before my decision?) — strikes() already ran this tick. Decisions happen BEFORE strikes (step 1 then 3). So at my decision, their active ticks remaining: t=9: active window 9,10,11,12 → they hit at THIS tick's strikes — I'M HIT regardless of my choice (unless I was already guarding/dashing — I'm free, walking... if I was in guard state already, blocked... I'm deciding now: whatever I return applies this tick — strikes run AFTER choose! `choose` sets my state this tick → if I return 'guard', does this tick's strike get blocked? Sequence: views/acts → choose (state := guard) → move → strikes → my state is 'guard' → BLOCKED ✓!! So: opp heavy active && d ≤ 140 → return 'guard' NOW → crush (60 + 34) — better than 120 + knockdown + their oki. Actually could I dash? dash starts this tick, t=0 < 9 invuln → strikes: invuln → dodge!! DASH DODGES the active heavy if ki ≥ 10!! `invuln = dash && t < 9` — state set this tick, t=0 → DODGE. dash_back preferred (get away, then whiff-punish their recovery 22). Or dash_forward through (if behindRoom): land behind at 10, their recovery till 35, my free at 18, light active 24-26 < 35 → counter 50 + combo!! dash_forward best (if room + d ≤ 140). Else dash_back. Else guard.
    if (op.phase === 'active') {
      if (d <= 140) {
        if (me.ki >= 10 && behindRoom(s) && d <= 140) return 'dash_forward';
        if (me.ki >= 10) return 'dash_back';
        return 'guard';
      }
      // d > 140: their heavy whiffs; prep punish
    }
    if (op.phase === 'recovery') {
      if (op.left >= 7 && d <= 106) return 'light';
      if (op.left >= 13 && d <= 136) return 'heavy';
      if (op.left >= 16 && d <= 110 + 4.5*(op.left-14)) return 'forward';
    }
  }
```
Wait — opp heavy active at d ≤ 140: I'm already being hit THIS tick? strikes() runs after my choice — the hit lands this tick on my NEW state. So dash → dodge this tick ✓✓. Great: dash_forward through active heavy (invuln) → punish. Excellent.

Hmm, but careful: their heavy active window is 4 ticks; I might be asked when their heavy is at t=13 (recovery). Fine.

Also — opp heavy STARTUP with d ≤ 106 && suLeft ≥ 7 → light interrupt. suLeft ≥ 7 means their active starts at ≥ 7 → my active 5-8 hits first ✓. If suLeft < 7 (their active imminent) → dash options. ✓.

```
  if (op.state === 'blast') {
    if (op.phase === 'startup' && op.t <= 4 && d <= 106) return 'light';  // interrupt before projectile
    // their projectile will spawn (or already out) — blast rules handle if incoming; if not incoming (they fired AWAY?? no, always at me) 
    if (op.phase === 'recovery') {
      if (op.left >= 7 && d <= 106) return 'light';
      if (op.left >= 13 && d <= 136) return 'heavy';
      if (op.left >= 16 && d <= 110 + 4.5 * (op.left - 14)) return 'forward';
    }
    if (op.phase === 'startup' && d > 106 && me.ki >= 10 && d <= 300) return 'forward'; // close distance; they're locked 11+18
    return 'guard';
  }
```
Hmm, their blast startup, no interrupt possible (d > 106): they're locked for 29 - t ticks. Approaching is good (they can't respond); but their projectile spawns in 11-t and flies at me — I'll be in 'forward' when it comes — handled next asks (blast incoming rules; I ask within 6; eta at spawn = (d-70)/13; guard in time ✓). So 'forward' vs blast startup OK. But careful if their blast is coming AND I'm closing: eta shrinks 13+4.5... fine, guard at eta ≤ 12.

Wait — order problem: the incoming-blast check happens BEFORE these opp-state checks (I placed blast threat before punishes). If their blast is in flight at eta ≤ 12 → I return guard, missing the punish window of their recovery. Their blast recovery: when projectile is in flight, they're likely already in recovery or free. The guard is more important (70 dmg vs punish ~50). But if eta is large (they fired from far), recovery punishes don't apply (d large). OK ordering: blast-threat first is fine. Actually reconsider: their blast in flight, eta 25, they're in recovery at d = 150: I could walk in and punish recovery... my rules: eta > 12 → falls through to opp-state rules → recovery rule: op.left ≥ 16 && d ≤ 110+4.5×(left-14) → forward. ✓ good. Then eta ≤ 12 → guard takes over. 

```
  if (op.state === 'dash') {
    // punish landing
    if (op.phase === 'recovery' && op.left >= 7 && d <= 106) return 'light';
    const movingLeft = op.phase === 'moving' ? 10 - op.t : -1;
    // they're dashing toward me? landing spot: if current d > 140 → lands in front
    if (op.phase === 'moving' && movingLeft <= 5 && d > 145) return 'light'; // catches their recovery
    if (op.phase === 'moving' && movingLeft <= 5 && d >= 70 && d <= 145) {
      // may land behind me: just wait/guard
      return 'guard';
    }
    return 'guard';
  }
```
Hmm — dash toward me at d ≤ 140+... they land behind me (if I have back-room) or in front. If behind: they're in recovery 8, facing wrong way; I turn (free); their recovery ends before my light lands (next ask ≤ 6 + startup 5 = 11 > 8). So no punish — neutral at 60. Guard meanwhile (they could... they're in recovery, can't attack). 'idle' fine too. Guard is safe in case... whatever, 'guard'.
Wait — but if they land behind me and I'm guarding, facing? I auto-face when free — face them ✓ guard front ✓.
If movingLeft > 5: they're still coming; guard (or prepare light timing — my next ask ≤ 6 → movingLeft ≤ 11-6... at next ask movingLeft could be ≤ 5 → then light). Return 'guard' now, light next ask if conditions. But careful — light requires their landing in front (d > 145). If d ≤ 145 they land behind → no light, guard. ✓. Also dash AWAY from me (dash_back): their x moves away; d grows; landing... op moving away: d increases → my light won't reach... The condition d > 145 && movingLeft ≤ 5 — if they're dashing AWAY, d is increasing, landing at d+200 → my light at 5-8 hits if d+... their final d... my light reach 110 — only if d_after ≤ 110 → they dashed away → no. How do I know direction? op moving toward or away: I know op.x and my x — track last op.x? I have history (persist between calls): lastOpX. If op.x moving toward me (|d| shrinking)... simpler: dash direction: if they dash_back, d increases between asks. Track prevD. If d < prevD - 5 → approaching. Light-timing only if approaching. Also their dash could be dash_forward from far (d 500 → lands at 300) — then d > 145 ✓ but they're... movingLeft ≤ 5 && d > 145: they land at d-200 ≥ ... if d = 500: land at 300 → my light reach 110 → whiff!! OOPS. Condition must be: landing distance ≤ ~106: landing d_final = max(d - 200, 60) if approaching... d_final ≈ d - 200 (if d ≥ 260) or 60 (if 140 < d < 260). Light reaches 110: need d_final ≤ 106 → d ≤ 306 (or d < 260 → 60 ✓). So: approaching dash && movingLeft ≤ 5 && d ≤ 306 && d > 145 → light. Hmm but also d - 200 between... if d ∈ (145, 260): d_final = 60 ✓. d ∈ (260, 306): d_final ∈ (60, 106) ✓. d > 306: too far. ✓.

Also opp dash_back at close range (retreating): let them; chase with forward.

```
  if (op.state === 'recover') { // post-clash
    if (op.left >= 7 && d <= 106) return 'light';
    if (op.left >= 13 && d <= 136) return 'heavy';
    if (op.left >= 15 && d <= 110 + 4.5 * (op.left - 14)) return 'forward';
  }
```

Opp charging:
```
  if (op.state === 'charge') {
    if (d <= 100) return 'light';
    if (d <= 132) return (heavyFails < 2 ? 'heavy' : 'forward');
    return 'forward';
  }
```
Wait — opp charge, d ≤ 132, heavy: 120×1.5 = 180 + knockdown if they hold charge 9+ ticks. They get asked ≤ 6 — most bots stop... but simple chargers hold. heavyFails guard. Hmm — heavy whiff here punished hard. Let me require ALSO that they've been charging a while (they started ≥ 2 ticks ago → they're holding): op.t ≥ 2. If op.t ≤ 1, they just started — might release instantly. With op.t ≥ 2 and next ask ≤ 4... ugh, unknowable. Accept: heavy if op.t ≥ 1 && d ≤ 130 && heavyFails === 0; light if d ≤ 100. Hmm, light on charger at d ≤ 100: 60 + combo — safer (17 vs 35 whiff recovery). But heavy 180 vs light-combo ~174+60... light combo total: 60+32+26+22+54 = 194! Light combo beats single heavy (180). And much safer. So: d ≤ 100 → light (combo 194). d ∈ (100, 132] → heavy (180, riskier) if heavyFails === 0, else forward. OK.

Opp down (oki) — placed BEFORE charge/neutral:
```
  if (op.state === 'down') {
    const dl = op.left;
    if (me.ki >= 50 && dl >= 32) return 'beam';
    if (dl >= 25) { if (d >= 260) return 'forward'; return (me.ki < 95 ? 'charge' : 'guard'); }
    if (dl >= 8) { if (d > 112) return (me.ki < 95 ? 'charge' : 'forward'); return 'guard'; }
    // wake imminent
    if (d >= 140) return (me.ki < 95 ? 'charge' : 'idle');
    if (d <= 106 && dl <= 6 && dl >= 2) return 'light';  // timed to hit on wake... 
    return 'guard';
  }
```
Hmm the wake light: they wake at dl; my light active at 5-8 → hits at wake + (5-8-dl) ∈ [-1, +6] after wake. If hits right at wake tick... they were free 0-6 ticks → maybe guarded. If they eat it → combo. Risk: they wake and heavy MY light startup?? Their options on wake: guard/light/heavy/dash. If they heavy (9 startup) vs my light (5): I hit first → interrupt ✓ good. If they light: trade-ish, mine first (I'm at 5, they start at 0-ish... their light active at their 5+; mine hits at 5-8 — roughly simultaneous → trade, both 40, both get cancels. Meh. If they guard: blocked, neutral. If they dash: dodge. Overall fine-ish EV. But it's risky when they wake into a whiff... keep it, gated dl ∈ [2,6] && d ≤ 106.
Hmm — wait, danger: my light at dl=6: active at 5-8 → their wake at 6 → hits at wake+0..2 → they were asked at wake (free → nextAsk = wake tick... their ask happens the tick they're free: "站起来以后立刻轮到他做决定" — they get asked the tick after down ends... their guard decision happens the tick they wake (or next). If they guard at wake tick, my hit at wake+0 (my active tick 6... my active at my t 5,6,7 = their wake+(-1..1)... marginal. Keep rule but require dl ≤ 5 && dl ≥ 2 → hit at wake+0..3 hmm same. Honestly keep d ≤ 106 && dl ≤ 6 && dl ≥ 2 → light. Fine.

Also — while opp down and I'm at d ≤ 112 with dl ≥ 8: I return guard — but if I'm FAR (d > 112): charge. Charging at d > 112: they wake, walk toward me... I see them approach (asks) → switch to neutral play. Safe ✓. Charging at d ≤ 112 when dl ≥ 8: they wake and light — my ask at wake-... I charge now; next ask ≤ 6 → if dl ≥ 8 → at next ask dl ≥ 2 → guard. They wake at dl 2, light startup 5 → hits at wake+5; I guard from next ask (dl ≥ 2 → guard) → blocked ✓. OK safe-ish. Edge: dl = 8, my next ask at dl = 2 → guard before their wake-light connects (their light active at wake+5 = dl -5). ✓.

Neutral (opp free: idle/forward/back/guard/charge — charge handled above):

Order: opp charge handled. Then:

```
  // opp free neutral
  const opFree = op.free; // idle, forward, back, guard (charge handled)
  
  if (op.state === 'guard') {
    // crush happy guarders
    if (d <= 112 && heavyFails === 0 && oppGuard >= 3) return 'heavy';
    if (d <= 112 && oppGuard >= 3) return 'light'; // blocked, but pressure... meh
    if (d > 112) return 'forward';
    return 'forward'; // walk closer? but then they light me... d ≤ 112 → hmm
  }
```
Hmm wait — opp guarding at d ≤ 112: options: heavy (crush 60+34+combo ~234 if they hold), light (blocked, +2 ki them, push 14 → they're at 126 — spacing out). If they're guarding and I do nothing, they hold position. oppGuard counter ≥ 3 means they guard a lot. If heavyFails > 0, they're reactive → light or wait. Light at a guarder is chip-free for them, +2 ki them, pushed away — mildly bad for me but keeps pressure... Actually blocked light: blockstun 11 for them, they're pushed to 126, I'm -1 → they're in blockstun, free at 11, I'm free at ~12-13. Then they might light (d 126 → walk + light)... neutral loop. Meh. Alternatively back off and re-approach. Simplest: if opp guarding && d ≤ 112: heavy if (oppGuard ≥ 2 && heavyFails === 0); else 'back' (create space, don't feed them ki)? 'back' vs guarder: they stop guarding, chase... neutral. I'll do: heavy (crush attempt) when oppGuard ≥ 2 && heavyFails === 0; else light if d ≤ 104 (pressure, low risk — worst case blocked); else forward.
Hmm, one more: guarders might be guarding because a blast... no blasts around (handled). OK.

  if (op.state === 'forward') {
    if (d <= 130 && d >= 85) return 'light';  // they walk into it
    if (d < 85) return 'light';
    return (d <= 140 ? 'light' : 'forward'); // hmm
  }
Wait — opp walking toward me at d 130: my light active 5-8; they close 4.5×(5-8) = 22-36 → d at contact ~94-108 ≤ 110 ✓ HIT (they're 'forward' → not a move → no counter, but full combo). If they stop at their ask (≤ 6): they might guard (my light blocked — meh) or light (trade — I'm mid-light... my light started, theirs starts ≤ 6... their active at ask+5 could be before/after mine — trade likely) or heavy (their active at ask+9 — my light hits at 5-8 first if ask ≤ 3... if ask = 6, their heavy active at 15, my light done at 17 → their heavy HITS me during my recovery (counter 150!!). Hmm!! Danger: light vs approaching opp who heavies → I eat 150. How likely? Opp who heavies on approach... adaptive bots. Risk accepted — most bots light or guard or keep walking. Also my ask latency... 
    Let me refine: light vs 'forward' opp at d ∈ [90, 128]. If d < 90: too close, they're about to act — light anyway (first-strike) or guard? At d < 90, if I guard: they arrive, maybe light → blocked, they're -1 pushed. If I light: I likely hit first (they're walking, ask latency) → combo. I'll light at d ≤ 128 vs forward-opp.

  if (op.state === 'back') {
    // retreating: don't whiff; chase
    return (d <= 150 ? 'forward' : 'forward');
  }
  Chase. They corner eventually (their wallBehind shrinking). When cornered (their back-wall < 40), they stop backing → they're idle/guard → handled.

  if (op.state === 'idle') {
    if (d <= 104) return 'light';
    if (d <= 140) return 'forward';
    ...
  }
  
  Distances > 140: 
  if (d > 320) { return (me.ki < 55 ? 'charge' : 'forward'); }
  return 'forward';
```
Also neutral blast vs forward-approaching opp at range:
```
  if (op.state === 'forward' && d >= 220 && d <= 420 && me.ki >= 55 && !me.blastOut && !noCommit) return 'blast';
```
They walk into it (70 + hitstun). They might guard (12 chip, they're +2 ki). Approaching bots eat blasts. Put before the forward-light rule? Order: check blast for far d, light for close. ✓.

Wait also: 'noCommit' — when opp's blast incoming (eta > 12), don't start my blast (my blast would... actually my blast vs their incoming blast: they COLLIDE and die (both gone) — that's fine actually! Blast-clash cancels both. But my blast startup 11 while their blast arrives eta 13 → their blast hits me during startup (70×1.25) before... my blast spawns at 11 — their eta 13 → they'd collide?? their blast at eta 13, my spawn at 11: gap... my blast spawns at my front +40, their blast is at 13×13=169 from me — no collision (both moving toward each other at 26: they'd meet after (169-40-30)/26... positions: mine at +40, theirs at -169 relative... hmm at my tick 11: mine at 40, moving +13; theirs at 13×13 = 169 away moving -13 → distance 129, closing 26 → meet in ~5 ticks → collision at my tick 16 ✓ both die BEFORE their blast reaches me (theirs would hit me at 13)?? Wait eta 13 means their blast reaches me at tick 13 — but collision at tick 16 > 13?! Contradiction — because MY blast spawns at 40 AHEAD of me, meeting theirs sooner: theirs is at distance 13×13 = 169 at my tick 11 (it had eta 13 → 13 more ticks × 13 = 169). My blast at +40. Gap = 129. Closing 26/tick → collide at tick 11+5 = 16. But theirs hits ME at tick 13 (2 ticks before collision)?? It must pass... at tick 13 theirs is at 169-26 = 143?? no: theirs moves toward me: position 169 at tick 11, at tick 13 it's at 169-2×13 = 143 from me — that's not ≤ 30 body... eta was 13 meaning it reaches my body (30) at tick 13?? 169 vs eta 13: eta = ceil((gap-30)/13) = ceil((169-30)/13) = ceil(10.7) = 11 not 13. I messed up. Whatever: the point: with eta > 12, gap > 30+12×13 = 186. My blast spawns tick 11 at +40; theirs at ≥ 186-11×13 = 43?? — their gap shrinks 13/tick while I'm in startup: at my tick 11: gap = 186 - 143 = 43+30... I'm confusing myself. Simple: if eta > 12 at my decision, their gap > 186. Collision: my spawn at my tick 11 (at +40); their blast then at gap g11 = eta×13 - 11×13 - 30ish = (eta-11)×13 - 30... for eta 13: g11 = 26-30 < 0?? That means their blast hits me at ~tick 11-13 while my blast spawns at 11 → both at my front simultaneously... collision happens if blasts cross: theirs at +26, mine spawns at +40 moving +13, theirs moving -13 → they cross immediately → COLLIDE ✓ both die. And do I get hit? Their blast at my +26... body 30 → |o.x - b.x| ≤ 30 → hits me at tick ~11!? blasts(): collision check runs BEFORE hit check? Order in blasts(): spawn, move both, collision check (opposite cross), beam swallow, then hits. At tick 11: my blast spawns at 40, both move: mine 40+13=53, theirs 26-13=13 → crossed (53 > 13) → dead ✓ before hit check → I'm safe! Wow — counter-blast works as a projectile shield when timed right. But fragile. My noCommit rule blocks blast while theirs incoming — maybe allow counter-blast if eta ∈ [11, 14] (collision math works)? Risky; skip. Keep noCommit (guard instead). Fine.

Now heavyFails tracking:
```
  // at top of brain (after clash/cancel):
  if (lastAct === 'heavy' && (me.state === 'hitstun' || me.state === 'down' || me.state === 'crushed') && t - lastT < 30) heavyFails++;
```
Hmm — me.state when I'm hit during heavy startup: land() → stun → my state hitstun/down/crushed. I'm only CALLED when free or cancel — so I never SEE myself in hitstun! Calls only happen when free/cancel. So detection: next time I'm free: if lastAct === 'heavy' && lastHeavyTick and t - lastT < 45 && my hp dropped a lot?? Too fuzzy. Alternative: track my hp: if lastAct === 'heavy' && me.hp < lastHp - 60 && (t - lastT) < 40 → my heavy got countered (I took 60+ during it → means I was hit out of heavy... or blocked-crushed them (they take 60, not me)). me.hp drop ≥ 60 within 40 ticks of throwing heavy at neutral → heavyFails++. Rough but workable. Also reset lastAct after use. Note: heavy in combo (cancel) can't be countered (they're stunned) — only count when heavy was thrown at a FREE opponent. Track lastAct + lastTargetFree flag.

Simpler: I'll track: when I return 'heavy' while op.free → lastAct='heavyN', lastT=t, lastHp=me.hp. At next call (any): if lastAct==='heavyN' && me.hp <= lastHp - 50 && t - lastT <= 40 → heavyFails++ ; lastAct=null. That detects eating a counter (50+ dmg during my heavy). If they crushed... crush hurts THEM. If blocked → I took 0 → fine. If whiffed & unpunished → 0 dmg → fine (but no reward; whiffs still bad — can't detect whiff w/o punish; accept).
Also count light whiffs similarly? If light at neutral and I take ≥ 50 within 25 ticks → lightFails++ → reduce aggression? Could make me too passive. Skip; lights are cheap.

oppGuard tracking: at each free-decision: if op.state === 'guard' → oppGuard++ (decays? just count; threshold 2). Fine.

Now special: what if opp.free && d small && opp has been idle for long (passive camper)? d ≤ 140 → forward → they light me as I approach?? I walk into their light range: they light at d ≤ 110: my ask sees op.state light → guard (rule above hits first? Order: op.state === 'light' check comes before neutral → guard ✓). OK good: my anti-light guard protects my approach. 

But WAIT — order of checks: 'light' state check — op free states and move states — I have beam, blast-threat, then... let me finalize full order:

1. clash → push logic
2. canCancel → combo
3. !me.free → idle
4. history update (heavyFails detect) 
5. op.state === 'beam' → beam defense
6. incoming blast (inc) rules (eta ≤ 12 → guard/dash; else noCommit = true)
7. op down → oki
8. op crushed/hitstun/blockstun → punish
9. op light → guard/punish
10. op heavy → interrupt/dash/punish
11. op blast → interrupt/punish
12. op dash → punish landing
13. op recover → punish
14. op charge → light/heavy/forward
15. op guard → crush adapt
16. op forward/idle/back → neutral offense
17. distance defaults → forward/charge

Wait, item 6 must come before 9-14? If their blast is in flight AND they're in recovery: guard takes precedence (safety). But if eta > 12 and they're in recovery at close range → punish (falls through) ✓ since I only return early for eta ≤ 12. And noCommit only blocks my blast/beam starts (items 16's blast). ✓.

Item 5 before 6: opp beaming with my... fine.

Also — item 5: op.state 'beam' — while THEY beam, is their blast possibly in flight? They could've blasted, recovered, then beamed → inc exists AND op beaming. Beam defense dominates ✓ correct (beam more dangerous... but the blast hits during my beam-defense moves? E.g., I light-interrupt their beam startup while their old blast arrives eta 8 → my light startup... blast hits me at 8 during my active/recovery → 70-87. Ugh. Add: in beam-defense, if inc && eta ≤ 15 → prefer guard (blocks BOTH beam... guard blocks beam chip 120 and blast 12 — safe). So put blast-check (eta ≤ 12 → guard) BEFORE beam rules? But then dash-through-beam-firing (their beam firing + my dash) blocked by an old incoming blast? Rare. Order: blast threat guard (eta ≤ 12) → beam rules with awareness. But blast eta ≤ 12 guard while their beam startup at d ≤ 106 → I should light-interrupt instead? Light vs guard: interrupt = 50 + combo + they lose 50 ki, but I eat their... their beam interrupted → no beam. Their old blast hits me at 8 (during my light) → 70. Net: +50+combo on them, -70 me. vs guard: -12 -120 chip. Interrupt better. Hmm, so order beam-interrupt BEFORE blast-guard, but only for the interrupt/dash actions; guard fallback handles both. And if beam rules say 'guard' (can't punish) → guard handles blast too ✓.

Final order:
1. clash
2. cancel
3. !free → idle
4. heavyFails detect
5. op beaming → beam rules (interrupts/dashes allowed even with inc; 'guard' fallback safe vs blasts too) — but the dash-through vs firing beam: their old blast incoming? My dash dodges blast too (invuln) ✓ fine. And 'forward' walk-interrupt with inc eta ≤ 12 → bad (eat blast while walking)... add condition: if inc && eta ≤ 14 → in beam rules, skip 'forward' (just guard).
6. inc: if eta ≤ 12 → (dash-through if op in blast state & close & ki) else guard. Set noCommit.
7-15 punishes & neutral.

Also opp 'ko' — match over, moot.

One more scenario: MY blast in flight heading at them (mine, not incoming) — irrelevant except blastOut for starting another. ✓ (blastOut check in neutral blast rule).

Also: 'push' action outside clash → engine treats as idle ✓ harmless.

Ki thresholds: beam oki needs 50 — remember oki beam is huge. Guard ki spending: dashes 10. My neutral blast needs ki ≥ 55 to protect beam fund... but beam needs an oki opportunity (knockdown). Knockdowns come from: my heavies (combo enders), clash wins, their... Let me keep ki ≥ 50 reserve until a good beam moment; oki beam spends it. Also punishes don't need ki (lights/heavies). Dash defenses spend 10 (worth it).

Charge rule: d > 320 && op free && ki < 55 → charge. Also d > 320 even if opp approaching? op.state 'forward' at d 330 → opp approaching: charge anyway? They'll close to 320 in ~2 ticks... then I switch to neutral. Meh — at d 330 with opp forward: they're coming to me — let them: 'charge' while they approach, switch when d ≤ 320... wait my rule at d ≤ 320: op free → forward?? Opp is approaching and I walk forward too → we meet fast at ~410 closing... fine, neutral light rules take over at d ≤ 128 (op forward → light). Hmm — but my charge rule at d > 320: if opp forward → charge (they come to me); if opp idle/back → also charge (they're not approaching) → stalemate if both idle/charge... opp charge too → both charge → whoever's patient... time runs out → draw. To avoid draws, if BOTH charging for long (t > 1200?), approach. Add: if op.state === 'charge' && me.ki >= 55 → 'forward' (I have ki, go fight). And if op charge && my ki < 55 → charge (ki race — but then nobody approaches → draw at 0.5). Slight improvement: if op.charge for very long AND t > 2400 && hp equal-ish → forward. Eh — my ki will hit 55 after ~140 ticks of charging (start 30 → +0.36/tick) → then forward. So stalemate resolves in ~2.5 seconds. 

Also charge cap: ki < 95 for charging (near max, do something else). And don't charge if d ≤ 320.

Also — charge safety at 320+: opp blasts from 420: I see inc, eta (420-70)/13 ≈ 27 → next asks: guard at eta ≤ 12 ✓ safe (charge stops). Opp beams from 450: beam rules → guard → 120 chip... or walk-interrupt impossible (too far) → guard, eat 120. Then opp recovers; I charge again. Their beam: 50 ki for 120 chip on me — they lose the ki war. ✓ acceptable.

Also opp dash_forward at me from far while I charge: they close 200 → land at d-200; they're in recovery 8 → I'm asked (≤ 6): op dash recovery at d' ~120-200 → light-timing? If they landed at 100+ away... their dash recovery left ~2-8: my light active 5-8 needs their left ≥ 7 — maybe not. Then neutral. They reached me though — fine, fight. But I was CHARGING when they dashed: ×1.5 risk if they hit me fast. Their dash → recovery → free → light... I get asked at most 6 ticks after my charge decision; I see their dash/recovery and respond ✓ (not charging anymore). OK.

Now — potential problem: charge at d 330+, opp dashes (10 ticks, 200): from 400 → lands at 200 → my ask at ~6 ticks in: I see op dash moving at d ~250... my rules: op dash moving, movingLeft > 5 → guard (current rule). Then next ask: movingLeft ≤ 5, d ~210 > 145... light?? d ≤ 306 → light — but landing at d-200 = 10?? WAIT: if opp at 250 moving toward me: they land at 250-200 = 50 (in front, since d... pass-through needs d ≤ 140 → no pass, stop in front at max(d-200, 60): d=250 → 50 < 60 → land at 60). My light: active 5-8; their landing at movingLeft ticks then recovery 8: they're at 60 → my light reach ✓ → counter hit 50 + combo ✓ GOOD. That's the d ≤ 306 rule ✓ correct.

Alright — now, what about ME getting comboed (I'm in hitstun): no decisions until free. When free: neutral rules. ✓.

What about facing/behind: after their dash lands behind me, d = 60, op free: my rules see op free at d 60 → light (d ≤ 104) → first strike race. Fine.

Let me also double check light approach: d ≤ 104 && op idle → light. Opp idle might be a thinking bot about to... race. Fine.

Let me also reconsider: opp 'back' at d ≤ 140 → I 'forward'. They back at 3, I forward 4.5 → closing 1.5. They reach wall → stop. OK. But they might back-then-light (stop-light as I approach: my anti-light guard handles ✓).

Now, assemble also: **guard default** — final fallback 'forward' or 'guard'? If d ≤ 140 && nothing matched → light/forward per rules. Fallback: 'forward' if d > 60 else 'guard'. Eh.

Blast vs opp in hitstun at range (my blast hit them, they're stunned 20, d 150-300): another blast: ki ≥ 20, !blastOut... my first blast is GONE (hit them) → blastOut false ✓. Their stun left ≥ 12 + (d-40)/13? At d 200: travel (200-40)/13 ≈ 12 + startup 11 = 23 > 20?? Blast startup 11 + travel 12 = 23 > their stun 20 → they're free, guard → 12 chip. Only if their left ≥ 11 + (d-40)/13 + 2. Rare. My hitstun rule: light/heavy if in range (d ≤ 136); else 'forward'?? Chasing hitstun 20 ticks at 4.5 → +90 — barely worth. Blast if condition met. Add to hitstun rule: else if (op.left >= 13 + (d-40)/13 && me.ki >= 20 && !me.blastOut && d >= 140) return 'blast'. 70 more dmg ✓. (d ≤ 40 + 13×(20-13) = 131?? their left ≤ 20 always (blast hitstun 20); need left ≥ 13+(d-40)/13 → d ≤ 40+13×(left-13) ≤ 40+13×7 = 131 < 140 — contradiction!! So no blast follow-up ever lands on hitstun. REMOVE. Hmm — wait hitstun can be from light (15) or blast (20) — max 20. Right, impossible. Skip.)

But opp in long recovery (heavy 22, beam 20, recover 20): blast catch: need their remaining ≥ 11 + (d-40)/13 + 1: heavy recovery 22 → d ≤ 40+13×10 = 170. beam recovery 20 → d ≤ 144. Marginal. Skip blast-punish on recovery; lights/heavies suffice, plus walk-forward.

What about blasting OPP's blast out of the air... covered (collision) — not by design.

Big picture sanity check on my main damage loops vs typical opponents:

vs rushdown bot (forward + light at range): 
- They approach; at d ≤ 128 & op forward → I light → they walk in → HIT → 4L+H = 174 + knockdown → oki: charge/beam (ki 30+... after combo my ki: dealt 174×0.02 = 3.5 + passive... ~35 → charge during their down 42 → +15 → 50 → beam oki if ≥ 50: yes → 120-280 more. Total ~350 per cycle. They get: occasional trades/lights when they interrupt my approach (40 + maybe 174 if they combo too). I should dominate.

vs guard bot: they walk in guarding or guard at mid... oppGuard builds → heavy crush at d ≤ 112 → 60 + combo ~234. If they release-guard reactively and punish my heavy → heavyFails → I switch to lights (blocked) + forward pressure. Might stall — but they take 0 chip... time draw risk. Hmm. Guard-bot counter: my light blocked pushes them 14 & they're -1... I can't damage a full-time guarder except via crush or blast chip (12) or beam chip (120!). Beam vs guarder: 50 ki → 120 chip GUARANTEED (they're stuck guarding? If they see my beam startup they might dash back — beam still hits (ray covers stage) unless they... beam hits regardless of position (ray extends 1200 over 40 ticks; stage is 920 wide — full coverage) → guard → 120 chip, or if they hold... they CAN'T avoid: dash invuln 9 only. So beam = 120 guaranteed vs anyone without... wait can they dodge beam with dash_forward through ME? d ≤ 140 pass-through → behind me → my beam missed them → they punish my beam (60 stuck ticks!) → ~200 on me. Only works if d ≤ 140 at my beam start. So beam campers from range ≥ 200: guaranteed 120 chip for 50 ki. vs guard-bots: good deal. Add rule: if oppGuard ≥ 8 (heavy guarder) && d ≥ 200 && ki ≥ 50 → beam. Hmm — but a "guard bot" that's actually reactive will dash_back (still chipped 120) or... whatever, it's guaranteed damage vs guarders. Also blast vs guarder: 12 chip for 20 ki — bad. Beam: 120 for 50 ✓.
  But careful: guarder at d ≥ 200 — will they approach me instead? If they guard at range, they're camping → beam them ✓. If they're approaching (forward), blast/light rules apply. OK: rule: op.state === 'guard' && d ≥ 180 && me.ki ≥ 50 → beam. Guarders at range eat beams. And oppGuard high && d ∈ (112, 180): forward (approach to crush range).

vs blast spammer: they blast from range; I guard (+2 ki each, -12 hp). They exhaust ki (20/blast). Then they approach or charge. My ki grows (guard +2, charge when safe). When they're ki-dry, I approach and out-pressure. Also oki beams. I take chip but should win on combos. Also — spammer at d 150-250 blasting: my dash-through needs d ≤ 140 — nope. Guard it is. My hp bleeds 12/blast — a full-ki bar = 100 ki = 5 blasts = 60 hp. They then need 250 ticks to recharge. Meanwhile I charge to 50+ and beam them (guard → 120 or hit 280). Beam vs blast spammer at range: they see my beam startup (30) → they guard (120) or blast again?? Their blast during my startup: blast startup 11 → their blast flies at me: hits me during MY beam startup → INTERRUPT (I eat 87, lose 50 ki!!). DANGER: beam only when opp can't blast: opp ki < 20, or opp in commitment, or opp... blast spammer with ki ≥ 20 + me beaming = I lose 50 ki + 87 hp. So: beam at range only if op.ki < 20 (they can't blast) — else approach instead. Revise beam-at-range rule: (op.ki < 20 || op.state in [down...) → oki beam separate (op down ✓ safe). Neutral beam vs camping guarder: require op.ki < 20 ✓.

Hmm, but ALSO blast spammer keeps distance? They blast, I guard, they approach after? Typical spammer: blast → walk forward behind blast?? If they follow blast in, my guard blocks the blast (blockstun 14) while they close → they light me out of blockstun?? Blockstun 14 — I'm stuck 14 ticks; they approach behind blast: blast at d... they blast from 300, walk 4.5×(300-70)/13 ≈ 79 ticks... arrives way after blast. Meh.

vs charger bot: they charge at range; I approach; they keep charging (bots) → d ≤ 100 light combo (194); or they stop → neutral. If they charge at 300+ persistently, my blast rule? Blast vs charger: ×1.5 = 105 if held — add: op.state === 'charge' && d ≥ 150 && me.ki ≥ 20 && !me.blastOut && !noCommit → blast (they hold charge: 105; they guard: 12; they release: ~70 or guard). Actually approaching is better (194 combo + oki). Blast for impatient damage while approaching? Both: blast if d ≥ 200 (before my light range), then continue forward. ✓ include.

vs beam-happy bot: beams at range → my beam-defense: too far to interrupt → guard (120 chip each beam, they spend 50). They ki-starve. Meanwhile I charge (d > 320 charge ✓ but beam rules force guard when they beam...). They beam: I guard, eat 120; they recover; I charge; repeat. Hmm — I lose 120/beam (they spend 50 ki). Their ki: 100 → 2 beams (240 dmg to me) → dry. My answer: when THEY beam, if d ≥ 200, instead of guarding could I... walk toward them during their 30 startup?! Beam-interrupt walk rule: suLeft ≥ 16 && d ≤ 100 + 4.5×(suLeft-14) — from d 250: need suLeft ≥ 14 + 150/4.5 = 47 > 30 impossible. So no. Dash during their startup: dash 200 → d 50, in front → they fire → hit me 280 (recovery, ×1.25 = 350). NO. Dash_back during their startup: they fire, front chases: my invuln 9, dash 10 ticks covers 200; front 30/tick from their x+40: reaches my new position at (d+200-40)/30 + ... if I dash_back at their suLeft 25: they fire in 25; front spawns 25+... I'm at d+200; front covers (d+160) at 30/tick → reaches me at 25 + (d+160)/30... invuln ends at 10 → if (d+160)/30 + 25 > 10 always... wait front reaches me at 25 + (d+160)/30 ≥ 25 > 10 → after invuln → HIT 280 (in dash recovery). NO. So guard (120) is best vs range beams. UNLESS: counter-DASH as they fire: d ≤ 120 → dash-through ✓ (my firing rule). At range: eat 120 chip, then punish their recovery? Their beam total 90 ticks; after firing ends... I'm guarding with blockstun till beam over; then they're in recovery 20: my guard-recovery... I'm free at beam end + 1; they're locked till +20: pun window 19: light if d ≤ 110+4.5×? If they beamed from 250, d ~250 → walk 4.5×19 = 85 → 165 — no punish. Then neutral. Fine — beam-happy bots waste ki on my guard; I chip-win via oki beams + combos. I take 120/beam but they only get 2-3 beams per full ki bar and need 500+ ticks to recharge (50 ki at 0.36/tick = 140 ticks... plus they start with 30+100: ~3 beams early). Acceptable.

BUT hmm — when I guard their beam, I'm blockstunned "until beam ends" — their beam fires 40 ticks; my blockstun ~40+; they recover 20 after. So they're free at beam-end+20 = my blockstun-end+20 → they can approach/punish?? I'm free at blockstun end (guarding until beam over → free after). They're locked 20 more → I get 20 ticks free: walk in (90) → light-range? If d was 250 → 160 — no. If d 150 → 60 → LIGHT + combo on their recovery!! So vs beams at d ≤ ~200: guard → then punish their post-beam recovery. My beam-recovery rule handles (op.state beam recovery: forward if d ≤ 110+4.5×(left-14)). ✓ included.

Alright, what about the very common mirror: both at d ~100 free, both throw light → trade 40/40, both combo? Trade: both hit same tick → both hitstun 15 → both get cancel call next tick → both likely continue combo → mirrored combos (both ~174). Net even. My edge: better punishes elsewhere.

I think the design is solid enough. Now write clean code.

Also cadence consideration: my rules return quickly, fine.

One more critical check — the canCancel + 'light' chain condition: reach. At cancel, d ≤ 108 (I use 108 margin). After hit +14 push → next ask shows d+14. 4th light (chain 3 → returning light sets chain 4): d after 3 hits = d0+42; if d0 = 60 → 102 ≤ 108 ✓ 4th light hits → d 116; then heavy at chain 4: d 116 ≤ 140 ✓. If d0 = 80: 122 > 108 → at chain 3 cancel: d = 80+28 = 108 ≤ 108 ✓ → 4th light: needs ≤ 110 at ITS active: after 3rd hit d = 108... wait let me recount: cancel happens after hit; the state.dist at cancel = post-push. Light 1 thrown at d0, hits → push → cancel ask at d0+14. If d0+14 ≤ 108 → light 2 → hits → d0+28... light 4 thrown at d0+42, hits → d0+56, cancel ask: chain=4 → heavy if d0+56 ≤ 140 → d0 ≤ 84. Hmm so for d0 ≤ 84 full 4L+H; for d0 ∈ (84, 96]: 3L+H (at cancel chain=3, d = d0+42 ∈ (126,138] ≤ 140 ✓... wait cancel after 3rd light: chain=3 <4 → light if d ≤ 108: d = d0+42 > 126 → no light → heavy ✓ (d ≤ 140 ✓) → 3L+H = 164+knockdown ✓. For d0 ∈ (96, 110]: initial light at d0 ≤ 104 per my neutral rule... d0+14 ∈ (110,124] > 108 → after 1st light: heavy (d ≤ 140 ✓): 40+78 = 118+knockdown. Fine.

And when opponent's back near wall: pushApart pushes ME back instead → d increases same. Same math ✓. If MY back at wall: they get pushed... they can't (wall?) — o pushed toward... whatever, d always +14 ✓.

Heavy in combo when their back to wall: knockback 150 → clamped, fine.

Now — code:

```js
// ── 蓄雷 ── a patient counter-fighter
let lastAct = null, lastT = -999, lastHp = 1000, heavyFails = 0, oppGuard = 0;

function decide(s) {
  try { return brain(s); } catch (e) { return 'guard'; }
}

function brain(s) {
  const me = s.me, op = s.opp, d = s.dist, t = s.t;

  // ── beam clash ──
  if (s.clash) {
    const k = s.clash;
    const myP = (me.ki > 0 ? 1 + 0.02 * me.ki : 0.5) + (me.hp < 300 ? 0.4 : 0);
    const gain = me.ki > 0 ? 0.6 : 0;
    if (myP >= k.oppPower + 0.5) return 'idle';     // clearly winning: save ki
    if (myP + gain >= k.oppPower - 0.05) return 'push';
    return 'idle';                                   // hopeless: drag it out
  }

  // ── combo cancel ──
  if (me.canCancel) {
    if (d <= 108 && me.chain < 4) return 'light';
    if (d <= 140) return 'heavy';
    return 'idle';
  }

  if (!me.free) return 'idle';

  // ── learn ──
  if (lastAct === 'heavyN' && t - lastT <= 40 && me.hp <= lastHp - 50) heavyFails++;
  lastAct = null;
  if (op.state === 'guard') oppGuard++;
  const opAway = me.facing > 0 ? 960 - op.x : op.x - 40;   // room behind the opponent
  const behindOK = opAway >= 70;

  // ── their beam ──
  if (op.state === 'beam') {
    if (op.phase === 'startup') {
      const suLeft = 30 - op.t;
      if (d <= 106 && suLeft >= 7) return 'light';
      if (d <= 136 && suLeft >= 13) return 'heavy';
      if (d <= 140 && me.ki >= 10 && suLeft >= 12 && behindOK) return 'dash_forward';
      if (suLeft >= 16 && d <= 100 + 4.5 * (suLeft - 14) && !(incomingSoon(s, 14))) return 'forward';
      return 'guard';
    }
    if (op.phase === 'firing') {
      if (d <= 118 && me.ki >= 10 && behindOK) return 'dash_forward';
      return 'guard';
    }
    // recovery
    if (op.left >= 7 && d <= 106) return 'light';
    if (op.left >= 13 && d <= 136) return 'heavy';
    if (op.left >= 16 && d <= 110 + 4.5 * (op.left - 14)) return 'forward';
    return 'guard';
  }

  // ── incoming blast ──
  const inc = incomingBlast(s);
  const noCommit = !!inc;
  if (inc && inc.eta <= 12) {
    if (me.ki >= 10 && d <= 140 && d >= 60 && op.state === 'blast' && op.phase !== 'startup') return 'dash_forward';
    return 'guard';
  }
```
Hmm — dash-through with op in blast startup: their projectile not out yet; my dash during their startup: I land at tick 10, they're still in startup if 11-t > 10 → t=0... they spawn blast at 11 — from their position — I'm BEHIND them → blast flies forward, misses me ✓; if t ≥ 1, their state → recovery when I arrive → punish window tiny. Actually if op blast startup and d ≤ 140: dash → I land behind at 10; their blast spawns at 11-t: if t ≤ 1: spawns at ≥ 10... at tick 10-11 — spawns and flies forward (away from me) ✓ safe; they're in recovery till 29 → I'm free at 18, light active 24-26 < 29-t... ok small window. If t ≥ 2: spawn at ≤ 9 — blast spawns while I'm dashing — flies at MY OLD position... it flies forward = toward where I was — I dashed through → I'm behind them → blast missed me ✓ (it's heading to my old spot and beyond). ✓ So dash-through vs blast startup is ALSO safe (blast flies the wrong way). Allow: op.state === 'blast' any phase ✓. But wait — if t ≥ 2, blast spawns at ≤ 9 ticks — spawns at their front +40 and moves 13/tick — during my dash I cross paths... at spawn tick (my tick ~9-t+1... e.g., t=5 (their left startup 6): spawn at my tick 6: blast at their front; I'm mid-dash at ~120 traveled — PAST their position (d ≤ 140 → I pass them around tick (d/20)... d=140: pass at tick 7 — at spawn tick 6, am I within blast's path? Blast at their.x + f×40 moving forward. My body at my tick 6: 120 traveled → my position: original + 120f. If d = 140: I'm 20 short of them — blast is 40 AHEAD of them — blast at +40 from them; me at -20 from them → gap 60 > 30 ✓ no hit. Next ticks: I move +20, blast +13 → I pass them... blast moving AWAY from me (both same direction, I'm faster): closure 7/tick... wait blast moves forward (away from my origin) at 13; I move forward at 20 — I chase the blast from behind! I land behind opp (dash ends tick 10 at +200 = 60 behind opp) — blast at +40+13×4 = +92 ahead — no contact ✓. But mid-dash tick 7-10: I pass through opp position; blast is ahead of opp by ≥ 40+13×(tick - spawn) — always ≥ 40+ away from opp; am I ever within 30 of the blast? At tick 7: me at +140×... me pos rel opp: traveled -140... d=140: me at +0 (at opp) at tick 7; blast at +40+13×1 = 53 → gap 53 > 30 ✓. Tick 8: me +20, blast +66 → 46 ✓. Tick 9: +40 vs +79 → 39 ✓ (invuln ends tick 9 — need gap > 30 ✓ barely). Tick 10: +60 vs +92 ✓. SAFE. But what if d smaller, d=100: pass opp at tick 5 (100/20); spawn at tick 6 (t=5): blast at +53 rel opp; me at +20... rel opp: traveled 120 - 100 = +20; blast at +53 → 33 ✓ barely. tick 7: me +40, blast +66 → 26 < 30!!! HIT?! Invuln at tick 7 ✓ still (t<9). Tick 8: me +60, blast +79 → 19 <30 — invuln ✓. Tick 9: me +80, blast +92 → 12 < 30 — invuln ends AT t=9? invuln = t < 9 → tick 9 NOT invuln → blasts check: |o.x-b.x| ≤ 30 → 12 ≤ 30 → HIT 70!! And I'm dashing... 70×1? mult: dash is a MOVE in recovery? At dash t=9, phase: t < 10 → moving → not startup/recovery → mult 1 → 70 dmg. Ugh!! So dash-through vs blast STARTUP can eat the blast when it spawns as I pass. Hmm wait — but the blast spawn position: a.x + facing×40 — facing = toward my ORIGINAL side. Blast flies toward my origin. I dashed forward THROUGH: after passing opp, I'm chasing the blast from behind?? NO WAIT — I had it backwards! Blast flies TOWARD MY ORIGINAL POSITION = the direction I dashed FROM. I dash TOWARD the opp and beyond — the blast flies AWAY from opp toward where I was — we're moving in OPPOSITE directions! Blast spawns at opp front (+40 toward me) and moves toward me (-13 rel opp). I move +20 rel... toward opp → CLOSURE 33/tick. Contact ~ (40+30)/33 = 2 ticks after spawn. d=100, spawn at my tick 6 (their t=5, suLeft 6): contact at tick 8 — invuln (t=8 < 9) ✓ DODGE. Then blast continues behind me. ✓ SAFE. I made an error before (blast direction). Blast moves TOWARD me (the shooter's front = my side). OK so dash-through vs blast startup: blast spawns and immediately meets me head-on within ~2 ticks (invuln ✓), passes, gone. SAFE ✓. And landing behind opp ✓. 
  Let me redo the earlier firing-case: op blast recovery (projectile already flying toward me): dash forward: closure 33/tick: contact at 13×eta/33 ≈ 0.4×eta ≤ 12×0.4 = 4.8 ticks < 9 ✓ dodge. ✓ SAFE. And eta ≤ 12 guard covers larger etas.
  
  So: dash-through vs incoming blast: safe whenever contact happens within invuln 9 ticks: contact ≈ 0.39×eta ≤ 9 → eta ≤ 23. And landing: d ≤ 140 → behind them ✓, d ∈ (140, 260) → 60 in front of them — they're in blast state (committed) — I land in front, blast dodged ✓, then their recovery vs my recovery — earlier computed tiny punish window; safe anyway (they can't hit me while committed... if d ∈ (140,260) and they're STILL in blast state when I land... they fired the blast 11+k ticks ago, total 29 → committed for 18-k more... eta relates... ugh. Worst case: they're FREE when I land 60 in front of them (fired long ago from far) → they punish my dash recovery (light ×1.25 50 + combo). That's why I require op.state === 'blast' (they're still committed) → their remaining ≥ 1 tick... their remaining could be 1 tick when I land → they're free 1 tick after my landing, I'm in recovery 8 → they punish!! Need their remaining recovery at my landing ≥ ... my free at 18; need their blast-state remaining ≥ 18 - 10 = 8 more at landing → their total remaining now ≥ 18. op.left gives remaining of their whole blast state (dur 29 - t): require op.left ≥ 18. Hmm op.left for blast state = 29 - op.t. Require op.left ≥ 18 (i.e., op.t ≤ 11 — always true during... if op.phase === 'recovery', op.t ≥ 11 → op.left = 29-op.t ≤ 18 → op.left ≥ 18 only at t=11 exactly. Startup phase: t ≤ 10 → left ≥ 19 ✓. So dash-through only when op.phase === 'startup' (or t=11 exactly). If they're in recovery already (blast flying), guard instead. REVISE: dash-through iff op.state === 'blast' && op.phase === 'startup' && d ≤ 140 && d ≥ 60 && ki ≥ 10. Wait d ≥ 60 always (minGap). But hmm, what about d < 140 landing behind ✓.
  Actually ALSO: eta during their startup: blast not spawned → eta = based on... blast spawns at their front: gap = d - 40 - ... at my decision (their t): eta ≈ (d - 70)/13 + (11 - t). For d=140, t=0: eta ≈ 5.4 + 11 = 16.4. My dash: contact ~2 ticks after spawn ✓ invuln ✓. So during their startup with eta large — my general rule `inc.eta <= 12 → guard` might not even trigger (eta 16) → falls to noCommit... then op.state === 'blast' startup rules: d ≤ 106 && op.t ≤ 4 → light interrupt ✓ else forward... but dashing through is strictly better when close! Reorder: put the dash-through check in the blast-state section (before inc guard). Let me restructure: the op.state === 'blast' section handles everything; the inc section only handles blasts whose shooter is no longer committed (or far).

Revised plan for blast interactions:
```
  if (op.state === 'blast') {
    // their projectile may or may not be out; they're locked in blast for op.left ticks
    if (op.phase === 'startup' && op.t <= 4 && d <= 106) return 'light';   // clean interrupt
    if (op.phase === 'startup' && me.ki >= 10 && d <= 140 && behindOK) return 'dash_forward'; // phase through, blast spawns into my invuln
    if (op.left >= 18 && me.ki >= 10 && d <= 140 && behindOK) return 'dash_forward'; // (recovery just began)
    // punish recovery
    if (op.left >= 7 && d <= 106) return 'light';
    if (op.left >= 13 && d <= 136) return 'heavy';
    if (inc && inc.eta <= 12) return 'guard';
    if (op.left >= 16 && d <= 110 + 4.5 * (op.left - 14)) return 'forward';
    return 'guard';
  }
```
Hmm wait, ordering: if inc eta ≤ 3 and they're in recovery and d ≤ 106: light would hit them at 5-8 but their blast hits me at ≤ 3 — I eat 70 (in light startup: ×1.25 = 87) while dealing 50+combo... net bad-ish. Guard: -12, safe. So blast-guard should come BEFORE recovery punishes when eta small: order: interrupt/dash options first (they prevent the blast entirely or dodge it), then if inc && eta ≤ 12 → guard, then punishes. But interrupt light (t ≤ 4): prevents spawn entirely → best ✓ first. Dash-through startup: dodges ✓ second. Then guard check. Then punishes. ✓ as written above. One fix: "op.left >= 18 && recovery" — op.left = 29 - t; recovery starts t=11 → left 18 ✓; so condition op.left ≥ 18 in recovery means t=11 only. Merge: dash if (op.phase === 'startup' || op.left >= 18) && ... Actually simplify: dash-through iff op.state blast && ki ≥ 10 && d ≤ 140 && behindOK && (op.phase === 'startup' || op.t <= 11). Since t ≤ 11 covers startup (t ≤ 10) and first recovery tick. ✓.

Hmm — but WAIT: dashing through their blast STARTUP when the blast hasn't spawned: blast spawns at tick 11 - t... during my dash, spawn happens (if 11-t ≥ 1): spawn at their front; contact ~2 ticks later — need contact within MY invuln (my ticks 0-8): contact at my tick ≈ (11 - t) + 2 ≤ 8 → t ≥ 5. If t < 5 (their startup just began): spawn at my tick ≥ 7... e.g., t=0: spawn at my tick 11?? My dash: moving ticks 0-9, recovery 10-17. Spawn at my tick 11 — I've already landed (behind them) → blast spawns at their front and flies TOWARD MY ORIGINAL position — I'm behind them → blast never touches me ✓✓. Oh nice — if spawn happens after I've passed, the blast flies away from me. Contact timing only matters if spawn happens while I'm mid-dash in front of them... if spawn at my tick s ∈ [1,9]: I'm at traveled 20s... blast at +40 rel them, moving toward me at 13: contact when 20s + 13(s') ... positions rel opp: me: (20s' - d)... let me not: worst case t=5: spawn at my tick 6: me at 120 traveled; rel opp: 120 - d (d ≤ 140 → me between -20 and +80 rel opp... blast at +40 (their front, on MY ORIGINAL side — positive rel... hmm wait direction: blast flies TOWARD MY ORIGINAL position. Let me set: opp at 0, my original side is NEGATIVE (I'm at -d). Blast spawns at their front = -40?? "从身前飞出" — front = facing = toward me = negative side. Blast at -40, moving -13/tick. I dash from -d toward +, passing opp to +60. At my tick s: me at -d + 20s. Blast (after spawn at tick σ): at -40 - 13(s-σ). Contact: me ≈ blast: -d + 20s = -40 - 13(s-σ) → 33s = d - 40 + 13σ... s = (d - 40 + 13σ)/33. With σ = 11 - t (their spawn my-tick... their state t advances with ticks too: at my decision their t; spawn when their t hits 11 → my tick σ = 11 - t). Contact tick s = (d - 40 + 13(11-t))/33. Need s ≤ 8 (invuln 0-8) OR contact never happens before I pass (I'm past -40+... once me > -10 (past blast's spawn +body), and blast moves negative — we've crossed). Crossing happens when me position > blast position: me - blast = -d + 20s + 40 + 13(s - σ) = 33s + 40 - d - 13σ. Contact/cross at s* = (d + 13σ - 40)/33. Invuln needs s* ≤ 8 → d + 13σ ≤ 304. With d = 140, σ = 0 (spawn already... σ ≥ 0): 140 + 13σ ≤ 304 → σ ≤ 12.6 ✓ always (σ ≤ 11). With d = 140: s* = (100 + 13σ)/33 ≤ (100+143)/33 = 7.4 ≤ 8 ✓. d=140 is max for pass-through... but ALSO what if d ≤ 140 but crossing after my dash ENDS (s* > 10)? s* ≤ 7.4 ✓ always < 10. And post-crossing, blast is behind me moving away ✓. What if crossing during my recovery (s* ∈ (9.5, 17))? s* ≤ 7.4 — impossible ✓. SAFE always when d ≤ 140 && they'll spawn during... even if spawn at σ = 11 (their t=0): s* = (d - 40 + 143)/33 = (103+d)/33 ≤ 7.4. ✓✓ Great — dash-through their blast startup is always safe for d ≤ 140.

And guard fallback covers everything else. 

Also their blast in flight + them FREE (they recovered or it's a "leftover" blast) + eta ≤ 12 → guard ✓ (inc section). But inc section runs only if op.state isn't blast... My flow: op.state === 'blast' section handles committed shooter; else if inc && eta ≤ 12 → guard. But ALSO if op.state === 'blast' AND inc eta ≤ 12: inside blast section I check `if (inc && inc.eta <= 12) return 'guard'` before punishes ✓ (but after interrupt/dash options ✓).

Wait, one thing: inside the blast section, dash-through when d ≤ 140: also require the inc eta... if blast already flying toward me (their recovery) and I dash forward: contact at 0.39×eta — if eta = 12: contact at ~4.7 ✓ invuln. If their t=11 (left 18): blast just spawned: eta ≈ (d-70)/13; d=140 → 5.4; contact ~2 ✓. ✓ covered by t ≤ 11 condition.

What if op.state === 'blast' recovery, t > 11 (left < 18), inc eta ≤ 12, d ≤ 106: guard ✓ (punish forgone — correct, safer).

OK. Now also the beam section with inc: dash-through firing beam while blast also incoming? Opp can't beam + blast... blast from earlier + beam now: possible. My dash dodges beam ✓ and blast (contact 0.39eta ≤ 4.7 if eta ≤ 12... if eta > 12, blast hits me during dash recovery?? eta > 12 → contact at > 4.7 — still < 9?? contact ≈ 13eta/33 ≤ 9 → eta ≤ 23 ✓ — while dashing I dodge blasts up to eta 23. After landing behind opp, blast flies toward my OLD position — misses me ✓ forever (it flies one direction). So dash dodges any eta ≤ 23. ✓ fine regardless.

Also in beam-firing dash: behindOK + d ≤ 118 ✓.

Now — oki section:
```
  if (op.state === 'down') {
    const dl = op.left;
    if (me.ki >= 50 && dl >= 32 && dl <= 60) return 'beam';
    if (dl >= 26) {
      if (d >= 300) return 'forward';
      return me.ki < 95 ? 'charge' : 'guard';
    }
    if (dl >= 8) {
      if (d > 115) return me.ki < 95 ? 'charge' : 'forward';
      return 'guard';
    }
    if (d <= 106 && dl >= 2 && dl <= 6) return 'light';
    if (d >= 140) return me.ki < 95 ? 'charge' : 'guard';
    return 'guard';
  }
```
Hmm dl ≤ 60: down durations are 42 (heavy), 50 (beam), 60 (clash)... dl = remaining ≤ 50ish. beam oki: fire at my 30, they wake at dl: want fire before wake: dl ≥ 32; front reaches them before beam ends: always ✓. If dl = 45: fire at 30, front spawns, travels, they wake at 45 into ray ✓ 280 (or guard 120). ✓. Also require... if I'm in THEIR face (d=60) and I beam: fine. If d large: beam still reaches ✓ (front 1200). But beam fires from my position toward THEM ✓ ray extends ✓. ✓.
Edge: op knocked down but FLYING (knockback still moving them)? During down, kb moves them; positions shift a bit — fine.

Also during their down: if another... skip.

Crushed/hitstun/blockstun section:
```
  if (op.state === 'crushed' || op.state === 'hitstun' || op.state === 'blockstun') {
    if (op.left >= 7 && d <= 106) return 'light';
    if (op.left >= 13 && d <= 136) return 'heavy';
    if (op.left >= 16 && d <= 110 + 4.5 * (op.left - 14)) return 'forward';
    return 'guard';
  }
```
Hmm 'hitstun' with left ≥ 16 — light hitstun 15, blast 20. Fine.

Careful — 'blockstun' while inc... rare, ignore.

Opp light section:
```
  if (op.state === 'light') {
    if (op.phase !== 'recovery' && d <= 115) return 'guard';
    if (op.phase === 'recovery') {
      if (op.left >= 7 && d <= 106) return 'light';
      if (op.left >= 13 && d <= 136) return 'heavy';
    }
    return 'guard';
  }
```
Wait — guarding their light startup at d ≤ 115: what if they're actually... state 'light' confirmed → it's a light ✓ guard safe (0 chip). But if d ≤ 106 and their startup left ≥ 7 (t ≤ -2 impossible; light startup only 5)... counter-light trade? Guard is fine. ✓.

Opp heavy section:
```
  if (op.state === 'heavy') {
    if (op.phase === 'startup') {
      if (d <= 106 && op.t <= 2) return 'light';   // their startup 9; my active 5-8 beats it if t ≤ 3ish
      if (me.ki >= 10 && d <= 140 && behindOK) return 'dash_forward';
      if (me.ki >= 10) return 'dash_back';
      if (d >= 118) return 'back';
      return 'guard';
    }
    if (op.phase === 'active') {
      if (me.ki >= 10 && d <= 140 && behindOK) return 'dash_forward';
      if (me.ki >= 10) return 'dash_back';
      return 'guard';
    }
    // recovery
    if (op.left >= 7 && d <= 106) return 'light';
    if (op.left >= 13 && d <= 136) return 'heavy';
    if (op.left >= 16 && d <= 110 + 4.5 * (op.left - 14)) return 'forward';
    return 'guard';
  }
```
Wait — opp heavy startup interrupt: their suLeft = 9 - t; my light active at 5-8 → need 9 - t ≥ 6 → t ≤ 3. I wrote t ≤ 2 (margin) ✓. But careful: if t ≤ 2 and d ≤ 106 → light. If t ∈ (2, ...] → dash options. dash_back from d ≤ 140: they whiff (200 away) ✓ then punish their recovery: my dash: free at 18; their heavy: started ~3-9 ticks ago, total 35 → free at 26-32 → my punish: light active at 18+ask... I'm asked at ~18-19 (recovery→free→ask next tick ✓ "恢复成空闲，下一个 tick 立刻调用"): light at 19, active 24-26 < 26?? marginal. d after dash_back = d+200 = 340 — REACH! No punish from 340. Hmm — dash_back is purely defensive ✓ fine.
  dash_forward through heavy startup: land behind at 10, free at 18; their heavy continues: if their t=5 at my dash: active 9-12 → they whiff (I'm behind... wait their heavy active: reach check d = (me.x - their.x)*their.facing — I'm behind → negative → NO HIT ✓ (their heavy whiffs); they're in recovery till 35-5=30 rel my dash start → my free at 18 → light active 24-26 < 30 ✓ COUNTER HIT 50 + combo ~224 total!! ✓ great. If their t=0: recovery till 35: even better ✓. If their t=8 (active in 1 tick!!): I dash: their active 9-12: at my tick 1-4: am I within their reach 140 in FRONT? I'm moving 20/tick: at tick 1: d-20... d ≤ 140 → at tick 1: d-20 ≤ 120 < 140 → THEIR HEAVY HITS ME at my tick 1?? — invuln: my dash t=1 < 9 ✓✓ DODGE. ✓ invuln saves. Then I pass → behind ✓. GREAT — dash_forward works for ALL their startup + active phases (d ≤ 140, behindOK). ✓.
  
Also opp heavy recovery at d ≤ 136 && left ≥ 13: heavy counter (150 + knockdown) — vs light (50 + combo 194): light combo better! But light needs d ≤ 106. At d ∈ (106, 136]: heavy ✓. Order: light first if d ≤ 106 ✓.

Opp dash section:
```
  if (op.state === 'dash') {
    if (op.phase === 'recovery') {
      if (op.left >= 7 && d <= 106) return 'light';
      return 'guard';
    }
    // moving
    const ml = 10 - op.t;   // moving ticks left
    const approaching = d < (prevD - 2);   // need history!
    if (ml <= 5 && approaching && d > 145 && d <= 306) return 'light';
    return 'guard';
  }
```
Need prevD tracking: store prevD each call (after decisions). prevD = d at last call. Approaching if d < prevD - 2 (they moved toward me ≥ 3... they move 20/tick while dashing; between my asks (≤6 ticks) d changes ≤ 120. If they dash AWAY, d grows. ✓ use history. Note prevD must be updated at END of brain or store unconditionally at start... I'll snapshot at start: const pd = prevD; prevD = d. Use pd.

Hmm wait — op dash moving AWAY from me (dash_back): d increases. They're retreating with ki — chase (forward). My rule returns guard... let me add: if !approaching → return 'forward' (chase) if d ≤ 400 else guard. Eh — d grows by 200; chasing ok. Add: `if (!approaching) return d < 500 ? 'forward' : 'guard';`

Opp recover (post-clash):
```
  if (op.state === 'recover') {
    if (op.left >= 7 && d <= 106) return 'light';
    if (op.left >= 13 && d <= 136) return 'heavy';
    if (op.left >= 15 && d <= 110 + 4.5 * (op.left - 14)) return 'forward';
    return 'guard';
  }
```

Opp charge section:
```
  if (op.state === 'charge') {
    if (me.ki >= 20 && !me.blastOut && !noCommit && d >= 180 && d <= 450) return 'blast';
    if (d <= 100) return 'light';
    if (d <= 130 && heavyFails === 0 && op.t >= 1) { lastAct='heavyN'; lastT=t; lastHp=me.hp; return 'heavy'; }
    return 'forward';
  }
```
Wait — blast vs charger: their charge ×1.5 → 105 if held. But blast startup 11 — they get 1-2 asks → might guard (12) — eh. Also they might release + blast me... noCommit handles. OK.
Hmm, op.t ≥ 1: at op.t === 0 (just started) — my info is 1 tick stale anyway. Fine.

Opp guard section:
```
  if (op.state === 'guard') {
    if (d >= 180 && me.ki >= 50 && op.ki < 20) return 'beam';   // beam the camper
    if (d <= 112 && heavyFails === 0 && oppGuard >= 2) { mark heavy; return 'heavy'; }
    if (d <= 104) return 'light';
    return 'forward';
  }
```
Light vs guarder: blocked (they +2 ki, pushed 14, I'm -1). Slightly bad but keeps pressure. Hmm — maybe don't light guarders at all; just walk closer then heavy when oppGuard ≥ 2. If oppGuard < 2 (they rarely guard — this guard is incidental) → light fine. Keep as written.
Beam the camping guarder: ki ≥ 50, their ki < 20 (can't blast-interrupt me)... they GUARD so they won't blast — the ki<20 check is about... a guarder could RELEASE guard and blast during my 30 startup (20 ki) → interrupt me (87 + I lose 50). If their ki < 20, they can't → my beam lands: they guard → 120 chip ✓; or they stay... they eat 120 min. ✓ good rule. d ≥ 180 (if closer, I'd rather approach/crush). Also require... their blast in flight? noCommit-ish: if inc (their earlier blast flying) → my beam startup eats it → skip beam if inc. Add !inc.

Also — beam the camper: after beam, blockstun etc. Fine.

Neutral section (op.state idle/forward/back):
```
  // both free, neutral
  if (op.state === 'forward' && me.ki >= 55 && !me.blastOut && !noCommit && d >= 230 && d <= 430) return 'blast';
  if (d <= 128 && (op.state === 'forward' || op.state === 'idle')) return 'light';
  if (op.state === 'forward' && d <= 200) return 'light';   // covered by above? d ≤ 128 only... 
```
Hmm: opp forward at d ∈ (128, 230): they're approaching — wait for them to enter light range? If I 'idle', they walk in; my next ask at d-27: if ≤ 128 → light ✓. So: opp forward && d ≤ 230 → 'guard'? or 'idle'? If they're approaching, I'll get another ask in ≤ 6 ticks (they close 27) → light at ~d-27 ≤ 128 if d ≤ 155. For d ∈ (155, 230): idle/guard for a tick then light. Return 'guard' (safe vs anything they do — they're far, nothing comes). Hmm 'guard' vs 'idle' — same (no threats at that range except... they could dash (200): land at d-200 ∈ (0, 30)→60; guard is fine ✓). Return 'idle'... whatever, 'guard'.
Wait, actually — opp forward at d ∈ (128, 155): my light NOW: active at 5-8; they close 4.5×(5-8) = 22-36 → contact at d-22..d-36 ∈ (92,133) — could exceed 110 if they stop early (their ask ≤ 6). Marginal. At d ≤ 128: worst case they stop at tick 1 and back 8: d + 24 - 4.5 = d+19.5 ≥ 147?? WAIT no — if they back off, distance GROWS: they were walking toward me (d shrinking 4.5/tick), then back (d growing 3/tick). If their ask is right after my light decision: they walk 1 tick (-4.5), back 8 ticks (+24) → d + 19.5 at my active... at my tick 5-8: d - 4.5 + 3×(4..7) = d + 7.5..16.5. d=128 → 144.5 > 110 whiff!! At my tick 5 (their back started at my tick 1): d - 4.5 + 12 = d + 7.5 = 135.5 — whiff at 110!! Hmm!! So light vs forward-opp whiffs if they immediately back off. d=110: 117.5 > 110 whiff. Even d=100: 107.5 ≤ 110 hit ✓. So safe threshold vs backoff-reactors: d ≤ 102; vs keep-walking: d ≤ 128 hit. Compromise: d ≤ 110 → light. Most walkers keep walking (they decided forward ≤ 6 ticks ago; they keep walking until next ask: they walk ≥ 1 more tick... their ask could be NOW (they asked same tick as me — engine: both asked same tick when due). Ugh. Take d ≤ 112 → light vs forward/idle.
  
  For opp 'idle' at d ≤ 112: light. They might back at their ask — d + 3×5 = 127?? their back starts ≤ 6 ticks... if they ask immediately and back: my active 5-8 vs their d + 3×(4-7) = d+12..21 → 124+ whiff!! Same issue. ANY light at d > ~90 whiffs vs instant-backers. Can't help it — bots that instantly back off whiff-punish... my light recovery 9: their punish: they see whiff (my recovery left ~9), they forward + light: they need d ≤ 110: their d ≈ 125 + 4.5×k... they walk 27 in 6 ticks → 98 → light → hits my recovery (50 counter + combo). So vs kiting bots, my lights get punished ~200. vs non-kiting bots, my lights net 174. Meh. Mitigation: track lightFails like heavyFails: if I return light at neutral (opp free) and next call I took ≥ 50 dmg within 30 ticks → lightFails++ → then raise light threshold (only light at d ≤ 90 or vs forward only...). Let me add lightFails: if lightFails ≥ 2 → only light when d ≤ 95 or op.state === 'forward'... hmm kiting bots back off — light vs 'forward' also whiffs vs them. Add: if lightFails ≥ 2 → light only at d ≤ 92 (they can't escape: 92+21 = 113... 92 + 3×8 = 116 > 110 — still whiffable!! light is 17 ticks total; their back during my startup+active: they were asked... if their ask is at my tick 0: back 8 ticks by my active end: d + 24 - 0... d=92 → 116 > 110 whiff at the margin. d ≤ 86: 86+24 = 110 ✓ hit. So safe threshold 86.) — if lightFails ≥ 2: light only d ≤ 86. That makes me quite passive vs kiters... kiters get cornered eventually (my forward chase). Corner + light at 86: safe (they can't back). OK.

Detecting light fail: when I return 'light' at neutral (mark lightN): next call: if me.hp ≤ lastHp - 50 && t - lastT ≤ 30 → lightFails++ (they countered my whiffed/blocked... blocked = 0 dmg to me ✓ no fail count; counter-hit = ≥ 50 to me... light hitstun on me: 40 — less than 50!! If they counter-light my whiff: I take 40 + their combo continues → I see next call AFTER their combo (I'm in hitstun/down through it) — total damage by then ≥ 40+32+26 = 98 ≥ 50 ✓ counts. If they merely light-trade me (40) and I'm free next... trade: both hitstun 15 → my next call at free: hp -40 → no count (40 < 50) ✓ good (trades aren't fails). OK.

Also — heavyN marking: when I return neutral heavy (vs guarder/charger): mark. If countered (hp -50 in ≤ 40 ticks): heavyFails++. Note crush on their guard hurts THEM not me ✓. Heavy whiff unpunished: 0 dmg ✓ no count.

```
  if (d <= 112 && (op.state === 'idle' || op.state === 'forward')) {
    if (lightFails < 2 || d <= 86) { markLight(); return 'light'; }
  }
  if (op.state === 'back') return 'forward';
  if (d > 320) return me.ki < 55 ? 'charge' : 'forward';
  if (d > 112) return 'forward';
  // d ≤ 112, opp idle/forward but lightFails ≥ 2 and d > 86: pressure without whiffing
  return 'forward';
```
Hmm 'forward' at d ≤ 86 vs a kiting bot: I walk in; they light me? My ask: op light → guard ✓. Their light at d ≤ 115 blocked ✓. Then I'm pushed... spacing. Kiting bots: walk in, guard their pokes, crush... oppGuard builds → heavy when they guard. OK-ish.

Also: opp 'back' && d ≤ 112: they're retreating close — light? They're backing: whiff risk high → forward ✓ as written.

Fallback end: return 'forward' if d > 60 else 'guard'.

Now — markLight/markHeavy helpers set lastAct/lastT/lastHp. Also note lastAct cleared each call before rules (the detection uses lastAct from previous call). Sequence per call: detect (using stored), then clear, then proceed & maybe re-mark. ✓ as coded.

noCommit: inc && eta > 12 → block my blast/beam starts (neutral blast rule has !noCommit ✓, camper-beam has !inc ✓, oki-beam: op is DOWN — can they have a blast flying? YES — they blasted, I punished (heavy), they're down, their blast still flying at me!! Oki beam with their blast incoming: my beam startup 30, their blast eta maybe 15 → hits me during startup → 87 + lose 50 ki!!! MUST check: oki beam requires !inc || inc.eta > 45. eta ≤ 45ish → block. Blast flight max: spawned at their front... if they're down (knocked back 150 by my heavy), blast spawned earlier... eta could be anything ≤ ~60. Add: oki beam only if (!inc || inc.eta >= 46). eta ≥ 46 = gap ≥ ~630 — rare. Practically: no oki beam while their blast flies. ✓ Also — while they're down and their blast incoming: my oki section: charge/guard... the INC section runs BEFORE oki section: eta ≤ 12 → guard ✓; eta > 12 → falls through with noCommit... oki beam blocked ✓, charge: blast hits charging me?? I charge during their down with their blast eta 20: my next ask (≤6): eta ≥ 14 → still charge?? Then eta ≤ 12 → guard ✓ SAFE (ask cadence 6 < 12 margin ✓). ✓ good.

Also opp 'hitstun' + inc... covered pattern-wise.

Beam while opp down — also check MY... fine.

Clash edge: my oki beam + their... they're down, no clash possible ✓.

One more: my blast rule vs opp 'forward' — noCommit && blastOut ✓.

Also ki spending audit: dash defenses (10), neutral blasts (20, ki ≥ 55), camper beam (50, ki ≥ 50 + their ki < 20), oki beam (50, op down). Charge to build. Fine.

What about my OWN beam at neutral when opp free at range with LOW ki and not guarding — e.g., opp ki < 10 (can't blast, can't dash): beam: they guard → 120; they eat 280. opp.ki < 10 && d ≥ 200 && me.ki ≥ 50 → beam?? They could still walk/dash... ki < 10 → no dash, no blast. They guard (120) or eat 280 or back off (still hit — ray covers). GUARANTEED ≥ 120 for 50 ki vs ki-broke opponents. Add: `if (d >= 200 && me.ki >= 50 && op.ki < 10 && !noCommit) return 'beam';` — also they could dash?? ki < 10 → no. ✓ include. Actually also if opp is far and their ki < 10 they're harmless — this is a great poke. Even d ≥ 150 (outside their heavy range... their light 110 — fine d ≥ 150). Use d ≥ 160.

Hmm wait — if ki exactly < 10: dash costs 10 — can't. Blast 20 — can't. Beam 50 — can't. They can only walk/guard/light/heavy. Light/heavy range 110/140 < 160 ✓ safe. ✓.

And vs opp ki < 10 at d ∈ (112, 160): approach normally.

Now — the "walk-interrupt their beam startup" rule: `suLeft >= 16 && d <= 100 + 4.5*(suLeft-14) && !incomingSoon` → forward. incomingSoon = inc && eta ≤ 14 (would eat blast mid-walk). ✓. But also while I walk forward, I get re-asked ≤ 6: fine, rules re-eval: suLeft shrinks, d shrinks → eventually light (d ≤ 106, suLeft ≥ 7) ✓. If suLeft drops below 7 while d > 106 → guard ✓.

Let me also double check the beam-startup dash rule (their startup): suLeft ≥ 12 && d ≤ 140 && behindOK → dash_forward: land behind at 10 < 12 ✓ safe; they fire at ≥ 12 forward (away from me) ✓; I'm free at 18; they're FIRING (stuck 40-fire + 20-recovery): light at 18 → active 24-26: they're firing (if their suLeft was 12: fire from my tick 12 to 52, recovery to 72). I combo them fully ✓✓. 

Also, what if suLeft ≥ 12 fails (they're late in startup, firing soon) and d ≤ 118: their beam will FIRE while... my options: guard (chip 120). Or dash if... d ≤ 118 dash-through FIRING — but they haven't fired yet; my dash: ticks 1-9 invuln; they fire at suLeft ≤ 11 < my landing 10... e.g., suLeft = 5: fire at my tick 5: ray spawns, front moves 30/tick; I'm mid-dash: front chases me from behind! Front at their front (their.x + 25f), moving toward MY ORIGINAL position at 30; I'm dashing toward/past them at 20. We approach... I pass them at tick (d/20); front spawns at their +25 ahead (toward me); I need to get past the ray's near edge (their.x + 25f + 30 = +55 rel) before invuln ends (tick 9): my rel position at 9: 180 - d... I'm at (20×9 - d) = 180 - d rel them (positive = past). Need 180 - d ≥ 55 → d ≤ 125. And front: at my tick 9, front at 25 + 30×(9 - suLeft) = 25 + 30×4 = 145 rel them (ahead, toward my original side = NEGATIVE... hold on, direction mess again. Let: opp at 0, facing MY original position = negative direction. Ray from = -25, front starts -40, moves -30/tick. I dash from -d toward +60 (behind them). Crossing ray's near edge at -25-30 = -55: I move +20/tick from -d: reach -55 at (d - 55)/20; reach safe (+past) — need (d-55)/20 ≤ 9 → d ≤ 235?? Hmm wait that's crossing the edge... I need to EXIT the ray: ray covers [-25, front(t)] (negative region); I'm inside once my position < -25+30?? inRay with pad 30: hit if x+30 ≥ lo && x-30 ≤ hi — ray extends as [min(from,front), max(...)] = [front, -25] (front negative). I'm hit if my x ∈ [front - 30, -25 + 30] = [front-30, 5]. I start at -d: d ≥ 60 → -60 ≤ -5... my x = -d: is -d ≤ 5? yes; is -d ≥ front-30? front at fire-start = -40 - 30k... if I'm inside [front-30, 5] → hit (when not invuln). I exit when my x > 5 (i.e., x ≥ 5, past their body-ish). I reach x = 5 at tick (d+5)/20. Invuln until tick 9: need... if I'm past 5 before tick 9 AND front hasn't passed BEYOND me... front moves negative — once I'm positive, front (negative) can't touch me (ray covers [front, -25] — all negative) ✓. So exit at (d+5)/20 ≤ 9 → d ≤ 175?! Hmm that contradicts earlier d ≤ 125. Earlier I said "clear ray edge +55" — with pad 30: hit region up to -25+30 = +5. So exit at +5: (d+5)/20 ≤ 9 → d ≤ 175. But ALSO: before I exit, while invuln (0-8), fine; at tick 9 I must be past +5: d ≤ 175. BUT the fire START: front = -40 at fire tick; front-30 = -70 initially — I'm at -d ≤ -60... if d < 70... d ≥ 60: if d = 60: I'm at -60, inside [-70, 5] → but invuln ✓. OK so vs imminent-firing beam (suLeft ≤ 11), dash-through works for d ≤ 175?? Wait but ALSO the front chases: does front pass me? front moves -30/tick, I move +20 — front approaches from my... front is at -40 (ahead of me, toward my origin? I'm at -d... -40 vs -d: if d > 40, front is BETWEEN us (closer to my origin side). I dash +, front moves -: we approach at 50/tick: front reaches me at (d - 40)/50 ticks after fire. If that's ≤ 9 while invuln ✓ dodge (like a blast). If > 9: at tick 9 I'm at -d + 180 = 180-d; front at -40 - 30×(9 - suLeft)... ray covers [front, -25]: am I in it at tick 9 (NOT inv