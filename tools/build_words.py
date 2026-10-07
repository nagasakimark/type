#!/usr/bin/env python3
"""
Build Typing Master's word data.

Reads ONLY the project's own copy of the vocab (data/vocab-source/) plus
tools/sentences.json, and writes:

  data/words.js     window.TM_WORDS = {...}   (loaded by every page; works on file:// too)
  data/words.json   same data, for tools / debugging

Optionally (with --images), copies ONE category picture per deck and the
textbook covers from skribbl's image folder, resized, into assets/decks/ and
assets/books/. The source image folder is only read, never written.

Usage (from the typingmaster folder):
  python tools/build_words.py
  python tools/build_words.py --images "D:/Programming/skribbl/assets/images"
"""
import argparse, json, os, re, sys, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "vocab-source")

BOOKS = [
    # (id, decks.json key, display name, short)
    ("nh5", "New Horizon 5", "New Horizon 5", "NH5"),
    ("nh6", "New Horizon 6", "New Horizon 6", "NH6"),
    ("lt1", "Let's Try 1", "Let's Try 1", "LT1"),
    ("lt2", "Let's Try 2", "Let's Try 2", "LT2"),
    ("pd", "My Picture Dictionary", "Picture Dictionary", "PD"),
]

# One picture that shows the whole group at a glance. Paths are relative to
# skribbl/assets/images/categories. Decks not listed use decks.json's image,
# or "<Folder>/<Folder>.jpg" when that group picture exists.
IMAGE_OVERRIDES = {
    "lt1-all": "LT1/All.jpg", "lt2-all": "LT1/All.jpg", "pd-all": "LT1/All.jpg",
    "lt1-u1": "World/World.jpg",
    "lt1-u2": "Feelings/Happy.jpg",
    "lt1-u3": "Numbers/Numbers.jpg",
    "lt1-u4": "Colors/Colors.jpg",
    "lt1-u5": "Food/Food.jpg",
    "lt1-u7": "Shapes/Shapes.jpg",
    "lt1-u8": "Animals/Animals.jpg",
    "lt1-u9": "Animals/Animals.jpg",
    "lt2-u1": "World/World.jpg",
    "lt2-u2": "Weather/Weather.jpg",
    "lt2-u5": "Stationery/Stationery.jpg",
    "lt2-u7": "FruitAndVegetables/Vegetables.jpg",
    "lt2-colors": "Colors/Colors.jpg",
    "nh5-u1": "Subjects/Subjects.jpg",
    "nh5-u2": "Annual Events/Birthday.jpg",
    "nh5-u4": "People/Friends.jpg",
    "nh5-u5": "Town/Town.jpg",
    "nh5-u6": "Food/Food.jpg",
    "nh5-u8": "Jobs/Jobs.jpg",
    "nh6-u1": "People/I.jpg",
    "nh6-u4": "World/World.jpg",
    "nh6-u5": "Clothes/Clothes.jpg",
    "nh6-u6": "Animals/Animals.jpg",
    "nh6-u7": "School Events/School Events.jpg",
    "nh6-u8": "Jobs/Jobs.jpg",
    "pd-fruits-and-vegetables": "FruitAndVegetables/Fruit.jpg",
    "pd-days-of-the-week": "Days of the Week/One Week.jpg",
    "pd-ingredients": "Ingredients/Meat.jpg",
}

DECK_IMG_SIZE = 360
BOOK_IMG_SIZE = 480


def slug(s):
    s = s.lower().replace("&", "and")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def find_file(rel):
    """decks.json paths look like assets/vocab/PD/x.json; match case-insensitively."""
    rel = rel.replace("assets/vocab/", "").strip("/")
    parts = rel.split("/")
    cur = SRC
    for p in parts:
        if not os.path.isdir(cur):
            return None
        names = {n.lower(): n for n in os.listdir(cur)}
        if p.lower() not in names:
            return None
        cur = os.path.join(cur, names[p.lower()])
    return cur if os.path.isfile(cur) else None


def read_items(path):
    with open(path, encoding="utf-8-sig") as f:
        s = f.read()
    if not s.strip():
        return []
    j = json.loads(s)
    return j.get("items", []) if isinstance(j, dict) else j


def typed_form(text):
    """The keys a player must press: letters, digits and spaces, lower-case."""
    t = text.lower()
    t = re.sub(r"[^a-z0-9 ]", "", t)
    return re.sub(r"\s+", " ", t).strip()


def is_letter_entry(text):
    return len(typed_form(text).replace(" ", "")) <= 1


