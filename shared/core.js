/* Typing Master - core: namespace, palette, utils, settings, words, typing, scoring.
   Classic script (no modules) so every page also works when opened straight from disk. */
(function () {
  'use strict';
  const TM = (window.TM = window.TM || {});

  /* ---------- palette ---------- */
  TM.C = {
    ink: '#1F1A3D', paper: '#FFF8EC', cloud: '#E9E4F7', white: '#FFFFFF',
    good: '#2BB673', miss: '#FF5A5F', gold: '#FFC83D',
    // game accents
    rascal: '#18C1C9', jumper: '#6CCB3C', turbo: '#FF7A1A',
    sweep: '#7B5CFF', ink2: '#FF3EA5', ninja: '#2F9BFF', lime: '#B8F03A',
  };

  /* ---------- utils ---------- */
  const U = (TM.U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a, b) => a + Math.random() * (b - a),
    randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    ease: {
      outBack: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
      outCubic: (t) => 1 - Math.pow(1 - t, 3),
      inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
      outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
    },
    hexA(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    },
    shade(hex, amt) { // amt -1..1, lighten (+) or darken (-)
      const n = parseInt(hex.slice(1), 16);
      let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
      r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
      return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
    },
    qs(name) { return new URLSearchParams(location.search).get(name); },
  });

  /* ---------- settings + records (localStorage, safe) ---------- */
  const mem = {};
  function rawGet(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] ?? null; } }
  function rawSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } }
  TM.store = {
    get(k, def) { const v = rawGet('tm.' + k); if (v == null) return def; try { return JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { rawSet('tm.' + k, JSON.stringify(v)); },
  };
  const DEFAULTS = { sfx: 0.8, music: 0.5, hints: 'auto', strict: false, reduceMotion: false, keyboard: false, shortOnly: false, difficulty: 'normal', mode: 'en' };
  TM.settings = Object.assign({}, DEFAULTS, TM.store.get('settings', {}));
  if (U.qs('quiet') === '1') { TM.settings.music = 0; TM.settings.sfx = 0; }
  if (['gentle', 'normal', 'turbo'].includes(U.qs('diff'))) TM.settings.difficulty = U.qs('diff');   // teacher links can pick the mode (not saved)
  if (['en', 'ja2en'].includes(U.qs('mode'))) TM.settings.mode = U.qs('mode');           // teacher links can pick the play mode (not saved)
  /* Play mode: 'en' = type the English you see (default). 'ja2en' = you see the Japanese and type the English from memory;
     the English shows only as blanks, with hints that grow when you are stuck (see TM.hint). */
  TM.mode = () => (TM.settings.mode === 'ja2en' ? 'ja2en' : 'en');
  TM.saveSettings = () => TM.store.set('settings', TM.settings);
  try { if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) TM.settings.reduceMotion = true; } catch (e) { /* ignore */ }

  /* ---------- progress: which word lists (decks) a student has cleared in which game ----------
     stored as { deckId: { gameId: { n: times cleared, stars: best stars, t: last time } } }. A deck counts as DONE once it is cleared in
     at least one game; the per-game ticks show where. */
  TM.GAMES = [
    { id: 'word-jumper', name: 'Word Jumper', short: 'ジャンプ', c: '#6CCB3C' }, { id: 'word-ninja', name: 'Word Ninja', short: 'ニンジャ', c: '#2F9BFF' },
    { id: 'star-sweep', name: 'Star Sweep', short: 'うちゅう', c: '#7B5CFF' }, { id: 'turbo-type', name: 'Turbo Type', short: 'レース', c: '#FF7A1A' },
    { id: 'ink-rush', name: 'Ink Rush', short: 'インク', c: '#FF3EA5' }, { id: 'cat-defense', name: 'Cat Defenders', short: 'ネコ', c: '#FF9F1C' },
  ];
  TM.progress = {
    GAMES: ['word-jumper', 'word-ninja', 'star-sweep', 'turbo-type', 'ink-rush', 'cat-defense'],
    all() { return TM.store.get('progress', {}); },
    record(gameId, deckIds, stars) {
      const all = this.all(); let fresh = [];
      for (const id of deckIds) {
        const d = (all[id] = all[id] || {}), r = d[gameId];
        if (!r) fresh.push(id);
        d[gameId] = { n: (r ? r.n : 0) + 1, stars: Math.max(r ? r.stars : 0, stars || 0), t: Date.now() };
      }
      TM.store.set('progress', all); return fresh;
    },
    games(deckId) { const d = this.all()[deckId] || {}; return this.GAMES.filter((g) => d[g]); },
    done(deckId) { return this.games(deckId).length > 0; },
    book(book) { // { done, total, pct }
      const total = book.decks.length; let done = 0; const all = this.all();
      for (const id of book.decks) if (all[id] && Object.keys(all[id]).length) done++;
      return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
    },
  };

  TM.records = {
    key: (game, deckKey, diff) => `rec.${game}.${deckKey}.${diff}`,
    get(game, deckKey, diff) { return TM.store.get(this.key(game, deckKey, diff), null); },
    submit(game, deckKey, diff, r) {
      const old = this.get(game, deckKey, diff);
      const best = {
        score: Math.max(r.score, old ? old.score : 0),
        stars: Math.max(r.stars, old ? old.stars : 0),
        wpm: Math.max(r.wpm, old ? old.wpm : 0),
        plays: (old ? old.plays : 0) + 1,
      };
      TM.store.set(this.key(game, deckKey, diff), best);
      return { best, isNewBest: !old || r.score > old.score };
    },
    starsFor(game, deckKey) {
      let s = 0;
      for (const d of ['gentle', 'normal', 'turbo']) { const r = this.get(game, deckKey, d); if (r) s = Math.max(s, r.stars); }
      return s;
    },
  };

  /* ---------- words ---------- */
  const DATA = window.TM_WORDS || { books: [], decks: {}, words: {} };
  TM.data = DATA;

  // Keys the player presses for a text. Letters, digits, spaces are required.
  // Apostrophes and hyphens are optional unless "strict"; other punctuation is always optional.
  TM.typedChars = function (text) {
    const out = [];
    const strict = TM.settings.strict;
    for (const ch of text) {
      const low = ch.toLowerCase();
      if (/[a-z0-9]/.test(low)) out.push({ c: ch, k: low, opt: false });
      else if (ch === ' ') {
        if (out.length && out[out.length - 1].k !== ' ') out.push({ c: ' ', k: ' ', opt: false });
      } else if (ch === "'" || ch === '’' || ch === '-') out.push({ c: ch, k: ch === '’' ? "'" : ch, opt: !strict });
      else out.push({ c: ch, k: ch, opt: true });
    }
    // a space right after optional punctuation at a word end is still required, which is fine
    return out;
  };
  TM.typedLen = (text) => TM.typedChars(text).filter((c) => !c.opt).length;

  /* School level of a textbook: book.level is 'es' (elementary) or 'jhs' (junior high), book.years the school years it is for.
     TM.level(book) -> { school: '小学校', short: '小学', text: '小学5・6年', color } */
  TM.level = function (b) {
    const jhs = b && b.level === 'jhs';
    const yrs = (b && b.years && b.years.length) ? b.years.join('・') : '';
    return jhs ? { key: 'jhs', school: '中学校', short: '中学', text: `中学${yrs}年`, color: '#7B5CFF' }
      : { key: 'es', school: '小学校', short: '小学', text: yrs ? `小学${yrs}年` : '小学校', color: '#FF8A1F' };
  };

  TM.deck = {
    all: DATA.decks,
    books: DATA.books,
    ids() {
      const q = U.qs('deck');
      let ids = q ? q.split(',') : TM.store.get('decks', null);
      if (!ids || !ids.length) ids = [];
      ids = ids.filter((id) => DATA.decks[id]);
      if (!ids.length) {
        const nh5 = DATA.books.find((b) => b.id === 'nh5') || DATA.books[0];
        if (nh5 && nh5.decks.length) ids = [nh5.decks.find((d) => /-u1$/.test(d)) || nh5.decks[0]];
      }
      return ids;
    },
    set(ids) {
      TM.store.set('decks', ids);
      const u = new URL(location.href);
      u.searchParams.set('deck', ids.join(','));
      history.replaceState(null, '', u.toString());
    },
    key(ids) { return (ids || this.ids()).slice().sort().join('+') + (TM.mode() === 'ja2en' ? '~jp' : ''); },   // records are kept per mode
    label(ids) {
      ids = ids || this.ids();
      if (!ids.length) return 'No words';
      const d = DATA.decks[ids[0]];
      const book = DATA.books.find((b) => b.id === d.book);
      const one = `${book ? book.short : ''} ${d.label}${d.title && d.label !== d.title ? ' · ' + d.title : ''}`.trim();
      return ids.length === 1 ? one : `${one} + ${ids.length - 1} more`;
    },
    showHints(ids) {
      const h = TM.settings.hints;
      if (h === 'on') return true;
      if (h === 'off') return false;
      ids = ids || this.ids();
      return ids.some((id) => /^lt/.test(id)); // auto: on for Let's Try
    },
  };

  function makeItem(t, ja, kana, kind) {
    const chars = TM.typedChars(t);
    const req = chars.filter((c) => !c.opt);
    // q = the question shown in Japanese -> English mode: the kana, plus the kanji when the kana is very short (ひ = 火? 日?)
    const q = kana ? ((kana.length <= 2 && ja && ja !== kana) ? `${kana}（${ja}）` : kana) : (ja || '');
    return { t, ja: ja || '', kana: kana || '', hint: kana || ja || '', q, kind, len: req.length, first: req.length ? req[0].k : '', words: t.trim().split(/\s+/).length };
  }

  // Build pools for the chosen decks
  TM.pool = function (ids) {
    ids = ids || TM.deck.ids();
    const wset = new Map(), sset = new Map();
    for (const id of ids) {
      const d = DATA.decks[id];
      if (!d) continue;
      for (const w of d.words) {
        const r = DATA.words[w];
        if (r && !wset.has(w)) wset.set(w, makeItem(r.t, r.ja, r.kana, 'word'));
      }
      for (const s of d.sentences || []) if (!sset.has(s.t)) sset.set(s.t, makeItem(s.t, s.ja, '', 'sentence'));
    }
    let words = [...wset.values()], sentences = [...sset.values()];
    if (TM.mode() === 'ja2en') {     // every item needs Japanese to show; one English word per Japanese meaning, so the answer is unambiguous
      const seen = new Set(), keep = words.filter((w) => { const q = w.q || w.hint; if (!q || seen.has(q)) return false; seen.add(q); return true; });
      if (keep.length >= 4) words = keep;
      const ks = sentences.filter((x) => x.hint); if (ks.length || !sentences.length) sentences = ks;
    }
    if (TM.settings.shortOnly) { const short = words.filter((w) => w.len <= 4); if (short.length >= 4) words = short; }
    return { words, sentences };
  };

  /* Dealer: hands out items without repeats until the pool runs dry.
     opts for next(): { kind:'word'|'sentence'|'any', minLen, maxLen, maxWords, avoidFirst:Set, avoid:Set(text) } */
  class Dealer {
    constructor(pool) { this.pool = pool || TM.pool(); this.used = new Set(); this.recent = []; }
    next(o = {}) {
      const kind = o.kind || 'word';
      let src = kind === 'sentence' ? this.pool.sentences : kind === 'any' ? this.pool.words.concat(this.pool.sentences) : this.pool.words;
      if (kind === 'sentence' && !src.length) {   // no key sentences (e.g. junior-high lists): use multi-word phrases, else the longest words
        const byLen = this.pool.words.slice().sort((a, b) => b.len - a.len);
        const phrases = byLen.filter((w) => w.words >= 2).slice(0, 24);
        src = phrases.length >= 6 ? phrases : byLen.slice(0, 12);
      }
      if (!src.length) return makeItem('type', '', '', 'word');
      const ok = (it, strictLen) => {
        if (o.avoidFirst && o.avoidFirst.has(it.first)) return false;
        if (o.avoid && o.avoid.has(it.t)) return false;
        if (strictLen) {
          if (o.minLen && it.len < o.minLen) return false;
          if (o.maxLen && it.len > o.maxLen) return false;
          if (o.maxWords && it.words > o.maxWords) return false;
        }
        return true;
      };
      const tries = [
        (it) => ok(it, true) && !this.used.has(it.t),
        (it) => ok(it, true) && !this.recent.includes(it.t),
        (it) => ok(it, true),
        (it) => ok(it, false) && (!o.maxLen || it.len <= o.maxLen + 4),
        (it) => !o.avoidFirst || !o.avoidFirst.has(it.first),
        () => true,
      ];
      for (let i = 0; i < tries.length; i++) {
        const c = src.filter(tries[i]);
        if (c.length) {
          if (i === 1) for (const it of src) this.used.delete(it.t); // pool exhausted: start a new round
          const it = U.pick(c);
          this.used.add(it.t);
          this.recent.push(it.t); if (this.recent.length > 6) this.recent.shift();
          return Object.assign({}, it);
        }
      }
      return Object.assign({}, src[0]);
    }
  }
  TM.Dealer = Dealer;

  /* Difficulty ladder shared by all games: stage 0..1 within a run (or level-based).
     easy → short words, middle → all words and phrases, hard → key sentences. */
  TM.ladder = function (stage, diff) {
    diff = diff || 'normal';
    const s = U.clamp(stage + (diff === 'turbo' ? 0.25 : diff === 'gentle' ? -0.2 : 0), 0, 1);
    if (s < 0.34) return { kind: 'word', maxLen: 6, tier: 1 };
    if (s < 0.67 || diff === 'gentle') return { kind: 'word', maxLen: 14, tier: 2 };
    return { kind: 'sentence', maxLen: 99, tier: 3 };
  };

  /* ---------- hints for the Japanese -> English mode ----------
     A word's hint level (0..3) is the highest of: how long the player has gone without a correct key (all words on screen get it),
     the Tab key / hint button (each press = one level, reset when a word is finished), and wrong keys on that very word.
       0  blanks only (one per letter, so the length is known)      2  first letters + about every other letter
       1  the next letter + the first letter of every word          3  the whole answer, shown faded (the word is then "helped")
     Time is the game's own clock (TM.hint.tick), so pausing does not count. */
  TM.hint = {
    clock: 0, lastOk: 0, manual: 0, STEPS: [5, 9, 14], focus: null,
    on() { const g = TM.current; return TM.mode() === 'ja2en' && !!g && !g.demo && g.state === 'play'; },
    reset() { this.clock = 0; this.lastOk = 0; this.manual = 0; this.focus = null; },
    tick(dt) { this.clock += dt; },
    level(typer) {
      const it = typer && typer.item;
      if (TM.mode() !== 'ja2en' || !it || !it.hint) return 0;
      const g = TM.current;
      if (g && g.demo) return 3;                                       // the title-screen demo shows the answers
      if (!g || g.state === 'over') return 3;
      if (typer._seenAt == null) typer._seenAt = this.clock;           // a word's idle timer starts when it first appears
      const idle = this.clock - Math.max(this.lastOk, typer._seenAt), S = this.STEPS;
      const byTime = idle >= S[2] ? 3 : idle >= S[1] ? 2 : idle >= S[0] ? 1 : 0;
      const e = typer.errors, byErr = e >= 6 ? 3 : e >= 4 ? 2 : e >= 2 ? 1 : 0;
      return Math.max(byTime, byErr, this.manual);
    },
    typed(typer) { if (!this.on()) return; const lv = this.level(typer); if (lv > typer.assist) typer.assist = lv; this.lastOk = this.clock; this.focus = typer; },
    finished() { this.manual = 0; },
    boost() {                                                          // Tab / hint button
      if (!this.on()) return;
      const cur = this.level({ item: { hint: 'x' }, errors: this.focus ? this.focus.errors : 0 });
      this.manual = Math.min(3, Math.max(this.manual, cur) + 1);
      this.lastOk = this.clock;                                        // a press also restarts the idle timer so the next step is not instant
      const t = this.focus; if (t && !t.done && this.manual >= 2) this.speak(t.item.t);
      if (TM.sfx && TM.sfx.click) TM.sfx.click();
    },
    speak(text) {
      try {
        if (!window.speechSynthesis) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/\s*[.?!]+$/, '')); u.lang = 'en-US'; u.rate = 0.85; u.volume = Math.min(1, (TM.settings.sfx || 0.8) + 0.2);
        speechSynthesis.speak(u);
      } catch (e) { /* no speech available */ }
    },
    /* which character indices show their letter at this level (typed ones are always shown) */
    revealed(typer, lv) {
      const out = new Set(); if (lv <= 0) return out;
      const ch = typer.chars; let nextIdx = -1, n = 0;
      for (let i = typer.pos; i < ch.length; i++) if (!ch[i].opt) { nextIdx = i; break; }
      for (let i = typer.pos; i < ch.length; i++) {
        const c = ch[i]; if (c.opt) continue;
        const wordStart = i === 0 || ch[i - 1].k === ' ';
        if (lv >= 3) out.add(i);
        else if (i === nextIdx || wordStart) out.add(i);
        else if (lv >= 2 && (n++ % 2 === 1)) out.add(i);
      }
      return out;
    },
  };

  /* ---------- typing ---------- */
  class Typer {
    constructor(item) {
      this.item = item;
      this.text = item.t;
      this.chars = TM.typedChars(item.t);
      this.pos = 0;           // index into chars of the next char to type
      this.errors = 0;
      this.started = 0;
      this.done = this.chars.every((c) => c.opt);
      this.shake = 0;
      this.assist = 0;        // highest hint level showing while a correct key was typed (ja2en mode); >= 2 means the word was helped
    }
    nextReq() { for (let i = this.pos; i < this.chars.length; i++) if (!this.chars[i].opt) return this.chars[i].k; return null; }
    wouldAccept(k) {
      for (let i = this.pos; i < this.chars.length; i++) {
        if (this.chars[i].k === k) return true;
        if (!this.chars[i].opt) return false;
      }
      return false;
    }
    feed(k) {
      if (this.done) return 'done';
      if (!this.started) this.started = performance.now();
      for (let i = this.pos; i < this.chars.length; i++) {
        if (this.chars[i].k === k) {
          this.pos = i + 1;
          TM.hint.typed(this);
          let rest = true;
          for (let j = this.pos; j < this.chars.length; j++) if (!this.chars[j].opt) { rest = false; break; }
          if (rest) { this.pos = this.chars.length; this.done = true; TM.hint.finished(); return 'done'; }
          return 'ok';
        }
        if (!this.chars[i].opt) break;
      }
      this.errors++;
      this.shake = 1;
      return 'miss';
    }
    get progress() { const req = this.chars.filter((c) => !c.opt).length || 1; return this.chars.slice(0, this.pos).filter((c) => !c.opt).length / req; }
    get typedReq() { return this.chars.slice(0, this.pos).filter((c) => !c.opt).length; }
  }
  TM.Typer = Typer;

  /* Lock-on targeting for games with several words on screen.
     targets: objects with .typer, .alive and optional .danger (bigger = more urgent). */
  class LockOn {
    constructor() { this.locked = null; }
    release() { if (this.locked) this.locked.locked = false; this.locked = null; }
    feed(k, targets) {
      if (this.locked && (!this.locked.alive || this.locked.typer.done)) this.release();
      if (this.locked) {
        const r = this.locked.typer.feed(k);
        const t = this.locked;
        if (r === 'done') this.release();
        return { target: t, result: r };
      }
      const cands = targets.filter((t) => t.alive && !t.typer.done && t.typer.pos === 0 && t.typer.wouldAccept(k));
      if (!cands.length) return { target: null, result: 'miss' };
      cands.sort((a, b) => (b.danger || 0) - (a.danger || 0));
      const t = cands[0];
      const r = t.typer.feed(k);
      if (r !== 'done') { this.locked = t; t.locked = true; }
      return { target: t, result: r };
    }
    firstLetters(targets) { const s = new Set(); for (const t of targets) if (t.alive && !t.typer.done) s.add(t.typer.nextReq() || t.typer.item.first); return s; }
  }
  TM.LockOn = LockOn;

  /* ---------- score + stats ---------- */
  class Score {
    constructor() { this.score = 0; this.combo = 0; this.bestCombo = 0; this.correct = 0; this.keys = 0; this.misses = 0; this.wordsDone = 0; this.t0 = 0; this.tPlay = 0; this.tricky = new Map(); }
    get mult() { return this.combo >= 50 ? 4 : this.combo >= 25 ? 3 : this.combo >= 10 ? 2 : 1; }
    key(ok) { this.keys++; if (ok) this.correct++; else { this.misses++; this.breakCombo(); } }
    breakCombo() { this.combo = 0; }
    word(item, errors, bonus = 1) {
      this.wordsDone++;
      if (errors === 0) { this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo); }
      if (errors > 0) {
        const r = this.tricky.get(item.t) || { item, errors: 0 };
        r.errors += errors; this.tricky.set(item.t, r);
      }
      const pts = Math.round(10 * item.len * this.mult * bonus);
      this.score += pts;
      return pts;
    }
    add(pts) { this.score += Math.round(pts); return pts; }
    missedWord(item) { const r = this.tricky.get(item.t) || { item, errors: 0 }; r.errors += 2; this.tricky.set(item.t, r); this.breakCombo(); }
    get accuracy() { return this.keys ? this.correct / this.keys : 1; }
    wpm(seconds) { const m = Math.max(seconds, 1) / 60; return Math.round(this.correct / 5 / m); }
    trickyList() { return [...this.tricky.values()].sort((a, b) => b.errors - a.errors).slice(0, 6).map((r) => r.item); }
  }
  TM.Score = Score;
})();
