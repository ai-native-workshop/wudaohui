// brief.mjs: the contestant brief, the one prompt every model gets word for word. Built from rules.js and the engine source,
// so the numbers in it can never drift from the numbers the fights run on.
//
//   node arena/brief.mjs [--games=1000] [--season=1] [--out=out/brief.md]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/rules.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function brief({ games = 1000, season = 1, opponents = 5 } = {}) {
  const R = RULES, L = R.light, H = R.heavy, Bl = R.blast, B = R.beam, D = R.dash, C = R.clash, K = R.kiGain, G = R.guardKi;
  const engine = readFileSync(join(root, 'src/engine.js'), 'utf8'), rules = readFileSync(join(root, 'src/rules.js'), 'utf8');
  return `# AI 武道会 · 选手规则书（第 ${season} 季）

你要用 JavaScript 写一个格斗程序，操控一名武道家，在一个 2D 横版擂台上和另外 ${opponents} 个 AI 写的程序轮流对打。每两名选手之间打 ${games} 局，左右场地轮换。名次按全部对局的胜率排（平局算半场胜）。所有选手拿到的都是这同一份规则书，一字不差。

## 你要交的东西

一个 JavaScript 文件，里面定义一个函数：

\`\`\`js
function decide(state) {
  // 看局面，返回一个动作名
  return 'guard';
}
\`\`\`

- 每次轮到你做决定，引擎调用一次 \`decide(state)\`，你返回一个动作名（字符串）。
- 文件的顶层代码在每局开始时执行一次。函数外面的变量可以记住这一局里发生过的事；下一局重新加载，变量清零。
- 全局变量 \`RULES\` 里是本规则书提到的全部数值（完整内容附在后面）。
- 可以用 \`Math.random()\`：它按局播种，同一局重放结果一样。\`Date.now()\` 永远返回 0。
- 不能用 \`require\`、\`import\`、网络、文件、\`eval\`、\`new Function\` 和定时器；\`console.log\` 不输出任何东西。
- 时间限制：单次调用超过 ${R.budget.callMs} 毫秒，或者一局里所有调用加起来超过 ${R.budget.matchMs} 毫秒，这一局判负。一局通常调用你几十到几百次，最多约 600 次。
- 函数抛出异常，或者返回的不是下面的动作名，都当作 \`idle\`。

## 擂台

- 时间单位是 tick，每秒 ${R.fps} tick。一局最长 ${R.maxTicks} tick（${R.maxTicks / R.fps} 秒）。
- 擂台是一条横线，x 从 ${R.stage.left} 到 ${R.stage.right}。开局两人站在 x = ${R.start[0]} 和 x = ${R.start[1]}，面对面。
- 双方各 ${R.hp} 点血。先把对手的血打到 0 就赢（KO）；时间到时血多的赢，一样多算平局；同一个 tick 双方都被打到 0 也算平局。
- 两人身体中心的距离不会小于 ${R.minGap}，瞬移穿过对手时除外。可以行动的时候你总是自动面向对手，所以动作里的“前”永远指朝着对手的方向。

## 什么时候调用你

- 你空闲的时候（状态是 idle、forward、back、guard、charge 之一），最多每 ${R.decideEvery} tick 调用一次，也就是每秒 10 次。两次调用之间，你保持上一次选的状态。
- 你从出招、硬直、倒地这些状态恢复成空闲，下一个 tick 立刻调用你一次。
- 你的轻拳打中对手（不是被挡住）之后的下一个 tick，额外调用你一次，这时 \`state.me.canCancel\` 为 true，见“连招”。
- 对冲的时候每 ${R.decideEvery} tick 调用一次，见“对冲”。
- 两个选手在同一个 tick 看到的是同一个局面，各自做决定，同时生效，没有先手后手。

## 动作

| 动作 | 是什么 |
| --- | --- |
| \`idle\` | 站着不动 |
| \`forward\` | 朝对手走，每 tick ${R.walk.forward}；走的时候每 tick 多回 ${K.forward} 气 |
| \`back\` | 后退，每 tick ${R.walk.back}；后退时每 tick 少回 ${-K.back} 气 |
| \`guard\` | 格挡：挡住正面来的轻拳、气功波和大招，但每挡一下要付气（见“打中、挡住和破防”），付不起就破防。挡不住重击，重击打在格挡上一定破防。举着格挡时每 tick 少回 ${-K.guard} 气 |
| \`charge\` | 蓄气：每 tick 多回 ${R.kiGain.charge} 气。蓄气时挨打，伤害 ×${R.chargeHit} |
| \`light\` | 轻拳：起手 ${L.startup}、判定 ${L.active}、收招 ${L.recovery} tick；距离 ≤ ${L.reach} 打得中；伤害 ${L.damage}，对手硬直 ${L.hitstun} tick |
| \`heavy\` | 重击：起手 ${H.startup}、判定 ${H.active}、收招 ${H.recovery} tick；距离 ≤ ${H.reach}；伤害 ${H.damage}，把对手击飞 ${H.knockback} 并击倒 ${H.down} tick |
| \`blast\` | 气功波：耗 ${Bl.cost} 气；起手 ${Bl.startup}、收招 ${Bl.recovery} tick；从身前飞出，每 tick 飞 ${Bl.speed}；伤害 ${Bl.damage}，对手硬直 ${Bl.hitstun} tick |
| \`beam\` | 大招（终极气功波）：耗 ${B.cost} 气；起手 ${B.startup} tick（对手的大招正朝你来时，和他的同时发射），然后持续发射 ${B.fire} tick，收招 ${B.recovery} tick；伤害 ${B.damage}，击倒 ${B.down} tick |
| \`dash_forward\` | 瞬移突进：耗 ${D.cost} 气；${D.ticks} tick 内朝对手移动 ${D.dist}，收招 ${D.recovery} tick |
| \`dash_back\` | 瞬移后撤：耗 ${D.cost} 气；${D.ticks} tick 内后退 ${D.dist}，收招 ${D.recovery} tick |
| \`push\` | 只在对冲时有用：加力 |

- 起手的那几个 tick 还没有攻击判定，判定的那几个 tick 才打得中人，收招是打完后的僵直。出招到收招结束之前不能做别的事。
- 气不够，或者你上一发气功波还在场上飞，这个动作无效，你继续做原来的事。
- 距离都按两人身体中心算。

## 打中、挡住和破防

- 格挡只挡正面。被瞬移绕到身后时，格挡没用。
- 轻拳被挡：没有伤害，挡的人被推开 ${L.push}（他背靠擂台边时，改成出拳的人被推开），硬直 ${L.blockstun} tick。轻拳打中时也一样推开。
- 气功波被挡：挡的人掉 ${Bl.chip} 血（擦伤），硬直 ${Bl.blockstun} tick。大招被挡：掉 ${B.chip} 血，一直硬直到大招结束。
- 格挡要付气：每挡住一下，挡的人付 ${G.light} 气（轻拳）、${G.blast} 气（气功波）或 ${G.beam} 气（大招），出招的人回 ${G.pressure} 气。挡的人气不够付，格挡就被打破：照样掉擦伤，然后晕眩 ${H.crush} tick。
- 重击打在格挡上叫破防：挡的人掉 ${H.crushDamage} 血，晕眩 ${H.crush} tick，这段时间什么也做不了。
- 打中正在起手或收招的对手叫反击，伤害 ×${R.counter}；打中正在蓄气的对手，伤害 ×${R.chargeHit}。
- 两人同一个 tick 互相打中，两边都吃伤害。
- 被击倒的人躺在地上，这段时间打不着他。站起来以后立刻轮到他做决定。

## 连招

- 轻拳打中对手（不是被挡）后，下一个 tick 额外调用你一次，\`state.me.canCancel\` 为 true。这时返回 \`light\`、\`heavy\`、\`blast\` 或 \`beam\`，新招马上开始，不用等这一拳收招（取消）。返回别的就正常收招。
- 一串取消里最多 ${L.chain} 记轻拳（\`state.me.chain\` 是这一串已经出了几拳），重击、气功波、大招不限。
- 对手在硬直里连续挨的第 1、2、3……下，伤害分别乘 ${R.combo.join('、')}（之后都按最后一个）。对手一恢复空闲，就重新算。
- 不取消的话，下一记轻拳赶不上对手的硬直，对手来得及格挡。

## 瞬移

- 瞬移的前 ${D.invuln} tick 无敌：拳、气功波、大招都打不中你，会从你身上穿过去。
- \`dash_forward\` 的落点如果在对手身上或者身后，你会穿过对手、落到他身后（身后要有站得下一个人的地方，否则停在他面前）。落地后到收招结束前你还面朝原来的方向；对手空闲的话会立刻转身。

## 气功波和大招

- 气功波从你身前 40 处出现，往前直飞，飞出擂台就消失。场上同时只能有你的一发。
- 两发相向的气功波撞上，一起消失。大招会吞掉对方的气功波。
- 大招起手 ${B.startup} tick（这段时间挨打就会被打断，耗掉的气不退）。如果你出大招的那一刻，对手的大招正在起手或发射、而且朝着你，你的大招会和他的同时发射；他已经在发射了，你就在 ${B.counterStartup} tick 后发射。这是专门用来迎击、打成对冲的。然后从你身前射出一道光束，光束的前端每 tick 前进 ${B.speed}，光束覆盖从你身前到前端的整段，持续 ${B.fire} tick。对手身体碰到这段光束就挨打（只打一次）；瞬移无敌的时候碰到不算，但无敌结束时如果还在光束里，照样挨打。
- 发射期间你被打中，大招就断了。

## 对冲

- 两个人的大招迎面撞上，就进入对冲。双方都定住，两道光束在中间较劲，撞击点会来回移动。
- 每 ${R.decideEvery} tick 调用你一次：返回 \`push\` 是加力，返回别的是不加力。
- 你的力量 = ${C.base} + ${C.kiPower} × 气 + （加力时 +${C.pushPower}）+（血低于 ${C.rageHp * 100}% 时 +${C.rage}，濒死爆发）。没有气时力量只有 ${C.empty}（爆发加成照算）。
- 对冲中双方每 tick 都掉 ${C.drain} 气，加力的一方每 tick 再多掉 ${C.pushCost} 气。
- 撞击点有速度：每 tick 速度保留 ${C.decay}，再加上（双方力量差 × ${C.drift}）往弱的一方去，外加一个随机的推力（标准差 ${C.noise}）。
- 撞击点推到谁的身上，谁就吃下两道光束：掉 ${C.damage} 血并被击倒。推赢的一方收招 ${B.recovery} tick。
- 对冲超过 ${C.maxTicks} tick 还没分出胜负，两道光束爆炸，双方各掉 ${C.draw} 血并被击倒。
- \`state.clash\` 里有撞击点的位置（0 在你身上，1 在对手身上）和双方现在的力量。

## 气

- 开局 ${R.kiStart} 气，上限 ${R.kiMax}。
- 每 tick 自然回 ${K.passive} 气。另外：蓄气时每 tick 再加 ${K.charge}，向前走再加 ${K.forward}，后退时减 ${-K.back}，举着格挡时减 ${-K.guard}。
- 每挨 1 点伤害回 ${K.taken} 气，每打出 1 点伤害回 ${K.dealt} 气。对手挡住你一下，你回 ${G.pressure} 气；你挡住对手一下，你付气（见上）。
- 濒死爆发：你的血低于 ${K.rageHp * 100}% 时，所有回气都乘 ${K.rage}。

## state 长什么样

\`\`\`js
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
\`\`\`

- \`state\`（每个人的状态）是下面之一：\`idle\`、\`forward\`、\`back\`、\`guard\`、\`charge\`（这五个是空闲，可以行动）；\`light\`、\`heavy\`、\`blast\`、\`beam\`、\`dash\`（出招中）；\`hitstun\`（挨打硬直）、\`blockstun\`（格挡硬直）、\`crushed\`（被破防）、\`down\`（倒地）、\`recover\`（推赢对冲后的收招）、\`clash\`（对冲中）、\`ko\`。
- \`phase\`：出招时是 \`startup\`、\`active\`、\`recovery\`；气功波只有 \`startup\` 和 \`recovery\`；大招是 \`startup\`、\`firing\`、\`recovery\`；瞬移是 \`moving\`、\`recovery\`。其他状态是 null。
- \`t\`：在这个状态里已经待了几 tick。\`left\`：这个状态还剩几 tick（空闲状态是 0）。
- \`facing\`：1 是朝右（x 变大的方向），-1 是朝左。
- \`combo\`：这个人在这一串硬直里已经连续挨了几下。
- \`blasts\`：场上所有气功波。\`incoming\` 表示是对手的、正朝你飞来；\`eta\` 是还有几 tick 碰到你的身体。
- \`beams\`：正在发射的大招，光束覆盖 \`from\` 到 \`front\`。

## 规则的原文

上面的说明和下面的代码有出入时，以代码为准。

\`src/rules.js\`（在你的程序里就是全局变量 \`RULES\`）：

\`\`\`js
${rules.trim()}
\`\`\`

\`src/engine.js\`（引擎，逐 tick 推进一局；你的 \`decide\` 就是这里的 \`ask\`）：

\`\`\`js
${engine.trim()}
\`\`\`

## 怎么交

回复里只放两样东西：

1. 一个 \`\`\`js 代码块，里面是你的完整程序。
2. 代码块后面另起一行，写“赛前宣言：”加一句话（20 个字以内），会在比赛开始前配上你的角色出现在画面上。
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = /^--([^=]+)(?:=(.*))?$/s.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
  const out = args.out || join(root, 'out/brief.md'), text = brief({ games: +(args.games || 1000), season: +(args.season || 1) });
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, text);
  console.log(`${out}: ${text.length} characters`);
}
