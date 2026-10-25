I need to design a solid fighting bot strategy, so I'm working through the move mechanics first—comparing light and heavy attack startup, active frames, recovery, reach, and damage to figure out optimal spacing and punish windows.

I'm also factoring in ki costs and speeds for blast, beam, and dash moves, then reasoning about reaction timing: since decisions only happen every 6 ticks, I'm checking whether there's enough window to see and guard against an opponent's light attack before it connects, given guard must be set before the active frames hit.

Working through a combo chain of four lights into a heavy, I'm tracking how each hit's pushback increases spacing, checking whether later hits in the chain still land within reach, and tallying cumulative damage across the sequence.

I'm also comparing other combo variations like light-into-heavy or light-into-beam, factoring in startup frames versus the opponent's hitstun window to see if they could escape, and checking whether a blast projectile fired mid-combo would actually connect given the growing distance between fighters.

Overall, light-into-heavy still looks better than light-into-blast since the knockdown gives safer positioning even though the damage is similar, so I'm now mapping out exactly how many recovery frames remain after the heavy hit lands.

With the opponent down 42 ticks and our recovery ending around tick 34, we get roughly 16 free ticks to charge ki or set up a beam before they can act. A beam is tempting here since even blocked it deals massive chip damage and ki drain, making it a strong follow-up if timed against their wakeup.

But I'm also considering counterplay: a dash can carry us through the invuln window to land behind the opponent, avoiding the beam entirely since it only fires forward, leaving the shooter fully exposed during the long startup, active, and recovery frames for a big punish combo. At close range a light attack would interrupt the beam's slow startup, while at longer range the opponent's blast could potentially trade or punish depending on travel time and distance.

Once the beam actually fires, I'm checking how quickly it reaches the opponent and whether they have time to react — they'll have several chances to respond, like guarding and paying ki, with being crushed if they lack enough ki to guard.

Dashing through during startup seems like the best counter, since the shooter's facing stays locked while in the beam state, so a dash behind them avoids the attack entirely and sets up a strong punish on counter-hit, especially since guard doesn't matter when struck from behind.

Working out the exact distances: I need to calculate whether a 200-unit forward dash actually lands behind the opponent or just stops short, depending on their starting distance — under 140 means a clean pass-through, while distances between 140 and 200 leave a small 60-unit gap right behind them instead.

Since the beam covers the whole stage eventually, the only real options are dashing through or behind it, countering with my own beam, guarding, or interrupting during startup — so I'm now checking whether an interrupting attack can reach in time given travel distance for the opponent's blast.

If I have 50 ki, countering with my own beam leads to a clash, roughly a coin-flip weighted by ki-derived power, with the loser taking 320 damage; pushing adds power but drains ki, and that tradeoff stays favorable for roughly 50 ticks. Velocity decays at 0.95 per tick, so the steady-state drift settles around twice the positional difference per tick.

But noise accumulates too—position variance from random drift grows large over ~100 ticks (sd around 160), which can swamp a drift advantage of only ~120 from a 0.6 power edge, so pushing helps but isn't decisive against noise. Best strategy seems to be pushing whenever ki remains above zero, since once it's depleted power flattens to 0.5 regardless; I still need to work out what happens if the opponent is also pushing simultaneously.

Working through the breakeven math, pushing only pays off if roughly 50+ ticks remain in the clash, otherwise the ki cost outweighs the power gain. I'll settle on a heuristic: push when ki is still fairly high or the clash position is unfavorable, since the velocity effect decays with a ~20-tick time constant anyway.

Against other AI archetypes — rushdown, beam spam, turtle guard — I need something robust. For a guard turtle specifically, a heavy attack crushes guard for solid damage plus a long stun; since the crush isn't a counted "move," the counter multiplier stays at 1, and I can chain a quick light attack into the recovery window once the crush timing math checks out.

Against light-spammer rushdown, I'm comparing blockstun versus attacker recovery frame-by-frame -- the defender actually gets free slightly before the attacker, giving a small window to counter-light first.

This confirms a rock-paper-scissors loop: light beats heavy (faster startup wins counter-hit), heavy beats guard (guaranteed crush), guard beats light. Range also matters since heavy has 140 reach.

I'm also checking timing details — with decisions made every 6 ticks, I need to figure out whether a light thrown in reaction to a visible heavy startup can land before the heavy's active frame at tick 9, accounting for dash-back invulnerability of 8 ticks and minimum distance of 60.

