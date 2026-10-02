// ゲームの起動と、プレイヤー操作（コントローラー）
'use strict';

const App = {
  pending: null,          // 出走準備中のレース
  notifiedMission: null,

  init() {
    Player.init();
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.addEventListener('click', () => UI.show(b.dataset.nav));
    });
    UI.show('home');
    if (!Player.data.tutorialDone) this.welcome();
  },

  // 変更を保存して再描画
  commit() {
    Player.save();
    this.checkMission();
    UI.render();
  },

  checkMission() {
    const m = Missions.current();
    if (m && Missions.isComplete(m) && this.notifiedMission !== m.id) {
      this.notifiedMission = m.id;
      UI.toast(`📋 ミッション達成！「${m.title}」<br><small>ホームで報酬を受け取ろう</small>`, 'mission-toast');
    }
  },

  // 初心者ガイド：次にやることを1つだけ示す
  guide() {
    const p = Player.data;
    const s = p.stats;
    if (!p.horses.length && s.breedCount === 0) {
      return { title: 'まず父カードを選ぼう！', text: '種牡馬（父）と繁殖牝馬（母）のカードを組み合わせて、最初の競走馬を作ります。', action: "UI.show('breed')" };
    }
    if (!p.horses.length) {
      return { title: '新しい馬を作ろう！', text: '厩舎に馬がいません。配合で新しい馬を誕生させよう。', action: "UI.show('breed')" };
    }
    const h = p.horses[0];
    if (s.trainCount === 0) {
      return { title: '次は調教！', text: `${Util.esc(h.name)}を鍛えよう。迷ったら「おまかせ」でOK！`, action: `UI.state.horseTab='train';UI.show('horse',{id:'${h.id}'})` };
    }
    if (s.raceCount === 0) {
      return { title: 'レースに出してみよう！', text: '新馬戦は勝利数0の馬だけが出られるデビュー戦です。', action: `App.goRace('${h.id}')` };
    }
    return null;
  },

  welcome() {
    UI.modal(`
      <div class="welcome">
        <div class="big-emoji">🐎🃏</div>
        <h2>馬主カードへようこそ！</h2>
        <p>あなたは今日から<b>馬主</b>です。<br>カードを集めて馬を作り、育てて、レースで勝とう！</p>
        <ol class="flow"><li>🧬 父と母のカードで配合</li><li>🏋️ 調教で鍛える</li><li>🎴 スキルを装備</li><li>🏇 レースはオートで進む</li><li>🃏 勝ってカードをゲット！</li></ol>
        <label>あなたの厩舎の名前<input id="owner-name" maxlength="12" placeholder="オーナー" value=""></label>
        <button class="btn primary big" onclick="App.finishWelcome()">はじめる！</button>
      </div>`, { noClose: true });
  },

  finishWelcome() {
    const v = (UI.el('owner-name').value || '').trim();
    Player.data.name = v.slice(0, 12) || 'オーナー';
    Player.data.tutorialDone = true;
    Player.save();
    UI.closeModal();
    UI.show('breed');
    UI.toast('まず父カード（種牡馬）を選ぼう！');
  },

  help(key) {
    const g = GAME_DATA.glossary[key];
    if (g) UI.modal(`<h3>${g.title}</h3><p class="help-body">${g.body}</p><button class="btn" onclick="UI.closeModal()">わかった！</button>`, { cls: 'small' });
  },

  // ── 配合 ──
  pickParent(type, id) {
    UI.state.breed[type === 'sire' ? 'father' : 'mother'] = id;
    UI.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  breed() {
    const b = UI.state.breed;
    const father = Cards.get(b.father), mother = Cards.get(b.mother);
    if (!father || !mother || !Player.count(father.id) || !Player.count(mother.id)) return UI.toast('カードを選んでください', 'error');
    if (Player.stableFull()) return UI.toast('厩舎がいっぱいです', 'error');
    const fee = Player.data.stats.breedCount === 0 ? 0 : Breeding.fee(father, mother);
    if (!Player.canAfford(fee)) return UI.toast(`配合料（${Util.money(fee)}）が足りません`, 'error');
    Player.addMoney(-fee);
    const { horse, inherited } = Breeding.breed(father, mother);
    Player.data.horses.push(horse);
    if (inherited) Player.addCard(inherited);
    Player.bump('breedCount');
    UI.state.breed = { father: null, mother: null };
    this.commit();
    this.birthModal(horse, inherited);
  },

  birthModal(h, inherited) {
    const sk = inherited ? Cards.get(inherited) : null;
    const rec = Horse.routeInfo(Horse.recommendRoute(h));
    UI.modal(`
      <div class="birth">
        <div class="sparkle">✨🐣✨</div>
        <h2>馬が生まれました！</h2>
        ${UI.horseCard(h, { onclick: '' })}
        <label>名前をつけよう<input id="horse-name" maxlength="12" value="${Util.esc(h.name)}"></label>
        <p>素質：<b>${Util.grade(Horse.potential(h))}</b>${UI.help('potential')}・成長：<b>${GAME_DATA.growthTypes[h.growthType].label}</b>・おすすめ：<b>${rec.icon}${rec.name}</b></p>
        ${sk ? `<p class="ok">🎴 親からスキル「${sk.name}」を受け継いだ！（スキルカードを入手）</p>` : ''}
        <button class="btn primary big" onclick="App.afterBirth('${h.id}')">次は調教！ ▶</button>
      </div>`, { noClose: true });
  },

  afterBirth(id) {
    const h = Player.horse(id);
    const v = (UI.el('horse-name').value || '').trim().slice(0, 12);
    if (h && v) h.name = v;
    Player.save();
    UI.closeModal();
    UI.state.horseTab = 'train';
    UI.show('horse', { id });
  },

  rename(id) {
    const h = Player.horse(id);
    if (!h) return;
    const v = window.prompt('新しい馬名（12文字まで）', h.name);
    if (v && v.trim()) { h.name = v.trim().slice(0, 12); this.commit(); }
  },

  setRoute(hid, route) {
    const h = Player.horse(hid);
    if (!h) return;
    h.route = route;
    UI.toast(`目標路線を「${Horse.routeInfo(route).name}」にしました`);
    this.commit();
  },

  // ── 調教 ──
  gainText(gains) {
    const parts = Object.entries(gains).map(([k, v]) => `${GAME_DATA.stats.find(s => s.key === k).icon}+${v}`);
    return parts.length ? parts.join(' ') : '';
  },

  afterWeek(h, res) {
    if (res.levelUps) UI.toast(`⬆ レベルアップ！ Lv.${h.level}（全能力+1）`, 'ok');
    if (res.birthday) UI.toast(`🎂 ${Util.esc(h.name)}は${h.age}歳になりました！`, 'ok');
    if (Horse.mustRetire(h)) UI.toast(`🎌 ${Util.esc(h.name)}は引退の時期です`, 'error');
  },

  train(hid, menu) {
    const h = Player.horse(hid);
    if (!h) return;
    const can = Training.canTrain(h);
    if (!can.ok) return UI.toast(can.reason, 'error');
    const res = Training.train(h, menu);
    const g = this.gainText(res.gains);
    UI.toast(`${res.menu.icon} ${res.menu.label}！ ${g || (menu === 'rest' ? '疲れがとれた！' : res.capped ? '限界に近い…' : '今回は伸びなかった…')}`);
    this.afterWeek(h, res);
    this.commit();
  },

  autoTrain(hid, weeks = 1) {
    const h = Player.horse(hid);
    if (!h) return;
    const total = {};
    const done = [];
    let reason = '';
    for (let i = 0; i < weeks; i++) {
      if (!Training.canTrain(h).ok) break;
      const plan = Training.autoPlan(h);
      if (!reason) reason = plan.reason;
      const res = Training.train(h, plan.menu);
      done.push(res.menu.icon);
      Object.entries(res.gains).forEach(([k, v]) => { total[k] = (total[k] || 0) + v; });
      this.afterWeek(h, res);
    }
    const head = done.length > 1 ? `🤖 おまかせ${done.length}週：${done.join('→')}` : `🤖 ${reason}`;
    UI.toast(`${head}<br>${this.gainText(total) || '体調を整えました'}`);
    this.commit();
  },

  useItem(hid, itemId) {
    const h = Player.horse(hid);
    if (!h) return;
    const res = Training.useItem(h, itemId);
    if (!res) return UI.toast('アイテムを使えません', 'error');
    UI.toast(`${res.item.icon} ${res.item.name} を使った！ ${this.gainText(res.gains)}`);
    this.afterWeek(h, res);
    this.commit();
  },

  equip(hid, skillId) {
    const h = Player.horse(hid);
    const r = Skills.equip(h, skillId);
    if (!r.ok) return UI.toast(r.reason, 'error');
    UI.toast(`🎴 ${Skills.get(skillId).name} を装備しました`);
    this.commit();
  },

  unequip(hid, skillId) {
    const h = Player.horse(hid);
    if (Skills.unequip(h, skillId)) this.commit();
  },

  // ── レース ──
  goRace(hid, route) {
    const h = Player.horse(hid);
    if (!h) return;
    UI.state.raceHorse = hid;
    UI.state.raceRoute = route || h.route || Horse.recommendRoute(h);
    UI.show('race');
  },

  prepareRace(hid, raceId) {
    const h = Player.horse(hid);
    const race = Race.get(raceId);
    if (!h || !race) return;
    const elig = Race.eligibility(h, race);
    if (!elig.ok) return UI.toast(elig.reason, 'error');
    const field = Race.buildField(h, race);
    const ground = Race.rollGround(race);
    this.pending = { hid, raceId, field, ground };
    const cat = Horse.distCat(race.distance);
    const warn = [];
    if (h.aptitude[cat] < 45) warn.push('距離適性が低いレースです');
    if (h.aptitude[race.surface] < 45) warn.push('馬場適性が低いレースです');
    if (h.fatigue >= 50) warn.push('疲れがたまっています');
    if (!h.skills.length) warn.push('スキルが装備されていません');
    UI.modal(`
      <h3>${UI.gradeBadge(race.grade)} ${race.name}</h3>
      <p>${race.surface === 'turf' ? '🌱芝' : '🟫ダート'} ${race.distance}m・馬場：<b>${GAME_DATA.grounds[ground].label}</b>${UI.help('ground')}</p>
      <h4>出走メンバー（${field.length}頭）</h4>
      <ol class="entry-list">${field.map(e => `<li class="${e.isPlayer ? 'me' : ''}">${GAME_DATA.styles[e.runningStyle].icon} ${Util.esc(e.name)}${e.isPlayer ? ' ← あなたの馬' : ''}</li>`).join('')}</ol>
      ${warn.length ? `<div class="warn">${warn.map(w => '⚠ ' + w).join('<br>')}</div>` : '<p class="ok">準備万端！</p>'}
      <div class="btn-row"><button class="btn" onclick="UI.closeModal()">やめる</button><button class="btn primary big" onclick="App.runRace()">🏁 スタート！</button></div>`);
  },

  runRace() {
    const pd = this.pending;
    if (!pd) return;
    this.pending = null;
    UI.closeModal();
    const h = Player.horse(pd.hid);
    const race = Race.get(pd.raceId);
    if (!h || !Race.eligibility(h, race).ok) return UI.toast('出走できません', 'error');
    // 結果は先に計算・保存し、表示は後から再生する
    const result = Race.simulate(race, pd.field, pd.ground);
    const reward = Race.applyResult(h, race, result);
    Player.save();
    RaceView.start({ result, reward, race, horseId: h.id });
    this.checkMission();
  },

  // ── 引退・殿堂 ──
  retire(hid) {
    const h = Player.horse(hid);
    if (!h) return;
    const hof = HallOfFame.qualifies(h);
    UI.modal(`<h3>🎌 ${Util.esc(h.name)}を引退させますか？</h3>
      <p>${h.record.races}戦${h.record.wins}勝（GⅠ ${h.record.g1Wins}勝）</p>
      ${hof ? '<p class="ok">🏛 殿堂入りします！</p>' : h.record.gradedWins ? '<p class="ok">🃏 配合カードになります。</p>' : '<p class="muted">重賞未勝利のため、配合カードにはなりません。</p>'}
      <div class="btn-row"><button class="btn" onclick="UI.closeModal()">やめる</button><button class="btn danger" onclick="App.doRetire('${hid}')">引退させる</button></div>`, { cls: 'small' });
  },

  doRetire(hid) {
    const h = Player.horse(hid);
    if (!h) return;
    const res = HallOfFame.retire(h);
    this.commit();
    UI.show(res.inHall ? 'hof' : 'stable');
    UI.modal(`<div class="birth">
      <div class="sparkle">${res.inHall ? '🏛✨' : '🎌'}</div>
      <h2>${res.inHall ? '殿堂入り！' : 'おつかれさま！'}</h2>
      <p><b>${Util.esc(res.entry.name)}</b> は引退しました。</p>
      ${res.entry.titles.length ? `<p>称号：「${res.entry.titles.join('」「')}」</p>` : ''}
      ${res.card ? `<p class="ok">🃏 配合カード「${Util.esc(res.card.name)}」を手に入れた！血統を次の世代へ。</p>${UI.breedCard(res.card)}` : ''}
      <button class="btn primary" onclick="UI.closeModal()">OK</button></div>`);
  },

  // ── ミッション ──
  claimMission() {
    const m = Missions.claim();
    if (!m) return;
    const cards = (m.reward.cards || []).map(id => Cards.get(id));
    UI.modal(`<div class="birth"><div class="sparkle">🎁</div><h2>ミッション達成！</h2><p>「${m.title}」</p>
      <p>💰 ${Util.money(m.reward.money)}</p>
      <div class="cgrid">${cards.map(c => UI.anyCard(c, {})).join('')}</div>
      <button class="btn primary" onclick="UI.closeModal()">OK</button></div>`);
    this.notifiedMission = null;
    this.commit();
  },

  // ── カード ──
  buy(id) {
    const c = Cards.get(id);
    if (!c || !c.price || !Player.canAfford(c.price)) return UI.toast('お金が足りません', 'error');
    Player.addMoney(-c.price);
    Player.addCard(id);
    UI.toast(`🛒 ${c.name} を購入しました`);
    this.commit();
  },

  cardDetail(id) {
    const c = Cards.get(id);
    if (!c) return;
    let detail = '';
    if (c.type === 'sire' || c.type === 'mare') {
      const sk = c.skill ? Cards.get(c.skill) : null;
      detail = `<p>${Util.esc(c.desc || '')}</p>
        ${STAT_KEYS.map(k => UI.statRow(k, c.stats[k])).join('')}
        ${UI.aptGrid(c.apt)}
        <p>脚質：${GAME_DATA.styles[c.style].icon}${GAME_DATA.styles[c.style].label}・成長：${GAME_DATA.growthTypes[c.growth].label}</p>
        ${sk ? `<p>受け継ぎやすいスキル：🎴 ${sk.name}（${sk.desc}）</p>` : ''}
        <button class="btn primary" onclick="UI.closeModal();UI.state.breed.${c.type === 'sire' ? 'father' : 'mother'}='${c.id}';UI.show('breed')">🧬 このカードで配合</button>`;
    } else if (c.type === 'skill') {
      detail = `<p>発動条件：<b>${c.condText}</b></p><p>${c.desc}</p>
        <p class="muted small">${c.style ? `${GAME_DATA.styles[c.style].label}の馬が使うと効果が最大。それ以外は効果ダウン。` : 'どの脚質でも効果は同じ。'}</p>`;
    } else {
      detail = `<p>${c.desc}</p><p class="muted small">馬の詳細 →「調教」タブから使えます。</p>`;
    }
    UI.modal(`<div class="card-detail">${UI.anyCard(c, { count: Player.count(c.id) })}<div>${detail}</div></div>`);
  },

  // ── 設定 ──
  settings() {
    UI.modal(`<h3>⚙ 設定</h3>
      <label>厩舎の名前<input id="set-name" maxlength="12" value="${Util.esc(Player.data.name)}"></label>
      <button class="btn primary" onclick="App.saveSettings()">保存</button>
      <hr>
      <p class="muted small">データはこのブラウザ（localStorage）に自動保存されています。</p>
      <button class="btn danger" onclick="App.confirmReset()">データを消去して最初から</button>`, { cls: 'small' });
  },

  saveSettings() {
    const v = (UI.el('set-name').value || '').trim().slice(0, 12);
    if (v) Player.data.name = v;
    UI.closeModal();
    this.commit();
  },

  confirmReset() {
    if (!window.confirm('本当にすべてのデータを消去しますか？（元に戻せません）')) return;
    Player.reset();
    UI.state.breed = { father: null, mother: null };
    UI.closeModal();
    UI.show('home');
    this.welcome();
  }
};

window.addEventListener('DOMContentLoaded', () => App.init());
