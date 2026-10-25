I'm working through the fighting bot's core mechanics—comparing light attacks (fast but weak, 17 ticks, 40 damage) against heavy attacks (slower at 35 ticks but hitting much harder with 120 damage and knockdown potential).

I'm also checking on special resources like blasts, beams, and dashes, each costing ki and offering different damage/positioning tradeoffs. The trickiest part is figuring out the decision timing: since free states are only re-evaluated every 6 ticks, I need to trace exactly when an opponent's heavy becomes active so I can react in time, and I'm working through whether a light-hit-into-cancel-light combo actually chains given the hitstun window.

I'm now mapping out combo damage scaling across different chain lengths—light×1 through light×4 followed by a heavy—to see which sequence maximizes total damage given the pushback distance and reach limits, while also weighing whether ending with a blast or beam instead of a heavy would be more efficient.

A beam finisher has a 30-tick startup, which is risky since the opponent's hitstun only lasts 15 ticks—so they'd be free to guard, dash through with invulnerability frames, or even interrupt during the startup. Still, if blocked, the beam's chip damage and guard-ki cost are substantial, making it tempting despite the risk, though I also need to track how pushback from each light hit stretches the distance toward the heavy's reach limit.

If the initial spacing is around 100, four lights pushing 14 each time would push distance beyond the heavy's 140 reach, meaning the heavy would whiff entirely and leave me punishable during its long recovery. So I need to check spacing dynamically at each cancel point—heavy only connects if distance stays at or under 140, light only if under 110—accounting for wall pushback and the fact that light attacks don't cause knockback movement during hitstun. I'm also factoring in combo scaling, where a heavy landing as the fifth hit gets reduced to 0.45 damage multiplier, and considering the six-tick decision cadence governing how quickly I can react with a light attack from neutral.

Since both bots' ask cadence resets to the same six-tick intervals whenever they're freed from an action, if I'm synchronized with my opponent, my light startup of five ticks means they literally cannot react in time—their next decision point won't come until after the hit already lands. That makes an unreactable light a powerful option when both bots are in sync.

For a heavy, though, the opponent's next ask comes before the heavy's active frame, so they can react: guarding won't stop heavy damage, but they could counter with a light (too slow to beat my heavy's startup), dash through the active frames since their invulnerability window covers it, or walk back out of my heavy's reach given its range. I also note that any hit or "free" state resets the ask timer to fire on the very next tick, which breaks the synchronized cadence between the two bots.

Working through the timing example: a light attack lasting 17 ticks frees up the attacker at T+17, but their opponent might get asked at T+18, creating a drift in cadence offset between them. On defense, guarding is the default posture — it blocks lights, blasts, and beams at varying ki costs, but heavies break through guard entirely, stunning for 34 ticks and dealing 60 damage, which opens a follow-up window during the heavy's recovery.

After landing a heavy, the attacker recovers in time to chain a light into the still-crushed opponent, and since crush-stun doesn't increment the combo counter, that light lands at full damage — pushing total punish damage from a guarded heavy up to roughly 174. That makes guarding against heavy-capable opponents risky at close range, so the real counter is timing: since light startup (5) is faster than heavy startup (9), a light thrown at or after the heavy begins can beat it outright.

In a simultaneous exchange, my light active at T+5 beats their heavy active at T+9, hitting as a counter (1.25x, 50 damage) and canceling their heavy into hitstun I can combo from — so light beats heavy, heavy beats guard, and guard beats light. Working through the light-vs-guard exchange: blockstun lasts until T+16, blocker is free one tick before the attacker (T+17), giving the defender a slight frame advantage in that exchange, and if the blocker throws a light back it's active at T+21 while the original attacker could still guard by T+17.

Now checking the mutual-light trade case: both hit at T+5, both take 40 damage into hitstun, and I'm tracing through the order of operations to see which fighter keeps their cancel flag — since the code processes hits sequentially, the first fighter's cancel gets set true, but then the second fighter's stun() call overwrites it back to false on the first fighter, so only one side actually retains the cancel after a mutual light trade.

I'm also weighing range differences: light attacks reach 110 while heavy reaches 140, so heavies outrange lights in that gap, which matters for spacing decisions. Then I'm working through the zoning tools — blasts cost 14 ki and travel at 13/tick, dealing 60 damage with 20 hitstun on hit or 12 chip/6 ki recovery if blocked, and can be canceled by clashing with another blast or dashed through. Beams are much stronger at 280 damage (160 chip if blocked) but have a long 30-frame startup and can be interrupted by any hit, so I'm considering how the opponent could respond — clashing with their own beam, or dashing through with invulnerability frames to close the distance.

I'm running the numbers on whether a blast thrown in response to my beam startup can actually land in time: at 300 range, the blast's travel plus its own startup comes out close to 29 ticks, right at the edge of my 30-tick beam startup window, so it's a risky but plausible punish. If the opponent's blast connects during my beam's startup, I eat a 1.25x counter multiplier — 75 damage, my beam gets interrupted, and I lose 50 ki, which is a costly outcome I want to avoid. I'm also thinking about how a dash-through with 8 ticks of invulnerability interacts with the beam's 40-tick firing duration, since the invulnerable frames might not be enough to fully clear the beam's active window.

A counter-beam could clash, which is roughly a 50-50 gamble weighted by ki, but it costs me 50 ki either way. Guarding instead costs 160 chip damage plus 15 ki, risking a guard crush if my ki is too low, but that's still better than eating the full 280 hit and a knockdown.

At close range beams are actually punishable since a light attack interrupts the startup for a huge counter-combo, so beams only make sense from long range. At long range, catching an opponent mid-charge is devastating since charging state multiplies damage 1.5x.

With five other AI bots likely running rush-down, zoning, or beam strategies, I want something robust that can stall a lead using the time-based win condition, so I'm starting to sketch a strategy around clash thresholds and when to commit to pushing.

Now I'm working through the clash mechanics themselves -- how pushing costs ki but boosts power immediately, how velocity and position evolve with decay and noise over the course of a clash, and what that implies about how far apart fighters need to be to actually connect.

Pushing drains ki twice as fast as not pushing, so with ki 20 I could sustain a push for about 25 ticks versus lasting the full 100 if I conserve. The real tradeoff is sustained power versus duration — pushing while ki lasts gives a big edge, but running out leaves me stuck at minimum power, so I should push selectively based on whether my ki reserve can outlast the opponent's.

