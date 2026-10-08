#!/usr/bin/env python3
"""Packs the Kenney (CC0) ship-part sprites used for Star Sweep weapon upgrades into ss-parts.png + parts.js."""
import os, json
from PIL import Image
SRC = '/tmp/k/kenney_space-shooter-remastered/PNG/Parts/'
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'kenney', 'star-sweep'))
names = [f'gun{i:02d}' for i in range(11)] + [f'wingBlue_{i}' for i in range(8)] + [f'wingRed_{i}' for i in range(8)] + [f'wingGreen_{i}' for i in range(8)] + [f'engine{i}' for i in range(1, 6)] + ['turretBase_big', 'turretBase_small'] + [f'beam{i}' for i in range(7)] + ['beamLong1', 'beamLong2'] + [f'cockpitBlue_{i}' for i in range(8)]
items = [(n, Image.open(SRC + n + '.png').convert('RGBA')) for n in names]
items.sort(key=lambda kv: -kv[1].height)
x = y = rh = 0; W = 512; rects = {}
for n, im in items:
    if x + im.width + 4 > W: x = 0; y += rh + 4; rh = 0
    rects[n] = [x + 2, y + 2, im.width, im.height]; x += im.width + 4; rh = max(rh, im.height)
H = y + rh + 4
at = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for n, im in items: at.paste(im, tuple(rects[n][:2]))
at.save(OUT + '/ss-parts.png', optimize=True)
open(OUT + '/parts.js', 'w').write('window.SS_PARTS=' + json.dumps({'rects': rects}, separators=(',', ':')) + ';')
print(len(rects), at.size, os.path.getsize(OUT + '/ss-parts.png'))
