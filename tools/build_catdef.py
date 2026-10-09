#!/usr/bin/env python3
"""Pack the 'Cartoon Cat Defense Game Asset Kit' (CraftPix) into a few small sprite sheets for the Cat Defenders game.

usage: python3 tools/build_catdef.py <folder where the kit zip was extracted>      (the folder that contains Png/)
writes assets/catdef/*.webp|jpg and assets/catdef/manifest.js
Frames are subsampled and pre-scaled so the whole game is ~3 MB and no sheet is wider/taller than 4096px (Chromebook safe).
"""
import sys, os, glob, json
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/cat'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'catdef')
os.makedirs(OUT, exist_ok=True)
P = lambda *a: os.path.join(SRC, 'Png', *a)
M = {}


def frames(folder, n):
    fs = sorted(glob.glob(os.path.join(folder, '*.png')))
    if n >= len(fs):
        return fs
    return [fs[int(i * len(fs) / n)] for i in range(n)]


def load(f, scale):
    im = Image.open(f).convert('RGBA')
    if scale != 1:
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    return im


def sheet(name, rows, cell, cols, quality=82):
    """rows: list of lists of PIL images; each list starts a new strip (wrapped after `cols`). cell = (w, h). Bottom-centre anchored."""
    strips = []
    for r in rows:
        strips.append(r)
    per = [(len(r) + cols - 1) // cols for r in strips]
    H = sum(per) * cell[1]
    W = cols * cell[0]
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    y = 0
    index = []
    for r, k in zip(strips, per):
        for i, im in enumerate(r):
            cx, cy = (i % cols) * cell[0], y + (i // cols) * cell[1]
            sh.paste(im, (cx + (cell[0] - im.width) // 2, cy + cell[1] - im.height), im)
        index.append(y // cell[1])
        y += k * cell[1]
    sh.save(os.path.join(OUT, name), 'WEBP', quality=quality, method=6)
    print(name, sh.size, round(os.path.getsize(os.path.join(OUT, name)) / 1024), 'KB')
    return index


# ---- cats: 15 levels, idle 8 + shoot 4 ---------------------------------------------------------------
rows = []
for i in range(1, 16):
    rows.append([load(f, 0.8) for f in frames(P('Characters', f'C{i}', 'Idle'), 8)] + [load(f, 0.8) for f in frames(P('Characters', f'C{i}', 'Shoot'), 4)])
idx = sheet('cats.webp', rows, (160, 148), 12)
M['cats'] = {'cell': [160, 148], 'cols': 12, 'rows': idx, 'idle': 8, 'shoot': 4, 'levels': 15}

# ---- zombies: 8 regular, walk 12 + attack 8 + dead 8 ---------------------------------------------------
def foes(kind, count, scale, cell, name, walk=12, atk=8, dead=8):
    rows = []
    for i in range(1, count + 1):
        d = P('Enemies', f'Enemy {kind} {i}')
        rows.append([load(f, scale) for f in frames(os.path.join(d, 'Walk'), walk)] + [load(f, scale) for f in frames(os.path.join(d, 'Attack'), atk)] + [load(f, scale) for f in frames(os.path.join(d, 'Dead'), dead)])
    idx = sheet(name, rows, cell, 14)
    return {'cell': list(cell), 'cols': 14, 'rows': idx, 'walk': walk, 'attack': atk, 'dead': dead, 'count': count}

M['reg'] = foes('Reg', 8, 0.6, (180, 152), 'zombies.webp')
M['boss'] = foes('Boss', 7, 0.62, (232, 200), 'bosses.webp')

# ---- helper cats (boxing cat, guardian): idle 4 + attack 10 -------------------------------------------
rows = []
for d in ('CatBoxing', 'Cat Guardian'):
    rows.append([load(f, 0.7) for f in frames(P(d, 'Idle'), 4)] + [load(f, 0.7) for f in frames(P(d, 'Attack'), 10)])
idx = sheet('helpers.webp', rows, (236, 184), 7)
M['helpers'] = {'cell': [236, 184], 'cols': 7, 'rows': idx, 'idle': 4, 'attack': 10}

# ---- fx: bullets (3), muzzle (5), explosion (10) -------------------------------------------------------
bul = [load(f, 0.6) for f in sorted(glob.glob(P('Bullets', '*.png')))]
mz = [load(f, 0.7) for f in frames(P('ShootFx'), 5)]
ex = [load(f, 0.25) for f in frames(P('Explosion'), 10)]
Wf = 330
fx = Image.new('RGBA', (Wf * 5, 90 + 140 + 330 * 2), (0, 0, 0, 0))
for i, im in enumerate(bul):
    fx.paste(im, (i * 100, 0), im)
for i, im in enumerate(mz):
    fx.paste(im, (i * 180, 90), im)
for i, im in enumerate(ex):
    fx.paste(im, ((i % 5) * Wf + (Wf - im.width) // 2, 230 + (i // 5) * 330 + (330 - im.height) // 2), im)
fx.save(os.path.join(OUT, 'fx.webp'), 'WEBP', quality=84, method=6)
print('fx.webp', fx.size)
M['fx'] = {'bullets': [[i * 100, 0, b.width, b.height] for i, b in enumerate(bul)], 'muzzle': [[i * 180, 90, m.width, m.height] for i, m in enumerate(mz)],
           'boom': [[(i % 5) * Wf, 230 + (i // 5) * 330, Wf, 330] for i in range(len(ex))]}

# ---- ui icons ---------------------------------------------------------------------------------------
icons = ['CoinIcon', 'WallIcon', 'Icon_Cat', 'AddonIcon4', 'AddonIcon2', 'AddonIcon1']
ims = [load(P('Ui', n + '.png'), 1) for n in icons]
ui = Image.new('RGBA', (sum(i.width for i in ims) + 10 * len(ims), max(i.height for i in ims)), (0, 0, 0, 0))
x = 0; M['ui'] = {}
for n, im in zip(icons, ims):
    ui.paste(im, (x, 0), im); M['ui'][n] = [x, 0, im.width, im.height]; x += im.width + 10
ui.save(os.path.join(OUT, 'ui.webp'), 'WEBP', quality=90, method=6)

# ---- backgrounds -------------------------------------------------------------------------------------
M['bgs'] = []
for i in range(1, 6):
    im = Image.open(P('Area', f'Area{i}.png')).convert('RGB').resize((1600, 793), Image.LANCZOS)
    im.save(os.path.join(OUT, f'area{i}.jpg'), quality=82)
    M['bgs'].append(f'area{i}.jpg')

with open(os.path.join(OUT, 'manifest.js'), 'w') as f:
    f.write('window.CD_MANIFEST = ' + json.dumps(M) + ';\n')
tot = sum(os.path.getsize(os.path.join(OUT, n)) for n in os.listdir(OUT))
print('total', round(tot / 1024), 'KB')