I can infer whether the opponent is pushing by comparing their reported power against the baseline formula tied to their ki and rage — if their power is higher than ki alone explains, they must be pushing. Since I know their ki and hp, I can detect this and react. The collision point matters too: it ranges from 0 at my position to 1 at theirs, so a point near 0 means I'm about to take the hit. A reasonable heuristic is to push whenever my ki is above some threshold like 4, and push more aggressively any time the danger point creeps close to my side.

Rather than overthink it, I'll go with a greedy approach: push whenever ki is available. Running the numbers on ki drain rates and power differentials, pushing gives roughly a 0.6 power advantage that decays over time as ki depletes, so there's a window where pushing is clearly favorable before my ki runs out and the advantage flips negative.

That's quite small actually, so the reversal effect of -0.8 would dominate, giving a steady velocity of -1.6, which seems off. Checking the noise side: per-tick velocity shoves with sd 0.8 build up position spread much faster than drift at first, roughly reaching sd~58 by 25 ticks, so noise swamps drift early on and conservation/ki differences only matter over the long run, like a full 360-tick draw where a 0.2 power gap yields steady v=0.4.

That compounds to about 144 position units over a full clash, which is significant. So the smarter play is to spend ki in short bursts near the end or when danger is close, since sustained pushing costs 0.012 power per tick for the remainder, breaking even only if under ~50 ticks remain -- meaning bursts are worth it when the clash is near resolution.

I'll set a rough heuristic: push when position is near either extreme (to save myself or finish the opponent), or when ki is already low enough that I should spend it before it drains away anyway, otherwise hold ki and let power decay normally.

Now I'm weighing beam clashes - deciding whether to guard, counter-beam, interrupt, or dash when an opponent fires, since each has different ki costs and win/loss payoffs. I also need to account for unknown opponent behavior and build out close-range matchup logic, like how light attacks beat heavy but get blocked by guard with a small ki tradeoff.

Mapping out the rock-paper-scissors loop at close range: light beats heavy and idle opponents, heavy crushes guard, guard beats light, and dash can dodge heavy for a punish window. I'm also working through the exact tick timing of when an attack becomes active so I can interrupt an opponent's startup with my faster light.

Checking dash_back's invuln window against the heavy's active ticks: moving 20 units per tick away quickly pushes me outside the 140 range, so dashing back at most reasonable timings should dodge it, though it costs 16 ki. Walking back is too slow by comparison—3 units per tick won't clear the gap in time. That leaves punishing the heavy's whiff during its recovery as the real opportunity.

Since heavy recovery is 22 ticks after active ends, that's a wide window for a dash-in combo punish. I'm also mapping out the knockback timing—after a heavy hit, the opponent is down and invulnerable for 42 ticks, waking up at a predictable tick, which means I can plan a meaty attack timed so its active frame lands exactly on their first actionable tick before they can guard.

Working through meaty options at wake-up: a meaty light loses to their guard but beats their light, heavy, and anything slower since my active frame hits during their startup; a meaty heavy crushes guard and light but gets dodged by a dash. So each meaty choice has tradeoffs depending on what they're likely to pick on wake.

I'm also checking whether I can actually close the distance after a heavy knockback -- with 150 knockback pushing them away and recovery/wakeup timing factored in, a simple walk forward won't close the gap in time, so I'm considering dashing forward instead, including the case where the dash carries me past the downed opponent and I end up behind them.

This raises a facing question: since a guarding opponent re-faces me every tick once they're in a free state, cross-ups don't really work against guard either -- they'll always turn to face me as positions update, including right after a dash passes through them.

Dashing through an opponent could be a useful escape from the corner or a way to dodge a beam. Thinking about beam timing more carefully, I realize it checks invulnerability but doesn't mark a hit if the opponent dodges via dash, so it keeps retrying every tick for its full 40-tick duration — meaning after a heavy knockdown, a beam fired early could still connect once the opponent becomes vulnerable again as they wake up.

If their wake timing lines up with the beam's active window, they're forced into a tough choice: block for 160 chip damage, or try a dash through me, but the spacing math on that dash makes it land them just short, likely still inside the beam's path.

So really, heavy attack into beam seems the stronger line. I'm tracing the timing: heavy connects, I'm locked in recovery for a while, opponent is stunned and only frees up partway through my recovery, then the beam's firing phase actually starts right as they're waking, and its leading edge should reach their position within a handful of ticks.

Checking whether they can escape or punish once awake — a dash-in attempt lands too late since the beam fires before their dash recovery ends, and a ranged blast would still arrive after the beam has already engulfed them. So their real options reduce to clashing with a beam of their own if they have enough ki, guarding to eat chip damage, or dashing through if already close -- meaning heavy into beam is a genuinely strong ender when I've got the ki for it.

The real choice happens at the wake step, and guarding gives 160 chip while costing them 15 ki, or crushing them outright if they're under 15 ki — either way favorable. I should also check whether they could counter with their own beam at wake since mine is still in startup or firing, which would trigger a clash if they have enough ki; but since the prior heavy hit only refunds them about 9.6 ki, that threat is weak.

If they block the beam instead, they stay in blockstun roughly until the beam ends plus 6 ticks, while I'm stuck in 20 ticks of recovery, giving them about 14 ticks of advantage at range — but punishing that requires closing distance fast, which only works if they're already close (≤110), otherwise dashes or blasts are too slow to connect. So a beam thrown after a heavy knockback, at range ~250, ends up essentially safe, unlike a point-blank blocked beam which gets punished by a light attack.

Now I'm working out blast zoning numbers at range — its ki cost, startup frames, and travel time.

Blast costs are steep against passive ki regen, so spamming them isn't sustainable; charging recovers ki faster but comes with a 1.5x damage vulnerability, meaning I'd need to watch incoming blast ETAs and switch to guard if one's about to land within roughly 6-7 ticks.

Since I'm asked every 6 ticks, I should factor in that gap when deciding to guard now—if eta is 7, waiting until the next ask still lets me react in time since my guard takes effect before the blast moves, so I'll use a threshold of eta ≤ 7 as the safe cutoff for acting now rather than waiting.

I also need to account for beam threats: since beams have a visible 30-tick startup and the ray moves fast once fired, I should guard well before the ray front actually reaches me, not wait until the last moment.

For the broader neutral game, I'm thinking about likely opponent archetypes—rushdown with light combos, occasional heavies, guarding against incoming blasts, beam spam when ki is high, and turtle-style play. Since actions resolve simultaneously, close range becomes a mind-game, so I want to build an adaptive strategy that reads patterns in the opponent's recent actions within a single match and adjusts my mixed strategy accordingly.

