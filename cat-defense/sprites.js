/* Cat Defenders - sprite sheets (CraftPix "Cartoon Cat Defense" kit, packed by tools/build_catdef.py) + drawing helpers. */
(function () {
  'use strict';
  const CD = (window.CD = window.CD || {});
  const M = window.CD_MANIFEST;
  const BASE = '../assets/catdef/';
  const img = {};
  CD.ready = false; CD.progress = 0; CD.bg = [];
  const flashCache = new Map();

  function loadImg(src, cb) { const i = new Image(); i.onload = () => cb(i); i.onerror = () => cb(null); i.src = src; }
  CD.load = function (done) {
    const names = ['cats', 'zombies', 'bosses', 'helpers', 'fx', 'ui'];
    let n = 0; const total = names.length + M.bgs.length;
    const tick = () => { n++; CD.progress = n / total; if (n === total) { CD.ready = true; done && done(); } };
    for (const k of names) loadImg(BASE + k + '.webp', (i) => { img[k] = i; tick(); });
    M.bgs.forEach((f, i) => loadImg(BASE + f, (im) => { CD.bg[i] = im; tick(); }));
  };

  /* frame rectangle on a sheet. grid sheets: row strips of `cols` columns. */
  function cell(set, sheet, row, f) {
    const m = M[set]; const cw = m.cell[0], ch = m.cell[1];
    const base = m.rows[row];
    return { im: img[sheet], sx: (f % m.cols) * cw, sy: (base + Math.floor(f / m.cols)) * ch, w: cw, h: ch };
  }
  function drawCell(ctx, c, x, y, o) {
    if (!c.im) return;
    o = o || {};
    const s = o.s || 1, w = c.w * s, h = c.h * s;
    const old = ctx.globalAlpha;
    if (o.a != null) ctx.globalAlpha = old * o.a;
    ctx.save(); ctx.translate(x, y);
    if (o.flip) ctx.scale(-1, 1);
    if (o.rot) ctx.rotate(o.rot);
    ctx.drawImage(c.im, c.sx, c.sy, c.w, c.h, -w / 2, -h + (o.foot || 8) * s, w, h);
    ctx.restore();
    ctx.globalAlpha = old;
  }
  function flashed(c, key) {
    let f = flashCache.get(key);
    if (f) return f;
    f = document.createElement('canvas'); f.width = c.w; f.height = c.h;
    const x = f.getContext('2d'); x.drawImage(c.im, c.sx, c.sy, c.w, c.h, 0, 0, c.w, c.h);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.w, c.h);
    flashCache.set(key, f); return f;
  }

  /* cats: level 1..15, frame f: 0..7 idle, 8..11 shoot. anchored bottom-centre on the feet. */
  CD.cat = function (ctx, lvl, f, x, y, o) {
    const l = Math.max(1, Math.min(M.cats.levels, lvl)) - 1;
    drawCell(ctx, cell('cats', 'cats', l, f), x, y, o);
  };
  CD.catIdle = (t) => Math.floor(t * 8) % M.cats.idle;
  CD.catShoot = (k) => M.cats.idle + Math.min(M.cats.shoot - 1, Math.floor(k * M.cats.shoot));
  /* foes: kind 'reg' | 'boss'; anim 'walk' | 'attack' | 'dead'; p = animation phase (walk/attack loop in seconds, dead 0..1) */
  CD.foe = function (ctx, kind, type, anim, p, x, y, o) {
    const m = M[kind], sheet = kind === 'reg' ? 'zombies' : 'bosses';
    const off = anim === 'walk' ? 0 : anim === 'attack' ? m.walk : m.walk + m.attack;
    const n = anim === 'walk' ? m.walk : anim === 'attack' ? m.attack : m.dead;
    const k = anim === 'dead' ? Math.min(n - 1, Math.floor(p * n)) : Math.floor(p * n) % n;
    const c = cell(kind, sheet, type, off + k);
    o = o || {};
    if (o.flash > 0.01 && c.im) {
      drawCell(ctx, c, x, y, o);
      const fc = flashed(c, kind + type + '_' + (off + k));
      const s = o.s || 1, old = ctx.globalAlpha; ctx.globalAlpha = old * Math.min(0.85, o.flash);
      ctx.save(); ctx.translate(x, y); if (o.flip) ctx.scale(-1, 1);
      ctx.drawImage(fc, 0, 0, c.w, c.h, -c.w * s / 2, -c.h * s + (o.foot || 8) * s, c.w * s, c.h * s);
      ctx.restore(); ctx.globalAlpha = old;
    } else drawCell(ctx, c, x, y, o);
    return { w: c.w * (o.s || 1), h: c.h * (o.s || 1), n };
  };
  CD.walkFrames = (kind) => M[kind].walk; CD.attackFrames = (kind) => M[kind].attack;
  /* helpers: 0 boxing cat, 1 guardian. anim idle|attack */
  CD.helper = function (ctx, who, anim, p, x, y, o) {
    const m = M.helpers; const k = anim === 'attack' ? m.idle + Math.min(m.attack - 1, Math.floor(p * m.attack)) : Math.floor(p * m.idle) % m.idle;
    drawCell(ctx, cell('helpers', 'helpers', who, k), x, y, o);
  };
  CD.bullet = function (ctx, i, x, y, rot, s) {
    const r = M.fx.bullets[i % 3]; if (!img.fx) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); s = s || 1;
    ctx.drawImage(img.fx, r[0], r[1], r[2], r[3], -r[2] * s / 2, -r[3] * s / 2, r[2] * s, r[3] * s); ctx.restore();
  };
  CD.muzzle = function (ctx, k, x, y, s, rot) {
    const a = M.fx.muzzle; const r = a[Math.max(0, Math.min(a.length - 1, Math.floor(k * a.length)))]; if (!img.fx) return;
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); s = s || 1;
    ctx.drawImage(img.fx, r[0], r[1], r[2], r[3], 0, -r[3] * s / 2, r[2] * s, r[3] * s); ctx.restore();
  };
  CD.boom = function (ctx, k, x, y, s, a) {
    const b = M.fx.boom; const r = b[Math.max(0, Math.min(b.length - 1, Math.floor(k * b.length)))]; if (!img.fx) return;
    s = s || 1; const old = ctx.globalAlpha; ctx.globalAlpha = old * (a == null ? 1 : a);
    ctx.drawImage(img.fx, r[0], r[1], r[2], r[3], x - r[2] * s / 2, y - r[3] * s / 2, r[2] * s, r[3] * s); ctx.globalAlpha = old;
  };
  CD.icon = function (ctx, name, x, y, s) {
    const r = M.ui[name]; if (!r || !img.ui) return; s = s || 1;
    ctx.drawImage(img.ui, r[0], r[1], r[2], r[3], x - r[2] * s / 2, y - r[3] * s / 2, r[2] * s, r[3] * s);
  };
  const slotCols = [];
  CD.slotColor = function (a) {
    if (slotCols[a]) return slotCols[a];
    const im = CD.bg[a]; if (!im) return '#6f8294';
    try { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.drawImage(im, 273 * im.width / 2143, 330 * im.height / 1062, 1, 1, 0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return (slotCols[a] = `rgb(${d[0]},${d[1]},${d[2]})`); } catch (e) { return '#6f8294'; }
  };
  CD.IW = 2143; CD.IH = 1062;
})();