def contains_phrase(sentence, phrase):
    s = " " + typed_form(sentence) + " "
    p = typed_form(phrase)
    return bool(p) and (" " + p + " ") in s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", help="skribbl assets/images folder (read only)")
    args = ap.parse_args()

    decks_meta = json.load(open(os.path.join(SRC, "decks.json"), encoding="utf-8-sig"))
    sentences = json.load(open(os.path.join(ROOT, "tools", "sentences.json"), encoding="utf-8"))
    sentences = {k: v for k, v in sentences.items() if not k.startswith("_")}

    words = {}      # id -> {t, ja, kana}
    decks = {}      # id -> deck
    books = []
    report = []

    for book_id, key, name, short in BOOKS:
        meta = decks_meta.get(key)
        if not meta:
            report.append(f"! book missing in decks.json: {key}")
            continue
        book = {"id": book_id, "name": name, "short": short, "cover": f"assets/books/{book_id}.jpg",
                "src_cover": meta.get("image", ""), "decks": []}
        for deck_name, dv in meta["decks"].items():
            low = deck_name.lower()
            if "alphabet" in low:
                continue  # the site teaches words, not letters
            m = re.match(r"unit\s*(\d+)\s*-\s*(.*)", deck_name, re.I)
            if m:
                did, unit, title = f"{book_id}-u{m.group(1)}", int(m.group(1)), m.group(2).strip()
                label = f"Unit {unit}"
            elif low.startswith("all"):
                did, unit = f"{book_id}-all", 0
                title = "All topics" if book_id == "pd" else "All units"
                label = "All"
            else:
                did, unit, title, label = f"{book_id}-{slug(deck_name)}", None, deck_name, deck_name
            path = find_file(dv["path"])
            if not path:
                report.append(f"! file not found for {did}: {dv['path']}")
                continue
            ids = []
            for it in read_items(path):
                text = (it.get("english") or "").strip()
                if not text or is_letter_entry(text):
                    continue
                wid = text.lower()
                if wid not in words:
                    jp = it.get("japanese") or {}
                    words[wid] = {"t": text, "ja": jp.get("kanji", ""), "kana": jp.get("furigana", "")}
                if wid not in ids:
                    ids.append(wid)
            if not ids:
                report.append(f"- skipped empty deck {did}")
                continue
            decks[did] = {"id": did, "book": book_id, "unit": unit, "label": label, "title": title,
                          "image": f"assets/decks/{did}.jpg", "src_image": dv.get("image", ""),
                          "words": ids, "sentences": []}
            book["decks"].append(did)
        books.append(book)

    # Sentences: unit decks get their own; "all" decks get their book's; topic decks borrow
    all_sent = []
    seen = set()
    for did, lst in sentences.items():
        if did not in decks:
            report.append(f"! sentences for unknown deck {did}")
            continue
        decks[did]["sentences"] = [{"t": e, "ja": j} for e, j in lst]
        for e, j in lst:
            if e not in seen:
                seen.add(e)
                all_sent.append({"t": e, "ja": j})
    for did, d in decks.items():
        if d["sentences"]:
            continue
        if d["unit"] == 0 and d["book"] != "pd":
            pool, s2 = [], set()
            for other in decks.values():
                if other["book"] == d["book"] and other["id"] != did:
                    for s in other["sentences"]:
                        if s["t"] not in s2:
                            s2.add(s["t"]); pool.append(s)
            d["sentences"] = pool
        else:
            texts = [words[w]["t"] for w in d["words"]]
            d["sentences"] = [s for s in all_sent if any(contains_phrase(s["t"], t) for t in texts)][:40]

    # Pictures (optional)
    if args.images:
        copy_images(args.images, books, decks, report)
    for b in books:
        b.pop("src_cover", None)
    for d in decks.values():
        d.pop("src_image", None)

    out = {"version": 1, "books": books, "decks": decks, "words": words}
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    with open(os.path.join(ROOT, "data", "words.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, "data", "words.js"), "w", encoding="utf-8") as f:
        f.write("// Generated by tools/build_words.py - do not edit by hand.\n")
        f.write("window.TM_WORDS = ")
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    n_sent = sum(len(v) for v in sentences.values())
    print(f"books {len(books)}  decks {len(decks)}  words {len(words)}  key sentences {n_sent}")
    for b in books:
        print(f"  {b['short']}: " + ", ".join(f"{d}({len(decks[d]['words'])}w/{len(decks[d]['sentences'])}s)" for d in b["decks"]))
    for r in report:
        print(r)


def copy_images(img_root, books, decks, report):
    try:
        from PIL import Image
    except ImportError:
        report.append("! Pillow not installed; pictures skipped (pip install pillow)")
        return
    cat = os.path.join(img_root, "categories")

    def resolve(rel):
        rel = urllib.parse.unquote(rel or "").lstrip("/")
        rel = rel.replace("assets/images/", "")
        p = os.path.join(img_root, rel)
        return p if os.path.isfile(p) else None

    def save(src, dst, size):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        im = Image.open(src).convert("RGB")
        im.thumbnail((size, size), Image.LANCZOS)
        im.save(dst, "JPEG", quality=82, optimize=True, progressive=True)

    for b in books:
        src = resolve(b.get("src_cover"))
        if src:
            save(src, os.path.join(ROOT, b["cover"]), BOOK_IMG_SIZE)
        else:
            report.append(f"! no cover for {b['id']}")
    for did, d in decks.items():
        src = None
        if did in IMAGE_OVERRIDES:
            p = os.path.join(cat, IMAGE_OVERRIDES[did])
            src = p if os.path.isfile(p) else None
        if not src:
            src = resolve(d.get("src_image"))
            if src:  # prefer the folder's own group picture when there is one
                folder = os.path.basename(os.path.dirname(src))
                group = os.path.join(os.path.dirname(src), folder + ".jpg")
                if os.path.isfile(group):
                    src = group
        if src:
            save(src, os.path.join(ROOT, d["image"]), DECK_IMG_SIZE)
        else:
            report.append(f"! no picture for {did}")
            d["image"] = ""


if __name__ == "__main__":
    main()
