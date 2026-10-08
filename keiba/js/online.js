// オンライン・カスタムレース（PeerJS による P2P 接続）
// ホストがルームを作り、参加者は6文字のルームコードで入る。
// レースの計算はホストだけが行い、結果（着順・位置・実況）を全員に送る。全員が同じレースを3Dで観戦できる。
// サーバーは接続の仲介（PeerJSの公開シグナリングサーバー）だけに使い、ゲームのデータは保存しない。
'use strict';

const Online = {
  VERSION: 1,
  PREFIX: 'umacard-v1-',
  CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  TIMEOUT: 15000,
  server: null,          // 自前の PeerServer を使うとき { host, port, path, secure }
  peer: null,
  role: null,            // 'host' | 'guest'
  status: 'idle',        // idle | connecting | lobby | error
  error: '',
  code: '',
  spec: null,
  members: [],           // { id, owner, horse:{name,style,rarity,overall}, ready, ghost(ホストのみ) }
  conns: {},             // ホスト：参加者ID → 接続
  conn: null,            // 参加者：ホストへの接続
  myId: null,
  myHorseId: null,
  raceNo: 0,
  seq: 0,

  available() { return typeof Peer !== 'undefined'; },
  active() { return this.status === 'lobby' || this.status === 'connecting'; },

  // 接続先：テスト用の server ＞ 設定の自前サーバー（例 example.com:9000/myapp）＞ PeerJSの公開サーバー
  peerOpts() {
    let srv = this.server;
    const s = (Player.data.settings.peerServer || '').trim();
    if (!srv && s) {
      const m = /^(?:(https?|wss?):\/\/)?([^/:]+)(?::(\d+))?(\/.*)?$/.exec(s);
      if (m) srv = { host: m[2], port: Number(m[3]) || (m[1] === 'http' || m[1] === 'ws' ? 80 : 443), path: m[4] || '/', secure: !(m[1] === 'http' || m[1] === 'ws') };
    }
    return Object.assign({ debug: 0 }, srv || {});
  },

  makeCode() {
    let s = '';
    for (let i = 0; i < 6; i++) s += this.CODE_CHARS[Math.floor(Math.random() * this.CODE_CHARS.length)];
    return s;
  },
  normCode(code) { return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); },

  // 招待リンク（http(s) で開いているときだけ使える）
  inviteUrl() {
    if (!/^https?:$/.test(location.protocol)) return '';
    return location.origin + location.pathname + '#room=' + this.code;
  },
  // 招待リンクから開いたらルームコードを入れておく
  checkInvite() {
    const m = /room=([A-Za-z0-9]{6})/.exec(location.hash || '');
    if (!m) return false;
    UI.state.joinCode = this.normCode(m[1]);
    UI.state.raceMode = 'custom';
    return true;
  },

  horseInfo(g) {
    return {
      name: g.name, style: g.runningStyle, rarity: g.rarity,
      overall: Math.round(STAT_KEYS.reduce((a, k) => a + g.stats[k], 0) / STAT_KEYS.length)
    };
  },

  myHorse() { return Player.horse(this.myHorseId) || Player.horse(UI.state.raceHorse); },

  refresh() {
    if (UI.state.screen === 'race' && UI.state.raceMode === 'custom') UI.render();
  },

  fail(msg) {
    this.cleanup();
    this.status = 'error';
    this.error = msg;
    this.refresh();
    UI.toast(msg, 'error');
  },

  cleanup() {
    clearTimeout(this._timer);
    try { if (this.peer) this.peer.destroy(); } catch (e) { /* noop */ }
    this.peer = null;
    this.conn = null;
    this.conns = {};
    this.members = [];
    this.role = null;
    this.myId = null;
  },

  // ── ホスト ──
  host(spec, horse) {
    if (!this.available()) return this.fail('この環境ではオンライン機能を使えません');
    this.leave(true);
    this.role = 'host';
    this.spec = Pvp.sanitizeSpec(spec);
    this.myHorseId = horse.id;
    this.status = 'connecting';
    this.error = '';
    this.code = this.makeCode();
    this.refresh();
    const peer = this.peer = new Peer(this.PREFIX + this.code, this.peerOpts());
    this._timer = setTimeout(() => { if (this.status === 'connecting') this.fail('サーバーに接続できませんでした。通信環境を確認してね'); }, this.TIMEOUT);
    peer.on('open', () => {
      clearTimeout(this._timer);
      this.status = 'lobby';
      this.myId = 'host';
      const g = Pvp.importCode(Pvp.exportCode(horse));
      g.order = UI.state.order || 'normal';
      this.members = [{ id: 'host', owner: Player.data.name, horse: this.horseInfo(g), ghost: g, ready: true, host: true }];
      this.refresh();
    });
    peer.on('connection', conn => this.onGuest(conn));
    peer.on('disconnected', () => { try { if (this.peer === peer) peer.reconnect(); } catch (e) { /* noop */ } });
    peer.on('error', err => {
      if (this.peer !== peer) return;
      if (err.type === 'unavailable-id') { this.host(this.spec, horse); return; }   // コードがかぶったら作り直す
      if (err.type === 'peer-unavailable') return;
      this.fail('通信エラー：' + this.errText(err));
    });
  },

  errText(err) {
    const t = err && err.type;
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'サーバーに接続できません';
    if (t === 'browser-incompatible') return 'このブラウザは対応していません';
    if (t === 'peer-unavailable') return 'ルームが見つかりません';
    return (err && err.message) || '不明なエラー';
  },

  onGuest(conn) {
    conn.on('data', msg => this.onHostData(conn, msg));
    conn.on('close', () => this.dropMember(conn));
    conn.on('error', () => this.dropMember(conn));
  },

  memberOf(conn) { return this.members.find(m => this.conns[m.id] === conn); },

  dropMember(conn) {
    const m = this.memberOf(conn);
    if (!m) return;
    delete this.conns[m.id];
    this.members = this.members.filter(x => x !== m);
    UI.toast(`👋 ${Util.esc(m.owner)}さんが退出しました`);
    this.broadcastLobby();
  },

  onHostData(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    let m = this.memberOf(conn);
    if (msg.t === 'hello') {
      if (msg.v !== this.VERSION) { conn.send({ t: 'bye', reason: 'ゲームのバージョンが違います。最新版で参加してね' }); return; }
      if (!m && this.members.length >= this.spec.field) { conn.send({ t: 'bye', reason: 'ルームが満員です' }); return; }
      let g;
      try { g = Pvp.importCode(msg.entry); } catch (e) { conn.send({ t: 'bye', reason: '出走馬のデータが正しくありません' }); return; }
      if (!m) {
        m = { id: 'g' + (++this.seq), ready: true };
        this.conns[m.id] = conn;
        this.members.push(m);
        UI.toast(`🙌 ${Util.esc(g.owner)}さんが参加しました`);
      }
      g.order = GAME_DATA.orders[msg.order] ? msg.order : 'normal';
      Object.assign(m, { owner: g.owner, horse: this.horseInfo(g), ghost: g, ready: true });
      this.broadcastLobby();
    } else if (!m) {
      return;
    } else if (msg.t === 'order') {
      m.ghost.order = GAME_DATA.orders[msg.order] ? msg.order : 'normal';
    } else if (msg.t === 'ready') {
      m.ready = true;
      this.broadcastLobby();
    } else if (msg.t === 'leave') {
      try { conn.close(); } catch (e) { /* noop */ }
      this.dropMember(conn);
    }
  },

  publicMembers() {
    return this.members.map(m => ({ id: m.id, owner: m.owner, horse: m.horse, ready: m.ready, host: !!m.host }));
  },

  broadcastLobby() {
    const members = this.publicMembers();
    Object.entries(this.conns).forEach(([id, c]) => {
      try { c.send({ t: 'lobby', code: this.code, spec: this.spec, members, you: id }); } catch (e) { /* noop */ }
    });
    this.refresh();
  },

  // ホストが自分の出走馬を変える
  setHostHorse(h) {
    const me = this.members.find(m => m.id === 'host');
    if (!me) return;
    this.myHorseId = h.id;
    me.ghost = Pvp.importCode(Pvp.exportCode(h));
    me.ghost.order = UI.state.order || 'normal';
    me.horse = this.horseInfo(me.ghost);
    this.broadcastLobby();
  },

  // ── 参加者 ──
  join(code, horse) {
    if (!this.available()) return this.fail('この環境ではオンライン機能を使えません');
    code = this.normCode(code);
    if (code.length !== 6) return UI.toast('ルームコードは6文字です', 'error');
    this.leave(true);
    this.role = 'guest';
    this.code = code;
    this.myHorseId = horse.id;
    this.status = 'connecting';
    this.error = '';
    this.refresh();
    const peer = this.peer = new Peer(this.peerOpts());
    this._timer = setTimeout(() => { if (this.status === 'connecting') this.fail('ルームに接続できませんでした。コードを確認してね'); }, this.TIMEOUT);
    peer.on('open', () => {
      const conn = this.conn = peer.connect(this.PREFIX + code, { reliable: true });
      conn.on('open', () => conn.send({ t: 'hello', v: this.VERSION, entry: Pvp.exportCode(horse), order: UI.state.order }));
      conn.on('data', msg => this.onGuestData(msg));
      conn.on('close', () => { if (this.conn === conn && this.status === 'lobby') this.fail('ホストとの接続が切れました'); });
    });
    peer.on('error', err => {
      if (this.peer !== peer) return;
      this.fail(err.type === 'peer-unavailable' ? 'ルームが見つかりません。コードを確認してね' : '通信エラー：' + this.errText(err));
    });
  },

  onGuestData(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'lobby') {
      clearTimeout(this._timer);
      const first = this.status !== 'lobby';
      this.status = 'lobby';
      this.spec = Pvp.sanitizeSpec(msg.spec);
      this.members = Array.isArray(msg.members) ? msg.members.slice(0, 18) : [];
      this.myId = msg.you;
      if (first) UI.toast('🌐 ルームに参加しました');
      this.refresh();
    } else if (msg.t === 'race') {
      this.play(msg);
    } else if (msg.t === 'bye') {
      this.fail(String(msg.reason || 'ルームが解散されました'));
    }
  },

  // 出走馬を変える（ロビーにいる間）
  changeHorse(h) {
    if (this.role === 'host') return this.setHostHorse(h);
    if (this.role !== 'guest' || !this.conn) return;
    this.myHorseId = h.id;
    this.conn.send({ t: 'hello', v: this.VERSION, entry: Pvp.exportCode(h), order: UI.state.order });
  },

  // 作戦を変える（ロビーにいる間）
  setOrder(k) {
    if (this.role === 'host') { const me = this.members.find(m => m.id === 'host'); if (me) me.ghost.order = k; }
    else if (this.role === 'guest' && this.conn) { try { this.conn.send({ t: 'order', order: k }); } catch (e) { /* noop */ } }
  },

  // ── レース開始（ホスト） ──
  start() {
    if (this.role !== 'host' || this.status !== 'lobby') return;
    const humans = this.members.map(m => Object.assign(Pvp.ghostEntrant(m.ghost, this.spec.cap || null), {
      id: 'on_' + m.id, owner: m.owner, isGhost: false, isOnline: true, condition: 85
    }));
    const match = Pvp.buildCustomMatch(this.spec, humans);
    const result = Race.simulate(match.race, match.field, match.ground);
    const msg = { t: 'race', n: ++this.raceNo, race: match.race, result };
    this.members.forEach(m => { if (!m.host) m.ready = false; });
    Object.values(this.conns).forEach(c => { try { c.send(msg); } catch (e) { /* noop */ } });
    this.play(msg);
  },

  // 受け取った結果を「自分の馬」が分かるように直す
  localize(result, myEntryId) {
    const r = JSON.parse(JSON.stringify(result));
    r.entrants.forEach(e => { e.isPlayer = e.id === myEntryId; });
    r.finish.forEach(f => { f.isPlayer = f.id === myEntryId; });
    r.events.forEach(ev => { if (ev.horseId) ev.isPlayer = ev.horseId === myEntryId; });
    return r;
  },

  play(msg) {
    if (!msg.result || !Array.isArray(msg.result.finish) || !Array.isArray(msg.result.frames)) return;
    const race = Object.assign(Pvp.customRace(Pvp.sanitizeSpec(msg.race)), { online: true });
    const myEntry = 'on_' + this.myId;
    const result = this.localize(msg.result, myEntry);
    const reward = Pvp.applyCustom(result, myEntry, true);
    Player.save();
    App.playCustom(race, result, reward, this.myHorseId, true);
  },

  // ロビーに戻ったことをホストに伝える
  backToLobby() {
    if (this.role === 'guest' && this.conn) { try { this.conn.send({ t: 'ready' }); } catch (e) { /* noop */ } }
    UI.state.raceMode = 'custom';
    UI.show('race');
  },

  leave(silent) {
    if (this.role === 'host') Object.values(this.conns).forEach(c => { try { c.send({ t: 'bye', reason: 'ホストがルームを解散しました' }); } catch (e) { /* noop */ } });
    if (this.role === 'guest' && this.conn) { try { this.conn.send({ t: 'leave' }); } catch (e) { /* noop */ } }
    const wasActive = this.role !== null;
    // 送信が届くよう少し待ってから切断する
    const peer = this.peer;
    this.peer = null;
    if (peer) setTimeout(() => { try { peer.destroy(); } catch (e) { /* noop */ } }, 300);
    this.cleanup();
    this.status = 'idle';
    this.error = '';
    if (!silent && wasActive) { UI.toast('ルームを退出しました'); this.refresh(); }
  }
};
