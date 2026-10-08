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
