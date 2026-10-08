#!/usr/bin/env python3
"""Builds the Star Sweep texture atlases + trimmed audio from the Kenney packs (CC0).
Usage: python3 build_assets.py   (reads /tmp/claude-0/kn, writes ../../assets/kenney/star-sweep)"""
import os, json, shutil, colorsys, subprocess, glob
from PIL import Image

KN = '/tmp/claude-0/kn'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'kenney', 'star-sweep')
OUT = os.path.abspath(OUT)
os.makedirs(OUT, exist_ok=True)
R = f'{KN}/kenney_space-shooter-remastered/PNG'
X2 = f'{KN}/kenney_space-shooter-extension/PNG/Sprites X2'
X1 = f'{KN}/kenney_space-shooter-extension/PNG/Sprites'
PP = f'{KN}/kenney_particle-pack/PNG (Transparent)'
SM = f'{KN}/kenney_smoke-particles/PNG'

def load(p, maxdim=None, scale=None):
    im = Image.open(p).convert('RGBA')
    if scale: im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    if maxdim and max(im.size) > maxdim:
        k = maxdim / max(im.size); im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    return im

def pack(items, name, maxw=2048, pad=2):
    """items: list of (key, PIL image). shelf packer."""
    items = sorted(items, key=lambda kv: -kv[1].height)
    x = y = rowh = 0; place = {}
    for k, im in items:
        w, h = im.width + pad * 2, im.height + pad * 2
        if x + w > maxw: x = 0; y += rowh; rowh = 0
        place[k] = (x + pad, y + pad, im.width, im.height)
        x += w; rowh = max(rowh, h)
    H = y + rowh
    th = H
    atlas = Image.new('RGBA', (maxw, th), (0, 0, 0, 0))
    for k, im in items:
        px, py, _, _ = place[k]; atlas.paste(im, (px, py))
    if name == 'ss-fx': atlas.save(f'{OUT}/{name}.webp', quality=88, method=6)
    else: atlas.save(f'{OUT}/{name}.png', optimize=True)
    return {k: list(v) for k, v in place.items()}, (maxw, th)

def hue_bucket(im):
    px = [p for p in im.getdata() if p[3] > 200]
    if not px: return 'gray'
    sat = [colorsys.rgb_to_hsv(p[0] / 255, p[1] / 255, p[2] / 255) for p in px]
    colored = [s for s in sat if s[1] > 0.35 and s[2] > 0.25]
    if len(colored) < len(px) * 0.12: return 'gray'
    import math
    hs = sum(s[0] for s in colored) / len(colored)
    h = hs * 360
    if h < 25 or h > 330: return 'red'
    if 70 < h < 170: return 'green'
    if 170 <= h < 260: return 'blue'
    return 'gray'

main = []
def add(key, path, **kw): main.append((key, load(path, **kw)))

# ---- player / enemies / ufos (remastered) ----
for c in ['blue', 'green', 'orange', 'red']:
    add(f'ship1_{c}', f'{R}/playerShip1_{c}.png')
add('ship2_blue', f'{R}/playerShip2_blue.png'); add('ship3_blue', f'{R}/playerShip3_blue.png')
for i in (1, 2, 3): add(f'dmg{i}', f'{R}/Damage/playerShip1_damage{i}.png')
for col in ['Black', 'Blue', 'Green', 'Red']:
    for i in range(1, 6): add(f'enemy{col}{i}', f'{R}/Enemies/enemy{col}{i}.png')
for col in ['Blue', 'Green', 'Red', 'Yellow']: add(f'ufo{col}', f'{R}/ufo{col}.png')
# lasers
for col in ['Blue', 'Green', 'Red']:
    for i in range(1, 17): add(f'laser{col}{i:02d}', f'{R}/Lasers/laser{col}{i:02d}.png')
