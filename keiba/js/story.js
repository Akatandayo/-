// 騎手・ライバル・個性・勝利インタビュー・思い出アルバム
// レースの数値計算は race.js（Race.simulate）が行い、ここは「誰が乗るか」「誰と戦うか」と物語の部分を受け持つ。
'use strict';

// ───────── 騎手 ─────────
const Jockeys = {
  RANK_COLOR: { S: '#c98a00', A: '#c0392b', B: '#2563eb', C: '#6b7280' },
  STAKE: 0.05,   // 勝ったときの進上金（賞金の5%）

  get(id) { return GAME_DATA.jockeys.find(j => j.id === id); },

  unlocked(j) {
    const u = j.unlock;
    if (!u) return true;
    const st = Player.data.stats;
    return (!u.wins || st.winCount >= u.wins) && (!u.g1Wins || st.g1WinCount >= u.g1Wins);
  },
  unlockText(j) {
    const u = j.unlock || {};
    return u.g1Wins ? `厩舎でGⅠ ${u.g1Wins}勝` : u.wins ? `厩舎で通算${u.wins}勝` : '';
  },

  // 馬の主戦騎手（使えなければ無料の見習い騎手）
  defaultFor(h) {
    const j = this.get(h.jockey);
    return j && this.unlocked(j) ? j.id : 'j_haruno';
  },

  // レース用の騎手データ（コンビ回数つき）
  entry(h, id) {
    const j = this.get(id) || this.get('j_haruno');
    return { id: j.id, name: j.name, skill: j.skill, style: j.style, trait: j.trait, combo: h && h.rides ? h.rides[j.id] || 0 : 0 };
  },

  stats(id) {
    const p = Player.data;
    if (!p.jockeyStats) p.jockeyStats = {};
    if (!p.jockeyStats[id]) p.jockeyStats[id] = { rides: 0, wins: 0, g1Wins: 0 };
    return p.jockeyStats[id];
  },

  // レース後：コンビ回数・主戦・騎手成績
  afterRace(h, id, place, grade) {
    if (!h.rides) h.rides = {};
    h.rides[id] = (h.rides[id] || 0) + 1;
    h.jockey = id;
    const s = this.stats(id);
    s.rides++;
    if (place === 1) { s.wins++; if (grade === 'g1') s.g1Wins++; }
  },

  comboLabel(n) { return n >= 5 ? '名コンビ' : n >= 3 ? '息ぴったり' : n >= 1 ? `${n}回目のコンビ` : '初コンビ'; },

  // 作戦選びと並べて出す騎手の選択
  picker(h, opts = {}) {
    const st = UI.state;
    st.jockeyCtx = { hid: h.id, free: !!opts.free };
    if (!this.get(st.jockey)) st.jockey = this.defaultFor(h);
    const cur = this.get(st.jockey);
    const tr = GAME_DATA.jockeyTraits[cur.trait];
    const rides = (h.rides || {})[cur.id] || 0;
    return `<div class="jockey-pick"><h4>🏇 騎手 ${UI.help('jockey')}</h4>
      <div class="chips">${GAME_DATA.jockeys.map(j => {
        const ok = this.unlocked(j);
        return `<button class="${st.jockey === j.id ? 'active' : ''} ${ok ? '' : 'locked'}" ${ok ? `onclick="UI.setJockey('${j.id}')"` : 'disabled'} title="${ok ? Util.esc(j.desc) : '🔒 ' + this.unlockText(j)}">
          <span class="jr" style="background:${this.RANK_COLOR[j.rank]}">${j.rank}</span>${ok ? Util.esc(j.name) : '🔒'}${opts.free || !j.fee ? '' : `<small>${Util.money(j.fee)}</small>`}</button>`;
      }).join('')}</div>
      <p class="muted small" id="jockey-desc">${Util.esc(cur.name)}（技術 ${cur.skill}・得意 ${GAME_DATA.styles[cur.style].label}）「${tr.label}」${tr.desc}。${Util.esc(cur.desc)}
        ${rides ? `<b class="ok">🤝 ${this.comboLabel(rides)}</b>` : ''}${opts.free ? '' : `<br>騎乗料 ${Util.money(cur.fee)}・勝てば賞金の5%を進上金として支払います。`}</p></div>`;
  }
};

