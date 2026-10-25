// fighters.js: the six contestants as silhouettes, the look dandan tried: a solid black figure that its own ki outlines in colour.
// Every fighter has the same body (the engine treats them all alike); they are told apart only by colour and hair.
// A figure is drawn in its own space: feet at (0, 0), y up, facing +x; units are "body units" (about 200 from soles to crown).
//
//   drawFighter(ctx, who, pose, opts)   draws the silhouette (black) into a 2D context already moved to the feet and scaled
//   poseFor(F, R, t)                   the pose for an engine frame F = [x, state, t, facing, hp, ki, phase, combo] at film time t (s)
//   CAST[who]: { name, palette: [core, body, edge], build, hair, extras }
export const CAST = {
  claude:   { name: 'Claude Opus 5.5', palette: ['#fff3e0', '#ffb15c', '#ff6a1f'], build: { k: 1, sh: 1, arm: 1, leg: 1 }, hair: 'flame', extras: ['sash', 'bands'] },
  gpt:      { name: 'GPT-6 Astra', palette: ['#eafff8', '#5ff2c8', '#10b48c'], build: { k: 1, sh: 1, arm: 1, leg: 1 }, hair: 'flat', extras: ['scarf'] },
  gemini:   { name: 'Gemini 4 Argon', palette: ['#fff0ff', '#d79bff', '#a35bff'], build: { k: 1, sh: 1, arm: 1, leg: 1 }, hair: 'twin', extras: ['twintails', 'sash'] },
  kimi:     { name: 'Kimi K3.1 Pro', palette: ['#fffdf2', '#f6e7a8', '#d9b75a'], build: { k: 1, sh: 1, arm: 1, leg: 1 }, hair: 'long', extras: ['longhair', 'coat', 'crescent'] },
  deepseek: { name: 'DeepSeek V4 Pro', palette: ['#eef6ff', '#7fb2ff', '#2f6bff'], build: { k: 1, sh: 1, arm: 1, leg: 1 }, hair: 'hood', extras: ['hood', 'bands'] },
  doubao:   { name: '豆包 Seed 2.1', palette: ['#fbffe8', '#c6f55a', '#7fc21a'], build: { k: 1, sh: 1, arm: 1, leg: 1 }, hair: 'buns', extras: ['sash'] },
  other:    { name: '', palette: ['#ffffff', '#cfd8ff', '#8090c0'], build: { k: 1, sh: 1, arm: 1, leg: 1 }, hair: 'spiky', extras: ['sash'] },
};
export const castOf = id => CAST[id] || CAST.other;

const lerp = (a, b, k) => a + (b - a) * k, clamp01 = k => (k < 0 ? 0 : k > 1 ? 1 : k);
const ease = k => k * k * (3 - 2 * k);