Given common simple bot archetypes, I'm mapping counters: crush turtles with heavies and ki pressure, punish repeat light-spammers by immediately countering with my own light after blocking (since the blocker becomes active slightly before the attacker can start up again), beat heavy spammers with lights and dashes, close distance against zoners while guarding blasts, and punish beam startup directly.

I want to formalize "frame advantage" by computing, from opponent state, how many ticks remain until they're free or until their active frames hit, so I can decide whether to attack now or wait to punish their recovery (counter hits get a 1.25x multiplier). I also need to infer the opponent's decision cadence — since the state I observe at tick t reflects their choice from the prior ask, a visible state change tells me they were asked slightly earlier, letting me estimate their ask rhythm.

state change was their last choose tick, then each subsequent view tick their counter t increases by one, so I can back-calculate the ask tick as current tick minus opp.t, letting me reconstruct their whole ask schedule from observed state transitions.

So the opponent's ask ticks repeat every 6 ticks, offset by (now - opp.t) mod 6, as long as they remain in a free state — confirmed by checking both the free() entry case and the choose() entry case give consistent results. That means I can predict exactly when they'll next be askable, accounting for edge cases like invalid-move choices still advancing the cadence.

This is a powerful piece of information: knowing the opponent's ask offset k lets me reason about timing attacks like lights. If k=0 they react simultaneously without foreknowledge, but for k≥1 they can see and respond to a threat before it resolves, so I need to work out exactly how their guard timing interacts with when a light actually becomes active and hits.

My ask phase depends on my entry tick mod 6, which might not align with theirs, so if our phases differ, attacking on my ask tick gives them a nonzero k to react with. I'm wondering if I can shift my own phase — a free-state choice always resets nextAsk+6, but a move like a 17-tick light attack would shift the phase by roughly -1 mod 6, though whiffing a move in neutral is risky. If their phase is off by k∈1..5 instead, I'd need to check whether my light's startup is fast enough to beat their reaction window.

If k=0 (same tick), starting a heavy means it becomes active at +9, and they're asked at +6 seeing my startup at t=6 — their light would only become active at +11, too slow to beat my heavy, so their only outs are a dash, back-dash, or retreating beyond heavy range before my active frames hit.

Checking across k=1 to 5: if they react with a light while I'm throwing heavy, their light beats my heavy whenever k≤3, since their light lands before tick 9. So heavy is only safe against reactive opponents when k=0 or k≥4, meaning I want to stay in sync with my own ask-ticks since that's when I can actually act.

Since I don't know how reactive the opponent's bot is, I'll just build a general decision procedure based on expected value rather than assuming worst-case reactivity. I'll prioritize: check for combo cancels first, then clash/push logic, and only make a free choice when actually asked during a free, cancel, or clash state.

When free, I need to assess the threat from the opponent's current state — whether their light or heavy attack will land before my next action, and respond with guard, dash back, or a dash forward punish depending on timing and ki cost.

I need distance ≤140 to land behind after the 200 dash, and even if there's no room behind and I land in front at the minimum gap, my invulnerability frames still cover their active heavy attack window since the timing lines up.

Checking the edge case where I dash slightly later at their tick 4 instead of 5, my invulnerability runs out right as their last active tick lands, so I'd be vulnerable — but since I'd be positioned behind them due to their fixed facing during the heavy attack, the hit still misses. Dashing backward instead gives safety through invulnerability plus distance, but it doesn't create a punish opportunity.

Without ki for a dash, blocking just gets crushed for 60 damage, and trading lights is bad math — I'd eat 120 to their 50 since they're in active frames not startup. Walking back to escape range seems better than idling and eating either a guard crush or a 120-damage knockdown heavy.

For the opponent's blast startup, I'm checking if I can interrupt with a light if my active frames land before their spawn at t=11; if not, guarding costs 12 chip, or I could dash through with invulnerability to punish their 18-tick recovery after the 29-tick total blast duration.

Even if I block the blast, their recovery window after spawn is only 4 ticks free, too short for a 5-tick light punish. Dashing through an incoming blast seems more promising since the 10-tick dash can close distance while they recover, setting up a light punish if they're within roughly 200-310 range.

For a beam attack with startup, I need to compare my attack speed against their remaining startup time: light works if distance is 110 or less and remaining startup exceeds 5 ticks, while heavy works at 140 range with more than 9 ticks remaining, trading extra damage and a knockdown for the slower execution versus a light's combo potential.

For dashing in, I'm working out the full timing: 18 ticks for the dash plus 5 for the attack startup means I need at least 24 ticks of remaining startup on their end, which generally requires spotting the beam within the first 6 ticks, and I'm mapping out which distance ranges make the dash actually land me in range rather than overshoot through them.

Working through landing positions - at distances 200-260 I'd end up in front at the minimum gap, while 140-200 might put me behind them (where their beam facing wouldn't matter and light attacks would land unopposed). I'm also considering using a blast to interrupt instead, tracking its spawn point and travel speed to see when it'd connect.

Comparing the options: interrupting with a blast if the timing works, clashing with a counter-beam if I have enough ki and favorable power, guarding to absorb damage at a ki cost, or dashing past them if the gap allows it. Since the beam covers the whole forward line, escape only seems possible by getting behind them, so I should prioritize landing a hit first and fall back to a clash only if the ki comparison favors me.

So roughly: go for the clash if my post-attack ki is within about 10 of theirs, and factor in HP lead and time pressure—if I'm ahead late, just guard. For an incoming enemy beam, I need to check whether my counter-beam fires before their beam front reaches me, since their front advances fast (30/tick) over the 12-tick windup; only with enough distance does the clash actually happen in time rather than me just getting hit.

For dashes, if they land their dash recovery close to me, I can punish during their 8-tick recovery window as long as enough recovery frames remain to land my light or heavy before they can act again. More generally, whenever the opponent is in recovery from any move and I'm in range with enough leftover recovery time, I should punish—picking heavy for big recovery windows or light into a combo for better overall damage.

Comparing light chain damage against heavy confirms light edges out slightly in total output but takes longer, while heavy knocks down and sets up a beam follow-up; light chain ending in heavy also knocks down. So I'll favor light at close range (≤110) and heavy at medium range (110-140) when enough recovery time remains, and I should also punish opponents who are stunned, crushed, or in blockstun by timing my attack to land during their vulnerable window.

On knockdown, I need to track wake-up timing carefully: if I fire a beam, I want the startup to complete well before they recover, so I should only commit to it when their remaining downtime gives me enough buffer to avoid getting punished on wake-up.

