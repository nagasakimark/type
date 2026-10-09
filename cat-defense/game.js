/* Cat Defenders - lane defence for typists. Zombies shuffle down 5 lanes toward the wall, each carrying a word.
   Cats shoot REAL bullets (damage lands when a bullet arrives, zombies have HP). Typing makes every cat in that lane fire a volley per
   letter and a heavy finisher per word; a lane with no cats does nothing. Coins buy cats (merge two same-level cats: more damage + perks:
   pierce / splash / blast), permanent upgrades (fire rate, power, coins, wall) and add-ons (spikes, boxing cat, TNT, guardian).
   Art: CraftPix "Cartoon Cat Defense" kit (see tools/build_catdef.py). */
(function () {
  'use strict';
  const TM = window.TM, CD = window.CD, U = TM.U, C = TM.C, D = TM.draw;
  const IW = CD.IW, IH = CD.IH;
  const LY = [302, 416, 530, 646, 760];           // lane centres (image px)
  const SXC = [273, 416];                         // slot columns: 0 = back, 1 = front
  const FOOT = 40;                                // cat / zombie feet are this far below the lane centre
  const STOP = 770;                               // zombies stop here and chew the wall
  const NWAVE = 10, NSLOT = 10, TRASH = 8, MAXLV = 15;
  const BOSS_NAME = ['なべゾンビ', 'バケツゾンビ', 'ふたゾンビ', 'ロケットゾンビ', 'たてゾンビ', 'メガネゾンビ', 'まじょゾンビ'];
  const BOSS_WAVES = { 2: [0], 4: [1], 6: [2], 8: [3], 9: [4, 6] };
  const AREA_OF = (w) => Math.min(4, Math.floor(w / 2));
  const ZS = 1.9, BS = 1.7;
  /* regular zombie archetypes by art type: hp multiplier, speed multiplier, wall damage multiplier */
  const ZT = [{ hp: 1, sp: 1, wd: 1 }, { hp: 0.7, sp: 1.35, wd: 0.8 }, { hp: 1.7, sp: 0.75, wd: 1.2 }, { hp: 1.1, sp: 1, wd: 1 }, { hp: 0.65, sp: 1.5, wd: 0.8 }, { hp: 2.3, sp: 0.65, wd: 1.4 }, { hp: 1.4, sp: 1.1, wd: 1.1 }, { hp: 3, sp: 0.6, wd: 1.6 }];
  const UPS = [
    { id: 'fire', key: 'f', icon: 'AddonIcon1', name: 'はやうち', desc: 'ネコが はやく うつ', cost: [50, 90, 140, 210, 300] },
    { id: 'dmg', key: 'd', icon: 'AddonIcon3', name: 'パワー', desc: 'たまが つよく なる', cost: [60, 110, 170, 250, 360] },
    { id: 'coin', key: 'c', icon: 'AddonIcon2', name: 'コイン', desc: 'コインが ふえる', cost: [45, 80, 130, 190, 270] },
    { id: 'wall', key: 'w', icon: 'WallIcon', name: 'かべ', desc: 'かべが じょうぶに', cost: [40, 75, 120, 180, 260] },
  ];
  const ADDS = [
    { id: 'spikes', key: 's', fkey: '6', icon: 'AddonIcon8', name: 'トゲ', desc: 'ふむと ダメージ', cost: 35 },
    { id: 'boxer', key: 'b', fkey: '7', icon: 'AddonIcon7', name: 'ボクシング', desc: 'パンチで ふっとばす', cost: 55 },
    { id: 'tnt', key: 't', fkey: '8', icon: 'AddonIcon6', name: 'TNT', desc: 'ぜんぶ ドカーン', cost: 70 },
    { id: 'guard', key: 'g', fkey: '9', icon: 'AddonIcon5', name: 'ガーディアン', desc: 'かべを まもる', cost: 110 },
  ];
  const SONGS = [
    TM.audio.song({ bpm: 128, roots: [45, 45, 41, 43], chords: [[69, 72, 76], [69, 72, 76], [65, 69, 72], [67, 71, 74]], bassPattern: [0, null, 12, 0, null, 12, 0, null, 0, 12, null, 0, 10, null, 12, null], lead: [76, null, 79, null, 81, null, 79, null, 76, null, 74, null, 72, null, null, null, 74, null, 77, null, 79, null, 77, null, 74, null, 72, null, 71, null, null, null], wave: 'square' }),
    TM.audio.song({ bpm: 138, roots: [43, 43, 46, 41], chords: [[67, 70, 74], [67, 70, 74], [70, 74, 77], [65, 68, 72]], bassPattern: [0, 0, null, 12, 0, null, 12, null, 0, 0, null, 12, 10, null, 12, null], lead: [74, null, 77, 79, null, 82, null, 79, 77, null, 74, null, 72, null, 74, null, 70, null, 74, 77, null, 79, null, 77, 74, null, 72, null, 70, null, null, null], wave: 'sawtooth' }),
    TM.audio.song({ bpm: 150, roots: [38, 38, 41, 43], chords: [[62, 65, 69], [62, 65, 69], [65, 69, 72], [67, 71, 74]], bassPattern: [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 10, 12, 7, 12], lead: [74, 77, 81, 77, 74, 77, 81, 86, 84, 81, 77, 81, 84, 81, 77, 74, 72, 76, 79, 76, 72, 76, 79, 84, 83, 79, 76, 79, 83, 79, 76, 71], wave: 'square' }),
  ];

  let S = null, G = null;
  const clamp = U.clamp, rnd = U.rand;

  /* ---------------- balance ---------------- */
  const BAL = { dmg0: 10, dmgG: 2.5, hp0: 26, hpG: 1.62, boss: 9, ivBase: 2.4, bullet: 1750, autoMul: 0.3, finMul: 3 };
  const hpBase = (w) => BAL.hp0 * Math.pow(BAL.hpG, w);
  const catDmg = (lvl) => BAL.dmg0 * Math.pow(BAL.dmgG, lvl - 1) * (1 + 0.2 * S.up.dmg);
  const catIv = (lvl) => Math.max(0.6, BAL.ivBase - 0.07 * lvl) / (1 + 0.14 * S.up.fire);
  const perkOf = (lvl) => (lvl >= 13 ? 3 : lvl >= 9 ? 2 : lvl >= 5 ? 1 : 0);
  const tierOf = (lvl) => (lvl >= 12 ? 3 : lvl >= 8 ? 2 : lvl >= 4 ? 1 : 0);
  const PERK_NAME = ['', 'つらぬく', 'ばくはつ', 'ちょうばくはつ'];
  const price = () => Math.min(115, Math.round(24 + 5 * S.bought));
  const repairCost = () => 35 + 4 * S.wave;
  const comboMul = (g) => 1 + 0.25 * ((g.score ? g.score.mult : 1) - 1);

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
  function reset(g) {
    G = g;
    S = {
      t: 0, phase: 'build', buildT: 0, wave: 0, coins: g.demo ? 0 : 90, coinsShown: g.demo ? 0 : 90, bought: 0, wall: { hp: 0, max: 100 }, slots: [], sel: -1, hover: null, ui: null, F: null, drag: null,
      enemies: [], corpses: [], bullets: [], boomFx: [], boxers: [], spikes: [], queue: [], spawnT: 1, uid: 0, lock: new TM.LockOn(), ad: new TM.Adapt(g.diff), banner: null,
      kills: 0, maxLv: 1, lastDone: 0, clearT: 0, shake: 0, wallFlash: 0, merges: 0, auto: null, tipT: 0, stats: { tnt: 0, spikes: 0, boxer: 0, guard: 0, gifts: 0, dmg: 0 },
      area: 0, music: -1, aliveCap: 3, plan: null, bossAlive: 0, streak: 0, up: { fire: 0, dmg: 0, coin: 0, wall: 0 }, stock: { spikes: 1, boxer: 1, tnt: 1, guard: 1 }, botT: 0, giftFx: null,
    };
    g.ad = S.ad;
    S.baseWall = g.diff === 'gentle' ? 140 : g.diff === 'turbo' ? 90 : 110; S.wall.max = S.baseWall; S.wall.hp = S.wall.max;
    for (let i = 0; i < NSLOT; i++) S.slots.push({ lvl: 0, fire: 0, autoT: rnd(0.4, 1.6), pop: 0, val: 0 });
    putCat(g, 5, 1, 0, true);                                // one starter cat, middle lane, front
    if (g.demo) { for (const [i, l] of [[1, 2], [3, 1], [5, 3], [7, 2], [9, 4]]) { S.slots[i].lvl = l; } S.wall.hp = S.wall.max = 9999; S.auto = { cps: 2.6, acc: 0, think: 0.5, err: 0.02, wait: 0 }; S.wave = 3; S.stock = { spikes: 9, boxer: 9, tnt: 9, guard: 0 }; beginWave(g); }
    else { S.F = frame(g); banner('じゅんび！', { sub: 'コインで ネコを かって ガッチャンコ！', life: 3.2 }); }
  }
  function banner(title, o) { S.banner = Object.assign({ title, t: 0, life: 2.2, color: '#fff', sub: null }, o || {}); }
  function tip(t) { S.tip = t; S.tipT = 2; }
  const wallMax = () => Math.round(S.baseWall * (1 + 0.22 * S.up.wall));

  /* ---------------- cats: buying, merging, selling ---------------- */
  const catCount = () => S.slots.filter((c) => c.lvl).length;
  function freeSlot(lane) {
    const ok = (s) => s !== TRASH && !S.slots[s].lvl;
    if (lane != null) { if (ok(lane * 2 + 1)) return lane * 2 + 1; if (ok(lane * 2)) return lane * 2; return -1; }
    let best = -1, bp = 1e9;
    for (let l = 0; l < 5; l++) { const f = freeSlot(l); if (f >= 0) { const p = lanePower(l) * 10 + (f % 2 ? 0 : 1) + Math.abs(l - 2) * 0.1; if (p < bp) { bp = p; best = f; } } }
    return best;
  }
  const lanePower = (lane) => { let f = 0; for (const c of [S.slots[lane * 2], S.slots[lane * 2 + 1]]) f += c.lvl; return f; };
  function buy(g, lane) {
    const slot = typeof lane === 'number' && lane >= 0 && lane < 5 ? freeSlot(lane) : freeSlot();
    if (S.coins < price()) { TM.sfx.miss(); tip('コインが たりないよ！'); return false; }
    if (slot < 0) { TM.sfx.miss(); tip(typeof lane === 'number' ? 'そのレーンは いっぱい！' : 'いっぱい！ ガッチャンコ してね'); return false; }
    const p = price(); S.coins -= p; S.bought++; putCat(g, slot, 1, p); TM.sfx.pop(); return true;
  }
  function buyAt(g, slot) {
    if (slot === TRASH || S.slots[slot].lvl) return false;
    const p = price();
    if (S.coins < p) { TM.sfx.miss(); tip('コインが たりないよ！'); return false; }
    S.coins -= p; S.bought++; putCat(g, slot, 1, p); TM.sfx.pop(); return true;
  }
  function putCat(g, slot, lvl, val, quiet) {
    const c = S.slots[slot]; c.lvl = lvl; c.pop = 1; c.val = val || 0; S.maxLv = Math.max(S.maxLv, lvl);
    if (!quiet && S.F) { const [x, y] = slotXY(slot); const [vx, vy] = toVirt(S.F, x, y); g.fx.stars(vx, vy, 6); }
  }
  function mergeTwo(g, a, b) {            // a and b hold the same level: result stays in b
    const A = S.slots[a], B = S.slots[b]; if (!A.lvl || A.lvl !== B.lvl || A.lvl >= MAXLV || a === b || a === TRASH || b === TRASH) return false;
    B.val += A.val; A.lvl = 0; A.val = 0; B.lvl++; B.pop = 1.4; S.merges++; S.maxLv = Math.max(S.maxLv, B.lvl);
    const [x, y] = slotXY(b); const [vx, vy] = toVirt(S.F || frame(g), x, y);
    g.fx.stars(vx, vy - 30, 14);
    const pk = perkOf(B.lvl), was = perkOf(B.lvl - 1);
    g.fx.pop(vx, vy - 120, 'Lv ' + B.lvl + (pk > was ? '  ' + PERK_NAME[pk] + '！' : '!'), { color: pk > was ? '#FF7A1A' : '#FFD23F', size: pk > was ? 64 : 56, life: 1.1 });
    TM.sfx.combo(Math.min(6, B.lvl)); return true;
  }
  function mergePair() {                 // best pair to merge: same lane first; across lanes only when no lane is left empty
    for (let lv = 1; lv < MAXLV; lv++) {
      const idx = []; for (let i = 0; i < NSLOT; i++) if (i !== TRASH && S.slots[i].lvl === lv) idx.push(i);
      if (idx.length < 2) continue;
      for (const a of idx) for (const b of idx) if (a !== b && ((a / 2) | 0) === ((b / 2) | 0)) return a % 2 === 1 && b % 2 === 0 ? [b, a] : [a, b];
      for (const a of idx) for (const b of idx) if (a !== b && laneCats((a / 2) | 0).length > 1) return [a, b];
    }
    return null;
  }
  function mergeAll(g) {
    let n = 0;
    for (let guard = 0; guard < 40; guard++) { const pair = mergePair(); if (!pair) break; mergeTwo(g, pair[0], pair[1]); n++; }
    if (!n) { TM.sfx.miss(); tip('あわせられる ネコが いないよ'); }
    S.sel = -1; return n;
  }
  const canMerge = () => !!mergePair();
  function sell(g, i) {
    const c = S.slots[i]; if (!c.lvl || i === TRASH) return;
    const back = Math.max(5, Math.round(c.val * 0.6)); S.coins += back; c.lvl = 0; c.val = 0; S.sel = -1; TM.sfx.click();
    const [x, y] = slotXY(i); popText(g, x, y - 60, '+' + back, { color: '#FFD23F', size: 44, life: 0.9 });
  }
  function moveCat(g, a, b) { const A = S.slots[a], B = S.slots[b]; const t = { lvl: A.lvl, val: A.val }; A.lvl = B.lvl; A.val = B.val; B.lvl = t.lvl; B.val = t.val; B.pop = 1; A.pop = B.lvl ? 1 : 0; TM.sfx.click(); }
  function repair(g) {
    if (S.wall.hp >= S.wall.max) { tip('かべは げんき！'); return; }
    const c = repairCost();
    if (S.coins < c) { TM.sfx.miss(); tip('コインが たりないよ！'); return; }
    S.coins -= c; S.wall.hp = Math.min(S.wall.max, S.wall.hp + Math.ceil(S.wall.max * 0.3)); TM.sfx.word(); S.wallFlash = 1;
  }
  function clickSlot(g, i) {
    const c = S.slots[i];
    if (i === TRASH) { if (S.sel >= 0) sell(g, S.sel); else tip('ネコを ここに すてると コインに なるよ'); S.sel = -1; return; }
    if (!c.lvl) { S.sel = -1; buyAt(g, i); return; }
    if (S.sel >= 0 && S.sel !== i && S.slots[S.sel].lvl === c.lvl) { mergeTwo(g, S.sel, i); S.sel = -1; return; }
    S.sel = S.sel === i ? -1 : i; TM.sfx.click();
  }
  function dropCat(g, from, hit) {
    S.sel = -1; if (!hit || hit.kind !== 'slot' || hit.i === from) return;
    const j = hit.i;
    if (j === TRASH) { sell(g, from); return; }
    const A = S.slots[from], B = S.slots[j];
    if (!B.lvl) moveCat(g, from, j);
    else if (B.lvl === A.lvl && A.lvl < MAXLV) mergeTwo(g, from, j);
    else moveCat(g, from, j);
  }

  /* ---------------- shop: upgrades + add-ons ---------------- */
  const upCost = (u) => (S.up[u.id] >= 5 ? 0 : u.cost[S.up[u.id]]);
  function buyUp(g, id) {
    const u = UPS.find((x) => x.id === id); if (!u) return false;
    if (S.up[id] >= 5) { tip('もう さいだい！'); return false; }
    const c = upCost(u); if (S.coins < c) { TM.sfx.miss(); tip('コインが たりないよ！'); return false; }
    S.coins -= c; S.up[id]++; TM.sfx.boost();
    if (id === 'wall') { const m = wallMax(), d = m - S.wall.max; S.wall.max = m; S.wall.hp += d; }
    return true;
  }
  function buyAdd(g, id) {
    const a = ADDS.find((x) => x.id === id); if (!a) return false;
    if (S.stock[id] >= 5) { tip('もう もてないよ！（5こ まで）'); return false; }
    if (S.coins < a.cost) { TM.sfx.miss(); tip('コインが たりないよ！'); return false; }
    S.coins -= a.cost; S.stock[id]++; TM.sfx.pop(); return true;
  }
  function busyLane() {
    const l = S.lock.locked; if (l && l.alive) return l.lane;
    const e = S.enemies.filter((q) => q.alive && q.x < (S.F ? S.F.r : 2000)).sort((a, b) => a.x - b.x)[0];
    return e ? e.lane : 2;
  }
  function useAdd(g, id) {
    if (S.phase !== 'fight') return false;
    if (S.stock[id] <= 0) { TM.sfx.miss(); tip('もう ないよ！ じゅんびで かおう'); return false; }
    if (id === 'spikes') {
      const lane = busyLane(); if (S.spikes.some((s) => s.lane === lane && s.hits > 3)) { tip('もう トゲが あるよ'); return false; }
      S.stock.spikes--; S.stats.spikes++; S.spikes.push({ lane, hits: 26, t: 0, born: S.t }); TM.sfx.whoosh(); return true;
    }
    if (id === 'boxer') {
      const lane = busyLane(); S.stock.boxer--; S.stats.boxer++;
      S.boxers.push({ lane, x: STOP - 300, t: 0, dur: 8, punch: 0, p: 0, tgt: null }); TM.sfx.whoosh(); return true;
    }
    if (id === 'tnt') {
      if (!S.enemies.some((e) => e.alive && e.x < S.F.r + 20)) { tip('ゾンビが いないよ'); return false; }
      S.stock.tnt--; S.stats.tnt++; tnt(g); return true;
    }
    if (id === 'guard') {
      if (S.wall.hp >= S.wall.max * 0.7) { tip('かべが ピンチの ときに つかおう！'); return false; }
      S.stock.guard--; S.stats.guard++; guardian(g); return true;
    }
    return false;
  }
  function tnt(g) {
    S.shake = 20; TM.sfx.boost();
    const F = S.F, dmg = hpBase(S.wave) * 1.25;
    for (let i = 0; i < 7; i++) S.boomFx.push({ x: rnd(STOP + 120, F.r - 100), y: rnd(LY[0], LY[4]) + 20, t: -i * 0.07, s: rnd(1.2, 1.9), dur: 0.7 });
    for (const q of S.enemies.slice()) if (q.alive && q.x < F.r + 40) { dmgFoe(g, q, q.boss ? q.maxHp * 0.1 + dmg * 0.4 : dmg, { kind: 'tnt' }); if (q.alive) { q.push = Math.max(q.push, q.boss ? 100 : 240); q.stun = Math.max(q.stun, 0.8); } }
    banner('ドカーン！', { life: 1.1, color: '#FFB23F' });
  }
  function guardian(g) {
    banner('ガーディアン ニャン！', { life: 2, color: '#8FE9FF' });
    S.boxers.push({ lane: 2, x: STOP - 160, t: 0, dur: 1.1, guard: true, hit: false });
    TM.sfx.big();
  }
  function gift(g) {
    const ids = ADDS.map((a) => a.id).filter((id) => S.stock[id] < 5); if (!ids.length) { S.coins += 40; return; }
    const id = U.pick(ids), a = ADDS.find((x) => x.id === id); S.stock[id]++; S.stats.gifts++;
    S.giftFx = { icon: a.icon, name: a.name, t: 0 }; TM.sfx.star && TM.sfx.star();
  }

  /* ---------------- waves ---------------- */
  function planWave(g, w) {
    const dens = g.diff === 'gentle' ? 0.8 : g.diff === 'turbo' ? 1.25 : 1;
    const bosses = BOSS_WAVES[w] || null;
    const n = Math.round((5 + w * 1.4) * dens * (bosses ? 0.7 : 1));
    const toks = []; for (let i = 0; i < n; i++) toks.push('z');
    if (bosses) bosses.forEach((b, k) => toks.splice(Math.min(toks.length, Math.floor(toks.length * (0.3 + 0.28 * k))), 0, 'b' + b));
    return { n, toks, boss: bosses, cap: clamp(3 + Math.floor(w / 2.5) + (g.diff === 'turbo' ? 1 : g.diff === 'gentle' ? -1 : 0), 2, 7) };
  }
  function beginWave(g) {
    S.phase = 'fight'; S.plan = planWave(g, S.wave); S.queue = S.plan.toks.slice(); S.spawnT = 1.6; S.aliveCap = S.plan.cap; S.sel = -1; S.drag = null; S.lock.release();
    S.area = AREA_OF(S.wave); S.usedLanes = [];
    const boss = !!S.plan.boss;
    if (!g.demo) banner(boss ? 'ボス ゾンビだ！' : `ウェーブ ${S.wave + 1}`, { sub: boss ? BOSS_NAME[S.plan.boss[0]] + (S.plan.boss.length > 1 ? ' ほか' : '') : S.wave === NWAVE - 1 ? 'さいごの ウェーブ！' : S.wave === 0 ? 'ことばを うつと ネコが たまを うつよ！' : null, life: boss ? 2.8 : 2.2, color: boss ? '#FF5A5F' : '#fff' });
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
  const bossSentence = (g) => takeWord(g, { kind: 'sentence', maxWords: 2 + Math.floor(S.wave / 3) });
  function spawn(g, tok, o) {
    o = o || {};
    const F = S.F || frame(g);
    const xr = o.x || F.r + 160;
    if (tok[0] === 'b') {
      const type = +tok.slice(1);
      const items = [bossSentence(g), bossSentence(g)];
      const free = [0, 1, 2, 3, 4].filter((l) => !S.enemies.some((q) => q.lane === l && q.boss));
      const lane = o.lane != null ? o.lane : U.pick(free.length ? free : [2]);
      const T = S.ad.time(items[0].len + items[1].len) * 2.2, D0 = xr - STOP;
      const hp = hpBase(S.wave) * BAL.boss * (S.plan && S.plan.boss && S.plan.boss.length > 1 ? 0.6 : 1) * (1 + 0.08 * type) * (g.diff === 'gentle' ? 0.8 : g.diff === 'turbo' ? 1.2 : 1);
      const e = { id: ++S.uid, boss: true, kind: 'boss', type, lane, x: xr, speed: clamp(D0 / T, 18, 55), items, typer: new TM.Typer(items[0]), alive: true, state: 'walk', t: rnd(0, 5), at: 0, flash: 0, hp, maxHp: hp, born: S.t, push: 0, stun: 0, slow: 0, inc: 0, acc: 0, accT: 0, name: BOSS_NAME[type], calls: 0, spkT: 0, done: 0, phase: 0 };
      S.enemies.push(e); S.bossAlive++; return e;
    }
    const lanes = [0, 1, 2, 3, 4].filter((l) => !S.enemies.some((q) => q.lane === l && q.x > xr - 260));
    const covered = (lanes.length ? lanes : [0, 1, 2, 3, 4]).filter((l) => laneCats(l).length);
    // early on zombies only walk down lanes that have a cat; later they also probe the empty lanes (cover your lanes!)
    const pool = covered.length && (S.wave < 3 || g.demo || Math.random() < 0.78) ? covered : (lanes.length ? lanes : [0, 1, 2, 3, 4]);
    const lane = o.lane != null ? o.lane : U.pick(pool);
    const item = wordItem(g), len = item.len, type = U.randi(0, Math.min(7, 1 + Math.floor(S.wave * 0.8)));
    const zt = ZT[type], dm = g.diff === 'gentle' ? 0.85 : g.diff === 'turbo' ? 1.15 : 1;
    const T = S.ad.time(len) * (g.diff === 'gentle' ? 3.1 : g.diff === 'turbo' ? 2.2 : 2.6), D0 = xr - STOP;
    const hp = hpBase(S.wave) * zt.hp * (0.6 + 0.1 * len) * dm;
    const e = { id: ++S.uid, kind: 'reg', type, lane, x: xr, speed: clamp(D0 / T, 26, 185) * zt.sp * (g.demo ? 0.8 : 1), item, typer: new TM.Typer(item), alive: true, state: 'walk', t: rnd(0, 5), at: 0, flash: 0, hp, maxHp: hp, born: S.t, push: 0, stun: 0, slow: 0, inc: 0, acc: 0, accT: 0, wd: zt.wd, rearm: false, spkT: 0 };
    S.enemies.push(e); return e;
  }

  /* ---------------- shooting: real bullets, damage lands on arrival ---------------- */
  const foeY = (e) => LY[e.lane] + FOOT;
  const foeCenter = (e) => [e.x - (e.boss ? 30 : 14), foeY(e) - (e.boss ? 95 : 68)];
  const onScreen = (e) => e.x < (S.F ? S.F.r - 24 : 1900);
  const targetable = (e) => e.alive && !e.rearm && onScreen(e);
  function shoot(slot, e, o) {
    const c = S.slots[slot]; if (!c.lvl || !e.alive) return;
    o = o || {};
    const [sx, sy] = slotXY(slot), [tx, ty] = foeCenter(e);
    const mx = sx + 70, my = sy + FOOT - 74 + (slot % 2 ? 0 : 3), pk = perkOf(c.lvl);
    const dmg = catDmg(c.lvl) * (o.mul || 1);
    c.fire = 1; e.inc += dmg;
    S.bullets.push({ x: mx, y: my, tx, ty, t: -(o.delay || 0), tgt: e, dmg, i: pk >= 2 ? 0 : pk === 1 ? 2 : 1, sc: (1.25 + 0.15 * pk) * (o.heavy ? 1.5 : 1), pierce: pk >= 3 ? 2 : pk >= 1 ? 1 : 0, splash: pk >= 3 ? 230 : pk >= 2 ? 150 : 0, heavy: !!o.heavy, lane: e.lane, hit: [e.id], typed: !!o.typed, rot: 0, vs: o.heavy ? 1500 : BAL.bullet, from: slot });
  }
  function pickTarget(lane, fromAll) {
    let list = S.enemies.filter((q) => targetable(q) && q.lane === lane).sort((a, b) => a.x - b.x);
    if (!list.length && fromAll) list = S.enemies.filter((q) => targetable(q) && q.boss).sort((a, b) => a.x - b.x);
    if (!list.length) return null;
    return list.find((q) => q.hp - q.inc > 0.5) || (list[0].inc < list[0].hp * 1.6 ? list[0] : null);
  }
  function laneCats(lane) { const a = []; for (const s of [lane * 2 + 1, lane * 2]) if (S.slots[s].lvl) a.push(s); return a; }
  function volley(g, e, heavy) {
    // typing: every cat in the zombie's lane fires. Against a boss the whole army turns to fire on it.
    let n = 0; const mul = comboMul(g) * (heavy ? BAL.finMul : 1);
    const lanes = e.boss ? [0, 1, 2, 3, 4] : [e.lane];
    for (const l of lanes) for (const s of laneCats(l)) { shoot(s, e, { mul, heavy, typed: true, delay: 0.035 * n + (l === e.lane ? 0 : 0.06) }); n++; }
    return n;
  }
  function dmgFoe(g, e, dmg, o) {
    if (!e.alive) return;
    e.hp -= dmg; e.flash = 1; e.acc += dmg; if (!e.accT) e.accT = 0.35; S.stats.dmg += dmg;
    if (e.boss) checkBossPhase(g, e);
    if (e.hp <= 0) killFoe(g, e, o && o.kind || 'shot');
  }
  function checkBossPhase(g, e) {
    const f = e.hp / e.maxHp, ph = f < 0.34 ? 2 : f < 0.67 ? 1 : 0;
    if (ph > e.phase && e.hp > 0) {
      e.phase = ph; e.stun = 1.1; e.flash = 1; S.shake = 14; TM.sfx.big();
      banner(BOSS_NAME[e.type] + ' が おこった！', { life: 1.6, color: '#FF5A5F', sub: 'しもべを よんだ！' });
      const k = ph === 2 ? 3 : 2;
      for (let i = 0; i < k; i++) { const m = spawn(G, 'z', { x: Math.min(S.F.r + 80, e.x + 150 + i * 120), lane: [0, 1, 2, 3, 4].filter((l) => l !== e.lane)[(i * 2 + ph) % 4] }); m.hp = m.maxHp = m.maxHp * 0.7; m.minion = true; }
    }
  }
  function updateBullets(g, dt) {
    const keep = [];
    for (const b of S.bullets) {
      b.t += dt; if (b.t < 0) { keep.push(b); continue; }
      if (b.tgt && b.tgt.alive) { const [tx, ty] = foeCenter(b.tgt); b.tx = tx; b.ty = ty; }
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy), step = b.vs * dt;
      b.rot = Math.atan2(dy, dx);
      if (d > step + 14) { b.x += dx / d * step; b.y += dy / d * step; keep.push(b); continue; }
      // arrived
      const e = b.tgt;
      if (!e || !e.alive) { S.boomFx.push({ x: b.tx, y: b.ty, t: 0, s: 0.22, dur: 0.22 }); continue; }
      e.inc = Math.max(0, e.inc - b.dmg);
      S.boomFx.push({ x: b.tx + rnd(-8, 8), y: b.ty + rnd(-10, 10), t: 0, s: b.heavy ? 0.7 : 0.3, dur: b.heavy ? 0.4 : 0.26 });
      if (b.heavy) { S.shake = Math.max(S.shake, 4); e.push = Math.max(e.push, e.boss ? 40 : 130); }
      if (b.splash > 0) {
        S.boomFx.push({ x: b.tx, y: b.ty, t: 0, s: b.splash > 200 ? 1.1 : 0.8, dur: 0.45 });
        for (const q of S.enemies.slice()) if (q !== e && q.alive && Math.abs(q.lane - e.lane) <= 1 && Math.abs(q.x - e.x) < b.splash) dmgFoe(g, q, b.dmg * 0.5, { kind: 'splash' });
      }
      const dealt = b.dmg; S.stats[b.typed ? 'dmgT' : 'dmgA'] = (S.stats[b.typed ? 'dmgT' : 'dmgA'] || 0) + dealt; dmgFoe(g, e, dealt, { kind: 'shot' });
      if (b.pierce > 0) {
        const next = S.enemies.filter((q) => q.alive && q.lane === b.lane && !b.hit.includes(q.id) && q.x >= e.x - 4 && onScreen(q)).sort((a, c) => a.x - c.x)[0];
        if (next) { b.pierce--; b.dmg *= 0.65; b.hit.push(next.id); b.tgt = next; next.inc += b.dmg; b.x = b.tx; b.y = b.ty; keep.push(b); }
      }
    }
    S.bullets = keep;
  }

  /* ---------------- kills ---------------- */
  function popText(g, x, y, str, o) { const F = S.F || frame(g); const [vx, vy] = toVirt(F, x, y); g.fx.pop(vx, vy, str, o); }
  function killFoe(g, e, how) {
    if (!e.alive) return;
    e.alive = false; e.state = 'dead'; S.enemies = S.enemies.filter((q) => q !== e); S.corpses.push({ e, t: 0 });
    if (e.boss) S.bossAlive--;
    S.kills++;
    const len = e.boss ? 14 : e.item ? e.item.len : 4;
    const base = e.boss ? 90 + S.wave * 14 : 4 + len * 1.2 + S.wave * 2.6;
    const gain = Math.round(base * (1 + 0.2 * S.up.coin) * (e.minion ? 0.4 : 1));
    S.coins += gain;
    const [cx, cy] = foeCenter(e);
    if (e.acc > 0) { popText(g, cx, cy - 20, String(Math.round(e.acc)), { color: '#fff', size: 34, life: 0.6 }); e.acc = 0; }
    popText(g, cx, cy - 80, '+' + gain, { color: '#FFD23F', size: e.boss ? 70 : 46, life: 0.9 });
    if (S.F) { const [vx, vy] = toVirt(S.F, cx, cy); g.fx.stars(vx, vy, e.boss ? 20 : 5); }
    S.boomFx.push({ x: cx, y: cy, t: 0, s: e.boss ? 1.8 : 0.7, dur: e.boss ? 0.7 : 0.4 });
    TM.sfx.splat(); if (e.boss) { TM.sfx.big(); S.shake = 14; }
    if (S.lock.locked === e) S.lock.release();
  }
  function newWord(g, e) {
    e.rearm = false;
    if (e.boss) { e.typer = new TM.Typer(bossSentence(g)); return; }
    const item = wordItem(g); e.item = item; e.typer = new TM.Typer(item);
  }
  function wordFinished(g, e) {
    const dur = e.typer.started ? (performance.now() - e.typer.started) / 1000 : 1;
    const [cx, cy] = foeCenter(e);
    const cats = laneCats(e.lane).length + (e.boss ? 99 : 0);
    if (e.typer.errors === 0) { S.streak++; if (S.streak >= 7) { S.streak = 0; gift(g); } } else S.streak = 0;
    volley(g, e, true);
    if (e.boss) {
      g.wordDone(e.typer, ...toVirt(S.F, cx, cy - 100), { bonus: 2 });
      e.done++; e.push = Math.max(e.push, 90); e.stun = Math.max(e.stun, 0.7); S.shake = 10; TM.sfx.big();
      S.ad.word(e.typer.item.len, dur, e.typer.errors, null, null, null);
      newWord(g, e); return;
    }
    const margin = clamp((e.x - STOP) / Math.max(200, (S.F ? S.F.r : 1900) + 160 - STOP), 0, 1);
    const cycle = S.t - Math.max(S.lastDone, e.born / 1); S.lastDone = S.t;
    S.ad.word(e.item.len, dur, e.typer.errors, null, cycle, margin);
    g.wordDone(e.typer, ...toVirt(S.F, cx, cy - 100), { color: '#fff' });
    if (laneCats(e.lane).length === 0) { popText(g, cx, cy - 60, 'ネコが いないよ！', { color: '#FF8A7A', size: 40, life: 1 }); }
    if (e.hp - e.inc > 0.5 || !laneCats(e.lane).length) newWord(g, e); else e.rearm = true;      // dead on arrival? hide the word; otherwise a new word
  }

  /* ---------------- input ---------------- */
  function onKey(g, k) {
    if (!S) return;
    if (S.phase === 'build') {
      if (k === ' ') buy(g);
      else if (k === 'm') mergeAll(g);
      else if (k === 'r') repair(g);
      else if (k === 'x') { if (S.sel >= 0) sell(g, S.sel); }
      else if (k >= '1' && k <= '5') buy(g, +k - 1);
      else { const u = UPS.find((x) => x.key === k); if (u) buyUp(g, u.id); else { const a = ADDS.find((x) => x.key === k); if (a) buyAdd(g, a.id); } }
      return;
    }
    if (S.phase !== 'fight') return;
    if (k >= '1' && k <= '5') { buy(g, +k - 1); return; }
    if (k === '0') { repair(g); return; }
    const ad = ADDS.find((x) => x.fkey === k); if (ad) { useAdd(g, ad.id); return; }
    const targets = S.enemies.filter(targetable);
    const r = S.lock.feed(k, targets);
    if (!r.target) { g.keyResult('miss'); return; }
    if (r.result === 'miss') { g.keyResult('miss'); S.ad.key(false); return; }
    g.keyResult('ok'); S.ad.key(true);
    const e = r.target;
    if (r.result !== 'done') { volley(g, e, false); TM.sfx.zap(); }
    if (r.result === 'done') wordFinished(g, e);
  }
  function onEnter(g) {
    if (!S) return;
    if (S.phase === 'build') { if (!g.demo) beginWave(g); return; }
    if (S.phase === 'fight') useAdd(g, 'tnt');
  }
  function onBack(g) { if (S && !g.demo && (S.phase === 'build' || S.phase === 'fight')) mergeAll(g); }
  function pointer(e) {
    if (!S || !G || G.state !== 'play' || TM.ui.isModalOpen() || !S.ui || (S.phase !== 'build' && S.phase !== 'fight')) return;
    if (e.target && e.target.id !== 'stage') return;
    const p = pointerToImage(e); if (!p) return;
    const hit = hitTest(p[0], p[1]);
    if (e.type === 'pointermove') {
      S.hover = hit; document.getElementById('stage').style.cursor = hit ? 'pointer' : '';
      if (S.drag) { S.drag.x = p[0]; S.drag.y = p[1]; if (Math.hypot(p[0] - S.drag.sx, p[1] - S.drag.sy) > 18) S.drag.moved = true; }
      return;
    }
    if (e.type === 'pointerup') {
      const d = S.drag; S.drag = null; if (!d) return;
      if (d.moved) dropCat(G, d.from, hit); else clickSlot(G, d.from);
      return;
    }
    if (e.type !== 'pointerdown') return;
    if (!hit) { S.sel = -1; return; }
    if (hit.kind === 'slot') { if (S.slots[hit.i].lvl && hit.i !== TRASH) S.drag = { from: hit.i, sx: p[0], sy: p[1], x: p[0], y: p[1], moved: false }; else clickSlot(G, hit.i); return; }
    const id = hit.id;
    if (id === 'buy') buy(G); else if (id === 'merge') mergeAll(G); else if (id === 'repair') repair(G); else if (id === 'go') { if (S.phase === 'build') beginWave(G); }
    else if (id.startsWith('up:')) buyUp(G, id.slice(3));
    else if (id.startsWith('ao:')) { if (S.phase === 'build') buyAdd(G, id.slice(3)); else useAdd(G, id.slice(3)); }
  }
  function hitTest(x, y) {
    for (const b of S.ui.btns) if (x >= b.x - b.w / 2 && x <= b.x + b.w / 2 && y >= b.y - b.h / 2 && y <= b.y + b.h / 2) return { kind: 'btn', id: b.id };
    for (let i = 0; i < NSLOT; i++) { const [sx, sy] = slotXY(i); if (Math.abs(x - sx) <= 58 && Math.abs(y - sy) <= 58) return { kind: 'slot', i }; }
    return null;
  }
  window.addEventListener('pointerdown', pointer); window.addEventListener('pointermove', pointer); window.addEventListener('pointerup', pointer);

  /* ---------------- bots (title demo + dev/balance sims) ---------------- */
  function botType(g, dt) {
    const A = S.auto; if (A.wait > 0) { A.wait -= dt; return; }
    A.acc += dt * A.cps;
    while (A.acc >= 1) {
      A.acc -= 1;
      let t = S.lock.locked;
      if (!t || !t.alive) { const c = S.enemies.filter(targetable); c.sort((a, b) => (laneCats(a.lane).length ? 0 : 1) - (laneCats(b.lane).length ? 0 : 1) || a.x - b.x); t = c[0]; A.wait = A.think * rnd(0.6, 1.3); }
      if (!t) { A.acc = 0; return; }
      let k = t.typer.nextReq(); if (!k) continue;
      if (Math.random() < A.err) k = 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
      onKey(g, k.toLowerCase());
      if (A.wait > 0) return;
    }
  }
  function botBuild(g) {
    // a sensible player: cats first, merge, then upgrades and add-ons with what is left
    for (let r = 0; r < 6; r++) {
      for (let l = 0; l < 5; l++) if (!laneCats(l).length && S.coins >= price()) buy(g, l);
      let n = 0; while (S.coins >= price() && freeSlot() >= 0 && n++ < 12) buy(g); mergeAll(g);
      if (S.wall.hp < S.wall.max * 0.6) repair(g);
      if (S.up.dmg < 5 && S.up.dmg <= S.up.fire) buyUp(g, 'dmg'); else if (S.up.fire < 5) buyUp(g, 'fire');
      if (S.up.wall < 2) buyUp(g, 'wall'); if (S.up.coin < 2) buyUp(g, 'coin');
      if (S.coins > 150) for (const a of ADDS) if (S.stock[a.id] < 2) buyAdd(g, a.id);
    }
    beginWave(g);
  }
  function botFight(g, dt) {
    S.botT -= dt; if (S.botT > 0 || S.phase !== 'fight') return; S.botT = 1.2;
    for (const e of S.enemies) if (e.alive && !e.boss && !laneCats(e.lane).length && S.coins >= price()) buy(g, e.lane);
    if (freeSlot() >= 0 && S.coins >= price()) buy(g);
    if (canMerge()) mergeAll(g);
    if (S.wall.hp < S.wall.max * 0.45 && S.coins >= repairCost() + 20) repair(g);
    if (S.coins > 200) for (const u of ['dmg', 'fire']) if (S.up[u] < 5) buyUp(g, u);
    const near = S.enemies.filter((e) => e.alive && e.x < S.F.r && e.x < STOP + 420);
    const big = S.enemies.filter((e) => e.alive && e.x < S.F.r);
    if (near.length && S.stock.spikes > 0 && !S.spikes.some((s) => s.lane === near[0].lane)) useAdd(g, 'spikes');
    if (near.length && S.stock.boxer > 0 && S.boxers.length < 1) useAdd(g, 'boxer');
    if (big.length >= 4 && S.stock.tnt > 0) useAdd(g, 'tnt');
    if (S.wall.hp < S.wall.max * 0.3 && S.stock.guard > 0) useAdd(g, 'guard');
  }
  function botBrain(g, dt) { botFight(g, dt); }

  /* ---------------- update ---------------- */
  function update(g, dt) {
    if (!S) return;
    S.F = frame(g); S.t += dt;
    S.shake = Math.max(0, S.shake - dt * 30); S.wallFlash = Math.max(0, S.wallFlash - dt * 2);
    if (S.banner) { S.banner.t += dt; if (S.banner.t > S.banner.life) S.banner = null; }
    if (S.tipT > 0) S.tipT -= dt;
    if (S.giftFx) { S.giftFx.t += dt; if (S.giftFx.t > 2.4) S.giftFx = null; }
    for (const c of S.slots) { c.fire = Math.max(0, c.fire - dt * 6); c.pop = Math.max(0, c.pop - dt * 3); }
    S.coinsShown += (S.coins - S.coinsShown) * (1 - Math.exp(-dt * 10)); if (Math.abs(S.coins - S.coinsShown) < 0.6) S.coinsShown = S.coins;
    for (const f of S.boomFx) f.t += dt; S.boomFx = S.boomFx.filter((f) => f.t < f.dur);
    for (const c of S.corpses) c.t += dt; S.corpses = S.corpses.filter((c) => c.t < 1.5);
    if (!g.demo && g.state !== 'play') return;
    if (S.phase === 'build') {
      S.buildT += dt;
      if ((g.devBot || S.auto) && S.buildT > 1.2 && !g.demo) botBuild(g);
      return;
    }
    if (S.auto) botType(g, dt);
    if (S.auto || g.devBot) botBrain(g, dt);
    updateBullets(g, dt);
    if (S.phase === 'clear') { S.clearT -= dt; if (S.clearT <= 0) afterClear(g); return; }
    if (S.phase === 'over') return;
    updateFight(g, dt);
  }
  function updateFight(g, dt) {
    const F = S.F;
    // spawning
    S.spawnT -= dt;
    if (S.queue.length && S.spawnT <= 0) {
      const alive = S.enemies.filter((e) => !e.boss && !e.minion).length;
      const tok = S.queue[0];
      if (tok[0] === 'b' ? S.bossAlive === 0 || S.queue.length === 1 : alive < S.aliveCap) {
        S.queue.shift(); spawn(g, tok);
        const avgLen = clamp(4.5 + S.wave * 0.6, 4, 9);
        const dens = g.diff === 'gentle' ? 0.8 : g.diff === 'turbo' ? 1.25 : 1;
        S.spawnT = clamp(S.ad.time(avgLen) * 0.9 / dens, 1.0, 7) * (tok[0] === 'b' ? 1.5 : 1) * (g.demo ? 0.7 : 1) * rnd(0.85, 1.15);
      } else S.spawnT = 0.35;
    }
    // zombies
    for (const e of S.enemies.slice()) {
      e.t += dt; e.flash = Math.max(0, e.flash - dt * 4); if (e.typer.shake > 0) e.typer.shake = Math.max(0, e.typer.shake - dt * 3);
      if (e.accT > 0) { e.accT -= dt; if (e.accT <= 0 && e.alive) { if (e.acc >= 1) { const [cx, cy] = foeCenter(e); popText(g, cx + rnd(-20, 20), cy - 40, String(Math.round(e.acc)), { color: e.acc > e.maxHp * 0.2 ? '#FFB23F' : '#fff', size: e.acc > e.maxHp * 0.2 ? 42 : 32, life: 0.55 }); } e.acc = 0; } }
      e.danger = 4000 - e.x; e.slow = Math.max(0, e.slow - dt);
      if (e.rearm && e.inc <= 0.01) newWord(g, e);
      if (e.push > 0) { const d = Math.min(e.push, e.push * 3 * dt + 4); e.x += d; e.push -= d; if (e.push < 2) e.push = 0; }
      if (e.stun > 0) { e.stun -= dt; if (e.state === 'attack') e.state = 'walk'; continue; }
      const front = S.enemies.filter((q) => q !== e && q.lane === e.lane && q.x < e.x).sort((a, b) => b.x - a.x)[0];
      const base = STOP + (e.boss ? 40 : 0), minX = Math.max(base, front ? front.x + (front.boss || e.boss ? 300 : 205) : 0);
      const was = e.state;
      const sp = e.speed * (e.slow > 0 ? 0.5 : 1);
      if (e.x > minX + 1) { e.x = Math.max(minX, e.x - sp * dt); e.state = 'walk'; }
      else e.state = e.x <= base + 2 ? 'attack' : 'walk';
      if (e.state === 'attack') {
        if (was !== 'attack') e.at = 0;
        e.at += dt; if (e.at >= (e.boss ? 2 : 1.4)) { e.at = 0; hitWall(g, e); }
      }
    }
    // cats shoot on their own too (slowly: typing is the big multiplier)
    for (let i = 0; i < NSLOT; i++) {
      const c = S.slots[i]; if (!c.lvl || i === TRASH) continue;
      c.autoT -= dt; if (c.autoT > 0) continue;
      const lane = (i / 2) | 0, e = pickTarget(lane, true);
      if (!e) { c.autoT = 0.2; continue; }
      c.autoT = catIv(c.lvl) * rnd(0.9, 1.12);
      shoot(i, e, { mul: BAL.autoMul });
    }
    // spikes
    for (const sp of S.spikes) {
      sp.t += dt;
      for (const e of S.enemies.slice()) {
        if (!e.alive || e.lane !== sp.lane || e.x < STOP - 30 || e.x > STOP + 520) continue;
        e.slow = Math.max(e.slow, 0.15); e.spkT -= dt;
        if (e.spkT <= 0 && sp.hits > 0) { e.spkT = 0.45; sp.hits--; const d = hpBase(S.wave) * 0.2 * (e.boss ? 0.5 : 1); dmgFoe(g, e, d, { kind: 'spike' }); S.boomFx.push({ x: e.x - 10, y: foeY(e) - 10, t: 0, s: 0.25, dur: 0.2 }); }
      }
    }
    S.spikes = S.spikes.filter((s) => s.hits > 0 || s.t < 0.5);
    // boxing cats / guardian
    for (const b of S.boxers) {
      b.t += dt;
      if (b.guard) { if (!b.hit && b.t > 0.45) { b.hit = true; S.shake = 16; TM.sfx.big(); for (const q of S.enemies) { q.push = Math.max(q.push, q.boss ? 160 : 420); q.stun = Math.max(q.stun, 1.2); q.flash = 1; } S.wall.hp = Math.min(S.wall.max, S.wall.hp + S.wall.max * 0.3); S.boomFx.push({ x: STOP + 20, y: LY[2], t: 0, s: 1.6, dur: 0.6 }); } continue; }
      const tg = S.enemies.filter((q) => q.alive && q.lane === b.lane && q.x < S.F.r).sort((a, c) => a.x - c.x)[0];
      if (tg) { const want = Math.max(STOP - 110, tg.x - 120); b.x += clamp(want - b.x, -900 * dt, 900 * dt); }
      b.punch -= dt; b.p = Math.max(0, b.p - dt);
      if (tg && b.punch <= 0 && tg.x - b.x < 190) { b.punch = 0.6; b.p = 0.5; const d = hpBase(S.wave) * 0.55 * (tg.boss ? 0.5 : 1); dmgFoe(g, tg, d, { kind: 'punch' }); if (tg.alive) tg.push = Math.max(tg.push, tg.boss ? 30 : 100); S.boomFx.push({ x: tg.x - 40, y: foeY(tg) - 60, t: 0, s: 0.6, dur: 0.35 }); TM.sfx.big(); }
    }
    S.boxers = S.boxers.filter((b) => b.t < b.dur);
    // wave end
    if (!S.queue.length && !S.enemies.length && S.phase === 'fight' && !S.plan.endHandled) { S.plan.endHandled = true; endWave(g); }
    // wall destroyed
    if (!g.demo && S.wall.hp <= 0 && S.phase === 'fight') {
      S.phase = 'over'; banner('かべが やられた！', { life: 3, color: '#FF5A5F' });
      g.end({ win: false, title: 'かべが こわれちゃった！', sub: `ウェーブ ${S.wave + 1} まで がんばった！`, stats: [['ウェーブ', S.wave + 1], ['ゾンビ', S.kills], ['ネコの つよさ', 'Lv ' + S.maxLv]], delay: 1600 });
    }
  }
  function hitWall(g, e) {
    const dmg = e.boss ? 3 + S.wave * 0.7 : (2 + S.wave * 0.38) * (e.wd || 1);
    if (g.demo) { S.wallFlash = 0.5; return; }
    S.wall.hp = Math.max(0, S.wall.hp - dmg); S.wallFlash = 1; S.shake = Math.max(S.shake, 5); TM.sfx.hurt(); S.ad.fail(e.boss ? 0.2 : 0.35);
    if (S.wall.hp > 0 && S.wall.hp < S.wall.max * 0.25 && S.stock.guard > 0 && !S.boxers.some((b) => b.guard)) { S.stock.guard--; S.stats.guard++; guardian(g); }
  }
  function endWave(g) {
    S.phase = 'clear'; S.clearT = 2.2; S.lock.release();
    const bonus = Math.round((30 + S.wave * 12) * (1 + 0.2 * S.up.coin)); S.coins += bonus;
    banner(S.wave === NWAVE - 1 ? 'ぜんぶ やっつけた！' : 'ウェーブ クリア！', { sub: `ボーナス +${bonus}`, life: 2.1, color: '#FFD23F' });
    if (!g.demo) { TM.sfx.win(); g.fx.confetti(S.F.l + 800, 300, 40); }
  }
  function afterClear(g) {
    S.spikes = []; S.boxers = []; S.bullets = [];
    if (g.demo) { S.wave = 2 + ((S.wave - 1) % 6); S.enemies = []; beginWave(g); return; }
    if (S.wave >= NWAVE - 1) {
      S.phase = 'over';
      g.end({ win: true, targetMet: S.wall.hp >= S.wall.max * 0.5, title: 'まちを まもった！', sub: 'ネコたちの だいしょうり！', stats: [['ゾンビ', S.kills], ['ネコの つよさ', 'Lv ' + S.maxLv], ['かべ', Math.round(S.wall.hp / S.wall.max * 100) + '%']], delay: 900 });
      return;
    }
    S.wave++; S.phase = 'build'; S.buildT = 0; S.area = AREA_OF(S.wave); S.plan = null;
    if (S.wall.hp < S.wall.max) S.wall.hp = Math.min(S.wall.max, S.wall.hp + (g.diff === 'gentle' ? 25 : 12));
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
    drawSlotsHint(ctx);
    for (const sp of S.spikes) drawSpikes(ctx, sp);
    // lanes, back to front: cats, zombies, boxers
    for (let l = 0; l < 5; l++) {
      for (const col of [0, 1]) drawCat(ctx, l * 2 + col);
      const row = S.enemies.filter((e) => e.lane === l).sort((a, b) => b.x - a.x);
      for (const c of S.corpses) if (c.e.lane === l) drawFoe(ctx, c.e, c.t);
      for (const e of row) drawFoe(ctx, e);
      for (const b of S.boxers) if (b.lane === l || (b.guard && l === 2)) drawBoxer(ctx, b);
    }
    for (const b of S.bullets) if (b.t > 0) CD.bullet(ctx, b.i, b.x, b.y, b.rot, b.sc);
    for (let i = 0; i < NSLOT; i++) { const c = S.slots[i]; if (c.fire > 0.3 && c.lvl && !(S.drag && S.drag.moved && S.drag.from === i)) { const [x, y] = slotXY(i); CD.muzzle(ctx, 1 - c.fire, x + 62, y + FOOT - 74, 0.75, 0); } }
    for (const f of S.boomFx) if (f.t > 0) CD.boom(ctx, f.t / f.dur, f.x, f.y, f.s * 0.9, 1 - Math.max(0, (f.t / f.dur - 0.7) / 0.3));
    drawBars(ctx);
    drawChips(g, ctx, F);
    drawHud(g, ctx, F);
    if (!g.demo && (S.phase === 'build' || S.phase === 'fight' || S.phase === 'clear')) drawBottom(g, ctx, F, ui);
    if (S.phase === 'build') drawBuild(g, ctx, F, ui);
    drawDrag(ctx);
    drawGift(ctx, F);
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
    const dragging = S.drag && S.drag.moved;
    for (let i = 0; i < NSLOT; i++) {
      const [x, y] = slotXY(i), c = S.slots[i];
      const hov = S.hover && S.hover.kind === 'slot' && S.hover.i === i, sel = S.sel === i;
      ctx.save();
      if (i === TRASH) {
        if ((hov && (S.sel >= 0 || dragging)) || (dragging && hov)) { ctx.strokeStyle = '#FF6A5A'; ctx.lineWidth = 7; ctx.beginPath(); ctx.roundRect(x - 52, y - 50, 104, 100, 12); ctx.stroke(); }
        else if (dragging || S.sel >= 0) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.roundRect(x - 52, y - 50, 104, 100, 12); ctx.stroke(); }
      } else if (!c.lvl) {
        if (S.phase === 'build' || S.phase === 'fight' && S.coins >= price()) {
          ctx.fillStyle = hov ? 'rgba(255,230,120,.55)' : S.phase === 'build' ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.10)'; ctx.beginPath(); ctx.roundRect(x - 48, y - 46, 96, 92, 10); ctx.fill();
          D.text(ctx, '+', x, y - 4, { size: 54, color: '#fff', outline: 8 });
          if (hov) D.text(ctx, String(price()), x, y + 34, { size: 26, color: '#FFD23F', outline: 7 });
        }
        if (dragging && hov) { ctx.strokeStyle = '#8BE05A'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(x - 52, y - 50, 104, 100, 12); ctx.stroke(); }
      } else if (hov || sel || (dragging && hov)) {
        const ok = dragging && S.drag.from !== i && S.slots[S.drag.from].lvl === c.lvl;
        ctx.strokeStyle = ok ? '#8BE05A' : sel ? '#FFD23F' : '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(x - 52, y - 50, 104, 100, 12); ctx.stroke();
      }
      ctx.restore();
    }
  }
  function drawCat(ctx, i) {
    const c = S.slots[i]; if (!c.lvl || i === TRASH) return;
    const ghost = S.drag && S.drag.moved && S.drag.from === i;
    const [x, y] = slotXY(i);
    const shooting = c.fire > 0.05;
    const f = shooting ? CD.catShoot(1 - c.fire) : CD.catIdle(S.t + i * 0.37);
    const pop = c.pop > 0 ? 1 + 0.35 * Math.sin(c.pop * Math.PI) : 1;
    CD.cat(ctx, c.lvl, f, x, y + FOOT, { s: 1.15 * pop, foot: 19, a: ghost ? 0.3 : 1 });
    // level badge: chevron tier + number
    const bx = x - 52, by = y - 52, tier = tierOf(c.lvl);
    CD.icon(ctx, 'Up' + tier, bx, by - 14, 0.8);
    ctx.fillStyle = S.sel === i ? '#FFD23F' : '#fff'; ctx.beginPath(); ctx.arc(bx, by + 14, 17, 0, 7); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#1F1A3D'; ctx.stroke();
    D.text(ctx, String(c.lvl), bx, by + 15, { size: c.lvl > 9 ? 19 : 22, color: '#1F1A3D', outline: 0 });
  }
  function drawFoe(ctx, e, deadT) {
    const y = foeY(e), s = e.boss ? BS : ZS * (e.minion ? 0.9 : 1);
    const dead = deadT != null;
    const anim = dead ? 'dead' : e.state === 'attack' ? 'attack' : 'walk';
    const p = dead ? Math.min(0.999, deadT / 0.9) : anim === 'attack' ? (e.at / (e.boss ? 2 : 1.4)) : ((e.t * (e.boss ? 0.8 : 1.0)) % 1);
    ctx.save();
    CD.foe(ctx, e.kind, e.type, anim, p, e.x, y, { s, flash: dead ? 0 : e.flash, a: dead ? Math.max(0, 1 - Math.max(0, deadT - 0.9) / 0.6) : 1, foot: e.boss ? 36 : 33 });
    ctx.restore();
  }
  function drawBars(ctx) {            // hp bars under every zombie's feet
    for (const e of S.enemies) {
      if (!e.alive || !onScreen(e) && e.x > S.F.r + 30) continue;
      const w = e.boss ? 190 : 100, h = e.boss ? 18 : 12, x = e.x - (e.boss ? 30 : 14) - w / 2, y = foeY(e) + 6;
      const k = clamp(e.hp / e.maxHp, 0, 1), pred = clamp((e.hp - e.inc) / e.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(20,16,40,.85)'; ctx.beginPath(); ctx.roundRect(x - 3, y - 3, w + 6, h + 6, 6); ctx.fill();
      ctx.fillStyle = k > 0.5 ? '#7CE04A' : k > 0.25 ? '#FFC93C' : '#FF5A4A'; ctx.fillRect(x, y, w * k, h);
      if (pred < k) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x + w * pred, y, w * (k - pred), h); }   // damage already on its way
    }
  }
  function drawSpikes(ctx, sp) {
    const a = clamp(sp.hits / 10, 0.35, 1) * Math.min(1, sp.t * 6), y = LY[sp.lane] + FOOT + 14;
    for (let i = 0; i < 5; i++) CD.icon(ctx, 'AddonIcon8', STOP + 20 + i * 108, y, 0.95 + 0 * a);
  }
  function drawBoxer(ctx, b) {
    const k = clamp(b.t / b.dur, 0, 1);
    if (b.guard) { CD.helper(ctx, 1, 'attack', k, b.x, LY[2] + FOOT, { foot: 35, s: 1.25, a: Math.min(1, 1 - Math.max(0, k - 0.8) / 0.2) * Math.min(1, k * 8) }); return; }
    const a = Math.min(1, b.t * 5) * Math.min(1, (b.dur - b.t) * 3);
    CD.helper(ctx, 0, b.p > 0 ? 'attack' : 'idle', b.p > 0 ? 1 - b.p / 0.5 : (S.t * 1.2) % 1, b.x, LY[b.lane] + FOOT, { foot: 37, s: 1.2, a });
  }
  function drawChips(g, ctx, F) {
    const list = S.enemies.filter((e) => e.alive && !e.rearm && e.x < F.r + 20).sort((a, b) => (S.lock.locked === a ? -1 : S.lock.locked === b ? 1 : a.x - b.x));
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
      const noCat = !g.demo && !e.boss && laneCats(e.lane).length === 0;
      D.chip(ctx, cx, cy, e.typer, { size, accent: locked ? '#FF7A1A' : noCat ? '#8A8AA8' : C.ink2, locked, hint: g.hint, dim: noCat && !locked });
      if (noCat) CD.icon(ctx, 'Icon_Cat', cx + w / 2 + 6, cy - h / 2 + 6, 0.42), D.text(ctx, '×', cx + w / 2 + 6, cy - h / 2 + 8, { size: 40, color: '#FF5A4A', outline: 8 });
      // tail pointing at the zombie
      ctx.fillStyle = locked ? '#FF7A1A' : '#1F1A3D';
      const ty = foeY(e) - (e.boss ? 200 : 150);
      if (cy + h / 2 - 6 < ty) { ctx.beginPath(); ctx.moveTo(e.x - 18, cy + h / 2 - 4 + (g.hint ? 30 : 0)); ctx.lineTo(e.x + 10, cy + h / 2 - 4 + (g.hint ? 30 : 0)); ctx.lineTo(e.x - 4, Math.min(ty + 8, cy + h / 2 + 22 + (g.hint ? 30 : 0))); ctx.fill(); }
      if (e.boss) D.text(ctx, e.name, cx, cy - h / 2 - 20, { size: 30, color: '#FFD23F', outline: 8 });
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
    // wave bar (creator style: skull bar)
    const wy = y + 62, wx = x + 105, wk = clamp((S.wave + (S.phase === 'build' ? 0 : S.plan ? 1 - (S.queue.length + S.enemies.length) / Math.max(1, S.plan.toks.length) : 0)) / NWAVE, 0, 1);
    CD.icon(ctx, 'WaveBar', wx, wy, 1.15);
    ctx.fillStyle = '#E8523C'; ctx.beginPath(); ctx.roundRect(wx - 70, wy - 17, 150 * wk, 34, 8); ctx.fill();
    CD.icon(ctx, 'WaveBar', wx, wy, 1.15);
    D.text(ctx, `${Math.min(S.wave + 1, NWAVE)}/${NWAVE}`, wx + 14, wy + 1, { size: 24, color: '#fff', outline: 7 });
    // wall percent under the bar
    CD.icon(ctx, 'WallIcon', 681, 718, 0.8);
    D.text(ctx, Math.round(S.wall.hp / S.wall.max * 100) + '%', 681, 777, { size: 26, color: S.wall.hp < S.wall.max * 0.3 ? '#FF7A5A' : '#fff', outline: 7 });
    if (S.tipT > 0 && S.tip) D.text(ctx, S.tip, (F.l + F.r) / 2, F.b - 170, { size: 40, color: '#FFD23F', outline: 10 });
  }
  function rbtn(ctx, ui, id, x, y, w, h, o) {
    o = o || {};
    ui.btns.push({ id, x, y, w, h });
    const hov = S.hover && S.hover.kind === 'btn' && S.hover.id === id;
    ctx.save(); ctx.translate(x, y); if (hov && !o.disabled) ctx.scale(1.04, 1.04);
    if (o.sprite) CD.iconRect(ctx, o.sprite, 0, 0, w, h, o.disabled ? 0.5 : 1);
    else { ctx.fillStyle = o.disabled ? 'rgba(120,118,140,.8)' : o.color || '#fff'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2.4); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#1F1A3D'; ctx.stroke(); }
    const ty = o.sprite ? -4 : 0;
    const lx = o.price != null ? -w * 0.17 : 0;
    D.text(ctx, o.label, lx, ty - (o.sub ? 14 : 0), { size: o.size || 34, color: o.text || '#fff', outline: o.sprite ? 8 : 0, align: 'center' });
    if (o.sub) D.text(ctx, o.sub, lx, ty + 24, { size: 20, color: 'rgba(255,255,255,.85)', outline: 6 });
    if (o.price != null) { CD.icon(ctx, 'CoinIcon', w * 0.2, ty - 4, 0.6); D.text(ctx, String(o.price), w * 0.2, ty + 28, { size: 28, color: '#FFE27A', outline: 7 }); }
    ctx.restore();
  }
  function drawBottom(g, ctx, F, ui) {
    const BY = Math.min(F.b - 100, 968);
    ctx.fillStyle = 'rgba(20,16,40,.55)'; ctx.beginPath(); ctx.roundRect(F.l + 14, BY - 66, F.r - F.l - 28, 132, 30); ctx.fill();
    const x0 = F.l + 28, fight = S.phase === 'fight';
    const canBuy = S.coins >= price() && freeSlot() >= 0;
    rbtn(ctx, ui, 'buy', x0 + 155, BY, 310, 104, { sprite: 'BtnGreen', label: 'ネコ', price: price(), sub: fight ? '1〜5  Space' : 'Space・1〜5', disabled: !canBuy, size: 36 });
    rbtn(ctx, ui, 'merge', x0 + 155 + 155 + 110 + 6, BY, 216, 104, { sprite: 'BtnOrange', label: 'ガッチャンコ', size: 25, sub: fight ? 'Backspace' : 'M', disabled: !canMerge() });
    rbtn(ctx, ui, 'repair', x0 + 155 + 155 + 110 + 6 + 108 + 6 + 128, BY, 256, 104, { sprite: 'BtnOrange', label: 'かべを なおす', size: 26, price: repairCost(), sub: fight ? '0' : 'R', disabled: S.wall.hp >= S.wall.max });
    ADDS.forEach((a, k) => {
      const cx = F.r - 84 - 142 * (3 - k), n = S.stock[a.id];
      const can = fight ? n > 0 : S.coins >= a.cost && n < 5;
      ui.btns.push({ id: 'ao:' + a.id, x: cx, y: BY, w: 130, h: 124 });
      const hov = S.hover && S.hover.kind === 'btn' && S.hover.id === 'ao:' + a.id;
      ctx.save(); ctx.translate(cx, BY - 6); if (hov) ctx.scale(1.05, 1.05);
      ctx.fillStyle = hov ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.roundRect(-62, -54, 124, 106, 16); ctx.fill();
      if (fight && n > 0 && a.id === 'tnt' && S.enemies.filter((e) => e.alive && e.x < F.r).length >= 4) { ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 6; ctx.stroke(); }
      const sz = CD.iconSize(a.icon); const sc = Math.min(86 / sz[0], 76 / sz[1]);
      ctx.globalAlpha = can || n > 0 && fight ? 1 : 0.5; CD.icon(ctx, a.icon, 0, -8, sc); ctx.globalAlpha = 1;
      CD.iconRect(ctx, 'AddonBoxNumber', 0, 44, 100, 38);
      D.text(ctx, `${n}/5`, 0, 45, { size: 25, color: '#fff', outline: 5 });
      D.text(ctx, fight ? a.fkey : a.key.toUpperCase(), -50, -42, { size: 24, color: '#1F1A3D', outline: 0 });
      ctx.restore();
      if (!fight) { CD.icon(ctx, 'CoinIcon', cx - 26, BY - 78, 0.45); D.text(ctx, String(a.cost), cx + 8, BY - 77, { size: 24, color: '#FFE27A', outline: 6 }); }
    });
    // hover info (cat or add-on)
    const h = S.hover; let info = null;
    if (h && h.kind === 'slot' && h.i !== TRASH && S.slots[h.i].lvl) { const lv = S.slots[h.i].lvl; info = `Lv ${lv}   ダメージ ${Math.round(catDmg(lv))}   ${PERK_NAME[perkOf(lv)] ? PERK_NAME[perkOf(lv)] + 'たま' : ''}`; }
    else if (h && h.kind === 'slot' && h.i === TRASH) info = 'ネコを ここへ ドラッグ → コインに かえる';
    else if (h && h.kind === 'btn' && h.id.startsWith('ao:')) { const a = ADDS.find((x) => 'ao:' + x.id === h.id); info = `${a.name}：${a.desc}`; }
    else if (h && h.kind === 'btn' && h.id.startsWith('up:')) { const u = UPS.find((x) => 'up:' + x.id === h.id); info = `${u.name}：${u.desc}`; }
    if (info) D.text(ctx, info, (F.l + F.r) / 2 + 40, BY - 88, { size: 32, color: '#fff', outline: 9 });
  }
  function drawBuild(g, ctx, F, ui) {
    const W = Math.min(1180, F.r - 840), x0 = F.r - 36 - W, top = 262;
    const cols = W >= 980 ? 4 : 2, gap = 18, cw = (W - gap * (cols - 1)) / cols, ch = 214;
    const rows = Math.ceil(UPS.length / cols), pH = 78 + rows * (ch + gap) + 128;
    ctx.fillStyle = 'rgba(31,26,61,.62)'; ctx.beginPath(); ctx.roundRect(x0 - 22, top - 24, W + 44, pH, 34); ctx.fill();
    D.text(ctx, `つぎは ウェーブ ${S.wave + 1}${BOSS_WAVES[S.wave] ? '  ボス！' : ''}`, x0 + W / 2, top + 14, { size: 46, color: '#fff', outline: 10 });
    UPS.forEach((u, k) => {
      const cx = x0 + (k % cols) * (cw + gap) + cw / 2, cy = top + 60 + Math.floor(k / cols) * (ch + gap) + ch / 2;
      const lv = S.up[u.id], max = lv >= 5, cost = upCost(u), can = !max && S.coins >= cost;
      ui.btns.push({ id: 'up:' + u.id, x: cx, y: cy, w: cw, h: ch });
      const hov = S.hover && S.hover.kind === 'btn' && S.hover.id === 'up:' + u.id;
      ctx.save(); ctx.translate(cx, cy); if (hov) ctx.scale(1.03, 1.03);
      ctx.fillStyle = can ? 'rgba(255,255,255,.96)' : 'rgba(215,212,235,.9)'; ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 22); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = can ? '#8BE05A' : '#1F1A3D'; ctx.stroke();
      const sz = CD.iconSize(u.icon), sc = Math.min(74 / sz[0], 68 / sz[1]); CD.icon(ctx, u.icon, 0, -ch / 2 + 54, sc * 1.1);
      D.text(ctx, u.name, 0, -ch / 2 + 112, { size: 32, color: '#1F1A3D', outline: 0 });
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i < lv ? '#FF9F1C' : 'rgba(31,26,61,.2)'; ctx.beginPath(); ctx.arc((i - 2) * 32, -ch / 2 + 140, 11, 0, 7); ctx.fill(); }
      if (max) D.text(ctx, 'MAX', 0, ch / 2 - 30, { size: 30, color: '#FF7A1A', outline: 0 });
      else { CD.icon(ctx, 'CoinIcon', -26, ch / 2 - 30, 0.55); D.text(ctx, String(cost), 14, ch / 2 - 29, { size: 30, color: can ? '#C25B00' : '#6E6A87', outline: 0 }); }
      D.text(ctx, u.key.toUpperCase(), -cw / 2 + 22, -ch / 2 + 24, { size: 22, color: '#6E6A87', outline: 0 });
      ctx.restore();
    });
    const by = top + 60 + rows * (ch + gap) + 52;
    D.text(ctx, 'したの ボタンで ネコと アイテムも かえるよ', x0 + W / 2, by - 24, { size: 26, color: 'rgba(255,255,255,.8)', outline: 7 });
    const pulse = 1 + 0.03 * Math.sin(S.t * 6);
    ctx.save(); ctx.translate(x0 + W / 2, by + 36); ctx.scale(pulse, pulse); ctx.translate(-(x0 + W / 2), -(by + 36));
    rbtn(ctx, ui, 'go', x0 + W / 2, by + 36, Math.min(560, W), 100, { color: '#FF7A1A', text: '#fff', size: 50, label: 'スタート！', sub: 'Enter' });
    ctx.restore();
    if (S.wave === 0 && S.buildT < 40) D.text(ctx, 'おなじ レベルの ネコを あわせると つよく なる！', (F.l + F.r) / 2 + 80, F.b - 270, { size: 34, color: '#fff', outline: 9 });
  }
  function drawDrag(ctx) {
    const d = S.drag; if (!d || !d.moved) return; const c = S.slots[d.from]; if (!c.lvl) return;
    CD.cat(ctx, c.lvl, CD.catIdle(S.t * 2), d.x, d.y + 50, { s: 1.25, foot: 19, a: 0.95 });
  }
  function drawGift(ctx, F) {
    const f = S.giftFx; if (!f) return; const k = f.t / 2.4, a = k < 0.1 ? k / 0.1 : k > 0.8 ? (1 - k) / 0.2 : 1;
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate((F.l + F.r) / 2 + 100, F.t + 520 - 40 * U.ease.outBack(Math.min(1, k * 3)));
    const sz = CD.iconSize(f.icon); CD.icon(ctx, f.icon, -150, 0, Math.min(110 / sz[0], 100 / sz[1]) * 1.1);
    D.text(ctx, 'プレゼント！', 40, -22, { size: 58, color: '#FFD23F', outline: 14 }); D.text(ctx, f.name + ' +1', 40, 36, { size: 42, color: '#fff', outline: 11 });
    ctx.restore();
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
      'ゾンビの うえの <b>ことば</b>を うつと、その レーンの <b>ネコ</b>が <b>たま</b>を うつよ。ネコが いない レーンでは なにも おこらない！ たまが あたって はじめて ゾンビが たおれるよ。',
      '<b>コイン</b>で <b>ネコ</b>を かおう。おなじ レベルの ネコを <b>ガッチャンコ</b>すると、ずっと つよく なって、つらぬく・ばくはつ たまが うてるよ（ドラッグ か クリック）。いらない ネコは ゴミばこへ。',
      '<b>アップグレード</b>で はやうち・パワー・コイン・かべ を つよくしよう。<b>トゲ・ボクシング・TNT・ガーディアン</b>は たたかいの さいちゅうに つかえるよ！（<b>6 7 8 9</b>の キー）',
      'たたかいの あいだも コインで ネコを かえるよ（<b>1〜5</b>の キー）。<b>Backspace</b>で ガッチャンコ、<b>0</b>で かべを なおす。',
      '3・5・7・9・10ばんめの ウェーブは <b>ボス</b>！ ボスは ネコ ぜんいんで うつ。ながい ぶんしょうを うって こうげき！',
    ],
    music: SONGS[0], reset, update, draw, onKey, onEnter, onBack(g) { onBack(g); },
    init(g) { G = g; CD.load(); },
    nextKey: () => { if (!S || S.phase !== 'fight') return null; const t = S.lock.locked || S.enemies.filter(targetable).sort((a, b) => (laneCats(a.lane).length ? 0 : 1) - (laneCats(b.lane).length ? 0 : 1) || a.x - b.x)[0]; return t ? t.typer.nextReq() : null; },
    hud: () => ({ right: S && !(S.auto && G.demo) ? `ウェーブ ${Math.min(S.wave + 1, NWAVE)}/${NWAVE}` : '', progress: S ? (S.wave + (S.phase === 'build' ? 0 : S.plan ? 1 - (S.queue.length + S.enemies.length) / Math.max(1, S.plan.toks.length) : 0)) / NWAVE : 0 }),
  });

  if (U.qs('dev') === '1') window.CDDev = {
    state: () => ({ phase: S.phase, wave: S.wave, coins: Math.round(S.coins), wall: Math.round(S.wall.hp), kills: S.kills, queue: S.queue.length, en: S.enemies.map((e) => ({ id: e.id, lane: e.lane, x: Math.round(e.x), text: e.typer.text, st: e.state, boss: !!e.boss, hp: Math.round(e.hp), max: Math.round(e.maxHp) })), slots: S.slots.map((c) => c.lvl), up: S.up, stock: S.stock, ad: S.ad.summary(), dmg: Math.round(S.stats.dmg), typedPct: Math.round(100 * (S.stats.dmgT || 0) / Math.max(1, (S.stats.dmgT || 0) + (S.stats.dmgA || 0))), bullets: S.bullets.length }),
    goto: (w) => { S.wave = w; S.enemies = []; S.queue = []; S.phase = 'build'; S.buildT = 0; S.area = AREA_OF(w); },
    coins: (n) => { S.coins = n; }, god: () => { S.wall.hp = S.wall.max = 9999; }, start: () => beginWave(G), buy: (l) => buy(G, l), merge: () => mergeAll(G), tnt: () => { S.stock.tnt = Math.max(1, S.stock.tnt); useAdd(G, 'tnt'); },
    use: (id) => useAdd(G, id), buyUp: (id) => buyUp(G, id), buyAdd: (id) => buyAdd(G, id), stock: (o) => Object.assign(S.stock, o),
    auto: (cps, err, think) => { S.auto = cps ? { cps, err: err || 0, think: think == null ? 0.4 : think, acc: 0, wait: 0 } : null; },
    slot: (i, l) => { S.slots[i].lvl = l; S.slots[i].val = 40 * l; }, key: (k) => onKey(G, k), F: () => S.F, chips: () => S.chipRects, S: () => S,
  };
})();
