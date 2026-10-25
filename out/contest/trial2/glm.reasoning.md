Let me design a solid bot. Key mechanics:

- Guard blocks light/blast/beam. Heavy crushes guard (60 dmg + stun 34). So opponent guarding: use heavy.
- Punish: heavy on stunned opponent.
- Blast incoming: guard (chip 12) or dash through (invuln 9 ticks, blast speed 13*9=117... dash invuln covers 9 ticks; blast moves 13/tick; need timing). Guard is simpler.
- Beam incoming: dash forward through (invuln 9 ticks, beam speed 30 -> 270 covered, if distance > 270 still in beam... risky). Better: when opponent in beam startup (30 ticks), rush in and hit them to interrupt. Or guard: chip 120 + stun until beam ends — bad. Dash_back 200 avoids beam if beam front hasn't reached? Beam front travels 30/tick; dash_back moves 200 over 10 ticks. Could outrun. Actually beam fires 40 ticks, front max travel 1200, covers whole stage. If we dash_back early (during their startup), we gain 200 distance, front needs more ticks to reach, then beam ends. Or dash_forward through them? dash_forward ends behind them — beam is behind shooter too? Beam ray is from shooter to front — going behind the shooter means outside ray. Dash_forward 200 over 10 ticks with 9 invuln; beam front 30/tick. If dist ~ 200+, dash forward passes shooter... risky if beam active. Best: punish beam startup with dash_forward + heavy/light.