// ───────── 個性 ─────────
const Traits = {
  CONFLICT: [['rain', 'firm'], ['hill', 'flat'], ['tight', 'wide'], ['summer', 'winter']],
  random() {
    const r = Math.random();
    const n = r < 0.15 ? 0 : r < 0.75 ? 1 : 2;
    const ids = Object.keys(GAME_DATA.traits);
    const out = [];
    while (out.length < n) {
      const id = Util.pick(ids);
      if (out.includes(id) || this.CONFLICT.some(([a, b]) => (id === a && out.includes(b)) || (id === b && out.includes(a)))) continue;
      out.push(id);
    }
    return out;
  },
  // 配合：親（殿堂馬カード）の個性を受け継ぐことがある
  inherit(father, mother) {
    const out = this.random();
    [father, mother].forEach(c => {
      (c.traits || []).forEach(id => {
        if (Math.random() < 0.35 && !out.includes(id) && !this.CONFLICT.some(([a, b]) => (id === a && out.includes(b)) || (id === b && out.includes(a)))) out.push(id);
      });
    });
    return out.slice(0, 2);
  },
  // 馬の個性の表示（判明していないものは ？？？）
  html(h) {
    const all = h.traits || [];
    if (!all.length) return '<div class="trait-list"><span class="trait none">特になし（素直な馬）</span></div>';
    return `<div class="trait-list">${all.map(id => {
      const t = GAME_DATA.traits[id];
      return (h.traitsKnown || []).includes(id) ? `<span class="trait" title="${Util.esc(t.desc)}">${t.icon} ${t.label}<small>${t.desc}</small></span>`
        : '<span class="trait unknown">❔ ？？？<small>条件のレースを走ると判明</small></span>';
    }).join('')}</div>`;
  },
  // レース結果から新しく判明した個性
  reveal(h, hits) {
    if (!h.traitsKnown) h.traitsKnown = [];
    const found = (hits || []).filter(id => (h.traits || []).includes(id) && !h.traitsKnown.includes(id));
    found.forEach(id => h.traitsKnown.push(id));
    return found.map(id => GAME_DATA.traits[id]);
  }
};

// ───────── 宿命のライバル ─────────
const Rivals = {
  // 初めて重賞に出たときに現れる、同期のライバル
  create(h) {
    const styles = Object.keys(GAME_DATA.styles);
    const pool = GAME_DATA.skills.filter(s => !s.legendOnly && s.rarity !== 'UR');
    const style = Util.pick(styles);
    const skills = [];
    const sp = pool.filter(s => !s.style || s.style === style);
    while (skills.length < 2 && sp.length) skills.push(sp.splice(Math.floor(Math.random() * sp.length), 1)[0].id);
    let name;
    do { name = Horse.randomName(h.gender); } while (name === h.name);
    return {
      name, gender: h.gender, style, skills, traits: Traits.random(),
      owner: Util.pick(GAME_DATA.rivalOwners) + '厩舎', edge: Util.randInt(-5, -1),
      coat: Util.pick(['鹿毛', '黒鹿毛', '栗毛', '芦毛', '青鹿毛']),
      vs: { win: 0, lose: 0 }, met: 0, isNew: true
    };
  },

  // 自分の馬と同じくらい（少し上下）に成長する
  entrant(h, race) {
    const rv = h.rival;
    const cat = Horse.distCat(race.distance);
    const ov = Horse.overall(h);
    const stats = {};
    STAT_KEYS.forEach(k => { stats[k] = Math.round(Util.clamp(ov + rv.edge + (h.stats[k] - ov) * 0.4 + Util.gauss() * 2.5, 30, 125)); });
    const aptitude = { sprint: 60, mile: 60, classic: 60, long: 60, turf: 60, dirt: 60 };
    aptitude[cat] = 92;
    aptitude[race.surface] = 92;
    return {
      id: Util.uid('rv_'), name: rv.name, owner: '⚔ ' + rv.owner, isPlayer: false, isRival: true,
      stats, aptitude, runningStyle: rv.style, skills: rv.skills.slice(), traits: rv.traits || [],
      turn: '', order: Race.npcOrder(rv.style), coat: rv.coat,
      jockey: { skill: 82, name: 'ライバルの騎手' },
      condition: Util.randInt(70, 95), fatigue: 0
    };
  },

  shouldAppear(h, race) {
    if (race.kind !== 'graded') return false;
    if (race.female && h.gender !== 'female') return false;
    if (!h.rival) h.rival = this.create(h);
    return h.rival.isNew || Math.random() < (race.grade === 'g1' ? 0.6 : 0.35);
  },

  applyResult(h, result) {
    const rf = result.finish.find(f => f.isRival);
    if (!rf || !h.rival) return null;
    const me = result.finish.find(f => f.isPlayer);
    const rv = h.rival;
    const first = rv.isNew;
    rv.isNew = false;
    rv.met++;
    const won = me.place < rf.place;
    rv.vs[won ? 'win' : 'lose']++;
    return { name: rv.name, owner: rv.owner, won, first, place: rf.place, vs: Object.assign({}, rv.vs) };
  }
};