# meteors
for f in sorted(os.listdir(f'{R}/Meteors')): add(f[:-4], f'{R}/Meteors/{f}')
# power-ups, ui, effects
for f in sorted(os.listdir(f'{R}/Power-ups')): add('pu_' + f[:-4], f'{R}/Power-ups/{f}')
for f in sorted(os.listdir(f'{R}/Effects')): add('ef_' + f[:-4], f'{R}/Effects/{f}')
for c in ['blue', 'green', 'orange', 'red']: add(f'life_{c}', f'{R}/UI/playerLife1_{c}.png')
# ---- extension (X2 = double res) ----
for i in range(1, 10): add(f'ace{i}', f'{X2}/Ships/spaceShips_{i:03d}.png')
for i in (7, 8, 9, 14, 15, 17, 18, 19, 20, 24, 25, 26, 27, 28, 29, 30, 31, 1, 2): add(f'st{i}', f'{X2}/Station/spaceStation_{i:03d}.png')
for i in range(1, 5): add(f'rocket{i}', f'{X2}/Rockets/spaceRockets_{i:03d}.png')
for i in range(1, 5): add(f'xmeteor{i}', f'{X2}/Meteors/spaceMeteors_{i:03d}.png', scale=0.55)
for i in range(1, 41): add(f'missile{i}', f'{X1}/Missiles/spaceMissiles_{i:03d}.png')
for i in range(8, 17): add(f'xpuff{i}', f'{X1}/Effects/spaceEffects_{i:03d}.png')
# debris shards classified by colour
counts = {}
for f in sorted(os.listdir(f'{X1}/Parts')):
    im = load(f'{X1}/Parts/{f}')
    if max(im.size) > 100: continue
    b = hue_bucket(im); counts[b] = counts.get(b, 0) + 1
    main.append((f'deb_{b}_{counts[b]}', im))
print('debris', counts)
mp, msz = pack(main, 'ss-main')

# ---- fx atlas (particles, smoke explosions) ----
fx = []
for i in range(9):
    fx.append((f'expl{i}', load(f'{SM}/Explosion/explosion{i:02d}.png', maxdim=192)))
    fx.append((f'flash{i}', load(f'{SM}/Flash/flash{i:02d}.png', maxdim=192)))
for i in (0, 3, 6, 9, 12, 15): fx.append((f'puff{i}', load(f'{SM}/White puff/whitePuff{i:02d}.png', maxdim=128)))
for i in (0, 4, 8, 12, 16, 20): fx.append((f'bsmoke{i}', load(f'{SM}/Black smoke/blackSmoke{i:02d}.png', maxdim=128)))
want = {'circle': range(1, 6), 'star': range(1, 10), 'magic': range(3, 6), 'muzzle': range(1, 6), 'smoke': range(1, 11), 'spark': range(1, 8),
        'twirl': range(1, 4), 'dirt': range(1, 4), 'scorch': range(1, 4), 'light': range(1, 4), 'flame': range(1, 7), 'trace': range(1, 8),
        'slash': range(1, 5), 'symbol': range(1, 3), 'flare': range(1, 2), 'fire': range(1, 3)}
for k, rg in want.items():
    for i in rg:
        md = 192 if k in ('circle', 'light', 'twirl', 'smoke', 'scorch') else 128
        fx.append((f'p_{k}{i}', load(f'{PP}/{k}_{i:02d}.png', maxdim=md)))
fp, fsz = pack(fx, 'ss-fx')

# ---- planets (separate webp) ----
for i in range(10):
    load(f'{KN}/kenney_planets/Planets/planet{i:02d}.png', maxdim=400).save(f'{OUT}/planet{i}.webp', quality=88, method=6)
# ---- skyboxes (jpeg) ----
sky = {'band': 'kenney_skyboxes-space/Skyboxes/skybox-space-band.png', 'galaxy': 'kenney_skyboxes-space/Skyboxes/skybox-space-galaxy.png',
       'nebula': 'kenney_skyboxes-space/Skyboxes/skybox-space-nebula.png', 'dark': 'kenney_skyboxes-space/Skyboxes/skybox-space-dark.png',
       'day': 'kenney_skyboxes-space/Skyboxes/skybox-space-day.png', 'deep': 'kenney_skyboxes/Skyboxes/skybox-space.png'}
