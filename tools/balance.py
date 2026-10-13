"""Balance harness: plays whole games with the in-page dev bot and reports the outcome (win/lose, time, accuracy).
usage: python3 tools/balance.py "<games comma list>" "<diffs>" "<cps:err:think comma list>" [wall=150] [speed=8] [deck=nh2-u3]
e.g.   python3 tools/balance.py word-ninja,turbo-type gentle,normal 0.8:0.12:1.4,1.5:0.06:0.8,3:0.03:0.4
The bot types real keys through the game's own input code; cps = keys/second while typing, err = share of wrong keys, think = pause after each word."""
import sys, time, subprocess, os, json, itertools
from concurrent.futures import ThreadPoolExecutor
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
games = sys.argv[1].split(','); diffs = sys.argv[2].split(','); skills = sys.argv[3].split(',')
wall = float(sys.argv[4]) if len(sys.argv) > 4 else 150
speed = sys.argv[5] if len(sys.argv) > 5 else '8'
deck = sys.argv[6] if len(sys.argv) > 6 else 'nh2-u3'
srv = subprocess.Popen(['python3', '-m', 'http.server', '8790'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)

def run(job):
    game, diff, sk = job
    cps, err, think = sk.split(':')
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        errs = []
        pg.on('pageerror', lambda x: errs.append(str(x)))
        pg.add_init_script(f"localStorage.setItem('tm.settings', JSON.stringify({{difficulty:'{diff}',dv:2}}));")
        pg.goto(f'http://localhost:8790/{game}/index.html?deck={deck}&quiet=1&dev=1&speed={speed}&bot={cps},{err},{think}')
        pg.wait_for_timeout(2500); pg.keyboard.press('Enter')
        t0 = time.time(); out = None
        while time.time() - t0 < wall:
            pg.wait_for_timeout(1500)
            d = pg.evaluate("(()=>{const g=TM.current;const r=g.lastResult||{};return {state:g.state,t:+g.playT.toFixed(0),score:g.score.score,words:g.score.wordsDone,acc:+g.score.accuracy.toFixed(2),win:r.win,title:r.title||'',sub:r.sub||'',stats:r.stats||null}})()")
            out = d
            if d['state'] == 'over': break
        b.close()
    return (game, diff, sk, out, errs[:2])

jobs = list(itertools.product(games, diffs, skills))
with ThreadPoolExecutor(max_workers=3) as ex:
    for game, diff, sk, o, errs in ex.map(run, jobs):
        if not o: print(game, diff, sk, 'no result'); continue
        res = 'DONE' if o['state'] == 'over' else 'running'
        print(f"{game:12} {diff:6} skill={sk:12} {res:7} win={o['win']} t={o['t']:>4}s words={o['words']:>3} acc={o['acc']} {o['title']} {o['sub']} {errs}", flush=True)
srv.terminate()
