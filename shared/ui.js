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

  /* ---------- word-list picker ---------- */
  function picker(root, onDone) {
    const data = TM.data;
    let sel = new Set(TM.deck.ids());
    const firstBook = data.decks[[...sel][0]]?.book || (data.books[0] && data.books[0].id);
    let book = firstBook;
    const tabs = el('div', { class: 'tm-tabs' });
    const grid = el('div', { class: 'tm-grid' });
    const count = el('span', { style: { font: '700 18px var(--word)' } });
    const shortT = el('input', { type: 'checkbox' }); shortT.checked = TM.settings.shortOnly;

    function img(src) { return src ? root + src : ''; }
    function renderTabs() {
      tabs.innerHTML = '';
      for (const b of data.books) {
        const t = el('button', { class: 'tm-tab' + (b.id === book ? ' on' : ''), onclick: () => { book = b.id; renderTabs(); renderGrid(); } },
          el('img', { src: img(b.cover), alt: '', onerror: function () { this.style.display = 'none'; } }), b.name);
        tabs.append(t);
      }
    }
    function renderGrid() {
      grid.innerHTML = '';
      const b = data.books.find((x) => x.id === book);
      if (!b) return;
      for (const id of b.decks) {
        const d = data.decks[id];
        const tile = el('button', { class: 'tm-tile' + (sel.has(id) ? ' on' : '') });
        const pic = el('div', { class: 'img' });
        if (d.image) {
          const probe = new Image();
          probe.onload = () => { pic.style.backgroundImage = `url("${img(d.image)}")`; };
          probe.onerror = () => { pic.textContent = d.unit ? d.unit : '★'; };
          probe.src = img(d.image);
        } else pic.textContent = d.unit ? d.unit : '★';
        tile.append(pic, el('div', { class: 't' },
          el('div', { class: 'u' }, d.unit ? `Unit ${d.unit}` : d.label === d.title ? d.title : d.label),
          el('div', { class: 'n' }, d.unit || d.label !== d.title ? d.title : ''),
          el('div', { class: 'c' }, `${d.words.length} words${d.sentences && d.sentences.length ? ' · ' + d.sentences.length + ' sentences' : ''}`)),
          el('div', { class: 'tick' }, '✓'));
        tile.onclick = (e) => {
          if (e.shiftKey || e.ctrlKey || e.metaKey || sel.size === 0 || multi.checked) { sel.has(id) ? sel.delete(id) : sel.add(id); }
          else { sel = new Set([id]); }
          TM.sfx && TM.sfx.click();
          renderGrid(); renderCount();
        };
        grid.append(tile);
      }
    }
    const multi = el('input', { type: 'checkbox' });
    function renderCount() {
      let w = new Set(); for (const id of sel) for (const x of data.decks[id].words) w.add(x);
      count.textContent = sel.size ? `${sel.size} list${sel.size > 1 ? 's' : ''} · ${w.size} words` : 'Pick at least one list';
      done.disabled = !sel.size; done.style.opacity = sel.size ? 1 : 0.5;
    }
    const done = el('button', { class: 'tm-btn primary', style: { fontSize: '30px', padding: '12px 36px 8px' } }, 'Play these!');
    const card = el('div', { class: 'tm-card tm-modal' },
      el('header', {}, el('h2', {}, 'Choose words'), el('button', { class: 'tm-btn icon', title: 'Close', onclick: () => m.close() }, '✕')),
      tabs, grid,
      el('footer', {},
        el('div', { class: 'tm-row', style: { justifyContent: 'flex-start' } },
          el('label', { class: 'tm-toggle' }, multi, 'Mix several lists'),
          el('label', { class: 'tm-toggle' }, shortT, 'Short words only')),
        el('div', { class: 'tm-row' }, count, done)));
    done.onclick = () => {
      if (!sel.size) return;
      TM.settings.shortOnly = shortT.checked; TM.saveSettings();
      TM.deck.set([...sel]); m.close(); onDone && onDone([...sel]);
    };
    renderTabs(); renderGrid(); renderCount();
    const m = modal(card, { keys: (e) => { if (e.key === 'Enter') { e.preventDefault(); done.click(); } } });
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
