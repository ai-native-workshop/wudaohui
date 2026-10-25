// contest.mjs: sends the brief, word for word, to every contestant model and keeps what comes back: the bot
// (bots/s<season>/<id>.js), its pre-fight line, and a receipt (model, settings, tokens, cost, time, the reasoning summary when
// the provider gives one) in out/contest/s<season>/, so an episode can show exactly who wrote what, with which settings.
// Each new bot is loaded in the sandbox and plays a few warm-up matches against the sparring bots before it counts.
//
//   node arena/contest.mjs [--only=claude,deepseek] [--config=arena/contest.json] [--dry]
//   node arena/contest.mjs --config=arena/trial.json      a rehearsal with cheap non-contestant models (its own folders, by `tag`)
//   node arena/contest.mjs --manual=claude --reply=<file> --route="claude.ai 网页版" [--settings=...] [--seconds=N]   a reply handed in by hand
//   Keys come from the environment variables the config names (ANTHROPIC_API_KEY or an `ant auth login` profile for Claude).
//   provider "anthropic" goes through the Anthropic SDK; "openai-style" through an OpenAI-style chat endpoint (Season 1 sends all six through OpenRouter).
//   No refusal fallback on purpose: a bot written by a stand-in model would not be this contestant's entry.
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brief } from './brief.mjs';
import { RULES } from '../src/rules.js';
import { createMatch, step, summary } from '../src/engine.js';
import { botSeed, hash } from '../src/rng.js';
import { loadBot } from './sandbox.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = /^--([^=]+)(?:=(.*))?$/s.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const config = JSON.parse(readFileSync(args.config || join(root, 'arena/contest.json'), 'utf8'));
const only = args.only ? new Set(String(args.only).split(',')) : null;
const prompt = brief({ games: config.games, season: config.season, opponents: config.contestants.length - 1 });
const tag = config.tag || `s${config.season}`, botDir = join(root, `bots/${tag}`), outDir = join(root, `out/contest/${tag}`);
mkdirSync(botDir, { recursive: true }); mkdirSync(outDir, { recursive: true });
if (!args.manual) writeFileSync(join(outDir, 'brief.md'), prompt);

// ---- providers: each returns { text, reasoning, usage: { input, output }, stop, model }
async function anthropic(c) {
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: c.model, max_tokens: c.maxTokens || 128000,
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort: c.effort || 'max' },
    messages: [{ role: 'user', content: prompt }],
  });
  let n = 0; stream.on('text', t => { n += t.length; tick(c, n); });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error(`refused (${msg.stop_details?.category ?? 'no category'})`);
  return {
    text: msg.content.filter(b => b.type === 'text').map(b => b.text).join(''),
    reasoning: msg.content.filter(b => b.type === 'thinking').map(b => b.thinking).join('\n\n'),
    usage: { input: msg.usage.input_tokens + (msg.usage.cache_creation_input_tokens || 0) + (msg.usage.cache_read_input_tokens || 0), output: msg.usage.output_tokens },
    stop: msg.stop_reason, model: msg.model,
  };
}

async function openaiStyle(c) {
  const key = process.env[c.keyEnv];
  if (!key) throw new Error(`set ${c.keyEnv}`);
  const res = await fetch(`${c.baseURL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: c.model, messages: [{ role: 'user', content: prompt }], stream: true, stream_options: { include_usage: true }, ...(c.maxTokens ? { max_tokens: c.maxTokens } : {}), ...(c.body || {}) }),
    signal: AbortSignal.timeout((c.timeoutMin || 60) * 60000),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 500)}`);
  let text = '', reasoning = '', usage = null, stop = null, native = null, genId = null, streamError = null, model = c.model, buf = '';
  const dec = new TextDecoder();
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim(); if (data === '[DONE]') continue;
      let j; try { j = JSON.parse(data); } catch { continue; }
      if (j.model) model = j.model;
      if (j.id) genId = j.id;
      if (j.error) streamError = j.error;
      if (j.usage) usage = j.usage;
      const ch = j.choices?.[0]; if (!ch) continue;
      if (ch.delta?.content) text += ch.delta.content;
      const r = ch.delta?.reasoning_content ?? ch.delta?.reasoning; if (typeof r === 'string') reasoning += r;
      if (ch.finish_reason) stop = ch.finish_reason;
      if (ch.native_finish_reason) native = ch.native_finish_reason;
      tick(c, text.length + reasoning.length);
    }
  }
  return { text, reasoning, usage: { input: usage?.prompt_tokens ?? null, output: usage?.completion_tokens ?? null, reasoning: usage?.completion_tokens_details?.reasoning_tokens ?? null, costUSD: usage?.cost ?? null }, stop, model, native, genId, streamError };
}

