We need answer user's request. Need produce a JavaScript file for decide(state). Need only two things in reply: code block and declaration line. Need design strong bot for tournament. Must analyze thoroughly. We need produce final code only plus line. Need ensure valid JavaScript, no imports, no require, no eval etc. Top-level code runs per match. Function decide(state) returns action string. Use RULES global. Need deterministic? Math.random seeded per match. We can use. Need robust against unknown opponents. Need maximize win rate across round robin 1000 matches each side. Need likely game theory / fighting game AI. Need fit time budgets: <=200ms per call, <=1500ms total. Our decide should be very lightweight. State includes enough. Need top-level variables to remember per match (since reload each match). We can implement heuristic finite state machine. Need understand engine deeply to exploit. Need devise optimal-ish strategy.

Let's analyze game mechanics and meta.

Arena 1D. Two fighters. Actions: idle, forward, back, guard, charge; moves light/heavy/blast/beam/dash. Decision frequency max every 6 ticks when free; immediate after light hit cancel; after free immediate; during clash every 6. So decisions at 10 Hz only. Important: between decisions, held state persists. If choose idle/forward/back/guard/charge, state held until next decision or interruption. Moves have startup etc; cannot act until recovery done; after free immediate ask.

Need handle projectiles, beams, clash. Need choose actions based on state. Need maybe simple but strong: maintain spacing, punish, anti-projectile, combo, guard, avoid heavy? Let's derive.

Key numbers:
- HP 1000, Ki start 30 max 100 regen passive .04/tick (2.4/sec), charge +.32 (total .36/tick =21.6/sec). Damage gives ki taken .08 per hp, dealt .02 per hp, block +2.
- Light: startup 5 active 3 rec 9 total 17. reach 110. damage 40 hitstun 15, blockstun 11 push 14, chain max 4. On hit cancel next tick. On block push. If hit not blocked, attacker gets cancel. Damage scaling on combo: 1,0.8,0.65,0.55,... Light chain up to 4: damages 40+32+26+22 =120? plus maybe heavy/blast/beam cancel. Can cancel into heavy/blast/beam unlimited (but cost). Heavy damage 120, knockdown. Cancel into heavy after light likely hits because opponent in hitstun? Light hitstun 15, cancel next tick start heavy startup 9, active at 9, total from cancel? Opponent hitstun remaining? Light hit at tick t, next decide t+1, heavy starts t+1, active begins t+10. Opponent hitstun 15 from t? Stun dur 15, state t increments; if started at t? Need likely still in hitstun until t+15? Heavy active at t+10-13, connects, combo. Damage scaled second hit 0.8 =>96. knockdown. So light->heavy combo 136. Light chain 2 then heavy? 40+32+? heavy scale 0.65? 78 total 150. But more risk? Chain light up to 4 then heavy? Light damages 40+32+26+22, then heavy 0.45? Actually combo count: opponent combo increments each hit. First light combo=1, second 2, third 3, fourth 4, heavy fifth scale index min(combo,5): after 4 hits combo=4, next heavy scale combo[4]=0.45 =>54. total 174. Beam cancel after lights: 280 scaled maybe high damage but cost 50; if after one light scale 0.8 =>224, total 264, knockdown. Very strong if have ki.

Heavy: startup 9 active4 rec22 total35, reach140, dmg120 knockdown 42 knockback150. Crush on guard: 60 + stun34. But heavy slow, can be interrupted if hit during startup (counter 1.25). Light beats heavy at close? If both attack: light active 5-7, heavy active 9-12, light hits first causing hitstun, heavy doesn't hit (unless trade? Since light first). But if heavy started earlier, can hit.

Blast: cost20, startup11, projectile speed13, damage70, hitstun20, blockstun14, chip12. One on screen. Useful zoning, anti-approach. Can be dodged by dash (invuln 9), blocked (chip + ki +2), clash with opposing blast. Shooter recovery total 29. If opponent dashes through blast? Blast can be avoided. Beam swallows blasts.

Beam: cost50, startup30, fire40, recovery20. Damage280, chip120, knockdown50, knockback120. Beam front speed30 from x+facing*40? In code startup creates beam from a.x + facing*25, front a.x+facing*40, then each tick front += speed. Actually created at t==startup before movement? step: beams function: if state beam t==Bm.startup create from +25 front +40; then for each beam front += speed. So initial front after creation tick maybe +70? But view approximate. Beam covers from shooter to front. Can be interrupted during startup by hit. Once firing, if shooter hit, beam ends? Code: if m.beams[a.side] && (a.state !== 'beam' || a.t >= startup+fire) m.beams[a.side]=null. So if hit during firing, state changes, beam removed. But hit? Beam hit on opponent once; if opponent hits shooter during firing? The shooter can be hit by strikes; yes beam canceled. Clash if opposing beams meet. During clash both stuck.

Dash: cost10, 10 ticks move 200, invuln first9, recovery8. Can pass through. Useful dodge/Approach. Forward dash through opponent can turn around? After landing recovery facing original direction until free; opponent free faces immediately? Code after move separate then face only FREE states. Dash in recovery not FREE so facing stays; opponent if free faces. If dash through, you may face away until recovery ends. Guard only front, so after dash behind, if opponent guard, you can attack from behind? But if you're in recovery can't act; after recovery free ask and face opponent if FREE. Opponent if free will face you instantly. If opponent in guard held, guard front auto faces? face called every tick for FREE states, includes guard, so they turn. So cross-up only useful against non-free? If opponent in startup etc cannot turn. Dash invulnerability dodges strikes/projectiles/beams; if dodges beam, beam doesn't hit but remains? b.dodged true; but if invuln ends while still in beam, code says if invuln continue; later if not invuln and in ray, hit? For beams: if invuln(R,o) { if dash !dodged dodge; continue;} b.hit remains false, so after dash invuln ends, if still in ray, can hit. Rules: if in beam after invuln ends, hit. Dash through beam maybe if timing? Beam covers long; dash moves 200 over 10, invuln 9. If dash forward through beam? Need avoid.

