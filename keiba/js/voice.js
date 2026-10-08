// 実況の読み上げ（ブラウザの音声合成 Web Speech API）
// 日本語の声がある端末だけで動く。3D表示・等倍再生のときに、チェックポイント・自分の馬の出来事・ゴールを読み上げる。
'use strict';

const Voice = {
  voice: null,
  lastAt: 0,

  supported() { return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'; },
  enabled() { return this.supported() && Player.data.settings.voice !== false && Player.data.settings.sound3d !== false; },

  pick() {
    if (!this.supported()) return null;
    const vs = speechSynthesis.getVoices() || [];
    this.voice = vs.find(v => /^ja/i.test(v.lang) && /Kyoko|Haruka|Nanami|Google/i.test(v.name)) || vs.find(v => /^ja/i.test(v.lang)) || null;
    return this.voice;
  },

  // 読み上げ用に絵文字や記号を取る
  clean(text) {
    return String(text).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/[「」『』]/g, '').replace(/！/g, '！ ').trim();
  },

  // opts.interrupt：今の読み上げを止めて読む（大事な実況）。それ以外は話し中なら読まない
  say(text, opts = {}) {
    if (!this.enabled() || (typeof RaceView !== 'undefined' && !RaceView.voiceOk())) return;
    if (!this.voice && !this.pick()) return;
    const busy = speechSynthesis.speaking || speechSynthesis.pending;
    if (busy && !opts.interrupt) return;
    if (busy) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(this.clean(text));
    u.lang = 'ja-JP';
    u.voice = this.voice;
    u.rate = opts.rate || 1.25;
    u.pitch = 1.05;
    u.volume = 1;
    speechSynthesis.speak(u);
    this.lastAt = performance.now();
  },

  stop() { if (this.supported()) speechSynthesis.cancel(); },

  toggle() {
    Player.data.settings.voice = Player.data.settings.voice === false;
    Player.save();
    if (!Player.data.settings.voice) this.stop();
    return Player.data.settings.voice;
  }
};
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => Voice.pick();
}
