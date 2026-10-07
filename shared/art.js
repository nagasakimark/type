/* Typing Master - art: the family's characters, drawn in code in the shared sticker style.
   Every function draws centred on (x, y) at scale s (1 = about 100 px tall). */
(function () {
  'use strict';
  const TM = window.TM, C = TM.C, D = TM.draw, P = D.P, U = TM.U;

  const A = {};

  /* Kip: a little keycap with feet. The mascot of the whole site. */
  A.kip = function (ctx, x, y, s = 1, o = {}) {
    const t = o.t || 0, mood = o.mood || 'happy', accent = o.accent || C.ninja;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const bob = Math.sin(t * 6) * 3;
    // feet
    ctx.fillStyle = C.ink;
    for (const side of [-1, 1]) {
      const lift = o.walk ? Math.max(0, Math.sin(t * 12 + (side > 0 ? Math.PI : 0))) * 8 : 0;
      ctx.beginPath(); ctx.ellipse(side * 22, 46 - lift, 15, 9, 0, 0, 7); ctx.fill();
    }
    ctx.translate(0, bob);
    // base (darker skirt)
    const base = P.rr(-52, -30, 104, 76, 20);
    D.sticker(ctx, base, U.shade('#F4EEDC', -0.12), { x: -52, y: -30, w: 104, h: 76 }, { highlight: false });
    // top face
    const top = P.rr(-42, -48, 84, 70, 16);
    D.sticker(ctx, top, '#FFFCF2', { x: -42, y: -48, w: 84, h: 70 }, { shadow: false });
    // accent stripe
    ctx.fillStyle = accent; ctx.fill(P.rr(-30, 30, 60, 8, 4));
    D.eyes(ctx, 0, -14, 10, mood, o.lookX || 0, 0, 1.6);
    D.cheeks(ctx, 0, -14, 10, 1.3);
    D.mouth(ctx, 0, 6, 12, o.mouth || 'smile');
    if (o.wave) { // waving arm
      ctx.save(); ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.lineCap = 'round';
      const a = Math.sin(t * 10) * 0.5;
      ctx.beginPath(); ctx.moveTo(48, 0); ctx.lineTo(48 + Math.cos(-1 + a) * 34, Math.sin(-1 + a) * 34); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  };

  /* Pip the frog (Word Jumper). o: {t, squash, rot, mood} */
  A.frog = function (ctx, x, y, s = 1, o = {}) {
    const green = '#6CCB3C', light = '#B9EE7E';
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0);
    const sq = o.squash || 0; ctx.scale(s * (1 + sq * 0.25), s * (1 - sq * 0.25));
    // back legs
    for (const side of [-1, 1]) {
      const leg = P.ellipse(side * 38, 22, 24, 16, side * 0.4);
      D.sticker(ctx, leg, U.shade(green, -0.15), null, { shadow: false });
    }
    // body
    const body = P.ellipse(0, 0, 56, 44);
    D.sticker(ctx, body, green, { x: -56, y: -44, w: 112, h: 88 });
    // belly
    ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(0, 16, 34, 22, 0, 0, 7); ctx.fill();
    // eye bumps
    for (const side of [-1, 1]) {
      const bump = P.circle(side * 26, -40, 22);
      D.sticker(ctx, bump, green, { x: side * 26 - 22, y: -62, w: 44, h: 44 }, { shadow: false });
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(side * 26, -40, 14, 0, 7); ctx.fill();
    }
    D.eyes(ctx, 0, -40, 9, o.mood || 'normal', o.lookX ?? 0.6, 0, 2.9);
    D.cheeks(ctx, 0, -6, 9, 2);
    D.mouth(ctx, 2, 4, 18, o.mouth || 'smile');
    // front feet
    ctx.fillStyle = U.shade(green, -0.15);
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * 22, 42, 14, 7, 0, 0, 7); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke(); }
    ctx.restore();
  };

  /* Rascal the raccoon (Rooftop Rascal). o: {t, run, mood, rot, scarf} */
  A.raccoon = function (ctx, x, y, s = 1, o = {}) {
    const fur = '#9AA0B5', dark = '#4B4F66', light = '#E9EAF2', scarf = o.scarf || '#FF5A5F';
    const t = o.t || 0;
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s * (o.flip ? -1 : 1), s);
    const sq = o.squash || 0; ctx.scale(1 + sq * 0.2, 1 - sq * 0.2);
    const run = o.run ? Math.sin(t * 16) : 0;
    // tail (striped)
    ctx.save(); ctx.translate(-40, 10); ctx.rotate(-0.6 + Math.sin(t * 5) * 0.15);
    const tail = P.ellipse(-30, 0, 38, 17);
    D.sticker(ctx, tail, fur, null, { shadow: false });
    ctx.save(); ctx.clip(tail); ctx.fillStyle = dark; for (let i = -60; i < 10; i += 18) ctx.fillRect(i, -20, 8, 40); ctx.restore();
    ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.stroke(tail);
    ctx.restore();
    // legs
    ctx.fillStyle = dark;
    for (const [lx, ph] of [[-18, 0], [18, Math.PI]]) {
      const ly = 38 + (o.run ? Math.sin(t * 16 + ph) * 6 : 0);
      ctx.beginPath(); ctx.ellipse(lx + (o.run ? Math.cos(t * 16 + ph) * 6 : 0), ly, 12, 9, 0, 0, 7); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke();
    }
    // body
    const body = P.ellipse(0, 12, 40, 32);
    D.sticker(ctx, body, fur, { x: -40, y: -20, w: 80, h: 64 });
    ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(6, 20, 20, 16, 0, 0, 7); ctx.fill();
    // head
    ctx.save(); ctx.translate(14, -26 + run * 2);
    for (const side of [-1, 1]) { // ears
      const ear = P.poly([[side * 16 - 12, -22], [side * 26, -48], [side * 34 + 4, -16]], true);
      D.sticker(ctx, ear, fur, null, { shadow: false });
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(side * 25, -26, 6, 0, 7); ctx.fill();
    }
    const head = P.ellipse(0, 0, 44, 34);
    D.sticker(ctx, head, fur, { x: -44, y: -34, w: 88, h: 68 }, { shadow: false });
    ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(0, 12, 30, 20, 0, 0, 7); ctx.fill();
    // bandit mask
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(-16, -4, 17, 12, -0.2, 0, 7); ctx.ellipse(16, -4, 17, 12, 0.2, 0, 7); ctx.fill();
    ctx.fillRect(-16, -8, 32, 8);
    ctx.fillStyle = '#fff';
    D.eyes(ctx, 0, -4, 8, o.mood || 'normal', 0.5, 0, 2);
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(0, 10, 7, 5, 0, 0, 7); ctx.fill();
    D.mouth(ctx, 0, 20, 12, o.mouth || 'smile');
    ctx.restore();
    // scarf
    ctx.fillStyle = scarf; ctx.lineWidth = 4; ctx.strokeStyle = C.ink;
    const sc = P.rr(-8, -10, 46, 14, 7); ctx.fill(sc); ctx.stroke(sc);
    ctx.save(); ctx.translate(-6, -4); ctx.rotate(0.5 + Math.sin(t * 9) * 0.25);
    const tl = P.rr(-30, -6, 32, 12, 6); ctx.fill(tl); ctx.stroke(tl); ctx.restore();
    ctx.restore();
  };

  /* Gloop: a sleepy grey goo blob (Ink Rush). o: {t, color, mood, seed} */
  A.gloop = function (ctx, x, y, s = 1, o = {}) {
    const t = o.t || 0, col = o.color || '#9C98AE';
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const wob = Math.sin(t * 5 + (o.seed || 0)) * 0.06;
    ctx.scale(1 + wob, 1 - wob);
    const body = new Path2D();
    body.moveTo(-60, 40); body.quadraticCurveTo(-70, -10, -40, -45); body.quadraticCurveTo(0, -80, 40, -45);
    body.quadraticCurveTo(70, -10, 60, 40); body.quadraticCurveTo(45, 55, 30, 42); body.quadraticCurveTo(15, 58, 0, 44);
    body.quadraticCurveTo(-15, 58, -30, 42); body.quadraticCurveTo(-45, 55, -60, 40); body.closePath();
    D.sticker(ctx, body, col, { x: -60, y: -70, w: 120, h: 120 });
    // drip
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(-34, 52 + Math.sin(t * 3) * 4, 6, 10, 0, 0, 7); ctx.fill();
    D.eyes(ctx, 0, -12, 11, o.mood || 'sleepy', 0, 0, 1.6);
    if (o.mood === 'happy') D.cheeks(ctx, 0, -12, 11, 1.3);
    D.mouth(ctx, 0, 14, 14, o.mouth || (o.mood === 'happy' ? 'grin' : 'flat'));
    ctx.restore();
  };

  /* A go-kart seen from above (Turbo Type). o: {color, t, driver} */
  A.kart = function (ctx, x, y, s = 1, o = {}) {
    const col = o.color || C.turbo;
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s);
    ctx.fillStyle = C.ink;
    for (const [wx, wy] of [[-34, -30], [-34, 30], [34, -32], [34, 32]]) ctx.fill(P.rr(wx - 14, wy - 9, 28, 18, 6));
    const body = new Path2D();
    body.moveTo(-50, -22); body.quadraticCurveTo(-56, 0, -50, 22); body.lineTo(30, 26); body.quadraticCurveTo(62, 14, 64, 0);
    body.quadraticCurveTo(62, -14, 30, -26); body.closePath();
    D.sticker(ctx, body, col, { x: -56, y: -26, w: 120, h: 52 }, { shadowY: 6 });
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill(P.rr(26, -6, 30, 12, 6)); // number plate
    // driver helmet
    const helm = P.circle(-8, 0, 18);
    D.sticker(ctx, helm, o.helmet || '#fff', { x: -26, y: -18, w: 36, h: 36 }, { shadow: false });
    ctx.fillStyle = C.ink; ctx.fill(P.rr(0, -10, 10, 20, 5));
    if (o.flame) { // boost flame
      const f = 0.7 + Math.random() * 0.5;
      ctx.fillStyle = '#FFC83D'; ctx.beginPath(); ctx.moveTo(-54, -12); ctx.quadraticCurveTo(-54 - 60 * f, 0, -54, 12); ctx.fill();
      ctx.fillStyle = '#FF7A1A'; ctx.beginPath(); ctx.moveTo(-54, -7); ctx.quadraticCurveTo(-54 - 34 * f, 0, -54, 7); ctx.fill();
    }
    ctx.restore();
  };

  /* Cleaning ship (Star Sweep), pointing up. */
  A.ship = function (ctx, x, y, s = 1, o = {}) {
    const t = o.t || 0;
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s);
    // flame
    const f = 0.8 + Math.sin(t * 40) * 0.2;
    ctx.fillStyle = '#FFC83D'; ctx.beginPath(); ctx.moveTo(-14, 44); ctx.quadraticCurveTo(0, 44 + 46 * f, 14, 44); ctx.fill();
    ctx.fillStyle = '#FF7A1A'; ctx.beginPath(); ctx.moveTo(-8, 44); ctx.quadraticCurveTo(0, 44 + 26 * f, 8, 44); ctx.fill();
    // wings
    for (const side of [-1, 1]) {
      const wing = P.poly([[side * 18, -6], [side * 62, 30], [side * 58, 46], [side * 16, 36]], true);
      D.sticker(ctx, wing, '#7B5CFF', null, { shadow: false });
    }
    const body = new Path2D();
    body.moveTo(0, -62); body.quadraticCurveTo(34, -30, 28, 30); body.quadraticCurveTo(26, 48, 0, 48); body.quadraticCurveTo(-26, 48, -28, 30); body.quadraticCurveTo(-34, -30, 0, -62); body.closePath();
    D.sticker(ctx, body, '#F4F1FF', { x: -32, y: -62, w: 64, h: 110 });
    const win = P.ellipse(0, -14, 15, 19);
    D.sticker(ctx, win, '#2F9BFF', { x: -15, y: -33, w: 30, h: 38 }, { shadow: false, lw: 4 });
    // mini Kip face in the window
    D.eyes(ctx, 0, -14, 4, 'normal', 0, -0.3, 1.5);
    ctx.restore();
  };

  /* Space junk with a grumpy face (Star Sweep). kind: can | box | rock | sock */
  A.junk = function (ctx, x, y, r, o = {}) {
    const t = o.t || 0, kind = o.kind || 'rock', col = o.color || '#B8B2CC';
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0);
    let path, box;
    if (kind === 'can') { path = P.rr(-r * 0.6, -r * 0.85, r * 1.2, r * 1.7, r * 0.25); box = { x: -r * 0.6, y: -r * 0.85, w: r * 1.2, h: r * 1.7 }; }
    else if (kind === 'box') { path = P.rr(-r * 0.85, -r * 0.75, r * 1.7, r * 1.5, r * 0.22); box = { x: -r * 0.85, y: -r * 0.75, w: r * 1.7, h: r * 1.5 }; }
    else { path = P.blob(0, 0, r, o.seed || 1, 0.14, 9); box = { x: -r, y: -r, w: 2 * r, h: 2 * r }; }
    D.sticker(ctx, path, col, box);
    if (kind === 'can') { ctx.fillStyle = 'rgba(31,26,61,0.18)'; ctx.fillRect(-r * 0.6, -r * 0.3, r * 1.2, r * 0.25); }
    if (kind === 'rock') { ctx.fillStyle = 'rgba(31,26,61,0.15)'; ctx.beginPath(); ctx.arc(r * 0.35, r * 0.3, r * 0.18, 0, 7); ctx.arc(-r * 0.4, -r * 0.35, r * 0.12, 0, 7); ctx.fill(); }
    ctx.rotate(-(o.rot || 0));
    D.eyes(ctx, 0, -r * 0.08, r * 0.17, o.mood || 'grumpy', 0, 0.4, 1.5);
    D.mouth(ctx, 0, r * 0.3, r * 0.2, o.mood === 'happy' ? 'smile' : 'frown');
    ctx.restore();
  };

  /* Fruit and veg (Word Ninja). kind: apple|orange|melon|banana|pear|grape|tomato|peach|watermelon */
  const FRUIT = {
    apple: { c: '#FF5A5F', r: 1, leaf: true }, orange: { c: '#FF9A1F', r: 1, dots: true }, peach: { c: '#FFA38F', r: 1, leaf: true, cleft: true },
    melon: { c: '#B8E06A', r: 1.25, net: true }, watermelon: { c: '#2BB673', r: 1.4, stripes: true }, tomato: { c: '#FF3D3D', r: 0.95, star: true },
    lemon: { c: '#FFE14D', r: 0.95, oval: true }, plum: { c: '#8A4FD8', r: 0.9, leaf: true }, kiwi: { c: '#9C7A4A', r: 0.9, oval: true },
  };
  A.fruitKinds = Object.keys(FRUIT);
  A.fruit = function (ctx, x, y, r, o = {}) {
    const f = FRUIT[o.kind] || FRUIT.apple, rr = r * f.r;
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0);
    const path = f.oval ? P.ellipse(0, 0, rr * 1.15, rr * 0.9) : P.blob(0, 0, rr, o.seed || 2, 0.05, 8);
    if (o.half) { // sliced half: draw only one side with flesh
      ctx.save(); ctx.beginPath(); ctx.rect(o.half < 0 ? -rr * 2 : 0, -rr * 2, rr * 2, rr * 4); ctx.clip();
    }
    D.sticker(ctx, path, f.c, { x: -rr, y: -rr, w: rr * 2, h: rr * 2 });
    if (f.stripes) { ctx.save(); ctx.clip(path); ctx.strokeStyle = '#1D8A55'; ctx.lineWidth = rr * 0.16; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(i * rr * 0.42, 0, rr * 0.12, rr, 0, 0, 7); ctx.stroke(); } ctx.restore(); ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.stroke(path); }
    if (f.net) { ctx.save(); ctx.clip(path); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * rr * 0.35 - rr, -rr); ctx.lineTo(i * rr * 0.35 + rr, rr); ctx.moveTo(i * rr * 0.35 + rr, -rr); ctx.lineTo(i * rr * 0.35 - rr, rr); ctx.stroke(); } ctx.restore(); }
    if (f.dots) { ctx.fillStyle = 'rgba(31,26,61,0.12)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 2.1) * rr * 0.5, Math.sin(i * 2.1) * rr * 0.5, 3, 0, 7); ctx.fill(); } }
    if (f.cleft) { ctx.strokeStyle = 'rgba(31,26,61,0.3)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -rr * 0.9); ctx.quadraticCurveTo(rr * 0.3, 0, 0, rr * 0.7); ctx.stroke(); }
    if (f.leaf && !o.half) { const leaf = P.ellipse(rr * 0.3, -rr * 1.02, rr * 0.3, rr * 0.13, -0.5); D.sticker(ctx, leaf, '#2BB673', null, { shadow: false, lw: 4 }); ctx.fillStyle = C.ink; ctx.fillRect(-3, -rr * 1.15, 6, rr * 0.3); }
    if (f.star && !o.half) { D.sticker(ctx, P.star(0, -rr * 0.85, rr * 0.3, 0.45), '#2BB673', null, { shadow: false, lw: 4 }); }
    if (o.half) {
      ctx.restore();
      // flesh on the cut face
      ctx.fillStyle = o.kind === 'watermelon' ? '#FF5A6E' : o.kind === 'kiwi' ? '#8BD448' : o.kind === 'orange' ? '#FFC36B' : '#FFF4CF';
      ctx.beginPath(); ctx.ellipse(0, 0, rr * 0.18, rr * 0.85, 0, 0, 7); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke();
    } else if (o.face !== false) {
      D.eyes(ctx, 0, -rr * 0.05, rr * 0.16, o.mood || 'normal', 0, 0, 1.5);
      D.cheeks(ctx, 0, -rr * 0.05, rr * 0.16, 1.4);
      D.mouth(ctx, 0, rr * 0.28, rr * 0.2, o.mouth || 'smile');
    }
    ctx.restore();
  };

  TM.art = A;
})();
