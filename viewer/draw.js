// draw.js: one frame of a fight on a 2D canvas: the fighters as anime/stick.js draws them (black strokes glowing in their colour), blasts,
// beams, the clash, hit sparks, the HUD. This is the viewer's and the playable Toy's picture; the anime replays for the episodes
// are rendered separately from the same frames. Trigonometry is fine here: drawing never feeds back into the fight.
//
//   drawFrame(ctx, { frames, at, byTick, names, rules, result, fx, who, clean, hud, cam })   frames: match.frames; at: index into them; byTick: Map tick -> events;
//   hud: false leaves the bars and names to the page; cam: { x, zoom, ground } looks at stage x (units) from closer, with the ground line at
//   canvas y `ground` (a taller canvas than W x H shows more sky);
//   who: the two cast ids (anime/fighters.js) for colour and hair, 'other' for a fighter without one;
//   fx: { hold, phase } while the picture holds on an impact (hold = frames held so far): the shake keeps going, the flash only starts it
import { drawStick, stickJoints } from '../anime/stick.js';
import { CAST, castOf } from '../anime/fighters.js';

export const W = 1280, H = 640, GROUND = 520;
export const COLORS = ['#ff9a3c', '#45d3ff'];                    // for fighters without a cast entry (sparring bots, you): by side
let SIDE = COLORS;                                               // this frame's two colours (set in drawFrame from who)
const SX = W / 1000, px = x => x * SX;
const lerp = (a, b, k) => a + (b - a) * k, clamp01 = k => (k < 0 ? 0 : k > 1 ? 1 : k);

function aura(ctx, J, color, k, tick, seed) {
  if (k <= 0) return;
  const [cx, cy] = [(J.hip[0] + J.head[0]) / 2, (J.hip[1] + J.head[1]) / 2 + 20];
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + seed, fl = Math.sin(tick * 0.5 + i * 1.7) * 0.5 + 0.5;
    const w = 26 + 10 * fl, h = (70 + 50 * fl) * k;
    ctx.globalAlpha = 0.18 * k + 0.1;
    const g = ctx.createLinearGradient(cx, cy + 60, cx, cy - h); g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath();
    const ox = Math.cos(a) * 28;
    ctx.moveTo(cx + ox - w, cy + 70); ctx.quadraticCurveTo(cx + ox - w * 0.6, cy - h * 0.3, cx + ox + Math.sin(tick * 0.3 + i) * 10, cy - h);
    ctx.quadraticCurveTo(cx + ox + w * 0.6, cy - h * 0.3, cx + ox + w, cy + 70); ctx.fill();
  }
  ctx.restore();
}

// a fighter: the figure is anime/stick.js's (the same one the replays use), with this viewer's aura, shield and ball of light
function fighter(ctx, F, side, R, tick, alpha = 1, ghost = false, who = 'other') {
  const [x, state, t, f, , ki, ph] = F;
  let fx = px(x);
  if (state === 'hitstun' || state === 'crushed') fx += Math.sin(t * 2.3) * (state === 'crushed' ? 3 : 5) * (1 - t / 20);
  const jt = stickJoints(who, F, R, tick), map = p => [fx + f * p[0] * jt.k, GROUND + p[1] * jt.k], col = SIDE[side];
  const J = { hip: map(jt.J.hip), chest: map(jt.J.chest), head: map(jt.J.head), fa: jt.J.fa.map(map), ba: jt.J.ba.map(map), fl: jt.J.fl.map(map), bl: jt.J.bl.map(map) };
  ctx.save(); ctx.globalAlpha = alpha * (ghost ? 0.6 : 1);
  const charging = state === 'charge' ? 1 : state === 'beam' && ph === 'startup' ? 0.7 : state === 'clash' ? 0.9 : 0;
  if (!ghost) aura(ctx, J, col, charging, tick, side * 1.3);
  ctx.save(); ctx.translate(fx, GROUND); ctx.scale(f, 1); drawStick(ctx, who, F, R, { tick, glow: col }); ctx.restore();
  if (state === 'guard' || state === 'blockstun') {                       // the guard as a ki shield in front
    ctx.strokeStyle = col; ctx.globalAlpha = alpha * (state === 'blockstun' ? 0.9 : 0.45); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(fx + f * 10, GROUND - 95, 62, -Math.PI / 2.4 + (f < 0 ? Math.PI : 0), Math.PI / 2.4 + (f < 0 ? Math.PI : 0)); ctx.stroke();
  }
  if ((state === 'blast' && ph === 'startup') || (state === 'beam' && ph === 'startup')) {   // the ball forming in the hands
    const hand = state === 'blast' ? J.fa[2] : J.fa[2], r = state === 'blast' ? 6 + t : 4 + t * 0.6;
    glowBall(ctx, hand[0], hand[1], Math.min(r, 22), col);
  }
  if (state === 'crushed') stars(ctx, J.head[0], J.head[1] - 30, tick);
  ctx.restore();
  return J;
}

