**Analyzing Bot Competition Requirements**

I'm diving deep into the technical specifics for the AI fighting bot competition. My current focus is on thoroughly understanding the game's rules, dissecting the provided engine code, and absorbing all available frame data, physics, and combo mechanics to build a robust AI.

**Evaluating Simulation Potential**

I'm assessing our computational budget per decision cycle. It seems surprisingly generous for simple operations and even shallow lookahead simulations. My next step is a complete dissection of `engine.js` and `rules.js` to eliminate any misunderstandings about the game's precise mechanics.

**Analyzing Game Loop Logic**

I'm dissecting the `step` function in `engine.js`, focusing on the `choose` method. I've identified the conditions under which an action is requested, particularly noting the `wants` predicate and the `a.nextAsk` timer. The logic for handling `clash` states and the `cancel` mechanic, along with the specific conditions for `start` calls and their failure modes, are my immediate focus.

**Refining Beam Attack Logic**

I've discovered a critical detail within the `beam` attack logic! The `aimed` condition, specifically how it checks the opponent's beam attack state and their position relative to my own, is incredibly precise and impacts my beam's startup and duration. This warrants a deeper look at turn-based interaction.

**Investigating Beam Collision Timing**

I've uncovered a critical timing nuance in beam attacks. When initiating a beam while the opponent is also starting or firing one, the startup duration is dynamically calculated. This could lead to both beams hitting simultaneously if the opponent initiated their beam within a specific window (roughly 18 ticks prior), or my beam being too slow if they're already firing and the distance is not exceptionally large. I need to verify these precise interaction conditions.

**Verifying Beam Attack Distances**

I've calculated beam attack ranges based on `b.front`'s velocity and clamp values. My analysis indicates a hit distance of up to 100 units by startup completion, increasing by 30 units each subsequent tick. I need to meticulously trace all frame timings within the `step` function, especially considering how `a.t` is updated *after* movement and hit detection.

**Tracing Attack Frame Timings**

I've been meticulously tracing the frame timings for light attacks. I've determined that the 'active' phase begins on tick T+5, with `a.t` reaching the active value. I'm also investigating the immediate aftermath of a hit on that tick, noting the `land` function and `a.cancel` flag, before the `a.t` increment for the next tick.

**Confirming Hitstun Duration**

I've confirmed a crucial detail about hitstun: on the very tick a hit connects, the stun timer (`o.t`) increments immediately after the hit registration. This means the actual duration of the hitstun is effectively one tick less than initially assumed.

**Calculating Frame Advantage**

I've confirmed that the hitstun duration is indeed one tick shorter than expected because the stun timer increments immediately after hit registration. This provides a clean and exact method for calculating frame advantage, which I'm now applying to verify the light attack's frame advantage and confirm its interaction with the opponent's guard timing.

**Analyzing Beam Attack Timing**

My recent analysis of light attack cancels has revealed a critical flaw in my assumptions about beam combos. It appears that initiating a beam attack after a light hit, even with cancellation, will not result in a true combo. The opponent will recover from hitstun before the beam can connect, allowing them to guard or counter.

**Revising Combo Strategy**

I've realized that my previous assumption about light-to-beam combos was fundamentally flawed. The opponent recovers from hitstun far too early for a beam attack to connect as a true combo, forcing a change in my strategic approach.

**Detecting Attack Interruption**

I've discovered a significant vulnerability: if I initiate a beam attack after a light hit, the opponent can actually counter-attack and interrupt my beam startup. They recover from hitstun and can land a heavy or light attack before my beam fires, resulting in substantial damage and wasted ki.

**Calculating Frame Advantage**

I've been meticulously calculating frame advantages for both hits and blocks. My current focus is on the light attack, specifically determining when the opponent becomes free after blocking it. I'm also analyzing the pushback and ki gain implications of this attack.

**Calculating Frame Advantage**

