// cards.js: the episode's cards (title, rules, each contestant, standings, the who-beats-whom triangle, interstitials, a freeze frame,
// champion, next-episode vote), drawn on a 2D canvas in the replays' look: a night gradient, the stick figures glowing in their colours,
// light and big glowing words. arena/episode.mjs sets a card with __card(type, data), takes its frames one by one with __drawCard(k)
// and its sound effects with __cardAudio().
import { castOf } from './fighters.js';
import { drawStick } from './stick.js';
import { RULES } from '../src/rules.js';
import { toWav } from '../viewer/audio.js';

const c = document.getElementById('c'), g = c.getContext('2d'), W = c.width, H = c.height, FPS = 24;
const ease = k => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.pow(1 - k, 3));
const FONT = '"PingFang SC", "Hiragino Sans GB", sans-serif';
const col = id => castOf(id).palette[1];
let card = null;

// ---- drawing pieces
function bg(t, tint = '#1d4a6a') {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#04081a'); gr.addColorStop(0.6, '#0b2444'); gr.addColorStop(1, tint);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.save(); g.globalCompositeOperation = 'lighter';                         // drifting motes of ki in the six colours
  const cols = ['claude', 'gpt', 'gemini', 'kimi', 'deepseek', 'doubao'].map(col);
  for (let i = 0; i < 70; i++) {
    const x = ((i * 173) % W + t * (8 + (i % 7) * 3)) % W, y = H - ((t * (20 + (i % 11) * 6) + i * 61) % (H + 40));
    g.globalAlpha = 0.2 + 0.3 * Math.abs(Math.sin(t * 2 + i)); g.fillStyle = cols[i % 6];
    g.beginPath(); g.arc(x, y, 1.5 + (i % 4) * 0.9, 0, 7); g.fill();
  }
  g.restore();
}
function text(str, x, y, size, color = '#fff', { glow = color, align = 'center', weight = 900, alpha = 1, stroke = true } = {}) {
  if (alpha <= 0) return;
  g.save(); g.globalAlpha = alpha; g.font = `${weight} ${size}px ${FONT}`; g.textAlign = align; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (stroke) { g.lineWidth = size * 0.12; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(str, x, y); }
  if (glow) { g.shadowColor = glow; g.shadowBlur = size * 0.35; }
  g.fillStyle = color; g.fillText(str, x, y);
  g.restore();
}
const plain = (str, x, y, size, color, o = {}) => text(str, x, y, size, color, { weight: 600, glow: null, ...o });
// a contestant with feet at (x, y), scale s, in the pose of engine state `state`; facing right unless flip. Returns where the hands are.
function fighter(id, x, y, s, state = 'idle', { flip = false, alpha = 1, phase = null, st = 0, tick = 0, ki = 60 } = {}) {
  if (alpha <= 0) return null;
  g.save(); g.globalAlpha = alpha; g.translate(x, y); g.scale(flip ? -s : s, s);
  const J = drawStick(g, id, [0, state, st, 1, RULES.hp, ki, phase, 0], RULES, { tick, px: s });
  g.restore();
  const at = p => [x + (flip ? -1 : 1) * s * p[0], y + s * p[1]];
  return { front: at(J.fa[2]), back: at(J.ba[2]), chest: at(J.chest) };
}
function aura(x, y, h, color, k, t) {
  if (k <= 0) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  const pool = g.createRadialGradient(x, y, 0, x, y, h * 0.42); pool.addColorStop(0, color); pool.addColorStop(1, 'rgba(0,0,0,0)');   // light pooled on the ground
  g.globalAlpha = 0.5 * k; g.fillStyle = pool; g.save(); g.translate(x, y); g.scale(1, 0.16); g.translate(-x, -y); g.beginPath(); g.arc(x, y, h * 0.42, 0, 7); g.fill(); g.restore();
  for (let i = 0; i < 9; i++) {
    const fl = Math.sin(t * 6 + i * 1.7) * 0.5 + 0.5, w = h * (0.16 + 0.06 * fl), hh = h * (0.7 + 0.35 * fl), ox = Math.cos(i * 0.7 + t) * h * 0.12;
    const gr = g.createLinearGradient(x, y, x, y - hh); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = (0.14 + 0.1 * fl) * k; g.fillStyle = gr; g.beginPath();
    g.moveTo(x + ox - w, y); g.quadraticCurveTo(x + ox - w * 0.6, y - hh * 0.4, x + ox, y - hh); g.quadraticCurveTo(x + ox + w * 0.6, y - hh * 0.4, x + ox + w, y); g.fill();
  }
  g.restore();
}
function glowBall(x, y, r, color, k = 1) {
  if (k <= 0) return;
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, k);
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.22, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore();
}
function beamLine(x0, y, x1, w, color, k = 1) {
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.shadowColor = color; g.shadowBlur = w;
  for (const [lw, cc, a] of [[w * 2.4, color, 0.22], [w, color, 0.75], [w * 0.36, '#ffffff', 1]]) { g.globalAlpha = a * k; g.strokeStyle = cc; g.lineWidth = lw; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  g.restore();
}
function shieldArc(x, y, r, dir, color, k = 1) {                          // a bow of light in front of a guard (dir +1: facing right)
  const a0 = dir > 0 ? -0.95 : Math.PI - 0.95;
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.shadowColor = color; g.shadowBlur = 26;
  for (const [lw, cc, a] of [[26, color, 0.22], [9, color, 0.75], [3, '#ffffff', 1]]) { g.globalAlpha = a * k; g.strokeStyle = cc; g.lineWidth = lw; g.beginPath(); g.arc(x, y, r, a0, a0 + 1.9); g.stroke(); }
  g.restore();
}
function burst(x, y, r, color, t, n = 8) {                                 // an impact: a ball of light and rays
  glowBall(x, y, r, color, 1);
  g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = '#ffffff'; g.shadowColor = color; g.shadowBlur = 14; g.lineCap = 'round'; g.lineWidth = 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3, r0 = r * 0.45, r1 = r * (1.2 + 0.35 * Math.sin(t * 11 + i * 2.1));
    g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); g.stroke();
  }
  g.restore();
}
function ring(x, y, r, color, k) {
  if (k <= 0) return;
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = k; g.strokeStyle = color; g.shadowColor = color; g.shadowBlur = 18; g.lineWidth = 5;
  g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.restore();
}
function rays(x, y, r, color, t, k = 1) {                                  // slow-turning light rays behind a figure
  g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y); g.rotate(t * 0.15);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = (0.16 + 0.08 * Math.sin(t * 2 + i)) * k; g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, a, a + 0.12); g.closePath(); g.fill();
  }
  g.restore();
}
function bubble(str, x, y, size, color, k = 1) {                          // a comic speech bubble, its tail pointing down-left at the speaker
  g.save(); g.globalAlpha = k; g.font = `800 ${size}px ${FONT}`;
  const w = g.measureText(str).width + size * 1.4, h = size * 2, sc = 0.85 + 0.15 * ease(k);
  g.translate(x, y); g.scale(sc, sc);
  g.fillStyle = 'rgba(255,255,255,0.96)'; g.strokeStyle = color; g.lineWidth = 7; g.shadowColor = color; g.shadowBlur = 24;
  g.beginPath(); g.roundRect(0, -h / 2, w, h, h / 2); g.moveTo(54, h / 2 - 4); g.lineTo(-6, h / 2 + 46); g.lineTo(112, h / 2 - 4); g.fill(); g.stroke();
  g.shadowBlur = 0; g.fillStyle = '#10131c'; g.textBaseline = 'middle'; g.fillText(str, size * 0.7, 2);
  g.restore();
}
function panel(x, y, w, h, k, edge = 'rgba(255,255,255,0.08)') {
  g.save(); g.globalAlpha = k; g.fillStyle = 'rgba(6,12,28,0.62)'; g.strokeStyle = edge; g.lineWidth = 2;
  g.beginPath(); g.roundRect(x, y, w, h, 22); g.fill(); g.stroke(); g.restore();
}
function arrow(a, b, color, p, bend) {                                     // a glowing curved arrow from a to b drawn up to p (0..1); returns its middle
  if (p <= 0) return null;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  const cx = mx - (dy / L) * bend, cy = my + (dx / L) * bend, pt = s => [(1 - s) ** 2 * a[0] + 2 * (1 - s) * s * cx + s * s * b[0], (1 - s) ** 2 * a[1] + 2 * (1 - s) * s * cy + s * s * b[1]];
  g.save(); g.lineCap = 'round'; g.strokeStyle = color; g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 22; g.lineWidth = 10;
  g.beginPath(); g.moveTo(...a); for (let s = 0.02; s <= p + 1e-6; s += 0.02) g.lineTo(...pt(s)); g.stroke();
  const e = pt(p), e0 = pt(Math.max(0, p - 0.04)), ang = Math.atan2(e[1] - e0[1], e[0] - e0[0]);
  g.translate(...e); g.rotate(ang); g.beginPath(); g.moveTo(18, 0); g.lineTo(-24, -21); g.lineTo(-24, 21); g.closePath(); g.fill();
  g.restore();
  return pt(0.5);
}

