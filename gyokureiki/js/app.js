/* 東方玉霊姫 対戦シミュレータ - 画面・NPC戦・オンライン対戦 */
(function () {
  'use strict';

  const D = window.GK_DATA;
  const KD = GK.KODAMA;
  const VERSION = 1;
  const STARTERS = [110, 194, 73]; // ちびみのりこ・ちびりん・ちびにとり
  const PEER_PREFIX = 'gyokureiki-v1-';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tb = (t, cls) => `<span class="tb t-${t} ${cls || ''}">${t}</span>`;
  const tbs = types => types.map(t => tb(t)).join('');
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ================= 保存 ================= */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('gk_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('gk_' + k, JSON.stringify(v)); } catch (e) { /* 保存不可でも続行 */ } },
  };
  let party = (store.get('party', null) || STARTERS.map(id => ({ id, lv: 50 })))
    .map(b => GK.sanitizeBuild(b)).filter(Boolean);
  let playerName = store.get('name', '悠姫');
  const saveParty = () => store.set('party', party);

  /* ================= 画面遷移 ================= */
  function go(name) {
    if (name !== 'battle' && current && current.leaveBattle) current.leaveBattle();
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + name));
    window.scrollTo(0, 0);
    if (name === 'party') renderParty();
    if (name === 'zukan') renderZukan();
    if (name === 'npc') $('#npc-mine').innerHTML = miniParty(party);
    if (name === 'online') renderOnline();
    if (name === 'title') $('#t-name').textContent = playerName;
  }
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]');
    if (g) go(g.dataset.go);
  });

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function modal(html) { $('#modal-content').innerHTML = html; $('#modal').classList.add('open'); }
  $('#modal-close').onclick = () => $('#modal').classList.remove('open');
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') $('#modal').classList.remove('open'); });

  $('#in-name').value = playerName;
  $('#in-name').addEventListener('change', e => { playerName = e.target.value.trim().slice(0, 12) || '名無し'; store.set('name', playerName); $('#t-name').textContent = playerName; });
  $('#t-name').textContent = playerName;

  function miniParty(list) {
    return list.map(b => { const k = KD[b.id]; return k ? `<span class="chip">${tbs(k.types)}${esc(k.name)} Lv${b.lv}</span>` : ''; }).join('');
  }

  /* ================= コダマ一覧（共通） ================= */
  const SORTS = { no: 'No.順', total: '合計', hp: 'ＨＰ', atk: '攻撃', df: '防御', spd: '速度' };
  function filterUI(root, onChange) {
    root.innerHTML = `
      <input type="search" placeholder="名前で検索" data-f="q">
      <select data-f="type"><option value="">全属性</option>${GK.TYPES.map(t => `<option>${t}</option>`).join('')}</select>
      <select data-f="sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>`;
    const st = { q: '', type: '', sort: 'no' };
    root.addEventListener('input', e => { const f = e.target.dataset.f; if (f) { st[f] = e.target.value; onChange(st); } });
    return st;
  }
  function filterList(st) {
    const q = st.q.trim();
    let list = D.kodama.filter(k => (!q || k.name.includes(q) || String(k.id) === q) && (!st.type || k.types.includes(st.type)));
    if (st.sort !== 'no') list = list.slice().sort((a, b) => b[st.sort] - a[st.sort] || a.id - b.id);
    return list;
  }
  function krow(k, extra) {
    return `<div class="krow ${extra || ''}" data-id="${k.id}">
      <span class="no">No.${k.id}</span>
      <span class="nm">${tbs(k.types)}${esc(k.name)}</span>
      <span class="st">H<b>${k.hp}</b> 攻<b>${k.atk}</b> 防<b>${k.df}</b> 速<b>${k.spd}</b><br>合計 <b>${k.total}</b></span>
    </div>`;
  }

  function spellLine(s) {
    const pow = parseInt(s.pow) ? `威力${s.pow}` : '威力―';
    return `${tb(s.type)} <span>${esc(s.name)}</span> <span class="pw">${pow}／消費${s.cost}</span>`;
  }

  function kodamaDetail(k, lv) {
    lv = lv || 50;
    const st = GK.calcStats(k, lv);
    return `<div class="ed-head">${tbs(k.types.map(t => t))}<span class="nm">${esc(k.name)}</span><span class="small">No.${k.id}</span></div>
      <div class="statgrid" style="margin-top:8px">
        <div>ＨＰ<b>${k.hp}</b></div><div>攻撃<b>${k.atk}</b></div><div>防御<b>${k.df}</b></div><div>速度<b>${k.spd}</b></div><div>合計<b>${k.total}</b></div>
      </div>
      <div class="small" style="margin-top:4px">Lv${lv}時：ＨＰ${st.maxhp} ＶＰ${st.maxvp} 攻撃${st.atk} 防御${st.df} 速度${st.spd}</div>
      ${k.skills.length ? k.skills.map(s => `<div class="skillbox">スキル【${esc(s.name)}】<br>${esc(s.desc)}</div>`).join('') : '<div class="skillbox">スキルなし</div>'}
      <div class="spell-list">${k.spells.map(s => `<div class="spell-row" style="cursor:default"><span></span>${spellLine(s)}<span class="desc">${esc(s.desc)}（${esc(s.price)}${/^\d+$/.test(s.price) ? '銭' : ''}）</span></div>`).join('')}</div>`;
  }

  /* ================= 図鑑 ================= */
  let zukanState;
  function renderZukan() {
    if (!zukanState) zukanState = filterUI($('#zukan-filters'), drawZukan);
    drawZukan(zukanState);
  }
  function drawZukan(st) {
    const list = filterList(st);
    $('#zukan-count').textContent = `${list.length}体`;
    $('#zukan-list').innerHTML = list.map(k => krow(k)).join('');
  }
  $('#zukan-list').addEventListener('click', e => {
    const r = e.target.closest('.krow');
    if (r) modal(kodamaDetail(KD[r.dataset.id], 50));
  });

  /* ================= パーティ編成 ================= */
  let selSlot = 0, partyFilter;
  function renderParty() {
    if (!partyFilter) partyFilter = filterUI($('#party-filters'), drawPartyList);
    $('#party-count').textContent = `${party.length}/${GK.MAX_PARTY}`;
    const slots = [];
    for (let i = 0; i < GK.MAX_PARTY; i++) {
      const b = party[i];
      if (b) {
        const k = KD[b.id];
        slots.push(`<button class="pslot ${i === selSlot ? 'sel' : ''}" data-slot="${i}"><span class="no">${i === 0 ? '先頭' : i + 1}</span>${tbs(k.types)}<span class="nm">${esc(k.name)}</span>Lv${b.lv}　S${b.slv}</button>`);
      } else {
        slots.push(`<button class="pslot empty ${i === selSlot ? 'sel' : ''}" data-slot="${i}">＋ 空き</button>`);
      }
    }
    $('#party-slots').innerHTML = slots.join('');
    renderEditor();
    drawPartyList(partyFilter);
  }
  function drawPartyList(st) {
    const ids = new Set(party.map(b => b.id));
    $('#party-list').innerHTML = filterList(st).map(k => krow(k, ids.has(k.id) ? 'inparty' : '')).join('');
  }
  function renderEditor() {
    const b = party[selSlot];
    const ed = $('#slot-editor');
    if (!b) { ed.innerHTML = '<p class="small">下の一覧からコダマを選んでください。</p>'; return; }
    const k = KD[b.id];
    const st = GK.calcStats(k, b.lv);
    ed.innerHTML = `
      <div class="ed-head">${tbs(k.types)}<span class="nm">${esc(k.name)}</span><span class="small">No.${k.id}</span>
        <button class="btn sm" data-ed="info" style="margin-left:auto">詳細</button></div>
      <div class="ed-controls">
        <label>Lv <input type="number" min="1" max="100" value="${b.lv}" data-ed="lv"></label>
        <label>スキルLv <select data-ed="slv">${[1, 2, 3, 4, 5].map(n => `<option ${n === b.slv ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <button class="btn sm" data-ed="up">◀</button><button class="btn sm" data-ed="down">▶</button>
        <button class="btn sm danger" data-ed="remove">外す</button>
      </div>
      <div class="statgrid">
        <div>ＨＰ<b>${st.maxhp}</b></div><div>ＶＰ<b>${st.maxvp}</b></div><div>攻撃<b>${st.atk}</b></div><div>防御<b>${st.df}</b></div><div>速度<b>${st.spd}</b></div>
      </div>
      ${k.skills.length ? `<div class="skillbox">スキル【${esc(k.skills[0].name)}】 SLv${b.slv}<br>${esc(k.skills[0].desc)}</div>` : ''}
      <div class="small">スペル（最大${GK.MAX_SPELLS}つ選択：${b.spells.length}/${GK.MAX_SPELLS}）</div>
      <div class="spell-list">${k.spells.map((s, i) => `
        <label class="spell-row ${b.spells.includes(i) ? 'on' : ''}">
          <input type="checkbox" data-sp="${i}" ${b.spells.includes(i) ? 'checked' : ''}>${spellLine(s)}
          <span class="desc">${esc(s.desc)}</span>
        </label>`).join('')}</div>`;
  }
  $('#party-slots').addEventListener('click', e => {
    const s = e.target.closest('[data-slot]');
    if (!s) return;
    selSlot = Math.min(+s.dataset.slot, party.length);
    renderParty();
  });
  $('#party-list').addEventListener('click', e => {
    const r = e.target.closest('.krow');
    if (!r) return;
    const id = +r.dataset.id;
    const nb = GK.sanitizeBuild({ id, lv: party[selSlot] ? party[selSlot].lv : (party[0] ? party[0].lv : 50), slv: 5 });
    if (party[selSlot]) party[selSlot] = nb;
    else if (party.length < GK.MAX_PARTY) { party.push(nb); selSlot = party.length - 1; }
    else { toast('パーティがいっぱいです。入れ替える枠を選んでください'); return; }
    saveParty(); renderParty();
    toast(`${KD[id].name}をパーティに入れた！`);
    $('#scr-party .panel').scrollIntoView({ behavior: 'smooth' });
  });
  $('#slot-editor').addEventListener('change', e => {
    const b = party[selSlot]; if (!b) return;
    const t = e.target;
    if (t.dataset.ed === 'lv') b.lv = Math.max(1, Math.min(100, Math.round(+t.value || 1)));
    if (t.dataset.ed === 'slv') b.slv = +t.value;
    if (t.dataset.sp != null) {
      const i = +t.dataset.sp;
      if (t.checked) {
        if (b.spells.length >= GK.MAX_SPELLS) { t.checked = false; toast(`スペルは${GK.MAX_SPELLS}つまでです`); return; }
        b.spells.push(i);
      } else {
        if (b.spells.length <= 1) { t.checked = true; toast('スペルは１つ以上必要です'); return; }
        b.spells = b.spells.filter(x => x !== i);
      }
    }
    saveParty(); renderParty();
  });
  $('#slot-editor').addEventListener('click', e => {
    const a = e.target.closest('[data-ed]'); if (!a || a.tagName !== 'BUTTON') return;
    const b = party[selSlot]; if (!b) return;
    const act = a.dataset.ed;
    if (act === 'info') return modal(kodamaDetail(KD[b.id], b.lv));
    if (act === 'remove') { party.splice(selSlot, 1); selSlot = Math.min(selSlot, party.length); }
    if (act === 'up' && selSlot > 0) { [party[selSlot - 1], party[selSlot]] = [party[selSlot], party[selSlot - 1]]; selSlot--; }
    if (act === 'down' && selSlot < party.length - 1) { [party[selSlot + 1], party[selSlot]] = [party[selSlot], party[selSlot + 1]]; selSlot++; }
    saveParty(); renderParty();
  });
  $('#pt-random').onclick = () => { party = randomParty('random', 50); selSlot = 0; saveParty(); renderParty(); };
  $('#pt-lv50').onclick = () => { party.forEach(b => b.lv = 50); saveParty(); renderParty(); };
  $('#pt-clear').onclick = () => { if (confirm('パーティを空にしますか？')) { party = []; selSlot = 0; saveParty(); renderParty(); } };
  $('#pt-export').onclick = () => {
    const code = encodeParty(party);
    modal(`<div>パーティコード（コピーして共有できます）</div><textarea readonly onclick="this.select()">${code}</textarea>`);
  };
  $('#pt-import').onclick = () => {
    modal(`<div>パーティコードを貼り付けてください</div><textarea id="imp-code"></textarea><button class="btn" id="imp-ok">読み込む</button>`);
    $('#imp-ok').onclick = () => {
      const p = decodeParty($('#imp-code').value);
      if (!p || !p.length) return toast('コードが正しくありません');
      party = p; selSlot = 0; saveParty(); renderParty(); $('#modal').classList.remove('open'); toast('読み込みました');
    };
  };
  function encodeParty(p) {
    return 'GK1:' + p.map(b => [b.id, b.lv, b.slv, b.spells.join('.')].join('-')).join('_');
  }
  function decodeParty(code) {
    code = String(code || '').trim();
    if (!code.startsWith('GK1:')) return null;
    return code.slice(4).split('_').slice(0, GK.MAX_PARTY).map(s => {
      const [id, lv, slv, sp] = s.split('-');
      return GK.sanitizeBuild({ id: +id, lv: +lv, slv: +slv, spells: (sp || '').split('.').filter(x => x !== '').map(Number) });
    }).filter(Boolean);
  }

  function randomParty(mode, lv) {
    let pool = D.kodama;
    if (mode === 'strong') pool = D.kodama.filter(k => k.total >= 400);
    if (mode === 'starter') return STARTERS.map(id => GK.sanitizeBuild({ id, lv }));
    const out = [], used = new Set();
    while (out.length < GK.MAX_PARTY && used.size < pool.length) {
      const k = pool[Math.floor(Math.random() * pool.length)];
      if (used.has(k.id)) continue;
      used.add(k.id);
      out.push(GK.sanitizeBuild({ id: k.id, lv, slv: 5 }));
    }
    return out;
  }

  function checkParty() {
    if (!party.length) { toast('先にパーティを編成してください'); go('party'); return false; }
    return true;
  }

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
      el.innerHTML = spr ? `<img src="${esc(spr)}" alt="${esc(sn.name)}">`
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
        const t = setTimeout(fin, this.skip ? 120 : ms);
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
          <div class="sname">${tbs(m.types)}<span>${esc(m.name)}</span></div>
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

  /* ================= NPC戦 ================= */
  class LocalSession {
    constructor(opts) {
      this.opts = opts;
      this.me = 0;
      this.canRematch = true;
      this.view = new BattleView(this);
    }
    start() {
      const o = this.opts;
      const avg = Math.round(party.reduce((a, b) => a + b.lv, 0) / party.length) || 50;
      const forceLv = o.lvrule === 'own' ? 0 : +o.lvrule;
      let npc;
      if (o.npcParty === 'mirror') npc = party.map(b => Object.assign({}, b, { spells: b.spells.slice() }));
      else npc = randomParty(o.npcParty, forceLv || avg);
      const npcName = { easy: 'ようせい', normal: 'みこ見習い', hard: '玉霊使い' }[o.level] || 'ＮＰＣ';
      this.state = GK.createBattle([{ name: playerName, party }, { name: npcName, party: npc }], { forceLv });
      this.view.show(this.state);
    }
    async submit(act) {
      const st = this.state;
      const acts = [null, null];
      acts[0] = act;
      if (act.type !== 'surrender' && st.need[1]) acts[1] = GK.chooseAI(st, 1, this.opts.level);
      await sleep(250);
      this.state = GK.resolve(st, acts);
      // NPCだけが交代を必要とする場合は自動で進める
      while (this.state.phase === 'switch' && !this.state.need[0] && this.state.need[1]) {
        await this.view.update(this.state);
        this.state = GK.resolve(this.state, [null, GK.chooseAI(this.state, 1, this.opts.level)]);
      }
      await this.view.update(this.state);
    }
    rematch() { this.start(); }
    exit() { current = null; go('npc'); }
  }

  $('#npc-start').onclick = () => {
    if (!checkParty()) return;
    current = new LocalSession({ level: $('#npc-level').value, npcParty: $('#npc-party').value, lvrule: $('#npc-lvrule').value });
    current.start();
  };

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
      c.send({ t: 'hello', name: playerName, party, ver: VERSION });
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
    const st = GK.createBattle([{ name: playerName, party }, { name: net.opp.name, party: net.opp.party }], { forceLv });
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
  window.GK_APP = { go, get party() { return party; }, get current() { return current; } };
})();
