// 引退・殿堂入り。名馬は配合カードになって血統を次の世代へつなぐ。
'use strict';

const HallOfFame = {
  qualifies(h) { return h.record.g1Wins >= 3 || h.record.wins >= 10; },

  wonAll(h, crown) {
    const crownRaces = GAME_DATA.races.filter(r => r.crown === crown).map(r => r.id);
    return crownRaces.every(id => h.history.some(x => x.raceId === id && x.place === 1));
  },

  titles(h) {
    const t = [];
    const g1Won = h.history.filter(x => x.place === 1 && x.grade === 'g1').map(x => Race.get(x.raceId)).filter(Boolean);
    if (this.wonAll(h, 'classic')) t.push('三冠馬');
    if (this.wonAll(h, 'tiara')) t.push('ティアラの女王');
    if (h.record.g1Wins >= 5) t.push('伝説の王者');
    if (h.record.wins >= 10) t.push(h.gender === 'female' ? '不屈の女王' : '不屈の名馬');
    if (g1Won.some(r => r.route === 'sprint')) t.push('スプリント王');
    if (g1Won.some(r => r.route === 'mile')) t.push('マイル王');
    if (g1Won.some(r => r.route === 'senior')) t.push('古馬の王者');
    if (g1Won.some(r => r.surface === 'dirt')) t.push('ダートの覇者');
    if (g1Won.some(r => r.distance >= 3000)) t.push('最強ステイヤー');
    return t;
  },

  mainWins(h) {
    const seen = new Set();
    return h.history
      .filter(x => x.place === 1 && ['g1', 'g2', 'g3'].includes(x.grade))
      .sort((a, b) => GAME_DATA.grades[b.grade].order - GAME_DATA.grades[a.grade].order)
      .filter(x => (seen.has(x.raceId) ? false : seen.add(x.raceId)))
      .slice(0, 4)
      .map(x => `${x.name}（${GAME_DATA.grades[x.grade].label}）`);
  },

  // 引退馬から配合カードを作る（重賞を勝った馬のみ）
  makeBreedingCard(h, inHall) {
    const overall = Horse.overall(h);
    let ri = Cards.rarityIndex(Horse.rarityFromPotential(overall));
    if (h.record.g1Wins >= 1) ri++;
    if (inHall) ri++;
    const rarity = GAME_DATA.rarities[Util.clamp(ri, 0, 4)];
    const stats = {};
    STAT_KEYS.forEach(k => { stats[k] = Math.min(100, h.stats[k]); });
    const trait = STAT_KEYS.reduce((a, b) => (stats[b] > stats[a] ? b : a));
    return {
      id: 'c_' + h.id, type: h.gender === 'male' ? 'sire' : 'mare', custom: true,
      name: h.name, rarity, stats,
      apt: Object.assign({}, h.aptitude),
      style: h.runningStyle, growth: h.growthType, trait,
      skill: h.skills[0] || null,
      desc: `${inHall ? '🏛 殿堂馬。' : ''}${h.record.races}戦${h.record.wins}勝（GⅠ ${h.record.g1Wins}勝）`
    };
  },

  retire(h) {
    const p = Player.data;
    p.horses = p.horses.filter(x => x.id !== h.id);
    h.skills.forEach(id => Player.addCard(id)); // 装備スキルは手元に戻る
    const inHall = this.qualifies(h);
    let card = null;
    if (inHall || h.record.gradedWins >= 1) {
      card = this.makeBreedingCard(h, inHall);
      if (!card.skill) delete card.skill;
      p.customCards[card.id] = card;
      Player.addCard(card.id);
    }
    const entry = {
      id: h.id, name: h.name, gender: h.gender, rarity: h.rarity,
      record: Object.assign({}, h.record),
      titles: this.titles(h), mainWins: this.mainWins(h),
      father: (Cards.get(h.fatherId) || {}).name || '不明',
      mother: (Cards.get(h.motherId) || {}).name || '不明',
      overall: Horse.overall(h), retiredAge: h.age, retiredAt: Date.now(),
      cardId: card ? card.id : null
    };
    if (inHall) {
      h.hallOfFame = true;
      p.hallOfFame.unshift(entry);
      Player.bump('hofCount');
    } else {
      p.retired.unshift(entry);
      if (p.retired.length > 30) p.retired.length = 30;
    }
    return { inHall, card, entry };
  }
};