// ---- the rules: one move per cell, each shown by the contestant who used it most
const MOVES = [
  { who: 'doubao', name: '轻拳', desc: '出手快 · 打中能连段', state: 'light', phase: 'active', sfx: 'punch_light_1',
    fx: (h, t, cc) => burst(h.front[0] + 14, h.front[1], 30 + 6 * Math.sin(t * 14), cc, t, 7) },
  { who: 'claude', name: '重击', desc: '出手慢 · 破防、击倒', state: 'heavy', phase: 'active', sfx: 'punch_heavy_1',
    fx: (h, t, cc) => { burst(h.front[0] + 16, h.front[1], 46, cc, t, 9); ring(h.front[0] + 16, h.front[1], 40 + ((t * 90) % 60), cc, 1 - ((t * 90) % 60) / 60); } },
  { who: 'kimi', name: '格挡', desc: '挡住要扣气 · 没气就破防', state: 'guard', sfx: 'shield_1',
    fx: (h, t, cc) => shieldArc(h.chest[0] + 6, h.chest[1] + 20, 110, 1, cc, 0.8 + 0.2 * Math.sin(t * 5)) },
  { who: 'deepseek', name: '蓄气', desc: '原地回气 · 被打伤害 ×1.5', state: 'charge', aura: true, sfx: 'boom_1' },
  { who: 'gpt', name: '气弹', desc: '14 气 · 远程一发', state: 'blast', phase: 'startup', st: 11, sfx: 'blast_1',
    fx: (h, t, cc) => { glowBall(h.front[0] + 18, h.front[1], 26, cc, 0.8); const d = (t * 260) % 170; glowBall(h.front[0] + 40 + d, h.front[1], 30, cc, 1 - d / 220); } },
  { who: 'claude', name: '气功波', desc: '50 气 · 蓄 0.5 秒 · 280 伤害', state: 'beam', phase: 'firing', sfx: 'beam_fire_1',
    fx: (h, t, cc, cell) => { beamLine(h.front[0] + 10, h.front[1], cell.x1, 30 + 4 * Math.sin(t * 20), cc); glowBall(h.front[0] + 12, h.front[1], 48, cc, 1); } },
  { who: 'gemini', name: '瞬移', desc: '16 气 · 无敌 · 能穿到身后', state: 'dash', phase: 'moving', ghosts: true, sfx: 'blast_3' },
  { who: 'claude', vs: 'doubao', name: '对波', desc: '两波相撞 · 推到谁那边谁挨', sfx: 'bigboom_0' },
];
function rulesCell(m, cx, cy, a, t, cw) {
  const c1 = col(m.who), feet = cy + 248;
  if (m.vs) {                                                               // two figures, two beams meeting in the middle
    const c2 = col(m.vs), h1 = fighter(m.who, cx - 150, feet, 0.92, 'clash', { alpha: a, ki: 90 }), h2 = fighter(m.vs, cx + 150, feet, 0.92, 'clash', { alpha: a, flip: true, ki: 90 });
    if (!h1) return;
    const mid = cx + 16 * Math.sin(t * 3.1) + 8 * Math.sin(t * 7.3), y = h1.front[1];
    beamLine(h1.front[0] + 6, y, mid, 22, c1, a); beamLine(h2.front[0] - 6, y, mid, 22, c2, a);
    glowBall(mid, y, 70 + 8 * Math.sin(t * 13), '#ffffff', a); burst(mid, y, 34, c1, t, 10);
    return;
  }
  const x = cx - (m.fx || m.ghosts ? 70 : 0);
  if (m.aura) aura(x, feet, 230, c1, a, t);
  if (m.ghosts) for (let i = 3; i >= 1; i--) fighter(m.who, x - i * 52, feet, 1.1, m.state, { phase: m.phase, alpha: a * (0.32 - i * 0.08), ki: 90 });
  const h = fighter(m.who, x, feet, 1.1, m.state, { phase: m.phase, st: m.st ?? 6, alpha: a, ki: 90, tick: t * 60 });
  if (m.ghosts) {                                                           // speed streaks behind the dash
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * 0.5; g.strokeStyle = c1; g.lineWidth = 3;
    for (let i = 0; i < 5; i++) { const yy = feet - 40 - i * 34; g.beginPath(); g.moveTo(x - 150, yy); g.lineTo(x - 60 - (i % 2) * 30, yy); g.stroke(); }
    g.restore();
  }
  if (h && m.fx) { g.save(); g.globalAlpha = a; m.fx(h, t, c1, { x1: cx + cw / 2 - 30 }); g.restore(); }
}

