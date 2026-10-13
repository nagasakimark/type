/* Typing Master - coach: remembers how each student does (per word, per run, per day), turns that into growth feedback
   ("faster", "fewer mistakes", "you learned a word you struggled with"), and gives struggling students comeback gifts.

   TM.stats   saved in localStorage ('tm.stats'): per-word records, the last runs, days practised.
   TM.coach   one per play session (reset in TM.game's start): a struggle meter and the gift rules. Games opt in with def.gift(g, info).

   Word record  { n: times finished, e: wrong keys on them, cl: clean finishes in a row, ms: typical ms per letter, lost: times it got away,
                  hard: 1 while the student is still shaky on it, fix: times a hard word was finally typed clean, t: last seen }
   A word is HARD after a finish with 2+ wrong keys, a helped finish (Japanese mode, hint level 2+) or after it got away; it stops being
   hard after 2 clean finishes in a row. The first clean finish of a hard word is the "I learned it!" moment (and earns a gift).
   Hard words come back more often (TM.Dealer picks them with extra weight), so practice goes where it is needed. */
(function () {
  'use strict';
  const TM = window.TM, U = TM.U;

  const dayKey = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  let saveT = 0;

  TM.stats = {
    data: null,
    load() {
      if (!this.data) {
        const d = TM.store.get('stats', null);
        this.data = d && d.v === 1 ? d : { v: 1, words: {}, runs: [], days: {} };
      }
      return this.data;
    },
    save(now) { clearTimeout(saveT); if (now) TM.store.set('stats', this.load()); else saveT = setTimeout(() => TM.store.set('stats', this.load()), 600); },
    key: (item) => (item.t || '').toLowerCase(),
    word(item) { return this.load().words[this.key(item)] || null; },
    isHard(item) { const w = this.word(item); return !!(w && w.hard); },
    isMastered(item) { const w = this.word(item); return !!(w && w.cl >= 3); },
    /* a word was typed to the end. returns { learned (first clean finish of a hard word), mastered (3rd clean in a row), first } */
    done(item, errors, ms, assisted) {
      const D = this.load(), k = this.key(item);
      let w = D.words[k]; const first = !w; if (!w) w = D.words[k] = { n: 0, e: 0, cl: 0, ms: 0, lost: 0, hard: 0, fix: 0, t: 0 };
      const was = w.hard;
      w.n++; w.e += errors; w.t = Date.now();
      const per = ms > 0 ? ms / Math.max(1, item.len || 3) : 0;
      if (per > 0 && per < 4000) w.ms = w.ms ? Math.round(w.ms * 0.6 + per * 0.4) : Math.round(per);
      const out = { learned: false, mastered: false, first, struggled: false };
      if (errors >= 2 || assisted) { w.hard = 1; w.cl = 0; out.struggled = true; }
      else if (errors === 0) {
        w.cl++;
        if (was && w.cl === 1) { out.learned = true; w.fix++; }
        if (w.cl >= 2) w.hard = 0;
        if (w.cl === 3) out.mastered = true;
      }
      const day = D.days[dayKey(Date.now())] = D.days[dayKey(Date.now())] || { words: 0, secs: 0, runs: 0 };
      day.words++;
      this.save();
      return out;
    },
    lost(item) {
      const D = this.load(), k = this.key(item);
      const w = D.words[k] = D.words[k] || { n: 0, e: 0, cl: 0, ms: 0, lost: 0, hard: 0, fix: 0, t: 0 };
      w.lost++; w.hard = 1; w.cl = 0; w.t = Date.now(); this.save();
    },
    /* runs: {t, g, d (deck key), m (mode), wpm, acc, words, score, secs} - newest last, last 80 kept */
    addRun(r) {
      const D = this.load(); D.runs.push(r); if (D.runs.length > 80) D.runs.splice(0, D.runs.length - 80);
      const day = D.days[dayKey(r.t)] = D.days[dayKey(r.t)] || { words: 0, secs: 0, runs: 0 }; day.secs += r.secs || 0; day.runs++;
      const keys = Object.keys(D.days).sort(); while (keys.length > 120) delete D.days[keys.shift()];
      this.save(true);
    },
    /* typed characters per second the student typically manages: median of the last runs (null when nothing is known) */
    cps(game) {
      const R = this.load().runs; const pick = (a) => a.filter((r) => r.wpm > 0).slice(-5).map((r) => r.wpm).sort((a, b) => a - b);
      let v = pick(R.filter((r) => r.g === game)); if (v.length < 2) v = pick(R);
      return v.length ? v[Math.floor(v.length / 2)] / 12 : null;
    },
    streak() {   // days in a row (today counts if practised, else counting back from yesterday)
      const D = this.load().days; let n = 0, t = Date.now();
      if (!D[dayKey(t)]) t -= 864e5;
      while (D[dayKey(t)]) { n++; t -= 864e5; }
      return n;
    },
    /* for the Arcade summary */
    summary(wordIds) {
      const D = this.load(); let seen = 0, mastered = 0, hard = 0;
      for (const id of wordIds || Object.keys(TM.data.words)) { const w = D.words[id]; if (!w) continue; seen++; if (w.cl >= 3) mastered++; if (w.hard) hard++; }
      const tot = Object.keys(D.words).length, totM = Object.values(D.words).filter((w) => w.cl >= 3).length;
      return { seen, mastered, hard, total: tot, totalMastered: totM, streak: this.streak(), runs: D.runs.length };
    },
  };

  /* ---------- the coach: one per play session ---------- */
  TM.coach = {
    struggle: 0, lastGift: -99, gifts: 0, learned: [], mastered: [], tried: new Set(), cleanWords: 0, doneWords: 0, errorsTotal: 0, hardSeen: new Set(),
    reset() { this.struggle = 0; this.lastGift = -99; this.gifts = 0; this.learned = []; this.mastered = []; this.tried = new Set(); this.cleanWords = 0; this.doneWords = 0; this.errorsTotal = 0; this.hardSeen = new Set(); },
    /* a game tells the coach something bad happened (life lost, wall hit...): w = how much it hurt */
    hurt(w) { this.struggle = Math.min(6, this.struggle + (w == null ? 1 : w)); },
    miss(item) { TM.stats.lost(item); this.hardSeen.add(TM.stats.key(item)); this.struggle = Math.min(6, this.struggle + 1); },
    /* typed a word to the end */
    done(g, typer, assisted) {
      const item = typer.item, errors = typer.errors, ms = typer.started ? performance.now() - typer.started : 0;
      const wasHard = TM.stats.isHard(item);
      const ev = TM.stats.done(item, errors, ms, assisted);
      this.doneWords++; this.errorsTotal += errors; this.tried.add(TM.stats.key(item));
      if (wasHard) this.hardSeen.add(TM.stats.key(item));
      if (errors === 0 && !assisted) this.cleanWords++;
      if (ev.learned) this.learned.push(item);
      if (ev.mastered) this.mastered.push(item);
      // struggle meter: slips and helped words raise it, clean words relax it
      if (errors >= 2 || assisted) this.struggle = Math.min(6, this.struggle + 0.5 * Math.min(3, errors) / 2 + (assisted ? 0.5 : 0));
      else this.struggle = Math.max(0, this.struggle - (errors === 0 ? 0.5 : 0.25));
      const now = TM.hint.clock;
      const cool = now - this.lastGift >= 16;
      let kind = null;
      if (ev.learned) kind = 'redeem';
      else if (this.struggle >= 3 && errors <= 1 && !assisted) kind = 'comeback';
      if (kind && cool && g.def.gift && !g.demo && g.state === 'play') {
        const label = g.def.gift(g, { kind, item, struggle: this.struggle });
        if (label) {
          this.lastGift = now; this.gifts++; this.struggle = Math.max(0, this.struggle - 2.5);
          this.celebrate(g, kind, item, label);
        }
      }
      return ev;
    },
    celebrate(g, kind, item, label) {
      const W = TM.W, big = kind === 'redeem';
      try {
        g.fx.pop(W / 2, 300, big ? `にがてな「${item.t.length > 18 ? item.t.slice(0, 16) + '…' : item.t}」を クリア！` : 'ナイス！ ここから ここから！', { color: '#FFC83D', size: big ? 54 : 50, life: 1.8 });
        g.fx.pop(W / 2, 372, '🎁 ' + label, { color: '#fff', size: 46, life: 1.8 });
        g.fx.confetti(W / 2, 330, big ? 70 : 40);
        TM.sfx.star(2);
      } catch (e) { /* effects are optional */ }
    },
    /* ---- growth feedback for the results screen. Compares with earlier runs of the same game (same word list first), always finds something good to say. ---- */
    finish(g, r) {
      const S = TM.stats, D = S.load();
      const prevAll = D.runs.filter((x) => x.g === r.g && x.m === r.m);
      let prev = prevAll.filter((x) => x.d === r.d).slice(-3);
      if (!prev.length) prev = prevAll.slice(-3);
      const first = !prevAll.length;
      S.addRun({ t: Date.now(), g: r.g, d: r.d, m: r.m, wpm: r.wpm, acc: Math.round(r.acc * 100), words: r.words, score: r.score, secs: Math.round(r.secs) });
      const items = [];
      const avg = (k) => prev.reduce((a, x) => a + x[k], 0) / Math.max(1, prev.length);
      if (prev.length) {
        const dw = r.wpm - Math.round(avg('wpm')), pAcc = Math.round(avg('acc')), da = Math.round(r.acc * 100) - pAcc;
        if (dw >= 1) items.push({ icon: '🚀', text: `はやく なったよ！ ${Math.round(avg('wpm'))} → ${r.wpm} WPM`, good: 1 });
        if (da >= 2) items.push({ icon: '🎯', text: `ミスが へったよ！ せいかく ${pAcc}% → ${Math.round(r.acc * 100)}%`, good: 1 });
        if (r.words >= Math.round(avg('words')) + 3) items.push({ icon: '📈', text: `${r.words - Math.round(avg('words'))} ことば おおく タイプできた！`, good: 1 });
        const best = Math.max(...D.runs.filter((x) => x.g === r.g && x.m === r.m).slice(0, -1).map((x) => x.wpm), 0);
        if (r.wpm > best && best > 0) items.push({ icon: '🏅', text: `じぶんの サイコー きろく！ (${r.wpm} WPM)`, good: 1 });
      }
      if (this.learned.length) {
        const w = this.learned.slice(0, 3).map((x) => `「${x.t}」`).join(' ');
        items.unshift({ icon: '🌱', text: `にがてだった ${w} を ノーミスで タイプ！`, good: 1, star: 1 });
      }
      if (this.mastered.length) items.push({ icon: '⭐', text: `マスター！ ${this.mastered.slice(0, 3).map((x) => `「${x.t}」`).join(' ')} (3かい れんぞく ノーミス)`, good: 1 });
      if (this.gifts && !items.length) items.push({ icon: '🎁', text: 'あきらめずに がんばって ごほうびを ゲット！', good: 1 });
      const st = S.summary();
      if (st.streak >= 2) items.push({ icon: '🔥', text: `${st.streak}にち れんぞくで れんしゅう！`, good: 1 });
      if (this.cleanWords >= 3 && items.length < 3) items.push({ icon: '✨', text: `ノーミスで ${this.cleanWords} ことば タイプできたよ`, good: 1 });
      if (first) items.push({ icon: '📝', text: 'はじめての きろく！ つぎは これを こえよう', good: 1 });
      if (!items.length) items.push({ icon: '💪', text: `${r.words} ことば れんしゅうしたよ。つづけると かならず はやく なる！`, good: 1 });
      // a small, reachable next goal
      const goal = Math.max(r.wpm + 2, Math.round(r.wpm * 1.1));
      const hardNow = [...this.hardSeen].length;
      const next = this.hardNeeds(g) ? `つぎは「にがてな ことば」を ノーミスで！` : `つぎの もくひょう: ${goal} WPM`;
      return { items: items.slice(0, 4), next, learned: this.learned.length, hardNow };
    },
    hardNeeds() { const W = TM.stats.load().words; let n = 0; for (const k in W) if (W[k].hard) n++; return n >= 3; },
  };
})();
