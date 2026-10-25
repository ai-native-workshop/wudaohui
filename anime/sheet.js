// sheet.js: the model sheet. Every contestant in the poses that matter, as the replay will draw them (silhouette, ki rim, glow).
import { CAST } from './fighters.js';
import { drawStick } from './stick.js';
import { RULES } from '../src/rules.js';

const c = document.getElementById('c'), ctx = c.getContext('2d');
const g = ctx.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, '#0a1630'); g.addColorStop(1, '#1d3b5a'); ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
const who = ['claude', 'gpt', 'gemini', 'kimi', 'deepseek', 'doubao'];
const F = (state, t, phase) => [0, state, t, 1, 1500, 50, phase, 0];
const poses = [['idle', F('idle', 0, null)], ['轻拳', F('light', 6, 'active')], ['重击', F('heavy', 10, 'active')], ['格挡', F('guard', 0, null)], ['蓄气', F('charge', 0, null)],
  ['起手', F('beam', 20, 'startup')], ['发射', F('beam', 40, 'firing')], ['挨打', F('hitstun', 2, null)], ['倒地', F('down', 20, null)]];
const cw = c.width / poses.length, rh = c.height / who.length;
ctx.font = 'bold 22px system-ui'; ctx.fillStyle = '#ffffff99';
who.forEach((w, r) => {
  poses.forEach(([label, f], k) => {
    ctx.save(); ctx.translate(k * cw + cw / 2, r * rh + rh - 18); ctx.scale(0.95, 0.95); drawStick(ctx, w, f, RULES, { tick: 6 }); ctx.restore();
    if (r === 0) ctx.fillText(label, k * cw + 20, 30);
  });
  ctx.fillStyle = CAST[w].palette[1]; ctx.fillText(CAST[w].name, 12, r * rh + 60); ctx.fillStyle = '#ffffff99';
});
window.READY = true;
