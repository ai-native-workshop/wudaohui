# AI 武道会 · 开发笔记

对外介绍见 [README.md](README.md)。这里是每个文件和常用命令的细节。

## 现在有什么

| 路径 | 是什么 |
| --- | --- |
| `src/rules.js` | 所有数值：帧数据、伤害、气、对冲参数、选手的时间预算。改平衡只改这里 |
| `src/engine.js` | 擂台引擎，逐 tick 推进一局。确定性的：同一个种子、同两个程序，Node 和浏览器里打出来逐帧一样 |
| `src/rng.js` | 唯一的随机源（mulberry32）和种子派生 |
| `src/pagebot.js` | 在网页里加载选手程序（查看器、以后的点击即玩） |
| `arena/sandbox.mjs` | 在 Node 里加载选手程序：空的 vm 上下文，没有 require、网络、eval，`Math.random` 按局播种 |
| `arena/league.mjs` | 联赛：两两循环，多线程跑；某次调用卡住就杀掉那个线程，判这一局负 |
| `arena/stats.mjs` | 联赛报告：名次、招式占比、对位胜率、比赛节奏、名局候选 |
| `arena/check.mjs` | 必须一直成立的几件事：重放一致、网页和 Node 一致、坏程序被拦住。改了规则或引擎就跑一遍 |
| `arena/brief.mjs` | 生成选手规则书（发给每个模型的那一份提示词），数值直接取自 `rules.js` 和引擎源码 |
| `arena/contest.mjs` + `contest.json` | 把规则书发给 6 个模型，收回程序、赛前宣言和账单（用量、花费、思考摘要），并让新程序和陪练热身几局 |
| `arena/serve.mjs` + `viewer/` | 查看器：挑两个选手和种子看回放，逐帧拖动；也可以自己用键盘上场。带音效和打击停顿，都能关掉对比 |
| `viewer/audio.js` + `assets/sfx/` | 声音：打中、挡住、破防用 Kenney 的 CC0 录音（许可证在 `assets/sfx/`），挥拳、瞬移、蓄气、光束、对冲的声音现场合成。同一套代码既实时播放，也能离线渲染成音轨 |
| `arena/preview.mjs` | 把一局渲染成带声音、带打击停顿的 mp4（查看器的画风，不是日漫回放） |
| `anime/` | 日漫回放：`stick.js` 画人物（查看器那种火柴人：黑色粗线条加各家主色光晕，发型区分：Claude 火焰刺头、GPT 平头头带、Gemini 双马尾、Kimi 长发月牙、DeepSeek 兜帽、豆包双发髻），`fighters.js` 存各家的名字和配色（里面还留着早期试过的剪影画法，已经不用），`film.js` 剪辑（慢动作、打击停顿、运镜、对冲时切特写、冲击帧、集中线、大字），`glowfx.js` 光效（柔光团、贯穿的光束、光粒子、冲击光环、格挡护盾、气焰，全是叠加发光），`world.js` three.js 合成（背景、人物、光效、后期），`vendor/` 是从另一个动画项目搬来的集中线和后期（其中的描边爆点、光球、描边光束太像贴图，已经不用），`sheet.html` 是定妆表 |
| `arena/film.mjs` | 把一局渲染成日漫回放 mp4：1920×1080、24 帧、带音轨；也能出联系表、单帧 |
| `arena/final.mjs` + `arena/finalfilm.mjs` | 前两名打七局四胜：每局的种子事先按 `hash(赛季, 7777, 局号)` 定好，左右每局交换，结果存到 `out/s1_final.json`；再把每局渲染成带“决赛 · 第 N 局”和比分的回放 |
| `anime/cards.js` + `cards.html` | 串场卡片：片名、规则一张图（每招由最常用它的那家来演）、选手登场（赛前宣言放进漫画对话框）、积分榜、前三名克制三角、过场大字、开场定格、冠军、下集投票。都配音效 |
| `arena/aftermatch.mjs` | 赛季结束后把成绩用同一个模板告诉 6 个模型，各说一句赛后感言，提示词、原话和账单存到 `out/contest/s1/aftermatch.json` |
| `assets/music/` | 第一集配乐，三首都是 CC0，出处见 `CREDITS.md`；`candidates/` 是候选和筛选记录 |
| `arena/episode.mjs` | 第一集按顺序拼成一支片：开场定格、片名、规则、选手、联赛、名局、决赛（前三局只留决胜段落）、冠军、投票。卡片和比赛片段都按内容哈希缓存，改哪段只重渲哪段 |
| `bots/sparring/` | 7 个陪练（乱拳、猛攻、龟缩、气功流、见招拆招、心理战、战术家），Claude Code 写的，只用来测规则，不参赛 |

