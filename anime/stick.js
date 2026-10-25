// stick.js: the fighters as the viewer draws them (viewer/draw.js): thick round-capped strokes in black with a glow of the fighter's
// colour, a round head, and the hair that tells them apart. Drawn in canvas coordinates (y down), feet at (0, 0), facing +x; one unit
// is one viewer pixel, a standing figure is about 210 tall. Poses change smoothly with the match tick, as in the viewer.
//
//   drawStick(ctx, who, F, R, { tick, wind, px })   F = engine frame [x, state, t, facing, hp, ki, phase, combo]
import { castOf } from './fighters.js';

const lerp = (a, b, k) => a + (b - a) * k, clamp01 = k => (k < 0 ? 0 : k > 1 ? 1 : k);

// the viewer's poses: angles from straight down, positive = toward the facing; lean tilts the torso about the hip
const P = {
  idle:   { lean: 0.08, crouch: 6, fa: [2.2, -1.9], ba: [1.7, -1.9], fl: [0.32, -0.12], bl: [-0.3, 0.14] },
  guard:  { lean: -0.06, crouch: 12, fa: [2.75, -2.3], ba: [2.45, -2.05], fl: [0.36, -0.2], bl: [-0.34, 0.2] },
  charge: { lean: -0.22, crouch: 26, fa: [-0.55, 1.7], ba: [-0.7, 1.75], fl: [0.68, -0.5], bl: [-0.66, 0.36] },   // fists at the waist, low, leaning back: powering up
  lightUp:{ lean: 0.1, crouch: 6, fa: [1.3, -2.3], ba: [1.8, -2.0], fl: [0.36, -0.12], bl: [-0.32, 0.14] },
  light:  { lean: 0.22, crouch: 4, fa: [1.6, 0], ba: [1.5, -2.1], fl: [0.45, -0.1], bl: [-0.38, 0.1] },
  heavyUp:{ lean: -0.18, crouch: 10, fa: [2.0, -1.6], ba: [-0.9, -0.6], fl: [0.3, -0.1], bl: [-0.4, 0.3] },
  heavy:  { lean: 0.42, crouch: 2, fa: [0.6, -0.8], ba: [1.75, 0], fl: [0.75, -0.3], bl: [-0.55, 0.05] },
  palm:   { lean: 0.12, crouch: 8, fa: [1.57, 0], ba: [1.0, -1.6], fl: [0.4, -0.12], bl: [-0.36, 0.14] },
  kame:   { lean: -0.12, crouch: 18, fa: [-0.35, 1.25], ba: [-0.45, 1.3], fl: [0.55, -0.3], bl: [-0.5, 0.25] },
  fire:   { lean: 0.18, crouch: 16, fa: [1.6, 0], ba: [1.52, 0], fl: [0.62, -0.3], bl: [-0.6, 0.2] },
  dashF:  { lean: 0.65, crouch: 4, fa: [-0.7, 0.2], ba: [-0.9, 0.3], fl: [0.7, -0.6], bl: [-0.9, 0.5] },
  hurt:   { lean: -0.45, crouch: 6, fa: [0.7, 0.6], ba: [-0.5, 0.4], fl: [0.2, 0.1], bl: [-0.45, 0.2] },
  crushed:{ lean: -0.32, crouch: 4, fa: [2.5, 0.3], ba: [-2.0, -0.2], fl: [0.35, 0], bl: [-0.35, 0.1] },
};
function mix(a, b, k) {
  const o = {};
  for (const key of Object.keys(a)) o[key] = Array.isArray(a[key]) ? a[key].map((v, i) => lerp(v, b[key][i], k)) : lerp(a[key], b[key], k);
  return o;
}
// the pose for frame F at match tick `tick` (fractional ticks make slow motion smooth): [pose, lie 0..1]
export function stickPose(F, R, tick) {
  const [, state, t, , , , ph] = F;
  const walk = k => { const p = { ...P.idle, fl: [...P.idle.fl], bl: [...P.idle.bl] }; const s = Math.sin(tick * 0.32) * 0.35 * k; p.fl[0] += s; p.bl[0] -= s; return p; };
  switch (state) {
    case 'forward': return [walk(1), 0];
    case 'back': return [walk(-0.8), 0];
    case 'guard': case 'blockstun': return [state === 'blockstun' ? { ...P.guard, lean: -0.2 } : P.guard, 0];
    case 'charge': return [P.charge, 0];
    case 'light': { const L = R.light; return [ph === 'startup' ? mix(P.idle, P.lightUp, clamp01(t / L.startup)) : ph === 'active' ? P.light : mix(P.light, P.idle, clamp01((t - L.startup - L.active) / L.recovery)), 0]; }
    case 'heavy': { const M = R.heavy; return [ph === 'startup' ? mix(P.idle, P.heavyUp, clamp01(t / M.startup)) : ph === 'active' ? P.heavy : mix(P.heavy, P.idle, clamp01((t - M.startup - M.active) / M.recovery)), 0]; }
    case 'blast': return [ph === 'startup' ? mix(P.idle, P.palm, clamp01(t / R.blast.startup)) : mix(P.palm, P.idle, clamp01((t - R.blast.startup) / R.blast.recovery)), 0];
    case 'beam': return [ph === 'startup' ? mix(P.idle, P.kame, clamp01(t / 8)) : ph === 'firing' ? P.fire : mix(P.fire, P.idle, clamp01(t / 30)), 0];
    case 'clash': return [P.fire, 0];
    case 'dash': return [ph === 'moving' ? P.dashF : mix(P.dashF, P.idle, clamp01((t - R.dash.ticks) / R.dash.recovery)), 0];
    case 'hitstun': return [P.hurt, 0];
    case 'crushed': return [P.crushed, 0];
    case 'down': return [P.hurt, clamp01(t / 10) * (1 - clamp01((t - 32) / 10))];
    case 'ko': return [P.hurt, 1];
    case 'recover': return [mix(P.fire, P.idle, clamp01(t / 12)), 0];
  }
  return [P.idle, 0];
}

