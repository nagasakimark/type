/* Typing Master - audio: synthesized sound effects and simple music loops (no audio files). */
(function () {
  'use strict';
  const TM = window.TM;
  let ctx = null, master = null, sfxBus = null, musBus = null;
  let music = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    musBus = ctx.createGain(); musBus.connect(comp);
    applyVolume();
    return ctx;
  }
  function applyVolume() {
    if (!ctx) return;
    sfxBus.gain.value = TM.settings.sfx * 0.6;
    musBus.gain.value = TM.settings.music * 0.28;
  }
  function unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }
  window.addEventListener('keydown', unlock, { capture: true });
  window.addEventListener('pointerdown', unlock, { capture: true });

  function tone(freq, dur, o = {}) {
    const c = ensure(); if (!c || TM.settings.sfx <= 0) return;
    const t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(); const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    const v = (o.vol ?? 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(dur, o = {}) {
    const c = ensure(); if (!c || TM.settings.sfx <= 0) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 1, c.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(); src.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = o.filter || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1800, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    f.Q.value = o.q || 1;
    const g = c.createGain(); g.gain.setValueAtTime(o.vol ?? 0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t); src.stop(t + dur + 0.02);
  }

  const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // midi -> Hz

  const sfx = {
    key() { noise(0.035, { freq: 3200 + Math.random() * 800, q: 2, vol: 0.18 }); tone(1400 + Math.random() * 200, 0.03, { type: 'triangle', vol: 0.05 }); },
    miss() { tone(140, 0.16, { type: 'triangle', slide: 90, vol: 0.35 }); },
    word() { [72, 76, 79].forEach((n, i) => tone(N(n), 0.18, { type: 'triangle', vol: 0.22, delay: i * 0.045 })); },
    big() { [72, 76, 79, 84].forEach((n, i) => tone(N(n), 0.25, { type: 'square', vol: 0.1, delay: i * 0.06 })); },
    combo(level) { const b = 72 + (level || 0) * 2; [b, b + 4, b + 7, b + 12].forEach((n, i) => tone(N(n), 0.16, { type: 'square', vol: 0.08, delay: i * 0.04 })); noise(0.3, { freq: 600, sweep: 4000, vol: 0.12 }); },
    pop() { tone(500, 0.12, { type: 'sine', slide: 1200, vol: 0.3 }); },
    splat() { noise(0.25, { filter: 'lowpass', freq: 1400, sweep: 200, vol: 0.5 }); tone(220, 0.12, { type: 'sine', slide: 80, vol: 0.25 }); },
    slice() { noise(0.18, { freq: 5000, sweep: 1200, q: 3, vol: 0.35 }); },
    jump() { tone(300, 0.18, { type: 'square', slide: 700, vol: 0.12 }); },
    land() { noise(0.08, { filter: 'lowpass', freq: 500, vol: 0.3 }); },
    zap() { tone(1200, 0.12, { type: 'sawtooth', slide: 300, vol: 0.1 }); },
    boost() { noise(0.8, { freq: 300, sweep: 3000, vol: 0.25 }); tone(110, 0.8, { type: 'sawtooth', slide: 330, vol: 0.12 }); },
    hurt() { tone(330, 0.3, { type: 'square', slide: 110, vol: 0.15 }); noise(0.2, { filter: 'lowpass', freq: 800, vol: 0.3 }); },
    beep(hi) { tone(hi ? 880 : 440, hi ? 0.35 : 0.15, { type: 'square', vol: 0.12 }); },
    win() { [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(N(n), 0.3, { type: 'triangle', vol: 0.2, delay: i * 0.08 })); },
    lose() { [67, 63, 60, 55].forEach((n, i) => tone(N(n), 0.35, { type: 'triangle', vol: 0.2, delay: i * 0.14 })); },
    star(i) { tone(N(76 + i * 4), 0.4, { type: 'triangle', vol: 0.25 }); tone(N(88 + i * 4), 0.3, { type: 'sine', vol: 0.1, delay: 0.05 }); },
    click() { tone(900, 0.05, { type: 'triangle', vol: 0.15 }); },
    whoosh() { noise(0.35, { freq: 400, sweep: 2500, vol: 0.2 }); },
  };

  /* Music: a tiny step sequencer. A song = { bpm, bass:[midi|null x16], chords:[[midi..] x4], lead:[midi|null x16], wave } */
  function startMusic(song) {
    stopMusic();
    const c = ensure(); if (!c) return;
    const spb = 60 / song.bpm / 4; // 16th notes
    let step = 0, next = c.currentTime + 0.1;
    const play = (freq, t, dur, type, vol) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(musBus); o.start(t); o.stop(t + dur + 0.05);
    };
    const len = song.bass.length;
    const timer = setInterval(() => {
      if (!ctx || TM.settings.music <= 0) { next = c.currentTime + 0.1; return; }
      while (next < c.currentTime + 0.2) {
        const s = step % len, bar = Math.floor(step / 16) % song.chords.length;
        const b = song.bass[s]; if (b != null) play(N(b), next, spb * 1.8, 'triangle', 0.5);
        if (s % 4 === 0) for (const n of song.chords[bar]) play(N(n), next, spb * 3.5, song.pad || 'sine', 0.08);
        const l = song.lead && song.lead[step % song.lead.length]; if (l != null) play(N(l), next, spb * 1.6, song.wave || 'square', 0.07);
        if (song.drums) {
          if (s % 8 === 0) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, next); o.frequency.exponentialRampToValueAtTime(40, next + 0.12); g.gain.setValueAtTime(0.6, next); g.gain.exponentialRampToValueAtTime(0.0001, next + 0.15); o.connect(g); g.connect(musBus); o.start(next); o.stop(next + 0.2); }
          if (s % 4 === 2 && noiseBuf) { const src = c.createBufferSource(); src.buffer = noiseBuf; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000; const g = c.createGain(); g.gain.setValueAtTime(0.15, next); g.gain.exponentialRampToValueAtTime(0.0001, next + 0.05); src.connect(f); f.connect(g); g.connect(musBus); src.start(next); src.stop(next + 0.06); }
        }
        next += spb; step++;
      }
    }, 50);
    if (!noiseBuf) noise(0.01, { vol: 0.0001 });
    music = { timer };
  }
  function stopMusic() { if (music) { clearInterval(music.timer); music = null; } }

  /* song({bpm, roots:[midi x bars], chords:[[..] x bars], lead:[midi|null ...], bassPattern, wave, pad, drums}) */
  function song(o) {
    const pat = o.bassPattern || [0, null, 12, null, 7, null, 12, null, 0, null, 12, null, 7, null, 12, 10];
    const bass = [];
    for (const r of o.roots) for (const p of pat) bass.push(p == null ? null : r + p);
    return { bpm: o.bpm, bass, chords: o.chords, lead: o.lead, wave: o.wave, pad: o.pad, drums: o.drums !== false };
  }
  TM.audio = { sfx, startMusic, stopMusic, applyVolume, unlock, N, song };
  TM.sfx = sfx;
})();
