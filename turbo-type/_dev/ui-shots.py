"""Bot-types a run and screenshots key moments. usage: ui-shots.py <outdir> [track=0] [WxH ...]"""
import sys, subprocess, time, os
from playwright.sync_api import sync_playwright
out = sys.argv[1]; track = int(sys.argv[2]) if len(sys.argv) > 2 else 0
sizes = [tuple(map(int, a.split('x'))) for a in sys.argv[3:]] or [(1920, 1080)]
os.makedirs(out, exist_ok=True); PORT = 8777
srv = subprocess.Popen(['python3', '-m', 'http.server', str(PORT)], cwd='/home/claude/type', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.2)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    for (w, h) in sizes:
        pg = b.new_page(viewport={'width': w, 'height': h}); pg.set_default_timeout(240000); errs = []
        pg.on('pageerror', lambda x: errs.append('PAGEERR ' + str(x))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(f'http://localhost:{PORT}/turbo-type/index.html?deck=nh5-u1&quiet=1'); pg.evaluate(f"TM.store.set('turbo.track',{track})"); pg.reload()
        pg.wait_for_function("window.TT && TT.debug && TT.debug.ST.ready", timeout=60000); pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{out}/{w}x{h}_title.png')
        pg.keyboard.press('Enter'); pg.wait_for_timeout(4800)
        t0 = time.time(); shots = {5: 'run1', 12: 'run2', 20: 'run3', 30: 'run4'}; done = set()
        pg.evaluate("TT.debug.S.nitro = 0.99")
        while time.time() - t0 < 34:
            k = pg.evaluate("(()=>{const t=TT.debug.S.queue[0];return t?t.nextReq():null})()")
            if k: pg.keyboard.press('Space' if k == ' ' else k)
            el = int(time.time() - t0)
            for s, n in shots.items():
                if el >= s and n not in done: done.add(n); pg.screenshot(path=f'{out}/{w}x{h}_{n}.png', timeout=120000)
            pg.wait_for_timeout(55)
        st = pg.evaluate("({jumps:TT.debug.S.jumpsDone, nitros:TT.debug.S.nitrosDone, big:TT.debug.S.bigAir, dist:Math.round(TT.debug.S.player.dist), rank:TT.debug.S.player.rank})")
        print(w, h, st, 'errors:', errs[:4]); pg.close()
    b.close()
srv.terminate()
