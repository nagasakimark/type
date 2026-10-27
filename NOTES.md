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

## Star Sweep final boss + Cat Defenders (2026-10-09)
- Star Sweep: the last-sector boss (メガクロス) sprite was taller than the playfield, so its top edge never entered the safe zone, it never became "seen"/targetable and no word showed. spawnBoss now shrinks oversized bosses to fit and updateBoss forces `seen` after the fly-in.
- NEW GAME Cat Defenders (`cat-defense/`, id `cat-defense`, registered in shared/core.js TM.GAMES/TM.progress and hub.js). Art = CraftPix "Cartoon Cat Defense" kit (owner has the zip in D:\Programming\typingmaster); `tools/build_catdef.py <extracted kit folder>` packs it into assets/catdef/*.webp (+ manifest.js, 5 area jpgs; ~2.5 MB; no sheet > 4096px).
  Design (v2 rework, same day, after the owner called v1 "boring: upgrades do nothing, zombies die before bullets arrive"): 5 lanes x 2 cat slots (slot 8 = the trash icon baked into the art: drag a cat there to sell for 60%). Combat is REAL: every shot is a bullet that homes on its target and damage is applied on arrival; zombies have HP (hpBase(w)=26*1.62^w x type mult x word length) and HP bars (white = damage already in flight; shooters skip zombies that incoming bullets already kill). A lane with no cats does nothing (its chips are dimmed with a cat-x icon; early waves only spawn in covered lanes, later 22% probe empty lanes).
  Cats: dmg = 10 * 2.5^(lvl-1) (+20%/Power upgrade), so a merge is a big jump; perks: lvl5 pierce (chains to next zombie in lane 65%), lvl9 splash, lvl13 big splash; chevron badge tiers Up0-3 + level number. Auto fire is only 30% damage every ~2.4s; TYPING is the engine (~85% of damage in sims): every correct letter fires every cat in that lane (x combo mult 1..1.75), a finished word fires a x3 heavy volley with knock-back, then a surviving zombie gets a fresh word (tanks need several words). Bosses: HP bar, whole army fires on them per letter, sentence completion = heavy volley + stun, phases at 67%/33% call minions, cats in empty lanes auto-fire at a boss.
  Shop: between waves 4 permanent upgrades x5 levels (はやうち AddonIcon1, パワー 3, コイン 2, かべ WallIcon; keys F/D/C/W) + add-on stock up to 5 each (トゲ spikes 8, ボクシング 7, TNT 6, ガーディアン 5; keys S/B/T/G in build, 6/7/8/9 in fight, buttons bottom right like the kit's screenshot). Spikes: slow + dmg ticks on a lane (26 hits); boxing cat runs to the front zombie and punches for 8s; TNT hits everything on screen; guardian auto-triggers under 25% wall (or key 9). Perfect words streak (7) gifts a random add-on. Cats can be bought during fights (keys 1-5/Space is typing there), Backspace = merge-all, 0 = repair, Enter = TNT.
  Controls in build: Space buy, 1-5 buy into lane, M merge (never empties a lane), R repair, X sell selected, drag/click cats to merge/move/sell. Prices 24+5n (cap 115), repair 35+4w.
  Balance (tools/sim.py cat-defense normal <cps> ...; normal): 3 cps/3% errors wins with ~50% wall, 2 cps loses at the wave 9 boss, 1.3 cps loses around wave 8-9, an idle player dies by wave 3-4; Gentle wins at 1.2 cps. Constants in BAL at the top of game.js (dmg0, dmgG, hp0, hpG, boss, ivBase, autoMul, finMul). Final wave = 2 bosses (types 4 and 6) with 0.6x HP each.
  Rubber band: TM.Adapt drives zombie speed (clamp 26..185 px/s image space) and spawn interval; wall HP 140/110/90 by Gentle/Normal/Turbo, zombie HP x0.85/1/1.15.
  Geometry: everything is in "image space" 2143x1062 (the area art); frame(g) maps it to the 1920x1080 stage, cropping up to 150px from the left only. Wall HP bar baked into the art is overpainted by drawWallBar.
  Dev: ?dev=1 -> window.CDDev (state, goto(wave), coins, god, start, buy, merge, tnt, use(id), buyUp(id), buyAdd(id), stock({}), auto(cps,err,think), slot(i,lvl), S()); ?bot=cps,err,think and tools/sim.py cat-defense normal 3 0.05 0.6 300 5 work (the bot buys/merges/upgrades/uses add-ons itself).
  Not done / ideas: level-select map / daily bonus / gems shop screens from the kit are deliberately not used; per-area enemy variety; balance pass with real kids; sound effects are shared synth sfx only.

## Junior high + school levels (2026-10-13)
- NEW BOOKS New Horizon 1/2/3 (`nh1`-`nh3`, `assets/books/nh*.jpg`, `tint` colours for picture-less tiles), built by `tools/build_jhs.py` from `data/jhs-source/nh-tango-database.xlsx`. Every book now has `level` ('es'|'jhs') and `years`; `TM.level(book)` (core.js) gives the Japanese labels (小学3年, 小学5・6年, 中学1年 ...). Mapping: Let's Try 1/2 = 小3/小4, NH5/NH6 = 小5/小6, Picture Dictionary = 小5・6, NH1/2/3 = 中1/2/3.
- Picker (shared/ui.js `renderBooks`, tm.css `.tm-shelf`): two shelves 小学校 | 中学校 (side by side, stacked on narrow screens), year pill on each cover and in the deck header; hub bar shows e.g. 中学2年 ・ New Horizon 2.
- JHS unit decks have no title (unit titles are not in the spreadsheet); Unit 0 uses `unit: null` because `unit === 0` means "All" for elementary decks. Section names RLE/GfC are shown as in the database (meaning not in the data); rename in `EXTRAS` if wanted. JHS decks have almost no key sentences, so the hardest tier uses multi-word phrases (Dealer fallback in core.js).
- `TM.ui.el` now sets CSS custom properties with setProperty (the per-game clear dots in the picker used `--c` and were not coloured before).
- Font subset rebuilt with ~680 more kanji (+110 KB per weight).

## Japanese -> English mode + 2025 unit titles (2026-10-13)
- `TM.mode()` ('en' | 'ja2en'; setting `mode`, link `?mode=ja2en`). Toggle on hub, on every title screen (shared/game.js `modeSeg`), in the teacher QR dialog. `TM.deck.key()` gets a `~jp` suffix so records/stars are per mode; progress (cleared decks) is shared.
- Rendering: `D.chip` / `D.chipSize` (shared/draw.js) switch to a two-line chip (Japanese `item.q`, blanks below) when the mode is on; turbo-type draws its own panel (Japanese pill above, blanks in the panel). `g.hint` (the old Japanese pill) is forced off in this mode.
- Hints: `TM.hint` (core.js): level 0..3 = max(idle time since the last correct key, restarted per word when first drawn; wrong keys on that word; Tab/💡 presses). Time = game clock (`TM.hint.tick` in the framework loop). `Typer.assist` records the highest level showing when a correct key was typed; `g.wordDone` halves points / no combo / tricky list when assist >= 2. Title-screen demos show level 3.
- `item.q` (makeItem): kana, plus the kanji in brackets when the kana is 1-2 chars (ひ（火）). `TM.pool` in this mode drops items without Japanese and keeps one English word per question text.
- Game pace is x0.8 in this mode (`g.speedMul`); TM.Adapt still rubber-bands on top.
- NH1-3 unit titles are the 2025 (R7) editions (`UNIT_TITLES` in tools/build_jhs.py, with sources in the comment); RLE = "Real-life English" (per the owner). `deck.abbr` is the short tag on picture-less tiles.
- Not done / ideas: per-mode 'cleared' ticks; speech uses the browser voice (quality varies on Chromebooks); synonyms are not accepted (one English word per Japanese question).

## Easier by default + comebacks + growth feedback (2026-10-13)
Owner: a 3rd-year JHS student struggled on the race and wanted to give up; students should feel they are improving, not failing.
- DEFAULT difficulty is now Gentle (core.js DEFAULTS; a one-time migration `settings.dv = 2` resets old saves that held the untouched default 'normal'). `TM.ADAPT_MODES` retuned much lower (adapt.js): gentle cps0 1.0 / demand factor 0.28-0.66, normal cps0 1.4 / 0.42-0.90. A new Adapt starts at 0.9 x the student's own median speed from `TM.stats.cps(game)` (their last runs), and `Adapt.relief` (0..1, fades 0.1/word) plus a "slump" term slow demand further.
- SECOND WIND (`g.secondWind()` in shared/game.js): once per run, not in Turbo, the first time a run would be lost the game refills (Ninja hearts + ice, Jumper hearts, Star Sweep hull/shield/slow, Cat wall 60% + zombies pushed back, Ink Rush tank + ultra) and shows "セカンドチャンス". Turbo Type has no game over; finishing any place counts as a clear except in Turbo mode.
- Per-game softening: Ninja 6/4/3 hearts, slower fruit (perWord), mercy cap 0.8; Jumper 6/4/3 hearts, slower run + longer grace at words; Star Sweep enemy fire interval x1.9 / x1.3 and slower when the coach's struggle meter is high; Cat Defenders wall 210/150, zombies x0.8/x0.9 speed (and -30% at high struggle), wall hits x0.6/x0.8; Ink Rush smaller damage; Turbo Type rivals follow the student's own average pace (x0.78 / 0.88 / 1.05), the high WPM floor is gone, a rival far AHEAD eases off hard (down to x0.45), the student's catch-up boost is 0.22 / 0.15 / 0.07 and scales with the gap, nitro charges 1.5x / 1.25x faster.
- COACH (`shared/coach.js`): `TM.stats` (localStorage 'tm.stats': per-word n / errors / clean streak / ms per letter / lost / hard / fix, last 80 runs, days practised) and `TM.coach` (per-session struggle meter 0..6). A word is HARD after 2+ wrong keys, a helped finish (Japanese mode hint level 2+) or after it got away; two clean finishes in a row clear it. The first clean finish of a hard word = "redeem" gift; a struggle >= 3 followed by a decent word = "comeback" gift (16 s cooldown). Games opt in with `def.gift(g, {kind, item, struggle})` returning a Japanese label (or null): Ninja heart + ice, Jumper heart / shield + relief, Star Sweep shield + repair + slow, Turbo free nitro, Cat Defenders wall heal + slow + add-on, Ink Rush ink + ultra. `TM.Dealer` serves hard words 30% of the time.
- Results screen: "きょうの せいちょう" box (`TM.coach.finish`): faster / fewer mistakes / more words / personal best / learned a hard word / mastered (3 clean in a row) / streak / always something encouraging, plus a small next goal. Hub button "📈 きろく" shows streak, mastered words, tricky words and a 7-day bar chart.
- Balance harness: `tools/balance.py games diffs skills [wall] [speed] [deck]` plays whole games with the dev bot (cps:err:think). Before: Ninja normal weak lost in 35 s, Jumper weak lost at stage 4. After: weak/mid/strong bots finish Ninja on both Gentle and Normal.
- Ideas not done: per-student history for Turbo's rival ghost; teacher view of class stats (stats are per browser only).

## Homepage redesign (2026-10-27)
Owner: the original arcade page "looks exactly how AI styles every website" and the ARCADE title was convoluted. First attempt (light page, keycap letters, mascot) was rejected: "I liked the grid of games with larger thumbnails and the darker theme. Just less generic. The mascot sucks, so do the letter logos."
- index.html is now a chalkboard: board green #1D2B28, chalk white type, dust #A5B7AE for secondary text, gold stars. No mascot, no letter keys, no cards, no outlines or shadows. Lexend only (Japanese from the bundled M PLUS Rounded).
- Layout: title (types itself once, caret blinks 4x then goes; static with reduced motion) + text links きろく / 先生用 QR / せってい; one slim setup bar (current deck with かえる, two あそびかた options); then a grid of large 16:9 screenshots, name + stars + one line under each. Hovering a game dims the others (not on phones).
- hub.js: GAMES entries no longer have tag/like; Kip mascot canvas code removed from the hub (Kip is still used inside the games).
- v3 (same day): background changed to deep ocean blue (#0E2740, panels #153454), each game sits in its own bordered panel, and a new home-page mascot (inline SVG in index.html, a yellow keycap character with a blinking cursor antenna, blinking eyes, and a small bounce on each typed letter of the title). Home page only; the in-game Kip art is unchanged.
