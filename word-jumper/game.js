/* Word Jumper - Pip the frog hops along a trail. Type the word on each obstacle before it arrives. */
(function () {
  'use strict';
  const TM = window.TM, C = TM.C, U = TM.U, D = TM.draw, P = D.P, A = TM.art;
  const W = 1920, H = 1080, GY = 860, PIPX = 430;

  const LANDS = [
    { name: 'Meadow', sky: ['#7FD3FF', '#DDF5FF'], far: '#A8DE9C', mid: '#7ACB68', ground: '#6CCB3C', dirt: '#B9824F', tree: '#3FA34D', obst: ['log', 'rock', 'bush'], sun: '#FFE066' },
    { name: 'Beach', sky: ['#5EC4FF', '#FFE6B0'], far: '#3FB0E6', mid: '#F5D488', ground: '#F2C76E', dirt: '#D69B4C', tree: '#2BB673', obst: ['ball', 'castle', 'shell'], sun: '#FFD23F' },
    { name: 'Snowland', sky: ['#9EC0F2', '#F0F5FF'], far: '#D5E2F7', mid: '#FFFFFF', ground: '#F4F8FF', dirt: '#9BB2D6', tree: '#5A8FD0', obst: ['snowball', 'snowman', 'ice'], sun: '#FFF6C8' },
    { name: 'Candy Land', sky: ['#FFADDA', '#FFEAF6'], far: '#F59ACB', mid: '#C189EE', ground: '#FF8FC8', dirt: '#9A5DBF', tree: '#FF5A8F', obst: ['gumball', 'donut', 'cake'], sun: '#FFF07A' },
  ];
  const PER_LEVEL = 8;

  const music = TM.audio.song({
    bpm: 124, roots: [36, 33, 29, 31],
    chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
    lead: [72, null, 76, null, 79, null, 76, null, 77, null, 76, null, 74, null, 72, null, 69, null, 72, null, 76, null, 72, null, 74, null, 72, null, 71, null, 67, null,
      69, null, 72, null, 77, null, 76, null, 74, null, 72, null, 74, null, 76, null, 79, null, 77, null, 76, null, 74, null, 71, null, 74, null, 72, null, null, null],
    wave: 'square',
  });

  let S; // run state

  function reset(g) {
    S = {
      pip: { y: GY, vy: 0, air: false, rot: 0, squash: 0, flip: false, hurt: 0, hopT: 0, big: false },
      obs: [], speed: 300 * g.speedMul(), level: 1, done: 0, spawned: 0, hearts: 3, maxHearts: 3,
      scroll: 0, done: 0, flag: null, banner: null, missed: new Set(), bot: new TM.Bot(7), landFade: 0,
    };
    S.banner = { text: 'Level 1', sub: LANDS[0].name, t: 0 };
    ensureObstacles(g);
  }
  const land = () => LANDS[Math.floor((S.level - 1) / 4) % LANDS.length];

  function allowTime(g, item) {
    const per = g.diff === 'gentle' ? 0.75 : g.diff === 'turbo' ? 0.33 : 0.5;
    const lvl = Math.max(0.7, 1 - (S.level - 1) * 0.04);
    return (1.3 + item.len * per) * lvl;
  }
  function ensureObstacles(g) {
    while (S.spawned < PER_LEVEL && S.obs.filter((o) => !o.gone).length < 3) {
      const lad = g.ladder((S.level - 1) / 6);
      const sentence = lad.kind === 'sentence' && S.spawned % 3 === 2;
      const item = g.dealer.next(sentence ? { kind: 'sentence', maxWords: 7 } : { kind: 'word', maxLen: lad.maxLen });
      const prev = S.obs[S.obs.length - 1];
      const startX = prev ? Math.max(prev.x + 380, prev.x + S.speed * allowTime(g, item)) : W + 200;
      const kinds = land().obst;
      S.obs.push({ x: Math.max(startX, PIPX + S.speed * allowTime(g, item) + 200), kind: sentence ? 'big' : U.pick(kinds), typer: new TM.Typer(item), cleared: false, passed: false, bumped: false, gone: false, vy: 0, vx: 0, y: 0, rot: 0, seed: Math.random() * 10, happy: 0, flipBonus: false });
      S.spawned++;
    }
    if (S.spawned >= PER_LEVEL && !S.flag) {
      const last = S.obs[S.obs.length - 1];
      S.flag = { x: (last ? last.x : W) + 520, passed: false };
    }
  }
  function target() { return S.obs.find((o) => !o.cleared && !o.bumped && !o.gone); }

  function jump(big) {
    const p = S.pip; if (p.air) return;
    p.air = true; p.vy = big ? -1500 : -1250; p.squash = -0.6; TM.sfx.jump();
  }

  function onKey(g, k) {
    const t = target(); if (!t) return;
    const r = t.typer.feed(k);
    g.keyResult(r);
    if (r === 'done') clearObstacle(g, t);
  }
  function clearObstacle(g, o) {
    o.cleared = true; S.done++;
    const dist = o.x - PIPX;
    o.flipBonus = dist > S.speed * 1.6;
    g.wordDone(o.typer, Math.min(o.x, W - 160), GY - 260, { bonus: o.flipBonus ? 1.5 : 1 });
    if (o.flipBonus && !g.demo) g.fx.pop(Math.min(o.x, W - 160), GY - 360, 'Speedy!', { color: C.jumper, size: 44 });
  }

  function update(g, dt) {
    const p = S.pip, L = land();
    if (S.banner) { S.banner.t += dt; if (S.banner.t > 2.2) S.banner = null; }
    const moving = g.state === 'play' || g.state === 'title' || g.state === 'over';
    const sp = moving && g.state !== 'over' ? S.speed : S.speed * 0.3;
    if (g.state === 'countdown') return animPip(dt, 0);
    S.scroll += sp * dt;
    for (const o of S.obs) {
      if (o.bumped) { o.vy += 2400 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += dt * 8; if (o.y > 600) o.gone = true; continue; }
      o.x -= sp * dt;
      if (o.cleared) o.happy = Math.min(1, o.happy + dt * 4);
      // Pip jumps over cleared obstacles at the right moment
      if (o.cleared && !o.passed && o.x - PIPX < S.speed * 0.42 + 70 && o.x > PIPX - 20) { jump(o.kind === 'big'); p.flip = o.flipBonus; o.passed = true; }
      if (!o.cleared && !o.bumped && o.x - PIPX < 70) bump(g, o);
      if (o.x < -300) o.gone = true;
    }
    if (S.obs.length > 12) S.obs = S.obs.filter((o) => !o.gone);
    // demo bot
    if (g.demo) { const t = target(); if (t && t.x - PIPX < S.speed * 2.2) S.bot.step(dt, t.typer, (r) => { if (r === 'done') clearObstacle(g, t); }); }
    // flag / level end
    if (S.flag) {
      S.flag.x -= sp * dt;
      if (!S.flag.passed && S.flag.x < PIPX) { S.flag.passed = true; levelUp(g); }
    }
    animPip(dt, sp);
    if (g.state === 'play' || g.demo) ensureObstacles(g);
    for (const o of S.obs) if (o.typer.shake > 0) o.typer.shake = Math.max(0, o.typer.shake - dt * 3);
  }
  function animPip(dt, sp) {
    const p = S.pip;
    p.hurt = Math.max(0, p.hurt - dt);
    if (p.air) {
      p.vy += 3600 * dt; p.y += p.vy * dt;
      if (p.flip) p.rot += dt * 11;
      if (p.y >= GY) { p.y = GY; p.air = false; p.vy = 0; p.rot = 0; p.flip = false; p.squash = 0.6; TM.sfx.land(); }
    } else if (sp > 0) {
      p.hopT += dt * (sp / 300) * 2.6;
      p.y = GY - Math.abs(Math.sin(p.hopT * Math.PI)) * 22;
    }
    p.squash *= Math.pow(0.0001, dt);
  }
  function bump(g, o) {
    o.bumped = true; o.vx = 500; o.vy = -900; S.done++;
    S.pip.hurt = 0.9; TM.sfx.hurt(); g.fx.shake(18, 0.2); g.fx.stars(PIPX + 40, GY - 90, 6);
    S.missed.add(o.typer.item.t);
    g.missWord(o.typer.item);
    if (!g.demo && g.diff !== 'gentle') {
      S.hearts--;
      if (S.hearts <= 0) {
        g.end({ win: false, title: 'Ouch!', sub: `You reached level ${S.level} in ${land().name}.`, targetMet: S.level >= 5, stats: [['Level', S.level]] });
      }
    }
  }
  function levelUp(g) {
    if (g.state !== 'play' && !g.demo) return;
    g.fx.confetti(PIPX + 100, GY - 300, 50); TM.sfx.win();
    if (!g.demo) g.score.add(100 * S.level);
    if (g.diff === 'gentle' && S.level >= 5 && !g.demo) {
      g.end({ win: true, title: 'You did it!', sub: 'You finished all 5 levels!', targetMet: true, stats: [['Level', 5]] });
      return;
    }
    S.level++; S.spawned = 0; S.done = 0; S.flag = null; S.speed *= 1.07;
    if (S.level % 4 === 1) S.landFade = 1;
    S.banner = { text: `Level ${S.level}`, sub: land().name, t: 0 };
  }

  /* ---------- drawing ---------- */
  function drawBG(g, ctx) {
    const L = land(), v = g.vw();
    const grd = ctx.createLinearGradient(0, 0, 0, GY);
    grd.addColorStop(0, L.sky[0]); grd.addColorStop(1, L.sky[1]);
    ctx.fillStyle = grd; ctx.fillRect(v.x, v.y, v.w, GY - v.y + 10);
    // sun
    ctx.save(); ctx.fillStyle = U.hexA(L.sun, 0.35); ctx.beginPath(); ctx.arc(1550, 200, 130, 0, 7); ctx.fill();
    D.sticker(ctx, P.circle(1550, 200, 85), L.sun, { x: 1465, y: 115, w: 170, h: 170 }, { shadow: false }); ctx.restore();
    // clouds
    for (let i = 0; i < 6; i++) {
      const x = ((i * 420 - S.scroll * 0.08) % 2520 + 2520) % 2520 - 300;
      D.cloud(ctx, x, 130 + (i % 3) * 70, 90 + (i % 2) * 40, '#fff', 0.9);
    }
    D.hills(ctx, 560, 60, 260, L.far, S.scroll * 0.2, W, H);
    // mid hills with trees
    D.hills(ctx, 700, 45, 180, L.mid, S.scroll * 0.45, W, H);
    for (let i = 0; i < 9; i++) {
      const x = ((i * 300 - S.scroll * 0.45) % 2700 + 2700) % 2700 - 300;
      const y = 700 + Math.sin((x + S.scroll * 0.45) / 180) * 45 + Math.sin((x + S.scroll * 0.45) / 77.4) * 16;
      tree(ctx, x, y, L, i);
    }
    // ground
    ctx.fillStyle = L.dirt; ctx.fillRect(v.x, GY + 40, v.w, H - GY + 200);
    ctx.fillStyle = U.shade(L.dirt, -0.12);
    for (let i = 0; i < 14; i++) { const x = ((i * 160 - S.scroll) % 2240 + 2240) % 2240 - 160; ctx.fill(P.rr(x, GY + 90 + (i % 3) * 40, 70, 16, 8)); }
    ctx.fillStyle = L.ground; ctx.fillRect(v.x, GY + 18, v.w, 42);
    ctx.fillStyle = U.shade(L.ground, 0.25); ctx.fillRect(v.x, GY + 18, v.w, 10);
    ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.moveTo(v.x, GY + 18); ctx.lineTo(v.x + v.w, GY + 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(v.x, GY + 60); ctx.lineTo(v.x + v.w, GY + 60); ctx.stroke();
  }
  function tree(ctx, x, y, L, i) {
    if (L.name === 'Beach') { // palm
      ctx.strokeStyle = '#A0703F'; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.quadraticCurveTo(x + 20, y - 60, x + 10, y - 120); ctx.stroke();
      ctx.fillStyle = L.tree; for (let a = 0; a < 5; a++) { ctx.beginPath(); ctx.ellipse(x + 10 + Math.cos(a * 1.25 - 1.6) * 40, y - 125 + Math.sin(a * 1.25 - 1.6) * 18, 46, 14, a * 1.25 - 1.6, 0, 7); ctx.fill(); }
      return;
    }
    if (L.name === 'Candy Land') { // lollipop
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, y - 90, 10, 100);
      ctx.fillStyle = i % 2 ? '#FFC83D' : L.tree; ctx.beginPath(); ctx.arc(x, y - 110, 42, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x, y - 110, 22, 0, 5); ctx.stroke();
      return;
    }
    ctx.fillStyle = '#8A5A3B'; ctx.fillRect(x - 8, y - 70, 16, 80);
    ctx.fillStyle = L.tree;
    if (L.name === 'Snowland') { ctx.beginPath(); ctx.moveTo(x - 55, y - 40); ctx.lineTo(x, y - 170); ctx.lineTo(x + 55, y - 40); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - 25, y - 120); ctx.lineTo(x, y - 170); ctx.lineTo(x + 25, y - 120); ctx.fill(); }
    else { for (const [dx, dy, r] of [[0, -100, 50], [-34, -70, 34], [34, -70, 34]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, 7); ctx.fill(); } }
  }

  function obstacleH(o) { return o.kind === 'big' ? 150 : o.kind === 'snowman' || o.kind === 'castle' || o.kind === 'cake' ? 140 : 105; }
  function drawObstacle(g, ctx, o) {
    const L = land();
    ctx.save(); ctx.translate(o.x, GY + 22 + o.y); ctx.rotate(o.rot);
    const mood = o.cleared ? 'happy' : o.bumped ? 'dizzy' : 'grumpy';
    const face = (cx, cy, s) => { D.eyes(ctx, cx, cy, s, mood, -0.6, 0, 1.4); D.mouth(ctx, cx, cy + s * 1.6, s * 1.1, o.cleared ? 'smile' : 'frown'); };
    switch (o.kind) {
      case 'big': {
        D.sticker(ctx, P.rr(-120, -150, 240, 150, 40), '#A8703F', { x: -120, y: -150, w: 240, h: 150 });
        ctx.fillStyle = '#D6A267'; ctx.beginPath(); ctx.ellipse(120, -75, 30, 72, 0, 0, 7); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.stroke();
        ctx.strokeStyle = 'rgba(31,26,61,0.3)'; ctx.beginPath(); ctx.ellipse(120, -75, 14, 36, 0, 0, 7); ctx.stroke();
        face(-10, -85, 15); break;
      }
      case 'log': D.sticker(ctx, P.rr(-70, -100, 140, 100, 34), '#B07A45', { x: -70, y: -100, w: 140, h: 100 }); ctx.fillStyle = '#E0AE72'; ctx.beginPath(); ctx.ellipse(70, -50, 20, 48, 0, 0, 7); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.stroke(); face(-10, -58, 11); break;
      case 'rock': D.sticker(ctx, P.blob(0, -50, 62, o.seed, 0.1), '#A7A3B8', { x: -62, y: -112, w: 124, h: 124 }); face(0, -55, 11); break;
      case 'bush': D.sticker(ctx, P.blob(0, -52, 64, o.seed, 0.16, 11), '#3FA34D', { x: -64, y: -116, w: 128, h: 128 }); ctx.fillStyle = '#FF5A5F'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 1.7) * 38, -52 + Math.sin(i * 1.7) * 30, 8, 0, 7); ctx.fill(); } face(0, -50, 11); break;
      case 'ball': { const b = P.circle(0, -60, 60); D.sticker(ctx, b, '#fff', { x: -60, y: -120, w: 120, h: 120 }); ctx.save(); ctx.clip(b); ctx.fillStyle = '#FF5A5F'; ctx.fillRect(-60, -120, 40, 120); ctx.fillStyle = '#2F9BFF'; ctx.fillRect(20, -120, 40, 120); ctx.restore(); ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.stroke(b); face(0, -60, 11); break; }
      case 'castle': D.sticker(ctx, P.poly([[-70, 0], [-70, -110], [-48, -110], [-48, -90], [-24, -90], [-24, -140], [24, -140], [24, -90], [48, -90], [48, -110], [70, -110], [70, 0]]), '#F2C76E', { x: -70, y: -140, w: 140, h: 140 }); face(0, -60, 11); break;
      case 'shell': D.sticker(ctx, P.poly([[-70, 0], [-60, -60], [0, -100], [60, -60], [70, 0]], true), '#FFA38F', { x: -70, y: -100, w: 140, h: 100 }); face(0, -45, 11); break;
      case 'snowball': D.sticker(ctx, P.circle(0, -58, 58), '#fff', { x: -58, y: -116, w: 116, h: 116 }); face(0, -58, 11); break;
      case 'snowman': D.sticker(ctx, P.circle(0, -45, 48), '#fff', { x: -48, y: -93, w: 96, h: 96 }); D.sticker(ctx, P.circle(0, -115, 34), '#fff', { x: -34, y: -149, w: 68, h: 68 }, { shadow: false }); ctx.fillStyle = '#FF7A1A'; ctx.beginPath(); ctx.moveTo(-6, -110); ctx.lineTo(-34, -104); ctx.lineTo(-6, -100); ctx.fill(); D.eyes(ctx, 0, -124, 8, mood, -0.6, 0, 1.4); break;
      case 'ice': D.sticker(ctx, P.rr(-60, -110, 120, 110, 18), '#BFE6FF', { x: -60, y: -110, w: 120, h: 110 }); face(0, -55, 11); break;
      case 'gumball': D.sticker(ctx, P.circle(0, -60, 60), U.pick ? ['#FF5A5F', '#2F9BFF', '#FFC83D'][Math.floor(o.seed) % 3] : '#FF5A5F', { x: -60, y: -120, w: 120, h: 120 }); face(0, -60, 11); break;
      case 'donut': { D.sticker(ctx, P.ellipse(0, -55, 75, 55), '#E0A060', { x: -75, y: -110, w: 150, h: 110 }); ctx.fillStyle = '#FF8FC8'; ctx.fill(P.blob(0, -62, 58, o.seed, 0.08, 10)); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke(P.blob(0, -62, 58, o.seed, 0.08, 10)); face(0, -60, 11); break; }
      case 'cake': D.sticker(ctx, P.rr(-62, -120, 124, 120, 20), '#FFE3F1', { x: -62, y: -120, w: 124, h: 120 }); ctx.fillStyle = '#FF5A8F'; ctx.fill(P.rr(-62, -120, 124, 30, 15)); ctx.fillStyle = '#FF5A5F'; ctx.beginPath(); ctx.arc(0, -134, 14, 0, 7); ctx.fill(); face(0, -60, 11); break;
    }
    ctx.restore();
  }

  function draw(g, ctx) {
    drawBG(g, ctx);
    // flag with Kip
    if (S.flag) {
      const fx = S.flag.x;
      ctx.fillStyle = C.ink; ctx.fillRect(fx - 4, GY - 260, 8, 280);
      const wave = Math.sin(g.t * 6) * 10;
      const flag = P.poly([[fx + 4, GY - 258], [fx + 140, GY - 230 + wave], [fx + 4, GY - 190]], true);
      D.sticker(ctx, flag, C.jumper, null, { shadow: false });
      A.kip(ctx, fx + 70, GY - 40, 0.9, { t: g.t, wave: true, accent: C.jumper });
    }
    const tgt = target();
    for (const o of S.obs) if (!o.gone) drawObstacle(g, ctx, o);
    // Pip
    const p = S.pip;
    A.frog(ctx, PIPX, p.y - 46, 1.15, { rot: p.rot, squash: p.squash, mood: p.hurt > 0 ? 'dizzy' : 'normal', mouth: p.hurt > 0 ? 'o' : p.air ? 'grin' : 'smile' });
    // chips (draw after so they sit on top). Next-up chip is dim; the current one is bold.
    const hint = (o) => g.hint || S.missed.has(o.typer.item.t);
    for (const o of S.obs) {
      if (o.gone || o.bumped || (o.cleared && o.happy >= 1)) continue;
      const isT = o === tgt;
      if (!isT && o !== S.obs.find((q) => !q.cleared && !q.bumped && !q.gone && q !== tgt)) continue;
      const size = o.typer.item.kind === 'sentence' ? 40 : 50;
      const sz = D.chipSize(ctx, o.typer, size);
      let cx = U.clamp(o.x, sz.w / 2 + 30, W - sz.w / 2 - 30);
      let cy = GY - obstacleH(o) - 80;
      if (!isT) { cy -= 150; }
      const alpha = o.cleared ? 1 - o.happy : 1;
      D.chip(ctx, cx, cy, o.typer, { size, accent: C.jumper, locked: isT && o.typer.pos > 0, alpha, dim: !isT, scale: isT ? 1 : 0.8, hint: isT && hint(o) });
      if (isT && o.x > W - 40) { // arrow showing it is still coming
        ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(W - 22, cy + 60); ctx.lineTo(W - 52, cy + 44); ctx.lineTo(W - 52, cy + 76); ctx.fill();
      }
    }
    g.fx.draw(ctx);
    if (S.banner && !g.demo) {
      const k = S.banner.t, a = k < 0.3 ? k / 0.3 : k > 1.8 ? 1 - (k - 1.8) / 0.4 : 1, s = k < 0.3 ? U.ease.outBack(k / 0.3) : 1;
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(W / 2, 360); ctx.scale(s, s);
      D.text(ctx, S.banner.text, 0, 0, { size: 130, color: C.jumper, outline: 18 });
      D.text(ctx, S.banner.sub, 0, 95, { size: 56, color: '#fff', outline: 12 });
      ctx.restore();
    }
  }

  TM.game({
    id: 'word-jumper', name: 'Word Jumper', accent: C.jumper, bg: '#7FD3FF',
    logoHTML: 'Word<br>Jumper', tagline: 'Hop Pip over every obstacle!',
    lifeIcon: TM.ui.heartSVG('#6CCB3C'),
    howto: [
      'Pip the frog runs along the trail by himself.',
      'Each obstacle has a <b>word</b> on it. Type the word before it reaches Pip and he hops over it.',
      'Type it early for a <b>Speedy!</b> flip and bonus points.',
      'If an obstacle bumps Pip he loses a heart. In <b>Gentle</b> mode there are no hearts to lose.',
      'Reach the flag to finish the level. The land changes every 4 levels!',
    ],
    music,
    reset, update, draw, onKey,
    nextKey: () => { const t = target(); return t ? t.typer.nextReq() : null; },
    hud: (g) => ({ lives: S.hearts, maxLives: g.diff === 'gentle' ? 0 : S.maxHearts, right: `Level ${S.level}`, progress: Math.min(1, S.done / PER_LEVEL) }),
  });
})();
