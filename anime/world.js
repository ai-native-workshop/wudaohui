// world.js: one film shot drawn with three.js. Under everything a painted night sky and the stone ring; on it the two fighters as the
// viewer draws them (black strokes glowing in their colour, stick.js); the ki as light (glowfx.js: auras, beams that run through, balls
// of light, sparks, rings, shields) plus wukong's speed lines; then wukong's finish pass (glow, shake, zoom blur, impact tones, flash,
// grain); and over the finished picture a crisp layer for the HUD and the words. World units are the engine's (the stage is 1000 wide),
// y up, the ring's surface at y = 0.
//
//   const w = createWorld(canvas, { rules, film, who: ['claude', 'doubao'] });  w.draw(k)  renders shot k of the film
import * as THREE from 'three';
import { createEngine } from './vendor/engine.js';
import { createSpeedLines } from './vendor/fx.js';
import { createGlowFx, burst, rnd } from './glowfx.js';
import { castOf } from './fighters.js';
import { drawStick, stickJoints } from './stick.js';

const S = 1024, STK = 3.0, FEET = 900;                    // a fighter's canvas: size, pixels per stick unit (a viewer pixel), where the feet stand
const PXU = 0.3;                                           // engine units per canvas pixel: a figure (~210 stick units) stands ~190 units tall
const PLANE = S * PXU;                                     // the fighter plane's size in engine units
const PLANE_Y = (FEET - S / 2) * PXU;                      // its centre above the feet
const HAND_Y = 98, CHEST_Y = 118;
const SU = STK * PXU;                                      // engine units per stick unit

function tintMaterial() {                                  // a silhouette texture's shape in one flat colour (afterimages)
  return new THREE.ShaderMaterial({ uniforms: { map: { value: null }, uColor: { value: new THREE.Color() }, uAlpha: { value: 1 } }, transparent: true, depthWrite: false, depthTest: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D map; uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; void main() { float a = texture2D(map, vUv).a * uAlpha; if (a < 0.01) discard; gl_FragColor = vec4(uColor, a); }' });
}
const canvasTex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; return t; };
const mkCanvas = (w, h = w) => Object.assign(document.createElement('canvas'), { width: w, height: h });

// ---- the painted background --------------------------------------------------------------------------------------------------
function paintSky() {
  const c = mkCanvas(4, 1024), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 1024);
  gr.addColorStop(0, '#04081a'); gr.addColorStop(0.42, '#0b2444'); gr.addColorStop(0.72, '#17506e'); gr.addColorStop(0.9, '#2f8a9c'); gr.addColorStop(1, '#45a8b0');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 1024); return c;
}
function paintRidge(seed, w, h, color, rough) {
  const c = mkCanvas(w, h), g = c.getContext('2d'); let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = color; g.beginPath(); g.moveTo(0, h);
  let y = h * 0.55;
  for (let x = 0; x <= w; x += w / 90) { y = Math.max(h * 0.15, Math.min(h * 0.85, y + (r() - 0.5) * h * rough)); g.lineTo(x, y); if (r() < 0.12) g.lineTo(x + w / 180, y - h * 0.25 * r()); }
  g.lineTo(w, h); g.closePath(); g.fill(); return c;
}
function paintRing() {
  const c = mkCanvas(2048, 256), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2a3350'); gr.addColorStop(0.08, '#1a2036'); gr.addColorStop(1, '#0a0d18');
  g.fillStyle = gr; g.fillRect(0, 0, 2048, 256);
  g.fillStyle = '#6f7fa8'; g.fillRect(0, 0, 2048, 5);                                      // the lit edge of the ring
  g.strokeStyle = '#0b0e1a'; g.lineWidth = 4;
  for (let x = 0; x < 2048; x += 128) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x - 30, 256); g.stroke(); }
  g.beginPath(); g.moveTo(0, 96); g.lineTo(2048, 96); g.stroke();
  return c;
}