// ---- poses: angles in radians from straight down, positive = toward the facing; lean tilts the torso about the hip ----------------
// fa/ba: front/back arm [shoulder, elbow]; fl/bl: front/back leg [hip, knee]; crouch lowers the hip; lie turns the body onto its back
const P = {
  idle:    { lean: 0.07, crouch: 9, fa: [2.15, -2.05], ba: [1.55, -1.95], fl: [0.36, -0.34], bl: [-0.34, 0.24], head: 0.05 },
  walk:    { lean: 0.12, crouch: 7, fa: [2.0, -1.9], ba: [1.4, -1.8], fl: [0.36, -0.3], bl: [-0.32, 0.22], head: 0.05 },
  guard:   { lean: -0.04, crouch: 14, fa: [2.7, -2.35], ba: [2.45, -2.15], fl: [0.42, -0.42], bl: [-0.38, 0.28], head: 0.2 },
  charge:  { lean: -0.08, crouch: 20, fa: [-0.5, 0.55], ba: [-0.62, 0.5], fl: [0.55, -0.42], bl: [-0.55, 0.32], head: -0.3 },
  lightUp: { lean: 0.1, crouch: 9, fa: [1.25, -2.4], ba: [1.75, -2.0], fl: [0.4, -0.3], bl: [-0.34, 0.24], head: 0.08 },
  light:   { lean: 0.28, crouch: 6, fa: [1.62, -0.02], ba: [1.3, -2.2], fl: [0.55, -0.22], bl: [-0.45, 0.12], head: 0.1 },
  heavyUp: { lean: -0.22, crouch: 14, fa: [1.9, -1.7], ba: [-1.05, -0.9], fl: [0.32, -0.25], bl: [-0.45, 0.35], head: -0.05 },
  heavy:   { lean: 0.5, crouch: 4, fa: [0.5, -0.9], ba: [1.72, 0.0], fl: [0.92, -0.5], bl: [-0.7, 0.08], head: 0.18 },
  palm:    { lean: 0.15, crouch: 10, fa: [1.57, -0.02], ba: [0.9, -1.7], fl: [0.46, -0.24], bl: [-0.38, 0.2], head: 0.1 },
  kame:    { lean: -0.16, crouch: 22, fa: [-0.32, 1.32], ba: [-0.46, 1.36], fl: [0.6, -0.42], bl: [-0.55, 0.3], head: 0.1 },
  fire:    { lean: 0.2, crouch: 18, fa: [1.6, -0.02], ba: [1.52, -0.02], fl: [0.7, -0.45], bl: [-0.65, 0.22], head: 0.12 },
  dashF:   { lean: 0.75, crouch: 6, fa: [-0.75, 0.25], ba: [-0.95, 0.3], fl: [0.8, -0.95], bl: [-1.0, 0.6], head: 0.3 },
  dashB:   { lean: -0.35, crouch: 8, fa: [1.25, -1.3], ba: [0.95, -1.1], fl: [0.5, -0.3], bl: [-0.25, 0.6], head: -0.1 },
  hurt:    { lean: -0.5, crouch: 8, fa: [0.75, 0.6], ba: [-0.55, 0.45], fl: [0.22, 0.1], bl: [-0.5, 0.25], head: -0.6 },
  crushed: { lean: -0.36, crouch: 6, fa: [2.55, 0.35], ba: [-2.05, -0.25], fl: [0.38, 0.0], bl: [-0.38, 0.12], head: -0.45 },
  down:    { lean: -0.2, crouch: 0, fa: [2.6, 0.3], ba: [-0.4, 0.3], fl: [0.3, -0.2], bl: [0.1, -0.4], head: -0.3 },
};
function mix(a, b, k) {
  const o = {};
  for (const key of Object.keys(a)) o[key] = Array.isArray(a[key]) ? a[key].map((v, i) => lerp(v, b[key][i], k)) : lerp(a[key], b[key] ?? a[key], k);
  return o;
}
const withLie = (p, lie, rise = 0) => ({ ...p, lie, rise });

// the pose for an engine frame, stepped like hand-drawn animation: t is film time in seconds, poses change 12 times a second
export function poseFor(F, R, t) {
  const [, state, tt, , , , ph] = F;
  const step = Math.floor(t * 12);
  const walk = k => { const p = { ...P.walk, fl: [...P.walk.fl], bl: [...P.walk.bl], fa: [...P.walk.fa], ba: [...P.walk.ba] }; const s = Math.sin(step * 1.6) * 0.42 * k; p.fl[0] += s; p.bl[0] -= s; p.fa[0] -= s * 0.25; p.ba[0] += s * 0.25; p.crouch += Math.abs(Math.cos(step * 1.6)) * 4; return withLie(p, 0); };
  const breathe = p => withLie({ ...p, crouch: p.crouch + (step % 4 < 2 ? 0 : 2) }, 0);
  switch (state) {
    case 'idle': return breathe(P.idle);
    case 'forward': return walk(1);
    case 'back': return walk(-0.8);
    case 'guard': return breathe(P.guard);
    case 'blockstun': return withLie({ ...P.guard, lean: -0.22, crouch: 18 }, 0);
    case 'charge': return withLie({ ...P.charge, crouch: P.charge.crouch + (step % 2) * 2, head: -0.3 - (step % 3) * 0.05 }, 0);
    case 'light': { const L = R.light; return withLie(ph === 'startup' ? mix(P.idle, P.lightUp, ease(clamp01(tt / L.startup))) : ph === 'active' ? P.light : mix(P.light, P.idle, ease(clamp01((tt - L.startup - L.active) / L.recovery))), 0); }
    case 'heavy': { const M = R.heavy; return withLie(ph === 'startup' ? mix(P.idle, P.heavyUp, ease(clamp01(tt / M.startup))) : ph === 'active' ? P.heavy : mix(P.heavy, P.idle, ease(clamp01((tt - M.startup - M.active) / M.recovery))), 0); }
    case 'blast': return withLie(ph === 'startup' ? mix(P.idle, P.palm, ease(clamp01(tt / R.blast.startup))) : mix(P.palm, P.idle, ease(clamp01((tt - R.blast.startup) / R.blast.recovery))), 0);
    case 'beam': return withLie(ph === 'startup' ? mix(P.idle, P.kame, ease(clamp01(tt / 8))) : ph === 'firing' ? P.fire : mix(P.fire, P.idle, ease(clamp01(tt / 30))), 0);
    case 'clash': return withLie({ ...P.fire, crouch: P.fire.crouch + (step % 2) * 3, lean: P.fire.lean + (step % 2) * 0.03 }, 0);
    case 'dash': return withLie(ph === 'moving' ? P.dashF : mix(P.dashF, P.idle, ease(clamp01((tt - R.dash.ticks) / R.dash.recovery))), 0);
    case 'hitstun': return withLie(mix(P.hurt, P.idle, ease(clamp01((tt - 4) / 14))), 0);
    case 'crushed': return withLie({ ...P.crushed, lean: P.crushed.lean + Math.sin(step * 1.3) * 0.08 }, 0);
    case 'down': { const fall = clamp01(tt / 9), up = clamp01((tt - 30) / 12); return withLie(mix(P.hurt, P.down, fall), fall * (1 - up), up); }
    case 'ko': return withLie(P.down, 1);
    case 'recover': return withLie(mix(P.fire, P.idle, ease(clamp01(tt / 14))), 0);
  }
  return withLie(P.idle, 0);
}

