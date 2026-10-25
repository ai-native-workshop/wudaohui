// look2d.js: the silhouette look on a 2D canvas: a black figure, a hot rim of its ki colour just outside its edge, and a soft glow.
// rimmed(draw, palette, size) -> a canvas with the finished figure; draw(ctx) paints the black silhouette (see fighters.js).
export function rimmed(draw, palette, size = 1024, { rim = 3, glow = 18 } = {}) {
  const mk = () => Object.assign(document.createElement('canvas'), { width: size, height: size });
  const sil = mk(), sctx = sil.getContext('2d');
  draw(sctx);
  const ring = mk(), r = ring.getContext('2d');
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; r.drawImage(sil, Math.cos(a) * rim, Math.sin(a) * rim); }
  r.globalCompositeOperation = 'destination-out'; r.drawImage(sil, 0, 0);
  r.globalCompositeOperation = 'source-in'; r.fillStyle = palette[0]; r.fillRect(0, 0, size, size);
  const out = mk(), o = out.getContext('2d');
  o.filter = `blur(${glow}px)`; o.globalCompositeOperation = 'lighter';
  const halo = mk(), h = halo.getContext('2d'); h.drawImage(sil, 0, 0); h.globalCompositeOperation = 'source-in'; h.fillStyle = palette[1]; h.fillRect(0, 0, size, size);
  o.drawImage(halo, 0, 0); o.drawImage(halo, 0, 0);
  o.filter = `blur(${rim * 1.5}px)`; o.drawImage(ring, 0, 0);
  o.filter = 'none'; o.globalCompositeOperation = 'source-over';
  o.drawImage(ring, 0, 0); o.drawImage(sil, 0, 0);
  return out;
}
