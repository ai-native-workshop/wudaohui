// sandbox.mjs: one bot, loaded fresh for every match into an empty vm context: no require, no process, no timers, no eval;
// Math.random is seeded per match and Date stands still, so a match replays exactly. The state goes in and the action comes out
// as strings, so no object of ours ever reaches the bot's world. A vm is not a hard security boundary: bots are read before
// they run (they are written by the contestant models from our prompt), and each league runs them in worker threads that the
// main thread kills when a call hangs (see league.mjs).
import vm from 'node:vm';
import { RANDOM_SOURCE } from '../src/rng.js';

const PRELUDE = new vm.Script(`(function (seed, rules) {
  'use strict';
  const next = ${RANDOM_SOURCE}(seed);
  Object.defineProperty(Math, 'random', { value: function random() { return next(); } });
  const D = Date;
  globalThis.Date = class Date extends D { constructor(...a) { super(...(a.length ? a : [0])); } static now() { return 0; } };
  const deep = o => { for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') deep(o[k]); return Object.freeze(o); };
  globalThis.RULES = deep(JSON.parse(rules));
  globalThis.console = Object.freeze({ log() {}, info() {}, warn() {}, error() {}, debug() {} });
})`, { filename: 'prelude.js' });

const CALL = new vm.Script(`(function (s) {
  try { const a = decide(JSON.parse(s)); return typeof a === 'string' ? a : (a && typeof a.action === 'string' ? a.action : '!bad'); }
  catch (e) { return '!error'; }
})`, { filename: 'call.js' });

// loadBot(source, { seed, rules, name }) -> (stateJSON) => action string ('!error' / '!bad' when the bot threw or returned junk)
export function loadBot(source, { seed, rules, name = 'bot.js' }) {
  const ctx = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false }, name });
  PRELUDE.runInContext(ctx)(seed >>> 0, JSON.stringify(rules));
  new vm.Script(source, { filename: name }).runInContext(ctx, { timeout: 1000 });
  if (new vm.Script('typeof decide').runInContext(ctx) !== 'function') throw new Error(`${name}: no function decide(state)`);
  return CALL.runInContext(ctx);
}
