/* Turbo Type - a kart race where your kart moves as fast as you type the passage. */
(function () {
  'use strict';
  const TM = window.TM, C = TM.C, U = TM.U, D = TM.draw, P = D.P, A = TM.art;
  const W = 1920, H = 1080, CAMX = 640, TRACK_Y = 170, LANE_H = 96, PANEL_Y = 720;

  const RIVALS = [
    { name: 'Mochi', color: '#FF8FC8', helmet: '#fff' },
    { name: 'Taro', color: '#2F9BFF', helmet: '#FFE066' },
    { name: 'Sora', color: '#2BB673', helmet: '#fff' },
  ];
  const music = TM.audio.song({
    bpm: 150, roots: [40, 36, 38, 35],
    chords: [[64, 67, 71], [60, 64, 67], [62, 66, 69], [59, 63, 66]],
    bassPattern: [0, 0, 12, 0, 0, 12, 0, 10, 0, 0, 12, 0, 7, 0, 10, 12],
    lead: [76, null, 79, null, 83, null, 81, 79, null, 76, null, 74, 76, null, null, null, 72, null, 76, null, 79, null, 78, 76, null, 74, null, 71, 74, null, null, null],
    wave: 'square',
  });

  let S;
  function baseWpm(g) {
    const recent = TM.store.get('turbo.wpm', 0);
    const def = g.diff === 'gentle' ? 10 : g.diff === 'turbo' ? 28 : 18;
    return Math.max(def, Math.min(recent, def * 2));
  }
  function buildPassage(g) {
    const segs = [];
    if (g.diff === 'turbo' && g.dealer.pool.sentences.length) {
      let len = 0; const used = new Set();
      while (len < 110 && segs.length < 8) { const it = g.dealer.next({ kind: 'sentence', avoid: used }); used.add(it.t); segs.push(it); len += it.t.length + 1; }
    } else {
      const n = g.diff === 'gentle' ? 8 : 13; const used = new Set();
      for (let i = 0; i < n; i++) { const it = g.dealer.next({ kind: 'word', maxLen: g.diff === 'gentle' ? 7 : 12, avoid: used }); used.add(it.t); segs.push(it); }
    }
    const text = segs.map((s) => s.t).join(' ');
    const typer = new TM.Typer({ t: text, hint: '', kind: 'passage', len: TM.typedLen(text) });
    // map each segment to its range in typer.chars
    let ci = 0; const ranges = [];
    for (const s of segs) { const n = TM.typedChars(s.t).length; ranges.push({ item: s, start: ci, end: ci + n, errors0: 0, done: false }); ci += n + 1; }
    return { typer, ranges };
  }
  function reset(g) {
    const ps = buildPassage(g);
    const wpm = baseWpm(g);
    const total = ps.typer.chars.filter((c) => !c.opt).length;
    const mult = g.diff === 'gentle' ? [0.55, 0.75, 0.95] : [0.8, 0.98, 1.15];
    const ghostT = TM.store.get('turbo.ghost.' + TM.deck.key() + '.' + g.diff, null);
    S = {
      typer: ps.typer, ranges: ps.ranges, total, dist: 7200, pos: 0, shown: 0, seg: 0, raceT: 0, finished: [], done: false,
      rivals: RIVALS.map((r, i) => ({ ...r, cps: (wpm * mult[i] * 5) / 60, x: 0, wob: Math.random() * 6, done: false, lane: [0, 1, 3][i] })),
      ghost: ghostT ? { cps: total / ghostT, x: 0, done: false, lane: 4 } : null,
      nitro: 0, boost: 0, bonusDist: 0, sputter: 0, cleanRun: 0, bot: new TM.Bot(7), smoke: [], camX: 0, place: 0,
    };
  }
  const playerX = () => (S.typer.typedReq / S.total) * S.dist + S.bonusDist;

  function onKey(g, k) {
    if (S.done) return;
    const before = S.typer.pos;
    const r = S.typer.feed(k);
    g.keyResult(r);
    if (r === 'miss') { S.sputter = 0.35; S.cleanRun = 0; S.nitro = Math.max(0, S.nitro - 0.15); return; }
    afterType(g, before);
  }
  function afterType(g, before) {
    // finished segments
    for (let i = S.seg; i < S.ranges.length; i++) {
      const rg = S.ranges[i];
      if (S.typer.pos >= rg.end || S.typer.done) {
        const errs = S.typer.errors - rg.errors0;
        if (S.ranges[i + 1]) S.ranges[i + 1].errors0 = S.typer.errors;
        S.seg = i + 1;
        const x = CAMX + 40;
        g.wordDone({ item: rg.item, errors: errs }, x, TRACK_Y + 2 * LANE_H - 60, { bonus: S.boost > 0 ? 1.5 : 1 });
        if (errs === 0) { S.cleanRun++; S.nitro = Math.min(1, S.nitro + (rg.item.kind === 'sentence' ? 0.5 : 0.25)); } else S.cleanRun = 0;
        if (S.nitro >= 1) { S.nitro = 0; S.boost = 2.2; TM.sfx.boost(); if (!g.demo) g.fx.pop(CAMX + 100, TRACK_Y + 140, 'NITRO!', { color: C.turbo, size: 70 }); }
      } else break;
    }
    if (S.typer.done && !S.done) finish(g);
  }
  function finish(g) {
    S.done = true;
    const place = 1 + S.rivals.filter((r) => r.done).length + (S.ghost && S.ghost.done ? 1 : 0);
    S.place = place;
    if (g.demo) { setTimeout(() => { if (TM.current.demo) reset(g); }, 2500); return; }
    const secs = g.playT;
    const wpm = g.score.wpm(secs);
    TM.store.set('turbo.wpm', Math.round((TM.store.get('turbo.wpm', wpm) + wpm) / 2));
    const gk = 'turbo.ghost.' + TM.deck.key() + '.' + g.diff;
    const old = TM.store.get(gk, null);
    if (!old || secs < old) TM.store.set(gk, secs);
    g.score.add([500, 300, 200, 100, 50][place - 1] || 0);
    g.fx.confetti(CAMX + 200, TRACK_Y + 200, place === 1 ? 120 : 40);
    const names = ['1st', '2nd', '3rd', '4th', '5th'];
    g.end({ win: place <= 3, title: place === 1 ? 'You won!' : `${names[place - 1]} place!`, sub: place === 1 ? 'Fastest kart on the track!' : 'Race again to beat them!', targetMet: place === 1, stats: [['Place', names[place - 1]]], delay: 1800 });
  }

  function update(g, dt) {
    const racing = g.state === 'play' || (g.demo && g.state === 'title');
    if (racing) S.raceT += dt;
    if (racing && !S.done) {
      for (const r of S.rivals.concat(S.ghost ? [S.ghost] : [])) {
        if (r.done) continue;
        r.x += r.cps * (S.dist / S.total) * dt * (1 + Math.sin(S.raceT * 0.8 + (r.wob || 0)) * 0.12);
        if (r.x >= S.dist) { r.x = S.dist; r.done = true; }
      }
    } else if (S.done) for (const r of S.rivals) if (!r.done) r.x += r.cps * (S.dist / S.total) * dt;
    if (S.boost > 0) { S.boost -= dt; S.bonusDist += 260 * dt; }
    S.sputter = Math.max(0, S.sputter - dt);
    const target = Math.min(playerX(), S.dist + S.bonusDist);
    S.shown += (target - S.shown) * Math.min(1, dt * (S.sputter > 0 ? 1 : 8));
    if (S.sputter > 0 && Math.random() < 0.4) S.smoke.push({ x: S.shown - 60, y: TRACK_Y + 2 * LANE_H + U.rand(-10, 10), t: 0 });
    for (const s of S.smoke) s.t += dt;
    S.smoke = S.smoke.filter((s) => s.t < 0.8);
    S.camX += (S.shown - S.camX) * Math.min(1, dt * 6);
    if (g.demo && !S.done) { const before = S.typer.pos; S.bot.step(dt, S.typer, () => afterType(g, before)); }
    if (S.typer.shake > 0) S.typer.shake = Math.max(0, S.typer.shake - dt * 3);
  }

  /* ---------- drawing ---------- */
  const sx = (wx) => CAMX + (wx - S.camX);
  function drawTrack(g, ctx) {
    const v = g.vw();
    ctx.fillStyle = '#7ACB68'; ctx.fillRect(v.x, v.y, v.w, PANEL_Y - v.y);
    // grass stripes
    ctx.fillStyle = '#86D474';
    for (let i = -2; i < 20; i++) { const x = ((i * 240 - S.camX * 1) % 4800 + 4800) % 4800 - 480; ctx.fillRect(x, v.y, 120, TRACK_Y - 30 - v.y); ctx.fillRect(x, TRACK_Y + 5 * LANE_H + 30, 120, PANEL_Y - (TRACK_Y + 5 * LANE_H + 30)); }
    // stands with crowd + Kip
    for (let i = -1; i < 6; i++) {
      const x = ((i * 900 - S.camX * 0.9) % 5400 + 5400) % 5400 - 900;
      D.sticker(ctx, P.rr(x, 20, 600, 100, 16), '#E9E4F7', { x, y: 20, w: 600, h: 100 });
      for (let j = 0; j < 14; j++) { ctx.fillStyle = TM.CONFETTI[(j + i * 3 + 7) % TM.CONFETTI.length]; ctx.beginPath(); ctx.arc(x + 30 + j * 41, 62 + Math.sin(S.raceT * 8 + j) * 5, 15, 0, 7); ctx.fill(); }
    }
    // track
    const ty = TRACK_Y, th = 5 * LANE_H;
    ctx.fillStyle = '#5B5670'; ctx.fillRect(v.x, ty, v.w, th);
    // curbs
    for (let i = 0; i < 50; i++) { const wx = Math.floor(S.camX / 60) * 60 + (i - 16) * 60; const xx = sx(wx); ctx.fillStyle = Math.floor(wx / 60) % 2 ? '#fff' : '#FF5A5F'; ctx.fillRect(xx, ty - 18, 60, 18); ctx.fillRect(xx, ty + th, 60, 18); }
    ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.strokeRect(v.x - 10, ty - 18, v.w + 20, th + 36);
    // lane dashes
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let l = 1; l < 5; l++) for (let i = -2; i < 30; i++) { const wx = Math.floor(S.camX / 140) * 140 + (i - 6) * 140; ctx.fillRect(sx(wx), ty + l * LANE_H - 3, 70, 6); }
    // start + finish lines
    for (const [wx, label] of [[0, 'START'], [S.dist, 'FINISH']]) {
      const x = sx(wx);
      if (x < v.x - 100 || x > v.x + v.w + 100) continue;
      for (let r = 0; r < th / 24; r++) for (let c = 0; c < 2; c++) { ctx.fillStyle = (r + c) % 2 ? '#fff' : C.ink; ctx.fillRect(x + c * 24, ty + r * 24, 24, 24); }
      D.text(ctx, label, x + 24, ty - 50, { size: 44, color: '#fff', outline: 10 });
    }
  }
  function lane(l) { return TRACK_Y + LANE_H * l + LANE_H / 2; }
  function drawKarts(g, ctx) {
    for (const s of S.smoke) { ctx.globalAlpha = 1 - s.t / 0.8; ctx.fillStyle = '#C9C6D6'; ctx.beginPath(); ctx.arc(sx(s.x) - s.t * 80, s.y - s.t * 30, 16 + s.t * 30, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    const karts = S.rivals.map((r) => ({ x: r.x, l: r.lane, color: r.color, helmet: r.helmet, name: r.name }));
    if (S.ghost) karts.push({ x: S.ghost.x, l: 4, color: C.turbo, ghost: true, name: 'Your best' });
    for (const k of karts) {
      const x = sx(k.x);
      ctx.save(); if (k.ghost) ctx.globalAlpha = 0.4;
      A.kart(ctx, x, lane(k.l) + Math.sin(S.raceT * 20 + k.l) * 1.5, 0.95, { color: k.color, helmet: k.helmet });
      ctx.restore();
      D.text(ctx, k.name, x - 10, lane(k.l) - 46, { size: 24, color: '#fff', outline: 7, font: D.FONT_DISPLAY(24, 700) });
    }
    const px = sx(S.shown);
    A.kart(ctx, px, lane(2) + (S.sputter > 0 ? U.rand(-3, 3) : 0), 1.05, { color: C.turbo, flame: S.boost > 0 });
    D.text(ctx, 'YOU', px - 10, lane(2) - 52, { size: 28, color: C.gold, outline: 8 });
  }
  function drawMini(g, ctx) {
    const x0 = 560, x1 = 1360, y = 140;
    ctx.save();
    D.pill(ctx, x0 - 24, y - 20, x1 - x0 + 48, 40, 'rgba(31,26,61,0.75)');
    const all = S.rivals.map((r) => [r.x, r.color]).concat(S.ghost ? [[S.ghost.x, 'rgba(255,122,26,0.5)']] : []).concat([[S.shown, C.turbo]]);
    for (const [wx, col] of all) { const x = x0 + U.clamp(wx / S.dist, 0, 1) * (x1 - x0); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, col === C.turbo ? 14 : 10, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.fillRect(x1 + 8, y - 14, 6, 28);
    ctx.restore();
  }
  function drawPanel(g, ctx) {
    const v = g.vw();
    ctx.fillStyle = '#2A2350'; ctx.fillRect(v.x, PANEL_Y, v.w, v.y + v.h - PANEL_Y);
    ctx.lineWidth = 6; ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.moveTo(v.x, PANEL_Y); ctx.lineTo(v.x + v.w, PANEL_Y); ctx.stroke();
    // nitro meter
    D.pill(ctx, 80, PANEL_Y + 34, 360, 34, 'rgba(255,255,255,0.15)');
    if (S.nitro > 0 || S.boost > 0) D.pill(ctx, 80, PANEL_Y + 34, 360 * (S.boost > 0 ? 1 : S.nitro), 34, S.boost > 0 ? C.gold : C.turbo);
    D.text(ctx, S.boost > 0 ? 'NITRO!' : 'NITRO', 470, PANEL_Y + 52, { size: 30, color: S.boost > 0 ? C.gold : '#fff', align: 'left' });
    // current segment hint
    const cur = S.ranges[Math.min(S.seg, S.ranges.length - 1)];
    if (g.hint && cur && cur.item.hint) { ctx.font = D.FONT_JA(30); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(cur.item.hint, W - 80, PANEL_Y + 52); }
    if (g.demo) return;
    // passage, wrapped into lines; show the line being typed and the next one
    const size = 58, font = D.FONT_WORD(size), fontB = D.FONT_WORD(size, 700);
    ctx.font = font;
    const chars = S.typer.chars, maxW = W - 200;
    const lines = []; let line = [], lw = 0, word = [], ww = 0;
    const flushWord = () => { if (lw + ww > maxW && line.length) { lines.push(line); line = []; lw = 0; } line.push(...word); lw += ww; word = []; ww = 0; };
    chars.forEach((c, i) => { const w = ctx.measureText(c.c).width; word.push({ i, c, w }); ww += w; if (c.k === ' ') flushWord(); });
    flushWord(); if (line.length) lines.push(line);
    let li = lines.findIndex((l) => l.some((q) => q.i >= S.typer.pos)); if (li < 0) li = lines.length - 1;
    let nextIdx = -1; for (let i = S.typer.pos; i < chars.length; i++) if (!chars[i].opt) { nextIdx = i; break; }
    const curRange = S.ranges[S.seg];
    for (let row = 0; row < 2; row++) {
      const L = lines[li + row]; if (!L) break;
      let x = 100; const y = PANEL_Y + 150 + row * 100;
      if (row === 0) { D.pill(ctx, 70, y - 50, W - 140, 100, 'rgba(255,255,255,0.08)'); }
      for (const q of L) {
        const done = q.i < S.typer.pos;
        const inCur = curRange && q.i >= curRange.start && q.i < curRange.end;
        ctx.font = done ? fontB : font; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        ctx.fillStyle = done ? C.turbo : row === 0 ? (inCur ? '#fff' : 'rgba(255,255,255,0.7)') : 'rgba(255,255,255,0.4)';
        if (q.c.opt && !done) ctx.fillStyle = 'rgba(255,255,255,0.35)';
        if (q.i === nextIdx && S.typer.shake > 0) ctx.fillStyle = C.miss;
        ctx.fillText(q.c.c, x, y);
        if (q.i === nextIdx) { ctx.fillStyle = S.typer.shake > 0 ? C.miss : C.turbo; ctx.fillRect(x, y + 34, Math.max(q.w, 26), 8); }
        x += q.w;
      }
    }
  }
  function draw(g, ctx) {
    drawTrack(g, ctx); drawKarts(g, ctx); drawMini(g, ctx); drawPanel(g, ctx);
    g.fx.draw(ctx);
    if (S.done && S.place) D.text(ctx, ['1st!', '2nd!', '3rd!', '4th', '5th'][S.place - 1], W / 2, 420, { size: 160, color: S.place === 1 ? C.gold : '#fff', outline: 20 });
  }

  TM.game({
    id: 'turbo-type', name: 'Turbo Type', accent: C.turbo, bg: '#2A2350',
    logoHTML: 'Turbo<br>Type', tagline: 'Your kart goes as fast as you type!',
    howto: [
      'Type the words in the panel at the bottom, in order. Every correct letter pushes your kart forward.',
      'A wrong key makes your kart sputter until you press the right key.',
      'Type words with no mistakes to fill the <b>NITRO</b> bar for a speed boost.',
      'Race three rivals and the ghost of <b>your best race</b> on this word list.',
      '<b>Turbo</b> races use the key sentences from your textbook unit.',
    ],
    music, reset, update, draw, onKey,
    nextKey: () => S.typer.nextReq(),
    hud: () => {
      const ahead = S.rivals.filter((r) => r.x > S.shown).length + (S.ghost && S.ghost.x > S.shown ? 1 : 0);
      return { right: ['1st', '2nd', '3rd', '4th', '5th'][S.done ? S.place - 1 : ahead] + ' place' };
    },
  });
})();
