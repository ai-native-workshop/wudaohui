I need to write a JavaScript bot for this fighting game. Let me analyze the mechanics carefully and design a strategy.

Key facts:
- Stage x 40..960. Start 350 vs 650. Dist 300.
- Actions: idle, forward, back, guard, charge, light, heavy, blast, beam, dash_forward, dash_back, push.
- Light: reach 110, damage 40, startup 5, active 3, recovery 9, hitstun 15, chain up to 4 lights.
- Heavy: reach 140, damage 120, knockback 150, down 42.
- Blast: cost 20, speed 13, damage 70.
- Beam: cost 50, startup 30, fire 40, damage 280, knockback, down 50.
- Dash: cost 10, 200 distance over 10 ticks, invuln first 9.

Strategy considerations:
- Light chain combos: light hit gives opponent 15 tick hitstun, and cancel window next tick. Combo damage scaling: 1, 0.8, 0.65, 0.55. So 4-light chain: 40 + 32 + 26 + 22 = 120 damage. Then heavy? Actually you can cancel light into heavy/blast/beam too. Heavy after light chain: does the combo scaling apply to the heavy too? Yes—combo counter applies to all hits: `scale = R.combo[min(o.combo,...)]`. o.combo increments on each hit landed while opponent isn't free. So 4-light chain then heavy = 40+32+26+22+120*0.4=48 → 168 damage. Hmm, but heavy knocks down.

But note: to cancel, the light must HIT. So the key is: land light, get cancel window, chain more lights. Each light hit extends stun 15 ticks; light startup 5 + active + recovery... Actually cancel starts the new move immediately, so we can chain.

Total chain time: light startup 5 + active (hit at some tick) then next tick cancel. So ~6 ticks per light. 4 lights ≈ 24 ticks, total damage 120 with scaling, and each hit stuns 15 so opponent stays stunned. That's good.

- Heavy has counter multiplier x1.25 if opponent in startup/recovery of a move, and x1.5 if charging.
- Guarding: light blocked → 0 damage, blocker pushed, blockstun 11. Blast blocked → 12 chip. Beam blocked → 120 chip + stun until beam ends.
- Heavy vs guard → crush: 60 damage to guard, 34 tick stun.

Key: opponent AI bots. Unknown behavior. We need a robust generic strategy.

Important considerations for winning against unknown AI:
1. Don't get hit by beam: 280 damage is huge. Beam startup 30 ticks, so we have time to react, but our decision calls are every 6 ticks, so we see up to 6 tick latency. Beam travels 30/tick, so at long range we have time; but if close, 280 damage.

Defense options: guard against beam (chip 120, stun until beam end — but beam lasts 40 ticks of firing, so we'd be stunned ~76 ticks total while taking only 120 chip damage. That's actually good value! Blocking a beam gives only 120 damage instead of 280). Alternatively dash away (invuln 9 ticks, 200 distance) — but beam front advances 30/tick and covers a segment; dashing back 200 moves us out of the ray segment? The beam front goes from shooter forward 30/tick for 40 ticks = 1200 distance, covers whole stage. So dashing back doesn't escape a beam once fired — the ray extends to the front which advances; if we dash backward, the front keeps advancing past us... wait, the ray covers from `from` to `front`. `from` fixed at shooter's position, front advances. So once front passes us, we're covered regardless (the segment from shooter to front includes our position). Unless the beam hits the shooter... no.

Actually the beam hits once ("只打一次"). So beam hits whoever is in the segment. So dashing doesn't avoid it, except during invulnerability (9 ticks) - and note "无敌结束时如果还在光束里，照样挨打" - so the beam waits for us. Actually code: `if (invuln(R,o)) { dodge; continue; }` — b.hit stays false, so when invuln ends, it hits. So dashing doesn't help at all against beam (except... no).

