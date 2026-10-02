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
    raceRoute: null
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
      raceView: () => RaceView.view()
    };
    this.el('main').innerHTML = (views[s] || views.home)();
    const navKey = { horse: 'stable', hof: 'home', raceView: 'race' }[s] || s;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === navKey));
    if (s === 'raceView') RaceView.mount();
  },

  renderHeader() {
    const p = Player.data;
    const cardCount = Object.values(p.cards).reduce((a, b) => a + b, 0);
    this.el('topbar').innerHTML = `
      <div class="brand" onclick="UI.show('home')">🐎🃏 <span>馬主カード</span></div>
      <div class="wallet">
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
    const recs = p.horses.map(h => ({ h, race: Race.nextRace(h, h.route || Horse.recommendRoute(h)) })).filter(x => x.race).slice(0, 3);
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

      ${recs.length ? `<section class="panel"><h3>🏇 おすすめレース</h3>
        ${recs.map(({ h, race }) => `<div class="rec-row" onclick="App.goRace('${h.id}','${race.route}')">
          <span class="rec-horse">${Util.esc(h.name)}</span><span>→</span>${this.gradeBadge(race.grade)}<b>${race.name}</b>
          <small>${race.surface === 'turf' ? '芝' : 'ダート'}${race.distance}m</small></div>`).join('')}
      </section>` : ''}

      <section class="panel">
        <h3>🏛 殿堂 <button class="link" onclick="UI.show('hof')">見る ▶</button></h3>
        <p class="muted">GⅠ 3勝 or 通算10勝で引退した名馬が殿堂入りします。${this.help('hof')}</p>
      </section>

      <section class="panel news">
        <h3>📢 お知らせ</h3>
        <ul>
          <li>競馬×カードゲーム「馬主カード」へようこそ！</li>
          <li>レースで勝つと新しい種牡馬・繁殖牝馬・スキルカードが手に入ります。</li>
          <li>わからない言葉は <span class="help static">？</span> ボタンをタップ！</li>
        </ul>
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
            <span class="tag">${h.age}歳（${h.week + 1}/${GAME_DATA.weeksPerYear}週）</span>
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
    const father = Cards.get(h.fatherId), mother = Cards.get(h.motherId);
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
      <section class="panel"><h3>血統</h3>
        <div class="pedigree">
          <div class="ped sire">♂ 父<br><b>${father ? Util.esc(father.name) : '不明'}</b>${father ? this.rarity(father.rarity) : ''}</div>
          <div class="ped mare">♀ 母<br><b>${mother ? Util.esc(mother.name) : '不明'}</b>${mother ? this.rarity(mother.rarity) : ''}</div>
        </div>
      </section>`;
  },

  horseTrain(h) {
    const plan = Training.autoPlan(h);
    const eff = Training.efficiency(h);
    const effLabel = eff >= 1.1 ? '◎ 絶好の伸び時' : eff >= 0.85 ? '○ よく伸びる' : eff >= 0.6 ? '△ 伸びにくい' : '× ほとんど伸びない';
    const items = Player.ownedCards('item');
    const menuBtn = (k, m) => {
      const gains = Object.keys(m.gains).map(s => GAME_DATA.stats.find(x => x.key === s).icon).join('');
      const fatTxt = m.fatigue > 0 ? `疲労+${m.fatigue}` : `疲労${m.fatigue}`;
      return `<button class="train-btn ${k === plan.menu ? 'suggest' : ''}" onclick="App.train('${h.id}','${k}')">
        <span class="ti">${m.icon}</span><b>${m.label}</b><small>${gains || '回復'}・${fatTxt}</small></button>`;
    };
    return `
      <section class="panel auto-train">
        <h3>🤖 おまかせ調教</h3>
        <p>${plan.reason}</p>
        <button class="btn primary big" onclick="App.autoTrain('${h.id}')">おまかせで1週すすめる</button>
        <button class="btn" onclick="App.autoTrain('${h.id}',4)">おまかせ×4週</button>
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
    return `<p class="muted">アイテムカードを購入できます。所持金：<b>${Util.money(Player.data.money)}</b></p>
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
      ${body}`;
  },

  // ─────────── レース選択 ───────────
  raceView() {
    const p = Player.data;
    if (!p.horses.length) return `<h2 class="screen-title">🏇 レース</h2><div class="empty">🐣<p>出走できる馬がいません。<br>まずは配合で馬を作ろう！</p><button class="btn primary big" onclick="UI.show('breed')">🧬 配合へ</button></div>`;
    const st = this.state;
    if (!st.raceHorse || !Player.horse(st.raceHorse)) st.raceHorse = p.horses[0].id;
    const h = Player.horse(st.raceHorse);
    const rec = Horse.recommendRoute(h);
    if (!st.raceRoute) st.raceRoute = h.route || rec;
    const route = Horse.routeInfo(st.raceRoute);
    const races = Race.available(h, st.raceRoute);
    const cond = Horse.conditionInfo(h);
    const fat = Horse.fatigueInfo(h);

    return `<h2 class="screen-title">🏇 レース</h2>
      <div class="chips horse-pick">${p.horses.map(x => `<button class="${x.id === h.id ? 'active' : ''}" onclick="UI.state.raceHorse='${x.id}';UI.state.raceRoute=null;UI.render()">${Util.esc(x.name)}</button>`).join('')}</div>
      <section class="panel race-horse">
        <div><b>${Util.esc(h.name)}</b> ${Horse.genderLabel(h)} ${h.age}歳 ${this.styleTag(h.runningStyle)}</div>
        <div class="muted small">${Horse.mainAptText(h)}・${h.record.wins}勝・<span class="${cond.cls}">${cond.icon}${cond.label}</span>・<span class="${fat.cls}">😓${fat.label}</span></div>
        <p class="rec">💡 この馬は <b>${Horse.routeInfo(rec).icon}${Horse.routeInfo(rec).name}</b> 路線がおすすめ！</p>
      </section>
      <div class="routes">${GAME_DATA.routes.map(r => `<button class="route-btn ${r.id === st.raceRoute ? 'active' : ''}" onclick="UI.state.raceRoute='${r.id}';UI.render()">
        <span class="ri">${r.icon}</span>${r.name}${r.id === rec ? '<em>おすすめ</em>' : ''}</button>`).join('')}</div>
      <section class="panel route-desc"><b>${route.icon} ${route.name}</b>（${route.range}）<p class="muted">${route.desc}<br>重要能力：${route.key}</p></section>
      <div class="race-list">${races.map(({ race, elig }) => this.raceRow(h, race, elig)).join('')}</div>
      <p class="muted small">レースの格${this.help('grade')}：勝ち星を重ねると上のクラスに挑戦できます。</p>`;
  },

  raceRow(h, race, elig) {
    const cat = Horse.distCat(race.distance);
    const g = GAME_DATA.grades[race.grade];
    const dl = GAME_DATA.distances.find(d => d.key === cat);
    const sl = GAME_DATA.surfaces.find(s => s.key === race.surface);
    return `<div class="race-row ${elig.ok ? '' : 'locked'}">
      <div class="rr-head">${this.gradeBadge(race.grade)}<b>${race.name}</b>${race.female ? '<span class="tag">牝馬限定</span>' : ''}</div>
      <div class="rr-info">${sl.icon}${sl.label} ${race.distance}m（${dl.label}）・${race.field}頭・1着賞金 ${Util.money(g.prize)}</div>
      <div class="rr-apt">この馬の適性：距離 <b>${Util.stars(h.aptitude[cat])}</b> 馬場 <b>${Util.stars(h.aptitude[race.surface])}</b></div>
      ${elig.ok ? `<button class="btn primary" onclick="App.prepareRace('${h.id}','${race.id}')">出走する</button>` : `<div class="lock">🔒 ${elig.reason}</div>`}
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
          <div class="lc-ped">父：${Util.esc(e.father)}<br>母：${Util.esc(e.mother)}</div>
        </div>`).join('')}</div>`
        : `<div class="empty">🏛<p>まだ殿堂馬はいません。<br>GⅠ 3勝、または通算10勝した馬を引退させると殿堂入り！</p></div>`}`;
  }
};

// ─────────── レース再生（表示のみ） ───────────
// Race.simulate() の結果を受け取り、実況ログと順位変動を時間差で表示する。
// 将来の2Dアニメーションは result.frames を使ってここを差し替えればよい。
const RaceView = {
  ctx: null,     // { result, reward, race, horseId }
  timer: null,
  idx: 0,
  order: [],
  done: false,

  start(ctx) {
    this.stop();
    this.ctx = ctx;
    this.idx = 0;
    this.done = false;
    this.order = ctx.result.entrants.slice().sort((a, b) => a.gate - b.gate).map(e => e.id);
    UI.show('raceView');
  },

  stop() { clearTimeout(this.timer); this.timer = null; },

  speed() { return Player.data.settings.raceSpeed || 1; },

  view() {
    if (!this.ctx) return '<div class="empty">レースがありません</div>';
    const { result, race } = this.ctx;
    const ground = GAME_DATA.grounds[result.ground].label;
    const sl = GAME_DATA.surfaces.find(s => s.key === result.surface);
    return `<section class="race-live">
        <div class="rl-title">🏇 ${UI.gradeBadge(race.grade)} ${race.name}</div>
        <div class="rl-info">${sl.icon}${sl.label} ${result.distance}m・馬場：${ground}${UI.help('ground')}・${result.finish.length}頭</div>
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
    this.renderOrder([]);
    const log = UI.el('rl-log');
    this.ctx.result.events.slice(0, this.idx).forEach(e => log.insertAdjacentHTML('afterbegin', this.eventHTML(e)));
    if (this.done) this.showResult();
    else this.next();
  },

  setSpeed(s) { Player.data.settings.raceSpeed = s; Player.save(); document.querySelectorAll('.rl-controls button').forEach(b => b.classList.toggle('active', b.textContent === '×' + s)); },

  entrant(id) { return this.ctx.result.entrants.find(e => e.id === id); },

  renderOrder(gaps) {
    const ol = UI.el('rl-order');
    if (!ol) return;
    ol.innerHTML = this.order.map((id, i) => {
      const e = this.entrant(id);
      const st = GAME_DATA.styles[e.style];
      const gap = gaps[i] !== undefined && i > 0 ? `<small>${gaps[i].toFixed(1)}馬身</small>` : '';
      return `<li class="${e.isPlayer ? 'me' : ''}"><span class="pos">${i + 1}</span><span title="${st.label}">${st.icon}</span> ${Util.esc(e.name)} ${gap}</li>`;
    }).join('');
  },

  eventHTML(e) {
    if (e.type === 'checkpoint') return `<div class="ev cp"><span class="cp-label">── ${e.label} ──</span><br>${Util.esc(e.text)}</div>`;
    if (e.type === 'skill') {
      return `<div class="ev skill ${e.isPlayer ? 'me' : ''}">${e.text}<br><small>${Util.esc(e.sub)}${e.isPlayer && !e.matched ? '（脚質不一致）' : ''}</small></div>`;
    }
    return `<div class="ev ${e.isPlayer ? 'me' : ''}">${Util.esc(e.text)}</div>`;
  },

  next() {
    const events = this.ctx.result.events;
    if (this.idx >= events.length) { this.finish(); return; }
    const e = events[this.idx];
    this.apply(e);
    this.idx++;
    const nextE = events[this.idx];
    let delay = nextE ? Util.clamp((nextE.t - e.t) * 70, 350, 1400) : 600;
    if (e.type === 'skill' && e.isPlayer) delay += 500;
    this.timer = setTimeout(() => this.next(), delay / this.speed());
  },

  apply(e) {
    const log = UI.el('rl-log');
    if (!log) return;
    log.insertAdjacentHTML('afterbegin', this.eventHTML(e));
    if (e.type === 'checkpoint') {
      this.order = e.order.slice();
      this.renderOrder(e.gaps);
    }
    if (e.type === 'skill' && e.isPlayer && !this.skipping) UI.toast(`${e.text}<br>${Util.esc(e.sub)}`, 'skill-toast');
    const bar = UI.el('rl-bar');
    const total = this.ctx.result.finish[0].time;
    if (bar) bar.style.width = Math.min(100, e.t / total * 100) + '%';
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
    const fin = this.ctx.result.finish;
    this.order = fin.map(f => f.id);
    this.renderOrder([]);
    const bar = UI.el('rl-bar');
    if (bar) bar.style.width = '100%';
    this.showResult();
  },

  showResult() {
    const { result, reward, horseId } = this.ctx;
    const fin = result.finish;
    const place = reward.place;
    const h = Player.horse(horseId);
    const head = place === 1 ? `<div class="result-big win">🏆 1着！</div><p class="center">${Util.esc(fin[0].name)}、見事な勝利！</p>`
      : place <= 3 ? `<div class="result-big place">🥈 ${place}着</div><p class="center">あと少し！ 惜しいレースでした。</p>`
      : `<div class="result-big">${place}着</div><p class="center">次は調教で鍛えて、リベンジしよう！</p>`;
    const cards = reward.cards.map((x, i) => `<div class="reveal" style="animation-delay:${0.3 + i * 0.4}s">${x.isNew ? '<span class="new">NEW!</span>' : ''}${UI.anyCard(x.card, {})}</div>`).join('');
    UI.el('rl-result').innerHTML = `<section class="panel result">
      ${head}
      <table class="hist">
        <tr><th>着</th><th>馬名</th><th>タイム</th><th>着差</th></tr>
        ${fin.map(f => `<tr class="${f.isPlayer ? 'me' : ''}"><td>${f.place}</td><td>${GAME_DATA.styles[f.style].icon} ${Util.esc(f.name)}</td><td>${Race.timeText(f.time)}</td><td>${f.margin}</td></tr>`).join('')}
      </table>
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
      </div>
    </section>`;
    UI.el('rl-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};
