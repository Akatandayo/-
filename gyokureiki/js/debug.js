/* 東方玉霊姫 - 開発者モード（デバッグ版のみで読み込まれる）
 * 画面右下の 🐞 から開く。セーブ編集・バトル操作・テスト対戦・自動シミュレーション・データ検査・エラーログ。
 */
(function () {
  'use strict';

  const D = window.GK_DATA;
  const KD = GK.KODAMA;
  const APP = window.GK_APP;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DBG = window.GK_DEBUG = { speed: 1, auto: false, autoLevel: 'hard', errors: [], battleLog: [] };

  /* ================= エラー収集 ================= */
  function logError(kind, msg, stack) {
    DBG.errors.push({ t: new Date().toLocaleTimeString(), kind, msg: String(msg), stack: stack ? String(stack).split('\n').slice(0, 6).join('\n') : '' });
    badge();
    if (panelOpen && tab === 'log') render();
  }
  window.addEventListener('error', e => logError('error', e.message, e.error && e.error.stack));
  window.addEventListener('unhandledrejection', e => logError('promise', e.reason && e.reason.message || e.reason, e.reason && e.reason.stack));
  const origErr = console.error.bind(console);
  console.error = (...a) => { logError('console', a.map(x => (x && x.message) || x).join(' ')); origErr(...a); };

  /* ================= バトルログの記録・AI自動操作 ================= */
  let lastState = null;
  setInterval(() => {
    const cur = APP.current;
    if (cur && cur.state && cur.state !== lastState) {
      lastState = cur.state;
      for (const l of cur.state.log || []) if (l.text) DBG.battleLog.push(`[T${cur.state.turn}] ${l.text}`);
      if (DBG.battleLog.length > 3000) DBG.battleLog.splice(0, DBG.battleLog.length - 3000);
      checkInvariants(cur.state);
    }
    if (DBG.auto && cur && cur.view && cur.view.canAct && cur.view.canAct()) {
      try {
        const act = GK.chooseAI(cur.state, cur.me, DBG.autoLevel);
        if (act) cur.view.onAction(act);
      } catch (e) { logError('auto', e.message, e.stack); DBG.auto = false; }
    }
    if (DBG.auto && cur && cur.view && !cur.view.busy) {
      const box = $('#msgbox'); if (box) box.click();
    }
  }, 250);

  // 状態の不整合チェック（NaN・範囲外・不正なactive など）
  function checkInvariants(st) {
    const probs = [];
    st.sides.forEach((s, i) => {
      if (!(s.active >= 0 && s.active < s.party.length)) probs.push(`side${i}: active=${s.active} が範囲外`);
      s.party.forEach((m, j) => {
        for (const k of ['hp', 'vp', 'maxhp', 'maxvp', 'atk', 'df', 'spd']) if (!Number.isFinite(m[k])) probs.push(`side${i}[${j}] ${m.name}.${k}=${m[k]}`);
        if (m.hp < 0 || m.hp > m.maxhp) probs.push(`side${i}[${j}] ${m.name} HP範囲外 ${m.hp}/${m.maxhp}`);
        if (m.vp < 0 || m.vp > m.maxvp) probs.push(`side${i}[${j}] ${m.name} VP範囲外 ${m.vp}/${m.maxvp}`);
        for (const k of ['atk', 'df', 'spd']) if (!Number.isFinite(m.mods[k]) || m.mods[k] <= 0) probs.push(`side${i}[${j}] ${m.name} mods.${k}=${m.mods[k]}`);
      });
    });
    if (st.phase === 'command' && st.sides.some(s => s.party[s.active] && s.party[s.active].hp <= 0)) probs.push('phase=command なのに場のコダマが倒れている');
    for (const p of probs) logError('invariant', p);
    return probs;
  }

  /* ================= UI ================= */
  const css = document.createElement('style');
  css.textContent = `
  #dbg-btn{position:fixed;right:10px;bottom:10px;z-index:90;width:48px;height:48px;border-radius:50%;border:2px solid #f5c542;background:#1d2238;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 2px 8px #0006}
  #dbg-btn .n{position:absolute;top:-4px;right:-4px;background:#e0413a;color:#fff;font-size:11px;border-radius:9px;padding:0 5px;font-family:system-ui}
  #dbg{position:fixed;inset:0;z-index:95;background:#0009;display:none;justify-content:center}
  #dbg.open{display:flex}
  #dbg .box{background:#151a2c;color:#e8ecff;width:100%;max-width:480px;height:100%;overflow-y:auto;font:13px/1.45 system-ui,sans-serif;padding:8px 10px 60px}
  #dbg h3{margin:10px 0 4px;font-size:14px;color:#f5c542}
  #dbg .tabs{display:flex;flex-wrap:wrap;gap:3px;position:sticky;top:-8px;background:#151a2c;padding:6px 0;z-index:1}
  #dbg .tabs button{flex:1 1 auto;background:#262d4a;color:#cfd6ff;border:1px solid #3a4470;border-radius:4px;padding:5px 6px;cursor:pointer;font-size:12px}
  #dbg .tabs button.on{background:#f5c542;color:#151a2c;border-color:#f5c542}
  #dbg button.b{background:#2d3760;color:#fff;border:1px solid #4a5a99;border-radius:4px;padding:4px 8px;margin:2px;cursor:pointer;font-size:12px}
  #dbg button.b.red{background:#6b2230;border-color:#a13a4c}
  #dbg button.b:disabled{opacity:.4}
  #dbg input,#dbg select,#dbg textarea{background:#0c1020;color:#e8ecff;border:1px solid #3a4470;border-radius:3px;padding:3px 5px;font:12px system-ui}
  #dbg input[type=number]{width:70px}
  #dbg textarea{width:100%;min-height:160px;font-family:ui-monospace,monospace;font-size:11px}
  #dbg .row{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:3px 0}
  #dbg .card{background:#1d2340;border:1px solid #2f3866;border-radius:5px;padding:6px 8px;margin:6px 0}
  #dbg .mono{font-family:ui-monospace,monospace;font-size:11px;white-space:pre-wrap;word-break:break-all}
  #dbg .ok{color:#7be08a}#dbg .ng{color:#ff7b8a}#dbg .dim{color:#8f98c4}
  #dbg table{border-collapse:collapse;width:100%;font-size:11px}#dbg td,#dbg th{border:1px solid #2f3866;padding:2px 4px;text-align:left}
  .dbg-tag{position:fixed;left:6px;bottom:6px;z-index:89;background:#e0413a;color:#fff;font:bold 11px system-ui;padding:2px 6px;border-radius:3px;letter-spacing:1px;pointer-events:none}
  `;
  document.head.appendChild(css);
  document.body.insertAdjacentHTML('beforeend', `<div class="dbg-tag">DEBUG</div><button id="dbg-btn" title="開発者モード">🐞<span class="n" hidden></span></button><div id="dbg"><div class="box"></div></div>`);
  const root = $('#dbg'), box = $('#dbg .box');
  let panelOpen = false, tab = 'save';
  $('#dbg-btn').onclick = () => { panelOpen = true; root.classList.add('open'); render(); };
  root.addEventListener('click', e => { if (e.target === root) close(); });
  function close() { panelOpen = false; root.classList.remove('open'); }
  function badge() { const n = $('#dbg-btn .n'); n.hidden = !DBG.errors.length; n.textContent = DBG.errors.length; }
  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2000); }

  const TABS = { save: 'セーブ', battle: 'バトル', test: 'テスト対戦', sim: 'シミュ', data: 'データ', log: 'ログ', opt: '設定' };
  function render() {
    let h = `<div class="tabs">${Object.entries(TABS).map(([k, v]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${v}${k === 'log' && DBG.errors.length ? `(${DBG.errors.length})` : ''}</button>`).join('')}<button data-act="close">✕</button></div>`;
    try { h += ({ save: tabSave, battle: tabBattle, test: tabTest, sim: tabSim, data: tabData, log: tabLog, opt: tabOpt })[tab](); }
    catch (e) { h += `<div class="ng">描画エラー: ${esc(e.message)}</div>`; logError('debug-ui', e.message, e.stack); }
    box.innerHTML = h;
  }
  box.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; render(); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    try { ACTIONS[a.dataset.act](a); } catch (err) { logError('debug-action', err.message, err.stack); toast('エラー: ' + err.message); }
  });
  const val = id => $('#' + id, box) ? $('#' + id, box).value : '';
  const num = (id, d) => { const v = Number(val(id)); return Number.isFinite(v) && val(id) !== '' ? v : d; };
  const ids = str => String(str).split(/[\s,、]+/).map(x => x.trim()).filter(Boolean).map(x => /^\d+$/.test(x) ? +x : (D.kodama.find(k => k.name === x) || {}).id).filter(id => KD[id]);

  /* ---------- セーブ ---------- */
  function tabSave() {
    const s = APP.save;
    if (!s) return `<h3>セーブなし</h3><div class="row"><button class="b" data-act="newSave">デバッグ用セーブを作成（ちびれいむ）</button><button class="b" data-act="copyMain">通常版のセーブをコピー</button></div>${saveJsonBox()}`;
    const cleared = Object.keys(s.cleared).length;
    return `
      <div class="card">名前 <b>${esc(s.name)}</b>　銭 <b>${s.money.toLocaleString()}</b>　契約 <b>${s.owned.length}</b>/${D.kodama.length}　クリア <b>${cleared}</b>/${GKS.AREAS.length * GKS.STAGES_PER_AREA}<br>
      <span class="dim">保存先キー: ${esc(APP.PREFIX)}save（通常版とは別）</span></div>
      <h3>お金・道具</h3>
      <div class="row">銭 <input id="d-money" type="number" value="${s.money}"><button class="b" data-act="setMoney">設定</button><button class="b" data-act="richMoney">+1000万</button></div>
      <div class="row">ちび契約書<input id="d-i-chibi" type="number" value="${s.items.chibi || 0}"> 玉霊<input id="d-i-random" type="number" value="${s.items.random || 0}"></div>
      <div class="row">禁呪の書<input id="d-i-book" type="number" value="${s.items.book || 0}"> 修行の書<input id="d-i-scroll" type="number" value="${s.items.scroll || 0}"><button class="b" data-act="setItems">設定</button></div>
      <h3>コダマ</h3>
      <div class="row">ID/名前 <input id="d-add" placeholder="例: 9601, ちびれいむ" style="width:160px"> Lv<input id="d-addlv" type="number" value="50"><button class="b" data-act="addKodama">追加</button><button class="b" data-act="addContract">契約書で追加</button></div>
      <div class="row"><button class="b" data-act="addAll">全コダマと契約</button><button class="b" data-act="addSpecial">特殊コダマ全員</button>Lv<input id="d-alllv" type="number" value="100"></div>
      <div class="row">パーティ全員を Lv<input id="d-plv" type="number" value="100"><button class="b" data-act="partyLv">設定</button><button class="b" data-act="allLv">契約コダマ全員に設定</button></div>
      <div class="row"><button class="b" data-act="learnAll">パーティ全員 全スペル習得</button><button class="b" data-act="evoReady">ちびを全員Lv30以上に</button></div>
      <h3>ストーリー・Vs</h3>
      <div class="row">エリア <input id="d-area" type="number" value="${GKS.progressArea(s)}" min="0" max="${GKS.AREAS.length}"> までクリア済みにする<button class="b" data-act="setProgress">設定</button></div>
      <div class="row"><button class="b" data-act="clearAll">全ステージクリア</button><button class="b red" data-act="resetStory">ストーリー進行リセット</button><button class="b" data-act="resetIntro">会話既読リセット</button><button class="b" data-act="resetVs">Vs勝利数リセット</button></div>
      <h3>セーブ操作</h3>
      <div class="row"><button class="b" data-act="copyMain">通常版のセーブで上書き</button><button class="b red" data-act="delSave">デバッグセーブ削除</button></div>
      ${saveJsonBox()}`;
  }
  function saveJsonBox() {
    return `<h3>セーブJSON（直接編集）</h3><textarea id="d-json">${esc(JSON.stringify(APP.save, null, 1) || '')}</textarea>
      <div class="row"><button class="b" data-act="applyJson">適用</button><button class="b" data-act="copyJson">コピー</button><button class="b" data-act="reload">再読込</button></div>`;
  }
  const done = msg => { APP.persist(); APP.refresh(); toast(msg); render(); };
  const ACTIONS = {
    close,
    reload: () => render(),
    newSave() { APP.setSave(GKP.newSave('デバッグ', 1)); done('作成しました'); APP.go('title'); },
    copyMain() {
      const raw = localStorage.getItem('gk_save');
      if (!raw) return toast('通常版のセーブがありません');
      if (!APP.setSave(JSON.parse(raw))) return toast('読み込めませんでした');
      done('通常版のセーブをコピーしました'); APP.go('title');
    },
    delSave() { if (!confirm('デバッグ用セーブを削除しますか？')) return; APP.clearSave(); APP.go('title'); render(); },
    setMoney() { APP.save.money = Math.max(0, Math.floor(num('d-money', 0))); done('設定しました'); },
    richMoney() { APP.save.money += 10000000; done('+1000万銭'); },
    setItems() { for (const k of ['chibi', 'random', 'book', 'scroll']) APP.save.items[k] = Math.max(0, Math.floor(num('d-i-' + k, 0))); done('設定しました'); },
    addKodama() {
      const list = ids(val('d-add')); if (!list.length) return toast('IDが見つかりません');
      for (const id of list) GKP.addKodama(APP.save, id, num('d-addlv', 50));
      done(`${list.length}体追加しました`);
    },
    addContract() {
      const list = ids(val('d-add')); if (!list.length) return toast('IDが見つかりません');
      for (const id of list) APP.save.contracts.push({ id, lv: num('d-addlv', 20) });
      done(`契約書を${list.length}枚追加しました（持ち物から使用）`);
    },
    addAll() { const lv = num('d-alllv', 100); let n = 0; for (const k of D.kodama) if (!GKP.owns(APP.save, k.id)) { GKP.addKodama(APP.save, k.id, lv); n++; } done(`${n}体追加しました`); },
    addSpecial() { const lv = num('d-alllv', 100); let n = 0; for (const k of D.kodama) if (k.special && !GKP.owns(APP.save, k.id)) { GKP.addKodama(APP.save, k.id, lv); n++; } done(`${n}体追加しました`); },
    partyLv() { const lv = Math.max(1, Math.min(100, num('d-plv', 100))); for (const m of GKP.partyMembers(APP.save)) { m.lv = lv; m.exp = 0; } done('設定しました'); },
    allLv() { const lv = Math.max(1, Math.min(100, num('d-plv', 100))); for (const m of APP.save.owned) { m.lv = lv; m.exp = 0; } done('設定しました'); },
    learnAll() {
      for (const m of GKP.partyMembers(APP.save)) m.learned = [...new Set(KD[m.id].spells.map(s => s.name))];
      done('全スペル習得（装備はパーティ画面で）');
    },
    evoReady() { for (const m of APP.save.owned) if (GKP.isBase(KD[m.id]) && m.lv < GKP.EVOLVE_LV) m.lv = GKP.EVOLVE_LV; done('設定しました'); },
    setProgress() {
      const n = Math.max(0, Math.min(GKS.AREAS.length, num('d-area', 0)));
      APP.save.cleared = {};
      for (let a = 0; a < n; a++) for (let j = 0; j < GKS.STAGES_PER_AREA; j++) APP.save.cleared[GKS.stageKey(a, j)] = 1;
      done(`エリア${n}までクリア済みにしました`);
    },
    clearAll() { for (let a = 0; a < GKS.AREAS.length; a++) for (let j = 0; j < GKS.STAGES_PER_AREA; j++) APP.save.cleared[GKS.stageKey(a, j)] = 1; done('全ステージクリア'); },
    resetStory() { if (!confirm('ストーリー進行をリセットしますか？')) return; APP.save.cleared = {}; APP.save.intro = {}; done('リセットしました'); },
    resetIntro() { APP.save.intro = {}; done('会話既読をリセットしました'); },
    resetVs() { APP.save.vsWins = {}; done('リセットしました'); },
    applyJson() {
      let obj; try { obj = JSON.parse(val('d-json')); } catch (e) { return toast('JSONエラー: ' + e.message); }
      if (!APP.setSave(obj)) return toast('セーブとして不正です');
      done('適用しました'); APP.go('title');
    },
    copyJson() { copy(val('d-json')); },

    /* バトル */
    heal(a) { const m = activeOf(+a.dataset.side); m.hp = m.maxhp; m.vp = m.maxvp; m._fainted = false; battleDone('全回復'); },
    hp1(a) { activeOf(+a.dataset.side).hp = 1; battleDone('HP1にしました'); },
    vp0(a) { activeOf(+a.dataset.side).vp = 0; battleDone('VP0にしました'); },
    setStats(a) {
      const side = +a.dataset.side, m = activeOf(side), p = `d-b${side}-`;
      m.hp = clamp(num(p + 'hp', m.hp), 0, m.maxhp); m.vp = clamp(num(p + 'vp', m.vp), 0, m.maxvp);
      for (const k of ['atk', 'df', 'spd']) m.mods[k] = clamp(num(p + k, m.mods[k]), 0.2, 4);
      const st = APP.current.state.sides[side];
      st.shield = Math.max(0, Math.floor(num(p + 'shield', st.shield || 0)));
      st.frozen = Math.max(0, Math.floor(num(p + 'frozen', st.frozen || 0)));
      m.skillNull = $('#' + p + 'null', box).checked;
      battleDone('反映しました');
    },
    killFoe() {
      const cur = APP.current, foe = 1 - cur.me;
      for (const m of cur.state.sides[foe].party) { m.hp = 0; m._fainted = true; }
      forceEnd(cur.me);
    },
    forceWin() { forceEnd(APP.current.me); },
    forceLose() { forceEnd(1 - APP.current.me); },
    toggleAuto() { DBG.auto = !DBG.auto; toast(DBG.auto ? 'AI自動操作 ON' : 'AI自動操作 OFF'); render(); },
    copyState() { copy(JSON.stringify(APP.current.state, null, 1)); },
    copyBattleLog() { copy(DBG.battleLog.join('\n')); },
    clearBattleLog() { DBG.battleLog = []; render(); },

    /* テスト対戦 */
    startTest() {
      const a = ids(val('t-a')), b = ids(val('t-b'));
      if (!a.length || !b.length) return toast('両チームにIDを入れてください');
      const lvA = num('t-lva', 50), lvB = num('t-lvb', 50);
      const allSp = $('#t-allsp', box).checked;
      const mk = (id, lv) => ({ id, lv, slv: GKP.slvFor(lv), spells: allSp ? pickSpells(id) : undefined });
      const boost = { hp: num('t-bhp', 1), atk: num('t-batk', 1), df: num('t-bdf', 1), spd: num('t-bspd', 1) };
      const seedStr = val('t-seed');
      close();
      APP.startBattle({
        kind: 'flat', level: val('t-ai'), myName: 'テストA', mine: a.map(id => mk(id, lvA)),
        foe: { name: 'テストB', party: b.map(id => mk(id, lvB)) },
        boost: Object.values(boost).some(v => v !== 1) ? [null, boost] : null,
        seed: seedStr ? Number(seedStr) : undefined,
        onExit: () => { APP.go(APP.save ? 'title' : 'title'); },
      });
      DBG.battleLog = [];
    },
    vsPreset(a) { $('#t-b', box).value = (KD[+a.dataset.id].vs.party || [+a.dataset.id]).join(','); },

    /* シミュ */
    runSim() { runSim(); },
    runSpellTest() { runSpellTest(); },
    stopSim() { simStop = true; },

    /* データ */
    inspect() { inspectId = ids(val('i-id'))[0] || null; render(); },

    /* ログ */
    copyErrors() { copy(DBG.errors.map(e => `[${e.t}] ${e.kind}: ${e.msg}\n${e.stack}`).join('\n\n')); },
    clearErrors() { DBG.errors = []; badge(); render(); },

    /* 設定 */
    applyOpt() {
      DBG.speed = clamp(num('o-speed', 1), 0.05, 3);
      DBG.autoLevel = val('o-ailv');
      toast('反映しました'); render();
    },
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('コピーしました'), () => fallback());
    else fallback();
    function fallback() { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('コピーしました'); } catch (e) { toast('コピー失敗'); } t.remove(); }
  }
  function pickSpells(id) {
    const k = KD[id];
    return GK.defaultSpells(k);
  }

  /* ---------- バトル ---------- */
  const activeOf = side => { const st = APP.current.state; return st.sides[side].party[st.sides[side].active]; };
  function battleDone(msg) { checkInvariants(APP.current.state); APP.refresh(); toast(msg); render(); }
  async function forceEnd(winner) {
    const cur = APP.current;
    if (!cur || !cur.state || cur.state.phase === 'end') return toast('バトル中ではありません');
    if (cur.view && cur.view.busy) return toast('演出中です。少し待ってください');
    cur.state.phase = 'end'; cur.state.winner = winner; cur.state.need = [false, false];
    cur.state.log = [{ text: '（デバッグ）強制終了', snap: cur.state.log && cur.state.log.length ? cur.state.log[cur.state.log.length - 1].snap : null }].filter(l => l.snap);
    close();
    if (typeof cur.finish === 'function' && !cur.ended) { cur.ended = true; APP.refresh(); await cur.finish(); }
    APP.refresh();
  }
  function tabBattle() {
    const cur = APP.current;
    if (!cur || !cur.state) return '<div class="card dim">バトル中ではありません。「テスト対戦」タブから任意の対戦を始められます。</div>' + battleLogBox();
    const st = cur.state;
    let h = `<div class="card">ターン <b>${st.turn}</b>　phase <b>${st.phase}</b>　need ${JSON.stringify(st.need)}　seed ${st.seed}<br>
      種類: ${esc((cur.opts && cur.opts.kind) || (cur.constructor && cur.constructor.name))}　あなた=side${cur.me}　勝者: ${st.winner == null ? '-' : st.winner}</div>
      <div class="row"><button class="b" data-act="toggleAuto">AI自動操作: ${DBG.auto ? 'ON' : 'OFF'}</button>
      <button class="b" data-act="forceWin" ${st.phase === 'end' ? 'disabled' : ''}>強制勝利</button><button class="b" data-act="forceLose" ${st.phase === 'end' ? 'disabled' : ''}>強制敗北</button>
      <button class="b" data-act="killFoe" ${st.phase === 'end' ? 'disabled' : ''}>相手全滅</button><button class="b" data-act="copyState">state JSONコピー</button></div>`;
    for (const side of [cur.me, 1 - cur.me]) {
      const s = st.sides[side], m = s.party[s.active], p = `d-b${side}-`;
      const sk = m.skill ? GK.parseSkill(m.skill.desc) : null;
      h += `<div class="card"><b>${side === cur.me ? '自分' : '相手'}</b>（side${side}）: ${esc(m.name)} Lv${m.lv} [${m.types.join('')}] No.${m.id}<br>
        <span class="dim">実数値 攻${m.atk} 防${m.df} 速${m.spd}　実効 攻${Math.floor(m.atk * m.mods.atk)} 防${Math.floor(m.df * m.mods.df)} 速${Math.floor(m.spd * m.mods.spd)}　SLv${m.slv}${m.impulse ? '　impulse' : ''}${m.raid ? '　BOSS' : ''}</span>
        <div class="row">HP<input id="${p}hp" type="number" value="${m.hp}">/${m.maxhp} VP<input id="${p}vp" type="number" value="${m.vp}">/${m.maxvp}</div>
        <div class="row">攻×<input id="${p}atk" type="number" step="0.05" value="${m.mods.atk.toFixed(2)}"> 防×<input id="${p}df" type="number" step="0.05" value="${m.mods.df.toFixed(2)}"> 速×<input id="${p}spd" type="number" step="0.05" value="${m.mods.spd.toFixed(2)}"></div>
        <div class="row">半減ターン<input id="${p}shield" type="number" value="${s.shield || 0}"> 時停止<input id="${p}frozen" type="number" value="${s.frozen || 0}"> <label><input id="${p}null" type="checkbox" ${m.skillNull ? 'checked' : ''}> スキル無効</label></div>
        <div class="row"><button class="b" data-act="setStats" data-side="${side}">反映</button><button class="b" data-act="heal" data-side="${side}">全回復</button><button class="b" data-act="hp1" data-side="${side}">HP1</button><button class="b" data-act="vp0" data-side="${side}">VP0</button></div>
        <div class="mono dim">スキル: ${m.skill ? esc(m.skill.name) + ' ' + esc(JSON.stringify(sk)) : 'なし'}
