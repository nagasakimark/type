"""Star Sweep audit: bot plays waves + boss, asserts chip/banner/typability invariants every frame, screenshots at banner instants.
usage: python3 audit.py [W H] [seconds] [sector]   (serves /home/claude/type on :8785)"""
import sys, time, json, subprocess, os
from playwright.sync_api import sync_playwright
W = int(sys.argv[1]) if len(sys.argv) > 1 else 1920
H = int(sys.argv[2]) if len(sys.argv) > 2 else 1080
SECS = int(sys.argv[3]) if len(sys.argv) > 3 else 150
SECTOR = int(sys.argv[4]) if len(sys.argv) > 4 else 0
OUT = os.environ.get('SHOTS', '/tmp/claude-0/shots')
INIT = r"""
window.__A = { frames: 0, v: {bannerChip:0, shownNotTypable:0, typableNotShown:0, typableOffscreen:0, chipInHud:0, popChip:0, bannerPop:0, botRejected:0, multiBanner:0, chipOffscreen:0}, att: 0, ex: {}, banners: [], seen: {}, vis: [] };
const hit=(a,b)=>a.x0<b.x1&&a.x1>b.x0&&a.y0<b.y1&&a.y1>b.y0;
function note(k, d){ window.__A.v[k]++; if(!window.__A.ex[k]) window.__A.ex[k]=d; }
let lastKey=null, lastBanner=null;
function frame(){
  requestAnimationFrame(frame);
  const d = window.__SS_AUDIT_DATA && window.__SS_AUDIT_DATA(); if(!d) return;
  const A=window.__A; A.frames++;
  const ids = new Set(d.chips.map(c=>c.id));
  const live=new Set(d.enemies.map(e=>e.id)); for(const id in A.seen) if(!live.has(+id)) A.seen[id].end=true;
  for(const e of d.enemies){
    if(e.delay>0) continue;
    const chip = ids.has(e.id);
    if(chip && !e.typable && !e.doomed) note('shownNotTypable',{type:e.type});
    if(e.typable && !chip) note('typableNotShown',{type:e.type,top:e.spriteTop});
    if(e.typable && e.spriteTop < d.top) note('typableOffscreen',{type:e.type,top:e.spriteTop});
    if(e.typable && !A.seen[e.id]) A.seen[e.id]={t:d.t,type:e.type};
    if(A.seen[e.id]) A.seen[e.id].last=d.t;
  }
  for(const c of d.chips){
    if(c.y0 < d.safeTop-1) note('chipInHud',{y0:c.y0,safe:d.safeTop});
    if(c.x0 < d.vx || c.x1 > d.vx+d.vw || c.y1 > d.bottom) note('chipOffscreen',{c});
    if(d.banner && d.banner.rect && hit(d.banner.rect,c)) note('bannerChip',{b:d.banner.title,c});
  }
  for(const p of d.pops){ for(const c of d.chips) if(hit(p,c)) note('popChip',{p,c}); if(d.banner&&d.banner.rect&&hit(p,d.banner.rect)) note('bannerPop',{}); }
  const bk = d.banner ? d.banner.key+':'+d.banner.title : null;
  if(bk && bk!==lastBanner){ A.banners.push({k:bk,t:d.t,mode:d.mode}); }
  lastBanner=bk;
}
requestAnimationFrame(frame);
// bot: types visible (chip-drawn) words only
window.__bot = { cps: 5, on: !%IDLE% };
setInterval(()=>{
  if(!window.__bot.on) return;
  const st=window.__SS_STATE&&window.__SS_STATE(); const d=window.__SS_AUDIT_DATA&&window.__SS_AUDIT_DATA(); if(!st||!d||st.mode!=='fight'||d.state!=='play') return;
  const A=window.__A; const drawn=new Set(d.chips.map(c=>c.id));
  let t = st.enemies.find(e=>e.locked);
  if(!t){ const c=st.enemies.filter(e=>drawn.has(e.id)&&e.type!=='powerup'||drawn.has(e.id)).sort((a,b)=>b.danger-a.danger); t=c[0]; }
  if(!t) return; const k=t.next; if(!k) return;
  const before = t.pos;
  A.att++;
  window.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));
  const st2=window.__SS_STATE(); const t2=st2.enemies.find(e=>e.id===t.id);
  const anyLocked = st2.enemies.some(e=>e.locked);
  if(!t.locked && !anyLocked && !(t2&&t2.pos>before) && t2) note('botRejected',{text:t.text,type:t.type,k:k,pos:t.pos,keep:t.keep,seen:t.seen,ok:t.ok,locks:st.enemies.filter(e=>e.locked).length,boss:st.boss});
}, 200);
"""
INIT = INIT.replace('%IDLE%', 'true' if os.environ.get('IDLE') else 'false')
srv = subprocess.Popen(['python3', '-m', 'http.server', '8785'], cwd='/home/claude/type', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda x: errs.append('PAGEERR ' + str(x)))
    pg.add_init_script(INIT)
    pg.goto('http://localhost:8785/star-sweep/index.html?deck=nh5-u1&quiet=1&dev=1'); pg.wait_for_timeout(2500)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(5000)
    pg.evaluate("window.__ssDev.god(true)")
    BW = 3 if os.environ.get("BOSS") else 0
    if SECTOR or BW: pg.evaluate("window.__ssDev.goto(%d,%d)" % (SECTOR, BW))
    last = None; n = 0; t0 = time.time(); shots = 0
    while time.time() - t0 < SECS:
        pg.wait_for_timeout(120)
        info = pg.evaluate("(()=>{const d=window.__SS_AUDIT_DATA();return d?{b:d.banner&&d.banner.key+':'+d.banner.title,mode:d.mode}:null})()")
        if not info: continue
        bk = info['b']
        if bk and bk != last:
            pg.wait_for_timeout(450)
            pg.screenshot(path=f'{OUT}/ss_{W}x{H}_{n:02d}_{bk.replace(":","_").replace(" ","")[:24]}.png'); n += 1
        last = bk
        st = pg.evaluate("window.__SS_STATE()")
        if st and st['mode'] == 'fight' and st.get('boss') and shots < 3 and len(st['enemies']) and int(time.time()) % 6 == 0:
            pg.screenshot(path=f'{OUT}/ss_{W}x{H}_boss{shots}.png'); shots += 1; time.sleep(1)
        # once the first sector's normal waves are done, hop to its boss wave to test it
        if st and st['sector'] == SECTOR and st['wave'] == 2 and st['mode'] == 'clear' and not getattr(sys, '_hopped', False):
            pass
    pg.screenshot(path=f'{OUT}/ss_{W}x{H}_final.png')
    A = pg.evaluate("window.__A")
    print('frames', A['frames'], 'bot attempts', A['att'], 'enemies typable', len(A['seen']))
    print('violations', json.dumps(A['v'])); print('examples', json.dumps(A['ex'])[:900])
    import collections
    dur=collections.defaultdict(list)
    for k,v in A['seen'].items():
      if v.get('end'): dur[v['type']].append(round(v['last']-v['t'],1))
    print('visible secs by type (min,n):', {k:(min(v),len(v)) for k,v in dur.items()})
    print('banners', [(x['k'], round(x['t'], 1), x['mode']) for x in A['banners']])
    print('errors', errs[:5])
    b.close()
finally:
    srv.terminate()
