I need design bot. I'll output only code +宣言 <=20 chars Chinese. Should maximize fighting. Should thoroughly analyze mechanics and strategy. Should have JS self contained function top vars per match. Should account mirrored opponents varied. I'll build robust adaptive heuristic, simulation perhaps. I have thinking enough. Should decide optimal general bot against unknown other five. Should exploit. Should avoid bugs. Should have timing.

I need understand tick cadence, view. Bots called max every 6 tick idle etc; held action persists. On moves only on free immediately. Cancel next tick. I can implement plan memory across calls, track tick, opponent, etc. No engine access besides state. Should use exact timings for defense, offense, zoning, combos.

Fundamental:
- Light startup5 active ticks t=5,6,7? step choose t=0 then move strikes phase at t0 startup. t increments after. On tick state.t=5 active. Reach 110. If hit, opponent hitstun dur15 t0 and canCancel set attacker. At end t++, attacker t6, opp t1. Next tick ask cancel (a.cancel true) before strikes. Opp stun remains until t>=15, 14 more? Can chain light starts t0; hit at t5 while opp stun t? first hit at tick H, next cancel H+1, next active H+6, opp stun ends at H+15 (free called next H+16?). Chain 4 hits at H, H+6,H+12,H+18: opponent first stun ends H+15? At step H+14 t14 -> t15 free, nextAsk H+15, at H+15 asks. Third hit H+12 resets stun 15 so okay. Fourth H+18. damages 40,32,26,22 =120 plus push 14 each. Reach issue: pushApart after each hit pushes opponent 14 away. Initial dist <=110, after first +14 => up to124. Next light startup, both fixed attacker, opponent stun, so if dist >110 second won't hit. Should walk? Can't during cancel. Light combos only connect if initial dist <=96 for second, <=82 for third, <=68 fourth (min60). Typical first at dist110 can't chain. Could cancel heavy (reach140) after first at up to124, hits startup9 later but opponent hitstun 15, yes hits H+10, within stun, knockdown, damage scale .8 *120 =96 (or counter? hitstun no), total136. Good. Cancel blast after light? startup11, blast spawns at t11 and moves, opponent stun ends at15; spawn H+12, distance etc may hit while stunned if close, 60*.8=48. Heavy preferable. Cancel beam at close? startup30 too late, opponent can guard; raw beam block 160 vs cost50, okay but risk.

Chain light then heavy based distance. If close (<=82 etc), can do 4 lights then heavy? At 4th light chain=4, canCancel heavy. Heavy hit after 10 ticks while stun yes. Total 120+ heavy damage at combo index4 scale .45 =>54, total174. But light chain may drop if distance. Should calculate current dist at cancel and chain. On hit, view next tick after push, dist. To land next light: future distance static (unless knockback? push only immediate), must <=110. So if dist<=110 and chain<4, light again. But damage efficiency vs heavy. At first cancel if dist<=110: another light 32 + can continue; eventual heavy. Could always light while can, then heavy when dist>110 or chain=4. If chain light whiffs due dist>110, no more cancel, bad. At cancel state dist reflects push. So if <=110 safe. Opp hitstun enough for chains as above. Fourth at H+18, etc. Then heavy. Damage. At wall pushApart: if opponent against wall, attacker pushed back instead. Still dist +14, same. Could side switch? no.

After heavy hits, opponent down42 and knocked back150. My heavy recovery22 from active: heavy total35, started cancel H+1, hits H+10 (t9), down through H+52, attacker recovery until H+35? Start H+1 t0; dur35, free at end H+35? Then can approach. Opp knocked back 150 over 13 ticks; distance huge. Could dash/blast etc.

Basic offense: guard vs light/blast/beam, heavy crush guard. Should have reaction. Since decisions every 6 ticks when idle, can react to startup:
light startup5, if opponent starts light same tick I'm called? I see at t0 next calls only when free. Opponent light at distance<=110: if I'm in held guard, blocks. If not, my next call up to6 ticks later may be too late to guard. Should default guard when in threat range, or attack. Heavy startup9 can react at next call if within6, guard doesn't help; need dash_back or dash_forward invuln, or back possibly outrange. Dash costs16, invuln8, moving10. Against heavy, dash back avoids. Against light, guard. Can attack to counter? light startup trade. Should anticipate.

At distance >110, projectile game. Blasts cost14, startup11; travel. Guard on incoming eta <=? Can just default guard if incoming and eta small. Since guard held and decisions every6, switch when eta<=6 perhaps enough. Blast chip12 and block ki6; good. Dash invulnerability can dodge, but cost. Beams: startup30, react. Guard beam chip160 and cost15, vs dash avoid entirely cost16 (if timing). Beam firing 40 and front speed30. At distance e.g 300, front reaches in ~9 ticks. Dash forward/back invuln first8 only, dash total18. Beam persists; if dash through opponent? Should avoid. Guard often safest vs beam unless can counter beam for clash. Beam raw if opponent guard:160 chip for 50 ki, opponent pays15; good but my 90 tick vulnerability. If hit:280 + knockdown. Opponent can dash invuln through beam or counter. Should not overuse.

Potential dominant tactic: heavy when opponent guard, lights when not; blast zoning, punish charging. Adaptive opponent state.

I can implement finite strategy with defensive reaction and spacing.

Should consider time and HP. If ahead, play safe guard/back, run clock. If behind, aggressive.

Can infer opponent patterns over match only one round variables reset each of 1000 rounds, no cross round. Top-level executes per round, no learning across. Should immediate robust.

