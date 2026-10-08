"""Balance simulator: plays a game with the in-page dev bot (real game logic) at a given skill and prints a pacing timeline.
usage: python3 tools/sim.py <game> <diff> <cps> <err> <think> [wall_seconds=60] [speed=6]
e.g.   python3 tools/sim.py word-ninja normal 2.0 0.04 0.9 80"""
import sys, time, subprocess, os, json
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
game, diff, cps, err, think = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
wall = float(sys.argv[6]) if len(sys.argv) > 6 else 60
speed = sys.argv[7] if len(sys.argv) > 7 else '6'
port = 8800 + (abs(hash((game, diff, cps))) % 150)
srv = subprocess.Popen(['python3', '-m', 'http.server', str(port)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
extra = {'word-ninja': "(()=>{const S=WN.dbg();return {alive:S.fruits.filter(f=>f.alive&&f.type==='fruit').length,lvl:S.level,lives:S.lives,q:S.queue.length,phase:S.phase,work:S.fruits.filter(f=>f.alive&&f.type==='fruit').reduce((a,f)=>a+f.item.len*(1-f.typer.progress),0)}})()"}.get(game, 'null')
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1600, 'height': 900})
    errs = []
    pg.on('pageerror', lambda x: errs.append(str(x)))
    pg.add_init_script(f"localStorage.setItem('tm.settings', JSON.stringify({{difficulty:'{diff}'}}));")
    pg.goto(f'http://localhost:{port}/{game}/index.html?deck=nh5-u1&quiet=1&speed={speed}&bot={cps},{err},{think}')
    pg.wait_for_timeout(2500); pg.keyboard.press('Enter')
    t0 = time.time(); last = ''
    rows = []
    while time.time() - t0 < wall:
        pg.wait_for_timeout(1500)
        d = pg.evaluate(f"(()=>{{const g=TM.current;return {{state:g.state,t:+g.playT.toFixed(0),score:g.score.score,words:g.score.wordsDone,ad:g.ad?g.ad.summary():null,x:{extra}}}}})()")
        rows.append(d)
        a = d['ad'] or {}
        x = d['x'] or {}
        print(f"t={d['t']:>4} {d['state']:<7} words={d['words']:>3} load={a.get('load')} cps={a.get('cps')} dem={a.get('demand')} succ={a.get('succ')} ok/bad={a.get('ok')}/{a.get('bad')} {json.dumps(x)}")
        if d['state'] in ('over',): break
    print('errors', errs[:3])
    b.close()
srv.terminate()
