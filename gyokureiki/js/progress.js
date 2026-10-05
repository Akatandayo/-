/* 東方玉霊姫 - 育成・所持・ショップ・進化などの進行ルール（UIに依存しない） */
(function (global) {
  'use strict';

  const D = global.GK_DATA;
  const KD = global.GK.KODAMA;

  /* ---------- 系統（ちび → 進化形） ---------- */
  // ちびコダマ名 → 進化形のキャラ名（名前先頭の英字記号を除いた部分）
  const CHIBI_LINE = {
    'ちびれいむ': ['霊夢'], 'ちびまりさ': ['魔理沙', 'マリサ'], 'ちびさくや': ['咲夜'], 'ちびようむ': ['妖夢'],
    'ちびリグル': ['リグル'], 'ちびヤマメ': ['ヤマメ'], 'ちび大ちゃん': ['大妖精'], 'ちびときこ': ['朱鷺子'],
    'ちびあや': ['文'], 'ちびれいせん': ['鈴仙'], 'ちびさなえ': ['早苗'], 'ちびパチェ': ['パチュリー'],
    'ちびチルノ': ['チルノ'], 'ちびアリス': ['アリス'], 'ちびにとり': ['にとり'], 'ちびるーみゃ': ['ルーミア'],
    'ちびレティ': ['レティ'], 'ちびちぇん': ['橙'], 'ちびルナサ': ['ルナサ'], 'ちびめるぽ': ['メルラン'],
    'ちびリリカ': ['リリカ'], 'ちびてゐ': ['てゐ'], 'ちびみのりこ': ['穣子'], 'ちびしずは': ['静葉'],
    'ちびひな': ['雛'], 'ちびもみじ': ['椛'], 'ちびメディ': ['メディスン'], 'ちびキスメ': ['キスメ'],
    'ちびパルスィ': ['パルスィ'], 'ちびナズー': ['ナズーリン'], 'ちびむらさ': ['村紗'], 'ちびサニー': ['サニー'],
    'ちびルナ': ['ルナ'], 'ちびスター': ['スター'], 'ちびめーりん': ['美鈴'], 'ちびらん': ['藍'],
    'ちびけいね': ['慧音'], 'ちびえーりん': ['永琳'], 'ちびこまち': ['小町'], 'ちびりん': ['燐'],
    'ちびいく': ['衣玖'], 'ちびしょう': ['星'], 'ちびはたて': ['はたて'], 'ちびさとり': ['さとり'],
    'ちびこいし': ['こいし'], 'ちびレミィ': ['レミリア'], 'ちびフラン': ['フラン'], 'ちびゆゆこ': ['幽々子'],
    'ちびゆかり': ['紫'], 'ちびかぐや': ['輝夜'], 'ちびもこう': ['妹紅'], 'ちびかなこ': ['神奈子'],
    'ちびすわこ': ['諏訪子'], 'ちびゆうか': ['幽香'], 'ちびユウカ': ['ユウカ'], 'ちびえいき': ['映姫'],
    'ちびすいか': ['萃香'], 'ちびゆうぎ': ['勇儀'], 'ちびうつほ': ['空'], 'ちびてんし': ['天子'],
    'ちびひじり': ['聖'], 'ちびぬえ': ['ぬえ'], 'ちびよりひめ': ['依姫'], 'ちびとよひめ': ['豊姫'],
    'ちび靈夢': ['靈夢'], 'ちびみま': ['魅魔'], 'ちびキクリ': ['キクリ'], 'ちびコンガラ': ['コンガラ'],
    'ちびマガン': ['マガン'], 'ちびエリス': ['エリス'], 'ちびサリエル': ['サリエル'], 'ちびりか': ['里香'],
    'ちびめいら': ['明羅'], 'ちび魔梨沙': ['魔梨沙'], 'ちびエレン': ['エレン'], 'ちびことひめ': ['小兎姫'],
    'ちびカナ': ['カナ'], 'ちびりかこ': ['理香子'], 'ちびちゆり': ['ちゆり'], 'ちびゆめみ': ['夢美'],
    'ちびオレンジ': ['オレンジ'], 'ちびくるみ': ['くるみ'], 'ちびエリー': ['エリー'], 'ちびむげつ': ['夢月'],
    'ちびげんげつ': ['幻月'], 'ちびサラ': ['サラ'], 'ちびルイズ': ['ルイズ'], 'ちびありす': ['ありす'],
    'ちびユキ': ['ユキ'], 'ちびマイ': ['マイ'], 'ちびゆめこ': ['夢子'], 'ちびしんき': ['神綺'],
    'ちびレイラ': ['レイラ'], 'ちびきょうこ': ['響子'], 'ちびよしか': ['芳香'], 'ちびせいが': ['青娥'],
    'ちびとじこ': ['屠自古'], 'ちびふと': ['布都'], 'ちびみこ': ['神子'], 'ちびマミゾウ': ['マミゾウ'],
    'ちびレイセン': ['レイセン'], 'ちびかせん': ['華扇'], 'ちびこすず': ['小鈴'], 'ちびこころ': ['こころ'],
    'ちびのろいこ': ['呪い子'], 'ちびらいこ': ['雷鼓'], 'ちびせいじゃ': ['正邪'], 'ちびかげろう': ['影狼'],
    'ちびばんき': ['赤蛮奇'], 'ちびべんべん': ['弁々'], 'ちびやつはし': ['八橋'], 'ちびわかさぎ': ['わかさぎ姫'],
    'ちびすみれこ': ['菫子'], 'ちびせいらん': ['清蘭'], 'ちびりんご': ['鈴瑚'], 'ちびドレミー': ['ドレミー'],
    'ちびサグメ': ['サグメ'], 'ちびひとり': ['ひとり'], 'ちびクラウン': ['クラウン'], 'ちびじゅんこ': ['純狐'], 'ちびヘカーテ': ['ヘカーテ'],
  };
  // ちび以外の幼体（契約書でのみ入手）
  const EXTRA_LINE = {
    'ここあ': ['小悪魔'], 'しろりりー': ['リリーＷ'], 'くろりりー': ['リリーＢ'], 'みすちー': ['ミスティア', 'ミスティ'],
    'ここがさ': ['小傘'], 'こいちりん': ['一輪'], 'こしんみょう': ['針妙丸'], 'こしんぎょく': ['神玉'],
  };
  const EVOLVE_LV = 30;

  const charKey = name => name.replace(/^[Ａ-Ｚ]+/, '');
  const isChibi = k => k.name.startsWith('ちび');
  const isBase = k => isChibi(k) || !!EXTRA_LINE[k.name];

  // キャラ名 → 系統ID（ちびのコダマNo）
  const LINE_OF_CHAR = {};
  const CHIBI_BY_NAME = {};
  for (const k of D.kodama) if (isBase(k)) CHIBI_BY_NAME[k.name] = k;
  for (const [cn, chars] of Object.entries(Object.assign({}, CHIBI_LINE, EXTRA_LINE))) {
    const c = CHIBI_BY_NAME[cn];
    if (c) for (const ch of chars) LINE_OF_CHAR[ch] = c.id;
  }
  // 系統ID → [ちび, 進化形...]
  const LINES = {};
  const LINE_OF = {}; // コダマNo → 系統ID
  for (const k of D.kodama) {
    let line = null;
    if (isBase(k)) line = k.id;
    else if (LINE_OF_CHAR[charKey(k.name)]) line = LINE_OF_CHAR[charKey(k.name)];
    if (line != null) {
      (LINES[line] = LINES[line] || []).push(k.id);
      LINE_OF[k.id] = line;
    }
  }
  const CHIBI_IDS = D.kodama.filter(k => isChibi(k) && !k.special).map(k => k.id);
  // 通常の入手手段（ランダム契約書など）の対象
  const NORMAL_IDS = D.kodama.filter(k => !k.special).map(k => k.id);
  // ボス周回でのみ落とす特別なコダマ
  const SPECIAL_DROP = { id: 9001, lv: 20, rate: 0.1 };

  function evolutions(id) {
    const line = LINE_OF[id];
    if (line == null) return [];
    return LINES[line].filter(x => x !== id && !isBase(KD[x]));
  }

  /* ---------- レベル・経験値 ---------- */
  const MAX_LV = 100;
  const expToNext = lv => lv >= MAX_LV ? Infinity : 5 + lv * lv;
  const slvFor = lv => Math.min(5, 1 + Math.floor(lv / 20));
  // 倒したコダマから得られる経験値
  const expFrom = (k, lv) => Math.max(1, Math.floor(k.total * lv / 30));

  /* ---------- スペル習得条件 ---------- */
  function spellReq(sp) {
    if (sp.price === '禁呪') return { money: 0, lv: 50, book: true };
    const p = parseInt(sp.price) || 0;
    let lv = 1;
    if (p > 3000) lv = 15;
    if (p > 20000) lv = 25;
    if (p >= 100000) lv = 35;
    if (p >= 200000) lv = 45;
    if (p >= 300000) lv = 55;
    return { money: p, lv, book: false };
  }
  // 最初から覚えているスペル（3000銭以下、無ければ最安のもの）
  function basicSpells(k) {
    let list = k.spells.filter(s => s.price !== '禁呪' && (parseInt(s.price) || 0) <= 3000).map(s => s.name);
    if (!list.length) {
      const sorted = k.spells.filter(s => s.price !== '禁呪').sort((a, b) => (parseInt(a.price) || 0) - (parseInt(b.price) || 0));
      list = (sorted.length ? sorted : k.spells).slice(0, 1).map(s => s.name);
    }
    return [...new Set(list)];
  }

  /* ---------- セーブデータ ---------- */
  const SAVE_VERSION = 1;
  function newSave(name, starterId) {
    const s = {
      v: SAVE_VERSION, name: name || '悠姫', money: 10000,
      owned: [], party: [], nextUid: 1,
      items: { chibi: 1 }, contracts: [],
      cleared: {}, seen: {}, intro: {}, stats: { win: 0, lose: 0 },
      created: Date.now(),
    };
    const m = addKodama(s, starterId, 5);
    s.party = [m.uid];
    return s;
  }
  function owns(s, id) { return s.owned.some(m => m.id === id); }
  function ownsLine(s, id) {
    const line = LINE_OF[id];
    return s.owned.some(m => m.id === id || (line != null && LINE_OF[m.id] === line));
  }
  function addKodama(s, id, lv) {
    const k = KD[id];
    const learned = basicSpells(k);
    const m = { uid: s.nextUid++, id, lv: Math.max(1, Math.min(MAX_LV, lv || 5)), exp: 0, learned, equip: learned.slice(0, 4) };
    s.owned.push(m);
    s.seen[id] = 1;
    if (s.party.length < 6) s.party.push(m.uid);
    return m;
  }
  function findOwned(s, uid) { return s.owned.find(m => m.uid === uid); }
  function partyMembers(s) { return s.party.map(uid => findOwned(s, uid)).filter(Boolean); }

  function toBuild(m, forceLv) {
    const k = KD[m.id];
    const idx = [];
    for (const name of m.equip) {
      const i = k.spells.findIndex(sp => sp.name === name);
      if (i >= 0 && !idx.includes(i)) idx.push(i);
    }
    const lv = forceLv || m.lv;
    return { id: m.id, lv, spells: idx.slice(0, 4), slv: slvFor(lv) };
  }

  // 経験値付与 → レベルアップした回数を返す
  function gainExp(m, exp) {
    const before = m.lv;
    m.exp += exp;
    while (m.lv < MAX_LV && m.exp >= expToNext(m.lv)) {
      m.exp -= expToNext(m.lv);
      m.lv++;
    }
    if (m.lv >= MAX_LV) m.exp = 0;
    return m.lv - before;
  }

  function evolve(s, m, toId) {
    if (!evolutions(m.id).includes(toId)) return false;
    if (isBase(KD[m.id]) && m.lv < EVOLVE_LV) return false;
    const k = KD[toId];
    m.id = toId;
    s.seen[toId] = 1;
    const names = new Set(k.spells.map(sp => sp.name));
    m.learned = [...new Set([...m.learned.filter(n => names.has(n)), ...basicSpells(k)])];
    m.equip = m.equip.filter(n => names.has(n));
    for (const n of m.learned) if (m.equip.length < 4 && !m.equip.includes(n)) m.equip.push(n);
    return true;
  }

  /* ---------- 契約書 ---------- */
  // contract: {id, lv}  → 所持品から使用してコダマを入手
  function useContract(s, index) {
    const c = s.contracts[index];
    if (!c) return null;
    s.contracts.splice(index, 1);
    if (owns(s, c.id)) {
      const refund = 3000;
      s.money += refund;
      return { dup: true, refund, id: c.id };
    }
    const m = addKodama(s, c.id, c.lv || 5);
    return { dup: false, m };
  }
  function randomUnowned(s, pool, rand) {
    rand = rand || Math.random;
    const list = pool.filter(id => !owns(s, id));
    if (!list.length) return null;
    return list[Math.floor(rand() * list.length)];
  }

  /* ---------- ショップ ---------- */
  const SHOP = [
    { key: 'chibi', name: 'ちび契約書', price: 8000, desc: 'まだ契約していない「ちび」コダマのどれかと契約できる。', unlock: 0 },
    { key: 'random', name: '玉霊契約書', price: 40000, desc: 'まだ契約していないコダマのどれかと契約できる（進化形・特殊コダマ含む）。Lv20で加入。', unlock: 4 },
    { key: 'book', name: '禁呪の書', price: 100000, desc: '★の付いた禁呪スペルを習得するのに必要。', unlock: 6 },
    { key: 'scroll', name: '修行の書', price: 5000, desc: '使ったコダマが次のレベルまでの経験値を得る。', unlock: 2 },
  ];

  global.GKP = {
    CHIBI_IDS, NORMAL_IDS, SPECIAL_DROP, LINES, LINE_OF, EVOLVE_LV, MAX_LV, SHOP, SAVE_VERSION,
    isChibi, isBase, charKey, evolutions, expToNext, slvFor, expFrom, spellReq, basicSpells,
    newSave, owns, ownsLine, addKodama, findOwned, partyMembers, toBuild, gainExp, evolve,
    useContract, randomUnowned,
  };
})(typeof window !== 'undefined' ? window : globalThis);
