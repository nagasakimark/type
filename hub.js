/* Typing Master - the Arcade hub: six cabinets, the word-list picker, settings, teacher links. */
(function () {
  'use strict';
  const TM = window.TM, C = TM.C, D = TM.draw, P = D.P, A = TM.art, U = TM.U, el = TM.ui.el;

  const fakeTyper = (t, pos = 0) => { const ty = new TM.Typer({ t, hint: '', len: t.length }); for (let i = 0; i < pos; i++) ty.feed(ty.nextReq()); return ty; };

  const GAMES = [
    {
      id: 'word-jumper', name: 'Word Jumper', c: C.jumper, tag: 'Start here!',
      desc: 'Hop Pip the frog over logs, sandcastles and snowmen. One word at a time.',
      preview(ctx, t, w, h) {
        ctx.fillStyle = '#9BE0FF'; ctx.fillRect(0, 0, w, h);
        D.hills(ctx, 250, 22, 90, '#7ACB68', t * 60, w, h);
        ctx.fillStyle = '#6CCB3C'; ctx.fillRect(0, 320, w, 20); ctx.fillStyle = '#B9824F'; ctx.fillRect(0, 340, w, 60);
        ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.moveTo(0, 320); ctx.lineTo(w, 320); ctx.stroke();
        const ph = (t * 0.5) % 1, lx = 560 - ph * 520;
        const air = lx < 300 && lx > 120 ? Math.sin(((300 - lx) / 180) * Math.PI) : 0;
        D.sticker(ctx, P.rr(lx - 50, 250, 100, 72, 26), '#B07A45', { x: lx - 50, y: 250, w: 100, h: 72 });
        D.eyes(ctx, lx - 6, 282, 7, air > 0 || lx < 150 ? 'happy' : 'grumpy', -0.6, 0, 1.4);
        A.frog(ctx, 180, 282 - air * 150, 0.8, { mood: 'normal', mouth: air ? 'grin' : 'smile' });
        D.chip(ctx, Math.max(lx, 160), 190 - air * 10, fakeTyper('soccer', lx < 300 ? 6 : Math.floor(ph * 10)), { size: 36, accent: C.jumper });
      },
    },
    {
      id: 'word-ninja', name: 'Word Ninja', c: C.ninja, tag: 'Food words!',
      desc: 'Fruit flies up from the counter. Type its word to slice it before it falls.',
      preview(ctx, t, w, h) {
        ctx.fillStyle = '#FCE8C8'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#E8C9A0'; for (let i = 0; i < 8; i++) ctx.fillRect(i * 90, 0, 6, h);
        const kinds = ['watermelon', 'orange', 'apple'];
        kinds.forEach((k, i) => {
          const ph = (t * 0.45 + i * 0.33) % 1;
          const x = 150 + i * 170, y = 420 - Math.sin(ph * Math.PI) * 330;
          if (ph > 0.55 && i === 1) { A.fruit(ctx, x - 30 - (ph - 0.55) * 100, y, 46, { kind: k, half: -1, rot: -ph }); A.fruit(ctx, x + 30 + (ph - 0.55) * 100, y, 46, { kind: k, half: 1, rot: ph }); }
          else { A.fruit(ctx, x, y, 46, { kind: k, rot: Math.sin(t + i) * 0.3 }); D.chip(ctx, x, y - 82, fakeTyper(['melon', 'orange', 'apple'][i]), { size: 30, accent: C.ninja }); }
        });
      },
    },
    {
      id: 'star-sweep', name: 'Star Sweep', c: C.sweep, tag: 'Space!',
      desc: 'Sweep grumpy space junk with sparkle shots before it reaches the station.',
      preview(ctx, t, w, h) {
        ctx.fillStyle = '#231B4D'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { ctx.globalAlpha = 0.3 + (i % 3) * 0.25; ctx.fillRect((i * 97) % w, ((i * 53 + t * 40 * (1 + (i % 3))) % h), 3, 3); } ctx.globalAlpha = 1;
        const jy = 60 + ((t * 40) % 140);
        A.junk(ctx, 200, jy, 46, { kind: 'can', rot: t * 0.5, color: '#FFB3C7' });
        A.junk(ctx, 450, jy - 40, 52, { kind: 'rock', rot: -t * 0.3, seed: 3 });
        D.chip(ctx, 200, jy + 74, fakeTyper('rabbit', 3), { size: 28, accent: C.sweep, locked: true });
        D.chip(ctx, 450, jy + 34, fakeTyper('panda'), { size: 28, accent: C.sweep });
        A.ship(ctx, 320, 340, 0.85, { t });
        ctx.strokeStyle = '#FFE066'; ctx.lineWidth = 6; ctx.lineCap = 'round'; const k = (t * 3) % 1; ctx.beginPath(); ctx.moveTo(320 - k * 120 * 0.8, 290 - k * (230 - jy)); ctx.lineTo(320 - (k + 0.15) * 120 * 0.8, 290 - (k + 0.15) * (230 - jy)); ctx.stroke();
      },
    },
    {
      id: 'turbo-type', name: 'Turbo Type', c: C.turbo, tag: 'Race!',
      desc: 'Your kart goes as fast as you type. Beat three rivals and your own ghost.',
      preview(ctx, t, w, h) {
        ctx.fillStyle = '#7ACB68'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#5B5670'; ctx.fillRect(0, 60, w, 250); ctx.fillStyle = '#fff';
        for (let i = 0; i < 12; i++) ctx.fillRect(((i * 80 - t * 300) % 960 + 960) % 960 - 80, 182, 44, 8);
        for (let i = 0; i < 20; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#FF5A5F'; ctx.fillRect(((i * 40 - t * 300) % 800 + 800) % 800 - 40, 48, 40, 12); ctx.fillRect(((i * 40 - t * 300) % 800 + 800) % 800 - 40, 310, 40, 12); }
        A.kart(ctx, 330 + Math.sin(t * 2) * 40, 120, 0.9, { color: '#2F9BFF' });
        A.kart(ctx, 380 + Math.sin(t * 1.5 + 1) * 30, 250, 0.9, { color: C.turbo, flame: true });
        ctx.fillStyle = 'rgba(31,26,61,0.85)'; ctx.fill(P.rr(20, 330, w - 40, 56, 20));
        ctx.font = D.FONT_WORD(30); ctx.textBaseline = 'middle'; ctx.fillStyle = C.turbo; ctx.fillText('I went to', 44, 359); ctx.fillStyle = '#fff'; ctx.fillText(' the zoo.', 44 + ctx.measureText('I went to').width, 359);
      },
    },
    {
      id: 'rooftop-rascal', name: 'Rooftop Rascal', c: C.rascal, tag: 'Sneaky!',
      desc: 'Leap Rascal the raccoon across night rooftops and grab snacks before sunrise.',
      preview(ctx, t, w, h) {
        const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1E2A5C'); g.addColorStop(1, '#4B3F8F'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#FFF3B0'; ctx.beginPath(); ctx.arc(520, 70, 40, 0, 7); ctx.fill();
        for (const [x, y0, bw] of [[20, 260, 200], [300, 220, 170], [520, 280, 160]]) { D.sticker(ctx, P.rr(x, y0, bw, h - y0 + 20, 10), '#3A3566', { x, y: y0, w: bw, h: 200 }); ctx.fillStyle = '#FFD86B'; for (let i = 0; i < 3; i++) ctx.fill(P.rr(x + 24 + i * 50, y0 + 40, 26, 34, 6)); }
        const ph = (t * 0.6) % 1, x = 120 + ph * 300, y = 240 - Math.sin(ph * Math.PI) * 120 - ph * 40;
        A.raccoon(ctx, x, y - 30, 0.75, { t, run: true });
        D.chip(ctx, 385, 180, fakeTyper('library', ph > 0.5 ? 7 : Math.floor(ph * 14)), { size: 28, accent: C.rascal });
        ctx.fillStyle = '#FF9EC4'; ctx.beginPath(); ctx.arc(600, 230, 14, 0, 7); ctx.fill();
      },
    },
    {
      id: 'ink-rush', name: 'Ink Rush', c: C.ink2, tag: 'Splat!',
      desc: 'Splat the sleepy grey Gloops with colour ink and paint the whole town.',
      preview(ctx, t, w, h) {
        ctx.fillStyle = '#C9C6D6'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#B2AEC4'; ctx.fillRect(0, 250, w, 150);
        ctx.fillStyle = C.ink2; ctx.fill(P.blob(140, 120, 60, 2, 0.25, 10)); ctx.fillStyle = C.lime; ctx.fill(P.blob(520, 300, 70, 5, 0.25, 10));
        const ph = (t * 0.5) % 1;
        A.gloop(ctx, 220, 260, 0.9, { t, mood: 'sleepy' });
        A.gloop(ctx, 440, 230, 0.7, { t: t + 1, mood: ph > 0.6 ? 'happy' : 'sleepy', color: ph > 0.6 ? C.ink2 : '#9C98AE' });
        D.chip(ctx, 220, 150, fakeTyper('rainy'), { size: 28, accent: C.ink2 });
        if (ph < 0.6) D.chip(ctx, 440, 145, fakeTyper('cloudy', Math.floor(ph * 11)), { size: 28, accent: C.ink2, locked: true });
      },
    },
  ];

  /* ---------- header controls ---------- */
  const deckLabel = el('span'), deckImg = el('img', { alt: '', onerror: function () { this.style.display = 'none'; } });
  const deckBtn = el('button', { class: 'tm-btn tm-deckbtn', onclick: () => TM.ui.picker('', () => { refresh(); }) }, deckImg, deckLabel, el('span', { style: { opacity: 0.6 } }, '▾'));
  document.getElementById('controls').append(
    el('span', { style: { font: '700 18px var(--word)', color: '#fff' } }, 'Words:'), deckBtn,
    el('button', { class: 'tm-btn', onclick: teacher }, 'Teacher link'),
    el('button', { class: 'tm-btn icon', title: 'Settings', onclick: () => TM.ui.settings() }, '⚙'));

  /* ---------- cabinets ---------- */
  const grid = document.getElementById('grid');
  const cabs = GAMES.map((gm) => {
    const cv = el('canvas', { width: 640, height: 400 });
    const stars = el('div', { class: 'stars' });
    const a = el('a', { class: 'cab', style: { '--c': gm.c }, href: gm.id + '/index.html' },
      el('div', { class: 'screen' }, cv, el('span', { class: 'tag' }, gm.tag)),
      el('div', { class: 'info' }, el('h2', {}, gm.name), el('p', {}, gm.desc), el('div', { class: 'row' }, stars, el('span', { class: 'go' }, 'Play ▶'))));
    a.style.setProperty('--c', gm.c);
    a.addEventListener('pointerenter', () => TM.sfx.click());
    grid.append(a);
    return { gm, a, cv, ctx: cv.getContext('2d'), stars };
  });

  function refresh() {
    const ids = TM.deck.ids();
    deckLabel.textContent = TM.deck.label(ids);
    const d = TM.data.decks[ids[0]];
    if (d && d.image) { deckImg.style.display = ''; deckImg.src = d.image; } else deckImg.style.display = 'none';
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

  /* ---------- animation ---------- */
  const kipC = document.getElementById('kip').getContext('2d');
  let t0 = performance.now();
  function frame(now) {
    const t = (now - t0) / 1000;
    for (const c of cabs) {
      const r = c.cv.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      c.ctx.save(); c.ctx.clearRect(0, 0, 640, 400); c.gm.preview(c.ctx, t, 640, 400); c.ctx.restore();
    }
    kipC.clearRect(0, 0, 240, 240);
    A.kip(kipC, 120, 132, 1.6, { t, wave: true, accent: C.gold });
    requestAnimationFrame(frame);
  }
  const ready = document.fonts ? Promise.race([document.fonts.load(D.FONT_WORD(30)), new Promise((r) => setTimeout(r, 1200))]) : Promise.resolve();
  ready.then(() => { refresh(); requestAnimationFrame(frame); });
})();
