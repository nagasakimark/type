# Typing Master

Typing games for elementary and junior-high students, using the **New Horizon 1–6**, **Let's Try 1 & 2** and **My Picture Dictionary** word lists.

The word-list picker shelves the books by school level:

| Level | Book | Year |
| --- | --- | --- |
| 小学校 | Let's Try 1 / Let's Try 2 | 小学3年 / 小学4年 |
| 小学校 | New Horizon 5 / New Horizon 6 | 小学5年 / 小学6年 |
| 小学校 | My Picture Dictionary | 小学5・6年 |
| 中学校 | New Horizon 1 / 2 / 3 | 中学1年 / 2年 / 3年 |
(levels live in `tools/build_jhs.py` `LEVELS`)

Open `index.html` (the Arcade) and pick a game. Every page also works when opened straight from disk.

| Game | Folder | Based on |
| --- | --- | --- |
| Word Jumper | `word-jumper/` | Word Jumper |
| Word Ninja | `word-ninja/` | Fruit Ninja, typing style |
| Star Sweep | `star-sweep/` | ZType |
| Turbo Type | `turbo-type/` | Nitro Type |
| Rooftop Rascal | `rooftop-rascal/` | Rebellious Robot |
| Ink Rush | `ink-rush/` | The Typing of the Dead, Splatoon style (no killing) |
| Cat Defenders | `cat-defense/` | Lane defence with real bullets: typing makes the cats fire, coins buy/merge cats, upgrades and add-ons (spikes, boxing cat, TNT, guardian) |

## Direct links

Every game takes the word list in the link, so a teacher can send students straight to a unit:

```
word-ninja/index.html?deck=lt2-u7
turbo-type/index.html?deck=nh6-u3,nh6-u7
star-sweep/index.html?deck=nh5-u5&quiet=1
```

Deck ids: `nh5-u1` … `nh5-u8`, `nh6-u1` … `nh6-u8`, junior high `nh1-u0` … `nh1-u10`, `nh2-u0` … `nh2-u7`, `nh3-u0` … `nh3-u6` plus `nh<N>-sal|gfc|sa|lr|rle|wr|plus` (Sounds & Letters, GfC, Stage Activity, Let's Read, RLE, Word Room, extra words not in the Word List), `lt1-u1` …, `lt2-u1` …, `lt2-colors`, `lt2-directions`, `lt1-all`, `lt2-all`, and `pd-<topic>` for Picture Dictionary topics (e.g. `pd-animals`). `quiet=1` starts with sound off. The Arcade's **Teacher link** button builds these for you.

## Updating the words

The original vocab folder (`skribbl/assets/vocab`) is never edited. This project keeps its own copy in `data/vocab-source/`.

1. Copy the vocab folder's contents into `data/vocab-source/` again if the lists changed.
2. Edit key sentences in `tools/sentences.json` if you like (English + Japanese per unit).
3. Run, from this folder:

```
python tools/build_words.py --images "D:/Programming/skribbl/assets/images"
```

This writes `data/words.js` (what the games load) and `data/words.json`, and copies one category picture per deck into `assets/decks/` plus the textbook covers into `assets/books/` (needs `pip install pillow`). Leave out `--images` to rebuild only the words.

### にほんご → えいご mode

A second way to play every game: the chip shows the **Japanese** meaning and one blank per English letter; the student types the English from memory. Switch it on the Arcade (top right), on each game's title screen, or with `?mode=ja2en` in a link (the Teacher QR dialog has a menu for it). Records are kept separately per mode.

Hints grow when a student is stuck (`TM.hint` in `shared/core.js`): level 1 after 5 s without a correct key (or 2 wrong keys on the word) shows the next letter and each word's first letter; level 2 (9 s / 4 wrong keys) about every other letter; level 3 (14 s / 6 wrong keys) the whole answer, faded. **Tab** or the 💡 button raises the level by one (from level 2 it also reads the word aloud with the browser's speech). A word typed while level 2+ was showing is "helped": half points, no combo, and it goes on the 'tricky words' list. Each Japanese meaning appears only once per list, so the answer is unambiguous.

### Junior high (New Horizon 1–3)

Source: Tokyo Shoseki's 単語・連語データベース, kept in `data/jhs-source/nh-tango-database.xlsx`. `tools/build_jhs.py` (also called at the end of `build_words.py`) turns it into the `nh1`–`nh3` books: one deck per unit (sheet ① by 単元/パート; each word appears in the grade where it first occurs), one per non-unit section, and a "Plus" deck from sheet ③. Placeholders such as `...`, `～`, `(…ing)` and `[are]` are removed from what students type; full-sentence phrases become key sentences. Run `python tools/build_jhs.py` to re-merge into the existing `data/words.js` without the elementary vocab source (needs `pip install openpyxl`). The Japanese font subset (`assets/fonts/subset-chars.txt`) also covers the JHS meanings.

### Difficulty, comebacks and progress
Games start on **Gentle** (the old default was Normal) and can be switched on each title screen. Gentle/Normal use a stronger rubber band (the game slows when a student struggles), give **one Second Chance per run** instead of an instant game over, and hand out **comeback gifts** (heart, shield, ice, nitro...) when a student finally gets a word they were struggling with. The results screen shows how the student improved (speed, accuracy, words learned) and the Arcade has a **📈 きろく** page (streak, mastered words, tricky words). Everything is stored in the student's own browser.

## Putting it on GitHub Pages

1. Create a repository (e.g. `typingmaster`) and push this folder to it. `data/vocab-source/` can be left out with a `.gitignore` if you prefer; the games only need `data/words.js`.
2. In the repository: **Settings → Pages → Build and deployment → Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The site appears at `https://<your-username>.github.io/typingmaster/`.

All paths are relative, so it works from a project subfolder. Fonts (Baloo 2, Lexend; SIL Open Font License) are self-hosted in `shared/fonts/`.

## Layout

```
index.html, hub.js     the Arcade
shared/                engine shared by every game (typing, words, chip, fx, audio, UI, art)
<game>/index.html      each game page
<game>/game.js         that game's rules and art
data/words.js          generated word data
tools/                 build script + key sentences
assets/decks, books    deck pictures and textbook covers
```
