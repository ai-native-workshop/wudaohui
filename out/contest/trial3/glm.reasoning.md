Need to write a fighting bot. Let me think strategy.

Key options: spacing, light pressure, beam usage, clash pushing. Simple solid strategy:

- If clash: push when beneficial (power calc), push if myPower+push > oppPower, or manage ki.
- If beam incoming: guard (if ki >= 15... beam guard costs 15 ki, chip 160) or dash if ki>=16 (dash invuln 8 ticks, beam hit... dash through? Beam is a ray; dashing forward past the shooter? dash_forward invuln 8 ticks moving 200 — could dodge beam). Actually if opp beam firing and I have ≥50 ki, counter-beam leads to clash. Clash damage 320 to loser — risky. Alternative: dash_back to escape beam range? Beam front moves 30/tick, extends 40 ticks = 1200 range, covers whole stage. So can't outrun. Guard: costs 15 ki, 160 chip, blockstun until beam ends (40 ticks). Dash: invuln 8 ticks but if still in ray at end, hit. Could dash_forward through opponent — beam from = shooter's x+25 facing me, ray covers from shooter forward. Dashing behind opponent puts me outside ray. dash_forward 200 distance, passes through, lands behind. That dodges beam! Cost 16. Good.

- Heavy: 120 dmg, crushes guard, knocks down 42 ticks. Strong. Reach 140.
- Light chains: 40 dmg each with combo scaling.

Simple aggressive plan: approach, at dist ≤110 throw light, cancel into heavy (120 * combo scaling 0.8 ≈ 96) or more lights. Max chain 4 lights + heavy. Damage: 40 + 32(0.8) + 26(0.65) + 22(0.55) + heavy 0.45*120=54 → total ~174. Or light,light,heavy: 40+32+96=168. Or just heavy on its own: 120.

Blast: 60 dmg, 14 ki, good poke at range.

Danger: opp heavy startup 9 — if I attack during their heavy startup I get countered ×1.25. Keep distance >140 when not attacking.

Let me write a bot:

```js
function decide(s) {
  const R = RULES;
  const me = s.me, op = s.opp;
  if (s.clash) {
    // push if it helps and ki economy allows
    const c = s.clash;
    // my power without push vs opp: if pushing gains advantage, push
    const myP = 1 + 0.02*me.ki + (me.hp < 300 ? 0.4:0);
    const opP = c.oppPower;
    if (me.ki > 20 && (myP + 0.6 > opP || c.pos > 0.55)) return 'push';
    if (c.pos < 0.4 && me.ki > 5) return 'push'; // defend
    return 'idle';
  }
  if (me.canCancel) {
    // cancel combo
    if (me.chain < 4 && op.hp > 60) return 'light';
    if (s.dist <= 140) return 'heavy';
    if (me.ki >= 14 && !me.blastOut) return 'blast';
    return 'light';
  }
  ...
}
```

Wait — canCancel returns happen on tick after hit; if chain<4 light; end with heavy for knockdown. Combo scaling: lights 40,32,26,22 then heavy 0.45*120=54. Alternatively heavy at chain 2: 40+32+0.65*120=150. Ending heavy gives knockdown which is safe. Let's do: light up to chain 3 then heavy; but each cancel decision happens every hit — fine.

Actually careful: heavy reach 140, after light push 14 apart. dist ≤110+push... light push 14 each hit; start at 100 → after 3 hits dist ~142 >140. So maybe heavy after 2 lights. Compute: at cancel time check s.dist <= 135 for heavy.

Blast incoming: eta small → guard if ki>=6? Guard blast costs 6 ki, chip 12. Or dash_forward to dodge if ki>=16? dash_back: blast follows... blast moving 13/tick, dash_back moves 200 back but blast still chasing; after invuln 8 ticks blast may have passed. Actually dashing back: blast continues forward past? Blast travels toward my old position; after I teleport 200 back, blast still incoming, will hit me later. Better: dash_forward through blast? Blast is a point; dashing forward 200 passes it, invuln 8 ticks covers 200/10*8=160 movement... blast speed 13, relative closing... likely dodge. But lands near/behind opponent (200 distance). If dist <200 we go behind them — fine, punish?

