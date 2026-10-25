// rules.js: every number the fight runs on. Time is in ticks (60 a second), distance in stage units (the stage is 1000 wide),
// damage in HP. Bots see this same object as the global RULES, so a bot can do its own frame arithmetic.
export const RULES = {
  version: 2,
  fps: 60,
  decideEvery: 6,              // a fighter that can act is asked at most every 6 ticks (10 times a second), and at once when it becomes free
  maxTicks: 3600,              // 60 s; then the one with more HP wins, equal HP is a draw
  stage: { left: 40, right: 960 },
  start: [350, 650],
  minGap: 60,                  // two bodies never come closer than this, centre to centre (a dash passes through)
  body: 30,                    // half a body's width, for blasts and beams
  hp: 1500, kiMax: 100, kiStart: 30,
  walk: { forward: 4.5, back: 3 },
  // ki per tick: passive always; walking forward adds `forward`, walking back and holding guard take some back; charging adds
  // `charge`. Per HP: `taken` when hit, `dealt` when hitting. Below rageHp of your HP every gain is x`rage` (the near-death surge).
  kiGain: { passive: 0.04, forward: 0.04, back: -0.04, guard: -0.03, charge: 0.32, taken: 0.08, dealt: 0.02, rage: 1.5, rageHp: 0.3 },
  // a guard costs ki: each hit blocked takes this much from the one guarding and gives the attacker `pressure`. A guard that
  // cannot pay gives way (crushed, as by a heavy). A heavy always crushes a guard.
  guardKi: { light: 4, blast: 6, beam: 15, pressure: 3 },

  // strikes. reach: the farthest centre-to-centre distance they connect at. A light punch that hits (not blocked) gives one extra
  // decision on the very next tick: light (up to `chain` in a row), heavy, blast or beam start at once there (a cancel = a combo).
  light: { startup: 5, active: 3, recovery: 9, reach: 110, damage: 40, hitstun: 15, blockstun: 11, push: 14, chain: 4 },
  heavy: { startup: 9, active: 4, recovery: 22, reach: 140, damage: 120, down: 42, knockback: 150, crush: 34, crushDamage: 60 },
  // ki attacks. A blast is a projectile (one of yours on screen at a time); two opposite blasts cancel; a beam swallows blasts.
  blast: { cost: 14, startup: 11, recovery: 18, speed: 13, damage: 60, chip: 12, hitstun: 20, blockstun: 14 },
  // a beam fires for `fire` ticks after its startup: a ray from the shooter to a front that runs out at `speed`; it hits a body it covers once.
  // Started while the opponent's beam is in its startup or firing at you, it fires together with theirs, or `counterStartup` from now
  // if theirs already fires: an answer, so the beams meet
  beam: { cost: 50, startup: 30, counterStartup: 12, fire: 40, recovery: 20, speed: 30, damage: 280, chip: 160, down: 50, knockback: 120 },
  // a dash moves `dist` toward (dash_forward) or away from (dash_back) the opponent in `ticks`, untouchable for the first `invuln` ticks;
  // dash_forward goes through the opponent and lands behind them when there is room
  dash: { cost: 16, ticks: 10, dist: 200, invuln: 8, recovery: 8 },
  counter: 1.25,               // damage x when the target is in the startup or recovery of a move
  chargeHit: 1.5,              // damage x when the target is charging
  combo: [1, 0.8, 0.65, 0.55, 0.45, 0.4],   // damage x for the 1st, 2nd, ... hit taken without becoming free in between

  // beam clash: two beams meet and push. The clash point has a speed: each tick it keeps `decay` of it and gains
  // drift x (power difference) toward the weaker side, plus a random shove (sd `noise`). power = base + kiPower x ki
  // (+ pushPower while you push, + rage below rageHp of your HP); with no ki left, power = empty (+ rage). Both lose `drain` ki
  // a tick, pushing costs `pushCost` more. The side the point reaches takes `damage`; after maxTicks the beams blow up, `draw` each.
  clash: { base: 1, kiPower: 0.02, pushPower: 0.6, rage: 0.4, rageHp: 0.3, empty: 0.5, drain: 0.2, pushCost: 0.6,
           drift: 0.1, decay: 0.95, noise: 0.8, damage: 320, draw: 120, down: 60, maxTicks: 360 },

  // time a bot may think: past `callMs` in one decision, or `matchMs` over a whole match, it loses the match
  budget: { callMs: 200, matchMs: 1500 },
};
