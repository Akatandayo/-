// カード定義の検索・抽選・表示用ヘルパー
'use strict';

const Util = {
  rand(min, max) { return min + Math.random() * (max - min); },
  randInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); },
  clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  gauss() { // 標準正規分布（Box-Muller）
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  },
  weighted(table) { // { key: weight }
    const entries = Object.entries(table).filter(([, w]) => w > 0);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of entries) { if ((r -= w) < 0) return k; }
    return entries[entries.length - 1][0];
  },
  uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
  esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  money(n) { return Math.round(n).toLocaleString('ja-JP') + ' G'; },
  stars(v, max = 5) { // 0〜100 → ★1〜5
    const n = Util.clamp(Math.round(v / 20), 1, max);
    return '★'.repeat(n) + '☆'.repeat(max - n);
  },
  aptMark(v) { // 適性記号
    if (v >= 85) return '◎';
    if (v >= 65) return '○';
    if (v >= 45) return '△';
    return '×';
  },
  grade(v) { // 総合評価
    const table = [[100, 'SS'], [92, 'S'], [85, 'A'], [78, 'B'], [71, 'C'], [64, 'D'], [57, 'E'], [50, 'F']];
    for (const [min, g] of table) if (v >= min) return g;
    return 'G';
  }
};

const Cards = {
  types: {
    sire: { label: '種牡馬', icon: '♂', color: 'sire' },
    mare: { label: '繁殖牝馬', icon: '♀', color: 'mare' },
    skill: { label: 'スキル', icon: '🎴', color: 'skill' },
    item: { label: 'アイテム', icon: '🎒', color: 'item' }
  },

  _index: null,
  index() {
    if (this._index) return this._index;
    const idx = {};
    GAME_DATA.sires.forEach(c => { idx[c.id] = Object.assign({ type: 'sire' }, c); });
    GAME_DATA.mares.forEach(c => { idx[c.id] = Object.assign({ type: 'mare' }, c); });
    GAME_DATA.skills.forEach(c => { idx[c.id] = Object.assign({ type: 'skill' }, c); });
    GAME_DATA.items.forEach(c => { idx[c.id] = Object.assign({ type: 'item' }, c); });
    if (typeof Legends !== 'undefined') Legends.all().forEach(l => { const c = Legends.card(l); idx[c.id] = c; });
    this._index = idx;
    return idx;
  },

  // 殿堂馬などプレイヤー固有のカードも含めて検索
  get(id) {
    const base = this.index()[id];
    if (base) return base;
    if (typeof Player !== 'undefined' && Player.data && Player.data.customCards) return Player.data.customCards[id] || null;
    return null;
  },

  all(includeCustom = true) {
    const list = Object.values(this.index());
    if (includeCustom && Player.data && Player.data.customCards) list.push(...Object.values(Player.data.customCards));
    return list;
  },

  rarityIndex(r) { return GAME_DATA.rarities.indexOf(r); },

  // 指定タイプ・レアリティのカードをランダムに選ぶ。無ければ近いレアリティから。
  randomOf(type, rarity) {
    // 名馬カード・名馬の固有スキルは抽選に入れない（名馬に先着したときだけ手に入る）
    const pool = this.all(false).filter(c => c.type === type && !c.legend && !c.legendOnly && !(c.type === 'item' && c.price === undefined));
    const target = this.rarityIndex(rarity);
    for (let d = 0; d < GAME_DATA.rarities.length; d++) {
      for (const dir of [-1, 1]) {
        const r = GAME_DATA.rarities[target + d * dir];
        const cands = pool.filter(c => c.rarity === r);
        if (cands.length) return Util.pick(cands);
      }
    }
    return Util.pick(pool);
  },

  // レース報酬のカード抽選
  drawReward(grade) {
    const rarity = Util.weighted(GAME_DATA.dropTable[grade] || GAME_DATA.dropTable.cond);
    const type = Util.weighted(GAME_DATA.dropTypeWeights);
    return this.randomOf(type, rarity);
  },

  // カードパックを開ける（所持金の処理は呼び出し側）
  openPack(pack) {
    const cards = [];
    for (let i = 0; i < pack.count; i++) {
      const rarity = Util.weighted(GAME_DATA.dropTable[pack.table]);
      const type = pack.types ? Util.pick(pack.types) : Util.weighted(GAME_DATA.dropTypeWeights);
      cards.push(this.randomOf(type, rarity));
    }
    // レア度保証：最後の1枚を保証レア以上に差し替え
    if (pack.guarantee && !cards.some(c => this.rarityIndex(c.rarity) >= this.rarityIndex(pack.guarantee))) {
      const pool = GAME_DATA.rarities.slice(this.rarityIndex(pack.guarantee));
      const type = pack.types ? Util.pick(pack.types) : Util.weighted(GAME_DATA.dropTypeWeights);
      cards[cards.length - 1] = this.randomOf(type, Util.pick(pool));
    }
    return cards;
  }
};
