"""Builds assets/kenney/word-jumper/heroes.png (+ heroes.js) from the three original Kenney hero rows:
 - repaints every open-mouth pose of the boy and girl with their closed smile (the open mouths looked goofy),
 - adds a ZOMBIE row (boy re-coloured: green skin, tattered grey clothes, dull hair, tired eyes, stitched mouth).
Idempotent: always starts from heroes_orig.png (a copy of the pack's sheet)."""
import json, os, shutil, numpy as np
from PIL import Image
from scipy import ndimage as ndi
D = os.path.join(os.path.dirname(__file__), '..', 'assets', 'kenney', 'word-jumper')
orig = os.path.join(D, 'heroes_orig.png')
if not os.path.exists(orig): shutil.copy(os.path.join(D, 'heroes.png'), orig)
im = Image.open(orig).convert('RGBA'); A = np.array(im)
NAMES = ['stand', 'walk1', 'walk2', 'jump', 'fall', 'duck', 'hurt', 'cheer1', 'cheer2', 'climb1', 'climb2', 'kick', 'skid', 'talk', 'action1']
SKIN = np.array([255, 224, 177])
CLOSED = {'stand', 'duck', 'kick', 'climb1', 'climb2'}
def comps(t):
    a = t.astype(int); al = a[..., 3] > 200; lum = a[..., :3].sum(-1) / 3
    m = (al & (lum < 125) & (a[..., 0] < 150)) | (al & (a[..., :3].min(-1) > 238)); m[130:] = False
    lab, k = ndi.label(ndi.binary_dilation(m, iterations=1)); out = []
    for j in range(1, k + 1):
        ys, xs = np.where((lab == j) & m)
        if len(ys) >= 6: out.append(dict(x0=xs.min(), y0=ys.min(), x1=xs.max(), y1=ys.max(), n=len(ys), mask=(lab == j) & m))
    return out
def find(t):
    cs = comps(t); eyes = [c for c in cs if 80 <= c['n'] <= 145 and 10 <= c['x1'] - c['x0'] + 1 <= 14 and 11 <= c['y1'] - c['y0'] + 1 <= 16]
    best = None
    for i in range(len(eyes)):
        for j in range(i + 1, len(eyes)):
            a, b = eyes[i], eyes[j]
            if abs(a['y0'] - b['y0']) <= 4 and 24 <= abs(a['x0'] - b['x0']) <= 50: best = (a, b) if a['x0'] < b['x0'] else (b, a)
    if not best: return None, None
    L, R = best; cx0, cx1 = (L['x0'] + L['x1']) / 2, (R['x0'] + R['x1']) / 2; ey = max(L['y1'], R['y1'])
    cand = [c for c in cs if c is not L and c is not R and cx0 - 2 <= (c['x0'] + c['x1']) / 2 <= cx1 + 2 and c['y0'] >= ey - 6 and c['y0'] <= ey + 12 and (c['x1'] - c['x0']) <= 28 and (c['y1'] - c['y0']) <= 16 and c['n'] >= 20]
    return (L, R), (max(cand, key=lambda c: c['n']) if cand else None)
def closed(row):
    for r in range(3):
        pass
rows = {}
for row, rn in enumerate(['player', 'female']):
    tiles = [A[row * 220:(row + 1) * 220, i * 160:(i + 1) * 160].copy() for i in range(15)]
    eyes, sm = find(tiles[0]); assert sm is not None, (rn, 'stand mouth')
    tmpl = tiles[0][sm['y0'] - 1:sm['y1'] + 2, sm['x0'] - 1:sm['x1'] + 2].copy(); tw = tmpl.shape[1]; tcx = (sm['x1'] - sm['x0']) / 2 + 1
    fixed = []
    for i, n in enumerate(NAMES):
        t = tiles[i]
        if n not in CLOSED and n not in ('climb1', 'climb2'):
            eyes, mo = find(t)
            if mo is None: print('no mouth', rn, n); continue
            reg = ndi.binary_dilation(mo['mask'], iterations=2)
            skin_here = np.where(reg & (t[..., 3] > 0))
            t[skin_here[0], skin_here[1], :3] = SKIN; t[skin_here[0], skin_here[1], 3] = 255
            mcx = (mo['x0'] + mo['x1']) / 2; x0 = int(round(mcx - tcx)); y0 = mo['y0'] + 1 - 1
            h, w = tmpl.shape[:2]; y0 = max(0, min(y0, 219 - h)); x0 = max(0, min(x0, 159 - w))
            t[y0:y0 + h, x0:x0 + w] = tmpl; fixed.append(n)
        tiles[i] = t
    print(rn, 'closed-mouth repainted:', fixed)
    rows[rn] = tiles
    for i, t in enumerate(tiles): A[row * 220:(row + 1) * 220, i * 160:(i + 1) * 160] = t
# ---- zombie row from the boy ----
import colorsys
H = A.shape[0]; out = np.zeros((H + 220, A.shape[1], 4), np.uint8); out[:H] = A
def hsv(a): 
    r, g, b = a[..., 0] / 255., a[..., 1] / 255., a[..., 2] / 255.
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); d = mx - mn + 1e-9
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, np.where(mx == 0, 0, d / (mx + 1e-9)), mx
for i in range(15):
    t = rows['player'][i].copy(); h, s, v = hsv(t[..., :3].astype(float)); al = t[..., 3] > 0
    skin = al & (h >= 24) & (h <= 46) & (s >= 0.12) & (s <= 0.46) & (v >= 0.7)
    hair = al & (h >= 20) & (h <= 36) & (s > 0.46) & (v > 0.5)
    shirt = al & (h >= 125) & (h <= 165) & (s > 0.4)
    pants = al & (h >= 190) & (h <= 220) & (s > 0.4)
    def paint(m, base, vref):
        k = (v[m] / vref)[:, None]; t[..., :3][m] = np.clip(np.array(base)[None, :] * k, 0, 255).astype(np.uint8)
    paint(skin, (150, 196, 112), 1.0); paint(hair, (88, 78, 66), 0.77); paint(shirt, (104, 108, 130), 0.80); paint(pants, (72, 70, 98), 0.86)
    out[H:H + 220, i * 160:(i + 1) * 160] = t
# tired eyes + stitched mouth on the face poses
for i, n in enumerate(NAMES):
    tile = out[H:H + 220, i * 160:(i + 1) * 160]
    if n in ('climb1', 'climb2'): continue
    eyes, mo = find(rows['player'][i])
    if not eyes: continue
    im2 = Image.fromarray(tile).copy(); px = im2.load()
    for e in eyes:
        for x in range(e['x0'] + 1, e['x1']):
            for y in (e['y1'] + 1, e['y1'] + 2):
                if px[x, y][3] > 0: px[x, y] = (88, 130, 80, 255)           # eye bags
    if mo:
        for sx in range(mo['x0'] + 3, mo['x1'] - 2, 5):
            for y in range(mo['y0'] - 1, mo['y0'] + 6):
                if px[sx, y][3] > 0: px[sx, y] = (78, 70, 60, 255)           # stitches
    tile[:] = np.array(im2)
Image.fromarray(out).save(os.path.join(D, 'heroes.png'))
M = {}
for r, pre in enumerate(['player', 'female', 'adventurer', 'zombie']):
    for i, n in enumerate(NAMES): M[f'{pre}_{n}'] = [i * 160, r * 220, 160, 220]
open(os.path.join(D, 'heroes.js'), 'w').write('window.WJ_HEROES=' + json.dumps(M) + ';\n')
print('wrote', out.shape)
