// store.js: where the player's results go. Inside Bilibili's Toy (the page is served from bilibilitoy.com and its SDK is there as
// window.toy): the player's record in its cloud storage, two leaderboards, and the human-vs-AI tally everyone shares. Anywhere else (our
// own web page): the record in this browser's localStorage and no boards. The Toy side follows the SDK's source (v0.3.7); it has not run
// inside a real Toy yet, so every call falls back quietly instead of breaking the game.
const SDK = 'https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js';
const IN_TOY = /(^|\.)bilibilitoy\.com$/i.test(location.hostname);
export const BOARD = { streak: 1, champion: 2 };                 // 连胜榜: best run of wins; 冠军挑战榜: wins against the champion
const SHARED_ID = null;                                          // st_ + 16 characters, from the Toy console once we have one
const SHARDS = 16;                                               // the shared tally is split over keys: there is no atomic add
const EP_VIDEOS = [{ bvid: 'BV1Z5HV6dEqk' }];                   // 第一集正片: liking, coining and favouriting it opens 车轮战
const LOCAL = 'wudaohui.s1.me';

const blank = () => ({ vs: {}, streak: 0, best: 0, champ: 0, games: 0 });
let sdk = null;

function loadScript(src) { return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.append(s); }); }
async function quiet(f, fallback = null) { try { return await f(); } catch (e) { console.warn('toy:', e?.code || e?.message || e); return fallback; } }

export const store = {
  inToy: false, me: blank(),
  async init() {
    if (IN_TOY) { await quiet(() => loadScript(SDK)); sdk = window.toy || null; this.inToy = !!sdk; }
    const raw = this.inToy ? (await quiet(() => sdk.getCloudStorage(['me']), {}))?.me : (() => { try { return localStorage.getItem(LOCAL); } catch { return null; } })();
    try { this.me = { ...blank(), ...(raw ? JSON.parse(raw) : {}) }; } catch { this.me = blank(); }
  },
  record(id) { return this.me.vs[id] || [0, 0]; },
  // after a match: the player's record, then (in the Toy) the boards and the shared tally
  async finish(id, won, champion) {
    const me = this.me, r = this.record(id);
    me.vs[id] = won ? [r[0] + 1, r[1]] : [r[0], r[1] + 1]; me.games++;
    me.streak = won ? me.streak + 1 : 0; me.best = Math.max(me.best, me.streak);
    if (won && id === champion) me.champ++;
    const raw = JSON.stringify(me);
    if (!this.inToy) { try { localStorage.setItem(LOCAL, raw); } catch {} return; }
    await quiet(() => sdk.setCloudStorage({ me: raw }));
    if (won) {
      await quiet(() => sdk.submitScore({ board: BOARD.streak, score: me.best }));
      if (id === champion) await quiet(() => sdk.submitScore({ board: BOARD.champion, score: me.champ }));
    }
    if (SHARED_ID) {                                            // one shard, read and written back; a rare lost update is fine for a rough rate
      const key = `t${Math.floor(Math.random() * SHARDS)}`, cur = await quiet(() => sdk.getSharedStorage(SHARED_ID, [key]), {});
      let t = {}; try { t = JSON.parse(cur?.[key] || '{}'); } catch {}
      const c = t[id] || [0, 0]; t[id] = won ? [c[0] + 1, c[1]] : [c[0], c[1] + 1];
      await quiet(() => sdk.setSharedStorage(SHARED_ID, { [key]: JSON.stringify(t) }));
    }
  },
  // everyone's games against each AI, added up over the shards: { id: [human wins, human losses] }
  async humans() {
    if (!this.inToy || !SHARED_ID) return null;
    const keys = Array.from({ length: SHARDS }, (_, i) => `t${i}`), all = await quiet(() => sdk.getSharedStorage(SHARED_ID, keys), null);
    if (!all) return null;
    const sum = {};
    for (const v of Object.values(all)) { let t = {}; try { t = JSON.parse(v); } catch {} for (const [id, [w, l]] of Object.entries(t)) { const s = sum[id] || [0, 0]; sum[id] = [s[0] + w, s[1] + l]; } }
    return sum;
  },
  async board(which, period = 'all') {
    if (!this.inToy) return null;
    const [list, mine] = await Promise.all([quiet(() => sdk.getRankList({ board: BOARD[which], period, limit: 20 })), quiet(() => sdk.getMyRank({ board: BOARD[which], period }))]);
    return { list, mine };
  },
  // 车轮战 is open after liking, coining and favouriting the episode, or following; outside the Toy, and whenever the check fails, it is open
  async gauntletOpen() {
    if (!this.inToy || !EP_VIDEOS.length) return true;
    const rel = await quiet(() => sdk.getAuthorRelation(), null);
    if (rel && (rel.following || rel.is_follow || rel.attribute === 2 || rel.attribute === 6)) return true;
    const act = await quiet(() => sdk.getVideoUserActions({ videos: EP_VIDEOS }), null);
    if (!act) return true;
    const a = (Array.isArray(act) ? act[0] : act.items?.[0] ?? act.list?.[0] ?? act) || {};
    return !!((a.like || a.liked) && (a.coin || a.coined || a.coins) && (a.favorite || a.fav || a.favoured));
  },
};
