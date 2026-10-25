// audio.js: the fight's sound. Recorded hits from Kenney's CC0 Impact and Sci-Fi packs (assets/sfx/) for everything that lands;
// synthesized layers for what has no fixed length: the swing of a punch, a dash, a beam's charge, the aura, the beam, the clash.
// It is driven by the match's events and frames only, so a live match, a replay and (later) a rendered video sound the same.
//
//   const snd = new FightSound(); await snd.load('/assets/sfx/');   then snd.unlock() from a click or key (browsers start muted)
//   snd.reset(seed)            a new match: stop what lasts, reseed the small variations so a replay sounds the same every time
//   snd.events(list, frame)    one-shots for what just happened;   snd.frame(frame, R, i)   the layers that last (aura, beam, clash) at frame i
//   snd.hush()                 stop what lasts (a seek, the end)
//   offline (a video's soundtrack): snd.load(base, new OfflineAudioContext(...)), then for each output frame set snd.when = its time
//   in seconds and call events()/frame() as above; everything is scheduled at snd.when instead of "now".
import { mulberry32 } from '../src/rng.js';

const FILES = { punch_light: 5, punch_heavy: 5, block: 5, crush: 3, fall: 3, step: 5, gong: 2, blast: 5, beam_fire: 3, boom: 5, bigboom: 2, shield: 3 };
const LOOPS = ['loop_beam', 'loop_charge', 'loop_clash'];

// how long the picture holds on an impact, in frames (the hit stop that makes a blow feel heavy)
export function hitstopOf(evs) {
  let n = 0;
  for (const e of evs) {
    if (e.type === 'hit') n = Math.max(n, { light: 4, heavy: 8, blast: 4, beam: 10 }[e.kind] + (e.counter ? 3 : 0));
    else if (e.type === 'crush') n = Math.max(n, 10);
    else if (e.type === 'block' && e.kind === 'light') n = Math.max(n, 2);
    else if (e.type === 'clash_win' || e.type === 'clash_draw') n = Math.max(n, 14);
    else if (e.type === 'ko') n = Math.max(n, 30);
  }
  return n;
}

const panOf = x => Math.max(-1, Math.min(1, (x - 500) / 460)) * 0.7;

export class FightSound {
  constructor() { this.ac = null; this.buf = {}; this.ready = false; this.on = true; this.layers = new Map(); this.rand = Math.random; this.lastStep = [0, 0]; this.idx = -1; this.count = {}; }

