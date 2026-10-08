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
    gentle: { target: 0.88, lo: 0.40, hi: 0.85, up: 0.030, load0: 0.30, cps0: 1.5, react0: 1.6 },
    normal: { target: 0.78, lo: 0.55, hi: 1.10, up: 0.040, load0: 0.40, cps0: 2.1, react0: 1.2 },
    turbo: { target: 0.62, lo: 0.75, hi: 1.45, up: 0.055, load0: 0.50, cps0: 2.8, react0: 0.9 },
  };

  class Adapt {
    constructor(diff, opts) {
      this.mode = MODES[diff] || MODES.normal; this.diff = MODES[diff] ? diff : 'normal';
      const m = this.mode;
      this.down = m.up * m.target / (1 - m.target);          // equilibrium success rate == target
      this.load = m.load0; this.cps = m.cps0; this.react = m.react0;
      this.words = 0; this.ok = 0; this.bad = 0; this.streak = 0; this.slump = 0; this.succ = m.target; this.keys = 0; this.miskeys = 0;
      this.minCps = 0.7; this.maxCps = 9;
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
      this.words++;
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
    get factor() { return U.lerp(this.mode.lo, this.mode.hi, this.load); }
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