Working through the exact offsets: if we spot their heavy at their t=k, our light (5-tick active delay) stuffs it cleanly if k≤3, trades at k=4, and otherwise we're too late and should consider dashing back for invulnerability instead of trying to contest it.

If the opponent whiffs a heavy and lands in 22-tick recovery, I should punish with either a heavy counter-hit or a light-into-heavy combo chain, and I'm tallying the damage totals for that chain. The bigger question is figuring out the opponent's actual decision cadence so I can predict when their next input comes.

Since state only resets its timer when the opponent's action actually changes, I can only infer their ask timing from visible state transitions — but when they do become free, their asks should follow a steady 6-tick rhythm from that point on, so tracking the free-state transition lets me project their next few decision points.

I could exploit timing too: if I start a light right after opponent's ask tick, and their next decision isn't due until 6 ticks later, my hit at T+5 lands before they can react — unless they're already guarding. Since their asks happen every 6 ticks regardless, striking right on their ask tick makes it effectively a simultaneous guess for both sides.

Heavies landing at A+9 give them time to see my move at A+6, but their only real counters are dash_back (invulnerable early) or already having pre-committed to something like a light that resolves faster than my heavy — otherwise guard gets crushed.

Now I'm thinking about ask-phase synchronization: since asks repeat every 6 ticks while free, whoever asks first after the other gets an information edge, reacting with several ticks' lead. I want to figure out if I can manipulate my own phase offset by choosing moves with specific whiff durations, like a light whiff, to shift when I become free and re-ask relative to them.

I'm computing phase shifts for each move's duration mod 6: light at 17 ticks and heavy at 35 and blast at 29 all shift by 5, while beam at 90 and dash at 18 shift by 0 — so I can choose moves to deliberately land on favorable ask timing relative to my opponent.

I'm weighing whether throwing a whiff light at long range is safe, since the opponent can't realistically punish it given dash timing, and considering whether the small information edge from shifting my ask offset by one tick is actually worth exploiting.

With offset 1, I see their move one tick after it's set but they see mine five ticks late. Working through scenarios — their light gets guarded, their heavy gets stuffed by my counter light, and their guard gets opened up by my delayed heavy before they can react — this timing gap seems to consistently favor me.

Working through the math: light needs offset k where k+5 is strictly before their next ask tick to be unreactable, meaning with offset 1 neither side can land a light hit without the other guarding in time — both light attacks become fully reactable at this spacing. Now checking whether a heavy attack at the same offset fares any better.

Checking their other options after dashing back: dash forward plus light is too slow, and a blast would arrive while I can still guard for cheap chip damage. So dashing back is a safe escape for them but costs 16 ki with no payoff, making it a roughly even trade favoring my ki economy for beams. Realistically though, most opponents probably aren't doing frame-perfect reactions and are likely running simpler heuristics based on distance and move type.

Being frame-aware still gives me an edge if I can infer their reaction timing — particularly their "ask" cadence, since a reactive bot likely checks my state at specific tick intervals, possibly tied to when they become free. If I can detect the tick where they just became free (state reset with t=0), that's probably when their decision-making kicks in, so timing my light attack right after their ask tick could let me land hits before they can react.

So actually the ask base simplifies: oppAskBase ≡ now - opp.t (mod 6), since whether they just got freed or chose a state, the time-in-state tracks consistently back to their last ask tick. Failed move attempts also don't reset state, so this invariant holds.

Now I'm working out when the opponent's next decision point occurs: if free, it's based on their t modulo 6 (simultaneous if t%6==0, otherwise now plus the remainder); if they're mid-move with a known duration, their next ask tick is simply now plus whatever time remains before the move ends.

For stun specifically, the counter resets to 0 then increments, so the same free-at-end-of-duration logic applies, with clash having zero duration and thus zero time left.

There's also a special case: after landing a light hit, only the attacker gets an extra cancel decision.

For my own next ask tick, since I always know I'm being called in the current moment, if I'm free the next call will be now+6, but if I start a move the timing depends on that move's duration.

Now I'm thinking about the core strategy: at each decision point I want to choose the action that maximizes expected outcome given what the opponent can do before their own next decision, accounting for the fact that these are often simultaneous choices. I'm defining the number of ticks until the opponent's next decision, noting that if they're already committed to a move or stun, I know exactly what they'll be doing until that point, including the fact that they can still choose to guard the instant they're asked again. I'm also working out the timing for a light attack landing, factoring in how both players' walking speeds forward and backward change the distance between them.

A hit becomes "guaranteed" when it connects before the opponent gets another chance to react given their current state -- if they're locked into recovery or startup that resolves after my active frames, or if they're free but their next decision isn't soon enough to block the incoming hit.