function glowBall(ctx, x, y, r, col) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

function stars(ctx, x, y, tick) {
  ctx.fillStyle = '#ffe36b';
  for (let i = 0; i < 3; i++) { const a = tick * 0.15 + (i * Math.PI * 2) / 3; const sx = x + Math.cos(a) * 22, sy = y + Math.sin(a) * 7; ctx.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? 2.5 : 6, aa = (k * Math.PI) / 5; ctx.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr); } ctx.fill(); }
}

function beamRay(ctx, from, front, dir, col, tick, frozen) {
  const x0 = px(from), x1 = px(front), y = GROUND - 100, w = 30 + Math.sin(tick * 0.9) * 3;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, y - w, 0, y + w); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, col); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.7, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), y - w, Math.abs(x1 - x0), w * 2);
  if (!frozen) glowBall(ctx, x1, y, 26, col);
  ctx.restore();
}

function spark(ctx, x, y, k, size, col) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
  const n = 10, r0 = size * (0.3 + k), r1 = size * (0.7 + k * 1.6);
  ctx.globalAlpha = 1 - k;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + i * 0.37; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke(); }
  glowBall(ctx, x, y, size * 0.5 * (1 - k), col);
  ctx.restore();
}

function stage(ctx, R) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1230'); g.addColorStop(0.65, '#1d2a55'); g.addColorStop(1, '#141a33');
  ctx.fillStyle = g; ctx.fillRect(0, -2 * H, W, 3 * H);                                 // the sky goes on up, for a closer camera on a taller canvas
  ctx.fillStyle = '#121a3a'; ctx.beginPath(); ctx.moveTo(0, GROUND - 40);              // far hills
  for (let i = 0; i <= 16; i++) ctx.lineTo((i / 16) * W, GROUND - 60 - Math.abs(Math.sin(i * 1.7) * 70) - (i % 3) * 18);
  ctx.lineTo(W, GROUND); ctx.lineTo(0, GROUND); ctx.fill();
  const l = px(R.stage.left) - 30, r = px(R.stage.right) + 30;                         // the stone ring
  ctx.fillStyle = '#2b2f45'; ctx.fillRect(l, GROUND, r - l, 26);
  ctx.fillStyle = '#3a3f5c'; ctx.fillRect(l, GROUND, r - l, 4);
  ctx.strokeStyle = '#23263a'; ctx.lineWidth = 2;
  for (let x = l; x < r; x += 64) { ctx.beginPath(); ctx.moveTo(x, GROUND + 4); ctx.lineTo(x, GROUND + 26); ctx.stroke(); }
  ctx.fillStyle = '#0a0d1c'; ctx.fillRect(0, GROUND + 26, W, H);
}

