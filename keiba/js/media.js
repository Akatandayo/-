// ユーザーが登録した写真・音声ファイルの保存（IndexedDB。このブラウザの中だけに保存し、外部には送らない）
'use strict';

const Media = {
  DB: 'keibaCardGame.media',
  STORE: 'files',
  db: null,
  urls: {},   // key → object URL
  meta: {},   // key → { name, duration, ... }
  ok: false,

  open() {
    return new Promise(resolve => {
      try {
        const req = indexedDB.open(this.DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(this.STORE);
        req.onsuccess = () => { this.db = req.result; this.ok = true; resolve(true); };
        req.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  },

  // 起動時に全ファイルを読み込み、すぐ使えるURLにしておく
  async init() {
    if (!(await this.open())) return;
    await new Promise(resolve => {
      const tx = this.db.transaction(this.STORE, 'readonly');
      const req = tx.objectStore(this.STORE).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return resolve();
        const { blob, meta } = c.value || {};
        if (blob) { this.urls[c.key] = URL.createObjectURL(blob); this.meta[c.key] = meta || {}; }
        c.continue();
      };
      req.onerror = () => resolve();
    });
  },

  put(key, blob, meta = {}) {
    if (this.urls[key]) URL.revokeObjectURL(this.urls[key]);
    this.urls[key] = URL.createObjectURL(blob);
    this.meta[key] = meta;
    if (!this.ok) return Promise.resolve(false);   // 保存できない環境では、このページを開いている間だけ有効
    return new Promise(resolve => {
      const tx = this.db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).put({ blob, meta }, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  },

  del(key) {
    if (this.urls[key]) URL.revokeObjectURL(this.urls[key]);
    delete this.urls[key];
    delete this.meta[key];
    if (!this.ok) return Promise.resolve();
    return new Promise(resolve => {
      const tx = this.db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).delete(key);
      tx.oncomplete = tx.onerror = () => resolve();
    });
  },

  url(key) { return this.urls[key] || null; },

  // 画像を指定サイズに縮小して JPEG にする
  resizeImage(file, max = 400) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const u = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob(b => (b ? resolve(b) : reject(new Error('画像を変換できませんでした'))), 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(u); reject(new Error('画像を読み込めませんでした')); };
      img.src = u;
    });
  },

  audioDuration(blob) {
    return new Promise(resolve => {
      const a = new Audio();
      const u = URL.createObjectURL(blob);
      a.preload = 'metadata';
      a.onloadedmetadata = () => { const d = a.duration; URL.revokeObjectURL(u); resolve(isFinite(d) ? d : 0); };
      a.onerror = () => { URL.revokeObjectURL(u); resolve(-1); };
      a.src = u;
    });
  }
};