But at simultaneous ticks where both choose blind with no new info, it's essentially a guessing game since they're locked into whatever they pick until the next window. At any non-simultaneous tick where they still have time to react, a reactive bot would likely see my startup and guard accordingly.

If my cadence differs from theirs by a fixed offset mod 6, that determines who sees whom first — an offset of 1 seems most favorable for me reacting to their moves, since I can see their choice almost immediately and respond with the right counter before their attack lands, while they'd be much later seeing mine.

Working through the guard case: my heavy would actually hit them while they're in light startup if they try to switch and interrupt, giving me a clean counter-hit knockdown. So against guard, throwing a heavy at offset 1 forces them into a bad spot — either dash out or eat the hit — while light would let them react and guard in time, so heavy is clearly the stronger choice here. I'm now considering whether they might try to preempt with their own light to interrupt my heavy instead.

I also need to think about how my move choices shift my phase relative to theirs over time, since different move durations change the effective offset modulo 6 on future exchanges, and I'd rather keep that offset small so I keep reading their choices early.

Checking dash and beam durations too — both land on a 0 shift, so really only light attacks give me that -1 phase decrement, and getting hit or blocked resets things unpredictably. Realizing invalid move attempts don't shift the ask timer either, so my phase control options are genuinely limited to whiffing lights at safe range, and the opponent's phase drifts the same way with their own moves.

I'm weighing whether to actively shift phase versus just letting it ride — a light whiff costs 17 ticks of commitment, which is also 17 ticks of lost charge, meaning roughly 6 ki foregone, so I need to think about whether phase correction is worth that resource cost relative to just building ki for beams, dashes, or blasts.

Let me instead map out overall damage potential across moves to decide the bigger strategic picture — starting with beam damage numbers on hit versus blocked.

Beams cost a hefty 50 ki, but with passive and charge regen rates, roughly 2.3 seconds of charging gets me there, and damage taken converts to ki at a much higher rate than damage dealt, so trading hits actually fuels my resources faster than I land them. Charging during a beam multiplies the hit to 420 damage, but a beam's long startup plus travel time means it's telegraphed — so I'm thinking through defensive counters: dashing behind an opponent's beam startup if close and ki-ready, or using a blast to interrupt if in range.

At distances under 110, light attacks interrupt fast; under 140, heavy attacks work if there's time; otherwise with enough ki I can clash the beam, or guard and eat the chip damage and ki cost. Dashing has brief invulnerability, but the beam's full duration covers the entire ray so dodging only works by getting behind it, which the dash can achieve under 200 distance — and from the attacker's side, firing a beam from beyond 300 distance against a non-beam opponent is nearly risk-free, forcing a guard or clash that favors the shooter heavily.

Calculating the ki economics of beam-spam, it looks devastatingly efficient over a full 60-second match — repeated charged beams could rack up thousands of damage unless the defender actively counters with their own clash, aggressive dashing pressure, or rushing in during the opponent's charge windup to punish it with a boosted blast.

Hitting from behind gives a counter bonus, and comparing options: a light-into-heavy chain totals 184 damage versus a single heavy counter off their stuck beam state at 150 with a knockdown. The light chain seems better on raw damage, but I should weigh the knockdown value against pure numbers before deciding.

Now I'm working through the exact timing of positioning behind the opponent before their beam fires — accounting for reaction delay, dash durations, and invulnerability windows — to figure out whether I can land safely behind them before the beam's ray spawns at tick 30.

With D1=150, I'd end up 60 behind and clear the beam's forward-facing ray entirely since I'm positioned behind the shooter after the dash. The separation check gets skipped mid-dash, which works in my favor here. This whole maneuver costs 32 ki total, though if distance is already under 200 when the beam starts, a single dash for 16 ki suffices instead.

At mid-range, around 200-400 distance, blast interrupt is the better option — it works up to roughly 290 distance with some reaction buffer, costs only 14 ki, and lands with a 1.25x counter multiplier for 75 damage while canceling the beam entirely since getting hit during startup forces the state out of 'beam' before it spawns, wasting their 50 ki with no refund. The opponent also can't guard while locked in beam startup, which makes this a clean punish.

Now I want to formalize this into a priority-based decision system that accounts for frame timing.

I considered actually simulating the game engine forward to test candidate actions against the opponent, but modeling the opponent's behavior reliably is the hard part, so I'll stick with handcrafted heuristics combined with frame-based math instead. Let me sketch out the decision tree for this logic.

