// ===== 峠 SPIRITS : RPG layer (story, garage, packs, free & online battle) =====
(function () {
  'use strict';
  const D = window.TOUGE_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yen = (n) => '¥' + Math.round(n).toLocaleString();

  // ---------- cards ----------
  const CARDS = window.TD_CARDS_RAW.map((r) => ({ id: r[0], grade: r[1], rq: r[2], make: r[3], model: r[4], year: r[5], top: r[6], acc: r[7], grip: r[8], tyre: r[9], drive: r[10], weight: r[11], abs: !!r[12], tcs: !!r[13], clr: r[14], img: r[15] }));
  const BY_ID = new Map(CARDS.map((c) => [c.id, c]));
  const findCard = (q) => CARDS.find((c) => `${c.make} ${c.model} ${c.year}`.includes(q));
  const GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
  const TYRE_JP = { per: 'パフォーマンス', std: 'スタンダード', all: 'オールシーズン', off: 'オフロード', slick: 'スリック' };
  const DRIVE_JP = { rwd: 'RWD', fwd: 'FWD', '4wd': '4WD' };

  // ---------- save ----------
  const KEY = 'touge-spirits-save-v1';
  const DEF = () => ({ v: 1, started: false, name: 'ハヤト', yen: 0, rep: 0, cards: {}, main: null, done: {}, packs: {}, settings: { bgm: true, sfx: true, assist: false, img: true, cam: 'chase' }, stats: { races: 0, wins: 0, best: {}, online: 0, onlineWins: 0 } });
  let save = DEF();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) save = Object.assign(DEF(), s, { settings: Object.assign(DEF().settings, s.settings || {}), stats: Object.assign(DEF().stats, s.stats || {}) }); } catch (_) {}
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (_) {} }
  function addCard(card) {
    const own = save.cards[card.id];
    if (own) { own.n++; return false; }
    save.cards[card.id] = { n: 1, tune: [0, 0, 0] };
    return true;
  }
  const tuneOf = (id) => (save.cards[id] ? save.cards[id].tune : [0, 0, 0]);
  const mainCard = () => BY_ID.get(save.main);
  const rankTitle = (rep) => rep >= 500 ? '伝説の走り屋' : rep >= 300 ? '峠の王者' : rep >= 150 ? '峠の実力者' : rep >= 50 ? '峠の常連' : '新人走り屋';

  // ---------- UI helpers ----------
  const UI = {};
  window.UI = UI;
  UI.toast = function (msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200);
  };
  UI.fallbackImg = function (card) {
    const hue = (card.id * 47) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5a7a"/><stop offset="1" stop-color="#121826"/></linearGradient></defs><rect width="160" height="100" fill="url(#g)"/><rect y="74" width="160" height="26" fill="#1b1f2a"/><path d="M12 70 L20 56 L50 51 L70 37 L106 36 L124 50 L148 56 L150 70 Z" fill="hsl(${hue},70%,50%)"/><path d="M75 41 L103 40 L115 50 L66 51 Z" fill="#9cc6dd"/><circle cx="42" cy="71" r="10" fill="#111"/><circle cx="42" cy="71" r="5" fill="#999"/><circle cx="124" cy="71" r="10" fill="#111"/><circle cx="124" cy="71" r="5" fill="#999"/><text x="80" y="22" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="12" fill="#fff8">${esc(card.make.toUpperCase())}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };
  UI.imgFail = function (img) { img.onerror = null; const c = BY_ID.get(+img.dataset.id); if (c) img.src = UI.fallbackImg(c); };
  UI.cardHTML = function (card, o = {}) {
    if (!card) return '';
    const tune = o.tune || [0, 0, 0];
    const tuned = tune.some((x) => x > 0);
    const top = Math.round(card.top * (1 + 0.025 * tune[0]));
    const acc = (card.acc * (1 - 0.035 * tune[0] - 0.02 * tune[1])).toFixed(1);
    const grip = Math.round(card.grip + 2 * tune[2] + 0.5 * tune[1]);
    const wt = Math.round(card.weight * (1 - 0.03 * tune[1]));
    const src = save.settings.img && card.img ? window.TD_IMG_BASE + card.img : UI.fallbackImg(card);
    return `<div class="tdcard ${o.mini ? 'mini' : ''} ${o.sel ? 'sel' : ''} ${o.locked ? 'locked' : ''}" style="--gc:${D.GRADE_COLORS[card.grade]}" data-id="${card.id}">
      <div class="tdc-head"><span class="mk">${esc(card.make)}</span><span class="md">${esc(card.model)}</span><span class="yr">${card.year || ''}</span><span class="fl">JP</span></div>
      <div class="tdc-body">
        <div class="tdc-photo"><img src="${src}" data-id="${card.id}" loading="lazy" referrerpolicy="no-referrer" onerror="UI.imgFail(this)" alt="">
          <div class="tdc-rq"><span class="g">${card.grade}</span><b>${card.rq}</b></div>${tuned ? `<div class="tdc-tune">${tune.join('')}</div>` : ''}</div>
        <div class="tdc-stats">
          <div class="${tune[0] ? 'up' : ''}"><b>${top}</b><span>最高速 mph</span></div>
          <div class="${tune[0] || tune[1] ? 'up' : ''}"><b>${acc}</b><span>0-60mph</span></div>
          <div class="${tune[2] || tune[1] ? 'up' : ''}"><b>${grip}</b><span>グリップ</span></div>
          ${o.mini ? '' : `<div class="${tune[1] ? 'up' : ''}"><b>${wt}</b><span>重量 kg</span></div>`}
          <div><b>${DRIVE_JP[card.drive] || card.drive}</b><span>駆動</span></div>
        </div>
      </div>
      <div class="tdc-foot"><span>${TYRE_JP[card.tyre] || card.tyre} タイヤ</span><span>${card.abs ? 'ABS ' : ''}${card.tcs ? 'TCS' : ''}</span></div>
      ${o.count > 1 ? `<div class="tdc-count">×${o.count}</div>` : ''}
    </div>`;
  };

  function portraitSVG(key) {
    const ch = D.CHARS[key] || D.CHARS.me;
    const col = ch.color, h = [...key].reduce((a, c) => a + c.charCodeAt(0), 0);
    // spiky anime-style hair: alternating tips/valleys around the top of the head
    const spikes = [];
    const n = 9 + (h % 5) * 2;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI * (0.92 + i / n * 1.16);
      const tip = i % 2 === 0;
      const r = tip ? 88 + ((h >> (i % 7)) % 4) * 7 : 66;
      spikes.push(`${(150 + Math.cos(a) * r * 0.95).toFixed(1)},${(186 + Math.sin(a) * r).toFixed(1)}`);
    }
    spikes.push('205,160', '180,138', '150,150', '120,138', '95,160');
    const long = ['mina', 'misaki', 'reika', 'rin', 'yuu'].includes(key);
    return `<svg class="sil" viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="pg_${key}" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="${col}" stop-opacity=".55"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>
      <linearGradient id="bd_${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1f38"/><stop offset="1" stop-color="#05060d"/></linearGradient></defs>
      <ellipse cx="150" cy="220" rx="150" ry="190" fill="url(#pg_${key})"/>
      ${long ? `<path d="M70 200 Q60 330 95 360 L205 360 Q240 330 230 200 Z" fill="#0b0d18" stroke="${col}" stroke-width="2"/>` : ''}
      <path d="M30 400 Q40 290 150 276 Q260 290 270 400 Z" fill="url(#bd_${key})" stroke="${col}" stroke-width="3"/>
      <path d="M120 282 L150 330 L180 282" fill="none" stroke="${col}" stroke-width="3"/>
      <rect x="130" y="240" width="40" height="45" fill="#0a0c18" stroke="${col}" stroke-width="2"/>
      <ellipse cx="150" cy="190" rx="64" ry="74" fill="#0d1020" stroke="${col}" stroke-width="3"/>
      <polygon points="${spikes.join(' ')}" fill="#05060c" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M112 196 l22 -4 M188 196 l-22 -4" stroke="${col}" stroke-width="4" stroke-linecap="round"/>
      <text x="150" y="246" font-size="46" font-weight="900" fill="${col}" text-anchor="middle" font-family="Noto Sans JP, sans-serif" opacity=".95">${esc(ch.icon)}</text>
    </svg>`;
  }

  UI.portraitSVG = portraitSVG;

  // ---------- screens ----------
  const scr = () => $('#screens');
  let current = null;
  function show(html, cls = '') {
    const s = scr();
    s.innerHTML = `<div class="screen ${cls}">${html}</div>`;
    return s.firstElementChild;
  }
  function topbar(title, back = 'home') {
    return `<div class="topbar"><button class="back" data-go="${back}">◀</button><h1>${title}</h1><div class="wallet"><span class="yen">${yen(save.yen)}</span><span class="rep">名声 ${save.rep}</span></div></div>`;
  }
  function bindGo(root) {
    $$('[data-go]', root).forEach((b) => b.addEventListener('click', () => { Sound.blip(660, 0.05); go(b.dataset.go); }));
  }
  function go(name, ...a) {
    current = name;
    const f = SCREENS[name];
    if (f) f(...a);
  }

  // ---------- animated background ----------
  const bg = { on: true, t: 0, cars: [] };
  function bgLoop() {
    requestAnimationFrame(bgLoop);
    const cv = $('#bgfx'); if (!cv || !bg.on) return;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d');
    bg.t += 1 / 60;
    const t = bg.t, hz = h * 0.5, cx = w / 2;
    const sky = g.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#020310'); sky.addColorStop(1, '#1d1846');
    g.fillStyle = sky; g.fillRect(0, 0, w, hz + 1);
    // stars
    g.fillStyle = '#fff';
    for (let i = 0; i < 90; i++) { const x = (i * 9301 % 1000) / 1000 * w, y = (i * 4919 % 1000) / 1000 * hz * 0.85; g.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.8 + i)); g.fillRect(x, y, 1.5, 1.5); }
    g.globalAlpha = 1;
    // moon
    const mg = g.createRadialGradient(w * 0.8, hz * 0.3, 0, w * 0.8, hz * 0.3, 90);
    mg.addColorStop(0, '#fffbe8'); mg.addColorStop(0.2, '#fffbe8'); mg.addColorStop(0.25, '#9fb4ff55'); mg.addColorStop(1, '#0000');
    g.fillStyle = mg; g.fillRect(w * 0.8 - 90, hz * 0.3 - 90, 180, 180);
    // ridges
    [['#0b0c22', 0.62, 1], ['#06061a', 0.8, 2.3]].forEach(([c, hh, f]) => {
      g.fillStyle = c; g.beginPath(); g.moveTo(0, hz);
      for (let x = 0; x <= w; x += 20) g.lineTo(x, hz - (Math.sin(x / 140 * f + f) * 0.5 + Math.sin(x / 57 * f) * 0.3 + 0.9) * 60 * hh * 1.6);
      g.lineTo(w, hz); g.fill();
    });
    // city glow
    const cg = g.createLinearGradient(0, hz - 30, 0, hz + 10); cg.addColorStop(0, '#0000'); cg.addColorStop(1, '#ff8a3a33');
    g.fillStyle = cg; g.fillRect(0, hz - 30, w, 40);
    // ground
    const gr = g.createLinearGradient(0, hz, 0, h); gr.addColorStop(0, '#07080f'); gr.addColorStop(1, '#0d1020');
    g.fillStyle = gr; g.fillRect(0, hz, w, h - hz);
    // road (curving)
    const curve = Math.sin(t * 0.35) * 0.6;
    g.fillStyle = '#16171d';
    g.beginPath();
    for (let i = 0; i <= 40; i++) { const z = i / 40, y = hz + (h - hz) * z * z, x = cx + curve * (1 - z) * (1 - z) * w * 0.35 - w * 0.6 * z * z - 6; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    for (let i = 40; i >= 0; i--) { const z = i / 40, y = hz + (h - hz) * z * z, x = cx + curve * (1 - z) * (1 - z) * w * 0.35 + w * 0.6 * z * z + 6; g.lineTo(x, y); }
    g.fill();
    // lane dashes and posts
    for (let i = 0; i < 18; i++) {
      const z = ((i / 18) + t * 0.6) % 1, zz = z * z;
      const y = hz + (h - hz) * zz, xo = curve * (1 - z) * (1 - z) * w * 0.35;
      g.fillStyle = '#e8b51c'; g.globalAlpha = Math.min(1, z * 2);
      g.fillRect(cx + xo - 2 - zz * 4, y, 4 + zz * 8, 2 + zz * 26);
      g.fillStyle = '#ff9f2a';
      g.fillRect(cx + xo - w * 0.62 * zz - 10, y - zz * 50, 3 + zz * 6, 3 + zz * 8);
      g.fillRect(cx + xo + w * 0.62 * zz + 6, y - zz * 50, 3 + zz * 6, 3 + zz * 8);
    }
    g.globalAlpha = 1;
    // light trails
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 6; k++) {
      const ph = ((t * 0.25 + k / 6) % 1), z = ph * ph;
      const red = k % 2;
      const xo = curve * (1 - ph) * (1 - ph) * w * 0.35 + (red ? -1 : 1) * w * 0.18 * z;
      const y = hz + (h - hz) * z;
      const grd = g.createRadialGradient(cx + xo, y, 0, cx + xo, y, 4 + z * 70);
      grd.addColorStop(0, red ? '#ff304088' : '#fff6d0aa'); grd.addColorStop(1, '#0000');
      g.fillStyle = grd; g.fillRect(cx + xo - 80, y - 80, 160, 160);
    }
    g.globalCompositeOperation = 'source-over';
    // darken for menu readability
    if (current && current !== 'title') { g.fillStyle = '#05060dc0'; g.fillRect(0, 0, w, h); }
  }

  // ---------- dialog (VN) ----------
  function dialog(script, bgKey, done) {
    const dl = $('#dialog');
    dl.classList.remove('hidden');
    let i = 0, typing = null, full = '';
    const bgc = { night: 'bg-night', dusk: 'bg-dusk', rain: 'bg-rain', fog: 'bg-fog' }[bgKey] || 'bg-night';
    dl.innerHTML = `<div class="dbg ${bgc}">${bgKey === 'rain' ? '<div class="rainfx"></div>' : ''}${bgKey === 'night' ? '<div class="stars"></div>' : ''}<div class="ridge"></div></div><button class="dskip">SKIP ▶▶</button><div class="pslot"></div><div class="dbox"><div class="who"></div><div class="txt"></div><div class="next">▼</div></div>`;
    Sound.playBGM('menu');
    const txt = $('.txt', dl), who = $('.who', dl), slot = $('.pslot', dl);
    function line() {
      if (i >= script.length) { finish(); return; }
      const [sp, raw] = script[i];
      const t = raw.replace(/\{NAME\}/g, save.name);
      const ch = D.CHARS[sp];
      if (sp === 'nar') { who.style.display = 'none'; slot.innerHTML = ''; txt.className = 'txt nar'; }
      else {
        who.style.display = ''; txt.className = 'txt';
        const nm = sp === 'me' ? save.name : ch.name;
        who.innerHTML = `${esc(nm)}${ch.title ? `<small>${esc(ch.title)}</small>` : ''}`;
        who.style.setProperty('--c', ch.color);
        const prevKey = slot.dataset.k;
        if (prevKey !== sp) {
          slot.dataset.k = sp;
          slot.innerHTML = `<div class="portrait ${sp === 'me' ? 'left' : 'right'}" style="--dx:${sp === 'me' ? '-40px' : '40px'}">${portraitSVG(sp)}</div>`;
          slot.style.display = 'flex'; slot.style.flexDirection = 'column';
        }
      }
      full = t; txt.textContent = '';
      let k = 0;
      clearInterval(typing);
      typing = setInterval(() => {
        k += 1; txt.textContent = full.slice(0, k);
        if (k % 3 === 0) Sound.blip(sp === 'nar' ? 520 : 760 + (sp.length * 40) % 200, 0.02, 'square', 0.025);
        if (k >= full.length) { clearInterval(typing); typing = null; }
      }, 28);
    }
    function adv(e) {
      if (e && e.target.closest('.dskip')) return;
      if (typing) { clearInterval(typing); typing = null; txt.textContent = full; return; }
      i++; line();
    }
    function finish() {
      clearInterval(typing);
      dl.removeEventListener('click', adv);
      dl.classList.add('hidden'); dl.innerHTML = '';
      done && done();
    }
    dl.addEventListener('click', adv);
    $('.dskip', dl).addEventListener('click', (e) => { e.stopPropagation(); finish(); });
    line();
  }

  // ---------- screen implementations ----------
  const SCREENS = {};

  SCREENS.title = function () {
    bg.on = true;
    const el = show(`<div class="logo"><span class="jp">峠</span><span class="en">SPIRITS</span><span class="sub">走り屋ストーリーRPG ― 峠・ドリフト編</span></div>
      <div class="tapstart">TAP TO START</div>
      <div class="credit">カードデータ: Top Drives (Hutch Games) / topdrives.club ・ ファンメイド非公式作品</div>`, 'title');
    el.addEventListener('click', () => {
      Sound.init(); Sound.setVolumes(save.settings.sfx, save.settings.bgm);
      Sound.chord([523, 784, 1046], 0.4, 'square', 0.08);
      Sound.playBGM('menu');
      go(save.started ? 'home' : 'setup');
    });
  };

  SCREENS.setup = function () {
    const starters = D.STARTERS.map(findCard).filter(Boolean);
    let pick = starters[0].id;
    const el = show(`<div class="topbar"><h1>はじめに</h1></div>
      <div class="panel" style="max-width:720px;margin:0 auto;width:100%">
        <div class="muted">ドライバー名</div>
        <input class="txt" id="nm" maxlength="10" value="${esc(save.name)}" style="text-transform:none;letter-spacing:1px">
        <div class="muted" style="margin-top:14px">じいさんの形見の車を選べ（スターターカード）</div>
        <div class="cardgrid" id="st" style="margin-top:8px">${starters.map((c) => UI.cardHTML(c, { sel: c.id === pick })).join('')}</div>
        <div style="margin-top:16px;text-align:right"><button class="btn primary" id="go">この車で走り出す ▶</button></div>
      </div>`);
    $('#st', el).addEventListener('click', (e) => {
      const c = e.target.closest('.tdcard'); if (!c) return;
      pick = +c.dataset.id; $$('.tdcard', el).forEach((x) => x.classList.toggle('sel', +x.dataset.id === pick)); Sound.blip(880, 0.04);
    });
    $('#go', el).addEventListener('click', () => {
      save.name = ($('#nm', el).value || 'ハヤト').trim().slice(0, 10);
      save.started = true; save.yen = 5000;
      addCard(BY_ID.get(pick)); save.main = pick;
      persist();
      const ch = D.CHAPTERS[0];
      runNode(ch, ch.nodes[0]);
    });
  };

  SCREENS.home = function () {
    bg.on = true;
    Sound.playBGM('menu');
    const mc = mainCard();
    const el = show(`<div class="topbar"><h1 style="font-family:var(--disp)">峠 SPIRITS</h1><div class="wallet"><span class="yen">${yen(save.yen)}</span><span class="rep">名声 ${save.rep}</span></div></div>
      <div class="home-main">
        <div class="panel">
          <div class="row" style="justify-content:space-between;margin-bottom:8px"><div><b style="font-size:20px">${esc(save.name)}</b> <span class="tag">${rankTitle(save.rep)}</span></div><span class="muted">戦績 ${save.stats.wins}勝 / ${save.stats.races}戦</span></div>
          <div class="preview3d" id="pv"><div class="pv-label">MY MACHINE</div></div>
          <div style="margin-top:10px;display:flex;justify-content:center">${UI.cardHTML(mc, { tune: tuneOf(mc.id) })}</div>
        </div>
        <div class="menu">
          <button class="mbtn story" data-go="story"><b>ストーリー</b><small>${esc(nextStoryLabel())}</small><span class="ico">🏁</span></button>
          <button class="mbtn" data-go="free"><b>フリーバトル</b><small>野良バトルで賞金稼ぎ</small><span class="ico">⚔️</span></button>
          <button class="mbtn online" data-go="online"><b>オンライン対戦</b><small>ルームコードで友達とバトル</small><span class="ico">🌐</span></button>
          <button class="mbtn" data-go="garage"><b>ガレージ</b><small>${Object.keys(save.cards).length}台 所持 ・ チューニング</small><span class="ico">🔧</span></button>
          <button class="mbtn" data-go="shop"><b>カードショップ</b><small>${packCount() ? `未開封パック ${packCount()}個！` : 'カードパックを購入'}</small><span class="ico">🃏</span></button>
          <button class="mbtn" data-go="settings"><b>設定</b><small>サウンド・アシスト</small><span class="ico">⚙️</span></button>
        </div>
      </div>`, 'home');
    bindGo(el);
    try { Race.preview($('#pv', el), mc); $('#pv', el).insertAdjacentHTML('beforeend', '<div class="pv-label">MY MACHINE</div>'); } catch (e) { console.warn(e); }
  };
  const packCount = () => Object.values(save.packs).reduce((a, b) => a + b, 0);
  function nextStoryLabel() {
    for (const ch of D.CHAPTERS) for (const n of ch.nodes) if (!save.done[n.id]) return `${ch.title} ― ${n.title}`;
    return '全章クリア！ リプレイ可能';
  }
  function nodeState(ch, ci, ni) {
    const n = ch.nodes[ni];
    if (save.done[n.id]) return 'done';
    const prevCh = D.CHAPTERS[ci - 1];
    if (prevCh && !prevCh.nodes.every((x) => save.done[x.id])) return 'locked';
    if (ni > 0 && !save.done[ch.nodes[ni - 1].id]) return 'locked';
    return 'next';
  }

  SCREENS.story = function () {
    const el = show(topbar('ストーリー') + `<div class="chapters">${D.CHAPTERS.map((ch, ci) => {
      const locked = nodeState(ch, ci, 0) === 'locked';
      const c = D.COURSES[ch.course];
      return `<div class="chapter ${locked ? 'locked' : ''}"><div class="ch-head bg-${ch.bg}"><h2>${ch.title}</h2><div class="muted">${c.name}（${D.THEMES[c.theme].label}）― ${c.desc}</div></div>
        <div class="nodes">${ch.nodes.map((n, ni) => {
          const st = nodeState(ch, ci, ni);
          const icon = n.type === 'story' ? '💬' : n.boss ? '👑' : n.format === 'chase' ? '🎯' : n.format === 'ta' ? '⏱' : '🏁';
          const sub = n.type === 'story' ? 'ストーリー' : `${{ battle: 'バトル', chase: '後追い', ta: 'タイムアタック' }[n.format]}${n.car ? ' ・ ' + esc(findCard(n.car)?.model || '') : ''}${n.req ? ' ・ <span class="req">' + reqText(n.req) + '</span>' : ''}`;
          return `<div class="node ${st} ${n.boss ? 'boss' : ''}" data-c="${ci}" data-n="${ni}"><div class="dot">${st === 'done' ? '✔' : icon}</div><div class="nt"><b>${esc(n.title)}</b><small>${sub}</small></div></div>`;
        }).join('')}</div></div>`;
    }).join('')}</div>`);
    bindGo(el);
    $$('.node', el).forEach((nd) => nd.addEventListener('click', () => {
      const ch = D.CHAPTERS[+nd.dataset.c], n = ch.nodes[+nd.dataset.n];
      Sound.blip(880, 0.05); runNode(ch, n);
    }));
  };
  const reqText = (r) => [r.maxRQ ? `RQ${r.maxRQ}以下` : '', r.drive ? `${DRIVE_JP[r.drive]}限定` : ''].filter(Boolean).join(' ');
  const reqOK = (r, c) => !r || ((!r.maxRQ || c.rq <= r.maxRQ) && (!r.drive || c.drive === r.drive));

  function runNode(ch, n) {
    if (n.type === 'story') {
      dialog(n.script, ch.bg, () => {
        const first = !save.done[n.id];
        save.done[n.id] = true;
        if (first && n.reward) giveReward(n.reward);
        persist();
        go('story');
      });
      return;
    }
    const rc = n.car ? findCard(n.car) : null;
    go('prerace', {
      title: n.title, courseId: ch.course, format: n.format, target: n.target, req: n.req, boss: n.boss, tutorial: n.tutorial,
      rival: rc ? { name: D.CHARS[n.rival].name, key: n.rival, card: rc, tune: n.tune || [0, 0, 0], skill: n.skill } : null,
      reward: n.reward, pre: n.pre, post: n.post, node: n, chapter: ch,
    });
  }
  function giveReward(r, mult = 1) {
    const out = [];
    if (r.yen) { const y = Math.round(r.yen * mult); save.yen += y; out.push(`💴 ${yen(y)}`); }
    if (r.rep) { const p = Math.round(r.rep * mult); save.rep += p; out.push(`⭐ 名声 +${p}`); }
    if (r.pack && mult >= 1) { save.packs[r.pack] = (save.packs[r.pack] || 0) + 1; out.push(`🃏 ${D.PACKS[r.pack].name}`); }
    if (r.card && mult >= 1) { const c = findCard(r.card); if (c) { addCard(c); out.push(`🏆 ${c.make} ${c.model}`); } }
    return out;
  }

  // ---------- pre-race VS ----------
  SCREENS.prerace = function (ctx) {
    const mc = mainCard();
    const course = D.COURSES[ctx.courseId], th = D.THEMES[course.theme];
    const ok = reqOK(ctx.req, mc);
    const rule = { battle: 'ダウンヒルバトル：先にゴールした方の勝ち', chase: '後追いバトル：相手の後ろからスタート。ゴール時の差が1.0秒以内なら勝ち（抜けば当然勝ち）', ta: `タイムアタック：目標タイム ${Race.fmtTime(ctx.target)} 以内でゴール` }[ctx.format];
    const rv = ctx.rival;
    const el = show(topbar(esc(ctx.title), ctx.free ? 'free' : 'story') + `
      <div class="panel">
        <div class="row" style="justify-content:space-between"><div><b style="font-size:18px">${course.name}</b> <span class="muted">${course.en}</span></div><span class="tag">${th.label}${th.wet ? ' ・ ウェット' : ''}</span></div>
        <div class="rule">${rule}</div>
        ${ctx.req ? `<div class="req ${ok ? '' : 'bad'}">出走条件：${reqText(ctx.req)} ${ok ? '✔' : '✖ 条件を満たす車に変更してください'}</div>` : ''}
        <div class="vs">
          <div class="side l"><div class="pname">${esc(save.name)}</div><div class="ptitle">${rankTitle(save.rep)}</div>${UI.cardHTML(mc, { tune: tuneOf(mc.id) })}</div>
          <div class="vsmark">${rv ? 'VS' : '⏱'}</div>
          <div class="side r">${rv ? `<div class="pname" style="color:${D.CHARS[rv.key]?.color || '#fff'}">${esc(rv.name)}</div><div class="ptitle">${esc(D.CHARS[rv.key]?.title || '野良の走り屋')}</div>${UI.cardHTML(rv.card, { tune: rv.tune })}` : `<div class="pname">TARGET</div><div class="code">${Race.fmtTime(ctx.target)}</div>`}</div>
        </div>
        <div class="row" style="justify-content:flex-end">
          <button class="btn" id="chg">🔧 車を変更</button>
          <button class="btn primary" id="start" ${ok ? '' : 'disabled'}>START ▶</button>
        </div>
      </div>`);
    bindGo(el);
    $('#chg', el).addEventListener('click', () => pickCar(ctx.req, () => go('prerace', ctx)));
    $('#start', el).addEventListener('click', () => {
      Sound.chord([440, 660, 880], 0.3, 'sawtooth', 0.08);
      const run = () => startRace(ctx);
      if (ctx.pre && !ctx._preShown) { ctx._preShown = true; dialog(ctx.pre, ctx.chapter ? ctx.chapter.bg : course.theme, run); }
      else run();
    });
  };

  function pickCar(req, back) {
    const ov = $('#overlay'); ov.classList.remove('hidden');
    const owned = Object.keys(save.cards).map((id) => BY_ID.get(+id)).filter(Boolean).sort((a, b) => b.rq - a.rq);
    ov.innerHTML = `<div class="panel" style="width:min(1000px,100%);max-height:90vh;overflow:auto"><div class="topbar"><h1>車を選択</h1>${req ? `<span class="req">${reqText(req)}</span>` : ''}<button class="back" id="cl">✕</button></div>
      <div class="cardgrid">${owned.map((c) => UI.cardHTML(c, { tune: tuneOf(c.id), sel: c.id === save.main, locked: !reqOK(req, c) })).join('')}</div></div>`;
    $('#cl', ov).onclick = () => { ov.classList.add('hidden'); back(); };
    $$('.tdcard', ov).forEach((x) => x.addEventListener('click', () => {
      const c = BY_ID.get(+x.dataset.id);
      if (!reqOK(req, c)) { UI.toast('出走条件を満たしていません'); return; }
      save.main = c.id; persist(); Sound.blip(880, 0.05);
      ov.classList.add('hidden'); back();
    }));
  }

  // ---------- race ----------
  function startRace(ctx, net) {
    bg.on = false;
    $('#screens').classList.add('hidden');
    const rc = $('#race'); rc.classList.remove('hidden');
    if (!startRace.mounted) { Race.mount(rc); startRace.mounted = true; }
    const mc = mainCard();
    Race.start({
      courseId: ctx.courseId, format: ctx.format, target: ctx.target, boss: ctx.boss, tutorial: ctx.tutorial,
      player: { name: save.name, card: mc, tune: tuneOf(mc.id) },
      rival: ctx.rival ? { name: ctx.rival.name, card: ctx.rival.card, tune: ctx.rival.tune, skill: ctx.rival.skill, remote: !!net } : null,
      assist: save.settings.assist, camMode: save.settings.cam, net: !!net, side: net && Net.role === 'guest' ? 'right' : 'left', seed: ctx.seed || (Math.random() * 1e6) | 0,
      autoPlay: window.__AUTOPLAY || null,
      onFinish: (res) => { $('#race').classList.add('hidden'); $('#screens').classList.remove('hidden'); bg.on = true; (ctx.onResult || result)(ctx, res); },
    });
  }

  function result(ctx, res) {
    save.stats.races++;
    if (res.win) save.stats.wins++;
    if (res.time && (!save.stats.best[ctx.courseId] || res.time < save.stats.best[ctx.courseId])) save.stats.best[ctx.courseId] = res.time;
    let rewards = [];
    const first = ctx.node && !save.done[ctx.node.id];
    if (res.win && ctx.reward) rewards = giveReward(ctx.reward, first || !ctx.node ? 1 : 0.3);
    else if (!res.win && !res.retired && ctx.reward && ctx.reward.yen) rewards = giveReward({ yen: ctx.reward.yen * 0.2 }, 1);
    const scoreBonus = res.retired ? 0 : Math.round(res.score / 20);
    if (scoreBonus) { save.yen += scoreBonus; rewards.push(`🔥 ドリフトボーナス ${yen(scoreBonus)}`); }
    if (res.win && ctx.node) save.done[ctx.node.id] = true;
    persist();
    Sound.playBGM('menu');
    Sound.fanfare(res.win);
    const c = res.counts || {};
    const el = show(`<div class="stamp ${res.win ? 'win' : 'lose'}">${res.retired ? 'RETIRE' : res.win ? 'WIN!!' : 'LOSE'}</div>
      <div class="muted" style="margin-top:6px">${esc(ctx.title || '')}</div>
      <table class="rtable">
        <tr><td>あなたのタイム</td><td>${Race.fmtTime(res.time)}</td></tr>
        ${res.rivalTime != null ? `<tr><td>${esc(ctx.rival ? ctx.rival.name : 'RIVAL')}</td><td>${Race.fmtTime(res.rivalTime)}</td></tr>` : ''}
        ${res.format === 'ta' ? `<tr><td>目標タイム</td><td>${Race.fmtTime(res.target)}</td></tr>` : ''}
        ${res.format === 'chase' && res.rivalTime != null && res.time ? `<tr><td>ゴール差</td><td>${(res.time - res.rivalTime).toFixed(2)}s ${res.time - res.rivalTime <= 1 ? '✔' : '✖'}</td></tr>` : ''}
        <tr><td>ドリフトスコア</td><td>${(res.score || 0).toLocaleString()}</td></tr>
        <tr><td>最大コンボ</td><td>${res.maxCombo || 0}</td></tr>
      </table>
      <div class="judgecount"><span class="jc-p">PERFECT ${c.PERFECT || 0}</span><span class="jc-g">GREAT ${c.GREAT || 0}</span><span class="jc-o">GOOD ${c.GOOD || 0}</span><span class="jc-m">MISS ${c.MISS || 0}</span></div>
      <div class="rewards">${rewards.map((r, i) => `<div style="animation-delay:${0.3 + i * 0.15}s">${esc(r)}</div>`).join('')}</div>
      ${!res.win && !res.retired ? `<div class="muted" style="max-width:520px;margin:0 auto 14px">ヒント：${hint(res)}</div>` : ''}
      <div class="row" style="justify-content:center">
        <button class="btn" id="again">もう一度</button>
        <button class="btn primary" id="next">次へ ▶</button>
      </div>`, 'result');
    $('#again', el).addEventListener('click', () => { ctx._preShown = true; go('prerace', ctx); });
    $('#next', el).addEventListener('click', () => {
      const after = () => { if (packCount() && ctx.node && ctx.reward && ctx.reward.pack && res.win) go('shop'); else go(ctx.free ? 'free' : ctx.node ? 'story' : 'home'); };
      if (res.win && first && ctx.post) dialog(ctx.post, ctx.chapter ? ctx.chapter.bg : 'night', after);
      else after();
    });
  }
  function hint(res) {
    const c = res.counts || {};
    if ((c.MISS || 0) >= 3) return 'MISSが多いぞ。リングが白い輪に重なった瞬間を狙え。早すぎ・遅すぎどちらもスピードを大きく失う。';
    if ((c.PERFECT || 0) < 6) return 'PERFECTの進入は最大13%速くコーナーを抜けられる。出口のリリースもPERFECTならブーストがかかる！';
    return '車の性能差かもしれない。ガレージでチューニングするか、カードショップでより高いRQの車を手に入れよう。';
  }

  // ---------- garage ----------
  let gFilter = { grade: 'ALL', drive: 'ALL' };
  SCREENS.garage = function () {
    const owned = Object.keys(save.cards).map((id) => BY_ID.get(+id)).filter(Boolean)
      .filter((c) => (gFilter.grade === 'ALL' || c.grade === gFilter.grade) && (gFilter.drive === 'ALL' || c.drive === gFilter.drive))
      .sort((a, b) => b.rq - a.rq);
    const el = show(topbar(`ガレージ <span class="muted">${Object.keys(save.cards).length} / ${CARDS.length}</span>`) + `
      <div class="filters">${['ALL', ...GRADES].map((g) => `<button data-g="${g}" class="${gFilter.grade === g ? 'on' : ''}">${g}</button>`).join('')}
      <span style="width:10px"></span>${['ALL', 'rwd', 'fwd', '4wd'].map((d) => `<button data-d="${d}" class="${gFilter.drive === d ? 'on' : ''}">${d === 'ALL' ? '全駆動' : DRIVE_JP[d]}</button>`).join('')}</div>
      <div class="cardgrid">${owned.map((c) => UI.cardHTML(c, { tune: tuneOf(c.id), sel: c.id === save.main, count: save.cards[c.id].n })).join('') || '<div class="muted">該当する車がありません</div>'}</div>`);
    bindGo(el);
    $$('[data-g]', el).forEach((b) => b.onclick = () => { gFilter.grade = b.dataset.g; go('garage'); });
    $$('[data-d]', el).forEach((b) => b.onclick = () => { gFilter.drive = b.dataset.d; go('garage'); });
    $$('.cardgrid .tdcard', el).forEach((x) => x.addEventListener('click', () => go('detail', +x.dataset.id)));
  };
  const tuneCost = (card, lvl) => Math.round((600 + card.rq * 45) * lvl * (card.grade === 'S' ? 1.6 : card.grade === 'A' ? 1.3 : 1));
  SCREENS.detail = function (id) {
    const c = BY_ID.get(id), own = save.cards[id];
    const st = window.TougeSim.carStats(c, own.tune, false);
    const bar = (lbl, v, max, txt) => `<div class="sb"><span>${lbl}</span><div class="bar"><i style="width:${Math.min(100, v / max * 100)}%"></i></div><b>${txt}</b></div>`;
    const el = show(topbar(`${esc(c.make)} ${esc(c.model)}`, 'garage') + `
      <div class="detail">
        <div class="panel"><div class="preview3d" id="pv" style="height:250px"></div><div style="margin-top:10px;display:flex;justify-content:center">${UI.cardHTML(c, { tune: own.tune, count: own.n })}</div></div>
        <div class="panel">
          <div class="statbars">
            ${bar('最高速', st.top * 3.6, 330, Math.round(st.top * 3.6) + 'km/h')}
            ${bar('加速', 1 / st.acc, 1 / 2.4, st.acc.toFixed(1) + 's')}
            ${bar('グリップ', st.mu * 100, 110, (st.mu * 100).toFixed(0))}
            ${bar('ブレーキ', st.dec, 12, st.dec.toFixed(1))}
            ${bar('判定幅', st.win, 1.3, '×' + st.win.toFixed(2))}
          </div>
          <div class="muted" style="margin:8px 0">駆動方式：${DRIVE_JP[c.drive]} — ${{ rwd: 'ドリフト角が大きくスコア倍率×1.2', '4wd': 'タイミング判定が広く安定（×1.25）', fwd: '判定やや広め。スコア倍率×0.8' }[c.drive] || ''}</div>
          <h3 style="margin:14px 0 4px">チューニング</h3>
          ${D.TUNE_NAMES.map(([n, sub], k) => {
            const lv = own.tune[k], cost = lv < 3 ? tuneCost(c, lv + 1) : 0;
            return `<div class="tune-row"><div class="nm"><b>${n}</b><span class="muted">${sub}</span></div><div class="pips">${[0, 1, 2].map((i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>
              <button class="btn ${lv < 3 && save.yen >= cost ? 'gold' : ''}" data-t="${k}" ${lv >= 3 || save.yen < cost ? 'disabled' : ''}>${lv >= 3 ? 'MAX' : yen(cost)}</button></div>`;
          }).join('')}
          <div class="row" style="margin-top:14px;justify-content:space-between">
            ${own.n > 1 ? `<button class="btn" id="sell">重複を売却 (+${yen(c.rq * 120 * (own.n - 1))})</button>` : '<span></span>'}
            <button class="btn primary" id="main" ${save.main === id ? 'disabled' : ''}>${save.main === id ? '使用中' : 'メインに設定'}</button>
          </div>
        </div>
      </div>`);
    bindGo(el);
    try { Race.preview($('#pv', el), c); } catch (e) { console.warn(e); }
    $$('[data-t]', el).forEach((b) => b.addEventListener('click', () => {
      const k = +b.dataset.t, lv = own.tune[k], cost = tuneCost(c, lv + 1);
      if (lv >= 3 || save.yen < cost) return;
      save.yen -= cost; own.tune[k]++; persist();
      Sound.chord([523, 659, 784], 0.2, 'square', 0.07); UI.toast(`${D.TUNE_NAMES[k][0]} Lv${own.tune[k]} にアップグレード！`);
      go('detail', id);
    }));
    $('#main', el).addEventListener('click', () => { save.main = id; persist(); UI.toast('メインカーに設定しました'); go('detail', id); });
    const sell = $('#sell', el);
    if (sell) sell.addEventListener('click', () => { save.yen += c.rq * 120 * (own.n - 1); own.n = 1; persist(); Sound.blip(1200, 0.1); go('detail', id); });
  };

  // ---------- shop / packs ----------
  SCREENS.shop = function () {
    const el = show(topbar('カードショップ') + `<div class="muted" style="margin-bottom:10px">Top Drives の日本車カードを収集しよう。重複カードはガレージで売却できます。</div>
      <div class="packs">${Object.entries(D.PACKS).map(([k, p]) => `<div class="pack" style="--pc:${p.color}">
        ${save.packs[k] ? `<div class="owned">×${save.packs[k]}</div>` : ''}
        <div class="pk-logo">峠</div><h3>${p.name}</h3>
        <div class="odds">${Object.entries(p.odds).map(([g, o]) => `${g}:${o}%`).join(' ')}<br>${p.n}枚入り</div>
        ${save.packs[k] ? `<button class="btn primary" data-open="${k}" style="width:100%;margin-bottom:6px">開封する</button>` : ''}
        <button class="btn" data-buy="${k}" style="width:100%" ${save.yen < p.price ? 'disabled' : ''}>${yen(p.price)} で購入</button>
      </div>`).join('')}</div>`);
    bindGo(el);
    $$('[data-buy]', el).forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.buy, p = D.PACKS[k];
      if (save.yen < p.price) return;
      save.yen -= p.price; persist(); openPack(k, () => go('shop'));
    }));
    $$('[data-open]', el).forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.open; save.packs[k]--; if (!save.packs[k]) delete save.packs[k]; persist(); openPack(k, () => go('shop'));
    }));
  };
  function drawCard(odds) {
    const tot = Object.values(odds).reduce((a, b) => a + b, 0);
    let x = Math.random() * tot, g = 'F';
    for (const [k, v] of Object.entries(odds)) { if (x < v) { g = k; break; } x -= v; }
    const pool = CARDS.filter((c) => c.grade === g);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function openPack(k, done) {
    const P = D.PACKS[k];
    const got = Array.from({ length: P.n }, () => drawCard(P.odds));
    const isNew = got.map((c) => addCard(c));
    persist();
    const best = got.reduce((a, c) => GRADES.indexOf(c.grade) > GRADES.indexOf(a.grade) ? c : a, got[0]);
    const ov = $('#overlay'); ov.classList.remove('hidden');
    ov.innerHTML = `<div class="opening"><div class="muted">${P.name}</div><div class="bigpack" style="--pc:${P.color}">峠<br>PACK</div><div class="muted">タップして開封</div></div>`;
    Sound.playBGM('menu');
    $('.bigpack', ov).addEventListener('click', () => {
      const bc = D.GRADE_COLORS[best.grade];
      const beam = document.createElement('div'); beam.className = 'beam'; beam.style.setProperty('--bc', bc); document.body.appendChild(beam);
      setTimeout(() => beam.remove(), 1100);
      Sound.whoosh(); Sound.noiseBurst(0.6, 1500, 0.6, 0.4);
      const rare = ['A', 'S'].includes(best.grade);
      ov.innerHTML = `<div class="opening">${rare ? '<div class="srare">SUPER RARE!!</div>' : ''}<div class="reveal">${got.map((c, i) => `<div class="flip ${['B', 'A', 'S'].includes(c.grade) ? 'rare' : ''}" data-i="${i}" style="--gc:${D.GRADE_COLORS[c.grade]}"><div class="face back">TD</div><div class="face front">${isNew[i] ? '<div class="newtag">NEW</div>' : ''}${UI.cardHTML(c)}</div></div>`).join('')}</div><button class="btn primary" id="ok" style="opacity:0">OK</button></div>`;
      const flips = $$('.flip', ov);
      flips.forEach((f, i) => setTimeout(() => {
        f.classList.add('open');
        const g = got[i].grade;
        if (['A', 'S'].includes(g)) Sound.chord([523, 659, 784, 1046, 1318], 0.5, 'square', 0.09);
        else if (g === 'B') Sound.chord([659, 880, 1046], 0.3, 'square', 0.07);
        else Sound.blip(700 + GRADES.indexOf(g) * 80, 0.08);
      }, 500 + i * 550));
      setTimeout(() => { const ok = $('#ok', ov); ok.style.opacity = 1; ok.onclick = () => { ov.classList.add('hidden'); ov.innerHTML = ''; done && done(); }; }, 600 + flips.length * 550);
    }, { once: true });
  }

  // ---------- free battle ----------
  const RIVAL_NAMES = ['野良の走り屋 タカシ', '峠の常連 ジュン', '夜走りのマサ', 'ギャラリー上がりのコウ', '走り屋見習い ショウタ', '赤テールのリョウ', 'ダウンヒラー ケイ', 'スキール音のアヤ', '峠狩りのヒロ', '流しのダイスケ'];
  function unlockedCourses() {
    const list = [];
    D.CHAPTERS.forEach((ch, ci) => { if (nodeState(ch, ci, 0) !== 'locked' || save.done[ch.nodes[0].id]) list.push(ch.course); });
    return [...new Set(list)];
  }
  let freeSel = { course: 'kirizaka', diff: 'normal' };
  SCREENS.free = function () {
    const cs = unlockedCourses();
    if (!cs.includes(freeSel.course)) freeSel.course = cs[0];
    const mc = mainCard();
    const DIFF = { easy: ['EASY', '格下 ・ 賞金×0.6'], normal: ['NORMAL', '同格 ・ 賞金×1.0'], hard: ['HARD', '格上 ・ 賞金×1.7'] };
    const el = show(topbar('フリーバトル') + `<div class="panel">
      <div class="muted">コース（ストーリーで解放）</div>
      <div class="filters" style="margin-top:6px">${Object.entries(D.COURSES).map(([k, c]) => `<button data-c="${k}" class="${freeSel.course === k ? 'on' : ''}" ${cs.includes(k) ? '' : 'disabled style="opacity:.35"'}>${c.name}${save.stats.best[k] ? ` (${Race.fmtTime(save.stats.best[k])})` : ''}</button>`).join('')}</div>
      <div class="muted" style="margin-top:10px">相手の強さ</div>
      <div class="filters" style="margin-top:6px">${Object.entries(DIFF).map(([k, [a, b]]) => `<button data-d="${k}" class="${freeSel.diff === k ? 'on' : ''}">${a} <small>${b}</small></button>`).join('')}</div>
      <div class="row" style="margin-top:10px;gap:14px;align-items:flex-start">${UI.cardHTML(mc, { tune: tuneOf(mc.id) })}
        <div style="flex:1;min-width:200px"><div class="muted">${D.COURSES[freeSel.course].desc}</div>
        <div class="row" style="margin-top:14px"><button class="btn" id="chg">🔧 車を変更</button><button class="btn" id="ta">⏱ タイムアタック</button><button class="btn primary" id="go">相手を探す ▶</button></div></div></div>
    </div>`);
    bindGo(el);
    $$('[data-c]', el).forEach((b) => b.onclick = () => { freeSel.course = b.dataset.c; go('free'); });
    $$('[data-d]', el).forEach((b) => b.onclick = () => { freeSel.diff = b.dataset.d; go('free'); });
    $('#chg', el).onclick = () => pickCar(null, () => go('free'));
    $('#ta', el).onclick = () => {
      const best = save.stats.best[freeSel.course];
      go('prerace', { title: 'タイムアタック', courseId: freeSel.course, format: 'ta', target: best ? Math.floor(best * 100) / 100 : 90, free: true, reward: { yen: 1000 } });
    };
    $('#go', el).onclick = () => {
      const [lo, hi, sk, mult] = { easy: [-12, -3, 0.35, 0.6], normal: [-3, 3, 0.55, 1], hard: [3, 10, 0.72, 1.7] }[freeSel.diff];
      let pool = CARDS.filter((c) => c.tyre !== 'off' && c.tyre !== 'slick' && c.rq >= mc.rq + lo && c.rq <= mc.rq + hi);
      if (!pool.length) pool = CARDS.filter((c) => c.tyre !== 'off');
      const rc = pool[Math.floor(Math.random() * pool.length)];
      const nm = RIVAL_NAMES[Math.floor(Math.random() * RIVAL_NAMES.length)];
      const fmt = Math.random() < 0.25 ? 'chase' : 'battle';
      go('prerace', { title: `フリーバトル VS ${nm}`, courseId: freeSel.course, format: fmt, free: true, rival: { name: nm, key: 'free', card: rc, tune: [Math.floor(Math.random() * 3), Math.floor(Math.random() * 3), Math.floor(Math.random() * 3)], skill: sk + Math.random() * 0.1 }, reward: { yen: Math.round((1500 + rc.rq * 60) * mult), rep: Math.round(3 * mult) } });
    };
  };

  // ---------- online ----------
  const ON = { opp: null, status: '', log: [], course: 'kirizaka', sendT: 0, inRace: false };
  function onlineHandlers() {
    Net.on.status = (s) => { ON.status = s; if (current === 'online') renderOnline(); };
    Net.on.error = (e) => { ON.status = '⚠ ' + (e.message || e.type || 'エラー'); if (current === 'online') renderOnline(); };
    Net.on.open = () => { sendHello(); if (current === 'online') renderOnline(); };
    Net.on.close = () => { ON.opp = null; if (ON.inRace) Race.netGone(); if (current === 'online') renderOnline(); };
    Net.on.msg = (m) => {
      if (m.t === 'hello') { ON.opp = { name: String(m.name || 'RIVAL').slice(0, 12), card: BY_ID.get(m.id) || CARDS[CARDS.length - 1], tune: (m.tune || [0, 0, 0]).map((x) => Math.max(0, Math.min(3, x | 0))) }; if (current === 'online') renderOnline(); }
      else if (m.t === 'start' && Net.role === 'guest') beginOnline(m.course, m.seed);
      else if (m.t === 'st' && ON.inRace) Race.netState(m);
      else if (m.t === 'full') { ON.status = 'このルームは満員です'; renderOnline(); }
    };
  }
  function sendHello() { const mc = mainCard(); Net.send({ t: 'hello', name: save.name, id: mc.id, tune: tuneOf(mc.id) }); }
  SCREENS.online = function () { onlineHandlers(); renderOnline(); };
  function renderOnline() {
    current = 'online';
    const mc = mainCard();
    const conn = Net.connected();
    const el = show(topbar('オンライン対戦') + `<div class="panel">
      <div class="muted">WebRTC (PeerJS) による P2P 対戦。ルームを作ってコードを相手に伝えるか、コードを入力して参加します。</div>
      ${!Net.peer ? `<div class="row" style="margin-top:14px;align-items:stretch">
          <button class="btn primary" id="host">ルームを作る</button>
          <div style="display:flex;gap:8px;flex:1;min-width:240px"><input class="txt" id="code" maxlength="5" placeholder="コード"><button class="btn cyan" id="join">参加</button></div>
        </div>` : `<div style="margin-top:12px">${Net.role === 'host' ? `<div class="muted">ルームコード</div><div class="code">${Net.code}</div>` : `<div class="muted">参加中のルーム：<b>${esc(Net.code)}</b></div>`}
          <div class="row" style="margin-top:8px"><span class="tag">${conn ? '🟢 接続中' : '🟡 待機中'}</span><button class="btn" id="leave">退出</button></div></div>`}
      <div class="muted" style="margin-top:10px">${esc(ON.status)}</div>
      <div class="vs">
        <div class="side l"><div class="pname">${esc(save.name)}</div>${UI.cardHTML(mc, { tune: tuneOf(mc.id) })}<button class="btn" id="chg">🔧 車を変更</button></div>
        <div class="vsmark">VS</div>
        <div class="side r">${ON.opp && conn ? `<div class="pname">${esc(ON.opp.name)}</div>${UI.cardHTML(ON.opp.card, { tune: ON.opp.tune })}` : '<div class="muted">対戦相手を待っています…</div>'}</div>
      </div>
      ${conn && ON.opp ? (Net.role === 'host' ? `<div class="muted">コース選択</div><div class="filters" style="margin-top:6px">${Object.entries(D.COURSES).map(([k, c]) => `<button data-c="${k}" class="${ON.course === k ? 'on' : ''}">${c.name}</button>`).join('')}</div>
        <div style="text-align:right"><button class="btn primary" id="startOn">バトル開始 ▶</button></div>` : '<div class="muted" style="text-align:center">ホストがコースを選んでスタートするのを待っています…</div>') : ''}
      </div>`);
    bindGo(el);
    const h = $('#host', el); if (h) h.onclick = () => { Sound.init(); Net.host(); renderOnline(); };
    const j = $('#join', el); if (j) j.onclick = () => { const c = $('#code', el).value.trim(); if (c.length < 4) { UI.toast('コードを入力してください'); return; } Sound.init(); Net.join(c); renderOnline(); };
    const lv = $('#leave', el); if (lv) lv.onclick = () => { Net.leave(); ON.opp = null; ON.status = ''; renderOnline(); };
    $('#chg', el).onclick = () => pickCar(null, () => { sendHello(); renderOnline(); });
    $$('[data-c]', el).forEach((b) => b.onclick = () => { ON.course = b.dataset.c; renderOnline(); });
    const st = $('#startOn', el);
    if (st) st.onclick = () => { const seed = (Math.random() * 1e6) | 0; Net.send({ t: 'start', course: ON.course, seed }); beginOnline(ON.course, seed); };
  }
  function beginOnline(course, seed) {
    if (!ON.opp) return;
    ON.inRace = true;
    const ctx = {
      title: `オンライン VS ${ON.opp.name}`, courseId: course, format: 'battle', seed, online: true,
      rival: { name: ON.opp.name, key: 'free', card: ON.opp.card, tune: ON.opp.tune, skill: 0.5 },
      onResult: (c, res) => {
        ON.inRace = false; clearInterval(ON.sendT);
        save.stats.online++; if (res.win) { save.stats.onlineWins++; save.yen += 3000; save.rep += 5; }
        persist();
        Sound.fanfare(res.win); Sound.playBGM('menu');
        const el = show(`<div class="stamp ${res.win ? 'win' : 'lose'}">${res.win ? 'WIN!!' : 'LOSE'}</div>
          <table class="rtable"><tr><td>${esc(save.name)}</td><td>${Race.fmtTime(res.time)}</td></tr><tr><td>${esc(ON.opp ? ON.opp.name : 'RIVAL')}</td><td>${res.rivalTime != null ? Race.fmtTime(res.rivalTime) : '切断'}</td></tr>
          <tr><td>ドリフトスコア</td><td>${res.score.toLocaleString()}</td></tr><tr><td>オンライン戦績</td><td>${save.stats.onlineWins}勝 / ${save.stats.online}戦</td></tr></table>
          ${res.win ? '<div class="rewards"><div>💴 ¥3,000</div><div>⭐ 名声 +5</div></div>' : ''}
          <button class="btn primary" id="lobby">ロビーへ戻る</button>`, 'result');
        $('#lobby', el).onclick = () => renderOnline();
      },
    };
    startRace(ctx, true);
    clearInterval(ON.sendT);
    ON.sendT = setInterval(() => { if (Race.isRunning()) Net.send(Object.assign({ t: 'st' }, Race.humanState())); else if (!ON.inRace) clearInterval(ON.sendT); }, 66);
  }

  // ---------- settings ----------
  SCREENS.settings = function () {
    const S2 = save.settings;
    const tog = (k, label, sub) => `<div class="tune-row"><div class="nm"><b>${label}</b><span class="muted">${sub}</span></div><button class="btn ${S2[k] ? 'cyan' : ''}" data-k="${k}">${S2[k] ? 'ON' : 'OFF'}</button></div>`;
    const el = show(topbar('設定') + `<div class="panel" style="max-width:640px;margin:0 auto;width:100%">
      ${tog('bgm', 'BGM', 'ユーロビート風BGM')}
      ${tog('sfx', '効果音', 'エンジン音・スキール音など')}
      ${tog('assist', '初心者アシスト', 'タイミング判定を1.4倍に広げる')}
      ${tog('img', 'カード画像', 'topdrives.club から車の写真を読み込む（OFFでシルエット表示）')}
      <div class="tune-row"><div class="nm"><b>カメラ</b><span class="muted">レース中は📷ボタン / Cキーでも切替</span></div><select class="sel" id="cam">${[['chase', '追従'], ['top', '俯瞰 (Top Drives風)'], ['hood', 'ボンネット']].map(([k, n]) => `<option value="${k}" ${S2.cam === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="tune-row"><div class="nm"><b>ドライバー名</b></div><input class="txt" id="nm" maxlength="10" value="${esc(save.name)}" style="max-width:200px;text-transform:none;letter-spacing:1px;font-size:15px"></div>
      <div class="muted" style="margin:14px 0">操作：タップ/クリック/Space = ドリフト（押して進入・離して脱出） ・ N₂Oボタン/Xキー = ニトロ ・ C = カメラ ・ Esc = ポーズ</div>
      <div class="row" style="justify-content:space-between"><button class="btn" id="reset" style="color:var(--red)">セーブデータ削除</button><button class="btn primary" data-go="home">保存して戻る</button></div>
    </div>`);
    bindGo(el);
    $$('[data-k]', el).forEach((b) => b.onclick = () => { S2[b.dataset.k] = !S2[b.dataset.k]; Sound.setVolumes(S2.sfx, S2.bgm); persist(); go('settings'); });
    $('#cam', el).onchange = (e) => { S2.cam = e.target.value; persist(); };
    $('#nm', el).onchange = (e) => { save.name = (e.target.value || 'ハヤト').trim().slice(0, 10); persist(); };
    $('#reset', el).onclick = () => { if (confirm('本当にセーブデータを削除しますか？')) { try { localStorage.removeItem(KEY); } catch (_) {} save = DEF(); go('title'); } };
  };

  // ---------- boot ----------
  function boot() {
    load();
    if (!window.THREE) { document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;inset:0;display:grid;place-items:center;background:#000;color:#fff;z-index:999">three.js を読み込めませんでした。ネット接続を確認してください。</div>'); return; }
    bgLoop();
    if (save.started && !BY_ID.get(save.main)) { const k = Object.keys(save.cards)[0]; save.main = k ? +k : null; if (!save.main) save.started = false; }
    go('title');
  }
  window.Game = { go, save: () => save, CARDS, findCard, startRace, runNode };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
