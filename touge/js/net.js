// ===== 峠 SPIRITS : online P2P battle (PeerJS / WebRTC) =====
(function () {
  'use strict';
  const PREFIX = 'touge-spirits-v1-';
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const N = {
    peer: null, conn: null, role: null, code: null,
    on: {}, // handlers: open, msg, close, error, status
  };
  function emit(k, ...a) { if (N.on[k]) N.on[k](...a); }
  function genCode() { let s = ''; for (let i = 0; i < 5; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)]; return s; }

  function bindConn(c) {
    N.conn = c;
    c.on('open', () => { emit('status', '接続しました！'); emit('open'); });
    c.on('data', (d) => { try { emit('msg', typeof d === 'string' ? JSON.parse(d) : d); } catch (e) { console.warn(e); } });
    c.on('close', () => { emit('status', '相手が切断しました'); emit('close'); N.conn = null; });
    c.on('error', (e) => emit('error', e));
  }

  N.available = () => typeof window.Peer === 'function';

  N.host = function () {
    N.leave();
    if (!N.available()) { emit('error', new Error('PeerJS を読み込めませんでした（ネット接続を確認）')); return; }
    N.role = 'host'; N.code = genCode();
    emit('status', 'ルームを作成中…');
    const p = new Peer(PREFIX + N.code, Object.assign({ debug: 0 }, window.__PEER_OPTS || {}));
    N.peer = p;
    p.on('open', () => emit('status', 'ルームコードを相手に伝えてください'));
    p.on('connection', (c) => {
      if (N.conn) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; }
      bindConn(c);
    });
    p.on('error', (e) => {
      if (e.type === 'unavailable-id') { N.host(); return; }
      emit('error', e);
    });
    p.on('disconnected', () => { try { p.reconnect(); } catch (_) {} });
    return N.code;
  };

  N.join = function (code) {
    N.leave();
    if (!N.available()) { emit('error', new Error('PeerJS を読み込めませんでした（ネット接続を確認）')); return; }
    N.role = 'guest'; N.code = code.toUpperCase().trim();
    emit('status', '接続中…');
    const p = new Peer(Object.assign({ debug: 0 }, window.__PEER_OPTS || {}));
    N.peer = p;
    p.on('open', () => {
      const c = p.connect(PREFIX + N.code, { reliable: true });
      bindConn(c);
    });
    p.on('error', (e) => {
      if (e.type === 'peer-unavailable') emit('error', new Error('ルームが見つかりません（コードを確認）'));
      else emit('error', e);
    });
  };

  N.send = function (obj) {
    if (N.conn && N.conn.open) { try { N.conn.send(obj); } catch (_) {} }
  };
  N.connected = () => !!(N.conn && N.conn.open);

  N.leave = function () {
    try { if (N.conn) N.conn.close(); } catch (_) {}
    try { if (N.peer) N.peer.destroy(); } catch (_) {}
    N.conn = null; N.peer = null; N.role = null;
  };

  window.Net = N;
})();
