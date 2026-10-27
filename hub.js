/* Typing Master - the Arcade hub: six cabinets, the word-list picker, settings, teacher links. */
(function () {
  'use strict';
  const TM = window.TM, C = TM.C, D = TM.draw, A = TM.art, el = TM.ui.el;

  const GAMES = [
    { id: 'word-jumper', key: 'J', name: 'Word Jumper', c: C.jumper, first: true,
      desc: 'カエルの ピップが ジャンプ！ ことばを うって きや すなのおしろを とびこえよう。' },
    { id: 'word-ninja', key: 'N', name: 'Word Ninja', c: C.ninja,
      desc: 'とんでくる フルーツの ことばを うって おちるまえに スパッと きろう。' },
    { id: 'star-sweep', key: 'S', name: 'Star Sweep', c: C.sweep,
      desc: 'ステーションに つくまえに うちゅうの ゴミを ビームで きれいにしよう。' },
    { id: 'turbo-type', key: 'T', name: 'Turbo Type', c: C.turbo,
      desc: 'タイプした ぶんだけ カートが はやく なる！ ライバル 3だいと ゴーストに かとう。' },
    { id: 'ink-rush', key: 'I', name: 'Ink Rush', c: C.ink2,
      desc: 'ねむそうな はいいろの グルーに インクを ぶつけて まちじゅうを ぬろう。' },
    { id: 'cat-defense', key: 'C', name: 'Cat Defenders', c: '#FF9F1C',
      desc: 'ゾンビが かべに くるまえに ことばを うとう！ ネコが バンバン こうげき。ネコを あわせて つよくしよう。' },
  ];

  /* ---------- header controls ---------- */
  const openPicker = () => TM.ui.picker('', () => { refresh(); });
  const modeBtns = {};
  const modeBox = document.getElementById('mode');
  for (const [v, label, hint] of [['en', 'えいごを タイプ', 'えいごを みて うつ'], ['ja2en', 'にほんご → えいご', 'にほんごを みて えいごを おもいだして うつ']]) {
    const b = el('button', { type: 'button', 'aria-pressed': 'false', onclick: () => { TM.settings.mode = v; TM.saveSettings(); TM.sfx && TM.sfx.click(); syncMode(); refresh(); } }, el('b', {}, label), el('span', {}, hint));
    modeBtns[v] = b; modeBox.append(b);
  }
  function syncMode() { for (const k in modeBtns) { modeBtns[k].classList.toggle('on', k === TM.mode()); modeBtns[k].setAttribute('aria-pressed', k === TM.mode() ? 'true' : 'false'); } }
  syncMode();
  document.getElementById('controls').append(
    el('button', { type: 'button', onclick: progress }, 'きろく'),
    el('button', { type: 'button', onclick: teacher }, '先生用 QR'),
    el('button', { type: 'button', onclick: () => TM.ui.settings() }, 'せってい'));

  /* ---------- my progress: streak, mastered words, tricky words, the last 7 days ---------- */
  function progress() {
    const S = TM.stats, st = S.summary(), D = S.load(), W = D.words;
    const keys = Object.keys(W), tricky = keys.filter((k) => W[k].hard).sort((a, b) => W[b].lost + W[b].e - W[a].lost - W[a].e).slice(0, 14);
    const mastered = keys.filter((k) => W[k].cl >= 3).length, fixed = keys.reduce((a, k) => a + (W[k].fix || 0), 0);
    const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); days.push({ n: ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど'][d.getDay()], w: (D.days[k] || {}).words || 0 }); }
    const mx = Math.max(10, ...days.map((d) => d.w));
    const big = (b, a) => el('div', {}, el('b', {}, String(b)), el('span', {}, a));
    const empty = !keys.length;
    const card = el('div', { class: 'tm-card tm-me' }, el('h2', {}, 'わたしの きろく'),
      empty ? el('p', { style: { font: '700 24px var(--word)' } }, 'ゲームを あそぶと ここに せいちょうが のこるよ！') : [
        el('div', { class: 'tm-stats' }, big(st.streak, '🔥 れんぞく (にち)'), big(mastered, '⭐ マスター'), big(fixed, '🌱 にがて クリア'), big(keys.length, 'あそんだ ことば')),
        el('div', { class: 'tm-bars' }, days.map((d) => el('div', {}, el('i', { style: { height: Math.max(4, Math.round(110 * d.w / mx)) + 'px' } }), el('small', {}, d.n)))),
        el('div', { style: { font: '700 16px var(--word)', opacity: 0.7 } }, 'この 7にちかんの タイプした ことば'),
        tricky.length ? el('div', { class: 'tm-tricky' }, el('h3', {}, 'まだ にがてな ことば — あと すこし！'), el('div', { class: 'chips' }, tricky.map((k) => el('span', { class: 'tm-wchip' }, (TM.data.words[k] || { t: k }).t)))) : el('div', { style: { font: '800 24px var(--display)' } }, '🎉 にがてな ことばは いまのところ なし！')],
      el('div', { class: 'tm-row' }, el('button', { class: 'tm-btn primary', onclick: () => m.close() }, 'とじる')));
    const m = TM.ui.modal(card, {});
    TM.ui.fit && TM.ui.fit(card, { max: 1.3, fill: 0.92, min: 0.4 });
  }

  /* ---------- the "your words" bar ---------- */
  const wordsBtn = document.getElementById('words');
  wordsBtn.addEventListener('click', openPicker);

  /* ---------- game cards ---------- */
  const grid = document.getElementById('grid');
  const cabs = GAMES.map((gm) => {
    const stars = el('div', { class: 'stars' });
    const a = el('a', { class: 'game', href: gm.id + '/index.html', 'aria-keyshortcuts': gm.key },
      el('span', { class: 'key', 'aria-hidden': 'true' }, gm.key),
      el('span', { class: 'shot' }, el('img', { src: 'assets/hub/' + gm.id + '.webp', alt: '', loading: 'lazy', width: 960, height: 540 })),
      el('span', { class: 'txt' }, el('h3', {}, gm.name, gm.first ? el('small', {}, 'はじめてなら これ') : null), el('p', {}, gm.desc)),
      stars);
    a.style.setProperty('--c', gm.c);
    grid.append(a);
    return { gm, a, stars };
  });
  /* press a game's letter to start it (the key sinks first) */
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || TM.ui.isModalOpen()) return;
    const t = e.target; if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
    const c = cabs.find((x) => x.gm.key.toLowerCase() === e.key.toLowerCase()); if (!c) return;
    e.preventDefault(); c.a.classList.add('down'); try { TM.sfx.click(); } catch (err) { /* audio locked */ }
    setTimeout(() => { location.href = c.a.href; }, 170);
  });

  function refresh() {
    const ids = TM.deck.ids();
    const first = TM.data.decks[ids[0]];
    const book = first && TM.data.books.find((b) => b.id === first.book);
    wordsBtn.innerHTML = '';
    wordsBtn.append(...[
      book ? el('span', { class: 'cover' }, el('img', { src: book.cover, alt: '' })) : null,
      first && first.image ? el('span', { class: 'thumb' }, el('img', { src: first.image, alt: '' })) : null,
      el('span', { class: 'txt' },
        el('span', { class: 'v' }, TM.deck.label(ids)),
        el('span', { class: 'm' }, (book ? TM.level(book).text + '  ・  ' + book.name : '') + (TM.progress && ids.length === 1 ? '  ・  クリア ' + TM.progress.games(ids[0]).length + '/' + TM.progress.GAMES.length : '') + (ids.length > 1 ? ` ほか ${ids.length - 1}こ` : ''))),
      el('span', { class: 'chg' }, 'かえる')].filter(Boolean));
    const q = '?deck=' + encodeURIComponent(ids.join(','));
    const key = TM.deck.key(ids);
    for (const c of cabs) {
      c.a.href = c.gm.id + '/index.html' + q;
      const s = TM.records.starsFor(c.gm.id, key);
      c.stars.innerHTML = [0, 1, 2].map((i) => TM.ui.starSVG(i < s ? '#F2A900' : 'rgba(21,26,44,0.16)')).join('');
    }
  }

  /* ---------- teacher link: pick a game + mode, get a QR code (open it big on the board / projector) ---------- */
  function teacherUrl(gameId, diff, quiet, mode) {
    const base = location.href.replace(/[^/]*(\?.*)?(#.*)?$/, '');
    return `${base}${gameId}/index.html?deck=${TM.deck.ids().join(',')}&diff=${diff}${mode === 'ja2en' ? '&mode=ja2en' : ''}${quiet ? '&quiet=1' : ''}`;
  }
  function qrSvg(text) {
    const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
    return qr.createSvgTag({ cellSize: 10, margin: 4, scalable: true });
  }
  function teacher() {
    const sel = el('select', {}, GAMES.map((g) => el('option', { value: g.id }, g.name)));
    const diff = el('select', {}, [['gentle', 'ゆっくり'], ['normal', 'ふつう'], ['turbo', 'ターボ']].map(([d, l]) => el('option', { value: d, selected: d === 'normal' }, l)));
    const quiet = el('input', { type: 'checkbox' });
    const mode = el('select', {}, [['en', 'えいごを タイプ'], ['ja2en', 'にほんご → えいご']].map(([d, l]) => el('option', { value: d, selected: d === TM.mode() }, l)));
    const card = el('div', { class: 'tm-card tm-modal tm-small' },
      el('header', {}, el('h2', {}, 'クラス用 QRコード'), el('button', { class: 'tm-btn icon', 'aria-label': 'とじる', onclick: () => m.close() }, '\u2715')),
      el('div', { class: 'body' },
        el('div', { style: { font: '500 17px/1.4 var(--word)' } }, 'タブレットや スマホで よみとると、このたんご（', el('b', {}, TM.deck.label()), ') で ゲームが ひらきます。'),
        el('label', { class: 'tm-field' }, 'ゲーム', sel),
        el('label', { class: 'tm-field' }, 'モード', diff),
        el('label', { class: 'tm-field' }, 'あそびかた', mode),
        el('label', { class: 'tm-field' }, 'おとを けして はじめる', quiet)),
      el('footer', {}, el('button', { class: 'tm-btn', onclick: () => m.close() }, 'キャンセル'), el('button', { class: 'tm-btn primary', onclick: () => { const url = teacherUrl(sel.value, diff.value, quiet.checked, mode.value); const name = sel.options[sel.selectedIndex].text, md = diff.options[diff.selectedIndex].text + (mode.value === 'ja2en' ? ' ・ にほんご→えいご' : ''); m.close(); showQR(url, name, md); } }, 'Show QR code')));
    const m = TM.ui.modal(card);
  }
  function showQR(url, gameName, mode) {
    const box = el('div', { class: 'qrbox', html: qrSvg(url), role: 'img', 'aria-label': 'QRコード ' + gameName });
    const out = el('input', { readonly: true, value: url, 'aria-label': 'リンク', onfocus: function () { this.select(); } });
    const copy = el('button', { class: 'tm-btn small' }, 'リンクを コピー');
    copy.onclick = () => { out.select(); try { navigator.clipboard.writeText(url); } catch (e) { document.execCommand('copy'); } copy.textContent = 'コピーしました'; };
    const card = el('div', { class: 'tm-card tm-modal tm-qr' },
      el('header', {}, el('h2', {}, gameName + ' \u00b7 ' + mode), el('button', { class: 'tm-btn icon', 'aria-label': 'とじる', onclick: () => m.close() }, '\u2715')),
      el('div', { class: 'body qrwrap' }, box, el('div', { class: 'qrcap' }, 'よみとって あそぶ \u2022 ', el('b', {}, TM.deck.label()))),
      el('footer', {}, el('div', { class: 'linkbox' }, out, copy), el('button', { class: 'tm-btn primary', onclick: () => m.close() }, 'おわり')));
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
  /* the title types itself once; the caret blinks a few times and goes */
  const typed = document.getElementById('typed'), caret = document.getElementById('caret'), full = typed.textContent;
  if (!still) {
    typed.textContent = ''; let n = 0;
    const tick = () => { typed.textContent = full.slice(0, ++n); if (n < full.length) setTimeout(tick, 55 + Math.random() * 60); };
    setTimeout(tick, 350);
  } else caret.remove();
  caret.addEventListener('animationend', () => caret.remove());
  refresh();
  const ready = document.fonts ? Promise.race([document.fonts.load(D.FONT_WORD(30)), new Promise((r) => setTimeout(r, 1200))]) : Promise.resolve();
  ready.then(() => requestAnimationFrame(frame));
})();
