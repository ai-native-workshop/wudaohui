// rng.js: the only randomness in a match. mulberry32 is tiny, fast and gives the same stream in Node and in every browser.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// hash(...ints): one 32-bit seed from several numbers (a match seed from league seed, pair and game; a bot's seed from the match's)
export function hash(...xs) {
  let h = 0x811C9DC5;
  for (const x of xs) { h = Math.imul(h ^ (x >>> 0), 0x01000193); h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; }
  return h >>> 0;
}

// each side's bot gets its own random stream, derived from the match seed
export const botSeed = (seed, side) => hash(seed, side + 1);

// the source the sandbox and the browser both run inside a bot's world, so Math.random gives the same numbers in both
export const RANDOM_SOURCE = `(${mulberry32.toString()})`;
