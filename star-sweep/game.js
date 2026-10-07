/* Star Sweep - sweep grumpy space junk before it reaches the station. Lock-on typing like ZType. */
(function () {
  'use strict';
  const TM = window.TM, C = TM.C, U = TM.U, D = TM.draw, P = D.P, A = TM.art;
  const W = 1920, H = 1080, SX = W / 2, SY = 1010, SHIPY = 880;
  const JUNK_COLORS = ['#B8B2CC', '#FFB3C7', '#9FD8FF', '#FFD98A', '#B6F0C2', '#D7B8FF'];

  const music = TM.audio.song({
    bpm: 112, roots: [33, 29, 36, 31],
    chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]],
    bassPattern: [0, null, null, 0, null, null, 12, null, 0, null, null, 0, null, 7, null, 10],
    lead: [76, null, null, 79, null, null, 81, null, 79, null, 76, null, 74, null, null, null, 72, null, null, 74, null, null, 76, null, 79, null, 76, null, 72, null, null, null],
    wave: 'sawtooth', pad: 'triangle',
  });

  let S;
  function reset(g) {
    S = {
      junk: [], shots: [], lock: new TM.LockOn(), wave: 1, toSpawn: 0, spawnT: 1.5, shields: 3, sweepReady: true, sweepFx: 0,
      waveBanner: { t: 0 }, shipRot: 0, stars: makeStars(), t: 0, bot: new TM.Bot(8), stationHit: 0, cleared: 0,
    };
    startWave(g, 1);
  }
  function makeStars() { const a = []; for (let i = 0; i < 160; i++) a.push({ x: Math.random() * W, y: Math.random() * H, z: 1 + (i % 3), tw: Math.random() * 6 }); return a; }
  const isBossWave = (n) => n % 4 === 0;
  function startWave(g, n) {
    S.wave = n; S.toSpawn = isBossWave(n) ? 1 : 5 + n * 2; S.spawnT = 2; S.sweepReady = true;
    S.waveBanner = { t: 0, text: isBossWave(n) ? 'BOSS WAVE!' : `Wave ${n}` };
  }

  function speedFor(g, item) {
    const base = (g.diff === 'gentle' ? 45 : g.diff === 'turbo' ? 82 : 62) * (1 + (S.wave - 1) * 0.06);
    return base * U.clamp(6 / Math.max(3, item.len), 0.45, 1.6);
  }
  function spawn(g, o = {}) {
    const lad = g.ladder((S.wave - 1) / 6);
    const avoidFirst = S.lock.firstLetters(S.junk);
    let item;
    if (o.boss) item = lad.kind === 'sentence' ? g.dealer.next({ kind: 'sentence', maxWords: 8, avoidFirst }) : g.dealer.next({ kind: 'word', minLen: 8, avoidFirst });
    else item = g.dealer.next({ kind: 'word', maxLen: o.small ? 5 : Math.min(10, lad.maxLen), avoidFirst });
    const x = o.x ?? U.rand(220, W - 220), y = o.y ?? -70;
    const r = o.boss ? 120 : U.clamp(30 + item.len * 4, 38, 78);
    const sp = o.boss ? speedFor(g, item) * 0.35 : speedFor(g, item);
    S.junk.push({ x, y, r, sp, kind: o.boss ? 'rock' : U.pick(['can', 'box', 'rock', 'rock']), color: o.boss ? '#8C84A8' : U.pick(JUNK_COLORS), rot: U.rand(0, 6), vr: U.rand(-0.6, 0.6), seed: Math.random() * 9, typer: new TM.Typer(item), alive: true, boss: !!o.boss, push: 0, flash: 0, dropT: 4, danger: 0 });
  }

  function onKey(g, k) {
    const { target, result } = S.lock.feed(k, S.junk);
    g.keyResult(result);
    if (target && result !== 'miss') fire(target, result === 'done');
  }
  function onBack() { S.lock.release(); }
  function onEnter(g) {
    if (!S.sweepReady) return;
    S.sweepReady = false; S.sweepFx = 1; TM.sfx.boost(); g.fx.doFlash('#C9B8FF', 0.6); g.fx.shake(16, 0.3);
    S.lock.release();
    for (const j of S.junk) if (j.alive && !j.boss) { j.alive = false; g.fx.stars(j.x, j.y, 6, '#fff'); }
  }
  function fire(t, final) {
    S.shots.push({ x: SX, y: SHIPY - 50, t: 0, target: t, final });
    TM.sfx.zap();
  }

  function update(g, dt) {
    S.t += dt;
    for (const s of S.stars) { s.y += s.z * 14 * dt; if (s.y > H) { s.y = -5; s.x = Math.random() * W; } }
    S.waveBanner.t += dt; S.sweepFx = Math.max(0, S.sweepFx - dt * 1.5); S.stationHit = Math.max(0, S.stationHit - dt * 2);
    if (g.state === 'countdown') return;
    const live = g.live || g.demo;
    if (live && S.toSpawn > 0) {
      S.spawnT -= dt;
      if (S.spawnT <= 0) {
        spawn(g, { boss: isBossWave(S.wave) });
        S.toSpawn--;
        S.spawnT = Math.max(0.9, 2.3 - S.wave * 0.15) * (g.diff === 'gentle' ? 1.5 : g.diff === 'turbo' ? 0.75 : 1);
      }
    }
    for (const j of S.junk) {
      if (!j.alive) continue;
      const dx = SX - j.x, dy = SY - j.y, d = Math.hypot(dx, dy);
      const sp = j.sp * (1 - j.push);
      j.x += (dx / d) * sp * dt; j.y += (dy / d) * sp * dt;
      j.push = Math.max(0, j.push - dt * 2); j.flash = Math.max(0, j.flash - dt * 4);
      j.rot += j.vr * dt; j.danger = j.y;
      if (j.typer.shake > 0) j.typer.shake = Math.max(0, j.typer.shake - dt * 3);
      if (j.boss && live && j.y > 120) { j.dropT -= dt; if (j.dropT <= 0) { j.dropT = 5; spawn(g, { small: true, x: j.x + U.rand(-80, 80), y: j.y + 60 }); } }
      if (d < 110) hitStation(g, j);
    }
    for (const s of S.shots) {
      s.t += dt * 7;
      if (s.t >= 1) {
        const j = s.target;
        if (j.alive) {
          j.push = 0.9; j.flash = 1; g.fx.burst(j.x, j.y + j.r * 0.6, { count: 5, color: '#FFE066', speed: [100, 300], gravity: 0, life: [0.2, 0.4], size: [6, 10] });
          if (s.final && j.typer.done) sweepJunk(g, j);
        }
        s.dead = true;
      }
    }
    S.shots = S.shots.filter((s) => !s.dead);
    S.junk = S.junk.filter((j) => j.alive);
    // ship aims at the locked junk
    const tgt = S.lock.locked || (S.shots.length ? S.shots[S.shots.length - 1].target : null);
    const want = tgt ? Math.atan2(tgt.x - SX, -(tgt.y - SHIPY)) : 0;
    S.shipRot += (want - S.shipRot) * Math.min(1, dt * 12);
    // next wave
    if (live && S.toSpawn === 0 && S.junk.length === 0) {
      if (g.diff === 'gentle' && S.wave >= 5 && !g.demo) { g.end({ win: true, title: 'Space is clean!', sub: 'You cleared all 5 waves!', targetMet: true, stats: [['Wave', 5]] }); return; }
      if (!g.demo) { g.score.add(50 * S.wave); g.fx.pop(W / 2, 420, `Wave clear! +${50 * S.wave}`, { color: C.sweep, size: 70 }); TM.sfx.win(); }
      startWave(g, S.wave + 1);
    }
    if (g.demo) {
      const t = S.lock.locked || S.junk.filter((j) => j.alive && j.y > 80).sort((a, b) => b.danger - a.danger)[0];
      if (t) S.bot.step(dt, t.typer, (r) => { if (!S.lock.locked && r !== 'done') { S.lock.locked = t; t.locked = true; } if (r === 'done') S.lock.release(); fire(t, r === 'done'); });
    }
  }
  function sweepJunk(g, j) {
    j.alive = false;
    g.fx.stars(j.x, j.y, j.boss ? 30 : 10); g.fx.burst(j.x, j.y, { count: j.boss ? 40 : 14, colors: ['#FFE066', '#fff', '#C9B8FF'], speed: [150, 500], gravity: 0, life: [0.4, 0.9] });
    TM.sfx.pop(); g.fx.shake(j.boss ? 20 : 6, 0.12);
    g.wordDone(j.typer, j.x, j.y - j.r, { bonus: j.boss ? 3 : 1, color: '#FFE066' });
    if (!g.demo) S.cleared++;
  }
  function hitStation(g, j) {
    j.alive = false; if (j.locked) S.lock.release();
    g.fx.burst(j.x, j.y, { count: 20, colors: [j.color, '#fff'], speed: [200, 600], gravity: 300 });
    S.stationHit = 1;
    if (g.demo || g.state !== 'play') return;
    g.missWord(j.typer.item); TM.sfx.hurt(); g.fx.shake(22, 0.3); g.fx.doFlash('#FF5A5F', 0.35);
    if (g.diff === 'gentle') return;
    S.shields--;
    if (S.shields <= 0) g.end({ win: false, title: 'Station full of junk!', sub: `You reached wave ${S.wave}.`, targetMet: S.wave >= 5, stats: [['Wave', S.wave]] });
  }

  function drawBG(g, ctx) {
    const v = g.vw();
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#140F33'); grd.addColorStop(1, '#3A2A78');
    ctx.fillStyle = grd; ctx.fillRect(v.x, v.y, v.w, v.h);
    // nebula
    ctx.save(); ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#FF3EA5'; ctx.fill(P.blob(380, 300, 260, 3, 0.25, 10, S.t * 0.1));
    ctx.fillStyle = '#2F9BFF'; ctx.fill(P.blob(1600, 520, 300, 7, 0.25, 10, -S.t * 0.1));
    ctx.restore();
    for (const s of S.stars) { ctx.globalAlpha = 0.35 + 0.25 * s.z + Math.sin(S.t * 3 + s.tw) * 0.15; ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.z + 1, s.z + 1); }
    ctx.globalAlpha = 1;
    // ringed planet
    ctx.save(); ctx.translate(1600, 220);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 16; ctx.beginPath(); ctx.ellipse(0, 0, 170, 40, -0.3, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#FFC83D'; ctx.lineWidth = 8; ctx.stroke();
    D.sticker(ctx, P.circle(0, 0, 100), '#FF8A5B', { x: -100, y: -100, w: 200, h: 200 });
    ctx.strokeStyle = C.ink; ctx.lineWidth = 16; ctx.beginPath(); ctx.ellipse(0, 0, 170, 40, -0.3, 0, Math.PI); ctx.stroke();
    ctx.strokeStyle = '#FFC83D'; ctx.lineWidth = 8; ctx.stroke();
    ctx.restore();
    D.sticker(ctx, P.circle(260, 160, 46), '#9FD8FF', { x: 214, y: 114, w: 92, h: 92 });
  }
  function drawStation(g, ctx) {
    const hit = S.stationHit;
    ctx.save(); ctx.translate(SX + (hit ? U.rand(-6, 6) : 0), SY + 60);
    D.sticker(ctx, P.ellipse(0, 0, 330, 120), hit ? '#FFB3B3' : '#E9E4F7', { x: -330, y: -120, w: 660, h: 240 });
    ctx.fillStyle = 'rgba(31,26,61,0.15)'; for (let i = -2; i <= 2; i++) ctx.fill(P.rr(i * 110 - 30, -70, 60, 34, 12));
    ctx.fillStyle = '#FFE066'; for (let i = -2; i <= 2; i++) { ctx.globalAlpha = 0.6 + Math.sin(S.t * 3 + i) * 0.3; ctx.fill(P.rr(i * 110 - 22, -64, 44, 22, 8)); }
    ctx.globalAlpha = 1;
    // shield dome
    if (S.shields > 0 && g.diff !== 'gentle') { ctx.strokeStyle = U.hexA('#9FD8FF', 0.25 + S.shields * 0.12); ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(0, -20, 400, 200, 0, Math.PI, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  function draw(g, ctx) {
    drawBG(g, ctx);
    drawStation(g, ctx);
    if (S.sweepFx > 0) { ctx.save(); ctx.globalAlpha = S.sweepFx; ctx.strokeStyle = '#C9B8FF'; ctx.lineWidth = 30 * S.sweepFx; ctx.beginPath(); ctx.arc(SX, SHIPY, (1 - S.sweepFx) * 1600, 0, 7); ctx.stroke(); ctx.restore(); }
    for (const j of S.junk) {
      if (j.boss) { ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = C.miss; ctx.beginPath(); ctx.arc(j.x, j.y, j.r * 1.25 + Math.sin(S.t * 6) * 6, 0, 7); ctx.fill(); ctx.restore(); }
      A.junk(ctx, j.x, j.y, j.r, { kind: j.kind, rot: j.rot, color: j.flash > 0 ? '#fff' : j.color, seed: j.seed, mood: j.locked ? 'wide' : 'grumpy' });
      if (j.boss) { ctx.fillStyle = C.gold; ctx.fill(P.star(j.x - 50, j.y - j.r + 10, 26, 0.45)); ctx.fill(P.star(j.x, j.y - j.r - 6, 30, 0.45)); ctx.fill(P.star(j.x + 50, j.y - j.r + 10, 26, 0.45)); }
    }
    // shots
    for (const s of S.shots) {
      const j = s.target, k = s.t;
      const x = U.lerp(s.x, j.x, k), y = U.lerp(s.y, j.y, k);
      ctx.save(); ctx.translate(x, y); ctx.rotate(S.t * 20);
      D.sticker(ctx, P.star(0, 0, 18, 0.45), '#FFE066', null, { shadow: false, lw: 3 }); ctx.restore();
    }
    A.ship(ctx, SX, SHIPY, 1.1, { t: S.t, rot: S.shipRot });
    // chips: locked one last so it sits on top
    const list = S.junk.slice().sort((a, b) => (a.locked ? 1 : 0) - (b.locked ? 1 : 0));
    for (const j of list) {
      const size = j.boss ? 42 : 40;
      const sz = D.chipSize(ctx, j.typer, size);
      D.chip(ctx, U.clamp(j.x, sz.w / 2 + 16, W - sz.w / 2 - 16), j.y + j.r + 40, j.typer, { size, accent: C.sweep, locked: j.locked, hint: g.hint });
    }
    g.fx.draw(ctx);
    const b = S.waveBanner;
    if (b.t < 2 && !g.demo) {
      const a = b.t < 0.3 ? b.t / 0.3 : b.t > 1.5 ? 1 - (b.t - 1.5) / 0.5 : 1;
      ctx.save(); ctx.globalAlpha = a; D.text(ctx, b.text, W / 2, 400, { size: 130, color: isBossWave(S.wave) ? C.miss : C.sweep, outline: 18 }); ctx.restore();
    }
    if (g.state === 'play') D.text(ctx, S.sweepReady ? 'Enter = Emergency Sweep' : 'Sweep used', W - 30, H - 40, { size: 30, color: S.sweepReady ? '#C9B8FF' : 'rgba(255,255,255,0.35)', align: 'right', outline: 8 });
  }

  TM.game({
    id: 'star-sweep', name: 'Star Sweep', accent: C.sweep, bg: '#140F33', dark: true,
    logoHTML: 'Star<br>Sweep', tagline: 'Clean up space, one word at a time!',
    lifeIcon: TM.ui.heartSVG('#7B5CFF'),
    howto: [
      'Grumpy space junk drifts toward the space station.',
      'Type the first letter of a word to <b>lock on</b>. Every correct letter fires a sparkle shot.',
      'Finish the word to turn the junk into stars. <b>Backspace</b> lets go of a lock.',
      'Every 4th wave a giant <b>Boss</b> arrives with a long word or a sentence.',
      'Press <b>Enter</b> once per wave for an Emergency Sweep that clears the screen.',
      'Junk that hits the station breaks a shield. Gentle mode has no shields to lose.',
    ],
    music, reset, update, draw, onKey, onBack, onEnter,
    nextKey: () => { const t = S.lock.locked || S.junk.filter((j) => j.alive).sort((a, b) => b.danger - a.danger)[0]; return t ? t.typer.nextReq() : null; },
    hud: (g) => ({ lives: S.shields, maxLives: g.diff === 'gentle' ? 0 : 3, right: `Wave ${S.wave}` }),
  });
})();