I'm continuing to refine my understanding of frame advantage following a successful guard crush. I've determined I'm +22, allowing for a guaranteed heavy attack for 120 damage or a light combo. I'm currently calculating optimal combos given `canCancel` is true on tick 6 and analyzing pushback mechanics from repeated light hits.

**Verifying Post-Pushback Distances**

I've confirmed that `state.dist` correctly reflects the post-pushback distance when `canCancel` becomes true. This means I can now precisely determine hit conditions for canceled light and heavy attacks, specifically noting the `state.dist <= 110` for light and `state.dist <= 140` for heavy, along with `state.me.chain < 4` for light.

**Calculating Combo Guarantees**

I've confirmed that if a follow-up light attack hits (dist <= 110, chain < 4), a subsequent heavy attack is always guaranteed. This is because the pushback from the light hit (dist + 14) still keeps the heavy within its range (<= 140). I am now calculating total damage for `L->H`, `L->L->H`, etc.

**Calculating Optimal Combo Paths**

I'm realizing that extending light attack chains before a heavy attack consistently increases total damage, provided the distance remains within the light attack's hit range. I'm now weighing this damage benefit against the time cost of extra light hits, especially in late-game scenarios.

**Confirming Heavy Attack Guarantee**

I've confirmed that after a cancelable light attack, a heavy attack is always guaranteed. Even with pushback, the distance remains within the heavy's range, and opponent invulnerability during knockback prevents unexpected scenarios. This solidifies my optimal combo path analysis.

**Testing Combo Logic**

I'm currently verifying a specific combo sequence derived from my frame advantage calculations. I'm running simulations to confirm the guarantee of extending light attack chains before a heavy hit, considering distance and chain count constraints, especially from various starting distances.

**Calculating Combo Damage**

I've finalized a devastating light-to-heavy combo sequence. A string of four light attacks, precisely timed to account for pushback and chain limits, guarantees a follow-up heavy for 174 damage. This combo is even more potent with counter-hits or charge-hits, yielding up to 194 damage plus significant knockback and knockdown.

**Analyzing Guard Crush Frame Advantage**

I've discovered a significant frame advantage of at least +8 following a guard crush. Crucially, the opponent remains in a "crushed" state without pushback, allowing immediate follow-up light attacks at close range. This state also prevents their combo counter from incrementing, opening up extended chains.

**Discovering Guard Crush Combos**

I've unlocked a powerful offensive sequence following a heavy guard crush. If the opponent is within 110 units upon my recovery, I can immediately launch a full light-to-heavy combo for a substantial 234 damage. Even at slightly further distances (up to 140 units), a few steps forward can enable this devastating combo.

**Calculating Attack Interruption Vulnerabilities**

I'm analyzing how the opponent's `left` value dictates whether my `heavy` attack, with its 9-tick startup, will connect before they become free from their current state. For `light` attacks (5-tick startup), this threshold is 6 ticks. I need to precisely confirm these off-by-one calculations regarding their freedom tick.

**Confirming Interruption Thresholds**

I've precisely confirmed the conditions under which my attacks can be interrupted. If the opponent's remaining stun ticks (`state.opp.left`) are greater than or equal to my attack's startup frames plus one, my attack will connect before they can act. This threshold is key for guaranteeing hits.

**Analyzing Heavy Hit Advantage**

I've confirmed a significant +16 frame advantage after landing a heavy hit. This leaves me with ample time, around 2-3 decision cycles, to either charge ki or advance for pressure before the opponent recovers from their knockdown.

**Calculating Blast Attack Reach**

I've analyzed the blast attack's trajectory, noting it spawns at my position and immediately travels. I've derived a formula to calculate the exact number of ticks required for the blast to reach any given distance, which will be crucial for offensive planning.

**Detecting Blast Arrival Imminence**

I've realized that due to our decision-making cadence, any incoming blast with an `eta` of 6 ticks or less represents our final opportunity to react. This immediate threat window dictates our defensive or offensive choices.

**Reacting to Incoming Blasts**

