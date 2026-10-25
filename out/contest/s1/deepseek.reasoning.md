我们需要写一个 JavaScript 格斗 AI，用于 2D 擂台对打。要提交完整程序，包括 decide 函数，可能还有顶层代码、辅助函数、记忆变量。目标是在循环赛制中胜率最大化。我们需要设计一个策略。

首先理解规则。比赛每名选手与其他5人打1000局，左右互换，所以每对打2000局？ "每两名选手之间打 1000 局，左右场地轮换" 意思是每对总共1000局，左右轮换，所以每侧500局? 不确定但无关。

我们只能控制 `decide(state)`，接收 state 视图。可以用顶层变量记住一局内历史。时间限制 200ms 单次，单局 1500ms 总调用（最多约600次），所以需要设计快速算法，避免复杂模拟。可以做一些预计算，但顶层代码每局开始执行一次，可以初始化。不能用 Date.now，Math.random 可用但按局播种（同一局重放结果一样），可用于随机化策略，但注意随机种子按局，所以每次比赛每局不同？具体由引擎种子决定。我们可以用 Math.random 做随机选择以实现不可预测。

我们需要写一个格斗 AI。策略需要考虑对手行为（其他 AI 选手）。由于不知道对手具体策略，需要鲁棒的通用 AI。可能的策略：防守反击、距离控制、连招、气功波、瞬移、大招对冲等。

重点分析游戏机制，找到可 exploit 的策略。

游戏是实时但决策每6 tick一次，动作持续时间长，要求预判。

我们有多种动作：
- idle, forward, back, guard, charge
- light: 快速，启动5，判定3，恢复9，伤害40，硬直15。可取消连招。
- heavy: 启动9，判定4，恢复22，伤害120，击倒42。被挡则破防（挡者掉60，晕34）。
- blast: 气功波，消耗14气，启动11，恢复18，飞行13，伤害60，硬直20。
- beam: 大招，消耗50气，启动30或12（迎击），发射40，恢复20，伤害280，击倒50。可被格挡，chip 160，格挡硬直到结束。
- dash_forward/back: 消耗16，10 tick内移动200，前8无敌，恢复8。
- push: 对冲时加力。

气：开局30，上限100。自然回0.04/tick，前进+0.04，后退-0.04，guard-0.03，charge+0.32。被动回气很慢，10秒才24气。挨打回气多。

胜利条件：KO 或时间到 HP 高。

重要机制：
- 格挡消耗气，被肉搏击中的硬直。
- 重击对格挡破防，构成威胁。如果对手格挡，重击可破防造成60伤害+34晕，收益大。但重击较慢，可被轻拳打断。
- 轻拳启动快，可连招，最多4连。连招伤害衰减。
- 气功波是远程，消耗14，启动11，飞行13，可被格挡消耗敌人气，自己可以回3气。但气功波被敌人跳跃/瞬移躲过？这里没有跳跃，只有瞬移。气功波可以牵制。
- 大招伤害高，但消耗大，启动慢，可被打断；格挡 chip 160，也能造成大量伤害且格挡者气消耗15。
- 瞬移突进和后撤，前8无敌，可用于闪避或穿越。dash_forward 穿过对手落到身后，可能制造交叉攻击（因为自动面向？瞬移落地后收招8 tick内面朝原方向，对手空闲会立刻转身，所以交叉后对方可能转身，但你可以利用时机）。dash_forward 可用于接近并穿过，dash_back 用于拉开距离。
- 对冲：双方大招迎击可能发生，需要 push 加力。对冲中每6tick调用一次。策略可考虑：在气量优势时 push，否则保留气？其实对冲中掉气0.2/tick，push多0.6/tick。力量=1+0.02*气+push0.6+濒死0.4，无气0.5。

核心是设计一个基于状态机的 AI，兼顾攻防、资源管理。

我们需要深入分析帧数据，制定战术。

决策点：
- 空闲时最多每6 tick调用一次，出招恢复后立刻调用。轻拳命中后额外调用（canCancel）。
- 对冲每6tick调用。

我们可以利用 canCancel 进行连招。轻拳命中后，下一个 tick 可以取消出招。如果不取消，就无法连上（对手硬直15，轻拳恢复9，总时间17? 启动5+判定3+恢复9=17；命中后硬直15，下一拳启动5，所以恢复9+启动5=14 < 15 实际上不取消也能赶上？但规则明确说“不取消的话，下一记轻拳赶不上对手的硬直，对手来得及格挡。” 因为硬直从命中 tick 开始？硬直15 tick，轻拳命中后剩余恢复9（包含收招），之后启动5，总共14 tick 从命中到下一拳判定，小于15 tick，理论上能赶上，但规则说不行，可能是因为决策延迟？但无论，可通过 canCancel 出招。
- canCancel 时返回 light/heavy/blast/beam，新招马上开始。可以打出连招，例如：light 命中 -> canCancel 下一 tick -> light 立刻开始（启动5）-> 命中...最多4记light。
- 轻拳连招伤害：40 * 1 + 40*0.8 + 40*0.65 + 40*0.55 = 40+32+26+22 = 120。之后可以接 heavy？但 heavy 启动9，对手硬直15，取消后启动9，硬直15，可以命中但需要判定在硬直内。heavy 不是连段限制，可以接。也许最佳连招是 light * 若干 + heavy/beam 收尾。但 heavy 击倒，使对手倒地，伤害高且重置。
- 如果轻拳被挡，不能取消（canCancel 只有在打中不是被挡），且双方有硬直。格挡方掉气但不会被击倒。

- 重击启动9，判定4，恢复22。若命中伤害120 * combo scale 可能，击倒，之后可以继续压制。
- 重击被挡则破防：挡者掉60血，晕34 tick，期间无法行动。此时可以继续攻击，但对手被晕不能防御，可以趁机输出。比如重击破防后，对手 crushed 34 tick，可以接 heavy/light combo？ crushed 不是 free，不能行动，但可以被击中吗？ 眩晕不能做什么，但可以挨打。我们可以利用这34 tick 造成大伤害。例如立刻用 light 连招或 heavy。

- 气功波：消耗14，启动11，恢复18，从身前40处出现，飞行13。可以在安全距离牵制。如果命中伤害60，硬直20，可接近。被挡则消耗对手6气，自己回3气，对手 chip 12 血。如果对手格挡，气量消耗净对手 -6，自己 +3（压力）。频繁使用可消耗对手气，使其无法格挡。气功波在场唯一，不能连发。

- 大招：消耗50，启动30（或12迎击），发射40，恢复20。伤害280，格挡 chip 160。是翻盘/终结技。但风险大：启动30 tick 不能行动，若被击中则打断，消耗不退。可在对手硬直/倒地时安全使用。例如对手倒地42 tick，我们可以蓄力 beam，等他站起来时刚好发射？计算：对手倒地42 tick，从击倒开始? 我们若用重型击倒，对手 down 42 tick，我们自身恢复22 tick，剩余20 tick可用于准备。beam 启动30，可能来不及完全，但对手站起来后可以格挡。需要计算。

- 瞬移：dash_forward 消耗16，10 tick移动200，前8无敌，恢复8。可用于穿身躲避气功波或逼近。dash_back 拉开距离。

- 对冲策略：需要管理气，push 时机。

需要设计一个能够应对各种情况的 AI。我们可以采用有限状态机，根据距离、双方状态、气量、HP、对手状态等决定。

由于不知道对手策略，需要适应性。可能的对手包括：
- 激进型：频繁攻击
- 防守型：格挡、蓄气
- 远程：气功波
- 瞬移：闪避
- 大招流

需要通用的强策略，或许以防守反击为主：用轻拳/气功波牵制，对手行动时利用帧优势惩罚；保持气量适中，使用重击破防；利用连招爆发。

分析距离：擂台长 920（40~960），身体中心最小距离60。开局距离300（350 vs 650）。近战攻击范围：light 110，heavy 140。blast 是飞行物，距离无限但被挡。

移动速度：forward 4.5，back 3。轻拳判定范围110，重击140。

在距离>140时无法肉搏。此时可用气功波或移动。蓄气是可行的，尤其是对手不在攻击范围内时。但蓄气时受到伤害1.5倍，需小心。

被动回气慢，主动蓄气快（0.32/tick，8秒可以回约153气? 0.36*480=172? 实际上0.32+0.04=0.36 per tick *480=172）。所以蓄气很重要。

气用于气功波、beam、dash。保留足够的气用于格挡（但格挡被动耗气，格挡攻击耗气更多）。

格挡耗气：格挡状态下每 tick 减0.03，被轻拳打中格挡减4，气功波减6，beam减15。若气不足则破防。所以气量低时不能一直格挡。

HP 低时回气 1.5 倍（rage），这可以改变策略。

如何构建 AI 决策？

我们可能无法进行复杂的搜索，但可以基于规则和状态评估。

我们可以写一个 decide(state) 函数：
- 解析 state.me, state.opp, state.dist, blasts, beams, clash 等。
- 维护一些顶层变量记录历史（比如对手习惯，连招计数）。
- 使用一个决策树或优先级策略。

主要状态：
- 如果 clash 不为 null，处理 push（对冲）。
- 如果 me.canCancel，处理连招取消。
- 如果 me.free（空闲），选择动作。
- 否则返回当前动作？其实只能返回一次，在空闲时选择动作会持续到下个决策。出招期间不会调用 except cancel。所以空闲选择动作。

### 空闲时的决策

需要考虑：
1. 对手状态：正在攻击？格挡？蓄气？倒地？硬直？
2. 距离。
3. 气量。
4. HP。
5. 场上气功波。
6. 对手 beam 状态。

#### 对手正在出招（light/heavy/blast/beam）且处于 startup/recovery
- 如果距离足够近，用 quicker 攻击打断（counter 伤害 x1.25）。
- 对手 startup light 5 tick，heavy 9，blast 11，beam 30。我们的 light 启动5，heavy 9。
- 如果对手在 startup/recovery，且距离在 light 范围（110）内，我们可以用 light 打断（counter 伤害 x1.25）。对手 recovery 时长可能长，我们可以等他恢复前打。
- 需注意对手 active 判定期间我们攻击可能互中。

#### 对手正在格挡
- 可以用 heavy 破防，但重击被格挡的话我们不会受伤，对手掉60并晕34。如果对手在格挡，距离在 heavy 范围140，可以尝试 heavy 破防。但 heavy 启动9，若对手不继续格挡而用 light 反击，我们可能被打。需要在恰当距离。
- 也可用 light 试探，被挡则消耗对手4气，自己回3气（净赚）。
- 或蓄气/移动。

#### 对手空闲
- 根据距离决定：
  - dist > 140：双方无法攻击，可以前进缩小或蓄气/气功波。
  - dist between 110-140：heavy 可能打中，light 打不中。可尝试 heavy，但风险高。可以前进进入 light 范围，或使用 heavy。
  - dist <=110：light 范围。可以 light 试探，或 heavy，或后退。

#### 气量管理
- 通常保持一定气量用于特殊动作。
- 如果气低（< 20），优先蓄气（dist>140 或安全时）。
- 如果气高，可以使用气功波或 beam。

#### 对手气量低
- 可以施加压力使其破防。气功波被挡消耗对手6气，我们自己回3。如果对手气<6，气功波可以破防，造成 chip 12 并晕眩34。所以当对手气低，发气功波是很好的。
- heavy 对格挡同样破防。

#### 对手倒地
- 对手 down 持续一段时间（heavy down 42, beam 50, clash draw?）。down 期间无敌。我们可以利用这段时间蓄气或准备攻击。
- 对手 down 后醒来立刻调用，可能会行动。我们可以在他站起前准备。

#### 对手使用 beam
- 如果对手启动 beam，距离远时我们可以用 beam 迎击（aimed 会同时发射或12 tick后）进入对冲。但消耗50气。如果有足够气，迎击可能转败为胜。或者用 dash 闪避，或打断（如果距离近，light 启动5，30 tick 足够打断）。
- 对手 beam 发射中，我们可以 dash_back/forward 躲避（无敌），或者 block（消耗15气+chip 160）。如果气量允许，格挡；否则可能选择迎击或躲避。

### 连招取消处理

当 canCancel 为 true，意味着上一记 light 命中。此时应决定是否继续连招。
- 检查 me.chain（已经出了几记 light）。最多4记 light。
- 通常选择继续 light 直到 chain 达到 3 或 4，然后接 heavy 或 beam 结束。
- 伤害计算：
  - l, l, l, l: 40*(1+0.8+0.65+0.55)=120
  - l, l, l, heavy: 40*(1+0.8+0.65) + 120*(0.55? 因为这是第4击? combo scale 对第4下是0.55) = 98 + 66 = 164 并且击倒。
  - l, l, heavy: 40*(1+0.8)+120*0.65=72+78=150
  - l, heavy: 40+120*0.8=136
  - l, l, l, beam: 40*(1+0.8+0.65)+280*0.55=98+154=252, 但 beam 启动30，对手硬直15，根本接不上！因为 beam 不是立即判定，需要30启动，对手硬直15，肯定能格挡。除非对手在硬直中被发射? 硬直15 < 30，所以 beam 连段不现实。但 canCancel 时选择 beam 会立即开始启动，但判定在30 tick后，对手早已恢复。所以 beam 连段一般不可行，除非对手持续硬直（例如 blast 硬直20，beam 启动30仍不够）。所以连招收尾最好用 heavy（启动9，判定4，硬直15，可以接上）。也可以用 light 继续。
