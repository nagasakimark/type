/* Word Ninja - fruit is tossed up; type its word to slice it before it drops. */
(function () {
  'use strict';
  const TM = window.TM, C = TM.C, U = TM.U, D = TM.draw, P = D.P, A = TM.art;
  const W = 1920, H = 1080, COUNTER = 930;
  const GENTLE_TIME = 90;

  const music = TM.audio.song({
    bpm: 132, roots: [38, 41, 36, 33],
    chords: [[62, 65, 69], [65, 69, 72], [60, 64, 67], [57, 60, 64]],
    bassPattern: [0, null, 0, 12, null, 0, 7, null, 0, null, 0, 12, null, 10, 7, null],
    lead: [74, null, 77, 79, null, 81, null, 79, 77, null, 74, null, 72, null, 74, null, 77, null, 81, 84, null, 81, null, 79, 77, null, 79, null, 81, null, null, null],
    wave: 'triangle',
  });

  let S;
  function reset(g) {
    S = { fruits: [], halves: [], trails: [], lock: new TM.LockOn(), lives: 3, spawnT: 1, sliced: 0, lastSlice: -9, chain: 0, frenzy: 0, goldenAt: 18, timeLeft: GENTLE_TIME, bot: new TM.Bot(8), botDelay: 0, lanterns: [0, 1, 2, 3].map((i) => ({ x: 240 + i * 480, ph: i })) };
  }
  const stage = () => Math.min(1, S.sliced / 36);

  function spawn(g, opts = {}) {
    const lad = g.ladder(stage());
    const sentence = !opts.golden && !S.frenzy && lad.kind === 'sentence' && Math.random() < 0.3;
    const avoidFirst = S.lock.firstLetters(S.fruits);
    const item = g.dealer.next(sentence ? { kind: 'sentence', maxWords: 4, avoidFirst } : { kind: 'word', maxLen: S.frenzy ? 5 : Math.min(8, lad.maxLen), avoidFirst });
    const kind = opts.golden ? 'orange' : sentence ? 'watermelon' : U.pick(['apple', 'orange', 'peach', 'melon', 'tomato', 'lemon', 'plum', 'kiwi']);
    const r = sentence ? 70 : 58;
    const x = U.rand(320, W - 320);
    const apex = U.rand(330, 470);
    // airtime grows with word length so every word is fair
    const per = g.diff === 'gentle' ? 0.42 : g.diff === 'turbo' ? 0.24 : 0.32;
    const T = U.clamp((1.6 + item.len * per) * (S.frenzy ? 0.8 : 1), 2.2, sentence ? 9 : 6.5);
    const rise = H + 80 - apex;
    const grav = (8 * rise) / (T * T);
    const vy = -Math.sqrt(2 * grav * rise);
    const vx = (W / 2 - x) / T * U.rand(0.2, 0.7);
    S.fruits.push({ x, y: H + 80, vx, vy, grav, r, kind, rot: 0, vr: U.rand(-1.5, 1.5), typer: new TM.Typer(item), alive: true, golden: !!opts.golden, seed: Math.random() * 9, danger: 0, hit: 0 });
  }

  function onKey(g, k) {
    const { target, result } = S.lock.feed(k, S.fruits);
    g.keyResult(result);
    if (target && result !== 'miss') target.hit = 1;
    if (result === 'done') slice(g, target);
  }
  function onBack() { S.lock.release(); }

  function slice(g, f) {
    f.alive = false;
    const a = U.rand(-0.6, 0.6);
    S.trails.push({ x: f.x, y: f.y, a, t: 0, len: f.r * 3.4 });
    for (const side of [-1, 1]) S.halves.push({ x: f.x + side * 10, y: f.y, vx: f.vx * 0.5 + side * U.rand(200, 340), vy: Math.min(f.vy, 0) - U.rand(150, 350), grav: 1800, rot: f.rot + a, vr: side * U.rand(3, 6), r: f.r, kind: f.kind, side, t: 0 });
    const juice = { apple: '#FF5A5F', orange: '#FFA62B', peach: '#FFA38F', melon: '#B8E06A', watermelon: '#FF5A6E', tomato: '#FF3D3D', lemon: '#FFE14D', plum: '#A06BE8', kiwi: '#8BD448' }[f.kind] || C.ninja;
    g.fx.splat(f.x, f.y, U.hexA(juice, 0.55), f.r * 1.1, true);
    g.fx.burst(f.x, f.y, { count: 10, color: juice, shape: 'drop', speed: [300, 700] });
    TM.sfx.slice(); g.fx.shake(6, 0.08);
    // quick slices chain into a combo bonus
    const now = g.t;
    S.chain = now - S.lastSlice < 0.9 ? S.chain + 1 : 1;
    S.lastSlice = now;
    const pts = g.wordDone(f.typer, f.x, f.y - f.r - 40, { bonus: f.golden ? 2 : 1, color: f.golden ? C.gold : '#fff' });
    if (S.chain >= 2 && !g.demo) { const b = g.score.add(25 * S.chain); g.fx.pop(f.x, f.y - f.r - 120, `${S.chain} Fruit Combo! +${b}`, { color: C.ninja, size: 46 }); }
    if (!g.demo) S.sliced++;
    if (f.golden) { S.frenzy = 6; g.fx.doFlash('#FFE9A8', 0.6); g.fx.pop(W / 2, 300, 'FRUIT FRENZY!', { size: 110, color: C.gold, life: 1.6 }); TM.sfx.combo(3); }
    if (g.demo) S.botDelay = U.rand(0.3, 0.9);
  }

  function update(g, dt) {
    for (const l of S.lanterns) l.ph += dt;
    const live = g.live || g.demo;
    if (g.state === 'play' && g.diff === 'gentle') {
      S.timeLeft -= dt;
      if (S.timeLeft <= 0) { S.timeLeft = 0; g.end({ win: true, title: "Time's up!", sub: `You sliced ${S.sliced} fruit!`, targetMet: S.sliced >= 25, stats: [['Fruit sliced', S.sliced]] }); }
    }
    if (live) {
      S.spawnT -= dt;
      if (S.frenzy > 0) S.frenzy -= dt;
      const maxOn = S.frenzy > 0 ? 5 : g.demo ? 2 : Math.min(g.diff === 'turbo' ? 4 : 3, 1 + Math.floor(S.sliced / 8));
      const alive = S.fruits.filter((f) => f.alive).length;
      if (S.spawnT <= 0 && alive < maxOn) {
        const golden = !g.demo && S.sliced >= S.goldenAt && !S.frenzy;
        if (golden) S.goldenAt += 22;
        spawn(g, { golden });
        S.spawnT = S.frenzy > 0 ? 0.35 : U.rand(0.8, 1.6) / (g.diff === 'turbo' ? 1.3 : 1);
      }
    }
    for (const f of S.fruits) {
      if (!f.alive) continue;
      f.vy += f.grav * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
      f.hit = Math.max(0, f.hit - dt * 5);
      if (f.typer.shake > 0) f.typer.shake = Math.max(0, f.typer.shake - dt * 3);
      f.danger = f.vy > 0 ? f.y : f.y * 0.2;
      if (f.vy > 0 && f.y > H + 90) {
        f.alive = false;
        if (f.locked) S.lock.release();
        if (!g.demo && g.state === 'play') {
          g.missWord(f.typer.item);
          TM.sfx.hurt();
          if (g.diff !== 'gentle') {
            S.lives--; g.fx.pop(f.x, H - 140, 'Missed!', { color: C.miss, size: 50 }); g.fx.shake(14, 0.18);
            if (S.lives <= 0) g.end({ win: false, title: 'Out of lives!', sub: `You sliced ${S.sliced} fruit.`, targetMet: S.sliced >= 25, stats: [['Fruit sliced', S.sliced]] });
          }
        }
      }
    }
    S.fruits = S.fruits.filter((f) => f.alive || f.y < H + 100);
    S.fruits = S.fruits.filter((f) => f.alive);
    for (const h of S.halves) { h.t += dt; h.vy += h.grav * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vr * dt; }
    S.halves = S.halves.filter((h) => h.y < H + 200);
    for (const tr of S.trails) tr.t += dt;
    S.trails = S.trails.filter((tr) => tr.t < 0.3);
    if (g.demo) {
      S.botDelay -= dt;
      const t = S.lock.locked || S.fruits.filter((f) => f.alive && f.vy > -200).sort((a, b) => b.danger - a.danger)[0];
      if (t && S.botDelay <= 0) S.bot.step(dt, t.typer, (r) => { if (!S.lock.locked && r !== 'done') { S.lock.locked = t; t.locked = true; } if (r === 'done') { S.lock.release(); slice(g, t); } });
    }
  }

  function drawBG(g, ctx) {
    const v = g.vw();
    // warm plank wall
    ctx.fillStyle = '#F6DDB2'; ctx.fillRect(v.x, v.y, v.w, v.h);
    for (let x = Math.floor(v.x / 160) * 160; x < v.x + v.w; x += 160) {
      ctx.fillStyle = (x / 160) % 2 ? '#F1D3A2' : '#F6DDB2'; ctx.fillRect(x, v.y, 160, COUNTER - v.y);
      ctx.fillStyle = 'rgba(160,110,60,0.25)'; ctx.fillRect(x, v.y, 6, COUNTER - v.y);
    }
    // shoji window
    ctx.save();
    D.sticker(ctx, P.rr(700, 150, 520, 330, 18), '#FFFBEF', { x: 700, y: 150, w: 520, h: 330 }, { shadow: true, highlight: false, shade: false });
    ctx.strokeStyle = 'rgba(31,26,61,0.5)'; ctx.lineWidth = 6;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(700 + i * 130, 150); ctx.lineTo(700 + i * 130, 480); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(700, 315); ctx.lineTo(1220, 315); ctx.stroke();
    ctx.restore();
    // lanterns
    for (const l of S.lanterns) {
      const sw = Math.sin(l.ph * 1.6) * 0.06;
      ctx.save(); ctx.translate(l.x, v.y); ctx.rotate(sw);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 90 - v.y); ctx.stroke();
      ctx.translate(0, 150 - v.y);
      D.sticker(ctx, P.ellipse(0, 0, 58, 72), l.x % 960 < 480 ? '#FF5A5F' : C.ninja, { x: -58, y: -72, w: 116, h: 144 });
      ctx.fillStyle = C.ink; ctx.fill(P.rr(-34, -82, 68, 16, 6)); ctx.fill(P.rr(-34, 66, 68, 16, 6));
      ctx.strokeStyle = 'rgba(31,26,61,0.3)'; ctx.lineWidth = 3; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 58, 72 * (0.35 + Math.abs(i) * 0.3), 0, 0, 7); ctx.stroke(); }
      ctx.restore();
    }
    g.fx.drawDecals(ctx);
    // counter
    ctx.fillStyle = '#B97A45'; ctx.fillRect(v.x, COUNTER, v.w, v.y + v.h - COUNTER);
    ctx.fillStyle = '#D9975A'; ctx.fillRect(v.x, COUNTER, v.w, 34);
    ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.moveTo(v.x, COUNTER); ctx.lineTo(v.x + v.w, COUNTER); ctx.moveTo(v.x, COUNTER + 34); ctx.lineTo(v.x + v.w, COUNTER + 34); ctx.stroke();
    // cutting board + Kip chef
    D.sticker(ctx, P.rr(1500, COUNTER - 30, 300, 40, 14), '#E8B97F', { x: 1500, y: COUNTER - 30, w: 300, h: 40 });
    A.kip(ctx, 1650, COUNTER - 92, 0.9, { t: g.t, accent: C.ninja, mood: S.frenzy > 0 ? 'happy' : 'normal', lookX: -0.5 });
  }

  function draw(g, ctx) {
    drawBG(g, ctx);
    for (const h of S.halves) A.fruit(ctx, h.x, h.y, h.r, { kind: h.kind, half: h.side, rot: h.rot });
    for (const f of S.fruits) {
      if (!f.alive) continue;
      if (f.golden) { ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(g.t * 10) * 0.2; ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.5, 0, 7); ctx.fill(); ctx.restore(); }
      const wob = f.hit * 0.08;
      A.fruit(ctx, f.x, f.y, f.r * (1 + wob), { kind: f.golden ? 'orange' : f.kind, rot: f.rot, seed: f.seed, mood: f.locked ? 'wide' : f.vy > 0 && f.y > H - 300 ? 'wide' : 'normal', mouth: f.locked ? 'o' : 'smile' });
      if (f.golden) D.sticker(ctx, P.star(f.x, f.y - f.r - 10, 22, 0.45), C.gold, null, { shadow: false, lw: 4 });
    }
    // chips on top
    const sorted = S.fruits.filter((f) => f.alive).sort((a, b) => (a.locked ? 1 : 0) - (b.locked ? 1 : 0));
    for (const f of sorted) {
      const size = f.typer.item.kind === 'sentence' ? 40 : 46;
      const sz = D.chipSize(ctx, f.typer, size);
      const cx = U.clamp(f.x, sz.w / 2 + 20, W - sz.w / 2 - 20);
      const cy = Math.max(120, f.y - f.r - 52);
      D.chip(ctx, cx, cy, f.typer, { size, accent: C.ninja, locked: f.locked, hint: g.hint });
    }
    for (const tr of S.trails) {
      const k = tr.t / 0.3;
      ctx.save(); ctx.translate(tr.x, tr.y); ctx.rotate(tr.a); ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = U.hexA(C.ninja, 0.6); ctx.lineWidth = 26; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-tr.len / 2, 0); ctx.lineTo(tr.len / 2, 0); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.stroke();
      ctx.restore();
    }
    g.fx.draw(ctx);
    if (S.frenzy > 0) D.text(ctx, 'FRENZY!', W / 2, 170, { size: 60, color: C.gold, outline: 12 });
  }

  TM.game({
    id: 'word-ninja', name: 'Word Ninja', accent: C.ninja, bg: '#F6DDB2',
    logoHTML: 'Word<br>Ninja', tagline: 'Slice the fruit with your words!',
    lifeIcon: TM.ui.heartSVG('#2F9BFF'),
    howto: [
      'Fruit is tossed up from the counter. Each fruit has a <b>word</b>.',
      'Start typing a word and you <b>lock on</b> to that fruit. Finish it to slice it! (Backspace lets go.)',
      'Slice fruit quickly one after another for a <b>Fruit Combo</b>.',
      'The <b>golden orange</b> starts a Fruit Frenzy!',
      'Normal and Turbo: if 3 fruit fall, the game ends. Gentle: no lives, just 90 seconds of slicing.',
    ],
    music, reset, update, draw, onKey, onBack,
    nextKey: () => { const t = S.lock.locked || S.fruits.filter((f) => f.alive).sort((a, b) => b.danger - a.danger)[0]; return t ? t.typer.nextReq() : null; },
    hud: (g) => g.diff === 'gentle'
      ? { right: `${Math.ceil(S.timeLeft)}s`, progress: S.timeLeft / GENTLE_TIME }
      : { lives: S.lives, maxLives: 3, right: `${S.sliced} sliced` },
  });
})();