I've discovered a critical threat window: if an incoming blast's `eta` is 6 ticks or less, I must react immediately on this decision cycle. This also applies to opponent blast startups, where a calculation reveals the total ticks until a spawned blast hits, dictating urgent defensive or offensive action.

**Analyzing Dash Mechanics**

My current focus is on the intricate details of the dash move. I'm dissecting its ki cost, total duration, invulnerability window, and crucially, the extended vulnerable period during its latter half and recovery. I'm also investigating the complex logic behind its potential to cross-up opponents at various distances.

**Exploiting Dash Vulnerabilities**

I've discovered that my dash forward lands behind the opponent under many conditions. Crucially, if they're mid-attack when I do this, their attacks will miss as they don't turn, leaving me free to counter-attack for significant damage.

**Dodging Beam Attack**

I'm analyzing a new strategy: using a forward dash to evade incoming beams. If the opponent initiates a beam attack and I dash forward, I can often land behind them, causing their beam to miss and allowing for a counter-attack that interrupts their beam and inflicts significant damage.

**Dodging Beam Attacks**

I've discovered a critical rule regarding invulnerability during dashes and beam attacks. If my invulnerability ends while I am still within the beam's path, I will be hit. This differs from projectiles, which are safely behind me once I've passed their spawn point.

**Dodging Beam Attack Logic**

I'm refining my understanding of the dash-beam interaction. Dashes only evade beams if they get behind the opponent before tick 8. Otherwise, if I'm too far, I must guard or counter-beam if I have sufficient ki, as even a guard crush is preferable to an unblocked beam.

**Analyzing Beam Clash Mechanics**

I've determined that guarding a beam is always the optimal choice, even at low ki, due to significant damage reduction and stun mitigation. The attacker's long recovery time after a beam guarantees a substantial frame advantage for me. My focus now shifts to understanding how beam clashes are resolved.

**Resolving Beam Clashes**

I've meticulously analyzed the `clash` state in the engine. My focus is on how the clash point `c`, ki expenditure, and power scaling influence the outcome. I'm particularly interested in the interaction between pushing and ki drain, and how power drastically drops when ki reaches zero.

**Calculating Clash Impact**

I'm evaluating the trade-off between pushing during a beam clash for immediate power gains versus conserving ki for sustained power later. The critical factor is avoiding running out of ki, which causes a severe power drop. I need to determine optimal push timings based on clash duration and current ki levels.

**Analyzing Beam Clash Ki Management**

I'm reassessing my beam clash strategy, particularly concerning ki expenditure. I've identified several scenarios where pushing is optimal, even with a ki disadvantage, or when the opponent is depleted. The key is to avoid running out of ki myself, which severely handicaps my power.

**Calculating Beam Clash Ki Management**

I'm reassessing my beam clash strategy, particularly concerning ki expenditure. I've identified several scenarios where pushing is optimal, even with a ki disadvantage, or when the opponent is depleted. The key is to avoid running out of ki myself, which severely handicaps my power.

**Analyzing Opponent Strategies**

I'm now shifting focus to opponent modeling and the broader strategy space of potential AI opponents. Given the real-time adaptation within matches, I'm categorizing bots into archetypes like rushdown, zoner, or guard-heavy, to anticipate their behaviors and develop tailored counter-strategies.

**Developing Hybrid Strategy**

I am synthesizing my findings into a dual-layered approach. The first layer focuses on mathematically guaranteed tactical sequences derived from exact physics, ensuring optimal punishes and defenses. The second layer will employ forward simulation, leveraging the engine's code, to navigate neutral and mixup scenarios, adapting to opponent archetypes.

**Simulating Game States**

I'm exploring the feasibility of reconstructing the exact engine state within `decide(state)`. My goal is to simulate sequences of actions for 6 to 35 ticks, especially for scenarios where `state.me.canCancel` is true or during clashes. The number of possible opponent actions is significantly limited when they are not free, simplifying the simulation.

**Simulating Decision States**

