// Copied from music_video/wukong/src/fx.js (same author). Changed: the import of the shared shader pieces, and createSpark takes colours.
// Effects drawn as flat, hand-drawn-looking shapes that change in steps (12 a second): the aura flame, speed lines, lightning.
import * as THREE from 'three';
import { NOISE, PRINT, PRINTGLSL } from './glsl.js';

// ---- aura: a flame-shaped sheet that always faces the camera, one copy behind the figure and a thin veil in front -------------
// place(camera, centre, height): centre = the figure's feet (world), height = the figure's height.
export function createAura() {
  const mk = front => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color('#fff6c8') }, uB: { value: new THREE.Color('#ffd23a') }, uC: { value: new THREE.Color('#ff9a1c') },
      uPower: { value: 1 }, uAlpha: { value: 1 }, uFront: { value: front ? 1 : 0 }, uSeed: { value: 0 }, uGain: { value: 1.6 }, uBody: { value: 1 }, ...PRINT },
    transparent: true, depthWrite: false, depthTest: !front, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: NOISE + PRINTGLSL + /* glsl */`
      uniform float uTime, uPower, uAlpha, uFront, uSeed, uGain, uBody; uniform vec3 uA, uB, uC; varying vec2 vUv;
      void main() {
        float t = floor(uTime * 12.0) / 12.0 + uSeed * 17.0;
        float x = (vUv.x - 0.5) * 2.0, y = vUv.y;
        float n1 = fbm(vec2(x * 2.3 + uSeed, y * 2.6 - t * 2.9)), n2 = fbm(vec2(x * 6.5 + 3.1, y * 6.0 - t * 5.6)), n3 = fbm(vec2(x * 1.4 - 7.7, y * 1.2 - t * 1.3));
        float prof = 0.64 * pow(max(1.0 - y, 0.0), 0.82) * (0.80 + 0.20 * smoothstep(0.0, 0.2, y));   // widest low down, a point at the top
        float xx = x + 0.12 * (n3 - 0.5) * y;                                                    // the whole flame leans a little
        float tongues = pow(abs(n2 - 0.5) * 2.0, 1.6) * sign(n2 - 0.5);
        float d = abs(xx) - prof * (0.80 + 0.55 * (n1 - 0.5) * (0.4 + y)) - 0.11 * tongues * (0.35 + y);
        float aa = fwidth(d) * 0.9 + 0.0015, inside = smoothstep(aa, -aa, d);
        if (inside < 0.004) discard;
        float k = clamp(-d / max(prof, 0.02), 0.0, 1.0);                                       // 0 at the edge, 1 on the axis
        float kk = k + 0.07 * (n2 - 0.5);
        float rim = 1.0 - smoothstep(0.022, 0.036, k), edge = 1.0 - smoothstep(0.10, 0.12, kk), band = 1.0 - smoothstep(0.30, 0.33, kk);
        float streak = step(0.88, vnoise(vec2(xx * 46.0, y * 2.0 - t * 6.5))) * step(0.5, vnoise(vec2(xx * 9.0 + 4.0, y * 1.1 - t * 2.2))) * smoothstep(0.03, 0.2, k) * (1.0 - smoothstep(0.45, 0.7, k));
        vec3 col = mix(uA, uB, band); col = mix(col, uC, edge); col = mix(col, vec3(1.0), max(rim * 0.9, streak * 0.7));   // core, body, edge, and a white-hot outline
        float alpha = mix(0.20, 0.50, band) * uBody; alpha = max(alpha, max(edge * 0.86, max(rim, streak * 0.8)));
        alpha *= smoothstep(-0.01, 0.07, y);
        if (uFront > 0.5) { alpha = streak * 0.45 + 0.05 * (1.0 - band); }                             // the veil in front: streaks and a faint wash, no outline of its own
        if (uManga > 0.5) {                                                                        // print: an inked outline, a band of the spot colour breaking into dots, clear inside
          float dots = halftone(gl_FragCoord.xy, 0.5 * (1.0 - smoothstep(0.12, 0.34, kk)) + 0.12);
          col = mix(uSpot, uInkC, rim); alpha = max(rim, max(edge, band * dots));
          if (streak > 0.5 && rim < 0.5) { col = uPaper; alpha = 0.9; }
          if (uFront > 0.5) { col = uPaper; alpha = streak * 0.7; }
          gl_FragColor = vec4(col, alpha * inside * uAlpha); return;
        }
        gl_FragColor = vec4(col * uGain, alpha * inside * uAlpha);
      }`,
  }));
  const back = mk(false), front = mk(true); back.renderOrder = 0.5; front.renderOrder = 5; back.frustumCulled = front.frustumCulled = false;
  const group = new THREE.Group(); group.add(back, front);
  const dir = new THREE.Vector3();
  return {
    group, back, front,
    // colours: [core, body, edge]; body = how solid the inside is (1 = a light wash)
    set({ time, colors, power = 1, alpha = 1, gain = 1.6, seed = 0, body = 1 }) {
      for (const m of [back, front]) {
        const u = m.material.uniforms; u.uTime.value = time; u.uPower.value = power; u.uAlpha.value = alpha; u.uGain.value = gain; u.uSeed.value = seed; u.uBody.value = body;
        if (colors) { u.uA.value.set(colors[0]); u.uB.value.set(colors[1]); u.uC.value.set(colors[2]); }
      }
      group.visible = alpha > 0.001 && power > 0.01;
    },
    place(camera, feet, height, { wide = 2.5, tall = 1.78 } = {}) {
      const grow = 0.55 + 0.45 * back.material.uniforms.uPower.value; wide *= grow; tall *= grow;      // power sets the size
      camera.getWorldDirection(dir);
      for (const m of [back, front]) {
        m.quaternion.copy(camera.quaternion); m.scale.set(height * wide, height * tall, 1);
        m.position.copy(feet); m.position.y += height * tall * 0.5 - height * 0.06;                              // its base on the ground line
        m.position.addScaledVector(dir, m === back ? height * 0.5 : -height * 0.5);                          // behind the figure, or just in front
      }
    },
  };
}

