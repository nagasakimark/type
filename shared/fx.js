/* Typing Master - fx: particles, confetti, ink splats, score pops, screen shake, tweens. */
(function () {
  'use strict';
  const TM = window.TM, U = TM.U, C = TM.C, D = TM.draw;
  const CONFETTI = ['#FF5A5F', '#FFC83D', '#2BB673', '#2F9BFF', '#7B5CFF', '#FF3EA5', '#18C1C9'];

  class FX {
    constructor() { this.parts = []; this.pops = []; this.decals = []; this.shakeT = 0; this.shakeA = 0; this.flash = 0; this.flashColor = '#fff'; }
    burst(x, y, o = {}) {
      const n = o.count ?? 16;
      for (let i = 0; i < n; i++) {
        const a = o.angle != null ? o.angle + U.rand(-(o.spread ?? Math.PI), o.spread ?? Math.PI) : U.rand(0, Math.PI * 2);
        const sp = U.rand(o.speed?.[0] ?? 200, o.speed?.[1] ?? 600);
        const colors = o.colors || (o.color ? [o.color] : CONFETTI);
        this.parts.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ?? 0),
          g: o.gravity ?? 900, life: U.rand(o.life?.[0] ?? 0.5, o.life?.[1] ?? 1.0), t: 0,
          size: U.rand(o.size?.[0] ?? 8, o.size?.[1] ?? 16), color: U.pick(colors), shape: o.shape || 'circle',
          rot: U.rand(0, 6.28), vr: U.rand(-10, 10), drag: o.drag ?? 0.985, outline: o.outline ?? false,
        });
      }
    }
    confetti(x, y, n = 40) { this.burst(x, y, { count: n, shape: 'confetti', speed: [300, 900], up: 300, gravity: 1200, life: [0.8, 1.6], size: [10, 18] }); }
    stars(x, y, n = 8, color = C.gold) { this.burst(x, y, { count: n, shape: 'star', color, speed: [200, 500], gravity: 600, life: [0.5, 0.9], size: [14, 24], outline: true }); }
    /* ink splat: blobs + a persistent decal */
    splat(x, y, color, r = 60, persist = true) {
      this.burst(x, y, { count: 14, shape: 'drop', color, speed: [250, 700], gravity: 1400, life: [0.4, 0.8], size: [10, 22] });
      if (persist) this.decals.push({ x, y, r, color, seed: Math.random() * 10, t: 0 });
      if (this.decals.length > 140) this.decals.shift();
    }
    pop(x, y, str, o = {}) { this.pops.push({ x, y, str, t: 0, life: o.life || 0.9, color: o.color || C.gold, size: o.size || 54 }); }
    shake(amount = 14, time = 0.12) { if (TM.settings.reduceMotion) return; this.shakeA = Math.max(this.shakeA, amount); this.shakeT = Math.max(this.shakeT, time); }
    doFlash(color = '#fff', a = 0.5) { this.flash = a; this.flashColor = color; }
    update(dt) {
      for (const p of this.parts) {
        p.t += dt; p.vy += p.g * dt; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      }
      this.parts = this.parts.filter((p) => p.t < p.life);
      for (const p of this.pops) p.t += dt;
      this.pops = this.pops.filter((p) => p.t < p.life);
      for (const d of this.decals) d.t = Math.min(1, d.t + dt * 6);
      if (this.shakeT > 0) this.shakeT -= dt; else this.shakeA = 0;
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5);
    }
    applyShake(ctx) {
      if (this.shakeT > 0) ctx.translate(U.rand(-1, 1) * this.shakeA, U.rand(-1, 1) * this.shakeA);
    }
    drawDecals(ctx) {
      for (const d of this.decals) {
        ctx.fillStyle = d.color;
        ctx.fill(D.P.blob(d.x, d.y, d.r * U.ease.outBack(d.t), d.seed, 0.22, 10));
        ctx.beginPath(); ctx.arc(d.x + d.r * 1.1, d.y - d.r * 0.4, d.r * 0.18 * d.t, 0, 7); ctx.arc(d.x - d.r * 0.9, d.y + d.r * 0.6, d.r * 0.13 * d.t, 0, 7); ctx.fill();
      }
    }
    draw(ctx) {
      for (const p of this.parts) {
        const a = 1 - p.t / p.life;
        ctx.save(); ctx.globalAlpha = Math.min(1, a * 1.5); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 'confetti') ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        else if (p.shape === 'star') { const path = D.P.star(0, 0, p.size, 0.48); ctx.fill(path); if (p.outline) { ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke(path); } }
        else if (p.shape === 'drop') { ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.75, 0, 0, 7); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, 7); ctx.fill(); if (p.outline) { ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke(); } }
        ctx.restore();
      }
      for (const p of this.pops) {
        const k = p.t / p.life;
        const s = k < 0.2 ? U.ease.outBack(k / 0.2) : 1;
        ctx.save(); ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        ctx.translate(p.x, p.y - k * 70); ctx.scale(s, s);
        D.text(ctx, p.str, 0, 0, { size: p.size, color: p.color, outline: 10 });
        ctx.restore();
      }
    }
    drawFlash(ctx, w, h) { if (this.flash > 0) { ctx.save(); ctx.globalAlpha = this.flash; ctx.fillStyle = this.flashColor; ctx.fillRect(-50, -50, w + 100, h + 100); ctx.restore(); } }
  }
  TM.FX = FX;
  TM.CONFETTI = CONFETTI;
})();
