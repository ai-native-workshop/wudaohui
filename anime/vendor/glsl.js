// glsl.js: the shader pieces wukong's effects share (noise, and the print look they can switch to). Copied from
// music_video/wukong/src/world.js, unchanged, so the effects in fx.js work here without the rest of that world.
import * as THREE from 'three';

export const NOISE = /* glsl */`
  float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }
`;

// Looks shared by every material. uManga: 0 = cel colour, 1 = ink and dot tone on paper, 2 = printed colour (flat inks, dots).
// uPaint = 1 makes the backgrounds (sky, plain, rock) soft and brushy like a painted plate, for the cel-animation look.
export const PRINT = { uManga: { value: 0 }, uPaint: { value: 0 }, uDot: { value: 13 }, uPaper: { value: new THREE.Color('#f4f0e4') }, uInkC: { value: new THREE.Color('#131118') }, uSpot: { value: new THREE.Color('#ffc21a') } };
export const PRINTGLSL = /* glsl */`
  uniform float uManga, uDot, uPaint; uniform vec3 uPaper, uInkC, uSpot;
  // dot tone: how much of the paper is inked at this pixel, for a tone 0..1 (0 = white, 1 = black)
  float halftone(vec2 fc, float tone) {
    if (tone <= 0.004) return 0.0; if (tone >= 0.985) return 1.0;
    vec2 p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * fc / uDot; float aa = 0.8 / uDot;
    if (tone <= 0.5) { vec2 c = floor(p); float r = 0.5642 * sqrt(tone) * (0.93 + 0.14 * fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453)); return 1.0 - smoothstep(r - aa, r + aa, length(fract(p) - 0.5)); }   // each dot a touch different, as ink on paper is
    float r = 0.5642 * sqrt(1.0 - tone); return smoothstep(r - aa, r + aa, length(fract(p + 0.5) - 0.5));     // dark tones: white dots left in black
  }
  // pen hatching: slanted strokes whose weight follows the tone, a little unsteady
  float hatch(vec2 fc, float tone) {
    if (tone <= 0.004) return 0.0;
    float u = (fc.x + fc.y) * 0.7071 / (uDot * 0.92) + 0.22 * sin((fc.x - fc.y) * 0.011) + 0.08 * sin(fc.x * 0.05 + fc.y * 0.021);
    float f = abs(fract(u) - 0.5) * 2.0, w = clamp(tone * 1.05, 0.0, 0.95), aa = 1.6 / uDot;
    return 1.0 - smoothstep(w - aa, w + aa, f);
  }
`;
