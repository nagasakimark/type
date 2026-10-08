/* Word Ninja - the dojo: wood wall, shoji panels, night garden, lanterns, wooden floor, drifting petals.
   Everything is drawn across g.vw() so it is full-bleed on any aspect ratio. */
(function () {
  'use strict';
  const WN = (window.WN = window.WN || {});
  const mk = (w, h) => WN.mk(w, h);
  const FLOOR_TOP = 900, PANEL_W = 480, PANEL_Y = 140, PANEL_H = 640;
  WN.FLOOR_TOP = FLOOR_TOP;
  let T = null;

  function rnd(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

  function woodTile(w, h, base, alt, seamEvery, vertical, seed) {
    const c = mk(w, h), x = c.getContext('2d'), r = rnd(seed);
    const n = Math.round((vertical ? w : h) / seamEvery);
    for (let i = 0; i < n; i++) {
      const o = i * seamEvery;
      x.fillStyle = i % 2 ? alt : base;
      vertical ? x.fillRect(o, 0, seamEvery, h) : x.fillRect(0, o, w, seamEvery);
      // grain
      for (let k = 0; k < 14; k++) {
        x.strokeStyle = `rgba(20,8,0,${0.05 + r() * 0.09})`; x.lineWidth = 1 + r() * 2;
        x.beginPath();
        if (vertical) { const gx = o + r() * seamEvery; x.moveTo(gx, 0); x.bezierCurveTo(gx + (r() - 0.5) * 8, h * 0.3, gx + (r() - 0.5) * 8, h * 0.7, gx + (r() - 0.5) * 4, h); }
        else { const gy = o + r() * seamEvery; x.moveTo(0, gy); x.bezierCurveTo(w * 0.3, gy + (r() - 0.5) * 6, w * 0.7, gy + (r() - 0.5) * 6, w, gy + (r() - 0.5) * 3); }
        x.stroke();
      }
      x.fillStyle = 'rgba(15,6,0,0.55)';
      vertical ? x.fillRect(o, 0, 3, h) : x.fillRect(0, o, w, 3);
      x.fillStyle = 'rgba(255,220,170,0.08)';
      vertical ? x.fillRect(o + 3, 0, 3, h) : x.fillRect(0, o + 3, w, 3);
    }
    return c;
  }

  function lattice(x, w, h, cols, rows, lw, color) {
    x.strokeStyle = color; x.lineWidth = lw; x.lineCap = 'square';
    for (let i = 0; i <= cols; i++) { const px = i * w / cols; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h); x.stroke(); }
    for (let j = 0; j <= rows; j++) { const py = j * h / rows; x.beginPath(); x.moveTo(0, py); x.lineTo(w, py); x.stroke(); }
  }

  function bamboo(x, bx, h, w, color, seed) {
    const r = rnd(seed);
    x.fillStyle = color; x.fillRect(bx - w / 2, 0, w, h);
    x.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = 40 + r() * 40; y < h; y += 90 + r() * 40) x.fillRect(bx - w / 2 - 2, y, w + 4, 5);
    for (let k = 0; k < 4; k++) { // leaves
      const ly = 80 + r() * (h - 160), dir = r() > 0.5 ? 1 : -1;
      x.save(); x.translate(bx, ly); x.rotate(dir * (0.5 + r() * 0.6) - Math.PI / 2 * 0);
      for (let l = 0; l < 3; l++) { x.rotate(dir * 0.22); x.beginPath(); x.ellipse(40, 0, 44, 7, 0, 0, 7); x.fill(); }
      x.restore();
    }
  }

  function panel(kind) {
    const w = PANEL_W - 24, h = PANEL_H, c = mk(w, h), x = c.getContext('2d'), r = rnd(kind * 77 + 5);
    if (kind === 0) { // warm paper
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#FFE2A8'); g.addColorStop(1, '#F6C77A');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      const rg = x.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h * 0.45, h * 0.6); rg.addColorStop(0, 'rgba(255,250,220,0.75)'); rg.addColorStop(1, 'rgba(255,250,220,0)');
      x.fillStyle = rg; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(150,100,40,${0.04 + r() * 0.05})`; x.fillRect(r() * w, r() * h, 8 + r() * 30, 1.5); }
    } else if (kind === 1) { // night garden with moon and bamboo
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1B2358'); g.addColorStop(0.55, '#4B3C85'); g.addColorStop(1, '#C97A8E');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.5})`; x.beginPath(); x.arc(r() * w, r() * h * 0.55, 1 + r() * 1.6, 0, 7); x.fill(); }
      const mg = x.createRadialGradient(w * 0.6, h * 0.26, 10, w * 0.6, h * 0.26, 150); mg.addColorStop(0, 'rgba(255,248,210,0.55)'); mg.addColorStop(1, 'rgba(255,248,210,0)');
      x.fillStyle = mg; x.fillRect(0, 0, w, h);
      x.fillStyle = '#FFF6D0'; x.beginPath(); x.arc(w * 0.6, h * 0.26, 62, 0, 7); x.fill();
      x.fillStyle = 'rgba(210,190,140,0.5)'; x.beginPath(); x.arc(w * 0.6 - 18, h * 0.26 + 10, 12, 0, 7); x.arc(w * 0.6 + 20, h * 0.26 - 14, 8, 0, 7); x.fill();
      x.fillStyle = '#2A2260'; x.beginPath(); x.moveTo(0, h * 0.78); for (let i = 0; i <= 8; i++) x.lineTo(i * w / 8, h * (0.72 + 0.04 * Math.sin(i * 1.3) + (i % 2) * 0.03)); x.lineTo(w, h); x.lineTo(0, h); x.fill();
      bamboo(x, w * 0.2, h, 22, '#1C3B3A', 11); bamboo(x, w * 0.78, h, 18, '#173331', 23); bamboo(x, w * 0.5, h, 12, 'rgba(24,52,52,0.8)', 31);
    } else { // plaster wall with a hanging scroll (enso) 
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6B4630'); g.addColorStop(1, '#5A3924');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`; x.fillRect(r() * w, r() * h, 2 + r() * 20, 2 + r() * 3); }
      x.fillStyle = '#F7E9C6'; x.fillRect(w * 0.22, 40, w * 0.56, h - 150);
      x.fillStyle = '#7B2D26'; x.fillRect(w * 0.22 - 10, 40, w * 0.56 + 20, 18); x.fillRect(w * 0.22 - 10, h - 122, w * 0.56 + 20, 22);
      x.fillStyle = '#3A2414'; x.beginPath(); x.arc(w * 0.22 - 6, h - 111, 11, 0, 7); x.arc(w * 0.78 + 6, h - 111, 11, 0, 7); x.fill();
      x.strokeStyle = '#1F1A3D'; x.lineWidth = 17; x.lineCap = 'round';
      x.beginPath(); x.arc(w / 2, h * 0.4, 78, 0.9, 0.9 + 5.2); x.stroke();
      x.lineWidth = 7; x.beginPath(); x.arc(w / 2, h * 0.4, 78, 0.9 + 5.0, 0.9 + 5.5); x.stroke();
      x.fillStyle = '#C8372D'; x.fillRect(w * 0.64, h * 0.62, 34, 34); x.fillStyle = '#F7E9C6'; x.fillRect(w * 0.64 + 8, h * 0.62 + 8, 18, 5); x.fillRect(w * 0.64 + 8, h * 0.62 + 20, 18, 5);
    }
    if (kind !== 2) { // lattice frame over paper
      lattice(x, w, h, 3, 5, 8, 'rgba(58,32,16,0.95)');
      x.strokeStyle = 'rgba(255,230,180,0.22)'; x.lineWidth = 2; x.strokeRect(5, 5, w - 10, h - 10);
    }
    x.lineWidth = 16; x.strokeStyle = '#3A2012'; x.strokeRect(0, 0, w, h);
    x.lineWidth = 3; x.strokeStyle = 'rgba(255,200,140,0.25)'; x.strokeRect(9, 9, w - 18, h - 18);
    return c;
  }

  function petalSprite() {
    const c = mk(40, 40), x = c.getContext('2d');
    const g = x.createRadialGradient(14, 14, 2, 20, 20, 20); g.addColorStop(0, '#FFEFF5'); g.addColorStop(1, '#FF9FBC');
    x.fillStyle = g; x.beginPath(); x.moveTo(20, 4); x.bezierCurveTo(38, 8, 38, 30, 20, 36); x.bezierCurveTo(2, 30, 2, 8, 20, 4); x.fill();
    x.strokeStyle = 'rgba(200,80,120,0.5)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(20, 8); x.lineTo(20, 30); x.stroke();
    return c;
  }

  WN.backdrop = {
    petals: [],
    init() {
      T = {
        wall: woodTile(256, 256, '#4C2F1E', '#583824', 128, true, 3),
        beam: woodTile(256, 128, '#3A2112', '#43281A', 64, false, 8),
        post: woodTile(128, 256, '#4A2B18', '#52331F', 64, true, 12),
        floor: woodTile(512, 256, '#C98F58', '#BC8250', 64, false, 21),
        panels: [panel(0), panel(1), panel(2), panel(1)],
        petal: petalSprite(),
      };
      T.pat = {};
    },
    pattern(ctx, key) { return T.pat[key] || (T.pat[key] = ctx.createPattern(T[key], 'repeat')); },
    update(dt, v, wind) {
      const want = Math.min(90, Math.round(26 + (v.w * v.h) / 40000));
      const P = this.petals;
      while (P.length < want) P.push({ x: v.x + Math.random() * v.w, y: v.y + Math.random() * v.h, vx: 0, vy: 0, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 3, s: 0.35 + Math.random() * 0.7, ph: Math.random() * 9, z: Math.random() });
      for (const p of P) {
        p.ph += dt * (0.8 + p.z);
        p.x += (30 + p.z * 60 + wind) * dt + Math.sin(p.ph) * 22 * dt;
        p.y += (34 + p.z * 40) * dt;
        p.rot += p.vr * dt;
        if (p.x > v.x + v.w + 60 || p.y > v.y + v.h + 60 || p.x < v.x - 400) { p.x = v.x - 60 - Math.random() * 200; p.y = v.y - 40 + Math.random() * v.h * 0.8; }
      }
      if (P.length > want) P.length = want;
    },
    /* back: everything behind the fruit */
    drawBack(ctx, v, env) {
      if (!T) return;
      const t = env.t, px = env.px;
      const x0 = v.x, x1 = v.x + v.w, y0 = v.y, y1 = v.y + v.h;
      // base
      ctx.fillStyle = '#3B2417'; ctx.fillRect(x0 - 2, y0 - 2, v.w + 4, v.h + 4);
      // wall planks (slow parallax)
      ctx.save(); ctx.translate(px * 0.3, 0); ctx.fillStyle = this.pattern(ctx, 'wall'); ctx.fillRect(x0 - 40, y0 - 2, v.w + 80, FLOOR_TOP - y0 + 2); ctx.restore();
      // panels
      const pw = PANEL_W, off = px * 0.6;
      const i0 = Math.floor((x0 - off) / pw) - 1, i1 = Math.ceil((x1 - off) / pw) + 1;
      for (let i = i0; i <= i1; i++) {
        const kind = ((i % 4) + 4) % 4;
        const px0 = i * pw + 12 + off;
        ctx.drawImage(T.panels[kind], px0, PANEL_Y);
        // paper glow from lanterns
        if (kind === 0) { ctx.save(); ctx.globalAlpha = 0.12 + 0.05 * Math.sin(t * 2 + i); ctx.fillStyle = '#FFD27A'; ctx.fillRect(px0, PANEL_Y, PANEL_W - 24, PANEL_H); ctx.restore(); }
        // dado rail below panel
        ctx.fillStyle = '#2E190D'; ctx.fillRect(px0 - 12, PANEL_Y + PANEL_H, pw, 26);
        ctx.fillStyle = 'rgba(255,200,140,0.18)'; ctx.fillRect(px0 - 12, PANEL_Y + PANEL_H, pw, 4);
      }
      // transom / beam / ceiling
      ctx.save(); ctx.translate(px * 0.9, 0); ctx.fillStyle = this.pattern(ctx, 'beam');
      ctx.fillRect(x0 - 100, y0 - 2, v.w + 200, 120 - y0 + 2); ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x0, 108, v.w, 36);
      ctx.fillStyle = '#2A170B'; ctx.fillRect(x0, 112, v.w, 30);
      ctx.fillStyle = 'rgba(255,200,140,0.2)'; ctx.fillRect(x0, 112, v.w, 3);
      // lower wainscot (dark) down to floor
      ctx.fillStyle = '#34200F'; ctx.fillRect(x0, PANEL_Y + PANEL_H + 26, v.w, FLOOR_TOP - PANEL_Y - PANEL_H - 26);
      ctx.fillStyle = 'rgba(255,200,140,0.07)';
      for (let k = Math.floor(x0 / 160) * 160; k < x1; k += 160) ctx.fillRect(k + px * 0.8, PANEL_Y + PANEL_H + 40, 4, FLOOR_TOP - PANEL_Y - PANEL_H - 40);
      // floor
      ctx.save(); ctx.translate(px * 1.2, 0); ctx.fillStyle = this.pattern(ctx, 'floor'); ctx.fillRect(x0 - 60, FLOOR_TOP, v.w + 120, y1 - FLOOR_TOP + 2); ctx.restore();
      const fg = ctx.createLinearGradient(0, FLOOR_TOP, 0, FLOOR_TOP + 90); fg.addColorStop(0, 'rgba(30,10,0,0.55)'); fg.addColorStop(1, 'rgba(30,10,0,0)');
      ctx.fillStyle = fg; ctx.fillRect(x0, FLOOR_TOP, v.w, 90);
      ctx.fillStyle = '#2A170B'; ctx.fillRect(x0, FLOOR_TOP - 10, v.w, 14);
      ctx.fillStyle = 'rgba(255,220,170,0.25)'; ctx.fillRect(x0, FLOOR_TOP + 4, v.w, 3);
      // posts
      const postGap = 960, pOff = px * 1.6;
      for (let i = Math.floor((x0 - pOff) / postGap) - 1; i <= Math.ceil((x1 - pOff) / postGap) + 1; i++) {
        const X = i * postGap + pOff - 36;
        ctx.save(); ctx.translate(X, 0); ctx.fillStyle = this.pattern(ctx, 'post'); ctx.translate(0, 0);
        ctx.fillRect(0, y0 - 2, 72, FLOOR_TOP - y0 + 12); ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(X + 56, y0, 16, FLOOR_TOP - y0);
        ctx.fillStyle = 'rgba(255,210,150,0.2)'; ctx.fillRect(X + 6, y0, 5, FLOOR_TOP - y0);
        ctx.fillStyle = '#2A170B'; ctx.fillRect(X - 8, 100, 88, 26); ctx.fillRect(X - 8, FLOOR_TOP - 30, 88, 36);
      }
      // frenzy: golden rays
      if (env.glow > 0.01) {
        ctx.save(); ctx.globalAlpha = env.glow * 0.3; ctx.globalCompositeOperation = 'lighter';
        const cx = 960, cy = 420; ctx.translate(cx, cy); ctx.rotate(t * 0.25);
        for (let k = 0; k < 14; k++) { ctx.rotate(Math.PI * 2 / 14); const g = ctx.createLinearGradient(0, 0, 1800, 0); g.addColorStop(0, 'rgba(255,214,90,0.55)'); g.addColorStop(1, 'rgba(255,214,90,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1800, -90); ctx.lineTo(1800, 90); ctx.fill(); }
        ctx.restore();
      }
    },
    /* lanterns hang from the beam, in front of the wall decals */
    drawLanterns(ctx, v, env) {
      if (!T) return;
      const t = env.t, sp = 480, off = env.px * 1.4;
      const glow = WN.img('flare_01');
      for (let i = Math.floor((v.x - off) / sp) - 1; i <= Math.ceil((v.x + v.w - off) / sp) + 1; i++) {
        const X = i * sp + 240 + off, len = 70 + ((i * 37) & 3) * 28, sw = Math.sin(t * 1.3 + i * 1.7) * 0.07;
        const red = (((i % 3) + 3) % 3) !== 1;
        ctx.save(); ctx.translate(X, 126); ctx.rotate(sw);
        ctx.strokeStyle = '#1F1A3D'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, len); ctx.stroke();
        ctx.translate(0, len);
        if (glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (0.55 + 0.1 * Math.sin(t * 7 + i * 3)) * (env.dim ? 0.7 : 1); ctx.drawImage(glow, -190, -110, 380, 380); ctx.restore(); }
        const bw = 52, bh = 74;
        ctx.fillStyle = '#2A170B'; ctx.fillRect(-20, -6, 40, 12);
        const g = ctx.createRadialGradient(0, 36, 6, 0, 36, 56); g.addColorStop(0, red ? '#FF9A5A' : '#FFE27A'); g.addColorStop(1, red ? '#D8302A' : '#F2A22C');
        ctx.fillStyle = g; ctx.strokeStyle = '#1F1A3D'; ctx.lineWidth = 4.5;
        ctx.beginPath(); ctx.ellipse(0, 38, bw, bh / 2 + 6, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(80,16,10,0.55)'; ctx.lineWidth = 2.5;
        for (let r = -2; r <= 2; r++) { ctx.beginPath(); ctx.moveTo(-bw * Math.sqrt(1 - Math.pow(r / 2.55, 2)), 38 + r * 14); ctx.lineTo(bw * Math.sqrt(1 - Math.pow(r / 2.55, 2)), 38 + r * 14); ctx.stroke(); }
        ctx.fillStyle = '#2A170B'; ctx.fillRect(-20, 68, 40, 12);
        ctx.fillStyle = '#FFD27A'; ctx.beginPath(); ctx.arc(0, 90, 4, 0, 7); ctx.fill();
        ctx.restore();
      }
    },
    drawPetals(ctx, v, front) {
      if (!T) return;
      for (const p of this.petals) {
        if ((p.z > 0.72) !== front) continue;
        ctx.save(); ctx.globalAlpha = front ? 0.55 : 0.9; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(p.s * (0.6 + 0.4 * Math.abs(Math.sin(p.ph))), p.s);
        ctx.drawImage(T.petal, -20, -20); ctx.restore();
      }
    },
    drawVignette(ctx, v, env) {
      const cx = v.x + v.w / 2, cy = v.y + v.h / 2, r = Math.hypot(v.w, v.h) / 2;
      const g = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
      g.addColorStop(0, 'rgba(20,6,0,0)'); g.addColorStop(1, 'rgba(20,6,0,0.55)');
      ctx.fillStyle = g; ctx.fillRect(v.x, v.y, v.w, v.h);
      if (env.ice > 0.01) {
        const ig = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r * 0.95); ig.addColorStop(0, 'rgba(120,200,255,0)'); ig.addColorStop(1, `rgba(150,225,255,${0.55 * env.ice})`);
        ctx.fillStyle = ig; ctx.fillRect(v.x, v.y, v.w, v.h);
        ctx.fillStyle = `rgba(110,190,255,${0.10 * env.ice})`; ctx.fillRect(v.x, v.y, v.w, v.h);
      }
    },
  };
})();
