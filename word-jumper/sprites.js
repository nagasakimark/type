/* Word Jumper - sprites.js: Kenney atlas, sound, biome definitions and the parallax background renderer. */
(function () {
  'use strict';
  const WJ = (window.WJ = {});
  const BASE = '../assets/kenney/word-jumper/';
  const TS = (WJ.TS = 96);
  const M = window.WJ_ATLAS || {};
  const IMG = new Image();
  WJ.ready = false;
  IMG.onload = () => { WJ.ready = true; WJ.onReady && WJ.onReady(); };
  IMG.src = BASE + 'atlas.png';
  WJ.img = IMG; WJ.map = M;
  const bgImgs = {};
  function loadBg(id) { if (bgImgs[id]) return bgImgs[id]; const i = new Image(); i.src = BASE + id + '.webp'; bgImgs[id] = i; return i; }

  /* ---------- sprite drawing ---------- */
  WJ.has = (k) => !!M[k];
  WJ.size = (k) => { const r = M[k]; return r ? { w: r[2], h: r[3] } : { w: 0, h: 0 }; };
  // draw sprite with horizontal centre at x and bottom at y (ay=1). o: s, sx, sy, rot, flip, alpha, ay
  WJ.spr = function (ctx, key, x, y, o) {
    const r = M[key]; if (!r) return;
    const w = r[2], h = r[3];
    if (!o) { ctx.drawImage(IMG, r[0], r[1], w, h, x - w / 2, y - h, w, h); return; }
    const ay = o.ay == null ? 1 : o.ay, ax = o.ax == null ? 0.5 : o.ax;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    const s = o.s || 1;
    ctx.scale((o.sx == null ? 1 : o.sx) * s * (o.flip ? -1 : 1), (o.sy == null ? 1 : o.sy) * s);
    ctx.drawImage(IMG, r[0], r[1], w, h, -w * ax, -h * ay, w, h);
    ctx.restore();
  };
  // hero poses (heroes.png) - character art drawn with feet at y, centred on x, scaled s
  const HM = window.WJ_HEROES || {}, HIMG = new Image(); HIMG.src = BASE + 'heroes.png';
  WJ.hspr = function (ctx, key, x, y, s) { const r = HM[key]; if (!r || !HIMG.complete) return; ctx.drawImage(HIMG, r[0], r[1], r[2], r[3], x - r[2] * s / 2, y - r[3] * s, r[2] * s, r[3] * s); };
  WJ.tile = function (ctx, key, x, y) {
    const r = M[key]; if (!r) return;
    ctx.drawImage(IMG, r[0], r[1], r[2], r[3], x, y, r[2] + 1, r[3] + 1);
  };
  WJ.tileFull = function (ctx, key, x, y, w, h) { const r = M[key]; if (r) ctx.drawImage(IMG, r[0], r[1], r[2], r[3], x, y, w, h); };

  /* ---------- sound (Kenney ogg, lazy, silent on failure) ---------- */
  const snd = {};
  WJ.sound = function (name, vol) {
    try {
      const TM = window.TM; if (!TM || TM.settings.sfx <= 0) return;
      let a = snd[name];
      if (!a) { a = snd[name] = new Audio(BASE + 'sfx/' + name + '.ogg'); a.preload = 'auto'; }
      const c = a.cloneNode(); c.volume = Math.min(1, (vol == null ? 0.6 : vol) * TM.settings.sfx);
      const p = c.play(); if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  };
  WJ.preloadSounds = function () {
    ['phaseJump1', 'pepSound1', 'pepSound3', 'twoTone1', 'twoTone2', 'threeTone1', 'threeTone2', 'powerUp7', 'lowRandom', 'explosionCrunch_000', 'slime_000', 'highUp', 'phaseJump3', 'impactMetal_001', 'powerUp4', 'pepSound5', 'forceField_001']
      .forEach((n) => { if (!snd[n]) { const a = (snd[n] = new Audio(BASE + 'sfx/' + n + '.ogg')); a.preload = 'auto'; } });
  };

  /* ---------- enemies ---------- */
  // f: animation frames (atlas keys 'e/..'), air: floats, hop: bounces, sc: scale
  WJ.ENEMIES = {
    slimeGreen: { f: ['slimeGreen', 'slimeGreen_walk'], sq: 'slimeGreen_squashed' },
    slime: { f: ['slime', 'slime_walk'], sq: 'slime_squashed' },
    slimeBlue: { f: ['slimeBlue', 'slimeBlue'], sq: 'slimeBlue_squashed' },
    slimeBlock: { f: ['slimeBlock', 'slimeBlock'] },
    snail: { f: ['snail', 'snail_walk'] },
    ladyBug: { f: ['ladyBug', 'ladyBug_walk'] },
    mouse: { f: ['mouse', 'mouse_walk'] },
    worm: { f: ['worm', 'worm_walk'] },
    snake: { f: ['snake', 'snake_walk'] },
    spider: { f: ['spider_walk1', 'spider_walk2'] },
    spinnerHalf: { f: ['spinnerHalf', 'spinnerHalf_spin'] },
    grassBlock: { f: ['grassBlock', 'grassBlock_jump'], hop: true },
    frog: { f: ['frog', 'frog_leap'], hop: true },
    ghost: { f: ['ghost', 'ghost_normal'], ghost: true },
    barnacle: { f: ['barnacle', 'barnacle_bite'] },
    snakeSlime: { f: ['snakeSlime', 'snakeSlime_ani'], tall: true },
    snakeLava: { f: ['snakeLava', 'snakeLava_ani'], tall: true },
    // fliers
    fly: { f: ['fly', 'fly_fly'], air: true },
    bat: { f: ['bat', 'bat_fly'], air: true },
    bee: { f: ['bee', 'bee_fly'], air: true },
    ladyBugFly: { f: ['ladyBug_fly', 'ladyBug_fly'], air: true },
    spinner: { f: ['spinner', 'spinner_spin'], air: true },
  };

  /* ---------- biomes ---------- */
  WJ.BIOMES = [
    {
      id: 'meadow', name: 'ひなたの草原', ground: 't/grass', plat: 't/grassHalf', liquid: 'water',
      sky: ['#63C3FF', '#CFF1FF'], far: '#A6E2A0', mid: '#83D274', near: '#5FBF57', fog: '#CFF1FF', clouds: true, tint: 0.28,
      decor: ['i/bush', 'i/plant', 't/fence', 't/sign', 'i/rock', 'i/mushroomRed', 'i/mushroomBrown', 'i/plant'],
      ground2: 'i/plant', enemies: ['slimeGreen', 'snail', 'ladyBug', 'mouse', 'worm', 'grassBlock'], fliers: ['fly', 'bee'],
      boss: 'slimeBlock', coin: 'i/coinGold', music: 0, ambient: 'pollen', accent: '#6CCB3C',
    },
    {
      id: 'mushroom', name: 'キノコの森', ground: 't/grass', plat: 'm/shroomRed', platAlt: 'm/shroomTan', platStem: true, liquid: 'lava',
      sky: ['#79B91F', '#A6D94E'], far: '#6FA81B', mid: '#5E9A17', near: '#4C8A12', fog: '#8CC832', clouds: false, bg: 'bg_shroom', tint: 0.18,
      decor: ['m/tinyShroom_red', 'm/tinyShroom_tan', 'm/tinyShroom_brown', 'm/bush', 'i/plant', 'i/mushroomRed', 'i/mushroomBrown', 'm/tallShroom_tan'],
      enemies: ['ladyBug', 'frog', 'spider', 'worm', 'snake', 'snail'], fliers: ['bee', 'fly', 'ladyBugFly'],
      boss: 'frog', coin: 'i/coinGold', music: 1, ambient: 'fireflies', accent: '#FF8A1F',
    },
    {
      id: 'town', name: 'のんびり町', ground: 't/sand', plat: 't/sandHalf', liquid: 'water',
      sky: ['#79CBFF', '#E6F8FF'], far: '#BFE0E8', mid: '#9FB9C4', near: '#7FA0A8', fog: '#E6F8FF', clouds: true, bg: 'bg_town', tint: 0.3,
      decor: ['t/sign', 'b/fenceLow', 'i/bush', 'i/rock', 't/signRight', 'i/plant', 'i/cactus'],
      enemies: ['mouse', 'slime', 'snail', 'spider', 'worm', 'grassBlock'], fliers: ['bat', 'fly', 'bee'],
      boss: 'ghost', coin: 'i/coinGold', music: 2, ambient: 'none', accent: '#E8A33D',
    },
    {
      id: 'candy', name: 'おかしの国', ground: 'c/cake', plat: 'c/chocoHalf', liquid: 'lava',
      sky: ['#FFA9DB', '#FFF0F8'], far: '#F7B7DA', mid: '#E9A0D4', near: '#D88AD0', fog: '#FFE3F4', clouds: true, tint: 0.3,
      decor: ['c/candyRed', 'c/candyBlue', 'c/candyGreen', 'c/candyYellow', 'c/cherry', 'c/cupCake', 'c/lollipopFruitRed', 'c/canePinkTop'],
      enemies: ['slime', 'worm', 'snakeSlime', 'grassBlock', 'spinnerHalf', 'frog'], fliers: ['bee', 'fly', 'ladyBugFly'],
      boss: 'snakeLava', coin: 'i/coinGold', music: 3, ambient: 'sprinkles', accent: '#FF4FA3',
    },
    {
      id: 'ice', name: 'こおりの山', ground: 'ice/tundra', plat: 'ice/tundraHalf', liquid: 'ice',
      sky: ['#9CCBFF', '#F2FBFF'], far: '#D6EAFB', mid: '#BBD9F3', near: '#A3C8EC', fog: '#EAF6FF', clouds: true, tint: 0.3,
      decor: ['ice/pineSapling', 'ice/pineSaplingAlt', 'ice/rock', 'ice/plant', 'ice/plantAlt', 'ice/snowBallBigGround', 'ice/caneRedTop', 'ice/caneGreenTop', 'ice/deadTree'],
      enemies: ['slimeBlue', 'spinnerHalf', 'snail', 'mouse', 'frog', 'worm'], fliers: ['bat', 'spinner', 'fly'],
      boss: 'slimeBlue', coin: 'i/coinGold', music: 4, ambient: 'snow', accent: '#35A4F0',
    },
  ];

  /* ---------- building prerender for the town backdrop ---------- */
  function makeHouse(w, h, wall, roof) {
    const T = TS, c = document.createElement('canvas'); c.width = w * T; c.height = (h + 2) * T;
    const x = c.getContext('2d');
    const put = (k, gx, gy) => { const r = M[k]; if (r) x.drawImage(IMG, r[0], r[1], r[2], r[3], gx * T, gy * T, T + 1, T + 1); };
    // roof (two rows)
    for (let r = 0; r < 2; r++) for (let i = 0; i < w; i++) put('b/roof' + roof + (i === 0 ? 'Left' : i === w - 1 ? 'Right' : 'Mid'), i, r);
    const top = 2;
    for (let r = 0; r < h; r++) for (let i = 0; i < w; i++) {
      const edge = i === 0 ? 'Left' : i === w - 1 ? 'Right' : 'Mid';
      let k;
      if (r === 0) k = 'b/house' + wall + 'Top' + edge;
      else if (r === h - 1) k = 'b/house' + wall + 'Bottom' + edge;
      else k = edge === 'Mid' ? 'b/house' + wall : 'b/house' + wall + 'Mid' + edge;
      put(k, i, top + r - 0 - 0);
    }
    // windows / door
    for (let r = 0; r < h - 1; r++) for (let i = 1; i < w - 1; i += 2) put('b/window' + (r % 2 ? 'Checkered' : ''), i, top + r);
    put('b/doorKnob', Math.floor(w / 2), top + h - 1);
    return c;
  }

  /* ---------- parallax background ---------- */
  const LW = 2304; // strip width (seamless)
  const strips = {};
  const rnd = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  function crest(base, seed, amp) {
    const p1 = seed * 1.7, p2 = seed * 3.1, p3 = seed * 0.9;
    return (x) => base + Math.sin((x / LW) * Math.PI * 2 * 2 + p1) * amp + Math.sin((x / LW) * Math.PI * 2 * 5 + p2) * amp * 0.45 + Math.sin((x / LW) * Math.PI * 2 * 9 + p3) * amp * 0.16;
  }
  function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mixHex(a, b, t) { const A = hexRGB(a), B = hexRGB(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; }

  function drawSpriteTo(x, key, px, py, s, flip) {
    const r = M[key]; if (!r) return;
    x.save(); x.translate(px, py); x.scale(flip ? -s : s, s); x.drawImage(IMG, r[0], r[1], r[2], r[3], -r[2] / 2, -r[3], r[2], r[3]); x.restore();
  }
  function buildStrip(b, layer) {
    const baseY0 = layer === 0 ? 300 : layer === 1 ? 330 : 380, H = baseY0 + 150, c = document.createElement('canvas'); c.width = LW; c.height = H;
    const x = c.getContext('2d');
    const seedBase = b.id.length * 7 + layer * 13;
    const R = rnd(seedBase + 3);
    const baseY = layer === 0 ? 300 : layer === 1 ? 330 : 380;
    const f = crest(baseY, seedBase, layer === 0 ? 62 : layer === 1 ? 44 : 30);
    const col = layer === 0 ? b.far : layer === 1 ? b.mid : b.near;
    x.fillStyle = col; x.beginPath(); x.moveTo(0, H);
    for (let i = 0; i <= LW; i += 12) x.lineTo(i, f(i));
    x.lineTo(LW, H); x.closePath(); x.fill();
    // features sit on the crest
    const put = (key, px, s, dy, flip) => { drawSpriteTo(x, key, px, f(px) + (dy || 0), s, flip); if (px < 200) drawSpriteTo(x, key, px + LW, f(px) + (dy || 0), s, flip); if (px > LW - 200) drawSpriteTo(x, key, px - LW, f(px - LW) + (dy || 0), s, flip); };
    const spread = (n, fn) => { for (let i = 0; i < n; i++) fn((i + 0.15 + R() * 0.7) * (LW / n), i); };
    if (layer === 1) {
      if (b.id === 'meadow') spread(9, (px, i) => put(['t/hill_large', 't/hill_small', 't/hill_largeAlt', 't/hill_smallAlt'][i % 4], px, 1.0 + R() * 0.45, 14));
      else if (b.id === 'mushroom') spread(8, (px, i) => put(['m/tallShroom_red', 'm/tallShroom_tan', 'm/tallShroom_brown'][i % 3], px, 2.4 + R() * 1.2, 20));
      else if (b.id === 'candy') spread(10, (px, i) => { const k = ['c/lollipopRed', 'c/lollipopGreen', 'c/lollipopFruitYellow', 'c/lollipopWhiteRed', 'c/lollipopWhiteGreen'][i % 5]; const base = ['c/lollipopBase', 'c/lollipopBasePink', 'c/lollipopBaseBrown'][i % 3]; const s = 1.1 + R() * 0.5; put(base, px, s, 8); put(k, px, s, -86 * s + 8); });
      else if (b.id === 'ice') spread(11, (px, i) => put(['ice/pineSapling', 'ice/pineSaplingAlt', 'ice/snowBallBigGround'][i % 3], px, 2.0 + R() * 1.0, 18));
      else if (b.id === 'town') {
        const defs = [[3, 3, 'Beige', 'Red'], [4, 4, 'Gray', 'Yellow'], [3, 4, 'Dark', 'Grey'], [4, 3, 'Beige', 'Yellow']];
        spread(6, (px, i) => { const d = defs[i % 4], hc = makeHouse(d[0], d[1], d[2], d[3]); const s = 0.8; const yy = f(px) + 24; x.drawImage(hc, px - hc.width * s / 2, yy - hc.height * s, hc.width * s, hc.height * s); });
      }
    } else if (layer === 2) {
      if (b.id === 'meadow') spread(12, (px, i) => put(i % 3 ? 'i/bush' : 'i/plant', px, 1.6 + R(), 6));
      else if (b.id === 'mushroom') spread(14, (px, i) => put(['m/tinyShroom_red', 'm/tinyShroom_tan', 'm/bush'][i % 3], px, i % 3 === 2 ? 0.9 : 2.2, 6));
      else if (b.id === 'town') spread(10, (px, i) => put(i % 2 ? 'i/bush' : 'b/fenceLow', px, 1.4, 6));
      else if (b.id === 'candy') spread(14, (px, i) => put(['c/candyRed', 'c/candyBlue', 'c/candyGreen', 'c/candyYellow', 'c/cupCake'][i % 5], px, 1.7 + R() * 0.7, 6));
      else if (b.id === 'ice') spread(14, (px, i) => put(['ice/pineSapling', 'ice/snowBallBigGround', 'ice/pineSaplingAlt'][i % 3], px, 1.6 + R() * 0.8, 6));
    }
    // atmospheric tint so far things read as far
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = b.fog; x.globalAlpha = layer === 0 ? 0.32 : layer === 1 ? b.tint + 0.1 : b.tint * 0.35;
    x.fillRect(0, 0, LW, H);
    const px = x.getImageData(5, H - 3, 1, 1).data;
    return { c, H, baseY, fill: 'rgb(' + px[0] + ',' + px[1] + ',' + px[2] + ')' };
  }

  function stripsFor(b) {
    if (!strips[b.id]) { const keys = Object.keys(strips); if (keys.length >= 2) delete strips[keys[0]]; strips[b.id] = { s: [buildStrip(b, 0), buildStrip(b, 1), buildStrip(b, 2)], skyKey: '', sky: null, bgKey: '', bgc: null }; }
    return strips[b.id];
  }
  const cloudDefs = [['i/cloud1', 0.7], ['i/cloud2', 0.9], ['i/cloud3', 0.6], ['i/cloud1', 1.0], ['i/cloud2', 0.55], ['i/cloud3', 1.1], ['i/cloud1', 0.5]];
  const sparkle = []; for (let i = 0; i < 46; i++) sparkle.push({ x: Math.random(), y: Math.random(), p: Math.random() * 6.28, s: 0.4 + Math.random() });

  /* Draw all background layers. view = {w,h} in local (zoomed) units; gl = ground line y */
  WJ.drawBackground = function (ctx, b, camX, view, gl, t, camY) {
    const W = view.w, H = view.h;
    if (!WJ.ready) { ctx.fillStyle = b.sky[1]; ctx.fillRect(0, 0, W, H); return; }
    const st = stripsFor(b);
    // sky
    const key = b.id + '|' + H;
    if (st.skyKey !== key) { const g = ctx.createLinearGradient(0, 0, 0, H * 0.82); g.addColorStop(0, b.sky[0]); g.addColorStop(1, b.sky[1]); st.sky = g; st.skyKey = key; }
    ctx.fillStyle = st.sky; ctx.fillRect(0, 0, W, H);
    const cy = (camY || 0);
    // backdrop image (pre-scaled once, mirrored so it tiles seamlessly)
    if (b.bg) {
      const im = loadBg(b.bg);
      if (im.complete && im.naturalWidth) {
        const sc = Math.max(H * 0.95, 760) / im.naturalHeight, tw = Math.round(im.naturalWidth * sc), th = Math.round(im.naturalHeight * sc);
        const bk = b.bg + '|' + th;
        if (st.bgKey !== bk) {
          const c = document.createElement('canvas'); c.width = tw * 2; c.height = th; const x = c.getContext('2d');
          x.drawImage(im, 0, 0, tw, th); x.save(); x.translate(tw * 2, 0); x.scale(-1, 1); x.drawImage(im, 0, 0, tw, th); x.restore();
          st.bgc = c; st.bgKey = bk; st.bgFill = b.id === 'mushroom' ? '#6DA41A' : '#C0E8EC';
        }
        const sx = ((camX * 0.06) % (tw * 2) + tw * 2) % (tw * 2), y = Math.round(gl - th * 0.78 - cy * 0.15), c = st.bgc, P2 = tw * 2;
        const vh = Math.min(th, H - y);
        if (vh > 0) for (let px = -sx; px < W; px += P2) {
          const x0 = Math.max(0, -px), x1 = Math.min(P2, W - px);
          if (x1 > x0) ctx.drawImage(c, x0, 0, x1 - x0, vh, Math.round(px + x0), y, x1 - x0, vh);
        }
        ctx.fillStyle = st.bgFill; if (y + th < H) ctx.fillRect(0, y + th - 1, W, H - (y + th) + 2);
      }
    }
    // sun-ish glow
    if (b.clouds) {
      for (let i = 0; i < cloudDefs.length; i++) {
        const d = cloudDefs[i], sp = 0.03 + (i % 3) * 0.02;
        const span = W + 500; let x = ((i * 410 - camX * sp - t * (6 + i * 2.5)) % span + span) % span - 250;
        const y = gl - 640 - (i % 4) * 70 - cy * 0.05;
        WJ.spr(ctx, d[0], x, y, { s: d[1] * 1.5, alpha: 0.92, ay: 0.5 });
      }
    }
    // layers
    const layers = [[0, 0.10, -300], [1, 0.22, -150], [2, 0.45, -22]];
    for (const [li, sp, off] of layers) {
      const s = st.s[li];
      const y = Math.round(gl - s.baseY + off - cy * (0.25 + li * 0.2));
      const scroll = camX * sp;
      const x0 = -(((scroll % LW) + LW) % LW);
      const vh = Math.min(s.H, H - y);
      if (vh > 0) for (let x = x0; x < W; x += LW) {
        const a = Math.max(0, -x), bnd = Math.min(LW, W - x);
        if (bnd > a) ctx.drawImage(s.c, a, 0, bnd - a, vh, Math.round(x + a), y, bnd - a, vh);
      }
      const bot = y + s.H;
      if (bot < H) { ctx.fillStyle = s.fill; ctx.fillRect(0, bot - 1, W, H - bot + 2); }
    }
    // ambient screen particles
    if (b.ambient && b.ambient !== 'none') {
      ctx.save();
      const nAmb = b.ambient === 'pollen' ? 16 : sparkle.length;
      for (let i = 0; i < nAmb; i++) {
        const p = sparkle[i];
        if (b.ambient === 'snow') {
          const x = ((p.x * W + t * 20 * p.s + Math.sin(t + p.p) * 30 - camX * 0.1) % W + W) % W, y = ((p.y * H + t * (60 + 50 * p.s)) % H);
          ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(x, y, 2 + p.s * 3, 0, 7); ctx.fill();
        } else if (b.ambient === 'fireflies' || b.ambient === 'pollen') {
          const x = ((p.x * W - camX * 0.3 + Math.sin(t * 0.6 + p.p) * 40) % W + W) % W, y = (gl - 80 - p.y * 560 + Math.sin(t * 0.9 + p.p) * 24);
          ctx.fillStyle = b.ambient === 'fireflies' ? 'rgba(255,255,160,' + (0.35 + 0.35 * Math.sin(t * 2 + p.p)) + ')' : 'rgba(255,255,255,0.55)';
          ctx.beginPath(); ctx.arc(x, y, 3 + p.s * 2.5, 0, 7); ctx.fill();
        } else if (b.ambient === 'sprinkles') {
          const x = ((p.x * W + Math.sin(t + p.p) * 20 - camX * 0.2) % W + W) % W, y = ((p.y * H + t * (30 + 30 * p.s)) % H);
          ctx.fillStyle = ['#FF5A5F', '#FFC83D', '#2F9BFF', '#fff'][i % 4]; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.6 + p.p); ctx.fillRect(-7, -2.5, 14, 5); ctx.restore();
        }
      }
      ctx.restore();
    }
  };
  WJ.houseCanvas = makeHouse;
})();