I've realized the opponent is functionally locked into their current action for `opp.left` ticks, barring specific hits. Simulating approximately 25 ticks with ~8 opponent actions per tick is computationally trivial, yielding around 50 microseconds per decision cycle. This allows for extensive forward simulation within the budget.

**Reconstructing Engine State**

I'm verifying if I can perfectly replicate the engine state from the provided `view`. My analysis shows that all crucial properties like tick, position, HP, ki, and state are accessible and sufficiently precise. This confirms my ability to run deterministic simulations within the `decide` function.

**Calculating Exact State Parameters**

I've successfully derived exact formulas for several crucial state parameters. I can now precisely determine `su` for beam attacks and accurately infer the opponent's chain and hit status, even when not directly provided, based on their state and available tick data.

**Simulating Game States**

I'm exploring the feasibility of reconstructing the exact engine state within `decide(state)`. My goal is to simulate sequences of actions for 6 to 35 ticks, especially for scenarios where `state.me.canCancel` is true or during clashes. The number of possible opponent actions is significantly limited when they are not free, simplifying the simulation.

**Simulating Exact Interactions**

I'm now able to deterministically simulate nearly all game interactions. By reconstructing the engine state and running forward simulations for up to 35 ticks, I can precisely predict outcomes for dashes, beams, and blast collisions, eliminating guesswork and enabling optimal decision-making.

**Simulating Advanced Interactions**

I'm now able to deterministically simulate nearly all game interactions. By reconstructing the engine state and running forward simulations for up to 35 ticks, I can precisely predict outcomes for dashes, beams, and blast collisions, eliminating guesswork and enabling optimal decision-making, especially when considering free actions versus committed moves.

**Exploiting Whiff Punish Windows**

I've discovered a crucial interaction: if the opponent whiffs a heavy attack at a distance greater than 140, I can initiate a forward movement for 6 ticks. This closes the distance sufficiently to guarantee a counter-attack hit without spending ki on a dash, catching them during their recovery.

**Reconstructing Match State**

I'm meticulously verifying state reconstruction for simulation. I've identified the need to track several additional frame-specific properties across ticks, like previous positions and dash parameters, to ensure perfect fidelity within my embedded `simStep` function.

**Inferring Opponent Dash Direction**

I'm focusing on how to precisely determine the opponent's dash direction and trajectory. By tracking their position before and after a dash, and considering their initial `x0` and `x1` values, I can deduce the exact parameters of their movement, allowing for more accurate prediction of their actions and subsequent counter-strategies. I am also profiling opponent tendencies during close-range pressure to better anticipate their defensive and offensive choices.

**Analyzing Opponent Behavior**

I'm now analyzing opponent habits at mid to long range, focusing on charge, blast, and beam rates. I'm also dissecting their reactions to blocked light attacks, specifically whether they mash, guard, or retreat. This is crucial for understanding their pushback and recovery responses.

**Developing Whiff Punish Strategy**

I've discovered a guaranteed heavy punish for a whiffed opponent light attack. By walking back precisely 12 units upon wake-up from a blocked light, their retaliatory light will miss, allowing my heavy attack to connect for 150 counter damage. I'm also testing guard crush follow-ups.

**Confirming Guard Break Counters**

I'm verifying the impressive damage and counter-play options following a guard break. It seems a specific sequence of light attacks guarantees a heavy follow-up for over 230 damage, with precise counters available against mashers and turtles based on distance and their attack choices.

**Calculating Combo Guarantees**

I'm refining my logic for guaranteed KOs and combo extensions. My current focus is on calculating precise damage values based on current scale and hitstun multipliers, ensuring I can identify immediate KO opportunities with heavy or light attacks, and also predict guaranteed heavy follow-ups after light chains based on distance and remaining combo hits.

**Analyzing Beam Clash Ki**

I'm focusing on ki management during beam clashes. My current analysis suggests it's always optimal to push for power gains, even with a ki deficit, unless I'm about to hit zero ki, which severely cripples my power. I'm evaluating specific push timings based on clash duration and current ki levels.

