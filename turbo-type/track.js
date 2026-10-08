/* Turbo Type - track definitions + spline sampling (no rendering here). */
(function () {
  'use strict';
  const TT = (window.TT = window.TT || {});
  const TAU = Math.PI * 2;
  /* Shared jump / car constants (game.js + the overhead test use these). */
  TT.GRAV = 27; TT.VY_MAX = 15.5; TT.VY_MIN = 11.5; TT.V_MAX = 100;
  TT.AIR_DIST = Math.ceil(TT.V_MAX * (2 * TT.VY_MAX / TT.GRAV)) + 12;   // furthest a car can fly after leaving a ramp
  TT.CAR = { hl: 2.3, hw: 1.15, h: 1.9 };                               // half length, half width, height incl. pitch margin
  TT.launchVy = (slope, v) => Math.min(TT.VY_MAX, Math.max(TT.VY_MIN, Math.max(slope, 11 + v * 0.05)));

  /* pts are [x, z, y] in metres (x east, z south, y up). Closed loop, start line at pts[0]-ish.
     jumps: u = fraction of the lap, len = ramp length, h = ramp height.   pads: u = fraction of the lap. */
  TT.TRACKS = [
    {
      id: 'sunny', name: 'Sunny Circuit', ja: 'サニー・サーキット', level: 'Easy', blurb: 'Wide, friendly corners and two little jumps.',
      width: 18, bankGain: 5, maxBank: 0.12, stage: [0.0, 0.5],
      bridge: { u: 0.58 }, jumps: [{ u: 0.34, len: 9, h: 2.4 }, { u: 0.80, len: 9, h: 2.4 }],
      pads: [{ u: 0.12 }, { u: 0.56 }, { u: 0.93 }],
      theme: { id: 'sunny' },
      pts: [
        [-60, 0, 0], [60, 0, 0], [170, -2, 0.5], [255, 15, 1.5], [310, 70, 2.5], [320, 145, 3], [290, 205, 2], [310, 265, 1],
        [345, 320, 0.5], [330, 385, 0.5], [290, 430, 1], [235, 445, 2], [190, 415, 2.5], [185, 355, 2], [150, 300, 1.5],
        [90, 275, 1], [20, 285, 0.5], [-50, 300, 0], [-105, 270, 0], [-140, 200, 0], [-150, 120, 0], [-135, 50, 0], [-100, 10, 0],
      ],
    },
    {
      id: 'rally', name: 'Hill Rally', ja: 'ヒル・ラリー', level: 'Medium', blurb: 'Rolling hills, big jumps and a hairpin!',
      width: 18, bankGain: 6, maxBank: 0.14, stage: [0.25, 0.75],
      tunnel: { u: 0.62, len: 90 }, bridge: { u: 0.05 }, jumps: [{ u: 0.20, len: 10, h: 3.0 }, { u: 0.50, len: 10, h: 3.2 }, { u: 0.82, len: 10, h: 3.0 }],
      pads: [{ u: 0.08 }, { u: 0.38 }, { u: 0.66 }, { u: 0.92 }],
      theme: { id: 'rally' },
      pts: [
        [-80, 2, 0], [60, 0, 0], [190, -3, 4], [290, -20, 10], [360, -60, 15], [395, -125, 17], [395, -200, 14], [360, -260, 10],
        [290, -295, 6], [200, -300, 3], [110, -300, 2], [30, -305, 3], [-30, -290, 5], [-65, -255, 6], [-55, -215, 6],
        [-10, -195, 5], [60, -200, 4], [140, -205, 6], [215, -190, 9], [255, -150, 10], [250, -100, 8], [200, -65, 5],
        [130, -55, 3], [50, -60, 2], [-30, -62, 1], [-95, -60, 0], [-135, -35, 0], [-125, -5, 0],
      ],
    },
    {
      id: 'night', name: 'Night Sprint', ja: 'ナイト・スプリント', level: 'Hard', blurb: 'Neon night run with tunnels, tight turns and boost pads.',
      width: 18, bankGain: 6, maxBank: 0.14, stage: [0.45, 1.0],
      tunnel: { u: 0.50, len: 100 }, bridge: { u: 0.43 }, jumps: [{ u: 0.30, len: 9, h: 2.8 }, { u: 0.74, len: 9, h: 2.8 }],
      pads: [{ u: 0.10 }, { u: 0.22 }, { u: 0.50 }, { u: 0.64 }, { u: 0.90 }],
      theme: { id: 'night' },
      pts: [
        [-80, 0, 0], [60, 0, 0], [200, 0, 0], [300, 2, 1], [355, 35, 2], [385, 100, 3], [368, 155, 4], [392, 205, 4], [372, 255, 3],
        [335, 305, 1], [270, 328, 0], [205, 326, 0], [150, 305, 1], [105, 330, 2], [40, 348, 2], [-30, 322, 1], [-80, 262, 0],
        [-95, 180, 0], [-100, 100, 0], [-98, 40, 0],
      ],
    },
  ];

  function wrapAng(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
  function smoothCirc(arr, win, passes) {
    const n = arr.length; let a = arr;
    for (let p = 0; p < passes; p++) {
      const b = new Float32Array(n);
      for (let i = 0; i < n; i++) { let s = 0; for (let j = -win; j <= win; j++) s += a[(i + j + n) % n]; b[i] = s / (2 * win + 1); }
      a = b;
    }
    return a;
  }

  /* Build the sampled track: arrays at ~2 m spacing + helpers. */
  TT.buildTrack = function (def) {
    const THREE = window.THREE;
    const pts3 = def.pts.map((p) => new THREE.Vector3(p[0], p[2] || 0, p[1]));
    const curve = new THREE.CatmullRomCurve3(pts3, true, 'centripetal');
    curve.arcLengthDivisions = 4000; curve.updateArcLengths();
    const total0 = curve.getLength();
    const N = Math.max(60, Math.round(total0 / 2));
    const step = total0 / N;
    const X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N);
    for (let i = 0; i < N; i++) { const p = curve.getPointAt(i / N); X[i] = p.x; Y[i] = p.y; Z[i] = p.z; }
    const FX = new Float32Array(N), FZ = new Float32Array(N), TH = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i + 1) % N, b = (i - 1 + N) % N;
      let dx = X[a] - X[b], dz = Z[a] - Z[b]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      FX[i] = dx; FZ[i] = dz; TH[i] = Math.atan2(dz, dx);
    }
    const K0 = new Float32Array(N);
    for (let i = 0; i < N; i++) K0[i] = wrapAng(TH[(i + 1) % N] - TH[(i - 1 + N) % N]) / (2 * step);
    const K = smoothCirc(K0, 5, 2);          // signed curvature, + = right turn
    const KB = smoothCirc(K0, 12, 2);        // wider smoothing for banking / camera
    const BANK = new Float32Array(N), PITCH = new Float32Array(N);
    for (let i = 0; i < N; i++) BANK[i] = Math.max(-def.maxBank, Math.min(def.maxBank, KB[i] * def.bankGain * 10));
    const PY = new Float32Array(N);
    for (let i = 0; i < N; i++) PY[i] = Math.atan2(Y[(i + 1) % N] - Y[(i - 1 + N) % N], 2 * step);
    PITCH.set(smoothCirc(PY, 3, 1));
    const L = total0;
    /* snap features to the first sufficiently straight stretch at/after a wanted distance */
    const straightAt = (s, need, kMax) => {
      let best = s, bc = 1e9; const win = Math.round(need / step);
      for (let off = -L * 0.1; off <= L * 0.1; off += step) {
        const s1 = s + off; if (s1 < 120 || s1 + need > L - 100) continue;
        const i0 = Math.floor(s1 / step); let m = 0;
        for (let d = 0; d <= win; d++) { const q = (i0 + d) % N; m = Math.max(m, Math.abs(KB[q]) * 1000 + Math.abs(BANK[q]) * 30); }
        const cost = m + Math.abs(off) * 0.01; if (cost < bc) { bc = cost; best = i0 * step; }
      }
      return best;
    };
    const jumps = (def.jumps || []).map((j) => ({ s0: straightAt(j.u * L, j.len + 100, 0) + 20, len: j.len, h: j.h, w: def.width }));
    const pads = (def.pads || []).map((p) => ({ s0: straightAt(p.u * L, 30, 0), len: p.len || 18 }));
    const feats = {};

    /* ---- overhead props must never sit where a car can be in the air ----
       zones = [launch - 8 m, launch + ramp + AIR_DIST]; tunnels, bridges, gantries and neon arches are placed OUTSIDE them. */
    const zones = jumps.map((j) => [j.s0 - 8, j.s0 + j.len + TT.AIR_DIST]);
    const taken = [];
    const hit = (a0, a1, b0, b1) => { for (let k = -1; k <= 1; k++) { const o = k * L; if (a0 < b1 + o && a1 > b0 + o) return true; } return false; };
    const inZone = (a, b) => zones.some((z) => hit(a, b, z[0], z[1]));
    const roughness = (s1, need) => { let m = 0; const i0 = Math.floor(s1 / step), win = Math.round(need / step); for (let d = 0; d <= win; d++) { const q = (i0 + d) % N; m = Math.max(m, Math.abs(KB[q]) * 1000 + Math.abs(BANK[q]) * 30); } return m; };
    /* nearest straight, jump-free stretch to the wanted distance; claims it so props never overlap each other */
    const clearSpot = (s, need, gap) => {
      gap = gap == null ? 30 : gap; let best = null, bc = 1e9;
      for (let off = 0; off <= L / 2; off += 2) for (const sg of off ? [1, -1] : [1]) {
        const s1 = s + sg * off; if (s1 < 40 || s1 + need > L - 40) continue;
        if (inZone(s1 - 6, s1 + need + 6)) continue;
        if (taken.some((t) => hit(s1 - gap, s1 + need + gap, t[0], t[1]))) continue;
        const cost = roughness(s1, need) + off * 0.004;
        if (cost < bc) { bc = cost; best = s1; }
        if (cost < 3 + off * 0.004 && roughness(s1, need) < 3) { taken.push([s1, s1 + need]); return s1; }
      }
      if (best == null) best = straightAt(s, need, 0);
      taken.push([best, best + need]); return best;
    };
    if (def.tunnel) feats.tunnel = { s0: clearSpot(def.tunnel.u * L, def.tunnel.len + 40, 10) + 20, len: def.tunnel.len };
    if (def.bridge) feats.bridge = { s0: clearSpot(def.bridge.u * L, 30, 20) + 15 };
    const gantries = [];
    [0.24, 0.47, 0.7, 0.9].forEach((u, i) => { gantries.push({ s: clearSpot(u * L, 14, 40) + 7, h: 10, i }); });
    const neon = [];
    if (def.theme && def.theme.id === 'night') {
      for (let s = 60, i = 0; s < L; s += 150, i++) {
        const q = Math.floor(s / step) % N, tn = feats.tunnel;
        if (Math.abs(KB[q]) > 0.006 || (tn && s > tn.s0 - 20 && s < tn.s0 + tn.len + 20) || inZone(s - 3, s + 3)) continue;
        neon.push({ s, i });
      }
    }

    const t = {
      def, N, step, L, width: def.width, X, Y, Z, FX, FZ, TH, K, KB, BANK, PITCH, jumps, pads, feats, straightAt, curve, gantries, neon, zones,
      overhead: [],
      /* lowest underside (world y) of any overhead prop above the car's footprint, or Infinity */
      ceilingAt(s, lat, halfLen) {
        s = this.wrap(s); let c = Infinity; const hl = halfLen == null ? 2.3 : halfLen;
        for (const o of this.overhead) {
          let d = s - o.s0; if (d > L / 2) d -= L; else if (d < -L / 2) d += L;
          if (d < -hl || d > o.s1 - o.s0 + hl) continue;
          if (lat + TT.CAR.hw < o.latMin || lat - TT.CAR.hw > o.latMax) continue;
          const b = o.R ? o.y + Math.sqrt(Math.max(0, o.R * o.R - lat * lat)) - 0.45 : o.y;
          if (b < c) c = b;
        }
        return c;
      },
      wrap(s) { s %= L; return s < 0 ? s + L : s; },
      /* sample at distance s; fills out */
      at(s, o) {
        s = this.wrap(s); const f = s / step; const i = Math.floor(f), a = f - i, j = (i + 1) % N;
        o.x = X[i] + (X[j] - X[i]) * a; o.y = Y[i] + (Y[j] - Y[i]) * a; o.z = Z[i] + (Z[j] - Z[i]) * a;
        let fx = FX[i] + (FX[j] - FX[i]) * a, fz = FZ[i] + (FZ[j] - FZ[i]) * a; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
        o.fx = fx; o.fz = fz; o.rx = -fz; o.rz = fx;
        o.bank = BANK[i] + (BANK[j] - BANK[i]) * a; o.k = K[i] + (K[j] - K[i]) * a; o.kb = KB[i] + (KB[j] - KB[i]) * a;
        o.pitch = PITCH[i] + (PITCH[j] - PITCH[i]) * a;
        return o;
      },
      wedge(s) {
        s = this.wrap(s);
        for (let q = 0; q < jumps.length; q++) { const j = jumps[q], u = s - j.s0; if (u >= 0 && u <= j.len) return j.h * (u / j.len); }
        return 0;
      },
      baseY(s) { s = this.wrap(s); const f = s / step; const i = Math.floor(f), a = f - i; return Y[i] + (Y[(i + 1) % N] - Y[i]) * a; },
      bankAt(s) { s = this.wrap(s); const f = s / step; const i = Math.floor(f), a = f - i; return BANK[i] + (BANK[(i + 1) % N] - BANK[i]) * a; },
      /* height of the driving surface at distance s and lateral offset lat (+ = right) */
      roadY(s, lat) { return this.baseY(s) + this.wedge(s) - lat * Math.sin(this.bankAt(s)); },
      jumpAt(s) { s = this.wrap(s); for (const j of jumps) if (s >= j.s0 && s <= j.s0 + j.len) return j; return null; },
    };
    /* ---- overhead catalogue (world y of each underside) - mirrors what world.js builds ---- */
    {
      const W = def.width, hw = W / 2, by = (q) => t.baseY(q);
      for (const gn of gantries) t.overhead.push({ kind: 'gantry', s0: gn.s - 1.2, s1: gn.s + 1.2, latMin: -(W + 9) / 2 - 1, latMax: (W + 9) / 2 + 1, y: by(gn.s) + gn.h - 3.2 });
      t.overhead.push({ kind: 'startGantry', s0: 5 - 1.2, s1: 5 + 1.2, latMin: -(W + 9) / 2 - 1, latMax: (W + 9) / 2 + 1, y: by(5) + 11.5 - 3.2 });
      t.overhead.push({ kind: 'startLights', s0: 5 - 1.2, s1: 5 + 1.2, latMin: -7.5, latMax: 7.5, y: by(5) + 5.5 });
      if (feats.bridge) {
        const b0 = feats.bridge.s0;
        t.overhead.push({ kind: 'bridge', s0: b0 - 7.5, s1: b0 + 7.5, latMin: -(W + 30) / 2, latMax: (W + 30) / 2, y: by(b0) + 9.2 });
        t.overhead.push({ kind: 'bridgeSign', s0: b0 - 7.6, s1: b0 - 6.4, latMin: -7.2, latMax: 7.2, y: by(b0) + 5.9 });
      }
      if (feats.tunnel) {
        const T0 = feats.tunnel.s0, T1 = T0 + feats.tunnel.len;
        for (let q = T0; q < T1; q += 6) t.overhead.push({ kind: 'tunnel', s0: q, s1: q + 6, latMin: -hw - 4.5, latMax: hw + 4.5, y: Math.min(by(q), by(q + 6)) + 12.5 });
      }
      for (const n of neon) t.overhead.push({ kind: 'neon', s0: n.s - 0.6, s1: n.s + 0.6, latMin: -hw - 4, latMax: hw + 4, y: by(n.s), R: hw + 3.5 });
    }
    // spatial hash for nearest-sample queries
    const CELL = 24, grid = new Map();
    const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;
    for (let i = 0; i < N; i++) { const k = key(Math.floor(X[i] / CELL), Math.floor(Z[i] / CELL)); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(i); }
    /* nearest track sample to (x,z) within maxD; returns index or -1, distance in t._d */
    t.nearest = (x, z, maxD) => {
      const r = Math.ceil(maxD / CELL), cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      let best = -1, bd = maxD * maxD;
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
        const arr = grid.get(key(cx + a, cz + b)); if (!arr) continue;
        for (let q = 0; q < arr.length; q++) { const i = arr[q]; const dx = X[i] - x, dz = Z[i] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
      }
      t._d = Math.sqrt(bd); return best;
    };
    // stats (min radius, closest approach of non-adjacent parts)
    let minR = 1e9, minRi = 0; for (let i = 0; i < N; i++) { const r = 1 / Math.max(1e-5, Math.abs(K[i])); if (r < minR) { minR = r; minRi = i; } }
    t.minRadius = minR; t.minRadiusAt = minRi * step;
    // mini-map polygon in 0..1 space
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < N; i++) { x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); z0 = Math.min(z0, Z[i]); z1 = Math.max(z1, Z[i]); }
    t.bounds = { x0, x1, z0, z1 };
    return t;
  };
})();
