/* Word Ninja - Kenney ogg samples through our own AudioContext (lazy, silent on failure). */
(function () {
  'use strict';
  const WN = (window.WN = window.WN || {});
  const NAMES = ['squelch1', 'squelch2', 'swish1', 'swish2', 'swish3', 'poof', 'thud', 'frenzy', 'golden', 'freeze', 'crack', 'split', 'combo', 'whoopdown', 'ding'];
  let ctx = null, bus = null, loading = false;
  const bufs = {};
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); bus = ctx.createGain(); bus.connect(ctx.destination); } catch (e) { ctx = null; }
    return ctx;
  }
  function loadAll() {
    if (loading || !ctx) return; loading = true;
    for (const n of NAMES) {
      fetch('../assets/kenney/word-ninja/sfx/' + n + '.ogg').then((r) => r.arrayBuffer())
        .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
        .then((b) => { bufs[n] = b; }).catch(() => {});
    }
  }
  const go = () => { if (!ensure()) return; if (ctx.state === 'suspended') ctx.resume(); loadAll(); };
  window.addEventListener('keydown', go, { capture: true });
  window.addEventListener('pointerdown', go, { capture: true });
  WN.snd = function (name, o = {}) {
    const vol = (TM.settings.sfx || 0) * (o.vol ?? 0.7);
    if (!ctx || vol <= 0 || !bufs[name]) return;
    const src = ctx.createBufferSource(); src.buffer = bufs[name];
    src.playbackRate.value = (o.rate ?? 1) * (1 + (Math.random() - 0.5) * (o.jitter ?? 0.08));
    const g = ctx.createGain(); g.gain.value = vol; src.connect(g); g.connect(bus);
    src.start(ctx.currentTime + (o.delay || 0));
  };
  WN.sndPick = (arr, o) => WN.snd(arr[Math.floor(Math.random() * arr.length)], o);
})();
