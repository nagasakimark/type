/* Word Ninja - fruit flies through the dojo; type its word to slice it before it hits the floor.
   Waves, volleys, fans, side tosses, stink bombs, golden-banana frenzy, freeze fruit and a giant watermelon boss. */
(function () {
  'use strict';
  const TM = window.TM, WN = window.WN, C = TM.C, U = TM.U, D = TM.draw, P = D.P;
  const W = 1920, H = 1080, FLOOR_HIT = 985;
  const ACCENT = '#1E78F0', BOMB_ACCENT = '#A93BE0';
  const REDUCE = () => TM.settings.reduceMotion;

  /* ---------- music ---------- */
  const mMain = TM.audio.song({
    bpm: 112, roots: [38, 34, 41, 33], chords: [[62, 65, 69], [58, 62, 65], [60, 65, 69], [57, 62, 64]],
    bassPattern: [0, null, null, 0, null, null, 7, null, 0, null, null, 0, null, 7, null, null],
    lead: [74, null, null, 77, null, 76, null, null, 74, null, null, null, 69, null, 70, null, 74, null, 77, null, 81, null, null, 77, 76, null, 74, null, null, null, null, null],
    wave: 'triangle', pad: 'sine',
  });
  const mBoss = TM.audio.song({
    bpm: 136, roots: [38, 38, 34, 33], chords: [[62, 65, 69], [62, 65, 70], [58, 62, 65], [57, 61, 64]],
    bassPattern: [0, 0, null, 0, 12, null, 0, null, 0, 0, null, 0, 7, null, 10, null],
    lead: [74, 74, null, 77, 74, null, 81, null, 82, null, 81, 77, 74, null, 70, null, 74, 74, null, 77, 74, null, 82, null, 81, null, 77, null, 74, null, null, null],
    wave: 'square', pad: 'triangle',
  });
  const mFrenzy = TM.audio.song({
    bpm: 152, roots: [36, 41, 43, 36], chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]],
    bassPattern: [0, null, 12, null, 0, null, 12, null, 0, null, 12, null, 7, null, 12, null],
    lead: [72, 76, 79, 76, 72, 76, 79, 84, 74, 77, 81, 77, 74, 77, 81, 86, 76, 79, 83, 79, 76, 79, 83, 88, 74, 77, 81, 79, 76, 74, 72, null],
    wave: 'square', pad: 'sine',
  });

  /* ---------- state ---------- */
  let S;
  function maxLevelFor(g) { return g.diff === 'gentle' ? 4 : g.diff === 'turbo' ? 8 : 6; }
  function bossLevels(g) { return g.diff === 'gentle' ? [2, 4] : g.diff === 'turbo' ? [3, 6, 8] : [3, 6]; }
  function livesFor(g) { return g.diff === 'gentle' ? 5 : 3; }

  function reset(g) {
    const ml = maxLevelFor(g), lv = livesFor(g);
    S = {
      t: 0, fruits: [], halves: [], parts: [], decals: [], trails: [], banners: [], queue: [],
      lock: new TM.LockOn(), bot: new TM.Bot(7), botDelay: 0.8,
      level: 1, maxLevel: ml, bosses: bossLevels(g), phase: 'intro', phaseT: 0, waves: [], waveIdx: 0, waveWait: 0, resolved: 0, total: 1,
      lives: lv, maxLives: lv, chain: 0, lastSlice: -9, frenzy: 0, ice: 0, ts: 1, freeze: 0, slow: 0,
      sliced: 0, bossesDown: 0, mercy: 0, lastKind: '', demoT: 1.2, px: 0, focus: W / 2, boss: null, bossT: 0, music: 'main', lvlMisses: 0, perfect: true,
      lockWarn: 0, pace: perWord(g) * 0.9, lastKeyT: -9,
    };
    if (!g.demo) startLevel(g, Math.max(1, Math.min(ml, +U.qs('wnlevel') || 1)));
  }
  const stage = () => (S.maxLevel > 1 ? (S.level - 1) / (S.maxLevel - 1) : 0);
  const perWord = (g) => (g.diff === 'gentle' ? 0.8 : g.diff === 'turbo' ? 0.42 : 0.56);
  const hudBottom = (g) => { const v = g.vw(); return v.y + 118 * (v.w / window.innerWidth); };
  const aliveFruits = () => S.fruits.filter((f) => f.alive);
  const realAlive = () => S.fruits.filter((f) => f.alive && (f.type === 'fruit' || f.type === 'boss')).length;

  function setMusic(name) {
    if (S.music === name) return; S.music = name;
    if (TM.current && TM.current.state === 'play') TM.audio.startMusic(name === 'boss' ? mBoss : name === 'frenzy' ? mFrenzy : mMain);
  }

  /* ---------- level planning ---------- */
  function wchoice(list) { let tot = 0; for (const [, w] of list) tot += w; let r = Math.random() * tot; for (const [k, w] of list) { r -= w; if (r <= 0) return k; } return list[0][0]; }
  function capFor(g) { return Math.min(8, 3 + S.level) + (g.diff === 'turbo' ? 1 : g.diff === 'gentle' ? -1 : 0); }
  function buildWaves(g, L) {
    const d = g.diff, cap = capFor(g);
    const total = Math.round((7 + 3.4 * L) * (d === 'gentle' ? 0.78 : d === 'turbo' ? 1.2 : 1));
    const pool = [['single', 3], ['pair', 2]];
    if (L >= 2) pool.push(['volley', 2], ['side', 2]);
    if (L >= 3) pool.push(['fan', 2], ['cross', 2]);
    if (L >= 5) pool.push(['barrage', 1]);
    const sizes = {
      single: 1, pair: 2, volley: Math.min(5, 3 + Math.floor(L / 3)), fan: Math.min(5, 3 + (L >= 5 ? 1 : 0) + (L >= 7 ? 1 : 0)),
      side: 2 + (L >= 4 ? 1 : 0), cross: 2, barrage: Math.min(6, 4 + Math.floor(L / 3)),
    };
    const waves = []; let n = 0;
    while (n < total) {
      let t = waves.length === 0 ? 'single' : wchoice(pool);
      let c = Math.min(sizes[t], Math.max(1, cap - 1));
      if (c <= 1 && t !== 'single') t = 'single';
      waves.push({ type: t, n: c }); n += c;
    }
    const insert = (frac, w) => waves.splice(Math.max(1, Math.min(waves.length, Math.floor(waves.length * frac))), 0, w);
    if (L >= 2) insert(0.5, { type: 'golden', n: 0 });
    if (L >= 3 && Math.random() < 0.8) insert(0.72, { type: 'ice', n: 0 });
    const bombs = L < 2 ? 0 : 1 + (L >= 4 ? 1 : 0) + (L >= 6 ? 1 : 0);
    for (let i = 0; i < bombs; i++) insert(0.2 + (i + Math.random() * 0.6) * (0.7 / Math.max(1, bombs)), { type: 'bomb', n: 1 });
    return { waves, total: n };
  }
  function startLevel(g, L) {
    S.level = L; S.phase = 'intro'; S.phaseT = 0;
    const b = buildWaves(g, L);
    S.waves = b.waves; S.waveIdx = 0; S.waveWait = 0.8; S.total = b.total + (S.bosses.includes(L) ? 1 : 0); S.resolved = 0; S.lvlMisses = 0; S.perfect = true;
    S.queue.length = 0;
    S.needBanner = true;
    if (S.music !== 'main') setMusicForce(g, 'main');
  }
  function setMusicForce(g, name) { S.music = name; if (g.state === 'play') TM.audio.startMusic(name === 'boss' ? mBoss : name === 'frenzy' ? mFrenzy : mMain); }

  /* ---------- word selection ---------- */
  function pickItem(g, o = {}) {
    const avoidFirst = S.lock.firstLetters(S.fruits);
    for (const q of S.queue) if (q.first) avoidFirst.add(q.first);
    const lad = g.ladder(stage());
    if (o.sentence) return g.dealer.next({ kind: 'sentence', maxLen: o.maxLen || 60, avoidFirst });
    if (o.maxLen) return g.dealer.next({ kind: 'word', maxLen: o.maxLen, avoidFirst });
    const L = S.level;
    const phraseP = lad.tier >= 3 ? 0.38 : lad.tier === 2 && L >= 3 ? 0.14 : 0;
    if (Math.random() < phraseP) {
      const it = g.dealer.next({ kind: 'sentence', maxWords: lad.tier >= 3 ? 3 : 2, maxLen: 22, avoidFirst });
      if (it.len <= 24 && it.words <= (lad.tier >= 3 ? 3 : 2) && it.words >= 2) { it.phrase = true; return it; }
    }
    return g.dealer.next({ kind: 'word', maxLen: Math.min(lad.maxLen, lad.tier === 1 ? 6 : lad.tier === 2 ? 9 : 10), avoidFirst });
  }

  /* ---------- spawning ---------- */
  function launch(g, f, o) {
    const v = g.vw(), from = o.from || 'bottom';
    let x0, y0, xa;
    if (from === 'bottom') { y0 = Math.max(H, v.y + v.h) + 130; x0 = o.x0 != null ? o.x0 : U.rand(380, 1540); xa = o.xa != null ? o.xa : U.clamp(x0 + U.rand(-320, 320), 300, 1620); }
    else { y0 = U.rand(640, 860); x0 = from === 'left' ? v.x - 120 : v.x + v.w + 120; xa = o.xa != null ? o.xa : from === 'left' ? U.rand(430, 900) : U.rand(1020, 1490); }
    const apex = o.apex != null ? o.apex : U.rand(350, 520), rise = y0 - apex, T = o.T;
    const ratio = Math.sqrt(Math.max(0.25, (FLOOR_HIT - apex) / rise)), ta = T / (1 + ratio);
    f.g = (2 * rise) / (ta * ta); f.vy = -f.g * ta; f.vx = (xa - x0) / ta;
    const xe = x0 + f.vx * T;
    if (xe > W - 150) f.vx = (W - 150 - x0) / T; else if (xe < 150) f.vx = (150 - x0) / T;
    f.x = x0; f.y = y0;
  }
  function airtime(g, len, o = {}) {
    const lv = Math.max(0.78, 1 - 0.04 * (S.level - 1));
    const pc = U.clamp(S.pace * 1.25, perWord(g) * 0.78, perWord(g) * 1.5);
    let T = (2.6 + len * pc) * lv * (1 + S.mercy) + (o.extra || 0);
    if (o.mul) T *= o.mul;
    return U.clamp(T, 2.6, 15);
  }
  function newFruit(g, o) {
    const type = o.type || 'fruit';
    let kind = o.kind;
    if (!kind) {
      if (type === 'golden') kind = 'golden'; else if (type === 'ice') kind = 'ice'; else if (type === 'bomb') kind = 'bomb';
      else { do kind = o.phrase ? U.pick(['watermelon', 'pineapple']) : U.pick(WN.NORMAL_KINDS); while (kind === S.lastKind || (kind === 'watermelon' && !o.phrase)); S.lastKind = kind; }
    }
    const K = WN.kinds[kind]; if (!K) return null;
    const item = o.item;
    const sc = o.phrase ? 1.18 : 1;
    const size = K.size * sc;
    const f = {
      type, kind, size, sc, r: size * (kind === 'banana' || kind === 'golden' ? 0.3 : 0.46), item, typer: new TM.Typer(item), alive: true, locked: false,
      x: 0, y: 0, vx: 0, vy: 0, g: 0, rot: U.rand(-0.5, 0.5), vr: U.rand(1.5, 4) * (Math.random() < 0.5 ? -1 : 1), hit: 0, danger: 0, born: S.t, free: !!o.free, seed: Math.random() * 9,
      T: o.T, phrase: !!o.phrase,
    };
    launch(g, f, o);
    S.fruits.push(f);
    if (type === 'bomb') WN.snd('whoopdown', { vol: 0.35, rate: 1.4 });
    return f;
  }
  function spawnOne(g, o = {}) {
    const type = o.type || 'fruit';
    let item;
    if (type === 'golden') item = pickItem(g, { maxLen: 4 });
    else if (type === 'ice') item = pickItem(g, { maxLen: 5 });
    else if (type === 'bomb') item = pickItem(g, { maxLen: 6 });
    else if (S.frenzy > 0) item = pickItem(g, { maxLen: 4 });
    else item = pickItem(g);
    const phrase = !!item.phrase || item.kind === 'sentence';
    const extra = o.grp ? o.grp.sum * U.clamp(S.pace * 1.25, perWord(g) * 0.78, perWord(g) * 1.5) * (o.gf || 0.8) : 0;
    if (o.grp) o.grp.sum += item.len;
    const T = airtime(g, item.len, { extra, mul: type === 'golden' ? 1.2 : type === 'bomb' ? 0.8 : S.frenzy > 0 ? 1.05 : 1 });
    return newFruit(g, Object.assign({}, o, { type, item, phrase: type === 'fruit' && phrase, T }));
  }
  function queueSpawn(delay, o) { S.queue.push({ t: delay, o, first: null }); }

  function launchWave(g, w) {
    const grp = { sum: 0 };
    switch (w.type) {
      case 'single': queueSpawn(0, {}); break;
      case 'pair': { const a = U.rand(450, 800); queueSpawn(0, { x0: a, grp }); queueSpawn(0.5, { x0: a + U.rand(450, 800), grp, gf: 0.6 }); break; }
      case 'volley': { const x0 = U.rand(500, 1400); for (let i = 0; i < w.n; i++) queueSpawn(i * 0.32, { x0: x0 + U.rand(-50, 50), xa: U.clamp(x0 + U.rand(-300, 300), 300, 1620), grp, gf: 0.7 }); break; }
      case 'fan': {
        const cx = U.rand(850, 1070), gap = 270, x0 = cx + U.rand(-120, 120), apex = U.rand(380, 500);
        for (let i = 0; i < w.n; i++) queueSpawn(i * 0.05, { x0, xa: U.clamp(cx + (i - (w.n - 1) / 2) * gap, 260, 1660), apex: apex + U.rand(-30, 30), grp, gf: 0.9 });
        break;
      }
      case 'side': { const left = Math.random() < 0.5; for (let i = 0; i < w.n; i++) queueSpawn(i * 0.55, { from: left ? 'left' : 'right', grp, gf: 0.7 }); break; }
      case 'cross': queueSpawn(0, { from: 'left', grp, gf: 0.9 }); queueSpawn(0.12, { from: 'right', grp, gf: 0.9 }); if (S.level >= 5) queueSpawn(0.9, { x0: 960, xa: 960 + U.rand(-150, 150), grp, gf: 0.9 }); break;
      case 'barrage': for (let i = 0; i < w.n; i++) queueSpawn(i * 0.34, { grp, gf: 0.6 }); break;
      case 'golden': queueSpawn(0, { type: 'golden', x0: U.rand(700, 1200) }); break;
      case 'ice': queueSpawn(0, { type: 'ice', x0: U.rand(600, 1300) }); break;
      case 'bomb': queueSpawn(0, { type: 'bomb', x0: U.rand(500, 1400) }); queueSpawn(0.35, { grp, gf: 0.5 }); break;
    }
  }

  /* ---------- boss ---------- */
  function spawnBoss(g) {
    const avoid = S.lock.firstLetters(S.fruits);
    const item = g.dealer.next({ kind: 'sentence', maxLen: 56, avoidFirst: avoid });
    const hover = U.clamp((item.len * perWord(g) * 1.5 + 9) * (1 + S.mercy), 16, 60);
    const K = WN.kinds.bossmelon;
    const f = {
      type: 'boss', kind: 'bossmelon', size: K.size, sc: 1, r: 205, item, typer: new TM.Typer(item), alive: true, locked: false, x: W / 2, y: Math.max(H, g.vw().y + g.vw().h) + 330, vx: 0, vy: 0, g: 0,
      rot: 0, vr: 0, hit: 0, danger: 400, born: S.t, free: false, seed: 1, state: 'enter', st: 0, hover, left: hover, crack: 0, hy: 440,
    };
    S.fruits.push(f); S.boss = f;
    WN.snd('thud', { vol: 0.8, rate: 0.8 });
  }

  /* ---------- banners ---------- */
  function addBanner(g, text, sub, icons, o = {}) {
    S.banners.push({ text, sub, icons: icons || [], t: 0, life: o.life || 1.5, y: o.y || 330, big: !!o.big, color: o.color || '#FFD23F' });
    if (S.banners.length > 4) S.banners.shift();
  }

  /* ---------- keys ---------- */
  function targets(g) {
    const v = g.vw(), lim = v.y + v.h + 30;
    for (const f of S.fruits) f.danger = f.type === 'bomb' ? -1e6 : (f.type === 'boss' ? 500 : (f.vy > 0 ? 1000 : 0) + f.y);
    return S.fruits.filter((f) => f.alive && !f.dying && f.y < lim && (f.type !== 'boss' || f.state === 'hover'));
  }
  function onKey(g, k) {
    const { target, result } = S.lock.feed(k, targets(g));
    g.keyResult(result);
    if (!target) return;
    if (result === 'miss') { if (target.type === 'bomb') target.typer.shake = 0.6; return; }
    if (!g.demo && target.type !== 'bomb') { const dk = g.t - S.lastKeyT; if (dk < 1.3 && dk > 0.05) S.pace = U.clamp(U.lerp(S.pace, dk, 0.1), 0.25, 1.0); S.lastKeyT = g.t; }
    target.hit = 1;
    if (target.type === 'bomb') {
      if (result !== 'done' && S.lockWarn <= 0) { S.lockWarn = 2.2; g.fx.pop(target.x, target.y - 150, 'Stinky! Press Backspace!', { color: BOMB_ACCENT, size: 44, life: 1.4 }); }
    } else if (result !== 'done') sparks(target, 2);
    if (result === 'done') { if (target.type === 'bomb') bombTyped(g, target); else slice(g, target); }
  }
  function onBack() {
    const t = S.lock.locked; if (!t) return;
    S.lock.release();
    t.locked = false; t.typer = new TM.Typer(t.item); t.crack = 0;
  }
  function sparks(f, n) {
    for (let i = 0; i < n; i++) S.parts.push({ type: 'star', x: f.x + U.rand(-f.r, f.r) * 0.6, y: f.y + U.rand(-f.r, f.r) * 0.6, vx: U.rand(-120, 120), vy: U.rand(-220, -60), g: 500, rot: 0, vr: 3, life: 0.35, t: 0, size: U.rand(30, 56), color: '#BFE6FF' });
  }

  /* ---------- the slice ---------- */
  function slice(g, f) {
    f.alive = false; f.dying = true;
    if (S.lock.locked === f) S.lock.release();
    const demo = g.demo;
    const K = WN.kinds[f.kind];
    const boss = f.type === 'boss';
    // blade angle: diagonal, in the sprite's frame quantised to the baked half cache
    let th = (Math.random() < 0.5 ? 1 : -1) * U.rand(0.35, 1.0);
    if (boss) th = -0.55;
    const rel = (((th - f.rot) % Math.PI) + Math.PI) % Math.PI, q = Math.round(rel / (Math.PI / WN.QN)) % WN.QN;
    th = f.rot + q * Math.PI / WN.QN;
    const nx = Math.sin(th), ny = -Math.cos(th); // normal of the y<0 half
    const juice = K.juice;
    S.trails.push({ x: f.x, y: f.y, th, len: f.size * (boss ? 1.9 : 2.5), t: 0, life: boss ? 0.5 : 0.34, color: juice, w: boss ? 70 : 34 });
    for (const side of [0, 1]) {
      const sg = side === 0 ? 1 : -1;
      S.halves.push({ kind: f.kind, q, side, x: f.x + nx * sg * 6, y: f.y + ny * sg * 6, vx: f.vx * 0.7 + nx * sg * U.rand(170, 300) * (boss ? 1.3 : 1), vy: Math.min(f.vy, 0) * 0.5 - U.rand(120, 300) + ny * sg * 140, g: boss ? 1500 : 1900, rot: f.rot, vr: sg * U.rand(1.5, 4.5), sc: boss ? 1 : f.sc, size: f.size, t: 0 });
    }
    // juice: droplets, wall splats, flash
    const nd = boss ? 40 : 18;
    for (let i = 0; i < nd; i++) {
      const a = Math.atan2(ny, nx) + (Math.random() < 0.5 ? 0 : Math.PI) + U.rand(-0.9, 0.9), sp = U.rand(260, boss ? 1100 : 760);
      S.parts.push({ type: 'drop', x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 1500, rot: 0, vr: 0, life: U.rand(0.5, 1.0), t: 0, size: U.rand(5, boss ? 20 : 13), color: i % 5 === 0 ? K.flesh : juice });
    }
    S.parts.push({ type: 'flare', x: f.x, y: f.y, vx: 0, vy: 0, g: 0, rot: 0, vr: 0, life: 0.28, t: 0, size: f.size * (boss ? 2.4 : 2), color: '#FFFFFF' });
    const ds = Math.min(f.size, 190);
    addDecal(f.x, f.y, juice, ds * U.rand(0.95, 1.25) * (boss ? 2.2 : 1), true);
    if (Math.random() < 0.5 || boss) addDecal(f.x + U.rand(-90, 90), f.y + U.rand(-60, 80), juice, ds * U.rand(0.4, 0.65), false);
    WN.sndPick(['swish1', 'swish2', 'swish3'], { vol: 0.55, jitter: 0.12 });
    WN.sndPick(['squelch1', 'squelch2'], { vol: 0.6, delay: 0.05 });
    TM.sfx.slice();
    g.fx.shake(boss ? 26 : 7, boss ? 0.45 : 0.09);

    if (demo) { g.wordDone(f.typer, f.x, f.y); S.botDelay = U.rand(0.35, 0.9); return; }

    // chain + score
    S.chain = g.t - S.lastSlice < 2.2 ? S.chain + 1 : 1; S.lastSlice = g.t;
    const frenzy = S.frenzy > 0;
    g.wordDone(f.typer, f.x, f.y - f.r - 30, { bonus: (frenzy ? 2 : 1) * (boss ? 3 : 1), color: frenzy ? C.gold : '#fff' });
    S.sliced++; S.resolved++;
    S.mercy = Math.max(0, S.mercy - 0.03);
    if (S.chain >= 2) chainReward(g, f);

    if (f.type === 'golden') startFrenzy(g, f);
    else if (f.type === 'ice') startIce(g, f);
    else if (boss) bossDown(g, f);
  }
  function chainReward(g, f) {
    const c = S.chain, names = ['', '', 'Egg Nigiri!', 'Salmon Nigiri!', 'Maki Roll!', 'Roe Maki!', 'SUSHI PLATTER!'];
    const icons = ['', '', ['sushi-egg'], ['sushi-salmon'], ['maki-salmon'], ['maki-roe'], ['sushi-egg', 'sushi-salmon', 'maki-salmon', 'maki-roe', 'maki-vegetable']];
    const i = Math.min(6, c), bonus = 20 * c * (S.frenzy > 0 ? 2 : 1);
    g.score.add(bonus);
    addBanner(g, `${names[i]}  x${c}`, `Combo bonus +${bonus}`, icons[i], { life: 1.5 });
    TM.sfx.combo(Math.min(6, c)); WN.snd('combo', { vol: 0.5, rate: 0.85 + c * 0.06 });
    if (c >= 3 && c % 2 === 1 && !REDUCE()) { S.freeze = 0.08; S.slow = 0.55; g.fx.doFlash('#FFFFFF', 0.25); g.fx.shake(14, 0.2); }
    if (c >= 4) for (let k = 0; k < 8; k++) S.parts.push({ type: 'star', x: f.x + U.rand(-80, 80), y: f.y + U.rand(-80, 80), vx: U.rand(-300, 300), vy: U.rand(-500, -100), g: 800, rot: 0, vr: 4, life: 0.8, t: 0, size: U.rand(30, 60), color: '#FFE27A' });
  }
  function startFrenzy(g, f) {
    S.frenzy = 8; S.stormT = 0.4;
    g.fx.doFlash('#FFE9A8', 0.7); g.fx.shake(14, 0.3);
    addBanner(g, 'FRUIT FRENZY!', 'Short words  -  2x points  -  no hearts lost!', ['banana'], { big: true, y: 400, life: 2.2, color: '#FFD23F' });
    WN.snd('frenzy', { vol: 0.8 }); WN.snd('golden', { vol: 0.6, delay: 0.1 }); setMusic('frenzy');
    for (let i = 0; i < 26; i++) S.parts.push({ type: 'star', x: f.x, y: f.y, vx: U.rand(-700, 700), vy: U.rand(-800, 100), g: 600, rot: 0, vr: 3, life: 1.1, t: 0, size: U.rand(30, 70), color: '#FFD23F' });
  }
  function startIce(g, f) {
    S.ice = 6.5;
    g.fx.doFlash('#BFE8FF', 0.6);
    addBanner(g, 'FREEZE!', 'Time slows down...', ['ice'], { big: true, y: 400, life: 2.0, color: '#9BDCFF' });
    WN.snd('freeze', { vol: 0.8 });
    for (let i = 0; i < 22; i++) S.parts.push({ type: 'shard', x: f.x, y: f.y, vx: U.rand(-600, 600), vy: U.rand(-700, 200), g: 1300, rot: U.rand(0, 6), vr: U.rand(-8, 8), life: 1.0, t: 0, size: U.rand(14, 30), color: i % 2 ? '#E6F7FF' : '#7CCBFF' });
  }
  function bossDown(g, f) {
    S.bossesDown++; S.boss = null; S.freeze = 0.12; S.slow = 1.0;
    g.fx.doFlash('#FFFFFF', 0.7); g.fx.confetti(f.x, f.y, 90);
    for (let i = 0; i < 46; i++) {
      const kind = U.pick(WN.NORMAL_KINDS), a = U.rand(-Math.PI * 0.95, -Math.PI * 0.05), sp = U.rand(500, 1300);
      S.parts.push({ type: 'bit', kind, x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 1500, rot: U.rand(0, 6), vr: U.rand(-8, 8), life: U.rand(1.8, 2.8), t: 0, size: U.rand(0.35, 0.6) });
    }
    for (let i = 0; i < 7; i++) addDecal(f.x + U.rand(-420, 420), f.y + U.rand(-260, 260), i % 2 ? '#FF4D6A' : '#8DBE3A', U.rand(200, 380), i < 4);
    WN.snd('split', { vol: 0.9 }); WN.snd('golden', { vol: 0.6, delay: 0.25 });
    const bonus = 250 * S.level; g.score.add(bonus);
    addBanner(g, 'MELON SPLIT!', `Boss bonus +${bonus}` + (S.lives < S.maxLives ? '  -  heart restored!' : ''), ['watermelon'], { big: true, y: 400, life: 2.6, color: '#FF6B7A' });
    if (S.lives < S.maxLives) S.lives++;
    setMusic('main');
  }
  function bombTyped(g, f) {
    f.alive = false; f.dying = true;
    if (S.lock.locked === f) S.lock.release();
    smokePuff(f.x, f.y, 14, '#8FB23A', 1.4);
    WN.snd('poof', { vol: 0.8 }); g.fx.doFlash('#C8E65A', 0.5); g.fx.shake(18, 0.3);
    if (g.demo) return;
    g.score.breakCombo(); S.chain = 0;
    g.fx.pop(f.x, f.y - 80, 'Stinky! Oh no!', { color: '#B7D945', size: 70, life: 1.3 });
    loseHeart(g, f.x, 'The stinky durian got you!');
  }
  function smokePuff(x, y, n, color, big = 1) {
    for (let i = 0; i < n; i++) S.parts.push({ type: 'smoke', x: x + U.rand(-50, 50), y: y + U.rand(-40, 40), vx: U.rand(-90, 90), vy: U.rand(-140, -20), g: -20, rot: U.rand(0, 6), vr: U.rand(-1, 1), life: U.rand(0.9, 1.6), t: 0, size: U.rand(110, 210) * big, color });
  }
  function loseHeart(g, x, why) {
    if (g.demo || g.state !== 'play') return;
    S.lives--; S.lvlMisses++; S.perfect = false; S.mercy = Math.min(0.4, S.mercy + 0.08);
    TM.sfx.hurt(); g.fx.doFlash('#FF5A5F', 0.28); g.fx.shake(14, 0.2);
    if (S.lives <= 0) {
      S.lives = 0;
      g.end({ win: false, title: 'Out of hearts!', sub: `You reached level ${S.level} and sliced ${S.sliced} fruit.`, targetMet: false, stats: [['Fruit sliced', S.sliced], ['Level', S.level]] });
    }
  }

  /* ---------- decals ---------- */
  function addDecal(x, y, color, size, drip) {
    const img = WN.splat(Math.floor(Math.random() * WN.nSplats), color); if (!img) return;
    S.decals.push({ x, y, img, s: size, rot: U.rand(0, 6.28), t: 0, life: U.rand(9, 13), drip: drip ? { dx: U.rand(-0.3, 0.3) * size, len: U.rand(40, 110), w: U.rand(7, 12), color } : null, floor: false });
    if (S.decals.length > 90) S.decals.shift();
  }
  function floorSplat(x, color, size) {
    const img = WN.splat(Math.floor(Math.random() * WN.nSplats), color); if (!img) return;
    S.decals.push({ x, y: FLOOR_HIT + 30, img, s: size, rot: U.rand(0, 6.28), t: 0, life: 8, drip: null, floor: true, sy: 0.45 });
  }

  /* ---------- update ---------- */
  function update(g, dt) {
    S.t += dt;
    const v = g.vw();
    WN.backdrop.update(dt, v, S.frenzy > 0 ? 90 : 0);
    // parallax follows the action a little
    const lk = S.lock.locked, fx = lk ? lk.x : (S.fruits.find((f) => f.alive) || { x: W / 2 }).x;
    S.focus += (fx - S.focus) * Math.min(1, dt * 1.5);
    S.px = U.clamp((W / 2 - S.focus) * 0.05, -60, 60);
    const playing = g.state === 'play';
    if (S.lockWarn > 0) S.lockWarn -= dt;

    // time scale: freeze fruit / combo slow-mo / hit-stop
    let target = 1; if (S.ice > 0) target = 0.5; if (S.slow > 0) target = Math.min(target, 0.3);
    S.ts += (target - S.ts) * Math.min(1, dt * 9);
    let wdt = dt * S.ts;
    if (S.freeze > 0) { S.freeze -= dt; wdt = 0; }
    if (S.slow > 0) S.slow -= dt;
    if (playing || g.demo) {
      if (S.ice > 0) S.ice = Math.max(0, S.ice - dt);
      if (S.frenzy > 0) { S.frenzy -= dt; if (S.frenzy <= 0) { S.frenzy = 0; setMusic(S.boss ? 'boss' : 'main'); } }
    }
    if (S.ice > 0 && Math.random() < dt * 22) S.parts.push({ type: 'snow', x: U.rand(v.x, v.x + v.w), y: v.y - 20, vx: U.rand(-30, 30), vy: U.rand(80, 170), g: 0, rot: 0, vr: 2, life: 6, t: 0, size: U.rand(10, 26), color: '#FFFFFF' });

    if (g.demo) demoUpdate(g, wdt, dt); else if (g.live) levelUpdate(g, wdt, dt);

    // queued spawns
    if (!g.demo) for (let i = S.queue.length - 1; i >= 0; i--) {
      const q = S.queue[i]; q.t -= wdt;
      if (q.t <= 0) { S.queue.splice(i, 1); if (g.live) spawnOne(g, q.o); }
    }
    moveFruits(g, wdt, dt);
    for (const h of S.halves) { h.t += wdt; h.vy += h.g * wdt; h.x += h.vx * wdt; h.y += h.vy * wdt; h.rot += h.vr * wdt; }
    S.halves = S.halves.filter((h) => h.y < v.y + v.h + 400);
    for (const tr of S.trails) tr.t += dt;
    S.trails = S.trails.filter((tr) => tr.t < tr.life);
    for (const d of S.decals) d.t += dt;
    S.decals = S.decals.filter((d) => d.t < d.life);
    const pd = dt * (0.55 + 0.45 * S.ts);
    for (const p of S.parts) {
      p.t += pd; p.vy += p.g * pd; p.x += p.vx * pd; p.y += p.vy * pd; p.rot += p.vr * pd;
      if (p.type === 'drop') { p.vx *= 0.995; }
    }
    S.parts = S.parts.filter((p) => p.t < p.life);
    if (S.parts.length > 700) S.parts.splice(0, S.parts.length - 700);
    for (const b of S.banners) b.t += dt;
    S.banners = S.banners.filter((b) => b.t < b.life);
  }

  function moveFruits(g, wdt, dt) {
    const v = g.vw();
    for (const f of S.fruits) {
      if (!f.alive) continue;
      f.hit = Math.max(0, f.hit - dt * 5);
      f.typer.shake = Math.max(0, f.typer.shake - dt * 4);
      if (f.type === 'boss') { moveBoss(g, f, wdt, dt); continue; }
      f.vy += f.g * wdt; f.x += f.vx * wdt; f.y += f.vy * wdt; f.rot += f.vr * wdt;
      if (f.vy > 0 && f.y > FLOOR_HIT) landed(g, f);
    }
    S.fruits = S.fruits.filter((f) => f.alive);
  }
  function landed(g, f) {
    f.alive = false;
    if (S.lock.locked === f) S.lock.release();
    const K = WN.kinds[f.kind];
    if (f.type === 'bomb') {
      smokePuff(f.x, FLOOR_HIT - 30, 9, '#9CC043', 1.0); WN.snd('poof', { vol: 0.45, rate: 1.1 });
      if (!g.demo && g.state === 'play') { g.score.add(20); g.fx.pop(f.x, FLOOR_HIT - 190, 'Phew! Good ninja +20', { color: '#B7F26A', size: 44, life: 1.3 }); }
      return;
    }
    // squashed on the floor
    floorSplat(f.x, K.juice, f.size * 1.2);
    for (let i = 0; i < 8; i++) S.parts.push({ type: 'drop', x: f.x, y: FLOOR_HIT, vx: U.rand(-300, 300), vy: U.rand(-450, -120), g: 1500, rot: 0, vr: 0, life: U.rand(0.4, 0.8), t: 0, size: U.rand(5, 12), color: K.juice });
    WN.sndPick(['squelch1', 'squelch2'], { vol: 0.4, rate: 0.8 });
    if (g.demo || g.state !== 'play') return;
    if (f.type === 'golden' || f.type === 'ice') { g.fx.pop(f.x, FLOOR_HIT - 200, 'It got away!', { color: '#fff', size: 44, life: 1.1 }); S.resolved++; return; }
    S.resolved++;
    if (window.__wndbg) console.log('MISS', f.item.t, f.item.len, 'T', f.T && f.T.toFixed(1), 'life', (S.t - f.born).toFixed(1), 'prog', f.typer.progress.toFixed(2), 'alive', S.fruits.length);
    g.missWord(f.item);
    if (f.free || S.frenzy > 0) { g.fx.pop(f.x, FLOOR_HIT - 190, 'Splat!', { color: '#fff', size: 44, life: 0.9 }); return; }
    g.fx.pop(f.x, FLOOR_HIT - 190, 'Splat!  -1 heart', { color: C.miss, size: 50, life: 1.2 });
    loseHeart(g, f.x);
  }
  function moveBoss(g, f, wdt, dt) {
    const v = g.vw(), y0 = Math.max(H, v.y + v.h) + 330;
    f.st += wdt;
    if (f.state === 'enter') {
      const k = Math.min(1, f.st / 1.5), e = U.ease.outCubic(k);
      f.y = U.lerp(y0, f.hy, e); f.x = W / 2; f.rot = (1 - k) * 0.8;
      if (k >= 1) { f.state = 'hover'; f.st = 0; g.fx.shake(REDUCE() ? 0 : 18, 0.3); WN.snd('thud', { vol: 0.7, rate: 1.0 }); }
    } else if (f.state === 'hover') {
      f.x = W / 2 + Math.sin(f.st * 0.7) * 70; f.y = f.hy + Math.sin(f.st * 1.4) * 20; f.rot = Math.sin(f.st * 0.9) * 0.07;
      if (g.state === 'play' && !g.demo) f.left -= wdt;
      // crack stages while typing
      const stg = Math.floor(f.typer.progress * 4);
      if (stg > f.crack) {
        f.crack = stg; g.fx.shake(REDUCE() ? 0 : 12, 0.18); WN.snd('crack', { vol: 0.65, rate: 0.9 + stg * 0.1 });
        for (let i = 0; i < 10; i++) S.parts.push({ type: 'drop', x: f.x + U.rand(-120, 120), y: f.y + U.rand(-80, 80), vx: U.rand(-500, 500), vy: U.rand(-600, -100), g: 1500, rot: 0, vr: 0, life: U.rand(0.6, 1.0), t: 0, size: U.rand(6, 14), color: i % 3 ? '#FF4D6A' : '#2A1D2A' });
        addDecal(f.x + U.rand(-250, 250), f.y + U.rand(-150, 150), '#FF4D6A', U.rand(120, 200), true);
      }
      if (f.left <= 0 && g.state === 'play') { f.state = 'fall'; f.st = 0; f.vy = 0; if (S.lock.locked === f) S.lock.release(); f.locked = false; }
    } else if (f.state === 'fall') {
      f.vy += 1500 * wdt; f.y += f.vy * wdt; f.rot += 1.5 * wdt; f.x += 0;
      if (f.y > FLOOR_HIT + 60) {
        f.alive = false; S.boss = null; floorSplat(f.x, '#FF4D6A', 560); floorSplat(f.x - 160, '#8DBE3A', 300); g.fx.shake(24, 0.4); WN.snd('thud', { vol: 0.9, rate: 0.7 });
        smokePuff(f.x, FLOOR_HIT, 8, '#F7E9C6', 1.4);
        S.resolved++; g.missWord(f.item);
        g.fx.pop(f.x, FLOOR_HIT - 260, 'The melon got away!', { color: C.miss, size: 56, life: 1.6 });
        loseHeart(g, f.x); setMusic('main');
      }
    }
  }

  function demoUpdate(g, wdt, dt) {
    S.demoT -= wdt;
    const n = aliveFruits().length;
    if (S.demoT <= 0 && n < 3) {
      const item = g.dealer.next({ kind: 'word', maxLen: 5, avoidFirst: S.lock.firstLetters(S.fruits) });
      const left = Math.random() < 0.5, xa = left ? U.rand(220, 560) : U.rand(1360, 1700);
      newFruit(g, { item, T: airtime(g, item.len), x0: xa + U.rand(-120, 120), xa, apex: U.rand(520, 720), type: 'fruit' });
      S.demoT = U.rand(1.0, 1.9);
    }
    S.botDelay -= wdt;
    const t = S.lock.locked || S.fruits.filter((f) => f.alive && f.vy > -150 && f.y < 900).sort((a, b) => b.y - a.y)[0];
    if (t && S.botDelay <= 0) S.bot.step(dt, t.typer, (r) => { if (!S.lock.locked && r !== 'done') { S.lock.locked = t; t.locked = true; } if (r === 'done') { S.lock.release(); slice(g, t); } });
  }

  function levelUpdate(g, wdt, dt) {
    if (S.needBanner) {
      S.needBanner = false;
      const tier = g.ladder(stage()).tier;
      addBanner(g, `LEVEL ${S.level}`, tier === 1 ? 'Warm-up words' : tier === 2 ? 'Longer words and phrases' : 'Phrases and sentences', null, { big: true, y: 420, life: 2.3, color: '#FFD23F' });
      TM.sfx.whoosh();
    }
    S.phaseT += dt;
    const alive = realAlive();
    // frenzy storm
    if (S.frenzy > 0) {
      S.stormT -= wdt;
      if (S.stormT <= 0 && alive < 8) {
        S.stormT = U.rand(0.5, 0.8);
        const n = U.randi(2, 3), x0 = U.rand(500, 1400), cx = U.rand(700, 1200);
        for (let i = 0; i < n; i++) { const it = pickItem(g, { maxLen: 4 }); newFruit(g, { item: it, T: airtime(g, it.len, { extra: i * 0.7, mul: 1.1 }), x0, xa: U.clamp(cx + (i - (n - 1) / 2) * 280, 280, 1640), apex: U.rand(380, 520), free: true }); }
      }
    }
    switch (S.phase) {
      case 'intro':
        if (S.phaseT > 2.3) { S.phase = 'waves'; S.phaseT = 0; }
        break;
      case 'waves': {
        if (S.frenzy > 0) break;
        if (S.waveIdx < S.waves.length) {
          S.waveWait -= wdt;
          const w = S.waves[S.waveIdx];
          const free = alive === 0 && S.queue.length === 0;
          if (free && S.waveWait > 0.5) S.waveWait = 0.5;
          if (S.waveWait <= 0 && (free || loadSec() + waveEst(w) < 4.6 + S.level * 0.35) && alive + S.queue.length + w.n <= capFor(g) + (w.n === 0 ? 3 : 0) + (alive === 0 ? 9 : 0)) {
            launchWave(g, w); S.waveIdx++;
            const gap = Math.max(1.2, 3.3 - 0.25 * S.level) * (g.diff === 'gentle' ? 1.3 : g.diff === 'turbo' ? 0.8 : 1);
            S.waveWait = gap;
          }
        } else if (S.queue.length === 0 && alive === 0 && !S.fruits.some((f) => f.alive && f.type !== 'bomb')) {
          if (S.bosses.includes(S.level)) { S.phase = 'bossIntro'; S.phaseT = 0; addBanner(g, 'WATCH OUT!', 'A giant watermelon is coming!', ['watermelon'], { big: true, y: 420, life: 2.4, color: '#FF6B7A' }); WN.snd('thud', { vol: 0.6, rate: 0.6 }); setMusic('boss'); }
          else { S.phase = 'clear'; S.phaseT = 0; levelClear(g); }
        }
        break;
      }
      case 'bossIntro':
        if (S.phaseT > 2.6) { spawnBoss(g); S.phase = 'boss'; S.phaseT = 0; }
        break;
      case 'boss':
        if (!S.boss && S.phaseT > 0.6 && !S.halves.length) { S.phase = 'clear'; S.phaseT = 0; levelClear(g); }
        break;
      case 'clear':
        if (S.phaseT > 3.0) {
          if (S.level >= S.maxLevel) {
            S.phase = 'won';
            g.fx.confetti(W / 2, 400, 90);
            g.end({ win: true, title: 'Word Ninja Master!', sub: `You cleared all ${S.maxLevel} levels and sliced ${S.sliced} fruit!`, targetMet: true, stats: [['Fruit sliced', S.sliced], ['Melons split', S.bossesDown]], delay: 1800 });
          } else startLevel(g, S.level + 1);
        }
        break;
    }
  }
  function waveEst(w) { return (w.n === 0 ? 2 : w.n * 5) * U.clamp(S.pace * 1.1, 0.3, 1.0); }
  function loadSec() { let n = 0; for (const f of S.fruits) if (f.alive && (f.type === 'fruit' || f.type === 'boss')) n += f.typer.item.len * (1 - f.typer.progress); for (const q of S.queue) n += 5; return n * U.clamp(S.pace * 1.1, 0.3, 1.0); }
  function levelClear(g) {
    const bonus = 100 * S.level + (S.perfect ? 200 : 0);
    g.score.add(bonus);
    const final = S.level >= S.maxLevel;
    addBanner(g, final ? 'DOJO CLEARED!' : `LEVEL ${S.level} CLEAR!`, `Bonus +${bonus}` + (S.perfect ? '  -  PERFECT!' : ''), S.perfect ? ['sushi-salmon', 'sushi-egg'] : ['sushi-egg'], { big: true, y: 420, life: 2.8, color: '#7CE38B' });
    g.fx.confetti(W / 2, 560, 50); WN.snd('golden', { vol: 0.7 }); TM.sfx.win();
    if (S.lives < S.maxLives && S.perfect) { S.lives++; }
  }

  /* ---------- drawing ---------- */
  function drawRing(ctx, f, t) {
    const r = f.r * 1.45 + 6 + Math.sin(t * 6) * 4;
    ctx.save(); ctx.translate(f.x, f.y);
    const flare = WN.img('flare_01');
    if (flare) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.65; ctx.drawImage(flare, -r * 1.6, -r * 1.6, r * 3.2, r * 3.2); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    const col = f.type === 'bomb' ? '#E9A6FF' : '#8EE6FF';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(31,26,61,0.55)'; ctx.lineWidth = 12; ctx.setLineDash([26, 18]); ctx.lineDashOffset = -t * 90;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.stroke();
    ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r - 16, 0, 7); ctx.stroke();
    // corner brackets
    ctx.rotate(t * 0.8); ctx.strokeStyle = '#fff'; ctx.lineWidth = 7;
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.arc(0, 0, r + 14, -0.22, 0.22); ctx.stroke(); }
    ctx.restore();
  }
  function drawBombFace(ctx, f, t) {
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot * 0.35);
    const s = f.size / 190;
    ctx.scale(s, s);
    D.eyes(ctx, 0, -8, 22, f.locked ? 'wide' : 'grumpy', 0, 0, 1.05);
    D.mouth(ctx, 0, 44, 24, f.locked ? 'o' : 'frown');
    // sweat drop
    ctx.fillStyle = '#BFE6FF'; ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(50, -50); ctx.quadraticCurveTo(66, -22, 50, -16); ctx.quadraticCurveTo(34, -22, 50, -50); ctx.fill(); ctx.stroke();
    ctx.restore();
    // wavy stink lines
    ctx.save(); ctx.translate(f.x, f.y - f.size * 0.45); ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const ph = t * 3 + i * 1.3;
      ctx.strokeStyle = i === 0 ? 'rgba(160,220,60,0.85)' : 'rgba(170,110,230,0.8)'; ctx.lineWidth = 7;
      ctx.beginPath(); for (let k = 0; k <= 10; k++) { const yy = -k * 9, xx = i * 34 + Math.sin(ph + k * 0.7) * 9; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke();
    }
    // fuse
    ctx.restore();
  }
  function drawBossFace(ctx, f, t) {
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
    const prog = f.typer.progress, mood = f.hit > 0.4 ? 'wide' : 'grumpy';
    // ninja headband
    ctx.fillStyle = '#1F3FA8'; ctx.strokeStyle = C.ink; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-196, -88); ctx.quadraticCurveTo(0, -128, 196, -88); ctx.lineTo(196, -34); ctx.quadraticCurveTo(0, -74, -196, -34); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#C9D4E8'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-52, -104, 104, 52, 10) : ctx.rect(-52, -104, 104, 52); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1F3FA8'; ctx.font = '800 40px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(0, -92); ctx.lineTo(20, -78); ctx.lineTo(0, -64); ctx.lineTo(-20, -78); ctx.closePath(); ctx.fill();
    // tails
    for (const sgn of [1, -1]) { ctx.fillStyle = '#1F3FA8'; ctx.beginPath(); const w1 = Math.sin(t * 5 + sgn) * 14; ctx.moveTo(sgn * 190, -70); ctx.quadraticCurveTo(sgn * 250, -70 + w1, sgn * 290, -40 + w1 * 2); ctx.lineTo(sgn * 270, -10 + w1 * 2); ctx.quadraticCurveTo(sgn * 230, -40 + w1, sgn * 188, -46); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    D.eyes(ctx, 0, 6, 26, mood, 0, 0, 1.45);
    D.mouth(ctx, 0, 96, 28, prog > 0.5 ? 'o' : 'grin');
    D.cheeks(ctx, 0, 36, 26, 1.45);
    // cracks
    if (f.crack > 0) {
      ctx.strokeStyle = '#2A1D2A'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const paths = [[[-30, -160], [-10, -110], [-48, -70], [-20, -30]], [[110, 120], [70, 70], [112, 30], [74, -10]], [[-120, 100], [-70, 60], [-96, 10]], [[40, 190], [20, 140], [58, 112]]];
      for (let i = 0; i < Math.min(4, f.crack); i++) { ctx.beginPath(); paths[i].forEach((p, j) => (j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }
      ctx.strokeStyle = '#FF6B7A'; ctx.lineWidth = 3;
      for (let i = 0; i < Math.min(4, f.crack); i++) { ctx.beginPath(); paths[i].forEach((p, j) => (j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }
    }
    ctx.restore();
  }
  function drawFruit(g, ctx, f) {
    const t = S.t;
    if (f.type === 'golden') {
      const fl = WN.img('flare_01');
      if (fl) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7 + Math.sin(t * 9) * 0.2; const r = f.size * 1.2; ctx.translate(f.x, f.y); ctx.rotate(t); ctx.drawImage(fl, -r, -r, r * 2, r * 2); ctx.restore(); }
    } else if (f.type === 'ice') {
      const fl = WN.img('flare_01');
      if (fl) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55; const r = f.size * 1.0; ctx.drawImage(WN.tinted('flare_01', '#7CCBFF') || fl, f.x - r, f.y - r, r * 2, r * 2); ctx.restore(); }
    } else if (f.type === 'bomb') {
      const fl = WN.tinted('flare_01', '#B4E14A');
      if (fl) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + Math.sin(t * 6) * 0.1; const r = f.size * 0.95; ctx.drawImage(fl, f.x - r, f.y - r, r * 2, r * 2); ctx.restore(); }
    }
    // soft shadow on the floor as the fruit comes down
    const sc = 1 + f.hit * 0.12 + (f.type === 'boss' ? 0 : 0);
    WN.drawKind(ctx, f.kind, f.x, f.y, f.rot, sc * (f.type === 'boss' ? 1 : 1));
    if (f.type === 'bomb') drawBombFace(ctx, f, t);
    if (f.type === 'boss') drawBossFace(ctx, f, t);
    if (f.type === 'golden' || f.type === 'ice') {
      const st = WN.tinted('star_04', f.type === 'golden' ? '#FFE27A' : '#DFF4FF');
      if (st) for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1, rr = f.size * 0.6, s = 36 + Math.sin(t * 8 + i * 2) * 16; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(st, f.x + Math.cos(a) * rr - s, f.y + Math.sin(a) * rr * 0.7 - s, s * 2, s * 2); ctx.restore(); }
    }
  }
  function chipFor(g, ctx, f, v) {
    const lad = f.type === 'boss' ? 36 : f.item.kind === 'sentence' ? 42 : (S.level <= 2 ? 52 : 48);
    const sz = D.chipSize(ctx, f.typer, lad);
    const cx = U.clamp(f.x, v.x + sz.w / 2 + 16, v.x + v.w - sz.w / 2 - 16);
    let cy;
    if (f.type === 'boss') cy = f.y + f.r + 78; else cy = f.y - f.r - 52 - (g.hint ? 20 : 0);
    cy = Math.max(cy, hudBottom(g) + 44 + (g.hint ? 18 : 0));
    return { f, size: lad, w: sz.w, h: sz.h, cx, cy };
  }
  function draw(g, ctx) {
    const v = g.vw(), t = S.t;
    const env = { t, px: S.px, glow: S.frenzy > 0 ? Math.min(1, S.frenzy) : 0, ice: S.ice > 0 ? Math.min(1, S.ice) : 0 };
    WN.backdrop.drawBack(ctx, v, env);
    // juice splats on the dojo wall/floor
    for (const d of S.decals) {
      const k = d.t / d.life, a = Math.min(1, d.t * 7) * (k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1) * 0.78;
      const grow = U.ease.outBack(Math.min(1, d.t * 5));
      ctx.save(); ctx.globalAlpha = a; ctx.translate(d.x, d.y); ctx.rotate(d.rot); if (d.floor) ctx.scale(1, d.sy);
      const s = d.s * grow; ctx.drawImage(d.img, -s / 2, -s / 2, s, s); ctx.restore();
      if (d.drip) {
        const L = Math.min(1, d.t / 2.2) * d.drip.len, dx = d.x + d.drip.dx;
        ctx.save(); ctx.globalAlpha = a * 0.9; ctx.fillStyle = d.drip.color; ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(dx - d.drip.w / 2, d.y + d.s * 0.12, d.drip.w, L, d.drip.w / 2) : ctx.rect(dx - d.drip.w / 2, d.y + d.s * 0.12, d.drip.w, L); ctx.fill();
        ctx.beginPath(); ctx.arc(dx, d.y + d.s * 0.12 + L, d.drip.w * 0.85, 0, 7); ctx.fill(); ctx.restore();
      }
    }
    WN.backdrop.drawLanterns(ctx, v, env);
    WN.backdrop.drawPetals(ctx, v, false);
    // halves
    for (const h of S.halves) {
      const cv = WN.halfCanvas(h.kind, h.q, h.side); if (!cv) continue;
      const K = WN.kinds[h.kind], s = (K.size * h.sc) / Math.max(K.img.width, K.img.height);
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot); ctx.drawImage(cv, -cv.width * s / 2, -cv.height * s / 2, cv.width * s, cv.height * s); ctx.restore();
    }
    for (const f of S.fruits) if (f.alive) drawFruit(g, ctx, f);
    WN.backdrop.drawPetals(ctx, v, true);
    WN.backdrop.drawVignette(ctx, v, env);
    // lock rings
    for (const f of S.fruits) if (f.alive && f.locked) drawRing(ctx, f, t);
    // boss timer
    const B = S.boss;
    if (B && B.alive && B.state === 'hover') {
      const k = U.clamp(B.left / B.hover, 0, 1), bw = 560, bx = B.x - bw / 2, by = B.y - B.r - 60;
      D.pill(ctx, bx - 6, by - 6, bw + 12, 34, C.ink);
      D.pill(ctx, bx, by, Math.max(26, bw * k), 22, k > 0.3 ? '#7CE38B' : C.miss);
      D.text(ctx, 'Split the melon before time runs out!', B.x, by - 34, { size: 30, color: '#fff', outline: 8 });
    }
    // chips (most urgent on top; locked on very top; others dim while locked)
    const chips = [];
    for (const f of S.fruits) { if (!f.alive || f.y > v.y + v.h + 60) continue; chips.push(chipFor(g, ctx, f, v)); }
    for (let pass = 0; pass < 3; pass++) for (let i = 0; i < chips.length; i++) for (let j = i + 1; j < chips.length; j++) {
      const a = chips[i], b = chips[j];
      const ox = (a.w + b.w) / 2 + 10 - Math.abs(a.cx - b.cx), oy = (a.h + b.h) / 2 + (g.hint ? 34 : 6) - Math.abs(a.cy - b.cy);
      if (ox > 0 && oy > 0) { const lower = a.f.locked ? b : b.f.locked ? a : (a.cy > b.cy ? b : a); lower.cy -= oy * (a.cy === b.cy ? 1 : 1); if (lower.cy < hudBottom(g) + 30) lower.cy = Math.min(a.cy, b.cy) + oy + 4; }
    }
    chips.sort((a, b) => (a.f.locked ? 1 : 0) - (b.f.locked ? 1 : 0) || a.cy - b.cy);
    const lockedF = S.lock.locked;
    for (const c of chips) {
      const f = c.f, bomb = f.type === 'bomb';
      const danger = !bomb && f.type !== 'boss' && f.vy > 0 && f.y > FLOOR_HIT - 330;
      if (danger) { const pulse = 0.5 + 0.5 * Math.sin(t * 14); ctx.save(); ctx.globalAlpha = 0.35 + 0.4 * pulse; ctx.strokeStyle = C.miss; ctx.lineWidth = 12; ctx.stroke(P.rr(c.cx - c.w / 2 - 8, c.cy - c.h / 2 - 8, c.w + 16, c.h + 16, c.h / 2 + 8)); ctx.restore(); }
      D.chip(ctx, c.cx, c.cy, f.typer, { size: c.size, accent: bomb ? BOMB_ACCENT : f.type === 'golden' ? '#D98A00' : ACCENT, locked: f.locked, hint: g.hint, dim: !!lockedF && lockedF !== f });
      if (bomb) {
        const lbl = f.locked ? 'STOP! Backspace!' : "Don't type!";
        ctx.save(); const wd = lbl.length * 14 + 40; D.pill(ctx, c.cx - wd / 2, c.cy - c.h / 2 - 40, wd, 34, f.locked ? C.miss : BOMB_ACCENT, { stroke: C.ink, lw: 4 }); ctx.restore();
        D.text(ctx, lbl, c.cx, c.cy - c.h / 2 - 23, { size: 24, color: '#fff' });
      } else if (f.type === 'golden' || f.type === 'ice') {
        const lbl = f.type === 'golden' ? 'FRENZY!' : 'FREEZE!', wd = lbl.length * 15 + 36;
        D.pill(ctx, c.cx - wd / 2, c.cy - c.h / 2 - 38, wd, 32, f.type === 'golden' ? '#E39A00' : '#2C8AD8', { stroke: C.ink, lw: 4 });
        D.text(ctx, lbl, c.cx, c.cy - c.h / 2 - 22, { size: 22, color: '#fff' });
      }
    }
    // blade trails
    for (const tr of S.trails) drawTrail(ctx, tr);
    drawParts(ctx);
    g.fx.draw(ctx);
    drawMeters(g, ctx, v);
    for (const b of S.banners) drawBanner(ctx, b, v);
  }
  function drawTrail(ctx, tr) {
    const k = tr.t / tr.life, head = Math.min(1, tr.t / 0.09), fade = 1 - U.ease.outCubic(k);
    const c = Math.cos(tr.th), s = Math.sin(tr.th), hl = tr.len / 2;
    const x0 = tr.x - c * hl, y0 = tr.y - s * hl, x1 = tr.x + c * hl * (head * 2 - 1), y1 = tr.y + s * hl * (head * 2 - 1);
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, nx = -s, ny = c, wd = tr.w * (1 - k * 0.6);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade;
    const pass = (w, col) => {
      const gr = ctx.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, col);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx + nx * w, my + ny * w, x1, y1); ctx.quadraticCurveTo(mx - nx * w, my - ny * w, x0, y0); ctx.fill();
    };
    pass(wd * 1.5, U.hexA(tr.color, 0.55)); pass(wd * 0.85, 'rgba(255,255,255,0.8)'); pass(wd * 0.35, 'rgba(255,255,255,1)');
    const st = WN.img('star_04');
    if (st && head < 1 || (st && k < 0.5)) { const sz = 150 * (1 - k); ctx.drawImage(st, x1 - sz, y1 - sz, sz * 2, sz * 2); }
    ctx.restore();
  }
  function drawParts(ctx) {
    for (const p of S.parts) {
      const k = p.t / p.life;
      if (p.type === 'drop') {
        const sp = Math.hypot(p.vx, p.vy), a = Math.atan2(p.vy, p.vx), len = p.size * (1 + Math.min(2.2, sp / 450));
        ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, len, p.size * 0.7, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-len * 0.25, -p.size * 0.25, len * 0.3, p.size * 0.2, 0, 0, 7); ctx.fill(); ctx.restore();
      } else if (p.type === 'flare') {
        const im = WN.img('flare_01'); if (!im) continue; const s = p.size * (0.5 + k);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k; ctx.drawImage(im, p.x - s / 2, p.y - s / 2, s, s); ctx.restore();
      } else if (p.type === 'star') {
        const im = WN.tinted('star_04', p.color) || WN.img('star_04'); if (!im) continue; const s = p.size * (1 - k * 0.5);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.drawImage(im, -s, -s, s * 2, s * 2); ctx.restore();
      } else if (p.type === 'smoke') {
        const im = WN.tinted('smoke_05', p.color); if (!im) continue; const s = p.size * (0.6 + k * 0.9);
        ctx.save(); ctx.globalAlpha = 0.8 * (1 - k); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.drawImage(im, -s / 2, -s / 2, s, s); ctx.restore();
      } else if (p.type === 'bit') {
        ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 3); WN.drawKind(ctx, p.kind, p.x, p.y, p.rot, p.size); ctx.restore();
      } else if (p.type === 'shard') {
        ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.strokeStyle = '#2C6FA8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.size, 0); ctx.lineTo(-p.size * 0.5, p.size * 0.55); ctx.lineTo(-p.size * 0.3, -p.size * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      } else if (p.type === 'snow') {
        const im = WN.img('star_04'); if (!im) continue; ctx.save(); ctx.globalAlpha = 0.8 * Math.min(1, (1 - k) * 4); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.drawImage(im, -p.size, -p.size, p.size * 2, p.size * 2); ctx.restore();
      }
    }
  }
  function meter(ctx, cx, y, w, k, label, col, icon) {
    D.pill(ctx, cx - w / 2 - 6, y - 6, w + 12, 40, C.ink);
    D.pill(ctx, cx - w / 2, y, Math.max(28, w * k), 28, col);
    D.text(ctx, label, cx, y + 15, { size: 26, color: '#fff', outline: 7 });
  }
  function drawMeters(g, ctx, v) {
    let y = hudBottom(g) + 6; const cx = W / 2;
    if (S.frenzy > 0) { meter(ctx, cx, y, 520, S.frenzy / 8, 'FRENZY  x2 points', '#E39A00'); y += 52; }
    if (S.ice > 0) { meter(ctx, cx, y, 520, S.ice / 6.5, 'FREEZE', '#2C8AD8'); y += 52; }
  }
  function drawBanner(ctx, b, v) {
    const k = b.t / b.life, inK = Math.min(1, b.t / 0.28), outK = k > 0.75 ? (k - 0.75) / 0.25 : 0;
    const e = U.ease.outBack(inK), al = 1 - outK;
    const size = b.big ? 100 : 64;
    ctx.save(); ctx.font = D.FONT_DISPLAY(size); const tw = ctx.measureText(b.text).width; ctx.restore();
    ctx.font = D.FONT_DISPLAY(size * 0.42);
    const icons = b.icons.map((n) => WN.kinds[n] ? WN.kinds[n].img : WN.img(n)).filter(Boolean);
    const isz = b.big ? 120 : 84;
    const w = Math.max(tw, 300) + 120 + (icons.length ? 2 * (isz + 40) : 0), h = size * 1.5 + (b.sub ? 40 : 0);
    ctx.save(); ctx.globalAlpha = al; ctx.translate(W / 2, b.y - outK * 40); ctx.scale(e, e * (0.7 + 0.3 * e));
    // paper scroll strip
    const path = P.rr(-w / 2, -h / 2, w, h, 26);
    ctx.fillStyle = 'rgba(31,26,61,0.28)'; ctx.save(); ctx.translate(0, 10); ctx.fill(path); ctx.restore();
    const gr = ctx.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, '#FFF6DC'); gr.addColorStop(1, '#F5DDA6');
    ctx.fillStyle = gr; ctx.fill(path); ctx.lineWidth = 7; ctx.strokeStyle = C.ink; ctx.stroke(path);
    ctx.fillStyle = '#C8372D'; ctx.fill(P.rr(-w / 2 + 12, -h / 2 + 12, 16, h - 24, 8)); ctx.fill(P.rr(w / 2 - 28, -h / 2 + 12, 16, h - 24, 8));
    // icons
    const n = Math.min(icons.length, 2);
    if (n) { const im = icons[0], s = isz / Math.max(im.width, im.height); ctx.drawImage(im, -w / 2 + 52, -im.height * s / 2 - 6, im.width * s, im.height * s); const im2 = icons[icons.length - 1], s2 = isz / Math.max(im2.width, im2.height); ctx.drawImage(im2, w / 2 - 52 - im2.width * s2, -im2.height * s2 / 2 - 6, im2.width * s2, im2.height * s2); }
    D.text(ctx, b.text, 0, b.sub ? -22 : 0, { size, color: b.color, outline: 14 });
    if (b.sub) D.text(ctx, b.sub, 0, h / 2 - 34, { size: size * 0.36, color: C.ink });
    ctx.restore();
  }

  WN._S = () => S;
  WN._spawn = (o) => spawnOne(TM.current, o);
  /* ---------- game ---------- */
  TM.game({
    id: 'word-ninja', name: 'Word Ninja', accent: ACCENT, bg: '#2A170B',
    logoHTML: 'Word<br>Ninja', tagline: 'Type the words to slice the fruit!',
    lifeIcon: TM.ui.heartSVG('#FF5A6E'),
    howto: [
      'Fruit flies through the dojo. Each fruit carries a <b>word</b>. Type it to <b>slice</b> the fruit!',
      'The first letter you type <b>locks on</b> to a fruit. Backspace lets go.',
      'Slice quickly one after another for a sushi <b>combo</b>: Nigiri, Maki, Sushi Platter!',
      'Fruit that hits the floor costs a <b>heart</b>. A purple <b>stinky durian</b> says "Don\'t type!" - just leave it alone.',
      'The <b>golden banana</b> starts a Fruit Frenzy (2x points). The <b>frost pear</b> slows time.',
      'At the end of some levels a <b>giant watermelon</b> carries a whole sentence. Type it to split it open!',
    ],
    music: mMain,
    init(g) { WN.backdrop.init(); WN.load(); },
    reset, update, draw, onKey, onBack,
    nextKey: () => { const t = S.lock.locked || S.fruits.filter((f) => f.alive && f.type !== 'bomb').sort((a, b) => b.danger - a.danger)[0]; return t ? t.typer.nextReq() : null; },
    hud: (g) => ({ lives: S.lives, maxLives: S.maxLives, right: `Level ${S.level}/${S.maxLevel}`, progress: S.total ? S.resolved / S.total : 0 }),
  });
})();