Simpler: guard blasts when eta <= 3 (need ki>=6). If ki<6, dash_back if ki>=16 else take hit.

Beam incoming: if ki>=16 and opponent beam: dash_forward to get behind (dodge). Check dash lands behind: wallAhead matters. If wallBehind < 60... dash forward from x toward opp, lands behind opp. If opp near wall, might stop in front — still maybe within ray → hit. Condition: wallAhead > 260 (need room) roughly. Otherwise guard if ki>=15 (chip 160). Or counter-beam if ki>=50? Clash risk. If my ki high and hp high, counter-beam could win clash... but clash outcome uncertain. Let's just dodge or guard.

If opp beam in startup (phase startup, t < 30): punish! They're vulnerable, damage ×1.25. If dist ≤140: heavy! Or dash in. Beam startup 30 ticks — heavy needs dist≤140 at active. If far, dash_forward then... they get asked? No, they're in beam, can't act. If I dash in and heavy, timing tight. Just: if dist<=140 → heavy (counter 150 dmg). If dist <~340 and ki>=16: dash_forward then next decision heavy. Actually during their startup 30 ticks, dash 10+8 recovery then heavy 9 startup = 27, might just make it. Risky if they're near... Let's do: if op.state==='beam' && phase startup: if dist<=130 heavy; else if ki>=16 && dist<=360 dash_forward; else guard.

If opp firing beam at me and I can't dodge: guard (ki>=15). If ki>=50, maybe counter-beam for clash and push with high ki. Clash: I get asked every 6 ticks; with ki 100 vs unknown. Eh, risky; skip unless opponent low hp and I have big ki lead. Keep simple: dodge/guard.

Neutral game: 
- If op in recovery of something close → punish with light/heavy.
- If op charging and dist <= ~200: dash in? Just approach and light.
- Maintain spacing: if op free and dist < 90, back off a bit (avoid their light). Approach to ~110 and light.

Basic loop when free:
- if op.state in hitstun/crushed/down? down: untouchable; use to charge or approach. If down, charge if ki low else forward.
- if op in hitstun: approach and attack (light if dist<=110).
- if op free:
  - if dist <= 105 and me.ki... attack light? But opponent might be starting heavy. Meh. If dist <= 105: light (my startup 5, their reaction...). Actually if their heavy already in startup, my light gets countered. Trade-off.
  - if dist in (105, 200]: opp can blast. Guard? Approach.
  - approach with forward; occasionally throw blast if ki>60 at dist 200-500.
  - random-ish mixing to avoid being predictable: opponents are simple AIs probably.

Ki management: charge when opp is down or far and ki<40. Beam usage: if ki>=70 and opp free at mid-range, fire beam? Beam raw: 280 dmg or blocked 160 chip. Opponent might guard (cost them 15 ki, they take 160). Or they dodge. It's strong. Fire beam when ki>=60 and dist>150 and opp not obviously dashing? Fine.

Anti-air vs heavy: if op heavy startup and dist<=140: back away (walk back 3/tick for 9 ticks = 27, not enough if dist 100). Guard gets crushed. Dash_back if ki>=16 (200 distance, safe). Or interrupt with light? My light startup 5, active at tick 5-7; their heavy active 9-12; my light reaches 110. If dist<=105, my light hits first → they get hitstun 15, heavy canceled. So: if op heavy startup && dist<=105 → light; else if ki>=16 dash_back; else back.

Track opponent patterns? Keep per-match memory of their actions to adapt slightly. Skip — keep simple but decent.

Also avoid corner: if wallBehind < 60, prefer forward/dash_forward.

