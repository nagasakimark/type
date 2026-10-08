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

  /* ---------- word-list picker: textbook covers first, then that book's units ---------- */
  function picker(root, onDone) {
    const data = TM.data;
    let sel = new Set(TM.deck.ids());
    let book = data.decks[[...sel][0]]?.book || (data.books[0] && data.books[0].id);
    let view = 'books';
    const stage = el('div', { class: 'tm-stage' });
    const title = el('h2', {}, 'Choose your textbook');
    const crumb = el('button', { class: 'tm-btn small tm-back hidden', onclick: () => { view = 'books'; render(); } }, '◀ Textbooks');
    const count = el('span', { class: 'tm-count' });
    const shortT = el('input', { type: 'checkbox' }); shortT.checked = TM.settings.shortOnly;
    const multi = el('input', { type: 'checkbox' });
    const multiLbl = el('label', { class: 'tm-toggle' }, multi, 'Mix several lists');
    const done = el('button', { class: 'tm-btn primary tm-play' }, 'Play these!');

    const img = (src) => (src ? root + src : '');
    const bookOf = (id) => data.books.find((x) => x.id === id);
    const selIn = (b) => b.decks.filter((id) => sel.has(id)).length;

    function renderBooks() {
      const grid = el('div', { class: 'tm-books', role: 'list' });
      for (const b of data.books) {
        const n = selIn(b);
        const card = el('button', { class: 'tm-book' + (b.id === book ? ' cur' : ''), role: 'listitem', 'aria-label': b.name, onclick: () => { book = b.id; view = 'decks'; TM.sfx && TM.sfx.click(); render(); } },
          el('div', { class: 'cover' }, el('img', { src: img(b.cover), alt: b.name, draggable: 'false' }), n ? el('span', { class: 'badge' }, `${n} picked`) : null),
          el('div', { class: 'bn' }, b.name),
          el('div', { class: 'bc' }, `${b.decks.length} lists`));
        grid.append(card);
      }
      stage.append(grid);
    }
    function renderDecks() {
      const b = bookOf(book);
      if (!b) return;
      const grid = el('div', { class: 'tm-grid' });
      for (const id of b.decks) {
        const d = data.decks[id];
        const pic = el('div', { class: 'img' });
        const fallback = () => { pic.textContent = d.unit ? d.unit : '★'; };
        if (d.image) pic.append(el('img', { src: img(d.image), alt: '', draggable: 'false', onerror: function () { this.remove(); fallback(); } })); else fallback();
        const nS = d.sentences ? d.sentences.length : 0;
        const tile = el('button', { class: 'tm-tile' + (sel.has(id) ? ' on' : ''), 'aria-pressed': sel.has(id) ? 'true' : 'false' },
          pic,
          el('div', { class: 't' },
            el('div', { class: 'u' }, d.unit ? `Unit ${d.unit}` : d.label),
            el('div', { class: 'n' }, d.unit || d.label !== d.title ? d.title : ' '),
            el('div', { class: 'c' }, `${d.words.length} words`, nS ? ` · ${nS} sentences` : '')),
          el('div', { class: 'tick' }, '✓'));
        tile.onclick = (e) => {
          if (e.shiftKey || e.ctrlKey || e.metaKey || sel.size === 0 || multi.checked) { sel.has(id) ? sel.delete(id) : sel.add(id); }
          else { sel = new Set([id]); }
          TM.sfx && TM.sfx.click();
          const y = grid.scrollTop; render(); const g2 = stage.querySelector('.tm-grid'); if (g2) g2.scrollTop = y;
          const t2 = stage.querySelectorAll('.tm-tile')[b.decks.indexOf(id)]; if (t2) t2.focus({ preventScroll: true });
        };
        grid.append(tile);
      }
      stage.append(el('div', { class: 'tm-bookbar' }, el('img', { src: img(b.cover), alt: '' }), el('div', {}, el('b', {}, b.name), el('span', {}, 'Tap a unit. Tap more than one to mix them.'))), grid);
    }
    function render() {
      stage.innerHTML = '';
      crumb.classList.toggle('hidden', view === 'books');
      multiLbl.classList.toggle('hidden', view === 'books');
      const b = bookOf(book);
      title.textContent = view === 'books' ? 'Choose your textbook' : (b ? b.name : 'Choose words');
      if (view === 'books') renderBooks(); else renderDecks();
      renderCount();
      const first = stage.querySelector('.tm-book.cur, .tm-tile.on, .tm-tile, .tm-book');
      if (first && !stage.contains(document.activeElement)) first.focus({ preventScroll: true });
    }
    function renderCount() {
      const w = new Set(); for (const id of sel) for (const x of data.decks[id].words) w.add(x);
      count.textContent = sel.size ? `${sel.size} list${sel.size > 1 ? 's' : ''} · ${w.size} words` : 'Pick at least one list';
      done.disabled = !sel.size; done.style.opacity = sel.size ? 1 : 0.5;
    }
    const card = el('div', { class: 'tm-card tm-modal tm-picker' },
      el('header', {}, el('div', { class: 'tm-hl' }, crumb, title), el('button', { class: 'tm-btn icon', title: 'Close', 'aria-label': 'Close', onclick: () => m.close() }, '✕')),
      stage,
      el('footer', {},
        el('div', { class: 'tm-row', style: { justifyContent: 'flex-start' } }, multiLbl, el('label', { class: 'tm-toggle' }, shortT, 'Short words only')),
        el('div', { class: 'tm-row' }, count, done)));
    done.onclick = () => {
      if (!sel.size) return;
      TM.settings.shortOnly = shortT.checked; TM.saveSettings();
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

  /* ---------- settings ---------- */
  function settings(onChange) {
    const s = TM.settings;
    const range = (key) => { const r = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s[key] }); r.oninput = () => { s[key] = +r.value; TM.saveSettings(); TM.audio && TM.audio.applyVolume(); }; r.onchange = () => TM.sfx && TM.sfx.word(); return r; };
    const check = (key) => { const c = el('input', { type: 'checkbox' }); c.checked = !!s[key]; c.onchange = () => { s[key] = c.checked; TM.saveSettings(); onChange && onChange(); }; return c; };
    const seg = (key, opts) => {
      const w = el('div', { class: 'tm-seg', style: { boxShadow: 'none' } });
      for (const [v, label] of opts) {
        const b = el('button', { class: s[key] === v ? 'on' : '', onclick: () => { s[key] = v; TM.saveSettings(); [...w.children].forEach((x) => x.classList.toggle('on', x === b)); onChange && onChange(); } }, label);
        w.append(b);
      }
      return w;
    };
    const card = el('div', { class: 'tm-card tm-modal tm-small' },
      el('header', {}, el('h2', {}, 'Settings'), el('button', { class: 'tm-btn icon', onclick: () => m.close() }, '✕')),
      el('div', { class: 'body' },
        el('label', { class: 'tm-field' }, 'Sound effects', range('sfx')),
        el('label', { class: 'tm-field' }, 'Music', range('music')),
        el('div', { class: 'tm-field' }, 'Japanese hints', seg('hints', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']])),
        el('label', { class: 'tm-field' }, "Must type ' and -", check('strict')),
        el('label', { class: 'tm-field' }, 'Keyboard helper', check('keyboard')),
        el('label', { class: 'tm-field' }, 'Reduce motion', check('reduceMotion')),
        el('div', { class: 'tm-field' }, 'Reset my records',
          el('button', { class: 'tm-btn small', onclick: (e) => {
            try { Object.keys(localStorage).filter((k) => k.startsWith('tm.rec.')).forEach((k) => localStorage.removeItem(k)); } catch (err) { /* ignore */ }
            e.target.textContent = 'Done!';
          } }, 'Reset'))),
      el('footer', {}, el('span', { style: { font: '500 16px var(--word)', opacity: 0.7 } }, 'Saved on this computer'), el('button', { class: 'tm-btn', onclick: () => m.close() }, 'OK')));
    const m = modal(card);
    return m;
  }

  TM.ui = { el, modal, isModalOpen, picker, settings, starSVG, heartSVG, svgURL };
})();