// ---- the body ----------------------------------------------------------------------------------------------------------------------
// joints in figure space (y up), before the figure is laid down
function skeleton(p, b) {
  const L = { thigh: 47 * b.leg, shin: 47 * b.leg, torso: 64, upper: 31 * b.arm, fore: 29 * b.arm };
  const dirD = a => [Math.sin(a), -Math.cos(a)];                                 // angle from straight down, + forward; y up
  const hip = [0, L.thigh + L.shin + 6 - p.crouch];
  const chest = [hip[0] + Math.sin(p.lean) * L.torso, hip[1] + Math.cos(p.lean) * L.torso];
  const neck = [chest[0] + Math.sin(p.lean + p.head * 0.3) * 9, chest[1] + Math.cos(p.lean + p.head * 0.3) * 9];
  const ha = p.lean + p.head * 0.6, head = [neck[0] + Math.sin(ha) * 17, neck[1] + Math.cos(ha) * 17];
  const shoulder = (side) => [chest[0] - Math.cos(p.lean) * 3 * side, chest[1] - Math.sin(p.lean) * 3 * side - 4];
  const limb = (from, [a1, a2], l1, l2) => { const e = dirD(a1); const m = [from[0] + e[0] * l1, from[1] + e[1] * l1]; const h = dirD(a1 + a2); return [from, m, [m[0] + h[0] * l2, m[1] + h[1] * l2]]; };
  return { hip, chest, neck, head, ha, L,
    fa: limb(shoulder(1), p.fa, L.upper, L.fore), ba: limb(shoulder(-1), p.ba, L.upper, L.fore),
    fl: limb([hip[0] + 4, hip[1]], p.fl, L.thigh, L.shin), bl: limb([hip[0] - 4, hip[1]], p.bl, L.thigh, L.shin) };
}

// a limb segment as a tapered capsule from a (width wa) to b (width wb)
function seg(ctx, a, b, wa, wb) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * wa / 2, a[1] + ny * wa / 2); ctx.lineTo(b[0] + nx * wb / 2, b[1] + ny * wb / 2);
  ctx.lineTo(b[0] - nx * wb / 2, b[1] - ny * wb / 2); ctx.lineTo(a[0] - nx * wa / 2, a[1] - ny * wa / 2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(a[0], a[1], wa / 2, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(b[0], b[1], wb / 2, 0, 7); ctx.fill();
}
function blob(ctx, c, r) { ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.fill(); }
// a flowing strip (scarf, tail, sash end) from root along a direction, waving: n points, width w0 -> w1
function ribbon(ctx, root, ang, len, w0, w1, wave, phase) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const k = i / 8, a = ang + Math.sin(phase + k * 3.2) * wave * k;
    const prev = pts[i - 1] || root;
    pts.push(i ? [prev[0] + Math.cos(a) * len / 8, prev[1] + Math.sin(a) * len / 8] : root);
  }
  const L = [], Rr = [];
  for (let i = 0; i <= 8; i++) {
    const p = pts[i], q = pts[Math.min(8, i + 1)], o = pts[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1, w = lerp(w0, w1, i / 8) / 2;
    L.push([p[0] - dy / l * w, p[1] + dx / l * w]); Rr.push([p[0] + dy / l * w, p[1] - dx / l * w]);
  }
  ctx.beginPath(); ctx.moveTo(...L[0]); for (const p of L.slice(1)) ctx.lineTo(...p); for (const p of Rr.reverse()) ctx.lineTo(...p); ctx.closePath(); ctx.fill();
}
// spikes: a crown of triangles around the head, each [angle from up (+ = back), length, width] in head radii
function spikes(ctx, h, r, list, tilt) {
  ctx.beginPath();
  for (const [a, len, w] of list) {
    const ang = a + tilt, ux = -Math.sin(ang), uy = Math.cos(ang), px = -uy, py = ux;     // +a leans back (toward -x)
    const bx = h[0] + ux * r * 0.55, by = h[1] + uy * r * 0.55;
    ctx.moveTo(bx + px * w * r, by + py * w * r); ctx.lineTo(h[0] + ux * r * len, h[1] + uy * r * len); ctx.lineTo(bx - px * w * r, by - py * w * r);
  }
  ctx.fill();
}

