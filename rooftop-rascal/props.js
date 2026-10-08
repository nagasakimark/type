/* Rooftop Rascal - props.js
   Kenney atlas loader, the five city districts, skyline strips (parallax backgrounds), rooftop props,
   collectibles, power-up icons and the treasure rooms. */
(function () {
  'use strict';
  const TM = window.TM, C = TM.C, U = TM.U, D = TM.draw, P = D.P;
  const RR = (window.RR = window.RR || {});
  const INK = C.ink, TAU = Math.PI * 2;
  const clamp = U.clamp, lerp = U.lerp;

  /* seeded random so a district always looks the same */
  function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  /* ================= Kenney atlas ================= */
  const AT = (RR.A = { img: new Image(), ready: false, f: (window.RR_ATLAS && window.RR_ATLAS.f) || {} });
  if (window.RR_ATLAS) { AT.img.onload = () => { AT.ready = true; }; AT.img.src = window.RR_ATLAS.src; }
  /* draw sprite with top-left at x,y; w,h default to the logical (70px) size */
  RR.spr = function (ctx, name, x, y, w, h) {
    const f = AT.f[name]; if (!f || !AT.ready) return false;
    ctx.drawImage(AT.img, f[0], f[1], f[2], f[3], x, y, w == null ? f[2] / 2 : w, h == null ? (w == null ? f[3] / 2 : w * f[3] / f[2]) : h);
    return true;
  };
  RR.sprC = function (ctx, name, cx, cy, w) { const f = AT.f[name]; if (!f) return false; const h = w * f[3] / f[2]; return RR.spr(ctx, name, cx - w / 2, cy - h / 2, w, h); };
  const tintCache = new Map();
  /* a colour-multiplied copy of an atlas sprite (cached) */
  RR.tinted = function (name, color, mode) {
    const key = name + '|' + color + '|' + (mode || 'multiply');
    let c = tintCache.get(key);
    if (c) return c;
    const f = AT.f[name]; if (!f || !AT.ready) return null;
    c = document.createElement('canvas'); c.width = f[2]; c.height = f[3];
    const g = c.getContext('2d');
    g.drawImage(AT.img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
    g.globalCompositeOperation = mode || 'multiply'; g.fillStyle = color; g.fillRect(0, 0, f[2], f[3]);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(AT.img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
    tintCache.set(key, c); return c;
  };
  RR.sprT = function (ctx, name, color, x, y, w, h, mode) {
    const c = RR.tinted(name, color, mode); if (!c) return false;
    ctx.drawImage(c, x, y, w == null ? c.width / 2 : w, h == null ? (w == null ? c.height / 2 : w * c.height / c.width) : h); return true;
  };
  /* additive glow sprite tinted to a colour */
  RR.glow = function (ctx, name, color, x, y, size, alpha) {
    const c = RR.tinted(name, color, 'source-in'); if (!c) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.drawImage(c, x - size / 2, y - size / 2, size, size); ctx.restore();
  };

  /* ================= districts ================= */
  RR.DISTRICTS = [
    {
      id: 'suburb', name: 'Sleepy Suburb', time: 'Dusk', n: 12, speed: 520, t0: 2.0, tl: 0.36,
      sky: [[0, '#2A2877'], [0.4, '#7A3E94'], [0.7, '#E8638A'], [1, '#FFB36B']], stars: 0.45, sun: { x: 1330, y: 640, r: 150, c: '#FFC27A', glow: '#FF8A5C' }, moon: null,
      far: '#8E5499', mid: '#5B3A87', near: '#35246B', fac: 'Beige', facTint: '#A07F9E', cap: '#6A5A9A', capTop: '#8C7CC0', win: '#FFD27A', style: 'houses', cloud: '#FFB1C8',
      pig: { body: '#A9AEC8', wing: '#7F85A6', cap: '#2F4A9A', sheen: '#58C7A5' }, treasure: 'cake', song: 0, deco: ['chimney', 'antenna', 'tank', 'plant', 'dish', 'chimney'], blurb: 'Warm lights, sleepy pigeons.',
    },
    {
      id: 'neon', name: 'Neon Noodle Alley', time: 'Night', n: 14, speed: 560, t0: 1.9, tl: 0.34,
      sky: [[0, '#0B0A2E'], [0.45, '#2A1060'], [0.78, '#8A2A8F'], [1, '#FF5C9E']], stars: 0.55, sun: null, moon: { x: 1480, y: 230, r: 70, c: '#FFE9F6', glow: '#FF7AD0' },
      far: '#51268F', mid: '#33176E', near: '#1B0F45', fac: 'Dark', facTint: '#7C68B0', cap: '#3B2A74', capTop: '#6A52B0', win: '#FFE48A', style: 'neon', cloud: '#B15CD8',
      pig: { body: '#B4A4D8', wing: '#8470B8', cap: '#D6308A', sheen: '#6FE4F4' }, treasure: 'ramen', song: 1, deco: ['neon', 'ac', 'antenna', 'vent', 'neon', 'tank'], blurb: 'Glowing signs, steamy vents.',
    },
    {
      id: 'harbor', name: 'Moonlit Harbor', time: 'Night', n: 16, speed: 600, t0: 1.8, tl: 0.33,
      sky: [[0, '#07123A'], [0.45, '#123674'], [0.78, '#2F70AE'], [1, '#93D6EA']], stars: 0.9, sun: null, moon: { x: 1380, y: 250, r: 95, c: '#FFF6C9', glow: '#BFE6FF' },
      far: '#3E7AB0', mid: '#25528A', near: '#14305F', fac: 'Gray', facTint: '#6F8CB8', cap: '#31517F', capTop: '#5F86BC', win: '#FFE9A8', style: 'harbor', cloud: '#9EC8F0',
      pig: { body: '#F2F4FA', wing: '#C5CCE0', cap: '#2A7F9E', sheen: '#FFFFFF', beak: '#FFC94D' }, treasure: 'fish', song: 2, deco: ['tank', 'crate', 'antenna', 'chimney', 'crate', 'dish'], blurb: 'Sea breeze and seagull guards.',
    },
    {
      id: 'peaks', name: 'Skyscraper Peaks', time: 'Deep night', n: 18, speed: 640, t0: 1.7, tl: 0.32,
      sky: [[0, '#03041A'], [0.45, '#12154B'], [0.78, '#3A3A92'], [1, '#8A7CDB']], stars: 1, sun: null, moon: { x: 440, y: 210, r: 60, c: '#E8EAFF', glow: '#8CA0FF' },
      far: '#4B4DA5', mid: '#2E3079', near: '#171A4E', fac: 'Dark', facTint: '#6872A8', cap: '#2D3274', capTop: '#5A63B8', win: '#9FEFFF', style: 'towers', cloud: '#6E78D8',
      pig: { body: '#70769E', wing: '#4D5278', cap: '#D04A3A', sheen: '#9FB0FF' }, treasure: 'cookies', song: 3, deco: ['solar', 'dish', 'antenna', 'ac', 'tank', 'vent'], blurb: 'High above the clouds.',
    },
    {
      id: 'oldtown', name: 'Old Town Sunrise', time: 'Dawn', n: 20, speed: 680, t0: 1.6, tl: 0.31,
      sky: [[0, '#4A5DC2'], [0.4, '#C874B8'], [0.72, '#FF9E8A'], [1, '#FFDA8C']], stars: 0.12, sun: { x: 960, y: 590, r: 190, c: '#FFE9A6', glow: '#FFC15C', rises: true }, moon: null,
      far: '#C27AAE', mid: '#9A5A98', near: '#6C3E80', fac: 'Beige', facTint: '#E2BE9E', cap: '#8A5A7A', capTop: '#C48CA4', win: '#BFE6FF', style: 'oldtown', cloud: '#FFD9B8',
      pig: { body: '#E8D8B0', wing: '#C9B27E', cap: '#C23B3B', sheen: '#FFC94D' }, treasure: 'feast', song: 4, deco: ['lantern', 'chimney', 'bunting', 'plant', 'lantern', 'tank'], blurb: 'The sun is coming up. Almost home!',
    },
  ];

  /* ================= skyline strips ================= */
  function winGrid(g, x, y, w, h, R, o) {
    const cw = o.cw || 14, ch = o.ch || 18, gx = o.gx || 10, gy = o.gy || 12;
    const cols = Math.floor((w - 8) / (cw + gx)), rows = Math.floor((h - 8) / (ch + gy));
    const ox = x + (w - (cols * (cw + gx) - gx)) / 2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (R() < o.p) { g.fillStyle = R() < 0.18 ? (o.alt || o.lit) : o.lit; g.fillRect(ox + c * (cw + gx), y + 10 + r * (ch + gy), cw, ch); }
    }
  }
  /* returns {cv, lights:[{x,y,c,r}], w, h} */
  RR.skyline = function (o) {
    const R = rng(o.seed || 7), W = o.w || 2400, H = o.h || 600;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const lights = [];
    let x = 0;
    const style = o.style || 'houses';
    const shade = (c, a) => U.shade(c, a);
    while (x < W - 40) {
      let bw = Math.round(o.minW + R() * (o.maxW - o.minW));
      if (W - (x + bw) < o.minW * 0.8) bw = W - x;
      const bh = Math.round(o.minH + R() * (o.maxH - o.minH));
      const top = H - bh;
      const gr = g.createLinearGradient(0, top, 0, H); gr.addColorStop(0, shade(o.color, 0.1)); gr.addColorStop(1, o.bot || shade(o.color, -0.25));
      g.fillStyle = gr;
      const kind = style === 'houses' ? (R() < 0.6 ? 'gable' : 'flat') : style === 'oldtown' ? (R() < 0.35 ? 'pagoda' : R() < 0.7 ? 'tile' : 'flat') : style === 'harbor' ? (R() < 0.3 ? 'saw' : R() < 0.55 ? 'crane' : 'flat') : style === 'towers' ? (R() < 0.5 ? 'step' : 'spire') : (R() < 0.5 ? 'flat' : 'neon');
      if (kind === 'gable') {
        g.beginPath(); g.moveTo(x, H); g.lineTo(x, top + 30); g.lineTo(x + bw / 2, top); g.lineTo(x + bw, top + 30); g.lineTo(x + bw, H); g.fill();
        if (R() < 0.6) { g.fillStyle = shade(o.color, -0.1); g.fillRect(x + bw * 0.7, top - 12, 14, 36); }
        winGrid(g, x, top + 34, bw, bh - 34, R, o.win);
      } else if (kind === 'saw') {
        g.beginPath(); g.moveTo(x, H); g.lineTo(x, top + 24); const n = 3; for (let i = 0; i < n; i++) { g.lineTo(x + bw * (i + 0.5) / n, top); g.lineTo(x + bw * (i + 1) / n, top + 24); } g.lineTo(x + bw, H); g.fill();
        winGrid(g, x, top + 40, bw, bh - 40, R, Object.assign({}, o.win, { p: o.win.p * 0.5 }));
      } else if (kind === 'crane') {
        g.fillRect(x, top + 40, bw, bh - 40);
        g.strokeStyle = shade(o.color, -0.05); g.lineWidth = 5; g.beginPath(); g.moveTo(x + bw * 0.3, top + 40); g.lineTo(x + bw * 0.3, top - 90); g.lineTo(x + bw * 1.1, top - 90); g.moveTo(x + bw * 0.3, top - 90); g.lineTo(x - bw * 0.2, top - 70); g.moveTo(x + bw * 0.95, top - 90); g.lineTo(x + bw * 0.95, top - 40); g.stroke();
        lights.push({ x: x + bw * 0.3, y: top - 90, c: '#FF5A5F', r: 4 });
        winGrid(g, x, top + 52, bw, bh - 52, R, o.win);
      } else if (kind === 'step') {
        const w2 = bw * 0.6; g.fillRect(x, top + bh * 0.25, bw, bh); g.fillRect(x + (bw - w2) / 2, top, w2, bh);
        winGrid(g, x + (bw - w2) / 2, top + 6, w2, bh * 0.3, R, o.win); winGrid(g, x, top + bh * 0.25 + 6, bw, bh * 0.75, R, o.win);
        lights.push({ x: x + bw / 2, y: top - 52, c: '#FF5A5F', r: 4 });
        g.fillStyle = shade(o.color, 0.05); g.fillRect(x + bw / 2 - 2, top - 50, 4, 52);
      } else if (kind === 'spire') {
        g.fillRect(x, top + 50, bw, bh - 50); g.beginPath(); g.moveTo(x + 6, top + 50); g.lineTo(x + bw / 2, top); g.lineTo(x + bw - 6, top + 50); g.fill();
        g.fillRect(x + bw / 2 - 2, top - 60, 4, 70); lights.push({ x: x + bw / 2, y: top - 62, c: '#FF5A5F', r: 4 });
        winGrid(g, x, top + 56, bw, bh - 56, R, o.win);
      } else if (kind === 'pagoda') {
        const tiers = 3 + (R() < 0.5 ? 1 : 0), tw = bw * 0.8, th = bh / (tiers + 0.6);
        g.fillStyle = shade(o.color, -0.18); g.fillRect(x + bw * 0.1, H - th * 1.0, bw * 0.8, th);
        for (let i = 0; i < tiers; i++) {
          const ty = H - th * (i + 1.7), w = tw * (1 - i * 0.16);
          g.fillStyle = shade(o.color, -0.05 + i * 0.03); g.fillRect(x + bw / 2 - w * 0.42, ty + 4, w * 0.84, th * 0.7);
          g.fillStyle = shade(o.color, -0.28); g.beginPath(); g.moveTo(x + bw / 2 - w * 0.62, ty + 14); g.quadraticCurveTo(x + bw / 2 - w * 0.34, ty + 10, x + bw / 2, ty - 14); g.quadraticCurveTo(x + bw / 2 + w * 0.34, ty + 10, x + bw / 2 + w * 0.62, ty + 14); g.quadraticCurveTo(x + bw / 2, ty + 20, x + bw / 2 - w * 0.62, ty + 14); g.fill();
          g.fillStyle = 'rgba(255,200,110,0.85)'; g.fillRect(x + bw / 2 - 5, ty + 14, 10, 14);
        }
        g.fillStyle = shade(o.color, -0.3); g.fillRect(x + bw / 2 - 2, H - th * (tiers + 1.7) - 22, 4, 26);
      } else if (kind === 'tile') {
        g.fillRect(x, top + 26, bw, bh - 26);
        g.fillStyle = shade(o.color, -0.3); g.beginPath(); g.moveTo(x - 10, top + 36); g.quadraticCurveTo(x + bw * 0.25, top + 28, x + bw / 2, top); g.quadraticCurveTo(x + bw * 0.75, top + 28, x + bw + 10, top + 36); g.lineTo(x + bw, top + 44); g.lineTo(x, top + 44); g.fill();
        winGrid(g, x, top + 54, bw, bh - 54, R, Object.assign({}, o.win, { alt: '#FFC15C' }));
      } else if (kind === 'neon') {
        g.fillRect(x, top, bw, bh);
        const cs = ['#FF3EA5', '#2BE6FF', '#FFE14D'], c = cs[Math.floor(R() * 3)];
        g.fillStyle = c; const sw = 10 + R() * 8, sh = 60 + R() * 120; const sx = x + (R() < 0.5 ? 6 : bw - 6 - sw);
        g.fillRect(sx, top + 20 + R() * 50, sw, sh); lights.push({ x: sx + sw / 2, y: top + 20 + sh / 2, c, r: 40 + sh * 0.2, glow: true });
        winGrid(g, x, top + 12, bw, bh - 12, R, o.win);
      } else {
        g.fillRect(x, top, bw, bh);
        if (R() < 0.5) { g.fillStyle = shade(o.color, -0.08); g.fillRect(x + bw * 0.15, top - 24, bw * 0.28, 26); }
        if (R() < 0.35) { g.fillStyle = shade(o.color, 0.06); g.fillRect(x + bw / 2 - 2, top - 44, 4, 46); }
        winGrid(g, x, top + 8, bw, bh - 8, R, o.win);
      }
      x += bw + (o.gap != null ? o.gap : 0);
    }
    return { cv, lights, w: W, h: H, bot: o.bot };
  };

  /* ================= rooftop props (origin: base on the roof surface) ================= */
  const DEC = (RR.deco = {});
  DEC.tank = function (ctx, x, y, o) {
    const w = 84, h = 96;
    ctx.fillStyle = INK; ctx.fillRect(x + 10, y - 44, 8, 44); ctx.fillRect(x + w - 18, y - 44, 8, 44);
    ctx.fillStyle = '#7D6B5A'; ctx.fillRect(x + 12, y - 44, 4, 44); ctx.fillRect(x + w - 16, y - 44, 4, 44);
    D.sticker(ctx, P.rr(x, y - 44 - h, w, h, 18), '#A98563', { x, y: y - 44 - h, w, h }, { shadow: false });
    ctx.strokeStyle = 'rgba(31,26,61,0.35)'; ctx.lineWidth = 4; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + 2, y - 44 - h + i * h / 4); ctx.lineTo(x + w - 2, y - 44 - h + i * h / 4); ctx.stroke(); }
    const cone = P.poly([[x - 6, y - 44 - h + 6], [x + w / 2, y - 44 - h - 30], [x + w + 6, y - 44 - h + 6]], false);
    D.sticker(ctx, cone, '#7D5A44', { x, y: y - 44 - h - 30, w, h: 36 }, { shadow: false });
    ctx.fillStyle = INK; ctx.fillRect(x + w / 2 - 9, y - 44 - 14, 18, 14);
  };
  DEC.antenna = function (ctx, x, y, o) {
    ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x + 20, y); ctx.lineTo(x + 20, y - 150); ctx.stroke();
    ctx.lineWidth = 5; for (const [dy, hw] of [[-60, 36], [-92, 30], [-122, 22]]) { ctx.beginPath(); ctx.moveTo(x + 20 - hw, y + dy); ctx.lineTo(x + 20 + hw, y + dy); ctx.stroke(); }
    ctx.strokeStyle = '#B9B6CF'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + 20, y); ctx.lineTo(x + 20, y - 150); for (const [dy, hw] of [[-60, 36], [-92, 30], [-122, 22]]) { ctx.moveTo(x + 20 - hw, y + dy); ctx.lineTo(x + 20 + hw, y + dy); } ctx.stroke();
    const blink = (Math.sin((o.t || 0) * 3 + x) > 0.2) ? 1 : 0.3; ctx.fillStyle = `rgba(255,90,95,${blink})`; ctx.beginPath(); ctx.arc(x + 20, y - 154, 7, 0, TAU); ctx.fill();
  };
  DEC.dish = function (ctx, x, y) {
    ctx.fillStyle = INK; ctx.fillRect(x + 28, y - 36, 8, 36);
    ctx.save(); ctx.translate(x + 32, y - 52); ctx.rotate(-0.5);
    D.sticker(ctx, P.ellipse(0, 0, 38, 24), '#E9E6F4', { x: -38, y: -24, w: 76, h: 48 }, { shadow: false });
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, -22); ctx.stroke(); ell(ctx, 24, -24, 6, '#FF5A5F'); ctx.restore();
  };
  function ell(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
  DEC.ac = function (ctx, x, y, o) {
    D.sticker(ctx, P.rr(x, y - 70, 96, 70, 10), '#CFCBE0', { x, y: y - 70, w: 96, h: 70 }, { shadow: false });
    ctx.fillStyle = '#9A94B8'; ctx.beginPath(); ctx.arc(x + 32, y - 36, 24, 0, TAU); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    const t = (o.t || 0) * 12; ctx.strokeStyle = INK; ctx.lineWidth = 4; for (let i = 0; i < 3; i++) { const a = t + i * TAU / 3; ctx.beginPath(); ctx.moveTo(x + 32, y - 36); ctx.lineTo(x + 32 + Math.cos(a) * 20, y - 36 + Math.sin(a) * 20); ctx.stroke(); }
    ctx.fillStyle = '#9A94B8'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 66, y - 60 + i * 12, 22, 5);
  };
  DEC.vent = function (ctx, x, y, o) {
    D.sticker(ctx, P.rr(x + 8, y - 44, 44, 44, 6), '#A9A4C4', { x: x + 8, y: y - 44, w: 44, h: 44 }, { shadow: false });
    D.sticker(ctx, P.rr(x, y - 60, 60, 20, 8), '#8F8AB0', null, { shadow: false });
    const t = (o.t || 0) + x * 0.01;
    for (let i = 0; i < 3; i++) { const k = ((((t * 0.5 + i / 3) % 1) + 1) % 1); ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(x + 30 + Math.sin(k * 6 + i) * 10, y - 70 - k * 90, 12 + k * 22, 0, TAU); ctx.fill(); }
  };
  DEC.solar = function (ctx, x, y) {
    for (let i = 0; i < 2; i++) {
      ctx.save(); ctx.translate(x + i * 78, y); ctx.fillStyle = INK; ctx.fillRect(10, -26, 6, 26); ctx.fillRect(56, -26, 6, 26);
      ctx.rotate(-0.18); D.sticker(ctx, P.rr(0, -52, 72, 40, 5), '#3556A8', { x: 0, y: -52, w: 72, h: 40 }, { shadow: false });
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); for (let k = 1; k < 3; k++) { ctx.moveTo(k * 24, -52); ctx.lineTo(k * 24, -12); } ctx.moveTo(0, -32); ctx.lineTo(72, -32); ctx.stroke(); ctx.restore();
    }
  };
  DEC.crate = function (ctx, x, y) {
    D.sticker(ctx, P.rr(x, y - 52, 56, 52, 5), '#B98A55', { x, y: y - 52, w: 56, h: 52 }, { shadow: false });
    ctx.strokeStyle = 'rgba(31,26,61,0.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 4, y - 48); ctx.lineTo(x + 52, y - 4); ctx.moveTo(x + 52, y - 48); ctx.lineTo(x + 4, y - 4); ctx.stroke();
    D.sticker(ctx, P.rr(x + 40, y - 92, 44, 40, 5), '#D19F66', { x: x + 40, y: y - 92, w: 44, h: 40 }, { shadow: false });
  };
  DEC.chimney = function (ctx, x, y, o) {
    RR.spr(ctx, 'chimneyThin', x, y - 62, 62, 62); RR.spr(ctx, 'chimney', x + 14, y - 108, 62, 62);
    const t = (o.t || 0) + x * 0.013;
    for (let i = 0; i < 3; i++) { const k = ((((t * 0.35 + i / 3) % 1) + 1) % 1); ctx.fillStyle = `rgba(235,230,250,${0.45 * (1 - k)})`; ctx.beginPath(); ctx.arc(x + 44 + Math.sin(k * 5 + i * 2) * 14, y - 118 - k * 110, 12 + k * 20, 0, TAU); ctx.fill(); }
  };
  DEC.plant = function (ctx, x, y) {
    RR.spr(ctx, 'plant', x, y - 52, 56, 56); RR.spr(ctx, 'mushroomRed', x + 44, y - 42, 42, 42); RR.spr(ctx, 'bush', x + 82, y - 50, 70, 36);
  };
  DEC.neon = function (ctx, x, y, o) {
    const words = ['RAMEN', 'CAFE', 'HOTEL', 'ARCADE', 'SUSHI', 'PIZZA'], cols = ['#FF3EA5', '#2BE6FF', '#FFE14D', '#8CFF6A'];
    const k = Math.floor(Math.abs(x * 0.013)) % words.length, col = cols[k % cols.length];
    const w = 168, h = 64, flick = (Math.sin((o.t || 0) * 23 + k) > -0.92) ? 1 : 0.35;
    ctx.fillStyle = INK; ctx.fillRect(x + 22, y - 84, 8, 84); ctx.fillRect(x + w - 30, y - 84, 8, 84);
    D.sticker(ctx, P.rr(x, y - 84 - h, w, h, 14), '#241A52', { x, y: y - 84 - h, w, h }, { shadow: false });
    ctx.save(); ctx.globalAlpha = flick;
    D.text(ctx, words[k], x + w / 2, y - 84 - h / 2 + 3, { size: 40, color: col, font: D.FONT_DISPLAY(40, 800) }); ctx.restore();
    RR.glow(ctx, 'p_light_01', col, x + w / 2, y - 84 - h / 2, 300, 0.32 * flick);
  };
  DEC.lantern = function (ctx, x, y, o) {
    ctx.fillStyle = INK; ctx.fillRect(x + 20, y - 130, 6, 130);
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 23, y - 126); ctx.lineTo(x + 70, y - 126); ctx.stroke();
    ctx.save(); ctx.translate(x + 70, y - 100 + Math.sin((o.t || 0) * 2 + x) * 2); ctx.rotate(Math.sin((o.t || 0) * 1.6 + x) * 0.06);
    D.sticker(ctx, P.ellipse(0, 0, 22, 28), '#FF6A4A', { x: -22, y: -28, w: 44, h: 56 }, { shadow: false }); ctx.fillStyle = INK; ctx.fillRect(-10, -32, 20, 6); ctx.fillRect(-10, 26, 20, 6);
    RR.glow(ctx, 'p_light_01', '#FFB45A', 0, 0, 170, 0.5); ctx.restore();
  };
  DEC.bunting = function (ctx, x, y, o) {
    const cols = ['#FF5A5F', '#FFC83D', '#2BB673', '#2F9BFF', '#FF3EA5'];
    ctx.fillStyle = INK; ctx.fillRect(x, y - 120, 6, 120); ctx.fillRect(x + 220, y - 120, 6, 120);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 3, y - 118); ctx.quadraticCurveTo(x + 113, y - 70, x + 223, y - 118); ctx.stroke();
    for (let i = 1; i < 8; i++) { const k = i / 8, px = x + 3 + k * 220, py = lerp(y - 118, y - 118, k) + Math.sin(k * Math.PI) * 38; ctx.save(); ctx.translate(px, py); ctx.rotate(Math.sin((o.t || 0) * 3 + i) * 0.1); ctx.fillStyle = cols[i % 5]; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(0, 24); ctx.closePath(); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); }
  };
  DEC.fence = function (ctx, x, y, o) { const n = o.n || 3; for (let i = 0; i < n; i++) RR.spr(ctx, 'fenceLow', x + i * 70, y - 62, 70, 70); };
  DEC.chair = function (ctx, x, y) { D.sticker(ctx, P.rr(x, y - 40, 40, 8, 4), '#7DD3C8', null, { shadow: false }); ctx.fillStyle = INK; ctx.fillRect(x + 4, y - 32, 6, 32); ctx.fillRect(x + 30, y - 32, 6, 32); D.sticker(ctx, P.rr(x, y - 80, 8, 44, 4), '#7DD3C8', null, { shadow: false }); };
  DEC.cats = function () { };

  /* ================= obstacles ================= */
  RR.drawPipe = function (ctx, x0, x1, y, t, o) { // slide obstacle: horizontal pipe / laundry line across the lane at head height
    o = o || {};
    if (o.line) {
      ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x0, y + 100); ctx.lineTo(x0, y - 4); ctx.moveTo(x1, y + 100); ctx.lineTo(x1, y - 4); ctx.stroke();
      ctx.strokeStyle = '#E9E4F7'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y - 4); ctx.quadraticCurveTo((x0 + x1) / 2, y + 14, x1, y - 4); ctx.stroke();
      const cols = ['#FF5A5F', '#2F9BFF', '#FFC83D', '#2BB673', '#FF3EA5'], n = Math.max(3, Math.round((x1 - x0) / 56));
      for (let i = 1; i < n; i++) { const k = i / n, lx = lerp(x0, x1, k), ly = y - 4 + Math.sin(k * Math.PI) * 14; const sw = Math.sin(t * 3 + i) * 0.1; ctx.save(); ctx.translate(lx, ly); ctx.rotate(sw);
        const kind = i % 3; ctx.fillStyle = cols[(i + (o.seed || 0)) % 5];
        if (kind === 0) { ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.lineTo(24, 14); ctx.lineTo(14, 18); ctx.lineTo(12, 50); ctx.lineTo(-12, 50); ctx.lineTo(-14, 18); ctx.lineTo(-24, 14); ctx.closePath(); }
        else if (kind === 1) { ctx.beginPath(); ctx.rect(-22, 0, 44, 36); } else { ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(10, 30); ctx.lineTo(-10, 30); ctx.closePath(); }
        ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(-3, -4, 6, 8); ctx.restore(); }
      return;
    }
    // metal pipe on brackets
    ctx.fillStyle = INK; for (const bx of [x0 + 10, x1 - 10]) { ctx.fillRect(bx - 5, y, 10, 110); }
    D.sticker(ctx, P.rr(x0, y - 12, x1 - x0, 26, 13), '#9FA7C2', { x: x0, y: y - 12, w: x1 - x0, h: 26 }, { shadow: false });
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x0 + 12, y - 7, x1 - x0 - 24, 4);
    for (let bx = x0 + 40; bx < x1 - 20; bx += 90) { ctx.fillStyle = '#6F7699'; ctx.fillRect(bx, y - 14, 10, 30); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(bx, y - 14, 10, 30); }
  };
  RR.drawTramp = function (ctx, x, y, kind, press, t) {
    // x = centre, y = roof; press 0..1 compression
    if (kind === 'parasol') {
      ctx.save(); ctx.translate(x, y); ctx.fillStyle = INK; ctx.fillRect(-4, -92, 8, 92);
      ctx.restore(); RR.sprC(ctx, 'umbrellaOpen', x, y - 100 + press * 14, 150);
      return;
    }
    if (kind === 'mushroom') {
      ctx.fillStyle = INK; ctx.fillRect(x - 14, y - 70, 28, 70); ctx.fillStyle = '#F2E6CC'; ctx.fillRect(x - 10, y - 70, 20, 70);
      const yy = y - 70 + press * 12; RR.spr(ctx, 'shroomRedLeft', x - 105, yy - 48, 70, 70); RR.spr(ctx, 'shroomRedMid', x - 36, yy - 48, 72, 70); RR.spr(ctx, 'shroomRedRight', x + 35, yy - 48, 70, 70);
      return;
    }
    const s = RR.sprC(ctx, press > 0.5 ? 'springboardDown' : 'springboardUp', x, y - 38 + press * 8, 116); if (!s) { D.sticker(ctx, P.rr(x - 50, y - 24, 100, 24, 10), '#FF7A1A', null, { shadow: false }); }
  };
  RR.drawBlocker = function (ctx, x, y, h, t) { // tall stack to bounce over: vent stack with a grille
    const w = 78;
    D.sticker(ctx, P.rr(x - w / 2, y - h, w, h, 8), '#8E87B3', { x: x - w / 2, y: y - h, w, h }, { shadow: false });
    ctx.strokeStyle = 'rgba(31,26,61,0.4)'; ctx.lineWidth = 4; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x - w / 2 + 6, y - h + i * h / 6); ctx.lineTo(x + w / 2 - 6, y - h + i * h / 6); ctx.stroke(); }
    D.sticker(ctx, P.rr(x - w / 2 - 10, y - h - 14, w + 20, 22, 8), '#B8B1D8', null, { shadow: false });
    ctx.fillStyle = '#FF5A5F'; ctx.beginPath(); ctx.arc(x, y - h - 26, 7, 0, TAU); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  };
  RR.drawBillboard = function (ctx, x, y, h, t, text, col) { // free-standing wall for wall-kicks
    const w = 70; ctx.fillStyle = INK; ctx.fillRect(x - 6, y - h, 12, h);
    D.sticker(ctx, P.rr(x - w / 2, y - h, w, h, 8), col || '#FF8A3D', { x: x - w / 2, y: y - h, w, h }, { shadow: false });
    ctx.save(); ctx.translate(x, y - h / 2); ctx.rotate(-Math.PI / 2); D.text(ctx, text || 'SALE', 0, 0, { size: 44, color: '#fff', outline: 7 }); ctx.restore();
    ctx.fillStyle = INK; ctx.fillRect(x - w / 2 - 6, y - 10, w + 12, 10);
  };
  RR.drawDrain = function (ctx, x, y, h) { // drain pipe on a wall
    ctx.fillStyle = INK; ctx.fillRect(x - 8, y - h, 16, h); ctx.fillStyle = '#B8B1D0'; ctx.fillRect(x - 5, y - h, 10, h);
    for (let yy = y - h + 30; yy < y; yy += 90) { ctx.fillStyle = INK; ctx.fillRect(x - 12, yy, 24, 9); ctx.fillStyle = '#8F89AD'; ctx.fillRect(x - 10, yy + 1, 20, 6); }
  };
  RR.drawZipPole = function (ctx, x, y, h) {
    ctx.fillStyle = INK; ctx.fillRect(x - 7, y - h, 14, h); ctx.fillStyle = '#C79B62'; ctx.fillRect(x - 3.5, y - h, 7, h);
    ctx.fillStyle = INK; ctx.fillRect(x - 24, y - h - 4, 48, 11); ctx.fillStyle = '#C79B62'; ctx.fillRect(x - 21, y - h - 1, 42, 5);
  };
  RR.zipY = function (ax, ay, bx, by, sag, x) { const u = clamp((x - ax) / (bx - ax), 0, 1); return lerp(ay, by, u) + Math.sin(u * Math.PI) * sag; };
  RR.drawZipLine = function (ctx, ax, ay, bx, by, sag, t, seed) {
    ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); for (let i = 0; i <= 28; i++) { const x = lerp(ax, bx, i / 28), y = RR.zipY(ax, ay, bx, by, sag, x); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    ctx.strokeStyle = '#F2EEFF'; ctx.lineWidth = 2.5; ctx.stroke();
    const cols = ['#FF5A5F', '#2F9BFF', '#FFC83D', '#2BB673', '#FF3EA5', '#7B5CFF'], n = Math.floor((bx - ax) / 120);
    for (let i = 1; i < n; i++) { const x = lerp(ax, bx, i / n), y = RR.zipY(ax, ay, bx, by, sag, x); ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2.5 + i + (seed || 0)) * 0.12); ctx.fillStyle = cols[(i + (seed || 0)) % 6]; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.lineTo(18, 40); ctx.lineTo(-18, 44); ctx.closePath(); ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(-3, -4, 6, 8); ctx.restore(); }
  };

  /* ================= collectibles ================= */
  RR.drawFish = function (ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y + Math.sin(t * 4 + x * 0.01) * 5); ctx.scale(s, s); ctx.rotate(Math.sin(t * 3 + x) * 0.12);
    const tail = P.poly([[18, 0], [40, -16], [36, 0], [40, 16]], false); D.sticker(ctx, tail, '#FF8A3D', null, { shadow: false, lw: 4 });
    const body = P.ellipse(0, 0, 26, 16); D.sticker(ctx, body, '#4FC3F7', { x: -26, y: -16, w: 52, h: 32 }, { shadow: false, lw: 4 });
    ctx.save(); ctx.clip(body); ctx.fillStyle = '#E6F7FF'; ctx.beginPath(); ctx.ellipse(0, 12, 28, 10, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-14, -3, 3.4, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-15, -4, 1.2, 0, TAU); ctx.fill();
    ctx.restore();
  };
  RR.drawCookie = function (ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y + Math.sin(t * 4 + x * 0.013) * 4); ctx.scale(s, s); ctx.rotate(Math.sin(t * 2 + x) * 0.2);
    D.sticker(ctx, P.circle(0, 0, 20), '#D9A15C', { x: -20, y: -20, w: 40, h: 40 }, { shadow: false, lw: 4 });
    ctx.fillStyle = '#5B3A22'; for (const [a, b] of [[-7, -7], [8, -3], [-2, 8], [9, 9], [-11, 5]]) { ctx.beginPath(); ctx.ellipse(a, b, 3.6, 3, 0.4, 0, TAU); ctx.fill(); }
    ctx.restore();
  };
  RR.gemNames = ['gemBlue', 'gemGreen', 'gemRed', 'gemYellow'];
  RR.drawGem = function (ctx, x, y, s, t, kind) {
    const bob = Math.sin(t * 4 + x * 0.01) * 4;
    RR.glow(ctx, 'p_star_04', '#FFFFFF', x, y + bob, 78 * s, 0.35 + Math.sin(t * 6 + x) * 0.12);
    if (!RR.sprC(ctx, RR.gemNames[kind % 4], x, y + bob, 64 * s)) { ctx.fillStyle = '#4FC3F7'; ctx.beginPath(); ctx.arc(x, y + bob, 16 * s, 0, TAU); ctx.fill(); }
  };
  RR.drawPower = function (ctx, x, y, kind, t) {
    const bob = Math.sin(t * 3 + x * 0.01) * 6; y += bob;
    const col = kind === 'boost' ? '#FFC83D' : kind === 'smoke' ? '#8E7BD8' : '#FF5A5F';
    RR.glow(ctx, 'p_light_01', col, x, y, 190, 0.55);
    D.sticker(ctx, P.circle(x, y, 42), '#fff', { x: x - 42, y: y - 42, w: 84, h: 84 }, { lw: 5 });
    ctx.save(); ctx.translate(x, y);
    if (kind === 'boost') { // winged sneaker
      D.sticker(ctx, P.poly([[-22, 6], [-18, -14], [-2, -16], [6, -4], [24, 0], [24, 14], [-22, 14]], true), '#FF5A5F', null, { shadow: false, lw: 4 });
      ctx.fillStyle = '#fff'; ctx.fillRect(-22, 10, 46, 6); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(-22, 10, 46, 6);
      ctx.fillStyle = '#FFC83D'; ctx.beginPath(); ctx.moveTo(-18, -4); ctx.quadraticCurveTo(-38, -22, -44, -6); ctx.quadraticCurveTo(-34, -6, -28, 2); ctx.quadraticCurveTo(-34, 2, -30, 8); ctx.closePath(); ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    } else if (kind === 'smoke') {
      ell(ctx, 0, 6, 20, '#3E3A66'); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(8, -12); ctx.quadraticCurveTo(14, -24, 22, -20); ctx.stroke();
      ctx.fillStyle = '#FFC83D'; ctx.beginPath(); ctx.arc(24, -22, 5, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-7, 0, 6, 0, TAU); ctx.fill();
    } else {
      ctx.lineCap = 'butt'; ctx.lineWidth = 18; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(0, 2, 18, Math.PI, 0); ctx.lineTo(18, 22); ctx.moveTo(-18, 2); ctx.lineTo(-18, 22); ctx.stroke();
      ctx.lineWidth = 10; ctx.strokeStyle = '#FF5A5F'; ctx.beginPath(); ctx.arc(0, 2, 18, Math.PI, 0); ctx.lineTo(18, 16); ctx.moveTo(-18, 2); ctx.lineTo(-18, 16); ctx.stroke();
      ctx.fillStyle = '#E9E6F4'; ctx.fillRect(-23, 16, 10, 8); ctx.fillRect(13, 16, 10, 8); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeRect(-23, 16, 10, 8); ctx.strokeRect(13, 16, 10, 8);
    }
    ctx.restore();
  };
  RR.powerIcon = function (ctx, x, y, kind, s) { // HUD-size
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); RR.drawPower(ctx, 0, 0, kind, 0); ctx.restore();
  };

  /* ================= treasure rooms ================= */
  RR.drawTreasure = function (ctx, x, y, w, kind, t) {
    // a rooftop pantry: glass room with an open door and a table; x,y = left edge at the roof surface; w = building width
    const rw = Math.min(w - 120, 560), rx = x + (w - rw) / 2, rh = 250;
    // fairy lights
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(rx - 30, y - rh - 20); ctx.quadraticCurveTo(rx + rw / 2, y - rh + 20, rx + rw + 30, y - rh - 20); ctx.stroke();
    for (let i = 0; i < 9; i++) { const k = (i + 0.5) / 9, lx = lerp(rx - 30, rx + rw + 30, k), ly = lerp(y - rh - 20, y - rh - 20, k) + Math.sin(k * Math.PI) * 26 + 10; const on = (Math.sin(t * 4 + i * 1.3) > -0.3); RR.glow(ctx, 'p_light_01', ['#FF5A5F', '#FFC83D', '#2BB673', '#2F9BFF'][i % 4], lx, ly, on ? 66 : 40, on ? 0.9 : 0.4); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(lx, ly, 4, 0, TAU); ctx.fill(); }
    // walls
    D.sticker(ctx, P.rr(rx, y - rh, rw, rh, 14), '#FFF3D6', { x: rx, y: y - rh, w: rw, h: rh }, { shadow: false });
    const roof = P.poly([[rx - 26, y - rh + 6], [rx + rw / 2, y - rh - 76], [rx + rw + 26, y - rh + 6]], false);
    D.sticker(ctx, roof, '#E8423F', { x: rx - 26, y: y - rh - 76, w: rw + 52, h: 90 }, { shadow: false });
    // interior glow
    const inner = P.rr(rx + 22, y - rh + 26, rw - 44, rh - 26, 10);
    ctx.fillStyle = '#FFE9B0'; ctx.fill(inner); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(inner);
    RR.glow(ctx, 'p_light_01', '#FFD27A', rx + rw / 2, y - 100, rw * 1.2, 0.5);
    // shelves
    ctx.fillStyle = '#B58450'; for (const yy of [y - rh + 78, y - rh + 132]) { ctx.fillRect(rx + 30, yy, rw - 60, 8); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(rx + 30, yy, rw - 60, 8); }
    const jars = ['#FF8A8A', '#8AD7FF', '#FFE48A', '#9BE59B', '#D9A7FF', '#FFB36B'];
    for (let i = 0; i < 6; i++) { for (const yy of [y - rh + 78, y - rh + 132]) { const jx = rx + 46 + i * ((rw - 100) / 5); D.sticker(ctx, P.rr(jx, yy - 30, 30, 30, 6), jars[(i + (yy > y - rh + 100 ? 2 : 0)) % 6], null, { shadow: false, lw: 3.5 }); } }
    // table + hero item
    D.sticker(ctx, P.rr(rx + rw / 2 - 150, y - 56, 300, 18, 6), '#8C5A34', null, { shadow: false });
    ctx.fillStyle = INK; ctx.fillRect(rx + rw / 2 - 128, y - 38, 12, 38); ctx.fillRect(rx + rw / 2 + 116, y - 38, 12, 38);
    ctx.fillStyle = '#fff'; ctx.fillRect(rx + rw / 2 - 150, y - 60, 300, 6);
    const cx = rx + rw / 2, cy = y - 60;
    if (kind === 'cake') {
      D.sticker(ctx, P.rr(cx - 70, cy - 52, 140, 52, 12), '#FFC1D6', { x: cx - 70, y: cy - 52, w: 140, h: 52 }, { shadow: false });
      D.sticker(ctx, P.rr(cx - 48, cy - 98, 96, 46, 12), '#FFF4E0', { x: cx - 48, y: cy - 98, w: 96, h: 46 }, { shadow: false });
      ctx.fillStyle = '#E8423F'; for (const dx of [-30, 0, 30]) { ctx.beginPath(); ctx.arc(cx + dx, cy - 100, 9, 0, TAU); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); for (let i = 0; i < 8; i++) ctx.arc(cx - 66 + i * 19, cy - 52, 9, 0, Math.PI); ctx.fill();
      for (const dx of [-14, 14]) { ctx.fillStyle = '#4FC3F7'; ctx.fillRect(cx + dx - 3, cy - 128, 6, 26); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(cx + dx - 3, cy - 128, 6, 26); ctx.fillStyle = '#FFC83D'; ctx.beginPath(); ctx.ellipse(cx + dx, cy - 134 + Math.sin(t * 9 + dx) * 1.5, 5, 8, 0, 0, TAU); ctx.fill(); }
    } else if (kind === 'ramen') {
      D.sticker(ctx, P.rr(cx - 76, cy - 62, 152, 62, 28), '#FF5A5F', { x: cx - 76, y: cy - 62, w: 152, h: 62 }, { shadow: false });
      D.sticker(ctx, P.ellipse(cx, cy - 62, 76, 16), '#FFE9A8', null, { shadow: false });
      ctx.fillStyle = '#FFB36B'; ctx.beginPath(); ctx.ellipse(cx - 24, cy - 64, 22, 8, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + 28, cy - 66, 11, 0, TAU); ctx.fill(); ctx.fillStyle = '#FFC83D'; ctx.beginPath(); ctx.arc(cx + 28, cy - 66, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#6FD26F'; ctx.fillRect(cx - 4, cy - 72, 22, 6);
      for (let i = 0; i < 3; i++) { const k = ((((t * 0.5 + i / 3) % 1) + 1) % 1); ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; ctx.beginPath(); ctx.arc(cx - 30 + i * 30 + Math.sin(k * 6 + i) * 8, cy - 86 - k * 70, 10 + k * 12, 0, TAU); ctx.fill(); }
    } else if (kind === 'fish') {
      D.sticker(ctx, P.ellipse(cx, cy - 24, 120, 22), '#E9E6F4', null, { shadow: false });
      RR.drawFish(ctx, cx - 20, cy - 50, 2.4, 0); RR.drawFish(ctx, cx + 56, cy - 40, 1.4, 1);
      ell(ctx, cx - 100, cy - 50, 18, '#FFE14D');
    } else if (kind === 'cookies') {
      for (let i = 0; i < 4; i++) { D.sticker(ctx, P.ellipse(cx + (i % 2 ? 6 : -6), cy - 12 - i * 22, 62 - i * 3, 15), '#D9A15C', null, { shadow: false }); ctx.fillStyle = '#5B3A22'; for (const dx of [-30, -4, 24, 40]) { ctx.beginPath(); ctx.ellipse(cx + dx * 0.9, cy - 14 - i * 22, 4.5, 3, 0, 0, TAU); ctx.fill(); } }
      D.sticker(ctx, P.circle(cx, cy - 106, 14), '#FF5A5F', null, { shadow: false });
    } else { // feast: tiered cake + trophy
      D.sticker(ctx, P.rr(cx - 88, cy - 50, 176, 50, 12), '#FFC1D6', { x: cx - 88, y: cy - 50, w: 176, h: 50 }, { shadow: false });
      D.sticker(ctx, P.rr(cx - 64, cy - 94, 128, 44, 12), '#FFF4E0', { x: cx - 64, y: cy - 94, w: 128, h: 44 }, { shadow: false });
      D.sticker(ctx, P.rr(cx - 38, cy - 136, 76, 42, 12), '#FFD9A0', { x: cx - 38, y: cy - 136, w: 76, h: 42 }, { shadow: false });
      for (let i = 0; i < 5; i++) { const dx = -32 + i * 16; ctx.fillStyle = ['#FF5A5F', '#4FC3F7', '#FFC83D', '#2BB673', '#FF3EA5'][i]; ctx.fillRect(cx + dx - 3, cy - 166, 6, 30); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(cx + dx - 3, cy - 166, 6, 30); ctx.fillStyle = '#FFC83D'; ctx.beginPath(); ctx.ellipse(cx + dx, cy - 172 + Math.sin(t * 9 + i) * 1.5, 5, 8, 0, 0, TAU); ctx.fill(); }
    }
    // open door arch with a welcome sign
    D.sticker(ctx, P.rr(rx + rw / 2 - 84, y - rh - 64, 168, 46, 12), '#FFC83D', null, { shadow: false });
    D.text(ctx, 'PANTRY', rx + rw / 2, y - rh - 40, { size: 32, color: INK });
  };

  /* ================= a pre-rendered flashlight cone for pursuers ================= */
  RR.drawBeam = function (ctx, x, y, ang, len, alpha) {
    const b = RR.beam(); ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(b, 0, -len * 0.25, len, len * 0.5); ctx.restore();
  };
})();
