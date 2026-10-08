/* Rooftop Rascal - a typing parkour runner.
   Rascal the raccoon dashes across five night-to-dawn city districts. Every obstacle carries a word:
   type it and Rascal jumps, slides, climbs, wall-kicks, bounces or ziplines past it. Stall or mistype
   and the bumbling pigeon security squad closes in. Each run ends with a big sentence leap to the pantry. */
(function () {
  'use strict';
  const TM = window.TM, C = TM.C, U = TM.U, D = TM.draw, P = D.P, RR = window.RR;
  const W = 1920, H = 1080, TAU = Math.PI * 2;
  const clamp = U.clamp, lerp = U.lerp;
  const sm = (t) => t * t * (3 - 2 * t);
  const ANCHOR = 600;                 // screen x of Rascal
  const GROUND_SY = 800;              // screen y of the roof Rascal runs on (title demo lowers it)
  const DMAX = 1500, DSTART = 1050, DCATCH = 170;

  /* ---------------- persistent progress ---------------- */
  const SAVE0 = { gems: 0, best: 0, stars: {}, hat: 'none', fish: 0, plays: 0 };
  let save = Object.assign({}, SAVE0, TM.store.get('rr', {}));
  function persist() { TM.store.set('rr', save); }
  const hatUnlocked = (h) => save.gems >= h.cost;

  /* ---------------- state ---------------- */
  let S = null, G = null;
  let pendingRun = 1, demoRun = 0;
  const BGS = {};
  const getBG = (runN) => { const di = (runN - 1) % 5; return BGS[di] || (BGS[di] = RR.makeBG(RR.DISTRICTS[di], di)); };

  function runParam() { const q = parseInt(TM.U.qs('run'), 10); return q >= 1 && q <= 30 ? q : 0; }

  function reset(g) {
    G = g;
    const qp = runParam();
    const run = g.demo ? (qp || (demoRun++ % 5) + 1) : (qp || pendingRun);
    S = {
      run, t: 0, lives: g.diff === 'gentle' ? 5 : 3, maxLives: g.diff === 'gentle' ? 5 : 3,
      L: null, bg: null, dist: null, cur: 0, mode: 'idle', mv: null, mvK: 0, rx: 0, ry: 700, rot: 0, face: 1, ph: 0, pose: null, roof: null,
      gsy: g.demo ? 930 : GROUND_SY, cam: { x: -ANCHOR, y: 0, z: 1, zT: 1 }, speedFx: 0, ts: 1, tsT: 1, flinch: 0, squash: 0, stallT: 0, tumbleT: 0, celeT: 0, idleT: 1.2,
      D: DSTART, Dd: DSTART, stealth: 0, ghost: 0, boost: 0, magnet: 0, vMul: 1,
      catches: 0, runGems: 0, runFish: 0, runCookies: 0, missBase: 0, keyBase: 0, hat: save.hat, bot: new TM.Bot(8.5), botWait: 0, endless: run > 5, botPrompt: 0,
      banner: { t: 0, run }, summary: null, newHats: [], gemsAtStart: save.gems, runsDone: 0, totalCatches: 0, sneakWake: 0, lines: [], bubble: { t: 0, i: 0 },
      crowFly: {}, pressT: 0, lastEv: -1, popT: 0, danger: 0, ended: false, countdownIdle: true,
    };
    for (let i = 0; i < 26; i++) S.lines.push({ y: Math.random() * H, x: Math.random() * 2400 - 200, l: 120 + Math.random() * 380, sp: 1500 + Math.random() * 1500, a: 0.3 + Math.random() * 0.5 });
    RR.parts.clear();
    loadRun(g, run);
  }

  function loadRun(g, run) {
    S.run = run; S.L = RR.buildLevel(g, run); S.dist = S.L.dist; S.bg = getBG(run);
    S.cur = 0; S.mode = 'idle'; S.idleT = g.demo ? 0.6 : 0.5; S.mv = null; S.rx = 0; S.roof = S.L.roofs[0]; S.ry = S.roof.y; S.rot = 0; S.face = 1;
    S.D = DSTART; S.Dd = DSTART; S.ghost = 0; S.boost = 0; S.magnet = 0; S.stealth = Math.min(S.stealth, 0.3); S.catches = 0; S.runGems = 0; S.runFish = 0; S.runCookies = 0;
    S.missBase = g.score.misses; S.keyBase = g.score.keys; S.wordsBase = g.score.wordsDone;
    S.cam.x = -ANCHOR - 60; S.cam.y = S.ry - S.gsy; S.cam.z = 1.06; S.cam.zT = 1;
    S.banner = { t: 0, run }; S.summary = null; S.crowFly = {}; S.runT = 0;
    S.skyProg = 0;
    if (!g.demo && g.state === 'play') startMusic();
  }
  function startMusic() { if (TM.settings.music > 0) { try { TM.audio.startMusic(RR.SONGS[(S.run - 1) % 5]); } catch (e) { } } }

  /* ---------------- helpers ---------------- */
  const activeOb = () => { for (let i = S.cur; i < S.L.obs.length; i++) if (!S.L.obs[i].typed) return S.L.obs[i]; return null; };
  const nextOb = () => S.L.obs[S.cur] || null;
  function typerOf(ob) { if (!ob.typer) ob.typer = new TM.Typer(ob.item); return ob.typer; }
  const chaseRate = (g) => (g.diff === 'gentle' ? 0.5 : g.diff === 'turbo' ? 0.75 : 0.62);
  const dMaxEff = () => DMAX;
  let CS = 1;
  let ZB = 1.32; // base zoom so Rascal reads big; grows a little on tall/narrow windows
  function toScreen(wx, wy) { // world -> virtual screen (after zoom)
    const c = S.cam, px = ANCHOR, py = S.gsy, zz = c.z * ZB;
    const sx = wx - c.x, sy = wy - c.y;
    return [px + (sx - px) * zz, py + (sy - py) * zz];
  }
  const feetS = () => toScreen(S.rx, S.ry);
  function say(g, str, color, size) { if (g.demo) return; const p = toScreen(S.rx + 40, S.ry - 230); g.fx.pop(clamp(p[0], 200, 1700), clamp(p[1] - 60, 240, 800), str, { color: color || C.gold, size: size || 58, life: 0.9 }); }
  const typeWord = { gap: 'Great jump!', slide: 'Smooth!', crow: 'Hop!', bounce: 'Boing!', wall: 'Nice climb!', kick: 'Wall kick!', zip: 'Zip zip!', sneak: 'So sneaky!', finale: 'YOU DID IT!' };
  const typeColor = { gap: '#FFC83D', slide: '#2BE6FF', crow: '#FF8A5C', bounce: '#FF3EA5', wall: '#8CFF6A', kick: '#FF8A3D', zip: '#7B5CFF', sneak: '#9BE59B', finale: '#FFC83D' };
  const typeIcon = { gap: '#FFC83D', slide: '#2BE6FF', crow: '#FF8A5C', bounce: '#FF3EA5', wall: '#8CFF6A', kick: '#FF8A3D', zip: '#9B7CFF', sneak: '#6FD28A', finale: '#FFC83D' };

  /* ---------------- input ---------------- */
  function onKey(g, k) {
    if (!S || S.mode === 'summary' || S.mode === 'celebrate') return;
    if (S.mode === 'tumble') return;
    const ob = activeOb(); if (!ob) return;
    if (ob.lx - S.rx > 2500) return;
    const ty = typerOf(ob);
    const r = ty.feed(k);
    g.keyResult(r);
    if (r === 'miss') {
      if (S.ghost <= 0) { S.D -= g.diff === 'gentle' ? 40 : 90; }
      S.flinch = 0.22; S.stealth = Math.max(0, S.stealth - 0.03);
      if (S.mode === 'run') RR.parts.dust(S.rx - 20, S.ry, 3, 0.7, null, -1);
    } else if (r === 'done') wordDone(g, ob);
  }
  function onBack() { }
  function onEnter(g) { if (S && S.mode === 'summary' && S.summary && S.summary.t > 1.2) nextRun(g); }

  function wordDone(g, ob) {
    ob.typed = true;
    const ty = ob.typer, clean = ty.errors === 0;
    const bonus = (ob.type === 'finale' ? 3 : ob.type === 'zip' ? 1.5 : ob.type === 'sneak' && clean ? 2 : 1) * (S.ghost > 0 ? 2 : 1) * (S.boost > 0 ? 1.5 : 1);
    const p = chipAnchor(ob);
    g.wordDone(ty, clamp(p[0], 200, 1700), clamp(p[1], 260, 700), { bonus });
    ob.clean = clean;
    if (!g.demo) RR.sfx('jump' + (1 + (ob.idx % 2)), 0.25, 1.3);
    if (!clean && !g.demo) { /* tricky word logged by Score already */ }
    // if Rascal is waiting right at this obstacle he goes now
    if (S.mode === 'wait' && nextOb() === ob) beginMove(g, ob);
  }

  /* ---------------- moves ---------------- */
  function beginMove(g, ob) {
    S.mode = 'move'; S.mv = ob; S.mvK = 0; S.lastSeg = -1; S.pressT = 0; S.stallT = 0;
    const clean = ob.clean !== false;
    if (ob.type === 'sneak') { ob.awake = !clean && S.ghost <= 0; ob.wokeT = 0; }
    S.cam.zT = ob.camZ;
    if (!g.demo) { if (ob.shake) g.fx.shake(ob.shake * 0.5, 0.14); }
    if (!g.demo) {
      if (ob.type === 'gap') RR.sfx('jump1', 0.7);
      else if (ob.type === 'slide') { RR.sfx('slide', 0.5, 1.4); TM.sfx.whoosh(); }
      else if (ob.type === 'crow') RR.sfx('jump2', 0.6, 1.2);
      else if (ob.type === 'sneak') RR.sfx('sneak', 0.5);
      else if (ob.type === 'zip') RR.sfx('jump2', 0.6, 1.4);
      else if (ob.type === 'wall') RR.sfx('jump1', 0.6, 0.9);
      else if (ob.type === 'kick') RR.sfx('jump1', 0.7, 1.1);
      else if (ob.type === 'finale') { RR.sfx('boost', 0.8); TM.sfx.whoosh(); }
    }
    RR.parts.dust(S.rx, S.ry, ob.type === 'slide' ? 6 : 4, 0.9, null, -1);
  }
  function moveEvents(g, ob, q) {
    if (q.seg === S.lastSeg) return; const prev = S.lastSeg; S.lastSeg = q.seg;
    const isDemo = g.demo;
    if (ob.type === 'bounce' && q.seg === 1) {
      S.pressT = 0.2; RR.sfx('bounce', 0.8); if (!isDemo) g.fx.shake(10, 0.2);
      RR.parts.dust(ob.tramp.x, S.roof.y, 8, 1.1); RR.parts.sparks(ob.tramp.x, S.roof.y - 80, 8, '#FFC83D');
      S.cam.zT = 0.96;
    }
    if (ob.type === 'kick' && (q.seg === 1 || q.seg === 3)) { RR.sfx('wall', 0.8, q.seg === 1 ? 1 : 1.2); if (!isDemo) g.fx.shake(8, 0.15); RR.parts.sparks(q.x + 30 * q.face, q.y - 60, 7, '#FFFFFF', 340); RR.parts.dust(q.x + 24 * q.face, q.y - 40, 3, 0.8); }
    if (ob.type === 'kick' && q.seg === 4) S.cam.zT = 1.02;
    if (ob.type === 'wall' && q.seg === 2) { RR.parts.dust(q.x, q.y - 30, 6, 0.9); if (!isDemo) g.fx.shake(5, 0.12); RR.sfx('land', 0.4, 1.3); }
    if (ob.type === 'zip' && q.seg === 2) { RR.sfx('zip', 0.7, 1.0); S.cam.zT = 0.92; ob.zipping = true; }
    if (ob.type === 'zip' && q.seg === 3) { S.cam.zT = 1.0; ob.zipping = false; RR.parts.sparks(q.x, q.y - 130, 8, '#FFFFFF'); }
    if (ob.type === 'crow' && q.seg === 0) { ob.crowFlyT = 0; }
    if (ob.type === 'finale' && q.seg === 1) { S.cam.zT = 0.8; S.tsT = 0.8; if (!isDemo) { g.fx.doFlash('#FFFFFF', 0.35); g.fx.shake(10, 0.3); } RR.parts.sparks(q.x, q.y - 60, 14, '#FFC83D', 600); }
    if (ob.type === 'finale' && q.seg === 2) { S.tsT = 1; }
    if (ob.type === 'sneak' && ob.awake && q.u > 0.35 && !ob.alerted) { /* handled in update */ }
  }
  function finishMove(g, ob) {
    ob.done = true; S.cur = Math.max(S.cur, S.L.obs.indexOf(ob) + 1);
    S.roof = ob.roofTo; S.mv = null; S.mode = 'run'; S.rot = 0; S.face = 1; S.ph = 0;
    S.rx = ob.ex; S.ry = S.roof.y; S.squash = 1; S.cam.zT = 1; S.tsT = 1; S.ts = Math.max(S.ts, 0.9);
    RR.parts.dust(S.rx, S.ry, 7, 1.15); RR.parts.dust(S.rx, S.ry, 3, 0.8, null, 1);
    if (!g.demo) { RR.sfx('land', 0.6); g.fx.shake(ob.type === 'finale' ? 22 : 6, 0.18); }
    if (ob.type === 'finale') { finale(g); return; }
    if (!g.demo) {
      say(g, typeWord[ob.type] || 'Nice!', typeColor[ob.type]);
      if (ob.clean !== false) { S.stealth = Math.min(1, S.stealth + (ob.type === 'sneak' ? 0.22 : 0.09)); }
      if (ob.type === 'sneak' && ob.clean !== false) { g.score.add(60 * g.score.mult); g.fx.pop(W / 2, 330, 'SNEAKY BONUS!', { color: '#9BE59B', size: 56, life: 1.1 }); }
      if (S.stealth >= 1 && S.ghost <= 0) startGhost(g, 7);
    }
  }
  function startGhost(g, secs) {
    S.ghost = secs; S.stealth = 0; S.D = DMAX; S.hushed = true;
    RR.sfx('ghost', 0.8); RR.sfx('smoke', 0.5); RR.parts.puffSmoke(S.rx, S.ry - 70, 10, '#7C6ADB');
    if (!G.demo) { G.fx.pop(W / 2, 360, 'GHOST RUN!', { color: '#B9A8FF', size: 90, life: 1.6 }); G.fx.doFlash('#8E7BD8', 0.35); }
  }

  /* ---------------- run complete / flow ---------------- */
  function finale(g) {
    S.mode = 'celebrate'; S.celeT = 0; S.runsDone++;
    if (g.demo) { S.mode = 'demoEnd'; S.celeT = 0; return; }
    RR.sfx('tada', 0.9); TM.sfx.win();
    g.fx.confetti(W / 2, 300, 120); g.fx.confetti(W / 2 - 500, 400, 50); g.fx.confetti(W / 2 + 500, 400, 50);
    g.fx.pop(W / 2, 330, 'RUN COMPLETE!', { color: '#FFC83D', size: 110, life: 2.4 });
    g.score.add(250 * S.run);
    // rating
    const keys = g.score.keys - S.keyBase, miss = g.score.misses - S.missBase;
    const acc = keys ? 1 - miss / keys : 1;
    let stars = 1; if (S.catches <= 1 || acc >= 0.9) stars = 2; if (S.catches === 0 && acc >= 0.88) stars = 3;
    const bonusGems = stars * 3;
    save.gems += bonusGems + 0; save.fish += S.runFish; if (S.run <= 5) { save.best = Math.max(save.best, S.run); save.stars[S.run] = Math.max(save.stars[S.run] || 0, stars); }
    save.plays++;
    const before = RR.HATS.filter((h) => save.gems - S.runGems - bonusGems >= h.cost).length;
    S.newHats = RR.HATS.filter((h) => save.gems >= h.cost && save.gems - S.runGems - bonusGems < h.cost);
    persist();
    S.summary = { t: 0, stars, acc, bonusGems, miss };
  }
  function nextRun(g) {
    if (S.run >= 5 && !(S.endless)) { endGame(g, true); return; }
    S.run++;
    S.mode = 'idle'; loadRun(g, S.run);
    G.fx.confetti && 0;
    if (!g.demo) startMusic();
  }
  function endGame(g, win) {
    if (S.ended) return; S.ended = true;
    const stars = Object.values(save.stars).reduce((a, b) => a + b, 0);
    const runs = S.runsDone;
    const hatNote = S.newHats.length ? ' New hat: ' + S.newHats.map((h) => h.name).join(', ') + '!' : '';
    g.end(win ? { win: true, title: 'Home sweet home!', sub: 'Rascal raided the pantry in all five districts!' + hatNote, targetMet: true, stats: [['Runs', runs], ['Gems', S.sessGems || 0]] }
      : { win: false, title: runs >= 1 ? 'Nice sneaking!' : 'Caught by the pigeons!', sub: `Rascal cleared ${runs} run${runs === 1 ? '' : 's'} before the squad caught up.` + hatNote, targetMet: runs >= 3, stats: [['Runs', runs], ['Gems', S.sessGems || 0]] });
  }
  function caught(g) {
    S.catches++; S.lives--; S.mode = 'tumble'; S.tumbleT = 0; S.stealth = Math.max(0, S.stealth - 0.35);
    S.mv = null;
    if (!g.demo) {
      RR.sfx('caught', 0.9); TM.sfx.hurt(); g.fx.shake(20, 0.35); g.fx.doFlash('#FFE9A8', 0.6);
      g.fx.pop(W / 2, 380, 'BUSTED!', { color: '#FF5A5F', size: 110, life: 1.5 }); S.cam.zT = 1.12;
    }
    RR.parts.sparks(S.rx, S.ry - 90, 10, '#FFE066', 500);
    if (S.lives <= 0 && !g.demo) { S.dying = true; }
  }

  /* ---------------- update ---------------- */
  function update(g, dt) {
    if (!S) return;
    S.t += dt;
    const active = g.state === 'play' || g.demo;
    const inCount = g.state === 'countdown';
    if (inCount) S.pose = RR.pose.idle(S.t);
    RR.parts.update(dt);
    S.banner.t += dt;
    S.ts += (S.tsT - S.ts) * Math.min(1, dt * 5);
    const wdt = dt * S.ts;
    if (g.demo) S.bg && 0;
    if (!active && !inCount) { cameraUpdate(g, dt); return; }
    if (inCount) { S.cam.z += (1 - S.cam.z) * Math.min(1, dt * 2); cameraUpdate(g, dt); return; }
    S.runT += wdt;
    if (g.state === 'play' && !S.musicOn) { S.musicOn = true; startMusic(); }
    const L = S.L, base = L.v, rate = chaseRate(g);
    S.vMul = S.boost > 0 ? 1.4 : 1;
    const v = base * S.vMul;
    S.flinch = Math.max(0, S.flinch - dt);
    S.squash = Math.max(0, S.squash - dt * 4.5);
    if (S.ghost > 0) { S.ghost -= wdt; S.D = DMAX; if (S.ghost <= 0) { S.D = DMAX; S.hushed = false; } }
    if (S.boost > 0) { S.boost -= wdt; S.D = Math.min(DMAX, S.D + base * 0.5 * wdt); }
    if (S.magnet > 0) S.magnet -= wdt;
    S.pressT = Math.max(0, S.pressT - dt);
    // the sun creeps up over the run
    S.skyProg = clamp(S.rx / L.length, 0, 1);

    const ob = nextOb();
    if (S.mode === 'idle') {
      S.idleT -= dt; S.pose = RR.pose.idle(S.t); S.ry = S.roof.y;
      if (S.idleT <= 0) { S.mode = 'run'; }
    } else if (S.mode === 'run') {
      S.ph += v * wdt / 34; S.rx += v * wdt; S.ry = S.roof.y;
      S.pose = S.flinch > 0 ? RR.pose.skid(S.t) : RR.pose.run(S.ph, S.boost > 0 ? 1 : (g.score.mult > 1 ? 0.5 : 0));
      S.face = 1; S.rot = 0;
      if (Math.floor(S.ph / Math.PI) !== Math.floor((S.ph - v * wdt / 34) / Math.PI)) RR.parts.dust(S.rx - 28, S.ry, 1, S.boost > 0 ? 0.9 : 0.55, null, -1);
      if (ob && S.rx >= ob.lx) {
        if (ob.typed) beginMove(g, ob);
        else { S.rx = ob.lx; S.mode = 'wait'; S.stallT = 0; RR.parts.dust(S.rx, S.ry, 5, 0.9, null, 1); }
      }
      if (S.ghost <= 0) S.D = Math.min(DMAX, S.D + base * 0.08 * wdt);
    } else if (S.mode === 'wait') {
      S.stallT += wdt; S.pose = RR.pose.wait(S.t); S.ry = S.roof.y; S.face = 1; S.rot = 0;
      if (ob && ob.typed) beginMove(g, ob);
      else if (S.ghost <= 0 && !g.demo) S.D -= base * rate * 0.55 * wdt * (1 + Math.min(S.stallT, 3) * 0.12);
      if (g.demo && S.stallT > 2) { const o = nextOb(); if (o) o.typed = true; }
    } else if (S.mode === 'move') {
      const ob2 = S.mv;
      const speedK = (S.boost > 0 ? 1.25 : 1) * (ob2.type === 'sneak' ? 1 : 1);
      S.mvK += wdt * speedK / ob2.mv.dur;
      S.ph += v * wdt / 34;
      const q = RR.evalMove(ob2.mv, S.mvK, S.ph, S.t);
      S.rx = q.x; S.ry = q.y; S.rot = q.rot; S.face = q.face; S.pose = q.pose; S.mvQ = q;
      moveEvents(g, ob2, q);
      if (ob2.type === 'sneak') sneakUpdate(g, ob2, q, wdt);
      if (ob2.type === 'crow' && S.mvK > 0.36) ob2.crowFlyT = (ob2.crowFlyT || 0) + wdt;
      if (ob2.type === 'slide' && Math.random() < 0.5) RR.parts.dust(S.rx - 30, S.ry, 1, 0.7, null, -1);
      if (ob2.type === 'zip') { if (Math.random() < 0.7 && ob2.zipping) RR.parts.spark && RR.parts.trail(S.rx, S.ry - 135, '#FFFFFF', 34); }
      if (ob2.type === 'finale' && q.seg === 1 && Math.random() < 0.8) RR.parts.trail(S.rx, S.ry - 60, '#FFD76A', 56);
      if (ob2.type === 'bounce' && q.seg === 1 && Math.random() < 0.6) RR.parts.trail(S.rx, S.ry - 60, '#FF8AD0', 40);
      if (S.ghost <= 0) S.D = Math.min(DMAX, S.D + base * 0.07 * wdt * (ob2.type === 'sneak' ? 0 : 1));
      if (S.mvK >= 1) finishMove(g, ob2);
    } else if (S.mode === 'tumble') {
      S.tumbleT += dt; S.pose = RR.pose.tumble(S.t); S.rot += dt * 14; S.face = 1;
      S.ry = S.roof.y - Math.abs(Math.sin(S.tumbleT * 5)) * 50 * Math.max(0, 1 - S.tumbleT);
      if (S.tumbleT > 1.15) {
        S.rot = 0; S.D = 1100; S.Dd = 600;
        if (S.dying) { S.mode = 'over'; endGame(g, false); }
        else { S.mode = ob && ob.typed ? 'run' : 'run'; S.cam.zT = 1; S.flinch = 0; }
      }
    } else if (S.mode === 'celebrate' || S.mode === 'demoEnd') {
      S.celeT += dt; S.pose = S.celeT < 0.6 ? RR.pose.cheer(S.t) : RR.pose.dance(S.t); S.ry = S.roof.y; S.rot = 0;
      S.cam.zT = 1.12;
      if (Math.random() < 0.12 && S.mode === 'celebrate') g.fx.confetti(U.rand(300, 1600), U.rand(100, 350), 14);
      if (S.mode === 'demoEnd' && S.celeT > 2.6) { S.run++; loadRun(g, S.run); S.mode = 'idle'; }
      if (S.mode === 'celebrate' && S.celeT > 2.6) { S.mode = 'summary'; S.summary.t = 0; }
    } else if (S.mode === 'summary') {
      S.summary.t += dt; S.pose = RR.pose.dance(S.t); S.cam.zT = 1.08;
      if (S.summary.t > 1.6 && S.summary.t - dt <= 1.6) { for (let i = 0; i < S.summary.stars; i++) setTimeout(() => RR.sfx('gem2', 0.6, 1 + i * 0.25), i * 300); }
      if (S.summary.t > 9 || (g.demo)) nextRun(g);
    }

    // caught?
    if ((S.mode === 'run' || S.mode === 'wait') && S.D <= DCATCH && S.ghost <= 0 && !g.demo) caught(g);
    S.D = clamp(S.D, 0, DMAX);
    S.Dd += (S.D - S.Dd) * Math.min(1, dt * (S.D > S.Dd ? 1.6 : 6));
    // stealth fills when comfortably ahead
    if (!g.demo && S.D > DMAX * 0.7 && S.ghost <= 0 && (S.mode === 'run' || S.mode === 'move')) { S.stealth = Math.min(1, S.stealth + dt * 0.022); if (S.stealth >= 1) startGhost(g, 7); }
    S.danger += (clamp((900 - S.Dd) / 600, 0, 1) - S.danger) * Math.min(1, dt * 4);

    for (let i = Math.max(0, S.cur - 4); i < S.cur; i++) { const o = S.L.obs[i]; if (o.type === 'crow' && o.crowFlyT != null) o.crowFlyT += dt; }
    // collectibles
    collect(g, dt);
    // bot for the title demo
    if (g.demo) demoBot(g, dt);
    // pursuer chatter
    S.bubble.t += dt;
    cameraUpdate(g, dt);
    if (S.mode === 'run' || S.mode === 'move') { if (S.rx > S.L.length - 3000 && Math.random() < 0.002) { /* ambience */ } }
    // prune far-behind obstacles' typers
  }

  function sneakUpdate(g, ob, q, dt) {
    if (ob.awake && q.u > 0.3 && !ob.alerted) {
      ob.alerted = true; ob.wokeT = 0;
      RR.sfx('wake', 0.9); if (!g.demo) { g.fx.shake(8, 0.2); g.fx.pop(W / 2, 400, 'Oh no! The cat woke up!', { color: '#FF8A5C', size: 52, life: 1.3 }); }
      if (S.ghost <= 0) S.D = Math.max(DCATCH + 60, S.D - 320);
      S.stealth = Math.max(0, S.stealth - 0.25);
      S.flinch = 0.3;
    }
    if (ob.alerted) ob.wokeT += dt;
  }

  function demoBot(g, dt) {
    const ob = activeOb(); if (!ob || ob.lx - S.rx > 1500 || S.mode === 'summary' || S.mode === 'tumble' || S.mode === 'idle') return;
    const ty = typerOf(ob);
    S.botWait -= dt; if (S.botWait > 0) return;
    S.bot.step(dt, ty, (r) => { if (r === 'done') { ob.typed = true; ob.clean = true; S.botWait = 0.35 + Math.random() * 0.6; } });
  }

  function collect(g, dt) {
    const L = S.L, cx = S.rx, cy = S.ry - 72;
    const mag = S.magnet > 0;
    for (const c of L.cols) {
      if (c.taken) continue;
      const dx = c.x - cx; if (dx < -300 || dx > 500) continue;
      if (mag && Math.abs(dx) < 520 && S.mode !== 'tumble') { const dy = c.y - cy; const d = Math.hypot(dx, dy); if (d < 520) { c.x -= dx * Math.min(1, dt * 7); c.y -= dy * Math.min(1, dt * 7); } }
      const d = Math.hypot(c.x - cx, c.y - cy);
      if (d < (c.kind === 'fish' ? 85 : 76)) {
        c.taken = true; const p = toScreen(c.x, c.y);
        if (c.kind === 'gem') { S.runGems++; S.sessGems = (S.sessGems || 0) + 1; if (!g.demo) { save.gems++; g.score.add(100); RR.sfx('gem', 0.5, 0.95 + Math.random() * 0.3); } RR.parts.sparks(c.x, c.y, 5, '#9FE8FF', 260); }
        else if (c.kind === 'fish') { S.runFish++; if (!g.demo) { g.score.add(150); S.stealth = Math.min(1, S.stealth + 0.08); RR.sfx('fish', 0.6); g.fx.pop(p[0], p[1] - 30, 'Yum! +150', { color: '#4FC3F7', size: 40, life: 0.7 }); } RR.parts.sparks(c.x, c.y, 6, '#7FD6FF', 280); }
        else { S.runCookies++; if (!g.demo) { g.score.add(40); S.stealth = Math.min(1, S.stealth + 0.015); RR.sfx('gem', 0.3, 1.5); } RR.parts.sparks(c.x, c.y, 3, '#E8B070', 200); }
      }
    }
    for (const pw of L.powers) {
      if (pw.taken) continue;
      if (Math.abs(pw.x - S.rx) > 120) continue;
      if (Math.hypot(pw.x - cx, pw.y - cy) < 100) {
        pw.taken = true;
        if (pw.kind === 'boost') { S.boost = 4.5; RR.sfx('boost', 0.8); if (!g.demo) g.fx.pop(W / 2, 330, 'SNEAKER BOOST!', { color: '#FFC83D', size: 70, life: 1.3 }); }
        else if (pw.kind === 'smoke') { RR.sfx('smoke', 0.8); if (!g.demo) { g.fx.pop(W / 2, 330, 'SMOKE BOMB!', { color: '#B9A8FF', size: 70, life: 1.3 }); } startGhost(g, 6); }
        else { S.magnet = 8; RR.sfx('power', 0.8); if (!g.demo) g.fx.pop(W / 2, 330, 'MAGNET!', { color: '#FF5A5F', size: 70, life: 1.3 }); }
        RR.parts.sparks(pw.x, pw.y, 12, '#FFFFFF', 520);
        if (!g.demo) g.score.add(100);
      }
    }
  }

  function cameraUpdate(g, dt) {
    const c = S.cam, reduce = TM.settings.reduceMotion;
    const lead = S.boost > 0 ? 80 : (S.mode === 'move' && S.mv && S.mv.type === 'zip' ? 120 : 0);
    const wantX = S.rx - (ANCHOR - lead);
    const roofY = S.roof ? S.roof.y : S.ry;
    const wantY = lerp(roofY, S.ry, 0.45) - S.gsy;
    const kx = S.mode === 'move' ? 9 : 5;
    c.x += (wantX - c.x) * Math.min(1, dt * kx);
    c.y += (wantY - c.y) * Math.min(1, dt * 3.2);
    let zT = S.cam.zT;
    if (S.mode === 'run' && S.boost <= 0) zT = 1 + Math.min(0.045, (g.score.mult - 1) * 0.012) + (S.danger > 0.2 ? 0.02 : 0);
    if (S.boost > 0 && S.mode === 'run') zT = 0.95;
    if (reduce) zT = 1;
    c.z += (zT - c.z) * Math.min(1, dt * 3.5);
    // speed-line intensity
    let spT = 0.12 + (S.vMul - 1) * 1.2 + (g.score.mult - 1) * 0.07;
    if (S.mode === 'move') spT += S.mv && (S.mv.type === 'zip' || S.mv.type === 'finale' || S.mv.type === 'bounce') ? 0.6 : 0.25;
    if (S.mode === 'wait' || S.mode === 'idle' || S.mode === 'summary' || S.mode === 'celebrate' || S.mode === 'tumble') spT = 0;
    if (S.mode === 'move' && S.mv && S.mv.type === 'sneak') spT = 0;
    if (reduce) spT = 0;
    S.speedFx += (spT - S.speedFx) * Math.min(1, dt * 3);
  }

  /* ---------------- drawing ---------------- */
  function chipAnchor(ob) {
    const y0 = ob.roof.y; let wx, wy;
    switch (ob.type) {
      case 'gap': wx = ob.lx + 140; wy = y0 - 250; break;
      case 'slide': wx = ob.pipe.x0 + 120; wy = y0 - 260; break;
      case 'crow': wx = ob.crowX; wy = y0 - 330; break;
      case 'bounce': wx = ob.tramp.x + 130; wy = y0 - 290; break;
      case 'wall': wx = ob.wall.x - 50; wy = y0 - 280; break;
      case 'kick': wx = ob.wall.x - 160; wy = y0 - 300; break;
      case 'zip': wx = ob.zip.xA + 160; wy = Math.min(ob.zip.yA, y0) - 120; break;
      case 'sneak': wx = ob.catX; wy = y0 - 300; break;
      default: wx = ob.lx + 220; wy = y0 - 360;
    }
    const p = toScreen(wx, wy);
    // keep on screen: chips live in the 1920 safe area
    return [p[0], p[1]];
  }

  let vigCv = null, dangerCv = null;
  function vignette() {
    if (vigCv) return vigCv;
    vigCv = document.createElement('canvas'); vigCv.width = 384; vigCv.height = 216; const g = vigCv.getContext('2d');
    const gr = g.createRadialGradient(192, 108, 70, 192, 108, 250); gr.addColorStop(0, 'rgba(10,5,35,0)'); gr.addColorStop(1, 'rgba(10,5,35,0.55)'); g.fillStyle = gr; g.fillRect(0, 0, 384, 216);
    dangerCv = document.createElement('canvas'); dangerCv.width = 384; dangerCv.height = 216; const d = dangerCv.getContext('2d');
    const dg = d.createRadialGradient(192, 108, 60, 192, 108, 230); dg.addColorStop(0, 'rgba(255,60,60,0)'); dg.addColorStop(1, 'rgba(255,70,70,0.75)'); d.fillStyle = dg; d.fillRect(0, 0, 384, 216);
    return vigCv;
  }

  const PROF = {}; const PON = /prof=1/.test(location.search);
  function T(name, fn) { if (!PON) return fn(); const cx = G.ctx; cx.getImageData(0, 0, 1, 1); const t0 = performance.now(); fn(); cx.getImageData(0, 0, 1, 1); const d = performance.now() - t0; PROF[name] = (PROF[name] || 0) * 0.9 + d * 0.1; }
  RR.prof = PROF; RR.T = T;
  function draw(g, ctx) {
    if (!S) return;
    const v = g.vw(), c = S.cam, t = S.t, L = S.L, dist = S.dist;
    // zoom about the raccoon's ground spot
    ZB = 1.32 * (1 + clamp((1.78 - v.w / v.h) * 0.5, 0, 0.3));
    CS = 1 + clamp((1.78 - v.w / v.h) * 0.7, 0, 0.45);
    const px = ANCHOR, py = S.gsy, z = c.z * ZB;
    ctx.save();
    ctx.translate(px, py); ctx.scale(z, z); ctx.translate(-px, -py);
    const cv = { x: px - (px - v.x) / z - 2, y: py - (py - v.y) / z - 2, w: v.w / z + 4, h: v.h / z + 4 };
    T('bg', () => RR.drawBG(ctx, S.bg, c, cv, t, S.skyProg, v));
    ctx.save();
    ctx.translate(-c.x, -c.y);
    const wcv = { x: cv.x + c.x, y: cv.y + c.y, w: cv.w, h: cv.h };
    T('world', () => drawWorld(g, ctx, wcv, t));
    ctx.restore();
    ctx.restore();
    T('overlay', () => drawOverlays(g, ctx, v));
    T('chips', () => drawChips(g, ctx));
    T('hud', () => drawHUD(g, ctx, v));
    drawBanners(g, ctx, v);
    g.fx.draw(ctx);
  }

  function drawWorld(g, ctx, wcv, t) {
    const L = S.L, dist = S.dist;
    // roofs
    T('roofs', () => { for (const r of L.roofs) RR.drawRoof(ctx, r, dist, wcv, t); });
    T('gapshade', () => RR.gapShade(ctx, L, wcv));
    T('deco', () => { for (const r of L.roofs) { RR.drawRoofDeco(ctx, r, dist, wcv, t); if (r.treasure && r.x < wcv.x + wcv.w) RR.drawTreasure(ctx, r.x, r.y, r.w, dist.treasure, t); } });
    // obstacle scenery (behind Rascal)
    for (const ob of L.obs) {
      const x0 = ob.lx - 200, x1 = ob.ex + 400; if (x1 < wcv.x || x0 > wcv.x + wcv.w) continue;
      drawObBack(g, ctx, ob, t);
    }
    // collectibles
    for (const c of L.cols) {
      if (c.taken || c.x < wcv.x - 80 || c.x > wcv.x + wcv.w + 80) continue;
      if (c.kind === 'gem') RR.drawGem(ctx, c.x, c.y, 1, t, c.k); else if (c.kind === 'fish') RR.drawFish(ctx, c.x, c.y, 1.15, t); else RR.drawCookie(ctx, c.x, c.y, 0.9, t);
    }
    for (const pw of L.powers) if (!pw.taken && pw.x > wcv.x - 100 && pw.x < wcv.x + wcv.w + 100) RR.drawPower(ctx, pw.x, pw.y, pw.kind, t);
    // pursuers
    drawPursuers(g, ctx, t);
    // Rascal
    drawRascal(g, ctx, t);
    // front scenery
    for (const ob of L.obs) { const x0 = ob.lx - 200, x1 = ob.ex + 400; if (x1 < wcv.x || x0 > wcv.x + wcv.w) continue; drawObFront(g, ctx, ob, t); }
    RR.parts.draw(ctx);
  }

  function drawObBack(g, ctx, ob, t) {
    const y0 = ob.roof.y, tt = t;
    if (ob.type === 'bounce') {
      const press = S.mv === ob && S.pressT > 0 ? 1 : 0;
      RR.drawBlocker(ctx, ob.blocker.x, y0, ob.blocker.h, tt);
      RR.drawTramp(ctx, ob.tramp.x, y0, ob.tramp.kind, press, tt);
    } else if (ob.type === 'crow') {
      let x = ob.crowX, y = y0 - 34, flap = false, rot = 0;
      if (ob.crowFlyT != null) { const k = ob.crowFlyT; x += k * 330; y -= k * 420 - k * k * 60; flap = true; rot = -0.3; if (k > 2.5) return; }
      RR.crow(ctx, x, y, 1.25, { t: tt + ob.idx, flap, rot, dir: 1 });
      if (!flap) { ctx.save(); ctx.translate(x + 10, y - 60); D.text(ctx, 'caw!', 0, Math.sin(tt * 4 + ob.idx) * 3, { size: 24, color: '#fff', outline: 6 }); ctx.restore(); }
    } else if (ob.type === 'wall') {
      // drain pipe + ledge shadow on the wall
    } else if (ob.type === 'kick') {
      RR.drawBillboard(ctx, ob.billboard.x, y0, ob.billboard.h, tt, ob.billboard.text, ['#FF8A3D', '#7B5CFF', '#2BB673', '#FF3EA5'][ob.idx % 4]);
    } else if (ob.type === 'zip') {
      RR.drawZipPole(ctx, ob.zip.xA, ob.roof.y, ob.roof.y - ob.zip.yA + 0);
      RR.drawZipPole(ctx, ob.zip.xB, ob.roofTo.y, ob.roofTo.y - ob.zip.yB);
      RR.drawZipLine(ctx, ob.zip.xA, ob.zip.yA, ob.zip.xB, ob.zip.yB, ob.zip.sag, tt, ob.idx);
    } else if (ob.type === 'sneak') {
      const awake = ob.alerted || (ob.awake && S.mv === ob && S.mvK > 0.3);
      const cx = ob.catX;
      // flashlight beam
      if (awake) RR.drawBeam(ctx, cx - 10, y0 - 70, Math.PI - 0.15, 560, 0.9);
      RR.cat(ctx, cx, y0, 1.15, { t: tt, awake: awake ? 1 : 0, dir: -1 });
      if (!awake) for (let i = 0; i < 3; i++) { const k = ((tt * 0.35 + i / 3) % 1); ctx.save(); ctx.globalAlpha = 1 - k; D.text(ctx, 'z', cx - 20 + k * 40, y0 - 210 - k * 70, { size: 30 + i * 8, color: '#fff', outline: 7 }); ctx.restore(); }
    } else if (ob.type === 'gap') {
      // a little warning lamp on the edge
      const ex = ob.edge; ctx.fillStyle = INK(); ctx.fillRect(ex - 8, ob.roof.y - 56, 6, 56);
      ctx.fillStyle = Math.sin(tt * 6) > 0 ? '#FF5A5F' : '#FFC83D'; ctx.beginPath(); ctx.arc(ex - 5, ob.roof.y - 60, 8, 0, TAU); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK(); ctx.stroke();
    }
  }
  const INK = () => C.ink;
  function drawObFront(g, ctx, ob, t) {
    if (ob.type === 'slide') RR.drawPipe(ctx, ob.pipe.x0, ob.pipe.x1, ob.pipe.y, t, { line: ob.pipe.line, seed: ob.idx });
  }

  function drawRascal(g, ctx, t) {
    const pose = S.pose || RR.pose.idle(t);
    const ghost = S.ghost > 0;
    let alpha = ghost ? 0.5 + Math.sin(t * 9) * 0.12 : 1;
    if (S.mode === 'tumble' && Math.floor(S.tumbleT * 12) % 2) alpha = 0.7;
    const sx = S.rx, sy = S.ry;
    // soft shadow
    if (S.mode !== 'move' || (S.mv && S.mv.type !== 'zip')) { const gy = S.roof ? S.roof.y : sy; const hgt = clamp((gy - sy) / 500, 0, 1); ctx.fillStyle = `rgba(20,10,50,${0.28 * (1 - hgt * 0.7)})`; ctx.beginPath(); ctx.ellipse(sx, gy + 2, 52 * (1 - hgt * 0.4), 8, 0, 0, TAU); ctx.fill(); }
    if (S.boost > 0) RR.glow(ctx, 'p_light_01', '#FFC83D', sx - 20, sy - 70, 360, 0.5);
    if (ghost) RR.glow(ctx, 'p_light_01', '#9C86FF', sx, sy - 70, 340, 0.5);
    const scale = 1.12;
    RR.raccoon(ctx, sx, sy, scale, { pose, t, rot: S.rot, flip: S.face < 0, squash: S.squash * 0.5, hat: S.hat, scarf: '#FF5A5F', alpha });
    if (S.mode === 'wait') { ctx.save(); const k = Math.sin(S.t * 14); ctx.translate(sx + 40, sy - 205); ctx.scale(1 + k * 0.08, 1 + k * 0.08); D.text(ctx, '!', 0, 0, { size: 64, color: '#FF5A5F', outline: 11 }); ctx.restore(); }
    // sweat drop
    if (S.mode === 'wait' && S.stallT > 0.8) { ctx.fillStyle = '#8ED6FF'; ctx.beginPath(); ctx.ellipse(sx - 6, sy - 175 + (S.t * 60 % 20), 6, 9, 0, 0, TAU); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK(); ctx.stroke(); }
  }

  const SAYS = ['Stop!', 'Halt!', 'Hey!', 'Coo!', 'Come back!', 'Thief!'];
  function drawPursuers(g, ctx, t) {
    const d = S.dist.pig;
    if (S.Dd > 1250 && !g.demo) return;
    if (g.demo && S.Dd > 1300) return;
    const lead = S.rx - S.Dd;
    const ground = S.roof ? S.roof.y : S.ry;
    const ref = Math.min(S.ry, ground) - 175;
    const lost = S.ghost > 0 || S.hushed && S.Dd > 1000;
    for (let i = 2; i >= 0; i--) {
      const px = lead - i * 105 - (i === 2 ? 20 : 0), wob = Math.sin(t * 2.3 + i * 2) * 26;
      const py = ref + i * 34 + wob - (i === 1 ? 24 : 0) - clamp((ground - S.ry), 0, 400) * 0.0;
      // beam toward Rascal
      if (S.Dd < 1000 && !lost) { const ang = Math.atan2((S.ry - 70) - (py + 12), S.rx - (px + 40)); RR.drawBeam(ctx, px + 44, py + 16, ang, Math.min(900, S.Dd + 140), 0.55); }
      else if (!lost) RR.drawBeam(ctx, px + 44, py + 16, 0.5 + Math.sin(t + i) * 0.3, 520, 0.4);
      else RR.drawBeam(ctx, px + 44, py + 16, 0.9 + Math.sin(t * 1.3 + i) * 0.6, 520, 0.35);
      RR.pigeon(ctx, px, py, 1.0 - i * 0.06, { t, ph: i * 1.7, body: d.body, wing: d.wing, cap: d.cap, sheen: d.sheen, beak: d.beak, mood: lost ? 'oops' : 'grumpy', capTilt: i === 1 ? 0.5 : 0.12, flapSpeed: 15 + i });
      if (lost && i === 0) { D.text(ctx, '?', px + 20, py - 80 + Math.sin(t * 5) * 4, { size: 54, color: '#fff', outline: 9 }); }
    }
    // speech bubble from the leader
    if (S.Dd < 650 && !lost && S.mode !== 'tumble') {
      const k = (S.bubble.t % 2.4) / 2.4; if (k < 0.75) { const str = SAYS[Math.floor(S.bubble.t / 2.4) % SAYS.length]; ctx.save(); ctx.translate(lead + 30, ref - 82); const w = 24 + str.length * 20; D.pill(ctx, -w / 2, -26, w, 52, '#fff', { stroke: C.ink, lw: 5 }); D.text(ctx, str, 0, 2, { size: 30, color: C.ink }); ctx.restore(); }
    }
  }

  function drawOverlays(g, ctx, v) {
    // speed lines
    if (S.speedFx > 0.06 && !TM.settings.reduceMotion) {
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#FFFFFF';
      const k = S.speedFx, dt = 1 / 60;
      for (const l of S.lines) {
        l.x -= l.sp * (0.4 + k) * dt; if (l.x < v.x - l.l) { l.x = v.x + v.w + Math.random() * 400; l.y = v.y + Math.random() * v.h; }
        if (l.y < v.y || l.y > v.y + v.h) l.y = v.y + Math.random() * v.h;
        ctx.globalAlpha = Math.min(0.32, l.a * k * 0.7); ctx.lineWidth = 2 + k * 2; ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x + l.l * (0.5 + k), l.y); ctx.stroke();
      }
      ctx.restore();
    }
    // vignette (+ danger)
    if (!window.__novig) edgeBands(ctx, v, '10,5,35', 0.4);
    if (S.danger > 0.02) edgeBands(ctx, v, '255,60,60', S.danger * (0.5 + Math.sin(S.t * 9) * 0.18));
    if (S.ghost > 0) { ctx.save(); ctx.fillStyle = 'rgba(120,90,220,0.14)'; ctx.fillRect(v.x - 12, v.y - 12, v.w + 24, v.h + 24); ctx.restore(); }
  }

  /* soft edge vignette: four small gradient bands (much cheaper than a full-screen radial) */
  function edgeBands(ctx, v, rgb, a) {
    ctx.save();
    const bw = v.w * 0.17, bh = v.h * 0.2;
    const stops = [[0, a], [0.25, a * 0.56], [0.5, a * 0.25], [0.75, a * 0.06], [1, 0]].map((p) => [p[0], `rgba(${rgb},${p[1].toFixed(3)})`]);
    const mk = (gr) => { for (const p of stops) gr.addColorStop(p[0], p[1]); return gr; };
    let gr = ctx.createLinearGradient(v.x, 0, v.x + bw, 0); ctx.fillStyle = mk(gr); ctx.fillRect(v.x - 12, v.y - 12, bw + 12, v.h + 24);
    gr = ctx.createLinearGradient(v.x + v.w, 0, v.x + v.w - bw, 0); ctx.fillStyle = mk(gr); ctx.fillRect(v.x + v.w - bw, v.y - 12, bw + 12, v.h + 24);
    gr = ctx.createLinearGradient(0, v.y, 0, v.y + bh); ctx.fillStyle = mk(gr); ctx.fillRect(v.x - 12, v.y - 12, v.w + 24, bh + 12);
    gr = ctx.createLinearGradient(0, v.y + v.h, 0, v.y + v.h - bh); ctx.fillStyle = mk(gr); ctx.fillRect(v.x - 12, v.y + v.h - bh, v.w + 24, bh + 12);
    ctx.restore();
  }
  function chipFor(g, ctx, ob, size, o) {
    const ty = typerOf(ob);
    let sz = size;
    while (D.chipSize(ctx, ty, sz).w > 1560 && sz > 28) sz -= 3;
    return sz;
  }
  function drawChips(g, ctx) {
    if (g.demo) return;
    if (S.mode === 'summary' || S.mode === 'celebrate' || S.mode === 'demoEnd') return;
    if (g.state === 'countdown') { /* show the first word early so kids can read it */ }
    let shown = 0; const readyPills = [];
    for (let i = S.cur; i < S.L.obs.length && shown < 3; i++) {
      const ob = S.L.obs[i]; if (ob.done) continue;
      if (ob.lx - S.rx > 2500) break;
      const act = ob === activeOb();
      const ty = typerOf(ob);
      const p = chipAnchor(ob);
      const label = RR.TYPE_LABEL[ob.type] || '';
      const col = typeColor[ob.type] || C.rascal;
      let x = p[0], y = p[1];
      if (ob.typed) {
        // ready tag
        if (!ob.done && S.mv !== ob) { readyPills.push([clamp(x + 200, 140, 1780), clamp(y - 130, 200, 560)]); }
        shown++; continue;
      }
      const base = (act ? (ob.type === 'finale' ? 58 : 52) : 36) * CS;
      const sz = chipFor(g, ctx, ob, base);
      const size = D.chipSize(ctx, ty, sz);
      const rightLimit = 1560 - size.w / 2;
      let off = false;
      if (x > rightLimit) { x = rightLimit; off = true; }
      x = Math.max(x, size.w / 2 + 40);
      y = clamp(y, 270, 640);
      if (!act) { y -= 0; }
      ctx.save();
      const pulse = S.mode === 'wait' && act ? 1 + Math.sin(S.t * 12) * 0.04 : 1;
      ctx.translate(x, y); ctx.scale(pulse, pulse); ctx.translate(-x, -y);
      // tag
      const tag = label;
      ctx.font = D.FONT_DISPLAY(26, 800); const tw = ctx.measureText(tag).width + 34;
      D.pill(ctx, x - tw / 2, y - size.h / 2 - 44, tw, 38, col, { stroke: C.ink, lw: 4 });
      D.text(ctx, tag, x, y - size.h / 2 - 24, { size: 26, color: C.ink, font: D.FONT_DISPLAY(26, 800) });
      D.chip(ctx, x, y, ty, { size: sz, accent: act ? C.rascal : '#8C86A6', locked: act && ty.pos > 0, hint: g.hint && act, dim: !act, alpha: act ? 1 : 0.88 });
      if (act && S.mode === 'wait') { ctx.strokeStyle = 'rgba(255,90,95,0.9)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - size.w / 2 - 10, y - size.h / 2 - 10, size.w + 20, size.h + 20, size.h / 2 + 10) : ctx.rect(x - size.w / 2 - 10, y - size.h / 2 - 10, size.w + 20, size.h + 20); ctx.stroke(); }
      if (off) { ctx.fillStyle = col; ctx.beginPath(); const ax = x + size.w / 2 + 30; ctx.moveTo(ax - 12, y - 16); ctx.lineTo(ax + 14, y); ctx.lineTo(ax - 12, y + 16); ctx.closePath(); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke(); }
      ctx.restore();
      shown++;
    }
    for (const [x, y] of readyPills) { ctx.save(); const k = 1 + Math.sin(S.t * 8) * 0.04; ctx.translate(x, y); ctx.scale(k * 0.8, k * 0.8); D.pill(ctx, -112, -34, 224, 68, C.good, { stroke: C.ink, lw: 5 }); D.text(ctx, 'READY!', 0, 3, { size: 38, color: '#fff', outline: 7 }); ctx.restore(); }
  }

  function drawHUD(g, ctx, v) {
    if (g.demo) return;
    // collectible counters (top-left, below the score pill)
    const items = [['gem', S.runGems, '#9FE8FF'], ['fish', S.runFish, '#7FD6FF'], ['cookie', S.runCookies, '#E8B070']];
    let x = 26;
    ctx.save();
    for (const [k, n, col] of items) {
      D.pill(ctx, x, 104, 112, 46, 'rgba(31,26,61,0.82)');
      if (k === 'gem') RR.drawGem(ctx, x + 26, 127, 0.5, 0, 0); else if (k === 'fish') RR.drawFish(ctx, x + 26, 127, 0.62, 0); else RR.drawCookie(ctx, x + 26, 127, 0.6, 0);
      D.text(ctx, String(n), x + 78, 129, { size: 30, color: '#fff', font: D.FONT_DISPLAY(30, 800) });
      x += 124;
    }
    ctx.restore();
    // stealth meter (bottom-left)
    const bx = 30, by = 996, bw = 420;
    ctx.save();
    D.pill(ctx, bx, by, bw + 90, 56, 'rgba(31,26,61,0.85)');
    // eye icon
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(bx + 32, by + 28, 18, 11, 0, 0, TAU); ctx.fill(); ctx.fillStyle = S.ghost > 0 ? '#9C86FF' : C.ink; ctx.beginPath(); ctx.arc(bx + 32, by + 28, 7, 0, TAU); ctx.fill();
    if (S.ghost > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx + 14, by + 44); ctx.lineTo(bx + 52, by + 12); ctx.stroke(); }
    const fx = bx + 70, fw = bw - 10, fillK = S.ghost > 0 ? S.ghost / 7 : S.stealth;
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill(P.rr(fx, by + 14, fw, 28, 14));
    const grd = ctx.createLinearGradient(fx, 0, fx + fw, 0); grd.addColorStop(0, '#6FE4F4'); grd.addColorStop(1, S.ghost > 0 ? '#C8B8FF' : '#B98CFF');
    ctx.fillStyle = grd; if (fillK > 0.01) ctx.fill(P.rr(fx, by + 14, Math.max(28, fw * fillK), 28, 14));
    ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke(P.rr(fx, by + 14, fw, 28, 14));
    D.text(ctx, S.ghost > 0 ? 'GHOST RUN!' : 'STEALTH', fx + fw / 2, by + 29, { size: 22, color: '#fff', outline: 5, font: D.FONT_DISPLAY(22, 800) });
    ctx.restore();
    // power-up timers
    let px = 30 + bw + 120;
    for (const [k, tm, mx] of [['boost', S.boost, 4.5], ['magnet', S.magnet, 8]]) {
      if (tm > 0) { RR.powerIcon(ctx, px + 28, by + 28, k, 0.58); ctx.fillStyle = 'rgba(31,26,61,0.85)'; ctx.fill(P.rr(px + 60, by + 20, 90, 16, 8)); ctx.fillStyle = k === 'boost' ? '#FFC83D' : '#FF5A5F'; ctx.fill(P.rr(px + 60, by + 20, Math.max(10, 90 * tm / mx), 16, 8)); px += 170; }
    }
    // chase pigeon icon on the left when they are close
    if (S.Dd < 1000 && S.ghost <= 0) {
      const k = clamp((1000 - S.Dd) / 800, 0, 1);
      const sxp = toScreen(S.rx - S.Dd, S.ry)[0];
      if (sxp < 160) { ctx.save(); const sc = 0.55 + k * 0.5; ctx.translate(70, 560); ctx.scale(sc, sc); ctx.globalAlpha = 0.6 + k * 0.4; ctx.rotate(Math.sin(S.t * 10) * 0.05); RR.pigeon(ctx, 0, 0, 1, { t: S.t, body: S.dist.pig.body, wing: S.dist.pig.wing, cap: S.dist.pig.cap, mood: 'grumpy', torch: false }); D.text(ctx, '!', 70, -80, { size: 80, color: '#FF5A5F', outline: 12 }); ctx.restore(); }
    }
  }

  function drawBanners(g, ctx, v) {
    if (S.banner.t < 3.2 && S.mode !== 'summary' && !g.demo) {
      const k = S.banner.t, a = k < 0.4 ? sm(k / 0.4) : k > 2.6 ? 1 - (k - 2.6) / 0.6 : 1, dist = S.dist;
      ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(W / 2, 250 + (1 - sm(clamp(k / 0.5, 0, 1))) * -60);
      D.text(ctx, 'RUN ' + S.run + (S.run > 5 ? '  ∞' : ''), 0, 0, { size: 118, color: C.rascal, outline: 20 });
      D.text(ctx, dist.name.toUpperCase(), 0, 96, { size: 56, color: '#fff', outline: 12 });
      D.text(ctx, dist.time + ' · ' + dist.blurb, 0, 152, { size: 32, color: '#FFE9A8', outline: 8, font: D.FONT_WORD(30, 700) });
      ctx.restore();
    }
    if (S.mode === 'summary' && S.summary) drawSummary(g, ctx);
  }

  function drawSummary(g, ctx) {
    const s = S.summary, k = clamp(s.t / 0.5, 0, 1), dist = S.dist;
    ctx.save(); ctx.fillStyle = `rgba(20,10,50,${0.55 * k})`; ctx.fillRect(-400, -400, W + 800, H + 800);
    ctx.translate(W / 2, H / 2 + (1 - sm(k)) * 80); ctx.globalAlpha = k;
    const pw = 860, ph = 620;
    D.sticker(ctx, P.rr(-pw / 2, -ph / 2, pw, ph, 44), '#FFF8EC', { x: -pw / 2, y: -ph / 2, w: pw, h: ph }, { lw: 7 });
    D.text(ctx, `RUN ${S.run} COMPLETE!`, 0, -ph / 2 + 72, { size: 76, color: C.rascal, outline: 12 });
    D.text(ctx, dist.name, 0, -ph / 2 + 138, { size: 40, color: C.ink });
    // stars
    for (let i = 0; i < 3; i++) {
      const on = i < s.stars, st = clamp((s.t - 0.7 - i * 0.3) / 0.4, 0, 1), sc = on ? U.ease.outBack(st) : (s.t > 0.7 ? 1 : 0);
      ctx.save(); ctx.translate((i - 1) * 150, -ph / 2 + 250 - (i === 1 ? 20 : 0)); ctx.scale(sc * 1.25, sc * 1.25); ctx.rotate((i - 1) * 0.15);
      const sp = P.star(0, 0, 62, 0.5); ctx.fillStyle = on ? C.gold : '#DAD4E8'; ctx.fill(sp); ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.strokeStyle = C.ink; ctx.stroke(sp);
      ctx.restore();
    }
    const rows = [['Gems', S.runGems + '  (+' + s.bonusGems + ' bonus)'], ['Fish', S.runFish], ['Cookies', S.runCookies], ['Times caught', S.catches], ['Accuracy', Math.round(s.acc * 100) + '%']];
    rows.forEach((r, i) => { const yy = -ph / 2 + 350 + i * 44; D.text(ctx, r[0], -300, yy, { size: 30, color: '#6A6590', align: 'left', font: D.FONT_WORD(30, 700) }); D.text(ctx, String(r[1]), 300, yy, { size: 32, color: C.ink, align: 'right', font: D.FONT_DISPLAY(32, 800) }); });
    if (S.newHats.length) { D.pill(ctx, -300, ph / 2 - 120, 600, 52, C.rascal, { stroke: C.ink, lw: 5 }); D.text(ctx, 'New hat unlocked: ' + S.newHats[0].name + '!', 0, ph / 2 - 94, { size: 30, color: '#fff', outline: 6 }); }
    const nxt = S.run >= 5 && !S.endless ? 'Finish' : 'Next: ' + RR.DISTRICTS[S.run % 5].name;
    if (s.t > 1.2) { const pulse = 1 + Math.sin(s.t * 6) * 0.03; ctx.save(); ctx.translate(0, ph / 2 - 40); ctx.scale(pulse, pulse); D.text(ctx, nxt + '  ·  press Enter', 0, 0, { size: 32, color: C.ink, font: D.FONT_DISPLAY(32, 800) }); ctx.restore(); }
    ctx.restore();
  }

  /* ---------------- title extras: start-run picker + wardrobe ---------------- */
  function initTitleUI(g) {
    const el = TM.ui.el;
    const css = document.createElement('style');
    css.textContent = `
      .rr-panel{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:12;display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:96vw;font:700 20px var(--word);color:#fff}
      .rr-panel.hidden{display:none}
      .rr-runs{display:flex;gap:8px;align-items:center;background:rgba(31,26,61,.78);border:4px solid var(--ink);border-radius:999px;padding:8px 14px}
      .rr-runs b{font:800 18px var(--display);margin-right:4px;opacity:.85}
      .rr-run{width:50px;height:50px;border-radius:50%;border:4px solid var(--ink);background:#fff;color:var(--ink);font:800 24px var(--display);cursor:pointer;position:relative;display:flex;align-items:center;justify-content:center;padding:0}
      .rr-run.on{background:var(--accent);color:#fff;box-shadow:0 0 0 4px #fff}
      .rr-run.lock{background:#6A6590;color:#B9B4D4;cursor:not-allowed}
      .rr-run small{position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);font-size:13px;color:#FFC83D;white-space:nowrap;text-shadow:0 2px 0 var(--ink);letter-spacing:-1px}
      .rr-gems{background:rgba(31,26,61,.78);border:4px solid var(--ink);border-radius:999px;padding:8px 18px;display:flex;gap:8px;align-items:center;font:800 24px var(--display)}
      .rr-hats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:6px}
      .rr-hat{background:#fff;border:5px solid var(--ink);border-radius:22px;padding:8px 6px 10px;text-align:center;cursor:pointer;color:var(--ink);font:700 16px var(--word);position:relative}
      .rr-hat canvas{width:100%;height:auto;display:block}
      .rr-hat.on{background:#D9FBFD;box-shadow:0 0 0 5px var(--accent)}
      .rr-hat.lock{background:#E4E0F0;cursor:default}
      .rr-hat.lock canvas{filter:grayscale(1) brightness(.75);opacity:.7}
      .rr-hat span{display:block;font:800 18px var(--display)}
      .rr-hat small{display:block;color:#6A6590}
      @media (max-width:700px){.rr-hats{grid-template-columns:repeat(2,1fr)}}`;
    document.head.append(css);
    const panel = el('div', { class: 'rr-panel hidden' });
    const runsBox = el('div', { class: 'rr-runs' }, el('b', {}, 'START AT RUN'));
    const gemsBox = el('div', { class: 'rr-gems' });
    const wardBtn = el('button', { class: 'tm-btn', onclick: () => wardrobe() }, 'Wardrobe');
    function refresh() {
      runsBox.querySelectorAll('.rr-run').forEach((b) => b.remove());
      const maxRun = Math.min(save.best + 1, 5) + (save.best >= 5 ? 1 : 0);
      for (let r = 1; r <= 6; r++) {
        const locked = r > maxRun;
        const st = r <= 5 ? (save.stars[r] || 0) : 0;
        const b = el('button', { class: 'rr-run' + (pendingRun === r ? ' on' : '') + (locked ? ' lock' : ''), title: r === 6 ? 'Endless' : RR.DISTRICTS[r - 1].name, onclick: () => { if (locked) { TM.sfx.miss(); return; } pendingRun = r; TM.sfx.click(); refresh(); if (G && G.demo) { /* keep demo running */ } } }, r === 6 ? '∞' : String(r), st ? el('small', {}, '★'.repeat(st)) : null);
        runsBox.append(b);
      }
      gemsBox.innerHTML = ''; const cv = el('canvas', { width: 40, height: 40, style: { width: '32px', height: '32px' } }); gemsBox.append(cv, el('span', {}, String(save.gems)));
      const cx = cv.getContext('2d'); if (RR.A.ready) RR.drawGem(cx, 20, 20, 0.55, 0, 0); else setTimeout(() => { RR.A.ready && RR.drawGem(cx, 20, 20, 0.55, 0, 0); }, 800);
    }
    panel.append(runsBox, gemsBox, wardBtn);
    document.body.append(panel);
    function wardrobe() {
      const grid = el('div', { class: 'rr-hats' });
      const card = el('div', { class: 'tm-card tm-modal' },
        el('header', {}, el('h2', {}, 'Rascal\'s Wardrobe'), el('button', { class: 'tm-btn icon', onclick: () => m.close() }, '✕')),
        el('div', { style: { font: '700 18px var(--word)', margin: '0 0 10px', opacity: 0.8 } }, `Collect gems while you run to unlock hats!  You have ${save.gems} gems.`), grid,
        el('footer', {}, el('span'), el('button', { class: 'tm-btn primary', style: { fontSize: '28px', padding: '12px 30px 8px' }, onclick: () => m.close() }, 'Done')));
      const m = TM.ui.modal(card, { onClose: refresh });
      function fill() {
        grid.innerHTML = '';
        for (const h of RR.HATS) {
          const open = hatUnlocked(h), on = save.hat === h.id;
          const cv = el('canvas', { width: 220, height: 220 });
          const cx = cv.getContext('2d'); cx.fillStyle = '#EFEAFB'; cx.fillRect(0, 0, 220, 220);
          RR.raccoon(cx, 100, 205, 1.05, { pose: RR.pose.idle(1), t: 1, hat: h.id, scarf: '#FF5A5F' });
          const b = el('div', { class: 'rr-hat' + (on ? ' on' : '') + (open ? '' : ' lock'), onclick: () => { if (!open) { TM.sfx.miss(); return; } save.hat = h.id; persist(); if (S) S.hat = h.id; TM.sfx.word(); fill(); } }, cv, el('span', {}, h.name), el('small', {}, open ? (on ? 'Wearing!' : 'Tap to wear') : `Locked - ${h.cost} gems`));
          grid.append(b);
        }
      }
      fill();
    }
    refresh();
    return { panel, refresh };
  }

  /* ---------------- boot ---------------- */
  RR.debug = () => S;
  RR.dbg = {
    skipTo(x) { S.rx = x; S.cam.x = x - ANCHOR; },
    freeze(i, k) {
      const ob = S.L.obs[i]; for (let j = 0; j < i; j++) { S.L.obs[j].done = true; S.L.obs[j].typed = true; }
      S.cur = i; S.roof = ob.roof; ob.typed = true; S.mode = 'move'; S.mv = ob; S.mvK = k; S.musicOn = true;
      const q = RR.evalMove(ob.mv, k, k * 20, S.t); S.rx = q.x; S.ry = q.y; S.rot = q.rot; S.face = q.face; S.pose = q.pose; S.mvQ = q; S.lastSeg = q.seg;
      S.cam.x = q.x - ANCHOR; S.cam.y = lerp(S.roof.y, q.y, 0.45) - S.gsy; S.cam.z = ob.camZ; S.cam.zT = ob.camZ; S.speedFx = 0.3;
      if (ob.type === 'sneak') { ob.awake = false; }
      G.state = 'paused';
    },
    at(i) { const ob = S.L.obs[i]; for (let j = 0; j < i; j++) { S.L.obs[j].done = true; S.L.obs[j].typed = true; } S.cur = i; S.roof = ob.roof; S.rx = ob.lx - 300; S.ry = S.roof.y; S.mode = 'run'; S.cam.x = S.rx - ANCHOR; S.cam.y = S.ry - S.gsy; G.state = 'paused'; },
    types() { return S.L.obs.map((o) => o.type); },
  };
  let titleUI = null;
  const lifeSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="54" r="38" fill="#8E95B0" stroke="#1F1A3D" stroke-width="8"/><path d="M18 20L26 48L44 30z" fill="#8E95B0" stroke="#1F1A3D" stroke-width="7" stroke-linejoin="round"/><path d="M82 20L74 48L56 30z" fill="#8E95B0" stroke="#1F1A3D" stroke-width="7" stroke-linejoin="round"/><path d="M14 50Q50 36 86 50Q86 70 66 66Q50 58 34 66Q14 70 14 50z" fill="#454866"/><ellipse cx="36" cy="52" rx="8" ry="9" fill="#fff"/><ellipse cx="64" cy="52" rx="8" ry="9" fill="#fff"/><circle cx="38" cy="54" r="4.5" fill="#1F1A3D"/><circle cx="62" cy="54" r="4.5" fill="#1F1A3D"/><ellipse cx="50" cy="74" rx="12" ry="9" fill="#F2F0F8" stroke="#1F1A3D" stroke-width="5"/><ellipse cx="50" cy="71" rx="5" ry="4" fill="#1F1A3D"/></svg>';

  TM.game({
    id: 'rooftop-rascal', name: 'Rooftop Rascal', accent: C.rascal, bg: '#1A1650', dark: true,
    logoHTML: 'Rooftop<br>Rascal', tagline: 'Dash across the rooftops. Type to leap, slide and zip!',
    lifeIcon: lifeSVG,
    howto: [
      'Rascal the raccoon is raiding the rooftop pantry! Cheeky pigeon guards are on the case.',
      'Rascal runs by himself. <b>Type the word</b> over each obstacle and he jumps, slides, climbs, wall-kicks, bounces or ziplines past it.',
      'You can type <b>ahead</b>! Finish the next word early and Rascal never has to stop.',
      'If Rascal stalls or you mistype, the <b>pigeon squad</b> gets closer. Three catches and the run is over.',
      'Grab <b>gems, fish and cookies</b>. Power-ups: sneaker boost, smoke bomb (ghost run!) and magnet.',
      'A <b>stealth meter</b> fills as you stay ahead. Full stealth = Ghost Run: the pigeons lose you!',
      'Sneak past sleeping cats <b>without a single typo</b>. Each run ends with a long sentence for the giant leap!',
      'Gems unlock hats in the Wardrobe. Clear all 5 districts to unlock the Endless run.',
    ],
    music: RR.SONGS[0], reset, update, draw, onKey, onBack, onEnter,
    init: (g) => { titleUI = initTitleUI(g); setInterval(() => { if (titleUI) { const on = g.state === 'title' && !TM.ui.isModalOpen(); titleUI.panel.classList.toggle('hidden', !on); } }, 120); },
    nextKey: () => { if (!S) return null; const ob = activeOb(); return ob ? typerOf(ob).nextReq() : null; },
    hud: (g) => ({ lives: S ? S.lives : 3, maxLives: S ? S.maxLives : 3, right: S ? (S.run > 5 ? 'Run ' + S.run + ' ∞' : 'Run ' + S.run + ' / 5') : '', progress: S && S.L ? clamp(S.rx / S.L.length, 0, 1) : 0 }),
  });
})();