So best defense vs beam: guard (120 chip, ~76 tick stun) or... interrupting the beam during startup! Beam startup 30 ticks; if we hit them during startup, the beam is interrupted ("发射期间你被打中，大招就断了" — during firing. During startup, being hit also interrupts: `stun` changes state, so `a.state !== 'beam'` and beams[a.side] cleared only if m.beams[a.side] exists... beams[a.side] is set at t === startup, i.e., at the moment of transition. During startup before that, m.beams[a.side] is null, and being hit stuns them, so they never fire. Yes! Interrupting beam startup is huge: 30 tick startup, and light startup is 5 ticks. If we land a light during their beam startup, we win the exchange (they lose 50 ki and the beam).

So key tactic: watch opp.state === 'beam' && phase === 'startup' → get close and interrupt with light (or heavy/blast). Blast travels 13/tick so it's slower. Light reach 110.

But wait: opponent in beam startup — mult() gives counter x1.25 for hitting them during startup.

Also we should be careful: when opponent in beam firing phase, guard to reduce damage.

2. Clash: if both fire beams, they clash. In clash, we get to push every 6 ticks. Power = 1 + 0.02*ki + 0.6 if pushing, +0.4 if hp<30%. Pushing costs 0.6 ki/tick extra. If we push constantly, our ki drains fast (0.2+0.6=0.8/tick) so after ~100 ticks ki is 0 → power = 0.5 + rage. Actually pushing drains ki, so power base changes. Hmm, power with ki=0 is empty=0.5 (+rage), with push? Note `power` function: `(f.ki > 0 ? base + kiPower*ki + (push? pushPower:0) : empty) + rage`. So push bonus only applies when ki > 0. So pushing at low ki is pure drain. So push when ki is comfortably high (e.g., ki > 30) and hp not low? Actually pushing when ki high: power ~ 1+0.02*ki+0.6. Drain 0.8/tick. At ki=100: power 3.6, drain 0.8/tick → sustains 125 ticks. Opp must push harder to win. Actually pushing is generally good: the drift is (pa-pb)*0.1 per tick toward weaker. If I push every 6 ticks (when asked), I have push true for that tick only? Let's see: in clash, `choose` sets `a.push = act === 'push'` each ask (every 6 ticks for clash: `nextAsk = m.tick+1` at clash start, then `every` = decideEvery 6). So push flag persists until next ask (6 ticks). So pushing every ask → 0.8 ki/tick drain. The other side might push too.

Clash is risky: winner takes 320 damage to loser plus knockdown; loser is the one who gets hit (320) — wait: "撞击点推到谁的身上，谁就吃下两道光束：掉 320 血" — the loser of the clash eats 320 damage. Winner's beam still needs to fire? After endClash, m.beams = null, so the winner doesn't finish the beam. Winner's state = 'recover' 20 ticks. So winning a clash = dealing 320 damage + knockdown 60 ticks. That's a huge win. Losing = take 320, knocked down 60 ticks.

So clash resolution: push to push the clash point to the opponent. It's like a tug of war with noise. Power differences: 1+0.02*ki. At ki 100, that's 3.0 (vs 2.0 base). drift = diff*0.1. So higher ki gives drift advantage.

Strategy in clash: push when ki high enough and not losing ground. Track clash pos from state.clash.pos (0 = on me, 1 = on opponent). We want pos → 1 (push to opponent). Determine my power vs oppPower given. If myPower > oppPower, pushing helps. But pushing drains ki which reduces power over time. Consider: don't push if ki is low (power dropping). Also rage: hp < 30% gives +0.4.

Let's design: in clash, compute myPower, oppPower. Push if myPower - oppPower > some threshold, e.g., myPower > oppPower + 0.3, and ki > 15. Actually pushing's benefit: +0.6 power while ki>0, costing 0.6/tick extra drain. Net over 6 ticks: +0.6 power for 6 ticks but -3.6 ki → -0.072 power per 6 ticks from ki loss... wait kiPower 0.02 per ki point: 3.6 ki = 0.072 power. Hmm, so pushing: gain +0.6 power now, lose 0.072*... let's compute steady: pushing drains 0.8/tick, power from ki part: 1+0.02*ki, ki decreasing at 0.8/tick → power decreasing at 0.016/tick. Versus not pushing: drain 0.2/tick → power decreasing 0.004/tick, but no +0.6.

Comparing power with push vs without at same time, assuming both same ki: push gives +0.6 immediately, decays faster. Over 6 ticks, with push: ki drops 4.8 → power drop 0.096. Without: drop 1.2 → 0.024. So advantage of pushing shrinks by ~0.072 per ask cycle. Starting at +0.6, pushing continuously stays ahead for ~8 cycles (48 ticks) at equal ki? But both sides drain; the one with more ki pushes. Hmm actually ki regen doesn't happen during clash (state clash → skipped in the ki gain loop: `if (a.state === 'ko' || a.state === 'clash') continue;` so no passive regen). So ki only drains.

Strategy: if myPower > oppPower (given in state), push. Since oppPower is computed with their current push status (they pushed last ask or not). If opp has more power, drift goes toward me, bad. Let's just push if myPower >= oppPower - small and ki > 10. Hmm, but if I'm weaker, pushing costs ki, making me weaker; better to conserve ki, wait for their ki to drain faster (they're pushing too). Since both drain: if they push and I don't, their power drops 0.8/tick in ki → their power falls 0.016/tick, mine falls 0.004/tick. So gap closes over time. Actually that's a good strategy: don't push, let them burn ki, then when their power drops below yours, start pushing.

But careful: their power includes +0.6 push bonus; when they run out of ki, power drops to 0.5.

So the clash logic: if myPower > oppPower + 0.15 → push. If opp is pushing and my ki higher, my power advantage grows? Let's just use: push if myPower > oppPower. Also don't push if ki < 8 (avoid falling to empty). Also if hp<30% we have rage bonus both sides presumably.

Actually one subtlety: power shown in state.clash is computed at view time (before action). My push flag from previous cycle is reflected. Good.

Also, if clash t is large (near 360) it's a draw (120 damage each) — fine.

Also: can we avoid clash? If opponent fires beam and we're also firing beam → clash. If we guard instead, we take 120 chip and stun until beam ends. Hmm, but "一直硬直到大招结束" - the code: `stun(o, 'blockstun', kind === 'beam' ? ctx.stun : M.blockstun)` where ctx.stun = startup+fire-a.t+6. So stun ≈ remaining fire ticks + 6. Beam fire is 40 ticks, front advances 30/tick covering stage in ~30 ticks. Guarding a beam: 120 damage, then blockstun ~46 ticks, and during that we can't act, but beam only hits once. That's acceptable: 120 damage, and we get 2 ki.

Alternative: interrupt during startup 30 ticks with light hit → prevents beam entirely. That's better if reachable.

3. General aggression: light chain combos are strong. 4-light chain: 120 damage over ~24 ticks, keeps opponent in hitstun. Opponent counterplay: they can't guard during hitstun (guard only in free state). After 4th light we must cancel into something else or take recovery 9 ticks (opponent recovers from hitstun at some point: hitstun 15 tick from last hit, our recovery is 9 ticks from cancel start, so we have ~6 ticks free before they recover... hmm).

Actually important: light hit at active frame. Timeline: light start t=0, startup 5 (t=0..4), active t=5..7. The hit happens at the tick when active and in range; then cancel flag set. Next tick we get asked (cancel), and can start new light immediately (t=0). So each light cycle ~6 ticks + our decision latency? The cancel ask occurs "the next tick" exactly. Our decide is called at that tick, so we start the next light immediately. So 6 ticks per light hit if we're in range.

Opponent hitstun: 15 ticks from each hit, so they stay stunned.

After 4 lights (chain limit 4), we can cancel into heavy/blast/beam, or let it recover. With 4 light hits then heavy: damage 40+32+26+22 = 120 then heavy 120*0.4 (combo scale index 4 = 0.45? R.combo = [1,0.8,0.65,0.55,0.45,0.4], index min(o.combo,5). After 4 hits o.combo=4, so 5th hit scale = combo[4] = 0.45 → heavy 54 damage. Plus counter? Opp is in hitstun, not startup/recovery, so no counter bonus. Total 174.

Alternatively: light, light, light (3 hits: 40+32+26=98), then heavy → combo[3]=0.55 → 66 → total 164. Less. Or 4 lights then blast (70*0.45=32) — meh. Better to keep light chain for damage efficiency? Light damage per tick: 40 at full, but 4th is 22.

Actually best might be: light chain then heavy for knockdown (down 42 ticks, opponent untouchable then, but we get 20 tick recovery). Hmm, knockdown gives opponent untouchable time which isn't great for us, but the damage is there.

Alternatively don't knockdown: after 4-light chain just recover 9 ticks and be free again; opponent hitstun ends 15 ticks after last hit. Timing: 4th light hits at tick X; opp stunned until X+15. Our 4th light cancel window at X+1; we choose e.g. 'idle'? No — cancel with a non-attack action returns to normal recovery. So light's recovery 9 ticks from X+1 → free at X+10. Opp free at X+15 (they're in hitstun until then). So we have 5 ticks free before opponent is free → we can start another light (startup 5) and hit exactly at X+15-ish when opponent becomes free... but at that point opponent might act (they get asked at next tick when free). Their startup 5 ticks vs our startup 5 → simultaneous. Hmm.

Better: use the cancel to chain another light after the 4th? Chain limit: `a.chain = act === 'light' ? (chained ? a.chain + 1 : 1) : a.chain;` and cancel allowed only if `a.chain < R.light.chain` i.e. chain<4. So a 4th light can be started when chain=3 (chained → chain becomes 4). Wait: condition `(act === 'light' && a.chain < R.light.chain)`. When we start the first light, chain=1 (not chained). Cancel: act light with chain<4 → allowed when chain is 1,2,3. Starting from chain=3 → new chain=4. So 4 lights total, then next cancel (chain=4) light not allowed. Correct: max 4 lights in a row.

So the max string: L L L L then heavy/blast/beam, or L L L L then recovery.

Hmm, what about mixing: light, light, heavy (heavy has 35 tick total), damage 40+32+120*0.65=150? Wait after 2 hits o.combo=2, 3rd hit scale = combo[2]=0.65 → heavy 78. Total 150. vs LLLL heavy: 120 + 54 = 174. So 4 lights better. But heavy knockback 150 pushes opponent away, ending combos. Heavy recovery 22 ticks leaves us vulnerable.

What about LLLL then blast (startup 11, projectile 13/tick speed): damage 70*0.45=32, and the blast may be blocked. Meh.

So plan: chain light up to 4, then decide based on range/opponent.

Key: hit requires distance ≤ 110 at active frame and opponent not invulnerable.

Approach strategy: We need to close distance from 300 to ~110. forward walks 4.5/tick → 190/4.5 ≈ 42 ticks. Meanwhile opponent may attack. Or dash_forward: cost 10 ki, moves 200 in 10 ticks, invuln 9 → lands behind opponent if room (from 300 distance: x1 = me+200 = 550 if me at 350; opponent at 650; before>0 and after = (650-550)=100 >= minGap 60 → not crossing, so no special: after=100 not < 60, so x = 550. Distance 100. Then we're in light range but we land behind them? At 550 vs opp 650, opponent is to our right, so facing is right — we did not go through. Fine, dash brings us from 300 to 100 distance in 10 ticks, and we're invulnerable during 9 of them. That's efficient and safe! But careful: the dash passes through the opponent if landing would be within 60. Distance 300, dash 200 → 100 remaining, so no crossing. Good. But if the opponent also moves... Also they might dash away.

But is dashing in risky if the opponent has a blast in flight? Invuln 9 ticks of 10 dash ticks, and blast hits if we're in invuln → dodged (b.dodged=true, blast continues). Actually the blast passes through during invuln but then continues and can hit later? Blast moves 13/tick, once it passes beyond us it goes on. So dodging a blast with dash works if we dash out of its path? The blast continues forward past us; since invulnerable only 9 ticks, but blast moves past in 1 tick. After passing, it's behind us, never hits. OK.

Also dash into opponent's light: invuln dodges it.

Hmm, but dash costs 10 ki and has 8 tick recovery; also the dash "passes through the opponent" so after landing behind them, we're behind them, and the opponent turns to face us (if free). Light reach is directional? `d = (o.x - a.x) * a.facing` must be >0 → we must face the opponent. After landing behind them, our facing is stale (still toward their old position) for recovery 8 ticks, during which the opponent turns to face us. Actually the rule: "落地后到收招结束前你还面朝原来的方向；对手空闲的话会立刻转身" — opponent turns to face us, but we keep facing the old direction. So after dash recovery, we re-face (face() is called for FREE states each tick). Then light works.

Hmm, one big consideration: what's the opponent AI like? Unknown. Let's write a robust bot:

State machine:
- If clash: push logic.
- If me not free (state is light/heavy/blast/beam/dash/hitstun etc.) → we can't act except cancel window. The engine only asks when free or cancel or clash. So decide is only called when free (or cancel or clash). Actually wants(): free states, or cancel. In cancel state, me.state is 'light' but canCancel true. So decide gets called: check state.me.canCancel.

Decision logic when free:
1. If incoming blast (eta) → consider: guard? blast blocked = 12 chip + blockstun 14. Or dash? Or back away. Best to guard if we can't dodge; or blast-cancel? We can't cancel blasts. Actually we could dash_back (10 ki) if the blast is close-ish? The blast travels 13/tick; our dash back moves 200 over 10 ticks but is invulnerable 9 ticks. Blast reaches in eta ticks; if eta < ~10 we can dash and dodge it (it passes). Actually simpler: guard (only 12 chip damage). But guard pushes us back? No, blast block doesn't push. Guard gives blockstun 14 and 2 ki. Damage 12 — fine. But if we were about to attack, guarding loses tempo. Alternatively back away: walking 3/tick vs blast 13/tick — can't escape unless we have distance. If eta is large, back away to make eta larger. Let's: if incoming blast and eta <= 8 → dash_back if ki>=10? Hmm dash_back invuln 9 ticks; blast arrives in eta ticks; but the blast path: it continues past us after passing our position; we need the blast to pass while we're invulnerable or we've moved out of the beam path. Moving backward doesn't help since the blast comes toward us and we retreat at 3/tick vs 13 → catches up. Unless we retreat to the wall and it's still coming. So dash (any) with 200 movement: if we dash backward we move 200 in 10 ticks → 20/tick, faster than blast's 13/tick → escapes if we have room behind. Dash forward also works if we can pass the blast (invuln 9 ticks, blast passes us in 1 tick). So: if incoming blast eta <= 10 and ki >= 10 → dash (forward if opponent is far-ish / back if we need space). Simplest: guard; chip damage 12 is negligible. But blockstun 14 ticks delays us. Hmm. Alternatively blast to cancel their blast! Two opposite blasts cancel: if we fire a blast (startup 11) and theirs is incoming with eta small, ours might not come out in time. Their blast must be fired 11 ticks prior. If eta <= 11, we can't cancel (our startup 11 + travel). Actually ours appears at tick 11 after start; theirs hits at eta. If eta<=11 they hit before we can fire. So no.

Let's do: incoming blast eta <= 6 and ki>=10 → dash_back (or dash_forward); else if eta <= 20 → guard to absorb 12 chip? Actually maybe better: blast our own to cancel if our startup finishes before theirs arrives: we need eta > 11 + travel to meet. Travel: they travel at 13/tick; ours too; they meet midway. If we fire now, our blast appears at tick+11 at our position; theirs at that time is eta-11 ticks away from us, i.e. distance (eta-11)*13 + 30 (body offset). They'd have hit us at eta. Our blast would spawn at our position and move toward them; their blast moves toward us. They'd cross between. If eta-11 >= 1, their blast hasn't hit us yet at our spawn time; then two blasts meet and cancel → we saved 70 damage at cost of 20 ki and a blast (28 ticks of recovery). Not worth it generally vs guard's 12 chip.

Best: guard. Blocked blast = 12 chip, 14 stun, +2 ki. Compare to taking 70 damage. Guard is good.

But watch out: opponent might blast and we guard, then they blast again? Only one blast per person.

2. If opp.state === 'beam' && opp.phase === 'startup' → interrupt! If dist <= 110 → light (fast startup 5). If dist <= 140 → heavy (startup 9, damage 120, but opponent in startup → counter x1.25 = 150, plus knockdown). Hmm heavy startup 9 vs their 30: safe. But heavy knocks down 42 ticks and gives 20 ki gain from damage. Light: 40*1.25=50, leaves them in hitstun 15, they can then guard. Heavy interrupt: 150 damage and knockdown. But if they're close to firing... heavy startup 9 + active 4 → hits at t=9..12, their beam would fire at t=30. Safe.

But risk: if we're in range but they hit us first with something. If opp is in beam startup, they can't hit us (startup only). So interrupt is free. Choose heavy for max damage. But heavy's knockback pushes them 150 away, then they resume. Good.

If dist > 110 during their beam startup: we need to close fast: dash_forward (200 in 10 ticks) — invuln. Distance 300 → after dash 100 → within light reach. Timing: we start dash at tick T, land at T+10, then light startup 5 → hit at T+15. Their beam fires at T+30. Safe. But careful: if dist is like 200, dash lands at dist 100? dash 200 forward from 200 distance → we'd overshoot and go through them: landing behind them! Then facing issue: after dash recovery (8 ticks), we turn to face them; we can hit them from behind? No — light requires (o.x - a.x)*a.facing > 0, we face them so it's fine once we re-face. But during dash recovery we can't act. Total: dash 10 + recovery 8 = 18 ticks, then light startup 5 → hit at T+23, still before their T+30. Tight but ok. Alternatively blast: startup 11, travels; damage 70 and no interrupt of beam startup? Blast hit during startup → stuns them, interrupts. Distance 200, blast needs (200-40-30)/13 ≈ 10 ticks travel → hit at 21 ticks after firing. Hmm.

Also we could just guard the beam: 120 chip. But interrupting is much better.

3. If opp.state === 'beam' && phase === 'firing' → guard (120 chip + stun) — unavoidable. Actually wait, if the beam's front hasn't reached us yet, could we move out of the ray? The ray covers from `from` (shooter +25) to front, and front advances 30/tick until it clamps at stage edges. Once front passes us, we're covered. If front is still before us (they're far and beam hasn't reached us), we could dash back... but the front keeps advancing 30/tick so it will reach us. Unless we outrun it? Backward walk 3/tick, no. Dash back 20/tick effective but beam front 30/tick — beam catches up. So no escape. Guard.

Actually, is there another option: since the beam hits once and the ray covers from shooter to front, if we get behind the shooter? Impossible (they face us).

Hmm, but one trick: beam front clamps at stage.right+40 etc. Not helpful.

So: guard vs firing beam. 120 damage and long stun. It's a big loss but unavoidable.

4. Opponent is free and in range (dist <= 110): attack with light (chain logic). If opponent in startup/recovery → counter bonus. Prefer light (startup 5) for fast damage, then chain.

Opponent in range and guarding (state 'guard')? Then light gets blocked. Heavy vs guard → crush (60 damage, 34 stun). Hmm, but heavy startup 9; if they guard, heavy crushes them. Blast also blocked (12 chip). Beam blocked (120 chip). So vs guard, heavy is the answer (60 damage + stun). But heavy has 22 recovery → they recover from crush at 34 > our recovery, so we can follow up. Actually crush stun 34 ticks, our heavy recovery 22 → we have 12 ticks to act while they're stunned. We could light (startup 5) → hits at 17 after heavy start, they're crushed until 34. Good, 40*... their combo counter resets? o.combo increments only on hits; they're in 'crushed' state — combo scale applies (they're not free). But wait, `stun` sets state; `o.combo` increments in land() only when hit lands. Heavy vs guard → crush path doesn't increment o.combo (returns early). So the subsequent light is scale 1 → 40 damage.

Hmm, so vs guard: heavy (60) then light (40) then maybe more.

But how do we know they're guarding? state.opp.state === 'guard'. Also blockstun/crushed.

5. Opponent far (dist > 110): approach. Options: forward walk, or blast (if ki >= 20), or dash_forward (ki >= 10). Also charge to build ki.

Consider the "correct" strategic loop: many unknown AI opponents. Let's think about what typical AI would do: probably approach, attack, block, sometimes blast. A robust bot should: keep distance just outside opponent's light reach (i.e., >110) and use blast? Blast range is unlimited but travel time. Hmm.

Let me think about a strong generic strategy: "zoning with blast + light chain". But we don't know.

Maybe the best is a balanced approach: maintain spacing, use blast at mid range (dist 150-250?), dash in for combos, guard when they attack.

Actually let's think about the risk/benefit of each engagement:

Light chain (4 lights): 120 damage over 24 ticks of opponent stun. Then opponent free. Damage per second: 120 damage per 24 ticks ≈ 300 dmg/sec?? That's fast. But we need to be in range and hit the startup. Our first light startup 5 while they might be starting their own. If they hit us during our startup, we lose the trade (they take 40, we take 40 but we might get hit by a heavy = 120).

Heavy: 120 damage + knockdown 42 (opponent untouchable, but also free time for them). 9 startup + 4 active + 22 recovery = 35 ticks total.

Beam: 280 damage, startup 30, 40 firing + 20 recovery = 90 ticks. But 280 damage is huge; and if it hits, opponent knocked down 50 and pushed 120. Very strong if it lands. Costs 50 ki. If it hits, opponent takes 280 → nearly dead. But we must survive the 30 startup (risky if they attack) and then guard their response (they may be stunned from beam knockdown 50 ticks; after that they're up and can act while we still have 20 recovery + ...). Actually beam total 90 ticks and we only act at the end.

Given opponents can also beam, and beam clash gives 320 damage to the loser, maybe both use beams. Interesting: whoever is losing HP-wise might want to beam for a burst.

Given the unknown AI, I'd write a bot with these principles:
- Never waste ki below needed.
- Prefer light chains (reliable, low risk, high damage rate).
- Use heavy when opponent is in startup/recovery (counter 1.25 → 150) or when they are guarding (crush).
- Use blast at range when opponent is far and approaching, to slow them (70 damage, 20 hitstun).
- Use beam when ki >= 60 and opponent is far (need 30 startup safe) or as finisher when opponent hp low.
- Guard when opponent's attack is about to land (they're in startup of light/heavy/blast) — but guard vs heavy = crush 60 damage + 34 stun (bad!). So vs heavy startup, better to dash (invuln) or back away, not guard! Heavy crushes guard. So guard only vs light/blast/beam.
- Dash back when opponent heavy is in startup within reach.
- Interrupt opponent beam startup.

Let's define threat detection:
- opp.state === 'light' && opp.phase === 'startup' → they will hit in (5 - opp.t) ticks if in range. If dist <= 110: options: guard (block, no damage, push back 14, blockstun 11) or dash (invuln). If dist > 110, no worry.
- opp.state === 'heavy' && startup → hits at 9-opp.t; guard = crush (60 dmg + 34 stun) — bad. Dash to avoid (need ki 10). Or back out of range 140: heavy reach 140, need dist > 140 at impact. Back walk 3/tick; if heavy startup 9 ticks and dist 130, we need +10 distance in 9 ticks = 1.1/tick → walking back at 3 works if we have room. But turning: they face us, we walk back, they stay. OK. But if they dash... whatever.

Let me simplify: when opponent heavy startup and dist <= 140 and we have ki >= 10 → dash_back (invuln 9 ticks covers the hit) but wait, dash_back costs 10 ki and moves us 200 away; we might have to redo approach. Alternatively dash_forward to go through them (also invuln) and land behind → then their heavy hits nothing (they face old direction) and we're behind them with an opening! That's a great counter: dash_forward through the heavy. But dash forward may be blocked by their position (landing behind requires room).

Hmm, but actually dash during their heavy startup: if we dash forward and pass through, their heavy active frames check d = (o.x - a.x)*a.facing > 0 → we're behind, d<0 → miss.

That's strong but costs ki and time (18 ticks to be actionable).

Simpler robust: if opp heavy startup and dist <= 140 → if ki >= 10: dash_forward if there's room behind them (wallAhead relative to them? we can check stage edges: opponent's position + room). We know their x and facing: they face us. Room behind them = (their facing == 1 ? 960 - opp.x : opp.x - 40). If room >= 60 → dash_forward (we pass through, land behind, they miss). Else dash_back if we have room behind us (our wallBehind >= ~100) → else guard (60 chip) or back-walk.

Hmm, dash_back when wallBehind < 200 → we stop at wall; dash_end clamps; still invuln so the heavy misses! Actually invulnerability lasts 9 ticks regardless of movement. The heavy's active window is 4 ticks; if we dash at their startup t=9 (i.e., 1 tick before active), our dash invuln covers ticks 0-8 of the dash (a.t < 9). Hmm: dash state t increments each tick; invuln when a.t < 9. If we start dash at tick T, at tick T we have t=0 (invuln), T+1 t=1 ... The strike check happens in the same tick before a.t++? Order in step: choose → move → separate → face → strikes (phase computed with a.t) → ... then a.t++. So when we start dash via decide at tick T, the state is set to dash, t=0, then move() moves (dash moving since t<10) and strikes check invuln(a) where a.t=0 → invulnerable true. So dash at tick T gives invuln at ticks T..T+8 (9 ticks), then at T+9 not invuln (dash t=9, moving phase continues until t<10). Good, 9 ticks of invuln from T to T+8.

So dash timing: to dodge a heavy whose active starts at T_hit = T_decide + (9 - opp.t): we want our dash to start before T_hit and cover T_hit..T_hit+3. Our invuln covers T_decide..T_decide+8. So if 9-opp.t <= 8, i.e., opp.t >= 1, fine. If opp.t === 0 (just started), active starts in 9 ticks → invuln ends at T+8, active at T+9..T+12 → we'd be hit! Careful. So need opp.t >= 1 for dash to fully cover; or dash and hope the heavy active frame lands within. Actually heavy active = 4 ticks: t in [9,13) → hits at ticks T+9..T+12 where T = their startup start. Their startup started when they chose heavy; opp.t = number of ticks in startup. If opp.t = 0 (they chose this tick) → active at T+9. Our dash started also at T (we see the same tick? We decide at the same tick they decide — we see their state before they act! In step(), views are computed BEFORE choose for both. So at tick T, we see opp.state from previous tick (e.g., 'idle' or whatever). Their decision at tick T is simultaneous and we see the result next tick (T+1) as opp.state='heavy', opp.t=0. Then our next ask... we're asked every 6 ticks! So we might not learn about their heavy until up to 6 ticks later. Ugh. Latency is significant.

So reaction: at tick T+1 we learn opp.state='heavy', t=0 (their startup just started). If we're asked at T+1, we dash → invuln T+1..T+9, their active T+9..T+12 → hit at T+9! Not covered (t=9 not <9). Risky. If we're asked at T+2, dash invuln T+2..T+10, covering active T+9..T+12 partially: at T+9 (dash t=7) invuln → dodged. At T+10 (t=8) invuln; T+11 (t=9) not invuln → they'd hit again? No—`a.hit` flag: heavy connects once (a.hit set true when it lands). If the first active frame was dodged (invuln → continue, no hit set), the next active frame could hit. Their active frames are t=9,10,11,12 → 4 frames. If we dash at T+2, invuln covers T+2..T+10 → frames at T+9,T+10 dodged, T+11 (dash t=9, not invuln) → hit! Bad. So we need dash to start at T+3 or later (invuln T+3..T+11 covers T+9..T+11, but T+12 → dash t=9 → hit). Hmm! Active is 4 ticks, invuln is 9 ticks. To cover all 4 active frames, dash must start such that T_start+8 >= T+12 → T_start >= T+4. And T_start <= T+9 obviously (else too late). So dash between T+4 and T+9.

But if we see them at T+1 (opp.t=0) and our next decision is at T+1 (we're asked every 6 ticks), we can't time it. Alternative: dash later? We can't delay a decision — but we can choose 'idle' and then dash at the next ask. Our asks are every 6 ticks: if asked at T+1, next ask at T+7 → dash at T+7 → invuln T+7..T+15, covering active T+9..T+12. 

So the strategy: on seeing opp heavy startup with opp.t small, if we can't react immediately, wait until we've seen enough ticks (opp.t >= 4) then dash. But we only get asked every 6 ticks; when asked, opp.t will be 0, 6, or 12 etc. Hmm: if we are asked at T+1 (opp.t=0) and choose idle, our next ask is T+7 where opp.t=6 → heavy's active already happened at T+9? No wait, T+7 < T+9. opp.t=6 means 6 ticks into startup; active begins at T+9. Dash at T+7 → invuln T+7..T+15 → covers T+9..T+12 fully. 

But we might be asked at T+2 (opp.t=1) → next ask T+8 (opp.t=7) → active T+9..T+12, dash at T+8 → invuln T+8..T+16 → covers. Good.

But if we're asked at T+5 (opp.t=4) → active at T+9; dash at T+5 → invuln T+5..T+13 covers T+9..T+12. Good.

So rule: if opp heavy startup and we would be hit (dist <= 140), dash at a time such that our invuln covers their active. We can compute: we know opp.t (ticks into their state) and phase. Their active starts at startup - opp.t ticks from now, and lasts 4 ticks. If we dash now, invuln covers now..now+8. Their active window = [startup - opp.t, startup - opp.t + 4). If now+8 >= activeEnd - 1 → covered. i.e., (9 - opp.t) + 3 <= 8 → opp.t >= 4. So: if opp.t >= 4 → dash now. If opp.t < 4 → we can't cover fully now; wait (idle or back) and dash at the next ask, when opp.t will be >= 4 (if next ask is 6 later: opp.t+6 >= 4 ✓; but also need opp.t+6 <= 8 to still be in startup... if opp.t was 3, next ask opp.t=9 → already active (t=9 is active) → too late, we get hit!). Hmm. So if opp.t is 1,2,3 and we can't cover now: e.g., opp.t=1: active starts in 8 ticks, ends at 11 ticks from now. Dash now covers 0..8 → active frames at 8 (covered),9,10,11 not covered → hit. Dash at next ask (6 later): active already started at 8, frames 8,9,10,11 → dash at 6 covers 6..14 → covered! Wait dash at now+6 covers now+6..now+14 → active at now+8..now+11 → all covered. Yes! Because the active window has 4 frames and invuln is 9 ticks, we just need the dash to start at or before activeStart and end after activeEnd. Dash start must be >= activeStart-9 and <= activeEnd-1... Let me redo: dash start at S covers [S, S+8]. Need [activeStart, activeEnd] ⊆ [S, S+8] → S <= activeStart and S+8 >= activeEnd → S >= activeEnd-8 = activeStart-4. So S ∈ [activeStart-4, activeStart]. activeStart = 9 - opp.t (in ticks from now). So S ∈ [5-opp.t, 9-opp.t]. If opp.t = 0: S ∈ [5,9] → need to wait 5-9 ticks. Our next ask might be at 6 → OK if our ask is at 6 (and we choose dash). If our next ask is sooner (we decide at a random phase)... Since asks happen every 6 ticks, relative to their decision time the offset varies. If we're asked now (their t=0) and next ask in 6 → their t=6 at that ask, dash covers [6,14] vs active [9,12] ✓.

If we're asked at their t=0 but our next ask is 6 later — fine. But what if the situation arises where we're asked at their t=3 (activeStart=6, activeEnd=9, need S ∈ [2,6]) → next ask at 6 → S=6 ✓ (allowed, S<=activeStart=6). If asked at their t=4 → S ∈ [1,5]; next ask at 6 → too late (S=6 > activeStart=5)! Then we should dash NOW (S=0 ∈ [1,5]? 0 < 1 → no, doesn't cover: active [5,8], dash covers [0,8] → 0<=5 ✓ and 8>=8 ✓ → actually it does cover! Let me recheck: dash covers ticks 0..8 inclusive (9 ticks). Active frames at 5,6,7,8 → all in [0,8] ✓. My inequality: S+8 >= activeEnd where activeEnd = activeStart+3 = 8 → S >= 0. Hmm I mis-derived: activeEnd-1 = last frame = activeStart+3. Need S+8 >= activeStart+3 → S >= activeStart-5. And S <= activeStart. So S ∈ [activeStart-5, activeStart] = [4-opp.t, 9-opp.t].

Redo: opp.t=0 → S ∈ [4,9]: need to wait 4-9 ticks. Next ask at 6 → S=6 ✓ if we don't need to act now. But if we are asked NOW at opp.t=0 and decide idle, next ask is +6 → their t=6 → dash → covers. But what if our ask cadence means we get asked at their t=0, and they hit... we wait — fine.

opp.t=3 → S ∈ [1,6]. If asked now (S=0) → too early (dash covers 0..8, active at 6..9 → frame 9 not covered). So we should idle and dash at next ask (+6 → S=6, active [6,9], covers 6..14 ✓). But hold on, if the timing works out we might have to dash at the right moment. Since our asks are every 6 ticks and their decision is also every 6 ticks (but offset), our ask times relative to their t: we observe their t at our ask; their t increments each tick. Since their heavy started at some tick, at our ask their t = (ourAsk - theirStartTick). We can compute exactly: at each ask we see opp.t. If opp.t is in the danger zone we can't cover, we should act at the next ask. The risk: their t at our next ask = opp.t+6; we need S(=opp.t+6) ∈ [4-opp.t, 9-opp.t] → opp.t+6 <= 9-opp.t → opp.t <= 1.5, and opp.t+6 >= 4-opp.t always. So if opp.t <= 1, next ask works (their t=6 or 7 at next ask → S=6/7 ∈ [4-7,9-7]=[-3,2]? wait recompute with their t at next ask: if their t at next ask is 6, activeStart = 9-6 = 3 ticks from now, activeEnd = 6. Need S ∈ [activeStart-5, activeStart] = [-2, 3] → S=0 (dash now) ✓! Ugh, I conflated. Let me redo carefully: at the moment of decision (now), opponent heavy startup, opp.t ticks elapsed. Active begins when opp.t reaches 9, i.e., in (9 - opp.t) ticks. Active frames: at now+ (9-opp.t) ... now+(9-opp.t)+3.

If we dash now (S=0), invuln covers ticks now..now+8. Need 9-opp.t+3 <= 8 → opp.t >= 4.
If we dash at S ticks from now, need S <= 9-opp.t and S+8 >= 9-opp.t+3 → S >= 4-opp.t.

So the feasible S range is [4-opp.t, 9-opp.t] (intersect with >=0).
- opp.t=0: S ∈ [4,9]. Our next ask is +6 → S=6 ✓ (and we should idle now). But careful: our ask at +6 — during those 6 ticks, could they cancel the heavy? No.
- opp.t=1: S ∈ [3,8] → next ask +6 ✓ (S=6 ∈ range). idle now.
- opp.t=2: S ∈ [2,7] → next ask +6 ✓ (6 ≤ 7). idle now.
- opp.t=3: S ∈ [1,6] → next ask +6 → S=6 ✓ (6 ≤ 6). idle now.
- opp.t=4: S ∈ [0,5] → dash now (S=0 ✓) but next ask +6 → S=6 > 5 ✗. So dash now.
- opp.t=5: S ∈ [-1,4] → dash now (0 ✓); next ask +6 ✗.
- opp.t=6: dash now ✓ (0 ∈ [0,3]).
- opp.t=7: S ∈ [-3,2] → dash now ✓.
- opp.t=8: S ∈ [-4,1] → dash now ✓ (0 ≤ 1). But at opp.t=8, active starts next tick → dash now covers ✓.
- opp.t>=9: they're in active phase (phase 'active'), not startup. Handle separately: if opp.phase === 'active' and dist<=140 and heavy → we need to dodge NOW; but their hit is this tick... we're asked at this tick and decide before strikes! The order: views computed, ask called, choose applies, then move, then strikes. So if we dash at this tick, we're invulnerable (dash t=0) at the strike check → dodge. But wait, `invuln` checks a.state==='dash' && a.t < 9. Since choose set state='dash', t=0 → invulnerable. And the heavy strike check: `if (invuln(R, o)) { dodge; continue; }` → no hit. But the heavy keeps active for 3 more ticks (t=10,11,12) and our dash invuln covers t=0..8 → the heavy could hit at t=9,10,11,12 → wait heavy active = t in [9,13). If we dash at t=9 (their first active frame), our dash covers our ticks 0..8, i.e., until our dash t=8 → which corresponds to their t=9+8=17? No—our dash t increments in lockstep with ticks. We dash at tick X (their t=9). Our dash t=0 at tick X, t=8 at tick X+8. Their heavy active frames at ticks X (t=9), X+1 (10), X+2 (11), X+3 (12). Our invuln covers X..X+8 → all four frames covered ✓. Great — so dashing at their t=9 works.

Hmm wait, earlier I said opp.t=8 dash now covers active starting next tick: their active frames at ticks X+1..X+4 (t=9..12) where X = now (their t=8). Our dash covers X..X+8 ✓.

And opp.t=0: dash now covers X..X+8; their active at X+9..X+12 → not covered. So we must wait until S ∈ [4,9]: dash at X+4 (their t=4) covers X+4..X+12 ✓ covering active X+9..X+12.

But we only get asked every 6 ticks! At opp.t=0 we can't dash at S=4 unless our next ask happens then. Our next ask is +6 (S=6) → their t=6 → dash covers X+6..X+14, active X+9..X+12 ✓. 

But here's the catch: is our ask cadence exactly 6 from now? `a.nextAsk = m.tick + a.every` where every = decideEvery = 6. And when free, nextAsk increments by 6 each ask. But the extra cancel ask also resets nextAsk = tick+6 (choose sets a.nextAsk = m.tick + a.every always). So roughly every 6 ticks. OK.

So the rule: on seeing opp heavy startup, compute opp.t. If opp.t >= 4 → dash now (if ki >= 10 and dist <= 140). If opp.t < 4 → we can't dash now safely; idle (or back) and dash at the next ask (their t will be 6+ which is >= 4 → dash). But we must remember we need to dash at the next ask! Use a module-level variable flag (top-level vars persist within a match, reset each match as the file is reloaded). "文件外面的变量可以记住这一局里发生过的事；下一局重新加载，变量清零。" Great — so I can use module-level state to remember e.g. "pending dash".

Hmm, but careful: file top-level executes once per match? "文件顶层代码在每局开始时执行一次" — yes, per match (per game), variables reset each game. So I can store per-match memory.

So: plan variable `plan` set to 'dashEvade' and next ask executes it.

But is dashing the best answer vs heavy? Alternative: walk back to increase distance beyond 140. If dist <= 140 and heavy startup: we need dist > 140 by the active frame. Back walk 3/tick. In (9-opp.t) ticks we gain 3*(9-opp.t) distance. If dist + 3*(9-opp.t) > 140 → walk back works, and is cheaper than dash (no ki, no recovery). But the opponent may move forward too (they're in heavy startup, so they don't move). During their startup they don't move. So their x is fixed. So back-walking works! At opp.t=0: 9 ticks * 3 = 27 distance. If dist <= 113 → back works. But wall behind limits. Also if they reach the wall? They stay.

But careful: if we walk back, we leave the range, but our own dash plan is safer sometimes. Also walking back keeps our position options. But there's a subtlety: if we're in light range too, backing off loses our combo.

Also, guard vs heavy: crush 60 damage + 34 stun — bad but not catastrophic; also we might block... no, heavy breaks guard.

Prioritize: if opp heavy startup & dist <= 140:
- If opp.t >= 4 and ki >= 10 → dash (invuln) [also passes through → offensive upside].
- else if walking back can escape (dist + 3*(9-opp.t) > 140, and wallBehind >= needed) → 'back'.
- else if ki >= 10 → remember to dash at next ask (they'll be at t>=6 → dash covers).
- else → guard? or back anyway (partial escape). Hmm if ki < 10 we can't dash. Then back-walk, else guard (60 chip).

Wait, but there's an issue: dash requires ki >= 10; also 'dash_back' vs 'dash_forward'. dash_forward passes through the opponent (if room) and lands behind → their heavy misses (they face the old direction) — but wait, does their heavy check direction? `d = (o.x - a.x) * a.facing; if (d > 0 && d <= reach)`. After we pass through to behind them, d < 0 → miss. But during the dash moving phase, when do we pass them? At the tick we're at their position; invuln anyway. Then we land behind → they miss. Good. But landing behind needs room: our dashEnd logic handles it: if landing would be inside/behind them and there's room behind them, we land behind; else we stop in front (still invuln → they still miss because invulnerable! Actually if we land in front at distance 60, they're in heavy active and we're invulnerable (dash t=0..8) → dodged. Either way it works.)

However, there's a catch: dash_forward when the opponent is at the wall and we're behind... it's fine.

Another catch: after dashing past, we are behind them, and our recovery is 8 ticks; we re-face after recovery. Then we can attack from behind? Light requires facing toward opponent — after free we face them. OK.

Alright. Also we might use dash to escape beams? No, beams cover the ray.

Now let me also handle: opp light startup (dist <= 110) → guard (blocks, 0 damage, pushback 14, blockstun 11) or dash (invuln). Guard is cheap: no ki. But blocking gives them stun 11 and pushes us back 14. Alternatively, if their light is in startup and we're in range, we could also start our own light for a trade (both hit → both take damage; but we'd be in recovery while they're in hitstun 15 → we win the trade slightly). Actually trade: they hit us for 40, we hit them for 40 (or counter 50 if they're in startup!). Hmm: if they whiff? They won't whiff if we're in range.

If we're in range and they start a light: options: guard (block, safe) vs trade. Since our light startup is 5 and theirs is 5 (they're at t=0..4), if we start light now, both actives at ~same time → trade: we take 40, they take 40 but they're in startup → counter 1.25 = 50 damage to them. Actually mult(o) where o is in startup → 1.25 → we deal 50, they deal 40 (we're in startup → they'd also get 1.25 = 50!). Wait mult is computed for the target: if target is in startup/recovery → counter. So both in startup → each deals 50 and takes 50. Neutral trade. Better to guard.

But careful about guard vs light: if they hit us while we guard: 0 damage, pushback, and we're in blockstun 11 while they recover (their light recovery 9). Fine.

So: opponent light startup & in range → guard. But wait — if we guard and they keep pressuring... fine.

Hmm, but actually: if we're the one with initiative (we're mid-chain), the state matters.

Let me now structure the bot:

Global (per-match) vars:
- `let chainPlan` etc. Actually we can derive chain from state.me.chain.

decide(state):
```
const R = RULES; // available
if (state.clash) return clashDecision(state);
// cancel window
if (state.me.canCancel) return cancelDecision(state);
// normal free decision
```

cancelDecision: state.me.chain = number of lights in the chain (1..4). If chain < 4 → return 'light' (chain more). If chain == 4 → choose: if opp is in range and we want to finish: heavy? Let's compute: after 4 lights, opp combo=4 so next hit scale 0.45 (combo[4]). Heavy 120*0.45=54 + knockdown; blast 70*0.45=31; beam 280*0.45=126! Beam at combo scale 0.45 → 126 damage + knockdown 50, but beam startup 30 and they might escape (they're in hitstun for 15 ticks then free and can guard/dash). Hmm, beam startup 30 > their recovery → they'd act.

Alternatively after 4 lights, stop (return 'idle' → normal recovery 9 ticks) and keep pressure: our recovery 9 ticks ends at hit+10 while their hitstun ends at hit+15 → we can start another light at hit+10 (startup 5 → hits at hit+15) — they'd be free at hit+15 and might act (they get asked when free at hit+15 exactly; they'd choose e.g. guard → our light gets blocked!). Hmm, marginal.

Better: after 4-light chain, cancel into heavy when the opponent is in hitstun and won't recover for a while? Heavy startup 9 → hits at hit+9... their hitstun ends at hit+15, so heavy's active at hit+10..hit+13 → hits while they're still stunned ✓ (they're in hitstun until hit+15). Damage 120*0.45=54, knockdown 42, push 150. Then we have 22 recovery ticks while they're down 42 → we regain initiative. Total from 4-light string: 120 + 54 = 174 damage, opponent down 42 ticks (untouchable) but we control the field.

