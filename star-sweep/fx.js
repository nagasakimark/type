/* Star Sweep - pooled sprite particles (Kenney smoke + particle packs, additive blend) and effect recipes. */
(function () {
  'use strict';
  const SS = window.SS, TM = window.TM, U = TM.U;
  const N = 1500;
  const P = [];
  for (let i = 0; i < N; i++) P.push({ on: false });
  let nextFree = 0, live = 0;
  const rnd = U.rand;

  function alloc() {
    for (let i = 0; i < N; i++) { const j = (nextFree + i) % N; if (!P[j].on) { nextFree = j + 1; return P[j]; } }
    return null;
  }
  const fx = (SS.fx = {});
  /* emit({spr,x,y,vx,vy,drag,g,rot,vr,life,s0,s1,a0,a1,add,tint,grow}) sizes are the sprite's max dimension in px */
  fx.emit = function (o) {
    if (TM.settings.reduceMotion && o.cosmetic) return null;
    const p = alloc(); if (!p) return null;
    p.on = true; p.t = 0; p.spr = o.spr; p.x = o.x; p.y = o.y; p.vx = o.vx || 0; p.vy = o.vy || 0; p.drag = o.drag || 0; p.g = o.g || 0;
    p.rot = o.rot || 0; p.vr = o.vr || 0; p.life = o.life || 0.6; p.s0 = o.s0 ?? 40; p.s1 = o.s1 ?? p.s0; p.a0 = o.a0 ?? 1; p.a1 = o.a1 ?? 0;
    p.add = !!o.add; p.tint = o.tint || null; p.fadeIn = o.fadeIn || 0; p.layer = o.layer || 0;
    return p;
  };
  fx.update = function (dt) {
    live = 0;
    for (let i = 0; i < N; i++) {
      const p = P[i]; if (!p.on) continue;
      p.t += dt; if (p.t >= p.life) { p.on = false; continue; }
      live++;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
  };
  fx.count = () => live;
  fx.clear = () => { for (const p of P) p.on = false; };
  /* draw one pass: add=false normal, add=true additive ('lighter') */
  fx.draw = function (ctx, add, layer) {
    const prev = ctx.globalCompositeOperation;
    if (add) ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N; i++) {
      const p = P[i]; if (!p.on || p.add !== add || (p.layer || 0) !== (layer || 0)) continue;
      const k = p.t / p.life;
      let a = p.a0 + (p.a1 - p.a0) * k;
      if (p.fadeIn && p.t < p.fadeIn) a *= p.t / p.fadeIn;
      if (a <= 0.01) continue;
      SS.spr(ctx, p.spr, p.x, p.y, { max: p.s0 + (p.s1 - p.s0) * k, rot: p.rot, a, tint: p.tint });
    }
    ctx.globalCompositeOperation = prev;
  };

  /* ---------- recipes ---------- */
  const DEB = { red: 12, blue: 12, green: 12, gray: 62 };
  fx.debris = function (x, y, n, color, spd, size) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.283), v = rnd(0.35, 1) * (spd || 380);
      const c = Math.random() < 0.25 ? 'gray' : color || 'gray';
      fx.emit({ spr: `deb_${c}_${U.randi(1, DEB[c])}`, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 1.4, rot: rnd(0, 6.28), vr: rnd(-9, 9), life: rnd(0.8, 1.5), s0: (size || 40) * rnd(0.6, 1.1), s1: (size || 40) * 0.5, a0: 1, a1: 0 });
    }
  };
  fx.sparks = function (x, y, n, tint, spd, size) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.283), v = rnd(0.3, 1) * (spd || 500);
      fx.emit({ spr: Math.random() < 0.5 ? 'p_star6' : 'p_star7', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.6, rot: rnd(0, 6), vr: rnd(-4, 4), life: rnd(0.35, 0.8), s0: (size || 34) * rnd(0.6, 1.2), s1: 4, a0: 1, a1: 0, add: true, tint: tint || '#ffe9a0' });
    }
  };
  fx.ring = function (x, y, size, tint, life, spr) {
    fx.emit({ spr: spr || 'p_circle2', x, y, life: life || 0.45, s0: size * 0.15, s1: size, a0: 0.95, a1: 0, add: true, tint: tint || '#ffffff' });
  };
  fx.glow = function (x, y, size, tint, life, a) {
    fx.emit({ spr: 'p_circle5', x, y, life: life || 0.3, s0: size, s1: size * 0.4, a0: a ?? 0.9, a1: 0, add: true, tint: tint || '#ffffff' });
  };
  fx.puff = function (x, y, size, life, dark, vx, vy) {
    fx.emit({ spr: (dark ? 'bsmoke' : 'puff') + U.pick(dark ? [0, 4, 8, 12, 16, 20] : [0, 3, 6, 9, 12, 15]), x, y, vx: vx ?? rnd(-30, 30), vy: vy ?? rnd(-40, 10), drag: 0.8, rot: rnd(0, 6), vr: rnd(-1, 1), life: life || 0.9, s0: size * 0.5, s1: size, a0: dark ? 0.55 : 0.5, a1: 0 });
  };
  /* hit spark when a laser bolt lands */
  fx.hit = function (x, y, tint) {
    fx.glow(x, y, 70, tint || '#9fe6ff', 0.2, 0.9);
    fx.emit({ spr: 'p_star8', x, y, rot: rnd(0, 6), vr: rnd(-6, 6), life: 0.25, s0: 26, s1: 74, a0: 1, a1: 0, add: true, tint: tint || '#c8f4ff' });
    fx.sparks(x, y, 4, tint || '#bfefff', 420, 22);
  };
  fx.muzzle = function (x, y, rot, tint) {
    fx.emit({ spr: 'p_muzzle2', x, y, rot: rot + Math.PI, life: 0.09, s0: 46, s1: 70, a0: 1, a1: 0, add: true, tint: tint || '#9fe6ff' });
    fx.glow(x, y, 50, tint || '#9fe6ff', 0.12, 0.8);
  };
  /* the big one: layered smoke-pack explosion + flash + shockwave + sparks + debris */
  fx.explode = function (x, y, size, o) {
    o = o || {};
    const col = o.color || 'gray'; const lite = TM.settings.reduceMotion;
    fx.emit({ spr: 'flash' + U.randi(0, 8), x, y, rot: rnd(0, 6.28), life: 0.32, s0: size * 0.5, s1: size * 1.7, a0: 1, a1: 0, add: true });
    fx.emit({ spr: 'expl' + U.randi(0, 8), x, y, rot: rnd(0, 6.28), vr: rnd(-0.8, 0.8), life: 0.7, s0: size * 0.35, s1: size * 1.25, a0: 1, a1: 0 });
    fx.emit({ spr: 'expl' + U.randi(0, 8), x: x + rnd(-size * 0.2, size * 0.2), y: y + rnd(-size * 0.2, size * 0.2), rot: rnd(0, 6.28), life: 0.55, s0: size * 0.2, s1: size * 0.9, a0: 0.95, a1: 0, add: true });
    fx.glow(x, y, size * 2.2, o.glow || '#ff9a3c', 0.5, 0.65);
    fx.ring(x, y, size * 2.1, o.ring || '#ffe2a8', 0.5);
    if (!lite) {
      fx.sparks(x, y, Math.round(8 + size / 14), o.spark || '#ffd37a', 300 + size * 3.5, 30);
      fx.debris(x, y, Math.round(5 + size / 24), col, 240 + size * 3, Math.max(26, size * 0.34));
      for (let i = 0; i < 3; i++) fx.puff(x + rnd(-size * 0.3, size * 0.3), y + rnd(-size * 0.3, size * 0.3), size * rnd(0.9, 1.4), rnd(0.8, 1.4), true);
    }
  };
  fx.confettiStars = function (x, y, n, colors) {
    colors = colors || ['#ffe066', '#7ee8ff', '#ff8fd0', '#9dff9d', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = rnd(-Math.PI, 0) , v = rnd(300, 900);
      fx.emit({ spr: U.pick(['p_star6', 'p_star7', 'p_star8', 'p_star9', 'p_magic5']), x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 700, drag: 0.6, rot: rnd(0, 6), vr: rnd(-6, 6), life: rnd(1, 1.8), s0: rnd(30, 60), s1: 10, a0: 1, a1: 0, add: true, tint: U.pick(colors) });
    }
  };
})();
