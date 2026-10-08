/* Rooftop Rascal - rig.js
   Characters drawn in code in the shared chunky-sticker style:
   Rascal the raccoon (a full animated rig), the security pigeons, the sleepy night-watchman cat, crows, hats.
   Everything faces +x, origin at the feet. */
(function () {
  'use strict';
  const TM = window.TM, C = TM.C, U = TM.U, D = TM.draw, P = D.P;
  const RR = (window.RR = window.RR || {});
  const INK = C.ink, TAU = Math.PI * 2;
  const clamp = U.clamp, lerp = U.lerp;

  /* ---------------- tiny helpers ---------------- */
  function ik(ax, ay, tx, ty, l1, l2, bend) {
    let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy);
    const max = l1 + l2 - 0.5;
    if (d > max) { const k = max / d; dx *= k; dy *= k; d = max; tx = ax + dx; ty = ay + dy; }
    if (d < 6) { d = 6; }
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ux = dx / d, uy = dy / d;
    return [[ax, ay], [ax + ux * a - bend * uy * h, ay + uy * a + bend * ux * h], [tx, ty]];
  }
  function strokePts(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
  function limb(ctx, pts, w, color) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = w + 9; strokePts(ctx, pts);
    ctx.strokeStyle = color; ctx.lineWidth = w; strokePts(ctx, pts);
  }
  function rot2(x, y, a) { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; }
  const ell = (ctx, x, y, rx, ry, rot, fill) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU); ctx.fillStyle = fill; ctx.fill(); };

  /* ---------------- palette ---------------- */
  const FUR = '#8E95B0', FUR_D = '#454866', FUR_L = '#F2F0F8', EAR_IN = '#F0A6BC', FUR_SH = '#7A819E';

  /* ---------------- poses ---------------- */
  const BASE = {
    hipX: 0, hipY: 0, tRot: 0, hRot: 0, hdx: 0, hdy: 0,
    fF: [14, 0], fB: [-8, 0], hF: [6, 28], hB: [0, 28],
    tailA: -2.55, tailCurl: 0.7, tailSway: 0.25, tailWv: 5,
    eyes: 'normal', mouth: 'smile', look: 0.5, lookY: 0, wind: 0.3, hairs: 0,
  };
  const NUM = ['hipX', 'hipY', 'tRot', 'hRot', 'hdx', 'hdy', 'tailA', 'tailCurl', 'tailSway', 'tailWv', 'look', 'lookY', 'wind'];
  const VEC = ['fF', 'fB', 'hF', 'hB'];
  function mk(o) { return Object.assign({}, BASE, o); }
  function blend(a, b, t) {
    const r = Object.assign({}, t < 0.5 ? a : b);
    for (const k of NUM) r[k] = lerp(a[k], b[k], t);
    for (const k of VEC) r[k] = [lerp(a[k][0], b[k][0], t), lerp(a[k][1], b[k][1], t)];
    return r;
  }
  const sm = (t) => t * t * (3 - 2 * t);

  const POSE = {
    idle(t) {
      return mk({ hipY: Math.sin(t * 2.4) * 1.3, tailSway: 0.18, tailWv: 2.2, look: Math.sin(t * 0.8) * 0.8, hF: [4, 28 + Math.sin(t * 2.4) * 1.5], hB: [-2, 28] });
    },
    wait(t) { // stalled: impatient foot tapping, glancing back
      const tap = Math.max(0, Math.sin(t * 10)) * 9;
      return mk({ hipY: Math.sin(t * 3) * 1.2, fF: [16, -tap], tRot: 0.05, hRot: -0.08, hdx: -2, tailSway: 0.35, tailWv: 7, eyes: 'wide', mouth: Math.sin(t * 3) > 0 ? 'o' : 'flat', look: -0.9,
        hF: [20, 18], hB: [14, 14] });
    },
    run(ph, sprint) {
      const s = Math.sin(ph), c = Math.cos(ph), s2 = Math.sin(ph + Math.PI), c2 = Math.cos(ph + Math.PI);
      const sp = sprint || 0;
      return mk({
        hipY: 5 - Math.abs(s) * 9, tRot: 0.2 + sp * 0.12, hRot: -0.1 - sp * 0.05,
        fF: [10 + s * 26, -Math.max(0, c) * 16], fB: [-6 + s2 * 26, -Math.max(0, c2) * 16],
        hF: [12 + s2 * 20, 20 - Math.max(0, c2) * 12], hB: [4 + s * 20, 20 - Math.max(0, c) * 12],
        tailA: -2.75 - sp * 0.15, tailCurl: 0.3, tailSway: 0.35, tailWv: 11, look: 0.9, mouth: 'smile', wind: 0.6 + sp * 0.4,
      });
    },
    air(vy) { // vy: -1 rising ... +1 falling
      const rise = mk({ tRot: 0.12, hRot: -0.1, fF: [22, -34], fB: [-28, -16], hF: [32, -32], hB: [22, -42], tailA: -2.45, tailCurl: 0.2, tailSway: 0.2, eyes: 'wide', mouth: 'grin', hipY: -4, wind: 0.9 });
      const apex = mk({ tRot: 0.35, hRot: -0.25, fF: [24, -32], fB: [8, -26], hF: [28, 0], hB: [20, 6], hipY: 2, tailA: -2.2, tailCurl: 0.9, tailSway: 0.3, eyes: 'wide', mouth: 'grin', wind: 0.5 });
      const fall = mk({ tRot: 0.05, hRot: -0.05, fF: [28, -6], fB: [4, -16], hF: [34, -30], hB: [12, -44], tailA: -2.2, tailCurl: 0.2, tailSway: 0.3, eyes: 'wide', mouth: 'o', look: 0.9, hipY: -2, wind: 0.8 });
      const u = clamp((vy + 1) / 2, 0, 1);
      return u < 0.4 ? blend(rise, apex, sm(u / 0.4)) : blend(apex, fall, sm((u - 0.4) / 0.6));
    },
    tuck(t) { return mk({ tRot: 0.5, hRot: -0.5, fF: [22, -34], fB: [6, -30], hF: [24, -2], hB: [16, 4], hipY: 4, tailA: -2.0, tailCurl: 1.2, tailSway: 0.1, eyes: 'happy', mouth: 'grin' }); },
    slide(t) {
      return mk({ tRot: -1.3, hRot: 1.25, hipY: 26, hdx: 2, fF: [58, -14], fB: [40, -6], hF: [-22, -4], hB: [-30, 4], tailA: -3.05, tailCurl: 0.2, tailSway: 0.12, tailWv: 12, eyes: 'cool', mouth: 'grin', look: 1, wind: 1 });
    },
    climb(ph) {
      const s = Math.sin(ph);
      return mk({ tRot: 0.1, hRot: -0.1, hipY: 4, fF: [26, -22 + s * 16], fB: [24, -40 - s * 16], hF: [34, -34 + s * 26], hB: [28, -34 - s * 26], tailA: 2.45, tailCurl: -0.3, tailSway: 0.3, tailWv: 6, eyes: 'determined', mouth: 'o', look: 0.4, lookY: -0.8 });
    },
    cling(t) { return mk({ tRot: 0.12, hRot: -0.1, hipY: 10, fF: [30, -22], fB: [28, -46], hF: [32, -22], hB: [30, -36], tailA: 2.3, tailCurl: -0.3, eyes: 'determined', mouth: 'o' }); },
    sneak(ph) {
      const s = Math.sin(ph), c = Math.cos(ph), s2 = Math.sin(ph + Math.PI), c2 = Math.cos(ph + Math.PI);
      return mk({
        hipY: 24 + Math.abs(s) * -3, tRot: 0.6, hRot: -0.45, hdx: 6, hdy: 6,
        fF: [14 + s * 16, -Math.max(0, c) * 12], fB: [-10 + s2 * 16, -Math.max(0, c2) * 12],
        hF: [32, -2], hB: [20, 14], tailA: -3.0, tailCurl: 0.15, tailSway: 0.2, tailWv: 3, eyes: 'wide', mouth: 'o', look: 1, lookY: 0.2,
      });
    },
    tumble(t) { return mk({ tRot: 0.2, hF: [30 + Math.sin(t * 20) * 8, -30], hB: [24, -40 + Math.sin(t * 20) * 10], fF: [20, -26 + Math.sin(t * 17) * 10], fB: [-8, -30], eyes: 'dizzy', mouth: 'o', tailSway: 0.6, tailWv: 14, hipY: -6 }); },
    dance(t) {
      const b = Math.sin(t * 7), s = Math.sin(t * 14);
      return mk({
        hipX: b * 5, hipY: -Math.abs(Math.sin(t * 7)) * 12, tRot: b * 0.14, hRot: -b * 0.12,
        fF: [10 + b * 8, -Math.max(0, s) * 10], fB: [-8 + b * 8, -Math.max(0, -s) * 10],
        hF: [16 + Math.sin(t * 9) * 8, -44 + Math.sin(t * 9 + 1) * 10], hB: [6 + Math.sin(t * 9 + 2) * 8, -48 + Math.sin(t * 9 + 3) * 10],
        tailA: -2.2 + b * 0.25, tailCurl: 0.9, tailSway: 0.6, tailWv: 9, eyes: 'happy', mouth: 'grin', wind: 0.1,
      });
    },
    cheer(t) {
      return mk({ hipY: Math.sin(t * 12) * 2, hF: [16, -50], hB: [4, -52], fF: [12, 0], fB: [-8, 0], eyes: 'happy', mouth: 'grin', tailSway: 0.5, tailWv: 10, tailA: -2.2, tailCurl: 0.9 });
    },
    zip(t) {
      const s = Math.sin(t * 5);
      return mk({ tRot: -0.12 + s * 0.05, hipY: 0, hF: [14, -44], hB: [26, -46], fF: [16 + s * 8, -12], fB: [-6 - s * 6, -6], tailA: -2.9, tailCurl: 0.2, tailSway: 0.4, tailWv: 9, eyes: 'happy', mouth: 'grin', wind: 1 });
    },
    crouch(t) { return mk({ tRot: 0.55, hRot: -0.35, hipY: 22, hdx: 4, hdy: 4, fF: [16, 0], fB: [-6, 0], hF: [-20, 6], hB: [-26, 12], tailA: -2.9, tailCurl: 0.3, tailSway: 0.1, eyes: 'determined', mouth: 'grin', look: 1 }); },
    skid(t) { return mk({ tRot: -0.3, hRot: 0.2, hipY: 8, fF: [38, -2], fB: [18, -2], hF: [30, -20 + Math.sin(t * 30) * 8], hB: [24, -26 - Math.sin(t * 30) * 8], eyes: 'wide', mouth: 'o', tailA: -2.2, tailCurl: 0.2, wind: 0 }); },
  };

  /* ---------------- hats (drawn in head space; head centre = origin, ears around y -26) ---------------- */
  const HATS = {
    none: null,
    cap(ctx) {
      ctx.save(); ctx.rotate(-0.08);
      const dome = new Path2D(); dome.moveTo(-26, -14); dome.quadraticCurveTo(-22, -52, 8, -50); dome.quadraticCurveTo(34, -48, 34, -14); dome.closePath();
      D.sticker(ctx, dome, '#E8423F', { x: -26, y: -50, w: 60, h: 36 }, { shadow: false, lw: 4.5 });
      D.sticker(ctx, P.rr(10, -22, 46, 10, 5), '#C73431', null, { shadow: false, lw: 4.5 }); // brim
      ell(ctx, 4, -50, 4, 4, 0, '#fff'); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.restore();
    },
    beanie(ctx) {
      ctx.save(); ctx.rotate(-0.12);
      const dome = new Path2D(); dome.moveTo(-28, -12); dome.quadraticCurveTo(-26, -56, 6, -56); dome.quadraticCurveTo(36, -56, 34, -12); dome.closePath();
      D.sticker(ctx, dome, '#2F9BFF', { x: -28, y: -56, w: 62, h: 44 }, { shadow: false, lw: 4.5 });
      ctx.save(); ctx.clip(dome); ctx.fillStyle = '#fff'; for (let x = -24; x < 40; x += 18) ctx.fillRect(x, -60, 8, 60); ctx.restore();
      ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke(dome);
      D.sticker(ctx, P.rr(-30, -20, 66, 12, 6), '#1C6FC4', null, { shadow: false, lw: 4.5 });
      D.sticker(ctx, P.circle(3, -60, 9), '#FFC83D', null, { shadow: false, lw: 4 });
      ctx.restore();
    },
    headphones(ctx) {
      ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 15; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(2, -4, 33, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.strokeStyle = '#FF3EA5'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(2, -4, 33, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      D.sticker(ctx, P.rr(-4, -2, 22, 30, 9), '#FF3EA5', null, { shadow: false, lw: 4.5 });
      ctx.restore();
    },
    party(ctx) {
      ctx.save(); ctx.rotate(-0.2);
      const cone = P.poly([[-18, -20], [6, -78], [30, -20]], false);
      D.sticker(ctx, cone, '#FF3EA5', { x: -18, y: -78, w: 48, h: 58 }, { shadow: false, lw: 4.5 });
      ctx.save(); ctx.clip(cone); ctx.fillStyle = '#FFE14D'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-4 + i * 8, -34 - i * 8 + (i % 2) * 12, 4, 0, TAU); ctx.fill(); } ctx.restore();
      ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke(cone);
      D.sticker(ctx, P.circle(6, -80, 8), '#7B5CFF', null, { shadow: false, lw: 4 });
      ctx.restore();
    },
    chef(ctx) {
      ctx.save(); ctx.rotate(-0.06);
      D.sticker(ctx, P.rr(-20, -30, 50, 16, 5), '#fff', null, { shadow: false, lw: 4.5 });
      const puff = new Path2D(); puff.arc(-14, -44, 16, 0, TAU); puff.arc(6, -56, 20, 0, TAU); puff.arc(26, -42, 16, 0, TAU); puff.rect(-18, -44, 46, 18);
      D.sticker(ctx, puff, '#fff', { x: -30, y: -76, w: 70, h: 56 }, { shadow: false, lw: 4.5 });
      ctx.restore();
    },
    tophat(ctx) {
      ctx.save(); ctx.rotate(-0.1);
      D.sticker(ctx, P.rr(-30, -26, 70, 12, 6), '#2A2750', null, { shadow: false, lw: 4.5 });
      D.sticker(ctx, P.rr(-16, -72, 42, 50, 6), '#2A2750', { x: -16, y: -72, w: 42, h: 50 }, { shadow: false, lw: 4.5 });
      ctx.fillStyle = '#FF5A5F'; ctx.fillRect(-14, -40, 38, 9);
      ctx.restore();
    },
    crown(ctx) {
      ctx.save(); ctx.rotate(-0.1);
      const cr = P.poly([[-20, -22], [-24, -56], [-8, -40], [6, -62], [20, -40], [36, -56], [32, -22]], false);
      D.sticker(ctx, cr, '#FFC83D', { x: -24, y: -62, w: 60, h: 40 }, { shadow: false, lw: 4.5 });
      ell(ctx, 6, -34, 5, 5, 0, '#FF5A5F'); ell(ctx, -10, -30, 3.5, 3.5, 0, '#2F9BFF'); ell(ctx, 22, -30, 3.5, 3.5, 0, '#2BB673');
      ctx.restore();
    },
  };
  RR.HATS = [
    { id: 'none', name: 'No hat', cost: 0 },
    { id: 'cap', name: 'Red cap', cost: 15 },
    { id: 'beanie', name: 'Blue beanie', cost: 40 },
    { id: 'headphones', name: 'Headphones', cost: 80 },
    { id: 'party', name: 'Party hat', cost: 130 },
    { id: 'chef', name: 'Chef hat', cost: 200 },
    { id: 'tophat', name: 'Top hat', cost: 300 },
    { id: 'crown', name: 'Golden crown', cost: 450 },
  ];
  RR.drawHat = function (ctx, id) { const f = HATS[id]; if (f) f(ctx); };

  /* ---------------- the raccoon ---------------- */
  /* st: {pose (a pose object), t, rot, flip, squash, hat, scarf, alpha, shadow} */
  RR.pose = POSE;
  RR.blend = blend;

  function eyeDraw(ctx, x, y, mood, look, lookY, blink, size) {
    const sc = size || 1;
    if (blink && mood !== 'dizzy' && mood !== 'happy') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 7 * sc, y); ctx.lineTo(x + 7 * sc, y); ctx.stroke(); return; }
    if (mood === 'happy') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y + 4, 7.5 * sc, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke(); return; }
    if (mood === 'dizzy') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); for (let a = 0; a < 9; a += 0.4) { const r = a * 1.1 * sc; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); return; }
    const wide = mood === 'wide' || mood === 'scared';
    const rx = (wide ? 9.5 : 8.5) * sc, ry = (wide ? 12 : 10.5) * sc;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.clip();
    const pr = mood === 'scared' ? 3.4 : 5.2;
    const px = x + look * 3.2, py = y + lookY * 3 + 0.5;
    ctx.beginPath(); ctx.ellipse(px, py, pr * sc, (pr + 2.2) * sc, 0, 0, TAU); ctx.fillStyle = '#16122E'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - 1.8, py - 3.2, 2.1 * sc, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(px + 2, py + 2.4, 1 * sc, 0, TAU); ctx.fill();
    if (mood === 'determined' || mood === 'cool') { ctx.fillStyle = FUR_D; ctx.beginPath(); ctx.moveTo(x - rx - 2, y - ry - 2); ctx.lineTo(x + rx + 2, y - ry - 2); ctx.lineTo(x + rx + 2, y - ry * 0.35); ctx.lineTo(x - rx - 2, y - ry * (mood === 'cool' ? 0.1 : 0.55)); ctx.fill(); }
    if (mood === 'sleepy') { ctx.fillStyle = FUR_D; ctx.fillRect(x - rx - 2, y - ry - 2, rx * 2 + 4, ry * 1.15); }
    ctx.restore();
  }

  function mouthDraw(ctx, kind, tt) {
    // mouth sits under the snout, in head space
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
    if (kind === 'smile') { ctx.beginPath(); ctx.arc(30, 10, 8, 0.2, Math.PI * 0.75); ctx.stroke(); }
    else if (kind === 'smirk') { ctx.beginPath(); ctx.moveTo(22, 15); ctx.quadraticCurveTo(32, 20, 41, 11); ctx.stroke(); }
    else if (kind === 'flat') { ctx.beginPath(); ctx.moveTo(24, 16); ctx.lineTo(38, 16); ctx.stroke(); }
    else if (kind === 'o') { ell(ctx, 32, 17, 5, 6.5, 0, INK); ell(ctx, 32, 19, 3, 3, 0, '#E86A82'); }
    else if (kind === 'grin') {
      const m = new Path2D(); m.moveTo(19, 11); m.quadraticCurveTo(31, 14, 43, 9); m.quadraticCurveTo(40, 27, 29, 26); m.quadraticCurveTo(21, 24, 19, 11); m.closePath();
      ctx.fillStyle = '#3A1630'; ctx.fill(m); ctx.stroke(m);
      ctx.save(); ctx.clip(m); ell(ctx, 30, 27, 9, 6, 0, '#F0708A'); ctx.fillStyle = '#fff'; ctx.fillRect(21, 8, 20, 4.5); ctx.restore();
    }
    ctx.restore();
  }

  function tailDraw(ctx, root, st, p, t) {
    const n = 9, seg = 8.2;
    const pts = [];
    let x = root[0], y = root[1], a = p.tailA;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      a = p.tailA + p.tailCurl * f + Math.sin(t * p.tailWv - i * 0.55) * p.tailSway * f;
      x += Math.cos(a) * seg; y += Math.sin(a) * seg;
      pts.push([x, y, 11.5 - f * 2.5 + Math.sin(f * 3.1) * 2.2]);
    }
    // outline pass then ring pass
    ctx.fillStyle = INK;
    for (let i = 0; i < n; i++) { const q = pts[i]; ctx.beginPath(); ctx.arc(q[0], q[1], q[2] + 4, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.arc(root[0], root[1], 12, 0, TAU); ctx.fill();
    for (let i = n - 1; i >= 0; i--) {
      const q = pts[i];
      const ring = i >= n - 2 ? FUR_D : (Math.floor(i / 2) % 2 === 0 ? FUR : FUR_D);
      ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(q[0], q[1], q[2], 0, TAU); ctx.fill();
      if (ring === FUR) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(q[0] - 2, q[1] - 4, q[2] * 0.55, 0, TAU); ctx.fill(); }
    }
    ctx.fillStyle = FUR; ctx.beginPath(); ctx.arc(root[0], root[1], 10, 0, TAU); ctx.fill();
  }

  RR.raccoon = function (ctx, x, y, s, st) {
    const p = st.pose || POSE.idle(st.t || 0), t = st.t || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * (st.flip ? -1 : 1), s);
    if (st.alpha != null && st.alpha < 1) ctx.globalAlpha = st.alpha;
    // body rotation (flips etc.) around the hip
    const hipy = -42 + p.hipY, hipx = p.hipX;
    ctx.translate(0, hipy); ctx.rotate(st.rot || 0);
    const sq = st.squash || 0; ctx.scale(1 + sq * 0.22, 1 - sq * 0.22);
    ctx.translate(0, -hipy);
    ctx.lineJoin = 'round';

    const Hp = [hipx, hipy], tr = p.tRot;
    const R = (vx, vy, a) => { const r = rot2(vx, vy, a === undefined ? tr : a); return [Hp[0] + r[0], Hp[1] + r[1]]; };
    const S = R(13, -30);                       // shoulder
    const tailRoot = R(-27, -10);
    const blink = ((t + 0.9) % 3.8) < 0.13;
    const headC = (() => { const r = rot2(11 + p.hdx, -22 + p.hdy, tr); return [S[0] + r[0], S[1] + r[1]]; })();
    const headRot = tr * 0.55 + p.hRot;

    // --- back tail
    tailDraw(ctx, tailRoot, st, p, t);

    // --- back limbs
    const hipB = R(-12, 2), hipF = R(12, 2);
    const legB = ik(hipB[0], hipB[1], hipx + p.fB[0], p.fB[1], 20, 21, -1);
    const legF = ik(hipF[0], hipF[1], hipx + p.fF[0], p.fF[1], 20, 21, -1);
    const shB = [S[0] - 7, S[1] + 4], shF = [S[0] + 1, S[1] + 2];
    const armB = ik(shB[0], shB[1], shB[0] + p.hB[0], shB[1] + p.hB[1], 17, 17, 1);
    const armF = ik(shF[0], shF[1], shF[0] + p.hF[0], shF[1] + p.hF[1], 17, 17, 1);
    limb(ctx, legB, 12, FUR_SH); paw(ctx, legB[2], 10);
    limb(ctx, armB, 10, FUR_SH); paw(ctx, armB[2], 8);

    // --- body
    ctx.save(); ctx.translate(Hp[0], Hp[1]); ctx.rotate(tr);
    const body = P.ellipse(2, -15, 30, 25);
    D.sticker(ctx, body, FUR, { x: -28, y: -40, w: 60, h: 50 }, { shadow: false, lw: 5 });
    ctx.save(); ctx.clip(body);
    ell(ctx, 10, -6, 20, 19, 0, FUR_L);
    ctx.strokeStyle = 'rgba(69,72,102,0.35)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-26 + i * 5, -34 + i * 7); ctx.quadraticCurveTo(-18 + i * 3, -26 + i * 8, -24 + i * 5, -14 + i * 9); ctx.stroke(); }
    ctx.restore();
    ctx.restore();

    // --- head
    ctx.save(); ctx.translate(headC[0], headC[1]); ctx.rotate(headRot);
    // far ear, near ear
    for (const e of [[-13, -24, -0.35, 0.92], [13, -28, 0.1, 1]]) {
      ctx.save(); ctx.translate(e[0], e[1]); ctx.rotate(e[2]); ctx.scale(e[3], e[3]);
      const ear = new Path2D(); ear.moveTo(-13, 4); ear.quadraticCurveTo(-12, -22, 2, -26); ear.quadraticCurveTo(15, -20, 13, 4); ear.closePath();
      D.sticker(ctx, ear, FUR, null, { shadow: false, lw: 4.5 });
      const inner = new Path2D(); inner.moveTo(-6, 0); inner.quadraticCurveTo(-6, -14, 2, -17); inner.quadraticCurveTo(8, -13, 7, 0); inner.closePath();
      ctx.fillStyle = EAR_IN; ctx.fill(inner);
      ctx.restore();
    }
    // fur ruff behind cheek
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-34, 6); ctx.lineTo(-44, 14); ctx.lineTo(-30, 18); ctx.lineTo(-34, 26); ctx.lineTo(-18, 24); ctx.fill();
    ctx.fillStyle = FUR_L; ctx.beginPath(); ctx.moveTo(-32, 8); ctx.lineTo(-40, 14); ctx.lineTo(-29, 17); ctx.lineTo(-31, 23); ctx.lineTo(-20, 22); ctx.fill();
    const head = P.ellipse(0, 0, 35, 29);
    D.sticker(ctx, head, FUR, { x: -35, y: -29, w: 70, h: 58 }, { shadow: false, lw: 5 });
    ctx.save(); ctx.clip(head);
    ell(ctx, 14, 16, 32, 15, 0, FUR_L);                 // pale jaw
    // forehead stripe + mask
    ctx.fillStyle = FUR_D;
    ctx.beginPath(); ctx.moveTo(10, -30); ctx.lineTo(24, -30); ctx.quadraticCurveTo(22, -14, 19, -6); ctx.quadraticCurveTo(14, -14, 10, -30); ctx.fill();
    ell(ctx, 5, -2, 15, 12.5, 0.2, FUR_D); ell(ctx, 27, -2, 16, 12.5, -0.2, FUR_D); ell(ctx, 16, -5, 20, 6, 0, FUR_D);
    ctx.restore();
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(head);
    // snout
    const snout = P.ellipse(31, 8, 19, 13);
    ctx.fillStyle = FUR_L; ctx.fill(snout); ctx.lineWidth = 4.5; ctx.stroke(snout);
    ell(ctx, 46, 3, 6.5, 5, 0, '#2A2342'); ell(ctx, 44.5, 1.3, 2.2, 1.5, 0, 'rgba(255,255,255,0.7)');
    mouthDraw(ctx, st.mouth || p.mouth, t);
    // cheeks
    ctx.fillStyle = 'rgba(255,110,140,0.35)'; ctx.beginPath(); ctx.ellipse(10, 14, 7, 4, 0, 0, TAU); ctx.fill();
    // eyes
    const mood = st.eyes || p.eyes;
    eyeDraw(ctx, 6, -3, mood, p.look * 0.9, p.lookY, blink, 0.88);
    eyeDraw(ctx, 27, -3, mood, p.look, p.lookY, blink, 1);
    if (mood === 'determined') { ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-3, -16); ctx.lineTo(13, -10); ctx.moveTo(35, -17); ctx.lineTo(19, -11); ctx.stroke(); }
    // whiskers
    ctx.strokeStyle = 'rgba(31,26,61,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(40, 9); ctx.lineTo(58, 4 + Math.sin(t * 6) * 1.5); ctx.moveTo(40, 12); ctx.lineTo(57, 15); ctx.stroke();
    // hat
    if (st.hat && st.hat !== 'none') RR.drawHat(ctx, st.hat);
    ctx.restore();

    // --- scarf (bandana) + tails
    {
      const sc = st.scarf || '#FF5A5F', wind = p.wind;
      const base = [S[0] + 2, S[1] - 2];
      const a0 = tr * 0.5;
      ctx.save(); ctx.translate(base[0], base[1]); ctx.rotate(a0);
      for (const side of [0, 1]) {
        ctx.save(); ctx.translate(-12, 2 + side * 4); ctx.rotate(-0.1 - wind * 0.35 + Math.sin(t * 13 + side * 1.6) * 0.18 * wind + side * 0.22);
        const tl = new Path2D(); tl.moveTo(0, -6); tl.quadraticCurveTo(-18, -9 + Math.sin(t * 9 + side) * 4, -(38 - side * 8), -4 + Math.sin(t * 11 + side) * 5); tl.quadraticCurveTo(-18, 6, 0, 6); tl.closePath();
        ctx.fillStyle = side ? U.shade(sc, -0.15) : sc; ctx.fill(tl); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(tl);
        ctx.restore();
      }
      const band = P.rr(-14, -9, 36, 17, 8);
      ctx.fillStyle = sc; ctx.fill(band); ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke(band);
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-6 + i * 11, 0, 2.2, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    // --- front limbs
    limb(ctx, legF, 12.5, FUR_D); paw(ctx, legF[2], 10.5);
    limb(ctx, armF, 10.5, FUR_D); paw(ctx, armF[2], 8.5);
    ctx.restore();
  };
  function paw(ctx, pt, r) {
    ctx.beginPath(); ctx.ellipse(pt[0] + 2, pt[1], r, r * 0.8, 0, 0, TAU); ctx.fillStyle = '#2A2342'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pt[0] + 4, pt[1] - r * 0.5); ctx.lineTo(pt[0] + 4, pt[1] + r * 0.4); ctx.stroke();
  }

  /* ---------------- pigeons (security squad), seagulls etc ---------------- */
  /* o: {t, flap (0..1 speed), body, wing, cap, torch (bool), mood: grumpy|sleepy|happy|oops, beak, ph} faces +x */
  RR.pigeon = function (ctx, x, y, s, o) {
    o = o || {};
    const t = (o.t || 0) + (o.ph || 0), body = o.body || '#A9AEC8', wing = o.wing || '#7F85A6', cap = o.cap || '#2F4A9A';
    const fl = Math.sin(t * (o.flapSpeed || 16));
    ctx.save(); ctx.translate(x, y + Math.sin(t * 5) * 4 * s); ctx.scale(s * (o.dir === -1 ? -1 : 1), s);
    if (o.rot) ctx.rotate(o.rot);
    // far wing
    ctx.save(); ctx.translate(-6, -12); ctx.rotate(-0.5 - fl * 0.7);
    D.sticker(ctx, P.ellipse(-20, -6, 36, 14), U.shade(wing, -0.12), null, { shadow: false, lw: 4 });
    ctx.restore();
    // tail feathers
    ctx.save(); ctx.translate(-38, 8); ctx.rotate(0.35 + fl * 0.08);
    D.sticker(ctx, P.rr(-32, -7, 36, 15, 7), wing, null, { shadow: false, lw: 4 });
    ctx.restore();
    // feet
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6, 26); ctx.lineTo(-10, 38 + Math.sin(t * 9) * 3); ctx.moveTo(8, 26); ctx.lineTo(10, 38 - Math.sin(t * 9) * 3); ctx.stroke();
    ctx.strokeStyle = '#F08A5D'; ctx.lineWidth = 2.5; ctx.stroke();
    // body
    const b = P.ellipse(0, 4, 42, 30);
    D.sticker(ctx, b, body, { x: -42, y: -26, w: 84, h: 60 }, { shadow: false, lw: 5 });
    ctx.save(); ctx.clip(b); ell(ctx, 8, 18, 30, 16, 0, U.shade(body, 0.35)); ctx.restore();
    // neck sheen
    ell(ctx, 26, -8, 12, 10, 0.3, o.sheen || '#58C7A5');
    // head
    const hd = P.circle(34, -22, 22);
    D.sticker(ctx, hd, body, { x: 12, y: -44, w: 44, h: 44 }, { shadow: false, lw: 5 });
    // beak
    ctx.fillStyle = o.beak || '#FFB347'; ctx.beginPath(); ctx.moveTo(52, -26); ctx.lineTo(72, -19 + (o.mood === 'oops' ? 4 : 0)); ctx.lineTo(52, -14); ctx.closePath(); ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
    // eye + brow
    const mood = o.mood || 'grumpy';
    if (mood === 'sleepy') { ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(42, -26, 5, 0.2, Math.PI - 0.2); ctx.stroke(); }
    else {
      ell(ctx, 42, -26, 7, 8, 0, '#fff'); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ell(ctx, 44 + (o.look || 0), -25, 3.6, 4.6, 0, '#16122E');
      if (mood === 'grumpy') { ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(34, -38); ctx.lineTo(50, -32); ctx.stroke(); }
      if (mood === 'oops') { ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(36, -36); ctx.lineTo(48, -38); ctx.stroke(); }
    }
    // security cap
    ctx.save(); ctx.translate(34, -42); ctx.rotate(o.capTilt != null ? o.capTilt : 0.12);
    const cp = new Path2D(); cp.moveTo(-20, 2); cp.quadraticCurveTo(-18, -20, 0, -20); cp.quadraticCurveTo(20, -20, 20, 2); cp.closePath();
    D.sticker(ctx, cp, cap, { x: -20, y: -20, w: 40, h: 22 }, { shadow: false, lw: 4 });
    D.sticker(ctx, P.rr(4, -2, 26, 7, 3.5), U.shade(cap, -0.3), null, { shadow: false, lw: 3.5 });
    ell(ctx, 0, -8, 5.5, 5.5, 0, '#FFC83D'); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
    // near wing
    ctx.save(); ctx.translate(-4, -4); ctx.rotate(-0.1 + fl * 0.85 * (o.flap == null ? 1 : o.flap));
    D.sticker(ctx, P.ellipse(-18, 4, 38, 16), wing, null, { shadow: false, lw: 4.5 });
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-40, -2, 40, 5);
    ctx.restore();
    // torch in hand-wing
    if (o.torch !== false) {
      ctx.save(); ctx.translate(30, 14); ctx.rotate(0.35);
      D.sticker(ctx, P.rr(0, -6, 30, 12, 4), '#454866', null, { shadow: false, lw: 3.5 });
      D.sticker(ctx, P.rr(26, -9, 10, 18, 3), '#FFE48A', null, { shadow: false, lw: 3.5 });
      ctx.restore();
    }
    ctx.restore();
  };

  /* beam sprite: a soft cone of light, cached */
  let beamCv = null;
  RR.beam = function () {
    if (beamCv) return beamCv;
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 128, 512, 128); gr.addColorStop(0, 'rgba(255,244,190,0.85)'); gr.addColorStop(0.6, 'rgba(255,244,190,0.28)'); gr.addColorStop(1, 'rgba(255,244,190,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 122); g.lineTo(512, 0); g.lineTo(512, 256); g.lineTo(0, 134); g.closePath(); g.fill();
    return (beamCv = c);
  };

  /* ---------------- the crow ---------------- */
  RR.crow = function (ctx, x, y, s, o) {
    o = o || {};
    const t = o.t || 0, fl = Math.sin(t * (o.flap ? 18 : 3));
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.dir === -1 ? -1 : 1), s); if (o.rot) ctx.rotate(o.rot);
    const blk = '#34305A', blk2 = '#232047';
    ctx.save(); ctx.translate(-8, -8); ctx.rotate(-0.6 - (o.flap ? fl * 0.9 : 0.1));
    D.sticker(ctx, P.ellipse(-18, -4, 34, 11), blk2, null, { shadow: false, lw: 4 }); ctx.restore();
    ctx.save(); ctx.translate(-34, 6); ctx.rotate(0.3); D.sticker(ctx, P.rr(-26, -6, 30, 13, 6), blk2, null, { shadow: false, lw: 4 }); ctx.restore();
    if (!o.flap) { ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6, 22); ctx.lineTo(-6, 34); ctx.moveTo(8, 22); ctx.lineTo(8, 34); ctx.stroke(); }
    const b = P.ellipse(0, 4, 34, 24); D.sticker(ctx, b, blk, { x: -34, y: -20, w: 68, h: 48 }, { shadow: false, lw: 5 });
    const hd = P.circle(26, -16, 19); D.sticker(ctx, hd, blk, { x: 7, y: -35, w: 38, h: 38 }, { shadow: false, lw: 5 });
    ctx.fillStyle = '#FFC83D'; ctx.beginPath(); ctx.moveTo(42, -22); ctx.lineTo(64, -14); ctx.lineTo(42, -8); ctx.closePath(); ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
    ell(ctx, 34, -20, 6.5, 7.5, 0, '#fff'); ctx.lineWidth = 3; ctx.stroke(); ell(ctx, 36, -19, 3.2, 4.2, 0, '#16122E');
    ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(26, -32); ctx.lineTo(42, -26); ctx.stroke();
    ctx.save(); ctx.translate(-2, -2); ctx.rotate(-0.1 + (o.flap ? fl * 0.9 : 0)); D.sticker(ctx, P.ellipse(-12, 4, 28, 13), '#4A4580', null, { shadow: false, lw: 4.5 }); ctx.restore();
    ctx.restore();
  };

  /* ---------------- the sleepy night-watchman cat ---------------- */
  /* o: {t, awake (0..1), flashlight} faces -x by default? we draw facing +x and flip via dir */
  RR.cat = function (ctx, x, y, s, o) {
    o = o || {};
    const t = o.t || 0, aw = o.awake || 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.dir === -1 ? -1 : 1), s);
    const OR = '#F2A046', OR_D = '#D9792A', CR = '#FFF1D6';
    // stool
    ctx.fillStyle = INK; for (const sx of [-26, 26]) ctx.fillRect(sx - 4, -6, 8, 6);
    D.sticker(ctx, P.rr(-44, -40, 88, 14, 7), '#9B6B3E', null, { shadow: false, lw: 4.5 });
    D.sticker(ctx, P.rr(-36, -26, 8, 26, 3), '#7A5230', null, { shadow: false, lw: 4 }); D.sticker(ctx, P.rr(28, -26, 8, 26, 3), '#7A5230', null, { shadow: false, lw: 4 });
    // tail
    ctx.save(); ctx.translate(-34, -52); ctx.rotate(Math.sin(t * (aw ? 6 : 1.4)) * 0.2);
    ctx.strokeStyle = INK; ctx.lineWidth = 17; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-34, -2, -36, -34); ctx.stroke();
    ctx.strokeStyle = OR; ctx.lineWidth = 9; ctx.stroke(); ctx.restore();
    // body (sitting, round)
    const bd = P.ellipse(0, -76, 38, 40); D.sticker(ctx, bd, OR, { x: -38, y: -116, w: 76, h: 80 }, { shadow: false, lw: 5 });
    ctx.save(); ctx.clip(bd); ell(ctx, 8, -64, 24, 28, 0, CR); ctx.strokeStyle = OR_D; ctx.lineWidth = 4; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-40, -96 + i * 12); ctx.lineTo(-26, -92 + i * 12); ctx.stroke(); } ctx.restore();
    // vest + badge
    ell(ctx, 6, -62, 6, 6, 0, '#FFC83D'); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    // feet
    ell(ctx, 16, -36, 14, 8, 0, CR); ctx.lineWidth = 3.5; ctx.stroke(); ell(ctx, -10, -36, 14, 8, 0, CR); ctx.stroke();
    // head
    ctx.save(); ctx.translate(8, -128 + Math.sin(t * 1.6) * (aw ? 0 : 2.5)); ctx.rotate(aw ? 0 : 0.14 + Math.sin(t * 1.6) * 0.03);
    for (const sd of [-1, 1]) { const ear = P.poly([[sd * 12 - 10, -18], [sd * 26, -46], [sd * 30 + 4, -12]], false); D.sticker(ctx, ear, OR, null, { shadow: false, lw: 4.5 }); ell(ctx, sd * 24, -24, 5, 8, sd * 0.3, EAR_IN); }
    const hd = P.ellipse(0, 0, 38, 31); D.sticker(ctx, hd, OR, { x: -38, y: -31, w: 76, h: 62 }, { shadow: false, lw: 5 });
    ctx.fillStyle = OR_D; for (const sx of [-10, 0, 10]) { ctx.beginPath(); ctx.moveTo(sx - 3, -30); ctx.lineTo(sx + 3, -30); ctx.lineTo(sx, -18); ctx.fill(); }
    ell(ctx, 0, 12, 20, 13, 0, CR);
    if (aw > 0.5) { for (const sd of [-1, 1]) { ell(ctx, sd * 15, -2, 9, 11, 0, '#fff'); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ell(ctx, sd * 15 + 1, -1, 3, 7, 0, INK); } }
    else { ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 15, -4, 8, 0.15, Math.PI - 0.15); ctx.stroke(); } }
    ell(ctx, 0, 6, 5, 3.6, 0, '#F0708A'); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 9); ctx.quadraticCurveTo(-8, 18, -14, 12); ctx.moveTo(0, 9); ctx.quadraticCurveTo(8, 18, 14, 12); ctx.stroke();
    if (aw < 0.5) { ell(ctx, 0, 18, 5, 3.5 + Math.sin(t * 2) * 1, 0, '#3A1630'); }
    ctx.strokeStyle = 'rgba(31,26,61,0.5)'; ctx.lineWidth = 2; for (const sd of [-1, 1]) for (const dy of [-2, 5]) { ctx.beginPath(); ctx.moveTo(sd * 24, 8 + dy); ctx.lineTo(sd * 46, 6 + dy * 1.6); ctx.stroke(); }
    // night-watchman cap
    ctx.save(); ctx.translate(0, -30); ctx.rotate(-0.08);
    const cp = new Path2D(); cp.moveTo(-30, 4); cp.quadraticCurveTo(-28, -26, 0, -26); cp.quadraticCurveTo(28, -26, 30, 4); cp.closePath();
    D.sticker(ctx, cp, '#2F4A9A', { x: -30, y: -26, w: 60, h: 30 }, { shadow: false, lw: 4.5 });
    D.sticker(ctx, P.rr(-34, -2, 68, 9, 4), '#233A7A', null, { shadow: false, lw: 4 });
    ctx.beginPath(); ctx.moveTo(0, -17); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5, b = a + Math.PI / 5; ctx.lineTo(Math.cos(a) * 6.5, -14 + Math.sin(a) * 6.5); ctx.lineTo(Math.cos(b) * 3, -14 + Math.sin(b) * 3); } ctx.closePath(); ctx.fillStyle = '#FFC83D'; ctx.fill();
    ctx.restore();
    ctx.restore();
    // flashlight in paw
    ctx.save(); ctx.translate(28, -58); ctx.rotate(aw ? -0.25 : 0.7);
    D.sticker(ctx, P.rr(0, -7, 34, 14, 5), '#454866', null, { shadow: false, lw: 4 }); D.sticker(ctx, P.rr(30, -11, 12, 22, 4), aw ? '#FFF4B0' : '#B9B4CF', null, { shadow: false, lw: 4 });
    ctx.restore();
    if (aw > 0.5) { ctx.save(); ctx.translate(30, -130); D.text(ctx, '!', 0, 0, { size: 62, color: '#FF5A5F', outline: 10 }); ctx.restore(); }
    ctx.restore();
  };

  RR.ik = ik;
  RR.helpers = { ell, limb, sm, blend };
})();