function hud(ctx, fr, prev, names, R, tick, clean) {                   // clean: no state readout (the playable page)
  const bw = 520, bh = 18, y = 26;
  fr.f.forEach((F, i) => {
    const hp = Math.max(0, F[4]) / R.hp, was = Math.max(0, prev.f[i][4]) / R.hp, ki = F[5] / R.kiMax;
    const x = i ? W - 30 - bw : 30, al = i ? -1 : 1, X = (k) => (i ? x + bw - bw * k : x);
    ctx.fillStyle = '#0006'; ctx.fillRect(x - 2, y - 2, bw + 4, bh + 4);
    ctx.fillStyle = '#ffffff55'; ctx.fillRect(X(was), y, bw * was, bh);
    ctx.fillStyle = hp > 0.3 ? SIDE[i] : '#ff4040'; ctx.fillRect(X(hp), y, bw * hp, bh);
    ctx.fillStyle = '#0008'; ctx.fillRect(x, y + bh + 6, bw, 8);
    ctx.fillStyle = ki >= R.beam.cost / R.kiMax ? '#fff3a0' : '#9fe6ff'; ctx.fillRect(X(ki), y + bh + 6, bw * ki, 8);
    for (const c of [R.dash.cost, R.blast.cost, R.beam.cost]) { ctx.fillStyle = '#ffffff88'; ctx.fillRect(i ? x + bw - (bw * c) / R.kiMax : x + (bw * c) / R.kiMax, y + bh + 4, 2, 12); }
    ctx.font = 'bold 18px system-ui, sans-serif'; ctx.fillStyle = SIDE[i]; ctx.textAlign = i ? 'right' : 'left';
    ctx.fillText(`${names[i]}  ${Math.max(0, F[4])}`, i ? x + bw : x, y + bh + 36);
    if (!clean) {
      ctx.font = '13px ui-monospace, monospace'; ctx.fillStyle = '#ffffffaa';
      ctx.fillText(`${F[1]}${F[6] ? ' · ' + F[6] : ''} ${F[2]}  气 ${Math.round(F[5])}`, i ? x + bw : x, y + bh + 54);
    }
    void al;
  });
  ctx.textAlign = 'center'; ctx.font = 'bold 30px system-ui, sans-serif'; ctx.fillStyle = '#fff';
  ctx.fillText(String(Math.max(0, Math.ceil((R.maxTicks - tick) / R.fps))), W / 2, 48);
  if (!clean) { ctx.font = '12px ui-monospace, monospace'; ctx.fillStyle = '#ffffff77'; ctx.fillText(`tick ${tick}`, W / 2, 66); }
}

const POP = { crush: '破防!', dodge: '闪!', clash: '对冲!', clash_win: '推回去了!', clash_draw: '爆炸!', blast_clash: '相杀' };

