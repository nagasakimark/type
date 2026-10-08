/* Star Sweep - weapon tiers, ship upgrade art (Kenney ship parts) and HUD weapon icons. Pure data + drawing; the game logic lives in game.js. */
(function () {
  'use strict';
  const SS = window.SS, TM = window.TM, U = TM.U;

  /* tier ladder. splash = how the weapon mows down neighbours of the typed ship.
     letter: {n: max victims per letter, r: radius, dmg}   final: {n, r, dmg}   (victims have 1-4 "splash HP", see game.js) */
  SS.W = {};
  SS.W.TIERS = [
    { id: 'blaster', ja: 'ブラスター', color: '#8fdcff', letter: null, final: null },
    { id: 'twin', ja: 'ツインショット', color: '#7dffb0', letter: null, final: { n: 1, r: 190, dmg: 1 } },
    { id: 'spread', ja: 'スプレッド', color: '#ffe066', letter: { n: 1, r: 300, dmg: 1 }, final: { n: 2, r: 320, dmg: 2 } },
    { id: 'minigun', ja: 'ミニガン', color: '#ffb23f', letter: { n: 2, r: 420, dmg: 1 }, final: { n: 6, r: 560, dmg: 2 } },
    { id: 'missile', ja: 'ホーミングミサイル', color: '#ff7a5a', letter: { n: 1, r: 700, dmg: 2 }, final: { n: 4, r: 900, dmg: 3 } },
    { id: 'beam', ja: 'ビームレーザー', color: '#ff7ae8', letter: { n: 6, r: 90, dmg: 2 }, final: { n: 9, r: 760, dmg: 3 } },
  ];
  SS.W.MAX = SS.W.TIERS.length - 1;
  /* splash hit points by enemy type: how many splash damage a neighbour can take before it pops */
  SS.W.SPLASH_HP = { scout: 2, weaver: 2, zigzag: 2, kamikaze: 1, mini: 1, meteor: 2, ufo: 3, splitter: 3, shielded: 3 };

  const spr = (ctx, n, x, y, o) => SS.spr(ctx, n, x, y, o);
  const add = (ctx) => { ctx.globalCompositeOperation = 'lighter'; };
  const norm = (ctx) => { ctx.globalCompositeOperation = 'source-over'; };

  /* ---------- the player's ship with attached parts ----------
     Local coordinates: origin = ship centre, -y = nose. u = base ship scale (1.55). o = {t, fire (0..1), spin, pop (0..1 just upgraded)} */
  SS.W.drawShip = function (ctx, tier, u, o) {
    const t = o.t, f = o.fire || 0, pop = o.pop || 0;
    const pp = 1 + 0.35 * Math.sin(Math.min(1, pop) * Math.PI) * (pop > 0 ? 1 : 0); // overshoot pop-in scale for fresh parts
    const part = (name, x, y, s, rot, flip, a) => spr(ctx, name, x * u, y * u, { s: s * u * 0.62, rot: rot || 0, flipX: flip, a: a == null ? 1 : a });

    // aura for the high tiers (behind the hull)
    if (tier >= 3) {
      add(ctx);
      const c = SS.W.TIERS[tier].color;
      spr(ctx, 'p_circle5', 0, 4 * u, { max: (150 + tier * 20 + Math.sin(t * 6) * 8) * u, a: 0.16 + 0.05 * tier, tint: c });
      norm(ctx);
    }
    // rear wings come first so the hull overlaps them
    if (tier >= 2) {
      for (const sd of [-1, 1]) part('wingBlue_3', sd * 52, 12, 0.95 * (tier >= 4 ? 1.12 : 1) * (pop > 0 ? pp : 1), sd * 0.1, sd > 0);
    }
    if (tier >= 4) {
      for (const sd of [-1, 1]) {
        // missile pods hanging under the wing tips
        part('turretBase_small', sd * 46, 20, 0.9, 0, false);
        for (const k of [-1, 1]) spr(ctx, 'missile3', (sd * 46 + k * 4.5) * u, 6 * u, { s: u * 0.62 * 0.85 * (pop > 0 ? pp : 1) });
      }
    }
    spr(ctx, 'ship1_blue', 0, 0, { s: u });
    // wing-tip guns
    if (tier >= 1) {
      const kick = f * 4;
      for (const sd of [-1, 1]) {
        part(tier >= 2 ? 'gun10' : 'gun09', sd * 38, -30 + kick * 0.5, 0.78 * (pop > 0 ? pp : 1), sd * (tier >= 2 ? 0.08 : 0));
        add(ctx); spr(ctx, 'p_circle5', sd * 38 * u, -54 * u, { max: (22 + f * 40) * u, a: 0.35 + f * 0.5, tint: SS.W.TIERS[tier].color }); norm(ctx);
      }
    }
    if (tier >= 2 && tier < 3) part('gun04', 0, -44 + f * 3, 0.85 * (pop > 0 ? pp : 1), 0);
    // MINIGUN: housing + 3 spinning barrels + glowing muzzle
    if (tier === 3) {
      part('turretBase_big', 0, -4, 1.15 * (pop > 0 ? pp : 1), 0);
      const sp = o.spin || 0;
      for (let k = 0; k < 3; k++) {
        const a = sp + k * 2.094, bx = Math.cos(a) * 9, depth = Math.sin(a);
        part(depth > 0 ? 'gun08' : 'gun07', bx, -50 + depth * 1.5 - f * 4, 1.15, 0, false, 0.9 + depth * 0.1);
      }
      add(ctx); spr(ctx, 'p_circle5', 0, -82 * u, { max: (46 + f * 90) * u, a: 0.45 + f * 0.55, tint: '#ffcf6a' }); norm(ctx);
    }
    // MISSILE tier keeps a smaller gatling nose, with glowing missile tips
    if (tier === 4) {
      part('turretBase_small', 0, -10, 1.0, 0);
      part('gun05', 0, -42 + f * 3, 0.95, 0);
      add(ctx); for (const sd of [-1, 1]) spr(ctx, 'p_circle5', sd * 46 * u, -2 * u, { max: (28 + f * 30) * u, a: 0.45 + 0.2 * Math.sin(t * 8), tint: '#ff7a5a' }); norm(ctx);
    }
    // BEAM: railgun prongs and a charged core
    if (tier === 5) {
      part('beam0', 0, -26, 1.1 * (pop > 0 ? pp : 1), 0);
      part('beamLong1', -13, -62, 1.0, 0.0, false); part('beamLong1', 13, -62, 1.0, 0.0, true);
      part('turretBase_small', 0, -8, 0.95, 0);
      add(ctx);
      const ch = 0.6 + 0.4 * Math.sin(t * 9) + f * 0.6;
      spr(ctx, 'p_circle5', 0, -66 * u, { max: (44 + ch * 40) * u, a: 0.75, tint: '#ff9af0' });
      spr(ctx, 'p_star8', 0, -66 * u, { max: (40 + ch * 24) * u, a: 0.8, rot: t * 3, tint: '#ffffff' });
      for (const sd of [-1, 1]) spr(ctx, 'p_circle5', sd * 38 * u, -54 * u, { max: 40 * u, a: 0.55, tint: '#ff9af0' });
      norm(ctx);
    }
  };
  /* where the muzzles are (local coords, before ship scale) for tracer spawn points */
  SS.W.muzzles = function (tier, spin, k) {
    if (tier === 0) return [[(k & 1 ? 1 : -1) * 20, -40]];
    if (tier === 1) return [[-38, -50], [38, -50]];
    if (tier === 2) return [[-38, -52], [38, -52], [0, -66]];
    if (tier === 3) { const a = spin + (k % 3) * 2.094; return [[Math.cos(a) * 9, -86]]; }
    if (tier === 4) return [[-38, -52], [38, -52], [0, -64]];
    return [[0, -66]];
  };

  /* wingman drone: small ship with glowing engine */
  SS.W.drawDrone = function (ctx, x, y, t, fire, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    add(ctx); spr(ctx, 'p_circle5', 0, 0, { max: 74, a: 0.35, tint: '#8fe9ff' }); spr(ctx, 'ef_fire05', 0, 24, { sw: 12, sh: 30 + Math.sin(t * 40) * 6, ay: 0.05 }); norm(ctx);
    spr(ctx, 'ship3_blue', 0, 0, { s: 0.52 });
    if (fire > 0) { add(ctx); spr(ctx, 'p_circle5', 0, -26, { max: 26 + fire * 40, a: 0.9 * fire, tint: '#bff4ff' }); norm(ctx); }
    ctx.restore();
  };

  /* ---------- HUD icons: simple chunky vector icons, drawn inside a ~64px circle around (x, y) ---------- */
  SS.W.drawIcon = function (ctx, id, x, y, s, t) {
    s = s || 1; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pill = (px, py, w, h, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px - w / 2, py - h / 2, w, h, w / 2) : ctx.rect(px - w / 2, py - h / 2, w, h); ctx.fill(); };
    if (id === 'blaster') { pill(0, -2, 8, 30, '#8fdcff'); pill(0, -2, 3, 24, '#fff'); }
    else if (id === 'twin') { for (const sd of [-1, 1]) { pill(sd * 9, -2, 7, 28, '#7dffb0'); pill(sd * 9, -2, 2.5, 22, '#fff'); } }
    else if (id === 'spread') { for (const a of [-0.5, 0, 0.5]) { ctx.save(); ctx.rotate(a); pill(0, -4, 7, 26, '#ffe066'); ctx.restore(); } }
    else if (id === 'minigun') {
      ctx.fillStyle = '#4a4f6a'; ctx.beginPath(); ctx.arc(0, 11, 12, 0, 7); ctx.fill();
      for (let k = 0; k < 3; k++) { const a = (t || 0) * 8 + k * 2.094; pill(Math.cos(a) * 7, -6, 6, 28, k === 0 ? '#ffd27a' : '#c9cfe6'); }
      ctx.fillStyle = '#ffcf6a'; for (const [dx, dy] of [[-4, -26], [3, -30], [-1, -34]]) { ctx.beginPath(); ctx.arc(dx, dy, 2.2, 0, 7); ctx.fill(); }
    } else if (id === 'missile') {
      ctx.fillStyle = '#e8ecff'; ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(10, -8, 8, 12); ctx.lineTo(-8, 12); ctx.quadraticCurveTo(-10, -8, 0, -22); ctx.fill();
      ctx.fillStyle = '#ff5a5f'; ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(6, -14, 6, -9); ctx.lineTo(-6, -9); ctx.quadraticCurveTo(-6, -14, 0, -22); ctx.fill();
      ctx.fillStyle = '#ff5a5f'; ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(-17, 18); ctx.lineTo(-8, 12); ctx.fill(); ctx.beginPath(); ctx.moveTo(8, 4); ctx.lineTo(17, 18); ctx.lineTo(8, 12); ctx.fill();
      ctx.fillStyle = '#ffb23f'; ctx.beginPath(); ctx.moveTo(-5, 12); ctx.lineTo(0, 24 + Math.sin((t || 0) * 30) * 3); ctx.lineTo(5, 12); ctx.fill();
    } else if (id === 'beam') {
      ctx.globalCompositeOperation = 'lighter';
      for (const [w, c] of [[22, 'rgba(255,122,232,0.35)'], [12, 'rgba(255,170,240,0.8)'], [5, '#fff']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(0, 24); ctx.lineTo(0, -26); ctx.stroke(); }
    }
    ctx.restore();
  };
})();
