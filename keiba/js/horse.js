// 競走馬データと共通ロジック
'use strict';

const STAT_KEYS = ['speed', 'stamina', 'power', 'guts', 'intelligence'];
const DIST_KEYS = ['sprint', 'mile', 'classic', 'long'];

const Horse = {
  // 競走馬オブジェクトを作成（配合・NPC共通）
  create(opts) {
    const gender = opts.gender || (Math.random() < 0.5 ? 'male' : 'female');
    return {
      id: opts.id || Util.uid('h_'),
      name: opts.name || this.randomName(gender),
      rarity: opts.rarity || 'N',
      gender,
      age: opts.age || 2,
      week: 0,
      level: 1,
      exp: 0,
      stats: Object.assign({ speed: 50, stamina: 50, power: 50, guts: 50, intelligence: 50 }, opts.stats),
      caps: Object.assign({}, opts.caps || opts.stats),
      capBoost: 0,          // アイテムで上げた限界値（上限 GAME_DATA.capBoostMax）
      turn: opts.turn !== undefined ? opts.turn : this.randomTurn(),   // 得意な回り（R/L/''）
      aptitude: Object.assign({ sprint: 50, mile: 50, classic: 50, long: 50, turf: 50, dirt: 50 }, opts.aptitude),
      runningStyle: opts.runningStyle || 'senko',
      growthType: opts.growthType || 'normal',
      condition: opts.condition !== undefined ? opts.condition : 70,
      fatigue: opts.fatigue || 0,
      skills: opts.skills || [],
      rights: [],           // 優先出走権（レースID）
      titles: [],           // JRA賞などの称号
      actedAt: -1,
      route: opts.route || null,
      fatherId: opts.fatherId || '',
      motherId: opts.motherId || '',
      record: { races: 0, wins: 0, seconds: 0, thirds: 0, prizeMoney: 0, g1Wins: 0, gradedWins: 0 },
      history: [],
      bornAt: Date.now(),
      hallOfFame: false
    };
  },

  // gender を渡すと、性別に合わない語（レディ・キングなど）を避ける
  randomName(gender) {
    const avoid = gender === 'male' ? GAME_DATA.nameFemaleOnly : gender === 'female' ? GAME_DATA.nameMaleOnly
      : GAME_DATA.nameFemaleOnly.concat(GAME_DATA.nameMaleOnly);
    const ok = w => !avoid.includes(w);
    return Util.pick(GAME_DATA.namePrefix.filter(ok)) + Util.pick(GAME_DATA.nameSuffix.filter(ok));
  },

  // 血統表（古いセーブには pedigree が無いので親カードから組み立てる）
  pedigree(h) {
    if (h.pedigree) return h.pedigree;
    const f = Cards.get(h.fatherId), m = Cards.get(h.motherId);
    return f && m ? Breeding.pedigreeOf(f, m) : { f: null, m: null, ff: null, fm: null, mf: null, mm: null };
  },

  // 得意な回り：右回り・左回り・どちらでも
  randomTurn() { const r = Math.random(); return r < 0.3 ? 'R' : r < 0.6 ? 'L' : ''; },
  turnLabel(t) { return t === 'R' ? '右回り◎・左回り△' : t === 'L' ? '左回り◎・右回り△' : '右回り○・左回り○'; },

  distCat(distance) {
    return GAME_DATA.distances.find(d => distance <= d.max).key;
  },

  overall(h) {
    return Math.round(STAT_KEYS.reduce((s, k) => s + h.stats[k], 0) / STAT_KEYS.length);
  },
  potential(h) {
    return Math.round(STAT_KEYS.reduce((s, k) => s + h.caps[k], 0) / STAT_KEYS.length);
  },

  bestDistance(h) {
    return DIST_KEYS.reduce((a, b) => (h.aptitude[b] > h.aptitude[a] ? b : a));
  },
  bestSurface(h) { return h.aptitude.turf >= h.aptitude.dirt ? 'turf' : 'dirt'; },

  mainAptText(h) {
    const d = GAME_DATA.distances.find(x => x.key === this.bestDistance(h));
    const s = GAME_DATA.surfaces.find(x => x.key === this.bestSurface(h));
    return `${s.icon}${s.label}・${d.label}`;
  },

  conditionInfo(h) {
    const c = h.condition;
    if (c >= 90) return { label: '絶好調', icon: '😆', cls: 'c-best' };
    if (c >= 70) return { label: '好調', icon: '😊', cls: 'c-good' };
    if (c >= 45) return { label: '普通', icon: '🙂', cls: 'c-normal' };
    if (c >= 25) return { label: '不調', icon: '😟', cls: 'c-bad' };
    return { label: '絶不調', icon: '😫', cls: 'c-worst' };
  },

  fatigueInfo(h) {
    const f = h.fatigue;
    if (f >= 80) return { label: 'ヘトヘト', cls: 'f-max' };
    if (f >= 60) return { label: 'かなり疲れ', cls: 'f-high' };
    if (f >= 35) return { label: '少し疲れ', cls: 'f-mid' };
    return { label: '元気', cls: 'f-low' };
  },

  genderLabel(h) { return h.gender === 'male' ? '♂ 牡' : '♀ 牝'; },

  // 年齢と成長タイプによる成長倍率
  growthMult(h) {
    const table = GAME_DATA.growthTypes[h.growthType].mult;
    return table[Util.clamp(h.age - 2, 0, table.length - 1)];
  },

  expToNext(h) { return 80 + h.level * 40; },

  // 経験値を加え、レベルアップ時は全能力+1（限界まで）
  addExp(h, n) {
    h.exp += n;
    let ups = 0;
    while (h.exp >= this.expToNext(h)) {
      h.exp -= this.expToNext(h);
      h.level++;
      ups++;
      STAT_KEYS.forEach(k => { h.stats[k] = Math.min(h.caps[k], h.stats[k] + 1); });
    }
    return ups;
  },

  // 1週進める（調教・レース・休養のたびに呼ぶ）。誕生日なら true
  // 1週に1回だけ行動できる（調教・レース・休養）
  acted(h) { return h.actedAt === Calendar.abs(); },
  act(h) { h.actedAt = Calendar.abs(); },

  // 週が終わるときの自然な変化（疲労が少し抜け、調子が揺れる）
  weekPass(h) {
    h.fatigue = Util.clamp(h.fatigue - 4, 0, 100);
    h.condition = Util.clamp(h.condition + Util.randInt(-5, 4), 0, 100);
  },

  mustRetire(h) { return h.age >= GAME_DATA.retireAge; },

  // おすすめ路線
  recommendRoute(h) {
    const best = this.bestDistance(h);
    if (best === 'sprint') return 'sprint';
    if (best === 'mile') {
      if (h.gender === 'female' && h.age <= 3 && h.aptitude.turf >= 60) return 'filly';
      return 'mile';
    }
    if (h.age <= 3) return h.gender === 'female' && h.aptitude.mile >= 60 ? 'filly' : 'classic';
    return 'senior';
  },

  routeInfo(id) { return GAME_DATA.routes.find(r => r.id === id); },

  // 素質（限界値の平均）から競走馬のレアリティを決める
  rarityFromPotential(p) {
    if (p >= 90) return 'UR';
    if (p >= 83) return 'SSR';
    if (p >= 75) return 'SR';
    if (p >= 66) return 'R';
    return 'N';
  }
};