const HAIR = {
  flame: (ctx, h, r, s) => spikes(ctx, h, r, [[-0.15, 3.0, 0.42], [0.25, 3.3, 0.45], [0.65, 3.0, 0.42], [1.05, 2.5, 0.38], [1.45, 2.0, 0.34], [-0.55, 2.3, 0.36], [1.85, 1.6, 0.3]], s.wind * 0.25 + s.flick),
  spiky: (ctx, h, r, s) => spikes(ctx, h, r, [[-0.4, 1.9, 0.38], [0.1, 2.1, 0.4], [0.6, 2.0, 0.38], [1.1, 1.8, 0.34], [1.6, 1.5, 0.3]], s.wind * 0.2 + s.flick),
  flat: (ctx, h, r) => { ctx.beginPath(); ctx.moveTo(h[0] - r * 1.0, h[1] + r * 0.3); ctx.lineTo(h[0] - r * 0.95, h[1] + r * 1.45); ctx.lineTo(h[0] + r * 0.95, h[1] + r * 1.5); ctx.lineTo(h[0] + r * 1.05, h[1] + r * 0.4); ctx.closePath(); ctx.fill(); },
  twin: (ctx, h, r, s) => spikes(ctx, h, r, [[-0.6, 1.5, 0.45], [-0.1, 1.6, 0.5], [0.45, 1.5, 0.45], [1.0, 1.3, 0.4]], s.wind * 0.15),
  long: (ctx, h, r, s) => spikes(ctx, h, r, [[-0.5, 1.45, 0.5], [0.05, 1.55, 0.55], [0.6, 1.45, 0.5], [1.15, 1.35, 0.5]], s.wind * 0.1),
  hood: (ctx, h, r) => { ctx.beginPath(); ctx.arc(h[0] - r * 0.1, h[1] + r * 0.1, r * 1.35, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(h[0] - r * 1.2, h[1] + r * 0.6); ctx.lineTo(h[0] - r * 2.1, h[1] - r * 0.4); ctx.lineTo(h[0] - r * 0.6, h[1] - r * 0.5); ctx.closePath(); ctx.fill(); },
  buns: (ctx, h, r) => { ctx.beginPath(); ctx.arc(h[0], h[1] + r * 0.15, r * 1.15, 0, 7); ctx.fill(); blob(ctx, [h[0] - r * 0.75, h[1] + r * 1.15], r * 0.62); blob(ctx, [h[0] + r * 0.55, h[1] + r * 1.25], r * 0.62); },
};

// drawFighter(ctx, who, pose, { t, vx }): t film time (s), vx the figure's speed toward its facing (body units a tick, for what trails)
export function drawFighter(ctx, who, pose, { t = 0, vx = 0 } = {}) {
  const C = castOf(who), b = C.build, J = skeleton(pose, b), step = Math.floor(t * 12);
  const wind = Math.max(-1, Math.min(1, -vx / 6)), flick = (step % 2) * 0.03;
  const s = { wind, flick, phase: step * 0.9 };
  ctx.save();
  ctx.scale(b.k, b.k);
  // laid down: turned onto its back about the hip, then lowered until the back rests on the ground
  if (pose.lie) { const hy = J.hip[1]; ctx.translate(0, -(hy - 17) * pose.lie); ctx.translate(J.hip[0], hy); ctx.rotate(pose.lie * Math.PI / 2 * 0.97); ctx.translate(-J.hip[0], -hy); }
  ctx.fillStyle = '#000';
  const sh = b.sh;
  // back limbs, torso, front limbs: all black, so order only matters for nothing; drawn as one silhouette
  const ARM = [16 * b.arm, 14 * b.arm, 12 * b.arm], LEG = [27 * b.leg, 22 * b.leg, 15 * b.leg];
  const legs = l => { seg(ctx, l[0], l[1], LEG[0], LEG[1]); seg(ctx, l[1], l[2], LEG[1] * 1.08, LEG[2] * 1.45); const f = l[2]; ctx.beginPath(); ctx.ellipse(f[0] + 7, f[1] - 3, 14, 7, 0, 0, 7); ctx.fill(); };
  const arms = a => { seg(ctx, a[0], a[1], ARM[0], ARM[1]); seg(ctx, a[1], a[2], ARM[1], ARM[2]); blob(ctx, a[2], 10.5 * b.arm); };
  legs(J.bl); arms(J.ba);
  // torso: hips to shoulders, a gi that tapers to the sash and opens to the chest
  const up = [Math.sin(pose.lean), Math.cos(pose.lean)], side = [Math.cos(pose.lean), -Math.sin(pose.lean)];
  const at = (k, w) => [J.hip[0] + up[0] * J.L.torso * k + side[0] * w, J.hip[1] + up[1] * J.L.torso * k + side[1] * w];
  ctx.beginPath();
  for (const p of [at(-0.08, -18), at(0.32, -16), at(0.72, -24 * sh), at(1.0, -22 * sh), at(1.0, 22 * sh), at(0.72, 24 * sh), at(0.32, 16), at(-0.08, 18)]) ctx.lineTo(...p);
  ctx.closePath(); ctx.fill();
  seg(ctx, J.chest, J.neck, 13, 11);
  blob(ctx, J.head, 15);
  ctx.beginPath(); ctx.ellipse(J.head[0] + 6, J.head[1] - 7, 8, 7, 0, 0, 7); ctx.fill();          // the jaw, toward the facing
  legs(J.fl); arms(J.fa);
  // the outline that makes each one who it is
  HAIR[C.hair](ctx, J.head, 15, s);
  for (const x of C.extras) {
    if (x === 'sash') { const r = at(0.3, -8); ribbon(ctx, r, Math.PI + 0.35 + wind * 0.5, 34, 7, 3, 0.5, s.phase); ribbon(ctx, at(0.28, -4), Math.PI + 0.7 + wind * 0.4, 28, 6, 2.5, 0.6, s.phase + 1.3); }
    if (x === 'scarf') { ribbon(ctx, J.neck, Math.PI - 0.55 + wind * 0.5, 96, 14, 3, 0.9, s.phase); ribbon(ctx, J.neck, Math.PI - 0.2 + wind * 0.5, 70, 11, 2, 1.1, s.phase + 1.7); }
    if (x === 'twintails') { const back = [J.head[0] - 12, J.head[1] + 6]; ribbon(ctx, back, Math.PI + 0.9 + wind * 0.5, 78, 12, 4, 0.45, s.phase); ribbon(ctx, [J.head[0] - 9, J.head[1] + 11], Math.PI + 0.55 + wind * 0.6, 72, 11, 3.5, 0.5, s.phase + 2); }
    if (x === 'longhair') ribbon(ctx, [J.head[0] - 10, J.head[1] + 2], Math.PI + 1.25 + wind * 0.45 - pose.lean, 88, 26, 10, 0.25, s.phase);
    if (x === 'coat') { const r = at(0.15, -12); ribbon(ctx, r, Math.PI * 1.5 - 0.25 + wind * 0.5, 56, 26, 30, 0.2, s.phase); }
    if (x === 'crescent') { const c = [J.head[0] - 4, J.head[1] + 24]; ctx.beginPath(); ctx.arc(c[0], c[1], 9, 0, 7); ctx.arc(c[0] + 5, c[1] + 3, 8, 0, 7, true); ctx.fill('evenodd'); }
    if (x === 'bands') { for (const a of [J.fa, J.ba]) { const w = a[2], e = a[1], k = 0.75; blob(ctx, [lerp(e[0], w[0], k), lerp(e[1], w[1], k)], 7.5 * b.arm); } }
    if (x === 'hood') { /* the hood is the head shape itself */ }
  }
  ctx.restore();
}
