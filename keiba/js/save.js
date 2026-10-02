// セーブ処理。ゲームロジックから分離し、将来サーバー保存へ差し替えられるようにする。
'use strict';

const Save = {
  KEY: 'keibaCardGame.save.v1',
  VERSION: 1,

  // ストレージ実装（差し替えポイント）
  storage: {
    get(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; } },
    remove(key) { try { window.localStorage.removeItem(key); } catch (e) { /* noop */ } }
  },

  load() {
    const raw = this.storage.get(this.KEY);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      return this.migrate(data);
    } catch (e) {
      console.warn('セーブデータの読み込みに失敗しました', e);
      return null;
    }
  },

  save(player) {
    return this.storage.set(this.KEY, JSON.stringify({ version: this.VERSION, savedAt: Date.now(), player }));
  },

  reset() {
    this.storage.remove(this.KEY);
  },

  // バージョン差分を吸収する
  migrate(data) {
    if (!data || !data.player) return null;
    return data.player;
  }
};