First, I define the basic variables like distance, opponent's remaining ticks, and when I'll next be free to act. Then I handle special contexts: clash situations where I push per heuristic, and combo-continuation decisions after my light hits -- checking chain count and distance to decide whether to keep chaining lights before the opponent recovers from hitstun.

Working through the damage math, extending the combo with a light before the heavy ender actually outperforms ending immediately with heavy at most chain indices, except once the chain cap of 4 is reached where I can't add another light. So the optimal pattern is maxing out lights then finishing with heavy, as long as I'm still in range -- though I also need to check whether a beam ender could work given its startup time versus remaining hitstun.

Checking pushback against walls — if the opponent is pinned, I get pushed back instead, which keeps the distance growth about the same. I need to decide based on distance whether to use a light, heavy, or blast as the follow-up, and I'm verifying the chain counter logic: chain resets or increments based on whether the hit was a light that connected in sequence, and cancels are only allowed while chain stays under 4, capping me at four lights total. I also need to confirm the cancel window timing — the next light starts right after cancel and lands five ticks later, so distance at that moment needs to stay within range for it to connect.

Now I'm working out how to handle the opponent's beam attack — checking if they're in beam state, startup or firing phase, and facing toward me. I'm calculating how many ticks remain until they fire, either from startup timing or from the beam's current position if already firing. My priority order: if I'm free to act and they're still in startup with enough ticks left and I'm in range, I should throw a light to interrupt them before they can react, since they're locked into startup and can't defend — this could even combo afterward depending on timing.

So heavy needs tf ≥ 9, and dash_forward works when distance is under 200 with room behind, enough ki, and timing that lets invulnerability carry me past the beam's firing window so I end up safely behind the ray.

So really I just need to dash forward whenever I'm free and not already hit, since being mid-beam means I'm already too late. After the dash, I should punish while the shooter's stuck, since my recovery is 8 ticks after moving. For mid-range distances with enough ki, I'm considering chaining two dashes, but I need to check the vulnerability window during the first dash's recovery before the second one's invuln kicks in.

I'm also thinking about interrupting with a blast: if ki is sufficient and the blast isn't already out, and its hit time lands before the beam fires, that could break the opponent's attack before it connects.

I should also weigh countering with a beam if my ki is high enough, since that forces a clash: winning deals heavy damage to them, losing costs me the same, while guarding only costs 160 and some ki — so clashing is favorable unless my expected power is clearly weaker than theirs. I also need to account for timing when their beam is already firing, since their wavefront might reach me before mine arrives.

Their beam would already hit my body before 12 ticks unless their front is far enough away, so the counter only works if their remaining startup or travel time exceeds 12 ticks. If both fire simultaneously during their remaining startup window, I need to check where each front ends up after the first tick to see if they cross or clash.

Checking whether the beams clash in the middle before either reaches a body — since fronts move toward each other at 60/tick, they should meet well before hitting either character, confirming the clash takes priority over a direct hit. For guard: even against low ki, taking 160 chip plus a 34-tick crushed stun is still better than eating the full 280 damage and 50-tick knockdown from the beam, though I should remember guard drains ki at -0.03/tick. I'm also considering whether dashing back could work as an escape option.

Since the ray extends to the stage edge plus 40, running away won't actually dodge it — I need to instead time a guard precisely. I can keep charging during the beam's startup (gaining 0.36 ki/tick) and switch to block only right before impact, since charging when hit multiplies damage by 1.5x into a brutal 420. This means calculating the exact hit tick based on fire tick plus travel time, syncing my input checks every 6 ticks so I guard on the very last window before the beam's front reaches me.

If I'm too far to dash through now, I'm thinking about walking forward a few ticks to close the gap before dashing, since movement is slower than dashing but could still get me inside range before the beam's front reaches me. I'll treat it as checking whether the distance will drop under the dash threshold by my next action point, factoring in beam travel timing.

For incoming blasts, if the time to impact is short I'm weighing guarding (cheaper, costs chip and blockstun) versus dashing through (full invuln) versus countering with my own blast to cancel it out, though that option depends on having enough startup time before the blast lands.

Working through the eta formula more carefully: hitTick should be now plus max(0, eta-1), accounting for the blast moving during the same tick it checks collision, and also need to factor in my own movement during that tick.

If the remaining eta is small, I need to decide now between guarding, dashing, or starting a light attack that still trades with the blast. Dashing forward seems appealing since it grants invulnerability for 8 ticks and closes distance by 200, which is valuable against a zoning opponent even though it costs more ki than guarding -- and if their blast recovery is long enough, I could punish right after.