- heavy 启动9，对手硬直15，从 cancel 下一 tick 开始，启动9后判定，对手硬直剩余可能14 tick？计算：轻拳命中发生在 tick T，对手硬直 15 tick 状态从 T 开始? stun(o,'hitstun',15) 设置 o.t=0, dur=15。在 step 末尾每个 fighter t++，所以对手硬直持续15 tick，在第 T+15 tick 结束（free）。canCancel 调用发生在“你轻拳打中对手（不是被挡）之后的下一个 tick”，即 T+1 tick 调用，此时 me.canCancel true。如果返回 heavy，start 马上开始，t=0，startup 9 tick，判定在 T+1+9 = T+10 tick。对手硬直直到 T+15 结束，所以判定时对手仍硬直，可以命中。所以 heavy 可以接上。
- blast 启动11，判定在 T+1+11 = T+12，对手硬直到 T+15，此时 blast 发射？ blast 没有 active，但飞行物在启动结束时出现（t===startup 时创建）。启动从 T+1 到 T+11 inclusive? 在 start 后 t=0 开始，blast startup 11，当 t === B.startup (11) 时在 step 的 blasts 中创建。也就是 T+1+11 = T+12 tick 创建气功波，飞行13，对手硬直到 T+15，所以气功波可能来不及到达（距离若近可能）。但 blast 可被格挡，风险。
- 所以最佳连招：light 1~3 次后接 heavy。因为 heavy 即使被对手醒来后格挡? 对手若仍在硬直，无法格挡，必中。若我们在第三次 light 后接 heavy（第4击），伤害 164。若只出两次 light 接 heavy（第3击），伤害 150。多一次 light 增加总伤害，但需要连续取消三次 light，且 chain 限制4。我们可以在 chain 0 时（第一次 light）命中后，canCancel 时继续 light，chain=1；再次 canCancel 时继续 light，chain=2；再次 canCancel 时继续 light，chain=3；再次 canCancel 时接 heavy（chain 允许 heavy 不限）。这样总共 3 次 light + heavy = 4击，第4击 heavy 乘 combo scale [3] = 0.55。总伤害 98+66=164。如果对手 HP 低，可以这样击杀。
- 但注意连招中可能会把对手推远，每次 light 命中 push 14。距离可能超过 heavy 范围? 但 light 命中 push 对手，距离增加14，heavy reach 140，light 后距离可能会从 110 内变为 110+14? 需要计算初始距离。如果初始距离很近（比如60最小），推4次距离变为60+56=116，仍在 heavy 140 内。如果初始距离较远（110），推一次后 124，仍可能在 heavy 140 内。所以一般可以。
- 若距离过远导致 heavy 够不到，可继续 light 或 blast。

因此 cancel 策略：
- 如果 chain < 3 且对手处于硬直（应该），返回 'light' 继续连击（或最多 chain 3）。
- 如果 chain >= 3 或者距离 > 140（可能接不上 heavy），返回 'heavy' 收尾（若 chain 允许）。如果距离可能不够 heavy，返回 'blast' 或 'light'。
- 如果 HP 低需快速击倒，可考虑 beam，但一般不建议。

需注意 canCancel 时如果返回 light，会重新开始 light，且 chain 递增，但若 chain 已经达到 4 则不能再 light（规则：act === 'light' && a.chain < R.light.chain）。我们可以直接 heavy。

### 对冲处理

当 state.clash 存在：
- 读取 clash.pos, myPower, oppPower, t。
- 决定 push 与否。力量差值造成撞击点移动。我们有气，push 增加力量0.6，但消耗更多气。需要根据气量和当前位置决定。
- 对冲中双方每 tick 掉0.2气，push 多掉0.6。
- 如果对手力量高于我们，我们可能需要在关键时刻 push 抵消，否则失败。
- 若我们气量充足，可以 push 以获胜。但 push 消耗气快，可能在之后变弱。
- 策略：预测对手是否 push 未知。保守：如果对手力量 > 我的力量（不含 push），而我气足够（>30），应该 push 以避免失败。如果我的力量已经高于对手，可能不需要 push，可以节省气，让撞击点自然推向对方。但随机推力可能干扰。
- 也可模拟？但只给当前位置和双方力量，不包含对手 push 状态。我们可以记录对手是否 push 通过历史？无法直接知道，只能看到 oppPower 更新（每6 tick 调用时）。我们可以观察 oppPower 是否增加了0.6来判断对手是否 push。但 clash state 中 oppPower 是当前力量（包含 push）。我们可以存储上一次 oppPower，比较。如果是，知道对手在 push。
- 为了简单，可以设计：
  - 如果我的气 > 50 且（对手力量 >= 我的力量 或 pos 对我方不利），则 push。
  - 否则不 push。
- 也可以无脑 push，但由于每 tick 多消耗0.6，可能快速耗尽，若对手不 push，我们力量会因气耗尽降到0.5，可能失败。需要权衡。
- 对冲 max 360 tick，每6 tick 调用一次。气消耗：不 push 0.2/tick，push 0.8/tick。初始气可能 50，不 push 可持续 250 tick，push 可持续 62 tick。但若 push 期间赢得对冲（推过去），提前结束。通常 push 是必要的。
- 或许简单策略：if (state.me.ki > 20 && state.clash.pos > 0.5) push; else not. 或者根据 myPower vs oppPower: 如果 oppPower > myPower，push。这样能避免落后。
- 注意：力量计算包括气和 push 加成，以及濒死。我们看到的 myPower/oppPower 已经包含双方当前 push 状态。所以如果 oppPower > myPower，可能对手在 push 或气多。我们 push 可增加0.6，可能反超。
- 由于力量差驱动，如果对手力量高，我们 push 能缩小差距或超过。但若对手气很多，push 可能不够。
- 我们可记录自己的 push 状态，下次调用时根据位置变化决定是否需要继续。由于每次调用间隔6 tick，位置变化可以计算。可以做一些简单自适应。

### 空闲决策详细

我们需要根据 state 制定优先级。可能需要模拟一些情况来确定最优行动。

我们可以写一个函数 `decideFree(state)`。

首先，从 state 获取变量：
- me = state.me, opp = state.opp
- dist = state.dist
- myHp = me.hp, oppHp = opp.hp
- myKi = me.ki, oppKi = opp.ki
- meState = me.state (应该是空闲之一)
- oppState = opp.state
- oppPhase = opp.phase
- blasts, beams.

可行动作：idle, forward, back, guard, charge, light, heavy, blast, beam, dash_forward, dash_back, push（只在 clash）。

我们会返回一个字符串。

#### A. 若对手正在使用大招（beam）且处于 startup/firing
- 如果 dist 近（<=140）且我们在对手 startup 时可以用 light 打断（消耗对手气不退，对手 big loss）。因为 beam startup 30，我们 light 启动5，判定3，足够。
- 但注意对手 beam 可能已经 firing，打断不了（light 打中会中断 beam? 发射期间被打中会断）。beam firing 持续40，我们若能近身攻击可以打断。
- 如果距离远（>140），可能无法快速打断。可选择：
  - 如果我们的气 >=50，用 beam 迎击（aimed）。
  - 否则用 dash_back 逃离或 guard 格挡。
  - 或使用气功波（会被 beam 吞掉，不好）。
- 若对手 beam 处于 startup，且距离在 light 范围（<=110）或 heavy 范围（<=140），我们可以用 light 打断。light 启动5，beam startup 30，除非对手已经快完成 startup? phase 给出 t，如果 opp.t 已超过 25，只剩 <5 tick 内发射，可能来不及。一般早期可以打断。
- 若对手 beam firing，若距离 <=140，我们可以尝试近身打断，但 beam 覆盖前线，我们如果在 ray 内会先受到伤害。需要判断我们是否在 beam 路径上。但我们能行动时是空闲，可能不在 ray 内? beam 覆盖从对手身前到前端，若我们在前端之外，可以近身。但距离近的话很可能在 ray 内，会被打中。所以应避免直接冲进 beam。
- 更安全的办法是 dash_forward/back 利用无敌闪避，或者格挡（但 chip 160）。
- beam 伤害巨大，最好避免被击中。如果距离远且对手 beam 发射，我们可以 dash_back 逃离。
- 由于 dash 前8无敌，可以穿过 beam 而不受伤，但 dash 结束可能仍在 ray 内，如果 invulnerable 结束在 ray 里会挨打。需要判断落点。

策略简化：如果对手 beam startup 且距离<=140，light 打断。否则，若我气>=50 且对手 beam 朝着我，可以考虑 beam 迎击（如果有把握）。但 beam 消耗大，如果不是必要，可以 dash 闪避。若气<50，dash_back 逃离，或 guard 赌 chip 160（但 HP 损失大），最好 dash。

#### B. 对手正在使用 blast（气功波启动）
- blast startup 11，之后出现气功波。对手启动期间可以被打断，counter 1.25。
- 如果距离<=110 且对手在 blast startup，light 打断（启动5）。
- 如果距离较远，可以 charge 或前进/后退。
- 如果对手已发射气功波（我们可在 blasts 中看到 incoming），需要应对：可以格挡（消耗6气，chip 12）或 dash 无敌闪避。如果气量低，dash。距离远可 back。

#### C. 对手正在 heavy
- heavy startup 9，判定4。如果距离近，我们可以用 light 打断（启动5，比 heavy 快）。但注意对手 heavy 启动9，我们 light 判定在5+3=8内到8 tick，比对方判定9早1 tick，能打断且 counter 1.25。但需距离在 light 范围。
- 如果距离 > light reach，但我们在 heavy 范围，也可以用 heavy 拼（同时互中），但风险。
- 可以 dash_back 拉开距离。

#### D. 对手在 hitstun/blockstun/crushed/down
这些是我们可以继续攻击的机会。
- hitstun（轻拳/气功波硬直）：对手不能行动。如果距离 <=110，用 light 攻击，或 heavy 若距离<=140且可能击倒。hitstun 持续15（light）或20（blast），我们有时间。但注意我们决策每6 tick，出招需要启动，可能赶不上。如果距离近，用 light 连招（light 启动5，判定3，对手硬直15，够）。但如果对手 hitstun 剩余时间少（opp.t 接近剩余），可能不够。
- blockstun（对手格挡攻击后硬直）：对手不能行动，但格挡硬直较短（light 11, blast 14, beam 直到结束）。在轻拳被挡后，双方有硬直，我们恢复? 我们出拳后收招9，对手 blockstun 11，所以我们先恢复2 tick? light 总长17，被挡后我们仍要在收招中。当我们恢复空闲，对手可能还有约2 tick blockstun。我们可行动，但距离可能被推开。可以尝试 heavy 或 light。
- crushed（被破防）：持续34 tick，对手不能行动。这是绝佳机会。我们应该最大化输出。可行动时，如果我们刚破防对手（heavy/气功波破防），我们可能仍处于收招。heavy 收招22，对手 crushed 34，我们恢复后还有12 tick 剩。此时距离? heavy 被挡 push 推开? 重击被挡破防没有 push? 规则没说推开。距离可能仍在 heavy 范围。我们可以用 light（启动5）然后连招，或者直接 heavy 再击倒（启动9，判定4，对手 crushed 12 可能来不及? 需判定在34内）。假设破防发生在 tick T，对手 crushed 34 tick。我们 heavy 收招22，恢复空闲在 T+22。决策被调用在 T+22（下一个 tick）。如果我们选择 heavy，启动9，判定在 T+22+9=T+31，在 crushed 34 内，可以命中。所以可以接 heavy 造成 120 * combo scale? 对手 combo 可能已计算。若能命中，击倒。或者用 light 连招。
- down（倒地）：对手无敌，不能攻击。我们可以利用这段时间蓄气或准备。对手 down 42/50 tick。我们可以蓄气（charge）直到对手快站起，然后准备攻击。注意 down 期间蓄气有风险吗？对手无法攻击，安全。但 down 结束后对手立刻可行动。我们可以在对手站起前提前出招，例如在 down 剩余约 15 tick 时开始 heavy/light，以便对手刚站起来无法防御? 但 down 结束 free 后立即调用对手，我们可以动作。需计算时机。
  - 如果对手 down 42，我们从对手倒地开始计时。我们可能处于收招（若我们刚 heavy 击倒，收招22），所以剩余20 tick 安全。我们可以 charge 约20 tick，然后对手站起。在对手 down 还剩约10 tick 时，我们可以开始 light 或 heavy。
  - 行动决策每6 tick，不规则。我们可以用 state.t 判断对手 down 已持续多久，left = opp.dur - opp.t。若 left 较大（>20），可以 charge。若 left 较小（<=10），准备攻击。
  - 由于我们每6 tick被调用，可能错过理想时机，但足够。

#### E. 对手空闲（idle/forward/back/guard/charge）
- 这是常见状态。需要根据距离和资源制定策略。