Simple strategy:
1. If canCancel: chain lights up to 4, then heavy (combo scaling: 40, 32(0.8), 26, 22, heavy 120*0.45=54... total ~174). Actually after lights, heavy scaled. Maybe light chain then heavy.
2. Opponent in hitstun/long stun near: heavy.
3. Opponent guarding near: heavy (crush).
4. Incoming blast with small eta: guard. If eta small and opponent close, could jump? no. Guard.
5. Opponent beam startup: dash_forward if affordable, then punish. Else guard? Guard eats 120 chip + long stun. Dash_back to buy time: beam fire 40 ticks, front 30/tick = 1200 range, whole stage, can't outrun if fired early. Actually front starts at shooter+40 and gains 30/tick; if we're 500 away, front reaches us in ~15 ticks, beam ends at tick 40. If we dash_back during their startup (30 ticks), we move 200 back; front needs extra ~7 ticks. Still gets hit unless beam ends before. Timing: beam fires from t=30 to t=70 of their move. If at their t=0 we're at distance D, we can walk back 3/tick during startup. Front reaches us when 40+30(t-30) = D+3t → t ≈ (D+890)/27... hmm too complicated. Simplest reliable: dash_forward during their startup to get behind them (dash passes through), then they can't turn (frozen in beam). Then punish with heavy from behind — but heavy takes 9 startup, their beam startup 30, if we dash at their t<20 we land behind, heavy hits their back (guard won't block back). Beam startup can be interrupted by hits! "发射期间你被打中，大招就断了" and startup hits interrupt (被打断). So dash_forward into light/heavy punishes beam startup hard.

But careful: dash cost 10, beam cost 50. 

6. Own ki management: charge when far and opponent not attacking. Blast to pressure (70 dmg, 20 ki). When ki ≥ 50 and opponent in startup of something slow or stunned, beam = 280 dmg.

7. Avoid whiffing: light reach 110, heavy 140, min gap 60.

Opponent heavy startup (9 ticks): can we punish? We see it only every 6 ticks, plus when we become free. If opponent starts heavy at tick T, we might see it at T..T+5. Back off (back 3/tick won't escape 140 reach quickly). Guard → get crushed. Better: if we're free and dist ≤140, throw our own light (startup 5, active 3) — trade? Their heavy 120 vs our light 40 — bad trade. Dash_back (200 over 10 ticks, invuln 9) escapes and dodges. Cost 10 ki. Use dash_back when opponent heavy startup and dist<150 and ki≥10. Or counter with heavy if our timing beats theirs — nah.

Also when we're in a combo cancel chain, opponent might guard mid-chain? Opponent in hitstun can't act. Chain lights: light recovery 9, hitstun 15. Hit at tick 0 (active starts at t=5... let's say hit lands at some tick), cancel next tick, new light startup 5+active: hits 5-8 ticks later, hitstun remaining 15-8=7 >0? Sequence: light hits at tick T, hitstun 15 (T..T+14). Cancel at T+1, new light active at T+6..T+8, stun until T+14... next cancel T+7ish, next active T+12..14, next T+18 — hitstun expired, opponent can guard. Chain limit 4 lights anyway. So chain 3 lights then heavy? Heavy startup 9 — from cancel at T+7ish, active T+16..19 — opponent free at T+15, could guard → crush them (heavy on guard = crush 60 + stun 34, good actually!). Or dash back. Heavy into just-freed opponent: they might guard → crush 60, or back off (3/tick, reach 140 vs movement... active at T+16, they moved ~3 ticks*3=9, still in reach). OK heavy finisher fine.

Actually combo scaling on heavy: after 3 hits, 0.55 → 120*0.55=66. Plus crush path.

Blast spam: 70 dmg for 20 ki, safe at range. Opponent can guard (12 chip + they gain 2 ki... wait blocked gives defender +2 ki and us +0.24 ki from chip dealt). Guard chip 12 per blast, ki cost 20, regen passive. Spamming blasts at range: 12 chip each if guarded, else 70. Good pressure. But blast travels 13/tick; opponent may dash through (invuln 9 ticks covers 117 units — blast moves 13/tick during dash, dodge registered). Opponent approaching: blast then when they get close, fight.

Time management: 3600 ticks. If ahead on HP, play safe.

Let me also handle clash: push when myPower + margin vs oppPower, and ki management. Push adds 0.6 power, costs 0.6 ki/tick extra. Power = 1+0.02ki (+0.6 push). Push while ki > some threshold; if losing badly, still push (rage). Simple: push if myPower - oppPower < 0.3 or ki > 30. Actually compare: pushing raises my power by 0.6, drift 0.1 per power diff. Push always when ki>5? Drain 0.8/tick while pushing, 360 max ticks. Ki 100 lasts 125 ticks pushing. Push if myPower+0.6 > oppPower or pos close to me. Simple: push if ki > 15 or losing position (pos<0.35 or >0.65 toward me). Fine.

Punish windows: opponent in recovery of whiffed moves → dash_forward + heavy? Or walk in. Opponent light recovery 9 ticks, hard to punish from range. Opponent blast recovery 18 — dash in for free hit. Opponent heavy whiff recovery 22 — punish.

Also punish opponent's blast startup: blast startup 11, we see it, dash_forward through blast? Blast spawns at their x+40 at their t=11. Dash invuln 9 ticks. If we dash toward them when we see blast startup, we pass through and hit them during recovery. 

Let's write the decide function.

```js
let lastT = -1;
function decide(s) {
  const R = RULES;
  const me = s.me, op = s.opp;
  
  if (s.clash) {
    const c = s.clash;
    // push if it matters
    if (me.ki > 8 || c.pos < 0.3 || c.pos > 0.7) return 'push';
    return 'idle';
  }
  
  // cancel window
  if (me.canCancel) {
    if (me.chain < 3 && op.state !== 'down') return 'light';
    if (s.dist <= 140) return 'heavy';
    if (!me.blastOut && me.ki >= 20) return 'blast';
    return 'light';
  }
  if (!me.free) return 'guard';
  
  const d = s.dist;
  const opFree = op.free;
  
  // incoming blast: guard
  const inb = s.blasts.find(b => b.incoming);
  if (inb && inb.eta <= 8 && !(me.ki>=10 && inb.eta<=4 && d>200 && false)) {
    // could dash_back to dodge? dash invuln 9 ticks; blast moves 13/tick, dash moves 20/tick. eta<=4: dash makes blast pass? blast relative speed during dash... simplest: guard
    return 'guard';
  }
```

Actually dodging blast with dash_back: dash invuln 9 ticks, blast moves 13/tick toward us, we move 20/tick away: relative 33/tick, blast passes us (needs to cross body 60+: ~2-3 ticks) then we're past it? But blast continues and we move back... after invuln ends, blast is behind us (it passed through). Blast dead after passing? Blast only dies on hit or offstage. If it passes through during invuln, it's behind, gap becomes negative, not incoming. So dash_back at eta ≤5 dodges fully, costs 10 ki vs guard chip 12 + blockstun 14. Guard also gives +2 ki. Guard is fine and simpler, keeps position. Guard it is. But if guarding would put us in blockstun while opponent closes in... acceptable.

Better: if blast incoming and opponent far, guard. If opponent close (following blast), guard then they might heavy-crush us during blockstun. Hmm, blockstun 14 ticks; opponent behind blast... could dash_forward through the blast to their face? If d < ~300, dash_forward: invuln 9 ticks, blast passes through us (dodge), we land near/behind them, then punish. Aggressive option when ki >= 20 and d between 100 and 300 and blast eta <=6. Let's include: dodge blast with dash_forward into them, then next decision (we're in dash recovery, asked when free at dash end t=18... dash recovery 8, asked when free). Actually during dash we can't act. We land, become free, then decide: opponent likely in blast recovery → heavy. Nice.

Beam handling: if op.state==='beam' && op.phase==='startup':
- if me.ki >= 10 and d >= ~120: dash_forward → lands behind them (through), then punish heavy (they're frozen in beam startup, back turned to us, can't guard — guard only front! They're facing away... they face us originally, we land behind, guard covers front only, so heavy hits fully, counter ×1.25!). 120*1.25 = 150. Or beam of our own? No, dash punish.
- if no ki: back off + guard? Guard gives 120 chip and stun till beam ends — terrible. Walk back during 30 ticks: 90 units. Beam front starts +40, 30/tick. If d + 90 > 40 + 30*(t remaining)... if we see at their t=0 (we get asked every 6 ticks, worst case we see at t=5). We back away, distance grows 3/tick, front approaches 30/tick net 27. Front reaches us before beam ends unless d large. Front start 40 from them, fire lasts 40 ticks → max front advance 1200. To survive by retreating: need our position beyond front at t=70: our dist = d+3t, front=40+30(t-30). Need d+3t > 40+30t-900 → d > 0.4... i.e., need d+3*70 > 40+30*40=1240... front max = 40+30*39≈1210 from shooter. We retreat 90 max. If d ≥ 1120 safe, impossible. So can't outrun. If beam active and no ki: guard and eat 120? Or dash_back: 200 back. If beam just started (their t≈30) and d ≥ ~450: front at 40, reaches us in (d+3t-40)/30... with dash_back 200, need front to not reach before t=70: d+200+small > front max 1240 → d>1000 impossible. Hmm front can go to stage edge though. Realistically: if beam active and heading to us, options: dash_forward through (invuln 9, but we travel 200 in 10 ticks, beam front 30/tick — front might catch us at tick 9+ after invuln while we're in ray. Ray covers from shooter to front, so being between shooter and front = hit. Passing shooter: dash_forward through them goes behind shooter, out of ray (ray from = shooter+25 toward us). If d ≤ ~ 300, dash_forward crosses the beam and shooter within 10 ticks? We move 20/tick, front moves toward 30/tick — closing 50/tick... front starts at shooter+40 (toward us), we start at d. Meet when 40+30t = d-20t → t=(d-40)/50. For d=300, t=5.2 — within invuln 9 ✓. For d=150, t=2.2 ✓. For d=500, t=9.2 ✗ borderline. So dash_forward when beam incoming and d ≤ 450 works to cross behind. If d>450, hmm, dash_back won't help; guard eats 120 chip. Alternatively dash_back reduces... no. Best for d>450: dash_back anyway? Front needs (d-40)/30 more ticks to reach; beam fires 40 ticks → front reaches d=1240. If d=600, reaches at t=30+ (600-40)/30 ≈ 48.7, beam ends t=70 — hit. Can't avoid without crossing. Guard = 120 chip + stun. Eh, accept guard. Or fire own beam to clash? Cost 50; clash mechanics uncertain. Or fire blast? Beam swallows blasts. 

Actually another option: dash_forward when d>450: we move toward, meet front at t=(d-40)/50 > 9 — during invuln front passes through us? At t=9 invuln ends; where's front vs us? front=40+270=310; us = d-180. If d=500: us=320, front=310 — front hits at t≈9.2 just after invuln. Risky. So: beam active/incoming and d ≤ 420 → dash_forward; else guard.

But wait — dash through opponent: lands behind, then we're behind shooter, out of ray, and can punish them during firing (they can't act, facing forward). heavy from behind: 120×1.25 counter = 150! Great.

If op beam startup: dash_forward too (safer, interrupts). Also could just heavy if close: heavy startup 9 vs their remaining startup. If op.t small and d ≤ 140, heavy interrupts.

Heavy defense: if op.state==='heavy' && op.phase==='startup':
- if d > 160: back/guard? They'll whiff probably (reach 140, they move not). If d>150, safe, use the whiff: after their active ends (t=13) recovery 22 ticks — dash_forward punish. Track: if op heavy and d>150, just wait/charge? We get asked every 6 ticks; when their phase becomes recovery, dash in and heavy. Their recovery ends at t=35. We dash (18 ticks total incl recovery... dash moving 10 + recovery 8). Timing: dash at their t=13 → land t=23 at their face (d-200... if d=200, land at min gap 60 behind? dash goes through if room; we want in front. dash lands at x1: if before>0 and after<60... complicated. If d=200, dash forward target = our x+200 = their x... after = 0 <60 → pass through! We'd land behind. Hmm, but landing behind a recovering opponent is fine too, then next ask we heavy their back. Actually simpler: if op heavy recovery and d ≤ 350, dash_forward, then heavy on next ask.
- if d ≤ 140: we're in their reach. Options: dash_back (escape + dodge), or light them (startup 5 vs their remaining... if their t ≥ 5 already, our light active at 5-8, their active 9-12: our light hits first at t=5? Distance ≤110 needed. Light hits them during startup = counter, stun 15, then cancel → more hits! If d≤110 and op heavy t≥... our light active starts 5 ticks after our decision — but we might not be asked immediately. Worst case we're asked at op.t=5 (they started 5 ago), our light active at our t=5 → op.t=10, they're active at 9-12 — trade? Trades: their heavy 120×counter(we're in light startup? our light t=5 is startup end... at their hit tick our t: our decision at op.t=5, hits resolve simultaneously; our light active tick 5,6,7 → op.t=10,11,12 vs their active 9-12. Both land same tick = trade 40 vs 120×1.25(counter, we're in startup? our phase at t=5 is startup (t<5 startup... t<startup means t∈{0..4} startup, 5-7 active). At op.t=10 our t=5 → active, not counter. We take 120. Bad trade.
  So if d≤140 and op heavy startup: dash_back if ki≥10. Else guard (crush 60+stun34, better than 120+down42? crush: 60 dmg, stun 34. Full hit: 120, knockback 150, down 42. Crush better). Else light if d≤110? risky trade as shown. Guard fallback.

Opponent blast startup (t<11): dash_forward if d ≤ 300ish and ki≥10 → dodge blast (invuln) + land in their recovery. But blast spawns at their t=11 from their position; we dash, passing... blast goes forward from them, we're approaching, blast meets us — invuln. Blast speed 13, we 20, closing 33. Blast spawns at their x+40 (toward us at spawn = between). Gap d. Meet at t: 40+13t = d-20t → t=(d-40)/33. d=200→t≈4.8 ✓ invuln. d=100→1.8 ✓. d=300→7.9 ✓. d=350→9.4 ✗ (just past invuln — borderline, blast passes through if crossing during invuln; at t=9 our x moved 180, blast at 40+117=157 from shooter, we at d-180=170 — blast just behind us, passed? blast at 157, we at 170... blast behind us moving toward, we moving toward shooter — it passed. invuln ends t=9 with blast behind → safe). So d ≤ 400 dash forward works mostly. Then heavy their recovery.

Our own offense when both free:
- If d > 130: approach. But guard against opponent's dash-ins? If op tends to dash... can't know. Use forward; if ki<100 and d>500 and no threats, charge.
- When d in [60,140]: mix up. Opponent might guard → heavy crush. Opponent might attack → trade. Simple policy: if op.state==='guard' → heavy (crush). If op just became free and d≤110 → light (fast, beats their startup if any? our startup 5+ask delay). Hmm.

Actually a strong simple approach at close range: throw light. If it hits → combo cancel chain. If blocked → blockstun 11 on them, pushed 14 apart, we're in recovery 9 — fine. If they heavy during our light startup → we eat counter heavy. Risky game of RPS. Against unknown AIs, light is decent: many bots guard.

Let me think about what other rule-following bots likely do: guard a lot, charge, blast spam. Heavy crush punishes guard. Light whiffs get punished by... 

I'll do: at close range (d≤130), mostly heavy when op is guarding or in recovery/stun; light when op free (to start combos / bait). Use some randomness to be less exploitable.

Punish opponent stun: if op.state is 'hitstun' and op.left >= 6 and d≤140 → heavy. If op.state 'crushed' or 'blockstun' long → heavy. If op down → charge or back off (can't hit them). If op down and long, charge ki.

KO attempt: if op.hp low, be aggressive.

Blast usage: if d ≥ 300 and ki ≥ 60? Fire blasts for chip/pressure. Actually blasts: 20 ki, if guarded only 12 chip but they gain 2 ki + we gain ~0.24. Neutral-ish. If they dash-dodge, wasted. If hit, 70 + they gain 5.6 ki... hmm they gain 0.08/dmg taken. Blast gives them 5.6 ki. Meh. Use blasts moderately: when d in [250, 600] and ki ≥ 50, fire occasionally (random) to interrupt their charge (charge ×1.5 = 105 dmg!). If op is charging and blast can reach: fire. Charge punish priority: if op.state==='charge' and d ≤ 800: blast if ki≥20 and d ≤ 900 (blast speed 13, they might stop charging and guard — they get asked every 6 ticks... they see blast eta and guard: 12 chip. If they keep charging: 105.)

Beam usage: when op in long stun (crushed 34, down? can't hit down... down is invuln). op crushed: 34 ticks — beam startup 30, beam fires at t=30, op stun ends 34 → hits at 30-34 window if ray reaches: ray front moves 30/tick, at t=30 front at +40; need d ≤ ... beam fires instantly covering from to front growing 30/tick; op at distance d gets hit when front ≥ d-30 → t = 30 + (d-70)/30. Need ≤ 34 → d ≤ 190. Meh. Simpler: when op crushed or in beam-recovery or blast-recovery within reach, heavy/dash combos.

Beam when op blast-recovery: blast recovery 18 ticks < 30 startup. No.

Use beam as finisher when op hp ≤ 280 and they're... they'd guard → 120 chip kills if hp<120. Guard doesn't fully save.

OK, also anti-air for their dash: if op.state==='dash' and moving toward us: they're invuln; after they land behind us... we turn only if free at that time. When op dash ends and we're free, we face them. Then they're in dash recovery 8 ticks → free heavy punish if in reach. Detect: op.state==='dash' && op.phase==='recovery' && d≤140 → heavy (counter 1.25!). 

Let me now also handle our blast while opponent close: don't blast if d<150 (recovery 18 = free punish).

Priority list in decide (when free):

1. clash → push logic
2. canCancel → combo continue
3. not free → guard (return something safe)
4. incoming beam ray about to hit (in beams, !mine, covers my x or near): dash_forward if ki≥10 (cross) else guard. Check: beam front approaching. Condition: enemy beam exists, its front between me and them, eta = (front - (myx-30))/30 small. Compute: beam covers from shooter to front; I'm hit when front ≥ me.x - 30. etaTicks = (front - (me.x - 30*sign))/30. If eta ≤ 3 → react. Let's approximate with dist: if op beam firing and front hasn't passed me: dash_forward if ki≥10 (works if we can cross within invuln — computed earlier ~ok for d≤450). Else guard.
5. op beam startup: dash_forward (ki≥10) to cross behind & interrupt; if d≤140 maybe heavy directly (faster punish, no ki): heavy startup 9 < remaining? If op.t ≤ 20 sure. If ki<10 and d>140: guard (eat crush... no wait guard vs beam = 120 chip + stun till end). Hmm all bad; choose guard. Actually if ki<10, could we charge? No. Guard.
   Wait — better ki<10 option: dash impossible, so guard.
6. incoming blast: if eta ≤ 6: guard. (Or dash_back if ki rich and want to dodge — guard fine.) Actually consider: if we're charging and blast comes, guard.
   But if op close behind blast (d ≤ 250) and ki ≥ 10: dash_forward through blast into their face.
7. op heavy startup: d≤150 → dash_back if ki≥10 else guard; d in (150, 400] → idle/wait then punish recovery.
8. op light active/startup near: if d ≤ 110... our counter options: back off? light trade bad. Guard (blockstun 11, +2 ki, they pushed 14). Guard is fine.
   Actually if op light startup and d≤110 and we're asked: our light active at 5-8 vs theirs — whoever started first wins-ish. Guard.
9. op dash toward us (phase moving, moving closer): they'll land near/behind. Hard to react. If op dash recovery → heavy punish.
10. punish states:
    - op.state in ('crushed','hitstun','blockstun') with left ≥ 8 and d≤140 → heavy
    - op.state in ('crushed') any d≤140 → heavy
    - op.state === 'blast' && phase recovery && d ≤ 350 && ki≥10 → dash_forward then next ask heavy. Or if d ≤ 130 walk-in heavy.
    - op.state === 'heavy' && recovery && d ≤ 350 && ki ≥ 10 → dash_forward punish.
    - op.state === 'beam' && (firing or recovery) and !beamThreatHandled... if we dashed behind, now heavy.
    - op.state === 'dash' && recovery && d ≤ 140 → heavy.
    - op.state === 'light' && recovery && d ≤ 120 → light? our light startup 5, their recovery left ~few. If left≥6, light (counter 1.25 = 50). Or heavy.
11. op charging: if d ≥ 200: blast if ki≥20 (105 dmg). If d≤110: heavy (180!) or light chain. 
12. op guarding: if d ≤ 140: heavy (crush). But careful: opponent guarding bait, they release and we whiff heavy → punished. Rule bots likely hold guard though. Include randomness? Crush = 60+stun34, then we get asked when they're stunned → another heavy 120 (counter? crushed state — mult only for charge/startup/recovery; crushed counts normal → 120, then knockdown. Total ~180+. Good.
13. Neutral close (d≤110): light with some probability, else guard/back mix. Light leads to combos if hits.
14. Approach: forward. Charge when d ≥ 500 and op not blast-capable threat... they might blast us while charging (×1.5). Charge only when d ≥ 600? Blast travel time = 600/13 ≈ 46 ticks — plenty of reaction (asked every 6, guard before). eta from anywhere: we see blast with eta; at eta 46, we get asked within 6 ticks, guard. Fine. So charge when d ≥ 450 and op not currently attacking. Guard immediately when blast incoming.
15. Blast pressure: if d in [250,600] and ki ≥ 55 and op free and random < 0.3 → blast. Also if op charging (priority 11).

Time/HP: if timeLeft < 600 and hp < op.hp → aggression: beam if ki≥50 (they might guard → 120 chip). If hp > op.hp and timeLeft low → play safe (guard/back at range, charge not needed... charge risks; just guard/keep away).

Edge: our own blast out → can't blast again (blastOut check).

Let me also make sure guard isn't exploited by heavy-crush: opponents that heavy when we guard. We guard mainly vs projectiles/attacks — brief. If opponent repeatedly crushes us... can't adapt much without memory. Could track opponent behavior in globals per-match: count their heavies on our guard. Keep simple: limit continuous guard duration — after guarding N ticks with nothing happening, back off or light. We're asked every 6 ticks while guarding; track guardTicks += 6 each time we return guard while me.state==='guard'. If guardTicks > 20 → do something else (back). Also track: if op tends to throw heavy at close range (observed), prefer back/dash instead of guard at close range. Let's record oppHeavy count vs our guard... simple heuristic: remember if last crush happened; if crushedCount ≥ 2, at close range prefer dash_back or light instead of guard. Implement modestly.

Let me write the code.

```js
var crushedCount = 0;
var guardTicks = 0;
var lastT = -1;

function decide(s) {
  const R = RULES;
  const me = s.me, op = s.opp, d = s.dist;

  // track crushes
  if (me.state === 'crushed' && /* new */ s.t - (decide.lastCrushT||-99) > 40) { crushedCount++; decide.lastCrushT = s.t; }

  if (s.clash) {
    const c = s.clash;
    const losing = c.pos < 0.25 || c.pos > 0.75; // pos: 0 at me, 1 at opp — wait pos 0 is at MY body
```

clash pos: 0 在你身上,1 在对手身上. So pos < 0.3 means clash point near me (danger). Push when: ki decent, or point near me, or my power+push > opp power. myPower includes push if currently pushing? power computed with f.push — view shows current myPower. Strategy: push if ki > 12 || pos < 0.35. Also if ki===0 stop pushing (waste? pushing with 0 ki: power empty, push adds nothing, cost... "没有气时力量只有 0.5（爆发加成照算）" push only counts if ki>0 per code: power uses (f.push ? C.pushPower : 0) only in ki>0 branch. So don't push with 0 ki). If myPower(with push: myPower+0.6 if ki>0) < oppPower - 0.1 and pos > 0.5 → keep pushing anyway? Drift toward weaker side; if clearly weaker, pushing burns ki for nothing... but point moving toward them is good, save ki, don't push. Rule: push if ki>5 and (pos < 0.4 || myPower + 0.6 >= oppPower). Hmm if we're stronger we don't need to push — save ki? Pushing accelerates win before their rage/timeout. Ki drains 0.2 base anyway. If clearly stronger, push to finish. If weaker, save ki unless point near me. Final:
push if ki>4 && (myPower+0.6 > oppPower || pos < 0.4). Also if pos>0.6 (near them) don't push (winning) unless... fine.

Combo cancel:
```js
if (me.canCancel) {
  if (me.chain < 3) return 'light';
  return 'heavy'; // d should be close since we just hit
}
```
Careful: after 3 lights, heavy — but combo scaling heavy: combo index min(combo,5): after 3 hits, scale 0.55 → 66 dmg, knockdown. Alternatively blast (70×0.55=39) no. heavy best. If d>140 (pushed away by light pushes 14 each... d grows: push 14 per light; starting 100 → after 3 hits ~142. Heavy reach 140 — might whiff! Light push: opponent pushed 14 (or us if wall). After chain, dist could exceed 140. Then heavy whiffs → big recovery. So check d: if d ≤ 130 heavy else blast if possible else light (if chain<4) else idle.

Actually chain<3 lights then heavy: after cancel at hit3, d = d0+42ish. If d0 ≤ 88 fine. Let me just compute at cancel time: if d ≤ 135 → heavy; else if chain < 3 → light; else if ki≥20 && !blastOut → blast; else 'light' if chain<4 else 'idle'... returning non-move at cancel = normal recovery, fine.

Hmm, but if d>135 and chain<3, light again may whiff too (light reach 110). If d > 110, don't light. Then blast or end. OK:

```js
if (me.canCancel) {
  if (d <= 135) return 'heavy';
  if (me.chain < 4 && d <= 108) return 'light';
  if (me.ki >= 20 && !me.blastOut) return 'blast';
  return 'idle';
}
```
Wait chain limit 4; chain counts punches already in string. Use <4.

Actually heavy at d≤135: opponent in hitstun can't dodge/block... they could be at wall etc. fine.

If !me.free and !canCancel: return 'guard' (we're in hitstun/moves; return value ignored? choose() with cancel false and state not free not clash: FREE.has(act) etc — if we're in a move, choose still runs if asked — but wants() only asks when FREE or clash or cancel. So we're only called when free, cancel, or clash. Good, so after cancel branch, we're free.

Main free logic:

```js
// beam threat
const oppBeam = s.beams.find(b => !b.mine);
if (oppBeam) {
  // it covers from shooter toward me
  const distToBeamFront = ... 
```
Compute using beam.front and my x: beam dir toward me. my position: hit when front passes me.x - 30*facing... approximate: gap = (me.x - beam.front) * (-beam.dir)... let me define: beam moves dir d_b; my body at me.x; front reaches me when (front - me.x)*d_b >= -30 (body 30). eta = (me.x - 30*? ... front needs to reach me.x - 30*d_b... eta = ((me.x - beam.front)*d_b + 30)/30? Let's just: etaBeam = ((me.x - beam.front) * (-beam.dir) - 30) / 30. Hmm signs confusing. beam.dir is direction beam travels. Front approaches me: remaining distance = (me.x - beam.front) * beam.dir (positive if front hasn't reached me). eta = (remaining + 30... body radius)/30 roughly = (remaining-30)/30.

If remaining > 0: threat. Response: dash_forward if ki ≥ 10 (crossing behind shooter exits ray) — verify distance: need to pass shooter. We move 20/tick toward, front moves 30/tick toward. Meet at t=(d-40)/50 (d = dist between us). Invuln 9 ticks (t 0..8). Need (d-40)/50 ≤ 8 → d ≤ 440. If d > 440, dash_forward fails mid-ray. Then options: guard (120 chip + long stun) or... own beam clash? If ki≥50 and my ki high, beam → clash, maybe win with more ki. Risky. Let's: if d ≤ 430 → dash_forward. elif ki ≥ 50 → beam (gamble clash; power ~ 1+0.02ki each, whoever pushes). Actually opponent already firing: our beam startup 30 ticks — their beam ends in ≤40 ticks; our beam starts after 30, they may be done (their ray gone) → we fire freely, they're in recovery. Their beam total 90 ticks. If we beam immediately, our beam fires at our t=30 = their t+30; if their beam still firing (they fired recently), clash. Clash outcome uncertain. Alternatively heavy rush? If d>430 can't reach.
Simplest: d≤430 dash_forward; else guard and eat it. Also if op in beam startup (phase startup) — separate case, dash_forward too (interrupt + behind).

Wait, careful about dash_forward when opponent beam and d small: d ≥ 60 always. Fine.

But there's a subtlety: after crossing, we land behind, in dash recovery 8 ticks, op still firing (frozen). Next ask: heavy their back. Add: if op.state==='beam' && d ≤ 140 → heavy (counter bonus if startup/recovery). Covered by generic punish.

Blast incoming handling:
```js
const inc = s.blasts.find(b => b.incoming && b.eta !== null);
if (inc) {
  if (inc.eta <= 7) {
    // close-range crossing option
    if (me.ki >= 10 && d >= 100 && d <= 380) return 'dash_forward'; // dodge blast, land on them
    return 'guard';
  }
}
```
Hmm dash_forward through blast: blast meets us at t=(d-40)/33 (approx since blast between us moving 13, us 20). Need ≤9 → d ≤ 337. And after passing blast we continue toward them, land at their face/behind. Their state? They threw blast, in recovery. Punish next ask. But careful: d too small (60-100): dash goes through to behind them — fine.
Set threshold d ≤ 330. Also don't do this if opponent beam... beam handled earlier.

Edge: eta ≤ 7 guard — but if opponent close and will heavy-crush our guard... acceptable.

Also, if inc.eta > 7 and we're charging: stop charging? We get asked every 6 ticks; eta>7 means we can charge 6 more ticks then guard. Return 'charge' continues... Actually keep charging if eta ≥ 8, will guard next ask. Good — but eta computed at ask time; next ask in 6 ticks, eta then ≥2, guard at eta≥2 fine (blast hits during guard). OK.

op heavy startup:
```js
if (op.state === 'heavy' && op.phase === 'startup') {
  if (d <= 150) {
    if (me.ki >= 10) return 'dash_back';
    return 'guard'; // crush 60 better than 120+down
  }
  // else let it whiff; punish in recovery
  if (d > 150) return 'back'; // keep out of reach
}
```
op heavy recovery & d ≤ 350 && ki≥10 → dash_forward punish. Else if d ≤ 130 walk forward? Their recovery left: op.left. heavy total 35; recovery 22. If we dash_forward at their recovery start we arrive in 10 ticks, they have 12 left, then our recovery 8 — they free at our arrival+2, might guard. Our heavy after dash: startup 9 — arrives just as they're free. They may guard → crush (good) or counter. Alternatively use light after dash: startup 5, hits while they still have ~2-12 recovery... timing tight. Eh, dash then decide on arrival — generic logic will handle (op in recovery → light if close). Let me make generic punish handle.

op blast startup:
```js
if (op.state === 'blast' && op.phase === 'startup') {
  if (me.ki >= 10 && d <= 330 && d >= 100) return 'dash_forward';
  if (d <= 110) return 'light'; // interrupt
  return 'guard';
}
```
op blast recovery: if d ≤ 330 && ki≥10 → dash_forward (blast already spawned and moving away or toward us? their blast spawned at their t=11 heading at us. If we dash forward now, blast is en route; we cross it during invuln hopefully — same math roughly. eta at decision = (d-40)/13 ish. Dash meets blast at (d-40)/33 < 9 needs d ≤ 337.) OK same. Or walk in if very close: if d ≤ 130 → light (counter 1.25: 50 + they in recovery, combo!). 

Generic punish block (op committed/recovering, no immediate threat to us):

```js
const punishable = (op.state in moves && op.phase === 'recovery') || op.state==='crushed' || (op.state==='hitstun'&&op.left>=8) || (op.state==='blockstun'&&op.left>=10) || (op.state==='dash'&&op.phase==='recovery');
if (punishable && op.state !== 'down') {
  if (d <= 130) {
    if (op.state==='crushed'||op.state==='blockstun') return 'heavy'; // crush guard again? blockstun means they were guarding - heavy crushes
    if (op.state==='hitstun') return d<=135?'heavy':'light';
    return 'light'; // counter hit on recovery
  }
  if (d <= 330 && me.ki >= 10) return 'dash_forward';
}
```
Wait blockstun: they guard-blocked our attack, still holding guard presumably → heavy crushes. crushed: heavy. hitstun: heavy if in reach. recovery of their move: light for counter (they can't guard while in recovery).

Careful with dash_forward landing behind them — then next ask they're free, we're behind, they turn (if free) — dash recovery means we can't act till dash done; they're free before us? Dash recovery 8; op recovery maybe longer. If we dash at their recovery left 15, we land at our t=10 with 8 recovery → free at 18; they free at 15, turn, guard. Then we heavy → crush. OK.

op charging:
```js
if (op.state === 'charge') {
  if (d <= 140) return 'heavy';   // 1.5x = 180
  if (d <= 110) ... 
  if (me.ki >= 20 && !me.blastOut && d <= 900) {
    // blast: 70*1.5 = 105 if they keep charging; they may guard (12 chip)
    return 'blast';
  }
}
```
Also while they charge and we're far without ki: forward.

op guarding at close: heavy crush. But anti-bait: only if we've seen them guard... just do it with the guard-streak consideration: op.state==='guard' && d ≤ 140 → heavy. Random skip? Their guard might be a reaction to our approach; heavy crush is +EV generally. But if they release guard right as our heavy starts and they light us → counter 120×1.25=150 against us. Risk. Mitigate: only heavy their guard if op has been in guard ≥ 6 ticks (op.t ≥ 6)? They're asked every 6 ticks too; a guard held one ask is likely deliberate. Use op.t ≥ 5.

op down: can't hit. Charge if far from threats? Their blast may still fly. If inc blast → handled. Else charge (safe) or if ki full, forward to wait. When they stand up (we get no cue), we're asked regularly anyway. Charge while op down: op.left ticks. If op.left > 12 → charge.

Neutral:
```js
if (ki < 100 && d >= 480 && no threat) charge
else forward
```
Blast pressure occasionally: if d in [200,700], ki ≥ 55, !blastOut, op free, Math.random()<0.25 → blast. Also beam finisher: if op.hp ≤ 260 && ki ≥ 50 && d ≤ 600 && (op free or recovering) → beam? They'd guard → 120 chip (kills if hp<120). If they guard chip 120; if hp ≤ 120 guaranteed kill via chip even blocked. Use beam if op.hp ≤ 115 (chip kill) or op stunned. Also beam when op in long recovery? beam startup 30 > most recoveries. Skip fancy.

Close neutral (d ≤ 120, both free): mix light/guard/back. Light: if hits → combo. If they're about to heavy, we eat it. Probability game. I'll do: light if random < 0.6, else guard. Also weight: if we have more HP and time low, turtle.

Ranged: keep distance, charge to 100, then blast/beam pressure, punish approaches.

Anti-dash: if op.state==='dash' && phase==='moving': they're invuln; where do they land? Can't know target precisely but dash dist 200 toward us. After they land, if behind us we're facing wrong — but we get asked when free and turn happens automatically (face() each tick for FREE states). We'll face them automatically. Their recovery 8 → our punish. Nothing special; maybe pre-emptively guard? Guard only blocks front; if they cross behind, guard useless and heavy from back hurts. dash_back when op dash moving toward us? Costs 10. Their dash 200 over 10 ticks; we back 200 too → distance kept, they whiff-ish, land in front. Could help vs dash-heavy bots. Add: if op.state==='dash' && op.phase==='moving' && d ≤ 260 && ki ≥ 10 && Math.random() < 0.8 → dash_back? Hmm but their dash might be dash_back themselves. Can't tell direction... dash has no dir in view. If dist shrinking rapidly they're coming. We don't have velocity history easily — track last op.x vs now: keep global prevOpX. If op dashing and op.x moved toward us since last ask → incoming. Let's track.

Actually simpler: if op dashing (moving) — we can't be hit by strikes anyway (invuln? no wait, THEY are invuln; we're not). Danger is their dash_forward landing behind us then punishing our recovery... they land and need recovery 8 before acting. We can react: when their phase recovery → our generic punish (heavy). Meanwhile during their moving, we could dash_back to keep them in front: dash_back during their dash: we move back 200, they move 200 forward; net distance same. If their dash was forward, fine we stay in front. OK include when detected incoming: use position delta.

Let me track history: globals prev = {t, opx}. Each call compute opdx = (op.x - prev.opx) * signTowardMe... sign: toward me = (me.x - op.x) direction... dx toward me if (me.x-op.x)*(op.x-prev.opx) > 0.

Code assembly (mind budget: keep cheap).

Also wall consideration: back with wallBehind small → can't retreat; maybe dash_back still works? dash_back 200 clamped, still moves some. If cornered and op close, jump... options: dash_forward through them (cross to other side)! Corner escape: if wallBehind < 100 && d ≤ 250 && ki ≥ 10 → dash_forward (cross behind them). Nice anti-corner.

KO defense: if me.hp low and op aggressive... skip.

Timer: if timeLeft < 300: if me.hp > op.hp → avoid engagement (back/guard at range, charge not needed... charge risks; just guard/keep away). If losing → force action: blast spam, beam.

Let me write final code.

```js
var crushedCount = 0;
var lastCrushT = -999;
var prevOpX = null;
var prevT = -1;

function decide(s) {
  var R = RULES, me = s.me, op = s.opp, d = s.dist;

  if (me.state === 'crushed' && s.t - lastCrushT > 30) { crushedCount++; lastCrushT = s.t; }

  // clash
  if (s.clash) {
    var c = s.clash;
    if (me.ki > 4 && (c.myPower + 0.6 > c.oppPower || c.pos < 0.4)) return 'push';
    return 'idle';
  }

  // combo cancel
  if (me.canCancel) {
    if (d <= 135) return 'heavy';
    if (me.chain < 4 && d <= 108) return 'light';
    if (me.ki >= 20 && !me.blastOut) return 'blast';
    return 'idle';
  }

  // track opponent velocity
  var opApproaching = false;
  if (prevT >= 0 && s.t > prevT) {
    var dt = s.t - prevT;
    var moved = (op.x - prevOpX) * (me.x > op.x ? 1 : -1);
    opApproaching = moved > dt * 2;
  }
  prevOpX = op.x; prevT = s.t;

  var ki = me.ki, hp = me.hp, ohp = op.hp;

  // --- enemy beam ---
  var eb = null;
  for (var i = 0; i < s.beams.length; i++) if (!s.beams[i].mine) eb = s.beams[i];
  if (op.state === 'beam' && op.phase === 'startup') {
    if (d <= 140) return 'heavy';
    if (ki >= 10) return 'dash_forward';
    return 'guard';
  }
  if (eb) {
    var rem = (me.x - eb.front) * eb.dir; // >0: front hasn't reached me? 
```
Hmm: eb.dir is beam travel direction. front reaches me when front passes me. rem = (me.x - eb.front)*eb.dir: if beam travels +1 and front < me.x, rem > 0 → still approaching. Good.
```js
    if (rem > -60) { // about to hit or hitting
      if (ki >= 10 && d <= 430) return 'dash_forward';
      return 'guard';
    }
  }
```
rem > -60: when front is past me by <60 we may still... actually once hit, beam.hit=true, we're knocked. If front passed beyond, rem negative large, no action. Use rem > 0 threshold plus small. Actually if front already passed me and I wasn't hit... can't happen (would have hit). So any eb with rem > 0 is a threat: if rem < 30*10=300 react now, else continue but stay alert. Since asked every 6 ticks, react when rem ≤ 200: 
```js
    if (rem > 0 && rem <= 200) { if (ki >= 10 && d <= 430) return 'dash_forward'; return 'guard'; }
```

  // --- incoming blast ---
```js
  var inc = null;
  for (var j = 0; j < s.blasts.length; j++) { var b = s.blasts[j]; if (b.incoming && b.eta != null && (!inc || b.eta < inc.eta)) inc = b; }
  if (inc) {
    if (inc.eta <= 7) {
      if (ki >= 10 && d <= 330 && op.state !== 'beam') return 'dash_forward';
      return 'guard';
    }
  }
```
Hmm wait: dash_forward through blast toward op — but op might be free and punish our dash recovery. If op free and close after we land... we land behind them (dash goes through if room) — they turn only if free; we have recovery 8, they can hit us. Risky but we dodged 70 and might eat light 40. Slightly -EV vs smart close opponent; condition: only cross if op not free (committed) or d ≥ 200. Let's: 
```js
if (ki >= 10 && d <= 330 && d >= 180 && !op.free) return 'dash_forward';
if (ki >= 10 && d <= 330 && d >= 150 && op.free && Math.random() < 0.5) ...
```
keep simple: cross if op committed (!op.free) OR d >= 200. If op free and close, guard.

  // --- op heavy startup ---
```js
  if (op.state === 'heavy' && op.phase === 'startup') {
    if (d <= 150) { if (ki >= 10) return 'dash_back'; return 'guard'; }
    return 'back';
  }
```
Note crushedCount adaptive: if crushedCount >= 2 and no ki, prefer... nothing better. keep.

  // --- op blast startup ---
```js
  if (op.state === 'blast' && op.phase === 'startup') {
    if (d <= 108) return 'light';
    if (ki >= 10 && d <= 330) return 'dash_forward';
    return 'guard';
  }
```
Guard vs blast startup: after 11 ticks blast comes, we guard, fine.

  // --- opponent dash incoming ---
```js
  if (op.state === 'dash' && op.phase === 'moving' && opApproaching && d <= 260 && ki >= 10) return 'dash_back';
```

  // --- punish windows ---
```js
  var pun = false, heavyPun = false;
  if (op.state === 'crushed') { pun = true; heavyPun = true; }
  else if (op.state === 'blockstun' && op.left >= 10) { pun = true; heavyPun = true; }
  else if (op.state === 'hitstun' && op.left >= 8) { pun = true; heavyPun = true; }
  else if (op.state === 'dash' && op.phase === 'recovery') pun = true;
  else if ((op.state === 'light' || op.state === 'heavy' || op.state === 'blast' || op.state === 'beam') && op.phase === 'recovery') pun = true;
  if (pun && op.state !== 'down') {
    if (heavyPun && d <= 135) return 'heavy';
    if (d <= 108) return 'light';
    if (d <= 330 && ki >= 10 && (op.left == 0 || op.left >= 12)) return 'dash_forward';
  }
```
beam recovery pun: dash toward — their recovery 20, dash 18 total... tight but the heavy after may catch. fine.

Note: op.state 'beam' recovery — handled earlier eb? eb removed when firing over. ok.

  // --- op charging ---
```js
  if (op.state === 'charge') {
    if (d <= 140) return 'heavy';
    if (ki >= 20 && !me.blastOut) return 'blast';
  }
```

  // --- op guarding ---
```js
  if (op.state === 'guard' && d <= 135 && op.t >= 5) return 'heavy';
```

  // --- corner escape ---
```js
  if (s.wallBehind < 90 && d <= 250 && ki >= 10 && op.free && d >= 120) return 'dash_forward';
```
Hmm this could cross when not wanted. Only when cornered and op close-ish. d≥120 ensures we pass through.

  // --- close neutral combat ---
```js
  if (d <= 115) {
    // finish with beam chip? if ohp <= 110 and ki >= 50: beam kills through guard
    if (ohp <= 112 && ki >= 50) return 'beam';
    var r = Math.random();
    if (crushedCount >= 2 && r < 0.4) return 'back';
    if (r < 0.55) return 'light';
    if (r < 0.8) return 'guard';
    return 'back';
  }
```
Hmm light at close: fine.

  // --- ranged: pressure ---
```js
  if (ohp <= 112 && ki >= 50 && d <= 800 && op.state !== 'down') return 'beam';
  if (ki >= 55 && !me.blastOut && d >= 220 && d <= 750 && Math.random() < 0.35 && op.state !== 'down') return 'blast';
  if (d > 500 && ki < 100 && op.state !== 'charge') return 'charge';
  // wait: op charging far handled above (blast). If no ki for blast and op charges: approach.
  return 'forward';
```
Also if op charging and we lack ki: forward (approach to punish).

Beam at range when ohp<=112: they can dash dodge/guard. Guard → 120 chip ≥ their hp → KO. Dash invuln 9 ticks but beam lasts 40, they get caught after invuln if still in ray — likely. Good finisher. But if they beam us first... they're low hp, unlikely. Also require d ≥ 120 to avoid point-blank issues? beam fine point blank too. But condition placement: put before close-neutral? If d ≤ 115 and ohp ≤ 112 → beam. Combined above.

Also when losing on time (timeLeft < 400 and hp < op.hp): aggressive: if ki>=20 blast spam, else forward. Add:
```js
  if (s.timeLeft < 400 && hp < ohp) {
    if (ki >= 20 && !me.blastOut && d >= 150) return 'blast';
    return 'forward';
  }
  if (s.timeLeft < 400 && hp > ohp && d < 400) return 'back';
```

Also guard while op in light startup close:
```js
  if (op.state === 'light' && op.phase !== 'recovery' && d <= 115) return 'guard';
```
Place before close-neutral. Actually if their light active already and we haven't been hit... block it. Guard. But maybe they whiff (d>110) — guard harmless.

Order matters; let me finalize ordering:

1. crushed tracking
2. clash
3. canCancel
4. velocity tracking
5. op beam startup → heavy/dash/guard
6. enemy beam active near → dash/guard
7. incoming blast close → dash-cross/guard
8. op heavy startup → dash_back/guard/back
9. op blast startup → light/dash/guard
10. op dash incoming → dash_back
11. punish windows
12. op charging → heavy/blast
13. op guarding close → heavy
14. op light startup/active close → guard
15. corner escape
16. time-low adjustments
17. close neutral mix
18. ranged: beam finisher, blast pressure, charge, forward

Wait step 5: if op beam startup and d ≤ 140, heavy: heavy startup 9 + active 4. If op.t could be up to... we might see at op.t=29 (asked every 6): heavy active at our+9 = op.t=38 > 30 — beam fires at 30, we get interrupted?? Being hit during our heavy by beam (280, down). Our heavy active 9-12 vs their fire start at op.t 30-ish: if op.t ≤ 20 when we decide, heavy active at op.t ≤32... beam spawns at op.t=30, front moves 30/tick, front must reach us: d≥60, front at 40 → reaches us at op.t ≈ 30+ (d-70)/30 ≈ 31+. Our active window op.t 29-32 — we might hit them at op.t=29-30 before beam does damage (simultaneous same tick = both hurt: we interrupt AND take 280). Risky. Condition heavy only if op.t ≤ 18: heavy active hits at op.t ≤ 18+9+... decision tick op.t=T0, our active starts 9 ticks later... wait our heavy startup 9, active 9-12 ticks after decision. Hit lands ~op.t = T0+10ish. Beam fires at op.t=30. Need T0+12 < 30 → T0 ≤ 17. And hits interrupt beam? "发射期间被打中，大招就断了" — startup hits: beam被打断 presumably too (被打打断, ki不退). Hit during startup cancels it. So heavy if op.t ≤ 17. Else dash_forward (ki) or guard.

Also light if d ≤ 108: startup 5, active 5-8 → interrupts if T0+8<30, always true basically. Light safer! light counter 50 + hitstun 15 → canCancel chain. Prefer light if d ≤ 108, else heavy if d ≤ 135 && op.t ≤ 17, else dash.

Blast-cross dodge check: when op blast startup, dash_forward: blast spawns at op.t=11 at their front... we dash at T0 ≤ 10, during 10 ticks we cross where blast will spawn? Blast spawns and moves toward us; we're moving toward them. Meet point: blast from their x+40 (toward us, i.e., at distance d-40 from us... wait their front toward us: blast at op.x - 40*facing... = distance d-40 from us). We move 20/tick, blast 13/tick, but blast exists only from op.t=11. If T0 ≤ 10: at op.t=11 we've moved 11-T0 ticks... let's say T0=5: we moved 6 ticks =120, at d-120; blast at d-40 (from us). Gap = (d-40)-(d-120)=80, closing 33/tick → meet at +2.4 ticks = op.t 13.4, our dash t = 8.4 < 9 invuln ✓ (barely). T0=10: we moved 0... blast spawns, gap = ... we at d, blast at d-40, gap 40, meet at 1.2 → fine. T0=0: at op.t=11 we've moved 10 ticks=200 → if d ≤ 260 we already passed them! fine. OK works.

One more: when we return 'guard' as fallback everywhere, prolonged guard → crush victims. Our guard returns are reactive (brief). OK.

Charge safety: charging while op far; if op blasts, we see inc eta big, next ask guard. If op dashes at us from 500: 200 range only, can't reach. If op walks forward, we charge until d < 500 then forward? Actually while charging we're stationary; op walks 4.5/tick; we're asked every 6, fine we switch to forward/neutral. But op could blast from 600: travel 46 ticks, we guard in time. op beam from 700: startup 30, front reaches us at 30+(700-70)/30 ≈ 51 ticks, we react at first ask seeing beam startup → our step 5: dash_forward if ki≥10. 

What if ki < 10 at beam: guard, eat 120 chip + stun until beam end (~stun = remaining fire + 6). Not deadly usually.

Potential infinite guard at step 14 vs op light spam: op light reach 110; if d ≤ 115 and they keep punching, we keep guarding, they keep pushing us back 14 per block... we gain 2 ki per block. Eventually cornered, they crush with heavy? They might. Add: after guard streak, counter. Track myGuardTicks: if me.state==='guard' increment; if > 24 → return light (counter-poke). Let me add guardStreak counter, reset when not guard.

Implementation detail: state.me.t counts ticks in state; use me.state==='guard' ? me.t. If me.t ≥ 24 && d ≤ 110 → return 'light' (surprise). ok.

Also I should ensure not to dash_forward when a wall... dash clamps fine.

Also avoid blast when d < 220 (recovery punish) — done.

Also don't charge if inc blast incoming with eta ≤ 13 (guard soon). Charging until eta ≤7 then guard: the check `inc.eta <= 7` returns guard; else falls to later logic which might return 'charge' again — fine, next ask eta ≤ 13 → guard. Wait order: inc check is early (step 7); if eta > 7 we pass through to later. Later charge requires d>500; blast from 700: eta ~50; charging fine. Good.

Also while op down: pun excludes down. op down → if ki<100 && no inc: charge? If op down and we're close, they wakeup and might attack. Back off a bit or keep slight pressure. If d ≤ 200 when they wake... Let's: if op.state === 'down': if d < 150 → back; else charge if ki < 90 else idle/forward? I'll do: back if d<140, else charge if ki<95, else forward.

Hmm but 'down' op.left tells wakeup time. If op.left large (>15), charge regardless of distance (they can't reach us quickly... they knockback maybe far). Simple: charge while op down and no incoming blast, unless d < 130 → back.

Edge: op.state 'ko'/'recover': recover (post-clash winner) is 20 ticks free-punish: pun list add 'recover'. Add to punish: if op.state==='recover' pun=true, heavyPun if d≤135.

Final check on canCancel heavy at d≤135: opponent in hitstun 15 from last light... they can't guard. But what if d>135 after pushes? handled: light if ≤108 chain<4. If 108<d≤135... heavy reach 140 ✓. If d>135: blast or idle — blast while they're in hitstun near? blast spawns at our front, they're stunned at d~145: blast travels, hits during hitstun? hitstun 15 from cancel-tick... blast startup 11, they free by then, may guard. Eh, returns chip 12. Or 'idle' ends combo. Fine either.

Also combo scaling: lights 40+32+26 then heavy 120*0.55=66 → total 164 + knockdown. 

Budget: trivial computations, fine.

Let me also double check clash pos semantics: view: pos = clamp(((k.c - me.x) * (i? -d0 : d0)) / dist, 0,1) → 0 at me, 1 at opp. Danger when pos near 0 (point at my body). So push when pos < 0.4. Also if pos > 0.6 we're winning — pushing hastens but burns ki; push if clearly stronger: myPower+0.6 > oppPower+0.6... if myPower > oppPower pushing ends it faster. I'll push if ki>4 && (pos<0.45 || myPower+0.5 >= oppPower). Also stop push if ki <= 4 (save for... ki drains anyway 0.2/tick; at clash we can't do anything else with ki anyway. Push always if ki>2? If weaker, pushing drains ki faster making us weaker. Power with push: 1+0.02ki+0.6. As ki drains, power drops. If I'm weaker even pushing, pushing accelerates my loss. So: push only if myPower+0.55 > oppPower || pos < 0.35 (desperate). Also rage: hp<300 adds 0.4 both sides. view gives current powers (without push). ok.

Write it out.

One more: 'push' during clash only; and clash end handled by engine.

Also ensure returned values are valid actions always.

Random usage: fine, deterministic per match.

Final code:

```js
var crushedCount = 0, lastCrushT = -999, prevOpX = null, prevT = -1;

function decide(s) {
  var me = s.me, op = s.opp, d = s.dist, ki = me.ki;

  if (me.state === 'crushed' && s.t - lastCrushT > 30) { crushedCount++; lastCrushT = s.t; }

  if (s.clash) {
    var c = s.clash;
    if (ki > 3 && (c.pos < 0.42 || c.myPower + 0.55 > c.oppPower)) return 'push';
    return 'idle';
  }

  if (me.canCancel) {
    if (d <= 138) return 'heavy';
    if (me.chain < 4 && d <= 108) return 'light';
    if (ki >= 20 && !me.blastOut) return 'blast';
    return 'idle';
  }

  var opApproach = false;
  if (prevT >= 0 && s.t > prevT) {
    var mv = (op.x - prevOpX) * (me.x >= op.x ? 1 : -1);
    opApproach = mv > (s.t - prevT) * 2;
  }
  prevOpX = op.x; prevT = s.t;

  // enemy beam startup
  if (op.state === 'beam' && op.phase === 'startup') {
    if (d <= 108) return 'light';
    if (d <= 135 && op.t <= 16) return 'heavy';
    if (ki >= 10) return 'dash_forward';
    return 'guard';
  }

  // enemy beam firing
  var eb = null;
  for (var i = 0; i < s.beams.length; i++) if (!s.beams[i].mine) eb = s.beams[i];
  if (eb) {
    var rem = (me.x - eb.front) * eb.dir;
    if (rem > 0 && rem <= 200) {
      if (ki >= 10 && d <= 430) return 'dash_forward';
      return 'guard';
    }
  }

  // incoming blast
  var inc = null;
  for (var j = 0; j < s.blasts.length; j++) {
    var b = s.blasts[j];
    if (b.incoming && b.eta != null && (!inc || b.eta < inc.eta)) inc = b;
  }
  if (inc && inc.eta <= 7) {
    if (ki >= 10 && d >= 180 && d <= 330 && !op.free) return 'dash_forward';
    if (ki >= 10 && d >= 200 && d <= 330) return 'dash_forward';
    return 'guard';
  }

  // opponent heavy startup
  if (op.state === 'heavy' && op.phase === 'startup') {
    if (d <= 150) { if (ki >= 10) return 'dash_back'; return 'guard'; }
    return 'back';
  }

  // opponent blast startup
  if (op.state === 'blast' && op.phase === 'startup') {
    if (d <= 108) return 'light';
    if (ki >= 10 && d <= 320) return 'dash_forward';
    return 'guard';
  }

  // opponent dashing in
  if (op.state === 'dash' && op.phase === 'moving' && opApproach && d <= 250 && ki >= 10) return 'dash_back';

  // punish
  var pun = false, hvy = false;
  if (op.state === 'crushed') { pun = true; hvy = true; }
  else if (op.state === 'recover') { pun = true; hvy = true; }
  else if (op.state === 'blockstun' && op.left >= 10) { pun = true; hvy = true; }
  else if (op.state === 'hitstun' && op.left >= 8) { pun = true; hvy = true; }
  else if (op.state === 'dash' && op.phase === 'recovery') pun = true;
  else if ((op.state === 'light' || op.state === 'heavy' || op.state === 'blast' || op.state === 'beam') && op.phase === 'recovery') pun = true;
  if (pun) {
    if (hvy && d <= 138) return 'heavy';
    if (d <= 108) return 'light';
    if (d <= 330 && ki >= 10 && (op.left === 0 || op.left >= 12)) return 'dash_forward';
  }

  // opponent charging
  if (op.state === 'charge') {
    if (d <= 138) return 'heavy';
    if (ki >= 20 && !me.blastOut) return 'blast';
  }

  // opponent turtling
  if (op.state === 'guard' && d <= 135 && op.t >= 5) return 'heavy';

  // opponent poking
  if (op.state === 'light' && op.phase !== 'recovery' && d <= 112) {
    if (me.state === 'guard' && me.t >= 24 && d <= 108) return 'light';
    return 'guard';
  }

  // cornered
  if (s.wallBehind < 90 && d >= 120 && d <= 260 && ki >= 10 && op.free) return 'dash_forward';

  // clock management
  if (s.timeLeft < 420) {
    if (me.hp < op.hp) {
      if (ki >= 50 && op.hp <= 260 && d >= 150) return 'beam';
      if (ki >= 20 && !me.blastOut && d >= 150) return 'blast';
      return 'forward';
    }
    if (me.hp > op.hp && d < 420) return 'back';
  }

  // chip-kill finisher
  if (op.hp <= 112 && ki >= 50 && d <= 800 && op.state !== 'down') return 'beam';

  // close neutral
  if (d <= 115) {
    if (op.state === 'down') { if (d < 140) return 'back'; }
    var r = Math.random();
    if (crushedCount >= 2 && r < 0.4) return 'back';
    if (r < 0.55) return 'light';
    if (r < 0.8) return 'guard';
    return 'back';
  }

  // opponent down / far: economy
  if (op.state === 'down') {
    if (d < 140) return 'back';
    if (ki < 95) return 'charge';
    return 'forward';
  }

  if (ki >= 55 && !me.blastOut && d >= 220 && d <= 750 && Math.random() < 0.35) return 'blast';
  if (ki >= 50 && op.hp <= 320 && d <= 700 && Math.random() < 0.3) return 'beam';
  if (d > 500 && ki < 99) return 'charge';
  return 'forward';
}
```

Wait "chip-kill finisher" beam when op.hp<=112: if they guard → chip 120 → KO. But if they dash_back dodge and it misses entirely... beam covers everything eventually (40 ticks × 30 = 1200), they can't outrun, only dash invuln 9 then still in ray. Only escape is dashing behind us (crossing) — dash_forward through us. Possible but rare. Good bet. However firing beam at d ≤ 800 with op free means op has 30 ticks to punish us — they'd need to cross ~d within 30 ticks: walk 135, dash 200+punish. If d ≥ 350 they can't reach in time mostly. Add d ≥ 300 condition? If close, op could heavy us during startup. Change: (d >= 300 || !op.free).

Also blast pressure when ki >= 55 while op free: if op walks forward, blast hits or they guard. fine.

Also: 'forward' walking into opponent light range... when we arrive d ~115 we mix. Opponent may camp guard → we heavy crush. OK.

Also missing: if we're charging and opponent approaches fast (opApproach && d < 250): stop charging → guard? At d 250 they need ~30 ticks to reach; we can keep charging... but if they dash: reach in 1 dash. React at dash (handled). Walk-in: we'll switch at d ≤ 500? Our charge condition is d > 500. Between 115-500 we return forward/neutral. Fine.

Double-check heavy vs opponent guard-crush bait at close-neutral: we return guard 25% — opponent crush bots will punish our guard streaks. Our guard streak capped at 24 ticks with counter-light only vs light. vs heavy crush... when op.state==='heavy' startup we dash_back. Their heavy comes from neutral — we see startup (9 ticks) with ask every 6 → we see it at t≤5, dash_back. d≤150 → dash_back 200 keeps us safe. Good.

canCancel 'heavy' — check chain: heavy allowed regardless of chain. Good.

One risk: punish 'light' at d≤108 when op.phase==='recovery' of heavy — their recovery long, we get hitstun→cancel→combo. Good.

op.blockstun heavyPun: they're in blockstun meaning they guarded; after blockstun ends they may still guard → crush; or they were just blocking a blast. heavy good.

op.hitstun left>=8: our heavy startup 9 + active... hit lands at 9-12 ticks, their stun remaining 8 → might end right before → they can guard → crush 60 anyway. OK.

Clash 'idle' vs non-push: fine.

Verify no exceptions: op.left may be undefined for... view always provides left. op.state checks fine.

Also: 'recover' state — hvy punish; d≤138 heavy. Their recover = 20 ticks.

I think it's decent. Declaration: something fun ≤20 chars.