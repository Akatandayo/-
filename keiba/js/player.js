// プレイヤーデータ（所持金・カード・馬・ミッション進行）
'use strict';

const Player = {
  data: null,

  createNew(name) {
    return {
      name: name || 'オーナー',
      money: 10000,
      cards: Object.assign({}, GAME_DATA.starterCards), // { cardId: 枚数 }
      seenCards: Object.keys(GAME_DATA.starterCards),   // 図鑑用（一度でも入手したカード）
      customCards: {},                                  // 殿堂馬から生まれた配合カード
      horses: [],
      retired: [],
      hallOfFame: [],
      missions: { index: 0, claimable: false },
      stats: {
        breedCount: 0, trainCount: 0, equipCount: 0, raceCount: 0, winCount: 0,
        gradedRaceCount: 0, g1RaceCount: 0, g1WinCount: 0, hofCount: 0
      },
      settings: { raceSpeed: 1 },
      calendar: { year: 1, week: GAME_DATA.startWeek },  // ゲーム内の日付（全馬共通）
      records: {},                                      // コースレコード { raceId: { time, name } }
      pvp: { rating: 1000, best: 1000, matches: 0, wins: 0, leagueWins: {} },
      ghosts: [],                                       // フレンドから受け取った対戦コードの馬
      nicksFound: [],                                   // 発見した黄金配合
      tutorialDone: false,
      createdAt: Date.now()
    };
  },

  init() {
    this.data = Save.load() || this.createNew();
    this.normalize();
  },

  // 古いセーブや欠損キーを補完
  normalize() {
    const fresh = this.createNew(this.data.name);
    for (const k of Object.keys(fresh)) if (this.data[k] === undefined) this.data[k] = fresh[k];
    for (const k of Object.keys(fresh.stats)) if (this.data.stats[k] === undefined) this.data.stats[k] = 0;
    this.data.horses.forEach(h => {
      if (!h.rights) h.rights = [];
      if (!h.titles) h.titles = [];
      if (h.actedAt === undefined) h.actedAt = -1;
      // v8：限界値アップに上限ができたので、以前のセーブで上がりすぎた限界値を整える
      if (h.capBoost === undefined) {
        h.capBoost = 0;
        const max = 110 + GAME_DATA.capBoostMax;
        STAT_KEYS.forEach(k => { h.caps[k] = Math.min(h.caps[k], max); h.stats[k] = Math.min(h.stats[k], h.caps[k]); });
      }
    });
  },

  save() { Save.save(this.data); },

  reset() {
    Save.reset();
    this.data = this.createNew();
    this.save();
  },

  // ── ショップの在庫（1週間ごとに入荷） ──
  shopLeft(item) {
    if (!item.stock) return Infinity;
    const s = this.data.shop;
    const bought = s && s.week === Calendar.abs() ? s.bought[item.id] || 0 : 0;
    return Math.max(0, item.stock - bought);
  },
  shopBuy(item) {
    if (!this.data.shop || this.data.shop.week !== Calendar.abs()) this.data.shop = { week: Calendar.abs(), bought: {} };
    this.data.shop.bought[item.id] = (this.data.shop.bought[item.id] || 0) + 1;
  },

  // ── お金 ──
  canAfford(n) { return this.data.money >= n; },
  addMoney(n) { this.data.money = Math.max(0, Math.round(this.data.money + n)); },

  // ── カード ──
  count(cardId) { return this.data.cards[cardId] || 0; },
  addCard(cardId, n = 1) {
    this.data.cards[cardId] = this.count(cardId) + n;
    if (!this.data.seenCards.includes(cardId)) this.data.seenCards.push(cardId);
  },
  removeCard(cardId, n = 1) {
    if (this.count(cardId) < n) return false;
    this.data.cards[cardId] -= n;
    if (this.data.cards[cardId] <= 0) delete this.data.cards[cardId];
    return true;
  },
  ownedCards(type) {
    return Object.keys(this.data.cards)
      .map(id => Cards.get(id))
      .filter(c => c && (!type || c.type === type));
  },
  hasRarityAtLeast(rarity) {
    const min = Cards.rarityIndex(rarity);
    return this.data.seenCards.some(id => { const c = Cards.get(id); return c && Cards.rarityIndex(c.rarity) >= min; });
  },

  // ── 馬 ──
  horse(id) { return this.data.horses.find(h => h.id === id) || null; },
  stableFull() { return this.data.horses.length >= GAME_DATA.maxStable; },

  bump(stat, n = 1) { this.data.stats[stat] = (this.data.stats[stat] || 0) + n; }
};

// ミッション進行
const Missions = {
  current() { return GAME_DATA.missions[Player.data.missions.index] || null; },

  progress(m) {
    if (m.check === 'srCount') return Player.hasRarityAtLeast('SR') ? 1 : 0;
    return Player.data.stats[m.check] || 0;
  },

  isComplete(m) { return m && this.progress(m) >= m.target; },

  claim() {
    const m = this.current();
    if (!this.isComplete(m)) return null;
    Player.addMoney(m.reward.money || 0);
    (m.reward.cards || []).forEach(id => Player.addCard(id));
    Player.data.missions.index++;
    Player.save();
    return m;
  }
};
