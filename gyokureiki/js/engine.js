/* 東方玉霊姫 対戦シミュレータ - バトルエンジン
 * UIや通信に依存しない純粋なロジック。状態はJSONで送受信できる形のみで持つ。
 */
(function (global) {
  'use strict';

  const D = global.GK_DATA;
  const TYPES = D.types; // 属性の並び（相性表の列順）
  const TYPE_INDEX = Object.fromEntries(TYPES.map((t, i) => [t, i]));
  const KODAMA = Object.fromEntries(D.kodama.map(k => [k.id, k]));

  const MAX_PARTY = 6;
  const MAX_SPELLS = 4;
  const NORMAL_POWER = 50;
  const MOD_MIN = 0.2, MOD_MAX = 4;
  const CRIT_RATE = 1 / 16, CRIT_MULT = 1.5;
  const STAB = 1.5;
  const TURN_LIMIT = 200;

  /* ---------- 乱数 ---------- */
  function makeRng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s += 0x6D2B79F5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 全角→半角 ---------- */
  function hankaku(s) {
    return String(s).replace(/[０-９／]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  }

  /* ---------- 相性 ---------- */
  function typeMult(atkType, defTypes) {
    const row = D.chart[atkType];
    if (!row) return 1;
    let m = 1;
    for (const t of defTypes) m *= row[TYPE_INDEX[t]];
    return m;
  }

  /* ---------- スペル効果の解析 ---------- */
  const STAT_KEYS = { '攻撃': 'atk', '防御': 'df', '速度': 'spd' };
  function parseStats(str) {
    return str.split(/と|\//).map(s => STAT_KEYS[s]).filter(Boolean);
  }

  const spellEffectCache = {};
  function parseSpellEffect(desc) {
    if (spellEffectCache[desc]) return spellEffectCache[desc];
    const d = hankaku(desc);
    const e = { priority: 0 };
    let m;
    if ((m = d.match(/与えたダメージの1\/(\d)、相手のＶＰを減少/))) e.vpDrain = 1 / +m[1];
    if ((m = d.match(/与えたダメージの1\/(\d)、ＨＰが回復/))) e.hpAbsorb = 1 / +m[1];
    if ((m = d.match(/与えたダメージの1\/(\d)、ＶＰが回復/))) e.vpAbsorb = 1 / +m[1];
    if (/先攻で攻撃します|先行になります|先攻になります/.test(d)) e.priority = 1;
    if ((m = d.match(/(\d)ターンの間、受けるダメージを半減/))) e.shield = +m[1];
    if ((m = d.match(/後攻になります。受けたダメージの([\d.]+)倍/))) { e.priority = -1; e.counter = +m[1]; }
    if (/相手のスキルを無効化/.test(d)) e.nullSkill = true;
    if (/相手のＨＰを半分/.test(d)) e.halfHp = true;
    if (/相手のＶＰを半減/.test(d)) e.halfVp = true;
    if (/自分のＨＰが減ると与えるダメージが増加/.test(d)) e.reversal = true;
    if (/相手の属性1と同じ属性で攻撃/.test(d)) e.mirrorType = true;
    if ((m = d.match(/味方全員のＶＰを(\d+)％回復/))) e.partyVp = +m[1] / 100;
    if ((m = d.match(/自分のＶＰを(\d+)％回復/))) e.selfVp = +m[1] / 100;
    if ((m = d.match(/自分のＨＰを(\d+)％回復/))) e.selfHp = +m[1] / 100;
    if (/攻撃と同時に気絶/.test(d)) e.selfKO = true;
    if ((m = d.match(/自分の属性2[をが](.)属性に変化/))) e.setType2 = m[1];
    if (/相手の属性2を無効化/.test(d)) e.dropFoeType2 = true;
    if ((m = d.match(/相手を(.)属性に変化/))) e.setFoeType = m[1];
    if ((m = d.match(/自分の(攻撃\/防御\/速度)のいずれかを(\d+)％上げ/))) e.randomBuff = +m[2] / 100;
    if ((m = d.match(/このターンと次の(\d)ターン、相手は行動できません/))) e.timeStop = +m[1] + 1;
    if (/戦闘中1回のみ/.test(d)) e.once = true;
    if (/相手のスペルやスキルの効果を一切受け付けません/.test(d)) e.impulse = true;
    e.stats = [];
    const re = /(相手|自分)の([攻撃防御速度と]+)(?:を|が)(\d+)％(上げ|下げ|下が)/g;
    while ((m = re.exec(d))) {
      const who = m[1] === '自分' ? 'self' : 'foe';
      const sign = m[4] === '上げ' ? 1 : -1;
      for (const k of parseStats(m[2])) e.stats.push({ who, stat: k, pct: sign * (+m[3]) });
    }
    spellEffectCache[desc] = e;
    return e;
  }

  /* ---------- スキル効果の解析 ---------- */
  const skillCache = {};
  function parseSkill(desc) {
    if (!desc) return null;
    if (skillCache[desc]) return skillCache[desc];
    const d = hankaku(desc);
    const s = {};
    let m;
    if (/^自分の速度が相手の2倍以上のとき、1ターンに2回行動します/.test(d)) s.doubleAct = true;
    else if ((m = d.match(/^パーティーに「(.+?)」がいると、与えるダメージがSLv×(\d+)％増加し、受けるダメージがSLv×(\d+)％減少/))) s.partner = { name: m[1], power: +m[2], guard: +m[3], rage: /倒れると.*2倍/.test(d) };
    else if ((m = d.match(/^交代で登場したターンのみ、受けるダメージをSLv×(\d+)％減少/))) s.switchInGuard = +m[1];
    else if ((m = d.match(/^ＨＰ最大時、受けるダメージをSLv×(\d+)％減少/))) s.fullHpGuard = +m[1];
    else if ((m = d.match(/^効果抜群の攻撃を受けた時、受けるダメージをSLv×(\d+)％減少/))) s.seGuard = +m[1];
    else if ((m = d.match(/^効果抜群でない攻撃を受けた時、受けるダメージをSLv×(\d+)％減少/))) s.nonSeGuard = +m[1];
    else if ((m = d.match(/^(.)属性のスペルによるダメージをSLv×(\d+)％減少/))) s.typeGuard = { type: m[1], pct: +m[2] };
    else if ((m = d.match(/^受けるダメージをSLv×(\d+)％減少/))) s.guard = +m[1];
    else if ((m = d.match(/^そのターンに攻撃を受けていると与えるダメージがSLv×(\d+)％増加/))) s.revenge = +m[1];
    else if ((m = d.match(/^与えるダメージがSLv×(\d+)％増加/))) s.power = +m[1];
    else if ((m = d.match(/^与えたダメージのSLv×(\d+)％、相手のＶＰを減少/))) s.vpDrain = +m[1];
    else if ((m = d.match(/^与えたダメージのSLv×(\d+)％、自分のＶＰが回復/))) s.vpAbsorb = +m[1];
    else if ((m = d.match(/^SLv×(\d+)％の確率で、スペルの威力が属性一致扱い/))) s.stabChance = +m[1];
    else if ((m = d.match(/^SLv×(\d+)％の確率で、能力減少を跳ね返し/))) s.mirrorDown = +m[1];
    else if ((m = d.match(/^SLv×(\d+)％の確率で、自分の能力減少を反転/))) s.invertDown = +m[1];
    else if ((m = d.match(/^SLv×(\d+)％の確率で、相手の能力上昇を反転/))) s.invertFoeUp = +m[1];
    else if ((m = d.match(/^効果抜群の時、与えるダメージがSLv×(\d+)％増加/))) s.seBoost = +m[1];
    else if (/^登場時、相手のスキルをコピー/.test(d)) s.copy = true;
    else if ((m = d.match(/^属性1と別属性のスペル使用時、SLv×(\d+)％の確率で自分の属性2が/))) s.shift = +m[1];
    else if ((m = d.match(/^パーティーに同名スキルを持つ別種のコダマがいる場合のみ、ターン終了時、自分の攻撃がSLv×(\d+)％上昇/))) s.endSynergyAtk = +m[1];
    else if ((m = d.match(/^ターン終了時、自分の(攻撃|防御|速度)がSLv×(\d+)％上昇/))) s.endSelfStat = { stat: STAT_KEYS[m[1]], pct: +m[2] };
    else if ((m = d.match(/^ターン終了時、相手の(攻撃|防御|速度)をSLv×(\d+)％減少/))) s.endFoeStat = { stat: STAT_KEYS[m[1]], pct: +m[2] };
    else if ((m = d.match(/^ターン終了時、相手のＶＰをSLv×(\d+)減らし/))) s.endFoeVp = +m[1];
    else if ((m = d.match(/^ターン終了時、味方全員のＶＰがSLv×(\d+)回復/))) s.endPartyVp = +m[1];
    else if ((m = d.match(/^ターン終了時、自分のＶＰがSLv×(\d+)回復/))) s.endSelfVp = +m[1];
    else if ((m = d.match(/^ターン終了時、自分のＨＰがSLv×(\d+)％回復/))) s.endRegen = +m[1];
    else if ((m = d.match(/^ターン終了時、SLv×(\d+)％の確率で相手のスキルを無効化/))) s.endNull = +m[1];
    else if ((m = d.match(/^ターン終了時、SLv×(\d+)％の確率で相手の能力上昇状態を打ち消/))) s.endClear = +m[1];
    s.unknown = Object.keys(s).length === 0;
    skillCache[desc] = s;
    return s;
  }

  /* ---------- ステータス計算 ---------- */
  const IV = 20;
  function calcStats(k, lv) {
    const f = b => Math.floor((2 * b + IV) * lv / 100);
    return {
      maxhp: f(k.hp) + lv + 10,
      atk: f(k.atk) + 5,
      df: f(k.df) + 5,
      spd: f(k.spd) + 5,
      maxvp: 50 + Math.floor(lv / 2),
    };
  }

  /* ---------- 構築データ → 戦闘用コダマ ---------- */
  // build: {id, lv, spells:[spellIndex...], slv}
  function sanitizeBuild(b, forceLv) {
    const k = KODAMA[b && b.id];
    if (!k) return null;
    let lv = forceLv || Math.round(+b.lv || 50);
    lv = Math.max(1, Math.min(100, lv));
    let spells = Array.isArray(b.spells) ? b.spells.map(Number) : [];
    spells = [...new Set(spells)].filter(i => Number.isInteger(i) && i >= 0 && i < k.spells.length).slice(0, MAX_SPELLS);
    if (!spells.length) spells = defaultSpells(k);
    const slv = Math.max(1, Math.min(5, Math.round(+b.slv || 5)));
    return { id: k.id, lv, spells, slv };
  }

  function defaultSpells(k) {
    // 威力の高い攻撃スペル順に最大4つ
    const idx = k.spells.map((s, i) => i);
    idx.sort((a, b) => spellScore(k, k.spells[b]) - spellScore(k, k.spells[a]));
    return idx.slice(0, MAX_SPELLS);
  }
  function spellScore(k, s) {
    const p = parseInt(s.pow) || 0;
    const stab = k.types.includes(s.type) ? 1.5 : 1;
    return p ? p * stab - s.cost * 0.3 : 30;
  }

  function makeMon(build) {
    const k = KODAMA[build.id];
    const st = calcStats(k, build.lv);
    const skill = k.skills[0] || null;
    return {
      id: k.id, name: k.name, lv: build.lv,
      baseTypes: k.types.slice(), types: k.types.slice(),
      maxhp: st.maxhp, hp: st.maxhp, maxvp: st.maxvp, vp: st.maxvp,
      atk: st.atk, df: st.df, spd: st.spd,
      mods: { atk: 1, df: 1, spd: 1 },
      spells: build.spells.slice(),
      skill: skill ? { name: skill.name, desc: skill.desc } : null,
      baseSkill: skill ? { name: skill.name, desc: skill.desc } : null,
      slv: build.slv,
      skillNull: false,
      enteredTurn: 0,
      dmgTakenTurn: 0, hitThisTurn: false,
      used: {},
    };
  }

  /* ---------- バトル生成 ---------- */
  // sides: [{name, party:[build...]}, ...]  opts: {seed, forceLv}
  function createBattle(sides, opts) {
    opts = opts || {};
    const state = {
      turn: 1,
      seed: (opts.seed >>> 0) || ((Math.random() * 2 ** 32) >>> 0),
      sides: sides.map(s => {
        const builds = (s.party || []).map(b => sanitizeBuild(b, opts.forceLv)).filter(Boolean).slice(0, MAX_PARTY);
        return {
          name: String(s.name || 'プレイヤー').slice(0, 16),
          party: builds.map(makeMon),
          active: 0,
          shield: 0,
        };
      }),
      phase: 'command', // command | switch | end
      need: [true, true],
      winner: null,
      log: [],
    };
    for (const s of state.sides) if (!s.party.length) s.party.push(makeMon(sanitizeBuild({ id: D.kodama[0].id })));
    // レイドボス用の能力倍率 boost: [side0, side1] = {hp, atk, df, spd}
    (opts.boost || []).forEach((bo, i) => {
      if (!bo || !state.sides[i]) return;
      const c = (v, max) => Math.max(1, Math.min(max, +v || 1));
      for (const m of state.sides[i].party) {
        m.maxhp = m.hp = Math.floor(m.maxhp * c(bo.hp, 20));
        for (const k of ['atk', 'df', 'spd']) m[k] = Math.floor(m[k] * c(bo[k], 3));
        m.raid = true;
      }
    });
    const ctx = makeCtx(state);
    ctx.say(`${state.sides[0].name} と ${state.sides[1].name} の勝負が始まった！`);
    for (let i = 0; i < 2; i++) ctx.say(`${state.sides[i].name}は${active(state, i).name}を繰り出した！`);
    for (let i = 0; i < 2; i++) onEnter(ctx, i);
    state.log = ctx.flush();
    return state;
  }

  function active(state, side) { return state.sides[side].party[state.sides[side].active]; }
  function alive(m) { return m.hp > 0; }
  function aliveCount(side) { return side.party.filter(alive).length; }

  /* ---------- コンテキスト（ログ・乱数） ---------- */
  function makeCtx(state) {
    let rngState = state.seed;
    const rng = makeRng(rngState);
    const out = [];
    const ctx = {
      state,
      rand: () => rng(),
      say(text, extra) {
        out.push(Object.assign({ text, snap: snapshot(state) }, extra || {}));
      },
      flush() {
        state.seed = (Math.floor(rng() * 2 ** 32) >>> 0) || 1;
        return out;
      },
    };
    return ctx;
  }

  function snapshot(state) {
    return state.sides.map(s => {
      const m = s.party[s.active];
      return {
        a: s.active, id: m.id, name: m.name, lv: m.lv, types: m.types.slice(),
        hp: m.hp, maxhp: m.maxhp, vp: m.vp, maxvp: m.maxvp,
        alive: s.party.map(p => p.hp > 0 ? 1 : 0),
      };
    });
  }

  /* ---------- 有効ステータス ---------- */
  function eff(m, stat) { return Math.max(1, Math.floor(m[stat] * m.mods[stat])); }
  function skillOf(m) { return m.skill && !m.skillNull ? parseSkill(m.skill.desc) : null; }

  const STAT_NAME = { atk: '攻撃', df: '防御', spd: '速度' };
  function changeStat(ctx, side, m, stat, pct, fromFoe) {
    if (fromFoe && m.impulse) { ctx.say(`${m.name}は効果を受け付けない！`); return; }
    const sk = skillOf(m);
    if (fromFoe && pct < 0 && sk && sk.mirrorDown && ctx.rand() * 100 < sk.mirrorDown * m.slv) {
      const foe = active(ctx.state, 1 - side);
      ctx.say(`${m.name}の【${m.skill.name}】！ 能力減少を跳ね返した！`);
      changeStat(ctx, 1 - side, foe, stat, pct, false);
      return;
    }
    if (fromFoe && pct < 0 && sk && sk.invertDown && ctx.rand() * 100 < sk.invertDown * m.slv) {
      ctx.say(`${m.name}の【${m.skill.name}】！ 能力減少を反転した！`);
      pct = -pct;
    }
    if (pct > 0 && !m.impulse) {
      const foe = active(ctx.state, 1 - side);
      const fsk = alive(foe) ? skillOf(foe) : null;
      if (fsk && fsk.invertFoeUp && ctx.rand() * 100 < fsk.invertFoeUp * foe.slv) {
        ctx.say(`${foe.name}の【${foe.skill.name}】！ ${m.name}の能力上昇を反転した！`);
        pct = -pct;
      }
    }
    const before = m.mods[stat];
    let after = before * (1 + pct / 100);
    after = Math.max(MOD_MIN, Math.min(MOD_MAX, after));
    m.mods[stat] = after;
    if (Math.abs(after - before) < 1e-9) {
      ctx.say(`${m.name}の${STAT_NAME[stat]}はこれ以上${pct > 0 ? '上がらない' : '下がらない'}！`);
    } else {
      ctx.say(`${m.name}の${STAT_NAME[stat]}が${Math.abs(pct)}％${pct > 0 ? '上がった' : '下がった'}！`);
    }
  }

  // パートナー判定：0=いない 1=元気 2=倒れている
  function partnerState(st, side, m, sk) {
    if (!sk || !sk.partner) return 0;
    const ps = st.sides[side].party.filter(p => p !== m && p.name.includes(sk.partner.name));
    if (!ps.length) return 0;
    return ps.some(alive) ? 1 : 2;
  }

  /* ---------- 入場時処理 ---------- */
  function onEnter(ctx, side) {
    const st = ctx.state;
    const m = active(st, side);
    m.enteredTurn = st.turn;
    m.appeared = true;
    const sk = skillOf(m);
    const ps = partnerState(st, side, m, sk);
    if (ps === 1) ctx.say(`${m.name}の【${m.skill.name}】！ ${sk.partner.name}が一緒にいるので張り切っている！`);
    if (ps === 2 && sk.partner.rage) ctx.say(`${m.name}の【${m.skill.name}】！ ${sk.partner.name}を倒された怒りで力が溢れている……！`);
    if (sk && sk.copy) {
      const foe = active(st, 1 - side);
      if (foe.skill && alive(foe)) {
        m.skill = { name: foe.skill.name, desc: foe.skill.desc };
        ctx.say(`${m.name}は${foe.name}のスキル【${foe.skill.name}】をコピーした！`);
      }
    }
  }

  function resetOnLeave(m) {
    m.mods = { atk: 1, df: 1, spd: 1 };
    m.types = m.baseTypes.slice();
    m.skill = m.baseSkill ? { name: m.baseSkill.name, desc: m.baseSkill.desc } : null;
    m.skillNull = false;
  }

  function doSwitch(ctx, side, to, forced) {
    const st = ctx.state;
    const s = st.sides[side];
    const prev = active(st, side);
    if (!forced) ctx.say(`${s.name}は${prev.name}を引っ込めた！`);
    resetOnLeave(prev);
    s.active = to;
    ctx.say(`${s.name}は${active(st, side).name}を繰り出した！`);
    onEnter(ctx, side);
  }

  /* ---------- 行動の検証 ---------- */
  // action: {type:'spell', slot} | {type:'normal'} | {type:'rest'} | {type:'switch', to} | {type:'surrender'}
  function validActions(state, side) {
    const s = state.sides[side];
    const m = active(state, side);
    const list = [];
    const switches = s.party.map((p, i) => i).filter(i => i !== s.active && alive(s.party[i]));
    if (state.phase === 'switch') {
      if (!alive(m)) for (const i of switches) list.push({ type: 'switch', to: i });
      return list;
    }
    list.push({ type: 'normal' });
    m.spells.forEach((si, slot) => {
      const sp = KODAMA[m.id].spells[si];
      if (m.vp >= sp.cost && !(m.used[si] && parseSpellEffect(sp.desc).once)) list.push({ type: 'spell', slot });
    });
    list.push({ type: 'rest' });
    for (const i of switches) list.push({ type: 'switch', to: i });
    return list;
  }

  function isValid(state, side, action) {
    if (!action || typeof action !== 'object') return false;
    if (action.type === 'surrender') return state.phase !== 'end';
    return validActions(state, side).some(a => a.type === action.type && a.slot === action.slot && a.to === action.to);
  }

  /* ---------- ダメージ計算 ---------- */
  function calcDamage(ctx, side, user, target, spell, eff_) {
    const st = ctx.state;
    let type = spell.type;
    if (eff_.mirrorType) type = target.types[0];
    let power = spell.power;
    if (eff_.reversal) power = Math.floor(power * (1 + (1 - user.hp / user.maxhp)));
    const usk = skillOf(user), tsk = skillOf(target);
    const A = eff(user, 'atk'), Dd = eff(target, 'df');
    let dmg = Math.floor(Math.floor(Math.floor(2 * user.lv / 5 + 2) * power * A / Dd) / 50) + 2;
    let stab = user.types.includes(type);
    if (!stab && usk && usk.stabChance && ctx.rand() * 100 < usk.stabChance * user.slv) {
      stab = true;
      ctx.say(`${user.name}の【${user.skill.name}】！ 属性一致扱いになった！`);
    }
    if (stab) dmg *= STAB;
    const tm = typeMult(type, target.types);
    dmg *= tm;
    let crit = false;
    if (tm > 0 && ctx.rand() < CRIT_RATE) { crit = true; dmg *= CRIT_MULT; }
    dmg *= 0.85 + ctx.rand() * 0.15;
    // スキル補正（攻撃側）
    if (usk && usk.power) dmg *= 1 + usk.power * user.slv / 100;
    const ups = partnerState(st, side, user, usk);
    if (ups) dmg *= 1 + usk.partner.power * user.slv * (ups === 2 && usk.partner.rage ? 2 : 1) / 100;
    if (usk && usk.seBoost && tm > 1) dmg *= 1 + usk.seBoost * user.slv / 100;
    if (usk && usk.revenge && user.hitThisTurn) dmg *= 1 + usk.revenge * user.slv / 100;
    // スキル補正（防御側）
    let guard = 0;
    if (tsk) {
      if (tsk.guard) guard += tsk.guard * target.slv;
      if (partnerState(st, 1 - side, target, tsk) === 1) guard += tsk.partner.guard * target.slv;
      if (tsk.switchInGuard && target.enteredTurn === st.turn) guard += tsk.switchInGuard * target.slv;
      if (tsk.fullHpGuard && target.hp === target.maxhp) guard += tsk.fullHpGuard * target.slv;
      if (tsk.seGuard && tm > 1) guard += tsk.seGuard * target.slv;
      if (tsk.nonSeGuard && tm <= 1) guard += tsk.nonSeGuard * target.slv;
      if (tsk.typeGuard && tsk.typeGuard.type === type) guard += tsk.typeGuard.pct * target.slv;
    }
    dmg *= Math.max(0, 1 - Math.min(guard, 95) / 100);
    if (st.sides[1 - side].shield > 0) dmg *= 0.5;
    dmg = tm === 0 ? 0 : Math.max(1, Math.floor(dmg));
    return { dmg, tm, crit, type };
  }

  function applyDamage(ctx, side, target, dmg) {
    const real = Math.min(target.hp, dmg);
    target.hp -= real;
    target.dmgTakenTurn += real;
    if (real > 0) target.hitThisTurn = true;
    return real;
  }

  function faintCheck(ctx, side) {
    const m = active(ctx.state, side);
    if (m.hp <= 0 && !m._fainted) {
      m._fainted = true;
      m.vp = 0;
      ctx.say(`${m.name}は倒れた！`, { faint: side });
    }
  }

  /* ---------- 行動の実行 ---------- */
  function execute(ctx, side, action) {
    const st = ctx.state;
    const user = active(st, side);
    if (!alive(user)) return;
    const foeSide = 1 - side;
    const target = active(st, foeSide);
    const k = KODAMA[user.id];

    if (action.type === 'rest') {
      const heal = Math.max(10, Math.floor(user.maxvp * 0.2));
      const v = Math.min(heal, user.maxvp - user.vp);
      user.vp += v;
      ctx.say(`${user.name}はやすんだ！ VPが${v}回復した！`);
      return;
    }

    let spell, e;
    if (action.type === 'spell') {
      const sp = k.spells[user.spells[action.slot]];
      if (!sp || user.vp < sp.cost || (user.used[user.spells[action.slot]] && parseSpellEffect(sp.desc).once)) {
        action = { type: 'normal' };
      } else {
        user.used[user.spells[action.slot]] = 1;
        spell = { name: sp.name, type: sp.type, power: parseInt(sp.pow) || 0, cost: sp.cost };
        e = parseSpellEffect(sp.desc);
      }
    }
    if (action.type === 'normal') {
      spell = { name: '通常攻撃', type: user.types[0], power: NORMAL_POWER, cost: 0 };
      e = { priority: 0, stats: [] };
    }

    user.vp -= spell.cost;
    ctx.say(`${user.name}の${spell.name === '通常攻撃' ? '通常攻撃' : `【${spell.name}】`}！`, { anim: { side, type: spell.type } });

    // 属性変化スキル
    const usk = skillOf(user);
    if (usk && usk.shift && spell.type !== user.types[0] && spell.name !== '通常攻撃' && ctx.rand() * 100 < usk.shift * user.slv) {
      user.types = [user.types[0], spell.type].filter((t, i, a) => a.indexOf(t) === i);
      ctx.say(`${user.name}の【${user.skill.name}】！ 属性が${user.types.join('・')}になった！`);
    }

    if (e.timeStop) {
      st.sides[foeSide].frozen = e.timeStop;
      ctx.say(`時は止まった……！ ${st.sides[foeSide].name}の陣営は${e.timeStop - 1 ? `このターンと次の${e.timeStop - 1}ターン` : 'このターン'}動けない！`, { timestop: true });
    }
    if (e.shield) {
      st.sides[side].shield = e.shield;
      ctx.say(`${st.sides[side].name}の陣営は${e.shield}ターンの間、受けるダメージが半減する！`);
    }
    if (e.setType2) {
      user.types = [user.types[0], e.setType2].filter((t, i, a) => a.indexOf(t) === i);
      ctx.say(`${user.name}の属性が${user.types.join('・')}になった！`);
    }

    let dealt = 0;
    if (e.counter) {
      if (user.dmgTakenTurn > 0 && alive(target)) {
        let dmg = Math.floor(user.dmgTakenTurn * e.counter);
        if (st.sides[foeSide].shield > 0) dmg = Math.floor(dmg * 0.5);
        dealt = applyDamage(ctx, foeSide, target, dmg);
        ctx.say(`受けたダメージを${e.counter}倍にして返した！ ${target.name}に${dealt}のダメージ！`, { hit: foeSide });
      } else {
        ctx.say('しかし うまく決まらなかった！');
      }
    } else if (e.halfHp) {
      if (alive(target) && target.impulse) ctx.say(`${target.name}は効果を受け付けない！`);
      else if (alive(target)) {
        const tm = typeMult(spell.type, target.types);
        if (tm === 0) ctx.say(`${target.name}には効果がないようだ…`);
        else {
          dealt = applyDamage(ctx, foeSide, target, Math.max(1, Math.floor(target.hp / 2)));
          ctx.say(`${target.name}のＨＰが半分になった！（${dealt}ダメージ）`, { hit: foeSide });
        }
      }
    } else if (spell.power > 0 && alive(target)) {
      const r = calcDamage(ctx, side, user, target, spell, e);
      if (r.tm === 0) {
        ctx.say(`${target.name}には効果がないようだ…`);
      } else {
        dealt = applyDamage(ctx, foeSide, target, r.dmg);
        let msg = `${target.name}に${dealt}のダメージ！`;
        if (r.crit) msg = '急所に当たった！ ' + msg;
        if (r.tm > 1) msg = '効果は抜群だ！ ' + msg;
        else if (r.tm < 1) msg = '効果はいまひとつのようだ… ' + msg;
        ctx.say(msg, { hit: foeSide });
      }
    }

    // ダメージ依存の副次効果
    if (dealt > 0) {
      if (e.vpDrain && !target.impulse) drainVp(ctx, target, Math.floor(dealt * e.vpDrain));
      if (e.hpAbsorb) healHp(ctx, user, Math.floor(dealt * e.hpAbsorb));
      if (e.vpAbsorb) healVp(ctx, user, Math.floor(dealt * e.vpAbsorb));
      if (usk && usk.vpDrain && !target.impulse) {
        const v = Math.floor(dealt * usk.vpDrain * user.slv / 100);
        if (v > 0) { ctx.say(`${user.name}の【${user.skill.name}】！`); drainVp(ctx, target, v); }
      }
      if (usk && usk.vpAbsorb) {
        const v = Math.floor(dealt * usk.vpAbsorb * user.slv / 100);
        if (v > 0) { ctx.say(`${user.name}の【${user.skill.name}】！`); healVp(ctx, user, v); }
      }
    }

    const targetUp = alive(target);
    // 能力変化
    for (const s of e.stats || []) {
      if (s.who === 'self') changeStat(ctx, side, user, s.stat, s.pct, false);
      else if (targetUp) changeStat(ctx, foeSide, target, s.stat, s.pct, true);
    }
    if (e.impulse && !user.impulse) {
      user.impulse = true;
      ctx.say(`${user.name}の衝動が解き放たれた――！ 以降、相手の効果を一切受け付けない！`, { impulse: true });
    }
    if (e.randomBuff) {
      const keys = ['atk', 'df', 'spd'];
      changeStat(ctx, side, user, keys[Math.floor(ctx.rand() * 3)], e.randomBuff * 100, false);
    }
    if (e.halfVp && targetUp && !target.impulse) {
      const v = Math.floor(target.vp / 2);
      target.vp -= v;
      ctx.say(`${target.name}のＶＰが半減した！（-${v}）`);
    }
    if (e.nullSkill && targetUp && !target.impulse && target.skill && !target.skillNull) {
      target.skillNull = true;
      ctx.say(`${target.name}のスキル【${target.skill.name}】が無効化された！`);
    }
    if (e.dropFoeType2 && targetUp && !target.impulse && target.types.length > 1) {
      target.types = [target.types[0]];
      ctx.say(`${target.name}の属性２が無効化された！`);
    }
    if (e.setFoeType && targetUp && !target.impulse) {
      target.types = [e.setFoeType];
      ctx.say(`${target.name}は${e.setFoeType}属性になった！`);
    }
    if (e.partyVp) {
      for (const p of st.sides[side].party) if (alive(p)) p.vp = Math.min(p.maxvp, p.vp + Math.floor(p.maxvp * e.partyVp));
      ctx.say(`味方全員のＶＰが回復した！`);
    }
    if (e.selfVp) healVp(ctx, user, Math.floor(user.maxvp * e.selfVp));
    if (e.selfHp) healHp(ctx, user, Math.floor(user.maxhp * e.selfHp));
    if (e.selfKO) {
      user.hp = 0;
      ctx.say(`${user.name}は力を使い果たした！`);
    }
    faintCheck(ctx, foeSide);
    faintCheck(ctx, side);
  }

  function drainVp(ctx, m, v) {
    v = Math.min(m.vp, Math.max(0, v));
    if (v <= 0) return;
    m.vp -= v;
    ctx.say(`${m.name}のＶＰが${v}減少した！`);
  }
  function healVp(ctx, m, v) {
    v = Math.min(m.maxvp - m.vp, Math.max(0, v));
    if (v <= 0) return;
    m.vp += v;
    ctx.say(`${m.name}のＶＰが${v}回復した！`);
  }
  function healHp(ctx, m, v) {
    if (!alive(m)) return;
    v = Math.min(m.maxhp - m.hp, Math.max(0, v));
    if (v <= 0) return;
    m.hp += v;
    ctx.say(`${m.name}のＨＰが${v}回復した！`);
  }

  /* ---------- ターン終了処理 ---------- */
  function endOfTurn(ctx) {
    const st = ctx.state;
    for (let side = 0; side < 2; side++) {
      const s = st.sides[side];
      if (s.frozen > 0) {
        s.frozen--;
        if (s.frozen === 0) ctx.say('そして時は動き出す……。');
      }
      if (s.shield > 0) {
        s.shield--;
        if (s.shield === 0) ctx.say(`${s.name}の陣営のダメージ半減効果が切れた。`);
      }
    }
    // 速度順にスキル発動
    const order = [0, 1].sort((a, b) => eff(active(st, b), 'spd') - eff(active(st, a), 'spd'));
    for (const side of order) {
      const m = active(st, side), foe = active(st, 1 - side);
      if (!alive(m)) continue;
      const sk = skillOf(m);
      if (!sk || sk.unknown) continue;
      const L = m.slv, tag = `${m.name}の【${m.skill.name}】！`;
      if (sk.endSelfStat) { ctx.say(tag); changeStat(ctx, side, m, sk.endSelfStat.stat, sk.endSelfStat.pct * L, false); }
      if (sk.endSynergyAtk) {
        const ok = st.sides[side].party.some(p => p !== m && p.id !== m.id && p.baseSkill && p.baseSkill.name === m.skill.name);
        if (ok) { ctx.say(tag); changeStat(ctx, side, m, 'atk', sk.endSynergyAtk * L, false); }
      }
      if (sk.endFoeStat && alive(foe)) { ctx.say(tag); changeStat(ctx, 1 - side, foe, sk.endFoeStat.stat, -sk.endFoeStat.pct * L, true); }
      if (sk.endFoeVp && alive(foe) && !foe.impulse && foe.vp > 0) { ctx.say(tag); drainVp(ctx, foe, sk.endFoeVp * L); }
      if (sk.endPartyVp) {
        let any = false;
        for (const p of st.sides[side].party) if (alive(p) && p.vp < p.maxvp) { p.vp = Math.min(p.maxvp, p.vp + sk.endPartyVp * L); any = true; }
        if (any) ctx.say(`${tag} 味方全員のＶＰが回復した！`);
      }
      if (sk.endSelfVp && m.vp < m.maxvp) { ctx.say(tag); healVp(ctx, m, sk.endSelfVp * L); }
      if (sk.endRegen && m.hp < m.maxhp) { ctx.say(tag); healHp(ctx, m, Math.max(1, Math.floor(m.maxhp * sk.endRegen * L / 100))); }
      if (sk.endNull && alive(foe) && !foe.impulse && foe.skill && !foe.skillNull && ctx.rand() * 100 < sk.endNull * L) {
        foe.skillNull = true;
        ctx.say(`${tag} ${foe.name}のスキル【${foe.skill.name}】を無効化した！`);
      }
      if (sk.endClear && alive(foe) && !foe.impulse && ctx.rand() * 100 < sk.endClear * L) {
        let any = false;
        for (const k of ['atk', 'df', 'spd']) if (foe.mods[k] > 1) { foe.mods[k] = 1; any = true; }
        if (any) ctx.say(`${tag} ${foe.name}の能力上昇を打ち消した！`);
      }
    }
  }

  /* ---------- 行動順 ---------- */
  function priorityOf(state, side, action) {
    if (action.type === 'switch') return 10;
    if (action.type === 'spell') {
      const m = active(state, side);
      const sp = KODAMA[m.id].spells[m.spells[action.slot]];
      if (sp) return parseSpellEffect(sp.desc).priority;
    }
    return 0;
  }

  /* ---------- 公開API: ターン解決 ---------- */
  // actions: [action0, action1]  phase=command では両方、phase=switch では need のある側のみ
  function resolve(state, actions) {
    const st = JSON.parse(JSON.stringify(state));
    const ctx = makeCtx(st);
    st.log = [];

    // 降参
    for (let side = 0; side < 2; side++) {
      if (actions[side] && actions[side].type === 'surrender') {
        ctx.say(`${st.sides[side].name}は降参した…`);
        return finish(ctx, st, 1 - side);
      }
    }

    if (st.phase === 'switch') {
      for (let side = 0; side < 2; side++) {
        if (!st.need[side]) continue;
        const a = actions[side];
        doSwitch(ctx, side, a.to, true);
      }
      return afterTurn(ctx, st, false);
    }

    for (let side = 0; side < 2; side++) {
      const m = active(st, side);
      m.dmgTakenTurn = 0; m.hitThisTurn = false;
    }
    // 交代は最優先
    const order = [0, 1].map(side => ({
      side, action: actions[side],
      pri: priorityOf(st, side, actions[side]),
      spd: eff(active(st, side), 'spd'),
      tie: ctx.rand(),
    })).sort((a, b) => b.pri - a.pri || b.spd - a.spd || a.tie - b.tie);

    for (const o of order) {
      if (o.action.type === 'switch') doSwitch(ctx, o.side, o.action.to, false);
    }
    // 交代後の速度で並び直し
    for (const o of order) o.spd = eff(active(st, o.side), 'spd');
    order.sort((a, b) => b.pri - a.pri || b.spd - a.spd || a.tie - b.tie);
    for (const o of order) {
      if (o.action.type === 'switch') continue;
      if (anySideWiped(st)) break;
      if (st.sides[o.side].frozen > 0 && active(st, o.side).impulse) {
        ctx.say(`${active(st, o.side).name}は止まった時の中でも動ける！`);
      } else if (st.sides[o.side].frozen > 0) {
        const m = active(st, o.side);
        if (alive(m)) ctx.say(`${m.name}は止まった時の中で動けない！`);
        continue;
      }
      execute(ctx, o.side, o.action);
      // 2回行動（速度が相手の2倍以上）
      const um = active(st, o.side), fm = active(st, 1 - o.side);
      const usk2 = skillOf(um);
      if (usk2 && usk2.doubleAct && alive(um) && alive(fm) && !anySideWiped(st) && eff(um, 'spd') >= 2 * eff(fm, 'spd')) {
        ctx.say(`${um.name}の【${um.skill.name}】！ 速すぎてもう一度行動できる！`);
        execute(ctx, o.side, o.action);
      }
    }
    if (!anySideWiped(st)) endOfTurn(ctx);
    return afterTurn(ctx, st, true);
  }

  function anySideWiped(st) { return st.sides.some(s => aliveCount(s) === 0); }

  function afterTurn(ctx, st, advance) {
    const wiped = st.sides.map(s => aliveCount(s) === 0);
    if (wiped[0] || wiped[1]) {
      const w = wiped[0] && wiped[1] ? -1 : wiped[0] ? 1 : 0;
      return finish(ctx, st, w);
    }
    if (advance) st.turn++;
    if (st.turn > TURN_LIMIT) {
      ctx.say(`${TURN_LIMIT}ターンが経過した！ 残りＨＰの割合で判定！`);
      const ratio = st.sides.map(s => s.party.reduce((a, m) => a + m.hp / m.maxhp, 0));
      return finish(ctx, st, ratio[0] === ratio[1] ? -1 : ratio[0] > ratio[1] ? 0 : 1);
    }
    st.need = [0, 1].map(side => !alive(active(st, side)));
    if (st.need[0] || st.need[1]) {
      st.phase = 'switch';
    } else {
      st.phase = 'command';
      st.need = [true, true];
      ctx.say('', { prompt: true });
    }
    st.log = ctx.flush();
    return st;
  }

  function finish(ctx, st, winner) {
    st.phase = 'end';
    st.winner = winner;
    st.need = [false, false];
    if (winner === -1) ctx.say('引き分け！');
    else ctx.say(`${st.sides[winner].name}の勝利！`, { win: winner });
    st.log = ctx.flush();
    return st;
  }

  /* ---------- AI（NPC） ---------- */
  function expectedDamage(state, side, slotOrNormal) {
    const user = active(state, side), target = active(state, 1 - side);
    const k = KODAMA[user.id];
    let sp;
    if (slotOrNormal === 'normal') sp = { type: user.types[0], pow: NORMAL_POWER, desc: '' };
    else sp = k.spells[user.spells[slotOrNormal]];
    const power = parseInt(sp.pow) || 0;
    if (!power) return 0;
    const e = parseSpellEffect(sp.desc || '');
    const type = e.mirrorType ? target.types[0] : sp.type;
    let d = Math.floor(Math.floor(Math.floor(2 * user.lv / 5 + 2) * power * eff(user, 'atk') / eff(target, 'df')) / 50) + 2;
    if (user.types.includes(type)) d *= STAB;
    d *= typeMult(type, target.types) * 0.925;
    if (state.sides[1 - side].shield > 0) d *= 0.5;
    return d;
  }

  function chooseAI(state, side, level) {
    level = level || 'normal';
    const rand = Math.random;
    const acts = validActions(state, side);
    if (state.phase === 'switch') {
      // 相手に有利な属性のコダマを選ぶ
      const foe = active(state, 1 - side);
      let best = acts[0], bestScore = -Infinity;
      for (const a of acts) {
        const m = state.sides[side].party[a.to];
        const k = KODAMA[m.id];
        let atkBest = 0;
        for (const si of m.spells) { const sp = k.spells[si]; if (parseInt(sp.pow)) atkBest = Math.max(atkBest, typeMult(sp.type, foe.types) * (m.types.includes(sp.type) ? 1.5 : 1)); }
        let defWorst = 0;
        for (const t of foe.types) defWorst = Math.max(defWorst, typeMult(t, m.types));
        const score = atkBest - defWorst * 0.7 + m.hp / m.maxhp + rand() * (level === 'easy' ? 3 : 0.3);
        if (score > bestScore) { bestScore = score; best = a; }
      }
      return best;
    }
    const me = active(state, side), foe = active(state, 1 - side);
    const k = KODAMA[me.id];
    let best = { type: 'normal' }, bestScore = -Infinity;
    for (const a of acts) {
      let score;
      if (a.type === 'normal') score = expectedDamage(state, side, 'normal');
      else if (a.type === 'spell') {
        const sp = k.spells[me.spells[a.slot]];
        const e = parseSpellEffect(sp.desc);
        score = expectedDamage(state, side, a.slot);
        if (score >= foe.hp) score += 200 - sp.cost; // 倒せるなら最優先
        if (e.priority > 0 && score >= foe.hp) score += 100;
        if (e.halfHp) score = foe.hp / 2;
        if (e.shield) score = state.sides[side].shield ? -50 : 40;
        if (e.timeStop) score = state.sides[1 - side].frozen ? -100 : 5000;
        if (e.impulse) score = me.impulse ? -100 : 4500;
        if (e.counter) score = me.hp > me.maxhp * 0.5 ? 45 : 10;
        const msk = skillOf(me);
        const stacker = msk && msk.doubleAct; // 2回行動持ちはバフを積んでから殴る
        const needSpd = stacker && eff(me, 'spd') < 2 * eff(foe, 'spd');
        for (const s of e.stats || []) {
          if (s.who === 'self' && s.pct > 0 && me.mods[s.stat] < 2.5) {
            score += s.pct * (stacker ? 1.6 : 0.4) * (stacker ? me.hp / me.maxhp : 1);
            if (needSpd && s.stat === 'spd') score += 120;
          }
          if (s.who === 'foe' && s.pct < 0 && foe.mods[s.stat] > 0.5) score += -s.pct * 0.3;
        }
        if (e.vpDrain) score += 5;
        if (e.partyVp || e.selfVp) score = me.vp < me.maxvp * 0.4 ? 60 : -20;
        if (e.selfHp) score = me.hp < me.maxhp * 0.5 ? 70 : -20;
        if (e.selfKO) score = me.hp < me.maxhp * 0.3 ? score : -100;
        score -= sp.cost * 0.15;
      } else if (a.type === 'rest') {
        score = me.vp < 20 ? 35 : -100;
      } else if (a.type === 'switch') {
        if (level === 'easy') score = -100;
        else {
          let worst = 0;
          for (const t of foe.types) worst = Math.max(worst, typeMult(t, me.types));
          const m = state.sides[side].party[a.to];
          let incoming = 0;
          for (const t of foe.types) incoming = Math.max(incoming, typeMult(t, m.types));
          score = worst >= 2 && incoming <= 0.5 ? 50 : -100;
        }
      }
      score += rand() * (level === 'easy' ? 60 : level === 'hard' ? 4 : 15);
      if (score > bestScore) { bestScore = score; best = a; }
    }
    // どの攻撃も通らない（無効化され続ける）場合は交代して膠着を避ける
    const canHurt = acts.some(a => (a.type === 'normal' || a.type === 'spell') &&
      expectedDamage(state, side, a.type === 'normal' ? 'normal' : a.slot) > 0);
    const sw = acts.filter(a => a.type === 'switch');
    if (!canHurt && sw.length && best.type !== 'rest') {
      let bs = -Infinity;
      for (const a of sw) {
        const m = state.sides[side].party[a.to];
        const k = KODAMA[m.id];
        let sc = typeMult(m.types[0], foe.types);
        for (const si of m.spells) { const sp = k.spells[si]; if (parseInt(sp.pow)) sc = Math.max(sc, typeMult(sp.type, foe.types)); }
        sc += rand() * 0.1;
        if (sc > bs) { bs = sc; best = a; }
      }
    }
    return best;
  }

  global.GK = {
    TYPES, KODAMA, MAX_PARTY, MAX_SPELLS, NORMAL_POWER,
    typeMult, parseSpellEffect, parseSkill, calcStats, sanitizeBuild, defaultSpells,
    createBattle, resolve, validActions, isValid, chooseAI, active,
  };
})(typeof window !== 'undefined' ? window : globalThis);
