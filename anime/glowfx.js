// glowfx.js: the effects as light, in the spirit of the viewer's but richer: soft glows, beams of light that run through, sparks that
// fly and fade, rings of pressure, a ki shield, flames of ki. All additive and hotter than white at their cores, so the finish pass
// blooms them. Every effect is a pure function of the film time and of the event that started it: any shot can be drawn on its own
// (contact sheets) and a film renders the same twice.
//
//   const gfx = createGlowFx(scene);  each shot: gfx.begin(pxPerUnit); gfx.glow(...); gfx.spark(...); gfx.ring(...); ...; gfx.end()
//   gfx.beam(i, from, to, ...)  gfx.aura(i, ...)  gfx.shield(i, ...)  are per fighter (i = 0, 1)
import * as THREE from 'three';

const NOISE = /* glsl */`
  float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }`;
const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const add = { transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };

// hash for the particles (the same numbers everywhere: a shot drawn alone looks like the same shot in the film)
export function rnd(a, b = 0) { let h = Math.imul(a ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul(b + 0x632BE5AB, 0xC2B2AE35); h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; return (h >>> 0) / 4294967296; }

export function createGlowFx(scene) {
  // soft round glows (flashes, balls of light, cores): a pool of quads
  const glowMat = () => new THREE.ShaderMaterial({ ...add, uniforms: { uColor: { value: new THREE.Color() }, uK: { value: 1 }, uSoft: { value: 4 } }, vertexShader: VS,
    fragmentShader: `uniform vec3 uColor; uniform float uK, uSoft; varying vec2 vUv;
      void main() { float r = length(vUv - 0.5) * 2.0; if (r > 1.0) discard; float g = exp(-r * r * uSoft) - exp(-uSoft); float core = exp(-r * r * uSoft * 6.0);
        gl_FragColor = vec4((uColor * g + vec3(1.0) * core * 0.8) * uK, g * uK); }` });
  const glows = Array.from({ length: 48 }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat()); m.frustumCulled = false; m.renderOrder = 3.5; scene.add(m); return m; });
  // rings of pressure: an expanding hoop of light
  const ringMat = () => new THREE.ShaderMaterial({ ...add, uniforms: { uColor: { value: new THREE.Color() }, uK: { value: 1 }, uW: { value: 0.08 } }, vertexShader: VS,
    fragmentShader: `uniform vec3 uColor; uniform float uK, uW; varying vec2 vUv;
      void main() { float r = length(vUv - 0.5) * 2.0; float b = exp(-pow((r - (1.0 - uW)) / uW, 2.0)); if (b < 0.01) discard; gl_FragColor = vec4(mix(uColor, vec3(1.0), b * 0.5) * b * uK, b * uK); }` });
  const rings = Array.from({ length: 12 }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat()); m.frustumCulled = false; m.renderOrder = 3.4; scene.add(m); return m; });
  // sparks: one point cloud, rebuilt every shot
  const MAX = 4000, pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3), siz = new Float32Array(MAX), alp = new Float32Array(MAX);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  pg.setAttribute('size', new THREE.BufferAttribute(siz, 1)); pg.setAttribute('alpha', new THREE.BufferAttribute(alp, 1));
  const pmat = new THREE.ShaderMaterial({ ...add, uniforms: { uPx: { value: 1 } },
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; uniform float uPx; varying vec3 vC; varying float vA;
      void main() { vC = color; vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.5, size * uPx); }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main() { float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard;
      float g = exp(-r * r * 3.5), core = exp(-r * r * 18.0); gl_FragColor = vec4((vC * g + vec3(1.0) * core) * vA, g * vA); }` });
  const points = new THREE.Points(pg, pmat); points.frustumCulled = false; points.renderOrder = 3.6; scene.add(points);

  // a beam of light from the hands to its front: a white-hot core in a band of the fighter's colour, energy streaming along it
  const beamMat = () => new THREE.ShaderMaterial({ ...add, uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uLen: { value: 1 }, uK: { value: 1 }, uCore: { value: 0.12 } }, vertexShader: VS,
    fragmentShader: NOISE + `uniform float uTime, uLen, uK, uCore; uniform vec3 uColor; varying vec2 vUv;
      void main() { float u = vUv.x * uLen, v = (vUv.y - 0.5) * 2.0;
        float wob = 0.06 * (vnoise(vec2(u * 0.05 - uTime * 9.0, 1.3)) - 0.5) + 0.04 * sin(u * 0.08 - uTime * 30.0);
        float d = abs(v + wob), flow = fbm(vec2(u * 0.025 - uTime * 7.0, v * 2.0));
        float core = exp(-pow(d / uCore, 2.0)), band = exp(-pow(d / 0.42, 2.0)), halo = exp(-pow(d / 0.95, 2.0)) * 0.35;
        float root = smoothstep(0.0, 6.0, u), tip = smoothstep(0.0, 4.0, uLen - u);
        vec3 c = vec3(1.0) * core * 1.1 + uColor * band * (1.0 + 0.9 * flow) + uColor * halo;
        float a = max(core, band * 0.8 + halo) * root * tip;
        gl_FragColor = vec4(c * root * tip * uK, a * uK); }` });
  const beams = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), beamMat()); m.frustumCulled = false; m.renderOrder = 3.2; scene.add(m); return m; });

  // an aura of ki: soft flames rising round the body, no outline
  const auraMat = () => new THREE.ShaderMaterial({ ...add, uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uK: { value: 0 }, uSeed: { value: 0 } }, vertexShader: VS,
    fragmentShader: NOISE + `uniform float uTime, uK, uSeed; uniform vec3 uColor; varying vec2 vUv;
      void main() { float x = (vUv.x - 0.5) * 2.0, y = vUv.y;
        float n = fbm(vec2(x * 2.2 + uSeed, y * 2.6 - uTime * 2.4)), n2 = fbm(vec2(x * 5.0 - uSeed, y * 5.0 - uTime * 4.1));
        float w = 0.62 * pow(max(1.0 - y, 0.0), 0.7) + 0.18 * (n - 0.5);
        float f = smoothstep(w, w - 0.35, abs(x) + 0.15 * (n2 - 0.5)) * smoothstep(0.0, 0.12, y);
        float core = smoothstep(w * 0.55, 0.0, abs(x)) * f;
        vec3 c = uColor * f * (0.7 + 0.8 * n2) + vec3(1.0) * core * 0.35;
        gl_FragColor = vec4(c * uK, f * uK * 0.7); }` });
  const auras = [0, 1].map(i => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), auraMat()); m.material.uniforms.uSeed.value = i * 7.3; m.frustumCulled = false; m.renderOrder = 1.5; scene.add(m); return m; });

  // a ki shield in front of a guard: a curved sheet of light, brightest at its rim, flaring when a blow lands on it
  const shieldMat = () => new THREE.ShaderMaterial({ ...add, uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uK: { value: 0 }, uHit: { value: 0 } }, vertexShader: VS,
    fragmentShader: NOISE + `uniform float uTime, uK, uHit; uniform vec3 uColor; varying vec2 vUv;
      void main() { vec2 p = (vUv - vec2(0.0, 0.5)) / vec2(0.95, 0.5); float e = length(p); if (e > 1.06 || vUv.x < 0.02) discard;
        float rim = exp(-pow((e - 0.94) / 0.05, 2.0)), fill = smoothstep(1.0, 0.55, e) * 0.10;
        float hex = 0.5 + 0.5 * sin(vUv.y * 70.0 + sin(vUv.x * 40.0) * 2.0), shimmer = vnoise(vec2(vUv.y * 9.0, uTime * 6.0));
        float a = (rim * (0.9 + 0.5 * shimmer) + fill * (0.6 + 0.4 * hex)) * smoothstep(0.02, 0.25, vUv.x);
        vec3 c = mix(uColor, vec3(1.0), rim * 0.2 + uHit * 0.4) * a * (1.0 + uHit * 2.5);
        gl_FragColor = vec4(c * uK, a * uK); }` });
  const shields = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shieldMat()); m.frustumCulled = false; m.renderOrder = 3.0; scene.add(m); return m; });

  let ng = 0, nr = 0, np = 0, time = 0;
  const hdr = new THREE.Color();
  return {
    begin(pxPerUnit, t) { ng = nr = np = 0; time = t; pmat.uniforms.uPx.value = pxPerUnit; for (const m of [...beams, ...auras, ...shields]) m.visible = false; },
    // a soft glow at (x, y): size across in world units, colour, brightness (above 1 blooms)
    glow(x, y, size, color, k = 1, soft = 4) {
      if (ng >= glows.length || size <= 0.5 || k <= 0.005) return;
      const m = glows[ng++]; m.visible = true; m.position.set(x, y, 0); m.scale.set(size, size, 1);
      m.material.uniforms.uColor.value.set(color); m.material.uniforms.uK.value = k; m.material.uniforms.uSoft.value = soft;
    },
    ring(x, y, radius, color, k = 1, w = 0.08) {
      if (nr >= rings.length || radius <= 1 || k <= 0.005) return;
      const m = rings[nr++]; m.visible = true; m.position.set(x, y, 0); m.scale.set(radius * 2, radius * 2, 1);
      m.material.uniforms.uColor.value.set(color); m.material.uniforms.uK.value = k; m.material.uniforms.uW.value = w;
    },
    spark(x, y, size, color, a = 1, k = 1.6) {
      if (np >= MAX || a <= 0.01) return;
      pos[np * 3] = x; pos[np * 3 + 1] = y; pos[np * 3 + 2] = 0; hdr.set(color).multiplyScalar(k);
      col[np * 3] = hdr.r; col[np * 3 + 1] = hdr.g; col[np * 3 + 2] = hdr.b; siz[np] = size; alp[np] = a; np++;
    },
    beam(i, from, to, { color, width = 40, k = 1.5, core = 0.08 }) {
      const m = beams[i], dx = to[0] - from[0], dy = to[1] - from[1], len = Math.hypot(dx, dy);
      if (len < 2) return;
      m.visible = true; m.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 0); m.rotation.z = Math.atan2(dy, dx); m.scale.set(len, width * 2.4, 1);
      const u = m.material.uniforms; u.uTime.value = time; u.uColor.value.set(color); u.uLen.value = len; u.uK.value = k; u.uCore.value = core;
    },
    aura(i, x, y, height, color, k) {
      if (k <= 0.01) return;
      const m = auras[i]; m.visible = true; m.position.set(x, y + height * 0.55, 0); m.scale.set(height * 1.05, height * 1.35, 1);
      const u = m.material.uniforms; u.uTime.value = time; u.uColor.value.set(color); u.uK.value = k;
    },
    shield(i, x, y, facing, color, k, hit = 0) {
      if (k <= 0.01) return;
      const m = shields[i]; m.visible = true; m.position.set(x + facing * 36, y, 0); m.scale.set(facing * 70, 210, 1);
      const u = m.material.uniforms; u.uTime.value = time; u.uColor.value.set(color); u.uK.value = k; u.uHit.value = hit;
    },
    end() {
      for (let j = ng; j < glows.length; j++) glows[j].visible = false;
      for (let j = nr; j < rings.length; j++) rings[j].visible = false;
      pg.setDrawRange(0, np);
      for (const a of ['position', 'color', 'size', 'alpha']) pg.attributes[a].needsUpdate = true;
      points.visible = np > 0;
    },
  };
}

// sparks thrown from a point: n of them, each flying out and slowing, shrinking and fading; age in seconds since the throw.
// dir/spread in radians (spread 2*PI = every way); speed in world units a second; returns nothing, adds to gfx.
export function burst(gfx, x, y, age, seed, { n = 24, speed = 520, life = 0.35, size = 9, color = '#ffffff', dir = 0, spread = Math.PI * 2, gravity = -260, streak = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    const r1 = rnd(seed, i * 4), r2 = rnd(seed, i * 4 + 1), r3 = rnd(seed, i * 4 + 2), li = life * (0.45 + 0.55 * r3);
    if (age > li) continue;
    const k = age / li, a = dir + (r1 - 0.5) * spread, v = speed * (0.35 + 0.65 * r2), travel = v * age * (1 - 0.45 * k);
    const px = x + Math.cos(a) * travel, py = y + Math.sin(a) * travel + 0.5 * gravity * age * age, fade = Math.pow(1 - k, 1.4);
    gfx.spark(px, py, size * (0.5 + 0.7 * (1 - k)) * (0.6 + 0.6 * r3), color, fade);
    for (let j = 1; j <= streak; j++) gfx.spark(px - Math.cos(a) * j * size * 0.7, py - Math.sin(a) * j * size * 0.7, size * 0.55, color, fade * (1 - j / (streak + 1)) * 0.8);
  }
}