**Managing Beam Clash Ki**

I'm reassessing my beam clash strategy, particularly concerning ki expenditure. I've identified several scenarios where pushing is optimal, even with a ki disadvantage, or when the opponent is depleted. The key is to avoid running out of ki myself, which severely handicaps my power.

**Refining Beam Evasion Tactics**

I'm working on precise calculations for evading incoming enemy beams. My current focus is on determining the exact number of ticks until an enemy beam fires and then hits, factoring in startup and travel time. This will allow me to decide whether to dash or block based on proximity and my available ki.

**Analyzing Beam Counter-Punish**

I'm dissecting opportunities to interrupt and counter-attack incoming beam attacks. Specifically, I'm analyzing if my light or heavy attacks can connect before the opponent's beam fires, resulting in a guaranteed counter-hit combo or significant damage, depending on the distance and their beam's startup timer.

**Analyzing Beam Evasion Options**

I'm investigating optimal evasion strategies against beam attacks, specifically whether to move forward and punish or evade directly. The current focus is on a scenario where the opponent's beam has a startup of over 15 ticks. I can walk forward for 6 ticks, then initiate a heavy or light attack for a guaranteed punish. I'm also analyzing the feasibility of a cross-up dash behind the opponent's beam, ensuring invulnerability during the critical phase.

**Evolving Dash Evade Logic**

I've pinpointed a precise condition where a forward dash guarantees evasion of an opponent's beam attack, placing me behind them. This occurs when the distance is under 200 units, the wall is far enough, and I have sufficient ki. I'm now verifying the exact physics of the beam's hitbox relative to my dash trajectory.

**Confirming Dash Evasion Mechanics**

I've verified the precise conditions under which a forward dash will evade an incoming beam, placing me behind the opponent. This hold true when the distance is under 200 units, the wall is sufficiently far, and I have enough ki, with my invulnerability lasting until I'm safely behind them.

**Analyzing Beam Clash Dynamics**

I've discovered a critical interaction concerning opponent beam attacks at distances beyond 200 units. If their beam is in the startup phase with at least 12 ticks remaining, I can counter-beam, guaranteeing a clash in the center. Guarding a beam is significantly worse due to immense chip damage and ki drain.

**Calculating Beam Clash Strategy**

I'm refining my strategy for beam clashes. It's generally better to counter-beam for a clash than to block and take heavy chip damage, especially if my ki is sufficient. I'm calculating the exact ki thresholds and timings for when this counter-beam approach is optimal compared to other defensive options like guarding or dashing.

**Analyzing Beam Startup Tactics**

During an opponent's beam startup, I've discovered I can gain ki by charging or walk forward. If distance permits, a dash behind them becomes viable. I can also counter-beam if ki is sufficient, as guarding results in unacceptable chip damage and ki drain.

**Reacting to Incoming Blasts**

I've identified critical threat windows for incoming blasts. If the `eta` is 6 ticks or less, immediate reaction is needed. I can also interrupt opponent blast startups with well-timed attacks, depending on distance and available ki, to initiate a counter-hit combo.

**Analyzing Blast Evasion Opportunities**

I'm calculating when my forward dash can pass through incoming blasts unharmed due to invulnerability. This appears possible when the blast is within roughly 264 units, and I'm assessing the follow-up attack possibilities if the opponent is still recovering from firing.

**Dodging Blast Attack**

I've discovered a guaranteed counter-attack combo! If an opponent initiates a blast attack within 300 units, I can initiate a forward dash. My dash invulnerability will carry me through their blast, allowing me to land a guaranteed light combo for significant damage as they recover.

**Analyzing Blast Punish Opportunities**

I've identified a powerful counter to blast attacks. If the opponent initiates a blast within 300 units, I can dash through it with my invulnerability, then land a guaranteed light combo for significant damage as they recover. I'm also refining conditions for even more damaging heavy punishes.

**Reacting to Incoming Blasts**

