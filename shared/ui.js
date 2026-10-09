/* Typing Master - ui: DOM helpers, word-list picker, settings, icons. Shared by the hub and every game. */
(function () {
  'use strict';
  const TM = window.TM;

  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'html') e.innerHTML = v;
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
    return e;
  }

  const starSVG = (fill = '#FFC83D') => `<svg viewBox="0 0 100 100"><path d="M50 6l12.6 27.5 30 3.2-22.4 20.3 6.3 29.5L50 71.6 23.5 86.5l6.3-29.5L7.4 36.7l30-3.2z" fill="${fill}" stroke="#1F1A3D" stroke-width="7" stroke-linejoin="round"/><path d="M37 34l13-24 7 15" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="6" stroke-linecap="round"/></svg>`;
  const heartSVG = (fill = '#FF5A5F') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 88S8 62 8 34c0-14 10-24 23-24 9 0 15 5 19 11 4-6 10-11 19-11 13 0 23 10 23 24 0 28-42 54-42 54z" fill="${fill}" stroke="#1F1A3D" stroke-width="8" stroke-linejoin="round"/><ellipse cx="30" cy="30" rx="9" ry="6" fill="rgba(255,255,255,.6)"/></svg>`;
  const svgURL = (s) => 'url("data:image/svg+xml,' + encodeURIComponent(s) + '")';

  let openCount = 0;
  function modal(content, o = {}) {
    const dim = el('div', { class: 'tm-dim' }, content);
    const close = () => { if (!dim.parentNode) return; dim.remove(); openCount--; document.removeEventListener('keydown', onKey, true); o.onClose && o.onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } else if (o.keys) o.keys(e, close); };
    dim.addEventListener('pointerdown', (e) => { if (e.target === dim && o.dismissable !== false) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.append(dim); openCount++;
    return { close, dim };
  }
  const isModalOpen = () => openCount > 0;

  /* ---------- fit: scale a fixed-size UI block so it always fits the window with no scrolling (800x500 .. 3440x1440) ---------- */
  const fits = new Set();
  function doFit(box, o) {
    if (!box.isConnected) { fits.delete(box); return; }
    const prev = box.style.zoom;
    box.style.zoom = 1;
    // hidden (display:none) boxes measure 0: keep the old zoom and re-fit when shown. (Resetting to 1 here is what made the title screen
    // come back HUGE after a round until the window was resized / fullscreened.)
    const r = { width: box.offsetWidth, height: box.offsetHeight }; // layout size: NOT getBoundingClientRect, which includes the modal's pop-in scale animation and made cards fit too big
    if (!r.width || !r.height) { box.style.zoom = prev; return; }
    const vw = window.innerWidth, vh = window.innerHeight, fill = o.fill || 0.94;
    let z = Math.min((vw * fill) / r.width, (vh * fill) / r.height, o.max || 1.45);
    box.style.zoom = Math.max(o.min || 0.45, z).toFixed(3);
  }
  function fit(box, o = {}) { const rec = { box, o }; fits.add(rec); doFit(box, o); requestAnimationFrame(() => doFit(box, o)); return () => doFit(box, o); }
  const refitAll = () => { for (const r of [...fits]) { if (!r.box.isConnected) fits.delete(r); else doFit(r.box, r.o); } };
  window.addEventListener('resize', refitAll);
  window.addEventListener('orientationchange', () => setTimeout(refitAll, 200));
  document.addEventListener('fullscreenchange', () => { refitAll(); setTimeout(refitAll, 300); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', refitAll);
  // content that arrives late (cover images, the Japanese font, a deck change) changes a box's natural size after it was fitted, and a
  // Chromebook window that is not fullscreen never fires another resize, so the UI stayed oversized until fullscreen. Re-check regularly.
  window.addEventListener('load', () => { refitAll(); setTimeout(refitAll, 600); }, { once: true });
  document.addEventListener('load', refitAll, true);                       // any <img> finishing
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', refitAll);
  setInterval(() => { if (!document.hidden && fits.size) refitAll(); }, 500);

  /* ---------- word-list picker: textbook covers first, then that book's units ---------- */
  function picker(root, onDone) {
    const data = TM.data;
    let sel = new Set(TM.deck.ids());
    let book = data.decks[[...sel][0]]?.book || (data.books[0] && data.books[0].id);
    let view = 'books';
    const stage = el('div', { class: 'tm-stage' });
    const title = el('h2', {}, 'ほんを えらぼう');
    const crumb = el('button', { class: 'tm-btn small tm-back hidden', onclick: () => { view = 'books'; render(); } }, '◀ ほん');
    const count = el('span', { class: 'tm-count' });
    const done = el('button', { class: 'tm-btn primary tm-play' }, 'これで あそぶ！');

    const img = (src) => (src ? root + src : '');
    const bookOf = (id) => data.books.find((x) => x.id === id);
    const selIn = (b) => b.decks.filter((id) => sel.has(id)).length;
    const gameDots = (deckId) => {
      const have = new Set(TM.progress.games(deckId));
      return el('div', { class: 'gd', 'aria-label': 'クリアした ゲーム' }, TM.GAMES.map((g) => el('i', { class: have.has(g.id) ? 'on' : '', style: { '--c': g.c }, title: g.short }, have.has(g.id) ? '✓' : '')));
    };

    function renderBooks() {
      const grid = el('div', { class: 'tm-books', role: 'list' });
      for (const b of data.books) {
        const n = selIn(b), pr = TM.progress.book(b);
        const card = el('button', { class: 'tm-book' + (b.id === book ? ' cur' : ''), role: 'listitem', 'aria-label': b.name, onclick: () => { book = b.id; view = 'decks'; TM.sfx && TM.sfx.click(); render(); } },
          el('div', { class: 'cover' }, el('img', { src: img(b.cover), alt: b.name, draggable: 'false' }), n ? el('span', { class: 'badge' }, `えらんだ ${n}`) : null),
          el('div', { class: 'bn' }, b.name),
          el('div', { class: 'bp' }, el('div', { class: 'pbar' }, el('i', { style: { width: pr.pct + '%' } })), el('span', {}, `${pr.done}/${pr.total} クリア ${pr.pct}%`)));
        grid.append(card);
      }
      stage.append(grid);
    }
    function renderDecks() {
      const b = bookOf(book);
      if (!b) return;
      const grid = el('div', { class: 'tm-grid' });
      const pr = TM.progress.book(b);
      for (const id of b.decks) {
        const d = data.decks[id];
        const pic = el('div', { class: 'img' });
        const fallback = () => { pic.textContent = d.unit ? d.unit : '★'; };
        if (d.image) pic.append(el('img', { src: img(d.image), alt: '', draggable: 'false', onerror: function () { this.remove(); fallback(); } })); else fallback();
        const nS = d.sentences ? d.sentences.length : 0, isDone = TM.progress.done(id);
        const tile = el('button', { class: 'tm-tile' + (sel.has(id) ? ' on' : '') + (isDone ? ' done' : ''), 'aria-pressed': sel.has(id) ? 'true' : 'false' },
          pic,
          el('div', { class: 't' },
            el('div', { class: 'u' }, d.unit ? `ユニット ${d.unit}` : d.label),
            el('div', { class: 'n' }, d.unit || d.label !== d.title ? d.title : ' '),
            el('div', { class: 'c' }, `${d.words.length} ことば`, nS ? ` ・ ぶん ${nS}` : ''),
            gameDots(id)),
          el('div', { class: 'tick' }, '✓'),
          isDone ? el('div', { class: 'clr' }, 'クリア！') : null);
        tile.onclick = (e) => {
          if (e.shiftKey || e.ctrlKey || e.metaKey) { sel.has(id) ? sel.delete(id) : sel.add(id); }   // teachers: Shift/Ctrl-click mixes lists
          else { sel = new Set([id]); }
          TM.sfx && TM.sfx.click();
          const y = stage.scrollTop; render(); stage.scrollTop = y;
          const t2 = stage.querySelectorAll('.tm-tile')[b.decks.indexOf(id)]; if (t2) t2.focus({ preventScroll: true });
        };
        grid.append(tile);
      }
      stage.append(el('div', { class: 'tm-bookbar' }, el('img', { src: img(b.cover), alt: '' }),
        el('div', { class: 'bt' }, el('b', {}, b.name), el('span', {}, 'ユニットを タップしてね')),
        el('div', { class: 'bp wide' }, el('div', { class: 'pbar' }, el('i', { style: { width: pr.pct + '%' } })), el('span', {}, `${pr.done}/${pr.total} クリア ${pr.pct}%`))), grid);
    }
    function render() {
      stage.innerHTML = '';
      crumb.classList.toggle('hidden', view === 'books');
      const b = bookOf(book);
      title.textContent = view === 'books' ? 'ほんを えらぼう' : (b ? b.name : 'ことばを えらぼう');
      if (view === 'books') renderBooks(); else renderDecks();
      renderCount();
      const first = stage.querySelector('.tm-book.cur, .tm-tile.on, .tm-tile, .tm-book');
      if (first && !stage.contains(document.activeElement)) first.focus({ preventScroll: true });
    }
    function renderCount() {
      const w = new Set(); for (const id of sel) for (const x of data.decks[id].words) w.add(x);
      count.textContent = sel.size ? `${w.size} ことば${sel.size > 1 ? ` (${sel.size}リスト)` : ''}` : 'ひとつ えらんでね';
      done.disabled = !sel.size; done.style.opacity = sel.size ? 1 : 0.5;
    }
    const card = el('div', { class: 'tm-card tm-modal tm-picker' },
      el('header', {}, el('div', { class: 'tm-hl' }, crumb, title), el('button', { class: 'tm-btn icon', title: 'とじる', 'aria-label': 'とじる', onclick: () => m.close() }, '✕')),
      stage,
      el('footer', {}, el('span'), el('div', { class: 'tm-row' }, count, done)));
    done.onclick = () => {
      if (!sel.size) return;
      TM.deck.set([...sel]); m.close(); onDone && onDone([...sel]);
    };
    const m = modal(card, { keys: (e) => {
      const tg = e.target && e.target.tagName;
      if (e.key === 'Enter' && view === 'decks' && tg !== 'BUTTON' && tg !== 'INPUT') { e.preventDefault(); done.click(); }
      else if (e.key === 'Backspace' && view === 'decks') { e.preventDefault(); view = 'books'; render(); }
    } });
    render();
    return m;
  }

  /* ---------- settings: only what a student needs ---------- */
  function settings(onChange) {
    const s = TM.settings;
    const range = (key) => { const r = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s[key] }); r.oninput = () => { s[key] = +r.value; TM.saveSettings(); TM.audio && TM.audio.applyVolume(); }; r.onchange = () => { if (key === 'sfx' && TM.sfx) TM.sfx.word(); }; return r; };
    const seg = (key, opts) => {
      const w = el('div', { class: 'tm-seg', style: { boxShadow: 'none' } });
      for (const [v, label] of opts) {
        const b = el('button', { class: s[key] === v ? 'on' : '', onclick: () => { s[key] = v; TM.saveSettings(); [...w.children].forEach((x) => x.classList.toggle('on', x === b)); onChange && onChange(); } }, label);
        w.append(b);
      }
      return w;
    };
    const card = el('div', { class: 'tm-card tm-modal tm-small' },
      el('header', {}, el('h2', {}, 'せってい'), el('button', { class: 'tm-btn icon', 'aria-label': 'とじる', onclick: () => m.close() }, '✕')),
      el('div', { class: 'body' },
        el('label', { class: 'tm-field' }, 'こうかおん', range('sfx')),
        el('label', { class: 'tm-field' }, 'おんがく', range('music')),
        el('div', { class: 'tm-field' }, 'にほんごヒント', seg('hints', [['auto', 'おまかせ'], ['on', 'あり'], ['off', 'なし']]))),
      el('footer', {}, el('span'), el('button', { class: 'tm-btn', onclick: () => m.close() }, 'OK')));
    const m = modal(card);
    fit(card, { max: 1.3, fill: 0.92 });
    return m;
  }

  TM.ui = { el, modal, isModalOpen, picker, settings, fit, starSVG, heartSVG, svgURL };
})();
