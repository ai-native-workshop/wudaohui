# AI 武道会

**中文** · [English](README.en.md)

6 家大模型拿到一字不差的规则书，各写一个格斗程序，在同一个 2D 擂台上两两对打几千局。胜负按全部局数算；最精彩的几局按对局日志逐帧重演，做成日漫风的回放，发在 B 站。

第一集正片：[B 站 BV1Z5HV6dEqk](https://www.bilibili.com/video/BV1Z5HV6dEqk)　·　网页可玩版：[ai-native-workshop.github.io/wudaohui](https://ai-native-workshop.github.io/wudaohui/)

这个仓库里有：
- 擂台引擎；
- 6 个参赛程序原样；
- 发给它们的规则书和每家的提交回执；
- 联赛逐局结果和决赛结果；
- 网页可玩版：打开 [`toy/`](toy/) 就能挑一个 AI，亲手和它写的程序打一局。

## 第一季结果

循环赛每两家打 1000 局（左右各一半），一共 15000 局：

| 名次 | 选手 | 胜率 | 胜-负 |
| --- | --- | --- | --- |
| 1 | Gemini 4 Argon | 83% | 4127-871 |
| 2 | Kimi K3.1 Pro | 75% | 3734-1262 |
| 3 | GPT-6 Astra | 63% | 3160-1840 |
| 4 | Claude Opus 5.5 | 53% | 2655-2344 |
| 5 | 豆包 Seed 2.1 | 25% | 1248-3750 |
| 6 | DeepSeek V4 Pro | 1% | 71-4928 |

前三名互相克制：Kimi 赢 Gemini 78%，Gemini 赢 GPT 90%，GPT 赢 Kimi 60%。决赛七局四胜，Kimi 以 4 : 3 战胜 Gemini 夺冠。完整报告在 [`out/league_s1.txt`](out/league_s1.txt)，逐局结果在 `out/league_s1.json`，决赛结果在 `out/s1_final.json`。

## 怎么保证公平

- **同一份规则书。** 6 家同时收到同一份提示词：[`out/contest/s1/brief.md`](out/contest/s1/brief.md)。规则书里的数值直接取自代码。发出时的规则和引擎存了快照和 sha256，在 `out/contest/s1/rules_snapshot/`。
- **同样的设置。** 都走 OpenRouter，思考档 high，输出上限 128k，每家最多两次机会。每家的用时、token 和花费都在 `out/contest/s1/<选手>.json`，原始回复和思考记录也在同一目录。
- **一个例外，写明了。** Claude Opus 5.5 经 API 提交时两次都被内容过滤拦下，思考记录见 `claude.reasoning*.md`。第 3 次改由 claude.ai 网页版提交（思考档 High，没开联网和代码工具），回执里记了途径。
- **出题和裁判。** 擂台、规则和裁判由 Claude Code 写；参赛的 Claude Opus 5.5 拿到的提示词和其他 5 家一字不差。
- **程序自己打。** 开打以后谁也不能改代码。引擎是确定性的：同样的种子、同样的两个程序，在 Node 和浏览器里逐帧打出一样的结果（`node arena/check.mjs`）。
- **决赛不挑种子。** 每局的种子事先按 `hash(赛季, 7777, 局号)` 定好，左右每局交换。
- **名局是挑的。** 动画只做按“名局分”挑出来的几局：对波、残血、领先易手越多，分越高。排名按全部局数算。

## 自己跑

需要 Node 20 以上。

```bash
npm install
node arena/check.mjs                                   # 重放一致、网页和 Node 一致、坏程序被拦住
node arena/league.mjs bots/s1/*.js --games=1000        # 重跑第一季联赛（多线程，几分钟）
node arena/final.mjs s1/gemini s1/kimi                 # 重跑七局四胜决赛
node arena/serve.mjs                                   # http://localhost:8642/viewer/ 看任意一局回放，或自己用键盘上场
                                                       # http://localhost:8642/toy/ 是网页可玩版
```

日漫回放和成片的渲染（`arena/film.mjs`、`arena/episode.mjs`）还需要 Chrome 和 ffmpeg。每个文件和命令的细节见 [DEV.md](DEV.md)。

## 文件

| 路径 | 是什么 |
| --- | --- |
| `src/` | 规则数值（`rules.js`）、确定性的擂台引擎（`engine.js`）、唯一的随机源（`rng.js`）、网页里加载选手程序（`pagebot.js`） |
| `arena/` | 联赛、决赛、报告、规则书生成、召集模型、赛后感言、渲染脚本 |
| `bots/s1/` | 第一季 6 个参赛程序，原样未改，第一行注明模型和提交时间 |
| `bots/sparring/` | 7 个陪练程序，只用来测规则，不参赛 |
| `bots/trial*/` | 正式比赛前用便宜模型试跑规则书的程序 |
| `viewer/` | 查看器：看回放、逐帧拖动、自己上场；`audio.js` 是音效 |
| `toy/` | 网页可玩版（也是 B 站点击即玩的版本）：选对手、手机虚拟按键、对战、战绩，以及练习场（木桩、格挡、还手、对波四种陪练） |
| `anime/` | 日漫回放：人物、剪辑、光效、合成，以及成片里的串场卡片 |
| `out/` | 第一季的规则书、回执、联赛和决赛结果 |

## 规则一句话

1500 血，60 秒。轻拳快但短，重击慢但能破防。格挡挡得住轻拳和气功，但每挡一下都要付气，付不起就破防；出招被挡的一方反而回气，向前走也回气。气用来放气弹、气功波和瞬移（前 8 tick 无敌，能穿到对手身后）。对手放气功波时你也放，两道光束迎面撞上就是对波：双方每 0.1 秒决定加不加力，气多、血少（濒死爆发）的一方占优，推输的一方吃 320 伤害。

## 许可

代码以 MIT 许可发布，见 [LICENSE](LICENSE)。`bots/` 里的参赛程序由各家模型写成，原样收录供查阅。音效来自 Kenney（CC0，许可证在 `assets/sfx/`）。成片配乐也都是 CC0，出处见 `assets/music/CREDITS.md`。
