// 配合システム：種牡馬カード＋繁殖牝馬カード → 競走馬
'use strict';

const Breeding = {
  VARIANCE: 5,       // 個体差（標準偏差）
  TRAIT_BONUS: 4,    // 遺伝傾向の能力ボーナス

  fee(father, mother) {
    return GAME_DATA.breedingFee[father.rarity] + GAME_DATA.breedingFee[mother.rarity];
  },

  // 親の得意距離が同じなら相性ボーナス
  compatibility(father, mother) {
    const best = c => DIST_KEYS.reduce((a, b) => (c.apt[b] > c.apt[a] ? b : a));
    let bonus = 0;
    if (best(father) === best(mother)) bonus += 2;
    if ((father.apt.turf >= 80 && mother.apt.turf >= 80) || (father.apt.dirt >= 80 && mother.apt.dirt >= 80)) bonus += 1;
    return bonus;
  },

  // 先祖（自分を含む）のID一覧。殿堂馬カードは先祖情報を持つ。
  lineage(card) { return [card.id, ...(card.ancestors || [])]; },

  // 特殊配合の判定
  specials(father, mother) {
    const list = [];
    const nick = GAME_DATA.nicks.find(n => n.sire === father.id && n.mare === mother.id);
    if (nick) list.push({ key: 'nick', id: nick.sire + '+' + nick.mare, name: `黄金配合「${nick.name}」`, desc: `全能力+${nick.bonus}`, bonus: nick.bonus });
    const shared = this.lineage(father).filter(id => this.lineage(mother).includes(id));
    if (shared.length) {
      const anc = Cards.get(shared[0]);
      list.push({ key: 'inbreed', name: '奇跡の血量（インブリード）', desc: `共通の先祖${anc ? `「${anc.name}」` : ''}の力が濃く出る。得意な能力+6・得意距離の適性アップ`, bonus: 0 });
    }
    if (father.style === mother.style) list.push({ key: 'style', name: '脚質一致', desc: `子は必ず${GAME_DATA.styles[father.style].label}に。スキルも受け継ぎやすい`, bonus: 0 });
    if (father.custom && mother.custom) list.push({ key: 'legend', name: '名馬の結晶', desc: '自家生産の名馬同士。全能力+2', bonus: 2 });
    return list;
  },

  // ランダムを含まない期待値
  expected(father, mother) {
    const specials = this.specials(father, mother);
    const has = k => specials.some(x => x.key === k);
    const specialBonus = specials.reduce((sum, x) => sum + x.bonus, 0);
    const compat = this.compatibility(father, mother);
    const rarityBonus = (Cards.rarityIndex(father.rarity) + Cards.rarityIndex(mother.rarity)) * 0.5;
    const stats = {};
    STAT_KEYS.forEach(k => {
      let wf = 0.5, wm = 0.5, bonus = rarityBonus + compat + specialBonus;
      if (father.trait === k) { wf += 0.1; wm -= 0.1; bonus += this.TRAIT_BONUS; }
      if (mother.trait === k) { wm += 0.1; wf -= 0.1; bonus += this.TRAIT_BONUS; }
      if (father.trait === 'balance') bonus += 2;
      if (mother.trait === 'balance') bonus += 2;
      // 親の高い方の能力が少し引き継がれやすい
      const hi = Math.max(father.stats[k], mother.stats[k]);
      stats[k] = (father.stats[k] * wf + mother.stats[k] * wm) * 0.85 + hi * 0.15 + bonus;
    });
    if (has('inbreed')) {
      const top = STAT_KEYS.reduce((a, b) => (stats[b] > stats[a] ? b : a));
      stats[top] += 6;
    }
    const aptitude = {};
    [...DIST_KEYS, 'turf', 'dirt'].forEach(k => {
      const a = father.apt[k], b = mother.apt[k];
      aptitude[k] = Math.max(a, b) * 0.6 + Math.min(a, b) * 0.4;
    });
    if (has('inbreed')) {
      const best = DIST_KEYS.reduce((a, b) => (aptitude[b] > aptitude[a] ? b : a));
      aptitude[best] = Math.min(100, aptitude[best] + 8);
    }
    return { stats, aptitude, specials };
  },

  // 初心者向けの配合予想
  preview(father, mother) {
    const exp = this.expected(father, mother);
    const avg = STAT_KEYS.reduce((s, k) => s + exp.stats[k], 0) / STAT_KEYS.length;
    const arrows = {};
    STAT_KEYS.forEach(k => {
      const v = exp.stats[k];
      arrows[k] = v >= 82 ? '↑↑↑' : v >= 72 ? '↑↑' : v >= 62 ? '↑' : '→';
    });
    const bestDist = DIST_KEYS.reduce((a, b) => (exp.aptitude[b] > exp.aptitude[a] ? b : a));
    const distOrder = DIST_KEYS.filter(k => exp.aptitude[k] >= exp.aptitude[bestDist] - 8);
    const distLabels = distOrder.map(k => GAME_DATA.distances.find(d => d.key === k).label);
    const surface = exp.aptitude.turf >= exp.aptitude.dirt ? '芝' : 'ダート';
    const compat = this.compatibility(father, mother);
    const score = Util.clamp(Math.round((avg - 45) / 9) + (compat >= 2 ? 1 : 0) + (exp.specials.length ? 1 : 0), 1, 5);

    const topStat = STAT_KEYS.reduce((a, b) => (exp.stats[b] > exp.stats[a] ? b : a));
    const statInfo = GAME_DATA.stats.find(s => s.key === topStat);
    let comment = `${statInfo.label}の高い子供が生まれやすい組み合わせです。`;
    if (compat >= 2) comment += ' 得意距離が同じで相性バツグン！';

    return {
      score, arrows, comment, compat, specials: exp.specials,
      distText: distLabels.length > 1 ? `${distLabels[0]}～${distLabels[distLabels.length - 1]}` : distLabels[0],
      surface,
      fee: this.fee(father, mother)
    };
  },

  // 配合を実行して新しい競走馬を作る（所持金・カード消費は呼び出し側）
  breed(father, mother) {
    const exp = this.expected(father, mother);
    const caps = {};
    STAT_KEYS.forEach(k => {
      caps[k] = Math.round(Util.clamp(exp.stats[k] + Util.gauss() * this.VARIANCE, 30, 110));
    });
    const stats = {};
    const startRate = Util.rand(0.66, 0.74);
    STAT_KEYS.forEach(k => { stats[k] = Math.round(caps[k] * (startRate + Util.rand(-0.03, 0.03))); });

    const aptitude = {};
    Object.keys(exp.aptitude).forEach(k => {
      aptitude[k] = Math.round(Util.clamp(exp.aptitude[k] + Util.gauss() * 7, 10, 100));
    });

    const styleKeys = Object.keys(GAME_DATA.styles);
    const r = Math.random();
    const sameStyle = exp.specials.some(x => x.key === 'style');
    const runningStyle = sameStyle ? father.style : r < 0.4 ? father.style : r < 0.8 ? mother.style : Util.pick(styleKeys);
    const g = Math.random();
    const growthKeys = Object.keys(GAME_DATA.growthTypes);
    const growthType = g < 0.45 ? father.growth : g < 0.9 ? mother.growth : Util.pick(growthKeys);

    const potential = STAT_KEYS.reduce((s, k) => s + caps[k], 0) / STAT_KEYS.length;
    const horse = Horse.create({
      traits: Traits.inherit(father, mother),
      stats, caps, aptitude, runningStyle, growthType,
      rarity: Horse.rarityFromPotential(potential),
      condition: Util.randInt(60, 85),
      fatherId: father.id, motherId: mother.id
    });
    horse.route = Horse.recommendRoute(horse);
    horse.pedigree = this.pedigreeOf(father, mother);
    horse.specials = exp.specials.map(x => x.name);

    // 親のスキルを受け継ぐことがある（スキルカードとして入手）
    let inherited = null;
    if (Math.random() < (sameStyle ? 0.85 : 0.6)) {
      inherited = Math.random() < 0.5 ? father.skill : mother.skill;
      if (!Cards.get(inherited)) inherited = null;
    }
    return { horse, inherited, specials: exp.specials };
  },

  // 3代血統表（父・母・祖父母）のスナップショット
  pedigreeOf(father, mother) {
    const node = c => (c ? { id: c.id, name: c.name, rarity: c.rarity } : null);
    const pp = c => (c.pedigree || {});
    return {
      f: node(father), m: node(mother),
      ff: pp(father).f || null, fm: pp(father).m || null,
      mf: pp(mother).f || null, mm: pp(mother).m || null
    };
  }
};
