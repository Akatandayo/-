// 対戦：リーグ戦（CPU馬主との対戦・レーティング）と、対戦コードによるフレンド対戦
// どちらもレース計算は Race.simulate を使い、オートで決着する。
'use strict';

const Pvp = {
  FIELD: 8,
  FATIGUE: 10,

  league(id) { return GAME_DATA.leagues.find(l => l.id === id); },

  isUnlocked(league) { return Player.data.pvp.rating >= league.minRating; },

  canEnter(h) {
    if (Horse.mustRetire(h)) return { ok: false, reason: '引退の時期です' };
    if (h.fatigue >= 80) return { ok: false, reason: '疲れすぎ。休ませよう' };
    return { ok: true };
  },

  // リーグの能力上限を適用
  capStats(stats, cap) {
    const out = {};
    STAT_KEYS.forEach(k => { out[k] = cap ? Math.min(stats[k], cap) : stats[k]; });
    return out;
  },

  playerEntrant(h, cap) {
    return {
      id: h.id, name: h.name, owner: Player.data.name, isPlayer: true,
      stats: this.capStats(h.stats, cap), aptitude: Object.assign({}, h.aptitude),
      runningStyle: h.runningStyle, skills: h.skills.slice(),
      condition: h.condition, fatigue: h.fatigue
    };
  },

  // CPUのライバル馬主の馬（スキル3つ持ち）
  makeRival(level, course, cap, usedNames, allowUR) {
    const cat = Horse.distCat(course.distance);
    const stats = {};
    STAT_KEYS.forEach(k => { stats[k] = Math.round(Util.clamp(level + Util.gauss() * 5, 30, 125)); });
    if (cat === 'long') stats.stamina += 6;
    if (cat === 'sprint') stats.power += 4;
    const aptitude = {};
    DIST_KEYS.forEach(k => { aptitude[k] = Util.randInt(30, 85); });
    aptitude.turf = Util.randInt(30, 85);
    aptitude.dirt = Util.randInt(30, 85);
    aptitude[cat] = Util.randInt(75, 100);
    aptitude[course.surface] = Util.randInt(75, 100);
    const runningStyle = Util.pick(Object.keys(GAME_DATA.styles));
    const pool = GAME_DATA.skills.filter(s => (!s.style || s.style === runningStyle) && (allowUR || s.rarity !== 'UR'));
    const skills = [];
    while (skills.length < 3 && pool.length) skills.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
    let name;
    do { name = Horse.randomName(); } while (usedNames.has(name));
    usedNames.add(name);
    return {
      id: Util.uid('rv_'), name, owner: Util.pick(GAME_DATA.rivalOwners) + '厩舎', isPlayer: false,
      stats: this.capStats(stats, cap), aptitude, runningStyle, skills,
      condition: Util.randInt(60, 100), fatigue: Util.randInt(0, 15)
    };
  },

  makeRace(id, name, grade, course) {
    return { id, name, grade, distance: course.distance, surface: course.surface, field: this.FIELD };
  },

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // ── リーグ戦 ──
  buildLeagueMatch(h, leagueId) {
    const league = this.league(leagueId);
    const course = Util.pick(GAME_DATA.leagueCourses);
    const label = `${course.surface === 'turf' ? '芝' : 'ダート'}${course.distance}m`;
    const race = this.makeRace('league_' + league.id, `${league.name}（${label}）`, league.grade, course);
    const used = new Set([h.name]);
    const field = [this.playerEntrant(h, league.statCap)];
    while (field.length < this.FIELD) field.push(this.makeRival(league.npc, course, league.statCap, used, league.id === 'gold'));
    return { kind: 'league', league, race, field: this.shuffle(field), ground: Race.rollGround(race) };
  },

  applyLeague(h, match, result) {
    const me = result.finish.find(f => f.isPlayer);
    const place = me.place;
    const pvp = Player.data.pvp;
    const delta = GAME_DATA.ratingDelta[place - 1] ?? -16;
    const before = pvp.rating;
    pvp.rating = Math.max(800, pvp.rating + delta);
    pvp.best = Math.max(pvp.best, pvp.rating);
    pvp.matches++;
    if (place === 1) {
      pvp.wins++;
      pvp.leagueWins[match.league.id] = (pvp.leagueWins[match.league.id] || 0) + 1;
    }
    const prize = Math.round(match.league.prize * (Race.PRIZE_RATE[place - 1] || 0));
    Player.addMoney(prize);
    const cards = [];
    if (place === 1) {
      const c = Cards.drawReward(match.league.grade);
      const isNew = !Player.data.seenCards.includes(c.id);
      Player.addCard(c.id);
      cards.push({ card: c, isNew });
    }
    const exp = place === 1 ? 60 : place <= 3 ? 40 : 25;
    const levelUps = Horse.addExp(h, exp);
    h.fatigue = Util.clamp(h.fatigue + this.FATIGUE, 0, 100);
    // 新しいリーグ解放の判定
    const unlocked = GAME_DATA.leagues.filter(l => before < l.minRating && pvp.rating >= l.minRating);
    return { place, prize, exp, cards, levelUps, field: result.finish.length, rating: pvp.rating, delta, unlocked };
  },

  // ── 対戦コード（フレンド対戦） ──
  PREFIX: 'UMA1.',

  toB64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  fromB64(b64) {
    const s = b64.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(s + '='.repeat((4 - s.length % 4) % 4));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  },
  checksum(str) {
    let h = 7;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 999983;
    return h.toString(36);
  },

  exportCode(h) {
    const data = {
      n: h.name, o: Player.data.name, r: h.rarity, g: h.gender === 'male' ? 1 : 0,
      s: STAT_KEYS.map(k => h.stats[k]),
      a: [...DIST_KEYS, 'turf', 'dirt'].map(k => h.aptitude[k]),
      st: h.runningStyle, k: h.skills.slice(0, 3),
      w: h.record.wins, rc: h.record.races, g1: h.record.g1Wins
    };
    const body = this.toB64(JSON.stringify(data));
    return this.PREFIX + body + '.' + this.checksum(body);
  },

  importCode(code) {
    const text = String(code || '').trim().replace(/\s+/g, '');
    if (!text.startsWith(this.PREFIX)) throw new Error('対戦コードの形式が違います（UMA1. で始まるコードを貼り付けてね）');
    const rest = text.slice(this.PREFIX.length);
    const dot = rest.lastIndexOf('.');
    const body = rest.slice(0, dot), sum = rest.slice(dot + 1);
    if (dot < 0 || this.checksum(body) !== sum) throw new Error('コードが壊れています。最後まで正しくコピーできているか確認してね');
    let d;
    try { d = JSON.parse(this.fromB64(body)); } catch (e) { throw new Error('コードを読み取れませんでした'); }
    if (!Array.isArray(d.s) || d.s.length !== 5 || !Array.isArray(d.a) || d.a.length !== 6) throw new Error('コードの中身が正しくありません');
    const num = (v, lo, hi) => Util.clamp(Math.round(Number(v) || 0), lo, hi);
    const stats = {}, aptitude = {};
    STAT_KEYS.forEach((k, i) => { stats[k] = num(d.s[i], 1, 140); });
    [...DIST_KEYS, 'turf', 'dirt'].forEach((k, i) => { aptitude[k] = num(d.a[i], 0, 100); });
    return {
      id: Util.uid('gh_'),
      name: String(d.n || '名無しの馬').slice(0, 12),
      owner: String(d.o || 'フレンド').slice(0, 12),
      rarity: GAME_DATA.rarities.includes(d.r) ? d.r : 'N',
      gender: d.g ? 'male' : 'female',
      stats, aptitude,
      runningStyle: GAME_DATA.styles[d.st] ? d.st : 'senko',
      skills: (Array.isArray(d.k) ? d.k : []).filter(id => Skills.get(id)).slice(0, 3),
      record: { wins: num(d.w, 0, 999), races: num(d.rc, 0, 999), g1Wins: num(d.g1, 0, 999) },
      vs: { win: 0, lose: 0 },
      addedAt: Date.now()
    };
  },

  addGhost(code) {
    const g = this.importCode(code);
    const list = Player.data.ghosts;
    const dup = list.find(x => x.name === g.name && x.owner === g.owner);
    if (dup) { Object.assign(dup, g, { id: dup.id, vs: dup.vs }); return dup; }
    list.unshift(g);
    if (list.length > 12) list.length = 12;
    return g;
  },

  ghostEntrant(g, cap) {
    return {
      id: 'e_' + g.id, ghostId: g.id, name: g.name, owner: g.owner + '厩舎', isPlayer: false, isGhost: true,
      stats: this.capStats(g.stats, cap), aptitude: Object.assign({}, g.aptitude),
      runningStyle: g.runningStyle, skills: g.skills.slice(), condition: 85, fatigue: 0
    };
  },

  buildFriendMatch(h, ghostIds, course, cap) {
    const label = `${course.surface === 'turf' ? '芝' : 'ダート'}${course.distance}m`;
    const race = this.makeRace('friend', `フレンド対戦（${label}）`, 'op', course);
    const field = [this.playerEntrant(h, cap)];
    const used = new Set([h.name]);
    ghostIds.slice(0, this.FIELD - 1).forEach(id => {
      const g = Player.data.ghosts.find(x => x.id === id);
      if (g) { field.push(this.ghostEntrant(g, cap)); used.add(g.name); }
    });
    // 足りない枠はCPUで埋める（参加馬の平均くらいの強さ）
    const avg = field.reduce((s, e) => s + STAT_KEYS.reduce((t, k) => t + e.stats[k], 0) / 5, 0) / field.length;
    while (field.length < this.FIELD) field.push(this.makeRival(avg - 3, course, cap, used, false));
    return { kind: 'friend', race, field: this.shuffle(field), ground: Race.rollGround(race), cap };
  },

  applyFriend(h, match, result) {
    const me = result.finish.find(f => f.isPlayer);
    const vs = [];
    result.finish.forEach(f => {
      const e = match.field.find(x => x.id === f.id);
      if (!e || !e.isGhost) return;
      const g = Player.data.ghosts.find(x => x.id === e.ghostId);
      if (!g) return;
      const won = me.place < f.place;
      g.vs[won ? 'win' : 'lose']++;
      vs.push({ name: g.name, owner: g.owner, won });
    });
    const exp = 20;
    const levelUps = Horse.addExp(h, exp);
    h.fatigue = Util.clamp(h.fatigue + this.FATIGUE, 0, 100);
    return { place: me.place, prize: 0, exp, cards: [], levelUps, field: result.finish.length, vs };
  }
};