// ---- each contestant's style, shown in its most used pose
const STYLE_FX = {
  light: { state: 'light', phase: 'active', sfx: 'punch_light_1', fx: (h, t, cc) => burst(h.front[0] + 14, h.front[1], 28 + 6 * Math.sin(t * 14), cc, t, 7) },
  heavy: { state: 'heavy', phase: 'active', sfx: 'punch_heavy_1', fx: (h, t, cc) => burst(h.front[0] + 16, h.front[1], 42, cc, t, 9) },
  guard: { state: 'guard', sfx: 'shield_1', fx: (h, t, cc) => shieldArc(h.chest[0] + 6, h.chest[1] + 20, 105, 1, cc, 0.8 + 0.2 * Math.sin(t * 5)) },
  blast: { state: 'blast', phase: 'startup', st: 11, sfx: 'blast_1', fx: (h, t, cc) => { glowBall(h.front[0] + 18, h.front[1], 24, cc, 0.8); const d = (t * 260) % 160; glowBall(h.front[0] + 40 + d, h.front[1], 28, cc, 1 - d / 210); } },
  charge: { state: 'charge', aura: true, sfx: 'boom_1' },
};

// ---- the cards. secs: length; sfx(d): [[seconds, sample, gain, playback rate]]; draw(t, d)
const CARDS = {
  title: { secs: 5, sfx: () => [[0.25, 'boom_0', 0.35, 0.8], [0.55, 'gong_0', 0.75], [1.9, 'blast_2', 0.25]],
    draw(t, d) {
      bg(t);
      const feet = H * 0.84;
      d.lineup.forEach((p, i) => {                                            // the six, each with its name under its feet
        const a = ease((t - 0.1 * i) / 0.5), la = ease((t - 0.35 - 0.1 * i) / 0.4), x = W / 2 + (i - 2.5) * 290;
        aura(x, feet, 280, col(p.id), a * 0.6, t + i); fighter(p.id, x, feet + (1 - a) * 80, 1.5, 'idle', { alpha: a, tick: t * 60 });
        text(p.short, x, feet + 46, 40, col(p.id), { alpha: la });
        plain(p.model, x, feet + 88, 24, '#ffffffcc', { alpha: la, weight: 700 });
      });
      const a = ease((t - 0.5) / 0.5);
      text('AI 武道会', W / 2, H * 0.2, 200 * (0.85 + 0.15 * a), '#fff6d0', { glow: '#ffb15c', alpha: a });
      text(d.episode, W / 2, H * 0.34, 58, '#ffe36b', { alpha: ease((t - 1.0) / 0.5) });
      text(d.question, W / 2, H * 0.43, 50, '#ffffff', { glow: '#7fd4ff', alpha: ease((t - 1.8) / 0.5), weight: 800 });
    } },
  rules: { secs: 17, sfx: () => [...MOVES.map((m, i) => [0.7 + i * 1.15, m.sfx, 0.5]), [10.4, 'gong_1', 0.5]],
    draw(t, d) {
      bg(t, '#16364f');
      text('规则：一张图看懂', W / 2, 84, 56, '#fff', { glow: '#7fd4ff' });
      const cw = W / 4 - 30, ch = 372;
      MOVES.forEach((m, i) => {
        const a = ease((t - 0.7 - i * 1.15) / 0.45); if (a <= 0) return;
        const cx = W / 8 + (W / 4) * (i % 4), cy = 150 + (ch + 18) * Math.floor(i / 4);
        panel(cx - cw / 2, cy, cw, ch, a);
        rulesCell(m, cx, cy, a, t - 0.7 - i * 1.15, cw);
        text(m.name, cx, cy + 296, 48, col(m.who), { alpha: a });
        plain(m.desc, cx, cy + 342, 27, '#ffffff', { alpha: a });
      });
      text(d.footer, W / 2, H - 52, 34, '#ffe36b', { alpha: ease((t - 10.4) / 0.6), weight: 800 });
    } },
  contestant: { secs: 3.6, sfx: () => [[0.02, 'blast_4', 0.72, 0.9], [0.75, 'punch_light_3', 0.8]],
    draw(t, d) {
      const p = castOf(d.id).palette; bg(t, '#132f48');
      const a = ease(t / 0.45), x = W * 0.25 - (1 - a) * 160;
      rays(x, H * 0.62, 700, p[1], t, a * 0.8); aura(x, H * 0.9, 560, p[1], a, t);
      fighter(d.id, x, H * 0.9, 2.75, 'charge', { alpha: a, tick: t * 60, ki: 100 });
      text(d.short, W * 0.45, H * 0.27, 124, p[1], { align: 'left', alpha: ease((t - 0.15) / 0.45) });
      plain(d.model, W * 0.45 + 6, H * 0.37, 38, '#ffffffdd', { align: 'left', alpha: ease((t - 0.3) / 0.45), weight: 700 });
      if (t > 0.7) bubble(d.line, W * 0.45, H * 0.55, 60, p[1], ease((t - 0.7) / 0.3));
      plain(d.note, W * 0.45 + 6, H * 0.72, 32, '#ffffffbb', { align: 'left', alpha: ease((t - 1.1) / 0.5) });
    } },
  standings: { secs: 9, sfx: d => d.rows.map((r, i) => [0.3 + i * 0.25, 'punch_light_' + (i % 5), 0.7]),
    draw(t, d) {
      bg(t, '#16364f');
      text(d.title, W / 2, 86, 58, '#fff', { glow: '#7fd4ff' });
      d.rows.forEach((r, i) => {
        const y = 205 + i * 122, a = ease((t - 0.3 - i * 0.25) / 0.5), grow = ease((t - 0.6 - i * 0.25) / 1.4), cc = col(r.id);
        panel(80, y - 52, W - 160, 104, a);
        text(String(i + 1), 150, y, 66, i === 0 ? '#ffe36b' : '#ffffff', { alpha: a });
        fighter(r.id, 255, y + 42, 0.4, 'idle', { alpha: a, tick: t * 60 });
        text(r.name, 320, y, 48, cc, { align: 'left', alpha: a });
        g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(760, y - 20, 640, 40); g.shadowColor = cc; g.shadowBlur = 18; g.fillStyle = cc; g.fillRect(760, y - 20, 640 * r.share * grow, 40); g.restore();
        text(`${Math.round(r.share * 100 * grow)}%`, 1430, y, 46, '#ffffff', { align: 'left', alpha: a, glow: null });
        plain(r.record, 1580, y, 28, '#ffffffaa', { align: 'left', alpha: a });
      });
      plain(d.foot, W / 2, H - 50, 32, '#ffe36b', { alpha: ease((t - 2.6) / 0.6), weight: 700 });
    } },
  triangle: { secs: 9, sfx: d => d.edges.map((e, i) => [1.0 + i * 1.3, 'beam_fire_' + (i % 3), 0.6]).concat([[5.4, 'gong_1', 0.8]]),
    draw(t, d) {
      bg(t, '#16364f');
      text(d.title, W / 2, 86, 58, '#fff', { glow: '#7fd4ff' });
      const P = {}; d.nodes.forEach((n, i) => { P[n.id] = [[W / 2, 470], [W / 2 - 470, 930], [W / 2 + 470, 930]][i]; });
      d.nodes.forEach((n, i) => {
        const a = ease((t - 0.2 - i * 0.15) / 0.5), [x, y] = P[n.id];
        aura(x, y, 300, col(n.id), a * 0.7, t + i); fighter(n.id, x, y, 1.25, 'idle', { alpha: a, tick: t * 60, flip: x > W / 2 + 10 });
        text(n.name, x, y + 48, 40, col(n.id), { alpha: a });
      });
      d.edges.forEach(([w, l, pct], i) => {
        const p = ease((t - 1.0 - i * 1.3) / 0.9), a = [P[w][0], P[w][1] - 140], b = [P[l][0], P[l][1] - 140];
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), cut = 170;
        const m = arrow([a[0] + (dx / L) * cut, a[1] + (dy / L) * cut], [b[0] - (dx / L) * cut, b[1] - (dy / L) * cut], col(w), p, -60);
        if (m && p > 0.5) { const ox = m[0] - W / 2, oy = m[1] - 690, L = Math.hypot(ox, oy); text(`赢 ${pct}%`, m[0] + (ox / L) * 100, m[1] + (oy / L) * 60, 50, col(w), { alpha: ease((p - 0.5) / 0.4) }); }
      });
      text(d.center, W / 2, 735, 44, '#ffffff', { alpha: ease((t - 5.4) / 0.5), weight: 800, glow: '#7fd4ff' });
      plain(d.foot, W / 2, H - 46, 32, '#ffe36b', { alpha: ease((t - 6.2) / 0.5), weight: 700 });
    } },
  styles: { secs: 14, sfx: d => d.rows.map((r, i) => [0.6 + i * 1.8, STYLE_FX[r.pose].sfx, 0.6]),
    draw(t, d) {
      bg(t, '#16364f');
      text(d.title, W / 2, 84, 56, '#fff', { glow: '#7fd4ff' });
      d.rows.forEach((r, i) => {
        const a = ease((t - 0.6 - i * 1.8) / 0.45); if (a <= 0) return;
        const cx = W / 2 + ((i % 3) - 1) * 610, top = 150 + Math.floor(i / 3) * 440, feet = top + 250, cc = col(r.id), P = STYLE_FX[r.pose];
        panel(cx - 290, top, 580, 420, a);
        if (P.aura) aura(cx - 40, feet, 220, cc, a, t);
        const h = fighter(r.id, cx - 40, feet, 1.05, P.state, { phase: P.phase, st: P.st ?? 6, alpha: a, ki: 90, tick: t * 60 });
        if (h && P.fx) { g.save(); g.globalAlpha = a; P.fx(h, t, cc); g.restore(); }
        text(`${r.name}：${r.style}`, cx, top + 292, 44, cc, { alpha: a });
        r.lines.forEach((l, k) => plain(l, cx, top + 342 + k * 38, 28, '#ffffff', { alpha: a }));
      });
      plain(d.foot, W / 2, H - 40, 30, '#ffe36b', { alpha: ease((t - 11) / 0.6), weight: 700 });
    } },
  aftermatch: { secs: 17, sfx: d => d.rows.map((r, i) => [0.6 + i * 2.4, 'punch_light_' + (i % 5), 0.6]),
    draw(t, d) {
      bg(t, '#16364f');
      text(d.title, W / 2, 70, 56, '#fff', { glow: '#7fd4ff' });
      plain(d.sub, W / 2, 124, 28, '#ffffffaa', { alpha: ease(t / 0.5) });
      d.rows.forEach((r, i) => {
        const y = 230 + i * 140, a = ease((t - 0.6 - i * 2.4) / 0.45), cc = col(r.id); if (a <= 0) return;
        panel(90, y - 62, W - 180, 124, a, r.champion ? '#ffe36b88' : undefined);
        text(r.rank, 150, y, r.rank.length > 1 ? 40 : 56, r.champion ? '#ffe36b' : '#ffffff', { alpha: a });
        fighter(r.id, 235, y + 48, 0.44, 'idle', { alpha: a, tick: t * 60 });
        text(r.name, 290, y, 42, cc, { align: 'left', alpha: a });
        plain(`赛前　${r.before}`, 620, y - 26, 28, '#ffffff99', { align: 'left', alpha: a });
        text(`赛后　${r.after}`, 620, y + 22, 38, '#ffffff', { align: 'left', alpha: a, weight: 800, glow: null });
      });
    } },
  cover: { secs: 1,
    draw(t, d) {
      g.drawImage(card.img, 0, 0, W, H);
      const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 1.0); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
      g.fillStyle = v; g.fillRect(0, 0, W, H);
      const band = g.createLinearGradient(0, 0, 0, H * 0.45); band.addColorStop(0, 'rgba(4,8,26,0.95)'); band.addColorStop(0.36, 'rgba(4,8,26,0.85)'); band.addColorStop(1, 'rgba(4,8,26,0)');   // over the HUD
      g.fillStyle = band; g.fillRect(0, 0, W, H * 0.45);
      text(d.big, W / 2, H * 0.22, 250, '#ffe36b', { glow: '#ff9a3c' });
      text(d.line, W / 2, H * 0.8, 84, '#ffffff', { glow: '#7fd4ff' });
      text(d.small, W / 2, H * 0.91, 48, '#ffe36b', { weight: 800 });
    } },
  inter: { secs: 2.2, sfx: d => [[0, d.vs ? 'bigboom_1' : 'boom_3', d.vs ? 0.55 : 1]],
    draw(t, d) {
      bg(t);
      const a = ease(t / 0.3);
      if (d.vs) d.vs.forEach((id, i) => {
        const x = i ? W * 0.86 : W * 0.14, sl = (1 - a) * 200 * (i ? 1 : -1);
        aura(x + sl, H * 0.93, 480, col(id), a, t + i); fighter(id, x + sl, H * 0.93, 2.3, 'guard', { flip: !!i, alpha: a, tick: t * 60, ki: 80 });
      });
      if (t < 0.12) { g.fillStyle = `rgba(255,255,255,${0.55 * (1 - t / 0.12)})`; g.fillRect(0, 0, W, H); }
      text(d.text, W / 2, H / 2 - 40, 160 * (1.12 - 0.12 * a), '#fff6d0', { glow: '#ffb15c', alpha: a });
      if (d.sub) text(d.sub, W / 2, H / 2 + 100, 50, '#ffffff', { alpha: ease((t - 0.3) / 0.4), weight: 800, glow: '#7fd4ff' });
      if (d.sub2) plain(d.sub2, W / 2, H / 2 + 172, 34, '#ffe36b', { alpha: ease((t - 0.5) / 0.4), weight: 700 });
    } },
  freeze: { secs: 2.4, sfx: () => [[0, 'gong_1', 0.8], [0, 'bigboom_0', 0.35, 0.7]],
    draw(t, d) {
      const z = 1 + 0.05 * ease(t / 2.4), w = W * z, h = H * z;
      g.save(); g.filter = `grayscale(${Math.min(0.7, t * 3)}) brightness(${1 - Math.min(0.45, t * 1.5)})`; g.drawImage(card.img, (W - w) / 2, (H - h) / 2, w, h); g.restore();
      if (t < 0.1) { g.fillStyle = `rgba(255,255,255,${0.8 * (1 - t / 0.1)})`; g.fillRect(0, 0, W, H); }
      const a = ease((t - 0.08) / 0.25);
      text(d.text, W / 2, H * 0.47, 200 * (1.15 - 0.15 * a), '#ffe36b', { alpha: a, glow: '#ff9a3c' });
      if (d.sub) text(d.sub, W / 2, H * 0.64, 50, '#ffffff', { alpha: ease((t - 0.45) / 0.35), weight: 800 });
    } },
  champion: { secs: 7, sfx: () => [[0.15, 'bigboom_0', 0.35], [0.35, 'gong_0', 0.7], [1.5, 'punch_light_2', 0.6]],
    draw(t, d) {
      const p = castOf(d.id).palette; bg(t, '#3a3414');
      const a = ease(t / 0.6);
      rays(W / 2, H * 0.62, 1100, p[1], t, a); aura(W / 2, H * 0.97, 600, p[1], a, t);
      fighter(d.id, W / 2, H * 0.97, 2.9, 'charge', { tick: t * 60, ki: 100, alpha: a });
      text(d.title, W / 2, H * 0.12, 72, '#ffe36b', { alpha: a });
      text(d.name, W / 2, H * 0.25, 150, p[1], { alpha: ease((t - 0.3) / 0.6) });
      plain(d.sub, W / 2, H * 0.34, 38, '#ffffff', { alpha: ease((t - 0.9) / 0.6), weight: 700 });
      if (t > 1.4) bubble(d.line, W * 0.6, H * 0.45, 54, p[1], ease((t - 1.4) / 0.3));
    } },
  vote: { secs: 8, sfx: d => [...d.options.map((o, i) => [0.6 + i * 0.4, 'punch_light_' + (i + 1), 0.7]), [2.4, 'gong_1', 0.85]],
    draw(t, d) {
      bg(t);
      text(d.title, W / 2, 150, 92, '#fff6d0', { glow: '#ffb15c', alpha: ease(t / 0.5) });
      d.options.forEach((o, i) => {
        const y = 345 + i * 160, a = ease((t - 0.6 - i * 0.4) / 0.5);
        panel(W / 2 - 640, y - 62, 1280, 124, a, '#ffe36b66');
        text(o[0], W / 2 - 560, y, 64, '#ffe36b', { alpha: a });
        text(o[1], W / 2 - 480, y, 50, '#ffffff', { align: 'left', alpha: a, weight: 800, glow: null });
      });
      text(d.foot, W / 2, H - 120, 46, '#ffe36b', { alpha: ease((t - 2.4) / 0.5), weight: 800 });
    } },
};