I could build frame-perfect punishes:
- Opponent whiffed light/heavy/blast/beam recovery: attack.
- Opponent charge: blast or dash in heavy.
- Opp down: approach, time attack as they get up. Me free while opp down: can move forward, blast etc. Opp invulnerable down. At opp.left <=? state.left gives remaining. I can set action to hit on wakeup. Since decide every6, and immediate at own free.
- Opp hitstun/crushed: free attacks.
- Opp in recovery and close: light/heavy.
- Opp beam startup: dash_forward perhaps avoid and punish? At dist close, light/heavy can interrupt. Beam costs50, startup30. Heavy hits at9, knockdown interrupts, great. At dist<=140 and free, heavy. At dist>140, blast may interrupt if arrives before startup ends, or own beam counter leads clash (risky). dash_forward to close/through, invuln.
- Opp blast startup: if close heavy or light to interrupt. At distance, guard or own blast to cancel? My blast later, projectiles might cancel. Can dash forward to punish recovery.
- Opp heavy startup: if dist<=140, evade via dash_back, or if ki<16 back/guard? Guard crush. Could light if their t <=? My light hit at5; if opponent heavy t<4? If both startup and my light hits first, interrupt, taking no hit. At call see opp heavy t; my light hits after5 ticks (at current+5? Their heavy hits at t9). If opp.t <=3 perhaps mine first (t+5 <= t_opp_active?), if opp.t=3, heavy active in6 ticks, light in5 => interrupt. Good. If opp.t>=4, dash. But dash_forward invuln can cross and punish recovery, while dash_back creates space. If too late and within range, heavy might hit before dash invuln? Dash invuln from t0 immediate at strikes; yes choose dash then move, invulnerable for t<8. So safe if choose before active. Dash forward through opponent likely avoids and behind, but if dist>200? dash end 200 forward; if dist<=140, crosses behind. Opp heavy facing original during move, whiff, I land behind at dist60 and recovery. At end dash t18, opponent heavy total35 started earlier, might still recovery; can heavy punish from back (guard doesn't matter). Good. Use dash_forward if ki>=16. But opponent could be light startup: dash through leads whiff and punish; cost but strong. Could just guard light.
- Opp light startup and dist<=110: guard, unless can counter light faster? If opp.t=0, my heavy too slow, my light same timing trades (both hit) perhaps bad. guard.
- Opp idle guard: heavy if within140; at >140 approach/blast.
- Opp back: approach.
- Opp forward: at close perhaps heavy or light. Should have no blind guard forever.

Action selection when free and no cancellation:
Priorities clash: decide push optimally. Clash powers and ki. Should choose push each 6 tick; pushing adds .6 power, drains .8/tick vs .2. With ki high, push until low. MyPower state includes current push from previous decision. I need evaluate pos, t, ki. No ki => power0.5(+rage), pushing doesn't cost and power doesn't include push if ki=0? power function f.ki>0 ? base+...+(push) : empty. So push useless at zero. Should push while ki>some threshold and strategically. Since kiPower*ki adds power but drains. Always push with ki>0 likely maximizes chance, but may run out then 0.5, while not pushing preserves ki and base power. Should optimize based on pos and time. Clash starts ki after beam cost, often similar. Always push until perhaps <5 then conserve? At ki e.g50 -> power2 +.6, drains. At 0.8/tick, lasts60 ticks; without push 250 ticks. Total impulse? Should have dynamics. Push adds .6 power -> drift .06 per tick acceleration, velocity decay; sustained difference leads velocity ~1.2/tick (plus ki differences), can resolve quickly. Always push likely best if ahead/need. At low ki <10, pushing for ~12 ticks then empty vs conserve could maintain ~1.2 power. Opp strategies unknown. Simple: push if ki>8 or pos>0.65 (near winning) or oppPower > myPower and ki>0.5; otherwise not? Should avoid losing while conserving. I can derive expected. Use always push while ki>1 perhaps strong. With no ki pushing no effect. If opponent also always pushes, both drain equally and higher initial ki wins. If I stop at8, opponent empties and mine 1.16 vs.5, win. So stop around 6-10 and reserve. At ki<6 don't push, keep base+0.12=1.12, drains 30 ticks then empty; opponent empty earlier. Might be good. If opponent not pushing, my burst wins before. I'll use push if ki>6 or (pos>0.72&&ki>0.5) or (oppPower-myPower>0.35&&ki>0.5?) Latter could burn all. Better always push until6 then conserve; if pos<0.25 (near losing), desperation push with remaining. `pos` 0 on me,1 opp. So if pos<0.2 and ki>0 push. If opp low power etc. Fine.

Defense against incoming blast:
Blast view eta ceil((gap-body)/13). At each step blasts move then collision. If eta0 means will hit now? But I'm called before blast movement and state view from previous tick. If incoming eta <=? guard now. Held guard from earlier is best. If not guard and eta >? choose guard if eta<=7, persists. At far distance could dash_forward to dodge and close, timed. Blast chip small; guard simplest. Guard costs ki and if ki<6 crush 34. If ki<6, avoid with dash if possible or back? dash invuln. I can choose dash_forward when eta between? A dash lasts18, invuln ticks t0-7. If choose when eta<=7, blast will pass during invuln. At distance, dash forward may move through shooter if close enough, but usually just 200 towards, blast moving toward me, meets early. Good. With ki>=16 and opponent blast recovery perhaps dash to punish. But using 16 to avoid 12 chip/60 dmg vs guard cost6, not worth unless guard broken low ki or want aggression. If guard insufficient (<6), must dash (cost16 impossible if ki<6), then can't. Could back? blast speed13 vs back3, still hits. So keep ki >=6. If ki<6 and incoming, guard gets crushed chip12 and stun34 but only12 damage, perhaps acceptable vs60. Guard still better.
Beams incoming: state.beams non mine. If already firing and ray close, guard. If beam startup opponent, can respond. Guard beam costs15 and chip160. If ki<15, crush and chip160 +34 stun, still. Dash dodge cost16 similar but can fully avoid; timing important. A beam from front advances30/tick and body pad30. Distance D, from opponent+25, front initial+40 then moves before collision. It reaches after roughly (D-40-30)/30 = (D-70)/30 ticks. Fire40 covers max1200 so whole stage. Can't back forever. dash_forward through opponent if D<=200? if D>200 lands 200 closer still in front and after invuln beam catches. dash_back moves away200, beam max front 1240 from opp, stage max distance920 so eventually catches unless firing ends before? Beam front travels 1200 over40 enough. Could dash through opponent only if dist<=200 (actually start <=? dashEnd: before>0, after<60, if after<=-60 and room behind -> crosses; requires D? x=me+200, after=D-200; <=-60 => D<=140. If D 140-260 ends near front or behind? I'll compute d=1, D=180, after=-20, behind=o.x+max(60,20)=o+60, condition after<=-60 false; else if o+60 valid and after<0 -> x=o+60 behind! So crosses for after<0 =>D<200. For D=200 after0, first behind o+60, condition after<=-60 false, else after<0 false, else x=o-60 in front. So cross if D<200 (with room). If D between200 and260 after 0..60, else x=o-60 (in front) causing weird jump to dist60. So dash_forward at D<200 crosses. Opp beam from front continues right beyond, I'm behind, safe. Opp may turn only if free, in beam no. Great. At D<200 and ki>=16, dash_forward during opp beam startup/firing can avoid and punish. At D>=200, raw guard or counter beam. Counter beam if ki>=50 triggers clash, risky but can win and avoid chip. If opponent beam startup and my beam starts, su aligned. Could be good if high ki and hp. But both spent50, clash random. Guard160 guaranteed vs possible320 opponent and no damage if win; plus opportunity. Clash winner deals320 and loser down, winner recovery20. Loser of clash takes 320; if I lose bad. Expected perhaps positive if power advantage. If opp used beam, ki after cost known. I see opp.ki current, if I have more, clash advantage. Could counter if my ki after cost enough vs opp. Should compare projected powers: me ki-50, opp ki (already paid). If opp beam in startup, opp.ki current. If my ki-50 > opp.ki+ perhaps, good. Else guard.
Can also interrupt beam startup with blast if arrival before t30. At dist D, blast startup11 + travel (D-40? body) /13. Opp remaining startup `su` unknown but left is total duration not phase left. Opp.t known, standard startup30 unless counter su12. If opp.t<30 etc. My blast hits at startup11 spawn and travel; if D<=? At D300, spawn after11, then ~14 ticks =25, can interrupt. Damage60 and cancels their beam, they lose50. Excellent. Use blast if ki>=14, no blastOut, and estimated hit before firing and before their startup ends. Should compute. Opponent beam state phase startup, t, remaining startup = (perhaps counter startup? I don't know su but if they responded to my beam, mine exists). For normal 30. `opp.left` total dur-t. firing40 recov20 => su+60; so su=left-60? At state view, dur=su+60, left=dur-t. Remaining startup = su-t = left-60. Nice. So `r = opp.left - RULES.beam.fire - RULES.beam.recovery` = left-60. For my blast to hit: spawn when my blast t=11 on tick start+11. It appears at x+40 then moves +13 same tick. Collision distance; number travel n. Could approximate 11+ceil((dist-70)/13), perhaps. If <r, interrupt. At close, heavy better.

Also if opponent charge and beam etc: blast damage*1.5, worth.

Offense detailed:
At start dist300, both30 ki. Options: forward to close, charge, blast. A good bot may rush. I want robust. Blast at start: startup11, travel ~18? Opp can guard reaction. Chip12, ki trades: I spend14, regain passive during29 ticks (~1.16), opp if guard loses6 but gains? chip damage gives taken .96, net -5, attacker +3 pressure. So my net cost ~10, opp net -5 plus12hp. Not huge. If hits:60, I gain1.2, opp gains4.8, stun20. Can follow forward? I'm recovery18, by time free opponent almost free. Zoning can build advantage slowly but time.
Heavy rush: walk300 gap to140: 160/4.5=36 ticks if opponent static; decisions every6. Heavy catches guard or startup, 120. Light does40. Guard-heavy mix.
Dash forward cost16 closes200 and invuln, at start lands dist100, then recovery8. Opponent can heavy during recovery for counter150? They see dash and can time. Risky. Walking safer.
Charging at start gains.36/tick, in100 ticks +36 to66; opponent can blast. If opponent passive, beam. I can charge when dist>400 and no incoming and opponent not approaching, until ki80. But if opponent walks forward, distance closes. Perhaps initial blast + forward.
A general aggressive bot likely good. I'll output robust no training.

Could implement opponent state tracking to predict attacks and reaction. At every call, I see limited. Persist `mem` lastOppState etc, last action, plan. But decisions every6 enough. Should have no overcomplex.

Can simulate immediate attack threat:
- If opp `light` startup and dist <=110 + movement? I'm free. Guard. If opp in active and not yet hit? At my call only free, so likely it whiffed or I was guard? Could guard.
- Opp heavy startup and dist <= perhaps170 (they don't move during heavy, my position can move) => avoid or counter.
- Opp any attack recovery: punish based dist.
- Opp hitstun/crushed: attack.
- Opp down: positioning.
- Opp invulnerable down can't hit.
- Opp blast/beam etc.

When I choose attack, need range at active time accounting opponent movement. Opp forward moves4.5 toward me during startup, so range grows effectively. Light can hit if current dist <=110+5*4.5=132.5 if they keep forward. Heavy <=140+9*4.5=180.5. Opp back moves away3, range decreases: light current<=110-? If they're back persistent, by hit time distance+15 -> need <=95. Heavy<=113. Opp idle static. I can estimate.
- Against guard/idle/charge, static.
- Against forward, use larger range.
- Against back, shorter.
- During hitstun static.
- During recovery static.
For light, if slightly out of range, forward first.
Heavy at dist<=140 hits static; good against guard.
If opponent free and not guarding, light faster and can combo, usually preferable to heavy. Heavy 120 vs light combo ~136-174 but light risk guard. Opp guarding -> heavy.
If opp charging -> heavy if in range (180 damage + knockdown) vs light60 and combo; heavy best.
If opp recovery -> counter multiplier1.25: heavy150 vs light50 then combo scale etc. Heavy best if can hit before recovery ends. Should have remaining time `opp.left`. My heavy hit after9 ticks, light after5. If `opp.left > hitTime` and in range. If opp.left <= hitTime, they may become free and guard before attack lands; still can attack based expected.
- For heavy recovery22, easy punish. Light recovery9, if see at t? free calls every6; if left>5 light can hit. Heavy if left>9.
- Blast recovery18, dash in/heavy etc.
- Beam recovery20.

Punishing down: Opp down left. If far, forward. I can fire blast timed to arrive just after down ends? Down invulnerable; blast can pass through if hits while down and continues? blasts if invuln down: continue, not dead; could hit after standing if still overlapping? condition each tick, yes possibly. But easier position.
Heavy knockback creates distance ~ initial+150+? After my recovery, opp down left ~? Heavy hit H, attacker heavy started H-9, total35, free at H+26 (since start t0 at H-9, duration ends at t35 -> H+26). Opp down42, left16 when I'm free. Distance ~ heavy hit dist+150 (up to290). I can walk forward16*4.5=72, still far. Opp gets up with dist perhaps200. I can blast during their down such that hits on wakeup? If choose blast at free, startup11, opp left16; travels. At D~250, travel14 -> total25, after wake, opponent can guard. Not a punish. Better forward to maintain pressure. I can forward until dist~130, then time heavy to hit on wakeup. But calls every6 and down left known. If down left <=? Opp invulnerable until free. Heavy active at9, so if choose when left around9-14, hit after wake. But opponent gets immediate decision and can guard/dash. Heavy on guard crushes, so great; light on guard blocked. Heavy wakeup is strong, unless they dash. Use heavy if in range at active. Should be close beforehand.

When opp down and dist>140: forward (or blast if far). If dist<=140: heavy when left<=12? Current distance static unless knockback still? view opp down and kb movement perhaps position changes each tick; my forward etc. I can just forward if dist>125, else idle/guard until left<=12 then heavy. But returning idle one call then next at6, okay. Could heavy too early and hit while down -> strikes active sees invuln and continues only active4 ticks, whiff; avoid. Condition left between? If heavy starts now, active in9 ticks. Opp down will free at current tick+left (roughly). Should active when free. If left<=9 and >? active t9-12. If left<=12 and >=? At start, if left=12, active at t9 while down left3, first active ticks t9,10,11, at t12 opponent free and can act before strikes, can guard -> heavy crush if guard; good. So left<=12 works, unless left>?? all. If left=0 (will free this tick? wants called? state down no), active in9 fine. So heavy. But if opponent gets up and dashes, whiff. Fine.
If too far for heavy but light range perhaps etc.

Blast usage:
- At long range >180, opponent not guard? Fire. If opp guard, chip but pressure; still okay if ki enough.
- Don't spam when opponent can easily dash punish. Keep ki >=16 or>=50? Ki management. Natural passive low; forward gives.08/tick. Charging important.
- If low ki (<14), forward or charge at safe distance.
- If high ki>=50 and opp in vulnerable state (hitstun/crushed/recovery/down wakeup) beam could hit for280. Beam startup30 means only crushed34 or down can time; at close heavy better perhaps. Raw beam on crushed: if remaining stun>=30 and dist any, hit guaranteed (unless down after? no). 280*combo scaling perhaps. Use beam if ki>=50 and opp.crushed left>32. Good. Against charge at long range, beam startup30; opponent may react and guard, still160 chip. If opponent remains charge, 420 damage. But they get called every6 and likely stop.
- Against opp guard at long range, beam chip160 cost50, guard pay15. If they stay guard30 ticks, guaranteed. They can dash forward if close, counter beam. Could use when their ki<15 causing crush but same160 and stun34. Then follow. If opponent low HP, chip can KO. Good.
- At time end, if ahead avoid risky.

Counter and combo math:
On cancel:
```
if (me.canCancel) {
  if (dist <=110 && chain<4) return 'light';
  if (dist <=140) return 'heavy';
  if (ki>=14&&!blastOut) return 'blast'; // but opponent might recover before projectile reaches if far
  return ...
}
```
First light hit at dist perhaps110 then after push124 -> heavy hits at124, good. Heavy scale .8. If chain light at dist<=110, subsequent dist+14. At chain3 etc. On chain=4 and dist<=140 heavy. If dist>140 (possible? Each light only if previous dist<=110, after hit +14 => max124, so always <=124 on successful hit, unless opponent kb? no), so heavy.
Could sometimes cancel beam after 4 lights for more damage? Beam startup30 > stun15 so opponent free, guard. Heavy better.
If heavy crush? fine.

After hitstun opponent and I'm free from non-cancel e.g blast hit at dist close, use light or heavy. Opp hitstun left. Light startup5, if left>5, connects, combo scale based opp.combo. Heavy if left>9. Prefer heavy for damage if enough stun, otherwise light. Heavy knockdown may be best. At close and hitstun from blast, heavy. If opp.combo high damage scaling reduces but okay.
Against crushed left34: heavy hit in9, damage counter? crushed no counter, knockdown. Could beam if left>30 and ki>=50, 280; after beam hit down50, good. Beam at any distance and guaranteed if remaining>time to reach. At close heavy120 then can pressure; beam better damage. Use beam if ki high and left >=34-ish. Should beam front travel. At dist D, hit time =30+ceil((D-70)/30) roughly. If <left. Or heavy.
Against opp startup:
- Opp charge is FREE, my decision. If dist<=140 heavy (1.5x). At long dist blast (90 dmg) if hit. Opp may guard on seeing blast startup though. Still.
- Opp blast startup: heavy if range and my hit before their blast? heavy9 vs blast release remaining11-t. If heavy hits first, interrupt. Condition `9 < 11-opp.t`? At close. If too late, guard incoming soon. Light5 perhaps. Use light if can hit before. If their blast already recovery, punish.
- Opp beam startup: heavy/light interrupt as above. If too late to interrupt but before firing, can still hit if heavy active after they start firing? They are in beam firing, my strike hit will interrupt beam and damage counter? `mult`: phase firing not startup/recovery -> x1, but land hurt, state down and beam removed next beams? strikes before beams, beam still m.beams and shooter down; beams() removes. Good. At close, can hit even during firing if not hit by beam first? Strikes occurs before beams each tick; if my active same tick, interrupts before beam damage. So attack.
- Opp dash: invuln first8; don't attack until recovery. If dash_forward crossing, my facing auto only if free at choose and after move free; I may face. Opp dash recovery vulnerable counter. If in range heavy etc.
- Opp down no attack until timing.
- Opp recover (clash win) similar recovery but phase null and MOVES doesn't include => no counter. Punish.

Defense when opponent attack and I'm free:
At close default guard? But heavy destroys. Should choose based opponent state. If opp guard, heavy. If opp idle/forward, perhaps light/ heavy proactively. A mixed strategy using deterministic RNG can prevent exploitation. Math.random seeded. Use randomness for attack choices. But deterministic adaptive bots could exploit if random unpredictable within match? They see same? Math.random per bot perhaps seeded; unknown. Fine.

I can create reaction-based:
1. Cancel/clash.
2. Critical defensive if incoming beam/blast and threats.
3. Punish opponent nonfree.
4. Close-range free opponent decision.
5. Long-range neutral.

Defense against heavy:
If opp.state heavy and phase startup/active and dist<=140 (or perhaps 150):
- if ki>=16: dash_forward? It costs and crosses, puts me behind. At dist60-140, yes. If wall behind opponent no room, stops in front, but invuln8 and heavy active timing: heavy startup9, if dash at opp.t0, heavy active at9 after my invuln ends at t8; at tick9 I'm dash moving t9 not invuln and in front dist60 -> get hit. So early dash_forward can fail if not crossing! Even crossing: behind, safe. If no room behind, dangerous. `wallAhead` etc can infer opponent behind room. My forward direction me.facing. Opp's behind along my facing: room beyond opp in my direction = wallAhead - dist (since wallAhead distance from me to edge in facing direction). Should have >=60 to land behind. If `wallAhead - dist >=60`, crosses. If not, dash_forward stops in front. Use dash_back instead; moves away200, out of range by active. If wallBehind<... dash_end clamp perhaps only small, but enough? Heavy reach140; current dist perhaps60, back wall room0 => can't move, after invuln8 heavy at9 hits. Should counter light if possible or guard? Guard crush. Could attack if heavy remaining >5 so light interrupt. At late startup and cornered no escape -> perhaps light trade? Could dash_forward invuln plus cross? no room. Could beam? no. Best light perhaps if active before? If not, gets hit. So avoid corner.
- dash_back at early heavy works: at heavy active t9, dash t? if chosen when opp.t0, my t9 moving (not invuln) but position back200, dist>=260 >140. Safe. If wall limits to <... perhaps.
- if opp.t<=3 and dist<=110, light interrupts (hits at t+5 vs heavy active remaining9-opp.t; if opp.t=3, in6, yes). This saves ki and deals counter50, combo. Could use light. But if currently too close and opp heavy, good.
- if opp.t<=0? heavy hits? fine.
- if opp.t between4 and8, dash. If no ki, back perhaps if enough room and distance. At opp heavy active in 1 tick, back3 only, still hit. Guard takes60 crush vs heavy120 + down, actually guarding heavy results60+stun34, less damage than hit120 and down42 but stun. If cannot evade, guard is better HP and no knockback, but gives opponent free pressure. `guard` always heavy crush60. So guard as fallback, better than charge/idle.
- Could dash_forward through if safe and punish. Use dash_back generally safer but yields space; dash_forward cross gives heavy whiff and punish. At dist<200 and room behind, use dash_forward. But if early t0 and cross, opponent heavy active at9, I'm behind at dist60, facing original until dash recovery end, but strike check d=(o.x-a.x)*a.facing; opponent heavy facing original, I'm behind so no hit. Great.
- If opp heavy active now and I'm called free, likely it hasn't hit due out of range/invuln, can guard or dash. Use dash if close.
Against light startup:
- Guard if dist<=120.
- If opp.t<=? I could heavy? Their light hits first and interrupts. My light simultaneous if t0, trades: both40, stun; no advantage. Guard better.
- If dist>110 but opponent forward? static during light, likely whiff. I can forward/punish.
Against opponent beam:
Detailed defense must preempt default guard.
If `beams` incoming and currently ray about to hit, if not guard and can dash through. At dist<200 and room, dash_forward at any point before hit; invuln immediate and cross. But dash movement 20/tick; crossing over10 ticks. Beam could hit before cross while invuln first8; at t8/9 perhaps still in beam and in front? If D=150, after8 moved160 -> crossed by10? positions: dash end behind60, total210, per tick21. After8=168 >D, behind18 but min? body beam from opponent forward, behind safe once x>o.x. At t7 x+147 for D150 not cross, t8 x+168 cross but invuln t8 false, strikes? beam check after move, behind safe. Good. D=190 total250 per25, after7=175 (<190), t8=200 cross, safe. Fine. D=60 total120 per12, crosses at5. Good. So dash works.
If beam startup and dist<200, dash immediately might finish before beam fires (startup30) and I'm behind, opponent still beam facing original; safe. But after dash recovery18, I'm free at t18, behind opponent, can attack their startup at close; heavy hits at27 and interrupts before firing30. Great. So dash forward is excellent if ki16, then punish. My logic when free at t18 sees opp beam t18, dist60 and heavy interrupt. Good.

At dist>=200, perhaps guard. Could blast interrupt if enough time. Counter beam optional.
If my ki<15 guard payment, dash perhaps if enough16 (contradiction ki15 could dash? no16). At least guard.
Against incoming blast, guard if eta<=8. But if I'm currently planning heavy and opponent blast hits before active, should guard. Priority.
If opponent blast state startup at long range, I can fire own blast to cancel? Their blast releases earlier, mine later; projectiles may cancel if mine released before theirs passes. Good but not necessary. Guard.

Default guard can be exploited by heavy; my close offense should prevent opponent from freely heavy. If I am in guard held and called every6, see heavy t up to5, can dash before active. Good. If opponent starts heavy just after my last call, next call at6, opp.t6? It started next tick perhaps t5, active in4; dash works. If starts same tick after my call? simultaneous decisions: if I chose guard and opp heavy, heavy startup9, next call at6 t6, dash at6, active in3, dash invuln immediate, works. Good. So default guard + reaction heavy strong. If opponent starts light, guard holds. If opponent dash through, guard back vulnerability but can react? Dash moving10, my next call within6 while opponent dash and perhaps crosses; I can choose attack? invuln until8, so should wait then punish recovery. Good.

At close if I always attack rather than guard, risk. Should choose attack strategically with random and opp state.
When both free:
- Opp guard: heavy guaranteed unless they change at same time (if they are called, may switch). Still heavy catches many.
- Opp charge: heavy.
- Opp idle/forward/back: I can light if in range, heavy mix. Guard if anticipate attack? Opp state idle gives no telegraph; simultaneous light vs my light trades; my heavy loses to light (light hits at5, interrupts heavy), my guard loses to heavy but blocks light, my light loses to guard? block and I recovery? Light blocked: attacker continues light recovery, opponent blockstun11. Total light17, block stun11. Opp free at11 while I'm recovery until17, can punish with light at16? My free at17, their light started11 active16 while I'm recovery, hit counter50. So attacking guarded light is bad. Heavy vs guard crush good. Guard vs heavy60 damage but stun, heavy vs light bad, light vs heavy? if same start light hits first, good. This is rock-paper-scissors:
 light beats heavy, guard beats light, heavy beats guard. Damage light combo~136, heavy120, guard block creates punish. Should random mix close. I can use opponent patterns to choose. Track their last free action? At simultaneous they choose based state. Bots often deterministic; adapt frequencies in match.
Top-level variables can track my previous decisions and opponent states, count attacks when free. Could maintain history of opponent choices at close and my outcome. Simpler random weighted based their current held state: If they remain guard from prior, heavy. If idle/forward, mix 45% light,30% heavy,25% guard. If back, perhaps heavy/light depending range. Random prevents simple exploit.
Default while waiting at dist100 should perhaps guard more. Should aggressive enough.

Range neutral:
dist 60-110: close mix.
dist110-140: heavy can't be interrupted? Opp light out of range until no movement; heavy good. If opp forward, light may reach by active. Use heavy 45%, guard25, forward20, light if predicted forward.
dist140-200: forward, blast, dash mix. Opp guard etc. Heavy only if opp forward predicted.
dist>200: blast if enough ki and cooldown, forward, charge when safe.

Ki strategy: Should retain 16 for heavy dodge and6 guard. Heavy/light free. At close, no need blast/beam except punishes. At long range, blasts cost14 but can leave <16, risky if opponent rushes heavy. I can require ki>=30 for blast neutral, or if opp far and low threat. Start ki30 -> can blast once leaving16, good. Then forward. Natural regen. Charge if ki<16 and far, or if opponent back and dist>350. At start blast is good leaving16.
Beam neutral require ki>=80 perhaps, leaving30, and opponent not able to interrupt. If opp guard and far, beam160 chip but opponent can dash? at dist>200 cannot cross, likely guard/counter. Could be worthwhile when hp lead? no. Use beam as punish or when opponent guard + beam startup? Avoid clash unless advantageous.
Could use raw beam at dist>350 when opp charging or guard and myki>=70. If hit280/chip160, valuable. Startup30 means opponent has time to respond. A bot with guard default will block. My cost50 vs chip160 (more than 10 light equivalents) and opp ki15, good. But if opp counters beam with more ki, risk. Opp ki visible. Only beam if opp.ki<50 (can't counter) or my post ki > opp.ki +20 (clash advantage) and no dash cross (dist>=200). Also opponent could blast interrupt: at long range, their blast travel >? startup11+ travel, if startup at same time, may hit around30 and interrupt just before firing. Opp needs react; could. Use sparingly.

Time strategy:
timeLeft< perhaps600 and hp lead>100: play defensive, guard/back at long range, avoid beam/clash. But if merely guard, opponent heavy chip60 repeatedly. Back + blast to stall. At close, heavy mix needed. Could increase guard and dash_back.
If behind and time low: aggressive, use beam/heavy. At timeLeft<180 and behind, need attack. If ahead, back/guard.
If HP equal and time expires draw half win; okay.

Possible exploitation: I can win by time with blast chip etc. No need.

Should have exact state `.left` for free is0, and for attacks. `phase` reliable.

Memory:
Top-level:
```
let lastT=-1, lastAct='idle', rng...;
let oppLight=0,...;
let plan=null;
function decide(s){...}
```
No need tracking mostly. But can use repeated calls: state.me.state is previous held action. I can decide fresh.
Math.random each call perhaps okay.
Make sure no undeclared variables? JS file function. Use RULES global. Could destructure but safe.
Time performance trivial.

I'll design decide structure in detail.

Helper functions inside or top-level:
- `oppAttacking` etc.
- `canHit` estimates.
- `incomingBeam(s)`: beams.find(!mine) perhaps beam dir. Could be my beam too. If clash handled.
- `threatEta` for beam: compute distance from front to me along dir. Beam travels from opp to me. `gap=(me.x-b.front)*b.dir`? b.dir towards me. If front hasn't reached, gap>0. Each tick front +=dir30. My body pad30. eta=Math.ceil((gap-30)/30), min0. If beam already covering me I'd have been hit unless invuln; if I'm free and invulnerable false and beam b.hit perhaps already hit me? beams view doesn't include hit. If b.hit true after hitting me, I'd be down not free. If it hit someone? only me, so no. If I dodged with dash and now free behind, beam dir not toward me; gap perhaps negative. Not a threat. Should check `(me.x - from)*dir >=0` (I'm ahead of shooter) and front not passed. If behind, no threat.
- Opponent beam state startup no beam yet; handle.

Priorities when `s.me.state==='clash'` or s.clash.
Cancel first? clash can't cancel.
If me not free but canCancel only calls. I can just return safe if not free (except cancel/clash), though engine only calls when appropriate.

Defense ordering vs punish:
- If opponent heavy startup close, evade.
- If incoming blast eta soon, guard unless I can attack interrupt? Projectile already, guard.
- If active incoming beam, evade/guard.
- If opponent beam startup, attack/evade etc.
- Opp light startup close guard.
- Other punish.

Potential my held state forward/back etc and blast incoming with eta<=6 -> guard. Good.
If eta>6 but opponent close heavy, handle heavy first.
Beam active handling before blast perhaps.

Opponent heavy:
```
const hRemaining = 9-opp.t; // if startup
if (dist<=140 && phase!=='recovery') {
 if (opp.phase==='startup' && opp.t<=3 && dist<=105) return 'light';
 if (me.ki>=16) {
   if (dist<195 && wallAhead-dist>=60 && opp.t<=? ) return 'dash_forward';
   return 'dash_back';
 }
 return 'guard';
}
```
Should dash_back direction uses facing at choose, correct. If dist>140 but my forward held? I choose fresh, no move during attack except dash. Opp heavy static, so if dist>140 no threat. But light push? no. I can punish whiff recovery later.
If active and dist<=140, if I'm free at same tick before strikes and heavy hasn't hit (`a.hit` false) could dash. Good. `dash_forward` crossing might take time and invuln only8, active lasts4, so immediate dash even no cross could simply invuln through active (4 ticks) if late. If startup early and no cross, dash_back.
Use dash_forward only if crossing room and dist<195. Otherwise dash_back if wallBehind>30 or hRemaining<=7? Even with no room, invuln can cover if remaining+active<=8. hRemaining =9-t; attack ends active at13-t. If <=8, dash invuln covers entire. So dash_forward or back either. General dash_back.
Fallback guard.

Light threat:
If opp light startup/active and dist<=110: guard. Could light interrupt if opp.t? My light same/ slower; guard. If opp light active and dist>110, will whiff, can prepare punish but recovery later. Perhaps forward to close? Their recovery9, if dist<=140 heavy startup9 might hit late recovery if in range and active not hitting due dist>140 impossible. If dist between110 and140, heavy now: heavy active in9, light active only until t7 then recovery. Opp recovery left enough, heavy hits counter. So punish with heavy. If dist<=140 and opp light whiff (dist>110), heavy.
If dist<=110 guard.
If opponent light startup but dist>140, forward/blast etc.

Opp recovery/hitstun punish:
Should handle beam startup first because can interrupt.
Generic `vulnerable = ['hitstun','crushed','recover']` or move phase recovery.
- If down separate.
- If opp.state dash and moving invuln: don't strike; perhaps guard/forward. If recovery: punish.
- For blast startup perhaps not generic vulnerable? `mult` counter yes startup. Attack if can hit before blast release or trade. At close heavy can counter.
- Beam startup as above.
- Heavy startup if out of range: can forward or blast; heavy recovery later.
- Light startup out range: heavy if dist<=140 etc.

Calculate `remaining = opp.left`. For hitstun etc.
At vulnerable:
```
if (ki>=50 && opp.state==='crushed' && left>beamEta+2) return beam;
if (dist<=140 && left>9) return heavy;
if (dist<=110 && left>5) return light;
if (dist<=110 && left<=5) perhaps light? Opp will free before hit and could guard; if they were hitstun, at free their combo resets, my light may be blocked. Better guard or heavy? Heavy hits later but guard crush; use heavy if dist<=140. If they attack light after recovery, heavy gets interrupted. Guard safe. Perhaps return guard.
if dist>140:
  if blast useful and left > blastEta => blast
  else forward
```
For move recovery, if left <=9 and heavy attack starts, opponent becomes free and could guard, but heavy still good vs guard; could be attacked. Use light if can hit in time; else guard if close.
Counter damage: heavy preferable.
For `dash` recovery left8 max, light if left>5 and dist<=110; heavy cannot hit before free, but if opponent free can act. Could light at left8 hits with3 left, counter50 and hitstun. If dist110-140, forward/guard. Could heavy if they likely guard? Better wait? Use heavy at dist<=140 even if left>... Opponent at free immediately can guard or light. Heavy risky. Light only if enough. Otherwise guard.
For blast recovery left up to18, heavy if in140 and left>9; light if in110 and left>5. If dist140-260, dash_forward perhaps close and punish? Dash total18, opponent free before, not good. Blast counter? Both blast? Opp blastOut perhaps projectile. Better forward.
For beam recovery20, similar.

Hitstun and combo scaling: If opp left>9 heavy, if left<=9 but >5 light. If opp.combo>=? heavy damage scale. fine.
If opp.state==='crushed' and dist>140 but beam can hit, use.
Guaranteed beam condition:
```
function beamHitTime(dist){return 30+Math.max(0,Math.ceil((dist-70)/30));}
```
At close60, front after firing at start+30 moves from40 to70, body pad30, hits immediately same tick if inRay. so30. `left>30`.
Should note beam startup can be counter su12 if opponent beam aimed; only use neutral when none.
Raw beam on crushed uses cost50 and guaranteed unless opponent has down? crushed no invuln. Good.
On hitstun left20 and beam30 no.
Opp down left perhaps can beam timed: beam hit at30+travel; if down left roughly that, after gets up can guard. Not guaranteed, don't.

Close free mix:
Before mix, if opp.state guard:
- if dist<=140 heavy. Opp might switch but best.
- if dist>140, forward or beam/blast. At dist<=? heavy reach only static.
If opp.state charge:
- dist<=140 heavy.
- if dist<=220 and ki>=16 perhaps dash_forward? Dash18+ heavy9 =27; opponent can react. Blast better at long.
- blast if ki>=...; else forward.
If opp.state back:
- they are moving away each tick. At dist<=100 light perhaps hit? during startup they continue back because held state until their next decision; at their calls may change. estimated. Heavy if dist<=125? heavy active after9, +27 distance -> effective max113 if keeps back. But they might stop. If currently back and dist<=113 heavy. If dist110 etc, forward to close. Blast at long.
If opp.state forward:
- they approach. If dist<=132 light can hit at startup even if current>110. If current<=180 heavy. Choose mix.
If opp idle:
- static.

Guard self state: if opp idle and close, heavy mix. Opp may have chosen guard as held but visible. Good.
Use HP/ki and random:
```
let r=Math.random();
if (dist<=110) {
 if (r<0.42) return 'light';
 if (r<0.68) return 'heavy';
 return 'guard';
}
if dist<=140:
 if r<0.45 heavy; else if r<0.65 guard; else forward? light if opp forward...
```
Heavy same-time vs light loses; guard same-time vs heavy crushed60 but less than120. Expected okay.
Could use reaction to my last action to avoid predictable. Random.
Opp pattern adaptation: Track when opponent starts moves at close and my previous choice. Counts to weight counters:
- If opponent often light, guard more or light? Guard beats light, yields punish. If often heavy, light more (interrupt) or dash. If often guard, heavy.
But their current state reveals guard. Counts of recent attacks when my state close can help. Not needed.

Punish after blocking light: When I guard and opp light hits, I enter blockstun11, attacker light total17. On free at t11, opp light t11 recovery left6. My generic recovery punish: dist after push14 perhaps initial <=110 +14 <=124. light startup5 and opp.left6 => hit at5 just before free, counter50, good. So return light. If dist>110 (e.g124), cannot light, heavy left6<9 so not guaranteed. But I could heavy anyway; opponent free in6, likely their next decision immediate at t? They may guard/attack. At dist124, heavy could crush guard but lose to light. Alternative guard. This means blocking light at max range allows attacker no punish. Fine.
After guard crush (I'm crushed) no calls until free, opponent may pressure.

Whiff heavy punish: Opp heavy recovery22, at dist<=140 heavy. If I'm guard and heavy crushed? not free. If dash evaded behind, at my free perhaps opponent still recovery. Good.

Long neutral implementation:
```
if (dist>140) {
  const safe = !incoming and opp not close attack;
  // punish charge/guard with beam perhaps
  if (me.ki>=50 && beamConditions...) ...
  if (me.ki>=30 && !me.blastOut && dist>=170 && (r<...)) return 'blast';
  if (me.ki<16 && dist>300 && opp.state!=='forward') return 'charge';
  if (dist>320 && me.ki<70 && opp.state==='back' etc) charge/forward
  return 'forward';
}
```
If I only forward and opponent backs, I gain net1.5/tick, eventually corner. Good.
Blast frequency perhaps 50%. With ki30 start, if blast then recover. At next free dist same, ki~17, can't neutral blast threshold30, forward. Good.
After forward gains ki, blast occasionally.
Charge only if dist>380 and opponent not beam/blast, ki<60. If opp forward, charging until next call6 then reassess, fine. Could charge at start? My blast probability.
If opp guard at long range, blast chip, beam if conditions. If opp charge, blast quickly.
Beam neutral condition:
```
if ki>=50 && dist>180 && !incoming && (
 opp.state==='charge' || opp.state==='guard' && time... 
) && (opp.ki<45 || ki-50 > opp.ki+15) && random<0.25
```
But if opp guard, raw beam block160 and cost50. If opp.ki<15 guard crush still160+stun; good. If opp.ki<50 can't counter, but can blast interrupt or dash if dist<200. Dist>220 safe from dash cross. At D>220, they can dash_forward 200 closer but still ahead and beam hits after invuln, bad for them. They could dash_back but still eventually beam. Guard only. Their blast interrupt: at D300, from their reaction within6, blast release11 + travel18 ~29, could interrupt right before beam fire. They need choose blast. Risk. Still fine.
Use beam when opp.state==='crushed' guaranteed, or when opp.state==='beam' counter, or low hp to finish. Otherwise rarely (5-10%) to avoid.
If me.hp<450 rage ki gains, can more.

Beam response:
Opp beam startup at dist:
1 close dist<=140: heavy or light based remaining; heavy hits9. If dist<=140 and (`opp.left`? total left) heavy even if remaining startup <=9? It may fire before heavy but strikes and beams order; if heavy active same tick as beam hits? If beam already firing and ray may hit at tick before heavy active, could lose. But if close, at firing moment beam hits me immediately. Should have my heavy hit before remaining startup `r`. If heavy hit time9 <= r, then interrupts before/at firing. If r<9, too late; guard/dash. Light hit5 <=r. Use whichever. At r<=? Dash through safer.
2 if ki>=16 && dist<195 && room: dash_forward regardless (as above), then later punish. If r very small and beam active soon, still dash dodge.
3 blast interrupt if possible and beam not near.
4 counter beam if ki>=50 and power favorable. If I start beam while theirs startup, su = max(12, opp.su-opp.t). My startup matches remaining if >=12 else12. Fires together or later. Clash if fronts meet. Good.
5 guard.
At dist>140 but<195 dash through. Good.
At dist>=195, blast if can interrupt. Should compute `r=opp.left-60`. For startup normal. If r perhaps 30.
`blastEta=11+Math.max(0,Math.ceil((dist-40-30-13?)/13))`. At spawn, x me+40 then move13, opp body collision when distance between opp and blast <=30 or crossing. Initial gap after first move = dist-40-13 = dist-53. Should have <=30 => dist<=83 hit at release. Else additional ceil((dist-83)/13). So eta =11 + (dist<=83?0:ceil((dist-83)/13)). But blast spawn occurs at my state.t==11 in blasts phase. At start tick t0, after11 steps? Yes. Use approx. If eta < r (hit before firing) or <=r (strikes? blasts() before beams(); at same tick my blast hits in blasts(), sets opp down, then beams() sees state not beam and doesn't spawn because first loop `if a.state==='beam' &&...` false, removes existing; so <=r safe). Use if eta<=r and ki>=14.
Counter beam power evaluation: after my cost `mk=ki-50`, opp ki current. During startup both regen passive .04 unless state beam passive only. Opp same. So compare mk vs opp.ki. If mk > opp.ki+5 or hp rage etc. Also if my HP high? Clash risk. If opp.ki<10 and mk>20, favorable. If guard chip160 might be better than clash even favored. A clash win does320 vs guard160, loss takes320 vs guard cost; expected with p .65: .65*320 - .35*320 =96 damage differential plus? Guard outcome opponent loses160 me0 =>160 differential. So need p>.75 to beat. Also clash can draw120 each. Better guard unless I cannot pay15 or opponent low HP? Guard stable. But if me.hp low and behind, gamble. Use counter only if mk>opp.ki+20 (power +0.4) or my hp<450 and opp hp high? Random.
If opp beam active already and dist>=200: counter beam fires in12, but their beam might hit me before12 depending eta. If eta>12, counter possible; if eta<=12, guard/dash. Counter leads clash if beams meet before mine hit. Could use if favorable. Else guard.
Guard vs beam: Must be in guard before hit. My decide now sets guard. If beam eta0, beams() later same tick, guard works. Good.
If already holding guard and opponent beam startup, perhaps just guard from start, costs no until hit, passive ki .01/tick. Fine.

Active beam handling:
- If not ahead threat, ignore and punish opponent? If I am behind after dash, opp beam firing, dist60. Heavy startup9, beam can't hit behind. Generic vulnerable? Opp beam phase firing is not counter but can interrupt. Should attack: if dist<=140 return heavy; if dist<=110 perhaps light? Heavy120 and down, good, even if phase firing. This should be a high priority after active beam threat check. If opponent beam firing and no threat (I'm behind or beam hit flag?) and close, heavy.
- If threat and dist<195 & ki>=16 dash_forward.
- Else if ki>=50 counter if eta>12 and favorable; else guard.
- If my ki<15 and guard will crush, but perhaps dash_back if beam near end? Beam fire remaining inferred opp.left? Opp beam state firing, `opp.left = dur-t`, includes firing remaining+20. firing remaining=left-20. If firing remaining small and distance far, dash_back could avoid until end. But guard160 crush + stun vs280 hit; guard better.
- If me.invulnerable? free can't invuln except down/dash not free. no.

Blast incoming + my ability to punish: guard.
If blast eta>6 and opponent beam? etc.

Down handling:
If opp.state==='down':
- if dist>135: forward, unless dist>250 and ki high? Could blast timed but no.
- if dist<=140:
  - if opp.left<=12 && opp.left? heavy.
  - else if me.ki<30 and dist>?? charge while waiting? At close charging when opponent down safe, good. Charge gains. But if left small (<12), heavy. If left>12, charge to build ki. At next calls update. This is free ki. However charge state when opponent wakes and my heavy startup? I choose heavy in time, fine.
- if dist 140-? forward. If wall etc.
- Could dash forward to close if dist>300 and ki abundant? Walking during42 ticks max189, heavy knock distance perhaps300; after my free only16 ticks left, can't. Dash could close200 in10 and recover8, exactly. If opp down left>=20 and ki>=40, dash_forward might land near/cross but opponent down invuln, dash can cross. Then punish. But cost16, perhaps worth to maintain pressure. Use if dist>240 && opp.left>20 && ki>=40. If down left<=20, forward or blast.
- At very long and low ki, charge.

My own state me.free always true. If me.state==='charge' and opponent attacks, reactions fine.

Endgame defensive:
Could modify close mix and long. If `ahead = me.hp-opp.hp`.
- timeLeft<300 and ahead>0: at long dist return back/guard, no blast perhaps blast to chip. Opp forward closes. At close guard reaction heavy. But only guard and heavy punishes; if opponent idle, perhaps back. Use back if wallBehind>0 and dist<180, to run. If cornered guard/mix.
- If ahead large >300 any time, can play safe but not necessary.
- If behind and timeLeft<300: increase heavy/blast/beam, no charge.
A time win strategy may be valuable. Implement late:
```
if (timeLeft<360 && hpDiff>80) {
 if(dist>170) return me.ki>=... && random<.2 ? blast : (opp.state==='forward'?'back':'guard'?); 
 // At long, back to run; wall eventually.
}
```
Backing speed3 vs opp forward4.5, stage 920 can stall long. But blasts etc. At close, guard default and only heavy if opp guard or vulnerable. Good. If HP behind late, aggressive.

Should I just output ~350 lines? Desired code can be 200 lines. Make sure response no explanation.

I'll test mentally standard match:
Start t0 both free dist300, opp unknown. My long branch: perhaps blast if ki>=28 and random<0.55. If blast, state startup. Opp may forward/blast etc. If opp light? no. At t29 free, positions same if opp idle, dist300. My ki ~17, forward. Opp blast incoming guard etc. Eventually close. If no blast, forward. Every6 calls. Opp may be guard. At dist<=140, if opp guard heavy. Heavy hits 120 (or crush60 if still guard). Actually heavy on guard does60, not120. I earlier said heavy120 vs guard but crush60. Heavy on free120. So heavy guard only60 + stun34, can follow up. During crush, my heavy recovery: heavy hit at9, opp crushed34 until43, attacker free at35, opp left8. At dist after crush no knockback, still <=140. My generic crushed: heavy needs left>9 false, light if dist<=110 and left>5 perhaps true -> light hits before crush end, damage combo? Crushed didn't increment combo, hurt crushDamage but o.combo not increment, so light40, stun. Could cancel combo. If dist>110, can guard/wait. Beam impossible. Perhaps at free after heavy crush, opponent left8 and dist same e.g140, I can light only if <=110, else forward to range then next call? Opp free in8, my forward 6 ticks reduces27 to113, next call at6 dist113, light still >110, heavy? Opp left2, no. Could just heavy timed as they free, crush guard again. Fine.
Heavy crush total60 vs light blocked punish, okay.
If heavy hits free opponent, knockdown and120.
Light combo damage as above.

Generic crush branch might choose light when left>5; after hit, combo push etc. Good.

My random close heavy against light: Opp light hits me at5 while heavy startup, damage50 counter, hitstun15. Opp can cancel; their dist after push perhaps+14. I eventually recover. Not awful.
My light against heavy: at5 counter50, hitstun, cancel combo. Good.
My guard against heavy:60 crush, then opponent can punish. My guard against light: block, possible punish.
Random weights perhaps guard40%, light35%, heavy25 to reduce. Opponent guard visible heavy always. Opp forward likely aggressive; guard more. Opp idle unknown. I can set based my hp.

Ki costs and dash: Heavy evade uses16 often; if guard default and opponent heavy spam, I dodge until ki low then light interrupt/guard. Walking forward regains. Fine.

One potential bug: Rules global perhaps not in strict? available. Use `const R = RULES;` inside. Top-level variables reset. No module.

State `opp.left` for hitstun etc accurate. `opp.free` field. Use.

I'll structure functions top-level to avoid recreating? Fine.

Detailed pseudo:

```
let lastAction='idle';
function decide(s) {
 const R=RULES, me=s.me,o=s.opp,d=s.dist;
 let a;
 if(s.clash||me.state==='clash') a=...
 else if(me.canCancel) a=...
 else {
   const incoming = ...
   const beamThreat = ...
   const heavyThreat = ...
   ...
 }
 lastAction=a; return a;
}
```
No need lastAction but perhaps use random streak. Could track `lastT` and `closeSeen` to adapt. Not necessary.

Cancel if d<=140 heavy else if d<=110 light? Order light first. If o.invulnerable? Light hit implies not down. Good.
If chain<4 && d<=108 (floating tolerance) light. At d110 exactly hits. Push calculations. Use109? State rounded .1, okay. `d<=110`.
If d>140 after light weird knockback? Could blast if ki>=14 and o.hitstun left? At cancel view o.left perhaps14. Blast won't hit before stun if far; but can still projectile as they recover. Better return blast if available, else idle. Heavy whiff if d>140, so don't.
If me.ki>=50 and o.hp low? no.

Clash push logic above.

Incoming blast detect `b.incoming && b.eta !== null`, min eta. At eta<=6 guard. But if o heavy startup too, heavy threat should priority. If eta0 and heavy startup, blast hits now; dash can dodge both if enough. Heavy branch dash works. If guard fallback would block blast then heavy later crush perhaps. Fine.
Perhaps guard incoming blast even if opponent charge and I planned heavy. Good.

BeamThreat compute only active beams. Opponent beam startup handled later.

Order:
1 clash/cancel
2 active beam threat
3 heavy threat
4 incoming blast soon
5 light threat
6 opponent beam startup/firing
7 vulnerable/down
8 free mix/neutral.

Opp beam firing with threat is covered active beam. If beam state startup but an active beam already? no.
Opp blast startup and light etc not defended until projectile appears, but can interrupt in vulnerable? `startup` not generic. Add close startup attack:
```
if ((o.state==='blast') && d<=140) {
  let release=11-o.t;
  if(d<=110 && 5<=release) light;
  if(9<=release) heavy; else guard? 
}
```
At close if release soon and my attack too late, guard. Blast collision point-blank at release, guard needed.
For heavy I handled.
For light guard.
For beam handled.
For dash moving: guard? If opponent dashes through, at close I should idle/guard? Attack invuln wasted. Could if d<... return guard until recovery; but if they land behind and attack, my facing auto at free after each step, choose faces them. Guard works front after auto. Good.
If o.state==='dash' && o.phase==='moving':
 - if d<=140 perhaps guard (but heavy not), avoid attacking.
 - if far, forward/charge? guard okay.
This prevents wasted moves.
Opp blast recovery etc generic.

Generic vulnerable:
```
const moveRec = (o.state==='light'... ) && o.phase==='recovery';
const stunned = ...
if(stunned||moveRec|| (o.state==='beam'&&o.phase==='firing'&&!beamThreat)) {
 ...
}
```
For o.state blast startup at far, no.
For o.state heavy startup out of range, not vulnerable; could forward. If d>140 and they will whiff, move forward to punish but might enter range? If I walk forward while heavy startup, could enter140 and get hit! Better stay guard/back until recovery. If o heavy startup and d<=180, guard or back; if d>180 forward perhaps. At d150, heavy would whiff if I stay, but forward6*? Could enter range before active and be hit counter. Return guard/idle. So add if heavy startup/active but d>140:
  if d<190 return 'guard' (heavy doesn't hurt guard if out range; no movement) and wait.
  else neutral forward perhaps but stop.
Similarly light startup out range d110-160: if d<=140 heavy punish as above, if d<160 idle to avoid walking into light. Good.

Punish recovery generic heavy if enough time. Use `left` but for hitstun from light at close, etc.
```
if (d<=140 && (left>9 || moveRec && o.state==='heavy'? etc)) heavy
if (d<=110 && left>5) light
if (d<=140 && left<=...) {
  // delay: if left>0, idle/guard; perhaps heavy timed to hit just after?
  return left>2 ? 'guard' : (random mix)
}
```
If move recovery and left<=9, guarding wastes punish but safe. Could use heavy if opponent likely guard? I don't know. Use light if range. Else guard.
If d>140 and stunned:
- beam if crushed and guaranteed.
- blast if can hit before left and ki>=14.
- forward.
For move recovery at d>140, forward to close.
If o.state hitstun and d<=? blast can extend.
Guaranteed beam check should happen before heavy if crushed and ki high? At close heavy+follow perhaps 120 + pressure vs beam280; beam better. `beamTime(d)<left` then beam. Cost50, use if ki>=50. If o.hp<... etc. Always.
Could beam on move recovery if left20? beam30 no.
On crushed left34, at d up to120 beamTime30, yes. At d200 beamTime35 >34 no. Heavy if close.

Down branch before vulnerable (down invulnerable).
Opp `recover` has left20, punish.

Close free mix should handle o.state guard/charge first, and perhaps time.
- o.guard and d<=140: heavy. If d<=? could dash_forward cross to back and light? Heavy easiest.
- o.charge and d<=140: heavy.
- If o.free back etc.
- If o.state `idle` and o.ki etc no.

Long beam punish/neutral before free mix? At d>140:
- if o.charge and me ki>=14 blast (high priority).
- if o.guard and me ki>=50 and d>220 etc random beam.
- if low ki charge etc.

Endgame ahead modification can be in free choice:
```
const protect = s.timeLeft<420 && me.hp>o.hp;
if(protect){
 if(d<150 && o.state!=='guard') {
   if(me.wallBehind>20 && d<100) return 'back'; // but at close if opponent heavy/light startup handled
   return 'guard';
 }
 if(d>=150 && d<300) return 'back'; 
}
```
But if o.guard and d<=140, heavy still deals60; no risk? Opponent might switch light and interrupt. In protect perhaps back.
No need overdo.

Random neutral blast probability and beam:
```
if(d>140){
 if (me.ki>=50 && d>220 && (o.state==='guard'||o.state==='charge') && o.ki<40 && Math.random()<0.18) return 'beam';
 if (me.ki>=28 && !me.blastOut && (o.state==='charge'||Math.random()<0.42)) return 'blast';
 if (me.ki<14 && d>280 && o.state!=='forward') return 'charge';
 if (d>340 && me.ki<65 && o.state==='back' && random<.5) return 'charge';
 return 'forward';
}
```
At d145 and opponent guard, heavy out of range, forward. Good.
If opp forward and d<=180, close mix heavy perhaps.
Effective range:
```
const approaching = o.state==='forward';
const lightRange = 110 + (approaching?18:0) - (o.state==='back'?12:0);
const heavyRange = 140 + (approaching?32:0) - (o.state==='back'?24:0);
```
At close branch trigger if d<=heavyRange or d<=160.
If d<=lightRange:
 random light/heavy/guard. If d>110 and choose light based approaching, if they stop at same tick, whiff. That's okay.
If d<=heavyRange:
 heavy 45, light if actual<=110 else not, guard/back/forward.
If d>... long.

One major tactic: Opponent free `guard` at d>140 but approaching? guard stationary. long.

Could use forward while close? If choose forward at dist60, separate min gap, no effect but regen .08. Guard loses ki. Not needed.

HP finish: If o.hp<=40 and close, light/heavy; if o.hp<=160 and beam guard chip can KO, use beam when safe. At long, if o.hp<=160 and me ki>=50 and d>200 and o.ki<50, raw beam guarantees KO if they guard or hit unless dash/blast interrupt. Good. Add beam if o.hp<=160 and random<.5 or always under conditions. Could win.

Blast if o.hp<=12 and guard chip, etc.

No validation concerns.

Could simplify code to around 260 lines. I'll output code only +宣言. I should ensure no comments too verbose? Fine.

I'll assess beam clash push more. `s.clash.myPower` includes push previous. At ki<=6 stop. If opponent power much higher and pos near me, push all remaining. Code:
```
if(me.ki<=0.05)return'idle';
if(c.pos<0.18||c.pos>0.7)return'push';
if(me.ki>7)return'push';
return 'idle';
```
At pos>0.7 near win push remaining. Good.
If opponent not pushing and I stop at7 with pos0.5, reserved power1.14 vs opp perhaps1+; eventually drain. Could lose if opp pushing? They'll empty. Fine.

Active beam threat eta compute:
```
for (const b of s.beams) if(!b.mine){
 const ahead=(me.x-b.from)*b.dir;
 const gap=(me.x-b.front)*b.dir;
 if(ahead>=-30 && gap>-30) ...
}
```
If beam front passed me but I was invulnerable and now free? Could still be in ray; beams would have hit when invuln ends. I only called free after dash recovery t18, beam might still be covering from from to front beyond me; if I didn't cross and in ray, I'd have been hit at invuln end. So no.
Simpler `if ((me.x-b.from)*b.dir>=0 && (me.x-b.front)*b.dir> -R.body)` eta...
Should not eta except counter decision. `beamEta=Math.max(0,Math.ceil(((me.x-b.front)*b.dir-R.body)/30))`.
If gap negative <=30, eta0.

Dash cross condition `d<200 && s.wallAhead-d>=59`. Note `wallAhead` is based me.facing. me.facing always opponent. Room beyond opponent = wallAhead - d. If opponent near wall but d large etc. Good.
For active beam with d<200, dash. If not, guard. If counter beam conditions before guard? Could include.
```
if (beamThreat) {
 if cross && ki>=16 return dash_forward;
 if (ki>=50 && beamEta>12 && ki-50>o.ki+20) return beam;
 return guard;
}
```
If beam eta0 and d<200 dash immediate safe as above.
If d>200 but dash_forward could move200 and reduce distance to <... not cross, no.
If wallAhead-d<60 but dash invuln and beam only active few ticks? Could dash still avoid? Not needed.

Opp beam startup branch:
```
const r=Math.max(0,o.left-60);
if(d<=110 && r>=5)return light? Heavy120 better if r>=9.
if(d<=140&&r>=9)return heavy;
if(cross&&ki>=16)return dash_forward;
if(ki>=14&&!blastOut&&blastEta<=r)return blast;
if(ki>=50&& ki-50>o.ki+20)return beam;
return guard;
```
At d<=110,r>=9 heavy. If r=6, light. If r<5 and cross unavailable, guard. If d<=140,r=6 no light if d>110, guard.
If opponent beam phase firing but no beamThreat, generic heavy close; if far guard/forward. Could own beam active? ignore.

Blast interrupt of beam: firing own blast makes me unable guard if it doesn't interrupt; condition exact. Good.

BlastEta at d300 =11+ceil217/13=11+17=28 <=r30, hits at28 and interrupts. So at start if opp beam and I have14, blast is optimal. At d500 eta11+32=43>30 can't. Counter/guard.
If opp used counter startup12, r perhaps12, blast can't; fine.

Heavy threat and light interrupt: If o.t<=3, d<=110 return light. If o heavy is in active, o.t>=9 no. Dash.
If ki<16 and o.t<=3 but d>110, guard. Fine.
Cross dash uses room.
If d>140 but <=190 return guard; heavy whiffs and then punish. If o.phase recovery generic.

Light threat active at d<=110 guard. If light startup d>110 && d<=140, heavy if startup? Heavy hits9, opponent light whiffs and recovery; good. Condition r etc. If o light active and d>110, heavy hits in9, total remaining until free perhaps (17-o.t). At active t5, left12, heavy hits when left3 recovery => counter. Good. So return heavy.
If d<=110 and o.light startup but my light could beat if their t high? guard safe.
If o light whiff d110-140 heavy.

Incoming blast check before light threat might guard anyway.

Opp blast startup close:
- If d<=140:
  release=11-o.t. If d<=110 && release>=5 return light (counter50 + combo)
  if release>=9 return heavy
  else return guard (blast will spawn point blank, block)
At release=7,d<=110 light hits at5, good.
At release=7,d120 heavy too late, guard.
If o.phase recovery generic.
At d>140, no special; neutral blast perhaps own projectile, forward could get hit. Incoming guard later. Fine.

Dash moving: return guard if d<220, else neutral. If opp dashes away, guard wastes few ticks but okay.

Vulnerable beam: On crushed, beamTime formula. Use `R.beam.startup + Math.max(0, Math.ceil((d-70)/R.beam.speed))`. At d500 =30+15=45. If left>time+1.
Blast stun eta formula.
Generic if o.state hitstun etc and o.left perhaps0? If left>... attack.
If move recovery and d<=140 but left<=9, I might return guard. Good.

Down charge: If d<=140, left>12, return charge. This builds ki while safely down. But if I am at ki100, return idle. If o.left=13, next call in6 at left7 -> heavy, active at9, opponent free in7 and could act for2 ticks before heavy active. They can light at getup: light startup5, heavy hits at9 after their free2 -> heavy active before their light active, so okay. They can guard -> crushed. They can dash -> avoid. Good. If heavy starts at left12, opponent free at12? active at9 while down? Should have exact left semantics perhaps at current down.t, dur-t. Each tick end t++, if t>=dur free. If left=12, after12 ticks free. Heavy active at9-12; at t9 down invuln, t10,11; at t12 free and can act then heavy active hits. Good. Fine.
If d>140 but <=160 and left<=12, heavy may whiff; forward.
If d>240 and left>20 dash_forward; opponent down invuln, crossing could land behind and at getup facing? I auto face after free. Fine.
If no ki and far, charge only if left>20 else forward.

Free guard heavy logic before endgame.
Protect lead:
At close if o.state guard heavy still. For o.idle etc and protect return guard/back. But I may time out with hp lead.
At long protect return back if wallBehind>10, else guard; blast incoming handled. Opp charge can beam etc but I might want blast interrupt. In long branch before protect perhaps blast if o.charge.
Could ignore protect complexity to avoid passive draws. Still include modest.

Random close weights:
```
let r=Math.random();
if(d<=lr){
 if(o.state==='forward'){ if(r<.45) guard; if(r<.75) light; else heavy;}
 else {if(r<.4)light;if(r<.67)heavy;else guard;}
}
if(d<=hr){
 if(r<.5)heavy;
 if(r<.75)guard;
 return d>135?'forward':'light'? 
}
```
At d120 light out range, don't return light. Use back/forward.
Perhaps `idle` in guard? Guard costs. Guard good.
If me.ki<6, guard light will crush on block (0 dmg? light guard pay insufficient: no chip because light M.chip undefined, so crushed no damage! Important: guard broken by light when ki<4: no chip, stun34, no damage. Heavy guard60. Guard with low ki vs light results free stun no HP. Opp can punish during stun. Still).
Heavy needs no ki.

Long ki: Blast neutral threshold 28. If o.state charge, use blast with ki>=14 (even lower) because90 damage if hit. If me.ki<14 and far charge.
At dist>140 but opp forward, blasting can be risky: they walk during startup/recovery, close distance. If d150 and I blast, opp walks, by release dist perhaps100 and point-blank, then I'm recovery and they can punish. Better only blast if d>=220 or o.state not forward/back static? At d145 guard etc, forward. Condition `d>190 || o.state==='charge'` for neutral.
At d>190 and opp forward, by 11 ticks closes49.5, release at d140, projectile travel short, hits/block while I'm recovery. Opp hitstun20, my recovery18 after release, so I free around same, safe. If guard blockstun14, they free4 ticks before me, but distance pushed? Blast block no push, at d~140, they can heavy startup and hit after I'm free perhaps. Fine.
Walking forward after blast? no.

Charge safe if d>300 and o.state!=='forward' and no blasts. If opponent charge too, both build; fine. At start if I choose charge with ki30? condition ki<14 false, so only forward/blast. Good.
Could charge at high dist to100 when opponent guard passive: condition `d>360 && me.ki<60 && o.state!=='forward' && random<0.35`. Useful.
Natural ki with forward enough.

Counter raw beam neutral:
```
const safeBeam = d>230 && me.ki>=50 && o.ki<45 && !me.blastOut? beam not limited by blast
if ((o.state==='charge'||o.state==='guard'||o.hp<=160) && safeBeam && Math.random()<0.22) return'beam';
```
If o.state charge, they can stop and guard. Still.
If my ki100 and opp ki0, beam great. Always perhaps .35.
Opp could be idle, not included except low hp.
No reason `blastOut` affects beam? Beam can fire while own blast exists, yes beam swallows only opponent, my blast remains. Fine.

Time end and HP diff: if timeLeft<120 and ahead, no raw beam. If behind, more beam.

I should perhaps avoid Math.random usage causing inconsistent tactic tests but okay.

Top-level last variables perhaps track `last` to prevent repeated forward? Not needed.
Could add taunt? no.

I'll review engine ask cadence: If holding `guard`, wants every6. If choose `heavy` invalid? heavy always. If `dash_back` with ki insufficient, invalid keeps prior state. My checks ki. Blast check me.blastOut. Beam ki.
When cancel heavy and d<=140 always valid.
When o down and I charge at ki100, valid state, fine.
No actions when not free except cancel/clash; my decide may be called only then. If somehow not free and no cancel returns guard? choose called? wants false, so no.
`me.free` true in held states. Fine.

Guard direction: choose() calls face before start, so active beam behind check etc.

One potential strategy improvement: When opponent guard and dist<=140, heavy may be interrupted if they switch light same tick. But visible guard held means if they are also called this tick they can switch. Can't avoid. Randomize 80% heavy,20% light? Light into guard if they stay, bad. Heavy is correct. Always can be exploited by opponent who sees my pattern? They don't see my decision until simultaneous, but know deterministic and state, could switch light every time I heavy. Since their bot could hardcode against common logic. Randomize heavy 80%, guard20 to reduce. But guard vs their light blocks, good; if they stay guard nothing. Use heavy 85%. Charge heavy100 because charge hit1.5 and they may switch; random perhaps.
Opp state `charge`: if they switch light, heavy loses. Light would counter their charge? Light startup5, if they stay charge damage60 and combo, if switch light trade. Guard if they switch heavy? etc. Heavy best.
No need paranoia.

I need deliver code and short宣言. "一瞬千金，拳无空发。" 9 chars. Or "先守其心，再破其势。" Good. <=20.

Before respond, perhaps consider use of `RULES` if code sandbox wraps and top-level `const` okay. Yes.

I'll formulate the code for the response with comments moderate.

I should not include extra text. Code length okay.

I'll write carefully syntax.

Detailed active beam function in decide:
```
let beamDanger=null, beamEta=999;
for(const b of s.beams){
 if(!b.mine && (me.x-b.from)*b.dir>=-R.body){
  const gap=(me.x-b.front)*b.dir;
  if(gap>-R.body){...}
 }
}
```
If gap= -20 (front 20 beyond center), body still covered, danger eta0. If gap<=-30 front passed >body, likely already hit; ignore. Good.
Cross condition function `canCross = d < R.dash.dist && s.wallAhead-d >= R.minGap-1`.
dash_forward from active beam at d199 crosses if room. fine.

Opp beam startup r via o.left-60. If o.left is0? no.
Opp beam firing no danger (behind) handled in vulnerable with `o.state==='beam'&&o.phase==='firing'`, heavy close even left perhaps >? `left` includes40+20, heavy hits. If far and own blast could interrupt: blast if eta <= firing remaining? Could add:
```
if(o.state==='beam'&&o.phase==='firing' && d>140 && ki>=14 && blastEta(d)<o.left-20) return blast;
```
But if beam behind me, my facing toward opp behind, my blast fires toward them and hits, good. Nice but rare.

Generic vulnerable includes startup? I handled blast/beam, heavy/light. Dash recovery. `recovery` for blast etc.
```
const rec = (o.state==='light'... ) && o.phase==='recovery';
const helpless = ...
```
If o beam firing and beamDanger null, include. If o heavy active out range? not.
For `recover` phase null, counter mult1 but stun.
Beam on crushed first.
If d<=140 and o.left>9 heavy. For o beam firing left>... heavy. Good.
If d<=110 and o.left>5 light.
If d<=140 and o.left<=9 but rec and o.state heavy perhaps choose light if range etc else guard.
If d>140 and helpless hitstun, blast if eta<left.
Forward.

When o.state light startup d>110 & d<=140 heavy before generic (not rec), add in light threat:
```
if(o.state==='light' && phase!=='recovery') {
 if(d<=110)return guard;
 if(d<=140)return heavy;
 if(d<160)return idle;
}
```
If o light active and d120 heavy hits recovery. good.
Heavy threat d<=140; d>140 d<190 idle/guard. If o heavy phase active and d150, returning guard, next call recovery punish.

Blast startup release conditions. At release=11 and d120 heavy hit9, counter150 and knockdown before projectile, good. At d100 release7 light hit5, good.
If release<5 and d100, guard; projectile spawn point blank in <5, block.
If d<=140 release=6 and light could hit5 but condition d<=110 yes, good.

Order incoming blast before these means if existing projectile near guard.

Down branch after vulnerable? down not vulnerable generic, okay before.

Endgame protect after guard/charge reactions and before random.
At close o.idle, protect guard. At long o.charge, neutral blast perhaps before protect. Fine.

Close branch trigger:
```
const lr=110+(o.state==='forward'?20:0)-(o.state==='back'?12:0);
const hr=140+(o.state==='forward'?35:0)-(o.state==='back'?24:0);
if(d<=hr || d<165) { ... }
```
If d160 and o.idle hr140 but d<165 enters; d>hr, then return forward perhaps. Good.
If d<=lr and choose light when d>110 due forward. okay.
If d<=hr heavy.
If d between lr and hr and random heavy etc.
If d>hr return forward.

Protect if d<180 and lead: if wallBehind>30 return back else guard. At d60 back separates perhaps, fine. Opp can chase.
At long protect later back.

Neutral low hp beam etc.

No semi issues.

Do I want `lastAction`? omit top variables entirely except function. Requirement top-level code per round fine. Math.random no memory. They expect variables optional.

Can include `function blastEta(d)` top-level using RULES? Define inside helper with R global at call. Simpler inside decide local functions? Arrow allocations per call negligible. Top-level:
```
function blastTravel(d){...}
```
Uses RULES global. Fine.
All code complete.

I might include random mixture but same seeded generator used by beam clash? Each bot Math.random seeded separately likely. No issue.

One more thought: Heavy counter against o.state charge at d<=140 deals180 and knockdown; excellent. Blast charge deals90.
Raw light combo initial hit when opponent forward and d120 at active perhaps they've closed to97.5, after push111.5 >110 so cancel heavy at111.5, good. total136.
At initial d60, four light pushes: after hit d74,88,102,116; all next lights before pushes d74/88/102 <=110, fourth hit at102->116, heavy at116. total174. Great.
At wall, push apart attacker back also d+14. yes.
No chain beyond4.

Cancel when chain=4 d<=140 heavy. Good.

Perhaps optimized combo should stop at3 and heavy? Damage:
4light+heavy174.
3light+heavy:98 + heavy at combo3 scale.55*120=66 =>164. so4 better.
2light+heavy:72+78=150.
1light+heavy136.
Fine.

Heavy after hitstun with combo scale etc good.

Ki gained enough.

Now respond.