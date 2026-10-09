// ===== 峠 SPIRITS : synthesized audio (no external files) =====
(function () {
  'use strict';
  const A = {};
  let ctx = null, master, sfxBus, bgmBus, noiseBuf;
  A.enabled = true;
  A.bgmOn = true;

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { A.enabled = false; return; }
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = A.sfxVol; sfxBus.connect(master);
    bgmBus = ctx.createGain(); bgmBus.gain.value = A.bgmVol; bgmBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  };
  A.ctx = () => ctx;
  A.sfxVol = 0.9; A.bgmVol = 0.32;
  A.setVolumes = function (sfxOn, bgmOn) {
    A.bgmOn = bgmOn;
    if (!ctx) { A.sfxVol = sfxOn ? 0.9 : 0; A.bgmVol = bgmOn ? 0.32 : 0; return; }
    sfxBus.gain.setTargetAtTime(sfxOn ? 0.9 : 0, ctx.currentTime, 0.05);
    bgmBus.gain.setTargetAtTime(bgmOn ? 0.32 : 0, ctx.currentTime, 0.05);
  };

  function noiseSrc() {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; return n;
  }

  // ---------- one-shot SFX ----------
  A.blip = function (freq = 880, dur = 0.08, type = 'square', vol = 0.15) {
    if (!ctx || !A.enabled) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
  };
  A.chord = function (freqs, dur = 0.5, type = 'sawtooth', vol = 0.08) {
    freqs.forEach((f, i) => setTimeout(() => A.blip(f, dur, type, vol), i * 60));
  };
  A.noiseBurst = function (dur = 0.3, freq = 3000, q = 0.8, vol = 0.3, type = 'bandpass') {
    if (!ctx || !A.enabled) return;
    const t = ctx.currentTime, n = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t); n.stop(t + dur + 0.05);
  };
  A.blowoff = () => A.noiseBurst(0.35, 5200, 1.2, 0.22, 'highpass');
  A.crash = function () {
    A.noiseBurst(0.5, 900, 0.5, 0.5, 'lowpass');
    A.noiseBurst(0.25, 6000, 2, 0.25);
    for (let i = 0; i < 5; i++) setTimeout(() => A.blip(2000 + Math.random() * 3000, 0.05, 'triangle', 0.08), i * 40);
  };
  A.whoosh = function () {
    if (!ctx || !A.enabled) return;
    const t = ctx.currentTime, n = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.Q.value = 1.5;
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(4000, t + 0.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t); n.stop(t + 1.1);
  };
  A.judge = function (rank) {
    if (rank === 'PERFECT') A.chord([1046, 1318, 1568, 2093], 0.35, 'square', 0.07);
    else if (rank === 'GREAT') A.chord([880, 1108, 1318], 0.25, 'square', 0.06);
    else if (rank === 'GOOD') A.blip(784, 0.15, 'square', 0.07);
    else A.blip(140, 0.3, 'sawtooth', 0.12);
  };
  A.countdown = (go) => go ? A.chord([880, 1760], 0.6, 'square', 0.12) : A.blip(440, 0.25, 'square', 0.14);
  A.fanfare = function (win) {
    const seq = win ? [523, 659, 784, 1046, 784, 1046, 1318] : [392, 349, 311, 262];
    seq.forEach((f, i) => setTimeout(() => A.blip(f, 0.22, 'square', 0.1), i * (win ? 110 : 220)));
  };

  // ---------- continuous engine / tyre / wind ----------
  let eng = null;
  A.startEngine = function () {
    if (!ctx || !A.enabled || eng) return;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'square'; o3.type = 'sawtooth';
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 4;
    const eg = ctx.createGain(); eg.gain.value = 0;
    o1.connect(lp); o2.connect(lp); o3.connect(lp); lp.connect(eg); eg.connect(sfxBus);
    const g2 = ctx.createGain(); g2.gain.value = 0.35; o2.disconnect(); o2.connect(g2); g2.connect(lp);
    // tyre squeal
    const tn = noiseSrc(), tf = ctx.createBiquadFilter(), tg = ctx.createGain();
    tf.type = 'bandpass'; tf.frequency.value = 1700; tf.Q.value = 9; tg.gain.value = 0;
    tn.connect(tf); tf.connect(tg); tg.connect(sfxBus);
    const sq = ctx.createOscillator(), sqg = ctx.createGain(); sq.type = 'triangle'; sq.frequency.value = 1450; sqg.gain.value = 0;
    sq.connect(sqg); sqg.connect(sfxBus);
    // wind
    const wn = noiseSrc(), wf = ctx.createBiquadFilter(), wg = ctx.createGain();
    wf.type = 'lowpass'; wf.frequency.value = 500; wg.gain.value = 0;
    wn.connect(wf); wf.connect(wg); wg.connect(sfxBus);
    [o1, o2, o3, tn, sq, wn].forEach(x => x.start());
    eng = { o1, o2, o3, lp, eg, tg, tf, sqg, sq, wg, wf, nodes: [o1, o2, o3, tn, sq, wn] };
  };
  // rpm 800..9000, load 0..1, slip 0..1, speed m/s
  A.updateEngine = function (rpm, load, slip, speed, nitro) {
    if (!eng) return;
    const t = ctx.currentTime, f = rpm / 60 * 2; // 4cyl firing freq
    eng.o1.frequency.setTargetAtTime(f / 2, t, 0.03);
    eng.o2.frequency.setTargetAtTime(f, t, 0.03);
    eng.o3.frequency.setTargetAtTime(f * 1.01 / 2, t, 0.03);
    eng.lp.frequency.setTargetAtTime(500 + load * 1800 + rpm / 6 + (nitro ? 900 : 0), t, 0.05);
    eng.eg.gain.setTargetAtTime(0.09 + load * 0.1, t, 0.05);
    const s = Math.min(1, slip);
    eng.tg.gain.setTargetAtTime(s * 0.22, t, 0.06);
    eng.sqg.gain.setTargetAtTime(s * 0.035, t, 0.06);
    eng.sq.frequency.setTargetAtTime(1300 + Math.sin(t * 13) * 120 + s * 200, t, 0.05);
    eng.wg.gain.setTargetAtTime(Math.min(0.25, speed / 300), t, 0.2);
    eng.wf.frequency.setTargetAtTime(300 + speed * 15, t, 0.2);
  };
  A.stopEngine = function () {
    if (!eng) return;
    const e = eng; eng = null;
    e.eg.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    e.tg.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    e.sqg.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    e.wg.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    setTimeout(() => e.nodes.forEach(n => { try { n.stop(); } catch (_) {} }), 600);
  };

  // ---------- Eurobeat-ish procedural BGM ----------
  let bgm = null;
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  // patterns: progression in A minor  (Am - F - G - Em) / (Dm - G - C - E)
  const PROGS = {
    race: { bpm: 156, roots: [57, 53, 55, 52], lead: [0, 3, 7, 10, 12, 10, 7, 3] },
    menu: { bpm: 112, roots: [57, 53, 48, 55], lead: [0, 7, 12, 7, 3, 7, 12, 15] },
    boss: { bpm: 164, roots: [50, 55, 48, 52], lead: [0, 3, 7, 12, 15, 12, 7, 3] },
  };
  A.playBGM = function (kind = 'race') {
    if (!ctx || !A.enabled) return;
    if (bgm && bgm.kind === kind) return;
    A.stopBGM();
    const P = PROGS[kind] || PROGS.race;
    const step = 60 / P.bpm / 4; // 16th
    let next = ctx.currentTime + 0.1, i = 0;
    const st = { kind, timer: null };
    function sched() {
      while (next < ctx.currentTime + 0.25) {
        if (A.bgmOn) playStep(i, next, P, step, kind);
        next += step; i++;
      }
    }
    st.timer = setInterval(sched, 50);
    bgm = st;
  };
  A.stopBGM = function () { if (bgm) { clearInterval(bgm.timer); bgm = null; } };

  function tone(freq, t, dur, type, vol, cutoff) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (cutoff) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
      o.connect(f); f.connect(g);
    } else o.connect(g);
    g.connect(bgmBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); g.connect(bgmBus); o.start(t); o.stop(t + 0.22);
  }
  function hat(t, open) {
    const n = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 7000;
    const d = open ? 0.12 : 0.04;
    g.gain.setValueAtTime(open ? 0.18 : 0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    n.connect(f); f.connect(g); g.connect(bgmBus); n.start(t); n.stop(t + d + 0.02);
  }
  function snare(t) {
    const n = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    n.connect(f); f.connect(g); g.connect(bgmBus); n.start(t); n.stop(t + 0.17);
  }
  function playStep(i, t, P, step, kind) {
    const s16 = i % 16, bar = Math.floor(i / 16), root = P.roots[bar % 4];
    const menu = kind === 'menu';
    if (s16 % 4 === 0) kick(t);
    if (!menu && s16 % 8 === 4) snare(t);
    if (s16 % 4 === 2) hat(t, true); else if (!menu) hat(t, false);
    // octave bass on offbeats (eurobeat)
    if (s16 % 2 === 1 || (menu && s16 % 4 === 0)) tone(NOTE(root - 12 + (s16 % 4 === 3 ? 12 : 0)), t, step * 1.6, 'sawtooth', 0.16, 700);
    // lead arpeggio
    if (s16 % 2 === 0) {
      const n = root + 12 + P.lead[(s16 / 2 + bar) % P.lead.length];
      tone(NOTE(n), t, step * 1.8, 'square', menu ? 0.035 : 0.05, 3200);
      if (!menu && bar % 4 >= 2) tone(NOTE(n + 12), t, step * 1.2, 'sawtooth', 0.025, 5000);
    }
    // pad
    if (s16 === 0) {
      [0, 3, 7].forEach(iv => tone(NOTE(root + iv + (iv === 3 && bar % 4 === 2 ? 1 : 0)), t, step * 15, 'triangle', 0.03, 2000));
    }
  }

  window.Sound = A;
})();
