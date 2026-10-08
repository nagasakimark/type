/* Word Jumper - levels.js: word picker, ballistic arc maths and the procedural level assembler (segment templates). */
(function () {
  'use strict';
  const WJ = window.WJ, TM = window.TM, TS = WJ.TS;

  /* ---------- ballistic leg: lands exactly on (x1,y1) with apex H above the start ---------- */
  // y is screen-down. y(t) = y0 - vy*t + 0.5*g*t^2
  WJ.arc = function (x0, y0, x1, y1, H, T) {
    const dy = y1 - y0;
    H = Math.max(H, -dy + 24, 0);
    const s = (T * Math.sqrt(2 * H) + Math.sqrt(Math.max(0, 2 * T * T * H + 2 * T * T * dy))) / (T * T);
    const g = s * s, vy = Math.sqrt(2 * g * H);
    return { k: 'arc', x0, y0, x1, y1, T, g, vy, t: 0, H };
  };
  WJ.arcT = (dx, H) => Math.max(0.5, Math.min(1.9, 0.36 + Math.abs(dx) * 0.00042 + H * 0.0017));
  WJ.arcPos = function (a, t) { const f = t / a.T; return { x: a.x0 + (a.x1 - a.x0) * f, y: a.y0 - a.vy * t + 0.5 * a.g * t * t }; };

  /* ---------- word picker (word -> phrase -> sentence ladder) ---------- */
  WJ.makePicker = function (g) {
    const pool = (g.dealer && g.dealer.pool) || TM.pool();
    const words = pool.words.slice(), sents = pool.sentences.slice();
    const used = new Set();
    const L = (it) => it.len;
    const mk = (t, kind) => { const ch = TM.typedChars(t); const req = ch.filter((c) => !c.opt); return { t, ja: '', kana: '', hint: '', kind, len: req.length, first: req.length ? req[0].k : '', words: t.trim().split(/\s+/).length }; };
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const takeFrom = (arr) => {
      const fresh = arr.filter((it) => !used.has(it.t));
      let c = fresh.length ? fresh : arr;
      if (!fresh.length) for (const it of arr) used.delete(it.t);
      const it = c[Math.floor(Math.random() * c.length)];
      used.add(it.t); return Object.assign({}, it);
    };
    const shortW = words.filter((w) => L(w) <= 5 && w.words === 1), medW = words.filter((w) => L(w) >= 4 && L(w) <= 8 && w.words === 1), longW = words.filter((w) => L(w) >= 6 && L(w) <= 14);
    const phr = words.filter((w) => w.words >= 2 && L(w) <= 22).concat(sents.filter((s) => s.words <= 4 && L(s) <= 24));
    const sen = sents.filter((s) => s.words >= 3 && L(s) <= 36);
    const sen2 = sents.filter((s) => L(s) <= 44);
    const anyW = words.length ? words : [mk('jump', 'word'), mk('run', 'word'), mk('fun', 'word'), mk('star', 'word')];
    const anyShort = shortW.length >= 3 ? shortW : (anyW.slice().sort((a, b) => L(a) - L(b)).slice(0, Math.max(4, Math.ceil(anyW.length / 2))));
    const joinN = (n, pl) => { const base = pl.length >= 2 ? pl : anyShort; const parts = []; for (let i = 0; i < n; i++) parts.push(takeFrom(base).t); return mk(parts.join(' '), 'sentence'); };
    const pickers = [
      () => takeFrom(anyShort),
      () => takeFrom(medW.length >= 3 ? medW : anyW),
      () => takeFrom(longW.length >= 3 ? longW : anyW),
      () => (phr.length >= 3 ? takeFrom(phr) : joinN(2, anyShort)),
      () => (sen.length >= 2 ? takeFrom(sen) : sen2.length ? takeFrom(sen2) : phr.length >= 3 ? takeFrom(phr) : joinN(3, anyShort)),
    ];
    return { pick: (tier) => pickers[Math.max(0, Math.min(4, Math.round(tier)))](), shuffle };
  };

  /* ---------- level assembler ---------- */
  const rr = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const LV_BASE = [0, 0.8, 1.6, 2.4, 3.3];
  const SEGS = [6, 7, 8, 9, 10];

  WJ.buildLevel = function (o) {
    const bi = o.index % WJ.BIOMES.length, B = WJ.BIOMES[bi], R = mulberry((o.seed || (Math.random() * 1e9)) + bi * 977);
    const picker = o.picker, diffShift = o.diff === 'gentle' ? -0.8 : o.diff === 'turbo' ? 0.5 : 0;
    const v = o.speed;
    const L = { index: o.index, biome: B, spans: [], plats: [], pits: [], obs: [], coins: [], decor: [], flags: [], mplats: [], total: 0, speed: v };
    let cx = 0, cy = 0, id = 0, segI = 0, segN = SEGS[Math.min(4, o.index)] + (o.index >= 5 ? 1 : 0);
    const prog = () => Math.min(1, segI / segN);
    const tierNow = (off) => LV_BASE[Math.min(4, o.index)] + prog() * 0.95 + diffShift + (off || 0);
    const item = (off) => picker.pick(tierNow(off));
    const lead = (it) => Math.max(2, Math.min(8, Math.ceil(v * (0.3 + 0.1 * it.len) / TS)));

    const addSpan = (n, capL) => {
      const x0 = cx, x1 = cx + n * TS, last = L.spans[L.spans.length - 1];
      if (last && last.x1 === x0 && last.y === cy && !capL) last.x1 = x1; else L.spans.push({ x0, x1, y: cy, capL: !!capL, capR: false });
      cx = x1;
    };
    const run = (n) => addSpan(n, false);
    const coinAt = (x, y, kind) => { const c = { x, y, kind: kind || 'coin', got: false, ph: R() * 6 }; L.coins.push(c); L.total += kind === 'star' ? 5 : kind === 'gem' ? 3 : kind === 'heart' ? 0 : 1; return c; };
    const coinsOnArc = (a, n, gemAtApex) => {
      for (let i = 1; i <= n; i++) { const t = (i / (n + 1)) * a.T, p = WJ.arcPos(a, t); coinAt(p.x, p.y - 62, 'coin'); }
      if (gemAtApex) { const tt = a.vy / a.g; if (tt > 0 && tt < a.T) { const p = WJ.arcPos(a, tt); coinAt(p.x, p.y - 118, 'gem'); } }
    };
    const runCoins = (x0, n, y) => { for (let i = 0; i < n; i++) coinAt(x0 + i * 62, y - 62, 'coin'); };
    const mkOb = (type, it, extra) => { const ob = Object.assign({ id: id++, type, item: it, status: 'todo', optional: false, x: cx, launchX: cx, ly: cy, t0: 0 }, extra); L.obs.push(ob); return ob; };
    const pitEdge = () => { const last = L.spans[L.spans.length - 1]; if (last) last.capR = true; };
    const leadRun = (it) => { const n = lead(it); const x0 = cx; run(n); if (n >= 4 && R() < 0.65) runCoins(x0 + TS * 1.1, Math.min(4, n - 2), cy); return n; };

    /* ----- primitives ----- */
    function gap(it, w, boss) {
      leadRun(it);
      const x0 = cx, x1 = cx + w * TS, lx = x0 - 0.7 * TS, tx = x1 + 0.9 * TS;
      const H = boss ? 330 : 150 + w * 14, T = WJ.arcT(tx - lx, H);
      const a = WJ.arc(lx, cy, tx, cy, H, T);
      pitEdge(); L.pits.push({ x0, x1 });
      mkOb(boss ? 'bossgap' : 'gap', it, { x: (x0 + x1) / 2, launchX: lx, legs: [a], flip: w >= 5 || boss, anchorY: cy - H - 20, boss: !!boss });
      coinsOnArc(a, boss ? 7 : 3 + Math.min(3, w - 3), true);
      cx = x1; addSpan(boss ? 9 : 2, true);
      if (boss) L.goalX = x1 + 6 * TS;
    }
    function hop(it, dy) {
      leadRun(it);
      const ex = cx, lx = ex - 1.0 * TS, tx = ex + 0.9 * TS, ny = cy - dy * TS, H = dy * TS + 85;
      const a = WJ.arc(lx, cy, tx, ny, H, WJ.arcT(tx - lx, H));
      mkOb('hop', it, { x: ex, launchX: lx, legs: [a], anchorY: cy - H - 30 });
      coinsOnArc(a, 2, false);
      cy = ny; addSpan(2, true);
    }
    function drop(dy) { // wordless: step off a ledge
      const edge = cx; pitEdge(); cy += dy * TS; mkOb('drop', null, { x: edge, launchX: edge - 0.15 * TS, ly: cy - dy * TS, dy: dy * TS });
      // ensure there is ground after
      addSpan(3, false);
    }
    function enemy(it, air) {
      leadRun(it);
      const kinds = air ? B.fliers : B.enemies, kind = kinds[rr(R, 0, kinds.length - 1)], def = WJ.ENEMIES[kind];
      const lx = cx, ex = cx + 1.85 * TS, fh = air ? (1.5 + R() * 0.8) * TS : 0;
      const h = WJ.size('e/' + def.f[0]).h * (o.index === 0 ? 1.15 : 1.1);
      mkOb('enemy', it, { x: ex, launchX: lx, kind, def, air: !!air, fh, eh: h, sc: 1.1, phase: R() * 6, anchorY: cy - fh - h - 150, bounce: true });
      run(4); // ground under the stomp + landing
      L.obs[L.obs.length - 1].landX = ex + 1.7 * TS;
    }
    function springTower(it, rise) {
      leadRun(it);
      const lx = cx, sx = cx + 1.6 * TS, px0 = sx + 2.6 * TS, plen = rr(R, 5, 6), py = cy - rise * TS;
      L.plats.push({ x0: px0, x1: px0 + plen * TS, y: py, stem: !!B.platStem, alt: false });
      const tx = px0 + 1.1 * TS, H2 = rise * TS + 130;
      const a1 = WJ.arc(lx, cy, sx, cy - 52, 62, 0.36), a2 = WJ.arc(sx, cy - 52, tx, py, H2, WJ.arcT(tx - sx, H2) + 0.1);
      mkOb('spring', it, { x: sx, launchX: lx, legs: [a1, a2], anchorY: cy - 190, flip: true, springX: sx });
      coinsOnArc(a2, 4, false);
      coinAt(px0 + (plen / 2) * TS, py - 150, 'star');
      for (let i = 1; i < plen - 1; i++) coinAt(px0 + (i + 0.5) * TS, py - 70, 'coin');
      run(Math.ceil((px0 - cx) / TS) + 1);
      // step off the far end (wordless)
      const dropX = px0 + plen * TS;
      mkOb('drop', null, { x: dropX, launchX: dropX - 0.15 * TS, ly: py, dy: rise * TS, fromPlat: true });
      run(Math.ceil((dropX - cx) / TS) + 4);
    }
    function crates(it, n) {
      leadRun(it);
      const lx = cx, wx = cx + 3.2 * TS;
      mkOb('crates', it, { x: wx + 0.5 * TS, launchX: lx, wx, n, anchorY: cy - n * TS - 40, legs: [{ k: 'dash', x0: lx, x1: wx + 1.4 * TS, y: cy, T: 0.62, t: 0, crashX: wx - 0.2 * TS }] });
      run(6);
      for (let i = 0; i < 3; i++) coinAt(wx + 1.5 * TS + i * 62, cy - 62, 'coin');
    }
    function qblock(it) {
      leadRun(it);
      const lx = cx, bx = cx + 1.5 * TS, by = cy - 3 * TS, tx = bx + 1.5 * TS, H = 3 * TS - 168;
      mkOb('qblock', it, { x: bx, launchX: lx, legs: [WJ.arc(lx, cy, lx + (bx - lx) * 2, cy, 116, 0.7)], optional: true, by, bump: 0, opened: false, anchorY: by - 110, reward: R() < 0.22 ? 'heart' : 'coins' });
      run(5);
    }
    function mplat(it1, it2, w) {
      leadRun(it1);
      const x0 = cx, x1 = cx + w * TS, lx = x0 - 0.7 * TS, ex = x1 + 0.9 * TS;
      pitEdge(); L.pits.push({ x0, x1 });
      const mp = { cx: (x0 + x1) / 2, A: w * TS / 2 - 1.9 * TS, P: 5 + R() * 1.2, ph: R() * 6.28, y: cy + 0.1 * TS, bob: 7, w: 3, id: L.mplats.length };
      L.mplats.push(mp);
      mkOb('mplatIn', it1, { x: mp.cx, launchX: lx, mp, anchorY: cy - 250 });
      mkOb('mplatOut', it2, { x: mp.cx, launchX: x0, mp, landX: ex, anchorY: cy - 300, ly: cy, flip: true });
      cx = x1; addSpan(2, true);
      coinAt(mp.cx, cy - 190, 'gem');
    }
    function bossEnemy(it) {
      leadRun(it);
      const lx = cx, ex = cx + 3.4 * TS, B2 = B.boss, def = WJ.ENEMIES[B2], h = WJ.size('e/' + def.f[0]).h * 2.5;
      const tx = ex + 5.2 * TS;
      mkOb('boss', it, { x: ex, launchX: lx, kind: B2, def, fh: 0, eh: h, sc: 2.5, tx, phase: 0, boss: true, anchorY: cy - h - 150, flip: true });
      run(Math.ceil((tx - cx) / TS) + 1); L.goalX = tx + 3 * TS;
    }
    function checkpoint() { run(2); L.flags.push({ x: cx - 0.5 * TS, y: cy, hit: false }); run(2); }

    /* ----- segment templates (hand-authored recipes, randomly chosen & parametrised) ----- */
    const W = (a) => a; // weights per level index [l1..l5]
    const SEG = [
      { n: 'gap', w: [3, 2, 2, 2, 2], f: () => gap(item(), rr(R, 4, 5 + (o.index > 2 ? 1 : 0))) },
      { n: 'slimes', w: [3, 2, 2, 2, 1], f: () => { enemy(item()); enemy(item()); } },
      { n: 'stairs', w: [2, 2, 2, 2, 2], f: () => { hop(item(), 1); hop(item(), 1); drop(2); } },
      { n: 'treasure', w: [2, 2, 2, 2, 2], f: () => { qblock(item(-0.6)); enemy(item()); } },
      { n: 'gapFoe', w: [1, 3, 3, 3, 3], f: () => { gap(item(), rr(R, 4, 6)); enemy(item()); } },
      { n: 'flyers', w: [0, 3, 3, 3, 3], f: () => { enemy(item(), true); enemy(item(), true); } },
      { n: 'spring', w: [0, 3, 3, 3, 3], f: () => springTower(item(), rr(R, 3, 4)) },
      { n: 'crate', w: [0, 3, 2, 3, 3], f: () => { crates(item(), rr(R, 2, 3)); enemy(item()); } },
      { n: 'ride', w: [0, 0, 3, 3, 3], f: () => mplat(item(), item(), rr(R, 8, 9)) },
      { n: 'mixed', w: [1, 2, 3, 3, 3], f: () => { hop(item(), 1); gap(item(), 4); enemy(item(), R() < 0.5); } },
      { n: 'dblgap', w: [2, 2, 2, 2, 3], f: () => { gap(item(), 4); gap(item(), 4); } },
      { n: 'qspring', w: [0, 0, 2, 3, 3], f: () => { qblock(item(-0.6)); springTower(item(), 3); } },
    ];
    const pickSeg = (last) => {
      const only = (new URLSearchParams(location.search).get('seg') || '').split(',').filter(Boolean);
      const ws = SEG.map((s) => (only.length ? (only.includes(s.n) ? 1 : 0) : s.n === last ? 0 : s.w[Math.min(4, o.index)]));
      let tot = ws.reduce((a, b) => a + b, 0), r = R() * tot;
      for (let i = 0; i < SEG.length; i++) { r -= ws[i]; if (r <= 0) return SEG[i]; }
      return SEG[0];
    };

    // start
    run(8); L.startX = 3 * TS;
    L.flags.push({ x: 2.2 * TS, y: 0, hit: true, start: true });
    let last = '';
    for (segI = 0; segI < segN; segI++) {
      const s = pickSeg(last); last = s.n; s.f();
      if (segI % 2 === 1 && segI < segN - 1) checkpoint();
    }
    // boss
    segI = segN;
    const bossTier = Math.min(4, LV_BASE[Math.min(4, o.index)] + 1.5 + diffShift);
    const bossIt = picker.pick(bossTier);
    if (o.index % 2 === 0) gap(bossIt, 12, true); else bossEnemy(bossIt);
    run(Math.ceil((L.goalX - cx) / TS) + 24);
    L.endX = cx; pitEdge();
    L.spans[L.spans.length - 1].capR = true;
    // mark caps next to pits on left side too
    for (const p of L.pits) for (const s of L.spans) if (s.x0 === p.x1) s.capL = true;

    // ground decor
    for (const s of L.spans) {
      for (let x = s.x0 + TS * 0.5; x < s.x1; x += TS) {
        if (R() < 0.3 && !L.obs.some((q) => (q.type === 'spring' || q.type === 'qblock' || q.type === 'crates' || q.def) && Math.abs(q.x - x) < TS * 1.1)) L.decor.push({ x: x + (R() - 0.5) * 30, y: s.y, key: B.decor[rr(R, 0, B.decor.length - 1)], s: 0.9 + R() * 0.35, flip: R() < 0.5 });
      }
    }
    // thin out decor under launch/land zones is unnecessary (it sits behind the hero)
    L.title = B.name;
    return L;
  };
})();
