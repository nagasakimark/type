# Handoff notes (for the next AI)

Site: static, GitHub Pages https://nagasakimark.github.io/type/ (repo nagasakimark/type, branch main). Read README.md and
shared/game.js (TM.game framework). Games: word-jumper, word-ninja, star-sweep, turbo-type (three.js, shared/vendor),
ink-rush. Kenney CC0 art lives in assets/kenney/<game>/ (full packs unzipped only in the old cloud session; the owner has
the zips in D:\Programming\typingmaster\kenney_*.zip). Real word data: data/words.js (built by tools/build_words.py from
data/vocab-source, which is gitignored; NEVER modify D:\Programming\skribbl\assets\vocab).

## Done this session (all pushed)
Real word lists + deck pictures; six games rebuilt with Kenney art and full-bleed widescreen; hub + textbook picker redesign;
Turbo Type 3D circuits with jumps and new engine audio; Word Ninja synth sfx; Word Jumper adaptive speed/bullet-time;
Star Sweep visibility/banner fixes; Ink Rush message manager; Rooftop Rascal DISABLED (hub card removed, page shows
"ちょっと おやすみ中"; code kept in rooftop-rascal/). Hub title is one line.

## NOT done - owner's latest requests (do these next, in this order)
1. Star Sweep BUG: on reaching sector/level 2 targeting stopped working for a while (stale lock/typer/enemy/input gate
   from level 1?). Reset lock-on, typer, enemies, bullets and input gates at every wave/sector boundary; add a regression bot.
2. Star Sweep upgrades: add real weapon progression (twin -> spread -> MINIGUN mowing down crowds with splash -> homing
   missiles -> beam), wingmen, upgrade drops, big dopamine moments, HUD weapon tier.
3. Ink Rush: stage 2 (harbour) has shipping containers floating on water - put them on quays, boats/buoys on water. Camera
   walks a straight line: add spline route with turns, elevation, arenas, set pieces per stage.
4. Textbook picker (shared/ui.js): first-row covers are cut off at the top; opened-book modal feels small and tiles huge -
   make modal ~92% viewport, dense tiles, no wasted space, covers fully visible at real aspect.
5. Make the WHOLE UI Japanese (hiragana/katakana, elementary kanji <= grade 4) and remove confusing options (keep volume,
   hint toggle, maybe 3-level difficulty). Baloo/Lexend fonts lack kana: add a Japanese rounded font (OFL, self-hosted).
   Applies to hub, shared framework screens and every game's own strings.
6. Progress tracking: per deck per game "cleared" in localStorage (hook framework g.end), show % per textbook, cleared
   state per category, which games cleared it, on hub/picker/results.
7. Results screens, how-to-play and title screens: overlap/scrolling, Play button cut off on small viewports. Redesign in
   shared/game.js + tm.css to fit 800x500..3440x1440 without scrolling (pinned footer buttons).
8. Rooftop Rascal remains disabled until the owner says otherwise.
Also: shared g.wordDone still creates popups; other cosmetic items in earlier agent reports (Word Ninja heavy combo paths
untested, no real-GPU frame-rate measurement anywhere - test on a school laptop).

## Working method that worked
Playwright (chromium preinstalled; swiftshader flags for turbo-type) against `python3 -m http.server`; a smoke script that
loads each game at 1920x1080 and 3440x1080 and prints console errors; per-game agents with a shared brief; commit and push
after every agent returns so work can't be lost.


## Handoff update (latest session)
Done: Star Sweep targeting fix; TM.Adapt rubber-band in all 5 games (shared/adapt.js, Gentle/Normal/Turbo = target success + push + pace); Word Jumper hero picker + zombie unlock (tools/make_heroes.py); Word Ninja flood fix; Teacher QR modal; Japanese UI everywhere (hub, framework, all games; font subset rebuilt via assets/fonts/build-subset.py with subset-chars.txt; check new UI kanji exist in that file); fit-to-window title/results/how-to via TM.ui.fit; progress tracking (TM.progress) on picker/results/hub.
Dev tools: ?speed=N, ?bot=cps,err,think; tools/sim.py <game> <diff> <cps> <err> <think> [wall] [speed]; star-sweep/_dev/regress_targeting.py.
Also done: Ink Rush route (INK.ROUTES: bends + hills via INK.sx/gy/sy and INK.setCam; harbour quay with water slips, boats/buoys on water, arches + landmarks per stage); Star Sweep weapon tiers (power meter S.energy -> S.tier, splash via SS.W.TIERS letter/final, upgrade + wingman drops, HUD panel, tier-up banner; dev hooks __ssDev.tier(n)/drones(n)); textbook picker sizing for 800x500..3440x1440.
Still open: Word Ninja heavy combo paths untested; real-GPU frame rate; shared g.wordDone popups; Ink Rush paint-layer slices look slightly stair-stepped on tight bends; Star Sweep weapons not yet balance-tuned beyond one sim (load pins at 1 for good typists). Rooftop Rascal stays disabled.

## Latest fixes (2026-10-09)
- Turbo Type: retry froze because setupRace reused stale state `S` (podium camera flags); now a fresh `S` per race.
- Scaling (all games): TM.ui.fit measured modal cards mid pop-in animation (scaled) -> now uses offsetWidth/Height, and refits on load/fonts/fullscreen/visualViewport/resize + a 500ms safety interval. Title refit on every show.
- Ink Rush: the "team" picker is replaced by a free two-colour picker (INK.PALETTE, 8 colours; stored as ink.c1/ink.c2; the two are always different). It lives inside the title column under the word-list row, so it cannot cover the play button. INK.buildStage accepts a [hex,hex] pair.