If I beam up close and they block, my recovery leaves a punish window of about 14 ticks, so they'd get a light hit that nets them more damage than I dealt — not great unless they misplay the guard. Better to fire from 150+ distance where knockback keeps them far after a heavy hit. Also worth considering: while they're down I could just charge ki safely since they can't act, gaining roughly 15 ki over a 42-tick knockdown, as long as I'm ready to guard by the time they wake.

I need to make sure I stop charging before their wake-up window opens enough for a hit — since my next decision point is always 6 ticks out and their earliest strike lands 5 ticks after waking, I should only choose to charge if their remaining down-time is at least 2 ticks, keeping a safety margin. I'm also weighing charging against walking forward during their knockdown, since approaching also nets extra ki while setting up better wake-up positioning.

Now I'm sketching the overall strategy: a "punisher plus pressure" bot that controls spacing near the edge of their reach. Looking at the blind simultaneous neutral exchange at close range, light-vs-light trades evenly, but light-vs-heavy strongly favors me since I land first and can combo into a big punish.

I'm working through the remaining matchups — light beats guard slightly in my favor, heavy crushes guard for a huge combo, heavy wins against idle with a knockdown, but heavy loses to light since their faster startup hits me first. Guard against heavy is the one case that badly backfires.

So overall light dominates most situations except guard, heavy only pays off against guard, and guard only barely helps against light — meaning I should mostly throw lights at close range but mix in heavy when I notice the opponent guarding often. I should track the opponent's guard frequency and bias toward heavy when that proportion gets high, while also accounting for the fact that a reactive bot might just guard the instant it sees my light startup or dash away from a telegraphed heavy.

I'm also realizing I can model the opponent's "ask" timing as a cyclic offset relative to mine — since both of us stay in sync while free, the phase only shifts when one of us does something non-free like a dash or blast. That means I could potentially manipulate when the opponent gets asked to act by timing my own actions, essentially trying to force their decision point to align with my attack's startup for maximum effect.

Rather than fully modeling the cadence, I think I'll simplify by preferring lights when the offset looks favorable and otherwise tracking the opponent's empirical reactivity — specifically, how often my light attacks connect versus get blocked, to see if they're reacting live or ignoring cues.

Thinking through what typical scripted bots do helps me design my own reactive triggers: guarding against close threats, punishing startups, choosing attacks by distance, and using beams when ki is high and the opponent is far. I'll build a rule-based bot combining precise frame-data punishes, threat responses to incoming blasts, distance-aware combo cancels, and wake-up/knockdown handling with charge or beam setups.

I'm also weighing neutral-game approach patterns, clash push mechanics, and time/HP-lead management where I'd play defensively when ahead late in a round. For closing distance safely, I'm running the numbers on walk speed versus dash speed and recovery frames to figure out whether dashing into range leaves me vulnerable to a punish on landing.

Working through the timing, a dash-in leaves me punishable against reactive opponents since their light can land just as my recovery ends, but dashing during their own recovery window (like after a blocked blast) should be safe.

Walking in is trickier since entering their range guard-less risks eating a light. Comparing reach: heavy at 140 beats light's 110, so there's a dead zone (111-140) where only my heavy connects and their light whiffs if they try to intercept there.

Against guard, heavy crushes; against idle or dashing in, heavy either lands or gets punished badly during its long 22-tick recovery. So the heavy footsie range (115-140) is a strong tool against opponents who aren't dashing, but it's vulnerable to a dash-in punish.