export function drawFrame(ctx, { frames, at, byTick, names, rules: R, result, fx, who = ['other', 'other'], clean = false, hud: withHud = true, cam = null }) {
  SIDE = who.map((w, i) => (CAST[w] && w !== 'other' ? CAST[w].palette[1] : COLORS[i]));
  const i = Math.max(0, Math.min(frames.length - 1, at | 0)), fr = frames[i], tick = i;
  // shake from big hits in the last frames
  let shake = 0, flash = 0;
  for (let k = 0; k < 12; k++) for (const e of byTick.get(i - k) || []) {
    const big = e.type === 'crush' || e.type === 'clash_win' || e.type === 'clash_draw' || (e.type === 'hit' && (e.kind === 'heavy' || e.kind === 'beam'));
    if (big) { shake = Math.max(shake, 10 * (1 - k / 12)); if (k < 2) flash = Math.max(flash, 0.55 - k * 0.25); }
  }
  const holding = fx && fx.hold != null, ph = holding ? fx.phase : i;
  if (holding) { flash = fx.hold < 2 ? flash : 0; shake = Math.max(shake, 6); }
  ctx.save();
  if (shake) ctx.translate(Math.sin(ph * 7.1) * shake, Math.cos(ph * 5.3) * shake * 0.6);
  if (cam) { ctx.translate(W / 2, cam.ground ?? GROUND); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-px(cam.x), -GROUND); }
  stage(ctx, R);
  // afterimages of a dash
  fr.f.forEach((F, side) => { if (F[1] === 'dash' && F[6] === 'moving') for (let k = 3; k >= 1; k--) { const old = frames[i - k * 2]; if (old) fighter(ctx, old.f[side], side, R, tick, 0.18 * (4 - k) / 3, true, who[side]); } });
  // beams behind the bodies, then bodies, then blasts and the clash in front
  fr.m.forEach((b, side) => b && beamRay(ctx, b[0], b[1], b[2], SIDE[side], tick, !!fr.c));
  const J = fr.f.map((F, side) => fighter(ctx, F, side, R, tick, F[1] === 'dash' && F[6] === 'moving' && F[2] < R.dash.invuln ? 0.45 : 1, false, who[side]));
  for (const [owner, x, dir] of fr.b) {
    for (let k = 3; k >= 1; k--) glowBall(ctx, px(x - dir * k * 9), GROUND - 100, 9 - k * 2, SIDE[owner]);
    glowBall(ctx, px(x), GROUND - 100, 13, SIDE[owner]);
  }
  if (fr.c) {
    const [c, t] = fr.c, x = px(c), y = GROUND - 100, r = 34 + Math.sin(t * 0.8) * 6 + Math.min(t, 60) * 0.3;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 14; k++) { const a = k * 0.45 + t * 0.07; ctx.strokeStyle = k % 2 ? SIDE[0] : SIDE[1]; ctx.lineWidth = 3; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 2.4, y + Math.sin(a) * r * 1.6); ctx.stroke(); }
    ctx.restore(); glowBall(ctx, x, y, r, '#fff6c8');
  }
  // sparks and words for what just happened
  for (let k = 0; k < 14; k++) for (const e of byTick.get(i - k) || []) {
    const kk = k / 14;
    if (e.type === 'hit' || (e.type === 'block' && k < 8)) {
      const def = e.type === 'hit' ? 1 - e.side : e.side, Jd = J[def]; if (!Jd) continue;
      const size = e.type === 'block' ? 18 : e.kind === 'light' ? 26 : e.kind === 'blast' ? 34 : 52;
      spark(ctx, (Jd.chest[0] + Jd.head[0]) / 2, Jd.chest[1] + 8, e.type === 'block' ? k / 8 : kk, size, e.type === 'block' ? '#9fe6ff' : SIDE[e.type === 'hit' ? e.side : 1 - e.side]);
      if (e.type === 'hit' && e.combo >= 2 && k < 12) { ctx.font = 'bold 26px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe36b'; ctx.globalAlpha = 1 - kk; ctx.fillText(`${e.combo} 连击`, Jd.head[0], Jd.head[1] - 46 - k * 1.5); ctx.globalAlpha = 1; }
    }
    if (POP[e.type] && k < 14) {
      const who = e.side >= 0 ? J[e.type === 'dodge' ? e.side : e.type === 'crush' ? 1 - e.side : e.side] : null;
      const x = who ? who.head[0] : W / 2, y = (who ? who.head[1] : GROUND - 180) - 60 - k * 2;
      ctx.font = 'bold 34px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.globalAlpha = 1 - kk; ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(POP[e.type], x, y); ctx.fillStyle = '#fff'; ctx.fillText(POP[e.type], x, y); ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  if (flash) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); }
  if (fr.c) {                                                              // who is pushing the clash harder, on the screen (not the stage)
    const share = fr.c[2] / (fr.c[2] + fr.c[3]);
    const y = withHud ? 96 : 150;
    ctx.fillStyle = '#0008'; ctx.fillRect(W / 2 - 160, y, 320, 10); ctx.fillStyle = SIDE[0]; ctx.fillRect(W / 2 - 160, y, 320 * share, 10); ctx.fillStyle = SIDE[1]; ctx.fillRect(W / 2 - 160 + 320 * share, y, 320 * (1 - share), 10);
  }
  if (withHud) hud(ctx, fr, frames[Math.max(0, i - 20)], names, R, tick, clean);
  if (result && i >= frames.length - 1) {
    ctx.textAlign = 'center'; ctx.font = 'bold 96px system-ui, sans-serif'; ctx.lineWidth = 10; ctx.strokeStyle = '#000';
    ctx.strokeText(result.big, W / 2, H / 2 - 20); ctx.fillStyle = '#ffe36b'; ctx.fillText(result.big, W / 2, H / 2 - 20);
    ctx.font = 'bold 32px system-ui, sans-serif'; ctx.lineWidth = 6; ctx.strokeText(result.small, W / 2, H / 2 + 30); ctx.fillStyle = '#fff'; ctx.fillText(result.small, W / 2, H / 2 + 30);
  }
}
