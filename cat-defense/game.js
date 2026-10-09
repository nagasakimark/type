/* Cat Defenders - lane defence for typists. Zombies shuffle down 5 lanes toward the wall, each carrying a word.
   Every correct letter fires the cats in that lane; a finished word flattens the zombie (and splashes its neighbours).
   Between waves the coins buy cats; two cats of the same level merge into a stronger one (mouse, or keys: Space / M / R / 1-5 / Enter).
   Bigger lanes mow down more zombies per letter. Art: CraftPix "Cartoon Cat Defense" kit (see tools/build_catdef.py). */
(function () {
  'use strict';
  const TM = window.TM, CD = window.CD, U = TM.U, C = TM.C, D = TM.draw;
  const IW = CD.IW, IH = CD.IH;
  const LY = [302, 416, 530, 646, 760];           // lane centres (image px)
  const SXC = [273, 416];                         // slot columns: 0 = back, 1 = front
  const FOOT = 40;                                // cat / zombie feet are this far below the lane centre
  const STOP = 770;                               // zombies stop here and chew the wall
  const NWAVE = 10, NSLOT = 10, MAXLV = 15;
  const REPAIR_COST = 40, REPAIR_HEAL = 35;
  const BOSS_NAME = ['なべゾンビ', 'バケツゾンビ', 'ふたゾンビ', 'ロケットゾンビ', 'たてゾンビ', 'メガネゾンビ', 'まじょゾンビ'];
  const BOSS_WAVES = { 2: [0], 4: [1], 6: [2], 8: [3], 9: [4, 5, 6] };
  const AREA_OF = (w) => Math.min(4, Math.floor(w / 2));
  const SONGS = [
    TM.audio.song({ bpm: 128, roots: [45, 45, 41, 43], chords: [[69, 72, 76], [69, 72, 76], [65, 69, 72], [67, 71, 74]], bassPattern: [0, null, 12, 0, null, 12, 0, null, 0, 12, null, 0, 10, null, 12, null], lead: [76, null, 79, null, 81, null, 79, null, 76, null, 74, null, 72, null, null, null, 74, null, 77, null, 79, null, 77, null, 74, null, 72, null, 71, null, null, null], wave: 'square' }),
    TM.audio.song({ bpm: 138, roots: [43, 43, 46, 41], chords: [[67, 70, 74], [67, 70, 74], [70, 74, 77], [65, 68, 72]], bassPattern: [0, 0, null, 12, 0, null, 12, null, 0, 0, null, 12, 10, null, 12, null], lead: [74, null, 77, 79, null, 82, null, 79, 77, null, 74, null, 72, null, 74, null, 70, null, 74, 77, null, 79, null, 77, 74, null, 72, null, 70, null, null, null], wave: 'sawtooth' }),
    TM.audio.song({ bpm: 150, roots: [38, 38, 41, 43], chords: [[62, 65, 69], [62, 65, 69], [65, 69, 72], [67, 71, 74]], bassPattern: [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 10, 12, 7, 12], lead: [74, 77, 81, 77, 74, 77, 81, 86, 84, 81, 77, 81, 84, 81, 77, 74, 72, 76, 79, 76, 72, 76, 79, 84, 83, 79, 76, 79, 83, 79, 76, 71], wave: 'square' }),
  ];

  let S = null, G = null;
  const clamp = U.clamp, rnd = U.rand;

  /* ---------------- geometry: image space <-> the framework's virtual 1920x1080 stage ---------------- */
  function frame(g) {
    const v = g.vw(); const s = Math.max(v.h / IH, v.w / IW);
    const L = clamp((IW - v.w / s) / 2, 0, 150);
    const ox = v.x - L * s, oy = v.y + (v.h - IH * s) / 2;
    return { v, s, ox, oy, l: L, r: L + v.w / s, t: (v.y - oy) / s, b: (v.y + v.h - oy) / s };
  }
  const toVirt = (F, x, y) => [F.ox + x * F.s, F.oy + y * F.s];
  function pointerToImage(e) {
    const F = S.F; if (!F) return null;
    const vx = F.v.x + (e.clientX / window.innerWidth) * F.v.w, vy = F.v.y + (e.clientY / window.innerHeight) * F.v.h;
    return [(vx - F.ox) / F.s, (vy - F.oy) / F.s];
  }

  /* ---------------- state ---------------- */
  const slotXY = (i) => [SXC[i % 2], LY[(i / 2) | 0]];
  const price = () => Math.min(260, 25 + 15 * S.bought);
  function reset(g) {
    G = g;
    S = {
      t: 0, phase: 'build', buildT: 0, wave: 0, coins: g.demo ? 0 : 75, coinsShown: g.demo ? 0 : 75, bought: 0, wall: { hp: 0, max: 100 }, slots: [], sel: -1, hover: null, ui: null, F: null,
      enemies: [], corpses: [], bullets: [], boomFx: [], helpers: [], queue: [], spawnT: 1, uid: 0, lock: new TM.LockOn(), ad: new TM.Adapt(g.diff), meter: 0, banner: null,
      kills: 0, splash: 0, maxLv: 1, lastDone: 0, helperCd: [0, 0, 0, 0, 0], guardUsed: false, clearT: 0, shake: 0, wallFlash: 0, merges: 0, auto: null, tipT: 0, ending: false, stats: { tnt: 0 },
      area: 0, music: -1, aliveCap: 3, plan: null, bossAlive: 0,
    };
    g.ad = S.ad;
    S.wall.max = g.diff === 'gentle' ? 140 : g.diff === 'turbo' ? 90 : 110; S.wall.hp = S.wall.max;
    for (let i = 0; i < NSLOT; i++) S.slots.push({ lvl: 0, fire: 0, autoT: rnd(0.5, 2.5), pop: 0 });
    S.slots[5].lvl = 1;                                    // one starter cat, middle lane, front
    if (g.demo) { for (const [i, l] of [[1, 2], [3, 1], [5, 3], [7, 2], [8, 1], [9, 4]]) S.slots[i].lvl = l; S.wall.hp = S.wall.max = 9999; S.auto = { cps: 2.6, acc: 0, think: 0.5, err: 0.02, wait: 0 }; S.wave = 2; beginWave(g); }
    else { S.F = frame(g); banner('じゅんび！', { sub: 'コインで ネコを かって ガッチャンコ！', life: 3.2 }); }
  }
  function banner(title, o) { S.banner = Object.assign({ title, t: 0, life: 2.2, color: '#fff', sub: null }, o || {}); }

  /* ---------------- cats: firepower, buying, merging ---------------- */
  const lanePower = (lane) => { let f = 0, m = 0; for (const c of [S.slots[lane * 2], S.slots[lane * 2 + 1]]) { f += c.lvl; m = Math.max(m, c.lvl); } return { f, m }; };
  const freeSlot = (lane) => {
    const order = lane == null ? [1, 0] : null;
    if (lane != null) { if (!S.slots[lane * 2 + 1].lvl) return lane * 2 + 1; if (!S.slots[lane * 2].lvl) return lane * 2; return -1; }
    let best = -1, bp = 1e9;
    for (let l = 0; l < 5; l++) { const f = freeSlot(l); if (f >= 0) { const p = lanePower(l).f * 10 + (f % 2 ? 0 : 1) + Math.abs(l - 2) * 0.1; if (p < bp) { bp = p; best = f; } } }
    return best; // order unused (kept for clarity)
  };
  function buy(g, lane) {
    const slot = typeof lane === 'number' && lane >= 0 && lane < 5 ? freeSlot(lane) : freeSlot();
    if (S.coins < price()) { TM.sfx.miss(); tip('コインが たりないよ！'); return false; }
    if (slot < 0) { TM.sfx.miss(); tip(typeof lane === 'number' ? 'そのレーンは いっぱい！' : 'いっぱい！ ガッチャンコ してね'); return false; }
    S.coins -= price(); S.bought++; putCat(g, slot, 1); TM.sfx.pop(); return true;
  }
  function buyAt(g, slot) {
    if (S.slots[slot].lvl) return false;
    if (S.coins < price()) { TM.sfx.miss(); tip('コインが たりないよ！'); return false; }
    S.coins -= price(); S.bought++; putCat(g, slot, 1); TM.sfx.pop(); return true;
  }
  function putCat(g, slot, lvl) {
    const c = S.slots[slot]; c.lvl = lvl; c.pop = 1; S.maxLv = Math.max(S.maxLv, lvl);
    const [x, y] = slotXY(slot); if (S.F) { const [vx, vy] = toVirt(S.F, x, y); g.fx.stars(vx, vy, 6); }
  }
  function mergeTwo(g, a, b) {            // a and b hold the same level: result stays in b
    const A = S.slots[a], B = S.slots[b]; if (!A.lvl || A.lvl !== B.lvl || A.lvl >= MAXLV || a === b) return false;
    A.lvl = 0; B.lvl++; B.pop = 1.4; S.merges++; S.maxLv = Math.max(S.maxLv, B.lvl);
    const [x, y] = slotXY(b); const [vx, vy] = toVirt(S.F || frame(g), x, y);
    g.fx.stars(vx, vy - 30, 14); g.fx.pop(vx, vy - 110, 'Lv ' + B.lvl + '!', { color: '#FFD23F', size: 60, life: 1 });
    TM.sfx.combo(Math.min(6, B.lvl)); return true;
  }
  function mergeAll(g) {
    let n = 0;
    for (let guard = 0; guard < 40; guard++) {
      let pair = null;
      for (let lv = 1; lv < MAXLV && !pair; lv++) {
        const idx = []; for (let i = 0; i < NSLOT; i++) if (S.slots[i].lvl === lv) idx.push(i);
        if (idx.length < 2) continue;
        for (const a of idx) for (const b of idx) if (a !== b && ((a / 2) | 0) === ((b / 2) | 0) && !pair) pair = [a, b];
        if (!pair) pair = [idx[0], idx[1]];
        if (pair && pair[0] % 2 === 1 && pair[1] % 2 === 0) pair = [pair[1], pair[0]];       // keep the cat that stands at the front
      }
      if (!pair) break;
      mergeTwo(g, pair[0], pair[1]); n++;
    }
    if (!n) { TM.sfx.miss(); tip('あわせられる ネコが いないよ'); }
    S.sel = -1; return n;
  }
  const canMerge = () => { const seen = {}; for (const c of S.slots) if (c.lvl && c.lvl < MAXLV) { if (seen[c.lvl]) return true; seen[c.lvl] = 1; } return false; };
  function repair(g) {
    if (S.wall.hp >= S.wall.max) { tip('かべは げんき！'); return; }
    if (S.coins < REPAIR_COST) { TM.sfx.miss(); tip('コインが たりないよ！'); return; }
    S.coins -= REPAIR_COST; S.wall.hp = Math.min(S.wall.max, S.wall.hp + REPAIR_HEAL); TM.sfx.word(); S.wallFlash = 1;
  }
  function tip(t) { S.tip = t; S.tipT = 2; }
  function clickSlot(g, i) {
    const c = S.slots[i];
    if (!c.lvl) { S.sel = -1; buyAt(g, i); return; }
    if (S.sel >= 0 && S.sel !== i && S.slots[S.sel].lvl === c.lvl) { mergeTwo(g, S.sel, i); S.sel = -1; return; }
    S.sel = S.sel === i ? -1 : i; TM.sfx.click();
  }

  /* ---------------- waves ---------------- */
  function planWave(g, w) {
    const dens = g.diff === 'gentle' ? 0.78 : g.diff === 'turbo' ? 1.25 : 1;
    const bosses = BOSS_WAVES[w] || null;
    const n = Math.round((5 + w * 1.5) * dens * (bosses ? 0.7 : 1));
    const toks = []; for (let i = 0; i < n; i++) toks.push('z');
    if (bosses) bosses.forEach((b, k) => toks.splice(Math.min(toks.length, Math.floor(toks.length * (0.3 + 0.28 * k))), 0, 'b' + b));
    return { n, toks, boss: bosses, cap: clamp(3 + Math.floor(w / 2.5) + (g.diff === 'turbo' ? 1 : g.diff === 'gentle' ? -1 : 0), 2, 7) };
  }
  function beginWave(g) {
    S.phase = 'fight'; S.plan = planWave(g, S.wave); S.queue = S.plan.toks.slice(); S.spawnT = 1.6; S.aliveCap = S.plan.cap; S.sel = -1; S.lock.release();
    S.area = AREA_OF(S.wave); S.guardUsedWave = false; S.helperCd.fill(0);
    const boss = !!S.plan.boss;
    if (!g.demo) banner(boss ? 'ボス ゾンビだ！' : `ウェーブ ${S.wave + 1}`, { sub: boss ? BOSS_NAME[S.plan.boss[0]] + (S.plan.boss.length > 1 ? ' ほか' : '') : S.wave === NWAVE - 1 ? 'さいごの ウェーブ！' : null, life: boss ? 2.8 : 2, color: boss ? '#FF5A5F' : '#fff' });
    if (!g.demo && g.state === 'play') { const m = boss ? 2 : S.wave < 5 ? 0 : 1; if (S.music !== m) { S.music = m; TM.audio.startMusic(SONGS[m]); } }
    if (boss) TM.sfx.big();
  }
  function takeWord(g, o) {
    const avoid = S.lock.firstLetters(S.enemies);
    return g.dealer.next(Object.assign({ avoidFirst: avoid }, o));
  }
  function wordItem(g) {
    const w = S.wave; const maxLen = Math.round(clamp(4.5 + w * 0.75, 4, 11)), minLen = w < 3 ? 2 : 3;
    return takeWord(g, { kind: 'word', minLen, maxLen });
  }
  function spawn(g, tok) {
    const F = S.F || frame(g);
    const xr = F.r + 160;
    if (tok[0] === 'b') {
      const type = +tok.slice(1), phases = 2 + (S.wave >= 6 ? 1 : 0);
      const items = []; for (let i = 0; i < phases; i++) items.push(takeWord(g, { kind: 'sentence', maxWords: 3 + Math.floor(S.wave / 3) }));
      const total = items.reduce((a, it) => a + it.len, 0);
      const T = S.ad.time(total) * 1.9, D0 = xr - STOP;
      const e = { id: ++S.uid, boss: true, kind: 'boss', type, lane: 2, x: xr, speed: clamp(D0 / T, 20, 70), items, idx: 0, typer: new TM.Typer(items[0]), alive: true, state: 'walk', t: rnd(0, 5), at: 0, flash: 0, hp: 99, maxHp: 99, born: S.t, push: 0, stun: 0, total, done: 0, name: BOSS_NAME[type] };
      S.enemies.push(e); S.bossAlive++; return e;
    }
    const lanes = [0, 1, 2, 3, 4].filter((l) => !S.enemies.some((q) => q.lane === l && q.x > xr - 260));
    const lane = U.pick(lanes.length ? lanes : [0, 1, 2, 3, 4]);
    const item = wordItem(g), len = item.len, type = U.randi(0, Math.min(7, 1 + Math.floor(S.wave * 0.8)));
    const T = S.ad.time(len) * (g.diff === 'gentle' ? 3.1 : g.diff === 'turbo' ? 2.2 : 2.6), D0 = xr - STOP;
    const hp = 1 + Math.floor(len / 4) + (type >= 4 ? 1 : 0);
    const e = { id: ++S.uid, kind: 'reg', type, lane, x: xr, speed: clamp(D0 / T, 26, 185) * (g.demo ? 0.8 : 1), item, typer: new TM.Typer(item), alive: true, state: 'walk', t: rnd(0, 5), at: 0, flash: 0, hp, maxHp: hp, born: S.t, push: 0, stun: 0, mirror: Math.random() < 0.0 };
    S.enemies.push(e); return e;
  }

  /* ---------------- shooting ---------------- */
  const foeY = (e) => LY[e.lane] + FOOT;
  const ZS = 1.9, BS = 1.7;
  const foeCenter = (e) => [e.x - (e.boss ? 30 : 14), foeY(e) - (e.boss ? 95 : 68)];
  function fireFrom(slot, e, delay) {
    const c = S.slots[slot]; if (!c.lvl) return;
    const [sx, sy] = slotXY(slot); const [tx, ty] = foeCenter(e);
    const mx = sx + 70, my = sy + FOOT - 74 + (slot % 2 ? 0 : 3);
    c.fire = 1; const d = Math.hypot(tx - mx, ty - my);
    S.bullets.push({ x: mx, y: my, tx, ty, x0: mx, y0: my, t: -(delay || 0), dur: Math.max(0.08, d / 1900), i: c.lvl > 8 ? 0 : c.lvl > 4 ? 2 : 1, tgt: e });
  }
  function fireLane(lane, e) { const a = lane * 2; fireFrom(a + 1, e, 0); fireFrom(a, e, 0.05); }
  function dmgFoe(g, e, dmg, how) {
    if (!e.alive || e.boss) return false;
    if (how === 'auto') { e.hp = Math.max(0.5, e.hp - dmg); e.flash = Math.max(e.flash, 0.5); return false; }   // idle cat fire only softens: typing finishes zombies
    e.hp -= dmg; e.flash = 1;
    if (e.hp <= 0) { if (e.typer.pos > 0 && how !== 'blast') { e.hp = 0.4; return false; } killFoe(g, e, 'splash'); return true; }
    return false;
  }
  function letterHit(g, e) {
    const lane = e.lane, P = lanePower(lane);
    fireLane(lane, e); e.flash = Math.max(e.flash, 0.7); TM.sfx.zap();
    S.meter = Math.min(100, S.meter + (g.diff === 'gentle' ? 1.7 : 1.3));
    const n = Math.min(5, Math.floor(P.f / 2));
    if (n > 0) {
      const dmg = 1 + Math.floor(P.m / 4);
      const vic = S.enemies.filter((q) => q.alive && !q.boss && q !== e && q.x < (S.F ? S.F.r : 1900) + 20).sort((a, b) => (Math.abs(a.lane - lane) * 900 + Math.abs(a.x - e.x)) - (Math.abs(b.lane - lane) * 900 + Math.abs(b.x - e.x))).slice(0, n);
      vic.forEach((q, k) => { fireFrom(lane * 2 + (k % 2), q, 0.06 * (k + 1)); dmgFoe(g, q, dmg, 'pierce'); });
    }
  }
  function wordBlast(g, e) {
    const P = lanePower(e.lane), R = 330 + 25 * P.f, lr = P.f >= 12 ? 2 : P.f >= 5 ? 1 : 0, dmg = 1 + Math.floor(P.f / 4);
    const [cx, cy] = foeCenter(e); S.boomFx.push({ x: cx, y: cy, t: 0, s: 0.8 + Math.min(0.9, P.f * 0.05), dur: 0.55 });
    let hit = 0;
    for (const q of S.enemies.slice()) if (q.alive && !q.boss && q !== e && Math.abs(q.lane - e.lane) <= lr && Math.abs(q.x - e.x) <= R * (Math.abs(q.lane - e.lane) ? 0.7 : 1)) { if (dmgFoe(g, q, dmg, 'blast')) hit++; }
    if (hit >= 2 && S.F) { const [vx, vy] = toVirt(S.F, cx, cy - 120); g.fx.pop(vx, vy, `${hit + 1}たい いっきに！`, { color: '#FF7A1A', size: 54, life: 1 }); }
    if (P.f >= 5) { S.shake = Math.max(S.shake, 6); }
  }

  /* ---------------- kills ---------------- */
  function popText(g, x, y, str, o) { const F = S.F || frame(g); const [vx, vy] = toVirt(F, x, y); g.fx.pop(vx, vy, str, o); }
  function killFoe(g, e, how) {
    if (!e.alive) return;
    e.alive = false; e.state = 'dead'; S.enemies = S.enemies.filter((q) => q !== e); S.corpses.push({ e, t: 0 });
    if (e.boss) S.bossAlive--;
    S.kills++; if (how === 'splash') S.splash++;
    const len = e.boss ? e.total : e.item.len;
    const gain = e.boss ? 150 + S.wave * 10 : how === 'splash' ? 4 + len : 6 + len * 2;
    S.coins += gain;
    const [cx, cy] = foeCenter(e);
    popText(g, cx, cy - 70, '+' + gain, { color: '#FFD23F', size: e.boss ? 70 : 46, life: 0.9 });
    if (S.F) { const [vx, vy] = toVirt(S.F, cx, cy); g.fx.stars(vx, vy, e.boss ? 20 : 6); }
    TM.sfx.splat(); if (e.boss) { TM.sfx.big(); S.shake = 14; }
    if (S.lock.locked === e) S.lock.release();
  }
  function wordFinished(g, e) {
    const dur = e.typer.started ? (performance.now() - e.typer.started) / 1000 : 1;
    const [cx, cy] = foeCenter(e);
    if (e.boss) {
      g.wordDone(e.typer, ...toVirt(S.F, cx, cy - 100), { bonus: 2 });
      e.done++; e.idx++;
      if (e.idx < e.items.length) {
        e.typer = new TM.Typer(e.items[e.idx]); e.push = 260; e.stun = 1.2; e.flash = 1; S.shake = 10; TM.sfx.big();
        S.boomFx.push({ x: cx, y: cy, t: 0, s: 1.3, dur: 0.6 });
        S.ad.word(e.items[e.idx - 1].len, dur, 0, null, null, null);
      } else { S.ad.success(1); killFoe(g, e, 'typed'); S.boomFx.push({ x: cx, y: cy, t: 0, s: 1.8, dur: 0.7 }); }
      return;
    }
    const margin = clamp((e.x - STOP) / Math.max(200, (S.F ? S.F.r : 1900) + 160 - STOP), 0, 1);
    const cycle = S.t - Math.max(S.lastDone, e.born / 1); S.lastDone = S.t;
    S.ad.word(e.item.len, dur, e.typer.errors, null, cycle, margin);
    g.wordDone(e.typer, ...toVirt(S.F, cx, cy - 100), { color: '#fff' });
    wordBlast(g, e); killFoe(g, e, 'typed');
  }

  /* ---------------- input ---------------- */
  function onKey(g, k) {
    if (!S) return;
    if (S.phase === 'build') {
      if (k === ' ') buy(g);
      else if (k === 'm') mergeAll(g);
      else if (k === 'r') repair(g);
      else if (k >= '1' && k <= '5') buy(g, +k - 1);
      return;
    }
    if (S.phase !== 'fight') return;
    const targets = S.enemies.filter((e) => e.alive && e.x < (S.F ? S.F.r + 40 : 2000));
    const r = S.lock.feed(k, targets);
    if (!r.target) { g.keyResult('miss'); return; }
    if (r.result === 'miss') { g.keyResult('miss'); S.ad.key(false); return; }
    g.keyResult('ok'); S.ad.key(true);
    letterHit(g, r.target);
    if (r.result === 'done') wordFinished(g, r.target);
  }
  function onEnter(g) {
    if (!S) return;
    if (S.phase === 'build') { if (!g.demo) beginWave(g); return; }
    if (S.phase === 'fight') tnt(g);
  }
  function tnt(g) {
    if (S.meter < 100) return;
    S.meter = 0; S.stats.tnt++; S.shake = 18; TM.sfx.boost();
    const F = S.F;
    for (let i = 0; i < 6; i++) S.boomFx.push({ x: rnd(STOP + 100, F.r - 80), y: rnd(LY[0], LY[4]) + 20, t: -i * 0.07, s: rnd(1.1, 1.8), dur: 0.7 });
    for (const q of S.enemies.slice()) { if (q.boss) { q.push = 200; q.stun = 1.5; q.flash = 1; } else if (q.x < F.r + 40) dmgFoe(g, q, 3, 'blast'); }
    banner('ドカーン！', { life: 1.2, color: '#FFB23F' });
  }
  function pointer(e) {
    if (!S || !G || G.state !== 'play' || S.phase !== 'build' || TM.ui.isModalOpen() || !S.ui) return;
    if (e.target && e.target.id !== 'stage') return;
    const p = pointerToImage(e); if (!p) return;
    const hit = hitTest(p[0], p[1]);
    if (e.type === 'pointermove') { S.hover = hit; document.getElementById('stage').style.cursor = hit ? 'pointer' : ''; return; }
    if (e.type !== 'pointerdown' || !hit) { if (e.type === 'pointerdown') S.sel = -1; return; }
    if (hit.kind === 'slot') clickSlot(G, hit.i);
    else if (hit.id === 'buy') buy(G); else if (hit.id === 'merge') mergeAll(G); else if (hit.id === 'repair') repair(G); else if (hit.id === 'go') beginWave(G);
  }
  function hitTest(x, y) {
    for (const b of S.ui.btns) if (x >= b.x - b.w / 2 && x <= b.x + b.w / 2 && y >= b.y - b.h / 2 && y <= b.y + b.h / 2) return { kind: 'btn', id: b.id };
    for (let i = 0; i < NSLOT; i++) { const [sx, sy] = slotXY(i); if (Math.abs(x - sx) <= 58 && Math.abs(y - sy) <= 58) return { kind: 'slot', i }; }
    return null;
  }
  window.addEventListener('pointerdown', pointer); window.addEventListener('pointermove', pointer);

  /* ---------------- update ---------------- */
  function botType(g, dt) {
    const A = S.auto; if (A.wait > 0) { A.wait -= dt; return; }
    A.acc += dt * A.cps;
    while (A.acc >= 1) {
      A.acc -= 1;
      let t = S.lock.locked;
      if (!t || !t.alive) { const c = S.enemies.filter((q) => q.alive && q.x < S.F.r); c.sort((a, b) => a.x - b.x); t = c[0]; A.wait = A.think * rnd(0.6, 1.3); }
      if (!t) { A.acc = 0; return; }
      let k = t.typer.nextReq(); if (!k) continue;
      if (Math.random() < A.err) k = 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
      onKey(g, k.toLowerCase());
      if (A.wait > 0) return;
    }
  }
  function botBuild(g) {
    for (let r = 0; r < 4; r++) { let n = 0; while (S.coins >= price() && freeSlot() >= 0 && n++ < 12) buy(g); mergeAll(g); }
    if (S.wall.hp < S.wall.max * 0.7) repair(g);
    beginWave(g);
  }
  function update(g, dt) {
    if (!S) return;
    S.F = frame(g); S.t += dt;
    S.shake = Math.max(0, S.shake - dt * 30); S.wallFlash = Math.max(0, S.wallFlash - dt * 2);
    if (S.banner) { S.banner.t += dt; if (S.banner.t > S.banner.life) S.banner = null; }
    if (S.tipT > 0) S.tipT -= dt;
    for (const c of S.slots) { c.fire = Math.max(0, c.fire - dt * 6); c.pop = Math.max(0, c.pop - dt * 3); }
    S.coinsShown += (S.coins - S.coinsShown) * (1 - Math.exp(-dt * 10)); if (Math.abs(S.coins - S.coinsShown) < 0.6) S.coinsShown = S.coins;
    for (const b of S.bullets) { b.t += dt; if (b.t > 0) { const k = Math.min(1, b.t / b.dur); b.x = b.x0 + (b.tx - b.x0) * k; b.y = b.y0 + (b.ty - b.y0) * k; } }
    S.bullets = S.bullets.filter((b) => b.t < b.dur); // quick tracers; damage was already applied
    for (const f of S.boomFx) f.t += dt; S.boomFx = S.boomFx.filter((f) => f.t < f.dur);
    for (const c of S.corpses) c.t += dt; S.corpses = S.corpses.filter((c) => c.t < 1.5);
    for (const h of S.helpers) h.t += dt; S.helpers = S.helpers.filter((h) => h.t < h.dur);
    for (let i = 0; i < 5; i++) S.helperCd[i] = Math.max(0, S.helperCd[i] - dt);
    if (!g.demo && g.state !== 'play') return;
    if (S.phase === 'build') {
      S.buildT += dt;
      if ((g.devBot || S.auto) && S.buildT > 1.2 && !g.demo) botBuild(g);
      return;
    }
    if (S.auto) botType(g, dt);
    if (S.phase === 'clear') { S.clearT -= dt; if (S.clearT <= 0) afterClear(g); return; }
    if (S.phase === 'over') return;
    updateFight(g, dt);
  }
  function updateFight(g, dt) {
    const F = S.F;
    // spawning
    S.spawnT -= dt;
    if (S.queue.length && S.spawnT <= 0) {
      const alive = S.enemies.filter((e) => !e.boss).length;
      const tok = S.queue[0];
      if (tok[0] === 'b' ? S.bossAlive === 0 : alive < S.aliveCap) {
        S.queue.shift(); spawn(g, tok);
        const avgLen = clamp(4.5 + S.wave * 0.6, 4, 9);
        const dens = g.diff === 'gentle' ? 0.8 : g.diff === 'turbo' ? 1.25 : 1;
        S.spawnT = clamp(S.ad.time(avgLen) * 0.9 / dens, 1.0, 7) * (tok[0] === 'b' ? 1.5 : 1) * (g.demo ? 0.7 : 1) * rnd(0.85, 1.15);
      } else S.spawnT = 0.35;
    }
    // zombies
    for (const e of S.enemies.slice()) {
      e.t += dt; e.flash = Math.max(0, e.flash - dt * 4); if (e.typer.shake > 0) e.typer.shake = Math.max(0, e.typer.shake - dt * 3);
      if (e.push > 0) { const d = Math.min(e.push, e.push * 3 * dt + 4); e.x += d; e.push -= d; if (e.push < 2) e.push = 0; }
      if (e.stun > 0) { e.stun -= dt; if (e.state === 'attack') { e.state = 'walk'; } continue; }
      const front = S.enemies.filter((q) => q !== e && q.lane === e.lane && q.x < e.x).sort((a, b) => b.x - a.x)[0];
      const base = STOP + (e.boss ? 40 : 0), minX = Math.max(base, front ? front.x + (front.boss || e.boss ? 300 : 205) : 0);
      const was = e.state;
      if (e.x > minX + 1) { e.x = Math.max(minX, e.x - e.speed * dt); e.state = 'walk'; }
      else e.state = e.x <= base + 2 ? 'attack' : 'walk';
      if (e.state === 'attack') {
        if (was !== 'attack') { e.at = 0; if (S.helperCd[e.lane] <= 0 && !g.demo) helper(g, e); }
        e.at += dt; if (e.at >= (e.boss ? 1.6 : 1.4)) { e.at = 0; hitWall(g, e); }
      }
    }
    // auto-fire: cats shoot the front zombie in their lane on their own (never one the student already started typing)
    for (let i = 0; i < NSLOT; i++) {
      const c = S.slots[i]; if (!c.lvl) continue;
      c.autoT -= dt; if (c.autoT > 0) continue;
      c.autoT = Math.max(1.3, 3.2 - 0.11 * c.lvl) * rnd(0.85, 1.2);
      const lane = (i / 2) | 0;
      const e = S.enemies.filter((q) => q.alive && !q.boss && q.lane === lane && q.x < F.r - 30).sort((a, b) => a.x - b.x)[0];
      if (!e) continue;
      fireFrom(i, e, 0); dmgFoe(g, e, 0.6 + 0.2 * c.lvl, 'auto');
    }
    // wave end
    if (!S.queue.length && !S.enemies.length && S.phase === 'fight' && !S.plan.endHandled) { S.plan.endHandled = true; endWave(g); }
    // wall destroyed
    if (!g.demo && S.wall.hp <= 0 && S.phase === 'fight') {
      S.phase = 'over'; banner('かべが やられた！', { life: 3, color: '#FF5A5F' });
      g.end({ win: false, title: 'かべが こわれちゃった！', sub: `ウェーブ ${S.wave + 1} まで がんばった！`, stats: [['ウェーブ', S.wave + 1], ['ゾンビ', S.kills], ['ネコの つよさ', 'Lv ' + S.maxLv]], delay: 1600 });
    }
  }
  function hitWall(g, e) {
    const dmg = e.boss ? 8 : 2 + e.type * 0.25;
    if (g.demo) { S.wallFlash = 0.5; return; }
    S.wall.hp = Math.max(0, S.wall.hp - dmg); S.wallFlash = 1; S.shake = Math.max(S.shake, 5); TM.sfx.hurt(); S.ad.fail(e.boss ? 0.2 : 0.35);
    if (S.wall.hp > 0 && S.wall.hp < S.wall.max * 0.25 && !S.guardUsedWave && !S.guardEver) guardian(g);
  }
  function helper(g, e) {
    S.helperCd[e.lane] = 15 - Math.min(6, S.wave * 0.5);
    S.helpers.push({ who: 0, x: STOP - 85, lane: e.lane, t: 0, dur: 0.85, hit: false, tgt: e });
  }
  function guardian(g) {
    S.guardUsedWave = true; S.guardEver = true; banner('ガーディアン ニャン！', { life: 2, color: '#8FE9FF' });
    S.helpers.push({ who: 1, x: STOP - 150, lane: 2, t: 0, dur: 1.1, hit: false, all: true }); TM.sfx.big();
  }
  function endWave(g) {
    S.phase = 'clear'; S.clearT = 2.2; S.lock.release();
    const bonus = 30 + S.wave * 8; S.coins += bonus;
    banner(S.wave === NWAVE - 1 ? 'ぜんぶ やっつけた！' : 'ウェーブ クリア！', { sub: `ボーナス +${bonus}`, life: 2.1, color: '#FFD23F' });
    if (!g.demo) { TM.sfx.win(); g.fx.confetti(S.F.l + 800, 300, 40); }
  }
  function afterClear(g) {
    if (g.demo) { S.wave = (S.wave + 1) % 6; S.enemies = []; beginWave(g); return; }
    if (S.wave >= NWAVE - 1) {
      S.phase = 'over';
      g.end({ win: true, targetMet: S.wall.hp >= S.wall.max * 0.5, title: 'まちを まもった！', sub: 'ネコたちの だいしょうり！', stats: [['ゾンビ', S.kills], ['ネコの つよさ', 'Lv ' + S.maxLv], ['かべ', Math.round(S.wall.hp / S.wall.max * 100) + '%']], delay: 900 });
      return;
    }
    S.wave++; S.phase = 'build'; S.buildT = 0; S.area = AREA_OF(S.wave); S.plan = null; S.meter = Math.max(S.meter, 30);
    if (S.wall.hp < S.wall.max) S.wall.hp = Math.min(S.wall.max, S.wall.hp + (g.diff === 'gentle' ? 25 : 12));
    S.guardUsedWave = false;
    banner('じゅんび！', { sub: `つぎは ウェーブ ${S.wave + 1}${BOSS_WAVES[S.wave] ? '  ボスが くるよ！' : ''}`, life: 2.6 });
  }

  /* ---------------- drawing ---------------- */
  function draw(g, ctx) {
    if (!S) return;
    const F = S.F || (S.F = frame(g)); const v = F.v;
    ctx.fillStyle = '#1b1f2b'; ctx.fillRect(v.x - 4, v.y - 4, v.w + 8, v.h + 8);
    ctx.save();
    ctx.translate(F.ox, F.oy); ctx.scale(F.s, F.s);
    if (S.shake > 0) ctx.translate(rnd(-S.shake, S.shake) * 0.5, rnd(-S.shake, S.shake) * 0.5);
    const bg = CD.bg[S.area];
    if (bg) ctx.drawImage(bg, 0, 0, IW, IH);
    drawWallBar(ctx);
    const ui = { btns: [] }; S.ui = ui;
    const sc = CD.slotColor(S.area); ctx.fillStyle = sc; ctx.beginPath(); ctx.roundRect(273 - 49, 760 - 47, 98, 94, 8); ctx.fill();
    if (S.phase === 'build') drawSlotsHint(ctx);
    // lanes, back to front: cats, zombies, helpers
    const chips = [];
    for (let l = 0; l < 5; l++) {
      for (const col of [0, 1]) drawCat(ctx, l * 2 + col);
      const row = S.enemies.filter((e) => e.lane === l).sort((a, b) => b.x - a.x);
      for (const c of S.corpses) if (c.e.lane === l) drawFoe(ctx, c.e, c.t);
      for (const e of row) drawFoe(ctx, e);
      for (const h of S.helpers) if (h.lane === l) drawHelper(g, ctx, h);
    }
    for (const b of S.bullets) if (b.t > 0) { CD.bullet(ctx, b.i, b.x, b.y, Math.atan2(b.ty - b.y0, b.tx - b.x0), 0.8); }
    for (let i = 0; i < NSLOT; i++) { const c = S.slots[i]; if (c.fire > 0.3 && c.lvl) { const [x, y] = slotXY(i); CD.muzzle(ctx, 1 - c.fire, x + 62, y + FOOT - 74, 0.75, 0); } }
    for (const f of S.boomFx) if (f.t > 0) CD.boom(ctx, f.t / f.dur, f.x, f.y, f.s * 0.9, 1 - Math.max(0, (f.t / f.dur - 0.7) / 0.3));
    drawChips(g, ctx, F);
    drawHud(g, ctx, F);
    if (S.phase === 'build') drawBuild(g, ctx, F, ui);
    drawBanner(ctx, F);
    ctx.restore();
  }
  function drawWallBar(ctx) {
    const k = clamp(S.wall.hp / S.wall.max, 0, 1), x = 673, y0 = 272, h = 400, w = 16;
    ctx.fillStyle = '#1d262b'; ctx.fillRect(x, y0, w, h);
    const gh = h * k; const gr = ctx.createLinearGradient(0, y0 + h - gh, 0, y0 + h);
    const low = k < 0.3; gr.addColorStop(0, low ? '#ff7a5a' : '#c4f25a'); gr.addColorStop(1, low ? '#d63a2a' : '#4aa81c');
    ctx.fillStyle = gr; ctx.fillRect(x, y0 + h - gh, w, gh);
    if (S.wallFlash > 0) { ctx.fillStyle = `rgba(255,80,60,${0.45 * S.wallFlash})`; ctx.fillRect(560, 250, 150, 440); }
  }
  function drawSlotsHint(ctx) {
    for (let i = 0; i < NSLOT; i++) {
      const [x, y] = slotXY(i), c = S.slots[i];
      const hov = S.hover && S.hover.kind === 'slot' && S.hover.i === i, sel = S.sel === i;
      ctx.save();
      if (!c.lvl) {
        ctx.fillStyle = hov ? 'rgba(255,230,120,.55)' : 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.roundRect(x - 48, y - 46, 96, 92, 10); ctx.fill();
        D.text(ctx, '+', x, y - 4, { size: 54, color: '#fff', outline: 8 });
        if (hov) D.text(ctx, String(price()), x, y + 34, { size: 26, color: '#FFD23F', outline: 7 });
      } else if (hov || sel) {
        ctx.strokeStyle = sel ? '#FFD23F' : '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(x - 52, y - 50, 104, 100, 12); ctx.stroke();
      }
      ctx.restore();
    }
  }
  function drawCat(ctx, i) {
    const c = S.slots[i]; if (!c.lvl) return;
    const [x, y] = slotXY(i);
    const shooting = c.fire > 0.05;
    const f = shooting ? CD.catShoot(1 - c.fire) : CD.catIdle(S.t + i * 0.37);
    const pop = c.pop > 0 ? 1 + 0.35 * Math.sin(c.pop * Math.PI) : 1;
    CD.cat(ctx, c.lvl, f, x, y + FOOT, { s: 1.15 * pop, foot: 19 });
    // level badge
    const bx = x - 50, by = y - 56;
    ctx.fillStyle = S.sel === i ? '#FFD23F' : '#fff'; ctx.beginPath(); ctx.arc(bx, by, 17, 0, 7); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#1F1A3D'; ctx.stroke();
    D.text(ctx, String(c.lvl), bx, by + 1, { size: 22, color: '#1F1A3D', outline: 0 });
  }
  function drawFoe(ctx, e, deadT) {
    const y = foeY(e), s = e.boss ? BS : ZS;
    const dead = deadT != null;
    const anim = dead ? 'dead' : e.state === 'attack' ? 'attack' : 'walk';
    const p = dead ? Math.min(0.999, deadT / 0.9) : anim === 'attack' ? (e.at / (e.boss ? 1.6 : 1.4)) : ((e.t * (e.boss ? 0.8 : 1.0)) % 1);
    ctx.save();
    CD.foe(ctx, e.kind, e.type, anim, p, e.x, y, { s, flash: dead ? 0 : e.flash, a: dead ? Math.max(0, 1 - Math.max(0, deadT - 0.9) / 0.6) : 1, foot: e.boss ? 36 : 33 });
    ctx.restore();
  }
  function drawHelper(g, ctx, h) {
    const k = h.t / h.dur, y = LY[h.lane] + FOOT;
    CD.helper(ctx, h.who, 'attack', k, h.x, y, { foot: h.who ? 35 : 37, s: h.who ? 1.25 : 1.2, a: Math.min(1, (1 - Math.max(0, k - 0.8) / 0.2)) * Math.min(1, k * 8) });
    if (!h.hit && k > 0.45) {
      h.hit = true; S.shake = Math.max(S.shake, 8); TM.sfx.big();
      if (h.all) { for (const q of S.enemies) { q.push = 420; q.stun = 1; q.flash = 1; } S.wall.hp = Math.min(S.wall.max, S.wall.hp + S.wall.max * 0.25); S.boomFx.push({ x: STOP + 20, y: LY[2], t: 0, s: 1.6, dur: 0.6 }); }
      else if (h.tgt && h.tgt.alive) { h.tgt.push = h.tgt.boss ? 120 : 260; h.tgt.stun = 1.1; h.tgt.flash = 1; S.boomFx.push({ x: h.tgt.x - 30, y: foeY(h.tgt) - 50, t: 0, s: 0.7, dur: 0.45 }); }
    }
  }
  function drawChips(g, ctx, F) {
    const list = S.enemies.filter((e) => e.alive && e.x < F.r + 20).sort((a, b) => (S.lock.locked === a ? -1 : S.lock.locked === b ? 1 : a.x - b.x));
    const placed = [];
    S.chipRects = [];
    for (const e of list) {
      const size = e.boss ? 40 : 44, locked = S.lock.locked === e;
      const cs = D.chipSize(ctx, e.typer, size);
      const w = cs.w * (locked ? 1.08 : 1) + 8, h = cs.h * (locked ? 1.08 : 1) + (g.hint ? 34 : 6);
      const cx = clamp(e.x - 12, F.l + w / 2 + 12, F.r - w / 2 - 12), base = LY[e.lane] - (e.boss ? 225 : 150);
      let cy = base;
      for (const off of [0, -78, 78, -156, 156, -234]) {
        const y = Math.max(F.t + 150 + h / 2, base + off);
        if (!placed.some((r) => Math.abs(r.x - cx) < (r.w + w) / 2 && Math.abs(r.y - y) < (r.h + h) / 2)) { cy = y; break; }
        cy = y;
      }
      placed.push({ x: cx, y: cy, w, h });
      D.chip(ctx, cx, cy, e.typer, { size, accent: locked ? '#FF7A1A' : C.ink2, locked, hint: g.hint });
      // tail pointing at the zombie
      ctx.fillStyle = locked ? '#FF7A1A' : '#1F1A3D';
      const ty = foeY(e) - (e.boss ? 200 : 150);
      if (cy + h / 2 - 6 < ty) { ctx.beginPath(); ctx.moveTo(e.x - 18, cy + h / 2 - 4 + (g.hint ? 30 : 0)); ctx.lineTo(e.x + 10, cy + h / 2 - 4 + (g.hint ? 30 : 0)); ctx.lineTo(e.x - 4, Math.min(ty + 8, cy + h / 2 + 22 + (g.hint ? 30 : 0))); ctx.fill(); }
      if (e.boss) {
        D.text(ctx, `${Math.min(e.idx + 1, e.items.length)}/${e.items.length}`, cx - w / 2 - 34, cy, { size: 34, color: '#fff', outline: 8 });
        D.text(ctx, e.name, cx, cy - h / 2 - 20, { size: 30, color: '#FFD23F', outline: 8 });
      }
      S.chipRects.push({ x: cx - w / 2, y: cy - h / 2, w, h, id: e.id });
    }
  }
  function drawHud(g, ctx, F) {
    if (g.demo) return;
    // coins (top left, under the framework's score pill)
    const x = F.l + 40, y = F.t + Math.max(128, 92 * F.v.w / window.innerWidth / F.s);
    D.pill(ctx, x, y - 30, 230, 60, 'rgba(31,26,61,.82)', { stroke: '#FFD23F', lw: 4 });
    CD.icon(ctx, 'CoinIcon', x + 38, y, 0.95);
    D.text(ctx, String(Math.round(S.coinsShown)), x + 136, y + 2, { size: 38, color: '#fff', outline: 0 });
    // wall percent under the bar
    CD.icon(ctx, 'WallIcon', 681, 718, 0.8);
    D.text(ctx, Math.round(S.wall.hp / S.wall.max * 100) + '%', 681, 765 + 12, { size: 26, color: S.wall.hp < S.wall.max * 0.3 ? '#FF7A5A' : '#fff', outline: 7 });
    if (S.phase === 'fight' || S.phase === 'clear') {
      // TNT meter (bottom right)
      const mx = F.r - 150, my = F.b - 140, k = S.meter / 100, ready = k >= 1;
      ctx.save(); ctx.translate(mx, my); const pulse = ready ? 1 + 0.06 * Math.sin(S.t * 10) : 1; ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(31,26,61,.85)'; ctx.beginPath(); ctx.arc(0, 0, 60, 0, 7); ctx.fill();
      ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(0, 0, 50, 0, 7); ctx.stroke();
      ctx.strokeStyle = ready ? '#FFD23F' : '#FF7A1A'; ctx.beginPath(); ctx.arc(0, 0, 50, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
      CD.icon(ctx, 'AddonIcon4', 0, -4, 0.8); ctx.restore();
      D.text(ctx, ready ? 'Enterで ドカーン！' : 'TNT', mx, my + 92, { size: ready ? 30 : 24, color: ready ? '#FFD23F' : '#fff', outline: 8 });
    }
    if (S.tipT > 0 && S.tip) D.text(ctx, S.tip, (F.l + F.r) / 2, F.b - 250, { size: 40, color: '#FFD23F', outline: 10 });
  }
  function button(ctx, ui, id, label, sub, x, y, w, h, o) {
    o = o || {};
    ui.btns.push({ id, x, y, w, h });
    const hov = S.hover && S.hover.kind === 'btn' && S.hover.id === id;
    const dis = o.disabled;
    ctx.save(); ctx.translate(x, y); if (hov && !dis) ctx.scale(1.04, 1.04);
    const path = new Path2D(); path.roundRect(-w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = 'rgba(31,26,61,.3)'; ctx.save(); ctx.translate(0, 7); ctx.fill(path); ctx.restore();
    ctx.fillStyle = dis ? '#A9A5BE' : o.color || '#fff'; ctx.fill(path);
    ctx.lineWidth = 6; ctx.strokeStyle = '#1F1A3D'; ctx.stroke(path);
    D.text(ctx, label, o.pulse ? -10 : -(sub ? 34 : 0), 2, { size: o.size || 40, color: o.text || '#1F1A3D', outline: 0, align: sub ? 'center' : 'center' });
    if (sub) D.text(ctx, sub, w / 2 - 110, 3, { size: 34, color: dis ? '#6E6A87' : '#C25B00', outline: 0 });
    if (o.key) D.text(ctx, o.key, -w / 2 + 40, 3, { size: 22, color: '#fff', outline: 0 });
    ctx.restore();
  }
  function drawBuild(g, ctx, F, ui) {
    const px = Math.min(1500, F.r - 300), top = 400;
    // panel
    ctx.fillStyle = 'rgba(31,26,61,.55)'; ctx.beginPath(); ctx.roundRect(px - 300, top - 70, 600, 540, 34); ctx.fill();
    D.text(ctx, `つぎは ウェーブ ${S.wave + 1}`, px, top - 28, { size: 40, color: '#fff', outline: 9 });
    const can = S.coins >= price() && freeSlot() >= 0;
    button(ctx, ui, 'buy', 'ネコを かう', String(price()), px, top + 52, 540, 92, { color: can ? '#8BE05A' : '#fff', key: 'Space' });
    button(ctx, ui, 'merge', 'ガッチャンコ！', null, px, top + 160, 540, 92, { color: canMerge() ? '#FFD23F' : '#fff', key: 'M' });
    button(ctx, ui, 'repair', 'かべを なおす', String(REPAIR_COST), px, top + 268, 540, 92, { key: 'R', disabled: S.wall.hp >= S.wall.max });
    const pulse = 1 + 0.03 * Math.sin(S.t * 6);
    ctx.save(); ctx.translate(px, top + 395); ctx.scale(pulse, pulse); ctx.translate(-px, -(top + 395));
    button(ctx, ui, 'go', 'スタート！', null, px, top + 395, 540, 112, { color: '#FF7A1A', text: '#fff', size: 52, pulse: false });
    D.text(ctx, 'Enter', px + 200, top + 398, { size: 26, color: '#fff', outline: 0 });
    ctx.restore();
    if (S.wave === 0 && S.buildT < 30) D.text(ctx, 'おなじ レベルの ネコを あわせると つよくなる！', (F.l + F.r) / 2 - 80, F.b - 105, { size: 34, color: '#fff', outline: 9 });
  }
  function drawBanner(ctx, F) {
    const b = S.banner; if (!b) return;
    const k = b.t / b.life, a = k < 0.12 ? k / 0.12 : k > 0.82 ? (1 - k) / 0.18 : 1;
    const sc = k < 0.18 ? 0.7 + 0.3 * U.ease.outBack(k / 0.18) : 1;
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate((F.l + F.r) / 2 + 100, F.t + 360); ctx.scale(sc, sc);
    D.text(ctx, b.title, 0, 0, { size: 104, color: b.color, outline: 20 });
    if (b.sub) D.text(ctx, b.sub, 0, 92, { size: 46, color: '#fff', outline: 12 });
    ctx.restore();
  }

  /* ---------------- boot ---------------- */
  TM.game({
    id: 'cat-defense', name: 'Cat Defenders', accent: '#FF9F1C', bg: '#1b1f2b',
    logoHTML: 'Cat<br>Defenders', tagline: 'ゾンビを タイプで やっつけろ！',
    lifeIcon: TM.ui.heartSVG('#FF9F1C'),
    howto: [
      '<b>ゾンビ</b>が かべに むかって あるいてくる！ ぜんぶ やっつけて まちを まもろう。',
      'ゾンビの うえの <b>ことば</b>を うとう。うつたびに その レーンの <b>ネコ</b>が バンバン うって、さいごまで うつと ゾンビが ドカーン！ まわりの ゾンビも まきこむよ。',
      'ウェーブの あいだに <b>コイン</b>で ネコを かおう。おなじ レベルの ネコを <b>ガッチャンコ</b>すると つよく なるよ（クリック、または <b>Space・M・R・1〜5</b>の キー）。',
      'ゾンビが かべに つくと かべが へるよ。<b>かべ</b>が なくなったら おしまい。ウェーブの あいだに コインで なおせるよ。',
      'タイプすると <b>TNT</b>が たまる。いっぱいに なったら <b>Enter</b>で ぜんぶ ふっとばそう！',
      '3・5・7・9・10ばんめの ウェーブは <b>ボス</b>！ ながい ぶんしょうを うって たおそう。',
    ],
    music: SONGS[0], reset, update, draw, onKey, onEnter, onBack() { },
    init(g) { G = g; CD.load(); },
    nextKey: () => { if (!S || S.phase !== 'fight') return null; const t = S.lock.locked || S.enemies.filter((e) => e.alive).sort((a, b) => a.x - b.x)[0]; return t ? t.typer.nextReq() : null; },
    hud: () => ({ right: S && !(S.auto && G.demo) ? `ウェーブ ${Math.min(S.wave + 1, NWAVE)}/${NWAVE}` : '', progress: S ? (S.wave + (S.phase === 'build' ? 0 : S.plan ? 1 - (S.queue.length + S.enemies.length) / Math.max(1, S.plan.toks.length) : 0)) / NWAVE : 0 }),
  });

  if (U.qs('dev') === '1') window.CDDev = {
    state: () => ({ phase: S.phase, wave: S.wave, coins: S.coins, wall: S.wall.hp, kills: S.kills, queue: S.queue.length, en: S.enemies.map((e) => ({ id: e.id, lane: e.lane, x: Math.round(e.x), text: e.typer.text, st: e.state, boss: !!e.boss, hp: e.hp })), slots: S.slots.map((c) => c.lvl), meter: S.meter, ad: S.ad.summary() }),
    goto: (w) => { S.wave = w; S.enemies = []; S.queue = []; S.phase = 'build'; S.buildT = 0; S.area = AREA_OF(w); },
    coins: (n) => { S.coins = n; }, god: () => { S.wall.hp = S.wall.max = 9999; }, start: () => beginWave(G), buy: (l) => buy(G, l), merge: () => mergeAll(G), tnt: () => { S.meter = 100; tnt(G); },
    auto: (cps, err, think) => { S.auto = cps ? { cps, err: err || 0, think: think == null ? 0.4 : think, acc: 0, wait: 0 } : null; },
    slot: (i, l) => { S.slots[i].lvl = l; }, key: (k) => onKey(G, k), F: () => S.F, chips: () => S.chipRects,
  };
})();