My overall neutral plan is to hover around 120-135, staying outside their light range but inside my heavy range, then throw heavies when timing favors me (since their light can't reach me there anyway), while watching for dash punishes.

The risk is a bot that reacts to my heavy startup with a dash, either dashing back to avoid or dashing forward to punish — so I need to track how often they dodge and adapt by baiting instead. If they try the same heavy footsie on me at range, I can punish their startup with my own dash if I have the ki, or just walk back to whiff it.

On closer positioning: if they walk in to under 110, their light becomes live, while my light still won't reach them at 120. I need to decide whether to commit a light preemptively as they approach, or hold back and let my heavy catch their walk-in instead, since heavy is strong against walking opponents. Blasts are also an option at range — costly but rewarding if they're caught charging rather than blocking.

Thinking about ki economy now: passive regen gives roughly 144 ki over the full match length, plus whatever I gain from landing damage. Beam costs 50 ki for big damage, so I want to charge whenever it's safe — opponent knocked down, far away and non-threatening, or stuck in long recovery — to keep affording beams after every knockdown.

I'm also working out reaction windows against dashing opponents: if I spot a dash starting, their recovery window runs roughly ticks 10-17 after their start, and my light attack (5-tick startup) can punish that recovery if I react in time, so I'm calculating the exact timing margins needed to land a punish versus just guarding.

For beam attacks with 30-tick startup, reacting is easy, but walking forward and spacing matters more — I need a safe charging distance that accounts for both their walk speed and attack ranges, factoring in margin for light, heavy, and dash threats simultaneously before deciding it's safe to keep charging instead of bailing out.

Working through the interruption math: blast arrival time depends on reaction delay, giving thresholds like D < 304 or D < 239 depending on how quickly they respond, while dash-light and dash-heavy need closer ranges (D ≤ 310 or 340) to land in time. So beyond roughly D > 340, with no way for them to interrupt in time, the beam becomes safe — they're forced into guarding for 160 chip, trading in a counter-beam clash, or eating a 280 hit.

Confirming beam travel time at ~30 units per tick means it takes about 11+ ticks to cross that distance, and since my recovery leaves me vulnerable for 14 ticks after their blockstun ends, past D > 340 they genuinely can't punish. That makes long-range beam spam at 50 ki a strong trade: 160 chip damage and 15 ki drained from them, though taking damage grants them some ki back (~12.8), so their net ki loss is closer to -2. A counter-beam clash is only possible if they still have 50+ ki to spend.

They could try dashing (200 units) through the beam, but if distance exceeds 340 that still won't close the gap before I'm safe again — so zoning is viable but symmetric, since both sides charge ki at 0.36/tick (reaching 50 ki in about 2.3 seconds) and can trade 160-damage beams at range. This breaks down against aggressive rushdown opponents at close range, so I'm thinking a hybrid strategy makes sense: prioritize solid punish/block logic since those are guaranteed value, and layer in sensible neutral zoning on top. I'm also weighing how guarding factors into this plan.

Guarding a blast costs 6 ki per hit, and if I drop below 6 ki I get crushed and stunned for 34 frames, so I need to track that resource carefully. I'm also mapping out corner situations — if I can't retreat, I should dash forward to escape — and checking the frame data around blocking a light attack: since there's no true punish window there (both sides end up free around the same tick), I'm treating that exchange as neutral rather than advantage. I'm also factoring in pushback distance after blocking a light hit to figure out resulting spacing.

For combo cancels, I'm working out which follow-up is optimal based on chain count and distance — light attacks chain if under 4 hits and close range, heavy works at slightly longer range for more damage and a knockdown, and beam/blast options are mostly ruled out since they can't land before hitstun ends. Heavy seems like the best combo ender when the chain count maxes out or a light would miss, since it deals more scaled damage and guarantees a knockdown.

Totaling damage across different combo lengths, more lights before the heavy ender yields higher total damage (up to four lights plus heavy), with the first hit getting a counter bonus multiplier. Since each light pushes the opponent back a fixed distance and I stay static, the range check simplifies nicely — if a light is in range, the heavy ender will always be in range too after that light connects.

So my decision rule becomes: chain lights while chain count is under four and distance stays within light range, otherwise throw the heavy ender if still within its range, and if the opponent is too far for either, just let the combo end naturally rather than risk a blown blast that arrives too late to punish. I'm also second-guessing whether a heavy ender is even better than holding for a beam setup instead.

After a heavy knockdown the combo scaling resets, so I'm tracking exactly when my recovery ends relative to the opponent's remaining downtime to see if I can get a beam out before they wake. Running the ticks, heavy hits at my t=9 with opponent going down for 42 ticks, and I'm free again around my t=35, which lines up to roughly 16 ticks left on their knockdown — meaning if I fire the beam immediately on becoming free, it travels for about 30 ticks while they only have 14 ticks to wake and react, putting the distance somewhere around 250 by that point.

Checking their options at that range: their blast and dash startups are both too slow to punish in 14 ticks, so the beam looks safe against direct attacks, though I need to check dash_forward specifically since its travel distance could close the gap fast — but running the numbers, they'd still be caught in dash recovery when the beam lands, taking a counter-hit multiplier. Walking forward also doesn't cover enough distance in that window, and even in a cornered scenario with reduced knockback the walk-then-light option still falls short of the needed range.

The remaining risk is their counter-beam: if they wake with enough ki, their startup shrinks to match mine, both beams fire simultaneously, and it becomes a clash decided by relative ki-power — so I need to think about my own ki reserve and whether charging further before committing is worth the delay.

Canceling light into heavy keeps the same timing: active at +9, recovery to +35, with the opponent down for 42 ticks from +9. For crush setups, I'm checking that crushing them for 34 ticks still lines up with my recovery window at +35, leaving me free right as they come out of the crush state.

I need to figure out the right follow-up based on distance—if opponent's crush remaining is above 5 and distance ≤110, light combos; if distance exceeds that but stays within heavy's 140 reach, light whiffs so I should walk forward a few ticks to close distance before attacking, since a 6-tick walk shifts things close enough (~113) to land the hit before they recover.

Dashing forward 16 ki at 130 distance would actually carry me through and behind them, but it's too slow (18 ticks) to punish before they're free. Throwing another heavy instead works better: since startup takes until T+44 and they only free up at T+43, they can't react with a light in time, though they could dash away—otherwise if they just guard again, I get another crush opportunity, especially against a bot that defaults to blocking repeatedly.

So my rule becomes: with 110<dist≤140 and enough recovery frames, use heavy for guaranteed 120 damage; with dist≤110, use the light combo for 174 instead, since it's stronger whenever it actually connects against a crushed opponent.

Now I'm checking blockstun timing — once my light is blocked, the opponent gets free a tick before I do, which doesn't matter here. For hitstun situations where I can't cancel, like after a blast hit, I'm working out whether a follow-up light connects: with blast hitstun of 20 and my blast recovery of 18, if the opponent still has over 5 ticks of hitstun left and is within 110 distance, the light combo continues with damage scaling applied.

I'm also generalizing a punish rule: defining a vulnerability window for the opponent as the number of ticks where a hit lands unblocked, covering recovery states for light, heavy, blast, and dash moves, with dash having 8 ticks of invulnerability before becoming vulnerable during its moving phase.

For blast startup, they're committed and vulnerable until free, but if my light connects before their blast spawns at tick 11, it cancels their move. For light startup, it becomes active at tick 5 and hits me if I'm in range, otherwise beyond 110 distance it whiffs and opens a punish window.

For heavy startup, it's active ticks 9-12, so I need my light to land by tick 3 or dodge to avoid getting hit. For the beam, they're vulnerable while charging but once firing, hitting them breaks it — though standing in front of the ray still gets me hit unless I'm positioned behind them. I'm also tracking hitstun, blockstun, and crush states as ticking down, with blockstun applying when they're guarding.

Checking the land() logic, blockstun isn't the same as guard state, so landing a hit during someone's blockstun is actually a clean hit. I'm working through the timing: light block gives 11 ticks blockstun, but the attacker is also stuck in recovery so neither side can follow up cleanly, and my own blast/beam recovery windows (18 ticks, or beam end +6) mean I usually can't punish in time even when they're vulnerable. Down state is invulnerable so it's not punishable either.

Now for actual punish windows: with light attack active on ticks +5/+6/+7, I need their remaining "stuck" ticks (left) to be at least 6, otherwise they can choose to guard right as my hit would land and block it.

Heavy needs left ≥ 10 and distance ≤ 140. Dash-forward combos need bigger windows (left ≥ 24 for light, ≥ 28 for heavy) since the dash itself has recovery before I can act again, and the landing distance after dashing must still be within range.

Walking forward to close distance before striking costs ticks too — each 6-tick walk cycle closes 27 units but adds to the left-ticks requirement, and I can't close distance below the minimum gap of 60.

For blast, I'm working out the arrival tick based on spawn position plus projectile speed, accounting for the hit radius, and whether the target's recovery multiplier of 1.25 applies if they're caught mid-recovery — landing around 75 damage in that case.

Checking beam next: fired at +30 unless they aim a counter, hitting when the front reaches target. Since their beam recovery is 20 ticks but I'm stuck in blockstun until 14 ticks remain, nothing actually connects there.

The real punish windows come from bigger whiffs — heavy whiff recovery of 22, beam startup/recovery, crushed state at 34, blast recovery 18, dash recovery 8. I'm now checking a heavy whiff at long range, around 150 distance, to see what window opens up given its total recovery of 35.

Rather than build a full lookahead planner, I'll simplify: just decide the immediate action — attack now if it lands, otherwise walk forward and re-attack if that's feasible, otherwise dash forward and attack if I have enough ki. I'm factoring in the walk speed of 4.5 per tick to judge whether closing the distance keeps me in range.

Now I need to carefully model the opponent's threat window after a dash — since facing direction changes during recovery, I have to check whether their light attack's active frames (ticks 5-7) overlap with my distance being within their reach, since if I'm free and haven't been hit yet, that tells me something about whether they've already whiffed.

I'm comparing trade outcomes: a simultaneous hit trades 40-40 damage with no advantage either way, whereas blocking lets me get pushed back while chipping their ki, and dashing through during their recovery window seems like the better punish since I'd be invulnerable during the dash and land behind them before their 17-tick light attack finishes recovering.

Actually recalculating the dash landing position, I land too far behind them to punish before their recovery ends, so dashing doesn't work here. Guarding stays the cheapest option unless my ki is too low to afford it, in which case I'd need to consider walking back or just eating the hit.

With ki under 4, guard gets crushed for no real benefit versus just taking the hit, and either way I end up getting combo'd — so this edge case barely matters and I should just default to walking back. Now I'm setting up the next scenario: opponent's heavy attack when they're facing me and in range, tracking their startup frames and active window timing.

If my light's timing lines up before their heavy becomes active and distance is close, I can counter-hit and combo them; if distance is too far for light to reach, I consider dashing forward to get in range — this works because they'll still be recovering from their heavy by the time I'm free to act, letting my light land as a counter from behind since they won't be guarding.

I'm checking whether my dash's invulnerability frames overlap with when their attack becomes active, tracking my position tick by tick to see exactly when I cross behind them and become safe from their strike.

For the worst case of D=140, I'm behind them by tick 8, well within my invulnerability window, so dash_forward works as a universal heavy counter whenever landing behind the opponent is feasible and I have enough ki — and afterward their recovery leaves them open for a free punish.

I still need to handle the edge case where there's no room behind them (near the wall) — checking whether dashEnd lands in valid stage bounds, and if not, whether I end up stuck in front and exposed to their hit instead. For dash_back, moving away for 8 ticks clearly dodges since I'm out of range, but I only get a punish if their recovery is long enough to still catch after my dash.

Without ki, walking back only escapes if the distance grows past their hitbox range by the time their strike goes active, factoring in both my movement and wall position. If timing lines up exactly (t=4 case), it turns into a simultaneous trade where I eat their light hit while they eat mine.

For their fireball, startup speed and travel distance matter: if I'm close enough and my light connects before their projectile activates, I interrupt it; otherwise I just treat the incoming blast as unavoidable and plan around taking the hit.

Alternatively, guarding works, or I dash forward if the invulnerability frames cover the blast's arrival. I could also counter-blast to clash and cancel their projectile for 14 cost, or punish their recovery window after spawn — the timing math depends on how small t is and whether my landing spot keeps me within range.

Working through the dash-forward timing math: if the blast's adjusted arrival falls within roughly 1-7 ticks, dashing through it closes 200 distance while they're likely still recovering, which seems worth the 16 ki versus just guarding for 12 chip damage and 6 ki. Still, pure guarding against a zoner isn't terrible since each blast costs them 14 ki, so their spam rate is capped—though I'm losing more ki per block than they gain, so the trade favors them slightly over time.

Comparing counter-blasting to guarding: firing my own blast to cancel theirs costs 14 ki but avoids the chip damage and 6 ki loss from guarding, though it only works if my blast spawns in time to intercept theirs. Guarding ends up cheaper ki-wise (6 vs 14), so guard is the better default when the blast's eta is within 7 ticks, otherwise I keep walking or dashing to close distance. Now I'm moving to the next scenario where the opponent starts a beam while facing me and I'm free to act before it fires.

For this free-action window, I'm ranking my options: light attack if I'm close enough and have a reaction window to interrupt their startup for bonus counter damage, heavy attack at slightly longer range, walking in if I can close distance before they fire, or dashing in which lets me land safely in front or even behind them since their beam only threatens where they're facing.

Blasting is also viable since my projectile travel time scales with distance, and if it lands before their beam fires it deals heavy damage and cancels their attack outright, though if their beam fires first it just gets swallowed. I'm also weighing a counter-beam clash if I have enough ki, and most importantly, getting behind them entirely — if I can dash behind before they commit to firing, their beam becomes a massive whiff and I get a huge free punish window while they're stuck in startup and recovery.

Ranking the options by expected value, dashing behind for a combo or interrupting their cast both beat a plain clash, which beats just guarding, which costs me significant chip damage and ki. Now I'm shifting to the case where their beam is already firing toward me and deciding whether guarding makes sense based on the ray's reach.

Front reach time matters: if it exceeds 12 ticks a clash is possible, otherwise I should just guard.

For their dash, I'm checking timing windows — they're invulnerable until tick 8 and recovering from 10-17, free at 18, so my light hitting at startup+5 needs to land in that 3-12 tick window relative to their dash start. I'd need their landing position to confirm, which isn't directly given, so I'm estimating based on their starting x-coordinate.

Since I don't have their exact dash velocity, I'm trying to infer it from tracking their x-position across ticks — storing the last known x and t, then computing velocity as the change per tick to reconstruct where their dash will carry them.

Approximating with Δ ≈ (x_now - lastFreeX)*10/t using their last known free position, then computing landing position x1 = x0 + Δ to check if it's in front of me — since my light locks facing direction at choose time, I should only punish if they're still predicted to land in front rather than crossing behind me.

If they end up behind me after the dash, I'm not vulnerable and can just wait for the next decision point where I'll re-face them; their recovery window runs from tick 8 to 18, so a generic punish check for dash recovery (with sufficient recovery frames left) should cover that case regardless of facing.

Now I'm sketching out neutral-game spacing bands: close range (D≤110) favors RPS mixups, footsie range (110-140, especially if opponent is walking in) favors heavies, mid-range (140-300) calls for approach or zoning, and far range (>300) is where charges/beams/blasts dominate. I also need to factor in reaction timing — if the opponent is free with zero startup they can punish blindly, but with any delay a reactive bot could just guard against a light on approach.

At close range I'm working out the interaction against a reactive guarder: lights get blocked and heavies get dashed away, but against a non-reactive light-spammer, if I always light out my active frames will beat theirs whenever my ask has even one tick of lead, since my hit lands first and interrupts their startup.

I should track opponent responses to my attacks—whether lights hit, got blocked, or traded, and whether heavies hit, got crushed, or got dodged—by watching state transitions like hitstun with combo counter increasing versus blockstun. A simpler option is tracking the fraction of time the opponent is in guard state while free and close, or using a bandit algorithm (something EXP3-like) over close-range actions like light, heavy, guard, and back-dash, with reward based on health difference.

I want a close-range policy that adapts to how often I observe the opponent guarding, using a smoothed probability estimate with recency weighting, then scaling my chance of throwing a heavy based on that guard frequency with some clamping. But there's a wrinkle: the opponent's observed state reflects their previous decision, which only holds until their next action point, so if they're currently blind-choosing, that history may not predict their next move reliably.

Given the timing complexity around when their state actually persists through strike windows, I'll simplify to a rule-of-thumb: if they're currently guarding, go heavy to break it; if they're idle, forward, or charging, go light since that punishes non-reactive opponents.

I should watch out for reactive bots that counter heavy startup with a light at close range, so I'll track whether my heavies are getting interrupted and scale back if so. At longer close-range distances where only heavy reaches, I'll favor heavy regardless of their guard state, and consider that guarding myself can also beat a light at this range.

Against a light-spammer up close, trading lights is fine, but at footsie range (110-140) heavy is strong: it trades with their heavy, beats their walk-forward, and catches their light on recovery with a counter bonus, though a well-timed dash-forward can slip through and punish my heavy's recovery.

Thinking about mid-range (140-300): walking in cautiously since entering the 110-140 zone risks eating a heavy, it's largely a symmetric guessing game. I consider using blast to cover the approach — checking the timing shows I recover about 5 ticks before they exit blockstun, letting me walk in a bit, or try dashing forward during their blockstun to close distance, though the exact landing spot needs more working out.

Dashing toward them while they're in blockstun actually lands me too close too late — my dash recovery ends well after their blockstun wears off, so they could punish me with a light during that window. That makes blasting-while-approaching risky unless timed carefully, but it's clearly strong when they're the one charging forward into it.

I'm also thinking about mid-game resource management: charging ki is key since the heavy-into-beam setup needs 50 ki, so I should only charge when it's safe to do so. And there's the broader hp-lead strategy — if I'm ahead on health near time-out, I can turtle by keeping distance and guarding against blasts and beams, forcing the opponent to approach me instead.

Now I'm sketching out the actual decision function structure: a top-level `decide` wrapper with error handling defaulting to guard, then helper functions for direction, facing checks, and stage-wall awareness, plus a dash-landing simulator that predicts where I'd end up relative to the opponent and the stage edges if I dash toward them.

Still writing lock logic...

Since down-state is invulnerable, I skip punishing it, and clash losses into down/blockstun are fine too. Light-hit validity also depends on facing and reach at the hit tick, which I derive from my chosen direction toward the opponent's current position.

I'm now sketching the main decision flow: update tracked opponent state and past outcomes, then branch into clash handling, cancel handling, or forced guard, before falling into threat/punish evaluation.

I'm working through opponent phases while I'm free to act, starting with their light attack. During their startup frames, I check distance and facing to decide between guarding, dashing back, trading with my own light, or just backing off, and I also note that if I'm behind them there's no threat and I can punish freely since my light still reaches them.

For their active frames, since strikes resolve after choices are made, a hit should have already landed by the following tick if I was in range and not invulnerable — meaning if I'm still free (not in hitstun or blockstun), I must have either been out of range or already blocked.

For the heavy attack, I'm mapping startup frames below 9, active 9 through 12, then recovery from 13 to 34. For the blast attack, I'm figuring out the spawn timing — it triggers at t=11, with startup before that and recovery after.

For beam attacks, I don't have the direct startup value, so I'm backing it out from the left-timer and phase formula. For dash, movement happens before tick 10 with invulnerability through tick 8, then recovery 10 to 17. I'm also noting that hitstun, blockstun, crushed, and recover states leave the opponent vulnerable but unable to guard, while down state is fully invulnerable until they wake, and free state lets them act on my next move.

For my own decisions, I want to first compute punish candidates when the opponent is locked and not currently threatening, then evaluate actual threats.

Now I'm working out how to prioritize when both a punish and a threat exist simultaneously, like when an opponent's heavy attack has short enough startup to overlap with my light's range. I'm defining a function that checks, given how long the opponent is locked and their invulnerability window, whether a hit can land—requiring the hit tick to be at or after their invulnerability ends but before their lock expires. For light attacks specifically, I'm checking whether any active tick in its window lands while the opponent is vulnerable and in range, accounting for the possibility that an early active tick whiffs due to opponent invulnerability but subsequent active ticks still get evaluated.

Heavy attacks follow similar logic with their own active window, and I'm also considering movement options like walking forward then reassessing, or dashing in before following up with a light, factoring in landing position, resulting distance, and whether the lock window is long enough to fit the whole sequence including a dash's recovery time before the strike connects. For a blast-type projectile, I'm checking that its arrival time fits within the opponent's lock window and that they aren't invulnerable when it would land.

For the beam attack, I'm tracing how its hitbox extends over time: it fires at tick +30, starts reaching out to roughly 100 units and grows by 30 units each subsequent tick, so the arrival time against a target at distance D is 30 plus however many additional ticks are needed to close the remaining gap beyond 100 units. I need the opponent's lock window to still be active when the beam's reach catches them, which effectively caps the usable distance for guaranteed hits at relatively close range.

Comparing damage across options — light combo around 170 with counter-hit bonus, heavy around 120, dash-light around 170 at 16 ki cost, blast around 60-75 at 14 ki, and beam at 280 for 50 ki — I'll prioritize light attacks first, then heavy, then dash-light, falling back to walking when nothing connects.

Now I'm thinking through facing checks and opponent state cases, starting with helper variables for whether the opponent faces me and the distance between us, then building out threat detection for when they're in a light attack state — checking their active frames, distance thresholds, and remaining hit timing to decide my response based on available ki.

I realize dashing forward through their light startup lands me behind them unpunishably, so I default to guarding instead; with low ki I'm limited to backing off. I also work out that if their light is whiffing outside range, I need to track the punish window carefully since walking toward them mid-active frames would still get me hit.

Now I'm checking the heavy punish case: if their heavy is reachable and facing me within range, I'm calculating the active frame window to figure out exactly when a punish connects before their recovery ends.

I'm then walking through fallback behaviors if punishing isn't viable — considering dash-forward if the gap allows landing behind them, backing away if I can escape, or dash-back otherwise, with taking the hit as a last resort rather than ever blocking a heavy. Finally I'm making sure the punish logic doesn't accidentally walk me into their active hitbox range while they're still winding up or attacking.

Walking into range would actually put me inside their heavy's active hitbox, so idling is the safer choice there instead of guarding.

For the blast case, I'm working out whether to interrupt with a light attack based on timing: if their startup leaves enough ticks before the projectile spawns and I'm within light's range, hitting them first before the spawn tick makes sense.

If the blast arrives within 7 ticks I should just guard, since that's close enough to be dangerous. For later arrivals, I'm weighing whether to dash forward using my invulnerability window to get past them before the blast spawns, since if I've already moved behind them by the time it appears, it won't hit me at all.

I need to recompute eta accounting for my own movement, so walking toward the blast closes the gap faster — guard if the walk-adjusted eta falls at or below 7 ticks. More generally, I should check incoming blasts before deciding neutral actions: if an attack would lock me in place while the blast arrives, I take the hit during startup or recovery with an amplified counter penalty, so that risk needs to factor into whether I commit to the attack at all.

For the beam case, I'm working out the firing tick from its startup timer and phase, then deriving how many ticks remain until it actually fires so I can figure out if I can land a hit before it triggers.

I'm checking each attack option (light, heavy, walk+light, dash+light, dash+heavy) against the distance and remaining-ticks constraints to confirm which ones can land safely before the beam fires.

For generalized multi-cycle walking I need both 6n+5 ≤ R and D−27n ≤ 110 to hold. I'm also weighing counter-beam clash economics when ki is high enough, and considering dashing all the way behind the opponent to punish them during their firing animation if the distance allows it.

Now I'm working out the ray-collision check: once they're firing and facing me, I compute the beam front's position and the gap to me, treating a hit as occurring once that gap drops within the 30-unit padding.

I'm figuring out the exact tick at which the beam front reaches me, since it advances by 30 each tick before the hit check runs — so the hit tick is the smallest k satisfying gapF minus 60 times (k+1) staying under the threshold. From there I'm weighing whether to guard immediately versus dashing through to land behind them, checking whether my invulnerability window (8 ticks) is long enough to cover the time I'd spend inside the ray before passing them.

For the post-recovery decisions: if their beam finishes and I'm still in front, I check whether their remaining lock time is long enough to punish with a combo; if I'm behind them instead, their ray points away so I can punish freely using whatever lock time is left. I'm also considering a counter-beam option — firing my own beam early enough that I won't get hit first — and falling back to guard if that trade isn't favorable, before moving into analyzing the "dash" case.

For recovery states at t≥10, I should go with bestPunish since they're not invulnerable there. I need to track their last x-position to figure out dash direction, since dashing away changes landing distance and punish viability.

For hitstun, blockstun, crushed, or recover states, bestPunish applies too — importantly, if they're in blockstun from my earlier blast, they can't guard, so punishing works freely. For the 'down' state, they wake up after some ticks with invulnerability until then, so I'm considering whether a beam setup is safe given their wake timing versus my startup.

I'm working out the exact safety math: whether their fastest possible interrupt (light, dash+light, blast, heavy) can beat my beam before it fires, factoring in wake time, travel distance, and tick thresholds for each option. I also need to confirm the beam actually reaches them across the stage, accounting for guard and counter-beam clashes, and build a general safety condition comparing wake time plus their earliest interrupt against my firing tick.

For tracking their position, I'm accounting for residual knockback movement — if they were recently hit, they'll still be drifting away, so I should estimate remaining knockback distance conservatively (using a smaller distance as the safer, more pessimistic assumption for interrupt checks).

A meaty light timed right as they wake beats guard-break scenarios except guard or dash, while a meaty heavy beats guard outright — since I don't know their wakeup habits, I should adapt by tracking what they actually do on wake over time.

Simplifying the decision: if ki is high enough and it's safe, beam; otherwise charge if they're far after knockback, using the down time to build ki toward the beam threshold rather than closing distance, since neither option gains much ground in just ~16 ticks.

Checking the beam-after-wake timing more carefully, a blast from range 250 arrives too fast relative to their reaction window, so starting a beam right as they wake isn't safe against reactive opponents — I need to fall back to standard neutral-game logic instead.

Now I'm drafting the neutral-state decision logic based on distance and opponent timing offsets.

Working out the close-range branch (heavy vs guard, light vs charge, baiting with guard occasionally), then the footsie-range branch (heavy unless they tend to punish with dash, otherwise staying light), then the approach-range branch choosing between walking forward and waiting depending on who's entering whose attack range first.

Then at far range I'm thinking through priorities: beam if ki's high enough and it's safe, blast if they're mid-charge, otherwise charge myself or just walk forward. I'm also weighing the overall aggression-versus-patience tradeoff against a zoner archetype — if we both charge and beam simultaneously it's roughly a wash, so the fight might just come down to a health-based time-out, and closing distance against a committed zoner takes a long time on foot.

Now I'm working through beam-safety math from the opposite perspective — when I'm the one beaming, figuring out exactly how close an opponent needs to be to punish me given their reaction delay, factoring in blast-interrupt thresholds and dash-in punish windows depending on their read timing.

Beaming at range beyond 320 looks like a strong free chip opportunity worth 160+ damage and ki drain for only 50 ki, as long as I watch for a counter-beam clash since their dash and interrupt options don't reach me at that distance.

Stage is 920 wide with 300 starting distance, so I could back-walk to create beam range but the opponent closing distance complicates that. Against unknown bots, I'm betting a punish-oriented, defensively solid style beats aggressive rushdown since most LLM bots probably lean aggressive — so my close-range anti-dash game and knockdown-into-beam setups should matter. I'm also weighing light-hit-into-beam-cancel timing, since the opponent recovers with enough hitstun left to guard or punish before the beam lands.

Blast-cancel at close range also seems weak since the spawn offset barely covers the gap; heavy combo extension into knockdown-beam setup looks more reliable when ki is at least 50, since damage dealt builds ki faster than damage taken drains it. Now I'm working through the clash logic, handling positions and the case where my ki is zero, which just results in a neutral push with no effect.

For deciding whether to push, I'm reasoning that it should depend on how close the clash point is to either body and whether my ki is too low -- near the middle it's worth holding ki since clashes there last longer, while near either end pushing is better. I'm trying to translate this into a distance calculation based on clash position relative to body positions.

I want to track position history across clash ticks to estimate velocity, then predict when the clash point will reach either body, pushing if that margin gets small or predicted time is short or ki runs low -- plus pushing more readily if the opponent is already pushing and I'm losing ground.

I'm also adding rage logic: boost push aggression when my HP drops below 30%, and force a push if the clash drags past tick 300-320 to avoid an unresolved draw. For the next-ask timing, I'm assuming a 6-tick interval when choosing free states like forward/charge/guard, but I need to account for the fact that I won't see the opponent's new action until my next ask -- so if I'm charging at distance 200 and they start walking, I could be blind to it for up to 6 ticks.

