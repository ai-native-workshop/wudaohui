// Copied from music_video/wukong/src/engine.js (same author), unchanged.
// The frame: scenes are drawn into a multisampled, oversized linear target; finish() adds the glow and the treatments that act
// on the whole picture (shake, zoom blur, impact-frame tones, flash, grain) and writes sRGB to the canvas.
import * as THREE from 'three';

const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export function createEngine(renderer, W, H, { ss = 1.5 } = {}) {
  const RW = Math.round(W * ss), RH = Math.round(H * ss);
  renderer.autoClear = false;                                // several scenes are drawn into one frame: clear only where asked
  const opts = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const rt = new THREE.WebGLRenderTarget(RW, RH, { ...opts, depthBuffer: true, samples: 4 });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), post = new THREE.Scene(); post.add(quad); quad.frustumCulled = false;
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(post, cam); };

  // glow: the bright parts, blurred at three sizes
  const lv = [2, 4, 8].map(d => ({ a: new THREE.WebGLRenderTarget(Math.round(W / d), Math.round(H / d), opts), b: new THREE.WebGLRenderTarget(Math.round(W / d), Math.round(H / d), opts) }));
  const bright = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, uKnee: { value: 0.92 } }, depthTest: false, depthWrite: false, vertexShader: VS, fragmentShader: /* glsl */`
    uniform sampler2D t; uniform float uKnee; varying vec2 vUv;
    void main() { vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(uKnee, uKnee + 0.6, l), 1.0); }` });
  const blur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, uDir: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false, vertexShader: VS, fragmentShader: /* glsl */`
    uniform sampler2D t; uniform vec2 uDir; varying vec2 vUv;
    void main() { vec3 c = texture2D(t, vUv).rgb * 0.2270270270;
      c += (texture2D(t, vUv + uDir * 1.3846153846).rgb + texture2D(t, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
      c += (texture2D(t, vUv + uDir * 3.2307692308).rgb + texture2D(t, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
      gl_FragColor = vec4(c, 1.0); }` });
  const copy = new THREE.ShaderMaterial({ uniforms: { t: { value: null } }, depthTest: false, depthWrite: false, vertexShader: VS, fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main() { gl_FragColor = texture2D(t, vUv); }' });

  const fin = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: rt.texture }, g1: { value: lv[0].a.texture }, g2: { value: lv[1].a.texture }, g3: { value: lv[2].a.texture }, uTexel: { value: new THREE.Vector2(1 / RW, 1 / RH) },
      uExposure: { value: 1 }, uGlow: { value: 0.8 }, uShake: { value: new THREE.Vector2() }, uZoom: { value: 0 }, uZoomC: { value: new THREE.Vector2(0.5, 0.5) },
      uFlash: { value: new THREE.Color(1, 1, 1) }, uFlashK: { value: 0 }, uTone: { value: 0 }, uToneA: { value: new THREE.Color(1, 1, 1) }, uToneB: { value: new THREE.Color(0, 0, 0) }, uToneT: { value: 0.3 },
      uGrain: { value: 0.035 }, uFrame: { value: 0 }, uVig: { value: 0.22 }, uSat: { value: 1 }, uCA: { value: 0 },
      uCam2: { value: new THREE.Vector3(1, 0, 0) }, uPaperK: { value: 0 }, uPaperC: { value: new THREE.Color(1, 1, 1) }, uInvert: { value: 0 },
      uSoft: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uLift: { value: 0 }, uRough: { value: 0 } },
    depthTest: false, depthWrite: false, vertexShader: VS,
    fragmentShader: /* glsl */`
      uniform sampler2D tScene, g1, g2, g3; uniform vec2 uTexel, uShake, uZoomC; uniform vec3 uFlash, uToneA, uToneB;
      uniform float uExposure, uGlow, uZoom, uFlashK, uTone, uToneT, uGrain, uFrame, uVig, uSat, uCA, uPaperK, uInvert, uSoft, uLift, uRough; uniform vec3 uCam2, uPaperC, uTint; varying vec2 vUv;
      vec3 toSRGB(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      vec3 tap(vec2 uv) { return 0.25 * (texture2D(tScene, uv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tScene, uv + uTexel * vec2(0.5, -0.5)).rgb + texture2D(tScene, uv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tScene, uv + uTexel * vec2(0.5, 0.5)).rgb); }
      void main() {
        float push = 1.0 + 2.2 * max(abs(uShake.x), abs(uShake.y));                               // zoom in just enough to hide the edge while shaking
        vec2 uv = (vUv - 0.5) / (push * uCam2.x) + 0.5 + uCam2.yz + uShake;                       // uCam2: a flat camera over the picture (zoom, offset)
        if (uRough > 0.0) { vec2 px = uv / (uTexel * 1.5); uv += (vec2(vn(px / 5.5), vn(px / 5.5 + 31.7)) - 0.5) * uRough * 2.4 * uTexel * 1.5; }   // edges waver by about a pixel: drawn, not plotted
        vec3 c;
        if (uZoom > 0.001) { c = vec3(0.0); for (int i = 0; i < 12; i++) { float k = float(i) / 11.0; c += tap(uZoomC + (uv - uZoomC) * (1.0 - uZoom * k)); } c /= 12.0; }
        else if (uCA > 0.0001) { vec2 d = (uv - 0.5) * uCA; c = vec3(tap(uv + d).r, tap(uv).g, tap(uv - d).b); }
        else c = tap(uv);
        if (uSoft > 0.0) { vec2 o = uTexel * 3.4; c = mix(c, 0.25 * (tap(uv + o) + tap(uv - o) + tap(uv + vec2(o.x, -o.y)) + tap(uv + vec2(-o.x, o.y))), uSoft); }   // a little film softness
        vec3 glow = texture2D(g1, uv).rgb * 0.45 + texture2D(g2, uv).rgb * 0.35 + texture2D(g3, uv).rgb * 0.30;
        c = c * uExposure + glow * uGlow;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, uSat);
        c = mix(c, mix(uToneB, uToneA, smoothstep(uToneT - 0.01, uToneT + 0.01, l)), uTone);      // impact frame: two flat tones
        c = mix(c, clamp(vec3(0.93) - c, 0.0, 1.0), uInvert);                                      // negative: ink and paper change places
        if (uRough > 0.0) { vec2 px = uv / (uTexel * 1.5); float dark = 1.0 - smoothstep(0.02, 0.12, dot(c, vec3(0.333)));          // solid ink: faint unevenness and the odd pinhole where it skipped
          c += dark * uRough * (0.007 * (vn(px / 14.0) - 0.5) + 0.5 * step(0.99945, hash(floor(px / 2.2)))); }
        if (uPaperK > 0.0) {                                                                       // paper: its colour, fibres and a little unevenness, fixed to the picture
          float fib = hash(floor(uv * vec2(1280.0, 720.0))) * 0.6 + hash(floor(uv * vec2(320.0, 180.0)) + 7.0) * 0.4;
          c *= mix(vec3(1.0), uPaperC * (0.955 + 0.045 * fib), uPaperK);
        }
        c = mix(c, uFlash, uFlashK);
        vec2 q = vUv - 0.5; c *= 1.0 - uVig * dot(q, q) * 1.6;
        c = c * uTint + uLift;                                                                     // the stock's colour cast and its lifted blacks
        vec3 o = toSRGB(c);
        o += (hash(vUv * vec2(1920.0, 1080.0) + uFrame * 17.31) - 0.5) * uGrain;
        gl_FragColor = vec4(o, 1.0);
      }`,
  });

  const clear = new THREE.Color(), nothing = new THREE.Scene();
  let drawn = false;
  return {
    rt, size: new THREE.Vector2(RW, RH), ss, fin,
    // The target's viewport and scissor are read when it is set, so they are changed first: otherwise the clear is cut to the part the frame before drew last.
    begin(bg = 0x000000) { rt.scissorTest = false; rt.viewport.set(0, 0, RW, RH); renderer.setRenderTarget(rt); renderer.setClearColor(clear.set(bg), 1); renderer.clear(); drawn = false; },
    // draw a scene into a part of the frame: rect = [x, y, w, h] as fractions (y up), whole frame by default
    draw(scene, camera, rect = [0, 0, 1, 1], wipe = null) {     // wipe: a colour to clear that part with first (colour and depth), or 'depth' to draw over what is there
      const x = Math.round(rect[0] * RW), y = Math.round(rect[1] * RH), w = Math.round(rect[2] * RW), h = Math.round(rect[3] * RH);
      rt.viewport.set(x, y, w, h); rt.scissor.set(x, y, w, h); rt.scissorTest = true;
      renderer.setRenderTarget(rt); if (wipe === 'depth') renderer.clearDepth(); else if (wipe !== null) { renderer.setClearColor(clear.set(wipe), 1); renderer.clear(); }
      renderer.render(scene, camera); drawn = true;
    },
    // p: { exposure, glow, shake: [x, y] (fractions of the frame), zoom, zoomC, flash: [colour, amount], tone: [amount, light, dark, threshold], grain, frame, vig, sat, ca,
    //      cam2: [zoom, x, y] (a flat camera over the picture), paper: [amount, colour], invert, knee (where the glow starts), soft, tint: [r, g, b], lift }
    finish(p = {}) {
      const u = fin.uniforms;
      // The multisampled target is copied to its texture only at the end of a render: a frame that drew nothing would show the picture before it.
      if (!drawn) { renderer.setRenderTarget(rt); renderer.render(nothing, cam); }
      bright.uniforms.t.value = rt.texture; bright.uniforms.uKnee.value = p.knee ?? 0.92; pass(bright, lv[0].a);
      lv.forEach((L, i) => {
        if (i) { copy.uniforms.t.value = lv[i - 1].a.texture; pass(copy, L.a); }
        for (let k = 0; k < 2; k++) {
          blur.uniforms.t.value = L.a.texture; blur.uniforms.uDir.value.set(1 / L.a.width, 0); pass(blur, L.b);
          blur.uniforms.t.value = L.b.texture; blur.uniforms.uDir.value.set(0, 1 / L.a.height); pass(blur, L.a);
        }
      });
      u.uExposure.value = p.exposure ?? 1; u.uGlow.value = p.glow ?? 0.8; u.uShake.value.fromArray(p.shake || [0, 0]); u.uZoom.value = p.zoom ?? 0; u.uZoomC.value.fromArray(p.zoomC || [0.5, 0.5]);
      u.uFlashK.value = p.flash ? p.flash[1] : 0; if (p.flash) u.uFlash.value.set(p.flash[0]);
      u.uTone.value = p.tone ? p.tone[0] : 0; if (p.tone) { u.uToneA.value.set(p.tone[1]); u.uToneB.value.set(p.tone[2]); u.uToneT.value = p.tone[3] ?? 0.3; }
      u.uGrain.value = p.grain ?? 0.035; u.uFrame.value = p.frame ?? 0; u.uVig.value = p.vig ?? 0.22; u.uSat.value = p.sat ?? 1; u.uCA.value = p.ca ?? 0;
      u.uRough.value = p.rough ?? 0; u.uSoft.value = p.soft ?? 0; u.uTint.value.fromArray(p.tint || [1, 1, 1]); u.uLift.value = p.lift ?? 0;
      u.uCam2.value.fromArray(p.cam2 || [1, 0, 0]); u.uPaperK.value = p.paper ? p.paper[0] : 0; if (p.paper) u.uPaperC.value.set(p.paper[1]); u.uInvert.value = p.invert ?? 0;
      pass(fin, null);
    },
  };
}