for k, p in sky.items():
    Image.open(f'{KN}/{p}').convert('RGB').resize((2048, 1024), Image.LANCZOS).save(f'{OUT}/sky_{k}.jpg', quality=82, optimize=True, progressive=True)

# ---- audio ----
AU = f'{OUT}/audio'; os.makedirs(AU, exist_ok=True)
SF = f'{KN}/kenney_sci-fi-sounds/Audio'; DA = f'{KN}/kenney_digital-audio/Audio'; RB = f'{KN}/kenney_space-shooter-remastered/Bonus'
audio = {}
def aud(key, src, dur=None):
    dst = f'{AU}/{key}.ogg'
    cmd = ['ffmpeg', '-y', '-v', 'error', '-i', src, '-ac', '1', '-ar', '32000', '-c:a', 'libvorbis', '-q:a', '3']
    if dur: cmd += ['-t', str(dur)]
    subprocess.check_call(cmd + [dst]); audio[key] = key + '.ogg'
for i in range(5): aud(f'laserSmall{i}', f'{SF}/laserSmall_00{i}.ogg')
for i in range(3): aud(f'laserRetro{i}', f'{SF}/laserRetro_00{i}.ogg')
for i in range(2): aud(f'laserLarge{i}', f'{SF}/laserLarge_00{i}.ogg')
for i in range(5): aud(f'crunch{i}', f'{SF}/explosionCrunch_00{i}.ogg')
for i in range(2): aud(f'boom{i}', f'{SF}/lowFrequency_explosion_00{i}.ogg')
for i in range(3): aud(f'field{i}', f'{SF}/forceField_00{i}.ogg')
for i in range(3): aud(f'metal{i}', f'{SF}/impactMetal_00{i}.ogg')
aud('warp', f'{SF}/thrusterFire_000.ogg', 3.0)
aud('engine', f'{SF}/spaceEngineLow_000.ogg')
aud('door', f'{SF}/doorOpen_000.ogg')
aud('computer', f'{SF}/computerNoise_001.ogg', 1.5)
for i in (1, 2, 3, 5, 8, 10): aud(f'power{i}', f'{DA}/powerUp{i}.ogg')
for i in (1, 3, 5): aud(f'phaserUp{i}', f'{DA}/phaserUp{i}.ogg')
for i in (1, 2): aud(f'phaserDown{i}', f'{DA}/phaserDown{i}.ogg')
for n in ['threeTone1', 'threeTone2', 'twoTone1', 'twoTone2', 'zapThreeToneUp', 'zapThreeToneDown', 'lowDown', 'highUp', 'phaseJump1', 'phaseJump3', 'pepSound3', 'tone1', 'lowThreeTone']:
    aud(n, f'{DA}/{n}.ogg')
aud('shieldUp', f'{RB}/sfx_shieldUp.ogg'); aud('shieldDown', f'{RB}/sfx_shieldDown.ogg'); aud('lose', f'{RB}/sfx_lose.ogg')

json.dump({'main': {'size': msz, 'rects': mp}, 'fx': {'size': fsz, 'rects': fp}, 'audio': audio}, open(f'{OUT}/manifest.json', 'w'), separators=(',', ':'))
# also as a JS file (works from file:// too)
open(f'{OUT}/manifest.js', 'w').write('window.SS_MANIFEST=' + json.dumps({'main': {'size': msz, 'rects': mp}, 'fx': {'size': fsz, 'rects': fp}, 'audio': audio}, separators=(',', ':')) + ';')
os.remove(f'{OUT}/manifest.json')
# fonts + licences
shutil.copy(f'{KN}/kenney_space-shooter-remastered/Bonus/kenvector_future.ttf', f'{OUT}/kenvector_future.ttf')
for pk, lic in [('kenney_space-shooter-remastered', 'license.txt'), ('kenney_space-shooter-extension', 'License.txt')]:
    shutil.copy(f'{KN}/{pk}/{lic}', f'{OUT}/LICENSE-{pk}.txt')
print('main', msz, 'fx', fsz)
