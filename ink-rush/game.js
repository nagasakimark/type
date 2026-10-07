/* Ink Rush - ride through grey Squeaky Town and splat the sleepy Gloops with colour ink.
   On-rails like The Typing of the Dead, but nobody gets hurt: splatted Gloops turn colourful and bounce away. */
(function () {
  'use strict';
  const TM = window.TM, C = TM.C, U = TM.U, D = TM.draw, P = D.P, A = TM.art;
  const W = 1920, H = 1080, HZ = 430, VX = W / 2;
  const INKS = [C.ink2, C.lime, '#2F9BFF', '#FFC83D'];
  const AREAS = [
    { name: 'Main Street', ground: '#B9B5C8', side: '#A5A1B8', b: ['#C9C5D8', '#BDB8CE', '#D3CFE0'], sky: ['#D9D6E6', '#F1EFF7'] },
    { name: 'Sunny Park', ground: '#B8C2B4', side: '#A9B4A4', b: ['#B7C4B0', '#C4CFBE', '#ADBBA6'], sky: ['#DCE3E6', '#F3F6F2'], trees: true },
    { name: 'School Yard', ground: '#C4B9AE', side: '#B4A99E', b: ['#D2C8BE', '#C8BDB2', '#DCD3CA'], sky: ['#E0DCE6', '#F5F2F7'] },
    { name: 'Big Stadium', ground: '#AEB7C6', side: '#9EA8B8', b: ['#BFC7D5', '#B3BCCC', '#C9D0DC'], sky: ['#D5DAE6', '#F0F2F7'] },
  ];
  const AMBUSHES = 3;

  const music = TM.audio.song({
    bpm: 140, roots: [38, 38, 43, 45],
    chords: [[62, 66, 69], [62, 66, 69], [67, 71, 74], [69, 73, 76]],
    bassPattern: [0, null, 12, 0, null, 12, 0, null, 0, 12, null, 0, 10, null, 12, null],
    lead: [74, 74, null, 78, null, 81, null, 78, 79, null, 78, null, 74, null, null, null, 76, 76, null, 79, null, 83, null, 81, 78, null, 76, null, 74, null, null, null],
    wave: 'square',
  });

  let S;
  function reset(g) {
    S = {
      area: 0, areasDone: 0, ambush: 0, phase: 'move', moveT: 0, roll: 0, gloops: [], toSpawn: 0, spawnT: 0, lock: new TM.LockOn(),
      lives: 3, slime: 0, shots: [], paint: 0, inkI: 0, t: 0, bot: new TM.Bot(8), banner: { t: 0, text: AREAS[0].name }, splatted: 0, hop: [],
    };
    g.fx.decals = [];
  }
  const area = () => AREAS[S.area % AREAS.length];

  /* depth z: 1 = far away, 0 = at the camera */
  const scaleAt = (z) => 0.28 + Math.pow(1 - z, 1.6) * 1.25;
  const yAt = (z) => HZ + Math.pow(1 - z, 1.5) * 560;
  const xAt = (lx, z) => VX + lx * scaleAt(z);

  function startAmbush(g) {
    S.phase = 'ambush'; S.ambush++;
    const boss = S.ambush > AMBUSHES;
    S.toSpawn = boss ? 1 : 3 + Math.min(4, S.area + S.ambush - 1);
    S.spawnT = 0.6; S.boss = boss;
  }
  function spawn(g) {
    const lad = g.ladder(Math.min(1, (S.areasDone + S.ambush / 4) / 4));
    const avoidFirst = S.lock.firstLetters(S.gloops);
    const used = S.gloops.filter((q) => q.alive).map((q) => q.lx);
    let lx = 0; for (let i = 0; i < 12; i++) { lx = U.pick([-560, -300, 0, 300, 560]) + U.rand(-50, 50); if (used.every((u) => Math.abs(u - lx) > 200)) break; }
    let items;
    if (S.boss) {
      items = lad.kind === 'sentence' && g.dealer.pool.sentences.length ? [g.dealer.next({ kind: 'sentence', maxWords: 7, avoidFirst })] : [0, 1, 2].map(() => g.dealer.next({ kind: 'word', minLen: 5, maxLen: 12 }));
      lx = 0;
    } else {
      const big = lad.kind === 'sentence' && Math.random() < 0.25;
      items = [big ? g.dealer.next({ kind: 'sentence', maxWords: 5, avoidFirst }) : g.dealer.next({ kind: 'word', maxLen: lad.maxLen, avoidFirst })];
    }
    const total = items.reduce((a, it) => a + it.len, 0);
    const per = g.diff === 'gentle' ? 0.75 : g.diff === 'turbo' ? 0.38 : 0.52;
    const time = (3 + total * per) * (S.boss ? 1.3 : 1);
    S.gloops.push({ lx, z: 1, speed: 1 / time, items, idx: 0, typer: new TM.Typer(items[0]), alive: true, boss: S.boss, seed: Math.random() * 9, spots: [], danger: 0, happy: 0, color: '#9C98AE' });
  }

  function onKey(g, k) {
    const { target, result } = S.lock.feed(k, S.gloops);
    g.keyResult(result);
    if (target && result !== 'miss') shoot(g, target, result === 'done');
  }
  function onBack() { S.lock.release(); }
  function shoot(g, q, final) {
    const ink = INKS[S.inkI++ % 2];
    S.shots.push({ q, t: 0, ink, final, ox: VX + 360, oy: H - 120 });
    TM.sfx.pop();
  }
  function hitGloop(g, q, ink, final) {
    const s = scaleAt(q.z) * (q.boss ? 2 : 1);
    q.spots.push({ x: U.rand(-40, 40), y: U.rand(-50, 20), r: U.rand(10, 18), ink });
    if (q.spots.length > 14) q.spots.shift();
    q.z = Math.min(1, q.z + 0.012);
    if (!final || !q.typer.done) return;
    const sx = xAt(q.lx, q.z), sy = yAt(q.z) - 60 * s;
    const c1 = S.splatted % 2 ? C.ink2 : C.lime, c2 = S.splatted % 2 ? C.lime : C.ink2;
    g.fx.splat(sx + U.rand(-60, 60), yAt(q.z) + U.rand(-10, 30), U.hexA(c1, 0.9), 70 * s + 30, true);
    g.fx.splat(sx < VX ? sx - 200 * s : sx + 200 * s, sy - U.rand(40, 160) * s, U.hexA(c2, 0.9), 50 * s + 20, true);
    TM.sfx.splat(); g.fx.shake(q.boss ? 16 : 8, 0.12);
    g.wordDone(q.typer, sx, sy - 80 * s, { bonus: q.boss ? 2 : 1, color: ink });
    S.paint = Math.min(1, S.paint + (q.boss ? 0.25 : 0.06));
    q.idx++;
    if (q.idx < q.items.length) { q.typer = new TM.Typer(q.items[q.idx]); q.z = Math.min(1, q.z + 0.15); return; }
    q.alive = false; if (!g.demo) S.splatted++;
    S.hop.push({ lx: q.lx, z: q.z, t: 0, color: ink, boss: q.boss, dir: q.lx < 0 ? -1 : 1, seed: q.seed });
  }

  function update(g, dt) {
    S.t += dt; S.banner.t += dt;
    S.slime = Math.max(0, S.slime - dt * 0.8);
    if (g.state === 'countdown') return;
    const live = g.live || g.demo;
    if (S.phase === 'move') {
      S.moveT += dt; S.roll += dt * 1.2;
      if (S.moveT > 0) { // paint slides past as we ride forward
        const k = 1 + dt * 0.9;
        for (const d of g.fx.decals) { d.x = VX + (d.x - VX) * k; d.y = HZ + (d.y - HZ) * k; d.r *= k; }
        g.fx.decals = g.fx.decals.filter((d) => d.y - d.r < H + 200 && Math.abs(d.x - VX) - d.r < W);
      }
      if (S.moveT > 2.2) { S.moveT = 0; startAmbush(g); }
    } else if (live) {
      if (S.toSpawn > 0) { S.spawnT -= dt; if (S.spawnT <= 0) { spawn(g); S.toSpawn--; S.spawnT = U.rand(1.0, 2.0) * (g.diff === 'gentle' ? 1.4 : 1); } }
      for (const q of S.gloops) {
        if (!q.alive) continue;
        q.z -= q.speed * dt * (g.demo ? 0.7 : 1);
        q.danger = 1 - q.z;
        if (q.typer.shake > 0) q.typer.shake = Math.max(0, q.typer.shake - dt * 3);
        if (q.z <= 0) slimed(g, q);
      }
      S.gloops = S.gloops.filter((q) => q.alive);
      if (S.toSpawn === 0 && S.gloops.length === 0 && S.shots.length === 0) {
        if (S.boss) areaClear(g); else { S.phase = 'move'; S.moveT = 0.8; }
      }
    }
    for (const s of S.shots) { s.t += dt * 6; if (s.t >= 1 && !s.done) { s.done = true; if (s.q.alive) hitGloop(g, s.q, s.ink, s.final); } }
    S.shots = S.shots.filter((s) => !s.done);
    for (const h of S.hop) h.t += dt;
    S.hop = S.hop.filter((h) => h.t < 1.4);
    if (g.demo) {
      const t = S.lock.locked || S.gloops.filter((q) => q.alive && q.z < 0.85).sort((a, b) => b.danger - a.danger)[0];
      if (t) S.bot.step(dt, t.typer, (r) => { if (!S.lock.locked && r !== 'done') { S.lock.locked = t; t.locked = true; } if (r === 'done') S.lock.release(); shoot(g, t, r === 'done'); });
    }
  }
  function slimed(g, q) {
    q.alive = false; if (q.locked) S.lock.release();
    S.slime = 1; TM.sfx.splat(); g.fx.shake(20, 0.3);
    if (g.demo || g.state !== 'play') return;
    g.missWord(q.typer.item);
    if (g.diff === 'gentle') return;
    S.lives--;
    if (S.lives <= 0) g.end({ win: false, title: 'Goggles full of goo!', sub: `You painted ${S.areasDone} area${S.areasDone === 1 ? '' : 's'} of Squeaky Town.`, targetMet: S.areasDone >= 3, stats: [['Areas painted', S.areasDone], ['Gloops splatted', S.splatted]] });
  }
  function areaClear(g) {
    if (!g.demo) { g.score.add(Math.round(300 * S.paint) + 100); g.fx.confetti(VX, 400, 80); TM.sfx.win(); g.fx.pop(VX, 360, `${area().name} painted!`, { size: 80, color: C.ink2, life: 1.8 }); }
    S.areasDone++;
    if (g.diff === 'gentle' && S.areasDone >= 4 && !g.demo) { g.end({ win: true, title: 'Squeaky Town is colourful!', sub: 'You painted all 4 areas!', targetMet: true, stats: [['Areas painted', 4], ['Gloops splatted', S.splatted]] }); return; }
    S.area++; S.ambush = 0; S.paint = 0; S.phase = 'move'; S.moveT = -0.8;
    S.banner = { t: -0.8, text: area().name };
  }

  /* ---------- drawing ---------- */
  function drawScene(g, ctx) {
    const v = g.vw(), A_ = area();
    const grd = ctx.createLinearGradient(0, v.y, 0, HZ);
    grd.addColorStop(0, A_.sky[0]); grd.addColorStop(1, A_.sky[1]);
    ctx.fillStyle = grd; ctx.fillRect(v.x, v.y, v.w, HZ - v.y + 2);
    // a grey sun with a sleepy face (it wakes up as you paint)
    D.sticker(ctx, P.circle(1500, 170, 70), S.paint > 0.5 ? '#FFE066' : '#E3E0EC', { x: 1430, y: 100, w: 140, h: 140 });
    D.eyes(ctx, 1500, 165, 8, S.paint > 0.5 ? 'happy' : 'sleepy', 0, 0, 1.8);
    // ground
    ctx.fillStyle = A_.ground; ctx.fillRect(v.x, HZ, v.w, v.y + v.h - HZ);
    // road
    ctx.fillStyle = A_.side;
    ctx.beginPath(); ctx.moveTo(VX - 70, HZ); ctx.lineTo(VX + 70, HZ); ctx.lineTo(VX + 1100, H + 40); ctx.lineTo(VX - 1100, H + 40); ctx.closePath(); ctx.fill();
    // moving stripes
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 8; i++) {
      const d = ((i / 8 + S.roll * 0.35) % 1); const z0 = 1 - d, z1 = Math.max(0, z0 - 0.05);
      const y0 = yAt(z0), y1 = yAt(z1), w0 = 8 * scaleAt(z0), w1 = 8 * scaleAt(z1);
      ctx.beginPath(); ctx.moveTo(VX - w0, y0); ctx.lineTo(VX + w0, y0); ctx.lineTo(VX + w1, y1); ctx.lineTo(VX - w1, y1); ctx.fill();
    }
    // buildings / trees on both sides, far to near
    const items = [];
    for (let i = 0; i < 7; i++) { const d = ((i / 7 + S.roll * 0.35) % 1); items.push({ z: 1 - d, i }); }
    items.sort((a, b) => b.z - a.z);
    for (const it of items) for (const side of [-1, 1]) {
      const s = scaleAt(it.z), y = yAt(it.z);
      const x = VX + side * (180 + 820 * Math.pow(1 - it.z, 1.6)) * (0.6 + s * 0.4);
      const bw = 230 * s, bh = (260 + ((it.i * 53) % 140)) * s;
      const col = A_.b[(it.i + (side > 0 ? 1 : 0)) % A_.b.length];
      ctx.globalAlpha = U.clamp((1 - it.z) * 3, 0, 1);
      if (A_.trees && it.i % 2) {
        ctx.fillStyle = '#8F8A7A'; ctx.fillRect(x - 10 * s, y - 120 * s, 20 * s, 120 * s);
        D.sticker(ctx, P.blob(x, y - 170 * s, 90 * s, it.i, 0.12, 9), col, { x: x - 90 * s, y: y - 260 * s, w: 180 * s, h: 180 * s }, { lw: Math.max(2, 5 * s) });
      } else {
        const bx = side < 0 ? x - bw : x;
        D.sticker(ctx, P.rr(bx, y - bh, bw, bh, 10 * s), col, { x: bx, y: y - bh, w: bw, h: bh }, { lw: Math.max(2, 5 * s), highlight: false });
        ctx.fillStyle = 'rgba(31,26,61,0.15)';
        for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) ctx.fill(P.rr(bx + bw * (0.18 + c * 0.42), y - bh + bh * (0.15 + r * 0.27), bw * 0.24, bh * 0.15, 4 * s));
      }
      ctx.globalAlpha = 1;
    }
    g.fx.drawDecals(ctx);
  }
  function drawGloop(g, ctx, q) {
    const s = scaleAt(q.z) * (q.boss ? 2 : 1);
    const x = xAt(q.lx, q.z), y = yAt(q.z);
    ctx.save(); ctx.fillStyle = 'rgba(31,26,61,0.18)'; ctx.beginPath(); ctx.ellipse(x, y, 70 * s, 16 * s, 0, 0, 7); ctx.fill(); ctx.restore();
    const hop = Math.abs(Math.sin(S.t * 5 + q.seed)) * 14 * s;
    A.gloop(ctx, x, y - 50 * s - hop, s, { t: S.t, seed: q.seed, mood: q.locked ? 'wide' : 'sleepy', mouth: q.locked ? 'o' : 'flat' });
    ctx.save(); ctx.translate(x, y - 50 * s - hop); ctx.scale(s, s);
    for (const sp of q.spots) { ctx.fillStyle = sp.ink; ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r, 0, 7); ctx.fill(); }
    if (q.boss) { D.sticker(ctx, P.poly([[-40, -62], [-30, -96], [-10, -74], [0, -104], [10, -74], [30, -96], [40, -62]]), C.gold, null, { shadow: false, lw: 4 }); }
    ctx.restore();
  }
  function draw(g, ctx) {
    drawScene(g, ctx);
    const list = S.gloops.filter((q) => q.alive).sort((a, b) => b.z - a.z);
    for (const q of list) drawGloop(g, ctx, q);
    for (const h of S.hop) { // splatted Gloops bounce away happy
      const k = h.t / 1.4, z = h.z + k * 0.3, s = scaleAt(z) * (h.boss ? 2 : 1);
      ctx.save(); ctx.globalAlpha = 1 - k;
      A.gloop(ctx, xAt(h.lx + h.dir * k * 700, z), yAt(z) - 50 * s - Math.abs(Math.sin(k * Math.PI * 3)) * 120 * s, s, { t: S.t, mood: 'happy', color: h.color, seed: h.seed });
      ctx.restore();
    }
    // ink shots
    for (const sh of S.shots) {
      const q = sh.q, s = scaleAt(q.z) * (q.boss ? 2 : 1);
      const tx = xAt(q.lx, q.z), ty = yAt(q.z) - 60 * s;
      const k = sh.t, x = U.lerp(sh.ox, tx, k), y = U.lerp(sh.oy, ty, k) - Math.sin(k * Math.PI) * 120;
      ctx.fillStyle = sh.ink; ctx.beginPath(); ctx.ellipse(x, y, 22 * (1 - k * 0.5), 18 * (1 - k * 0.5), 0, 0, 7); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke();
    }
    // chips (nearest on top)
    for (const q of list.slice().sort((a, b) => (a.locked ? 1 : 0) - (b.locked ? 1 : 0) || b.z - a.z)) {
      const s = scaleAt(q.z) * (q.boss ? 2 : 1);
      const size = U.clamp(30 + (1 - q.z) * 20, 32, 52);
      const sz = D.chipSize(ctx, q.typer, size);
      const cx = U.clamp(xAt(q.lx, q.z), sz.w / 2 + 20, W - sz.w / 2 - 20), cy = Math.max(110, yAt(q.z) - 50 * s - 110 * s - 30);
      D.chip(ctx, cx, cy, q.typer, { size, accent: C.ink2, locked: q.locked, hint: g.hint });
      if (q.items.length > 1) D.text(ctx, `${q.idx + 1} / ${q.items.length}`, cx, cy - sz.h / 2 - 22, { size: 26, color: '#fff', outline: 7 });
    }
    // ink blaster at the bottom
    ctx.save(); ctx.translate(VX + 380, H - 30);
    D.sticker(ctx, P.rr(-70, -170, 140, 200, 40), '#fff', { x: -70, y: -170, w: 140, h: 200 });
    ctx.fillStyle = INKS[S.inkI % 2]; ctx.fill(P.rr(-46, -120, 92, 120, 26)); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke(P.rr(-46, -120, 92, 120, 26));
    D.sticker(ctx, P.rr(-22, -230, 44, 80, 14), '#5B5670', null, { shadow: false });
    ctx.restore();
    g.fx.draw(ctx);
    // turf meter
    if (!g.demo) {
      D.pill(ctx, VX - 260, H - 70, 520, 40, 'rgba(31,26,61,0.75)');
      if (S.paint > 0) D.pill(ctx, VX - 254, H - 64, 508 * S.paint, 28, C.ink2);
      D.text(ctx, `Painted ${Math.round(S.paint * 100)}%`, VX, H - 50, { size: 26, color: '#fff' });
    }
    // slime on the goggles
    if (S.slime > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, S.slime * 1.3);
      ctx.fillStyle = '#8F8AA6';
      for (let i = 0; i < 7; i++) ctx.fill(P.blob(200 + i * 260, 120 + (i % 3) * 300, 260, i, 0.25, 10));
      D.text(ctx, 'SPLORT!', VX, H / 2, { size: 120, color: '#fff', outline: 16 });
      ctx.restore();
    }
    if (S.banner.t > 0 && S.banner.t < 2.2 && !g.demo) { const a = S.banner.t > 1.7 ? 1 - (S.banner.t - 1.7) / 0.5 : 1; ctx.save(); ctx.globalAlpha = a; D.text(ctx, S.banner.text, VX, 300, { size: 120, color: C.ink2, outline: 18 }); ctx.restore(); }
    if (S.phase === 'ambush' && S.boss && S.gloops.length && !g.demo) D.text(ctx, 'BIG GLOOP!', VX, 170, { size: 60, color: C.gold, outline: 12 });
  }

  TM.game({
    id: 'ink-rush', name: 'Ink Rush', accent: C.ink2, bg: '#D9D6E6',
    logoHTML: 'Ink<br>Rush', tagline: 'Splat the Gloops. Paint the town!',
    lifeIcon: TM.ui.heartSVG('#FF3EA5'),
    howto: [
      'Grey Gloops have drained the colour out of Squeaky Town. You ride through on an ink scooter.',
      'When Gloops waddle toward you, type the first letter of a word to <b>lock on</b>. Every correct letter fires ink.',
      'Finish the word to SPLAT the Gloop. It turns colourful and bounces away happy!',
      'The <b>Big Gloop</b> at the end of each area has several words or a sentence.',
      'If a Gloop reaches you, your goggles get gooey and you lose a life. Gentle mode has no lives to lose.',
    ],
    music, reset, update, draw, onKey, onBack,
    nextKey: () => { const t = S.lock.locked || S.gloops.filter((q) => q.alive).sort((a, b) => b.danger - a.danger)[0]; return t ? t.typer.nextReq() : null; },
    hud: (g) => ({ lives: S.lives, maxLives: g.diff === 'gentle' ? 0 : 3, right: area().name }),
  });
})();
