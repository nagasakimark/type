/* Word Jumper - a typing platformer. The hero runs through side-scrolling levels; every jump, stomp, spring and smash is fired by typing the word shown on it.
   Files: sprites.js (Kenney atlas, biomes, parallax), levels.js (arc maths + procedural segment assembler), game.js (this: runtime). */
(function () {
  'use strict';
  const TM = window.TM, WJ = window.WJ, C = TM.C, U = TM.U, D = TM.draw, P = D.P;
  const W = 1920, H = 1080, TS = WJ.TS;
  const HERO_COLORS = ['player', 'female', 'adventurer'];
  const ALL_COLORS = HERO_COLORS;
  const LEVELS = 5;
  const GRAV = 2600;
  const PACE_ON = new URLSearchParams(location.search).get('pace') !== '0';   // ?pace=0 turns adaptive pacing off (for comparisons)
  const LOOKAHEAD = PACE_ON ? 1250 : 2300;      // how far ahead of the hero a word can be typed (px)
  const MIN_PACE = 0.55;        // slow typists: hero eases off slightly instead of arriving early and waiting
  const MAX_PACE = 2.0;        // top run-speed multiplier when the player has typed ahead
  const clamp = U.clamp;
  const ease = U.ease;

  /* ---------- music: one tune per world ---------- */
  const songs = [
    TM.audio.song({ bpm: 124, roots: [36, 33, 29, 31], chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], wave: 'square',
      lead: [72, null, 76, null, 79, null, 76, null, 77, null, 76, null, 74, null, 72, null, 69, null, 72, null, 76, null, 72, null, 74, null, 72, null, 71, null, 67, null, 69, null, 72, null, 77, null, 76, null, 74, null, 72, null, 74, null, 76, null, 79, null, 77, null, 76, null, 74, null, 71, null, 74, null, 72, null, null, null] }),
    TM.audio.song({ bpm: 112, roots: [38, 34, 31, 33], chords: [[62, 65, 69], [58, 62, 65], [55, 58, 62], [57, 60, 64]], wave: 'triangle',
      lead: [74, null, null, 77, null, 74, null, null, 72, null, null, 70, null, 72, null, null, 69, null, null, 72, null, 69, null, null, 70, null, 72, null, 74, null, null, null] }),
    TM.audio.song({ bpm: 120, roots: [36, 43, 41, 43], chords: [[60, 64, 67], [59, 62, 67], [60, 65, 69], [59, 62, 67]], wave: 'square',
      lead: [76, null, 74, null, 72, null, 74, null, 76, null, 76, null, 76, null, null, null, 74, null, 74, null, 74, null, null, null, 76, null, 79, null, 79, null, null, null] }),
    TM.audio.song({ bpm: 132, roots: [41, 36, 43, 38], chords: [[65, 69, 72], [60, 64, 67], [67, 71, 74], [62, 65, 69]], wave: 'sine', pad: 'triangle',
      lead: [84, null, 81, null, 77, null, 81, null, 84, null, 84, null, 81, null, 77, null, 79, null, 76, null, 72, null, 76, null, 79, null, 79, null, 76, null, null, null] }),
    TM.audio.song({ bpm: 104, roots: [33, 29, 36, 31], chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], wave: 'triangle', pad: 'sine',
      lead: [81, null, null, null, 84, null, null, 81, null, null, 79, null, null, null, 76, null, 77, null, null, null, 81, null, null, 77, null, null, 76, null, null, null, 72, null] }),
  ];

  let S = null;       // run state
  WJ.dbg = () => S;
  let GG = null;      // framework game handle
  const URLQ = new URLSearchParams(location.search);

  /* ============================================================ state */
  function speedFor(g, li) {
    const m = g.diff === 'gentle' ? 0.86 : g.diff === 'turbo' ? 1.16 : 1;
    return (305 + li * 30) * m;
  }
  function reset(g) {
    GG = g;
    const demo = g.demo;
    S = {
      picker: WJ.makePicker(g), li: URLQ.get('level') ? clamp(parseInt(URLQ.get('level'), 10) - 1 || 0, 0, LEVELS - 1) : demo ? Math.floor(Math.random() * LEVELS) : 0, hearts: 3, maxHearts: 3, hero: null, L: null,
      heroCol: URLQ.get('hero') && ALL_COLORS.includes(URLQ.get('hero')) ? URLQ.get('hero') : HERO_COLORS[Math.floor(Math.random() * HERO_COLORS.length)],
      t: 0, parts: [], phase: 'play', phaseT: 0, banner: null, cam: { x: 0, y: 0, ty: 0 }, fade: 1, proj: { z: 1, gl: 800, vx: 0, vy: 0, sc: 1, anchor: 520 },
      coinsAll: 0, coinTotAll: 0, starsAll: 0, levelStars: [], lvl: null, bot: new TM.Bot(7.5), botJit: 0, runT: 0, shakeX: 0,
      toast: null, chipRects: [], dbgOverlap: 0,
      pc: { speed: 1, ts: 1, cpc: 0.4, react: 0.8, lastKeyT: -9, lastDoneT: 0, snap: 0, snapX: 0, snapY: 0, lead: 0, tw: 0, bt: false },
    };
    // every popup (ours and the framework's) goes through one small, non-stacking toast in a safe zone
    g.fx.pop = (x, y, str, o) => toast(str, o || {});
    loadLevel(g, S.li, true);
  }

  function loadLevel(g, li, first) {
    S.li = li;
    S.L = WJ.buildLevel({ index: li, picker: S.picker, speed: speedFor(g, li), diff: g.diff, seed: Math.floor(Math.random() * 1e9) });
    const L = S.L;
    for (const o of L.obs) { if (o.item) o.typer = new TM.Typer(o.item); o.px = o.x; }
    S.oi = 0; S.t = 0; S.parts.length = 0; S.cp = L.flags[0];
    S.hero = { x: L.startX, y: 0, surfY: 0, st: 'idle', leg: null, legs: [], li: 0, ob: null, rot: 0, sq: 0, sqv: 0, walkT: 0, teeterT: 0, rideT: 0, mp: null, rideOff: 0, inv: 0, dust: 0, celT: 0, vx: 0, vy: 0, wait: 0, trail: 0, flipDir: 1 };
    S.cam.x = L.startX - 520; S.cam.y = 0; S.cam.ty = 0;
    S.lvl = { keys: 0, bad: 0, lost: 0, coins: 0 };
    S.phase = 'play'; S.phaseT = 0; S.fade = first ? 0 : 1;
    S.banner = { t: 0, text: 'Level ' + (li + 1), sub: L.biome.name };
    S.anyKey = false; S.toast = null; if (S.pc) { S.pc.speed = 1; S.pc.ts = 1; S.pc.lastDoneT = S.runT; S.pc.lastKeyT = -9; }
    if (!first && GG && GG.state === 'play' && !g.demo) TM.audio.startMusic(songs[L.biome.music % songs.length]);
    WJ.preloadSounds();
  }

  /* ============================================================ helpers */
  const mpX = (mp, t) => mp.cx + mp.A * Math.sin((t / mp.P) * Math.PI * 2 + mp.ph);
  const mpY = (mp, t) => mp.y + Math.sin(t * 2.3 + mp.ph) * mp.bob;
  const active = (g) => g.state === 'play' || g.demo;

  function emit(k, x, y, vx, vy, life, size, col, extra) {
    const ps = S.parts; if (ps.length > 360) return;
    const p = { k, x, y, vx, vy, life, t: 0, size, col, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 10, g: 0 };
    if (extra) Object.assign(p, extra);
    ps.push(p);
  }
  function dustPuff(x, y, n, spread) {
    if (TM.settings.reduceMotion) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) emit('puff', x + (Math.random() - 0.5) * 20, y - 4, (Math.random() - 0.5) * (spread || 160), -20 - Math.random() * 50, 0.4 + Math.random() * 0.3, 8 + Math.random() * 10, 'rgba(255,255,255,0.75)', { grow: 26 });
  }
  function sparkBurst(x, y, n, cols) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = 120 + Math.random() * 380; emit('star', x, y, Math.cos(a) * sp, Math.sin(a) * sp - 120, 0.5 + Math.random() * 0.5, 9 + Math.random() * 12, cols ? cols[i % cols.length] : '#FFD93D', { g: 900 }); }
  }
  function coinBurst(x, y, n) {
    for (let i = 0; i < n; i++) emit('coin', x, y, (Math.random() - 0.5) * 380, -520 - Math.random() * 360, 0.9 + Math.random() * 0.3, 1, null, { g: 1700, spin: Math.random() * 6 });
  }
  function w2v(wx, wy) { const p = S.proj; return { x: p.vx + (wx - S.cam.x) * p.z, y: p.vy + (p.gl - S.cam.y + wy) * p.z }; }

  function coinGot(g, c) {
    c.got = true; const val = c.kind === 'star' ? 5 : c.kind === 'gem' ? 3 : 1;
    if (c.kind === 'heart') {
      if (S.hearts < S.maxHearts) { S.hearts++; const v = w2v(c.x, c.y - 40); g.fx.pop(v.x, v.y, '+1 heart!', { color: '#FF5A8F', size: 54 }); WJ.sound('powerUp7', 0.5); sparkBurst(c.x, c.y, 12, ['#FF8FC8', '#fff']); return; }
      c.kind = 'gem';
    }
    S.lvl.coins += val; S.coinsAll += val;
    if (!g.demo) g.score.add(10 * val * g.score.mult);
    sparkBurst(c.x, c.y, c.kind === 'coin' ? 4 : 10, c.kind === 'star' ? ['#FFD93D', '#fff'] : null);
    WJ.sound(c.kind === 'coin' ? 'twoTone2' : 'powerUp4', c.kind === 'coin' ? 0.28 : 0.45);
    if (c.kind !== 'coin') { const v = w2v(c.x, c.y - 30); g.fx.pop(v.x, v.y, '+' + 10 * val, { color: '#FFD93D', size: 44, life: 0.8 }); }
  }

  /* ---- popups: ONE small toast, parked in the safe zone left of the hero (words only ever live ahead/right of him) ---- */
  function toast(str, o) {
    const prio = o.prio != null ? o.prio : /COMBO|Bonk|Splash|Checkpoint|heart/.test(str) ? 3 : /Speedy/.test(str) ? 2 : /^\+\d/.test(str) && o.size < 50 ? 0 : 1;
    const cur = S.toast;
    if (cur && prio < cur.prio && cur.t < cur.life * 0.7) return;   // never stack: a more important message wins, small ones are dropped
    S.toast = { str, color: o.color || '#FFD93D', size: Math.min(o.size || 40, /COMBO/.test(str) ? 54 : 44), t: 0, life: Math.min(o.life || 0.9, 1.1), prio };
  }
  function drawToast(ctx, v) {
    const T = S.toast; if (!T || S.phase !== 'play') return;
    const h = S.hero, hv = w2v(h.x, h.surfY), k = T.t / T.life;
    const w = T.str.length * T.size * 0.56 + 30, hh = T.size + 20;
    let cx = Math.max(v.x + w / 2 + 20, hv.x - 120 - w / 2), cy = hv.y - 230;
    for (let tries = 0; tries < 5; tries++) { // belt and braces: slide away from any word chip
      const r = { x: cx - w / 2, y: cy - hh / 2, w, h: hh };
      if (!S.chipRects.some((c) => r.x < c.x + c.w && r.x + r.w > c.x && r.y < c.y + c.h && r.y + r.h > c.y)) break;
      S.dbgOverlap++; cy += 90; if (tries === 4) return;
    }
    const s = k < 0.18 ? ease.outBack(k / 0.18) : 1;
    ctx.save(); ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; ctx.translate(cx, cy - k * 30); ctx.scale(s, s);
    D.text(ctx, T.str, 0, 0, { size: T.size, color: T.color, outline: 8 });
    ctx.restore();
  }

  /* ============================================================ obstacle logic */
  function nextOb() { const o = S.L.obs; while (S.oi < o.length && (o[S.oi].status === 'cleared' || o[S.oi].status === 'skipped')) S.oi++; return o[S.oi] || null; }

  function targetOb() {
    const h = S.hero, obs = S.L.obs;
    for (let i = S.oi; i < obs.length; i++) {
      const o = obs[i];
      if (!o.item || o.status !== 'todo') continue;
      if (o.launchX - h.x > LOOKAHEAD) return null;
      return o;
    }
    return null;
  }
  function targetsTwo() {
    const h = S.hero, obs = S.L.obs; const r = [];
    for (let i = S.oi; i < obs.length && r.length < 2; i++) { const o = obs[i]; if (o.item && o.status === 'todo' && o.launchX - h.x < LOOKAHEAD + 300) r.push(o); }
    return r;
  }

  function completeWord(g, ob) {
    ob.status = 'ready'; ob.readyT = S.t;
    const pc = S.pc; pc.lastDoneT = S.runT;
    if (pc.ts < 0.8 && !g.demo) { pc.snap = 0.45; TM.sfx.whoosh(); }   // bullet time ends: snap back to full speed with a whoosh
    pc.ts = 1;
    const h = S.hero, early = (ob.launchX - h.x) > speedFor(g, S.li) * 0.9 && h.st === 'run';
    const a = chipPos(ob), bonus = early ? 1.5 : 1;
    g.wordDone(ob.typer, a.x, a.y, { bonus, color: C.jumper });
    if (early && !g.demo) g.fx.pop(a.x, a.y - 70, 'Speedy!', { color: '#FF8A1F', size: 40, life: 0.8 });
    const w = { x: ob.x, y: ob.anchorY == null ? -200 : ob.anchorY };
    sparkBurst(ob.x, w.y + 60, 10, ['#6CCB3C', '#FFD93D', '#fff']);
  }

  function onKey(g, k) {
    if (!S) return;
    if (S.phase === 'rating') { if (k === ' ') proceed(g); return; }
    if (S.phase !== 'play') return;
    const h = S.hero;
    if (h.st === 'fall' || h.st === 'bonk' || h.st === 'dead' || h.st === 'respawn') return;
    const t = targetOb(); if (!t) return;
    const pos0 = t.typer.pos, pc = S.pc;
    const r = t.typer.feed(k);
    g.keyResult(r);
    if (r !== 'miss') { // rolling estimate of this player's typing speed
      if (pos0 === 0) pc.react += (clamp(S.runT - pc.lastDoneT, 0.12, 3) - pc.react) * 0.3;
      else { const iv = S.runT - pc.lastKeyT; if (iv < 2) pc.cpc = clamp(pc.cpc + (iv - pc.cpc) * 0.25, 0.07, 1.2); }
      pc.lastKeyT = S.runT;
    }
    S.lvl.keys++; if (r === 'miss') S.lvl.bad++;
    if (r === 'done') completeWord(g, t);
  }

  /* ---- hero actions ---- */
  function cloneLeg(l) { return Object.assign({}, l, { t: 0 }); }

  function legsFor(g, ob) {
    const h = S.hero, ly = ob.ly;
    switch (ob.type) {
      case 'gap': case 'bossgap': case 'hop': case 'qblock': {
        const legs = ob.legs.map(cloneLeg);
        legs[0].flip = ob.flip; if (ob.type === 'qblock') legs[0].apex = () => bumpBlock(g, ob);
        if (ob.boss) legs[0].big = true;
        return legs;
      }
      case 'spring': {
        const legs = ob.legs.map(cloneLeg);
        legs[0].land = () => { ob.sprT = 0.45; WJ.sound('pepSound5', 0.5); dustPuff(ob.springX, ob.ly, 6); sparkBurst(ob.springX, ob.ly - 40, 8); };
        legs[1].flip = true; legs[1].start = () => { ob.sprT = 0; WJ.sound('highUp', 0.5); g.fx.shake(5, 0.12); sparkBurst(ob.springX, ob.ly - 70, 10, ['#FFD93D', '#fff', '#FF8A1F']); };
        return legs;
      }
      case 'enemy': case 'boss': {
        const big = ob.type === 'boss';
        ob.frozen = true; const ex = ob.px;
        const topY = ly - ob.fh - ob.eh + (big ? 18 : 10);
        const H1 = ob.fh + ob.eh + (big ? 140 : 100), a1 = WJ.arc(h.x, ly, ex, topY, H1, WJ.arcT(ex - h.x, H1) + (big ? 0.12 : 0));
        a1.land = () => stompEnemy(g, ob); a1.big = big;
        const tx = big ? ob.tx : ex + 1.7 * TS, H2 = big ? 360 : 80 + ob.fh * 0.2;
        const a2 = WJ.arc(ex, topY, tx, ly, H2, WJ.arcT(tx - ex, H2) * (big ? 1.05 : 0.9)); a2.flip = big; a2.bounce = true;
        return [a1, a2];
      }
      case 'crates': {
        const l = cloneLeg(ob.legs[0]); l.crash = () => smashCrates(g, ob); return [l];
      }
      case 'mplatIn': {
        const mp = ob.mp, lx = h.x; let T = 0.85, ex = 0, ey = 0; const H1 = 140;
        for (let i = 0; i < 5; i++) { ex = mpX(mp, S.t + T); ey = mpY(mp, S.t + T); T = WJ.arcT(ex - lx, H1) + 0.05; }
        ex = mpX(mp, S.t + T); ey = mpY(mp, S.t + T);
        const a = WJ.arc(lx, ly, ex, ey, H1, T); a.mpLand = mp; a.T = T; return [a];
      }
      case 'mplatOut': {
        const dx = ob.landX - h.x, H1 = 150 + Math.abs(dx) * 0.12, a = WJ.arc(h.x, h.y, ob.landX, ob.ly, H1, WJ.arcT(dx, H1) + 0.08); a.flip = true; return [a];
      }
      case 'drop': {
        const dy = ob.dy, T = Math.sqrt((2 * dy) / 2300) + 0.02, a = WJ.arc(h.x, h.y, h.x + speedFor(g, S.li) * T, h.y + dy, 0, T); a.drop = true; return [a];
      }
    }
    return [];
  }

  function execute(g, ob) {
    const h = S.hero;
    ob.status = 'exec'; h.ob = ob; h.legs = legsFor(g, ob); h.li = 0;
    if (ob.type !== 'mplatOut' && ob.type !== 'drop') h.x = ob.launchX;
    startLeg(g);
  }
  function startLeg(g) {
    const h = S.hero, l = h.legs[h.li]; h.leg = l; l.t = 0;
    if (l.k === 'dash') { h.st = 'dash'; h.y = l.y; WJ.sound('pepSound3', 0.4); h.dashStart = h.x; return; }
    h.st = 'arc'; if (!l.drop && !l.bounce) { h.sqv = -9; WJ.sound(l.big || l.flip ? 'phaseJump3' : 'phaseJump1', 0.38); dustPuff(h.x, h.y, 4, 100); }
    if (l.bounce) { h.sqv = -8; WJ.sound('pepSound1', 0.45); }
    if (l.start) l.start();
    h.flipDir = 1; h.tgtY = l.y1;
    if (h.mp) { h.mp = null; }
  }
  function landLeg(g) {
    const h = S.hero, l = h.leg, ob = h.ob;
    h.x = l.x1; h.y = l.y1; h.rot = 0;
    if (l.land) l.land();
    if (l.mpLand) { h.st = 'ride'; h.mp = l.mpLand; h.rideT = 0; h.rideOff = h.x - mpX(h.mp, S.t); h.sq = 0.5; h.sqv = 0; WJ.sound('slime_000', 0.35); dustPuff(h.x, h.y, 4, 80); h.leg = null; ob.status = 'cleared'; h.ob = null; return; }
    h.sq = l.drop ? 0.35 : l.big ? 0.8 : 0.55; h.sqv = 0;
    if (!l.drop || true) { dustPuff(h.x - 10, h.y, l.big ? 12 : 7, 220); TM.sfx.land(); }
    if (l.big) g.fx.shake(9, 0.18);
    if (h.li + 1 < h.legs.length) { h.li++; startLeg(g); return; }
    h.leg = null; h.legs = []; h.st = 'run'; h.surfY = h.y;
    if (ob) { ob.status = 'cleared'; h.ob = null; }
  }
  function bumpBlock(g, ob) {
    if (ob.opened) return; ob.opened = true; ob.bump = 1; WJ.sound('impactMetal_001', 0.35);
    g.fx.shake(4, 0.1);
    const bx = ob.x, by = ob.by - TS / 2;
    if (ob.reward === 'heart' && S.hearts < S.maxHearts && !g.demo) { const c = { x: bx, y: by - 80, kind: 'heart', got: false, ph: 0 }; S.L.coins.push(c); c.pop = 1; }
    else { coinBurst(bx, by - 20, 7); S.lvl.coins += 0; for (let i = 0; i < 7; i++) { S.L.total; } S.coinsAll += 0; if (!g.demo) g.score.add(70 * g.score.mult); S.lvl.coins += 5; S.L.total += 5; S.coinsAll += 5; WJ.sound('twoTone1', 0.5); const v = w2v(bx, by - 60); g.fx.pop(v.x, v.y, '+70', { color: '#FFD93D', size: 46, life: 0.8 }); }
    sparkBurst(bx, by, 8);
  }
  function stompEnemy(g, ob) {
    ob.sqT = 0.0001; ob.stomped = true;
    const x = ob.px, y = ob.ly - ob.fh - ob.eh / 2;
    WJ.sound(ob.type === 'boss' ? 'explosionCrunch_000' : 'pepSound3', ob.type === 'boss' ? 0.5 : 0.55);
    sparkBurst(x, y, ob.type === 'boss' ? 26 : 10, ['#FFD93D', '#fff', '#FF8FC8']);
    for (let i = 0; i < (ob.type === 'boss' ? 14 : 5); i++) emit('puff', x + (Math.random() - 0.5) * ob.eh, y + (Math.random() - 0.3) * ob.eh * 0.7, (Math.random() - 0.5) * 240, -80 - Math.random() * 120, 0.5 + Math.random() * 0.3, 14 + Math.random() * 16, 'rgba(255,255,255,0.9)', { grow: 40 });
    coinBurst(x, y, ob.type === 'boss' ? 14 : 4);
    if (!g.demo) g.score.add((ob.type === 'boss' ? 60 : 20) * g.score.mult);
    g.fx.shake(ob.type === 'boss' ? 16 : 6, ob.type === 'boss' ? 0.3 : 0.12);
    if (ob.type === 'boss') g.fx.doFlash('#fff', 0.35);
    S.lvl.coins += ob.type === 'boss' ? 7 : 2; S.coinsAll += ob.type === 'boss' ? 7 : 2; S.L.total += ob.type === 'boss' ? 7 : 2;
  }
  function smashCrates(g, ob) {
    ob.broken = true; WJ.sound('explosionCrunch_000', 0.55); g.fx.shake(12, 0.22);
    for (let i = 0; i < ob.n; i++) for (let j = 0; j < 4; j++) emit('brick', ob.wx + TS / 2, ob.ly - TS * (i + 0.5), 200 + Math.random() * 500, -300 - Math.random() * 500, 1.1, 1, null, { g: 1900, key: ['i/particleBrick1a', 'i/particleBrick1b', 'i/particleBrick2a', 'i/particleBrick2b'][(i + j) % 4] });
    for (let i = 0; i < ob.n; i++) emit('puff', ob.wx + TS / 2, ob.ly - TS * (i + 0.5), 100, -40, 0.5, 20, 'rgba(255,255,255,0.8)', { grow: 50 });
    coinBurst(ob.wx + TS / 2, ob.ly - TS, 5); S.lvl.coins += 3; S.coinsAll += 3; S.L.total += 3;
    if (!g.demo) g.score.add(40 * g.score.mult);
  }

  /* ---- failing & respawning ---- */
  function failOb(g, ob) {
    const h = S.hero; ob.fails = (ob.fails || 0) + 1;
    g.missWord(ob.item);
    TM.sfx.hurt(); WJ.sound('lowRandom', 0.5);
    const lose = !g.demo && g.diff !== 'gentle';
    if (lose) { S.hearts--; S.lvl.lost++; }
    const pit = ob.type === 'gap' || ob.type === 'bossgap' || ob.type === 'mplatIn';
    if (pit) { h.st = 'fall'; h.vx = 150; h.vy = -380; h.wait = 0; }
    else { h.st = 'bonk'; h.vx = -260; h.vy = -620; h.wait = 0; S.hurtSq = 0; }
    h.fail = ob; h.inv = 0;
    g.fx.shake(14, 0.22);
    const v = w2v(h.x, h.y - 150); g.fx.pop(v.x, v.y, pit ? 'Splash!' : 'Bonk!', { color: '#FF5A5F', size: 60 });
    if (lose && S.hearts <= 0) { h.dead = true; }
  }
  function respawn(g) {
    const h = S.hero, cp = S.cp;
    if (h.dead) {
      h.st = 'dead';
      g.end({ win: false, title: 'Nice try!', sub: `You reached level ${S.li + 1}: ${S.L.biome.name}.`, targetMet: S.li >= 2, stats: [['Level', S.li + 1], ['Coins', S.coinsAll]] });
      return;
    }
    const obs = S.L.obs;
    for (const o of obs) {
      if (o.launchX > cp.x + 4) { o.status = 'todo'; if (o.item) o.typer = new TM.Typer(o.item); o.frozen = false; o.sqT = 0; o.stomped = false; o.broken = false; o.opened = false; o.bump = 0; o.sprT = 0; o.px = o.x; }
    }
    S.oi = 0; nextOb();
    h.x = cp.x + 0.2 * TS; h.y = cp.y - 520; h.surfY = cp.y; h.st = 'arc'; h.ob = null; h.mp = null;
    const a = WJ.arc(h.x, h.y, h.x + 0.1 * TS, cp.y, 0, 0.52); a.drop = true; a.respawn = true;
    h.legs = [a]; h.li = 0; h.leg = a; a.t = 0; h.inv = 2.2; h.tgtY = cp.y; S.camSnap = 1.2; h.fail = null;
    sparkBurst(h.x, cp.y - 60, 14, ['#fff', '#8EE0FF', '#FFD93D']); WJ.sound('threeTone2', 0.35);
    S.fade = 0.6;
  }

  /* ---- level complete / rating ---- */
  function levelDone(g) {
    const h = S.hero; h.st = 'celebrate'; h.celT = 0; S.phase = 'celeb'; S.phaseT = 0;
    const gx = S.L.goalX; sparkBurst(gx, -200, 30);
    const v = w2v(gx, -240); g.fx.confetti(v.x, v.y, 70); WJ.sound('powerUp7', 0.6); TM.sfx.win();
    // rating
    const lv = S.lvl, acc = lv.keys ? 1 - lv.bad / lv.keys : 1, frac = S.L.total ? lv.coins / S.L.total : 1;
    const gentle = g.diff === 'gentle';
    const crit = [{ t: 'Level cleared!', ok: true }, { t: `Accuracy ${gentle ? 80 : 90}%+`, ok: acc >= (gentle ? 0.8 : 0.9), v: Math.round(acc * 100) + '%' }, { t: `Coins ${gentle ? 55 : 70}%+`, ok: frac >= (gentle ? 0.55 : 0.7), v: Math.round(frac * 100) + '%' }];
    const stars = crit.filter((c) => c.ok).length;
    S.rating = { crit, stars, acc, frac, coins: lv.coins, total: S.L.total, lost: lv.lost, shown: 0 };
    S.levelStars.push(stars); S.starsAll += stars;
    S.coinTotAllNow = (S.coinTotAllNow || 0) + S.L.total;
    if (!g.demo) { g.score.add(100 * (S.li + 1) + 60 * stars); if (S.hearts < S.maxHearts) S.hearts++; }
  }
  function proceed(g) {
    if (S.phase !== 'rating') return;
    if (S.li + 1 >= LEVELS) {
      const avg = S.starsAll / LEVELS;
      g.end({ win: true, title: 'You did it!', sub: `All ${LEVELS} worlds cleared with ${S.starsAll} stars!`, targetMet: avg >= 2, stats: [['Stars', S.starsAll + '/' + LEVELS * 3], ['Coins', S.coinsAll]] });
      S.phase = 'end'; return;
    }
    S.phase = 'fadeout'; S.phaseT = 0;
  }

  /* ============================================================ update */
  /* ---------- adaptive pacing: run faster when the player has typed ahead, bullet-time near the word being typed ---------- */
  function frontier() { // first word the player has not finished yet
    const o = S.L.obs;
    for (let i = S.oi; i < o.length; i++) if (o[i].item && o[i].status === 'todo') return o[i];
    return null;
  }
  function remainingTime(o) { // estimated seconds the player still needs for this word
    const t = o.typer, pc = S.pc;
    if (!o.req) o.req = t.chars.filter((c) => !c.opt).length || 1;
    const left = Math.max(0, o.req - t.typedReq);
    return left * pc.cpc + (t.pos === 0 ? pc.react : 0);
  }
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  function pacing(g, rdt) {
    const pc = S.pc, h = S.hero;
    let spT = 1, tsT = 1;
    const live = PACE_ON && !g.demo && g.state === 'play' && S.phase === 'play' && h.st !== 'fall' && h.st !== 'bonk' && h.st !== 'dead' && h.st !== 'celebrate';
    if (live) {
      const o = frontier(), v = speedFor(g, S.li);
      if (o) {
        const D = Math.max(0, o.launchX - h.x), tw = remainingTime(o);
        pc.lead = D; pc.tw = tw;
        // M = how fast the hero must move (in units of base speed) to reach the word exactly as the player finishes it
        const M = D / (v * Math.max(tw, 0.3) * 1.05);
        spT = clamp(M, MIN_PACE, MAX_PACE);                    // typed ahead -> run faster (up to 2x); slow typist -> ease off a little
        if (!o.req) o.req = o.typer.chars.filter((c) => !c.opt).length || 1;
        const Z = clamp(v * 1.2 + o.req * 18, 380, 900);   // longer words get a longer slow-mo run-up
        if (D < Z && !o.optional)                              // last stretch before the word: bullet time, as strong as this player needs (>= 0.25x)
          tsT = 1 - (1 - clamp(M / MIN_PACE, 0.25, 1)) * smooth(1.25 * (1 - D / Z));
      } else pc.lead = 0;
    }
    pc.speed += (spT - pc.speed) * (1 - Math.exp(-rdt * (spT > pc.speed ? 2.2 : 4)));
    if (tsT < pc.ts) pc.ts += (tsT - pc.ts) * (1 - Math.exp(-rdt * 7)); else pc.ts = Math.min(tsT, pc.ts + rdt * 4);
    if (TM.settings.reduceMotion) pc.ts = Math.max(pc.ts, 0.5);
    if (pc.snap > 0) pc.snap -= rdt;
    if (pc.ts < 0.7 && !pc.bt) { pc.bt = true; WJ.sound('forceField_001', 0.25); } else if (pc.ts > 0.9) pc.bt = false;
  }

  function update(g, dt) {
    if (!S) return;
    const L = S.L, h = S.hero, v = speedFor(g, S.li);
    const rdt = dt;                      // real time (UI, timers that must stay forgiving)
    S.runT += dt;
    // banner & fade
    if (S.banner) { S.banner.t += dt; if (S.banner.t > 2.6) S.banner = null; }
    if (S.toast) { S.toast.t += dt; if (S.toast.t > S.toast.life) S.toast = null; }
    if (S.fade > 0 && S.phase !== 'fadeout') S.fade = Math.max(0, S.fade - dt * 2.2);
    pacing(g, rdt);
    dt *= S.pc.ts;                       // world time (bullet time)
    // particles always
    updateParts(dt);
    if (g.state === 'countdown') { camFollow(g, dt, true); h.walkT += dt; return; }
    const act = active(g);
    if (!act && g.state !== 'over') return;
    if (g.state === 'over') { h.sq += (0 - h.sq) * dt * 6; camFollow(g, dt); return; }
    S.t += dt;
    if (h.inv > 0) h.inv -= dt;
    // hero squash spring
    h.sqv -= (h.sq * 260 + h.sqv * 16) * dt; h.sq += h.sqv * dt;

    if (S.phase === 'fadeout') { S.phaseT += dt; S.fade = Math.min(1, S.phaseT * 2.2); if (S.phaseT > 0.5) loadLevel(g, (S.li + 1) % LEVELS, false), S.phase = 'play'; camFollow(g, dt); return; }
    if (S.phase === 'celeb') {
      S.phaseT += dt; h.celT += dt;
      h.y = h.surfY - Math.abs(Math.sin(h.celT * 5)) * 70;
      h.x += (L.goalX + 40 - h.x) * Math.min(1, dt * 3);
      if (S.phaseT > 0.9 && Math.random() < dt * 14) emit('star', h.x + (Math.random() - 0.5) * 300, h.y - 200 - Math.random() * 120, (Math.random() - 0.5) * 80, 120, 0.9, 12, ['#FFD93D', '#FF8FC8', '#6CCB3C', '#8EE0FF'][Math.floor(Math.random() * 4)], { g: 100 });
      if (g.demo) { if (S.phaseT > 1.6) { S.phase = 'fadeout'; S.phaseT = 0; } }
      else if (S.phaseT > 1.5) { S.phase = 'rating'; S.phaseT = 0; }
      camFollow(g, dt); return;
    }
    if (S.phase === 'rating') {
      S.phaseT += dt; h.celT += dt; h.y = h.surfY - Math.abs(Math.sin(h.celT * 5)) * 55;
      const r = S.rating; const want = Math.min(3, Math.floor(S.phaseT / 0.55));
      while (r.shown < want) { if (r.shown < r.stars) { TM.sfx.star(r.shown); sparkBurst(S.cam.x + 700 + r.shown * 140, -300, 8); } r.shown++; }
      if (S.phaseT > 16) proceed(g);
      camFollow(g, dt); return;
    }

    // demo bot
    if (g.demo) {
      const t = targetOb();
      if (t && t.launchX - h.x < 1500) { S.bot.rate = 6 + (S.li % 3) * 1.5; S.bot.step(dt, t.typer, (r) => { if (r === 'done') completeWord(g, t); }); }
    }
    // enemy patrol
    for (const o of L.obs) {
      if (!o.def) continue;
      if (!o.frozen && o.type !== 'boss') { o.px = o.x + Math.sin(S.t * (o.air ? 1.5 : 1.2) + o.phase) * (o.air ? 0.55 : 0.28) * TS; }
      if (o.sqT > 0) { o.sqT += dt; }
    }
    for (const o of L.obs) { if (o.bump > 0) o.bump = Math.max(0, o.bump - dt * 4); if (o.sprT > 0) o.sprT = Math.max(0, o.sprT - dt); }

    stepHero(g, dt, v, rdt);
    // coins
    const hy = h.y - 62;
    for (const c of L.coins) {
      if (c.got) continue;
      if (c.pop) { c.y -= 0; }
      if (Math.abs(c.x - h.x) < 58 && Math.abs(c.y - hy) < 76) coinGot(g, c);
    }
    // checkpoints
    for (const f of L.flags) if (!f.hit && h.x >= f.x) { f.hit = true; f.t = 0; S.cp = f; WJ.sound('threeTone1', 0.4); sparkBurst(f.x, f.y - 100, 14, ['#6CCB3C', '#fff', '#FFD93D']); const vv = w2v(f.x, f.y - 190); g.fx.pop(vv.x, vv.y, 'Checkpoint!', { color: '#6CCB3C', size: 46 }); }
    for (const f of L.flags) if (f.hit && f.t != null) f.t += dt;
    // trail at high combo
    if (!g.demo && g.score.mult >= 2 && h.st !== 'idle') { h.trail -= dt; if (h.trail <= 0) { h.trail = 0.05; emit('star', h.x - 30, h.y - 50 + (Math.random() - 0.5) * 50, -90, 10, 0.5, 8 + Math.random() * 6, g.score.mult >= 3 ? '#FF8FC8' : '#FFD93D', { g: 0 }); } }
    camFollow(g, rdt);
    if (S.camSnap > 0) S.camSnap -= rdt;
  }

  function stepHero(g, dt, v, rdt) {
    const h = S.hero, L = S.L, sp = S.pc.speed;
    switch (h.st) {
      case 'idle': h.st = 'run'; break;
      case 'run': {
        h.x += v * sp * dt; h.walkT += dt * v * sp / 260; h.y = h.surfY;
        h.dust -= dt; if (h.dust <= 0) { h.dust = 0.16 / sp; dustPuff(h.x - 24, h.y, sp > 1.3 ? 2 : 1, 60 + sp * 40); }
        if (h.x >= L.goalX && !S.L.done) { S.L.done = true; levelDone(g); return; }
        const ob = nextOb();
        if (ob && h.x >= ob.launchX) {
          if (ob.type === 'drop') { execute(g, ob); break; }
          if (ob.status === 'ready') { execute(g, ob); break; }
          if (ob.optional) { ob.status = 'skipped'; break; }
          if (ob.type === 'mplatOut') break;
          h.x = ob.launchX; h.st = 'teeter'; h.teeterT = 0; h.teeterR = 0; h.ob = ob; S.teeterOb = ob;
        }
        break;
      }
      case 'teeter': {
        const ob = h.ob; h.teeterT += dt; h.teeterR = (h.teeterR || 0) + rdt; h.walkT = 0;
        if (ob.status === 'ready') { h.st = 'run'; execute(g, ob); break; }
        const len = ob.item ? ob.item.len : 5;
        const grace = (g.diff === 'gentle' ? 7 : g.diff === 'turbo' ? 3 : 4.5) + len * (g.diff === 'gentle' ? 1.0 : g.diff === 'turbo' ? 0.4 : 0.7);
        if (g.demo) { if (h.teeterT > 9) failOb(g, ob); break; }
        if (h.teeterR > grace) failOb(g, ob);   // grace is real time, not slowed by bullet time
        break;
      }
      case 'arc': {
        const l = h.leg; l.t += dt * (l.mpLand || l.respawn || l.drop ? 1 : 1 + Math.max(0, sp - 1) * 0.7);   // jumps are a bit quicker while catching up (not onto moving platforms: those are timed)
        const t = Math.min(l.t, l.T), p = WJ.arcPos(l, t); h.x = p.x; h.y = p.y;
        const f = t / l.T;
        const vy = -l.vy + l.g * t; h.avy = vy;
        if (l.flip) h.rot = Math.PI * 2 * ease.inOut(f);
        else h.rot = clamp(vy * 0.00055, -0.25, 0.4);
        if (l.apex && !l.apexDone && t >= l.vy / l.g) { l.apexDone = true; l.apex(); }
        if (l.t >= l.T) { h.rot = 0; landLeg(g); }
        if (h.st === 'arc' && Math.random() < dt * 20 && l.big) emit('star', h.x - 20, h.y - 60, -60, 20, 0.4, 8, '#fff', { g: 0 });
        break;
      }
      case 'dash': {
        const l = h.leg; l.t += dt; const f = Math.min(1, l.t / l.T);
        h.x = l.x0 + (l.x1 - l.x0) * (f * (2 - f) * 0.6 + f * 0.4); h.y = l.y; h.rot += dt * 22;
        h.dust -= dt; if (h.dust <= 0) { h.dust = 0.03; dustPuff(h.x - 30, h.y, 1, 100); }
        if (l.crash && h.x >= l.crashX) { l.crash(); l.crash = null; }
        if (f >= 1) { h.rot = 0; h.sq = 0.3; h.leg = null; h.st = 'run'; h.surfY = l.y; if (h.ob) { h.ob.status = 'cleared'; h.ob = null; } }
        break;
      }
      case 'ride': {
        h.rideT += dt; const mp = h.mp; h.rideOff *= Math.pow(0.02, dt);
        h.x = mpX(mp, S.t) + h.rideOff; h.y = mpY(mp, S.t) ; h.surfY = h.y; h.tgtY = L.spans[0].y;
        const ob = nextOb();
        if (ob && ob.type === 'mplatOut' && ob.status === 'ready' && h.rideT > 0.45) { h.mp = null; execute(g, ob); }
        break;
      }
      case 'fall': {
        h.wait += dt; h.vy += GRAV * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += dt * 5;
        const liq = TS * 0.6;
        if (h.y > liq && !h.splashed) { h.splashed = true; WJ.sound('slime_000', 0.55); for (let i = 0; i < 16; i++) emit('drop', h.x, liq, (Math.random() - 0.5) * 420, -300 - Math.random() * 500, 0.8, 7 + Math.random() * 7, S.L.biome.liquid === 'lava' ? '#FF8A1F' : S.L.biome.liquid === 'ice' ? '#BDF1FF' : '#8EE0FF', { g: 1800 }); }
        if (h.y > TS * 3) h.vy = 0;
        if (h.wait > 1.1) { h.splashed = false; h.rot = 0; respawn(g); }
        break;
      }
      case 'bonk': {
        h.wait += dt; h.vy += GRAV * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.vx *= Math.pow(0.2, dt);
        if (h.y >= h.surfY) { h.y = h.surfY; h.vy = 0; h.vx = 0; }
        if (h.wait > 0.95) respawn(g);
        break;
      }
      case 'dead': break;
    }
  }

  function updateParts(dt) {
    const ps = S.parts; let n = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]; p.t += dt; if (p.t >= p.life) continue;
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.k === 'puff') { p.vx *= Math.pow(0.1, dt); p.vy *= Math.pow(0.1, dt); }
      ps[n++] = p;
    }
    ps.length = n;
  }

  function camFollow(g, dt, snap) {
    const h = S.hero, p = S.proj, cam = S.cam;
    const tx = h.x - p.anchor / 1 + (h.st === 'arc' ? 60 : 0);
    const k = snap || S.camSnap > 0 ? 1 - Math.pow(0.0005, dt) : 1 - Math.pow(0.004, dt);
    cam.x += (tx - cam.x) * k;
    const ty = Math.min(0, (h.tgtY != null ? h.tgtY : h.surfY) * 0.62);
    cam.y += (ty - cam.y) * (1 - Math.pow(0.02, dt));
  }

  /* ============================================================ drawing */
  function chipPos(ob) {
    const a = ob.def ? { x: ob.px, y: ob.anchorY } : { x: ob.x, y: ob.anchorY == null ? -240 : ob.anchorY };
    const p = w2v(a.x, a.y), vw = GG.vw();
    const sz = ob.item ? ob.item.len : 5;
    const cw = Math.min(900, sz * 28 + 80) / 2;
    return { x: clamp(p.x, vw.x + cw + 24, vw.x + vw.w - cw - 24), y: Math.max(p.y, vw.y + 230 / Math.max(0.3, vw.w ? window.innerWidth / vw.w : 1)) };
  }

  const patCache = {};
  function centerPattern(ctx, key) {
    if (patCache[key]) return patCache[key];
    if (!WJ.ready || !WJ.has(key)) return null;
    const c = document.createElement('canvas'); c.width = c.height = TS; const x = c.getContext('2d');
    WJ.tileFull(x, key, 0, 0, TS + 1, TS + 1);
    return (patCache[key] = ctx.createPattern(c, 'repeat'));
  }
  function drawTerrain(ctx, g, view, camX, bot) {
    const L = S.L, B = L.biome, x0 = camX - 120, x1 = camX + view.w + 120;
    const gk = B.ground;
    for (const s of L.spans) {
      if (s.x1 < x0 || s.x0 > x1) continue;
      const n = Math.round((s.x1 - s.x0) / TS);
      for (let i = 0; i < n; i++) {
        const x = s.x0 + i * TS; if (x + TS < x0 || x > x1) continue;
        const top = n === 1 ? 'Mid' : i === 0 && s.capL ? 'Left' : i === n - 1 && s.capR ? 'Right' : 'Mid';
        WJ.tile(ctx, gk + top, x, s.y);
      }
      const px0 = Math.max(s.x0, Math.floor(x0 / TS) * TS), px1 = Math.min(s.x1, x1), pat = centerPattern(ctx, gk + 'Center');
      if (pat && px1 > px0 && bot > s.y + TS) { ctx.fillStyle = pat; ctx.fillRect(px0, s.y + TS, px1 - px0, bot - s.y - TS + TS); }
    }
    // static floating platforms
    for (const p of L.plats) {
      if (p.x1 < x0 || p.x0 > x1) continue;
      const n = Math.round((p.x1 - p.x0) / TS);
      if (p.stem) {
        const mx = p.x0 + (n >> 1) * TS + TS / 2;
        WJ.tile(ctx, 'm/stemTopAlt', mx - TS / 2, p.y + 40);
        for (let y = p.y + 40 + TS; y < 0 + TS * 0.4; y += TS) WJ.tile(ctx, y + TS >= TS * 0.4 ? 'm/stemBase' : 'm/stem', mx - TS / 2, y);
      }
      for (let i = 0; i < n; i++) {
        const key = p.stem ? 'm/shroom' + (p.alt ? 'Tan' : 'Red') + (i === 0 ? 'Left' : i === n - 1 ? 'Right' : 'Mid') : B.plat + (i === 0 ? 'Left' : i === n - 1 ? 'Right' : 'Mid');
        WJ.tile(ctx, key, p.x0 + i * TS, p.y);
      }
      if (!p.stem) { ctx.fillStyle = 'rgba(31,26,61,0.10)'; ctx.fillRect(p.x0 + 6, p.y + 56, n * TS - 12, 6); }
    }
    for (const mp of L.mplats) {
      const x = mpX(mp, S.t), y = mpY(mp, S.t);
      if (x + 200 < x0 || x - 200 > x1) continue;
      const kk = B.platStem ? 'm/shroomTan' : B.plat;
      for (let i = 0; i < 3; i++) WJ.tile(ctx, kk + (i === 0 ? 'Left' : i === 2 ? 'Right' : 'Mid'), Math.round(x - 1.5 * TS + i * TS), Math.round(y));
      ctx.fillStyle = 'rgba(31,26,61,0.12)'; ctx.fillRect(x - 1.5 * TS + 8, y + 56, 3 * TS - 16, 6);
    }
  }

  function drawLiquid(ctx, view, camX, bot, t) {
    const L = S.L, B = L.biome, x0 = camX - 120, x1 = camX + view.w + 120;
    const top = B.liquid === 'lava' ? 't/liquidLavaTop_mid' : B.liquid === 'ice' ? 'ice/iceWaterMid' : 't/liquidWaterTop_mid';
    const fill = B.liquid === 'lava' ? 't/liquidLava' : B.liquid === 'ice' ? 'ice/iceWaterDeep' : 't/liquidWater';
    const sy = TS * 0.62;
    for (const p of L.pits) {
      if (p.x1 < x0 || p.x0 > x1) continue;
      const n = Math.round((p.x1 - p.x0) / TS);
      ctx.save(); ctx.globalAlpha = 0.93;
      for (let i = 0; i < n; i++) {
        const x = p.x0 + i * TS; if (x + TS < x0 || x > x1) continue;
        const wy = Math.sin(t * 2.2 + x * 0.02) * 4;
        WJ.tile(ctx, top, x, sy - 30 + wy);
        for (let y = sy + 66 + wy; y < bot; y += TS) WJ.tile(ctx, fill, x, y);
      }
      ctx.restore();
      if (B.liquid === 'lava') { ctx.fillStyle = 'rgba(255,200,80,0.25)'; ctx.fillRect(p.x0, sy - 120, p.x1 - p.x0, 90); }
    }
  }

  function drawDecor(ctx, camX, view) {
    const L = S.L, x0 = camX - 140, x1 = camX + view.w + 140;
    for (const d of L.decor) { if (d.x < x0 || d.x > x1) continue; WJ.spr(ctx, d.key, d.x, d.y + (d.key === 'i/bush' ? 28 : 0), { s: d.s, flip: d.flip }); }
    for (const f of L.flags) {
      if (f.x < x0 || f.x > x1 || f.start) continue;
      WJ.spr(ctx, f.hit ? ((Math.floor(S.t * 4) & 1) ? 'i/flagGreen' : 'i/flagGreen2') : 'i/flagRedHanging', f.x, f.y + 8, { s: 1.5 });
    }
    // goal
    const gx = L.goalX;
    if (gx > x0 && gx < x1) {
      ctx.fillStyle = '#6a6f86'; ctx.fillRect(gx - 7, -330, 14, 330);
      ctx.fillStyle = '#ffd93d'; ctx.beginPath(); ctx.arc(gx, -338, 14, 0, 7); ctx.fill();
      const wv = Math.sin(S.t * 6) * 10;
      ctx.fillStyle = L.biome.accent; ctx.beginPath(); ctx.moveTo(gx + 7, -318); ctx.quadraticCurveTo(gx + 100, -310 + wv, gx + 168, -270 + wv * 1.4); ctx.quadraticCurveTo(gx + 100, -250 + wv, gx + 7, -214); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.stroke();
      WJ.spr(ctx, 'i/star', gx + 76, -240 + wv * 0.8, { s: 1.1, ay: 0.5 });
      WJ.spr(ctx, 't/signExit', gx - 130, 0, { s: 1 });
      WJ.spr(ctx, 'i/bush', gx + 110, 20, { s: 1.2 }); WJ.spr(ctx, 'i/bush', gx - 60, 24, { s: 1.0 });
    }
  }

  function drawObstacles(ctx, g, camX, view, tgt) {
    const L = S.L, x0 = camX - 300, x1 = camX + view.w + 300, t = S.t;
    for (const o of L.obs) {
      if (o.x < x0 - 300 || o.x > x1 + 300) continue;
      const isT = o === tgt;
      if (o.type === 'crates' && !o.broken) {
        for (let i = 0; i < o.n; i++) WJ.tile(ctx, i % 2 ? 't/boxAlt' : 't/box', o.wx, o.ly - TS * (i + 1));
        if (isT) pulse(ctx, o.wx + TS / 2, o.ly - TS * o.n / 2, TS * 0.9 + o.n * 20, t);
      } else if (o.type === 'qblock') {
        const by = o.by - TS / 2 - Math.sin(Math.min(1, o.bump) * Math.PI) * 22 * (o.bump > 0 ? 1 : 0);
        WJ.tile(ctx, o.opened ? 't/boxEmpty' : 't/boxItem', o.x - TS / 2, by);
        if (isT) pulse(ctx, o.x, o.by, 80, t);
      } else if (o.type === 'spring') {
        WJ.spr(ctx, o.sprT > 0 ? 'i/springboardDown' : 'i/springboardUp', o.springX, o.ly, { s: 1 });
        if (isT) pulse(ctx, o.springX, o.ly - 40, 70, t);
      } else if (o.def) drawEnemy(ctx, o, isT, t);
      if (o.status === 'ready' && o.type !== 'drop' && o.type !== 'enemy' || (o.status === 'ready' && o.def)) {
        const sy = (o.anchorY == null ? -240 : o.anchorY) + 40 + Math.sin(t * 6) * 6;
        WJ.spr(ctx, 'i/star', o.def ? o.px : o.x, sy, { s: 1.2, ay: 0.5, rot: Math.sin(t * 4) * 0.2 });
      }
      if (o.type === 'gap' || o.type === 'bossgap') {
        // little lip markers: arrows over the water hint where to jump
      }
    }
  }
  function pulse(ctx, x, y, r, t) {
    ctx.save(); ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 7); ctx.lineWidth = 8; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r + Math.sin(t * 7) * 5, 0, 7); ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = '#FFD93D'; ctx.stroke(); ctx.restore();
  }
  function drawEnemy(ctx, o, isT, t) {
    if (o.sqT > 0.32 || o.hidden) return;
    const def = o.def, fi = Math.floor(t * 4 + o.phase) % def.f.length;
    let key = 'e/' + def.f[fi];
    let x = o.type === 'boss' ? o.x : o.px, y = o.ly - o.fh;
    if (o.air || def.ghost) y += Math.sin(t * 3 + o.phase) * 9;
    if (def.hop) y -= Math.abs(Math.sin(t * 3 + o.phase)) * 26, key = 'e/' + def.f[Math.sin(t * 3 + o.phase) > 0.2 ? 1 : 0];
    let sx = 1, sy = 1;
    if (o.sqT > 0) { const k = clamp(o.sqT / 0.3, 0, 1); sy = 1 - k * 0.7; sx = 1 + k * 0.5; ctx.save(); ctx.globalAlpha = 1 - k * 0.8; }
    else if (isT) pulse(ctx, x, y - o.eh / 2, o.eh * 0.62 + 30, t);
    if (o.type === 'boss') { sy *= 1 + Math.sin(t * 4) * 0.025; }
    WJ.spr(ctx, key, x, y, { s: o.sc, sx, sy, flip: false });
    if (o.sqT > 0) ctx.restore();
    if (o.type === 'boss' && !o.stomped) { // grumpy brow so he reads as the boss; also a crown
      WJ.spr(ctx, 'i/star', x, y - o.eh - 6, { s: 0.9, ay: 0.4 });
    }
    // little shadow
    if (!o.air && !def.ghost) { ctx.fillStyle = 'rgba(31,26,61,0.15)'; ctx.beginPath(); ctx.ellipse(x, o.ly + 3, o.eh * 0.45, 7, 0, 0, 7); ctx.fill(); }
  }

  function drawCoins(ctx, camX, view, t) {
    const x0 = camX - 80, x1 = camX + view.w + 80;
    for (const c of S.L.coins) {
      if (c.got || c.x < x0 || c.x > x1) continue;
      const bob = Math.sin(t * 4 + c.ph) * 5;
      if (c.kind === 'coin') WJ.spr(ctx, 'i/coinGold', c.x, c.y + bob, { ay: 0.5, sx: Math.abs(Math.cos(t * 3.2 + c.ph)) * 0.8 + 0.2 });
      else if (c.kind === 'gem') WJ.spr(ctx, ['i/gemBlue', 'i/gemGreen', 'i/gemRed', 'i/gemYellow'][Math.floor(c.ph) % 4], c.x, c.y + bob, { ay: 0.5, s: 1.2, rot: Math.sin(t * 3 + c.ph) * 0.15 });
      else if (c.kind === 'star') { WJ.spr(ctx, 'i/star', c.x, c.y + bob, { ay: 0.5, s: 1.5, rot: Math.sin(t * 2 + c.ph) * 0.2 }); }
      else if (c.kind === 'heart') WJ.spr(ctx, 'c/heart', c.x, c.y + bob, { ay: 0.5, s: 1.3 });
    }
  }

  function drawHero(ctx, g) {
    const h = S.hero, col = S.heroCol, t = S.t, P = col + '_';
    let key = P + 'stand', rot = h.rot, sx = 1 - h.sq * 0.28, sy = 1 + h.sq * 0.36, ox = 0, oy = 0;
    switch (h.st) {
      case 'run': key = P + (Math.floor(h.walkT * 3) % 2 ? 'walk2' : 'walk1'); oy = -Math.abs(Math.sin(h.walkT * 6)) * 8; rot = 0.07 + (S.pc.speed - 1) * 0.12; break;
      case 'teeter': key = P + 'skid'; rot = -0.08 + Math.sin(h.teeterT * 9) * 0.07; ox = Math.sin(h.teeterT * 9) * 3; break;
      case 'arc': key = P + ((h.avy || 0) > 120 ? 'fall' : 'jump'); if (h.leg && h.leg.bounce) key = P + 'cheer1'; break;
      case 'dash': key = P + 'kick'; break;
      case 'ride': key = P + (Math.floor(t * 2) % 2 ? 'stand' : 'talk'); rot = Math.sin(t * 2) * 0.04; break;
      case 'fall': case 'bonk': case 'dead': key = P + 'hurt'; break;
    }
    if (h.st === 'celebrate' || h.st === 'celeb' || S.phase === 'celeb' || S.phase === 'rating') { key = P + (Math.floor(h.celT * 5) % 2 ? 'cheer1' : 'cheer2'); oy = -Math.abs(Math.sin(h.celT * 7)) * 26; rot = 0; }
    if (g.state === 'over' && h.st !== 'dead') key = P + 'cheer2';
    const HS = 0.78;
    // shadow
    const sh = h.st === 'ride' ? h.y : h.surfY;
    const air = clamp((sh - h.y) / 300, 0, 1);
    if (h.st !== 'fall') { ctx.fillStyle = 'rgba(31,26,61,' + (0.2 - air * 0.12) + ')'; ctx.beginPath(); ctx.ellipse(h.x, sh + 3, 52 * (1 - air * 0.4), 11 * (1 - air * 0.4), 0, 0, 7); ctx.fill(); }
    if (h.inv > 0 && Math.floor(h.inv * 14) % 2 === 0 && h.st !== 'fall') ctx.globalAlpha = 0.45;
    ctx.save(); ctx.translate(h.x + ox, h.y + oy); ctx.scale(sx, sy); ctx.translate(0, -84); ctx.rotate(rot);
    WJ.hspr(ctx, key, 0, 84, HS);
    ctx.restore(); ctx.globalAlpha = 1;
    if (h.st === 'teeter' && h.teeterT > 0.35) { // "!" bubble
      const bx = h.x - 72, by = h.y - 120 + Math.sin(h.teeterT * 8) * 4;
      D.text(ctx, '!', bx, by, { size: 60, color: '#FF5A5F', outline: 10 });
    }
  }

  function drawParts(ctx) {
    for (const p of S.parts) {
      const f = p.t / p.life, a = 1 - f;
      ctx.save(); ctx.globalAlpha = Math.max(0, p.k === 'puff' ? a * 0.8 : Math.min(1, a * 1.6)); ctx.translate(p.x, p.y);
      if (p.k === 'puff') { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(0, 0, p.size + (p.grow || 0) * f, 0, 7); ctx.fill(); }
      else if (p.k === 'star') { ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.fill(P.star(0, 0, p.size, 0.5)); }
      else if (p.k === 'drop') { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(0, 0, p.size * (1 - f * 0.5), 0, 7); ctx.fill(); }
      else if (p.k === 'coin') { WJ.spr(ctx, 'i/coinGold', 0, 0, { ay: 0.5, sx: Math.abs(Math.cos(p.t * 9 + p.spin)) * 0.8 + 0.2 }); }
      else if (p.k === 'brick') { ctx.rotate(p.rot); WJ.spr(ctx, p.key, 0, 0, { ay: 0.5, s: 1.3 }); }
      ctx.restore();
    }
  }

  function draw(g, ctx) {
    if (!S) return;
    const v = g.vw(), L = S.L, B = L.biome, h = S.hero;
    const z = v.h > 1250 ? Math.min(1.5, (v.h / 1080) * 0.72) : 1;
    const view = { w: v.w / z, h: v.h / z };
    const gl = view.h * 0.7, anchor = clamp(view.w * 0.27, 300, 760);
    const pr = S.proj; pr.z = z; pr.gl = gl; pr.vx = v.x; pr.vy = v.y; pr.anchor = anchor; pr.view = view;
    const cam = S.cam, t = S.t;
    // ---- world (zoomed) ----
    ctx.save(); ctx.translate(v.x, v.y); ctx.scale(z, z);
    const T0 = performance.now(); WJ.drawBackground(ctx, B, cam.x, view, gl - cam.y, g.t, 0); const T1 = performance.now();
    ctx.save(); ctx.translate(-Math.round(cam.x), Math.round(gl - cam.y));
    const camX = Math.round(cam.x), bot = view.h - gl + cam.y + TS;
    const tgt = targetOb();
    drawTerrain(ctx, g, view, camX, bot);
    const T2 = performance.now(); const fall = h.st === 'fall';
    if (!fall) drawLiquid(ctx, view, camX, bot, g.t);
    drawDecor(ctx, camX, view);
    drawObstacles(ctx, g, camX, view, tgt);
    drawCoins(ctx, camX, view, g.t);
    drawHero(ctx, g);
    if (fall) drawLiquid(ctx, view, camX, bot, g.t);
    drawParts(ctx); const T3 = performance.now(); (WJ.prof = WJ.prof || { bg: 0, ter: 0, rest: 0, n: 0 }); WJ.prof.bg += T1 - T0; WJ.prof.ter += T2 - T1; WJ.prof.rest += T3 - T2; WJ.prof.n++;
    ctx.restore();
    // depth shading below the ground line
    { const yy = gl - cam.y + 70, sh = ctx.createLinearGradient(0, yy, 0, view.h); sh.addColorStop(0, 'rgba(31,26,61,0)'); sh.addColorStop(1, 'rgba(31,26,61,0.2)'); ctx.fillStyle = sh; ctx.fillRect(0, yy, view.w, view.h - yy); }
    ctx.restore();
    // ---- screen-space overlays ----
    drawPaceFx(ctx, g, v, gl, z);
    g.fx.draw(ctx);
    if (!g.demo && (g.state === 'play' || g.state === 'countdown' || g.state === 'over')) drawChips(g, ctx, v, tgt);
    if (!g.demo && g.state !== 'title') drawHudExtras(g, ctx, v);
    if (!g.demo) drawToast(ctx, v);
    if (S.banner && !g.demo) drawBanner(ctx, v);
    if (S.phase === 'rating') drawRating(g, ctx, v);
    if (g.demo) { // attract-mode vignette-free dim for the title card
      ctx.fillStyle = 'rgba(31,26,61,0.12)'; ctx.fillRect(v.x, v.y, v.w, v.h);
    }
    if (S.fade > 0) { ctx.fillStyle = 'rgba(31,26,61,' + clamp(S.fade, 0, 1) + ')'; ctx.fillRect(v.x - 10, v.y - 10, v.w + 20, v.h + 20); }
  }

  /* speed lines when the hero is catching up; blue bullet-time vignette while a word is being typed; whoosh burst on snap-back */
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function drawPaceFx(ctx, g, v, gl, z) {
    const pc = S.pc; if (g.demo) return;
    const sp = pc.speed, cam = S.cam;
    const gy = v.y + (gl - cam.y) * z;
    if (sp > 1.06 && !TM.settings.reduceMotion) {
      const a = clamp((sp - 1.06) / 0.9, 0, 1), span = v.w + 500;
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#fff';
      for (let i = 0; i < 18; i++) {
        const r1 = hash(i), r2 = hash(i + 50), r3 = hash(i + 99);
        const len = (120 + r2 * 220) * (0.6 + sp * 0.4), x = v.x + v.w + 200 - ((g.t * (900 + r1 * 900) * sp + r3 * span) % span);
        const y = gy - 120 - 300 * r2 + 440 * r1 * 0.55;
        ctx.globalAlpha = a * (0.16 + 0.26 * r3); ctx.lineWidth = 3 + r1 * 4;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
      }
      ctx.restore();
    }
    const bt = clamp((1 - pc.ts) / 0.7, 0, 1);
    if (bt > 0.02) {
      const cx = v.x + v.w / 2, cy = v.y + v.h / 2, R = Math.hypot(v.w, v.h) / 2;
      const gr = ctx.createRadialGradient(cx, cy, R * 0.30, cx, cy, R);
      gr.addColorStop(0, 'rgba(40,110,255,0)'); gr.addColorStop(1, 'rgba(18,40,150,' + (0.8 * bt) + ')');
      ctx.fillStyle = gr; ctx.fillRect(v.x, v.y, v.w, v.h);
      ctx.fillStyle = 'rgba(90,160,255,' + (0.14 * bt) + ')'; ctx.fillRect(v.x, v.y, v.w, v.h);
    }
    if (pc.snap > 0) { // whoosh: rays burst outward from the hero
      const k = 1 - pc.snap / 0.45, hv = w2v(S.hero.x, S.hero.y - 60);
      ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineWidth = 6 * (1 - k);
      ctx.globalAlpha = 0.7 * (1 - k);
      for (let i = 0; i < 14; i++) { const an = i / 14 * 6.283 + 0.2, r0 = 120 + k * 320, r1 = r0 + 90 + k * 140; ctx.beginPath(); ctx.moveTo(hv.x + Math.cos(an) * r0, hv.y + Math.sin(an) * r0 * 0.7); ctx.lineTo(hv.x + Math.cos(an) * r1, hv.y + Math.sin(an) * r1 * 0.7); ctx.stroke(); }
      ctx.restore();
    }
  }

  function drawChips(g, ctx, v, tgt) {
    if (S.phase !== 'play') return;
    const list = targetsTwo(); if (!list.length) return;
    const showHint = (o) => g.hint || (o.fails > 0);
    S.chipRects.length = 0;
    const L2 = [];
    for (let i = 0; i < list.length; i++) { // pass 1: layout (target first so the preview chip yields to it)
      const o = list[i], isT = o === tgt;
      const long = o.item.len > 15;
      const size = long ? 38 : (isT ? 56 : 46);
      const sz = D.chipSize(ctx, o.typer, size);
      const a = o.def ? { x: o.px, y: o.anchorY } : { x: o.x, y: o.anchorY == null ? -240 : o.anchorY };
      const p = w2v(a.x, a.y);
      const sc = window.innerWidth / v.w, topMin = v.y + 215 / sc, sk = isT ? 1.08 : 0.8;
      const cx = clamp(p.x, v.x + sz.w / 2 * sk + 30, v.x + v.w - sz.w / 2 * sk - 30);
      let cy = Math.max(p.y, topMin) - (isT ? 0 : 76);
      const r = { cx, cy, w: sz.w * sk, h: sz.h * sk + (isT ? 30 : 0), isT, o, size, sz, p };
      if (!isT) for (const q of L2) for (let n = 0; n < 4 && Math.abs(r.cx - q.cx) < (r.w + q.w) / 2 + 12 && Math.abs(r.cy - q.cy) < (r.h + q.h) / 2 + 6; n++) r.cy = q.cy - (r.h + q.h) / 2 - 8;
      L2.push(r); S.chipRects.push({ x: r.cx - r.w / 2, y: r.cy - r.h / 2, w: r.w, h: r.h });
    }
    for (let i = L2.length - 1; i >= 0; i--) { // pass 2: draw, preview first, target on top
      const { cx, cy, isT, o, size, sz, p } = L2[i];
      const off = p.x > v.x + v.w - 30 || p.x < v.x + 30;
      D.chip(ctx, cx, cy, o.typer, { size, accent: C.jumper, locked: isT && o.typer.pos > 0, alpha: isT ? 1 : 0.92, dim: !isT, scale: isT ? 1 : 0.8, hint: isT && showHint(o) });
      if (isT) { // pointer toward the obstacle
        ctx.save(); ctx.fillStyle = C.ink; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        if (off && p.x > v.x + v.w - 30) { ctx.beginPath(); ctx.moveTo(v.x + v.w - 14, cy); ctx.lineTo(v.x + v.w - 46, cy - 20); ctx.lineTo(v.x + v.w - 46, cy + 20); ctx.closePath(); ctx.fill(); }
        else { const py = cy + sz.h / 2 * 1.08 + 8; ctx.beginPath(); ctx.moveTo(cx - 14 + Math.max(-60, Math.min(60, p.x - cx)), py); ctx.lineTo(cx + 14 + Math.max(-60, Math.min(60, p.x - cx)), py); ctx.lineTo(cx + Math.max(-60, Math.min(60, p.x - cx)), py + 18 + Math.sin(S.t * 8) * 3); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
    }
  }

  function drawHudExtras(g, ctx, v) {
    const sc = window.innerWidth / v.w;
    const x = v.x + 24 / sc, y = v.y + 102 / sc, s = 1 / sc * Math.max(0.8, Math.min(1.2, sc * 1.4 > 1 ? 1 : sc * 1.4));
    ctx.save(); ctx.translate(x, y); ctx.scale(s * 1.1, s * 1.1);
    const pw = 190, ph = 56;
    ctx.fillStyle = C.ink; ctx.fill(P.rr(0, 0, pw, ph, 28));
    WJ.spr(ctx, 'i/coinGold', 34, 28, { ay: 0.5, s: 0.72 });
    D.text(ctx, String(S.coinsAll), 78, 31, { size: 34, color: '#fff', align: 'left' });
    D.text(ctx, S.L.biome.name, 0, ph + 24, { size: 26, color: '#fff', outline: 7, align: 'left' });
    ctx.restore();
  }

  function drawBanner(ctx, v) {
    const k = S.banner.t, a = k < 0.3 ? k / 0.3 : k > 2.2 ? 1 - (k - 2.2) / 0.4 : 1, sc = k < 0.3 ? ease.outBack(k / 0.3) : 1;
    const hv = w2v(S.hero.x, S.hero.surfY), avail = hv.x - 110 - (v.x + 36), est = Math.max(S.banner.text.length * 74 * 0.56, S.banner.sub.length * 36 * 0.56);
    const fit = Math.min(1, avail / est);
    { const r = { x: v.x + 36, y: v.y + 240, w: est * fit, h: 130 }; if (S.chipRects.some((c) => r.x < c.x + c.w && r.x + r.w > c.x && r.y < c.y + c.h && r.y + r.h > c.y)) S.dbgOverlap++; }
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(v.x + 36, v.y + 300); ctx.scale(sc * fit, sc * fit);
    D.text(ctx, S.banner.text, 0, 0, { size: 74, color: S.L.biome.accent, outline: 13, align: 'left' });
    D.text(ctx, S.banner.sub, 0, 58, { size: 36, color: '#fff', outline: 9, align: 'left' });
    ctx.restore();
  }

  function drawRating(g, ctx, v) {
    const r = S.rating, k = clamp(S.phaseT / 0.35, 0, 1), cx = W / 2, cy = v.y + v.h * 0.47;
    ctx.save();
    ctx.fillStyle = 'rgba(31,26,61,' + 0.5 * k + ')'; ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.translate(cx, cy); const s = ease.outBack(k); ctx.scale(s, s);
    const pw = 860, ph = 740, pp = P.rr(-pw / 2, -ph / 2, pw, ph, 56);
    D.sticker(ctx, pp, '#FFF8E7', { x: -pw / 2, y: -ph / 2, w: pw, h: ph }, { shade: false });
    D.text(ctx, 'Level ' + (S.li + 1) + ' complete!', 0, -ph / 2 + 70, { size: 76, color: S.L.biome.accent, outline: 14 });
    D.text(ctx, S.L.biome.name, 0, -ph / 2 + 135, { size: 40, color: C.ink });
    // stars
    for (let i = 0; i < 3; i++) {
      const on = i < r.stars, shown = i < r.shown, sx = (i - 1) * 190, sy = -ph / 2 + 290 - (i === 1 ? 26 : 0);
      const pop = shown ? ease.outBack(clamp((S.phaseT - i * 0.55) / 0.35, 0, 1)) : 0;
      ctx.save(); ctx.translate(sx, sy); ctx.scale(0.4 + 0.6 * pop, 0.4 + 0.6 * pop); ctx.rotate((1 - pop) * -0.6 + (i - 1) * 0.12);
      const path = P.star(0, 0, 84, 0.5, 5);
      ctx.fillStyle = on && shown ? '#FFD93D' : '#D8D3E6'; ctx.fill(path); ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeStyle = C.ink; ctx.stroke(path);
      ctx.restore();
    }
    // criteria
    const rows = r.crit;
    ctx.textAlign = 'left';
    for (let i = 0; i < rows.length; i++) {
      const y = 70 + i * 62, c = rows[i];
      const shown = r.shown > i;
      ctx.save(); ctx.globalAlpha = shown ? 1 : 0.35;
      ctx.fillStyle = c.ok ? '#6CCB3C' : '#D8D3E6'; ctx.beginPath(); ctx.arc(-340, y, 22, 0, 7); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.stroke();
      if (c.ok) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-351, y); ctx.lineTo(-343, y + 9); ctx.lineTo(-328, y - 9); ctx.stroke(); }
      D.text(ctx, c.t, -300, y + 2, { size: 38, color: C.ink, align: 'left' });
      if (c.v) D.text(ctx, c.v, 340, y + 2, { size: 38, color: c.ok ? '#2E8B1F' : '#8C86A6', align: 'right' });
      ctx.restore();
    }
    D.text(ctx, `Coins ${r.coins}/${r.total}`, -340, 258, { size: 34, color: C.ink, align: 'left' });
    if (!g.demo && g.diff !== 'gentle') {
      D.text(ctx, `Hearts: ${S.hearts}/${S.maxHearts}`, 340, 258, { size: 34, color: '#E0457B', align: 'right' });
    }
    const pulse2 = 1 + Math.sin(g.t * 5) * 0.04;
    ctx.save(); ctx.translate(0, ph / 2 - 46); ctx.scale(pulse2, pulse2);
    const nxt = S.li + 1 < LEVELS ? 'Next: ' + WJ.BIOMES[(S.li + 1) % WJ.BIOMES.length].name : 'Finish!';
    D.sticker(ctx, P.rr(-300, -34, 600, 68, 34), C.jumper, { x: -300, y: -34, w: 600, h: 68 }, { shadow: false });
    D.text(ctx, 'Press Space or Enter  -  ' + nxt, 0, 3, { size: 28, color: '#fff', outline: 7 });
    ctx.restore();
    ctx.restore();
  }

  /* ============================================================ framework */
  TM.game({
    id: 'word-jumper', name: 'Word Jumper', accent: C.jumper, bg: '#63C3FF',
    logoHTML: 'Word<br>Jumper', tagline: 'Type the word to jump, stomp and smash!',
    lifeIcon: TM.ui.heartSVG('#6CCB3C'),
    howto: [
      'Your hero runs through side-scrolling levels all by themself.',
      'Every <b>gap, enemy, crate and spring</b> has a <b>word</b> on it. Type the word and the hero jumps, stomps or smashes it!',
      'Type ahead and the hero <b>speeds up</b> to catch up. Near a word, time <b>slows down</b> (bullet time) so you can finish typing it, then <b>whoosh</b> - back to full speed!',
      'Type early for <b>Speedy!</b> bonus points. If you wait too long at the edge, you fall and go back to the last <b>flag</b> and lose a heart.',
      'Collect <b>coins, gems and stars</b>. Hit the <b>? blocks</b> for bonus coins (they are optional!).',
      'Beat the big boss at the end of each of the 5 worlds. Earn up to 3 stars per level!',
    ],
    music: songs[0],
    init: () => { WJ.preloadSounds(); },
    reset, update, draw, onKey,
    onEnter: (g) => { if (S && S.phase === 'rating') proceed(g); },
    nextKey: () => { if (!S || S.phase !== 'play') return null; const t = targetOb(); return t ? t.typer.nextReq() : null; },
    hud: (g) => ({
      lives: S ? S.hearts : 3, maxLives: g.diff === 'gentle' ? 0 : 3,
      right: S ? `Level ${S.li + 1}/${LEVELS}` : '',
      progress: S && S.L ? clamp((S.hero.x - S.L.startX) / Math.max(1, S.L.goalX - S.L.startX), 0, 1) : 0,
    }),
  });
})();
