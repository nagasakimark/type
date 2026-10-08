"""Overhead clearance test: simulates jumps at many speeds / lanes on every track and asserts the car's bounding box never
overlaps ANY overhead mesh (gantries, bridge, tunnel, neon arches) in the real three.js scene.  Run: python3 overhead-test.py"""
import sys, subprocess, time
from playwright.sync_api import sync_playwright
PORT = 8775
srv = subprocess.Popen(['python3', '-m', 'http.server', str(PORT)], cwd='/home/claude/type', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
JS = r"""
() => {
  const TT = window.TT, THREE = window.THREE, dbg = TT.debug, tr = dbg.ST.track, world = dbg.world;
  world.root.updateMatrixWorld(true);
  // collect triangle AABBs of every overhead mesh (world space)
  const tris = []; const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const meshes = [];
  world.root.traverse((o) => { if (o.userData && o.userData.overhead) o.traverse((m) => { if (m.isMesh && m.geometry) meshes.push(m); }); });
  for (const m of meshes) {
    const geo = m.geometry, pos = geo.attributes.position, idx = geo.index; const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      for (let k = 0; k < 3; k++) { const vi = idx ? idx.getX(i + k) : i + k; v[k].fromBufferAttribute(pos, vi).applyMatrix4(m.matrixWorld); }
      const b = new THREE.Box3().setFromPoints(v);
      // flat banner planes are real obstacles too (thin faces), so inflate a hair
      b.min.addScalar(-0.02); b.max.addScalar(0.02); tris.push(b);
    }
  }
  const car = new THREE.Box3(), o = {};
  const hl = TT.CAR.hl, hw = TT.CAR.hw, ch = TT.CAR.h;
  const overlaps = (x, y, z, fx, fz) => {
    // car box: oriented along the track -> use a conservative AABB around the oriented footprint
    const ex = Math.abs(fx) * hl + Math.abs(fz) * hw, ez = Math.abs(fz) * hl + Math.abs(fx) * hw;
    car.min.set(x - ex, y, z - ez); car.max.set(x + ex, y + ch, z + ez);
    for (let i = 0; i < tris.length; i++) if (car.intersectsBox(tris[i])) return true;
    return false;
  };
  const res = { track: tr.def.id, meshes: meshes.length, tris: tris.length, jumps: tr.jumps.length, runs: 0, hits: [], maxTop: 0, minClear: 1e9, zones: tr.zones.map((z) => z.map((q) => Math.round(q))) };
  const dt = 1 / 120, G = TT.GRAV;
  for (const j of tr.jumps) for (let vel = 20; vel <= TT.V_MAX; vel += 8) for (const lat of [-7.4, -3, 0, 3, 7.4]) {
    // drive up the ramp (follow the ground), launch exactly as game.js does, fly until touchdown
    let s = j.s0 + j.len - vel * dt, y = tr.roadY(s, lat), prevY = y;
    let air = false, vy = 0, steps = 0;
    while (steps++ < 2400) {
      s += vel * dt; const gy = tr.roadY(s, lat);
      if (!air) {
        const vyG = (gy - prevY) / dt; prevY = y;
        if (y - gy > 0.5 && (y - prevY) !== undefined && s > j.s0 + j.len - 0.0001) { /* handled below */ }
        y = gy;
        if (s >= j.s0 + j.len) { // top of the ramp: next sample drops, car launches
          const slope = j.h / j.len * vel; air = true; vy = TT.launchVy(slope, vel); y = tr.roadY(j.s0 + j.len - 1e-3, lat);
        }
      } else {
        vy -= G * dt; y += vy * dt; if (y <= gy && vy < 0) break;
      }
      tr.at(s, o); const x = o.x + o.rx * lat, z = o.z + o.rz * lat;
      res.maxTop = Math.max(res.maxTop, y + ch - tr.baseY(s));
      const c = tr.ceilingAt(s, lat); if (c < 1e8) res.minClear = Math.min(res.minClear, c - (y + ch));
      if (overlaps(x, y, z, o.fx, o.fz)) { res.hits.push({ s: Math.round(s), vel, lat, y: +y.toFixed(2) }); break; }
    }
    res.runs++;
  }
  // also: the catalogue (used by the in-game clamp) must be at least as strict as the meshes -> every gantry/bridge/neon is catalogued
  res.catalogue = tr.overhead.length;
  return res;
}
"""
ok = True
NEG = '--neg' in sys.argv
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    for i in range(3):
        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        errs = []
        pg.on('pageerror', lambda x, e=errs: e.append(str(x)))
        pg.goto(f'http://localhost:{PORT}/turbo-type/index.html?deck=nh5-u1&quiet=1')
        pg.evaluate(f"TM.store.set('turbo.track', {i})")
        pg.reload(); pg.wait_for_function("window.TT && TT.debug && TT.debug.ST.ready && TT.debug.world && TT.debug.ST.track", timeout=60000)
        pg.wait_for_timeout(1500)
        if NEG:  # negative control: drop an old-style gantry (beam underside 6.8 m) 40 m after the first ramp
            pg.evaluate("""() => { const tr = TT.debug.ST.track, j = tr.jumps[0], o = {}; tr.at(j.s0 + j.len + 40, o);
              const m = new THREE.Mesh(new THREE.BoxGeometry(24, 3.2, 1.6), new THREE.MeshBasicMaterial()); m.position.set(o.x, o.y + 10 - 1.6, o.z); m.rotation.y = Math.atan2(o.fx, o.fz);
              m.userData.overhead = true; TT.debug.world.root.add(m); }""")
        r = pg.evaluate(JS)
        print(r['track'], {k: r[k] for k in ('meshes', 'tris', 'runs', 'maxTop', 'minClear', 'catalogue')}, 'zones', r['zones'], 'HITS', len(r['hits']), r['hits'][:3], errs[:2])
        if r['hits'] or errs or r['meshes'] < 1: ok = False
        pg.close()
    b.close()
srv.terminate()
print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