使用済み: ${esc(JSON.stringify(m.used || {}))}
控え: ${s.party.map((p2, i) => `${i === s.active ? '*' : ''}${p2.name}(${p2.hp}/${p2.maxhp})`).join(' ')}</div></div>`;
    }
    return h + battleLogBox();
  }
  function battleLogBox() {
    return `<h3>バトルログ（直近${Math.min(DBG.battleLog.length, 200)}件／全${DBG.battleLog.length}件）</h3>
      <div class="row"><button class="b" data-act="copyBattleLog">全文コピー</button><button class="b" data-act="clearBattleLog">クリア</button></div>
      <div class="card mono">${esc(DBG.battleLog.slice(-200).join('\n')) || '<span class="dim">なし</span>'}</div>`;
  }

  /* ---------- テスト対戦 ---------- */
  function tabTest() {
    const vs = GKP.VS_LIST.map(id => `<button class="b" data-act="vsPreset" data-id="${id}">${esc(KD[id].vs.title)}</button>`).join('');
    return `<p class="dim">任意のコダマ同士で対戦します（報酬なし・セーブ不要）。IDまたは名前をカンマ区切りで最大6体。</p>
      <div class="row">チームA（自分）<input id="t-a" value="1,73,154" style="flex:1"> Lv<input id="t-lva" type="number" value="50"></div>
      <div class="row">チームB（相手）<input id="t-b" value="9601" style="flex:1"> Lv<input id="t-lvb" type="number" value="50"></div>
      <div class="row">相手プリセット: ${vs}</div>
      <div class="row">相手ブースト HP×<input id="t-bhp" type="number" step="0.1" value="1"> 攻×<input id="t-batk" type="number" step="0.1" value="1"> 防×<input id="t-bdf" type="number" step="0.1" value="1"> 速×<input id="t-bspd" type="number" step="0.1" value="1"></div>
      <div class="row">相手AI <select id="t-ai"><option value="easy">easy</option><option value="normal">normal</option><option value="hard" selected>hard</option></select>
        乱数シード<input id="t-seed" type="number" placeholder="空欄=ランダム" style="width:110px"> <label><input id="t-allsp" type="checkbox" checked> 最強スペル4つを装備</label></div>
      <button class="b" data-act="startTest">対戦開始</button>`;
  }

  /* ---------- シミュレーション ---------- */
  let simStop = false, simResult = '';
  function tabSim() {
    return `<h3>AI同士の自動対戦（バグ探し）</h3>
      <p class="dim">エラー・不整合（NaN／HP範囲外など）・無限ループを検出します。チームを空欄にするとランダム。</p>
      <div class="row">A<input id="s-a" placeholder="空欄=ランダム6体" style="flex:1"> B<input id="s-b" placeholder="空欄=ランダム6体" style="flex:1"></div>
      <div class="row">Lv<input id="s-lv" type="number" value="50"> 回数<input id="s-n" type="number" value="200"> 上限ターン<input id="s-turns" type="number" value="400">
        <label><input id="s-special" type="checkbox" checked> 特殊コダマも含める</label></div>
      <div class="row"><button class="b" data-act="runSim">実行</button><button class="b" data-act="runSpellTest">全スペル個別実行テスト</button><button class="b red" data-act="stopSim">停止</button></div>
      <div class="card mono" id="sim-out">${esc(simResult) || '<span class="dim">未実行</span>'}</div>`;
  }
  const out = t => { simResult = t; const el = $('#sim-out', box); if (el) el.textContent = t; };
  const tick = () => new Promise(r => setTimeout(r));
  async function runSim() {
    simStop = false;
    const lv = num('s-lv', 50), N = num('s-n', 200), maxT = num('s-turns', 400);
    const A = ids(val('s-a')), B = ids(val('s-b'));
    const pool = D.kodama.filter(k => $('#s-special', box).checked || !k.special);
    const rnd = () => Array.from({ length: 6 }, () => pool[Math.floor(Math.random() * pool.length)].id);
    let wins = [0, 0, 0], turns = 0, errs = [], stuck = 0, bad = 0;
    for (let i = 0; i < N && !simStop; i++) {
      const pa = (A.length ? A : rnd()).map(id => ({ id, lv, slv: GKP.slvFor(lv) }));
      const pb = (B.length ? B : rnd()).map(id => ({ id, lv, slv: GKP.slvFor(lv) }));
      const seed = (Math.random() * 2 ** 32) >>> 0;
      let st;
      try {
        st = GK.createBattle([{ name: 'A', party: pa }, { name: 'B', party: pb }], { seed });
        let n = 0;
        while (st.phase !== 'end' && n < maxT) {
          const acts = [0, 1].map(s => st.need[s] ? GK.chooseAI(st, s, 'hard') : null);
          for (let s = 0; s < 2; s++) if (acts[s] && !GK.isValid(st, s, acts[s])) throw new Error(`AIが不正な行動: side${s} ${JSON.stringify(acts[s])} phase=${st.phase}`);
          st = GK.resolve(st, acts); n++;
          const pr = checkInvariantsQuiet(st);
          if (pr.length) { bad++; errs.push({ seed, msg: '不整合: ' + pr[0], a: pa.map(p => p.id), b: pb.map(p => p.id) }); break; }
        }
        if (st.phase !== 'end') { stuck++; errs.push({ seed, msg: `${maxT}ターンで決着せず`, a: pa.map(p => p.id), b: pb.map(p => p.id) }); }
        else { wins[st.winner === -1 ? 2 : st.winner]++; turns += st.turn; }
      } catch (e) {
        errs.push({ seed, msg: e.message, stack: e.stack, a: pa.map(p => p.id), b: pb.map(p => p.id) });
      }
      if (i % 10 === 0) { out(`実行中… ${i + 1}/${N}　エラー${errs.length}`); await tick(); }
    }
    const done = wins[0] + wins[1] + wins[2];
    out(`完了 ${done}戦\nA勝ち ${wins[0]}（${pct(wins[0], done)}）　B勝ち ${wins[1]}（${pct(wins[1], done)}）　引分 ${wins[2]}\n平均ターン ${(turns / Math.max(1, done)).toFixed(1)}\n例外 ${errs.length - stuck - bad}　不整合 ${bad}　決着せず ${stuck}\n\n` +
      errs.slice(0, 15).map(e => `● ${e.msg}\n  seed=${e.seed} A=[${e.a}] B=[${e.b}]${e.stack ? '\n  ' + e.stack.split('\n').slice(1, 3).join('\n  ') : ''}`).join('\n'));
    for (const e of errs.slice(0, 15)) logError('sim', `${e.msg} (seed=${e.seed} A=[${e.a}] B=[${e.b}])`, e.stack);
  }
  const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '-';
  function checkInvariantsQuiet(st) {
    const saved = DBG.errors.length;
    const pr = checkInvariants(st);
    DBG.errors.length = saved; // シミュ中は個別に記録しない
    return pr;
  }
  // すべてのコダマのすべてのスペルを1回ずつ撃って、例外や不整合が出ないか確認
  async function runSpellTest() {
    simStop = false;
    const lv = num('s-lv', 50);
    let count = 0; const errs = [];
    const dummy = D.kodama.find(k => k.name === 'ちびれいむ').id;
    for (const k of D.kodama) {
      if (simStop) break;
      for (let i = 0; i < k.spells.length; i++) {
        const sp = k.spells[i];
        try {
          let st = GK.createBattle([{ name: 'A', party: [{ id: k.id, lv, spells: [i], slv: 5 }, { id: dummy, lv }] }, { name: 'B', party: [{ id: dummy, lv }, { id: k.id, lv }] }], { seed: 1234 + i });
          st.sides[0].party[0].vp = 999; st.sides[0].party[0].maxvp = 999;
          for (let t = 0; t < 3 && st.phase !== 'end'; t++) {
            const a0 = st.need[0] ? (st.phase === 'command' ? { type: 'spell', slot: 0 } : GK.chooseAI(st, 0, 'normal')) : null;
            const a1 = st.need[1] ? GK.chooseAI(st, 1, 'normal') : null;
            const act0 = a0 && GK.isValid(st, 0, a0) ? a0 : (st.need[0] ? GK.chooseAI(st, 0, 'normal') : null);
            st = GK.resolve(st, [act0, a1]);
            const pr = checkInvariantsQuiet(st).filter(p => !/VP範囲外/.test(p));
            if (pr.length) throw new Error(pr[0]);
          }
        } catch (e) { errs.push(`No.${k.id} ${k.name}【${sp.name}】: ${e.message}`); }
        count++;
      }
      if (k.id % 20 === 0) { out(`実行中… ${count}スペル　エラー${errs.length}`); await tick(); }
    }
    out(`全スペル個別テスト完了: ${count}スペル　エラー ${errs.length}\n` + errs.slice(0, 40).join('\n'));
    for (const e of errs.slice(0, 20)) logError('spelltest', e);
  }

  /* ---------- データ検査 ---------- */
  let inspectId = null;
  function tabData() {
    const unSpell = new Map(), unSkill = new Map(), noSprite = [];
    for (const k of D.kodama) {
      for (const s of k.spells) {
        const e = GK.parseSpellEffect(s.desc);
        const keys = Object.keys(e).filter(x => x !== 'priority' && x !== 'stats');
        if (s.desc !== '通常攻撃。' && !keys.length && !e.stats.length && !e.priority) unSpell.set(s.desc, k.name);
      }
      for (const s of k.skills) if (GK.parseSkill(s.desc).unknown) unSkill.set(s.desc, k.name);
      if (!(window.GK_SPRITES || {})[k.id]) noSprite.push(`${k.id}:${k.name}`);
    }
    let h = `<div class="card">コダマ ${D.kodama.length}体（特殊 ${D.kodama.filter(k => k.special).length}）　Vs ${GKP.VS_LIST.length}件　ストーリー ${GKS.AREAS.length}エリア</div>
      <h3>解析できないスペル効果 <span class="${unSpell.size ? 'ng' : 'ok'}">${unSpell.size}件</span></h3>
      <div class="card mono">${[...unSpell].map(([d, n]) => `${esc(n)}: ${esc(d)}`).join('\n') || 'なし'}</div>
      <h3>解析できないスキル <span class="${unSkill.size ? 'ng' : 'ok'}">${unSkill.size}件</span></h3>
      <div class="card mono">${[...unSkill].map(([d, n]) => `${esc(n)}: ${esc(d)}`).join('\n') || 'なし'}</div>
      <h3>立ち絵なし <span class="${noSprite.length ? 'ng' : 'ok'}">${noSprite.length}件</span></h3>
      <div class="card mono">${esc(noSprite.join(' ')) || 'なし'}</div>
      <h3>コダマ詳細（解析結果）</h3>
      <div class="row"><input id="i-id" placeholder="IDまたは名前" value="${inspectId || ''}"><button class="b" data-act="inspect">表示</button></div>`;
    if (inspectId && KD[inspectId]) {
      const k = KD[inspectId];
      h += `<div class="card mono">${esc(JSON.stringify({ id: k.id, name: k.name, types: k.types, hp: k.hp, atk: k.atk, df: k.df, spd: k.spd, total: k.total, special: !!k.special, line: GKP.LINE_OF[k.id], evolutions: GKP.evolutions(k.id) }, null, 1))}