Alternatively after 4 lights cancel into blast: 31 damage, less.

Or after 4 lights cancel into another light? Not allowed (chain limit 4).

Hmm what about using fewer lights and then heavy for a bigger counter? damage scales are the same regardless.

Let's reconsider the chain: is it better to do 2 lights then heavy? 40+32+78 = 150 vs 4 lights + heavy = 174. So 4 lights + heavy is better in damage, and takes 6*4+9 = 33 ticks vs 2 lights+heavy = 6*2+9=21 ticks. Damage rate: 174/33 = 5.3/tick vs 150/21 = 7.1/tick. Hmm, the shorter combo has a better rate but the longer one more total damage. Also opponent can act after being freed... they never get freed during.

Note also: our own chain timings. Light hit at t=5..7 of the light. Then cancel next tick. So each additional light hits ~6 ticks later. During that, opp is in hitstun 15 → they stay stunned.

I think a good policy: chain up to 4 lights, then heavy (if opp hp is high enough to matter, i.e. heavy still worthwhile) else blast or nothing. Actually if opp hp is low (< ~90), heavy overkill but KO is KO — any hit works; but heavy knockdown gives us safety. Let's think about the finishing: to KO we need damage. Use heavy always after 4-light chain? Or if opp hp <= 40, any light works but we can't chain more (chain=4). Hmm.

Actually, alternative: don't use all 4 lights; keep chain to 3 and heavy at the end to have combo scale 0.55... we computed 4+heavy better.

Also we could cancel into blast when the opponent is far? Blast doesn't need range; but during a cancel the opp is at ~0-110 distance; blast from there spawns 40 in front → travels 13/tick → hits them. Damage 70*0.45=31 — weak. Heavy better.

OK so cancel policy:
- chain < 4 → 'light' (continue the chain) — but only if the opponent is still reachable; since they're in hitstun and we hit them, position unchanged except pushback 14 per light! Light pushes the opponent 14 away each hit (pushApart). After 4 lights, they've been pushed 56 away. Distance: initially ≤110; after 1st light push 14 → dist grows. If starting at dist 110, after 4 lights dist = 110+56 = 166 > 110 → our next light misses!

Careful: pushApart pushes the opponent away by 14 (if room). So chain: dist after n hits ≈ d0 + 14n. For the 2nd light to hit, need d0+14 <= 110 → d0 <= 96. For the 4th, d0 <= 110-42 = 68. So chain from far is limited. We should start the chain from close distance (d0 <= 68 for full 4-chain) or accept fewer hits. Our attack decision should consider the current distance: choose to attack when dist is small enough for the desired number of hits.

Actually, since we get asked every 6 ticks and can only act at ask time, the opponent's position changes. Let's think: when we decide to light at dist 100, the hit happens 5 ticks later; meanwhile they may move. Their movement: if they're free and moving, they could walk back (3/tick) → 15 distance in 5 ticks → dist 115 → miss. Hmm. So we should attack when they're committed (in startup/recovery) or when dist is comfortably within range.

