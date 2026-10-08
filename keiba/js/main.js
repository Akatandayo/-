// ゲームの起動と、プレイヤー操作（コントローラー）
'use strict';

const App = {
  pending: null,          // 出走準備中のレース
  pendingMatch: null,     // 準備中の対戦（リーグ戦・フレンド対戦）
  notifiedMission: null,

  init() {
    Player.init();
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.addEventListener('click', () => UI.show(b.dataset.nav));
    });
    // 招待リンク（#room=XXXXXX）から開いたらカスタムレース画面へ
    UI.show(Online.checkInvite() && Player.data.horses.length ? 'race' : 'home');
    if (!Player.data.tutorialDone) this.welcome();
    window.addEventListener('beforeunload', () => Online.leave(true));
    // 登録した写真・ファンファーレを読み込む
    Media.init().then(() => { if (UI.state.screen !== 'raceView') UI.render(); });
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
    const now = Calendar.now();
    if (s.raceCount === 0 && s.trainCount > 0 && h.age === 2 && now.month < 6) {
      return { title: 'デビューは6月から！', text: '2歳の新馬戦は6月1週から始まります。それまで調教で鍛えて「次の週へ」で進めよう。', action: `UI.state.horseTab='train';UI.show('horse',{id:'${h.id}'})` };
    }
    if (s.trainCount === 0) {
      return { title: '次は調教！', text: `${Util.esc(h.name)}を鍛えよう。迷ったら「おまかせ」でOK！`, action: `UI.state.horseTab='train';UI.show('horse',{id:'${h.id}'})` };
    }
    if (s.raceCount === 0) {
      return { title: 'レースに出してみよう！', text: '「今週のレース」の新馬戦は、まだ走ったことのない馬だけが出られるデビュー戦です。', action: `App.goRace('${h.id}')` };
    }
    if (p.horses.every(x => Horse.acted(x) || Horse.mustRetire(x))) {
      return { title: '今週はみんな行動ずみ！', text: '「次の週へ」を押してカレンダーを進めよう。', action: 'App.nextWeek()' };
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
    const { horse, inherited, specials } = Breeding.breed(father, mother);
    Player.data.horses.push(horse);
    specials.filter(x => x.key === 'nick').forEach(x => {
      if (!Player.data.nicksFound.includes(x.id)) {
        Player.data.nicksFound.push(x.id);
        UI.toast(`✨ 新しい黄金配合を発見！<br>${x.name}`, 'mission-toast');
      }
    });
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
        ${UI.horseCard(h, { onclick: '', quick: false })}
        <label>名前をつけよう<input id="horse-name" maxlength="12" value="${Util.esc(h.name)}"></label>
        <p>素質：<b>${Util.grade(Horse.potential(h))}</b>${UI.help('potential')}・成長：<b>${GAME_DATA.growthTypes[h.growthType].label}</b>・おすすめ：<b>${rec.icon}${rec.name}</b></p>
        ${h.specials && h.specials.length ? `<p class="special-tags">${h.specials.map(x => `<span class="special">✨ ${x}</span>`).join('')}</p>` : ''}
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
    if (res.error) return UI.toast(res.error, 'error');
    UI.toast(`${res.item.icon} ${res.item.name} を使った！ ${this.gainText(res.gains)}${res.capAdd ? ` 限界値+${res.capAdd}` : ''}`);
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
    UI.state.raceMode = 'week';
    UI.state.raceRoute = route || h.route || Horse.recommendRoute(h);
    UI.show('race');
  },

  // ── カレンダー ──
  // n週すすめる。まだ行動していない馬はおまかせ調教。年が明けたら年明けイベント
  nextWeek(n = 1) {
    const p = Player.data;
    let trained = 0, newYear = null, stopFor = null;
    for (let i = 0; i < n; i++) {
      p.horses.forEach(h => {
        if (!Horse.acted(h) && Training.canTrain(h).ok) {
          Training.train(h, Training.autoPlan(h).menu);
          trained++;
        }
      });
      p.horses.forEach(h => Horse.weekPass(h));
      if (Calendar.advance()) { newYear = this.newYear(); break; }
      // まとめて進めるときは、目標の重賞がある週で止まる
      if (n > 1) {
        stopFor = p.horses.map(h => ({ h, t: Horse.mustRetire(h) ? null : Race.targetRace(h, 0) })).find(x => x.t);
        if (stopFor) break;
      }
    }
    this.commit();
    if (newYear) return this.newYearModal(newYear);
    const graded = Race.gradedOn(Calendar.get().week).filter(r => r.grade === 'g1');
    UI.toast(`📅 ${Calendar.fullLabel()}${trained ? `<br><small>未行動の${trained}頭はおまかせ調教しました</small>` : ''}`
      + (graded.length ? `<br>🏆 今週は${graded.map(r => r.name).join('・')}！` : ''));
    if (stopFor) UI.toast(`🎯 今週は${Util.esc(stopFor.h.name)}の目標「${stopFor.t.race.name}」！`, 'mission-toast');
  },

  // 1月1週：年齢・年度表彰・引退・お年玉
  newYear() {
    const p = Player.data;
    const prevYear = Calendar.get().year - 1;
    const report = Awards.evaluate(prevYear);
    p.horses.forEach(h => { h.age++; h.rights = []; });
    report.retiring = p.horses.filter(h => Horse.mustRetire(h)).map(h => h.name);
    report.gift = Cards.openPack(GAME_DATA.packs[0]);
    report.gift.forEach(c => Player.addCard(c.id));
    Player.addMoney(3000);
    return report;
  },

  newYearModal(r) {
    UI.modal(`<div class="birth newyear">
      <div class="sparkle">🎍🌅🎍</div>
      <h2>あけましておめでとう！</h2>
      <p><b>${Calendar.fullLabel()}</b> になりました。全ての馬が1歳年をとりました。${UI.help('newyear')}</p>
      <section class="year-sum"><h3>📊 ${r.year}年目の成績</h3>
        <div class="hero-stats">
          <div><small>出走</small><b>${r.summary.races}</b></div><div><small>勝利</small><b>${r.summary.wins}</b></div>
          <div><small>GⅠ勝利</small><b>${r.summary.g1Wins}</b></div><div><small>獲得賞金</small><b>${Util.money(r.summary.prize)}</b></div>
        </div></section>
      <h3>🏆 JRA賞（年度表彰）</h3>
      ${r.awards.length ? `<div class="awards">${r.awards.map(a => `<div class="award"><b>${a.title}</b>：${Util.esc(a.horse.name)} <small>+${Util.money(a.bonus)}</small></div>`).join('')}</div>`
        : '<p class="muted">今年は受賞なし。GⅠを勝つと表彰されます！</p>'}
      ${r.retiring.length ? `<p class="notice">🎌 ${r.retiring.map(n => Util.esc(n)).join('、')} は引退の時期を迎えました。</p>` : ''}
      <h3>🧧 お年玉</h3>
      <p>💰 ${Util.money(3000)} ＋ ベーシックパック</p>
      <div class="cgrid reveal-grid">${r.gift.map((c, i) => `<div class="reveal" style="animation-delay:${0.3 + i * 0.3}s">${UI.anyCard(c, {})}</div>`).join('')}</div>
      <button class="btn primary big" onclick="UI.closeModal()">今年もがんばろう！</button>
    </div>`);
  },

  prepareRace(hid, raceId) {
    const h = Player.horse(hid);
    const race = Race.get(raceId);
    if (!h || !race) return;
    const elig = Race.eligibility(h, race);
    if (!elig.ok) return UI.toast(elig.reason, 'error');
    const field = Race.buildField(h, race);
    const trialTo = race.trial ? Race.get(race.trial.to) : null;
    const ground = Race.rollGround(race);
    Race.setOdds(race, field, ground);
    const warn = [];
    this.pending = { hid, raceId, field, ground };
    const me = field.find(e => e.isPlayer);
    UI.state.order = UI.suggestOrder(h, race);
    UI.state.jockey = Jockeys.defaultFor(h);
    if (h.turn && !Race.courseOf(race).straight && h.turn !== Race.courseOf(race).dir) warn.push(`${Race.courseOf(race).dirLabel}は少し苦手です`);
    const cat = Horse.distCat(race.distance);
    if (h.aptitude[cat] < 45) warn.push('距離適性が低いレースです');
    if (h.aptitude[race.surface] < 45) warn.push('馬場適性が低いレースです');
    if (h.fatigue >= 50) warn.push('疲れがたまっています');
    if (!h.skills.length) warn.push('スキルが装備されていません');
    UI.modal(`
      <h3>${UI.gradeBadge(race.grade)} ${race.name}</h3>
      <p>📅 ${Calendar.fullLabel()}・📍${race.venue}<br>${race.surface === 'turf' ? '🌱芝' : '🟫ダート'} ${race.distance}m・${Race.AGE_LABEL[race.ages]}${race.female ? '牝馬' : ''}・馬場：<b>${GAME_DATA.grounds[ground].label}</b>${UI.help('ground')}<br>🔄 ${Race.courseText(race)}${Race.courseHint(race) ? `<small class="muted">（${Race.courseHint(race)}）</small>` : ''}</p>
      ${elig.right ? '<p class="ok">🎫 優先出走権で出走！</p>' : ''}
      ${trialTo ? `<p class="rec">🎫 ${race.trial.top}着以内で「${trialTo.name}」の優先出走権！${UI.help('right')}</p>` : ''}
      <h4>出走表（${field.length}頭）<small class="muted">　${Util.esc(h.name)}は ${me.pop}番人気（単勝 ${me.odds.toFixed(1)}倍）${me.pop >= 4 ? '・勝てば大金星ボーナス！' : ''}</small></h4>
      ${field.some(e => e.isRival) ? `<p class="rec">⚔ 宿命のライバル「${Util.esc(h.rival.name)}」${h.rival.isNew ? 'が現れた！ 同期の強敵です。' : `も出走！（対戦成績 ${h.rival.vs.win}勝${h.rival.vs.lose}敗）`}</p>` : ''}
      ${UI.entryTable(field)}
      ${UI.orderPicker(h, race)}
      ${Jockeys.picker(h)}
      ${field.some(e => e.isLegend) ? '<p class="rec">👑 名馬が出走！ 先着するとその名馬のカードが手に入ることがあります。</p>' : ''}
      ${warn.length ? `<div class="warn">${warn.map(w => '⚠ ' + w).join('<br>')}</div>` : '<p class="ok">準備万端！</p>'}
      <div class="btn-row"><button class="btn" onclick="UI.closeModal()">やめる</button><button class="btn primary big" onclick="App.runRace()">🏁 スタート！</button></div>`);
  },

  runRace() {
    const pd = this.pending;
    if (!pd) return;
    this.pending = null;
    const h = Player.horse(pd.hid);
    const race = Race.get(pd.raceId);
    if (!h || !Race.eligibility(h, race).ok) return UI.toast('出走できません', 'error');
    const me = pd.field.find(e => e.isPlayer);
    const jk = Jockeys.get(UI.state.jockey) || Jockeys.get('j_haruno');
    if (!Player.canAfford(jk.fee)) { this.pending = pd; return UI.toast('騎乗料が足りません。別の騎手を選んでね', 'error'); }
    UI.closeModal();
    Player.addMoney(-jk.fee);
    if (me) { me.order = UI.state.order || 'normal'; me.jockey = Jockeys.entry(h, jk.id); }
    // 結果は先に計算・保存し、表示は後から再生する
    const result = Race.simulate(race, pd.field, pd.ground);
    const reward = Race.applyResult(h, race, result);
    Player.save();
    RaceView.start({ result, reward, race, horseId: h.id });
    this.checkMission();
  },

  // ── 対戦（リーグ戦・フレンド対戦） ──
  matchModal(match, h) {
    const r = match.race;
    UI.state.order = UI.suggestOrder(h, r);
    UI.state.jockey = Jockeys.defaultFor(h);
    UI.modal(`
      <h3>${UI.gradeBadge(r.grade)} ${Util.esc(r.name)}</h3>
      <p>${r.surface === 'turf' ? '🌱芝' : '🟫ダート'} ${r.distance}m・馬場：<b>${GAME_DATA.grounds[match.ground].label}</b>
        ${match.league && match.league.statCap ? `・能力上限 ${match.league.statCap}` : match.cap ? `・能力上限 ${match.cap}` : ''}</p>
      ${r.venue ? `<p class="muted small">🔄 ${Util.esc(r.venue)} ${Race.courseText(r)}${Race.courseHint(r) ? '（' + Race.courseHint(r) + '）' : ''}</p>` : ''}
      <h4>出走表</h4>
      ${UI.entryTable(match.field, { owner: true })}
      ${UI.orderPicker(h, r)}
      ${Jockeys.picker(h, { free: match.kind !== 'league' })}
      <div class="btn-row"><button class="btn" onclick="UI.closeModal()">やめる</button><button class="btn primary big" onclick="App.runMatch()">🏁 スタート！</button></div>`);
  },

  prepareLeague(hid) {
    const h = Player.horse(hid);
    const league = Pvp.league(UI.state.league);
    if (!h || !league || !Pvp.isUnlocked(league)) return;
    const can = Pvp.canEnter(h, { league: true });
    if (!can.ok) return UI.toast(can.reason, 'error');
    this.pendingMatch = Object.assign(Pvp.buildLeagueMatch(h, league.id), { hid });
    this.matchModal(this.pendingMatch, h);
  },

  prepareFriend(hid) {
    const h = Player.horse(hid);
    if (!h) return;
    const can = Pvp.canEnter(h);
    if (!can.ok) return UI.toast(can.reason, 'error');
    const course = GAME_DATA.leagueCourses[UI.state.friendCourse] || GAME_DATA.leagueCourses[1];
    this.pendingMatch = Object.assign(Pvp.buildFriendMatch(h, UI.state.friendPick, course, UI.state.friendCap || null), { hid });
    this.matchModal(this.pendingMatch, h);
  },

  runMatch() {
    const m = this.pendingMatch;
    if (!m) return;
    this.pendingMatch = null;
    const h = Player.horse(m.hid);
    const me = m.field.find(e => e.isPlayer);
    const jk = Jockeys.get(UI.state.jockey) || Jockeys.get('j_haruno');
    if (m.kind === 'league') {
      if (!Player.canAfford(jk.fee)) { this.pendingMatch = m; return UI.toast('騎乗料が足りません。別の騎手を選んでね', 'error'); }
      Player.addMoney(-jk.fee);
    }
    UI.closeModal();
    if (me) { me.order = UI.state.order || 'normal'; me.jockey = Jockeys.entry(h, jk.id); }
    if (m.kind === 'custom') {
      const result = Race.simulate(m.race, m.field, m.ground);
      const reward = Pvp.applyCustom(result, me.id, false);
      Player.save();
      return this.playCustom(m.race, result, reward, m.hid, false);
    }
    if (!h || !Pvp.canEnter(h, { league: m.kind === 'league' }).ok) return UI.toast('出走できません', 'error');
    const result = Race.simulate(m.race, m.field, m.ground);
    const reward = m.kind === 'league' ? Pvp.applyLeague(h, m, result) : Pvp.applyFriend(h, m, result);
    if (m.kind === 'league') { Jockeys.afterRace(h, jk.id, reward.place, 'op'); reward.fee = jk.fee; }
    Player.save();
    RaceView.start({
      result, reward, race: m.race, horseId: h.id,
      resultHTML: v => {
        const fin = result.finish;
        const back = `<div class="btn-row">${v.three ? '<button class="btn" onclick="RaceView.replay()">🎬 ゴール前リプレイ</button>' : ''}<button class="btn" onclick="UI.show('horse',{id:'${h.id}'})">🐎 馬の詳細へ</button>
          <button class="btn primary" onclick="UI.show('race')">⚔ 対戦画面へ</button></div>`;
        if (m.kind === 'league') {
          const cards = v.cardsHTML(reward.cards);
          return `${v.placeHead(reward.place, fin[0].name)}
            <div class="rating-change ${reward.delta >= 0 ? 'up' : 'down'}">レーティング ${reward.rating} <b>${reward.delta >= 0 ? '+' : ''}${reward.delta}</b></div>
            ${reward.unlocked.map(l => `<p class="center ok">🎉 ${l.icon}${l.name}が解放されました！</p>`).join('')}
            ${v.reviewHTML()}${v.resultTable(fin)}${v.lapHTML(result)}
            <h3>🎁 報酬</h3>
            <div class="rewards"><div>💰 賞金 <b>${Util.money(reward.prize)}</b></div>
              <div>✨ 経験値 <b>+${reward.exp}</b>${reward.levelUps ? ' <span class="ok">レベルアップ！</span>' : ''}</div></div>
            ${cards ? `<h3>🃏 カード獲得！</h3><div class="cgrid reveal-grid">${cards}</div>` : ''}
            ${back}`;
        }
        return `${v.placeHead(reward.place, fin[0].name)}
          ${reward.vs.length ? `<div class="vs-list">${reward.vs.map(x => `<div class="${x.won ? 'ok' : 'warn'}">${x.won ? '○ 勝ち' : '● 負け'}：${Util.esc(x.owner)}厩舎の${Util.esc(x.name)}</div>`).join('')}</div>` : ''}
          ${v.reviewHTML()}${v.resultTable(fin)}${v.lapHTML(result)}
          <p class="muted small">フレンド対戦はエキシビション（報酬・経験値・疲労なし）。何度でも挑戦できます。</p>
          ${back}`;
      }
    });
  },

  // ── カスタムレース ──
  setSpec(key, value) {
    UI.state.customSpec = Pvp.sanitizeSpec(Object.assign({}, UI.state.customSpec, { [key]: value }));
    UI.render();
  },

  customSolo() {
    const h = Player.horse(UI.state.raceHorse);
    if (!h) return;
    const spec = Pvp.sanitizeSpec(UI.state.customSpec);
    this.pendingMatch = Object.assign(Pvp.buildCustomMatch(spec, [Pvp.playerEntrant(h, spec.cap || null)]), { hid: h.id });
    this.matchModal(this.pendingMatch, h);
  },

  playCustom(race, result, reward, hid, online) {
    RaceView.start({
      result, reward, race, horseId: hid,
      resultHTML: v => `${v.placeHead(reward.place, result.finish[0].name)}
        ${v.reviewHTML()}
        ${v.resultTable(result.finish)}
        ${v.lapHTML(result)}
        <p class="muted small center">カスタムレースはエキシビションです（賞金・経験値・疲労なし）。</p>
        <div class="btn-row">${v.three ? '<button class="btn" onclick="RaceView.replay()">🎬 ゴール前リプレイ</button>' : ''}
          ${online ? '<button class="btn primary" onclick="Online.backToLobby()">🌐 ルームに戻る</button>'
            : `<button class="btn" onclick="App.customSolo()">🔁 もう一度</button><button class="btn primary" onclick="UI.state.raceMode='custom';UI.show('race')">🛠 カスタムレースへ</button>`}</div>`
    });
  },

  customHost() {
    const h = Player.horse(UI.state.raceHorse);
    if (h) Online.host(UI.state.customSpec, h);
  },

  customJoin() {
    const h = Player.horse(UI.state.raceHorse);
    const el = UI.el('join-code');
    if (el) UI.state.joinCode = el.value;
    if (h) Online.join(UI.state.joinCode, h);
  },

  customLeave() { Online.leave(); },

  customChangeHorse() {
    const h = Player.horse(UI.state.raceHorse);
    if (!h) return;
    Online.changeHorse(h);
    UI.toast(`🔄 出走馬を${Util.esc(h.name)}に変更しました`);
  },

  copyRoom() {
    const text = Online.inviteUrl() || Online.code;
    const done = () => UI.toast('📋 コピーしました。フレンドに送ろう！');
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => UI.toast(`ルームコード：${Online.code}`));
    else UI.toast(`ルームコード：${Online.code}`);
  },

  showCode(hid) {
    const h = Player.horse(hid);
    if (!h) return;
    const code = Pvp.exportCode(h);
    UI.modal(`<h3>📤 ${Util.esc(h.name)}の対戦コード</h3>
      <p class="muted small">このコードをコピーしてフレンドに送ろう。フレンドは「レース → フレンド対戦」に貼り付けると対戦できます。<br>※ 今の能力・スキルが記録されます。成長したら作り直してね。</p>
      <textarea id="my-code" class="code-box" rows="5" readonly onclick="this.select()">${code}</textarea>
      <div class="btn-row"><button class="btn primary" onclick="App.copyCode()">📋 コピー</button><button class="btn" onclick="UI.closeModal()">閉じる</button></div>`, { cls: 'small' });
  },

  copyCode() {
    const el = UI.el('my-code');
    el.select();
    const done = () => UI.toast('📋 コピーしました');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el.value).then(done, () => { document.execCommand('copy'); done(); });
    else { document.execCommand('copy'); done(); }
  },

  addGhost() {
    const el = UI.el('ghost-code');
    try {
      const g = Pvp.addGhost(el.value);
      if (!UI.state.friendPick.includes(g.id) && UI.state.friendPick.length < 7) UI.state.friendPick.push(g.id);
      UI.toast(`🤝 ${Util.esc(g.owner)}厩舎の「${Util.esc(g.name)}」を追加しました`);
      this.commit();
    } catch (e) {
      UI.toast(e.message, 'error');
    }
  },

  removeGhost(id) {
    Player.data.ghosts = Player.data.ghosts.filter(g => g.id !== id);
    UI.state.friendPick = UI.state.friendPick.filter(x => x !== id);
    this.commit();
  },

  toggleGhost(id) {
    const pick = UI.state.friendPick;
    const i = pick.indexOf(id);
    if (i >= 0) pick.splice(i, 1);
    else if (pick.length < 7) pick.push(id);
    else UI.toast('対戦できるのは最大7頭です', 'error');
    UI.render();
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
    if (!c || !c.price) return;
    if (Player.shopLeft(c) <= 0) return UI.toast('今週の入荷分は売り切れです。来週また来てね', 'error');
    if (!Player.canAfford(c.price)) return UI.toast('お金が足りません', 'error');
    Player.addMoney(-c.price);
    Player.shopBuy(c);
    Player.addCard(id);
    UI.toast(`🛒 ${c.name} を購入しました`);
    this.commit();
  },

  buyPack(id) {
    const pk = GAME_DATA.packs.find(x => x.id === id);
    if (!pk) return;
    if (Player.shopLeft(pk) <= 0) return UI.toast('今週の入荷分は売り切れです。来週また来てね', 'error');
    if (!Player.canAfford(pk.price)) return UI.toast('お金が足りません', 'error');
    Player.addMoney(-pk.price);
    Player.shopBuy(pk);
    const cards = Cards.openPack(pk).map(c => {
      const isNew = !Player.data.seenCards.includes(c.id);
      Player.addCard(c.id);
      return { card: c, isNew };
    });
    this.commit();
    const best = cards.reduce((a, b) => (Cards.rarityIndex(b.card.rarity) > Cards.rarityIndex(a.card.rarity) ? b : a)).card.rarity;
    UI.modal(`<div class="birth"><div class="sparkle">${pk.icon}</div><h2>${pk.name}を開封！</h2>
      ${['SSR', 'UR'].includes(best) ? `<p class="ok">🌈 ${best}が出た！</p>` : ''}
      <div class="cgrid reveal-grid">${RaceView.cardsHTML(cards)}</div>
      <div class="btn-row"><button class="btn" onclick="UI.closeModal()">OK</button>
      <button class="btn primary" ${Player.canAfford(pk.price) && Player.shopLeft(pk) > 0 ? '' : 'disabled'} onclick="App.buyPack('${pk.id}')">もう1パック（${Util.money(pk.price)}・今週あと${Player.shopLeft(pk)}）</button></div></div>`);
  },

  cardDetail(id) {
    const c = Cards.get(id);
    if (!c) return;
    let detail = '';
    if (c.type === 'sire' || c.type === 'mare') {
      const sk = c.skill ? Cards.get(c.skill) : null;
      detail = `${c.legend ? this.legendPhotoBlock(c) : ''}<p>${Util.esc(c.desc || '')}</p>
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

  // ── 名馬の写真 ──
  legendPhotoBlock(c) {
    const url = Legends.photoUrl(c.legendId);
    const cr = Legends.photoCredit(c.legendId);
    const credit = !cr ? '<small class="muted">写真なし（自分で設定できます）</small>'
      : cr.custom ? '<small class="muted">📷 あなたが設定した写真</small>'
      : `<small class="muted">📷 ${Util.esc(cr.artist)}／<a href="${cr.licenseUrl || cr.page}" target="_blank" rel="noopener">${Util.esc(cr.license)}</a>／<a href="${cr.page}" target="_blank" rel="noopener">Wikimedia Commons</a></small>`;
    return `<div class="legend-photo">${url ? `<img src="${url}" alt="${Util.esc(c.name)}">` : ''}${credit}
      <div class="btn-row">
        <label class="btn small">📷 写真を変更<input type="file" accept="image/*" hidden onchange="App.setLegendPhoto('${c.legendId}', this)"></label>
        ${cr && cr.custom ? `<button class="btn small" onclick="App.resetLegendPhoto('${c.legendId}')">↩ 元に戻す</button>` : ''}
      </div></div>`;
  },

  async setLegendPhoto(id, input) {
    const f = input.files && input.files[0];
    if (!f) return;
    try {
      await Legends.setPhoto(id, f);
      UI.toast('📷 写真を設定しました');
      this.cardDetail('lc_' + id);
      UI.render();
    } catch (e) { UI.toast(e.message, 'error'); }
  },

  async resetLegendPhoto(id) {
    await Legends.resetPhoto(id);
    this.cardDetail('lc_' + id);
    UI.render();
  },

  photoCredits() {
    const list = Object.entries(GAME_DATA.legendPhotos || {});
    UI.modal(`<h3>📷 名馬写真のクレジット</h3>
      <p class="muted small">名馬カードの写真は Wikimedia Commons の自由ライセンス画像です（Wikidata の各馬の代表画像を縮小して使用）。各ライセンスの条件に従って利用しています。</p>
      <div class="credits">${list.map(([id, p]) => `<div><b>${Util.esc((Legends.get(id) || {}).name || id)}</b>：${Util.esc(p.artist)}／<a href="${p.licenseUrl || p.page}" target="_blank" rel="noopener">${Util.esc(p.license)}</a>／<a href="${p.page}" target="_blank" rel="noopener">出典</a></div>`).join('')}</div>`);
  },

  // ── ファンファーレ設定 ──
  fanfareSettings() {
    const rows = Fanfare.SLOTS.map(s => {
      const m = Media.meta[Fanfare.key(s.id)];
      const has = !!Fanfare.custom(s.id);
      return `<div class="ff-row">
        <div><b>${s.label}</b><small>${s.desc}</small>
          <small class="${has ? 'ok' : 'muted'}">${has ? `🎵 ${Util.esc(m.name || '登録済み')}（${(m.duration || 0).toFixed(1)}秒）` : 'オリジナル曲'}</small></div>
        <div class="ff-btns">
          <button class="btn small" onclick="App.fanfareTest('${s.id}')">▶</button>
          <label class="btn small">📂 登録<input type="file" accept="audio/*" hidden onchange="App.fanfareUpload('${s.id}', this)"></label>
          ${has ? `<button class="btn small" onclick="App.fanfareRemove('${s.id}')">🗑</button>` : ''}
        </div></div>`;
    }).join('');
    UI.modal(`<h3>🎺 ファンファーレ設定</h3>
      <p class="muted small">3Dレースのゲートイン中に、競馬場（関東・関西・ローカル）とレースの格に合わせて流れます。</p>
      <p class="notice small">JRAのファンファーレは作曲家の著作物のため、ゲームには入っていません。ご自身で正規に入手した音源ファイルを各区分に登録できます（ファイルはこのブラウザの中だけに保存され、外部には送信されません）。</p>
      ${Media.ok ? '' : '<p class="warn small">この環境では保存ができないため、登録はページを開いている間だけ有効です。</p>'}
      <div class="ff-list">${rows}</div>
      <button class="btn" onclick="Fanfare.stop();UI.closeModal()">閉じる</button>`);
  },

  fanfareTest(slot) {
    Race3D.sound.init();
    Fanfare.play(slot);
  },

  async fanfareUpload(slot, input) {
    const r = await Fanfare.register(slot, input.files && input.files[0]);
    if (!r.ok) return UI.toast(r.reason, 'error');
    UI.toast(`🎺 登録しました（${r.duration.toFixed(1)}秒）`);
    this.fanfareSettings();
  },

  async fanfareRemove(slot) {
    Fanfare.stop();
    await Fanfare.remove(slot);
    this.fanfareSettings();
  },

  // ── 設定 ──
  settings() {
    UI.modal(`<h3>⚙ 設定</h3>
      <label>厩舎の名前<input id="set-name" maxlength="12" value="${Util.esc(Player.data.name)}"></label>
      <label class="check-row"><input type="checkbox" id="set-legends" ${Player.data.settings.legends !== false ? 'checked' : ''}> 👑 実在の名馬をライバルとして出走させる</label>
      <label>🌐 オンラインの接続サーバー<small class="muted">（空欄＝PeerJSの公開サーバー。自前の PeerServer を使うときだけ入力）</small><input id="set-peer" placeholder="例：example.com:9000/myapp" value="${Util.esc(Player.data.settings.peerServer || '')}"></label>
      <label>👑 名馬の強さ<select id="set-legend-level">${Object.entries(Legends.LEVELS).map(([k, v]) => `<option value="${k}" ${Legends.level() === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
      <button class="btn primary" onclick="App.saveSettings()">保存</button>
      <div class="btn-row"><button class="btn" onclick="App.fanfareSettings()">🎺 ファンファーレ設定</button><button class="btn" onclick="App.photoCredits()">📷 写真クレジット</button></div>
      <hr>
      <p class="muted small">データはこのブラウザ（localStorage）に自動保存されています。</p>
      <button class="btn danger" onclick="App.confirmReset()">データを消去して最初から</button>`, { cls: 'small' });
  },

  saveSettings() {
    const v = (UI.el('set-name').value || '').trim().slice(0, 12);
    if (v) Player.data.name = v;
    Player.data.settings.legends = UI.el('set-legends').checked;
    Player.data.settings.legendLevel = UI.el('set-legend-level').value;
    Player.data.settings.peerServer = (UI.el('set-peer').value || '').trim().slice(0, 120);
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
