/* Typing Master - adaptive difficulty ("rubber band") shared by every game.

   What it does
   - Measures the player: typing speed (chars/sec while a word is being typed) and reaction time, as moving averages.
   - Keeps a hidden LOAD (0..1). Every success nudges it up, every failure pulls it down harder. The up/down ratio is chosen so
     the player settles at the mode's target success rate (Gentle 90%, Normal 80%, Turbo 68%) - i.e. challenged, never swamped.
   - Hands games a DEMAND: how many characters per second the game may ask for right now (player speed x a factor that grows with
     load). Games turn demand into spawn rates, fall times, speeds, etc. A game should never need more typing per second than demand.

   Gentle / Normal / Turbo are not fixed speeds: they change the target success rate, how far above the player's own speed the game
   may push, how quickly it pushes and how quickly it relents. */
(function () {
  'use strict';
  const TM = window.TM, U = TM.U;

  const MODES = {
    //          target success, demand factor at load 0 .. 1, step up, start load, cps before we know the player, reaction before we know
    gentle: { target: 0.92, lo: 0.28, hi: 0.66, up: 0.030, load0: 0.15, cps0: 1.0, react0: 2.0 },
    normal: { target: 0.84, lo: 0.42, hi: 0.90, up: 0.035, load0: 0.30, cps0: 1.4, react0: 1.5 },
    turbo: { target: 0.68, lo: 0.65, hi: 1.30, up: 0.050, load0: 0.45, cps0: 2.2, react0: 1.0 },
  };

  class Adapt {
    constructor(diff, opts) {
      this.mode = MODES[diff] || MODES.normal; this.diff = MODES[diff] ? diff : 'normal';
      const m = this.mode;
      this.down = m.up * m.target / (1 - m.target);          // equilibrium success rate == target
      this.load = m.load0; this.cps = m.cps0; this.react = m.react0;
      this.words = 0; this.ok = 0; this.bad = 0; this.streak = 0; this.slump = 0; this.succ = m.target; this.keys = 0; this.miskeys = 0;
      this.minCps = 0.5; this.maxCps = 9;
      /* a student who has played before starts near their own speed, not at the guess (their median run, a little under) */
      try { const h = TM.stats && TM.stats.cps(opts && opts.game); if (h) this.cps = U.clamp(h * 0.9, 0.6, Math.max(m.cps0, 3)); } catch (e) { /* no history */ }
      this.relief = 0;   // 0..1 extra mercy a game (or the coach) can grant for a while: slows demand
      Object.assign(this, opts || {});
    }
    /* a word was typed to the end.
       len = typed characters, dur = seconds from first to last key, errors = wrong keys on it,
       react = seconds from the word being available to the first key (optional),
       cycle = seconds the player was 'busy' with this word incl. thinking/hunting (since the previous word was finished, or since
               this one became available, whichever is later). When given, speed is measured from this, so the demand we ask for
               matches REAL throughput and not just burst speed. (optional)
       margin = fraction (0..1) of the word's time budget still left when it was finished (optional). Finishing with a thin margin
               counts as a near miss, so the band eases off BEFORE the player actually fails. */
    word(len, dur, errors, react, cycle, margin) {
      this.words++; if (this.relief > 0) this.relief = Math.max(0, this.relief - 0.1);   // a gift's relief fades over ~10 words
      const span = cycle != null && cycle > 0.15 ? Math.max(cycle, dur) : dur;
      if (len >= 2 && span > 0.15) {
        let r = len / span; if (errors) r *= 1 / (1 + 0.15 * errors);     // slips cost speed
        const w = this.words <= 6 ? 0.35 : 0.14;
        this.cps = U.clamp(this.cps + (U.clamp(r, this.minCps, this.maxCps) - this.cps) * w, this.minCps, this.maxCps);
      }
      if (react != null && react > 0.05) this.react = U.clamp(this.react + (Math.min(react, 4) - this.react) * 0.18, 0.35, 4);
      const comfy = (margin == null || margin >= 0.22) && errors <= 1;
      if (comfy) this.success(errors ? 0.5 : 1); else this.fail(margin != null && margin < 0.08 ? 0.6 : 0.35);
    }
    key(ok) { this.keys++; if (!ok) this.miskeys++; }
    /* a word / target handled in time (weight 0..1), or lost (fail) */
    success(weight) {
      const w = weight == null ? 1 : weight;
      this.ok++; this.streak++; this.slump = Math.max(0, this.slump - 1);
      this.succ += (1 - this.succ) * 0.12;
      this.load = U.clamp(this.load + this.mode.up * w * (this.streak > 6 ? 1.35 : 1), 0, 1);
    }
    fail(weight) {
      const w = weight == null ? 1 : weight;
      this.bad++; this.streak = 0; this.slump++;
      this.succ += (0 - this.succ) * 0.12;
      // consecutive failures pull harder so a struggling player is rescued fast; a lone slip barely matters
      this.load = U.clamp(this.load - this.down * w * (1 + Math.min(1.5, this.slump * 0.35)), 0, 1);
    }
    /* how many typed characters per second the game may ask for right now */
    get factor() { return U.lerp(this.mode.lo, this.mode.hi, this.load) * (1 - 0.14 * Math.min(3, this.slump) / 3) * (1 - 0.35 * (this.relief || 0)); }   // a slump (recent fails) and relief both slow the game
    get demand() { return this.cps * this.factor; }
    /* seconds a player needs for `chars` characters at the current demand (reaction included) */
    time(chars) { return 0.4 + chars / Math.max(0.5, this.demand); }
    /* handy 0..1 'how hard is it right now' for HUD / music */
    get intensity() { return this.load; }
    /* map load onto a game parameter: lerp(easy, hard, load) */
    pick(easy, hard) { return U.lerp(easy, hard, this.load); }
    summary() { return { load: +this.load.toFixed(2), cps: +this.cps.toFixed(2), react: +this.react.toFixed(2), demand: +this.demand.toFixed(2), succ: +this.succ.toFixed(2), words: this.words, ok: this.ok, bad: this.bad }; }
  }
  TM.Adapt = Adapt;
  TM.ADAPT_MODES = MODES;
})();