可能策略：
- 远距离（>140）：
  - 如果我们气低（<50），考虑 charge 或 forward（forward 可回气稍多，但接近）。charge 回气多，但受击1.5倍伤害。对手可能发气功波或接近。在远距离，蓄气相对安全。
  - 如果我们气高，可以发 blast 消耗对手。
  - 若对手处于 charge（蓄气），我们可考虑用 blast 攻击（对手蓄气时受到伤害1.5倍）。但距离远需要接近。也可前进。
- 中距离（110-140）：
  - 我们可以使用 heavy（范围140）攻击，但如果对手轻拳可打断。如果对手 idle，heavy 启动9，对手若反应快可能用 light 打断，但我们决策同时发生，若对手选择 light，能否打断？两者同 tick 选择，同时生效。heavy startup 9，light startup 5，判定3，在第8 tick 判定，heavy 在第9 tick 判定，所以 light 先打中，如果距离在 light 范围，对手 light 会先打断。若距离 >110，对手 light 够不到，heavy 安全。
  - 所以距离在 110-140 时，heavy 是安全的（对手 light 够不到），除非对手也 heavy 或 forward。但如果对手选择 forward，可能进入 light 范围并攻击。需评估。
  - 也可前进进入 light 范围进行轻拳攻击。
- 近距离（<=110）：
  - light 是快速攻击，可以试探。但对手可能格挡，我们被消耗气（对手付气，我们回气）。若对手格挡，双方硬直。
  - 也可以 heavy 破格挡，但可能被 light 打断。
  - 如果对手气低（<4），light 被挡可能破防（对手气不够付）。
  - 我们可以用 light 连招期望命中。

针对不同对手风格，我们能否自适应？可以记录对手的动作频率，但一局内时间有限，1000局共享？每局重置，但我们可以用顶层变量统计本局内对手行为，但用处不大。

我们可以设计一个混合策略：使用随机化来避免被预测。例如在一定概率下选择保守或进攻。

比赛最终胜率，需要稳健。

#### 气功波使用
气功波是一个很好的消耗和远程武器。我们可以在远距离蓄气，然后发气功波。
- 气功波飞行速度13，距离远时对手有反应时间。对手可以格挡或闪避。
- 如果我们预判对手会格挡，可以消耗其气。
- 如果对手气低，气功波可能破防。
- 使用气功波时，我们自己要确保不会被对手的快速近身打断。如果我们和对手距离较远（>140），对手需要走一段距离才能攻击，我们 startup 11 + recovery 18 = 29 tick 不能行动。对手 forward 4.5/tick，29 tick 可走约130。所以如果对手距离 140-260，可能在我们出招期间接近并攻击。需小心。在远距离（>300）比较安全。
- 若对手在 charge，气功波可以造成 60*1.5=90 伤害，非常可观。

#### beam 使用
- 当对手 HP 低（<280）时可以终结。
- 或对手在远处，我们气充足，可以出其不意。
- 迎击对手 beam。
- 但风险大，建议在对手倒地或硬直时使用。

#### dash 使用
- dash_back 用于逃离对手近身或气功波。
- dash_forward 用于快速接近并穿身，可能制造机会。但消耗16气。

我们需要将以上整合成决策逻辑。可以构建一系列条件优先级。

考虑到无法精确模拟，我们可以采用基于优先级的反应式 AI，加上一些随机扰动。

下面开始设计具体的 decide 函数。

### 顶层变量

我们可能需要记录：
- 本局内对手使用的动作次数，用于简单建模。
- 上次自己的动作时间。
- 是否在连招中。
但 state 已经提供很多信息。我们可以减少历史依赖，纯反应式更安全。

### 实现细节

`decide(state)` 返回字符串。

如果 `state.clash` 存在：
- 使用 push 策略。

如果 `state.me.canCancel`：
- 处理连招。

否则，me 应该是 free（如果 me.state 是空闲之一）或可能其他（但在非空闲时不会被调用，除了 cancel/clash）。

#### canCancel 处理
```
if (state.me.canCancel) {
  const chain = state.me.chain;
  const dist = state.dist;
  if (chain < 3 && state.opp.state === 'hitstun') {
    // continue light if likely to hit
    // if dist > 110 maybe too far? but we can still try heavy if reach
    return 'light';
  } else {
    // try heavy if reach, else blast or light
    if (dist <= 140) return 'heavy';
    else if (chain < 4) return 'light'; // maybe extend
    else return 'heavy'; // or blast?
  }
}
```
但注意 canCancel 时对手处于 hitstun，我们应判断对手剩余硬直是否足够。state.opp.left 是剩余 tick。如果 left >= 9（heavy 启动），heavy 可接；如果 left < 9，可能来不及。light 启动5，需要 left >= 5? 判定在启动后 active 3，实际需要 left >= 5? 对手硬直期间如果我们开始 light，判定在5 tick后，若 left >=5 即可，实际上需要 left >= 5+? 但 light 启动5，击中可能在 active 第一 tick（t=5）? 判定在 startup 结束后 active 期间（t=5,6,7），所以最早在5 tick后命中。对手需仍硬直到那时。所以如果 left >= 5，light 可以。但若 left <5，任何招都来不及，只能放弃连招，返回 'idle' 之类（但 canCancel 返回别的就正常收招，我们可以返回 'heavy' 但可能被挡）。最好返回 'heavy' 或 'light' 赌运气。通常 left 会足够，因为硬直15，我们上一个 light 后额外调用在下一 tick，对手硬直剩余约14。

连招决策优化：
- 目标最大化伤害，同时确保命中。
- 我们可以选择：前几次 light 然后 heavy 收尾。
- 当 chain < 3 时继续 light；当 chain >= 3 时接 heavy。
- 但伤害优化：3 light + heavy = 164；4 light 才 120。所以尽早接 heavy 更好？ 2 light + heavy = 40+32+78=150； 3 light + heavy = 40+32+26+66=164； 4 light = 120。所以至少 3 light + heavy 最大。但 chain 计数：第一次 light 是 chain=1? start 时 chain = 1（如果非 chained）或 chain+1。在 canCancel 时 state.me.chain 表示这一串已经出了几拳。第一次 light 后 canCancel，chain=1。如果我们返回 light，chain=2。再次 canCancel chain=2。第三次 light 后 chain=3。此时 canCancel，若接 heavy，总击数第4下。所以应该允许 chain 达到 3 再 heavy。即 cancel 时如果 chain < 3，返回 'light'；如果 chain >= 3，返回 'heavy'。但如果 chain=4 不能再 light，必须 heavy。所以这个逻辑没问题。但如果初始距离太远导致 light 命中后推开距离过大，heavy 可能超出 140。在 chain=3 时距离可能已经增加了 42（3次 light 推14），初始距离若 100，变得 142，可能刚好不够。我们可以在 chain=2 时就接 heavy? 2 light + heavy = 第3击，伤害 150，稍低但更安全。权衡：若 chain=2 且 dist > 115，可能下一次 light 会推的更远，导致 heavy 够不到，所以应提前 heavy。或者在 cancel 时判断 dist <= 125 (确保 heavy 能打到) 才继续 light，否则直接 heavy。

我们可在 canCancel 时用距离决定：
- 如果 chain < 3 且 dist + 14 < 140（即下一次 light 推后 heavy 仍够），继续 light；否则 heavy。
更简单：如果 chain < 3 && dist <= 120，继续 light；否则 heavy（如果 heavy 够，dist<=140）。如果 dist > 140，则继续 light 或 blast 以保持连段？但 heavy 不够，可以 blast（启动11，对手硬直剩余可能不够？如果 dist > 140 可能 light 后已推远，blast 飞行13，也许能到）。其实我们可以选择 blast 远程，但可能被挡。实用：if dist <= 140 heavy else light if chain <4 else blast。

另外需考虑对手 HP：如果 heavy 能 KO，提前 heavy。

我们将在 cancel 处理中实现。

#### clash 处理
```
// in decide, if state.clash
function decideClash(state) {
  const c = state.clash;
  const myKi = state.me.ki;
  if (myKi > 30 && (c.oppPower >= c.myPower - 0.1)) return 'push';
  return 'idle'; // not push
}
```
或许更激进：如果 c.pos > 0.5，push；如果 c.pos < 0.3 且对手力量弱，不 push。部位：pos 0 在我方，1 在对方。如果 pos > 0.5，说明撞击点偏向对手，对我们有利，我们可能不需要 push。若 pos < 0.5，偏向我们，需要 push。因此：
- if c.pos < 0.4 and myKi > 25: push
- else not push
还可以考虑力量差：如果 oppPower > myPower，即使 pos 居中，也可能推向我们，应 push。

简化：if (c.pos < 0.5 && myKi > 20) return 'push'; else 'idle'。

风险：如果对手不 push，我们 push 快速耗气，可能适得其反。但 pos<0.5 时如果不 push，可能被推。我们可以更精细：记录对手 push 行为。通过比较 oppPower 与由气和 HP 计算的基础力量（无 push）来推断对手是否 push。我们可以在顶层变量存储对手上次 power 和 our push 状态。

当 clash 活跃时，我们每6 tick 被调用。我们可以计算对手是否在 push：
- 对手当前 power 包含 push 加成0.6。我们可以计算对手基础力量（使用其 ki 和 hp）并与 oppPower 比较。但 state.clash.myPower/oppPower 已经提供。我们可以用公式：basePower = 1 + 0.02*ki + (hp<30%?0.4:0)，无气则0.5。如果 oppPower - basePower > 0.5，说明对手在 push。这样我们可以判断。
- 如果对手在 push，我们也 push 以免输。
- 如果对手不 push，我们可能不需要 push。但若对手力量仍高于我们，可能需要。
- 我们可以实现一个函数计算 power 用于比较，但 state.clash 已提供 oppPower，可以比较对手实际 power 与其基础 power 来确定 push。但 state.me/opp 的 hp/ki 可用。

不过 state.me.ki 和 opp.ki 在 clash 中能看到吗？state 里有 opp.ki。所以可以计算。

实现：
```
function decideClash(state) {
  const RULES = ...;
  const c = state.clash;
  const myKi = state.me.ki;
  const oppKi = state.opp.ki;
  const myHp = state.me.hp;
  const oppHp = state.opp.hp;
  const rage = hp => hp < RULES.clash.rageHp * RULES.hp ? RULES.clash.rage : 0;
  const basePower = (ki, hp) => (ki > 0 ? RULES.clash.base + RULES.clash.kiPower * ki : RULES.clash.empty) + rage(hp);
  const oppBase = basePower(oppKi, oppHp);
  const opponentPush = c.oppPower > oppBase + 0.3; // threshold due to rounding
  const myBase = basePower(myKi, myHp);
  // If I'm behind, push
  if (c.pos < 0.4 || (c.oppPower > c.myPower && myKi > 20) || (opponentPush && myKi > 20)) return 'push';
  // if opponent pushing and I have ki, push to match
  // else not push
  return 'idle';
}
```
但注意 power 有浮点，state 中 myPower/oppPower 是 r1 四舍五入到一位小数，所以可能会有误差。我们可以容忍。

也许更简单的策略：始终 push 直到气低于 25，然后不 push。因为 push 增加力量，可能赢得对冲。但若对手也始终 push，则力量差由气决定，气消耗快，低气时无气力量0.5。可能变成冲刺后无气，失败。需要权衡。

对冲赢的收益是320伤害+击倒，输则自己受320。如果气量足够，push 是值得的。

我们可以采用模拟预判：在 clash 中，由于随机噪声，位置有波动。唯一可控是 push。我们可以根据当前 pos 趋势决定。如果 pos 接近 0.3（偏向我们），push；如果 pos 接近 0.7（偏向对手），不 push。气量管理：保留至少20气用于之后。

我们暂定：
- 如果 myKi < 10：不 push（节省）。
- 若 c.pos < 0.3：push（急需扭转）。
- 若 c.pos > 0.6：不 push。
- 否则如果 oppPower >= myPower，push；否则不 push。

#### 空闲决策：需要一个更系统的策略。

我们可以将空闲决策分为几个子函数：

1. 如果对手正在使用 beam（startup/firing）：
   - 应对 beam 优先。
2. 如果对手处于 hard CC（hitstun/blockstun/crushed/down）：
   - 利用机会。
3. 处理 incoming blasts。
4. 如果对手在出招（light/heavy/blast）的 startup/recovery：
   - 反击或闪避。
5. 一般距离策略。

让我们逐块设计。

