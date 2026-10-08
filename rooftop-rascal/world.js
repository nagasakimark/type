/* Rooftop Rascal - world.js
   Level generation (runs), move choreography (segments), and the rendering of the world:
   parallax skyline, sky, rooftops, decorations. */
(function () {
  'use strict';
  const TM = window.TM, C = TM.C, U = TM.U, D = TM.draw, P = D.P;
  const RR = window.RR;
  const INK = C.ink, TAU = Math.PI * 2;
  const clamp = U.clamp, lerp = U.lerp;
  const sm = (t) => t * t * (3 - 2 * t);
  const easeIn = (t) => t * t, easeOut = (t) => 1 - (1 - t) * (1 - t);

  function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  RR.rng = rng;

  /* =============== move choreography =============== */
  /* A move is a list of segments: {t (s), x0,y0,x1,y1, h (arc height), p (pose kind), face, rot0, rot1, fn(u)->[x,y]}. */
  function seg(o) { return Object.assign({ h: 0, p: 'air', face: 1, rot0: 0, rot1: 0, ease: null, blend: 0.1 }, o); }
  RR.seg = seg;

  RR.evalMove = function (mv, k, ph, t) {
    // k in 0..1 (normalised over total duration)
    const T = mv.dur; let el = clamp(k, 0, 1) * T, i = 0;
    while (i < mv.segs.length - 1 && el > mv.segs[i].t) { el -= mv.segs[i].t; i++; }
    const s = mv.segs[i], u = clamp(el / s.t, 0, 1), e = s.ease ? s.ease(u) : u;
    let x, y;
    if (s.fn) { const q = s.fn(e); x = q[0]; y = q[1]; }
    else { x = lerp(s.x0, s.x1, e); y = lerp(s.y0, s.y1, e) - 4 * s.h * e * (1 - e); }
    const dydu = (s.fn ? 0 : (s.y1 - s.y0) - 4 * s.h * (1 - 2 * e));
    const vyN = s.h ? clamp(dydu / (3 * s.h + 1), -1, 1) : (s.y1 > s.y0 ? 0.6 : -0.6);
    const rot = lerp(s.rot0, s.rot1, s.rotEase ? s.rotEase(u) : u);
    const pose = segPose(s, u, el, ph, t, vyN);
    let fp = pose;
    if (i > 0 && s.blend > 0 && el < s.blend) {
      const pv = mv.segs[i - 1]; const pp = segPose(pv, 1, pv.t, ph, t, pv.h ? 0.5 : 0);
      fp = RR.blend(pp, pose, sm(el / s.blend));
    }
    return { x, y, rot, face: s.face, pose: fp, seg: i, kind: s.p, u };
  };
  function segPose(s, u, el, ph, t, vyN) {
    const P_ = RR.pose;
    switch (s.p) {
      case 'run': return P_.run(ph, 0.2);
      case 'air': return P_.air(vyN);
      case 'tuck': return P_.tuck(t);
      case 'slide': return P_.slide(t);
      case 'cling': return P_.cling(t);
      case 'climb': return P_.climb(el * 14);
      case 'sneak': return P_.sneak(el * 6.5);
      case 'zip': return P_.zip(t);
      case 'crouch': return P_.crouch(t);
      case 'cheer': return P_.cheer(t);
      case 'dance': return P_.dance(t);
      case 'skid': return P_.skid(t);
      default: return P_.idle(t);
    }
  }

  /* =============== level generation =============== */
  const EST = { gap: 0.85, slide: 0.8, crow: 0.8, bounce: 1.4, wall: 1.1, kick: 1.9, zip: 1.7, sneak: 1.5 };
  RR.TYPE_LABEL = { gap: 'JUMP', slide: 'SLIDE', crow: 'HOP', bounce: 'BOUNCE', wall: 'CLIMB', kick: 'WALL KICK', zip: 'ZIPLINE', sneak: 'SNEAK', finale: 'BIG LEAP' };

  function phraseItem(g, a, b) {
    return Object.assign({}, a, { t: a.t + ' ' + b.t, len: a.len + b.len + 1, first: a.first, words: 2, kind: 'phrase', hint: (a.hint && b.hint) ? a.hint + '・' + b.hint : '' });
  }
  function getItem(g, type, ctx) {
    const lad = g.ladder(ctx.stage), d = g.dealer;
    const W = (o) => d.next(Object.assign({ kind: 'word' }, o));
    const cap = lad.maxLen;
    switch (type) {
      case 'gap': return W({ minLen: 3, maxLen: Math.min(cap, 9) });
      case 'slide': case 'crow': case 'bounce': return W({ minLen: 2, maxLen: Math.min(cap, 6) });
      case 'wall': return W({ minLen: 4, maxLen: Math.min(cap, 9) });
      case 'kick': return W({ minLen: 5, maxLen: Math.min(cap, 11) });
      case 'sneak': return W({ minLen: 5, maxLen: Math.min(cap, 10) });
      case 'zip': {
        if (lad.tier >= 3 && d.pool.sentences.length) { for (let i = 0; i < 6; i++) { const s = d.next({ kind: 'sentence', maxWords: 4 }); if (s.kind === 'sentence' && s.t.length <= 26) return s; } }
        return phraseItem(g, W({ minLen: 2, maxLen: 6 }), W({ minLen: 2, maxLen: 6 }));
      }
      case 'finale': {
        const maxChars = ctx.finaleChars, maxWords = ctx.finaleWords;
        if (d.pool.sentences.length) for (let i = 0; i < 10; i++) { const s = d.next({ kind: 'sentence', maxWords }); if (s.kind === 'sentence' && s.t.length <= maxChars) return s; }
        let a = W({ minLen: 3, maxLen: 8 }), b = W({ minLen: 3, maxLen: 8 }), it = phraseItem(g, a, b);
        if (maxWords >= 4) it = phraseItem(g, it, W({ minLen: 2, maxLen: 6 }));
        return it;
      }
    }
    return W({});
  }

  function pickTypes(run, n, R) {
    if (run === 1) { const base = ['gap', 'slide', 'gap', 'bounce', 'crow', 'wall', 'gap', 'sneak', 'slide', 'zip', 'gap', 'crow']; const out = []; for (let i = 0; i < n; i++) out.push(base[i % base.length]); return out; }
    const w = { gap: 4, slide: 3, crow: 2, bounce: 2.5, wall: 2.2, kick: run >= 2 ? 2 : 0, zip: 1.8, sneak: run >= 2 ? 2 : 1 };
    const keys = Object.keys(w), out = [];
    for (let i = 0; i < n; i++) {
      let tot = 0; for (const k of keys) tot += (out[i - 1] === k && out[i - 2] === k) ? 0 : (out[i - 1] === k ? w[k] * 0.35 : w[k]);
      let r = R() * tot, pick = 'gap';
      for (const k of keys) { const ww = (out[i - 1] === k && out[i - 2] === k) ? 0 : (out[i - 1] === k ? w[k] * 0.35 : w[k]); if ((r -= ww) <= 0) { pick = k; break; } }
      if (i === 0) pick = 'gap';
      out.push(pick);
    }
    return out;
  }

  RR.buildLevel = function (g, runN, o) {
    o = o || {};
    const di = (runN - 1) % 5, dist = RR.DISTRICTS[di];
    const loop = Math.floor((runN - 1) / 5);
    const R = rng(1000 + runN * 77 + (o.seedAdd || 0));
    const diffMul = g.diff === 'gentle' ? 0.86 : g.diff === 'turbo' ? 1.14 : 1;
    const timeMul = g.diff === 'gentle' ? 1.35 : g.diff === 'turbo' ? 0.8 : 1;
    const v = dist.speed * diffMul * (1 + loop * 0.08);
    const n = o.n || (dist.n + loop * 2);
    const types = pickTypes(Math.min(runN, 5), n, R);
    const finaleWords = [4, 5, 6, 7, 9][Math.min(runN - 1, 4)] - (g.diff === 'gentle' ? 1 : 0), finaleChars = [28, 34, 40, 48, 58][Math.min(runN - 1, 4)];
    const Y0 = 700;
    const roofs = [], obs = [], cols = [], powers = [];
    const mkRoof = (x, y) => { const r = { x, y, w: 0, seed: Math.floor(R() * 1e6), deco: [], wallL: false }; roofs.push(r); return r; };
    let roof = mkRoof(-1400, Y0);
    let x = 0, prevEst = 0.2, first = true;
    const addCol = (kind, cx, cy, extra) => cols.push(Object.assign({ kind, x: cx, y: cy, taken: false, k: Math.floor(R() * 4) }, extra || {}));
    const groundRow = (x0, x1, y, kind, step) => { for (let cx = x0; cx <= x1; cx += step) addCol(kind, cx, y); };

    for (let i = 0; i < n; i++) {
      const type = types[i];
      const stage = clamp((Math.min(runN, 5) - 1) / 4 * 0.78 + i / n * 0.16, 0, 1);
      const item = getItem(g, type, { stage });
      const T = (dist.t0 + dist.tl * item.len) * timeMul;
      let runDist = first ? v * 3.1 : v * Math.max(0.5, T - prevEst);
      if (!first) runDist = Math.max(runDist, 280);
      first = false;
      const lx = x + runDist;
      const ob = { type, item, lx, ex: lx, roof, roofTo: roof, done: false, typed: false, idx: i, camZ: 1, shake: 0 };
      const y0 = roof.y;
      const surf = y0;
      // collectibles on the run-in
      if (lx - x > 520 && R() < 0.85) { const gx0 = x + 160, gx1 = Math.min(lx - 120, gx0 + 5 * 74); groundRow(gx0, gx1, surf - 62, R() < 0.7 ? 'cookie' : 'gem', 74); }
      if (lx - x > 700 && R() < 0.4) addCol('gem', x + (lx - x) * 0.55, surf - 140, { k: 2 });

      if (type === 'gap') {
        const gapW = clamp(240 + runN * 36 + R() * 220, 260, 620);
        const edge = lx + 70;
        roof.w = edge - roof.x;
        const bias = -(roof.y - Y0) * 0.4;
        const dy = clamp(R() * 190 - 70 + bias, -90, 150);
        const nr = mkRoof(edge + gapW, y0 + dy);
        const x1 = nr.x + 120, y1 = nr.y, dist_ = x1 - lx;
        const dur = clamp(dist_ / (v * 1.1), 0.66, 1.15), h = Math.max(120, 0.2 * dist_) + Math.max(0, y0 - y1) * 0.5;
        ob.mv = { dur, segs: [seg({ t: dur, x0: lx, y0, x1, y1, h, p: 'air' })] };
        ob.roofTo = nr; ob.ex = x1; ob.edge = edge; ob.gapW = gapW; ob.camZ = 1.03;
        for (const k of [0.26, 0.5, 0.74]) { const q = RR.evalMove(ob.mv, k, 0, 0); addCol('gem', q.x, q.y - 72, { k: i + Math.round(k * 4) }); }
        if (R() < 0.35) { const q = RR.evalMove(ob.mv, 0.5, 0, 0); addCol('fish', q.x, q.y - 150); }
        roof = nr;
      } else if (type === 'slide') {
        const x1 = lx + 440, dur = 440 / (v * 0.95);
        ob.mv = { dur, segs: [seg({ t: dur, x0: lx, y0, x1, y1: y0, p: 'slide', ease: (u) => 1 - Math.pow(1 - u, 1.35), blend: 0.14 })] };
        ob.ex = x1; ob.pipe = { x0: lx + 100, x1: lx + 340, y: y0 - 96, line: R() < 0.5 }; ob.camZ = 1.05;
        groundRow(lx + 140, lx + 320, y0 - 40, 'gem', 62);
      } else if (type === 'crow') {
        const x1 = lx + 460, dur = 0.82;
        ob.mv = { dur, segs: [seg({ t: dur, x0: lx, y0, x1, y1: y0, h: 150, p: 'tuck', rot0: 0, rot1: TAU, rotEase: sm, blend: 0.12 })] };
        ob.ex = x1; ob.crowX = lx + 250; ob.camZ = 1.03;
        addCol('gem', lx + 250, y0 - 255, { k: i }); addCol('cookie', lx + 190, y0 - 215); addCol('cookie', lx + 310, y0 - 215);
      } else if (type === 'bounce') {
        const xT = lx + 130, xL = xT + 520, kinds = ['spring', 'parasol', 'mushroom'];
        const dur = 1.5, tRun = 0.2;
        ob.mv = { dur, segs: [seg({ t: tRun, x0: lx, y0, x1: xT, y1: y0, p: 'run' }), seg({ t: dur - tRun, x0: xT, y0, x1: xL, y1: y0, h: 400, p: 'tuck', rot0: 0, rot1: TAU * 1.0, rotEase: sm, blend: 0.14 })] };
        ob.ex = xL; ob.tramp = { x: xT, kind: kinds[(i + runN) % 3] }; ob.blocker = { x: xT + 240, h: 230 }; ob.camZ = 1.0; ob.shake = 7;
        for (const k of [0.4, 0.55, 0.7, 0.85]) { const q = RR.evalMove(ob.mv, k, 0, 0); addCol('gem', q.x, q.y - 68, { k: i + Math.round(k * 5) }); }
        const q = RR.evalMove(ob.mv, 0.62, 0, 0); addCol('fish', q.x, q.y - 140);
      } else if (type === 'wall') {
        const H = clamp(210 + R() * 90, 210, 300), wallX = lx + 120;
        roof.w = wallX - roof.x;
        const nr = mkRoof(wallX, y0 - H);
        const tA = 0.3, tB = 0.35 + H / 470, tC = 0.36, cx = wallX - 44;
        const yTopFeet = nr.y + 36;
        ob.mv = { dur: tA + tB + tC, segs: [
          seg({ t: tA, x0: lx, y0, x1: cx, y1: y0, p: 'run' }),
          seg({ t: tB, x0: cx, y0, x1: cx, y1: yTopFeet, p: 'climb', ease: (u) => u, blend: 0.12 }),
          seg({ t: tC, x0: cx, y0: yTopFeet, x1: wallX + 130, y1: nr.y, h: 70, p: 'air', blend: 0.1 }),
        ] };
        ob.roofTo = nr; ob.ex = wallX + 130; ob.wall = { x: wallX, h: H }; ob.camZ = 1.07; ob.shake = 5;
        for (const k of [0.34, 0.5, 0.66]) { const q = RR.evalMove(ob.mv, k, 0, 0); addCol('gem', q.x - 4, q.y - 70, { k: i + Math.round(k * 5) }); }
        roof = nr;
      } else if (type === 'kick') {
        const H = 400, wallX = lx + 420, bbX = wallX - 270;
        roof.w = wallX - roof.x;
        const nr = mkRoof(wallX, y0 - H);
        const c1 = [wallX - 36, y0 - 150], c2 = [bbX + 30 + 34, y0 - 270];
        ob.mv = { dur: 0.55 + 0.16 + 0.5 + 0.16 + 0.62, segs: [
          seg({ t: 0.55, x0: lx, y0, x1: c1[0], y1: c1[1], h: 70, p: 'air', blend: 0.06 }),
          seg({ t: 0.16, x0: c1[0], y0: c1[1], x1: c1[0], y1: c1[1], p: 'cling', face: 1, blend: 0.04 }),
          seg({ t: 0.5, x0: c1[0], y0: c1[1], x1: c2[0], y1: c2[1], h: 40, p: 'tuck', face: -1, rot0: 0, rot1: -TAU * 0.5, rotEase: sm, blend: 0.06 }),
          seg({ t: 0.16, x0: c2[0], y0: c2[1], x1: c2[0], y1: c2[1], p: 'cling', face: -1, blend: 0.04 }),
          seg({ t: 0.62, x0: c2[0], y0: c2[1], x1: wallX + 110, y1: nr.y, h: 120, p: 'air', face: 1, blend: 0.06 }),
        ] };
        ob.roofTo = nr; ob.ex = wallX + 110; ob.wall = { x: wallX, h: H }; ob.billboard = { x: bbX, h: 330, text: ['SALE', 'NEW!', 'YUM', 'POP'][i % 4] }; ob.camZ = 1.09; ob.shake = 6;
        addCol('gem', c1[0] - 70, c1[1] - 70, { k: 0 }); addCol('gem', (c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2 - 90, { k: 1 }); addCol('gem', c2[0] + 60, c2[1] - 70, { k: 2 });
        addCol('fish', wallX + 20, y0 - 340);
        roof = nr;
      } else if (type === 'zip') {
        const xA = lx + 130, gapW = clamp(760 + R() * 300, 760, 1060);
        roof.w = xA + 60 - roof.x;
        const dy = clamp(R() * 200 - 60, -60, 140);
        const nr = mkRoof(xA + gapW - 60, y0 + dy);
        const xB = nr.x + 60, yA = y0 - 255, yB = nr.y - 255, sag = 70, hang = 138;
        const tJ = 0.45, tZ = (xB - xA) / (v * 1.85), tR = 0.42;
        const zf = (e) => { const xx = lerp(xA, xB, e); return [xx, RR.zipY(xA, yA, xB, yB, sag, xx) + hang]; };
        ob.mv = { dur: tJ + tZ + tR, segs: [
          seg({ t: 0.3, x0: lx, y0, x1: lx + 40, y1: y0, p: 'run' }),
          seg({ t: tJ - 0.3 + 0.01, x0: lx + 40, y0, x1: xA, y1: yA + hang, h: 60, p: 'air', blend: 0.05 }),
          seg({ t: tZ, fn: zf, p: 'zip', ease: (u) => u * (0.55 + 0.45 * u), blend: 0.06 }),
          seg({ t: tR, x0: xB, y0: yB + hang, x1: nr.x + 190, y1: nr.y, h: 60, p: 'air', blend: 0.06 }),
        ] };
        ob.zip = { xA, yA, xB, yB, sag }; ob.edge = xA + 60; ob.gapW = nr.x - (xA + 60); ob.roofTo = nr; ob.ex = nr.x + 190; ob.camZ = 0.94; ob.shake = 3;
        for (let k = 1; k <= 4; k++) { const e = k / 5, xx = lerp(xA, xB, e); addCol('gem', xx, RR.zipY(xA, yA, xB, yB, sag, xx) + hang - 60, { k: k }); }
        addCol('fish', lerp(xA, xB, 0.5), RR.zipY(xA, yA, xB, yB, sag, lerp(xA, xB, 0.5)) + 60);
        roof = nr;
      } else if (type === 'sneak') {
        const x1 = lx + 800, dur = 800 / (v * 0.45);
        ob.mv = { dur, segs: [seg({ t: dur, x0: lx, y0, x1, y1: y0, p: 'sneak', blend: 0.3 })] };
        ob.ex = x1; ob.catX = lx + 430; ob.camZ = 1.07;
        groundRow(lx + 120, lx + 700, y0 - 62, 'cookie', 96);
      }
      // power-up placement (every ~4 obstacles) on the run-in of the next one
      if (i > 1 && i % 4 === 2) { const kinds = ['boost', 'smoke', 'magnet']; powers.push({ kind: kinds[(i / 4 | 0) % 3], x: lx - Math.min(260, (lx - x) * 0.5), y: surf - 120, taken: false }); }
      obs.push(ob);
      x = ob.ex; prevEst = EST[type] || 1;
    }

    /* finale: long runway then a huge leap to the treasure pantry */
    {
      const item = getItem(g, 'finale', { finaleChars, finaleWords });
      const lx = x + v * 3.0, y0 = roof.y;
      const edge = lx + 120, gapW = 1000 + runN * 40;
      roof.w = edge - roof.x;
      const tw = 1250, nr = mkRoof(edge + gapW, y0 + 40); nr.treasure = true; nr.w = tw;
      const tail = mkRoof(nr.x + tw, nr.y); tail.w = 2800; // the pantry building runs on so ultrawide / tall windows never see the roof end
      const land = [nr.x + 330, nr.y];
      const tC = 0.55, tL = 2.15;
      const ob2 = { type: 'finale', item, lx, ex: land[0], roof, roofTo: nr, done: false, typed: false, idx: n, camZ: 0.92, shake: 14, edge, gapW, finale: true };
      ob2.mv = { dur: tC + tL + 0.3, segs: [
        seg({ t: tC, x0: lx, y0, x1: lx + 70, y1: y0, p: 'crouch', blend: 0.18, ease: (u) => u }),
        seg({ t: tL, x0: lx + 70, y0, x1: land[0], y1: land[1], h: 560, p: 'tuck', rot0: 0, rot1: TAU * 2, rotEase: sm, blend: 0.1 }),
        seg({ t: 0.3, x0: land[0], y0: land[1], x1: land[0], y1: land[1], p: 'cheer', blend: 0.05 }),
      ] };
      for (const k of [0.3, 0.42, 0.54, 0.66, 0.78]) { const q = RR.evalMove(ob2.mv, k, 0, 0); addCol('gem', q.x, q.y - 70, { k: Math.round(k * 10) }); }
      obs.push(ob2);
      x = ob2.ex;
      var finaleRoof = nr;
    }
    const length = finaleRoof.x + finaleRoof.w;

    /* decorate roofs */
    const dec = dist.deco;
    for (const r of roofs) {
      const R2 = rng(r.seed);
      if (r.treasure) continue;
      const avoid = [];
      for (const ob of obs) { if (ob.roof === r || ob.roofTo === r) avoid.push([ob.lx - 140, ob.ex + 140]); if (ob.type === 'wall' || ob.type === 'kick') { if (ob.roofTo === r) avoid.push([r.x - 20, r.x + 160]); } }
      const x0 = Math.max(r.x + 40, -900), x1 = r.x + r.w - 130;
      let cx = x0 + R2() * 120;
      while (cx < x1) {
        const type = dec[Math.floor(R2() * dec.length)];
        const wdt = type === 'neon' ? 170 : type === 'bunting' ? 230 : type === 'plant' ? 150 : type === 'solar' ? 156 : 100;
        if (!avoid.some((a) => cx + wdt > a[0] && cx < a[1])) { r.deco.push({ type, x: cx }); cx += wdt + 120 + R2() * 380; }
        else cx += 90;
      }
    }
    return { dist, runN, roofs, obs, cols, powers, length, v, finaleRoof, bg: null };
  };

  /* roof under x (play surface) */
  RR.roofAt = function (L, x) { for (const r of L.roofs) if (x >= r.x && x <= r.x + r.w) return r; return null; };

  /* =============== background =============== */
  RR.makeBG = function (dist, di) {
    const seed = 50 + di * 31;
    const mk = (o) => RR.skyline(Object.assign({ seed: seed + (o.sd || 0), w: 2400 }, o));
    const wcfg = (p, lit, cw, ch, gx, gy) => ({ p, lit, alt: dist.win, cw, ch, gx, gy });
    const st = dist.style;
    const bg = { dist };
    bg.far = mk({ sd: 1, h: 460, color: dist.far, bot: U.shade(dist.far, -0.1), minW: 90, maxW: 190, minH: 130, maxH: st === 'towers' ? 420 : 300, style: st === 'neon' ? 'houses' : st, win: wcfg(0.12, U.hexA(dist.win, 0.5), 8, 10, 12, 14) });
    bg.mid = mk({ sd: 2, h: 640, color: dist.mid, bot: U.shade(dist.mid, -0.2), minW: 120, maxW: 260, minH: 220, maxH: st === 'towers' ? 560 : 440, style: st, win: wcfg(0.34, dist.win, 12, 16, 14, 14) });
    bg.near = mk({ sd: 3, h: 640, color: dist.near, bot: U.shade(dist.near, -0.25), minW: 160, maxW: 330, minH: 200, maxH: st === 'towers' ? 520 : 400, style: st === 'houses' ? 'flat' : st, win: wcfg(0.42, dist.win, 18, 24, 18, 16) });
    const R = rng(seed);
    bg.stars = Array.from({ length: 150 }, () => ({ x: R() * 2600, y: R() * 640, s: 1 + R() * 2.3, ph: R() * 6.3, b: 0.4 + R() * 0.6 }));
    bg.clouds = Array.from({ length: 9 }, (_, i) => ({ x: R() * 3000, y: 120 + R() * 380, s: 0.9 + R() * 1.2, n: 1 + (i % 3), sp: 6 + R() * 10, pf: 0.04 + R() * 0.08 }));
    bg.birds = Array.from({ length: 7 }, () => ({ x: R() * 3000, y: 160 + R() * 280, s: 0.6 + R(), ph: R() * 6, sp: 30 + R() * 30 }));
    bg.shoot = { t: 3 + R() * 6, x: 0, y: 0, a: 0 };
    return bg;
  };

  function drawStrip(ctx, strip, camX, pf, camY, pv, baseY, cv, fillDown) {
    const W = strip.w, H = strip.h;
    let ox = -((camX * pf) % W); if (ox > 0) ox -= W;
    const y = baseY - H - camY * pv;
    if (fillDown) { ctx.fillStyle = strip.bot; ctx.fillRect(cv.x, y + H - 1, cv.w, Math.max(0, cv.y + cv.h - (y + H) + 40)); }
    for (let x = ox + Math.floor((cv.x - ox) / W) * W; x < cv.x + cv.w; x += W) {
      // only blit the part that is on screen
      const sx = Math.max(0, cv.x - x), sw = Math.min(W, cv.x + cv.w - x) - sx;
      if (sw > 0 && y < cv.y + cv.h) ctx.drawImage(strip.cv, sx, 0, sw, H, x + sx, y, sw, H);
    }
    return { ox, y };
  }

  RR.drawBG = function (ctx, bg, cam, cv, t, prog, v) {
    const d = bg.dist; const TT = RR.T || ((n, f) => f());
    // sky (baked at low resolution: gradient + sun/moon glow)
    TT('sky', () => {
      v = v || cv;
      const bucket = d.sun && d.sun.rises ? Math.round(prog * 24) : 0;
      const key = (v.w | 0) + 'x' + (v.h | 0) + '|' + bucket;
      const B = { x: v.x - 0.25 * v.w, y: v.y - 0.25 * v.h, w: 1.5 * v.w, h: 1.5 * v.h };
      if (bg.skyKey !== key) {
        const sc = 0.4, c = bg.skyCv || (bg.skyCv = document.createElement('canvas'));
        c.width = Math.ceil(B.w * sc); c.height = Math.ceil(B.h * sc);
        const g = c.getContext('2d'); g.scale(sc, sc); g.translate(-B.x, -B.y);
        const top = Math.min(B.y, -400) - 40, bot = 760;
        const gr = g.createLinearGradient(0, top, 0, bot);
        for (const [p, col] of d.sky) gr.addColorStop(clamp(p * 0.98, 0, 1), col);
        g.fillStyle = gr; g.fillRect(B.x - 2, B.y - 2, B.w + 4, Math.max(760, B.y + B.h) - B.y + 4);
        const body = d.sun || d.moon;
        if (body) { let by = body.y; if (d.sun && d.sun.rises) by = body.y + 120 - prog * 250; RR.glow(g, 'p_light_01', body.glow, body.x, by, body.r * 5.2, 0.55); }
        bg.skyKey = key; bg.skyB = B;
      }
      const cut = Math.min(B.h, 860 - B.y); // below the horizon the skyline covers everything
      if (cut > 0) ctx.drawImage(bg.skyCv, 0, 0, bg.skyCv.width, bg.skyCv.height * cut / B.h, B.x, B.y, B.w, cut);
    });
    // stars
    TT('stars', () => {
    if (d.stars > 0.05) {
      ctx.fillStyle = '#fff';
      for (const s of bg.stars) {
        const sx = (((s.x - cam.x * 0.02) % 2600) + 2600) % 2600 - 340;
        const a = d.stars * s.b * (0.55 + 0.45 * Math.sin(t * 1.7 + s.ph)) * (d.sun && d.sun.rises ? 1 - prog * 0.8 : 1);
        if (a < 0.03) continue;
        ctx.globalAlpha = a;
        for (let k = -1; k <= 1; k++) { const px = sx + k * 2600; if (px >= cv.x - 10 && px <= cv.x + cv.w + 10) ctx.fillRect(px, s.y - cam.y * 0.01 - 60, s.s, s.s); }
      }
      ctx.globalAlpha = 1;
    }
    });
    // sun / moon
    TT('body', () => {
    const body = d.sun || d.moon;
    if (body) {
      let bx = body.x - cam.x * 0.01, by = body.y - cam.y * 0.02;
      if (d.sun && d.sun.rises) by = body.y + 120 - prog * 250;
      const r = body.r;
      if (d.sun) {
        ctx.fillStyle = body.c; ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(bx - r * 0.25, by - r * 0.25, r * 0.55, 0, TAU); ctx.fill();
        if (d.sun.rises) { ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#FFF2C0'; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + t * 0.05; ctx.beginPath(); ctx.moveTo(bx, by); ctx.arc(bx, by, 1900, a, a + 0.07); ctx.closePath(); ctx.fill(); } ctx.restore(); }
      } else {
        ctx.fillStyle = body.c; ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(120,130,190,0.25)'; for (const [dx, dy, rr] of [[-0.3, -0.2, 0.22], [0.25, 0.25, 0.28], [0.3, -0.35, 0.14], [-0.35, 0.3, 0.12]]) { ctx.beginPath(); ctx.arc(bx + dx * r, by + dy * r, rr * r, 0, TAU); ctx.fill(); }
        // sleepy face
        D.eyes(ctx, bx, by + r * 0.05, r * 0.14, 'sleepy', 0, 0, 1.9); D.mouth(ctx, bx, by + r * 0.3, r * 0.15, 'smile');
      }
    }
    });
    // clouds (far)
    TT('clouds', () => {
    for (const c of bg.clouds) {
      const f = RR.A.f['cloud' + c.n]; if (!f) continue;
      const w = f[2] / 2 * c.s * 1.3, h = f[3] / 2 * c.s * 1.3;
      const cx = (((c.x + t * c.sp - cam.x * c.pf) % 3200) + 3200) % 3200 - 400 + (cv.x < 0 ? cv.x * 0.0 : 0);
      for (let k = -1; k <= 1; k++) { const px = cx + k * 3200; if (px + w < cv.x || px > cv.x + cv.w) continue; ctx.globalAlpha = 0.5; RR.sprT(ctx, 'cloud' + c.n, d.cloud, px, c.y - cam.y * 0.03 - h / 2, w, h); }
    }
    ctx.globalAlpha = 1;
    });
    // shooting star
    if (d.stars > 0.5) {
      const s = bg.shoot; s.t -= 0.016; if (s.t < 0 && s.a <= 0) { s.a = 1; s.x = cv.x + cv.w * (0.3 + Math.random() * 0.6); s.y = -40 + Math.random() * 260; s.t = 7 + Math.random() * 8; }
      if (s.a > 0) { s.a -= 0.025; s.x -= 26; s.y += 11; ctx.strokeStyle = `rgba(255,255,255,${s.a})`; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + 90, s.y - 38); ctx.stroke(); }
    }
    // birds at dawn
    if (d.sun && d.sun.rises) {
      ctx.strokeStyle = 'rgba(80,40,90,0.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (const b of bg.birds) { const bx = (((b.x + t * b.sp - cam.x * 0.05) % 3000) + 3000) % 3000 - 300, by = b.y - cam.y * 0.04, f = Math.sin(t * 7 + b.ph) * 6 * b.s; ctx.beginPath(); ctx.moveTo(bx - 14 * b.s, by - f); ctx.quadraticCurveTo(bx - 6 * b.s, by - 8 * b.s - f, bx, by); ctx.quadraticCurveTo(bx + 6 * b.s, by - 8 * b.s - f, bx + 14 * b.s, by - f); ctx.stroke(); }
    }
    // far skyline
    let f1, f2, f3;
    TT('far', () => { f1 = drawStrip(ctx, bg.far, cam.x, 0.05, cam.y, 0.08, 700, cv, d.style === 'harbor' || d.style === 'towers'); });
    // sea / cloud-sea band
    if (d.style === 'harbor') {
      const sy = 690 - cam.y * 0.1;
      const sg = ctx.createLinearGradient(0, sy, 0, sy + 360); sg.addColorStop(0, '#2A6BA8'); sg.addColorStop(1, '#0E2A5A');
      ctx.fillStyle = sg; ctx.fillRect(cv.x, sy, cv.w, Math.max(0, cv.y + cv.h - sy));
      const mb = d.moon; ctx.fillStyle = 'rgba(255,246,201,0.5)';
      for (let i = 0; i < 12; i++) { const yy = sy + 12 + i * 18, ww = (60 - i * 3) + Math.sin(t * 1.6 + i) * 14; ctx.fillRect(mb.x - cam.x * 0.01 - ww / 2 + Math.sin(t + i * 0.8) * 12, yy, ww, 4); }
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; for (let i = 0; i < 30; i++) { const xx = ((i * 211 - cam.x * 0.09 + t * 14) % (cv.w + 200)) + cv.x - 100; ctx.fillRect(xx, sy + 30 + (i * 37) % 300, 46, 3); }
    } else if (d.style === 'towers') {
      const sy = 720 - cam.y * 0.1;
      const cg = ctx.createLinearGradient(0, sy - 60, 0, sy + 300); cg.addColorStop(0, 'rgba(120,128,216,0)'); cg.addColorStop(0.25, '#6E78D8'); cg.addColorStop(1, '#3A3E94');
      ctx.fillStyle = cg; ctx.fillRect(cv.x, sy - 60, cv.w, Math.max(0, cv.y + cv.h - sy + 60));
      for (let i = 0; i < 16; i++) { const xx = ((i * 260 - cam.x * 0.12 + t * 8) % (cv.w + 500)) + cv.x - 250; ctx.globalAlpha = 0.6; RR.sprT(ctx, 'cloud' + (1 + i % 3), '#9DA6F0', xx, sy - 40 + (i * 53) % 120, 360, 150); }
      ctx.globalAlpha = 1;
    }
    // far-strip lights (aviation blink / neon glow)
    const stripLights = (st, pos, a) => {
      for (const l of st.lights) {
        const sx0 = pos.ox + Math.floor((cv.x - pos.ox) / st.w) * st.w;
        for (let o = sx0; o < cv.x + cv.w; o += st.w) {
          const lx = o + l.x, ly = pos.y + l.y;
          if (l.glow) RR.glow(ctx, 'p_light_01', l.c, lx, ly, l.r * 3.2, 0.42 + Math.sin(t * 3 + l.x) * 0.12);
          else if (Math.sin(t * 2.6 + l.x) > 0.1) { ctx.fillStyle = l.c; ctx.beginPath(); ctx.arc(lx, ly, l.r, 0, TAU); ctx.fill(); RR.glow(ctx, 'p_light_01', '#FF5A5F', lx, ly, 46, 0.7); }
        }
      }
    };
    stripLights(bg.far, f1);
    TT('mid', () => { f2 = drawStrip(ctx, bg.mid, cam.x, 0.14, cam.y, 0.18, 880, cv, false); stripLights(bg.mid, f2); });
    TT('near', () => { f3 = drawStrip(ctx, bg.near, cam.x, 0.3, cam.y, 0.38, 1030, cv, true); stripLights(bg.near, f3); });
  };

  /* =============== rooftops =============== */
  const winCache = {};
  function archPath(x, y, w, h) { const p = new Path2D(); const r = w / 2; p.moveTo(x, y + h); p.lineTo(x, y + r); p.arc(x + r, y + r, r, Math.PI, 0); p.lineTo(x + w, y + h); p.closePath(); return p; }
  function litWindow(ctx, x, y, w, h, color, R, t, seed) {
    // dark frame tile + warm glowing arch, sometimes with a silhouette
    RR.spr(ctx, 'windowOpen', x, y, w, h);
    const ix = x + w * 0.17, iy = y + h * 0.1, iw = w * 0.66, ih = h * 0.9;
    const p = archPath(ix, iy, iw, ih);
    ctx.fillStyle = color; ctx.fill(p);
    ctx.save(); ctx.clip(p);
    const gr = ctx.createLinearGradient(0, iy, 0, iy + ih); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,120,60,0.25)'); ctx.fillStyle = gr; ctx.fillRect(ix, iy, iw, ih);
    const k = seed % 7;
    ctx.fillStyle = 'rgba(60,35,80,0.55)';
    if (k === 0) { ctx.beginPath(); ctx.ellipse(ix + iw * 0.5, iy + ih * 0.86, iw * 0.3, ih * 0.14, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(ix + iw * 0.3, iy + ih * 0.8); ctx.lineTo(ix + iw * 0.26, iy + ih * 0.6); ctx.lineTo(ix + iw * 0.4, iy + ih * 0.7); ctx.lineTo(ix + iw * 0.56, iy + ih * 0.7); ctx.lineTo(ix + iw * 0.7, iy + ih * 0.6); ctx.lineTo(ix + iw * 0.7, iy + ih * 0.8); ctx.fill(); } // cat
    else if (k === 1) { ctx.fillRect(ix + iw * 0.4, iy + ih * 0.7, iw * 0.2, ih * 0.3); ctx.beginPath(); ctx.arc(ix + iw * 0.5, iy + ih * 0.62, iw * 0.24, 0, TAU); ctx.fill(); ctx.fillRect(ix + iw * 0.12, iy + ih * 0.78, iw * 0.76, ih * 0.22); } // plant / person
    ctx.restore();
    ctx.strokeStyle = 'rgba(214,190,150,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ix + iw / 2, iy + 2); ctx.lineTo(ix + iw / 2, iy + ih); ctx.moveTo(ix, iy + ih * 0.5); ctx.lineTo(ix + iw, iy + ih * 0.5); ctx.stroke();
  }

  /* facade tiles are baked into 1024-wide chunks the first time they scroll into view */
  const CW = 1024, CHH = 720, T = 96;
  function cellRand(seed, c, row, k) { let h = (seed * 73856093) ^ (c * 19349663) ^ (row * 83492791) ^ (k * 2654435761); h = (h ^ (h >>> 13)) * 1274126177; h = h ^ (h >>> 16); return ((h >>> 0) % 100000) / 100000; }
  function bakeChunk(r, dist, ci) {
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = CHH;
    const g = cv.getContext('2d'), ox = ci * CW;     // chunk covers roof-relative x in [ox, ox+CW]
    const cols = Math.ceil(r.w / T), set = dist.fac, rows = Math.ceil(CHH / T) + 1;
    const c0 = Math.max(0, Math.floor(ox / T)), c1 = Math.min(cols, Math.ceil((ox + CW) / T));
    g.fillStyle = U.shade(dist.near, 0.1); g.fillRect(0, 0, CW, CHH);
    const alts = ['', '', '', 'Alt', 'Alt2'];
    for (let c = c0; c < c1; c++) for (let row = 0; row < rows; row++) {
      const nm = row === 0 ? 'house' + set + 'Top' + (c === 0 ? 'Left' : c === cols - 1 ? 'Right' : 'Mid') : 'house' + set + alts[Math.floor(cellRand(r.seed, c, row, 1) * 5)];
      RR.spr(g, nm, c * T - ox, row * T, T + 1, T + 1);
    }
    for (let c = Math.max(0, c0 - 1); c < c1; c++) for (let row = 1; row < rows; row += 2) {
      const wx = c * T - ox + T * 0.06, wy = row * T + T * 0.04, ww = T * 0.88;
      const roll = cellRand(r.seed, c, row, 2), lit = cellRand(r.seed, c, row, 3) < 0.7, aw = cellRand(r.seed, c, row, 4) < 0.12, seed = Math.floor(cellRand(r.seed, c, row, 5) * 100);
      if (roll < 0.08) continue;
      if (lit) litWindow(g, wx, wy, ww, ww, dist.win, null, 0, seed); else RR.spr(g, roll < 0.5 ? 'windowOpen' : 'windowLow', wx, wy, ww, ww);
      if (aw) RR.spr(g, ['awningRed', 'awningGreen', 'awningGreenRed'][seed % 3], wx - T * 0.02, wy - T * 0.28, ww + T * 0.04, ww * 0.8);
    }
    // a sign / clock now and then
    for (let c = c0; c < c1; c++) {
      if (cellRand(r.seed, c, 0, 6) < 0.16) RR.spr(g, ['signHangingCup', 'signHangingBed', 'signHangingCoin'][Math.floor(cellRand(r.seed, c, 0, 7) * 3)], c * T - ox + 8, T * 1.25, 80, 80);
      else if (cellRand(r.seed, c, 0, 8) < 0.1) RR.spr(g, 'clock', c * T - ox + 12, T * 2.3, 70, 70);
    }
    g.globalCompositeOperation = 'multiply'; g.fillStyle = dist.facTint; g.fillRect(0, 0, CW, CHH); g.globalCompositeOperation = 'source-over';
    const sg = g.createLinearGradient(0, 0, 0, CHH); sg.addColorStop(0, 'rgba(20,10,50,0)'); sg.addColorStop(0.5, 'rgba(20,10,50,0.35)'); sg.addColorStop(0.82, 'rgba(14,8,40,0.8)'); sg.addColorStop(1, '#0E0828'); g.fillStyle = sg; g.fillRect(0, 0, CW, CHH);
    // edge shading where the building ends
    if (ox < 80) { const eg = g.createLinearGradient(-ox, 0, 70 - ox, 0); eg.addColorStop(0, 'rgba(15,5,40,0.6)'); eg.addColorStop(1, 'rgba(15,5,40,0)'); g.fillStyle = eg; g.fillRect(0, 0, 90, CHH); }
    if (ox + CW > r.w - 80) { const ex = r.w - ox; const eg = g.createLinearGradient(ex - 70, 0, ex, 0); eg.addColorStop(0, 'rgba(15,5,40,0)'); eg.addColorStop(1, 'rgba(15,5,40,0.6)'); g.fillStyle = eg; g.fillRect(ex - 90, 0, 90, CHH); }
    return cv;
  }
  RR.drawRoof = function (ctx, r, dist, cv, t) {
    const x = r.x, y = r.y, w = r.w;
    if (x > cv.x + cv.w + 40) return;
    if (x + w < cv.x - 40) { if (r.cache && x + w < cv.x - 3500) r.cache = null; return; }
    if (!RR.A.ready) return;
    const bottom = cv.y + cv.h + 30;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y - 2, w, bottom - y + 6); ctx.clip();
    r.cache = r.cache || {};
    const n = Math.ceil(w / CW);
    for (let ci = Math.max(0, Math.floor((cv.x - x) / CW)); ci < n && x + ci * CW < cv.x + cv.w; ci++) {
      const ch = r.cache[ci] || (r.cache[ci] = bakeChunk(r, dist, ci));
      ctx.drawImage(ch, x + ci * CW, y);
    }
    if (bottom > y + CHH - 2) { ctx.fillStyle = '#0E0828'; ctx.fillRect(x, y + CHH - 2, w, bottom - y - CHH + 6); }
    ctx.restore();
    // roof cap (running surface)
    const capH = 18;
    D.sticker(ctx, P.rr(x - 8, y - 4, w + 16, capH + 8, 8), dist.cap, { x: x - 8, y: y - 4, w: w + 16, h: capH + 8 }, { shadow: false, lw: 5, highlight: false });
    ctx.fillStyle = dist.capTop; ctx.fillRect(x - 2, y - 1, w + 4, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 4, y + 7, w - 8, 3);
  };

  RR.drawRoofDeco = function (ctx, r, dist, cv, t) {
    if (r.x > cv.x + cv.w + 100 || r.x + r.w < cv.x - 400) return;
    for (const d of r.deco) {
      const f = RR.deco[d.type]; if (f && d.x > cv.x - 260 && d.x < cv.x + cv.w + 40) f(ctx, d.x, r.y - 1, { t });
    }
  };

  RR.gapShade = function (ctx, L, cv) {
    // dark alley between roofs
    for (const ob of L.obs) {
      if (!ob.edge) continue;
      const x0 = ob.edge, w = ob.gapW, y0 = ob.roof.y;
      if (x0 > cv.x + cv.w || x0 + w < cv.x) continue;
      const g = ctx.createLinearGradient(0, Math.min(y0, ob.roofTo.y), 0, cv.y + cv.h);
      g.addColorStop(0, 'rgba(10,5,35,0.0)'); g.addColorStop(0.35, 'rgba(10,5,35,0.5)'); g.addColorStop(1, 'rgba(5,0,25,0.85)');
      ctx.fillStyle = g; ctx.fillRect(x0, Math.min(y0, ob.roofTo.y) - 10, w, cv.y + cv.h - Math.min(y0, ob.roofTo.y) + 40);
    }
  };
})();