Clash: if both beams firing opposite and fronts cross. Both state clash. decide every 6 ticks, push or not. Power = base 1 + .02*ki + .6 if push (if ki? Actually power formula code: (f.ki >0 ? base+kiPower*ki+(push?pushPower:0) : empty) + rage if hp<30%. If ki=0, power=0.5 (+rage). Push flag set by choose when state clash. Each tick both lose .2 ki; if push and ki>0 additional .6. But if ki reaches 0? push still maybe flag true but power empty no pushPower? Code f.push && f.ki>0? for cost; power uses ki>0. If ki=0, push no effect. Clash point speed. If reaches body (body 30) lose 320 and down. If >360 explosion 120 down both. We need strategy in clash. Pushing costs ki but gives +0.6 power. Base with ki: if both have ki, power diff = .02*(ki diff)+0.6 if push diff. Drain: push costs .6/tick. Clash decisions every 6 ticks; we can decide to push depending pos, powers, ki, hp, time. Need avoid losing. Since random noise. Could always push if enough ki? But pushing drains ki; if ki low may become empty and weak. Need optimize.

Meta: Since all bots see same rules, likely many simple bots. Need robust. Could implement adaptive strategy? Top-level per match can track opponent behavior? But only one match per load? Actually each pair 1000 games, left/right switch. Engine reloads per game, so variables reset each game. No learning across games. But within a game can adapt to opponent state. However no persistent across games. Need single strategy strong vs varied.

Need design decide with no exceptions. Need maybe use local global variables.

Potential winning strategy: exploit simple mechanics. Maybe beam? Heavy? Light combos? Guard? Charge? Need think game-theoretically.

At start distance 300 (350 to 650). Stage 920 length. Walk forward 4.5/tick, back 3. Decision every 6, so can move 27 per decision forward, 18 back. Light reach 110, heavy 140. To land light need close.

If both rational: projectiles and spacing. Blast cost20, damage70. Beam cost50 high damage. Ki management. Passive regen slow, charge safe? Charge vulnerable x1.5, but can build ki. Guard protects lights/blasts/beam (chip), but heavy crush. Throws? Heavy crush guard. So rock-paper-scissors: attack beats charge? guard beats light/blast/beam, heavy beats guard, light/heavy beat charge? dash can dodge.

Since decisions slow (10Hz), reactions limited. But state includes eta for blasts. Can guard incoming blast. Heavy crush guard if predicted. Beam startup 30 (0.5s) can be interrupted by any hit. At range, beam can punish. Blast can be blocked or dodged.

Need maybe implement strong heuristic: maintain midrange, approach when opponent in recovery/stun, guard against attacks, punish with combos, use beam when opponent far and not able to interrupt? Use dash to dodge projectiles/beam? Use charge when safe.

Could there be dominant exploit: infinite light loop? Light hitstun 15, light total 17; if no cancel, next light can't combo. But with cancel, up to 4 lights, then heavy. On block, push away and blockstun 11, attacker still recovery 9? If blocked light, no cancel; both in blockstun/recovery. Light recovery 9 after active? At hit? If blocked during active t=5-7, attacker recovery until t=17, defender blockstun 11 from t maybe. Defender recovers before attacker? If light active at t=5, blockstun 11 ends t=16, attacker recovers t=17, defender can act one tick before? But decisions every 6; maybe not punish. Push creates distance.

Could guard a lot. If opponent heavy, guard gets crushed. Need predict heavy. If opponent charging, hit. If opponent guarding, heavy. But decision frequency makes mixups.

Need account opponents can be simple: maybe always forward+light, guard, random. We need win majority. Could build adaptive opponent model within match? Since 1000 games vs same opponent but no memory across games. Within one game can learn from state history? But only up to 600 calls; can track counts of opponent actions observed (from state transitions? We can infer moves when opp.state changes). Could adapt. But complexity risk.

Maybe strongest is a state machine with safe projectiles and combos. Need ensure not violating time. Keep code compact but robust.

Let's understand engine specifics for precise timing and opportunities.

Decision times: If in FREE state and tick >= nextAsk. After free() (state duration ended) nextAsk=m.tick+1; in step, asks at start before time passes. Suppose recovery ends at end of tick after time pass? free called in time pass after a.t++ if a.t>=dur. nextAsk=m.tick+1. Then m.tick++ end step. Next step tick = old+1, wants true, ask immediate. Good.

Held state: If we return guard, state set guard. It remains until we get asked again (max every 6) or get hit. If we are in guard and opponent moves behind? face updates each tick while FREE, so guard faces opponent.

Invalid actions: if insufficient ki or blast already out, start returns and fighter keeps doing what it did. If we return blast without ki, a.st.invalid++ but action ignored? In choose, start returns; state remains same, but nextAsk set. If state was FREE and we choose invalid attack, we stay in previous state (e.g. forward). That might be okay but invalid count not matter except stats. But ensure no stuck? If state idle and choose beam no ki, remains idle. Fine.

Cancel: after light hits, a.cancel true. Next step, wants because a.cancel, ask. choose: cancel false; if act light with chain <4 or heavy/blast/beam, start chained; else return? If return other, no action? Actually if cancel and act not accepted, return; state remains light? Wait a.state is light with t continuing? After light hit, still in light recovery. If cancel not used, just continues recovery. Fine. If we choose blast with blastOut? start checks cost and blasts; if invalid, no cancel? It returns; cancel consumed. State remains light recovery. Fine.

CanCancel only after light hit, not block. Chain count: a.chain increments when starting light. If chained light, chain+1, up to chain < R.light.chain (4) in choose. Means can light chain while a.chain <4. Starting first light sets chain=1. After first hit cancel, chain=1, can light if <4 => yes (will become2), after second chain2, can until chain3? After fourth chain4, cannot light. So max 4 lights.

Combo damage scaling based on o.combo (hits taken while not free). free() resets combo. When hit, o.combo++ before damage? land: scale = R.combo[min(o.combo, len-1)] then dmg, then hurt, then o.combo++. Wait code: const scale = R.combo[Math.min(o.combo, R.combo.length - 1)]; dmg; hurt; o.combo++. Initially combo 0 => scale 1. After first hit combo 1. Second scale combo[1]=0.8. Good.

Hitstun durations: light 15, blast 20, heavy down 42, beam down 50, crush 34. Down invulnerable. Knockback moves up to 12/tick until dist. Heavy knockback 150, beam 120.

Projectile hit detection: blasts move 13/tick. They check crossing body: if abs(o.x-b.x) > body and (o.x-b.px)*(o.x-b.x)>0 continue. Means if blast passes over body between previous and current, hit. Body half width 30. So blast can hit if x within 30 or crossed. eta view computed ceil((gap-body)/speed). If incoming.

Beam hit: inRay with body 30. Once hit, b.hit true only hits once. If opponent invulnerable (down/ko/dash invuln), continue; can hit later if still in ray and not invuln. But if dash through, b.dodged event once. Beam remains.

Beam startup can be interrupted: If opponent strike hits during startup, land sets state hitstun/down; then in beams function m.beams side null if state !== beam. But beam not created until t==startup. If hit before startup end, no beam. Cost lost.

Clash triggers only if both beams exist and opposite dirs and fronts cross. If one beam firing and other starts later? If beams opposite and front cross, clash. If one beam already hit opponent, opponent beam maybe canceled. If both fire simultaneously, clash. In clash, both state set clash; beams front fixed. decide called every 6 ticks because state clash and tick >= nextAsk; nextAsk set at clash creation m.tick+1 then choose sets nextAsk+6? Wait when clash created in beams during step after asks. It sets nextAsk=m.tick+1. End step tick++. Next step wants state clash and tick>=nextAsk true, ask. choose sets nextAsk = m.tick + every (6). So every 6. Push flag persists between decisions? choose: if state clash { a.push = act==='push'; return; }. So if we don't get asked (between 6 ticks), push flag remains previous. Initially false. If we choose push, push true for next 6 ticks. If choose not push, false. Need decide push pattern.

Power formula in view uses current power including push flag. We can see myPower oppPower and pos. pos 0 at me, 1 at opponent? Code: pos = clamp(((k.c - me.x)*(i ? -d0 : d0))/abs(opp.x-me.x),0,1). For side0, d0=beam0.dir. If side0 beam direction toward side1, pos = (c-me.x)/dist. 0 near me,1 near opp. For side1, d0 is beam0.dir (opp's? if i=1, -d0) so also 0 near me, 1 opp. Good. Clash t.

Winning clash: push when advantageous. Since power diff affects velocity toward weaker. If pos near me (<0.5?), danger. Need push to move away. Opponent may push. Could model as tug of war. If both push, power diff maybe small but drain high. If one has much more ki, push maybe. If low ki, not push? Let's analyze optimal. Power with ki: 1+0.02ki +0.6 push. With no push, power ~1 to 3. With push +0.6. Ki cost pushing 0.6/tick. In 6 ticks, push costs 3.6 ki plus drain1.2 =4.8. Power advantage .6 can move. Random noise sd .8/tick. Velocity decay .95. Expected velocity change per tick = .1*(power diff). With push diff .6 => .06/tick. Over time, stationary velocity ~ (0.1*diff)/(1-0.95)=2*diff? Actually v = .95 v + Δ; steady v = Δ/.05 =20*Δ. If diff .6 => 12/tick? But noise large. But diff may be. If both push no diff. If opponent not push and I push, diff .6 => expected velocity toward opp +? d*(pa-pb) where d from side0 to side1. If I'm side0 and stronger, v positive moves point away from me toward opp. For side1, power diff sign? formula uses d* (pa-pb), where a=side0. If side1 stronger, pa-pb negative, d positive => v negative toward side1? Wait point c: if v positive moves toward side1 (opponent of side0). For side1, moving toward side1 means pos decreases? Actually pos for side1 0 at side1,1 at side0. If point moves toward side1, c decreases if side1 right? Need not. We just know pos 0 at me, 1 opp; we want pos increase (away from me) or avoid 0. In view, if pos low near me, need push to move away. But my push increases my power, moves point toward weaker (opponent if I stronger). So push helps. If pos high near opp, can relax.

Clash damage 320 huge. Draw 120 both. If HP low, avoid losing. If time left? Clash max 360 ticks (6s). If timeout explosion 120 down both. If I'm winning HP, maybe let timeout? But if point near me, risk. If both not push, random walk. Could intentionally not push to conserve ki, but if opponent pushes, lose. Need maybe push when pos <0.5 or oppPower>myPower? We can decide.

Potential simpler: always push in clash if ki > 10 or pos<0.55? But could drain to 0 and then weak. If both always push, ki drains fast: total 0.8/tick. Starting maybe 50 -> empty in 62 ticks. Then power 0.5 (unless rage). If one stops pushing when low, maybe. Strategy: push if my ki > opp ki? But view gives powers only, not opp ki? We can see opp.ki in state. Yes state.opp.ki. Use ki difference. If my ki much higher, push; if lower, maybe not. But if not push while lower, point moves to me. Could push desperately when pos low. Maybe compute expected power without push and with push. If myPowerNoPush < oppPower and pos <0.6, push if ki >? If myPowerNoPush > oppPower, maybe no push unless pos very low. Since push cost. Opponent may adapt.

Need maybe implement stochastic? Math.random seeded, but deterministic. Could use randomness to be unpredictable. But same match replay same. Against deterministic bots, random can mix. But since Math.random per match seeded, maybe okay. Use random sparingly.

Need consider time budget. Avoid heavy loops. decide called up to 600; each simple.

Could create a rule-based bot with modes:
- If state clash: push logic.
- If canCancel: choose combo: if opp hp <= damage? finish. If ki>=50 and maybe beam? But beam cancel from light: beam startup? Actually cancel into beam starts immediately, but beam has startup 30; opponent in hitstun only 15, so they recover before beam fires? Wait cancel into beam: light hit, next tick start beam. Opponent in hitstun 15, beam startup 30, so they recover and can move/attack/dash before beam fires. Beam can be avoided, unless wall? Cancel into heavy is guaranteed because startup 9 < hitstun remaining. Cancel into blast startup 11? Opponent hitstun 15; blast projectile spawns at startup 11, but projectile needs travel; they may recover before impact unless close. Cancel into beam not guaranteed, likely bad unless predicts guard? Beam firing after 30, opponent can dash/away. But if opponent in corner? Still can move. So cancel should usually heavy or light chain. If opponent hp low maybe light chain enough. If have ki and opponent guarding? But light hit not blocked, so opponent not guard. Heavy gives knockdown and safe. Maybe after 2 lights heavy for damage. If opponent hp <= 40? light. If opp combo? Scaling. Could do light x2 -> heavy. But if heavy might miss if distance pushed? Light pushes 14 each hit; after light, pushApart moves opponent away. Cancel heavy reach 140. After first light, distance increases by 14 (unless wall). Starting distance <=110. After push maybe <=124, heavy reach 140, okay. After second light, distance maybe +14 each, up to 138? Starting maybe 110 -> after two lights 138, heavy reach 140 okay. After third maybe 152 >140 could miss. But knockback? Light pushApart uses push 14. If opponent at wall, attacker pushed back instead, distance same? If wall, distance may not increase? Code pushApart moves o up to room, if room less, attacker moves back, increasing distance? If o at wall, attacker moves away, distance increases by dist? Actually if o cannot move, a.x moves opposite, distance increases by dist-s. So yes distance increases. So after several lights heavy may be out of reach? But light reach 110, chain can continue if within 110. Push may make next light miss if distance >110. Need check. If start at <=110. After first light distance +14 -> up to124. Next light active after cancel immediate startup5; during startup no movement (unless knockback? opponent hitstun no move except push? Already pushed). Distance 124 > light reach110, so second light may miss! Wait combo rules say if cancel, next light can combo? But push 14 might make out of range. How do combos work? Starting distance likely need be <=96 to chain 2 lights. Because reach 110 and push 14 each. If first hit at d<=110, after push d+14; second light reach 110, so need original <=96. In close min gap 60. So possible. Heavy reach 140 after one push okay if original <=126; after two lights if original <=112. So combos depend on initial distance. If opponent at wall and attacker pushed back maybe more. Need consider distance when cancel. If dist > threshold, heavy may miss? For cancel, state.dist at decision after light hit includes push? The hit and push happen in same tick; next tick view has updated dist. So can choose based on dist. If dist <=140 heavy should hit? Heavy startup 9; opponent in hitstun 15, no movement; distance constant. Need dist <=140. If dist >140 heavy miss. Light if dist <=110. If dist >140? Could blast? But blast projectile travel; may not hit before stun ends. Could idle. So cancel logic: if dist<=110 and chain<4 and maybe want more combo, light; else if dist<=140 heavy; else if ki>=20 blast? But blast spawn 40 in front, speed13; if dist maybe 150, eta (dist-40-30?)/13 ~6, opponent recovers in maybe <15? Could hit if hitstun remaining enough. After cancel, hitstun remaining 14? blast startup 11 + travel. Too slow unless very close/wall. Beam not. So if too far, just let recovery.

But maybe light->heavy always if dist <=140. If dist >140, maybe light if <=110, else guard/idle.

Need approach: At neutral, choose spacing. Maybe keep distance around 200-300 to react. Use blasts to force guard, then dash in? Could be complex.

Maybe exploit simple strongest tactic: turtle guard + punish. Guard blocks most, but heavy crush. If opponent uses heavy often, need attack. Could adapt.

Since tournament many AI bots maybe naive. A robust simple bot can win by not making mistakes, landing combos. Need maybe implement defensive reaction to opponent attacks:
- If opp in light/heavy startup and within reach soon? We cannot react after startup? Decisions every 6 ticks, so can choose guard if see opp startup. Light startup5; if we get asked when opp light startup t maybe 0-4, guard before active. But decisions every 6; if we are in free, maybe ask at right time. If we choose guard, block. If opp heavy, guard bad (crush). But if we can back/dash? Heavy startup9; if distance > reach maybe back. If close, maybe light beats heavy if we start before active? Light startup5 vs heavy startup9; if both free and we see opp heavy startup t=0, we can light and beat it? But decide simultaneous; if opp already chose heavy previous tick, state heavy startup. Our light starts now, active at 5, heavy active at maybe 9 - t. We hit first if t+? If opp heavy t=0, our light active tick5, heavy active9, yes interrupt. If opp heavy t=5, active in4, our light active in5, may trade? heavy active earlier. Could guard or back. Need heuristics.
- If opp blast startup: can dash through? Or guard. Blast projectile; guard safe (chip 12 but +2 ki). If we want aggressive, dash forward through blast? Dash invuln 9, blast speed. Need compute eta. But guard simpler.
- If opp beam startup: can interrupt if close (light startup5, beam startup30). If far, maybe guard/block? Beam chip 120 on guard, but still big. Better avoid by dash? Or fire beam to clash? If we have 50 ki and far, beam can clash if both fire? But if opp beam startup, we can start beam; our startup 30, opp maybe earlier; if both fire, maybe clash. If we are close, dash or attack. If opp beam firing and we didn't, need guard? Guard chip 120 and blockstun until beam ends? code: beam blocked: chip 120, stun until beam ends? ctx.stun = Bm.startup+Bm.fire - a.t +6. Could be long. But prevents 280. If not guard, 280 + knockdown. Guard better unless HP low? Could dash through beam? If beam incoming, dash_forward invuln 9 maybe pass through beam? Beam covers from shooter to front, speed30. If far, maybe dash_back to escape. Need handle.

Potential high-level strategy:
- Maintain preferred distance: just outside light reach (~120) to bait attacks. From there, forward step to attack.
- Use light as primary pokes. If hit, combo heavy. Use guard when opponent attacks or projectile. Use heavy when opponent guards or charges or in recovery at close. Use blast at midrange when opp not approaching? Use beam when opp far and we have ki, maybe after knockdown to catch wakeup? Need consider wakeup timing.

Knockdown: opponent down 42/50 ticks, invulnerable. Knockback moves them away. When they get up, immediate decide. We can position. If we knockdown with heavy, we are in recovery 22 after active? Heavy total35, opponent down 42 from hit. We recover before opponent gets up (opponent down longer). Can set up okizeme: approach, maybe light/heavy/beam? They wake and can act immediate. If we are close, can attack as they get up? Timing: Need predict. Since decisions only when free, if we are in free before they wake, can choose action. We know opp state down left. If opp.left (remaining ticks) small. Could start heavy/light so active on wakeup? But if active too early, they are invulnerable; if too late, they can guard/attack. Frame traps possible. But maybe not needed.

Beam after knockdown? Beam startup30, down 42/50, could fire as they wake? If start beam immediately after heavy recovery, opponent down left maybe 20? Beam fires after 30, after they wake; they can avoid. Not good.

Maybe use charge when opponent down far to build ki. If safe, charge. But charge vulnerable x1.5 if they wake. Could charge at far range after knockback.

Need maybe implement mode based on opponent state:
1. Opponent vulnerable/down: if far and we have ki, charge? If close, maybe setup.
2. Opponent in hitstun/blockstun/crushed: punish. If close and we free, light/heavy. If crushed (34), can heavy? Crushed state not invuln, heavy active 9, can hit. Light combo? Use heavy for damage. If blockstun, maybe throw? But if guard? Need.
3. Opponent in startup/recovery: punish if possible. If their move whiffed, attack.
4. Opponent guarding: heavy if close, or charge/build ki, or grab? Heavy crush. But heavy can be interrupted by light if they attack. Use mixups.
5. Opponent charging: attack (light/blast) to punish x1.5.
6. Opponent attacking: defend.

Could implement priority checks each decide.

Need ensure returns only valid strings. Maybe wrap in try/catch to return 'guard'? But exceptions treated idle. We can code safe.

Important: Top-level code executed per match. We can define helper functions inside decide or outside. Avoid using Date.now. Use RULES.

Need maybe use state.timeLeft for endgame: if time left low and hp lead, run away/guard. If hp behind, attack/beam. Draws count half win; maybe if hp equal and time low, avoid risks? Ranking win rate with draws half. If drawing maybe okay but win better. If HP lead, conservative. If behind, aggressive.

Need think about possible opponent behaviors. Since all bots get same rules, many may implement similar heuristics. Need edge. Could exploit common patterns:
- If opponent always guards at close, heavy crush. But if they adapt, heavy risky.
- If opponent always attacks, guard and punish.
- If opponent uses beams, need anti-beam.

Maybe implement adaptive memory within match: track opponent action frequencies from state changes. For example, when opp.state changes to heavy startup, count heavy; to guard count guard; etc. Use to decide mixups. But state available every decide, not every tick; may miss short states? But enough. Top-level variables: lastOppState, counts. Could adjust aggression. But maybe overkill.

Could implement "copycat"? If opponent far, blast; if close, light. But need robust.

Let's consider solving game more analytically. Since decisions discrete every 6 ticks, actions persistent. Could model as simultaneous game with imperfect reaction. But maybe there is a dominant strategy: maintain guard most of time, only attack when guaranteed punish. Guard blocks light/blast/beam, but heavy crush. If opponent never uses heavy, guard dominates. If opponent uses heavy, need punish heavy. Heavy startup 9 active4 recovery22. If we guard and get crushed, 60 + stun34. If instead when we predict heavy, we can back/dash or attack. Heavy reach140. At distance >140, heavy whiffs; can punish recovery. So spacing >140 avoids heavy and light. But light reach110. If stay at 150, both cannot hit. Blast/projectiles. If opponent approaches, maintain distance by back? Back speed3 slower than forward4.5, so can be run down. Need manage wall. Stage boundaries. If we always back, cornered. Need sometimes dash/back? Dash back cost10, 200 distance, recovery8. Can reset space. Maybe use dash_back when cornered or to avoid beam.

Zoning with blast: At distance ~200, blast can force guard. If opponent guards, chip 12 and we gain? They gain +2 ki. We spend 20 ki. Not efficient. But controls space. Beam cost50 can do 120 chip on guard, or 280 hit. If opponent guards beam, chip 120 great (12% HP) but they survive; we spend 50. If they block, we maybe lose ki tempo. If they dash through, risky.

Ki economy: Passive 0.04/tick ~2.4/s. In 60s passive 144 ki, enough several beams. Taking damage gives ki; dealing gives. Blocking gives +2 per block. Charge huge 21.6/s but vulnerable. Need charge when opponent far/down/guard? If opponent sees charge, they may attack. But if far > movement distance, safe.

Maybe optimal: at start, charge? Opponent at 300. If both charge, build ki. If one attacks, they can close: forward 4.5*? From 300 to 110 needs 190/4.5=42 ticks (0.7s), plus decision. If we charge for first ~30 ticks then guard/attack? Could build ki. But if opponent dashes/beam? Starting ki30. Beam startup30, if opponent beam at start, can we react? We may see beam startup and interrupt if close? At 300, cannot reach. Could dash_forward? 200 in10, cost10, still 100 away, can light? But beam fires at 30; dash invuln first9, not enough. Could guard: chip120. Bad. Could start beam too -> clash. If both beam, clash. If one charges, gets hit by beam? Could be. So opening maybe guard or forward? Need handle beam spam. If opponent opens beam, we should maybe also beam if have 50? Start ki30 not enough. Could charge to 50? In 30 ticks charge gains ~10.8 plus passive? Start30 + (0.36*20?) Actually to reach 50 need 20/0.36=55 ticks too slow. Beam startup 30. Cannot. Could dash forward to close and maybe avoid? Beam front speed30, from opp; at distance300. If dash_forward at start, moves 200 over10 to distance100, invuln first9. Beam starts at t=0? startup30, fires t=30; by then dash recovery done? Dash total18, free at t=18. We can then act. At t=30 beam fires, we are at dist100 maybe can start light at t=24? We can interrupt? If opp beam startup, we can light at dist100, active at t? Need if we see opp.state beam startup, at t=18 free, dist maybe100, start light, active 5 ticks => t=23, before beam fire t=30, interrupt. So dash_forward can punish beam opening but costs10 and may be predicted. If opponent heavy? Hmm.

At start, maybe forward to close, guard vs projectile. Many bots may blast. Could forward/back mix.

Maybe create opening script: if dist > 250 and opp ki>=50? Start maybe guard/charge? But state only at t=0 decide. Need choose. Could use Math.random to pick initial plan: forward, guard, charge. But deterministic? okay.

Maybe more robust: start with forward until certain distance, then logic. But decisions every6; we can set plan top-level.

Could implement plan state machine with top-level mode: 'neutral', 'rush', 'zoner', etc. But maybe dynamic enough.

Need account left/right facing and walls. state.wallAhead/wallBehind. If wallBehind small, avoid backing. If wallAhead small and opponent near? heavy push? Use dash through to crossup? Maybe.

Let's enumerate state-based actions.

Inputs:
- me: state, phase, t, left, hp, ki, x, facing, free, invulnerable, blastOut, combo, canCancel, chain.
- opp: state, phase, t, left, hp, ki, x, facing, free, invulnerable, blastOut, combo.
- dist, wallAhead, wallBehind, blasts, beams, clash, t, timeLeft.

Our decide only called when me free/cancel/clash. So me.state is free or clash or light with cancel? Actually canCancel true while me state light recovery? It calls because cancel. me.state likely light. But we can check.

Need maybe compute predicted opponent threat.

Threat detection:
- Incoming blast: state.blasts with incoming true, eta. If eta small, guard or dash. If we can dash through and punish? If eta <=? Dash invuln 9, moves 200. If blast eta <=9, dash_forward maybe invulnerable as blast passes? Need blast direction. If blast incoming and we dash_forward toward owner, we move into blast; invuln first9, blast passes. Could then close. But dash cost10. If eta too large, maybe wait. Guard safe but gives opp +2 ki and chip? blast chip12. If we guard many blasts, hp loss. Could also forward/back to avoid? Since blast speed13, our walk 4.5; cannot dodge without dash. If eta <=2, maybe guard too late? But decisions every6; if we are free now and blast eta <=? choose guard. If already guard held, okay.
- Opp beam startup/firing. If opp.state==='beam' phase startup: if dist <= maybe 200 and we can attack? If close enough to reach within startup remaining. Compute if we can start light/heavy and active before beam fire. We are asked every6; if free now. Light active after 5 ticks. Need light startup < opp.left? opp.left = dur - t? For beam startup, dur=90? left includes startup+fire+recovery? Actually opp.left for state beam is dur-t, not phase-specific. But phase startup and t. Startup remaining = RULES.beam.startup - opp.t. If startupRem > 5 and dist <= light reach + movement? We cannot move during attack. If dist <=110, light can hit. If dist <=140, heavy active9, but light faster. If dist >140, maybe dash_forward then attack? Dash total 10 moving, can't attack during; if startupRem >18 maybe dash close then light. But decide now, choose dash_forward if ki>=10 and dist between 140 and maybe 350? Dash moves 200, then recovery8; after dash free in18. If beam startup remaining >23, can punish after recovery? We won't decide during recovery; free immediate at t+18; if beam still startup, can light. So if startupRem >= 24 and dist -200 <=110 (dist<=310), dash_forward could work. But if dist>310, cannot. Alternative beam if have 50: start beam; if both fire, clash? If opp startup earlier, their beam may hit/clash. If our startup30; if opp startupRem <=30, their beam fires before ours; could hit us before clash? If they fire and we startup, their beam front advances; our beam not created until t=30. If their beam reaches us before our fire, we get hit. Distance matters. Beam front speed30 from opp; time to reach us approx dist/30 after fire. If opp startupRem + dist/30 < 30, we can't beam. If >=30, maybe clash or hit? But if they fire and we startup, they could interrupt us? Actually once their beam firing, we in beam startup, beam ray may hit us, ending our beam. So beam is risky. Better guard? Guard chip120. If HP lead maybe okay. Or dash_back to increase dist. If opp beam firing, if we are free and not in clash: we can guard (hold) to reduce damage; but if beam already covers us soon, guard. Could dash? Dash invuln 9 can avoid beam if timing? If beam front approaching, dash_back moves away 200 in10, invuln9. Beam speed30, maybe outrun? If distance enough. But if close, guard.
- Opp heavy startup: if dist <=? heavy reach140. If we are within reach, need respond. Options: if we can light active before heavy active, light. If not, guard gets crushed. Back/dash. If dist >140, back to make whiff. If dist <=110 and opp.heavy startup t small (<4?), light beats. If t high, maybe dash_back. If ki>=10, dash_back safe? Heavy active maybe; dash invuln first9 can avoid if dash before active. Could dash_forward through? Heavy has reach, but dash invuln; can pass behind and punish recovery? If heavy whiffs, recovery22. Dash_forward cost10, moves200, may end behind; after recovery8 can attack. Could be good. But simpler: if opp heavy startup and dist<140, return light if opp.t <4? else dash_back if ki>=10 else guard? Guard crush bad; maybe back? But back state persists; if active soon, might still be in range. If choose back, move 3/tick; in 4 ticks 12, maybe out if dist near140. If close, no. Could dash_back. If no ki, maybe light trade? If heavy active earlier, we may be hit; but light could trade? Heavy armor? no. If both hit same tick, both take damage; heavy 120 vs light40, bad. Maybe guard if no options; crush 60 less than heavy 120? Crush 60 + stun34, but heavy does 60 if blocked. Better than 120. So guard fallback.
- Opp light startup: if within reach, can guard (blocks) or light trade? Light startup same. If we start later, may lose. Guard safe. If dist >110, back. If opp light recovery, punish if close.
- Opp blast startup: projectile will spawn. Could guard/dash. If close, attack before spawn? startup11; light active5 if dist<=110, can interrupt. If far, guard or beam? We'll handle incoming blast.
- Opp dash: invulnerable, cannot hit until recovery? Dash moving 10, recovery8. If opp dash_forward, they may appear behind. We should maybe guard? Since dash invuln, attacks whiff. After dash, they recovery8, free then can act. We can punish if we are free and anticipate. If they dash through, facing? They face old direction during recovery; we face if free. At their recovery end, they can act. We can attack during their recovery if in range. If we see opp dash phase moving, maybe move away or prepare. If dash_back, they move away; maybe chase.

- Opp down: invulnerable. Use to charge if far, or approach. If opp.left <=? Could set attack timing. Maybe if dist <=110 and opp.left <=5? Starting light now active in5; opponent invulnerable until left ticks. If left <=5? If they get up exactly when active, can hit. But if they guard on wake, light blocked. Heavy crush if they guard, but slower. Could choose heavy if left <=9 and dist<=140 to hit wake-up, crush guard. But if they backdash/attack? Heavy may be punished. Maybe light safer. If we don't want okizeme, charge if far.
- Opp hitstun/blockstun/crushed: punish. If dist <=110, light to combo (if hitstun). If dist <=140 heavy maybe. If blockstun and guard? They may be in blockstun state, not guard; can hit? blockstun is not guard? land checks o.state==='guard' only. If state blockstun, attacks hit (combo scaling). So punish with light/heavy. Crushed: can heavy. Need ensure active before stun ends. Use light if startup < opp.left? For hitstun/blockstun left is remaining. If left >=5, light can hit; if left >=9, heavy. If not, maybe move.
- Opp in recovery of move: punish if close. For light/heavy/blast/beam/dash recovery, they are vulnerable and cannot act. If within reach and we have time, attack. If far, approach.

- Me canCancel: priority as above.

- Free neutral: choose based on distance, ki, opponent state, walls, time, hp.

Need maybe model opponent's next action? Since simultaneous, if we choose a held state, it persists. If we choose guard now, we'll guard until next ask (6 ticks) unless interrupted. This can block attacks happening in interval. If we choose attack, committed. So defensive default should be guard when uncertain? But guard vulnerable to heavy. Could default to 'guard' when opponent close and not sure? If opponent heavy, bad. Could default 'back' to maintain space. Maybe default 'forward' to pressure.

Maybe implement a "threat" score and choose guard if threat of light/blast/beam, heavy if threat of guard/charge, etc.

Potential exploit: Since guard blocks front and auto-faces, only dash through can bypass. Heavy crushes. To beat guard, use heavy. To beat heavy, use light/Back. To beat light, use guard. Rock paper scissors. We can adapt based on observed opponent frequencies. At neutral close, choose action based on what opponent likely does. But we don't know. Could randomize with weights adjusted by opponent state.

Could implement Nash mix near close: light, heavy, guard, maybe back/dash. But deterministic bots may exploit? Random helps. However Math.random seeded; if opponent deterministic, our random per match maybe unpredictable to them? They don't see our random. Good. Use random for mixups.

But need avoid being too random and losing. Use heuristic weights.

Consider distance zones:
- Long (>300): safe from strikes. Options: charge, blast, beam, approach. If opp ki>=50 and we not, maybe guard? Actually beam threat. If we have 50 and opp not guard? Beam can hit if opp not reacting. But opp can guard or beam. Maybe use blast to probe. Charge at long can build ki, but if opp dashes/approaches, vulnerable. Could charge if opp not in forward/attack and dist>350 and time not low. Maybe set ki target 50/100.
- Mid (150-300): light/heavy cannot hit. Blast useful. Forward/back positioning. If opp approaching, maybe back or dash. If opp attack whiff, punish.
- Close (<150): strikes. If <=110 light, <=140 heavy. Need mix.

Maybe we can implement primary tactic: "keep distance just outside 140, poke with blast, dash in for combo when blast hits/blocked?" But blast on guard gives opponent blockstun 14, push? No push for blast block? Code blast block: chip, blockstun, no push. If blocked, defender in blockstun14, attacker recovery18 after projectile? Total blast recovery 18 after startup? If projectile hits/block at some time, attacker may still be recovery. Defender blockstun 14; could punish if close? But attacker far. If blast hits, hitstun20, no knockback. Attacker can perhaps dash/forward to punish if close enough? Blast startup 11 + travel. At dist 200, travel from x+40 to opp body (gap 160?) ~12 ticks, total23. Attacker state recovery from t=11 to 29. Hit at t~23, attacker recovers t=29, defender hitstun ends t=43. Attacker can act at 29 and move/dash to continue. If dist ~200, forward 4.5*14=63, not enough; dash_forward 200 cost10 could close. So blast hit at midrange can lead to dash punish if ki. But if blocked, defender blockstun ends t=37? Attacker recovers29, can act; defender blockstun 14 from hit t23 ends37. Distance same; attacker can dash? Might be punishable if close? Hmm.

Blast can build pressure. But spending ki. Maybe okay.

Beam zoning: At long range, if opponent not guarding? Beam can be blocked for 120 chip; still good damage but cost50. If opponent guards, chip 120; if not, 280. If opponent dashes, maybe dodge. If opponent also beam, clash. Beam startup long; can be interrupted by projectiles? Blast startup11, projectile travel; if far, blast may hit after beam firing? Beam firing cannot be canceled by blast? If beam firing and blast hits shooter, state changes to hitstun, beam ends. So beam is vulnerable to blast from far. If opponent blast, our beam may be interrupted before startup? Blast travel maybe. So beam needs prediction.

Maybe strong strategy: anti-beam with dash_forward and light combos. If many bots use beam, punish. But if they don't, dash can be used.

Let's search mental meta: AI fighting contest likely participants write heuristics. Winner may be robust state machine. Need craft one. Could perhaps implement MCTS? Time budget too small and state simple. But we can precompute? Not necessary.

Need ensure code syntax and no external. Could define constants from RULES if exists; fallback? RULES global. Use const R = typeof RULES !== 'undefined' ? RULES : {...}; but RULES available. Top-level let memory.

Potential approach: behavior tree with many conditions.

Let's design detailed decide logic.

Pseudo:
```
let memory = {
  lastOppState: null, lastOppPhase:null, counts: {}, aggressive:0, guardBias:0, beamCooldown:0, blastCooldown:0, dashCooldown:0, mode:'neutral', plan: ...
};
function decide(state) {
  try { return choose(state); } catch(e) { return 'guard'; }
}
```
But exceptions treated idle; try/catch okay? Not forbidden. Could return guard on exception.

Need maybe avoid using optional chaining? Node likely modern. Use simple.

Time: state.t absolute. We can use cooldowns in ticks. Since decide called not every tick, cooldown approximate. Top-level variables update each call.

Need maybe update opponent action memory: When opp.state changes to a move startup, count. Use lastOppState/phase.
```
if (state.opp.state !== mem.lastOppState || state.opp.phase !== mem.lastOppPhase) { ... }
```
But if we only see every 6 ticks, may miss. Still okay.

What can we infer? opp.state: if 'heavy' phase startup => attempted heavy. If 'light' startup, etc. If 'guard' held count guard. If 'charge'. Could adapt weights: if opp guards a lot, increase heavy; if opp heavies a lot, increase light/back; if opp lights, guard; if charges, attack.

But within one match, sample small. Could simple.

Main decide:
```
if (state.clash) return clashChoice(state);
if (state.me.canCancel) return cancelChoice(state);
// if not free? maybe still called only free, but return held action if not.
// Emergency defense against immediate threats:
const threat = immediateThreat(state);
if (threat) return threat.action;
// Punish opportunities:
const punish = punishChoice(state);
if (punish) return punish;
// Neutral positioning / mode:
return neutralChoice(state);
```

Need avoid returning attack when insufficient ki? It will be ignored, may leave us in previous state; if previous is forward, could be bad. If we choose beam no ki while intending guard, invalid no effect. So check ki before cost actions.

Immediate threats:
- Opp beam firing and not clash? If beams includes opp beam incoming? state.beams. If enemy beam exists. If not my beam? If enemy beam firing. If we are free. We need decide guard/dash/beam? If beam front close. View beams: {mine, from, front, dir}. Need determine if enemy beam is aimed at me and front distance. If beam dir points toward me. We can compute distance from front to me along dir: gap = (me.x - front)*dir? If dir=1 beam travels +x, if I'm to right, gap=me.x-front. If gap small, guard. But if we are in range of beam soon. Since beam covers from from to front, if inRay already? We may be hit this tick? But decision before strikes; if beam front will cover after movement? We can choose guard. If beam startup? separate.
- Incoming blast with eta <=? guard or dash.
- Opp attack startup with active soon.

But if we return guard for every blast, we may be stuck guarding. That's okay if threat persists; decisions every6, can continue guard. If threat passes, neutral.

Emergency for opp heavy startup close: if cannot beat, maybe dash_back/guard.

Punish:
- If opp.free false and not invulnerable: states: light/heavy/blast/beam/dash recovery/moving, hitstun, blockstun, crushed, down? Down invulnerable. recover. clash? not.
- If opp in recovery or stun, choose attack if active before opp.left and dist reach. Need account our decision frequency: If we start move now, active after startup. Need opp.left > startup + maybe? Since opp.left decrements each tick. If opp.left > startup (strict) then active will occur before they become free. But if opp.left exactly startup? At active tick they might become free same tick? Engine order: step asks, moves, strikes, time passes. If opponent state dur ends at end of tick. Suppose opp.left = L at view start. If we start move with startup S, active after S ticks? Move t increments in time pass. If state set t=0 at choose. After this tick t=1. Active when t >= startup. So active at start of step after S ticks? Let's simulate: choose at tick T, state t=0. End tick T t=1. At tick T+S, before time pass, t=S, phase active, strikes happen. Opp left at T was L; each end tick decrements? Opp t++ and if dur ends. At start tick T+L, opp left=0? Actually left = dur - t at view. If dur-t = L. At end of each tick t++. If L = S, then at start T+S, opp.t = original + S, dur reached? It would have become free at end of previous tick T+S-1 if t>=dur. So at start T+S opp would be free and asked maybe, not in stun. Thus need opp.left > S for active to hit before free. For safety opp.left > S+? Also if move active lasts few ticks. So use opp.left > startup.
- For light: if dist <= light.reach and opp.left > 5 (or opp in hitstun with left maybe 15). If opp.left <=5, maybe not.
- Heavy: if dist <= heavy.reach and opp.left >9. Heavy damage bigger, knockdown. But if opp in hitstun and we can light, light starts combo; heavy also combo. Which better? If opp combo count low, heavy damage 120 vs light 40 but light can cancel. If free punish, maybe heavy if left enough and dist <=140, but light faster and safer. If opp in recovery and left small, light. Use light if left <=9 or dist >140; heavy if left>9 and want damage. But if opp guarding? not.
- If opp down with left small: wake-up attack. Maybe if dist<=140 and opp.left between 6 and 12 choose heavy? Need not priority over neutral? Could set.
- If opp state guard and close: heavy crush or grab. But guard can also be beaten by dash behind? Maybe heavy if opp has been guarding. But if opp may light, heavy risky. We'll handle in neutral close.

Neutral choice details:
Inputs: dist, hp diff, timeLeft, ki, opp state (likely free or non-threat), walls.

Could define desiredRange based on mode:
- If hp lead and timeLeft < 600 (10s): keep away, guard. If dist<200, back; else guard/charge? If corner issues.
- If hp behind: aggressive, use beam if ki>=50 and dist>250? Use dash_forward if ki>=10 and dist>200? Attack close.
- Else balanced.

Maybe implement "footsies":
If dist > 320:
  if opp.state==='charge' and ki? maybe dash/forward to punish? Charge vulnerable; if far, forward. If opp.state==='beam' startup handled.
  if me.ki < 50 and opp.ki < 50 and no incoming: charge if dist>380 and wallBehind>100? But if opp approaches, we may get hit. Could charge for short bursts: choose charge if random <0.2 and dist>380, else guard/forward.
  if me.ki >= 50 and opp.ki < 50 and random < beamProb: beam? But beam can be guarded; still chip. Use if opp not in guard? If opp.state not guard and dist>300 and no opp blast? Maybe.
  if me.ki >=20 and !me.blastOut and random < blastProb: blast to control.
  else forward (if hp behind) or guard? If both far, closing needed eventually. Maybe forward with occasional guard/charge.

If dist 180-320:
  if incoming blast: guard/dash.
  if opp.state==='guard' or 'charge': maybe blast? If opp charge, blast hits x1.5; good if ki. If opp guard, chip.
  if me.ki>=20 and random: blast.
  if opp in recovery/stun: forward/dash to punish.
  else if hp lead: back? But back slower; maybe guard.
  else forward.

If dist <=180:
  close mix.
  If opp.state==='guard': maybe heavy if random < heavyGuardBias, or charge? Heavy crush. But if opp tends light, maybe guard. Use memory.
  If opp.state==='charge': light/heavy.
  If opp.state==='forward' or idle: attack.
  If opp.state==='back': chase/attack.
  If our wallBehind small, avoid back; maybe dash_forward through.
  Use light more than heavy because faster. But heavy beats guard. Maybe weights: light 0.45, heavy 0.2, guard 0.2, back 0.1, dash_forward 0.05. Adjust by opponent state and hp.

But need be careful: returning light at dist>110 will whiff and leave recovery; avoid. If dist<=110 can light. If dist<=140 can heavy. If dist 111-140, heavy only. But heavy slower; maybe back/forward to adjust. If dist >140, no strikes.

Maybe use "poke if in range": If dist <=110 and opponent not guard? light. But if opponent guard, heavy. If opponent likely attack, guard. Need simultaneous.

Could implement deterministic priority with some random threshold:
Close (dist<=140):
- If opp.state === 'guard': if me.ki>=10 and random<0.2 dash_forward? crossup? else heavy (if random < 0.7) or light? Heavy crush. But if they guard, heavy guaranteed crush unless they release guard to attack before active. Since decisions 6 ticks, if they chose guard held, they may stay. Heavy good. But if they are about to attack, heavy may lose. Maybe if opp has been guard a lot, heavy.
- If opp.state === 'charge': light (or heavy) to exploit 1.5. Light faster.
- If opp.state in startup of light/heavy/blast: if can counter: if dist<=110 and opp.state!=='heavy' or opp.t<4: light; else guard/back.
- If opp.state in recovery: attack.
- If opp.free (idle/forward/back): mix. If hp lead/time low maybe guard/back; else attack. Use aggression factor.

Need maybe avoid attacking when opponent invulnerable (dash invuln). If opp.invulnerable, do not attack; maybe guard/back. If opp dash moving toward us, maybe dash_back? If dash through, can't hit. Wait until recovery.

Projectile handling more precise:
Incoming blast:
```
const inc = state.blasts.find(b=>b.incoming);
if (inc && inc.eta != null) {
  if (inc.eta <= 1) return 'guard'; // maybe too late but guard
  if (me.ki >= R.dash.cost && inc.eta <= 8 && dist > 160 && wallAhead > 200?) return 'dash_forward'; // phase through and close
  if (inc.eta <= 12) return 'guard';
}
```
Dash_forward through blast: If blast eta <=? Dash invuln first 9 ticks. If blast would hit during invuln, passes. Need ensure after dash not hit. If dash toward blast, relative speed 13+20? Dash moves 20 per tick (200/10). Blast speed13. If distance gap, could pass. If eta small, likely. But if eta >9, blast hits after invuln if still in path? We move toward owner, may pass blast? If dash moves through projectile? During invuln, blast passes; after invuln, if blast still ahead? It may be behind. Probably safe if eta <=9. But dash recovery leaves vulnerable. Use if dist>180 and opp in recovery? Could. Simpler guard.
If we have beam? Could fire beam to swallow blast? If opp blast incoming and we have ki>=50, starting beam may be too slow; blast eta maybe < startup. Not.

Opp blast startup: If dist<=110 and opp.t<6, light can interrupt. Else if incoming soon, guard.

Opp beam startup:
- If dist <=110 and startupRem >5: light to interrupt.
- Else if dist <=140 and startupRem >9: heavy? Light faster. Use light if possible.
- Else if ki>=10 and dist between 150 and 320 and startupRem > 20: dash_forward to close and interrupt. But dash may be hit by beam? Beam not fired yet. Good. If startupRem less, maybe guard or dash_back. If cannot interrupt, guard to chip. But chip120 big. Maybe if have ki>=50 and startupRem >30 + dist/30? beam counter? Too complex.
- If opp beam firing: If clash null and enemy beam exists. If my beam? If I'm free and enemy beam firing, I likely didn't fire. Need guard if beam will hit. But if beam front far, maybe dash_back. Compute time to reach: if beam dir toward me, frontGap = (me.x - front)*dir (positive if front before me). Beam speed30. If frontGap/30 <=? If <=10 and ki>=10, dash_back? Dash back moves away 200 in10, invuln9. Could escape if not already covered. But guard safer. If HP low, guard to avoid 280. Guard chip 120 may still kill if hp<=120; if hp<=120 and beam incoming, maybe dash? If guard death, try dash_back/forward. If dist to shooter close, dash_forward through beam? Might pass behind shooter? If beam from shooter to me, dash_forward toward shooter, invuln9; beam front moves toward me. Could cross during invuln if frontGap small. But after passing, beam may still cover from shooter to front? If we are behind shooter, beam ray from shooter to front in original direction, not behind, safe. Dash_forward can cross beam. Need room behind opponent. Could be good. But if not enough ki, guard.

Maybe simpler: if enemy beam firing and not clash: return 'guard' unless hp<=chip and can dash. But if we guard, blockstun long, opponent recovers maybe. But avoids big damage. If opponent beams often, guard loses 120 each; still may lose. Need anti-beam: start our beam to clash if see startup. But if already firing, too late.

Could implement beam usage to counter opponent beam startup: if opp.state==='beam' && phase==='startup' && me.ki>=50 and dist>200 and startupRem>30? start beam to clash? If both beams fire, clash. If opponent started earlier, their beam may fire before ours; but if distance large, maybe our beam fires before they reach. Need condition: opp startup remaining SRem. Our beam fires after 30. Their beam front reaches us after SRem + timeToReach. timeToReach roughly max(0, (dist - 40?)/30). If SRem + dist/30 > 30 + small, we can fire before hit; clash likely if fronts meet. If not, guard. Could start beam if SRem >= 25? Hmm.

But beam clash mechanics: If both fire, clash triggers when fronts cross. If we start later, our front starts at t=30, theirs already advanced. If it hasn't hit us, fronts cross, clash. So if we can survive until our fire, beam counter leads to clash instead of chip. Clash risky but maybe better than 120 chip. If we have high ki, push. Could use if ki >= 70? But cost50 leaves lower ki in clash. If opp spent50 too. If we don't beam, guard chip120 and gives opp recover. Beam clash may give chance to win 320. But could lose 320. If HP lead, guard. If behind, beam counter.

Need not overcomplicate.

Maybe use simple robust "defend and punish" rather than beams. But if opponent turtles with beam, we need handle.

Let's think about possible dominant simple bot: maybe "if dist>200 and ki>=50 beam else if dist<120 light else forward". To beat it, we can dash in when beam startup, combo. Our bot should do that.

Implement anti-beam dash: If opp beam startup and dist > 150 and ki>=10 and startupRem > 18, dash_forward. After dash, we will be in recovery; if beam startup still, next free can light. Need ensure dist after dash <=110. dashEnd may stop in front at minGap if no room behind. If dist 300, dash forward moves 200, new dist 100. Good. If dist 200, new dist 60 (minGap) or pass? If before=200, after = dist-200? Actually dash toward, x moves 200; new dist = max(60?) If dist 200, dashEnd: before=200, after=(o.x - x)*d = 0? If after < minGap, behind? after <= -minGap? no, after 0, else if o.x+d*minGap within stage and after<0? after=0 not <0? else x=o.x - d*minGap? Hmm. It stops in front at 60. So dist ~60. Good. If dist <200, dash may stop at 60. So dash_forward closes to minGap if dist<=260? If dist=350, after=150 >minGap, lands at dist150? Wait x moves exactly 200, new dist=150. If not passing. So dash_forward reduces dist by 200 until minGap/pass. So after dash, dist = max(60, original-200) unless pass behind (if original <200? Actually if original 150, x would pass beyond opp? before=150, after=-50 < minGap; behind maybe if room, x=opp.x+60 (behind), dist60). So dash from >200 leaves dist original-200; from <=200 leaves 60 or behind. Thus to be within light reach after dash, original dist <=310. Good.

Dash_forward can also cross up if original <=200 and room behind; lands behind dist60. During recovery we face old direction, but opponent free faces; if they were beam startup, can't turn until free; we can punish after recovery? We are in recovery8; they still beam startup maybe. At our free, we face them. Good.

So anti-beam: if opp beam startup remaining > 18 (so after dash18, still startup) and dist <=310 and ki>=10, dash_forward. If dist >310, cannot reach; maybe beam/guard. If startupRem <=18, dash recovery ends after fire begins; bad. Could dash_back to avoid. But if far, guard.

Opp beam startupRem = R.beam.startup - opp.t. But if opp.state beam phase startup. Use left? opp.left total remaining, not startup. Need opp.t. If phase startup. startupRem = R.beam.startup - opp.t. At decision, if opp.t maybe. Need if startupRem > 20? Dash total moving+recovery =18. We can act after 18; need still startup to interrupt with light (active5) before fire? Actually after dash recovery, we decide immediate; if startupRem remaining >5, can light and active before fire. So need startupRem > 23 (18+5) at time of dash. If startupRem > 23. But decisions may not happen exactly? We choose dash now; after 18 ticks free immediate. If opp.t advanced 18. startupRem' = startupRem-18. Need >5 for light active before fire. So >23. If startupRem between 18 and23, we may dash but they fire before our light; maybe can still hit? Beam firing can be interrupted by light? If shooter in firing, light hit cancels beam (state changes). Yes if we can hit during firing before beam hits us. After dash, if beam just fired, maybe light active after5; if beam front hasn't reached, could interrupt. But risky. Condition >18 maybe okay. If dist after dash close, light active5; beam front speed30; from shooter to me distance60; front starts at 40? It may cover us almost immediately at fire? Beam creation front +40 then speed30; if dist60, at fire front maybe 70 after tick, covers us, hit same tick? If we are in recovery, no. So need interrupt before fire. Thus >23. But beam startup 30; at opp.t=0, startupRem30, dash works. If opp.t=6, rem24, works barely. If opp.t>=7, maybe not. Could instead guard.

If we see opp beam startup early (state at decide). Since decisions every6, likely opp.t small if we are free. Use dash if rem > 22 and dist<=310 and ki>=10.

What if opp beam startup and we are already close dist<=110: light immediately if rem>5. If rem<=5, maybe guard? Beam fires soon; light may not. Guard chip. Or dash_back? If close, dash_back may avoid? Beam front starts 40 from shooter; if dist<=110, after fire covers quickly. Dash_back invuln9 moves away 200; may avoid beam entirely if not hit first. If rem small, dash_back could dodge startup? Beam not fired yet; dash invuln doesn't matter. If we dash_back, distance increases 200; beam fires after rem, front travels; may still reach but we are farther. Could be safe. If ki>=10 and rem<=5, dash_back. But if no ki guard.

Opp beam firing: If enemy beam exists and not clash. If we are free. Options:
- If we have ki>=50 and can start beam? Too late? If beam firing, our beam startup30; likely get hit. No.
- If dist to shooter <=110 and they are firing (vulnerable? Can be hit), light can cancel beam. But if beam already covers us, we may be hit first. If we are free and not yet hit, maybe beam front not reached. If dist close, light active5; beam front may reach sooner. Need compute. If shooter state beam firing, beam front position in state.beams. If front not past us. If dist <=110, we can light; but if beam front eta <5, guard/dash. Compute beamEta: if beam dir toward me, gap = (me.x - front)*dir - body? If gap positive. eta = ceil(gap/30). If eta <=4, cannot light. Guard/dash. If eta >5, light may interrupt. But if we choose light, we may be hit during startup if eta <=5. So need eta >5. Heavy slower. Use light.
- If cannot interrupt, guard. If hp <= chip (120) and ki>=10, dash maybe. Dash_back if beam coming from front; dash_forward through if close? If beam front eta <=9 and dist maybe, dash_forward invuln can pass? But if beam covers from shooter to front, moving toward shooter, might get behind. If eta small, dash_forward could dodge. Need choose if hp<=120? Maybe always if ki>=10 and eta <=8 and dist <200? Could. But complexity. Guard fallback.

Opp beam startup also if we have blast? Could blast interrupt? Blast startup11 + travel; slower than light. Not if close.

Opp dash:
- opp.state==='dash' phase moving. They are invulnerable. If moving toward us (distance decreasing?), we can't hit. Could guard to block follow-up? Dash recovery after 10; if they dash_forward through, they may end behind. We should maybe turn? Auto. If we are free, can choose attack timed to their recovery. If opp.left (remaining state) maybe total dur-t. Dash total 18. If phase moving, left >8. If we start heavy active9, could hit as recovery begins? They are vulnerable during recovery. If dist after dash unknown. Could be risky. Maybe keep guard. If they dash_back, pursue forward.
- opp dash recovery: vulnerable, punish if close.

Opp recovery from beam/recover: punish.

Now, combo/cancel choice in detail:
```
function cancelChoice(s) {
  const d=s.dist;
  const opp=s.opp;
  // opponent in hitstun from light, combo count opp.combo? After first hit opp.combo=1.
  // Need finish if hp low: if opp.hp <= lightDmg*scale? But damage scaling. Use light if can kill? 
  // If dist<=110 and chain<4 and (opp.hp > heavyDamage? maybe continue) but ensure range.
  // If dist<=140 heavy likely best after 1-2 lights. But if opp.hp <= estimated light damage, light.
  // If dist>140 and ki>=20 blast maybe if close? else idle/guard.
}
```
Damage estimates with scaling: opp.combo is count after last hit? In state at cancel after light, opp.combo maybe 1 (for first hit). Next hit scale = combo[opp.combo] (index 1=0.8). Light damage next = 40*scale. Heavy=120*scale. If opp.hp <= next light dmg and dist<=110, light. Else if dist<=140 heavy. But heavy may not kill if scaled; still big. If dist<=110 and chain<4 and opp.hp >? Should we continue lights? Heavy gives more damage and knockdown; but lights can lead to more total if chain. However after each light push may make range. If dist<=96 maybe can chain another light; if >96 heavy. Use threshold: if d <= 100 and chain < 3 maybe light, else heavy if d<=140. But if opp hp low, light. Need consider wall: if opp at wall, attacker pushed, distance may increase more? Actually if opponent at wall behind, pushApart pushes attacker back, distance increases by 14 too. Same. So threshold.

If d <= 90 and chain<4 and opp.hp > estimated heavy? maybe light to extend combo. But heavy damage much larger; after 2 lights heavy total maybe better than another light? Let's compute if starting after first light: option heavy now: 96 (if scale0.8) total. Option light then heavy: second light 32, then heavy scale0.65=78, total110 (plus maybe). But risk range. If d <=90, do light; else heavy. After chain=2, if d<=80 light; else heavy. Simpler: if chain <=2 and d <= 95, light; else heavy if d<=140. But if opp.hp <= light kill, light. If d>140, maybe blast if ki>=20 and !blastOut? But blast might not hit; if opp hitstun left? After light hitstun 15, cancel next tick; blast startup 11, projectile travel. If d maybe 150, spawn at me+40, distance to opp 110-30? eta ~6, total17, hitstun remaining14? Might not. If d <=120, blast may hit? But if d<=110, heavy/light better. If d>140, maybe idle/guard. Return 'idle' to allow recovery.

Could cancel into beam if opp.hp <= beam scaled? But beam startup long, not guaranteed. Not.

What about cancel into blast to catch opponent who expects heavy? Not needed.

Punish choice:
```
function punishChoice(s) {
  const o=s.opp, d=s.dist;
  if (o.invulnerable) return null;
  const canHitLight = d <= R.light.reach;
  const canHitHeavy = d <= R.heavy.reach;
  // If opponent in hitstun/blockstun/crushed/recovery/startup? 
  const punishable = ['hitstun','blockstun','crushed','recover'].includes(o.state) || (MOVES includes o.state && o.phase==='recovery');
  // Also startup of slow moves if we can interrupt.
  if (punishable) {
    const left = o.left;
    if (canHitHeavy && left > R.heavy.startup && (o.state==='crushed' || o.state==='down'? no down invuln)) return 'heavy'; // but heavy may be slower; if left>9.
    if (canHitLight && left > R.light.startup) return 'light';
    if (canHitHeavy && left > R.heavy.startup) return 'heavy';
  }
  // startup interrupt: if opp in startup of blast/beam/heavy/light and leftToActive enough.
  if (o.phase==='startup') {
    const rem = startupRemaining(o);
    if (canHitLight && rem > R.light.startup) return 'light';
    if (canHitHeavy && rem > R.heavy.startup && o.state!=='light') return 'heavy';
  }
  // down wakeup: if o.state==='down' and left between? maybe attack.
}
```
But if opp in recovery and left maybe small, light may not connect before free but can still hit after free if they don't move? If they become free, they may choose guard/attack. Not guaranteed. Use left > startup.

For down: o.invulnerable true, so not punishable. But wake-up: if o.state==='down' and o.left >? We can start heavy so active just after invuln ends. Need o.left <= startup? If left <= startup+active window. Since down invulnerable until left=0. If we start heavy with startup9, active at t+9. Need active when opponent becomes vulnerable. If o.left around 8-12 maybe. But if they wake and guard, heavy crush. Could be good. But if they wake and light, heavy may lose. Maybe use light if left<=5? Light active5, if left 4-6 can hit wake. But if they guard, light blocked. Heavy crush guard. Use heavy if dist<=140 and o.left between 6 and 12 and random? Could be okay. But not essential.

Immediate threat handling should override punish? If opponent in startup but threat, punish may counter. Need order: if immediate defensive (incoming blast/beam) maybe guard/dash; but if opp startup close, punish can interrupt. We can integrate.

Maybe implement `defense(s)` first for projectiles and beam, then `interrupt(s)` for opp attacks.

Let's design `startupRemaining` for opp:
```
function startupRem(o) {
 if (o.phase !== 'startup') return Infinity;
 switch(o.state){ case 'light': return R.light.startup - o.t; ... beam: R.beam.startup - o.t; blast: R.blast.startup - o.t; heavy: R.heavy.startup - o.t; dash? dash phase moving not startup; }
}
```

Threat from opp attacks:
- If o.state==='heavy' and phase startup and dist <= heavy.reach + maybe walk? Opp cannot move during startup. If rem <=? We need action. If we can light before active: if dist<=light.reach and rem > light.startup, return light. Else if ki dash_back? If rem <=4, maybe guard (crush less) or dash. If dist > heavy.reach, maybe back to extend. If dist <=heavy.reach and cannot counter, guard fallback.
- If o.state==='light' startup and dist<=light.reach: guard (blocks). If we can light and rem >5? But simultaneous maybe trade; guard safer. If dist>light.reach, maybe forward? no.
- If o.state==='blast' startup: if dist<=light.reach and rem>5, light interrupt; else prepare guard for incoming.
- If o.state==='beam' startup: as above.
- If o.state==='dash' moving toward: maybe guard or back. If opp dash invuln, no attack. If wallBehind small? Could dash_forward? Not.

Need know if opp dash moving toward us. Dash direction? opp.facing and state dash. But dash direction may be forward/back? state doesn't tell dash_forward vs dash_back, only 'dash'. phase moving. opp.facing during dash? Facing maybe direction before dash? dash dir in engine but not in view. We can infer from opp.x changes over time? Could track lastOppX. Top-level memory. If opp.state dash and x moved toward/away. But maybe not needed. If dash, they invuln; just guard. If they dash_forward, they close; guard may block follow-up. If they dash_back, guard wastes. But okay.

Incoming blasts handling maybe before attack threats. If blast eta very small, guard. If we are in punish opportunity but blast about to hit, guard.

Beams handling: If enemy beam firing, guard/interrupt.

Could implement `projectileDefense(s)`:
```
const incBlast = s.blasts.find(b=>b.incoming && b.eta != null);
if (incBlast) {
  if (incBlast.eta <= 10) {
    // if can dash through and punish maybe
    if (me.ki>=10 && incBlast.eta <= 8 && s.dist > 170 && s.wallAhead > 220 && Math.random()<0.3) return 'dash_forward';
    return 'guard';
  }
}
```
But if eta 10 and we return guard, state guard for 6 ticks; if eta after 6 still? Next ask maybe guard again. Good.

Beam defense:
```
const enemyBeam = s.beams.find(b=>!b.mine);
if (enemyBeam) {
  // compute if aimed at me
  const dir=enemyBeam.dir;
  const gap=(s.me.x - enemyBeam.front)*dir;
  if (gap > -R.body) { // front before me or covering
    const eta = gap <= 0 ? 0 : Math.ceil((gap - R.body)/R.beam.speed);
    if (s.opp.state==='beam' && s.opp.phase==='firing') {
      if (s.dist <= R.light.reach && eta > R.light.startup) return 'light'; // interrupt
      if (eta <= 8 && s.me.ki >= R.dash.cost && s.hp <= R.beam.chip? maybe) dash? 
      return 'guard';
    }
  }
}
```
But if enemyBeam exists and opp.state not beam? Could be leftover? Beams array only firing. If opp got hit, removed. So okay.

If opp beam startup, handle in attack threats.

Neutral close mix should consider opponent's current state. If opp.free and not threat, choose.

Let's define memory adaptation:
Top-level:
```
let mem = {
  lastOppState: '', lastOppPhase:'', oppActs: {light:0, heavy:0, blast:0, beam:0, guard:0, charge:0, dash:0}, lastX: null, lastT: -1, plan: Math.random()<0.5?'rush':'zoner', beamCooldown:0, blastCooldown:0, dashCooldown:0, chargeTicks:0, lastHpLead:0
};
```
Update each decide:
- dt = state.t - mem.lastT (if lastT>=0). But decide not every tick; use for cooldown decrement? Could just use absolute ticks for cooldowns: `if (state.t > mem.nextBeam) ...` set nextBeam = state.t + 180.
- Observe opp state changes: if state/phase startup for moves, increment counts. If state guard/charge, increment maybe by dt? Simpler count transitions.
- Compute frequencies for close mix.

But memory across calls within same match. Could use random with seed. Need not too complex.

Potential issue: top-level Math.random used; if multiple decide calls, random values deterministic. If we use random too much, maybe time okay.

Could implement weighted choice function:
```
function weighted(pairs) { // pairs [action, weight]
  let total=0; for(...) total += w; if(total<=0) return null;
  let r=Math.random()*total; for... if(r< w) return action; else r-=w;
}
```
Use only when close.

But random may cause poor decisions (e.g., heavy whiff). Could limit.

Maybe deterministic priority better for reliability. But mix needed to avoid predictability. Could use pseudo-random based on state.t and hidden variable? Math.random fine.

Let's think about possible exploit of guard: If we guard too much, opponent heavy crush. Need anti-heavy. If opponent uses heavy, memory heavy count high; when close and opp free, choose light/back more. If opponent guard high, choose heavy. If opponent light high, choose guard. This adapts.

Compute opponent tendency from counts:
```
const total = sum; const pGuard = counts.guard/total, pHeavy=..., pLight=..., pCharge=...
```
But counts may small. Use Laplace.

Close decision weights if both free and no clear state:
- Base: light 50, heavy 20, guard 20, back 10, dash_forward 5, charge 0.
- If dist > light.reach but <=heavy.reach: light weight 0 (can't hit), heavy 30, guard 25, back 20, forward 15? Actually if dist 111-140, heavy can hit; light whiffs. Could forward to get into light range but might be hit. Heavy okay. Guard.
- If dist <= light.reach: light high.
- Adjust by tendencies: if opp heavy tendency high, increase guard/back/light? Light beats heavy if start before; but if simultaneous and opp chooses heavy, our light may win if both start same tick? If both free and choose same decide, light active5 vs heavy9, light wins. So light good vs heavy. Guard bad vs heavy. If opp light tendency high, guard high, heavy? Heavy loses to light if simultaneous? Light active first. Guard good vs light. If opp guard high, heavy high. If opp charge high, light/heavy high. If opp blast high, guard/dash? At close blast startup can be light interrupted.
- If hp lead/time low, increase guard/back, decrease attacks.
- If opp hp low, increase attacks.
- If my ki high, maybe beam? At close beam startup too slow, but cancel? Not.

Could also use heavy if opponent in blockstun? Already punish.

Maybe use "safe jump"? Not.

Ki actions:
- Charge when safe: opponent down and far, or far and opponent not approaching/attacking. Could build to 100. Need not overdo. Condition: dist > 350, opp.free or opp.state==='down', no incoming, wallBehind > 100, and (me.ki < 60 or time to charge). Choose charge for a few decisions. But if opponent dashes, vulnerable. Could charge only if opponent also far and not moving forward? If opp.state==='forward', they approach; don't charge. If opp.state==='guard' maybe safe? They could attack. Maybe if opponent down left >30 and dist>250, charge. Also if timeLeft > 3000 and hp lead? Hmm.
- Use beam: when dist > 300, opp not able to interrupt (not close, not startup attack), me.ki >= 50, cooldown. But if opp guards, chip. Use if opp.hp > chip? If opp hp <=120, beam can kill through guard? If opp guards, chip120 exactly maybe KO. If opp not guard, 280. Good. If opp has ki>=50 maybe beam clash. Avoid if opp likely beam? Could use when opp in recovery/down? If opp down and far, beam startup may finish after wake? Not good. Use when opp is guarding at long range? Beam chip. But if they guard, they gain +2 ki? Block beam gives +2, okay. Use occasionally.
- Use blast: when dist 180-400, opp not incoming, me.ki>=20, cooldown. Could be used to punish opponent charge/guard. If opp.state==='charge' and dist maybe >110, blast hits x1.5 =105 if not blocked; good. If opp guard, chip12. Use. But don't spam if ki low. Maybe if ki > 55 or opp charge.

Dash usage:
- dash_forward to close when opponent in recovery/stun far, or anti-beam, or to dodge blast, or when hp behind and dist >200 with ki>30.
- dash_back to escape when cornered, when opponent beam startup imminent, or after knockback? Use if wallBehind <100 and opp close aggressive, ki>=10. Cooldown.

Need manage ki: Don't spend all ki on dashes/beams if need clash. Maybe keep reserve. If me.ki < 20, avoid blast/dash unless emergency. If me.ki >=70, can beam.

Time management: If timeLeft low:
- If me.hp > opp.hp: avoid engagement. Keep distance, guard, run back if wallBehind enough, dash_back if needed. If cornered, maybe attack to survive. If dist<150 and hp lead small, guard? But heavy crush. Maybe back. If timeLeft < 300 (5s), just guard/back. If hp equal? draw half; maybe guard. If hp behind: aggressive, use beam if can, attacks.

Stage walls: If wallBehind < 100, avoid back; maybe dash_forward through or guard. If wallAhead? Not crucial. If opponent near wall, pressure. If opponent wallBehind small, attacks push them? Light push if wall pushes attacker back, not helpful. Heavy knockback maybe. Use beam? Not.

Need verify action strings exactly. 'dash_forward', 'dash_back', etc.

Potential code structure:
```
const R = RULES;
const LIGHT=R.light, HEAVY=R.heavy, BLAST=R.blast, BEAM=R.beam, DASH=R.dash, CLASH=R.clash;
let mem = {...};
function decide(state) { try { return main(state); } catch(e){ return 'guard'; } }
function main(state) { updateMemory(state); if (state.clash) return clash(state); if (state.me.canCancel) return cancel(state); // if not free? maybe choose based on state? 
  const emergency = defense(state); if (emergency) return emergency;
  const punish = punish(state); if (punish) return punish;
  return neutral(state);
}
```
But if me.state not free? decide may not be called except cancel/clash. But if called during light cancel, me.state light. If defense returns guard while canCancel false? Not.

Need update memory with state even if canCancel; but maybe quick.

Clash logic:
```
function clash(state) {
 const c=state.clash; const me=state.me, opp=state.opp;
 // c.pos 0 at me, 1 opp. myPower, oppPower current with previous push flag.
 // We can decide push or not. Need set push for next 6 ticks.
 const hpFrac=me.hp/R.hp;
 const oppHpFrac=opp.hp/R.hp;
 // Estimate no-push powers: myPower current includes push flag from previous? We don't know if push flag. But view power includes current push. We can compute base no push from ki: (ki>0?1+0.02ki:0.5)+rage.
 const myNo = powerNoPush(me), oppNo = powerNoPush(opp);
 const myPush = myNo + (me.ki>0?0.6:0);
 const oppPush = oppNo + (opp.ki>0?0.6:0);
 // If pos near me (<0.45), need push unless hopeless.
 // If myPush > oppNo? push can gain advantage. If opp likely push? We don't know. Could push if ki advantage.
 if (me.ki <= 1 && c.pos < 0.25) return 'push'? But if ki=0, push gives no power and costs none? If ki=0, f.push && f.ki>0 cost false; power empty; pushing doesn't add. Actually if ki=0, choosing push sets push true but power formula uses ki>0 false, no pushPower; no extra cost. So push harmless but no benefit. If ki=0, no push power. Return idle.
 // Strategy: push if (c.pos < 0.5 and myNo >= oppNo -0.3) or (myNo > oppNo +0.2) or (me.ki > opp.ki + 15) or c.pos <0.3.
 // Avoid pushing if pos >0.7 and my ki low or oppNo much high? Could conserve.
 // If time left small and hp lead? Maybe push to finish? If pos near opp, no push.
}
```
Need know opp.ki. state.opp.ki. Good.

Optimal clash maybe: push when our power with push exceeds opponent's expected power without push, and point not too far. But opponent may push. Could use ki advantage. If both have similar ki, pushing drains; maybe alternate? Since decide every6, can push in bursts. If we push every call, ki drains fast. If opponent doesn't, we win. If opponent pushes too, drain. Could condition on pos: if pos <0.4 push; if pos >0.6 don't; else push if ki > opp.ki. This conservative. If pos near me, must push. If pos near opp, relax. If random noise can move. If timeout, draw 120. If HP lead, maybe let timeout if pos mid? But if pos mid and both not push, random may hit either. If hp lead and timeLeft small, maybe push if pos<0.5 to avoid losing 320; else not.

Let's simulate power: If my ki 50, opp 50, no push both2.0. If I push, power2.6. Difference0.6, expected point moves toward opp. Cost 0.6/tick. In 6 ticks cost3.6 ki, my power drops .072, small. If keep pushing, ki drains. If opp doesn't push, point moves. Good. If opp also pushes, powers equal+0.6, no diff but both drain. Then eventually someone runs out. If equal ki and both push, symmetric; random decides. If one stops, other gains diff. So maybe push when pos low, stop when high. This controls. Use threshold: if pos <0.45 push; else if pos >0.65 don't; else push if myKi > oppKi + 5 or myNo > oppNo +0.1. If pos <0.25 push regardless if ki>0. If ki<5 and pos<0.5 maybe push? If low ki, pushing drains to 0 quickly and loses pushPower; but if not push likely lose. Could push desperate if pos<0.35.

Could use `state.clash.t` to know timeout. If t >300 and hp lead? If timeout draw 120. If my hp >120 and opp hp <=120? Could push? If timeout both 120, maybe kill opp if opp hp<=120 and my hp>120 -> win? But explosion deals 120 to both; if opp hp<=120 and my hp>120, I win. If both >120, draw? Actually explosion hurt both 120, maybe if one dies. If hp lead and opp low, could let timeout. But point may reach before. If t>300 and pos not near me, maybe don't push to force explosion. If opp hp<=120 and my hp>120, not push. If my hp<=120, need avoid explosion? Push? Complex.

Simpler clash: thresholds as above.

Need compute no-push power:
```
function basePower(f, hpMax) { const rage = f.hp < 0.3*hpMax ? 0.4 : 0; return (f.ki > 0 ? 1 + 0.02*f.ki : 0.5) + rage; }
```
But state.opp.ki can be 0. Good.

Neutral choice more detailed.

Let's write helper functions:
- `inLightRange(s)` dist <= LIGHT.reach + maybe 1? Use 110.
- `inHeavyRange` dist <=140.
- `canAct(s)` maybe me.free true.
- `oppStartupRem(s)`.
- `enemyBeam(s)`.

Memory update:
```
function update(s) {
  if (mem.lastT < 0) { mem.lastT = s.t; mem.lastOppX = s.opp.x; return; }
  const dt = s.t - mem.lastT;
  mem.lastT = s.t;
  // decrement cooldowns? Use absolute.
  const o=s.opp;
  const key = o.state + (o.phase||'');
  if (key !== mem.lastOppKey) {
    if (o.phase==='startup') mem.acts[o.state] = (mem.acts[o.state]||0)+1;
    if (o.state==='guard') mem.acts.guard++;
    if (o.state==='charge') mem.acts.charge++;
    if (o.state==='dash') mem.acts.dash++;
    mem.lastOppKey = key;
  }
  // track opp movement direction for dash? optional.
  mem.lastOppX = o.x;
}
```
Counts maybe biased by duration; guard counted once per entry. Fine.

Tendency function with smoothing:
```
function tend(name){ return (mem.acts[name]||0) + 1; }
```
Could use ratios.

Neutral close weighted:
```
function closeChoice(s) {
  const d=s.dist, me=s.me, o=s.opp;
  const hpDiff = me.hp - o.hp;
  const timePressure = s.timeLeft < 600 && hpDiff > 0;
  // If opponent is in guard, heavy.
  if (o.state==='guard') {
    // if they have been guard a lot or random, heavy; but if hp lead/time, maybe back.
    if (d <= HEAVY.reach && me.ki? no cost) {
      if (Math.random() < 0.75) return 'heavy';
      return Math.random()<0.5?'light':'back';
    }
  }
  if (o.state==='charge') {
    if (d <= LIGHT.reach) return 'light';
    if (d <= HEAVY.reach) return 'heavy';
  }
  // if opponent free/idle/forward/back/guard? guard handled.
  // Weights
  let w = [];
  if (d <= LIGHT.reach) w.push(['light', 55]); else w.push(['light',0]);
  if (d <= HEAVY.reach) w.push(['heavy', 20]); else w.push(['heavy',0]);
  w.push(['guard', 20]);
  if (s.wallBehind > 80) w.push(['back', 12]); else w.push(['back',0]);
  w.push(['forward', d > LIGHT.reach ? 15 : 5]); // if out of light range, step in
  if (me.ki >= DASH.cost && d > 120 && s.wallAhead > 220) w.push(['dash_forward', 4]);
  // Adjust by tendencies
  const total = sum mem.acts;
  const pGuard = ((mem.acts.guard||0)+1)/(total+6); etc.
  if (pGuard > .3) increase heavy; if pHeavy > .25 increase light/back, decrease guard? Actually guard bad vs heavy, light good. if pLight > .3 increase guard/heavy? Heavy loses to light, guard good. if pCharge > .2 increase attacks. if pBlast >? guard.
  // hp/time adjustments
  if (timePressure) increase guard/back, decrease attacks.
  if (hpDiff < -200) increase attacks, beam? maybe.
  return weighted(w);
}
```
But if d<=LIGHT.reach and o.state==='guard', heavy may crush. If we choose light, blocked. Good to heavy. But if opponent guard only briefly, heavy may be punished. Use probability.

If d between 111 and 140: light whiffs. Heavy can hit. But if opp likely light, heavy may lose. Could guard or back. Weights: heavy 20, guard25, forward10 (to close? forward reduces dist into light but also into heavy), back15. Maybe.

If d >140 but <=180: no strikes. Need footsies. Could choose forward if want close, back if space, guard, blast. Use midChoice.

MidChoice (140-320):
- If incoming blast, defense handled.
- If opp.state==='guard' or 'charge', blast if ki and cooldown? If charge, blast good. If guard, chip. But blast startup can be interrupted if opp attacks? They are in guard/charge, safe.
- If me.ki >= 20 and !me.blastOut and (opp.state==='charge' || Math.random()<0.2) return blast.
- If hp behind and ki>=10 and dist>220, dash_forward to close.
- If hp lead/time, back/guard.
- Else forward if dist > desired, back if too close? Desired maybe 160 if aggressive, 240 if defensive.
Could implement desired distance:
```
let desired = 160;
if (hpLead && timeLeft<900) desired=320;
else if (hpBehind) desired=120;
else if (me.ki<30) desired=240; // build? 
if (d > desired + 30) return 'forward';
if (d < desired - 30) return 'back' (if room) else guard;
return Math.random()<0.3?'guard':'idle';
```
But if desired 160, within 140-190, may idle/guard. Need attack when in range.

LongChoice (>320):
- If opp.state==='beam' startup handled.
- If opp.state==='charge' and d<500? forward to punish? Or blast. If charge, they vulnerable; forward/dash. If we have ki, blast can hit if they keep charge; but they may guard. Use blast if ki>=20.
- If me.ki < 50 and safe, charge. Condition: no incoming, opp.state not 'forward' or 'dash', dist>380, wallBehind>150, timeLeft>600. Return 'charge' with probability or for short. But if we choose charge, held until next ask 6 ticks; okay. Could charge multiple decisions. Need stop if opp approaches. Since if opp.state forward, not charge.
- If me.ki >= 55 and opp.state!=='guard'? Beam? Maybe if opp not in startup attack. Use beam if random<0.25 and cooldown. But if opponent is also likely beam, could clash. If my ki much > opp? Use. If opp hp <=120, beam can kill through guard; high priority. If opp.hp <= BEAM.chip and s.timeLeft<1200? return beam if ki>=50.
- Use blast occasionally if ki>40.
- Else forward (if need close) or guard.

Need ensure not charging into beam. If opp.ki>=50 and far, maybe don't charge; guard. If opp.state==='beam' startup, defense.

Maybe use plan variable to vary: at match start choose aggressive or zoner. But same rules; could randomize initial. However if plan leads to poor vs certain opponents? Adaptive within match maybe enough.

Could implement opening:
- At t=0, state dist=300, ki30. What to do? If choose forward, close. If guard, safe. If charge, risky. Maybe random: 50% forward, 30% guard, 20% charge? But if opponent beam, forward/dash can punish? At t=0 we don't know. Could choose 'forward' to apply pressure. Many bots may blast; forward might get hit? Blast startup11, if we forward from 300, after 6 ticks distance 273; opp blast projectile spawns, travel. We can guard when see incoming. Maybe okay. If opponent beam, we see startup and dash? We need be free; if we chose forward, next ask at t=6, see beam startup t=6, rem24, dist maybe273, dash_forward anti-beam works? rem24 >23, dist<=310, ki30>=10, yes. Good. If we chose guard, still free? Guard held, asked at t=6, can dash. If chose charge, vulnerable x1.5 but can still? Maybe not. So forward/guard okay.

Maybe initial action: if Math.random()<0.7 'forward' else 'guard'. But if we return forward, we will keep forwarding every 6 ticks unless logic changes. Good.

Need handle if we are in held state and decide returns same. If we choose 'forward' at neutral but threat appears before next ask (within 6 ticks), we can't react. That's inherent. Guard is safer default because blocks during interval. But guard vs heavy. Maybe choose guard when expecting attacks, forward when safe. If we default forward, may walk into heavy. But heavy startup 9; if we are asked every6, might see heavy startup after 6 and react. If opponent chose heavy at t=0, at t=6 we are at dist maybe273? heavy whiff? Heavy reach140, no. If close, risk.

At close, default maybe guard more.

Could implement "if opponent has not acted and dist closing, guard"? Hmm.

Let's examine engine timing for reacting to startup. Suppose both at dist100, both free at tick T. Opp chooses heavy. We choose maybe forward. At tick T+6 next ask, opp heavy t=6, active in3, dist maybe if forward 27? We moved closer. We can react: if dist<=110, light active in5, too late (heavy active in3). Guard would be crushed. Dash_back? invuln first9, if choose dash_back at T+6, heavy active at T+9? Dash moving, invuln ticks T+6 to T+14? Actually start dash at T+6, invuln t<9 i.e. ticks 0-8 relative, covers active. So dash_back avoids heavy. Need ki. If no ki, maybe guard. So at close, if opp heavy startup t>=? dash_back good. We should implement emergency heavy: if rem <=4 and ki>=10, dash_back. If no ki, guard.

If opp light startup at T+6, light active maybe t=6? Light total startup5, so at t=6 already active? phase active. We may already have been hit? If not, too late. But decisions every6; if we were free at T and opp light, we would see at T? Simultaneous. If we chose guard at T, block. If not, may be hit. So close default guard helps.

Thus at close, guard should be common to block unseen lights. Heavy beats guard, but if opponent heavy, guard bad. Adapt.

Could we exploit by always guard and heavy mix? Maybe.

Let's design defensive reactions more precisely.

`defense(s)` order:
1. If enemy beam firing and immediate: maybe guard/interrupt.
2. If incoming blast eta <= 10: guard/dash.
3. If opp beam startup: anti-beam (dash_forward/light/guard).
4. If opp heavy startup close: counter/dash/guard.
5. If opp light startup close: guard.
6. If opp blast startup close: light interrupt or guard.

But punish function may also choose light vs startup. We can combine.

Implement `handleOppAttack(s)`:
```
const o=s.opp;
if (o.phase==='startup') {
  const rem = startupRem(o);
  if (o.state==='beam') { ... }
  if (o.state==='heavy') {
    if (s.dist <= HEAVY.reach) {
      if (s.dist <= LIGHT.reach && rem > LIGHT.startup) return 'light'; // counter
      if (s.me.ki >= DASH.cost && rem <= 6) return 'dash_back';
      if (rem <= 3) return 'guard'; // crush less than hit? maybe if no dash
      // if rem > LIGHT.startup but dist>light, maybe back? 
      return 'guard';
    } else if (s.dist <= HEAVY.reach + 40) {
      return 'back'; // get out
    }
  }
  if (o.state==='light') {
    if (s.dist <= LIGHT.reach) return 'guard';
  }
  if (o.state==='blast') {
    if (s.dist <= LIGHT.reach && rem > LIGHT.startup) return 'light';
    // else guard incoming later
  }
}
```
But if opp heavy startup rem > light.startup and dist<=light.reach, light will hit before heavy, good. If rem <= light.startup, light may not; dash_back if possible. If no dash, guard. If dist 111-140, cannot light; dash_back or guard. If rem > heavy.startup? They just started, maybe back can move out: back speed3 per tick; active in rem ticks; distance increase if we back = 3*rem; need dist + 3*rem > 140. If rem=9 and dist120, +27=147 safe. Could return back. But we only decide every6; if choose back, will move for 6 ticks until next ask, not necessarily full rem. But state persists. If rem small, maybe not enough. Dash safer.

If opp light startup and dist<=light.reach, guard. If dist > light.reach but <= light.reach + 20, back? Light active soon; back may move out. But guard safe.

If opp blast startup and far, no immediate; incoming defense later.

Beam startup anti:
```
if (o.state==='beam' && o.phase==='startup') {
  const rem = R.beam.startup - o.t;
  if (s.dist <= LIGHT.reach && rem > LIGHT.startup) return 'light';
  if (s.dist <= HEAVY.reach && rem > HEAVY.startup) return 'heavy'; // light better if both
  if (s.me.ki >= DASH.cost && s.dist <= 320 && rem > DASH.ticks + DASH.recovery + LIGHT.startup) return 'dash_forward';
  // if rem small, prepare defense
  if (rem <= 6) {
     if (s.me.ki >= DASH.cost && s.dist < 200) return 'dash_back'; // maybe avoid
     return 'guard';
  }
  if (s.me.ki >= BEAM.cost && rem > 30? maybe start beam? no)
  // if far and can't dash, maybe guard or charge? guard before fire.
  if (s.dist > 320) {
     // If cannot interrupt, maybe guard just before fire. But we have time; could charge? risky. Return guard if rem <20 else forward? 
  }
}
```
But if opp beam startup far and rem >23, dash may not reach if dist>320. Could use beam counter if ki>=50 and rem + (dist/30) > 30? Let's implement:
```
if (me.ki >= BEAM.cost && rem > 10) {
  const reachTime = rem + Math.max(0, (s.dist - 70) / BEAM.speed); // approximate time until their beam hits us after fire
  if (reachTime > BEAM.startup + 5) return 'beam'; // try clash
}
```
But if we start beam and they hit us during startup, bad. Condition conservative: reachTime > 35. If dist 300, rem30 => 30+230/30=37.7 >35, okay. If rem 20, 27.7 <35, guard. If our beam fires at 30, clash if fronts meet before hit. Good. Use if hp not lead? Could.
If no beam, return guard when rem < 20 to hold block? But if we choose guard too early, stuck; okay. If rem >20 and far, maybe continue neutral.

Beam firing defense:
```
const eb = s.beams.find(b=>!b.mine);
if (eb) {
  const dir = eb.dir;
  // check if beam aimed at me: if (s.opp.x - eb.from)*dir >0? maybe.
  const gap = (s.me.x - eb.front) * dir; // positive if front hasn't reached me
  if (gap > -R.body) {
    const eta = gap <= R.body ? 0 : Math.ceil((gap - R.body)/BEAM.speed);
    if (s.opp.state==='beam' && s.opp.phase==='firing') {
      if (s.dist <= LIGHT.reach && eta > LIGHT.startup) return 'light';
      if (eta <= 8 && s.me.ki >= DASH.cost) {
        // try dash through/back depending
        // If close to opponent (dist<180), dash_forward may pass behind beam; else dash_back to escape.
        return s.dist < 180 ? 'dash_forward' : 'dash_back';
      }
      return 'guard';
    }
  }
}
```
If beam not aimed (gap negative? If front passed me? Then maybe already hit or behind). If enemy beam exists but moving away, ignore.

Incoming blast defense:
```
const inc = s.blasts.find(b=>b.incoming);
if (inc && inc.eta != null && inc.eta <= 12) {
  if (me.ki >= DASH.cost && inc.eta <= 8 && s.dist > 160 && s.wallAhead > 200 && Math.random()<0.3) return 'dash_forward';
  return 'guard';
}
```
But if we are in range to punish opp blast recovery? After guard, maybe.

What about opp dash? If opp.state==='dash' and phase moving, they may be invuln. If they are moving toward and close, maybe guard. Could detect if dist < 150 and opp.dash? Return guard? But if they dash_back, guard waste. Use movement memory? Could track opp.x previous; if dash and delta toward me. But decide maybe only once during dash. Top-level mem.lastOppX from previous call; dt. If opp.state==='dash' and delta toward >0? We can compute `closing = (s.opp.x - mem.lastOppX) * (s.me.facing?)` Actually me.facing points to opp. If opp moving toward me, x change opposite facing? If me.facing=1 (opp to right), opp moving toward decreases x. So delta * me.facing <0. If closing and dist<200, guard. If not, maybe forward. Not critical.

Punish opportunities:
Need include opp in recovery/stun. But if defense returns guard, may miss punish. Defense only for startup/projectiles. If opp recovery, no threat; punish.

`punish(s)`:
```
const o=s.opp;
if (o.invulnerable) {
  // down wake-up maybe
  if (o.state==='down') {
    const left=o.left;
    if (s.dist <= HEAVY.reach && left >= 6 && left <= 10 && Math.random()<0.4) return 'heavy';
    if (s.dist <= LIGHT.reach && left >= 3 && left <= 6 && Math.random()<0.4) return 'light';
  }
  return null;
}
const vulnerable = ['hitstun','blockstun','crushed','recover'].includes(o.state) || (MOVES.has(o.state) && o.phase==='recovery') || (o.state==='dash' && o.phase==='recovery');
if (!vulnerable) {
  // maybe startup interrupt handled in defense; but if opp startup slow and we can punish, defense may return light. Could also here.
}
if (vulnerable) {
  const left=o.left;
  // If left is large enough, use best move.
  if (s.dist <= HEAVY.reach && left > HEAVY.startup && o.state !== 'blockstun'? heavy okay) {
    // If opponent combo scaling and we can light for combo? If state hitstun, light may start combo; heavy gives knockdown. Use heavy if left>9 and (o.state==='crushed' || s.dist > LIGHT.reach || Math.random()<0.6). Else light.
  }
  if (s.dist <= LIGHT.reach && left > LIGHT.startup) return 'light';
  if (s.dist <= HEAVY.reach && left > HEAVY.startup) return 'heavy';
  // if cannot start before free but within range maybe still attack if they are in long recovery? left <= startup but recovery continues? If left is remaining state, if left <=startup, they will become free before active; not guaranteed. But if they are in recovery with left small, maybe they can act soon. skip.
}
// If opp in startup and we can interrupt (not beam maybe):
if (o.phase==='startup') {
  const rem=startupRem(o);
  if (o.state !== 'beam') {
    if (s.dist <= LIGHT.reach && rem > LIGHT.startup) return 'light';
    if (s.dist <= HEAVY.reach && rem > HEAVY.startup) return 'heavy';
  }
}
return null;
```
But if opp in blockstun and left 14, heavy startup9, active before free, good. If dist <=140. Damage maybe combo scaling. Good.

If opp in hitstun from blast (left20) and dist far? If dist<=110 light, etc.

Need be careful with punish and defense ordering for opp startup. If opp heavy startup and we can light, defense returns light; okay. If opp light startup, defense returns guard, not punish. Good.

Neutral if no punish/defense.

Implement `neutral(s)`:
```
if (s.timeLeft < 420) { // 7s
  if (s.me.hp > s.opp.hp) return endgameLead(s);
  if (s.me.hp < s.opp.hp) return endgameBehind(s);
  // equal: guard/space
}
// If opp down and far, maybe charge
if (s.opp.state==='down' && s.dist > 250 && s.me.ki < 70 && s.wallBehind > 100 && Math.random()<0.5) return 'charge';
// If opponent charging: punish with blast or approach
if (s.opp.state==='charge') {
  if (s.me.ki >= BLAST.cost && !s.me.blastOut && s.dist > LIGHT.reach && Math.random()<0.6) return 'blast';
  return s.dist > LIGHT.reach ? 'forward' : 'light';
}
// If opponent guard at mid/close: heavy or blast
if (s.opp.state==='guard') {
  if (s.dist <= HEAVY.reach) return Math.random()<0.7 ? 'heavy' : 'back';
  if (s.me.ki >= BLAST.cost && !s.me.blastOut && Math.random()<0.3) return 'blast';
}
// projectile/ki usage
if (s.dist > 320) return longRange(s);
if (s.dist > HEAVY.reach) return midRange(s);
return closeRange(s);
```
Need if opp.state not free? If opp in recovery, punish would catch. If opp in beam startup, defense. If opp in blast startup, defense. If opp in dash, neutral maybe.

`longRange(s)`:
```
const me=s.me, o=s.opp;
// If enemy beam startup handled; if incoming blast handled.
// If hp lead/time: maybe guard/charge? 
if (s.timeLeft < 900 && me.hp > o.hp) {
  if (s.wallBehind > 150) return 'back';
  return 'guard';
}
// If opponent down or stunned and far, charge
if ((o.state==='down' || o.state==='hitstun' || o.state==='blockstun') && s.dist > 300 && me.ki < 80 && Math.random()<0.4) return 'charge';
// Beam if can kill or high ki
if (me.ki >= BEAM.cost) {
  if (o.hp <= BEAM.chip || (me.ki >= 80 && Math.random() < 0.2 && o.state !== 'guard' && s.t > mem.nextBeam)) { mem.nextBeam=s.t+240; return 'beam'; }
}
// Blast if opponent charge/guard or random
if (me.ki >= BLAST.cost + 10 && !me.blastOut && s.t > mem.nextBlast) {
  if (o.state==='charge' || o.state==='guard' || Math.random()<0.15) { mem.nextBlast=s.t+90; return 'blast'; }
}
// Charge if safe and need ki
if (me.ki < 50 && s.dist > 380 && o.state !== 'forward' && o.state !== 'dash' && !incoming? && s.wallBehind > 120 && Math.random()<0.35) return 'charge';
// Dash forward if hp behind and ki good
if (me.hp < o.hp - 100 && me.ki >= DASH.cost + 20 && s.dist > 250 && Math.random()<0.25) return 'dash_forward';
// default approach or guard
if (s.dist > 500 && Math.random()<0.3) return 'guard'; // wait?
return 'forward';
```
But if we choose charge, may be punished by opponent forward. Condition o.state not forward; but they may start forward after we charge before next ask. Risk. Maybe charge only if o.state down/guard/charge? If both charge, okay. If o.state==='guard' far, charge? They could heavy/beam. Maybe not. Use conservative: charge if opponent down or also charge, or time early and dist >450 and random. Could skip charge entirely; passive enough? Passive 144 ki per match, enough. But charge can build for beams. Maybe safe after knockdown far.

`midRange(s)` (dist 141-320):
```
if (hpLeadLate) { if wallBehind>80 return 'back'; else guard; }
if (o.state==='charge') { if ki blast else forward; }
if (me.ki >= BLAST.cost && !me.blastOut && (o.state==='guard' || Math.random()<0.18)) return 'blast';
if (me.hp < o.hp - 150 && me.ki >= DASH.cost && Math.random()<0.3) return 'dash_forward';
// desired distance
let desired = 170;
if (me.hp > o.hp && s.timeLeft < 1200) desired=260;
if (me.hp < o.hp) desired=120;
if (s.dist > desired + 30) return 'forward';
if (s.dist < desired - 30 && s.wallBehind > 80) return 'back';
return Math.random()<0.4 ? 'guard' : 'idle';
```
But if desired 170 and dist 150, back maybe; but back into wall? check.

`closeRange(s)` (<=140):
Use weights as above. But if hpLeadLate, maybe guard/back. If opp.state guard heavy. If opp.state charge attack. If opp.free? If opp in light/heavy startup defense handled. If opp in dash, maybe guard. If opp.state back/forward/idle, mix.

Need maybe include beam at close if ki>=50 and opp.hp<=280? Beam startup too slow; not.

Weighted choice should not choose invalid dash if ki<10. Check. Also choose blast only if !blastOut and ki>=20; in neutral functions.

Potential problem: If weighted returns 'forward' when dist <= light range, we may move into opponent; okay. But if we choose 'back' with wallBehind small, separate may push? Avoid.

Maybe implement `safeBack(s)` returns if wallBehind > 70. If wallBehind small, don't back.

Dash_forward cross-up: If close and opp guard, dash_forward can pass behind and maybe attack after recovery, but they turn if free. If opp in guard (FREE), they turn each tick, so no cross-up. If opp in recovery/beam startup, dash through can bypass? Could use if opp.state==='beam' startup handled. Not needed.

Need ensure memory cooldown variables initialized. Use absolute ticks.

Let's consider if decide called during canCancel while defense would have handled projectile? Cancel is extra call immediately after light hit. Should we still defense? If we just hit opponent, they are in hitstun, no projectile? There might be incoming blast. But canCancel has priority; if we ignore defense, may choose attack and get hit by blast. However if opponent in hitstun, they didn't fire new blast; existing blast may be incoming. Could defense first even in cancel? But cancel opportunity fleeting; if blast eta small, guard maybe better. We can in main: update, if clash, if canCancel maybe call cancel but maybe check immediate lethal threats? Simpler: if canCancel, do cancel unless incoming blast eta <=2 or enemy beam imminent. But canCancel state me.light recovery; if choose guard, cancel not used and we continue recovery, may not guard immediately? Wait if cancel and return guard, choose sees cancel false and act not light/heavy/blast/beam, returns without starting? It does not change state; we remain light recovery. So cannot guard during light recovery unless cancel used to start a move? If return other, normal recovery. So defense not possible. Thus canCancel should use attack or none. If incoming blast about to hit, cannot cancel to guard. Only cancel into moves. Could cancel into dash? choose cancel only accepts light/heavy/blast/beam, not dash. So no. So canCancel before defense okay.

But if canCancel and we don't want attack, return 'idle' to continue recovery. Fine.

What if me.state not free and canCancel false? decide not called.

Need handle invalid actions with insufficient ki: In weighted, ensure dash/blast/beam only if ki enough. If choose heavy/light no cost.

Let's refine anti-beam startup. Since beam is high threat. Implement function `beamStartupResponse(s)`. Called in defense.
```
if (o.state==='beam' && o.phase==='startup') {
  const rem = BEAM.startup - o.t;
  // If we can hit before fire
  if (s.dist <= LIGHT.reach && rem > LIGHT.startup) return 'light';
  if (s.dist <= HEAVY.reach && rem > HEAVY.startup) return 'heavy';
  // Dash in if can recover and light before fire
  if (me.ki >= DASH.cost && s.dist <= 320 && rem > DASH.ticks + DASH.recovery + LIGHT.startup && s.wallAhead > 200) return 'dash_forward';
  // Beam counter if far and enough time before their beam reaches
  if (me.ki >= BEAM.cost) {
    const timeToHit = rem + Math.max(0, (s.dist - 70) / BEAM.speed);
    if (timeToHit > BEAM.startup + 8) return 'beam';
  }
  // If fire imminent, guard or dash back
  if (rem <= 8) {
    if (me.ki >= DASH.cost && s.dist < 240) return 'dash_back';
    return 'guard';
  }
  // If somewhat soon, start guarding? But if return guard now, may guard through startup; safe vs beam but vulnerable to heavy? Opp committed beam, cannot heavy. So guard okay. If rem <=20, guard.
  if (rem <= 20) return 'guard';
}
```
If we return beam counter, cost50; if we get hit during startup because timeToHit misestimated, bad. Condition conservative. `dist - 70`: beam front initial after fire maybe from+25/front+40 then +30 same tick; approximate. Use dist - 80. Need timeToHit = rem + max(0, (dist - 80)/30). If >38. If dist300 rem30 =>37.3 <38, no beam; guard. If dist500 rem30=>44, beam. Good. Beam counter at long. If opponent beam at far, we can beam to clash. If we have high ki. If not, guard. But if we guard from rem20 to fire, we block chip120. Could instead move away/back to avoid beam entirely? If we back 3/tick for 20 ticks =60, maybe not enough. Dash_back if ki. Guard okay.

If opp beam startup and we are far but hp lead late, maybe just guard. Good.

Beam firing defense: If enemy beam firing and we are free, if we had started beam too, clash would be active, so no. If enemy beam firing, guard. But if we can dash_forward through and punish? Maybe if dist<200 and eta <=8. Implement dash if hp low? Could be risky. Use if `eta <= 6 && me.ki>=10` return dash_back if dist>200 else dash_forward. But if dash_forward through beam, after recovery opponent beam may still firing? Beam fire 40 ticks; if we dash through and close, can light interrupt after recovery if beam still firing and not hit. Dash total18; if beam eta small, we pass, after recovery maybe beam front behind us? Beam ray from shooter to front (which continues away from shooter toward original direction). If we are behind shooter, safe. If we dash_forward and land behind, distance maybe60, can light. Good. Use if dist<180. If dist>180, dash_back to escape. But if beam front eta <=6 and dist>180, dash_back moves away, invuln9, likely safe. Good.

Incoming blast defense maybe dash_forward to punish if eta <=8 and dist>200. But if we choose guard, safe. Maybe use dash_forward only if opp.state recovery? Could keep simple guard. But guard vs blast gives chip and opp ki? Actually blocker +2 ki, chip12. If we guard many blasts, okay. Dash through cost10 but closes. Use if ki high and random. Not essential.

Heavy startup defense: Need avoid crush. Implement:
```
if (o.state==='heavy' && o.phase==='startup') {
 const rem = HEAVY.startup - o.t;
 if (s.dist <= HEAVY.reach) {
   if (s.dist <= LIGHT.reach && rem > LIGHT.startup) return 'light';
   if (me.ki >= DASH.cost) return 'dash_back';
   if (s.wallBehind > 60 && s.dist + 3*rem > HEAVY.reach) return 'back'; // maybe
   return 'guard';
 } else if (s.dist <= HEAVY.reach + 50 && s.wallBehind > 60) return 'back';
}
```
If rem <= light.startup and dist<=light.reach, light might trade/lose; dash_back. If no ki, guard (60). If dist just inside heavy and rem large, back may escape? If choose back, state persists; may be hit if not enough. But dash better.

Light startup defense:
```
if (o.state==='light' && o.phase==='startup' && s.dist <= LIGHT.reach + 20) return 'guard';
```
If dist > light reach, ignore.

Blast startup defense:
```
if (o.state==='blast' && o.phase==='startup') {
 if (s.dist <= LIGHT.reach && rem > LIGHT.startup) return 'light';
 // else incoming defense later
}
```

Dash defense: If opp.state dash moving and closing and dist<160, maybe guard. But they can't hit during dash; after recovery may attack. If we guard, block. If we attack, whiff due invuln. So guard. Use if `o.state==='dash' && o.phase==='moving' && s.dist < 200` return 'guard'? But if they dash_back, guard waste. Could check movement: mem.lastOppX. Compute delta = o.x - mem.lastOppX; if delta toward me. Need me.facing: if facing 1 (opp right), toward me means delta<0. If facing -1, delta>0. If closing = delta * me.facing < 0. If closing and dist<220, guard. If not, maybe forward? We'll implement.

Punish after dash recovery: opp dash recovery state phase recovery, vulnerable; punish handles.

Now, potential issue: `state.me.free` maybe false during canCancel? But we only call main. If not free and not cancel/clash, maybe return current state? But decide not called. If called unexpectedly, return 'guard'? Could.

Let's test mentally some scenarios.

Start t=0, decide. mem not init. No clash/cancel. defense none. punish none. neutral: timeLeft3600, opp idle, dist300 >140, longRange? dist<=320? midRange (since >heavy reach). midRange: hp equal, desired170, dist300 >200 => forward. So we forward. Good.

Next ask t=6 if still forward, dist 273. midRange forward until dist ~200. At dist 170, maybe idle/guard. If opponent also forward, close.

If opponent starts beam t=0. At t=6 we see opp beam startup t=6 rem24, dist maybe273 if we forwarded. defense beam: dist<=light? no. dash_forward condition dist<=320 and rem > 10+8+5=23? rem24 >23 yes, ki30 => dash_forward. We dash. During dash 10 ticks, invuln9. Opp beam startup continues; at t=24? Let's timeline: choose dash at tick6. Dash moving ticks6-15, recovery16-23, free ask tick24. Opp beam startup t=0..29, fires tick30. At tick24, opp t=24 rem6, dist after dash from 273 to 73? dash reduces 200 ->73 (min maybe). We are free, defense beam: rem6, dist<=light.reach and rem > light.startup? 6>5 yes, return light. Light active at tick29, before beam fire tick30, interrupts. Good. If rem23 at decision, dash condition false; maybe guard. Good.

If opponent beam at t=0 and we were at dist300 but chose guard at t=6? dist maybe300? defense dash condition rem24 dist300 -> dash. Good.

If opponent beam and dist350, rem30, dash condition dist<=320 false. Beam counter? me.ki30<50. rem <=20? no. neutral maybe forward? Could walk into beam. Need handle far beam startup when cannot dash or beam. Should guard before fire. If rem30, we have time. If we return forward, may get hit. We need if opp beam startup and rem maybe >20 but far and cannot interrupt, we should either back/guard. Since beam startup committed, we can move away/back or guard. Back speed3, in 30 ticks moves90, dist350->440; beam range? Beam front travels stage; can still hit if not guarded. Guard chip. Could dash_back to create space? cost10. If dist>320 and rem >20, maybe return 'back' to move away, but beam can still reach. Guard at least reduces. Maybe choose 'guard' if rem <25? But if we guard early, stuck; opponent cannot change beam. Guard chip120. Could maybe charge? no. To avoid chip, need dash_back? Dash_back at far increases dist200; beam may not reach before stage? Stage finite. If at 350, dash_back to 550? Beam from opp at 650? Actually positions. Could outrun? Beam front max to stage right. If we move back, maybe beam reaches wall? It covers from shooter to front until stage edge; if we move beyond? Stage max. Cannot outrun if wall. Guard safe. So if cannot interrupt, guard. Implement: if opp beam startup and rem <=30? Actually always if no interrupt, return guard when rem <=25; if rem >25, maybe still move? But guard early okay. However guarding for 30 ticks means if opponent beam was fake? They can't cancel. So safe. Return guard. But if we return guard at t=6, next asks every6 while guard; continue guard until beam fire/block. Good. So in beamStartupResponse, after dash/beam counter, if rem <= 25 return 'guard'; else maybe also guard if far. Could just return 'guard' if no interrupt and dist>?? But if rem=30 and we could charge? Not. Guard avoids 280. So set if rem <= 30 (always) return guard if no better. But if we are close and rem > light startup, light. If dash possible, dash. Else guard. This means when opponent beams far, we guard and take 120 chip. Could be okay but losing HP. Beam counter if ki. If opponent spams beam, we lose 120 each, bad. Need maybe anti-beam better. Starting ki30, can't beam. Could dash_forward if dist<=320. If dist>320, start forward? But guard. Maybe after block, opp recovery20, we can punish? Beam blocked: blockstun until beam ends? Beam blocked once, blockstun long until beam end +6; we can't punish. Opp recovery20 after fire; we may still blockstun? Beam blockstun = startup+fire - a.t +6 when hit. If block near start of fire, ~46. Opp beam total recovery after fire20, free at t=90; we blockstun maybe until t=76? Actually can punish maybe. But HP down120.

Could avoid beam by dash_back even far: if ki>=10, dash_back increases distance; beam may still hit but maybe we can guard after? If dash_back invuln9, beam startup not fired. After dash, dist +200; if near wall maybe. Then guard. Could reduce? Not necessary.

If opponent beams often, we need ki to beam counter or dash punish. Maybe after first beam, we gain ki from damage taken? If guard chip120 gives ki taken 9.6 + block2, passive; can reach50. Then next beam counter. Good.

What about opponent blast spam? Guard chip12 +2 ki, not too bad. We can dash/attack.

Close mix: Suppose dist100, opp idle. closeRange weights. If we choose light, startup5. If opp chooses heavy, light wins. If opp chooses guard, light blocked. If opp chooses light, trade? Both light same tick? If both choose at same decide, both active same tick? If both light startup5, active same tick, both hit (trade) damage both 40. If one chose guard, block. Weighted okay.

If opp guard state observed (they held guard from previous), closeRange sees o.state==='guard' and returns heavy 75%. Heavy active9; if they continue guard, crush 60. If they release and light at same decision? They are free if guard? If they choose light now, light active5, heavy active9, they hit us, interrupt heavy. Our heavy choice risky. But if they have been guarding, likely continue. Could be exploited. Maybe use light sometimes to test? But heavy necessary. Adapt memory: if opp guard count high, heavy. If they start countering with light, we'll observe light startup and next time adjust? But we get hit. Fine.

If opp charge, light. Good.

If opp heavy startup defense: If dist<=110 and rem>5, light. If opponent heavy at t=0 and we get ask t=0? simultaneous? If opp state not heavy yet (they choose same tick), can't know. If we choose light and they heavy, we win. If we choose guard, lose crush. So close mix light helps.

Need maybe avoid returning 'charge' in neutral if opponent free and not down. Could be punished. Limit charge to opp down or far and random small. Maybe omit charge except opp down. Passive ki enough? But beam needs 50; start30 + passive 2.4/s. In 60s enough. Charge can help. But charge x1.5 risk. Use very safe: if opp.state==='down' and dist>250 and left>20, charge. Or if timeLeft>3000 and dist>450 and opp.state not forward/dash/beam startup and random. Maybe okay.

Implement `canChargeSafely(s)`:
```
(s.opp.state==='down' && s.opp.left > 20 && s.dist > 240) || (s.dist > 480 && ['idle','guard','charge','back'].includes(s.opp.state) && s.wallBehind > 150 && s.timeLeft > 900 && Math.random()<0.3)
```
If opp guard far, charge? They could beam/heavy. But far, heavy no. Beam possible if ki. If opp.ki>=50, don't charge. Add `s.opp.ki < 40`. If opp guard, okay. If opp idle, maybe. Use low probability.

Maybe top-level plan: if we have hp lead and time, charge when safe to maintain lead? But charging can get hit. Maybe not.

Need consider `state.me.blastOut`: if true cannot blast. Use.

Cooldowns: Use mem.nextBeam, nextBlast, nextDash. Set on use. But decide not called every tick; okay. For dash defense, ignore cooldown if emergency. For offensive dash, cooldown.

Potential issue: returning 'back' when wallBehind small can cause separation pushing? If back into wall, still moves? x clamped. Opp may push. Avoid if wallBehind<50. In weighted, back weight 0 if wallBehind<80.

If we are cornered (wallBehind < 80) and close, need escape. Options: dash_forward through if ki>=10, guard, attack. If opp guarding, heavy? Could. Implement in closeRange: if wallBehind<80 and me.ki>=DASH.cost and Math.random()<0.25 return dash_forward (to cross up). But if opp attack, dash invuln can evade. Good. If no ki, attack/guard.

If opponent cornered (opp wallBehind? We don't have opp wall, but can infer from x and stage). If opp.x near wall and dist close, attacks push maybe. Not needed.

Need maybe use `state.me.state` if already in held state? Since decide asked every6, if we return same held state, continues. If we return 'idle', stop moving. Sometimes we want hold guard. If defense returns guard, okay.

Let's consider time budget. Code with weighted and many conditions okay. Up to 600 calls, trivial.

Need ensure no syntax errors. Use `var`/`let`. The environment may run in strict? Function decide global. Top-level code can define functions. Avoid ES modules. Use `const` okay.

Now, maybe we can improve by implementing simple simulation for specific actions? Could use state to predict if attack will hit. But not necessary.

Let's think about engine quirks to exploit:
- Light on hit gives cancel; if we choose light at close and it hits, we can combo. Good.
- Heavy on guard crush; if opponent in blockstun? Heavy hits. If opponent guarding, crush. Good.
- Blast only one on screen; if me.blastOut false. If opponent blast incoming, our blast could clash? Two opposite blasts cancel if cross. If we fire blast when incoming blast, maybe cancel. But startup11; incoming eta maybe. Could use to cancel projectile if eta > startup+travel? Not needed.
- Beam swallows blasts. If opponent blast incoming and we have beam, starting beam might swallow? Beam startup too slow. If already firing, auto swallows.
- Dash invuln can dodge beam/blast. Use emergency dash.
- Guard only front; dash behind can beat guard if opponent not free? If opponent in beam startup/recovery, dash_forward through and attack. Our anti-beam dash does that. Could also use dash_forward when opp guard and close? If opp guard free, they turn, no. If opp in recovery, dash maybe.

Maybe implement offensive dash when opponent in long recovery/stun and dist > 150: punish function may not reach; neutral could dash. For example, opp heavy whiff recovery22 at dist200. We are free. Punish: dist>140 can't attack. Could dash_forward to close and punish? Dash total18, recovery ends maybe before opp recovery? If opp.left 22, dash+recovery18, free with 4 ticks left; opp still recovery, can light active5? Too late. Maybe dash_forward during their recovery then attack after they free? Not guaranteed. But dash can close. Use if opp.left > DASH.ticks+DASH.recovery+LIGHT.startup? For heavy recovery left22, need >23, not. So no. If opp beam recovery20, no. If opp down left42, can dash to approach. Neutral can forward/dash.

Maybe punish function can return dash_forward if opponent vulnerable but out of range and left > dash total + light startup? For states with long vulnerability (down, hitstun from beam? down 50). If opp down left > 23 and dist 150-320, dash_forward to get close for wake-up? But dash recovery ends before wake maybe. Could then light. Use in punish: if o.state==='down' and left > 25 and dist>140 and ki, dash_forward? But down invulnerable; dash just approach. Could be okay. But not necessary.

Need handle opponent `recover` after clash win: vulnerable 20 ticks. If dist maybe far? Could punish if close.

Clash strategy more detailed. Let's derive maybe optimal threshold. Suppose pos=0 at me, 1 opp. Point velocity positive for side0? But pos normalized relative to me; if pos increasing means away from me. Our push increases my power, tends to move point toward weaker. If I push and opponent not, point moves away from me (pos increases). If pos low, push. If pos high, don't. If opponent pushes, their power increases, point moves toward me (pos decreases). We see current powers including current push flags from previous decision. If oppPower high due push, maybe we should push to counter if pos not high. Use myNo/oppNo.

Implementation:
```
function clashChoice(s) {
 const c=s.clash, me=s.me, opp=s.opp;
 const myNo = basePower(me), oppNo=basePower(opp);
 const pos=c.pos;
 const kiAdv = me.ki - opp.ki;
 // If point very close, push if have ki
 if (pos < 0.18) return me.ki > 0 ? 'push' : 'idle';
 // If point very far, don't push
 if (pos > 0.82) return 'idle';
 // If opponent not pushing (oppPower approx oppNo) and pos<0.6, push if myNo+0.6 > oppNo + 0.1
 const oppPushing = oppPower > oppNo + 0.3;
 if (!oppPushing && pos < 0.6 && me.ki > 5) return 'push';
 if (oppPushing) {
   if (pos < 0.5 || me.ki > opp.ki + 8) return me.ki > 0 ? 'push' : 'idle';
   return 'idle';
 }
 // middle: push if ki advantage or pos<0.45
 if (pos < 0.45 || kiAdv > 10) return 'push';
 return 'idle';
}
```
But if both pushing and pos mid, maybe drain. Could use thresholds. Need account rage: if hp<30%, power +0.4. basePower includes. If ki=0, push no power; if pos low maybe still push? no effect. Return idle if ki<=0. If ki>0 but low (<3), pushing costs 0.6/tick, will deplete in 5 ticks; maybe still needed if pos low. If pos mid and low ki, don't push.

Could use `c.t`: if t > 300 and pos between .3-.7 and my hp > opp hp? Maybe don't push to force explosion? If explosion 120 both. If opp hp <=120 and my hp>120, letting timeout wins. But point may move. If not pushing reduces drift? Random still. If pos near me, must push. If t>300 and pos>0.4 and opp.hp <=120 and me.hp>120, return idle. Also if my hp<=120, push to avoid explosion? But if point reaches me, 320 death; explosion 120 death too if hp<=120. Need push if pos<0.5. Fine.

Simpler clash as above.

Need compute basePower in clash using `R.hp` for rage. state.me.hp may be negative? view hp max0. Use.

Now, potential bug: In view, `opp.left` for state beam includes total remaining (startup+fire+recovery - t). For startup rem we use opp.t. For stun states left is dur - t. Good.

Need maybe use `state.opp.phase` for beam firing. Good.

Let's consider if `state.me.canCancel` true but `state.me.chain` maybe 4; cancelChoice should not choose light if chain>=4. Use. If dist<=140 heavy. If chain maybe 0? canCancel only after light hit.

CancelChoice detailed:
```
function cancelChoice(s) {
 const d=s.dist, o=s.opp, me=s.me;
 const scale = R.combo[Math.min(o.combo, R.combo.length-1)]; // o.combo after hit? Actually after hit combo incremented, so next scale index o.combo. If first hit combo=1 => 0.8.
 const lightDmg = Math.max(1, Math.round(LIGHT.damage * scale));
 const heavyDmg = Math.max(1, Math.round(HEAVY.damage * scale));
 if (d <= LIGHT.reach && o.hp <= lightDmg) return 'light';
 if (d <= HEAVY.reach && o.hp <= heavyDmg) return 'heavy';
 if (d <= LIGHT.reach && me.chain < LIGHT.chain && d <= 95 && (me.chain <=2 || o.hp > heavyDmg + lightDmg)) return 'light';
 if (d <= HEAVY.reach) return 'heavy';
 if (d <= LIGHT.reach && me.chain < LIGHT.chain) return 'light'; // maybe still try
 if (me.ki >= BLAST.cost && !me.blastOut && d <= 160) return 'blast'; // maybe
 return 'idle';
}
```
But if d <=95, light chain may continue. If d >95, heavy. However if chain=3 (already 3 lights), heavy maybe. If d >140, cannot heavy. If d<=110 light maybe if chain<4. But if d 120, light whiffs. Return idle. If opp at wall? d maybe. Good.

What if opp.hp low and d >140 but blast can kill? Blast damage scaled? If cancel into blast, projectile may hit after hitstun; not reliable. Skip.

Should we cancel into beam if opp.hp <= beam*scale and d>?? Beam startup too long; no.

Punish choice: Use heavy vs crushed/blockstun? If opp in hitstun and we can light, light may combo into heavy via cancel, more total. But if we are not already in combo (opp combo maybe from blast), light hit will give cancel. So light is good. Heavy gives more immediate but no cancel. If opp left >9 and dist<=140, heavy damage 120 vs light 40. But light can cancel into heavy for 40+96=136 if dist remains. However if we choose light and it hits, we get cancel; if not, maybe. So light often better for combo. But if opp state crushed (34) or blockstun, light can also hit and cancel? Yes any light hit gives cancel. Could combo. So default light if in range and left>5; heavy if out of light range or left>9 and maybe want knockdown. But heavy slower; if left just >9, okay. Maybe choose light if in light range, unless opp.state==='crushed' and heavy for bigger? Light combo fine. Use light if in light range; heavy if only heavy range. If both, maybe random/ heavy if opp.hp >? For punish, light safer. But if opponent in long stun and we want max damage, light->heavy combo via cancel will be handled. So choose light if d<=110. If d>110 and <=140, heavy. Good.

If opp in recovery and left small (<5), no attack. If left >5 light.

Startup interrupt: If opp in startup of heavy/blast/beam and rem > light.startup, light. If opp light startup, defense guard not light (trade). If opp beam startup, defense handles.

Down wake-up: Could implement in neutral if opp down. Maybe not necessary. But can get free damage? If opponent down, they invulnerable; we can position. If we choose heavy just before wake and they guard, crush. Could be strong. Let's add to punish for down:
```
if (o.state==='down' && !o.invulnerable? invulnerable true) {
  const left=o.left;
  if (s.dist <= HEAVY.reach && left > HEAVY.startup && left <= HEAVY.startup + 8) return 'heavy'; // active during wake? Need left around startup.
  if (s.dist <= LIGHT.reach && left > LIGHT.startup && left <= LIGHT.startup + 6) return 'light';
}
```
But if left > startup, active occurs before they wake (invulnerable), whiffs? If active before wake, no hit; we may be in recovery when they wake. Need active after wake. For heavy startup9, if left=8, active at t+9 when they woke at t+8, good. If left=9, active same tick they become free? They may act? They become free at end of tick when left reaches0? Let's not precise. Use left between startup-2 and startup+4 maybe. But risky. Could skip to avoid bad. Maybe charge/approach instead. If opp down, we can charge if far, or move forward. If close, maybe guard? We'll skip wake-up attacks or low probability.

Maybe add: if opp.down and dist>140, forward to approach; if dist<=110 and left <=5, light? But if left <=5, active after wake maybe. Could. Not critical.

Need handle when we are in `me.state==='charge'` and decide asked (every6). If neutral returns something else, state changes. Good.

Let's think about possible bugs with top-level variables and reloading. The environment may load file once per match? It says top-level code executed at start of each game; variables cleared by reload. Our mem initialized top-level. Good.

Potential issue: `RULES` may be undefined in sandbox? It says global RULES. Use `typeof RULES !== 'undefined' ? RULES : {...}`? Could include fallback minimal? Not necessary but safe. But if RULES not defined, code error. Could define `var R = (typeof RULES !== 'undefined') ? RULES : { ... }`; but fallback long. We can assume.

Need avoid using `Set`? fine. But simpler arrays.

Let's draft code.

Pseudo code full:
```
const R = RULES;
const LIGHT = R.light, HEAVY = R.heavy, BLAST = R.blast, BEAM = R.beam, DASH = R.dash, CLASH = R.clash;
const STAGE = R.stage;
let mem = {
  lastT: -1, lastOppKey: '', acts: {light:0, heavy:0, blast:0, beam:0, guard:0, charge:0, dash:0},
  nextBeam: 0, nextBlast: 0, nextDash: 0, lastOppX: null, lastMeX: null
};
function decide(state) {
  try { return main(state); } catch (e) { return 'guard'; }
}
function main(s) {
  update(s);
  if (s.clash) return clashChoice(s);
  if (s.me.canCancel) return cancelChoice(s);
  if (!s.me.free) return 'idle'; // safety
  var act = defense(s);
  if (act) return act;
  act = punish(s);
  if (act) return act;
  return neutral(s);
}
```
But if `s.me.free` false and canCancel false, decide shouldn't be called. Return idle.

`update(s)`:
```
function update(s) {
  if (mem.lastT < 0) { mem.lastT=s.t; mem.lastOppX=s.opp.x; mem.lastMeX=s.me.x; return; }
  var o=s.opp;
  var key=o.state + ':' + (o.phase||'');
  if (key !== mem.lastOppKey) {
    if (o.phase === 'startup' && (o.state==='light'||o.state==='heavy'||o.state==='blast'||o.state==='beam'||o.state==='dash')) mem.acts[o.state] = (mem.acts[o.state]||0)+1;
    else if (o.state==='guard') mem.acts.guard = (mem.acts.guard||0)+1;
    else if (o.state==='charge') mem.acts.charge = (mem.acts.charge||0)+1;
    mem.lastOppKey = key;
  }
  mem.lastT = s.t;
  mem.lastOppX = o.x;
  mem.lastMeX = s.me.x;
}
```
Dash state phase moving, not startup? phase for dash moving/recovery. Counting dash? Could count when state dash entry. Add if o.state==='dash' mem.acts.dash++. But phase not startup. Use key change.
```
if (o.state==='dash') mem.acts.dash++;
```
Good.

`startupRem(s)`:
```
function startupRem(o) {
 if (o.phase !== 'startup') return 9999;
 if (o.state==='light') return LIGHT.startup - o.t;
 if (o.state==='heavy') return HEAVY.startup - o.t;
 if (o.state==='blast') return BLAST.startup - o.t;
 if (o.state==='beam') return BEAM.startup - o.t;
 return 9999;
}
```

`incomingBlast(s)` find.

`enemyBeam(s)` find.

`defense(s)` detailed:
```
function defense(s) {
  var me=s.me, o=s.opp;
  // enemy beam firing
  var eb=null; for (var i=0;i<s.beams.length;i++) if(!s.beams[i].mine) eb=s.beams[i];
  if (eb) { ... }
  // incoming blast
  var inc=null; for (...) if (b.incoming && b.eta != null) inc=b;
  if (inc && inc.eta <= 12) { ... }
  // opp startup attacks
  if (o.phase === 'startup') { ... }
  // opp dash closing
  if (o.state === 'dash' && o.phase === 'moving') { ... }
  return null;
}
```
Beam firing:
```
if (eb) {
  var dir=eb.dir;
  var gap=(me.x - eb.front)*dir;
  // If beam is moving toward me: if gap > -30. If front already past me, maybe not.
  if (gap > -R.body) {
    var eta = gap <= R.body ? 0 : Math.ceil((gap - R.body) / BEAM.speed);
    if (o.state === 'beam' && o.phase === 'firing') {
      if (s.dist <= LIGHT.reach && eta > LIGHT.startup) return 'light';
      if (eta <= 7 && me.ki >= DASH.cost) {
        if (s.dist < 180 && s.wallAhead > 220) return 'dash_forward';
        if (s.wallBehind > 150) return 'dash_back';
      }
      return 'guard';
    }
  }
}
```
But if eb exists and o.state not beam? Shouldn't. If eb mine? skipped. If beam dir not toward me? gap maybe negative large. If gap > -body but dir? Example beam moving away: me behind from, front further away, gap negative? If dir=1, me left of front? Could be. We'll ignore if gap<-body.

Incoming blast:
```
if (inc && inc.eta <= 12) {
  if (me.ki >= DASH.cost && inc.eta <= 7 && s.dist > 180 && s.t >= mem.nextDash && Math.random() < 0.35) { mem.nextDash=s.t+60; return 'dash_forward'; }
  return 'guard';
}
```
If eta 12 and we guard, next ask in6 eta6 guard again. Good. If we are in close punish, defense overrides. Could guard too much vs blast spam, but okay.

Startup attacks:
```
if (o.phase==='startup') {
 var rem = startupRem(o);
 if (o.state==='beam') { ... }
 else if (o.state==='heavy') { ... }
 else if (o.state==='light') { ... }
 else if (o.state==='blast') { ... }
}
```
Beam startup response:
```
if (o.state==='beam') {
  if (s.dist <= LIGHT.reach && rem > LIGHT.startup) return 'light';
  if (s.dist <= HEAVY.reach && rem > HEAVY.startup) return 'heavy'; // maybe light if both? light faster
  if (me.ki >= DASH.cost && s.dist <= 320 && rem > DASH.ticks + DASH.recovery + LIGHT.startup && s.wallAhead > 200 && s.t >= mem.nextDash) { mem.nextDash=s.t+60; return 'dash_forward'; }
  if (me.ki >= BEAM.cost && rem > 8) {
    var timeToHit = rem + Math.max(0, (s.dist - 80) / BEAM.speed);
    if (timeToHit > BEAM.startup + 8 && s.t >= mem.nextBeam) { mem.nextBeam=s.t+240; return 'beam'; }
  }
  if (rem <= 25) return 'guard';
}
```
If rem >25 and no action, may fall through to punish/neutral. But if far beam startup rem30, no dash/beam, rem>25 so no guard; neutral may forward/back. Could be bad. Maybe change to if rem <= 30 return guard after no interrupt. Since beam startup max30. If rem<=30 always. But if rem=30 and we could dash? dash condition rem>23, okay. If not, guard. So after beam counter, `return 'guard';`? But if we are far and rem30, guarding for 30 ticks. Fine. But if we are close and rem > light.startup, light. If dash, dash. If beam counter, beam. Else guard. So simply return 'guard' for beam startup if no better. But what if opponent beam startup and we are in position to charge? Guard safer. Do that. But if rem very large? max30. So:
```
if (o.state==='beam') { ...; return 'guard'; }
```
This means whenever we see opp beam startup and can't interrupt, we guard. Good.

Heavy startup:
```
if (o.state==='heavy') {
  if (s.dist <= HEAVY.reach) {
    if (s.dist <= LIGHT.reach && rem > LIGHT.startup) return 'light';
    if (me.ki >= DASH.cost && s.wallBehind > 120) return 'dash_back';
    if (s.wallBehind > 60 && s.dist + 3*rem > HEAVY.reach + 10) return 'back';
    return 'guard';
  } else if (s.dist <= HEAVY.reach + 60 && s.wallBehind > 60) {
    return 'back';
  }
}
```
If dist<=heavy reach and rem <= light.startup, dash_back if ki; else guard. If wallBehind small, dash_back may be impossible? dash_back moves toward wall, clamped; maybe not. If wallBehind small, dash_forward through? Could avoid heavy by dash_forward? Heavy reach140; dash_forward invuln, moves toward/through opp. If close, can dodge. Use if wallBehind<120 and ki and dist<=heavy reach: `dash_forward` maybe. Add:
```
if (me.ki>=DASH.cost) return (s.wallBehind > 120 ? 'dash_back' : 'dash_forward');
```
Dash_forward through heavy can pass behind; invuln. Good. If no room behind, stops in front but invuln? Might still be in reach after invuln? Heavy active may have passed. Okay.

Light startup:
```
if (o.state==='light' && s.dist <= LIGHT.reach + 20) return 'guard';
```
If dist > light reach+20, maybe ignore.

Blast startup:
```
if (o.state==='blast') {
 if (s.dist <= LIGHT.reach && rem > LIGHT.startup) return 'light';
 // if far, let incoming defense handle; if rem <=? maybe guard soon
}
```

Dash closing:
```
if (o.state==='dash' && o.phase==='moving' && mem.lastOppX != null) {
  var delta = o.x - mem.lastOppX;
  var closing = (delta * me.facing) < -0.1; // if opp to right facing=1, delta negative toward me
  if (closing && s.dist < 220) return 'guard';
}
```
But if we are in guard, okay. If they dash back, no.

`punish(s)`:
```
function punish(s) {
 var o=s.opp, d=s.dist;
 if (o.invulnerable) {
   if (o.state==='down') {
     // approach if far? neutral handles. Maybe wake attacks low probability.
     if (o.left <= 5 && d <= LIGHT.reach && Math.random()<0.3) return 'light';
     if (o.left <= 9 && o.left > 5 && d <= HEAVY.reach && Math.random()<0.2) return 'heavy';
   }
   return null;
 }
 var vulnerable = false;
 if (o.state==='hitstun' || o.state==='blockstun' || o.state==='crushed' || o.state==='recover') vulnerable=true;
 else if ((o.state==='light'||o.state==='heavy'||o.state==='blast'||o.state==='beam'||o.state==='dash') && o.phase==='recovery') vulnerable=true;
 else if (o.state==='dash' && o.phase==='recovery') vulnerable=true; // redundant
 if (vulnerable) {
   var left=o.left;
   if (d <= LIGHT.reach && left > LIGHT.startup) return 'light';
   if (d <= HEAVY.reach && left > HEAVY.startup) return 'heavy';
   // if left small but in range, maybe light anyway if they can't move? If left <= startup, they may act before active. skip.
 }
 // startup interrupt for non-beam/light? beam handled defense, but if can hit and defense didn't? For blast/heavy.
 if (o.phase==='startup' && o.state!=='beam' && o.state!=='light') {
   var rem = startupRem(o);
   if (d <= LIGHT.reach && rem > LIGHT.startup) return 'light';
   if (d <= HEAVY.reach && rem > HEAVY.startup) return 'heavy';
 }
 return null;
}
```
If o.state==='charge', not vulnerable? Charge is FREE, can act; but we want attack. Neutral handles. Could punish charge: if o.state==='charge' and d<=light, light. Add in neutral or punish. Maybe in punish: if o.state==='charge' and d<=light return light; if d<=heavy return heavy. But if they charge, they can decide? They are free but held charge; if we attack, okay. Add:
```
if (o.state==='charge') { if(d<=LIGHT.reach) return 'light'; if(d<=HEAVY.reach) return 'heavy'; }
```
But if opp charge and far, neutral forward/blast.

If o.state==='guard' and d<=heavy, neutral heavy. Not in punish.

`neutral(s)`:
```
function neutral(s) {
 var me=s.me, o=s.opp;
 // endgame lead
 if (s.timeLeft < 600 && me.hp > o.hp) return leadClose(s);
 if (s.timeLeft < 300 && me.hp === o.hp) return 'guard';
 // If opponent charging
 if (o.state==='charge') { ... }
 // If opponent guard close/mid
 if (o.state==='guard') { ... }
 // Safe charge
 if (canCharge(s)) return 'charge';
 // Offensive ki projectiles
 if (s.dist > 320) return longRange(s);
 if (s.dist > HEAVY.reach) return midRange(s);
 return closeRange(s);
}
```
Need if opp.state is not free but not punishable? e.g., opp dash moving. Defense maybe guard. If not, neutral. For opp dash moving away, maybe forward. Could handle in neutral:
```
if (o.state==='dash') { if closing? guard else forward; }
```
But defense handled closing. If dash recovery, punish. If dash moving away, forward.

`leadClose(s)`:
```
if (s.dist < 220) {
  if (s.wallBehind > 100) return 'back';
  if (s.me.ki >= DASH.cost && Math.random()<0.4) return 'dash_back';
  return 'guard';
}
if (s.dist < 400) {
  if (s.wallBehind > 100) return 'back';
  return 'guard';
}
return 'guard';
```
But if we just back, opponent forward faster; may corner. Dash_back if ki. If no ki and cornered, guard. If hp lead, guard beam? Heavy crush. But time low, opponent desperate. Maybe guard better than attack. If opp beam, defense handles. If opp heavy close, defense heavy may guard/dash. leadClose may return back/guard.

Endgame behind: If hp behind, neutral should be aggressive. In functions adjust desired and probabilities. Could add at top:
```
if (s.timeLeft < 600 && me.hp < o.hp) { if (me.ki>=BEAM.cost && s.dist>200) return 'beam'; if (s.dist>200 && me.ki>=DASH.cost) return 'dash_forward'; }
```
But beam startup can be interrupted; if behind need risk.

`canCharge(s)`:
```
function canCharge(s) {
 var me=s.me,o=s.opp;
 if (me.ki >= 80) return false;
 if (s.timeLeft < 900) return false;
 if (o.state==='down' && o.left > 25 && s.dist > 240) return true;
 if (s.dist > 480 && (o.state==='idle'||o.state==='guard'||o.state==='charge'||o.state==='back') && o.ki < 45 && s.wallBehind > 150 && Math.random()<0.25) return true;
 return false;
}
```
If o.state charge too, both charge. Good. If o.guard far and ki<45 (no beam), charge. But they could dash; risk. Low probability.

`longRange(s)`:
```
function longRange(s) {
 var me=s.me,o=s.opp;
 if (s.timeLeft < 900 && me.hp > o.hp) { if(s.wallBehind>120) return 'back'; return 'guard'; }
 if (o.state==='charge') {
   if (me.ki >= BLAST.cost && !me.blastOut && Math.random()<0.6) return 'blast';
   return 'forward';
 }
 if (me.ki >= BEAM.cost && s.t >= mem.nextBeam) {
   if (o.hp <= BEAM.chip || (me.ki >= 75 && Math.random() < 0.18 && o.state !== 'guard')) { mem.nextBeam=s.t+240; return 'beam'; }
 }
 if (me.ki >= BLAST.cost + 10 && !me.blastOut && s.t >= mem.nextBlast) {
   if (o.state==='charge' || o.state==='guard' || Math.random() < 0.12) { mem.nextBlast=s.t+100; return 'blast'; }
 }
 if (canCharge(s)) return 'charge';
 if (me.hp < o.hp - 100 && me.ki >= DASH.cost + 15 && s.t >= mem.nextDash && Math.random()<0.25) { mem.nextDash=s.t+90; return 'dash_forward'; }
 if (s.dist > 500 && Math.random()<0.2) return 'guard';
 return 'forward';
}
```
If o.state==='guard' far, beam? We exclude beam if guard? Actually beam on guard chips120, good. Why exclude? Maybe because guard gives +2 ki but chip huge. Should use beam if opponent guard far and we have ki. But if they guard, they may be expecting beam; still 120. Use if o.state==='guard' and me.ki>=70. Add. In beam condition, if o.state==='guard' maybe 0.25 if me.ki>=80. But beam can be heavy? They guard, no heavy. Good. Let's modify: beam if o.hp<=chip OR (me.ki>=80 && (o.state!=='guard'? random0.18 : Math.random()<0.3)). But if opp guard, beam chip. Use.

Blast on guard chip12 not great but maybe. okay.

`midRange(s)`:
```
function midRange(s) {
 var me=s.me,o=s.opp;
 if (s.timeLeft < 900 && me.hp > o.hp) { if(s.wallBehind>90) return 'back'; return 'guard'; }
 if (o.state==='charge') { if(me.ki>=BLAST.cost && !me.blastOut && Math.random()<0.5) return 'blast'; return 'forward'; }
 if (me.ki >= BLAST.cost && !me.blastOut && s.t >= mem.nextBlast) {
   if (o.state==='guard' || o.state==='charge' || Math.random()<0.15) { mem.nextBlast=s.t+90; return 'blast'; }
 }
 if (me.hp < o.hp - 120 && me.ki >= DASH.cost + 10 && s.t >= mem.nextDash && Math.random()<0.3) { mem.nextDash=s.t+80; return 'dash_forward'; }
 var desired = 170;
 if (me.hp > o.hp && s.timeLeft < 1500) desired=260;
 if (me.hp < o.hp) desired=120;
 if (s.dist > desired + 30) return 'forward';
 if (s.dist < desired - 30 && s.wallBehind > 80) return 'back';
 return Math.random()<0.35 ? 'guard' : 'idle';
}
```
If desired 170 and dist 150, maybe back; but dist<=heavy reach? midRange called >140, so 150. Back creates space. Good.

`closeRange(s)`:
```
function closeRange(s) {
 var me=s.me,o=s.opp,d=s.dist;
 if (s.timeLeft < 600 && me.hp > o.hp) { if(s.wallBehind>80) return 'back'; return 'guard'; }
 if (o.state==='guard') {
   if (d <= HEAVY.reach && Math.random()<0.7) return 'heavy';
   if (d <= LIGHT.reach) return 'light'; // maybe blocked
   return 'forward';
 }
 if (o.state==='charge') {
   if (d <= LIGHT.reach) return 'light';
   if (d <= HEAVY.reach) return 'heavy';
 }
 if (o.state==='dash') {
   return 'guard'; // wait? If moving away, maybe forward. defense handled closing.
 }
 // weighted
 var w=[];
 if (d <= LIGHT.reach) add light 55 else 0;
 if (d <= HEAVY.reach) add heavy 18 else 0;
 add guard 20;
 if (s.wallBehind > 80) add back 10; else add dash_forward if ki? 
 add forward d>LIGHT.reach ? 12 : 4;
 if (me.ki >= DASH.cost && s.wallBehind < 80 && Math.random?<) maybe direct dash_forward? Weighted.
 // tendencies adjust
 var counts=mem.acts; total...
 var pGuard=(counts.guard+1)/(total+7); etc.
 if (pGuard>0.3) heavy *=1.5;
 if (pHeavy>0.25) { light*=1.3; guard*=0.6; }
 if (pLight>0.3) { guard*=1.5; heavy*=0.7; }
 if (pCharge>0.2) { light*=1.5; heavy*=1.3; }
 if (pBeam>0.2) { guard*=1.2; } // not close maybe
 if (me.hp < o.hp - 150) { light*=1.3; heavy*=1.3; guard*=0.7; }
 if (s.timeLeft < 900 && me.hp > o.hp) { guard*=2; back*=2; light*=0.5; heavy*=0.5; }
 if (s.wallBehind < 80 && me.ki >= DASH.cost) add dash_forward 15;
 var act=weighted(w); if(act) return act;
 return 'guard';
}
```
Need not call Math.random for direct in guard branch? Fine.

If d<=heavy but >light, light weight 0. Heavy weight maybe. If opp likely light, heavy weight reduced. Guard weight. If choose forward when d>light? But closeRange d<=140; if d 120, forward reduces to light but may be hit. okay.

If wallBehind <80, back weight0; add dash_forward if ki. If no ki, maybe attack.

Tendency counts need initialize all. Compute total:
```
var total = 0; for k in mem.acts total += mem.acts[k];
var p = function(k){ return ((mem.acts[k]||0)+1)/(total+7); };
```
Use weights as numbers; adjust by multiplying. Weighted function handles.

Need avoid choosing blast/beam in closeRange due startup. Not.

What about using heavy vs opponent blockstun? Punish handles. If opponent guard state, heavy. Good.

Potential issue: In `defense`, if opp beam startup, we return guard even if we are in close and could heavy crush? Opp committed beam, guard safe. But if we are close and rem > heavy startup, we return heavy before guard. Good.

Potential issue: If opp beam startup and we return guard, we may be stuck guarding through startup and fire, taking chip. But if we have ki and could dash_forward but cooldown mem.nextDash prevents? For emergency anti-beam, don't enforce cooldown? We used s.t >= mem.nextDash. If dash was used recently, maybe can't anti-beam. But cooldown just to avoid spam; emergency should bypass? Could set no cooldown for beam startup? Maybe use if ki enough regardless, but repeated dashes drain. Keep but short cooldown 60. If opponent beam every 100 ticks, okay. If need, maybe ignore cooldown when rem >23 and dist<=320? I'd allow always for anti-beam because important. Remove cooldown for defensive dash? But could dash too much. Maybe set mem.nextDash but still if `s.t >= mem.nextDash || o.state==='beam'`. Simpler: no cooldown in defense for beam/heavy/blast? Could deplete ki. But defense important. Use condition `me.ki >= DASH.cost + 5` to keep some. For heavy startup dash_back, use if ki>=10. Okay.

Maybe add ki reserve: don't offensive dash/blast if ki low; defense can spend.

Need ensure dash_forward anti-beam has wallAhead >? If wallAhead small (opponent near wall?), dash may pass? If wallAhead is distance to wall in front (toward opponent). If small, dash_forward may hit wall, not close? But if opponent near wall, dash_forward may pass? Need room behind opponent. If wallAhead small, maybe no room behind; dash stops in front. Still closes. Use no wallAhead requirement? For anti-beam, need close; if dash stops at minGap, okay. If wallAhead small and no room behind, stops in front dist60. Good. Remove wallAhead requirement. For offensive dash, maybe check wallAhead > 150 to avoid corner? Not essential.

Dash_back when wallBehind small? It moves into wall, maybe no effect. In heavy defense, if wallBehind <=120 choose dash_forward. In beam firing defense, if wallBehind >150 dash_back else dash_forward if close.

Incoming blast dash_forward: if wallAhead? If opponent far, okay. Maybe no.

Now, test some scenarios with code logic.

Scenario: Opp opens heavy at close? Start dist300, heavy whiffs. We forward. At t maybe when dist140, opp heavy startup. defense heavy: dist<=140, if dist<=110 and rem>5 maybe light; else dash_back/forward. If ki, dash. Good.

Scenario: Opp guard at close. closeRange o.state guard -> 70% heavy. Good.

Scenario: Opp light spam. closeRange if o.state light startup defense guard. If they recover, punish? Light recovery left9; if dist<=110 and left>5, punish light. So after blocking light, we may punish. But if we are in guard state, at next ask after blockstun? Light blocked: defender blockstun11, attacker recovery9. Defender (us) becomes free maybe at same/after? If we guarded, after blockstun free immediate ask. Opp may be recovery left? punish can light if left>5. Good.

Scenario: Opp blast spam. incoming defense guard. After guard blockstun14, opp blast recovery maybe? If close, punish? Blast recovery total18 after startup; projectile travel. When blast blocked, attacker may still recovery or free depending distance. If close, punish maybe. Good.

Scenario: Opp beam. Anti-beam as above. If we guard and chip, after beam? Opp recovery20, we blockstun maybe long. Could be unable punish. But okay.

Potential problem: `defense` returns guard for opp beam startup even if we are in `me.state==='charge'`? We are free, can change. Good.

Now, need think about deterministic Math.random. Weighted uses random; if random returns same sequence each match seeded. Fine. But if exception in weighted due empty? Ensure return fallback.

Implement weighted:
```
function weighted(list) {
 var total=0; for (var i=0;i<list.length;i++) if (list[i][1] > 0) total += list[i][1];
 if (total <= 0) return null;
 var r = Math.random() * total;
 for (...) { var w=list[i][1]; if (w <=0) continue; if (r < w) return list[i][0]; r -= w; }
 return list[list.length-1][0];
}
```

Need ensure list weights not negative after adjustments. Use `Math.max(0, w)`.

Maybe closeRange weights adjustment code:
```
var wLight=..., wHeavy=..., etc.
// multiply
wLight = Math.max(0, wLight * mult);
...
return weighted([['light',wLight],...]);
```

Tendency functions: Use counts maybe undefined. Initialize mem.acts with zeros. Total.
```
function prob(name) { return ((mem.acts[name]||0)+1)/(total+7); }
```
Adjust if prob > threshold. Could overfit small sample; okay.

Could also adapt based on opponent current state: if o.state==='back', maybe forward/attack. If o.state==='forward', maybe guard/light. Add to closeRange weights:
```
if (o.state==='forward') { wGuard*=1.3; wLight*=1.2; }
if (o.state==='back') { wForward*=1.5; wLight*=1.2; }
if (o.state==='idle') {}
```

If o.state==='guard', we already heavy. If o.state==='charge', attack.

What if o.state==='beam' firing? defense handles. If o.state==='clash'? main clash.

Need maybe use `state.me.ki` before choosing cost. Weighted dash if `me.ki >= DASH.cost`. In neutral functions, check.

Potential issue with `state.me.blastOut`: if true, cannot blast. Check.

Now, let's consider if we should use `push` in clash only. If clashChoice returns non-push string, choose sets push false. If returns 'push', true. Good.

Could there be a bug: In clash, `state.me.free` false; main checks clash before free. Good.

Now, maybe need optimize for time. try/catch around main. If exception, returns guard. But if exception due RULES undefined? Then catch returns guard but R undefined? Top-level const R=RULES would throw before decide? If RULES undefined, file fails. Assume.

Need avoid using `for...of` maybe okay, but use simple loops for compatibility. Node modern. Fine.

Let's maybe run mental syntax.

Full code draft:
```
const R = RULES;
const LIGHT = R.light, HEAVY = R.heavy, BLAST = R.blast, BEAM = R.beam, DASH = R.dash, CLASH = R.clash;
let mem = { ... };
function decide(state) { try { return main(state); } catch(e) { return 'guard'; } }
...
```
Potential linter: `RULES` is global but not declared; okay.

Need ensure top-level `let` allowed. Yes.

Let's refine some numeric thresholds.

Defense beam startup: If dist <= LIGHT.reach and rem > LIGHT.startup, light. But if rem=6, light active5, hits at tick5 before fire tick6? Good. If rem=5, active same as fire? Might trade? Beam firing maybe hits same tick? Better not. Use > LIGHT.startup (5) not >=. If rem=6 okay. If rem=5 guard/dash. Heavy if rem>9.

Dash_forward anti-beam condition: rem > DASH.ticks + DASH.recovery + LIGHT.startup = 10+8+5=23. If rem=24, after dash free at rem6, light active5 before fire. Good. If rem=23, after free rem5, light active at fire tick maybe not. Use >23. Good.

If dist <=320. If dist=320, dash leaves dist120, light not in range! Wait dash reduces by 200 if dist>200, new dist=120, > light reach. So cannot light. Need dist <=310 for new dist<=110. But if dash passes/stops minGap? For dist320, after dash dist120; heavy reach140 could interrupt? Heavy startup9, after dash free rem? rem=24-18=6, heavy not. So dash fails. Need condition dist <= 310. If dist=310, new dist110. Good. If dash passes behind for dist<=200, dist60. So condition `s.dist <= 310`. But if wall/stage, maybe. Use 310.

If dist 300, rem30 at t0? dash leaves100, good. If rem24, leaves maybe100, light. Good.

Beam counter timeToHit: If dist=500, rem30, time=30+(420/30)=44, >38, beam. Our beam startup30, fires; their beam front reaches at44, clash likely before? Good. If dist=400, rem30, time=30+320/30=40.7 >38, beam. If dist=350, 30+270/30=39, >38, maybe. If rem25, 25+270/30=34<38, no. Good.

Beam firing defense eta: compute gap = (me.x - eb.front)*dir. If beam dir toward me. Suppose beam from left to right dir=1, me right of front, gap positive. eta = ceil((gap - body)/speed). If gap <= body, eta0 (covering). If eta <=7 dash. If eta > light startup and dist<=light, light. But if beam front covers us already, we may be hit this tick; choosing guard may reduce? In engine, decides before beams; if beam covers after movement? If already covers at view, maybe hit this tick. Guard can block if front. If not guard, bad. Return guard. Good.

Incoming blast eta: view eta computed with body. If eta <=12 guard. If eta=0? guard. If we choose guard, block. Good.

Heavy startup defense back estimate: `s.dist + 3*rem > HEAVY.reach + 10`. But if we choose back, we move at 3/tick; opponent heavy startup rem. However decision interval? We choose now; state back persists. If rem maybe 8, move 24. Good. If rem=3, move9. Use. But if we are not asked until after? We choose now. Good.

CloseRange weighted: If d<=HEAVY.reach but >LIGHT.reach, light weight 0. If heavy weight maybe 20. If opponent likely heavy, guard weight? Good.

Potential improvement: If opponent in blockstun/hitstun but defense sees incoming blast? If incoming blast, guard. okay.

Need maybe use `state.timeLeft` for beam usage: If timeLeft < BEAM.startup+fire? Starting beam may not finish. If timeLeft < 70, beam not useful. But can chip. Use if timeLeft > 100 maybe. Add in longRange beam condition `s.timeLeft > 120`.

Similarly blast startup+travel; if timeLeft < 50, no. Not critical.

Endgame lead: If timeLeft < 600 and hp lead, mid/long functions return back/guard. But defense/punish still can act. If opponent down and lead, maybe guard. Good.

If hp behind late: Need aggressive. In longRange, if hp behind, maybe beam/dash. In midRange desired=120. CloseRange weights if hp behind increase attacks. Could also if timeLeft < 300 and behind and ki>=50, beam regardless? Beam startup30 (0.5s), if timeLeft<30 maybe no. Add in neutral top:
```
if (s.timeLeft < 900 && me.hp < o.hp) {
  if (me.ki >= BEAM.cost && s.dist > 200 && s.timeLeft > 100 && s.t >= mem.nextBeam) return 'beam';
  if (me.ki >= DASH.cost && s.dist > 180) return 'dash_forward';
}
```
But beam can be guarded; if behind, chip helps. Use.

Need be careful not to override defense. Place after defense/punish? In neutral, before zones.

Maybe `neutral` top:
```
if (s.timeLeft < 900 && me.hp < o.hp) {
  if (me.ki >= BEAM.cost && s.dist > 220 && s.timeLeft > 120 && s.t >= mem.nextBeam && Math.random()<0.6) { mem.nextBeam=s.t+180; return 'beam'; }
  if (me.ki >= DASH.cost + 5 && s.dist > 180 && s.t >= mem.nextDash && Math.random()<0.5) { mem.nextDash=s.t+60; return 'dash_forward'; }
}
```
But if dist close, closeRange aggressive.

Now, maybe consider if we should use heavy as default punish instead of light to knockdown and create space. Light combos can lead to more damage but may be blocked if not cancel? Punish when opp vulnerable, light hit gives cancel. Good.

Potential bug: In `punish`, if o.state==='blockstun', left maybe 14. Light startup5, hit. Opp not guard, so hit. Good. If o in blockstun from our light? We didn't get cancel because blocked. Can punish with light? Yes. But after blockstun, they may be pushed? Distance maybe. Good.

Potential bug: `o.invulnerable` true for dash moving and down/ko. If opp dash recovery, invulnerable false? invuln function only dash t<invuln; recovery t>=10 so false. Good.

Potential bug: `state.opp.phase` for hitstun etc null. okay.

Let's think about possible memory leak/time? small.

Now, maybe need include `push` action in ACTIONS? Only in clash. If clashChoice returns 'push' or 'idle'. Good.

Let's maybe improve clashChoice with simulation? Could estimate expected point movement if push. But threshold enough.

ClashChoice code:
```
function clashChoice(s) {
 var c=s.clash, me=s.me, opp=s.opp;
 var pos=c.pos;
 var myNo=basePower(me), oppNo=basePower(opp);
 var myPush = myNo + (me.ki > 0 ? CLASH.pushPower : 0);
 var oppPush = oppNo + (opp.ki > 0 ? CLASH.pushPower : 0);
 var oppPushing = c.oppPower > oppNo + 0.25;
 var mePushing = c.myPower > myNo + 0.25;
 if (pos < 0.18) return me.ki > 0 ? 'push' : 'idle';
 if (pos > 0.85) return 'idle';
 if (s.clash.t > 300) {
   if (opp.hp <= CLASH.draw && me.hp > CLASH.draw && pos > 0.35) return 'idle';
 }
 if (!oppPushing) {
   if (pos < 0.6 && me.ki > 5 && myPush > oppNo + 0.05) return 'push';
   if (pos < 0.45) return me.ki > 0 ? 'push' : 'idle';
   return 'idle';
 } else {
   if (pos < 0.5 || me.ki > opp.ki + 6) return me.ki > 0 ? 'push' : 'idle';
   if (pos > 0.65) return 'idle';
   return me.ki > opp.ki ? 'push' : 'idle';
 }
}
```
But if oppPushing false and pos<0.6, push; might push too much. If pos 0.55 and myPush barely > oppNo, push. okay. If pos 0.7, idle. If oppPushing true and pos0.6, me.ki not > opp+6, returns idle? pos>0.65? no, then me.ki>opp.ki? maybe. Good.

`basePower(f)` uses `f.hp < CLASH.rageHp * R.hp`. If f.hp negative? view max0. okay.

Need know `CLASH.draw`=120. Good.

Now, potential issue: In view, `state.clash.myPower` includes current push flag. We compute oppPushing by comparing to oppNo. But if opp.ki=0 and push flag true, power empty no pushPower, comparison false. Good.

Now, maybe use `state.opp.ki` for ki advantage. Good.

Let's consider if in clash and me.ki=0, pos low. basePower empty0.5+rage. If push returns push but no power. No harm, but if ki=0, push flag no cost. Could still return push but no effect. Return idle maybe. If pos<0.18 and ki=0, returning idle; maybe if rage power > opp? But push no effect. okay.

Now, think about if we choose 'charge' in neutral and then defense next ask? If opponent starts beam, we will see and change. But between asks 6 ticks, charge vulnerability. okay.

Potential exploit: Opponent can throw heavy at guard. Our closeRange if o.state guard heavy. But if opponent is actually in guard state because they held guard, heavy. If they release guard and attack, we may lose. But weighted. Could use memory pGuard. If pGuard high, heavy. If pLight high, maybe guard. In guard branch, maybe use pGuard: if pGuard >0.35 heavy 80%, else mix. But current fixed 70. Fine.

Maybe add if opponent ki high and guard? They may beam? Not.

Need ensure all functions defined before use? JavaScript function declarations hoisted. Top-level const R before. decide uses main defined later? Function declaration hoisted, but main uses functions defined later hoisted too. okay.

Let's consider if `state.me.free` false in cancel? For canCancel, me.state light not free. main checks canCancel before free. Good.

Potential issue: If decide called during clash, `state.me.free` false, but clash first. Good.

Now, could there be a stronger strategy using beam clash pushing? Our clash maybe okay.

Let's maybe test code snippets mentally for syntax with `var` and `let`. Avoid reserved words. `state` object. Use `Math.random`.

Need final reply only code block and declaration line. No extra explanation. Ensure declaration <=20 chars? Chinese count maybe. "武道会，我来了！" 8? Need 20 字以内. Could write "以气会友，点到为止。" 10? Good. But maybe need line exactly `赛前宣言：...`. Use <=20 Chinese chars after colon. "以气会友，点到为止。" okay.

Now, let's think if code could be too long? Fine.

Let's further analyze game for potential fatal flaws.

1. Beam startup response returns guard always if no interrupt. If opponent feints? Beam cannot cancel, so guard. If opponent doesn't actually beam? We only see state beam startup, so real. Good.
2. If opponent starts beam and we guard, we take 120 chip. If they beam repeatedly, we lose. But our beam counter when ki>=50 and far, dash when close. After first chip, ki increases. Starting 30, guard chip120 gives +9.6 damage taken +2 block + passive during ~70 ticks ~2.5, total ~44. Need another ~6 for 50. Passive. Could counter second. If opponent beam at midrange dist<=310, dash punish. If far, beam counter/guard. Maybe okay.
3. If opponent heavy rush close, our defense dash uses ki. Starting ki30 enough. If ki spent, guard crush 60. Could lose. But close mix light may interrupt.
4. If opponent light pressure, guard blocks, punish. Good.
5. If opponent charges, we attack/blast. Good.
6. If opponent runs away and time, we lead? If we lead, back/guard. If behind, dash/beam.

Could there be issue with `midRange` desired back causing us to avoid combat when hp equal, leading to time draw. Draws half win, okay but not max. If equal and time low, guard. If equal early, desired170, approach to close. Good.

Maybe we should use `forward` more to avoid draws. But win rate requires wins. Close mix enough.

Let's think about stage boundaries and facing. `wallAhead` is distance to stage edge in facing direction (toward opponent). If opponent is between me and wall? wallAhead maybe small if opponent near wall? Actually facing toward opponent; wallAhead distance from me to wall in front. If opponent near wall and I'm facing them, wall beyond them, wallAhead maybe distance to wall behind opponent. Dash_forward through might need room behind opponent, which is wallAhead - dist? If wallAhead small, no room behind. Our anti-beam dash doesn't check; if no room, stops in front. okay.

If we choose dash_back when wallBehind small, may not move. In heavy defense, choose dash_forward if wallBehind<=120. Good. In beam firing defense, dash_back only if wallBehind>150 else dash_forward if close. Good.

In incoming blast defense, dash_forward if dist>180. If wallAhead small (opponent near wall), dash may stop in front; still maybe phase blast? okay.

Now, maybe implement `enemyBeam` find: If multiple beams? There can be at most two, but during clash null? state.beams empty in clash? If clash, main clash. If enemy beam and my beam but no clash? Could happen if same direction? Not. Use loop.

`incomingBlast` find: If multiple, choose smallest eta. Implement:
```
var inc=null;
for (...) { var b=s.blasts[i]; if (b.incoming && b.eta != null && (!inc || b.eta < inc.eta)) inc=b; }
```

Now, maybe need handle `state.blasts` where mine false but not incoming (passed). ignore.

Potential bug: In defense, if enemy beam firing and eta <=7, we may dash_forward/back. But if we choose dash, during dash invuln 9, beam may pass. Good. But if beam already covers (eta0), dash may not avoid because invuln? If invuln, beam hits? Code: if invuln, continue; if invuln ends while in beam, hit. Dash through beam might be safe if pass out of ray. If eta0 and dist<180 dash_forward through behind shooter; likely safe. If dash_back, moving away but beam front may still cover after invuln if not out. But okay. Guard fallback maybe would block. If hp <= chip, dash maybe better. We choose dash regardless hp if eta<=7. Could waste ki but avoids 280. Good.

Potential bug: If enemy beam firing and we are in range light but eta >5, return light. But if we choose light, we may be hit by beam during startup if eta=6? Beam front moves 30/tick; eta computed ticks until body contact. If eta=6, light active in5, we hit before beam reaches, interrupt. Good. If eta=5, active same tick as beam hit? Engine order: strikes then beams? In step: strikes(m); blasts(m); beams(m). If our light active and beam covers same tick, strikes processed before beams. If light hits shooter, state changes, then beams function may remove beam? Let's see: step order asks, move, strikes, blasts, beams. If our light active, strikes land before beams. If shooter in beam firing, land sets state hitstun, then beams function later: if m.beams[a.side] && (a.state !== 'beam') m.beams[a.side]=null, so beam doesn't hit. Thus if active same tick as beam would hit, light wins if strikes first. So eta >= LIGHT.startup maybe enough? If eta=5, active tick5, beam reaches tick5; strikes first, interrupt. So condition `eta >= LIGHT.startup` maybe. We used >. Conservative. Fine.

Similarly light vs heavy startup: strikes order both strikes; if both active same tick, both hit? For light active5, heavy active9. If rem=5, heavy active in5; our light active in5; both active same tick? If opponent heavy started earlier, at tick T+5 heavy active and our light active. strikes loop checks both; todo both then land both, trade. Light damage40 vs heavy120, bad. Need rem > LIGHT.startup to hit before heavy active? If rem=6, heavy active in6, our light active in5, we hit first. Good. Use >.

Light vs light startup: If both active same tick, trade. Guard better. Defense guard.

Now, punish `left > startup`. If left == startup, active same tick as opponent free? Step order: if opponent dur ends at end of tick. If left=startup at view, they will become free at end of tick? Let's simulate: opp left=L at start. If we start move startup S. At start T+S, our t=S active. Opp left at start T+S? It has decremented each end tick. If L=S, at start T+S opp.t = orig+S? It would have ended at end of T+S-1, so opp free at start T+S and may have acted. So active occurs when opp already free. Need left > S. Good.

Now, `o.left` for down: If left == startup, active after wake? Similar. Not using much.

Potential improvement: In `punish`, if o.state==='recover' (after clash win) left20, can attack. Good.

Now, let's consider if our bot might choose invalid action due to ki fractional. `me.ki >= DASH.cost` works. Ki can be float. Good.

Potential issue: Top-level `mem` persists across calls, but if engine calls decide multiple times in same tick? It shouldn't. Cancel extra call next tick. okay.

Potential issue: `Math.random()` used in weighted and neutral. If time budget, okay. But random could make bot non-deterministic across replays? Seed per match, same sequence if same calls. If our calls vary due random? The random influences decisions, but engine seed for Math.random? It says Math.random() seeded by match, same replay. Good.

Now, maybe need use `Date.now()`? no.

Let's maybe write final code with comments? Code block can include comments. Need not too huge but okay. Ensure no `console.log`.

Let's draft final code carefully.

Potential syntax issue: `const R = RULES;` If RULES is object frozen? okay.

Full code:
```
const R = RULES;
const LIGHT = R.light;
...
let mem = { ... };
function decide(state) { ... }
function main(s) { ... }
...
```

Let's write functions in order.

Need maybe define `MOVES`? Not necessary.

`update` counts opponent state transitions. If o.state==='dash', count dash. But key changes from moving to recovery; if count only on entry? Current code counts whenever key changes and state dash, so moving and recovery both count? We'll implement:
```
if (key !== mem.lastOppKey) {
 if (o.phase === 'startup') { if (o.state==='light'...) mem.acts[o.state]++; }
 else if (o.state==='guard') mem.acts.guard++;
 else if (o.state==='charge') mem.acts.charge++;
 else if (o.state==='dash' && o.phase==='moving') mem.acts.dash++;
 mem.lastOppKey = key;
}
```
Good.

`startupRem` if o.t maybe undefined? state includes. okay.

`defense` code with loops.

Let's write `enemyBeam` inline.

Detailed defense code final:
```
function defense(s) {
  var me = s.me, o = s.opp;
  var eb = null;
  for (var i = 0; i < s.beams.length; i++) if (!s.beams[i].mine) eb = s.beams[i];
  if (eb) {
    var dir = eb.dir;
    var gap = (me.x - eb.front) * dir;
    if (gap > -R.body) {
      var etaBeam = gap <= R.body ? 0 : Math.ceil((gap - R.body) / BEAM.speed);
      if (o.state === 'beam' && o.phase === 'firing') {
        if (s.dist <= LIGHT.reach && etaBeam >= LIGHT.startup) return 'light';
        if (etaBeam <= 7 && me.ki >= DASH.cost) {
          if (s.dist < 180) return 'dash_forward';
          if (s.wallBehind > 150) return 'dash_back';
          return 'dash_forward';
        }
        return 'guard';
      }
    }
  }
  var inc = null;
  for (var j=0; j<s.blasts.length; j++) { ... }
  if (inc && inc.eta <= 12) {
    if (me.ki >= DASH.cost + 5 && inc.eta <= 7 && s.dist > 180 && Math.random() < 0.35) return 'dash_forward';
    return 'guard';
  }
  if (o.phase === 'startup') {
    var rem = startupRem(o);
    if (o.state === 'beam') { ... return 'guard'; }
    if (o.state === 'heavy') { ... }
    if (o.state === 'light') { ... }
    if (o.state === 'blast') { ... }
  }
  if (o.state === 'dash' && o.phase === 'moving' && mem.lastOppX != null) {
    var delta = o.x - mem.lastOppX;
    var closing = delta * me.facing < -0.01;
    if (closing && s.dist < 220) return 'guard';
  }
  return null;
}
```
Note `mem.lastOppX` updated at end of update before defense? main calls update then defense. In update, mem.lastOppX set to current o.x at end. Then defense uses delta = current - last = 0. Oops. Need update memory after defense or store previous. We should update counts but not overwrite lastOppX before defense. Better: in update, compute delta using previous, store `mem.oppDelta = o.x - mem.lastOppX`, then set lastOppX. Defense uses mem.oppDelta. Let's modify.

`update`:
```
if (mem.lastT <0) { ... mem.lastOppX=o.x; return; }
mem.oppDelta = o.x - (mem.lastOppX == null ? o.x : mem.lastOppX);
...
mem.lastOppX = o.x;
```
Then defense uses `mem.oppDelta`. Good. Need initialize mem.oppDelta=0.

Also counts key before updating lastOppKey.

Beam startup response code:
```
if (o.state === 'beam') {
  if (s.dist <= LIGHT.reach && rem > LIGHT.startup) return 'light';
  if (s.dist <= HEAVY.reach && rem > HEAVY.startup) return 'heavy';
  if (me.ki >= DASH.cost + 5 && s.dist <= 310 && rem > DASH.ticks + DASH.recovery + LIGHT.startup) return 'dash_forward';
  if (me.ki >= BEAM.cost && s.timeLeft > 120) {
    var timeToHit = rem + Math.max(0, (s.dist - 80) / BEAM.speed);
    if (timeToHit > BEAM.startup + 8) { mem.nextBeam = s.t + 240; return 'beam'; }
  }
  return 'guard';
}
```
If rem maybe negative? phase startup, rem positive. Good.

Heavy startup:
```
if (o.state === 'heavy') {
  if (s.dist <= HEAVY.reach) {
    if (s.dist <= LIGHT.reach && rem > LIGHT.startup) return 'light';
    if (me.ki >= DASH.cost + 5) return s.wallBehind > 120 ? 'dash_back' : 'dash_forward';
    if (s.wallBehind > 60 && s.dist + 3 * rem > HEAVY.reach + 10) return 'back';
    return 'guard';
  } else if (s.dist <= HEAVY.reach + 60 && s.wallBehind > 60) {
    return 'back';
  }
}
```
If dist just outside heavy, back. Good.

Light startup:
```
if (o.state === 'light' && s.dist <= LIGHT.reach + 20) return 'guard';
```
If dist 120, light reach110, +20, guard. okay.

Blast startup:
```
if (o.state === 'blast' && s.dist <= LIGHT.reach && rem > LIGHT.startup) return 'light';
```

`punish` charge: If o.state==='charge', attack. But if o.state charge and phase null, o.free true. If we return light, okay. If dist>heavy, neutral handles forward/blast.

Punish code final:
```
function punish(s) {
 var o=s.opp, d=s.dist;
 if (o.state === 'charge') { ... }
 if (o.invulnerable) { ... return null; }
 var vulnerable = ...;
 if (vulnerable) { ... }
 if (o.phase==='startup' && o.state!=='beam' && o.state!=='light') { ... }
 return null;
}
```
If o.state==='charge', invulnerable false; we return before vulnerable. Good.

Down wake attack low probability:
```
if (o.state === 'down') {
 if (d <= LIGHT.reach && o.left <= 4 && Math.random() < 0.25) return 'light';
 if (d <= HEAVY.reach && o.left >= 5 && o.left <= 9 && Math.random() < 0.15) return 'heavy';
 return null;
}
```
But if left<=4, light active5, may hit after wake. If left=0? They get up this tick? decide maybe before free? If opp down left0 at view? They might be free next? Not sure. Low probability. Could cause whiff. Fine.

Vulnerable states: For o.state==='beam' phase recovery? Yes vulnerable. For o.state==='dash' phase recovery. Use `o.phase === 'recovery'` for moves. But for blast/beam phase recovery, yes. For light/heavy active? Not vulnerable. For o.state==='clash'? not. For o.state==='recover', phase null? state recover is not move; vulnerable. Good.
```
var vulnerable = (o.state==='hitstun' || o.state==='blockstun' || o.state==='crushed' || o.state==='recover' || ((o.state==='light'||o.state==='heavy'||o.state==='blast'||o.state==='beam'||o.state==='dash') && o.phase==='recovery'));
```
If o.state==='dash' phase recovery, yes.

If vulnerable and d<=light and left>5, light. But if left maybe 0? skip. If d>light and <=heavy and left>9 heavy. If d<=light and left<=5 but o in long hitstun? left small means stun ending soon; maybe skip. If d<=heavy and left<=9 but >5, light maybe? If d>light cannot light. skip.

Startup interrupt for heavy/blast: defense may already. But if defense heavy returns guard because no ki, punish might return light if rem>5? Defense heavy would return light first if rem>5. If rem<=5, punish not. okay.

`neutral` code. Need call `canCharge` before long? If canCharge true, return charge. But if opp beam startup, defense would have handled before neutral. Good.

Neutral:
```
function neutral(s) {
 var me=s.me, o=s.opp;
 if (s.timeLeft < 900 && me.hp < o.hp) {
   if (me.ki >= BEAM.cost && s.dist > 220 && s.timeLeft > 120 && s.t >= mem.nextBeam && Math.random() < 0.55) { mem.nextBeam=s.t+200; return 'beam'; }
   if (me.ki >= DASH.cost + 5 && s.dist > 180 && s.t >= mem.nextDash && Math.random() < 0.45) { mem.nextDash=s.t+80; return 'dash_forward'; }
 }
 if (o.state === 'charge') { ... } // maybe punish already? punish charge returns if in range; if out range, here.
 if (o.state === 'guard') { ... }
 if (canCharge(s)) return 'charge';
 if (s.dist > 320) return longRange(s);
 if (s.dist > HEAVY.reach) return midRange(s);
 return closeRange(s);
}
```
But punish charge returns if d<=light/heavy. If d>heavy, neutral o.state charge: use blast or forward.
```
if (o.state==='charge') {
  if (me.ki >= BLAST.cost && !me.blastOut && s.dist > HEAVY.reach && Math.random()<0.55) return 'blast';
  return 'forward';
}
```
If o.state guard and d>heavy, maybe blast/beam. If d<=heavy, closeRange handles heavy. But neutral guard branch before zones:
```
if (o.state === 'guard') {
  if (s.dist <= HEAVY.reach) return closeRange(s); // or heavy
  if (me.ki >= BLAST.cost && !me.blastOut && Math.random()<0.3) return 'blast';
  if (me.ki >= BEAM.cost && s.dist > 300 && Math.random()<0.3) return 'beam';
  return 'forward';
}
```
But if closeRange called, it may return heavy. Good.

If o.state==='dash' moving away, neutral maybe forward. Defense closing guard. If not closing, closeRange maybe guard if dist<=140. Could instead forward if dash away. Not critical.

`leadClose` integrated in long/mid/close. Maybe no separate.

LongRange final:
```
function longRange(s) {
 var me=s.me,o=s.opp;
 if (s.timeLeft < 900 && me.hp > o.hp) { return s.wallBehind > 120 ? 'back' : 'guard'; }
 if (o.state === 'charge') { ... }
 if (me.ki >= BEAM.cost && s.timeLeft > 120 && s.t >= mem.nextBeam) {
   var beamChance = 0;
   if (o.hp <= BEAM.chip) beamChance = 1;
   else if (o.state === 'guard') beamChance = me.ki >= 80 ? 0.35 : 0.12;
   else beamChance = me.ki >= 75 ? 0.2 : 0.07;
   if (Math.random() < beamChance) { mem.nextBeam=s.t+240; return 'beam'; }
 }
 if (me.ki >= BLAST.cost + 10 && !me.blastOut && s.t >= mem.nextBlast) {
   if (o.state === 'charge' || o.state === 'guard' || Math.random() < 0.12) { mem.nextBlast=s.t+100; return 'blast'; }
 }
 if (canCharge(s)) return 'charge';
 if (me.hp < o.hp - 100 && me.ki >= DASH.cost + 15 && s.t >= mem.nextDash && Math.random() < 0.25) { mem.nextDash=s.t+90; return 'dash_forward'; }
 if (s.dist > 520 && Math.random() < 0.18) return 'guard';
 return 'forward';
}
```
Note canCharge called in neutral before long, but also here after blast? okay. Might duplicate. Remove in neutral or long. Keep in neutral before zones? If neutral canCharge returns before long, okay. Remove from long to avoid double? But if neutral canCharge false, long canCharge false. Remove. But maybe charge more likely in long; canCharge handles dist. Use neutral only. So long no canCharge. But if we removed? We'll keep canCharge in neutral before zone. Long no.

MidRange:
```
function midRange(s) {
 var me=s.me,o=s.opp;
 if (s.timeLeft < 900 && me.hp > o.hp) return s.wallBehind > 90 ? 'back' : 'guard';
 if (o.state === 'charge') { if (me.ki>=BLAST.cost && !me.blastOut && Math.random()<0.5) return 'blast'; return 'forward'; }
 if (me.ki >= BLAST.cost && !me.blastOut && s.t >= mem.nextBlast) {
   if (o.state === 'guard' || o.state === 'charge' || Math.random() < 0.14) { mem.nextBlast=s.t+90; return 'blast'; }
 }
 if (me.hp < o.hp - 120 && me.ki >= DASH.cost + 10 && s.t >= mem.nextDash && Math.random() < 0.3) { mem.nextDash=s.t+80; return 'dash_forward'; }
 var desired = 170;
 if (me.hp > o.hp && s.timeLeft < 1500) desired = 260;
 if (me.hp < o.hp) desired = 120;
 if (s.dist > desired + 30) return 'forward';
 if (s.dist < desired - 30 && s.wallBehind > 80) return 'back';
 return Math.random() < 0.35 ? 'guard' : 'idle';
}
```

CloseRange:
```
function closeRange(s) {
 var me=s.me,o=s.opp,d=s.dist;
 if (s.timeLeft < 600 && me.hp > o.hp) { if (s.wallBehind > 80) return 'back'; return 'guard'; }
 if (o.state === 'guard') {
   if (d <= HEAVY.reach && Math.random() < 0.72) return 'heavy';
   if (d <= LIGHT.reach) return 'light';
   return 'forward';
 }
 if (o.state === 'charge') { return d <= LIGHT.reach ? 'light' : (d <= HEAVY.reach ? 'heavy' : 'forward'); }
 if (o.state === 'dash') { return 'guard'; }
 var total=0; for (var k in mem.acts) total += mem.acts[k];
 function p(name){ return ((mem.acts[name]||0)+1)/(total+7); }
 var wLight = d <= LIGHT.reach ? 55 : 0;
 var wHeavy = d <= HEAVY.reach ? 18 : 0;
 var wGuard = 20;
 var wBack = s.wallBehind > 80 ? 10 : 0;
 var wForward = d > LIGHT.reach ? 14 : 5;
 var wDash = (me.ki >= DASH.cost && s.wallBehind < 80) ? 14 : (me.ki >= DASH.cost && d > 110 ? 4 : 0);
 var pGuard=p('guard'), pHeavy=p('heavy'), pLight=p('light'), pCharge=p('charge'), pBeam=p('beam');
 if (pGuard > 0.28) wHeavy *= 1.6;
 if (pHeavy > 0.22) { wLight *= 1.35; wGuard *= 0.65; }
 if (pLight > 0.28) { wGuard *= 1.55; wHeavy *= 0.7; }
 if (pCharge > 0.18) { wLight *= 1.5; wHeavy *= 1.3; }
 if (pBeam > 0.18) wGuard *= 1.2;
 if (o.state === 'forward') { wGuard *= 1.25; wLight *= 1.15; }
 if (o.state === 'back') { wForward *= 1.5; wLight *= 1.25; }
 if (me.hp < o.hp - 150) { wLight *= 1.35; wHeavy *= 1.35; wGuard *= 0.7; wBack *= 0.4; }
 if (s.timeLeft < 900 && me.hp > o.hp) { wGuard *= 2; wBack *= 2; wLight *= 0.5; wHeavy *= 0.5; }
 if (o.hp <= 120) { wLight *= 1.4; wHeavy *= 1.4; }
 return weighted([['light',wLight],['heavy',wHeavy],['guard',wGuard],['back',wBack],['forward',wForward],['dash_forward',wDash]]) || 'guard';
}
```
If d<=light, wDash maybe if d>110 false, unless wallBehind<80. Good.

Could weighted choose 'forward' when d<=light, moving into opponent; okay. If choose 'back' with wallBehind>80, okay.

Potential issue: If `o.state==='dash'` and phase recovery, punish would have returned attack if vulnerable. If phase moving, closeRange guard. Good.

`canCharge` as above. Need ensure not charge when incoming threats? defense handled before neutral; but if no immediate, okay. If opp.state==='forward' and far, canCharge false. Good.

`weighted` ensure weights finite. If adjustments produce NaN? mem.acts numbers. okay.

Now, maybe top-level `mem.nextBeam` etc. Initial 0. If state.t maybe 0. Good.

Let's consider if using `for (var k in mem.acts)` includes prototype? mem.acts plain. okay.

Now, possible strategic flaw: We rarely use heavy except vs guard/punish out of light range/weighted. Heavy can be important to break guard. Good.

Could our bot get stuck guarding forever if opponent far and beam startup? It returns guard for beam startup; after beam fire/block, opponent state changes, defense no longer. Next ask maybe guard state; neutral may forward. Good.

If opponent also guards far, neutral may blast/beam/forward. If both guard, time out draw. But if opponent guard, our closeRange heavy when close. MidRange may blast. Good.

Now, think about if opponent uses dash_forward to cross behind. Our defense dash closing guard. But if they dash through, after recovery they may be behind; we guard front auto-face? If we are in guard, FREE, face each tick, so guard faces. If they attack from behind during our guard? They are in recovery until free; after free, they face us? If they dash through, during recovery they face old direction, but cannot attack. After recovery, they become free and asked; face? free() sets state idle; face called for FREE states after move? At step after free, maybe before ask? Engine order: time pass free at end tick; next step asks before move/face. So at ask, they may not have faced? But view facing maybe old. They can attack; we guard facing? We are FREE guard, face called previous ticks while guard; after they free, face hasn't updated this tick before ask? Step order: asks first, then move, face. So if they became free this tick, we also might be asked? If we are free, wants maybe. Both see same state before facing. If they are behind, our facing might still be old? Wait while guard FREE, face called every tick after move in previous ticks. When they dash through, our facing updates each tick while they move? face called for FREE states after move, so as they pass, our facing updates to their x. During dash moving, separate skipped, but face still updates if we FREE. So guard faces. Good.

Now, if we are in recovery and they dash behind, we can't turn. okay.

Potential bug in `dashEnd` crossup: Not relevant.

Now, maybe need handle `state.me.canCancel` when opponent hp low and dist > heavy but light? If d>140, return idle. Could maybe return blast if ki and d<=180. But not reliable. okay.

Let's consider combo damage and kill: cancelChoice uses scale from o.combo. But if o.combo maybe >5, scale last. Good. It uses `o.hp <= lightDmg` etc. If opp hp 100, d<=110, chain maybe1. It might choose light if d<=95 and chain<=2, not kill. If d 100, chain1, light. Could heavy kill? heavyDmg 96, not. Light then maybe. Good. If d 120, heavy. If d 95, light chain; after second light push to109, maybe heavy. Good. If d 80, chain light until maybe threshold. But if chain=3 and d<=95, condition `me.chain <= 2` false, so heavy. Good. If d<=95 and chain1 but opp.hp > heavyDmg+lightDmg? heavyDmg96+lightDmg? We use condition `(me.chain <= 2 || o.hp > heavyDmg + lightDmg)`? Let's define precisely. In draft: `if (d <= LIGHT.reach && me.chain < LIGHT.chain && d <= 95 && (me.chain <= 2 || o.hp > heavyDmg + lightDmg)) return 'light';` This means chain1/2 light if d<=95; chain3 only if opp hp > heavy+light? Maybe. Good. But if chain3 and hp high, another light then heavy? chain3 means already 3 lights, can do 4th light then heavy? chain <4, yes. But after 4th cannot heavy? Actually after 4th light, chain=4, cancel can still heavy (unlimited). So light chain 4 then heavy possible if range. But push. Our condition may not. Fine.

Maybe simplify cancel: if d<=110 and chain<4 and d<=95 return light; else heavy if d<=140; else light if d<=110. Use kill checks. Good.

Let's implement cancelChoice final:
```
function cancelChoice(s) {
 var me=s.me, o=s.opp, d=s.dist;
 var scale = R.combo[Math.min(o.combo, R.combo.length-1)];
 var lightDmg = Math.max(1, Math.round(LIGHT.damage * scale));
 var heavyDmg = Math.max(1, Math.round(HEAVY.damage * scale));
 if (d <= LIGHT.reach && o.hp <= lightDmg) return 'light';
 if (d <= HEAVY.reach && o.hp <= heavyDmg) return 'heavy';
 if (d <= 95 && me.chain < LIGHT.chain && me.chain <= 2) return 'light';
 if (d <= HEAVY.reach) return 'heavy';
 if (d <= LIGHT.reach && me.chain < LIGHT.chain) return 'light';
 if (me.ki >= BLAST.cost && !me.blastOut && d <= 170) return 'blast';
 return 'idle';
}
```
If d<=95 but chain=3, goes heavy if d<=140. Good. If d>140 but <=170 and ki, blast maybe. But if blast invalid? check. Could be okay. If no, idle. If d>170, idle.

But if d<=95 and chain=0? canCancel after light chain at least1. okay.

Now, maybe need account `me.blastOut` in cancel blast. Good.

Now, let's think about if our bot uses beam and then enters clash. ClashChoice uses ki. If we start beam counter from far with ki50, after cost ki0? Wait beam cost50, if ki50 exactly, after start ki0. In clash, power empty0.5 unless rage, very weak. Bad! Need avoid beam if it leaves ki0 for clash. Condition should require `me.ki >= BEAM.cost + 20` maybe, so after cost have ki. Important. Starting beam with exactly50 leads to clash with power0.5 vs opponent maybe also 0 if they spent50? Opponent beam cost also maybe had ki. If both spent to 0, both empty 0.5, random. But if opp had >50, they have power. Better keep reserve. Adjust beam usage: require `me.ki >= BEAM.cost + 20` for offensive/counter beam. If hp low and need chip maybe still? But clash weak. Use +20. However if we don't beam, guard chip. Let's set beam conditions `me.ki >= BEAM.cost + 15`. In beam startup counter, if timeToHit, require +15. In longRange, require +15. In behind late, require +10 maybe. Good.

Similarly dash costs10; if ki exactly10, after dash no ki for clash? Not relevant. But keep +5 for offensive, defense can spend.

Modify beam conditions: `me.ki >= BEAM.cost + 15`. If me.ki 65, after cost15. Power 1+0.3=1.3. okay. If opp spent50 leaving maybe0, advantage. If both had 65, both 15. Good.

Beam chip on guard: if opp hp<=120, even if we have only50, maybe use to kill. Could allow if o.hp<=BEAM.chip and me.ki>=BEAM.cost. If kill, no clash likely? Opp may guard and die; if they beam? If they have beam? If opp hp low, okay. Use separate.

Update longRange beam:
```
if (me.ki >= BEAM.cost && s.timeLeft > 120) {
 if (o.hp <= BEAM.chip) chance=1;
 else if (me.ki >= BEAM.cost + 20) chance=...
}
```
Beam startup counter: if o.hp? Opp not low? require +15.

Behind late beam: if me.ki>=BEAM.cost+10.

Clash after beam if we had enough.

Also blast cost20; if ki low, maybe not. Use +10 offensive.

Charge can build ki. Good.

Now, if opponent beam startup and we have ki>=50 but <65, our beam counter condition false; we guard. Could take120. Maybe if hp behind and need, could beam with less. But risk clash weak. Maybe if opp.hp <=120 use. Otherwise guard. okay.

Now, heavy crush damage 60 on guard; if opponent hp<=60 and guarding, heavy kills. closeRange guard branch heavy. Good.

Light kill if hp<=40. weighted increases if opp.hp<=120. Good.

Now, perhaps implement `canCharge` if me.ki<50 and opp far. But if we have hp lead, charging risky. Maybe only if timeLeft>1200. okay.

`canCharge` final:
```
function canCharge(s) {
 var me=s.me,o=s.opp;
 if (me.ki >= 75 || s.timeLeft < 1200) return false;
 if (o.state === 'down' && o.left > 25 && s.dist > 240) return true;
 if (s.dist > 480 && s.wallBehind > 150 && o.ki < 45 && (o.state === 'idle' || o.state === 'guard' || o.state === 'charge' || o.state === 'back') && Math.random() < 0.22) return true;
 return false;
}
```
If o.state back moving away, safe-ish. If o.ki<45 no beam. Good.

Now, maybe need use `state.me.state` in neutral? If we are currently charge and asked, canCharge may return false, then choose forward. Good.

Potential issue: If we choose 'charge' and then next ask 6 ticks later, canCharge may return true again, continue. If opponent starts moving forward, o.state forward, canCharge false, choose forward/guard. Good.

Now, let's consider if our bot can be time-disqualified due to too many Math.random or loops? No.

Need maybe avoid `for...in` total each closeRange; small.

Now, maybe test some random state manually.

State: clash pos0.4, myPower2.0 oppPower2.0, me.ki50 opp50. basePower myNo=2, oppNo=2, oppPushing? c.oppPower 2 >2.25 false. pos<0.6 and me.ki>5 and myPush2.6>2.05 => push. Good. Next calls if opp not push, point moves. If opp pushes, oppPower2.6 >2.25 true, pos maybe0.45, me.ki equal not >+6, pos<0.5 => push. So both push. If pos0.6, opp pushing, me.ki equal, pos not<0.5, not >0.65, return me.ki>opp? false => idle. So if opp pushes and point mid-high, we stop, allowing point move toward us? If pos0.6 (away from me), opp push moves toward me (pos decreases). Stopping conserves ki; if pos drops <0.5, push. Good.

If pos0.2, my ki0, opp ki0. base empty maybe0.5. pos<0.18? no if0.2. oppPushing false, pos<0.6 and me.ki>5 false, pos<0.45 return me.ki>0? false idle. Could lose random. But no ki, push no effect. okay.

Now, potential issue: In clash, if me.ki>0 but very low (1), pushing costs 0.6/tick, after 2 ticks ki0, power drops. If pos low, necessary. If pos mid, maybe not. Conditions me.ki>5 for opportunistic push. If pos<0.45, push if ki>0. Could deplete. okay.

Now, maybe need handle `state.timeLeft` in clash: If timeLeft small and hp lead, maybe don't push if pos safe. Our t>300 check only. Clash max360; if t>300 and opp hp<=120, idle. If timeLeft small but clash t maybe not >300? Match time may end during clash? Engine end checks after step; if tick >= maxTicks, over even in clash? end(m) after clashTick. If time expires during clash, winner by hp. If hp lead, maybe want survive. Pushing could lose 320. If pos>0.5, idle. If pos<0.5, push. Good.

Now, consider if opponent HP <=120 and my HP <=120 in clash; explosion would double KO? If both <=120, double KO draw? If match time? Maybe avoid. Our t>300 idle only if me.hp >120. If both low, maybe push to win? If pos mid, random. okay.

Now, let's think about if our bot returns 'guard' while in `me.state==='forward'` and defense sees beam startup. choose changes state to guard. Good.

Potential issue: If action invalid due to no ki, state remains previous. Example neutral behind chooses dash_forward with ki>=DASH.cost+5? okay. If chooses beam with ki>=cost+15 okay. If chooses blast with ki>=cost+10 okay. Weighted dash checks. Incoming blast dash checks ki+5. Heavy defense dash checks ki+5. Beam firing dash checks ki. If ki exactly10, allowed. Good.

If `blast` chosen when me.blastOut true? Conditions check. Cancel blast checks. Good.

If `beam` chosen in beam startup counter with me.ki>=cost+15, okay. If not, guard. Good.

Now, maybe need fallback if weighted returns 'dash_forward' but ki changed? It checks at weight creation. okay.

Let's consider if `state.me.free` false but canCancel true? main returns cancelChoice. If cancelChoice returns 'blast' but me.blastOut false and ki enough. If blast action invalid due to previous blast? check. Good.

Now, possible issue: In `main`, after update, if s.clash, return clashChoice. But update counts opp state clash? Not needed. If s.clash, state.opp.state 'clash'. update key may count? It only counts startup/guard/charge/dash. okay.

Now, maybe need use `state.me.canCancel` before clash? If clash no cancel. okay.

Potential strategic improvement: When opponent is in hitstun and we are not in cancel (e.g., blast hit), punish chooses light if close. Light hit starts combo. Good.

Now, let's think about if our bot can infinite guard and lose to heavy. CloseRange adapt pHeavy reduces guard, increases light. But if opponent heavy state startup, defense dash/guard. If they use heavy on guard, we may guard because pHeavy not enough. Could lose. But mix.

Could we detect opponent heavy tendency within same match quickly? If they use heavy once, pHeavy with smoothing ~ (1+1)/(1+7)=0.25, threshold0.22, adjusts. Good.

If they guard once, pGuard0.25 threshold0.28 no; after few. okay.

Now, maybe need count opponent held states duration? If they turtle guard, we see guard state each decision but key only changes once, count 1. pGuard low. But closeRange sees o.state==='guard' directly and heavy 72%. Good. Tendency less important.

If they spam light, key changes each light startup, count. Good.

Now, consider if opponent always forward and never attacks; closeRange o.state forward increases guard/light. We attack. Good.

Now, maybe need use `state.opp.free`? Not directly. If opp.free and state idle/forward/back/guard/charge. Our logic uses state. If opp.free but state idle, weighted. Good.

Now, possible bug: `state.opp.state` can be 'ko'. If KO, match over maybe no decide. If not, ignore.

Now, let's think about if engine asks during `me.state==='clash'` but state.clash null? Not. okay.

Now, maybe need include semicolons. Fine.

Let's maybe write final code in one block. Before final, review for syntax errors.

Code draft:
```
const R = RULES;
const LIGHT = R.light;
...
let mem = {
  lastT: -1,
  lastOppKey: '',
  lastOppX: null,
  oppDelta: 0,
  acts: { light:0, heavy:0, blast:0, beam:0, guard:0, charge:0, dash:0 },
  nextBeam: 0,
  nextBlast: 0,
  nextDash: 0
};

function decide(state) { ... }
...
```

In `update`, if mem.lastT<0, set lastT and lastOppX and return. But then counts not. okay.
```
function update(s) {
  var o = s.opp;
  if (mem.lastT < 0) {
    mem.lastT = s.t;
    mem.lastOppX = o.x;
    return;
  }
  mem.oppDelta = (mem.lastOppX == null) ? 0 : o.x - mem.lastOppX;
  var key = o.state + ':' + (o.phase || '');
  if (key !== mem.lastOppKey) {
    if (o.phase === 'startup' && (o.state === 'light' || ...)) mem.acts[o.state]++;
    else if (o.state === 'guard') mem.acts.guard++;
    else if (o.state === 'charge') mem.acts.charge++;
    else if (o.state === 'dash' && o.phase === 'moving') mem.acts.dash++;
    mem.lastOppKey = key;
  }
  mem.lastT = s.t;
  mem.lastOppX = o.x;
}
```
If o.state dash phase moving, key changes to dash:moving count. If phase recovery, no count. Good.

`startupRem` uses o.t. If o.phase startup but o.t maybe > startup? not. Return max0.

`defense`: Need ensure `etaBeam >= LIGHT.startup` if eta maybe null? no.

In incoming blast: `if (inc && inc.eta != null && inc.eta <= 12)`. If eta null? incoming true should have eta number, but check.

In beam startup counter, `var timeToHit = rem + Math.max(0, (s.dist - 80) / BEAM.speed);` dist and speed numbers. Good.

In heavy startup, if me.ki >= DASH.cost + 5 but wallBehind >120 dash_back else dash_forward. If dash_forward when close and heavy, could pass through. Good.

In light startup defense, if dist <= LIGHT.reach + 20, guard. If opponent light startup but dist 130, light whiffs; guard maybe unnecessary. okay.

In `punish`, vulnerable includes `o.state === 'dash' && o.phase === 'recovery'`. But if o.state dash phase moving, invulnerable true? invuln true if t<9; if t>=9 moving but not invuln? Engine invuln dash t<invuln (9). Dash moving lasts10, so t=9 moving vulnerable? Actually t<9 invuln ticks 0-8; t=9 moving vulnerable for one tick. But they are still moving, can be hit? Yes. Our punish sees invulnerable false maybe at t=9, vulnerable? phase moving not recovery, vulnerable false. Could miss. Not important.

In `punish` startup interrupt for o.state!=='beam' && o.state!=='light'. If o.state heavy and rem>5, light. Defense already. okay.

`neutral`: If o.state==='guard' and dist<=heavy, return closeRange(s). But closeRange may choose weighted if not guard branch? It has guard branch. okay. If dist>heavy, may blast/beam/forward. If canCharge before guard? In neutral, order: behind late, o charge, o guard, canCharge. If o guard far and canCharge true? canCharge may charge if o.state guard and ki<45, dist>480. But opponent guarding far could attack; but we check canCharge after guard branch? If guard branch returns forward/blast maybe not charge. Let's order guard before canCharge. Good.

If o.state==='charge', punish returns if in range; neutral charge branch before canCharge. Good.

`longRange`: uses `o.state === 'guard'` beam chance. Good.

`midRange`: if o.state guard, blast maybe; if not, desired. Could also heavy if dist<=heavy but midRange >heavy. okay.

`closeRange`: If o.state dash, return guard. But if dash moving away, maybe guard. okay.

Weighted: If all weights zero? fallback guard. In closeRange, wGuard positive. okay.

Potential issue: `for (var k in mem.acts) total += mem.acts[k];` If mem.acts has properties added? no.

Now, let's think about if `state.me.hp` or opp hp negative? view max0. okay.

Now, maybe need use `R.combo` length. okay.

Potential hidden requirement: Return action name string only. Our decide returns. If exception catch returns guard. Good.

Now, let's consider if code uses `Math.max(0, (s.dist - 80) / BEAM.speed)` returns float. okay.

Now, maybe there is a bug with `wallAhead` and dash_forward in anti-beam: If wallAhead small, dash_forward may not close enough. But condition dist<=310. If opponent near wall, wallAhead maybe dist + space behind? If no room behind, dash stops in front at minGap, good. If wallAhead < dist? impossible? wallAhead is distance to wall in front; opponent at wall, wallAhead ~dist + 0? If opponent at wall, wallAhead = distance from me to wall, ~dist + 30? Enough. okay.

Now, maybe need use `state.me.facing` for beam gap. We use eb.dir. If beam is mine? skipped. If enemy beam dir maybe not toward me? gap check. Suppose enemy beam dir=1, me left of front (behind beam), gap negative. If gap > -30 maybe still body overlaps? If beam passed me? If beam ray covers from from to front; if me behind front but within ray, could be hit? Beam moves away; if me behind from? Not. If gap negative but > -body, maybe front just passed, but ray covers me? inRay uses from to front. If me between from and front, beam would have hit already. If not hit due invuln, could still. But defense maybe. Our gap condition might ignore if gap<-30. okay.

Maybe compute aimed: if `(me.x - eb.from) * dir > 0` and gap > -body. If beam from shooter to front, me in front. If not, ignore. Add? Not necessary but could avoid guarding when beam moving away. Use:
```
var aimed = (me.x - eb.from) * dir > 0;
if (aimed && gap > -R.body) { ... }
```
If beam passed me and still covers, aimed true. Good. Add.

Incoming blast dash_forward: If we dash toward blast, may pass. But if `wallBehind`? not.

Now, let's consider if our bot might choose 'back' when hp lead and wallBehind >80, but opponent dash_forward through, we back into corner? okay.

Potential issue: If we choose 'idle' in midRange, we stand. If opponent approaches, next ask maybe close. okay.

Now, maybe need include `state.me.canCancel` in update? no.

Let's think about high-level performance against simple bots:
- vs always forward light: Our closeRange guard/light, defense light guard, punish. Should win.
- vs always guard: We approach, closeRange heavy vs guard, win.
- vs always heavy: Defense light/dash, closeRange light vs heavy tendency, should win or trade.
- vs blast spam: Guard, then punish? If far, guard chip. We may approach between blasts. Blast startup if close light interrupt. Should be okay.
- vs beam spam: Anti-beam dash if dist<=310, beam counter if far with ki, else guard. Might lose HP but can punish after. Could improve. If opponent beams from far repeatedly, we guard 120 each, maybe lose. But after first, ki maybe ~45, after passive maybe 50; beam counter requires cost+15=65, may take time. If they beam every ~90 ticks, passive + damage maybe enough. If they beam from >310 always, we guard. They spend 50, we lose 120 but gain ki. They can beam 2 times from start 30? Need ki regen. Beam cost50; start30, passive 2.4/s. To beam again need ~8.3s passive, unless hit. If they beam at start, we guard, they have 0 ki; we have ~45. They need time. We can close during that. So okay.
- vs charge: We blast/attack, exploit 1.5. Good.
- vs turtle guard far: We may blast/beam, approach. If they guard, close heavy. Good.

Could there be a bot that dash_forward through our attacks and beats? Our defense dash closing guard, but we may not punish. If they dash, we guard; after dash recovery, punish if close. Good.

Now, maybe consider if our bot uses too much guard and loses to heavy chip? Heavy crush 60. If opponent mix heavy/guard, okay.

Potential improvement: When opponent ki >=50 and far, avoid charge and maybe guard. canCharge checks o.ki<45. longRange beam maybe. okay.

Now, let's ensure no use of `console.log`. Good.

Now, final declaration. Need after code block new line. Could be `赛前宣言：以气会友，点到为止。` Count after colon: 以(1)气2会3友4，5点6到7为8止9。 punctuation maybe counts? <=20. Good.

Now, let's maybe run through code in head for syntax: `function weighted(pairs) { var total = 0; for (var i = 0; i < pairs.length; i++) { var w = pairs[i][1]; if (w > 0) total += w; } if (total <= 0) return null; var r = Math.random() * total; for (i = 0; i < pairs.length; i++) { var ww = pairs[i][1]; if (ww <= 0) continue; if (r < ww) return pairs[i][0]; r -= ww; } return pairs[pairs.length - 1][0]; }` okay.

Potential issue: In closeRange, weights after multiplication could be fractional. weighted fine.

Now, maybe `mem.nextDash` used in neutral offensive but defense ignores. We set in some offensive. In defense incoming blast dash uses Math.random but doesn't set nextDash; could spam dash every blast eta if random. It requires ki+5 and eta<=7; if guard? If choose dash, after dash recovery maybe blast gone. Could okay. But could drain ki. Maybe set mem.nextDash. Add `mem.nextDash = s.t + 60;` before return dash_forward in incoming blast. Also beam firing dash, heavy defense dash maybe set? Defensive should maybe not cooldown but can set to avoid rapid. But if multiple threats, could need. Maybe set short 30. Simpler not. But to conserve, set for offensive only. Incoming blast dash random 0.35, okay.

Beam startup anti-beam dash no cooldown; could dash every beam startup if ki. If opponent beam startup but canceled? Can't cancel. If we dash, spend10. okay.

Heavy defense dash no cooldown; if opponent heavy startup frequent, spend. okay.

Now, maybe if we choose dash_back in heavy defense and wallBehind >120, but dash_back cost; if ki low, guard. Good.

Now, possible issue: If we are in `me.state==='guard'` and defense returns 'guard', choose sees same state, does not reset t? choose: if FREE.has(act) { if (a.state !== act) { state=act; t=0; } return; } So guard persists, t not reset. okay.

Now, maybe if defense returns 'back' and we were guard, state changes. Good.

Now, consider if opponent light startup and we return guard, but we were in forward; state changes to guard before active? Decision timing maybe. If active occurs between decisions, can't react. But if we see startup, likely enough. Good.

Now, maybe need handle `state.timeLeft` when match almost over and hp equal. If equal, our functions not lead; midRange desired maybe170, might fight. If timeLeft<300, neutral? We don't have explicit equal late. Could add in neutral top:
```
if (s.timeLeft < 240 && me.hp === o.hp) return s.dist > 200 ? 'back' : 'guard';
```
Draw half. But maybe seeking win better? If equal, draw is okay but win better. Conservative avoid losing. Add maybe if timeLeft<180. But if we can kill, punish/defense still before neutral. If no opportunity, guard. Add in neutral after behind late:
```
if (s.timeLeft < 240 && me.hp === o.hp) { return s.wallBehind > 100 ? 'back' : 'guard'; }
```
But if dist close and opponent attacks, defense/punish before neutral. If no, guard/back. Good. Add.

If hp lead late, long/mid/close handle. If hp behind late, aggressive. Good.

Now, maybe if hp lead but timeLeft very low and dist close, closeRange returns back if wallBehind>80 else guard. If opponent heavy, guard crush; but time low maybe okay. Could dash_back if ki. Maybe add in closeRange lead branch: if wallBehind<=80 and me.ki>=DASH.cost and Math.random()<0.5 return dash_back/dash_forward? If cornered, dash_forward through to escape. Let's modify closeRange lead branch:
```
if (s.timeLeft < 600 && me.hp > o.hp) {
  if (s.wallBehind > 80) return 'back';
  if (me.ki >= DASH.cost && Math.random() < 0.5) return 'dash_forward';
  return 'guard';
}
```
Good.

If hp lead in midRange and wallBehind<=90, guard. Could dash_back? Add maybe.
```
if (timeLeft<900 && hp>opp) { if wallBehind>90 back; if ki>=DASH.cost && Math.random()<0.4 return 'dash_back'; return 'guard'; }
```
But dash_back into wall if wallBehind small? if <=90 maybe still moves to wall, not escape. dash_forward through maybe. Use guard. Keep.

Now, maybe if hp lead and longRange, back. If wallBehind >120. If cornered, guard. okay.

Now, let's think about if we should use `state.wallAhead` for dash_forward offensive. Not necessary.

Potential hidden gotcha: The engine may pass `state` as JSON, no functions. Our code uses object properties. okay.

Potential hidden gotcha: `RULES` may be frozen but we only read. okay.

Potential hidden gotcha: Top-level `const R = RULES;` if file loaded in environment where RULES not defined until later? It says global RULES available. okay.

Now, maybe we can improve beam counter by using blast? If opponent beam startup far and we have blast, could blast interrupt? Blast startup11 + travel; if far, maybe beam fires first. Not.

Now, think about if opponent uses beam at point-blank. Defense beam startup: if dist<=light and rem>5 light. If rem<=5, guard. Beam fires, chip120. Could dash_back? We didn't. In beam startup branch before guard, if rem<=? maybe dash_back if close? We have dash_forward condition only rem>23. If rem small and close, maybe dash_back to avoid. Add in beam startup:
```
if (rem <= 6 && me.ki >= DASH.cost) return s.wallBehind > 100 ? 'dash_back' : 'dash_forward';
```
But if beam fires soon, dash may avoid? Dash invuln9, moves away/back. If point-blank, dash_back increases distance; beam front starts 40, speed30; maybe safe. If no wall. Add before guard. If rem <= 8 and ki, dash. But if we dash_back, might still be hit after invuln if beam reaches; but distance +200 helps. Good. If wallBehind small, dash_forward through behind shooter maybe safe. Add:
```
if (rem <= 8 && me.ki >= DASH.cost) return (s.wallBehind > 120 ? 'dash_back' : 'dash_forward');
```
This can avoid beam instead of guard. But if dash_forward through at point-blank, during recovery facing? Opp beam firing; if we land behind, beam ray away, safe. Good. Use.

Beam startup branch order: if can light/heavy, do. If dash_forward anti (rem>23). If rem<=8 dash escape. If beam counter. Else guard. Good.

Beam firing defense already dash if eta<=7.

Heavy startup defense dash if rem any. Good.

Now, maybe if opp beam startup and rem between9 and23, no dash, guard. okay.

Now, possible bug: In beam startup, if rem<=8 and we dash_back, but we might have ki<cost, guard. Good.

Now, think about if opp beam startup and we are in range heavy but rem>9, we return heavy. Heavy startup9; if rem=10, active same tick as fire? strikes before beams, heavy active at tick9? Wait startup9 means active when t=9. If rem=10, after 10 ticks beam fires; heavy active at 9, interrupts. Good. If rem=9, active same tick as fire; strikes first, heavy interrupts? Yes strikes before beams. But heavy damage maybe. We used rem > HEAVY.startup, so rem>9. If rem=9, won't heavy; maybe light if rem>5. If dist>light, guard/dash. Fine.

Now, perhaps use `rem >= startup` for strikes due order? But conservative okay.

Now, maybe if opp light startup and dist<=light+20, return guard. If rem maybe 0? phase startup? If t<5. Good.

Now, consider if opponent in `state==='recover'` after clash, left20. punish light if d<=110 left>5. Good. If far, neutral. Could dash? Not.

Now, maybe need handle `state.opp.state==='ko'` not. okay.

Let's think about if our bot's top-level variables could be retained across games if engine doesn't reload? It says reload. If not, mem would persist, maybe okay? But could exceed? Not.

Now, maybe need not use `let` top-level if environment wraps in function? okay.

Now, let's consider if code length under answer limit. It's fairly long but okay. Need final only code block. Could minify? Not necessary. But maybe answer length constraints? We can provide long code. Fine.

Let's write final code now in final. Ensure no accidental analysis. But before final, maybe one more review of full code.

I'll compose full code:

```
const R = RULES;
...
function decide(state) { try { return main(state); } catch (e) { return 'guard'; } }
...
```

Potential issue: If `RULES` is undefined, top-level throws before decide, catch not. Could wrap top-level in try? But need define decide. Could do:
```
var R = (typeof RULES !== 'undefined') ? RULES : {... minimal};
```
But minimal would be huge. Could guard:
```
var R = typeof RULES !== 'undefined' ? RULES : { light:{...}, ...};
```
Not needed. But to be safe, maybe define fallback minimal? Could be error-prone. Assume RULES.

Potential issue: In `basePower`, if f.ki is undefined? state has. okay.

Potential issue: In `clashChoice`, uses `CLASH.draw`, defined. Good.

Let's write `basePower`:
```
function basePower(f) { var rage = f.hp < CLASH.rageHp * R.hp ? CLASH.rage : 0; return (f.ki > 0 ? CLASH.base + CLASH.kiPower * f.ki : CLASH.empty) + rage; }
```

In clashChoice, `var mePush = myNo + (me.ki > 0 ? CLASH.pushPower : 0);` not used? Could remove. We use myPush. okay.

`oppPushing` uses `c.oppPower > oppNo + 0.25`. If opp push power +0.6; threshold. If opp ki low and push? If ki>0, +0.6. Good. If oppNo includes rage. okay.

If `c.myPower` maybe includes push from previous; not used except maybe? We don't use mePushing. okay.

Now, `weighted` fallback returns last pair even if weight zero? If total>0, should return before. If floating rounding, fallback maybe. okay.

Now, `closeRange` uses `p('beam')` but mem.acts.beam counted when opp beam startup. Good.

Potential issue: `mem.acts` total can grow; probabilities smoothing. okay.

Now, maybe in `update`, if o.phase startup and o.state==='dash'? Dash phase not startup. okay.

Now, maybe if opponent action invalid? Not.

Let's ensure all function names unique. `main`, `update`, `startupRem`, `defense`, `punish`, `neutral`, `longRange`, `midRange`, `closeRange`, `cancelChoice`, `clashChoice`, `basePower`, `canCharge`, `weighted`. Good.

Now, maybe use `Math.random()` in canCharge and weighted. If Math.random seeded, okay.

Now, final declaration. Need code block then newline declaration. Ensure no extra text. Use ```js. Good.

Let's produce final.