I've identified critical threat windows for incoming blasts. If the `eta` is 6 ticks or less, immediate reaction is needed. I can also interrupt opponent blast startups with well-timed attacks, depending on distance and available ki, to initiate a counter-hit combo.

**Analyzing Opponent States**

I'm focusing on exploiting the opponent's `invulnerable` state and when they are not `free`. My current analysis covers scenarios where they are in `recovery`, `crushed`, `hitstun`, `blockstun`, `recover`, or initiating an attack that cannot reach me. This allows me to plan guaranteed hits before their `left` timer expires.

**Calculating Combo Damage**

I've finalized a devastating light-to-heavy combo sequence. A string of four light attacks, precisely timed to account for pushback and chain limits, guarantees a follow-up heavy for 174 damage. This combo is even more potent with counter-hits or charge-hits, yielding up to 194 damage plus significant knockback and knockdown.

**Calculating Combo Damage Potential**

I'm refining my damage calculations by incorporating opponent charge states, which multiply base damage. I'm now precisely calculating the maximum damage output for light-to-heavy sequences versus raw heavy attacks, considering different starting distances and opponent vulnerability timings to ensure optimal KOs or combo extensions.

**Analyzing Punish Windows**

I'm prioritizing identifying and exploiting punish windows. My current focus is on scenarios where the opponent is recovering or locked into an action, allowing a guaranteed hit. I'm exploring specific ranges and ki costs for different punish types like walking forward, dashing, and even long-range beams, ensuring optimal damage with minimal risk.

**Analyzing Beam Damage Multipliers**

I've discovered that my assumptions about beam damage multipliers were slightly off. The `mult` function in `engine.js` reveals that counter hits during beam startup or recovery increase damage by 25%, leading to a potential 350 damage hit, not 280, if the opponent is facing the wrong way after a cross-up.

**Planning Wake-up Punishes**

I'm analyzing wake-up scenarios now. My focus is on guaranteed punishes when the opponent is in a 'down' state and becomes vulnerable, aiming to initiate attacks just as their invulnerability expires for maximum damage and combo potential, especially in situations leading to a guaranteed KO.

**Exploiting Wake-Up State**

I've discovered a critical wake-up interaction. If my attack's active frames land on the same tick the opponent wakes up, it's a guaranteed hit before they can act, receiving damage bonuses for counter or charge hits. This opens up devastating punish sequences.

**Analyzing Wake-Up Interactions**

I've been rigorously testing wake-up scenarios, and it appears my understanding of meaty attacks was slightly off. If my attack's active frames overlap with the opponent's vulnerability on tick `t + opp.left`, it guarantees a hit. This holds true even if they are 'down' and would normally be invulnerable, provided the attack starts within the correct frame window.

**Exploiting Wake-Up State**

I've discovered that any active frames of my light or heavy attacks that overlap with the opponent's wake-up tick are guaranteed hits. This is because the `a.hit` flag isn't set when the opponent is `down`, opening up reliable punish sequences, especially since they're vulnerable for the entire knockdown duration.

**Analyzing Wake-Up Options**

I'm analyzing safe options during opponent's wake-up state. Charging ki is risk-free as their recovery timer exceeds charge duration. Walking forward is also safe if they are far away, allowing me to close distance before they can act. I need to confirm the exact conditions for risk-free charging.

**Analyzing Wake-Up Interruption**

I've confirmed that if the opponent's remaining stun ticks (`opp.left`) are 2 or more when I stop charging, I can hit them with a heavy attack as they recover. If they prefer to guard or mash on wake-up, I can time a light or heavy attack to guarantee a hit before they can act.

**Exploiting Light Attack Range**

I've discovered a crucial advantage with light attacks at close range, specifically under 95 units. Their backward walk defense still lands them within hitstun. This makes light attacks near-risk-free, confirming into powerful combos if they guard, or punishing their active defenses.

**Analyzing Opponent Defensive Options**

I'm analyzing their defensive responses at different ranges. At close range, light attacks guarantee hits even on guard, leading into combos. Between 110 and 140 units, their light attacks whiff, while my heavy attack remains in range for a guaranteed hit and significant damage.

