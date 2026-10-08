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
    { id: 'rooftop-rascal', name: 'Rooftop Rascal', c: C.rascal, tag: 'Sneaky!', like: 'Rebellious Robot',
      desc: 'Leap Rascal the raccoon across night rooftops and grab snacks before sunrise.' },
    { id: 'ink-rush', name: 'Ink Rush', c: C.ink2, tag: 'Splat!', like: 'The Typing of the Dead + Splatoon',
      desc: 'Splat the sleepy grey Gloops with colour ink and paint the whole town.' },
  ];

  /* ---------- header controls ---------- */
  const openPicker = () => TM.ui.picker('', () => { refresh(); });
  document.getElementById('controls').append(
    el('button', { class: 'tm-btn', onclick: teacher }, 'Teacher link'),
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

  /* ---------- teacher link ---------- */
  function teacher() {
    const sel = el('select', {}, GAMES.map((g) => el('option', { value: g.id }, g.name)));
    const diff = el('select', {}, ['gentle', 'normal', 'turbo'].map((d) => el('option', { value: d, selected: d === 'normal' }, d[0].toUpperCase() + d.slice(1))));
    const quiet = el('input', { type: 'checkbox' });
    const out = el('input', { readonly: true });
    const copy = el('button', { class: 'tm-btn small' }, 'Copy');
    const make = () => {
      const base = location.href.replace(/[^/]*(\?.*)?(#.*)?$/, '');
      out.value = `${base}${sel.value}/index.html?deck=${TM.deck.ids().join(',')}${quiet.checked ? '&quiet=1' : ''}`;
    };
    sel.onchange = make; diff.onchange = make; quiet.onchange = make;
    copy.onclick = () => { out.select(); try { navigator.clipboard.writeText(out.value); } catch (e) { document.execCommand('copy'); } copy.textContent = 'Copied!'; };
    const card = el('div', { class: 'tm-card tm-modal tm-small' },
      el('header', {}, el('h2', {}, 'Teacher link'), el('button', { class: 'tm-btn icon', onclick: () => m.close() }, '✕')),
      el('div', { class: 'body' },
        el('div', { style: { font: '500 17px/1.4 var(--word)' } }, 'A link that opens a game straight on your chosen word list (', el('b', {}, TM.deck.label()), '). Put it on the board or in Google Classroom.'),
        el('label', { class: 'tm-field' }, 'Game', sel),
        el('label', { class: 'tm-field' }, 'Start with sound off', quiet),
        el('div', { class: 'linkbox' }, out, copy)),
      el('footer', {}, el('span'), el('button', { class: 'tm-btn', onclick: () => m.close() }, 'Done')));
    const m = TM.ui.modal(card); make();
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