window.__card = async (type, data) => {
  card = { def: CARDS[type], data, frames: Math.round((data.secs || CARDS[type].secs) * FPS) };   // data.secs: this card held longer
  if (data.img) { card.img = new Image(); card.img.src = data.img; await card.img.decode(); }
  return card.frames;
};
window.__drawCard = k => { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); card.def.draw(k / FPS, card.data); return c.toDataURL('image/jpeg', 0.92); };
window.__cardAudio = async () => {
  const rate = 48000, secs = card.frames / FPS, off = new OfflineAudioContext(2, Math.round(secs * rate), rate), list = card.def.sfx ? card.def.sfx(card.data) : [];
  const master = off.createGain(); master.connect(off.destination);
  master.gain.setValueAtTime(1, Math.max(0, secs - 0.25)); master.gain.linearRampToValueAtTime(0, secs);   // no click where the card ends
  const bufs = {};
  for (const [, name] of list) if (!bufs[name]) bufs[name] = await off.decodeAudioData(await (await fetch(`/assets/sfx/${name}.mp3`)).arrayBuffer());
  for (const [at, name, gain = 1, speed = 1] of list) {
    const src = off.createBufferSource(), gn = off.createGain(); src.buffer = bufs[name]; src.playbackRate.value = speed; gn.gain.value = gain;
    src.connect(gn).connect(master); src.start(at);
  }
  return toWav(await off.startRendering());
};
window.READY = true;
