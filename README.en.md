# AI 武道会 · AI Martial Arts Tournament

[中文](README.md) · **English**

Models from six AI companies got the same rulebook, word for word, and each wrote a fighting program. The programs fought each other in pairs on the same 2D stage, thousands of games in all. Every game counts toward the results. The best few games are replayed frame by frame from their logs as anime-style videos for Bilibili.

Episode 1 (in Chinese): [Bilibili BV1Z5HV6dEqk](https://www.bilibili.com/video/BV1Z5HV6dEqk)　·　Play in your browser: [ai-native-workshop.github.io/wudaohui](https://ai-native-workshop.github.io/wudaohui/)

This repository has:
- the arena engine;
- the six contestants' programs, exactly as submitted;
- the rulebook they were given and each model's submission receipt;
- the result of every league game and of the final;
- the web game: open [`toy/`](toy/) to pick an AI and fight its program yourself (the interface is in Chinese).

## Season 1 results

Round robin: every pair played 1,000 games, half from each side, 15,000 games in all.

| Rank | Contestant | Win rate | W-L |
| --- | --- | --- | --- |
| 1 | Gemini 4 Argon | 83% | 4127-871 |
| 2 | Kimi K3.1 Pro | 75% | 3734-1262 |
| 3 | GPT-6 Astra | 63% | 3160-1840 |
| 4 | Claude Opus 5.5 | 53% | 2655-2344 |
| 5 | Doubao Seed 2.1 | 25% | 1248-3750 |
| 6 | DeepSeek V4 Pro | 1% | 71-4928 |

The top three counter each other: Kimi beats Gemini 78% of the time, Gemini beats GPT 90%, and GPT beats Kimi 60%. Kimi won the best-of-seven final against Gemini 4–3 and took the title.

The full report is [`out/league_s1.txt`](out/league_s1.txt) (in Chinese). Game-by-game results are in `out/league_s1.json`, and the final's results are in `out/s1_final.json`.

## How it was kept fair

- **One rulebook.** All six models received the same prompt at the same time: [`out/contest/s1/brief.md`](out/contest/s1/brief.md) (in Chinese).
  - Every number in it comes straight from the code.
  - The rules and engine, as sent, were snapshotted with sha256 checksums in `out/contest/s1/rules_snapshot/`.
- **The same settings.** Every model was called through OpenRouter, with reasoning effort high, a 128k output cap and at most two attempts.
  - Each model's time, tokens and cost are in `out/contest/s1/<contestant>.json`.
  - The raw replies and reasoning traces are in the same folder.
- **One exception, on record.** Claude Opus 5.5 was stopped by a content filter both times it was called through the API. Its reasoning from those two attempts is in `claude.reasoning*.md`. Its third attempt was submitted through the claude.ai web app instead, with thinking set to High and web search and code tools off. Its receipt records this.
- **Who set the test.** Claude Code wrote the arena, the rules and the referee. The Claude Opus 5.5 contestant got exactly the same prompt as the other five.
- **The programs fight on their own.** Once the games began, nobody could change any code.
  - The engine is deterministic: the same seed and the same two programs play out the same game, frame by frame, in Node and in the browser.
  - `node arena/check.mjs` tests this.
- **No hand-picked seeds in the final.** Each game's seed was fixed in advance as `hash(season, 7777, game number)`, and the fighters swap sides every game.
- **The highlights are hand-picked; the rankings are not.** Only a few games are animated, chosen by a highlight score that rises with beam clashes, low-health moments and lead changes. The rankings count every game.

## Run it yourself

You need Node 20 or later.

```bash
npm install
node arena/check.mjs                                   # replays match, browser matches Node, broken programs are stopped
node arena/league.mjs bots/s1/*.js --games=1000        # rerun the Season 1 league (multithreaded, a few minutes)
node arena/final.mjs s1/gemini s1/kimi                 # rerun the best-of-seven final
node arena/serve.mjs                                   # http://localhost:8642/viewer/ to watch any game or play it with the keyboard
                                                       # http://localhost:8642/toy/ is the web game
```

Rendering the anime replays and the episode (`arena/film.mjs`, `arena/episode.mjs`) also needs Chrome and ffmpeg. [DEV.md](DEV.md) (in Chinese) describes every file and command.

## Files

| Path | What it is |
| --- | --- |
| `src/` | the rule values (`rules.js`), the deterministic arena engine (`engine.js`), the only source of randomness (`rng.js`), and loading the contestants' programs in the browser (`pagebot.js`) |
| `arena/` | scripts for the league, the final, the reports, the rulebook, calling the models, the post-match lines and rendering |
| `bots/s1/` | the six Season 1 programs, unchanged; the first line of each names the model and when it was submitted |
| `bots/sparring/` | seven sparring programs, used only to test the rules; they did not compete |
| `bots/trial*/` | programs written by cheaper models while the rulebook was tried out before the contest |
| `viewer/` | the viewer: watch replays, step through them frame by frame, or play yourself; `audio.js` holds the sound effects |
| `toy/` | the web game, also the version for Bilibili's click-to-play Toys: pick an opponent, play with on-screen buttons on a phone, keep your record, or train in the practice room against four kinds of sparring partner (a standing dummy, one that guards, one that fights back, one that answers your beam) |
| `anime/` | the anime replays (characters, editing, light effects, compositing) and the episode's title cards |
| `out/` | Season 1's rulebook, receipts, and league and final results |

## The rules in brief

- **Basics.** Each fighter has 1,500 HP, and a game lasts 60 seconds. Light punches are fast but short. Heavy attacks are slow but break guard.
- **Guarding.** A guard stops light punches and ki attacks, but every block costs ki. A fighter who can't pay has their guard broken. The attacker whose move was blocked actually gains ki, and walking forward gains ki too.
- **Ki.** Ki pays for ki blasts, beams and dashes. A dash is invulnerable for its first 8 ticks and can carry you behind your opponent.
- **Beam clashes.** If you fire a beam while your opponent fires one, the two beams meet head-on in a clash. Every 0.1 seconds, both sides decide whether to push. The side with more ki and less HP has the edge, because low HP gives a last-stand boost. The side that loses the clash takes 320 damage.

## License

The code is released under the MIT license; see [LICENSE](LICENSE). The contestants' programs in `bots/` were written by their models and are included unchanged for reference.

Sound effects come from Kenney under CC0; the license files are in `assets/sfx/`. The episode's music is also CC0, with sources listed in `assets/music/CREDITS.md`.
