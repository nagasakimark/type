/* Turbo Type - layered car engine audio (pure Web Audio, no files).  Works with a realtime AudioContext and with an
   OfflineAudioContext (the numeric test in _dev/audio-test.py renders it and checks level, clicks and loop seams).

   Layers (all loop seamlessly: every buffer holds a whole number of cycles of its partials, noise has a cross-faded seam):
     rumble  - low firing-pulse buffer (40 Hz fundamental) played at a rate that follows virtual RPM, with a half-order burble
     whine   - smooth harmonic "turbine" tone that follows road speed continuously, swells with throttle and boost
     wind    - band-passed noise, grows with speed (and in the air)
     tyre    - low-passed road roar, grounded only
     skid    - narrow band-passed squeal on hard corners
   plus one-shots: shift blip (tiny duck + chirp), blow-off hiss after nitro, landing thump.
   Pitch/volume are driven from a small RPM model with 6 virtual gears; all changes go through setTargetAtTime (no zipper noise). */
(function () {
  'use strict';
  const TT = (window.TT = window.TT || {});
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const GEARS = [0, 15, 29, 43, 57, 71, 1e9];          // upshift speeds (m/s)
  const F0_RUMBLE = 40, F0_WHINE = 200;

  /* deterministic pseudo random so the buffers are identical every run */
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  function makeRumble(ctx) {
    const sr = ctx.sampleRate, n = sr, b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0), R = rng(7);
    // partials at integer multiples of 40 Hz (1 s = 40 cycles) + sub-orders at 10/20/30 Hz for the cylinder-to-cylinder burble
    const parts = [];
    for (let k = 1; k <= 28; k++) parts.push([k * F0_RUMBLE, Math.pow(k, -1.15) * (k % 2 === 0 ? 1.15 : 1), R() * 6.283]);
    for (const f of [10, 20, 30]) parts.push([f, 0.22, R() * 6.283]);
    for (let i = 0; i < n; i++) {
      const t = i / sr; let v = 0;
      for (let p = 0; p < parts.length; p++) v += parts[p][1] * Math.sin(6.283185307 * parts[p][0] * t + parts[p][2]);
      d[i] = v;
    }
    // soft-clip for a warmer, fuller tone then normalise
    let pk = 0; for (let i = 0; i < n; i++) { d[i] = Math.tanh(d[i] * 0.9); pk = Math.max(pk, Math.abs(d[i])); }
    for (let i = 0; i < n; i++) d[i] /= pk * 1.0;
    return b;
  }
  function makeWhine(ctx) {
    const sr = ctx.sampleRate, n = sr, b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    const parts = [[1, 1], [2, 0.42], [3, 0.26], [4, 0.1], [6, 0.08]];
    for (let i = 0; i < n; i++) {
      const t = i / sr; let v = 0;
      for (const [k, a] of parts) v += a * Math.sin(6.283185307 * k * F0_WHINE * t);
      d[i] = v * (1 + 0.08 * Math.sin(6.283185307 * 8 * t));      // 8 Hz flutter = whole cycles in 1 s
    }
    let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i])); for (let i = 0; i < n; i++) d[i] /= pk;
    return b;
  }
  function makeNoise(ctx, seconds, seed) {
    const sr = ctx.sampleRate, n = Math.round(sr * seconds), x = Math.round(sr * 0.25), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0), R = rng(seed);
    const raw = new Float32Array(n + x); for (let i = 0; i < raw.length; i++) raw[i] = R() * 2 - 1;
    // equal-power cross-fade of the tail into the head -> the loop point is continuous
    for (let i = 0; i < n; i++) d[i] = raw[i];
    for (let i = 0; i < x; i++) { const a = i / x; d[i] = raw[i] * Math.sin(a * 1.5708) + raw[n + i] * Math.cos(a * 1.5708); }
    return b;
  }

  function create(ctx, dest, opts) {
    opts = opts || {};
    const out = ctx.createGain(); out.gain.value = 0;
    out.connect(dest);
    const loop = (buf, rate) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; return s; };
    const chain = (src, nodes, gain0) => { let n = src; const g = ctx.createGain(); g.gain.value = gain0 || 0; for (const x of nodes) { n.connect(x); n = x; } n.connect(g); g.connect(out); return g; };
    const filt = (type, f, q) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; if (q != null) x.Q.value = q; return x; };

    const rumbleBuf = makeRumble(ctx), whineBuf = makeWhine(ctx), noiseBuf = makeNoise(ctx, 2, 11), noiseBuf2 = makeNoise(ctx, 3, 23);
    const E = {};
    E.rumble = loop(rumbleBuf, 1); E.rumbleLP = filt('lowpass', 400, 0.7); E.rumbleG = chain(E.rumble, [E.rumbleLP], 0);
    E.sub = loop(rumbleBuf, 0.5); E.subLP = filt('lowpass', 160, 0.5); E.subG = chain(E.sub, [E.subLP], 0);         // octave below: body
    E.whine = loop(whineBuf, 1); E.whineLP = filt('lowpass', 2600, 0.5); E.whineG = chain(E.whine, [E.whineLP], 0);
    E.whine2 = loop(whineBuf, 1.5); E.whine2G = chain(E.whine2, [filt('lowpass', 3200, 0.5)], 0);                       // a fifth above, boost only
    E.wind = loop(noiseBuf, 1); E.windBP = filt('bandpass', 700, 0.6); E.windG = chain(E.wind, [E.windBP], 0);
    E.tyre = loop(noiseBuf2, 1); E.tyreLP = filt('lowpass', 260, 0.7); E.tyreG = chain(E.tyre, [E.tyreLP], 0);
    E.skid = loop(noiseBuf, 1.3); E.skidBP = filt('bandpass', 1900, 5); E.skidG = chain(E.skid, [E.skidBP, filt('lowpass', 4200, 0.5)], 0);
    const t0 = ctx.currentTime;
    for (const k of ['rumble', 'sub', 'whine', 'whine2', 'wind', 'tyre', 'skid']) E[k].start(t0, k === 'wind' ? 0.37 : k === 'skid' ? 0.9 : 0);

    const st = { rpm: 0.1, gear: 0, shiftT: 0, lastShift: -9, duck: 0, boostPrev: 0, v: 0, thr: 0, air: 0, on: 0 };
    const TC = 0.05;
    const set = (p, v, when, tc) => p.setTargetAtTime(v, when, tc || TC);

    /* one-shot helpers (scheduled relative to `when`) */
    function noiseBurst(when, dur, f, q, vol) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = false; const bp = filt('bandpass', f, q), g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(vol, when + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      s.connect(bp); bp.connect(g); g.connect(out); s.start(when, 0.5); s.stop(when + dur + 0.05);
    }
    E.thump = function (str, when) {
      when = when == null ? ctx.currentTime : when; str = clamp(str, 0.2, 1.4);
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(95, when); o.frequency.exponentialRampToValueAtTime(38, when + 0.16);
      g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.55 * str, when + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);
      o.connect(g); g.connect(out); o.start(when); o.stop(when + 0.32);
      noiseBurst(when, 0.2, 320, 0.8, 0.22 * str);                   // soft chassis "whump"
    };
    E.blowOff = function (when) { noiseBurst(when, 0.32, 3400, 1.2, 0.07); noiseBurst(when + 0.05, 0.25, 1500, 0.8, 0.04); };

    /* s = { v (m/s), thr 0..1, boost 0..1, air 0/1, skid 0..1, on 0/1, vol 0..1 }; dt seconds; when = ctx time */
    E.update = function (s, dt, when) {
      dt = clamp(dt, 0.001, 0.1); when = when == null ? ctx.currentTime : when;
      const v = Math.max(0, s.v), on = s.on ? 1 : 0, boost = clamp(s.boost, 0, 1), thr = clamp(s.thr, 0, 1), air = s.air ? 1 : 0;
      // ---- virtual gearbox: hysteresis + minimum time between shifts
      let g = st.gear;
      if (when - st.lastShift > 0.35) {
        if (g < GEARS.length - 2 && v > GEARS[g + 1]) { g++; st.lastShift = when; st.duck = 1; E.blip(when, +1); }
        else if (g > 0 && v < GEARS[g] - 5) { g--; st.lastShift = when; E.blip(when, -1); }
      }
      st.gear = g;
      const lo = GEARS[g] - (g > 0 ? 3 : 0), hi = Math.min(GEARS[g + 1], GEARS[g] + 20);
      let rpmT = clamp((v - lo) / Math.max(1, hi - lo), 0, 1) * 0.86 + 0.08 + thr * 0.05;
      if (air) rpmT = Math.min(1, rpmT + 0.18);                    // wheels off the ground: engine free-revs
      rpmT += boost * 0.08;
      // asymmetric smoothing: revs rise fast, fall a little slower -> shifts drop the note smoothly
      const k = rpmT > st.rpm ? 7 : 4.5; st.rpm += (rpmT - st.rpm) * (1 - Math.exp(-k * dt));
      st.duck = Math.max(0, st.duck - dt / 0.16);
      const duck = 1 - 0.32 * Math.sin(Math.min(1, st.duck) * 3.14159 * 0.5 + 0.0) * (st.duck > 0 ? 1 : 0);

      const f = 36 + 112 * Math.pow(st.rpm, 0.9);                     // firing frequency 36..148 Hz
      const sp = clamp(v / 85, 0, 1);
      const idle = on ? (v < 1.5 ? 1 : 0) : 0;
      const load = 0.55 + 0.45 * thr;
      set(E.rumble.playbackRate, f / F0_RUMBLE, when); set(E.sub.playbackRate, f / F0_RUMBLE * 0.5, when);
      set(E.rumbleLP.frequency, 260 + 1500 * st.rpm * load + 500 * boost, when);
      set(E.rumbleG.gain, on * duck * (0.10 + 0.12 * st.rpm * load + 0.05 * thr + 0.04 * boost), when);
      set(E.subG.gain, on * duck * (0.12 + 0.04 * sp), when);
      // whine follows speed continuously (smooth, no gear steps), swells with throttle/boost
      const wf = 0.9 + sp * 2.3 + boost * 0.55;
      set(E.whine.playbackRate, wf, when, 0.07); set(E.whine2.playbackRate, wf * 1.5, when, 0.07);
      set(E.whineLP.frequency, 1200 + 2400 * sp + 1200 * boost, when);
      set(E.whineG.gain, on * duck * (0.012 + 0.09 * sp * (0.5 + 0.5 * thr) + 0.06 * boost), when, 0.09);
      set(E.whine2G.gain, on * 0.045 * boost * boost, when, 0.12);
      // wind / road
      set(E.windBP.frequency, 450 + 1500 * sp + 500 * air, when); set(E.windBP.Q, 0.5 + sp, when);
      set(E.windG.gain, on * (0.012 + 0.22 * sp * sp + 0.03 * air + 0.06 * boost * sp), when, 0.12);
      set(E.tyreLP.frequency, 180 + 520 * sp, when);
      set(E.tyreG.gain, on * (1 - air) * (0.02 + 0.30 * sp), when, 0.08);
      const sk = on * (1 - air) * clamp(s.skid || 0, 0, 1) * clamp((v - 20) / 25, 0, 1);
      set(E.skidBP.frequency, 1700 + 700 * sp + 200 * Math.sin(when * 23), when, 0.06);
      set(E.skidG.gain, 0.085 * sk, when, 0.05);
      // master (user sfx volume) - fades in/out so pause / results never click
      set(out.gain, on * clamp(s.vol == null ? 1 : s.vol, 0, 1) * (opts.level == null ? 0.3 : opts.level), when, on ? 0.08 : 0.05);
      // nitro ends -> blow-off hiss
      if (st.boostPrev > 0.5 && boost <= 0.5 && on) E.blowOff(when);
      st.boostPrev = boost;
    };
    /* short chirp + duck on a gear change (up = little pitch drop is already produced by the rpm model) */
    E.blip = function (when, dir) {
      if (!E._blipOn) return;
      noiseBurst(when, 0.07, dir > 0 ? 900 : 600, 2.5, dir > 0 ? 0.03 : 0.02);
    };
    E._blipOn = true;
    E.state = st;
    E.stop = function () { for (const k of ['rumble', 'sub', 'whine', 'whine2', 'wind', 'tyre', 'skid']) { try { E[k].stop(); } catch (e) { } } };
    return E;
  }
  TT.EngineAudio = { create, GEARS };
})();
