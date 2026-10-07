/* Typing Master - draw: the shared "chunky sticker" art kit and the word chip. */
(function () {
  'use strict';
  const TM = window.TM, C = TM.C, U = TM.U;
  const LW = 5; // outline width at 1080p

  const FONT_WORD = (px, w = 500) => `${w} ${px}px Lexend, "Segoe UI", Arial, sans-serif`;
  const FONT_DISPLAY = (px, w = 800) => `${w} ${px}px "Baloo 2", "Arial Rounded MT Bold", "Segoe UI", sans-serif`;
  const FONT_JA = (px, w = 700) => `${w} ${px}px "Hiragino Maru Gothic ProN", "BIZ UDGothic", "Yu Gothic UI", "Meiryo", sans-serif`;

  const P = {
    rr(x, y, w, h, r) { const p = new Path2D(); r = Math.min(r, w / 2, h / 2); p.roundRect ? p.roundRect(x, y, w, h, r) : rrManual(p, x, y, w, h, r); return p; },
    circle(x, y, r) { const p = new Path2D(); p.arc(x, y, r, 0, Math.PI * 2); return p; },
    ellipse(x, y, rx, ry, rot = 0) { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p; },
    star(x, y, r, inner = 0.5, n = 5, rot = -Math.PI / 2) {
      const p = new Path2D();
      for (let i = 0; i < n * 2; i++) {
        const a = rot + (i * Math.PI) / n, rr = i % 2 ? r * inner : r;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        i ? p.lineTo(px, py) : p.moveTo(px, py);
      }
      p.closePath(); return p;
    },
    blob(x, y, r, seed = 1, wob = 0.12, n = 9, t = 0) {
      const p = new Path2D(); const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const k = 1 + Math.sin(a * 3 + seed * 1.7 + t) * wob + Math.cos(a * 2 + seed * 3.1 - t * 0.7) * wob * 0.6;
        pts.push([x + Math.cos(a) * r * k, y + Math.sin(a) * r * k]);
      }
      smoothClosed(p, pts); return p;
    },
    poly(pts, smooth) { const p = new Path2D(); if (smooth) smoothClosed(p, pts); else { pts.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); p.closePath(); } return p; },
  };
  function rrManual(p, x, y, w, h, r) { p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); }
  function smoothClosed(p, pts) {
    const n = pts.length; const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let m = mid(pts[n - 1], pts[0]); p.moveTo(m[0], m[1]);
    for (let i = 0; i < n; i++) { const q = pts[i], m2 = mid(q, pts[(i + 1) % n]); p.quadraticCurveTo(q[0], q[1], m2[0], m2[1]); }
    p.closePath();
  }

  /* Sticker: shadow, flat fill, top highlight band, bottom shade, thick Ink outline.
     box = {x,y,w,h} bounding box used to place the highlight. */
  function sticker(ctx, path, fill, box, o = {}) {
    const lw = o.lw ?? LW;
    if (o.shadow !== false) {
      ctx.save(); ctx.translate(0, o.shadowY ?? 8); ctx.fillStyle = 'rgba(31,26,61,0.18)'; ctx.fill(path); ctx.restore();
    }
    ctx.fillStyle = fill; ctx.fill(path);
    if (box && o.shade !== false) {
      ctx.save(); ctx.clip(path);
      ctx.fillStyle = 'rgba(31,26,61,0.13)';
      ctx.beginPath(); ctx.ellipse(box.x + box.w * 0.5, box.y + box.h * 1.18, box.w * 0.75, box.h * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      if (o.highlight !== false) {
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        const hw = box.w * 0.5, hh = Math.max(6, box.h * 0.13);
        ctx.fill(P.rr(box.x + box.w * 0.16, box.y + box.h * 0.1, hw, hh, hh / 2));
      }
      ctx.restore();
    }
    if (o.outline !== false) { ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = o.stroke || C.ink; ctx.stroke(path); }
  }

  /* Eyes: the family's two oval eyes with a glint. mood: normal | happy | grumpy | sleepy | dizzy | wide */
  function eyes(ctx, cx, cy, s, mood = 'normal', lookX = 0, lookY = 0, gap = 1) {
    const dx = s * 0.95 * gap;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink;
    for (const side of [-1, 1]) {
      const x = cx + side * dx, y = cy;
      if (mood === 'happy') {
        ctx.lineWidth = s * 0.32; ctx.beginPath(); ctx.arc(x, y + s * 0.25, s * 0.45, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      } else if (mood === 'sleepy') {
        ctx.lineWidth = s * 0.28; ctx.beginPath(); ctx.arc(x, y - s * 0.1, s * 0.42, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      } else if (mood === 'dizzy') {
        ctx.lineWidth = s * 0.25; ctx.beginPath(); ctx.moveTo(x - s * 0.35, y - s * 0.35); ctx.lineTo(x + s * 0.35, y + s * 0.35); ctx.moveTo(x + s * 0.35, y - s * 0.35); ctx.lineTo(x - s * 0.35, y + s * 0.35); ctx.stroke();
      } else {
        const ry = mood === 'wide' ? s * 0.62 : s * 0.52;
        ctx.beginPath(); ctx.ellipse(x + lookX * s * 0.15, y + lookY * s * 0.15, s * 0.36, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + lookX * s * 0.15 - s * 0.1, y + lookY * s * 0.15 - s * 0.22, s * 0.13, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = C.ink;
        if (mood === 'grumpy') {
          ctx.lineWidth = s * 0.26; ctx.beginPath(); ctx.moveTo(x - side * s * 0.45, y - s * 0.85); ctx.lineTo(x + side * s * 0.4, y - s * 0.55); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
  function cheeks(ctx, cx, cy, s, gap = 1) {
    ctx.save(); ctx.fillStyle = 'rgba(255,90,120,0.35)';
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + side * s * 1.75 * gap, cy + s * 0.6, s * 0.38, s * 0.22, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function mouth(ctx, cx, cy, s, kind = 'smile') {
    ctx.save(); ctx.strokeStyle = C.ink; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round';
    ctx.beginPath();
    if (kind === 'smile') ctx.arc(cx, cy - s * 0.15, s * 0.35, Math.PI * 0.2, Math.PI * 0.8);
    else if (kind === 'frown') ctx.arc(cx, cy + s * 0.35, s * 0.32, Math.PI * 1.2, Math.PI * 1.8);
    else if (kind === 'o') { ctx.ellipse(cx, cy, s * 0.18, s * 0.24, 0, 0, Math.PI * 2); ctx.fillStyle = C.ink; ctx.fill(); }
    else if (kind === 'flat') { ctx.moveTo(cx - s * 0.25, cy); ctx.lineTo(cx + s * 0.25, cy); }
    else if (kind === 'grin') { ctx.arc(cx, cy - s * 0.25, s * 0.5, Math.PI * 0.15, Math.PI * 0.85); ctx.closePath(); ctx.fillStyle = C.ink; ctx.fill(); }
    ctx.stroke(); ctx.restore();
  }

  /* text with optional thick outline */
  function text(ctx, str, x, y, o = {}) {
    ctx.save();
    ctx.font = o.font || FONT_DISPLAY(o.size || 48);
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.baseline || 'middle';
    if (o.outline) { ctx.lineWidth = o.outline; ctx.lineJoin = 'round'; ctx.strokeStyle = o.stroke || C.ink; ctx.strokeText(str, x, y); }
    ctx.fillStyle = o.color || C.ink; ctx.fillText(str, x, y);
    ctx.restore();
  }

  /* ---------- the word chip ---------- */
  const widthCache = new Map();
  function charW(ctx, font, ch) {
    const k = font + '|' + ch; let w = widthCache.get(k);
    if (w == null) { ctx.font = font; w = ctx.measureText(ch).width; widthCache.set(k, w); }
    return w;
  }
  function chipSize(ctx, typer, size = 46) {
    const font = FONT_WORD(size);
    let w = 0; for (const c of typer.chars) w += charW(ctx, font, c.c);
    return { w: w + size * 1.1, h: size * 1.55 };
  }
  /* chip(ctx, x, y, typer, {size, accent, locked, alpha, hint, scale, dim}) — x,y = centre */
  function chip(ctx, x, y, typer, o = {}) {
    const size = o.size || 46, accent = o.accent || C.ink2;
    const font = FONT_WORD(size), fontB = FONT_WORD(size, 700);
    const { w, h } = chipSize(ctx, typer, size);
    const sh = typer.shake > 0 ? Math.sin(typer.shake * 40) * 10 * typer.shake : 0;
    ctx.save();
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.translate(x + sh, y);
    const sc = (o.scale || 1) * (o.locked ? 1.08 : 1);
    ctx.scale(sc, sc);
    const path = P.rr(-w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = 'rgba(31,26,61,0.22)'; ctx.save(); ctx.translate(0, 6); ctx.fill(path); ctx.restore();
    ctx.fillStyle = o.dim ? '#F2EFF8' : '#fff'; ctx.fill(path);
    ctx.lineWidth = o.locked ? 7 : LW; ctx.strokeStyle = o.locked ? accent : C.ink; ctx.stroke(path);
    // letters
    let cx = -w / 2 + size * 0.55;
    const base = size * 0.06;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    let nextIdx = -1;
    for (let i = typer.pos; i < typer.chars.length; i++) if (!typer.chars[i].opt) { nextIdx = i; break; }
    for (let i = 0; i < typer.chars.length; i++) {
      const c = typer.chars[i];
      const cw = charW(ctx, font, c.c);
      if (i < typer.pos) {
        ctx.font = fontB; ctx.fillStyle = accent; ctx.fillText(c.c, cx, base - size * 0.06);
      } else {
        ctx.font = font; ctx.fillStyle = c.opt ? 'rgba(31,26,61,0.45)' : (o.dim ? '#8C86A6' : C.ink);
        ctx.fillText(c.c, cx, base);
        if (i === nextIdx) {
          ctx.fillStyle = accent;
          const uw = c.k === ' ' ? size * 0.5 : Math.max(cw, size * 0.35);
          const ux = c.k === ' ' ? cx + (cw - uw) / 2 : cx;
          ctx.fillRect(ux, base + size * 0.48, uw, size * 0.12);
          if (c.k === ' ') { ctx.fillRect(ux, base + size * 0.3, size * 0.08, size * 0.3); ctx.fillRect(ux + uw - size * 0.08, base + size * 0.3, size * 0.08, size * 0.3); }
        }
      }
      cx += cw;
    }
    ctx.restore();
    if (o.hint && typer.item.hint) {
      ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
      const hs = Math.round(size * 0.52);
      ctx.font = FONT_JA(hs);
      const tw = ctx.measureText(typer.item.hint).width + hs;
      const hy = y + h / 2 * (o.scale || 1) + hs * 0.95;
      const hp = P.rr(x - tw / 2, hy - hs * 0.75, tw, hs * 1.5, hs * 0.75);
      ctx.fillStyle = 'rgba(31,26,61,0.78)'; ctx.fill(hp);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(typer.item.hint, x, hy + 1);
      ctx.restore();
    }
    return { w: w * (o.scale || 1), h: h * (o.scale || 1) };
  }

  /* rounded HUD pill on canvas */
  function pill(ctx, x, y, w, h, fill = C.ink, o = {}) {
    const p = P.rr(x, y, w, h, h / 2);
    ctx.fillStyle = fill; ctx.fill(p);
    if (o.stroke) { ctx.lineWidth = o.lw || 4; ctx.strokeStyle = o.stroke; ctx.stroke(p); }
  }

  /* soft rounded hills / clouds for backgrounds */
  function cloud(ctx, x, y, s, color = '#fff', alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.5, 0, Math.PI * 2); ctx.arc(x + s * 0.55, y - s * 0.2, s * 0.6, 0, Math.PI * 2);
    ctx.arc(x + s * 1.15, y, s * 0.45, 0, Math.PI * 2); ctx.rect(x, y - s * 0.1, s * 1.15, s * 0.55);
    ctx.fill(); ctx.restore();
  }
  function hills(ctx, y, amp, wave, color, offset, w = 1920, h = 1080) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w + 20; x += 20) ctx.lineTo(x, y + Math.sin((x + offset) / wave) * amp + Math.sin((x + offset) / (wave * 0.43)) * amp * 0.35);
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  }

  TM.draw = { P, sticker, eyes, cheeks, mouth, text, chip, chipSize, pill, cloud, hills, FONT_WORD, FONT_DISPLAY, FONT_JA, LW };
})();
