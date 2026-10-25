// stats.mjs: what a league says. Ratings (Bradley-Terry over every match, on an Elo-like scale), each bot's record and style
// (which moves it starts, where its time goes), how the matches go (length, KOs, clashes, comebacks), and the matches worth animating.
export function report(L, { top = 12 } = {}) {
  const R = L.rules, B = L.bots.map(b => b.name), n = B.length, res = L.results.filter(Boolean);
  const pad = (s, w) => String(s).padEnd(w), lpad = (s, w) => String(s).padStart(w), pct = x => (100 * x).toFixed(0) + '%';
  const out = [];

  // pair scores (a draw is half a win each way), then Bradley-Terry by the MM iteration, with half a virtual draw per pair as a prior
  const win = Array.from({ length: n }, () => new Array(n).fill(0)), cnt = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const r of res) {
    const [a, b] = r.sides; cnt[a][b]++; cnt[b][a]++;
    if (r.winner == null) { win[a][b] += 0.5; win[b][a] += 0.5; } else { const w = r.sides[r.winner]; win[w][w === a ? b : a] += 1; }
  }
  let p = new Array(n).fill(1);
  for (let it = 0; it < 500; it++) {
    const q = p.map((pi, i) => {
      let W = 0, D = 0;
      for (let j = 0; j < n; j++) if (j !== i && cnt[i][j]) { W += win[i][j] + 0.25; D += (cnt[i][j] + 0.5) / (pi + p[j]); }
      return W / D;
    });
    const g = Math.exp(q.reduce((s, x) => s + Math.log(x), 0) / n); p = q.map(x => x / g);
  }
  const rating = p.map(x => Math.round(1500 + 400 * Math.log10(x)));

  // per bot
  const per = B.map(() => ({ g: 0, w: 0, l: 0, d: 0, ko: 0, time: 0, ff: 0, ticks: 0, moves: {}, held: {}, heldT: 0, hits: 0, crush: 0, dodge: 0, errors: 0, invalid: 0, asks: 0, ms: 0 }));
  for (const r of res) r.sides.forEach((b, s) => {
    const P = per[b]; P.g++; P.ticks += r.ticks;
    if (r.winner == null) P.d++; else if (r.winner === s) { P.w++; if (r.reason === 'ko') P.ko++; if (r.reason === 'time') P.time++; } else { P.l++; if (!['ko', 'time', 'double_ko'].includes(r.reason)) P.ff++; }
    P.errors += r.errors?.[s] || 0; P.ms += r.ms?.[s] || 0;
    const st = r.side?.[s]; if (!st) return;
    for (const [k, v] of Object.entries(st.moves)) P.moves[k] = (P.moves[k] || 0) + v;
    for (const [k, v] of Object.entries(st.held)) { P.held[k] = (P.held[k] || 0) + v; P.heldT += v; }
    P.hits += st.hits; P.crush += st.crushes; P.dodge += st.dodges; P.invalid += st.invalid; P.asks += st.asks;
  });
  const score = i => (per[i].w + per[i].d / 2) / Math.max(1, per[i].g);                  // the ranking: win share, a draw counts half
  const order = B.map((_, i) => i).sort((a, b) => score(b) - score(a) || rating[b] - rating[a]);
  out.push('排名  选手            等级分  胜-负-平          胜率   KO胜  判定胜  犯规负  错误/调用   平均思考');
  for (const [k, i] of order.entries()) {
    const P = per[i];
    out.push(`${lpad(k + 1, 2)}    ${pad(B[i], 14)}  ${lpad(rating[i], 5)}   ${pad(`${P.w}-${P.l}-${P.d}`, 15)}  ${lpad(pct((P.w + P.d / 2) / P.g), 4)}   ${lpad(P.ko, 4)}  ${lpad(P.time, 6)}  ${lpad(P.ff, 6)}  ${lpad(`${P.errors}/${P.asks}`, 10)}   ${(1000 * P.ms / Math.max(1, P.asks)).toFixed(1)} µs`);
  }

  // style: share of the moves started, and of the time held in each free state
  const MV = ['light', 'heavy', 'blast', 'beam', 'dash_forward', 'dash_back'], HD = ['guard', 'charge', 'forward', 'back', 'idle'];
  out.push('', '招式占比（发出的招）                                            |  时间占比（可行动时）');
  out.push(`${pad('', 14)}  ${MV.map(k => lpad(k, 9)).join('')}  | ${HD.map(k => lpad(k, 8)).join('')}   破防  闪避`);
  for (const i of order) {
    const P = per[i], tot = MV.reduce((s, k) => s + (P.moves[k] || 0), 0) || 1, warn = MV.some(k => (P.moves[k] || 0) / tot > 0.5) ? '  <- 一招过半' : '';
    out.push(`${pad(B[i], 14)}  ${MV.map(k => lpad(pct((P.moves[k] || 0) / tot), 9)).join('')}  | ${HD.map(k => lpad(pct((P.held[k] || 0) / Math.max(1, P.heldT)), 8)).join('')}   ${lpad((P.crush / P.g).toFixed(1), 4)}  ${lpad((P.dodge / P.g).toFixed(1), 4)}${warn}`);
  }

  // pair table: row's win share against column
  out.push('', '对位胜率（行对列）', pad('', 14) + order.map(j => lpad(B[j].slice(0, 7), 8)).join(''));
  for (const i of order) out.push(pad(B[i], 14) + order.map(j => lpad(i === j ? '-' : cnt[i][j] ? pct(win[i][j] / cnt[i][j]) : '', 8)).join(''));

  // how matches go
  const N = res.length, by = k => res.filter(k).length;
  const fin = {}; for (const r of res) fin[r.finisher] = (fin[r.finisher] || 0) + 1;
  const comeback = by(r => r.winner != null && r.side && r.side[r.winner].minHp < 0.25 * R.hp);
  out.push('', `比赛：平均 ${(res.reduce((s, r) => s + r.ticks, 0) / N / R.fps).toFixed(1)} 秒；KO ${pct(by(r => r.reason === 'ko') / N)}，判定 ${pct(by(r => r.reason === 'time') / N)}，平局 ${pct(by(r => r.winner == null) / N)}；` +
    `有对冲的局 ${pct(by(r => r.clashes > 0) / N)}，每局大招 ${(res.reduce((s, r) => s + r.beams, 0) / N).toFixed(2)} 次；赢家血量曾低于 25% 的翻盘局 ${pct(comeback / N)}`);
  out.push('终结技：' + Object.entries(fin).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v / N)}`).join('，'));

  // the matches worth animating
  out.push('', `名局候选（按名局分）`);
  for (const r of [...res].sort((a, b) => b.highlight - a.highlight).slice(0, top)) {
    const nm = r.sides.map(b => B[b]), w = r.winner == null ? '平' : nm[r.winner];
    out.push(`  ${lpad(r.highlight.toFixed(1), 5)}  ${pad(nm.join(' vs '), 30)} seed ${lpad(r.seed, 10)}  ${pad(w + ' ' + r.reason, 18)} ${(r.ticks / R.fps).toFixed(1)}s  血 ${r.hp.join('/')}  对冲 ${r.clashes}  领先易手 ${r.leadChanges}  终结 ${r.finisher}`);
  }
  return out.join('\n');
}