## 常用命令

```bash
node arena/check.mjs                                   # 改完规则先跑这个
node arena/league.mjs bots/sparring/*.js --games=200   # 联赛，报告打印出来，结果存到 out/league.json
node arena/league.mjs --report=out/league.json         # 再看一遍报告
node arena/serve.mjs                                   # 然后打开 http://localhost:8642/viewer/
node arena/preview.mjs sparring/tactician sparring/mixer 2694072671   # 一局渲染成 out/preview/*.mp4
node arena/film.mjs s1/doubao s1/claude 2247389928     # 日漫回放 -> out/film/*.mp4（约一分钟出一支 50 秒的片）
node arena/film.mjs s1/doubao s1/claude 2247389928 --sheet=0:1100:60   # 先看联系表
node arena/film.mjs s1/gemini s1/kimi 2399015069 --wins=1:3 --of=4     # 系列赛：血条下面画比分点（七局四胜每边 4 个）
node arena/film.mjs s1/gemini s1/kimi 2402202482 --from=1560 --intro   # 只放最后一段，保留开场的对阵字幕（快剪）
node arena/final.mjs s1/gemini s1/kimi                 # 七局四胜决赛 -> out/s1_final.json
node arena/finalfilm.mjs                               # 决赛每局渲染成 out/film/s1_final_g*.mp4
node arena/episode.mjs --peek                          # 每张卡片一帧，拼成 out/ep1/check/sheet.jpg 先看排版
node arena/episode.mjs                                 # 拼第一集（配乐在最后一步混进去）-> out/ep1/ep1.mp4 和 ep1_720p.mp4
node arena/episode.mjs --cover                         # 封面 -> out/ep1/cover.jpg（16:9）和 cover_16x10.jpg（B 站）
node arena/publish.mjs                                 # 以组织机器人的身份推到 GitHub（第一次会建仓库、开 Pages），公开记录里不出现个人账号
node arena/aftermatch.mjs --dry                        # 先看要发给 6 家的赛后感言提示词；去掉 --dry 就真发
node anime/still.mjs sheet.html out/film/check/sheet.png 2400 1500       # 定妆表
node arena/brief.mjs                                   # 生成规则书 out/brief.md
node arena/contest.mjs --dry                           # 检查要发给谁、什么设置；去掉 --dry 就真发
node arena/contest.mjs --config=arena/trial.json       # 试跑：OpenRouter 上 4 个不参赛的便宜模型，结果在 bots/trial1/
```

查看器里自己上场：A/D 或方向键移动，S 按住格挡，W 按住蓄气，J 轻拳，K 重击，L 气功波，I 大招，空格瞬移（按住后退方向是后撤），对冲时按住 J 加力。

## 规则一句话

1500 血，60 秒。轻拳快但短，重击慢但能破防。格挡挡得住轻拳和气功，但每挡一下都要付气，付不起就破防；出招被挡的一方反而回气，向前走也回气。气用来放气功波、瞬移（前 8 tick 无敌，能穿到对手身后）和大招。对手放大招时你也放，两道光束同时发射、迎面撞上就是对冲：双方每 0.1 秒决定加不加力，气多、血少（濒死爆发）的一方占优，推输的一方吃 320 伤害。

规则改过一版（v2），原因和试跑数据见 `out/league_trial3.txt`：v1 下模型写的程序太保守，大招和对冲几乎不出现。