Lv50: ${esc(JSON.stringify(GK.calcStats(k, 50)))}
Lv100: ${esc(JSON.stringify(GK.calcStats(k, 100)))}
スキル: ${k.skills.map(s => `${s.name} → ${JSON.stringify(GK.parseSkill(s.desc))}`).join('\n') || 'なし'}</div>
        <table><tr><th>#</th><th>スペル</th><th>属性/威力/消費/価格</th><th>解析</th></tr>${k.spells.map((s, i) => `<tr><td>${i}</td><td>${esc(s.name)}</td><td>${s.type}/${s.pow}/${s.cost}/${esc(s.price)}</td><td class="mono">${esc(JSON.stringify(GK.parseSpellEffect(s.desc)))}</td></tr>`).join('')}</table>`;
    }
    return h;
  }

  /* ---------- ログ ---------- */
  function tabLog() {
    return `<div class="row"><button class="b" data-act="copyErrors">全部コピー（バグ報告用）</button><button class="b" data-act="clearErrors">クリア</button></div>
      ${DBG.errors.length ? DBG.errors.slice().reverse().map(e => `<div class="card"><span class="ng">[${e.t}] ${esc(e.kind)}</span> ${esc(e.msg)}${e.stack ? `<div class="mono dim">${esc(e.stack)}</div>` : ''}</div>`).join('') : '<div class="card ok">エラーはありません</div>'}`;
  }

  /* ---------- 設定 ---------- */
  function tabOpt() {
    return `<div class="row">メッセージ速度（待ち時間の倍率） <input id="o-speed" type="number" step="0.05" value="${DBG.speed}"> <span class="dim">0.1=高速</span></div>
      <div class="row">AI自動操作の強さ <select id="o-ailv">${['easy', 'normal', 'hard'].map(l => `<option ${l === DBG.autoLevel ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button class="b" data-act="toggleAuto">AI自動操作: ${DBG.auto ? 'ON' : 'OFF'}</button></div>
      <button class="b" data-act="applyOpt">反映</button>
      <div class="card dim">セーブ保存先: <b>${esc(APP.PREFIX)}save</b>（通常版 gk_save とは別）<br>
        コンソールからは <code>GK</code>（エンジン）、<code>GKP</code>（進行）、<code>GKS</code>（ストーリー）、<code>GK_APP</code>、<code>GK_DEBUG</code> にアクセスできます。</div>`;
  }

  badge();
})();
