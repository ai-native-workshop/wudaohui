// pagebot.js: a bot inside the page (the viewer, the playable Toy), with the same seeded Math.random, the same frozen Date and
// RULES, and the same JSON hand-over as the Node sandbox, so a league match replays here exactly. It is not a sandbox: only bots
// that have been read run here.
import { mulberry32 } from './rng.js';

const deep = o => { for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') deep(o[k]); return Object.freeze(o); };
const QUIET = Object.freeze({ log() {}, info() {}, warn() {}, error() {}, debug() {} });

// loadPageBot(source, { seed, rules, name }) -> (stateJSON) => action string, like sandbox.mjs loadBot
export function loadPageBot(source, { seed, rules, name = 'bot.js' }) {
  const next = mulberry32(seed >>> 0);
  const M = Object.create(Math, { random: { value: function random() { return next(); } } });
  const D0 = Date, D = class Date extends D0 { constructor(...a) { super(...(a.length ? a : [0])); } static now() { return 0; } };
  const make = new Function('Math', 'Date', 'RULES', 'console', `${source}\n;return typeof decide === 'function' ? decide : null;\n//# sourceURL=${name}`);
  const decide = make(M, D, deep(JSON.parse(JSON.stringify(rules))), QUIET);
  if (!decide) throw new Error(`${name}: no function decide(state)`);
  return s => {
    try { const a = decide(JSON.parse(s)); return typeof a === 'string' ? a : (a && typeof a.action === 'string' ? a.action : '!bad'); }
    catch (e) { return '!error'; }
  };
}
