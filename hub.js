/* Typing Master - the Arcade hub: six cabinets, the word-list picker, settings, teacher links. */
(function () {
  'use strict';
  const TM = window.TM, C = TM.C, D = TM.draw, A = TM.art, el = TM.ui.el;

  const GAMES = [
    { id: 'word-jumper', name: 'Word Jumper', c: C.jumper, tag: 'Start here!', like: 'Word Jumper (platform runner)',
      desc: 'Hop Pip the frog over logs, sandcastles and snowmen. One word at a time.' },
    { id: 'word-ninja', name: 'Word Ninja', c: C.ninja, tag: 'Food words!', like: 'Fruit Ninja',
      desc: 'Fruit flies up from the counter. Type its word to slice it before it falls.' },
    { id: 'star-sweep', name: 'Star Sweep', c: C.sweep, tag: 'Space!', like: 'ZType',
      desc: 'Sweep grumpy space junk with sparkle shots before it reaches the station.' },
    { id: 'turbo-type', name: 'Turbo Type', c: C.turbo, tag: 'Race!', like: 'Nitro Type',
      desc: 'Your kart goes as fast as you type. Beat three rivals and your own ghost.' },
    { id: 'ink-rush', name: 'Ink Rush', c: C.ink2, tag: 'Splat!', like: 'The Typing of the Dead + Splatoon',
      desc: 'Splat the sleepy grey Gloops with colour ink and paint the whole town.' },
  ];

  /* ---------- header controls ---------- */
  const openPicker = () => TM.ui.picker('', () => { refresh(); });
  document.getElementById('controls').append(
    el('button', { class: 'tm-btn', onclick: teacher }, 'Teacher QR'),
    el('button', { class: 'tm-btn icon', title: 'Settings', 'aria-label': 'Settings', onclick: () => TM.ui.settings() }, '\u2699'));

  /* ---------- the "your words" bar ---------- */
  const wordsBtn = document.getElementById('words');
  wordsBtn.addEventListener('click', openPicker);

  /* ---------- game cards ---------- */
  const grid = document.getElementById('grid');
  const cabs = GAMES.map((gm) => {
    const stars = el('div', { class: 'stars' });
    const a = el('a', { class: 'cab', style: { '--c': gm.c }, href: gm.id + '/index.html' },
      el('div', { class: 'screen' }, el('img', { src: 'assets/hub/' + gm.id + '.webp', alt: gm.name + ' gameplay screenshot', loading: 'lazy', width: 960, height: 540 }), el('span', { class: 'tag' }, gm.tag)),
      el('div', { class: 'info' }, el('h2', {}, gm.name), el('p', {}, gm.desc), el('span', { class: 'like' }, el('b', {}, 'Based on '), gm.like),
        el('div', { class: 'row' }, stars, el('span', { class: 'go' }, 'Play \u25B6'))));
    a.style.setProperty('--c', gm.c);
    a.addEventListener('pointerenter', () => { try { TM.sfx.click(); } catch (e) { /* audio locked */ } });
    grid.append(a);
    return { gm, a, stars };
  });

  function refresh() {
    const ids = TM.deck.ids();
    const first = TM.data.decks[ids[0]];
    const book = first && TM.data.books.find((b) => b.id === first.book);
    wordsBtn.innerHTML = '';
    wordsBtn.append(
      book ? el('span', { class: 'cover' }, el('img', { src: book.cover, alt: '' })) : null,
      first && first.image ? el('span', { class: 'thumb' }, el('img', { src: first.image, alt: '' })) : null,
      el('span', { class: 'txt' },
        el('span', { class: 'k' }, 'Your words'),
        el('span', { class: 'v' }, TM.deck.label(ids)),
        el('span', { class: 'm' }, (book ? book.name : '') + (ids.length > 1 ? ` + ${ids.length - 1} more list${ids.length > 2 ? 's' : ''}` : ''))),
      el('span', { class: 'chg' }, 'Change \u25B8'));
    const q = '?deck=' + encodeURIComponent(ids.join(','));
    const key = TM.deck.key(ids);
    for (const c of cabs) {
      c.a.href = c.gm.id + '/index.html' + q;
      const s = TM.records.starsFor(c.gm.id, key);
      c.stars.innerHTML = [0, 1, 2].map((i) => TM.ui.starSVG(i < s ? C.gold : 'rgba(31,26,61,0.15)')).join('');
    }
  }

  /* ---------- teacher link: pick a game + mode, get a QR code (open it big on the board / projector) ---------- */
  function teacherUrl(gameId, diff, quiet) {
    const base = location.href.replace(/[^/]*(\?.*)?(#.*)?$/, '');
    return `${base}${gameId}/index.html?deck=${TM.deck.ids().join(',')}&diff=${diff}${quiet ? '&quiet=1' : ''}`;
  }
  function qrSvg(text) {
    const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
    return qr.createSvgTag({ cellSize: 10, margin: 4, scalable: true });
  }
  function teacher() {
    const sel = el('select', {}, GAMES.map((g) => el('option', { value: g.id }, g.name)));
    const diff = el('select', {}, [['gentle', 'Gentle'], ['normal', 'Normal'], ['turbo', 'Turbo']].map(([d, l]) => el('option', { value: d, selected: d === 'normal' }, l)));
    const quiet = el('input', { type: 'checkbox' });
    const card = el('div', { class: 'tm-card tm-modal tm-small' },
      el('header', {}, el('h2', {}, 'QR code for class'), el('button', { class: 'tm-btn icon', 'aria-label': 'Close', onclick: () => m.close() }, '\u2715')),
      el('div', { class: 'body' },
        el('div', { style: { font: '500 17px/1.4 var(--word)' } }, 'Students scan the code with a tablet or phone and the game opens on your word list (', el('b', {}, TM.deck.label()), ').'),
        el('label', { class: 'tm-field' }, 'Game', sel),
        el('label', { class: 'tm-field' }, 'Mode', diff),
        el('label', { class: 'tm-field' }, 'Start with sound off', quiet)),
      el('footer', {}, el('button', { class: 'tm-btn', onclick: () => m.close() }, 'Cancel'), el('button', { class: 'tm-btn primary', onclick: () => { const url = teacherUrl(sel.value, diff.value, quiet.checked); const name = sel.options[sel.selectedIndex].text, mode = diff.options[diff.selectedIndex].text; m.close(); showQR(url, name, mode); } }, 'Show QR code')));
    const m = TM.ui.modal(card);
  }
  function showQR(url, gameName, mode) {
    const box = el('div', { class: 'qrbox', html: qrSvg(url), role: 'img', 'aria-label': 'QR code for ' + gameName });
    const out = el('input', { readonly: true, value: url, 'aria-label': 'Link', onfocus: function () { this.select(); } });
    const copy = el('button', { class: 'tm-btn small' }, 'Copy link');
    copy.onclick = () => { out.select(); try { navigator.clipboard.writeText(url); } catch (e) { document.execCommand('copy'); } copy.textContent = 'Copied!'; };
    const card = el('div', { class: 'tm-card tm-modal tm-qr' },
      el('header', {}, el('h2', {}, gameName + ' \u00b7 ' + mode), el('button', { class: 'tm-btn icon', 'aria-label': 'Close', onclick: () => m.close() }, '\u2715')),
      el('div', { class: 'body qrwrap' }, box, el('div', { class: 'qrcap' }, 'Scan to play \u2022 ', el('b', {}, TM.deck.label()))),
      el('footer', {}, el('div', { class: 'linkbox' }, out, copy), el('button', { class: 'tm-btn primary', onclick: () => m.close() }, 'Done')));
    const m = TM.ui.modal(card);
  }

  /* ---------- mascot ---------- */
  const kipC = document.getElementById('kip').getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || TM.settings.reduceMotion;
  let t0 = performance.now();
  function frame(now) {
    const t = (now - t0) / 1000;
    kipC.clearRect(0, 0, 240, 240);
    A.kip(kipC, 120, 132, 1.6, { t, wave: true, accent: C.gold });
    if (!still) requestAnimationFrame(frame);
  }
  refresh();
  const ready = document.fonts ? Promise.race([document.fonts.load(D.FONT_WORD(30)), new Promise((r) => setTimeout(r, 1200))]) : Promise.resolve();
  ready.then(() => requestAnimationFrame(frame));
})();
