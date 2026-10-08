/* Ink Rush - sprites.js: Kenney splat/particle loading, per-colour tint cache, sound, particle pool.
   Everything here is CC0 (Kenney splat pack, particle pack, digital audio, sci-fi sounds). */
(function () {
  'use strict';
  const TM = window.TM, U = TM.U;
  const INK = (window.INK = window.INK || {});
  const BASE = '../assets/kenney/ink-rush/';
  const INKC = '#1F1A3D';
  INK.INKC = INKC;

  /* ---------------- images ---------------- */
  const imgs = {};
  const FX = ['circle_02', 'circle_05', 'star_06', 'star_07', 'star_09', 'magic_05', 'symbol_01', 'smoke_04', 'muzzle_02', 'dirt_01', 'twirl_01', 'light_01', 'flare_01'];
  // the splat shapes that read best (not the thin spiky ones) - indices into splat00..35
  INK.SPLATS = [0, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 21, 22, 24, 25, 26, 27, 29, 31];
  INK.SPLAT_ROUND = [3, 4, 5, 6, 10, 11, 12, 14, 15, 19, 22]; // chunky blobby ones for splats on bodies
  INK.loadImages = function () {
    const mk = (key, src) => { const im = new Image(); im.src = src; imgs[key] = im; };
    for (let i = 0; i < 36; i++) mk('splat' + String(i).padStart(2, '0'), `${BASE}splat/splat${String(i).padStart(2, '0')}.png`);
    for (const n of FX) mk(n, `${BASE}fx/${n}.png`);
  };
  INK.img = (k) => imgs[k];
  const ready = (im) => im && im.complete && im.naturalWidth > 0;

  /* ---------------- tint cache ---------------- */
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function whiteTinted(im, color, size) {
    const c = cv(size, size), x = c.getContext('2d');
    x.drawImage(im, 0, 0, size, size);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, size, size);
    return c;
  }
  const splatCache = new Map();
  /* A glossy sticker-style splat in the given colour: dark rim, coloured body with light/dark shading. */
  INK.splat = function (k, color) {
    const key = k + '|' + color;
    let c = splatCache.get(key);
    if (c) return c;
    const im = imgs['splat' + String(k).padStart(2, '0')];
    if (!ready(im)) return null; // not loaded yet; caller skips
    const S = 192, c2 = cv(S, S), x = c2.getContext('2d');
    // rim
    x.drawImage(whiteTinted(im, U.shade(color, -0.42), S), 0, 0);
    // body, slightly inset and shifted up-left
    const body = whiteTinted(im, color, S);
    const bx = body.getContext('2d');
    bx.globalCompositeOperation = 'source-atop';
    let gr = bx.createRadialGradient(S * 0.36, S * 0.32, 4, S * 0.4, S * 0.4, S * 0.6);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(31,26,61,0.22)');
    bx.fillStyle = gr; bx.fillRect(0, 0, S, S);
    x.save(); x.translate(S * 0.5, S * 0.5); x.scale(0.9, 0.9); x.translate(-S * 0.5 - 2, -S * 0.5 - 3); x.drawImage(body, 0, 0); x.restore();
    splatCache.set(key, c2);
    return c2;
  };
  /* Flat tinted splat (no rim) - used for subtle stains/trails */
  const flatCache = new Map();
  INK.splatFlat = function (k, color) {
    const key = k + '|' + color; let c = flatCache.get(key);
    if (c) return c;
    const im = imgs['splat' + String(k).padStart(2, '0')]; if (!ready(im)) return null;
    c = whiteTinted(im, color, 128); flatCache.set(key, c); return c;
  };
  const fxCache = new Map();
  INK.fx = function (name, color) {
    const key = name + '|' + (color || ''); let c = fxCache.get(key);
    if (c) return c;
    const im = imgs[name]; if (!ready(im)) return null;
    if (!color) { fxCache.set(key, im); return im; }
    c = whiteTinted(im, color, 128); fxCache.set(key, c); return c;
  };

  /* ---------------- sound (Kenney ogg, lazily played; synth sfx stay in TM.sfx) ---------------- */
  const SND = {
    shot: ['laserSmall_000', 'laserSmall_003'],
    pep: ['pepSound1', 'pepSound2', 'pepSound3', 'pepSound4', 'pepSound5'],
    slime: ['slime_000'],
    combo: ['phaserUp3', 'phaserUp5', 'powerUp2'],
    ultra: ['powerUp11'], boom: ['explosionCrunch_000'], rumble: ['lowFrequency_explosion_000'], zapUp: ['zapThreeToneUp'],
    hit: ['lowThreeTone', 'lowDown'], shield: ['forceField_000'], jump: ['phaseJump1', 'phaseJump3'],
    clear: ['threeTone1', 'powerUp8'], up: ['highUp'],
  };
  const sbase = {};
  INK.preloadSfx = function () {
    for (const k in SND) for (const f of SND[k]) {
      if (sbase[f]) continue;
      const a = new Audio(`${BASE}sfx/${f}.ogg`); a.preload = 'auto'; sbase[f] = a;
    }
  };
  const lastPlay = {};
  INK.snd = function (name, vol = 1, rate = 1) {
    if (TM.settings.sfx <= 0) return;
    const list = SND[name]; if (!list) return;
    const now = performance.now();
    if (now - (lastPlay[name] || 0) < 45) return;
    lastPlay[name] = now;
    const f = U.pick(list); const b = sbase[f]; if (!b) return;
    try {
      const a = b.cloneNode(); a.volume = U.clamp(TM.settings.sfx * vol * 0.8, 0, 1); a.playbackRate = rate; a.play().catch(() => { });
    } catch (e) { /* ignore */ }
  };

  /* ---------------- particle pool (screen space) ---------------- */
  class Parts {
    constructor(n = 700) { this.p = []; for (let i = 0; i < n; i++) this.p.push({ on: false }); this.i = 0; this.live = 0; }
    get() { for (let k = 0; k < this.p.length; k++) { const q = this.p[(this.i++) % this.p.length]; if (!q.on) return q; } return this.p[(this.i++) % this.p.length]; }
    /* type: 'drop' (ink droplet, stretches with speed), 'spr' (kenney fx sprite), 'splat' (small tinted splat that fades) */
    add(o) {
      const q = this.get();
      q.on = true; q.type = o.type || 'drop'; q.x = o.x; q.y = o.y; q.vx = o.vx || 0; q.vy = o.vy || 0; q.g = o.g ?? 1400; q.drag = o.drag ?? 0.99;
      q.life = o.life || 0.6; q.t = 0; q.size = o.size || 12; q.grow = o.grow || 0; q.color = o.color || '#fff'; q.name = o.name; q.rot = o.rot || 0; q.vr = o.vr || 0;
      q.add = !!o.add; q.k = o.k || 0; q.a = o.a ?? 1; q.fade = o.fade ?? 0.5; q.rim = o.rim !== false;
      return q;
    }
    /* ink burst: droplets + a few flying globs */
    burst(x, y, color, o = {}) {
      const n = o.count ?? 18, sp = o.speed || [250, 800], col2 = o.color2 || color;
      for (let i = 0; i < n; i++) {
        const a = o.angle != null ? o.angle + U.rand(-(o.spread ?? 1), o.spread ?? 1) : U.rand(0, 6.283);
        const s = U.rand(sp[0], sp[1]);
        this.add({ type: 'drop', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), g: o.g ?? 1500, life: U.rand(0.35, 0.8), size: U.rand(o.size?.[0] ?? 7, o.size?.[1] ?? 18), color: i % 2 ? color : col2 });
      }
    }
    sprite(name, x, y, size, o = {}) { return this.add(Object.assign({ type: 'spr', name, x, y, size, g: 0, drag: 1, life: 0.5, add: true }, o)); }
    update(dt) {
      for (const q of this.p) {
        if (!q.on) continue;
        q.t += dt; if (q.t >= q.life) { q.on = false; continue; }
        q.vy += q.g * dt; q.vx *= q.drag; q.vy *= q.drag; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
      }
    }
    draw(ctx) {
      for (const q of this.p) {
        if (!q.on) continue;
        const k = q.t / q.life;
        if (q.type === 'drop') {
          const sz = q.size * (1 - k * 0.55);
          const sp = Math.hypot(q.vx, q.vy), st = Math.min(2.2, 1 + sp / 900);
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(Math.atan2(q.vy, q.vx));
          ctx.fillStyle = q.color; ctx.globalAlpha = Math.min(1, (1 - k) * 2.2);
          ctx.beginPath(); ctx.ellipse(0, 0, sz * st, sz * 0.78, 0, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(-sz * 0.1, -sz * 0.28, sz * st * 0.45, sz * 0.2, 0, 0, 7); ctx.fill();
          ctx.restore();
        } else if (q.type === 'spr') {
          const im = INK.fx(q.name, q.color === '#fff' ? null : q.color); if (!im) continue;
          const sz = (q.size + q.grow * k) * 1;
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
          ctx.globalAlpha = q.a * (k < q.fade ? 1 : 1 - (k - q.fade) / (1 - q.fade));
          if (q.add) ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(im, -sz / 2, -sz / 2, sz, sz); ctx.restore();
        } else if (q.type === 'splat') {
          const im = q.rim ? INK.splat(q.k, q.color) : INK.splatFlat(q.k, q.color); if (!im) continue;
          const sz = q.size * U.ease.outBack(Math.min(1, k * 5));
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = q.a * (k < q.fade ? 1 : 1 - (k - q.fade) / (1 - q.fade));
          ctx.drawImage(im, -sz / 2, -sz / 2, sz, sz); ctx.restore();
        }
      }
    }
    clear() { for (const q of this.p) q.on = false; }
  }
  INK.Parts = Parts;
})();
