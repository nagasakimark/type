"""Shared Playwright helpers for Star Sweep dev tests. Serves /home/claude/type on a private port."""
import subprocess, time, os, sys
from playwright.sync_api import sync_playwright
PORT = int(os.environ.get('SSPORT', '8791'))
SHOTS = os.environ.get('SHOTS', '/tmp/claude-0/shots')
os.makedirs(SHOTS, exist_ok=True)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

class Session:
    def __init__(self, w=1920, h=1080, url_extra=''):
        self.srv = subprocess.Popen(['python3', '-m', 'http.server', str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(0.8)
        self.pw = sync_playwright().start()
        self.b = self.pw.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        self.pg = self.b.new_page(viewport={'width': w, 'height': h})
        self.errs = []
        self.pg.on('console', lambda m: self.errs.append(m.text) if m.type == 'error' else None)
        self.pg.on('pageerror', lambda x: self.errs.append('PAGEERR ' + str(x)))
        self.pg.goto(f'http://localhost:{PORT}/star-sweep/index.html?deck=nh5-u1&quiet=1&dev=1{url_extra}')
        self.pg.wait_for_timeout(2500)
        self.pg.keyboard.press('Enter'); self.pg.wait_for_timeout(5200)
    def ev(self, js): return self.pg.evaluate(js)
    def shot(self, name): self.pg.screenshot(path=f'{SHOTS}/{name}.png')
    def close(self):
        try: self.b.close(); self.pw.stop()
        finally: self.srv.terminate()
