/* Ink Rush - an on-rails ink-slinging typing shooter (inspired by The Typing of the Dead), re-skinned Splatoon-style:
   nobody gets hurt. Grumpy grey Gloops rush at you; type their word to splat them with ink and they turn into happy critters
   while the world gets painted in your team colours. 4 stages + bosses, a special "Ultra" paint wave and a Turf War result. */
(function () {
  'use strict';
  const TM = window.TM, C = TM.C, U = TM.U, D = TM.draw, P = D.P;
  const INK = window.INK;
  const W = 1920, H = 1080, VX = 960;
  const F = INK.F, CAMH = INK.CAMH, V = INK.view;
  const Z_FAR = 36, Z_ATK = 2.7;
  const GOO = '#7D6FA6', GOO2 = '#9A8CC4';
  const NSTAGE = INK.STAGES.length;

  /* ---------------- music: one tune per stage + boss ---------------- */
  const SONGS = [
    TM.audio.song({ bpm: 132, roots: [38, 38, 43, 45], chords: [[62, 66, 69], [62, 66, 69], [67, 71, 74], [69, 73, 76]], bassPattern: [0, null, 12, 0, null, 12, 0, null, 0, 12, null, 0, 10, null, 12, null], lead: [74, 74, null, 78, null, 81, null, 78, 79, null, 78, null, 74, null, null, null, 76, 76, null, 79, null, 83, null, 81, 78, null, 76, null, 74, null, null, null], wave: 'square' }),
    TM.audio.song({ bpm: 120, roots: [40, 45, 43, 47], chords: [[64, 68, 71], [69, 73, 76], [67, 71, 74], [71, 75, 78]], bassPattern: [0, null, 7, null, 12, null, 7, null, 0, null, 7, null, 12, 10, 7, null], lead: [76, null, 80, null, 83, null, 80, 76, 78, null, 81, null, 85, null, 81, null, 83, null, 80, null, 76, null, 80, 83, 85, null, 83, null, 80, null, null, null], wave: 'triangle', pad: 'sine' }),
    TM.audio.song({ bpm: 146, roots: [41, 41, 46, 44], chords: [[65, 69, 72], [65, 69, 72], [70, 74, 77], [68, 72, 75]], bassPattern: [0, 0, null, 12, 0, null, 12, null, 0, 0, null, 12, 10, null, 12, null], lead: [77, null, 77, 81, null, 84, null, 81, 79, null, 79, 82, null, 86, null, 82, 77, null, 81, null, 84, 86, null, 84, 82, null, 79, null, 77, null, null, null], wave: 'square' }),
    TM.audio.song({ bpm: 126, roots: [43, 48, 46, 41], chords: [[67, 70, 74], [72, 75, 79], [70, 74, 77], [65, 68, 72]], bassPattern: [0, null, 12, null, 7, null, 12, null, 0, null, 12, 7, null, 10, 12, null], lead: [79, null, 82, null, 86, null, 82, null, 84, null, 81, null, 79, null, null, null, 86, null, 84, null, 82, null, 79, null, 81, null, 84, null, 82, null, null, null], wave: 'sawtooth' }),
    TM.audio.song({ bpm: 156, roots: [38, 38, 41, 43], chords: [[62, 65, 69], [62, 65, 69], [65, 69, 72], [67, 71, 74]], bassPattern: [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 10, 12, 7, 12], lead: [74, 77, 81, 77, 74, 77, 81, 86, 84, 81, 77, 81, 84, 81, 77, 74, 72, 76, 79, 76, 72, 76, 79, 84, 83, 79, 76, 79, 83, 79, 76, 71], wave: 'square' }),
  ];

  /* ---------------- stage scripts: [type, count] per stop (the last stop of each stage is the boss) ---------------- */
  const RECIPES = [
    [[['jelly', 3]], [['jelly', 2], ['jumper', 2], ['tiny', 1]], [['jelly', 2], ['brolly', 2], ['jumper', 2], ['tiny', 1]]],
    [[['jelly', 2], ['flyer', 2], ['brolly', 1]], [['stilt', 1], ['flyer', 2], ['tiny', 1], ['jumper', 2]], [['stilt', 2], ['brolly', 2], ['flyer', 3], ['tiny', 2]]],
    [[['jumper', 3], ['split', 1]], [['jumper', 2], ['split', 1], ['brolly', 2], ['flyer', 2]], [['split', 2], ['stilt', 1], ['tiny', 2], ['jumper', 3]]],
    [[['stilt', 1], ['jelly', 3], ['flyer', 2]], [['split', 1], ['brolly', 2], ['jumper', 3], ['tiny', 2]], [['stilt', 2], ['split', 2], ['flyer', 3], ['brolly', 2]], [['stilt', 2], ['split', 2], ['jumper', 3], ['flyer', 3], ['tiny', 2], ['brolly', 2]]],
  ];
  const BOSS_OF = ['big', 'squid', 'mama', 'king'];
  const BOSS_NAME = ['Big Gloop', 'Grumpy Squid', 'Mama Splitter', 'Gloop King'];
  const CALLOUTS = ['SPLAT!', 'SPLOOSH!', 'BLOOP!', 'SPLASH!', 'PLOP!', 'SPLOT!', 'WHOOSH!', 'SPLISH!'];
  const COMBO_TXT = { 3: 'NICE!', 5: 'SPLAT-TASTIC!', 8: 'INK-CREDIBLE!', 12: 'SPLOOSH-ING!', 16: 'DRIP-DROP DIVA!', 20: 'GOOP-ER STAR!', 30: 'UNSTOPPA-BLOB!', 40: 'LEGEND OF GOO!', 50: 'INKY MASTER!' };

  /* ---------------- state ---------------- */
  let S = null, WS = null, G = null;
  const parts = new INK.Parts(800);
  const drawables = [];
  const rp = (g, px) => px * g.vw().w / window.innerWidth; // real pixels -> virtual units
  const team = () => TM.store.get('ink.team', 0);
  const accentOf = (col) => U.shade(col, -0.28);

  function newStage(g, si) {
    WS = INK.buildStage(si, S.team);
    S.stage = si; S.stopI = 0; S.cz = 0; S.phase = 'move'; S.stopT = 0; S.queue = []; S.qt = 0; S.boss = null; S.rushT = 0;
    S.enemies = []; S.shots = []; S.critters = []; S.splats = []; S.goo = [];
    S.pair = WS.pair; S.shotI = 0; S.lock.release();
    S.moveSpd = 0; S.cov = 0; S.stageStart = g.playT;
    S.banners.length = 0; S.amt = 0;
    banner(g, `STAGE ${si + 1}`, WS.def.name, 2.8, 120);
    if (g.state === 'countdown') S.banners[0].t = -3.3;
    if (g.state === 'play' && !g.demo) TM.audio.startMusic(SONGS[si]);
  }

  function reset(g) {
    G = g;
    S = {
      team: team(), stage: 0, stopI: 0, cz: 0, phase: 'move', t: 0, enemies: [], shots: [], critters: [], splats: [], goo: [], floaters: [], banners: [], queue: [], qt: 0,
      tank: 100, ultra: 0, ultraFx: null, lock: new TM.LockOn(), bot: { acc: 0 }, recoil: 0, aim: 0, pair: ['#FF3EA5', '#B8F03A'], shotI: 0, hitFlash: 0, wipe: null, amt: 0, cov: 0, stageCov: [],
      splatted: 0, ultras: 0, bossesDown: 0, thumbs: [], turf: [], lowT: 0, comboShown: 0, lastDmgT: -9, topY: 110, muzzle: { x: VX + 430, y: H - 200 }, ending: false, stats: { glob: 0 },
    };
    parts.clear(); INK.quality = 0; slowN = 0;
    newStage(g, Math.min(NSTAGE - 1, +(TM.U.qs('stage') || 0)));
    if (g.demo) S.banners.length = 0;
  }

  /* ---------------- helpers ---------------- */
  const colOf = (i) => S.pair[i % 2];
  function banner(g, text, sub, life = 1.6, size = 100, col) {
    S.banners.push({ text, sub, t: 0, life, size, col: col || S.pair[0] });
    if (S.banners.length > 4) S.banners.shift();
  }
  function floater(text, x, y, o = {}) {
    S.floaters.push({ text, x, y, t: 0, life: o.life || 0.9, size: o.size || 60, col: o.col || S.pair[0], rot: o.rot ?? U.rand(-0.14, 0.14), vy: o.vy ?? -60 });
  }
  const diffK = () => (G.diff === 'gentle' ? 0 : G.diff === 'turbo' ? 2 : 1);
  function perKey() { return [0.95, 0.62, 0.42][diffK()]; }
  function baseTime() { return [7.5, 5.6, 4.2][diffK()]; }

  /* ---------------- spawning ---------------- */
  function laneX(g) {
    const lanes = [-4.2, -2.6, -1, 0.8, 2.4, 4.0];
    for (let i = 0; i < 10; i++) {
      const x = U.pick(lanes) + U.rand(-0.35, 0.35);
      if (S.enemies.every((q) => q.z < 22 || Math.abs(q.x0 - x) > 1.5)) return x;
    }
    return U.pick(lanes);
  }
  function takeWord(g, o) {
    const avoid = S.lock.firstLetters(S.enemies);
    for (const q of S.enemies) if (q.alive && q.items[q.idx + 1]) avoid.add(q.items[q.idx + 1].first);
    return g.dealer.next(Object.assign({ avoidFirst: avoid }, o));
  }
  function stageProg() { return (S.stage + S.stopI / Math.max(1, WS.def.stops.length)) / NSTAGE; }
  function mkEnemy(g, type, o = {}) {
    const lad = g.ladder(U.clamp(stageProg() * 1.05, 0, 1));
    const T = INK.TYPES[type];
    let items;
    const maxLen = lad.maxLen;
    switch (type) {
      case 'brolly': items = [takeWord(g, { kind: 'word', maxLen: 4 }), takeWord(g, { kind: 'word', maxLen: Math.min(8, maxLen) })]; break;
      case 'tiny': case 'glob': items = [takeWord(g, { kind: 'word', maxLen: 3 })]; break;
      case 'flyer': items = [takeWord(g, { kind: 'word', maxLen: Math.min(6, maxLen) })]; break;
      case 'stilt': items = [lad.kind === 'sentence' && Math.random() < 0.4 ? takeWord(g, { kind: 'sentence', maxWords: 3 }) : takeWord(g, { kind: 'word', minLen: 4, maxLen: Math.max(6, maxLen) })]; break;
      case 'split': items = [lad.kind === 'sentence' && Math.random() < 0.5 ? takeWord(g, { kind: 'sentence', maxWords: 4 }) : takeWord(g, { kind: 'word', minLen: 4, maxLen: Math.max(7, maxLen) })]; break;
      default: items = [takeWord(g, { kind: 'word', maxLen })];
    }
    const total = items.reduce((a, it) => a + it.len, 0);
    let time = baseTime() + total * perKey();
    if (type === 'tiny') time = baseTime() * 0.55 + total * perKey();
    if (type === 'glob') time = [4.6, 3.6, 2.8][diffK()] + total * perKey() * 0.5;
    const z0 = o.z ?? (Z_FAR + U.rand(-1, 4));
    const x0 = o.x ?? laneX(g);
    const e = {
      type, x: x0, x0, z: z0, y: 0, speed: ((z0 - Z_ATK) / time) * T.spd * (g.demo ? 0.8 : 1), items, idx: 0, typer: new TM.Typer(items[0]), alive: true, state: 'walk', t: U.rand(0, 9), seed: U.rand(0, 20), var: U.randi(0, 2),
      col: U.shade(INK.GREY[type], U.rand(-0.06, 0.1)), spots: [], sq: 0, phase: 0, locked: false, danger: 0, shield: type === 'brolly', hurt: 0, near: false, blink: 0, look: 0, kick: 0,
      dmg: type === 'glob' ? 9 : type === 'split' || type === 'stilt' ? 16 : 12, doomT: 0, chipW: 0,
    };
    if (o.fromBoss) e.kick = 0;
    e.canopy = U.pick(['#B9A488', '#A8B3A0', '#B5A3B8']); e.canopy2 = '#E9DDCA';
    S.enemies.push(e);
    return e;
  }
  function spawnType(g, type, o) {
    if (type === 'tiny') { // a little swarm of short words
      const n = U.randi(3, 4), cx = laneX(g), z = Z_FAR + 2;
      for (let i = 0; i < n; i++) mkEnemy(g, 'tiny', { x: cx + (i - (n - 1) / 2) * 1.1 + U.rand(-0.2, 0.2), z: z + U.rand(-1.5, 2.5) });
      return;
    }
    mkEnemy(g, type, o);
  }
  function queueStop(g) {
    const rec = RECIPES[S.stage][S.stopI]; if (!rec) return;
    const list = []; for (const [t, n] of rec) for (let i = 0; i < n; i++) list.push(t);
    U.shuffle(list);
    const gap = [2.8, 2.5, 2.2, 2.0][S.stage] * [1.4, 1, 0.82][diffK()];
    let t = 0.9;
    S.queue = []; S.qt = 0;
    for (const type of list) { S.queue.push({ t, type }); t += gap * U.rand(0.75, 1.3) + (type === 'tiny' ? 1.2 : 0); }
  }
  function maxAlive() { const m = [3, 4, 5][diffK()] + (S.stage >= 2 ? 1 : 0) - (S.tank < 35 ? 1 : 0); return Math.max(2, m); }

  /* ---------------- bosses ---------------- */
  function startBoss(g) {
    const type = BOSS_OF[S.stage];
    const T = INK.TYPES[type];
    const nph = type === 'king' ? 4 : 3;
    const lad = g.ladder(U.clamp(stageProg() * 1.05, 0, 1));
    const items = [];
    for (let i = 0; i < nph; i++) {
      const last = i === nph - 1, mid = i === nph - 2 && nph === 4;
      if (S.stage >= 1 && (last || mid)) items.push(takeWord(g, { kind: 'sentence', maxWords: g.diff === 'gentle' ? 4 : 6 }));
      else if (S.stage === 0 && last) items.push(takeWord(g, { kind: 'word', minLen: 6, maxLen: 11 }));
      else items.push(takeWord(g, { kind: 'word', minLen: 4 + Math.min(2, i + S.stage), maxLen: Math.max(7, lad.maxLen) }));
    }
    const e = {
      type, boss: true, x: 0, x0: 0, z: 48, y: type === 'squid' ? 1.2 : 0, speed: 0, items, idx: 0, typer: new TM.Typer(items[0]), alive: true, state: 'enter', t: 0, seed: 3, var: 0,
      col: INK.GREY[type], spots: [], sq: 0, phase: 0, locked: false, danger: 999, hurt: 0, near: false, blink: 0, look: 0, kick: 0, dmg: 30, doomT: 0, nph, kidsGone: 0, globT: 6, slam: 0, stagger: 0, addsT: 0, tPhase: 0, cape: '#A95C7A',
    };
    S.boss = e; S.enemies.push(e);
    banner(g, 'BOSS!', BOSS_NAME[S.stage], 2.4, 130, '#FF5A5F');
    TM.sfx.big(); G.fx.shake(10, 0.3);
    setPhaseSpeed(e);
  }
  function setPhaseSpeed(e) {
    const len = e.typer.item.len;
    const T = (8 + len * perKey() * 1.9) * (e.type === 'king' ? 1.1 : 1);
    e.speed = Math.max(0.1, (e.z - 4.4) / T); e.tPhase = 0;
  }
  function bossAdds(g, e) {
    const pool = [['jelly', 'jelly', 'tiny'], ['jumper', 'tiny', 'flyer'], ['jelly', 'brolly'], ['jumper', 'jelly', 'tiny']][S.stage] || ['jelly', 'tiny'];
    const n = e.type === 'mama' ? 0 : 2;
    for (let i = 0; i < n; i++) { const tp = pool[(i + e.idx) % pool.length]; S.queue.push({ t: S.qt + 0.8 + i * 1.6, type: tp }); }
    if (e.type === 'mama') { for (let i = 0; i < 3; i++) mkEnemy(g, 'tiny', { x: -2.2 + i * 2.2, z: Math.max(18, e.z + 4), fromBoss: true }); e.kidsGone++; }
  }

  /* ---------------- input ---------------- */
  const typeable = () => S.enemies.filter((q) => q.alive && (q.state === 'walk' || q.state === 'fight' || q.state === 'enter' || q.state === 'recover'));
  function onKey(g, k) {
    if (S.phase === 'wipe' || S.ending) return;
    const { target, result } = S.lock.feed(k, typeable());
    g.keyResult(result);
    if (result === 'miss') {
      if (target) target.typer.shake = 1;
      missCost(g, k);
      return;
    }
    if (target) fire(g, target, result === 'done');
  }
  function onBack() { S.lock.release(); }
  function onEnter(g) { if (!g.demo) tryUltra(g); }
  function missCost(g, k) {
    if (g.demo) return;
    S.tank = Math.max(g.diff === 'gentle' ? 10 : 0, S.tank - [0, 1.6, 2.4][diffK()]);
    S.lastDmgT = S.t;
    parts.sprite('star_09', S.muzzle.x, S.muzzle.y, 70, { color: '#FF5A5F', life: 0.2, add: false });
    if (S.tank <= 0 && g.state === 'play') outOfInk(g);
  }

  /* ---------------- shots ---------------- */
  function fire(g, e, final) {
    const col = colOf(S.shotI++);
    S.shots.push({ e, t: 0, dur: final ? 0.2 : 0.14, final, col, ox: S.muzzle.x, oy: S.muzzle.y, trail: [], item: e.typer.item, typer: e.typer, idx: e.idx });
    S.recoil = 1;
    parts.sprite('muzzle_02', S.muzzle.x, S.muzzle.y - 14, 120, { color: col, life: 0.1, rot: -0.15 + S.aim * 1, add: false, a: 0.95, size: 120 });
    parts.sprite('circle_05', S.muzzle.x, S.muzzle.y, 140, { color: '#ffffff', life: 0.12, add: true, a: 0.9 });
    INK.snd('shot', 0.55, U.rand(0.95, 1.3));
    if (final) { e.state = e.boss ? e.state : 'doomed'; e.doomT = 0; e.dizzy = !e.boss; if (e.locked) { /* lock released by LockOn */ } }
  }
  const eScreen = (e) => {
    const T = INK.TYPES[e.type], sc = F / Math.max(0.8, e.z);
    return { x: INK.sx(e.x, e.z), y: INK.gy(e.z) - (e.y + T.wh * 0.5) * sc, gy: INK.gy(e.z), sc, T };
  };
  function hitSpot(e, col, big) {
    const T = INK.TYPES[e.type];
    const r = (e.boss ? 46 : 22) * U.rand(0.8, 1.3) * (big ? 1.5 : 1);
    e.spots.push({ x: U.rand(-0.7, 0.7), y: U.rand(-0.5, 0.9), r, k: U.pick(INK.SPLAT_ROUND), col, rot: U.rand(0, 6.28) });
    if (e.spots.length > 12) e.spots.shift();
  }
  function impact(g, sh) {
    const e = sh.e, col = sh.col;
    if (!e.alive) { parts.burst(sh.x || S.muzzle.x, sh.y || S.muzzle.y, col, { count: 6 }); return; }
    const s = eScreen(e);
    parts.burst(s.x, s.y, col, { count: sh.final ? 22 : 9, speed: [200, sh.final ? 900 : 560], color2: colOf(S.shotI), size: [6, sh.final ? 20 : 14] });
    parts.sprite('star_09', s.x, s.y, sh.final ? 220 : 120, { color: '#ffffff', life: 0.22, add: true });
    hitSpot(e, col, false); e.sq = -0.12; e.hurt = 1;
    if (!e.boss && !sh.final) { e.z = Math.min(Z_FAR + 3, e.z + (e.type === 'flyer' ? 0.18 : 0.38)); }
    INK.snd('pep', 0.3, U.rand(1.1, 1.5));
    // ink also lands on the ground near the target
    INK.groundSplat(WS, e.x + U.rand(-0.8, 0.8), S.cz + e.z + U.rand(-0.4, 0.8), U.rand(0.45, 0.85), col);
    if (sh.final) onWordDone(g, e, sh);
  }
  function onWordDone(g, e, sh) {
    const typer = sh.typer;
    const col = sh.col, s = eScreen(e);
    const pts = g.wordDone(typer, null, null, { bonus: e.boss ? 2 : 1, color: col });
    if (!g.demo && pts) floater('+' + pts, s.x, s.y - 90 * Math.min(2, s.sc / 60), { size: 54, col: '#FFC83D', life: 0.9 });
    S.ultra = Math.min(100, S.ultra + (e.boss ? 14 : 8) + (g.score.mult - 1) * 2);
    S.tank = Math.min(100, S.tank + (e.boss ? 6 : 2.2));
    comboCheck(g);
    if (e.boss) { bossPhaseDone(g, e, sh); return; }
    if (e.idx + 1 < e.items.length) { // brolly: the shield word pops, the Gloop underneath is next
      e.idx++; e.typer = new TM.Typer(e.items[e.idx]); e.state = 'walk'; e.dizzy = false; e.shield = false;
      INK.snd('shield', 0.8, 1.3); TM.sfx.zap();
      for (let i = 0; i < 12; i++) parts.add({ type: 'drop', x: s.x + U.rand(-60, 60), y: s.y - 60 * Math.min(2, s.sc / 60), vx: U.rand(-500, 500), vy: U.rand(-700, -100), color: i % 2 ? e.canopy : e.canopy2, size: U.rand(8, 16), g: 1700, life: 0.7 });
      floater('POP!', s.x, s.y - 100, { size: 60, col: '#FFC83D' });
      return;
    }
    splatEnemy(g, e, col, false);
  }
  function splatEnemy(g, e, col, byUltra) {
    if (!e.alive) return;
    e.alive = false; S.lock.locked === e && S.lock.release();
    if (e.locked) e.locked = false;
    const s = eScreen(e), sc = s.sc;
    const c2 = colOf(S.shotI + 1);
    // the big splat billboard + droplets
    const size = U.clamp(sc * s.T.wh * 2.0, 160, 700);
    S.splats.push({ x: s.x, y: s.y, k: U.pick(INK.SPLATS), col, size, t: 0, life: 0.7, rot: U.rand(0, 6.28) });
    S.splats.push({ x: s.x + U.rand(-1, 1) * size * 0.25, y: s.y + U.rand(-0.5, 0.5) * size * 0.2, k: U.pick(INK.SPLATS), col: c2, size: size * 0.6, t: -0.05, life: 0.65, rot: U.rand(0, 6.28) });
    parts.burst(s.x, s.y, col, { count: 34, speed: [300, 1100], color2: c2, size: [8, 24], up: 200 });
    parts.sprite('circle_02', s.x, s.y, size * 0.5, { color: col, life: 0.45, grow: size * 1.3, add: true, a: 0.9 });
    parts.sprite('star_09', s.x, s.y, size * 0.6, { color: '#ffffff', life: 0.3, add: true });
    for (let i = 0; i < 6; i++) parts.sprite(U.pick(['star_06', 'star_07']), s.x, s.y, U.rand(34, 64), { color: U.pick(['#FFE066', '#ffffff', col, c2]), vx: U.rand(-500, 500), vy: U.rand(-700, -100), g: 1200, life: 0.7, vr: U.rand(-6, 6), add: true, drag: 0.98 });
    // paint the world: ground + nearby scenery
    const big = e.boss ? 3.2 : 1.7 + s.T.wh * 0.35;
    INK.groundSplat(WS, e.x, S.cz + e.z, big, col);
    INK.groundSplat(WS, e.x + U.rand(-2, 2), S.cz + e.z + U.rand(-1.5, 1.5), big * 0.7, c2);
    INK.paintNear(WS, S.cz, e.z, 14, S.pair, e.boss ? 6 : 2, Math.sign(e.x));
    // critter!
    spawnCritter(g, e, col);
    if (!g.demo) { S.splatted++; floater(U.pick(CALLOUTS), s.x, s.y - 40, { size: Math.min(110, 50 + sc * 0.3), col, rot: U.rand(-0.2, 0.2) }); }
    INK.snd('slime', 0.8, U.rand(0.9, 1.2)); TM.sfx.splat(); INK.snd('pep', 0.6, U.rand(0.95, 1.25));
    g.fx.shake(e.boss ? 18 : 6 + Math.min(8, sc * 0.05), 0.12);
    if (e.type === 'split') { // the Splitter splits in two before turning happy
      for (const sd of [-1, 1]) { const m = mkEnemy(g, 'tiny', { x: e.x + sd * 0.8, z: e.z + 0.5 }); m.speed *= 0.8; m.state = 'walk'; m.type = 'tiny'; }
    }
    if (!byUltra) { /* score handled by caller */ }
  }
  function comboCheck(g) {
    if (g.demo) return;
    const c = g.score.combo;
    if (COMBO_TXT[c] || (c > 50 && c % 25 === 0)) {
      banner(g, COMBO_TXT[c] || 'UNSTOPPA-BLOB!', `COMBO x${c}`, 1.3, 84, S.pair[c % 2]);
      INK.snd('combo', 0.8, 1 + Math.min(0.5, c * 0.01));
    }
  }

  /* ---------------- bosses: phases ---------------- */
  function bossPhaseDone(g, e, sh) {
    const s = eScreen(e);
    e.stagger = 1; e.sq = -0.15;
    S.splats.push({ x: s.x + U.rand(-120, 120), y: s.y + U.rand(-80, 80), k: U.pick(INK.SPLATS), col: sh.col, size: 420, t: 0, life: 0.8, rot: U.rand(0, 6.28) });
    parts.burst(s.x, s.y, sh.col, { count: 40, speed: [300, 1100], color2: colOf(S.shotI + 1), size: [10, 26] });
    parts.sprite('circle_02', s.x, s.y, 200, { color: sh.col, life: 0.5, grow: 700, add: true });
    INK.groundSplat(WS, e.x, S.cz + e.z, 3, sh.col); INK.paintNear(WS, S.cz, e.z, 14, S.pair, 3);
    INK.snd('slime', 1, 0.8); TM.sfx.big(); g.fx.shake(16, 0.2);
    g.fx.pop(VX, 330, `${['OUCH-IE!', 'WOBBLE!', 'DIZZY!', 'SPLAT!'][Math.min(3, e.idx)]}`, { size: 90, color: sh.col, life: 1 });
    e.idx++;
    e.col = INK.mix(INK.GREY[e.type], S.pair[0], Math.min(0.75, e.idx / e.nph * 0.8));
    if (e.idx >= e.nph) { bossDefeated(g, e); return; }
    e.typer = new TM.Typer(e.items[e.idx]);
    e.z = Math.min(12, e.z + 2.4); e.state = 'recover'; e.recT = 1.2; e.slam = 0;
    setPhaseSpeed(e);
    bossAdds(g, e);
  }
  function bossDefeated(g, e) {
    const s = eScreen(e);
    S.boss = null; e.alive = false; S.bossesDown++;
    S.lock.release();
    for (let i = 0; i < 4; i++) setTimeout(() => { if (S) { parts.burst(s.x + U.rand(-250, 250), s.y + U.rand(-200, 100), U.pick(S.pair), { count: 30, speed: [300, 1100] }); } }, i * 140);
    g.fx.confetti(VX, 360, 90); g.fx.doFlash(S.pair[0], 0.6); g.fx.shake(24, 0.4);
    for (let i = 0; i < 9; i++) S.critters.push(mkCritter(S.cz + e.z + U.rand(-4, 4), U.rand(-6, 6) + (i % 2 ? 3 : -3), U.pick(S.pair), i * 0.1));
    S.critters.push(Object.assign(mkCritter(S.cz + e.z, 0, S.pair[0], 0), { big: true, species: 'bear', hopsLeft: 99 }));
    INK.snd('zapUp', 1, 1); INK.snd('boom', 0.8, 1.1);
    INK.groundSplat(WS, 0, S.cz + e.z, 5, S.pair[0]); INK.groundSplat(WS, 2, S.cz + e.z + 2, 4, S.pair[1]);
    INK.paintAllVisible(WS, S.cz, S.pair);
    g.score.add(500 + S.stage * 250);
    floater('+' + (500 + S.stage * 250), s.x, s.y - 160, { size: 80, col: '#FFC83D', life: 1.4 });
    banner(g, 'BOSS SPLATTED!', BOSS_NAME[S.stage] + ' is happy now', 2.4, 100, '#FFC83D');
    for (const q of S.enemies) if (q.alive && q !== e) { splatEnemy(g, q, S.pair[0], true); }
    S.queue.length = 0;
    startRush(g);
  }

  /* ---------------- critters ---------------- */
  function mkCritter(wz, x, col, delay) {
    const side = x < 0 ? -1 : 1;
    return { wz, x, col, species: U.pick(INK.SPECIES), seed: U.rand(0, 20), t: -(delay || 0), state: 'pop', tx: side * U.rand(5.3, 9.2), sq: 0, hop: 0, hopT: 0, wave: true, cheer: 0, blink: 0, hopsLeft: 3, big: false };
  }
  function spawnCritter(g, e, col) {
    const c = mkCritter(S.cz + e.z, e.x, col, 0.12); c.y0 = e.y;
    S.critters.push(c);
    if (S.critters.length > 30) S.critters.shift();
    for (const o of S.critters) o.cheer = 1;
  }

  /* ---------------- damage ---------------- */
  function hitPlayer(g, e) {
    e.alive = false; S.lock.locked === e && S.lock.release();
    const s = { x: INK.sx(e.x, e.z), y: INK.gy(e.z) };
    // harmless goo splats on the screen edges, never anything scary
    const v = g.vw();
    for (let i = 0; i < 3; i++) {
      const edge = U.randi(0, 3), t = Math.random();
      const x = edge === 0 ? v.x + v.w * U.rand(0.02, 0.2) : edge === 1 ? v.x + v.w * U.rand(0.8, 0.98) : v.x + v.w * t, y = edge === 2 ? v.y + v.h * U.rand(0.02, 0.2) : edge === 3 ? v.y + v.h * U.rand(0.8, 0.98) : v.y + v.h * t;
      S.goo.push({ x, y, r: U.rand(150, 260) * (e.boss ? 1.4 : 1), k: U.pick(INK.SPLAT_ROUND), t: 0, life: 3.2, rot: U.rand(0, 6.28), col: i % 2 ? GOO : GOO2, drip: U.rand(20, 60) });
    }
    
    S.hitFlash = 1; g.fx.shake(e.boss ? 30 : 20, 0.3);
    INK.snd('hit', 0.9, 1); INK.snd('slime', 1, 0.7); TM.sfx.hurt();
    parts.burst(s.x, Math.min(s.y, H - 80), GOO, { count: 24, speed: [300, 900], up: 400, color2: GOO2 });
    floater('SPLORT!', VX, v.y + v.h * 0.4, { size: 150, col: '#B9A8F0', life: 1.2, rot: -0.08 });
    if (g.demo || g.state !== 'play') return;
    g.missWord(e.typer.item);
    const dmg = e.dmg * [0.35, 1, 1.35][diffK()];
    S.tank = Math.max(g.diff === 'gentle' ? 12 : 0, S.tank - dmg); S.lastDmgT = S.t;
    if (S.tank <= 0) outOfInk(g);
  }
  function outOfInk(g) {
    if (S.ending) return; S.ending = true;
    S.lock.release(); S.queue.length = 0;
    finish(g, false);
  }

  /* ---------------- ultra ---------------- */
  function tryUltra(g) {
    if (g.state !== 'play' || S.ultra < 100 || S.ultraFx || S.phase === 'wipe' || S.ending) return;
    S.ultra = 0; S.ultras++;
    S.ultraFx = { t: 0, dur: 1.5, killed: new Set() };
    g.fx.doFlash('#ffffff', 0.7); g.fx.shake(26, 0.7);
    INK.snd('ultra', 1, 1); INK.snd('boom', 0.7, 0.9); INK.snd('rumble', 0.8, 1); TM.sfx.boost();
    banner(g, 'ULTRA SPLAT!', 'Paint wave!', 1.8, 140, S.pair[0]);
    const v = g.vw();
    for (let i = 0; i < 40; i++) S.splats.push({ x: v.x + Math.random() * v.w, y: v.y + v.h * (0.15 + Math.random() * 0.85), k: U.pick(INK.SPLATS), col: colOf(i), size: U.rand(300, 640), t: -(Math.random() * 0.9), life: 1.0, rot: U.rand(0, 6.28) });
    for (let i = 0; i < 6; i++) parts.sprite('circle_02', VX, v.y + v.h, 200, { color: colOf(i), life: 0.9, grow: 3200, add: true, a: 0.8, g: 0 });
    for (let i = 0; i < 12; i++) INK.groundSplat(WS, U.rand(-5, 5), S.cz + U.rand(3, 34), U.rand(2, 3.4), colOf(i));
    INK.paintAllVisible(WS, S.cz, S.pair);
    S.cov = INK.coverage(WS);
  }
  function updateUltra(g, dt) {
    const u = S.ultraFx; if (!u) return;
    u.t += dt;
    const v = g.vw(), front = v.y + v.h - (v.h * 0.95) * Math.min(1, u.t / 0.9); // the wave sweeps from the bottom up
    for (const e of S.enemies) {
      if (!e.alive || u.killed.has(e)) continue;
      const s = eScreen(e);
      if (s.y >= front - 80 || u.t > 0.8) {
        u.killed.add(e);
        if (e.boss) {
          if (e.state !== 'enter') { const col = colOf(0); g.score.add(60); bossPhaseDone(g, e, { col, typer: e.typer, final: true }); }
        } else {
          g.score.add(40); splatEnemy(g, e, colOf(u.killed.size), true);
          S.ultra = 0;
        }
      }
    }
    if (u.t >= u.dur) S.ultraFx = null;
  }

  /* ---------------- stage flow ---------------- */
  function startRush(g) { S.phase = 'rush'; S.rushT = 0; S.rushN = 0; }
  function stageStars(cov) { return cov >= 0.85 ? 3 : cov >= 0.6 ? 2 : 1; }
  function finishStage(g) {
    const cov = INK.coverage(WS);
    S.turf.push(cov);
    S.thumbs.push(makeThumb(WS, cov));
    const stars = stageStars(cov);
    if (!g.demo) {
      g.score.add(Math.round(cov * 600) + Math.round(S.tank * 4) + 200);
      banner(g, 'TURF CAPTURED!', `${WS.def.name}: ${Math.round(cov * 100)}%  ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, 3.0, 110, '#FFC83D');
      g.fx.confetti(VX, 360, 70); INK.snd('clear', 1, 1); TM.sfx.win();
      S.tank = Math.min(100, S.tank + 30);
    }
    S.phase = 'celebrate'; S.celT = 0;
  }
  function updateFlow(g, dt) {
    const def = WS.def, stops = def.stops;
    if (S.phase === 'move') {
      const target = stops[S.stopI];
      const d = target - S.cz;
      const spd = Math.min(11, 2.5 + d * 2.2);
      S.moveSpd = U.lerp(S.moveSpd, d > 0.05 ? spd : 0, Math.min(1, dt * 4));
      S.cz = Math.min(target, S.cz + S.moveSpd * dt);
      if (d <= 0.06) { S.cz = target; S.moveSpd = 0; S.phase = 'stop'; S.stopT = 0; S.qt = 0; S.cleared = false; arrive(g); }
    } else if (S.phase === 'stop') {
      S.stopT += dt;
      const isBoss = S.stopI === stops.length - 1;
      if (!isBoss) {
        S.qt += dt;
        while (S.queue.length && S.queue[0].t <= S.qt) {
          if (S.enemies.filter((q) => q.alive).length >= maxAlive() && S.queue[0].t < S.qt - 0.01) { S.queue[0].t = S.qt + 0.35; break; }
          spawnType(g, S.queue.shift().type);
        }
        if (!S.queue.length && !S.enemies.some((q) => q.alive) && !S.shots.length) {
          S.phase = 'clearing'; S.clearT = 0;
          if (!g.demo) { floater('CLEAR!', VX, 330, { size: 120, col: S.pair[0], life: 1.2 }); S.tank = Math.min(100, S.tank + 10); INK.snd('up', 0.8, 1); }
        }
      } else {
        if (S.stopT > 1.2 && !S.bossStarted) { S.bossStarted = true; startBoss(g); }
        if (S.bossStarted && S.boss) { S.qt += dt; while (S.queue.length && S.queue[0].t <= S.qt) { if (S.enemies.filter((q) => q.alive && !q.boss).length >= 5) { S.queue[0].t = S.qt + 0.5; break; } spawnType(g, S.queue.shift().type); } }
      }
    } else if (S.phase === 'clearing') {
      S.clearT += dt;
      if (S.clearT > 1.1) { S.stopI++; S.phase = 'move'; if (g.demo && S.stopI >= stops.length - 1) S.demoReset = true; }
    } else if (S.phase === 'rush') { // stage-end paint rush
      S.rushT += dt;
      if (S.rushT > S.rushN * 0.16 && S.rushN < 14) {
        S.rushN++; const v = g.vw();
        S.splats.push({ x: v.x + Math.random() * v.w, y: v.y + v.h * (0.2 + Math.random() * 0.7), k: U.pick(INK.SPLATS), col: colOf(S.rushN), size: U.rand(260, 560), t: 0, life: 0.9, rot: U.rand(0, 6.28) });
        INK.groundSplat(WS, U.rand(-5, 5), S.cz + U.rand(3, 30), U.rand(1.6, 3), colOf(S.rushN));
        INK.paintNear(WS, S.cz, U.rand(6, 40), 12, S.pair, 3);
        INK.snd('pep', 0.5, U.rand(0.9, 1.4));
      }
      if (S.rushT > 2.4) finishStage(g);
    } else if (S.phase === 'celebrate') {
      S.celT += dt;
      if (S.celT > 3.4) {
        if (S.stage >= NSTAGE - 1) { if (!S.ending && !g.demo) { S.ending = true; finish(g, true); } }
        else { S.phase = 'wipe'; S.wipe = { t: 0, swapped: false }; INK.snd('whoosh', 1, 1); TM.sfx.whoosh(); }
      }
    } else if (S.phase === 'wipe') {
      S.wipe.t += dt;
      if (S.wipe.t > 0.7 && !S.wipe.swapped) { S.wipe.swapped = true; const w = S.wipe; const keep = { wipe: w, ult: S.ultraFx }; newStage(g, S.stage + 1); S.phase = 'wipe'; S.wipe = w; S.ultraFx = null; S.banners.length = 0; banner(g, `STAGE ${S.stage + 1}`, WS.def.name, 2.8, 120); }
      if (S.wipe.t > 1.5) { S.wipe = null; S.phase = 'move'; }
    }
  }
  function arrive(g) {
    const isBoss = S.stopI === WS.def.stops.length - 1;
    S.bossStarted = false;
    if (!isBoss) { queueStop(g); if (!g.demo) { banner(g, S.stopI === 0 ? 'GET READY!' : 'HERE THEY COME!', null, 1.3, 90); } }
    else if (!g.demo) banner(g, 'WARNING!', 'Something big is coming...', 1.6, 100, '#FF5A5F');
    S.ultraWarn = false;
  }

  /* ---------------- results / end ---------------- */
  function makeThumb(ws, cov) {
    const c = document.createElement('canvas'); c.width = 380; c.height = 84; const x = c.getContext('2d');
    const pal = ws.def.pal;
    x.fillStyle = pal.sideV; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = pal.roadV; x.fillRect(0, 84 * 0.18, c.width, 84 * 0.64);
    x.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 12; i++) x.fillRect(8 + i * 31, 84 / 2 - 1.5, 16, 3);
    // the ground paint layer rotated so the road runs left to right
    const z0 = ws.def.stops[0] * INK.TPU, z1 = Math.min(ws.texH, (ws.def.stops[ws.def.stops.length - 1] + 36) * INK.TPU);
    x.save(); x.translate(0, 84); x.rotate(-Math.PI / 2); x.drawImage(ws.tex, 0, z0, 14 * INK.TPU, z1 - z0, 0, 0, 84, c.width); x.restore();
    // little props along the edges
    x.fillStyle = 'rgba(31,26,61,0.4)'; x.fillRect(0, 0, c.width, 2); x.fillRect(0, 82, c.width, 2);
    return { canvas: c, name: ws.def.name, cov, stars: stageStars(cov), pair: ws.pair };
  }
  function buildMap() {
    const rows = S.thumbs.length || 1, c = document.createElement('canvas'); c.width = 760; c.height = 40 + rows * 108; const x = c.getContext('2d');
    x.fillStyle = '#FFF8EC'; x.fillRect(0, 0, c.width, c.height);
    S.thumbs.forEach((t, i) => {
      const y = 12 + i * 108;
      x.drawImage(t.canvas, 12, y + 12, 456, 84);
      x.lineWidth = 5; x.strokeStyle = INK.INKC; x.strokeRect(12, y + 12, 456, 84);
      x.fillStyle = INK.INKC; x.font = '800 26px "Baloo 2", sans-serif'; x.textBaseline = 'middle'; x.fillText(t.name, 490, y + 32);
      x.font = '800 44px "Baloo 2", sans-serif'; x.fillStyle = t.pair[0]; x.strokeStyle = INK.INKC; x.lineWidth = 8; x.lineJoin = 'round'; x.strokeText(Math.round(t.cov * 100) + '%', 490, y + 70); x.fillText(Math.round(t.cov * 100) + '%', 490, y + 70);
      for (let s = 0; s < 3; s++) { x.fillStyle = s < t.stars ? '#FFC83D' : '#D8D3E6'; x.strokeStyle = INK.INKC; x.lineWidth = 4; const p = P.star(650 + (s - 1) * 38 + 38 * 0 + 38, y + 62, 17, 0.5); x.fill(p); x.stroke(p); }
    });
    return c.toDataURL('image/png');
  }
  function finish(g, win) {
    const avg = S.turf.length ? S.turf.reduce((a, b) => a + b, 0) / S.turf.length : INK.coverage(WS);
    if (!win && WS) { S.turf.push(INK.coverage(WS)); S.thumbs.push(makeThumb(WS, INK.coverage(WS))); }
    const pct = Math.round((S.turf.reduce((a, b) => a + b, 0) / Math.max(1, S.turf.length)) * 100);
    const done = S.stage + (win ? 1 : 0);
    S.mapURL = buildMap();
    watchResults(S.mapURL);
    S.endT = 0; S.endWin = win;
    if (win) g.fx.confetti(VX, 360, 120);
    g.end({
      win, title: win ? 'TURF WAR WON!' : 'Out of ink!', delay: 3200,
      sub: win ? 'The whole town is full of colour and happy critters!' : `You painted ${Math.max(0, done)} stage${done === 1 ? '' : 's'} of the town. Refill and try again!`,
      targetMet: win && pct >= 70,
      stats: [['Turf painted', pct + '%'], ['Gloops splatted', S.splatted], ['Ultras used', S.ultras], ['Bosses beaten', S.bossesDown]],
    });
  }
  function watchResults(url) {
    const mo = new MutationObserver(() => {
      const card = document.querySelector('.tm-results'); if (!card || card.querySelector('.ink-map')) return;
      const img = document.createElement('img'); img.className = 'ink-map'; img.src = url; img.alt = 'Turf map';
      img.style.cssText = 'width:min(100%,520px);display:block;margin:8px auto 10px;border:5px solid #1F1A3D;border-radius:18px;box-shadow:0 6px 0 rgba(31,26,61,.25)';
      const sub = card.querySelector('.sub'); (sub || card.querySelector('h2')).after(img);
      mo.disconnect();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 20000);
  }

  /* ---------------- update ---------------- */
  function update(g, dt) {
    G = g;
    if (!S) return;
    S.t += dt; V.t = S.t;
    const calm = TM.settings.reduceMotion;
    V.sway = Math.sin(S.t * 0.35) * 1.0;
    V.camX = calm ? 0 : Math.sin(S.t * 0.4) * 0.18;
    V.hz = INK.HZ0 + (calm ? 0 : Math.sin(S.t * (S.moveSpd > 0.5 ? 9 : 1.3)) * (S.moveSpd > 0.5 ? 5 : 1.2) * Math.min(1, 0.3 + S.moveSpd / 6));
    parts.update(dt);
    S.recoil = Math.max(0, S.recoil - dt * 7); S.hitFlash = Math.max(0, S.hitFlash - dt * 2.4);
    S.amt = U.lerp(S.amt, S.cov, Math.min(1, dt * 2.5));
    for (const f of S.floaters) { f.t += dt; f.y += f.vy * dt; }
    S.floaters = S.floaters.filter((f) => f.t < f.life);
    for (const b of S.banners) b.t += dt;
    S.banners = S.banners.filter((b) => b.t < b.life);
    for (const sp of S.splats) sp.t += dt;
    S.splats = S.splats.filter((sp) => sp.t < sp.life);
    for (const o of S.goo) o.t += dt;
    S.goo = S.goo.filter((o) => o.t < o.life);
    updateCritters(g, dt);
    if (g.state === 'countdown') { return; }
    const live = g.live || g.demo;
    if (!live) { for (const e of S.enemies) if (e.alive) { e.t += dt; } return; }
    // muzzle & aim
    const v = g.vw(), by = Math.max(H, v.y + v.h) - 80, bx = VX + 470;
    const tgt = S.lock.locked || nearest();
    let tx = VX, ty = 520; if (tgt) { const s = eScreen(tgt); tx = s.x; ty = s.y; }
    const ang = U.clamp(Math.atan2(tx - bx, by - ty), -0.9, 0.2);
    S.aim = U.lerp(S.aim, ang, Math.min(1, dt * 14));
    const gl = 262 - S.recoil * 16;
    S.muzzle.x = bx + Math.sin(S.aim) * gl; S.muzzle.y = by - Math.cos(S.aim) * gl; S.gunB = { x: bx, y: by };
    S.topY = v.y + rp(g, 108);
    // enemies
    for (const e of S.enemies) updateEnemy(g, e, dt);
    S.enemies = S.enemies.filter((e) => e.alive);
    // shots
    for (const sh of S.shots) {
      sh.t += dt / sh.dur;
      const e = sh.e, s = e.alive ? eScreen(e) : null;
      if (s) { sh.tx = s.x; sh.ty = s.y; }
      const k = Math.min(1, sh.t), tx2 = sh.tx ?? S.muzzle.x, ty2 = sh.ty ?? 300;
      sh.x = U.lerp(sh.ox, tx2, k) ; sh.y = U.lerp(sh.oy, ty2, k) - Math.sin(k * Math.PI) * 50;
      sh.trail.push([sh.x, sh.y]); if (sh.trail.length > 9) sh.trail.shift();
      if (Math.random() < 0.6) parts.add({ type: 'drop', x: sh.x, y: sh.y, vx: U.rand(-90, 90), vy: U.rand(-60, 120), size: U.rand(5, 10), color: sh.col, life: 0.35, g: 900 });
      if (sh.t >= 1 && !sh.done) { sh.done = true; impact(g, sh); }
    }
    S.shots = S.shots.filter((s) => !s.done);
    updateUltra(g, dt);
    updateFlow(g, dt);
    S.cov = INK.coverage(WS);
    // gentle: ink tank slowly refills; others only a trickle when calm
    if (!g.demo) { const calmT = S.t - S.lastDmgT; if (calmT > 2.5) S.tank = Math.min(100, S.tank + dt * [3, 0.9, 0.3][diffK()]); }
    S.lowT += dt;
    if (g.demo) demoBot(g, dt);
    if (S.demoReset && g.demo) { S.demoReset = false; reset(g); }
  }
  function nearest() {
    let b = null;
    for (const e of S.enemies) if (e.alive && e.state !== 'doomed' && (!b || e.z < b.z)) b = e;
    return b;
  }
  function updateEnemy(g, e, dt) {
    e.t += dt; e.hurt = Math.max(0, e.hurt - dt * 5); e.sq = U.lerp(e.sq, 0, Math.min(1, dt * 10)); e.stagger = Math.max(0, (e.stagger || 0) - dt * 2);
    e.blink = Math.max(0, e.blink - dt); if (Math.random() < dt * 0.4) e.blink = 0.12;
    if (e.typer.shake > 0) e.typer.shake = Math.max(0, e.typer.shake - dt * 3);
    e.near = e.z < 8 && !e.boss;
    if (e.boss) return updateBoss(g, e, dt);
    e.danger = 100 - e.z;
    if (e.state === 'doomed') { e.doomT += dt; if (e.doomT > 0.9 && e.alive) splatEnemy(g, e, S.pair[0], true); return; }
    const prog = U.clamp((e.z - Z_ATK) / (Z_FAR - Z_ATK), 0, 1);
    let sp = e.speed;
    if (e.type === 'jumper') {
      const per = 1.2, k = (e.t % per) / per, air = k < 0.55;
      sp *= air ? 2.0 : 0.12; e.y = air ? Math.sin((k / 0.55) * Math.PI) * 1.2 : 0; e.sq = air ? 0.04 : (k < 0.62 ? 0.14 : -0.02);
      if (k < dt / per * 1.2 && !g.demo) INK.snd('jump', 0.12, 1.3);
    } else if (e.type === 'flyer') {
      e.y = 0.9 + prog * 1.9 + Math.sin(e.t * 3 + e.seed) * 0.35;
      e.x = e.x0 * (0.55 + 0.45 * prog) + Math.sin(e.t * 2.1 + e.seed) * 1.4 * prog;
    } else if (e.type === 'stilt') { e.phase += dt * 5; e.y = 0; e.sq = Math.sin(e.phase * 2) * 0.03; }
    else if (e.type === 'glob') { e.y = 0.5 + Math.abs(Math.sin(e.t * 6)) * 0.4; }
    else { e.y = e.type === 'tiny' ? Math.abs(Math.sin(e.t * 8 + e.seed)) * 0.18 : Math.abs(Math.sin(e.t * 4 + e.seed)) * 0.1; if (e.sq === 0) e.sq = 0; }
    if (e.type !== 'flyer') e.x = e.x0 * (0.62 + 0.38 * prog);
    e.z -= sp * dt;
    e.look = Math.sin(e.t * 1.2 + e.seed) * 0.5;
    if (e.z <= Z_ATK) hitPlayer(g, e);
  }
  function updateBoss(g, e, dt) {
    e.danger = 200;
    e.y = e.type === 'squid' ? 1.1 + Math.sin(e.t * 1.6) * 0.35 : 0;
    e.slam = Math.max(0, e.slam - dt * 2);
    if (e.state === 'enter') {
      e.z -= (e.z - 9.5) * Math.min(1, dt * 1.6) + 0.3 * dt; e.x = Math.sin(e.t) * 0.6;
      if (e.z < 10.1) { e.state = 'fight'; setPhaseSpeed(e); }
    } else if (e.state === 'recover') {
      e.recT -= dt; e.x = U.lerp(e.x, Math.sin(e.t * 0.8) * 1.4, dt * 2);
      if (e.recT <= 0) e.state = 'fight';
    } else if (e.state === 'fight') {
      e.tPhase += dt;
      e.z -= e.speed * dt;
      e.x = Math.sin(e.t * 0.7) * 1.6;
      e.sq = Math.sin(e.t * 3) * 0.025;
      if (e.type === 'squid') { // the squid flicks goo globs at you
        e.globT -= dt;
        if (e.globT <= 0) { e.globT = [9, 6.5, 5][diffK()] + U.rand(0, 2); const gl = mkEnemy(g, 'glob', { x: e.x + U.rand(-1.2, 1.2), z: e.z + 0.5 }); gl.y = 1.4; S.stats.glob++; floater('FLICK!', eScreen(e).x, eScreen(e).y, { size: 54, col: GOO2 }); INK.snd('shot', 0.4, 0.6); }
      }
      if (e.type === 'king' && e.idx >= 2 && S.queue.length === 0 && S.enemies.filter((q) => q.alive && !q.boss).length === 0 && e.tPhase > 5) { for (let i = 0; i < 2; i++) S.queue.push({ t: S.qt + 0.3 + i * 1.8, type: U.pick(['jelly', 'jumper', 'tiny']) }); }
      if (e.z <= 4.3) { // big stomp: harmless splat on you, boss bounces back
        e.slam = 1; e.z = 11; e.state = 'recover'; e.recT = 1.4; setPhaseSpeed(e);
        hitPlayer(g, Object.assign({}, e, { alive: true, boss: true, z: 4, dmg: 26, typer: e.typer }));
        e.alive = true;
      }
    }
  }
  function updateCritters(g, dt) {
    for (const c of S.critters) {
      c.t += dt; if (c.t < 0) continue;
      c.cheer = Math.max(0, c.cheer - dt * 0.8);
      if (Math.random() < dt * 0.3) c.blink = 0.15; c.blink = Math.max(0, c.blink - dt);
      if (c.state === 'pop') { const k = Math.min(1, c.t / 0.4); c.sq = (1 - k) * -0.3; c.scale = U.ease.outBack(k); if (k >= 1) { c.state = 'hop'; c.hopT = 0; } }
      else if (c.state === 'hop') {
        c.hopT += dt; c.x = U.lerp(c.x, c.tx, Math.min(1, dt * 2.4));
        const per = 0.5, k = (c.hopT % per) / per; c.hop = Math.sin(k * Math.PI) * (c.big ? 0.5 : 0.9); c.sq = k > 0.9 || k < 0.1 ? 0.12 : 0;
        if (Math.abs(c.x - c.tx) < 0.15 && !c.big) { c.state = 'idle'; c.hop = 0; c.idleT = 0; }
        if (c.big) { c.x = 0; }
      } else {
        c.idleT += dt; c.hop = c.cheer > 0.1 ? Math.abs(Math.sin(c.idleT * 9 + c.seed)) * 0.7 * c.cheer : Math.abs(Math.sin(c.idleT * 2 + c.seed)) * 0.07; c.wave = c.cheer > 0.1; c.sq = Math.sin(c.idleT * 3 + c.seed) * 0.03;
      }
    }
    S.critters = S.critters.filter((c) => c.wz - S.cz > 0.6 && (c.big || c.wz - S.cz < 90));
  }
  function demoBot(g, dt) {
    if (S.phase === 'wipe') return;
    S.bot.acc += dt * 7.5;
    while (S.bot.acc >= 1) {
      S.bot.acc -= 1;
      let t = S.lock.locked && S.lock.locked.alive ? S.lock.locked : null;
      if (!t) { const c = typeable().filter((q) => q.z < 26 && !q.typer.done).sort((a, b) => a.z - b.z); t = c[0]; }
      if (!t) break;
      const k = t.typer.nextReq(); if (k == null) break;
      onKey(g, k);
    }
  }

  /* ---------------- drawing ---------------- */
  function drawEnemy(ctx, e) {
    const T = INK.TYPES[e.type], z = Math.max(0.9, e.z), sc = F / z;
    const x = INK.sx(e.x, z), gy = INK.gy(z), y = gy - e.y * sc;
    // shadow on the ground
    ctx.save(); ctx.fillStyle = 'rgba(31,26,61,0.2)'; ctx.beginPath(); const sw = T.wh * 0.42 * sc * (e.boss ? 1.3 : 1) * (1 - Math.min(0.5, e.y * 0.12)); ctx.ellipse(x, gy + 2, sw, sw * 0.2, 0, 0, 7); ctx.fill(); ctx.restore();
    const s = (sc * T.wh) / T.ah;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (e.boss) INK.drawBoss(ctx, e, e.t); else INK.drawEnemy(ctx, e, e.t);
    if (e.hurt > 0.5) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (e.hurt - 0.5) * 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -T.ah * 0.5, T.ah * 0.5, T.ah * 0.55, 0, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function drawCritterW(ctx, c) {
    if (c.t < 0) return;
    const z = c.wz - S.cz; if (z < 1.2) return;
    const sc = F / z, h = c.big ? 5.2 : 1.55, s = (sc * h) / 86 * (c.scale ?? 1);
    const x = INK.sx(c.x, z), gy = INK.gy(z), y = gy - (c.hop || 0) * sc;
    ctx.save(); ctx.fillStyle = 'rgba(31,26,61,0.18)'; ctx.beginPath(); ctx.ellipse(x, gy + 2, h * 0.3 * sc, h * 0.06 * sc, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (z > 60) ctx.globalAlpha = U.clamp((90 - z) / 30, 0, 1);
    INK.drawCritter(ctx, c, S.t + c.seed); ctx.restore();
  }
  function drawChip(ctx, g, e, v, placed) {
    const T = INK.TYPES[e.type], z = Math.max(1, e.z), sc = F / z;
    const topY = INK.gy(z) - (e.y + T.wh) * sc;
    const x = INK.sx(e.x, z);
    let size = e.boss ? 56 : U.clamp(30 + (1 - (z - Z_ATK) / (Z_FAR - Z_ATK)) * 26, 32, 58);
    if (e.type === 'tiny' || e.type === 'glob') size = Math.min(size, 44);
    const cs = D.chipSize(ctx, e.typer, size);
    let scale = 1; const maxW = Math.min(1700, v.w - 60); if (cs.w > maxW) scale = maxW / cs.w;
    const w = cs.w * scale, h = cs.h * scale;
    let cx = U.clamp(x, 30 + w / 2, W - 30 - w / 2), cy = e.boss ? INK.gy(z) - (e.y + T.wh * 0.3) * sc : topY - h / 2 - 10;
    cy = Math.max(cy, S.topY + 56 + h / 2);
    for (let i = 0; i < 10; i++) { // sidestep (or rise) if it overlaps a nearer chip
      let hit = null;
      for (const r of placed) if (Math.abs(r.x - cx) < (r.w + w) / 2 + 4 && Math.abs(r.y - cy) < (r.h + h) / 2 + 2) { hit = r; break; }
      if (!hit) break;
      const right = hit.x + (hit.w + w) / 2 + 8, left = hit.x - (hit.w + w) / 2 - 8;
      const okR = right + w / 2 < W - 20, okL = left - w / 2 > 20;
      const pickRight = okR && (!okL || Math.abs(right - x) < Math.abs(left - x));
      if ((pickRight || okL) && i < 4) cx = pickRight ? right : left;
      else cy = Math.max(S.topY + 56 + h / 2, hit.y - (hit.h + h) / 2 - 4);
    }
    placed.push({ x: cx, y: cy, w, h });
    const locked = S.lock.locked === e;
    const acc = e.type === 'brolly' && e.shield ? '#8A6D3B' : accentOf(S.pair[0]);
    D.chip(ctx, cx, cy, e.typer, { size, accent: locked ? accentOf(S.pair[0]) : acc, locked, hint: g.hint && (locked || (!S.lock.locked && e === nearest())), scale });
    if (e.boss) { D.text(ctx, `${e.idx + 1}/${e.nph}`, cx - w / 2 - 34, cy, { size: 40, color: '#fff', outline: 9 }); }
    else if (e.type === 'brolly' && e.shield) D.text(ctx, 'SHIELD!', cx, cy - h / 2 - 16, { size: 26, color: '#FFC83D', outline: 7 });
  }
  function bannerPlate(ctx, b, cx, cy) {
    const k = b.t / b.life, tin = Math.min(1, b.t / 0.28), tout = Math.max(0, (b.t - (b.life - 0.3)) / 0.3);
    const off = (1 - U.ease.outBack(tin)) * -1100 + tout * 1100;
    ctx.save(); ctx.translate(cx + off, cy); ctx.rotate(-0.06);
    ctx.font = D.FONT_DISPLAY(b.size, 800); const tw = ctx.measureText(b.text).width + b.size * 0.9;
    let sw = 0; if (b.sub) { ctx.font = D.FONT_DISPLAY(Math.round(b.size * 0.36), 800); sw = ctx.measureText(b.sub).width + 80; }
    const pw = Math.max(tw, sw), ph = b.size * 1.0 + (b.sub ? b.size * 0.42 : 0);
    ctx.transform(1, 0, -0.22, 1, 0, 0);
    // plate: ink drop shadow, team colour plate, white stripe
    ctx.fillStyle = INK.INKC; ctx.fill(P.rr(-pw / 2 + 12, -ph * 0.5 + 14, pw, ph, 18));
    ctx.fillStyle = b.col; ctx.fill(P.rr(-pw / 2, -ph * 0.5, pw, ph, 18)); ctx.lineWidth = 9; ctx.strokeStyle = INK.INKC; ctx.stroke(P.rr(-pw / 2, -ph * 0.5, pw, ph, 18));
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill(P.rr(-pw / 2 + 14, -ph * 0.5 + 10, pw * 0.5, ph * 0.12, 6));
    const ty = b.sub ? -b.size * 0.22 : 0;
    D.text(ctx, b.text, 0, ty + 3, { size: b.size, color: '#ffffff', outline: Math.max(12, b.size * 0.16) });
    if (b.sub) D.text(ctx, b.sub, 0, b.size * 0.5, { size: Math.round(b.size * 0.36), color: '#ffffff', outline: 8 });
    ctx.restore();
  }
  function drawGun(ctx, g, v) {
    const b = S.gunB || { x: VX + 470, y: Math.max(H, v.y + v.h) - 80 };
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(S.aim);
    const rc = S.recoil * 14; ctx.translate(0, rc);
    // sleeve + glove
    const sl = new Path2D(); sl.moveTo(-82, 90); sl.lineTo(82, 90); sl.lineTo(120, 420); sl.lineTo(-120, 420); sl.closePath();
    D.sticker(ctx, sl, '#fff', null, { shadow: false, lw: 7 });
    ctx.fillStyle = S.pair[0]; ctx.fill(P.rr(-100, 150, 200, 34, 12)); ctx.lineWidth = 6; ctx.strokeStyle = INK.INKC; ctx.stroke(P.rr(-100, 150, 200, 34, 12));
    // barrel
    D.sticker(ctx, P.rr(-20, -258, 40, 140, 14), '#5B5670', { x: -20, y: -258, w: 40, h: 140 }, { lw: 6, shadow: false });
    ctx.fillStyle = S.pair[1]; ctx.fill(P.rr(-24, -262, 48, 26, 10)); ctx.lineWidth = 6; ctx.strokeStyle = INK.INKC; ctx.stroke(P.rr(-24, -262, 48, 26, 10));
    // body
    D.sticker(ctx, P.rr(-62, -150, 124, 190, 36), S.pair[0], { x: -62, y: -150, w: 124, h: 190 }, { lw: 7, shadow: false });
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill(P.rr(-62 + 14, -112, 96, 14, 7));
    // glove
    D.sticker(ctx, P.circle(0, 70, 64), '#fff', { x: -64, y: 6, w: 128, h: 128 }, { lw: 7, shadow: false });
    ctx.strokeStyle = INK.INKC; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (const dx of [-26, 0, 26]) { ctx.beginPath(); ctx.moveTo(dx, 38); ctx.lineTo(dx, 64); ctx.stroke(); }
    // the ink tank: a see-through tube on the side that shows how much ink you have left
    const lvl = S.tank / 100, tx = 76, ty = -190, tw = 52, th = 210, low = lvl < 0.28 && Math.sin(S.t * 14) > 0;
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fill(P.rr(tx - tw / 2, ty, tw, th, 24));
    ctx.save(); ctx.clip(P.rr(tx - tw / 2, ty, tw, th, 24));
    const fy = ty + th * (1 - lvl);
    ctx.fillStyle = low ? '#FF5A5F' : S.pair[1]; ctx.fillRect(tx - tw / 2, fy, tw, th);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); for (let i = 0; i <= 8; i++) { const px = tx - tw / 2 + (i / 8) * tw; ctx.lineTo(px, fy + Math.sin(S.t * 5 + i) * 3); } ctx.lineTo(tx + tw / 2, fy + 14); ctx.lineTo(tx - tw / 2, fy + 14); ctx.fill();
    ctx.restore();
    ctx.lineWidth = 7; ctx.strokeStyle = low ? '#FF5A5F' : INK.INKC; ctx.stroke(P.rr(tx - tw / 2, ty, tw, th, 24));
    ctx.strokeStyle = INK.INKC; ctx.lineWidth = 3; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(tx + tw / 2 - 14, ty + (th * i) / 5); ctx.lineTo(tx + tw / 2, ty + (th * i) / 5); ctx.stroke(); }
    ctx.fillStyle = '#5B5670'; ctx.fill(P.rr(tx - 16, ty - 18, 32, 24, 8)); ctx.lineWidth = 5; ctx.strokeStyle = INK.INKC; ctx.stroke(P.rr(tx - 16, ty - 18, 32, 24, 8));
    ctx.restore();
  }
  function drawHUD(ctx, g, v) {
    if (g.demo) return;
    const topY = S.topY;
    // turf meter
    const mw = 520, mx = VX - mw / 2, my = topY, mh = 38;
    D.pill(ctx, mx - 4, my - 4, mw + 8, mh + 8, INK.INKC);
    D.pill(ctx, mx, my, mw, mh, 'rgba(255,255,255,0.9)');
    if (S.amt > 0.01) { ctx.save(); ctx.clip(P.rr(mx, my, mw, mh, mh / 2)); const fw = Math.max(mh, mw * S.amt); ctx.fillStyle = S.pair[0]; ctx.fillRect(mx, my, fw, mh); ctx.fillStyle = S.pair[1]; ctx.fillRect(mx + fw * 0.6, my, fw * 0.4, mh); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(mx, my + 4, fw, 7); ctx.restore(); }
    D.text(ctx, `TURF ${Math.round(S.amt * 100)}%`, VX, my + mh / 2 + 2, { size: 28, color: '#fff', outline: 8 });
    // stage pips
    for (let i = 0; i < NSTAGE; i++) { const px = mx + mw + 34 + i * 30; ctx.fillStyle = i < S.stage ? '#FFC83D' : i === S.stage ? S.pair[0] : 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(px, my + mh / 2, 10, 0, 7); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK.INKC; ctx.stroke(); }
    // boss bar (bottom centre so it never hides the boss word)
    if (S.boss && S.boss.alive) {
      const e = S.boss, bw = 520, bx = VX + 70 - bw / 2, by = v.y + v.h - 84;
      D.pill(ctx, bx - 4, by - 4, bw + 8, 34, INK.INKC);
      const seg = bw / e.nph;
      for (let i = 0; i < e.nph; i++) { ctx.fillStyle = i >= e.idx ? '#FF5A5F' : 'rgba(255,255,255,0.25)'; ctx.fill(P.rr(bx + i * seg + 3, by + 3, seg - 6, 20, 10)); }
      const cur = e.typer.progress; if (e.idx < e.nph) { ctx.fillStyle = '#FFC83D'; ctx.fill(P.rr(bx + e.idx * seg + 3, by + 3, Math.max(8, (seg - 6) * (1 - cur)), 20, 10)); }
      D.text(ctx, BOSS_NAME[S.stage], bx + bw / 2, by - 26, { size: 30, color: '#fff', outline: 8 });
    }
    // bottom-left: ink gauge + ultra
    const bl = 44, bb = v.y + v.h - 36;
    const gw = 360, gh = 44, gx = bl, gy = bb - gh;
    const low = S.tank < 28;
    D.pill(ctx, gx - 4, gy - 4, gw + 8, gh + 8, INK.INKC);
    D.pill(ctx, gx, gy, gw, gh, 'rgba(255,255,255,0.9)');
    ctx.save(); ctx.clip(P.rr(gx, gy, gw, gh, gh / 2)); const fw = Math.max(gh * 0.6, gw * (S.tank / 100));
    ctx.fillStyle = low && Math.sin(S.t * 12) > 0 ? '#FF5A5F' : S.pair[1]; ctx.fillRect(gx, gy, fw, gh); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(gx, gy + 5, fw, 8); ctx.restore();
    D.text(ctx, 'INK', gx + 52, gy + gh / 2 + 2, { size: 28, color: '#fff', outline: 8 });
    if (low) D.text(ctx, 'LOW INK!', gx + gw / 2 + 40, gy - 22, { size: 30, color: '#FF5A5F', outline: 8 });
    // ultra
    const ux = gx + gw + 80, uy = gy + gh / 2, ready = S.ultra >= 100;
    ctx.save(); ctx.translate(ux, uy); const pulse = ready ? 1 + Math.sin(S.t * 10) * 0.08 : 1; ctx.scale(pulse, pulse);
    ctx.fillStyle = INK.INKC; ctx.beginPath(); ctx.arc(0, 0, 50, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(0, 0, 42, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 42, 0, 7); ctx.clip(); ctx.fillStyle = ready ? S.pair[0] : S.pair[1]; const fh = 84 * (S.ultra / 100); ctx.fillRect(-42, 42 - fh, 84, fh); ctx.restore();
    const star = P.star(0, 0, 30, 0.5); ctx.fillStyle = ready ? '#FFC83D' : 'rgba(255,255,255,0.55)'; ctx.fill(star); ctx.lineWidth = 5; ctx.strokeStyle = INK.INKC; ctx.stroke(star);
    ctx.restore();
    if (ready) { D.text(ctx, 'ULTRA READY!', ux + 70, uy - 12, { size: 34, color: '#FFC83D', outline: 9, align: 'left' }); D.text(ctx, 'press ENTER', ux + 70, uy + 22, { size: 26, color: '#fff', outline: 7, align: 'left' }); }
    else D.text(ctx, 'ULTRA', ux + 66, uy, { size: 26, color: '#fff', outline: 7, align: 'left' });
  }
  function drawVignette(ctx, v) {
    const g = ctx.createRadialGradient(VX, 500, 520, VX, 520, Math.max(v.w, v.h) * 0.75);
    g.addColorStop(0, 'rgba(31,26,61,0)'); g.addColorStop(1, 'rgba(31,26,61,0.22)');
    ctx.fillStyle = g; ctx.fillRect(v.x, v.y, v.w, v.h);
  }
  function drawTurfWar(ctx, g, v) {
    // the Turf War results screen played out on the canvas right before the result card
    const k = U.clamp((S.endT || 0) / 0.6, 0, 1);
    ctx.fillStyle = `rgba(31,26,61,${0.55 * k})`; ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.save(); ctx.globalAlpha = k;
    bannerPlate(ctx, { text: S.endWin ? 'TURF WAR WON!' : 'TIME TO REFILL!', sub: null, size: 130, col: S.endWin ? S.pair[0] : '#7B5CFF', t: 0.5, life: 99 }, VX, 260);
    const n = S.thumbs.length;
    S.thumbs.forEach((t, i) => {
      const reveal = U.clamp((S.endT - 0.5 - i * 0.55) / 0.5, 0, 1); if (reveal <= 0) return;
      const y = 380 + i * 120, x = VX - 430;
      ctx.save(); ctx.globalAlpha = reveal; ctx.translate(0, (1 - reveal) * 40);
      ctx.drawImage(t.canvas, x, y, 456, 100); ctx.lineWidth = 6; ctx.strokeStyle = INK.INKC; ctx.strokeRect(x, y, 456, 100);
      D.text(ctx, t.name, x + 480, y + 28, { size: 36, color: '#fff', outline: 9, align: 'left' });
      D.text(ctx, Math.round(t.cov * 100 * reveal) + '%', x + 480, y + 74, { size: 52, color: t.pair[0], outline: 11, align: 'left' });
      for (let s = 0; s < 3; s++) { const sp = P.star(x + 800 + s * 52, y + 52, 24, 0.5); ctx.fillStyle = s < t.stars ? '#FFC83D' : 'rgba(255,255,255,0.35)'; ctx.fill(sp); ctx.lineWidth = 5; ctx.strokeStyle = INK.INKC; ctx.stroke(sp); }
      ctx.restore();
    });
    ctx.restore();
  }

  let lastDraw = 0, ema = 16, slowN = 0;
  function draw(g, ctx) {
    if (!S || !WS) return;
    const v = g.vw();
    const nowT = performance.now();
    if (lastDraw && g.state === 'play') { const dtm = Math.min(200, nowT - lastDraw); ema += (dtm - ema) * 0.05; if (ema > 26) slowN++; else slowN = Math.max(0, slowN - 2); if (slowN > 120 && INK.quality < 2) { INK.quality++; slowN = 0; ema = 16; } }
    lastDraw = nowT;
    // keep the sky/ground edges beyond the visible rect
    INK.drawSky(ctx, v, WS, S.amt, S.t);
    INK.drawGround(ctx, v, WS, S.amt, S.cz, S.t);
    drawables.length = 0;
    INK.propList(WS, S.cz, drawables);
    for (const e of S.enemies) if (e.alive) drawables.push({ z: e.z, e });
    for (const c of S.critters) { const z = c.wz - S.cz; if (z > 1.2) drawables.push({ z, c }); }
    drawables.sort((a, b) => b.z - a.z);
    for (const d of drawables) { if (d.prop) INK.drawProp(ctx, v, d.prop, S.cz); else if (d.e) drawEnemy(ctx, d.e); else drawCritterW(ctx, d.c); }
    if (INK.quality < 1) drawVignette(ctx, v);
    // splat billboards
    for (const sp of S.splats) {
      if (sp.t < 0) continue;
      const im = INK.splat(sp.k, sp.col); if (!im) continue; const k = sp.t / sp.life;
      const sz = sp.size * U.ease.outBack(Math.min(1, sp.t / 0.16)) * (1 + k * 0.1);
      ctx.save(); ctx.globalAlpha = k < 0.45 ? 1 : 1 - (k - 0.45) / 0.55; ctx.translate(sp.x, sp.y); ctx.rotate(sp.rot); ctx.drawImage(im, -sz / 2, -sz / 2, sz, sz); ctx.restore();
    }
    // shots with trails
    for (const sh of S.shots) {
      if (sh.x == null) continue;
      const tr = sh.trail;
      if (tr.length > 1) {
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let pass = 0; pass < 2; pass++) { ctx.strokeStyle = pass ? sh.col : INK.INKC; for (let i = 1; i < tr.length; i++) { ctx.lineWidth = (pass ? 1 : 1.6) * (4 + (i / tr.length) * (sh.final ? 26 : 18)) * (pass ? 1 : 1) + (pass ? 0 : 4); ctx.beginPath(); ctx.moveTo(tr[i - 1][0], tr[i - 1][1]); ctx.lineTo(tr[i][0], tr[i][1]); ctx.stroke(); } }
        ctx.restore();
      }
      const r = sh.final ? 26 : 17;
      ctx.save(); ctx.translate(sh.x, sh.y); ctx.fillStyle = sh.col; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK.INKC; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.35, r * 0.3, 0, 7); ctx.fill(); ctx.restore();
    }
    parts.draw(ctx);
    // goo on the goggles
    for (const o of S.goo) {
      const im = INK.splat(o.k, o.col); if (!im) continue; const k = o.t / o.life;
      const sz = o.r * 2 * U.ease.outBack(Math.min(1, o.t / 0.15)), a = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      ctx.save(); ctx.globalAlpha = a * 0.92; ctx.translate(o.x, o.y + o.t * o.drip); ctx.rotate(o.rot); ctx.scale(1, 1 + k * 0.25); ctx.drawImage(im, -sz / 2, -sz / 2, sz, sz); ctx.restore();
    }
    // word chips on top of everything in the world
    const placed = [];
    const list = S.enemies.filter((e) => e.alive && e.state !== 'doomed' && e.z < Z_FAR + 4).sort((a, b) => a.z - b.z);
    for (const e of list) if (S.lock.locked !== e) drawChip(ctx, g, e, v, placed);
    if (S.lock.locked && S.lock.locked.alive && S.lock.locked.state !== 'doomed') drawChip(ctx, g, S.lock.locked, v, placed);
    drawGun(ctx, g, v);
    // ultra sweep shine
    if (S.ultraFx) { const k = S.ultraFx.t / 0.9; ctx.save(); ctx.globalAlpha = Math.max(0, 0.5 * (1 - k)); ctx.fillStyle = '#fff'; const fy = v.y + v.h - v.h * 0.95 * Math.min(1, k); ctx.fillRect(v.x, fy - 20, v.w, 40); ctx.restore(); }
    // floaters (Splatoon-ish lettering)
    for (const f of S.floaters) {
      const k = f.t / f.life, sc = k < 0.18 ? U.ease.outBack(k / 0.18) : 1;
      ctx.save(); ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.scale(sc, sc); ctx.transform(1, 0, -0.16, 1, 0, 0);
      D.text(ctx, f.text, 0, 0, { size: f.size, color: f.col, outline: Math.max(10, f.size * 0.2), stroke: INK.INKC });
      ctx.restore();
    }
    if (S.hitFlash > 0) { ctx.save(); ctx.globalAlpha = S.hitFlash * 0.18; ctx.fillStyle = GOO; ctx.fillRect(v.x, v.y, v.w, v.h); ctx.restore(); }
    g.fx.draw(ctx);
    drawHUD(ctx, g, v);
    // banners
    let by = 0;
    for (const b of S.banners) { if (b.t < 0) continue; bannerPlate(ctx, b, VX, Math.max(S.topY + 190, 330) + by); by += b.size * 0.9 + 20; }
    // stage wipe: ink curtain
    if (S.wipe) {
      const t = S.wipe.t, cover = t < 0.7 ? t / 0.7 : Math.max(0, 1 - (t - 0.8) / 0.7);
      const n = 26;
      for (let i = 0; i < n; i++) {
        const col = colOf(i), rx = v.x + ((i * 0.618) % 1) * v.w, ry = v.y + (((i * 0.382 + 0.17) % 1)) * v.h;
        const im = INK.splat(INK.SPLATS[i % INK.SPLATS.length], col); if (!im) continue;
        const k = U.clamp(cover * 1.6 - (i % 5) * 0.12, 0, 1), sz = Math.max(v.w, v.h) * 0.62 * U.ease.outCubic(k);
        ctx.drawImage(im, rx - sz / 2, ry - sz / 2, sz, sz);
      }
      if (cover > 0.97) { ctx.fillStyle = S.pair[0]; ctx.fillRect(v.x, v.y, v.w, v.h); }
    }
    if (g.state === 'over') { S.endT = (S.endT || 0) + 1 / 60; drawTurfWar(ctx, g, v); }
  }

  /* ---------------- team picker (title screen) ---------------- */
  function buildTeamUI(g) {
    const css = document.createElement('style');
    css.textContent = `.ink-team{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:11;display:flex;gap:14px;align-items:center;background:var(--ink);padding:10px 16px 8px;border-radius:999px;box-shadow:0 6px 0 rgba(0,0,0,.28);color:#fff;font:800 20px var(--display)}
.ink-team button{border:5px solid var(--ink);background:#fff;border-radius:999px;padding:6px 16px 3px;cursor:pointer;display:inline-flex;gap:7px;align-items:center;font:800 20px var(--display);color:var(--ink);outline:3px solid transparent;transition:transform .08s}
.ink-team button:hover{transform:translateY(-2px)}
.ink-team button.on{outline:4px solid #fff;background:#FFF8EC;box-shadow:0 0 0 3px var(--ink)}
.ink-team i{display:inline-block;width:26px;height:26px;border-radius:50%;border:3px solid var(--ink)}
@media (max-height:560px){.ink-team{bottom:6px;transform:translateX(-50%) scale(.8)}}`;
    document.head.append(css);
    const box = document.createElement('div'); box.className = 'ink-team hidden';
    const lbl = document.createElement('span'); lbl.textContent = 'TEAM COLOUR'; box.append(lbl);
    const btns = [];
    for (let i = 0; i < 2; i++) {
      const pr = INK.STAGES[0].pairs[i], b = document.createElement('button');
      b.innerHTML = `<i style="background:${pr[0]}"></i><i style="background:${pr[1]}"></i>Team ${i + 1}`;
      b.onclick = () => { TM.store.set('ink.team', i); TM.sfx.click(); upd(); reset(G); };
      btns.push(b); box.append(b);
    }
    function upd() { const t = team(); btns.forEach((b, i) => b.classList.toggle('on', i === t)); }
    upd(); document.body.append(box);
    g.__teamBox = box;
  }

  TM.game({
    id: 'ink-rush', name: 'Ink Rush', accent: C.ink2, bg: '#C9CCE0',
    logoHTML: 'Ink<br>Rush', tagline: 'Splat the Gloops. Paint the town!',
    lifeIcon: TM.ui.heartSVG('#FF3EA5'),
    howto: [
      'Grumpy grey <b>Gloops</b> have drained the colour from the town. You ride an ink scooter along the rails and they rush at you!',
      'Type the first letter of a Gloop’s word to <b>lock on</b>. Every correct letter fires ink. Finish the word to <b>SPLAT</b> it: it turns into a happy critter and the world turns to your colours!',
      '<b>Brolly Gloops</b> hide under an umbrella: type the shield word first. <b>Splitters</b> split in two. Flappy ones fly, Stilt ones are tall, tiny swarms have short words.',
      'If a Gloop reaches you it only splats your goggles with goo, but you lose ink. Wrong keys cost a little ink too. When the tank is empty, you need a refill!',
      'Chain words with no mistakes to fill the <b>ULTRA</b> star. When it is full, press <b>ENTER</b> for a giant paint wave that splats everything!',
      'Paint the most turf in each stage. Beat the boss at the end of every stage. 4 stages to win the Turf War!',
    ],
    music: SONGS[0], reset, update, draw, onKey, onBack, onEnter,
    init(g) { G = g; INK.loadImages(); INK.preloadSfx(); buildTeamUI(g); },
    nextKey: () => { if (!S) return null; const t = S.lock.locked || nearest(); return t && !t.typer.done ? t.typer.nextReq() : null; },
    hud: (g) => {
      if (!S || !WS) return {};
      const total = INK.STAGES.reduce((a, s) => a + s.stops.length, 0);
      let done = 0; for (let i = 0; i < S.stage; i++) done += INK.STAGES[i].stops.length;
      done += S.stopI;
      return { progress: done / total, right: `Stage ${S.stage + 1}: ${WS.def.name}` };
    },
  });
  // show the team picker only on the title screen
  setInterval(() => { if (G && G.__teamBox) G.__teamBox.classList.toggle('hidden', G.state !== 'title' || (window.TM.ui.isModalOpen && window.TM.ui.isModalOpen())); }, 120);
  window.INK_DEBUG = { S: () => S, WS: () => WS, parts, spawn: (t, x, z) => mkEnemy(G, t, { x, z }), boss: () => startBoss(G), stage: (i) => { newStage(G, i); }, setCz: (c) => { S.cz = c; } };
})();
