/* Star Sweep - sprite atlas loader + drawing helpers (Kenney CC0 art). */
(function () {
  'use strict';
  const SS = (window.SS = window.SS || {});
  const M = window.SS_MANIFEST || { main: { rects: {} }, fx: { rects: {} }, audio: {} };
  const BASE = '../assets/kenney/star-sweep/';
  const atlas = { main: null, fx: null };
  const R = {};
  for (const k in M.main.rects) R[k] = { a: 'main', x: M.main.rects[k][0], y: M.main.rects[k][1], w: M.main.rects[k][2], h: M.main.rects[k][3] };
  for (const k in M.fx.rects) R[k] = { a: 'fx', x: M.fx.rects[k][0], y: M.fx.rects[k][1], w: M.fx.rects[k][2], h: M.fx.rects[k][3] };
  SS.R = R;
  SS.ready = false; SS.progress = 0;
  SS.planets = []; SS.sky = {};
  SS.SKY_KEYS = ['band', 'galaxy', 'nebula', 'dark', 'day', 'deep'];

  function loadImg(src, cb) { const i = new Image(); i.onload = () => cb(i); i.onerror = () => cb(null); i.src = src; }
  SS.load = function (done) {
    const total = 2 + 10 + SS.SKY_KEYS.length; let n = 0;
    const tick = () => { n++; SS.progress = n / total; if (n === total) { SS.ready = true; done && done(); } };
    loadImg(BASE + 'ss-main.png', (i) => { atlas.main = i; tick(); });
    loadImg(BASE + 'ss-fx.webp', (i) => { atlas.fx = i; tick(); });
    for (let p = 0; p < 10; p++) loadImg(BASE + `planet${p}.webp`, (i) => { SS.planets[p] = i; tick(); });
    for (const k of SS.SKY_KEYS) loadImg(BASE + `sky_${k}.jpg`, (i) => { SS.sky[k] = i; tick(); });
  };

  const tintCache = new Map();
  /* Tinted silhouette (source-in) of a sprite. color '#fff' gives a white hit-flash silhouette. */
  SS.tintCanvas = function (name, color) {
    let m = tintCache.get(name); if (!m) { m = new Map(); tintCache.set(name, m); }
    let c = m.get(color);
    if (c) return c;
    const r = R[name]; const im = r && atlas[r.a];
    if (!im) return null;
    c = document.createElement('canvas'); c.width = r.w; c.height = r.h;
    const x = c.getContext('2d'); x.drawImage(im, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, r.w, r.h);
    m.set(color, c); return c;
  };

  /* spr(ctx, name, x, y, {s, sw, sh, rot, a, ax, ay, flipY, tint, add})  - centre anchored by default */
  SS.spr = function (ctx, name, x, y, o) {
    const r = R[name]; if (!r) return;
    o = o || {};
    let src = atlas[r.a], sx = r.x, sy = r.y;
    if (o.tint) { src = SS.tintCanvas(name, o.tint); sx = 0; sy = 0; }
    if (!src) return;
    let w = r.w, h = r.h;
    if (o.s != null) { w *= o.s; h *= o.s; }
    if (o.sw != null) { const k = o.sw / r.w; w = o.sw; h = o.sh != null ? o.sh : r.h * k; }
    else if (o.sh != null) { const k = o.sh / r.h; h = o.sh; w = r.w * k; }
    if (o.max != null) { const k = o.max / Math.max(r.w, r.h); w = r.w * k; h = r.h * k; }
    const ax = o.ax ?? 0.5, ay = o.ay ?? 0.5;
    const a = o.a ?? 1;
    if (a <= 0) return;
    const old = ctx.globalAlpha;
    ctx.globalAlpha = old * (a > 1 ? 1 : a);
    if (o.rot || o.flipY) {
      ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.flipY) ctx.scale(1, -1);
      ctx.drawImage(src, sx, sy, r.w, r.h, -w * ax, -h * ay, w, h);
      ctx.restore();
    } else ctx.drawImage(src, sx, sy, r.w, r.h, x - w * ax, y - h * ay, w, h);
    ctx.globalAlpha = old;
  };
  SS.size = (name) => { const r = R[name]; return r ? [r.w, r.h] : [0, 0]; };
})();
