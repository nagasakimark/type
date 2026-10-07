/* Rooftop Rascal - leap Rascal the raccoon across night rooftops before the sun comes up.
   Every action is a word: a roof (leap there), a sleepy pigeon (toss it a cracker), a snack (grab it). */
(function () {
  'use strict';
  const TM = window.TM, C = TM.C, U = TM.U, D = TM.draw, P = D.P, A = TM.art;
  const W = 1920, H = 1080, RX = 560;
  const BUILDING = ['#3A3566', '#46407A', '#33305C', '#4E3F7E', '#2F3F6E'];
  const SNACKS = ['dango', 'taiyaki', 'onigiri', 'dango', 'taiyaki'];
  const STEPS = 9;

  const music = TM.audio.song({
    bpm: 108, roots: [33, 38, 31, 36],
    chords: [[57, 60, 64, 67], [62, 65, 69], [55, 59, 62], [60, 64, 67]],
    bassPattern: [0, null, null, 7, null, null, 12, null, 0, null, 10, null, 7, null, null, null],
    lead: [69, null, 72, null, 76, null, 74, 72, null, null, 69, null, 67, null, null, null, 69, null, 72, null, 74, null, 76, 79, null, null, 76, null, 74, null, null, null],
    wave: 'triangle', pad: 'sine',
  });

  let S;
  function reset(g) {
    S = {
      roofs: [], cur: 0, rx: 0, ry: 0, anim: null, queue: [], lock: new TM.LockOn(), level: 1, lives: 3,
      dawn: -900, dawnSpeed: 0, camX: 0, t: 0, banner: { t: 0, text: 'Level 1' }, bot: new TM.Bot(7), outfit: 0,
      stars: Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * 600, s: Math.random() * 2 + 1, tw: Math.random() * 6 })),
      crackers: [], snacksGot: 0, botWait: 0,
    };
    buildLevel(g, 0, 640);
    S.rx = S.roofs[0].x + 120; S.ry = S.roofs[0].y; S.camX = S.rx - RX;
    S.dawn = S.rx - 1100;
  }
  function dawnSpeedFor(g) { return g.diff === 'gentle' ? 0 : (g.diff === 'turbo' ? 46 : 30) * (1 + (S.level - 1) * 0.12); }

  function buildLevel(g, startX, startY) {
    const roofs = S.roofs.length ? [S.roofs[S.roofs.length - 1]] : [{ x: startX, y: startY, w: 420, color: BUILDING[0], start: true, decor: 'tank' }];
    let x = roofs[0].x + roofs[0].w, y = roofs[0].y;
    for (let i = 0; i < STEPS; i++) {
      const last = i === STEPS - 1;
      const gap = last ? 340 : U.rand(150, 360);
      const w = last ? 520 : U.rand(240, 380);
      y = U.clamp(y + U.rand(-150, 150), 470, 760);
      roofs.push({ x: x + gap, y, w, gap, color: U.pick(BUILDING), decor: U.pick(['tank', 'antenna', 'none', 'sign', 'none']), line: gap > 300, goal: last });
      x += gap + w;
    }
    S.roofs = S.roofs.length ? S.roofs.concat(roofs.slice(1)) : roofs;
    // give each new roof its word, and some pigeons and snacks
    const stage = (S.level - 1) / 6;
    for (const r of S.roofs) {
      if (r.typer || r.start) continue;
      const lad = g.ladder(stage);
      let item;
      if (r.goal) item = lad.kind === 'sentence' || (S.level >= 2 && g.diff !== 'gentle' && g.dealer.pool.sentences.length) ? g.dealer.next({ kind: 'sentence', maxWords: 7 }) : g.dealer.next({ kind: 'word', minLen: 6 });
      else item = g.dealer.next({ kind: 'word', minLen: r.gap > 300 ? 5 : 2, maxLen: r.gap > 300 ? 14 : Math.min(8, lad.maxLen) });
      r.typer = new TM.Typer(item); r.alive = true;
      if (!r.goal && Math.random() < 0.35 + S.level * 0.04) r.pigeon = { typer: null, alive: true, fed: false, fly: 0, x: r.x + r.w * 0.55 };
      if (!r.goal && Math.random() < 0.3) r.snack = { typer: null, alive: true, got: false, kind: U.pick(SNACKS), y: r.y - 210 };
    }
  }

  /* Targets currently on offer: next roof (unless a pigeon blocks), pigeon on next roof, snack above next roof. */
  function nextRoof() { return S.roofs[S.cur + 1]; }
  function targets() {
    const r = nextRoof(); if (!r) return [];
    const out = [];
    const used = new Set(r.typer ? [r.typer.item.first] : []);
    const give = (obj, opts) => { if (!obj.typer) { obj.typer = new TM.Typer(TM.current.dealer.next(Object.assign({ kind: 'word', maxLen: 6, avoidFirst: used }, opts))); } used.add(obj.typer.item.first); };
    if (r.pigeon && r.pigeon.alive) { give(r.pigeon, {}); out.push(wrap(r.pigeon, 'pigeon', r)); }
    if (r.snack && r.snack.alive) { give(r.snack, {}); out.push(wrap(r.snack, 'snack', r)); }
    if (!(r.pigeon && r.pigeon.alive)) out.push(wrap(r, 'roof', r));
    return out;
  }
  const wrapCache = new WeakMap();
  function wrap(obj, kind, roof) {
    let w = wrapCache.get(obj);
    if (!w) { w = { obj, kind, roof, get typer() { return obj.typer; }, alive: true, danger: kind === 'roof' ? 1 : kind === 'pigeon' ? 2 : 0 }; wrapCache.set(obj, w); }
    w.alive = obj.alive !== false && !(kind === 'roof' && S.anim);
    return w;
  }
  function ensureUniqueFirsts() {
    // the roof word was dealt earlier; if it clashes with a pigeon/snack word, re-deal the small one
    const r = nextRoof(); if (!r) return;
    const roofFirst = r.typer && r.typer.item.first;
    for (const o of [r.pigeon, r.snack]) if (o && o.typer && o.typer.pos === 0 && o.typer.item.first === roofFirst) o.typer = new TM.Typer(TM.current.dealer.next({ kind: 'word', maxLen: 6, avoidFirst: new Set([roofFirst, (r.pigeon && r.pigeon.typer && r.pigeon !== o) ? r.pigeon.typer.item.first : '', (r.snack && r.snack.typer && r.snack !== o) ? r.snack.typer.item.first : '']) }));
  }

  function onKey(g, k) {
    const { target, result } = S.lock.feed(k, targets());
    g.keyResult(result);
    if (result === 'done') act(g, target);
  }
  function onBack() { S.lock.release(); }

  function act(g, t) {
    const o = t.obj;
    if (t.kind === 'pigeon') {
      o.alive = false; o.fed = true;
      S.crackers.push({ x0: S.rx + 30, y0: S.ry - 80, x1: o.x, y1: t.roof.y - 60, t: 0, pigeon: o });
      TM.sfx.pop();
      g.wordDone(o.typer, sx(o.x), t.roof.y - 140);
    } else if (t.kind === 'snack') {
      o.alive = false; o.got = true; o.flyT = 0;
      TM.sfx.word(); g.fx.stars(sx(t.roof.x + t.roof.w * 0.3), o.y, 8);
      g.wordDone(o.typer, sx(t.roof.x + t.roof.w * 0.3), o.y - 60, { bonus: 1.5 });
      if (!g.demo) { S.snacksGot++; if (o.kind === 'onigiri' && S.lives < 3 && g.diff !== 'gentle') { S.lives++; g.fx.pop(RX, 300, '+1 onigiri!', { color: C.good, size: 50 }); } }
    } else {
      o.alive = false;
      g.wordDone(o.typer, sx(t.roof.x + t.roof.w / 2), t.roof.y - 160, { bonus: t.roof.goal ? 2 : 1 });
      S.queue.push(t.roof);
    }
  }

  function update(g, dt) {
    S.t += dt; S.banner.t += dt;
    for (const s of S.stars) s.tw += dt;
    // leap animation
    if (!S.anim && S.queue.length) {
      const r = S.queue.shift();
      const from = { x: S.rx, y: S.ry }, to = { x: r.x + Math.min(110, r.w * 0.35), y: r.y };
      S.anim = { from, to, t: 0, dur: r.line ? 0.85 : 0.6, roof: r, swing: r.line };
      TM.sfx.jump();
    }
    if (S.anim) {
      const a = S.anim; a.t += dt / a.dur;
      const k = Math.min(1, a.t);
      S.rx = U.lerp(a.from.x, a.to.x, k);
      const arc = a.swing ? -Math.sin(k * Math.PI) * -80 : Math.sin(k * Math.PI) * 220;
      S.ry = U.lerp(a.from.y, a.to.y, k) - arc;
      if (a.t >= 1) {
        S.anim = null; S.rx = a.to.x; S.ry = a.to.y; S.cur = S.roofs.indexOf(a.roof); S.squash = 0.6; TM.sfx.land();
        g.fx.burst(sx(S.rx), S.ry, { count: 8, colors: ['#C9C6D6', '#fff'], speed: [80, 220], gravity: 300, life: [0.3, 0.5] });
        if (a.roof.goal) levelUp(g);
      }
    }
    S.squash = (S.squash || 0) * Math.pow(0.0005, dt);
    // crackers + pigeons flying away
    for (const c of S.crackers) { c.t += dt * 2.2; if (c.t >= 1 && !c.done) { c.done = true; c.pigeon.fly = 0.001; g.fx.burst(sx(c.x1), c.y1, { count: 6, color: '#E0B070', speed: [60, 200], gravity: 600 }); } }
    S.crackers = S.crackers.filter((c) => c.t < 1.2);
    for (const r of S.roofs) if (r.pigeon && r.pigeon.fly > 0) r.pigeon.fly += dt;
    for (const r of S.roofs) if (r.snack && r.snack.got) r.snack.flyT = (r.snack.flyT || 0) + dt;
    // dawn creeps in
    if (g.state === 'play') {
      S.dawn += dawnSpeedFor(g) * dt;
      if (S.dawn > S.rx - 40 && g.diff !== 'gentle') caught(g);
    } else if (g.demo) S.dawn = S.rx - 1100;
    // camera
    const want = S.rx - RX;
    S.camX += (want - S.camX) * Math.min(1, dt * 4);
    for (const r of S.roofs) { if (r.typer && r.typer.shake > 0) r.typer.shake = Math.max(0, r.typer.shake - dt * 3); for (const o of [r.pigeon, r.snack]) if (o && o.typer && o.typer.shake > 0) o.typer.shake = Math.max(0, o.typer.shake - dt * 3); }
    // demo bot
    if (g.demo) {
      S.botWait -= dt;
      const list = targets();
      const t = S.lock.locked || list.find((x) => x.kind === 'pigeon' && x.alive) || list.find((x) => x.kind === 'roof' && x.alive);
      if (t && t.alive && S.botWait <= 0 && !S.anim) S.bot.step(dt, t.typer, (r) => { if (!S.lock.locked && r !== 'done') { S.lock.locked = t; t.locked = true; } if (r === 'done') { S.lock.release(); act(g, t); S.botWait = 0.5; } });
    }
    // trim old roofs
    if (S.cur > 4) { S.roofs.splice(0, S.cur - 3); S.cur = 3; }
  }
  function caught(g) {
    S.lives--; S.dawn = S.rx - 700;
    TM.sfx.hurt(); g.fx.shake(18, 0.25); g.fx.doFlash('#FFD27A', 0.5);
    g.fx.pop(RX, 360, 'The sun is up! Hurry!', { color: '#FFC83D', size: 56, life: 1.4 });
    if (S.lives <= 0) g.end({ win: false, title: 'Good morning!', sub: `The sun caught Rascal on level ${S.level}.`, targetMet: S.level >= 5, stats: [['Level', S.level], ['Snacks', S.snacksGot]] });
  }
  function levelUp(g) {
    if (g.demo) { buildLevel(g); S.level++; return; }
    g.fx.confetti(RX + 200, S.ry - 300, 60); TM.sfx.win();
    g.score.add(150 * S.level);
    if (g.diff === 'gentle' && S.level >= 5) { g.end({ win: true, title: 'Home before sunrise!', sub: 'Rascal made it across all 5 levels!', targetMet: true, stats: [['Level', 5], ['Snacks', S.snacksGot]] }); return; }
    S.level++;
    if ((S.level - 1) % 4 === 0) S.outfit++;
    S.banner = { t: 0, text: `Level ${S.level}` };
    S.dawn = Math.min(S.dawn, S.rx - 900);
    buildLevel(g);
  }

  /* ---------- drawing ---------- */
  const sx = (wx) => wx - S.camX;
  function drawSky(g, ctx) {
    const v = g.vw();
    const light = U.clamp(1 - (S.rx - S.dawn) / 1100, 0, 1); // how close the dawn is
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, light > 0.5 ? '#3E4D9A' : '#1A2457'); grd.addColorStop(1, light > 0.5 ? '#C77DB5' : '#4B3F8F');
    ctx.fillStyle = grd; ctx.fillRect(v.x, v.y, v.w, v.h);
    for (const s of S.stars) { ctx.globalAlpha = (0.4 + Math.sin(s.tw * 2) * 0.3) * (1 - light * 0.7); ctx.fillStyle = '#fff'; ctx.fillRect(((s.x - S.camX * 0.05) % W + W) % W, s.y, s.s, s.s); }
    ctx.globalAlpha = 1;
    // moon with a sleepy face
    D.sticker(ctx, P.circle(1560, 190, 80), '#FFF3B0', { x: 1480, y: 110, w: 160, h: 160 });
    D.eyes(ctx, 1560, 180, 9, 'sleepy', 0, 0, 1.8);
    // far skyline
    ctx.fillStyle = '#2B2F66';
    for (let i = 0; i < 16; i++) { const bw = 120 + (i * 37) % 90, bh = 220 + (i * 71) % 200; const x = ((i * 170 - S.camX * 0.25) % 2720 + 2720) % 2720 - 200; ctx.fill(P.rr(x, 900 - bh, bw, bh + 300, 8)); }
    ctx.fillStyle = 'rgba(255,216,107,0.35)';
    for (let i = 0; i < 16; i++) { const x = ((i * 170 - S.camX * 0.25) % 2720 + 2720) % 2720 - 200; for (let j = 0; j < 3; j++) ctx.fillRect(x + 20 + j * 30, 900 - 180 + (i % 3) * 30, 12, 16); }
  }
  function drawRoof(g, ctx, r) {
    const x = sx(r.x);
    if (x > W + 200 || x + r.w < -200) return;
    if (r.line) { // laundry line across the gap
      const prev = S.roofs[S.roofs.indexOf(r) - 1];
      if (prev) {
        const x0 = sx(prev.x + prev.w) - 20, y0 = prev.y - 150, x1 = x + 20, y1 = r.y - 150;
        ctx.strokeStyle = C.ink; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x0, prev.y); ctx.lineTo(x0, y0); ctx.moveTo(x1, r.y); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + 70, x1, y1); ctx.stroke();
        const cols = ['#FF5A5F', '#2F9BFF', '#FFC83D', '#2BB673'];
        for (let i = 1; i < 5; i++) { const k = i / 5, lx = U.lerp(x0, x1, k), ly = U.lerp(y0, y1, k) + Math.sin(k * Math.PI) * 60; ctx.fillStyle = cols[i % 4]; ctx.fill(P.rr(lx - 18, ly, 36, 44, 6)); ctx.lineWidth = 3; ctx.stroke(P.rr(lx - 18, ly, 36, 44, 6)); }
      }
    }
    D.sticker(ctx, P.rr(x, r.y, r.w, H - r.y + 60, 10), r.color, { x, y: r.y, w: r.w, h: 300 }, { highlight: false });
    ctx.fillStyle = U.shade(r.color, 0.25); ctx.fill(P.rr(x - 12, r.y - 6, r.w + 24, 26, 10)); ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.stroke(P.rr(x - 12, r.y - 6, r.w + 24, 26, 10));
    for (let row = 0; row < 4; row++) for (let c = 0; c < Math.floor((r.w - 40) / 70); c++) {
      const lit = ((r.x | 0) + row * 7 + c * 13) % 5 > 1;
      ctx.fillStyle = lit ? '#FFD86B' : 'rgba(0,0,0,0.25)'; ctx.fill(P.rr(x + 34 + c * 70, r.y + 60 + row * 100, 36, 50, 6));
    }
    if (r.decor === 'tank') { D.sticker(ctx, P.rr(x + r.w - 120, r.y - 110, 80, 90, 14), '#8C84A8', { x: x + r.w - 120, y: r.y - 110, w: 80, h: 90 }); ctx.fillStyle = C.ink; ctx.fillRect(x + r.w - 110, r.y - 22, 8, 22); ctx.fillRect(x + r.w - 58, r.y - 22, 8, 22); }
    if (r.decor === 'antenna') { ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x + 60, r.y); ctx.lineTo(x + 60, r.y - 120); ctx.moveTo(x + 36, r.y - 100); ctx.lineTo(x + 84, r.y - 100); ctx.stroke(); ctx.fillStyle = C.miss; ctx.beginPath(); ctx.arc(x + 60, r.y - 124, 9, 0, 7); ctx.fill(); }
    if (r.decor === 'sign') { D.sticker(ctx, P.rr(x + 40, r.y - 90, 150, 70, 14), C.rascal, { x: x + 40, y: r.y - 90, w: 150, h: 70 }); D.text(ctx, 'RAMEN', x + 115, r.y - 54, { size: 34, color: '#fff' }); }
    if (r.goal) { // Kip waiting with a lantern
      A.kip(ctx, x + r.w - 110, r.y - 52, 0.9, { t: S.t, wave: true, accent: C.rascal });
      ctx.fillStyle = '#FF5A5F'; ctx.fill(P.ellipse(x + r.w - 190, r.y - 120, 26, 32)); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke(P.ellipse(x + r.w - 190, r.y - 120, 26, 32));
    }
    // pigeon
    const pg = r.pigeon;
    if (pg && !(pg.fly > 1.5)) {
      const px = sx(pg.x) + pg.fly * 500, py = r.y - 38 - pg.fly * pg.fly * 500;
      ctx.save(); ctx.translate(px, py);
      D.sticker(ctx, P.ellipse(0, 0, 44, 34), '#B9B6CC', { x: -44, y: -34, w: 88, h: 68 });
      D.sticker(ctx, P.circle(-30, -26, 22), '#B9B6CC', { x: -52, y: -48, w: 44, h: 44 }, { shadow: false });
      ctx.fillStyle = '#FFC83D'; ctx.beginPath(); ctx.moveTo(-50, -26); ctx.lineTo(-66, -20); ctx.lineTo(-50, -16); ctx.fill();
      D.eyes(ctx, -32, -30, 5, pg.fed ? 'happy' : 'sleepy', 0, 0, 1.4);
      const flap = pg.fly > 0 ? Math.sin(S.t * 30) * 0.8 : 0;
      ctx.save(); ctx.rotate(-0.3 + flap); D.sticker(ctx, P.ellipse(10, -6, 30, 16), '#9C98B4', null, { shadow: false, lw: 4 }); ctx.restore();
      if (!pg.fed) D.text(ctx, 'z', 10, -70 - Math.sin(S.t * 2) * 6, { size: 30, color: '#fff', outline: 6 });
      ctx.restore();
    }
    // snack
    const sn = r.snack;
    if (sn && !(sn.got && sn.flyT > 0.4)) {
      let snx = sx(r.x + r.w * 0.3), sny = sn.y + Math.sin(S.t * 3) * 10;
      if (sn.got) { const k = sn.flyT / 0.4; snx = U.lerp(snx, sx(S.rx), k); sny = U.lerp(sny, S.ry - 60, k); }
      sn.x = r.x + r.w * 0.3;
      drawSnack(ctx, snx, sny, sn.kind);
    }
  }
  function drawSnack(ctx, x, y, kind) {
    ctx.save(); ctx.translate(x, y);
    ctx.globalAlpha = 0.35; ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(0, 0, 44, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    if (kind === 'dango') { ctx.strokeStyle = '#B07A45'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(0, 46); ctx.stroke(); ['#FF9EC4', '#fff', '#8BD448'].forEach((c, i) => D.sticker(ctx, P.circle(0, -24 + i * 22, 14), c, null, { shadow: false, lw: 4 })); }
    else if (kind === 'taiyaki') { D.sticker(ctx, P.ellipse(0, 0, 40, 24), '#E0A060', { x: -40, y: -24, w: 80, h: 48 }); ctx.fillStyle = '#E0A060'; ctx.beginPath(); ctx.moveTo(34, 0); ctx.lineTo(54, -18); ctx.lineTo(54, 18); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke(); D.eyes(ctx, -20, -4, 4, 'happy', 0, 0, 1); }
    else { D.sticker(ctx, P.poly([[0, -34], [34, 24], [-34, 24]], true), '#fff', { x: -34, y: -34, w: 68, h: 58 }); ctx.fillStyle = C.ink; ctx.fill(P.rr(-18, 4, 36, 22, 4)); }
    ctx.restore();
  }
  function draw(g, ctx) {
    drawSky(g, ctx);
    for (const r of S.roofs) drawRoof(g, ctx, r);
    for (const c of S.crackers) { const k = Math.min(1, c.t); const x = sx(U.lerp(c.x0, c.x1, k)), y = U.lerp(c.y0, c.y1, k) - Math.sin(k * Math.PI) * 120; ctx.fillStyle = '#E0B070'; ctx.fill(P.rr(x - 12, y - 8, 24, 16, 4)); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke(P.rr(x - 12, y - 8, 24, 16, 4)); }
    // Rascal
    const outfits = ['#FF5A5F', '#FFC83D', '#2BB673', '#2F9BFF', '#FF3EA5'];
    A.raccoon(ctx, sx(S.rx), S.ry - 56, 1.1, { t: S.t, run: !!S.anim, squash: S.squash, mood: S.anim ? 'wide' : 'normal', mouth: S.anim ? 'grin' : 'smile', scarf: outfits[S.outfit % outfits.length] });
    // dawn glow from the left
    const dx = sx(S.dawn);
    if (dx > -400) {
      const grd = ctx.createLinearGradient(dx - 500, 0, dx + 120, 0);
      grd.addColorStop(0, 'rgba(255,190,90,0.85)'); grd.addColorStop(0.8, 'rgba(255,160,120,0.45)'); grd.addColorStop(1, 'rgba(255,160,120,0)');
      ctx.fillStyle = grd; const v = g.vw(); ctx.fillRect(v.x, v.y, dx + 120 - v.x, v.h);
      if (dx > 0) { D.sticker(ctx, P.circle(dx - 120, 860, 110), '#FFC83D', { x: dx - 230, y: 750, w: 220, h: 220 }, { shadow: false }); D.eyes(ctx, dx - 120, 830, 12, 'normal', 1, 0, 1.6); }
    }
    // chips
    const list = targets();
    for (const t of list) {
      if (!t.alive || !t.typer) continue;
      let x, y;
      if (t.kind === 'roof') { x = sx(t.roof.x + t.roof.w / 2); y = t.roof.y - 120; if (t.roof.goal) y -= 120; }
      else if (t.kind === 'pigeon') { x = sx(t.obj.x); y = t.roof.y - 150; }
      else { x = sx(t.roof.x + t.roof.w * 0.3); y = t.obj.y - 80; }
      const size = t.kind === 'roof' ? (t.typer.item.kind === 'sentence' ? 40 : 46) : 38;
      const sz = D.chipSize(ctx, t.typer, size);
      x = U.clamp(x, sz.w / 2 + 20, W - sz.w / 2 - 20);
      D.chip(ctx, x, y, t.typer, { size, accent: C.rascal, locked: t.locked, hint: g.hint });
      if (t.kind !== 'roof') D.text(ctx, t.kind === 'pigeon' ? 'feed' : 'snack', x, y - sz.h / 2 - 20, { size: 24, color: '#fff', outline: 6, font: D.FONT_DISPLAY(24, 700) });
    }
    g.fx.draw(ctx);
    if (S.banner.t < 2 && !g.demo) { const a = S.banner.t > 1.5 ? 1 - (S.banner.t - 1.5) / 0.5 : 1; ctx.save(); ctx.globalAlpha = a; D.text(ctx, S.banner.text, W / 2, 330, { size: 130, color: C.rascal, outline: 18 }); ctx.restore(); }
  }

  TM.game({
    id: 'rooftop-rascal', name: 'Rooftop Rascal', accent: C.rascal, bg: '#1A2457', dark: true,
    logoHTML: 'Rooftop<br>Rascal', tagline: 'Get home before the sun comes up!',
    lifeIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 10Q60 10 90 76Q92 86 80 86H20Q8 86 10 76Q40 10 50 10z" fill="#fff" stroke="#1F1A3D" stroke-width="8" stroke-linejoin="round"/><rect x="30" y="56" width="40" height="30" rx="4" fill="#1F1A3D"/></svg>',
    howto: [
      'Rascal the raccoon is sneaking home across the rooftops.',
      'Type the word on the <b>next roof</b> to leap there.',
      'A sleepy <b>pigeon</b> in the way? Type its word to toss it a cracker and it flies off.',
      'Type a <b>snack</b> word for bonus points. Onigiri give back a life!',
      'The sun rises from the left. If it catches Rascal he loses an onigiri. Gentle mode has no sunrise.',
      'Reach Kip at the end of each level. The last jump is a big one!',
    ],
    music, reset, update, draw, onKey, onBack,
    nextKey: () => { const l = targets(); const t = S.lock.locked || l.find((x) => x.kind === 'pigeon' && x.alive) || l.find((x) => x.kind === 'roof' && x.alive); return t && t.typer ? t.typer.nextReq() : null; },
    hud: (g) => ({ lives: S.lives, maxLives: g.diff === 'gentle' ? 0 : 3, right: `Level ${S.level}` }),
  });
})();
