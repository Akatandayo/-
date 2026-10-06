/* 東方玉霊姫 対戦シミュレータ - 画面・ストーリー・ショップ・NPC戦・オンライン対戦 */
(function () {
  'use strict';

  const D = window.GK_DATA;
  const KD = GK.KODAMA;
  const VERSION = 2;
  const PEER_PREFIX = 'gyokureiki-v2-';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 崩属性は ❌ で表示
  const tb = (t, cls) => `<span class="tb t-${t} ${cls || ''}" title="${t}">${t === '崩' ? '❌' : t}</span>`;
  const tbs = types => types.map(t => tb(t)).join('');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const spriteOf = id => (window.GK_SPRITES && window.GK_SPRITES[id]) || null;
  const smooth = id => (KD[id] && KD[id].smooth ? ' smooth' : '');
  const icon = id => { const s = spriteOf(id); return s ? `<img class="kicon${smooth(id)}" src="${esc(s)}" alt="" loading="lazy">` : ''; };
  const yen = n => `${Number(n).toLocaleString('ja-JP')}銭`;

  /* ================= 保存 ================= */
  const PREFIX = window.GK_STORAGE_PREFIX || 'gk_';
  const store = {
    // デバッグ版は別のセーブ領域（GK_STORAGE_PREFIX）を使う
    get(k, d) { try { const v = localStorage.getItem(PREFIX + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* 保存不可でも続行 */ } },
    del(k) { try { localStorage.removeItem(PREFIX + k); } catch (e) { /* noop */ } },
  };
  let save = validateSave(store.get('save', null));
  let playerName = save ? save.name : store.get('name', '悠姫');
  function persist() { if (save) store.set('save', save); refreshMoney(); }

  function validateSave(s) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.owned)) return null;
    s.owned = s.owned.filter(m => m && KD[m.id]);
    if (!s.owned.length) return null;
    s.items = s.items || {}; s.contracts = s.contracts || []; s.cleared = s.cleared || {}; s.seen = s.seen || {};
    s.stats = s.stats || { win: 0, lose: 0 }; s.intro = s.intro || {}; s.gifts = s.gifts || {};
    s.money = Math.max(0, Math.floor(+s.money || 0));
    s.party = (s.party || []).filter(uid => s.owned.some(m => m.uid === uid)).slice(0, GK.MAX_PARTY);
    if (!s.party.length) s.party = [s.owned[0].uid];
    s.nextUid = Math.max(s.nextUid || 1, ...s.owned.map(m => m.uid + 1));
    const RENAMED = { '名前のない怪物': '呪いの片鱗', '★名前のない怪物': '★呪いの片鱗', 'DESTRUCTION 3,2,1': 'Möbius', '★DESTRUCTION 3,2,1': '★Möbius' };
    for (const m of s.owned) {
      m.learned = (m.learned || []).map(n => RENAMED[n] || n);
      m.equip = (m.equip || []).map(n => RENAMED[n] || n);
      const names = new Set(KD[m.id].spells.map(sp => sp.name));
      m.learned = (m.learned || []).filter(n => names.has(n));
      if (!m.learned.length) m.learned = GKP.basicSpells(KD[m.id]);
      m.equip = (m.equip || []).filter(n => m.learned.includes(n)).slice(0, 4);
      if (!m.equip.length) m.equip = m.learned.slice(0, 4);
      m.lv = Math.max(1, Math.min(100, Math.floor(+m.lv || 1)));
      m.exp = Math.max(0, Math.floor(+m.exp || 0));
    }
    return s;
  }
  const myMembers = () => GKP.partyMembers(save);
  const myBuilds = forceLv => myMembers().map(m => GKP.toBuild(m, forceLv));
  const itemCount = k => save.items[k] || 0;

  function refreshMoney() {
    const t = save ? yen(save.money) : '';
    $$('.money').forEach(el => { el.textContent = t; });
  }

  /* ================= 画面遷移 ================= */
  function go(name) {
    if (!save && !['title', 'start', 'zukan'].includes(name)) name = 'title';
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + name));
    window.scrollTo(0, 0);
    refreshMoney();
    const r = { gift: renderGift, vs: renderVs, title: renderTitle, start: renderStart, story: renderStory, party: renderParty, zukan: renderZukan, shop: renderShop, items: renderItems, save: renderSaveMgr, npc: renderNpc, online: () => renderOnline() }[name];
    if (r) r();
  }
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]');
    if (g) go(g.dataset.go);
  });

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
  }
  let modalDone = null;
  function modal(html, onClose) {
    $('#modal-content').innerHTML = html; $('#modal').classList.add('open');
    modalDone = onClose || null;
  }
  function closeModal() {
    $('#modal').classList.remove('open');
    const f = modalDone; modalDone = null;
    if (f) f();
  }
  const modalP = html => new Promise(res => modal(html, res));
  $('#modal-close').onclick = closeModal;
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

  function miniParty(list) {
    return list.map(b => { const k = KD[b.id]; return k ? `<span class="chip">${icon(k.id)}${tbs(k.types)}${esc(k.name)} Lv${b.lv}</span>` : ''; }).join('');
  }

  /* ================= タイトル ================= */
  function renderTitle() {
    $('#title-new').hidden = !!save;
    $('#title-menu').hidden = !save;
    $('#t-name').textContent = save ? save.name : '東方玉霊姫';
    $('#in-name').value = playerName;
    if (save) {
      const cleared = GKS.progressArea(save);
      const next = cleared < GKS.AREAS.length ? `次の目的地：${GKS.AREAS[cleared].name}` : '全エリアクリア！';
      $('#title-status').innerHTML = `<div>契約コダマ <b>${save.owned.length}</b> / ${D.kodama.length}　　${esc(next)}</div>
        <div class="mini-party">${miniParty(myMembers().map(m => ({ id: m.id, lv: m.lv })))}</div>`;
    }
  }
  $('#btn-newgame').onclick = () => {
    playerName = $('#in-name').value.trim().slice(0, 12) || '悠姫';
    store.set('name', playerName);
    go('start');
  };

  /* ================= 最初のコダマ選択 ================= */
  $('#start-type').innerHTML += GK.TYPES.map(t => `<option>${t}</option>`).join('');
  $('#start-type').onchange = renderStart;
  function renderStart() {
    const t = $('#start-type').value;
    const list = GKP.CHIBI_IDS.map(id => KD[id]).filter(k => !t || k.types.includes(t));
    $('#start-grid').innerHTML = list.map(k => `<button class="start-cell" data-id="${k.id}">
      <span class="tbrow">${tbs(k.types)}</span>${icon(k.id)}<span class="nm">${esc(k.name)}</span></button>`).join('');
  }
  $('#start-grid').addEventListener('click', e => {
    const c = e.target.closest('.start-cell'); if (!c) return;
    const k = KD[c.dataset.id];
    modal(`${kodamaDetail(k, 5)}<button class="btn big" id="start-ok">${esc(k.name)}と契約する！</button>`);
    $('#start-ok').onclick = () => {
      save = GKP.newSave(playerName, k.id);
      persist();
      closeModal();
      toast(`${k.name}と契約した！`);
      go('story');
    };
  });

  /* ================= コダマ一覧（共通） ================= */
  const SORTS = { no: 'No.順', total: '合計', hp: 'ＨＰ', atk: '攻撃', df: '防御', spd: '速度' };
  function filterUI(root, onChange, extra) {
    root.innerHTML = `
      <input type="search" placeholder="名前で検索" data-f="q">
      <select data-f="type"><option value="">全属性</option>${GK.TYPES.map(t => `<option>${t}</option>`).join('')}</select>
      <select data-f="sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}${extra || ''}</select>`;
    const st = { q: '', type: '', sort: 'no' };
    root.addEventListener('input', e => { const f = e.target.dataset.f; if (f) { st[f] = e.target.value; onChange(st); } });
    return st;
  }
  function filterKodama(list, st, key) {
    key = key || (x => x);
    const q = st.q.trim();
    let out = list.filter(x => { const k = key(x); return (!q || k.name.includes(q) || String(k.id) === q) && (!st.type || k.types.includes(st.type)); });
    if (st.sort === 'lv') out = out.slice().sort((a, b) => b.lv - a.lv);
    else if (st.sort !== 'no') out = out.slice().sort((a, b) => key(b)[st.sort] - key(a)[st.sort] || key(a).id - key(b).id);
    else out = out.slice().sort((a, b) => key(a).id - key(b).id);
    return out;
  }
  function krow(k, extra, right) {
    return `<div class="krow ${extra || ''}" data-id="${k.id}">
      <span class="no">${icon(k.id)}No.${k.id}</span>
      <span class="nm">${tbs(k.types)}${esc(k.name)}</span>
      <span class="st">${right || `H<b>${k.hp}</b> 攻<b>${k.atk}</b> 防<b>${k.df}</b> 速<b>${k.spd}</b><br>合計 <b>${k.total}</b>`}</span>
    </div>`;
  }
  function spellLine(s) {
    const pow = parseInt(s.pow) ? `威力${s.pow}` : '威力―';
    return `${tb(s.type)} <span>${esc(s.name)}</span> <span class="pw">${pow}／消費${s.cost}</span>`;
  }
  function kodamaDetail(k, lv) {
    lv = lv || 50;
    const st = GK.calcStats(k, lv);
    const evo = GKP.evolutions(k.id);
    return `<div class="ed-head">${icon(k.id)}${tbs(k.types)}<span class="nm">${esc(k.name)}</span><span class="small">No.${k.id}</span>${k.special ? '<span class="orig">オリジナル</span>' : ''}</div>
      ${k.profile ? `<div class="profile">${esc(k.profile)}${k.special && k.vs ? `<br><span class="small">入手：「Ｖｓ」モード（${esc(k.vs.title)}${k.vs.raid ? '・レイド限定' : ''}）で勝利すると一定確率で契約書を落とす（Lv${GKP.VS_JOIN_LV}で加入）</span>` : ''}</div>` : ''}
      <div class="statgrid" style="margin-top:8px">
        <div>ＨＰ<b>${k.hp}</b></div><div>攻撃<b>${k.atk}</b></div><div>防御<b>${k.df}</b></div><div>速度<b>${k.spd}</b></div><div>合計<b>${k.total}</b></div>
      </div>
      <div class="small" style="margin-top:4px">Lv${lv}時：ＨＰ${st.maxhp} ＶＰ${st.maxvp} 攻撃${st.atk} 防御${st.df} 速度${st.spd}</div>
      ${k.skills.length ? k.skills.map(s => `<div class="skillbox">スキル【${esc(s.name)}】<br>${esc(s.desc)}</div>`).join('') : '<div class="skillbox">スキルなし</div>'}
      ${evo.length ? `<div class="small">${GKP.isBase(k) ? `進化先（Lv${GKP.EVOLVE_LV}〜）` : '同系統'}：${evo.map(id => esc(KD[id].name)).join('、')}</div>` : ''}
      <div class="spell-list">${k.spells.map(s => { const r = GKP.spellReq(s); return `<div class="spell-row" style="cursor:default"><span></span>${spellLine(s)}<span class="desc">${esc(s.desc)}<br>習得：${r.book ? '禁呪の書' : yen(r.money)}・Lv${r.lv}〜</span></div>`; }).join('')}</div>`;
  }

  /* ================= 図鑑 ================= */
  let zukanState;
  function renderZukan() {
    if (!zukanState) zukanState = filterUI($('#zukan-filters'), drawZukan);
    drawZukan(zukanState);
  }
  function drawZukan(st) {
    const list = filterKodama(D.kodama, st);
    const owned = save ? new Set(save.owned.map(m => m.id)) : new Set();
    $('#zukan-count').textContent = save ? `契約 ${owned.size}/${D.kodama.length}` : `${list.length}体`;
    $('#zukan-list').innerHTML = list.map(k => krow(k, owned.has(k.id) ? 'inparty' : '')).join('');
  }
  $('#zukan-list').addEventListener('click', e => {
    const r = e.target.closest('.krow');
    if (r) modal(kodamaDetail(KD[r.dataset.id], 50));
  });

  /* ================= 会話 ================= */
  let talkResolve = null, talkSkip = false;
  async function talk(lines, place) {
    if (!lines || !lines.length) return;
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-talk'));
    $('#talk-place').textContent = place || '';
    talkSkip = false;
    for (const [who0, text] of lines) {
      if (talkSkip) break;
      const who = who0 === '@' ? save.name : who0;
      const sid = who0 && who0 !== '@' ? GKS.charSprite(who0) : null;
      $('#talk-sprite').innerHTML = sid && spriteOf(sid) ? `<img class="${smooth(sid)}" src="${esc(spriteOf(sid))}" alt="">` : '';
      $('#talk-name').textContent = who || '';
      $('#talk-name').hidden = !who;
      $('#talk-text').textContent = text.replace(/悠姫/g, save.name);
      await new Promise(res => { talkResolve = res; });
    }
  }
  $('#talk-box').addEventListener('click', () => { if (talkResolve) { const r = talkResolve; talkResolve = null; r(); } });
  $('#talk-stage').addEventListener('click', () => { if (talkResolve) { const r = talkResolve; talkResolve = null; r(); } });
  $('#talk-skip').onclick = () => { talkSkip = true; if (talkResolve) { const r = talkResolve; talkResolve = null; r(); } };

  /* ================= ストーリー ================= */
  const openAreas = {};
  function renderStory() {
    const cleared = GKS.progressArea(save);
    let h = '';
    GKS.AREAS.forEach((A, a) => {
      const unlocked = GKS.isUnlocked(save, a, 0);
      const done = GKS.areaCleared(save, a);
      const isOpen = openAreas[a] != null ? openAreas[a] : (a === Math.min(cleared, GKS.AREAS.length - 1));
      h += `<div class="panel area ${unlocked ? '' : 'locked'}">
        <button class="area-head" data-area="${a}" ${unlocked ? '' : 'disabled'}>
          <span>${unlocked ? '' : '🔒 '}エリア${a + 1}　${esc(A.name)}</span>
          <span class="small">Lv${A.lv[0]}〜${A.lv[1]} ${done ? '<span class="clear">CLEAR</span>' : ''}</span>
        </button>`;
      if (unlocked && isOpen) {
        h += '<div class="stages">';
        for (let j = 0; j < GKS.STAGES_PER_AREA; j++) {
          const st = GKS.stage(a, j);
          const ok = GKS.isUnlocked(save, a, j);
          const c = !!save.cleared[st.key];
          const sp = spriteOf(st.party[0].id);
          h += `<button class="stage-btn ${c ? 'cleared' : ''} ${st.isBoss ? 'boss' : ''}" data-stage="${a}-${j}" ${ok ? '' : 'disabled'}>
            ${sp && ok ? `<img class="kicon" src="${esc(sp)}" alt="">` : '<span class="kicon"></span>'}
            <span class="stage-t">${st.isBoss ? 'ＢＯＳＳ' : `ステージ${j + 1}`}<br><span class="small">${ok ? esc(st.trainer) + `（${st.party.length}体・Lv${Math.min(...st.party.map(p => p.lv))}〜）` : '？？？'}</span></span>
            <span class="stage-r">${c ? '★' : ok ? '挑戦' : '🔒'}</span>
          </button>`;
        }
        h += '</div>';
      }
      h += '</div>';
    });
    $('#story-areas').innerHTML = h;
  }
  $('#story-areas').addEventListener('click', e => {
    const ah = e.target.closest('[data-area]');
    if (ah) { const a = +ah.dataset.area; const el = ah.parentElement.querySelector('.stages'); openAreas[a] = !el; renderStory(); return; }
    const sb = e.target.closest('[data-stage]');
    if (sb && !sb.disabled) { const [a, j] = sb.dataset.stage.split('-').map(Number); playStage(a, j); }
  });

  async function playStage(a, j) {
    if (!myMembers().length) return toast('パーティにコダマがいません');
    const st = GKS.stage(a, j);
    if (j === 0 && !save.intro[a]) {
      await talk(st.area.intro, st.area.name);
      save.intro[a] = 1; persist();
    }
    await talk(st.pre, st.title);
    current = new LocalSession({
      kind: 'story', stage: st, level: st.ai,
      foe: { name: st.trainer, party: st.party },
    });
    current.start();
  }

  /* ================= 戦闘後の報酬 ================= */
  async function awardBattle(state, ctx) {
    const win = state.winner === 0;
    const me = state.sides[0], foe = state.sides[1];
    const lines = [];
    const res = { win, money: 0, exp: [], items: {}, contracts: [], unlockedEvo: [] };
    // 経験値
    let mult = ctx.expMult || 1;
    if (!win) mult *= 0.5;
    let total = 0;
    for (const f of foe.party) if (f.hp <= 0) total += GKP.expFrom(KD[f.id], f.lv);
    total = Math.floor(total * mult);
    ctx.uids.forEach((uid, i) => {
      const m = GKP.findOwned(save, uid);
      if (!m) return;
      const b = me.party[i];
      const share = b && b.appeared ? 1 : 0.5;
      const gain = Math.floor(total * share);
      const beforeLv = m.lv;
      const ups = GKP.gainExp(m, gain);
      res.exp.push({ m, gain, ups, beforeLv });
      if (ups && GKP.isBase(KD[m.id]) && beforeLv < GKP.EVOLVE_LV && m.lv >= GKP.EVOLVE_LV && GKP.evolutions(m.id).length) res.unlockedEvo.push(m);
    });
    if (win) {
      save.stats.win++;
      res.money = ctx.money || 0;
      if (ctx.firstClear) {
        for (const [k, n] of Object.entries(ctx.firstClear.items || {})) res.items[k] = (res.items[k] || 0) + n;
        for (const c of ctx.firstClear.contracts || []) res.contracts.push(c);
      }
      // 特別なコダマ（ボス周回のみ）
      const sd = ctx.specialDrop;
      if (sd && !GKP.ownsLine(save, sd.id) && !save.contracts.some(c => GKP.sameLine(c.id, sd.id)) && Math.random() < sd.rate) {
        res.contracts.push({ id: sd.id, lv: sd.lv, special: true });
      }
      // 契約書ドロップ（倒したコダマから）
      if (ctx.dropRate && Math.random() < ctx.dropRate) {
        const cands = foe.party.map(f => f.id).filter(id => !GKP.owns(save, id) && !save.contracts.some(c => c.id === id));
        if (cands.length) {
          const id = cands[Math.floor(Math.random() * cands.length)];
          const f = foe.party.find(x => x.id === id);
          res.contracts.push({ id, lv: Math.max(5, f.lv - 5), drop: true });
        }
      }
    } else save.stats.lose++;
    save.money += res.money;
    for (const [k, n] of Object.entries(res.items)) save.items[k] = (save.items[k] || 0) + n;
    for (const c of res.contracts) save.contracts.push({ id: c.id, lv: c.lv });
    persist();

    // 表示
    lines.push(`<div class="res-head ${win ? 'win' : 'lose'}">${win ? '勝利！' : '敗北…'}</div>`);
    if (res.money) lines.push(`<div>獲得：<b>${yen(res.money)}</b>（所持 ${yen(save.money)}）</div>`);
    lines.push('<div class="res-exp">' + res.exp.map(x => `<div class="res-row">${icon(x.m.id)}<span>${esc(KD[x.m.id].name)}</span>
      <span class="small">+${x.gain}EXP</span><span>${x.ups ? `<b class="lvup">Lv${x.beforeLv}→${x.m.lv}！</b>` : `Lv${x.m.lv}`}</span></div>`).join('') + '</div>');
    for (const m of res.unlockedEvo) lines.push(`<div class="res-note">✨ ${esc(KD[m.id].name)}が進化できるようになった！（パーティ画面から）</div>`);
    const itemName = { chibi: 'ちび契約書', random: '玉霊契約書', book: '禁呪の書', scroll: '修行の書' };
    for (const [k, n] of Object.entries(res.items)) lines.push(`<div class="res-note">🎁 ${itemName[k]} ×${n} を手に入れた！</div>`);
    for (const c of res.contracts) lines.push(c.special ? `<div class="res-note special">${icon(c.id)}<div>⚡ ${esc((KD[c.id].vs && KD[c.id].vs.who) || KD[c.id].name)}が契約書を落とした……！<br><b>${esc(KD[c.id].name)}の契約書</b>を手に入れた！<br><span class="small">「持ち物」から使うと契約できます。</span></div></div>` : `<div class="res-note">📜 ${c.drop ? `${esc(KD[c.id].name)}が契約書を落とした！` : `${esc(KD[c.id].name)}の契約書を手に入れた！`}<br><span class="small">「持ち物」から使うと契約できます。</span></div>`);
    if (!win) lines.push('<div class="small">パーティを鍛えたり、属性相性を見直して再挑戦しよう。</div>');
    await modalP(`<div class="result-modal">${lines.join('')}</div>`);
    return res;
  }

  /* ================= パーティ編成（契約中コダマ） ================= */
  let selSlot = 0, boxFilter;
  function renderParty() {
    if (!boxFilter) boxFilter = filterUI($('#party-filters'), drawBox, '<option value="lv">レベル</option>');
    const mem = myMembers();
    if (selSlot > mem.length) selSlot = mem.length;
    $('#party-count').textContent = `${mem.length}/${GK.MAX_PARTY}`;
    const slots = [];
    for (let i = 0; i < GK.MAX_PARTY; i++) {
      const m = mem[i];
      if (m) {
        const k = KD[m.id];
        slots.push(`<button class="pslot ${i === selSlot ? 'sel' : ''}" data-slot="${i}"><span class="no">${i === 0 ? '先頭' : i + 1}</span>${icon(k.id)}${tbs(k.types)}<span class="nm">${esc(k.name)}</span>Lv${m.lv}</button>`);
      } else {
        slots.push(`<button class="pslot empty ${i === selSlot ? 'sel' : ''}" data-slot="${i}">＋ 空き</button>`);
      }
    }
    $('#party-slots').innerHTML = slots.join('');
    renderEditor();
    drawBox(boxFilter);
  }
  function drawBox(st) {
    const inParty = new Set(save.party);
    const list = filterKodama(save.owned, st, m => KD[m.id]);
    $('#box-count').textContent = `${save.owned.length}体`;
    $('#party-list').innerHTML = list.map(m => {
      const k = KD[m.id];
      return krow(k, inParty.has(m.uid) ? 'inparty' : '', `<b>Lv${m.lv}</b>${inParty.has(m.uid) ? '<br>パーティ' : ''}`).replace(`data-id="${k.id}"`, `data-uid="${m.uid}"`);
    }).join('');
  }
  function renderEditor() {
    const m = myMembers()[selSlot];
    const ed = $('#slot-editor');
    if (!m) { ed.innerHTML = '<p class="small">下の一覧から、この枠に入れるコダマを選んでください。</p>'; return; }
    const k = KD[m.id];
    const st = GK.calcStats(k, m.lv);
    const next = GKP.expToNext(m.lv);
    const slv = GKP.slvFor(m.lv);
    const evo = GKP.evolutions(m.id);
    const canEvo = evo.length && (!GKP.isBase(k) || m.lv >= GKP.EVOLVE_LV);
    ed.innerHTML = `
      <div class="ed-head">${icon(k.id)}${tbs(k.types)}<span class="nm">${esc(k.name)}</span><span class="small">No.${k.id}</span>
        <button class="btn sm" data-ed="info" style="margin-left:auto">詳細</button></div>
      <div class="ed-controls">
        <b>Lv${m.lv}</b>
        <div class="expbar"><i style="width:${m.lv >= 100 ? 100 : Math.floor(m.exp / next * 100)}%"></i></div>
        <span class="small">${m.lv >= 100 ? 'MAX' : `次まで ${next - m.exp}EXP`}</span>
      </div>
      <div class="ed-controls">
        <button class="btn sm" data-ed="up">◀ 前へ</button><button class="btn sm" data-ed="down">後へ ▶</button>
        <button class="btn sm danger" data-ed="remove">外す</button>
        ${evo.length ? `<button class="btn sm evo" data-ed="evolve" ${canEvo ? '' : 'disabled'}>${GKP.isBase(k) ? (canEvo ? '進化する！' : `進化（Lv${GKP.EVOLVE_LV}〜）`) : '別の姿に変える'}</button>` : ''}
      </div>
      <div class="statgrid">
        <div>ＨＰ<b>${st.maxhp}</b></div><div>ＶＰ<b>${st.maxvp}</b></div><div>攻撃<b>${st.atk}</b></div><div>防御<b>${st.df}</b></div><div>速度<b>${st.spd}</b></div>
      </div>
      ${k.skills.length ? `<div class="skillbox">スキル【${esc(k.skills[0].name)}】 SLv${slv}<span class="small">（Lvで上昇）</span><br>${esc(k.skills[0].desc)}</div>` : ''}
      <div class="small">装備スペル（最大${GK.MAX_SPELLS}つ：${m.equip.length}/${GK.MAX_SPELLS}）　未習得のスペルは「ショップ」で習得できます</div>
      <div class="spell-list">${k.spells.map(s => {
        const learned = m.learned.includes(s.name);
        const on = m.equip.includes(s.name);
        const r = GKP.spellReq(s);
        return `<label class="spell-row ${on ? 'on' : ''} ${learned ? '' : 'unlearned'}">
          <input type="checkbox" data-sp="${esc(s.name)}" ${on ? 'checked' : ''} ${learned ? '' : 'disabled'}>${spellLine(s)}
          <span class="desc">${esc(s.desc)}${learned ? '' : `<br>🔒 未習得（${r.book ? '禁呪の書' : yen(r.money)}・Lv${r.lv}〜）`}</span>
        </label>`;
      }).join('')}</div>`;
  }
  $('#party-slots').addEventListener('click', e => {
    const s = e.target.closest('[data-slot]');
    if (!s) return;
    selSlot = Math.min(+s.dataset.slot, save.party.length);
    renderParty();
  });
  $('#party-list').addEventListener('click', e => {
    const r = e.target.closest('.krow');
    if (!r) return;
    const uid = +r.dataset.uid;
    const at = save.party.indexOf(uid);
    if (at >= 0) {
      if (at === selSlot) return;
      if (selSlot < save.party.length) [save.party[at], save.party[selSlot]] = [save.party[selSlot], save.party[at]];
      else { selSlot = at; renderParty(); return; }
    } else if (selSlot < save.party.length) save.party[selSlot] = uid;
    else if (save.party.length < GK.MAX_PARTY) { save.party.push(uid); selSlot = save.party.length - 1; }
    else return toast('パーティがいっぱいです');
    persist(); renderParty();
    toast(`${KD[GKP.findOwned(save, uid).id].name}をパーティに入れた！`);
    $('#scr-party .panel').scrollIntoView({ behavior: 'smooth' });
  });
  $('#slot-editor').addEventListener('change', e => {
    const m = myMembers()[selSlot]; if (!m) return;
    const t = e.target;
    if (t.dataset.sp != null) {
      const n = t.dataset.sp;
      if (t.checked) {
        if (m.equip.length >= GK.MAX_SPELLS) { t.checked = false; return toast(`スペルは${GK.MAX_SPELLS}つまでです`); }
        m.equip.push(n);
      } else {
        if (m.equip.length <= 1) { t.checked = true; return toast('スペルは１つ以上必要です'); }
        m.equip = m.equip.filter(x => x !== n);
      }
    }
    persist(); renderParty();
  });
  $('#slot-editor').addEventListener('click', e => {
    const a = e.target.closest('[data-ed]'); if (!a || a.tagName !== 'BUTTON') return;
    const m = myMembers()[selSlot]; if (!m) return;
    const act = a.dataset.ed;
    if (act === 'info') return modal(kodamaDetail(KD[m.id], m.lv));
    if (act === 'evolve') return evolveMenu(m);
    if (act === 'remove') {
      if (save.party.length <= 1) return toast('パーティには１体以上必要です');
      save.party.splice(selSlot, 1); selSlot = Math.min(selSlot, save.party.length - 1);
    }
    if (act === 'up' && selSlot > 0) { [save.party[selSlot - 1], save.party[selSlot]] = [save.party[selSlot], save.party[selSlot - 1]]; selSlot--; }
    if (act === 'down' && selSlot < save.party.length - 1) { [save.party[selSlot + 1], save.party[selSlot]] = [save.party[selSlot], save.party[selSlot + 1]]; selSlot++; }
    persist(); renderParty();
  });
  function evolveMenu(m) {
    const evo = GKP.evolutions(m.id);
    modal(`<div class="picker-head">${esc(KD[m.id].name)}の${GKP.isBase(KD[m.id]) ? '進化先' : '別の姿'}を選んでください</div>
      <p class="small">Lv・覚えたスペルは引き継がれます（新しい姿に無いスペルは外れます）。</p>
      <div class="klist">${evo.map(id => krow(KD[id], 'evo-pick')).join('')}</div>`);
    $$('.evo-pick', $('#modal')).forEach(r => r.onclick = () => {
      const to = +r.dataset.id;
      const before = KD[m.id].name;
      if (GKP.evolve(save, m, to)) {
        persist(); closeModal(); renderParty();
        modal(`<div class="evo-show">${icon(to)}<div>${esc(before)}は<br><b>${esc(KD[to].name)}</b>に${GKP.isBase(KD[GKP.LINE_OF[to]] || KD[to]) ? '進化した！' : 'なった！'}</div></div>`);
      }
    });
  }

  /* ================= ショップ ================= */
  const ITEM_NAME = { chibi: 'ちび契約書', random: '玉霊契約書', book: '禁呪の書', scroll: '修行の書' };
  let shopUid = null;
  function renderShop() {
    const prog = GKS.progressArea(save);
    $('#shop-items').innerHTML = GKP.SHOP.map(it => {
      const locked = prog < it.unlock;
      return `<div class="shop-row ${locked ? 'locked' : ''}">
        <div><b>${it.name}</b> <span class="small">（所持 ${itemCount(it.key)}）</span><div class="small">${locked ? `🔒 エリア${it.unlock}クリアで入荷` : esc(it.desc)}</div></div>
        <div class="shop-buy"><span>${yen(it.price)}</span><button class="btn sm" data-buy="${it.key}" ${locked || save.money < it.price ? 'disabled' : ''}>買う</button></div>
      </div>`;
    }).join('');
    const sel = $('#shop-kodama');
    if (!save.owned.some(m => m.uid === shopUid)) shopUid = save.party[0];
    sel.innerHTML = save.owned.slice().sort((a, b) => b.lv - a.lv).map(m => `<option value="${m.uid}" ${m.uid === shopUid ? 'selected' : ''}>${esc(KD[m.id].name)} Lv${m.lv}</option>`).join('');
    renderShopSpells();
  }
  function renderShopSpells() {
    const m = GKP.findOwned(save, shopUid);
    if (!m) return;
    const k = KD[m.id];
    const rows = k.spells.filter(s => !m.learned.includes(s.name));
    $('#shop-spells').innerHTML = rows.length ? rows.map(s => {
      const r = GKP.spellReq(s);
      const okLv = m.lv >= r.lv, okMoney = save.money >= r.money, okBook = !r.book || itemCount('book') > 0;
      return `<div class="spell-row" style="cursor:default"><span></span>${spellLine(s)}
        <span class="desc">${esc(s.desc)}<br><span class="${okLv ? '' : 'ng'}">Lv${r.lv}〜</span>　${r.book ? `<span class="${okBook ? '' : 'ng'}">禁呪の書×1</span>` : `<span class="${okMoney ? '' : 'ng'}">${yen(r.money)}</span>`}
        <button class="btn sm" data-learn="${esc(s.name)}" ${okLv && okMoney && okBook ? '' : 'disabled'} style="float:right">習得</button></span></div>`;
    }).join('') : '<p class="small">このコダマのスペルはすべて習得済みです。</p>';
  }
  $('#shop-kodama').onchange = e => { shopUid = +e.target.value; renderShopSpells(); };
  $('#shop-items').addEventListener('click', e => {
    const b = e.target.closest('[data-buy]'); if (!b || b.disabled) return;
    const it = GKP.SHOP.find(x => x.key === b.dataset.buy);
    if (save.money < it.price) return toast('銭が足りません');
    save.money -= it.price;
    save.items[it.key] = itemCount(it.key) + 1;
    persist(); renderShop();
    toast(`${it.name}を買った！（持ち物から使えます）`);
  });
  $('#shop-spells').addEventListener('click', e => {
    const b = e.target.closest('[data-learn]'); if (!b || b.disabled) return;
    const m = GKP.findOwned(save, shopUid);
    const sp = KD[m.id].spells.find(s => s.name === b.dataset.learn);
    const r = GKP.spellReq(sp);
    if (m.lv < r.lv) return;
    if (r.book) { if (itemCount('book') < 1) return; save.items.book--; } else { if (save.money < r.money) return; save.money -= r.money; }
    m.learned.push(sp.name);
    if (m.equip.length < GK.MAX_SPELLS) m.equip.push(sp.name);
    persist(); renderShop();
    toast(`${KD[m.id].name}は【${sp.name}】を習得した！`);
  });

  /* ================= 持ち物 ================= */
  function renderItems() {
    let h = '';
    const desc = { chibi: 'まだ契約していないちびコダマと契約できる。', random: 'まだ契約していないコダマと契約できる。', book: '禁呪スペルの習得に使う（ショップのスペル習得から）。', scroll: '選んだコダマが次のレベルまでの経験値を得る。' };
    for (const key of ['chibi', 'random', 'scroll', 'book']) {
      const n = itemCount(key);
      if (!n) continue;
      h += `<div class="shop-row"><div><b>${ITEM_NAME[key]}</b> ×${n}<div class="small">${desc[key]}</div></div>
        ${key === 'book' ? '' : `<div class="shop-buy"><button class="btn sm" data-use="${key}">使う</button></div>`}</div>`;
    }
    save.contracts.forEach((c, i) => {
      const k = KD[c.id];
      h += `<div class="shop-row"><div class="contract">${icon(k.id)}<div><b>${esc(k.name)}の契約書</b>${tbs(k.types)}<div class="small">使うとLv${c.lv}で契約${GKP.owns(save, c.id) ? '（契約済みのため3,000銭に換金）' : ''}</div></div></div>
        <div class="shop-buy"><button class="btn sm" data-contract="${i}">使う</button></div></div>`;
    });
    $('#items-list').innerHTML = h || '<p class="small">持ち物はありません。ストーリーやショップで手に入ります。</p>';
  }
  function showJoin(m) {
    const k = KD[m.id];
    return modalP(`<div class="evo-show">${icon(k.id)}<div><b>${esc(k.name)}</b>（Lv${m.lv}）と契約した！${save.party.includes(m.uid) ? '<br><span class="small">パーティに加わりました。</span>' : '<br><span class="small">パーティ画面で編成できます。</span>'}</div></div>${kodamaDetail(k, m.lv)}`);
  }
  $('#items-list').addEventListener('click', async e => {
    const u = e.target.closest('[data-use]');
    const c = e.target.closest('[data-contract]');
    if (u) {
      const key = u.dataset.use;
      if (itemCount(key) < 1) return;
      if (key === 'scroll') return scrollMenu();
      const pool = key === 'chibi' ? GKP.CHIBI_IDS : GKP.NORMAL_IDS;
      const id = GKP.randomUnowned(save, pool);
      if (id == null) return toast('契約できるコダマがもういません！');
      save.items[key]--;
      const m = GKP.addKodama(save, id, key === 'chibi' ? 5 : 20);
      persist(); renderItems();
      await showJoin(m);
    } else if (c) {
      const r = GKP.useContract(save, +c.dataset.contract);
      persist(); renderItems();
      if (!r) return;
      if (r.dup) toast(`契約済みのため${yen(r.refund)}に換金した`);
      else await showJoin(r.m);
    }
  });
  function scrollMenu() {
    modal(`<div class="picker-head">修行の書を使うコダマを選んでください</div><div class="klist">${save.owned.filter(m => m.lv < 100).sort((a, b) => b.lv - a.lv).map(m => krow(KD[m.id], 'scroll-pick', `<b>Lv${m.lv}</b>`).replace(`data-id="${m.id}"`, `data-uid="${m.uid}"`)).join('')}</div>`);
    $$('.scroll-pick', $('#modal')).forEach(r => r.onclick = () => {
      const m = GKP.findOwned(save, +r.dataset.uid);
      if (!m || itemCount('scroll') < 1) return;
      save.items.scroll--;
      GKP.gainExp(m, GKP.expToNext(m.lv) - m.exp);
      persist(); closeModal(); renderItems();
      toast(`${KD[m.id].name}はLv${m.lv}になった！`);
    });
  }

  /* ================= ギフトコード ================= */
  function renderGift() {
    const hist = Object.values(save.gifts || {});
    $('#gift-history').innerHTML = hist.length
      ? hist.slice().reverse().map(g => `<div class="shop-row"><div>🎁 <b>${esc(g.title || 'ギフト')}</b></div><span class="small">${esc(g.t)}</span></div>`).join('')
      : '<p class="small">まだありません。</p>';
  }
  async function redeemGift() {
    const code = $('#gift-code').value;
    const r = GKG.redeem(save, code);
    if (!r.ok) return toast(r.reason);
    persist();
    $('#gift-code').value = '';
    renderGift();
    const g = r.got, lines = [];
    if (g.money) lines.push(`<div class="res-note">💰 ${yen(g.money)}</div>`);
    for (const [k, n] of Object.entries(g.items)) lines.push(`<div class="res-note">🎁 ${ITEM_NAME[k] || k} ×${n}</div>`);
    for (const c of g.contracts) lines.push(`<div class="res-note special">${icon(c.id)}<div>📜 <b>${esc(KD[c.id].name)}の契約書</b>（Lv${c.lv || 20}）<br><span class="small">「持ち物」から使うと契約できます。</span></div></div>`);
    for (const m of g.kodama) lines.push(`<div class="res-note special">${icon(m.id)}<div>✨ <b>${esc(KD[m.id].name)}</b>（Lv${m.lv}）が仲間になった！</div></div>`);
    if (g.refund) lines.push(`<div class="res-note">契約済みのコダマは ${yen(g.refund)} に換金しました</div>`);
    await modalP(`<div class="result-modal"><div class="res-head win" style="font-size:22px">🎁 ${esc(r.gift.title || 'ギフト')}</div>${lines.join('') || '<div class="small">（報酬なし）</div>'}</div>`);
  }
  $('#gift-ok').onclick = redeemGift;
  $('#gift-code').addEventListener('keydown', e => { if (e.key === 'Enter') redeemGift(); });

  /* ================= セーブ管理 ================= */
  function renderSaveMgr() {
    $('#save-name').value = save.name;
    const cl = Object.keys(save.cleared).length;
    $('#save-stats').innerHTML = `契約コダマ：${save.owned.length}体　クリアステージ：${cl}/${GKS.AREAS.length * GKS.STAGES_PER_AREA}<br>戦績：${save.stats.win}勝 ${save.stats.lose}敗`;
  }
  $('#save-name').addEventListener('change', e => { save.name = playerName = e.target.value.trim().slice(0, 12) || '悠姫'; persist(); });
  const encodeSave = s => 'GKSAVE1:' + btoa(unescape(encodeURIComponent(JSON.stringify(s))));
  function decodeSave(code) {
    code = String(code || '').trim();
    if (!code.startsWith('GKSAVE1:')) return null;
    try { return validateSave(JSON.parse(decodeURIComponent(escape(atob(code.slice(8)))))); } catch (e) { return null; }
  }
  $('#save-export').onclick = () => modal(`<div>セーブデータ（コピーして保管してください）</div><textarea readonly onclick="this.select()">${encodeSave(save)}</textarea>`);
  function importDialog() {
    modal(`<div>セーブデータを貼り付けてください（今のデータは上書きされます）</div><textarea id="imp-code"></textarea><button class="btn" id="imp-ok">読み込む</button>`);
    $('#imp-ok').onclick = () => {
      const s = decodeSave($('#imp-code').value);
      if (!s) return toast('データが正しくありません');
      save = s; playerName = s.name; persist(); closeModal(); toast('読み込みました'); go('title');
    };
  }
  $('#save-import').onclick = importDialog;
  $('#btn-import0').onclick = importDialog;
  $('#save-reset').onclick = () => {
    if (!confirm('本当にすべてのデータを消して最初からやり直しますか？')) return;
    if (!confirm('元に戻せません。よろしいですか？')) return;
    store.del('save'); save = null; go('title');
  };

  /* ================= Ｖｓ ================= */
  function renderVs() {
    const wins = save.vsWins || {};
    $('#vs-list').innerHTML = GKP.VS_LIST.map(id => {
      const k = KD[id];
      const line = GKP.LINES[GKP.LINE_OF[id]] || [id];
      const owned = GKP.ownsLine(save, id) || save.contracts.some(c => GKP.sameLine(c.id, id));
      return `<div class="vs-card ${k.vs.raid ? 'raid' : ''}">
        <div class="vs-head">${line.map(x => icon(x)).join('')}<div><div class="vs-title">${k.vs.raid ? '<span class="raid-tag">RAID</span>' : ''}${esc(k.vs.title)}</div>${k.vs.raid ? `<div class="small">レイドボス：ＨＰ${k.vs.boost.hp}倍の単体ボス</div>` : k.vs.boost ? `<div class="small">強化個体：ＨＰ${k.vs.boost.hp}倍</div>` : ''}
          <div class="small">${line.map(x => esc(KD[x].name)).join('・')}　${owned ? '<span class="clear">契約済み</span>' : '未契約'}</div></div></div>
        <div class="vs-tiers">${GKP.VS_TIERS.map((t, ti) => `<button class="btn vs-tier" data-vs="${id}" data-tier="${t.key}">
          <b>${t.name}</b><span class="small">Lv${t.lv}・${owned ? `報酬${yen(t.money * 2)}` : `ドロップ${Math.round(GKP.vsRate(id, ti) * 100)}%`}</span>
          <span class="small">勝利 ${wins[id + ':' + t.key] || 0}回</span></button>`).join('')}</div>
      </div>`;
    }).join('') || '<p class="small">Ｖｓに挑戦できるコダマはまだいません。</p>';
  }
  $('#vs-list').addEventListener('click', async e => {
    const b = e.target.closest('[data-vs]'); if (!b) return;
    if (!myMembers().length) return toast('パーティにコダマがいません');
    const id = +b.dataset.vs;
    const tier = GKP.VS_TIERS.find(t => t.key === b.dataset.tier);
    const v = KD[id].vs;
    await talk(v.pre, `${v.title}（${tier.name}）`);
    current = new LocalSession({
      kind: 'vs', vsId: id, tier, level: 'hard',
      foe: { name: v.trainer || v.who || KD[id].name, party: GKP.vsParty(id, tier.lv) },
      boost: v.boost ? [null, v.boost] : null,
    });
    current.start();
  });

  /* ================= フリー対戦 ================= */
  function renderNpc() { $('#npc-mine').innerHTML = miniParty(myBuilds()); }
  function npcPool() {
    const n = Math.min(GKS.AREAS.length, GKS.progressArea(save) + 1);
    const ids = new Set();
    for (let a = 0; a < n; a++) for (const ch of GKS.AREAS[a].chars) for (const l of GKS.lineIdsForChar(ch)) l.forEach(id => ids.add(id));
    return [...ids];
  }
  $('#npc-start').onclick = () => {
    const mode = $('#npc-mode').value, level = $('#npc-level').value;
    const mine = myBuilds();
    const avg = Math.round(mine.reduce((a, b) => a + b.lv, 0) / mine.length);
    const lv = mode === 'flat' ? 50 : avg;
    const pool = npcPool();
    const party = [];
    while (party.length < mine.length) {
      let id = pool[Math.floor(Math.random() * pool.length)];
      // レベルに見合った姿を選ぶ
      const line = GKP.LINES[GKP.LINE_OF[id]];
      if (line) {
        const evo = line.filter(x => !GKP.isBase(KD[x]));
        const base = line.filter(x => GKP.isBase(KD[x]));
        const lst = lv >= GKP.EVOLVE_LV && evo.length ? evo : base.length ? base : evo;
        id = lst[Math.floor(Math.random() * lst.length)];
      }
      if (party.some(p => p.id === id)) continue;
      const plv = Math.max(1, Math.min(100, lv + Math.floor(Math.random() * 5) - 2));
      party.push({ id, lv: plv, slv: GKP.slvFor(plv) });
    }
    const names = { easy: '迷子の妖精', normal: '修行中の妖怪', hard: '腕利きの玉霊姫' };
    const rate = { easy: 0.7, normal: 1, hard: 1.4 }[level];
    current = new LocalSession({
      kind: mode === 'flat' ? 'flat' : 'free', level, forceLv: mode === 'flat' ? 50 : 0,
      foe: { name: names[level], party }, rate,
    });
    current.start();
  };

  /* ================= バトル画面 ================= */
  let current = null; // 現在のバトルセッション

  class BattleView {
    constructor(session) {
      this.s = session;
      this.me = session.me;
      this.foe = 1 - session.me;
      this.state = null;
      this.busy = false;
      this.tab = 'spell';
      this.picked = null;
      this.skip = false;
    }
    async show(state) {
      this.state = state;
      go('battle');
      this.tab = 'spell';
      this.syncTabs();
      this.renderStatic(state.log[0] ? state.log[0].snap : null, true);
      await this.play(state.log);
      this.renderCmd();
    }
    async update(state) {
      this.state = state;
      this.picked = null;
      await this.play(state.log);
      this.renderCmd();
    }
    snapSide(snap, side) { return snap[side]; }
    renderStatic(snap, enter) {
      if (!snap) snap = this.liveSnap();
      this.renderBox($('#sb-me'), snap[this.me], this.state.sides[this.me].party[snap[this.me].a]);
      this.renderBox($('#sb-foe'), snap[this.foe], this.state.sides[this.foe].party[snap[this.foe].a]);
      this.renderBalls($('#balls-me'), snap[this.me]);
      this.renderBalls($('#balls-foe'), snap[this.foe]);
      this.renderMon($('#mon-me'), snap[this.me], enter);
      this.renderMon($('#mon-foe'), snap[this.foe], enter);
    }
    liveSnap() {
      return this.state.sides.map(s => {
        const m = s.party[s.active];
        return { a: s.active, id: m.id, name: m.name, lv: m.lv, types: m.types, hp: m.hp, maxhp: m.maxhp, vp: m.vp, maxvp: m.maxvp, alive: s.party.map(p => p.hp > 0 ? 1 : 0) };
      });
    }
    renderBox(el, sn, mon) {
      const hpPct = Math.max(0, sn.hp / sn.maxhp * 100);
      const color = hpPct > 50 ? 'var(--hp)' : hpPct > 20 ? 'var(--hp-mid)' : 'var(--hp-low)';
      const sig = sn.a + ':' + sn.id;
      if (el.dataset.sig !== sig) {
        el.dataset.sig = sig;
        el.innerHTML = `<div class="row1"><span class="nm"></span><span class="types"></span></div>
          <div class="gauge"><span class="num hp"></span><div class="bar hp"><i></i></div>
          <span class="num vp"></span><div class="bar vp"><i></i></div></div><div class="mods"></div>`;
      }
      $('.nm', el).textContent = `Lv${sn.lv} ${sn.name}`;
      $('.types', el).innerHTML = tbs(sn.types);
      $('.num.hp', el).textContent = `HP:${sn.hp}/${sn.maxhp}`;
      $('.num.vp', el).textContent = `VP:${sn.vp}/${sn.maxvp}`;
      const hb = $('.bar.hp > i', el); hb.style.width = hpPct + '%'; hb.style.backgroundColor = color;
      $('.bar.vp > i', el).style.width = Math.max(0, sn.vp / sn.maxvp * 100) + '%';
      // 能力変化は最新状態から表示
      let mods = '';
      if (mon && mon.id === sn.id) {
        const nm = { atk: '攻', df: '防', spd: '速' };
        for (const k of ['atk', 'df', 'spd']) {
          const v = mon.mods[k];
          if (Math.abs(v - 1) > 0.005) mods += `<span class="${v > 1 ? 'up' : 'down'}">${nm[k]}×${v.toFixed(2)}</span> `;
        }
        if (mon.skillNull) mods += '<span class="down">スキル無効</span> ';
      }
      const side = this.state.sides[el.id === 'sb-me' ? this.me : this.foe];
      if (side.shield > 0) mods += `<span class="up">半減${side.shield}</span>`;
      if (side.frozen > 0) mods += `<span class="down">⏸時停止</span>`;
      if (mon && mon.raid) mods += '<span class="up">BOSS</span> ';
      if (mon && mon.impulse) mods += '<span class="up">｛impulse｝</span> ';
      $('.mods', el).innerHTML = mods;
    }
    renderBalls(el, sn) {
      el.innerHTML = sn.alive.map((a, i) => `<span class="ball ${a ? 'alive' : ''} ${i === sn.a ? 'cur' : ''}"></span>`).join('') +
        '<span class="ball"></span>'.repeat(Math.max(0, GK.MAX_PARTY - sn.alive.length));
    }
    renderMon(el, sn, enter) {
      const sig = sn.a + ':' + sn.id;
      if (el.dataset.sig === sig && !enter) {
        el.classList.toggle('faint', sn.hp <= 0);
        return;
      }
      el.dataset.sig = sig;
      const k = KD[sn.id];
      const spr = window.GK_SPRITES && window.GK_SPRITES[sn.id];
      const nm = sn.name.replace(/^(ちび|[Ａ-Ｚ]{1,2})/, '') || sn.name;
      el.className = 'mon';
      el.innerHTML = spr ? `<img class="${smooth(sn.id)}" src="${esc(spr)}" alt="${esc(sn.name)}">`
        : `<div class="ph t-${k.types[0]}"><span>${esc(nm.slice(0, 2))}</span></div><div class="lbl">${esc(sn.name)}</div>`;
      if (sn.hp <= 0) el.classList.add('faint');
      else { void el.offsetWidth; el.classList.add('enter'); }
    }
    async play(log) {
      this.busy = true;
      this.renderCmd();
      const box = $('#msgbox');
      for (const entry of log) {
        if (entry.prompt) continue;
        $('#msg').textContent = entry.text;
        this.renderStatic(entry.snap);
        if (entry.anim) this.animAttack(entry.anim);
        if (entry.timestop) { const f = $('#scr-battle'); f.classList.remove('ts-flash'); void f.offsetWidth; f.classList.add('timestop', 'ts-flash'); }
        if (/時は動き出す/.test(entry.text)) $('#scr-battle').classList.remove('timestop');
        if (entry.hit != null) this.animHit(entry.hit, entry.text);
        if (entry.faint != null) {
          const el = entry.faint === this.me ? $('#mon-me') : $('#mon-foe');
          el.classList.add('faint');
        }
        box.classList.add('waiting');
        await this.wait(entry.text.length > 18 ? 1100 : 800);
        box.classList.remove('waiting');
      }
      this.busy = false;
      $('#scr-battle').classList.toggle('timestop', this.state.sides.some(x => x.frozen > 0) && this.state.phase !== 'end');
      this.renderStatic();
      if (this.state.phase === 'end') this.showResult();
      else if (this.state.phase === 'switch' && this.state.need[this.me]) $('#msg').textContent = '次に繰り出すコダマを選んでください。';
      else if (this.state.phase === 'switch') $('#msg').textContent = '相手がコダマを選んでいます…';
      else $('#msg').textContent = `${GK.active(this.state, this.me).name}はどうする？`;
    }
    wait(ms) {
      return new Promise(res => {
        const box = $('#msgbox');
        let done = false;
        const fin = () => { if (done) return; done = true; box.removeEventListener('click', fin); clearTimeout(t); res(); };
        const speed = window.GK_DEBUG ? window.GK_DEBUG.speed : 1;
        const t = setTimeout(fin, this.skip ? 120 : ms * speed);
        box.addEventListener('click', fin);
      });
    }
    animAttack(a) {
      const el = a.side === this.me ? $('#mon-me') : $('#mon-foe');
      const cls = a.side === this.me ? 'lunge-l' : 'lunge-r';
      el.classList.remove('lunge-l', 'lunge-r', 'enter'); void el.offsetWidth; el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 400);
      // 属性色のエフェクト
      const target = a.side === this.me ? $('#mon-foe') : $('#mon-me');
      const fx = document.createElement('div');
      fx.className = `fx t-${a.type}`;
      fx.style.background = `radial-gradient(circle, currentColor, transparent 70%)`;
      const fr = $('#field').getBoundingClientRect(), tr = target.getBoundingClientRect();
      fx.style.left = (tr.left - fr.left + tr.width / 2 - 35) + 'px';
      fx.style.top = (tr.top - fr.top + tr.height / 2 - 35) + 'px';
      setTimeout(() => { $('#field').appendChild(fx); setTimeout(() => fx.remove(), 500); }, 180);
    }
    animHit(side, text) {
      const el = side === this.me ? $('#mon-me') : $('#mon-foe');
      el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
      const m = text.match(/(\d+)(?:の)?ダメージ/);
      if (m) {
        const pop = document.createElement('div');
        pop.className = 'dmgpop'; pop.textContent = m[1];
        const fr = $('#field').getBoundingClientRect(), tr = el.getBoundingClientRect();
        pop.style.left = (tr.left - fr.left + tr.width / 2 - 14) + 'px';
        pop.style.top = (tr.top - fr.top) + 'px';
        $('#field').appendChild(pop); setTimeout(() => pop.remove(), 950);
      }
    }
    syncTabs() { $$('.cmd-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === this.tab)); }

    canAct() {
      const st = this.state;
      return !this.busy && st && st.phase !== 'end' && st.need[this.me] && this.picked == null;
    }
    renderCmd() {
      const cmd = $('#cmd');
      const st = this.state;
      if (!st) return;
      if (st.phase === 'end' && !this.busy) { this.renderResult(cmd); return; }
      if (this.tab === 'chart') { cmd.innerHTML = this.chartHTML(); return; }
      if (this.tab === 'foe') { cmd.innerHTML = this.foeHTML(); return; }
      if (st.phase === 'switch' && st.need[this.me] && this.tab !== 'kodama') { this.tab = 'kodama'; this.autoTab = true; this.syncTabs(); }
      if (st.phase === 'command' && this.autoTab) { this.tab = 'spell'; this.autoTab = false; this.syncTabs(); }
      if (this.tab === 'kodama') { cmd.innerHTML = this.kodamaHTML(); return; }
      cmd.innerHTML = this.spellHTML();
    }
    waitNote() {
      if (this.busy) return '';
      if (this.picked != null || (this.state && !this.state.need[this.me])) return '<div class="wait-note">相手の行動を待っています…</div>';
      return '';
    }
    spellHTML() {
      const st = this.state;
      const m = GK.active(st, this.me);
      const k = KD[m.id];
      const ok = this.canAct() && st.phase === 'command';
      if (st.phase === 'end') return '';
      const valid = ok ? GK.validActions(st, this.me) : [];
      const has = (t, slot) => valid.some(a => a.type === t && a.slot === slot);
      const cell = (inner, act, en, cls) => `<div class="cell ${en ? '' : 'disabled'} ${cls || ''}">${inner}${act ? `<button class="btn use" data-act='${JSON.stringify(act)}' ${en ? '' : 'disabled'}>使用</button>` : ''}</div>`;
      let h = this.waitNote() + '<div class="cmd-grid">';
      h += cell(`<div class="sname">${tb(m.types[0])}通常攻撃</div><div class="sdesc">威力${GK.NORMAL_POWER}／消費0</div>`, { type: 'normal' }, ok && has('normal'));
      h += cell(m.skill ? `<div class="sdesc">スキル【${esc(m.skill.name)}】SLv${m.slv}${m.skillNull ? '（無効化中）' : ''}<br>${esc(m.skill.desc)}</div>` : '<div class="sdesc">スキルなし</div>', null, true);
      for (let slot = 0; slot < GK.MAX_SPELLS; slot++) {
        const si = m.spells[slot];
        if (si == null) { h += '<div class="cell"></div>'; continue; }
        const sp = k.spells[si];
        const mult = parseInt(sp.pow) ? GK.typeMult(sp.type, GK.active(st, this.foe).types) : null;
        const hint = mult == null ? '' : mult >= 2 ? ' <span style="color:#d0301e">◎</span>' : mult === 0 ? ' <span style="color:#555">×</span>' : mult < 1 ? ' <span style="color:#3a62c8">△</span>' : '';
        h += cell(`<div class="sname">${tb(sp.type)}<span>${esc(sp.name)}${hint}</span></div>
          <div class="sinfo">威力${parseInt(sp.pow) ? sp.pow : '―'}／消費${sp.cost}</div>
          <div class="sdesc">${esc(sp.desc)}</div>`, { type: 'spell', slot }, ok && has('spell', slot));
      }
      h += cell(`<div class="sname">${tb('無')}やすむ</div><div class="sdesc">VPを少し回復</div>`, { type: 'rest' }, ok && has('rest'));
      h += `<div class="cell" style="justify-content:flex-end"><button class="btn use danger" data-act='{"type":"surrender"}' ${this.busy ? 'disabled' : ''}>降参</button></div>`;
      return h + '</div>';
    }
    kodamaHTML() {
      const st = this.state;
      const side = st.sides[this.me];
      const ok = this.canAct();
      const valid = ok ? GK.validActions(st, this.me) : [];
      let h = this.waitNote() + '<div class="cmd-grid">';
      side.party.forEach((m, i) => {
        const en = valid.some(a => a.type === 'switch' && a.to === i);
        const cur = i === side.active;
        h += `<div class="cell kcell ${m.hp <= 0 ? 'disabled' : ''} ${cur ? 'picked' : ''}">
          <div class="sname">${icon(m.id)}${tbs(m.types)}<span>${esc(m.name)}</span></div>
          <div class="small">Lv${m.lv}${cur ? '（戦闘中）' : ''}</div>
          <div class="bars"><span>HP</span><div class="bar hp"><i style="width:${m.hp / m.maxhp * 100}%"></i></div><span>VP</span><div class="bar vp"><i style="width:${m.vp / m.maxvp * 100}%"></i></div></div>
          <div class="small">${m.hp}/${m.maxhp}・${m.vp}/${m.maxvp}</div>
          ${cur ? '' : `<button class="btn use" data-act='${JSON.stringify({ type: 'switch', to: i })}' ${en ? '' : 'disabled'}>交代</button>`}
        </div>`;
      });
      return h + '</div>';
    }
    chartHTML() {
      const foe = GK.active(this.state, this.foe), me = GK.active(this.state, this.me);
      let h = '<div class="chart-wrap"><table class="chart"><tr><th>攻＼防</th>';
      for (const t of GK.TYPES) h += `<th class="${foe.types.includes(t) ? 'hl' : ''}">${tb(t)}</th>`;
      h += '</tr>';
      for (const a of GK.TYPES) {
        h += `<tr><th>${tb(a)}</th>`;
        for (const d of GK.TYPES) {
          const v = GK.typeMult(a, [d]);
          const cls = v >= 2 ? 'x2' : v === 0 ? 'x0' : v < 1 ? 'x05' : '';
          const hl = foe.types.includes(d) && (me.types.includes(a)) ? 'hl' : '';
          h += `<td class="${cls} ${hl}">${v >= 2 ? '◎' : v === 0 ? '×' : v < 1 ? '△' : ''}</td>`;
        }
        h += '</tr>';
      }
      h += '</table></div><p class="small">◎＝2倍　△＝0.5倍　×＝無効　（縦：スペルの属性／横：防御側の属性）</p>';
      return h;
    }
    foeHTML() {
      const m = GK.active(this.state, this.foe);
      const k = KD[m.id];
      const mods = ['atk', 'df', 'spd'].map(s => `${{ atk: '攻撃', df: '防御', spd: '速度' }[s]}×${m.mods[s].toFixed(2)}`).join('　');
      let h = `<div class="foeinfo"><h4>${tbs(m.types)}Lv${m.lv} ${esc(m.name)}</h4>
        <div>ＨＰ ${m.hp}/${m.maxhp}　ＶＰ ${m.vp}/${m.maxvp}</div>
        <div>攻撃 ${m.atk}　防御 ${m.df}　速度 ${m.spd}</div>
        <div class="small">能力変化：${mods}</div>
        ${m.skill ? `<div class="skillbox">スキル【${esc(m.skill.name)}】SLv${m.slv}${m.skillNull ? '（無効化中）' : ''}<br>${esc(m.skill.desc)}</div>` : ''}
        <div class="small">受けるダメージ倍率：${GK.TYPES.filter(t => GK.typeMult(t, m.types) !== 1).map(t => `${tb(t)}×${GK.typeMult(t, m.types)}`).join(' ') || 'なし'}</div>
        <div class="small" style="margin-top:6px">覚えているスペル</div>`;
      for (const si of m.spells) { const s = k.spells[si]; h += `<div class="spell-mini">${spellLine(s)}</div>`; }
      h += `<div class="small" style="margin-top:6px">控え：${this.state.sides[this.foe].party.map((p, i) => i === this.state.sides[this.foe].active ? '' : `${p.hp > 0 ? '' : '×'}${esc(p.name)}`).filter(Boolean).join('、') || 'なし'}</div></div>`;
      return h;
    }
    showResult() {
      const w = this.state.winner;
      $('#msg').textContent = w === -1 ? '引き分け！' : w === this.me ? 'あなたの勝利！' : 'あなたの負け…';
    }
    renderResult(cmd) {
      const w = this.state.winner;
      const cls = w === this.me ? 'win' : w === -1 ? '' : 'lose';
      const txt = w === this.me ? 'ＷＩＮ！' : w === -1 ? 'ＤＲＡＷ' : 'ＬＯＳＥ…';
      cmd.innerHTML = `<div class="result-box"><div class="res ${cls}">${txt}</div>
        <div class="row-btns" style="justify-content:center">
          ${this.s.canRematch ? '<button class="btn" id="bt-rematch">再戦する</button>' : ''}
          <button class="btn" id="bt-exit">メニューへ</button></div></div>`;
      if ($('#bt-rematch')) $('#bt-rematch').onclick = () => this.s.rematch();
      $('#bt-exit').onclick = () => { this.s.exit(); };
    }
    onAction(act) {
      if (act.type === 'surrender') {
        if (this.busy || this.state.phase === 'end') return;
        if (!confirm('降参しますか？')) return;
      } else if (!this.canAct()) return;
      this.picked = act;
      this.renderCmd();
      $('#msg').textContent = '相手の行動を待っています…';
      this.s.submit(act);
    }
  }

  $('.cmd-tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (!t || !current || !current.view) return;
    current.view.tab = t.dataset.tab;
    current.view.autoTab = false;
    current.view.syncTabs();
    current.view.renderCmd();
  });
  $('#cmd').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled || !current || !current.view) return;
    current.view.onAction(JSON.parse(b.dataset.act));
  });


  /* ================= NPC戦・ストーリー戦 ================= */
  class LocalSession {
    constructor(opts) {
      this.opts = opts;
      this.me = 0;
      this.canRematch = true;
      this.view = new BattleView(this);
    }
    start() {
      const o = this.opts;
      this.uids = o.mine ? [] : save.party.slice();
      this.ended = false;
      this.won = false;
      this.state = GK.createBattle([{ name: o.myName || save.name, party: o.mine || myBuilds(o.forceLv) }, { name: o.foe.name, party: o.foe.party }], { forceLv: o.forceLv || 0, boost: o.boost || null, seed: o.seed });
      this.view.show(this.state);
    }
    async submit(act) {
      const st = this.state;
      const acts = [act, null];
      if (act.type !== 'surrender' && st.need[1]) acts[1] = GK.chooseAI(st, 1, this.opts.level);
      await sleep(250);
      this.state = GK.resolve(st, acts);
      // NPCだけが交代を必要とする場合は自動で進める
      while (this.state.phase === 'switch' && !this.state.need[0] && this.state.need[1]) {
        await this.view.update(this.state);
        this.state = GK.resolve(this.state, [null, GK.chooseAI(this.state, 1, this.opts.level)]);
      }
      await this.view.update(this.state);
      if (this.state.phase === 'end' && !this.ended) {
        this.ended = true;
        await this.finish();
      }
    }
    async finish() {
      const o = this.opts, st = this.state;
      const win = st.winner === 0;
      this.won = win;
      if (o.kind === 'flat') return;
      if (o.kind === 'story') {
        const S = o.stage;
        this.wasFirstTry = !save.cleared[S.key];
        const first = win && this.wasFirstTry;
        this.firstClear = first;
        if (win) save.cleared[S.key] = 1;
        await awardBattle(st, {
          uids: this.uids, expMult: S.isBoss ? 1.5 : 1,
          money: first ? S.reward.money : Math.round(S.reward.money * 0.25 / 10) * 10,
          firstClear: first ? S.reward : null,
          dropRate: S.isBoss ? 0.25 : 0.15,
        });
      } else if (o.kind === 'vs') {
        const owned = GKP.ownsLine(save, o.vsId) || save.contracts.some(c => GKP.sameLine(c.id, o.vsId));
        if (win) save.vsWins = Object.assign(save.vsWins || {}, { [o.vsId + ':' + o.tier.key]: ((save.vsWins || {})[o.vsId + ':' + o.tier.key] || 0) + 1 });
        const r = await awardBattle(st, {
          uids: this.uids, expMult: 1,
          money: owned ? o.tier.money * 2 : o.tier.money,
          specialDrop: owned ? null : { id: o.vsId, lv: GKP.VS_JOIN_LV, rate: GKP.vsRate(o.vsId, GKP.VS_TIERS.indexOf(o.tier)) },
        });
        this.gotSpecial = r.contracts.some(c => c.special);
      } else {
        const foeLv = o.foe.party.reduce((a, p) => a + p.lv, 0) / o.foe.party.length;
        await awardBattle(st, {
          uids: this.uids, expMult: 0.7 * o.rate,
          money: Math.round(foeLv * 60 * o.rate / 10) * 10,
          dropRate: 0.05 * o.rate,
        });
      }
    }
    rematch() { this.start(); }
    async exit() {
      current = null;
      const o = this.opts;
      if (o.onExit) return o.onExit();
      if (o.kind === 'story') {
        if (this.won && this.firstClear) await talk(o.stage.post, o.stage.title);
        go('story');
      } else if (o.kind === 'vs') {
        const v = KD[o.vsId].vs;
        await talk(this.won ? v.win : v.lose, v.title);
        go('vs');
      } else go('npc');
    }
  }

  /* ================= オンライン対戦（PeerJS） =================
   * ホストが権威を持ち、両者の行動を受け取ってターンを解決し、結果を送り返す。
   * メッセージ:
   *   hello {name, party, ver}            双方 → 相手
   *   start {state, me}                   ホスト → ゲスト
   *   act   {key, action}                 ゲスト → ホスト
   *   state {state}                       ホスト → ゲスト
   *   rematch {}                          双方
   */
  const net = { peer: null, conn: null, isHost: false, opp: null, session: null };

  function setStatus(msg) { $('#on-status').textContent = msg; }
  function renderOnline() {
    $('#on-opponent').innerHTML = net.opp ? `<span class="small">相手：${esc(net.opp.name)}</span> ` + miniParty(net.opp.party) : '';
    $('#on-start').disabled = !(net.isHost && net.conn && net.conn.open && net.opp);
    $('#on-start').textContent = net.isHost ? '対戦開始！' : 'ホストの開始を待っています';
    $('#on-lvrule').disabled = !!(net.conn && !net.isHost);
  }
  function genCode() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = ''; for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  }
  function netReset() {
    try { if (net.conn) net.conn.close(); } catch (e) { /* noop */ }
    try { if (net.peer) net.peer.destroy(); } catch (e) { /* noop */ }
    net.peer = net.conn = net.opp = net.session = null; net.isHost = false;
    $('#on-code').textContent = '------';
  }
  function needPeer() {
    if (typeof Peer === 'undefined') { setStatus('PeerJS を読み込めませんでした。ネット接続を確認してください。'); return false; }
    return true;
  }

  $('#on-host').onclick = () => {
    if (!checkParty() || !needPeer()) return;
    netReset();
    const code = genCode();
    net.isHost = true;
    setStatus('ルームを作成中…');
    net.peer = new Peer(PEER_PREFIX + code);
    net.peer.on('open', () => { $('#on-code').textContent = code; setStatus('ルーム作成！ コードを相手に伝えて、参加を待ってください。'); });
    net.peer.on('connection', c => {
      if (net.conn && net.conn.open) { c.on('open', () => { c.send({ t: 'busy' }); setTimeout(() => c.close(), 300); }); return; }
      setupConn(c);
    });
    net.peer.on('error', err => setStatus('エラー：' + (err.type === 'unavailable-id' ? 'コードが重複しました。もう一度作成してください' : err.type || err)));
    renderOnline();
  };
  $('#on-join').onclick = () => {
    if (!checkParty() || !needPeer()) return;
    const code = $('#on-join-code').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(code)) return toast('ルームコードを入力してください');
    netReset();
    net.isHost = false;
    setStatus('接続中…');
    net.peer = new Peer();
    net.peer.on('open', () => setupConn(net.peer.connect(PEER_PREFIX + code, { reliable: true })));
    net.peer.on('error', err => setStatus('エラー：' + (err.type === 'peer-unavailable' ? 'ルームが見つかりません' : err.type || err)));
    renderOnline();
  };
  $('#on-copy').onclick = () => {
    const code = $('#on-code').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => toast('コピーしました'), () => toast(code));
  };
  $('#on-leave').onclick = () => { netReset(); setStatus('切断しました'); renderOnline(); };
  $('#on-start').onclick = () => { if (net.isHost) hostStart(); };

  function setupConn(c) {
    net.conn = c;
    c.on('open', () => {
      if (!net.opp) setStatus('接続しました！ 相手の情報を待っています…');
      c.send({ t: 'hello', name: save.name, party: myBuilds(), ver: VERSION });
      renderOnline();
    });
    c.on('data', onNetData);
    c.on('close', () => {
      setStatus('相手との接続が切れました');
      if (current && current === net.session && current.state && current.state.phase !== 'end') {
        $('#msg').textContent = '相手との接続が切れました…';
        toast('相手との接続が切れました');
      }
      net.conn = null; net.opp = null;
      renderOnline();
    });
    c.on('error', e => setStatus('通信エラー：' + e));
  }

  function onNetData(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'busy') { setStatus('そのルームは対戦中です'); return; }
    if (m.t === 'hello') {
      if (m.ver !== VERSION) setStatus('バージョンが異なります。ページを再読み込みしてください。');
      const p = Array.isArray(m.party) ? m.party.map(b => GK.sanitizeBuild(b)).filter(Boolean).slice(0, GK.MAX_PARTY) : [];
      net.opp = { name: String(m.name || '相手').slice(0, 12), party: p };
      setStatus(`${net.opp.name} と接続しました！` + (net.isHost ? ' 「対戦開始！」を押してください。' : ' ホストの開始を待っています。'));
      renderOnline();
      return;
    }
    if (m.t === 'start' && !net.isHost) {
      net.session = current = new GuestSession(m.state);
      current.view.show(m.state);
      return;
    }
    if (m.t === 'state' && !net.isHost && net.session) { net.session.receive(m.state); return; }
    if (m.t === 'act' && net.isHost && net.session) { net.session.guestAction(m.key, m.action); return; }
    if (m.t === 'rematch' && net.session) { net.session.rematchRequest(); }
  }

  function turnKey(st) { return st.turn + ':' + st.phase; }

  function hostStart() {
    if (!net.opp || !net.opp.party.length) return toast('相手のパーティがありません');
    const rule = $('#on-lvrule').value;
    const forceLv = rule === 'own' ? 0 : +rule;
    const st = GK.createBattle([{ name: save.name, party: myBuilds() }, { name: net.opp.name, party: net.opp.party }], { forceLv });
    net.session = current = new HostSession(st);
    net.conn.send({ t: 'start', state: st });
    current.view.show(st);
  }

  class HostSession {
    constructor(state) {
      this.me = 0;
      this.state = state;
      this.acts = [null, null];
      this.canRematch = true;
      this.rematchWanted = [false, false];
      this.view = new BattleView(this);
    }
    submit(act) {
      if (act.type === 'surrender' || GK.isValid(this.state, 0, act)) this.acts[0] = act;
      this.tryResolve();
    }
    guestAction(key, act) {
      if (key !== turnKey(this.state)) return;
      if (!act || (act.type !== 'surrender' && !GK.isValid(this.state, 1, act))) return;
      this.acts[1] = act;
      this.tryResolve();
    }
    tryResolve() {
      const st = this.state;
      if (st.phase === 'end') return;
      const surrender = this.acts.some(a => a && a.type === 'surrender');
      const ready = surrender || [0, 1].every(s => !st.need[s] || this.acts[s]);
      if (!ready) return;
      this.state = GK.resolve(st, this.acts);
      this.acts = [null, null];
      if (net.conn && net.conn.open) net.conn.send({ t: 'state', state: this.state });
      this.view.update(this.state);
    }
    rematch() {
      this.rematchWanted[0] = true;
      if (net.conn && net.conn.open) net.conn.send({ t: 'rematch' });
      toast('再戦を申し込みました');
      this.checkRematch();
    }
    rematchRequest() { this.rematchWanted[1] = true; toast('相手が再戦を希望しています'); this.checkRematch(); }
    checkRematch() { if (this.rematchWanted[0] && this.rematchWanted[1]) hostStart(); }
    exit() { current = null; go('online'); }
  }

  class GuestSession {
    constructor(state) {
      this.me = 1;
      this.state = state;
      this.canRematch = true;
      this.view = new BattleView(this);
    }
    submit(act) {
      if (net.conn && net.conn.open) net.conn.send({ t: 'act', key: turnKey(this.state), action: act });
      else toast('接続が切れています');
    }
    receive(state) {
      this.state = state;
      this.view.update(state);
    }
    rematch() {
      if (net.conn && net.conn.open) net.conn.send({ t: 'rematch' });
      toast('再戦を申し込みました');
    }
    rematchRequest() { toast('相手が再戦を希望しています'); }
    exit() { current = null; go('online'); }
  }

  // デバッグ・テスト用
  function checkParty() { if (!save) { go('title'); return false; } return true; }

  go('title');
  window.GK_APP = {
    go, get save() { return save; }, get current() { return current; }, persist, validateSave, store, PREFIX,
    // デバッグ用：セーブ差し替え・任意バトル開始・再描画
    setSave(s) { const v = validateSave(s); if (!v) return false; save = v; playerName = v.name; persist(); return true; },
    clearSave() { store.del('save'); save = null; },
    startBattle(opts) { current = new LocalSession(Object.assign({ kind: 'flat', level: 'normal' }, opts)); current.start(); return current; },
    refresh() {
      if (current && current.view && current.view.state) {
        current.view.state = current.state;
        current.view.renderStatic(); current.view.renderCmd();
      }
      refreshMoney();
    },
  };
})();
