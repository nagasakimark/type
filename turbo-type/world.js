/* Turbo Type - the three.js world: renderer, sky, terrain, road mesh, scenery, cars, particles. */
(function () {
  'use strict';
  const TT = (window.TT = window.TT || {});
  const THREE = window.THREE;
  const { Vector3, Matrix4, Quaternion, Euler, Color } = THREE;
  const MODEL_BASE = '../assets/kenney/turbo-type/models/';
  const CAR_SCALE = 3.4;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  TT.CAR_SCALE = CAR_SCALE;

  /* ---------- deterministic noise ---------- */
  function hash(ix, iz, seed) {
    let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }
  function vnoise(x, z, seed) {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    return lerp(lerp(hash(ix, iz, seed), hash(ix + 1, iz, seed), u), lerp(hash(ix, iz + 1, seed), hash(ix + 1, iz + 1, seed), u), v);
  }
  const fbm = (x, z, seed) => 0.55 * vnoise(x, z, seed) + 0.28 * vnoise(2 * x, 2 * z, seed + 1) + 0.17 * vnoise(4 * x, 4 * z, seed + 2);
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  /* ---------- models ---------- */
  const NAMES = ['raceCarRed', 'raceCarGreen', 'raceCarOrange', 'raceCarWhite', 'treeLarge', 'treeSmall', 'grandStand', 'grandStandCovered', 'grandStandAwning',
    'barrierWall', 'barrierRed', 'barrierWhite', 'fenceStraight', 'flagCheckers', 'flagGreen', 'flagRed', 'bannerTowerRed', 'bannerTowerGreen', 'lightPostLarge', 'lightPostModern',
    'pylon', 'tent', 'tentClosed', 'billboard', 'billboardLow', 'pitsGarage', 'pitsOffice', 'lightRedDouble'];
  const Models = {
    map: {}, fallback: false, fb: {},
    async load() {
      if (location.protocol === 'file:' || !THREE.GLTFLoader) { this.fallback = true; return; }
      const loader = new THREE.GLTFLoader();
      await Promise.all(NAMES.map((n) => new Promise((res) => {
        loader.load((TT.MODEL_BASE || MODEL_BASE) + n + '.glb', (g) => { try { this.map[n] = extract(g.scene); } catch (e) { /* ignore */ } res(); }, undefined, () => res());
      })));
      if (!this.map.raceCarRed) this.fallback = true;
    },
    get(name) { return this.map[name] || (this.fb[name] || (this.fb[name] = fallbackModel(name))); },
  };
  function extract(scene) {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene), c = box.getCenter(new Vector3());
    const parts = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); geo.translate(-c.x, -box.min.y, -c.z);
      const mat = o.material; if (mat.isMeshStandardMaterial) { mat.metalness = 0; mat.roughness = 0.75; }
      parts.push({ geo, mat });
    });
    const size = box.getSize(new Vector3());
    return { parts, size };
  }
  function fallbackModel(name) {
    const mk = (w, h, d, col, x = 0, y = 0, z = 0, cone) => {
      const geo = cone ? new THREE.ConeGeometry(w, h, 6) : new THREE.BoxGeometry(w, h, d); geo.translate(x, y + h / 2, z);
      return { geo, mat: new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }) };
    };
    let parts;
    if (name.startsWith('raceCar')) {
      const col = { raceCarRed: 0xe5484d, raceCarGreen: 0x3cb878, raceCarOrange: 0xff8a1f, raceCarWhite: 0xf2f2f6 }[name] || 0xcccccc;
      parts = [mk(0.5, 0.16, 1.2, col, 0, 0.08), mk(0.3, 0.14, 0.4, 0x333344, 0, 0.22, -0.05), mk(0.14, 0.2, 0.28, 0x222222, -0.3, 0, 0.35), mk(0.14, 0.2, 0.28, 0x222222, 0.3, 0, 0.35), mk(0.14, 0.2, 0.28, 0x222222, -0.3, 0, -0.35), mk(0.14, 0.2, 0.28, 0x222222, 0.3, 0, -0.35)];
    } else if (name.startsWith('tree')) parts = [mk(0.08, 0.4, 0.08, 0x8a6a3b), mk(0.3, 1.2, 0, 0x4f9d63, 0, 0.3, 0, true)];
    else if (name.startsWith('grandStand')) parts = [mk(1, 0.35, 1, 0xdddddd), mk(1, 0.35, 0.6, 0xe86a6a, 0, 0.35, 0.2), mk(1, 0.3, 0.3, 0xe86a6a, 0, 0.7, 0.35)];
    else if (name.startsWith('barrier')) parts = [mk(1, 0.12, 0.12, name === 'barrierRed' ? 0xe86a6a : 0xf2f2f2)];
    else if (name.startsWith('flag')) parts = [mk(0.03, 1.2, 0.03, 0xdddddd), mk(0.3, 0.2, 0.02, name === 'flagGreen' ? 0x4caf50 : name === 'flagRed' ? 0xe53935 : 0x333333, 0.15, 1, 0)];
    else if (name.startsWith('bannerTower')) parts = [mk(0.3, 1.2, 0.3, name.endsWith('Red') ? 0xe86a6a : 0x4caf50)];
    else if (name.startsWith('light')) parts = [mk(0.04, 0.7, 0.04, 0xdddddd), mk(0.2, 0.06, 0.1, 0xfff3b0, 0.08, 0.7)];
    else if (name.startsWith('tent')) parts = [mk(0.9, 0.35, 0.9, 0xe86a6a), mk(0.6, 0.3, 0, 0xe86a6a, 0, 0.35, 0, true)];
    else if (name.startsWith('billboard')) parts = [mk(1, 0.5, 0.05, 0x222222, 0, 0.35), mk(0.05, 0.4, 0.05, 0xdddddd, -0.4)];
    else if (name.startsWith('pits')) parts = [mk(1, 0.6, 1, 0xf2f2f2)];
    else parts = [mk(0.12, 0.12, 0.12, 0xf2c14e)];
    return { parts, size: new Vector3(1, 1, 1) };
  }

  /* ---------- canvas textures ---------- */
  function canvasTex(w, h, draw, opts = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return t;
  }
  function asphaltTex(theme) {
    return canvasTex(256, 512, (g, w, h) => {
      g.fillStyle = theme.road; g.fillRect(0, 0, w, h);
      const r = rng(7);
      for (let i = 0; i < 5200; i++) { const v = r(); g.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.06)'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
      // darker tyre lanes
      g.fillStyle = 'rgba(0,0,0,0.10)'; for (const u of [0.125, 0.375, 0.625, 0.875]) { g.fillRect(w * (u - 0.045), 0, w * 0.03, h); g.fillRect(w * (u + 0.015), 0, w * 0.03, h); }
      g.fillStyle = theme.line;
      g.fillRect(w * 0.03, 0, w * 0.014, h); g.fillRect(w * 0.956, 0, w * 0.014, h);
      for (const u of [0.25, 0.5, 0.75]) for (let k = 0; k < 2; k++) g.fillRect(w * u - 3, k * h / 2 + 12, 6, h / 4);
    }, { repeat: true });
  }
  function kerbTex() {
    return canvasTex(32, 128, (g, w, h) => { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#e63946'; g.fillRect(0, i * h / 4, w, h / 4); } }, { repeat: true });
  }
  function chevronTex(c1, c2, angle) {
    return canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = c1; g.fillRect(0, 0, w, h); g.fillStyle = c2; g.save(); g.translate(w / 2, h / 2); g.rotate(angle);
      for (let i = -4; i < 5; i++) g.fillRect(-w, i * 32, w * 2, 16); g.restore();
    }, { repeat: true });
  }
  function padTex(a, b) {
    return canvasTex(128, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.08, a); gr.addColorStop(0.92, a); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = b; g.lineWidth = 16; g.strokeStyle = b; g.lineCap = 'round';
      for (let i = 0; i < 2; i++) { const y = 20 + i * 128; g.beginPath(); g.moveTo(w * 0.2, y + 70); g.lineTo(w * 0.5, y); g.lineTo(w * 0.8, y + 70); g.stroke(); }
    }, { repeat: true });
  }
  function checkerTex(cols, rows, c1 = '#ffffff', c2 = '#1b1b2b') {
    return canvasTex(cols * 16, rows * 16, (g) => { for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { g.fillStyle = (x + y) % 2 ? c1 : c2; g.fillRect(x * 16, y * 16, 16, 16); } });
  }
  function bannerTex(text, bg, fg, w = 1024, h = 128) {
    return canvasTex(w, h, (g) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = fg; for (let i = 0; i < w; i += 64) { g.fillRect(i, 0, 32, 10); g.fillRect(i + 32, h - 10, 32, 10); }
      g.font = '800 ' + (h * 0.62) + 'px "Baloo 2", Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h * 0.54);
    });
  }
  function glowTex() {
    return canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  }

  /* ---------- themes ---------- */
  const THEMES = {
    sunny: {
      sky: { top: '#3d8bff', mid: '#8fc8ff', hor: '#d9efff', sun: [0.35, 0.8, 0.3], sunCol: '#fff2cf', clouds: 0.62, stars: 0 },
      fog: '#cfe6f7', fogD: 0.00135, exposure: 1.0, hemi: [0xdbeeff, 0x6f9a5b, 1.25], sunI: 2.6, sunC: 0xfff0d6, ambient: 0.0,
      grass: ['#6ccf4f', '#5bbd45'], dirt: '#c9b27a', road: '#3b3f4a', line: '#f4f4f4', hill: ['#7ec07a', '#9ad092'], hillAmp: 14, base: 0, snow: false, mount: ['#6fae7a', '#9cc7a8', 220],
    },
    rally: {
      sky: { top: '#f08a5d', mid: '#ffc58f', hor: '#ffe9c4', sun: [-0.5, 0.35, 0.6], sunCol: '#fff0c4', clouds: 0.5, stars: 0 },
      fog: '#f3d9b4', fogD: 0.0017, exposure: 1.0, hemi: [0xffe1c2, 0x7a6448, 1.2], sunI: 2.9, sunC: 0xffd9a0, ambient: 0.0,
      grass: ['#8aa857', '#7a9a4c'], dirt: '#b99a64', road: '#6e5a45', line: '#f3e8d4', hill: ['#8e9a58', '#b1a770'], hillAmp: 38, base: 0, snow: true, mount: ['#8a7a6a', '#c9b8a0', 320],
    },
    night: {
      sky: { top: '#050824', mid: '#1b2260', hor: '#503a8c', sun: [-0.3, 0.45, -0.6], sunCol: '#dfe8ff', clouds: 0.15, stars: 1 },
      fog: '#2a2358', fogD: 0.0026, exposure: 1.15, hemi: [0x8a96ff, 0x2a2f55, 1.7], sunI: 1.5, sunC: 0xa7b8ff, ambient: 0.0,
      grass: ['#2f6e52', '#285f48'], dirt: '#4a4f6a', road: '#2d303c', line: '#e8f0ff', hill: ['#25456a', '#2d5a7a'], hillAmp: 22, base: 0, snow: false, mount: ['#1a2350', '#2a3a78', 240], night: true,
    },
  };
  TT.THEMES = THEMES;

  /* ---------- sky ---------- */
  function makeSky(theme) {
    const s = theme.sky;
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTop: { value: new Color(s.top) }, uMid: { value: new Color(s.mid) }, uHor: { value: new Color(s.hor) }, uSun: { value: new Vector3(...s.sun).normalize() }, uSunC: { value: new Color(s.sunCol) },
        uT: { value: 0 }, uClouds: { value: s.clouds }, uStars: { value: s.stars },
      },
      vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
      fragmentShader: `
        varying vec3 vD; uniform vec3 uTop,uMid,uHor,uSun,uSunC; uniform float uT,uClouds,uStars;
        float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
        float fbm(vec2 p){ return .5*vn(p)+.25*vn(p*2.03)+.125*vn(p*4.1)+.0625*vn(p*8.3); }
        void main(){
          vec3 d = normalize(vD); float y = max(d.y,0.0);
          vec3 col = mix(uHor, uMid, smoothstep(0.0,0.18,y)); col = mix(col, uTop, smoothstep(0.1,0.8,y));
          float sd = max(dot(d,normalize(uSun)),0.0);
          col += uSunC * (pow(sd,900.)*3.0 + pow(sd,40.)*0.25 + pow(sd,6.)*0.08);
          if (d.y > 0.02) {
            vec2 cp = d.xz / (d.y*0.9 + 0.25) * 1.3 + vec2(uT*0.012, 0.0);
            float c = fbm(cp*1.4); c = smoothstep(1.0-uClouds*0.6-0.12, 1.0-uClouds*0.6+0.12, c) * smoothstep(0.02,0.25,d.y);
            vec3 cc = mix(vec3(1.0), uHor*0.8+0.2, 0.25); if (uStars>0.5) cc = uMid*1.5;
            col = mix(col, cc, c*0.9*(uStars>0.5?0.35:1.0));
            if (uStars>0.5){ vec2 sp = floor(d.xz/(d.y+0.3)*90.0); float st = step(0.985,h21(sp)); col += vec3(st)*smoothstep(0.1,0.5,y)*(0.6+0.4*sin(uT*3.+h21(sp)*30.)); col += vec3(0.9,0.95,1.0)*pow(sd,2200.)*2.0; }
          }
          col = mix(col, uHor, smoothstep(0.02,-0.1,d.y));
          gl_FragColor = vec4(col,1.0);
        }`,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 20), mat); m.frustumCulled = false; m.renderOrder = -10;
    return m;
  }

  /* ---------- particles ---------- */
  class Particles {
    constructor(max, additive) {
      this.max = max; this.i = 0;
      this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
      this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.age = new Float32Array(max).fill(99); this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.c0 = new Float32Array(max * 4);
      this.grav = new Float32Array(max); this.drag = new Float32Array(max);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
      this.mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uScale: { value: 500 } },
        vertexShader: 'attribute vec4 aColor; attribute float aSize; uniform float uScale; varying vec4 vC; void main(){ vC=aColor; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = aSize*uScale/max(0.1,-mv.z); gl_Position = projectionMatrix*mv; }',
        fragmentShader: 'varying vec4 vC; void main(){ float d=length(gl_PointCoord-0.5)*2.0; float a=smoothstep(1.0,0.15,d); gl_FragColor=vec4(vC.rgb, vC.a*a); }',
      });
      this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 6 : 5;
      this.geo = g;
      for (let k = 0; k < max; k++) this.pos[k * 3 + 1] = -9999;
    }
    emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav = 0, drag = 0.5) {
      const k = this.i; this.i = (this.i + 1) % this.max;
      this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z; this.vel[k * 3] = vx; this.vel[k * 3 + 1] = vy; this.vel[k * 3 + 2] = vz;
      this.life[k] = life; this.age[k] = 0; this.s0[k] = s0; this.s1[k] = s1; this.c0[k * 4] = r; this.c0[k * 4 + 1] = g; this.c0[k * 4 + 2] = b; this.c0[k * 4 + 3] = a; this.grav[k] = grav; this.drag[k] = drag;
    }
    emitStatic(x, y, z, size, r, g, b, a) { this.emit(x, y, z, 0, 0, 0, 1e9, size, size, r, g, b, a); this.age[(this.i + this.max - 1) % this.max] = 5e8; }
    update(dt) {
      const { pos, vel, life, age, col, size, s0, s1, c0, grav, drag } = this;
      for (let k = 0; k < this.max; k++) {
        if (age[k] >= life[k]) { if (size[k] !== 0) { size[k] = 0; pos[k * 3 + 1] = -9999; } continue; }
        age[k] += dt; const t = clamp(age[k] / life[k], 0, 1);
        const dr = Math.exp(-drag[k] * dt);
        vel[k * 3] *= dr; vel[k * 3 + 2] *= dr; vel[k * 3 + 1] = vel[k * 3 + 1] * dr - grav[k] * dt;
        pos[k * 3] += vel[k * 3] * dt; pos[k * 3 + 1] += vel[k * 3 + 1] * dt; pos[k * 3 + 2] += vel[k * 3 + 2] * dt;
        size[k] = lerp(s0[k], s1[k], t);
        col[k * 4] = c0[k * 4]; col[k * 4 + 1] = c0[k * 4 + 1]; col[k * 4 + 2] = c0[k * 4 + 2]; col[k * 4 + 3] = c0[k * 4 + 3] * (1 - t) * Math.min(1, t * 14);
      }
      this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aColor.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true;
    }
  }

  /* ---------- instancing helper ---------- */
  class Inst {
    constructor() { this.items = new Map(); }
    add(name, m, color) { let a = this.items.get(name); if (!a) this.items.set(name, (a = [])); a.push({ m, color }); }
    build(root, castSet) {
      const out = [];
      for (const [name, arr] of this.items) {
        const model = Models.get(name);
        for (const p of model.parts) {
          const im = new THREE.InstancedMesh(p.geo, p.mat, arr.length);
          arr.forEach((it, i) => { im.setMatrixAt(i, it.m); if (it.color) im.setColorAt(i, it.color); });
          im.instanceMatrix.needsUpdate = true; im.castShadow = castSet ? castSet.has(name) : false; im.receiveShadow = true; im.frustumCulled = false;
          root.add(im); out.push(im);
        }
      }
    }
  }
  const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3();
  function M4(x, y, z, yaw, sx, sy, sz) { _e.set(0, yaw, 0); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(sx, sy == null ? sx : sy, sz == null ? sx : sz); return new Matrix4().compose(_v, _q, _s); }

  /* ---------- the World ---------- */
  class World {
    constructor(canvas) {
      this.canvas = canvas;
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
      const r = this.renderer;
      r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 3000);
      this.root = new THREE.Group(); this.scene.add(this.root);
      this.cars = []; this.t = 0; this.quality = 2; this.baseFov = 60; this.fovKick = 0; this.viewShift = 0;
      this.tmp = {}; this.glowTex = glowTex();
      this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1); this.scene.add(this.hemi);
      this.sun = new THREE.DirectionalLight(0xffffff, 2.5); this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1536, 1536); const sc = this.sun.shadow.camera; sc.left = -46; sc.right = 46; sc.top = 46; sc.bottom = -46; sc.near = 1; sc.far = 260;
      this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.35;
      this.scene.add(this.sun, this.sun.target);
      this.dust = new Particles(900, false); this.glow = new Particles(700, true);
      this.scene.add(this.dust.points, this.glow.points);
      this.shadowOn = true; this.pr = 1;
      this.resize();
    }
    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, this.quality >= 2 ? 1.75 : this.quality === 1 ? 1.25 : 1) * (this.quality < 0 ? 0.75 : 1);
      this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h, false);
      this.w = w; this.h = h; this.camera.aspect = w / h;
      this.applyFov();
    }
    setQuality(q) {
      this.quality = q; this.renderer.shadowMap.enabled = q >= 1; this.shadowOn = q >= 1;
      this.sun.castShadow = q >= 1; this.resize();
      this.root.traverse((o) => { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
    }
    applyFov() {
      const a = this.camera.aspect, base = this.baseFov + this.fovKick;
      let v = base;
      // keep the horizontal field of view in a sane range for any window shape
      const h = 2 * Math.atan(Math.tan(base * Math.PI / 360) * (16 / 9));
      if (a < 16 / 9) v = Math.min(88, (2 * Math.atan(Math.tan(h / 2) / a)) * 180 / Math.PI * 0.9 + base * 0.1);
      this.camera.fov = v;
      if (this.viewShift > 0.5) this.camera.setViewOffset(this.w, this.h, 0, this.viewShift, this.w, this.h); else this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
      this.dust.mat.uniforms.uScale.value = this.glow.mat.uniforms.uScale.value = (this.renderer.domElement.height / 2) / Math.tan(v * Math.PI / 360);
    }
    setViewShift(px) { this.viewShift = px; }
    setFovKick(k) { if (Math.abs(k - this.fovKick) > 0.01) { this.fovKick = k; this.applyFov(); } }

    /* ---- build a whole track scene ---- */
    clearTrack() {
      const keep = new Set(); for (const k in Models.map) for (const p of Models.map[k].parts) { keep.add(p.geo); keep.add(p.mat); }
      this.root.traverse((o) => {
        if (o.geometry && !keep.has(o.geometry)) o.geometry.dispose();
        if (o.material) { for (const m of [].concat(o.material)) if (!keep.has(m)) { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); } }
        if (o.isInstancedMesh) o.dispose();
      });
      this.root.clear(); this.cars.length = 0; this.sky = null; this.podium = null; this.trophy = null;
    }
    build(track, quality) {
      this.clearTrack();
      const theme = THEMES[track.def.theme.id]; this.theme = theme; this.track = track;
      const sc = this.scene, r = this.renderer;
      sc.background = new Color(theme.fog); sc.fog = new THREE.FogExp2(theme.fog, theme.fogD);
      r.toneMappingExposure = theme.exposure;
      this.hemi.color.set(theme.hemi[0]); this.hemi.groundColor.set(theme.hemi[1]); this.hemi.intensity = theme.hemi[2];
      this.sun.color.set(theme.sunC); this.sun.intensity = theme.sunI;
      this.sunDir = new Vector3(...theme.sky.sun).normalize();
      this.sky = makeSky(theme); this.root.add(this.sky);
      this.buildTerrain(track, theme);
      this.buildRoad(track, theme);
      this.buildScenery(track, theme);
      this.buildMountains(track, theme);
      this.cars.length = 0;
    }

    /* ---- terrain: heightfield with embankments around the road ---- */
    buildTerrain(track, theme) {
      const M = 330, cell = 6, b = track.bounds, hw = track.width / 2;
      const x0 = Math.floor((b.x0 - M) / cell) * cell, z0 = Math.floor((b.z0 - M) / cell) * cell;
      const nx = Math.ceil((b.x1 - b.x0 + 2 * M) / cell) + 1, nz = Math.ceil((b.z1 - b.z0 + 2 * M) / cell) + 1;
      const R = 300, dist = new Float32Array(nx * nz).fill(R), near = new Int32Array(nx * nz).fill(-1);
      const { X, Z, N } = track, rr = Math.ceil(R / cell);
      for (let i = 0; i < N; i++) {
        const cx = Math.round((X[i] - x0) / cell), cz = Math.round((Z[i] - z0) / cell);
        for (let a = Math.max(0, cz - rr); a <= Math.min(nz - 1, cz + rr); a++) for (let c = Math.max(0, cx - rr); c <= Math.min(nx - 1, cx + rr); c++) {
          const dx = x0 + c * cell - X[i], dz = z0 + a * cell - Z[i], d = Math.sqrt(dx * dx + dz * dz), k = a * nx + c;
          if (d < dist[k]) { dist[k] = d; near[k] = i; }
        }
      }
      const pos = new Float32Array(nx * nz * 3), colr = new Float32Array(nx * nz * 3), H = new Float32Array(nx * nz);
      const c1 = new Color(theme.grass[0]), c2 = new Color(theme.grass[1]), cd = new Color(theme.dirt), ch = new Color(theme.hill[0]), ch2 = new Color(theme.hill[1]);
      const tmp = new Color();
      for (let a = 0; a < nz; a++) for (let c = 0; c < nx; c++) {
        const k = a * nx + c, x = x0 + c * cell, z = z0 + a * cell, d = dist[k], i = near[k];
        const nat = fbm(x * 0.0045, z * 0.0045, 3) - 0.5, nat2 = fbm(x * 0.02, z * 0.02, 9) - 0.5;
        let y;
        const edgeFade = smooth(0, 1, Math.min(1, Math.min(c, nx - 1 - c, a, nz - 1 - a) / 14));
        if (i >= 0) {
          const lat = (x - X[i]) * -track.FZ[i] + (z - Z[i]) * track.FX[i];
          const roadH = track.Y[i], bank = track.BANK[i];
          const banked = roadH - clamp(lat, -hw - 5, hw + 5) * Math.sin(bank) - 0.5;
          const w = smooth(hw + 3, hw + 70, d);
          const far = theme.base + (nat * theme.hillAmp * 2 + nat2 * 4) * smooth(hw + 20, hw + 130, d) + roadH * Math.exp(-Math.max(0, d - hw) / 100);
          y = lerp(banked, far, w);
        } else y = theme.base + (nat * theme.hillAmp * 2 + nat2 * 4);
        y = lerp(theme.base - 1, y, edgeFade);
        H[k] = y; pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
        // colour
        const stripe = ((Math.floor((x + z) / 14) & 1) ? 0 : 1);
        tmp.copy(stripe ? c1 : c2).lerp(ch, smooth(60, 260, d) * 0.55 + nat2 * 0.5);
        if (theme.night) tmp.multiplyScalar(0.75 + nat2 * 0.2);
        if (i >= 0 && d < hw + 11) tmp.lerp(cd, smooth(hw + 11, hw + 3, d) * 0.9);
        colr[k * 3] = tmp.r; colr[k * 3 + 1] = tmp.g; colr[k * 3 + 2] = tmp.b;
      }
      const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let q = 0;
      for (let a = 0; a < nz - 1; a++) for (let c = 0; c < nx - 1; c++) { const k = a * nx + c; idx[q++] = k; idx[q++] = k + nx; idx[q++] = k + 1; idx[q++] = k + 1; idx[q++] = k + nx; idx[q++] = k + nx + 1; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.computeVertexNormals();
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; mesh.frustumCulled = false; this.root.add(mesh);
      // flat plane to the horizon
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: tmp.copy(c2).lerp(ch, 0.1) }));
      pl.position.set((b.x0 + b.x1) / 2, theme.base - 1.05, (b.z0 + b.z1) / 2); this.root.add(pl);
      this.ter = { x0, z0, nx, nz, cell, H, dist, near };
    }
    groundY(x, z) {
      const t = this.ter; const fx = (x - t.x0) / t.cell, fz = (z - t.z0) / t.cell;
      const c = clamp(Math.floor(fx), 0, t.nx - 2), a = clamp(Math.floor(fz), 0, t.nz - 2), u = clamp(fx - c, 0, 1), v = clamp(fz - a, 0, 1), k = a * t.nx + c;
      return lerp(lerp(t.H[k], t.H[k + 1], u), lerp(t.H[k + t.nx], t.H[k + t.nx + 1], u), v);
    }
    distToRoad(x, z) {
      const t = this.ter; const c = clamp(Math.round((x - t.x0) / t.cell), 0, t.nx - 1), a = clamp(Math.round((z - t.z0) / t.cell), 0, t.nz - 1); return t.dist[a * t.nx + c];
    }

    /* ---- the road surface ---- */
    buildRoad(track, theme) {
      const { N, step, width: W, L } = track, hw = W / 2, o = {};
      const rows = N + 1;
      const strip = (latA, latB, yOff, vScale, extraYOff) => {
        const pos = new Float32Array(rows * 2 * 3), uv = new Float32Array(rows * 2 * 2), idx = [];
        for (let i = 0; i < rows; i++) {
          const s = i * step; track.at(s, o);
          for (let k = 0; k < 2; k++) {
            const lat = k ? latB : latA, p = (i * 2 + k) * 3;
            pos[p] = o.x + o.rx * lat; pos[p + 1] = o.y - lat * Math.sin(o.bank) + yOff; pos[p + 2] = o.z + o.rz * lat;
            uv[(i * 2 + k) * 2] = k; uv[(i * 2 + k) * 2 + 1] = s / vScale;
          }
          if (i < rows - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
        return g;
      };
      const roadMat = new THREE.MeshStandardMaterial({ map: asphaltTex(theme), roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      roadMat.map.repeat.set(1, 1); roadMat.map.anisotropy = 8;
      const road = new THREE.Mesh(strip(-hw, hw, 0.03, 16), roadMat); road.receiveShadow = true; this.root.add(road);
      const kt = kerbTex(); const kmat = new THREE.MeshStandardMaterial({ map: kt, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      for (const side of [-1, 1]) {
        const a = side < 0 ? -hw - 1.6 : hw, b = side < 0 ? -hw : hw + 1.6;
        const k = new THREE.Mesh(strip(a, b, 0.05, 8), kmat); k.receiveShadow = true; this.root.add(k);
      }
      // start / finish line + painted grid
      const sl = this.flatQuad(track, 0.0, 2.4, -hw, hw, 0.07, checkerTex(9, 2)); this.root.add(sl);
      // boost pads
      this.pads = [];
      track.pads.forEach((p, i) => {
        const tex = padTex(i % 2 ? 'rgba(255,160,40,0.55)' : 'rgba(40,200,255,0.55)', i % 2 ? '#fff3b0' : '#e8fcff');
        tex.repeat.set(1, 1);
        const m = this.flatQuad(track, p.s0, p.len, -hw + 1.2, hw - 1.2, 0.09, tex, true);
        m.material.blending = THREE.AdditiveBlending; m.material.transparent = true; m.material.depthWrite = false; this.root.add(m); this.pads.push(m);
      });
      // jump ramps
      this.ramps = track.jumps.map((j) => this.buildRamp(track, j));
    }
    flatQuad(track, s0, len, latA, latB, yOff, tex, basic) {
      const o = {}, segs = Math.max(1, Math.round(len / 2)), pos = [], uv = [], idx = [];
      for (let i = 0; i <= segs; i++) {
        const s = s0 + len * i / segs; track.at(s, o);
        for (let k = 0; k < 2; k++) { const lat = k ? latB : latA; pos.push(o.x + o.rx * lat, o.y - lat * Math.sin(o.bank) + yOff, o.z + o.rz * lat); uv.push(k, i / segs); }
        if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const mat = basic ? new THREE.MeshBasicMaterial({ map: tex, fog: true, toneMapped: false, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
      const m = new THREE.Mesh(g, mat); m.receiveShadow = !basic; return m;
    }
    buildRamp(track, j) {
      const o = {}, hw = track.width / 2, segs = 6, g = new THREE.Group();
      const top = [], uvt = [], idxT = [];
      for (let i = 0; i <= segs; i++) {
        const u = i / segs, s = j.s0 + j.len * u; track.at(s, o); const h = j.h * u;
        for (const lat of [-hw, hw]) top.push(o.x + o.rx * lat, o.y - lat * Math.sin(o.bank) + h + 0.06, o.z + o.rz * lat);
        uvt.push(0, u * 2, 1, u * 2);
        if (i < segs) { const a = i * 2; idxT.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const gt = new THREE.BufferGeometry(); gt.setAttribute('position', new THREE.Float32BufferAttribute(top, 3)); gt.setAttribute('uv', new THREE.Float32BufferAttribute(uvt, 2)); gt.setIndex(idxT); gt.computeVertexNormals();
      const tex = chevronTex('#ffcc1f', '#262338', Math.PI / 4); tex.repeat.set(3, 1);
      const mt = new THREE.Mesh(gt, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })); mt.castShadow = true; mt.receiveShadow = true; g.add(mt);
      // sides + back face
      const sp = [], si = [];
      track.at(j.s0, o); const A = o.x, Ay = o.y, Az = o.z, aR = [o.rx, o.rz], ab = o.bank;
      track.at(j.s0 + j.len, o); const B = o.x, By = o.y, Bz = o.z, bR = [o.rx, o.rz], bb = o.bank;
      const pt = (base, rv, y, lat, bank, h) => [base[0] + rv[0] * lat, y - lat * Math.sin(bank) + h, base[1] + rv[1] * lat];
      for (const lat of [-hw, hw]) {
        const a0 = pt([A, Az], aR, Ay, lat, ab, 0.06), a1 = pt([A, Az], aR, Ay, lat, ab, 0), b0 = pt([B, Bz], bR, By, lat, bb, 0.06 + j.h), b1 = pt([B, Bz], bR, By, lat, bb, 0);
        const n = sp.length / 3; sp.push(...a0, ...a1, ...b0, ...b1); si.push(n, n + 1, n + 2, n + 1, n + 3, n + 2, n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
      const bl = pt([B, Bz], bR, By, -hw, bb, 0.06 + j.h), br = pt([B, Bz], bR, By, hw, bb, 0.06 + j.h), bl0 = pt([B, Bz], bR, By, -hw, bb, 0), br0 = pt([B, Bz], bR, By, hw, bb, 0);
      const n = sp.length / 3; sp.push(...bl, ...br, ...bl0, ...br0); si.push(n, n + 2, n + 1, n + 1, n + 2, n + 3, n, n + 1, n + 2, n + 1, n + 3, n + 2);
      const gs = new THREE.BufferGeometry(); gs.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); gs.setIndex(si); gs.computeVertexNormals();
      const ms = new THREE.Mesh(gs, new THREE.MeshStandardMaterial({ color: 0x4d4a66, roughness: 0.9, side: THREE.DoubleSide })); ms.castShadow = true; g.add(ms);
      this.root.add(g); return g;
    }

    /* ---- scenery ---- */
    buildScenery(track, theme) {
      const inst = new Inst(), root = this.root, o = {}, W = track.width, hw = W / 2, L = track.L, R = rng(12345 + L);
      const place = (name, s, lat, yaw, sc, sy, yOff = 0, color) => {
        track.at(s, o); const x = o.x + o.rx * lat, z = o.z + o.rz * lat, y = this.groundY(x, z) + yOff;
        inst.add(name, M4(x, y, z, yaw, sc, sy, sc), color);
        return { x, y, z };
      };
      const yawAlong = (o) => Math.atan2(-o.fz, o.fx);     // local +x -> forward
      const yawFacing = (dx, dz) => Math.atan2(dx, dz);   // local +z -> (dx,dz)
      const yawNeg = (dx, dz) => Math.atan2(-dx, -dz);    // local -z -> (dx,dz)
      const treeCol = new Color();

      // barriers along both sides (skip near start stands)
      const stand0 = L - 160, stand1 = 190;
      const inStands = (s) => (s > stand0 || s < stand1);
      for (let s = 8; s < L; s += 5) {
        track.at(s, o); const k = Math.abs(o.kb);
        for (const side of [-1, 1]) {
          const lat = side * (hw + 3.8);
          // outside of corners get the big red/white wall, straights get a low rail
          const outside = (o.k > 0 && side < 0) || (o.k < 0 && side > 0);
          if (inStands(s) && !outside) continue;
          const name = outside && k > 0.003 ? 'barrierWall' : (Math.floor(s / 5) % 2 ? 'barrierRed' : 'barrierWhite');
          const sc = name === 'barrierWall' ? 5 : 5;
          const x = o.x + o.rx * lat, z = o.z + o.rz * lat, y = this.groundY(x, z);
          inst.add(name, M4(x + o.fx * 0, y, z, yawAlong(o), sc, 9, sc * 1.4));
        }
      }
      // start/finish area: stands, pits, tents, billboards, flags
      const standList = [];
      for (const side of [-1, 1]) {
        const lat = side * (hw + 13);
        for (let s = stand0 + 10; s < L + stand1 - 10; s += 8.5) {
          const ss = s % L; track.at(ss, o);
          const nm = (Math.floor(s / 8.5) % 5 === 2) ? 'grandStandCovered' : 'grandStand';
          // seats face the road: toward -side*right
          const dx = -side * o.rx, dz = -side * o.rz;
          const pp = place(nm, ss, lat, yawNeg(-dx, -dz) + 0, 8, 8, 0.0); if (nm === 'grandStand') standList.push({ x: pp.x, y: pp.y, z: pp.z, yaw: yawNeg(-dx, -dz) });
        }
        // fence in front of the stands
        for (let s = stand0; s < L + stand1; s += 8) { track.at(s % L, o); place('fenceStraight', s % L, side * (hw + 6.5), yawAlong(o), 8, 8, 0); }
      }
      this.standList = standList;
      // pit buildings behind the right stands
      for (let s = stand0 + 20; s < L + stand1 - 20; s += 10) {
        const ss = s % L; track.at(ss, o); const dx = -o.rx, dz = -o.rz;
        place(Math.floor(s / 10) % 3 === 0 ? 'pitsOffice' : 'pitsGarage', ss, hw + 30, yawNeg(-dx, -dz), 8.5, 8.5);
      }
      // tents + billboards + flags
      for (let s = 40; s < L - 40; s += 90 + R() * 60) {
        track.at(s, o); const side = R() < 0.5 ? -1 : 1;
        if (!inStands(s)) {
          const dx = -side * o.rx, dz = -side * o.rz;
          place(R() < 0.5 ? 'billboard' : 'billboardLow', s, side * (hw + 14), yawNeg(-dx, -dz) + Math.PI, 9, 9);
        }
      }
      // flags + banner towers at corners
      for (let s = 20; s < L; s += 12) {
        track.at(s, o); const k = o.kb;
        if (Math.abs(k) > 0.007 && Math.floor(s / 12) % 3 === 0) {
          const side = k > 0 ? -1 : 1;  // outside of the corner
          const dx = -side * o.rx, dz = -side * o.rz;
          place(Math.floor(s / 12) % 2 ? 'flagRed' : 'flagGreen', s, side * (hw + 6.5), yawNeg(-dx, -dz), 5);
          if (Math.floor(s / 36) % 2) place(R() < 0.5 ? 'bannerTowerRed' : 'bannerTowerGreen', s + 5, side * (hw + 9.5), yawNeg(-dx, -dz), 6);
        }
      }
      // starting flags
      for (const side of [-1, 1]) for (let q = 0; q < 3; q++) { track.at(2 + q * 5, o); place('flagCheckers', 2 + q * 5, side * (hw + 5.2), yawNeg(-side * o.rx, -side * o.rz), 5); }

      // lamps
      const night = !!theme.night; this.lamps = [];
      const lampStep = night ? 34 : 70;
      for (let s = 20; s < L; s += lampStep) {
        track.at(s, o); const side = (Math.floor(s / lampStep) % 2) ? -1 : 1;
        const p = place(night ? 'lightPostLarge' : 'lightPostModern', s, side * (hw + 5), yawNeg(-side * o.rx, -side * o.rz) + Math.PI, 8.5, 8.5);
        this.lamps.push({ x: p.x - side * o.rx * 0, y: p.y + 6.2, z: p.z, side, o: [o.rx, o.rz] });
      }
      // trees and rocks
      const trees = [];
      const nT = Math.round(L / (night ? 4.5 : 3.6));
      for (let n = 0, tries = 0; n < nT && tries < nT * 12; tries++) {
        const s = R() * L; track.at(s, o); const side = R() < 0.5 ? -1 : 1;
        const lat = side * (hw + 12 + Math.pow(R(), 1.6) * 90), x = o.x + o.rx * lat, z = o.z + o.rz * lat;
        const d = this.distToRoad(x, z); if (d < hw + 9) continue;
        let ok = true; for (const t of trees) { if ((t.x - x) ** 2 + (t.z - z) ** 2 < 36) { ok = false; break; } } if (!ok) continue;
        trees.push({ x, z }); n++;
        const big = R() < 0.55, sc = 3.6 + R() * 3.2;
        treeCol.setHSL(theme.night ? 0.42 + R() * 0.05 : (theme.id === 'rally' ? 0.2 + R() * 0.08 : 0.33 + R() * 0.07), 0.45 + R() * 0.2, theme.night ? 0.35 : 0.8 + R() * 0.25);
        inst.add(big ? 'treeLarge' : 'treeSmall', M4(x, this.groundY(x, z) - 0.2, z, R() * 6.28, sc, sc * (0.9 + R() * 0.4), sc), treeCol.clone());
      }
      const castSet = new Set(['treeLarge', 'treeSmall', 'grandStand', 'grandStandCovered', 'grandStandAwning', 'barrierWall', 'pitsGarage', 'pitsOffice', 'lightPostLarge', 'lightPostModern']);
      inst.build(root, castSet);
      this.treeCount = trees.length;
      this.buildCrowd(standList, R);

      this.buildGantries(track, theme);
      this.buildNeon(track, theme);
      if (night) this.buildLampGlow();
    }


    buildCrowd(stands, R) {
      const pal = [0xff5a5f, 0xffc83d, 0x2bb673, 0x2f9bff, 0x7b5cff, 0xff3ea5, 0xffffff, 0x18c1c9];
      const people = [];
      const sc = 8;
      for (const st of stands) {
        const cs = Math.cos(st.yaw), sn = Math.sin(st.yaw);
        for (let r = 0; r < 5; r++) for (let i = 0; i < 9; i++) {
          if (R() < 0.18) continue;
          const lx = -0.44 + i * 0.11 + (R() - 0.5) * 0.03, lz = -0.02 + r * 0.1, ly = 0.75 - 0.906 * (lz + 0.096) + 0.02;
          const x = st.x + (lx * cs + lz * sn) * sc, z = st.z + (-lx * sn + lz * cs) * sc;
          people.push([x, st.y + ly * sc, z, pal[(R() * pal.length) | 0]]);
        }
      }
      if (!people.length) return;
      const geo = new THREE.CapsuleGeometry(0.26, 0.5, 2, 6); geo.translate(0, 0.55, 0);
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      this.crowdTime = { value: 0 };
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = this.crowdTime;
        sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform float uTime;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\n float ph = instanceMatrix[3].x*0.7 + instanceMatrix[3].z*1.3; transformed.y += max(0.0, sin(uTime*7.0+ph))*0.3;');
      };
      const im = new THREE.InstancedMesh(geo, mat, people.length); const m = new Matrix4(), c = new Color();
      people.forEach((p, i) => { m.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(i, m); c.setHex(p[3]); im.setColorAt(i, c); });
      im.frustumCulled = false; this.root.add(im);
    }

    buildLampGlow() {
      const g = new Particles(Math.max(1, this.lamps.length), true);
      // static glow points
      this.lamps.forEach((l, i) => { g.emitStatic(l.x, l.y, l.z, 7, 1.0, 0.85, 0.5, 0.8); });
      g.update(0); g.static = true; this.root.add(g.points); this.glowPts = g;
    }

    /* gantries, overpass, tunnel */
    buildGantries(track, theme) {
      const o = {}, W = track.width, hw = W / 2, root = this.root;
      const matSteel = new THREE.MeshStandardMaterial({ color: 0xe9ecf5, roughness: 0.6, metalness: 0.2 });
      const matDark = new THREE.MeshStandardMaterial({ color: 0x2a2d40, roughness: 0.7 });
      const mkBeam = (s, h, bannerText, bg, fg, lampsOn) => {
        track.at(s, o); const g = new THREE.Group(); const yaw = Math.atan2(-o.fz, o.fx) + Math.PI / 2; // local x = across the road
        g.position.set(o.x, o.y, o.z); g.rotation.y = Math.atan2(o.rx, o.rz) - Math.PI / 2 + Math.PI / 2;
        const across = W + 9;
        for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 1.6), matSteel); p.position.set(sx * across / 2, h / 2 - 1.5, 0); p.castShadow = true; g.add(p); }
        const beam = new THREE.Mesh(new THREE.BoxGeometry(across + 1.6, 3.2, 1.6), matSteel); beam.position.set(0, h - 1.6, 0); beam.castShadow = true; g.add(beam);
        const tex = bannerTex(bannerText, bg, fg); const ban = new THREE.Mesh(new THREE.PlaneGeometry(across - 2, 3), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); ban.position.set(0, h - 1.6, 0.85); g.add(ban);
        const ban2 = ban.clone(); ban2.rotation.y = Math.PI; ban2.position.z = -0.85; g.add(ban2);
        // orient so local +z = forward travel
        g.rotation.set(0, Math.atan2(o.fx, o.fz), 0);
        g.userData.overhead = true; root.add(g); return g;
      };
      // start/finish gantry with countdown lights
      const sg = mkBeam(5, 11.5, 'TURBO TYPE  •  スタート / ゴール', '#1b1840', '#ffd23f');
      this.startLights = [];
      const lampGeo = new THREE.SphereGeometry(0.85, 16, 12);
      for (let i = 0; i < 4; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x331111, toneMapped: false });
        const l = new THREE.Mesh(lampGeo, mat); l.position.set((i - 1.5) * 3.2, 7.2, -0.9); sg.add(l); this.startLights.push(l);
        const hood = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.5, 14), matDark); hood.rotation.x = Math.PI / 2; hood.position.set((i - 1.5) * 3.2, 7.2, -0.55); sg.add(hood);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(14, 3.4, 0.3), matDark); bar.position.set(0, 7.2, -0.45); sg.add(bar);
      sg.children.forEach((c) => { if (c.geometry && c.geometry.type === 'SphereGeometry') c.position.z = -0.75; });
      // other gantries
      const spots = [0.24, 0.47, 0.7, 0.9];
      const texts = ['SPEED ZONE', 'KEEP TYPING!', 'NITRO AHEAD', 'GO GO GO!'];
      (track.gantries || []).forEach((gn) => { mkBeam(gn.s, gn.h, texts[gn.i], gn.i % 2 ? '#0e6bd6' : '#e8472b', '#ffffff'); });
      // jump markers: pylons + signs on both sides ahead of the ramp
      this.jumpMarkers = [];
      // overpass
      if (track.feats.bridge) this.buildBridge(track, track.feats.bridge.s0);
      if (track.feats.tunnel) this.buildTunnel(track, track.feats.tunnel.s0, track.feats.tunnel.len, theme);
    }
    buildBridge(track, s0) {
      const o = {}, hw = track.width / 2, root = this.root; track.at(s0, o);
      const g = new THREE.Group(); g.position.set(o.x, o.y, o.z); g.rotation.y = Math.atan2(o.fx, o.fz);
      const conc = new THREE.MeshStandardMaterial({ color: 0xd8d4e6, roughness: 0.85 }), red = new THREE.MeshStandardMaterial({ color: 0xe86a6a, roughness: 0.7 });
      const span = track.width + 30;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(span, 1.6, 14), conc); deck.position.set(0, 10, 0); deck.castShadow = true; deck.receiveShadow = true; g.add(deck);
      for (const sx of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(span, 1.3, 0.7), red); rail.position.set(0, 11.4, sx * 6.8); g.add(rail);
        for (const px of [-1, 1]) { const pil = new THREE.Mesh(new THREE.BoxGeometry(2.4, 12, 3), conc); pil.position.set(px * (hw + 6.5), 4, sx * 4); pil.castShadow = true; g.add(pil); }
      }
      const tex = bannerTex('はやく うとう！', '#ffc83d', '#1f1a3d', 512, 128); const ban = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.4), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); ban.position.set(0, 7.6, -7.05); ban.rotation.y = Math.PI; g.add(ban);
      g.userData.overhead = true; root.add(g);
    }
    buildTunnel(track, s0, len, theme) {
      const o = {}, hw = track.width / 2, N = Math.ceil(len / 2), ring = 16, root = this.root;
      const R = hw + 4.5, wallH = 5.5, pos = [], col = [], idx = [], lightPos = [];
      const c1 = new Color(theme.night ? 0x4a4f7a : 0xb9b2a4), c2 = new Color(theme.night ? 0x2c3050 : 0x8a8274);

      const prof = []; // [lat, yRel]
      prof.push([-R, 0], [-R, wallH * 0.5], [-R, wallH]);
      for (let k = 1; k < ring; k++) { const a = Math.PI * k / ring; prof.push([-Math.cos(a) * R, wallH + Math.sin(a) * R * 0.8]); }
      prof.push([R, wallH], [R, wallH * 0.5], [R, 0]);
      const P = prof.length;
      for (let i = 0; i <= N; i++) {
        track.at(s0 + i * 2, o);
        for (let k = 0; k < P; k++) {
          const lat = prof[k][0], yr = prof[k][1];
          pos.push(o.x + o.rx * lat, o.y - clamp(lat, -hw, hw) * Math.sin(o.bank) + yr, o.z + o.rz * lat);
          const cc = (i % 4 < 2) ? c1 : c2; col.push(cc.r, cc.g, cc.b);
        }
        if (i < N) for (let k = 0; k < P - 1; k++) { const a = i * P + k, b = a + P; idx.push(a, b, a + 1, a + 1, b, b + 1); }
        if (i % 3 === 0) lightPos.push([o.x, o.y + wallH + R * 0.8 - 0.5, o.z]);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.overhead = true; root.add(mesh);
      // light strips along the ceiling
      const lg = new Particles(lightPos.length + 1, true);
      for (const p of lightPos) lg.emitStatic(p[0], p[1], p[2], 3.2, 1, 0.92, 0.7, 0.9);
      lg.update(0); this.root.add(lg.points);
      // portals: facade rings at both ends
      const portalMat = new THREE.MeshStandardMaterial({ color: theme.night ? 0x7a62ff : 0xe86a6a, roughness: 0.6 });
      for (const sEnd of [s0, s0 + len]) {
        track.at(sEnd, o); const tor = new THREE.Mesh(new THREE.TorusGeometry(R * 0.98, 0.7, 8, 28, Math.PI), portalMat); tor.position.set(o.x, o.y + wallH * 0.0 + wallH, o.z); tor.rotation.y = Math.atan2(o.fx, o.fz) + Math.PI; tor.userData.overhead = true; root.add(tor);
        tor.scale.set(1, 0.82, 1);
      }
      this.tunnel = { s0, s1: s0 + len };
    }
    buildNeon(track, theme) {
      if (!theme.night) return;
      const o = {}, hw = track.width / 2, root = this.root, cols = [0x39e6ff, 0xff4fd8, 0xffe14a];
      for (const nn of (track.neon || [])) {
        const s = nn.s, i = nn.i; track.at(s, o);
        const mat = new THREE.MeshBasicMaterial({ color: cols[i % 3], toneMapped: false });
        const t = new THREE.Mesh(new THREE.TorusGeometry(hw + 3.5, 0.35, 8, 32, Math.PI), mat);
        t.position.set(o.x, o.y, o.z); t.rotation.y = Math.atan2(o.fx, o.fz) + Math.PI; t.userData.overhead = true; root.add(t);
        const g2 = new Particles(1, true); g2.emitStatic(o.x, o.y + hw + 3.5, o.z, 22, (cols[i % 3] >> 16) / 255, ((cols[i % 3] >> 8) & 255) / 255, (cols[i % 3] & 255) / 255, 0.35); g2.update(0); root.add(g2.points);
      }
    }
    buildMountains(track, theme) {
      const b = track.bounds, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, seg = 160, rad = 1050 + Math.max(b.x1 - b.x0, b.z1 - b.z0) * 0.4;
      const pos = [], col = [], idx = []; const cA = new Color(theme.mount[0]), cB = new Color(theme.mount[1]), snow = new Color(0xffffff), tc = new Color();
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * Math.PI * 2, n = fbm(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + 10, 21), n2 = fbm(Math.cos(a) * 11, Math.sin(a) * 11, 5);
        const h = theme.mount[2] * (0.25 + n * 1.1) * (0.8 + n2 * 0.5);
        const x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad;
        pos.push(x, -30, z, x, h, z); tc.copy(cA).lerp(cB, n2); col.push(cA.r * 0.8, cA.g * 0.8, cA.b * 0.8, tc.r, tc.g, tc.b);
        if (theme.snow && h > theme.mount[2] * 0.85) { tc.lerp(snow, 0.8); col[col.length - 3] = tc.r; col[col.length - 2] = tc.g; col[col.length - 1] = tc.b; }
        if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true })); m.frustumCulled = false; this.root.add(m);
    }

    /* ---- cars ---- */
    clearCars() {
      for (const c of this.cars) { this.root.remove(c.group); this.root.remove(c.shadow); c.shadow.material.dispose(); c.group.traverse((o) => { if (o.material && o.material.userData.clone) o.material.dispose(); }); }
      this.cars.length = 0;
    }
    addCar(name, tint, headlights) {
      const g = new THREE.Group(); g.rotation.order = 'YXZ';
      const inner = new THREE.Group(); g.add(inner);
      const model = Models.get(name);
      const body = new THREE.Group();
      for (const p of model.parts) {
        let mat = p.mat;
        if (tint && p.mat.name === tint.mat) { mat = mat.clone(); mat.color.set(tint.color); mat.userData.clone = true; }
        const mesh = new THREE.Mesh(p.geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; body.add(mesh);
      }
      body.scale.setScalar(CAR_SCALE);
      // Kenney cars point down +z? keep a yaw offset constant
      body.rotation.y = TT.CAR_YAW || 0;
      inner.add(body);
      // flame
      const flame = new THREE.Group();
      const fm1 = new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const fm2 = new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.0, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -1.0), fm1);
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.3, 8, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.65), fm2);
      flame.add(c1, c2); flame.position.set(0, 0.62, -2.15); flame.visible = false; inner.add(flame);
      // blob shadow
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.blobTex || (this.blobTex = blobShadowTex()), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8, opacity: 0.8 }));
      sh.renderOrder = 2; this.root.add(sh);
      // headlights (night)
      let spot = null;
      if (headlights) {
        spot = new THREE.SpotLight(0xfff2cf, 900, 120, 0.5, 0.6, 1.4); spot.position.set(0, 1.2, 1.5); inner.add(spot); spot.target.position.set(0, 0, 30); inner.add(spot.target);
        for (const sx of [-0.7, 0.7]) { const hl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff7d0, toneMapped: false })); hl.position.set(sx, 0.75, 2.1); inner.add(hl); }
      }
      g.userData.isCar = true; sh.userData.isCar = true;
      this.root.add(g);
      const car = { group: g, inner, body, flame, fm1, fm2, shadow: sh, spot, p0: new Vector3(), p1: new Vector3(), q0: new Quaternion(), q1: new Quaternion(), first: true, flameK: 0, name };
      this.cars.push(car); return car;
    }
    /* commit a new simulation pose for a car (after each fixed tick) */
    poseCar(car, x, y, z, yaw, pitch, roll, flameK) {
      car.p0.copy(car.p1); car.q0.copy(car.q1);
      car.p1.set(x, y, z); _e.set(pitch, yaw, roll, 'YXZ'); car.q1.setFromEuler(_e);
      if (car.first) { car.p0.copy(car.p1); car.q0.copy(car.q1); car.first = false; }
      car.flameK = flameK;
    }

    /* ---- podium ---- */
    buildPodium(track) {
      const o = {}, s = 110; track.at(s, o);
      const g = new THREE.Group(); g.visible = false;
      const fwd = new Vector3(-o.fx, 0, -o.fz).normalize();           // direction the podium faces (toward the camera)
      const rv = new Vector3(-(-fwd.z), 0, -fwd.x).multiplyScalar(-1); // viewer's right
      rv.set(fwd.z, 0, -fwd.x); // viewer looks along -fwd; right = cross(-fwd, up) = (fwd.z,0,-fwd.x)
      g.position.set(o.x, o.y, o.z); g.rotation.y = Math.atan2(fwd.x, fwd.z);
      const mk = (w, h, d, col) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 }));
      const heights = [3.4, 2.4, 1.6], xs = [0, -6.4, 6.4], cols = [0xffc83d, 0xd9dde8, 0xe3935a];
      this.podiumSlots = [];
      heights.forEach((h, i) => {
        const b = mk(6, h, 5, cols[i]); b.position.set(xs[i], h / 2, 0); b.castShadow = true; b.receiveShadow = true; g.add(b);
        const tex = canvasTex(128, 128, (c, w, hh) => { c.fillStyle = '#' + cols[i].toString(16).padStart(6, '0'); c.fillRect(0, 0, w, hh); c.fillStyle = '#1f1a3d'; c.font = '800 96px "Baloo 2", Arial Black, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(i + 1), w / 2, hh * 0.56); });
        const face = new THREE.Mesh(new THREE.PlaneGeometry(4.6, Math.min(h - 0.3, 2.4)), new THREE.MeshBasicMaterial({ map: tex })); face.position.set(xs[i], h / 2, 2.52); g.add(face);
        this.podiumSlots.push({ x: xs[i], y: h });
      });
      // trophy
      const prof = [[0, 0], [1.1, 0], [1.1, 0.25], [0.35, 0.5], [0.3, 1.4], [0.9, 1.8], [1.6, 2.9], [1.5, 3.4], [0.8, 3.1], [0, 3.0]].map((p) => new THREE.Vector2(p[0], p[1]));
      const cup = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.85, roughness: 0.25, emissive: 0x553300, emissiveIntensity: 0.4 }));
      cup.position.set(-13.5, 0, 1); cup.scale.setScalar(1.0); cup.castShadow = true; g.add(cup); this.trophy = cup;
      const base = mk(2.6, 0.6, 2.6, 0x7a4b1f); base.position.set(-13.5, 0.3, 1); g.add(base); cup.position.y = 0.6;
      g.userData.slots = this.podiumSlots; this.podium = g; this.root.add(g);
      this.podiumPos = new Vector3(o.x, o.y + 0.0, o.z).addScaledVector(fwd, 3); this.podiumFwd = fwd; this.podiumRight = rv;
    }
    showPodium(track, meshes) {
      if (!this.podium) this.buildPodium(track);
      this.podium.visible = true;
      const o = {}, fwd = this.podiumFwd, rv = this.podiumRight; const base = new Vector3(); this.podium.getWorldPosition(base);
      const yaw = Math.atan2(fwd.x, fwd.z);
      meshes.forEach((m, i) => {
        let lx, ly, lz = 0, extraYaw = 0;
        if (i < 3) { const sl = this.podiumSlots[i]; lx = sl.x; ly = sl.y + 0.1; } else { lx = 14; ly = 0.1; lz = 2; extraYaw = -0.5; }
        // local podium x axis == viewer right?  the group is rotated so +x maps to (cos,0,-sin)
        const wx = base.x + Math.cos(this.podium.rotation.y) * lx + Math.sin(this.podium.rotation.y) * lz, wz = base.z - Math.sin(this.podium.rotation.y) * lx + Math.cos(this.podium.rotation.y) * lz;
        const y = base.y + ly; m.first = true; this.poseCar(m, wx, y, wz, yaw + extraYaw + 0.0, 0, 0, 0); m.group.position.set(wx, y, wz); m.group.rotation.set(0, yaw + extraYaw, 0); m.group.quaternion.copy(m.q1);
        m.p0.copy(m.p1); m.q0.copy(m.q1);
        this.shadowPose(m, wx, y, wz, yaw + extraYaw, 0.9, 0.5, 0, 0);
      });
    }

    /* ---- per-frame render with interpolation alpha ---- */
    render(alpha, time) {
      this.t = time;
      for (const c of this.cars) {
        c.group.position.lerpVectors(c.p0, c.p1, alpha); c.group.quaternion.slerpQuaternions(c.q0, c.q1, alpha);
        const f = c.flameK; c.flame.visible = f > 0.02;
        if (f > 0.02) { const fl = 0.8 + Math.random() * 0.4; c.flame.scale.set(0.8 + f * 0.3, 0.8 + f * 0.3, f * fl * 1.3); c.fm1.opacity = 0.35 + f * 0.4; }
        if (c.spot) { /* keep */ }
      }
      if (this.crowdTime) this.crowdTime.value = time;
      if (this.trophy && this.podium && this.podium.visible) this.trophy.rotation.y = time * 1.2;
      if (this.sky) { this.sky.position.copy(this.camera.position); this.sky.material.uniforms.uT.value = time; }
      // sun + shadow follow the first car
      const c0 = this.cars[0];
      if (c0) { const p = c0.group.position; this.sun.target.position.copy(p); this.sun.position.copy(p).addScaledVector(this.sunDir, 120); }
      this.renderer.render(this.scene, this.camera);
    }
    shadowPose(car, x, y, z, yaw, scale, alpha, pitch, roll) {
      const s = car.shadow; s.position.set(x, y + 0.08, z); s.rotation.set(0, 0, 0); s.rotation.order = 'YXZ'; s.rotation.set(pitch || 0, yaw, roll || 0);
      s.scale.set(3.2 * scale, 1, 5.6 * scale); s.material.opacity = alpha;
    }
  }
  function blobShadowTex() {
    return canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 4, 32, 32, 30); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  }

  TT.World = World; TT.Models = Models; TT.Particles = Particles; TT.util = { clamp, lerp, smooth, rng, fbm };
})();
