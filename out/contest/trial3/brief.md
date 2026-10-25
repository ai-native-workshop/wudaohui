# AI 武道会 · 选手规则书（第 1 季）

你要用 JavaScript 写一个格斗程序，操控一名武道家，在一个 2D 横版擂台上和另外 3 个 AI 写的程序轮流对打。每两名选手之间打 1000 局，左右场地轮换。名次按全部对局的胜率排（平局算半场胜）。所有选手拿到的都是这同一份规则书，一字不差。

## 你要交的东西

一个 JavaScript 文件，里面定义一个函数：

```js
function decide(state) {
  // 看局面，返回一个动作名
  return 'guard';
}
```

- 每次轮到你做决定，引擎调用一次 `decide(state)`，你返回一个动作名（字符串）。
- 文件的顶层代码在每局开始时执行一次。函数外面的变量可以记住这一局里发生过的事；下一局重新加载，变量清零。
- 全局变量 `RULES` 里是本规则书提到的全部数值（完整内容附在后面）。
- 可以用 `Math.random()`：它按局播种，同一局重放结果一样。`Date.now()` 永远返回 0。
- 不能用 `require`、`import`、网络、文件、`eval`、`new Function` 和定时器；`console.log` 不输出任何东西。
- 时间限制：单次调用超过 200 毫秒，或者一局里所有调用加起来超过 1500 毫秒，这一局判负。一局通常调用你几十到几百次，最多约 600 次。
- 函数抛出异常，或者返回的不是下面的动作名，都当作 `idle`。

## 擂台

- 时间单位是 tick，每秒 60 tick。一局最长 3600 tick（60 秒）。
- 擂台是一条横线，x 从 40 到 960。开局两人站在 x = 350 和 x = 650，面对面。
- 双方各 1000 点血。先把对手的血打到 0 就赢（KO）；时间到时血多的赢，一样多算平局；同一个 tick 双方都被打到 0 也算平局。
- 两人身体中心的距离不会小于 60，瞬移穿过对手时除外。可以行动的时候你总是自动面向对手，所以动作里的“前”永远指朝着对手的方向。

## 什么时候调用你

- 你空闲的时候（状态是 idle、forward、back、guard、charge 之一），最多每 6 tick 调用一次，也就是每秒 10 次。两次调用之间，你保持上一次选的状态。
- 你从出招、硬直、倒地这些状态恢复成空闲，下一个 tick 立刻调用你一次。
- 你的轻拳打中对手（不是被挡住）之后的下一个 tick，额外调用你一次，这时 `state.me.canCancel` 为 true，见“连招”。
- 对冲的时候每 6 tick 调用一次，见“对冲”。
- 两个选手在同一个 tick 看到的是同一个局面，各自做决定，同时生效，没有先手后手。

## 动作

| 动作 | 是什么 |
| --- | --- |
| `idle` | 站着不动 |
| `forward` | 朝对手走，每 tick 4.5；走的时候每 tick 多回 0.04 气 |
| `back` | 后退，每 tick 3；后退时每 tick 少回 0.04 气 |
| `guard` | 格挡：挡住正面来的轻拳、气功波和大招，但每挡一下要付气（见“打中、挡住和破防”），付不起就破防。挡不住重击，重击打在格挡上一定破防。举着格挡时每 tick 少回 0.03 气 |
| `charge` | 蓄气：每 tick 多回 0.32 气。蓄气时挨打，伤害 ×1.5 |
| `light` | 轻拳：起手 5、判定 3、收招 9 tick；距离 ≤ 110 打得中；伤害 40，对手硬直 15 tick |
| `heavy` | 重击：起手 9、判定 4、收招 22 tick；距离 ≤ 140；伤害 120，把对手击飞 150 并击倒 42 tick |
| `blast` | 气功波：耗 14 气；起手 11、收招 18 tick；从身前飞出，每 tick 飞 13；伤害 60，对手硬直 20 tick |
| `beam` | 大招（终极气功波）：耗 50 气；起手 30 tick（对手的大招正朝你来时，和他的同时发射），然后持续发射 40 tick，收招 20 tick；伤害 280，击倒 50 tick |
| `dash_forward` | 瞬移突进：耗 16 气；10 tick 内朝对手移动 200，收招 8 tick |
| `dash_back` | 瞬移后撤：耗 16 气；10 tick 内后退 200，收招 8 tick |
| `push` | 只在对冲时有用：加力 |

- 起手的那几个 tick 还没有攻击判定，判定的那几个 tick 才打得中人，收招是打完后的僵直。出招到收招结束之前不能做别的事。
- 气不够，或者你上一发气功波还在场上飞，这个动作无效，你继续做原来的事。
- 距离都按两人身体中心算。

## 打中、挡住和破防

