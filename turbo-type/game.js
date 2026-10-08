/* Turbo Type - a 3D arcade racer where TYPING is the engine.
   Rendering: three.js (world.js) behind a transparent 2D HUD canvas owned by TM.game. */
(function () {
  'use strict';
  const TM = window.TM, TT = window.TT, THREE = window.THREE, C = TM.C, U = TM.U, D = TM.draw;
  const W = 1920, H = 1080;
  const clamp = U.clamp, lerp = U.lerp;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
  const GRAV = 27;

  const PLAYER = { name: 'YOU', model: 'raceCarOrange', tint: { mat: 'pylon', color: 0xff7a1a }, css: '#FF7A1A' };
  const RIVALS = [
    { name: 'Mochi', model: 'raceCarRed', tint: { mat: 'red', color: 0xe5383b }, css: '#FF5A7A', mult: 0.92, trait: 'Steady Eddie', stumble: 0.02, lane: 4 },
    { name: 'Taro', model: 'raceCarGreen', tint: { mat: 'grass', color: 0x2bb673 }, css: '#2BB673', mult: 1.0, trait: 'Fast starter', stumble: 0.06, lane: -4 },
    { name: 'Sora', model: 'raceCarWhite', tint: { mat: 'grey', color: 0x4aa3ff }, css: '#4AA3FF', mult: 0.95, trait: 'Late charge', stumble: 0.04, lane: 0 },
  ];
  const SONGS = {
    sunny: TM.audio.song({ bpm: 132, roots: [48, 43, 45, 41], chords: [[60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65]], bassPattern: [0, null, 12, null, 0, null, 12, 7, 0, null, 12, null, 7, null, 12, 10], lead: [79, null, 76, null, 79, null, 83, 81, null, 79, null, 76, 74, null, null, null, 72, null, 76, null, 79, 77, null, 76, null, 74, null, 72, 71, null, null, null], wave: 'square' }),
    rally: TM.audio.song({ bpm: 146, roots: [45, 41, 43, 40], chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], bassPattern: [0, 0, 12, 0, 0, 12, 0, 10, 0, 0, 12, 0, 7, 0, 10, 12], lead: [76, null, 79, null, 81, null, 79, 76, null, 74, null, 72, 74, null, null, null, 69, null, 72, null, 76, null, 74, 72, null, 71, null, 69, 71, null, null, null], wave: 'sawtooth' }),
    night: TM.audio.song({ bpm: 126, roots: [38, 34, 36, 33], chords: [[62, 65, 69], [58, 62, 65], [60, 63, 67], [57, 60, 64]], bassPattern: [0, null, 0, 12, null, 0, 12, null, 0, null, 0, 12, null, 7, 12, null], lead: [74, null, null, 77, null, 81, null, 79, 77, null, 74, null, null, 72, null, null, 70, null, null, 74, null, 77, null, 75, 74, null, 70, null, null, 69, null, null], wave: 'triangle', pad: 'sawtooth' }),
  };

  let S = null;          // everything about the current race / demo
  let world = null, g = null, def = null;
  const ST = { ready: false, loading: true, noGL: false, trackIdx: 0, laps: 3, track: null, tracks: [], pendingTrack: false };
  const o1 = {}, o2 = {}, o3 = {};
  const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _up = new THREE.Vector3(0, 1, 0);

  /* ====================================================================== audio */
  const Aud = {
    ctx: null, buf: {}, eng: null, started: false,
    init() {
      if (this.ctx || this.failed) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { this.failed = true; return; }
        this.ctx = new AC(); const c = this.ctx;
        this.master = c.createGain(); this.master.gain.value = 0; this.master.connect(c.destination);
        const e = {}; e.o1 = c.createOscillator(); e.o1.type = 'sawtooth'; e.o2 = c.createOscillator(); e.o2.type = 'square'; e.o3 = c.createOscillator(); e.o3.type = 'triangle';
        e.f = c.createBiquadFilter(); e.f.type = 'lowpass'; e.f.frequency.value = 600; e.f.Q.value = 2;
        e.g1 = c.createGain(); e.g2 = c.createGain(); e.g3 = c.createGain(); e.out = c.createGain(); e.out.gain.value = 0;
        e.o1.connect(e.g1); e.o2.connect(e.g2); e.o3.connect(e.g3); e.g1.connect(e.f); e.g2.connect(e.f); e.g3.connect(e.f); e.f.connect(e.out); e.out.connect(this.master);
        e.g1.gain.value = 0.5; e.g2.gain.value = 0.18; e.g3.gain.value = 0.0;
        e.o1.start(); e.o2.start(); e.o3.start(); this.eng = e;
        for (const n of ['nitro', 'land', 'thud', 'jump', 'pad', 'stumble', 'lap', 'whoosh']) {
          fetch('../assets/kenney/turbo-type/audio/' + n + '.ogg').then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b, (d) => { this.buf[n] = d; }, () => { })).catch(() => { });
        }
      } catch (err) { this.failed = true; }
    },
    play(n, vol = 1, rate = 1) {
      const c = this.ctx, b = this.buf[n]; if (!c || !b || TM.settings.sfx <= 0) return;
      const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; const gn = c.createGain(); gn.gain.value = vol * TM.settings.sfx * 0.8; s.connect(gn); gn.connect(c.destination); s.start();
    },
    engine(on, v, thr, boost) {
      const c = this.ctx, e = this.eng; if (!c || !e) return;
      const vol = on ? TM.settings.sfx : 0;
      const t = c.currentTime;
      const base = 38 + v * 2.1 + boost * 28;
      e.o1.frequency.setTargetAtTime(base, t, 0.05); e.o2.frequency.setTargetAtTime(base * 2.01, t, 0.05); e.o3.frequency.setTargetAtTime(base * 5, t, 0.05);
      e.g3.gain.setTargetAtTime(0.08 * boost + 0.02 * clamp(v / 60, 0, 1), t, 0.1);
      e.f.frequency.setTargetAtTime(380 + v * 22 + thr * 500 + boost * 900, t, 0.08);
      e.out.gain.setTargetAtTime(vol * (0.05 + 0.09 * clamp(v / 60, 0, 1) + 0.04 * thr + 0.05 * boost), t, 0.08);
      this.master.gain.setTargetAtTime(on ? 1 : 0, t, 0.1);
    },
  };
  const gesture = () => { Aud.init(); if (Aud.ctx && Aud.ctx.state === 'suspended') Aud.ctx.resume(); };
  window.addEventListener('keydown', gesture, { capture: true });
  window.addEventListener('pointerdown', gesture, { capture: true });

  /* ====================================================================== setup */
  function baseWpm() {
    const recent = TM.store.get('turbo.wpm', 0);
    const d = g.diff === 'gentle' ? 11 : g.diff === 'turbo' ? 30 : 19;
    return Math.max(d, Math.min(recent || d, d * 1.7));
  }
  const rateToSpeed = (cps) => 7 + 55 * (1 - Math.exp(-cps / 3.0));

  function makeCar(spec, idx, isPlayer) {
    const mesh = world.addCar(spec.model, spec.tint, isPlayer && ST.track.def.theme.id === 'night');
    return {
      idx, spec, isPlayer, mesh, name: spec.name, css: spec.css,
      dist: 0, v: 0, lat: 0, latT: 0, vLat: 0, y: 0, vy: 0, air: false, airT: 0, airTotal: 0, rollTrick: 0, trickOn: false,
      lap: -1, finished: false, finishT: 0, place: 0, lapStart: 0, bestLap: 1e9, lapTimes: [],
      stumble: 0, nitroT: 0, padT: 0, kick: 0, rate: 0, cps: 0, wob: Math.random() * 6, sq: 0, sqV: 0,
      pitch: 0, roll: 0, yawSlip: 0, prevY: 0, vyG: 0, sparks: 0, mult: spec.mult || 1, nextNitro: 6 + Math.random() * 8, stumbleTimer: 2 + Math.random() * 6,
      pos: new THREE.Vector3(), yaw: 0, speedShown: 0, rank: 0, jumps: 0,
    };
  }

  function setupRace(demo) {
    const tr = ST.track, L = tr.L;
    world.clearCars();
    const slots = [[-6, -4.5], [-9.5, 4.5], [-18, -4.5], [-21.5, 4.5]];
    const pSlot = 2 + (Math.random() < 0.5 ? 0 : 1);
    const others = U.shuffle([0, 1, 2, 3].filter((i) => i !== pSlot));
    const bw = baseWpm();
    const cars = [];
    const p = makeCar(PLAYER, 0, true); cars.push(p);
    RIVALS.forEach((r, i) => cars.push(makeCar(r, i + 1, false)));
    cars.forEach((c, i) => {
      const slot = c.isPlayer ? pSlot : others[i - 1];
      c.dist = slots[slot][0]; c.lat = c.latT = c.slotLat = slots[slot][1]; c.slot = slot; c.lapStart = 0; c.lap = -1;
      c.baseWpm = c.isPlayer ? bw : bw * c.mult * (0.95 + Math.random() * 0.1);
      c.cps = c.baseWpm / 12;
      track_at(c.dist, o1); c.y = tr.roadY(c.dist, c.lat); c.prevY = c.y;
      c.mesh.group.userData.isCar = true; c.mesh.shadow.userData.isCar = true;
    });
    S = Object.assign(S || {}, {
      cars, player: p, phase: 'grid', raceT: 0, laps: ST.laps, total: ST.laps * L, finishOrder: 0, banners: [], nitro: 0, nitroT: 0, nitroFlash: 0, boostK: 0, shake: 0, camBump: 0, camBumpV: 0,
      queue: [], rate: 0, rateSm: 0, stageBase: tr.def.stage[0], stageSpan: tr.def.stage[1] - tr.def.stage[0], chunkCount: 0,
      cam: { init: false, y: 0, ly: 0, fov: 60, roll: 0, p0: new THREE.Vector3(), p1: new THREE.Vector3(), q0: new THREE.Quaternion(), q1: new THREE.Quaternion(), f0: 60, f1: 60, introT: 0, podT: 0 },
      tickT: performance.now(), lastRank: 3, finishT: 0, podium: false, results: null, tags: [], streaks: [], lapFlash: 0, jumpsDone: 0, nitrosDone: 0, bigAir: 0, goT: 0, hintPulse: 0, ranks: [], liveWpm: 0,
      lightsOn: 0, fastest: TM.store.get('turbo.best.' + tr.def.id, 0) || 0, welcome: 3,
    });
    S.demo = !!demo;
    if (world.podium) world.podium.visible = false;
    if (!demo) refillQueue();
    updateLights();
  }
  function track_at(s, o) { return ST.track.at(s, o); }

  function refillQueue() {
    if (!S) return;
    while (S.queue.length < 3) {
      const prog = clamp(S.player.dist / S.total, 0, 1);
      const o = g.ladder(clamp(S.stageBase + S.stageSpan * Math.min(1, prog + S.queue.length * 0.02), 0, 1));
      const used = new Set(S.queue.map((q) => q.item.t));
      const it = g.dealer.next({ kind: o.kind, maxLen: o.maxLen, avoid: used });
      S.queue.push(new TM.Typer(it));
    }
  }

  function reset(gm) {
    g = gm;
    if (!ST.ready) { ST.wantReset = true; return; }
    const demo = g.demo;
    setupRace(demo);
  }

  function buildTrackIdx(i, then) {
    ST.trackIdx = i; ST.loading = true;
    const defn = TT.TRACKS[i];
    setTimeout(() => {
      ST.track = defn.built || (defn.built = TT.buildTrack(defn));
      world.build(ST.track); prepMinimap(ST.track);
      def.music = SONGS[defn.theme.id];
      ST.loading = false; ST.ready = true;
      setupRace(g.demo);
      if (then) then();
    }, 30);
  }

  function prepMinimap(tr) {
    if (tr.mini) return; const b = tr.bounds, pts = []; for (let i = 0; i < tr.N; i += 3) pts.push([tr.X[i], tr.Z[i]]);
    tr.mini = { pts, w: b.x1 - b.x0, h: b.z1 - b.z0, x0: b.x0, z0: b.z0 };
  }

  /* ====================================================================== input */
  function onKey(gm, k) {
    if (!S || S.phase !== 'race' || S.player.finished) return;
    const t = S.queue[0]; if (!t) return;
    const r = t.feed(k);
    g.keyResult(r);
    const P = S.player;
    if (r === 'miss') { stumble(P); return; }
    P.rate += 1 / 1.4; P.kick = Math.min(7, P.kick + 1.7); P.sqV += 1.4; S.rateSm = S.rateSm * 0.9 + 0.1;
    if (r === 'done') chunkDone(t);
  }
  function stumble(c) {
    const first = c.stumble <= 0.05;
    c.v *= first ? 0.74 : 0.94; c.rate *= first ? 0.45 : 0.8; c.stumble = 0.75; c.kick = 0; c.sparks = 0;
    if (c.isPlayer) {
      S.nitro = Math.max(0, S.nitro - 0.12); S.shake = Math.max(S.shake, first ? 0.5 : 0.2);
      if (first) { Aud.play('stumble', 0.7); banner('OOPS!', '#FF5A5F', 0.7, 'keep going'); }
    }
    puffSmoke(c, 9);
  }
  function chunkDone(t) {
    const P = S.player, item = t.item, clean = t.errors === 0, sentence = item.kind === 'sentence';
    S.queue.shift(); refillQueue(); S.chunkCount++;
    const v = g.vw();
    g.wordDone(t, W / 2 + U.rand(-120, 120), v.y + v.h - 330, { bonus: S.nitroT > 0 ? 1.5 : 1 });
    P.kick = Math.min(9, P.kick + 3.5); P.sqV += 3;
    S.nitro = Math.min(1.2, S.nitro + (sentence ? (clean ? 0.8 : 0.45) : (clean ? 0.34 : 0.14)));
    if (S.nitro >= 1 && S.nitroT <= 0) fireNitro(P);
    else if (clean && sentence) { banner('PERFECT!', '#FFC83D', 1.0); }
    for (let i = 0; i < 10; i++) emitFlame(P, 0.6);
  }
  function fireNitro(P) {
    S.nitro = Math.max(0, S.nitro - 1); S.nitroT = 3.4; P.nitroT = 3.4; P.v += 7; S.nitrosDone++;
    S.shake = Math.max(S.shake, 0.7); S.camBumpV -= 3;
    banner('NITRO!', '#FF7A1A', 1.4, 'full throttle!'); Aud.play('nitro', 1); TM.sfx.boost && TM.sfx.boost();
    if (!g.demo) g.fx.doFlash('#FFB347', 0.28);
    for (let i = 0; i < 50; i++) emitFlame(P, 1.6);
    S.score && 0;
  }
  function banner(text, color, life = 1.2, sub) { if (!S) return; S.banners.push({ text, color, life, t: 0, sub }); if (S.banners.length > 4) S.banners.shift(); }

  /* ====================================================================== particles */
  const rearPos = (c, back, side, up) => { _v.set(side, up, -back).applyQuaternion(c.mesh.q1); return _v.add(c.mesh.p1); };
  function emitFlame(c, k) {
    const p = rearPos(c, 2.4, U.rand(-0.35, 0.35), 0.65); const f = c.mesh.q1; _q.copy(f);
    const bx = -Math.sin(c.yaw), bz = -Math.cos(c.yaw); // backward direction
    const sp = U.rand(12, 30) * k;
    world.glow.emit(p.x, p.y, p.z, -bx * -sp * 0 + (c.dirx || 0) * -sp + U.rand(-2, 2), U.rand(-1, 2), (c.dirz || 0) * -sp + U.rand(-2, 2), U.rand(0.25, 0.5), U.rand(1.0, 1.7), 0.2, 1, U.rand(0.35, 0.65), 0.1, 0.85);
    if (Math.random() < 0.5) world.glow.emit(p.x, p.y, p.z, (c.dirx || 0) * -sp * 0.6, U.rand(0, 2), (c.dirz || 0) * -sp * 0.6, U.rand(0.2, 0.4), 0.9, 0.1, 0.5, 0.8, 1, 0.9);
  }
  function puffSmoke(c, n) {
    for (let i = 0; i < n; i++) {
      const p = rearPos(c, 2, U.rand(-1, 1), 0.3);
      world.dust.emit(p.x, p.y, p.z, U.rand(-3, 3), U.rand(0.5, 3), U.rand(-3, 3), U.rand(0.5, 1.0), 0.8, 3.2, 0.8, 0.8, 0.82, 0.55, 0, 1.5);
    }
  }
  function landingDust(c, strength) {
    const th = ST.track.def.theme.id, col = th === 'rally' ? [0.72, 0.58, 0.4] : th === 'night' ? [0.55, 0.58, 0.7] : [0.85, 0.82, 0.74];
    const n = Math.round(14 + strength * 18);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = U.rand(3, 10) * (0.6 + strength * 0.6);
      world.dust.emit(c.pos.x, c.pos.y + 0.2, c.pos.z, Math.cos(a) * sp, U.rand(0.5, 3), Math.sin(a) * sp, U.rand(0.6, 1.3), 1.4, 5.5, col[0], col[1], col[2], 0.6, 0, 2.2);
    }
    for (let i = 0; i < 10; i++) world.glow.emit(c.pos.x, c.pos.y + 0.3, c.pos.z, U.rand(-8, 8), U.rand(3, 9), U.rand(-8, 8), U.rand(0.3, 0.6), 0.5, 0.1, 1, 0.8, 0.4, 0.9, GRAV * 0.7, 0.3);
  }

  /* ====================================================================== simulation */
  function cornerFactor(tr, s) {
    tr.at(s, o3); const k0 = Math.abs(o3.k); tr.at(s + 16, o3); const k1 = Math.abs(o3.k);
    return 1 - 0.3 * smooth(1 / 80, 1 / 26, Math.max(k0, k1));
  }

  function stepCar(c, dt, tr, all) {
    const P = S.player, racing = S.phase === 'race' || S.phase === 'finish' || S.demo;
    const T = S.raceT;
    c.stumble = Math.max(0, c.stumble - dt); c.nitroT = Math.max(0, c.nitroT - dt); c.padT = Math.max(0, c.padT - dt);
    c.kick *= Math.exp(-dt / 0.28);
    // ---- speed target
    let cps;
    if (c.isPlayer && !S.demo) { c.rate *= Math.exp(-dt / 1.4); cps = c.rate; }
    else {
      // virtual typist
      const prog = clamp(c.dist / S.total, 0, 1);
      let m = c.mult;
      if (c.spec.name === 'Taro') m *= lerp(1.22, 0.9, smooth(0.0, 0.6, prog));
      else if (c.spec.name === 'Sora') m *= lerp(0.8, 1.22, smooth(0.1, 0.8, prog));
      const rubber = clamp((P.dist - c.dist) / 260, -1, 1) * (S.demo ? 0 : 0.16);
      const wob = 1 + Math.sin(T * 0.5 + c.wob) * 0.07 + Math.sin(T * 1.3 + c.wob * 2) * 0.04;
      cps = (c.baseWpm / c.mult / 12) * m * wob * (1 + rubber) * (S.demo ? 1.5 : 1);
      c.rate = cps;
      // AI stumbles and nitros
      c.stumbleTimer -= dt; if (c.stumbleTimer <= 0 && !c.finished) { c.stumbleTimer = (6 + Math.random() * 10) / ((c.spec.stumble || 0.05) * 20); if (Math.random() < 0.55 && racing && T > 3) { c.v *= 0.8; c.stumble = 0.6; puffSmoke(c, 5); } }
      c.nextNitro -= dt; if (c.nextNitro <= 0 && racing && !c.finished) { c.nextNitro = 14 + Math.random() * 12; c.nitroT = 2.2; }
    }
    if (c.finished) cps = 2.2;
    let vT = rateToSpeed(cps) * cornerFactor(tr, c.dist);
    const nitroOn = c.nitroT > 0;
    if (nitroOn) vT *= 1.3; else if (c.padT > 0) vT *= 1.2;
    if (c.stumble > 0) vT *= 0.65;
    vT += c.kick * (c.isPlayer ? 1 : 0);
    if (c.isPlayer && !S.demo && !c.finished) vT *= 1 + clamp((S.leaderDist - c.dist) / 400, 0, 1) * 0.07; // small catch-up help
    if (!racing || (S.phase === 'grid' && !S.demo)) vT = 0;
    const acc = c.v < vT ? (nitroOn ? 34 : 19) : 13;
    c.v += clamp(vT - c.v, -acc * dt, acc * dt);
    if (c.v < 0) c.v = 0;
    c.speedShown += (c.v - c.speedShown) * Math.min(1, dt * 10);

    // ---- advance
    const prevDist = c.dist; c.dist += c.v * dt;
    const s = c.dist;
    tr.at(s, o1);
    // lateral target: racing line + lane + weave + avoid
    const lane = c.isPlayer ? (S.demo ? 0 : -0.8) : (c.spec.lane || 0) * 0.75;
    let lt = clamp(o1.k * 130, -6.2, 6.2) * (c.isPlayer ? 1.0 : 0.8) + lane + Math.sin(T * 0.4 + c.wob) * (c.isPlayer ? 0.5 : 1.2);
    if (S.phase === 'grid') lt = c.slotLat != null ? c.slotLat : c.lat;
    for (const d of all) {
      if (d === c) continue; const dd = d.dist - c.dist;
      if (Math.abs(dd) < 6.5) { const dl = c.lat - d.lat; if (Math.abs(dl) < 2.9) lt += (dl >= 0 ? 1 : -1) * (2.9 - Math.abs(dl)) * (c.isPlayer ? 0.6 : 1.0); }
    }
    c.latT = clamp(lt, -7.2, 7.2);
    if (S.phase !== 'grid') { const dl = c.latT - c.lat; c.vLat += (dl * 14 - c.vLat * 6) * dt; c.lat += c.vLat * dt; }
    c.lat = clamp(c.lat, -7.4, 7.4);

    // ---- vertical: ramps & air
    const gy = tr.roadY(s, c.lat);
    if (!c.air) {
      const vyG = (c.y - c.prevY) / dt; c.prevY = c.y;
      if (c.y - gy > 0.5 && vyG > 2.2 && c.v > 4) {
        // launch!
        const slope = vyG;
        c.air = true; c.vy = clamp(Math.max(slope, 11 + c.v * 0.05), 11.5, 19); c.airT = 0; c.airTotal = (2 * c.vy) / GRAV; c.trickOn = c.airTotal > 1.05; c.rollTrick = 0; c.jumps++;
        if (c.isPlayer && !S.demo) { Aud.play('jump', 0.8); S.shake = Math.max(S.shake, 0.25); S.camBumpV += 4; banner('JUMP!', '#2F9BFF', 0.9); }
      } else c.y += (gy - c.y) * Math.min(1, dt * 40) * 0 + (gy - c.y); // follow ground exactly
    }
    if (c.air) {
      c.airT += dt; c.vy -= GRAV * dt; c.y += c.vy * dt;
      if (c.trickOn) c.rollTrick = (Math.PI * 2) * smooth(0.08, c.airTotal * 0.92, c.airT);
      if (c.y <= gy && c.vy < 0) {
        c.y = gy; c.air = false; c.rollTrick = 0; c.prevY = gy; c.sqV -= 5;
        const str = clamp(c.airT / 1.2, 0.2, 1.4);
        c.pos.set(o1.x + o1.rx * c.lat, gy, o1.z + o1.rz * c.lat); landingDust(c, str);
        if (c.isPlayer && !S.demo) {
          S.shake = Math.max(S.shake, 0.6 + str * 0.5); S.camBumpV -= 6 * str; Aud.play('land', 0.9); Aud.play('thud', 0.5 * str);
          if (c.airT > 0.85) { S.bigAir++; const bonus = Math.round(50 + c.airT * 60); g.score.add(bonus); banner('BIG AIR!', '#FFC83D', 1.4, '+' + bonus); }
          S.jumpsDone++;
        }
        if (c.airT > 0.5) c.v *= 0.97;
      }
    }

    // ---- boost pads
    if (!c.air && c.padT <= 0.15) for (const p of tr.pads) {
      let d1 = (c.dist - p.s0) % tr.L; if (d1 < 0) d1 += tr.L;
      if (d1 < p.len) {
        c.padT = 1.7; c.v += 9; c.kick += 2;
        if (c.isPlayer && !S.demo) { Aud.play('pad', 0.9); banner('BOOST!', '#2BD9FF', 0.9); S.shake = Math.max(S.shake, 0.2); g.score.add(25); for (let i = 0; i < 24; i++) emitFlame(c, 1.2); }
        break;
      }
    }

    // ---- lap logic
    const lapNow = Math.floor(c.dist / tr.L);
    if (lapNow > c.lap) {
      if (c.lap >= 0 && !c.finished) {
        const lt2 = T - c.lapStart; c.lapTimes.push(lt2); c.bestLap = Math.min(c.bestLap, lt2);
        if (c.isPlayer && !S.demo) onPlayerLap(c, lapNow, lt2);
      }
      c.lap = lapNow; c.lapStart = T;
      if (lapNow >= S.laps && !c.finished && !S.demo && S.phase !== 'grid') { c.finished = true; c.finishT = T; c.place = ++S.finishOrder; if (c.isPlayer) onPlayerFinish(c); }
    }
    if (S.demo && c.dist > tr.L * 40) c.dist -= tr.L * 40;

    // ---- visual pose
    tr.at(s, o1);
    const x = o1.x + o1.rx * c.lat, z = o1.z + o1.rz * c.lat;
    c.dirx = o1.fx; c.dirz = o1.fz;
    const kk = o1.k, spd = c.v;
    c.sq += c.sqV * dt; c.sqV += (-90 * c.sq - 10 * c.sqV) * dt;
    const lateral = kk * spd * spd;           // lateral accel (+ right)
    const tgtYaw = -clamp(kk * spd * 0.55, -0.3, 0.3) * (c.air ? 0.2 : 1) + (c.stumble > 0 ? Math.sin(c.stumble * 40) * 0.22 * Math.min(1, c.stumble * 2) : 0) - clamp(c.vLat * 0.02, -0.12, 0.12);
    c.yawSlip += (tgtYaw - c.yawSlip) * Math.min(1, dt * 7);
    c.yaw = Math.atan2(o1.fx, o1.fz) + c.yawSlip;
    const gy2 = tr.roadY(s + 2.5, c.lat) - tr.roadY(s - 2.5, c.lat);
    let slopeAng = Math.atan2(gy2, 5);
    if (c.air) slopeAng = Math.atan2(c.vy, Math.max(8, c.v)) * 0.8;
    else slopeAng = clamp(slopeAng, -0.5, 0.5);
    const tgtPitch = -slopeAng + c.sq * 0.05 + (c.stumble > 0 ? 0.04 : 0);
    c.pitch += (tgtPitch - c.pitch) * Math.min(1, dt * (c.air ? 5 : 14));
    const tgtRoll = (c.air ? 0 : o1.bank) - clamp(lateral * 0.0042, -0.13, 0.13) * (c.air ? 0.3 : 1) + Math.sin(T * 17 + c.wob) * 0.004 * clamp(spd / 40, 0, 1);
    c.roll += (tgtRoll - c.roll) * Math.min(1, dt * 9);
    const bob = c.air ? 0 : Math.sin(T * 21 + c.wob) * 0.035 * clamp(spd / 50, 0, 1) + Math.abs(c.sq) * 0.04;
    c.pos.set(x, c.y + bob, z);
    c.mesh.group.rotation.order = 'YXZ';
    world.poseCar(c.mesh, x, c.y + bob, z, c.yaw, c.pitch, c.roll + c.rollTrick, (nitroOn ? 1 : c.padT > 0 ? 0.6 : c.kick > 5 ? 0.35 : 0));
    // shadow on the road
    const hAbove = c.air ? Math.max(0, c.y - tr.roadY(s, c.lat)) : 0;
    const gnd = tr.roadY(s, c.lat);
    world.shadowPose(c.mesh, x, gnd, z, c.yaw, 1 - clamp(hAbove / 14, 0, 0.6), clamp(0.8 - hAbove / 18, 0.2, 0.8), -Math.atan2(gy2, 5), 0);
    // effects
    if (spd > 25 && Math.abs(lateral) > 22 && !c.air) {
      c.sparks += dt; if (c.sparks > 0.03) {
        c.sparks = 0; const side = lateral > 0 ? -1 : 1; const p = rearPos(c, 1.6, side * 1.0, 0.15);
        world.glow.emit(p.x, p.y, p.z, -o1.fx * 8 + U.rand(-3, 3), U.rand(1, 5), -o1.fz * 8 + U.rand(-3, 3), U.rand(0.25, 0.5), 0.5, 0.1, 1, U.rand(0.6, 0.9), 0.3, 0.95, 14, 0.4);
        world.dust.emit(p.x, p.y + 0.1, p.z, U.rand(-1, 1), U.rand(0.5, 1.5), U.rand(-1, 1), U.rand(0.5, 0.9), 0.8, 2.4, 0.86, 0.86, 0.9, 0.4, 0, 1.2);
      }
    }
    if (!c.air && spd > 20 && ST.track.def.theme.id === 'rally' && Math.random() < dt * 14 * clamp(spd / 50, 0, 1)) { const p = rearPos(c, 1.9, U.rand(-1, 1), 0.2); world.dust.emit(p.x, p.y, p.z, U.rand(-1, 1), U.rand(0.5, 2), U.rand(-1, 1), 0.9, 0.8, 3, 0.72, 0.58, 0.4, 0.35, 0, 1.5); }
    if (nitroOn && Math.random() < 0.9) emitFlame(c, 1);
    if (c.stumble > 0 && Math.random() < dt * 22) puffSmoke(c, 1);
    if (!c.air && spd > 30 && Math.random() < dt * 5) { const p = rearPos(c, 2.0, U.rand(-0.5, 0.5), 0.5); world.dust.emit(p.x, p.y, p.z, U.rand(-0.5, 0.5), U.rand(0.2, 0.8), U.rand(-0.5, 0.5), 0.6, 0.4, 1.4, 0.8, 0.8, 0.85, 0.12, 0, 1.2); }
  }

  function onPlayerLap(c, lapNo, time) {
    const fast = time < (S.fastest || 1e9) - 0.001;
    if (fast) { S.fastest = time; TM.store.set('turbo.best.' + ST.track.def.id, time); }
    Aud.play('lap', 0.7);
    if (lapNo < S.laps) {
      banner(lapNo === S.laps - 1 && S.laps > 1 ? 'FINAL LAP!' : 'LAP ' + (lapNo + 1) + '/' + S.laps, lapNo === S.laps - 1 ? '#FFC83D' : '#fff', 1.8, 'lap time ' + fmt(time) + (fast && lapNo > 0 ? '  - fastest!' : ''));
      g.score.add(150);
    }
    S.lapFlash = 1.5;
  }
  function onPlayerFinish(c) {
    S.phase = 'finish'; S.finishT = 0; S.nitroT = 0;
    // order for those still racing
    const rest = S.cars.filter((x) => !x.finished).map((x) => ({ x, eta: S.raceT + (S.total - x.dist) / Math.max(18, x.v) })).sort((a, b) => a.eta - b.eta);
    let pl = S.finishOrder; for (const r of rest) { r.x.est = ++pl; }
    S.cars.forEach((x) => { x.finalPlace = x.finished ? x.place : x.est; });
    const place = c.finalPlace; S.place = place;
    const bonus = [1000, 600, 300, 100][place - 1] || 0; g.score.add(bonus);
    banner(place === 1 ? 'YOU WIN!' : ORD[place - 1].toUpperCase() + ' PLACE', place === 1 ? '#FFC83D' : '#fff', 4, 'FINISH!');
    TM.sfx.win && 0;
    g.fx.confetti(W / 2, 400, place === 1 ? 140 : 50);
    // typing stats for the next race
    const wpm = g.score.wpm(S.raceT); TM.store.set('turbo.wpm', Math.round((TM.store.get('turbo.wpm', wpm) + wpm) / 2));
    const names = ORD[place - 1];
    const rows = S.cars.slice().sort((a, b) => a.finalPlace - b.finalPlace);
    S.results = rows;
    g.end({
      win: place <= 3, title: place === 1 ? 'You won the race!' : names + ' place!', sub: place === 1 ? 'Fastest typist on the track!' : place <= 3 ? 'On the podium - race again to get gold!' : 'Nice try - every race you get faster!',
      targetMet: place <= 2, stats: [['Place', names], ['Race time', fmt(S.raceT)], ['Best lap', c.bestLap < 1e8 ? fmt(c.bestLap) : '-'], ['Big jumps', S.bigAir]], delay: 7600,
    });
  }
  const fmt = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };

  function ranking() {
    const cars = S.cars;
    const key = (c) => (c.finished ? 1e9 - c.place : c.dist);
    const r = cars.slice().sort((a, b) => key(b) - key(a));
    r.forEach((c, i) => { c.rank = i; });
    return r;
  }

  /* ====================================================================== update */
  function update(gm, dt) {
    g = gm;
    if (ST.wantReset && ST.ready) { ST.wantReset = false; setupRace(g.demo); }
    if (!ST.ready || !S || !world) return;
    const tr = ST.track;
    S.tickT = performance.now();
    // phase transitions
    if (g.state === 'countdown' && S.phase !== 'grid') setupRace(false);
    if (S.phase === 'grid' && g.state === 'play') { S.phase = 'race'; S.raceT = 0; S.player.v = 8; S.player.kick = 6; S.cars.forEach((c) => { c.lapStart = 0; }); S.goT = 0; Aud.play('whoosh', 0.5); }
    if (g.state === 'title' && !S.demo) setupRace(true);
    if (g.state === 'countdown' && S.phase === 'grid' && S.demo) setupRace(false);
    const racing = S.phase === 'race' || S.phase === 'finish' || S.demo;
    if (racing) S.raceT += dt;
    S.leaderDist = Math.max(...S.cars.map((c) => c.dist));
    if (!S.podiumCamOn) for (const c of S.cars) stepCar(c, dt, tr, S.cars);
    const rk = ranking();
    if (!S.demo && S.phase === 'race') {
      const myRank = S.player.rank;
      if (myRank < S.lastRank && S.raceT > 4) { banner('OVERTAKE!', '#2BB673', 1.1, ORD[myRank]); g.score.add(60); TM.sfx.combo && TM.sfx.combo(0); }
      S.lastRank = myRank;
      if (S.nitroT > 0) S.nitroT -= dt;
      S.nitro = Math.max(0, S.nitro - dt * 0.004);
      S.liveWpm += (S.player.rate * 12 - S.liveWpm) * Math.min(1, dt * 3);
      const t = S.queue[0]; if (t && t.shake > 0) t.shake = Math.max(0, t.shake - dt * 3);
    }
    if (S.phase === 'finish') {
      S.finishT += dt; S.player.nitroT = 0;
      if (S.finishT > 3.0) S.podium = true;
      if (S.podium && !S.podiumBuilt) { S.podiumBuilt = true; startPodium(); }
    }
    // boost smoothing
    const boosting = S.player.nitroT > 0 || S.player.padT > 0;
    S.boostK += ((S.player.nitroT > 0 ? 1 : S.player.padT > 0 ? 0.5 : 0) - S.boostK) * Math.min(1, dt * (boosting ? 6 : 2.5));
    S.shake = Math.max(0, S.shake - dt * 1.6);
    for (const b of S.banners) b.t += dt; S.banners = S.banners.filter((b) => b.t < b.life);
    S.lapFlash = Math.max(0, S.lapFlash - dt);
    // spring for camera bump
    S.camBumpV += (-60 * S.camBump - 9 * S.camBumpV) * dt; S.camBump += S.camBumpV * dt;
    updateLights();
    updateCamera(dt);
    world.dust.update(dt); world.glow.update(dt);
    if (world.pads) world.pads.forEach((m, i) => { m.material.map.offset.y -= dt * 1.4; });
    // audio
    const P = S.player, on = g.state === 'play' || (g.state === 'over' && S.phase === 'finish') || g.state === 'countdown';
    Aud.engine(on && !S.demo, P.v, clamp(P.rate / 5, 0, 1), S.boostK);
    S.hintPulse += dt;
  }

  function updateLights() {
    if (!world.startLights) return;
    const cdN = S.demo ? 4 : g.state === 'countdown' ? (S.cdN || 0) : S.phase === 'grid' ? 0 : 4;
    // derive from remaining countdown through framework state: lights = 1 per second
    const n = S.phase !== 'grid' || S.demo ? 4 : S.lightsOn;
    world.startLights.forEach((l, i) => {
      const green = n >= 4 && !S.demo, redOn = i < 3 && i < n && n < 4;
      l.material.color.set(n >= 4 ? (i === 3 ? 0x33ff66 : 0x113311) : redOn ? 0xff2a2a : 0x331111);
      if (S.demo) l.material.color.set(i === 3 ? 0x33ff66 : 0x113311);
    });
  }

  /* ====================================================================== camera */
  function updateCamera(dt) {
    const tr = ST.track, cam = S.cam, wcam = world.camera;
    let focus = S.player;
    if (S.demo) focus = S.cars.slice().sort((a, b) => b.dist - a.dist)[0];
    const c = focus, spdF = clamp(c.v / 62, 0, 1);
    const air = c.air ? 1 : 0;
    let px, py, pz, lx, ly, lz, fov;
    if (S.demo || S.podiumCam) {
      // handled below
    }
    const back = 8.4 + spdF * 3.2 + S.boostK * 3.0;
    const cs = c.dist - back;
    tr.at(cs, o2);
    const clat = c.lat * 0.8;
    px = o2.x + o2.rx * clat; pz = o2.z + o2.rz * clat;
    const baseY = tr.roadY(cs, clat) + 3.2 + spdF * 0.6;
    if (!cam.init) { cam.y = baseY; cam.ly = c.y; cam.init = true; }
    cam.y += (baseY - cam.y) * Math.min(1, dt * (c.air ? 2.2 : 8));
    cam.ly += ((c.y + 1.2) - cam.ly) * Math.min(1, dt * (c.air ? 2.5 : 10));
    py = cam.y + S.camBump * (TM.settings.reduceMotion ? 0.3 : 1);
    tr.at(c.dist + 12, o3); lx = o3.x + o3.rx * c.lat * 0.5; lz = o3.z + o3.rz * c.lat * 0.5; ly = cam.ly + 0.3;
    const rm = TM.settings.reduceMotion ? 0.3 : 1; fov = 54 + (spdF * 8 + S.boostK * 15 + air * 3) * rm;
    // title: TV-style cameras following the leader
    if (S.demo || g.state === 'title') {
      S.shotT = (S.shotT || 0) + dt;
      if (!S.shotLen || S.shotT > S.shotLen) {
        S.shotT = 0; S.shotLen = 6 + Math.random() * 3; S.shot = ((S.shot == null ? -1 : S.shot) + 1) % 3;
        if (S.shot === 0) { tr.at(c.dist + 55, o3); const side = Math.random() < 0.5 ? -1 : 1; S.shotPos = [o3.x + o3.rx * side * (tr.width / 2 + 9), tr.roadY(c.dist + 55, side * 12) + 3.2, o3.z + o3.rz * side * (tr.width / 2 + 9)]; }
      }
      tr.at(c.dist + 6, o3);
      if (S.shot === 0 && S.shotPos) { px = S.shotPos[0]; py = S.shotPos[1]; pz = S.shotPos[2]; fov = 46; }
      else if (S.shot === 1) { tr.at(c.dist + 17, o2); px = o2.x + o2.rx * (c.lat + 3); pz = o2.z + o2.rz * (c.lat + 3); py = tr.roadY(c.dist + 17, c.lat) + 1.8; fov = 58; }
      else { tr.at(c.dist - 22, o2); px = o2.x + o2.rx * (c.lat + 8); pz = o2.z + o2.rz * (c.lat + 8); py = tr.roadY(c.dist - 22, c.lat) + 15; fov = 52; }
      lx = c.pos.x + o3.fx * 3; ly = c.pos.y + 1; lz = c.pos.z + o3.fz * 3;
    } else if (S.phase === 'grid') {
      // intro sweep from the front-left to behind the car
      cam.introT += dt; const w = U.ease.outCubic(clamp(cam.introT / 2.4, 0, 1));
      const ang = (1 - w) * 2.2; tr.at(c.dist, o3);
      const ix = c.pos.x + (o3.fx * Math.cos(ang) + o3.rx * Math.sin(ang)) * 14 * (1 - w) * 1 , iz = c.pos.z + (o3.fz * Math.cos(ang) + o3.rz * Math.sin(ang)) * 14 * (1 - w);
      px = lerp(ix, px, w); pz = lerp(iz, pz, w); py = lerp(c.pos.y + 2.2, py, w); fov = 60 - (1 - w) * 6;
    }
    if (S.phase === 'finish' && S.podium && S.podiumCamOn) {
      podiumCamera(dt); return;
    }
    if (S.phase === 'finish' && !S.podium) {
      // victory lap: pull the camera round to the front of the car
      const w = smooth(0.2, 2.6, S.finishT); tr.at(c.dist, o3);
      const fx = c.pos.x + (o3.fx * 9 + o3.rx * 6 * Math.sin(S.finishT * 0.7)), fz = c.pos.z + (o3.fz * 9 + o3.rz * 6 * Math.sin(S.finishT * 0.7));
      px = lerp(px, fx, w); pz = lerp(pz, fz, w); py = lerp(py, c.pos.y + 3.2, w); lx = c.pos.x; lz = c.pos.z; ly = c.pos.y + 1; fov = lerp(fov, 55, w);
    }
    // shake
    const sh = S.shake * (TM.settings.reduceMotion ? 0.15 : 1);
    if (sh > 0) { px += (Math.random() - 0.5) * sh * 0.7; py += (Math.random() - 0.5) * sh * 0.5; pz += (Math.random() - 0.5) * sh * 0.7; }
    setCam(px, py, pz, lx, ly, lz, fov, (S.demo || S.phase === 'finish' ? 0 : -o3.kb * 1.2 * spdF) + (Math.random() - 0.5) * sh * 0.01);
  }
  function setCam(px, py, pz, lx, ly, lz, fov, roll) {
    const cam = S.cam, wc = world.camera;
    cam.p0.copy(cam.p1); cam.q0.copy(cam.q1); cam.f0 = cam.f1;
    wc.position.set(px, py, pz); wc.lookAt(lx, ly, lz); wc.rotateZ(roll || 0);
    cam.p1.copy(wc.position); cam.q1.copy(wc.quaternion); cam.f1 = fov;
    if (!cam.set) { cam.p0.copy(cam.p1); cam.q0.copy(cam.q1); cam.f0 = fov; cam.set = true; }
    // a big jump in position (restart) should not interpolate
    if (cam.p0.distanceToSquared(cam.p1) > 2500) { cam.p0.copy(cam.p1); cam.q0.copy(cam.q1); cam.f0 = cam.f1; }
  }

  /* ====================================================================== podium */
  function startPodium() {
    S.podiumCamOn = true; S.podT = 0;
    const rows = S.results; world.showPodium(ST.track, rows.slice(0, 4).map((c) => c.mesh));
    S.podCars = rows;
    for (let i = 0; i < 70; i++) world.glow.emit(world.podiumPos.x + U.rand(-12, 12), world.podiumPos.y + U.rand(6, 16), world.podiumPos.z + U.rand(-12, 12), U.rand(-1, 1), U.rand(-4, -1.5), U.rand(-1, 1), U.rand(2, 4), 0.8, 0.8, Math.random(), Math.random(), Math.random(), 0.9, -2, 0.1);
    banner('PODIUM!', '#FFC83D', 2.5);
  }
  function podiumCamera(dt) {
    S.podT += dt; const p = world.podiumPos, f = world.podiumFwd;
    const a = Math.sin(S.podT * 0.35) * 0.45, d = 20;
    const px = p.x + (f.x * Math.cos(a) + f.z * -Math.sin(a)) * d, pz = p.z + (f.z * Math.cos(a) + f.x * Math.sin(a)) * d;
    setCam(px, p.y + 6.5 + Math.sin(S.podT * 0.5) * 0.8, pz, p.x, p.y + 3.4, p.z, 48, 0);
    if (Math.random() < dt * 22) world.glow.emit(p.x + U.rand(-14, 14), p.y + 16, p.z + U.rand(-14, 14), U.rand(-1, 1), U.rand(-5, -2.5), U.rand(-1, 1), 3.2, 0.7, 0.7, Math.random() * 0.6 + 0.4, Math.random() * 0.6 + 0.4, Math.random() * 0.6 + 0.4, 0.95, -1, 0.1);
  }

  /* ====================================================================== drawing */
  const widthCache = new Map();
  function cw(ctx, font, ch) { const k = font + '|' + ch; let w = widthCache.get(k); if (w == null) { ctx.font = font; w = ctx.measureText(ch).width; widthCache.set(k, w); } return w; }
  let lastFrameT = 0, slowFrames = 0, fastFrames = 0, qualityLevel = 2;

  function draw(gm, ctx) {
    g = gm;
    const v = g.vw();
    // clear the framework's opaque fill: the 3D canvas sits behind us
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
    if (ST.noGL) { drawNoGL(ctx, v); return; }
    if (!ST.ready || !S || !world) { drawLoading(ctx, v); return; }
    // ---- 3D
    const now = performance.now();
    const alpha = g.state === 'paused' ? 1 : clamp((now - S.tickT) / (1000 / 60), 0, 1);
    const cam = S.cam, wc = world.camera;
    if (cam.set) {
      wc.position.lerpVectors(cam.p0, cam.p1, alpha); wc.quaternion.slerpQuaternions(cam.q0, cam.q1, alpha);
      world.baseFov = lerp(cam.f0, cam.f1, alpha); world.fovKick = 0; world.applyFov();
    }
    const v2 = g.vw(); world.setViewShift(g.state === 'title' ? 0 : panelHeightPx(v2) * 0.42);
    if (!ST.skipRender) world.render(alpha, g.t);
    // adaptive quality
    if (lastFrameT) { const dtm = now - lastFrameT; if (dtm > 26) { slowFrames++; fastFrames = 0; } else { slowFrames = Math.max(0, slowFrames - 1); fastFrames++; } if (slowFrames > 50 && qualityLevel > 0) { qualityLevel--; slowFrames = 0; world.setQuality(qualityLevel); } }
    lastFrameT = now;
    if (g.state === 'title' || (S.demo && g.state !== 'countdown' && g.state !== 'play')) { if (g.state === 'title') drawTitleHud(ctx, v); return; }
    // ---- HUD
    drawStreaks(ctx, v);
    drawTags(ctx, v);
    drawStandings(ctx, v);
    drawMinimap(ctx, v);
    if (g.state !== 'countdown') drawLapBox(ctx, v);
    drawSpeedo(ctx, v);
    drawPanel(ctx, v);
    drawBanners(ctx, v);
    drawCountdownLights(ctx, v);
    if (S.phase === 'finish') drawFinishUI(ctx, v);
    g.fx.draw(ctx);
  }
  function drawLoading(ctx, v) {
    D.text(ctx, ST.loading ? 'Warming up the engines...' : 'Loading...', W / 2, v.y + v.h * 0.62, { size: 54, color: '#fff', outline: 12 });
  }
  function drawNoGL(ctx, v) {
    ctx.fillStyle = '#1F1A3D'; ctx.fillRect(v.x, v.y, v.w, v.h);
    D.text(ctx, 'Sorry! Your browser cannot show 3D graphics (WebGL).', W / 2, v.y + v.h / 2 - 30, { size: 46, color: '#fff' });
    D.text(ctx, 'Try Chrome or Edge, or turn on hardware acceleration.', W / 2, v.y + v.h / 2 + 40, { size: 32, color: '#FFC83D' });
  }
  function drawTitleHud(ctx, v) {
    if (ST.fileMode) D.text(ctx, 'Tip: open this page from a web server (http) for the full 3D look.', W / 2, v.y + v.h - 40, { size: 26, color: '#fff', outline: 8 });
  }
  const scaleHud = (v) => (v.h / v.w > 0.95 ? 1.25 : 1);
  function panelHeightPx(v) {
    const sc = Math.min(window.innerWidth / W, window.innerHeight / H);
    return (g.state === 'play' || g.state === 'countdown' ? 250 * scaleHud(v) : 120) * sc;
  }

  /* ---- passage panel ---- */
  function layoutChunk(ctx, t, maxW, size) {
    const key = maxW + '|' + size; if (t._lay && t._lay.key === key) return t._lay;
    const font = D.FONT_WORD(size, 700), gap = size * 0.06;
    const chars = t.chars, words = []; let cur = [], w = 0;
    chars.forEach((c, i) => { const ww = cw(ctx, font, c.c) + gap; cur.push({ i, c, w: ww }); w += ww; if (c.k === ' ') { words.push({ chars: cur, w }); cur = []; w = 0; } });
    if (cur.length) words.push({ chars: cur, w });
    const lines = []; let line = { chars: [], w: 0 };
    for (const wd of words) { if (line.w + wd.w > maxW && line.chars.length) { lines.push(line); line = { chars: [], w: 0 }; } line.chars.push(...wd.chars); line.w += wd.w; }
    if (line.chars.length) lines.push(line);
    return (t._lay = { key, lines, font, size });
  }
  function drawPanel(ctx, v) {
    const t = S.queue[0]; if (!t || (g.state !== 'play' && g.state !== 'countdown' && S.phase !== 'finish') || S.phase === 'finish') return;
    const sc = scaleHud(v), bottom = v.y + v.h - 26 - (TM.settings.keyboard ? 270 : 0);
    const pw = Math.min(1760, W - 100) * (sc > 1 ? 1 : 1), cx = W / 2;
    const len = t.chars.length;
    let size = (len <= 9 ? 112 : len <= 16 ? 92 : 76) * (sc > 1 ? 1.1 : 1), lay = layoutChunk(ctx, t, pw - 130, size);
    if (lay.lines.length > 1 && len <= 30) { size = 68; lay = layoutChunk(ctx, t, pw - 130, size); }
    if (lay.lines.length > 2) { size = 58; lay = layoutChunk(ctx, t, pw - 130, size); }
    const lh = size * 1.28, textH = lay.lines.length * lh;
    const hasHint = g.hint && t.item.hint;
    const ph = textH + 70 + (hasHint ? 0 : 0), top = bottom - ph;
    const shake = t.shake > 0 ? Math.sin(t.shake * 50) * 14 * t.shake : 0;
    ctx.save(); ctx.translate(shake, 0);
    // backing
    const path = D.P.rr(cx - pw / 2, top, pw, ph, 36);
    ctx.fillStyle = 'rgba(31,26,61,0.86)'; ctx.fill(path);
    ctx.lineWidth = 7; ctx.strokeStyle = t.shake > 0 ? C.miss : C.turbo; ctx.stroke(path);
    // tab: TYPE! + hint
    D.pill(ctx, cx - pw / 2 + 36, top - 22, 150, 44, C.turbo); D.text(ctx, S.phase === 'grid' ? 'READY' : 'TYPE!', cx - pw / 2 + 111, top + 2, { size: 30, color: '#fff' });
    if (hasHint) {
      const hs = 36; ctx.font = D.FONT_JA(hs); const hw = ctx.measureText(t.item.hint).width + 56;
      const hx = cx + pw / 2 - 36 - hw; D.pill(ctx, hx, top - 28, hw, 56, '#fff', { stroke: C.ink, lw: 5 });
      ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t.item.hint, hx + hw / 2, top + 1);
    }
    // text lines
    let nextIdx = -1; for (let i = t.pos; i < t.chars.length; i++) if (!t.chars[i].opt) { nextIdx = i; break; }
    const fontB = lay.font, font = D.FONT_WORD(size, 500);
    lay.lines.forEach((ln, li) => {
      let x = cx - ln.w / 2; const y = top + 38 + lh * li + lh * 0.5;
      for (const q of ln.chars) {
        const done = q.i < t.pos, cur = q.i === nextIdx;
        if (cur) {
          const bw = Math.max(q.w, size * 0.6), bx = x - (bw - q.w) / 2;
          ctx.fillStyle = t.shake > 0 ? 'rgba(255,90,95,0.95)' : 'rgba(255,200,61,0.95)'; ctx.fill(D.P.rr(bx - 4, y - size * 0.62, bw + 8, size * 1.2, 14));
        }
        ctx.font = fontB; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        if (done) ctx.fillStyle = C.turbo; else if (cur) ctx.fillStyle = C.ink; else ctx.fillStyle = q.c.opt ? 'rgba(255,255,255,0.4)' : '#fff';
        if (q.c.k === ' ') { if (cur) { ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 2, y - 4); ctx.lineTo(x + 2, y + 8); ctx.lineTo(x + q.w - 4, y + 8); ctx.lineTo(x + q.w - 4, y - 4); ctx.stroke(); } else if (!done) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 4, y + 8); ctx.lineTo(x + q.w - 6, y + 8); ctx.stroke(); } }
        else ctx.fillText(q.c.c, x, y + 3);
        x += q.w;
      }
    });
    // next chunk preview
    const n = S.queue[1];
    if (n) { ctx.font = D.FONT_WORD(30, 500); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText('next: ' + (n.item.t.length > 38 ? n.item.t.slice(0, 36) + '...' : n.item.t), cx + pw / 2 - 40, top + ph + 22); }
    ctx.restore();
    S.panelTop = top;
  }

  /* ---- speedometer + nitro ---- */
  function drawSpeedo(ctx, v) {
    const sc = scaleHud(v), bottom = v.y + v.h - 26 - (TM.settings.keyboard ? 270 : 0);
    const P = S.player, panelH = S.panelTop ? (bottom - S.panelTop) : 200;
    const cx = 150 * sc, cy = (S.panelTop || bottom - 200) - 130 * sc, r = 100 * sc;
    ctx.save();
    // dial
    ctx.fillStyle = 'rgba(31,26,61,0.84)'; ctx.beginPath(); ctx.arc(cx, cy, r + 14, 0, 7); ctx.fill();
    const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2, kmh = P.speedShown * 3.6, fr = clamp(kmh / 260, 0, 1);
    ctx.lineCap = 'round'; ctx.lineWidth = 16 * sc; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(cx, cy, r - 12, a0, a1); ctx.stroke();
    ctx.strokeStyle = S.boostK > 0.3 ? '#2BD9FF' : C.turbo; ctx.beginPath(); ctx.arc(cx, cy, r - 12, a0, a0 + (a1 - a0) * fr); ctx.stroke();
    D.text(ctx, String(Math.round(kmh)), cx, cy - 6 * sc, { size: 62 * sc, color: '#fff' });
    D.text(ctx, 'km/h', cx, cy + 40 * sc, { size: 24 * sc, color: 'rgba(255,255,255,0.7)' });
    // nitro bar (right of the dial)
    const bx = cx + r + 26, bh = 40 * sc, by = cy - bh / 2 + r * 0.45, bw = 330 * sc;
    D.pill(ctx, bx, by, bw, bh, 'rgba(31,26,61,0.88)');
    const nf = S.nitroT > 0 ? clamp(S.nitroT / 3.4, 0, 1) : clamp(S.nitro, 0, 1);
    if (nf > 0.01) D.pill(ctx, bx + 5, by + 5, Math.max(bh - 10, (bw - 10) * nf), bh - 10, S.nitroT > 0 || S.nitro > 0.85 ? '#FFC83D' : C.turbo);
    D.text(ctx, S.nitroT > 0 ? 'NITRO!!' : S.nitro > 0.85 ? 'NITRO READY' : 'NITRO', bx + bw / 2, by + bh / 2 + 2, { size: 26 * sc, color: '#fff', outline: 7 });
    ctx.restore();
    // position numeral
    const rk = S.player.rank;
    const px = W - 140 * sc, py = (S.panelTop || bottom - 200) - 100 * sc;
    D.text(ctx, ORD[rk].toUpperCase(), px, py, { size: 130 * sc, color: rk === 0 ? '#FFC83D' : '#fff', outline: 18, font: D.FONT_DISPLAY(130 * sc, 800) });
    D.text(ctx, 'of ' + S.cars.length, px, py + 78 * sc, { size: 34 * sc, color: '#fff', outline: 8 });
  }

  /* ---- standings ---- */
  function drawStandings(ctx, v) {
    const sc = scaleHud(v), x = 28, y = v.y + 122, rowH = 62 * sc, w = 360 * sc;
    const r = S.cars.slice().sort((a, b) => a.rank - b.rank);
    ctx.save();
    D.pill(ctx, x, y - 8, w, 40 * sc, 'rgba(31,26,61,0.84)'); D.text(ctx, 'RACE', x + 64 * sc, y + 12 * sc, { size: 24 * sc, color: '#fff' }); D.text(ctx, 'WPM', x + w - 56 * sc, y + 12 * sc, { size: 22 * sc, color: 'rgba(255,255,255,0.7)' });
    r.forEach((c, i) => {
      const yy = y + 44 * sc + i * rowH, me = c.isPlayer;
      const path = D.P.rr(x, yy, w, rowH - 8, 18);
      ctx.fillStyle = me ? 'rgba(255,200,61,0.95)' : 'rgba(31,26,61,0.78)'; ctx.fill(path);
      ctx.lineWidth = 4; ctx.strokeStyle = me ? C.ink : 'rgba(255,255,255,0.15)'; ctx.stroke(path);
      D.text(ctx, String(i + 1), x + 30 * sc, yy + (rowH - 8) / 2 + 2, { size: 36 * sc, color: me ? C.ink : '#fff' });
      ctx.fillStyle = c.css; ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x + 76 * sc, yy + (rowH - 8) / 2, 14 * sc, 0, 7); ctx.fill(); ctx.stroke();
      if (g.state === 'countdown' && !me) { D.text(ctx, c.name, x + 102 * sc, yy + (rowH - 8) / 2 - 8 * sc, { size: 28 * sc, color: '#fff', align: 'left' }); D.text(ctx, c.spec.trait, x + 102 * sc, yy + (rowH - 8) / 2 + 16 * sc, { size: 17 * sc, color: '#FFD27A', align: 'left', font: D.FONT_WORD(17 * sc, 500) }); }
      else D.text(ctx, c.name, x + 102 * sc, yy + (rowH - 8) / 2 + 2, { size: 30 * sc, color: me ? C.ink : '#fff', align: 'left' });
      const wpm = c.isPlayer ? Math.round(S.liveWpm) : Math.round(c.rate * 12);
      D.text(ctx, String(S.demo ? '' : wpm), x + w - 36 * sc, yy + (rowH - 8) / 2 + 2, { size: 28 * sc, color: me ? C.ink : 'rgba(255,255,255,0.8)', align: 'right' });
      if (c.nitroT > 0 && !c.isPlayer) D.text(ctx, '⚡', x + w - 100 * sc, yy + (rowH - 8) / 2, { size: 26 * sc, color: '#FFC83D' });
    });
    ctx.restore();
  }

  /* ---- mini-map ---- */
  function drawMinimap(ctx, v) {
    const tr = ST.track, m = tr.mini; if (!m) return;
    const sc = scaleHud(v), box = 230 * sc, x = W - 28 - box, y = v.y + 96;
    const k = Math.min((box - 30) / m.w, (box - 30) / m.h), ox = x + (box - m.w * k) / 2, oy = y + (box - m.h * k) / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(31,26,61,0.78)'; ctx.fill(D.P.rr(x, y, box, box, 26));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); m.pts.forEach((p, i) => { const px = ox + (p[0] - m.x0) * k, py = oy + (p[1] - m.z0) * k; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.closePath();
    ctx.lineWidth = 15 * sc; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.lineWidth = 9 * sc; ctx.strokeStyle = '#fff'; ctx.stroke();
    // features
    for (const j of tr.jumps) { tr.at(j.s0, o1); ctx.fillStyle = '#FFC83D'; ctx.beginPath(); ctx.arc(ox + (o1.x - m.x0) * k, oy + (o1.z - m.z0) * k, 5 * sc, 0, 7); ctx.fill(); }
    for (const p of tr.pads) { tr.at(p.s0, o1); ctx.fillStyle = '#2BD9FF'; ctx.beginPath(); ctx.arc(ox + (o1.x - m.x0) * k, oy + (o1.z - m.z0) * k, 4 * sc, 0, 7); ctx.fill(); }
    tr.at(0, o1); const sx = ox + (o1.x - m.x0) * k, sy = oy + (o1.z - m.z0) * k; ctx.fillStyle = '#fff'; ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.fillRect(sx - 6, sy - 6, 12, 12); ctx.strokeRect(sx - 6, sy - 6, 12, 12);
    const order = S.cars.slice().sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
    for (const c of order) {
      tr.at(c.dist, o1); const px = ox + (o1.x - m.x0) * k, py = oy + (o1.z - m.z0) * k, rad = (c.isPlayer ? 11 : 8.5) * sc;
      if (c.isPlayer) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, rad + 4 + Math.sin(g.t * 6) * 2, 0, 7); ctx.stroke(); }
      ctx.fillStyle = c.css; ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(px, py, rad, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---- lap box ---- */
  function drawLapBox(ctx, v) {
    const sc = scaleHud(v), y = v.y + 110, lap = clamp(S.player.lap + 1, 1, S.laps);
    ctx.save();
    const w = 290 * sc, h = 76 * sc, x = W / 2 - w / 2;
    ctx.fillStyle = 'rgba(31,26,61,0.84)'; ctx.fill(D.P.rr(x, y, w, h, 24));
    D.text(ctx, 'LAP ' + lap + '/' + S.laps, x + w * 0.31, y + h * 0.5 + 2, { size: 40 * sc, color: S.lapFlash > 0 ? '#FFC83D' : '#fff' });
    D.text(ctx, fmt(Math.max(0, S.raceT)), x + w * 0.76, y + h * 0.5 + 2, { size: 30 * sc, color: 'rgba(255,255,255,0.85)', font: D.FONT_WORD(30 * sc, 700) });
    if (S.fastest > 0 && S.fastest < 1e8) D.text(ctx, 'best lap ' + fmt(S.fastest), W / 2, y + h + 22 * sc, { size: 22 * sc, color: '#fff', outline: 6, font: D.FONT_WORD(22 * sc, 500) });
    ctx.restore();
  }

  /* ---- banners ---- */
  function drawBanners(ctx, v) {
    const y0 = v.y + v.h * 0.3;
    S.banners.forEach((b, i) => {
      const k = b.t / b.life, s = k < 0.14 ? U.ease.outBack(k / 0.14) : 1, a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, y0 + (S.banners.length - 1 - i) * -0 + i * 96 - k * 24); ctx.scale(s, s);
      D.text(ctx, b.text, 0, 0, { size: 92, color: b.color, outline: 18, font: D.FONT_DISPLAY(92, 800) });
      if (b.sub) D.text(ctx, b.sub, 0, 66, { size: 38, color: '#fff', outline: 10 });
      ctx.restore();
    });
    if (S.phase === 'race' && S.raceT < 6 && S.player.rate < 0.5 && S.chunkCount === 0 && !S.banners.length) {
      const k = 0.8 + Math.sin(S.hintPulse * 6) * 0.06;
      ctx.save(); ctx.translate(W / 2, y0); ctx.scale(k, k); D.text(ctx, 'TYPE TO GO!', 0, 0, { size: 96, color: '#fff', outline: 18 }); ctx.restore();
    }
  }

  /* ---- streaks / vignette ---- */
  function drawStreaks(ctx, v) {
    const bk = S.boostK, spd = clamp((S.player.speedShown - 40) / 40, 0, 1), k = Math.max(bk, spd * 0.35);
    if (k < 0.04 || TM.settings.reduceMotion) return;
    const cx = W / 2, cy = v.y + v.h * 0.42;
    ctx.save(); ctx.lineCap = 'round';
    const n = 34, t = g.t;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.sin(i * 12.9) * 0.2, ph = (t * (1.8 + (i % 5) * 0.4) + i * 0.37) % 1;
      const r0 = 420 + ph * 900, r1 = r0 + 160 + 340 * k;
      const ex = Math.cos(a), ey = Math.sin(a) * (v.h / v.w) * 1.55 + Math.sin(a) * 0.3;
      ctx.globalAlpha = k * (0.18 + 0.4 * (1 - Math.abs(ph - 0.5) * 2)) * (bk > 0.3 ? 1 : 0.6);
      ctx.strokeStyle = bk > 0.3 ? (i % 3 ? '#FFD27A' : '#fff') : '#fff'; ctx.lineWidth = 3 + (i % 3) * 2;
      ctx.beginPath(); ctx.moveTo(cx + ex * r0, cy + ey * r0 * 0.62); ctx.lineTo(cx + ex * r1, cy + ey * r1 * 0.62); ctx.stroke();
    }
    if (bk > 0.05) {
      ctx.globalAlpha = bk * 0.5; const gr = ctx.createRadialGradient(cx, cy, 500, cx, cy, 1250);
      gr.addColorStop(0, 'rgba(255,120,30,0)'); gr.addColorStop(1, 'rgba(255,90,20,0.65)'); ctx.fillStyle = gr; ctx.fillRect(v.x - 20, v.y - 20, v.w + 40, v.h + 40);
    }
    ctx.restore();
  }

  /* ---- rival name tags ---- */
  function drawTags(ctx, v) {
    const wc = world.camera, P = S.player;
    for (const c of S.cars) {
      if (c.isPlayer) continue; const dd = c.dist - P.dist; if (dd < -35 || dd > 230) continue;
      _v.copy(c.pos); _v.y += 3.3; _v.project(wc); if (_v.z > 1 || _v.z < -1) continue;
      const x = v.x + (_v.x * 0.5 + 0.5) * v.w, y = v.y + (-_v.y * 0.5 + 0.5) * v.h;
      if (x < v.x + 30 || x > v.x + v.w - 30 || y < v.y + 30 || y > v.y + v.h - 40) continue;
      const a = clamp(1.1 - Math.abs(dd) / 230, 0.45, 1), s = clamp(1.1 - Math.abs(dd) / 400, 0.7, 1.05);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(s, s);
      ctx.font = D.FONT_DISPLAY(32); const tw = ctx.measureText(c.name).width + 44;
      D.pill(ctx, -tw / 2, -22, tw, 44, 'rgba(31,26,61,0.85)'); ctx.fillStyle = c.css; ctx.beginPath(); ctx.arc(-tw / 2 + 22, 0, 9, 0, 7); ctx.fill();
      D.text(ctx, c.name, 12, 2, { size: 32, color: '#fff' });
      ctx.fillStyle = 'rgba(31,26,61,0.85)'; ctx.beginPath(); ctx.moveTo(-9, 22); ctx.lineTo(9, 22); ctx.lineTo(0, 34); ctx.fill();
      ctx.restore();
    }
  }

  /* ---- countdown lights overlay ---- */
  function drawCountdownLights(ctx, v) {
    if (g.state !== 'countdown') return;
    const y = v.y + v.h * 0.2;
    ctx.save(); const n = S.lightsOn;
    D.pill(ctx, W / 2 - 230, y - 62, 460, 124, 'rgba(31,26,61,0.86)');
    for (let i = 0; i < 4; i++) {
      const on = i < 3 ? i < n : false; ctx.fillStyle = on ? '#ff3030' : '#3a1a24'; ctx.strokeStyle = C.ink; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(W / 2 - 165 + i * 110, y, 40, 0, 7); ctx.fill(); ctx.stroke();
      if (on) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(W / 2 - 175 + i * 110, y - 12, 11, 0, 7); ctx.fill(); }
      if (i === 3) { ctx.fillStyle = '#16301f'; ctx.beginPath(); ctx.arc(W / 2 - 165 + i * 110, y, 36, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }

  function drawFinishUI(ctx, v) {
    if (!S.results) return;
    const x = W / 2 - 220, y = v.y + 190;
    if (S.podium) {
      const rows = S.results; ctx.save();
      ctx.fillStyle = 'rgba(31,26,61,0.8)'; ctx.fill(D.P.rr(W / 2 - 330, v.y + v.h - 330, 660, 280, 30));
      D.text(ctx, 'FINAL RESULTS', W / 2, v.y + v.h - 296, { size: 34, color: '#FFC83D' });
      rows.forEach((c, i) => {
        const yy = v.y + v.h - 250 + i * 48;
        D.text(ctx, ORD[i], W / 2 - 280, yy, { size: 34, color: i === 0 ? '#FFC83D' : '#fff', align: 'left' });
        ctx.fillStyle = c.css; ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(W / 2 - 160, yy, 13, 0, 7); ctx.fill(); ctx.stroke();
        D.text(ctx, c.name, W / 2 - 130, yy, { size: 34, color: c.isPlayer ? '#FFC83D' : '#fff', align: 'left' });
        D.text(ctx, c.finished ? fmt(c.finishT) : '--', W / 2 + 290, yy, { size: 30, color: 'rgba(255,255,255,0.85)', align: 'right' });
      });
      ctx.restore();
    }
  }

  /* ====================================================================== title extras (track + laps pickers) */
  function injectTitleUI() {
    const css = document.createElement('style');
    css.textContent = `
      .tt-pick{display:flex;flex-direction:column;align-items:center;gap:10px}
      .tt-cards{display:flex;gap:14px;flex-wrap:wrap;justify-content:center}
      .tt-card{font:800 24px/1 var(--display);color:var(--ink);background:#fff;border:var(--lw) solid var(--ink);border-radius:22px;padding:10px 14px 10px;cursor:pointer;box-shadow:var(--drop);display:flex;flex-direction:column;align-items:center;gap:4px;min-width:196px;transition:transform .08s}
      .tt-card:hover{transform:translateY(-3px)}
      .tt-card.on{background:var(--accent);color:#fff;transform:translateY(-4px) scale(1.04)}
      .tt-card canvas{width:150px;height:66px;background:rgba(31,26,61,.14);border-radius:12px}
      .tt-card.on canvas{background:rgba(31,26,61,.35)}
      .tt-card small{font:700 15px var(--word);opacity:.85}
      .tt-card .lv{font:800 15px var(--display);background:var(--ink);color:#fff;border-radius:999px;padding:3px 12px 1px;letter-spacing:.5px}
      .tt-row{display:flex;gap:12px;align-items:center;color:#fff;font:800 22px var(--display);text-shadow:0 2px 0 var(--ink)}
      .tt-blurb{font:700 19px var(--word);color:#fff;text-shadow:0 2px 0 var(--ink);min-height:24px;text-align:center}
      .tt-note{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:var(--gold);border:4px solid var(--ink);border-radius:18px;padding:8px 18px;font:700 18px var(--word);z-index:12}
      .tm-title .tm-logo{font-size:min(11vw,132px)}
      @media (max-height:820px){.tt-card{min-width:150px;padding:6px 10px;font-size:20px}.tt-card canvas{width:120px;height:46px}.tt-card small{display:none}.tm-title{gap:12px}.tm-title .tm-logo{font-size:min(10vw,92px)}.tt-blurb{display:none}}
      @media (max-height:640px){.tt-cards{gap:8px}.tt-card canvas{display:none}.tt-card{min-width:120px}.tm-title .tm-tagline{display:none}}
      @media (max-width:640px){.tt-card{min-width:100px}.tt-card canvas{display:none}}
    `;
    document.head.append(css);
    const box = document.querySelector('.tm-title'); if (!box) return;
    const el = TM.ui.el;
    ST.cards = [];
    const cards = el('div', { class: 'tt-cards' });
    TT.TRACKS.forEach((d, i) => {
      const cv = el('canvas', { width: 300, height: 132 });
      const card = el('button', { class: 'tt-card', onclick: () => pickTrack(i) }, cv, el('div', {}, d.name), el('span', { class: 'lv' }, d.level.toUpperCase() + ' ' + '★'.repeat(i + 1)), el('small', {}, TM.store.get('turbo.best.' + d.id, 0) ? 'best lap ' + fmt(TM.store.get('turbo.best.' + d.id, 0)) : d.ja));
      cards.append(card); ST.cards.push({ card, cv, d });
      const b = d.built || (d.built = TT.buildTrack(d)); drawMiniCard(cv, b);
    });
    const lapBtns = {};
    const laps = el('div', { class: 'tt-row' }, 'Laps', el('div', { class: 'tm-seg' }, [1, 2, 3, 5].map((n) => { const b = el('button', { onclick: () => { setLaps(n); TM.sfx.click(); } }, String(n)); lapBtns[n] = b; return b; })));
    ST.lapBtns = lapBtns;
    ST.blurb = el('div', { class: 'tt-blurb' }, '');
    ST.pick = el('div', { class: 'tt-pick' }, cards, laps, ST.blurb);
    const row2 = box.querySelectorAll('.tm-row'); const ref = row2[1] || null;
    box.insertBefore(ST.pick, ref);
    setLaps(ST.laps, true); refreshCards();
    if (ST.fileMode) { const n = el('div', { class: 'tt-note' }, 'Open this game from a web server (http) to see the full 3D art - simple blocks are shown instead.'); document.body.append(n); }
    const logo = box.querySelector('.tm-logo'); if (logo) logo.innerHTML = 'Turbo Type';
  }
  function drawMiniCard(cv, tr) {
    const c = cv.getContext('2d'), b = tr.bounds, w = cv.width, h = cv.height, k = Math.min((w - 24) / (b.x1 - b.x0), (h - 24) / (b.z1 - b.z0));
    const ox = (w - (b.x1 - b.x0) * k) / 2, oy = (h - (b.z1 - b.z0) * k) / 2;
    c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath();
    for (let i = 0; i <= tr.N; i += 3) { const j = i % tr.N, x = ox + (tr.X[j] - b.x0) * k, y = oy + (tr.Z[j] - b.z0) * k; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.closePath(); c.lineWidth = 14; c.strokeStyle = '#1F1A3D'; c.stroke(); c.lineWidth = 8; c.strokeStyle = '#fff'; c.stroke();
    for (const j of tr.jumps) { tr.at(j.s0, o1); c.fillStyle = '#FFC83D'; c.beginPath(); c.arc(ox + (o1.x - b.x0) * k, oy + (o1.z - b.z0) * k, 7, 0, 7); c.fill(); c.strokeStyle = '#1F1A3D'; c.lineWidth = 3; c.stroke(); }
    tr.at(0, o1); c.fillStyle = '#fff'; c.fillRect(ox + (o1.x - b.x0) * k - 7, oy + (o1.z - b.z0) * k - 7, 14, 14); c.strokeRect(ox + (o1.x - b.x0) * k - 7, oy + (o1.z - b.z0) * k - 7, 14, 14);
  }
  function refreshCards() { ST.cards.forEach((c, i) => c.card.classList.toggle('on', i === ST.trackIdx)); if (ST.blurb) ST.blurb.textContent = TT.TRACKS[ST.trackIdx].blurb; }
  function pickTrack(i) {
    TM.sfx.click(); TM.store.set('turbo.track', i);
    if (i === ST.trackIdx && ST.ready) return;
    ST.trackIdx = i; refreshCards(); ST.ready = false; buildTrackIdx(i);
  }
  function setLaps(n, quiet) { ST.laps = n; TM.store.set('turbo.laps', n); for (const k in ST.lapBtns) ST.lapBtns[k].classList.toggle('on', +k === n); if (S) { S.laps = n; S.total = n * ST.track.L; } }

  /* ====================================================================== init */
  function init(gm) {
    g = gm;
    try {
      const cv = document.createElement('canvas'); cv.id = 'world3d';
      cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block;z-index:0';
      document.body.insertBefore(cv, document.getElementById('stage'));
      world = new TT.World(cv);
    } catch (e) { ST.noGL = true; console.warn('WebGL unavailable', e); return; }
    window.addEventListener('resize', () => world.resize());
    ST.fileMode = location.protocol === 'file:'; ST.skipRender = U.qs('norender') === '1';
    ST.trackIdx = clamp(TM.store.get('turbo.track', 0) | 0, 0, TT.TRACKS.length - 1);
    ST.laps = [1, 2, 3, 5].includes(TM.store.get('turbo.laps', 3)) ? TM.store.get('turbo.laps', 3) : 3;
    injectTitleUI();
    TT.Models.load().then(() => { buildTrackIdx(ST.trackIdx); });
    window.TTdebug = { get S() { return S; }, get g() { return g; }, world, ST };
  }

  /* ====================================================================== boot */
  const music = SONGS.sunny;
  def = {
    id: 'turbo-type', name: 'Turbo Type', accent: C.turbo, bg: '#2A2350', fullBleed: true,
    logoHTML: 'Turbo Type', tagline: 'Your race car goes as fast as you type!',
    howto: [
      'Type the words at the bottom of the screen. <b>Every correct letter</b> makes your car go faster - you steer nothing, <b>typing is the engine</b>!',
      'A wrong key makes you <b>stumble</b> and slow down for a moment. Keep calm and carry on.',
      'Finish words with <b>no mistakes</b> to fill the <b>NITRO</b> meter. Full meter = turbo boost! Sentences give the biggest boost.',
      'Hit the <b>blue boost pads</b> and fly off the <b>yellow ramps</b> for bonus points.',
      'Race three rivals - Mochi, Taro and Sora - for 1, 2, 3 or 5 laps. Pick your track on the title screen!',
    ],
    music, init, reset, update, draw, onKey,
    nextKey: () => (S && S.queue && S.queue[0] ? S.queue[0].nextReq() : null),
    hud: () => {
      if (!S) return {};
      return { right: ORD[S.player.rank] + ' / ' + S.cars.length, progress: clamp(S.player.dist / S.total, 0, 1) };
    },
  };
  // the framework counts 3-2-1: light up the gantry accordingly
  const _origNow = performance.now.bind(performance);
  TM.game(def);

  // countdown mirror: derive the number of red lights from the framework's overlay timing
  (function watchCountdown() {
    let lastState = '', t0 = 0;
    function loop() {
      requestAnimationFrame(loop);
      if (!S || !g) return;
      if (g.state === 'countdown') { if (lastState !== 'countdown') t0 = performance.now(); const e = (performance.now() - t0) / 1000; S.lightsOn = e < 0.05 ? 0 : Math.min(3, Math.floor(e + 0.95)); }
      else if (g.state === 'play') S.lightsOn = 4;
      lastState = g.state;
    }
    loop();
  })();
})();
