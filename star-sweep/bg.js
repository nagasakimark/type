/* Star Sweep - multi-layer parallax space background. Everything spans the full visible rectangle (g.vw()).
   The heavy layers (skybox + nebula clouds + horizon) are baked once into offscreen canvases so a frame costs only a couple of blits. */
(function () {
  'use strict';
  const SS = window.SS, TM = window.TM, U = TM.U;
  const rnd = U.rand;
  const CROP = { band: [40, 800], galaxy: [0, 820], nebula: [40, 880], dark: [0, 1024], day: [0, 640], deep: [0, 1024] };
  const STAR_COL = ['#ffffff', '#cfe6ff', '#fff3c4', '#ffd6e8'];
  const SPEED = [9, 24, 52];
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

  const bg = (SS.bg = { stars: [], clouds: [], planets: [], rocks: [], off: [0, 0, 0], t: 0, sector: 0, prevBake: null, fade: 0, warp: 0, pipGrow: 0, bake: null, sec: null, hbake: null });
  for (let i = 0; i < 150; i++) { const z = i < 80 ? 0 : i < 125 ? 1 : 2; bg.stars.push({ fx: Math.random(), fy: Math.random(), z, g: i % 2, c: STAR_COL[i % 4], s: z === 0 ? 1.7 : z === 1 ? 2.5 : 3.6 }); }
  bg.init = function () { };

  bg.set = function (idx, instant) {
    const sec = SS.SECTORS[idx] || SS.SECTORS[0];
    if (!instant && bg.bake) { bg.prevBake = bg.bake; bg.fade = 1; }
    bg.sector = idx; bg.sec = sec; bg.bake = null; bg.hbake = null;
    bg.clouds = [];
    for (let i = 0; i < 6; i++) bg.clouds.push({ fx: Math.random(), fy: rnd(0.05, 0.95), size: rnd(700, 1200), spr: 'p_smoke' + U.randi(1, 10), rot: rnd(0, 6.28), a: rnd(0.1, 0.2), alt: i % 3 === 0 });
    bg.planets = sec.planets.map((p, i) => ({ idx: p, fx: i ? rnd(0.62, 0.88) : rnd(0.1, 0.35), fy: instant ? rnd(0.1, 0.7) : -0.3 - i * 0.5, size: i ? Math.round(rnd(200, 260) / 20) * 20 : Math.round(rnd(320, 420) / 20) * 20, sp: rnd(6, 10) * (i ? 0.8 : 1) }));
    bg.rocks = [];
    const names = ['meteorGrey_big1', 'meteorGrey_big2', 'meteorGrey_med1', 'meteorGrey_med2', 'meteorBrown_big1', 'meteorBrown_big3', 'meteorBrown_med1', 'meteorGrey_small1', 'meteorBrown_small1', 'meteorGrey_tiny1'];
    for (let i = 0; i < Math.min(sec.ast, 12); i++) bg.rocks.push({ spr: U.pick(names), fx: Math.random(), fy: Math.random(), s: rnd(0.5, 1.4), rot: rnd(0, 6.28), vr: rnd(-0.6, 0.6), vy: rnd(18, 52), vx: rnd(-14, 14), a: rnd(0.35, 0.7) });
  };

  bg.update = function (dt, warp) {
    bg.t += dt; bg.warp = warp || 0;
    const wm = 1 + bg.warp * 38;
    for (let z = 0; z < 3; z++) bg.off[z] += SPEED[z] * wm * dt;
    if (bg.fade > 0) { bg.fade = Math.max(0, bg.fade - dt / 2.2); if (bg.fade === 0) bg.prevBake = null; }
    for (const p of bg.planets) { p.fy += p.sp * (1 + bg.warp * 5) * dt / 1080; if (p.fy > 1.35) { p.fy = -0.35; p.fx = Math.random() * 0.8 + 0.1; } }
    for (const r of bg.rocks) { r.fy += r.vy * (1 + bg.warp * 5) * dt / 1080; r.fx += r.vx * dt / 1920; r.rot += r.vr * dt; if (r.fy > 1.1) { r.fy = -0.1; r.fx = Math.random(); } }
  };

  /* skybox + dark wash + nebula clouds in one seamless horizontal tile (baked at 1 canvas px per virtual unit) */
  function bakeSky(v) {
    const im = SS.sky[bg.sec.sky]; if (!im) return null;
    const c = CROP[bg.sec.sky] || [0, 1024]; const sh = c[1] - c[0];
    const H = Math.ceil(v.h + 200); const dw = Math.round(2048 * H / sh);
    const cv = mk(dw, H), x = cv.getContext('2d');
    x.drawImage(im, 0, c[0], 2048, sh, 0, 0, dw, H);
    x.fillStyle = 'rgba(4,5,22,0.34)'; x.fillRect(0, 0, dw, H);
    x.globalCompositeOperation = 'lighter';
    for (const cl of bg.clouds) for (const ox of [-dw, 0, dw]) SS.spr(x, cl.spr, cl.fx * dw + ox, cl.fy * H, { max: cl.size, rot: cl.rot, a: cl.a, tint: cl.alt ? bg.sec.tint2 : bg.sec.tint });
    return { cv, dw, H };
  }
  function drawBake(ctx, v, b, alpha) {
    const off = (bg.t * 6) % b.dw; ctx.globalAlpha = alpha;
    for (let x = v.x - off - 100; x < v.x + v.w + 100; x += b.dw) ctx.drawImage(b.cv, Math.round(x), Math.round(v.y - 100));
    ctx.globalAlpha = 1;
  }
  function bakeHorizon(v) {
    const sec = bg.sec; const sag = 150, w = Math.ceil(v.w + 440), h = sag + 130, half = w / 2;
    const cv = mk(w, h), x = cv.getContext('2d');
    const top = (px) => 20 + sag * Math.pow((px - half) / half, 2);
    const path = new Path2D(); path.moveTo(0, h);
    for (let px = 0; px <= w + 1; px += 16) path.lineTo(px, top(px)); path.lineTo(w, h); path.closePath();
    x.save(); x.clip(path);
    const g = x.createLinearGradient(0, 20, 0, 20 + sag + 40); g.addColorStop(0, sec.rim1); g.addColorStop(0.35, sec.rim2); g.addColorStop(1, '#05061a');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const im = SS.planets[sec.horizon]; if (im) { x.globalAlpha = 0.5; x.drawImage(im, 0, 20, w, h - 20); x.globalAlpha = 1; }
    const g2 = x.createLinearGradient(0, 20, 0, h); g2.addColorStop(0, 'rgba(5,6,26,0)'); g2.addColorStop(0.7, 'rgba(5,6,26,0.8)'); x.fillStyle = g2; x.fillRect(0, 0, w, h);
    x.restore();
    x.globalCompositeOperation = 'lighter'; x.lineJoin = 'round';
    const rim = new Path2D(); for (let px = 0; px <= w + 1; px += 16) px ? rim.lineTo(px, top(px)) : rim.moveTo(px, top(px));
    for (const [lw, a] of [[34, 0.07], [18, 0.12], [7, 0.3], [2.5, 0.8]]) { x.strokeStyle = U.hexA(sec.tint, a); x.lineWidth = lw; x.stroke(rim); }
    return { cv, w, h, key: bg.sector + '|' + Math.round(v.w) };
  }
  const planetCache = new Map();
  function planetSprite(idx, size, tint) {
    const key = idx + '|' + size; let c = planetCache.get(key); if (c) return c;
    const im = SS.planets[idx]; if (!im) return null;
    const S2 = Math.round(size * 1.3); c = mk(S2, S2); const x = c.getContext('2d');
    x.globalCompositeOperation = 'lighter'; SS.spr(x, 'p_circle5', S2 / 2, S2 / 2, { max: size * 1.3, a: 0.3, tint });
    x.globalCompositeOperation = 'source-over'; x.drawImage(im, S2 / 2 - size / 2, S2 / 2 - size / 2, size, size);
    planetCache.set(key, c); return c;
  }

  bg.draw = function (ctx, v, bottomY) {
    const sec = bg.sec || SS.SECTORS[0];
    const H = Math.ceil(v.h + 200);
    if ((!bg.bake || Math.abs(bg.bake.H - H) > 40) && SS.sky[sec.sky]) bg.bake = bakeSky(v);
    if (bg.bake) { if (bg.fade > 0 && bg.prevBake) { drawBake(ctx, v, bg.prevBake, 1); drawBake(ctx, v, bg.bake, 1 - bg.fade); } else drawBake(ctx, v, bg.bake, 1); }
    else { ctx.fillStyle = '#0a0c30'; ctx.fillRect(v.x - 120, v.y - 120, v.w + 240, v.h + 240); }
    // stars: 3 parallax layers, batched into a few fills each
    const streak = bg.warp > 0.04;
    for (let z = 0; z < 3; z++) {
      for (let grp = 0; grp < 2; grp++) {
        ctx.globalAlpha = (0.5 + z * 0.2) * (0.7 + 0.3 * Math.sin(bg.t * (1.4 + z * 0.7) + grp * 3)); ctx.fillStyle = grp ? '#d8ecff' : '#ffffff';
        ctx.beginPath();
        for (const s of bg.stars) {
          if (s.z !== z || s.g !== grp) continue;
          const y = v.y + ((s.fy * v.h + bg.off[z]) % v.h), x = v.x + s.fx * v.w;
          if (streak) { const L = s.s * 4 + bg.warp * (40 + z * 90); ctx.rect(x - s.s / 2, y - L, s.s, L); } else ctx.rect(x - s.s / 2, y - s.s / 2, s.s, s.s);
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const p of bg.planets) { const c = planetSprite(p.idx, p.size, sec.tint); if (c) ctx.drawImage(c, Math.round(v.x + p.fx * v.w - c.width / 2), Math.round(v.y + p.fy * v.h - c.height / 2)); }
    if (bg.pipGrow > 0) { const sz = Math.round((200 + bg.pipGrow * 280) / 20) * 20; const c = planetSprite(3, sz, '#7fd3ff'); if (c) ctx.drawImage(c, Math.round(v.x + v.w * 0.14 - c.width / 2), Math.round(v.y + 150 + bg.pipGrow * 40 - c.height / 2)); }
    for (const r of bg.rocks) SS.spr(ctx, r.spr, v.x + r.fx * v.w, v.y + r.fy * v.h, { s: r.s, rot: r.rot, a: r.a });
    if (!bg.hbake || bg.hbake.key !== bg.sector + '|' + Math.round(v.w)) bg.hbake = bakeHorizon(v);
    ctx.drawImage(bg.hbake.cv, Math.round(v.x - 220), Math.round(bottomY - 150 - 20));
  };
})();