const last = new Map();
function tick(c, n) { const now = Date.now(); if (now - (last.get(c.id) || 0) > 2000) { last.set(c.id, now); console.log(`  ${c.id}: ${n} characters so far`); } }

// ---- the reply: the first ```js block is the bot, the line starting 赛前宣言 is the pre-fight line
function parse(text) {
  const blocks = [...text.matchAll(/```(?:js|javascript|mjs)?[ \t]*\n([\s\S]*?)```/gi)].map(m => m[1]);
  const code = blocks.find(b => /function\s+decide\s*\(|decide\s*=/.test(b)) || blocks[0] || null;
  const line = /赛前宣言[:：]\s*(.+)/.exec(text)?.[1]?.trim().replace(/^[“"「]|[”"」]$/g, '') || null;
  return { code, line };
}

// a few warm-up matches against every sparring bot: does it load, does it throw, is it fast enough
function warmup(code, id) {
  const spar = readdirSync(join(root, 'bots/sparring')).filter(f => f.endsWith('.js'));
  const out = { games: 0, wins: 0, errors: 0, forfeits: 0, maxCallMs: 0, avgCallUs: 0 };
  let calls = 0, ms = 0;
  for (const [k, f] of spar.entries()) for (let g = 0; g < 4; g++) {
    const seed = hash(7, k, g), side = g % 2, other = readFileSync(join(root, 'bots/sparring', f), 'utf8');
    const fns = [0, 1].map(s => loadBot(s === side ? code : other, { seed: botSeed(seed, s), rules: RULES, name: s === side ? `${id}.js` : f }));
    const m = createMatch({ seed, rules: RULES });
    while (!m.over) step(m, (s, v) => {
      const t0 = performance.now(), a = fns[s](JSON.stringify(v)), dt = performance.now() - t0;
      if (s === side) { calls++; ms += dt; out.maxCallMs = Math.max(out.maxCallMs, dt); if (a === '!error') out.errors++; }
      return a;
    });
    out.games++; if (summary(m).winner === side) out.wins++;
  }
  out.avgCallUs = Math.round((1000 * ms) / Math.max(1, calls)); out.maxCallMs = Math.round(out.maxCallMs * 10) / 10;
  return out;
}

// a reply handed in by hand (a chat app instead of the API): it is logged as one more try, beside the API tries
if (args.manual) {
  const c = config.contestants.find(x => x.id === args.manual);
  if (!c || !args.reply) { console.error('usage: --manual=<contestant id> --reply=<file>'); process.exit(1); }
  const text = readFileSync(args.reply, 'utf8');
  let { code, line } = parse(text);
  if (!code) code = text.split(/\n\s*赛前宣言[:：]/)[0].trim();               // pasted without the ``` fence
  const file = join(outDir, `${c.id}.json`), when = new Date().toISOString();
  const receipt = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { id: c.id, name: c.name, tries: [] };
  const n = (receipt.tries || []).length + 1, route = args.route || 'by hand';
  receipt.tries = [...(receipt.tries || []), { n, route, settings: args.settings || null, seconds: args.seconds ? +args.seconds : null, reply: basename(args.reply) }];
  Object.assign(receipt, { servedBy: route, stop: 'manual', line, attempt: n, finished: when });
  delete receipt.error;
  writeFileSync(join(botDir, `${c.id}.js`), `// ${c.name} · ${route} · ${when}\n${code}\n`);
  receipt.warmup = warmup(code, c.id);
  writeFileSync(file, JSON.stringify(receipt, null, 2));
  const w = receipt.warmup;
  console.log(`${c.id}: taken by hand (${route}), try ${n}; warm-up ${w.wins}/${w.games}, ${w.errors} errors, ${w.avgCallUs} µs a call; “${line || '（没写宣言）'}”`);
  process.exit(0);
}

const todo = config.contestants.filter(c => !only || only.has(c.id));
for (const c of todo) if (!c.model || c.model.startsWith('TODO')) { console.error(`${c.id}: fill in its model id in the config first`); process.exit(1); }
console.log(`brief: ${prompt.length} characters -> ${join(outDir, 'brief.md')}`);
if (args.dry) { for (const c of todo) console.log(`  would send to ${c.id}: ${c.provider} ${c.model} ${JSON.stringify(c.body || { effort: c.effort })}`); process.exit(0); }

// every contestant gets the same deal: up to `attempts` tries (config, default 2); a try that brings back no complete program
// (cut off at the token limit, or the provider failed) is logged in the receipt and the next try starts from scratch
await Promise.all(todo.map(async c => {
  const t0 = Date.now(), attempts = c.attempts ?? config.attempts ?? 2;
  const receipt = { id: c.id, name: c.name, provider: c.provider, model: c.model, settings: c.provider === 'anthropic' ? { effort: c.effort || 'max', thinking: 'adaptive' } : c.body || {}, maxTokens: c.maxTokens || null, started: new Date().toISOString(), tries: [] };
  for (let n = 1; n <= attempts; n++) {
    const t1 = Date.now();
    try {
      const r = await (c.provider === 'anthropic' ? anthropic(c) : openaiStyle(c));
      const { code, line } = parse(r.text);
      // what the provider billed when it says (OpenRouter does), else list price times tokens
      const cost = r.usage.costUSD != null ? Math.round(r.usage.costUSD * 1000) / 1000 : c.price && r.usage.input != null ? Math.round((r.usage.input * c.price[0] + r.usage.output * c.price[1]) / 1e4) / 100 : null;
      const tryInfo = { n, servedBy: r.model, stop: r.stop, nativeStop: r.native ?? null, generation: r.genId ?? null, streamError: r.streamError ?? null, seconds: Math.round((Date.now() - t1) / 1000), usage: r.usage, costUSD: cost };
      receipt.tries.push(tryInfo);
      writeFileSync(join(outDir, `${c.id}.reply${n > 1 ? n : ''}.md`), r.text);
      if (r.reasoning) writeFileSync(join(outDir, `${c.id}.reasoning${n > 1 ? n : ''}.md`), r.reasoning);
      if (!code) throw new Error(r.stop === 'length' || r.stop === 'max_tokens' ? `ran out of max_tokens before the code was done (${r.usage.output} output tokens${r.usage.reasoning ? `, ${r.usage.reasoning} of them thinking` : ''})` : `no code block in the reply (stop: ${r.stop})`);
      Object.assign(receipt, { servedBy: r.model, stop: r.stop, line, attempt: n });
      writeFileSync(join(botDir, `${c.id}.js`), `// ${c.name} · ${r.model} · ${receipt.started}\n${code}`);
      receipt.warmup = warmup(code, c.id);
      delete receipt.error;
      break;
    } catch (e) {
      const why = String(e.message || e);
      if (receipt.tries.length < n) receipt.tries.push({ n, seconds: Math.round((Date.now() - t1) / 1000), error: why }); else receipt.tries[n - 1].error = why;
      receipt.error = why;
      console.error(`${c.id}: try ${n} of ${attempts} failed: ${why}`);
    }
  }
  receipt.seconds = Math.round((Date.now() - t0) / 1000);
  receipt.costUSD = Math.round(receipt.tries.reduce((x, t) => x + (t.costUSD || 0), 0) * 100) / 100;
  if (!receipt.error) {
    const w = receipt.warmup;
    console.log(`${c.id}: ok on try ${receipt.attempt} in ${receipt.seconds}s, $${receipt.costUSD}; warm-up ${w.wins}/${w.games}, ${w.errors} errors, ${w.avgCallUs} µs a call; “${receipt.line || '（没写宣言）'}”`);
  }
  writeFileSync(join(outDir, `${c.id}.json`), JSON.stringify(receipt, null, 2));
}));
