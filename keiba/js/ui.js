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
    friendCap: 0
  },

  el(id) { return document.getElementById(id); },

  show(screen, params = {}) {
    this.state.screen = screen;
    this.state.params = params;
    if (typeof RaceView !== 'undefined' && screen !== 'raceView') RaceView.stop();
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
    this.el('main').innerHTML = (views[s] || views.home)();
    const navKey = { horse: 'stable', hof: 'home', records: 'home', raceView: 'race' }[s] || s;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === navKey));
    if (s === 'raceView') RaceView.mount();
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

  aptGrid(apt) {
    const d = GAME_DATA.distances.map(x => `<div class="apt"><span>${x.label}</span><b>${Util.stars(apt[x.key])}</b><small>${Util.aptMark(apt[x.key])}</small></div>`).join('');
    const s = GAME_DATA.surfaces.map(x => `<div class="apt"><span>${x.icon}${x.label}</span><b>${Util.stars(apt[x.key])}</b><small>${Util.aptMark(apt[x.key])}</small></div>`).join('');
    return `<div class="apt-title">距離${this.help('distance')}</div><div class="apt-grid">${d}</div>
      <div class="apt-title">馬場${this.help('surface')}</div><div class="apt-grid">${s}</div>`;
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
      <div class="gcard-art">${c.type === 'sire' ? '🐎' : '🦄'}${c.custom ? '<span class="legend">🏛</span>' : ''}</div>
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
    return `<div class="gcard silhouette rcard-${c.rarity}"><div class="gcard-head">${this.rarity(c.rarity)}<span class="gtype">${Cards.types[c.type].label}</span></div>
      <div class="gcard-art">❔</div><div class="gcard-name">？？？？</div><div class="gcard-desc">まだ見つけていないカード</div></div>`;
  },

  // 競走馬カード（厩舎一覧用）
  horseCard(h, opts = {}) {
    const cond = Horse.conditionInfo(h);
    const fat = Horse.fatigueInfo(h);
    const ov = Horse.overall(h);
    return `<div class="hcard rcard-${h.rarity}" onclick="${opts.onclick !== undefined ? opts.onclick : `UI.show('horse',{id:'${h.id}'})`}">
      <div class="hcard-top">${this.rarity(h.rarity)}<span class="hname">${Util.esc(h.name)}</span><span class="ovr" title="総合評価">${Util.grade(ov)}</span></div>
      <div class="hcard-art">🏇</div>
      <div class="hcard-info">
        <span>${Horse.genderLabel(h)}</span><span>${h.age}歳</span><span>Lv.${h.level}</span>
      </div>
      <div class="hcard-info">
        <span>${Horse.mainAptText(h)}</span>${this.styleTag(h.runningStyle)}
      </div>
      <div class="hcard-info">
        <span class="${cond.cls}">${cond.icon} ${cond.label}</span><span class="${fat.cls}">😓 ${fat.label}</span>
      </div>
      <div class="hcard-rec">${h.record.races}戦${h.record.wins}勝${h.record.g1Wins ? `・GⅠ ${h.record.g1Wins}勝` : ''}</div>
    </div>`;
  },

  modal(html, opts = {}) {
    const m = this.el('modal');
    m.innerHTML = `<div class="modal-box ${opts.cls || ''}" role="dialog">
      ${opts.noClose ? '' : '<button class="modal-x" onclick="UI.closeModal()" aria-label="閉じる">✕</button>'}${html}</div>`;
    m.classList.add('open');
    m.onclick = e => { if (e.target === m && !opts.noClose) UI.closeModal(); };
  },
  closeModal() { this.el('modal').classList.remove('open'); this.el('modal').innerHTML = ''; },

  toast(msg, type = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = msg;
    const box = this.el('toasts');
    while (box.children.length >= 3) box.firstChild.remove();
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  },

  // ─────────── ホーム ───────────
  homeView() {
    const p = Player.data;
    const m = Missions.current();
    const guide = App.guide();
    const recs = p.horses.filter(h => !Horse.acted(h) && !Horse.mustRetire(h))
      .map(h => ({ h, race: Race.nextRace(h), target: Race.targetRace(h) })).filter(x => x.race || x.target).slice(0, 4);
    const totalCards = Object.values(p.cards).reduce((a, b) => a + b, 0);
    return `
      <section class="hero">
        <div class="hero-name">🏇 ${Util.esc(p.name)} 厩舎 <button class="link" onclick="App.settings()">⚙ 設定</button></div>
        <div class="hero-stats">
          <div><small>所持金</small><b>${Util.money(p.money)}</b></div>
          <div><small>カード</small><b>${totalCards}枚</b></div>
          <div><small>厩舎</small><b>${p.horses.length}/${GAME_DATA.maxStable}頭</b></div>
          <div><small>殿堂馬</small><b>${p.hallOfFame.length}頭</b></div>
        </div>
      </section>

      ${this.datePanel()}

      ${guide ? `<section class="guide" onclick="${guide.action}"><div class="guide-icon">💡</div><div><b>${guide.title}</b><p>${guide.text}</p></div><span class="guide-go">▶</span></section>` : ''}

      ${m ? `<section class="panel mission">
        <h3>📋 今日のミッション</h3>
        <div class="mission-title">${m.title}</div>
        <div class="bar"><div class="bar-fill mission-fill" style="width:${Math.min(100, Missions.progress(m) / m.target * 100)}%"></div></div>
        <p class="muted">${m.hint}</p>
        <div class="mission-reward">報酬：💰${Util.money(m.reward.money)} ${(m.reward.cards || []).map(id => { const c = Cards.get(id); return `${this.rarity(c.rarity)}${c.name}`; }).join(' ')}</div>
        ${Missions.isComplete(m) ? `<button class="btn primary big" onclick="App.claimMission()">🎁 報酬を受け取る</button>` : ''}
      </section>` : `<section class="panel"><h3>📋 ミッション</h3><p>全てのミッションをクリアしました！🎉</p></section>`}

      <section class="panel">
        <h3>🐎 厩舎 <button class="link" onclick="UI.show('stable')">すべて見る ▶</button></h3>
        ${p.horses.length ? `<div class="hgrid">${p.horses.slice(0, 4).map(h => this.horseCard(h)).join('')}</div>`
          : `<p class="muted">まだ馬がいません。配合で最初の馬を作ろう！</p><button class="btn primary" onclick="UI.show('breed')">🧬 配合へ</button>`}
      </section>

      ${recs.length ? `<section class="panel"><h3>🏇 今週のおすすめ・目標</h3>
        ${recs.map(({ h, race, target }) => `<div class="rec-row" onclick="App.goRace('${h.id}')">
          <span class="rec-horse">${Util.esc(h.name)}</span>
          ${race ? `<span>今週 →</span>${this.gradeBadge(race.grade)}<b>${race.name}</b><small>${race.surface === 'turf' ? '芝' : 'ダ'}${race.distance}m</small>` : ''}
          ${target && target.weeks > 0 ? `<span class="rec-target">🎯 ${target.race.name}（あと${target.weeks}週）</span>` : ''}</div>`).join('')}
      </section>` : ''}

      <section class="panel">
        <h3>⚔ 対戦 <button class="link" onclick="UI.state.raceMode='league';UI.show('race')">挑戦する ▶</button></h3>
        <p class="muted">CPU馬主とのリーグ戦や、対戦コードでフレンドの馬と勝負！ レーティング：<b>${p.pvp.rating}</b></p>
      </section>

      <div class="home-links">
        <button class="panel link-card" onclick="UI.show('hof')"><span>🏛</span><b>殿堂</b><small>${p.hallOfFame.length}頭</small></button>
        <button class="panel link-card" onclick="UI.show('records')"><span>📊</span><b>記録・ランキング</b><small>レコードと名馬</small></button>
      </div>

      <section class="panel news">
        <h3>📢 お知らせ</h3>
        <ul>
          <li>競馬×カードゲーム「馬主カード」へようこそ！</li>
          <li>レースで勝つと新しい種牡馬・繁殖牝馬・スキルカードが手に入ります。</li>
          <li>🆕 レースが2Dトラックで見られるようになりました！</li>
          <li>🆕 ⚔ リーグ戦・🤝 対戦コードでフレンド対戦が登場！</li>
          <li>🆕 黄金配合・インブリードなどの特殊配合、血統表、カードパック、記録・ランキングを追加。</li>
          <li>わからない言葉は <span class="help static">？</span> ボタンをタップ！</li>
        </ul>
      </section>`;
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
        <div class="hh-art">🏇</div>
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
        ${STAT_KEYS.map(k => this.statRow(k, h.stats[k], h.caps[k])).join('')}
        <p class="muted small">｜の位置がこの馬の限界（素質）。調教で限界まで伸ばせます。</p>
      </section>
      <section class="panel"><h3>適性</h3>${this.aptGrid(h.aptitude)}</section>
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
        ${items.length ? `<div class="item-list">${items.map(c => `<button class="item-btn" onclick="App.useItem('${h.id}','${c.id}')">
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
      const types = [['all', 'すべて'], ['sire', '♂ 種牡馬'], ['mare', '♀ 繁殖牝馬'], ['skill', '🎴 スキル'], ['item', '🎒 アイテム']];
      const rars = ['all', ...GAME_DATA.rarities];
      const q = st.cardQuery.trim();
      const match = c => (st.cardType === 'all' || c.type === st.cardType) && (st.cardRarity === 'all' || c.rarity === st.cardRarity)
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
      }
    }
    return `<h2 class="screen-title">🃏 カード</h2>
      <div class="seg">${tabs.map(([k, l]) => `<button class="${st.cardTab === k ? 'active' : ''}" onclick="UI.state.cardTab='${k}';UI.render()">${l}</button>`).join('')}</div>
      ${body}`;
  },

  shopView() {
    const items = GAME_DATA.items.filter(i => i.price);
    return `<p class="muted">所持金：<b>${Util.money(Player.data.money)}</b></p>
      <h3 class="sub-title">🃏 カードパック</h3>
      <div class="packs">${GAME_DATA.packs.map(pk => `<div class="pack">
        <div class="pack-icon">${pk.icon}</div><b>${pk.name}</b><small>${pk.desc}</small>
        <button class="btn primary" ${Player.canAfford(pk.price) ? '' : 'disabled'} onclick="App.buyPack('${pk.id}')">💰 ${Util.money(pk.price)}</button>
      </div>`).join('')}</div>
      <h3 class="sub-title">🎒 アイテム</h3>
      <div class="cgrid">${items.map(c => this.itemCard(c, {
        count: Player.count(c.id),
        extra: `<button class="btn small primary" ${Player.canAfford(c.price) ? '' : 'disabled'} onclick="App.buy('${c.id}')">💰 ${Util.money(c.price)}</button>`
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
    const modes = [['week', '🏇 今週'], ['calendar', '📅 日程'], ['league', '⚔ リーグ'], ['friend', '🤝 対戦']];
    const head = `<h2 class="screen-title">🏇 レース <small>📅 ${Calendar.fullLabel()}</small></h2>
      <div class="seg">${modes.map(([k, l]) => `<button class="${st.raceMode === k ? 'active' : ''}" onclick="UI.state.raceMode='${k}';UI.render()">${l}</button>`).join('')}</div>
      ${h ? `<div class="chips horse-pick">${p.horses.map(x => `<button class="${x.id === h.id ? 'active' : ''}" onclick="UI.state.raceHorse='${x.id}';UI.render()">${Horse.acted(x) ? '✅' : ''}${Util.esc(x.name)}</button>`).join('')}</div>` : ''}`;
    if (st.raceMode === 'league') return head + this.leagueView(h);
    if (st.raceMode === 'friend') return head + this.friendView(h);
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
      <div class="rr-info">📍${race.venue} ${sl.icon}${sl.label}${race.distance}m（${dl.label}）・${Race.AGE_LABEL[race.ages]}・${race.field}頭・1着 ${Util.money(race.prize)}</div>
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
      <div class="muted small">📍${r.venue} ${r.surface === 'turf' ? '芝' : 'ダート'}${r.distance}m・${Race.AGE_LABEL[r.ages]}${r.f ? '牝馬' : ''}・1着 ${Util.money(r.prize)}${trialTo ? `・🎫${r.trial.top}着以内→${trialTo.name}` : ''}</div>
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
    const can = Pvp.canEnter(h);
    return `<section class="panel pvp-head">
        <div class="rating">レーティング <b>${pvp.rating}</b> <small>最高 ${pvp.best}・${pvp.matches}戦${pvp.wins}勝</small></div>
        <p class="muted small">CPUのライバル馬主7人と8頭立てで対戦。順位でレーティングが上下し、上位リーグが解放されます。週は進みません（疲労+${Pvp.FATIGUE}）。</p>
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
  RATE: 9,         // 実時間1秒あたりに進むレース秒（×1のとき）
  WINDOW: 44,      // トラックに映す範囲（m）

  start(ctx) {
    this.stop();
    this.ctx = ctx;
    this.clock = 0;
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
    return `<section class="race-live">
        <div class="rl-title">🏇 ${UI.gradeBadge(race.grade)} ${Util.esc(race.name)}</div>
        <div class="rl-info">${sl.icon}${sl.label} ${result.distance}m・馬場：${ground}${UI.help('ground')}・${result.finish.length}頭</div>
        <div class="track ${result.surface}" id="rl-track">
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

  tick(ts) {
    if (!UI.el('rl-track')) { this.stop(); return; }
    if (this.lastTs !== null) this.clock += Math.min(0.1, (ts - this.lastTs) / 1000) * this.RATE * this.speed();
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
      return `<li class="${o.e.isPlayer ? 'me' : ''} ${o.e.isGhost ? 'ghost' : ''}"><span class="pos">${i + 1}</span><span title="${st.label}">${st.icon}</span> ${Util.esc(o.e.name)} ${gap}</li>`;
    }).join('');
  },

  eventHTML(e) {
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
    if (e.type === 'skill' && !this.skipping) {
      const el = UI.el('rn-' + e.horseId);
      if (el) {
        el.classList.remove('boost');
        void el.offsetWidth;
        el.classList.add('boost');
        el.setAttribute('data-skill', e.text.replace(/[「」]|発動！/g, ''));
      }
      if (e.isPlayer) UI.toast(`${e.text}<br>${Util.esc(e.sub)}`, 'skill-toast');
    }
  },

  skip() {
    this.stop();
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
  },

  resultTable(fin) {
    return `<table class="hist">
        <tr><th>着</th><th>馬名</th><th>タイム</th><th>着差</th></tr>
        ${fin.map(f => {
          const e = this.entrant(f.id) || {};
          return `<tr class="${f.isPlayer ? 'me' : ''}"><td>${f.place}</td><td>${GAME_DATA.styles[f.style].icon} ${Util.esc(f.name)}${e.owner ? `<br><small class="muted">${Util.esc(e.owner)}</small>` : ''}</td><td>${Race.timeText(f.time)}</td><td>${f.margin}</td></tr>`;
        }).join('')}
      </table>`;
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
        ${reward.rightTo ? `<p class="center ok big-note">🎫「${reward.rightTo.name}」の優先出走権を獲得！</p>` : ''}
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
          <button class="btn" onclick="UI.show('horse',{id:'${horseId}'})">🐎 馬の詳細へ</button>
          <button class="btn primary" onclick="UI.show('race')">🏇 レース選択へ</button>
        </div>`;
    }
    UI.el('rl-result').innerHTML = `<section class="panel result">${body}</section>`;
    UI.el('rl-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};
