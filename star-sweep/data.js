/* Star Sweep - sectors, enemy types, bosses, power-ups and wave planning. */
(function () {
  'use strict';
  const SS = window.SS, TM = window.TM, U = TM.U;

  SS.SECTORS = [
    { name: 'いんせき ストリート', sub: 'いわと ロボドローン！', sky: 'nebula', col: 'Blue', planets: [7, 5], ast: 26, tint: '#4fa8ff', tint2: '#9a7bff', rim1: '#2a6fd0', rim2: '#12307a', horizon: 7, map: 7, accent: '#58b4ff' },
    { name: 'すいせい くも', sub: 'ジグザグ ひこうが くるよ！', sky: 'galaxy', col: 'Green', planets: [1, 4], ast: 12, tint: '#5cf0a8', tint2: '#3fb6ff', rim1: '#1d9a74', rim2: '#0d3d5a', horizon: 1, map: 1, accent: '#4be3a0' },
    { name: 'ばらいろ せいうん', sub: 'シールドを はれ！', sky: 'day', col: 'Red', planets: [2, 8], ast: 9, tint: '#ff7ab8', tint2: '#ffb86b', rim1: '#c64a8e', rim2: '#4a1f6b', horizon: 2, map: 2, accent: '#ff86c0' },
    { name: 'ブラックホール ゲート', sky: 'dark', sub: 'ぶきみな UFOと わかれる てき', col: 'Black', planets: [6, 9], ast: 16, tint: '#a58bff', tint2: '#ff5aa5', rim1: '#6a4fd0', rim2: '#1b1450', horizon: 9, map: 9, accent: '#b49cff' },
    { name: 'ピップわくせい', sub: 'もうすこし！ ピップを たすけよう！', sky: 'band', col: 'any', planets: [0, 4], ast: 8, tint: '#ffd86b', tint2: '#7fd3ff', rim1: '#e0a53a', rim2: '#5a2a1f', horizon: 4, map: 3, accent: '#ffd66b' },
  ];
  SS.PIP = 3; // planet sprite index of the planet we rescue

  /* enemy type table. spr gets (colourName) -> sprite key */
  SS.TYPES = {
    scout:    { spr: (c) => `enemy${c}1`, scale: 1.5, hr: 54, speed: 56, dmg: 9, accent: '#7B5CFF', glow: '#ff9a3c' },
    weaver:   { spr: (c) => `enemy${c}2`, scale: 1.5, hr: 56, speed: 50, dmg: 9, accent: '#7B5CFF', glow: '#ff9a3c' },
    zigzag:   { spr: (c) => `enemy${c}3`, scale: 1.5, hr: 54, speed: 52, dmg: 9, accent: '#7B5CFF', glow: '#ff9a3c' },
    ufo:      { spr: () => null, scale: 1.25, hr: 56, speed: 40, dmg: 9, accent: '#18A9B8', glow: '#7fffd4' },
    splitter: { spr: (c) => `enemy${c}4`, scale: 1.7, hr: 74, speed: 40, dmg: 12, accent: '#E0309A', glow: '#ff6ac8' },
    mini:     { spr: (c) => `enemy${c}1`, scale: 0.78, hr: 36, speed: 70, dmg: 4, accent: '#E0309A', glow: '#ff6ac8' },
    shielded: { spr: (c) => `enemy${c}5`, scale: 1.45, hr: 64, speed: 38, dmg: 12, accent: '#2F7BFF', glow: '#8fd0ff' },
    kamikaze: { spr: () => 'missile21', scale: 1.9, hr: 40, speed: 150, dmg: 12, accent: '#E5383B', glow: '#ff6a3c' },
    meteor:   { spr: () => 'meteorBrown_big1', scale: 1.0, hr: 52, speed: 62, dmg: 14, accent: '#B8651B', glow: '#ffb070' },
    ace:      { spr: () => 'ace9', scale: 0.7, hr: 90, speed: 16, dmg: 18, accent: '#E0309A', glow: '#ff6a6a' },
    powerup:  { spr: () => null, scale: 1.9, hr: 44, speed: 38, dmg: 0, accent: '#1FA866', glow: '#ffffff' },
  };
  SS.METEORS = ['meteorBrown_big1', 'meteorBrown_big2', 'meteorBrown_big3', 'meteorBrown_big4', 'meteorGrey_big1', 'meteorGrey_big2', 'meteorGrey_big3', 'meteorGrey_big4'];
  SS.METEORS_SMALL = ['meteorBrown_med1', 'meteorBrown_med3', 'meteorGrey_med1', 'meteorGrey_med2'];
  SS.MINIBOSS = ['ace9', 'ace4', 'ace3', 'ace2', 'ace8'];

  SS.BOSSES = [
    { name: 'ロケットいたずらっこ', spr: 'rocket2', scale: 0.52, rot: Math.PI, hr: 120, hoverY: 250, phases: 1, maxWords: 6, atk: ['bolts'], minions: null, glow: '#ff6a3c', engine: true },
    { name: 'UFOサム', spr: 'st29', scale: 1.7, rot: 0, hr: 150, hoverY: 250, phases: 1, maxWords: 7, atk: ['bolts', 'missiles'], minions: 'ufo', glow: '#7fffd4' },
    { name: 'たいようえいせい', spr: 'st17', scale: 0.62, rot: 0, hr: 130, hoverY: 280, phases: 2, maxWords: 7, atk: ['bolts', 'missiles', 'beam'], minions: 'kamikaze', glow: '#ffe066' },
    { name: 'ボイドウィング', spr: 'ace5', scale: 1.3, rot: 0, hr: 150, hoverY: 270, phases: 2, maxWords: 8, atk: ['bolts', 'beam', 'missiles'], minions: 'mini', glow: '#b49cff' },
    { name: 'メガクロス', spr: 'st26', scale: 0.64, rot: 0, hr: 170, hoverY: 310, phases: 3, maxWords: 8, atk: ['bolts', 'missiles', 'beam'], minions: 'scout', glow: '#ff8a5c' },
  ];

  SS.POWER = {
    shield: { label: 'シールド', base: 'pu_powerupBlue', color: '#38b6ff', info: 'シールド ぜんかい！' },
    bomb:   { label: 'ボム',   base: 'pu_powerupRed', color: '#ff5a5f', info: 'ドカーン！' },
    slow:   { label: 'スロー',   base: 'pu_powerupGreen', color: '#44e08a', info: 'じかんが ゆっくり！' },
    double: { label: 'x2',     base: 'pu_powerupYellow', color: '#ffd23f', info: 'とくてん 2ばい！' },
    repair: { label: 'かいふく', base: 'pu_powerupGreen', color: '#7dff9b', info: 'ふねが なおった！' },
    upgrade: { label: 'ぶき UP', base: 'pu_powerupRed', color: '#ff7ae8', info: 'ぶきが パワーアップ！' },
    wing:   { label: 'ウィングマン', base: 'pu_powerupBlue', color: '#8fe9ff', info: 'ウィングマンが きた！' },
  };

  /* ---- wave planner ---- */
  const WEIGHTS = (L, sector) => {
    const w = { scout: 5 };
    w.meteor = sector === 0 ? 2.5 : sector === 3 ? 1.5 : 0.8;
    if (L >= 1) w.weaver = 3;
    if (L >= 2) w.zigzag = 2.5;
    if (L >= 3) w.kamikaze = 1.6;
    if (L >= 4) w.ufo = 2.6;
    if (L >= 5) w.splitter = 2;
    if (L >= 6) w.shielded = 2.4;
    return w;
  };
  function pickW(w) { let sum = 0; for (const k in w) sum += w[k]; let r = Math.random() * sum; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return 'scout'; }

  /* returns {kind, tokens, interval, cap} */
  SS.planWave = function (sector, wave, perSector, diff) {
    const L = sector * 4 + Math.min(wave, 3);
    const boss = wave === perSector - 1, elite = wave === perSector - 2 && perSector >= 3;
    const dens = diff === 'gentle' ? 0.72 : diff === 'turbo' ? 1.25 : 1;
    const out = { kind: boss ? 'boss' : elite ? 'elite' : 'normal', L, tokens: [], interval: Math.max(0.8, 2.2 - L * 0.08) * (diff === 'gentle' ? 1.35 : diff === 'turbo' ? 0.8 : 1), cap: Math.max(4, Math.min(10, 4 + Math.floor(L / 3) - (diff === 'gentle' ? 1 : 0) + (diff === 'turbo' ? 1 : 0))) };
    if (boss) { out.tokens = ['boss']; out.interval = 99; return out; }
    const n = Math.round((7 + L * 0.9 + (elite ? 2 : 0)) * dens);
    const w = WEIGHTS(L, sector);
    for (let i = 0; i < n; i++) out.tokens.push(pickW(w));
    if (L >= 3 && Math.random() < 0.6 && diff !== 'gentle') out.tokens.splice(U.randi(2, Math.max(3, out.tokens.length - 2)), 0, 'swarm');
    if ((sector === 0 && wave >= 1) || (sector === 3 && wave === 1)) out.tokens.splice(U.randi(2, Math.max(3, out.tokens.length - 2)), 0, 'shower');
    out.tokens.splice(Math.max(2, Math.floor(out.tokens.length * 0.45)), 0, 'powerup');
    if (elite) out.tokens.splice(Math.floor(out.tokens.length * 0.55), 0, 'ace');
    return out;
  };
})();
