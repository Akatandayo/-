// 画面描画（ゲームロジックは持たない。操作は App.* を呼ぶ）
'use strict';

const UI = {
  state: {
    screen: 'home',
    params: {},
    horseTab: 'status',
    breed: { father: null, mother: null },
    cardTab: 'owned',
    cardType: 'all',
    cardRarity: 'all',
    cardQuery: '',
    raceHorse: null,
    raceRoute: null,
    raceMode: 'week',
    calMonth: null,
    calRoute: 'all',
    showAllRaces: false,
    league: 'bronze',
    friendPick: [],
    friendCourse: 1,
    friendCap: 0,
    customSpec: null,
    joinCode: ''
  },

  el(id) { return document.getElementById(id); },

  show(screen, params = {}) {
    this.state.screen = screen;
    this.state.params = params;
    if (typeof RaceView !== 'undefined' && screen !== 'raceView') {
      RaceView.stop();
      if (typeof Race3D !== 'undefined') Race3D.unmount();
    }
    this.render();
    window.scrollTo(0, 0);
  },

  render() {
    const s = this.state.screen;
    this.renderHeader();
    const views = {
      home: () => this.homeView(),
      stable: () => this.stableView(),
      horse: () => this.horseView(this.state.params.id),
      cards: () => this.cardsView(),
      breed: () => this.breedView(),
      race: () => this.raceView(),
      hof: () => this.hofView(),
      records: () => this.recordsView(),
      raceView: () => RaceView.view()
    };
    const main = this.el('main');
    main.innerHTML = (views[s] || views.home)();
    if (this._lastScreen !== s) { main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter'); }
    this._lastScreen = s;
    const navKey = { horse: 'stable', hof: 'home', records: 'home', raceView: 'race' }[s] || s;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === navKey));
    this.navBadges();
    if (s === 'raceView') RaceView.mount();
    else Portrait.hydrate();
  },

  renderHeader() {
    const p = Player.data;
    const cardCount = Object.values(p.cards).reduce((a, b) => a + b, 0);
    this.el('topbar').innerHTML = `
      <div class="brand" onclick="UI.show('home')">🐎🃏 <span>馬主カード</span></div>
      <div class="wallet">
        <span class="chip date-chip" title="カレンダー" onclick="UI.state.raceMode='calendar';UI.state.calMonth=null;UI.show('race')">📅 ${Calendar.fullLabel()}</span>
        <span class="chip" title="所持金">💰 ${Util.money(p.money)}</span>
        <span class="chip" title="所持カード">🃏 ${cardCount}</span>
      </div>`;
  },

  // ─────────── 共通パーツ ───────────
  help(key) { return `<button class="help" onclick="event.stopPropagation();App.help('${key}')" aria-label="用語解説">？</button>`; },

  rarity(r) { return `<span class="rar rar-${r}">${r}</span>`; },

  gradeBadge(grade) {
    const g = GAME_DATA.grades[grade];
    return `<span class="grade grade-${grade}">${g.short}</span>`;
  },

  styleTag(style) {
    const s = GAME_DATA.styles[style];
    return `<span class="tag">${s.icon} ${s.label}</span>`;
  },

  statRow(key, value, cap) {
    const info = GAME_DATA.stats.find(s => s.key === key);
    const pct = Util.clamp(value / 120 * 100, 0, 100);
    const capPct = cap !== undefined ? Util.clamp(cap / 120 * 100, 0, 100) : null;
    return `<div class="stat-row">
      <div class="stat-label">${info.icon} ${info.label}${this.help(key)}</div>
      <div class="bar"><div class="bar-fill stat-${key}" style="width:${pct}%"></div>
        ${capPct !== null ? `<div class="bar-cap" style="left:${capPct}%" title="限界"></div>` : ''}</div>
      <div class="stat-val"><b>${value}</b>${cap !== undefined ? `<small>/${cap}</small>` : ''} <span class="g">${Util.grade(value)}</span></div>
    </div>`;
  },

  // 能力のレーダーチャート（実線：今の能力、点線：限界）
  radar(stats, caps) {
    const R = 70, cx = 100, cy = 92;
    const pt = (i, v) => {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      const r = Util.clamp(v / 120, 0, 1) * R;
      return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
    };
    const poly = vals => STAT_KEYS.map((k, i) => pt(i, vals[k])).join(' ');
    const grid = [0.25, 0.5, 0.75, 1].map(f => `<polygon points="${STAT_KEYS.map((k, i) => pt(i, 120 * f)).join(' ')}" class="rg"/>`).join('');
    const labels = GAME_DATA.stats.map((s, i) => {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      return `<text x="${(cx + Math.cos(a) * (R + 16)).toFixed(1)}" y="${(cy + Math.sin(a) * (R + 14) + 4).toFixed(1)}" text-anchor="middle">${s.icon}${stats[s.key]}</text>`;
    }).join('');
    return `<svg class="radar" viewBox="0 0 200 184" role="img" aria-label="能力チャート">${grid}
      ${caps ? `<polygon points="${poly(caps)}" class="rc"/>` : ''}<polygon points="${poly(stats)}" class="rs"/>${labels}</svg>`;
  },

  aptGrid(apt, turn) {
    const d = GAME_DATA.distances.map(x => `<div class="apt"><span>${x.label}</span><b>${Util.stars(apt[x.key])}</b><small>${Util.aptMark(apt[x.key])}</small></div>`).join('');
    const s = GAME_DATA.surfaces.map(x => `<div class="apt"><span>${x.icon}${x.label}</span><b>${Util.stars(apt[x.key])}</b><small>${Util.aptMark(apt[x.key])}</small></div>`).join('');
    return `<div class="apt-title">距離${this.help('distance')}</div><div class="apt-grid">${d}</div>
      <div class="apt-title">馬場${this.help('surface')}</div><div class="apt-grid">${s}</div>
      ${turn !== undefined ? `<div class="apt-title">回り${this.help('turn')}</div><div class="turn-pref">🔄 ${Horse.turnLabel(turn)}</div>` : ''}`;
  },

  // 種牡馬・繁殖牝馬カード
  breedCard(c, opts = {}) {
    const t = Cards.types[c.type];
    const st = GAME_DATA.stats.map(s => `<div class="mini-stat"><span>${s.icon}</span><b>${Util.stars(c.stats[s.key])}</b></div>`).join('');
    const apt = [...GAME_DATA.surfaces, ...GAME_DATA.distances]
      .map(x => `<span class="apt-chip">${x.label || x.key}${Util.aptMark(c.apt[x.key])}</span>`).join('');
    const trait = c.trait === 'balance' ? 'バランス' : (GAME_DATA.stats.find(s => s.key === c.trait) || {}).label;
    const skill = c.skill ? Cards.get(c.skill) : null;
    return `<div class="gcard ${t.color} rcard-${c.rarity} ${opts.selected ? 'selected' : ''} ${opts.cls || ''}" ${opts.onclick ? `onclick="${opts.onclick}"` : ''}>
      <div class="gcard-head">${this.rarity(c.rarity)}<span class="gtype">${t.icon} ${t.label}</span>${opts.count ? `<span class="count">×${opts.count}</span>` : ''}</div>
      ${(() => {
        const photo = c.legend ? Legends.photoUrl(c.legendId) : null;
        return photo ? `<div class="gcard-art photo"><img src="${photo}" alt="${Util.esc(c.name)}" loading="lazy"><span class="legend">👑</span></div>`
          : `<div class="gcard-art ${c.type}">${Portrait.slot(Portrait.forCard(c), c.type === 'sire' ? '🐎' : '🐴')}${c.custom ? '<span class="legend">🏛</span>' : c.legend ? '<span class="legend">👑</span>' : ''}</div>`;
      })()}
      <div class="gcard-name">${Util.esc(c.name)}</div>
      <div class="mini-stats">${st}</div>
      <div class="apt-chips">${apt}</div>
      <div class="gcard-foot">${GAME_DATA.styles[c.style].icon}${GAME_DATA.styles[c.style].label}・遺伝：${trait}${skill ? `<br>🎴 ${skill.name}` : ''}</div>
    </div>`;
  },

  skillCard(c, opts = {}) {
    const style = c.style ? `${GAME_DATA.styles[c.style].icon}${GAME_DATA.styles[c.style].label}向け` : '全脚質OK';
    return `<div class="gcard skill rcard-${c.rarity} ${opts.cls || ''}" ${opts.onclick ? `onclick="${opts.onclick}"` : ''}>
      <div class="gcard-head">${this.rarity(c.rarity)}<span class="gtype">🎴 スキル</span>${opts.count ? `<span class="count">×${opts.count}</span>` : ''}</div>
      <div class="gcard-art">${c.icon}</div>
      <div class="gcard-name">${Util.esc(c.name)}</div>
      <div class="gcard-desc"><b>条件：</b>${c.condText}<br>${c.desc}</div>
      <div class="gcard-foot">${style}</div>
      ${opts.extra || ''}
    </div>`;
  },

  itemCard(c, opts = {}) {
    return `<div class="gcard item rcard-${c.rarity} ${opts.cls || ''}" ${opts.onclick ? `onclick="${opts.onclick}"` : ''}>
      <div class="gcard-head">${this.rarity(c.rarity)}<span class="gtype">🎒 アイテム</span>${opts.count ? `<span class="count">×${opts.count}</span>` : ''}</div>
      <div class="gcard-art">${c.icon}</div>
      <div class="gcard-name">${Util.esc(c.name)}</div>
      <div class="gcard-desc">${c.desc}</div>
      ${opts.extra || ''}
    </div>`;
  },

  anyCard(c, opts) {
    if (c.type === 'skill') return this.skillCard(c, opts);
    if (c.type === 'item') return this.itemCard(c, opts);
    return this.breedCard(c, opts);
  },

  silhouette(c) {
    if (c.legend) {
      const r = (Player.data.legends || {})[c.legendId];
      return `<div class="gcard silhouette legend-sil rcard-${c.rarity}"><div class="gcard-head">${this.rarity(c.rarity)}<span class="gtype">👑 名馬</span></div>
        ${r && Legends.photoUrl(c.legendId) ? `<div class="gcard-art photo"><img src="${Legends.photoUrl(c.legendId)}" alt="" loading="lazy"></div>` : `<div class="gcard-art">${r ? '🏇' : '❔'}</div>`}<div class="gcard-name">${r ? Util.esc(c.name) : '？？？？'}</div>
        <div class="gcard-desc">${r ? `対戦${r.met}回・先着${r.beaten}回<br>重賞で先着するとカード入手のチャンス！` : 'まだ出会っていない名馬'}</div></div>`;
    }
    return `<div class="gcard silhouette rcard-${c.rarity}"><div class="gcard-head">${this.rarity(c.rarity)}<span class="gtype">${Cards.types[c.type].label}</span></div>
      <div class="gcard-art">❔</div><div class="gcard-name">？？？？</div><div class="gcard-desc">まだ見つけていないカード</div></div>`;
  },

  // 競走馬カード（厩舎一覧用）
  horseCard(h, opts = {}) {
    const cond = Horse.conditionInfo(h);
    const fat = Horse.fatigueInfo(h);
    const ov = Horse.overall(h);
    const acted = Horse.acted(h);
    const retire = Horse.mustRetire(h);
    const status = retire ? '<span class="hs retire">🎌 引退時期</span>' : acted ? '<span class="hs done">✅ 行動済み</span>' : '<span class="hs todo">🟢 今週まだ</span>';
    const bars = STAT_KEYS.map(k => `<i class="mb stat-${k}" style="width:${Util.clamp(h.stats[k] / 1.2, 4, 100)}%" title="${GAME_DATA.stats.find(x => x.key === k).label} ${h.stats[k]}"></i>`).join('');
    const quick = opts.quick === false || retire ? '' : `<div class="hcard-quick" onclick="event.stopPropagation()">
        <button ${acted ? 'disabled' : ''} onclick="App.autoTrain('${h.id}')">🤖 おまかせ</button>
        <button ${acted ? 'disabled' : ''} onclick="App.goRace('${h.id}')">🏇 レース</button></div>`;
    return `<div class="hcard rcard-${h.rarity} ${acted ? 'is-acted' : ''}" onclick="${opts.onclick !== undefined ? opts.onclick : `UI.show('horse',{id:'${h.id}'})`}">
      <div class="hcard-top">${this.rarity(h.rarity)}<span class="hname">${Util.esc(h.name)}</span><span class="ovr" title="総合評価">${Util.grade(ov)}</span></div>
      <div class="hcard-art">${Portrait.slot(Portrait.forHorse(h), '🏇')}${opts.quick === false ? '' : status}</div>
      <div class="hcard-info"><span>${Horse.genderLabel(h)}</span><span>${h.age}歳</span><span>Lv.${h.level}</span>${this.styleTag(h.runningStyle)}</div>
      <div class="hcard-info small"><span>${Horse.mainAptText(h)}</span></div>
      <div class="mbars">${bars}</div>
      <div class="hcard-info small"><span class="${cond.cls}">${cond.icon} ${cond.label}</span><span class="${fat.cls}">😓 ${fat.label}</span></div>
      <div class="hcard-rec">${h.record.races}戦${h.record.wins}勝${h.record.g1Wins ? `・GⅠ ${h.record.g1Wins}勝` : ''}</div>
      ${quick}
    </div>`;
  },

  modal(html, opts = {}) {
    const m = this.el('modal');
    m.innerHTML = `<div class="modal-box ${opts.cls || ''}" role="dialog">
      ${opts.noClose ? '' : '<button class="modal-x" onclick="UI.closeModal()" aria-label="閉じる">✕</button>'}${html}</div>`;
    m.classList.add('open');
    Portrait.hydrate();
    m.onclick = e => { if (e.target === m && !opts.noClose) UI.closeModal(); };
  },
  // 勝利の紙吹雪
  confetti() {
    const box = document.createElement('div');
    box.className = 'confetti';
    const cols = ['#f5b301', '#e8552d', '#2e9d48', '#1e63d6', '#f48fb1', '#ffffff'];
    box.innerHTML = Array.from({ length: 70 }, () => `<i style="left:${Math.random() * 100}%;background:${cols[Math.floor(Math.random() * cols.length)]};animation-delay:${(Math.random() * 0.6).toFixed(2)}s;animation-duration:${(2 + Math.random() * 1.5).toFixed(2)}s;transform:rotate(${Math.floor(Math.random() * 360)}deg)"></i>`).join('');
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4200);
  },

  closeModal() { this.el('modal').classList.remove('open'); this.el('modal').innerHTML = ''; },

  toast(msg, type = '') {
    const box = this.el('toasts');
    // 同じ内容は重ねない・最大2件。タップで消せる
    if ([...box.children].some(x => x.dataset.msg === msg)) return;
    while (box.children.length >= 2) box.firstChild.remove();
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.dataset.msg = msg;
    t.innerHTML = msg;
    t.onclick = () => t.remove();
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2400);
    setTimeout(() => t.remove(), 2800);
  },

  // ─────────── ホーム ───────────
  // 下のナビにバッジ（ミッション達成・未行動の馬・今週のGⅠ）
  navBadges() {
    const p = Player.data;
    const m = Missions.current();
    const todo = p.horses.filter(h => !Horse.acted(h) && !Horse.mustRetire(h)).length;
    const g1 = Race.gradedOn(Calendar.get().week).some(r => r.grade === 'g1');
    const set = (nav, txt, cls) => {
      const b = document.querySelector(`.nav-btn[data-nav="${nav}"]`);
      if (!b) return;
      let el = b.querySelector('.nb');
      if (!txt) { if (el) el.remove(); return; }
      if (!el) { el = document.createElement('i'); b.appendChild(el); }
      el.className = 'nb ' + (cls || '');
      el.textContent = txt;
    };
    set('home', m && Missions.isComplete(m) ? '!' : '', 'alert');
    set('stable', todo ? String(todo) : '');
    set('race', g1 ? 'GⅠ' : '', 'g1');
  },

  homeView() {
    const p = Player.data;
    const m = Missions.current();
    const guide = App.guide();
    const recs = p.horses.filter(h => !Horse.acted(h) && !Horse.mustRetire(h))
      .map(h => ({ h, race: Race.nextRace(h), target: Race.targetRace(h) })).filter(x => x.race || x.target).slice(0, 4);
    const totalCards = Object.values(p.cards).reduce((a, b) => a + b, 0);
    const ls = Legends.stats();
    const tiles = [
      ['🧬', '配合', "UI.show('breed')", `♂${Player.ownedCards('sire').length}・♀${Player.ownedCards('mare').length}`],
      ['🐎', '厩舎', "UI.show('stable')", `${p.horses.length}/${GAME_DATA.maxStable}頭`],
      ['🏇', '今週のレース', "UI.state.raceMode='week';UI.show('race')", Calendar.label(Calendar.get().week)],
      ['📅', '重賞日程', "UI.state.raceMode='calendar';UI.state.calMonth=null;UI.show('race')", 'JRAカレンダー'],
      ['🃏', 'カード', "UI.state.cardTab='owned';UI.show('cards')", `${totalCards}枚`],
      ['🛒', 'ショップ', "UI.state.cardTab='shop';UI.show('cards')", 'パック・アイテム'],
      ['⚔', '対戦', "UI.state.raceMode='league';UI.show('race')", `R ${p.pvp.rating}`],
      ['🌐', 'カスタム', "UI.state.raceMode='custom';UI.show('race')", Online.status === 'lobby' ? `ルーム ${Online.code}` : 'オンライン対戦'],
      ['👑', '名馬', "UI.state.cardTab='dex';UI.state.cardType='legend';UI.show('cards')", `${ls.cards}/${ls.total}`],
      ['🏛', '殿堂', "UI.show('hof')", `${p.hallOfFame.length}頭`],
      ['📊', '記録', "UI.show('records')", 'ランキング'],
      ['🎺', '曲・音', 'App.fanfareSettings()', 'ファンファーレ'],
      ['⚙', '設定', 'App.settings()', '']
    ];
    return `
      <section class="owner-bar">
        <div class="ob-name">🏇 <b>${Util.esc(p.name)}</b> 厩舎</div>
        <div class="ob-stats"><span>💰 ${Util.money(p.money)}</span><span>🃏 ${totalCards}</span><span>🏛 ${p.hallOfFame.length}</span></div>
      </section>

      ${guide ? `<section class="guide" onclick="${guide.action}"><div class="guide-icon">💡</div><div><b>${guide.title}</b><p>${guide.text}</p></div><span class="guide-go">▶</span></section>` : ''}

      ${this.datePanel()}

      ${m ? `<section class="panel mission ${Missions.isComplete(m) ? 'complete' : ''}">
        <div class="mission-head"><span class="mission-tag">📋 ミッション ${Player.data.missions.index + 1}/${GAME_DATA.missions.length}</span>
          ${Missions.isComplete(m) ? '<span class="ok">達成！</span>' : ''}</div>
        <div class="mission-title">${m.title}</div>
        <div class="bar"><div class="bar-fill mission-fill" style="width:${Math.min(100, Missions.progress(m) / m.target * 100)}%"></div></div>
        ${Missions.isComplete(m) ? `<button class="btn primary big" onclick="App.claimMission()">🎁 報酬を受け取る</button>`
          : `<p class="muted small">${m.hint}</p>`}
        <div class="mission-reward">報酬：💰${Util.money(m.reward.money)} ${(m.reward.cards || []).map(id => { const c = Cards.get(id); return `${this.rarity(c.rarity)}${c.name}`; }).join(' ')}</div>
      </section>` : ''}

      <section class="panel">
        <h3>🐎 わたしの馬 <button class="link" onclick="UI.show('stable')">厩舎へ ▶</button></h3>
        ${p.horses.length ? `<div class="hstrip">${p.horses.map(h => this.horseCard(h)).join('')}</div>`
          : `<div class="empty-mini">🐣 まだ馬がいません。<button class="btn primary" onclick="UI.show('breed')">🧬 最初の馬を配合する</button></div>`}
      </section>

      ${recs.length ? `<section class="panel"><h3>🎯 今週のおすすめ・目標</h3>
        ${recs.map(({ h, race, target }) => `<div class="rec-row" onclick="App.goRace('${h.id}')">
          <span class="rec-horse">${Util.esc(h.name)}</span>
          ${race ? `<span class="rec-race">${this.gradeBadge(race.grade)}<b>${race.name}</b><small>${race.surface === 'turf' ? '芝' : 'ダ'}${race.distance}m</small></span>` : ''}
          ${target && target.weeks > 0 ? `<span class="rec-target">🎯 ${target.race.name}（あと${target.weeks}週）</span>` : ''}<span class="rec-go">▶</span></div>`).join('')}
      </section>` : ''}

      <section class="tiles">${tiles.map(([ic, l, act, sub]) => `<button class="tile" onclick="${act}"><span class="ti-ic">${ic}</span><b>${l}</b><small>${sub}</small></button>`).join('')}</section>

      <details class="panel news">
        <summary>📢 お知らせ</summary>
        <ul>
          <li>🆕 UIをリニューアル！ 馬の姿がカードや厩舎に表示されるようになりました。</li>
          <li>🆕 👑 実在の名馬${ls.total}頭がライバルとして重賞に登場。名馬カードには実際の写真も。</li>
          <li>🆕 🎺 ファンファーレ設定：区分ごとに自分の音源を登録できます。</li>
          <li>🆕 レースが3D・実際の速さで見られます。</li>
          <li>わからない言葉は <span class="help static">？</span> ボタンをタップ！</li>
        </ul>
      </details>`;
  },

  // カレンダー（日付・次の週へ・今週の重賞）
  datePanel() {
    const p = Player.data;
    const c = Calendar.now();
    const season = c.month <= 2 || c.month === 12 ? '❄️ 冬' : c.month <= 5 ? '🌸 春' : c.month <= 8 ? '☀️ 夏' : '🍁 秋';
    const active = p.horses.filter(h => !Horse.mustRetire(h));
    const acted = active.filter(h => Horse.acted(h)).length;
    const thisWeek = Race.gradedOn(c.week);
    const upcoming = Race.gradedAll().filter(r => r.grade === 'g1').map(r => ({ r, n: Calendar.until(r.week) }))
      .filter(x => x.n > 0 && x.n <= 6).sort((a, b) => a.n - b.n).slice(0, 3);
    return `<section class="panel date-panel">
        <div class="date-big">📅 <b>${c.year}年目</b> <span>${c.month}月${c.wom}週</span> <small>${season}</small>${this.help('calendar')}</div>
        ${thisWeek.length ? `<div class="week-races">今週の重賞：${thisWeek.map(r => `<span class="wr ${r.grade}">${this.gradeBadge(r.grade)}${r.name}</span>`).join('')}</div>` : '<div class="week-races muted">今週は重賞なし（条件戦のみ）</div>'}
        ${upcoming.length ? `<div class="upcoming">まもなく：${upcoming.map(x => `<span>${x.r.name}<small>（あと${x.n}週）</small></span>`).join('')}</div>` : ''}
        ${active.length ? `<div class="acted-count">今週の行動：<b>${acted}/${active.length}頭</b> 済み</div>` : ''}
        <div class="btn-row">
          <button class="btn primary big" onclick="App.nextWeek()">▶ 次の週へ</button>
          <button class="btn" onclick="App.nextWeek(4)">⏩ 4週すすめる</button>
        </div>
        <p class="muted small">まだ行動していない馬はおまかせ調教をします。⏩は目標の重賞がある週と、年明けで止まります。</p>
      </section>`;
  },

  // ─────────── 厩舎 ───────────
  stableView() {
    const p = Player.data;
    return `<h2 class="screen-title">🐎 厩舎 <small>${p.horses.length}/${GAME_DATA.maxStable}頭</small></h2>
      ${p.horses.length ? `<div class="hgrid">${p.horses.map(h => this.horseCard(h)).join('')}</div>`
        : `<div class="empty">🐣<p>まだ馬がいません。<br>種牡馬カードと繁殖牝馬カードで配合しよう！</p><button class="btn primary big" onclick="UI.show('breed')">🧬 配合する</button></div>`}
      ${p.retired.length ? `<details class="panel"><summary>引退馬（${p.retired.length}頭）</summary>
        ${p.retired.map(r => `<div class="retired-row">${this.rarity(r.rarity)} <b>${Util.esc(r.name)}</b> ${r.record.races}戦${r.record.wins}勝 <small>父 ${Util.esc(r.father)}／母 ${Util.esc(r.mother)}</small></div>`).join('')}
      </details>` : ''}`;
  },

  // ─────────── 馬詳細 ───────────
  horseView(id) {
    const h = Player.horse(id);
    if (!h) return `<div class="empty">馬が見つかりません<br><button class="btn" onclick="UI.show('stable')">厩舎へ</button></div>`;
    const tab = this.state.horseTab;
    const cond = Horse.conditionInfo(h);
    const fat = Horse.fatigueInfo(h);
    const growth = GAME_DATA.growthTypes[h.growthType];
    const tabs = [['status', '📊 能力'], ['train', '🏋️ 調教'], ['skill', '🎴 スキル'], ['record', '🏆 戦績']];
    const body = { status: () => this.horseStatus(h), train: () => this.horseTrain(h), skill: () => this.horseSkills(h), record: () => this.horseRecord(h) }[tab]();
    return `
      <button class="back" onclick="UI.show('stable')">◀ 厩舎</button>
      <section class="horse-head rcard-${h.rarity}">
        <div class="hh-art">${Portrait.slot(Portrait.forHorse(h), '🏇')}</div>
        <div class="hh-main">
          <div class="hh-name">${this.rarity(h.rarity)} ${Util.esc(h.name)} <button class="link" onclick="App.rename('${h.id}')">✏</button></div>
          <div class="hh-tags">
            <span class="tag">${Horse.genderLabel(h)}</span>
            <span class="tag">${h.age}歳</span>
            <span class="tag ${Horse.acted(h) ? 'acted' : 'free'}">${Horse.acted(h) ? '✅ 今週は行動済み' : '🟢 今週まだ行動できる'}</span>
            ${this.styleTag(h.runningStyle)}
            <span class="tag">🌱 ${growth.label}${this.help('growth')}</span>
          </div>
          <div class="hh-grades">
            <div><small>総合評価</small><b>${Util.grade(Horse.overall(h))}</b></div>
            <div><small>素質${this.help('potential')}</small><b>${Util.grade(Horse.potential(h))}</b></div>
            <div><small>Lv.${h.level}</small><div class="bar thin"><div class="bar-fill exp" style="width:${h.exp / Horse.expToNext(h) * 100}%"></div></div></div>
          </div>
          <div class="hh-cond">
            <span class="${cond.cls}">${cond.icon} 調子：${cond.label}${this.help('condition')}</span>
            <span class="${fat.cls}">😓 疲労：${fat.label}${this.help('fatigue')}</span>
          </div>
          <div class="bar thin"><div class="bar-fill fatigue" style="width:${h.fatigue}%"></div></div>
        </div>
      </section>
      ${Horse.mustRetire(h) ? `<div class="notice">🎌 ${h.age}歳になり引退の時期です。お疲れさまでした！ <button class="btn primary" onclick="App.retire('${h.id}')">引退させる</button></div>` : ''}
      <div class="seg">${tabs.map(([k, l]) => `<button class="${tab === k ? 'active' : ''}" onclick="UI.state.horseTab='${k}';UI.render()">${l}</button>`).join('')}</div>
      ${body}
      <div class="sticky-actions">
        <button class="btn primary big" onclick="App.goRace('${h.id}')">🏇 レースへ</button>
      </div>`;
  },

  horseStatus(h) {
    const rec = Horse.recommendRoute(h);
    const s = GAME_DATA.styles[h.runningStyle];
    return `
      <section class="panel"><h3>能力</h3>
        ${this.radar(h.stats, h.caps)}
        ${STAT_KEYS.map(k => this.statRow(k, h.stats[k], h.caps[k])).join('')}
        <p class="muted small">｜の位置がこの馬の限界（素質）。調教で限界まで伸ばせます。</p>
      </section>
      <section class="panel"><h3>適性</h3>${this.aptGrid(h.aptitude, h.turn || "")}</section>
      <section class="panel"><h3>脚質${this.help('style')}</h3>
        <div class="style-box"><span class="style-big">${s.icon}</span><div><b>${s.label}</b><p>${s.desc}</p></div></div>
      </section>
      <section class="panel"><h3>目標路線</h3>
        <p class="rec">💡 この馬は <b>${Horse.routeInfo(rec).icon}${Horse.routeInfo(rec).name}</b> 路線がおすすめ！</p>
        <div class="route-pick">${GAME_DATA.routes.map(r => `<button class="${h.route === r.id ? 'active' : ''}" onclick="App.setRoute('${h.id}','${r.id}')">${r.icon} ${r.name}</button>`).join('')}</div>
      </section>
      <section class="panel"><h3>🌳 血統表</h3>
        ${this.pedigreeTree(Horse.pedigree(h))}
        ${h.specials && h.specials.length ? `<p class="special-tags">${h.specials.map(x => `<span class="special">✨ ${x}</span>`).join('')}</p>` : ''}
      </section>
      <section class="panel"><h3>📤 対戦コード</h3>
        <p class="muted small">この馬の対戦コードをフレンドに送ると、フレンドの画面であなたの馬と対戦できます。</p>
        <button class="btn" onclick="App.showCode('${h.id}')">対戦コードを表示</button>
      </section>`;
  },

  // 3代血統表（父・母とその両親）
  pedigreeTree(pd) {
    const cell = (n, cls, label) => `<div class="pt ${cls}"><small>${label}</small>${n ? `<b>${Util.esc(n.name)}</b>${this.rarity(n.rarity)}` : '<b class="muted">―</b>'}</div>`;
    return `<div class="ptree">
      ${cell(pd.f, 'sire p1', '父')}${cell(pd.m, 'mare p1', '母')}
      ${cell(pd.ff, 'sire p2', '父の父')}${cell(pd.fm, 'mare p2', '父の母')}${cell(pd.mf, 'sire p2', '母の父')}${cell(pd.mm, 'mare p2', '母の母')}
    </div>`;
  },

  horseTrain(h) {
    const plan = Training.autoPlan(h);
    const eff = Training.efficiency(h);
    const effLabel = eff >= 1.1 ? '◎ 絶好の伸び時' : eff >= 0.85 ? '○ よく伸びる' : eff >= 0.6 ? '△ 伸びにくい' : '× ほとんど伸びない';
    const items = Player.ownedCards('item');
    const menuBtn = (k, m) => {
      const gains = Object.keys(m.gains).map(s => GAME_DATA.stats.find(x => x.key === s).icon).join('');
      const fatTxt = m.fatigue > 0 ? `疲労+${m.fatigue}` : `疲労${m.fatigue}`;
      return `<button class="train-btn ${k === plan.menu ? 'suggest' : ''}" ${Horse.acted(h) ? 'disabled' : ''} onclick="App.train('${h.id}','${k}')">
        <span class="ti">${m.icon}</span><b>${m.label}</b><small>${gains || '回復'}・${fatTxt}</small></button>`;
    };
    return `
      <section class="panel auto-train">
        <h3>🤖 おまかせ調教</h3>
        <p>${plan.reason}</p>
        ${Horse.acted(h) ? `<p class="ok">✅ 今週はもう行動しました。</p><button class="btn primary big" onclick="App.nextWeek()">▶ 次の週へ（${Calendar.label((Calendar.get().week + 1) % Calendar.W)}）</button>`
          : `<button class="btn primary big" onclick="App.autoTrain('${h.id}')">🤖 今週はおまかせ調教</button>`}
        ${(h.rights || []).length ? `<p class="rec">🎫 優先出走権：${h.rights.map(id => (Race.get(id) || {}).name).filter(Boolean).join('・')}${this.help('right')}</p>` : ''}
      </section>
      <section class="panel">
        <h3>🏋️ 調教メニュー <small class="muted">成長度：${effLabel}</small></h3>
        <div class="train-grid">${Object.entries(Training.menus).map(([k, m]) => menuBtn(k, m)).join('')}</div>
        ${h.fatigue >= 60 ? '<p class="warn">⚠ 疲れがたまっています。休養させよう！</p>' : ''}
      </section>
      <section class="panel">
        <h3>🎒 アイテムを使う</h3>
        <p class="muted small">⬆ 限界値アップ：あと+${Training.capRoom(h)}（1頭につき合計+${GAME_DATA.capBoostMax}まで）</p>
        ${items.length ? `<div class="item-list">${items.map(c => `<button class="item-btn" ${c.use.allCaps && !c.use.allStats && !Training.capRoom(h) ? 'disabled' : ''} onclick="App.useItem('${h.id}','${c.id}')">
          ${this.rarity(c.rarity)} ${c.icon} <b>${c.name}</b> ×${Player.count(c.id)}<small>${c.desc}</small></button>`).join('')}</div>`
          : '<p class="muted">アイテムカードを持っていません。レースやショップで手に入ります。</p>'}
      </section>`;
  },

  horseSkills(h) {
    const owned = Player.ownedCards('skill').sort((a, b) => Number(Skills.isMatch(b, h.runningStyle)) - Number(Skills.isMatch(a, h.runningStyle)) || Cards.rarityIndex(b.rarity) - Cards.rarityIndex(a.rarity));
    const slots = [0, 1, 2].map(i => {
      const id = h.skills[i];
      if (!id) return `<div class="slot empty-slot">スロット${i + 1}<br><small>空き</small></div>`;
      const sk = Skills.get(id);
      const match = Skills.isMatch(sk, h.runningStyle);
      return `<div class="slot rcard-${sk.rarity}"><div class="slot-icon">${sk.icon}</div><b>${sk.name}</b>
        <small>${sk.condText}</small>${match ? '' : '<small class="warn">脚質不一致：効果ダウン</small>'}
        <button class="btn small" onclick="App.unequip('${h.id}','${id}')">外す</button></div>`;
    }).join('');
    return `
      <section class="panel"><h3>🎴 装備スキル（${h.skills.length}/3）${this.help('skill')}</h3>
        <div class="slots">${slots}</div>
        <p class="muted small">レース中、条件を満たすと自動で発動します（1レース1回）。賢さが高いと発動しやすい！</p>
      </section>
      <section class="panel"><h3>所持スキルカード</h3>
        ${owned.length ? `<div class="cgrid">${owned.map(c => {
          const match = Skills.isMatch(c, h.runningStyle);
          return this.skillCard(c, {
            count: Player.count(c.id),
            extra: `<div class="${match ? 'ok' : 'warn'} small">${match ? '✔ 脚質ぴったり' : '△ 脚質が違うので効果ダウン'}</div>
              <button class="btn small primary" ${h.skills.length >= 3 || h.skills.includes(c.id) ? 'disabled' : ''} onclick="App.equip('${h.id}','${c.id}')">装備する</button>`
          });
        }).join('')}</div>` : '<p class="muted">スキルカードがありません。レースで勝って手に入れよう！</p>'}
      </section>`;
  },

  horseRecord(h) {
    const r = h.record;
    return `
      <section class="panel"><h3>🏆 戦績</h3>
        <div class="record-big">${r.races}戦 <b>${r.wins}</b>勝 <small>[${r.wins}-${r.seconds}-${r.thirds}-${r.races - r.wins - r.seconds - r.thirds}]</small></div>
        <div class="hero-stats">
          <div><small>獲得賞金</small><b>${Util.money(r.prizeMoney)}</b></div>
          <div><small>重賞勝利</small><b>${r.gradedWins}</b></div>
          <div><small>GⅠ勝利</small><b>${r.g1Wins}</b></div>
        </div>
        ${HallOfFame.qualifies(h) ? '<p class="ok">🏛 殿堂入りの条件を満たしています！引退すると殿堂入りします。</p>' : `<p class="muted small">殿堂入り条件：GⅠ 3勝 or 通算10勝${this.help('hof')}</p>`}
      </section>
      <section class="panel"><h3>レース履歴</h3>
        ${h.history.length ? `<table class="hist"><tr><th>着</th><th>レース</th><th>条件</th></tr>
          ${h.history.map(x => `<tr class="${x.place === 1 ? 'win' : ''}"><td>${x.place}/${x.field}</td><td>${this.gradeBadge(x.grade)} ${x.name}</td><td>${x.surface === 'turf' ? '芝' : 'ダ'}${x.distance}・${x.age}歳</td></tr>`).join('')}
        </table>` : '<p class="muted">まだレースに出ていません。</p>'}
      </section>
      <section class="panel danger-zone"><h3>引退</h3>
        <p class="muted small">引退すると厩舎から外れます。重賞を勝った馬は配合カードになります。装備スキルは手元に戻ります。</p>
        <button class="btn danger" onclick="App.retire('${h.id}')">引退させる</button>
      </section>`;
  },

  // ─────────── カード ───────────
  cardsView() {
    const st = this.state;
    const tabs = [['owned', '所持カード'], ['dex', '📖 図鑑'], ['shop', '🛒 ショップ']];
    let body = '';
    if (st.cardTab === 'shop') body = this.shopView();
    else {
      const types = [['all', 'すべて'], ['legend', '👑 名馬'], ['sire', '♂ 種牡馬'], ['mare', '♀ 繁殖牝馬'], ['skill', '🎴 スキル'], ['item', '🎒 アイテム']];
      const rars = ['all', ...GAME_DATA.rarities];
      const q = st.cardQuery.trim();
      const match = c => (st.cardType === 'all' || (st.cardType === 'legend' ? c.legend : c.type === st.cardType)) && (st.cardRarity === 'all' || c.rarity === st.cardRarity)
        && (!q || c.name.includes(q) || (c.desc || '').includes(q));
      const filters = `<div class="filters">
        <div class="chips">${types.map(([k, l]) => `<button class="${st.cardType === k ? 'active' : ''}" onclick="UI.state.cardType='${k}';UI.render()">${l}</button>`).join('')}</div>
        <div class="chips">${rars.map(r => `<button class="${st.cardRarity === r ? 'active' : ''}" onclick="UI.state.cardRarity='${r}';UI.render()">${r === 'all' ? '全レア' : r}</button>`).join('')}</div>
        <input class="search" type="search" placeholder="🔍 カード名で検索" value="${Util.esc(st.cardQuery)}" oninput="UI.state.cardQuery=this.value;clearTimeout(UI._q);UI._q=setTimeout(()=>{UI.render();const i=document.querySelector('.search');i.focus();i.setSelectionRange(i.value.length,i.value.length)},300)">
      </div>`;
      const sortFn = (a, b) => Object.keys(Cards.types).indexOf(a.type) - Object.keys(Cards.types).indexOf(b.type) || Cards.rarityIndex(b.rarity) - Cards.rarityIndex(a.rarity);
      if (st.cardTab === 'owned') {
        const list = Player.ownedCards().filter(match).sort(sortFn);
        body = filters + (list.length ? `<div class="cgrid">${list.map(c => this.anyCard(c, { count: Player.count(c.id), onclick: `App.cardDetail('${c.id}')` })).join('')}</div>` : '<p class="muted">該当するカードがありません。</p>');
      } else {
        const all = Cards.all().filter(match).sort(sortFn);
        const seen = new Set(Player.data.seenCards);
        const got = Cards.all().filter(c => seen.has(c.id)).length;
        body = `<p class="dex-progress">収集率：<b>${got}</b> / ${Cards.all().length}</p>` + filters +
          `<div class="cgrid">${all.map(c => seen.has(c.id) ? this.anyCard(c, { onclick: `App.cardDetail('${c.id}')` }) : this.silhouette(c)).join('')}</div>`;
        if (st.cardType === 'legend') { const ls = Legends.stats(); body = `<p class="dex-progress">👑 名馬カード：<b>${ls.cards}</b> / ${ls.total}・対戦 ${ls.met}頭・先着 ${ls.beaten}頭</p>` + body; }
      }
    }
    return `<h2 class="screen-title">🃏 カード</h2>
      <div class="seg">${tabs.map(([k, l]) => `<button class="${st.cardTab === k ? 'active' : ''}" onclick="UI.state.cardTab='${k}';UI.render()">${l}</button>`).join('')}</div>
      ${body}`;
  },

  shopView() {
    const items = GAME_DATA.items.filter(i => i.price);
    const left = c => Player.shopLeft(c);
    const buyBtn = (c, fn, cls) => left(c) <= 0
      ? `<button class="btn ${cls}" disabled>売り切れ（来週入荷）</button>`
      : `<button class="btn ${cls} primary" ${Player.canAfford(c.price) ? '' : 'disabled'} onclick="App.${fn}('${c.id}')">💰 ${Util.money(c.price)}</button><small class="muted">今週あと${left(c)}</small>`;
    return `<p class="muted">所持金：<b>${Util.money(Player.data.money)}</b>　<small>🗓 商品は毎週入荷します（1週間に買える数に限りあり）</small></p>
      <h3 class="sub-title">🃏 カードパック</h3>
      <div class="packs">${GAME_DATA.packs.map(pk => `<div class="pack">
        <div class="pack-icon">${pk.icon}</div><b>${pk.name}</b><small>${pk.desc}</small>
        ${buyBtn(pk, 'buyPack', '')}
      </div>`).join('')}</div>
      <h3 class="sub-title">🎒 アイテム</h3>
      <p class="muted small">🌟特別調教・🧪素質の霊薬（限界値アップ）は非売品。レースやミッションの報酬で手に入ります。</p>
      <div class="cgrid">${items.map(c => this.itemCard(c, {
        count: Player.count(c.id),
        extra: buyBtn(c, 'buy', 'small')
      })).join('')}</div>`;
  },

  // ─────────── 配合 ───────────
  breedView() {
    const b = this.state.breed;
    const father = b.father && Player.count(b.father) ? Cards.get(b.father) : null;
    const mother = b.mother && Player.count(b.mother) ? Cards.get(b.mother) : null;
    const step = !father ? 1 : !mother ? 2 : 3;
    const steps = ['父カードを選ぼう！', '母カードを選ぼう！', '配合開始！'];
    const slot = (c, label, kind) => c
      ? `<div class="breed-slot filled ${kind}" onclick="UI.state.breed.${kind === 'sire' ? 'father' : 'mother'}=null;UI.render()">${this.rarity(c.rarity)}<b>${Util.esc(c.name)}</b><small>タップで変更</small></div>`
      : `<div class="breed-slot ${kind} ${(step === 1 && kind === 'sire') || (step === 2 && kind === 'mare') ? 'pulse' : ''}">${label}<br><small>未選択</small></div>`;

    let body = '';
    if (step < 3) {
      const type = step === 1 ? 'sire' : 'mare';
      const list = Player.ownedCards(type).sort((a, b2) => Cards.rarityIndex(b2.rarity) - Cards.rarityIndex(a.rarity));
      body = `<div class="cgrid">${list.map(c => this.breedCard(c, { onclick: `App.pickParent('${type}','${c.id}')`, count: Player.count(c.id) })).join('')}</div>`;
    } else {
      const pv = Breeding.preview(father, mother);
      body = `<section class="panel preview">
        <h3>🔮 配合予想</h3>
        <div class="pv-score">おすすめ度：<b>${'★'.repeat(pv.score)}${'☆'.repeat(5 - pv.score)}</b></div>
        <p class="pv-comment">「${pv.comment}」</p>
        ${pv.specials.length ? `<div class="specials">${pv.specials.map(x => `<div class="special-box"><b>✨ ${x.name}</b><small>${x.desc}</small></div>`).join('')}</div>` : ''}
        <div class="pv-grid">${GAME_DATA.stats.map(s => `<div>${s.icon} ${s.label}<b>${pv.arrows[s.key]}</b></div>`).join('')}</div>
        <p>得意：<b>${pv.surface}・${pv.distText}</b></p>
        <p class="muted small">※ 同じ配合でも、生まれる馬には個体差があります。</p>
        <div class="fee">配合料：<b>${Util.money(pv.fee)}</b> ${Player.data.stats.breedCount === 0 ? '<span class="ok">（初回は無料！）</span>' : ''}</div>
        ${Player.stableFull() ? `<p class="warn">⚠ 厩舎がいっぱいです（最大${GAME_DATA.maxStable}頭）。馬を引退させてください。</p>` : ''}
        <button class="btn primary big glow" ${Player.stableFull() ? 'disabled' : ''} onclick="App.breed()">🧬 配合開始！</button>
      </section>
      <div class="cols2">${this.breedCard(father)}${this.breedCard(mother)}</div>`;
    }
    return `<h2 class="screen-title">🧬 配合</h2>
      <div class="steps">${steps.map((s, i) => `<div class="${i + 1 === step ? 'active' : i + 1 < step ? 'done' : ''}">${i + 1}. ${s}</div>`).join('')}</div>
      <div class="breed-slots">${slot(father, '♂ 父', 'sire')}<div class="x">✕</div>${slot(mother, '♀ 母', 'mare')}</div>
      <p class="breed-hint">${step === 1 ? '👇 まず父カード（種牡馬）を選ぼう！' : step === 2 ? '👇 次に母カード（繁殖牝馬）を選ぼう！' : '準備OK！ 配合して新しい馬を誕生させよう！'}</p>
      ${body}
      ${this.nickList()}`;
  },

  // 黄金配合リスト（発見すると名前と組み合わせが表示される）
  nickList() {
    const found = Player.data.nicksFound;
    return `<details class="panel nick-list"><summary>✨ 黄金配合リスト（発見 ${found.length}/${GAME_DATA.nicks.length}）</summary>
      <p class="muted small">特定の父と母を組み合わせると「黄金配合」になり、能力にボーナスがつきます。低レアの組み合わせもあるよ！</p>
      ${GAME_DATA.nicks.map(n => {
        const key = n.sire + '+' + n.mare;
        const f = Cards.get(n.sire), m = Cards.get(n.mare);
        return found.includes(key)
          ? `<div class="nick found">✨ <b>${n.name}</b>：${f.name} × ${m.name}（全能力+${n.bonus}）</div>`
          : `<div class="nick">❔ ？？？：${this.rarity(f.rarity)}の種牡馬 × ${this.rarity(m.rarity)}の繁殖牝馬</div>`;
      }).join('')}
    </details>`;
  },

  // ─────────── レース選択 ───────────
  raceView() {
    const p = Player.data;
    if (!p.horses.length && !['calendar'].includes(this.state.raceMode)) {
      return `<h2 class="screen-title">🏇 レース</h2><div class="empty">🐣<p>出走できる馬がいません。<br>まずは配合で馬を作ろう！</p><button class="btn primary big" onclick="UI.show('breed')">🧬 配合へ</button>
        <button class="btn" onclick="UI.state.raceMode='calendar';UI.render()">📅 重賞カレンダーを見る</button></div>`;
    }
    const st = this.state;
    if (p.horses.length && (!st.raceHorse || !Player.horse(st.raceHorse))) st.raceHorse = p.horses[0].id;
    const h = Player.horse(st.raceHorse);
    const modes = [['week', '🏇 今週'], ['calendar', '📅 日程'], ['league', '⚔リーグ'], ['friend', '🤝対戦'], ['custom', '🌐カスタム']];
    const head = `<h2 class="screen-title">🏇 レース <small>📅 ${Calendar.fullLabel()}</small></h2>
      <div class="seg">${modes.map(([k, l]) => `<button class="${st.raceMode === k ? 'active' : ''}" onclick="UI.state.raceMode='${k}';UI.render()">${l}</button>`).join('')}</div>
      ${h ? `<div class="chips horse-pick">${p.horses.map(x => `<button class="${x.id === h.id ? 'active' : ''}" onclick="UI.state.raceHorse='${x.id}';UI.render()">${Horse.acted(x) ? '✅' : ''}${Util.esc(x.name)}</button>`).join('')}</div>` : ''}`;
    if (st.raceMode === 'league') return head + this.leagueView(h);
    if (st.raceMode === 'friend') return head + this.friendView(h);
    if (st.raceMode === 'custom') return head + this.customView(h);
    if (st.raceMode === 'calendar') return head + this.calendarView(h);
    return head + this.weekView(h);
  },

  // ─────────── 今週のレース ───────────
  weekView(h) {
    const st = this.state;
    const c = Calendar.now();
    const rec = Horse.recommendRoute(h);
    const cond = Horse.conditionInfo(h);
    const fat = Horse.fatigueInfo(h);
    const target = Race.targetRace(h);
    const all = Race.weekRaces().map(race => ({ race, elig: Race.eligibility(h, race, { ignoreActed: true }) }));
    const graded = all.filter(x => x.race.kind === 'graded');
    const conds = all.filter(x => x.race.kind !== 'graded' && (st.showAllRaces || x.elig.ok || x.elig.reason === '疲れすぎ。休ませよう'))
      .sort((a, b) => Number(b.elig.ok) - Number(a.elig.ok) || Race.fit(h, b.race) - Race.fit(h, a.race));
    const acted = Horse.acted(h);
    return `
      <section class="panel race-horse">
        <div><b>${Util.esc(h.name)}</b> ${Horse.genderLabel(h)} ${h.age}歳 ${this.styleTag(h.runningStyle)} <span class="tag">${h.record.wins}勝・${Race.isOpen(h) ? 'オープン' : h.record.wins === 0 ? '未勝利' : `${h.record.wins}勝クラス`}</span>${this.help('grade')}</div>
        <div class="muted small">${Horse.mainAptText(h)}・<span class="${cond.cls}">${cond.icon}${cond.label}</span>・<span class="${fat.cls}">😓${fat.label}</span></div>
        <p class="rec">💡 おすすめ路線：<b>${Horse.routeInfo(rec).icon}${Horse.routeInfo(rec).name}</b>
          ${target ? `<br>🎯 目標：<b>${target.race.name}</b>（${Calendar.label(target.race.week)}・${target.weeks ? `あと${target.weeks}週` : '今週！'}）` : ''}
          ${(h.rights || []).length ? `<br>🎫 優先出走権：${h.rights.map(id => (Race.get(id) || {}).name).filter(Boolean).join('・')}` : ''}</p>
        ${acted ? `<p class="warn">✅ この馬は今週もう行動しました。</p><button class="btn primary" onclick="App.nextWeek()">▶ 次の週へ</button>` : ''}
      </section>
      <h3 class="sub-title">🏆 ${c.month}月${c.wom}週の重賞</h3>
      ${graded.length ? `<div class="race-list">${graded.map(({ race, elig }) => this.raceRow(h, race, elig, acted)).join('')}</div>` : '<p class="muted light">今週は重賞がありません。</p>'}
      <h3 class="sub-title">🏁 条件戦・オープン <button class="link light" onclick="UI.state.showAllRaces=!UI.state.showAllRaces;UI.render()">${st.showAllRaces ? '出られるレースだけ表示' : 'すべて表示'}</button></h3>
      ${conds.length ? `<div class="race-list">${conds.map(({ race, elig }) => this.raceRow(h, race, elig, acted)).join('')}</div>`
        : `<p class="muted light">${h.age === 2 && c.month < 6 ? '2歳の新馬戦は6月1週から始まります。それまでは調教で鍛えよう！' : '今週この馬が出られる条件戦はありません。'}</p>`}`;
  },

  raceRow(h, race, elig, acted) {
    const cat = Horse.distCat(race.distance);
    const dl = GAME_DATA.distances.find(d => d.key === cat);
    const sl = GAME_DATA.surfaces.find(s => s.key === race.surface);
    const trialTo = race.trial ? Race.get(race.trial.to) : null;
    return `<div class="race-row ${elig.ok ? '' : 'locked'} ${race.grade === 'g1' ? 'g1row' : ''}">
      <div class="rr-head">${this.gradeBadge(race.grade)}<b>${race.name}</b>${race.female ? '<span class="tag">牝馬限定</span>' : ''}${elig.right ? '<span class="tag right">🎫 優先出走権</span>' : ''}</div>
      <div class="rr-info">📍${race.venue} ${sl.icon}${sl.label}${race.distance}m（${dl.label}・${Race.courseOf(race).dirLabel}）・${Race.AGE_LABEL[race.ages]}・${race.field}頭・1着 ${Util.money(race.prize)}</div>
      ${trialTo ? `<div class="rr-info">🎫 ${race.trial.top}着以内で「${trialTo.name}」の優先出走権</div>` : ''}
      <div class="rr-apt">この馬の適性：距離 <b>${Util.stars(h.aptitude[cat])}</b> 馬場 <b>${Util.stars(h.aptitude[race.surface])}</b></div>
      ${elig.ok ? `<button class="btn primary" ${acted ? 'disabled' : ''} onclick="App.prepareRace('${h.id}','${race.id}')">${acted ? '今週は行動済み' : '出走する'}</button>` : `<div class="lock">🔒 ${elig.reason}</div>`}
    </div>`;
  },

  // ─────────── 重賞カレンダー ───────────
  calendarView(h) {
    const st = this.state;
    const now = Calendar.now();
    const month = st.calMonth || now.month;
    const routes = [['all', 'すべて'], ...GAME_DATA.routes.map(r => [r.id, `${r.icon}${r.name}`])];
    const list = Race.gradedAll().filter(r => r.m === month && (st.calRoute === 'all' || r.route === st.calRoute));
    const weeks = [1, 2, 3, 4].map(w => {
      const races = list.filter(r => r.w === w).sort((a, b) => GAME_DATA.grades[b.grade].order - GAME_DATA.grades[a.grade].order);
      const week = Calendar.weekOf(month, w);
      const until = Calendar.until(week);
      const isNow = week === now.week;
      return `<div class="cal-week ${isNow ? 'now' : ''}">
        <div class="cal-head">${month}月${w}週 ${isNow ? '<em>今週</em>' : `<small>あと${until}週${now.week + until >= Calendar.W ? '（来年）' : ''}</small>`}</div>
        ${races.length ? races.map(r => this.calRow(h, r, until)).join('') : '<div class="muted small">重賞なし</div>'}
      </div>`;
    }).join('');
    return `
      <section class="panel">
        <p class="muted small">実在のJRA重賞の年間スケジュールです（ゲームでは1か月を4週にまとめています）。${this.help('calendar')}</p>
        <div class="chips months">${Array.from({ length: 12 }, (_, i) => i + 1).map(m => `<button class="${m === month ? 'active' : ''} ${m === now.month ? 'cur' : ''}" onclick="UI.state.calMonth=${m};UI.render()">${m}月</button>`).join('')}</div>
        <div class="chips" style="margin-top:6px">${routes.map(([k, l]) => `<button class="${st.calRoute === k ? 'active' : ''}" onclick="UI.state.calRoute='${k}';UI.render()">${l}</button>`).join('')}</div>
      </section>
      <div class="cal">${weeks}</div>`;
  },

  calRow(h, r, until) {
    let status = '';
    if (h) {
      const age = h.age + (Calendar.get().week + until >= Calendar.W ? 1 : 0);
      const e = Race.eligibility(Object.assign({}, h, { age }), r, { ignoreActed: true, ignoreFatigue: true });
      status = e.ok ? `<span class="ok small">✅ ${Util.esc(h.name)}は出走できます${e.right ? '（優先出走権）' : ''}</span>` : `<span class="muted small">🔒 ${e.reason}</span>`;
    }
    const trialTo = r.trial ? Race.get(r.trial.to) : null;
    return `<div class="cal-race ${r.grade}">
      <div>${this.gradeBadge(r.grade)}<b>${r.name}</b>${r.crown ? ` <span class="tag">${GAME_DATA.crowns[r.crown].title}</span>` : ''}</div>
      <div class="muted small">📍${r.venue} ${r.surface === 'turf' ? '芝' : 'ダート'}${r.distance}m（${Race.courseOf(r).dirLabel}）・${Race.AGE_LABEL[r.ages]}${r.f ? '牝馬' : ''}・1着 ${Util.money(r.prize)}${trialTo ? `・🎫${r.trial.top}着以内→${trialTo.name}` : ''}</div>
      ${status}
    </div>`;
  },

  // ─────────── 殿堂 ───────────
  hofView() {
    const list = Player.data.hallOfFame;
    return `<button class="back" onclick="UI.show('home')">◀ ホーム</button>
      <h2 class="screen-title">🏛 殿堂</h2>
      ${list.length ? `<div class="hof-list">${list.map(e => `
        <div class="legend-card">
          <div class="lc-top">🏛 LEGEND</div>
          <div class="lc-name">${Util.esc(e.name)}</div>
          <div class="lc-rec">GⅠ：${e.record.g1Wins}勝<br>通算：${e.record.races}戦${e.record.wins}勝</div>
          ${e.mainWins.length ? `<div class="lc-wins"><small>主な勝鞍</small>${e.mainWins.map(w => `<div>・${w}</div>`).join('')}</div>` : ''}
          ${e.titles.length ? `<div class="lc-title">称号：「${e.titles[0]}」${e.titles.length > 1 ? `<small>ほか ${e.titles.slice(1).join('・')}</small>` : ''}</div>` : ''}
          <div class="lc-ped">父：${Util.esc(e.father)}${e.pedigree && e.pedigree.ff ? `<small>（父父 ${Util.esc(e.pedigree.ff.name)}）</small>` : ''}<br>母：${Util.esc(e.mother)}${e.pedigree && e.pedigree.mf ? `<small>（母父 ${Util.esc(e.pedigree.mf.name)}）</small>` : ''}</div>
        </div>`).join('')}</div>`
        : `<div class="empty">🏛<p>まだ殿堂馬はいません。<br>GⅠ 3勝、または通算10勝した馬を引退させると殿堂入り！</p></div>`}`;
  },

  // ─────────── リーグ戦 ───────────
  leagueView(h) {
    const pvp = Player.data.pvp;
    const st = this.state;
    const can = Pvp.canEnter(h, { league: true });
    return `<section class="panel pvp-head">
        <div class="rating">レーティング <b>${pvp.rating}</b> <small>最高 ${pvp.best}・${pvp.matches}戦${pvp.wins}勝</small></div>
        <p class="muted small">CPUのライバル馬主7人と8頭立てで対戦。順位でレーティングが上下し、上位リーグが解放されます。1頭につき週1回（今週の行動を使います・疲労+${Pvp.FATIGUE}）。</p>
      </section>
      <div class="league-list">${GAME_DATA.leagues.map(l => {
        const open = Pvp.isUnlocked(l);
        return `<div class="league ${st.league === l.id ? 'active' : ''} ${open ? '' : 'locked'}" onclick="${open ? `UI.state.league='${l.id}';UI.render()` : ''}">
          <div class="league-icon">${l.icon}</div>
          <div><b>${l.name}</b><small>${l.desc}</small>
          <small>1着賞金 ${Util.money(l.prize)}${pvp.leagueWins[l.id] ? `・優勝 ${pvp.leagueWins[l.id]}回` : ''}</small>
          ${open ? '' : `<small class="warn">🔒 レーティング ${l.minRating} で解放</small>`}</div>
        </div>`;
      }).join('')}</div>
      <section class="panel">
        <p>出走馬：<b>${Util.esc(h.name)}</b> ${this.styleTag(h.runningStyle)} 総合 ${Util.grade(Horse.overall(h))}${this.league_capNote(h)}</p>
        ${can.ok ? `<button class="btn primary big" onclick="App.prepareLeague('${h.id}')">⚔ 対戦相手を探す</button>` : `<p class="lock">🔒 ${can.reason}</p>`}
      </section>`;
  },

  league_capNote(h) {
    const l = Pvp.league(this.state.league);
    if (!l.statCap) return '';
    const over = STAT_KEYS.filter(k => h.stats[k] > l.statCap);
    return over.length ? `<br><small class="muted">※ ${over.map(k => GAME_DATA.stats.find(x => x.key === k).label).join('・')}は${l.statCap}に制限されます</small>` : '';
  },

  // ─────────── フレンド対戦 ───────────
  friendView(h) {
    const st = this.state;
    const ghosts = Player.data.ghosts;
    st.friendPick = st.friendPick.filter(id => ghosts.some(g => g.id === id));
    const caps = [[0, '制限なし'], [70, '最大70'], [85, '最大85']];
    const can = Pvp.canEnter(h);
    return `<section class="panel">
        <h3>📥 対戦コードを追加</h3>
        <p class="muted small">フレンドの「対戦コード」（馬の詳細 → 能力タブ）を貼り付けると、その馬と対戦できます。</p>
        <textarea id="ghost-code" class="code-box" rows="3" placeholder="UMA1.xxxxx..."></textarea>
        <button class="btn primary" onclick="App.addGhost()">追加する</button>
        <button class="btn" onclick="App.showCode('${h.id}')">📤 ${Util.esc(h.name)}のコード</button>
      </section>
      <section class="panel">
        <h3>🤝 対戦する馬を選ぶ（最大7頭）</h3>
        ${ghosts.length ? `<div class="ghost-list">${ghosts.map(g => {
          const on = st.friendPick.includes(g.id);
          return `<div class="ghost ${on ? 'on' : ''}" onclick="App.toggleGhost('${g.id}')">
            <span class="check">${on ? '✅' : '⬜'}</span>
            <div class="ghost-main">${this.rarity(g.rarity)} <b>${Util.esc(g.name)}</b> ${GAME_DATA.styles[g.runningStyle].icon}<br>
              <small>${Util.esc(g.owner)}厩舎・${g.record.races}戦${g.record.wins}勝・総合 ${Util.grade(Math.round(STAT_KEYS.reduce((a, k) => a + g.stats[k], 0) / 5))}・対戦成績 ${g.vs.win}勝${g.vs.lose}敗</small></div>
            <button class="link" onclick="event.stopPropagation();App.removeGhost('${g.id}')">削除</button>
          </div>`;
        }).join('')}</div>` : '<p class="muted">まだ対戦コードがありません。フレンドと交換しよう！ コードが無くても、CPUの馬とフリー対戦できます。</p>'}
      </section>
      <section class="panel">
        <h3>⚙ ルール</h3>
        <div class="chips">${GAME_DATA.leagueCourses.map((c, i) => `<button class="${st.friendCourse === i ? 'active' : ''}" onclick="UI.state.friendCourse=${i};UI.render()">${c.surface === 'turf' ? '芝' : 'ダ'}${c.distance}m</button>`).join('')}</div>
        <div class="chips" style="margin-top:6px">${caps.map(([v, l]) => `<button class="${st.friendCap === v ? 'active' : ''}" onclick="UI.state.friendCap=${v};UI.render()">能力 ${l}</button>`).join('')}</div>
        ${can.ok ? `<button class="btn primary big" onclick="App.prepareFriend('${h.id}')">🏁 対戦スタート（${Util.esc(h.name)}）</button>` : `<p class="lock">🔒 ${can.reason}</p>`}
      </section>`;
  },

  // ─────────── 出走表・作戦（レース前の共通部品） ───────────
  // 作戦のおすすめ：脚質とコースから
  suggestOrder(h, race) {
    const L = Race.courseOf(race).L;
    const cat = Horse.distCat(race.distance);
    if (h.runningStyle === 'nige' || h.runningStyle === 'senko') return L <= 330 ? 'push' : cat === 'long' ? 'early' : 'normal';
    if (L >= 450) return 'hold';
    if (cat === 'long' && h.stats.stamina >= h.stats.speed) return 'early';
    return 'normal';
  },
  orderPicker(h, race) {
    const st = this.state;
    if (!GAME_DATA.orders[st.order]) st.order = 'normal';
    const rec = this.suggestOrder(h, race);
    const o = GAME_DATA.orders[st.order];
    return `<div class="order-pick"><h4>🗣 作戦 ${this.help('order')}</h4>
      <div class="chips">${Object.entries(GAME_DATA.orders).map(([k, v]) => `<button class="${st.order === k ? 'active' : ''}" onclick="UI.setOrder('${k}')">${v.icon}${v.label}${k === rec ? '<small class="rec-dot">おすすめ</small>' : ''}</button>`).join('')}</div>
      <p class="muted small" id="order-desc">${o.icon} ${o.desc}</p></div>`;
  },
  setOrder(k) {
    this.state.order = k;
    document.querySelectorAll('.order-pick .chips button').forEach((b, i) => b.classList.toggle('active', Object.keys(GAME_DATA.orders)[i] === k));
    const d = this.el('order-desc');
    if (d) d.textContent = `${GAME_DATA.orders[k].icon} ${GAME_DATA.orders[k].desc}`;
    if (Online.status === 'lobby') Online.setOrder(k);
  },
  // 馬番・人気・単勝オッズつきの出走表
  entryTable(field, opts = {}) {
    const n = field.length;
    return `<table class="entry-table"><thead><tr><th>枠</th><th>馬番</th><th>馬名</th><th>人気</th><th>単勝</th></tr></thead><tbody>
      ${field.map((e, i) => {
        const b = Race3D.bracketOf(i + 1, n);
        const st = GAME_DATA.styles[e.runningStyle];
        return `<tr class="${e.isPlayer ? 'me' : ''} ${e.isLegend ? 'is-legend' : ''}">
          <td><span class="waku" style="background:${Race3D.BRACKET_COLORS[b - 1]};color:${Race3D.BRACKET_TEXT[b - 1]}">${b}</span></td><td>${i + 1}</td>
          <td>${st ? st.icon : ''} ${e.isLegend ? '👑' : ''}${Util.esc(e.name)}${e.isPlayer ? ' <b class="me-mark">◀ あなた</b>' : ''}
            ${e.isLegend ? `<br><small>${Util.esc(Legends.get(e.legendId).wins)}</small>` : opts.owner && e.owner ? `<br><small class="muted">${Util.esc(e.owner)}</small>` : ''}</td>
          <td class="${e.pop <= 3 ? 'fav' : ''}">${e.pop ? e.pop + '番人気' : '-'}</td><td>${e.odds ? e.odds.toFixed(1) : '-'}</td></tr>`;
      }).join('')}</tbody></table>`;
  },

  // ─────────── カスタムレース（ひとり／オンライン） ───────────
  customView(h) {
    const st = this.state;
    const spec = st.customSpec = Pvp.sanitizeSpec(st.customSpec || Pvp.CUSTOM_DEFAULT);
    if (Online.status === 'lobby' || Online.status === 'connecting') return this.lobbyView(h);
    const sel = (key, opts) => `<select onchange="App.setSpec('${key}',this.value)">${opts.map(([v, l]) => `<option value="${v}" ${String(spec[key]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const venues = Object.entries(GAME_DATA.courses).map(([v, c]) => [v, `${v}（${c.dir === 'L' ? '左' : '右'}回り）`]);
    const course = Race.courseOf(Pvp.customRace(spec));
    const hint = Race.courseHint(Pvp.customRace(spec));
    const c = Player.data.custom || { races: 0, wins: 0, online: 0, onlineWins: 0 };
    return `<section class="panel custom-panel">
        <h3>🛠 カスタムレースを作る</h3>
        <div class="custom-form">
          <label>レース名<input maxlength="16" value="${Util.esc(spec.name)}" onchange="App.setSpec('name',this.value)"></label>
          <label>競馬場${sel('venue', venues)}</label>
          <label>コース${sel('surface', [['turf', '🌱 芝'], ['dirt', '🟫 ダート']])}</label>
          <label>距離${sel('distance', Pvp.customDistances(spec.venue, spec.surface).map(d => [d, d + 'm' + (course.straight && d === spec.distance ? '（直線）' : '')]))}</label>
          <label>格${sel('grade', Object.entries(Pvp.CUSTOM_GRADES))}</label>
          <label>馬場状態${sel('ground', [[-1, 'ランダム'], ...GAME_DATA.grounds.map(g => [g.key, g.label])])}</label>
          <label>能力上限${sel('cap', Pvp.CUSTOM_CAPS.map(v => [v, v ? '最大' + v : 'なし']))}</label>
          <label>頭数${sel('field', Array.from({ length: 17 }, (_, i) => [i + 2, (i + 2) + '頭']))}</label>
          <label>CPUの馬${sel('cpu', Object.entries(Pvp.CPU_LEVELS).map(([k, v]) => [k, v.label]))}</label>
          <label>👑 名馬${sel('legends', [0, 1, 2, 3].map(n => [n, n ? n + '頭' : 'なし']))}</label>
        </div>
        <p class="course-note">🔄 ${Pvp.specText(spec)}<br><small class="muted">${Util.esc(course.note || '')}${hint ? '・' + hint : ''}</small></p>
        <button class="btn primary big" onclick="App.customSolo()">🏁 ひとりで走る（${Util.esc(h.name)}）</button>
      </section>
      <section class="panel online-panel">
        <h3>🌐 オンラインで走る</h3>
        <p class="muted small">ルームを作って6文字のルームコードをフレンドに送ると、同じレースをリアルタイムで一緒に観戦できます（最大${spec.field}頭）。足りない枠はCPU・名馬で埋まります。</p>
        ${Online.available() ? '' : '<p class="warn">⚠ オンライン機能を読み込めませんでした。</p>'}
        ${Online.status === 'error' ? `<p class="warn">⚠ ${Util.esc(Online.error)}</p>` : ''}
        <button class="btn primary" ${Online.available() ? '' : 'disabled'} onclick="App.customHost()">🏠 この条件でルームを作る</button>
        <div class="join-row"><input id="join-code" maxlength="6" autocomplete="off" placeholder="ルームコード" value="${Util.esc(st.joinCode || '')}" oninput="UI.state.joinCode=this.value">
          <button class="btn primary" ${Online.available() ? '' : 'disabled'} onclick="App.customJoin()">🚪 参加する</button></div>
        <p class="muted small">出走馬：<b>${Util.esc(h.name)}</b>（上のボタンで変更）。カスタムレースはエキシビション：賞金・経験値・疲労はありません。</p>
      </section>
      <p class="muted small light">カスタムレース ${c.races}戦${c.wins}勝（うちオンライン ${c.online}戦${c.onlineWins}勝）</p>`;
  },

  lobbyView(h) {
    const on = Online;
    if (on.status === 'connecting') {
      return `<section class="panel center"><div class="spinner"></div><p>${on.role === 'host' ? 'ルームを作っています…' : `ルーム ${Util.esc(on.code)} に接続中…`}</p>
        <button class="btn" onclick="App.customLeave()">やめる</button></section>`;
    }
    const spec = on.spec;
    const host = on.role === 'host';
    const me = on.members.find(m => m.id === on.myId);
    const url = on.inviteUrl();
    return `<section class="panel lobby">
        <div class="room-code"><span>ルームコード</span><b id="room-code">${Util.esc(on.code)}</b><button class="btn small" onclick="App.copyRoom()">📋 コピー</button></div>
        ${url ? `<p class="muted small center">招待リンク：<a href="${Util.esc(url)}" target="_blank" rel="noopener">${Util.esc(url)}</a></p>` : ''}
        <div class="lobby-spec">${UI.gradeBadge(spec.grade)} <b>${Util.esc(spec.name)}</b><br>
          <small>${Util.esc(Pvp.specText(spec))}・馬場 ${spec.ground >= 0 ? GAME_DATA.grounds[spec.ground].label : 'ランダム'}・能力上限 ${spec.cap || 'なし'}・CPU ${Pvp.CPU_LEVELS[spec.cpu].label}・名馬 ${spec.legends}頭</small></div>
        <h4>参加者 ${on.members.length}/${spec.field}</h4>
        <ol class="entry-list wide lobby-list">${on.members.map(m => `<li class="${m.id === on.myId ? 'me' : ''}">
          ${m.host ? '🏠' : '🙋'} ${GAME_DATA.styles[m.horse.style] ? GAME_DATA.styles[m.horse.style].icon : ''} <b>${Util.esc(m.horse.name)}</b>
          <small class="muted">${Util.esc(m.owner)}厩舎・総合 ${Util.grade(m.horse.overall)}${m.ready ? '' : '・📺 観戦中'}</small></li>`).join('')}</ol>
        ${this.orderPicker(h, Pvp.customRace(spec))}
        ${host ? `<button class="btn primary big" onclick="Online.start()">🏁 レーススタート！</button>
          <p class="muted small">${on.members.length < 2 ? '参加者を待っています。ひとりでもスタートできます。' : 'みんなそろったらスタート！'}</p>`
          : '<p class="ok center">⏳ ホストがスタートするのを待っています…</p>'}
        <div class="btn-row">
          ${me && me.horse.name !== h.name ? `<button class="btn" onclick="App.customChangeHorse()">🔄 出走馬を${Util.esc(h.name)}に変更</button>` : ''}
          <button class="btn danger" onclick="App.customLeave()">${host ? 'ルームを解散' : '退出する'}</button>
        </div>
      </section>`;
  },

  // 名馬との対戦成績（100頭）
  legendBook() {
    const ls = Legends.stats();
    const recs = Player.data.legends || {};
    const tiers = [['S', '伝説級'], ['A', '名馬'], ['B', '実力馬']];
    return `<section class="panel"><h3>👑 名馬との対戦成績 ${this.help('legend')}</h3>
      <p class="muted small">対戦 ${ls.met}/${ls.total}頭・先着 ${ls.beaten}頭・名馬カード ${ls.cards}枚</p>
      ${tiers.map(([t, label]) => `<details ${t === 'S' ? 'open' : ''}><summary>${label}（${Legends.all().filter(l => l.tier === t).length}頭）</summary>
        <div class="legend-grid">${Legends.all().filter(l => l.tier === t).map(l => {
          const r = recs[l.id];
          const card = Player.data.seenCards.includes('lc_' + l.id);
          return `<div class="lg ${r ? 'met' : ''} ${card ? 'got' : ''}" title="${Util.esc(l.wins)}">
            <b>${r || card ? Util.esc(l.name) : '？？？'}</b>
            <small>${r ? `${r.beaten}勝${r.lost}敗` : '未対戦'}${card ? '・🃏' : ''}</small></div>`;
        }).join('')}</div></details>`).join('')}
    </section>`;
  },

  // ─────────── 記録・ランキング ───────────
  recordsView() {
    const p = Player.data;
    const all = [
      ...p.horses.map(h => ({ name: h.name, rarity: h.rarity, record: h.record, tag: '現役' })),
      ...p.hallOfFame.map(e => ({ name: e.name, rarity: e.rarity, record: e.record, tag: '🏛殿堂' })),
      ...p.retired.map(e => ({ name: e.name, rarity: e.rarity, record: e.record, tag: '引退' }))
    ];
    const rank = (key, label, fmt) => {
      const list = all.filter(x => x.record[key] > 0).sort((a, b) => b.record[key] - a.record[key]).slice(0, 10);
      return `<section class="panel"><h3>${label}</h3>${list.length ? `<table class="hist">${list.map((x, i) => `<tr><td class="rank r${i + 1}">${i + 1}</td><td>${this.rarity(x.rarity)} ${Util.esc(x.name)} <small class="muted">${x.tag}</small></td><td class="num">${fmt(x.record[key])}</td></tr>`).join('')}</table>` : '<p class="muted">まだ記録がありません。</p>'}</section>`;
    };
    const recs = Object.entries(p.records).filter(([, v]) => v.raceName)
      .map(([id, v]) => ({ id, name: v.raceName, grade: v.grade, distance: v.distance, surface: v.surface }))
      .sort((a, b) => GAME_DATA.grades[b.grade].order - GAME_DATA.grades[a.grade].order);
    return `<button class="back" onclick="UI.show('home')">◀ ホーム</button>
      <h2 class="screen-title">📊 記録・ランキング</h2>
      <section class="panel"><h3>👤 オーナー成績</h3>
        <div class="hero-stats">
          <div><small>通算出走</small><b>${p.stats.raceCount}</b></div>
          <div><small>通算勝利</small><b>${p.stats.winCount}</b></div>
          <div><small>GⅠ勝利</small><b>${p.stats.g1WinCount}</b></div>
          <div><small>レーティング</small><b>${p.pvp.rating}</b></div>
        </div>
      </section>
      ${rank('prizeMoney', '💰 獲得賞金ランキング', v => Util.money(v))}
      ${rank('wins', '🏆 勝利数ランキング', v => v + '勝')}
      ${rank('g1Wins', '👑 GⅠ勝利数ランキング', v => v + '勝')}
      ${this.legendBook()}
      <section class="panel"><h3>⏱ コースレコード</h3>
        ${recs.length ? `<table class="hist"><tr><th>レース</th><th>タイム</th><th>馬名</th></tr>${recs.map(r => `<tr><td>${this.gradeBadge(r.grade)}${r.name}<br><small class="muted">${r.surface === 'turf' ? '芝' : 'ダ'}${r.distance}m</small></td><td class="num">${Race.timeText(p.records[r.id].time)}</td><td>${Util.esc(p.records[r.id].name)}</td></tr>`).join('')}</table>` : '<p class="muted">レースに出るとタイムが記録されます。</p>'}
      </section>`;
  }
};

// ─────────── レース再生（表示のみ） ───────────
// Race.simulate() の結果（frames = 0.5秒ごとの全馬の位置、events = 実況）を
// 時計に合わせて再生する。2Dトラック・実況ログ・順位表を同じ時計で動かす。
const RaceView = {
  ctx: null,       // { result, reward, race, horseId, resultHTML? }
  raf: null,
  clock: 0,        // レース内の経過秒
  lastTs: null,
  idx: 0,          // 次に表示するイベント
  done: false,
  skipping: false,
  lastOrderAt: 0,
  RATE: 9,         // 実時間1秒あたりに進むレース秒（×1のとき・2D）
  RATE_3D: 1,      // 3Dは実際のレースと同じ速さ（×1で1秒＝1秒）
  PREROLL: 2.2,    // 3Dのゲートイン演出（秒）
  WINDOW: 44,      // トラックに映す範囲（m）

  // 3Dで表示するか（WebGLが使え、設定で2Dにしていない）
  use3d() { return typeof Race3D !== 'undefined' && Race3D.supported() && Player.data.settings.raceView !== '2d'; },

  start(ctx) {
    this.stop();
    this.ctx = ctx;
    this._confettiDone = false;
    // 3Dはゲートイン中にファンファーレ（区分は競馬場と格で決まる）。曲の長さだけ待つ
    ctx.slot = Fanfare.slotFor(ctx.race);
    ctx.preroll = Player.data.settings.sound3d === false ? this.PREROLL : Math.max(this.PREROLL, Fanfare.length(ctx.slot) + 1);
    this.clock = this.use3d() ? -ctx.preroll : 0;
    this.idx = 0;
    this.done = false;
    this.lastTs = null;
    const fin = ctx.result.finish;
    this.endTime = Math.min(fin[fin.length - 1].time || 0, fin[0].time + 6) + 0.6;
    UI.show('raceView');
  },

  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; },

  speed() { return Player.data.settings.raceSpeed || 1; },

  entrant(id) { return this.ctx.result.entrants.find(e => e.id === id); },

  view() {
    if (!this.ctx) return '<div class="empty">レースがありません</div>';
    const { result, race } = this.ctx;
    const ground = GAME_DATA.grounds[result.ground].label;
    const sl = GAME_DATA.surfaces.find(s => s.key === result.surface);
    const lanes = result.entrants.slice().sort((a, b) => a.gate - b.gate);
    const three = this.use3d();
    const toggle = typeof Race3D !== 'undefined' && Race3D.supported()
      ? `<button onclick="RaceView.toggle3d()">${three ? '🗺 2D表示' : '🎥 3D表示'}</button>` : '';
    return `<section class="race-live ${three ? 'is3d' : ''}">
        <div class="rl-title">🏇 ${UI.gradeBadge(race.grade)} ${Util.esc(race.name)}</div>
        <div class="rl-info">${sl.icon}${sl.label} ${result.distance}m・馬場：${ground}${UI.help('ground')}・${result.finish.length}頭</div>
        ${three ? '<div class="r3-wrap" id="r3"></div>' : ''}
        <div class="track ${result.surface} ${three ? 'hidden' : ''}" id="rl-track">
          <div class="track-remain" id="rl-remain">スタート</div>
          <div class="track-goal" id="rl-goal"></div>
          ${[0, 1, 2, 3, 4].map(i => `<div class="track-post" data-i="${i}"></div>`).join('')}
          ${lanes.map((e, i) => `<div class="lane ${e.isPlayer ? 'me' : ''}" style="top:${i * (100 / lanes.length)}%;height:${100 / lanes.length}%">
              <div class="runner" id="rn-${e.id}"><span class="gate">${e.gate}</span><span class="horse">🏇</span>${e.isPlayer ? `<span class="me-tag">${Util.esc(e.name)}</span>` : ''}</div>
            </div>`).join('')}
        </div>
        <div class="rl-progress"><div id="rl-bar" class="bar-fill" style="width:0%"></div></div>
        <div class="rl-controls">
          ${[1, 2, 4].map(s => `<button class="${this.speed() === s ? 'active' : ''}" onclick="RaceView.setSpeed(${s})">×${s}</button>`).join('')}
          <button onclick="RaceView.skip()">⏭ スキップ</button>
          ${toggle}
        </div>
      </section>
      <div class="race-split">
        <section class="panel standings"><h3>順位</h3><ol id="rl-order"></ol></section>
        <section class="panel log"><h3>実況</h3><div id="rl-log"></div></section>
      </div>
      <div id="rl-result"></div>`;
  },

  mount() {
    this.stop();
    this.three = this.use3d() && Race3D.mount(UI.el('r3'), this.ctx);
    if (!this.three) {
      // 3Dが使えなかったら2Dに切り替え
      const w = UI.el('r3');
      if (w) w.remove();
      const tr = UI.el('rl-track');
      if (tr) tr.classList.remove('hidden');
      if (this.clock < 0) this.clock = 0;
    }
    const log = UI.el('rl-log');
    this.ctx.result.events.slice(0, this.idx).forEach(e => log.insertAdjacentHTML('afterbegin', this.eventHTML(e)));
    this.draw(true);
    if (this.done) { this.showResult(); return; }
    this.lastTs = null;
    this.raf = requestAnimationFrame(ts => this.tick(ts));
  },

  setSpeed(s) {
    Player.data.settings.raceSpeed = s;
    Player.save();
    document.querySelectorAll('.rl-controls button').forEach(b => b.classList.toggle('active', b.textContent === '×' + s));
  },

  // 3D表示で問題が起きたら、その場で2D表示に切り替えて続ける
  fallback2d() {
    console.warn('3D表示を続けられないため2D表示に切り替えます');
    this.three = false;
    Race3D.failed = true;
    Fanfare.stop();
    try { Race3D.unmount(); } catch (e) { /* noop */ }
    const w = UI.el('r3');
    if (w) w.remove();
    const tr = UI.el('rl-track');
    if (tr) tr.classList.remove('hidden');
    if (this.clock < 0) this.clock = 0;
    UI.toast('3D表示を続けられなかったため、2D表示に切り替えました');
  },

  toggle3d() {
    Player.data.settings.raceView = this.use3d() ? '2d' : '3d';
    Player.save();
    if (this.clock < 0) this.clock = 0;
    Race3D.unmount();
    UI.render();
  },

  // 再生速度（3Dはゴール前でスローモーション）
  rate() {
    if (!this.three) return this.RATE * this.speed();
    if (this.clock < 0) return 1;
    const fin = this.ctx.result.finish;
    const lead = Math.max(...this.positionsAt(this.clock));
    const slow = !this.skipping && lead > this.ctx.result.distance - 28 && this.clock < fin[0].time + 0.4;
    return this.RATE_3D * this.speed() * (slow ? 0.5 : 1);
  },

  tick(ts) {
    if (!UI.el('rl-track')) { this.stop(); return; }
    const realDt = this.lastTs !== null ? Math.min(0.25, (ts - this.lastTs) / 1000) : 0;   // 重い端末でも実時間に近く
    this.curRate = this.rate();
    this.clock += realDt * this.curRate;
    this.lastTs = ts;
    const events = this.ctx.result.events;
    while (this.idx < events.length && events[this.idx].t <= this.clock) { this.apply(events[this.idx]); this.idx++; }
    this.draw(false);
    if (this.clock >= this.endTime) { this.finish(); return; }
    this.raf = requestAnimationFrame(t => this.tick(t));
  },

  // 時刻 t の各馬の位置（frames を線形補間）
  positionsAt(t) {
    const frames = this.ctx.result.frames;
    const n = this.ctx.result.entrants.length;
    if (!frames.length || t <= frames[0].t) {
      const f0 = frames[0];
      return f0 ? f0.pos.map(p => p * Math.max(0, t) / f0.t) : new Array(n).fill(0);
    }
    let i = frames.findIndex(f => f.t >= t);
    if (i === -1) return frames[frames.length - 1].pos.slice();
    const a = frames[i - 1], b = frames[i];
    const k = (t - a.t) / (b.t - a.t);
    return a.pos.map((p, j) => p + (b.pos[j] - p) * k);
  },

  draw(force) {
    if (this.three) {
      const t = this.done ? this.endTime : this.clock;
      const anim = this.clock < 0 ? 1 : Util.clamp((this.curRate || this.RATE_3D) / this.RATE_3D, 0.3, 1.6);
      try {
        if (Race3D.lost) throw new Error('WebGL context lost');
        Race3D.render(t, this.positionsAt(Math.max(0, t)), anim, (this.curRate || this.RATE_3D) / this.RATE_3D);
      } catch (e) {
        this.fallback2d();
      }
    }
    const result = this.ctx.result;
    const D = result.distance;
    const pos = this.positionsAt(this.done ? this.endTime : this.clock);
    const leader = Math.max(...pos);
    const right = Math.min(leader + this.WINDOW * 0.18, D + this.WINDOW * 0.25);
    const left = right - this.WINDOW;
    const toX = p => Util.clamp((p - left) / this.WINDOW * 100, 0, 100);
    result.entrants.forEach((e, j) => {
      const el = UI.el('rn-' + e.id);
      if (el) {
        el.style.left = toX(pos[j]) + '%';
        el.classList.toggle('behind', pos[j] < left);
      }
    });
    // 10mごとのハロン棒風マーカーで流れる感じを出す
    document.querySelectorAll('.track-post').forEach(el => {
      const i = Number(el.dataset.i);
      const p = Math.floor(left / 10) * 10 + i * 10 + 10;
      el.style.left = toX(p) + '%';
      el.style.display = p > D ? 'none' : '';
    });
    const goal = UI.el('rl-goal');
    if (goal) {
      goal.style.display = D <= right ? '' : 'none';
      goal.style.left = toX(D) + '%';
    }
    const remain = UI.el('rl-remain');
    if (remain) remain.textContent = leader >= D ? 'ゴール！' : this.clock < 0.5 ? 'スタート' : `残り ${Math.ceil((D - leader) / 100) * 100}m`;
    const bar = UI.el('rl-bar');
    if (bar) bar.style.width = Math.min(100, leader / D * 100) + '%';

    // 順位表は0.25秒ごとに更新（ゴール済みはゴール順）
    const now = performance.now();
    if (force || now - this.lastOrderAt > 250) {
      this.lastOrderAt = now;
      const t = this.done ? Infinity : this.clock;
      const finishTime = id => { const f = result.finish.find(x => x.id === id); return f && f.time <= t ? f.time : null; };
      const order = result.entrants.map((e, j) => ({ e, p: pos[j], ft: finishTime(e.id) }))
        .sort((a, b) => (a.ft !== null && b.ft !== null ? a.ft - b.ft : a.ft !== null ? -1 : b.ft !== null ? 1 : b.p - a.p));
      this.renderOrder(order, order[0] ? order[0].p : 0);
    }
  },

  renderOrder(order, leadPos) {
    const ol = UI.el('rl-order');
    if (!ol) return;
    ol.innerHTML = order.map((o, i) => {
      const st = GAME_DATA.styles[o.e.style];
      const gap = i > 0 && o.ft === null ? `<small>${((leadPos - o.p) / 2.4).toFixed(1)}馬身</small>` : '';
      return `<li class="${o.e.isPlayer ? 'me' : ''} ${o.e.isGhost ? 'ghost' : ''}"><span class="pos">${i + 1}</span><span title="${st.label}">${st.icon}</span> ${o.e.legendId ? '👑' : ''}${Util.esc(o.e.name)} ${gap}</li>`;
    }).join('');
  },

  // 実況の読み上げをしてよいか（3D・等倍・再生中のみ）
  voiceOk() { return !!this.three && !this.skipping && !this.done && !this.replaying && this.speed() === 1 && this.clock >= -0.5; },

  speak(e) {
    if (typeof Voice === 'undefined' || !this.voiceOk()) return;
    const fin = this.ctx.result.finish;
    if (e.type === 'checkpoint') {
      if (e.key === 'goal' && fin[1] && fin[1].time - fin[0].time < 0.06) return;   // 写真判定のときは結果を言わない
      Voice.say(e.text, { interrupt: ['start', 'r400', 'r200', 'goal'].includes(e.key) });
    } else if (e.type === 'incident') {
      if (e.isPlayer || Math.random() < 0.5) Voice.say(e.text, { interrupt: e.isPlayer });
    } else if (e.type === 'skill') {
      if (e.isPlayer) Voice.say(`${e.sub.split(' ')[0]}、${e.text.replace(/発動！/, '')}！`);
    } else Voice.say(e.text);
  },

  eventHTML(e) {
    if (e.type === 'incident') return `<div class="ev incident ${e.isPlayer ? 'me' : ''}">⚠ ${Util.esc(e.text)}</div>`;
    if (e.type === 'checkpoint') return `<div class="ev cp"><span class="cp-label">── ${e.label} ──</span><br>${Util.esc(e.text)}</div>`;
    if (e.type === 'skill') {
      return `<div class="ev skill ${e.isPlayer ? 'me' : ''}">${e.text}<br><small>${Util.esc(e.sub)}${e.isPlayer && !e.matched ? '（脚質不一致）' : ''}</small></div>`;
    }
    return `<div class="ev ${e.isPlayer ? 'me' : ''}">${Util.esc(e.text)}</div>`;
  },

  apply(e) {
    const log = UI.el('rl-log');
    if (!log) return;
    log.insertAdjacentHTML('afterbegin', this.eventHTML(e));
    if (!this.skipping) this.speak(e);
    if (e.type === 'incident' && !this.skipping) {
      if (this.three) Race3D.onIncident(e);
      else if (e.isPlayer) UI.toast(`⚠ ${Util.esc(e.text)}`, 'skill-toast');
    }
    if (e.type === 'skill' && !this.skipping) {
      const el = UI.el('rn-' + e.horseId);
      if (el) {
        el.classList.remove('boost');
        void el.offsetWidth;
        el.classList.add('boost');
        el.setAttribute('data-skill', e.text.replace(/[「」]|発動！/g, ''));
      }
      if (this.three) Race3D.onSkill(e);
      else if (e.isPlayer) UI.toast(`${e.text}<br>${Util.esc(e.sub)}`, 'skill-toast');
    }
  },

  skip() {
    this.stop();
    Fanfare.stop();
    if (typeof Voice !== 'undefined') Voice.stop();
    const events = this.ctx.result.events;
    this.skipping = true;
    while (this.idx < events.length) { this.apply(events[this.idx]); this.idx++; }
    this.skipping = false;
    this.finish();
  },

  finish() {
    this.stop();
    if (this.done) return;
    this.done = true;
    this.clock = this.endTime;
    this.draw(true);
    this.showResult();
    if (this.three) this.coolDown();
  },

  // ゴール前リプレイ（3D）：ゴール10秒前からスローで再生
  replay() {
    if (!this.three || !Race3D.state) return;
    this.stop();
    const ft = this.ctx.result.finish[0].time;
    let t = Math.max(0, ft - 10), last = null;
    const st = Race3D.state;
    st.goalShown = false;
    st.startShown = true;
    st.shot = null;
    st.replaying = true;
    this.replaying = true;
    const rp = UI.el('r3-replay');
    if (rp) rp.classList.add('show');
    UI.el('r3').scrollIntoView({ behavior: 'smooth', block: 'center' });
    const loop = ts => {
      if (!UI.el('r3') || !Race3D.state) return;
      if (last !== null) {
        const near = t > ft - 2 && t < ft + 0.6;
        t += Math.min(0.1, (ts - last) / 1000) * (near ? 0.4 : 1);
      }
      last = ts;
      try { Race3D.render(t, this.positionsAt(t), t > ft - 2 && t < ft + 0.6 ? 0.4 : 1); } catch (e) { this.fallback2d(); return; }
      if (t < ft + 3) this.raf = requestAnimationFrame(loop);
      else { if (rp) rp.classList.remove('show'); st.replaying = false; this.replaying = false; }
    };
    this.raf = requestAnimationFrame(loop);
  },

  // ゴール後：馬が流して減速していく様子をしばらく映す
  coolDown() {
    let t = this.endTime, last = null;
    const loop = ts => {
      if (!UI.el('r3') || !Race3D.state) return;
      if (last !== null) t += Math.min(0.1, (ts - last) / 1000);
      last = ts;
      try { Race3D.render(t, this.positionsAt(t), 1); } catch (e) { return; }
      if (t < this.endTime + 10) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },

  // 成績表：着順・馬番・人気・タイム・着差・通過順・上がり3F（最速は🔥）
  resultTable(fin) {
    const l3 = fin.map(f => f.last3f).filter(v => v);
    const best = l3.length ? Math.min(...l3) : null;
    const hasPass = fin.some(f => f.passing && f.passing.length);
    return `<div class="table-scroll"><table class="hist result-table">
        <tr><th>着</th><th>馬名</th><th>人気</th><th>タイム</th><th>着差</th>${hasPass ? '<th>通過</th>' : ''}<th>上がり</th></tr>
        ${fin.map(f => {
          const e = this.entrant(f.id) || {};
          const ord = f.order && f.order !== 'normal' && GAME_DATA.orders[f.order] ? `<span class="ord" title="作戦：${GAME_DATA.orders[f.order].label}">${GAME_DATA.orders[f.order].icon}</span>` : '';
          return `<tr class="${f.isPlayer ? 'me' : ''} ${f.legendId ? 'is-legend' : ''}"><td>${f.place}</td>
            <td><span class="gnum">${e.gate || ''}</span>${GAME_DATA.styles[f.style].icon} ${f.legendId ? '👑' : ''}${Util.esc(f.name)}${f.isPlayer ? ord : ''}${e.owner && !f.legendId ? `<br><small class="muted">${Util.esc(e.owner)}</small>` : ''}</td>
            <td class="${f.pop && f.pop <= 3 ? 'fav' : ''}">${f.pop || '-'}</td><td>${Race.timeText(f.time)}</td><td>${f.margin}</td>
            ${hasPass ? `<td class="pass">${(f.passing || []).join('-')}</td>` : ''}
            <td class="${f.last3f && f.last3f === best ? 'best3f' : ''}">${f.last3f ? f.last3f.toFixed(1) + (f.last3f === best ? '🔥' : '') : '-'}</td></tr>`;
        }).join('')}
      </table></div>`;
  },

  // レースのふり返り：自分の馬の人気・作戦・アクシデント・上がり
  reviewHTML() {
    const { result } = this.ctx;
    const me = result.finish.find(f => f.isPlayer);
    if (!me) return '';
    const notes = [];
    if (me.pop) notes.push(`📊 ${me.pop}番人気（単勝 ${me.odds ? me.odds.toFixed(1) : '-'}倍）`);
    if (me.order && GAME_DATA.orders[me.order]) notes.push(`🗣 作戦：${GAME_DATA.orders[me.order].icon}${GAME_DATA.orders[me.order].label}`);
    if (me.passing && me.passing.length) notes.push(`🔁 通過順 ${me.passing.join('-')}`);
    const l3 = result.finish.map(f => f.last3f).filter(v => v);
    if (me.last3f) notes.push(`⏱ 上がり3F ${me.last3f.toFixed(1)}（${l3.filter(v => v < me.last3f).length + 1}位）`);
    result.events.filter(e => e.type === 'incident' && e.isPlayer).forEach(e => notes.push(`⚠ ${Util.esc(e.text)}`));
    return `<div class="review">${notes.map(n => `<span>${n}</span>`).join('')}</div>`;
  },

  // 名馬との対決結果
  legendHTML(lg) {
    if (!lg || !lg.met.length) return '';
    return `<div class="legend-vs"><b>👑 名馬との対決</b>${lg.met.map(l => {
      const won = lg.beaten.includes(l);
      return `<div class="${won ? 'ok' : 'muted'}">${won ? '○ 先着' : '● 敗戦'}：${Util.esc(l.name)} <small>（${Util.esc(l.wins)}）</small></div>`;
    }).join('')}${lg.card ? `<div class="ok">🎉 ${Util.esc(lg.card.card.name)}の名馬カードを手に入れた！ 配合で血を受け継げます。</div>` : lg.beaten.length ? '<div class="muted small">今回はカードを落としませんでした…</div>' : ''}</div>`;
  },

  placeHead(place, winnerName) {
    return place === 1 ? `<div class="result-big win">🏆 1着！</div><p class="center">${Util.esc(winnerName)}、見事な勝利！</p>`
      : place <= 3 ? `<div class="result-big place">🥈 ${place}着</div><p class="center">あと少し！ 惜しいレースでした。</p>`
      : `<div class="result-big">${place}着</div><p class="center">次は調教で鍛えて、リベンジしよう！</p>`;
  },

  cardsHTML(cards) {
    return cards.map((x, i) => `<div class="reveal" style="animation-delay:${0.3 + i * 0.4}s">${x.isNew ? '<span class="new">NEW!</span>' : ''}${UI.anyCard(x.card, {})}</div>`).join('');
  },

  showResult() {
    const { result, reward, horseId } = this.ctx;
    const fin = result.finish;
    const h = Player.horse(horseId);
    let body;
    if (this.ctx.resultHTML) {
      body = this.ctx.resultHTML(this);
    } else {
      const cards = this.cardsHTML(reward.cards);
      body = `${this.placeHead(reward.place, fin[0].name)}
        ${reward.newRecord ? '<p class="center ok">⏱ コースレコード更新！</p>' : ''}
        ${this.legendHTML(reward.legends)}
        ${reward.rightTo ? `<p class="center ok big-note">🎫「${reward.rightTo.name}」の優先出走権を獲得！</p>` : ''}
        ${reward.bonus ? `<p class="center ok big-note">🎯 ${reward.pop}番人気で大金星！ ボーナス +${Util.money(reward.bonus)}</p>` : ''}
        ${this.reviewHTML()}
        ${this.resultTable(fin)}
        <h3>🎁 報酬</h3>
        <div class="rewards">
          <div>💰 賞金 <b>${Util.money(reward.prize)}</b></div>
          <div>✨ 経験値 <b>+${reward.exp}</b>${reward.levelUps ? ` <span class="ok">レベルアップ！ Lv.${h ? h.level : ''}</span>` : ''}</div>
          ${reward.birthday && h ? `<div>🎂 ${Util.esc(h.name)}は${h.age}歳になりました！</div>` : ''}
        </div>
        ${cards ? `<h3>🃏 カード獲得！</h3><div class="cgrid reveal-grid">${cards}</div>` : '<p class="muted">カードは獲得できませんでした（1着で確定、2〜3着で50%）。</p>'}
        ${h && Horse.mustRetire(h) ? `<p class="notice">🎌 ${Util.esc(h.name)}は引退の時期を迎えました。</p>` : ''}
        <div class="btn-row">
          ${this.three ? '<button class="btn" onclick="RaceView.replay()">🎬 ゴール前リプレイ</button>' : ''}
          <button class="btn" onclick="UI.show('horse',{id:'${horseId}'})">🐎 馬の詳細へ</button>
          <button class="btn primary" onclick="UI.show('race')">🏇 レース選択へ</button>
        </div>`;
    }
    UI.el('rl-result').innerHTML = `<section class="panel result">${body}</section>`;
    if (reward.place === 1 && !this._confettiDone) { this._confettiDone = true; UI.confetti(); }
    UI.el('rl-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};