- 格挡只挡正面。被瞬移绕到身后时，格挡没用。
- 轻拳被挡：没有伤害，挡的人被推开 14（他背靠擂台边时，改成出拳的人被推开），硬直 11 tick。轻拳打中时也一样推开。
- 气功波被挡：挡的人掉 12 血（擦伤），硬直 14 tick。大招被挡：掉 160 血，一直硬直到大招结束。
- 格挡要付气：每挡住一下，挡的人付 4 气（轻拳）、6 气（气功波）或 15 气（大招），出招的人回 3 气。挡的人气不够付，格挡就被打破：照样掉擦伤，然后晕眩 34 tick。
- 重击打在格挡上叫破防：挡的人掉 60 血，晕眩 34 tick，这段时间什么也做不了。
- 打中正在起手或收招的对手叫反击，伤害 ×1.25；打中正在蓄气的对手，伤害 ×1.5。
- 两人同一个 tick 互相打中，两边都吃伤害。
- 被击倒的人躺在地上，这段时间打不着他。站起来以后立刻轮到他做决定。

## 连招

- 轻拳打中对手（不是被挡）后，下一个 tick 额外调用你一次，`state.me.canCancel` 为 true。这时返回 `light`、`heavy`、`blast` 或 `beam`，新招马上开始，不用等这一拳收招（取消）。返回别的就正常收招。
- 一串取消里最多 4 记轻拳（`state.me.chain` 是这一串已经出了几拳），重击、气功波、大招不限。
- 对手在硬直里连续挨的第 1、2、3……下，伤害分别乘 1、0.8、0.65、0.55、0.45、0.4（之后都按最后一个）。对手一恢复空闲，就重新算。
- 不取消的话，下一记轻拳赶不上对手的硬直，对手来得及格挡。

## 瞬移

- 瞬移的前 8 tick 无敌：拳、气功波、大招都打不中你，会从你身上穿过去。
- `dash_forward` 的落点如果在对手身上或者身后，你会穿过对手、落到他身后（身后要有站得下一个人的地方，否则停在他面前）。落地后到收招结束前你还面朝原来的方向；对手空闲的话会立刻转身。

## 气功波和大招

- 气功波从你身前 40 处出现，往前直飞，飞出擂台就消失。场上同时只能有你的一发。
- 两发相向的气功波撞上，一起消失。大招会吞掉对方的气功波。
- 大招起手 30 tick（这段时间挨打就会被打断，耗掉的气不退）。如果你出大招的那一刻，对手的大招正在起手或发射、而且朝着你，你的大招会和他的同时发射；他已经在发射了，你就在 12 tick 后发射。这是专门用来迎击、打成对冲的。然后从你身前射出一道光束，光束的前端每 tick 前进 30，光束覆盖从你身前到前端的整段，持续 40 tick。对手身体碰到这段光束就挨打（只打一次）；瞬移无敌的时候碰到不算，但无敌结束时如果还在光束里，照样挨打。
- 发射期间你被打中，大招就断了。

## 对冲

- 两个人的大招迎面撞上，就进入对冲。双方都定住，两道光束在中间较劲，撞击点会来回移动。
- 每 6 tick 调用你一次：返回 `push` 是加力，返回别的是不加力。
- 你的力量 = 1 + 0.02 × 气 + （加力时 +0.6）+（血低于 30% 时 +0.4，濒死爆发）。没有气时力量只有 0.5（爆发加成照算）。
- 对冲中双方每 tick 都掉 0.2 气，加力的一方每 tick 再多掉 0.6 气。
- 撞击点有速度：每 tick 速度保留 0.95，再加上（双方力量差 × 0.1）往弱的一方去，外加一个随机的推力（标准差 0.8）。
- 撞击点推到谁的身上，谁就吃下两道光束：掉 320 血并被击倒。推赢的一方收招 20 tick。
- 对冲超过 360 tick 还没分出胜负，两道光束爆炸，双方各掉 120 血并被击倒。
- `state.clash` 里有撞击点的位置（0 在你身上，1 在对手身上）和双方现在的力量。

## 气

- 开局 30 气，上限 100。
- 每 tick 自然回 0.04 气。另外：蓄气时每 tick 再加 0.32，向前走再加 0.04，后退时减 0.04，举着格挡时减 0.03。
- 每挨 1 点伤害回 0.08 气，每打出 1 点伤害回 0.02 气。对手挡住你一下，你回 3 气；你挡住对手一下，你付气（见上）。
- 濒死爆发：你的血低于 30% 时，所有回气都乘 1.5。

## state 长什么样

