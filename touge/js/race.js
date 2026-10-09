// ===== 峠 SPIRITS : 3D race renderer, HUD & input =====
(function () {
  'use strict';
  const S = window.TougeSim, D = window.TOUGE_DATA;
  const W = 4.2;            // road half width
  const DS = S.DS;

  // ---------- helpers ----------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (sel, root = document) => root.querySelector(sel);
  function el(tag, cls, html, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = 4;
    return t;
  }
  function radialTex(inner, outer, size = 128) {
    return canvasTex(size, size, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, inner); gr.addColorStop(1, outer);
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    });
  }
  const TEX = {};
  function makeTextures() {
    if (TEX.ready) return;
    TEX.road = (wet) => canvasTex(256, 512, (g, w, h) => {
      g.fillStyle = wet ? '#1b1c21' : '#2b2b30'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const v = Math.random() * 40 + (wet ? 20 : 35);
        g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
      }
      // patches
      for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 60, 30 + Math.random() * 90); }
      g.fillStyle = '#e8e8e8'; g.fillRect(6, 0, 7, h); g.fillRect(w - 13, 0, 7, h);
      g.fillStyle = '#e8b51c'; g.fillRect(w / 2 - 7, 0, 4, h); g.fillRect(w / 2 + 3, 0, 4, h);
      // tyre wear lines
      g.fillStyle = 'rgba(0,0,0,0.18)'; [62, 92, 162, 192].forEach(x => g.fillRect(x, 0, 14, h));
    }, true);
    TEX.glow = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    TEX.smoke = canvasTex(64, 64, (g, w) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    });
    TEX.pool = radialTex('rgba(255,200,120,0.55)', 'rgba(255,170,80,0)');
    TEX.shadow = radialTex('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)');
    TEX.checker = canvasTex(256, 32, (g, w, h) => {
      for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; g.fillRect(x * 16, y * 16, 16, 16); }
    });
    TEX.chevron = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#d81e2a'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#fff'; g.lineWidth = 16; g.lineJoin = 'miter';
      g.beginPath(); g.moveTo(40, 22); g.lineTo(84, 64); g.lineTo(40, 106); g.stroke();
      g.strokeStyle = '#000'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    });
    TEX.banner = (txt, bg, fg) => Object.assign(canvasTex(512, 96, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = fg; g.font = 'bold 64px "Arial Black",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, w / 2, h / 2 + 2);
      g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    }), { _own: true });
    TEX.ready = true;
  }

  // ---------- particles (custom shader points) ----------
  class Particles {
    constructor(scene, cap, additive, tex) {
      this.cap = cap; this.n = 0;
      const g = new THREE.BufferGeometry();
      this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3);
      this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
      this.vel = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap);
      this.s0 = new Float32Array(cap); this.s1 = new Float32Array(cap); this.a0 = new Float32Array(cap);
      this.grav = new Float32Array(cap); this.drag = new Float32Array(cap);
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
      g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
      g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
      this.mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: tex }, scale: { value: 400 } },
        vertexShader: 'attribute float size;attribute float alpha;attribute vec3 pcolor;varying float vA;varying vec3 vC;uniform float scale;void main(){vA=alpha;vC=pcolor;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=size*scale/max(0.5,-mv.z);gl_Position=projectionMatrix*mv;}',
        fragmentShader: 'uniform sampler2D map;varying float vA;varying vec3 vC;void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(vC*t.rgb,t.a*vA);if(gl_FragColor.a<0.01)discard;}',
        transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false;
      this.geo = g; scene.add(this.pts);
      this.head = 0;
    }
    emit(x, y, z, vx, vy, vz, life, s0, s1, a0, r, gr, b, grav = 0, drag = 0.5) {
      const i = this.head; this.head = (this.head + 1) % this.cap;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
      this.life[i] = life; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0;
      this.col[i * 3] = r; this.col[i * 3 + 1] = gr; this.col[i * 3 + 2] = b;
      this.grav[i] = grav; this.drag[i] = drag;
    }
    update(dt) {
      for (let i = 0; i < this.cap; i++) {
        if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
        this.life[i] -= dt;
        const k = 1 - this.life[i] / this.max[i], dr = Math.max(0, 1 - this.drag[i] * dt);
        this.vel[i * 3] *= dr; this.vel[i * 3 + 2] *= dr; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt;
        this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
        this.size[i] = lerp(this.s0[i], this.s1[i], k);
        this.alpha[i] = this.a0[i] * (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9);
      }
      this.geo.attributes.position.needsUpdate = true; this.geo.attributes.size.needsUpdate = true;
      this.geo.attributes.alpha.needsUpdate = true; this.geo.attributes.pcolor.needsUpdate = true;
    }
  }

  // ---------- skid marks ----------
  class Skids {
    constructor(scene, cap = 1600) {
      this.cap = cap; this.head = 0;
      this.pos = new Float32Array(cap * 4 * 3);
      const idx = [];
      for (let i = 0; i < cap; i++) { const b = i * 4; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setIndex(idx);
      this.geo = g;
      const m = new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; scene.add(this.mesh);
    }
    add(ax, ay, az, bx, by, bz, wx, wz) {
      const i = this.head, p = this.pos, o = i * 12; this.head = (this.head + 1) % this.cap;
      p[o] = ax - wx; p[o + 1] = ay; p[o + 2] = az - wz;
      p[o + 3] = ax + wx; p[o + 4] = ay; p[o + 5] = az + wz;
      p[o + 6] = bx - wx; p[o + 7] = by; p[o + 8] = bz - wz;
      p[o + 9] = bx + wx; p[o + 10] = by; p[o + 11] = bz + wz;
      this.geo.attributes.position.needsUpdate = true;
    }
  }

  // ---------- car model ----------
  const PALETTE = [0xf2f2f2, 0x111214, 0xc8101e, 0xb9bec6, 0x1f4fbf, 0xf3c316, 0xff6a13, 0x2c6e49, 0x6a1b9a, 0x2bb3d9, 0xd9c7a0, 0x8a0f1d];
  function carColor(card) {
    const m = card.model;
    if (/GT-R \(R3[24]\)/.test(m)) return 0x2a5fd1;
    if (/RX-7 Type RS|Spirit R/.test(m)) return 0xf3c316;
    if (/RX-7 Turbo II/.test(m)) return 0xf2f2f2;
    if (/180SX/.test(m)) return 0xe8e8e8;
    if (/NSX/.test(m)) return 0xc8101e;
    if (/C10|KPGC/.test(m)) return 0xd8d8d8;
    return PALETTE[(card.id * 7919) % PALETTE.length];
  }
  function bodyStyle(card) {
    const m = card.model.toLowerCase();
    if (card.tyre === 'slick') return 'race';
    if (/roadster|mx-5|s2000|spider|convertible|cappuccino|beat|speedster|del sol|s660/.test(m)) return 'roadster';
    if (/civic|swift|march|alto|crx|cr-x|pulsar|fit|jazz|colt|mirage|juke|sunny|leaf|note|i-miev/.test(m)) return 'hatch';
    if (/wagon|stagea|touring|outback|legacy|pajero|cx-|outlander|forester|x-trail|patrol|interstar/.test(m)) return 'wagon';
    if (/sedan|laurel|cefiro|lancer|impreza|wrx|skyline 4-door|3 2.5|6 /.test(m)) return 'sedan';
    return 'coupe';
  }
  function extrude(pts, depth, mat) {
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
    g.translate(0, 0, -depth / 2);
    g.rotateY(-Math.PI / 2); // shape x → world z (forward)
    return new THREE.Mesh(g, mat);
  }
  function makeCar(card, opts = {}) {
    const root = new THREE.Group();
    const grp = new THREE.Group(); root.add(grp);
    const lenK = clamp(0.7 + (card.weight || 1200) / 4200, 0.84, 1.1);
    const col = opts.color != null ? opts.color : carColor(card);
    const style = bodyStyle(card);
    const paint = new THREE.MeshPhongMaterial({ color: col, shininess: 90, specular: 0x666666 });
    const glass = new THREE.MeshPhongMaterial({ color: 0x0b1018, shininess: 120, specular: 0x8899aa });
    const dark = new THREE.MeshLambertMaterial({ color: 0x15161a });
    const tall = style === 'wagon' ? 0.08 : 0;
    const low = style === 'race' ? -0.1 : 0;
    const body = [[2.2, 0.3], [2.24, 0.56 + low], [1.25, 0.76 + low], [-1.9, 0.84 + low + tall], [-2.2, 0.8 + low + tall], [-2.22, 0.32], [-1.6, 0.22], [1.6, 0.22]];
    grp.add(extrude(body, 1.72, paint));
    let cab;
    if (style === 'hatch') cab = [[0.55, 0.78], [-0.25, 1.22], [-1.75, 1.2], [-2.05, 0.84]];
    else if (style === 'wagon') cab = [[0.5, 0.84], [-0.3, 1.3], [-2.0, 1.3], [-2.15, 0.88]];
    else if (style === 'sedan') cab = [[0.6, 0.78], [-0.2, 1.24], [-1.25, 1.24], [-1.95, 0.84]];
    else if (style === 'roadster') cab = [[0.45, 0.78], [0.05, 1.1], [-0.08, 1.1], [0.1, 0.78]];
    else if (style === 'race') cab = [[0.4, 0.68], [-0.4, 1.05], [-1.0, 1.05], [-1.5, 0.74]];
    else cab = [[0.5, 0.78], [-0.35, 1.2], [-1.1, 1.2], [-1.85, 0.85]];
    grp.add(extrude(cab, style === 'race' ? 1.2 : 1.5, glass));
    if (style !== 'roadster') {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.05, Math.abs(cab[2][0] - cab[1][0]) + 0.1), paint);
      roof.position.set(0, cab[1][1] + 0.03, (cab[1][0] + cab[2][0]) / 2); grp.add(roof);
    } else {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 0.9), dark); seat.position.set(0, 0.85, -0.5); grp.add(seat);
    }
    // spoiler
    if (style === 'race' || /GT-R|Evo|Evolution|WRX|STI|Type R|Spec-R|270R|RX-7|S15|180SX|Silvia/.test(card.model)) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.32), style === 'race' ? dark : paint);
      wing.position.set(0, style === 'race' ? 1.12 : 1.02, -1.95); grp.add(wing);
      [-0.6, 0.6].forEach(x => { const st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.12), dark); st.position.set(x, style === 'race' ? 1.0 : 0.92, -1.95); grp.add(st); });
    }
    // lights
    const headM = new THREE.MeshBasicMaterial({ color: 0xfff6dc });
    const tailM = new THREE.MeshBasicMaterial({ color: 0xff1a1a });
    const heads = [], tails = [];
    [-0.6, 0.6].forEach(x => {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.05), headM); h.position.set(x, 0.6 + low, 2.25); grp.add(h); heads.push(h);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.05), tailM); t.position.set(x, 0.66 + low + tall, -2.24); grp.add(t); tails.push(t);
    });
    // glow sprites
    const mkSprite = (color, size) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.scale.set(size, size, 1); return sp;
    };
    const tailGlow = [], headGlow = [];
    [-0.6, 0.6].forEach(x => {
      const t = mkSprite(0xff2020, 1.0); t.position.set(x, 0.66 + low + tall, -2.35); grp.add(t); tailGlow.push(t);
      const h = mkSprite(0xfff0c8, 1.6); h.position.set(x, 0.6 + low, 2.35); grp.add(h); headGlow.push(h);
    });
    // wheels
    const wheels = [];
    const tyreG = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 14); tyreG.rotateZ(Math.PI / 2);
    const rimG = new THREE.CylinderGeometry(0.22, 0.22, 0.27, 8); rimG.rotateZ(Math.PI / 2);
    const tyreM = new THREE.MeshLambertMaterial({ color: 0x0c0c0c });
    const rimM = new THREE.MeshPhongMaterial({ color: 0x9aa0a8, shininess: 60 });
    [[-0.8, 1.35], [0.8, 1.35], [-0.8, -1.35], [0.8, -1.35]].forEach(([x, z], i) => {
      const piv = new THREE.Group(); piv.position.set(x, 0.34, z * lenK);
      const w = new THREE.Group();
      w.add(new THREE.Mesh(tyreG, tyreM)); w.add(new THREE.Mesh(rimG, rimM));
      piv.add(w); root.add(piv); wheels.push({ piv, w, front: z > 0 });
    });
    // shadow
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.2), new THREE.MeshBasicMaterial({ map: TEX.shadow, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.04; sh.scale.y = lenK; root.add(sh);
    grp.scale.z = lenK;
    return { grp: root, body: grp, wheels, tails, tailGlow, headGlow, tailM, col };
  }

  // ---------- spatial hash for course ----------
  function courseHash(c) {
    const cell = 20, map = new Map();
    for (let i = 0; i < c.N; i += 2) {
      const k = Math.floor(c.X[i] / cell) + ',' + Math.floor(c.Z[i] / cell);
      if (!map.has(k)) map.set(k, []); map.get(k).push(i);
    }
    return function nearest(x, z, iSelf, excl) {
      const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
      let best = 1e9, bj = -1;
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
        const arr = map.get((cx + a) + ',' + (cz + b)); if (!arr) continue;
        for (const j of arr) {
          if (iSelf >= 0 && Math.abs(j - iSelf) < excl) continue;
          const d = Math.hypot(c.X[j] - x, c.Z[j] - z);
          if (d < best) { best = d; bj = j; }
        }
      }
      return [best, bj];
    };
  }

  // ---------- world ----------
  function buildWorld(scene, c, theme, seed) {
    const rnd = S.rng(seed || 7);
    const T = theme;
    const nearest = courseHash(c);
    const N = c.N;
    const rx = (h) => -Math.cos(h), rz = (h) => Math.sin(h);
    let minY = 1e9, maxY = -1e9;
    for (let i = 0; i < N; i++) { minY = Math.min(minY, c.Y[i]); maxY = Math.max(maxY, c.Y[i]); }
    let cx = 0, cz = 0; for (let i = 0; i < N; i++) { cx += c.X[i]; cz += c.Z[i]; } cx /= N; cz /= N;

    // --- road ---
    {
      const cols = 5, pos = [], uv = [], idx = [];
      for (let i = 0; i < N; i++) {
        const h = c.H[i];
        for (let k = 0; k < cols; k++) {
          const o = -W + (2 * W) * k / (cols - 1);
          pos.push(c.X[i] + rx(h) * o, c.Y[i], c.Z[i] + rz(h) * o);
          uv.push(k / (cols - 1), i * DS / 14);
        }
        if (i < N - 1) for (let k = 0; k < cols - 1; k++) {
          const a = i * cols + k, b = a + 1, d = a + cols, e = d + 1;
          idx.push(a, d, b, b, d, e);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const roadTex = TEX.road(T.wet); roadTex._own = true;
      const m = new THREE.MeshPhongMaterial({ map: roadTex, shininess: T.wet ? 90 : 12, specular: T.wet ? 0x8090a0 : 0x222222 });
      const mesh = new THREE.Mesh(g, m); scene.add(mesh);
    }
    // --- terrain ribbons (both sides) ---
    const sideProfiles = {
      // side +1 = valley (guardrail), side -1 = mountain
      '1': { off: [W, W + 1.4, W + 4, W + 16, W + 45, W + 110], hy: [0, -0.15, -2.5, -12, -34, -70] },
      '-1': { off: [W, W + 1.1, W + 2.5, W + 9, W + 28, W + 90], hy: [0, -0.12, 2.5, 11, 24, 34] },
    };
    const terrainCol = {
      night: [0x1a2619, 0x232a22, 0x15201a], dusk: [0x5a3a22, 0x6a4a2a, 0x4a3422], rain: [0x16201a, 0x1d241f, 0x121a15], fog: [0x4f6249, 0x5c6c52, 0x46573f],
    }[T.key] || [0x223322, 0x2a332a, 0x1a2a1a];
    const extents = { '1': new Float32Array(N), '-1': new Float32Array(N) };
    for (const sg of [1, -1]) {
      const P = sideProfiles[sg], nO = P.off.length;
      const pos = [], col = [], idx = [];
      const cA = new THREE.Color(terrainCol[0]), cB = new THREE.Color(terrainCol[1]), cC = new THREE.Color(terrainCol[2]), gut = new THREE.Color(sg > 0 ? 0x3a3a3c : 0x4a4a4c);
      for (let i = 0; i < N; i++) {
        const h = c.H[i];
        // max extent before hitting another part of the road or folding on the inside of a curve
        let lim = 1e9;
        let kmax = 0; for (let j = Math.max(0, i - 15); j <= Math.min(N - 1, i + 15); j++) if (Math.sign(c.K[j]) === -sg) kmax = Math.max(kmax, Math.abs(c.K[j]));
        // inside of curve: inside = -dir; dir = sign(K) → inside side = -sign(K)
        if (kmax > 0) lim = Math.min(lim, 0.85 / kmax);
        let endY = null;
        for (let o = W + 4; o <= P.off[nO - 1]; o += 4) {
          const px = c.X[i] + rx(h) * o * sg, pz = c.Z[i] + rz(h) * o * sg;
          const [dd, j] = nearest(px, pz, i, 30);
          if (dd < W + 7) { lim = Math.min(lim, o - 6); endY = (c.Y[j] - c.Y[i]) * 0.5 - 1.2; break; }
        }
        lim = Math.max(lim, W + 2);
        extents[sg][i] = lim;
        for (let k = 0; k < nO; k++) {
          let o = P.off[k], hy = P.hy[k];
          if (o > lim) {
            o = lim + (k - 1) * 0.3;
            if (endY !== null) hy = Math.max(Math.min(hy, endY + 2), endY); // meet the other leg
          }
          pos.push(c.X[i] + rx(h) * o * sg, c.Y[i] + hy, c.Z[i] + rz(h) * o * sg);
          const cc = k <= 1 ? gut : (k === 2 ? cC : ((i + k) % 3 === 0 ? cB : cA));
          const v = 0.85 + rnd() * 0.3;
          col.push(cc.r * v, cc.g * v, cc.b * v);
        }
        if (i < N - 1) for (let k = 0; k < nO - 1; k++) {
          const a = i * nO + k, b = a + 1, d = a + nO, e = d + 1;
          if (sg > 0) idx.push(a, d, b, b, d, e); else idx.push(a, b, d, b, e, d);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
      scene.add(new THREE.Mesh(g, m));
    }
    // ground far below
    {
      const g = new THREE.PlaneGeometry(8000, 8000); g.rotateX(-Math.PI / 2);
      const m = new THREE.MeshLambertMaterial({ color: terrainCol[2] });
      const mesh = new THREE.Mesh(g, m); mesh.position.set(cx, minY - 60, cz); scene.add(mesh);
    }
    // --- guardrail on valley side ---
    {
      const pos = [], idx = [];
      const off = W + 1.0;
      for (let i = 0; i < N; i++) {
        const h = c.H[i], x = c.X[i] + rx(h) * off, z = c.Z[i] + rz(h) * off, y = c.Y[i];
        pos.push(x, y + 0.5, z, x, y + 0.85, z);
        if (i < N - 1) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      scene.add(new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: 0xc8ccd2, shininess: 80, specular: 0xffffff, side: THREE.DoubleSide })));
      const nPost = Math.floor(N / 2);
      const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), new THREE.MeshLambertMaterial({ color: 0x8a8e94 }), nPost);
      const refl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.14), new THREE.MeshBasicMaterial({ color: 0xffa020 }), Math.ceil(nPost / 5));
      const m4 = new THREE.Matrix4(); let ri = 0;
      for (let p = 0; p < nPost; p++) {
        const i = p * 2, h = c.H[i];
        m4.makeRotationY(h); m4.setPosition(c.X[i] + rx(h) * (off + 0.08), c.Y[i] + 0.45, c.Z[i] + rz(h) * (off + 0.08));
        posts.setMatrixAt(p, m4);
        if (p % 5 === 0 && ri < refl.count) { m4.makeRotationY(h); m4.setPosition(c.X[i] + rx(h) * (off - 0.04), c.Y[i] + 0.95, c.Z[i] + rz(h) * (off - 0.04)); refl.setMatrixAt(ri++, m4); }
      }
      scene.add(posts); scene.add(refl);
    }
    // --- chevron signs on outside of drift corners ---
    {
      const geo = new THREE.PlaneGeometry(0.9, 0.9);
      const mat = new THREE.MeshBasicMaterial({ map: TEX.chevron, side: THREE.DoubleSide });
      for (const cr of c.corners) {
        const outside = cr.dir; // left turn → outside on right (+1)
        const n = Math.max(3, Math.round((cr.sOut - cr.sIn) / 12));
        for (let k = 0; k <= n; k++) {
          const s = lerp(cr.sIn, cr.sOut, k / n), p = S.sampleAt(c, s);
          const o = (outside > 0 ? W + 1.6 : W + 1.4) * outside;
          const m = new THREE.Mesh(geo, mat);
          m.position.set(p.x + rx(p.h) * o, p.y + 1.35, p.z + rz(p.h) * o);
          m.rotation.y = p.h + Math.PI; // face oncoming car
          m.scale.x = outside > 0 ? 1 : -1; // arrow direction
          scene.add(m);
          const pole = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), new THREE.MeshLambertMaterial({ color: 0x777777 }));
          pole.position.set(m.position.x, p.y + 0.45, m.position.z); scene.add(pole);
        }
      }
    }
    // --- street lamps ---
    const pools = [];
    if (T.lamps) {
      const poleM = new THREE.MeshLambertMaterial({ color: 0x55585c });
      const headM = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
      const poolM = new THREE.MeshBasicMaterial({ map: TEX.pool, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
      for (let s = 60; s < c.L - 20; s += 130) {
        const p = S.sampleAt(c, s), o = -(W + 1.4);
        const x = p.x + rx(p.h) * o, z = p.z + rz(p.h) * o;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 6), poleM); pole.position.set(x, p.y + 3.5, z); scene.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.2), poleM);
        arm.position.set(x + rx(p.h) * 1.0, p.y + 7, z + rz(p.h) * 1.0); arm.rotation.y = p.h + Math.PI / 2; scene.add(arm);
        const hx = x + rx(p.h) * 2.0, hz = z + rz(p.h) * 2.0;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.3), headM); head.position.set(hx, p.y + 6.9, hz); scene.add(head);
        const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
        gl.scale.set(5, 5, 1); gl.position.set(hx, p.y + 6.7, hz); scene.add(gl);
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), poolM);
        pool.rotation.x = -Math.PI / 2; pool.position.set(hx, p.y + 0.06, hz); scene.add(pool); pools.push(pool);
      }
    }
    // --- trees ---
    {
      const palettes = {
        night: [0x10241a, 0x153020, 0x0d1d14], dusk: [0xb23218, 0xd85a1a, 0xe9a326, 0x8a2614, 0x3a5226, 0xc84020], rain: [0x10201a, 0x15291e, 0x0c1912], fog: [0x2c4a33, 0x36583c, 0x24402c, 0x3e5e40],
      }[T.key] || [0x1a3a22];
      const pts = [];
      for (let i = 0; i < N; i += 2) {
        for (const sg of [1, -1]) {
          if (rnd() > 0.55) continue;
          const lim = extents[sg][i];
          const P = sideProfiles[sg];
          const o = W + 5 + rnd() * Math.max(0, Math.min(lim, P.off[P.off.length - 1]) - W - 6);
          if (o > lim - 1) continue;
          const h = c.H[i];
          const x = c.X[i] + rx(h) * o * sg + (rnd() - 0.5) * 3, z = c.Z[i] + rz(h) * o * sg + (rnd() - 0.5) * 3;
          const [dd] = nearest(x, z, -1, 0);
          if (dd < W + 3.5) continue;
          // terrain height at this offset
          let hy = 0;
          for (let k = 0; k < P.off.length - 1; k++) if (o >= P.off[k] && o <= P.off[k + 1]) { hy = lerp(P.hy[k], P.hy[k + 1], (o - P.off[k]) / (P.off[k + 1] - P.off[k])); }
          pts.push([x, c.Y[i] + hy, z, 0.7 + rnd() * 0.9, palettes[Math.floor(rnd() * palettes.length)]]);
        }
      }
      const coneG = new THREE.ConeGeometry(2.2, 6, 6); coneG.translate(0, 5, 0);
      const cone2 = new THREE.ConeGeometry(1.6, 4.5, 6); cone2.translate(0, 8, 0);
      const trunkG = new THREE.CylinderGeometry(0.25, 0.3, 2.5, 5); trunkG.translate(0, 1.25, 0);
      const leafM = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const trunkM = new THREE.MeshLambertMaterial({ color: 0x3a2a1c });
      const n = pts.length;
      const A = new THREE.InstancedMesh(coneG, leafM, n), B = new THREE.InstancedMesh(cone2, leafM, n), Tr = new THREE.InstancedMesh(trunkG, trunkM, n);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), colr = new THREE.Color();
      pts.forEach((p, k) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p[3] * 9);
        sc.set(p[3], p[3] * (0.9 + (k % 5) * 0.08), p[3]); ps.set(p[0], p[1] - 0.3, p[2]);
        m4.compose(ps, q, sc);
        A.setMatrixAt(k, m4); B.setMatrixAt(k, m4); Tr.setMatrixAt(k, m4);
        colr.setHex(p[4]); A.setColorAt(k, colr); colr.multiplyScalar(1.15); B.setColorAt(k, colr);
      });
      scene.add(A); scene.add(B); scene.add(Tr);
    }
    // --- gallery (spectators) at hairpins + start ---
    const flashes = [];
    {
      const bodyG = new THREE.CylinderGeometry(0.22, 0.28, 1.1, 6); bodyG.translate(0, 0.55, 0);
      const headG = new THREE.SphereGeometry(0.17, 6, 5); headG.translate(0, 1.32, 0);
      const spots = [];
      c.corners.filter(cr => cr.ang >= 140).forEach(cr => {
        const mid = (cr.sIn + cr.sOut) / 2;
        for (let k = 0; k < 9; k++) spots.push([mid + (rnd() - 0.5) * (cr.sOut - cr.sIn) * 0.8, cr.dir, W + 2.3 + rnd() * 2.0]);
      });
      for (let k = 0; k < 10; k++) spots.push([4 + k * 2.2, k % 2 ? 1 : -1, W + 2.0 + rnd()]);
      for (let k = 0; k < 10; k++) spots.push([c.L - 30 + k * 3, k % 2 ? 1 : -1, W + 2.0 + rnd()]);
      const n = spots.length;
      const bM = new THREE.MeshLambertMaterial({ color: 0xffffff }), hM = new THREE.MeshLambertMaterial({ color: 0xe0b090 });
      const Bm = new THREE.InstancedMesh(bodyG, bM, n), Hm = new THREE.InstancedMesh(headG, hM, n);
      const m4 = new THREE.Matrix4(), colr = new THREE.Color();
      const shirts = [0x223355, 0x552222, 0x333333, 0xdddddd, 0x225533, 0x664411, 0x111111];
      spots.forEach(([s, sg, o], k) => {
        const p = S.sampleAt(c, clamp(s, 0, c.L));
        const x = p.x + rx(p.h) * o * sg, z = p.z + rz(p.h) * o * sg;
        const [dd] = nearest(x, z, -1, 0);
        if (dd < W + 1.2) { m4.makeScale(0.001, 0.001, 0.001); }
        else { m4.makeRotationY(rnd() * 6); m4.setPosition(x, p.y + (sg > 0 ? -0.2 : 0.15), z); }
        Bm.setMatrixAt(k, m4); Hm.setMatrixAt(k, m4);
        colr.setHex(shirts[k % shirts.length]); Bm.setColorAt(k, colr);
        if (k % 3 === 0) {
          const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
          f.position.set(x, p.y + 1.5, z); f.scale.set(2.5, 2.5, 1); scene.add(f); flashes.push({ sp: f, s, t: rnd() * 3 });
        }
      });
      scene.add(Bm); scene.add(Hm);
    }
    // --- start & finish lines / banners ---
    const addLine = (s, txt, bg, fg) => {
      const p = S.sampleAt(c, s);
      const line = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, 1.6), new THREE.MeshBasicMaterial({ map: TEX.checker, polygonOffset: true, polygonOffsetFactor: -2 }));
      line.rotation.order = 'YXZ'; line.rotation.y = p.h; line.rotation.x = -Math.PI / 2;
      line.position.set(p.x, p.y + 0.03, p.z); scene.add(line);
      const pm = new THREE.MeshLambertMaterial({ color: 0x888888 });
      [-1, 1].forEach(sg => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), pm);
        pole.position.set(p.x + rx(p.h) * (W + 0.6) * sg, p.y + 3, p.z + rz(p.h) * (W + 0.6) * sg); scene.add(pole);
      });
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(2 * W + 1.2, 1.4), new THREE.MeshBasicMaterial({ map: TEX.banner(txt, bg, fg), side: THREE.DoubleSide }));
      ban.position.set(p.x, p.y + 5.4, p.z); ban.rotation.y = p.h + Math.PI; scene.add(ban);
    };
    addLine(8, 'START', '#111', '#ffd400');
    addLine(c.L - 1, 'GOAL', '#c8101e', '#ffffff');

    // --- sky / backdrop ---
    const sky = new THREE.Group(); scene.add(sky);
    {
      const g = new THREE.SphereGeometry(1900, 24, 16);
      const top = new THREE.Color(T.skyTop), bot = new THREE.Color(T.skyBot), cols = [];
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i) / 1900; const t = clamp((y + 0.05) / 0.6, 0, 1);
        const cc = bot.clone().lerp(top, Math.pow(t, 0.7)); cols.push(cc.r, cc.g, cc.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      sky.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
      // mountain ridges
      const fogC = new THREE.Color(T.fog);
      [[1500, 260, 0.55], [1250, 180, 0.8]].forEach(([r, hgt, shade], li) => {
        const pos = [], idx = []; const n = 96;
        for (let k = 0; k <= n; k++) {
          const a = k / n * Math.PI * 2;
          const hh = hgt * (0.35 + 0.65 * Math.abs(Math.sin(a * 3 + li) * Math.sin(a * 7.3 + li * 2) + 0.3 * Math.sin(a * 17)));
          pos.push(Math.cos(a) * r, -200, Math.sin(a) * r, Math.cos(a) * r, hh - 120, Math.sin(a) * r);
          if (k < n) { const b = k * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
        }
        const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx);
        const cc = new THREE.Color(T.skyBot).lerp(new THREE.Color(0x000000), shade).lerp(fogC, 0.25);
        sky.add(new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color: cc, side: THREE.DoubleSide, fog: false, depthWrite: false })));
      });
      if (T.stars) {
        const sp = [];
        for (let k = 0; k < 1400; k++) {
          const a = rnd() * Math.PI * 2, e = Math.asin(0.1 + rnd() * 0.9);
          sp.push(Math.cos(a) * Math.cos(e) * 1700, Math.sin(e) * 1700, Math.sin(a) * Math.cos(e) * 1700);
        }
        const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
        sky.add(new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false })));
      }
      if (T.moon || T.sun) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: T.sun ? 0xffa050 : 0xdfe8ff, fog: false, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        sp.scale.set(T.sun ? 600 : 260, T.sun ? 600 : 260, 1); sp.position.set(-900, T.sun ? 60 : 650, 1100); sky.add(sp);
        const core = new THREE.Mesh(new THREE.CircleGeometry(T.sun ? 60 : 38, 24), new THREE.MeshBasicMaterial({ color: T.sun ? 0xffd27a : 0xf4f6ff, fog: false, depthWrite: false }));
        core.position.copy(sp.position); core.lookAt(0, 0, 0); sky.add(core);
      }
    }
    sky.renderOrder = -1;
    // city lights in the valley
    if (T.city) {
      const cp = [], cc = [];
      for (let k = 0; k < 1600; k++) {
        const a = rnd() * Math.PI * 2, r = 500 + Math.pow(rnd(), 0.6) * 1100;
        cp.push(cx + Math.cos(a) * r, minY - 140 - rnd() * 30, cz + Math.sin(a) * r);
        const w = rnd(); const col = w < 0.6 ? [1, 0.75, 0.4] : w < 0.85 ? [1, 0.95, 0.85] : [0.6, 0.85, 1];
        cc.push(...col);
      }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
      scene.add(new THREE.Points(gg, new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, opacity: 0.9, depthWrite: false })));
    }
    return { sky, flashes, minY, maxY, center: [cx, cz] };
  }

  // =====================================================================
  //                               RACE
  // =====================================================================
  const R = {};
  let renderer = null, scene, camera, root, hud = {}, running = false, raf = 0;
  let race, course, theme, cars = [], human = null, opts, world;
  let smoke, sparks, flames, skids, rain = null;
  let camMode = 'chase', camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), shake = 0, fov = 62;
  let timeScale = 1, lastT = 0, phase = 'idle', phaseT = 0, paused = false, resultSent = false;
  let ringState = null, finishedAt = null, lastPromptCorner = -1, flashAlpha = 0;
  const tmpV = new THREE.Vector3();

  R.mount = function (container) {
    root = container;
    root.innerHTML = '';
    makeTextures();
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputEncoding = THREE.sRGBEncoding;
    root.appendChild(renderer.domElement);
    renderer.domElement.className = 'gl';
    buildHUD();
    window.addEventListener('resize', resize);
  };

  function buildHUD() {
    const h = el('div', 'hud', null, root);
    hud.root = h;
    hud.fx = el('canvas', 'fxcanvas', null, h);
    hud.vignette = el('div', 'vignette', null, h);
    hud.flash = el('div', 'flash', null, h);
    hud.nitroFx = el('div', 'nitrofx', null, h);
    hud.touch = el('div', 'touch', null, h);
    const top = el('div', 'hud-top', null, h);
    hud.you = el('div', 'hud-side you', '<div class="who">YOU</div><div class="pos">1<sup>st</sup></div><div class="score">DRIFT <b>0</b></div>', top);
    const mid = el('div', 'hud-mid', null, top);
    hud.timer = el('div', 'timer', '00:00:00', mid);
    hud.gap = el('div', 'gap', '', mid);
    hud.them = el('div', 'hud-side them', '<div class="who">THEM</div><div class="nm"></div>', top);
    hud.mini = el('canvas', 'minimap', null, h); hud.mini.width = 150; hud.mini.height = 150;
    hud.banner = el('div', 'banner', '', h);
    hud.combo = el('div', 'combo', '', h);
    hud.msg = el('div', 'msg', '', h);
    hud.ring = el('div', 'ring', `<svg viewBox="-60 -60 120 120"><circle class="tgt" r="30"/><circle class="perf" r="30"/><circle class="mov" r="30"/><text class="arrow" y="9">◀</text></svg><div class="lbl">PUSH</div>`, h);
    hud.hold = el('div', 'holdbar', '<div class="fill"></div><span>HOLD — 出口で離す</span>', h);
    hud.judges = el('div', 'judges', null, h);
    hud.speedo = el('div', 'speedo', `<svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="42"/><circle class="arc" cx="50" cy="50" r="42"/></svg><div class="num">0</div><div class="unit">km/h</div><div class="gear">1</div>`, h);
    hud.nitro = el('button', 'nitro', `<svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="44"/><circle class="arc" cx="50" cy="50" r="44"/></svg><span>N₂O</span>`, h);
    hud.cardL = el('div', 'hudcard left', '', h);
    hud.cardR = el('div', 'hudcard right', '', h);
    hud.count = el('div', 'countdown', '', h);
    hud.intro = el('div', 'intro', '', h);
    hud.btns = el('div', 'hud-btns', '<button data-a="pause">❚❚</button><button data-a="cam">📷</button>', h);
    hud.tutorial = el('div', 'tutorial', '', h);
    hud.pause = el('div', 'pausemenu hidden', '<div class="pbox"><h2>PAUSE</h2><button data-a="resume" class="btn primary">再開</button><button data-a="retire" class="btn">リタイア</button></div>', h);

    // input
    const down = (e) => { e.preventDefault(); Sound.init(); R.press(); };
    const up = (e) => { e.preventDefault(); R.release(); };
    hud.touch.addEventListener('pointerdown', down);
    hud.touch.addEventListener('pointerup', up);
    hud.touch.addEventListener('pointercancel', up);
    hud.touch.addEventListener('pointerleave', (e) => { if (e.buttons) up(e); });
    hud.nitro.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); R.nitro(); });
    hud.btns.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'pause') R.pause(); if (a === 'cam') R.toggleCam();
    });
    hud.pause.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'resume') R.resume(); if (a === 'retire') R.retire();
    });
    window.addEventListener('keydown', (e) => {
      if (!running) return;
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'ArrowDown' || e.code === 'Enter') { e.preventDefault(); R.press(); }
      if (e.code === 'KeyX' || e.code === 'ShiftLeft' || e.code === 'KeyN' || e.code === 'ArrowUp') { e.preventDefault(); R.nitro(); }
      if (e.code === 'KeyC') R.toggleCam();
      if (e.code === 'Escape' || e.code === 'KeyP') paused ? R.resume() : R.pause();
    });
    window.addEventListener('keyup', (e) => {
      if (!running) return;
      if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'ArrowDown' || e.code === 'Enter') { e.preventDefault(); R.release(); }
    });
  }

  function resize() {
    if (!renderer || !root) return;
    const w = root.clientWidth || window.innerWidth, h = root.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
    hud.fx.width = w; hud.fx.height = h;
    const sc = h / (2 * Math.tan((fov * Math.PI / 180) / 2));
    [smoke, sparks, flames].forEach(p => p && (p.mat.uniforms.scale.value = sc));
  }

  // ---------- start a race ----------
  // o: { courseId, format, target, player:{name, card, tune}, rival:{name, card, tune, skill, remote}, assist, onFinish, net, seed, tutorial, introText }
  function disposeScene() {
    if (!scene) return;
    scene.traverse((ob) => {
      if (ob.geometry) ob.geometry.dispose();
      const ms = Array.isArray(ob.material) ? ob.material : ob.material ? [ob.material] : [];
      ms.forEach((m) => { if (m.map && m.map._own) m.map.dispose(); m.dispose(); });
    });
    renderer.renderLists.dispose();
    scene = null;
  }

  R.start = function (o) {
    opts = o;
    disposeScene();
    const def = D.COURSES[o.courseId];
    theme = Object.assign({ key: def.theme }, D.THEMES[def.theme]);
    course = S.buildCourse(def);
    // scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
    scene.background = new THREE.Color(theme.fog);
    camera = new THREE.PerspectiveCamera(62, 1, 0.1, 4000);
    scene.add(new THREE.HemisphereLight(theme.hemi[0], theme.hemi[1], theme.hemi[2]));
    const dl = new THREE.DirectionalLight(theme.dir[0], theme.dir[1]); dl.position.set(-300, 400, 500); scene.add(dl);
    world = buildWorld(scene, course, theme, o.seed || 11);
    smoke = new Particles(scene, 900, false, TEX.smoke);
    sparks = new Particles(scene, 300, true, TEX.glow);
    flames = new Particles(scene, 300, true, TEX.glow);
    skids = new Skids(scene);
    rain = null;
    if (theme.rain) {
      const n = 1400, pos = new Float32Array(n * 6);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fb0c8, transparent: true, opacity: 0.35, fog: false }));
      ls.frustumCulled = false; scene.add(ls);
      rain = { ls, pos, n, seeds: Array.from({ length: n }, () => [Math.random() * 60 - 30, Math.random() * 30, Math.random() * 60 - 30]) };
    }
    // sim
    race = new S.RaceSim(course, { wet: theme.wet, format: o.format, autoPlay: o.autoPlay });
    const chase = o.format === 'chase';
    const side = o.side === 'right' ? 2 : -2;
    const hp = race.add({ id: 0, name: o.player.name, card: o.player.card, tune: o.player.tune, kind: 'human', d0: o.rival ? side : 0, s0: 0, assist: o.assist, seed: 1 });
    let rp = null;
    if (o.rival) rp = race.add({ id: 1, name: o.rival.name, card: o.rival.card, tune: o.rival.tune, kind: o.rival.remote ? 'remote' : 'ai', skill: o.rival.skill, d0: chase ? 0 : -side, s0: chase ? 14 : 0, seed: (o.seed || 5) * 3 + 1 });
    if (chase) hp.d0 = hp.d = hp.dT = 0;
    // visuals
    cars = [];
    const mk = (sim, isHuman) => {
      const m = makeCar(sim.card);
      scene.add(m.grp);
      const spot = new THREE.SpotLight(0xfff1d6, isHuman ? 2.4 : 1.6, 110, 0.48, 0.45, 1.2);
      spot.position.set(0, 0.8, 2.0); m.grp.add(spot);
      const tgt = new THREE.Object3D(); tgt.position.set(0, -1.5, 30); m.grp.add(tgt); spot.target = tgt;
      const v = { sim, m, spot, prevRear: null, wheelRot: 0, yaw: 0, roll: 0, isHuman };
      cars.push(v); return v;
    };
    human = mk(hp, true);
    if (rp) mk(rp, false);
    // HUD cards
    hud.cardL.innerHTML = window.UI ? UI.cardHTML(o.player.card, { mini: true, tune: o.player.tune }) : '';
    hud.cardR.innerHTML = o.rival && window.UI ? UI.cardHTML(o.rival.card, { mini: true, tune: o.rival.tune }) : '';
    hud.cardR.style.display = o.rival ? '' : 'none';
    hud.them.querySelector('.nm').textContent = o.rival ? o.rival.name : (o.format === 'ta' ? `TARGET ${fmtTime(o.target)}` : '');
    hud.them.querySelector('.who').textContent = o.rival ? (o.rival.remote ? 'ONLINE' : 'RIVAL') : 'TIME ATTACK';
    hud.you.querySelector('.who').textContent = o.player.name || 'YOU';
    hud.you.querySelector('.pos').style.display = o.rival ? '' : 'none';
    drawMinimapBase();
    resize();
    // state
    phase = 'intro'; phaseT = 0; paused = false; resultSent = false; finishedAt = null; timeScale = 1;
    lastPromptCorner = -1; ringState = null; flashAlpha = 0; camMode = o.camMode || camMode;
    hud.pause.classList.add('hidden');
    hud.btns.querySelector('[data-a=pause]').style.display = o.net ? 'none' : '';
    hud.tutorial.innerHTML = ''; hud.tutorial.className = 'tutorial';
    hud.intro.innerHTML = `<div class="stripe"></div><div class="introtxt"><div class="c1">${def.name}</div><div class="c2">${def.en} — ${theme.label}</div><div class="c3">${o.introText || ({ battle: 'DOWNHILL BATTLE', chase: '後追いバトル ― 1秒以内でゴールせよ', ta: 'TIME ATTACK' })[o.format] || ''}</div></div>`;
    hud.intro.className = 'intro show';
    hud.count.textContent = '';
    placeCars(0);
    const p0 = S.sampleAt(course, 0);
    camPos.set(p0.x + Math.sin(p0.h + 0.9) * 13, p0.y + 2.2, p0.z + Math.cos(p0.h + 0.9) * 13); camLook.set(p0.x, p0.y + 1, p0.z);
    running = true;
    Sound.init(); Sound.startEngine(); Sound.playBGM(o.boss ? 'boss' : 'race');
    lastT = performance.now();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  };

  function fmtTime(t) {
    if (t == null || !isFinite(t)) return '--:--:--';
    const m = Math.floor(t / 60), s = Math.floor(t % 60), cs = Math.floor((t * 100) % 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(cs).padStart(2, '0')}`;
  }
  R.fmtTime = fmtTime;

  // ---------- input ----------
  R.press = function () {
    if (!running || paused || phase !== 'race') return;
    human.sim.press(); handleEvents();
  };
  R.release = function () {
    if (!running || paused || phase !== 'race') return;
    human.sim.release(); handleEvents();
  };
  R.nitro = function () {
    if (!running || paused || phase !== 'race') return;
    if (human.sim.useNitro()) handleEvents();
  };
  R.toggleCam = function () { camMode = camMode === 'chase' ? 'top' : camMode === 'top' ? 'hood' : 'chase'; };
  R.pause = function () { if (!running || (opts && opts.net) || phase === 'finish') return; paused = true; hud.pause.classList.remove('hidden'); Sound.stopEngine(); };
  R.resume = function () { if (!paused) return; paused = false; hud.pause.classList.add('hidden'); lastT = performance.now(); Sound.startEngine(); };
  R.retire = function () { paused = false; hud.pause.classList.add('hidden'); endRace(true); };
  R.stop = function () { running = false; cancelAnimationFrame(raf); Sound.stopEngine(); };
  R.isRunning = () => running;
  R.debug = () => { const ps = human && phase === 'race' ? human.sim.promptState() : null; return { t: race && race.t, phase, s: human && human.sim.s, L: course && course.L, ci: human && human.sim.ci, dr: human && human.sim.driftAmt, pk: ps && ps.kind, pt: ps && ps.t }; };
  // online: remote state
  R.netState = function (st) {
    const rc = cars[1]; if (!rc || rc.sim.kind !== 'remote') return;
    const sim = rc.sim;
    sim._net = { s: st.s, v: st.v, d: st.d, dr: st.dr, ni: st.ni, at: performance.now() };
    if (st.fin != null && !sim.finished) { sim.finished = true; sim.finishTime = st.fin; }
  };
  R.netGone = function () { const rc = cars[1]; if (rc) rc.sim._gone = true; };
  R.humanState = function () {
    const s = human.sim;
    return { s: +s.s.toFixed(2), v: +s.v.toFixed(2), d: +s.d.toFixed(2), dr: +s.driftAmt.toFixed(2), ni: s.nitroT > 0 ? 1 : 0, fin: s.finished ? s.finishTime : null };
  };

  // ---------- main loop ----------
  function loop(now) {
    raf = requestAnimationFrame(loop);
    let dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (window.__DT) dt = window.__DT; // debug: fixed timestep
    if (!running) return;
    if (paused) { renderer.render(scene, camera); return; }
    dt *= timeScale;
    phaseT += dt;
    if (phase === 'intro') {
      if (phaseT > 2.2) { phase = 'count'; phaseT = 0; hud.intro.className = 'intro'; showTutorial(); }
    } else if (phase === 'count') {
      const n = 3 - Math.floor(phaseT);
      const label = n > 0 ? String(n) : 'GO!!';
      if (hud.count.dataset.v !== label) {
        hud.count.dataset.v = label; hud.count.textContent = label;
        hud.count.className = 'countdown pop' + (n <= 0 ? ' go' : '');
        void hud.count.offsetWidth; hud.count.className = 'countdown pop' + (n <= 0 ? ' go' : '');
        Sound.countdown(n <= 0);
      }
      if (phaseT >= 3) { phase = 'race'; phaseT = 0; flash('#fff', 0.5); setTimeout(() => { hud.count.textContent = ''; hud.count.dataset.v = ''; }, 700); }
    } else if (phase === 'race' || phase === 'finish') {
      // fixed sub-steps for stability
      let rem = dt;
      while (rem > 0) {
        const h = Math.min(1 / 120, rem); rem -= h;
        stepRemote(h);
        race.step(h);
      }
      handleEvents();
      if (phase === 'race' && human.sim.finished) onHumanFinish();
      if (phase === 'finish') {
        if (phaseT > 0.9) timeScale = lerp(timeScale, 1, 0.05);
        if (!resultSent && phaseT > 2.6 && resultReady()) endRace(false);
      }
    }
    updateVisuals(dt);
    updateCamera(dt);
    updateHUD(dt);
    if (window.__SKIP && (R._f = (R._f || 0) + 1) % window.__SKIP) return; // debug: skip renders
    renderer.render(scene, camera);
  }

  function stepRemote(dt) {
    for (const c of cars) {
      const s = c.sim; if (s.kind !== 'remote') continue;
      const n = s._net; if (!n) continue;
      const age = (performance.now() - n.at) / 1000;
      const target = n.s + n.v * Math.min(age, 0.5);
      s.s = lerp(s.s, Math.min((course.N - 2) * DS, target), Math.min(1, dt * 8));
      s.v = n.v; s.d = lerp(s.d, n.d, Math.min(1, dt * 6)); s.driftAmt = n.dr; s.nitroT = n.ni ? 0.2 : 0;
    }
  }

  function resultReady() {
    if (!opts.rival) return true;
    const r = cars[1].sim;
    if (r.kind === 'remote') return r.finished || r._gone || phaseT > 45;
    return true;
  }

  function onHumanFinish() {
    phase = 'finish'; phaseT = 0; finishedAt = human.sim.finishTime;
    timeScale = 0.3;
    flash('#fff', 0.6);
    Sound.whoosh();
    hud.count.textContent = 'FINISH'; hud.count.className = 'countdown pop finish';
    ringState = null; hud.ring.classList.remove('show'); hud.hold.classList.remove('show');
    // predict the AI's finish time on a cloned sim (the live rival keeps driving on screen)
    if (opts.rival && cars[1].sim.kind === 'ai' && !cars[1].sim.finished) cars[1].sim._pred = predictFinish(cars[1].sim);
  }

  function predictFinish(rs) {
    const tmp = new S.RaceSim(course, { wet: theme.wet, format: opts.format });
    const c = tmp.add({ id: 9, card: rs.card, tune: opts.rival.tune, kind: 'ai', skill: rs.skill, seed: 99 });
    ['s', 'v', 'd', 'ci', 'phase', 'factor', 'factorEnd', 'nitro', 'nitroT', 'boostT', 'boostAmt', 'drifting', 'driftAmt', 'entryRank', 'hitT'].forEach(k => c[k] = rs[k]);
    tmp.t = race.t;
    let n = 0;
    while (!c.finished && n < 60 * 240) { tmp.step(1 / 60); tmp.events.length = 0; n++; }
    return c.finished ? c.finishTime : race.t + 999;
  }
  function rivalTime() {
    if (!opts.rival) return null;
    const rs = cars[1].sim;
    if (rs._pred != null) return rs._pred;
    return rs.finished ? rs.finishTime : null;
  }

  function endRace(retired) {
    if (resultSent) return; resultSent = true;
    const hs = human.sim, rs = opts.rival ? cars[1].sim : null;
    const pt = retired ? null : hs.finishTime;
    let win = false, rt = rivalTime();
    if (!retired) {
      if (opts.format === 'ta') win = pt <= opts.target;
      else if (rs && rs._gone && !rs.finished) win = true;
      else if (opts.format === 'chase') win = rt == null || pt - rt <= 1.0;
      else win = rt == null || pt < rt;
    }
    const res = {
      win, retired, time: pt, rivalTime: rt, score: hs.score, counts: hs.counts, maxCombo: hs.maxCombo, format: opts.format, target: opts.target,
    };
    Sound.stopEngine();
    setTimeout(() => { running = false; cancelAnimationFrame(raf); opts.onFinish && opts.onFinish(res); }, retired ? 50 : 300);
  }

  // ---------- events → effects ----------
  function handleEvents() {
    const evs = race.events.splice(0);
    for (const e of evs) {
      const isH = e.car === human.sim;
      if (e.type === 'judge') {
        if (isH) {
          popJudge(e.rank, e.phase, e.pts, e.why);
          Sound.judge(e.rank);
          if (e.rank === 'MISS') { shake = 1.0; Sound.crash(); emitSparks(human); flash('#ff2040', 0.25); }
          else if (e.rank === 'PERFECT') { flash(e.phase === 'exit' ? '#7df9ff' : '#ffe680', 0.18); if (e.phase === 'exit') Sound.blowoff(); }
          if (e.phase === 'entry' && e.rank !== 'MISS') Sound.noiseBurst(0.25, 2500, 4, 0.12);
        } else if (e.rank === 'MISS') {
          const vc = cars.find(c => c.sim === e.car); if (vc) emitSparks(vc);
        }
      } else if (e.type === 'nitro') {
        if (isH) { Sound.whoosh(); flash('#40c8ff', 0.3); showMsg('NITRO!!', 'nitro'); }
      } else if (e.type === 'blocked') {
        if (isH) showMsg('ブロックされた！ 立ち上がりで抜け！', 'warn');
        else if (opts.rival) showMsg('ブロック成功！', 'good');
      } else if (e.type === 'slip') {
        if (isH) showMsg('SLIPSTREAM', 'slip');
      } else if (e.type === 'lead') {
        if (phase === 'race' && opts.rival) {
          if (e.car === human.sim) { showMsg('OVERTAKE!!', 'good big'); Sound.chord([660, 880, 1320], 0.3, 'square', 0.08); }
          else { showMsg('抜かれた……！', 'warn big'); }
        }
      }
    }
  }

  function popJudge(rank, ph, pts, why) {
    const d = el('div', 'judge ' + rank.toLowerCase(), '', hud.judges);
    const sub = ph === 'entry' ? (rank === 'MISS' ? (why === 'late' ? 'LATE' : '進入ミス') : 'ドリフト進入') : (rank === 'MISS' ? (why === 'early' ? '早すぎ' : '遅すぎ') : '立ち上がり');
    d.innerHTML = `<div class="r">${rank}${rank === 'PERFECT' ? '!!' : rank === 'GREAT' ? '!' : ''}</div><div class="s">${sub}${pts ? ` <b>+${pts.toLocaleString()}</b>` : ''}</div>`;
    const rp = hud.ring.getBoundingClientRect(), hr = hud.root.getBoundingClientRect();
    d.style.left = (rp.width ? rp.left + rp.width / 2 - hr.left : hr.width / 2) + 'px';
    d.style.top = (rp.height ? rp.top - hr.top + 10 : hr.height * 0.45) + 'px';
    setTimeout(() => d.remove(), 1100);
  }
  function showMsg(txt, cls) {
    hud.msg.innerHTML = `<span>${txt}</span>`; hud.msg.className = 'msg show ' + (cls || '');
    clearTimeout(hud.msg._t); hud.msg._t = setTimeout(() => { hud.msg.className = 'msg'; }, 1400);
  }
  function flash(color, a) { hud.flash.style.background = color; flashAlpha = a; }
  function showTutorial() {
    if (!opts.tutorial) return;
    hud.tutorial.innerHTML = '<div class="tbox"><b>操作方法</b><br>① リングが重なる瞬間に <kbd>押す</kbd>（タップ / Space）→ ドリフト進入<br>② 押したままコーナーを抜けて、出口のリングで <kbd>離す</kbd><br>③ ゲージが満タンで <kbd>N₂O</kbd>（Xキー）でニトロ！</div>';
    hud.tutorial.className = 'tutorial show';
    setTimeout(() => { hud.tutorial.className = 'tutorial'; }, 7000);
  }
  function emitSparks(vc) {
    const g = vc.m.grp;
    for (let k = 0; k < 40; k++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      tmpV.set(side * 0.9, 0.4, (Math.random() - 0.5) * 3).applyMatrix4(g.matrixWorld);
      sparks.emit(tmpV.x, tmpV.y, tmpV.z, (Math.random() - 0.5) * 10, Math.random() * 5 + 1, (Math.random() - 0.5) * 10, 0.4 + Math.random() * 0.4, 0.35, 0.05, 1, 1, 0.7, 0.25, 12, 1.5);
    }
  }

  // ---------- visuals ----------
  function placeCars(dt) {
    for (const vc of cars) {
      const s = vc.sim, p = S.sampleAt(course, s.s);
      const rx = -Math.cos(p.h), rz = Math.sin(p.h);
      const x = p.x + rx * s.d, z = p.z + rz * s.d;
      const p2 = S.sampleAt(course, s.s + 2);
      const pitch = Math.atan2(p2.y - p.y, 2);
      const k = course.K[p.i] || 0;
      const dir = Math.sign(k);
      const ang = (s.st ? s.st.driftAng : 25) * Math.PI / 180;
      let wantYaw = s.driftAmt * dir * ang;
      if (!s.drifting && k !== 0) wantYaw += dir * 0.05;
      if (s.hitT > 0) wantYaw += Math.sin(performance.now() / 40) * 0.08;
      vc.yaw = lerp(vc.yaw, wantYaw, Math.min(1, dt * 7));
      const wantRoll = -dir * Math.min(0.09, s.v * s.v * Math.abs(k) * 0.004);
      vc.roll = lerp(vc.roll, wantRoll, Math.min(1, dt * 5));
      const g = vc.m.grp;
      g.position.set(x, p.y, z);
      g.rotation.order = 'YXZ';
      g.rotation.set(-pitch, p.h + vc.yaw, vc.roll);
      vc.heading = p.h; vc.p = p;
      // wheels
      vc.wheelRot += s.v * dt / 0.34;
      vc.m.wheels.forEach(w => { w.w.rotation.x = vc.wheelRot; if (w.front) w.piv.rotation.y = -vc.yaw * 0.8 + dir * 0.12 * (1 - s.driftAmt); });
      // brake light intensity
      const braking = s._lastV != null && s.v < s._lastV - 0.02;
      s._lastV = s.v;
      const tl = braking ? 1.8 : 1.0;
      vc.m.tailGlow.forEach(t => t.scale.set(tl, tl, 1));
      // visibility fog-theme: headlight intensity
      vc.spot.intensity = theme.key === 'fog' ? 0.6 : (vc.isHuman ? 2.4 : 1.6);
    }
  }

  function updateVisuals(dt) {
    placeCars(dt);
    const now = performance.now() / 1000;
    for (const vc of cars) {
      const s = vc.sim, g = vc.m.grp;
      g.updateMatrixWorld();
      // rear wheel world positions
      const rl = new THREE.Vector3(-0.8, 0.05, -1.35).applyMatrix4(g.matrixWorld);
      const rr = new THREE.Vector3(0.8, 0.05, -1.35).applyMatrix4(g.matrixWorld);
      const sliding = s.driftAmt > 0.3 || s.hitT > 0;
      if (sliding && vc.prevRear && dt > 0) {
        const wx = Math.cos(vc.heading) * 0.13, wz = -Math.sin(vc.heading) * 0.13;
        skids.add(vc.prevRear[0].x, vc.prevRear[0].y + 0.03, vc.prevRear[0].z, rl.x, rl.y + 0.03, rl.z, wx, wz);
        skids.add(vc.prevRear[1].x, vc.prevRear[1].y + 0.03, vc.prevRear[1].z, rr.x, rr.y + 0.03, rr.z, wx, wz);
      }
      vc.prevRear = [rl, rr];
      // tyre smoke
      const smokeCol = theme.key === 'fog' ? [0.92, 0.93, 0.95] : theme.key === 'dusk' ? [0.85, 0.72, 0.68] : theme.wet ? [0.6, 0.65, 0.72] : [0.62, 0.64, 0.72];
      if (sliding && dt > 0) {
        const n = theme.wet ? 1 : 3;
        for (let k = 0; k < n; k++) {
          const src = k % 2 ? rl : rr;
          smoke.emit(src.x, src.y + 0.3, src.z, (Math.random() - 0.5) * 3, Math.random() * 1.2 + 0.3, (Math.random() - 0.5) * 3, 1.6 + Math.random() * 1.2, 1.2, 7 + Math.random() * 3, theme.wet ? 0.25 : 0.42, ...smokeCol, -0.2, 0.9);
        }
      }
      // rain spray
      if (theme.wet && s.v > 10 && dt > 0 && Math.random() < 0.8) {
        const src = Math.random() < 0.5 ? rl : rr;
        smoke.emit(src.x, src.y + 0.2, src.z, (Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2, 0.6, 0.8, 3.5, 0.22, 0.75, 0.8, 0.88, 2, 2);
      }
      // nitro flames
      if (s.nitroT > 0 && dt > 0) {
        for (const x of [-0.45, 0.45]) {
          const ex = new THREE.Vector3(x, 0.35, -2.35).applyMatrix4(g.matrixWorld);
          const back = new THREE.Vector3(0, 0, -1).applyQuaternion(g.quaternion);
          for (let k = 0; k < 2; k++) flames.emit(ex.x, ex.y, ex.z, back.x * 8 + (Math.random() - 0.5), back.y * 8 + Math.random() * 0.5, back.z * 8 + (Math.random() - 0.5), 0.18 + Math.random() * 0.1, 0.9, 0.15, 1, 0.3, 0.6, 1, 0, 3);
        }
      } else if (s.v > 25 && Math.random() < 0.04 && dt > 0) {
        // backfire pop
        const ex = new THREE.Vector3(0.45, 0.35, -2.35).applyMatrix4(g.matrixWorld);
        for (let k = 0; k < 6; k++) flames.emit(ex.x, ex.y, ex.z, (Math.random() - 0.5) * 2, Math.random(), (Math.random() - 0.5) * 2, 0.12, 0.6, 0.1, 1, 1, 0.55, 0.15, 0, 3);
      }
    }
    smoke.update(dt); sparks.update(dt); flames.update(dt);
    // spectators' camera flashes near the player
    for (const f of world.flashes) {
      f.t -= dt;
      if (f.t <= 0) { f.t = 0.4 + Math.random() * 2.5; if (Math.abs(f.s - human.sim.s) < 80) f.sp.material.opacity = 1; }
      f.sp.material.opacity *= Math.max(0, 1 - dt * 12);
    }
    // rain around camera
    if (rain) {
      const p = rain.pos;
      for (let k = 0; k < rain.n; k++) {
        const sd = rain.seeds[k];
        sd[1] -= dt * 28; if (sd[1] < -5) { sd[1] = 25; sd[0] = Math.random() * 60 - 30; sd[2] = Math.random() * 60 - 30; }
        const x = camera.position.x + sd[0], y = camera.position.y + sd[1] - 5, z = camera.position.z + sd[2];
        p[k * 6] = x; p[k * 6 + 1] = y; p[k * 6 + 2] = z; p[k * 6 + 3] = x + 0.05; p[k * 6 + 4] = y + 0.9; p[k * 6 + 5] = z;
      }
      rain.ls.geometry.attributes.position.needsUpdate = true;
    }
    world.sky.position.copy(camera.position);
    // engine audio
    const hs = human.sim;
    const v = hs.v, top = hs.st.top;
    const gears = [0, 0.22, 0.38, 0.55, 0.72, 0.87, 1.05];
    let gear = 1; while (gear < 6 && v / top > gears[gear]) gear++;
    const lo = gears[gear - 1], hi = gears[gear];
    const rpm = 1800 + 6800 * clamp((v / top - lo) / (hi - lo), 0, 1);
    if (hs._gear && gear > hs._gear && phase === 'race') Sound.blowoff();
    hs._gear = gear; hs._rpm = phase === 'count' ? 3500 + Math.sin(now * 9) * 1500 : phase === 'intro' ? 1100 : rpm;
    const load = phase === 'race' ? (hs.v < hs.prof[Math.floor(hs.s / DS)] ? 1 : 0.2) : 0.3;
    Sound.updateEngine(hs._rpm, load, phase === 'race' ? Math.max(hs.driftAmt, hs.hitT > 0 ? 0.8 : 0) : 0, v, hs.nitroT > 0);
  }

  function updateCamera(dt) {
    const vc = human, g = vc.m.grp, s = vc.sim;
    const h = vc.heading, fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
    const p = g.position;
    let wantPos, wantLook, wantFov = 60 + s.v * 0.22 + (s.nitroT > 0 ? 14 : 0);
    if (phase === 'intro' || phase === 'count') {
      // cinematic orbit around the grid
      const t = phase === 'intro' ? phaseT / 2.2 : 1 + phaseT / 3;
      const u = clamp(t / 2, 0, 1), e = u * u * (3 - 2 * u);
      const a = lerp(0.9, Math.PI, e);
      const dist = lerp(13, 8, e);
      let mx = p.x, mz = p.z;
      if (opts.rival && cars[1]) { const q = cars[1].m.grp.position; mx = (p.x + q.x) / 2; mz = (p.z + q.z) / 2; }
      wantPos = new THREE.Vector3(mx + Math.sin(h + a) * dist, p.y + lerp(2.2, 3.0, e), mz + Math.cos(h + a) * dist);
      wantLook = new THREE.Vector3(mx + fx * lerp(0, 4, e), p.y + 0.9, mz + fz * lerp(0, 4, e));
      wantFov = 50;
    } else if (phase === 'finish' && phaseT < 2.4) {
      // static drive-by shot just past the GOAL
      const q = S.sampleAt(course, course.L + 22);
      const qr = [-Math.cos(q.h), Math.sin(q.h)];
      wantPos = new THREE.Vector3(q.x + qr[0] * 6.5, q.y + 1.8, q.z + qr[1] * 6.5);
      wantLook = new THREE.Vector3(p.x, p.y + 0.8, p.z);
      wantFov = 50;
      if (phaseT < 0.05) { camPos.copy(wantPos); camLook.copy(wantLook); }
    } else if (camMode === 'top') {
      wantPos = new THREE.Vector3(p.x - fx * 14 + rx * 7, p.y + 22, p.z - fz * 14 + rz * 7);
      wantLook = new THREE.Vector3(p.x + fx * 7, p.y, p.z + fz * 7);
      wantFov = 48;
    } else if (camMode === 'hood') {
      const yaw = h + vc.yaw * 0.5;
      wantPos = new THREE.Vector3(p.x + Math.sin(yaw) * 0.6, p.y + 1.25, p.z + Math.cos(yaw) * 0.6);
      wantLook = new THREE.Vector3(p.x + Math.sin(yaw) * 20, p.y + 0.8, p.z + Math.cos(yaw) * 20);
    } else {
      const dist = 6.4 + s.v * 0.025, hgt = 2.3;
      const side = -Math.sign(course.K[vc.p.i] || 0) * s.driftAmt * 1.6;
      const yaw = h + vc.yaw * 0.35;
      wantPos = new THREE.Vector3(p.x - Math.sin(yaw) * dist + rx * side, p.y + hgt, p.z - Math.cos(yaw) * dist + rz * side);
      wantLook = new THREE.Vector3(p.x + fx * 5, p.y + 0.9, p.z + fz * 5);
    }
    const k = 1 - Math.exp(-dt * (phase === 'intro' || phase === 'count' ? 3 : 7));
    camPos.lerp(wantPos, k); camLook.lerp(wantLook, k);
    // keep camera above road
    const pc = S.sampleAt(course, Math.max(0, s.s - 6));
    if (camPos.y < pc.y + 0.8) camPos.y = pc.y + 0.8;
    fov = lerp(fov, wantFov, 1 - Math.exp(-dt * 3));
    camera.fov = fov; camera.updateProjectionMatrix();
    shake = Math.max(0, shake - dt * 2.5);
    const sh = shake * 0.35 + (s.nitroT > 0 ? 0.05 : 0) + (s.v > 30 ? 0.01 : 0);
    camera.position.set(camPos.x + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z + (Math.random() - 0.5) * sh);
    camera.lookAt(camLook);
    if (phase !== 'intro' && phase !== 'count') camera.rotateZ(-Math.sign(course.K[vc.p.i] || 0) * s.driftAmt * 0.04);
    const sc = (root.clientHeight || 600) / (2 * Math.tan((fov * Math.PI / 180) / 2));
    smoke.mat.uniforms.scale.value = sc; sparks.mat.uniforms.scale.value = sc; flames.mat.uniforms.scale.value = sc;
  }

  // ---------- HUD ----------
  function drawMinimapBase() {
    const cv = hud.mini, g = cv.getContext('2d');
    let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
    for (let i = 0; i < course.N; i++) { mnx = Math.min(mnx, course.X[i]); mxx = Math.max(mxx, course.X[i]); mnz = Math.min(mnz, course.Z[i]); mxz = Math.max(mxz, course.Z[i]); }
    const sc = 130 / Math.max(mxx - mnx, mxz - mnz);
    const ox = (150 - (mxx - mnx) * sc) / 2, oz = (150 - (mxz - mnz) * sc) / 2;
    hud.miniTf = (x, z) => [150 - (ox + (x - mnx) * sc), 150 - (oz + (z - mnz) * sc)];
    const base = document.createElement('canvas'); base.width = base.height = 150;
    const b = base.getContext('2d');
    b.lineCap = 'round'; b.lineJoin = 'round';
    b.strokeStyle = 'rgba(0,0,0,0.6)'; b.lineWidth = 7; b.beginPath();
    for (let i = 0; i < course.N; i += 2) { const [x, y] = hud.miniTf(course.X[i], course.Z[i]); i ? b.lineTo(x, y) : b.moveTo(x, y); }
    b.stroke();
    b.strokeStyle = 'rgba(255,255,255,0.85)'; b.lineWidth = 3; b.stroke();
    const [sx, sy] = hud.miniTf(course.X[0], course.Z[0]); b.fillStyle = '#ffd400'; b.fillRect(sx - 3, sy - 3, 6, 6);
    const [ex, ey] = hud.miniTf(course.X[course.N - 1], course.Z[course.N - 1]); b.fillStyle = '#ff3355'; b.fillRect(ex - 3, ey - 3, 6, 6);
    hud.miniBase = base;
    g.clearRect(0, 0, 150, 150); g.drawImage(base, 0, 0);
  }

  function updateHUD(dt) {
    const hs = human.sim;
    const t = phase === 'race' ? race.t : phase === 'finish' ? finishedAt : 0;
    hud.timer.textContent = fmtTime(t);
    // position + gap
    if (opts.rival) {
      const rs = cars[1].sim;
      const rtm = rivalTime();
      const ahead = hs.finished ? (rtm == null || hs.finishTime < rtm) : (rs.finished ? false : hs.s >= rs.s);
      const pos = hud.you.querySelector('.pos');
      pos.innerHTML = ahead ? '1<sup>st</sup>' : '2<sup>nd</sup>';
      pos.classList.toggle('lead', ahead);
      const gapM = hs.s - rs.s, gapT = gapM / Math.max(8, (hs.v + rs.v) / 2);
      if (opts.format === 'chase') {
        const tt = -gapT;
        hud.gap.innerHTML = tt <= 0 ? `<span class="good">▲ 先行中 ${(-tt).toFixed(2)}s</span>` : `<span class="${tt <= 1 ? 'warn' : 'bad'}">差 ${tt.toFixed(2)}s / 1.00s</span>`;
      } else {
        hud.gap.innerHTML = gapM >= 0 ? `<span class="good">▲ ${gapM.toFixed(1)}m</span>` : `<span class="bad">▼ ${(-gapM).toFixed(1)}m</span>`;
      }
    } else if (opts.format === 'ta') {
      const pace = phase === 'race' ? (race.t / Math.max(1, hs.s)) * course.L : 0;
      hud.gap.innerHTML = phase === 'race' && hs.s > 100 ? `<span class="${pace <= opts.target ? 'good' : 'bad'}">予想 ${fmtTime(pace)}</span>` : '';
    }
    hud.you.querySelector('.score b').textContent = hs.score.toLocaleString();
    // combo
    if (hs.combo >= 2) { hud.combo.innerHTML = `<b>${hs.combo}</b> COMBO`; hud.combo.className = 'combo show' + (hs.combo >= 10 ? ' hot' : ''); }
    else hud.combo.className = 'combo';
    // speedo
    const kmh = Math.round(hs.v * 3.6);
    hud.speedo.querySelector('.num').textContent = kmh;
    hud.speedo.querySelector('.gear').textContent = hs._gear || 1;
    const arc = hud.speedo.querySelector('.arc'), C = 2 * Math.PI * 42;
    arc.style.strokeDasharray = `${C * 0.75 * clamp(hs.v / (hs.st.top * 1.05), 0, 1)} ${C}`;
    hud.speedo.classList.toggle('boost', hs.nitroT > 0);
    // nitro
    const na = hud.nitro.querySelector('.arc'), NC = 2 * Math.PI * 44;
    na.style.strokeDasharray = `${NC * clamp(hs.nitro / 100, 0, 1)} ${NC}`;
    hud.nitro.classList.toggle('ready', hs.nitro >= 100 && hs.nitroT <= 0);
    hud.nitro.classList.toggle('active', hs.nitroT > 0);
    hud.nitroFx.classList.toggle('on', hs.nitroT > 0);
    // flash
    flashAlpha = Math.max(0, flashAlpha - dt * 2.5);
    hud.flash.style.opacity = flashAlpha;
    // minimap
    const g = hud.mini.getContext('2d');
    g.clearRect(0, 0, 150, 150); g.drawImage(hud.miniBase, 0, 0);
    for (let k = cars.length - 1; k >= 0; k--) {
      const c = cars[k], p = S.sampleAt(course, Math.min(c.sim.s, course.L));
      const [x, y] = hud.miniTf(p.x, p.z);
      g.fillStyle = k === 0 ? '#38e1ff' : '#ff4757'; g.strokeStyle = '#000'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, k === 0 ? 5 : 4.5, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    // timing ring
    updateRing();
    // speed lines
    drawSpeedLines(dt);
  }

  function updateRing() {
    const hs = human.sim;
    const ps = phase === 'race' ? hs.promptState() : null;
    if (!ps || ps.kind === 'hold') {
      hud.ring.classList.remove('show');
      hud.hold.classList.toggle('show', !!ps && ps.kind === 'hold' && hs.pressed);
      if (ps && ps.kind === 'hold') {
        const total = Math.max(0.5, ps.c.sOut - ps.c.sIn);
        hud.hold.querySelector('.fill').style.width = clamp(1 - (ps.s - hs.s) / total, 0, 1) * 100 + '%';
      }
      if (ps && ps.kind === 'hold' && !hs.pressed) hud.hold.classList.remove('show');
      return;
    }
    hud.hold.classList.remove('show');
    // corner banner on first prompt
    if (ps.kind === 'in' && lastPromptCorner !== ps.c.idx) {
      lastPromptCorner = ps.c.idx;
      const arrow = ps.c.dir > 0 ? '◀' : '▶';
      hud.banner.innerHTML = `<span class="ar">${arrow}</span>${ps.c.name}<small>${ps.c.dir > 0 ? '左' : '右'} ${Math.round(ps.c.ang)}° R${ps.c.r}</small>`;
      hud.banner.className = 'banner show' + (ps.c.ang >= 140 ? ' hairpin' : '');
      clearTimeout(hud.banner._t); hud.banner._t = setTimeout(() => hud.banner.className = 'banner', 1800);
    }
    const p = S.sampleAt(course, clamp(ps.s + (ps.kind === 'in' ? 4 : 0), 0, course.L));
    const inside = -ps.c.dir;
    const off = ps.kind === 'in' ? inside * 1.2 : -inside * 0.5;
    tmpV.set(p.x - Math.cos(p.h) * off, p.y + 1.2, p.z + Math.sin(p.h) * off).project(camera);
    const w = root.clientWidth, h = root.clientHeight;
    let x = (tmpV.x * 0.5 + 0.5) * w, y = (-tmpV.y * 0.5 + 0.5) * h;
    if (tmpV.z > 1) { x = w / 2; y = h * 0.45; }
    x = clamp(x, 90, w - 90); y = clamp(y, 120, h - 170);
    hud.ring.style.transform = `translate(${x}px,${y}px)`;
    const prompt = ps.kind === 'in' ? S.PROMPT_IN : S.PROMPT_OUT;
    const sc = 1 + 2.2 * clamp(ps.t / prompt, -0.4, 1);
    const mov = hud.ring.querySelector('.mov');
    mov.setAttribute('r', 30 * sc);
    mov.style.opacity = clamp(1.2 - ps.t / prompt, 0.25, 1);
    const pr = hud.ring.querySelector('.perf');
    // perfect band thickness ~ window
    pr.style.strokeWidth = clamp(ps.win * 6, 4, 10);
    hud.ring.querySelector('.arrow').textContent = ps.c.dir > 0 ? '◀' : '▶';
    hud.ring.querySelector('.lbl').textContent = ps.kind === 'in' ? '押す!' : '離す!';
    hud.ring.className = 'ring show ' + (ps.kind === 'in' ? 'in' : 'out') + (Math.abs(ps.t) < 0.075 * ps.win ? ' hit' : '');
  }

  function drawSpeedLines(dt) {
    const cv = hud.fx, g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    const hs = human.sim;
    const intensity = clamp((hs.v - 28) / 25, 0, 1) * 0.6 + (hs.nitroT > 0 ? 0.8 : 0);
    if (intensity <= 0.02 || phase !== 'race') return;
    const cx = w / 2, cy = h * 0.45, n = Math.floor(20 + intensity * 40);
    g.strokeStyle = hs.nitroT > 0 ? 'rgba(140,220,255,0.5)' : 'rgba(255,255,255,0.35)';
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, r0 = Math.max(w, h) * (0.35 + Math.random() * 0.25), len = 40 + Math.random() * 160 * intensity;
      g.lineWidth = 1 + Math.random() * 2;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); g.stroke();
    }
  }

  // ---------- garage preview (spinning car on a turntable) ----------
  let prev = null;
  R.preview = function (container, card) {
    makeTextures();
    if (!prev) {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6)); r.outputEncoding = THREE.sRGBEncoding;
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(0xbcd0ff, 0x202030, 0.9));
      const d = new THREE.DirectionalLight(0xffffff, 0.9); d.position.set(5, 8, 6); sc.add(d);
      const d2 = new THREE.DirectionalLight(0xff66aa, 0.5); d2.position.set(-6, 3, -5); sc.add(d2);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshPhongMaterial({ color: 0x15182a, shininess: 80 }));
      floor.rotation.x = -Math.PI / 2; sc.add(floor);
      const ringM = new THREE.Mesh(new THREE.RingGeometry(4.1, 4.3, 64), new THREE.MeshBasicMaterial({ color: 0x38e1ff }));
      ringM.rotation.x = -Math.PI / 2; ringM.position.y = 0.01; sc.add(ringM);
      const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100); cam.position.set(7, 3.2, 7); cam.lookAt(0, 0.6, 0);
      prev = { r, sc, cam, car: null, a: 0, raf: 0 };
      const tick = () => {
        prev.raf = requestAnimationFrame(tick);
        if (!prev.r.domElement.isConnected) return;
        prev.a += 0.008;
        if (prev.car) prev.car.rotation.y = prev.a;
        prev.r.render(prev.sc, prev.cam);
      };
      tick();
    }
    container.innerHTML = '';
    container.appendChild(prev.r.domElement);
    const w = container.clientWidth || 300, h = container.clientHeight || 200;
    prev.r.setSize(w, h, false); prev.cam.aspect = w / h; prev.cam.updateProjectionMatrix();
    if (prev.car) prev.sc.remove(prev.car);
    const m = makeCar(card); m.tailGlow.forEach(t => t.visible = false); m.headGlow.forEach(t => t.visible = false);
    prev.car = m.grp; prev.sc.add(m.grp);
  };

  window.Race = R;
})();