  async load(base, offline) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC && !offline) return;
    const ac = this.ac = offline || new AC();
    this.offline = !!offline; this.when = null;
    this.comp = ac.createDynamicsCompressor();                              // glue, and no clipping when everything hits at once
    this.comp.threshold.value = -16; this.comp.ratio.value = 4; this.comp.attack.value = 0.002; this.comp.release.value = 0.18;
    this.master = ac.createGain(); this.master.gain.value = 0.8;
    this.comp.connect(this.master).connect(ac.destination);
    const n = ac.sampleRate * 2, nb = ac.createBuffer(1, n, ac.sampleRate), d = nb.getChannelData(0), r = mulberry32(9);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    this.noise = nb;
    const get = async f => ac.decodeAudioData(await (await fetch(base + f)).arrayBuffer());
    const jobs = [];
    for (const [k, c] of Object.entries(FILES)) for (let i = 0; i < c; i++) jobs.push(get(`${k}_${i}.mp3`).then(b => { (this.buf[k] ||= [])[i] = b; }));
    for (const k of LOOPS) jobs.push(get(`${k}.wav`).then(b => { this.buf[k] = b; }));
    await Promise.all(jobs);
    this.ready = true;
  }
  unlock() { if (this.ac && this.ac.state !== 'running') this.ac.resume(); }
  volume(v) { if (this.master) this.master.gain.value = v; }
  enable(on) { this.on = on; if (!on) this.hush(); }
  reset(seed) { this.hush(); this.rand = mulberry32((seed >>> 0) ^ 0x5eed); this.lastStep = [-99, -99]; this.idx = -1; }
  ok() { return this.ready && this.on && (this.offline || this.ac.state === 'running'); }
  now() { return this.when ?? this.ac.currentTime; }

  // ---- one-shots
  tally(k) { this.count[k] = (this.count[k] || 0) + 1; }
  play(name, { gain = 1, rate = 1, pan = 0, delay = 0 } = {}) {
    if (!this.ok()) return;
    this.tally(name);
    const list = this.buf[name], b = Array.isArray(list) ? list[Math.floor(this.rand() * list.length)] : list;
    if (!b) return;
    const ac = this.ac, s = ac.createBufferSource(), g = ac.createGain(), p = ac.createStereoPanner();
    s.buffer = b; s.playbackRate.value = rate * (0.97 + this.rand() * 0.06); g.gain.value = gain; p.pan.value = pan;
    s.connect(g).connect(p).connect(this.comp); s.start(this.now() + delay);
  }
  // air moving: band-passed noise sweeping from f0 to f1
  swish({ dur = 0.09, f0 = 1800, f1 = 4200, q = 1.2, gain = 0.3, pan = 0, delay = 0 } = {}) {
    if (!this.ok()) return;
    this.tally('swish');
    const ac = this.ac, t = this.now() + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), p = ac.createStereoPanner();
    s.buffer = this.noise; f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.015, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    p.pan.value = pan; s.connect(f).connect(g).connect(p).connect(this.comp);
    s.start(t, this.rand() * 1.5); s.stop(t + dur + 0.02);
  }
  // a body blow's low end: a sine dropping in pitch
  thump({ f0 = 120, f1 = 42, dur = 0.18, gain = 0.6, pan = 0, delay = 0 } = {}) {
    if (!this.ok()) return;
    const ac = this.ac, t = this.now() + delay, o = ac.createOscillator(), g = ac.createGain(), p = ac.createStereoPanner();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    p.pan.value = pan; o.connect(g).connect(p).connect(this.comp); o.start(t); o.stop(t + dur + 0.02);
  }
  // a teleport: a sharp upward chirp over a hiss
  zip({ pan = 0 } = {}) {
    if (!this.ok()) return;
    this.swish({ dur: 0.11, f0: 1500, f1: 9000, q: 0.7, gain: 0.32, pan });
    const ac = this.ac, t = this.now(), o = ac.createOscillator(), g = ac.createGain(), p = ac.createStereoPanner();
    o.type = 'triangle'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(3200, t + 0.07);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    p.pan.value = pan; o.connect(g).connect(p).connect(this.comp); o.start(t); o.stop(t + 0.1);
  }

  // ---- what lasts: one node chain per key, faded in and out
  layer(key, make, set) {
    if (!this.ok()) return;
    let L = this.layers.get(key);
    if (!L) { L = make(); L.g.gain.setValueAtTime(0.0001, this.now()); this.layers.set(key, L); this.tally('layer:' + key.replace(/\d$/, '')); }
    set(L, this.now());
  }
  drop(key, fade = 0.12) {
    const L = this.layers.get(key); if (!L) return;
    this.layers.delete(key);
    const t = this.now();
    L.g.gain.cancelScheduledValues(t); L.g.gain.setTargetAtTime(0.0001, t, fade / 3);
    for (const s of L.srcs) { try { s.stop(t + fade + 0.05); } catch { /* already stopped */ } }
  }
  hush() { for (const k of [...this.layers.keys()]) this.drop(k, 0.05); }
  loop(name, { lp = 2000, rate = 1 } = {}) {
    const ac = this.ac, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), p = ac.createStereoPanner();
    s.buffer = this.buf[name]; s.loop = true; s.playbackRate.value = rate; f.type = 'lowpass'; f.frequency.value = lp;
    s.connect(f).connect(g).connect(p).connect(this.comp); s.start(this.now(), this.rand() * 3);
    return { srcs: [s], s, f, g, p };
  }
  // the beam's charge: a saw climbing an octave and a half over the startup, trembling, with hiss rising under it
  kame(secs) {
    const ac = this.ac, t = this.now(), o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), f = ac.createBiquadFilter(), g = ac.createGain(), p = ac.createStereoPanner();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(330, t + secs);
    f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(3200, t + secs); f.Q.value = 6;
    lfo.frequency.value = 11; lg.gain.value = 0.35; lfo.connect(lg).connect(g.gain);
    const n = ac.createBufferSource(), nf = ac.createBiquadFilter(), ng = ac.createGain();
    n.buffer = this.noise; n.loop = true; nf.type = 'bandpass'; nf.frequency.setValueAtTime(800, t); nf.frequency.exponentialRampToValueAtTime(5000, t + secs);
    ng.gain.setValueAtTime(0.02, t); ng.gain.exponentialRampToValueAtTime(0.25, t + secs);
    o.connect(f).connect(g); n.connect(nf).connect(ng).connect(g); g.connect(p).connect(this.comp);
    o.start(t); lfo.start(t); n.start(t);
    return { srcs: [o, lfo, n], g, p };
  }

  // ---- the match drives it
  events(list, fr) {
    if (!this.ok() || !fr) return;
    const at = s => (s >= 0 ? panOf(fr.f[s][0]) : 0);
    for (const e of list) {
      const me = at(e.side), op = e.side >= 0 ? at(1 - e.side) : 0;
      switch (e.type) {
        case 'light': this.swish({ dur: 0.07, f0: 2400, f1: 5200, gain: 0.16, pan: me }); break;
        case 'heavy': this.swish({ dur: 0.22, f0: 420, f1: 1500, q: 0.8, gain: 0.3, pan: me }); break;
        case 'blast': this.swish({ dur: 0.16, f0: 600, f1: 2400, q: 3, gain: 0.12, pan: me }); break;
        case 'blast_out': this.play('blast', { gain: 0.5, rate: e.side ? 0.9 : 1.08, pan: me }); break;
        case 'beam_out': this.play('beam_fire', { gain: 0.75, rate: 0.7, pan: me }); this.thump({ f0: 90, f1: 40, dur: 0.35, gain: 0.5, pan: me }); break;
        case 'dash_forward': case 'dash_back': this.zip({ pan: me }); this.play('shield', { gain: 0.18, rate: 1.8, pan: me }); break;
        case 'hit':
          if (e.kind === 'light') this.play('punch_light', { gain: 0.7, rate: 1 + 0.05 * Math.min(4, e.combo - 1), pan: op });
          else if (e.kind === 'heavy') { this.play('punch_heavy', { gain: 1, rate: 0.88, pan: op }); this.thump({ gain: 0.75, pan: op }); this.play('fall', { gain: 0.55, delay: 0.42, pan: op }); }
          else if (e.kind === 'blast') { this.play('boom', { gain: 0.55, rate: 1.3, pan: op }); this.play('punch_light', { gain: 0.35, rate: 0.9, pan: op }); }
          else if (e.kind === 'beam') { this.play('bigboom', { gain: 0.9, pan: op }); this.play('boom', { gain: 0.6, rate: 0.85, pan: op }); this.play('fall', { gain: 0.5, delay: 0.55, pan: op }); }
          if (e.counter) this.play('punch_heavy', { gain: 0.45, rate: 1.7, pan: op });   // a sharp crack on a counter hit
          break;
        case 'block':                                                       // e.side is the one who blocked
          if (e.kind === 'light') { this.play('block', { gain: 0.45, pan: me }); this.play('shield', { gain: 0.12, rate: 1.4, pan: me }); }
          else if (e.kind === 'blast') { this.play('block', { gain: 0.4, rate: 0.85, pan: me }); this.play('boom', { gain: 0.22, rate: 1.6, pan: me }); }
          else { this.play('shield', { gain: 0.5, rate: 0.75, pan: me }); this.play('boom', { gain: 0.4, rate: 0.9, pan: me }); }
          break;
        case 'crush': this.play('crush', { gain: 0.8, pan: op }); this.play('punch_heavy', { gain: 0.65, rate: 0.8, pan: op }); this.thump({ gain: 0.6, pan: op }); break;
        case 'dodge': this.swish({ dur: 0.14, f0: 1200, f1: 300, q: 0.9, gain: 0.22, pan: me }); break;
        case 'blast_clash': this.play('boom', { gain: 0.45, rate: 1.55 }); break;
        case 'clash': this.play('bigboom', { gain: 0.55, rate: 1.25 }); this.play('beam_fire', { gain: 0.5, rate: 0.55 }); break;
        case 'clash_win': this.play('bigboom', { gain: 1, pan: op }); this.play('boom', { gain: 0.7, pan: op }); this.play('fall', { gain: 0.5, delay: 0.6, pan: op }); break;
        case 'clash_draw': this.play('bigboom', { gain: 1 }); this.play('bigboom', { gain: 0.8, delay: 0.14, rate: 0.85 }); break;
        case 'ko': this.play('bigboom', { gain: 0.5, rate: 0.7 }); this.play('gong', { gain: 0.55, delay: 0.3 }); break;
        case 'time': this.play('gong', { gain: 0.55 }); break;
      }
    }
  }

  frame(fr, R, idx) {
    if (!this.ok() || !fr || idx === this.idx) return;                    // a held or paused frame changes nothing
    if (idx < this.idx) this.lastStep = [-99, -99];
    this.idx = idx;
    fr.f.forEach((F, i) => {
      const [x, state, t, , , , ph] = F, pan = panOf(x);
      if (state === 'charge') this.layer(`charge${i}`, () => this.loop('loop_charge', { lp: 1400, rate: 1 + i * 0.12 }), (L, now) => { L.g.gain.setTargetAtTime(0.32, now, 0.05); L.p.pan.value = pan; });
      else this.drop(`charge${i}`);
      if (state === 'beam' && ph === 'startup') this.layer(`kame${i}`, () => this.kame((R.beam.startup - t) / R.fps), (L, now) => { L.g.gain.setTargetAtTime(0.22, now, 0.04); L.p.pan.value = pan; });
      else this.drop(`kame${i}`, 0.05);
      const b = fr.m[i];
      if (b) this.layer(`beam${i}`, () => this.loop('loop_beam', { lp: 2600, rate: 0.9 + i * 0.1 }), (L, now) => { L.g.gain.setTargetAtTime(fr.c ? 0.6 : 0.5, now, 0.04); L.p.pan.value = panOf((b[0] + b[1]) / 2); });
      else this.drop(`beam${i}`, 0.2);
      if ((state === 'forward' || state === 'back') && idx - this.lastStep[i] >= 15) { this.lastStep[i] = idx; this.play('step', { gain: 0.12, rate: 1.1, pan }); }
    });
    if (fr.c) {
      const [, ct, p0, p1] = fr.c, tension = Math.min(1, ct / 180), lean = Math.abs(p0 - p1) / (p0 + p1);
      this.layer('clash', () => this.loop('loop_clash', { lp: 900, rate: 0.8 }), (L, now) => {
        L.g.gain.setTargetAtTime(0.35 + 0.5 * tension, now, 0.08); L.s.playbackRate.setTargetAtTime(0.8 + 0.5 * tension + 0.6 * lean, now, 0.1); L.f.frequency.setTargetAtTime(900 + 2500 * tension, now, 0.1);
      });
      if (idx % 4 === 0) this.swish({ dur: 0.05, f0: 3000 + this.rand() * 4000, f1: 1200, q: 2, gain: 0.08 + 0.12 * tension, pan: (this.rand() - 0.5) * 0.6 });   // crackle
    } else this.drop('clash', 0.25);
  }
}

// a rendered soundtrack as a 16-bit PCM WAV, base64 (for a page to hand to Node)
export function toWav(buf) {
  const n = buf.length, ch = buf.numberOfChannels, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
  out.setUint16(22, ch, true); out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true);
  out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 2) out.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 32767, true);
  const bytes = new Uint8Array(out.buffer); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
