/* Word Ninja - sprites: Kenney food-kit fruit (3D-rendered to PNG), runtime half-cutting, tinted splats, baked specials. */
(function () {
  'use strict';
  const WN = (window.WN = window.WN || {});
  const A = '../assets/kenney/word-ninja/';
  const imgs = {};
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };
  WN.mk = mk;

  // size = displayed max dimension (virtual px); flesh = cut-face colour; juice = splat colour
  WN.FRUITS = {
    apple:      { size: 150, flesh: '#FFF3C9', juice: '#E8412E', seeds: 1 },
    banana:     { size: 250, flesh: '#FFF6C0', juice: '#FFD83A' },
    orange:     { size: 150, flesh: '#FFC864', juice: '#FF9A1F', ring: '#FFF1C4' },
    lemon:      { size: 140, flesh: '#FFF59A', juice: '#FFE14D', ring: '#FFFBD0' },
    pear:       { size: 160, flesh: '#F4F6BE', juice: '#A9DC52', seeds: 1 },
    strawberry: { size: 140, flesh: '#FFC2C8', juice: '#FF3D55' },
    watermelon: { size: 190, flesh: '#FF6B7A', juice: '#FF4D6A', seeds: 2 },
    pineapple:  { size: 200, flesh: '#FFEB7A', juice: '#FFD23F' },
    coconut:    { size: 150, flesh: '#FFFFFF', juice: '#F2EBDD' },
    cherries:   { size: 160, flesh: '#FF9AA8', juice: '#D81E3C' },
    grapes:     { size: 160, flesh: '#D9C2FF', juice: '#8E4BD8' },
    avocado:    { size: 160, flesh: '#D6EB7A', juice: '#8DBE3A', seeds: 3 },
    tomato:     { size: 140, flesh: '#FF9A8A', juice: '#EE3B2B', seeds: 1 },
  };
  WN.NORMAL_KINDS = Object.keys(WN.FRUITS);
  WN.SUSHI = ['sushi-egg', 'sushi-salmon', 'maki-salmon', 'maki-roe', 'maki-vegetable'];

  function load(name, url) {
    return new Promise((res) => { const im = new Image(); im.onload = () => { imgs[name] = im; res(); }; im.onerror = () => res(); im.src = url; });
  }
  WN.img = (n) => imgs[n];
  WN.ready = false;
  WN.load = function () {
    if (WN._p) return WN._p;
    const list = [];
    for (const k of WN.NORMAL_KINDS) list.push(load(k, A + 'fruit/' + k + '.png'));
    for (const k of WN.SUSHI) list.push(load(k, A + 'fruit/' + k + '.png'));
    for (let i of [0, 1, 2, 10, 11, 12, 18, 19, 20, 27, 28, 30]) list.push(load('splat' + i, A + 'splat/s' + String(i).padStart(2, '0') + '.png'));
    for (const n of ['flare_01', 'star_04', 'smoke_05', 'scratch_01', 'light_01']) list.push(load(n, A + 'splat/' + n + '.png'));
    WN._p = Promise.all(list).then(() => { bakeSpecials(); WN.ready = true; });
    return WN._p;
  };

  /* ---------- kind -> {img, size, flesh, juice} ---------- */
  WN.kinds = {};
  function bakeSpecials() {
    for (const k of WN.NORMAL_KINDS) WN.kinds[k] = Object.assign({ name: k, img: imgs[k] }, WN.FRUITS[k]);
    WN.kinds.bossmelon = { name: 'bossmelon', img: imgs.watermelon, size: 450, flesh: '#FF5C6E', juice: '#FF4D6A', seeds: 2, fleshW: 84 };
    // golden banana: gold tint + sparkle ring baked
    {
      const b = imgs.banana, c = mk(300, 150), x = c.getContext('2d');
      x.save(); x.translate(150, 78); x.rotate(-0.12);
      x.drawImage(b, -b.width * 0.6, -b.height * 0.6, b.width * 1.2, b.height * 1.2);
      x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(255,196,20,0.55)'; x.fillRect(-200, -100, 400, 200);
      x.fillStyle = 'rgba(255,255,255,0.5)'; x.beginPath(); x.ellipse(-30, -22, 70, 8, -0.2, 0, 7); x.fill();
      x.restore();
      WN.kinds.golden = { name: 'golden', img: c, size: 300, flesh: '#FFF2A0', juice: '#FFC83D' };
    }
    // frost pear: icy tint + crystals
    {
      const p = imgs.pear, c = mk(260, 260), x = c.getContext('2d');
      const s = 170 / p.height;
      x.save(); x.translate(130, 130);
      x.drawImage(p, -p.width * s / 2, -p.height * s / 2, p.width * s, p.height * s);
      x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(120,205,255,0.62)'; x.fillRect(-200, -200, 400, 400);
      x.fillStyle = 'rgba(255,255,255,0.45)'; x.beginPath(); x.ellipse(-26, -30, 26, 14, -0.6, 0, 7); x.fill();
      x.globalCompositeOperation = 'source-over';
      const spike = (a, r0, r1, w) => {
        x.save(); x.rotate(a); x.beginPath(); x.moveTo(r0, -w); x.lineTo(r1, 0); x.lineTo(r0, w); x.closePath();
        x.fillStyle = 'rgba(214,244,255,0.95)'; x.fill(); x.lineWidth = 4; x.strokeStyle = '#2C6FA8'; x.lineJoin = 'round'; x.stroke(); x.restore();
      };
      for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + 0.3; spike(a, 62, 98 + (i % 3) * 14, 13 + (i % 2) * 5); }
      x.restore();
      WN.kinds.ice = { name: 'ice', img: c, size: 230, flesh: '#E4F6FF', juice: '#7CCBFF' };
    }
    // stinky durian bomb body
    {
      const c = mk(260, 260), x = c.getContext('2d');
      x.translate(130, 138);
      const n = 15;
      x.fillStyle = '#7F9A2A'; x.strokeStyle = '#1F1A3D'; x.lineWidth = 6; x.lineJoin = 'round';
      for (let i = 0; i < n; i++) {
        const a = i / n * 6.283; x.save(); x.rotate(a);
        x.beginPath(); x.moveTo(66, -17); x.lineTo(104, 0); x.lineTo(66, 17); x.closePath(); x.fill(); x.stroke(); x.restore();
      }
      const g = x.createRadialGradient(-28, -32, 8, 0, 0, 82);
      g.addColorStop(0, '#E6F07A'); g.addColorStop(0.55, '#B5CC43'); g.addColorStop(1, '#7F9A2A');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, 76, 0, 7); x.fill(); x.stroke();
      x.strokeStyle = 'rgba(31,26,61,0.25)'; x.lineWidth = 4;
      for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(0, 0, 74, i * 1.05 + 0.2, i * 1.05 + 0.65); x.stroke(); }
      x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.ellipse(-30, -42, 26, 11, -0.7, 0, 7); x.fill();
      WN.kinds.bomb = { name: 'bomb', img: c, size: 190, flesh: '#E6F07A', juice: '#8FB23A' };
    }
  }

  /* ---------- drawing a whole fruit ---------- */
  WN.drawKind = function (ctx, kind, x, y, rot, sc = 1, alpha = 1) {
    const K = WN.kinds[kind]; if (!K || !K.img) return;
    const im = K.img, s = (K.size * sc) / Math.max(im.width, im.height);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(im, -im.width * s / 2, -im.height * s / 2, im.width * s, im.height * s);
    ctx.restore();
  };

  /* ---------- runtime halves: clip the sprite along the slash line ---------- */
  const halfCache = new Map();
  const QN = 12;
  WN.halfCanvas = function (kind, q, side) {
    const key = kind + '|' + q + '|' + side;
    let c = halfCache.get(key); if (c) return c;
    const K = WN.kinds[kind]; if (!K || !K.img) return null;
    const im = K.img, pad = 10, w = im.width + pad * 2, h = im.height + pad * 2, ang = q * Math.PI / QN;
    c = mk(w, h); const x = c.getContext('2d');
    x.translate(w / 2, h / 2);
    x.save();
    x.rotate(ang); x.beginPath(); side === 0 ? x.rect(-400, -400, 800, 400) : x.rect(-400, 0, 800, 400); x.clip();
    x.rotate(-ang); x.drawImage(im, -im.width / 2, -im.height / 2);
    x.restore();
    // cut face: flesh band hugging the cut, only where pixels exist
    x.save(); x.globalCompositeOperation = 'source-atop'; x.rotate(ang);
    const dir = side === 0 ? 1 : -1; // band goes inward (toward the half's body)
    const fw = K.fleshW || 16;
    if (K.fleshW) { x.fillStyle = '#E8F4C8'; x.fillRect(-400, dir > 0 ? -fw - 9 : 0, 800, fw + 9); }
    x.fillStyle = K.flesh; x.fillRect(-400, dir > 0 ? -fw : 0, 800, fw);
    x.fillStyle = K.juice; x.globalAlpha = 0.55; x.fillRect(-400, dir > 0 ? -fw : fw - 4, 800, 4);
    x.globalAlpha = 0.9; x.fillStyle = '#fff'; x.fillRect(-400, dir > 0 ? -fw + 4 : fw - 8, 800, 3);
    // seeds / texture dots
    if (K.seeds) {
      x.globalAlpha = 1; x.fillStyle = K.seeds === 2 ? '#2A1D2A' : K.seeds === 3 ? '#5A3A22' : '#7A4A2A';
      const n = K.seeds === 2 ? 5 : 3; const span = Math.min(im.width, im.height) * 0.28;
      for (let i = 0; i < n; i++) { const px = (i - (n - 1) / 2) * span / (n > 3 ? 2 : 1.2), py = -dir * fw * 0.55; x.beginPath(); x.ellipse(px, py, 4.5 * (fw / 16) ** 0.6, 7 * (fw / 16) ** 0.6, 0.2, 0, 7); x.fill(); }
    }
    x.restore();
    halfCache.set(key, c);
    return c;
  };
  WN.QN = QN;

  /* ---------- tinted splats (white Kenney splats -> fruit colour) ---------- */
  const splatCache = new Map();
  const SPLATS = [0, 1, 2, 10, 11, 12, 18, 19, 20, 27, 28, 30];
  WN.splat = function (idx, color) {
    const id = SPLATS[idx % SPLATS.length], key = id + color;
    let c = splatCache.get(key); if (c) return c;
    const im = imgs['splat' + id]; if (!im) return null;
    c = mk(128, 128); const x = c.getContext('2d');
    x.drawImage(im, 0, 0, 128, 128);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, 128, 128);
    x.globalCompositeOperation = 'source-atop'; // soft inner highlight so it reads as a wet blob
    const g = x.createRadialGradient(46, 42, 4, 64, 64, 70); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.6, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    splatCache.set(key, c);
    return c;
  };
  WN.nSplats = SPLATS.length;
  const tintCache = new Map();
  WN.tinted = function (name, color) {
    const key = name + color; let c = tintCache.get(key); if (c) return c;
    const im = imgs[name]; if (!im) return null;
    c = mk(im.width, im.height); const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    tintCache.set(key, c); return c;
  };
})();
