/* Ink Rush - world.js: the pseudo-3D world. Projection, 4 stage themes, scenery props drawn in code,
   skyline, perspective ground, the paint layer (ground texture + per-prop splats) and territory coverage. */
(function () {
  'use strict';
  const TM = window.TM, U = TM.U, D = TM.draw, P = D.P;
  const INK = window.INK;
  const INKC = INK.INKC;
  const VX = 960, F = 620, CAMH = 2.6, HZ0 = 395;
  INK.VX = VX; INK.F = F; INK.CAMH = CAMH; INK.HZ0 = HZ0;
  const V = (INK.view = { hz: HZ0, camX: 0, cz: 0, t: 0 });
  INK.quality = 0; // 0 high, 1 medium, 2 low: raised automatically when frames are slow
  INK.sc = (z) => F / z;
  INK.gy = (z) => V.hz + (CAMH * F) / z;
  INK.sx = (x, z) => VX + ((x - V.camX) * F) / z;
  INK.sy = (y, z) => V.hz + ((CAMH - y) * F) / z; // y = height above ground (world units)

  /* ---------------- helpers ---------------- */
  const hex2 = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => {
    t = U.clamp(t, 0, 1); const A = hex2(a), B = hex2(b);
    const r = Math.round(A[0] + (B[0] - A[0]) * t), g = Math.round(A[1] + (B[1] - A[1]) * t), bl = Math.round(A[2] + (B[2] - A[2]) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  };
  INK.mix = mix;
  function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------------- stage definitions ---------------- */
  INK.STAGES = [
    {
      id: 'street', name: 'Squeaky Street', tag: 'The whole street has gone grey!', stops: [6, 24, 42, 60],
      pairs: [['#FF3EA5', '#B8F03A'], ['#FF8A1F', '#2F9BFF']],
      pal: { skyT: '#B4B9D0', skyB: '#E6E8F4', skyTV: '#3FA9FF', skyBV: '#CDEFFF', outer: '#9EA2B4', outerV: '#8EDB6A', road: '#80849A', roadV: '#5C5F78', side: '#B7BACB', sideV: '#E9E6F5', far: '#A9AEC6', farV: '#8FA2E6', near: '#9499B4', nearV: '#6F7FD6' },
      dull: ['#B9BCCB', '#C6C0CF', '#AEB7C4', '#BFC4C0'],
    },
    {
      id: 'harbour', name: 'Sunny Harbour', tag: 'The docks are drowning in grey goo!', stops: [6, 24, 42, 60],
      pairs: [['#FFB11F', '#FF3EA5'], ['#8A5CFF', '#B8F03A']],
      pal: { skyT: '#B3BDCC', skyB: '#E4E9F0', skyTV: '#2FA8F5', skyBV: '#D5F5FF', outer: '#8896AC', outerV: '#1FB3E6', road: '#9C928C', roadV: '#B97C46', side: '#B2A9A3', sideV: '#E5B77C', far: '#A0AABD', farV: '#4DB6C9', near: '#8E98AC', nearV: '#2E8FA8' },
      dull: ['#B5B9C4', '#C2BCC0', '#A9B3BE', '#BDC1B8'],
    },
    {
      id: 'skate', name: 'Skate Plaza', tag: 'Shred it back to colour!', stops: [6, 24, 42, 60],
      pairs: [['#B8F03A', '#7B5CFF'], ['#FF4F5A', '#18C1C9']],
      pal: { skyT: '#BCB9CC', skyB: '#ECE8F2', skyTV: '#FFAA3D', skyBV: '#FFF0C4', outer: '#9AA39A', outerV: '#62C46C', road: '#8F8EA0', roadV: '#B9B4D6', side: '#B5B4C4', sideV: '#E2DFF0', far: '#AFA9C6', farV: '#E58E4C', near: '#9A94B4', nearV: '#C9684A' },
      dull: ['#B6B4C6', '#C4BFC8', '#ABB4B8', '#BEC2B8'],
    },
    {
      id: 'roof', name: 'Rooftop Garden', tag: 'Even the plants are grumpy up here!', stops: [6, 24, 42, 60, 78],
      pairs: [['#2FE0C8', '#FF3EA5'], ['#FFD21F', '#7B5CFF']],
      pal: { skyT: '#B9B4CB', skyB: '#E8E3EC', skyTV: '#FF7BA8', skyBV: '#FFE0A6', outer: '#807F96', outerV: '#4B3F8E', road: '#8C8AA0', roadV: '#7F6BC4', side: '#B0AEC0', sideV: '#E8DDF5', far: '#9C98B4', farV: '#C25A8E', near: '#847FA0', nearV: '#8C3F86' },
      dull: ['#B8B4C8', '#C3BDCB', '#ADB6BE', '#BCC2BA'],
    },
  ];

  /* ---------------- stage build ---------------- */
  const TPU = 48, TEXW = 14 * TPU; // paint texture: 32 px per world unit, 14 units wide
  INK.TPU = TPU;
  INK.buildStage = function (si, team) {
    const def = INK.STAGES[si], pair = def.pairs[team] || def.pairs[0];
    const rng = mulberry(1000 + si * 77);
    const R = (a, b) => a + rng() * (b - a);
    const len = def.stops[def.stops.length - 1] + 58;
    const WS = { si, def, pair, team, len, props: [], t: 0, amtQ: -1 };
    // paint texture (transparent, painted into as splats land)
    WS.texH = Math.ceil(len * TPU);
    WS.tex = document.createElement('canvas'); WS.tex.width = TEXW; WS.tex.height = WS.texH; WS.tctx = WS.tex.getContext('2d');
    // coverage cells (1 unit)
    WS.gz = Math.ceil(len); WS.valid = new Uint8Array(14 * WS.gz); WS.got = new Uint8Array(14 * WS.gz); WS.validN = 0; WS.paintedN = 0;
    for (const s of def.stops) for (let gz = Math.floor(s + 3); gz < s + 34 && gz < WS.gz; gz++) for (let gx = 1; gx < 13; gx++) { const i = gz * 14 + gx; if (!WS.valid[i]) { WS.valid[i] = 1; WS.validN++; } }
    // vivid palette of the team: colours the props turn into
    const pv = [pair[0], pair[1], U.shade(pair[0], 0.28), U.shade(pair[1], -0.12)];
    WS.vivid = pv;
    const vivid2 = [U.shade(pair[1], 0.25), U.shade(pair[0], -0.2), pair[1], pair[0]];
    let id = 0;
    const add = (kind, x, wz, w, h, o = {}) => {
      const ci = Math.floor(rng() * 4);
      const p = Object.assign({ id: id++, kind, x, wz, w, h, ci, seed: rng() * 100, spots: [], n: 0, amt: 0, fill: def.dull[ci], fill2: mix(def.dull[(ci + 1) % 4], '#ffffff', 0.15), vivid: pv[ci], vivid2: vivid2[ci], paintable: true, range: false }, o);
      WS.props.push(p); return p;
    };
    const kindsFor = {
      street: { A: ['shop', 'shop', 'shop', 'tower'], furn: ['lamp', 'tree', 'bin', 'bench', 'tree'], B: ['tower', 'shop', 'tower'], C: ['tower', 'tower', 'tower', 'shop'] },
      harbour: { A: ['crate', 'warehouse', 'crate', 'crate'], furn: ['lamp', 'bollard', 'barrel', 'bollard', 'barrel'], B: ['boat', 'boat', 'crane', 'boat'], C: ['boat', 'boat', 'warehouse', 'crane'] },
      skate: { A: ['gwall', 'ramp', 'ramp', 'gwall'], furn: ['funbox', 'rail', 'lamp', 'flag', 'tree'], B: ['tree', 'tower', 'ramp', 'tree'], C: ['tower', 'tower', 'tree', 'tower'] },
      roof: { A: ['parapet'], furn: ['planter', 'tree', 'utable', 'lights', 'planter'], B: ['greenhouse', 'tank', 'planter', 'tree', 'chimney', 'greenhouse'], C: ['tower', 'tower', 'tower', 'tank'] },
    }[def.id];
    const dimOf = (k) => {
      switch (k) {
        case 'shop': return [R(5.5, 8), R(6.5, 10)];
        case 'tower': return [R(5, 8), R(11, 22)];
        case 'lamp': return [0.7, 4.8]; case 'tree': return [R(3.4, 5), R(4.6, 6.8)]; case 'bin': return [0.95, 1.1]; case 'bench': return [2.3, 1.1];
        case 'crate': { const n = 1 + Math.floor(rng() * 3); return [5.8, 2.4 * n, n]; }
        case 'warehouse': return [R(9, 12), R(5, 7)]; case 'crane': return [R(7, 9), R(15, 21)]; case 'boat': return [R(6, 9), R(4, 6)];
        case 'barrel': return [1.1, 1.3]; case 'bollard': return [0.7, 1];
        case 'ramp': return [R(6, 9), R(3, 4.6)]; case 'funbox': return [R(4.5, 6), 1.7]; case 'rail': return [4, 1.2];
        case 'gwall': return [R(8, 12), R(4, 5.6)]; case 'flag': return [2.2, 6.4];
        case 'planter': return [R(3, 5), 1.9]; case 'greenhouse': return [R(6, 8), 4.6]; case 'tank': return [3.2, 7]; case 'chimney': return [1.7, 5.4];
        case 'parapet': return [6.2, 1.2]; case 'utable': return [2.4, 2.5]; case 'lights': return [0.6, 4.4];
      } return [3, 3];
    };
    const pickK = (arr) => arr[Math.floor(rng() * arr.length)];
    const hasWater = def.id === 'harbour';
    const side = (s) => s; // -1 / +1
    for (const s of [-1, 1]) {
      // row A: just behind the sidewalk
      let z = R(-2, 3) + (s > 0 ? 0 : 3);
      while (z < len) {
        const k = pickK(kindsFor.A), d = dimOf(k);
        const inner = def.id === 'roof' ? 7.4 : 7.8;
        const p = add(k, s * (inner + d[0] / 2), z + d[0] / 2, d[0], d[1], d[2] ? { n2: d[2] } : {});
        if (k === 'parapet') p.paintable = true;
        z += d[0] * (def.id === 'roof' ? 0.98 : R(0.95, 1.25)) + (def.id === 'roof' ? 0 : R(0.2, 1.3));
      }
      // furniture on the sidewalk
      z = R(0, 8);
      while (z < len) {
        const k = pickK(kindsFor.furn), d = dimOf(k);
        const xin = R(5.4, 6.6);
        add(k, s * xin, z, d[0], d[1], { paintable: k !== 'lamp' && k !== 'lights' });
        z += R(6, 12);
      }
      // row B: second row
      z = R(0, 6);
      while (z < len) {
        const k = pickK(kindsFor.B), d = dimOf(k);
        const water = hasWater && (k === 'boat');
        const x = water ? s * R(11.5, 22) : s * (R(def.id === 'roof' ? 15 : 14, def.id === 'roof' ? 24 : 24) + d[0] / 2);
        add(k, x, z, d[0], d[1], { bob: water ? R(0, 6) : 0 });
        z += d[0] * R(0.9, 1.3) + R(1, 4);
      }
      // row C: far / ultrawide fill
      z = R(0, 8);
      while (z < len + 40) {
        const k = pickK(kindsFor.C), d = dimOf(k);
        const x = s * (R(30, 56) + d[0] / 2);
        add(k, x, z, d[0] * R(1, 1.3), d[1] * R(1, 1.25), { paintable: false, bob: k === 'boat' ? R(0, 6) : 0 });
        z += d[0] * R(0.8, 1.2) + R(2, 7);
      }
    }
    // pre-compute which props count for coverage
    for (const p of WS.props) if (p.paintable && Math.abs(p.x) < 26 && p.kind !== 'lamp') { for (const s of def.stops) if (p.wz > s + 4 && p.wz < s + 38) { p.range = true; break; } }
    WS.propN = WS.props.filter((p) => p.range).length;
    // skyline layers (screen space, tiled)
    WS.sky = [];
    const mkLayer = (n, wmin, wmax, hmin, hmax, kind) => { const items = []; let x = 0; for (let i = 0; i < n; i++) { const w = R(wmin, wmax); items.push({ x, w, h: R(hmin, hmax), ci: Math.floor(rng() * 3), a: rng() }); x += w * R(0.85, 1.05); } return { items, period: x, kind }; };
    if (def.id === 'harbour') { WS.sky.push(mkLayer(12, 300, 600, 60, 150, 'hills'), mkLayer(30, 70, 150, 40, 130, 'towers')); }
    else if (def.id === 'skate') { WS.sky.push(mkLayer(12, 320, 640, 70, 170, 'hills'), mkLayer(30, 80, 170, 60, 250, 'towers')); }
    else if (def.id === 'roof') { WS.sky.push(mkLayer(34, 70, 150, 90, 330, 'towers'), mkLayer(30, 90, 200, 60, 220, 'towers')); }
    else { WS.sky.push(mkLayer(34, 70, 150, 90, 300, 'towers'), mkLayer(26, 100, 200, 70, 190, 'towers')); }
    WS.clouds = []; for (let i = 0; i < 7; i++) WS.clouds.push({ x: R(0, 2400), y: R(40, 260), s: R(70, 150), v: R(4, 12) });
    WS.waves = []; for (let i = 0; i < 140; i++) WS.waves.push({ x: (rng() < 0.5 ? -1 : 1) * R(7.8, 60), wz: R(0, len + 40), w: R(0.8, 2.4), ph: R(0, 6) });
    WS.stars = [];
    return WS;
  };

  /* ---------------- painting ---------------- */
  /* splat onto the ground texture at world (x, wz), radius r (world units) */
  INK.groundSplat = function (WS, x, wz, r, color, k) {
    if (!WS) return;
    const im = INK.splat(k ?? U.pick(INK.SPLATS), color); if (!im) return;
    const px = (x + 7) * TPU, py = wz * TPU, sz = r * 2 * TPU;
    if (py < -sz || py > WS.texH + sz) return;
    const c = WS.tctx; c.save(); c.translate(px, py); c.rotate(U.rand(0, 6.28)); c.drawImage(im, -sz / 2, -sz / 2, sz, sz); c.restore();
    // coverage cells
    const gx0 = Math.max(0, Math.floor(x + 7 - r)), gx1 = Math.min(13, Math.ceil(x + 7 + r)), gz0 = Math.max(0, Math.floor(wz - r)), gz1 = Math.min(WS.gz - 1, Math.ceil(wz + r));
    for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
      const dx = gx + 0.5 - (x + 7), dz = gz + 0.5 - wz;
      if (dx * dx + dz * dz <= r * r * 0.8) { const i = gz * 14 + gx; if (WS.valid[i] && !WS.got[i]) { WS.got[i] = 1; WS.paintedN++; } }
    }
  };
  INK.coverage = function (WS) {
    if (!WS) return 0;
    let pp = 0; for (const p of WS.props) if (p.range && p.n >= 2) pp++;
    const g = WS.validN ? WS.paintedN / WS.validN : 0, pr = WS.propN ? pp / WS.propN : 0;
    return U.clamp((g * 0.62 + pr * 0.38) / 0.82, 0, 1);
  };
  /* splat on a prop (prop-local u,v in 0..1 of its bounding box) */
  INK.paintProp = function (WS, p, color, n = 1) {
    for (let i = 0; i < n; i++) {
      const r = Math.max(0.7, Math.min(p.w, p.h) * U.rand(0.3, 0.55));
      p.spots.push({ u: U.rand(0.1, 0.9), v: U.rand(0.1, 0.9), r, k: U.pick(INK.SPLAT_ROUND), col: color, rot: U.rand(0, 6.28) });
      if (p.spots.length > 9) p.spots.shift();
      p.n++;
    }
    p.amt = Math.min(1, p.n / 3); p.cache = null;
    p.fill = mix(WS.def.dull[p.ci], p.vivid, p.amt); p.fill2 = mix(mix(WS.def.dull[(p.ci + 1) % 4], '#ffffff', 0.15), p.vivid2, p.amt);
  };
  /* paint props near a depth (relative to camera), returns count painted */
  INK.paintNear = function (WS, cz, zRel, spread, colors, n, sideBias) {
    const cand = [];
    for (const p of WS.props) {
      if (!p.paintable || p.kind === 'lamp') continue;
      const z = p.wz - cz; if (z < 5 || z > 60 || Math.abs(z - zRel) > spread || Math.abs(p.x) > 30) continue;
      if (sideBias && Math.sign(p.x) !== sideBias && Math.random() < 0.6) continue;
      cand.push(p);
    }
    U.shuffle(cand);
    for (let i = 0; i < Math.min(n, cand.length); i++) INK.paintProp(WS, cand[i], U.pick(colors), 1);
    return Math.min(n, cand.length);
  };
  INK.paintAllVisible = function (WS, cz, colors, zMax = 55) {
    for (const p of WS.props) { const z = p.wz - cz; if (!p.paintable || z < 3 || z > zMax) continue; if (p.n < 3) INK.paintProp(WS, p, U.pick(colors), 3 - p.n + 1); }
  };

  /* ---------------- sky ---------------- */
  function drawSkyline(ctx, v, WS, layer, li, amt, hz) {
    const pal = WS.def.pal;
    const base = li === 0 ? mix(pal.far, pal.farV, amt) : mix(pal.near, pal.nearV, amt);
    const hi = U.shade(base, 0.22);
    const L = v.x - 200, Rr = v.x + v.w + 200;
    const start = Math.floor(L / layer.period) * layer.period;
    ctx.fillStyle = base;
    for (let base0 = start; base0 < Rr; base0 += layer.period) {
      for (const it of layer.items) {
        const x = base0 + it.x; if (x > Rr || x + it.w < L) continue;
        if (layer.kind === 'hills') {
          ctx.beginPath(); ctx.moveTo(x - it.w * 0.3, hz + 4); ctx.quadraticCurveTo(x + it.w * 0.5, hz - it.h * 1.7, x + it.w * 1.3, hz + 4); ctx.fill();
        } else {
          ctx.fillRect(x, hz - it.h, it.w, it.h + 4);
          if (it.w > 60) { ctx.fillStyle = hi; const cols = Math.floor(it.w / 26); for (let r = 0; r < it.h / 38 - 0.4; r++) for (let c = 0; c < cols; c++) if (((r * 7 + c * 3 + (it.a * 10 | 0)) % 3) === 0) ctx.fillRect(x + 8 + c * 26, hz - it.h + 16 + r * 38, 12, 16); ctx.fillStyle = base; }
        }
      }
    }
  }
  const SUNX = 1520, SUNY = 175;
  function bakeSky(v, WS, amt) {
    const pal = WS.def.pal, hz = HZ0, h = Math.ceil(hz - v.y + 14), w = Math.ceil(v.w + 4);
    if (!WS.skyCv) WS.skyCv = document.createElement('canvas');
    const cv = WS.skyCv; cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); ctx.translate(-(v.x - 2), -v.y);
    const gr = ctx.createLinearGradient(0, v.y, 0, hz);
    gr.addColorStop(0, mix(pal.skyT, pal.skyTV, amt)); gr.addColorStop(1, mix(pal.skyB, pal.skyBV, amt));
    ctx.fillStyle = gr; ctx.fillRect(v.x - 2, v.y - 2, v.w + 8, hz - v.y + 16);
    const wake = amt > 0.45;
    ctx.save(); ctx.translate(SUNX, SUNY);
    ctx.globalAlpha = 0.5 + amt * 0.3; ctx.fillStyle = wake ? '#FFF1A8' : '#F1F1F8'; ctx.beginPath(); ctx.arc(0, 0, 118, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    D.sticker(ctx, P.circle(0, 0, 76), wake ? '#FFD84A' : '#E4E4EE', { x: -76, y: -76, w: 152, h: 152 });
    D.eyes(ctx, 0, -6, 9, wake ? 'happy' : 'sleepy', 0, 0, 1.7); D.mouth(ctx, 0, 26, 14, wake ? 'smile' : 'flat'); if (wake) D.cheeks(ctx, 0, -6, 9, 1.5);
    ctx.restore();
    drawSkyline(ctx, v, WS, WS.sky[0], 0, amt, hz);
    drawSkyline(ctx, v, WS, WS.sky[1], 1, amt, hz);
    WS.skyKey = [Math.round(amt * 16), Math.round(v.w), Math.round(v.y), Math.round(v.x)].join('|');
    WS.skyV = { x: v.x - 2, y: v.y };
  }
  INK.drawSky = function (ctx, v, WS, amt, t) {
    const key = [Math.round(amt * 16), Math.round(v.w), Math.round(v.y), Math.round(v.x)].join('|');
    if (WS.skyKey !== key) bakeSky(v, WS, Math.round(amt * 16) / 16);
    ctx.drawImage(WS.skyCv, WS.skyV.x, WS.skyV.y + (V.hz - HZ0));
    const wake = amt > 0.45;
    if (wake) { ctx.save(); ctx.translate(SUNX, SUNY + (V.hz - HZ0)); ctx.strokeStyle = '#FFD84A'; ctx.lineWidth = 12; ctx.lineCap = 'round'; for (let i = 0; i < 10; i++) { const a = i * 0.628 + t * 0.2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 98, Math.sin(a) * 98); ctx.lineTo(Math.cos(a) * 124, Math.sin(a) * 124); ctx.stroke(); } ctx.restore(); }
    const span = v.w + 700, hz = V.hz;
    for (const c of WS.clouds) { const x = ((c.x + t * c.v) % span) + v.x - 300; D.cloud(ctx, x, hz - 200 - c.y * 0.7, c.s, '#ffffff', 0.55 + amt * 0.35); }
  };

  /* ---------------- ground ---------------- */
  function strip(ctx, c, x0, z0, x1, z1) { // quad on the ground between lateral x0..x1 and depth z0(near)..z1(far)
    ctx.beginPath(); ctx.moveTo(INK.sx(x0, z0), INK.gy(z0)); ctx.lineTo(INK.sx(x1, z0), INK.gy(z0)); ctx.lineTo(INK.sx(x1, z1), INK.gy(z1)); ctx.lineTo(INK.sx(x0, z1), INK.gy(z1)); ctx.closePath(); ctx.fill();
  }
  INK.drawGround = function (ctx, v, WS, amt, cz, t) {
    const pal = WS.def.pal, hz = V.hz, bot = v.y + v.h + 2, L = v.x - 2, Rr = v.x + v.w + 2, id = WS.def.id;
    // outer ground (grass / water / city below)
    ctx.fillStyle = mix(pal.outer, pal.outerV, amt); ctx.fillRect(L, hz - 1, Rr - L, bot - hz + 1);
    const zb = Math.max(0.55, (CAMH * F) / (bot - hz)), zf = 330;
    if (id === 'harbour') { // wave sparkles on the water
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineCap = 'round';
      for (const w of WS.waves) {
        const z = w.wz - cz; if (z < 3 || z > 80) continue; const sc = F / z; ctx.lineWidth = Math.max(1, 0.16 * sc);
        const x = INK.sx(w.x + Math.sin(t * 0.8 + w.ph) * 0.4, z), y = INK.gy(z); ctx.globalAlpha = (0.25 + 0.4 * amt) * Math.min(1, (80 - z) / 30);
        ctx.beginPath(); ctx.moveTo(x - w.w * sc * 0.5, y); ctx.lineTo(x + w.w * sc * 0.5, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (id === 'street' || id === 'skate') { // grassy tufts / patches: simple checker bands on the outer ground
      ctx.fillStyle = 'rgba(31,26,61,0.045)';
      for (let wz = Math.floor(cz / 4) * 4; wz < cz + 90; wz += 8) { const z0 = wz - cz, z1 = z0 + 4; if (z0 < zb) continue; strip(ctx, null, -300, z0, 300, z1); }
    }
    // sidewalk and road
    ctx.fillStyle = mix(pal.side, pal.sideV, amt); strip(ctx, null, -7.2, zb, 7.2, zf);
    ctx.fillStyle = mix(pal.road, pal.roadV, amt); strip(ctx, null, -4.6, zb, 4.6, zf);
    // curbs
    ctx.fillStyle = 'rgba(31,26,61,0.35)'; strip(ctx, null, -4.72, zb, -4.5, zf); strip(ctx, null, 4.5, zb, 4.72, zf);
    ctx.fillStyle = 'rgba(31,26,61,0.18)'; strip(ctx, null, -7.3, zb, -7.15, zf); strip(ctx, null, 7.15, zb, 7.3, zf);
    // markings
    if (id === 'harbour') { // wooden planks
      ctx.strokeStyle = 'rgba(31,26,61,0.22)';
      for (let wz = Math.floor(cz); wz < cz + 80; wz += 1) { const z = wz - cz; if (z < zb) continue; const sc = F / z; ctx.lineWidth = Math.max(0.6, 0.05 * sc); const y = INK.gy(z); ctx.beginPath(); ctx.moveTo(INK.sx(-7.2, z), y); ctx.lineTo(INK.sx(7.2, z), y); ctx.stroke(); }
    } else if (id === 'roof') { // garden-path tiles
      ctx.strokeStyle = 'rgba(31,26,61,0.2)';
      for (let wz = Math.floor(cz / 2) * 2; wz < cz + 80; wz += 2) { const z = wz - cz; if (z < zb) continue; const sc = F / z; ctx.lineWidth = Math.max(0.6, 0.06 * sc); const y = INK.gy(z); ctx.beginPath(); ctx.moveTo(INK.sx(-7.2, z), y); ctx.lineTo(INK.sx(7.2, z), y); ctx.stroke(); }
      for (const x of [-3, 0, 3]) { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(INK.sx(x, zb), INK.gy(zb)); ctx.lineTo(INK.sx(x, zf), INK.gy(zf)); ctx.stroke(); }
    } else if (id === 'skate') {
      ctx.strokeStyle = 'rgba(31,26,61,0.2)';
      for (let wz = Math.floor(cz / 3) * 3; wz < cz + 80; wz += 3) { const z = wz - cz; if (z < zb) continue; const sc = F / z; ctx.lineWidth = Math.max(0.6, 0.05 * sc); const y = INK.gy(z); ctx.beginPath(); ctx.moveTo(INK.sx(-4.6, z), y); ctx.lineTo(INK.sx(4.6, z), y); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let wz = Math.floor(cz / 6) * 6; wz < cz + 90; wz += 6) { const z0 = wz - cz, z1 = z0 + 2.4; if (z0 < zb) continue; strip(ctx, null, -0.1, z0, 0.1, z1); }
    } else { // street dashes + sidewalk slabs
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let wz = Math.floor(cz / 5) * 5; wz < cz + 90; wz += 5) { const z0 = wz - cz, z1 = z0 + 2.2; if (z0 < zb) continue; strip(ctx, null, -0.14, z0, 0.14, z1); }
      ctx.strokeStyle = 'rgba(31,26,61,0.16)';
      for (let wz = Math.floor(cz / 2) * 2; wz < cz + 60; wz += 2) { const z = wz - cz; if (z < zb) continue; const sc = F / z; ctx.lineWidth = Math.max(0.6, 0.04 * sc); const y = INK.gy(z); ctx.beginPath(); ctx.moveTo(INK.sx(-7.2, z), y); ctx.lineTo(INK.sx(-4.7, z), y); ctx.moveTo(INK.sx(4.7, z), y); ctx.lineTo(INK.sx(7.2, z), y); ctx.stroke(); }
    }
    // the paint layer, perspective-mapped strip by strip
    const tex = WS.tex, th = WS.texH, zMax = 52, zMin = Math.max(zb, 1.3);
    const yTop = Math.ceil(hz + (CAMH * F) / zMax), yBot = Math.min(bot, hz + (CAMH * F) / zMin);
    ctx.imageSmoothingEnabled = true;
    for (let y = yTop; y < yBot; ) {
      const step = (y > hz + 160 ? 2 : 3) + INK.quality;
      const z0 = (CAMH * F) / (y - hz), z1 = (CAMH * F) / (y + step - hz);
      let sy = (cz + z1) * TPU, sh = (z0 - z1) * TPU;
      if (sy < 0) { sh += sy; sy = 0; } if (sy + sh > th) sh = th - sy;
      if (sh > 0.3) {
        const zm = (z0 + z1) / 2, sc = F / zm;
        ctx.drawImage(tex, 0, sy, TEXW, sh, VX + (-7 - V.camX) * sc, y, 14 * sc, step + 0.6);
      }
      y += step;
    }
    // haze at the horizon
    if (INK.quality >= 2) return;
    const hg = ctx.createLinearGradient(0, hz - 6, 0, hz + 120);
    const hc = mix(pal.skyB, pal.skyBV, amt);
    hg.addColorStop(0, hc); hg.addColorStop(1, hc + '00');
    ctx.fillStyle = hg; ctx.fillRect(L, hz - 6, Rr - L, 126);
  };

  /* ---------------- props ---------------- */
  // shared drawing bits (world units, y up = negative)
  function body(ctx, p, c, path, bx, by, bw, bh, fill) {
    ctx.fillStyle = fill; ctx.fill(path);
    ctx.save(); ctx.clip(path);
    ctx.fillStyle = 'rgba(31,26,61,0.12)'; ctx.fillRect(bx, by + bh * 0.72, bw, bh * 0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(bx + bw * 0.06, by + bh * 0.03, bw * 0.1, bh * 0.94);
    for (const s of p.spots) {
      const im = INK.splat(s.k, s.col); if (!im) continue;
      ctx.save(); ctx.translate(bx + s.u * bw, by + s.v * bh); ctx.rotate(s.rot); ctx.drawImage(im, -s.r, -s.r, s.r * 2, s.r * 2); ctx.restore();
    }
    ctx.restore();
    ctx.lineWidth = c.lw; ctx.lineJoin = 'round'; ctx.strokeStyle = INKC; ctx.stroke(path);
  }
  const rr = (x, y, w, h, r) => P.rr(x, y, w, h, Math.min(r, w / 2, h / 2));
  function box(ctx, p, c, x, y, w, h, r, fill) { body(ctx, p, c, rr(x, y, w, h, r), x, y, w, h, fill || c.fill); }
  function plain(ctx, c, path, fill, lw) { ctx.fillStyle = fill; ctx.fill(path); ctx.lineWidth = lw || c.lw; ctx.lineJoin = 'round'; ctx.strokeStyle = INKC; ctx.stroke(path); }
  function windows(ctx, c, x, y, w, h, cols, rows, ww, wh, lit) {
    const gx = (w - cols * ww) / (cols + 1), gy = (h - rows * wh) / (rows + 1);
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const wx = x + gx + q * (ww + gx), wy = y + gy + r * (wh + gy);
      ctx.fillStyle = lit && ((r * 5 + q * 3) % 4 !== 0) ? '#FFF1A8' : '#DCE1F2'; ctx.fill(rr(wx, wy, ww, wh, ww * 0.25));
      if (!c.far) { ctx.lineWidth = c.lw * 0.6; ctx.strokeStyle = INKC; ctx.stroke(rr(wx, wy, ww, wh, ww * 0.25)); }
    }
  }
  const K = {};
  K.shop = (ctx, p, c) => {
    const w = p.w, h = p.h; box(ctx, p, c, -w / 2, -h, w, h, 0.25);
    ctx.fillStyle = INKC; ctx.fillRect(-w / 2 - 0.15, -h - 0.18, w + 0.3, 0.45);
    const floors = Math.max(1, Math.floor((h - 3) / 2.6));
    if (!c.far) windows(ctx, c, -w / 2, -h + 0.3, w, h - 3.4, Math.max(2, Math.floor(w / 2.2)), floors, 1, 1.35, p.amt > 0.5);
    // awning
    const ay = -3.1, n = Math.max(4, Math.round(w / 1.1) & ~1), sw = (w + 0.5) / n;
    for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? c.fill2 : '#fff'; ctx.beginPath(); ctx.moveTo(-w / 2 - 0.25 + i * sw, ay); ctx.lineTo(-w / 2 - 0.25 + (i + 1) * sw, ay); ctx.lineTo(-w / 2 - 0.45 + (i + 1) * sw, ay + 0.85); ctx.lineTo(-w / 2 - 0.45 + i * sw, ay + 0.85); ctx.fill(); }
    ctx.lineWidth = c.lw; ctx.strokeStyle = INKC; ctx.beginPath(); ctx.moveTo(-w / 2 - 0.25, ay); ctx.lineTo(w / 2 + 0.25, ay); ctx.lineTo(w / 2 + 0.05, ay + 0.85); ctx.lineTo(-w / 2 - 0.45, ay + 0.85); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#6E6A8A'; ctx.fill(rr(-0.7, -2.1, 1.4, 2.1, 0.2)); ctx.stroke(rr(-0.7, -2.1, 1.4, 2.1, 0.2));
    ctx.fillStyle = '#DCE1F2'; ctx.fill(rr(-w / 2 + 0.5, -2.0, Math.max(1, w / 2 - 1.5), 1.4, 0.2)); ctx.fill(rr(0.9, -2.0, Math.max(1, w / 2 - 1.5), 1.4, 0.2));
  };
  K.tower = (ctx, p, c) => {
    const w = p.w, h = p.h; box(ctx, p, c, -w / 2, -h, w, h, 0.2);
    ctx.fillStyle = INKC; ctx.fillRect(-w / 2 - 0.15, -h - 0.15, w + 0.3, 0.4);
    if (!c.far) windows(ctx, c, -w / 2, -h + 0.4, w, h - 1.2, Math.max(2, Math.floor(w / 1.8)), Math.floor((h - 1) / 2.3), 0.85, 1.2, p.amt > 0.5);
    ctx.lineWidth = c.lw; ctx.strokeStyle = INKC; ctx.beginPath(); ctx.moveTo(w * 0.25, -h - 0.15); ctx.lineTo(w * 0.25, -h - 1.8); ctx.stroke();
    ctx.fillStyle = p.amt > 0.4 ? '#FF5A5F' : '#B0B0C4'; ctx.beginPath(); ctx.arc(w * 0.25, -h - 1.9, 0.28, 0, 7); ctx.fill();
  };
  K.lamp = (ctx, p, c) => {
    ctx.lineCap = 'round'; ctx.strokeStyle = INKC; ctx.lineWidth = Math.max(c.lw * 2.4, 0.3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -4.4); ctx.stroke();
    ctx.lineWidth = Math.max(c.lw * 2.4, 0.3); ctx.beginPath(); ctx.moveTo(0, -4.4); ctx.lineTo(p.x > 0 ? -0.9 : 0.9, -4.7); ctx.stroke();
    ctx.strokeStyle = p.amt > 0.5 ? p.vivid : '#9A9BB0'; ctx.lineWidth = Math.max(c.lw * 1.2, 0.16); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -4.4); ctx.stroke();
    const hx = p.x > 0 ? -0.95 : 0.95; ctx.fillStyle = p.amt > 0.3 || p.n > 0 ? '#FFF1A8' : '#D8DAE8'; ctx.beginPath(); ctx.ellipse(hx, -4.7, 0.5, 0.28, 0, 0, 7); ctx.fill(); ctx.lineWidth = c.lw; ctx.strokeStyle = INKC; ctx.stroke();
  };
  K.tree = (ctx, p, c) => {
    const h = p.h, w = p.w;
    ctx.fillStyle = '#8D7A70'; ctx.fillRect(-0.22, -h * 0.5, 0.44, h * 0.5); ctx.lineWidth = c.lw; ctx.strokeStyle = INKC; ctx.strokeRect(-0.22, -h * 0.5, 0.44, h * 0.5);
    const path = P.blob(0, -h * 0.68, w * 0.5, p.seed, 0.12, 9);
    const green = mix('#B4BDB6', '#58C85A', p.amt);
    body(ctx, p, c, path, -w * 0.55, -h * 0.68 - w * 0.55, w * 1.1, w * 1.1, green);
  };
  K.bin = (ctx, p, c) => { box(ctx, p, c, -0.45, -1.1, 0.9, 1.1, 0.2); ctx.fillStyle = INKC; ctx.fillRect(-0.55, -1.2, 1.1, 0.18); };
  K.bench = (ctx, p, c) => { box(ctx, p, c, -1.15, -0.55, 2.3, 0.28, 0.1); box(ctx, p, c, -1.1, -1.15, 2.2, 0.4, 0.1, c.fill2); ctx.fillStyle = INKC; ctx.fillRect(-0.95, -0.28, 0.14, 0.28); ctx.fillRect(0.81, -0.28, 0.14, 0.28); };
  K.crate = (ctx, p, c) => {
    const n = p.n2 || 1, cols = [c.fill, c.fill2, mix(c.fill, '#ffffff', 0.3)];
    for (let i = 0; i < n; i++) {
      const y = -2.4 * (i + 1), fill = cols[i % 3]; box(ctx, p, c, -2.9, y, 5.8, 2.4, 0.12, fill);
      if (!c.far) { ctx.strokeStyle = 'rgba(31,26,61,0.35)'; ctx.lineWidth = c.lw * 0.7; for (let k = -2.3; k < 2.9; k += 0.7) { ctx.beginPath(); ctx.moveTo(k, y + 0.2); ctx.lineTo(k, y + 2.2); ctx.stroke(); } }
    }
  };
  K.warehouse = (ctx, p, c) => {
    const w = p.w, h = p.h; const path = new Path2D(); path.moveTo(-w / 2, 0); path.lineTo(-w / 2, -h); path.lineTo(0, -h - 1.8); path.lineTo(w / 2, -h); path.lineTo(w / 2, 0); path.closePath();
    body(ctx, p, c, path, -w / 2, -h - 1.8, w, h + 1.8, c.fill);
    ctx.fillStyle = c.fill2; ctx.fill(rr(-w * 0.2, -h * 0.7, w * 0.4, h * 0.7, 0.2)); ctx.lineWidth = c.lw; ctx.strokeStyle = INKC; ctx.stroke(rr(-w * 0.2, -h * 0.7, w * 0.4, h * 0.7, 0.2));
    if (!c.far) { ctx.strokeStyle = 'rgba(31,26,61,0.4)'; for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 0.7 + k * h * 0.14); ctx.lineTo(w * 0.2, -h * 0.7 + k * h * 0.14); ctx.stroke(); } }
  };
  K.crane = (ctx, p, c) => {
    const h = p.h, w = p.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const col = p.amt > 0.4 ? p.vivid : '#B6B8CA', lw = Math.max(c.lw * 3, 0.32);
    const seg = (x0, y0, x1, y1, col2, wd) => { ctx.strokeStyle = INKC; ctx.lineWidth = wd + c.lw * 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.strokeStyle = col2; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
    seg(-1.2, 0, -0.5, -h, col, lw); seg(1.2, 0, 0.5, -h, col, lw); seg(-0.9, -h * 0.35, 0.9, -h * 0.35, col, lw * 0.6); seg(-0.7, -h * 0.65, 0.7, -h * 0.65, col, lw * 0.6);
    seg(-w * 0.55, -h, w * 0.5, -h, col, lw * 1.2); seg(w * 0.5, -h, w * 0.5, -h + 3.5, '#9EA0B4', lw * 0.35);
    ctx.fillStyle = '#FFD84A'; ctx.fill(rr(w * 0.5 - 0.7, -h + 3.4, 1.4, 1.0, 0.2)); ctx.lineWidth = c.lw; ctx.strokeStyle = INKC; ctx.stroke(rr(w * 0.5 - 0.7, -h + 3.4, 1.4, 1.0, 0.2));
  };
  K.boat = (ctx, p, c) => {
    const w = p.w, h = p.h, b = c.baking ? 0 : Math.sin(V.t * 1.3 + p.bob) * 0.18; ctx.translate(0, b);
    const hull = new Path2D(); hull.moveTo(-w / 2, -h * 0.35); hull.lineTo(w / 2, -h * 0.35); hull.quadraticCurveTo(w * 0.42, 0.1, w * 0.25, 0.1); hull.lineTo(-w * 0.28, 0.1); hull.quadraticCurveTo(-w * 0.44, 0.1, -w / 2, -h * 0.35); hull.closePath();
    body(ctx, p, c, hull, -w / 2, -h * 0.35, w, h * 0.45, c.fill);
    box(ctx, p, c, -w * 0.18, -h * 0.7, w * 0.36, h * 0.36, 0.2, '#fff');
    ctx.fillStyle = '#5A5780'; ctx.fillRect(-w * 0.14, -h * 0.64, w * 0.1, h * 0.14); ctx.fillRect(w * 0.04, -h * 0.64, w * 0.1, h * 0.14);
    ctx.strokeStyle = INKC; ctx.lineWidth = c.lw * 1.5; ctx.beginPath(); ctx.moveTo(w * 0.28, -h * 0.35); ctx.lineTo(w * 0.28, -h); ctx.stroke();
    const sail = new Path2D(); sail.moveTo(w * 0.28, -h); sail.lineTo(w * 0.28, -h * 0.4); sail.lineTo(w * 0.02, -h * 0.4); sail.closePath(); plain(ctx, c, sail, c.fill2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(0, 0.2, w * 0.55, 0.28, 0, 0, 7); ctx.fill();
  };
  K.barrel = (ctx, p, c) => { box(ctx, p, c, -0.55, -1.3, 1.1, 1.3, 0.35); ctx.strokeStyle = INKC; ctx.lineWidth = c.lw; for (const y of [-0.9, -0.4]) { ctx.beginPath(); ctx.moveTo(-0.55, y); ctx.lineTo(0.55, y); ctx.stroke(); } };
  K.bollard = (ctx, p, c) => { box(ctx, p, c, -0.3, -1, 0.6, 1, 0.25); ctx.fillStyle = '#fff'; ctx.fillRect(-0.3, -0.75, 0.6, 0.18); };
  K.ramp = (ctx, p, c) => {
    const w = p.w, h = p.h; const path = new Path2D(); path.moveTo(-w / 2, 0); path.lineTo(w / 2, 0); path.lineTo(w / 2, -h); path.quadraticCurveTo(w * 0.2, -h * 0.12, -w / 2, -h * 0.02); path.closePath();
    body(ctx, p, c, path, -w / 2, -h, w, h, c.fill);
    ctx.strokeStyle = '#9EA0B4'; ctx.lineWidth = Math.max(c.lw * 2.5, 0.2); ctx.beginPath(); ctx.moveTo(w / 2 - 0.1, -h); ctx.lineTo(w / 2 + 0.2, -h); ctx.stroke();
  };
  K.funbox = (ctx, p, c) => {
    const w = p.w, h = p.h; const path = new Path2D(); path.moveTo(-w / 2, 0); path.lineTo(-w * 0.32, -h); path.lineTo(w * 0.32, -h); path.lineTo(w / 2, 0); path.closePath();
    body(ctx, p, c, path, -w / 2, -h, w, h, c.fill);
    ctx.strokeStyle = '#8F90A8'; ctx.lineWidth = Math.max(c.lw * 2, 0.14); ctx.beginPath(); ctx.moveTo(-w * 0.32, -h - 0.05); ctx.lineTo(w * 0.32, -h - 0.05); ctx.stroke();
  };
  K.rail = (ctx, p, c) => {
    ctx.lineCap = 'round'; ctx.strokeStyle = INKC; ctx.lineWidth = Math.max(c.lw * 3, 0.26); ctx.beginPath(); ctx.moveTo(-2, -1.1); ctx.lineTo(2, -1.1); ctx.moveTo(-1.6, -1.1); ctx.lineTo(-1.6, 0); ctx.moveTo(1.6, -1.1); ctx.lineTo(1.6, 0); ctx.stroke();
    ctx.strokeStyle = p.amt > 0.4 ? p.vivid : '#C0C2D4'; ctx.lineWidth = Math.max(c.lw * 1.4, 0.12); ctx.stroke();
  };
  K.gwall = (ctx, p, c) => {
    const w = p.w, h = p.h; box(ctx, p, c, -w / 2, -h, w, h, 0.15);
    ctx.fillStyle = INKC; ctx.fillRect(-w / 2 - 0.1, -h - 0.1, w + 0.2, 0.3);
    if (!c.far) { ctx.fillStyle = 'rgba(31,26,61,0.2)'; for (let i = 0; i < 4; i++) ctx.fill(rr(-w / 2 + 0.7 + i * (w - 1.6) / 4, -h * 0.8 + (i % 2) * h * 0.25, (w - 1.6) / 4 - 0.3, h * 0.28, 0.2)); }
  };
  K.flag = (ctx, p, c) => {
    ctx.strokeStyle = INKC; ctx.lineWidth = Math.max(c.lw * 2.4, 0.22); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -6.2); ctx.stroke();
    const wv = Math.sin(V.t * 3 + p.seed) * 0.25; const path = new Path2D(); path.moveTo(0, -6.1); path.quadraticCurveTo(1.0, -6.1 + wv, 2.2, -5.8); path.lineTo(2.2, -4.4); path.quadraticCurveTo(1.0, -4.7 - wv, 0, -4.6); path.closePath();
    body(ctx, p, c, path, 0, -6.1, 2.2, 1.7, c.fill);
  };
  K.planter = (ctx, p, c) => {
    const w = p.w, green = mix('#A9B8AC', '#47C95A', p.amt);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = green; const bx = -w / 2 + w * (0.15 + i * 0.23), by = -1.9 - Math.sin(p.seed + i) * 0.3; ctx.beginPath(); ctx.arc(bx, by, 0.75, 0, 7); ctx.fill(); ctx.lineWidth = c.lw; ctx.strokeStyle = INKC; ctx.stroke(); if (p.amt > 0.4) { ctx.fillStyle = i % 2 ? p.vivid : p.vivid2; ctx.beginPath(); ctx.arc(bx + 0.25, by - 0.15, 0.25, 0, 7); ctx.fill(); } }
    box(ctx, p, c, -w / 2, -1.3, w, 1.3, 0.2);
  };
  K.greenhouse = (ctx, p, c) => {
    const w = p.w, h = p.h; const path = new Path2D(); path.moveTo(-w / 2, 0); path.lineTo(-w / 2, -h * 0.65); path.lineTo(0, -h); path.lineTo(w / 2, -h * 0.65); path.lineTo(w / 2, 0); path.closePath();
    body(ctx, p, c, path, -w / 2, -h, w, h, mix('#DDE3F2', '#BFEFF8', p.amt));
    ctx.strokeStyle = INKC; ctx.lineWidth = c.lw * 0.7; if (!c.far) { for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-w / 2 + (w * i) / 5, 0); ctx.lineTo(-w / 2 + (w * i) / 5, -h * 0.66); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(-w / 2, -h * 0.33); ctx.lineTo(w / 2, -h * 0.33); ctx.stroke(); }
    ctx.fillStyle = mix('#A9B8AC', '#47C95A', p.amt); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-w * 0.35 + i * w * 0.23, -0.5, 0.6, 0, 7); ctx.fill(); }
  };
  K.tank = (ctx, p, c) => {
    ctx.strokeStyle = INKC; ctx.lineWidth = Math.max(c.lw * 2.4, 0.2); for (const x of [-1.2, 0, 1.2]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x * 0.9, -2.6); ctx.stroke(); }
    box(ctx, p, c, -1.6, -6.4, 3.2, 3.8, 0.8); const cap = new Path2D(); cap.moveTo(-1.8, -6.3); cap.lineTo(0, -7.4); cap.lineTo(1.8, -6.3); cap.closePath(); plain(ctx, c, cap, c.fill2);
  };
  K.chimney = (ctx, p, c) => { box(ctx, p, c, -0.85, -5.4, 1.7, 5.4, 0.15); ctx.fillStyle = INKC; ctx.fillRect(-1.05, -5.6, 2.1, 0.5); };
  K.parapet = (ctx, p, c) => { const w = p.w; box(ctx, p, c, -w / 2, -1.1, w, 1.1, 0.12); ctx.fillStyle = INKC; ctx.fillRect(-w / 2 - 0.1, -1.3, w + 0.2, 0.28); };
  K.utable = (ctx, p, c) => {
    ctx.strokeStyle = INKC; ctx.lineWidth = Math.max(c.lw * 2.2, 0.16); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -2.1); ctx.stroke();
    const path = new Path2D(); path.moveTo(-1.5, -2.0); path.quadraticCurveTo(0, -3.8, 1.5, -2.0); path.closePath(); body(ctx, p, c, path, -1.5, -3.2, 3, 1.2, c.fill);
    ctx.fillStyle = '#E8E4F2'; ctx.fillRect(-0.9, -0.85, 1.8, 0.14);
  };
  K.lights = (ctx, p, c) => {
    ctx.strokeStyle = INKC; ctx.lineWidth = Math.max(c.lw * 2, 0.14); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -4.2); ctx.stroke();
    const dir = p.x > 0 ? -1 : 1; ctx.lineWidth = Math.max(c.lw * 0.8, 0.06); ctx.beginPath(); ctx.moveTo(0, -4.1); ctx.quadraticCurveTo(dir * 2.4, -3.0, dir * 4.8, -4.1); ctx.stroke();
    for (let i = 0; i < 5; i++) { const t = (i + 0.5) / 5; const x = dir * 4.8 * t, y = -4.1 + Math.sin(t * Math.PI) * 1.05; ctx.fillStyle = p.amt > 0.3 ? (i % 2 ? p.vivid : '#FFF1A8') : '#D5D7E6'; ctx.beginPath(); ctx.arc(x, y + 0.05, 0.2, 0, 7); ctx.fill(); }
  };

  const tmpC = { fill: '', fill2: '', lw: 0.05, far: false, baking: false };
  function bboxOf(p) {
    const hw = Math.max(p.w / 2 + 1.4, p.kind === 'lights' ? 5.4 : 0, p.kind === 'crane' ? p.w * 0.62 + 1 : 0, p.kind === 'tree' ? p.w * 0.6 + 0.5 : 0);
    return { hw, top: p.h + 2.8 + (p.kind === 'tower' ? 0.5 : 0) + (p.kind === 'greenhouse' ? 0 : 0), bot: 1.0 };
  }
  function bake(p, d) {
    const bb = bboxOf(p), w = Math.ceil(bb.hw * 2 * d), h = Math.ceil((bb.top + bb.bot) * d);
    if (!p.cache) p.cache = { cv: document.createElement('canvas') };
    const k = p.cache; k.cv.width = w; k.cv.height = h; k.d = d; k.hw = bb.hw; k.top = bb.top; k.bw = w / d; k.bh = h / d;
    const c = k.cv.getContext('2d'); c.translate(bb.hw * d, bb.top * d); c.scale(d, d);
    tmpC.fill = p.fill; tmpC.fill2 = p.fill2; tmpC.lw = Math.max(0.05, 2.4 / d); tmpC.far = d < 14; tmpC.baking = true;
    K[p.kind](c, p, tmpC); tmpC.baking = false;
  }
  INK.drawProp = function (ctx, v, p, cz) {
    const z = p.wz - cz;
    if (z < 3.2) { if (p.cache) p.cache = null; return; }
    if (INK.quality >= 1 && (z > 52 || (INK.quality >= 2 && !p.paintable && z > 24))) return;
    const sc = F / z, x = VX + (p.x - V.camX) * sc, y = V.hz + CAMH * sc;
    const hw = (p.w + 4) * sc * 0.55; if (x + hw < v.x || x - hw > v.x + v.w) return;
    if (z > 62) ctx.globalAlpha = U.clamp((95 - z) / 33, 0, 1);
    if (sc > 64 || p.kind === 'flag') {
      p.cache = null;
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      tmpC.fill = p.fill; tmpC.fill2 = p.fill2; tmpC.lw = Math.max(0.05, 2.6 / sc); tmpC.far = false; tmpC.baking = false;
      K[p.kind](ctx, p, tmpC);
      ctx.restore();
    } else {
      const want = Math.min(40, Math.max(10, sc * 1.3));
      if (!p.cache || (p.cache.d < want * 0.72 && p.cache.d < 40)) bake(p, want);
      const k = p.cache; let dy = 0;
      if (p.kind === 'boat') dy = Math.sin(V.t * 1.3 + p.bob) * 0.18 * sc;
      ctx.drawImage(k.cv, x - k.hw * sc, y - k.top * sc + dy, k.bw * sc, k.bh * sc);
    }
    if (z > 62) ctx.globalAlpha = 1;
  };
  /* contact shadow of a prop on the ground (drawn separately, before props) */
  INK.propList = function (WS, cz, out) {
    for (const p of WS.props) { const z = p.wz - cz; if (z > 1.3 && z < 100) out.push({ z, prop: p }); }
  };
})();
