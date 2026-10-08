/* Ink Rush - critters.js: every Gloop, boss and happy critter, drawn in code in the shared sticker style.
   Art space: feet at (0,0), y up is negative, 100 art px is about one Gloop tall. */
(function () {
  'use strict';
  const TM = window.TM, U = TM.U, D = TM.draw, P = D.P;
  const INK = window.INK, INKC = INK.INKC;

  /* world height (units) and art height (px) per enemy type; spd = relative walking speed */
  INK.TYPES = {
    jelly: { wh: 1.75, ah: 100, spd: 1, label: 'Jelly Gloop' },
    stilt: { wh: 4.0, ah: 270, spd: 0.78, label: 'Stilt Gloop' },
    brolly: { wh: 2.0, ah: 125, spd: 0.9, label: 'Brolly Gloop' },
    jumper: { wh: 1.7, ah: 100, spd: 1.05, label: 'Hopper Gloop' },
    flyer: { wh: 1.3, ah: 90, spd: 1.35, label: 'Flappy Gloop' },
    tiny: { wh: 0.95, ah: 56, spd: 1.2, label: 'Tiny Gloop' },
    split: { wh: 2.5, ah: 150, spd: 0.8, label: 'Splitter Gloop' },
    glob: { wh: 0.9, ah: 56, spd: 1.8, label: 'Goo Glob' },
    king: { wh: 7.0, ah: 330, spd: 1, label: 'Gloop King' },
    squid: { wh: 6.8, ah: 330, spd: 1, label: 'Grumpy Squid' },
    big: { wh: 5.6, ah: 250, spd: 1, label: 'Big Gloop' },
    mama: { wh: 6.2, ah: 270, spd: 1, label: 'Mama Splitter' },
  };
  for (const k of ['jelly','stilt','brolly','jumper','flyer','tiny','split','glob']) INK.TYPES[k].wh *= 1.45;
  const GREYS = {
    jelly: '#9EB0C3', stilt: '#A59DC4', brolly: '#B0A7A0', jumper: '#A1B39F', flyer: '#BBA9B8', tiny: '#A5A3B8', split: '#8F8BAA', glob: '#7F7498',
    king: '#8E88A6', squid: '#8F86B6', big: '#968FAE', mama: '#9A8FA8',
  };
  INK.GREY = GREYS;
  const lerpHex = (a, b, t) => INK.mix(a, b, t);

  function blobPath(w, h, k) {
    const p = new Path2D(), hw = w / 2; k = k || 0;
    p.moveTo(-hw, 0);
    p.bezierCurveTo(-hw * 1.12, -h * 0.35, -hw * 0.78, -h * 1.0, 0, -h);
    p.bezierCurveTo(hw * 0.78, -h * 1.0, hw * 1.12, -h * 0.35, hw, 0);
    p.quadraticCurveTo(hw * 0.8, h * (0.1 + k * 0.03), hw * 0.5, 0);
    p.quadraticCurveTo(hw * 0.25, h * (0.14 - k * 0.04), 0, 0);
    p.quadraticCurveTo(-hw * 0.25, h * (0.14 + k * 0.04), -hw * 0.5, 0);
    p.quadraticCurveTo(-hw * 0.8, h * (0.1 - k * 0.03), -hw, 0);
    p.closePath(); return p;
  }
  /* body fill + spots clipped in + outline. spots live in body coords. */
  function drawBody(ctx, path, w, h, col, spots, lw) {
    ctx.save(); ctx.translate(0, 7); ctx.fillStyle = 'rgba(31,26,61,0.16)'; ctx.fill(path); ctx.restore();
    ctx.fillStyle = col; ctx.fill(path);
    ctx.save(); ctx.clip(path);
    ctx.fillStyle = 'rgba(31,26,61,0.14)'; ctx.beginPath(); ctx.ellipse(0, h * 0.18, w * 0.72, h * 0.42, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.34)'; ctx.fill(P.rr(-w * 0.34, -h * 0.9, w * 0.4, Math.max(8, h * 0.11), 8));
    if (spots) for (const s of spots) {
      const im = INK.splat(s.k, s.col); if (!im) continue;
      ctx.save(); ctx.translate(s.x * w * 0.5, -h * 0.5 + s.y * h * 0.5); ctx.rotate(s.rot); ctx.drawImage(im, -s.r, -s.r, s.r * 2, s.r * 2); ctx.restore();
    }
    ctx.restore();
    ctx.lineWidth = lw || 5; ctx.lineJoin = 'round'; ctx.strokeStyle = INKC; ctx.stroke(path);
  }
  function face(ctx, e, w, h, fy, es) {
    const mood = e.dizzy ? 'dizzy' : e.locked ? 'wide' : (e.blink > 0 ? 'sleepy' : 'grumpy');
    const eyeY = -h * fy, s = es || w * 0.11;
    D.eyes(ctx, 0, eyeY, s, mood, e.look || 0, 0, 1.55);
    D.mouth(ctx, 0, eyeY + s * 2.3, s * 1.25, e.dizzy ? 'o' : e.locked ? 'o' : e.near ? 'grin' : 'frown');
  }
  function tuft(ctx, e, w, h) {
    if (e.var === 1) { ctx.strokeStyle = INKC; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * w * 0.06, -h * 0.97); ctx.quadraticCurveTo(i * w * 0.12, -h * 1.1, i * w * 0.18 + 4, -h * 1.14); ctx.stroke(); } }
    else if (e.var === 2) { for (const sd of [-1, 1]) { const p = new Path2D(); p.moveTo(sd * w * 0.16, -h * 0.93); p.lineTo(sd * w * 0.24, -h * 1.12); p.lineTo(sd * w * 0.05, -h * 1.0); p.closePath(); D.sticker(ctx, p, '#F2EEDC', null, { shadow: false, lw: 4 }); } }
  }

  /* ---------- the regular Gloops ---------- */
  const TY = {};
  TY.jelly = (ctx, e, t) => {
    const w = 104, h = 98, col = e.col;
    ctx.save(); ctx.scale(1 + e.sq, 1 - e.sq);
    const path = blobPath(w, h, Math.sin(t * 6 + e.seed));
    drawBody(ctx, path, w, h, col, e.spots, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(-w * 0.2, -h * 0.72, w * 0.09, h * 0.12, -0.5, 0, 7); ctx.fill();
    tuft(ctx, e, w, h); face(ctx, e, w, h, 0.55);
    ctx.restore();
  };
  TY.tiny = (ctx, e, t) => {
    const w = 58, h = 54;
    ctx.save(); ctx.scale(1 + e.sq, 1 - e.sq);
    drawBody(ctx, blobPath(w, h, Math.sin(t * 9 + e.seed)), w, h, e.col, e.spots, 4);
    face(ctx, e, w, h, 0.55, 6.4);
    ctx.restore();
  };
  TY.glob = (ctx, e, t) => {
    const w = 60, h = 60;
    ctx.save(); ctx.translate(0, -h * 0.5); ctx.rotate(t * 5); ctx.translate(0, h * 0.5);
    const path = P.blob(0, -h * 0.5, 31, e.seed, 0.2, 9, t * 6);
    ctx.fillStyle = e.col; ctx.fill(path); ctx.lineWidth = 4; ctx.strokeStyle = INKC; ctx.stroke(path);
    ctx.restore();
    ctx.save(); ctx.translate(0, -h * 0.5);
    D.eyes(ctx, 0, -2, 6, e.locked ? 'wide' : 'grumpy', 0, 0, 1.5); D.mouth(ctx, 0, 14, 8, 'frown'); ctx.restore();
  };
  TY.stilt = (ctx, e, t) => {
    const w = 96, h = 86, ph = e.phase, bodyY = -178;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const side of [-1, 1]) { // stilts with stepping
      const lift = Math.max(0, Math.sin(ph + (side > 0 ? Math.PI : 0))) * 22, x = side * 26;
      ctx.strokeStyle = INKC; ctx.lineWidth = 17; ctx.beginPath(); ctx.moveTo(x, bodyY + 10); ctx.lineTo(x + side * 4, -lift); ctx.stroke();
      ctx.strokeStyle = '#C9B48A'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x, bodyY + 10); ctx.lineTo(x + side * 4, -lift); ctx.stroke();
      ctx.fillStyle = INKC; ctx.fill(P.rr(x + side * 4 - 17, -lift - 14, 34, 16, 6));
      ctx.fillStyle = '#7F78A0'; ctx.fill(P.rr(x + side * 4 - 12, -lift - 11, 24, 8, 4));
    }
    ctx.save(); ctx.translate(0, bodyY); ctx.scale(1 + e.sq, 1 - e.sq);
    drawBody(ctx, blobPath(w, h, Math.sin(t * 5 + e.seed)), w, h, e.col, e.spots, 5);
    tuft(ctx, e, w, h); face(ctx, e, w, h, 0.55);
    ctx.restore();
  };
  TY.jumper = (ctx, e, t) => {
    const w = 90, h = 92, sq = e.sq;
    // springy legs
    ctx.strokeStyle = INKC; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    const comp = 1 - Math.max(0, sq) * 1.4;
    for (const sd of [-1, 1]) { ctx.beginPath(); const x = sd * 24, y0 = -14 * comp; ctx.moveTo(x, y0); for (let i = 1; i <= 4; i++) ctx.lineTo(x + (i % 2 ? 9 : -9), y0 + (i / 4) * 14 * comp); ctx.lineTo(x, 0); ctx.stroke(); ctx.fillStyle = INKC; ctx.beginPath(); ctx.ellipse(x, 2, 16, 6, 0, 0, 7); ctx.fill(); }
    ctx.save(); ctx.translate(0, -12 * comp); ctx.scale(1 + sq, 1 - sq);
    drawBody(ctx, blobPath(w, h, 0), w, h, e.col, e.spots, 5);
    // headband
    ctx.save(); ctx.clip(blobPath(w, h, 0)); ctx.fillStyle = '#C9B48A'; ctx.fillRect(-w / 2, -h * 0.86, w, h * 0.13); ctx.restore();
    face(ctx, e, w, h, 0.5);
    ctx.restore();
  };
  TY.flyer = (ctx, e, t) => {
    const w = 78, h = 72, fl = Math.sin(t * 16 + e.seed);
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.translate(sd * 34, -h * 0.62); ctx.rotate(sd * (0.5 + fl * 0.6));
      const wp = new Path2D(); wp.moveTo(0, 0); wp.quadraticCurveTo(sd * 60, -46, sd * 96, -4); wp.quadraticCurveTo(sd * 60, 22, 0, 8); wp.closePath();
      D.sticker(ctx, wp, '#D6CFE0', null, { shadow: false, lw: 4 }); ctx.restore();
    }
    ctx.save(); ctx.translate(0, -2 + fl * 3); ctx.scale(1 + e.sq, 1 - e.sq);
    const path = P.blob(0, -h * 0.5, 38, e.seed, 0.06, 10);
    drawBody(ctx, path, w, h, e.col, e.spots, 5);
    // little beak
    const bk = new Path2D(); bk.moveTo(-9, -h * 0.35); bk.lineTo(9, -h * 0.35); bk.lineTo(0, -h * 0.2); bk.closePath(); D.sticker(ctx, bk, '#E8B84A', null, { shadow: false, lw: 3 });
    face(ctx, e, w, h, 0.6, 8.2);
    ctx.restore();
  };
  TY.brolly = (ctx, e, t) => {
    const w = 92, h = 88;
    ctx.save(); ctx.scale(1 + e.sq, 1 - e.sq);
    drawBody(ctx, blobPath(w, h, Math.sin(t * 6 + e.seed)), w, h, e.col, e.spots, 5);
    face(ctx, e, w, h, 0.5);
    ctx.restore();
    if (e.shield) { // the umbrella shield held up in front
      const ux = Math.sin(t * 4 + e.seed) * 3, uy = -h * 0.58 + Math.sin(t * 7 + e.seed) * 2;
      ctx.save(); ctx.translate(ux, uy);
      ctx.strokeStyle = INKC; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, h * 0.58); ctx.stroke();
      const R = 98, can = new Path2D(); can.moveTo(-R, 0);
      can.bezierCurveTo(-R, -R * 1.05, R, -R * 1.05, R, 0);
      for (let i = 0; i < 4; i++) can.quadraticCurveTo(R - (i * 2 + 1) * R / 4, R * 0.28, R - (i + 1) * R / 2, 0);
      can.closePath();
      ctx.save(); ctx.translate(0, 7); ctx.fillStyle = 'rgba(31,26,61,0.16)'; ctx.fill(can); ctx.restore();
      ctx.fillStyle = e.canopy || '#B9A488'; ctx.fill(can);
      ctx.save(); ctx.clip(can);
      ctx.fillStyle = e.canopy2 || '#E9DDCA';
      for (let i = -3; i <= 3; i += 2) { ctx.beginPath(); ctx.moveTo(0, -R * 0.95); ctx.lineTo(i * R / 3.2 - R / 6.4, 4); ctx.lineTo(i * R / 3.2 + R / 6.4, 4); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill(P.rr(-R * 0.55, -R * 0.78, R * 0.4, 12, 6));
      if (e.spots) for (const s of e.spots) { const im = INK.splat(s.k, s.col); if (!im) continue; ctx.save(); ctx.translate(s.x * R * 0.6, -R * 0.4 + s.y * 20); ctx.rotate(s.rot); ctx.drawImage(im, -s.r, -s.r, s.r * 2, s.r * 2); ctx.restore(); }
      ctx.restore();
      ctx.lineWidth = 5; ctx.stroke(can);
      ctx.beginPath(); ctx.moveTo(0, -R * 1.03); ctx.lineTo(0, -R * 1.15); ctx.stroke();
      ctx.restore();
    }
  };
  TY.split = (ctx, e, t) => {
    const w = 150, h = 126;
    // two baby gloops riding on the shoulders
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.translate(sd * 46, -h * 0.82 + Math.sin(t * 6 + sd) * 3); ctx.scale(0.45, 0.45);
      drawBody(ctx, blobPath(70, 64, 0), 70, 64, lerpHex(e.col, '#ffffff', 0.18), null, 7);
      D.eyes(ctx, 0, -34, 8, e.locked ? 'wide' : 'grumpy', 0, 0, 1.5); ctx.restore();
    }
    ctx.save(); ctx.scale(1 + e.sq, 1 - e.sq);
    const path = blobPath(w, h, Math.sin(t * 4 + e.seed));
    drawBody(ctx, path, w, h, e.col, e.spots, 6);
    // a seam running down the middle, ready to split
    ctx.save(); ctx.clip(path); ctx.strokeStyle = 'rgba(31,26,61,0.35)'; ctx.lineWidth = 5; ctx.setLineDash([12, 9]); ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(0, 0); ctx.stroke(); ctx.restore();
    face(ctx, e, w, h, 0.55, 13);
    ctx.restore();
  };

  INK.drawEnemy = function (ctx, e, t) { TY[e.type](ctx, e, t); };

  /* ---------- bosses ---------- */
  const BO = {};
  BO.big = (ctx, e, t) => {
    const w = 270, h = 232;
    ctx.save(); ctx.scale(1 + e.sq, 1 - e.sq);
    // stubby arms
    for (const sd of [-1, 1]) { const a = Math.sin(t * 3 + sd) * 0.15 + (e.slam ? -0.9 : 0); ctx.save(); ctx.translate(sd * w * 0.46, -h * 0.35); ctx.rotate(sd * (0.6 + a)); const arm = P.rr(-16, 0, 32, 90, 16); D.sticker(ctx, arm, e.col, null, { shadow: false, lw: 6 }); ctx.restore(); }
    const path = blobPath(w, h, Math.sin(t * 3 + e.seed));
    drawBody(ctx, path, w, h, e.col, e.spots, 8);
    face(ctx, e, w, h, 0.56, 28);
    tuft(ctx, e, w, h);
    ctx.restore();
  };
  BO.king = (ctx, e, t) => {
    const w = 300, h = 250;
    ctx.save(); ctx.scale(1 + e.sq, 1 - e.sq);
    // royal cape behind
    const cape = new Path2D(); cape.moveTo(-w * 0.5, -h * 0.55); cape.lineTo(-w * 0.62, 6); cape.lineTo(w * 0.62, 6); cape.lineTo(w * 0.5, -h * 0.55); cape.closePath();
    D.sticker(ctx, cape, e.cape || '#A95C7A', null, { shadow: false, lw: 7 });
    for (const sd of [-1, 1]) { const a = Math.sin(t * 3 + sd) * 0.15 + (e.slam ? -0.9 : 0); ctx.save(); ctx.translate(sd * w * 0.47, -h * 0.35); ctx.rotate(sd * (0.6 + a)); D.sticker(ctx, P.rr(-17, 0, 34, 96, 17), e.col, null, { shadow: false, lw: 6 }); ctx.restore(); }
    const path = blobPath(w, h, Math.sin(t * 3 + e.seed));
    drawBody(ctx, path, w, h, e.col, e.spots, 8);
    face(ctx, e, w, h, 0.5, 30);
    // crown
    ctx.save(); ctx.translate(0, -h * 0.97 + Math.sin(t * 3) * 3); ctx.rotate(Math.sin(t * 2) * 0.05 + (e.stagger || 0) * 0.35);
    const cr = new Path2D(); cr.moveTo(-70, 0); cr.lineTo(-76, -60); cr.lineTo(-38, -30); cr.lineTo(0, -78); cr.lineTo(38, -30); cr.lineTo(76, -60); cr.lineTo(70, 0); cr.closePath();
    D.sticker(ctx, cr, '#FFC83D', { x: -76, y: -78, w: 152, h: 78 }, { lw: 6 });
    for (const [x, c] of [[-40, '#FF3EA5'], [0, '#2F9BFF'], [40, '#2BB673']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, -16, 9, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INKC; ctx.stroke(); }
    ctx.restore();
    ctx.restore();
  };
  BO.mama = (ctx, e, t) => {
    const w = 280, h = 226;
    ctx.save(); ctx.scale(1 + e.sq, 1 - e.sq);
    // babies on her back / head
    const kids = Math.max(0, 3 - (e.kidsGone || 0));
    for (let i = 0; i < kids; i++) {
      const bx = (i - 1) * 78, by = -h * 0.96 - 10 + Math.sin(t * 5 + i * 2) * 5;
      ctx.save(); ctx.translate(bx, by); ctx.scale(0.62, 0.62);
      drawBody(ctx, blobPath(80, 74, 0), 80, 74, lerpHex(e.col, '#ffffff', 0.12), null, 8);
      D.eyes(ctx, 0, -40, 9, 'grumpy', 0, 0, 1.5); D.mouth(ctx, 0, -18, 10, 'frown'); ctx.restore();
    }
    for (const sd of [-1, 1]) { const a = Math.sin(t * 3 + sd) * 0.15; ctx.save(); ctx.translate(sd * w * 0.46, -h * 0.35); ctx.rotate(sd * (0.6 + a)); D.sticker(ctx, P.rr(-16, 0, 32, 86, 16), e.col, null, { shadow: false, lw: 6 }); ctx.restore(); }
    const path = blobPath(w, h, Math.sin(t * 3 + e.seed));
    drawBody(ctx, path, w, h, e.col, e.spots, 8);
    face(ctx, e, w, h, 0.5, 27);
    // bow
    ctx.save(); ctx.translate(w * 0.22, -h * 0.9);
    for (const sd of [-1, 1]) { const b = new Path2D(); b.moveTo(0, 0); b.quadraticCurveTo(sd * 36, -30, sd * 44, 4); b.quadraticCurveTo(sd * 30, 28, 0, 0); D.sticker(ctx, b, '#E88FB5', null, { shadow: false, lw: 4 }); }
    ctx.fillStyle = '#E88FB5'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INKC; ctx.stroke(); ctx.restore();
    ctx.restore();
  };
  BO.squid = (ctx, e, t) => {
    const w = 250, h = 230;
    ctx.save();
    // tentacles
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 6; i++) {
      const bx = (i - 2.5) * w * 0.18, ph = t * 3.2 + i * 1.1, sd = i < 3 ? -1 : 1;
      const x1 = bx + sd * 22 + Math.sin(ph) * 22, y1 = 70 + Math.cos(ph) * 8, x2 = bx + sd * 34 + Math.sin(ph + 1.2) * 34, y2 = 130;
      for (const [lw, col] of [[26, INKC], [15, e.col]]) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(bx, -10); ctx.quadraticCurveTo(x1, y1, x2, y2); ctx.stroke(); }
      ctx.fillStyle = lerpHex(e.col, '#ffffff', 0.45); ctx.beginPath(); ctx.arc(x1 * 0.8 + bx * 0.2, y1 * 0.72, 4.5, 0, 7); ctx.fill();
    }
    ctx.scale(1 + e.sq, 1 - e.sq);
    // mantle: tall squid head
    const m = new Path2D(); m.moveTo(-w * 0.45, 0); m.bezierCurveTo(-w * 0.62, -h * 0.5, -w * 0.3, -h * 1.15, 0, -h * 1.28); m.bezierCurveTo(w * 0.3, -h * 1.15, w * 0.62, -h * 0.5, w * 0.45, 0);
    m.quadraticCurveTo(0, h * 0.12, -w * 0.45, 0); m.closePath();
    drawBody(ctx, m, w, h * 1.25, e.col, e.spots, 8);
    // fins
    for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * w * 0.3, -h * 1.05); ctx.rotate(sd * 0.7); const fin = new Path2D(); fin.moveTo(0, 0); fin.quadraticCurveTo(sd * 50, -34, sd * 20, -78); fin.quadraticCurveTo(-sd * 4, -34, 0, 0); D.sticker(ctx, fin, lerpHex(e.col, '#ffffff', 0.18), null, { shadow: false, lw: 6 }); ctx.restore(); }
    // goggles
    ctx.save(); ctx.translate(0, -h * 0.58);
    ctx.fillStyle = '#E9E7F5'; ctx.strokeStyle = INKC; ctx.lineWidth = 8;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 56, 0, 46, 42, 0, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.stroke();
    D.eyes(ctx, 0, 2, 13, e.dizzy ? 'dizzy' : 'grumpy', 0, 0, 2.15);
    D.mouth(ctx, 0, 70, 24, e.dizzy ? 'o' : e.near ? 'grin' : 'frown');
    ctx.restore();
    ctx.restore();
  };
  INK.drawBoss = function (ctx, e, t) { BO[e.type](ctx, e, t); };

  /* ---------- the happy critters the Gloops turn into ---------- */
  INK.SPECIES = ['bunny', 'cat', 'frog', 'bird', 'bear', 'bug'];
  INK.drawCritter = function (ctx, c, t) {
    const w = 92, h = 86, col = c.col, sp = c.species, hop = c.hop || 0;
    ctx.save(); ctx.scale(1 + c.sq, 1 - c.sq);
    const dark = U.shade(col, -0.2);
    if (sp === 'bunny') for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * 24, -h * 0.92); ctx.rotate(sd * 0.18 + Math.sin(t * 5 + sd) * 0.08); D.sticker(ctx, P.rr(-11, -52, 22, 56, 11), col, null, { shadow: false, lw: 5 }); ctx.fillStyle = '#FFC1D8'; ctx.fill(P.rr(-5, -44, 10, 38, 5)); ctx.restore(); }
    if (sp === 'cat') for (const sd of [-1, 1]) { const ear = new Path2D(); ear.moveTo(sd * 12, -h * 0.9); ear.lineTo(sd * 38, -h * 1.22); ear.lineTo(sd * 42, -h * 0.8); ear.closePath(); D.sticker(ctx, ear, col, null, { shadow: false, lw: 5 }); }
    if (sp === 'bear') for (const sd of [-1, 1]) { D.sticker(ctx, P.circle(sd * 34, -h * 0.9, 16), col, null, { shadow: false, lw: 5 }); ctx.fillStyle = '#FFC1D8'; ctx.beginPath(); ctx.arc(sd * 34, -h * 0.9, 7, 0, 7); ctx.fill(); }
    if (sp === 'bug') for (const sd of [-1, 1]) { ctx.strokeStyle = INKC; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sd * 14, -h * 0.95); ctx.quadraticCurveTo(sd * 30, -h * 1.3, sd * 44, -h * 1.22); ctx.stroke(); ctx.fillStyle = '#FFE066'; ctx.beginPath(); ctx.arc(sd * 44, -h * 1.22, 7, 0, 7); ctx.fill(); ctx.stroke(); }
    if (sp === 'bird') for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * 44, -h * 0.45); ctx.rotate(sd * (0.5 + Math.sin(t * 14) * 0.5)); const wing = new Path2D(); wing.ellipse(sd * 22, 0, 28, 14, 0, 0, 7); D.sticker(ctx, wing, dark, null, { shadow: false, lw: 4 }); ctx.restore(); }
    const path = blobPath(w, h, Math.sin(t * 7 + c.seed));
    ctx.save(); ctx.translate(0, 7); ctx.fillStyle = 'rgba(31,26,61,0.16)'; ctx.fill(path); ctx.restore();
    ctx.fillStyle = col; ctx.fill(path);
    ctx.save(); ctx.clip(path);
    ctx.fillStyle = 'rgba(31,26,61,0.12)'; ctx.beginPath(); ctx.ellipse(0, h * 0.2, w * 0.7, h * 0.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(0, -h * 0.12, w * 0.26, h * 0.2, 0, 0, 7); ctx.fill(); // belly
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill(P.rr(-w * 0.34, -h * 0.9, w * 0.38, 9, 5));
    ctx.restore();
    ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = INKC; ctx.stroke(path);
    if (sp === 'frog') for (const sd of [-1, 1]) { D.sticker(ctx, P.circle(sd * 24, -h * 0.98, 16), '#fff', null, { shadow: false, lw: 4 }); ctx.fillStyle = INKC; ctx.beginPath(); ctx.arc(sd * 24, -h * 0.98, 6, 0, 7); ctx.fill(); }
    const ey = -h * 0.55;
    if (sp !== 'frog') D.eyes(ctx, 0, ey, 10, c.wave ? 'happy' : (c.blink ? 'happy' : 'normal'), 0, 0, 1.5);
    else D.eyes(ctx, 0, ey + 6, 8, 'happy', 0, 0, 1.5);
    D.cheeks(ctx, 0, ey, 10, 1.45);
    D.mouth(ctx, 0, ey + 22, 14, 'grin');
    if (sp === 'cat') { ctx.strokeStyle = INKC; ctx.lineWidth = 3; for (const sd of [-1, 1]) for (const dy of [-4, 6]) { ctx.beginPath(); ctx.moveTo(sd * 36, ey + 14 + dy * 0.5); ctx.lineTo(sd * 62, ey + 12 + dy); ctx.stroke(); } }
    if (sp === 'bird') { const bk = new Path2D(); bk.moveTo(-9, ey + 12); bk.lineTo(9, ey + 12); bk.lineTo(0, ey + 26); bk.closePath(); D.sticker(ctx, bk, '#FFC83D', null, { shadow: false, lw: 3 }); }
    // waving arm
    if (c.wave) { ctx.save(); ctx.strokeStyle = INKC; ctx.lineWidth = 15; ctx.lineCap = 'round'; const a = Math.sin(t * 13) * 0.6; ctx.beginPath(); ctx.moveTo(w * 0.42, -h * 0.35); ctx.lineTo(w * 0.42 + Math.cos(-1.1 + a) * 46, -h * 0.35 + Math.sin(-1.1 + a) * 46); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 8; ctx.stroke(); ctx.restore(); }
    ctx.restore();
  };
})();
