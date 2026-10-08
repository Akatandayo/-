// 対戦：リーグ戦（CPU馬主との対戦・レーティング）、対戦コードによるフレンド対戦、カスタムレース
// どれもレース計算は Race.simulate を使い、オートで決着する。
'use strict';

const Pvp = {
  FIELD: 8,
  FATIGUE: 10,

  league(id) { return GAME_DATA.leagues.find(l => l.id === id); },

  isUnlocked(league) { return Player.data.pvp.rating >= league.minRating; },

  // league：リーグ戦は賞金・カードがもらえるので、調教やレースと同じく週1回の行動を使う
  canEnter(h, opts = {}) {
    if (Horse.mustRetire(h)) return { ok: false, reason: '引退の時期です' };
    if (opts.league && Horse.acted(h)) return { ok: false, reason: '今週はもう行動しました（リーグ戦は週1回）' };
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
      runningStyle: h.runningStyle, skills: h.skills.slice(), turn: h.turn || '', order: 'normal',
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
    const pool = GAME_DATA.skills.filter(s => (!s.style || s.style === runningStyle) && !s.legendOnly && (allowUR || s.rarity !== 'UR'));
    const skills = [];
    while (skills.length < 3 && pool.length) skills.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
    let name;
    do { name = Horse.randomName(); } while (usedNames.has(name));
    usedNames.add(name);
    return {
      id: Util.uid('rv_'), name, owner: Util.pick(GAME_DATA.rivalOwners) + '厩舎', isPlayer: false,
      stats: this.capStats(stats, cap), aptitude, runningStyle, skills, turn: Horse.randomTurn(), order: Race.npcOrder(runningStyle),
      condition: Util.randInt(60, 100), fatigue: Util.randInt(0, 15)
    };
  },

  makeRace(id, name, grade, course) {
    const venue = course.venue || Util.pick(Object.keys(GAME_DATA.courses));
    return { id, name, grade, venue, distance: course.distance, surface: course.surface, field: course.field || this.FIELD };
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
    const ground = Race.rollGround(race);
    return { kind: 'league', league, race, field: Race.setOdds(race, this.shuffle(field), ground), ground };
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
    Horse.act(h);
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
      w: h.record.wins, rc: h.record.races, g1: h.record.g1Wins, t: h.turn || ''
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
      turn: d.t === 'R' || d.t === 'L' ? d.t : '',
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
      runningStyle: g.runningStyle, skills: g.skills.slice(), turn: g.turn || '', order: g.order || 'normal', condition: 85, fatigue: 0
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
    const ground = Race.rollGround(race);
    return { kind: 'friend', race, field: Race.setOdds(race, this.shuffle(field), ground), ground, cap };
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
    // 何度でも遊べるエキシビションなので、経験値・疲労なし
    return { place: me.place, prize: 0, exp: 0, cards: [], levelUps: 0, field: result.finish.length, vs };
  },

  // ── カスタムレース（ひとりで／オンラインでみんなと） ──
  CUSTOM_DEFAULT: { name: 'カスタムレース', venue: '東京', surface: 'turf', distance: 2400, grade: 'g1', ground: -1, cap: 0, field: 12, cpu: 'normal', legends: 1 },
  CPU_LEVELS: { none: { label: 'なし', lv: 0 }, weak: { label: '弱い', lv: 58 }, normal: { label: 'ふつう', lv: 70 }, strong: { label: '強い', lv: 80 } },
  CUSTOM_GRADES: { g1: 'GⅠ', g2: 'GⅡ', g3: 'GⅢ', op: 'OP' },
  CUSTOM_CAPS: [0, 70, 85, 100],

  customDistances(venue, surface) {
    const v = GAME_DATA.courses[venue] || {};
    if (surface === 'dirt') return [1000, 1200, 1400, 1600, 1700, 1800, 2000, 2100, 2400];
    return [...(v.straight ? [v.straight] : []), 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2500, 3000, 3200, 3600];
  },

  // 受け取った設定を安全な値にそろえる（オンラインで送られてきた設定にも使う）
  sanitizeSpec(s = {}) {
    const d = this.CUSTOM_DEFAULT;
    const out = {};
    out.name = String(s.name || d.name).replace(/[<>&"']/g, '').slice(0, 16) || d.name;
    out.venue = GAME_DATA.courses[s.venue] ? s.venue : d.venue;
    out.surface = s.surface === 'dirt' ? 'dirt' : 'turf';
    const ds = this.customDistances(out.venue, out.surface);
    out.distance = ds.includes(Number(s.distance)) ? Number(s.distance) : ds.reduce((a, b) => (Math.abs(b - Number(s.distance || d.distance)) < Math.abs(a - Number(s.distance || d.distance)) ? b : a));
    out.grade = this.CUSTOM_GRADES[s.grade] ? s.grade : d.grade;
    out.ground = [0, 1, 2, 3].includes(Number(s.ground)) ? Number(s.ground) : -1;
    out.cap = this.CUSTOM_CAPS.includes(Number(s.cap)) ? Number(s.cap) : 0;
    out.field = Util.clamp(Math.round(Number(s.field) || d.field), 2, 18);
    out.cpu = this.CPU_LEVELS[s.cpu] ? s.cpu : d.cpu;
    out.legends = Util.clamp(Math.round(Number(s.legends) || 0), 0, 3);
    return out;
  },

  customRace(spec) {
    return {
      id: 'custom', kind: 'custom', name: spec.name, grade: spec.grade, venue: spec.venue,
      surface: spec.surface, distance: spec.distance, field: spec.field
    };
  },

  specText(spec) {
    return `${spec.venue} ${spec.surface === 'turf' ? '芝' : 'ダート'}${spec.distance}m（${Race.courseText(this.customRace(spec))}）`;
  },

  // humans：人間の出走馬（自分・オンラインの参加者）。残りを名馬とCPUで埋める
  buildCustomMatch(spec, humans) {
    spec = this.sanitizeSpec(spec);
    const race = this.customRace(spec);
    const cap = spec.cap || null;
    const field = humans.slice(0, spec.field);
    const used = new Set(field.map(e => e.name));
    if (spec.legends && typeof Legends !== 'undefined') {
      Legends.pickCustom(race, spec.legends).forEach(l => {
        if (field.length >= spec.field || used.has(l.name)) return;
        used.add(l.name);
        const e = Legends.entrant(l, race);
        e.stats = this.capStats(e.stats, cap);
        field.push(e);
      });
    }
    const lv = this.CPU_LEVELS[spec.cpu].lv;
    if (lv) while (field.length < spec.field) field.push(this.makeRival(lv, race, cap, used, spec.cpu === 'strong'));
    const ground = spec.ground >= 0 ? spec.ground : Race.rollGround(race);
    return { kind: 'custom', spec, race, field: Race.setOdds(race, this.shuffle(field), ground), ground };
  },

  // 結果の記録（エキシビションなので経験値・賞金はなし）
  applyCustom(result, myId, online) {
    const me = result.finish.find(f => f.id === myId);
    const c = Player.data.custom || (Player.data.custom = { races: 0, wins: 0, online: 0, onlineWins: 0 });
    c.races++;
    if (online) c.online++;
    if (me && me.place === 1) { c.wins++; if (online) c.onlineWins++; }
    return { place: me ? me.place : 0, prize: 0, exp: 0, cards: [], levelUps: 0, field: result.finish.length };
  }
};
