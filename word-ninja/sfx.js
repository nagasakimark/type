/* Word Ninja - all sounds are short synthesized one-shots (no looping, no long samples).
   Every voice is envelope-limited, disconnects itself when done, and is capped by a voice limiter. */
(function () {
  'use strict';
  const WN = (window.WN = window.WN || {});
  let ctx = null, bus = null, noiseBuf = null;
  const MAX_VOICES = 7, MIN_GAP = 0.045;
  let voices = []; // {end, pri}
  const lastPlay = {};
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(ctx.destination);
      bus = ctx.createGain(); bus.gain.value = 0.55; bus.connect(comp);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate >> 1, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
    return ctx;
  }
  const go = () => { if (ensure() && ctx.state === 'suspended') ctx.resume(); };
  window.addEventListener('keydown', go, { capture: true });
  window.addEventListener('pointerdown', go, { capture: true });
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const PENT = [0, 2, 4, 7, 9]; // major pentatonic: always consonant
  const pent = (i) => 60 + 12 * Math.floor(i / 5) + PENT[((i % 5) + 5) % 5];

  /* envelope helper: soft attack, exponential release, hard stop; node disconnects on end */
  function env(t, dur, vol, out, attack = 0.006) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out); return g;
  }
  function tone(t, freq, dur, vol, o = {}) {
    const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    const g = env(t, dur, vol, o.out, o.attack);
    osc.connect(g); osc.start(t); osc.stop(t + dur + 0.03);
    osc.onended = () => { osc.disconnect(); g.disconnect(); };
  }
  function noise(t, dur, vol, o = {}) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = o.q || 0.8;
    f.frequency.setValueAtTime(o.f0 || 2000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    const g = env(t, dur, vol, o.out, o.attack);
    src.connect(f); f.connect(g); src.start(t, Math.random() * 0.3, dur + 0.03); src.stop(t + dur + 0.03);
    src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
  }

  /* ---- recipes: (t, out, rate, o) ---- */
  const R = {
    slice(t, out, r) { // crisp whoosh + juicy squish
      noise(t, 0.11, 0.38, { out, f0: 4200 * r, f1: 1100 * r, q: 1.2, attack: 0.012 });
      noise(t + 0.045, 0.1, 0.34, { out, type: 'lowpass', f0: 1100 * r, f1: 260, q: 0.7 });
      tone(t + 0.04, 340 * r, 0.09, 0.2, { out, to: 150 * r });
      tone(t + 0.075, 520 * r, 0.05, 0.08, { out, to: 260 * r });
    },
    swish(t, out, r) { noise(t, 0.16, 0.3, { out, f0: 700 * r, f1: 3400 * r, q: 1, attack: 0.05 }); },
    chime(t, out, r, o) { // tonal combo chime; o.step = pentatonic index (rises with streak)
      const n = pent(o.step || 0) + 12, f = hz(n);
      tone(t, f, 0.34, 0.2, { out, type: 'sine' });
      tone(t, f * 2.005, 0.22, 0.05, { out, type: 'sine' });
      if ((o.step || 0) >= 2) tone(t + 0.07, hz(pent((o.step || 0) + 2) + 12), 0.3, 0.14, { out });
    },
    thud(t, out, r) { tone(t, 120 * r, 0.28, 0.5, { out, to: 48 }); noise(t, 0.08, 0.2, { out, type: 'lowpass', f0: 500, f1: 150 }); },
    poof(t, out, r) { noise(t, 0.38, 0.4, { out, type: 'lowpass', f0: 1600 * r, f1: 180, attack: 0.02 }); tone(t, 200, 0.2, 0.15, { out, to: 80 }); },
    crack(t, out, r) { noise(t, 0.09, 0.4, { out, type: 'highpass', f0: 1800 * r, q: 0.5 }); tone(t, 200 * r, 0.12, 0.25, { out, to: 90 }); },
    split(t, out, r) { R.crack(t, out, 0.8); noise(t + 0.02, 0.3, 0.3, { out, type: 'lowpass', f0: 1400, f1: 200 }); tone(t, 150, 0.35, 0.4, { out, to: 50 }); },
    whoopdown(t, out, r) { tone(t, 520 * r, 0.26, 0.18, { out, to: 150 * r, type: 'triangle' }); },
    freeze(t, out) { [0, 2, 4, 7].forEach((s, i) => tone(t + i * 0.07, hz(84 + s), 0.5, 0.1, { out })); noise(t, 0.4, 0.12, { out, type: 'highpass', f0: 5000, q: 0.5, attack: 0.1 }); },
    frenzy(t, out) { [0, 4, 7, 12].forEach((s, i) => tone(t + i * 0.06, hz(67 + s), 0.28, 0.16, { out, type: 'triangle' })); },
    golden(t, out) { [0, 4, 7, 12, 16].forEach((s, i) => tone(t + i * 0.05, hz(79 + s), 0.3, 0.12, { out })); },
  };
  R.combo = (t, out, r, o) => R.chime(t, out, r, o);
  R.squelch1 = R.squelch2 = (t, out, r) => R.slice(t, out, r);
  R.swish1 = R.swish2 = R.swish3 = R.swish;
  R.ding = (t, out, r, o) => R.chime(t, out, r, { step: 2 });

  WN.snd = function (name, o = {}) {
    const vol = (TM.settings.sfx || 0) * (o.vol ?? 0.7);
    const fn = R[name];
    if (!fn || vol <= 0 || !ensure() || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (now - (lastPlay[name] || -9) < MIN_GAP) return; // no machine-gun retriggers
    voices = voices.filter((v) => v.end > now);
    const pri = o.pri ?? (name === 'slice' ? 1 : 2);
    if (voices.length >= MAX_VOICES) { if (pri <= 1) return; voices.sort((a, b) => a.pri - b.pri || a.end - b.end); if (voices[0].pri > pri) return; voices.shift(); }
    lastPlay[name] = now;
    const out = ctx.createGain(); out.gain.value = Math.min(1, vol); out.connect(bus);
    const t = now + 0.005 + (o.delay || 0);
    const rate = (o.rate ?? 1) * (1 + (Math.random() - 0.5) * (o.jitter ?? 0.08));
    fn(t, out, rate, o);
    voices.push({ end: t + 0.6, pri });
    setTimeout(() => { try { out.disconnect(); } catch (e) {} }, (o.delay || 0) * 1000 + 1200);
  };
  WN.sndPick = (arr, o) => WN.snd(arr[Math.floor(Math.random() * arr.length)], o);
  WN.sndStats = () => ({ voices: voices.length });
})();
