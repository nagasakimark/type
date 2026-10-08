"""Regression bot for the 'targeting stops working after level 1' bug.
Plays like a kid with REAL key presses: picks the lowest typable ship it can see, types its next letter, and records a stall
whenever a seen, typable ship exists but keystrokes aimed at it do not move its typer for > STALL seconds.
Runs sector 1 waves 1..N, through the sector map, and into sector 2. Exit code 1 on any stall or page error.
Usage: python3 regress_targeting.py [diff] [sectors]"""
import sys, time; sys.path.insert(0, '.')
from ss_common import *

args = [a for a in sys.argv[1:] if not a.startswith('--')]
DIFF = args[0] if args else 'normal'
SECTORS = int(args[1]) if len(args) > 1 else 2
STALL = 2.5
NAIVE = '--naive' in sys.argv
s = Session(url_extra=f'&diff={DIFF}')
s.ev(f"(()=>{{TM.current.diff='{DIFF}'}})()")
s.ev("__ssDev.god(true)")
s.ev("__ssDev.speed(2)")
stalls, log = [], []
target_since = {}
t0 = time.time(); last_prog = time.time(); last_sig = None
while time.time() - t0 < 600:
    st = s.ev("__SS_STATE()")
    if st is None: break
    if st['sector'] >= SECTORS: break
    if st['mode'] in ('map', 'clear'):
        if st['mode'] == 'map': s.pg.keyboard.press('Enter')
        s.pg.wait_for_timeout(120); last_prog = time.time(); continue
    if st['mode'] != 'fight': s.pg.wait_for_timeout(100); continue
    ens = [e for e in st['enemies'] if e['ok']]
    if not ens:
        s.pg.wait_for_timeout(60); last_prog = time.time(); continue
    lock = st['lock']
    tgt = None
    if lock is not None and not NAIVE: tgt = next((e for e in st['enemies'] if e['id'] == lock), None)
    if NAIVE and lock is not None:
        cur = next((e for e in st['enemies'] if e['id'] == lock), None)
        if cur and cur['pos'] > 0 and not cur['keep']: tgt = cur  # kid finishes the word it started
    if tgt is None:
        # a kid picks a visible ship that hasn't been started (or a boss/ace it can see)
        fresh = [e for e in ens if e['pos'] == 0] or ens
        tgt = max(fresh, key=lambda e: e['y'])
    k = tgt['next']
    if not k: s.pg.wait_for_timeout(40); continue
    before = (tgt['id'], tgt['pos'])
    s.pg.keyboard.press('Space' if k == ' ' else k)
    s.pg.wait_for_timeout(35)
    st2 = s.ev("__SS_STATE()")
    after = next((e for e in st2['enemies'] if e['id'] == tgt['id']), None)
    moved = after is None or after['pos'] != before[1]
    if moved: last_prog = time.time()
    elif time.time() - last_prog > STALL:
        stalls.append(dict(sector=st['sector'], wave=st['wave'], lock=lock, tgt=tgt, enemies=st['enemies']))
        lk = next((e for e in st['enemies'] if e['id'] == lock), {}); print('STALL', st['sector'], st['wave'], 'lock', lock, lk.get('type'), lk.get('text'), lk.get('pos'), 'tgt', tgt['type'], tgt['text'], 'pos', tgt['pos'])
        last_prog = time.time()
        if not NAIVE: s.pg.keyboard.press('Backspace')
    sig = (st['sector'], st['wave'])
    if sig != last_sig: print('reached sector', sig[0] + 1, 'wave', sig[1] + 1, 'mode', st['mode']); last_sig = sig

final = s.ev("__SS_STATE()")
print('final', final['mode'], 'sector', final['sector'] + 1, 'wave', final['wave'] + 1)
print('stalls', len(stalls), 'errors', s.errs[:5])
s.close()
ok = not stalls and not [e for e in s.errs if 'PAGEERR' in e] and final['sector'] >= SECTORS - 1
sys.exit(0 if ok else 1)
