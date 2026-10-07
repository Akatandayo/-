// 3Dレース演出（Three.js）
// Race.simulate() の結果（frames = 0.5秒ごとの位置、events = 実況）を描画するだけで、レースの計算はしない。
// コースは楕円（直線2本＋コーナー2つ）。距離に応じてスタート地点を決め、ゴールはホームストレッチに置く。
'use strict';

const Race3D = {
  S: 450,          // 直線の長さ(m)
  R: 160,          // コーナー半径(m)
  W: 26,           // コース幅(m)
  FINISH_BACK: 70, // ホームストレッチの終わりからゴールまで(m)
  renderer: null,
  failed: false,
  state: null,

  // JRAの枠色（1枠〜8枠）
  BRACKET_COLORS: ['#ffffff', '#1f1f1f', '#e53935', '#1e63d6', '#fdd835', '#2e9d48', '#fb8c00', '#f48fb1'],
  BRACKET_TEXT: ['#111', '#fff', '#fff', '#fff', '#111', '#fff', '#fff', '#111'],
  // 毛色
  COATS: [
    { name: '鹿毛', body: 0x6e3b1c, dark: 0x1a100a },
    { name: '黒鹿毛', body: 0x3e2618, dark: 0x120b07 },
    { name: '栗毛', body: 0xa3552a, dark: 0x8c4520 },
    { name: '芦毛', body: 0xbcb7b0, dark: 0x6f6a64 },
    { name: '青鹿毛', body: 0x2b1d16, dark: 0x0c0806 },
    { name: '栃栗毛', body: 0x7a3d1c, dark: 0xb88552 },
    { name: '白毛', body: 0xf2f0ec, dark: 0xd8d4cc, rare: true }
  ],
  // 勝負服の色と柄
  SILK_COLORS: ['#ffffff', '#1b1b1b', '#d32f2f', '#1e4fd6', '#fbc02d', '#2e7d32', '#f06292', '#4fc3f7', '#7b1fa2', '#b39ddb', '#795548', '#880e4f', '#9e9e9e', '#ef6c00'],
  SILK_PATTERNS: ['solid', 'hoops', 'stripes', 'sash', 'cross', 'diamonds', 'dots', 'halves', 'chevron', 'band'],

  get P() { return 2 * this.S + 2 * Math.PI * this.R; },

  supported() {
    if (this.failed || typeof THREE === 'undefined') return false;
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  },

  // ── コース上の位置（s：周回上の距離、lane：内ラチからの距離） ──
  path(s, lane) {
    const S = this.S, R = this.R, P = this.P, T = Math.PI * R;
    s = ((s % P) + P) % P;
    if (s < S) return { x: -S / 2 + s, z: -lane, dx: 1, dz: 0 };
    s -= S;
    if (s < T) {
      const a = s / R, r = R + lane;
      return { x: S / 2 + r * Math.sin(a), z: R - r * Math.cos(a), dx: Math.cos(a), dz: Math.sin(a) };
    }
    s -= T;
    if (s < S) return { x: S / 2 - s, z: 2 * R + lane, dx: -1, dz: 0 };
    s -= S;
    const a = s / R, r = R + lane;
    return { x: -S / 2 - r * Math.sin(a), z: R + r * Math.cos(a), dx: -Math.cos(a), dz: -Math.sin(a) };
  },
  yaw(p) { return Math.atan2(-p.dz, p.dx); },

  hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  },
  rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  },

  // 馬番 → 枠番（JRAのルール：多頭数のときは外枠から2頭ずつ）
  bracketOf(num, n) {
    if (n <= 8) return num;
    const base = Math.floor(n / 8), extra = n % 8;
    let count = 0;
    for (let b = 1; b <= 8; b++) {
      count += base + (b > 8 - extra ? 1 : 0);
      if (num <= count) return b;
    }
    return 8;
  },

  silkFor(key) {
    const r = this.rng(this.hash(key));
    const c = this.SILK_COLORS;
    const base = c[Math.floor(r() * c.length)];
    let alt = c[Math.floor(r() * c.length)];
    if (alt === base) alt = base === '#ffffff' ? '#1b1b1b' : '#ffffff';
    return { base, alt, sleeve: r() < 0.5 ? base : alt, pattern: this.SILK_PATTERNS[Math.floor(r() * this.SILK_PATTERNS.length)] };
  },

  drawSilk(g, w, h, silk) {
    g.fillStyle = silk.base;
    g.fillRect(0, 0, w, h);
    g.fillStyle = silk.alt;
    g.strokeStyle = silk.alt;
    const p = silk.pattern;
    if (p === 'hoops') for (let y = h * 0.12; y < h; y += h * 0.28) g.fillRect(0, y, w, h * 0.12);
    else if (p === 'stripes') for (let x = w * 0.08; x < w; x += w * 0.22) g.fillRect(x, 0, w * 0.09, h);
    else if (p === 'sash') { g.lineWidth = w * 0.16; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.stroke(); }
    else if (p === 'cross') { g.lineWidth = w * 0.13; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke(); }
    else if (p === 'diamonds') {
      const s = w / 4;
      for (let y = 0; y < h + s; y += s) for (let x = ((y / s) % 2) * s / 2; x < w + s; x += s) {
        g.beginPath(); g.moveTo(x, y - s * 0.35); g.lineTo(x + s * 0.3, y); g.lineTo(x, y + s * 0.35); g.lineTo(x - s * 0.3, y); g.fill();
      }
    } else if (p === 'dots') {
      const s = w / 5;
      for (let y = s / 2; y < h; y += s) for (let x = s / 2; x < w; x += s) { g.beginPath(); g.arc(x, y, s * 0.22, 0, Math.PI * 2); g.fill(); }
    } else if (p === 'halves') g.fillRect(w / 2, 0, w / 2, h);
    else if (p === 'chevron') {
      g.lineWidth = h * 0.08;
      for (let y = h * 0.2; y < h * 1.2; y += h * 0.3) { g.beginPath(); g.moveTo(0, y); g.lineTo(w / 2, y - h * 0.18); g.lineTo(w, y); g.stroke(); }
    } else if (p === 'band') g.fillRect(0, h * 0.42, w, h * 0.2);
  },

  silkTexture(silk) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    this.drawSilk(c.getContext('2d'), 128, 128, silk);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  },

  // HUD用の勝負服アイコン（ジャージの形）
  silkIcon(silk, cap) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    g.save();
    g.beginPath();
    g.moveTo(20, 14); g.lineTo(6, 22); g.lineTo(4, 44); g.lineTo(14, 44); g.lineTo(16, 30);
    g.lineTo(16, 60); g.lineTo(48, 60); g.lineTo(48, 30); g.lineTo(50, 44); g.lineTo(60, 44); g.lineTo(58, 22); g.lineTo(44, 14);
    g.closePath();
    g.clip();
    this.drawSilk(g, 64, 64, silk);
    g.fillStyle = silk.sleeve;
    g.globalAlpha = silk.sleeve === silk.base ? 0 : 1;
    g.fillRect(0, 14, 16, 34); g.fillRect(48, 14, 16, 34);
    g.restore();
    g.fillStyle = cap;
    g.beginPath(); g.arc(32, 9, 8, Math.PI, 0); g.fill();
    g.fillRect(24, 8, 16, 4);
    return c.toDataURL();
  },

  // 文字入りのテクスチャ
  textTexture(text, opts = {}) {
    const c = document.createElement('canvas');
    c.width = opts.w || 256; c.height = opts.h || 128;
    const g = c.getContext('2d');
    g.fillStyle = opts.bg || '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    if (opts.band) { g.fillStyle = opts.band; g.fillRect(0, 0, c.width, c.height * 0.18); }
    g.fillStyle = opts.color || '#111';
    g.font = `900 ${opts.size || 72}px "Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, c.height * (opts.band ? 0.6 : 0.52));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  },

  noiseTexture(base, vary, size, stripes) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, size, size);
    if (stripes) {
      g.fillStyle = 'rgba(255,255,255,0.13)';
      g.fillRect(0, 0, size / 2, size);
    }
    const img = g.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * vary;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n * 0.7;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  },

  glowTexture(color) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, color);
    grd.addColorStop(0.4, color.replace('1)', '0.45)'));
    grd.addColorStop(1, color.replace('1)', '0)'));
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  },

  // ── 表示の開始・終了 ──
  mount(container, ctx) {
    if (!this.supported()) return false;
    try {
      if (!this.renderer) {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
      }
    } catch (e) {
      this.failed = true;
      return false;
    }
    if (!this.state || this.state.result !== ctx.result) {
      this.disposeScene();
      this.build(ctx);
    }
    this.container = container;
    container.prepend(this.renderer.domElement);
    if (this.sound.enabled()) this.sound.init();
    this.buildHud(container);
    this.resize();
    if (!this._ro && window.ResizeObserver) {
      this._ro = new ResizeObserver(() => this.resize());
    }
    if (this._ro) { this._ro.disconnect(); this._ro.observe(container); }
    return true;
  },

  unmount() {
    this.sound.stop();
    if (typeof Fanfare !== 'undefined') Fanfare.stop();
    if (this._ro) this._ro.disconnect();
    if (this.renderer && this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    this.disposeScene();
    this.container = null;
  },

  disposeScene() {
    const st = this.state;
    if (!st) return;
    st.scene.traverse(o => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    this.state = null;
  },

  resize() {
    if (!this.container || !this.state) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.state.camera.aspect = w / h;
    this.state.camera.updateProjectionMatrix();
  },

  // ── シーンを作る ──
  build(ctx) {
    const res = ctx.result;
    const scene = new THREE.Scene();
    const rainy = res.ground >= 2;
    const sky = rainy ? 0x9aa4ad : res.ground === 1 ? 0xb4c8d8 : 0x8ec5f0;
    scene.background = new THREE.Color(sky);
    scene.fog = new THREE.Fog(rainy ? 0xa9b1b8 : 0xcfe4f4, rainy ? 160 : 260, rainy ? 900 : 1500);
    const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.3, 3500);

    scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x4f6b2e, rainy ? 0.75 : 0.95));
    const sun = new THREE.DirectionalLight(0xfff4e0, rainy ? 0.8 : 1.7);
    sun.position.set(260, 420, -300);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdfeaff, rainy ? 0.45 : 0.7);   // 逆光でも馬が黒くつぶれないように
    fill.position.set(-200, 260, 600);
    scene.add(fill);
    this.buildSky(scene, rainy, res.ground === 1);

    const D = res.distance;
    const sF = this.S - this.FINISH_BACK;
    const st = this.state = {
      result: res, race: ctx.race, scene, camera, D, sF, sStart: sF - D,
      preroll: ctx.preroll || 2.2, slot: ctx.slot || 'normal_east',
      horses: [], lastT: null, camPos: new THREE.Vector3(), camLook: new THREE.Vector3(), shot: null,
      particles: null, banner: null, bannerUntil: 0, goalShown: false, rain: null, lastHud: 0
    };

    this.buildCourse(scene, res);
    this.buildGate(scene, st, res.entrants.length);
    this.buildHorses(scene, st, res);
    this.buildParticles(scene, st, res.surface);
    if (rainy) this.buildRain(scene, st);
  },

  // 空（グラデーションのドーム）と雲
  buildSky(scene, rainy, cloudy) {
    const geo = new THREE.SphereGeometry(3000, 32, 16);
    const top = new THREE.Color(rainy ? 0x7d8792 : cloudy ? 0x8fb0cc : 0x3f8fe0);
    const hor = new THREE.Color(rainy ? 0xb5bcc3 : cloudy ? 0xd7e3ec : 0xcfe8fb);
    const cols = [];
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = Util.clamp(p.getY(i) / 3000, 0, 1);
      const c = hor.clone().lerp(top, Math.pow(k, 0.6));
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.position.y = -200;
    sky.renderOrder = -1;
    scene.add(sky);
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 20 + Math.random() * 30;
      const grd = g.createRadialGradient(x, y, 2, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.9)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 128);
    }
    const tex = new THREE.CanvasTexture(c);
    const rnd = this.rng(777);
    for (let i = 0; i < (rainy ? 26 : cloudy ? 20 : 12); i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: rainy ? 0.95 : 0.8, fog: false, depthWrite: false, color: rainy ? 0xc9ced3 : 0xffffff }));
      const a = rnd() * Math.PI * 2, d = 1200 + rnd() * 900;
      sp.position.set(Math.cos(a) * d, 260 + rnd() * 380, this.R + Math.sin(a) * d);
      sp.scale.set(700 + rnd() * 500, 220 + rnd() * 140, 1);
      scene.add(sp);
    }
  },

  ribbon(lane0, lane1, step, y, uLen, mat) {
    const P = this.P, n = Math.ceil(P / step);
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const s = i * step;
      const a = this.path(s, lane0), b = this.path(s, lane1);
      pos.push(a.x, y, a.z, b.x, y, b.z);
      uv.push(s / uLen, 0, s / uLen, 1);
      if (i < n) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  },

  buildCourse(scene, res) {
    const W = this.W, P = this.P, S = this.S, R = this.R;
    // 地面（芝生）
    const grassTex = this.noiseTexture('#7a9a4c', 30, 128);
    grassTex.repeat.set(220, 220);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ map: grassTex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, R);
    scene.add(ground);

    // 内馬場の池
    const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshLambertMaterial({ color: 0x5f9fc7 }));
    pond.rotation.x = -Math.PI / 2;
    pond.scale.set(110, 45, 1);
    pond.position.set(-40, 0.01, R + 20);
    scene.add(pond);

    // 走路（芝は刈り込みの縞、ダートは砂）
    const turf = res.surface === 'turf';
    const trackTex = turf ? this.noiseTexture('#3a9a40', 16, 128, true) : this.noiseTexture('#a0703f', 40, 128);
    const track = this.ribbon(0, W, 4, 0.01, turf ? 24 : 12, new THREE.MeshLambertMaterial({ map: trackTex }));
    scene.add(track);

    // ラチ（内・外の柵）
    const railMat = new THREE.MeshLambertMaterial({ color: 0xf4f4f4 });
    const postGeo = new THREE.BoxGeometry(0.12, 1.05, 0.12);
    [-0.35, W + 0.35].forEach(lane => {
      const pts = [];
      for (let s = 0; s < P; s += 8) { const p = this.path(s, lane); pts.push(new THREE.Vector3(p.x, 1.05, p.z)); }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.floor(P / 3), 0.08, 6, true), railMat);
      scene.add(tube);
      const n = Math.floor(P / 4);
      const posts = new THREE.InstancedMesh(postGeo, railMat, n);
      const m = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        const p = this.path(i * 4, lane);
        m.makeTranslation(p.x, 0.52, p.z);
        posts.setMatrixAt(i, m);
      }
      scene.add(posts);
    });

    // ハロン棒（ゴールまで200mごと）
    const sF = this.state.sF;
    const poleMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const redMat = new THREE.MeshLambertMaterial({ color: 0xd32f2f });
    for (let k = 1; k * 200 < P; k++) {
      const s = sF - k * 200;
      const p = this.path(s, -1.4);
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      g.rotation.y = this.yaw(p);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4, 8), poleMat);
      pole.position.y = 2;
      g.add(pole);
      for (let b = 0; b < 3; b++) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.35, 8), redMat);
        band.position.y = 1 + b * 1;
        g.add(band);
      }
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: this.textTexture(String(k * 200), { band: '#d32f2f' }), side: THREE.DoubleSide }));
      plate.position.set(0, 4.1, 0);
      plate.rotation.y = Math.PI / 2;
      g.add(plate);
      scene.add(g);
    }

    // ゴール板とゴールライン
    const fp = this.path(sF, -1.6);
    const goal = new THREE.Group();
    goal.position.set(fp.x, 0, fp.z);
    goal.rotation.y = this.yaw(fp);
    const gp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 10), poleMat);
    gp.position.y = 3;
    goal.add(gp);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), new THREE.MeshBasicMaterial({ map: this.textTexture('GOAL', { bg: '#d32f2f', color: '#fff', w: 256, h: 256, size: 70 }), side: THREE.DoubleSide }));
    disc.position.y = 6.6;
    disc.rotation.y = Math.PI / 2;
    goal.add(disc);
    scene.add(goal);
    const fl = this.path(sF, W / 2);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.35, W), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(fl.x, 0.03, fl.z);
    scene.add(line);

    // スタンド（ホームストレッチの外側）
    const stand = new THREE.Group();
    const crowdTex = this.crowdTexture();
    crowdTex.repeat.set(12, 1);
    for (let tier = 0; tier < 6; tier++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(420, 2.2, 6),
        [new THREE.MeshLambertMaterial({ color: 0xbfc4c9 }), new THREE.MeshLambertMaterial({ color: 0xbfc4c9 }),
          new THREE.MeshLambertMaterial({ color: 0xd8dde1 }), new THREE.MeshLambertMaterial({ color: 0xbfc4c9 }),
          new THREE.MeshLambertMaterial({ color: 0xbfc4c9 }), new THREE.MeshLambertMaterial({ map: crowdTex })]);
      step.position.set(10, 1.1 + tier * 2.2, -W - 22 - tier * 5);
      stand.add(step);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(420, 30, 8), new THREE.MeshLambertMaterial({ color: 0xe6e8ea }));
    back.position.set(10, 15, -W - 56);
    stand.add(back);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(430, 1.2, 42), new THREE.MeshLambertMaterial({ color: 0x8a96a3 }));
    roof.position.set(10, 30, -W - 38);
    roof.rotation.x = -0.08;
    stand.add(roof);
    const venue = (this.state.race.venue || '馬主カード') + '競馬場';
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(90, 9), new THREE.MeshBasicMaterial({ map: this.textTexture(venue, { w: 1024, h: 102, bg: '#0f3d2e', color: '#f5b301', size: 70 }) }));
    sign.position.set(10, 25, -W - 51.9);
    stand.add(sign);
    scene.add(stand);

    // 内馬場の大型ビジョン
    const vision = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(46, 15, 1.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    vision.add(frame);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(43, 12.5), new THREE.MeshBasicMaterial({ map: this.textTexture(this.state.race.name, { w: 1024, h: 300, bg: '#0b1f3a', color: '#ffffff', size: 90 }) }));
    scr.position.z = -0.8;
    scr.rotation.y = Math.PI;
    vision.add(scr);
    vision.position.set(40, 14, W + 60);
    scene.add(vision);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 2), new THREE.MeshLambertMaterial({ color: 0x555555 }));
    legs.position.set(40, 3, W + 60);
    scene.add(legs);

    // 木（インスタンス描画）
    const rnd = this.rng(12345);
    const n = 260;
    const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(4.5, 12, 7), new THREE.MeshLambertMaterial({ color: 0x2f6a35 }), n);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.7, 4, 6), new THREE.MeshLambertMaterial({ color: 0x5b4029 }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const s = rnd() * P;
      if (s < S && rnd() < 0.85) { i--; continue; }   // スタンド前は空ける
      const p = this.path(s, W + 30 + rnd() * 120);
      const k = 0.7 + rnd() * 0.8;
      sc.set(k, k, k);
      v.set(p.x, 8 * k, p.z);
      m.compose(v, q, sc);
      crowns.setMatrixAt(i, m);
      v.set(p.x, 2 * k, p.z);
      m.compose(v, q, sc);
      trunks.setMatrixAt(i, m);
    }
    scene.add(crowns, trunks);

    // 遠景の山
    const hillMat = new THREE.MeshLambertMaterial({ color: 0x7e9a86 });
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2;
      const hill = new THREE.Mesh(new THREE.ConeGeometry(260 + rnd() * 200, 120 + rnd() * 120, 8), hillMat);
      hill.position.set(Math.cos(a) * 1700, 40, R + Math.sin(a) * 1500);
      scene.add(hill);
    }
  },

  crowdTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#6b7178';
    g.fillRect(0, 0, 256, 32);
    const cols = ['#e53935', '#1e63d6', '#fdd835', '#ffffff', '#2e9d48', '#222', '#f48fb1', '#fb8c00'];
    for (let i = 0; i < 700; i++) {
      g.fillStyle = cols[i % cols.length];
      g.fillRect(Math.random() * 256, Math.random() * 32, 2, 3);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  },

  // ゲート（スタート地点）
  buildGate(scene, st, n) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x3d7a4f });
    const doorMat = new THREE.MeshLambertMaterial({ color: 0xe9eef0 });
    const postGeo = new THREE.BoxGeometry(2.8, 2.6, 0.12);
    st.doors = [];
    st.gate = new THREE.Group();
    for (let i = 0; i <= n; i++) {
      const lane = 0.9 + i * 1.15;
      const p = this.path(st.sStart, lane);
      const post = new THREE.Mesh(postGeo, mat);
      post.position.set(p.x, 1.3, p.z);
      post.rotation.y = this.yaw(p);
      st.gate.add(post);
      if (i < n) {
        const dp = this.path(st.sStart + 1.45, lane + 0.575);
        const door = new THREE.Group();
        door.position.set(dp.x, 0, dp.z);
        door.rotation.y = this.yaw(dp);
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.8, 1.05), doorMat);
        leaf.position.set(0, 1.2, 0);
        door.add(leaf);
        st.gate.add(door);
        st.doors.push(leaf);
      }
    }
    const a = this.path(st.sStart, 0.9 + n * 0.575);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, n * 1.15 + 0.4), mat);
    beam.position.set(a.x, 2.75, a.z);
    beam.rotation.y = this.yaw(a);
    st.gate.add(beam);
    scene.add(st.gate);
  },

  // ── 馬と騎手 ──
  _geo: null,
  geos() {
    if (this._geo) return this._geo;
    const sh = g => { g.userData.shared = true; return g; };
    this._geo = {
      sphere: sh(new THREE.SphereGeometry(1, 18, 12)),
      neck: sh(new THREE.CylinderGeometry(0.17, 0.3, 1.05, 10)),
      head: sh(new THREE.CylinderGeometry(0.09, 0.16, 0.62, 10)),
      ear: sh(new THREE.ConeGeometry(0.05, 0.16, 5)),
      mane: sh(new THREE.BoxGeometry(0.07, 0.95, 0.06)),
      tail: sh(new THREE.CylinderGeometry(0.12, 0.05, 0.85, 6)),
      upper: sh(new THREE.CylinderGeometry(0.095, 0.07, 0.56, 8)),
      lower: sh(new THREE.CylinderGeometry(0.055, 0.045, 0.5, 6)),
      hoof: sh(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 8)),
      cloth: sh(new THREE.PlaneGeometry(0.66, 0.44)),
      saddle: sh(new THREE.BoxGeometry(0.5, 0.06, 0.5)),
      jTorso: sh(new THREE.BoxGeometry(0.5, 0.26, 0.34)),
      jHead: sh(new THREE.SphereGeometry(0.11, 12, 10)),
      jCap: sh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)),
      jArm: sh(new THREE.BoxGeometry(0.42, 0.08, 0.08)),
      jThigh: sh(new THREE.BoxGeometry(0.36, 0.1, 0.11)),
      jBoot: sh(new THREE.BoxGeometry(0.09, 0.32, 0.09)),
      shadow: sh(new THREE.PlaneGeometry(3.2, 1.3)),
      ring: sh(new THREE.RingGeometry(1.5, 1.8, 32))
    };
    return this._geo;
  },

  shadowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  },

  makeHorse(e, num, n, st) {
    const G = this.geos();
    const r = this.rng(this.hash(e.id + e.name));
    const coat = (e.coat && this.COATS.find(c => c.name === e.coat)) || (cs => cs[Math.floor(r() * cs.length)])(this.COATS.filter(c => !c.rare));
    const bracket = this.bracketOf(num, n);
    const capColor = this.BRACKET_COLORS[bracket - 1];
    const silk = this.silkFor(e.isPlayer ? 'owner:' + Player.data.name : e.legendId ? 'legend:' + e.legendId : e.owner ? 'owner:' + e.owner : e.id);
    const coatMat = new THREE.MeshStandardMaterial({ color: coat.body, roughness: 0.55, metalness: 0.05 });
    const darkMat = new THREE.MeshStandardMaterial({ color: coat.dark, roughness: 0.7 });
    const hoofMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const silkTex = this.silkTexture(silk);
    const silkMat = new THREE.MeshStandardMaterial({ map: silkTex, roughness: 0.38, metalness: 0.08 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: silk.sleeve, roughness: 0.38 });
    const capMat = new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.3 });
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    const bootMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xe0b48f });
    const clothMat = new THREE.MeshLambertMaterial({ map: this.textTexture(String(num), { w: 192, h: 128, size: 92, band: capColor === '#ffffff' ? '#cfd6dc' : capColor }) });

    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const add = (parent, geo, mat, x, y, z, sx, sy, sz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (sx) m.scale.set(sx, sy, sz);
      parent.add(m);
      return m;
    };
    add(body, G.sphere, coatMat, 0, 1.32, 0, 1.0, 0.42, 0.36);
    add(body, G.sphere, coatMat, -0.62, 1.36, 0, 0.5, 0.5, 0.39);
    add(body, G.sphere, coatMat, 0.62, 1.3, 0, 0.45, 0.49, 0.37);
    add(body, G.saddle, bootMat, 0.05, 1.74, 0);
    const cl = add(body, G.cloth, clothMat, 0.02, 1.42, 0.375);
    const cr = add(body, G.cloth, clothMat, 0.02, 1.42, -0.375);
    cr.rotation.y = Math.PI;
    cl.rotation.y = 0;

    const neck = new THREE.Group();
    neck.position.set(0.86, 1.55, 0);
    neck.rotation.z = -0.95;
    body.add(neck);
    add(neck, G.neck, coatMat, 0, 0.5, 0);
    add(neck, G.mane, darkMat, -0.15, 0.5, 0);
    const head = new THREE.Group();
    head.position.set(0, 1.0, 0);
    head.rotation.z = -1.4;
    neck.add(head);
    add(head, G.head, coatMat, 0, 0.3, 0);
    if (r() < 0.45) add(head, G.sphere, whiteMat, -0.1, 0.24, 0, 0.035, r() < 0.5 ? 0.24 : 0.08, 0.055);   // 流星・星
    const e1 = add(head, G.ear, coatMat, -0.05, 0.02, 0.07);
    const e2 = add(head, G.ear, coatMat, -0.05, 0.02, -0.07);
    e1.rotation.z = e2.rotation.z = 2.5;

    const tail = new THREE.Group();
    tail.position.set(-1.05, 1.55, 0);
    tail.rotation.z = -2.3;
    body.add(tail);
    add(tail, G.tail, darkMat, 0, 0.42, 0);

    // 脚：付け根を回転、膝で曲げる
    const legs = [];
    const socks = r() < 0.4 && coat.name !== '芦毛' ? Math.floor(r() * 4) + 1 : 0;   // 白い靴下（脚の白斑）
    [[0.6, 0.2, 0.35], [0.6, -0.2, 0.45], [-0.62, 0.2, 0.0], [-0.62, -0.2, 0.1]].forEach(([x, z, off], i) => {
      const upper = new THREE.Group();
      upper.position.set(x, 1.12, z);
      body.add(upper);
      const um = add(upper, G.upper, coatMat, 0, -0.28, 0);
      if (i >= 2) um.scale.set(1.35, 1, 1.25);   // トモ（後脚の付け根）は太く
      const lower = new THREE.Group();
      lower.position.set(0, -0.56, 0);
      upper.add(lower);
      const legMat = i < socks ? whiteMat : coat.name === '鹿毛' || coat.name === '黒鹿毛' ? darkMat : coatMat;
      add(lower, G.lower, legMat, 0, -0.25, 0);
      add(lower, G.hoof, hoofMat, 0, -0.52, 0);
      legs.push({ upper, lower, off, fore: i < 2 });
    });

    // 騎手（前傾のモンキー乗り）
    const jockey = new THREE.Group();
    jockey.position.set(0.18, 1.86, 0);
    body.add(jockey);
    const torso = add(jockey, G.jTorso, silkMat, 0.05, 0.12, 0);
    torso.rotation.z = 0.28;
    add(jockey, G.jHead, skinMat, 0.36, 0.3, 0);
    const cap = add(jockey, G.jCap, capMat, 0.36, 0.32, 0);
    cap.rotation.z = -0.2;
    const arms = [];
    [0.17, -0.17].forEach(z => {
      const arm = add(jockey, G.jArm, sleeveMat, 0.36, 0.1, z);
      arm.rotation.z = -0.55;
      arms.push(arm);
      const th = add(jockey, G.jThigh, whiteMat, -0.02, -0.08, z * 1.15);
      th.rotation.z = -0.75;
      const boot = add(jockey, G.jBoot, bootMat, 0.1, -0.3, z * 1.2);
      boot.rotation.z = 0.25;
    });

    // 影・オーラ・自分の馬マーカー
    const shadow = new THREE.Mesh(G.shadow, st.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.04;
    root.add(shadow);
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: st.auraTex, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    aura.scale.set(5, 5, 1);
    aura.position.y = 1.6;
    aura.visible = false;
    root.add(aura);
    let marker = null;
    if (e.isPlayer) {
      const ring = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      root.add(ring);
      marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.textTexture('▼ ' + e.name, { w: 512, h: 96, bg: '#e8552d', color: '#fff', size: 54 }), depthTest: false, transparent: true }));
      marker.scale.set(4.4, 0.82, 1);
      marker.position.y = 3.3;
      marker.renderOrder = 10;
      root.add(marker);
    }

    return {
      root, body, neck, tail, legs, jockey, arms, aura, marker,
      num, bracket, capColor, silk, coat,
      icon: this.silkIcon(silk, capColor),
      phase: r(), lane: 0.9 + (num - 1) * 1.15 + 0.575, auraUntil: 0, prevPos: 0, speed: 0
    };
  },

  buildHorses(scene, st, res) {
    st.shadowMat = new THREE.MeshBasicMaterial({ map: this.shadowTexture(), transparent: true, depthWrite: false });
    st.auraTex = this.glowTexture('rgba(255,210,80,1)');
    const n = res.entrants.length;
    st.horses = res.entrants.map(e => {
      const h = this.makeHorse(e, e.gate, n, st);
      h.e = e;
      h.ft = (res.finish.find(f => f.id === e.id) || {}).time || 9999;
      scene.add(h.root);
      return h;
    });
  },

  // 蹄で跳ね上げる芝・砂
  buildParticles(scene, st, surface) {
    const N = 700;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: surface === 'turf' ? 0x3b7d32 : 0xb08356, size: 0.14, transparent: true, opacity: 0.9 });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    st.particles = { pts, pos, vel: new Float32Array(N * 3), life: new Float32Array(N), next: 0, N };
  },

  buildRain(scene, st) {
    const N = 1600;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 120; pos[i * 3 + 1] = Math.random() * 40; pos[i * 3 + 2] = (Math.random() - 0.5) * 120; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xdde6ee, size: 0.12, transparent: true, opacity: 0.7 }));
    pts.frustumCulled = false;
    scene.add(pts);
    st.rain = { pts, pos, N };
  },

  // ── HUD（放送風の表示） ──
  buildHud(container) {
    let hud = container.querySelector('.r3-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.className = 'r3-hud';
      container.appendChild(hud);
    }
    const st = this.state;
    const race = st.race;
    const res = st.result;
    const ground = GAME_DATA.grounds[res.ground].label;
    const cams = [['auto', '🎬 自動'], ['side', '📺 横'], ['chase', '🏇 追走'], ['top', '🚁 上空'], ['pov', '👀 騎手']];
    const cam = Player.data.settings.cam3d || 'auto';
    hud.innerHTML = `
      <div class="r3-title">${UI.gradeBadge(race.grade)}<b>${Util.esc(race.name)}</b><small>${race.venue ? Util.esc(race.venue) + ' ' : ''}${res.surface === 'turf' ? '芝' : 'ダート'}${res.distance}m・${ground}</small></div>
      <div class="r3-remain" id="r3-remain">ゲートイン</div>
      <div class="r3-time" id="r3-time">0.0</div>
      <div class="r3-map" id="r3-map"><div class="r3-map-line"></div></div>
      <div class="r3-banner" id="r3-banner"></div>
      <div class="r3-bar" id="r3-bar"></div>
      <div class="r3-cams">${cams.map(([k, l]) => { const [ic, tx] = l.split(' '); return `<button class="${cam === k ? 'active' : ''}" data-cam="${k}" title="${tx}">${ic}<span class="lbl"> ${tx}</span></button>`; }).join('')}<button data-sound="1" title="音">${this.sound.enabled() ? '🔊' : '🔇'}</button><button data-full="1" title="全画面">⛶</button></div>
      <div class="r3-replay" id="r3-replay">REPLAY</div>`;
    hud.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => {
      Player.data.settings.cam3d = b.dataset.cam;
      Player.save();
      st.shot = null;
      hud.querySelectorAll('[data-cam]').forEach(x => x.classList.toggle('active', x === b));
    }));
    hud.querySelector('[data-sound]').addEventListener('click', () => this.toggleSound());
    hud.querySelector('[data-full]').addEventListener('click', () => {
      const el = container;
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    });
    st.hud = {
      remain: hud.querySelector('#r3-remain'), time: hud.querySelector('#r3-time'), map: hud.querySelector('#r3-map'),
      bar: hud.querySelector('#r3-bar'), banner: hud.querySelector('#r3-banner'), orderKey: ''
    };
    // 位置マップの丸（馬番・枠色）
    st.horses.forEach(h => {
      const d = document.createElement('div');
      d.className = 'r3-dot' + (h.e.isPlayer ? ' me' : '');
      d.style.background = h.capColor;
      d.style.color = this.BRACKET_TEXT[h.bracket - 1];
      d.textContent = h.num;
      st.hud.map.appendChild(d);
      h.dot = d;
    });
  },

  banner(text, cls, ms) {
    const st = this.state;
    if (!st || !st.hud) return;
    st.hud.banner.innerHTML = text;
    st.hud.banner.className = 'r3-banner show ' + (cls || '');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => { if (st.hud) st.hud.banner.className = 'r3-banner'; }, ms || 1600);
  },

  onSkill(e) {
    const st = this.state;
    if (!st) return;
    const h = st.horses.find(x => x.e.id === e.horseId);
    if (!h) return;
    h.auraUntil = performance.now() + 1700;
    h.aura.visible = true;
    if (e.isPlayer) this.banner(`<span class="sk">${e.text}</span><small>${Util.esc(e.sub)}</small>`, 'skill', 1800);
  },

  // ── 効果音（WebAudioで合成：歓声・蹄の音・ゲート・ファンファーレ） ──
  sound: {
    ac: null, master: null, crowd: null, crowdGain: null, hoofBuf: null, hoofAcc: 0,
    enabled() { return Player.data.settings.sound3d !== false; },
    init() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      if (!this.ac) {
        this.ac = new AC();
        this.master = this.ac.createGain();
        this.master.connect(this.ac.destination);
        const len = this.ac.sampleRate * 2;
        const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noise = buf;
        const hl = Math.floor(this.ac.sampleRate * 0.07);
        this.hoofBuf = this.ac.createBuffer(1, hl, this.ac.sampleRate);
        const h = this.hoofBuf.getChannelData(0);
        for (let i = 0; i < hl; i++) h[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / hl, 3);
      }
      if (this.ac.state === 'suspended') this.ac.resume();
      this.master.gain.value = this.enabled() ? 0.9 : 0;
      return true;
    },
    startCrowd() {
      if (!this.ac || this.crowd) return;
      const src = this.ac.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const bp = this.ac.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.5;
      this.crowdGain = this.ac.createGain();
      this.crowdGain.gain.value = 0.04;
      src.connect(bp).connect(this.crowdGain).connect(this.master);
      src.start();
      this.crowd = src;
    },
    stop() {
      if (this.crowd) { try { this.crowd.stop(); } catch (e) { /* noop */ } this.crowd = null; }
    },
    setCrowd(v) {
      if (this.crowdGain) this.crowdGain.gain.setTargetAtTime(v, this.ac.currentTime, 0.4);
    },
    hoof(vol) {
      if (!this.ac || vol <= 0.01) return;
      const src = this.ac.createBufferSource();
      src.buffer = this.hoofBuf;
      src.playbackRate.value = 0.7 + Math.random() * 0.5;
      const lp = this.ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 380;
      const g = this.ac.createGain();
      g.gain.value = vol;
      src.connect(lp).connect(g).connect(this.master);
      src.start();
    },
    clang() {
      if (!this.ac) return;
      const t = this.ac.currentTime;
      [220, 331, 467].forEach(f => {
        const o = this.ac.createOscillator();
        const g = this.ac.createGain();
        o.type = 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(0.07, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        o.connect(g).connect(this.master);
        o.start(t); o.stop(t + 0.4);
      });
    }
  },

  toggleSound() {
    Player.data.settings.sound3d = !this.sound.enabled();
    Player.save();
    if (this.sound.enabled()) { this.sound.init(); this.sound.startCrowd(); }
    if (this.sound.master) this.sound.master.gain.value = this.sound.enabled() ? 0.9 : 0;
    if (!this.sound.enabled()) Fanfare.stop();
    const b = this.container && this.container.querySelector('[data-sound]');
    if (b) b.textContent = this.sound.enabled() ? '🔊' : '🔇';
  },

  // ── 毎フレームの描画 ──
  // t：レース内の時刻（秒、マイナスはゲートイン中）、raw：frames から補間した位置、animScale：脚の動きの速さ
  render(t, raw, animScale, speedK = 1) {
    const st = this.state;
    if (!st) return;
    st.speedK = speedK;
    const D = st.D;
    const dt = st.lastT === null ? 0 : Util.clamp(t - st.lastT, -1, 1);
    const realNow = performance.now();
    const realDt = st.lastReal ? Math.min(0.1, (realNow - st.lastReal) / 1000) : 0.016;
    st.lastReal = realNow;
    st.lastT = t;

    // ゴール後も少し走り続ける（減速）
    const pos = st.horses.map((h, i) => {
      if (t > h.ft) return D + 16 * 3.5 * (1 - Math.exp(-(t - h.ft) / 3.5));
      return Math.max(0, raw[i] || 0);
    });

    // ゲートの扉
    const open = Util.clamp(t / 0.35, 0, 1);
    st.doors.forEach(d => { d.rotation.y = open * 1.6; d.position.x = open * 0.5; });

    // 進路（ラチ沿いに寄せつつ、前の馬とぶつからない位置を探す）
    const order = st.horses.map((h, i) => ({ h, p: pos[i], i })).sort((a, b) => b.p - a.p);
    const placed = [];
    const styleBias = { nige: 0, senko: 0.7, sashi: 1.6, oikomi: 2.4 };
    order.forEach((o, rank) => {
      const h = o.h;
      const remain = D - o.p;
      let pref = 1.1 + styleBias[h.e.style] * (o.p > 300 ? 1 : 0.3);
      if (o.p < 150) pref = h.lane;                       // スタート直後はゲートの位置
      if (remain < 420 && remain > -20 && rank >= 3) pref += 2 + (h.e.style === 'oikomi' ? 4 : h.e.style === 'sashi' ? 2 : 0);
      let best = pref, bestCost = Infinity;
      for (let k = -6; k <= 18; k++) {
        const cand = Util.clamp(pref + k * 1.3, 0.9, this.W - 1.6);
        const blocked = placed.some(q => Math.abs(q.p - o.p) < 3.4 && Math.abs(q.lane - cand) < 1.35);
        if (blocked) continue;
        const cost = Math.abs(cand - pref) + Math.abs(cand - h.lane) * 0.6;
        if (cost < bestCost) { bestCost = cost; best = cand; }
      }
      h.target = best;
      placed.push({ p: o.p, lane: best });
    });

    st.horses.forEach((h, i) => {
      const p = pos[i];
      if (t > 0) h.lane += Util.clamp(h.target - h.lane, -1.6 * Math.abs(dt), 1.6 * Math.abs(dt));
      const s = st.sStart + p;
      const a = this.path(s, h.lane);
      const b = this.path(s + 1, h.lane + Util.clamp(h.target - h.lane, -0.15, 0.15));
      h.root.position.set(a.x, 0, a.z);
      h.root.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
      // 速さ（m/s）
      const sp = dt > 0 ? (p - h.prevPos) / dt : h.speed;
      h.speed += (Util.clamp(sp, 0, 22) - h.speed) * 0.2;
      h.prevPos = p;
      this.animateHorse(h, t, realDt * animScale, D - p);
      if (h.aura.visible) {
        const left = h.auraUntil - realNow;
        if (left <= 0) h.aura.visible = false;
        else {
          const k = 1 + 0.25 * Math.sin(realNow / 70);
          h.aura.scale.set(5 * k, 5 * k, 1);
          h.aura.material.opacity = Math.min(1, left / 500);
        }
      }
      if (h.speed > 6 && t > 0) this.emit(h, a);
    });
    this.updateParticles(realDt * animScale);
    this.updateSound(t, pos, order, realDt);
    if (st.rain) this.updateRain(realDt);

    this.direct(t, pos, order, dt, realDt);
    this.renderer.render(st.scene, st.camera);
    this.updateHud(t, pos, order);
  },

  animateHorse(h, t, adt, remain) {
    const running = t > 0 && h.speed > 0.5;
    const freq = running ? 2.35 * Util.clamp(h.speed / 16.5, 0.45, 1.15) : 0;
    h.phase = (h.phase + adt * freq) % 1;
    const ph = h.phase * Math.PI * 2;
    const k = running ? Util.clamp(h.speed / 15, 0, 1) : 0;
    h.body.position.y = k * 0.07 * Math.cos(ph);
    h.body.rotation.z = k * 0.045 * Math.sin(ph);
    h.neck.rotation.z = -0.95 + 0.12 * k * Math.sin(ph + 1.2) + (running ? 0.15 : 0);
    h.tail.rotation.z = -2.3 + 0.35 * k + 0.12 * Math.sin(ph * 0.5);
    h.legs.forEach(L => {
      const p = (h.phase + L.off) % 1;
      let ang, knee;
      if (p < 0.42) { ang = 0.55 - (p / 0.42) * 1.15; knee = 0.05; }
      else { const q = (p - 0.42) / 0.58; ang = -0.6 + 1.15 * (0.5 - 0.5 * Math.cos(q * Math.PI)); knee = Math.sin(q * Math.PI) * 1.3; }
      ang *= k;
      knee *= k;
      L.upper.rotation.z = ang + (running ? 0 : 0.02 * Math.sin(t * 3 + L.off * 9));
      L.lower.rotation.z = L.fore ? -knee : knee * 0.8;
    });
    // 騎手：馬の上下動を吸収し、直線では追い出す
    h.jockey.position.y = 1.86 - h.body.position.y * 0.6;
    const push = running && remain < 420 && remain > 0 ? 1 : 0;
    h.arms.forEach((arm, i) => { arm.rotation.z = -0.55 + push * 0.35 * Math.sin(ph * 2 + i * 0.4); });
  },

  updateSound(t, pos, order, realDt) {
    const st = this.state, snd = this.sound;
    if (!snd.ac || !snd.enabled()) return;
    if (!st.fanfareDone && t < 0) { st.fanfareDone = true; Fanfare.play(st.slot); }
    if (!st.clangDone && t >= 0) { st.clangDone = true; snd.clang(); snd.startCrowd(); }
    const remain = st.D - order[0].p;
    const finished = t > order[0].h.ft;
    const v = t < 0 ? 0.03 : finished ? Math.max(0.12, 0.55 - (t - order[0].h.ft) * 0.05) : remain < 400 ? 0.12 + (400 - remain) / 400 * 0.4 : 0.06;
    snd.setCrowd(v);
    // 蹄の音：カメラに近い馬が多いほど大きく
    if (t > 0) {
      const c = st.camera.position;
      let near = 0;
      st.horses.forEach(h => { const d = h.root.position.distanceTo(c); if (d < 60) near += (60 - d) / 60; });
      st.hoofAcc = (st.hoofAcc || 0) + realDt * 9;
      while (st.hoofAcc > 1) { st.hoofAcc -= 1; snd.hoof(Math.min(0.5, near * 0.06)); }
    }
  },

  emit(h, a) {
    const P = this.state.particles;
    const n = Math.random() < 0.6 ? 1 : 2;
    for (let j = 0; j < n; j++) {
      const i = P.next;
      P.next = (P.next + 1) % P.N;
      P.pos[i * 3] = a.x - a.dx * 1.0 + (Math.random() - 0.5) * 0.6;
      P.pos[i * 3 + 1] = 0.1;
      P.pos[i * 3 + 2] = a.z - a.dz * 1.0 + (Math.random() - 0.5) * 0.6;
      P.vel[i * 3] = -a.dx * (2 + Math.random() * 3) + (Math.random() - 0.5);
      P.vel[i * 3 + 1] = 1.5 + Math.random() * 2.5;
      P.vel[i * 3 + 2] = -a.dz * (2 + Math.random() * 3) + (Math.random() - 0.5);
      P.life[i] = 0.6 + Math.random() * 0.4;
    }
  },

  updateParticles(dt) {
    const P = this.state.particles;
    for (let i = 0; i < P.N; i++) {
      if (P.life[i] <= 0) { P.pos[i * 3 + 1] = -50; continue; }
      P.life[i] -= dt;
      P.vel[i * 3 + 1] -= 9.8 * dt;
      P.pos[i * 3] += P.vel[i * 3] * dt;
      P.pos[i * 3 + 1] = Math.max(0.02, P.pos[i * 3 + 1] + P.vel[i * 3 + 1] * dt);
      P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
    }
    P.pts.geometry.attributes.position.needsUpdate = true;
  },

  updateRain(dt) {
    const st = this.state, R = st.rain, c = st.camera.position;
    for (let i = 0; i < R.N; i++) {
      R.pos[i * 3 + 1] -= 28 * dt;
      if (R.pos[i * 3 + 1] < 0) R.pos[i * 3 + 1] += 40;
    }
    R.pts.position.set(c.x, c.y - 15, c.z);
    R.pts.geometry.attributes.position.needsUpdate = true;
  },

  // ── カメラワーク ──
  direct(t, pos, order, dt, realDt) {
    const st = this.state;
    const D = st.D;
    const mode = Player.data.settings.cam3d || 'auto';
    const lead = order[0];
    const leaderRemain = D - lead.p;
    const me = st.horses.find(h => h.e.isPlayer) || lead.h;
    // 先頭集団の中心
    const top = order.slice(0, Math.min(6, order.length));
    const cS = top.reduce((s, o) => s + o.p, 0) / top.length;
    const center = this.path(st.sStart + cS, this.W * 0.3);
    const out = (p) => ({ x: p.dz, z: -p.dx });     // 外向き

    let shot, cam, look;
    if (mode === 'auto') {
      if (t < 0) shot = 'intro';
      else if (t < 2.5) shot = 'gate';
      else if (leaderRemain > 430) {
        // 道中はカメラを切り替えて中継らしく（横→後ろ→横→上空）
        const cyc = Math.floor((t - 2.5) / 9) % 4;
        shot = leaderRemain < 700 ? 'side' : ['side', 'rear', 'side', 'top'][cyc];
      }
      else if (leaderRemain > 110 && t < lead.h.ft) shot = 'front';
      else if (t < lead.h.ft + 1.2) shot = 'finish';
      else shot = 'after';
    } else shot = mode;

    if (shot === 'intro' || shot === 'gate') {
      const g = this.path(st.sStart, 9);
      const o = out(g);
      const k = shot === 'intro' ? Util.clamp(1 + t / st.preroll, 0, 1) : 1;
      const ahead = shot === 'intro' ? 26 - 8 * k : 20 + t * 6;
      cam = { x: g.x + g.dx * ahead + o.x * (28 - 8 * k), y: 16 - 11 * k, z: g.z + g.dz * ahead + o.z * (28 - 8 * k) };
      const lk = this.path(st.sStart + Math.max(0, cS) * 0.7, 8);
      look = { x: lk.x, y: 1.2, z: lk.z };
    } else if (shot === 'side') {
      const o = out(center);
      const far = 30 * Util.clamp(1.75 / st.camera.aspect, 1, 1.9);   // 縦長の画面では引きで撮る
      cam = { x: center.x + o.x * far - center.dx * 3, y: 6.5 * far / 30, z: center.z + o.z * far - center.dz * 3 };
      look = { x: center.x + center.dx * 4, y: 1.3, z: center.z + center.dz * 4 };
    } else if (shot === 'rear') {
      const o = out(center);
      cam = { x: center.x - center.dx * 24 + o.x * 7, y: 6, z: center.z - center.dz * 24 + o.z * 7 };
      look = { x: center.x + center.dx * 10, y: 1.2, z: center.z + center.dz * 10 };
    } else if (shot === 'front') {
      const f = this.path(st.sStart + lead.p + 34 * Util.clamp(1.75 / st.camera.aspect, 1, 1.6), this.W + 10);
      cam = { x: f.x, y: 4.5, z: f.z };
      look = { x: center.x - center.dx * 4, y: 1.4, z: center.z - center.dz * 4 };
    } else if (shot === 'finish') {
      const f = this.path(st.sF + 4, this.W + 5);
      cam = { x: f.x, y: 2.8, z: f.z };
      const l = this.path(st.sStart + Math.min(lead.p, D + 4) - 3, 5);
      look = { x: l.x, y: 1.4, z: l.z };
    } else if (shot === 'after') {
      const w = this.path(st.sStart + lead.p, lead.h.lane);
      const o = out(w);
      cam = { x: w.x + o.x * 14 + w.dx * 9, y: 3.2, z: w.z + o.z * 14 + w.dz * 9 };
      look = { x: w.x, y: 1.7, z: w.z };
    } else if (shot === 'chase') {
      const p = this.path(st.sStart + Math.max(0, pos[st.horses.indexOf(me)]), me.lane);
      const o = out(p);
      cam = { x: p.x - p.dx * 11 + o.x * 2.5, y: 4.2, z: p.z - p.dz * 11 + o.z * 2.5 };
      look = { x: p.x + p.dx * 14, y: 1.3, z: p.z + p.dz * 14 };
    } else if (shot === 'top') {
      const o = out(center);
      cam = { x: center.x - center.dx * 22 + o.x * 14, y: 36, z: center.z - center.dz * 22 + o.z * 14 };
      look = { x: center.x + center.dx * 10, y: 0, z: center.z + center.dz * 10 };
    } else { // pov
      const p = this.path(st.sStart + Math.max(0, pos[st.horses.indexOf(me)]) + 0.9, me.lane);
      cam = { x: p.x, y: 2.75 + me.body.position.y * 0.5, z: p.z };
      const l = this.path(st.sStart + Math.max(0, pos[st.horses.indexOf(me)]) + 30, me.lane);
      look = { x: l.x, y: 1.4, z: l.z };
    }

    const C = st.camera;
    const cut = st.shot !== shot;
    st.shot = shot;
    const follow = (shot === 'pov' || shot === 'chase' ? 12 : 4) * Math.max(1, st.speedK || 1);   // 早送りでもカメラが置いていかれない
    const k = cut ? 1 : 1 - Math.exp(-realDt * follow);
    st.camPos.lerp(new THREE.Vector3(cam.x, cam.y, cam.z), k);
    st.camLook.lerp(new THREE.Vector3(look.x, look.y, look.z), k);
    C.position.copy(st.camPos);
    C.fov = shot === 'finish' ? 30 : shot === 'pov' ? 70 : shot === 'front' ? 30 : 36;
    if (me.marker) {
      me.marker.visible = shot !== 'pov';
      const sc = shot === 'chase' ? 0.6 : 1;
      me.marker.scale.set(4.4 * sc, 0.82 * sc, 1);
    }
    C.updateProjectionMatrix();
    C.lookAt(st.camLook);
  },

  updateHud(t, pos, order) {
    const st = this.state;
    const hud = st.hud;
    if (!hud) return;
    const D = st.D;
    const lead = order[0];
    const remain = D - lead.p;
    hud.time.textContent = t < 0 ? '0.0' : Race.timeText(Math.min(t, lead.h.ft < 9000 && t > lead.h.ft ? lead.h.ft : t));
    hud.remain.textContent = t < 0 ? 'ゲートイン' : remain <= 0 ? 'ゴール' : remain <= 400 ? `最後の直線 残り${Math.ceil(remain / 100) * 100}m` : `残り ${Math.ceil(remain / 100) * 100}m`;
    if (t > 0 && t < 1.2 && !st.startShown) { st.startShown = true; this.banner('スタート！', 'start', 1100); }
    if (lead.h.ft < 9000 && t >= lead.h.ft && !st.goalShown) {
      st.goalShown = true;
      const w = lead.h;
      const second = order[1];
      const close = second && second.h.ft - w.ft < 0.06;
      this.banner(`${close ? '<small>写真判定…</small>' : ''}<span class="gw"><span class="num" style="background:${w.capColor};color:${this.BRACKET_TEXT[w.bracket - 1]}">${w.num}</span>${Util.esc(w.e.name)}</span><small>1着でゴールイン！</small>`, 'goal', 3000);
    }
    const now = performance.now();
    if (now - st.lastHud < 120) return;
    st.lastHud = now;
    // 左の位置マップ：先頭からの差を縦方向に
    const H = hud.map.clientHeight - 24;
    const maxGap = Math.max(24, order[order.length - 1] ? lead.p - order[order.length - 1].p : 24);
    const rows = {};
    order.forEach(o => {
      const gap = Math.max(0, lead.p - o.p);
      let y = Math.round(gap / maxGap * H / 16) * 16;
      const col = rows[y] = (rows[y] || 0) + 1;
      o.h.dot.style.transform = `translate(${(col - 1) * 15}px, ${y}px)`;
    });
    // 下の順位バー
    const key = order.map(o => o.h.num).join(',');
    if (key !== hud.orderKey) {
      hud.orderKey = key;
      hud.bar.innerHTML = order.map((o, i) => `<div class="r3-item ${o.h.e.isPlayer ? 'me' : ''}">
        <img src="${o.h.icon}" alt=""><span class="r3-pos">${i + 1}</span>
        <span class="r3-num" style="background:${o.h.capColor};color:${this.BRACKET_TEXT[o.h.bracket - 1]}">${o.h.num}</span>
        <span class="r3-name">${o.h.e.legendId ? '👑' : ''}${Util.esc(o.h.e.name)}</span></div>`).join('');
    }
  }
};
