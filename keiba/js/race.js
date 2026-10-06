// レースシステム
// 「結果計算（simulate）」は表示から完全に分離した純粋な計算。
// 返り値の events（実況）と frames（毎秒の位置）を使って、UI側がログ表示や将来の2Dアニメーションを行う。
'use strict';

const Race = {
  DT: 0.5,             // シミュレーション刻み（秒）
  FRAME_INTERVAL: 0.5, // frames を記録する間隔（秒）
  NPC_VARIANCE: 4,
  SKILL_SCALE: 0.5,     // スキル効果（データ上の数値）を実際の速度補正に変換する係数

  // 脚質ごとの区間速度補正
  styleMult: {
    nige: { start: 1.025, mid: 1.01, corner: 0.998, final: 0.988 },
    senko: { start: 1.015, mid: 1.005, corner: 1.002, final: 0.995 },
    sashi: { start: 0.993, mid: 0.997, corner: 1.008, final: 1.018 },
    oikomi: { start: 0.982, mid: 0.992, corner: 1.012, final: 1.03 }
  },

  // 脚質ごとの体力消費（前に行くほど消耗する）
  styleCost: { nige: 1.05, senko: 1.02, sashi: 1.0, oikomi: 0.98 },

  gradeInfo(race) { return GAME_DATA.grades[race.grade]; },

  AGE_LABEL: { '2': '2歳', '3': '3歳', '3+': '3歳以上', '4+': '4歳以上' },
  FIELD: { g1: 16, g2: 16, g3: 16, op: 14, c3: 14, c2: 14, cond: 14, maiden: 14, debut: 12 },

  // ── レース一覧（カレンダー） ──
  routeOf(r) {
    const young = r.ages === '2' || r.ages === '3';
    if (r.f && young) return 'filly';
    if (young && r.distance >= 1800 && r.surface === 'turf') return 'classic';
    if (r.distance <= 1400) return 'sprint';
    if (r.distance <= 1900) return 'mile';
    return 'senior';
  },

  // 重賞データに週・路線・頭数などを付けたもの（キャッシュ）
  _graded: null,
  gradedAll() {
    if (this._graded) return this._graded;
    this._graded = GAME_DATA.races.map(r => Object.assign({
      kind: 'graded', week: Calendar.weekOf(r.m, r.w), female: !!r.f,
      field: this.FIELD[r.grade], route: this.routeOf(r),
      prize: r.prize || GAME_DATA.grades[r.grade].prize
    }, r));
    return this._graded;
  },
  gradedOn(week) { return this.gradedAll().filter(r => r.week === week); },

  // 平場の条件戦（毎週開催。週ごとに距離・コースが変わる）
  conditionRaces(week) {
    const m = Calendar.month(week);
    const venues = GAME_DATA.venuesByMonth[m - 1];
    const list = [];
    let n = 0;
    const pick = (arr, salt) => arr[(week * 7 + salt * 3) % arr.length];
    const add = (ages, grade, surface, distance, label) => {
      const g = GAME_DATA.grades[grade];
      const r = {
        kind: 'cond', id: `${ages.replace('+', 'p')}_${grade}_${surface}_${distance}`,
        name: `${this.AGE_LABEL[ages]}${label || g.label}`,
        grade, ages, surface, distance, week, m, w: Calendar.wom(week),
        venue: venues[n++ % 2], female: false, field: this.FIELD[grade], prize: g.prize
      };
      r.route = this.routeOf(r);
      list.push(r);
    };
    const T2 = [1200, 1400, 1600, 1800, 2000], D2 = [1200, 1400, 1800];
    const T = [1200, 1400, 1600, 1800, 2000, 2200, 2400], D = [1200, 1400, 1700, 1800, 1900];
    if (m >= 6) { add('2', 'debut', 'turf', pick(T2, 1)); add('2', 'debut', 'dirt', pick(D2, 2)); }
    if (m >= 7) { add('2', 'maiden', 'turf', pick(T2, 3)); add('2', 'maiden', 'dirt', pick(D2, 4)); }
    if (m >= 7) add('2', 'cond', 'turf', pick(T2, 5));
    if (m >= 8) add('2', 'op', 'turf', pick(T2, 6), 'オープン');
    if (m <= 3) { add('3', 'debut', 'turf', pick(T, 7)); add('3', 'debut', 'dirt', pick(D, 8)); }
    if (m <= 9) { add('3', 'maiden', 'turf', pick(T, 9)); add('3', 'maiden', 'dirt', pick(D, 10)); }
    if (m <= 5) { add('3', 'cond', 'turf', pick(T, 11)); add('3', 'cond', 'dirt', pick(D, 12)); add('3', 'op', 'turf', pick(T, 13), 'オープン'); }
    const older = m <= 5 ? '4+' : '3+';
    [['cond', 14], ['c2', 16], ['c3', 18]].forEach(([g, salt]) => { add(older, g, 'turf', pick(T, salt)); add(older, g, 'dirt', pick(D, salt + 1)); });
    add(older, 'op', 'turf', pick(T, 20), 'オープン');
    add(older, 'op', 'dirt', pick(D, 21), 'オープン');
    return list;
  },

  weekRaces(week = Calendar.get().week) { return [...this.gradedOn(week), ...this.conditionRaces(week)]; },

  get(id) { return this.gradedAll().find(r => r.id === id) || this.weekRaces().find(r => r.id === id) || null; },

  // ── 出走条件 ──
  isOpen(h) { return h.record.wins >= 4 || h.record.gradedWins >= 1; },

  ageOk(h, r) {
    if (r.ages === '2') return h.age === 2;
    if (r.ages === '3') return h.age === 3;
    if (r.ages === '3+') return h.age >= 3;
    return h.age >= 4;
  },

  // 重賞の出走に必要な勝利数（優先出走権があれば不要）
  gradedMinWins(r) {
    if (r.ages === '2') return 1;
    if (r.ages === '3') return r.grade === 'g1' ? 2 : 1;
    return r.grade === 'g1' ? 4 : 3;
  },

  eligibility(h, race, opts = {}) {
    const w = h.record.wins;
    if (Horse.mustRetire(h)) return { ok: false, reason: '引退の時期です' };
    if (!opts.ignoreActed && Horse.acted(h)) return { ok: false, reason: '今週は行動済み' };
    if (race.female && h.gender !== 'female') return { ok: false, reason: '牝馬限定' };
    if (!this.ageOk(h, race)) return { ok: false, reason: `${this.AGE_LABEL[race.ages]}限定` };
    if (race.kind === 'graded') {
      const need = this.gradedMinWins(race);
      const right = (h.rights || []).includes(race.id);
      const olderG1 = race.ages !== '2' && race.ages !== '3' && race.grade === 'g1';
      const open = olderG1 ? this.isOpen(h) : w >= need || this.isOpen(h);
      if (!right && !open) {
        return { ok: false, reason: `${need}勝以上${race.ages === '3' && race.grade === 'g1' ? 'か優先出走権' : ''}が必要（あと${Math.max(1, need - w)}勝）`, needWins: true };
      }
    } else {
      const g = race.grade;
      if (g === 'debut' && h.record.races > 0) return { ok: false, reason: 'デビュー前の馬だけ' };
      if (g === 'maiden' && w > 0) return { ok: false, reason: '勝ち上がり済み' };
      const max = { cond: 1, c2: 2, c3: 3 }[g];
      if (max !== undefined && (w > max || this.isOpen(h))) return { ok: false, reason: 'クラスが上です' };
      if (g === 'op' && w < 2 && !this.isOpen(h)) return { ok: false, reason: '2勝以上で出走可' };
    }
    if (!opts.ignoreFatigue && h.fatigue >= 80) return { ok: false, reason: '疲れすぎ。休ませよう' };
    return { ok: true, right: (h.rights || []).includes(race.id) };
  },

  // 適性（距離＋馬場）
  fit(h, race) { return h.aptitude[Horse.distCat(race.distance)] + h.aptitude[race.surface]; },

  // 今週出られるレースの中のおすすめ（適性の合うものから格の高いもの）
  nextRace(h) {
    const ok = this.weekRaces().filter(r => this.eligibility(h, r, { ignoreActed: true, ignoreFatigue: true }).ok);
    if (!ok.length) return null;
    const bestFit = Math.max(...ok.map(r => this.fit(h, r)));
    const suitable = ok.filter(r => this.fit(h, r) >= bestFit - 25);
    return suitable.reduce((a, b) => {
      const d = this.gradeInfo(b).order - this.gradeInfo(a).order;
      return d > 0 || (d === 0 && this.fit(h, b) > this.fit(h, a)) ? b : a;
    });
  },

  // 目標レース：今後 horizon 週の重賞から、出走できて適性の合うもの
  targetRace(h, horizon = 12) {
    const list = this.gradedAll()
      .map(r => ({ race: r, weeks: Calendar.until(r.week) }))
      .filter(x => x.weeks <= horizon && this.fit(h, x.race) >= 130)
      .filter(x => {
        // 年をまたぐ場合は年齢が1つ上がる
        const age = h.age + (Calendar.get().week + x.weeks >= Calendar.W ? 1 : 0);
        return this.eligibility(Object.assign({}, h, { age }), x.race, { ignoreActed: true, ignoreFatigue: true }).ok;
      });
    if (!list.length) return null;
    return list.reduce((a, b) => {
      const sa = this.gradeInfo(a.race).order * 10 + this.fit(h, a.race) / 20 - a.weeks * 0.4;
      const sb = this.gradeInfo(b.race).order * 10 + this.fit(h, b.race) / 20 - b.weeks * 0.4;
      return sb > sa ? b : a;
    });
  },

  // 若い馬限定のレースは相手も若い（少し弱い）
  ageAdjust(race) {
    if (race.kind !== 'graded' && race.grade !== 'op') return 0;
    if (race.ages === '2') return -8;
    if (race.ages === '3') return race.m <= 5 ? -4 : -2;
    return 0;
  },

  // ── 出走馬を作る ──
  makeNpc(race) {
    const base = this.gradeInfo(race).npc + this.ageAdjust(race);
    const cat = Horse.distCat(race.distance);
    const stats = {};
    STAT_KEYS.forEach(k => { stats[k] = base + Util.gauss() * this.NPC_VARIANCE; });
    if (cat === 'sprint') { stats.speed += 3; stats.power += 3; stats.stamina -= 6; }
    if (cat === 'long') { stats.stamina += 8; stats.speed -= 2; }
    if (cat === 'classic') { stats.stamina += 4; }
    STAT_KEYS.forEach(k => { stats[k] = Math.round(Util.clamp(stats[k], 25, 120)); });

    const aptitude = {};
    DIST_KEYS.forEach(k => { aptitude[k] = Util.randInt(20, 80); });
    aptitude.turf = Util.randInt(20, 80);
    aptitude.dirt = Util.randInt(20, 80);
    aptitude[cat] = Util.randInt(70, 100);
    aptitude[race.surface] = Util.randInt(70, 100);

    const runningStyle = Util.weighted({ nige: 18, senko: 32, sashi: 32, oikomi: 18 });
    const skillCount = { debut: 0, maiden: Math.random() < 0.4 ? 1 : 0, cond: 1, c2: 1, c3: Util.randInt(1, 2), op: Util.randInt(1, 2), g3: Util.randInt(1, 2), g2: 2, g1: Util.randInt(2, 3) }[race.grade];
    const pool = GAME_DATA.skills.filter(s => (!s.style || s.style === runningStyle) && s.rarity !== 'UR');
    const skills = [];
    while (skills.length < skillCount && pool.length) {
      const s = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      skills.push(s.id);
    }
    return {
      id: Util.uid('npc_'), name: Horse.randomName(), isPlayer: false,
      stats, aptitude, runningStyle, skills,
      condition: Util.randInt(55, 100), fatigue: Util.randInt(0, 20)
    };
  },

  buildField(h, race) {
    const entrants = [{
      id: h.id, name: h.name, isPlayer: true,
      stats: Object.assign({}, h.stats), aptitude: Object.assign({}, h.aptitude),
      runningStyle: h.runningStyle, skills: h.skills.slice(),
      condition: h.condition, fatigue: h.fatigue
    }];
    const used = new Set([h.name]);
    while (entrants.length < race.field) {
      const npc = this.makeNpc(race);
      if (used.has(npc.name)) continue;
      used.add(npc.name);
      entrants.push(npc);
    }
    // 枠順をシャッフル
    for (let i = entrants.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entrants[i], entrants[j]] = [entrants[j], entrants[i]];
    }
    return entrants;
  },

  // 馬場状態：梅雨（6〜7月）は雨が多く、馬場が重くなりやすい
  rollGround(race) {
    const m = race.m || Calendar.month(Calendar.get().week);
    const rainy = m === 6 || m === 7 ? 1.8 : m === 9 ? 1.3 : 1;
    const table = {};
    GAME_DATA.grounds.forEach(g => {
      const w = race.surface === 'dirt' ? g.weight + (g.key ? 5 : 0) : g.weight;
      table[g.key] = g.key ? w * rainy : w;
    });
    return Number(Util.weighted(table));
  },

  // ── レース計算（表示とは独立） ──
  simulate(race, entrants, ground) {
    const D = race.distance;
    const distCat = Horse.distCat(D);
    if (ground === undefined) ground = this.rollGround(race);
    const finalStart = D - Math.min(400, D * 0.3);
    const cornerStart = finalStart - Math.max(300, D * 0.15);
    const startEnd = Math.max(200, D * 0.15);
    const phaseAt = pos => (pos < startEnd ? 'start' : pos < cornerStart ? 'mid' : pos < finalStart ? 'corner' : 'final');
    // 脚質補正は距離に依存しないよう、進んだ割合で区間を決める
    const stylePhaseAt = pos => {
      const p = pos / D;
      return p < 0.15 ? 'start' : p < 0.6 ? 'mid' : p < 0.75 ? 'corner' : 'final';
    };

    const runners = entrants.map((e, gate) => {
      const s = e.stats;
      const aptMul = (0.93 + 0.07 * e.aptitude[distCat] / 100) * (0.96 + 0.04 * e.aptitude[race.surface] / 100);
      const groundMul = 1 - ground * 0.006 * (1 - Math.min(s.power, 120) / 130);
      const condMul = (0.98 + 0.02 * e.condition / 100) * (1 - 0.025 * e.fatigue / 100);
      const form = 1 + Util.gauss() * 0.004 * (1.2 - s.intelligence / 250);
      const skills = e.skills.map(id => Skills.get(id)).filter(Boolean)
        .sort((a, b) => Skills.priority(b) - Skills.priority(a));
      const maxHp = 300 + s.stamina * 22 + s.guts * 4;
      return {
        e, gate, pos: 0, v: 0, hp: maxHp, maxHp,
        mul: aptMul * groundMul * condMul * form,
        skills, usedSkills: new Set(), active: [],
        finished: false, time: null, exhaustedLogged: false
      };
    });

    const events = [];
    const frames = [];
    const say = (t, text, extra) => events.push(Object.assign({ t: Math.round(t * 10) / 10, type: 'text', text }, extra));
    const order = () => runners.slice().sort((a, b) => (a.finished && b.finished ? a.time - b.time : b.pos - a.pos));
    const snapshot = () => order().map(r => r.e.id);
    const lengthsBehind = (lead, r) => Math.max(0, (lead.pos - r.pos) / 2.4);
    const checkpointsDone = new Set();
    const checkpoint = (key, label, t, text) => {
      if (checkpointsDone.has(key)) return;
      checkpointsDone.add(key);
      const o = order();
      events.push({
        t: Math.round(t * 10) / 10, type: 'checkpoint', key, label, text,
        order: o.map(r => r.e.id),
        gaps: o.map(r => Math.round(lengthsBehind(o[0], r) * 10) / 10)
      });
    };
    const name = r => r.e.name;

    checkpoint('start', 'スタート', 0, `${race.name}、各馬いっせいにスタート！`);
    let t = 0, lastLeader = null, nextFrame = 0;
    const maxT = D / 8;
    while (runners.some(r => !r.finished) && t < maxT) {
      const ranked = order();
      const leaderPos = ranked[0].pos;

      // ── 実況のチェックポイント（先頭の位置で判定） ──
      if (leaderPos >= Math.min(150, D * 0.1)) {
        const r0 = ranked[0];
        checkpoint('early', '序盤', t, `${name(r0)}がハナを切りました。2番手に${name(ranked[1])}。`);
      }
      if (leaderPos >= cornerStart * 0.6 && D >= 1400) {
        checkpoint('mid', '中盤', t, `中盤に入って先頭は${name(ranked[0])}、2番手に${name(ranked[1])}。`);
      }
      if (D - leaderPos <= 800 && D >= 1400) {
        checkpoint('r800', '残り800m', t, `残り800m！ 各馬が動き始めた！`);
      }
      if (leaderPos >= cornerStart) {
        const movers = ranked.filter(r => (r.e.runningStyle === 'sashi' || r.e.runningStyle === 'oikomi')).slice(0, 2);
        checkpoint('corner', '第4コーナー', t, movers.length
          ? `第4コーナー！ ${movers.map(name).join('、')}が外から進出！`
          : '第4コーナーを回って直線へ！');
      }
      if (D - leaderPos <= 400) checkpoint('r400', '残り400m', t, `残り400m！ 最後の直線！`);
      if (D - leaderPos <= 200) {
        const a = ranked[0], b = ranked[1];
        const close = a.pos - b.pos < 2.4;
        checkpoint('r200', '残り200m', t, close ? `残り200m！ ${name(a)}と${name(b)}の叩き合い！` : `残り200m！ ${name(a)}が抜け出した！`);
      }

      // 最終直線での先頭交代
      if (lastLeader && ranked[0] !== lastLeader && phaseAt(leaderPos) === 'final' && !ranked[0].finished) {
        say(t, `${name(ranked[0])}が先頭に立った！`, { horseId: ranked[0].e.id });
      }
      lastLeader = ranked[0];

      // ── 各馬の移動 ──
      ranked.forEach((r, idx) => {
        if (r.finished) return;
        const s = r.e.stats;
        const phase = phaseAt(r.pos);
        const rank = idx + 1;
        const remain = D - r.pos;

        // スキル判定（1刻みにつき1つまで、優先順位順）
        const neighbor = ranked.some(o => o !== r && !o.finished && Math.abs(o.pos - r.pos) < 1.5);
        const ctx = { phase, remain, rank, distCat, ground, close: phase === 'final' && neighbor };
        for (const sk of r.skills) {
          if (r.usedSkills.has(sk.id) || !Skills.conditionMet(sk, ctx)) continue;
          if (Math.random() > Skills.activationChance(s.intelligence) * this.DT) continue;
          r.usedSkills.add(sk.id);
          const eff = Skills.effectFor(sk, r.e.runningStyle);
          if (eff.hp) r.hp = Math.min(r.maxHp, r.hp + eff.hp);
          if (eff.speed) r.active.push({ speed: eff.speed, until: t + eff.duration });
          events.push({
            t: Math.round(t * 10) / 10, type: 'skill', horseId: r.e.id, isPlayer: r.e.isPlayer,
            skillId: sk.id, text: `${sk.icon}「${sk.name}」発動！`, sub: `${name(r)} ${eff.speed ? '加速！' : '体力回復！'}`,
            matched: Skills.isMatch(sk, r.e.runningStyle)
          });
          break;
        }
        r.active = r.active.filter(a => a.until > t);
        const skillMul = 1 + this.SKILL_SCALE * r.active.reduce((sum, a) => sum + a.speed, 0);

        // 目標速度
        let base = 16 + s.speed * 0.012;
        if (phase === 'final') base = 16 + s.speed * 0.0135 + s.guts * 0.0015;
        let target = base * this.styleMult[r.e.runningStyle][stylePhaseAt(r.pos)] * r.mul * skillMul;
        target *= 1 + Util.gauss() * 0.002;
        let costMul = 1;
        if (phase === 'final' && r.hp > 0) {
          target *= 1.02 + s.guts * 0.0001; // ラストスパート
          costMul = 1.4;
        }
        if (r.hp <= 0) {
          target *= 0.93 + s.guts * 0.0003; // バテた
          if (!r.exhaustedLogged && phase !== 'start') {
            r.exhaustedLogged = true;
            if (r.e.isPlayer || rank <= 3) say(t, `${name(r)}、苦しくなった！`, { horseId: r.e.id, isPlayer: r.e.isPlayer });
          }
        }

        // 加速（パワー）
        const accel = Math.min(1, (0.3 + s.power * 0.004) * this.DT);
        r.v += (target - r.v) * accel;
        const move = r.v * this.DT;
        r.hp -= move * 0.75 * Math.pow(r.v / 16.5, 2) * costMul * this.styleCost[r.e.runningStyle];
        const prev = r.pos;
        r.pos += move;
        if (r.pos >= D) {
          r.finished = true;
          r.time = t + this.DT * ((D - prev) / (r.pos - prev));
          r.pos = D;
        }
      });

      t += this.DT;
      if (t >= nextFrame) {
        frames.push({ t, pos: runners.map(r => Math.round(r.pos * 10) / 10) });
        nextFrame += this.FRAME_INTERVAL;
      }
    }

    // ── 着順 ──
    const final = runners.slice().sort((a, b) => (a.time ?? 1e9) - (b.time ?? 1e9));
    const winner = final[0];
    const finish = final.map((r, i) => {
      const prev = final[i - 1];
      return {
        id: r.e.id, name: r.e.name, isPlayer: r.e.isPlayer, place: i + 1,
        style: r.e.runningStyle,
        time: r.time,
        margin: prev ? this.marginText((r.time - prev.time) * r.v / 2.4) : ''
      };
    });
    const second = final[1];
    const goalText = second && second.time - winner.time < 0.08
      ? `${name(winner)}、${name(second)}をわずかに抑えてゴール！`
      : `${name(winner)}、先頭でゴールイン！`;
    checkpoint('goal', 'ゴール', winner.time, goalText);

    return {
      raceId: race.id, name: race.name, grade: race.grade, distance: D, surface: race.surface,
      distCat, ground,
      entrants: runners.map(r => ({ id: r.e.id, name: r.e.name, owner: r.e.owner || '', isPlayer: r.e.isPlayer, isGhost: !!r.e.isGhost, style: r.e.runningStyle, gate: r.gate + 1 })),
      finish, events: events.sort((a, b) => a.t - b.t), frames,
      phases: { startEnd, cornerStart, finalStart }
    };
  },

  marginText(lengths) {
    if (lengths < 0.08) return 'ハナ';
    if (lengths < 0.2) return 'アタマ';
    if (lengths < 0.35) return 'クビ';
    if (lengths > 10) return '大差';
    const half = Math.round(lengths * 4) / 4;
    const whole = Math.floor(half);
    const frac = { 0: '', 0.25: '1/4', 0.5: '1/2', 0.75: '3/4' }[half - whole];
    return whole ? `${whole}${frac ? ' ' + frac : ''}馬身` : `${frac}馬身`;
  },

  timeText(sec) {
    const m = Math.floor(sec / 60);
    const s = (sec - m * 60).toFixed(1);
    return `${m}:${s.padStart(4, '0')}`;
  },

  // ── 報酬（結果をプレイヤーデータへ反映） ──
  PRIZE_RATE: [1, 0.4, 0.25, 0.15, 0.1],

  applyResult(h, race, result) {
    const me = result.finish.find(f => f.isPlayer);
    const place = me.place;
    const g = this.gradeInfo(race);
    const prize = Math.round((race.prize || g.prize) * (this.PRIZE_RATE[place - 1] || 0));
    const exp = Math.round(g.exp * (place === 1 ? 1.5 : place <= 3 ? 1.1 : 0.7));

    const rec = h.record;
    rec.races++;
    if (place === 1) rec.wins++;
    if (place === 2) rec.seconds++;
    if (place === 3) rec.thirds++;
    rec.prizeMoney += prize;
    const graded = ['g3', 'g2', 'g1'].includes(race.grade);
    if (place === 1 && graded) rec.gradedWins++;
    if (place === 1 && race.grade === 'g1') rec.g1Wins++;
    const cal = Calendar.get();
    h.history.unshift({
      raceId: race.id, name: race.name, grade: race.grade, distance: race.distance, surface: race.surface,
      venue: race.venue, place, field: result.finish.length, age: h.age, ground: result.ground,
      year: cal.year, week: cal.week, prize
    });
    // トライアルで上位なら本番の優先出走権
    h.rights = (h.rights || []).filter(id => id !== race.id);
    let rightTo = null;
    if (race.trial && place <= race.trial.top) {
      rightTo = this.get(race.trial.to);
      if (rightTo && !h.rights.includes(rightTo.id)) h.rights.push(rightTo.id);
    }
    if (h.history.length > 40) h.history.length = 40;

    Player.addMoney(prize);
    Player.bump('raceCount');
    if (place === 1) Player.bump('winCount');
    if (graded) Player.bump('gradedRaceCount');
    if (race.grade === 'g1') Player.bump('g1RaceCount');
    if (race.grade === 'g1' && place === 1) Player.bump('g1WinCount');

    // カード報酬：1着は確定（GⅠは2枚）、2〜3着は50%（ひとつ下の格の確率表）
    const cards = [];
    const drawCount = place === 1 ? (race.grade === 'g1' ? 2 : 1) : place <= 3 && Math.random() < 0.5 ? 1 : 0;
    const gradeKeys = Object.keys(GAME_DATA.grades);
    const dropGrade = place === 1 ? race.grade : gradeKeys[Math.max(0, gradeKeys.indexOf(race.grade) - 1)];
    for (let i = 0; i < drawCount; i++) {
      const c = Cards.drawReward(dropGrade);
      const isNew = !Player.data.seenCards.includes(c.id);
      Player.addCard(c.id);
      cards.push({ card: c, isNew });
    }

    // 疲労・調子・成長
    h.fatigue = Util.clamp(h.fatigue + 18 + race.distance / 200, 0, 100);
    Horse.act(h);
    const birthday = false;
    h.condition = Util.clamp(h.condition + (place === 1 ? 10 : place <= 3 ? 3 : -4), 0, 100);
    const levelUps = Horse.addExp(h, exp);

    // コースレコード（自分の馬の最速タイム）
    const records = Player.data.records;
    const prevRec = records[race.id];
    const newRecord = !prevRec || me.time < prevRec.time;
    if (newRecord) {
      records[race.id] = { time: me.time, name: h.name, place, at: Date.now(),
        raceName: race.name, grade: race.grade, distance: race.distance, surface: race.surface };
    }

    return { place, prize, exp, cards, levelUps, birthday, field: result.finish.length, newRecord: newRecord && !!prevRec, rightTo };
  }
};