Let me define: light hits if dist <= 110 at the active frame. If opp is free and moving, risky. If opp is in startup/recovery/hitstun (not moving? in startup/recovery they don't move) → safe.

So the light attack conditions: dist <= 105 (margin) and (opp not free OR opp is in a state where they can't move, i.e. startup/recovery/hitstun/blockstun/crushed/down... down = untouchable) OR opp is free but standing idle-ish (unknown). If opp is free and might walk away, maybe use blast instead? Blast has bigger range effectively but travels slowly (13/tick) → they can walk away or blast-block it.

Hmm. A key question: how much can we infer about the AI? Let's just be reasonable.

Let me now define the overall policy in priority order when free (not cancel, no clash):

1. If opp.state === 'beam':
   - phase 'startup': interrupt plan (see below).
   - phase 'firing': 'guard' (chip 120). Also could we do better? If the beam front hasn't reached us yet, maybe we can guard anyway. Guard is right.
   - phase 'recovery': they already fired; if the beam missed us (it's possible: if we're not in the ray... we always are unless they're far and the front hasn't reached us yet; but eventually it does). If they whiffed? The beam hits us if we're in range. If phase recovery, the beam is done (hits once). So treat as normal.
2. If opp.state === 'heavy' and phase === 'startup' and dist <= 140 → evade (dash/back/guard as computed).
3. If incoming blast with eta <= ~4 → dash (if ki>=10) else guard.
4. If opp.state === 'light' and phase startup and dist <= 110 → guard (block) — but if opp.t is such that... light startup 5, active 3, recovery 9. Guard anytime before it hits. Actually we should also consider countering: if we're in range and their light is in recovery/hitstun (they just attacked and missed or got hit) → punish with light.

Hmm, one important case: opp in recovery of light/heavy (they whiffed) → free punish: light (counter x1.25) if in range.

5. If dist <= 105 and opp is vulnerable (in startup/recovery/hitstun/blockstun/crushed) → light attack (start chain).
6. If dist > 110 → decide approach or ranged: 
   - if ki >= 20 and dist in [140, 320] and opp is free/committed → blast.
   - else if ki >= 10 → dash_forward to close.
   - else → forward (walk).
   - if ki low (< 20) and time is long → charge? Charging increases ki at 0.36/tick but takes 1.5x damage. Maybe when hp is high and far from danger, charge.

Hmm, also 'charge' while walking? No, charge is a state.

Let me think about ki economy: passive 0.04/tick → 2.4/sec. Charge adds 0.32/tick → 19.2/sec → 100 ki in ~5 sec. Damage taken: 0.08/HP → taking 100 damage gives 8 ki. Dealt: 0.02/HP → 40 damage = 0.8 ki.

Blast costs 20, beam 50, dash 10. If we spam light chains, ki income is decent.

Now, since the opponent is unknown, maybe the most important thing is to not lose to their attacks. Let's consider what an AI might do: approach, attack with light/heavy, block, blast, beam. Our bot should handle the standard.

Let me also handle "opp is charging" → they take 1.5x damage; and their charge is vulnerable: we can punish with light. If opp.state === 'charge' and dist <= 105 → light (damage 40*1.5=60) → good.

Also opp.state === 'charge' and they're far → we can approach.

Another important consideration: the "counter" multiplier applies when the target is in startup or recovery of a move. So attacking a recovering opponent is 1.25x.

Let me now also handle the case where we have a cancel window but the opponent is no longer in hitstun? They can't be — cancel happens right after our light hit, they're in hitstun.

Now, what about starting a new action when we can't reach? Let's define attack ranges:
- light reach 110
- heavy reach 140
- blast unlimited (travel)
- beam unlimited.

Approach logic: The best way to close: dash_forward (10 ki, 200 distance, 18 ticks total including recovery). But dash passes through the opponent → lands behind → awkward. Alternatively walk forward.

Hmm, but note: dash_forward lands 200 ahead; if the opponent is at distance d < 200+60, we end up behind them. Being behind them is not terrible (we then re-face and can attack).

Given the uncertainty, maybe walking forward is safer and free, but slow: from 300 to 110 = 190 → 42 ticks of walking, during which they might hit us. But while walking, we can guard? No—guard means not moving.

Hmm, we could dash forward to close from far, then light. Let's think about a "standard" engagement from 300 apart:
- Both approach. We dash forward at some point → land 100 behind/around them, invuln, then light chain.

Alternatively use blast to control space while walking.

Honestly, given the unknown AI, I think a solid, moderately aggressive plan:

State: keep track of memory: e.g., lastPlan, pendingDash, hitStun tracking.

Let me write the decision function concretely.

```js
let mem = { pending: null, lastAskT: -1 };

function decide(state) {
  const R = RULES;
  const me = state.me, opp = state.opp;
  // 1. Clash
  if (state.clash) return decideClash(state);
  // 2. Cancel window
  if (me.canCancel) return decideCancel(state);
  // 3. Free
  return decideFree(state);
}
```

decideFree(state):
```
const me=state.me, opp=state.opp, dist=state.dist;

// A. Beam startup interrupt
if (opp.state === 'beam' && opp.phase === 'startup') {
  // time until they fire: 30 - opp.t
  const toFire = 30 - opp.t;
  if (dist <= 105) {
    // light startup 5 → hit at 5 ticks, safe since toFire >= ? if toFire < 5 risky (they hit us first? during startup they can't hit)
    return 'light'; // interrupt; 40*1.25 = 50 dmg, also cancels their beam
  } else if (dist <= 140) {
    return 'heavy'; // 9 startup, counter 150 dmg + knockdown
  } else if (me.ki >= 10 && toFire > 13) {
    // dash forward to get in range? dash 10 ticks + recovery 8 = 18 > toFire(<=30). Landing dist ~100 → then light 5 → total 23 < 30 if toFire>=23.
    return 'dash_forward';
  } else {
    // blast? or charge/guard
    return 'guard'; // safe: they'll fire, we take 120 chip. or 'charge'
  }
}
```
Hmm, careful with the beam startup interrupt timing: if dist <= 105 and we light, our light's active at +5..+7 → hits them, interrupting their beam (they're in startup; being hit stuns them, beam never fires). Their startup would end at 30; we hit at 5-7 → way before. But: do they have another threat? They might have a blast in flight — check incoming blasts separately (higher priority? If a blast is incoming with eta 3, our light startup 5 means we get hit first). Let's handle incoming blast first (before the beam interrupt) unless the blast is far.

Also when interrupting with light, we get a cancel window → chain more lights! Nice: interrupting their beam startup with a light gives cancel → another light etc. Chain 4 → 40*1.25*scales... The first light deals 50 (counter), second light: they're now in hitstun → scale combo[1]=0.8 → 32, third 26, fourth 22 → 130 total. 

Wait, the counter multiplier applies only when the target is in startup/recovery of a move — after the first hit they're in hitstun → no counter. And the combo scale: 1st hit scale = combo[0]=1 (o.combo was 0) with counter 1.25 → 50. 2nd hit: o.combo=1 → scale 0.8 → 32. So chain total 50+32+26+22=130, plus if we end with heavy: 120*0.45=54 → 184 and knockdown. 

So beam-startup interrupt + chain = huge value.

Now, what if the beam is in startup and we're far? Options: dash_forward (ki 10) → land at dist-200; if dist <= 260 → land within 60 → hmm, we want to land within light range (110). dist after dash: if dist > 260 → new dist = dist-200 > 60. If dist-200 <= 105 → i.e. dist <= 305 → we can light after dash. But dash takes 10 ticks moving + 8 recovery = 18 ticks, then light 5 → hit at 23 ticks after the dash starts. Their beam fires at 30 - opp.t ticks from now. If opp.t = 0 → 30 ticks → we hit at 23 ✓ (before they fire). If opp.t >= 7 → they fire in 23 ticks → we hit at 23 exactly — risky (simultaneous: at that tick, their beam starts firing; our light hits at that tick... the strike resolution order: strikes() happens before beams() in step. So our light hit at tick X would stun them before beams() runs? But their beam spawn happens in beams() at a.t === 30 → if we stun them at tick X (their a.t = 30?), hmm. Sequence in step(): strikes → blasts → beams. If at tick X our light connects (stunning them), their state changes to hitstun before beams() is called → beams() checks `a.state === 'beam' && a.t === Bm.startup` → their state is now hitstun → no beam spawns. So we win the race if our strike lands on the same tick as their startup end. But careful: the light hit must be in range at that tick.

Also, since they're in startup, they can't hit us during it.

Alternatively if dist far and beam firing soon: guard (chip 120) — vs dashing in for an interrupt that might work. Let's do: if toFire >= 12 and dist <= 260 and ki >= 10 → dash_forward. Then next ask (6 ticks later) we're in dash recovery; we can't act. Then at +18 (free) we light if in range.

Hmm, but during the dash we can't act for 18 ticks; if their beam fires at 30 we need to be within range... Let's simplify: after dash, if still in range → light; else guard.

But there's a subtlety: our ask happens every 6 ticks; the dash decision is made at some ask; we land at +10, free at +18 → the ask at that point (free → asked immediately). OK.

Another consideration: maybe better to just guard the beam and take 120 chip, vs risking. The interrupt is worth ~280 damage. Definitely worth trying when feasible.

Also: if opp is in beam 'firing' phase and the beam hasn't reached us yet — we take chip 120 and long stun. But wait: could we interrupt a firing beam? "发射期间你被打中，大招就断了" — yes! If we hit them during firing, the beam stops (and beams[side] = null since a.state !== 'beam'). But hitting them requires reaching them (dist <= 110/140) and they may be in recovery... During firing, they're stationary. If we're close (dist <= 105) and can land a light in 5 ticks — but the beam front may already have hit us or be about to. The beam hits once; if it hits us we take 280 (ouch). If we're in the ray and it hits → 280 damage → we'd likely lose. So if the beam is firing and we're in the ray (front >= our position), we should try to interrupt ASAP if reachable: light (5 ticks) — but the beam's front advances 30/tick and covers us within ~1-2 ticks if it's close. Actually the beam hits us on the first tick it's in range: `if (!inRay(b, o.x, R.body)) continue;` → hit. So if the beam already covers us, we take 280 on this tick unless we act (dash/guard) before the strike. Our decide happens before beams() → we can guard! Guard vs beam: chip 120 and stun until the beam ends.

So: if opp firing beam and the ray covers us (state.beams gives from/front; we can check if our position is within [from,front] ± body) → guard. 120 chip is much better than 280.

If the ray doesn't yet cover us: we could dash forward to interrupt (land in range), or just guard. Guard is safe: 120 chip. Let's just guard always vs a firing beam. (Unless the beam has already hit us — b.hit true → no more damage, then we can act freely. But we can't tell from the view whether it hit. state.beams shows the beam still firing. If it already hit us, we'd be in blockstun/hitstun and not free, so we wouldn't be asked.)

Hmm: after the beam hits (not blocked), they get... wait no, if we're hit by the beam we take 280 and get knocked down 50. That's a disaster. So guard is mandatory vs a firing beam. Guard is only able to block if the beam comes from the front: `ctx.dir * o.facing > 0` — beam ctx.dir = -b.dir = direction from the beam to us... Let's check: in land(m, a, o, kind, ctx) with a = shooter, o = us, ctx.dir = -b.dir. b.dir is the shooter's facing direction (toward us). So ctx.dir = -direction toward us = direction from us toward shooter... The guard check: `ctx.dir * o.facing > 0` → the attack comes from the direction ctx.dir relative to our facing. If the shooter is to our left and we face left (facing=-1), the attack comes from our left: ctx.dir should be -1 (from our left side). b.dir = +1 (shooter's facing right, toward us) → ctx.dir = -1 → -1 * (-1) = 1 > 0 ✓ blocked. Good, as long as we face them (we always do when free).

So vs a firing beam → guard.

Now the incoming blast: if a blast is incoming with eta small. Options: guard (12 chip, 14 stun) — cheap. Or dash (invuln). Let's do: if eta <= 3 and ki >= 10 → dash_back? Hmm, if we dash back we might be cornered. Guard is cheap: 12 damage. Honestly guard is fine always. But the 14-tick blockstun delays our attack. Alternatively, we could walk back to delay the blast if eta is large (> 15) — the blast travels 13/tick; we walk back 3/tick → it still catches us, just later. That doesn't help.

We could try to make our own blast to cancel theirs (both die) but costs 20 ki + 28 ticks.

Simplest: guard vs incoming blast. But careful: if the incoming blast is going to hit while we're in the middle of something? We're only free when deciding.

Actually, one more: if the incoming blast has eta <= 10 and we have ki >= 10, dash_forward can dodge it (invuln) and also close distance for offense. But dash recovery 8 ticks. Hmm. If the blast is incoming, our position is at risk but 12 chip is trivial. Guard is the safe play, but 14 tick stun might let them follow up with more. Let's keep it simple: guard.

Wait, one important thing: if the opponent's blast is incoming and we guard, we take chip 12 but also the blast dies. Then they might blast again (they have 20 ki more). Fine.

Now let's handle "opp heavy startup" evasion as designed, and "opp light startup in range" → guard.

But hold on: guarding when they throw a light means we take 0 damage but we're in blockstun 11, and they recover in 9 → we get to act at +11 while they're free at +9 — they can attack again. Meh, it's fine.

Now the main offensive logic when no immediate threat:

```
// opp states: 'idle','forward','back','guard','charge' are free; others are committed.
const oppCommitted = !opp.free; // startup/recovery/hitstun/etc.
```

Attack decision when dist <= 105:
- If opp is in hitstun (they're stunned) → light (combo continues? we're not in a cancel window; a fresh light while they're stunned → they take a hit with scale based on their combo). Hmm: if they're in hitstun (combo counter > 0), a fresh light hits → damage scaled by their combo index (e.g., 0.8, 0.65...). Our light then gives a cancel → chain continues. So attacking into a stunned opponent is good but with diminishing returns. Alternatively wait for them to recover and hit them during their recovery (counter 1.25, no combo scaling). Hmm interesting: attacking during their recovery: mult = 1.25, scale = combo[0] = 1 (they were free → combo reset to 0 when they became free: free() sets a.combo=0). So damage 40*1.25 = 50 vs hitting a stunned opponent: 40*0.8=32. So better to wait for the recovery window!

So: if opp is in hitstun/blockstun, don't attack (wait). If opp is in startup/recovery (of light/heavy/blast/beam), attack: light → 50 damage (counter) + stun. But careful: if opp is in light startup, their light would hit us too (trade). If opp is in recovery, they're safe from trade → pure counter. If opp is in heavy startup: their heavy hits for 120 (×1.25=150 if we're in startup) → trade badly. So don't trade with heavy.

So the rule: attack with light when opp is in recovery (best: 50 dmg), or in blast startup (they can't hit us during startup; blast startup 11, our light hits at 5 → we interrupt their blast! 50 damage) — nice.

And when opp is free and in range: we need to be careful; they may block or trade. Our light: if they guard → blocked (0 dmg, pushback 14). If they light → trade (we take 40-50, they take 40-50). Hmm. If they're idle/charging → we hit for 40 (or 60 if charging).

So attacking a free opponent is a gamble. But if we're at the right distance and they're not guarding, it's good. We can't know. Let's consider the typical case: they just blocked our attack → they're in blockstun (11 ticks) → we should NOT attack immediately? Hmm, if they're in blockstun, a light would be blocked again? Blockstun state → they can't act; our light hits them (they're not guarding anymore, state is blockstun → the guard check only applies if o.state === 'guard'). So hitting a blockstunned opponent lands full damage (scaled by their combo). Their combo increments on our hits; but when they got blocked... in land() blocked path, o.combo is not incremented. So their combo stays 0 → our light during their blockstun deals full 40! And they're in blockstun (can't respond) → free hit.

So: after we get blocked (or they block), we're in blockstun 11; they're in recovery 9 → they get free at +9, we're free at +11. Then our light startup 5 → hits at +16 relative to their recovery. They can act at +9 → they might guard again.

This is getting deep. Let's build a reasonable heuristic bot and accept imperfection.

Let me define the core "engagement" logic:

When free and dist <= 105:
  - If opp.state is in ['hitstun','blockstun','crushed','down'] → they're busy: if 'down' they're untouchable → don't attack. If 'crushed' → attack (free damage). If hitstun/blockstun → hmm, they might be about to recover; attacking into their stun gives scaled damage but they're combo counter... Let's compute: if their combo is c (they've taken c hits in this string), the next hit scale = combo[c]. If c=0 (e.g., they were just hit once by something else? no...) Actually after our light hits, their combo=1 and they get hitstun 15. During hitstun we might land another light (via cancel) → combo=2, scale 0.8. That's the chain. If instead we wait for them to recover and attack during their recovery → 1.25 * 1 = 50.

So there's a tradeoff: chain (fast but scaled) vs wait-for-recovery (50 per hit, but they get to act).

Given light hitstun 15 vs our light cycle 6, we can chain up to 4 lights during their 15 tick stun? Chain hits at +6 intervals: hit1 at t, hit2 at t+6, hit3 at t+12, hit4 at t+18. Their hitstun expires at t+15 (hitstun is reset to 15 on each hit! `stun(o,'hitstun',M.hitstun)` each time). So each hit resets their stun to 15 → they stay stunned indefinitely during the chain. Yes, chaining keeps them locked. Total chain damage 40+32+26+22 = 120 in 24 ticks, then heavy.

Alternatively 2 lights then wait? Nah.

I'll go with: chain to 4 lights, then heavy (if in range and opp not down).

Hmm, but heavy's knockback 150 + knockdown 42 gives them breathing room. It's fine.

Actually, wait. Maybe better after 4 lights: cancel into blast? no. Or just 'idle' and re-engage. Heavy gives 54 (scaled) + knockdown. Let's include heavy but consider opp hp: if opp.hp <= 60, heavy is unnecessary but harmless; actually use light... can't (chain limit). Use 'idle' to recover and then continue pressure. Hmm, but if opp.hp <= 40, we want a quick finish: heavy is fine (overkill).

Alternatively after 4 lights, cancel into 'blast' if the opponent is far? They aren't.

Let me now think about the opponent's likely guard behavior: if they block our first light, we're in blockstun and pushed back 14. Our chain ends. Then we need to re-approach. If they block a lot, light attacks fail. Heavy breaks guards (60 chip damage, 34 stun). So if the opponent is in 'guard' state, use heavy! That's a key rule: opp.state === 'guard' and dist <= 140 → heavy (crush). Damage 60 + stun 34 (they can't do anything) → then we can chain lights into their crushed stun: light startup 5 → hits at +5, they're still crushed (34 ticks) → full damage (their combo? crush doesn't increment combo, so their combo=0 → light scale 1 → 40 damage) + cancel → chain more lights! Nice.

So: vs guard → heavy → then light chain. That's ~60+40+32+26+22 = 180 damage. 

But caution: heavy startup 9 — they might switch to attacking (they're free and might start a light). If they start a light during our heavy startup, their light hits at their t=5 (before our heavy active at 9) → we take 40, they're in recovery → our heavy hits at 9-12 with counter 1.25 → 150 damage + knockdown. Still a good trade (150 vs 40).

OK.

Now what about the guard state and our approach: if they guard while far, we can't do anything except blast (12 chip) or heavy.

Let's think about the overall distance management:
- Ideal: get within 105 and attack.
- If opp is free and moving away (state 'back'), chasing is hard; use blast or dash.

Let me write the approach: if dist > 105:
  - if opp is in beam startup → handled.
  - if we have a good window (opp committed in startup/recovery) → light? Only if in range.
  - else: options: 'forward' walk, 'dash_forward', 'blast'.
    - Blast: 20 ki, startup 11, damage 70, hitstun 20, travel 13/tick. Effective range: from any distance, but they can block it (12 chip) or it can be dodged (dash), or they can blast-cancel it. From 300 distance: travel ~ (300-40-30)/13 ≈ 17.7 ticks → hits at ~29 ticks. Meanwhile they can close and hit us. Hmm.
    - Dash forward: 10 ki, 200 distance, 18 ticks, invuln. Effectively closes and dodges.
    - Walk: free, 4.5/tick.

A good approach: if dist > 200 → walk forward (or blast if we want to zone). If 105 < dist <= 200 → dash forward (landing within 100 → immediate light) — but dash recovery 8 ticks then light. Hmm, actually after the dash we might be behind them (if dist < 200+60 = 260 the landing goes past them). Landing behind means: dist becomes small but on the other side; our facing is stale during recovery; after recovery we face them and can light.

Hmm, wait. There's a subtlety: when we dash forward and land behind the opponent, the opponent (if free) turns to face us immediately ("对手空闲的话会立刻转身"). So they can attack us while we're in dash recovery (8 ticks). Their light startup 5 → they could hit us at +5. Hmm. But they were facing the other way; they turn instantly (the `face()` call happens for FREE states each tick). So after our dash passes them, they turn and can counterattack within 5-6 ticks while we're in recovery. That's risky.

Dash forward when dist is around 150-250: landing 200 ahead → 100 behind them (if room). Alternatively dash when dist ~ 300: land 100 in front of them (dist 100) → no crossing → we're in front, facing them, dist 100 → light hits. That's the ideal dash usage: from exactly 260-300 distance, dash → land 60-100 in front, then light.

Hmm, from 300: dash lands at x+200 = 550, opp at 650 → dist 100 ✓ in front. Great. From 250: land at 450, opp at 650 → dist 200?? Wait, we're at 350 and the opp at 650 (dist 300). Let me use positions: me at m, opp at o, m < o, dist = o - m. Dash forward → x1 = m + 200. If x1 < o - 60 → land in front, dist = dist - 200. If x1 > o + 60 → land behind (if room): dist = 200 - dist. If within 60 → stop in front at dist 60.

So dash is great when dist ∈ [210, 300] → land in front at dist ∈ [10→60, 100]. Wait dist-200 for dist=300 → 100; dist=260 → 60; dist=210 → 10 → that's < 60 → then the rule: before>0 and after<minGap → we go through if there's room behind them, else stop at o - 60 (in front, dist 60). Either is fine: in front at dist 60 (great for light) or behind (dist ~ 50-190).

For dist < 210: dash goes through them (if room behind) → behind them. Could still be OK but they turn and hit us.

So dash forward is best at dist ≥ 210. Otherwise walk forward.

Alternatively use blast to force them to respect you.

Hmm, let me think about whether to prioritize "beam" usage. Beam costs 50 ki and 90 ticks total; damage 280 if it connects (or 120 chip if blocked). To charge 50 ki we need ~5 seconds of charging (at 0.36/tick = 216 ticks) or damage income. That's a lot of the match. And if the opponent also beams, we get a clash (which is good: winning a clash = 320 damage!).

Maybe a decent strategy: build ki via charging when safe (far from opponent, opponent not threatening), then use beam when the opponent is at mid-far distance (so their startup isn't interrupted) or when we need a burst.

But honestly, against an unknown AI, the light-chain + heavy + blast mix is solid and beam is a luxury. Also note: our damage rate from chains is very high (120 per 24 ticks = 300 dmg/s in theory, but in practice vs a reactive opponent, blocked/traded).

Let me estimate a typical exchange: we approach, they approach, we light (5 startup). They might light too → trade. Or guard → our light blocked, we get pushed back. Hmm.

Alternatively, use the "counter" advantage: attack when they're committed (startup/recovery). This is where the bot's skill shows: hit them during their recovery.

Another key advantage: dash invulnerability for offense — dash into their light startup to dodge and land behind.

Let me think about what to do when opp is free, in range (dist<=105), and they're not committed. Options: light (trade risk), heavy (long startup, risk), guard (wait), back (retreat). Given they might guard (blocking our light), our expected value... 

Since we can't know, use light: if they block, we get pushed back and lose tempo but no damage. If they trade, both take damage but we're in a chain (cancel window) → we can chain more lights, and their damage is 40-50 per hit. Hmm, trade: we deal 40 (or 50 if they're in startup) and take 40 (or 50 if we're in startup). If both in startup: each takes 50. So the trade is neutral in HP but we gain a cancel window and chain.

Hmm, but if they trade a heavy vs our light, we lose badly. So: if opp is in heavy startup → don't attack, evade (as designed).

Let me now define priorities in decideFree:

```
1. clash → clash logic.
2. cancel → chain logic.
3. Threatened by beam:
   - opp beam startup: interrupt (light/heavy/dash/guard).
   - opp beam firing: guard.
4. opp heavy startup & dist <= 140 → evade (dash/back/guard).
5. opp light startup & dist <= 110 → guard (block). But if we're at a distance where their light can't reach (dist > 110) → ignore, continue approach.
6. incoming blast → guard (or dash if eta<=2).
7. Attack opportunity:
   - dist <= 105:
     - if opp is in recovery (of any move) → light (counter 1.25, no combo scale since they're free... wait, when they're in recovery, are they "free"? Their state is 'light' with phase 'recovery' → not free → their combo was reset when they became free earlier. So combo=0 → scale 1 → 50 damage ✓.
     - if opp is in blast startup → light (interrupt, counter 50).
     - if opp is in hitstun/blockstun/crushed → hmm:
       - crushed → light (full damage 40 since combo 0 usually).
       - hitstun/blockstun → their combo might be >0. Attack anyway? If we hit them during hitstun, their stun resets and we get a cancel → chain. It's decent. But scaled damage. Let me just attack (light) — the chain continuation is valuable.
       Actually careful: if we attack into their hitstun, we might be extending a combo we could have gotten at 1.25 later. Meh, take the damage now.
     - if opp is in 'guard' → heavy (crush).
     - if opp is free (idle/forward/back/charge) → light if dist <= 105 (with a bit of margin?) else approach.
   - dist > 105 → approach/spacing.
8. Fallback: approach.
```

Also we should handle the case where opp is down (untouchable) → don't attack, reposition (walk forward) or charge.

Also: time management. If timeLeft is small and we're ahead on HP, we might want to run away / guard. If behind, be aggressive. Let's add: if timeLeft < 600 (10s) and our HP > opp HP + 150 → play safe (back/guard away, charge). Otherwise aggressive.

Hmm, but "win rate" is what matters. Let's add mild logic: if timeLeft < 900 and me.hp > opp.hp + 100 → prefer safe (guard/back) to preserve the lead. Also we could use dash_back to run.

Also charge: when should we charge? If ki < 20 and we're not in a fight (dist > 200 and opp not threatening), charge to build ki. But charging is vulnerable (1.5x damage). If they're far, charging is fine. Also charge restores... no, only ki.

I think a reasonable ki policy: charge when ki < 30 and dist > 180 and opp is not in beam startup; else fight.

Let me also implement the "clash" logic:
```
function decideClash(state) {
  const c = state.clash;
  const me = state.me, opp = state.opp;
  // pos: 0 = on me, 1 = on opponent. We want pos → 1.
  // myPower vs oppPower given.
  // push if myPower >= oppPower (we're stronger) and ki > 12
  // Also if pos is high (>0.8) we're winning; keep pushing.
  // If we're losing (pos low) and weaker, don't push (conserve ki), wait.
  if (me.ki > 12 && c.myPower >= c.oppPower) return 'push';
  return 'idle';
}
```
Hmm, but pushing drains ki 0.8/tick while the opponent (if not pushing) drains 0.2/tick. Consider the endgame: if both have ki 100: my power 3.0+... if I push: 3.6. Drift = (3.6-3.0)*0.1 = 0.06/tick toward them → we win the clash in ~1/0.06 = 17 ticks (plus noise 0.8 sd → drift noise ±0.8 dominates!). Noise: (sum of 4 uniforms - 2)*1.732 → sd 0.8 per tick, and the position velocity decays 0.95. The noise dominates the drift, so the clash is largely random with a slight bias. Over many ticks, the drift accumulates: with velocity v: v = 0.95v + drift + noise. The steady-state position movement is roughly drift/(1-0.95) = 20*drift per tick = 1.2/tick for drift 0.06. Noise contributes a random walk with std ~0.8/sqrt(1-0.95^2)= 0.8/0.312 = 2.56 per tick?? Hmm, position random walk with step sd ~2.56*... Let me not overthink: the point is the drift determines the expected outcome; the noise adds variance. With a power advantage, pushing helps.

Note the power difference: 1+0.02*ki. If I have 100 ki and they have 0 → 3.0 vs 0.5 → drift 0.25/tick → strong win. So maintaining ki matters in clashes.

Given that, pushing: gain +0.6 power (if ki>0) and lose 3.6 ki per 6 ticks (=0.072 power). Net positive initially.

Strategy: push while ki > 20 and myPower > oppPower. If oppPower > myPower (they have more ki), don't push (save ki); they'll drain and eventually their power drops. But they can also push. It's a race. Since I can see the powers, use: push if myPower > oppPower + 0.05. Also consider: if the clash has gone long (t > 200) and we're winning on position... whatever.

Also during the clash, hp rage matters.

Now, the 'push' action is only valid in clash; if we return 'push' outside clash → treated as idle. Fine.

Another thought: the clash ends when the point reaches someone's body. Winner = the other side. Winner's beam doesn't continue (beams set to null). So winning the clash = 320 damage to the loser + knockdown 60. Then the winner recovers 20 ticks. Great outcome.

Also, if the opponent's beam is about to clash with ours: we might avoid the clash by not firing a beam (e.g., guard). But a clash we win is great.

Now let's think about whether to use beam at all. Beam startup 30 ticks; during it, we can be interrupted (they hit us → our beam is canceled). Also, if they fire a beam at the same time → clash.

Strategy for beam: when ki >= 55 and (dist > 150 or opp is not threatening) and timeLeft > 300 → fire beam. If opp is in beam startup → interrupt instead (they'd clash otherwise... hmm, if both in startup and both fire at 30 → clash).

Actually, given a clash can be won with a ki advantage, and a beam that connects does 280 damage, using beam is good when we can commit. Let's use beam when: ki >= 60, opp not in heavy startup (can't interrupt), and our hp is decent. Also avoid beam if the opponent has a blast incoming (it would... no, blasts don't interrupt beams except ours can swallow theirs).

Hmm, one thing: during our beam startup (30 ticks), if they hit us with anything, the beam is canceled (state changes to hitstun) and we wasted 50 ki. So we should only fire a beam when they're unlikely to reach us: dist > 180 (their light reach 110 + they walk 4.5/tick*30 = 135 → they could reach us if dist < 110+135 = 245. Hmm, but they'd have to start an attack now and it has to hit during our startup (0-30 ticks) — they need ~5+ ticks of startup.

Alternatively, we can fire the beam and hope. Or better: only fire a beam when they're in a committed state (recovery/hitstun) so they can't attack for a while. E.g., if opp is in hitstun (15 ticks) → not enough (30). If opp is in crushed (34 ticks) → good! Or if opp is down (42 ticks) → perfect time to beam (they're untouchable but will get up).

Hmm, also if they are at distance > 200 and just walking, they might close to 110 in 20 ticks and hit us during our startup. Risky.

Maybe better: fire the beam when we're in a cancel window! After a 4-light chain, we can cancel into beam: the beam starts immediately (30 ticks startup) while the opponent is in hitstun 15 → they get free at +15 and can attack. Hmm, not enough. But cancel into beam right after a light hit (chain 1) → beam startup 30 while they're stunned 15. They recover at +15, act at +16, their light hits at +21 if in range → interrupts our beam. But the beam hits at +30. So they're likely to interrupt. Unless we cancel into beam when the opponent is far.

Alternatively use the cancel to cancel into blast when the opponent is at a distance? Blast startup 11 → they can't interrupt easily.

Honestly, let's include beam usage in these cases:
- ki >= 60 and (opp is down/crushed, or dist >= 220, or opp is in a long committed state like blast startup/recovery) and timeLeft > 600.

Hmm, blast startup is 11 ticks — not enough. Let's use: opp down/crushed (34+ ticks), or dist >= 230, or time is nearly over? no.

Alternatively: charge up ki specifically for a beam when the opponent is far and passive.

Actually, you know what — maybe simpler and safer: use blast instead of beam for ranged pressure, and use beam rarely (only when the opponent is incapacitated). The light chain is the main damage source. But against a turtle opponent, we need beams/blasts. Hmm.

Let's consider the likely AI opponents: they're probably simple bots (e.g., approach, attack, occasionally block/special). A good mix should win.

Let me write the code now, with clear structure and a memory object for pending plans.

Also important: budget. Our decide must be fast (< 200ms per call, <1500ms per match). Keep it simple, no heavy loops. Fine.

Let me also handle `state.me.state` — when decide is called, me is free (or cancel). We should not return actions that are invalid (e.g., blast with ki < 20 → engine ignores it and keeps the old state; that's fine but wastes a decision slot). We should only return 'blast' if ki >= 20, 'beam' if ki >= 50, dash if ki >= 10.

Note: if we return an unaffordable action, `start` returns without changing the state — the fighter keeps their current held state (e.g., 'forward'). That's not terrible but let's avoid.

Also note: returning 'light' etc. when we intend a held state: after the move completes, free() sets state='idle'. So held states only persist while free.

Now let's write the code.

```js
// AI 武道会 bot
const R = (typeof RULES !== 'undefined') ? RULES : null;
```
RULES is a global; we can use it directly.

Memory (per match): 
```js
let mem = { plan: null, planT: 0 };
```
'plan' could be 'dashEvade' to remember to dash at the next decision.

Let me write decide:

```js
function decide(state) {
  const me = state.me, opp = state.opp, R = RULES;
  if (state.clash) return onClash(state);
  if (me.canCancel) return onCancel(state);
  return onFree(state);
}
```

onCancel(state):
```js
function onCancel(state) {
  const me = state.me, opp = state.opp;
  // we just landed a light; chain is me.chain (1..4)
  if (me.chain < 4) {
    // chain another light if opponent is still in range
    if (state.dist <= 118) return 'light';
    // if they got pushed out of range, maybe heavy (reach 140)
    if (state.dist <= 148) return 'heavy';
    return 'idle';
  }
  // chain exhausted: finish with heavy
  if (state.dist <= 148 && opp.state !== 'down') return 'heavy';
  return 'idle';
}
```
Hmm wait: careful with the pushback. Each light pushes the opponent away 14 (if room). Our cancel happens the tick after the hit; at that moment, dist has increased by 14. If we started at dist 100 → after hit dist 114 → next light reach 110 → miss! So the chain breaks. Then the cancel returns... we should return 'light' only if we expect the hit to land. Actually if the light misses, we've wasted the move (we entered light state and it whiffs, recovery 9). Better: check predicted distance.

Let me predict: after our light hits, the opponent is pushed 14 away (if there's room behind them). So at the next cancel, dist_new = dist_at_hit + 14 (if the opponent had room). The next light's active is 5-7 ticks later; the opponent is in hitstun (can't move) → dist stays. So the condition for the next light to hit: dist + 14 <= 110 → dist <= 96.

So in onCancel: `if (me.chain < 4 && state.dist <= 96) return 'light';`

Hmm, but the push might not happen if they're at the wall (then the attacker gets pushed instead). Edge case; use <= 100 to be a bit safer? If dist=100 and they have room, the next light would hit at 114 → miss. If they're at the wall, the next light hits at 100 ✓. Use a conservative 96.

But wait, there's another subtlety: the pushApart function pushes the opponent by min(14, room) where room is the space behind them (away from us). If they're near the wall, less push.

Also, on our first light hit at dist d, the hit occurs at the active frame; but our decision to start the light was made ~5-7 ticks earlier, and the opponent might have moved. Let's account for prediction at decision time.

Also: the heavy after 4 lights: reach 140; dist after 4 pushes = d + 56 (if d was the starting dist). Starting dist <= 96 for the 4-chain. After 4 hits: dist = d+56. For heavy reach 140 → d <= 84. Hmm. So a 4-chain often ends too far for the heavy. If dist > 140 at the cancel, we can't heavy → return 'idle' (recover) and re-approach.

Hmm, this weakens the plan. Let's reconsider: maybe 2 lights then heavy: after 2 hits dist = d+28; heavy reach 140 → d <= 112; heavy damage 120*0.65=78; total 40+32+78 = 150.

vs 4 lights + heavy (if in range): 40+32+26+22+54 = 174 but requires d <= 84.

Both are fine. Let's implement: in onCancel, chain lights while chain<4 and dist <= 96; then if chain>=2 and dist <= 140 → heavy. Hmm, but if chain == 4 and dist > 140, we could return 'idle'.

Actually, alternative: after 4 lights, cancel into 'blast' (unlimited range, 70*scale). Scale at combo=4 → 0.45 → 31 damage but from any distance and it keeps them in hitstun 20. Hmm, blast startup 11 then travel. They can block it (12 chip). Meh.

I think a reasonable onCancel:
- if chain < 4 and dist <= 96 → 'light'
- else if dist <= 140 and opp.state !== 'down' → 'heavy' (a heavy is a decent finisher; if the chain is 4 and dist > 140 we can't).
   - But maybe prefer 'idle' if opp.hp is low and heavy is unnecessary? No, heavy is fine; the knockdown is valuable.
   - Hmm: one concern: heavy has 22 recovery; after the chain, if we heavy and they get knocked down 42, we're safe for a while. Good.
- else → 'idle'.

Wait, one thing: heavy's counter bonus: if they're in hitstun (not startup/recovery), no counter. Damage = 120 * scale(0.45) = 54.

Alternatively cancel into beam for 280*0.45 = 126 damage — bigger than heavy's 54! And beam knocks down 50. But the beam has a 30-tick startup during which they can interrupt us (they're in hitstun 15 → they recover at +15 and can attack at +16, hitting us at +21 → interrupt our beam at 30). Hmm. But if the opponent is at dist > 110+? Their light reach is 110; they'd need to be in range. After 4 lights we're at dist ~100-140. If dist > 110, they can't hit us with a light immediately; but they might dash in. So beam cancel is decent when dist > 120.

Let's include: after chain >= 1, if ki >= 50 and dist > 125 and opp.hp is high (beam does more) → 'beam'? The risk: they interrupt (we waste 50 ki and get hit). Alternatively 'blast' (20 ki, startup 11) → 70*scale damage.

Let me keep it simpler: heavy. And maybe use beam in onFree for the "finisher" when opp.hp <= 300 and ki >= 50 and dist > 140.

Hmm, I worry about over-engineering. Let me settle on a clear policy and write clean code.

FINAL POLICY:

onFree(state):
```
me, opp, dist, timeLeft
ki = me.ki

// 1. Beam response
if (opp.state === 'beam') {
  if (opp.phase === 'startup') {
    const toFire = 30 - opp.t;
    if (dist <= 96) return 'light';         // interrupt: fast
    if (dist <= 130) return 'heavy';        // interrupt: big damage
    if (ki >= 10 && toFire >= 22 && dist <= 300) { mem.plan='dashIn'; return 'dash_forward'; }
    return 'guard';  // block the beam (120 chip)
  }
  if (opp.phase === 'firing') return 'guard';  // block (120 chip)
  // recovery: they already fired; fall through
}
// 2. Heavy startup evasion
if (opp.state === 'heavy' && opp.phase === 'startup' && dist <= 140) {
   const tt = opp.t; // ticks into startup
   const activeStart = 9 - tt;
   // dash now covers if activeStart + 3 <= 8 → tt >= 4
   if (tt >= 4 && ki >= 10) return 'dash_forward'; // passes through → their heavy misses
   if (mem.plan === 'dashEvade') { mem.plan = null; return 'dash_forward'; }  // now tt>=6 → covers
   // walk back to escape reach
   const needed = 140 - dist + 4; // margin
   const steps = activeStart; // ticks until active
   if (state.wallBehind > needed && 3*steps >= needed) return 'back';
   mem.plan = 'dashEvade'; // try dash next ask
   if (ki < 10) return 'guard'; // no ki: take crush (60) or... 
   return 'back'; // hmm
}
```
Hmm, this is getting complicated. Let me simplify the heavy evasion:

```
if (opp.state === 'heavy' && opp.phase === 'startup' && dist <= 140) {
  const activeStart = 9 - opp.t;
  const canDash = me.ki >= 10;
  // dash covers the active window if we start it in [activeStart-5, activeStart]
  if (canDash && opp.t >= 4) return 'dash_forward';   // covers now
  if (canDash && opp.t <= 3) { mem.plan = 'dashEvade'; return 'back'; } // retreat a bit now, dash next ask
  // no ki: try to walk out of range
  const escapeDist = 145 - dist;
  if (state.wallBehind > escapeDist + 6 && 3 * activeStart >= escapeDist) return 'back';
  return 'guard'; // crush, but only option
}
```
Wait, if opp.t <= 3 and we set plan='dashEvade' and return 'back': our next ask is 6 ticks later → their t = opp.t+6 ∈ [6,9]. If their t is 9 (active) when we dash, the dash covers their active frames? If their t=9 at our ask, that means this tick is their first active frame → we dash now → invuln covers this tick and the next 8 → covers all 4 active frames ✓. If their t=6,7,8 → dash now covers their active ✓ (as computed). But careful: 'back' during the wait — we retreat, which may push us out of their 140 range → then the heavy misses anyway ✓. Good.

But hold on: if their t <= 3 and we return 'back', we walk back 3/tick for 6 ticks = 18 distance. Then dash. Fine.

Also: is 'dash_forward' the best dash direction vs a heavy? If we dash forward we pass through them → their heavy misses (both due to invuln and the direction check) and we get a positional advantage (behind them). But if there's no room behind them, dashEnd stops us in front at dist 60 (still invuln → they miss). OK, dash_forward is good.

Risk: dash_forward costs 10 ki and 18 ticks of recovery. Acceptable for avoiding 120-150 damage.

Also note: their heavy might have started when they were far and they close? They don't move during heavy. OK.

3. Incoming blast:
```
const inc = state.blasts.find(b => b.incoming);
if (inc && inc.eta !== null && inc.eta <= 6) {
   // guard: chip 12. Or dash to dodge.
   return 'guard';
}
```
Actually just always guard if a blast is incoming and eta <= 12? If eta is large (like 30), we could do something else (attack/approach) and guard later. But our ask cadence is 6 ticks; if eta is 30, we have 5 asks to handle it. Let's guard only when eta <= 8, else continue with other plans but keep an eye. Hmm, but if we start a light (5 startup + 3 active) with eta 30, our light hits first; then the blast arrives during our recovery — we can't guard mid-recovery → we eat 70 damage. Bad! So any incoming blast with a time-to-impact shorter than our committed action is a threat.

Safer: whenever a blast is incoming, guard (unless we can cancel it with our own blast, or dodge with dash). Blocking costs only 12 damage. But it also wastes our tempo (14 blockstun).

Given a blast is 70 damage (12 blocked), and our combos do 120+, maybe guard is acceptable. But blocking every blast leads to a stalemate where they out-resource us (they spend 20 ki, we lose tempo). We could also cancel with our own blast: if our blast's startup (11) completes before their blast reaches us, the two cancel (if they meet). Actually they cancel when they cross; ours spawns at our position and moves toward them; theirs moves toward us. They meet if ours spawns before theirs hits us AND they meet before theirs passes us... Their blast hits us when it reaches our body. Ours spawns at our position (40 in front). Hmm: our blast spawns at x_me + 40*facing (in front of us, between us and them). Their blast travels toward us. If ours spawns while their blast is still > 40+30 away from us, they'll cross and both die ✓.

So: if eta (their blast reaches us) > 11 + 2 (a bit) → we can cancel: fire a blast. Then no damage at all, but we spend 20 ki and 29 ticks (11 startup + 18 recovery). Versus guard: 12 damage, 14 stun. Cancelling is better if we have ki and need tempo? Actually guard is better (no ki cost, 12 damage is nothing). But wait — can we guard while blocking gives +2 ki? Yes, block gives +2 ki. So guard costs 14 ticks of stun but gains 2 ki. Blasting costs 20 ki and 29 ticks. Guard is better. Just guard.

Unless the blast is going to hit us while we're in a good position... no, guard.

But there's one important case: the incoming blast and their melee. If we guard, they're free to walk up and hit us. It's fine.

Decision: if a blast is incoming with eta <= 20 → 'guard'. If eta > 20 → we could do an attack that completes within the eta window: a light (5+3 = 8 ticks to hit) is safe if eta > 10 (since after the hit, the blast might arrive during our recovery — we can't guard then!). Hmm: after our light hits, we're in recovery 9 ticks (or cancel → chain). The blast arrives at eta. If eta <= 8 + 9 = 17 → we'd be in recovery when it arrives → take 70. If eta <= 8 → the blast hits during our light startup/active → we take 70 too.

So we need the blast to be avoided entirely: guard now (if eta <= 17ish) or cancel it with our own blast. Simplest: if a blast is incoming → guard immediately. The cost is small.

Hmm, but if they spam blasts (20 ki each) they can lock us in guard/blockstun and drain our tempo while they pressure. But they only have 100 ki → 5 blasts max per match. Fine.

Actually one more idea: dash to dodge the blast (invuln 9 ticks). If eta <= 9 → dash (invuln covers the arrival). Dash is better than guard if we have the ki and want tempo? Dash recovery 8 ticks vs guard's 14 blockstun. And dash can reposition (forward for offense). But dash costs 10 ki. For eta <= 4, a dash is a clean dodge. Let's use: if inc.eta <= 4 and ki >= 10 → dash_forward (closes distance). Careful: dash_forward moves us toward them — the blast is coming from the front; during invuln it passes through (dodge) ✓.

Hmm, but if the blast is very close (eta 1) and we dash forward, we'd move into the blast... it's invulnerable so we dodge it; the blast continues past us (it was traveling toward us; we move toward it) — after passing us it continues in its direction (away from them) → fine, it dies.

OK.

4. Attack / approach logic.

Let me define helper: oppCommitted = opp.state is not in FREE set (idle, forward, back, guard, charge).

If dist <= 100 (light reach minus margin):
   - if opp.state === 'guard' → heavy (crush) if dist <= 140.
   - if opp.state === 'charge' → light (1.5x damage = 60) ✓
   - if opp is in startup/recovery of blast/beam → light (interrupt; they can't retaliate during blast startup; during blast recovery they can't act either).
     Careful: if opp is in beam startup → handled earlier.
     If opp is in light startup → trade risk: their light (5 startup) vs ours (5) → simultaneous. Actually if we decide now, our light's active is at +5..+7; their light started at opp.t (they're at opp.t ticks into startup) → their active at + (5-opp.t). If opp.t >= 1, their active is before ours → they hit us first (we're in startup → counter 1.25 → 50 damage) and we're in hitstun → our light doesn't come out. So trading is bad. So: if opp is in light startup → guard (block their light) instead of attacking.
     If opp is in light recovery → they're safe → our light hits for 50 (counter) ✓ attack.
     If opp is in heavy startup → evade (handled earlier).
     If opp is in heavy recovery → attack (counter 50) ✓.
   - if opp is in hitstun/blockstun/crushed → attack with light (they can't respond). Damage scaled by their combo: if their combo is 0 → 40 full. Hitstun usually comes with combo>0 (they were hit). Hmm, hitstun from a blast (70 damage, hitstun 20, combo 1) → our light would do 40*0.8=32. Fine.
   - if opp is down → don't attack (untouchable). Approach or charge.
   - if opp is free (idle/forward/back/guard/charge):
     - guard → heavy (handled).
     - else → light (they might block or trade). Since they're free, if they start a light at the same time → trade. Hmm. Alternatively 'back' to wait? No, let's attack; the chain gives us cancel options.
     
     Actually, hmm: attacking a free opponent who is walking backward → they may exit range. Let's require the opponent to be within 96 for a reliable light (with margin).

If dist > 100:
   - Approach: 
     - if opp is down/crushed/hitstun → we have free time: maybe charge ki? Or walk forward.
     - if ki >= 20 and dist >= 130 and opp is free and not threatening → blast? A blast forces them to block or take 70. But it also has a long recovery (29 ticks) during which they can hit us. Risky but it's a ranged poke.
     - if ki >= 10 and dist >= 210 → dash_forward (land in front at dist <= 100) — but only if the opponent isn't about to hit us (no heavy startup) and we can handle a blast.
     - else → forward (walk).
   - Also consider charging when ki is low and the opponent is far.

Let me think about the walk-forward approach: it's slow, and we get asked every 6 ticks; walking 4.5/tick = 27 per ask.

Distance management: if dist is 100-140, walk forward to get in range.

Now, one more consideration — "waiting" for the opponent to come to us while charging ki. A decent strategy might be: keep distance ~150-200, charge to 100 ki, then blast/beam. But against aggressive AIs, we lose.

I'll go with an aggressive-but-safe approach.

Let me now also add time-based logic: if timeLeft < 1200 (20s) and me.hp > opp.hp + 100 → play defensive (back/guard/charge) to bank the lead. Let's implement a simple version: if timeLeft < 900 and me.hp - opp.hp > 150 → prefer 'back' when dist < 140 (maintain distance) and 'guard' if they attack. Hmm, but 'back' when they approach... they chase. Since they must walk 4.5/tick and we walk 3/tick, we can't escape by walking. Dash_back can (20/tick effective). So running away requires ki. Meh, let's implement: if ahead and time is short → if dist < 130 → 'back' (increase distance); if dist > 200 → 'guard'/'charge' and let time run out. But they can still hit us with blasts. Let's keep it simple: if ahead by >150 and timeLeft < 1200 → prefer 'back' when they're within 130, else 'idle'/'charge'.

Hmm, 'charge' takes 1.5x damage but we don't care if we're ahead. Actually charging doesn't help unless we use ki. Let's just 'idle' or 'guard'.

Actually the risk: the opponent keeps attacking and we keep retreating, and time runs out with us ahead → we win. Good. But if they catch us... Let's not overthink; add a mild version.

Now, let me write the final code carefully.

```js
/* AI 武道会 · 选手程序 */
const FREE = new Set(['idle','forward','back','guard','charge']);
let mem = { plan: null };

function decide(state) {
  const me = state.me, opp = state.opp, R = RULES;
  if (state.clash) return onClash(state);
  if (me.canCancel) { mem.plan = null; return onCancel(state); }
  return onFree(state);
}
```

Wait: `me.canCancel` is only true during the extra call after a light hit. Note that the extra call happens with me.state === 'light' (in recovery). Also `choose` for a.cancel: only 'light','heavy','blast','beam' are allowed; anything else → normal recovery. So returning 'idle' is fine.

onCancel:
```js
function onCancel(state) {
  const me = state.me, opp = state.opp, dist = state.dist, R = RULES;
  const push = 14; // light push
  // after a light hit, the opponent is pushed ~14 away
  if (me.chain < 4 && dist + push <= R.light.reach - 2) return 'light';
  if (dist <= R.heavy.reach - 4 && opp.state !== 'down') return 'heavy';
  if (me.ki >= R.blast.cost && dist > R.light.reach) return 'blast';
  return 'idle';
}
```
Hmm, the blast option: after a chain, if they're far (they were pushed), a blast could hit them (unlimited range) but the damage is scaled by their combo (0.45 → 31). Meh, skip. Actually if dist > 110 we can't do much. Let's keep 'idle'.

Hmm, but wait: should the cancel into heavy happen when opp.state === 'down'? If they're down (untouchable), the heavy would whiff (strikes only hit if not invulnerable — down is invulnerable → the strike is skipped, and we waste the heavy). So check opp.state !== 'down' ✓. Also 'ko' — the match is over.

Also if opp is in 'dash' (invulnerable) → our attacks whiff. Check opp.invulnerable? The view has me.invulnerable and opp.invulnerable ✓. If opp.invulnerable → don't attack; maybe back off. Let's add: if opp.invulnerable → return 'idle' or 'back'.

onFree:
```js
function onFree(state) {
  const me = state.me, opp = state.opp, R = RULES, dist = state.dist;
  const ki = me.ki;

  // --- 0) defensive endgame
  if (state.timeLeft < 1200 && me.hp > opp.hp + 150) {
    // bank the lead
    if (dist < 130) return 'back';
    if (opp.state === 'charge') return 'guard'; // just block
    return 'idle';
  }
  ...
}
```
Hmm, careful: this could be bad if the opponent is about to KO us with a beam. Let's not make the endgame override the beam logic. Order: put the endgame logic late (after threats).

Let me structure onFree:

```
// A. incoming blast
const inc = state.blasts.find(b => b.incoming && b.eta !== null);
if (inc && inc.eta <= 5 && ki >= R.dash.cost) return 'dash_forward'; // dodge+close
if (inc && inc.eta <= 22) return 'guard';  // block (12 chip)
```
Hmm, the guard condition eta <= 22: if eta > 22 we can safely act for ~22 ticks. But our action might be a light (8 ticks) → after that, we might chain or recover. The blast arrives at eta; if eta is 22 and our light hits at 8 → we're in cancel → we can cancel into... we can't guard during the cancel window (returning 'guard' from the cancel → normal recovery). Hmm! Actually during the cancel, returning 'guard' → the code: `if (a.cancel) { a.cancel=false; if (allowed actions) start(...); return; }` → for non-allowed actions, it just returns, keeping the light's recovery. So we can't guard during the cancel → we'd be in recovery when the blast arrives → 70 damage.

So: when a blast is incoming, we should avoid committing to a light chain unless the blast is canceled. Let's simplify: if a blast is incoming → guard (unless eta <= 5 → dash). Actually, hmm, but if eta is large (e.g., 40), we could light and the blast arrives during our recovery → we take 70. That's bad. So guard whenever a blast is incoming? Then a smart opponent spams blasts and we just guard — but each blast costs them 20 ki and gives us 2 ki. That's a losing trade for them, so it's fine for us to always guard.

But there's a subtlety: if their blast is incoming and we're in guard, we can't do anything else. It's fine.

Alternatively we can cancel their blast with our own blast (both die, no damage) — better than guard? Both cost tempo. Guard gives +2 ki and 12 chip. Guard is better. OK: always guard vs an incoming blast (except dash if eta <= 4 and ki >= 10).

Hmm, but one more: what if the incoming blast is very close (eta 0-1) and we guard — do we block it? The blast hits us if it's in range; guard blocks it ✓ (chip 12). Yes.

But actually, there's a catch: our guard state must be active at the moment of impact. If eta is 1 and we choose 'guard' now, the state becomes 'guard' at this tick → the blast hits this tick? The blast moves 13/tick and the hit check happens after movement. If the blast was eta=1 (about to reach), at this tick it moves and may reach us → we block ✓ (state guard). Good.

So: incoming blast → guard (or dash if eta <= 4 with ki).

Wait, but if we dash when eta <= 4, the dash is invulnerable so the blast dodges ✓ (they lose 20 ki). But the dash also puts us in recovery 8 ticks. Alternatively guard = 12 damage. Both fine. I'll use dash only if eta <= 2 (imminent) and ki >= 10; otherwise guard. Hmm, if eta <= 2 and we guard, we take 12 chip and 14 stun — fine. Simpler: always guard vs blast. Let me do that (fewer branches). Hmm, but the dash-through-blast could be an offensive opportunity... Keep it simple: guard.

Hmm, but actually there's an issue: guarding when the opponent is about to melee us. Guard blocks light. Fine.

// B. opp beam
```
if (opp.state === 'beam') {
  if (opp.phase === 'startup') {
    const toFire = R.beam.startup - opp.t;   // ticks until they fire
    if (dist <= 96) return 'light';     // interrupt
    if (dist <= 132) return 'heavy';    // interrupt
    if (ki >= R.dash.cost && toFire >= 20 && dist <= 300) { mem.plan='closeIn'; return 'dash_forward'; }
    return 'guard';  // block the beam
  }
  if (opp.phase === 'firing') return 'guard'; // block (120 chip)
}
```
Hmm, one issue: when we return 'guard' vs a firing beam, we take 120 chip and are stunned until the beam ends (~46 ticks). During that time they're also recovering. OK.

But hold on: is guarding the beam correct if we're not in the ray yet? The beam front advances; we'd block it when it arrives ✓.

Also: what if the beam's front has already passed us (we're behind the front, i.e., the ray still covers us since the ray is from the shooter to the front, which includes us)? Yes, the ray covers us → guard.

Also, what if the opponent's beam has already hit us? Then we'd be in hitstun/down and not free. So no issue.

Note: if opp.phase === 'recovery' for a beam, the beam is done (beams[side]=null at t >= startup+fire) → normal.

// C. opp heavy startup evasion
```
if (opp.state === 'heavy' && opp.phase === 'startup' && dist <= R.heavy.reach) {
   const activeStart = R.heavy.startup - opp.t;
   if (ki >= R.dash.cost) {
     if (opp.t >= 4) return 'dash_forward';       // covers the active window
     mem.plan = 'dashEvade'; return 'back';        // retreat now, dash on the next ask
   }
   // no ki: try to walk out of reach
   const need = R.heavy.reach + 5 - dist;
   if (state.wallBehind > need + 8 && R.walk.back * activeStart >= need) return 'back';
   return 'guard'; // crush 60 dmg, 34 stun — last resort
}
```
Hmm, the 'back' + mem.plan='dashEvade': at the next ask (6 ticks later), opp.t has advanced by 6 → opp.t >= 6 ≥ 4 → we dash then (the normal branch handles it since opp.t >= 4). So the mem.plan isn't even needed! Because the branch "opp.t >= 4 → dash" will trigger at the next ask. But we must make sure that at the next ask, opp is still in heavy startup. If opp.t was 3 → next ask opp.t = 9 → active phase, not startup! Then our branch C doesn't trigger, and their heavy hits us (active frames now). Hmm! So we do need to handle the active phase: if opp.phase === 'active' and dist <= 140 → dash now (invuln covers the active frames ✓ as computed).

Let me add: if opp.state === 'heavy' && opp.phase === 'active' && dist <= 140 → dash_forward (if ki >= 10) → we dodge the active frames (invuln covers now..+8, active frames now..+3 ✓). If no ki → 'back' (if possible) or 'guard'.

Wait, but can we dash at that moment? We're asked every 6 ticks; we might not be asked exactly at their active frame. We see opp.state='heavy', phase='active', opp.t = 9..12 at our ask → dash now → invuln covers our next 9 ticks; their remaining active frames are now..(12-opp.t) ≤ 3 ✓. But if their active started before our ask, e.g., opp.t=11 → 1 frame left → we dash ✓. So any ask during their active phase → dash covers the remaining frames ✓ (since remaining ≤ 4 ≤ 9).

But the danger: their active phase started and ended between our asks, and we never got asked during it → they hit us. Can that happen? Their heavy: startup 9 + active 4 = 13 ticks; our ask interval is 6 → we'd be asked at least twice during those 13 ticks, so we'd see the startup or active phase. If we see the startup at opp.t=0..3, we retreat ('back') and our next ask is 6 later → opp.t = 6..9 → we dash (startup branch if opp.t>=4) ✓. Wait: if opp.t=0 at our ask and we return 'back', the next ask is +6 → opp.t=6 → startup branch → dash ✓. If opp.t=3 → next ask opp.t=9 → active branch → dash ✓. Good, covered.

But what if we return 'back' and the retreat makes dist > 140 → their heavy misses → fine.

Also, note: our decision at opp.t=0 with 'back': we walk back 3/tick. Their heavy hits at +9 (range 140). If dist was 130 → we retreat 27 → dist 157 → miss ✓.

OK. Also 'dash_forward' vs 'dash_back' for the heavy: dash_forward passes through them → their heavy (facing the old direction) misses and we're behind. But if we dash forward, do we land on top of them? dashEnd handles it.

Hmm, one risk: dash_forward when the opponent is very close (dist < 60?) impossible (min 60).

Another risk: dash_forward moves us 200 forward; if the opponent is at dist 100, we land behind them at dist 100 (if room). Their heavy misses because we changed sides ✓ (and invuln). Then we're behind them, and after recovery we re-face them. OK.

// D. opp light startup (they're about to punch) and dist <= 110:
```
if (opp.state === 'light' && opp.phase === 'startup' && dist <= R.light.reach + 2) {
   return 'guard'; // block it
}
```
But what if their light is in startup and they're at dist 90 — guard blocks ✓ (0 damage, pushback 14). Fine. But hmm, if their light is in startup at opp.t=0 and we guard, we block it when it hits. ✓.

But consider: their light startup, and we could also attack them during their startup for a counter (mult 1.25) — but we'd trade (their light hits us first at 5-... ). Their light active at (5-opp.t) from now. If opp.t >= 3, their active is within 2 ticks → we'd be hit before our light (5 ticks) → guard is right. If opp.t = 0 → their active at +5..+7; our light active at +5..+7 → simultaneous trade (each takes 50 since both in startup). Trading is neutral-ish but our light gives a cancel chain; but if they trade, we might lose the chain (they'd be in hitstun too, so our cancel window still opens ✓). Hmm, trade: we both take 50. Then our cancel → chain more lights: but they're in hitstun 15 → we can chain 3 more (at 6-tick intervals: 15 ticks of stun, our chain hits at +6, +12, +18 → the 3rd at +18 is after their stun ends at +15). Hmm.

Guarding gives 0 damage and pushes us back 14. Trading gives 50 damage to them and 50 to us. Trading is better if we're OK taking 50 (unless our HP is low). But the risk: if they trade a heavy instead later... no, this is a specific light.

I'll guard (safer) — except when our HP is high and their light is early? Let's keep it simple: guard.

Hmm, wait. Actually there's an important consideration: if we always guard vs their lights and they keep attacking, we never damage them. We need to counterattack during their recovery. After they punch (blocked), they're in recovery 9 ticks → we can attack then (counter 1.25 → 50 damage) if in range. Their recovery: light total 17 ticks (5+3+9). If they punch at their t=5..7, recovery runs from t=8 to t=17 → 9-10 ticks of recovery. Our next ask is within 6 ticks → we might see them in recovery and attack with a light (5 startup) → hits during their recovery ✓ → 50 damage + our cancel → chain.

But if we're in blockstun (11 ticks) after blocking, we're free at +11 while their recovery ends at +17 (relative to their punch). Let's see the timeline: their punch hits at tick T (their t=5). We block at T → we're in blockstun 11 → free at T+11. Their recovery ends at T+9 (t=17). So by the time we're free, they're free too. Hmm, so we can't punish during their recovery unless we skip the block.

Alternatively: don't block; trade. Or dash.

Or: don't guard; instead dash_back to avoid their light while staying aggressive? Dash costs ki.

Or: guard, but our blockstun ends at T+11 and their recovery at T+9 — we're 2 ticks late. Meh.

Alternatively, when their light is in startup and we're in range, we could start our own light to trade (both hit). Since a trade is symmetric and gives us a chain, and their damage (40-50) is less than what we get (40-50 + chain 32+26+22 = 120-140 total for a 4-chain vs their 50). Wait let's compute the trade scenario: both lights hit at ~the same time: they deal 50 to us (we're in startup → counter 1.25 → 50 damage to us) and we deal 50 to them (counter). Then we're both in hitstun 15 and our cancel is open → we chain 3 more lights: 32+26+22 = 80 more damage (scaled) while they're stunned. They can't do anything. So the exchange: we take 50, they take 130. That's a great trade for us!

But the risk is that they don't trade (they block our light → our light is blocked → 0 damage, and they deal 50 to us in the trade... wait if they block our light, we take 0 from our light but they still hit us for 50 (their light hits us since we're in startup, not guarding) → we take 50 and they take 0. Hmm! That's the risk: if they switch to guard at the right time... but they can't: they're committed to the light startup (they already started it) — the decision to start the light is simultaneous with ours. If they started a light, they're not guarding. So a trade is guaranteed if we're in range and both lights are active at the same time!

Timing: their light started before our decision (opp.t >= 1) → their active is at (5-opp.t)+... For opp.t >= 1, their active comes before ours → they hit us first, then we're in hitstun → our light never comes out (we're in hitstun, the light move is interrupted). So we'd take 50 and deal 0! Bad.

So trading is only good if opp.t == 0 (their light just started this tick) — but we see opp.t=0 only if they started their light at the previous tick and our ask is 1 tick later... Actually opp.t counts ticks in the current state. If they started the light at tick T (their state becomes 'light', t=0 at that tick), and we see it at tick T+1 with opp.t=1. So we'd never see opp.t=0 for an opponent action... unless our ask happens at the same tick they decide (we see the state before their decision, so no). So opp.t >= 1 always when we observe a new opponent move. Therefore their light's active is at most 4 ticks away and our light can't beat it.

So: if opp.state === 'light' && phase === 'startup' → guard (block) is right, or dash.

What about opp in light 'active' phase (they're hitting now)? If we're asked at that exact tick, their strike lands this tick → we must guard NOW (or dash). Since their active lasts 3 ticks and we might be asked during it → guard.

So: if opp.state === 'light' && (phase === 'startup' || phase === 'active') && dist <= 110 → guard. (Their light is blocked.)

Hmm, but if their light is in startup and we're at dist 105, and we guard, they get blocked → pushApart pushes us 14 away → dist 119. OK.

And if opp.state === 'light' && phase === 'recovery' → attack (counter 1.25)! Their recovery is 9 ticks. Our light startup is 5 → we hit at +5..+7 if the recovery lasts. Light recovery: t from 8 to 16 (dur 17) → 9 ticks. If we see them at recovery t=0 → 9 ticks left → our light hits at +5 ✓. If we see them at recovery t=5 → 4 ticks left → our light hits at +5 → too late (they're free at +4). Hmm. So attack only if their recovery has ≥ 7 ticks left: opp.t <= 9 (since recovery starts at t=8 and dur=17 → remaining = 17 - opp.t; we need remaining >= 7 → opp.t <= 10). Let's just check `opp.phase === 'recovery' && opp.t <= 9`.

Actually, 'recovery' for a light starts at t=8 (5+3). remaining = 17 - opp.t. For opp.t in [8,16]. remaining >= 7 → opp.t <= 10.

Similar for heavy recovery (22 ticks, from t=13): remaining = 35 - opp.t >= 7 → opp.t <= 28.

For blast recovery: dur = 11+18 = 29, recovery starts at t=11 → remaining = 29 - opp.t.
For beam recovery: dur = 90, recovery starts at t=70.

Generalizing: I can compute the opponent's remaining action duration from the rules: `opp.left` is given! "left：这个状态还剩几 tick" — for a move state, left = dur - t. So opp.left tells us the remaining ticks in the current state. For recovery, we need opp.left >= 7 (our light startup 5 + a margin). And opp.phase === 'recovery'.

So: attack with light if opp.phase === 'recovery' && opp.left >= 7 && dist <= 100.

Also: if opp.phase === 'startup' of a blast (11 ticks) → our light (5 ticks) interrupts their blast ✓ and they can't hit us during startup → attack! Condition: opp.state === 'blast' && phase 'startup' → light (if dist <= 100). Damage: counter 1.25 → 50 + interrupt their blast (they lose 20 ki) ✓.

Also, if opp.phase === 'startup' of a beam → interrupt (handled in the beam branch) ✓.

Also, if opp is in hitstun (state 'hitstun') → they're locked; attack with light (they eat it). Damage scaled by their combo. Their combo increments per hit while they're stunned; if their combo is c, the next hit scale = combo[c]. If we hit them again, their stun refreshes to 15 (good for us).

Hmm, but consider: their hitstun has `left` ticks. If their stun is about to end (left <= 5), better to wait? If we attack now, our light (5 startup) hits at +5..+7; if their stun ends at +3, they become free and might guard our light → blocked. So attacking into a hitstun with left <= 5 is risky. Better: wait until they're in recovery. Hmm, but waiting means we do nothing (idle) and they recover.

Let's simplify: if opp.state === 'hitstun' && opp.left >= 7 → light (they're locked, we hit them). If opp.left < 7 → idle (wait, they'll enter recovery... hmm, actually after hitstun ends they become free (idle) — they don't enter recovery. The hitstun ends → free → they can act. So waiting doesn't guarantee a recovery window. But their next action will have a startup → we might get a counter window later.

Hmm, hitstun from our own light chain is the common case: we're in the cancel window then, not here.

Let's also consider 'blockstun' (they blocked something): left ticks; we can hit them during it (full damage since their combo is 0). Same rule: if left >= 7 → light.

'crushed' (34 ticks): left >= 7 usually → light ✓ (full damage, they can't act).

'down': invulnerable → don't attack.

OK.

Now the "free opponent" case (idle/forward/back/charge):
- charge → light (1.5x = 60 damage) ✓ great.
- idle/forward/back → light (risk of them blocking/trading). Since they're free, they might start a light at the same time → they hit us first (their active at +5 vs ours at +5: theirs started at their decision tick; ours starts at our decision tick; both at t=0 → both active at +5 → simultaneous trade → both take 50 (counter). Hmm, that's a trade, which is decent for us (we get the chain).
  Actually wait: if both are in startup when the strike lands, mult = 1.25 for both → each deals 50. Both get hitstun 15. We get a cancel → chain 3 more lights → they take 32+26+22=80 more. We take 50. 
  So trading is GOOD for us (as long as they trade with a light). If they block instead — they can't, they already committed to a light. Unless they were already in 'guard' state (then our light is blocked).
  So attacking a free opponent is fine as long as they don't guard. If they guard → our light is blocked (0 damage) and they get pushed... wait, in the blocked case: `pushApart(m, a, o, M.push)` pushes the blocker (o) 14 away. And we're in blockstun 11.
  
So attacking is weakly positive: if they trade, we win the exchange; if they block, we lose a little tempo.

But: what if they're in 'guard' → we use heavy instead ✓.

What if they dash (state 'dash')? invulnerable → our light whiffs. Check opp.invulnerable → don't attack; instead reposition (back) or wait. Let's handle: if opp.invulnerable → return 'back' (create space) or 'idle'. Hmm, if they dash forward toward us, waiting is fine. Let's return 'idle' (or 'back' if we want space). I'll return 'idle' — but careful, 'idle' means we stand still; fine.

Now the approach when dist > 100:
- If opp is down/crushed/hitstun with a long left → we have time: charge ki? Or walk forward? Let's walk forward (close the distance) — but if they're down (42 ticks) we could walk to a good position. Let's do: 'forward'.
- If ki >= 10 and dist >= 200 and no threat → dash_forward to close. Condition: the dash lands us at dist-200 (if dist > 260 → dist-200 > 60; we land in front at dist 60-100 when dist ∈ [260,300]; if dist ∈ [200,260], we land within 60 → dashEnd: "if before>0 and after<minGap" → after = dist-200 < 60 → we go through them if there's room behind → land behind at dist = 200-dist (i.e., 0..40?) hmm: behind = o.x + d*max(minGap, -after) → for dist=220, after=20 → behind = o.x + d*60 → we're 60 behind them. So we land 60 behind them ✓ (not great, but fine).
  So dash forward at dist 200-300 lands us within 0-100 of them, usually on the far side. Risk: they turn and attack us during our 8-tick recovery.
  
  Alternatively, don't dash; walk forward and blast.

Hmm. Let me think about the trade-off differently. The dash costs 10 ki + 18 ticks of no action. Walking forward costs time but keeps our freedom.

Since we don't know the opponent's style, let's implement:
- If dist > 100:
  - If opp is committed (in startup/recovery/hitstun) → 'forward' (close in, they're busy).
  - Else (opp free):
    - If ki >= 20 and dist >= 140 → 'blast' (ranged poke; they must block or eat 70; also it pressures them).
      Hmm, but a blast at dist 300 takes ~18 ticks to arrive; they can move/attack us in the meantime. But it's a free option.
    - Else if ki >= 10 and dist >= 220 → 'dash_forward'.
    - Else if ki < 20 and dist >= 180 → 'charge' (build ki; they're far).
    - Else → 'forward'.

Wait, but if the opponent is charging and we're blasting, fine.

Hmm, let me reconsider the blast: our blast startup 11 + travel; if they block it, they get +2 ki and 14 blockstun; we wasted 20 ki. If they eat it: 70 damage + 20 hitstun. If they blast-cancel it: both gone. It's a decent poke but our blast also has a 29-tick total duration.

Given that our light chains are the main damage and the blast is a zone tool, let's use the blast when the opponent is far (>= 150) and free, and we have ki >= 25 (keep a reserve for dashes). Also, the blast gives us time to approach? No — during the blast (29 ticks) we can't act.

Alternatively, when the opponent is far and free, maybe the best is to 'forward' and close in. The blast's 70 damage is less than a light chain's 120 but doesn't require range.

I'll include the blast with a moderate frequency: when dist >= 150, ki >= 30, opp free, and timeLeft > 600.

Hmm, but there's a subtlety: if we blast and they walk toward us, we eat it. Let's also require that the opponent isn't already close to attacking range (dist >= 150 ✓).

Now, beam usage: Let's use it when:
- ki >= 60, opp.hp <= 400 (worth it), and the opponent is incapacitated (down/crushed/hitstun with left >= 30) or far (dist >= 230) and not threatening.
Also, a beam can be a clash opportunity. Hmm.

Honestly, beams are high-risk/high-reward. Let's use them rarely: when the opponent is down (42 ticks of downtime) and ki >= 55: our beam startup 30 → they'd be up at 42... hmm, our beam fires at 30 (during their down) and the beam travels toward them; if they're still down when the beam reaches them, they're untouchable (down = invulnerable) → the beam passes over them?! `if (invuln(R,o)) { dodge; continue; }` — the beam's `hit` flag stays false, and when they get up, if they're still in the ray → they get hit! "无敌结束时如果还在光束里，照样挨打" ✓. The beam fires for 40 ticks with the front advancing 30/tick → the ray covers the whole stage quickly. So if they're down when the beam arrives and get up within the fire window, they take 280 ✓.

So: opponent down + we have 55 ki → fire the beam → likely 280 damage. That's a huge swing. 

But: they might not be down; also we might be interrupted during the 30-tick startup (they recover and hit us). If they're down for 42 ticks and our startup is 30 → they get up at 42 > 30 → our beam fires while they're still down ✓ (if we're not interrupted). We start the beam at their down start... we should fire it promptly.

But wait: can we even act while they're down? Yes, we're free.

Also, a heavy knockback knocks them down 42 — so a common sequence: light chain → heavy (knockdown) → beam (if ki >= 55) → 280 damage while they're down. Total: 174 + 280. That's a fight-winning combo. Ki: beam 50 + dash maybe. Ki income: 174 damage dealt → 3.5 ki; taking 120 damage → 9.6 ki. Starting 30 ki. So we can't afford the beam right after a chain unless we have saved ki.

So saving ki (charging) matters for the beam combo. Hmm. Let's implement a "ki reserve" policy: charge when the opponent is not threatening and ki < 60.

Hmm, this is getting complex, but let's write it with reasonable priorities.

Let me define the free-decision priority list:

```
function onFree(state) {
  const {me, opp} = state, R = RULES, dist = state.dist, ki = me.ki;

  // 1) incoming blast → guard (block, only 12 chip)
  const inc = state.blasts.find(b => b.incoming);
  if (inc) return 'guard';

  // 2) opponent beam
  if (opp.state === 'beam') {
    if (opp.phase === 'startup') {
      // interrupt
      if (dist <= 96) return 'light';
      if (dist <= 130) return 'heavy';
      if (ki >= R.dash.cost && (R.beam.startup - opp.t) >= 18 && dist <= 300) return 'dash_forward';
      return 'guard';
    }
    if (opp.phase === 'firing') return 'guard';
    // recovery → fall through
  }

  // 3) incoming heavy
  if (opp.state === 'heavy' && (opp.phase === 'startup' || opp.phase === 'active') && dist <= R.heavy.reach + 2) {
    if (opp.phase === 'startup') {
      const activeStart = R.heavy.startup - opp.t;
      if (ki >= R.dash.cost) {
        if (opp.t >= 4) return 'dash_forward';
        return 'back';   // next ask (opp.t+6 >= 6) → dash branch
      }
      const need = R.heavy.reach + 6 - dist;
      if (state.wallBehind > need + 10 && R.walk.back * activeStart >= need) return 'back';
      return 'guard';
    }
    // active phase: dash now to dodge the remaining active frames
    if (ki >= R.dash.cost) return 'dash_forward';
    return 'guard';
  }

  // 4) opponent light startup/active in range → guard (block)
  if (opp.state === 'light' && opp.phase !== 'recovery' && dist <= R.light.reach + 2) return 'guard';
```
Careful: opp.phase for 'light' can be 'startup','active','recovery'. ✓.

```
  // 5) attack windows
  const oppBusy = !FREE.has(opp.state);  // committed
  if (opp.state === 'down') {
     // they're down: reposition / charge / beam
     if (ki >= R.beam.cost + 5 && opp.left >= 25) return 'beam';   // they'll get up into the beam
     if (ki < 45) return 'charge';
     return 'forward';
  }
  if (opp.invulnerable) return 'idle';  // they're dashing
  if (dist <= 100) {
     if (opp.state === 'guard') return (dist <= 132 ? 'heavy' : 'guard'); // crush vs guard; else nothing
     if (opp.state === 'charge') return 'light';   // 1.5x
     if (opp.phase === 'recovery' && opp.left >= 7) return 'light'; // counter 1.25
     if (opp.state === 'hitstun' && opp.left >= 7) return 'light';
     if (opp.state === 'blockstun' && opp.left >= 7) return 'light';
     if (opp.state === 'crushed') return 'light';
     if (opp.state === 'blast' && opp.phase === 'startup') return 'light'; // interrupt
     // opp free (idle/forward/back)
     return 'light';
  }
  // 6) far
  ...
}
```

Hmm, wait: in the case dist <= 100 and opp free → 'light'. But if the opponent is 'forward' (moving toward us), their position changes; our light's active at +5 → they moved 22.5 closer → still in range ✓. If opp is 'back' (retreating), they move 15 away → dist 115 → miss! So if opp.state === 'back' and dist is close to 100, our light might miss. Let's require dist <= 92 when opp is 'back'. Or better: predict. Let's add a predicted distance:
```
let pd = dist;
if (opp.free) {
  if (opp.state === 'forward') pd -= R.walk.forward * 5;   // they close in (they only reach us if they're approaching)
  else if (opp.state === 'back') pd += R.walk.back * 5;
}
```
But their action might change (they decide simultaneously). We can only guess. Use the margin: light hits if the actual distance at the active frame <= 110.

If opp is 'back' (retreating) and dist <= 100 → predicted 115 → likely miss. So: if opp.state === 'back' → don't light unless dist <= 92. If opp is 'forward' → light is fine (they come closer) unless they pass us? No.

Also, if opp is free and idle → they might start a light (trade) or guard (block) — either way, attacking is reasonable.

Now the far case (dist > 100):
```
  // 6) far
  const oppBusy = !FREE.has(opp.state);
  if (oppBusy) {
     // they're committed: close in
     if (opp.state === 'crushed' || opp.state === 'hitstun' || opp.state === 'blockstun') {
        // they have left ticks; if it's long, maybe charge or set up
        if (opp.left >= 25 && ki < R.beam.cost + 10) return 'charge';
     }
     return 'forward';
  }
  // opp free and far
  if (dist >= 150 && ki >= 30 && timeLeft > 900) return 'blast';  // zone
  if (ki >= R.dash.cost && dist >= 210) return 'dash_forward';  // close quickly
  if (ki < 30 && dist >= 170) return 'charge';  // build ki at range
  return 'forward';
```

Hmm, the 'charge' choice: while charging we take 1.5x damage, but at a distance it's usually safe.

Also, we should probably not dash forward when the opponent is free and might attack: dashing forward makes us vulnerable in the recovery (8 ticks). But dash also has invuln for 9 ticks. Let's allow it.

Hmm, also: 'dash_forward' when dist >= 210 lands us at dist <= 100 (in front) or behind. When it lands us behind them (dist < 260), we're on the wrong side and they turn on us. Let's restrict dash_forward to dist >= 250 (so we land 50+ in front, min gap 60). Actually at dist 250: dash 200 → after = 50 < 60 → we go through them → land 60 behind them. Hmm! The dashEnd rule: if before>0 and after<minGap → try to land behind; if there's room behind them → behind = o.x + d*max(minGap, -after) = 60 behind them. So at dist 250 we end up behind. To land in front, we need dist - 200 >= 60 → dist >= 260. So: dash_forward only when dist >= 260 → lands in front at dist-200 ∈ [60, ...]. If dist > 320, we land at dist-200 > 120 → not in light range but closer.

Hmm, the initial distance is 300 → dash lands at dist 100 ✓ perfect. If the distance is 280 → lands at 80 ✓. If 260 → 60 ✓.

So dash_forward when dist ∈ [260, 320] → land at 60-120. Nice. If dist > 320 → land at > 120 (still closer). If dist < 260 → we'd go through them (behind) → then we'd re-face and attack; it's not terrible but they turn on us.

Let's allow dash_forward for dist >= 255, and also for dist >= 210 if we don't mind going behind (which can be good for dodging their attacks). Hmm, let's just use dist >= 250.

Alternatively, use dash_back when the opponent is close? Not needed.

Now, let's reconsider: is walking forward OK vs an aggressive opponent? We might walk into their light. Our light range is 110; their light is the same. When they approach, we get a decision and can react.

Let me also handle the case where opp is free and close (<= 100) but we're in a bad position (e.g., near the wall). Not critical.

One more important thing: the light's pushback means our combos push the opponent toward the wall. When they're at the wall, the push transfers to us (pushApart: if the opponent has no room, the attacker is pushed back). That's fine.

Also: our own position — we should avoid being cornered. If wallBehind is small and the opponent pushes us... eh.

Now the clash logic:

```js
function onClash(state) {
  const c = state.clash, me = state.me, R = RULES;
  // pos 0 = on me, 1 = on opponent
  // push if we're stronger
  const ki = me.ki;
  if (ki <= 8) return 'idle';               // no ki → no push bonus; conserve
  if (c.myPower >= c.oppPower) return 'push';
  return 'idle';
}
```
Hmm, one consideration: pushing drains ki fast; if both sides are low ki, we want to conserve so that when their ki hits 0 (power 0.5) we can... but pushing requires ki > 0 for the +0.6 bonus. If our ki is 5 and theirs is 100 (power 3.0), we can't win → conserve.

Also, the rage bonus (hp < 30%) applies to both.

Actually, let's think: the power formula: with ki>0: 1 + 0.02*ki + 0.6(push) ; ki=0: 0.5.
The drift = (myPower - oppPower)*0.1 per tick, toward the weaker. Noise sd 0.8 per tick.

With equal ki (say 50): both powers 2.0. If I push: mine 2.6 vs theirs 2.0 → drift 0.06 toward them. But my ki drains 0.8/tick vs their 0.2/tick. After 50 ticks, my ki = 10, theirs = 40 (if they don't push): my power = 1+0.2+0.6 = 1.8, theirs = 1.8. Equal. Then my ki drains to 0 in 12 more ticks while theirs drains 0.2/tick → at my ki=0: my power 0.5, theirs ~1.56 → they win the drift. So pushing when equal is a wash. Pushing is best when we have a big ki lead.

So the condition should be: push if myPower - oppPower >= ~0.5 (a real advantage). With my ki 100 (power 3.0) vs their ki 20 (1.4): pushing gives 3.6 vs 1.4 → drift 0.22 → we win.

Also, the position matters: if pos is already near 1 (we're winning), maybe we don't need to push (conserve ki). But pushing accelerates. If our power advantage is large, push.

Let's use: push if (c.myPower >= c.oppPower + 0.45) && ki > 12. Also if we're at pos >= 0.85 and our power >= theirs → we're about to win; push anyway to finish faster? The win gives 320 damage. Let's push when the advantage is clear.

Also, if our power is much lower, conserve ki and hope they burn it (if they push, they drain faster). If they don't push, the clash drags to 360 → draw (120 damage each + knockdown). That's not terrible.

Hmm, what if our power advantage is small (0.1)? Then pushing costs us ki. Let's use a threshold of 0.4.

Hmm, but also: the state shows myPower and oppPower which include their current push flag. If they pushed last cycle, oppPower includes +0.6.

Let's finalize: push if (myPower - oppPower) >= 0.4 and ki >= 10.

One more: if we're losing (pos decreasing) and our power advantage is 0, maybe push anyway to reverse? Pushing costs ki but adds 0.6 which flips the drift. If our ki is high (>= 40) and theirs is lower, our power would already be higher. So the power comparison covers it.

OK. Also: during the clash, we can't do anything else.

Now, the beam-vs-beam clash: we might want to avoid entering a clash when we're weak. But we can't control their beam. If a clash happens, use the logic.

Let me also think about our beam usage decision more concretely. Add to the free logic:

```
// use beam when it's safe and valuable
if (ki >= R.beam.cost && opp.hp <= 520 && timeLeft > 600) {
   const safe = (opp.state === 'down' && opp.left >= 20) || (opp.state === 'crushed' && opp.left >= 25) || (dist >= 250 && opp.state !== 'beam' && opp.phase !== 'startup');
   ...
}
```
Hmm, when dist >= 250, their light (110) can't reach us immediately, but they can walk (4.5/tick * 30 = 135) → they'd need 31 ticks to reach 110. Our beam startup is 30 → they might reach us at 31 → our beam fires at 30 ✓ (just in time). But if they dash forward (200 in 10 ticks) → they'd be in range at +10 and hit us at +15 → interrupt our beam. So dist >= 250 isn't safe against a dash.

Alternatively, only use the beam when the opponent is incapacitated (down/crushed) — the safest. Or when their hp is low and we need the burst (e.g., opp.hp <= 300 and our hp is much higher).

Let's implement:
```
if (ki >= R.beam.cost + 2 && opp.hp <= 550 && opp.state !== 'ko') {
   const safeWindow = (opp.state === 'down' && opp.left >= 18) || (opp.state === 'crushed' && opp.left >= 22) || (opp.state === 'hitstun' && opp.left >= 26);
   if (safeWindow) return 'beam';
}
```
Note: opp.left for 'down' = dur - t = 42 - t. If they're down with 18+ ticks left and our beam startup is 30 → they get up before we fire, but the beam fires and travels; the ray reaches them in ~1-2 ticks (if close) → they might have just gotten up and can act. Hmm, we want the beam to hit while they're still down or just after they get up. If they're down with 18 left: we start the beam at t=0, it fires at 30, they get up at 18 and can act at 19 (they're asked when free) → they might attack us during our startup (interrupting the beam!) — that's the risk. Hmm.

So the "safe window" should be: they can't reach us during our 30-tick startup AND the beam hits them. If they're down for the entire startup (left >= 30) and then get up into the ray → we win 280. If they're down for only 20, they get up and can interrupt our beam (if in range).

So: safeWindow = opp.left >= 32 (covering the startup) and they're in range-ish so the beam hits them when they get up. Actually if they're down and we fire the beam, the beam fires at 30, and the front advances 30/tick → it covers the stage in ~30 ticks; if they're within ~1000 distance, the beam covers them within a few ticks of firing. If they get up at 32 (2 ticks after the beam fires), they'd be hit at ~32-35 if they're in the ray ✓ (the ray is from us to the front; the front advances 30/tick; if they're 200 away, the front reaches them at +7 ticks). But they can move! After getting up, they could dash away (invuln 9 ticks) — but the beam hits when it reaches them; the beam's `hit` flag: they were invulnerable when the beam first covered them (down = invulnerable → `dodge` → continue, no hit flag) → then when they're no longer invulnerable and still in the ray → hit ✓. If they dash away during those ticks → they might escape the ray? The ray is a segment from us to the front, expanding. If they dash backward 200, the front still advances past them → they'd still be in the segment (the segment covers everything between us and the front) → they'd be hit unless they're invulnerable. Dashing gives invuln 9 ticks; if the beam front reaches them during the invuln, they're dodged, and then when the invuln ends they're still in the ray (the front has passed them) → hit ✓ (the code checks inRay each tick; the hit flag is only set when it actually lands). So a beam essentially hits anyone who doesn't leave the ray or get hit. The ray expands 30/tick and covers the stage within ~32 ticks, and it fires for 40 ticks. So it's very hard to escape, except by dashing through? A dash doesn't help as shown. The only escape: the opponent is beyond the front when the beam fires and moves faster than 30/tick? Impossible (dash 20/tick).

Wait, but the ray starts at the shooter's position (from = me.x + 25) and expands forward. If the opponent is BEHIND us (we're facing away) — can't happen (we face them when free).

So a beam that fires is nearly unavoidable! The opponent's only defense: interrupt during the startup (30 ticks), or block it (chip 120 + stun).

So the beam's value is huge if it fires. Therefore we should be aggressive about firing beams when we can.

When is a beam safe? During our 30-tick startup, we need to not be hit. Threats: their light (needs to be within 110 at their startup+5), their heavy, their blast (travel), their dash (they can dash in and hit us).

If the opponent is down/crushed/stunned for the whole 30 ticks → safe ✓.
If the opponent is far (dist >= 250) and doesn't dash → they need 31+ ticks to walk into range → safe (marginally).
If the opponent is at mid-range and free → risky.

Also we should consider: the beam costs 50 ki, and it takes 90 ticks total (30 startup + 40 fire + 20 recovery). That's 1.5 seconds of commitment.

Given the beam's power, let's use it in these cases:
(a) opp is down/crushed with left >= 32 → fire.
(b) opp.hp <= 300 and ki >= 50 and dist >= 200 → fire (a desperation finisher; if they eat 280, they likely lose).
(c) mid-game with ki >= 70 and dist >= 240 → fire.

Hmm, (c): dist 240, they need 130/4.5 = 29 ticks to walk into 110 range, plus 5 startup → 34 ticks > 30 → they'd hit us at 34, after our beam fires at 30 ✓ (and the beam hits them around 30-37). Marginal but OK. If they dash in, they interrupt. Risk.

Let's include (c) with dist >= 250 and ki >= 65 (so we keep a reserve).

Now, when do we accumulate 65 ki? Charging: 0.36/tick → 180 ticks = 3 seconds. Or damage income.

Hmm, let's think about the balance: our main plan (approach → light chain → heavy) does ~170 damage per exchange. Their beam does 280. Their blast does 70.

I think a solid plan: fight with lights/heavy, charge ki during downtime, and use the beam when the opponent is down or far.

Let me also consider using the beam as a response to their blast? A beam swallows blasts. Not urgent.

Let me now write the actual code, keeping it clean.

Also: I should double check the "light" decision when opp.state === 'light' && phase === 'recovery' — we attack for a counter. But note: their recovery means they can't act ✓.

And opp.state === 'heavy' && phase === 'recovery' → attack (counter) ✓. Their recovery is 22 ticks — plenty.

And opp.state === 'blast' && phase === 'recovery' → attack ✓ (they can't act for the remaining recovery).

And opp.state === 'beam' && phase === 'recovery' → attack ✓ (the beam is over; they have 20 recovery ticks left).

So the general rule: if opp.phase === 'recovery' && opp.left >= 7 → light (counter). ✓ This covers all move types.

And for startup: only blast startup is safe to attack into (they can't retaliate during startup). Light startup → guard. Heavy startup → evade. Beam startup → interrupt with the biggest option.

Wait, careful with blast startup: their blast startup is 11 ticks; our light startup is 5 → we hit at 5-7, before their blast spawns at 11 ✓. And their blast is canceled (they're stunned) ✓. Damage: 50 (counter) ✓.

But hold on: if we're in range (<= 100) and they start a blast, do we want to light instead of guard? Their blast would hit us for 70 (or 12 blocked). Interrupting with a light: 50 damage + cancel their blast ✓ better.

Also: if the opponent is in 'blast' startup and we're NOT in range → just approach (their blast will fly at us; we could guard when it arrives).

OK, let me write the code now.

```js
/* ===== AI 武道会 · 选手程序 ===== */
const FREE_SET = { idle:1, forward:1, back:1, guard:1, charge:1 };
const mem = { last: null };

function decide(state) {
  if (!state) return 'idle';
  const me = state.me, opp = state.opp;
  if (state.clash) return clashAct(state);
  if (me && me.canCancel) return cancelAct(state);
  return freeAct(state);
}
```

Let me write each function.

```js
function freeAct(s) {
  const R = RULES, me = s.me, opp = s.opp;
  const dist = s.dist, ki = me.ki, hp = me.hp;

  // --- 对冲另算 ---
  // 1) 场上飞来的气功波
  for (const b of s.blasts) {
    if (b.incoming && b.eta !== null) {
      if (b.eta <= 3 && ki >= R.dash.cost) return 'dash_forward'; // 瞬移穿过
      return 'guard'; // 挡下（擦伤 12）
    }
  }

  // 2) 对手的大招
  if (opp.state === 'beam') {
    if (opp.phase === 'startup') {
      const toFire = R.beam.startup - opp.t;
      if (dist <= 94) return 'light';      // 打断
      if (dist <= 128) return 'heavy';     // 打断
      if (ki >= R.dash.cost && toFire >= 16 && dist <= 300) return 'dash_forward';
      return 'guard';
    }
    if (opp.phase === 'firing') return 'guard'; // 只能挡，120 擦伤
  }

  // 3) 对手的重击
  if (opp.state === 'heavy' && opp.phase !== 'recovery' && dist <= R.heavy.reach + 2) {
    if (opp.phase === 'active') {
      if (ki >= R.dash.cost) return 'dash_forward';
      return 'guard';
    }
    // startup
    if (ki >= R.dash.cost) {
      if (opp.t >= 4) return 'dash_forward';  // 无敌帧覆盖判定
      return 'back';                          // 先退，下一次询问再瞬移
    }
    const need = R.heavy.reach + 6 - dist;
    if (s.wallBehind > need + 12 && R.walk.back * (R.heavy.startup - opp.t) >= need) return 'back';
    return 'guard';
  }
```
Hmm, for the heavy startup with ki >= 10 and opp.t < 4 → 'back'. But at the next ask, opp.t >= 6 → the startup branch → opp.t >= 4 → dash ✓. But if opp.t was 3 and at the next ask opp.t = 9 → phase 'active' → branch → dash ✓ (the active branch). ✓ Good.

But careful: the 'back' we return might be overridden by the "dist <= reach" condition at the next ask? No, it's evaluated fresh.

Wait, there's an issue with the 'active' branch: if their heavy is in the active phase and we dash, does our dash really avoid it? Our dash state t=0 → invulnerable ✓ → they dodge ✓. But: their strike check happens in strikes() for each fighter. `if (invuln(R, o)) { if (o.state === 'dash' && !a.dodged) { a.dodged = true; dodge(...) } continue; }` → no hit ✓.

But note: the heavy's `a.hit` flag is not set when dodged, so they can hit us on a later active frame if we're no longer invulnerable. Since our dash invuln covers 9 ticks and the active phase is ≤ 4 ticks, we're safe ✓.

```
  // 4) 对手的轻拳（起手/判定中）→ 格挡
  if (opp.state === 'light' && opp.phase !== 'recovery' && dist <= R.light.reach + 3) return 'guard';
```
Hmm, but if opp is in the light 'active' phase and the hit already happened this tick? No—we decide before the strikes ✓.

Wait, actually there's a subtlety: the light's active phase is 3 ticks (t=5,6,7). If we guard at t=5, we block ✓.

```
  // 5) 进攻窗口
  const oppStunned = opp.state === 'hitstun' || opp.state === 'blockstun' || opp.state === 'crushed';
  if (opp.state === 'down') {
    // 倒地：无敌，打不了；利用时间
    if (ki >= R.beam.cost + 2 && opp.left >= 30 && opp.hp <= 700) return 'beam';
    if (ki < 50) return 'charge';
    return 'forward';
  }
  if (opp.invulnerable) return 'idle';   // 对手瞬移中
  if (dist <= 100) {
    if (opp.state === 'guard') {
      if (dist <= R.heavy.reach - 2) return 'heavy';  // 破防
      return 'guard';
    }
    if (opp.state === 'charge') return 'light';  // 蓄力被打 ×1.5
    if (opp.phase === 'recovery' && opp.left >= 7) return 'light';  // 反击 ×1.25
    if (oppStunned && opp.left >= 7) return 'light';
    if (opp.state === 'blast' && opp.phase === 'startup') return 'light'; // 打断气功波
    if (opp.state === 'forward') return 'light';
    if (opp.state === 'back') return dist <= 90 ? 'light' : 'back';
    // idle
    return 'light';
  }
```
Hmm: opp.state === 'forward' → they move toward us → our light connects ✓ (dist decreases).
opp.state === 'idle' → they might start something → trade risk (discussed, acceptable).
opp.state === 'back' → they retreat → if dist <= 90, predicted 90+15 = 105 ≤ 110 ✓ hit. If dist > 90 → miss → instead 'back' (we retreat too, or wait). Hmm, retreating with them is silly. Let's do 'guard' or 'idle'? Let's just 'idle' (wait) — no, if we idle and they keep back-walking, we never engage. Let's use 'forward' to catch up. Hmm, but they walk at 3 and we at 4.5 → we catch up ✓. Let's return 'forward'.

Wait, but they might be baiting us. Whatever.

```
  // 6) 远距离
  const oppBusy = !FREE_SET[opp.state];
  if (oppBusy) {
    if ((opp.state === 'crushed' || opp.state === 'hitstun' || opp.state === 'blockstun') && opp.left >= 22 && ki < 50) return 'charge';
    return 'forward';
  }
  // 对手自由且距离远
  if (dist >= 250 && ki >= R.beam.cost + 15 && opp.hp <= 620 && s.timeLeft > 700) return 'beam';
  if (dist >= 150 && ki >= 30 && s.timeLeft > 900) return 'blast';
  if (ki >= R.dash.cost && dist >= 255) return 'dash_forward';
  if (ki < 28 && dist >= 170) return 'charge';
  return 'forward';
```

Hmm, the beam condition: ki >= 65, dist >= 250, opp.hp <= 620, timeLeft > 700. That's rare but powerful.

Also the blast condition: dist >= 150, ki >= 30. Hmm, a blast at dist 150+ takes 6+ ticks to arrive. OK.

But wait — the ordering: if dist >= 250 and ki >= 65 → beam; else if dist >= 150 and ki >= 30 → blast; else if ki >= 10 and dist >= 255 → dash. There's overlap: at dist 300 with ki 70 → beam (dist>=250, ki>=65) — but at the start (dist 300, ki 30) → blast (ki >= 30, dist >= 150). Hmm, at the start we'd blast immediately with ki 30 (exactly 20 cost → ki 10 left). Then our ki is low. Hmm, maybe don't blast at the start; better to charge ki and approach.

Let me reconsider the ranged game. Options when far apart:
- blast: 20 ki, 70 damage if it lands (12 if blocked), 29 ticks commitment.
- beam: 50 ki, 280 damage, 90 ticks commitment.
- dash_forward: 10 ki, close the gap, 18 ticks.
- walk: free, slow.
- charge: build ki.

A sensible opening: charge while the opponent approaches? But we don't know their plan.

I think a good default: approach with 'forward' and use light chains; use blast only when the opponent is far AND we've got ki to spare (>= 35) and they're not closing.

Let me simplify the far logic:
```
  // 对手自由，远
  if (ki < 30 && dist >= 160) return 'charge';           // 攒气
  if (dist >= 240 && ki >= 65 && opp.hp <= 600 && s.timeLeft > 700) return 'beam';
  if (dist >= 170 && ki >= 35 && opp.state === 'idle') return 'blast';  // 远程压制（对手在待机时）
  if (ki >= R.dash.cost && dist >= 255) return 'dash_forward';
  return 'forward';
```
Hmm, "opp.state === 'idle'" for the blast: if they're idle, a blast is less likely to be dodged? Not necessarily.

Honestly, let me reduce the blast usage: use it when dist >= 180 and ki >= 40 and opp is not closing (opp.state !== 'forward').

Alright. Also, I want a fallback 'idle' rather than always 'forward' — 'forward' is fine.

Now the cancel logic:

```js
function cancelAct(s) {
  const R = RULES, me = s.me, opp = s.opp, dist = s.dist;
  // 我们刚打中一拳，对手被推开 14
  if (me.chain < R.light.chain) {
    if (dist + R.light.push <= R.light.reach - 2) return 'light';  // 还能连上
    // 推远了：重击有 140 范围
    if (dist <= R.heavy.reach - 4 && opp.state !== 'down' && !opp.invulnerable) return 'heavy';
    return 'idle';
  }
  // 连击上限已到
  if (dist <= R.heavy.reach - 4 && opp.state !== 'down' && !opp.invulnerable) return 'heavy';
  return 'idle';
}
```
Hmm, when the chain can't continue (dist too far), the heavy (reach 140) may work. Let's check: after a light hit at dist d, the opponent is pushed to d+14. For the next light to hit: d+14 <= 110 → d <= 96. For the heavy: d+14 <= 140 → d <= 126.

But there's a subtlety: the heavy's active is 4 ticks later than the light's, and the opponent is in hitstun (they don't move) → the distance is stable ✓.

Also, should we cancel into a heavy if our ki is low? Heavy costs 0 ki ✓.

Should we cancel into blast/beam? Blast: 70*scale damage; the scale at combo 4 = 0.45 → 31. Heavy 54. So heavy is better. But blast has a longer range (unlimited). If the opponent is far (dist > 140), a blast could hit them (they're in hitstun 15 → blast startup 11 + travel... if dist is 200, the travel is ~10 ticks → they recover from hitstun at 15 and might block/dodge. Meh.

Also: cancel into beam for 280*0.45 = 126 damage — big! But 30-tick startup during which they recover (15 ticks) and can attack. Hmm, if dist > 120 (they can't reach us with a light immediately) and they have no dash, the beam might fire. Let's consider: cancel into beam when dist >= 130 and ki >= 55 and opp.hp <= 400. The opponent has 15 ticks of hitstun, then they're free and can walk/attack. If dist >= 130, their light (110 reach) needs 20/4.5 = 5 ticks of walking → they'd hit us at 15+5+5 = 25 ticks (if they start walking immediately at 15 and then attack). Our beam fires at 30 ✓ (just in time). Risky but the reward is 126 damage.

Hmm, that's a nice finisher. But the ki cost (50) is heavy. Let's include it in limited circumstances: opp.hp <= 350 and ki >= 55 and dist >= 125.

Hmm, but careful: if the beam gets interrupted, we lose 50 ki and they might counterattack. And our chain damage was 120 + heavy 54 = 174; if the opponent's hp is <= 350, the chain + heavy might already nearly finish them.

Let me keep the cancel logic simple: light chain → heavy. I'll skip the beam cancel (too risky) but keep the beam in the down/free cases.

Hmm, but there's a subtlety in the cancel: after 4 lights, we choose heavy. But what if the opponent is at dist 130 (can't be reached by the heavy at 140? 130 <= 140 ✓). OK.

Also: should the cancel ever choose 'idle' to avoid a bad trade? The heavy's active is 9-13 ticks after the cancel; the opponent is in hitstun 15 → they're stunned for 15 ticks → our heavy hits at 9-13 ✓ (before they recover at 15) → guaranteed hit ✓. Good.

Now, one more important thing: the cancel happens on the tick right after our light hits. But what if the opponent was hit and knocked back such that they're at dist 130 (out of light range but in heavy range)? Then we cancel into heavy ✓.

What if the opponent is at dist 150 (out of both)? Return 'idle' → we recover (9 ticks) and re-approach.

Alright.

Another consideration: the light's push of 14 happens only if the opponent has room; if they're at the wall, the push goes to us (we get pushed back 14). Either way, the distance changes by 14 in the direction away from us (or we're pushed). Actually in pushApart: `o.x += d*s` where s = min(dist, room); if s < dist, the attacker is pushed back by (dist - s). So the total separation increases by 14 either way ✓.

Now let me also handle the case where our light MISSES (the opponent moved away). Then no cancel window; we just recover. Fine.

Let me now write the final code with comments in Chinese (the rules say the reply should contain only the code block and the pre-match declaration line).

One more thought on the initial approach: at the start, dist = 300, both at 30 ki. Our logic: dist >= 150 && ki >= 40? ki = 30 → no blast. ki < 30? No (30 is not < 30). dist >= 255 and ki >= 10 → dash_forward! So we'd dash at the start: from 350 → 550, opp at 650 → dist 100 → then light chain ✓. That's a good opener.

Hmm, but the opponent might also dash. Fine.

Wait, one issue: dash_forward moves us 200 over 10 ticks, but the opponent also moves. The landing is computed at dash start (dashEnd is computed at start using the current positions) ✓.

Let's reconsider the 'charge' condition `ki < 28 && dist >= 160`: at the start ki = 30 → no charge. After the dash (ki 20) and the chain, ki would be low. Then we might charge.

I think we're OK. Let me also add the endgame "protect the lead" logic: if timeLeft < 900 and me.hp > opp.hp + 120 → prefer 'back' when dist < 120, else 'idle'/'guard'. Let me insert it after the threat checks (blast/beam/heavy/light) but before the attack logic. Hmm, but if we're ahead and the opponent is close, running away is good. But 'back' at 3/tick vs their 4.5/tick → they catch us. Use 'dash_back' if ki >= 10 → 200 away. Then keep doing it → we need ki. Meh, let's implement:

```
if (s.timeLeft < 900 && hp > opp.hp + 120) {
   if (dist < 125) return (ki >= R.dash.cost ? 'dash_back' : 'back');
   return 'idle';  // 保持距离
}
```
Hmm, 'idle' when far means they approach and attack us... we then dash back. It's a reasonable "run out the clock" strategy. But if they have a beam, we'd eat it. Let's put this check after the beam/blast checks so we still guard those. Actually if they're firing a beam we should guard (120 chip) rather than run (280). The beam check comes first ✓.

Hmm, but 'idle' vs a free opponent at distance → they'll approach and hit us. With hp lead 120, they need 3 lights to kill us. Risky but OK.

Actually, maybe drop this endgame logic to reduce risk of dumb behavior. Hmm. If the opponent is better at fighting than us, running out the clock with a lead is good. I'll include a mild version: only when the lead is big (> 200) and timeLeft < 600 (10s).

Let me write it:
```
  // 终局保分
  if (s.timeLeft < 600 && hp > opp.hp + 200) {
    if (dist < 120) return (ki >= R.dash.cost ? 'dash_back' : 'back');
    if (opp.state === 'charge' || (opp.state === 'light' && opp.phase !== 'recovery')) return 'guard';
    return 'idle';
  }
```
Place it after the threat checks but before the attack logic. Hmm, but the threat checks include the heavy evasion etc. Let's place it right after the beam check. Actually, if the opponent is in a heavy startup and we have a lead, running is good too. Let's place it after all the defensive checks (1-4) and before the attack logic. Fine.

Now let me write the code. I'll also add a bit of randomness? The rules mention Math.random is allowed and seeded. Not needed; determinism is good.

Let me write the final file.

```js
/* ==========================================================================
 * AI 武道会 · 第 1 季 · 选手程序
 * 策略：贴身轻拳连段 → 重击收尾 → 破防；气功波/大招做节奏与终结；
 *       重击用瞬移躲、大招起手用轻拳打断、气功波用格挡擦伤处理。
 * ========================================================================== */

const FREE_STATES = { idle: true, forward: true, back: true, guard: true, charge: true };

function decide(state) {
  if (!state || !state.me) return 'idle';
  if (state.clash) return clashAction(state);
  if (state.me.canCancel) return cancelAction(state);
  return freeAction(state);
}
```

Let me write out each function fully.

```js
function freeAction(s) {
  const R = RULES;
  const me = s.me, opp = s.opp;
  const dist = s.dist, ki = me.ki;

  // ---- 1. 对手的气功波飞过来了 ----
  for (let i = 0; i < s.blasts.length; i++) {
    const b = s.blasts[i];
    if (b.incoming && b.eta !== null) {
      if (b.eta <= 2 && ki >= R.dash.cost) return 'dash_forward';
      return 'guard';
    }
  }

  // ---- 2. 对手的大招 ----
  if (opp.state === 'beam') {
    if (opp.phase === 'startup') {
      const toFire = R.beam.startup - opp.t;
      if (dist <= 94) return 'light';
      if (dist <= 128) return 'heavy';
      if (ki >= R.dash.cost && toFire >= 15 && dist <= 300) return 'dash_forward';
      return 'guard';
    }
    if (opp.phase === 'firing') return 'guard';
  }
```
Hmm, in the beam startup branch, `dist <= 94 → 'light'`: the light's active is at +5..+7 and the beam fires at toFire = 30 - opp.t. If opp.t = 25 → toFire = 5 → their beam fires at +5 and our light's active is at +5..+7 → they'd be hit by our light at +5 (strikes run before beams) → but wait, at +5 they transition to firing (beams() checks a.t === 30 → spawns the beam) — but if our light hit them at +5, their state becomes hitstun → the beam doesn't spawn ✓ (as analyzed). But if our light's active frame is at +5 and their beam spawns at +5 — order: strikes() then beams(). Our light hits at +5 → stun → beams() sees state != 'beam' → no spawn ✓. But what if our light's active is at +6,+7 (i.e., the hit lands at +6)? Then at +5 their beam spawns and fires (front = from+40, advancing 30/tick). At +5 the beam is at from=x+25..x+40 — is it covering us? If we're at distance 94, the beam front at +5 is 40 ahead of them → not covering us (we're 94 away) → no hit. At +6, the front is 70 → still not us (94 away) → no hit. At +7, the front is 100 → covers us → we'd take 280! But our light hits at +6 (during active frames 5,6,7 → the first active frame is at +5 → the hit registers at +5 if we're in range ✓). Actually the light's active frames are t=5,6,7 (relative to the move start) → the hit happens at the first active frame where the target is in range → at +5. So we'd hit at +5 → before the beam spawns at +5? The beam spawns when a.t === 30 at that tick. If their startup started at opp.t=25 now, then at +5 their a.t = 30 → they spawn the beam at that tick. But our light hit at that same tick happened first (strikes before beams) → they're stunned → no beam ✓. 

But careful: their beam spawns only if their state is still 'beam' at that tick. Our light's hit → stun(o,'hitstun') → their state changes → the beam doesn't spawn ✓.

However, if our light's hit is at +5 but the range check fails (they moved), we lose. Fine.

Also: what if their beam is about to fire (toFire <= 4) and we're at dist <= 94: our light hits at +5 — too late! The beam fires at +4 and its front at +4 is 40 ahead of them; at dist 94 it takes 2 more ticks to reach us (front advances 30/tick: +4:40, +5:70, +6:100 → covers us at +6 with the body margin 30 → the blast covers x±30 → at +6 the front is 100, we're at 94 → inRay(94±30) → 94+30=124 >= 40 ✓ and 94-30=64 <= 100 ✓ → covered → hit at +6). Our light hits at +5 → we stun them at +5 → the beam is canceled (beams[side] is set at the spawn tick... wait, they spawned the beam at +4 → m.beams[side] = {...}. At +5, we stun them → in beams(): `if (m.beams[a.side] && (a.state !== 'beam' || a.t >= startup+fire)) m.beams[a.side] = null;` → their state is 'hitstun' → the beam is removed ✓. And the hit check happens after that removal? In beams(): first the loop that clears beams, then the front advance, then the clash check, then the hit loop. Since the beam was removed, no hit ✓.

So a light interrupt at +5 works even if they fire at +4 ✓ (as long as our light hits at +5 before their beam reaches us — the beam reaches us at +6 ✓).

Good. But if toFire is 0-2 (they fire now) and we're at dist 94, the beam reaches us at +2..3 → we need to guard. Our decision happens now → guard ✓. But the branch order: `dist <= 94 → 'light'` happens before considering toFire! If toFire <= 2, the light is too slow → we should guard. Let me add: if toFire <= 3 → return 'guard' (unless we can dash). Let's restructure:

```
    if (opp.phase === 'startup') {
      const toFire = R.beam.startup - opp.t;   // 距离发射还有几 tick
      if (toFire <= 3) {
        if (ki >= R.dash.cost) return 'dash_forward';  // hmm, dash doesn't dodge the beam!
        return 'guard';
      }
      ...
    }
```
Right — dashing does NOT dodge a beam (the ray covers everything). So guard. But if toFire <= 3 and dist is far (e.g., 200), the beam takes 6+ ticks to reach us → we could still interrupt with a light (5 ticks) ✓. So the condition should be based on when the beam would reach us, not just toFire.

Let me compute: the beam's front starts at (their x + 25) and advances 30/tick; the ray covers from their position to the front. It reaches us when front >= our position - 30 (body). Time to cover = ceil((dist - 25 - 30)/30) = ceil((dist-55)/30) after firing.

So the total time until the beam hits us ≈ toFire + max(0, ceil((dist-55)/30)).
Our light hits in 5 ticks. So we can interrupt if 5 < toFire + travel, i.e., toFire + travel > 5.

Let me define `beamHitIn = toFire + Math.max(0, Math.ceil((dist - 55) / 30))`.

- If beamHitIn <= 3 → we can't interrupt; we must guard (or be out of range — impossible).
- Else if dist <= 94 → 'light' (interrupt) — but careful: our light hits at +5; if beamHitIn is 4 or 5, the beam might hit us at +4 before our light at +5 → we'd eat 280! So we need beamHitIn > 5 → i.e., >= 6 for a light interrupt. If beamHitIn is 4-5 → guard.
  Hmm, if beamHitIn is exactly 5, at that tick the strike resolves before the beam hit → our light at +5 hits them and cancels the beam ✓ (strikes before beams). So beamHitIn >= 5 is OK for the light interrupt. Let me be safe: require beamHitIn >= 6 for the light, >= 10 for the heavy (heavy hits at +9..+13; it interrupts at the first active frame +9 → need beamHitIn >= 9... hmm, the heavy's active is 9,10,11,12 → the hit lands at +9 → we need beamHitIn > 9 → >= 10).

Let me redo with these:
- if beamHitIn <= 4 → 'guard' (can't react).
- else if dist <= 94 && beamHitIn >= 5 → 'light' (hits at +5).
  Actually we need the light to hit at +5 and the beam to hit us at >= +5. If beamHitIn == 5, the order (strikes first) saves us ✓. OK: require beamHitIn >= 5 → but since beamHitIn > 4 in this branch, ✓.
- else if dist <= 128 && beamHitIn >= 10 → 'heavy' (hits at +9, needs beamHitIn >= 9; use >= 10 for safety).
- else if we can close: dash_forward → land in range, then light: the light hits at 18+5 = 23 ticks from now; need beamHitIn > 23 → require beamHitIn >= 25. And after the dash, the distance: dist-200 must be <= 94 to light → dist <= 294. And the dash landing: if dist - 200 < 60 we go through them (behind) → then our light after the dash recovery (8 ticks) → the light's active at 18+5 = 23 from now; but we're facing the old direction → the light would miss (the direction check: d = (o.x - a.x)*a.facing > 0 required). After the dash's recovery ends (at +18), we're free → face() is called for free states → we face them ✓ → the light at +23 hits ✓ (as long as the beam hasn't hit us by then: beamHitIn >= 25 ✓).
  So: if beamHitIn >= 25 and ki >= 10 and dist <= 294 → dash_forward.
- else → 'guard' (block it: 120 chip).

Good.

Similarly, for the beam 'firing' phase → guard ✓ (chip 120 + stun until the beam ends).

Hmm, one thing: when the beam is firing and we guard, the blockstun lasts until the beam ends (ctx.stun = startup + fire - a.t + 6). If the beam just started firing (a.t = 30), the stun = 30+40-30+6 = 46 ticks. And the chip 120. OK.

Now, the incoming blast check: `b.eta` is the number of ticks until it reaches our body. If eta is large (say 30), we could act. But as discussed, committing to actions risks eating the blast. Let's guard whenever a blast is incoming (with eta <= 25). If eta > 25, we could do a light chain (which takes ~24 ticks for 4 lights) → risky. Let's guard for any incoming blast. Simple and safe.

Hmm, but there's a scenario: they blast, we guard (12 chip), they blast again... each blast costs them 20 ki. Fine.

Actually wait. There's an important alternative: cancel their blast with our own blast. If their blast is incoming with eta >= 13 (our startup 11 + 1), firing our blast would create a crossing → both cancel. But our blast's startup 11 then it spawns and they cross... The crossing happens when our blast and theirs meet. Ours spawns at +11 at our position + 40 toward them; theirs at that time is eta-11 ticks away from us. They cross if both are moving toward each other ✓ (they will meet). But if eta - 11 == 0 (their blast hits us at +11 — the same tick ours spawns): the order in blasts(): the spawn loop happens first (a.state==='blast' && a.t === startup → spawn), then the movement loop, then the crossing check, then the hit check. So at +11: our blast spawns at our x+40; their blast moves to within ~30 of us (eta 0 → they reach our body this tick) → the crossing check: do they cross this tick? Our blast is at our_x+40 (just spawned, px = x initially? The spawn sets b.x = a.x + facing*40 and px = a.x — hmm, the spawn code sets `m.blasts.push({owner, x: a.x + a.facing*40, px: a.x, dir})` → then the movement loop sets b.px = b.x; b.x += dir*13 → so our blast moves 13 in the same tick: from x+40 to x+53 (toward them). Their blast is at our body (x-30ish) moving toward us. The crossing check: `(b.px - c.px) * (b.x - c.x) <= 0` for opposite owners → our blast's px = x+40 (before the move) and their px = their old position, our x = x+53 → the product... their blast is to the left of us (if they're on the right, their blast is at x+something moving left toward us). Hmm, let's set up: we're at 400, they're at 700, their blast moving left (dir=-1) at x=430 (eta 0 → it reaches us: |700... no, the blast's x is 430, our body at 400 → |430-400| = 30 = body → it hits us). Our blast spawns at 440 (facing right, toward them) and moves to 453. Their blast: px=443, x=430. Crossing check: (b.px - c.px)*(b.x - c.x) = (440 - 443)*(453-430) = (-3)*(23) = -69 <= 0 → they cross → both dead ✓! So even at eta 0, if our blast spawns at the same tick, they cancel (the crossing check happens before the hit check) ✓.

Hmm nice, but our blast startup is 11 ticks: we decide now, our blast spawns at +11. For their blast to still be alive at +11, eta >= 11. If eta <= 10, their blast hits us before we can cancel → guard.

So: if the incoming blast's eta >= 11 and ki >= 20 and we want to cancel → 'blast'. But is cancelling better than guarding? Guard: 12 damage + 14 stun + 2 ki. Cancel: 0 damage, but 20 ki + 29 ticks of commitment. Guard is better. Keep guard.

BUT: there's a scenario where cancelling is better: if we're about to be comboed. Nah. Keep guard.

Hmm, although... the guard's 14-tick blockstun + the enemy's follow-up. Whatever, guard.

Now, let me reconsider the heavy evasion once more, and also consider that the opponent's heavy could be at startup while we're far (dist > 140) — then it misses ✓ (no action needed).

Let me write the final code now.

Also, I should double check `opp.left` semantics for free states: left = 0. For move states, left = dur - t ✓.

One more: 'hitstun'/'blockstun'/'crushed'/'down' states have dur set ✓ so left is meaningful ✓.

Let me write out the code.

```js
const FREE_STATES = { idle: 1, forward: 1, back: 1, guard: 1, charge: 1 };

function decide(state) {
  if (!state || !state.me || !state.opp) return 'idle';
  if (state.clash) return clashAction(state);
  if (state.me.canCancel) return cancelAction(state);
  return freeAction(state);
}

function freeAction(s) {
  const R = RULES;
  const me = s.me, opp = s.opp;
  const dist = s.dist, ki = me.ki;

  // 1) 对手气功波飞来 —— 格挡掉（只擦伤 12）
  for (let i = 0; i < s.blasts.length; i++) {
    const b = s.blasts[i];
    if (b.incoming && b.eta !== null) {
      if (b.eta <= 2 && ki >= R.dash.cost) return 'dash_forward';
      return 'guard';
    }
  }

  // 2) 对手大招
  if (opp.state === 'beam') {
    const ph = opp.phase;
    if (ph === 'startup') {
      const toFire = R.beam.startup - opp.t;
      const travel = Math.max(0, Math.ceil((dist - 55) / 30));
      const hitIn = toFire + travel;
      if (hitIn <= 4) return 'guard';
      if (dist <= 94) return 'light';
      if (dist <= 128 && hitIn >= 10) return 'heavy';
      if (ki >= R.dash.cost && hitIn >= 26 && dist <= 290) return 'dash_forward';
      return 'guard';
    }
    if (ph === 'firing') return 'guard';
  }

  // 3) 对手重击 —— 瞬移/后退躲开
  if (opp.state === 'heavy' && opp.phase !== 'recovery' && dist <= R.heavy.reach + 4) {
    if (opp.phase === 'active') {
      if (ki >= R.dash.cost) return 'dash_forward';
      return 'guard';
    }
    if (ki >= R.dash.cost) {
      if (opp.t >= 4) return 'dash_forward';
      return 'back';
    }
    const need = R.heavy.reach + 8 - dist;
    if (s.wallBehind > need + 14 && R.walk.back * (R.heavy.startup - opp.t) >= need) return 'back';
    return 'guard';
  }

  // 4) 对手轻拳起手/判定 —— 格挡
  if (opp.state === 'light' && opp.phase !== 'recovery' && dist <= R.light.reach + 4) return 'guard';

  // 5) 终局保分
  if (s.timeLeft < 700 && me.hp > opp.hp + 180) {
    if (dist < 120) return (ki >= R.dash.cost ? 'dash_back' : 'back');
    if (opp.state === 'charge') return 'guard';
    return 'idle';
  }

  // 6) 倒地/无敌等特殊局面
  if (opp.state === 'down') {
    if (ki >= R.beam.cost + 2 && opp.left >= 30 && opp.hp <= 720) return 'beam';
    if (ki < 55) return 'charge';
    return 'forward';
  }
  if (opp.invulnerable) return 'idle';

  // 7) 近身
  if (dist <= 100) {
    if (opp.state === 'guard') {
      if (dist <= R.heavy.reach - 2) return 'heavy';  // 破防
      return 'guard';
    }
    if (opp.state === 'charge') return 'light';
    if (opp.phase === 'recovery' && opp.left >= 7) return 'light';
    if ((opp.state === 'hitstun' || opp.state === 'blockstun') && opp.left >= 7) return 'light';
    if (opp.state === 'crushed') return 'light';
    if (opp.state === 'blast' && opp.phase === 'startup') return 'light';
    if (opp.state === 'back') return dist <= 88 ? 'light' : 'forward';
    return 'light';
  }

  // 8) 远距离
  const busy = !FREE_STATES[opp.state];
  if (busy) {
    if ((opp.state === 'crushed' || opp.state === 'hitstun' || opp.state === 'blockstun') && opp.left >= 24 && ki < 50) return 'charge';
    return 'forward';
  }
  if (ki < 28 && dist >= 165) return 'charge';
  if (dist >= 245 && ki >= R.beam.cost + 14 && opp.hp <= 620 && s.timeLeft > 800) return 'beam';
  if (dist >= 175 && ki >= 38 && opp.state !== 'forward') return 'blast';
  if (ki >= R.dash.cost && dist >= 255) return 'dash_forward';
  return 'forward';
}
```

Hmm, wait. In section 7, `opp.state === 'back'` and dist > 88 → 'forward'. But they're walking away at 3/tick and we walk at 4.5 → we close ✓.

Also in section 7, the case opp.state === 'idle' (free, standing): we light. ✓

Hmm, one thing: in section 7, opp.state === 'forward' (approaching) → we return 'light' — our light's active is at +5; they close → dist even smaller ✓ hit. But they might also attack at the same time → trade. OK.

Now the "busy" check in section 8: opp.state is 'light'/'heavy'/'blast'/'beam' (in startup/recovery) or 'hitstun'/'blockstun'/'crushed'/'down' (handled) or 'recover'/'clash'. If opp is in a move's recovery, we should approach and then punish at the right distance. 'forward' ✓.

Hmm, but if opp is in 'light' startup at dist 200 (out of range) → we approach; their light will miss (dist 200 > 110) unless they move. ✓

Now, section 8's charge condition: `ki < 28 && dist >= 165` — but this is after the busy check, so the opponent is free and far. Charging at dist 165+ while the opponent approaches → they might reach us while we're charging (we take 1.5x damage). Hmm. Let's require dist >= 200 for charging. Or check opp.state !== 'forward'. Let's use: `if (ki < 28 && dist >= 190) return 'charge';`

Also the beam condition (dist >= 245, ki >= 64): our beam startup is 30; they can walk 135 in 30 ticks → if dist = 245, they'd be at 110 after 30 ticks → our beam fires at 30 → the beam's front starts at 40 and advances → it reaches them... they're at 110 away → the front reaches 110 at ~3 ticks after firing (front: 40, 70, 100, 130 → at +4 it covers 110) → but they can move/dash. If they dash back at the right moment, they're invulnerable for 9 ticks → they might dodge the beam?? The beam's hit flag: when invulnerable, `dodge` is called and the hit flag stays false → when the invuln ends, if they're still in the ray → hit. If they dashed back 200, are they still in the ray? The ray is from us (x) to the front; the front advances 30/tick for 40 ticks = 1200 → it passes everything → the ray covers the whole stage → they're still in it → hit ✓ (unless they dash forward past us? They'd be behind us → outside the ray (the ray goes forward from us). Hmm, if they dash forward through us, they'd end up behind us → outside the ray → escape! But dashing forward through us requires them to be within 60-260 of us. Possible.

Anyway, the beam is strong. Let's keep the condition conservative.

Also I realize the beam condition requires opp.hp <= 620 — why? To avoid wasting it? A beam does 280 damage; if their hp is 1000, it's still worth it. But the beam is our biggest resource. Let's use it when ki >= 64 and dist >= 245 and timeLeft > 800. Also maybe when opp.hp <= 400 regardless of distance (a desperation finisher)? If their hp is 400 and we're at ki 64, a beam (280) nearly finishes them. But the risk of interruption is high at close range. Keep it to the far case.

Hmm, one more: the 'down' case with `opp.left >= 30` → beam. Let's double check the numbers: they're knocked down for 42 ticks. Our beam startup is 30 → the beam fires at +30 while they're still down (left >= 30 means they have >= 30 ticks left → they get up at +30). The beam fires at +30 (their state becomes free at +30) → the beam's front starts at 40 from us and advances → it reaches them (if they're at dist 100) at +4 ticks → at +34 they're up and get hit ✓ (unless they dash away in those 4 ticks → invuln 9 ticks → but then when the invuln ends at +43, the beam (firing until +70) still covers them → hit ✓ unless they dashed behind us).

Wait, there's a subtlety: when they're down and our beam's front passes over them, the code: `if (invuln(R,o)) { if (o.state==='dash' && !b.dodged) {...} continue; }` → down is invulnerable but not 'dash' → no dodge event, just continue ✓. Then when they get up and are still in the ray → hit ✓.

Great, so beam on a downed opponent is nearly guaranteed 280 damage. Excellent. That's a key combo: chain → heavy (knockdown) → beam. But ki: the beam needs 50; after a heavy knockdown we might have ~20 ki. So we need to save ki beforehand. Hmm.

Maybe modify: charge ki when we have downtime (the opponent is stunned/down) instead of always charging only when far. In the 'busy' branch I have: if the opponent is stunned/crushed with left >= 24 and ki < 50 → charge. And in the 'down' branch: if ki < 55 → charge. So we charge during the opponent's downtime ✓. But downtime is short.

Alternatively: use the blast instead of the beam for the knockdown combo? Blast: 70*0.45=31 damage, 20 ki. Not worth it.

The real issue: our ki economy. Ki income: 0.02 per damage dealt. A 174-damage chain gives 3.5 ki. Taking 120 damage gives 9.6. Passive 0.04/tick = 2.4/sec. Charging 0.32 extra.

To get 50 ki we need ~140 ticks of charging (2.3 sec) or a lot of damage taken. Hmm. So the beam should be used sparingly: when we have saved ki.

Revised ki plan: keep a "reserve" — charge up to ~60 ki when safe (the opponent is far or busy). Let's set the charge threshold to 55 in safe situations (opponent busy/far), and spend ki on dashes only when needed.

Let me restructure the far branch:
```
  if (dist >= 190 && ki < 55 && opp.state !== 'forward') return 'charge';
```
But charging near the opponent is dangerous. dist >= 190 gives some safety (they need 18 ticks to reach 110).

Hmm, but the opponent can also blast (travel ~6 ticks from 190). Charging takes 1.5x damage but a blast is 70 → 105 damage. Hmm. But if they blast, our 'incoming blast' check catches it and we guard — wait, if we're in the 'charge' state, we can switch to guard when asked (charge is a free state, so we can change to guard) ✓. Good: the blast check comes first, so we'd guard instead of charging. But then we're in charge → guard transition is allowed ✓.

OK.

Let me also reconsider: should we charge at all? Consider a full match of 3600 ticks. Charging 100 ticks of downtime gives ~36 ki. Meh.

Actually, here's a thought: damage income is significant. If we trade a lot, we gain ki (0.08/HP taken). Taking 100 damage = 8 ki.

Let's keep the charging modest: charge when the opponent is far (>= 190) and ki < 50, and when they're stunned with a long left.

Now, the dash costs 10 ki. The blast 20. The beam 50.

Budget: start 30 ki.

Alright, let me finalize and also write the clash action:

```js
function clashAction(s) {
  const c = s.clash, me = s.me;
  if (!c) return 'idle';
  if (me.ki >= 10 && c.myPower >= c.oppPower + 0.35) return 'push';
  return 'idle';
}
```
Hmm, should we also consider that pushing when the position is already near 1 (winning) accelerates the win? The win gives 320 damage — worth accelerating. The condition (myPower >= oppPower + 0.35) covers it.

But consider: myPower 2.5 vs oppPower 2.2 → the difference is 0.3 → we don't push → we might lose the drift. The threshold of 0.35 seems arbitrary. Let's think about the economics: pushing costs 0.6 ki/tick extra → over a 6-tick cycle, 3.6 ki → 0.072 power. So pushing's net power gain is +0.6 now, decaying. If our advantage is > 0.072 we gain by pushing (in the short run). But the opponent's push also matters.

Since both sides drain ki during the clash, the side with more ki wins. Pushing accelerates the drain. If our ki advantage is large (>= 25 → power advantage 0.5), push.

Let's use: push if (c.myPower - c.oppPower) >= 0.25 && me.ki >= 12. Hmm, and also if our hp is low (rage) we already have +0.4.

Also: if the difference is negative but small, maybe push to flip it? E.g., myPower 2.0 vs 1.9: pushing gives 2.6 vs 1.9 → drift toward them ✓ (but our ki drains). If our ki is high (>= 60), the drain is affordable. So: push if (myPower - oppPower >= 0.25) OR (myPower + 0.6 > oppPower + 0.3 && ki >= 60)? Getting complicated.

Simplify: push if (c.myPower + 0.6 - c.oppPower) > 0.2 && ki >= 12, i.e., the effective advantage after pushing is > 0.2. But if ki <= 0 the +0.6 doesn't apply (we check ki >= 12 ✓).

Also, don't push if we're losing badly (the drift is against us and our ki is low) → conserve.

Let me write: 
```
const adv = c.myPower - c.oppPower;
if (me.ki >= 12 && (adv >= 0.25 || (adv >= -0.3 && me.ki >= 55))) return 'push';
```
Hmm, the second clause: if the advantage is slightly negative but our ki is high, pushing flips the drift in our favor at the cost of ki. With ki 55 vs their ki 40 (powers 2.1 vs 1.8, adv = 0.3) — that's already covered by the first clause. If adv = -0.3 (their ki is 15 more) and ours is 55: our power 2.1, theirs 2.4 → pushing gives 2.7 vs 2.4 → drift toward us ✓ but we burn ki at 0.8/tick. Our ki 55 → 0 in 69 ticks; their power drops... this is getting complicated. Let's simplify to: push if adv >= 0.25 && ki >= 12. Otherwise conserve.

Hmm, but what if we're at adv = 0.1 and they never push → the clash drags to 360 → a draw (120 damage each + knockdown 60). That's not terrible, but winning is better (320 damage). Hmm, with adv=0.1 the drift is 0.01/tick → we slowly win if no noise... but the noise is huge (sd 0.8). The expected position drift over many ticks: the velocity converges to drift/(1-decay) = 0.01/0.05 = 0.2/tick → over 100 ticks that's 20 (in pos units 0..1 mapped over the distance between fighters ~300 units → 20 units ≈ 0.07 pos). Hmm, the pos is normalized to 0..1 over the distance between the fighters. The clash point moves in absolute units; the drift of 0.2 units/tick vs the distance between fighters (~300) → it takes 1500 ticks to cross. So with a small advantage, we won't win within 360 ticks; the noise dominates → it's a coin flip with a slight edge.

With adv = 0.5 (ki advantage 25): drift 0.05 → velocity 1.0/tick → 300 ticks to cross. Still marginal.
With adv = 1.0 (ki advantage 50): drift 0.1 → velocity 2/tick → 150 ticks ✓.

Hmm! So clashes are mostly noise-determined unless the ki difference is large. The noise: the velocity gets a random shove of sd 0.8 per tick, and the position integrates the velocity (which decays). The position's random walk: std per tick ≈ 0.8 * sqrt(1/(1-0.95^2)) ≈ 0.8/0.312 = 2.56 units/tick → over 360 ticks, the std ≈ 2.56*sqrt(360) = 48 units. Hmm, that's less than 300. So the drift matters: with adv = 0.5, the systematic drift over 360 ticks = 0.1/0.05 * 360 = 720 units — way more than 300! Wait, let me redo: the velocity v satisfies v = 0.95 v_prev + drift + noise. The steady-state v ≈ drift/(1-0.95) = 20*drift = 20*0.05 = 1.0 units/tick for adv=0.5. Over 360 ticks → 360 units ✓ comparable to the distance. And the noise-driven random walk std ≈ 48 units. So adv=0.5 gives a decent edge. With adv=1.0 → 720 units → a strong win.

OK so pushing matters. The push bonus (+0.6) adds 0.06 to the drift → 1.2 units/tick more → significant. But it costs ki.

Given all this, pushing is worth it when our ki is decent and the advantage is positive. I'll use: push if ki >= 12 && (adv >= 0.2 || (adv > -0.2 && ki >= 45)).

Hmm, let me simplify: push if ki >= 12 && adv >= 0.15. Plus: if adv is negative but our ki >= 50 (we have a big ki reserve), pushing flips the drift: our power becomes adv+0.6 > 0 → push. So: `if (ki >= 12 && adv + (ki > 0 ? 0.6 : 0) >= 0.15) return 'push';` — this says: if pushing would make us at least 0.15 stronger, push. But it ignores the ki cost. With ki >= 12 and adv = -0.4 → pushing gives +0.2 → push (we'd burn ki quickly: 0.8/tick → 12 ki in 15 ticks → then power drops to 0.5+... hmm, and their power (if they don't push) stays. We'd lose.

Let me require a bit more margin: push if ki >= 20 && adv + 0.6 >= 0.3 → i.e., adv >= -0.3 (with the push bonus). Or adv >= 0.1 without needing the bonus.

Final: 
```
const adv = c.myPower - c.oppPower;
if (me.ki >= 20 && (adv >= 0.1 || adv + 0.6 >= 0.3)) return 'push';
return 'idle';
```
The second clause is subsumed: adv + 0.6 >= 0.3 → adv >= -0.3. So: push if ki >= 20 && adv >= -0.3. Hmm, but with adv = -0.3 and ki = 20, pushing drains our ki to 0 in 25 ticks → our power crashes to 0.5 → we lose. But without pushing, we'd also lose (the drift is against us). Pushing at least gives a chance. OK, allow adv >= -0.3 but require ki >= 25.

Let's do: `if (me.ki >= 25 && adv >= -0.25) return 'push';` plus `if (me.ki >= 12 && adv >= 0.4) return 'push';` (the first covers it). Simplify: `if (me.ki >= 22 && adv >= -0.25) return 'push';`

Hmm, but also consider: if the position is already at 0.95 (about to win), we want to push to finish. Our power advantage may be negative but the position is good... Actually if pos is 0.95 (the point is near the opponent), we just need a bit more drift. Pushing helps ✓ (covered by adv >= -0.25).

Also: we could lose the clash if we push too much and our ki hits 0 (power 0.5). Let's add: don't push if ki < 25 (as set).

OK. Let me write the final code. I also want to include the 'down' beam and various.

One more: I should double check the 'beam' startup interrupt branch when dist <= 94 but hitIn <= 4 → guard. My code: `if (hitIn <= 4) return 'guard';` comes first ✓, then `if (dist <= 94) return 'light';` ✓ (hitIn >= 5 → our light at +5 hits before the beam at +5? If hitIn == 5: our light's active frame at +5 → the strike resolves before the beam hit check ✓ → we interrupt ✓).

Hmm, but careful: the light's active frames are t=5,6,7 → the hit lands at the first active frame where the target is in range → +5 ✓.

But if the light's active is at +5 and the beam hits at +5, the strike comes first ✓ (strikes() is called before beams() in step()). ✓

Now let me reconsider the 'light' interrupt of a beam startup: our light deals 50 (counter) and cancels their beam. But if they have 50 ki spent... whatever, we also get a cancel window → chain.

Hmm, one risk: our light's cancel window → we chain → but we might want to cancel into a heavy. The cancel logic handles it.

I think the code is reasonable. Let me write it out cleanly now.

Also, note: RULES.dash.cost = 10 ✓, RULES.blast.cost = 20 ✓, RULES.beam.cost = 50 ✓.

Let me write the final answer.

One more consideration about `s.blasts` — the view provides `blasts` with `incoming` true for the opponent's blast heading toward us (gap > 0). A blast that has passed us has gap < 0 → incoming false. ✓ So checking `b.incoming` is right.

Also `b.mine` — our own blast in flight (we can't fire another). Not needed.

Final code:

Also, for the endgame logic, `me.hp > opp.hp + 180` and timeLeft < 700. Let me refine: if we're ahead, we want to survive. Running with dash_back costs ki; fine.

Hmm, also: if we're ahead and the opponent is far, 'idle' is fine. But if they have a beam... the beam check comes earlier ✓.

Let me write it.

Actually, one more important check: in section 7 (近身), when opp is in 'recover' (post-clash winner) — opp.phase is null for 'recover'. `opp.phase === 'recovery'` is false → we'd fall to the final `return 'light'` → attacking someone in 'recover' → they're in a 20-tick recovery, can't act ✓ but they might be invulnerable? No. Fine — a free hit ✓.

Also opp.state === 'ko' → the match is over.

Let me finalize the code text.

I'll also handle the case where `s.me.state` is not free (shouldn't happen when decide is called, except during the cancel). Fine.

Let me write it out.

```js
/* AI 武道会 · 选手程序（第 1 季） */
const FREE_STATES = { idle: 1, forward: 1, back: 1, guard: 1, charge: 1 };

function decide(state) {
  if (!state || !state.me || !state.opp) return 'idle';
  if (state.clash) return clashAction(state);
  if (state.me.canCancel) return cancelAction(state);
  return freeAction(state);
}
```

I'm confident. Let me write the final answer with the code and the declaration line (≤ 20 characters).

Declaration: "连段破防，寸劲封喉！" (10 chars) — fine. Let me make it meaningful: "轻拳连段，重击破防！" (11 chars).

Let me write the final code.