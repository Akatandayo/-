// ファンファーレ
// JRAの実際のファンファーレは作曲家の著作物なので同梱しない。
// 代わりに区分（関東・関西 × GⅠ・重賞・一般、ローカル）ごとに、ユーザーが自分で用意した音源を登録できる。
// 登録がない区分は、このゲームのオリジナル曲（下の MELODIES）を合成して鳴らす。
'use strict';

const Fanfare = {
  SLOTS: [
    { id: 'g1_east', label: 'GⅠ（関東）', desc: '東京・中山のGⅠ' },
    { id: 'g1_west', label: 'GⅠ（関西）', desc: '京都・阪神・中京のGⅠ' },
    { id: 'graded_east', label: '重賞（関東）', desc: '東京・中山のGⅡ・GⅢ' },
    { id: 'graded_west', label: '重賞（関西）', desc: '京都・阪神・中京のGⅡ・GⅢ' },
    { id: 'normal_east', label: '一般戦（関東）', desc: '東京・中山の条件戦・オープン、リーグ戦' },
    { id: 'normal_west', label: '一般戦（関西）', desc: '京都・阪神・中京の条件戦・オープン' },
    { id: 'local', label: 'ローカル開催', desc: '福島・新潟・小倉・札幌・函館' }
  ],
  EAST: ['東京', '中山'],
  WEST: ['京都', '阪神', '中京'],
  LOCAL: ['福島', '新潟', '小倉', '札幌', '函館'],

  // オリジナル曲（[MIDIノート番号, 拍]、0は休符）
  MELODIES: {
    g1_east: { bpm: 108, roll: true, notes: [[67, 0.5], [67, 0.25], [72, 0.25], [76, 0.5], [74, 0.25], [72, 0.25], [74, 0.5], [67, 0.5], [69, 0.25], [71, 0.25], [72, 0.25], [74, 0.25], [76, 1], [74, 0.5], [76, 0.5], [79, 1.5], [84, 2]] },
    g1_west: { bpm: 112, roll: true, notes: [[74, 0.375], [74, 0.125], [78, 0.5], [81, 0.5], [78, 0.25], [81, 0.25], [86, 1], [85, 0.5], [83, 0.5], [81, 0.5], [78, 0.5], [79, 0.5], [76, 0.5], [74, 2]] },
    graded_east: { bpm: 120, notes: [[76, 0.25], [76, 0.25], [79, 0.5], [72, 0.5], [74, 0.25], [76, 0.25], [77, 0.5], [74, 0.5], [79, 1.5]] },
    graded_west: { bpm: 120, notes: [[69, 0.5], [74, 0.5], [78, 0.25], [76, 0.25], [74, 0.5], [81, 1], [79, 0.5], [78, 0.5], [74, 1.5]] },
    normal_east: { bpm: 132, notes: [[72, 0.25], [76, 0.25], [79, 0.5], [84, 0.75]] },
    normal_west: { bpm: 132, notes: [[67, 0.25], [71, 0.25], [74, 0.25], [79, 0.75]] },
    local: { bpm: 140, notes: [[77, 0.25], [81, 0.25], [84, 0.25], [81, 0.25], [77, 0.5], [79, 0.25], [81, 0.25], [77, 1]] }
  },

  audio: null,

  slotFor(race) {
    const v = race.venue || '';
    const region = this.EAST.includes(v) ? 'east' : this.WEST.includes(v) ? 'west' : this.LOCAL.includes(v) ? 'local' : 'east';
    if (region === 'local') return 'local';
    if (race.grade === 'g1') return 'g1_' + region;
    if (race.grade === 'g2' || race.grade === 'g3') return 'graded_' + region;
    return 'normal_' + region;
  },

  key(slot) { return 'fanfare:' + slot; },
  custom(slot) { return typeof Media !== 'undefined' ? Media.url(this.key(slot)) : null; },

  synthLength(slot) {
    const m = this.MELODIES[slot];
    return m.notes.reduce((s, [, b]) => s + b, 0) * 60 / m.bpm + (m.roll ? 0.8 : 0);
  },

  // 再生にかかる秒数（3Dのゲートイン演出の長さに使う）
  length(slot) {
    if (this.custom(slot)) {
      const d = (Media.meta[this.key(slot)] || {}).duration || 0;
      return Util.clamp(d > 0 ? d : 8, 1, 45);
    }
    return this.synthLength(slot);
  },

  stop() {
    if (this.audio) { try { this.audio.pause(); } catch (e) { /* noop */ } this.audio = null; }
    if (this._nodes) { this._nodes.forEach(n => { try { n.stop(); } catch (e) { /* noop */ } }); this._nodes = null; }
  },

  play(slot) {
    this.stop();
    const url = this.custom(slot);
    if (url) {
      this.audio = new Audio(url);
      this.audio.volume = 0.9;
      this.audio.play().catch(() => {});
      return;
    }
    this.playSynth(slot);
  },

  // オリジナル曲を金管風の音で合成（重賞以上は最後にティンパニのロール）
  playSynth(slot) {
    const snd = Race3D.sound;
    if (!snd.init()) return;
    const ac = snd.ac;
    const m = this.MELODIES[slot];
    const beat = 60 / m.bpm;
    let t = ac.currentTime + 0.08;
    this._nodes = [];
    m.notes.forEach(([n, b]) => {
      const d = b * beat;
      if (n) {
        const f = 440 * Math.pow(2, (n - 69) / 12);
        [[1, 0.07], [2.004, 0.025], [0.5, 0.02]].forEach(([mul, vol]) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          const lp = ac.createBiquadFilter();
          o.type = 'sawtooth';
          o.frequency.value = f * mul;
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(900, t);
          lp.frequency.linearRampToValueAtTime(2600, t + 0.05);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
          g.gain.setValueAtTime(vol, t + d * 0.82);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.98);
          o.connect(lp).connect(g).connect(snd.master);
          o.start(t); o.stop(t + d);
          this._nodes.push(o);
        });
      }
      t += d;
    });
    if (m.roll) {
      // ティンパニ風のロール
      for (let i = 0; i < 14; i++) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sine';
        o.frequency.value = 65;
        const tt = t - 0.6 + i * 0.05;
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.exponentialRampToValueAtTime(0.06 + i * 0.006, tt + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.25);
        o.connect(g).connect(snd.master);
        o.start(tt); o.stop(tt + 0.3);
        this._nodes.push(o);
      }
    }
  },

  // 設定画面：ファイルを登録
  async register(slot, file) {
    if (!file) return { ok: false, reason: 'ファイルが選ばれていません' };
    if (!/^audio\//.test(file.type) && !/\.(mp3|m4a|aac|wav|ogg|oga|flac|webm)$/i.test(file.name)) return { ok: false, reason: '音声ファイルを選んでください' };
    if (file.size > 20 * 1024 * 1024) return { ok: false, reason: 'ファイルが大きすぎます（20MBまで）' };
    const duration = await Media.audioDuration(file);
    if (duration < 0) return { ok: false, reason: 'このブラウザでは再生できない形式です' };
    const saved = await Media.put(this.key(slot), file, { name: file.name, duration });
    return { ok: true, saved, duration };
  },

  remove(slot) { return Media.del(this.key(slot)); }
};