// joints for a pose, y down, feet at the origin
function skeleton(pose) {
  const s = 1.15, dir = (a, l) => [Math.sin(a) * l * s, Math.cos(a) * l * s];
  const hip = [0, -78 * s + pose.crouch], chest = [Math.sin(pose.lean) * 50 * s, hip[1] - Math.cos(pose.lean) * 50 * s];
  const head = [chest[0] + Math.sin(pose.lean) * 19 * s, chest[1] - Math.cos(pose.lean) * 19 * s];
  const limb = (from, [a1, a2], l1, l2) => { const e = dir(a1, l1); const m = [from[0] + e[0], from[1] + e[1]]; const h = dir(a1 + a2, l2); return [from, m, [m[0] + h[0], m[1] + h[1]]]; };
  return { hip, chest, head, fa: limb(chest, pose.fa, 26, 26), ba: limb(chest, pose.ba, 26, 26), fl: limb(hip, pose.fl, 34, 37), bl: limb(hip, pose.bl, 34, 37) };
}

// hair and what trails: each fighter's outline, in the same black (y down: up is -y; back is -x)
function strand(g, from, pts, w) { g.lineWidth = w; g.beginPath(); g.moveTo(...from); for (const p of pts) g.lineTo(from[0] + p[0], from[1] + p[1]); g.stroke(); }
function spikes(g, hx, hy, list) {                                        // [x offset, height, lean] per spike, over the head
  g.beginPath(); g.moveTo(hx - 16, hy - 2);
  for (const [dx, h, lean] of list) { g.lineTo(hx + dx - 4, hy - 9); g.lineTo(hx + dx + lean, hy - 9 - h); g.lineTo(hx + dx + 4, hy - 9); }
  g.lineTo(hx + 16, hy - 2); g.closePath(); g.fill();
}
const HAIR = {
  spiky: (g, J) => spikes(g, J.head[0], J.head[1], [[-12, 18, -4], [-5, 24, -3], [2, 21, -2], [9, 24, -2], [15, 16, 1]]),
  flame: (g, J, w) => spikes(g, J.head[0], J.head[1], [[-14, 26, -12 - w * 4], [-7, 38, -10 - w * 4], [0, 44, -7 - w * 4], [7, 38, -5 - w * 3], [13, 26, -3 - w * 2], [-17, 18, -14]]),
  flat: (g, J, w, ph) => {                                                     // short flat hair and a headband whose two ties stream behind the head
    const [hx, hy] = J.head; g.fillRect(hx - 15, hy - 26, 31, 14);
    g.fillRect(hx - 17, hy - 13, 34, 6);
    g.lineCap = 'round';
    strand(g, [hx - 15, hy - 10], [[-16, -2 + Math.sin(ph) * 3], [-32, 2 + Math.sin(ph + 1) * 5], [-46, 6 + Math.sin(ph + 2) * 7]], 6);
    strand(g, [hx - 15, hy - 9], [[-14, 6 + Math.sin(ph + 0.7) * 3], [-28, 14 + Math.sin(ph + 1.7) * 5]], 5);
  },
  twin: (g, J, w, ph) => {
    const [hx, hy] = J.head; spikes(g, hx, hy, [[-10, 12, -2], [-2, 15, -1], [6, 13, 0], [13, 10, 1]]);
    g.lineCap = 'round';
    strand(g, [hx - 12, hy - 10], [[-14, 6], [-24, 22 + Math.sin(ph) * 3], [-30, 42 + Math.sin(ph + 1) * 5]], 9);
    strand(g, [hx - 8, hy - 14], [[-10, -4], [-26, 6 + Math.sin(ph + 0.8) * 3], [-38, 24 + Math.sin(ph + 1.8) * 5]], 8);
  },
  long: (g, J, w, ph) => {
    const [hx, hy] = J.head; g.beginPath(); g.arc(hx - 1, hy - 3, 17.5, Math.PI * 0.95, Math.PI * 2.05); g.fill();
    g.lineCap = 'round'; strand(g, [hx - 10, hy - 4], [[-8, 18], [-12 - w * 4, 40], [-14 - w * 6, 62 + Math.sin(ph) * 3]], 14);
    g.beginPath(); g.arc(hx - 4, hy - 26, 7, 0, Math.PI * 2); g.arc(hx - 1, hy - 28, 6, 0, Math.PI * 2, true); g.fill('evenodd');   // the crescent
  },
  hood: (g, J) => {
    const [hx, hy] = J.head; g.beginPath(); g.arc(hx - 1, hy - 1, 21, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(hx - 16, hy - 14); g.lineTo(hx - 34, hy + 6); g.lineTo(hx - 12, hy + 10); g.closePath(); g.fill();
  },
  buns: (g, J) => {
    const [hx, hy] = J.head; g.beginPath(); g.arc(hx, hy - 2, 18, Math.PI, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(hx - 11, hy - 20, 9.5, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(hx + 9, hy - 21, 9.5, 0, Math.PI * 2); g.fill();
  },
};

// where the joints are for frame F (stick units, y down, feet at the origin, before any lying down), and the fighter's scale:
// the renderer puts balls of light and beams in the hands with this
export function stickJoints(who, F, R, tick) { const [pose, lie] = stickPose(F, R, tick); return { J: skeleton(pose), k: castOf(who).build.k, lie }; }

// the figure: black strokes with a glow of the fighter's colour (stronger with more ki, strongest when gathering it)
export function drawStick(g, who, F, R, { tick = 0, glow = null, wind = 0, px = 1, pose: forced = null } = {}) {   // px: device pixels per unit, for the glow's width; pose: draw this pose instead (tests)
  const C = castOf(who), [pose, lie] = forced ? [forced, 0] : stickPose(F, R, tick), J = skeleton(pose);
  const state = F[1], ki = F[5], ph = F[6], k = C.build.k;
  const hot = state === 'charge' ? 1 : state === 'beam' && ph === 'startup' ? 0.7 : state === 'clash' ? 0.9 : 0;
  g.save();
  g.scale(k, k);
  if (lie) { const hy = J.hip[1]; g.translate(0, (-hy - 14) * lie); g.translate(J.hip[0], hy); g.rotate(-lie * Math.PI / 2 * 0.97); g.translate(-J.hip[0], -hy); }
  g.shadowColor = glow || C.palette[1]; g.shadowBlur = (10 + (ki / R.kiMax) * 16 + hot * 20) * px * k;
  g.strokeStyle = g.fillStyle = '#090b14'; g.lineCap = 'round'; g.lineJoin = 'round';
  const line = (pts, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.stroke(); };
  line(J.bl, 13); line(J.ba, 11);
  line([J.hip, J.chest], 26);
  line(J.fl, 13); line(J.fa, 11);
  g.beginPath(); g.arc(J.head[0], J.head[1], 16, 0, Math.PI * 2); g.fill();
  HAIR[C.hair === 'spiky' ? 'spiky' : C.hair](g, J, wind, tick * 0.15);
  g.restore();
  return J;
}