// ---- overlay: speed lines over the whole frame (a quad in clip space, drawn last) ----------------------------------------------
export function createSpeedLines() {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uAspect: { value: 16 / 9 }, uAmount: { value: 0 }, uInner: { value: 0.35 }, uCount: { value: 90 }, uColor: { value: new THREE.Color(1, 1, 1) }, uGain: { value: 1 }, uFat: { value: 1 }, uSkip: { value: new THREE.Vector2(0, 0) } },
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime, uAspect, uAmount, uInner, uCount, uGain, uFat; uniform vec2 uCenter, uSkip; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float t = floor(uTime * 12.0);
        vec2 p = (vUv - uCenter) * vec2(uAspect, 1.0); float r = length(p), a = atan(p.y, p.x) / 6.2831853 + 0.5;
        if (abs(fract(a - uSkip.x + 0.5) - 0.5) < uSkip.y) discard;                               // a sector kept clear (uSkip: its direction and half-width, in turns)
        float cell = floor(a * uCount), f = fract(a * uCount);
        float h1 = hash21(vec2(cell, t)), h2 = hash21(vec2(cell + 31.0, t * 1.7)), h3 = hash21(vec2(cell + 77.0, t));
        float on = step(1.0 - uAmount, h1);
        float r0 = uInner * (0.55 + 0.9 * h2);
        float wdt = min(1.0, (0.12 + 0.5 * h3) * uFat) * smoothstep(r0, r0 + 0.55 / uFat, r);      // a wedge: thin at its tip, wider outwards (uFat > 1: the wedges close up into a dark surround)
        float line = on * step(abs(f - 0.5), wdt * 0.5) * step(r0, r);
        if (line < 0.5) discard;
        gl_FragColor = vec4(uColor * uGain, 1.0);
      }`,
  }));
  mesh.frustumCulled = false; mesh.renderOrder = 50;
  return { mesh, set({ time, amount = 0, inner = 0.35, count = 90, color = '#ffffff', center = [0.5, 0.5], gain = 1, aspect, fat = 1, skip = [0, 0] }) {
    const u = mesh.material.uniforms; u.uFat.value = fat; u.uSkip.value.fromArray(skip); u.uTime.value = time; u.uAmount.value = amount; u.uInner.value = inner; u.uCount.value = count; u.uColor.value.set(color); u.uCenter.value.fromArray(center); u.uGain.value = gain;
    if (aspect) u.uAspect.value = aspect; mesh.visible = amount > 0.001;
  } };
}

// ---- lightning: jagged ribbons around a figure, redrawn every step ------------------------------------------------------------
export function createLightning(N = 5, SEG = 11) {
  const hash = n => { let x = Math.imul(n ^ 0x9E3779B9, 0x85EBCA6B); x ^= x >>> 13; x = Math.imul(x, 0xC2B2AE35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  const MAXV = N * SEG * 6 * 2, pos = new Float32Array(MAXV * 3), col = new Float32Array(MAXV * 3), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide }));
  mesh.frustumCulled = false; mesh.renderOrder = 6;
  const right = new THREE.Vector3(), up = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3(), P = [];
  for (let i = 0; i <= SEG; i++) P.push(new THREE.Vector3());
  return { mesh,
    // bolts crackle beside a figure standing at `feet` with the given height; amount 0..1 = how many; colour multiplies (values over 1 glow);
    // outline = a colour drawn under each bolt, wider (print look), or null
    set(camera, feet, height, { time, amount = 0, color = [3, 3.2, 4], width = 0.0065, outline = null }) {
      const step = Math.floor(time * 12), count = Math.round(N * Math.min(1, amount)); let k = 0;
      right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1); camera.getWorldDirection(b);
      for (const layer of outline ? [0, 1] : [1]) for (let j = 0; j < count; j++) {
        const s = step * 131 + j * 977;
        if (hash(s) < 0.35) continue;                                                           // each bolt is out for some of the steps
        const side = hash(s + 1) < 0.5 ? -1 : 1, x0 = side * (0.42 + 0.5 * hash(s + 5)), y0 = 0.08 + 0.78 * hash(s + 2), ang = hash(s + 3) * 6.283, len = (0.18 + 0.30 * hash(s + 4)) * height;   // beside the body, not across it
        const z0 = (hash(s + 6) - 0.5) * 0.7 * height, c = layer ? color : outline, wk = layer ? 1 : 2.6;
        for (let i = 0; i <= SEG; i++) {
          const u = i / SEG, jag = (hash(s + 10 + i) - 0.5) * 0.16 * height * Math.sin(u * Math.PI);
          P[i].copy(feet).addScaledVector(right, x0 * height * 0.6 + Math.cos(ang) * len * (u - 0.5) - Math.sin(ang) * jag).addScaledVector(b, z0 + (layer ? -0.004 : 0)).add(n.set(0, y0 * height + Math.sin(ang) * len * (u - 0.5) + Math.cos(ang) * jag, 0));
        }
        for (let i = 0; i < SEG; i++) {
          n.copy(P[i + 1]).sub(P[i]); const w = width * wk * height * (1 - Math.abs(i / SEG - 0.5) * 1.2);
          a.crossVectors(n, b).normalize().multiplyScalar(w);
          const q = [P[i].clone().add(a), P[i].clone().sub(a), P[i + 1].clone().sub(a), P[i + 1].clone().add(a)];
          for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) { pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z; col[k] = c[0]; col[k + 1] = c[1]; col[k + 2] = c[2]; k += 3; }
        }
      }
      g.setDrawRange(0, k / 3); g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; mesh.visible = k > 0;
    } };
}

// ---- beam: a ribbon from A to B that faces the camera, with a ball at its root -------------------------------------------------
// Drawn like the aura: an inked outline, a band of colour, a light core; its edge wobbles in steps.
export function createBeam() {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(4 * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]), 2)); g.setIndex([0, 2, 1, 1, 2, 3]);
  const U = { uTime: { value: 0 }, uA: { value: new THREE.Color('#ffffff') }, uB: { value: new THREE.Color('#ff5a2a') }, uC: { value: new THREE.Color('#c40f2a') }, uLen: { value: 10 }, uGain: { value: 1 }, uHead: { value: 0 },
    uPower: { value: 0 }, uHalo: { value: 0 }, uSpan: { value: 1 }, ...PRINT };
  // kind: 0 = the beam, 1 = the ball at its root, 2 = the halo of that ball (drawn under the beam). uSpan: how many times wider than the shape its sheet is (room for a halo).
  const mat = kind => new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: NOISE + PRINTGLSL + /* glsl */`
      uniform float uTime, uLen, uGain, uHead, uPower, uHalo, uSpan; uniform vec3 uA, uB, uC; varying vec2 vUv;
      void main() {
        float t = floor(uTime * 12.0), far, span = ${kind === 1 ? '1.0' : 'uSpan'};          // far: how far outside the shape, in half-widths
        ${kind === 0 ? /* glsl */`
        float x = vUv.x * uLen, sy = vUv.y - 0.5, y = abs(sy) * 2.0 * span, sd = sign(sy) * 7.0;  // x: along the beam in widths; y: 0 on the axis, 1 at the edge; the two edges wobble apart
        float w = 0.80 + (0.12 + 0.10 * uPower) * (fbm(vec2(x * 0.9 - t * 1.7, t * 0.37 + sd)) - 0.5) + (0.10 + 0.16 * uPower) * (vnoise(vec2(x * 3.0 - t * 2.3, 3.0 + sd)) - 0.5);
        w *= smoothstep(0.0, 0.6, x + 0.25) * mix(1.0, smoothstep(0.0, 1.2, uLen - x), uHead);     // swells out of the ball; uHead rounds the far end
        float k = 1.0 - y / max(w, 0.001); far = y - w;                                           // k: 0 at the edge, 1 on the axis
        float streak = step(0.80 - 0.12 * uPower, vnoise(vec2(x * 0.5 - t * 3.1, y * 9.0 + sd))) * step(0.25, k) * (1.0 - step(0.62, k));` : /* glsl */`
        vec2 p = (vUv - 0.5) * 2.0 * span; float a = atan(p.y, p.x), r = length(p);
        float w = 0.80 + (0.14 + 0.08 * uPower) * (fbm(vec2(a * 1.6, t * 0.71)) - 0.5) + 0.05 * (vnoise(vec2(a * 4.0, t * 1.3)) - 0.5);
        float k = 1.0 - r / w, streak = 0.0; far = r - w;`}
        if (k < 0.0 || ${kind === 2 ? 'true' : 'false'}) {                                        // outside the shape: nothing, or the halo: dots of the colour, thinning outwards
          float h = uHalo * (1.0 - smoothstep(0.0, max(span - 1.0, 0.001), far)), al = (${kind === 1 ? 'false' : 'true'} && uHalo > 0.0 && k < 0.0) ? halftone(gl_FragCoord.xy, 0.62 * h) : 0.0;
          if (al < 0.01) discard;
          gl_FragColor = vec4(uManga > 0.5 ? uSpot : uB * uGain, al); return;
        }
        float e0 = 0.20 - 0.09 * uPower, b0 = 0.42 - 0.16 * uPower;                               // more power: a thinner coloured edge, more of it white-hot
        float aa = fwidth(k) * 0.9 + 0.002, rim = 1.0 - smoothstep(0.045, 0.045 + aa, k), edge = 1.0 - smoothstep(e0, e0 + aa, k), band = 1.0 - smoothstep(b0, b0 + aa, k);
        vec3 col; float alpha = 1.0;
        if (uManga > 0.5) {                                                                        // print: ink outline, the spot colour, a dotted fringe, paper core
          col = mix(uPaper, uSpot, max(edge, band * halftone(gl_FragCoord.xy, 0.5)));
          col = mix(col, uPaper, streak); col = mix(col, uInkC, rim);
        } else { col = mix(mix(uA, uB, band), uC, edge); col = mix(col, vec3(1.0), max(rim * 0.9, streak * 0.6)) * uGain; }
        gl_FragColor = vec4(col, alpha);
      }` });
  const body = new THREE.Mesh(g, mat(0)), ball = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(1)), ballHalo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(2));
  body.frustumCulled = ball.frustumCulled = ballHalo.frustumCulled = false; ballHalo.renderOrder = 2.9; body.renderOrder = 3; ball.renderOrder = 3.1;
  const group = new THREE.Group(); group.add(ballHalo, body, ball);
  const d = new THREE.Vector3(), side = new THREE.Vector3(), v = new THREE.Vector3(), cd = new THREE.Vector3();
  return { group, U,
    // from, to: THREE.Vector3 (world); width in metres; ball = the ball's size in beam widths (0 = none); head = 1 rounds the far end (a beam still on its way);
    // power 0..1 = a wilder edge and a wider white core; halo 0..1 = a fringe of dots around beam and ball
    set(camera, from, to, { time, width = 0.5, ball: bs = 1.5, colors, gain = 1, head = 0, power = 0, halo = 0, visible = true }) {
      group.visible = visible; if (!visible) return;
      const span = halo > 0 ? 1.8 : 1;
      d.copy(to).sub(from); const len = d.length(); d.normalize();
      cd.copy(camera.position).sub(from); side.crossVectors(d, cd).normalize().multiplyScalar(width * 0.5 / 0.8 * span);
      [[from, -1], [from, 1], [to, -1], [to, 1]].forEach(([p, s], i) => { v.copy(p).addScaledVector(side, s); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; });
      g.attributes.position.needsUpdate = true;
      U.uTime.value = time; U.uLen.value = len / width; U.uGain.value = gain; U.uHead.value = head; U.uPower.value = power; U.uHalo.value = halo; U.uSpan.value = span;
      if (colors) { U.uA.value.set(colors[0]); U.uB.value.set(colors[1]); U.uC.value.set(colors[2]); }
      ball.visible = bs > 0; ball.position.copy(from); ball.quaternion.copy(camera.quaternion); ball.scale.setScalar(width * bs / 0.8);
      ballHalo.visible = bs > 0 && halo > 0; ballHalo.position.copy(from); ballHalo.quaternion.copy(camera.quaternion); ballHalo.scale.setScalar(width * bs / 0.8 * span);
    } };
}

// ---- orb: a ball of dark energy (the enemy's), a disc that faces the camera --------------------------------------------------------
export function createOrb() {
  const U = { uTime: { value: 0 }, uCore: { value: new THREE.Color('#ff7ad9') }, uBody: { value: new THREE.Color('#2a0a3a') }, uBreak: { value: 0 }, ...PRINT };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: NOISE + PRINTGLSL + /* glsl */`
      uniform float uTime, uBreak; uniform vec3 uCore, uBody; varying vec2 vUv;
      void main() {
        float t = floor(uTime * 12.0); vec2 p = (vUv - 0.5) * 2.0; float a = atan(p.y, p.x), r = length(p);
        float w = 0.74 + 0.05 * (fbm(vec2(a * 2.0, t * 0.61)) - 0.5);
        float halo = 1.0 - smoothstep(w, 1.0, r);                                                // a fringe of dots around it
        float crack = 1.0 - smoothstep(0.012 + 0.03 * uBreak, 0.03 + 0.08 * uBreak, abs(fbm(p * 2.6 + t * 0.4) - 0.5));          // light veins crawling over it; uBreak widens them into fissures
        float shine = 1.0 - smoothstep(0.16, 0.20, length(p - vec2(-0.26, 0.30)));
        float aa = fwidth(r) + 0.003, in0 = 1.0 - smoothstep(w - aa, w + aa, r), rim = in0 * smoothstep(w - 0.05 - aa, w - 0.05 + aa, r);
        vec3 col; float alpha;
        if (uManga > 0.5) {
          vec3 light = uManga > 1.5 ? uCore : uPaper, dark = uManga > 1.5 ? uBody : uInkC;
          col = mix(dark, light, max(crack * 0.9, shine) * (1.0 - rim)); col = mix(col, uInkC, rim);
          alpha = max(in0, halo * halftone(gl_FragCoord.xy, 0.45 * halo) * (1.0 - in0)); if (in0 < 0.5) col = dark;
        } else { col = mix(uBody, uCore * 1.6, max(crack, shine)); alpha = max(in0, halo * 0.35); }
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
      }` }));
  mesh.frustumCulled = false; mesh.renderOrder = 2.5;
  return { mesh, set(camera, at, { time, size = 1, visible = true, break: br = 0 }) { mesh.visible = visible && size > 0.001; if (!mesh.visible) return; U.uBreak.value = br; U.uTime.value = time; mesh.position.copy(at); mesh.quaternion.copy(camera.quaternion); mesh.scale.setScalar(size / 0.74); } };
}

// ---- bursts: spiky stars where blows land (paper inside, ink outline), each a sheet facing the camera ----------------------------
export function createBursts(N = 6) {
  const mk = () => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: { uSeed: { value: 0 }, uSpikes: { value: 11 }, uFill: { value: new THREE.Color('#ffffff') }, ...PRINT }, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: NOISE + PRINTGLSL + /* glsl */`
      uniform float uSeed, uSpikes; uniform vec3 uFill; varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0; float a = atan(p.y, p.x) / 6.2831853 + 0.5, r = length(p);
        float c = a * uSpikes + uSeed, id = floor(c), f = abs(fract(c) - 0.5) * 2.0;             // f: 0 at a spike's tip line, 1 between spikes
        float tip = 0.55 + 0.45 * hash21(vec2(id, uSeed)), R = mix(tip, 0.30, pow(f, 0.8));
        float k = R - r; if (k < 0.0) discard;
        float aa = fwidth(k) + 0.004, line = 1.0 - smoothstep(0.035, 0.035 + aa, k);
        vec3 fill = uManga > 0.5 ? uPaper : uFill;
        gl_FragColor = vec4(mix(fill, uManga > 0.5 ? uInkC : vec3(0.05), line), 1.0);
      }` }));
  const list = Array.from({ length: N }, mk), group = new THREE.Group();
  list.forEach(m => { m.frustumCulled = false; m.renderOrder = 7; group.add(m); });
  // items: [{ at: Vector3, size (m), seed, spikes, depth (true: figures in front of it hide it) }]
  return { group, set(camera, items = []) { list.forEach((m, i) => { const it = items[i]; m.visible = !!it; if (!it) return; m.material.depthTest = !!it.depth; m.renderOrder = it.depth ? 0.6 : 7; m.position.copy(it.at); m.quaternion.copy(camera.quaternion); m.rotateZ((it.seed || 0) * 2.4); m.scale.setScalar(it.size); m.material.uniforms.uSeed.value = it.seed || 0; m.material.uniforms.uSpikes.value = it.spikes || 11; }); } };
}

// ---- spark: the ball of light gathered between the hands, drawn as a glaring light source. A white-hot core with a ring of colour;
// around it a crown of short rays, a few long ones that reach far out, a four-point glint, and a fringe of dots. Everything
// flickers in steps. size = the ball's diameter in metres; the sheet is SPAN times that, to hold the rays.
export function createSpark() {
  const SPAN = 16, U = { uTime: { value: 0 }, uA: { value: new THREE.Color('#ffffff') }, uB: { value: new THREE.Color('#ff5a2a') }, uRays: { value: 1 }, uR: { value: 1 / SPAN }, uPart: { value: 0 }, ...PRINT };
  const mk = part => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: { ...U, uPart: { value: part } }, transparent: true, depthWrite: false, depthTest: part === 0, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: NOISE + PRINTGLSL + /* glsl */`
      uniform float uTime, uRays, uR, uPart; uniform vec3 uA, uB; varying vec2 vUv;
      void main() {
        float t = floor(uTime * 12.0); vec2 p = (vUv - 0.5) * 2.0; float a = atan(p.y, p.x) / 6.2831853 + 0.5, r = length(p);
        float R = uR * (1.0 + 0.07 * sin(t * 2.4)), aa = fwidth(r) + 0.0012;
        vec3 light = uManga > 0.5 ? uPaper : uA, colour = uManga > 0.5 ? uSpot : uB, ink = uManga > 0.5 ? uInkC : uB * 0.4;
        if (uPart < 0.5) {                                                                         // the ball itself (the hands can hide it)
          float ball = 1.0 - smoothstep(R - aa, R + aa, r); if (ball < 0.01) discard;
          float core = 1.0 - smoothstep(R * 0.74 - aa, R * 0.74 + aa, r), line = smoothstep(R - 0.012 - aa, R - 0.012 + aa, r);
          gl_FragColor = vec4(mix(mix(colour, light, core), ink, line), ball); return;
        }
        if (r < R) discard;                                                                        // the glare (drawn over everything)
        float c1 = a * 40.0 + t * 0.37, i1 = floor(c1), f1 = abs(fract(c1) - 0.5) * 2.0, l1 = R * (1.0 + (1.6 + 3.4 * hash21(vec2(i1, t))) * uRays);
        float ray1 = step(r, l1) * step(f1, 0.62 * (1.0 - (r - R) / (l1 - R))) * step(0.22, hash21(vec2(i1 + 9.0, t)));
        float c2 = a * 13.0 + t * 0.61 + 0.3, i2 = floor(c2), f2 = abs(fract(c2) - 0.5) * 2.0, l2 = R + (0.30 + 0.70 * hash21(vec2(i2, t + 5.0))) * uRays;
        float ray2 = step(r, l2) * step(f2, 0.20 * (1.0 - (r - R) / (l2 - R))) * step(0.2, hash21(vec2(i2 + 3.0, t)));
        float gl = 0.95 * uRays, gs = 0.55 * uRays;                                              // the glint: one long streak across, a shorter one up and down
        float glint = max(step(abs(p.y), R * 0.34 * max(0.0, 1.0 - abs(p.x) / gl)), step(abs(p.x), R * 0.30 * max(0.0, 1.0 - abs(p.y) / gs)));
        float bloom = 1.0 - smoothstep(R * 1.02, R * 1.5, r);                                       // a white bloom hugging the ball
        float rays = max(max(ray1, ray2), glint);
        if (rays > 0.5 || bloom > 0.55) { gl_FragColor = vec4(light, 1.0); return; }
        float halo = 1.0 - smoothstep(R * 1.2, R * 3.6, r); if (halo < 0.01) discard;                 // then a fringe of dots in the colour
        gl_FragColor = vec4(colour, uManga > 0.5 ? halftone(gl_FragCoord.xy, 0.8 * halo) : halo * 0.6);
      }` }));
  const core = mk(0), glare = mk(1), group = new THREE.Group(); core.renderOrder = 3.2; glare.renderOrder = 8; core.frustumCulled = glare.frustumCulled = false; group.add(core, glare);
  return { mesh: group, set(camera, at, { time, size = 0.14, rays = 1, visible = true, colors }) { group.visible = visible && size > 0.001; if (!group.visible) return;
    if (colors) { U.uA.value.set(colors[0]); U.uB.value.set(colors[1]); }                     // added here: the ball takes its owner's ki colour
    for (const m of [core, glare]) { const u = m.material.uniforms; u.uTime.value = time; u.uRays.value = rays; m.position.copy(at); m.quaternion.copy(camera.quaternion); m.scale.setScalar(size * SPAN); } } };
}

// ---- rings: flat hoops around a beam, square to it (pressure rings). Each is drawn in two halves, the far one under the beam and the
// near one over it, so the hoop goes round the beam.
export function createRings(N = 5) {
  const INNER = 0.93, geo = new THREE.RingGeometry(INNER, 1, 96, 1);
  const mk = side => new THREE.ShaderMaterial({ uniforms: { uCenter: { value: new THREE.Vector3() }, uSide: { value: side }, ...PRINT }, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vWP; varying vec2 vL; void main() { vL = position.xy; vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: PRINTGLSL + /* glsl */`
      uniform vec3 uCenter; uniform float uSide; varying vec3 vWP; varying vec2 vL;
      void main() {
        if (dot(vWP - uCenter, cameraPosition - uCenter) * uSide < 0.0) discard;                  // the near half, or the far half
        float k = (length(vL) - ${INNER.toFixed(2)}) / ${(1 - INNER).toFixed(2)}, aa = fwidth(k) + 0.01;
        float line = max(1.0 - smoothstep(0.26, 0.26 + aa, k), smoothstep(0.74 - aa, 0.74, k));       // a band of paper between two ink lines
        gl_FragColor = vec4(mix(uManga > 0.5 ? uPaper : vec3(1.0), uManga > 0.5 ? uInkC : vec3(0.05), line), 1.0);
      }` });
  const rings = Array.from({ length: N }, () => { const back = new THREE.Mesh(geo, mk(-1)), front = new THREE.Mesh(geo, mk(1)); back.renderOrder = 2.8; front.renderOrder = 3.4; back.frustumCulled = front.frustumCulled = false; return { back, front }; });
  const group = new THREE.Group(); rings.forEach(r => group.add(r.back, r.front));
  const q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), c = new THREE.Vector3();
  return { group,
    // hoops around the line from `from` along the unit vector `dir`: items = [{ d: distance along it (m), r: radius (m) }]
    set(from, dir, items = []) { q.setFromUnitVectors(Z, dir);
      rings.forEach((R, i) => { const it = items[i]; for (const m of [R.back, R.front]) { m.visible = !!it && it.r > 0.001; if (!m.visible) continue;
        c.copy(from).addScaledVector(dir, it.d); m.position.copy(c); m.quaternion.copy(q); m.scale.setScalar(it.r); m.material.uniforms.uCenter.value.copy(c); } }); } };
}

// ---- arcs: lightning that crawls along the outside of a beam, redrawn every step ---------------------------------------------------
export function createArcs(N = 9, SEG = 9) {
  const hash = n => { let x = Math.imul(n ^ 0x9E3779B9, 0x85EBCA6B); x ^= x >>> 13; x = Math.imul(x, 0xC2B2AE35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  const MAXV = N * SEG * 6 * 2, pos = new Float32Array(MAXV * 3), col = new Float32Array(MAXV * 3), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide }));
  mesh.frustumCulled = false; mesh.renderOrder = 6;
  const dn = new THREE.Vector3(), view = new THREE.Vector3(), side = new THREE.Vector3(), along = new THREE.Vector3(), perp = new THREE.Vector3(), a = new THREE.Vector3(), n = new THREE.Vector3(), P = [];
  for (let i = 0; i <= SEG; i++) P.push(new THREE.Vector3());
  return { mesh,
    // from, to: the beam's ends; width: the beam's width (m); reach: how far along the beam the bolts appear (m); amount 0..1 = how many
    set(camera, from, to, { time, amount = 0, width = 1, reach = 12, color = [0.96, 0.94, 0.9], outline = [0.02, 0.02, 0.03] }) {
      const step = Math.floor(time * 12), count = Math.round(N * Math.min(1, amount)); let k = 0;
      dn.copy(to).sub(from); const len = dn.length(); if (len < 1e-4 || !count) { g.setDrawRange(0, 0); mesh.visible = false; return; }
      dn.normalize(); camera.getWorldDirection(view); side.crossVectors(dn, view).normalize();       // across the beam, in the picture plane
      for (const layer of [0, 1]) for (let j = 0; j < count; j++) {
        const s = step * 131 + j * 977; if (hash(s) < 0.3) continue;                               // each bolt is out for most of the steps
        const sg = hash(s + 1) < 0.5 ? -1 : 1, t0 = Math.min(len * 0.92, reach) * (0.04 + 0.96 * hash(s + 2)), off = sg * (0.5 + 0.45 * hash(s + 5)) * width, ang = (hash(s + 3) - 0.5) * 1.7, L = (0.5 + 1.1 * hash(s + 4)) * width;
        along.copy(dn).multiplyScalar(Math.cos(ang)).addScaledVector(side, sg * Math.sin(ang)); perp.copy(side).multiplyScalar(sg * Math.cos(ang)).addScaledVector(dn, -Math.sin(ang));
        const c = layer ? color : outline, wk = (layer ? 1 : 2.6) * 0.017 * width;
        for (let i = 0; i <= SEG; i++) { const u = i / SEG, jag = (hash(s + 10 + i) - 0.5) * 0.5 * L * Math.sin(u * Math.PI);
          P[i].copy(from).addScaledVector(dn, t0).addScaledVector(side, off).addScaledVector(along, L * (u - 0.5)).addScaledVector(perp, jag).addScaledVector(view, layer ? -0.01 : 0); }
        for (let i = 0; i < SEG; i++) { n.copy(P[i + 1]).sub(P[i]); a.crossVectors(n, view).normalize().multiplyScalar(wk * (1 - Math.abs(i / SEG - 0.5) * 1.2));
          const q = [P[i].clone().add(a), P[i].clone().sub(a), P[i + 1].clone().sub(a), P[i + 1].clone().add(a)];
          for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) { pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z; col[k] = c[0]; col[k + 1] = c[1]; col[k + 2] = c[2]; k += 3; } }
      }
      g.setDrawRange(0, k / 3); g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; mesh.visible = k > 0;
    } };
}
