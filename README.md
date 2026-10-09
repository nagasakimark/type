# Typing Master

Six typing games for elementary students, using the **New Horizon 5 & 6**, **Let's Try 1 & 2** and **My Picture Dictionary** word lists.

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

Deck ids: `nh5-u1` … `nh5-u8`, `nh6-u1` … `nh6-u8`, `lt1-u1` …, `lt2-u1` …, `lt2-colors`, `lt2-directions`, `lt1-all`, `lt2-all`, and `pd-<topic>` for Picture Dictionary topics (e.g. `pd-animals`). `quiet=1` starts with sound off. The Arcade's **Teacher link** button builds these for you.

## Updating the words

The original vocab folder (`skribbl/assets/vocab`) is never edited. This project keeps its own copy in `data/vocab-source/`.

1. Copy the vocab folder's contents into `data/vocab-source/` again if the lists changed.
2. Edit key sentences in `tools/sentences.json` if you like (English + Japanese per unit).
3. Run, from this folder:

```
python tools/build_words.py --images "D:/Programming/skribbl/assets/images"
```

This writes `data/words.js` (what the games load) and `data/words.json`, and copies one category picture per deck into `assets/decks/` plus the textbook covers into `assets/books/` (needs `pip install pillow`). Leave out `--images` to rebuild only the words.

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