```js
{
  t: 812,              // 现在是第几 tick
  timeLeft: 2788,      // 还剩几 tick
  me:  { x: 402.5, hp: 760, ki: 43.2, state: 'guard', phase: null, t: 14, left: 0, facing: 1,
         free: true, invulnerable: false, blastOut: false, combo: 0, canCancel: false, chain: 0 },
  opp: { x: 515, hp: 820, ki: 61.6, state: 'beam', phase: 'startup', t: 6, left: 84, facing: -1,
         free: false, invulnerable: false, blastOut: false, combo: 0 },
  dist: 112.5,         // 两人身体中心的距离
  wallAhead: 445,      // 你面前到擂台边的距离
  wallBehind: 362.5,   // 你身后到擂台边的距离
  blasts: [ { mine: false, x: 490, dir: -1, incoming: true, eta: 5 } ],
  beams:  [],          // 正在发射的大招：{ mine, from, front, dir }
  clash:  null         // 对冲时：{ pos: 0.42, myPower: 1.9, oppPower: 1.3, t: 37 }
}
```

- `state`（每个人的状态）是下面之一：`idle`、`forward`、`back`、`guard`、`charge`（这五个是空闲，可以行动）；`light`、`heavy`、`blast`、`beam`、`dash`（出招中）；`hitstun`（挨打硬直）、`blockstun`（格挡硬直）、`crushed`（被破防）、`down`（倒地）、`recover`（推赢对冲后的收招）、`clash`（对冲中）、`ko`。
- `phase`：出招时是 `startup`、`active`、`recovery`；气功波只有 `startup` 和 `recovery`；大招是 `startup`、`firing`、`recovery`；瞬移是 `moving`、`recovery`。其他状态是 null。
- `t`：在这个状态里已经待了几 tick。`left`：这个状态还剩几 tick（空闲状态是 0）。
- `facing`：1 是朝右（x 变大的方向），-1 是朝左。
- `combo`：这个人在这一串硬直里已经连续挨了几下。
- `blasts`：场上所有气功波。`incoming` 表示是对手的、正朝你飞来；`eta` 是还有几 tick 碰到你的身体。
- `beams`：正在发射的大招，光束覆盖 `from` 到 `front`。

## 规则的原文

上面的说明和下面的代码有出入时，以代码为准。

`src/rules.js`（在你的程序里就是全局变量 `RULES`）：

```js
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
  hp: 1000, kiMax: 100, kiStart: 30,
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
```

`src/engine.js`（引擎，逐 tick 推进一局；你的 `decide` 就是这里的 `ask`）：