**Confirming Heavy Attack Guaranteed Hits**

I've confirmed that within a specific distance range, my heavy attack guarantees a hit or guard crush against an opponent's defensive actions. Even if they attempt to attack or guard, my heavy connects first, resulting in substantial counter-hit damage. This provides a reliable punish option.

**Crushing Opponent Guard Options**

I've discovered a potent punish for specific opponent actions at certain distances. My heavy attack guarantees a guard crush at tick 9, dealing significant damage and allowing for follow-up combos. Opponents attempting to move forward, blast, beam, or charge will be hit before their actions can connect, making walking back or dashing the only viable escapes.

**Synthesizing Hybrid Strategy**

I'm combining deterministic analysis of guaranteed hits and optimal combos with short-horizon forward simulations. This allows me to handle immediate tactical situations perfectly while exploring neutral and mix-up scenarios to adapt to opponent archetypes and make better strategic decisions.

**Simulating Potential Outcomes**

I'm now focusing on evaluating potential actions by simulating their outcomes. For any given action I might take, I'm looking to predict the opponent's response, especially when they are not free to act. This allows me to precisely determine guaranteed hits and assess optimal strategies.

**Simulating Opponent Actions**

I'm now incorporating opponent wake-up responses into my simulations, assigning probabilities based on observed habits. When they're free, I'm modeling simultaneous action choices, assuming synchronized 6-tick decision clocks for accurate prediction of their potential moves.

**Simulating Free States**

I'm refining my simulation logic to account for free states. When my bot has 6 ticks to choose a new action, the simulator will now pick the optimal follow-up, whether it's a punish, evasion, or defensive maneuver, based on the predicted opponent's state and actions.

**Refining Simulation Logic**

I'm refining my simulation logic to better handle cancel opportunities. My current focus is on how a `cancel = true` event automatically triggers the optimal BnB combo for both myself and the simulated opponent, allowing me to accurately calculate the true cost of hits and potential combo damage.

**Calculating Guaranteed Combo Damage**

I'm realizing that when `me.cancel` becomes true after landing a light hit, I can immediately credit the remaining guaranteed light-to-heavy combo damage rather than needing to simulate it. This drastically speeds up evaluation for known combo states and ensures accurate damage prediction.

**Simulating Guaranteed Damage**

I'm enhancing my simulation to incorporate guaranteed damage calculations. At the simulation horizon's end, I'll check for active cancels or stun states and credit the guaranteed follow-up damage in the evaluation function. This means the simulator will select exact cancels during ticks and then add guaranteed combo damage.

**Simulating Action Outcomes**

I'm refining my simulation's opponent action weighting. When the opponent is free, I'm focusing on calculating the outcomes for each of their probable actions and how they combine to influence my decision. The computational cost appears very manageable within the time budget.

**Refining Simulation Strategy**

I am now blending deterministic tactical analysis with short-horizon forward simulations. This dual approach allows me to guarantee optimal punishes and defenses while exploring neutral and mix-up scenarios to adapt to opponent behavior.

**Analyzing Blast Projectile Interactions**

I've discovered a critical interaction where my blast can hit the opponent's back if they guard while I dash behind them. My simulator will automatically exploit this. I'm also ensuring my simulation handles projectile travel times exceeding the 22-tick horizon by evaluating guaranteed hits and chip damage.

**Analyzing Beam Interaction Logic**

I've uncovered a critical interaction concerning beams and opponent recovery states. If an opponent is locked in recovery or stun, a beam I fire is guaranteed to hit, dealing 350 damage if they're facing away or 280 otherwise. My simulator now accounts for this, preventing us from getting hit in recovery.

**Analyze Beam Punish Logic**

I've confirmed that beams at distances greater than 225 units become unpunishable if the opponent has less than 50 ki or cannot counter-beam before it hits. This scenario guarantees significant chip or direct damage, making ki control paramount for defensive stability.