##### 1. 应对对手 beam
- 当 opp.state === 'beam'。
- 如果 opp.phase === 'startup'：
  - 若 dist <= 115（light reach），我们可以 light 打断。但需注意对手 startup 可能已经进行了几 tick（opp.t），剩余 startup = (opp.phase === 'startup' ? (opp.su? state 中 phase 只有 startup, firing, recovery; opp.t 是状态已持续 tick，left 是剩余 tick）。state.opp.left 在 startup 阶段表示剩余 startup? 根据 view 函数： left: a.dur ? a.dur - a.t : 0。对于 beam startup，a.dur = a.su + fire + recovery。所以在 startup 阶段 left 是整个 beam 剩余总 tick，不是仅 startup 剩余。这有点不方便。但 state.opp.t 和 phase 提供了当前阶段已持续时间。我们可以用 phase 和 t 判断。我们知道 beam startup 总长可以用 RULES.beam.startup 或 counterStartup。我们不知道对手的 su 是30还是12。但 state.opp.t 在 startup 阶段从0开始，所以剩余 startup = (beam startup 总长 - t) = 30 - t? 实际上 su 可能不同。我们无法直接知道 su，但大多数情况如果对手不是迎击，su=30。我们可以保守估计：如果 opp.t < 20，足够我们 light 打断。
  - 如果距离 >115，我们可能无法快速打断。可以选择 dash_forward 快速接近（10 tick 移动200，前8无敌）但注意 beam 启动可能在 dash 期间发射，dash 无敌可以穿过，但落地后 face。
  - 或者如果我们的气 >=50，使用 beam 迎击（aimed）。这可以导致对冲，不一定输，且可以阻止对手 beam。
  - 或者 dash_back 拉开距离，然后格挡/闪避。
- 如果 opp.phase === 'firing'：
  - 检查我们是否在光束路径中。beams 数组中有对手的 beam 信息：from, front, dir。我们可以计算我们身体（x）是否在覆盖范围内。但 state.me.x 已知，我们可以判断是否在 inRay。
  - 如果我们在光束路径中且距离近，我们可能很快会被打中。可以格挡（如果气够15），但 chip 160 很大。或者 dash 试图无敌穿过/闪避。但若对手 beam 正在发射，dash 前8无敌，dash_forward 可能穿过光束，dash_back 可能逃离前端。需要计算落点。
  - 简化：如果对手 beam firing 且 dist > 200，可能还没覆盖到我们，我们可以 dash_back 远离。如果已经覆盖，可能已经被打中（但在空闲时我们还能行动，说明还未被打中）。我们可以在此时用 dash_back（前8无敌）逃脱。如果距离近，dash_forward 可能穿过对手身后避开光束。
  - 若气足够且想迎击，可能已经来不及（如果对手已经在 firing，我们 start beam 会 12 tick 后发射，进入对冲）。可以迎击。
- 如果 opp.phase === 'recovery'：对手在收招，我们可以接近攻击。

beam 处理优先级高，因为伤害高。

##### 2. 利用对手硬直/倒地
- 如果 opp.state === 'hitstun' 或 'crushed' 或 'blockstun'：
  - 如果我们可以攻击（距离）。
  - 对于 hitstun（轻拳造成）持续15，通常我们自身可能在收招。如果我们空闲，距离可能因 push 而改变。
  - 我们选择最大化伤害：
    - 如果距离 <=110：使用 light 开始连招（因为 light 启动快，命中后可以 cancel）。
    - 如果距离 >110 且 <=140：使用 heavy（启动9，可击倒）。
    - 如果距离 >140：使用 dash_forward 接近（消耗16）或 blast（若距离允许？ blast 飞行13，但对手硬直可能结束）。如果对手硬直剩余足够，blast 可能命中，但飞行时间可能导致错过。保守前进。
  - 注意轻拳起手后可以连招。
- 如果 opp.state === 'down'：
  - 对手无敌，我们可以蓄气（charge）或准备。
  - 如果气低（<80），charge 是好的。
  - 如果气高，可以 forward 缩短距离至 heavy/light 范围，以便对手站起时攻击。
  - 计算对手 down 剩余：opp.left（state.opp.left 是剩余总 tick）。如果 opp.left > 20，charge；如果 10 < opp.left <= 20，前进到合适距离；如果 opp.left <= 10，我们可以开始攻击（light 或 heavy）以便在对手站起时判定。
  - 具体：heavy 启动9，如果我们希望对手刚刚站起时 active，我们应在对手 left ≈ 9 时启动 heavy。但决策每6 tick，我们可以在 left <= 12 时启动 heavy。
  - 如果我们在对手 down 时选择 light，启动5，可以在 left <= 5 时启动，但 light 连招需后续。也许蓄气更安全。
  - 因为 down 期间蓄气无风险，可优先回气。

##### 3. 处理 incoming blast
- state.blasts 数组中 incoming 表示对手的气功波正朝我们飞来。eta 是还有几 tick 碰到身体。
- 我们可以选择：
  - 格挡（guard）：需要气足够支付6，且 guard 可以挡正面。
  - 后退/前进闪避：气功波速度13，我们移动可能闪避？横版，气功波沿直线，我们只能前后移动，很难闪避，除了 dash 无敌。
  - dash_forward/back：无敌8 tick 可以穿过，但 timing 需要 eta 在8以内。
  - 如果气功波很快到达（eta <= 8），dash 可能穿过；否则 dash 后可能仍被击中（但 dash 前8无敌，若 eta >8，结束时波还没到，之后会打中）。
  - 也许用格挡更可靠。
- 如果 incoming blast，且我们处于空闲：
  - 如果 myKi >= 6：guard 格挡（消耗6气，chip 12）比硬吃60好。
  - 如果 myKi < 6：格挡会破防（掉12+晕34），很糟糕。可以选择 dash 闪避，希望避开。
  - 也可以尝试 dash_forward 穿过气功波躲避并接近对手。
- 注意气功波被挡后对手可能快速接近，我们在 blockstun 14 tick。

##### 4. 对手在出招（startup/recovery）
- 若 opp.state 是 'light' 或 'heavy' 或 'blast' 且 phase 为 startup/recovery。
- 我们可以利用 counter 攻击。
- 若距离合适，用 light 打断（light 启动5）。
- 但如果我们在对手 recovery，他们可能已经完成攻击动作但硬直，我们可以攻击。
- 若对手是 heavy startup，light 可打断，但若距离在 heavy 范围，我们 light 启动5能打中，对手 heavy 判定在9，所以我们会先命中，造成 counter 1.25 并且打断 heavy。
- 若对手 blast startup，light 可打断。
- 若我们距离较远，无法攻击，可前进或发气功波。

##### 5. 一般距离策略（对手空闲或移动）

我们需要一个稳健的中立策略。

- 远距离（dist > 160）：
  - 优先蓄气（如果气 < 80）或发气功波（如果气 > 30 且场上无我方 blast）。
  - 也可以前进缩短距离。
  - 如果对手在 charge，发气功波造成1.5倍伤害。
- 中距离（dist 在 110-160）：
  - 如果对手在 charge，使用 dash_forward 接近并 light/ heavy 打断。
  - 如果对手在 advance，准备 light 或 heavy。
  - 可以使用 heavy 远距离打击。
  - 或前进。
- 近距离（dist <=110）：
  - 优先 light 试探。若对手 idle/前进，light 可能命中。若对手 guard，light 被挡消耗对手气，我们回气，不差。
  - 若对手气低（<4），light 被挡可能破防，获得巨大优势。
  - 也可以 heavy 破防，但可能被 light 打断。权衡：如果对手不频繁攻击，heavy 可能奏效。随机化：以一定概率选择 heavy（比如 20%）。
  - 如果对手在 charge 近距离，立即 light 或 heavy 造成1.5倍伤害。
  - 如果对手 hp 低（<120）且距离 <=140，heavy 可终结。

### 资源管理

气量：
- 保持至少 14 气可用于 blast，16 用于 dash，50 用于 beam。
- 如果气 < 20，倾向于 charge（在安全距离）或 forward（可回气+接近）。
- 蓄气时如果对手靠近，注意安全距离。

### 应对不同对手

我们可加入一些随机性，避免过于可预测。例如：
- 近距离时以 70% 概率 light，20% heavy，10% guard/back 等。
- 远距离时以 70% 概率 charge，20% blast，10% forward。
- 随机性可让对手难以适应。

但过度的随机会导致不稳定。我们需要既定战略但有些变化。

### 可能的隐藏优势：利用 dash_forward 穿身

dash_forward 可以瞬间穿越对手，落地在身后。如果对手防御正前方，我们可以从背后攻击。但落地后收招8 tick 面向原方向，对手若空闲会转身，所以我们不能立即攻击背后。但 dash 可以用于躲避气功波或突然接近。

在近距离，dash_forward 可以穿过对手拉开距离，或绕后。但消耗16，不划算。

### 编写代码

由于不能访问 `RULES` 之外的全局变量，但规则书说全局变量 `RULES` 里有数值。我们可以在代码中使用 `typeof RULES !== 'undefined' ? RULES : ...` 但直接使用全局 RULES 是可以的。

我们提交的 js 文件顶层代码每局开始时执行一次。我们可以定义辅助函数，以及状态变量。

需要注意：顶层代码不能每次 decide 调用重新初始化变量，除非有意图。如果要记住一局内历史，需放在顶层变量中但不要每次调用重置。

我们可以使用一个立即执行函数？但简单起见，直接定义常量 `const R = RULES;` 等。顶层代码执行时 RULES 已定义。

我们需要确保不在 decide 内使用重型计算。

可能的状态变量：
- `let history = [];` 记录对手决策历史，用于简单分析。
- 但我们不应该让 history 无限增长，600次调用最多，可以存。

我们可以存储：
- `let myLastAction = null;`
- `let oppActions = { light:0, heavy:0, blast:0, beam:0, dash_forward:0, dash_back:0, guard:0, charge:0, forward:0, back:0, idle:0 };`
- 在每次 decide 时，我们可以从 state.opp.state 推断对手当前动作（如果空闲中）。

但可能不需要复杂历史。我们可以实现一个简单统计：记录对手出招频率，用于调整。

不过，为了简化，我们先做纯反应式 AI，然后考虑是否加入自适应。

### 细节：state 中 opp.state 是当前状态。如果对手在空闲，opp.state 是其保持的状态（idle/forward/back/guard/charge）。如果对手在出招，opp.state 是 light/heavy/blast/beam/dash 等。我们可以据此判断对手动作。

### 写一个 `decideFree` 函数

以下伪代码：

```js
function decideFree(state) {
  const me = state.me, opp = state.opp;
  const dist = state.dist;
  const myKi = me.ki, oppKi = opp.ki;
  const myHp = me.hp, oppHp = opp.hp;
  const oppFree = opp.free; // boolean
  const oppPhase = opp.phase;
  
  // 1. If opponent beam startup/firing, handle
  if (opp.state === 'beam' && (oppPhase === 'startup' || oppPhase === 'firing')) {
     // ...
  }
  
  // 2. If incoming blast
  if (state.blasts.some(b => b.incoming)) {
     // ...
  }
  
  // 3. If opponent in a vulnerable state
  if (opp.state === 'hitstun' || opp.state === 'crushed' || opp.state === 'blockstun') {
     // attack
  }
  if (opp.state === 'down') {
     // charge or prepare
  }
  
  // 4. If opponent in startup/recovery of a move
  if (['light','heavy','blast'].includes(opp.state) && (oppPhase === 'startup' || oppPhase === 'recovery')) {
     // counter attack
  }
  
  // 5. Neutral based on distance
}
```

#### 应对 incoming blast
```js
if (state.blasts.some(b => b.incoming)) {
  const incoming = state.blasts.find(b => b.incoming);
  if (incoming.eta <= 6 && myKi >= 16) return 'dash_forward'; // dash through
  if (myKi >= 6) return 'guard'; // block it
  // low ki, try dash or back
  return 'dash_back';
}
```
但 dash_forward 消耗16，可能不值。guard 消耗6，chip 12。如果 eta <= 8，dash 无敌期间穿过；但 dash_forward 穿越对手可能改变位置。如果对手 close，dash_forward 可接近并穿过对手身后，可能发起攻击。但 dash 后收招8，可能被对手攻击。

其实格挡是更稳的选择，除非气不足。

我们可以根据气量决定：
- 若 myKi >= 6：guard。
- 否则如果 myKi >= 16：dash_forward（无敌穿越）。
- 否则后退（可能被击中，但没气没法）。

但气功波伤害 60，硬直20，如果没气，被击中很糟糕。dash_forward 需16气，若气不够不能执行（会被忽略，继续 idle），所以我们返回的 dash_forward 若无效会 idle 等待被打。所以低气且 incoming 是紧急，我们没有好办法。也许选择 back 躲远，但气功波速度13，我们的后退3/tick，eta 可能 5，逃不掉。所以最好积累足够气避免这种局面。

#### 应对对手 beam
我们细化：
```js
if (opp.state === 'beam' && oppPhase === 'startup') {
  if (dist <= 115 && opp.t < 22) return 'light'; // interrupt
  if (myKi >= 50 && oppPhase === 'startup') return 'beam'; // counter
  if (myKi >= 16) return 'dash_back'; // get away
  return 'back';
}
if (opp.state === 'beam' && oppPhase === 'firing') {
  // if we are in ray, try dash or guard
  const ray = state.beams.find(b => !b.mine);
  if (ray) {
    const myX = me.x;
    const lo = Math.min(ray.from, ray.front), hi = Math.max(ray.from, ray.front);
    const inRay = myX >= lo && myX <= hi;
    if (inRay) {
       // already in beam, but not hit yet? Actually if we are in ray and free, the beam would have hit us at some point, but we may be called before it hits? If we are in ray, next tick might hit. We can dash to escape.
       if (myKi >= 16) return 'dash_back';
       if (myKi >= 15) return 'guard'; // block chip 160
       return 'dash_back'; // even if not enough? guard would be better if can pay, but if ki <15 guard may be crushed.
    } else {
       // not in ray yet, can move away or dash
       if (dist > 200) return 'back';
       else return 'dash_back';
    }
  }
  // if no ray data, assume not in ray
}
```
但注意 `dash_back` 消耗16，若 ki 不足会无效。我们需检查 ki >=16。

如果对手 beam 朝向不是我们（比如对手背向？但会自动面向，所以 beam 朝我们）。通常 beam 会朝我们。

若我们选择 beam 迎击，start 会处理 aimed 逻辑，可能同时发射或12 tick后。这可以导致对冲，可能不错。但消耗50，需要足够气。如果我们气高，可以。

#### 应对对手出招 startup/recovery
```js
if (['light','heavy','blast'].includes(opp.state) && (oppPhase === 'startup') && dist <= 115 && opp.t < 3) {
  return 'light'; // interrupt
}
if (['light','heavy','blast'].includes(opp.state) && (oppPhase === 'recovery') && dist <= 140) {
  return 'light'; // punish recovery
}
```
但对手 light startup 只有5 tick，我们决策每6 tick，可能错过。若我们在空闲时对手刚开始 startup，我们可能在同一 tick 决策，可以 light 打断。若对手已经 startup 多 tick，我们 light 可能来不及。不过 light 启动5，如果对手 startup 还剩至少5，我们就能打断。我们可以用 opp.left? 但 left 是整个动作剩余，不精确。可以粗略用 opp.t 判断：对于 light startup，如果 opp.t < 2，我们 light 可能打断；对于 heavy startup，如果 opp.t < 5，light 可以打断；对于 blast startup，如果 opp.t < 6，light 可以打断。可采用宽松。

如果对手在 recovery，我们攻击通常安全，因为他们不能反打。

#### 利用对手 hitstun/crushed/blockstun
```js
if (opp.state === 'hitstun' || opp.state === 'crushed' || opp.state === 'blockstun') {
  if (dist <= 110) return 'light'; // start combo
  if (dist <= 140) return 'heavy'; // heavy
  // if too far, approach
  return 'forward';
}
```
对于 crushed，对手眩晕34，我们可以用 heavy 造成大伤害并击倒。但 heavy 启动9，可接。如果距离远，可以 forward。注意 crushed 时对手不能格挡，heavy 必中，伤害120并击倒，然后我们可以继续。

#### 对手 down
```js
if (opp.state === 'down') {
  if (opp.left > 25) return myKi < 90 ? 'charge' : 'forward';
  if (opp.left > 12) {
    // position ourselves in range
    if (dist > 130) return 'forward';
    else if (dist > 110 && dist <= 140) return 'idle'; // wait
    else return 'back'; // if too close, back off
  } else {
    // opponent about to rise, start attack
    if (dist <= 140) return 'heavy';
    else return 'forward';
  }
}
```
需注意 if too close (<60 min gap), dist won't be <60. 如果 dist 太近，后退可能慢。

#### 中立策略（对手 free）

我们使用距离划分：

- dist > 200:
  - if myKi < 80: return 'charge';
  - else if no my blast on screen: return 'blast';
  - else return 'forward';

- dist between 140-200:
  - if myKi < 40: return 'charge'; // 蓄气
  - else if no my blast: return 'blast';
  - else return 'forward';

- dist between 110-140:
  - if myKi < 30: return 'forward';
  - else if opp.state === 'charge': return 'heavy' or 'light'? 距离 110-140，heavy 可打中；opp 蓄气受到1.5伤害，heavy 伤害120*1.5=180，非常可观。但 heavy 启动9，对手可能反应。但对手在 charge，可能不会立即防御。可以 heavy。
  - else return 'heavy'; // heavy safe because light out of range
  - but risk opponent forward into light and light beat us. Could randomize.

- dist <= 110:
  - if opp.state === 'charge': return 'light' (fast, 1.5 damage => 60)
  - if oppKi < 4: return 'light' (block will crush)
  - if oppHp < 120 && dist <= 110: return 'heavy' (finish)
  - default: 
     - 60% light
     - 25% heavy
     - 10% guard or back
     - 5% dash_forward (surprise)
  - Use Math.random to decide.

当对手 guard 时：
- 如果我们在近距离，对手 guard，heavy 可破防。但 heavy 可能被对手 light 打断（如果对手取消 guard 用 light）。但对手在 guard 状态时决策也是同时的，如果对手选择变招，可能 light。我们可以用 heavy，但风险。可以随机 heavy 或 light。
- 如果对手气低，light 被挡可破防，很有利。

可能需要更精细的概率。

### 适应对手

我们可以统计对手在近距离时选择 guard 的频率，如果对手经常 guard，我们增加 heavy 比例。但这需要历史。我们可以维护 `oppFreeState` 在每次 decide 时记录对手 state。但这不一定必要。

也许保持随机即可。

### 气功波的使用

在远距离，使用 blast 很不错。但要确保我方没有 blast 在场。state.me.blastOut 指示我方气功波是否在场。如果 blastOut 为 true，不能再发。

使用 blast 的时机：
- 远距离且对手没有防备（如 charge）。
- 对手气低时，逼其破防。
- 对手正在移动，气功波可能命中。

但如果对手是高手，会格挡，但我们消耗其气，自己回气。总体来说划算。

### dash 的使用

- 当对手发起气功波，我们可以 dash_forward 穿过气功波接近对手。
- 当对手 beam 发射，dash 可能逃生。
- 在近距离，dash_forward 可以穿到身后，可能打乱对手。

但 dash 消耗16，不应滥用。

### beam 的使用

- 对手 HP 低且距离远，我们气 >=50，可以 beam 终结。但风险大。
- 对手 beam 迎击时，我们 beam。
- 对手倒地且我们气充足，可蓄气。

### 针对性的优化：利用轻拳连招

我们应确保在轻拳命中后 canCancel 尽量打出高伤害。上面已设计。

### 测试思路

虽然不能运行，但我们可以思考一些匹配场景。

例如对手是简单防御型，总是 guard 和 charge。
- 我们远距离蓄气，发 blast 消耗其气。当其气低时，blast/light 破防，然后连招。
- 如果对手一直 guard，heavy 可以破防。

对手是攻击型，频繁 light。
- 我们可以保持距离，用 blast 或 heavy 反击。或在近距离与其拼 light，因为我们的连招更优。

对手是 beam 流。
- 我们需 dash 躲避，或迎击。

对手是 dash 流，瞬移穿身。
- 我们的防守可能需要注意身后，格挡只挡正面。如果对手 dash_forward 到身后，格挡无效。但我们可以在对手 dash 后迅速转身（空闲自动转身），所以问题不大。

### 潜在的 exploit：关于 push 消耗

对冲中 push 策略可能影响胜率。我们需认真设计。

假设双方 beam 对冲，每6 tick 调用一次。力量公式：
- 基础力量 = 1 + 0.02 * ki (ki > 0) 或 0.5 (ki=0)
- push 加 0.6
- 濒死加 0.4

如果双方都 push，力量差异由 ki 和 HP 决定。初始 ki 可能不同。气消耗相同：每 tick 0.2+0.6=0.8。从 50 气开始，可以维持 62 tick。如果双方 ki 相近，位置随机游走。如果没有 push，消耗慢，可以持续 250 tick。

我们希望在合适时机 push 以赢得对冲。一个简单有效策略：**总是在气量高于阈值时 push**，以尽快赢得对冲，因为赢的收益巨大。但如果对手不 push，我们 push 会更快耗尽气，但力量增加0.6，可能推动位置，赢得更快。一旦赢得，我们可以打掉对手320 HP。即使我们耗尽气，只要在耗尽前赢得就行。通常初始双方气30，如果对手不 push，我们 push 力量 = 1 + 0.6 + 0.6 = 2.2 (假设), 对手力量 = 1.6。差距0.6，乘以 drift 0.1 => 每 tick 0.06 速度，加上 noise。撞击点初始 0.5，要推到 1 需要 0.5，大约 8 tick？但噪声影响。实际上加力可能有效。但若对手也 push，则看气量。我们 push 时气消耗快，可能后劲不足。但也许尽早 push 能在气耗尽前结束。

我们可以动态调整：如果对手 push，我们也 push；如果对手不 push，我们可以不 push 以保存气，但可能无法赢得对冲。对冲结果不是赢就是输或时间到平分（双方掉120）。如果双方都不 push，位置随机游走，可能拖到 360 tick，双方各掉120。这比输掉好。如果对方推，我们若不推，位置会被推过来，可能输掉。所以需要判断对手是否推。

我们可以在 clash 中根据 oppPower 判断对手是否 push。如果对手 push，我们也 push；如果对手不 push，我们也不 push，除非我们有明显气量优势（>20）。

具体实现：
```js
function decideClash(state) {
  const c = state.clash;
  const me = state.me, opp = state.opp;
  const myKi = me.ki, oppKi = opp.ki;
  const R = RULES;
  const rage = hp => hp < R.clash.rageHp * R.hp ? R.clash.rage : 0;
  const basePower = ki => ki > 0 ? R.clash.base + R.clash.kiPower * ki : R.clash.empty;
  const oppBase = basePower(oppKi) + rage(opp.hp);
  const myBase = basePower(myKi) + rage(me.hp);
  const oppPush = c.oppPower > oppBase + 0.25; // rounded to 1 decimal, but power uses floats; 0.6 so threshold 0.3
  const myPush = c.myPower > myBase + 0.25;
  
  // if I'm currently pushing (from previous decide), continue if still have ki and not clearly winning
  if (myPush && myKi > 15) {
    if (c.pos > 0.7 && c.oppPower < c.myPower - 0.3) return 'idle'; // can afford to stop
    return 'push';
  }
  // if opponent pushing, match it
  if (oppPush) {
    if (myKi > 20) return 'push';
    else return 'idle'; // can't sustain
  }
  // neither pushing
  // if we have a substantial ki advantage and can push to win quickly
  if (myKi > oppKi + 15 && myKi > 30 && c.pos < 0.6) return 'push';
  // if we are losing position, push
  if (c.pos < 0.35 && myKi > 20) return 'push';
  return 'idle';
}
```
这个逻辑较合理。

### 其他细节

#### 对手 HP 低，我们如何终结
- 如果 oppHp <= 60，light 即可 KO。
- 如果 oppHp <= 120，heavy 或 blast 可 KO。
- 如果 oppHp <= 280，beam 可 KO，但风险。
- 如果对手在格挡，heavy 破防造成 60，可能 KO。
- 我们可以根据 HP 选择攻击。

#### 我方 HP 低，濒死爆发
- 回气 1.5 倍，但我们仍需谨慎。

#### 格挡的使用
- 当对手在场上有气功波 incoming 时，guard。
- 当对手近身攻击而我们无法躲开，guard 也许比挨打强（轻拳被挡消耗4气，chip 0? 轻拳被挡没有伤害，只消耗气，比直接受伤好）。但格挡状态下每 tick 减0.03气，且对手可能 heavy 破防。如果预计对手用 light，guard 是好的。如果预计对手用 heavy，guard 会掉60+晕，很糟糕，应该避免。
- 因此，不轻易使用 guard，除非对手有 incoming blast 或 beam（chip 大但总比直接受伤好）。近距离，guard 可能被 heavy 利用。我们可以用 back 闪避。

### 对手分析：其他 AI 可能使用相似策略

我们需要尽可能利用规则漏洞：
- 轻拳连招的伤害很高，应该主动寻找机会。
- 重击破防是强项。
- 气功波消耗对手气。
- dash 无敌可躲避。

也许可以设计一个更激进的战术：**近距离无限轻拳压制**。因为轻拳启动5，恢复9，命中后 canCancel 可继续，若对手不格挡，可以持续连击直到 4 次 light 后接 heavy，造成约 164 血。如果对手格挡，我们被挡后双方硬直（我们恢复9，对手 blockstun 11），我们恢复更快，可以重新获得先机。利用轻拳被挡没有不利，反而消耗对手气，我们回气。所以近距离频繁 light 是相对安全的。

**战术：推进到近距离，然后反复使用 light**。如果对手格挡，他掉气，我们回气；如果对手不用格挡而想 attack，我们 light 启动快，可能抢占先机或互中。如果对手 heavy，我们 light 更快打断。如果对手 dash 等，我们也可以应对。这个策略可能很强。

但需要注意的是，格挡状态下对手每挡一下掉4气，我们回3气。如果我们连续 light，对手气会逐渐耗尽，最终破防，我们就能连招。所以对防御型对手，近距离 light 压制是有效的。

因此，我们的中立近距离策略应偏向 light 压制，而不是 heavy（heavy 风险高，被闪避后破绽大）。我们可以降低 heavy 使用频率，仅当对手气低、HP 低或对手在 charge/down 时使用。

### 进一步优化：距离管理

我们希望将距离控制在自己的攻击范围内，同时避免对手更长的 reach。light reach 110，heavy 140。如果我们保持距离在 90-110，只能用 light 攻击，对手 light 也能，但我们可以利用帧优势。如果对手后退，我们前进；如果对手前进，我们可能进入 heavy 范围，需要小心。

### 针对对手 charge

对手蓄气时受击伤害 1.5 倍。如果我们看到 opp.state === 'charge'，应积极攻击。距离允许时用 light 或 heavy。如果距离远，dash_forward 接近或 blast。

### 针对对手 forward

对手前进时可能想接近。我们可以后退保持距离，或者用 light 迎击（如果距离近）。后退时气减少，但能保持距离。

### 综合决策流程

为了代码清晰，我们按以下顺序：

1. clash
2. canCancel
3. incoming beam/beam startup handling
4. incoming blast handling
5. opponent in hard CC (hitstun/blockstun/crushed/down)
6. opponent in startup/recovery
7. neutral

我们先写辅助函数，例如 `canAfford(action, ki)`。

注意：如果返回的动作需要消耗气而我们的气不够，动作无效，变成 idle。所以我们要确保有足够气。可以在决定时检查 `me.ki >= cost`。

### 实现中的细节：`state.me.free` 为 true 才可行动。在 decide 中如果 me.free 为 false 且无 cancel/clash，不应该被调用，但以防万一返回 'idle'。

### 测试连招逻辑

假设我们命中 light 后 canCancel：
- me.chain 可能为 1, 2, 3, 4。
- 若 chain < 3 且 dist <= 125，返回 'light'。
- 若 chain >= 3 或 dist > 125，返回 'heavy'（如果 dist <= 140 且气足够? heavy 无气耗）。如果 dist > 140，返回 'light' 或 'blast'。
- 但 heavy 若距离 >140 会 miss。我们可以通过继续 light 来拉近距离? light 会 push 对手更远，不能拉近。所以如果距离 >140，我们可能无法接 heavy。也许用 dash_forward 接近，但 canCancel 只允许 light/heavy/blast/beam，不能 dash。所以如果距离远，只能继续 light 或 blast。blast 飞行可能命中，但对手硬直可能结束。如果对手硬直剩余 tick 足够 blast 到达，我们可以 blast。blast 飞行13，距离 d，需要时间 ceil((d-30)/13) 等。若 d > 140，飞行时间可能 >10 tick，对手硬直15，可能刚好。但我们需考虑 blast 启动 11，总共 11+飞行，超过15，所以接不上。所以如果距离 >140，可能无法继续连击。但通常 light 命中后距离不会超过 110+14=124，在 heavy 范围内。除非之前已多次 light 推开。所以我们可以在 chain=2 时接 heavy 以避免太远。按之前的逻辑，chain < 3 且 dist <= 120 继续 light，否则 heavy。当 chain=2 时 dist 可能已经 110+14=124 左右，这时 dist > 120，直接 heavy。这样 2 light + heavy = 第3击，伤害 150。如果 initial dist 很小，可能 chain=3 再 heavy。我们可稍微调整：如果 dist <= 115 时才继续 light，否则 heavy。这样更多情况接 heavy 更安全。

我们最终 canCancel 策略：
```js
function decideCancel(state) {
  const me = state.me, opp = state.opp;
  const chain = me.chain;
  const dist = state.dist;
  if (chain < 3 && dist <= 115 && opp.state === 'hitstun' && opp.left >= 6) {
    return 'light';
  } else if (dist <= 140) {
    return 'heavy';
  } else if (chain < 4) {
    return 'light'; // maybe extend, but likely miss
  } else {
    return 'heavy'; // or blast
  }
}
```
但 `opp.left` 在 hitstun 中是剩余硬直 tick（因为 dur 等于 hitstun 长度）。若 opp.left >= 6，light 判定在5 tick后可以。若 left < 6，light 可能不够，但我们仍可 heavy（需9 tick，left 不足）。也许返回 'heavy' 赌对手硬直未结束。如果 hard read，可以返回 'heavy'。

### 对手在 `hitstun` 时我们进攻的决策

当我们空闲且对手 hitstun（例如我们之前 light 命中但未取消，或 blast 命中），选择攻击。
- 如果 dist <= 110，light 开始连招。
- 如果 dist between 110-140，heavy。
- 如果 opp.hp 很低，heavy 可能 KO。

### 对手 `crushed` 时
- 眩晕34 tick，我们可安全接 heavy（启动9，伤害120）然后击倒。但若距离远，可先 forward 靠近。如果距离 <=110，light 起手连招可能更高伤害：light 连招 3次 + heavy = 164，需要时间。但对手 crushed 34 tick，我们有足够时间完成一套连招吗？
  - 从我们可行动开始，如果选择 light，启动5，判定3，恢复9，总共17。命中后 canCancel 下一 tick，继续 light... 一套 3 light + heavy 总时间约：light(17) 但 canCancel 使得不用等收招。时间线：
    - T 开始 light，T+5 判定命中，T+6 额外决策继续 light，启动5 ... 假设连续，3 light 后 heavy。总时间 = 5 (第一 light startup) + 3 (active) 但 canCancel 在下一 tick，然后下一个 light startup 5 ... 实际上大约 5 + 5 + 5 + 9 = 24 tick 内完成 3 light + heavy 判定。adversary crushed 34，足够。
  - 伤害 164。如果直接用 heavy，伤害 120 * combo scale 1（因为对手可能 combo 计数? 之前气功波破防可能造成 chip 12，但不算 combo? 如果 crush 来自 heavy 被挡破防，chip 60 算 crush damage，可能伤害算在 combo? 不确定。但 heavy 120 可能更高如果是第一击。但 164 > 120。所以连招更优。
- 所以当对手 crushed 且距离 <=110，我们应 light 起手连招。
- 若距离 >110，可用 heavy 或 dash_forward。

### 对手 `down` 的陷阱：如果你在他起来前用 light，他可能格挡。但由于我们决策与他同时，他起来后如果选择 guard，我们的 light 被挡，消耗气。也许在对手 down 剩很少时用 heavy 破防（heavy 被挡掉60+晕），也不错。所以提前用 heavy 压制是可行的。

### 我们需要一些常数

直接从 RULES 中获取。可以定义：
```js
const R = RULES;
const LIGHT = R.light, HEAVY = R.heavy, BLAST = R.blast, BEAM = R.beam, DASH = R.dash;
```

### 写代码

确保没有语法错误。

### 最终代码结构

```js
// Global RULES is provided.
const R = RULES;

// Helper: cost of action (excluding free actions)
const COST = { blast: R.blast.cost, beam: R.beam.cost, dash_forward: R.dash.cost, dash_back: R.dash.cost };

function decideClash(state) { ... }
function decideCancel(state) { ... }
function decideFree(state) { ... }

function decide(state) {
  if (state.clash) return decideClash(state);
  if (state.me.canCancel) return decideCancel(state);
  if (!state.me.free) return 'idle';
  return decideFree(state);
}
```

### 细节：判断对手是否在 beam 且朝向我们

`state.beams` 包含正在发射的 beam 的 from, front, dir。如果对手 beam 发射中，我们可以检查 `state.beams.find(b => !b.mine)`。

但对手 beam 可能在 startup 还未出现在 beams 数组中（beam 在 t===su 时创建）。所以 beams 数组没有对方 beam 并非没有威胁。

如果对手在 beam startup，我们应响应。

### 在 decideFree 的开头处理对手 beam

```js
if (opp.state === 'beam' && opp.phase === 'startup') {
  if (dist <= 115 && opp.t < 20) return 'light'; // interrupt
  if (myKi >= 50) return 'beam'; // counter if enough ki
  if (myKi >= 16) return 'dash_back';
  return 'back';
}
if (opp.state === 'beam' && opp.phase === 'firing') {
  // check if we're in the beam
  const oppBeam = state.beams.find(b => !b.mine);
  if (oppBeam) {
    const myX = me.x;
    const lo = Math.min(oppBeam.from, oppBeam.front);
    const hi = Math.max(oppBeam.from, oppBeam.front);
    const inRay = myX >= lo - R.body && myX <= hi + R.body; // maybe hit area
    if (inRay) {
      if (myKi >= 15) return 'guard';
      else if (myKi >= 16) return 'dash_back';
      else return 'back';
    }
  }
  // not in ray
  if (myKi >= 16) return 'dash_back';
  else return 'back';
}
```

但 `guard` 对抗 beam 会 chip 160，消耗15气。如果气不足15，guard 会破防（chip 160 + 晕34），通常更糟。所以如气不足，尝试 dash。

### 处理 incoming blast

在 decideFree 中，检查 `state.blasts` incoming：
```js
const inc = state.blasts.find(b => b.incoming);
if (inc) {
  if (myKi >= 6) return 'guard';
  else if (myKi >= 16) return 'dash_forward';
  else return 'back';
}
```
但 dash_forward 前8无敌，如果 eta 较小（<=8）可以穿过。如果 eta >8，dash forward 穿过波后仍可能被身后波打？不会，若 dash forward 穿过，波已到身后，应该不会再命中。可以。

### 处理对手 hard CC

```js
if (opp.state === 'crushed') {
  if (dist <= 110) return 'light'; // start combo
  if (dist <= 140) return 'heavy';
  return 'forward';
}
if (opp.state === 'hitstun' || opp.state === 'blockstun') {
  if (dist <= 110) return 'light';
  if (dist <= 140) return 'heavy';
  return 'forward';
}
if (opp.state === 'down') {
  const left = opp.left;
  if (left > 20) {
    if (myKi < R.kiMax - 10) return 'charge';
    else if (dist > 130) return 'forward';
    else return 'idle';
  } else {
    if (dist <= 140 && left <= 12) return 'heavy';
    else if (dist > 140) return 'forward';
    else if (dist <= 110 && left <= 6) return 'light';
    else return 'idle';
  }
}
```

### 处理对手出招 startup/recovery

```js
if (['light','heavy','blast'].includes(opp.state)) {
  if (opp.phase === 'startup') {
    // try to interrupt if quick enough
    if (dist <= 115) {
      if (opp.state === 'light' && opp.t < 3) return 'light';
      if (opp.state === 'heavy' && opp.t < 6) return 'light';
      if (opp.state === 'blast' && opp.t < 8) return 'light';
    }
  } else if (opp.phase === 'recovery') {
    if (dist <= 110) return 'light';
    if (dist <= 140) return 'heavy';
    return 'forward';
  }
}
```
注意：state.opp.t 是状态已持续时间。对于 light startup，t 0-4。如果我们决定 light，启动5，判定在5 tick后。若 opp.t 比如 1，对手 light startup 还剩4 tick（到5启动，然后 active 3）。我们 light 判定在5 tick后，对手可能 active 或 recovery。若对手 light 也命中我们? 对手 light 判定在 startup 结束后 active 期间（t=5,6,7）。我们 light 判定也在 t=5,6,7。可能互中。counter 可能。但如果我们先判定? 同时。风险。若对手是 heavy，我们 light 判定在 t=5，对手 heavy 判定在 t=9，所以我们可以打断。所以针对 heavy 和 blast 用 light 打断更安全。

### 中立策略

```js
// neutral
if (dist > 160) {
  if (opp.state === 'charge') {
    if (myKi >= R.blast.cost && !me.blastOut) return 'blast';
    else return 'forward';
  }
  if (myKi < 70) return 'charge';
  if (!me.blastOut && myKi >= R.blast.cost) return 'blast';
  return 'forward';
}
if (dist > 140) {
  // range 140-160
  if (opp.state === 'charge') return 'dash_forward'; // or heavy?
  if (myKi < 40) return 'charge';
  if (!me.blastOut && myKi >= R.blast.cost) return 'blast';
  return 'forward';
}
if (dist > 110) {
  // mid range 110-140
  if (opp.state === 'charge') return 'heavy'; // guaranteed if charge? heavy can hit
  if (oppKi < 4) return 'blast'; // force crush
  if (myKi < 25) return 'forward';
  // try heavy with probability
  if (Math.random() < 0.4) return 'heavy';
  else return 'forward';
}
// close range <=110
if (opp.state === 'charge') return 'light';
if (oppKi < 4) return 'light';
if (oppHp < 120 && dist <= 110) return 'heavy';
// probabilistic
const r = Math.random();
if (r < 0.55) return 'light';
if (r < 0.8) return 'heavy';
if (r < 0.9) return 'back';
if (r < 0.95) return 'dash_forward';
return 'guard';
```

需要确保 dash_forward 消耗16，检查 myKi >=16，否则可能无效。heavy 无 cost，light 无 cost。

对于远距离，若 me.blastOut 为 true，不能再发 blast。我们检查 `!me.blastOut`。

### 修正：`state.me.blastOut` 表示我方气功波是否在场。在 view 函数中 `blastOut: m.blasts.some(b => b.owner === a.side)`。可用于判断。

### 针对对手 charge 时的攻击
- 对手 charge 时，伤害乘1.5。所以我们攻击收益高。但如果距离远，blast 可造成90伤害，比平时多。若对手 charge 且距离 >140，blast 不错。
- 若距离在 heavy 范围，heavy 可造成 120*1.5=180，非常棒。但 heavy 启动9，对手可能取消 charge 进行防御。但对手若在 charge 状态，决策同时，他可以选择改变状态。所以我们需预判。

### 确保返回的动作名有效

返回的字符串必须是 ACTIONS 之一。

### 性能

每个 decide 需要 O(1)，简单条件判断，满足时间限制。

### 测试极端情况
- me.ki 不足时返回 dash 会被忽略，可能导致错失。我们尽量检查。
- 返回 'push' 只在 clash 时有效。
- canCancel 时不能返回 'push' 或 'dash'，我们只返回 light/heavy/blast/beam。

### 进一步考虑：对手 dash 绕后

如果对手 dash_forward 穿越我们，落地后在我们身后，我们空闲会自动转身。但如果对手 dash 期间我们格挡，格挡只挡正面，可能无效。我们应避免在对手 dash 时一直格挡。如果对手在 dash（state 为 dash, phase moving），我们可能还没被绕后。我们可以选择 light 等。通常 dash 前8无敌，之后可以被打。对手 dash 中我们是空闲，可以尝试 light 攻击（如果距离近），但对手无敌时打不中，我们可能空挥。最好 back 或准备。

在 decideFree 中，对手 state === 'dash'。我们可以加入处理：
```js
if (opp.state === 'dash') {
  if (opp.phase === 'moving') {
    // opponent is dashing; they may be invulnerable
    if (dist <= 110) return 'light'; // could hit after invuln
    else return 'back';
  } else if (opp.phase === 'recovery') {
    if (dist <= 110) return 'light';
    else if (dist <= 140) return 'heavy';
    else return 'forward';
  }
}
```
但 dash 的 phase 是 moving 和 recovery。若对手 dash_forward 向我们冲来，我们 light 在 dash 前8 tick 无敌可能空，但如果 dash 结束我们仍可击中。风险。back 可能避免被穿过。

### 考虑对手 beam 释放时我们能否用 dash_forward 穿过并反击

若对手 beam firing，我们可以 dash_forward 向前穿越光束并接近对手，利用无敌前8。如果对手距离远，dash_forward 200 可能不够，但能缩短距离。

### 代码整理

现在开始编写最终的 JavaScript。

一些辅助函数：
```js
function canPay(ki, action) {
  const cost = action === 'blast' ? R.blast.cost : action === 'beam' ? R.beam.cost : (action === 'dash_forward' || action === 'dash_back') ? R.dash.cost : 0;
  return ki >= cost;
}
```

但我们在 decide 中直接比较。

### 可能的问题：`state.opp.left` 对于 down 等状态是剩余总 tick。对于 hitstun，left 是剩余硬直。对于 beam startup，left 是整个动作剩余，不是 startup 剩余。我们用 `opp.t` 和 phase 判断更可靠。

### 补充：对手 beam 迎击时，对手的启动可能是 12 tick（counterStartup）。我们有 state.opp.t 但不知道 su。不过对于打断，如果 opp.t < 10，light 可能来得及。我们可以简单判断 `opp.t < 12` 打断。

### 最终决策流程（伪代码细化）

```js
function decideFree(state) {
  const me = state.me, opp = state.opp;
  const dist = state.dist;
  const myKi = me.ki, oppKi = opp.ki;
  const myHp = me.hp, oppHp = opp.hp;
  const oppFree = opp.free;
  const oppPhase = opp.phase;
  const incBlast = state.blasts.find(b => b.incoming);
  
  // 1. Opponent beam
  if (opp.state === 'beam') {
    if (oppPhase === 'startup') {
      if (dist <= 115 && opp.t < 18) return 'light';
      if (myKi >= 50) return 'beam';
      if (myKi >= 16) return 'dash_back';
      return 'back';
    }
    if (oppPhase === 'firing') {
      const oppBeam = state.beams.find(b => !b.mine);
      if (oppBeam) {
        const lo = Math.min(oppBeam.from, oppBeam.front) - R.body;
        const hi = Math.max(oppBeam.from, oppBeam.front) + R.body;
        if (me.x >= lo && me.x <= hi) {
          if (myKi >= 15) return 'guard';
          if (myKi >= 16) return 'dash_back';
          return 'back';
        }
      }
      // not in ray
      if (dist > 140) return myKi >= 16 ? 'dash_back' : 'back';
      else return 'forward'; // maybe approach to hit
    }
    if (oppPhase === 'recovery') {
      if (dist <= 110) return 'light';
      if (dist <= 140) return 'heavy';
      return 'forward';
    }
  }
  
  // 2. Incoming blast
  if (incBlast) {
    if (myKi >= 6) return 'guard';
    if (myKi >= 16) return 'dash_forward';
    return 'back';
  }
  
  // 3. Opponent vulnerable states
  if (opp.state === 'crushed') {
    if (dist <= 110) return 'light';
    if (dist <= 140) return 'heavy';
    return 'forward';
  }
  if (opp.state === 'hitstun' || opp.state === 'blockstun') {
    if (dist <= 110) return 'light';
    if (dist <= 140) return 'heavy';
    return 'forward';
  }
  if (opp.state === 'down') {
    if (opp.left > 20) {
      if (myKi < 85) return 'charge';
      if (dist > 130) return 'forward';
      return 'idle';
    } else {
      if (dist <= 140 && opp.left <= 12) return 'heavy';
      if (dist <= 110 && opp.left <= 6) return 'light';
      if (dist > 140) return 'forward';
      return 'idle';
    }
  }
  
  // 4. Opponent in startup/recovery of a move
  if (['light','heavy','blast','dash'].includes(opp.state)) {
    if (oppPhase === 'startup') {
      if (dist <= 115) {
        if (opp.state === 'heavy' && opp.t < 5) return 'light';
        if (opp.state === 'blast' && opp.t < 7) return 'light';
        if (opp.state === 'light' && opp.t < 2) return 'light';
      }
    } else if (oppPhase === 'recovery') {
      if (dist <= 110) return 'light';
      if (dist <= 140) return 'heavy';
      return 'forward';
    } else if (opp.state === 'dash' && oppPhase === 'moving') {
      // opponent dashing, maybe invulnerable
      if (dist <= 110 && opp.t >= R.dash.invuln) return 'light';
      return 'back';
    }
  }
  
  // 5. Neutral
  if (dist > 160) {
    if (opp.state === 'charge') {
      if (myKi >= R.blast.cost && !me.blastOut) return 'blast';
      return 'forward';
    }
    if (myKi < 70) return 'charge';
    if (!me.blastOut && myKi >= R.blast.cost) return 'blast';
    return 'forward';
  }
  
  if (dist > 140) {
    if (opp.state === 'charge') return 'dash_forward'; // or heavy? if ki enough
    if (myKi < 40) return 'charge';
    if (!me.blastOut && myKi >= R.blast.cost) return 'blast';
    return 'forward';
  }
  
  if (dist > 110) {
    if (opp.state === 'charge') return 'heavy';
    if (oppKi < 4) return 'blast';
    if (myKi < 25) return 'forward';
    return Math.random() < 0.35 ? 'heavy' : 'forward';
  }
  
  // Close range
  if (opp.state === 'charge') return 'light';
  if (oppKi < 4) return 'light';
  if (oppHp < 120) return Math.random() < 0.7 ? 'heavy' : 'light';
  const r = Math.random();
  if (r < 0.5) return 'light';
  if (r < 0.75) return 'heavy';
  if (r < 0.88) return 'back';
  if (r < 0.95) return 'dash_forward';
  return 'guard';
}
```

### 优化：在近距离，heavy 可能被 light 打断。如果对手倾向攻击，我们 heavy 容易被打。可以观察对手前几 tick 是否攻击？我们无法知道对手选择。但可以在本局中统计对手在近距离使用 light 的频率。我们可以维护一个简单的计数器。

比如：
```js
let oppLightCount = 0, oppDecisions = 0;
```
在 decideFree 中，如果 opp.state === 'light' 时增加 count。但我们只能看到对手 state，在空闲时看到。这给不了决策历史。所以不做。

### 可能的使用 `state.opp.state` 来判断对手当前状态，在近距离如果对手 state 是 'idle' 或 'forward'，他们可能想等我们行动。我们 light 是安全。

### 关于 `oppKi < 4` 的判断：如果对手气低，我们 light 被挡会破防。但对手也可能不格挡而用攻击。我们 light 可能命中。总之 light 是好选择。

### 确保不因气不足返回无效动作

在 close range 返回 dash_forward 前检查 `myKi >= 16`，否则 fallback 到 light。我们可以使用 `canPay(myKi, 'dash_forward')`。

在远距离返回 blast 前检查 `myKi >= R.blast.cost && !me.blastOut`，已做。

在 down 返回 heavy/light 无 cost，没关系。

### 处理 `opp.state === 'beam'` 且 `oppPhase === 'startup'` 时，如果我们返回 'beam' 迎击，需要 myKi >= 50。如果 myKi 不到50，fallback。

### canCancel 中的 heavy/light 无需气。blast 需气14，beam 需气50。在 canCancel 中，如果我们选择 blast，需要检查 ki。通常不会选择 blast，除非距离远。但我们可以在 canCancel 中优先 heavy。

### 进一步思考：我们可以用 `state.me.chain` 来决定连招。但注意 chain 在非 light 招式后不会重置？在 `start` 中 `a.chain = act === 'light' ? (chained ? a.chain + 1 : 1) : a.chain;` 所以 heavy 不会重置 chain，会保持。但当 free 时 `free` 函数重置 chain=0。所以在 canCancel 时 chain 有效。我们在 canCancel 选择 heavy 后，chain 保持，但 heavy 击倒对手，我们之后 free 时 chain 重置，没问题。

### 对手在 `hitstun` 时，我们选择 light 开始连招。注意如果我们之前已经 light 命中但没 canCancel（不可能，我们总会 canCancel），否则会正常收招。所以空闲时对手 hitstun 可能是我们 blast 造成的，或者对方被第三方。我们 light 起手可取消。

### 需要考虑对手可能在 `hitstun` 结束后立刻格挡。所以我们攻击需确保在硬直内命中。

### 最终代码框架

我们提交的是一个 js 代码块。我们需要在代码块后面另起一行写“赛前宣言：...”。宣言20字以内。

宣言：例如“被动回气？不存在的，接招吧！”（14字）

### 检查代码语法

我们使用 `const R = RULES;` 这是顶层。我们需要确保 RULES 存在。在引擎中 RULES 是全局变量。代码中可以直接使用。如果担心未定义，可以 `const R = typeof RULES !== 'undefined' ? RULES : ...` 但规则书说全局变量 RULES 里有数值。我们可以直接使用。

### 可能的陷阱：Math.random() 在顶层调用会影响重放？但没关系。

### 另一个思路：预计算一些常量，避免在 decide 中反复访问 RULES。

### 代码可读性

我们可以在顶层定义一些辅助常量：
```js
const R = RULES;
const BLAST_COST = R.blast.cost;
const BEAM_COST = R.beam.cost;
const DASH_COST = R.dash.cost;
const LIGHT_REACH = R.light.reach;
const HEAVY_REACH = R.heavy.reach;
```

### 测试逻辑：对手在 guard 且距离 close
- 我们 close range 策略：r<0.5 light，r<0.75 heavy...
- 若对手 guard，light 被挡消耗对手4气，我们回3气；heavy 被挡破防。这样混合攻击给对手压力。
- 但我们未明确检查 opp.state === 'guard'。在 close range，如果对手在 guard，我们 heavy 破防收益大。可以增加 heavy 概率。
我们可以在 close range 分支中专门处理对手 guard：
```js
if (opp.state === 'guard') {
  if (myKi >= 4 && Math.random() < 0.6) return 'heavy';
  else return 'light';
}
```
如果在 close range 对手 guard，heavy 可破防，但 heavy 可能被对手取消 guard 用 light 打断。但概率。

我们可加入此逻辑。

### 对手在 `charge` 时我们 close range
- 我们 light 或 heavy。若距离 <=110，light 启动快，伤害1.5倍。应该 light。

### 在 mid range (110-140) 对手 guard 时，heavy 可破防。应该 heavy。

### 继续优化：在 close range，如果对手处于 `idle` 或 `forward`，他们可能准备发动攻击。我们 light 的快速攻击可压制。

### 最终决策树

我们整合 guard 处理。

### 可能的低估：使用 `dash_forward` 穿过对手，落地后立即攻击
- 在 close range，偶尔 use dash_forward 可以出其不意，但消耗16气，且收招8。在收招期间对手可能转身并攻击。所以不太有利。我们保持低概率。

### 结束

让我们写出最终代码。

注意：在 canCancel 中，如果我们返回 'heavy' 但距离 >140，会 miss。我们在返回 heavy 前检查 dist <= 140。如果 dist > 140，选择 light 或 blast。但 light 可能继续推开，更远。最好返回 blast（可能追上）。但 blast 启动11，可能来不及。也许返回 'heavy' 即使距离稍远，因为对手在硬直中可能被击中，且 heavy 判定范围140。我们按 dist <= 140 返回 heavy，否则 light。

### 完整代码

```js
const R = RULES;
const BLAST_COST = R.blast.cost;
const BEAM_COST = R.beam.cost;
const DASH_COST = R.dash.cost;
const LIGHT_REACH = R.light.reach;
const HEAVY_REACH = R.heavy.reach;

function canPay(ki, action) {
  if (action === 'blast') return ki >= BLAST_COST;
  if (action === 'beam') return ki >= BEAM_COST;
  if (action === 'dash_forward' || action === 'dash_back') return ki >= DASH_COST;
  return true;
}

function decideClash(state) {
  const c = state.clash;
  const me = state.me, opp = state.opp;
  const myKi = me.ki, oppKi = opp.ki;
  const myHp = me.hp, oppHp = opp.hp;
  const rage = hp => hp < R.clash.rageHp * R.hp ? R.clash.rage : 0;
  const basePower = (ki, hp) => (ki > 0 ? R.clash.base + R.clash.kiPower * ki : R.clash.empty) + rage(hp);
  const oppBase = basePower(oppKi, oppHp);
  const myBase = basePower(myKi, myHp);
  const oppPush = c.oppPower > oppBase + 0.25;
  const myPush = c.myPower > myBase + 0.25;
  
  if (myPush && myKi > 15) {
    if (c.pos > 0.7 && c.oppPower < c.myPower - 0.3) return 'idle';
    return 'push';
  }
  if (oppPush) {
    if (myKi > 20) return 'push';
    return 'idle';
  }
  if (myKi > oppKi + 15 && myKi > 30 && c.pos < 0.6) return 'push';
  if (c.pos < 0.35 && myKi > 20) return 'push';
  return 'idle';
}

function decideCancel(state) {
  const me = state.me, opp = state.opp;
  const chain = me.chain;
  const dist = state.dist;
  
  if (chain < 3 && dist <= 115 && opp.state === 'hitstun' && opp.left >= 6) {
    return 'light';
  }
  if (dist <= HEAVY_REACH) {
    return 'heavy';
  }
  if (chain < R.light.chain) {
    return 'light';
  }
  return 'blast'; // or heavy?
}

function decideFree(state) {
  const me = state.me, opp = state.opp;
  const dist = state.dist;
  const myKi = me.ki, oppKi = opp.ki;
  const myHp = me.hp, oppHp = opp.hp;
  const oppPhase = opp.phase;
  const incBlast = state.blasts.find(b => b.incoming);
  
  // 1. Beam
  if (opp.state === 'beam') {
    if (oppPhase === 'startup') {
      if (dist <= LIGHT_REACH && opp.t < 18) return 'light';
      if (myKi >= BEAM_COST) return 'beam';
      if (myKi >= DASH_COST) return 'dash_back';
      return 'back';
    }
    if (oppPhase === 'firing') {
      const oppBeam = state.beams.find(b => !b.mine);
      if (oppBeam) {
        const lo = Math.min(oppBeam.from, oppBeam.front) - R.body;
        const hi = Math.max(oppBeam.from, oppBeam.front) + R.body;
        if (me.x >= lo && me.x <= hi) {
          if (myKi >= R.guardKi.beam) return 'guard';
          if (myKi >= DASH_COST) return 'dash_back';
          return 'back';
        }
      }
      if (dist > 140) return myKi >= DASH_COST ? 'dash_back' : 'back';
      return 'forward';
    }
    if (oppPhase === 'recovery') {
      if (dist <= LIGHT_REACH) return 'light';
      if (dist <= HEAVY_REACH) return 'heavy';
      return 'forward';
    }
  }
  
  // 2. Incoming blast
  if (incBlast) {
    if (myKi >= R.guardKi.blast) return 'guard';
    if (myKi >= DASH_COST) return 'dash_forward';
    return 'back';
  }
  
  // 3. Vulnerable states
  if (opp.state === 'crushed') {
    if (dist <= LIGHT_REACH) return 'light';
    if (dist <= HEAVY_REACH) return 'heavy';
    return 'forward';
  }
  if (opp.state === 'hitstun' || opp.state === 'blockstun') {
    if (dist <= LIGHT_REACH) return 'light';
    if (dist <= HEAVY_REACH) return 'heavy';
    return 'forward';
  }
  if (opp.state === 'down') {
    if (opp.left > 20) {
      if (myKi < 85) return 'charge';
      if (dist > 130) return 'forward';
      return 'idle';
    } else {
      if (dist <= HEAVY_REACH && opp.left <= 12) return 'heavy';
      if (dist <= LIGHT_REACH && opp.left <= 6) return 'light';
      if (dist > 140) return 'forward';
      return 'idle';
    }
  }
  
  // 4. Counter opportunities
  if (['light','heavy','blast','dash'].includes(opp.state)) {
    if (oppPhase === 'startup') {
      if (dist <= LIGHT_REACH) {
        if (opp.state === 'heavy' && opp.t < 5) return 'light';
        if (opp.state === 'blast' && opp.t < 7) return 'light';
        if (opp.state === 'light' && opp.t < 2) return 'light';
      }
    } else if (oppPhase === 'recovery') {
      if (dist <= LIGHT_REACH) return 'light';
      if (dist <= HEAVY_REACH) return 'heavy';
      return 'forward';
    } else if (opp.state === 'dash' && oppPhase === 'moving') {
      if (dist <= LIGHT_REACH && opp.t >= R.dash.invuln) return 'light';
      return 'back';
    }
  }
  
  // 5. Neutral
  if (dist > 160) {
    if (opp.state === 'charge') {
      if (myKi >= BLAST_COST && !me.blastOut) return 'blast';
      return 'forward';
    }
    if (myKi < 70) return 'charge';
    if (!me.blastOut && myKi >= BLAST_COST) return 'blast';
    return 'forward';
  }
  
  if (dist > 140) {
    if (opp.state === 'charge') return 'dash_forward';
    if (myKi < 40) return 'charge';
    if (!me.blastOut && myKi >= BLAST_COST) return 'blast';
    return 'forward';
  }
  
  if (dist > LIGHT_REACH) {
    // mid range: 110-140
    if (opp.state === 'charge') return 'heavy';
    if (opp.state === 'guard') return 'heavy';
    if (oppKi < 4) return 'blast';
    if (myKi < 25) return 'forward';
    return Math.random() < 0.35 ? 'heavy' : 'forward';
  }
  
  // Close range
  if (opp.state === 'charge') return 'light';
  if (opp.state === 'guard') {
    if (Math.random() < 0.6) return 'heavy';
    return 'light';
  }
  if (oppKi < 4) return 'light';
  if (oppHp < 120) return Math.random() < 0.7 ? 'heavy' : 'light';
  const r = Math.random();
  if (r < 0.5) return 'light';
  if (r < 0.75) return 'heavy';
  if (r < 0.88) return 'back';
  if (r < 0.95 && myKi >= DASH_COST) return 'dash_forward';
  return 'guard';
}

function decide(state) {
  if (state.clash) return decideClash(state);
  if (state.me.canCancel) return decideCancel(state);
  if (!state.me.free) return 'idle';
  return decideFree(state);
}
```

### 代码块后面写宣言

赛前宣言：让拳头和波量说话吧！

字数：让拳头和波量说话吧 -> 9字? 可以。

### 需要考虑的一点：`R.clash.rageHp` 等是否有？是的。

### 再审视一些漏洞

- 在 `decideFree` 中，对于对手 beam firing 且我们不在 ray 中，我返回 `forward` 若 dist <= 140。但对手 beam 覆盖可能很快延伸到我们，我们前进可能进入 ray 被击中。需要更谨慎。如果对手 beam firing，我们最好远离，而不是近身。但如果我们已经在近距离，可以尝试打断。我原本的逻辑：`if (dist > 140) return dash_back/back; else return 'forward';` 可能危险。如果对手 beam 正在发射，我们距离近，可能很快被 beam 覆盖。但若我们在近距离（<140），对手 beam 射线可能从身前开始延伸，我们可能已在射线上? 还未被打中说明可能在 ray 之外（比如对手背对？不可能）。实际上 beam 从对手身前向我们的方向延伸，我们在对手前方，一定在 beam 路径上。我们之所以还未被打中，可能是 beam 前端尚未到达我们。如果我们前进，主动进入 ray 更早被打。应该后退/闪避，而不是前进。所以这段应改为：在 opponent beam firing 时，无论 dist 如何，尽量躲避或格挡。我们修改：
```js
if (oppPhase === 'firing') {
  const oppBeam = state.beams.find(b => !b.mine);
  if (oppBeam) { ... }
  if (myKi >= DASH_COST) return 'dash_back';
  return 'back';
}
```
不要前进。

- 在 opponent beam startup 时，如果我们不能打断，应该远离。dash_back 是好的。

- 在 opponent beam recovery 时，对手已发射完毕，我们可以攻击，这是安全的。

- 在 incoming blast 处理中，如果我们选择 guard，但如果对手 blast 是朝我们正面，guard 有效。若对手在我们身后（瞬移后），incoming 可能来自后方，guard 无效。但 state.blasts 中 incoming 的计算基于 gap = (me.x - b.x)*b.dir > 0，如果 b.dir 是朝向我们的方向，如果对手在我们身后可能 gap 正。但 guard 只挡正面，我们需要确保 blast 来自前方。我们可以检查 b.dir 与 me.facing 的关系？如果 b.dir 是朝向我们，不一定来自正面。例如我们 facing 1，对手在左侧（facing -1），blast 朝右（dir=1），我们从右边被击中，属于正面。如果对手在身后，我们 facing 可能还未来得及转身（空闲自动面向对手，如果对手在身后，我们 facing 会朝向对手，即 dir 向对手，blast 从对手飞来，仍正面）。通常空闲时自动面向对手，所以 blast 来自正面。可以 guard。

- 在 close range 对抗对手 guard，我们 heavy 破防。但如果对手取消 guard 用 light，可能打断我们。我们有概率 0.6 heavy，0.4 light。混合可以。

- 在 mid range 对手 guard，我们 heavy 破防。如果对手 guard，heavy 启动9，对手可以取消 guard 用 light 吗？对手在 guard 状态下决策每6 tick，如果对手选择取消 guard 用 light，light 启动5，我们 heavy 启动9，我们会被打断。但对手可能继续 guard。我们只能赌。

### 增加一些针对性的改进

- 如果对手在 far range 频繁使用 blast，我们可以利用 dash_forward 穿越波接近。但我们当前 incoming blast 处理是 guard 或 dash_forward。如果对手频繁 blast，我们接近后可以惩罚。

- 我们可以记录对手的 blast 频率，但影响不大。

### 时间限制

代码是常数时间，没问题。

### 提交

我们需要确保代码在 js 代码块中，宣言另起一行。

### 潜在问题：`RULES` 未定义？在引擎中 `RULES` 是全局变量。在提交的机器人代码中，可以安全访问 `RULES`。我们使用 `const R = RULES;` 顶层，若 RULES 未定义会报错，但规则书说定义。

### 检查 `state.me.blastOut` 在远距离时用于判断是否可发 blast。我们使用 `!me.blastOut`。如果我的 blast 在场，我们不应该发 blast。正确。

### 关于 `canPay` 函数未使用，我们可以删除以减少代码。但实际上我们可以保留。

### 最终调整：

在 `decideFree` 中，对手 hard CC 时，如果距离太远，我们 forward。但如果对手 crushed 34 tick，我们 forward 可能来不及。也许用 dash_forward 快速接近更好，但消耗16。如果气足够且距离远，dash_forward 可快速接近。例如 dist > 200，opponent crushed 34，我们 forward 4.5/tick，34 tick 走153，不够。dash_forward 10 tick 内移动200，更快。所以当对手 crushed 且距离 > 200，可以使用 dash_forward。我们需要检查 myKi >= DASH_COST。修改：
```js
if (opp.state === 'crushed') {
  if (dist <= LIGHT_REACH) return 'light';
  if (dist <= HEAVY_REACH) return 'heavy';
  if (dist > 200 && myKi >= DASH_COST) return 'dash_forward';
  return 'forward';
}
```
类似地，对手 hitstun 时，距离远用 dash_forward 可能追赶。

### 对手 down 时，如果距离远且对手快起来，我们可能无法接近。但我们无法在对手 down 期间攻击。可以 dash_forward 接近。当 opp.left <= 10，dist > 140，我们可以 dash_forward 接近。修改：
```js
if (opp.state === 'down') {
  if (opp.left > 20) { ... }
  else {
    if (dist > 140 && opp.left <= 12 && myKi >= DASH_COST) return 'dash_forward';
    if (dist <= HEAVY_REACH && opp.left <= 12) return 'heavy';
    if (dist <= LIGHT_REACH && opp.left <= 6) return 'light';
    if (dist > 140) return 'forward';
    return 'idle';
  }
}
```

### 对手在 hitstun/blockstun 时，距离远用 dash_forward 接近：
```js
if (opp.state === 'hitstun' || opp.state === 'blockstun') {
  if (dist <= LIGHT_REACH) return 'light';
  if (dist <= HEAVY_REACH) return 'heavy';
  if (dist > 180 && myKi >= DASH_COST) return 'dash_forward';
  return 'forward';
}
```

### 完善最后的代码。

### 随机性种子：Math.random() 按局播种，同一局重放结果一致，不同局不同。可能会影响胜率稳定性，但可接受。

### 关于宣言

“赛前宣言：以拳会友，败者贴地。” 字数：以拳会友，败者贴地。 => 9字。

### 最终答案

我们需要输出的只有代码块和宣言。在代码块后面另起一行写宣言。确保没有额外解释。