export function createWorld(canvas, { rules: R, film, who, W = 1920, H = 1080 }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  const engine = createEngine(renderer, W, H, { ss: 1.5 });
  const cast = who.map(castOf);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000); cam.position.set(0, 0, 500);
  const screenCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // sky: a full-frame gradient, with a pale glow behind the action that backlights the silhouettes
  const sky = new THREE.Scene(), skyMat = new THREE.ShaderMaterial({ uniforms: { map: { value: canvasTex(paintSky()) }, uGlow: { value: new THREE.Vector2(0.5, 0.35) }, uGlowK: { value: 0.35 } }, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D map; uniform vec2 uGlow; uniform float uGlowK; varying vec2 vUv; void main() { vec3 c = texture2D(map, vec2(0.5, vUv.y)).rgb; vec2 d = (vUv - uGlow) * vec2(1.78, 1.0); c += vec3(0.30, 0.55, 0.62) * uGlowK * exp(-dot(d, d) * 5.0); gl_FragColor = vec4(c, 1.0); }' });
  sky.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat));
  const bgSpeed = createSpeedLines(); sky.add(bgSpeed.mesh);

  const world = new THREE.Scene();
  const plane = (tex, w, h, opts = {}) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, ...opts })); m.frustumCulled = false; world.add(m); return m; };
  const far = plane(canvasTex(paintRidge(7, 4096, 512, '#0f2640', 0.2)), 3200, 210), near = plane(canvasTex(paintRidge(19, 4096, 512, '#08111f', 0.26)), 2600, 120);
  far.renderOrder = 0.1; near.renderOrder = 0.2;
  const ring = plane(canvasTex(paintRing()), 1400, 175); ring.position.set(500, -87, 0); ring.renderOrder = 0.3;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 2000), new THREE.MeshBasicMaterial({ color: '#03050b', depthTest: false, depthWrite: false })); ground.position.set(500, -1170, 0); ground.renderOrder = 0.25; world.add(ground);

  // fighters: a silhouette canvas each, its rim (the silhouette dilated minus itself) and a halo (the rim blurred)
  const fighters = who.map((id, i) => {
    const sil = mkCanvas(S), T = { sil: canvasTex(sil) };
    const pal = cast[i].palette, hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
    const ghosts = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(PLANE, PLANE), tintMaterial()); m.material.uniforms.map.value = T.sil; m.material.uniforms.uColor.value.copy(hdr(pal[1], 1.2)); m.frustumCulled = false; m.renderOrder = 1.9; world.add(m); return m; });
    const mSil = plane(T.sil, PLANE, PLANE); mSil.renderOrder = 2;
    return { id, pal, sil, T, mSil, ghosts, lastX: null };
  });
  const gfx = createGlowFx(world);
  const fgSpeed = createSpeedLines(); const fg = new THREE.Scene(); fg.add(fgSpeed.mesh);

  // debris: black chips drifting up when the ki rises (the dandan look)
  const chipTex = (() => { const c = mkCanvas(64), g = c.getContext('2d'); g.fillStyle = '#000'; g.beginPath(); g.moveTo(8, 56); g.lineTo(32, 6); g.lineTo(58, 50); g.closePath(); g.fill(); return canvasTex(c); })();
  const chips = Array.from({ length: 36 }, (_, i) => { const m = plane(chipTex, 10 + (i % 5) * 4, 10 + (i % 5) * 4); m.renderOrder = 2.5; return m; });

  // the layer over the finished picture: HUD, words, titles
  const hud = mkCanvas(W, H), hctx = hud.getContext('2d'), hudTex = canvasTex(hud);
  const over = new THREE.Scene(), overMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: { map: { value: hudTex } }, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D map; varying vec2 vUv; void main() { vec4 c = texture2D(map, vUv); gl_FragColor = vec4(pow(c.rgb, vec3(1.0)), c.a); }' }));
  overMesh.material.uniforms.map.value.colorSpace = THREE.NoColorSpace;      // drawn as is, after the finish pass wrote sRGB
  over.add(overMesh);

  const frames = film.frames, fps = film.fps;
  const marks = []; film.shots.forEach((sh, k) => { for (const e of sh.events) marks.push({ e, k }); });   // every event and the shot it lands on
  const recent = (k, secs) => marks.filter(m => m.k <= k && (k - m.k) / fps <= secs);

  function paintFighter(f, F, tick, wind) {
    const g = f.sil.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S);
    g.translate(S / 2, FEET); g.scale(STK, STK);
    drawStick(g, f.id, F, R, { tick, wind, px: STK });
    f.T.sil.needsUpdate = true;
  }

  function place(m, x, facing) { m.position.set(x, PLANE_Y, 0); m.scale.set(facing, 1, 1); }

  function drawHud(shot, F) {
    const g = hctx; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    const fx = shot.fx;
    if (!fx.intro) {                                                          // HP and ki, slanted bars at the top
      F.f.forEach((f, i) => {
        const hp = Math.max(0, f[4]) / R.hp, ki = f[5] / R.kiMax, x0 = i ? W - 70 : 70, dir = i ? -1 : 1, bw = 720;
        g.save(); g.translate(x0, 56); g.scale(dir, 1); g.transform(1, 0, -0.25, 1, 0, 0);
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(-6, -6, bw + 12, 40);
        g.fillStyle = hp > 0.3 ? cast[i].palette[1] : '#ff4a4a'; g.fillRect(0, 0, bw * hp, 22);
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, 26, bw * 0.55 * ki, 6);
        g.restore();
        g.font = '800 30px "PingFang SC", "Hiragino Sans GB", sans-serif'; g.textAlign = i ? 'right' : 'left'; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.8)';
        g.strokeText(cast[i].name, i ? W - 80 : 80, 128); g.fillStyle = cast[i].palette[1]; g.fillText(cast[i].name, i ? W - 80 : 80, 128);
      });
      if (film.card?.wins) seriesPips(fx, F);
      const secs = Math.max(0, Math.ceil((R.maxTicks - Math.floor(shot.tick)) / R.fps));
      g.font = '900 64px "PingFang SC", sans-serif'; g.textAlign = 'center'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(String(secs), W / 2, 92); g.fillStyle = '#fff'; g.fillText(String(secs), W / 2, 92);
    }
    if (film.card?.note) notePill(film.card.note);
    for (const w of fx.words) {                                               // words that pop in, hold, and go
      const k = Math.min(1, w.age / 3), out = Math.max(0, (w.age - w.life + 6) / 6), sc = (1.6 - 0.6 * k) * (1 - out * 0.2);
      g.save(); g.globalAlpha = 1 - out; g.translate(w.u * W, (1 - w.v) * H); g.scale(sc, sc); g.rotate(-0.06); g.transform(1, 0, -0.18, 1, 0, 0);
      g.font = `900 ${w.size}px "PingFang SC", "Hiragino Sans GB", sans-serif`; g.textAlign = 'center'; g.lineJoin = 'round';
      g.lineWidth = w.size * 0.16; g.strokeStyle = '#000'; g.strokeText(w.text, 0, 0); g.fillStyle = w.color; g.fillText(w.text, 0, 0);
      g.restore();
    }
    if (fx.intro) {                                                           // the two names and VS
      const { k, n } = fx.intro, a = Math.min(1, k / 6) * (1 - Math.max(0, (k - n + 8) / 8));
      g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, H * 0.36, W, H * 0.28);
      g.font = '900 96px "PingFang SC", sans-serif'; g.lineWidth = 12; g.strokeStyle = '#000'; g.lineJoin = 'round';
      const slide = (1 - Math.min(1, k / 8)) * 300;
      g.textAlign = 'right'; g.strokeText(cast[0].name, W / 2 - 110 - slide, H * 0.52); g.fillStyle = cast[0].palette[1]; g.fillText(cast[0].name, W / 2 - 110 - slide, H * 0.52);
      g.textAlign = 'left'; g.strokeText(cast[1].name, W / 2 + 110 + slide, H * 0.52); g.fillStyle = cast[1].palette[1]; g.fillText(cast[1].name, W / 2 + 110 + slide, H * 0.52);
      g.textAlign = 'center'; g.font = '900 120px "PingFang SC", sans-serif'; g.strokeText('VS', W / 2, H * 0.535); g.fillStyle = '#ffe36b'; g.fillText('VS', W / 2, H * 0.535);
      if (fx.intro.title) { g.font = '900 64px "PingFang SC", sans-serif'; g.lineWidth = 10; g.strokeText(fx.intro.title, W / 2, H * 0.31); g.fillStyle = '#fff'; g.fillText(fx.intro.title, W / 2, H * 0.31); }
      if (fx.intro.score) { g.font = '800 54px "PingFang SC", sans-serif'; g.lineWidth = 9; g.strokeText(fx.intro.score, W / 2, H * 0.72); g.fillStyle = '#ffe36b'; g.fillText(fx.intro.score, W / 2, H * 0.72); }
      g.restore();
    }
    if (fx.outro) {
      const s = summaryOf(F), a = Math.min(1, fx.outro.k / 4);
      g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.lineJoin = 'round';
      g.font = '900 240px "PingFang SC", sans-serif'; g.lineWidth = 24; g.strokeStyle = '#000'; g.strokeText(s.big, W / 2, H * 0.5); g.fillStyle = '#ffe36b'; g.fillText(s.big, W / 2, H * 0.5);
      g.font = '900 72px "PingFang SC", sans-serif'; g.lineWidth = 12; g.strokeText(s.small, W / 2, H * 0.62); g.fillStyle = '#fff'; g.fillText(s.small, W / 2, H * 0.62);
      if (fx.outro.score) { g.font = '800 58px "PingFang SC", sans-serif'; g.lineWidth = 10; g.strokeText(fx.outro.score, W / 2, H * 0.73); g.fillStyle = '#ffe36b'; g.fillText(fx.outro.score, W / 2, H * 0.73); }
      g.restore();
    }
    hudTex.needsUpdate = true;
  }
  // a clip that leaves out part of its game says so, in a pill under the timer, from its first frame to its last
  function notePill(text) {
    const g = hctx; g.save(); g.font = '800 30px "PingFang SC", "Hiragino Sans GB", sans-serif'; g.textBaseline = 'middle';
    const w = g.measureText(text).width + 92, h = 46, x = W / 2 - w / 2, y = 160;
    g.fillStyle = 'rgba(0,0,0,0.62)'; g.strokeStyle = '#ffe36b'; g.lineWidth = 2.5;
    g.beginPath(); g.roundRect(x, y - h / 2, w, h, h / 2); g.fill(); g.stroke();
    g.fillStyle = '#ffe36b';
    for (const dx of [0, 15]) { g.beginPath(); g.moveTo(x + 22 + dx, y - 10); g.lineTo(x + 36 + dx, y); g.lineTo(x + 22 + dx, y + 10); g.closePath(); g.fill(); }   // a fast-forward mark
    g.textAlign = 'left'; g.fillText(text, x + 64, y + 1);
    g.restore();
  }
  // a series (the final): games won so far as pips under each bar, filled from the outside in, so the one by the timer is the deciding
  // win; at the finish the winner's next pip lights up
  function seriesPips(fx, F) {
    const g = hctx, { wins, of = 4 } = film.card, w = fx.outro && fx.outro.k >= 8 ? summaryOf(F).w : -1, pop = w >= 0 ? Math.min(1, (fx.outro.k - 8) / 5) : 0;
    for (let i = 0; i < 2; i++) {
      const c = cast[i].palette[1], have = wins[i];
      for (let j = 0; j < of; j++) {
        const x = i ? W - 70 - 720 + 24 + (of - 1 - j) * 44 : 70 + 720 - 24 - (of - 1 - j) * 44, y = 112, on = j < have, lit = i === w && j === have;
        g.save(); g.lineWidth = 3; g.strokeStyle = on || lit ? '#000' : c; g.fillStyle = 'rgba(0,0,0,0.55)';
        g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.fill(); g.stroke();
        if (on || lit) { const r = lit ? 16 * (1.6 - 0.6 * pop) : 16; g.globalAlpha = lit ? pop : 1; g.shadowColor = c; g.shadowBlur = lit ? 30 : 14; g.fillStyle = c; g.beginPath(); g.arc(x, y, r - 3, 0, Math.PI * 2); g.fill(); }
        g.restore();
      }
    }
  }
  function summaryOf(F) {
    const ko = F.f.map(f => f[1] === 'ko'), w = ko[0] && !ko[1] ? 1 : ko[1] && !ko[0] ? 0 : F.f[0][4] === F.f[1][4] ? -1 : F.f[0][4] > F.f[1][4] ? 0 : 1;
    return { big: ko[0] || ko[1] ? 'K.O.' : '时间到', small: w < 0 ? '平局' : `${cast[w].name} 胜`, w };
  }

  function draw(k) {
    const shot = film.shots[k], tick = Math.floor(shot.tick), F = frames[Math.min(tick, frames.length - 1)], t = k / fps;
    const { x: cx, y: cy, viewW, viewH } = shot.cam;
    cam.left = cx - viewW / 2; cam.right = cx + viewW / 2; cam.top = cy + viewH / 2; cam.bottom = cy - viewH / 2; cam.updateProjectionMatrix();
    cam.position.set(0, 0, 500); cam.updateMatrixWorld();
    // parallax: the far hills move a quarter as much as the ring, the near ridge half
    far.position.set(cx * 0.75 + 140, 70, 0); near.position.set(cx * 0.5 + 250, 26, 0);
    skyMat.uniforms.uGlow.value.set(0.5 + ((F.f[0][0] + F.f[1][0]) / 2 - cx) / viewW, 0.5 + (90 - cy) / viewH);
    const hot = F.c ? 1 : F.f.some(f => f[1] === 'charge' || (f[1] === 'beam' && f[6] !== 'recovery')) ? 0.6 : 0;
    skyMat.uniforms.uGlowK.value = 0.32 + hot * 0.35;
    // the ki as light, rebuilt for this shot (pixels per world unit in the supersampled frame, for the sparks' size)
    gfx.begin(engine.size.y / viewH, t);
    fighters.forEach((f, i) => {
      const Fi = F.f[i], x = Fi[0], facing = Fi[3], state = Fi[1], ph = Fi[6], col = f.pal[1];
      const vx = f.lastX == null ? 0 : (x - f.lastX) * facing; f.lastX = x;
      paintFighter(f, Fi, shot.tick, Math.max(-1, Math.min(1, -vx / 6)));
      place(f.mSil, x, facing);
      // afterimages while dashing: the same figure where it was a few frames ago
      f.ghosts.forEach((g, j) => {
        const back = frames[Math.max(0, tick - (j + 1) * 3)];
        g.visible = state === 'dash' && ph === 'moving'; if (!g.visible) return;
        place(g, back.f[i][0], facing); g.material.uniforms.uAlpha.value = 0.5 - j * 0.14;
      });
      // the aura: soft flames and rising embers while charging, gathering a beam, in a clash
      const power = state === 'clash' ? 1 : state === 'charge' ? 0.55 + Fi[5] / R.kiMax * 0.45 : state === 'beam' && ph === 'startup' ? 0.8 : 0;
      if (power > 0) {
        gfx.aura(i, x, -2, 195, col, 1.1 * power);
        gfx.glow(x, 95, 240, col, 0.22 * power, 2.2);
        for (let j = 0; j < 24; j++) {
          const p = (t * (0.6 + rnd(j, i) * 0.6) + rnd(j, 7 + i)) % 1, ex = x + (rnd(j, 3 + i) - 0.5) * 120 + Math.sin(t * 3 + j) * 8;
          gfx.spark(ex, 4 + p * 240, 5 + 5 * rnd(j, 9), j % 3 ? col : '#ffffff', Math.sin(p * Math.PI) * power, 2.0);
        }
      }
      // the ki shield while guarding; it flares where a blow lands on it
      if (state === 'guard' || state === 'blockstun') {
        const last = recent(k, 0.3).filter(m => m.e.type === 'block' && m.e.side === i).pop();
        gfx.shield(i, x, 108, facing, col, state === 'blockstun' ? 1.15 : 0.8, last ? Math.max(0, 1 - (k - last.k) / (0.3 * fps)) : 0);
      }
      // the hands, from the figure itself: balls of light and beams start where the hands are
      const jt = stickJoints(f.id, Fi, R, shot.tick), wrist = w => [x + facing * w[0] * jt.k * SU, -w[1] * jt.k * SU];
      const fw = wrist(jt.J.fa[2]), bw = wrist(jt.J.ba[2]), mid = [(fw[0] + bw[0]) / 2, (fw[1] + bw[1]) / 2];
      // gathering a beam: a ball of light between the cupped hands once they are there, sparks drawn into it
      if (state === 'beam' && ph === 'startup' && Fi[2] >= 6) {
        const grow = Math.min(1, (Fi[2] - 6) / 22), bx = mid[0], by = mid[1];
        gfx.glow(bx, by, 40 + 100 * grow, col, 1.5 + grow * 1.5); gfx.glow(bx, by, 14 + 28 * grow, '#ffffff', 2.2);
        for (let j = 0; j < 28; j++) {
          const p = (t * 1.8 + rnd(j, 11 + i)) % 1, a = rnd(j, 13 + i) * Math.PI * 2, r = (1 - p) * (70 + 60 * rnd(j, 5));
          gfx.spark(bx + Math.cos(a) * r, by + Math.sin(a) * r, 4 + 5 * p, j % 2 ? col : '#ffffff', p * (0.3 + 0.7 * grow), 2.2);
        }
      }
      // the beam: from the hands all the way to its front, through anyone it passes (the engine's ray), energy streaming along it
      let b = F.m[i];
      if (b && shot.outro != null) { const edge = b[2] > 0 ? R.stage.right + 40 : R.stage.left - 40; b = [b[0], shot.outro >= 10 ? edge : b[1] + (edge - b[1]) * shot.outro / 10, b[2]]; }
      if (b) {
        const y = state === 'beam' || state === 'clash' ? fw[1] : HAND_Y, width = F.c ? 40 + Math.sin(t * 40) * 4 : 36;
        const from = [state === 'beam' || state === 'clash' ? fw[0] + facing * 6 : b[0] + facing * 4, y];
        // the engine stops the tip at the ring's edge; past it the beam runs on out of the picture
        const wall = b[2] > 0 ? R.stage.right + 40 : R.stage.left - 40, atWall = Math.abs(b[1] - wall) < 1 && !F.c;
        const to = [atWall ? (b[2] > 0 ? cx + viewW / 2 + 60 : cx - viewW / 2 - 60) : b[1], y], len = to[0] - from[0];
        gfx.beam(i, from, to, { color: col, width, k: 1.1 });
        gfx.glow(from[0], y, width * 2.6, col, 1.2); gfx.glow(from[0], y, width * 0.9, '#ffffff', 1.5);
        if (!F.c && !atWall) { gfx.glow(to[0], y, width * 3.0, col, 1.2); gfx.glow(to[0], y, width * 1.1, '#ffffff', 1.5); }
        for (let j = 0; j < 44; j++) {
          const p = (t * 2.2 + rnd(j, 21 + i)) % 1, py = y + (rnd(j, 23 + i) - 0.5) * width * 1.7 + Math.sin(t * 20 + j) * 4;
          gfx.spark(from[0] + len * p, py, 4 + 6 * rnd(j, 25), j % 3 ? col : '#ffffff', 0.9 * Math.sin(p * Math.PI), 2.0);
        }
      }
    });
    // blasts: a ball forming in the palm at the end of the startup, then in flight at the height of the hand, a tail of sparks behind
    F.f.forEach((Fi, i) => {
      if (Fi[1] !== 'blast' || Fi[6] !== 'startup' || Fi[2] < R.blast.startup - 5) return;
      const jt = stickJoints(fighters[i].id, Fi, R, shot.tick), w = jt.J.fa[2], q = (Fi[2] - (R.blast.startup - 5)) / 5;
      const hx = Fi[0] + Fi[3] * (w[0] * jt.k * SU + 8), hy = -w[1] * jt.k * SU;
      gfx.glow(hx, hy, 30 + 40 * q, fighters[i].pal[1], 1.2 + q); gfx.glow(hx, hy, 10 + 12 * q, '#ffffff', 1.8);
    });
    const BLAST_Y = HAND_Y + 18;
    for (const [owner, bx, dir] of F.b) {
      const col = fighters[owner].pal[1];
      gfx.glow(bx, BLAST_Y, 74, col, 1.8); gfx.glow(bx, BLAST_Y, 26, '#ffffff', 2.4);
      for (let j = 1; j <= 10; j++) gfx.spark(bx - dir * j * 8, BLAST_Y + Math.sin(t * 30 + j) * 3, 14 - j, col, 1 - j / 11, 2.0);
    }
    // the clash: two lights pressing into one blinding point, sparks thrown off all round, rings of pressure
    if (F.c) {
      const c = F.c[0], d0 = F.m[0] ? F.m[0][2] : 1, grow = Math.min(1, F.c[1] / 90), pulse = 1 + 0.15 * Math.sin(t * 25);
      gfx.glow(c, HAND_Y, (120 + 80 * grow) * pulse, '#fff2c0', 1.4 + 0.6 * grow); gfx.glow(c, HAND_Y, 48 * pulse, '#ffffff', 2.0);
      gfx.glow(c - d0 * 40, HAND_Y, 110, fighters[0].pal[1], 1.0); gfx.glow(c + d0 * 40, HAND_Y, 110, fighters[1].pal[1], 1.0);
      for (let j = 0; j < 80; j++) {
        const p = (t / 0.45 + rnd(j, 31)) % 1, a = rnd(j, 33) * Math.PI * 2, r = p * (90 + 130 * rnd(j, 35));
        gfx.spark(c + Math.cos(a) * r, HAND_Y + Math.sin(a) * r * 0.8, 5 + 6 * (1 - p), j % 2 ? fighters[0].pal[1] : fighters[1].pal[1], 1 - p, 2.2);
      }
      for (let j = 0; j < 3; j++) { const p = (t * 1.6 + j / 3) % 1; gfx.ring(c, HAND_Y, 40 + p * 230, '#fff6d0', (1 - p) * 0.9, 0.06); }
    }
    // impacts: a flash, sparks thrown away from the blow, a ring of pressure; they play on through the hit stop
    for (const { e, k: born } of recent(k, 1.0)) {
      const age = (k - born) / fps, seed = born * 31 + e.t * 7 + (e.side + 1), at = frames[Math.min(frames.length - 1, e.t)];
      if (e.type === 'hit' || e.type === 'crush') {
        const Fd = at.f[1 - e.side], Fa = at.f[e.side], away = Math.sign(Fd[0] - Fa[0]) || 1, col = fighters[e.side].pal[1];
        const hx = Fd[0] - away * 18, hy = e.kind === 'beam' ? HAND_Y : CHEST_Y;
        const S = e.kind === 'beam' ? 2.2 : e.type === 'crush' ? 1.6 : e.kind === 'heavy' ? 1.5 : e.kind === 'blast' ? 1.2 : 0.8, big = S > 1;
        if (age < 0.16 * S) { const q = 1 - age / (0.16 * S); gfx.glow(hx, hy, 120 * S * (1 + age * 3), col, 2.4 * q); gfx.glow(hx, hy, 46 * S, '#ffffff', 3 * q); }
        burst(gfx, hx, hy, age, seed, { n: Math.round(16 * S * S), speed: 480 * S, life: 0.28 + 0.12 * S, size: 7 + 2 * S, color: col, dir: away > 0 ? 0 : Math.PI, spread: big ? Math.PI * 1.5 : Math.PI, streak: big ? 2 : 1 });
        burst(gfx, hx, hy, age, seed + 7, { n: Math.round(8 * S), speed: 300 * S, life: 0.22, size: 6, color: '#ffffff', streak: 0 });
        if (big && age < 0.4) { const p = age / 0.4; gfx.ring(hx, hy, 30 + p * 160 * S, col, (1 - p) * 1.4, 0.07); }
      } else if (e.type === 'block') {
        const Fd = at.f[e.side], sx = Fd[0] + Fd[3] * 44, sy = 112;
        if (age < 0.12) gfx.glow(sx, sy, 90, fighters[e.side].pal[1], 2 * (1 - age / 0.12));
        burst(gfx, sx, sy, age, seed, { n: e.kind === 'beam' ? 30 : 14, speed: 380, life: 0.25, size: 6, color: '#e6f6ff', dir: Fd[3] > 0 ? 0 : Math.PI, spread: Math.PI * 1.2, streak: 1 });
      }
      if (e.type === 'clash_win' && age < 0.75 && !F.m[e.side]) {
        const Fw = at.f[e.side], dir = Fw[3], q = 1 - age / 0.75, from = [Fw[0] + dir * 38, HAND_Y], edge = dir > 0 ? R.stage.right + 80 : R.stage.left - 80;
        const to = [from[0] + (edge - from[0]) * Math.min(1, age / 0.2), HAND_Y], col = fighters[e.side].pal[1];
        gfx.beam(e.side, from, to, { color: col, width: 46 * (0.4 + 0.6 * q), k: 1.3 * q });
        gfx.glow(from[0], HAND_Y, 120 * q, col, 1.3 * q); gfx.glow(to[0], HAND_Y, 140 * q, col, 1.2 * q);
      }
      if (e.type === 'clash_win' || e.type === 'clash_draw' || e.type === 'blast_clash') {
        const ex = e.type === 'clash_win' ? at.f[1 - e.side][0] : (at.f[0][0] + at.f[1][0]) / 2, S = e.type === 'blast_clash' ? 1 : 2.6, col = e.side >= 0 ? fighters[e.side].pal[1] : '#fff2c0';
        if (age < 0.3) { const q = 1 - age / 0.3; gfx.glow(ex, HAND_Y, 180 * S * (1 + age * 2), col, 2.6 * q); gfx.glow(ex, HAND_Y, 70 * S, '#ffffff', 3.2 * q); }
        burst(gfx, ex, HAND_Y, age, seed, { n: Math.round(40 * S), speed: 420 * S, life: 0.6, size: 8 + 2 * S, color: col, streak: 2 });
        for (let j = 0; j < 2; j++) { const p = (age - j * 0.08) / 0.5; if (p > 0 && p < 1) gfx.ring(ex, HAND_Y, 40 + p * 120 * S, col, (1 - p) * 1.4, 0.06); }
      } else if (e.type === 'dash_forward' || e.type === 'dash_back') {
        const Fd = frames[Math.max(0, e.t - 1)].f[e.side];
        burst(gfx, Fd[0], 30, age, seed, { n: 12, speed: 220, life: 0.3, size: 7, color: fighters[e.side].pal[1], dir: Math.PI / 2, spread: Math.PI, gravity: -120 });
      }
    }
    gfx.end();
    // debris rising when the ki is up
    chips.forEach((m, j) => {
      const sp = 40 + (j * 37) % 60, x0 = (j * 173) % 1000, y = ((t * sp + j * 97) % 420) - 40;
      m.visible = hot > 0; m.position.set(x0, y, 0); m.rotation.z = t * (j % 2 ? 1.3 : -0.9) + j;
    });
    // speed lines behind (on the sky) and in front
    const fx = shot.fx;
    bgSpeed.set({ time: t, amount: fx.bgSpeed ? fx.bgSpeed.amount : 0, inner: fx.bgSpeed ? fx.bgSpeed.inner : 0.3, center: fx.bgSpeed ? fx.bgSpeed.center : [0.5, 0.5], color: '#cfe8ff', gain: 0.32, count: 90, aspect: W / H });
    fgSpeed.set({ time: t, amount: fx.speed ? fx.speed.amount : 0, inner: fx.speed ? fx.speed.inner : 0.3, center: fx.speed ? fx.speed.center : [0.5, 0.5], color: '#ffffff', gain: 0.95, count: 80, aspect: W / H, fat: 1 });
    // compose and finish
    engine.begin(0x000000);
    engine.draw(sky, screenCam);
    engine.draw(world, cam, [0, 0, 1, 1], 'depth');
    engine.draw(fg, screenCam, [0, 0, 1, 1], 'depth');
    engine.finish({ glow: 0.9, knee: 0.85, shake: fx.shake, zoom: fx.blur, zoomC: fx.blurC, flash: fx.flash > 0.02 ? ['#ffffff', fx.flash] : null, tone: fx.tone, invert: fx.invert, grain: 0.016, frame: k, vig: 0.3 });
    // the HUD and words over the finished picture
    drawHud(shot, F);
    renderer.setRenderTarget(null); renderer.render(over, screenCam);
  }
  return { draw, renderer };
}