Blast spam at range when ki>50: blast, then while blast flying approach. Their guard costs 6 ki per block, chip 12. Decent.

Let me also handle: my blast approaching them and they're in startup of blast/beam → keep going.

Also: if op.ki < 4 (can't pay light guard)? If they guard light with <4 ki → crushed 34 ticks! So if opp is guarding and ki<4 and dist<=110: light to crush. Also blast guard costs 6, beam 15. If opp guarding & ki<15: beam crushes their guard... but beam costs 50. If opp guard and ki<6 and dist<=500: blast.

Edge: when opp in blockstun from my blocked light, I get pushed? Blocked light: they get pushed 14 (or me if wall). Then I can chain another light? They're in blockstun 11, my light recovery 9 + startup 5 — my next light active at 14 > their blockstun 11, they can guard again. Each block costs them 4 ki, gives me 3. So spamming lights vs a guard drains them. If their ki hits <4, crush! Nice: if opp guarding or in blockstun and dist<=110: keep lighting (gains ki for me, drains them). But if they're smart they stop guarding and get hit or back off. Fine.

Time limit: hp compare; if timeLeft low and behind, be aggressive; ahead, play safe (back/charge).

Write code:

```js
var lastAct = null;

function decide(s) {
  const R = RULES, me = s.me, op = s.opp, d = s.dist;
  const ki = me.ki;

  // clash
  if (s.clash) {
    const c = s.clash;
    if (c.pos > 0.5 && ki > 3) return 'push';       // point near me: push
    if (ki > 30 && (c.myPower + 0.6 >= c.oppPower || c.pos > 0.6)) return 'push';
    if (ki > 10 && c.pos > 0.4) return 'push';
    return 'idle';
  }
```

Hmm clash power: pushing costs 0.8/tick extra, drains both 0.2. Push when ki advantage or point near me. Actually pushing when opponent also pushes is ki war. If myPower(with push) > oppPower, point drifts toward them; noise sd 0.8/tick vs drift 0.1*diff — noise dominates short-term but drift accumulates while noise decays. Push whenever ki > opp's? We don't know their ki... we do: op.ki in state. Push if me.ki > op.ki + 10, or pos > 0.55 (danger). Also rage: hp<300 gives +0.4.

canCancel:
```js
  if (me.canCancel) {
    if (d <= 135 && op.state !== 'down') return 'heavy';
    if (me.chain < 4 && d <= 105) return 'light';
    if (ki >= 14 && !me.blastOut && d > 100) return 'blast';
    return 'heavy';
  }
```
Heavy reach 140; combo scaling applies. Prefer heavy for knockdown when close; else chain lights. Order: if d<=135 → heavy (knockdown, safe). Actually more damage from lights first? light(40)+light(32)+heavy(0.65*120=78)=150 vs light+heavy=40+96=136. So chain lights while d<=105 and chain<3, then heavy. But push moves them away: each hit pushes 14. Start d=100 → after light 1: 114, cancel light2 reach 110 fails... hitstun 15, light startup 5+3 active: next light active at tick 5 after cancel — they've been pushed to 114 > 110, miss → whiff punish. So prefer: chain <2 → light, else heavy. Start d<=100 gives lights ok; safer: if d<=135 heavy else light if d<=105.

Let me do: if d <= 130 → 'heavy' (if down? no, they're in hitstun). else if chain<3 && d<=105 light else heavy... if d>140 blast.

Opp beam handling:
```js
  const oppBeam = s.beams.find(b => !b.mine);
  if (oppBeam) {
    // dodge through if possible
    if (ki >= 16 && s.wallAhead > 260 && op.state === 'beam') return 'dash_forward';
    if (ki >= 15) return 'guard';
    if (ki >= 16) return 'dash_forward';
    return 'idle';
  }
```
Wait dash_forward while their beam firing: I move toward them, pass through, land behind → outside ray. Need room behind them: their wall-behind... their back. If they're near their wall, dash stops in front of them → still in ray → hit 280. Condition: wallAhead (my forward distance to wall) > 260 approx ensures room. Also invuln 8 ticks during dash moving: beam front moves 30/tick toward me; I move 20/tick toward; the beam might still be approaching... during dash I'm invulnerable for 8 of 10 ticks; ticks 8-9 vulnerable but I'm likely past. Risky at long range (beam front far away, I land in front still within ray!). Hmm: if beam front hasn't reached me yet and I dash forward 200 toward them, the ray is from them outward; front is somewhere between; landing in front of them means inside ray (from=their x+25 to front). If I land behind them, safe. dashEnd: if after < minGap and room, land behind. dist matters: if d < 200+60ish we pass through. If d large (e.g., 400), dash 200 lands at d-200=200 in front — inside ray → hit. So dash_forward dodge only good if d <= ~250 (so we land behind). Check d <= 240 && wallBehind of opp... approximate: op near wall? If opp.x near their back-wall, no room behind → stop in front → hit. opp's behind direction is my ahead. So condition: d <= 240 && s.wallAhead > 100.

Alternative dodge: dash_back — moves me away 200, but ray extends to wall eventually; front moves 30/tick, faster than anything; ray reaches stage edge. If timeLeft in beam... beam lasts 40 ticks, front travels 1200 — covers everything. So dash_back only delays; if beam ends before reaching... front speed 30 vs my dash 20; after dash I'm 200 farther, front gains 10/tick; if front is far (say 600 away) and remaining fire ticks... too complicated. Use guard as default, dash_forward when it lands behind.

Guard beam: 15 ki, 160 chip, blockstun until beam end. Acceptable.

Opp blast incoming:
```js
  const inc = s.blasts.find(b => b.incoming);
  if (inc && inc.eta <= 4) {
    if (ki >= 16 && d <= 240 && s.wallAhead > 120) return 'dash_forward'; // dodge through
    if (ki >= 6) return 'guard';
    if (ki >= 16) return 'dash_back';
    return 'idle';
  }
```
dash_forward vs blast: blast speed 13, my dash 20 toward, passes it during invuln probably. eta<=4 means gap ≤ 52+30. During dash I move 20/tick, blast 13 toward me → closes 33/tick, passes within ~2 ticks, invuln 8. Then I'm near/behind opp — attack opportunity. Good. But if I land in front of opp within their attack range... they may be in blast recovery (18 ticks) → free punish! Nice.

Also if opp blast in startup (phase startup, t<11) and dist <= 110: hit them (counter). Or guard.

Opp heavy startup: 
```js
  if (op.state === 'heavy' && op.phase === 'startup') {
    if (d <= 105) return 'light';
    if (ki >= 16) return 'dash_back';
    return 'back';
  }
```
op.left gives remaining. light: my startup 5, active 5-7; their heavy active at 9-12. My light hits at ~tick 5-7 → interrupt. But wait, are we both starting simultaneously? They're already in startup t≥1. If their t≥4, their active at 9 could be before my light active... my light active from tick 5 (of my move). Their heavy active at tick 9 - t. If t <= 3, my light (5) lands first. If t in 4..8, close. I get asked only when free; I could've been walking. Use: if op.left... their remaining startup = 9 - op.t. If remaining >= 4 and d<=105 → light. Else dash_back/back.

Opp light startup: similar; if d<=105 → light trade? Both active: my light active 5-7, theirs at t+5..; if their remaining startup >=3, trade or I win. Meh, if they light and I'm in range, my light trades (both hit). Could guard: light block costs 4 ki. Or back. If d<=105: counter-light (trade 40 each, fine, I get cancel combo... but they're in hitstun too, both stunned; my cancel lets me continue!). Actually if both hit same tick, both hitstun 15, but I have canCancel → I can chain into heavy while they're stunned! Trade favors me. So: if op light startup and d<=105 → light. If d in 105-110, guard.

General punish: op in hitstun/blockstun/crushed:
- crushed: 34 ticks free. Approach & heavy (counter ×1.25 ×...). If d<=140: heavy. else dash_forward if ki>=16 and d<=380, else forward.
- hitstun: light if d<=105 (juggle), heavy if d<=135... careful combo scaling; hitstun from what? Whatever, attack.
- down: they're invulnerable; if d>?? approach to ~130 then wait/charge. If ki<50 charge else forward to 120.

Charging opp: ×1.5 damage! Punish: dash in + heavy. If d<=140 heavy (180 dmg!). If d<=340 and ki>=16 dash_forward then heavy. 

Opp recovery (blast recovery 18, beam recovery 20, dash recovery 8, heavy recovery 22): punish window. If d<=105 → light (counter). If d<=140 → heavy. If d <= 350 and ki>=16 → dash_forward. Blast recovery 18 ticks: dash 18 + heavy startup 9 = too slow; light after dash: 10+8? dash total 18 ticks then light 5 → whiff. Hmm dash recovery 8, so dash(10)+recover(8)+light startup(5)=23 >18. Only if their recovery long (beam 20, heavy 22: 23>22 marginal). Skip dash-punish mostly; just walk forward.

Neutral:
- If op free and d <= 100: light? They might be about to heavy... At this range attacking is reasonable but risk crush trade. Alternative: heavy mixup? Let's: if d<=100 and random < 0.5 → light else back slightly? Deterministic per-seed random ok. Simpler: if d<=100: light. If they block, I get pushed/they get pushed, I gain ki. If they crush with heavy... they'd need to have started heavy already — handled above.
- Actually careful: attacking into their guard repeatedly drains my... no, blocking costs THEM 4 ki and gives me 3. Spamming light at close range is good vs guard. Risk: they dash_back or heavy. Handle heavy startup above.

- Range 100-160: forward to close. But watch for their blast — handled by incoming check.
- Range > 160: if ki >= 60 and d >= 250: fire beam (big damage). If ki>=30 and d in 160-600: blast occasionally. Else forward (walk gains ki).
- Charge when opp down or d>600 and ki<40.

Wall awareness: if wallBehind < 80, avoid back/dash_back; prefer forward.

Also opp guarding with low ki: if op.state==='guard' && op.ki<4 && d<=110 → light (crush). If op.ki<6 && d<=... blast (costs them guard break → crushed 34 ticks!). Blast crush gives 34-tick stun, then free heavy! Big. If op guarding && op.ki < 6 && ki>=14 && !blastOut && d<600 → blast. Even ki<15 → beam crush? costs 50; if ki>=50 and op.ki<15 and op guarding: beam → crush 34, but beam recovery... they're stunned 34 while I recover 20, then heavy counter ~150. Total 280... wait crush means chip + stun: beam crush chip 160! hurt then stun 34. 160 + followup heavy 120×1.25≈150 = 310. Strong if ki rich. Add conditionally.

Time/HP: if timeLeft < 300 and me.hp > op.hp: play safe (keep distance, charge). If behind and timeLeft<300: aggressive.

Keep it manageable. Also remember history? Skip.

Beam firing decision: when ki>=65 and op free and d>150: beam. But good opponents dodge (dash behind) or counter-clash. If they counter with beam → clash, ki matters. If my ki 65+... risk. Alternatively use beam when op in recovery/hitstun (they can't dodge): e.g., after blast hits (hitstun 20, recovery mine 18, then beam startup 30 > 20 no). Hmm.

Simplify: fire beam when op is in a long stun (crushed: 34 ticks; beam startup 30 — lands during stun! 280 dmg + knockdown) — beam as crush followup! If op.state==='crushed' && op.left>25 && ki>=50 && d<600: beam. 280 dmg combo. 

Also blast followup: after blast hits, op hitstun 20, my recovery 18 → next ask at 18, light if d<=110... they recover at 20. Light startup 5 → active 23 >20, whiff-punishable. Just reposition.

OK, also handle my own "blastOut": don't blast again.

Guard use when opp likely to attack? Hard to predict. Guard when opp free and d<=110 and my ki... no, attacking better.

Let me now write final code carefully.

```js
function decide(s) {
  var R = RULES, me = s.me, op = s.opp, d = s.dist, ki = me.ki;

  // ---- clash ----
  if (s.clash) {
    var c = s.clash;
    var myP = 1 + 0.02 * ki + (me.hp < 300 ? 0.4 : 0);
    var pushP = myP + 0.6;
    if (c.pos > 0.55) return 'push';                    // point close to me
    if (pushP > c.oppPower + 0.15 && ki > 5) return 'push';
    if (ki > op.ki + 15 && ki > 20) return 'push';
    return 'idle';
  }

  // ---- combo cancel ----
  if (me.canCancel) {
    if (d <= 130) return 'heavy';
    if (me.chain < 4 && d <= 105) return 'light';
    if (ki >= 14 && !me.blastOut) return 'blast';
    return 'heavy';
  }

  var oppBeam = null, oppBlast = null;
  for (var i = 0; i < s.beams.length; i++) if (!s.beams[i].mine) oppBeam = s.beams[i];
  for (var i = 0; i < s.blasts.length; i++) if (s.blasts[i].incoming) { if (!oppBlast || s.blasts[i].eta < oppBlast.eta) oppBlast = s.blasts[i]; }

  var behindRoom = s.wallAhead > 130; // room for opp's back / my dash-through target
```

Hmm dash_forward landing behind opp requires room beyond opp: wallAhead > d + something. Let's require s.wallAhead > d + 70 for dash-through safety? If d<=240 and wallAhead >= d+80 → land behind. Use that.

Beam dodge:
```js
  if (oppBeam) {
    if (ki >= 16 && d <= 240 && s.wallAhead >= d + 80) return 'dash_forward';
    if (ki >= 15) return 'guard';
    if (ki >= 16 && d <= 240) return 'dash_forward';
    return 'idle';
  }
```
Wait if opp still in beam startup (no beam object yet) — handled below via op.state==='beam'.

```js
  if (op.state === 'beam' && op.phase !== 'recovery') {
    // punish startup or dodge firing
    if (op.phase === 'startup') {
      var rem = 30 - op.t;   // note counter startups: op.su may differ; use op.left? left = dur - t covers whole beam. Use rough: if op.t < 20
      if (op.t <= 15 && d <= 130) return 'heavy';
      if (op.t <= 20 && d <= 105) return 'light';
      if (ki >= 16 && d <= 240 && s.wallAhead >= d + 80) return 'dash_forward';
      if (ki >= 16 && d <= 400 && s.wallAhead >= d + 80) return 'dash_forward';
    }
    if (ki >= 16 && d <= 240 && s.wallAhead >= d + 80) return 'dash_forward';
    if (ki >= 15) return 'guard';
    return 'idle';
  }
```
Beam startup counter: op.su could be 12 or 30; op.t is ticks in state. If op.t small, punish. Heavy counter: 150 dmg and interrupts. But if I misjudge and their startup is 12 (counter to my beam — but I'm not beaming, so su=30 unless they answered... only if I beam). Fine, op.t<=15 → their remaining ≥ ~15 (if su=30). Heavy startup 9+active → hits at 9-12, within. If d<=130 heavy.

Actually safer condition using op.left? op.left for beam = dur - t = su+fire+rec - t, doesn't isolate startup. Use op.phase==='startup' && (30 - op.t) >= 8 → heavy. If their su=12 (they answered my beam — I'm in beam then, not deciding here). OK.

Punish windows:

```js
  // punish: opponent stuck
  if (op.state === 'crushed' || op.state === 'hitstun' || op.state === 'blockstun') {
    if (op.state === 'crushed' && op.left > 26 && ki >= 50 && d < 600) return 'beam';
    if (op.state === 'crushed' && op.left > 10) {
      if (d <= 135) return 'heavy';
      if (ki >= 16 && d <= 380 && s.wallAhead >= 260) return 'dash_forward';
    }
    if (d <= 105) return 'light';
    if (d <= 135) return 'heavy';
    return 'forward';
  }
```
Wait beam during crushed: startup 30, stun 34 → beam fires at 30, hits while stunned. 280 + knockdown. But crush from my beam? beam recovery 20, they crushed 34, I free at 20, beam again? blastOut no. ki needs 50. Good.

heavy into crushed: counter 1.25 → 150. Also fine.

hitstun: light at 105 (counter? hitstun isn't startup/recovery — mult=1, but combo scaling! o.combo increments). If they're in hitstun from my light, canCancel already handled. hitstun from my blast (hitstun 20): I'm in recovery 18, free at 18, ask immediately, they free at 20 — light startup 5 misses. So hitstun branch mostly triggers from... trades. Whatever, it's fine.

```js
  if (op.state === 'down') {
    if (d > 140) {
      if (ki < 45 && d > 300) return 'charge';
      return 'forward';
    }
    // wait at range, charge a bit
    if (ki < 60) return 'charge';
    return 'back';
  }
```
Hmm while they're down and I'm at 140, if I charge they wake up and can heavy me? They wake, ask, could dash/attack. At d=140 their heavy reach exactly 140 — risky. Keep d ~150: if d<150 back a bit? Let's: if d>170 forward; else if ki<70 charge... but charging at 150 while they wake → they heavy (reach 140, no). They'd walk in. It's fine, incoming handled next ask.

Better: while down, position to d≈120 and be ready. Or charge if op.left>15 else guard-ish. Use op.left (down duration remaining): if op.left > 12: charge; else if d<=110 back; else idle.

```js
  if (op.state === 'down') {
    if (op.left > 14) {
      if (ki < 85) return 'charge';
      return 'forward';
    }
    return d <= 115 ? 'back' : 'idle';
  }
```
Hmm if ki<85 charge even at close? They wake with 42-down after heavy... they wake, I ask, handle. If they heavy on wake at d 140... I might eat it. Meh acceptable. Actually charge risk: they wake and blast: I see incoming next ask (eta guardable). OK.

Opp charging:
```js
  if (op.state === 'charge') {
    if (d <= 140) return 'heavy';       // 180 dmg
    if (ki >= 16 && d <= 380 && s.wallAhead >= d + 80) return 'dash_forward';
    return 'forward';
  }
```

Opp in recovery (whiff punish):
```js
  if (op.phase === 'recovery' || op.phase === 'startup') {
    // move states: light/heavy/blast/beam/dash
    if (op.state === 'heavy' && op.phase === 'startup') {
      if (d <= 105 && op.t <= 4) return 'light';
      if (ki >= 16) return 'dash_back';
      return 'back';
    }
    if (op.state === 'light' && op.phase === 'startup' && d <= 105 && op.t <= 3) return 'light';
    if (d <= 105) return 'light';
    if (d <= 135 && (op.state==='heavy'||op.state==='blast'||op.state==='beam'||op.state==='dash')) return 'heavy';
    if (d <= 135) return 'forward';  // their light recovery: walk in? light recovery 9, I walk 4.5... 
    return 'forward';
  }
```
Getting complicated. Simplify: if op in startup of a strike in range → attack; if op in recovery in range → attack; else approach.

Blast incoming:
```js
  if (oppBlast && oppBlast.eta !== null && oppBlast.eta <= 5) {
    if (ki >= 16 && d <= 240 && s.wallAhead >= d + 80) return 'dash_forward';
    if (ki >= 6) return 'guard';
    if (ki >= 16) return 'dash_back';
    return 'idle';
  }
```

Guard-crush exploiting:
```js
  if (op.state === 'guard' || op.state === 'blockstun') {
    if (op.ki < 6 && ki >= 14 && !me.blastOut && d < 600) return 'blast';   // crush
    if (op.ki < 4 && d <= 108) return 'light';
    if (d <= 105) return 'light';
    if (d <= 135 && ki >= 16 && s.wallAhead >= d + 80) return 'dash_forward'; // cross up: behind guard!
    return 'forward';
  }
```
Dash behind a guarding opponent: they're in guard/blockstun — blockstun they can't turn; guard held state auto-faces? "free fighters auto-face" — guard is FREE, so they turn. blockstun isn't free → they stay facing → dash behind → their guard useless → attack their back! But they recover from blockstun in ≤14 and can act. Timing fuzzy. Keep it anyway.

Neutral:
```js
  if (d <= 100) {
    if (op.free) return 'light';
    return 'light';
  }
  if (d <= 140) {
    // just outside their light? their light reach 110. d in 100-140.
    return 'forward';
  }
```
Hmm at 100 attacking into a free opp: they may be winding heavy. My earlier heavy-startup check handles once they've started. Preemptively they can't hit me at 100 with heavy before I see it (heavy startup 9, ask cadence 6 — I might get asked at their t=0..5, dash_back/light). Decent.

Actually wait: if d<=100 and op.free and my ki>=... could also heavy for big damage. Heavy startup 9; their light startup 5 interrupts me. Mixing: use light mostly.

Mid/far:
```js
  if (ki >= 70 && d >= 250 && op.free) return 'beam';
  if (ki >= 40 && d >= 180 && d <= 500 && !me.blastOut && op.free && (ki > 60 || d > 300)) return 'blast';
  if (ki < 30 && d > 350 && op.free) return 'charge';
  return 'forward';
```

Corner safety: replace 'back' with 'forward' when wallBehind < 60. Wrap: define function mv(a){ if(a==='back' && s.wallBehind<70) return 'forward'; return a;} Apply to returns... just check in the few places.

Also final HP/time:
```js
  // endgame: protect lead
  if (s.timeLeft < 240 && me.hp > op.hp + 50 && d < 200) return 'back';
```
And if behind late: aggressive beams.

Also anti-idle trap: return something always.

Let me also track a simple opponent tendency: count their guards vs hits? Skip.

Ki check for blast: ki>=14, for beam >=50, dash >=16.

One more: while I have blastOut and far, walk forward (blast covers approach). Covered by default forward.

Also when opp free at d 105-140 and I have ki>=16, occasionally dash_forward to surprise? Skip.

Write it out cleanly.

Edge: 'heavy' when d<=135 but op might be free and guard → crush 60 dmg + 34 stun. Fine, heavy is +.

Also careful: light whiff at d 105-110 boundary — use 105 for light, 130 for heavy (reach 140 margin).

Also, don't attack when op.phase==='active' of heavy at close... if their heavy is active and it's going to hit me, too late mostly. If d>140, their heavy misses — punish their recovery 22 ticks: walk in? d up to 140+... my light needs 105, their recovery 22, walking 4.5/tick from 140: 8 ticks to 105, light startup 5 → active 13 <22 hit! So if their heavy active/recovery and d in 105-200: forward then light. My branch "op.phase recovery → d<=105 light else forward" handles it since I'll be asked... but cadence: while walking I'm in 'forward' free state, asked every 6 ticks — fine, by tick ~14 I'm at 105 and ask lands, light active ~19 <22. 

Also both-in-neutral stalemate: two bots walking into each other light-range → trade lights, my cancel combo wins trades. Good.

Final code assembly. Also keep runtime trivial.

Declaration: something like "以波会友，点到为止。" ≤20 chars.