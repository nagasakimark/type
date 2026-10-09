/* Typing Master - game framework: stage, loop, title / countdown / play / pause / results, HUD, input.
   A game calls TM.game({...}) with its own hooks. See any game's game.js for an example. */
(function () {
  'use strict';
  const TM = window.TM, U = TM.U, C = TM.C, D = TM.draw, el = TM.ui.el;
  const W = 1920, H = 1080;
  TM.W = W; TM.H = H;

  TM.game = function (def) {
    const root = def.root || '../';
    document.title = `${def.name} – Typing Master`;
    document.documentElement.style.setProperty('--accent', def.accent);
    document.documentElement.style.setProperty('--accent-dark', U.shade(def.accent, -0.3));
    document.body.style.background = def.bg || C.ink;
    if (def.dark) document.body.classList.add('dark');

    const canvas = el('canvas', { id: 'stage' });
    document.body.append(canvas);
    const ctx = canvas.getContext('2d');
    let scale = 1, offX = 0, offY = 0, dpr = 1;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vw = window.innerWidth, vh = window.innerHeight;
      canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
      scale = Math.min(vw / W, vh / H);
      offX = (vw - W * scale) / 2; offY = (vh - H * scale) / 2;
    }
    window.addEventListener('resize', resize); resize();

    const g = {
      def, W, H, ctx, root,
      state: 'title', live: false, demo: true, diff: TM.settings.difficulty || 'normal',
      t: 0, playT: 0, fx: new TM.FX(), score: new TM.Score(), dealer: null, hint: false, accent: def.accent,
      vw: () => ({ x: -offX / scale, y: -offY / scale, w: window.innerWidth / scale, h: window.innerHeight / scale }),
    };
    TM.current = g;

    /* ---------- helpers games use ---------- */
    g.newDealer = () => { g.dealer = new TM.Dealer(TM.pool()); g.hint = TM.deck.showHints(); return g.dealer; };
    g.keyResult = (r) => {
      if (g.demo) return;
      if (r === 'miss') { g.score.key(false); TM.sfx.miss(); hud.comboBreak(); }
      else { g.score.key(true); TM.sfx.key(); }
    };
    g.wordDone = (typer, x, y, o = {}) => {
      if (g.demo) { if (x != null) g.fx.stars(x, y, 5); return 0; }
      const before = g.score.mult;
      const pts = g.score.word(typer.item, typer.errors, o.bonus || 1);
      if (x != null) g.fx.pop(x, y - 40, '+' + pts, { color: o.color || C.gold, size: typer.item.kind === 'sentence' ? 64 : 52 });
      (typer.item.kind === 'sentence' ? TM.sfx.big : TM.sfx.word)();
      if (g.score.mult > before) {
        TM.sfx.combo(g.score.mult);
        g.fx.pop(W / 2, 150, `COMBO x${g.score.mult}!`, { size: 44, color: def.accent, life: 0.8 });
        g.fx.shake(10, 0.15);
      }
      hud.bump();
      return pts;
    };
    g.missWord = (item) => { if (!g.demo) g.score.missedWord(item); };
    g.end = (result = {}) => {
      if (g.state !== 'play') return;
      g.live = false; g.state = 'over';
      TM.audio.stopMusic();
      (result.win === false ? TM.sfx.lose : TM.sfx.win)();
      setTimeout(() => showResults(result), result.delay ?? 1300);
    };
    g.ladder = (stage) => TM.ladder(stage, g.diff);
    g.speedMul = () => (g.diff === 'gentle' ? 0.6 : g.diff === 'turbo' ? 1.35 : 1);

    /* ---------- loop ---------- */
    let last = performance.now(), acc = 0, countdown = 0;
    const STEP = 1 / 60;
    /* dev/test only: ?speed=N runs the sim N times faster, ?bot=cps,err,think types for you (real game logic, no shortcuts) */
    const DEVSPEED = Math.max(1, Math.min(8, +U.qs('speed') || 1));
    const BOTQ = (U.qs('bot') || '').split(',').map(Number);
    const bot = BOTQ[0] > 0 ? { cps: BOTQ[0], err: BOTQ[1] || 0, think: BOTQ[2] != null && !isNaN(BOTQ[2]) ? BOTQ[2] : 0.5, acc: 0, wait: 0, keys: 0 } : null;
    g.devBot = bot;
    function runBot(dt) {
      if (!bot || g.state !== 'play' || !def.nextKey) return;
      if (bot.wait > 0) { bot.wait -= dt; return; }
      bot.acc += dt * bot.cps;
      while (bot.acc >= 1) {
        bot.acc -= 1;
        const w0 = g.score.wordsDone; let k = def.nextKey(g);
        if (!k) { bot.acc = 0; break; }
        if (Math.random() < bot.err) k = 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
        bot.keys++; def.onKey(g, k.toLowerCase());
        if (g.score.wordsDone !== w0) { bot.wait = bot.think * (0.7 + Math.random() * 0.6); bot.acc = 0; break; }
      }
    }
    function frame(now) {
      requestAnimationFrame(frame);
      let dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (g.state !== 'paused') {
        acc += dt * DEVSPEED;
        let n = 0;
        while (acc >= STEP && n < 6 * DEVSPEED) { tick(STEP); acc -= STEP; n++; }
        if (n === 6 * DEVSPEED) acc = 0;
      }
      render();
    }
    function tick(dt) {
      g.t += dt;
      if (g.state === 'countdown') {
        const before = Math.ceil(countdown);
        countdown -= dt;
        if (Math.ceil(countdown) !== before && countdown > 0) TM.sfx.beep(false);
        if (countdown <= 0) { g.state = 'play'; g.live = true; TM.sfx.beep(true); if (def.music) TM.audio.startMusic(def.music); }
      }
      if (g.state === 'play') g.playT += dt;
      def.update(g, dt);
      runBot(dt);
      g.fx.update(dt);
      hud.update();
      kbd.update();
    }
    function render() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = def.bg || C.ink; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offX * dpr, offY * dpr);
      ctx.save();
      if (def.fullBleed !== false) { /* games may draw outside 0..W using g.vw() */ }
      else { ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); }
      g.fx.applyShake(ctx);
      def.draw(g, ctx);
      ctx.restore();
      if (g.state === 'countdown') {
        const n = Math.ceil(countdown), k = 1 - (countdown - Math.floor(countdown));
        ctx.save(); ctx.translate(W / 2, H / 2); const s = 1 + (1 - U.ease.outBack(Math.min(1, k * 2))) * 0.8; ctx.scale(s, s);
        ctx.globalAlpha = Math.min(1, (1 - k) * 3);
        D.text(ctx, n > 0 ? String(n) : 'ゴー！', 0, 0, { size: 260, color: def.accent, outline: 26 });
        ctx.restore();
      }
      g.fx.drawFlash(ctx, W, H);
    }

    /* ---------- HUD ---------- */
    const hud = (() => {
      const scoreV = el('span', {}, '0');
      const combo = el('div', { class: 'tm-combo' });
      const barI = el('i', { style: { width: '0%' } });
      const bar = el('div', { class: 'tm-bar hidden' }, barI);
      const lives = el('div', { class: 'tm-lives' });
      const rightTxt = el('div', { class: 'pill hidden' });
      const box = el('div', { class: 'tm-hud hidden' },
        el('div', { class: 'pill' }, el('span', { class: 'lbl' }, 'とくてん'), scoreV),
        el('div', { class: 'mid' }, combo, bar),
        el('div', { class: 'mid', style: { alignItems: 'flex-end' } }, lives, rightTxt));
      document.body.append(box);
      let lastKey = '';
      return {
        show(v) { box.classList.toggle('hidden', !v); },
        bump() { combo.classList.add('bump'); setTimeout(() => combo.classList.remove('bump'), 110); },
        comboBreak() { },
        update() {
          if (g.state !== 'play' && g.state !== 'countdown' && g.state !== 'over') return;
          const h = def.hud ? def.hud(g) : {};
          const key = [g.score.score, g.score.combo, h.lives, h.maxLives, h.right, Math.round((h.progress ?? -1) * 100)].join('|');
          if (key === lastKey) return; lastKey = key;
          scoreV.textContent = g.score.score.toLocaleString();
          combo.textContent = g.score.combo >= 3 ? `x${g.score.mult}  コンボ ${g.score.combo}` : '';
          if (h.progress != null) { bar.classList.remove('hidden'); barI.style.width = Math.round(U.clamp(h.progress, 0, 1) * 100) + '%'; } else bar.classList.add('hidden');
          if (h.maxLives) {
            if (lives.children.length !== h.maxLives) { lives.innerHTML = ''; for (let i = 0; i < h.maxLives; i++) lives.append(el('b', { style: { backgroundImage: TM.ui.svgURL(def.lifeIcon || TM.ui.heartSVG()) } })); }
            [...lives.children].forEach((b, i) => b.classList.toggle('off', i >= h.lives));
          } else lives.innerHTML = '';
          if (h.right) { rightTxt.classList.remove('hidden'); rightTxt.textContent = h.right; } else rightTxt.classList.add('hidden');
        },
      };
    })();

    /* ---------- keyboard helper strip ---------- */
    const kbd = (() => {
      const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
      const keys = {};
      const box = el('div', { class: 'tm-kbd hidden' });
      for (const r of rows) { const row = el('div'); for (const ch of r) { const k = el('span', { class: 'fj'.includes(ch) ? 'home' : '' }, ch); keys[ch] = k; row.append(k); } box.append(row); }
      const sp = el('span', { class: 'space' }, 'スペース'); keys[' '] = sp; box.append(el('div', {}, sp));
      document.body.append(box);
      let lastNext = null;
      return {
        update() {
          const on = TM.settings.keyboard && g.state === 'play';
          box.classList.toggle('hidden', !on);
          if (!on) return;
          const n = def.nextKey ? def.nextKey(g) : null;
          if (n === lastNext) return;
          if (lastNext && keys[lastNext]) keys[lastNext].classList.remove('next');
          if (n && keys[n]) keys[n].classList.add('next');
          lastNext = n;
        },
      };
    })();

    /* ---------- title screen ---------- */
    const title = (() => {
      const deckLabel = el('span');
      const deckImg = el('img', { alt: '', onerror: function () { this.style.display = 'none'; } });
      const segBtns = {};
      const seg = el('div', { class: 'tm-seg' });
      for (const [v, label] of [['gentle', 'ゆっくり'], ['normal', 'ふつう'], ['turbo', 'ターボ']]) {
        const b = el('button', { onclick: () => setDiff(v) }, label); segBtns[v] = b; seg.append(b);
      }
      function setDiff(v) { g.diff = v; TM.settings.difficulty = v; TM.saveSettings(); for (const k in segBtns) segBtns[k].classList.toggle('on', k === v); TM.sfx.click(); }
      const inner = el('div', { class: 'tm-tin' },
        el('h1', { class: 'tm-logo', html: def.logoHTML || def.name }),
        def.tagline ? el('div', { class: 'tm-tagline' }, def.tagline) : null,
        el('div', { class: 'tm-row' }, el('button', { class: 'tm-btn tm-deckbtn', onclick: () => openPicker() }, deckImg, deckLabel, el('span', { style: { opacity: 0.6 } }, '▾')), seg),
        el('div', { class: 'tm-row' },
          el('button', { class: 'tm-btn primary', onclick: () => start() }, 'あそぶ', el('kbd', {}, 'Enter')),
          el('button', { class: 'tm-btn', onclick: () => howto() }, 'あそびかた')),
        el('div', { class: 'tm-press' }, 'タイプの まえに「はんかく えいすう」に してね'));
      const box = el('div', { class: 'tm-title' }, inner);
      const refit = TM.ui.fit(inner, { max: 1.6, fill: 0.9 });
      new MutationObserver(() => refit()).observe(inner, { childList: true, subtree: true, characterData: true });
      g.refitTitle = refit;
      const corners = [
        el('div', { class: 'tm-corner left' }, el('a', { class: 'tm-btn small', href: root + 'index.html' + (location.search || '') }, '◀ ゲームいちらん')),
        el('div', { class: 'tm-corner right' }, el('button', { class: 'tm-btn icon', title: 'せってい', onclick: () => TM.ui.settings() }, '⚙')),
      ];
      document.body.append(box, ...corners);
      function refreshDeck() {
        const ids = TM.deck.ids();
        deckLabel.textContent = TM.deck.label(ids);
        const d = TM.data.decks[ids[0]];
        if (d && d.image) { deckImg.style.display = ''; deckImg.src = root + d.image; } else deckImg.style.display = 'none';
      }
      setDiff(g.diff); refreshDeck();
      return {
        show(v) { box.classList.toggle('hidden', !v); corners.forEach((c) => c.classList.toggle('hidden', !v)); if (v) { refreshDeck(); if (g.refitTitle) { g.refitTitle(); requestAnimationFrame(g.refitTitle); setTimeout(g.refitTitle, 250); } } },
        refreshDeck,
      };
    })();

    function openPicker() { TM.ui.picker(root, () => { title.refreshDeck(); g.newDealer(); if (def.reset) def.reset(g); }); }
    function howto() {
      const card = el('div', { class: 'tm-card tm-modal tm-fixed' },
        el('header', {}, el('h2', {}, 'あそびかた'), el('button', { class: 'tm-btn icon', 'aria-label': 'とじる', onclick: () => m.close() }, '✕')),
        el('ol', { class: 'tm-howto' }, (def.howto || []).map((s) => el('li', { html: s }))),
        el('footer', {}, el('span'), el('button', { class: 'tm-btn primary', style: { fontSize: '28px', padding: '12px 30px 8px' }, onclick: () => { m.close(); start(); } }, 'あそぶ！')));
      const m = TM.ui.modal(card);
      TM.ui.fit(card, { max: 1.35, fill: 0.92 });
    }

    /* ---------- flow ---------- */
    function toTitle() {
      TM.audio.stopMusic();
      g.state = 'title'; g.live = false; g.demo = true;
      g.newDealer(); g.score = new TM.Score();
      def.reset && def.reset(g);
      hud.show(false); title.show(true); results.hide();
    }
    function start() {
      results.hide();
      if (TM.ui.isModalOpen()) return;
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      TM.audio.unlock(); TM.sfx.whoosh();
      g.demo = false; g.state = 'countdown'; g.live = false; g.playT = 0; countdown = 3;
      g.score = new TM.Score(); g.newDealer(); g.fx = new TM.FX();
      def.reset && def.reset(g);
      title.show(false); results.hide(); hud.show(true);
    }
    g.restart = start; g.toTitle = toTitle;

    /* ---------- pause ---------- */
    let pauseM = null;
    function pause() {
      if (g.state !== 'play' && g.state !== 'countdown') return;
      const prev = g.state; g.state = 'paused';
      const card = el('div', { class: 'tm-card tm-pause' }, el('h2', {}, 'ポーズ'),
        el('button', { class: 'tm-btn primary', onclick: () => pauseM.close() }, 'つづける', el('kbd', {}, 'Esc')),
        el('div', { class: 'tm-row' },
          el('button', { class: 'tm-btn', onclick: () => { pauseM.close(); start(); } }, 'もういちど'),
          el('button', { class: 'tm-btn', onclick: () => { pauseM.close(); toTitle(); } }, 'やめる'),
          el('a', { class: 'tm-btn', href: root + 'index.html' }, 'ゲームいちらん')),
        el('button', { class: 'tm-btn small', onclick: () => TM.ui.settings() }, '⚙ せってい'));
      pauseM = TM.ui.modal(card, { onClose: () => { if (g.state === 'paused') { g.state = prev; last = performance.now(); } pauseM = null; } });
      TM.ui.fit(card, { max: 1.35, fill: 0.9 });
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('blur', () => pause());

    /* ---------- results ---------- */
    const results = (() => {
      let m = null;
      return {
        hide() { if (m) { m.close(); m = null; } },
        show(r) {
          const s = g.score, secs = g.playT;
          const acc = s.accuracy, wpm = s.wpm(secs);
          let stars = 1; if (acc >= 0.9) stars = 2; if (acc >= 0.9 && r.targetMet) stars = 3;
          const deckKey = TM.deck.key();
          const rec = TM.records.submit(def.id, deckKey, g.diff, { score: s.score, stars, wpm });
          const starBox = el('div', { class: 'tm-stars' });
          for (let i = 0; i < 3; i++) starBox.append(el('span', { html: TM.ui.starSVG(i < stars ? C.gold : '#D8D3E6') }).firstChild);
          const stats = [['はやさ (WPM)', wpm], ['せいかく', Math.round(acc * 100) + '%'], ['ことば', s.wordsDone], ['さいこうコンボ', s.bestCombo]].concat(r.stats || []);
          const tricky = s.trickyList();
          /* progress: a finished run (not a game-over) marks every chosen word list as cleared in this game */
          const ids = TM.deck.ids(), cleared = r.win !== false, fresh = cleared ? TM.progress.record(def.id, ids, stars) : [];
          const d0 = TM.data.decks[ids[0]], bk = d0 && TM.data.books.find((x) => x.id === d0.book), pr = bk ? TM.progress.book(bk) : null;
          const progBox = (cleared || pr) ? el('div', { class: 'tm-prog' + (fresh.length ? ' new' : '') },
            cleared ? el('div', {}, fresh.length ? '🎉 ' : '✓ ', fresh.length ? 'はじめての クリア！ ' : 'クリア ずみ ', ids.length === 1 && d0 ? (d0.unit ? `ユニット ${d0.unit}` : d0.label) : `${ids.length}リスト`) : null,
            pr ? el('div', { class: 'pbar' }, el('i', { style: { width: pr.pct + '%' } })) : null,
            pr ? el('div', { style: { fontSize: '16px', opacity: 0.8 } }, `${bk.name}: ${pr.done}/${pr.total} クリア（${pr.pct}%）`) : null) : null;
          const body = el('div', { class: 'rbody' },
            el('h2', {}, r.title || (r.win === false ? 'おしい！' : 'すごい！')),
            r.sub ? el('div', { class: 'sub' }, r.sub) : null,
            starBox,
            el('div', {}, el('span', { class: 'tm-score' }, s.score.toLocaleString()), rec.isNewBest && s.score > 0 ? el('span', { class: 'tm-newbest' }, 'しんきろく！') : null),
            el('div', { class: 'tm-stats' }, stats.map(([a, b]) => el('div', {}, el('b', {}, String(b)), el('span', {}, a)))),
            progBox,
            tricky.length ? el('div', { class: 'tm-tricky' }, el('h3', {}, 'にがてな ことば — れんしゅうしよう！'),
              el('div', { class: 'chips' }, tricky.map((it) => el('span', { class: 'tm-wchip' }, it.t, it.hint ? el('small', {}, it.hint) : null)))) : null);
          const foot = el('div', { class: 'rfoot' }, el('div', { class: 'tm-row' },
            el('button', { class: 'tm-btn primary', onclick: () => start() }, 'もういちど', el('kbd', {}, 'Enter')),
            el('button', { class: 'tm-btn', onclick: () => { toTitle(); openPicker(); } }, 'ことばを かえる'),
            el('a', { class: 'tm-btn', href: root + 'index.html' }, 'ゲームいちらん')));
          const card = el('div', { class: 'tm-card tm-results' }, body, foot);
          m = TM.ui.modal(card, { dismissable: false, keys: (e) => { if (e.key === 'Enter') { e.preventDefault(); start(); } }, onClose: () => { m = null; if (g.state === 'over') toTitle(); } });
          TM.ui.fit(card, { max: 1.45, fill: 0.94, min: 0.4 });
          [...starBox.children].forEach((sv, i) => setTimeout(() => { sv.classList.add('in'); if (i < stars) TM.sfx.star(i); }, 350 + i * 300));
          if (stars === 3) setTimeout(() => g.fx.confetti(W / 2, H / 3, 80), 1200);
        },
      };
    })();
    function showResults(r) { hud.show(false); results.show(r); }

    /* ---------- input ---------- */
    const ime = el('div', { class: 'tm-ime hidden', html: '<b>あ → A</b><br>日本語入力になっています。<b>半角/全角</b>キーを押してね！<br><span style="font:600 18px var(--word)">Switch your keyboard to English (half-width) input.</span>' });
    document.body.append(ime);
    let imeT = 0;
    window.addEventListener('keydown', (e) => {
      if (e.isComposing || e.key === 'Process' || e.keyCode === 229) {
        ime.classList.remove('hidden'); clearTimeout(imeT); imeT = setTimeout(() => ime.classList.add('hidden'), 4000);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (TM.ui.isModalOpen()) return;
      const k = e.key;
      if ([' ', "'", '/', 'Backspace', 'Tab', 'Enter'].includes(k) || k.length === 1) e.preventDefault();
      if (g.state === 'title') { if (k === 'Enter' || k === ' ') start(); return; }
      if (k === 'Escape') { pause(); return; }
      if (g.state !== 'play') return;
      ime.classList.add('hidden');
      if (k === 'Backspace') { def.onBack && def.onBack(g); return; }
      if (k === 'Enter') { def.onEnter && def.onEnter(g); return; }
      if (k.length !== 1) return;
      def.onKey(g, k.toLowerCase());
    });

    /* ---------- boot ---------- */
    const fontsReady = document.fonts ? Promise.race([Promise.all([
      document.fonts.load(D.FONT_WORD(46)), document.fonts.load(D.FONT_WORD(46, 700)), document.fonts.load(D.FONT_DISPLAY(60)), document.fonts.load(D.FONT_DISPLAY(60, 700)),
    ]), new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
    fontsReady.then(() => {
      def.init && def.init(g);
      toTitle();
      requestAnimationFrame((t) => { last = t; frame(t); });
    });
    return g;
  };

  /* Attract-mode helper: a bot that types the given typer at a steady pace. */
  TM.Bot = class {
    constructor(rate = 9) { this.rate = rate; this.acc = 0; }
    step(dt, typer, onResult) {
      if (!typer || typer.done) return;
      this.acc += dt * this.rate;
      while (this.acc >= 1 && !typer.done) {
        this.acc -= 1;
        const k = typer.nextReq(); if (k == null) break;
        const r = typer.feed(k); onResult && onResult(r);
      }
    }
  };
})();
