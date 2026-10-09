// ===== 峠 SPIRITS : race simulation (pure logic, no rendering) =====
(function (root) {
  'use strict';
  const G = 9.81, DS = 2;
  const CORNER_K = 1.25;          // game-feel multiplier on physical corner speed
  const PROMPT_IN = 1.35;         // seconds before ideal that entry ring appears
  const PROMPT_OUT = 1.0;
  const WIN = { PERFECT: 0.075, GREAT: 0.16, GOOD: 0.28 };
  const ENTRY_F = { PERFECT: 1.13, GREAT: 1.07, GOOD: 1.01, MISS: 0.78 };
  const EXIT_V = { PERFECT: 1.08, GREAT: 1.04, GOOD: 1.0, MISS: 0.9 };
  const EXIT_BOOST = { PERFECT: 0.45, GREAT: 0.22, GOOD: 0.06, MISS: 0 };
  const NITRO_GAIN = { entry: { PERFECT: 22, GREAT: 14, GOOD: 8, MISS: 0 }, exit: { PERFECT: 18, GREAT: 10, GOOD: 5, MISS: 0 } };
  const SCORE = { PERFECT: 500, GREAT: 300, GOOD: 150, MISS: 0 };
  const TYRE = { per: 1.0, std: 0.9, all: 0.88, off: 0.8, slick: 1.08 };
  const TYRE_WET = { per: 0.84, std: 0.8, all: 0.83, off: 0.78, slick: 0.62 };

  // simple seeded RNG
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- course ----------
  function buildCourse(def) {
    let x = 0, z = 0, h = 0;
    const X = [0], Z = [0], H = [0], K = [0];
    const turns = [];
    for (const sg of def.segs) {
      if (sg[0] === 'S') {
        const n = Math.round(sg[1] / DS);
        for (let j = 0; j < n; j++) { x += Math.sin(h) * DS; z += Math.cos(h) * DS; X.push(x); Z.push(z); H.push(h); K.push(0); }
      } else {
        const dir = sg[0] === 'L' ? 1 : -1, ang = sg[1] * Math.PI / 180, r = sg[2];
        const len = ang * r, n = Math.max(1, Math.round(len / DS)), dh = dir * ang / n, st = len / n;
        const sIn = (X.length - 1) * DS;
        for (let j = 0; j < n; j++) {
          h += dh / 2; x += Math.sin(h) * st; z += Math.cos(h) * st; h += dh / 2;
          X.push(x); Z.push(z); H.push(h); K.push(dir / r);
        }
        turns.push({ sIn, sOut: (X.length - 1) * DS, dir, r, ang: sg[1], label: sg[3] || null });
      }
    }
    const L = (X.length - 1) * DS; // finish line
    // run-off straight past the GOAL so cars can coast through
    for (let j = 0; j < 70; j++) { x += Math.sin(h) * DS; z += Math.cos(h) * DS; X.push(x); Z.push(z); H.push(h); K.push(0); }
    const N = X.length;
    // elevation: overall downhill + undulation
    const Y = new Float32Array(N);
    const drop = def.drop || 150;
    for (let i = 0; i < N; i++) {
      const s = i * DS;
      Y[i] = drop * (1 - Math.min(s, L) / L) - Math.max(0, s - L) * 0.03 + 5 * Math.sin(s / 85) + 2.2 * Math.sin(s / 27 + 1.3);
    }
    // radius per sample (smoothed: min radius over +-3 samples)
    const R = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let km = 0;
      for (let j = Math.max(0, i - 2); j <= Math.min(N - 1, i + 2); j++) km = Math.max(km, Math.abs(K[j]));
      R[i] = km > 0 ? 1 / km : 1e9;
    }
    // drift corners (prompted)
    const corners = [];
    let hp = 0, cn = 0;
    turns.forEach((t, idx) => {
      if (!(t.ang >= 45 && t.r <= 90)) return;
      cn++;
      const prev = corners[corners.length - 1];
      let type = t.ang >= 140 ? 'ヘアピン' : (t.r <= 40 ? 'タイトコーナー' : '中速コーナー');
      if (prev && prev.dir !== t.dir && t.sIn - prev.sOut < 30) type = 'S字 切り返し';
      if (t.ang >= 140) hp++;
      corners.push({ ...t, idx: corners.length, type, name: t.label || (t.ang >= 140 ? `第${hp}ヘアピン` : `C${cn} ${type}`) });
    });
    return { def, X, Y, Z, H, K, R, N, L, corners, turns };
  }

  function sampleAt(c, s) {
    const fi = Math.max(0, Math.min(c.N - 1.001, s / DS)), i = Math.floor(fi), f = fi - i;
    const lerp = (A) => A[i] + (A[i + 1] - A[i]) * f;
    let h0 = c.H[i], h1 = c.H[i + 1];
    return { x: lerp(c.X), y: lerp(c.Y), z: lerp(c.Z), h: h0 + (h1 - h0) * f, k: c.K[i], i };
  }

  // ---------- car stats from card + tune ----------
  function carStats(card, tune, wet) {
    tune = tune || [0, 0, 0];
    const [e, w, ch] = tune;
    const top = card.top * 0.44704 * (1 + 0.025 * e);
    const acc = card.acc * (1 - 0.035 * e - 0.02 * w);
    const grip = card.grip + 2 * ch + 0.5 * w;
    const weight = card.weight * (1 - 0.03 * w);
    const mu = grip / 100 * (wet ? TYRE_WET[card.tyre] || 0.8 : TYRE[card.tyre] || 0.9);
    const a0 = 26.82 / acc * 1.35;
    const dec = mu * G * 1.05 * (card.abs ? 1.06 : 1) * Math.max(0.85, 1.12 - weight / 9000);
    const win = { rwd: 1.0, '4wd': 1.25, fwd: 1.12 }[card.drive] || 1;
    const driftAng = { rwd: 34, '4wd': 22, fwd: 10 }[card.drive] || 25;
    const scoreMul = { rwd: 1.2, '4wd': 1.0, fwd: 0.8 }[card.drive] || 1;
    return { top, acc, grip, weight, mu, a0, dec, win, driftAng, scoreMul, drive: card.drive };
  }

  function rollRank(r, skill) {
    const pP = 0.1 + 0.6 * skill, pG = 0.35 * (1 - skill * 0.3), pM = 0.12 * (1 - skill);
    const x = r();
    if (x < pP) return 'PERFECT';
    if (x < pP + pG) return 'GREAT';
    if (x < pP + pG + pM) return 'MISS';
    return 'GOOD';
  }
  function rankOf(err, w) {
    const a = Math.abs(err);
    if (a <= WIN.PERFECT * w) return 'PERFECT';
    if (a <= WIN.GREAT * w) return 'GREAT';
    if (a <= WIN.GOOD * w) return 'GOOD';
    return 'MISS';
  }

  // ---------- one car ----------
  class CarSim {
    constructor(race, opt) {
      this.race = race; this.c = race.course;
      this.id = opt.id; this.name = opt.name; this.card = opt.card;
      this.kind = opt.kind || 'ai'; // 'human' | 'ai' | 'remote'
      this.skill = opt.skill == null ? 0.5 : opt.skill;
      this.st = carStats(opt.card, opt.tune, race.wet);
      this.assist = opt.assist ? 1.4 : 1;
      this.s = opt.s0 || 0; this.v = 0; this.d = opt.d0 || 0; this.dT = this.d;
      this.finished = false; this.finishTime = null;
      this.nitro = 0; this.nitroT = 0; this.boostT = 0;
      this.ci = 0; this.phase = 'app'; this.factor = 1; this.factorEnd = -1;
      this.drifting = false; this.driftAmt = 0; this.entryRank = null;
      this.score = 0; this.combo = 0; this.maxCombo = 0;
      this.counts = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
      this.blockedT = 0; this.slipT = 0; this.hitT = 0;
      this.rnd = rng(opt.seed || 1);
      this.pressed = false;
      this.buildProfile();
    }
    buildProfile() {
      const c = this.c, N = c.N, st = this.st;
      const vmax = st.top * 1.05;
      const lim = new Float32Array(N), prof = new Float32Array(N);
      for (let i = 0; i < N; i++) lim[i] = Math.min(vmax, Math.sqrt(st.mu * G * c.R[i]) * CORNER_K);
      prof[N - 1] = lim[N - 1];
      for (let i = N - 2; i >= 0; i--) prof[i] = Math.min(lim[i], Math.sqrt(prof[i + 1] * prof[i + 1] + 2 * st.dec * DS));
      this.lim = lim; this.prof = prof;
    }
    corner() { return this.c.corners[this.ci]; }
    // ideal distances for entry / exit given current speed
    entryIdeal(c) {
      const v = Math.max(8, this.v);
      let s = c.sIn - v * 0.2;
      const p = this.c.corners[c.idx - 1];
      if (p && c.sIn - p.sOut < 30) s = Math.max(s, this.exitIdeal(p) + v * 0.4);
      return s;
    }
    exitIdeal(c) {
      const v = Math.max(8, this.v);
      const n = this.c.corners[c.idx + 1];
      return c.sOut - v * (n && n.sIn - c.sOut < 30 ? 0.3 : 0.12);
    }
    timeTo(sTarget) { return (sTarget - this.s) / Math.max(5, this.v); }
    promptState() {
      const c = this.corner();
      if (!c || this.finished) return null;
      if (this.phase === 'app') {
        const t = this.timeTo(this.entryIdeal(c));
        if (t <= PROMPT_IN) return { kind: 'in', t, c, s: this.entryIdeal(c), win: this.st.win * this.assist };
      } else if (this.phase === 'in' && this.entryRank !== 'MISS') {
        const t = this.timeTo(this.exitIdeal(c));
        if (t <= PROMPT_OUT) return { kind: 'out', t, c, s: this.exitIdeal(c), win: this.st.win * this.assist };
        return { kind: 'hold', t, c, s: this.exitIdeal(c) };
      }
      return null;
    }
    // ---- human input ----
    press() {
      this.pressed = true;
      const c = this.corner();
      if (!c || this.phase !== 'app' || this.finished) return;
      const t = this.timeTo(this.entryIdeal(c));
      if (t > PROMPT_IN + 0.15) return; // not yet prompted → ignore
      this.judgeEntry(rankOf(t, this.st.win * this.assist), -t);
    }
    release() {
      this.pressed = false;
      const c = this.corner();
      if (!c || this.phase !== 'in' || this.finished) return;
      if (this.entryRank === 'MISS') return;
      const t = this.timeTo(this.exitIdeal(c));
      if (t > PROMPT_OUT + 0.1) { this.judgeExit('MISS', -t, 'early'); return; }
      this.judgeExit(rankOf(t, this.st.win * this.assist), -t);
    }
    useNitro() {
      if (this.nitro >= 100 && this.nitroT <= 0 && !this.finished) {
        this.nitroT = 3.2; this.nitro = 0;
        this.race.emit({ type: 'nitro', car: this });
        return true;
      }
      return false;
    }
    // ---- judgement ----
    judgeEntry(rank, err) {
      const c = this.corner();
      this.entryRank = rank; this.phase = 'in';
      this.factor = ENTRY_F[rank]; this.factorEnd = c.sOut + 6;
      this.drifting = rank !== 'MISS';
      this.counts[rank]++;
      this.nitro = Math.min(100, this.nitro + NITRO_GAIN.entry[rank]);
      if (rank === 'MISS') { this.combo = 0; this.hitT = 0.6; this.phase = 'missed'; }
      else { this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); }
      this.race.emit({ type: 'judge', car: this, phase: 'entry', rank, err, corner: c });
    }
    judgeExit(rank, err, why) {
      const c = this.corner();
      this.counts[rank]++;
      this.drifting = false;
      if (rank === 'MISS') {
        this.combo = 0;
        if (why === 'early') { this.factor = Math.min(this.factor, 0.97); }
        else { this.v *= EXIT_V.MISS; this.hitT = 0.4; }
      } else {
        this.v *= EXIT_V[rank]; this.boostT = 1.3; this.boostAmt = EXIT_BOOST[rank];
        this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
      }
      this.nitro = Math.min(100, this.nitro + NITRO_GAIN.exit[rank]);
      const pts = Math.round((SCORE[this.entryRank] + SCORE[rank]) * Math.max(0.6, this.v * 3.6 / 70) * this.st.scoreMul * (1 + 0.1 * Math.min(this.combo, 20)));
      this.score += pts;
      this.race.emit({ type: 'judge', car: this, phase: 'exit', rank, err, why, corner: c, pts });
      this.phase = 'done';
    }
    // ---- per-step ----
    step(dt) {
      if (this.kind === 'remote') return;
      if (this.finished) { // coast through the run-off
        this.v = Math.max(0, this.v - 7 * dt); this.drifting = false;
        this.driftAmt *= Math.max(0, 1 - dt * 4); this.nitroT = 0;
        this.s = Math.min(this.s + this.v * dt, (this.c.N - 2) * DS);
        return;
      }
      const c = this.corner(), race = this.race;
      // corner state machine
      if (c) {
        if (this.phase === 'app') {
          const ideal = this.entryIdeal(c);
          if (this.kind === 'ai') {
            if (this.s >= ideal) this.judgeEntry(rollRank(this.rnd, this.skill), 0);
          } else if (race.autoPlay && this.s >= ideal) {
            this.judgeEntry(race.autoPlay, 0);
          } else if (this.s > ideal + WIN.GOOD * this.st.win * this.assist * this.v) {
            this.judgeEntry('MISS', 1);
          }
        } else if (this.phase === 'in') {
          const ideal = this.exitIdeal(c);
          if (this.kind === 'ai') {
            if (this.s >= ideal) { const r = rollRank(this.rnd, this.skill); this.judgeExit(r, 0); }
          } else if (race.autoPlay && this.s >= ideal) {
            this.judgeExit(race.autoPlay, 0);
          } else if (this.s > ideal + WIN.GOOD * this.st.win * this.assist * Math.max(8, this.v)) {
            this.judgeExit('MISS', 1, 'late');
          }
        } else if (this.phase === 'missed') {
          if (this.s >= c.sOut) { this.phase = 'done'; this.drifting = false; }
        }
        if (this.phase === 'done') { this.ci++; this.phase = 'app'; this.entryRank = null; }
      }
      // AI nitro: when gauge full and long run to next corner
      if (this.kind === 'ai' && this.nitro >= 100) {
        const n = this.corner();
        if (!n || n.sIn - this.s > 110) this.useNitro();
      }
      // speed
      const st = this.st, i = Math.min(this.c.N - 1, Math.floor(this.s / DS));
      let cap = this.prof[i];
      if (this.s <= this.factorEnd) cap *= this.factor;
      const nit = this.nitroT > 0;
      let vtop = st.top * (nit ? 1.12 : 1.0);
      cap = Math.min(cap, vtop * 1.04);
      if (this.blockedCap != null) { cap = Math.min(cap, this.blockedCap); }
      let a = st.a0 * Math.max(0.04, 1 - Math.pow(this.v / vtop, 2.2));
      if (nit) a *= 1.75;
      if (this.boostT > 0) a *= 1 + this.boostAmt;
      if (this.slipT > 0) a *= 1.08;
      // downhill assist
      const i2 = Math.min(this.c.N - 1, i + 1);
      const slope = (this.c.Y[i2] - this.c.Y[i]) / DS;
      a += -G * slope * 0.6;
      if (this.v < cap) this.v = Math.min(cap, this.v + Math.max(0.3, a) * dt);
      else {
        const hard = this.hitT > 0 ? 30 : st.dec * 1.6;
        this.v = Math.max(cap, this.v - hard * dt);
      }
      this.v = Math.max(0, this.v);
      const prevS = this.s;
      this.s += this.v * dt;
      // drift visual amount
      const want = this.drifting ? 1 : 0;
      this.driftAmt += (want - this.driftAmt) * Math.min(1, dt * (want ? 6 : 4));
      // timers
      this.nitroT = Math.max(0, this.nitroT - dt);
      this.boostT = Math.max(0, this.boostT - dt);
      this.slipT = Math.max(0, this.slipT - dt);
      this.hitT = Math.max(0, this.hitT - dt);
      this.blockedT = Math.max(0, this.blockedT - dt);
      // lateral
      this.d += (this.dT - this.d) * Math.min(1, dt * 2.2);
      if (this.s >= this.c.L) {
        const f = (this.c.L - prevS) / Math.max(1e-6, this.s - prevS);
        this.finishTime = race.t - dt + dt * f;
        this.finished = true;
        race.emit({ type: 'finish', car: this });
      }
    }
    racingLine() {
      // inside at apex, outside on entry/exit
      const cs = this.c.corners;
      for (let k = Math.max(0, this.ci - 1); k < Math.min(cs.length, this.ci + 2); k++) {
        const c = cs[k];
        const a = c.sIn - 25, b = c.sOut + 25;
        if (this.s >= a && this.s <= b) {
          const t = (this.s - a) / (b - a);
          const inside = -c.dir; // right turn (dir -1) → inside is +d
          return inside * 2.3 * (Math.sin(Math.PI * t) * 2 - 1);
        }
      }
      return 0;
    }
  }

  // ---------- race ----------
  class RaceSim {
    constructor(course, opts) {
      this.course = course; this.opts = opts;
      this.wet = !!opts.wet;
      this.t = 0; this.events = []; this.cars = [];
      this.format = opts.format || 'battle';
      this.autoPlay = opts.autoPlay || null;
    }
    add(opt) { const c = new CarSim(this, opt); this.cars.push(c); return c; }
    emit(e) { this.events.push(e); }
    step(dt) {
      this.t += dt;
      const cars = this.cars;
      // lane logic + blocking/overtaking among local sims
      for (const a of cars) { a.blockedCap = null; a.dT = a.racingLine(); }
      for (const a of cars) {
        if (a.finished) continue;
        for (const b of cars) {
          if (a === b || b.finished) continue;
          const gap = b.s - a.s;
          if (gap > 0 && gap < 22 && a.kind !== 'remote' && b.kind !== 'remote') {
            const k = Math.abs(this.course.K[Math.min(this.course.N - 1, Math.floor(a.s / DS))]);
            const straight = k < 1 / 150;
            // slipstream
            if (straight && gap < 18) { if (a.slipT <= 0) this.emit({ type: 'slip', car: a }); a.slipT = 0.3; a.nitro = Math.min(100, a.nitro + 4 * (1 / 60)); }
            if (gap < 6.5 && a.v > b.v) {
              const nc = a.corner();
              const room = !nc || nc.sIn - a.s > 35 || a.phase !== 'app';
              if (straight && room) {
                // pass on the other side
                const side = b.d > 0 ? -1 : 1;
                a.dT = side * 2.0; b.dT = -side * 2.0;
                if (!a._passing) { a._passing = true; }
              } else {
                a.blockedCap = Math.min(a.blockedCap == null ? 1e9 : a.blockedCap, b.v * 0.99);
                if (a.blockedT <= 0) this.emit({ type: 'blocked', car: a, by: b });
                a.blockedT = 1.5;
              }
            }
          }
          // side by side separation
          if (Math.abs(gap) < 5.5 && a.kind !== 'remote') {
            const side = a.d >= b.d ? 1 : -1;
            a.dT = side * 2.0;
          }
        }
      }
      // position change events
      const order = cars.slice().sort((x, y) => (y.finished ? 1e6 - (y.finishTime || 0) : y.s) - (x.finished ? 1e6 - (x.finishTime || 0) : x.s));
      if (this._order && order[0] !== this._order[0] && this.t > 1) this.emit({ type: 'lead', car: order[0], prev: this._order[0] });
      this._order = order;
      for (const c of cars) c.step(dt);
    }
    // run until all local cars finish (used after the human finishes)
    finishOthers(maxT = 200) {
      const dt = 1 / 60; let n = 0;
      while (this.cars.some(c => !c.finished && c.kind === 'ai') && n < maxT * 60) { this.step(dt); n++; }
      this.events.length = 0;
    }
  }

  root.TougeSim = { buildCourse, sampleAt, carStats, CarSim, RaceSim, rng, DS, WIN, PROMPT_IN, PROMPT_OUT };
})(typeof window !== 'undefined' ? window : module.exports);
