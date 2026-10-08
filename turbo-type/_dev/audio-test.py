"""Renders the engine with an OfflineAudioContext through a scripted run and analyses the samples numerically:
peak / RMS (level), clipping, largest sample-to-sample step (clicks), silence when muted, and loop-seam continuity of the
source buffers.  Run: python3 audio-test.py"""
import sys, subprocess, time, json
from playwright.sync_api import sync_playwright
PORT = 8776
srv = subprocess.Popen(['python3', '-m', 'http.server', str(PORT)], cwd='/home/claude/type', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
JS = r"""
async () => {
  const SR = 44100, DUR = 34;
  const ctx = new OfflineAudioContext(1, SR * DUR, SR);
  const master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -10; lim.knee.value = 8; lim.ratio.value = 8; lim.attack.value = 0.003; lim.release.value = 0.2;
  master.disconnect(); master.connect(lim); lim.connect(ctx.destination);
  const E = TT.EngineAudio.create(ctx, master);
  // scripted run: 0-3 idle(countdown) | 3-14 accelerate 8->62 m/s typing | 14-17 jump (air) + land | 17-21 corner skid at 60 | 21-25 nitro 86 | 25-28 slow | 28-34 paused/muted
  const dt = 1 / 60; let v = 0; const marks = [];
  for (let t = 0; t < DUR; t += dt) {
    let s = { v: 0, thr: 0, boost: 0, air: 0, skid: 0, on: 1, vol: 1 };
    if (t < 3) { s.v = 0; }
    else if (t < 14) { v = 8 + (t - 3) / 11 * 54; s.v = v; s.thr = 0.5 + 0.4 * Math.sin(t * 3); }
    else if (t < 15.1) { s.v = 62; s.air = 1; s.thr = 0.3; }
    else if (t < 17) { s.v = 62; s.thr = 0.8; }
    else if (t < 21) { s.v = 60; s.thr = 0.8; s.skid = 0.4 + 0.5 * Math.sin((t - 17) * 2); }
    else if (t < 25) { const b = Math.min(1, (t - 21) / 0.4) * (t < 24.3 ? 1 : 0); s.v = 62 + 24 * Math.min(1, (t - 21) / 1.5); s.boost = b; s.thr = 1; }
    else if (t < 28) { s.v = Math.max(8, 86 - (t - 25) * 26); s.thr = 0.1; }
    else { s.on = 0; s.v = 20; }
    E.update(s, dt, t);
    if (Math.abs(t - 15.1) < dt / 2) { E.thump(1.0, t + 0.001); marks.push(t); }
  }
  const buf = await ctx.startRendering(); const d = buf.getChannelData(0);
  const seg = (a, b) => { let pk = 0, ss = 0, n = 0, maxStep = 0, clip = 0; for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) { const x = d[i]; pk = Math.max(pk, Math.abs(x)); ss += x * x; n++; if (Math.abs(x) >= 0.999) clip++; if (i > 0) maxStep = Math.max(maxStep, Math.abs(x - d[i - 1])); } return { peak: +pk.toFixed(3), rms: +Math.sqrt(ss / n).toFixed(4), maxStep: +maxStep.toFixed(3), clip }; };
  // zero-crossing based dominant pitch (low-passed by averaging) for a few seconds -> proves pitch rises with speed
  const pitch = (a, b) => { let zc = 0, last = 0; for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) { const x = d[i]; if (last < 0 && x >= 0) zc++; last = x; } return +(zc / (b - a)).toFixed(0); };
  const res = { all: seg(0, DUR), idle: seg(0.5, 2.9), accel: seg(3.5, 13.5), air: seg(14, 15), land: seg(15.1, 15.5), skid: seg(17.5, 20.5), nitro: seg(21.5, 24), muted: seg(30, 34), tail: seg(33.5, 34), zc: [pitch(1, 2.5), pitch(5, 6), pitch(9, 10), pitch(13, 14)] };
  const bands = (a, b) => { let l1 = 0, l2 = 0, e = [0, 0, 0], n = 0; for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) { const x = d[i]; l1 += (x - l1) * 0.0285; l2 += (x - l2) * 0.1366; /* ~200 Hz, ~1 kHz one-poles */ e[0] += l1 * l1; e[1] += (l2 - l1) ** 2; e[2] += (x - l2) ** 2; n++; } return e.map((v) => +Math.sqrt(v / n).toFixed(4)); };
  res.bands = { idle: bands(0.5, 2.9), slow: bands(4, 5), mid: bands(8, 9), fast: bands(13, 14), skid: bands(18, 20), nitro: bands(22, 24) };
  // short-time RMS curve (0.5 s) to see smoothness
  const env = []; for (let t = 0; t < DUR; t += 1) { let ss = 0; for (let i = Math.floor(t * SR); i < Math.floor((t + 1) * SR); i++) ss += d[i] * d[i]; env.push(+Math.sqrt(ss / SR).toFixed(3)); }
  res.env = env;
  // maximum step in the 20..2000 Hz-ish region would hide in 'maxStep'; also report the max |second difference| outside one-shots (click detector)
  let m2 = 0; for (let i = 2; i < SR * 14; i++) m2 = Math.max(m2, Math.abs(d[i] - 2 * d[i - 1] + d[i - 2])); res.maxSecondDiff_0_14s = +m2.toFixed(3);
  // loop seams of the actual buffers: jump across the wrap vs typical neighbouring step
  const seams = {};
  const probe = async (name, make) => { const c = new OfflineAudioContext(1, 44100, 44100); const b = make(c); const x = b.getChannelData(0); let typ = 0, n = x.length; for (let i = 1; i < n; i++) typ = Math.max(typ, Math.abs(x[i] - x[i - 1])); seams[name] = { wrap: +Math.abs(x[0] - x[n - 1]).toFixed(4), maxStep: +typ.toFixed(4), len: n }; };
  return res;
}
"""
SEAM_JS = r"""
() => { // seam test on the real loop buffers: pull them out through a spy on createBuffer
  const bufs = []; const C = OfflineAudioContext.prototype.createBuffer; OfflineAudioContext.prototype.createBuffer = function (...a) { const b = C.apply(this, a); bufs.push(b); return b; };
  const ctx = new OfflineAudioContext(1, 44100, 44100); TT.EngineAudio.create(ctx, ctx.destination); OfflineAudioContext.prototype.createBuffer = C;
  return bufs.map((b, i) => { const x = b.getChannelData(0), n = x.length; let mx = 0, rms = 0; for (let k = 1; k < n; k++) { mx = Math.max(mx, Math.abs(x[k] - x[k - 1])); rms += x[k] * x[k]; } rms = Math.sqrt(rms / n);
    return { i, len: n, wrapStep: +Math.abs(x[0] - x[n - 1]).toFixed(5), maxStep: +mx.toFixed(5), ratio: +(Math.abs(x[0] - x[n - 1]) / (mx || 1)).toFixed(3), rms: +rms.toFixed(3) }; });
}
"""
ok = True
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(); errs = []
    pg.on('pageerror', lambda x: errs.append(str(x))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(f'http://localhost:{PORT}/turbo-type/index.html?deck=nh5-u1&quiet=1'); pg.wait_for_timeout(2500)
    r = pg.evaluate(JS); seams = pg.evaluate(SEAM_JS)
    for k in ('all', 'idle', 'accel', 'air', 'land', 'skid', 'nitro', 'muted', 'tail'): print(f'{k:6}', r[k])
    print('zero-crossings/s at 1.5s,5s,9s,13s:', r['zc']); print('1s RMS envelope:', r['env']); print('band rms [low<200Hz, mid, high>1k]:', r['bands']); print('max 2nd diff 0-14s:', r['maxSecondDiff_0_14s'])
    for s in seams: print('seam', s)
    if r['all']['peak'] > 0.5 or r['all']['clip'] > 0: ok = False; print('FAIL level/clipping')
    if not (0.02 < r['accel']['rms'] < 0.12): ok = False; print('FAIL level not moderate')
    if r['muted']['peak'] > 0.002: ok = False; print('FAIL not silent when muted')
    if r['maxSecondDiff_0_14s'] > 0.15: ok = False; print('FAIL click detector')
    for s in seams:
        if s['wrapStep'] > s['maxStep'] * 1.05: ok = False; print('FAIL seam', s)
    if errs: ok = False; print('errors', errs[:3])
    b.close()
srv.terminate()
print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