// ───────── 勝利騎手インタビュー・表彰式・アルバム ─────────
const Story = {
  // レース内容から騎手のコメントを作る
  interview(result, me, jockeyName, rival) {
    const lines = [];
    const fin = result.finish;
    const margin = fin[1] ? fin[1].margin : '';
    const style = me.style;
    const inc = result.events.filter(e => e.type === 'incident' && e.isPlayer).map(e => e.kind);
    if (me.place === 1) {
      if (inc.includes('late')) lines.push('スタートで出遅れて焦りましたが、馬が最後まであきらめずに走ってくれました。');
      else if (inc.includes('kakari')) lines.push('道中は掛かってしまいましたが、なんとか我慢してくれました。');
      else if (inc.includes('block')) lines.push('直線で前が壁になった時はダメかと思いましたが、進路が開いてからの脚がすごかったです。');
      else if (style === 'nige') lines.push('自分のペースで行けたのが一番。最後まで脚色は衰えませんでした。');
      else if (style === 'senko') lines.push('いい位置が取れて、直線では手応え十分でした。');
      else if (style === 'sashi') lines.push('道中はじっくり脚をためて、直線でよく伸びてくれました。');
      else lines.push('後ろからでも届くと信じていました。最後の末脚は本物です！');
      if (margin === 'ハナ' || margin === 'アタマ' || margin === 'クビ') lines.push('ゴール前はしびれました。本当に勝負根性のある馬です。');
      else if (/大差|[5-9]馬身/.test(margin)) lines.push('着差以上の完勝。まだまだ強くなりますよ。');
      if (me.pop >= 6) lines.push('人気はありませんでしたが、この馬の力を信じていました。');
      else if (me.pop === 1) lines.push('1番人気に応えられてホッとしています。');
      if (rival && rival.won) lines.push(`ライバルの${rival.name}に勝てたのは大きいですね。`);
      if (result.grade === 'g1') lines.push('GⅠの舞台で勝てて最高の気分です。応援ありがとうございました！');
    } else if (me.place <= 3) {
      lines.push(inc.length ? 'レース中のアクシデントが響きました。力は見せてくれたと思います。' : 'よく頑張ってくれました。あと一歩でしたね。');
      if (rival && !rival.won) lines.push(`${rival.name}は手強い相手です。次こそは。`);
    } else {
      lines.push(inc.length ? '今日は流れに乗れませんでした。' : '今日は相手が強かったです。');
      lines.push(me.last3f && fin.filter(f => f.last3f && f.last3f < me.last3f).length < 3 ? '最後の脚は使えているので、展開ひとつです。' : '調教でもう少し鍛えれば、もっとやれるはずです。');
    }
    return { jockey: jockeyName, text: lines.join('') };
  },

  // GⅠ勝利の記念写真をアルバムに残す
  addAlbum(h, race, result, me, jockeyName, comment) {
    const p = Player.data;
    if (!p.album) p.album = [];
    const cal = Calendar.get();
    const entry = {
      id: Util.uid('al_'), horseId: h.id, horseName: h.name, raceName: race.name, grade: race.grade,
      venue: race.venue || '', distance: race.distance, surface: race.surface,
      year: cal.year, week: cal.week, time: me.time, margin: (result.finish[1] || {}).margin || '',
      pop: me.pop, jockey: jockeyName, comment, at: Date.now()
    };
    p.album.unshift(entry);
    if (p.album.length > 60) p.album.length = 60;
    return entry;
  },

  photoCard(a) {
    return `<div class="album-card">
      <div class="album-photo">${typeof Portrait !== 'undefined' ? Portrait.slot({ key: 'h:' + a.horseId, id: a.horseId, name: a.horseName, isPlayer: true }, '🏇') : '🏇'}<span class="trophy">🏆</span></div>
      <div class="album-info">${UI.gradeBadge(a.grade)} <b>${Util.esc(a.raceName)}</b>
        <div>${Util.esc(a.horseName)}${a.jockey ? `<small>（騎手：${Util.esc(a.jockey)}）</small>` : ''}</div>
        <small class="muted">${a.year}年目 ${Calendar.label(a.week)}・${Util.esc(a.venue)} ${a.surface === 'turf' ? '芝' : 'ダート'}${a.distance}m・${Race.timeText(a.time)}${a.margin ? '・' + Util.esc(a.margin) + '差' : ''}${a.pop ? '・' + a.pop + '番人気' : ''}</small>
        ${a.comment ? `<p class="album-comment">「${Util.esc(a.comment)}」</p>` : ''}</div></div>`;
  },

  // ペース判定（前半と後半の比較）
  pace(laps) {
    if (!laps || laps.length < 4) return null;
    const full = laps.slice(1);   // 最初の端数区間は除く
    const half = Math.floor(full.length / 2);
    const a = full.slice(0, half).reduce((s, v) => s + v, 0) / half;
    const b = full.slice(full.length - half).reduce((s, v) => s + v, 0) / half;
    const d = b - a;
    return d > 0.25 ? { key: 'H', label: 'ハイペース', desc: '前半が速く、差し・追込に向いた流れ' }
      : d < -0.25 ? { key: 'S', label: 'スローペース', desc: '前半がゆっくりで、前に行った馬に向いた流れ' }
        : { key: 'M', label: 'ミドルペース', desc: '平均的な流れ' };
  }
};