```js
// engine.js: the fight itself, one tick at a time. Pure and deterministic: the same seed and the same two bots give the same fight,
// frame for frame, in Node (the tournament) and in the browser (the viewer, the playable Toy). The rules use only + - * / and
// comparisons (no Math.sin, no Date); the one random number source is the seeded generator, used by the beam clash.
//
//   const m = createMatch({ seed, rules, record, cadence }); while (!m.over) step(m, ask); const s = summary(m);
//   ask(side, view, m) -> an action name, see ACTIONS. It is called for a side only when that side may choose (RULES.decideEvery);
//   `view` is that side's picture of the fight (see view() below); the host decides how a bot gets it (the Node sandbox sends JSON).
//   m.frames (with record) holds one compact frame per tick for the replay and the renderer; m.events the notable moments.
import { RULES } from './rules.js';
import { mulberry32 } from './rng.js';

export const ACTIONS = ['idle', 'forward', 'back', 'guard', 'charge', 'light', 'heavy', 'blast', 'beam', 'dash_forward', 'dash_back', 'push'];
const ACT = new Set(ACTIONS);
const FREE = new Set(['idle', 'forward', 'back', 'guard', 'charge']);       // held states: a fighter in one of these can act
const MOVES = new Set(['light', 'heavy', 'blast', 'beam', 'dash']);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const r1 = x => Math.round(x * 10) / 10;

export function createMatch({ seed = 1, rules = RULES, record = false, cadence } = {}) {
  const R = rules, fighter = i => ({
    side: i, x: R.start[i], facing: i ? -1 : 1, hp: R.hp, ki: R.kiStart, state: 'idle', t: 0, dur: 0,
    hit: false, combo: 0, chain: 0, cancel: false, dash: null, kb: null, push: false, su: R.beam.startup, nextAsk: 0, every: cadence ? cadence[i] : R.decideEvery,
    st: { moves: {}, held: {}, hits: 0, blocked: 0, crushes: 0, dodges: 0, dealt: 0, minHp: R.hp, maxCombo: 0, invalid: 0, asks: 0 },
  });
  return { R, tick: 0, f: [fighter(0), fighter(1)], blasts: [], beams: [null, null], clash: null, rand: mulberry32(seed),
           events: [], frames: record ? [] : null, over: false, winner: null, reason: null, finisher: null, lead: 0, leadChanges: 0 };
}

export function phase(R, a) {
  const t = a.t;
  switch (a.state) {
    case 'light': case 'heavy': { const M = R[a.state]; return t < M.startup ? 'startup' : t < M.startup + M.active ? 'active' : 'recovery'; }
    case 'blast': return t < R.blast.startup ? 'startup' : 'recovery';
    case 'beam': return t < a.su ? 'startup' : t < a.su + R.beam.fire ? 'firing' : 'recovery';
    case 'dash': return t < R.dash.ticks ? 'moving' : 'recovery';
  }
  return null;
}
const surge = (R, a) => (a.hp < R.kiGain.rageHp * R.hp ? R.kiGain.rage : 1);   // near death, ki comes faster
const invuln = (R, a) => a.state === 'down' || a.state === 'ko' || (a.state === 'dash' && a.t < R.dash.invuln);

// what a side sees. Positions are absolute (x grows to the right); "forward" always means toward the opponent.
export function view(m, i) {
  const R = m.R, me = m.f[i], op = m.f[1 - i];
  const v = a => ({ x: r1(a.x), hp: Math.max(0, a.hp), ki: r1(a.ki), state: a.state, phase: phase(R, a), t: a.t, left: a.dur ? a.dur - a.t : 0,
    facing: a.facing, free: FREE.has(a.state), invulnerable: invuln(R, a), blastOut: m.blasts.some(b => b.owner === a.side), combo: a.combo });
  const k = m.clash, d0 = k && m.beams[0].dir;
  return {
    t: m.tick, timeLeft: R.maxTicks - m.tick,
    me: { ...v(me), canCancel: me.cancel, chain: me.chain }, opp: v(op),
    dist: r1(Math.abs(op.x - me.x)),
    wallAhead: r1(me.facing > 0 ? R.stage.right - me.x : me.x - R.stage.left), wallBehind: r1(me.facing > 0 ? me.x - R.stage.left : R.stage.right - me.x),
    blasts: m.blasts.map(b => {
      const gap = (me.x - b.x) * b.dir;                                   // > 0: the blast is still on its way to me
      return { mine: b.owner === i, x: r1(b.x), dir: b.dir, incoming: b.owner !== i && gap > 0, eta: b.owner !== i && gap > 0 ? Math.max(0, Math.ceil((gap - R.body) / R.blast.speed)) : null };
    }),
    beams: m.beams.filter(Boolean).map(b => ({ mine: b.owner === i, from: r1(b.from), front: r1(b.front), dir: b.dir })),
    clash: k ? { pos: r1(clamp(((k.c - me.x) * (i ? -d0 : d0)) / Math.abs(op.x - me.x), 0, 1) * 100) / 100, myPower: r1(power(m, me) * 100) / 100, oppPower: r1(power(m, op) * 100) / 100, t: k.t } : null,
  };
}

export function step(m, ask) {
  if (m.over) return;
  const R = m.R;
  // 1. both sides choose from the same moment
  const views = m.f.map((a, i) => (wants(m, a) ? view(m, i) : null));
  const acts = views.map((v, i) => (v ? ask(i, v, m) : null));
  acts.forEach((act, i) => views[i] && choose(m, m.f[i], act));
  // 2. bodies move, then turn to face each other
  for (const a of m.f) move(m, a);
  separate(m);
  for (const a of m.f) if (FREE.has(a.state)) face(a, m.f[1 - a.side]);
  // 3. what connects
  strikes(m);
  blasts(m);
  beams(m);
  if (m.clash) clashTick(m);
  // 4. time passes
  for (const a of m.f) {
    if (a.state === 'ko' || a.state === 'clash') continue;
    if (FREE.has(a.state)) a.st.held[a.state] = (a.st.held[a.state] || 0) + 1;
    a.t++;
    if (a.dur && a.t >= a.dur) free(m, a);
    const K = R.kiGain, g = K.passive + (a.state === 'charge' ? K.charge : a.state === 'forward' ? K.forward : a.state === 'back' ? K.back : a.state === 'guard' ? K.guard : 0);
    a.ki = clamp(a.ki + (g > 0 ? g * surge(R, a) : g), 0, R.kiMax);
  }
  if (m.frames) m.frames.push(frame(m));
  m.tick++;
  end(m);
}

const wants = (m, a) => !m.over && a.state !== 'ko' && (a.cancel || ((FREE.has(a.state) || a.state === 'clash') && m.tick >= a.nextAsk));

function choose(m, a, act) {
  const R = m.R;
  if (typeof act !== 'string' || !ACT.has(act)) { a.st.invalid++; act = 'idle'; }
  a.st.asks++; a.nextAsk = m.tick + a.every;
  if (a.cancel) {                                         // the one extra choice right after a light punch lands
    a.cancel = false;
    if ((act === 'light' && a.chain < R.light.chain) || act === 'heavy' || act === 'blast' || act === 'beam') start(m, a, act, true);
    return;
  }
  if (a.state === 'clash') { a.push = act === 'push'; return; }
  if (act === 'push') act = 'idle';
  if (FREE.has(act)) { if (a.state !== act) { a.state = act; a.t = 0; } return; }
  start(m, a, act, false);
}

// start a move; one it cannot pay for (or a second blast while the first still flies) is ignored, and the fighter keeps doing what it did
function start(m, a, act, chained) {
  const R = m.R;
  const dash = act === 'dash_forward' || act === 'dash_back';
  const cost = act === 'blast' ? R.blast.cost : act === 'beam' ? R.beam.cost : dash ? R.dash.cost : 0;
  if (a.ki < cost || (act === 'blast' && m.blasts.some(b => b.owner === a.side))) { a.st.invalid++; return; }
  a.ki -= cost;
  a.st.moves[act] = (a.st.moves[act] || 0) + 1;
  const kind = dash ? 'dash' : act;
  a.state = kind; a.t = 0; a.hit = false; a.dodged = false; a.dash = null; a.push = false;
  a.chain = act === 'light' ? (chained ? a.chain + 1 : 1) : a.chain;
  if (kind === 'light' || kind === 'heavy') { const M = R[kind]; a.dur = M.startup + M.active + M.recovery; }
  else if (kind === 'blast') a.dur = R.blast.startup + R.blast.recovery;
  else if (kind === 'beam') {
    // an answer to a beam coming at me fires together with it (or counterStartup from now, if it already fires), so the two meet
    const o = m.f[1 - a.side], aimed = o.state === 'beam' && phase(R, o) !== 'recovery' && (a.x - o.x) * o.facing > 0;
    a.su = aimed ? Math.max(R.beam.counterStartup, phase(R, o) === 'startup' ? o.su - o.t : 0) : R.beam.startup;
    a.dur = a.su + R.beam.fire + R.beam.recovery;
  }
  else {
    a.dur = R.dash.ticks + R.dash.recovery;
    a.dash = { x0: a.x, x1: dashEnd(m, a, act === 'dash_forward' ? 1 : -1), dir: act === 'dash_forward' ? 1 : -1 };
  }
  ev(m, act, a.side);
}

// where a dash lands: `dist` along the facing (or against it), through the opponent if there is room for a body behind them
function dashEnd(m, a, sign) {
  const R = m.R, o = m.f[1 - a.side], d = a.facing * sign, L = R.stage.left, H = R.stage.right;
  let x = a.x + d * R.dash.dist;
  const before = (o.x - a.x) * d, after = (o.x - x) * d;                  // opponent ahead of me along d, before and after
  if (before > 0 && after < R.minGap) {                                    // I would end inside or beyond them
    const behind = o.x + d * Math.max(R.minGap, -after);
    if (after <= -R.minGap && behind >= L && behind <= H) x = behind;      // through, landing behind
    else if (o.x + d * R.minGap >= L && o.x + d * R.minGap <= H && after < 0) x = o.x + d * R.minGap;
    else x = o.x - d * R.minGap;                                           // no room behind: stop in front
  }
  return clamp(x, L, H);
}

function move(m, a) {
  const R = m.R;
  if (a.kb) { const s = Math.min(a.kb.left, 12); a.x += a.kb.dir * s; a.kb.left -= s; if (a.kb.left <= 0) a.kb = null; }
  if (a.state === 'forward') a.x += a.facing * R.walk.forward;
  else if (a.state === 'back') a.x -= a.facing * R.walk.back;
  else if (a.state === 'dash' && a.t < R.dash.ticks) a.x = a.dash.x0 + ((a.dash.x1 - a.dash.x0) * (a.t + 1)) / R.dash.ticks;
  a.x = clamp(a.x, R.stage.left, R.stage.right);
}

// bodies never overlap, except while one of them is dashing through
function separate(m) {
  const R = m.R, [a, b] = m.f;
  if ((a.state === 'dash' && a.t < R.dash.ticks) || (b.state === 'dash' && b.t < R.dash.ticks)) return;
  const dx = b.x - a.x, over = R.minGap - Math.abs(dx);
  if (over <= 0) return;
  const s = dx > 0 ? 1 : dx < 0 ? -1 : a.facing;                         // b lies on side s of a
  const roomA = s > 0 ? a.x - R.stage.left : R.stage.right - a.x, roomB = s > 0 ? R.stage.right - b.x : b.x - R.stage.left;
  let pa = over / 2, pb = over / 2;
  if (pa > roomA) { pb += pa - roomA; pa = roomA; }
  if (pb > roomB) { pa = Math.min(roomA, pa + pb - roomB); pb = roomB; }
  a.x -= s * pa; b.x += s * pb;
}

function face(a, o) { if (o.x !== a.x) a.facing = o.x > a.x ? 1 : -1; }

// push the one hit away from the attacker; against the wall the attacker slides back instead
function pushApart(m, a, o, dist) {
  const R = m.R, d = o.x > a.x ? 1 : o.x < a.x ? -1 : a.facing;
  const room = d > 0 ? R.stage.right - o.x : o.x - R.stage.left, s = Math.min(dist, room);
  o.x += d * s;
  if (s < dist) a.x = clamp(a.x - d * (dist - s), R.stage.left, R.stage.right);
}

function strikes(m) {
  const R = m.R, todo = [];
  for (const a of m.f) {
    if ((a.state !== 'light' && a.state !== 'heavy') || a.hit || phase(R, a) !== 'active') continue;
    const o = m.f[1 - a.side], d = (o.x - a.x) * a.facing;
    if (d > 0 && d <= R[a.state].reach) {
      if (invuln(R, o)) { if (o.state === 'dash' && !a.dodged) { a.dodged = true; dodge(m, o, a.state); } continue; }
      todo.push([a, o, a.state, mult(R, o)]);                              // decided before either lands, so a trade hurts both
    }
  }
  for (const [a, o, kind, x] of todo) { a.hit = true; land(m, a, o, kind, { dir: a.x > o.x ? 1 : -1, mult: x }); }
}

function blasts(m) {
  const R = m.R, B = R.blast;
  for (const a of m.f) if (a.state === 'blast' && a.t === B.startup) { m.blasts.push({ owner: a.side, x: a.x + a.facing * 40, px: a.x, dir: a.facing }); ev(m, 'blast_out', a.side); }
  for (const b of m.blasts) { b.px = b.x; b.x += b.dir * B.speed; }
  for (const b of m.blasts) for (const c of m.blasts)                     // two opposite blasts that cross cancel out
    if (b.owner === 0 && c.owner === 1 && !b.dead && !c.dead && b.dir !== c.dir && (b.px - c.px) * (b.x - c.x) <= 0) { b.dead = c.dead = true; ev(m, 'blast_clash', -1); }
  for (const b of m.blasts) for (const beam of m.beams)                   // a beam swallows the other side's blasts
    if (!b.dead && beam && beam.owner !== b.owner && inRay(beam, b.x, 8)) b.dead = true;
  for (const b of m.blasts) {
    if (b.dead) continue;
    const o = m.f[1 - b.owner];
    if (Math.abs(o.x - b.x) > R.body && (o.x - b.px) * (o.x - b.x) > 0) continue;
    if (invuln(R, o)) { if (o.state === 'dash' && !b.dodged) { b.dodged = true; dodge(m, o, 'blast'); } continue; }
    b.dead = true;
    land(m, m.f[b.owner], o, 'blast', { dir: -b.dir });
  }
  m.blasts = m.blasts.filter(b => !b.dead && b.x > R.stage.left - 60 && b.x < R.stage.right + 60);
}

function inRay(b, x, pad) { const lo = Math.min(b.from, b.front), hi = Math.max(b.from, b.front); return x + pad >= lo && x - pad <= hi; }

function beams(m) {
  const R = m.R, Bm = R.beam;
  if (m.clash) return;                                                     // a clash freezes both beams
  for (const a of m.f) {
    if (a.state === 'beam' && a.t === a.su) { m.beams[a.side] = { owner: a.side, dir: a.facing, from: a.x + a.facing * 25, front: a.x + a.facing * 40, hit: false }; ev(m, 'beam_out', a.side); }
    if (m.beams[a.side] && (a.state !== 'beam' || a.t >= a.su + Bm.fire)) m.beams[a.side] = null;   // over, or the shooter was hit
  }
  for (const b of m.beams) if (b) b.front = clamp(b.front + b.dir * Bm.speed, R.stage.left - 40, R.stage.right + 40);
  const [b0, b1] = m.beams;
  if (b0 && b1 && b0.dir === -b1.dir && (m.f[1].x - m.f[0].x) * b0.dir > 0 && (b0.front - b1.front) * b0.dir >= 0) {
    m.clash = { c: (b0.front + b1.front) / 2, v: 0, t: 0 };
    for (const a of m.f) { a.state = 'clash'; a.t = 0; a.dur = 0; a.push = false; a.nextAsk = m.tick + 1; }
    b0.front = b1.front = m.clash.c;
    ev(m, 'clash', -1);
    return;
  }
  for (const b of m.beams) {
    if (!b || b.hit) continue;
    const a = m.f[b.owner], o = m.f[1 - b.owner];
    if (!inRay(b, o.x, R.body)) continue;
    if (invuln(R, o)) { if (o.state === 'dash' && !b.dodged) { b.dodged = true; dodge(m, o, 'beam'); } continue; }
    b.hit = true;
    land(m, a, o, 'beam', { dir: -b.dir, stun: a.su + Bm.fire - a.t + 6 });
  }
}

const power = (m, f) => { const C = m.R.clash; return (f.ki > 0 ? C.base + C.kiPower * f.ki + (f.push ? C.pushPower : 0) : C.empty) + (f.hp < C.rageHp * m.R.hp ? C.rage : 0); };

function clashTick(m) {
  const R = m.R, C = R.clash, k = m.clash, [a, b] = m.f, d = m.beams[0].dir;   // beam 0 runs along d, from fighter 0 toward fighter 1
  const pa = power(m, a), pb = power(m, b);
  for (const f of m.f) f.ki = Math.max(0, f.ki - C.drain - (f.push && f.ki > 0 ? C.pushCost : 0));
  const shove = (m.rand() + m.rand() + m.rand() + m.rand() - 2) * 1.7320508 * C.noise;   // four uniforms: close to normal, sd = noise
  k.v = k.v * C.decay + d * ((pa - pb) * C.drift + shove);
  k.c += k.v; k.t++;
  m.beams[0].front = m.beams[1].front = k.c;
  const atB = (k.c - (b.x - d * R.body)) * d >= 0, atA = ((a.x + d * R.body) - k.c) * d >= 0;
  if (atA || atB || k.t >= C.maxTicks) endClash(m, atB ? 0 : atA ? 1 : -1);
}

function endClash(m, w) {
  const R = m.R, C = R.clash, ticks = m.clash.t;
  m.clash = null; m.beams = [null, null];
  if (w < 0) {                                                             // nobody gave way: the beams blow up between them
    for (const f of m.f) { hurt(m, m.f[1 - f.side], f, C.draw, 'clash'); knock(m, f, m.f[1 - f.side], C.down, 100); }
    ev(m, 'clash_draw', -1, { ticks });
    return;
  }
  const W = m.f[w], L = m.f[1 - w];
  W.state = 'recover'; W.t = 0; W.dur = R.beam.recovery;
  hurt(m, W, L, C.damage, 'clash'); L.st.minHp = Math.min(L.st.minHp, L.hp);
  knock(m, L, W, C.down, R.beam.knockback);
  W.st.hits++;
  ev(m, 'clash_win', w, { ticks });
}

// damage multiplier against `o` right now: caught charging, or caught in the startup or recovery of a move
function mult(R, o) {
  if (o.state === 'charge') return R.chargeHit;
  const p = phase(R, o);
  return MOVES.has(o.state) && (p === 'startup' || p === 'recovery') ? R.counter : 1;
}

// a strike, blast or beam reaches `o`. ctx.dir: the side the hit comes from, seen from o (+1 = from its right)
function land(m, a, o, kind, ctx) {
  const R = m.R, M = R[kind];
  if (o.state === 'guard' && ctx.dir * o.facing > 0) {                     // a guard covers the front only
    if (kind === 'heavy') {
      hurt(m, a, o, M.crushDamage, 'crush');
      stun(o, 'crushed', M.crush); a.st.crushes++;
      ev(m, 'crush', a.side);
      return;
    }
    const pay = R.guardKi[kind];
    if (o.ki < pay) {                                                      // no ki left to hold the guard: it gives way
      o.ki = 0;
      if (M.chip) hurt(m, a, o, M.chip, kind);
      stun(o, 'crushed', R.heavy.crush); a.st.crushes++;
      ev(m, 'crush', a.side, { by: 'ki' });
      return;
    }
    o.ki -= pay; a.ki = Math.min(R.kiMax, a.ki + R.guardKi.pressure * surge(R, a));
    if (M.chip) hurt(m, a, o, M.chip, kind);
    stun(o, 'blockstun', kind === 'beam' ? ctx.stun : M.blockstun);
    o.st.blocked++;
    if (kind === 'light') pushApart(m, a, o, M.push);
    ev(m, 'block', o.side, { kind });
    return;
  }
  const x = ctx.mult ?? mult(R, o), scale = R.combo[Math.min(o.combo, R.combo.length - 1)];
  const dmg = Math.max(1, Math.round(M.damage * x * scale));
  hurt(m, a, o, dmg, kind);
  o.combo++; a.st.hits++; a.st.maxCombo = Math.max(a.st.maxCombo, o.combo);
  ev(m, 'hit', a.side, { kind, dmg, combo: o.combo, counter: x > 1 });
  if (kind === 'light') { stun(o, 'hitstun', M.hitstun); pushApart(m, a, o, M.push); if (a.state === 'light') { a.cancel = true; } }
  else if (kind === 'blast') stun(o, 'hitstun', M.hitstun);
  else knock(m, o, a, M.down, M.knockback);
}

function hurt(m, a, o, dmg, kind) {
  const R = m.R;
  o.hp = Math.max(-999, o.hp - dmg); o.st.minHp = Math.min(o.st.minHp, Math.max(0, o.hp));
  a.st.dealt += dmg;
  o.ki = Math.min(R.kiMax, o.ki + R.kiGain.taken * dmg * surge(R, o)); a.ki = Math.min(R.kiMax, a.ki + R.kiGain.dealt * dmg * surge(R, a));
  m.finisher = kind;
  const lead = Math.sign(m.f[0].hp - m.f[1].hp);
  if (lead && m.lead && lead !== m.lead) m.leadChanges++;
  if (lead) m.lead = lead;
}

function stun(o, state, dur) {
  o.state = state; o.t = 0; o.dur = dur; o.hit = false; o.cancel = false; o.dash = null; o.push = false;
}

// knocked down: thrown back, untouchable on the floor for `down` ticks
function knock(m, o, from, down, dist) {
  stun(o, 'down', down);
  const d = o.x > from.x ? 1 : o.x < from.x ? -1 : -o.facing;
  o.kb = { dir: d, left: dist };
}

function dodge(m, o, what) { o.st.dodges++; ev(m, 'dodge', o.side, { what }); }

function free(m, a) {
  a.state = 'idle'; a.t = 0; a.dur = 0; a.dash = null; a.hit = false; a.cancel = false; a.chain = 0; a.combo = 0;
  a.nextAsk = m.tick + 1;                                                  // asked again at once
}

function ev(m, type, side, data) { m.events.push(data ? { t: m.tick, type, side, ...data } : { t: m.tick, type, side }); }

function end(m) {
  const R = m.R, [a, b] = m.f, ka = a.hp <= 0, kb = b.hp <= 0;
  if (ka || kb) {
    m.over = true; m.reason = ka && kb ? 'double_ko' : 'ko'; m.winner = ka && kb ? null : ka ? 1 : 0;
    for (const f of m.f) if (f.hp <= 0) { f.state = 'ko'; f.t = 0; f.dur = 0; }
    ev(m, 'ko', m.winner ?? -1);
  } else if (m.tick >= R.maxTicks) {
    m.over = true; m.reason = 'time'; m.winner = a.hp === b.hp ? null : a.hp > b.hp ? 0 : 1;
    ev(m, 'time', m.winner ?? -1);
  }
}

// a forfeit from outside the rules (a bot crashed its sandbox, or ran out of thinking time)
export function forfeit(m, side, why) {
  m.over = true; m.reason = why || 'forfeit'; m.winner = 1 - side;
  ev(m, 'forfeit', side, { why: m.reason });
}

function frame(m) {
  const R = m.R;
  return {
    f: m.f.map(a => [r1(a.x), a.state, a.t, a.facing, a.hp, r1(a.ki), phase(R, a), a.combo]),
    b: m.blasts.map(b => [b.owner, r1(b.x), b.dir]),
    m: m.beams.map(b => b && [r1(b.from), r1(b.front), b.dir]),
    c: m.clash && [r1(m.clash.c), m.clash.t, ...m.f.map(f => r1(power(m, f) * 100) / 100), ...m.f.map(f => f.push ? 1 : 0)],
  };
}

// the match in numbers: who won and how, plus what makes it worth replaying (see highlight)
export function summary(m) {
  const R = m.R, n = t => m.events.filter(e => e.type === t).length;
  const s = {
    winner: m.winner, reason: m.reason, ticks: m.tick, hp: m.f.map(f => Math.max(0, f.hp)), finisher: m.reason === 'time' ? 'time' : m.finisher,
    leadChanges: m.leadChanges, clashes: n('clash'), beams: n('beam_out'),
    side: m.f.map(f => ({ ...f.st, moves: { ...f.st.moves }, held: { ...f.st.held } })),
  };
  s.highlight = highlight(R, s);
  return s;
}

// how much a match is worth animating: a comeback, a clash (more so if it decided the match), long combos, the lead changing hands, a close finish
export function highlight(R, s) {
  const w = s.winner;
  const comeback = w == null ? 0 : 1 - s.side[w].minHp / R.hp;
  const close = w == null ? 1 : 1 - (s.hp[w] - s.hp[1 - w]) / R.hp;
  const combo = Math.max(s.side[0].maxCombo, s.side[1].maxCombo);
  return Math.round(10 * (4 * comeback ** 2 + 1.5 * Math.min(2, s.clashes) + (s.finisher === 'clash' ? 2 : s.finisher === 'beam' ? 1 : 0)
    + 0.25 * Math.max(0, combo - 2) + 0.6 * Math.min(4, s.leadChanges) + 1.5 * close ** 3)) / 10;
}
```

## 怎么交

回复里只放两样东西：

1. 一个 ```js 代码块，里面是你的完整程序。
2. 代码块后面另起一行，写“赛前宣言：”加一句话（20 个字以内），会在比赛开始前配上你的角色出现在画面上。
