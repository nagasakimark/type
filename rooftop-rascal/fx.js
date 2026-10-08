/* Rooftop Rascal - fx.js : world-space particles, Kenney sound effects, music. */
(function () {
  'use strict';
  const TM = window.TM, U = TM.U;
  const RR = window.RR;
  const TAU = Math.PI * 2;

  /* ---------------- particles (pooled) ---------------- */
  const MAX = 420;
  const pool = Array.from({ length: MAX }, () => ({ on: false }));
  let cursor = 0;
  RR.parts = {
    spawn(o) {
      for (let i = 0; i < MAX; i++) {
        const p = pool[(cursor + i) % MAX];
        if (!p.on) { cursor = (cursor + i + 1) % MAX; Object.assign(p, { on: true, t: 0, vx: 0, vy: 0, g: 0, size: 20, grow: 0, rot: 0, vr: 0, a: 1, life: 0.6, add: false, spr: 'puff2', col: null, drag: 1 }, o); return p; }
      }
      return null;
    },
    clear() { for (const p of pool) p.on = false; },
    update(dt) {
      for (const p of pool) {
        if (!p.on) continue;
        p.t += dt; if (p.t >= p.life) { p.on = false; continue; }
        p.vy += p.g * dt; const d = Math.pow(p.drag, dt * 60); p.vx *= d; p.vy *= d; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      }
    },
    draw(ctx) {
      for (const p of pool) {
        if (!p.on) continue;
        const k = p.t / p.life, a = p.a * (1 - k) * Math.min(1, k * 8 + 0.2), s = p.size * (1 + p.grow * k);
        if (a <= 0.01) continue;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = a;
        if (p.add) ctx.globalCompositeOperation = 'lighter';
        if (p.col) { const c = RR.tinted(p.spr, p.col, 'source-in'); if (c) ctx.drawImage(c, -s / 2, -s / 2, s, s * c.height / c.width); }
        else { const f = RR.A.f[p.spr]; if (f && RR.A.ready) ctx.drawImage(RR.A.img, f[0], f[1], f[2], f[3], -s / 2, -s / 2, s, s * f[3] / f[2]); }
        ctx.restore();
      }
    },
    dust(x, y, n, sc, col, dir) {
      for (let i = 0; i < n; i++) this.spawn({ x: x + U.rand(-10, 10), y: y - U.rand(0, 8), vx: (dir || 0) * U.rand(40, 140) + U.rand(-70, 70), vy: U.rand(-90, -20), size: U.rand(34, 62) * (sc || 1), grow: 1.1, life: U.rand(0.35, 0.65), a: 0.55, spr: 'puff' + [2, 8, 14, 20][(Math.random() * 4) | 0], col: col || '#EDE2D2', rot: U.rand(0, 6), vr: U.rand(-1, 1), drag: 0.97 });
    },
    sparks(x, y, n, col, sp) {
      for (let i = 0; i < n; i++) { const a = U.rand(0, TAU), v = U.rand(120, sp || 460); this.spawn({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, g: 700, size: U.rand(24, 44), life: U.rand(0.4, 0.8), spr: 'p_star_04', col: col || '#FFE066', add: true, rot: U.rand(0, 6), vr: U.rand(-6, 6), a: 1, drag: 0.98 }); }
    },
    puffSmoke(x, y, n, col) {
      for (let i = 0; i < n; i++) this.spawn({ x: x + U.rand(-50, 50), y: y + U.rand(-50, 40), vx: U.rand(-60, 60), vy: U.rand(-70, 10), size: U.rand(110, 190), grow: 0.8, life: U.rand(0.9, 1.5), a: 0.85, spr: 'puff' + [2, 8, 14, 20][(Math.random() * 4) | 0], col: col || '#8E7BD8', rot: U.rand(0, 6), vr: U.rand(-0.5, 0.5), drag: 0.96 });
    },
    trail(x, y, col, size) { this.spawn({ x, y, vx: U.rand(-20, 20), vy: U.rand(-20, 20), size: size || 40, life: 0.45, spr: 'p_circle_05', col: col || '#FFFFFF', add: true, a: 0.7 }); },
  };

  /* ---------------- Kenney sfx (WebAudio, lazy, silent on failure) ---------------- */
  const NAMES = ['jump1', 'jump2', 'gem', 'gem2', 'power', 'boost', 'zip', 'bounce', 'land', 'smoke', 'caught', 'ghost', 'sneak', 'fish', 'tada', 'wake', 'slide', 'wall'];
  const S = { ctx: null, bus: null, bufs: {}, tried: false };
  function init() {
    if (S.tried || TM.settings.sfx <= 0) return; S.tried = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      S.ctx = new AC(); S.bus = S.ctx.createGain(); S.bus.connect(S.ctx.destination);
      for (const n of NAMES) {
        fetch('../assets/kenney/rooftop-rascal/audio/' + n + '.ogg').then((r) => r.arrayBuffer()).then((b) => S.ctx.decodeAudioData(b)).then((buf) => { S.bufs[n] = buf; }).catch(() => { });
      }
    } catch (e) { S.ctx = null; }
  }
  window.addEventListener('keydown', init, { capture: true, once: false });
  window.addEventListener('pointerdown', init, { capture: true });
  RR.sfx = function (name, vol, rate) {
    if (!S.ctx || TM.settings.sfx <= 0) return;
    const b = S.bufs[name]; if (!b) return;
    if (S.ctx.state === 'suspended') S.ctx.resume();
    const src = S.ctx.createBufferSource(); src.buffer = b; if (rate) src.playbackRate.value = rate;
    const g = S.ctx.createGain(); g.gain.value = TM.settings.sfx * (vol == null ? 0.7 : vol);
    src.connect(g); g.connect(S.bus); src.start();
  };

  /* ---------------- music: one little tune per district ---------------- */
  const song = TM.audio.song;
  RR.SONGS = [
    song({ bpm: 108, roots: [33, 29, 36, 31], chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], bassPattern: [0, null, null, 7, null, null, 12, null, 0, null, 10, null, 7, null, null, null],
      lead: [76, null, null, 74, null, 72, null, null, 69, null, 72, null, 74, null, null, null, 76, null, 79, null, 76, null, 74, 72, null, null, 69, null, 72, null, null, null], wave: 'triangle', pad: 'sine' }),
    song({ bpm: 124, roots: [38, 34, 31, 36], chords: [[62, 65, 69], [58, 62, 65], [55, 58, 62], [60, 64, 67]], bassPattern: [0, null, 0, 12, null, 0, null, 7, 0, null, 0, 12, null, 10, null, 7],
      lead: [74, null, 77, null, 81, null, 77, null, 74, null, 77, null, 79, null, 76, null, 74, null, 77, null, 82, null, 79, null, 77, null, 74, null, 72, null, 74, null], wave: 'square', pad: 'sawtooth' }),
    song({ bpm: 96, roots: [31, 38, 36, 33], chords: [[55, 59, 62], [62, 66, 69], [60, 64, 67], [57, 60, 64]], bassPattern: [0, null, null, null, 7, null, null, null, 12, null, null, null, 7, null, null, null],
      lead: [71, null, null, null, 74, null, null, 76, null, null, 74, null, null, null, 71, null, 72, null, null, null, 76, null, null, 79, null, null, 76, null, null, null, 74, null], wave: 'sine', pad: 'triangle' }),
    song({ bpm: 132, roots: [28, 31, 33, 29], chords: [[52, 55, 59], [55, 59, 62], [57, 60, 64], [53, 57, 60]], bassPattern: [0, 0, null, 12, 0, null, 12, null, 0, 0, null, 12, 7, null, 10, null],
      lead: [64, 67, 71, 67, 64, 67, 71, 76, 62, 67, 71, 67, 62, 67, 71, 74, 64, 69, 72, 69, 64, 69, 72, 76, 65, 69, 72, 69, 65, 69, 72, 77], wave: 'sawtooth', pad: 'sine' }),
    song({ bpm: 110, roots: [38, 38, 43, 43], chords: [[62, 66, 69], [62, 67, 69], [67, 71, 74], [67, 69, 74]], bassPattern: [0, null, null, 7, null, null, 12, null, 0, null, 7, null, 12, null, null, null],
      lead: [74, null, 76, null, 81, null, 83, null, 81, null, 76, null, 74, null, null, null, 74, null, 76, null, 79, null, 81, null, 86, null, 83, null, 81, null, 79, null], wave: 'triangle', pad: 'sine' }),
  ];
})();
