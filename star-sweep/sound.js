/* Star Sweep - Kenney sci-fi / digital-audio sound effects (decoded lazily after the first key press) + a layered space music loop. */
(function () {
  'use strict';
  const SS = window.SS, TM = window.TM, U = TM.U;
  const BASE = '../assets/kenney/star-sweep/audio/';
  const FILES = (window.SS_MANIFEST && window.SS_MANIFEST.audio) || {};
  let ctx = null, sfxBus = null, musBus = null, delayIn = null, noiseBuf = null;
  const bufs = {};
  let loading = false;
  const snd = (SS.snd = { ready: false });

  /* groups: name -> candidate buffer keys */
  const GROUPS = {
    laser: ['laserSmall0', 'laserSmall1', 'laserSmall2', 'laserSmall3', 'laserSmall4'],
    laserFinal: ['laserRetro0', 'laserRetro1', 'laserRetro2'],
    laserBig: ['laserLarge0', 'laserLarge1'],
    hit: ['metal0', 'metal1', 'metal2'],
    boom: ['crunch0', 'crunch1', 'crunch2', 'crunch4'],
    bigBoom: ['boom0', 'crunch3'],
    hugeBoom: ['boom0', 'boom1', 'crunch3'],
    field: ['field0', 'field1', 'field2'],
    power: ['power1', 'power2', 'power3', 'power5', 'power8', 'power10'],
    wave: ['phaserUp1', 'phaserUp3', 'phaserUp5'],
    shieldBreak: ['phaseJump1', 'phaseJump3'],
    combo: ['threeTone1', 'threeTone2'],
    clear: ['threeTone2', 'zapThreeToneUp'],
    hurt: ['lowDown', 'metal0'],
  };
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    const master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.connect(master); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    musBus = ctx.createGain(); musBus.connect(comp);
    delayIn = ctx.createGain(); const dl = ctx.createDelay(1.0); dl.delayTime.value = 0.34; const fb = ctx.createGain(); fb.gain.value = 0.36; const wet = ctx.createGain(); wet.gain.value = 0.55;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    delayIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(musBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    snd.applyVolume();
    return ctx;
  }
  snd.applyVolume = function () {
    if (!ctx) return;
    sfxBus.gain.value = TM.settings.sfx * 0.85;
    musBus.gain.value = TM.settings.music * 0.5;
  };
  snd.unlock = function () {
    const c = ensure(); if (!c) return;
    if (c.state === 'suspended' && !snd.paused) c.resume();
    if (!loading) {
      loading = true;
      let pending = 0;
      for (const k in FILES) {
        pending++;
        fetch(BASE + FILES[k]).then((r) => r.arrayBuffer()).then((ab) => new Promise((res, rej) => c.decodeAudioData(ab, res, rej))).then((b) => { bufs[k] = b; }).catch(() => {}).finally(() => { if (--pending === 0) snd.ready = true; });
      }
    }
  };
  window.addEventListener('keydown', () => snd.unlock(), { capture: true });
  window.addEventListener('pointerdown', () => snd.unlock(), { capture: true });

  /* play('laser', {vol, rate, delay}) - name is a group or a buffer key */
  snd.play = function (name, o) {
    if (!ctx || TM.settings.sfx <= 0 || ctx.state !== 'running') return false;
    o = o || {};
    const g = GROUPS[name]; const key = g ? U.pick(g) : name; const b = bufs[key]; if (!b) return false;
    const src = ctx.createBufferSource(); src.buffer = b;
    src.playbackRate.value = (o.rate || 1) * (o.jitter === false ? 1 : U.rand(0.96, 1.04));
    const gn = ctx.createGain(); gn.gain.value = o.vol ?? 0.6;
    let node = gn;
    if (o.pan != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = U.clamp(o.pan, -1, 1); gn.connect(p); node = p; }
    src.connect(gn); node.connect(sfxBus);
    src.start(ctx.currentTime + (o.delay || 0));
    return true;
  };
  snd.pause = function (flag) {
    snd.paused = flag; if (!ctx) return;
    if (flag && ctx.state === 'running') ctx.suspend(); else if (!flag && ctx.state === 'suspended') ctx.resume();
  };

  /* ---- synthesised weapon sounds (no files needed): rattle = minigun burst, whoosh = missile, beam = laser sweep, fanfare = upgrade ---- */
  function sfxNoise(t, dur, vol, type, freq, q) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  function sfxOsc(type, f, t, dur, vol, slide, lp) {
    const g = ctx.createGain(); const os = ctx.createOscillator(); os.type = type; os.frequency.setValueAtTime(f, t);
    if (slide) os.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = os; if (lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; os.connect(f2); n = f2; }
    n.connect(g); g.connect(sfxBus); os.start(t); os.stop(t + dur + 0.05);
  }
  snd.synth = function (kind, o) {
    if (!ctx || TM.settings.sfx <= 0 || ctx.state !== 'running' || !noiseBuf) return;
    o = o || {}; const t = ctx.currentTime + (o.delay || 0), v = o.vol ?? 0.5;
    if (kind === 'rattle') { // a burst of 6 quick pops + a low thump
      for (let i = 0; i < 6; i++) { sfxNoise(t + i * 0.014, 0.05, v * 0.5, 'bandpass', 1900 + Math.random() * 900, 0.9); sfxOsc('square', 210 + Math.random() * 30, t + i * 0.014, 0.04, v * 0.16, 90, 900); }
      sfxOsc('sine', 120, t, 0.12, v * 0.5, 50);
    } else if (kind === 'whoosh') { sfxNoise(t, 0.5, v * 0.5, 'bandpass', 700, 0.7); sfxOsc('sawtooth', 300, t, 0.4, v * 0.12, 900, 1500); }
    else if (kind === 'beam') { sfxOsc('sawtooth', 520, t, 0.32, v * 0.22, 140, 2400); sfxOsc('square', 260, t, 0.32, v * 0.12, 70, 1400); sfxNoise(t, 0.3, v * 0.28, 'highpass', 3000, 0.8); }
    else if (kind === 'fanfare') {
      const tier = o.tier || 1; const base = 60 + tier * 2; const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
      const seq = [0, 4, 7, 12, 16, 19, 24].slice(0, 4 + Math.min(3, tier));
      seq.forEach((n, i) => { sfxOsc('square', N(base + n), t + i * 0.07, 0.22, v * 0.2, 0, 3000); sfxOsc('triangle', N(base + n + 12), t + i * 0.07, 0.3, v * 0.22); });
      sfxNoise(t, 0.35, v * 0.3, 'highpass', 5000, 0.7); sfxOsc('sine', 140, t, 0.3, v * 0.7, 40);
    } else if (kind === 'down') { sfxOsc('sawtooth', 400, t, 0.35, v * 0.2, 90, 1200); }
    else if (kind === 'chain') { const N = (m) => 440 * Math.pow(2, (m - 69) / 12); sfxOsc('square', N(72 + (o.n || 0)), t, 0.1, v * 0.15, 0, 3200); }
  };

  /* ---------------- music ---------------- */
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const triad = (r, minor) => [r, r + (minor ? 3 : 4), r + 7];
  const SONGS = [
    { bpm: 104, prog: [[57, 1], [53, 0], [48, 0], [55, 0]] },   // A minor feel
    { bpm: 108, prog: [[50, 1], [46, 0], [53, 0], [48, 0]] },   // D minor
    { bpm: 112, prog: [[53, 1], [49, 0], [56, 0], [51, 0]] },   // F minor
    { bpm: 116, prog: [[48, 1], [56, 0], [58, 0], [55, 1]] },   // C minor
    { bpm: 120, prog: [[52, 0], [49, 1], [57, 0], [59, 0]] },   // E major (heroic)
  ];
  const mus = { on: false, timer: null, step: 0, next: 0, sector: 0, inten: 2, boss: false, lead: [] };
  function makeLead(song) {
    // 4 bars x 16 steps of scale tones, built once so it loops like a real tune
    const out = []; const scale = [0, 3, 5, 7, 10, 12, 15, 17];
    let seed = song.bpm * 7;
    const rr = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let bar = 0; bar < 4; bar++) {
      const root = song.prog[bar][0] + 24; const minor = song.prog[bar][1];
      for (let s = 0; s < 16; s++) {
        const on = (s % 4 === 0 && rr() < 0.8) || (s % 2 === 0 && rr() < 0.35);
        out.push(on ? root + (minor ? scale : [0, 4, 5, 7, 9, 12, 16, 19])[Math.floor(rr() * 8)] : null);
      }
    }
    return out;
  }
  function osc(type, f, t, dur, vol, dest, o) {
    const g = ctx.createGain(); const os = ctx.createOscillator(); os.type = type; os.frequency.setValueAtTime(f, t);
    if (o && o.slide) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    const a = (o && o.attack) || 0.008;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = os;
    if (o && o.lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; os.connect(f2); n = f2; }
    n.connect(g); g.connect(dest); if (o && o.send) g.connect(delayIn);
    os.start(t); os.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, type, freq, q) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(musBus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  function stepAt(t, st) {
    const song = SONGS[mus.sector % SONGS.length]; const s = st % 16, bar = Math.floor(st / 16) % 4;
    const [root, minor] = song.prog[bar]; const ch = triad(root, minor); const inten = mus.boss ? 3 : mus.inten; const spb = 60 / (song.bpm + (mus.boss ? 18 : 0)) / 4;
    // bass
    const bassPat = mus.boss ? [0, 3, 6, 8, 10, 12, 14] : [0, 6, 10, 14];
    if (bassPat.includes(s)) osc('sawtooth', N(root - 12), t, spb * 2.6, 0.2, musBus, { lp: 420 });
    // pad
    if (s === 0) for (const n of ch) { osc('sawtooth', N(n) * 1.004, t, spb * 15, 0.028, musBus, { lp: 900, attack: 0.5 }); osc('triangle', N(n + 12), t, spb * 15, 0.03, musBus, { attack: 0.6 }); }
    // arpeggio
    if (s % 2 === 0 && (inten >= 2 || s % 4 === 0)) { const n = ch[(s / 2) % 3] + 24 + (s % 8 === 6 ? 12 : 0); osc('square', N(n), t, spb * 1.5, inten >= 2 ? 0.045 : 0.03, musBus, { lp: 2400, send: true }); }
    // drums
    if (inten >= 2) {
      if (s === 0 || s === 8 || (mus.boss && (s === 4 || s === 12 || s === 10))) osc('sine', 150, t, 0.16, 0.7, musBus, { slide: 42 });
      if (s % 2 === 0) noise(t, 0.04, s % 4 === 0 ? 0.1 : 0.07, 'highpass', 7500, 1);
      if (s === 14 && inten < 3) noise(t, 0.16, 0.08, 'highpass', 6000, 1);
    }
    if (inten >= 3 && (s === 4 || s === 12)) { noise(t, 0.14, 0.2, 'bandpass', 1800, 0.8); osc('triangle', 190, t, 0.1, 0.18, musBus, { slide: 110 }); }
    // lead
    if (inten >= 3 || (inten >= 2 && !mus.boss && bar % 2 === 1)) { const l = mus.lead[st % 64]; if (l != null) osc('triangle', N(l), t, spb * 2.4, 0.07, musBus, { send: true, attack: 0.02 }); }
  }
  snd.musicStart = function (sector, inten, boss) {
    if (!ensure()) return;
    snd.musicStop();
    mus.sector = sector || 0; mus.inten = inten || 2; mus.boss = !!boss; mus.step = 0; mus.lead = makeLead(SONGS[mus.sector % SONGS.length]); mus.on = true;
    mus.next = ctx.currentTime + 0.12;
    mus.timer = setInterval(() => {
      if (!ctx || !mus.on) return;
      if (ctx.state !== 'running') { mus.next = ctx.currentTime + 0.1; return; }
      const song = SONGS[mus.sector % SONGS.length]; const spb = 60 / (song.bpm + (mus.boss ? 18 : 0)) / 4;
      while (mus.next < ctx.currentTime + 0.25) {
        if (TM.settings.music > 0) stepAt(mus.next, mus.step);
        mus.next += spb; mus.step++;
      }
    }, 50);
  };
  snd.musicMode = function (inten, boss) { mus.inten = inten; mus.boss = !!boss; };
  snd.musicSector = function (sector) { mus.sector = sector; mus.lead = makeLead(SONGS[sector % SONGS.length]); };
  snd.musicStop = function () { mus.on = false; if (mus.timer) { clearInterval(mus.timer); mus.timer = null; } };
  snd.musicOn = () => mus.on;
})();
