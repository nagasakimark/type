/* Star Sweep - ZType-style typing space shooter. Lock on to a ship by typing its first letter; every letter fires a laser.
   Sectors, waves, many enemy types, bosses with sentence health bars, power-ups, parallax space, Kenney art + sound. */
(function () {
  'use strict';
  const TM = window.TM, SS = window.SS, C = TM.C, U = TM.U, D = TM.draw, P = D.P;
  const W = 1920, H = 1080, SX = W / 2;
  const rnd = U.rand, clamp = U.clamp, lerp = U.lerp;
  const JF = '"Hiragino Maru Gothic ProN", "BIZ UDGothic", "Yu Gothic UI", "Meiryo", "Noto Sans CJK JP", sans-serif';
  const KV = (px) => `${px}px KenVector, "Baloo 2", "Arial Rounded MT Bold", ${JF}`;
  const BD = (px, w) => `${w || 800} ${px}px "Baloo 2", "Arial Rounded MT Bold", ${JF}`;
  const BOLTS = [['laserBlue04', '#8fdcff'], ['laserGreen04', '#a6ff9d'], ['laserRed04', '#ff9a9a'], ['laserBlue07', '#fff2a0']];
  const COLNAME = { Black: 'gray', Blue: 'blue', Green: 'green', Red: 'red' };

  let S = null;
  const snd = (name, o) => { SS.snd.play(name, o); };

  /* ---------- field geometry (anchored to the visible area so tall/wide windows are fully used) ---------- */
  function field(g) {
    const v = g.vw(); const top = Math.min(0, v.y), bottom = Math.max(H, v.y + v.h);
    const pxv = v.w / window.innerWidth;
    const kb = TM.settings.keyboard && window.innerWidth > 900 && window.innerHeight > 640;
    const shipY = bottom - 160 - (kb ? 215 * pxv : 0);
    const impactY = shipY - 70, spawnY = top - 170;
    const half = Math.min(v.w / 2 - 150, 2600);
    return { v, top, bottom, pxv, shipY, impactY, spawnY, fs: clamp((impactY - spawnY) / 940, 1, 2.1), xmin: SX - half, xmax: SX + half, wf: Math.max(1, half / 950), hudTop: v.y + 92 * pxv, safeTop: v.y + 92 * pxv + 104 };
  }

  /* ---------- state ---------- */
  function perSectorFor(g) { return g.diff === 'gentle' ? 3 : 4; }
  function reset(g) {
    SS.fx.clear();
    const popFn = (x, y, str, o) => {
      o = o || {};
      if (/^COMBO/.test(str)) { if (S) S.comboFlash = { t: 0, text: str.replace('!', ''), color: o.color || '#ffd23f' }; return; }
      if (S) { if (S.pops.length > 14) S.pops.shift(); S.pops.push({ x, y, str, t: 0, life: o.life || 0.9, color: o.color || C.gold, size: Math.min(o.size || 54, 56), ox: 0, oy: 0 }); }
    };
    S = {
      popFn,
      t: 0, mode: 'fight', sector: 0, wave: 0, perSector: perSectorFor(g), L: 0, plan: null, queue: [], spawnT: 2, uid: 0,
      enemies: [], bolts: [], shots: [], F: null,
      lockT: null, lastFire: { e: null, t: -9 },
      ship: { x: SX, y: 880, rot: 0, slide: 0, recoil: 0, shieldHit: 0, hullHit: 0, hitAng: 0, gunSide: 1, flamePh: 0 },
      shield: 100, hull: 100, shieldDelay: 0, inv: 0, slow: 0, dbl: 0, timeScale: 1, slowmo: 0, pace: 1,
      pulse: 1, flash: { a: 0, c: '#fff' }, banner: null, bq: [], bGap: 0, pops: [], comboFlash: null, audit: null, warp: 0, clearT: 0, map: null, vt: 0, dying: 0, boss: null, bossFx: [],
      puCool: 14, tier: 0, sinceOrb: 0, streakIdx: 0, drones: 0, magnet: 0, timers: [], beams: [], chain: { n: 0, t: 0 }, morph: 0, spin: 0, fireGlow: 0, tierShow: 0, missRun: 0, gen: 0, keyStat: { in: 0, ok: 0, miss: 0, ignored: 0 }, lastKey: null, kills: 0, escaped: 0, hurtVig: 0, comboLostT: 0, lastCombo: 0, mapPlanets: [], victory: null, botT: 0, botRate: 5.5, nextTip: 0,
    };
    g.fx.pop = popFn;
    S.diffSpd = g.diff === 'gentle' ? 0.78 : g.diff === 'turbo' ? 1.25 : 1;
    S.diffDmg = g.diff === 'gentle' ? 0.5 : g.diff === 'turbo' ? 1.35 : 1;
    S.paceMax = g.diff === 'gentle' ? 1.0 : g.diff === 'turbo' ? 1.35 : 1.25;
    if (SS.bg.sector !== 0 || !SS.bg.sec) SS.bg.set(0, true); SS.bg.pipGrow = 0;
    startWave(g);
  }
  const progress01 = () => clamp(S.L / 19, 0, 1);
  const capL = () => 4 + Math.floor(S.L * 0.38);

  /* ---------- banner manager: ONE banner at a time, parked in the strip under the HUD (never over targets) ---------- */
  function banner(b) {
    b.t = 0;
    if (S.banner && S.banner.key === b.key) { S.banner = b; return; }
    if (!S.banner) { S.banner = b; return; }
    S.bq.push(b);
  }
  function updateBanner(dt) {
    if (S.banner) { S.banner.t += dt; if (S.banner.t > S.banner.dur) { S.banner = null; S.bGap = 0.25; } }
    else if (S.bq.length) { if ((S.bGap = (S.bGap || 0) - dt) <= 0) S.banner = S.bq.shift(); }
  }
  /* ---------- one visibility rule: an enemy is "seen" (word chip drawn AND typable, same frame) once its whole sprite is
     below the HUD safe line. Until then it flies in fast and shows no word; once seen it stays seen. ---------- */
  function topEdge(e) { return (e.type === 'ufo' ? e.cy - e.R * 0.5 : e.y) - e.hh - (e.isAce ? 42 : 0); }
  function canType(e) { return e.alive && !e.doomed && e.seen && e.targetable && e.delay <= 0; }
  function clampTop(e, F) {
    if (!e.seen) return;
    const lim = F.safeTop - 2 + e.hh + (e.isAce ? 42 : 0);
    if (e.type === 'ufo') { const m = lim + e.R * 0.5; if (e.cy < m) e.cy = m; if (e.y < lim) e.y = lim; } else if (e.y < lim) e.y = lim;
  }

  /* ---------- waves ---------- */
  /* Full reset of everything that must never leak across a wave / sector boundary: lock-on, partial input, enemies, bolts, enemy shots,
     delayed effects. (v1 bug: a power-up that was locked when the map opened stayed "locked", so the next sector's keystrokes fed a
     ship that no longer existed - nothing seemed to work until that hidden word was finished.) */
  function clearField(g) {
    for (const e of S.enemies) { e.locked = false; if (e.alive && e.type === 'powerup') SS.fx.ring(e.x, e.y, 150, '#ffffff', 0.3); }
    S.lockT = null; S.enemies.length = 0; S.bolts.length = 0; S.shots.length = 0; S.timers.length = 0; S.beams.length = 0;
    S.lastFire = { e: null, t: -9 }; S.missRun = 0; S.gen++; S.boss = null; S.chain = { n: 0, t: 0 };
  }
  function startWave(g) {
    clearField(g);
    const demo = g.demo;
    S.plan = demo ? SS.planWave(0, S.wave % 2, 4, 'normal') : SS.planWave(S.sector, S.wave, S.perSector, g.diff);
    S.L = demo ? S.wave % 3 + 2 : S.plan.L;
    S.queue = S.plan.tokens.slice(); S.spawnT = 2.2; S.mode = 'fight'; S.warp = 1; S.boss = null;
    const sec = SS.SECTORS[S.sector];
    const boss = S.plan.kind === 'boss';
    const title = `ウェーブ ${S.wave + 1}`;
    S.bq.length = 0;
    banner({ key: 'wave', dur: boss ? 3.0 : 2.2, title: boss ? 'キケン！' : title, top: S.wave === 0 ? `エリア ${S.sector + 1}` : null, sub: boss ? SS.BOSSES[S.sector].name : S.wave === 0 ? sec.name : S.plan.kind === 'elite' ? 'ちゅうボスが くるぞ！' : sec.name, boss, color: boss ? '#ff5a5f' : sec.accent });
    if (!demo) { snd(boss ? 'lowThreeTone' : 'wave', { vol: 0.5 }); snd('warp', { vol: 0.35, jitter: false }); }
    if (!demo && SS.snd.musicOn()) SS.snd.musicMode(boss ? 3 : S.wave === 0 ? 2 : 2, boss);
  }
  function aliveCount(types) { let n = 0; for (const e of S.enemies) if (e.alive && !e.doomed && e.type !== 'powerup' && e.type !== 'boss' && e.type !== 'ace' && (!types || types.includes(e.type))) n++; return n; }
  function waveDone() { if (S.queue.length) return false; for (const e of S.enemies) if (e.alive && e.type !== 'powerup') return false; return true; }

  const F0 = () => S.F || { wf: 1 };
  function updateWaves(g, dt) {
    if (S.mode === 'fight') {
      if (S.queue.length) {
        S.spawnT -= dt * (S.pace > 1 ? 1 + (S.pace - 1) * 0.5 : S.pace);
        const tok = S.queue[0];
        const cap = S.plan.cap + 1 + Math.round((F0().wf - 1) * 2.4) + (S.pace < 0.85 ? -1 : 0);
        if (S.spawnT <= 0 && (aliveCount() < cap || tok === 'powerup' || tok === 'boss' || tok === 'ace')) {
          S.queue.shift(); spawnToken(g, tok);
          S.spawnT = S.plan.interval / (1 + (F0().wf - 1) * 0.55) * rnd(0.7, 1.2) * (tok === 'swarm' ? 1.6 : 1) / (S.pace > 1 ? S.pace * 0.5 + 0.5 : 1);
        }
      } else if (waveDone() && !g.demo) {
        S.mode = 'clear'; S.clearT = 2.6;
        const bonus = 60 * (S.L + 1);
        g.score.add(bonus);
        const lastOfSector = S.wave + 1 >= S.perSector;
        if (lastOfSector) { S.clearT = 1.6; g.fx.pop(SX, S.F.bottom - 330, `エリアクリア！ +${bonus}`, { color: SS.SECTORS[S.sector].accent, size: 56, life: 1.5 }); }
        else { S.clearT = 2.6; banner({ key: 'clear', dur: 2.0, title: 'ウェーブ クリア！', sub: `+${bonus}`, color: '#7dff9b', clear: true }); }
        snd('clear', { vol: 0.6 });
        S.hull = Math.min(100, S.hull + 4); S.shield = Math.min(100, S.shield + 30);
        if (S.pace < 1) S.pace = Math.min(1, S.pace + 0.1);
      } else if (waveDone() && g.demo) { S.wave++; startWave(g); }
    } else if (S.mode === 'clear') {
      S.clearT -= dt;
      if (S.clearT <= 0 && !S.banner && !S.bq.length) {
        if (S.wave + 1 < S.perSector) { S.wave++; startWave(g); }
        else if (S.sector + 1 >= SS.SECTORS.length) beginVictory(g);
        else beginMap(g);
      }
    } else if (S.mode === 'map') {
      S.map.t += dt;
      if (S.map.t > 6.2) endMap(g);
    }
  }

  function beginMap(g) {
    clearField(g);
    S.mode = 'map'; S.map = { t: 0, from: S.sector, to: S.sector + 1 }; S.warp = 1;
    snd('door', { vol: 0.5 }); snd('warp', { vol: 0.4, jitter: false });
    if (SS.snd.musicOn()) SS.snd.musicMode(1, false);
    S.hull = Math.min(100, S.hull + 35); S.shield = 100; S.pulse = 1; S.inv = 0;
  }
  function endMap(g) {
    clearField(g);
    S.sector = S.map.to; S.wave = 0; S.map = null; S.perSector = perSectorFor(g);
    SS.bg.set(S.sector); SS.bg.pipGrow = S.sector === 4 ? 0.15 : 0;
    if (SS.snd.musicOn()) SS.snd.musicSector(S.sector);
    startWave(g);
  }
  function beginVictory(g) {
    clearField(g);
    S.mode = 'victory'; S.banner = null; S.bq.length = 0; S.vt = 0; S.queue.length = 0; S.warp = 0;
    S.flash = { a: 0.9, c: '#fff6c8' };
    snd('hugeBoom', { vol: 0.6 }); snd('zapThreeToneUp', { vol: 0.7, delay: 0.3 });
    if (SS.snd.musicOn()) SS.snd.musicMode(2, false);
  }

  /* ---------- spawning ---------- */
  function firstLetters() { const s = new Set(); for (const e of S.enemies) if (e.alive && !e.doomed) s.add(e.typer.nextReq() || e.typer.item.first); return s; }
  function pickItem(g, kind, o) { return g.dealer.next(Object.assign({ kind, avoidFirst: firstLetters() }, o || {})); }
  function mkPhrase(g, maxWords) {
    const pool = g.dealer.pool;
    if (pool.sentences.length) return g.dealer.next({ kind: 'sentence', maxWords, avoidFirst: firstLetters() });
    const n = clamp(maxWords - 3, 2, 3); const parts = [];
    for (let i = 0; i < n; i++) parts.push(g.dealer.next({ kind: 'word', maxLen: 6 }));
    const t = parts.map((p) => p.t).join(' ');
    return { t, ja: '', kana: '', hint: parts.map((p) => p.hint).filter(Boolean).join(' ・ '), kind: 'sentence', len: TM.typedLen(t), first: parts[0].first, words: n };
  }
  function pickX(F, minGap, y) {
    for (let k = 0; k < 8; k++) {
      const x = rnd(F.xmin, F.xmax); let ok = true;
      for (const e of S.enemies) if (e.alive && Math.abs(e.x - x) < minGap && e.y < F.top + 320) { ok = false; break; }
      if (ok) return x;
    }
    return rnd(F.xmin, F.xmax);
  }
  function spawnToken(g, tok) {
    const F = S.F;
    if (tok === 'swarm') { const cx = rnd(F.xmin + 250, F.xmax - 250); for (let i = 0; i < 3; i++) spawn(g, 'kamikaze', { x: cx + (i - 1) * 190, y: F.top - 130 - Math.abs(i - 1) * 60, delay: i * 0.12 }); g.fx.pop(SX, F.bottom - 330, 'SWARM!', { color: '#ff8a8a', size: 60, life: 1.2 }); snd('lowThreeTone', { vol: 0.3 }); }
    else if (tok === 'shower') { for (let i = 0; i < 4; i++) S.queue.unshift('meteor'); S.spawnT = 0.4; S.plan.cap += 1; }
    else if (tok === 'powerup') spawnPower(g);
    else if (tok === 'boss') spawnBoss(g);
    else if (tok === 'ace') spawnAce(g);
    else spawn(g, tok);
  }
  function wordFor(g, type, big) {
    const lad = g.ladder(progress01()); const cap = Math.min(lad.maxLen, capL());
    switch (type) {
      case 'kamikaze': return pickItem(g, 'word', { maxLen: 3, minLen: 2 });
      case 'mini': return pickItem(g, 'word', { maxLen: 4, minLen: 2 });
      case 'zigzag': return pickItem(g, 'word', { maxLen: Math.min(cap, 6) });
      case 'ufo': case 'splitter': return pickItem(g, 'word', { maxLen: Math.min(cap, 7) });
      case 'meteor': return pickItem(g, 'word', { maxLen: big ? cap + 1 : Math.max(3, cap - 2) });
      case 'powerup': return pickItem(g, 'word', { maxLen: 4, minLen: 2 });
      default: return pickItem(g, 'word', { maxLen: cap });
    }
  }
  function sprSize(e) { const s = SS.size(e.spr); const rot = e.baseRot || 0; const sw = Math.abs(Math.sin(rot)) > 0.7; return sw ? [s[1] * e.sc, s[0] * e.sc] : [s[0] * e.sc, s[1] * e.sc]; }
  function spawn(g, type, o) {
    o = o || {}; const F = S.F; const T = SS.TYPES[type]; const sec = SS.SECTORS[S.sector];
    const col = sec.col === 'any' || Math.random() < 0.28 ? U.pick(['Black', 'Blue', 'Green', 'Red']) : sec.col;
    const e = { id: ++S.uid, type, T, alive: true, doomed: false, x: o.x ?? pickX(F, 250), y: o.y ?? F.spawnY, t: 0, flash: 0, locked: false, col, spdMul: 1, sc: T.scale, rot: 0, baseRot: 0, targetable: true, stun: 0, push: 0,
      ph: rnd(0, 6.28), amp: rnd(110, 170), spin: 0, hitsPending: 0, delay: o.delay || 0, chx: 0, chy: 0, dying: 0, phases: null, pi: 0, name: type };
    e.x0 = e.x; e.x1 = clamp(lerp(e.x, SX, rnd(0.03, 0.3)), F.xmin, F.xmax);
    e.spr = T.spr(col);
    let item;
    if (type === 'ufo') { e.spr = 'ufo' + U.pick(['Blue', 'Green', 'Red', 'Yellow']); e.R = rnd(70, 105); e.cy = 0; e.spinDir = Math.random() < 0.5 ? 1 : -1; e.x0 = clamp(e.x0, F.xmin + 100, F.xmax - 100); e.x1 = clamp(lerp(e.x0, SX, 0.25), F.xmin + 100, F.xmax - 100); }
    if (type === 'meteor') {
      const big = Math.random() < 0.7; e.big = big;
      e.spr = U.pick(big ? SS.METEORS : SS.METEORS_SMALL); e.sc = big ? rnd(1.15, 1.45) : rnd(1.1, 1.4); e.hrMul = 1; e.vx = rnd(-55, 55); e.spin = rnd(-0.8, 0.8); e.spdMul = rnd(0.95, 1.2);
      item = wordFor(g, 'meteor', big);
    } else if (type === 'kamikaze') {
      e.spr = U.pick(['missile21', 'missile22', 'missile23']); e.v = 0; e.hx = 0; e.hy = 1; e.sc = 2.0; e.armT = o.arm ?? 1.3;
      item = wordFor(g, type);
    } else if (type === 'mini') {
      e.vx = o.vx || 0; e.vy = o.vy || 0; item = wordFor(g, type);
    } else if (type === 'shielded') {
      e.phases = [wordFor(g, 'mini'), null]; e.phases[0] = pickItem(g, 'word', { maxLen: 4, minLen: 2 });
      e.phases[1] = wordFor(g, 'scout'); item = e.phases[0];
    } else item = wordFor(g, type);
    e.item = item; e.typer = new TM.Typer(item); e.col = col; e.debris = COLNAME[col] || 'gray';
    const sz = sprSize(e); e.hw = sz[0] / 2; e.hh = sz[1] / 2; e.hr = (T.hr / T.scale) * e.sc * (type === 'meteor' ? 0.9 : 1);
    if (type === 'ufo') { e.cy = (o.y ?? F.top - 30) - e.hh - e.R * 0.5; e.y = e.cy; }
    else if (o.y == null) e.y = F.top - e.hh - 24;
    e.chx = e.x; e.chy = e.y; e.chipSize = type === 'mini' ? 36 : 40;
    S.enemies.push(e); return e;
  }
  function spawnPower(g, x, y, forceKind) {
    const F = S.F; let kind;
    const need = [];
    if (S.hull < 70) need.push('repair', 'repair');
    if (S.shield < 55) need.push('shield', 'shield');
    need.push('bomb', 'slow', 'double', 'shield');
    kind = forceKind || U.pick(need);
    const e = { id: ++S.uid, type: 'powerup', T: SS.TYPES.powerup, kind, alive: true, doomed: false, x: x ?? rnd(F.xmin + 80, F.xmax - 80), y: y ?? F.spawnY, t: 0, flash: 0, locked: false, spdMul: 1, sc: 1.9, rot: 0, targetable: true, stun: 0, ph: rnd(0, 6), hitsPending: 0, delay: 0, spr: SS.POWER[kind].base, hw: 36, hh: 36, hr: 44 };
    if (y == null) e.y = F.top - e.hh - 24;
    e.x0 = e.x; e.item = pickItem(g, 'word', { maxLen: 4, minLen: 2 }); e.typer = new TM.Typer(e.item); e.chx = e.x; e.chy = e.y; e.chipSize = 38;
    S.enemies.push(e); S.puCool = 16;
    snd('highUp', { vol: 0.25 });
    return e;
  }

  /* ---------- bosses ---------- */
  function spawnBoss(g) {
    const F = S.F; const def = SS.BOSSES[S.sector];
    const nPh = g.diff === 'gentle' ? Math.min(def.phases, 2) : def.phases;
    const mw = def.maxWords - (g.diff === 'gentle' ? 2 : 0) + (g.diff === 'turbo' ? 1 : 0);
    const phases = []; for (let i = 0; i < nPh; i++) phases.push(mkPhrase(g, Math.max(3, mw - (i === 0 && nPh > 1 ? 1 : 0))));
    const e = mkBigShip(g, 'boss', def.spr, def.scale, def.rot, phases, def);
    e.def = def; e.name = def.name; e.x = SX; e.y = F.top - e.hh - 40; e.y0 = e.y; e.hoverY = Math.min(F.safeTop + 20 + e.hh, F.impactY - 150 - e.hh); e.entry = 0; e.targetable = false; e.atkT = 5; e.minT = 8; e.charge = 0;
    e.glow = def.glow; e.hr = def.hr; e.totalLetters = phases.reduce((a, p) => a + p.len, 0); e.typed = 0; e.hpShown = 1; e.grace = 0; e.beam = null; e.queueAtk = [];
    S.boss = e; return e;
  }
  function mkBigShip(g, type, spr, sc, rot, phases, def) {
    const e = { id: ++S.uid, type, T: SS.TYPES[type === 'boss' ? 'ace' : type] || SS.TYPES.ace, alive: true, doomed: false, x: SX, y: 0, t: 0, flash: 0, locked: false, spdMul: 1, sc, rot: 0, baseRot: rot, spr, targetable: true, stun: 0, ph: rnd(0, 6), hitsPending: 0, delay: 0, spin: 0, dying: 0, big: true };
    const sz = sprSize(e); e.hw = sz[0] / 2; e.hh = sz[1] / 2; e.hr = Math.max(e.hw, e.hh) * 0.8;
    e.phases = phases; e.pi = 0; e.item = phases[0]; e.typer = new TM.Typer(phases[0]); e.keepProgress = true; e.chx = e.x; e.chy = e.y;
    e.debris = 'red'; e.col = 'Red';
    S.enemies.push(e); return e;
  }
  function spawnAce(g) {
    const F = S.F; const spr = SS.MINIBOSS[Math.min(S.sector, 4)];
    const mw = (g.diff === 'gentle' ? 3 : 4) + (S.sector > 2 ? 1 : 0);
    const ph = [mkPhrase(g, mw)];
    const e = mkBigShip(g, 'ace', spr, 0.78, 0, ph, null);
    e.x = e.x0 = pickX(F, 360); e.y = F.top - e.hh - 70; e.name = 'ace'; e.atkT = 5; e.spdMul = 1; e.keepProgress = true; e.typed = 0; e.totalLetters = ph[0].len; e.hpShown = 1; e.isAce = true; e.chipSize = 38;
    e.hr = Math.max(e.hw, e.hh) * 0.7;
    return e;
  }

  /* ---------- enemy movement ---------- */
  function stepEnemy(g, e, dt, F) {
    const T = e.T; const ts = S.timeScale;
    if (e.delay > 0) { e.delay -= dt; return; }
    e.t += dt * ts; e.flash = Math.max(0, e.flash - dt * 5);
    if (e.typer.shake > 0) e.typer.shake = Math.max(0, e.typer.shake - dt * 3);
    if (e.push) { e.y -= e.push * dt; e.push *= Math.exp(-3.2 * dt); if (e.push < 6) e.push = 0; }
    if (e.stun > 0) { e.stun -= dt; if (e.type === 'ufo') e.cy = e.y - Math.sin(e.ph + e.t * 1.3 * e.spinDir) * e.R * 0.5; return; }
    if (!e.seen) { if (topEdge(e) >= F.safeTop) markSeen(e); }
    const room = Math.max(300, F.impactY - F.safeTop - e.hh * 2);
    const minVis = e.item && e.item.kind === 'sentence' ? 8 : 5.5;
    const spd = e.seen ? Math.min(T.speed * e.spdMul * S.pace * S.diffSpd * F.fs, room / minVis) * ts : 380 * ts;
    const u = clamp((e.y - F.spawnY) / (F.impactY - F.spawnY), 0, 1);
    switch (e.type) {
      case 'scout': case 'splitter': case 'shielded':
        e.y += spd * dt; e.x = e.x0 + (e.x1 - e.x0) * u + (e.type === 'scout' ? 0 : Math.sin(e.t * 0.9 + e.ph) * 28); e.rot = Math.sin(e.t * 0.9 + e.ph) * 0.05; break;
      case 'weaver':
        e.y += spd * dt; e.x = e.x0 + (e.x1 - e.x0) * u + Math.sin(e.t * 1.45 + e.ph) * e.amp; e.rot = Math.cos(e.t * 1.45 + e.ph) * 0.28; break;
      case 'zigzag': {
        e.y += spd * dt; const w = Math.asin(Math.sin(e.t * 1.25 + e.ph)) * (2 / Math.PI);
        e.x = e.x0 + (e.x1 - e.x0) * u + w * e.amp * 1.1; e.rot = Math.cos(e.t * 1.25 + e.ph) * 0.35 * (Math.cos(e.t * 1.25 + e.ph) > 0 ? 1 : 1); break;
      }
      case 'ufo': {
        e.cy += spd * (e.seen ? 0.85 : 1) * dt; const th = e.ph + e.t * 1.3 * e.spinDir;
        const cx = e.x0 + (e.x1 - e.x0) * clamp((e.cy - F.spawnY) / (F.impactY - F.spawnY), 0, 1);
        e.x = cx + Math.cos(th) * e.R; e.y = e.cy + Math.sin(th) * e.R * 0.5; e.ox = cx; e.rot = e.t * 0.8 * e.spinDir; break;
      }
      case 'kamikaze': {
        if (e.armT > 0) { if (e.seen) e.armT -= dt * ts; e.y += (e.seen ? 70 : 380) * ts * dt; e.hx = 0; e.hy = 1; e.rot = Math.PI; }
        else {
          const dx = SX + S.ship.slide - e.x, dy = S.ship.y - e.y, d = Math.hypot(dx, dy) || 1;
          const want = Math.atan2(dy / d, dx / d), cur = Math.atan2(e.hy, e.hx);
          let da = want - cur; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
          const na = cur + clamp(da, -2.4 * dt * ts, 2.4 * dt * ts); e.hx = Math.cos(na); e.hy = Math.sin(na);
          e.v = Math.min(e.v + 260 * dt * ts, Math.min(300 * S.diffSpd * S.pace * (F.fs > 1 ? 1 + (F.fs - 1) * 0.4 : 1), room / 3.6));
          e.x += e.hx * e.v * dt * ts; e.y += e.hy * e.v * dt * ts; e.rot = Math.atan2(e.hx, -e.hy);
          if (Math.random() < dt * 40 * ts) SS.fx.emit({ spr: 'p_flame5', x: e.x - e.hx * 30, y: e.y - e.hy * 30, vx: -e.hx * 90, vy: -e.hy * 90, rot: e.rot + Math.PI, life: 0.28, s0: 40, s1: 14, a0: 0.9, a1: 0, add: true, tint: '#ff9a3c' });
        }
        break;
      }
      case 'meteor': e.y += spd * dt; e.x = e.x0 + (e.x1 - e.x0) * u; e.rot += e.spin * dt * ts; break;
      case 'mini': {
        e.x += e.vx * dt * ts; e.y += e.vy * dt * ts; e.vx *= Math.exp(-2.4 * dt); e.vy += (spd - e.vy) * (1 - Math.exp(-1.6 * dt * ts)); e.x = clamp(e.x, F.xmin - 60, F.xmax + 60); e.rot = clamp(e.vx * 0.0015, -0.4, 0.4); break;
      }
      case 'powerup': e.y += spd * dt; e.x = e.x0 + Math.sin(e.t * 1.3 + e.ph) * 70; e.rot = Math.sin(e.t * 2 + e.ph) * 0.12; break;
      case 'ace': {
        const target = F.safeTop + 150 + S.sector * 10;
        e.y += (!e.seen ? 380 * ts : e.y < target ? 140 : spd * 0.6) * dt; e.x = e.x0 + Math.sin(e.t * 0.7 + e.ph) * 200; e.x = clamp(e.x, F.xmin + 60, F.xmax - 60);
        e.atkT -= dt * ts; if (e.atkT <= 0 && e.seen) { e.atkT = (g.diff === 'gentle' ? 5.5 : 4.2) * rnd(0.85, 1.2); enemyFire(g, e, 'bolts', 1); }
        e.rot = Math.sin(e.t * 0.7 + e.ph) * 0.08; break;
      }
    }
    if (e.type !== 'kamikaze') clampTop(e, F);
    e.x = clamp(e.x, F.v.x + e.hw + 8, F.v.x + F.v.w - e.hw - 8);
    e.danger = e.y + (e.type === 'kamikaze' ? 500 : 0) + (e.type === 'powerup' ? -900 : 0) + (e.big ? -200 : 0);
  }

  /* ---------- input / locking ---------- */
  function markSeen(e) {
    e.seen = true; e.seenT = 0; e.seenAt = S.t; e.chy = undefined; e.chx = e.type === "ufo" ? (e.ox || e.x) : e.x;
    if (e.type !== 'powerup') { const y = e.type === 'ufo' ? e.cy : e.y; SS.fx.ring(e.x, y, 150 + e.hw, '#bfe8ff', 0.35); }
  }
  function release(keepProgress) {
    const e = S.lockT; if (!e) return;
    e.locked = false; S.lockT = null;
    if (!e.keepProgress && !e.typer.done && e.typer.pos > 0 && !keepProgress) { const errs = e.typer.errors; e.typer = new TM.Typer(e.typer.item); e.typer.errors = errs; }
  }
  function press(g, k) {
    if (S.mode === 'map') { if (k === ' ' && S.map.t > 1.5) S.map.t = Math.max(S.map.t, 5.6); return; }
    if (S.mode !== 'fight' && S.mode !== 'clear') return;
    const F = S.F; let t = S.lockT;
    if (t && (!t.alive || t.doomed)) { release(true); t = null; }
    let res, tgt;
    if (t) { tgt = t; res = t.typer.feed(k); }
    else {
      const c = S.enemies.filter((e) => canType(e) && e.typer.wouldAccept(k) && (e.typer.pos === 0 || e.keepProgress));
      if (!c.length) { g.keyResult('miss'); missFire(); return; }
      c.sort((a, b) => (b.danger || 0) - (a.danger || 0));
      tgt = c[0]; res = tgt.typer.feed(k);
      S.lockT = tgt; tgt.locked = true;
      snd('computer', { vol: 0.12, rate: 1.6 + rnd(0, 0.3) });
    }
    g.keyResult(res);
    if (res === 'miss') { SS.fx.emit({ spr: 'p_star8', x: tgt.chx, y: tgt.chy - 20, life: 0.25, s0: 40, s1: 70, a0: 0.8, a1: 0, add: true, tint: '#ff6a6a' }); return; }
    onLetter(g, tgt, res === 'done', k);
  }
  function missFire() {
    const sh = S.ship; SS.fx.emit({ spr: 'p_star6', x: sh.x, y: sh.y - 70, life: 0.25, s0: 30, s1: 60, a0: 0.8, a1: 0, add: true, tint: '#ff7a7a' });
  }
  function onLetter(g, e, done, k) {
    let phaseEnd = null, finalHit = false, typerDone = e.typer;
    if (e.totalLetters != null) e.typed++;
    if (done) {
      if (e.phases && e.pi < e.phases.length - 1) {
        e.pi++; e.item = e.phases[e.pi]; e.typer = new TM.Typer(e.item);
        phaseEnd = e.type === 'boss' ? 'bossPhase' : 'shield';
        if (e.type !== 'boss') release(true); else { /* stay locked on the boss */ }
        if (e.type === 'boss' && e.typer.chars.length && !S.lockT) { S.lockT = e; e.locked = true; }
      } else { e.doomed = true; e.killT = 0.9; finalHit = true; release(true); }
    }
    fireBolt(g, e, { final: done, phaseEnd, finalHit, typer: typerDone, k });
  }
  function fireBolt(g, e, o) {
    const sh = S.ship; const rot = sh.rot;
    const side = sh.gunSide; sh.gunSide = -sh.gunSide;
    const gx = sh.x + Math.cos(rot) * 20 * side + Math.sin(rot) * 34, gy = sh.y + Math.sin(rot) * 20 * side - Math.cos(rot) * 34;
    const mult = Math.min(3, g.score.mult - 1 + (S.dbl > 0 ? 0 : 0)); const b = BOLTS[g.demo ? 0 : clamp(g.score.mult - 1, 0, 3)];
    S.bolts.push({ x: gx, y: gy, vx: Math.sin(rot) * 1500, vy: -Math.cos(rot) * 1500, target: e, spr: b[0], col: b[1], final: o.final, o, t: 0, big: o.final });
    e.hitsPending++; sh.recoil = 1; S.lastFire = { e, t: S.t };
    SS.fx.muzzle(gx, gy, rot, b[1]);
    const rate = 1 + Math.min(0.4, g.score.combo * 0.012);
    if (!g.demo) snd(o.final ? 'laserFinal' : 'laser', { vol: o.final ? 0.5 : 0.38, rate });
  }

  /* ---------- bolts ---------- */
  function updateBolts(g, dt) {
    for (const b of S.bolts) {
      const e = b.target;
      if (!e.alive) { b.dead = true; if (e.hitsPending > 0) e.hitsPending--; continue; }
      const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy) || 1;
      const k = 1 - Math.exp(-dt * 18), sp = 2700;
      b.vx += (dx / d * sp - b.vx) * k; b.vy += (dy / d * sp - b.vy) * k;
      const step = Math.hypot(b.vx, b.vy) * dt;
      if (d <= step + 8 || d < e.hr * 0.45) { b.dead = true; hitEnemy(g, b); continue; }
      b.x += b.vx * dt; b.y += b.vy * dt; b.t += dt;
      if (Math.random() < 0.5) SS.fx.emit({ spr: 'p_circle5', x: b.x, y: b.y, life: 0.16, s0: 22, s1: 6, a0: 0.55, a1: 0, add: true, tint: b.col });
    }
    S.bolts = S.bolts.filter((b) => !b.dead);
  }
  function hitEnemy(g, b) {
    const e = b.target; e.hitsPending = Math.max(0, e.hitsPending - 1); e.flash = 1;
    SS.fx.hit(b.x, b.y, b.col);
    if (e.type === 'boss' || e.isAce) { g.fx.shake(3, 0.06); if (Math.random() < 0.5) SS.fx.puff(b.x, b.y, 50, 0.7, true); snd('hit', { vol: 0.16 }); }
    else if (!b.o.final) snd('hit', { vol: 0.12, rate: 1.3 });
    if (b.o.phaseEnd === 'shield') shieldBreak(g, e, b);
    else if (b.o.phaseEnd === 'bossPhase') bossPhaseBreak(g, e, b);
    if (b.o.finalHit) kill(g, e, { typer: b.o.typer });
  }
  function shieldBreak(g, e, b) {
    SS.fx.ring(e.x, e.y, e.hw * 4, '#8fd0ff', 0.5); SS.fx.sparks(e.x, e.y, 14, '#b9e4ff', 520, 32);
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + e.ph; SS.fx.emit({ spr: 'p_star8', x: e.x + Math.cos(a) * e.hw * 1.1, y: e.y + Math.sin(a) * e.hw * 1.1, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, life: 0.5, s0: 50, s1: 10, a0: 1, a1: 0, add: true, tint: '#9fd8ff' }); }
    e.shieldGone = true; g.fx.shake(6, 0.12); snd('shieldBreak', { vol: 0.55 }); snd('field', { vol: 0.3 });
    g.wordDone(b.o.typer, e.x, e.y - e.hh, { bonus: 0.6 * (S.dbl > 0 ? 2 : 1), color: '#8fd8ff' });
  }
  function kill(g, e, o) {
    o = o || {}; if (!e.alive) return;
    if (e.type === 'boss') { if (!e.dyingBoss) bossDie(g, e); return; }
    e.alive = false;
    if (S.lockT === e) release(true);
    const x = e.x, y = e.y;
    const T = e.type; const size = T === 'scout' || T === 'weaver' || T === 'zigzag' ? 130 : T === 'kamikaze' ? 90 : T === 'mini' ? 80 : T === 'splitter' ? 190 : T === 'shielded' ? 150 : T === 'meteor' ? 140 : T === 'ufo' ? 140 : T === 'ace' ? 280 : 150;
    SS.fx.explode(x, y, size, { color: e.debris, glow: e.T.glow });
    snd(size > 200 ? 'bigBoom' : 'boom', { vol: size > 200 ? 0.6 : 0.4, rate: size > 140 ? 0.9 : 1.1 });
    g.fx.shake(size > 200 ? 16 : size > 140 ? 8 : 5, size > 200 ? 0.28 : 0.12);
    if (!o.silent) {
      let bonus = (T === 'kamikaze' ? 1.4 : T === 'ace' ? 2.5 : T === 'shielded' ? 1.0 : T === 'splitter' ? 1.25 : 1) * (S.dbl > 0 ? 2 : 1);
      if (o.bomb) { g.score.add(e.item.len * 8 * (S.dbl > 0 ? 2 : 1)); g.fx.pop(x, y - 30, '+' + e.item.len * 8, { color: '#ffb26b', size: 44 }); }
      else if (o.typer) {
        g.wordDone(o.typer, x, y - e.hh * 0.4, { bonus, color: S.dbl > 0 ? '#ffe03a' : '#ffe066' });
        if (e.typer.errors === 0 || o.typer.errors === 0) S.pace = Math.min(S.paceMax, S.pace + 0.012);
        S.kills++;
      }
    }
    if (T === 'splitter' && !o.silent) {
      const n = S.sector >= 3 ? 3 : 2;
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - (n - 1) / 2) * 1.0; spawn(g, 'mini', { x, y, vx: Math.cos(a) * 420 + (i - 1) * 40, vy: Math.sin(a) * 120 + 40 }); }
      SS.fx.ring(x, y, 260, '#ff8fe0', 0.6); snd('phaseJump3', { vol: 0.3, rate: 1.4 });
    }
    if (T === 'ace') { g.fx.pop(x, y + 60, 'MINI-BOSS DOWN!', { color: '#ff9bd8', size: 56, life: 1.4 }); SS.fx.confettiStars(x, y, 14); if (S.hull < 100 && !o.silent) S.hull = Math.min(100, S.hull + 8); spawnPower(g, x, y); }
    else if (!o.silent && !g.demo && T !== 'mini' && T !== 'boss' && S.puCool <= 0 && Math.random() < 0.07 && !S.enemies.some((q) => q.alive && q.type === 'powerup')) spawnPower(g, x, y);
  }
  function bossPhaseBreak(g, e, b) {
    e.grace = 2.2; e.pending = null; e.beam = null; e.flash = 1;
    g.fx.shake(22, 0.4); S.flash = { a: 0.55, c: '#ffffff' };
    for (let i = 0; i < 5; i++) SS.fx.explode(e.x + rnd(-e.hw, e.hw) * 0.8, e.y + rnd(-e.hh, e.hh) * 0.8, rnd(140, 210), { color: 'red' });
    SS.fx.ring(e.x, e.y, 700, '#ffffff', 0.7);
    snd('bigBoom', { vol: 0.6 }); snd('shieldBreak', { vol: 0.5 });
    g.fx.pop(e.x, e.y - e.hh - 20, `Armor cracked! ${e.pi}/${e.phases.length - 1}`.replace(/ \d+\/\d+/, ''), { color: '#ffd06b', size: 62, life: 1.4 });
    g.wordDone(b.o.typer, e.x, e.y + e.hh * 0.2, { bonus: 3 * (S.dbl > 0 ? 2 : 1), color: '#ffcf4a' });
    SS.fx.confettiStars(e.x, e.y, 16);
    for (const q of S.enemies) if (q.alive && q.seen && q !== e && q.type !== 'powerup' && q.type !== 'boss') { q.doomed = true; kill(g, q, { silent: true }); }
    S.shots.length = 0;
    spawnPower(g, e.x, e.y + 40);
  }
  /* boss defeated: chain of explosions, slow motion, then wave/sector end */
  function bossDie(g, e) {
    e.dyingBoss = 2.4; e.targetable = false; S.slowmo = 1.6; S.shots.length = 0; e.beam = null; e.pending = null;
    for (const q of S.enemies) if (q.alive && q !== e && q.type !== 'powerup') { q.doomed = true; kill(g, q, { silent: true }); }
    g.fx.pop(e.x, e.y - e.hh, `${e.name} defeated!`, { color: '#ffe066', size: 70, life: 2.2 });
    g.wordDone(e.typer, e.x, e.y, { bonus: 4 * (S.dbl > 0 ? 2 : 1), color: '#ffcf4a' });
    S.hull = Math.min(100, S.hull + 20); snd('hugeBoom', { vol: 0.7 });
  }
  function finishBoss(g, e) {
    e.alive = false;
    SS.fx.explode(e.x, e.y, 460, { color: 'red' }); SS.fx.ring(e.x, e.y, 1200, '#ffffff', 0.9); SS.fx.confettiStars(e.x, e.y, 40);
    for (let i = 0; i < 6; i++) SS.fx.explode(e.x + rnd(-e.hw, e.hw), e.y + rnd(-e.hh, e.hh), rnd(160, 260), { color: i % 2 ? 'gray' : 'red' });
    S.flash = { a: 0.85, c: '#fff4cf' }; g.fx.shake(30, 0.6); snd('hugeBoom', { vol: 0.8 });
    for (let i = 0; i < 4; i++) spawnPower(g, e.x + rnd(-200, 200), e.y + rnd(-60, 60)).spdMul = 0.7;
    S.boss = null;
  }

  /* ---------- enemy attacks (visual only: they shrink the shield bar, the player never dodges) ---------- */
  function enemyFire(g, e, kind, n) {
    const dmg = (e.type === 'boss' ? 6 + S.sector * 0.8 : 5);
    if (kind === 'bolts') {
      for (let i = 0; i < (n || 3); i++) S.shots.push({ kind: 'laser', x: e.x + (i - ((n || 3) - 1) / 2) * e.hw * 0.45, y: e.y + e.hh * 0.55, speed: 820, dmg, delay: i * 0.16, src: e, t: 0 });
      snd('laserLarge0', { vol: 0.25, rate: 0.7 });
    } else if (kind === 'missiles') {
      for (let i = 0; i < 2; i++) S.shots.push({ kind: 'missile', x: e.x + (i ? 1 : -1) * e.hw * 0.5, y: e.y + e.hh * 0.4, hx: (i ? 1 : -1) * 0.8, hy: 0.4, speed: 420, dmg: dmg + 3, delay: i * 0.3, src: e, t: 0 });
      snd('laserLarge1', { vol: 0.25, rate: 0.6 });
    } else if (kind === 'beam') { e.beam = { t: 0, charge: 1.1, fire: 1.0, tick: 0 }; snd('lowThreeTone', { vol: 0.35 }); }
  }
  function updateBossAttack(g, e, dt, F) {
    const ts = S.timeScale;
    if (e.pending) { e.pending.t -= dt * ts; e.charge = clamp(1 - e.pending.t / 0.8, 0, 1); if (e.pending.t <= 0) { enemyFire(g, e, e.pending.kind, e.pending.n); e.pending = null; e.charge = 0; } }
    if (e.beam) {
      const bm = e.beam; bm.t += dt * ts;
      if (bm.t < bm.charge) e.charge = bm.t / bm.charge;
      else if (bm.t < bm.charge + bm.fire) { e.charge = 0; bm.tick -= dt * ts; if (bm.tick <= 0) { bm.tick = 0.3; hurtPlayer(g, 4 + S.sector * 0.5, e.x, e.y + e.hh, 'beam'); } }
      else e.beam = null;
    }
    if (e.grace > 0) { e.grace -= dt; return; }
    if (e.pending || e.beam || e.entry < 1 || e.dyingBoss) return;
    e.atkT -= dt * ts;
    if (e.atkT <= 0) {
      const hp = 1 - e.typed / e.totalLetters;
      const base = (3.6 - S.sector * 0.28) * (g.diff === 'gentle' ? 1.45 : g.diff === 'turbo' ? 0.8 : 1) * (hp < 0.5 ? 0.8 : 1);
      e.atkT = base * rnd(0.85, 1.15);
      const kind = U.pick(e.def.atk.filter((a) => a !== 'beam' || hp < 0.85));
      e.pending = { kind, n: kind === 'bolts' ? (S.sector > 1 ? 4 : 3) : 2, t: 0.8 };
      if (kind === 'beam') { e.pending = null; enemyFire(g, e, 'beam'); }
    }
    e.minT -= dt * ts;
    if (e.minT <= 0 && e.def.minions) {
      e.minT = (g.diff === 'gentle' ? 11 : 8) * rnd(0.85, 1.2);
      if (aliveCount() < 4 + Math.floor(S.sector / 2)) { const n = e.def.minions === 'kamikaze' ? 2 : 1; for (let i = 0; i < n; i++) spawn(g, e.def.minions, { x: e.x + (i - (n - 1) / 2) * 150, y: e.y + e.hh * 0.6, delay: i * 0.2, arm: 0.7 }); }
    }
  }
  function updateShots(g, dt) {
    const sh = S.ship, ts = S.timeScale;
    for (const s of S.shots) {
      if (s.delay > 0) { s.delay -= dt * ts; if (s.src && s.src.alive) { /* follow muzzle */ } continue; }
      s.t += dt * ts;
      const dx = sh.x - s.x, dy = sh.y - 20 - s.y, d = Math.hypot(dx, dy) || 1;
      if (s.kind === 'laser') { s.hx = dx / d; s.hy = dy / d; s.x += s.hx * s.speed * dt * ts; s.y += s.hy * s.speed * dt * ts; }
      else {
        const cur = Math.atan2(s.hy, s.hx), want = Math.atan2(dy, dx); let da = want - cur; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        const na = cur + clamp(da, -2.8 * dt * ts, 2.8 * dt * ts); s.hx = Math.cos(na); s.hy = Math.sin(na);
        s.x += s.hx * s.speed * dt * ts; s.y += s.hy * s.speed * dt * ts;
        if (Math.random() < 0.7) SS.fx.puff(s.x - s.hx * 20, s.y - s.hy * 20, 36, 0.6, false, 0, 0);
      }
      if (d < 62) { s.dead = true; hurtPlayer(g, s.dmg, s.x, s.y, s.kind); }
    }
    S.shots = S.shots.filter((s) => !s.dead);
  }

  /* ---------- damage to the player ---------- */
  function hurtPlayer(g, dmg, x, y, kind) {
    const sh = S.ship; sh.hitAng = Math.atan2(y - sh.y, x - sh.x);
    SS.fx.glow(x, y, 90, '#ff9a6a', 0.25, 0.9); SS.fx.sparks(x, y, 6, '#ffb07a', 420, 26);
    if (g.demo) { sh.shieldHit = 1; return; }
    if (S.mode === 'dying' || S.mode === 'victory' || S.god) return;
    dmg *= S.diffDmg;
    if (S.inv > 0) { sh.shieldHit = 1; snd('field', { vol: 0.4 }); return; }
    S.shieldDelay = 3.2; S.hurtVig = 1;
    const sd = Math.min(S.shield, dmg); S.shield -= sd; const rest = dmg - sd;
    if (sd > 0) { sh.shieldHit = 1; snd('field', { vol: 0.5 }); }
    if (rest > 0) {
      S.hull = Math.max(0, S.hull - rest * 0.9); sh.hullHit = 1; snd('hurt', { vol: 0.6 }); g.fx.shake(16, 0.25); S.flash = { a: 0.28, c: '#ff4040' };
      SS.fx.explode(sh.x + rnd(-30, 30), sh.y + rnd(-10, 20), 80, { color: 'blue' });
      if (S.hull <= 0) die(g);
    } else g.fx.shake(7, 0.15);
  }
  function die(g) {
    S.mode = 'dying'; S.banner = null; S.bq.length = 0; S.dying = 0; S.lockT = null; S.shots.length = 0;
    S.lockT = null; for (const e of S.enemies) e.locked = false;
    snd('hugeBoom', { vol: 0.6 }); snd('lose', { vol: 0.5, delay: 0.4 });
    const sector = S.sector + 1, wave = S.wave + 1;
    g.end({ win: false, delay: 2600, title: 'Ship needs repairs!', sub: `You flew through Sector ${sector} – ${SS.SECTORS[S.sector].name}`, targetMet: S.sector >= 2, stats: [['Sector', sector], ['Wave', wave]] });
  }
  function impact(g, e, F) {
    e.alive = false; if (S.lockT === e) release(true);
    const x = e.x, y = Math.min(e.y, F.impactY + 30);
    SS.fx.explode(x, y, 120, { color: e.debris, glow: '#ff7a3c' });
    SS.fx.ring(x, F.impactY + 20, 300, '#ff9a6a', 0.5);
    snd('boom', { vol: 0.4 });
    if (e.type === 'meteor') SS.fx.debris(x, y, 6, 'gray', 380, 40);
    if (g.demo || g.state !== 'play') return;
    g.missWord(e.item); g.score.breakCombo(); S.escaped++;
    S.pace = Math.max(0.74, S.pace - 0.07);
    g.fx.pop(x, y - 70, 'Ouch!', { color: '#ff8a8a', size: 46 });
    hurtPlayer(g, e.T.dmg * (e.type === 'ace' ? 1 : 1), x, F.impactY, 'ram');
  }

  /* ---------- power-ups ---------- */
  function collect(g, e) {
    e.alive = false; if (S.lockT === e) release(true);
    const P = SS.POWER[e.kind]; const sh = S.ship;
    SS.fx.ring(e.x, e.y, 300, P.color, 0.5); SS.fx.sparks(e.x, e.y, 14, P.color, 500, 32); SS.fx.confettiStars(e.x, e.y, 8, [P.color, '#ffffff']);
    snd('power', { vol: 0.5 });
    if (!g.demo) g.wordDone(e.typer, e.x, e.y - 40, { bonus: 0.5, color: P.color });
    g.fx.pop(e.x, e.y - 100, P.info, { color: P.color, size: 58, life: 1.4 });
    if (g.demo) return;
    switch (e.kind) {
      case 'shield': S.shield = 100; S.inv = 7; snd('shieldUp', { vol: 0.6 }); break;
      case 'repair': S.hull = Math.min(100, S.hull + 35); S.shield = 100; snd('shieldUp', { vol: 0.5 }); break;
      case 'slow': S.slow = 8; snd('phaserDown1', { vol: 0.6 }); break;
      case 'double': S.dbl = 12; snd('power8', { vol: 0.5 }); break;
      case 'bomb': bomb(g); break;
    }
  }
  function bomb(g) {
    const sh = S.ship; S.bombFx = { t: 0, x: sh.x, y: sh.y };
    S.flash = { a: 0.75, c: '#ffe9b0' }; g.fx.shake(26, 0.5); snd('hugeBoom', { vol: 0.7 }); snd('laserLarge1', { vol: 0.4, rate: 0.7 });
    SS.fx.ring(sh.x, sh.y, 2400, '#ffd37a', 0.9, 'p_circle3'); SS.fx.ring(sh.x, sh.y, 1800, '#ffffff', 0.7);
    for (const e of S.enemies) {
      if (!e.alive || e.type === 'powerup' || e.doomed || !e.seen) continue;
      if (e.type === 'boss') { e.grace = Math.max(e.grace, 2.0); e.pending = null; e.beam = null; e.flash = 1; continue; }
      if (e.type === 'ace') { e.stun = 2.5; e.flash = 1; continue; }
      e.doomed = true; e.bombT = Math.hypot(e.x - sh.x, e.y - sh.y) / 1900; e.killT = 9;
    }
    S.shots.length = 0;
  }
  function pulse(g) {
    if (S.pulse <= 0 || (S.mode !== 'fight')) return;
    S.pulse = 0; const sh = S.ship; snd('shieldUp', { vol: 0.5 }); snd('field', { vol: 0.5 });
    SS.fx.ring(sh.x, sh.y, 2000, '#7fdcff', 0.8, 'p_circle3'); SS.fx.ring(sh.x, sh.y, 1300, '#ffffff', 0.6); g.fx.shake(10, 0.25); S.flash = { a: 0.25, c: '#8fe0ff' };
    for (const e of S.enemies) if (e.alive && e.seen && e.type !== 'powerup' && e.type !== 'boss') { e.stun = 2.6; e.push = 520; e.flash = 1; }
    for (const s of S.shots) { s.dead = true; SS.fx.sparks(s.x, s.y, 4, '#ffffff', 300, 20); }
    g.fx.pop(SX, S.F.bottom - 330, 'PULSE! Breathe...', { color: '#8fe0ff', size: 60, life: 1.4 });
  }

  /* ---------- update ---------- */
  function updateBoss(g, e, dt, F) {
    const ts = S.timeScale;
    e.flash = Math.max(0, e.flash - dt * 4); if (e.typer.shake > 0) e.typer.shake = Math.max(0, e.typer.shake - dt * 3);
    if (e.dyingBoss > 0) {
      e.dyingBoss -= dt; e.t += dt;
      if (Math.random() < dt * 11) SS.fx.explode(e.x + rnd(-e.hw, e.hw) * 0.9, e.y + rnd(-e.hh, e.hh) * 0.9, rnd(90, 170), { color: 'red' });
      if (Math.random() < dt * 5) { snd('boom', { vol: 0.35, rate: rnd(0.7, 1) }); g.fx.shake(10, 0.1); }
      e.x += rnd(-3, 3); if (e.dyingBoss <= 0) finishBoss(g, e);
      return;
    }
    e.t += dt * ts;
    if (e.entry < 1) {
      e.entry = Math.min(1, e.entry + dt / 3.4); const k = U.ease.outCubic(e.entry);
      e.y = lerp(e.y0, e.hoverY, k); e.x = SX; if (!e.seen && e.y - e.hh >= F.safeTop) { markSeen(e); e.targetable = true; }
    } else { e.x = SX + Math.sin(e.t * 0.42) * Math.min(260, (F.xmax - SX) * 0.4); e.y = e.hoverY + Math.sin(e.t * 0.9) * 14; }
    const hp = clamp(1 - e.typed / e.totalLetters, 0, 1);
    e.hpShown += (hp - e.hpShown) * (1 - Math.exp(-dt * 3.5));
    if (hp < 0.7 && Math.random() < dt * (hp < 0.35 ? 9 : 4)) SS.fx.puff(e.x + rnd(-e.hw, e.hw) * 0.8, e.y + rnd(-e.hh, e.hh) * 0.7, 70, 1.1, true);
    if (hp < 0.35 && Math.random() < dt * 5) SS.fx.emit({ spr: 'p_flame5', x: e.x + rnd(-e.hw, e.hw) * 0.7, y: e.y + rnd(-e.hh, e.hh) * 0.6, vy: -40, life: 0.4, s0: 60, s1: 20, a0: 0.9, a1: 0, add: true, tint: '#ff9a3c' });
    updateBossAttack(g, e, dt, F);
    e.danger = -300;
    e.chx += (e.x - e.chx) * (1 - Math.exp(-dt * 14)); e.chy = e.y + e.hh + 64;
  }

  function update(g, dt) {
    if (!S) return;
    const n = S.devSpeed || 1;
    for (let i = 0; i < n; i++) updateInner(g, dt);
  }
  function autoType(g, dt, F) {
    const A = S.auto; A.acc += dt * A.cps;
    while (A.acc >= 1) {
      A.acc -= 1;
      let t = S.lockT;
      if (!t || !t.alive || t.doomed) { const c = S.enemies.filter((e) => canType(e)); c.sort((a, b) => (b.danger || 0) - (a.danger || 0)); t = c[0]; A.acc -= A.think; }
      if (!t) { A.acc = Math.min(A.acc, 0); continue; }
      let k = t.typer.nextReq(); if (!k) continue;
      if (Math.random() < A.err) k = 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
      press(g, k);
    }
  }
  function updateInner(g, dt) {
    S.t += dt;
    const F = (S.F = field(g));
    SS.bg.update(dt, S.warp); SS.fx.update(dt);
    S.flash.a = Math.max(0, S.flash.a - dt * 2.3); S.hurtVig = Math.max(0, S.hurtVig - dt * 1.6);
    if (g.fx.pop !== S.popFn) g.fx.pop = S.popFn;
    for (const p of S.pops) p.t += dt;
    S.pops = S.pops.filter((p) => p.t < p.life);
    if (S.comboFlash) { S.comboFlash.t += dt; if (S.comboFlash.t > 1.1) S.comboFlash = null; }
    if (S.mode === 'fight' || S.mode === 'clear') S.warp = Math.max(0, S.warp - dt * 0.55);
    if (S.mode === 'map') S.warp = clamp(S.map.t < 0.8 ? S.map.t / 0.8 : S.map.t > 5.4 ? 1 : 0.55, 0, 1);
    SS.bg.pipGrow = S.mode === 'victory' ? 0 : S.sector === 4 ? clamp(0.15 + (S.wave + (S.mode === 'clear' ? 1 : 0)) / (S.perSector * 1.3), 0, 1) : 0;
    const sh = S.ship; sh.y = F.shipY; sh.flamePh += dt;
    sh.recoil = Math.max(0, sh.recoil - dt * 9); sh.shieldHit = Math.max(0, sh.shieldHit - dt * 2.2); sh.hullHit = Math.max(0, sh.hullHit - dt * 2.5);
    if (!SS.ready || g.state === 'countdown') { shipAim(g, dt, null); return; }
    const live = g.live || g.demo;
    if (g.state === 'play' || g.demo) updateBanner(dt);
    // music
    if (!g.demo && g.state === 'play' && !SS.snd.musicOn() && TM.settings.music > 0 && SS.snd.musicCtxReady !== false) SS.snd.musicStart(S.sector, 2, S.plan && S.plan.kind === 'boss');
    if ((g.state === 'over' || g.state === 'title') && SS.snd.musicOn()) SS.snd.musicStop();
    SS.snd.applyVolume();
    if (S.mode === 'dying') {
      S.dying += dt; shipAim(g, dt, null);
      if (S.dying < 1.8 && Math.random() < dt * 9) SS.fx.explode(sh.x + rnd(-45, 45), sh.y + rnd(-30, 30), rnd(70, 150), { color: 'blue' });
      if (S.dying < 0.1) { SS.fx.explode(sh.x, sh.y, 300, { color: 'blue' }); g.fx.shake(30, 0.6); S.flash = { a: 0.5, c: '#ff9a6a' }; }
      return;
    }
    if (S.mode === 'victory') { updateVictory(g, dt, F); return; }
    if (!live) return;
    // time scale
    if (S.slow > 0) S.slow -= dt; if (S.dbl > 0) S.dbl -= dt; if (S.inv > 0) S.inv -= dt; if (S.slowmo > 0) S.slowmo -= dt; if (S.puCool > 0) S.puCool -= dt;
    const tsT = (S.slow > 0 ? 0.38 : 1) * (S.slowmo > 0 ? 0.35 : 1);
    S.timeScale += (tsT - S.timeScale) * (1 - Math.exp(-dt * 6));
    if (!g.demo) { S.shieldDelay -= dt; if (S.shieldDelay <= 0 && S.shield < 100) S.shield = Math.min(100, S.shield + (g.diff === 'gentle' ? 8 : 4.5) * dt); }
    if (S.bombFx) { S.bombFx.t += dt; if (S.bombFx.t > 1.1) S.bombFx = null; }
    updateWaves(g, dt);
    if (S.mode === 'map') { S.enemies.length = 0; shipAim(g, dt, null); return; }
    // bot (attract mode)
    if (g.demo && S.mode === 'fight') {
      S.botT += dt; const iv = 1 / S.botRate;
      while (S.botT >= iv) {
        S.botT -= iv;
        let t = S.lockT;
        if (!t || !t.alive || t.doomed) {
          const c = S.enemies.filter((e) => canType(e) && e.type !== 'boss' && e.type !== 'ace'); c.sort((a, b) => (b.danger || 0) - (a.danger || 0)); t = c[0]; S.botT -= 0.1;
        }
        if (t) { const k = t.typer.nextReq(); if (k) press(g, k); }
      }
    }
    if (S.auto && g.state === 'play' && S.mode === 'fight') autoType(g, dt, F);
    // enemies
    for (const e of S.enemies) {
      if (!e.alive) continue;
      if (e.type === 'boss') { updateBoss(g, e, dt, F); continue; }
      stepEnemy(g, e, dt, F);
      if (e.delay > 0) continue;
      if (e.seen) e.seenT += dt;
      if (e.bombT !== undefined) { e.bombT -= dt; if (e.bombT <= 0) kill(g, e, { bomb: true }); continue; }
      if (e.doomed && e.killT !== undefined) { e.killT -= dt; if (e.killT <= 0) { kill(g, e, { typer: e.typer }); continue; } }
      if (e.totalLetters != null) e.hpShown += (1 - e.typed / e.totalLetters - e.hpShown) * (1 - Math.exp(-dt * 4));
      // impact
      if (e.type === 'powerup') { if (e.y > F.impactY - 20) { e.alive = false; SS.fx.ring(e.x, e.y, 160, "#ffffff", 0.3); if (S.lockT === e) release(true); } }
      else if (e.y >= F.impactY || (e.type === 'kamikaze' && e.armT <= 0 && Math.hypot(e.x - sh.x, e.y - sh.y) < 70)) {
        if (e.doomed) kill(g, e, { typer: e.typer }); else impact(g, e, F);
        continue;
      }
      // chip anchor
      const ax = e.type === 'ufo' ? e.ox || e.x : e.x, ay = e.type === 'ufo' ? e.cy + e.R * 0.5 : e.y;
      e.chx += (ax - e.chx) * (1 - Math.exp(-dt * 12));
      { // chip sits under the ship; near the defence line it hops above so it never sinks into the planet / bottom HUD
        const off = e.type === 'powerup' ? 60 : e.big ? 58 : 42; const below = ay + e.hh + off;
        const want = below > F.impactY - 10 ? Math.max(F.safeTop + 40, ay - e.hh - off) : below;
        if (!e.seen || e.chy === undefined) e.chy = want; else e.chy += (want - e.chy) * (1 - Math.exp(-dt * 16));
      }
    }
    S.enemies = S.enemies.filter((e) => e.alive);
    if (S.lockT && !S.lockT.alive) { S.lockT = null; }
    updateBolts(g, dt); updateShots(g, dt);
    // aim
    let tg = S.lockT && S.lockT.alive ? S.lockT : (S.t - S.lastFire.t < 0.45 && S.lastFire.e && S.lastFire.e.alive ? S.lastFire.e : null);
    shipAim(g, dt, tg);
    if (!g.demo) { const m = g.score.combo; if (S.lastCombo >= 6 && m === 0) S.comboLostT = 1.2; S.lastCombo = m; }
    S.comboLostT = Math.max(0, S.comboLostT - dt);
  }
  function shipAim(g, dt, tg) {
    const sh = S.ship; const want = tg ? clamp(Math.atan2(tg.x - sh.x, -(tg.y - sh.y)), -1.25, 1.25) : Math.sin(S.t * 0.8) * 0.04;
    sh.rot += (want - sh.rot) * (1 - Math.exp(-dt * 11));
    const ws = tg ? clamp((tg.x - SX) * 0.14, -140, 140) : 0; sh.slide += (ws - sh.slide) * (1 - Math.exp(-dt * 4)); sh.x = SX + sh.slide;
  }
  function updateVictory(g, dt, F) {
    S.vt += dt; shipAim(g, dt, null); S.timeScale = 1;
    if (S.vt > 0.4 && Math.random() < dt * 3.2) {
      const x = SX + rnd(-700, 700), y = (F.top + F.bottom) / 2 + rnd(-380, 120); const cols = ['#ffe066', '#7ee8ff', '#ff8fd0', '#9dff9d', '#ffffff'];
      SS.fx.glow(x, y, 380, U.pick(cols), 0.5, 0.7); SS.fx.ring(x, y, 420, U.pick(cols), 0.7); SS.fx.confettiStars(x, y, 14, cols); SS.fx.sparks(x, y, 18, U.pick(cols), 600, 36); snd('power' + U.pick(['1', '2', '3']), { vol: 0.35 }); snd('boom', { vol: 0.2, rate: 1.4 });
    }
    if (S.vt > 1.2 && Math.random() < dt * 5) SS.fx.emit({ spr: 'p_symbol1', x: SX + rnd(-230, 230), y: (F.top + F.bottom) / 2 + 150, vx: rnd(-20, 20), vy: -rnd(70, 140), life: 2.4, s0: 46, s1: 70, a0: 1, a1: 0, add: true, tint: '#ff7fb5', rot: rnd(-0.3, 0.3), fadeIn: 0.2 });
    if (S.vt > 6.2 && g.state === 'play') {
      g.end({ win: true, delay: 300, title: 'Planet Pip is saved!', sub: 'You swept every sector clean!', targetMet: true, stats: [['Sectors', 5]] });
    }
  }

  /* ---------- drawing ---------- */
  const FIRE = ['ef_fire01', 'ef_fire04', 'ef_fire05', 'ef_fire11', 'ef_fire14', 'ef_fire15'];
  function band(ctx, v, y0, y1) { ctx.fillRect(v.x - 120, y0, v.w + 240, y1 - y0); }

  function drawDefenseLine(ctx, g, F) {
    const v = F.v; const y = F.impactY + 18; const sp = S.shield / 100;
    const tint = S.inv > 0 ? '#ffe066' : sp > 0.35 ? '#4fd0ff' : '#ff6a6a';
    const flick = S.shield <= 0 ? 0.4 + 0.4 * Math.sin(S.t * 40) : 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const base = (S.inv > 0 ? 0.55 : 0.12 + 0.2 * sp) * flick;
    const gr = ctx.createLinearGradient(0, y - 90, 0, y + 6); gr.addColorStop(0, U.hexA(tint, 0)); gr.addColorStop(1, U.hexA(tint, base * 0.55));
    ctx.fillStyle = gr; ctx.fillRect(v.x - 120, y - 90, v.w + 240, 96);
    for (const [w, a] of [[16, 0.09], [6, 0.28], [2.2, 0.85]]) { ctx.strokeStyle = U.hexA(tint, a * base * 2.4 > 1 ? 1 : a * base * 2.4); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(v.x - 120, y); ctx.lineTo(v.x + v.w + 120, y); ctx.stroke(); }
    ctx.setLineDash([46, 30]); ctx.lineDashOffset = -S.t * 90; ctx.strokeStyle = U.hexA('#ffffff', 0.35 * base * 2); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(v.x - 120, y - 5); ctx.lineTo(v.x + v.w + 120, y - 5); ctx.stroke();
    ctx.restore();
  }

  function drawEnemy(ctx, e) {
    if (e.delay > 0 || !e.alive) return;
    const T = e.T;
    if (e.type === 'powerup') return drawPower(ctx, e);
    if (e.type === 'ufo') { SS.spr(ctx, 'p_circle2', e.ox || e.x, e.cy, { max: e.R * 2.6, a: 0.16, tint: '#9ff0ff' }); }
    const rot = e.rot + e.baseRot;
    if (e.type === 'boss') { ctx.globalCompositeOperation = 'lighter'; const pu = 0.3 + 0.12 * Math.sin(S.t * 3); SS.spr(ctx, 'p_circle5', e.x, e.y, { max: Math.max(e.hw, e.hh) * 3.4, a: pu, tint: e.def.glow }); SS.spr(ctx, 'p_circle5', e.x, e.y + e.hh * 0.4, { max: e.hw * 2.4, a: 0.25 + e.charge * 0.5, tint: '#ff5a5a' }); ctx.globalCompositeOperation = 'source-over'; }
    // engine glow
    if (e.type !== 'meteor' && e.type !== 'boss') { ctx.globalCompositeOperation = 'lighter'; const ex = e.x - Math.sin(e.rot) * e.hh * 0.9, ey = e.y - Math.cos(e.rot) * e.hh * 0.9; SS.spr(ctx, 'p_circle5', ex, ey, { max: e.big ? 120 : 70 + Math.sin(S.t * 18 + e.id) * 8, a: 0.55, tint: T.glow }); ctx.globalCompositeOperation = 'source-over'; }
    if (e.type === 'boss' && e.def.engine) { ctx.globalCompositeOperation = 'lighter'; SS.spr(ctx, 'p_muzzle1', e.x, e.y - e.hh - 30 - Math.sin(S.t * 30) * 8, { sw: 120, sh: 220, rot: Math.PI, a: 0.8, ay: 0.1, tint: '#ffb066' }); ctx.globalCompositeOperation = 'source-over'; }
    SS.spr(ctx, e.spr, e.x, e.y, { s: e.sc, rot });
    if (e.flash > 0) SS.spr(ctx, e.spr, e.x, e.y, { s: e.sc, rot, tint: '#ffffff', a: e.flash * 0.75 });
    if (e.charge > 0) { ctx.globalCompositeOperation = 'lighter'; SS.spr(ctx, e.spr, e.x, e.y, { s: e.sc, rot, tint: '#ff2a2a', a: e.charge * (0.45 + 0.35 * Math.sin(S.t * 30)) }); SS.spr(ctx, 'p_circle5', e.x, e.y + e.hh * 0.5, { max: 160 * e.charge + 40, a: 0.7 * e.charge, tint: '#ff5050' }); ctx.globalCompositeOperation = 'source-over'; }
    if (e.type === 'shielded' && !e.shieldGone) {
      const pulse = 1 + Math.sin(S.t * 5 + e.id) * 0.04; ctx.globalCompositeOperation = 'lighter';
      SS.spr(ctx, 'ef_shield3', e.x, e.y, { sw: e.hw * 3.0 * pulse, sh: e.hw * 2.85 * pulse, a: 0.95, tint: '#7fd0ff', rot: Math.PI });
      SS.spr(ctx, 'p_circle5', e.x, e.y, { max: e.hw * 3.0, a: 0.28, tint: '#5fb6ff' }); ctx.globalCompositeOperation = 'source-over';
    }
    // HP bar for aces
    if (e.isAce && !e.doomed) drawMiniBar(ctx, e.x, e.y - e.hh - 26, 190, e.hpShown);
  }
  function drawMiniBar(ctx, x, y, w, k) {
    ctx.save(); ctx.fillStyle = 'rgba(8,10,34,0.75)'; ctx.fill(P.rr(x - w / 2 - 4, y - 9, w + 8, 18, 9));
    ctx.fillStyle = '#ff5a8a'; if (k > 0.02) ctx.fill(P.rr(x - w / 2, y - 5, w * clamp(k, 0.04, 1), 10, 5)); ctx.restore();
  }
  function drawPower(ctx, e) {
    const P2 = SS.POWER[e.kind]; const bob = Math.sin(S.t * 3 + e.ph) * 5;
    ctx.globalCompositeOperation = 'lighter'; SS.spr(ctx, 'p_circle5', e.x, e.y + bob, { max: 150 + Math.sin(S.t * 6) * 12, a: 0.55, tint: P2.color }); SS.spr(ctx, 'p_circle2', e.x, e.y + bob, { max: 110 + (S.t * 90) % 50, a: 0.5 - ((S.t * 90) % 50) / 110, tint: P2.color }); ctx.globalCompositeOperation = 'source-over';
    SS.spr(ctx, e.spr, e.x, e.y + bob, { s: 1.9, rot: e.rot });
    drawPowerIcon(ctx, e.kind, e.x, e.y + bob);
    if (e.flash > 0) SS.spr(ctx, e.spr, e.x, e.y + bob, { s: 1.9, tint: '#fff', a: e.flash });
    D.text(ctx, P2.label, e.x, e.y + bob - 58, { font: KV(22), size: 22, color: '#ffffff', outline: 8 });
  }
  function drawPowerIcon(ctx, kind, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (kind === 'shield') SS.spr(ctx, 'pu_shield_silver', 0, 1, { s: 1.45 });
    else if (kind === 'bomb') { ctx.fillStyle = '#2a2230'; ctx.beginPath(); ctx.arc(-1, 4, 15, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-7, -1, 4, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(6, -8); ctx.quadraticCurveTo(12, -17, 18, -15); ctx.stroke(); SS.spr(ctx, 'ef_star3', 20, -17, { s: 1.1 }); }
    else if (kind === 'slow') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 1, 15, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(0, -9); ctx.moveTo(0, 1); ctx.lineTo(8, 5); ctx.stroke(); }
    else if (kind === 'double') { ctx.font = '800 30px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 6; ctx.strokeStyle = '#8a5a00'; ctx.strokeText('x2', 0, 3); ctx.fillStyle = '#fff'; ctx.fillText('x2', 0, 3); }
    else if (kind === 'repair') { ctx.fillStyle = '#fff'; ctx.fill(P.rr(-5, -15, 10, 30, 3)); ctx.fill(P.rr(-15, -5, 30, 10, 3)); }
    ctx.restore();
  }

  function drawShip(ctx, g, F) {
    const sh = S.ship; if (S.mode === 'dying' && S.dying > 0.15) return;
    if (S.mode === 'map') return;
    const sc = 1.55; const bob = Math.sin(S.t * 2.3) * 4;
    const x = sh.x - Math.sin(sh.rot) * sh.recoil * 7, y = sh.y + bob + Math.cos(sh.rot) * sh.recoil * 7;
    ctx.save(); ctx.translate(x, y); ctx.rotate(sh.rot);
    // engine flames
    const fl = 0.85 + 0.25 * Math.sin(S.t * 40) + Math.random() * 0.1;
    ctx.globalCompositeOperation = 'lighter';
    for (const side of [-1, 1]) {
      const fr = FIRE[Math.floor(S.t * 22 + (side > 0 ? 3 : 0)) % FIRE.length];
      SS.spr(ctx, fr, side * 21 * sc * 0.8, 29 * sc, { sw: 14 * sc * 1.1, sh: 34 * sc * fl, ay: 0.05, a: 1 });
      SS.spr(ctx, 'p_circle5', side * 21 * sc * 0.8, 33 * sc, { max: 40 * sc * fl, a: 0.7, tint: '#8fd6ff' });
    }
    SS.spr(ctx, 'p_muzzle1', 0, 36 * sc, { sw: 30 * sc, sh: 55 * sc * fl, ay: 0.08, rot: Math.PI, a: 0.55, tint: '#9fe0ff' });
    ctx.globalCompositeOperation = 'source-over';
    SS.spr(ctx, 'ship1_blue', 0, 0, { s: sc });
    const hp = S.hull;
    if (hp < 75) SS.spr(ctx, 'dmg1', 0, 0, { s: sc }); if (hp < 50) SS.spr(ctx, 'dmg2', 0, 0, { s: sc }); if (hp < 28) SS.spr(ctx, 'dmg3', 0, 0, { s: sc });
    if (sh.hullHit > 0) SS.spr(ctx, 'ship1_blue', 0, 0, { s: sc, tint: '#ff6a6a', a: sh.hullHit * 0.7 });
    if (S.dbl > 0) { ctx.globalCompositeOperation = 'lighter'; SS.spr(ctx, 'ship1_blue', 0, 0, { s: sc, tint: '#ffd23f', a: 0.25 + 0.15 * Math.sin(S.t * 8) }); ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
    // hull smoke when badly hurt
    if (hp < 40 && Math.random() < 0.3) SS.fx.puff(sh.x + rnd(-20, 20), sh.y + rnd(-5, 15), 46, 1, true, rnd(-15, 15), rnd(-70, -30));
    // shield bubble
    const a = Math.max(sh.shieldHit * 0.9, S.inv > 0 ? 0.5 + 0.15 * Math.sin(S.t * 9) : 0.08 + 0.1 * (S.shield / 100));
    if (a > 0.02) { ctx.globalCompositeOperation = 'lighter'; const tint = S.inv > 0 ? '#ffe566' : S.shield > 0 ? '#6fd8ff' : '#ff7a7a'; SS.spr(ctx, 'p_circle5', sh.x, sh.y, { max: 230, a: a * 0.6, tint }); SS.spr(ctx, 'ef_shield3', sh.x, sh.y - 6, { sw: 190, sh: 180, a: Math.min(1, a * 1.4), tint, rot: sh.hitAng + Math.PI / 2 + Math.PI }); ctx.globalCompositeOperation = 'source-over'; }
  }
  function drawBolts(ctx) {
    for (const b of S.bolts) {
      const rot = Math.atan2(b.vx, -b.vy);
      ctx.globalCompositeOperation = 'lighter'; SS.spr(ctx, 'p_circle5', b.x, b.y, { max: b.big ? 90 : 62, a: 0.75, tint: b.col }); ctx.globalCompositeOperation = 'source-over';
      SS.spr(ctx, b.spr, b.x, b.y, { s: b.big ? 2.8 : 2.1, rot });
      if (b.big) { ctx.globalCompositeOperation = 'lighter'; SS.spr(ctx, 'p_star8', b.x, b.y, { max: 70, a: 0.9, rot: S.t * 10, tint: b.col }); ctx.globalCompositeOperation = 'source-over'; }
    }
  }
  function drawEnemyShots(ctx) {
    for (const s of S.shots) {
      if (s.delay > 0) continue;
      if (s.kind === 'laser') { const rot = Math.atan2(s.hx, -s.hy); ctx.globalCompositeOperation = 'lighter'; SS.spr(ctx, 'p_circle5', s.x, s.y, { max: 70, a: 0.8, tint: '#ff4a4a' }); ctx.globalCompositeOperation = 'source-over'; SS.spr(ctx, 'laserRed02', s.x, s.y, { s: 2.3, rot }); }
      else { const rot = Math.atan2(s.hx, -s.hy); ctx.globalCompositeOperation = 'lighter'; SS.spr(ctx, 'p_circle5', s.x, s.y, { max: 80, a: 0.7, tint: '#ff7a3a' }); ctx.globalCompositeOperation = 'source-over'; SS.spr(ctx, 'missile36', s.x, s.y, { s: 1.9, rot }); }
    }
    const b = S.boss;
    if (b && b.alive && b.beam && b.beam.t > 0) {
      const bm = b.beam, sh = S.ship; const sx = b.x, sy = b.y + b.hh * 0.7;
      const firing = bm.t >= bm.charge, k = firing ? 1 : bm.t / bm.charge;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      const w = firing ? 34 + Math.sin(S.t * 60) * 5 : 3 + k * 6;
      ctx.strokeStyle = firing ? 'rgba(255,60,60,0.35)' : 'rgba(255,120,120,0.35)'; ctx.lineWidth = w * 2.4; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sh.x, sh.y - 40); ctx.stroke();
      ctx.strokeStyle = firing ? 'rgba(255,120,100,0.8)' : 'rgba(255,170,170,0.6)'; ctx.lineWidth = w; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = w * 0.35; ctx.stroke();
      ctx.restore();
      SS.spr(ctx, 'p_circle5', sx, sy, { max: 120 + k * 80, a: 0.9, tint: '#ff5a5a' });
    }
  }
  function chipFor(ctx, g, e, F) {
    const size = e.chipSize || 40;
    let sz = size;
    if (e.item.kind === 'sentence') { const need = D.chipSize(ctx, e.typer, size).w; const maxW = Math.min(F.v.w - 60, 1500); if (need > maxW) sz = Math.max(30, Math.floor(size * maxW / need)); }
    const info = D.chipSize(ctx, e.typer, sz);
    const x = clamp(e.chx, F.v.x + info.w / 2 + 14, F.v.x + F.v.w - info.w / 2 - 14);
    return { x, y: e.chy, size: sz };
  }
  function chipRect(ctx, g, e, c) {
    const info = D.chipSize(ctx, e.typer, c.size); const sc = e.locked ? 1.08 : 1;
    let x0 = c.x - info.w / 2 * sc - 4, x1 = c.x + info.w / 2 * sc + 4, y0 = c.y - info.h / 2 * sc - 4, y1 = c.y + info.h / 2 * sc + 8;
    if (g.hint && e.typer.item.hint) { const hs = Math.round(c.size * 0.52); ctx.font = D.FONT_JA(hs); const tw = ctx.measureText(e.typer.item.hint).width + hs; y1 = c.y + info.h / 2 * sc + hs * 1.7; x0 = Math.min(x0, c.x - tw / 2); x1 = Math.max(x1, c.x + tw / 2); }
    return { x0, y0, x1, y1 };
  }
  function drawChips(ctx, g, F) {
    const list = S.enemies.filter((e) => e.alive && e.seen && e.delay <= 0);
    list.sort((a, b) => (a.locked ? 1 : 0) - (b.locked ? 1 : 0));
    S.chipRects = [];
    for (const e of list) {
      const c = chipFor(ctx, g, e, F); const accent = e.type === 'shielded' && !e.shieldGone ? '#2F7BFF' : e.T.accent;
      if (e.type === 'boss' && !e.targetable && !e.dyingBoss) continue;
      if (e.type === 'boss' && e.dyingBoss) continue;
      S.chipRects.push(Object.assign(chipRect(ctx, g, e, c), { id: e.id, type: e.type, ey: e.y, typable: canType(e) }));
      if (e.type === 'shielded' && !e.shieldGone) { D.text(ctx, 'SHIELD!', c.x, c.y - 44, { font: KV(18), size: 18, color: '#bfe6ff', outline: 7 }); }
      D.chip(ctx, c.x, c.y, e.typer, { size: c.size, accent, locked: e.locked, hint: g.hint, alpha: (e.doomed ? 0.5 : 1) * Math.min(1, 0.4 + e.seenT * 6), dim: false });
    }
  }
  /* floating score / info pops: drawn here (not by the shared FX) so they can slide out of the way of word chips and live ships */
  function popRect(ctx, p, x, y) {
    ctx.font = `800 ${p.size}px "Baloo 2", sans-serif`; const w = ctx.measureText(p.str).width + 24, h = p.size * 1.15;
    return { x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 };
  }
  const hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  function popFree(r, F) {
    if (r.y0 < F.safeTop || r.x0 < F.v.x + 8 || r.x1 > F.v.x + F.v.w - 8 || r.y1 > F.bottom - 260) return false;
    for (const c of S.chipRects) if (hit(r, c)) return false;
    for (const e of S.enemies) if (e.alive && e.seen && e.type !== 'boss' && !e.doomed && hit(r, { x0: e.x - e.hw, x1: e.x + e.hw, y0: e.y - e.hh, y1: e.y + e.hh })) return false;
    return true;
  }
  function drawPops(ctx, g, F) {
    S.popRects = [];
    for (const p of S.pops) {
      const k = p.t / p.life; const rise = k * 50;
      let x = p.x + p.ox, y = p.y + p.oy - rise;
      let r = popRect(ctx, p, x, y);
      if (!popFree(r, F)) {
        let best = null, bd = 1e9;
        for (let dy = -420; dy <= 420; dy += 60) for (let dx = -600; dx <= 600; dx += 100) {
          const q = popRect(ctx, p, p.x + dx, p.y - rise + dy); const d = dx * dx * 0.5 + dy * dy;
          if (d < bd && popFree(q, F)) { bd = d; best = [dx, dy]; }
        }
        if (best) { p.ox = best[0]; p.oy = best[1]; x = p.x + p.ox; y = p.y + p.oy - rise; r = popRect(ctx, p, x, y); }
      }
      S.popRects.push(r);
      const sc = k < 0.2 ? U.ease.outBack(k / 0.2) : 1;
      ctx.save(); ctx.globalAlpha = (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1) * 0.95; ctx.translate(x, y); ctx.scale(sc, sc);
      D.text(ctx, p.str, 0, 0, { size: p.size, color: p.color, outline: 10 }); ctx.restore();
    }
  }
  function drawReticle(ctx, g, F) {
    const e = S.lockT; if (!e || !e.alive) return; const sh = S.ship;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.setLineDash([8, 16]); ctx.lineDashOffset = -S.t * 120; ctx.strokeStyle = 'rgba(130,225,255,0.38)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sh.x, sh.y - 40); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.setLineDash([]);
    const r = Math.max(e.hw, e.hh) * 2.35 + 10 + Math.sin(S.t * 7) * 4;
    SS.spr(ctx, 'p_magic3', e.x, e.y, { max: r, rot: S.t * 0.9, a: 0.95, tint: '#ffe066' });
    ctx.restore();
  }

  /* ---------- HUD ---------- */
  function bar(ctx, x, y, w, h, k, c1, c2, label, icon) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,34,0.72)'; ctx.fill(P.rr(x - 5, y - 5, w + 10, h + 10, (h + 10) / 2));
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill(P.rr(x, y, w, h, h / 2));
    if (k > 0.005) { const gr = ctx.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, c1); gr.addColorStop(1, c2); ctx.fillStyle = gr; ctx.fill(P.rr(x, y, Math.max(h, w * k), h, h / 2)); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill(P.rr(x + 6, y + 3, Math.max(0, w * k - 12), h * 0.28, h * 0.14)); }
    ctx.restore();
    D.text(ctx, label, x + 14, y + h / 2 + 1, { font: KV(15), size: 15, color: '#fff', align: 'left', outline: 5 });
  }
  function drawHUD(ctx, g, F) {
    if (g.state !== 'play' && g.state !== 'over' && g.state !== 'paused') return;
    if (S.mode === 'victory') return;
    const x0 = 56, yb = F.bottom - 128;
    // shield + hull
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,34,0.35)'; ctx.fill(P.rr(x0 - 20, yb - 22, 430, 112, 26));
    ctx.restore();
    const low = S.hull < 30;
    bar(ctx, x0 + 52, yb - 4, 310, 26, S.shield / 100, '#8fe9ff', '#2f9bff', 'SHIELD');
    bar(ctx, x0 + 52, yb + 42, 310, 26, S.hull / 100, S.hull > 50 ? '#9dff9d' : S.hull > 28 ? '#ffe066' : '#ff8a8a', S.hull > 50 ? '#2bb673' : S.hull > 28 ? '#ffa31a' : '#e5383b', 'HULL');
    SS.spr(ctx, 'pu_shield_silver', x0 + 20, yb + 9, { s: 1.5, tint: S.inv > 0 ? '#ffe066' : null });
    SS.spr(ctx, 'life_blue', x0 + 20, yb + 55, { s: 1.5 });
    if (low && Math.sin(S.t * 10) > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; SS.spr(ctx, 'p_circle5', x0 + 20, yb + 55, { max: 60, a: 0.8, tint: '#ff5050' }); ctx.restore(); }
    // combo meter (bottom right)
    const cx = W - 140, cy = F.bottom - 92;
    const combo = g.score.combo, mult = g.score.mult;
    const lo = mult === 1 ? 0 : mult === 2 ? 10 : mult === 3 ? 25 : 50, hi = mult === 1 ? 10 : mult === 2 ? 25 : mult === 3 ? 50 : 50;
    const k = mult >= 4 ? 1 : (combo - lo) / (hi - lo);
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,34,0.5)'; ctx.beginPath(); ctx.arc(cx, cy, 70, 0, 7); ctx.fill();
    ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(cx, cy, 58, 0, 7); ctx.stroke();
    const mc = ['#9fe6ff', '#8dff9d', '#ffd23f', '#ff7ac8'][mult - 1];
    ctx.strokeStyle = mc; ctx.beginPath(); ctx.arc(cx, cy, 58, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(k, 0.001, 1)); ctx.stroke();
    ctx.restore();
    D.text(ctx, 'x' + mult, cx, cy - 8, { font: BD(54), size: 54, color: mc, outline: 10 });
    D.text(ctx, combo >= 2 ? `COMBO ${combo}` : 'COMBO', cx, cy + 32, { font: BD(21, 700), size: 21, color: '#fff', outline: 6 });
    if (S.comboFlash) { const f = S.comboFlash, kk = f.t / 1.1; ctx.save(); ctx.globalAlpha = kk > 0.7 ? 1 - (kk - 0.7) / 0.3 : 1; D.text(ctx, f.text + '!', cx, cy - 150 - kk * 20, { font: KV(34), size: 34, color: f.color, outline: 9 }); ctx.restore(); }
    if (S.comboLostT > 0) D.text(ctx, 'combo lost', cx, cy - 92, { size: 28, color: '#ff9a9a', outline: 8 });
    // pulse indicator + power-up timers
    let px = cx - 120;
    const timers = [];
    if (S.dbl > 0) timers.push(['double', S.dbl / 12]); if (S.slow > 0) timers.push(['slow', S.slow / 8]); if (S.inv > 0) timers.push(['shield', S.inv / 7]);
    for (const [kind, kk] of timers) {
      const P2 = SS.POWER[kind];
      ctx.save(); ctx.fillStyle = 'rgba(8,10,34,0.6)'; ctx.beginPath(); ctx.arc(px, cy + 8, 36, 0, 7); ctx.fill(); ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.strokeStyle = P2.color; ctx.beginPath(); ctx.arc(px, cy + 8, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * kk); ctx.stroke(); ctx.restore();
      SS.spr(ctx, P2.base, px, cy + 8, { s: 1.15 }); drawPowerIcon(ctx, kind, px, cy + 8);
      px -= 82;
    }
    // pulse
    const pr = S.pulse > 0;
    D.text(ctx, pr ? 'ENTER = PULSE' : 'pulse used', W - 60, F.bottom - 188, { font: KV(17), size: 17, color: pr ? '#8fe9ff' : 'rgba(255,255,255,0.4)', align: 'right', outline: 6 });
    // boss bar
    const b = S.boss;
    if (b && b.alive && !b.dyingBoss && b.seen && !S.banner) drawBossBar(ctx, g, F, b);
    if (S.mode === 'fight' && S.plan && !g.demo) { /* sector progress is in the DOM HUD */ }
  }
  function drawBossBar(ctx, g, F, b) {
    const w = Math.min(820, F.v.w - 140), x = SX - w / 2, y = F.hudTop + 38, h = 30;
    const hp = clamp(1 - b.typed / b.totalLetters, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,34,0.8)'; ctx.fill(P.rr(x - 8, y - 8, w + 16, h + 16, 24));
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill(P.rr(x, y, w, h, 15));
    // chewed-away trail (lags behind) then live fill
    if (b.hpShown > hp) { ctx.fillStyle = '#ffe9a8'; ctx.fill(P.rr(x, y, Math.max(h, w * b.hpShown), h, 15)); }
    const gr = ctx.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#ff9a8a'); gr.addColorStop(1, '#e5383b');
    ctx.fillStyle = gr; if (hp > 0.005) ctx.fill(P.rr(x, y, Math.max(h, w * hp), h, 15));
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; if (hp > 0.05) ctx.fill(P.rr(x + 8, y + 4, Math.max(0, w * hp - 16), 7, 3.5));
    // phase ticks
    if (b.phases.length > 1) { let acc = 0; ctx.fillStyle = 'rgba(8,10,34,0.8)'; for (let i = 0; i < b.phases.length - 1; i++) { acc += b.phases[i].len; ctx.fillRect(x + w * (1 - acc / b.totalLetters) - 2, y, 4, h); } }
    ctx.restore();
    D.text(ctx, b.name.toUpperCase(), SX, y - 22, { font: KV(24), size: 24, color: '#fff', outline: 8 });
    if (b.phases.length > 1) D.text(ctx, `ARMOR ${b.pi + 1}/${b.phases.length}`, x + w, y - 22, { font: KV(15), size: 15, color: '#ffd06b', align: 'right', outline: 6 });
  }

  /* small plate in the strip between the HUD and the play field; F.safeTop guarantees no word chip is ever drawn here */
  function bannerRect(F) { const w = 620, h = 84; return { x0: SX - w / 2, x1: SX + w / 2, y0: F.hudTop + 10, y1: F.hudTop + 10 + h }; }
  function drawBanner(ctx, g, F) {
    const b = S.banner; S.bannerRect = null;
    if (!b || g.demo || (g.state !== 'play' && g.state !== 'paused')) return;
    const r = bannerRect(F); S.bannerRect = r;
    const t = b.t, k = t < 0.3 ? U.ease.outBack(t / 0.3) : 1; const a = t < 0.15 ? t / 0.15 : t > b.dur - 0.35 ? clamp((b.dur - t) / 0.35, 0, 1) : 1;
    const cx = SX, cy = (r.y0 + r.y1) / 2, w = r.x1 - r.x0, h = r.y1 - r.y0;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(k, k);
    const plate = P.rr(-w / 2, -h / 2, w, h, 30);
    ctx.fillStyle = b.boss ? 'rgba(150,12,26,0.88)' : 'rgba(10,14,48,0.78)'; ctx.fill(plate);
    ctx.lineWidth = 5; ctx.strokeStyle = b.boss ? '#ffd23f' : (b.color || '#fff'); ctx.stroke(plate);
    if (b.boss) { ctx.save(); ctx.clip(plate); ctx.fillStyle = '#ffd23f'; for (let x = -w / 2 - 60 + ((S.t * 60) % 60); x < w / 2; x += 60) { ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x + 22, -h / 2); ctx.lineTo(x + 2, -h / 2 + 8); ctx.lineTo(x - 20, -h / 2 + 8); ctx.fill(); ctx.beginPath(); ctx.moveTo(x, h / 2); ctx.lineTo(x + 22, h / 2); ctx.lineTo(x + 2, h / 2 - 8); ctx.lineTo(x - 20, h / 2 - 8); ctx.fill(); } ctx.restore(); }
    const main = b.top ? `${b.top} · ${b.title}` : b.title;
    if (b.sub) { D.text(ctx, main, 0, -14, { font: KV(36), size: 36, color: '#fff', outline: 10 }); D.text(ctx, b.sub, 0, 22, { size: 26, color: b.boss ? '#ffe9a8' : (b.color || '#fff'), outline: 8 }); }
    else D.text(ctx, main, 0, 0, { font: KV(40), size: 40, color: '#fff', outline: 10 });
    ctx.restore();
  }

  function drawOverlays(ctx, g, F) {
    const v = F.v;
    if (S.slow > 0 || S.timeScale < 0.8) { const k = clamp((1 - S.timeScale) * 1.6, 0, 1); ctx.fillStyle = `rgba(60,140,255,${0.13 * k})`; ctx.fillRect(v.x - 100, v.y - 100, v.w + 200, v.h + 200); }
    if (S.hurtVig > 0 || (S.hull < 30 && !g.demo)) {
      const a = Math.max(S.hurtVig * 0.5, S.hull < 30 ? 0.18 + 0.12 * Math.sin(S.t * 6) : 0);
      const cx = v.x + v.w / 2, cy = v.y + v.h / 2, r = Math.hypot(v.w, v.h) / 2;
      const gr = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r); gr.addColorStop(0, 'rgba(255,40,40,0)'); gr.addColorStop(1, `rgba(255,40,40,${a})`);
      ctx.fillStyle = gr; ctx.fillRect(v.x - 100, v.y - 100, v.w + 200, v.h + 200);
    }
    if (S.flash.a > 0.01) { ctx.fillStyle = U.hexA(S.flash.c, clamp(S.flash.a, 0, 1)); ctx.fillRect(v.x - 100, v.y - 100, v.w + 200, v.h + 200); }
  }

  function drawMap(ctx, g, F) {
    const m = S.map, v = F.v, t = m.t; const a = clamp(t / 0.7, 0, 1) * (t > 5.6 ? clamp(1 - (t - 5.6) / 0.6, 0, 1) : 1);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(5,7,28,0.82)'; ctx.fillRect(v.x - 100, v.y - 100, v.w + 200, v.h + 200);
    const cy = (F.top + F.bottom) / 2 + 20;
    D.text(ctx, `SECTOR ${m.from + 1} CLEARED!`, SX, cy - 330, { font: KV(76), size: 76, color: '#fff', outline: 16 });
    const nxt = SS.SECTORS[m.to];
    D.text(ctx, `Next: ${nxt.name}`, SX, cy - 250, { size: 54, color: nxt.accent, outline: 12 });
    D.text(ctx, nxt.sub, SX, cy - 196, { size: 34, color: '#d9e4ff', outline: 8, font: BD(34, 600) });
    const pts = []; const sp = 340;
    for (let i = 0; i < 5; i++) pts.push([SX + (i - 2) * sp, cy + 30 + Math.sin(i * 1.7) * 46]);
    // path
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const done = i < m.from; ctx.setLineDash(done ? [] : [4, 18]); ctx.strokeStyle = done ? '#7dff9b' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = done ? 7 : 6; ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke(); }
    ctx.setLineDash([]);
    for (let i = 0; i < 5; i++) {
      const sec = SS.SECTORS[i]; const [x, y] = pts[i]; const cur = i === m.to, done = i <= m.from; const size = i === 4 ? 190 : cur ? 160 : 120;
      const pl = i === 4 ? 3 : sec.map;
      ctx.globalCompositeOperation = 'lighter'; SS.spr(ctx, 'p_circle5', x, y, { max: size * 1.8, a: cur ? 0.5 : 0.2, tint: sec.tint }); ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a * (done || cur ? 1 : 0.55); const im = SS.planets[pl]; if (im) ctx.drawImage(im, x - size / 2, y - size / 2, size, size); ctx.globalAlpha = a;
      if (done) { ctx.fillStyle = '#2bb673'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x + size * 0.36, y - size * 0.36, 24, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x + size * 0.36 - 11, y - size * 0.36); ctx.lineTo(x + size * 0.36 - 3, y - size * 0.36 + 9); ctx.lineTo(x + size * 0.36 + 12, y - size * 0.36 - 9); ctx.stroke(); }
      if (cur) { ctx.strokeStyle = sec.accent; ctx.lineWidth = 6; ctx.setLineDash([14, 12]); ctx.lineDashOffset = -S.t * 30; ctx.beginPath(); ctx.arc(x, y, size * 0.62, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
      D.text(ctx, i === 4 ? 'Planet Pip' : sec.name, x, y + size / 2 + 36, { size: 32, color: cur || done ? '#fff' : '#9aa7d6', outline: 9 });
      if (i === 4) { D.text(ctx, 'needs help!', x, y + size / 2 + 74, { size: 28, color: '#ffd66b', outline: 8 }); }
    }
    // ship flying along the path
    const ft = clamp((t - 1.0) / 3.4, 0, 1), e = U.ease.inOut(ft); const A = pts[m.from], B = pts[m.to];
    const sx = lerp(A[0] + 90, B[0] - 90, e), sy = lerp(A[1], B[1], e) - 10 + Math.sin(t * 4) * 5;
    const ang = Math.atan2(B[0] - A[0], -(B[1] - A[1]));
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang);
    ctx.globalCompositeOperation = 'lighter'; SS.spr(ctx, FIRE[Math.floor(t * 22) % FIRE.length], -10, 26, { sw: 16, sh: 50, ay: 0.05 }); SS.spr(ctx, FIRE[(Math.floor(t * 22) + 3) % FIRE.length], 10, 26, { sw: 16, sh: 50, ay: 0.05 }); ctx.globalCompositeOperation = 'source-over';
    SS.spr(ctx, 'ship1_blue', 0, 0, { s: 1.0 }); ctx.restore();
    if (t > 1.5 && Math.sin(t * 5) > -0.3) D.text(ctx, 'Press SPACE to launch', SX, cy + 300, { size: 40, color: '#fff', outline: 10 });
    D.text(ctx, S.hull >= 99 ? 'Hull fully repaired!' : 'Hull repaired a bit!', SX, cy + 350, { size: 28, color: '#9dff9d', outline: 8, font: BD(28, 600) });
    ctx.restore();
  }
  function drawVictory(ctx, g, F) {
    const t = S.vt; const cy = (F.top + F.bottom) / 2 - 30;
    const k = U.ease.outCubic(clamp(t / 2.4, 0, 1)); const size = lerp(160, 560, k) + Math.sin(t * 2) * 6;
    const px = SX, py = cy + Math.sin(t * 1.3) * 8;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    SS.spr(ctx, 'p_star9', px, py, { max: size * 3.4, rot: t * 0.25, a: 0.55 * k, tint: '#ffe58a' }); SS.spr(ctx, 'p_star9', px, py, { max: size * 2.6, rot: -t * 0.35, a: 0.4 * k, tint: '#9fe8ff' });
    SS.spr(ctx, 'p_circle5', px, py, { max: size * 1.9, a: 0.7 * k, tint: '#9fe8ff' });
    ctx.restore();
    const im = SS.planets[3]; if (im) ctx.drawImage(im, px - size / 2, py - size / 2, size, size);
    // happy eyes + smile on the planet (the lost planet is friendly!)
    if (t > 1.0) { const e = clamp((t - 1.0) / 0.5, 0, 1); ctx.save(); ctx.translate(px, py + size * 0.04); ctx.globalAlpha = e; const s = size / 560; ctx.scale(s, s); D.eyes(ctx, 0, 0, 34, 'happy', 0, 0, 1.4); D.mouth(ctx, 0, 62, 34, 'grin'); D.cheeks(ctx, 0, 0, 34, 1.4); ctx.restore(); }
    if (t > 1.4) { const e = U.ease.outBack(clamp((t - 1.4) / 0.5, 0, 1)); ctx.save(); ctx.translate(SX, F.top + (F.bottom - F.top) * 0.16); ctx.scale(e, e); D.text(ctx, 'PLANET PIP IS SAVED!', 0, 0, { font: KV(86), size: 86, color: '#fff', outline: 18 }); ctx.restore(); }
    if (t > 2.4) { const e = clamp((t - 2.4) / 0.6, 0, 1); ctx.save(); ctx.globalAlpha = e; D.text(ctx, 'Thank you, Star Sweeper!', SX, cy + size / 2 + 80, { size: 62, color: '#ffe066', outline: 14 }); ctx.restore(); }
  }

  function drawLoading(ctx, g, F) {
    const v = F.v; ctx.fillStyle = '#05061a'; ctx.fillRect(v.x - 100, v.y - 100, v.w + 200, v.h + 200);
    D.text(ctx, 'Loading space…', SX, H / 2, { size: 60, color: '#fff', outline: 12 });
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill(P.rr(SX - 300, H / 2 + 60, 600, 16, 8)); ctx.fillStyle = '#7B5CFF'; ctx.fill(P.rr(SX - 300, H / 2 + 60, 600 * SS.progress, 16, 8));
  }

  function draw(g, ctx) {
    const F = S.F || (S.F = field(g)); const v = F.v;
    if (!SS.ready) { drawLoading(ctx, g, F); return; }
    SS.snd.pause(g.state === 'paused');
    SS.bg.draw(ctx, v, F.bottom);
    drawDefenseLine(ctx, g, F);
    drawEnemyShots(ctx);
    for (const e of S.enemies) if (e.type !== 'boss') drawEnemy(ctx, e);
    for (const e of S.enemies) if (e.type === 'boss') drawEnemy(ctx, e);
    drawShip(ctx, g, F);
    SS.fx.draw(ctx, false); drawBolts(ctx); SS.fx.draw(ctx, true);
    if (S.bombFx) { const k = S.bombFx.t / 1.1; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.hexA('#ffe0a0', 1 - k); ctx.lineWidth = 60 * (1 - k) + 6; ctx.beginPath(); ctx.arc(S.bombFx.x, S.bombFx.y, k * 2300, 0, 7); ctx.stroke(); ctx.restore(); }
    drawHUD(ctx, g, F);
    S.chipRects = [];
    if (S.mode !== 'map' && S.mode !== 'victory') { drawReticle(ctx, g, F); drawChips(ctx, g, F); }
    if (S.mode === 'victory') drawVictory(ctx, g, F);
    g.fx.draw(ctx);
    drawPops(ctx, g, F);
    drawOverlays(ctx, g, F);
    if (S.mode === 'map') drawMap(ctx, g, F);
    drawBanner(ctx, g, F);
    if (window.__ssAudit) window.__ssAudit(g, F);
  }

  /* ---------- input ---------- */
  function onKey(g, k) { press(g, k); }
  function onBack(g) { if (S.mode === 'fight') release(false); }
  function onEnter(g) { if (S.mode === 'map') { if (S.map.t > 1.5) S.map.t = Math.max(S.map.t, 5.6); return; } pulse(g); }

  const G = TM.game({
    id: 'star-sweep', name: 'Star Sweep', accent: C.sweep, bg: '#05061a', dark: true,
    logoHTML: 'Star<br>Sweep', tagline: 'Clean up space, one word at a time!',
    lifeIcon: TM.ui.heartSVG('#7B5CFF'),
    howto: [
      'Robo-drones are bothering <b>Planet Pip</b>! Fly through 5 sectors to rescue it.',
      'Type the first letter of a ship\'s word to <b>lock on</b>. Every correct letter fires a laser. Finish the word to blow the ship up!',
      '<b>Backspace</b> lets go of a lock. A wrong key only breaks your combo.',
      'Shielded ships need <b>two words</b>. Zippy little missiles have short words. Splitters break into mini ships.',
      'Type a <b>power-up\'s</b> small word to grab it: Shield, Bomb, Slow time, x2 score, Repair.',
      'Every sector ends with a <b>Boss</b>: type its sentence to chew its health bar away. Its attacks drain your shield, so keep typing!',
      'Press <b>Enter</b> for an Emergency Pulse once per sector. It pushes all ships back.',
    ],
    init: () => { SS.bg.init(); SS.load(); SS.bg.set(0, true); },
    reset, update, draw, onKey, onBack, onEnter,
    nextKey: () => { if (!S) return null; const t = S.lockT || S.enemies.filter((e) => e.alive && !e.doomed && e.type !== 'powerup').sort((a, b) => (b.danger || 0) - (a.danger || 0))[0]; return t ? t.typer.nextReq() : null; },
    hud: (g) => ({ lives: 0, maxLives: 0, right: S ? (S.mode === 'victory' ? 'Planet Pip!' : `Sector ${S.sector + 1} · Wave ${Math.min(S.wave + 1, S.perSector)}/${S.perSector}`) : '', progress: S ? (S.sector * S.perSector + S.wave + (S.mode === 'clear' || S.mode === 'map' ? 1 : 0) + (S.mode === 'victory' ? 1 : 0)) / (5 * S.perSector) : 0 }),
  });

  /* dev hooks, only with ?dev=1 (used by the Playwright tests to jump around) */
  if (U.qs('dev') === '1') window.__ssDev = {
    spawn: (t, n) => { for (let i = 0; i < (n || 1); i++) spawn(G, t); },
    power: (k) => spawnPower(G, undefined, undefined, k),
    ace: () => spawnAce(G),
    goto: (sector, wave) => { S.enemies.length = 0; S.shots.length = 0; S.bolts.length = 0; S.lockT = null; S.sector = sector; S.wave = wave; S.perSector = perSectorFor(G); SS.bg.set(sector); startWave(G); },
    set: (o) => Object.assign(S, o),
    god: (on) => { S.god = on; },
    auto: (cps, err, think) => { S.auto = cps ? { cps, err: err || 0, think: think ?? 0.3, acc: 0 } : null; },
    speed: (n) => { S.devSpeed = n; },
    kill: () => { for (const e of S.enemies) if (e.alive && e.type !== 'boss') { e.doomed = true; kill(G, e, { silent: true }); } },
  };
  window.__SS_AUDIT_DATA = function () {
    if (!S || !S.F) return null; const F = S.F;
    return { t: S.t, mode: S.mode, state: G.state, top: F.top, safeTop: F.safeTop, hudTop: F.hudTop, vx: F.v.x, vw: F.v.w, bottom: F.bottom, impactY: F.impactY, banner: S.banner ? { key: S.banner.key, title: S.banner.title, t: S.banner.t, rect: S.bannerRect } : null, bq: S.bq.length,
      chips: S.chipRects || [], pops: S.popRects || [],
      enemies: S.enemies.filter((e) => e.alive).map((e) => ({ id: e.id, type: e.type, seen: !!e.seen, typable: canType(e), doomed: !!e.doomed, spriteTop: topEdge(e), x: e.x, hw: e.hw, delay: e.delay })) };
  };
  /* test hook (read-only snapshot used by the Playwright bot) */
  window.__SS_STATE = function () {
    if (!S) return null;
    return { mode: S.mode, sector: S.sector, wave: S.wave, shield: S.shield, hull: S.hull, lock: S.lockT ? S.lockT.id : null, pace: S.pace, boss: S.boss ? { hp: 1 - S.boss.typed / S.boss.totalLetters, name: S.boss.name } : null, fxCount: SS.fx.count(),
      enemies: S.enemies.filter((e) => e.alive && !e.doomed).map((e) => ({ id: e.id, type: e.type, text: e.typer.text, next: e.typer.nextReq(), pos: e.typer.pos, y: Math.round(e.y), x: Math.round(e.x), danger: e.danger, ok: canType(e), seen: !!e.seen, locked: e.locked, keep: !!e.keepProgress })) };
  };
})();
