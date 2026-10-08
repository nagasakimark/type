"""Teleports the player near a jump / pad on the chosen track, bot-types, screenshots the air moment + banners.
usage: ui-forced.py <outdir> <track> <WxH>"""
import sys, subprocess, time, os
from playwright.sync_api import sync_playwright
out = sys.argv[1]; track = int(sys.argv[2]); w, h = map(int, sys.argv[3].split('x'))
os.makedirs(out, exist_ok=True); PORT = 8778 + track
srv = subprocess.Popen(['python3', '-m', 'http.server', str(PORT)], cwd='/home/claude/type', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.2)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': w, 'height': h}); pg.set_default_timeout(300000); errs = []
    pg.on('pageerror', lambda x: errs.append('PAGEERR ' + str(x))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(f'http://localhost:{PORT}/turbo-type/index.html?deck=nh5-u1&quiet=1'); pg.evaluate(f"TM.store.set('turbo.track',{track})"); pg.reload()
    pg.wait_for_function("window.TT && TT.debug && TT.debug.ST.ready", timeout=120000); pg.wait_for_timeout(1000)
    pg.keyboard.press('Enter')
    pg.wait_for_function("TT.debug.g.state==='play'", timeout=240000)
    pg.evaluate("(()=>{const S=TT.debug.S,tr=TT.debug.ST.track,j=tr.jumps[0],P=S.player; P.dist=j.s0-60; P.v=50; P.rate=6; P.prevY=P.y; S.nitro=0.99;})()")
    shots = 0; t0 = time.time(); seen = set(); maxair = 0
    while time.time() - t0 < 150 and shots < 4:
        k = pg.evaluate("(()=>{const t=TT.debug.S.queue[0];return t?t.nextReq():null})()")
        if k: pg.keyboard.press('Space' if k == ' ' else k)
        st = pg.evaluate("(()=>{const S=TT.debug.S,P=S.player;return {air:P.air,y:P.y,b:S.banners[0]&&S.banners[0].text,nitro:S.nitroT>0}})()")
        tag = ('air' if st['air'] else '') + (st['b'] or '') + ('nitro' if st['nitro'] else '')
        if tag and tag not in seen and shots < 4: seen.add(tag); pg.screenshot(path=f'{out}/{w}x{h}_t{track}_{shots}_{tag.replace("!","").replace(" ","")}.png'); shots += 1
        pg.wait_for_timeout(40)
    print('done', seen, errs[:4]); b.close()
srv.terminate()
