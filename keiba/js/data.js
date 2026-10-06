// ゲームの静的データ（カード・スキル・レース・ミッション・用語）
// ロジックはここに書かず、データのみを置く。
'use strict';

const GAME_DATA = {};

GAME_DATA.rarities = ['N', 'R', 'SR', 'SSR', 'UR'];

// 配合料（親カードのレアリティごと）
GAME_DATA.breedingFee = { N: 300, R: 600, SR: 1200, SSR: 2500, UR: 5000 };

GAME_DATA.stats = [
  { key: 'speed', label: 'スピード', icon: '⚡', desc: '最高速度。短い距離ほど大事。' },
  { key: 'stamina', label: 'スタミナ', icon: '❤️', desc: '長い距離を走りきる体力。足りないと終盤にバテる。' },
  { key: 'power', label: 'パワー', icon: '💪', desc: '加速力。坂や重い馬場（雨の日）に強くなる。' },
  { key: 'guts', label: '根性', icon: '🔥', desc: '接戦やバテた時の粘り強さ。' },
  { key: 'intelligence', label: '賢さ', icon: '🧠', desc: 'スキルが発動しやすくなり、走りが安定する。' }
];

GAME_DATA.distances = [
  { key: 'sprint', label: 'スプリント', short: '短距離', range: '1000〜1400m', max: 1400 },
  { key: 'mile', label: 'マイル', short: 'マイル', range: '1401〜1800m', max: 1800 },
  { key: 'classic', label: 'クラシック', short: '中距離', range: '1801〜2400m', max: 2400 },
  { key: 'long', label: 'ロング', short: '長距離', range: '2401m〜', max: 99999 }
];

GAME_DATA.surfaces = [
  { key: 'turf', label: '芝', icon: '🌱' },
  { key: 'dirt', label: 'ダート', icon: '🟫' }
];

// 馬場状態（powerが高いほど重い馬場で強い）
GAME_DATA.grounds = [
  { key: 0, label: '良', weight: 60 },
  { key: 1, label: '稍重', weight: 20 },
  { key: 2, label: '重', weight: 13 },
  { key: 3, label: '不良', weight: 7 }
];

GAME_DATA.styles = {
  nige: { label: '逃げ', icon: '🔴', desc: '最初から先頭を走り、そのまま逃げきるタイプ' },
  senko: { label: '先行', icon: '🟠', desc: '前の方の位置をキープして、早めに抜け出すタイプ' },
  sashi: { label: '差し', icon: '🔵', desc: '最後の方で一気に追い抜くタイプ' },
  oikomi: { label: '追込', icon: '🟣', desc: '後ろでじっと力をため、最後に大外から追い込むタイプ' }
};

GAME_DATA.growthTypes = {
  early: { label: '早熟', desc: '2〜3歳でぐんぐん伸びる。年をとると成長が止まりやすい。', mult: [1.35, 1.15, 0.75, 0.45, 0.3] },
  normal: { label: '普通', desc: 'バランスよく成長する。3〜4歳がピーク。', mult: [1.0, 1.15, 1.0, 0.7, 0.4] },
  late: { label: '晩成', desc: '若いうちはゆっくり。4歳以降に大きく伸びる。', mult: [0.7, 0.95, 1.25, 1.1, 0.7] }
};

// カレンダー：1年＝12か月×4週。馬は1週に1回行動（調教・レース・休養）できる。
// 1月1週に年が明け、全馬が1歳年をとる（JRAと同じく誕生日は1月1日扱い）。
GAME_DATA.weeksPerYear = 48;
GAME_DATA.startWeek = 20;   // ゲーム開始は6月1週（2歳新馬戦の開幕）
GAME_DATA.retireAge = 6;    // 6歳の1月1週で引退
GAME_DATA.maxStable = 6;

// ───────── 種牡馬カード ─────────
// stats/apt は 0〜100。trait = 遺伝傾向、skill = 子に受け継がれやすいスキル
GAME_DATA.sires = [
  { id: 's_hayate', name: 'ハヤテボーイ', rarity: 'N', stats: { speed: 62, stamina: 38, power: 52, guts: 48, intelligence: 42 },
    apt: { turf: 75, dirt: 55, sprint: 85, mile: 55, classic: 30, long: 15 }, style: 'nige', growth: 'early', trait: 'speed', skill: 'k_rocket',
    desc: 'スタートが自慢の快速馬。' },
  { id: 's_daichi', name: 'ダイチノチカラ', rarity: 'N', stats: { speed: 48, stamina: 50, power: 66, guts: 55, intelligence: 40 },
    apt: { turf: 40, dirt: 90, sprint: 70, mile: 70, classic: 40, long: 20 }, style: 'senko', growth: 'normal', trait: 'power', skill: 'k_mud',
    desc: '砂の上なら負けない力自慢。' },
  { id: 's_little', name: 'リトルミラクル', rarity: 'N', stats: { speed: 50, stamina: 52, power: 44, guts: 60, intelligence: 78 },
    apt: { turf: 80, dirt: 50, sprint: 40, mile: 65, classic: 70, long: 55 }, style: 'oikomi', growth: 'late', trait: 'intelligence', skill: 'k_doto',
    desc: '小さな体に奇跡の末脚。レア度以上の血を秘める。' },
  { id: 's_iron', name: 'アイアンハート', rarity: 'R', stats: { speed: 60, stamina: 62, power: 68, guts: 76, intelligence: 52 },
    apt: { turf: 55, dirt: 85, sprint: 50, mile: 85, classic: 60, long: 35 }, style: 'senko', growth: 'normal', trait: 'guts', skill: 'k_nebari',
    desc: '絶対に諦めない鉄の心臓。' },
  { id: 's_ocean', name: 'ブルーオーシャン', rarity: 'R', stats: { speed: 58, stamina: 80, power: 56, guts: 64, intelligence: 60 },
    apt: { turf: 85, dirt: 40, sprint: 20, mile: 45, classic: 75, long: 90 }, style: 'sashi', growth: 'late', trait: 'stamina', skill: 'k_stamkeep',
    desc: 'どこまでも走れる大海原のような体力。' },
  { id: 's_green', name: 'グリーンウインド', rarity: 'R', stats: { speed: 70, stamina: 58, power: 60, guts: 56, intelligence: 62 },
    apt: { turf: 88, dirt: 45, sprint: 55, mile: 88, classic: 60, long: 30 }, style: 'sashi', growth: 'normal', trait: 'speed', skill: 'k_kick',
    desc: '芝のマイルを吹き抜ける風。' },
  { id: 's_midnight', name: 'ミッドナイトラン', rarity: 'SR', stats: { speed: 72, stamina: 82, power: 66, guts: 70, intelligence: 70 },
    apt: { turf: 90, dirt: 40, sprint: 25, mile: 60, classic: 92, long: 80 }, style: 'senko', growth: 'normal', trait: 'stamina', skill: 'k_breakout',
    desc: '夜明けまで走り続けるクラシックの申し子。' },
  { id: 's_goldrush', name: 'ゴールドラッシュ', rarity: 'SR', stats: { speed: 74, stamina: 64, power: 84, guts: 70, intelligence: 60 },
    apt: { turf: 50, dirt: 95, sprint: 75, mile: 90, classic: 55, long: 25 }, style: 'nige', growth: 'early', trait: 'power', skill: 'k_keeplead',
    desc: 'ダートの黄金時代を築いた豪腕。' },
  { id: 's_skyhigh', name: 'スカイハイ', rarity: 'SR', stats: { speed: 84, stamina: 58, power: 70, guts: 60, intelligence: 66 },
    apt: { turf: 90, dirt: 50, sprint: 85, mile: 85, classic: 45, long: 20 }, style: 'senko', growth: 'early', trait: 'speed', skill: 'k_senkoaccel',
    desc: '空まで駆け上がるような加速力。' },
  { id: 's_thunder', name: 'サンダーロード', rarity: 'SSR', stats: { speed: 94, stamina: 66, power: 82, guts: 72, intelligence: 70 },
    apt: { turf: 95, dirt: 70, sprint: 92, mile: 90, classic: 50, long: 25 }, style: 'senko', growth: 'normal', trait: 'speed', skill: 'k_sprintking',
    desc: '雷鳴のごとき快速。短距離〜マイルの王。' },
  { id: 's_king', name: 'キングオブロード', rarity: 'SSR', stats: { speed: 80, stamina: 92, power: 80, guts: 82, intelligence: 76 },
    apt: { turf: 95, dirt: 50, sprint: 30, mile: 65, classic: 95, long: 88 }, style: 'sashi', growth: 'late', trait: 'stamina', skill: 'k_sashikiri',
    desc: 'クラシック三冠を制した王者の血。' },
  { id: 's_emperor', name: 'エンペラーステラ', rarity: 'UR', stats: { speed: 92, stamina: 90, power: 88, guts: 86, intelligence: 90 },
    apt: { turf: 95, dirt: 75, sprint: 60, mile: 90, classic: 95, long: 85 }, style: 'senko', growth: 'normal', trait: 'balance', skill: 'k_emperor',
    desc: '星の名を持つ皇帝。全てを兼ね備えた伝説の種牡馬。' }
];

// ───────── 繁殖牝馬カード ─────────
GAME_DATA.mares = [
  { id: 'm_sakura', name: 'サクラコマチ', rarity: 'N', stats: { speed: 58, stamina: 46, power: 48, guts: 50, intelligence: 52 },
    apt: { turf: 80, dirt: 45, sprint: 70, mile: 70, classic: 40, long: 20 }, style: 'senko', growth: 'early', trait: 'speed', skill: 'k_goodpos',
    desc: '春風のように軽やかな走り。' },
  { id: 'm_tsuchi', name: 'ツチノコヒメ', rarity: 'N', stats: { speed: 46, stamina: 58, power: 60, guts: 58, intelligence: 46 },
    apt: { turf: 45, dirt: 85, sprint: 45, mile: 75, classic: 60, long: 35 }, style: 'sashi', growth: 'late', trait: 'power', skill: 'k_outside',
    desc: '泥んこ馬場が大好きなお転婆娘。' },
  { id: 'm_lucky', name: 'ラッキーリボン', rarity: 'N', stats: { speed: 52, stamina: 50, power: 46, guts: 72, intelligence: 60 },
    apt: { turf: 70, dirt: 65, sprint: 55, mile: 65, classic: 60, long: 45 }, style: 'nige', growth: 'normal', trait: 'guts', skill: 'k_tataki',
    desc: '勝負強さはG1級。幸運を運ぶリボン。' },
  { id: 'm_rose', name: 'ローズガーデン', rarity: 'R', stats: { speed: 66, stamina: 64, power: 56, guts: 58, intelligence: 64 },
    apt: { turf: 88, dirt: 40, sprint: 45, mile: 85, classic: 75, long: 45 }, style: 'sashi', growth: 'normal', trait: 'speed', skill: 'k_kick',
    desc: 'バラ園を駆ける気品ある末脚。' },
  { id: 'm_silver', name: 'シルバーベル', rarity: 'R', stats: { speed: 60, stamina: 74, power: 58, guts: 62, intelligence: 64 },
    apt: { turf: 85, dirt: 50, sprint: 25, mile: 55, classic: 85, long: 80 }, style: 'senko', growth: 'late', trait: 'stamina', skill: 'k_calm',
    desc: '銀の鈴のように澄んだ持久力。' },
  { id: 'm_dune', name: 'デューンダンサー', rarity: 'R', stats: { speed: 64, stamina: 56, power: 72, guts: 60, intelligence: 54 },
    apt: { turf: 45, dirt: 90, sprint: 80, mile: 75, classic: 40, long: 20 }, style: 'nige', growth: 'early', trait: 'power', skill: 'k_rocket',
    desc: '砂丘を舞う踊り子。' },
  { id: 'm_star', name: 'スターレディ', rarity: 'SR', stats: { speed: 80, stamina: 62, power: 66, guts: 64, intelligence: 70 },
    apt: { turf: 90, dirt: 45, sprint: 80, mile: 90, classic: 50, long: 25 }, style: 'senko', growth: 'normal', trait: 'speed', skill: 'k_breakout',
    desc: 'マイルの女王に輝いた一番星。' },
  { id: 'm_aurora', name: 'オーロラヴェール', rarity: 'SR', stats: { speed: 70, stamina: 84, power: 62, guts: 70, intelligence: 74 },
    apt: { turf: 90, dirt: 35, sprint: 20, mile: 55, classic: 90, long: 90 }, style: 'sashi', growth: 'late', trait: 'stamina', skill: 'k_stayer',
    desc: '極光のように長く輝く持久力。' },
  { id: 'm_crimson', name: 'クリムゾンフレア', rarity: 'SR', stats: { speed: 76, stamina: 60, power: 78, guts: 74, intelligence: 58 },
    apt: { turf: 60, dirt: 88, sprint: 65, mile: 88, classic: 60, long: 30 }, style: 'oikomi', growth: 'normal', trait: 'power', skill: 'k_ooso',
    desc: '燃えるような追い込みで砂を焦がす。' },
  { id: 'm_moon', name: 'ムーンレディ', rarity: 'SSR', stats: { speed: 84, stamina: 82, power: 70, guts: 74, intelligence: 80 },
    apt: { turf: 95, dirt: 50, sprint: 50, mile: 92, classic: 88, long: 60 }, style: 'sashi', growth: 'normal', trait: 'stamina', skill: 'k_kick',
    desc: '月明かりの女王。数々の名馬の母。' },
  { id: 'm_tiara', name: 'ティアラクイーン', rarity: 'SSR', stats: { speed: 90, stamina: 70, power: 76, guts: 70, intelligence: 78 },
    apt: { turf: 95, dirt: 55, sprint: 75, mile: 95, classic: 70, long: 35 }, style: 'senko', growth: 'early', trait: 'speed', skill: 'k_escape',
    desc: '牝馬三冠のティアラを戴いた女王。' },
  { id: 'm_goddess', name: 'ヴィーナスオリジン', rarity: 'UR', stats: { speed: 90, stamina: 92, power: 84, guts: 88, intelligence: 92 },
    apt: { turf: 95, dirt: 80, sprint: 55, mile: 90, classic: 95, long: 90 }, style: 'sashi', growth: 'late', trait: 'balance', skill: 'k_sashikiri',
    desc: '全ての名牝の始まりと言われる伝説の牝馬。' }
];

// ───────── スキルカード ─────────
// cond: phase(start/mid/corner/final), remainMax(残り距離m以下), rankMin/rankMax(順位),
//       distCat, groundMin, close(接戦)
// effect: speed(速度倍率+), hp(体力回復), duration(秒)
GAME_DATA.skills = [
  { id: 'k_rocket', name: 'ロケットスタート', rarity: 'R', style: 'nige', icon: '🚀',
    desc: 'レース開始時、序盤の加速力アップ。', condText: 'レース開始時',
    cond: { phase: 'start' }, effect: { speed: 0.08, duration: 6 } },
  { id: 'k_keeplead', name: '先頭維持', rarity: 'R', style: 'nige', icon: '🏁',
    desc: '中盤に1〜2位なら速度アップ。', condText: '中盤・1〜2位',
    cond: { phase: 'mid', rankMax: 2 }, effect: { speed: 0.04, duration: 15 } },
  { id: 'k_escape', name: '逃走本能', rarity: 'SR', style: 'nige', icon: '💨',
    desc: '最終直線で先頭なら、さらに突き放す。', condText: '最終直線・1位',
    cond: { phase: 'final', rankMax: 1 }, effect: { speed: 0.07, duration: 10 } },
  { id: 'k_goodpos', name: '好位キープ', rarity: 'N', style: 'senko', icon: '🎯',
    desc: '中盤に2〜5位なら体力を温存できる。', condText: '中盤・2〜5位',
    cond: { phase: 'mid', rankMin: 2, rankMax: 5 }, effect: { speed: 0.02, hp: 90, duration: 10 } },
  { id: 'k_senkoaccel', name: '先行加速', rarity: 'R', style: 'senko', icon: '⏩',
    desc: '第4コーナーで2〜4位なら加速。', condText: 'コーナー・2〜4位',
    cond: { phase: 'corner', rankMin: 2, rankMax: 4 }, effect: { speed: 0.05, duration: 10 } },
  { id: 'k_breakout', name: '抜け出し', rarity: 'SR', style: 'senko', icon: '↗️',
    desc: '最終直線で2〜3位なら一気に抜け出す。', condText: '最終直線・2〜3位',
    cond: { phase: 'final', rankMin: 2, rankMax: 3 }, effect: { speed: 0.08, duration: 8 } },
  { id: 'k_kick', name: '末脚', rarity: 'R', style: 'sashi', icon: '⚡',
    desc: '残り400mで3〜6位なら終盤スピード大幅アップ。', condText: '残り400m・3〜6位',
    cond: { remainMax: 400, rankMin: 3, rankMax: 6 }, effect: { speed: 0.08, duration: 10 } },
  { id: 'k_sashikiri', name: '差し切り', rarity: 'SSR', style: 'sashi', icon: '🗡️',
    desc: '残り250mで2〜4位なら前の馬をとらえる強烈な伸び。', condText: '残り250m・2〜4位',
    cond: { remainMax: 250, rankMin: 2, rankMax: 4 }, effect: { speed: 0.12, duration: 8 } },
  { id: 'k_outside', name: '外差し', rarity: 'R', style: 'sashi', icon: '↪️',
    desc: 'コーナーで4位以下なら外から進出。', condText: 'コーナー・4位以下',
    cond: { phase: 'corner', rankMin: 4 }, effect: { speed: 0.05, duration: 12 } },
  { id: 'k_ooso', name: '大外一気', rarity: 'SR', style: 'oikomi', icon: '🌪️',
    desc: '最終直線で5位以下なら追込性能アップ。', condText: '最終直線・5位以下',
    cond: { phase: 'final', rankMin: 5 }, effect: { speed: 0.09, duration: 10 } },
  { id: 'k_lastaccel', name: '最終加速', rarity: 'R', style: 'oikomi', icon: '🔺',
    desc: '残り300mで3位以下なら加速。', condText: '残り300m・3位以下',
    cond: { remainMax: 300, rankMin: 3 }, effect: { speed: 0.07, duration: 8 } },
  { id: 'k_doto', name: '怒涛の追撃', rarity: 'SSR', style: 'oikomi', icon: '🌊',
    desc: '最終直線で6位以下なら、怒涛の勢いで追い上げる。', condText: '最終直線・6位以下',
    cond: { phase: 'final', rankMin: 6 }, effect: { speed: 0.13, duration: 10 } },
  { id: 'k_nebari', name: '粘り腰', rarity: 'R', style: null, icon: '🛡️',
    desc: '最終直線で1〜2位なら、後続に抜かれにくくなる。', condText: '最終直線・1〜2位',
    cond: { phase: 'final', rankMax: 2 }, effect: { speed: 0.03, hp: 120, duration: 10 } },
  { id: 'k_stamkeep', name: 'スタミナキープ', rarity: 'N', style: null, icon: '🍃',
    desc: '中盤で体力を回復する。長い距離で役立つ。', condText: '中盤',
    cond: { phase: 'mid' }, effect: { hp: 160, duration: 1 } },
  { id: 'k_calm', name: '冷静沈着', rarity: 'N', style: null, icon: '🧘',
    desc: 'スタート直後に落ち着いて体力を温存。', condText: 'レース開始時',
    cond: { phase: 'start' }, effect: { speed: 0.02, hp: 70, duration: 5 } },
  { id: 'k_tataki', name: '根性の叩き合い', rarity: 'SR', style: null, icon: '🔥',
    desc: '最終直線で他の馬と並んだ時、根性で競り勝つ。', condText: '最終直線・接戦',
    cond: { phase: 'final', close: true }, effect: { speed: 0.07, duration: 8 } },
  { id: 'k_mud', name: '道悪巧者', rarity: 'R', style: null, icon: '🌧️',
    desc: '重・不良馬場で速度アップ。', condText: '重・不良馬場',
    cond: { phase: 'mid', groundMin: 2 }, effect: { speed: 0.05, duration: 20 } },
  { id: 'k_sprintking', name: '短距離の鬼', rarity: 'SR', style: null, icon: '👹',
    desc: 'スプリント戦のコーナーで速度アップ。', condText: 'スプリント・コーナー',
    cond: { phase: 'corner', distCat: 'sprint' }, effect: { speed: 0.06, duration: 12 } },
  { id: 'k_stayer', name: '長距離の鬼', rarity: 'SR', style: null, icon: '🏔️',
    desc: 'ロング戦の終盤で体力回復＋速度アップ。', condText: 'ロング・最終直線',
    cond: { phase: 'corner', distCat: 'long' }, effect: { speed: 0.03, hp: 260, duration: 12 } },
  { id: 'k_emperor', name: '皇帝の威光', rarity: 'UR', style: null, icon: '👑',
    desc: '残り600mから王者の走り。全脚質で効果大。', condText: '残り600m',
    cond: { remainMax: 600 }, effect: { speed: 0.10, duration: 14 } }
];

// ───────── アイテムカード ─────────
GAME_DATA.items = [
  { id: 'i_speedtr', name: 'スピードトレーニング', rarity: 'N', icon: '⚡', price: 600,
    desc: 'スピード調教の効果が2倍。', use: { train: 'speed', mult: 2 } },
  { id: 'i_stamtr', name: 'スタミナトレーニング', rarity: 'N', icon: '❤️', price: 600,
    desc: 'スタミナ調教の効果が2倍。', use: { train: 'stamina', mult: 2 } },
  { id: 'i_powtr', name: 'パワートレーニング', rarity: 'N', icon: '💪', price: 600,
    desc: 'パワー調教の効果が2倍。', use: { train: 'power', mult: 2 } },
  { id: 'i_refresh', name: 'リフレッシュ', rarity: 'N', icon: '🛁', price: 500,
    desc: '疲労を40回復し、調子を上げる。週は進まない。', use: { fatigue: -40, condition: 20 } },
  { id: 'i_carrot', name: '特上にんじん', rarity: 'R', icon: '🥕', price: 1200,
    desc: '調子が絶好調になる。', use: { condition: 100 } },
  { id: 'i_exp', name: '経験値ブック', rarity: 'R', icon: '📘', price: 1500,
    desc: '経験値+300。', use: { exp: 300 } },
  { id: 'i_special', name: '特別調教', rarity: 'SR', icon: '🌟', price: 4000,
    desc: '全能力+3（限界も+2）。', use: { allStats: 3, allCaps: 2 } },
  { id: 'i_potential', name: '素質の霊薬', rarity: 'SSR', icon: '🧪', price: null,
    desc: '全能力の限界値+6。秘められた力が目覚める。', use: { allCaps: 6 } }
];

// ───────── 路線 ─────────
GAME_DATA.routes = [
  { id: 'sprint', name: 'スプリンター', icon: '⚡', range: '1000〜1400m', key: 'スピード・パワー',
    desc: '短い距離を一瞬で駆け抜ける。スピード自慢の馬向け。' },
  { id: 'mile', name: 'マイラー', icon: '🌟', range: '1400〜1800m', key: 'スピード・スタミナ',
    desc: '速さと体力のバランスが大事。いちばん人気の路線。' },
  { id: 'classic', name: 'クラシック', icon: '👑', range: '1800〜3000m', key: 'スタミナ・スピード・パワー',
    desc: '2〜3歳だけが挑める、一生に一度の大舞台。' },
  { id: 'filly', name: '牝馬クラシック', icon: '🌸', range: '1600〜2400m', key: 'スピード・スタミナ',
    desc: '2〜3歳の牝馬（女の子）だけのティアラ路線。' },
  { id: 'senior', name: '王道古馬', icon: '🏆', range: '2000〜3200m', key: 'スタミナ・根性',
    desc: '3歳秋〜の古馬が最強を競う王道。' }
];

// ───────── レース ─────────
// grade: debut(新馬) maiden(未勝利) cond(1勝クラス) c2(2勝クラス) c3(3勝クラス) op(オープン) g3 g2 g1
// クラスは勝利数で決まる：0勝→新馬・未勝利、1勝→1勝クラス、2勝→2勝クラス、3勝→3勝クラス、4勝以上 or 重賞勝ち→オープン
GAME_DATA.grades = {
  debut: { label: '新馬', short: '新馬', npc: 46, prize: 700, exp: 60, order: 0 },
  maiden: { label: '未勝利', short: '未勝利', npc: 48, prize: 550, exp: 60, order: 1 },
  cond: { label: '1勝クラス', short: '1勝', npc: 55, prize: 800, exp: 80, order: 2 },
  c2: { label: '2勝クラス', short: '2勝', npc: 59, prize: 1100, exp: 90, order: 3 },
  c3: { label: '3勝クラス', short: '3勝', npc: 63, prize: 1500, exp: 100, order: 4 },
  op: { label: 'オープン', short: 'OP', npc: 66, prize: 2400, exp: 110, order: 5 },
  g3: { label: 'GⅢ', short: 'GⅢ', npc: 71, prize: 4000, exp: 130, order: 6 },
  g2: { label: 'GⅡ', short: 'GⅡ', npc: 75, prize: 6000, exp: 160, order: 7 },
  g1: { label: 'GⅠ', short: 'GⅠ', npc: 80, prize: 15000, exp: 220, order: 8 }
};

// ───────── JRA 重賞カレンダー ─────────
// 実在のJRA重賞（年間スケジュールをもとに、1か月＝4週に丸めて配置）。
// m=月 w=週(1〜4) ages: '2'=2歳 '3'=3歳 '3+'=3歳以上 '4+'=4歳以上  f=牝馬限定
// trial: { to: 本番レースID, top: 何着までに優先出走権 }  crown: 三冠などの称号判定用
// prize: 1着賞金（ゲーム内G。省略時は格の標準値）
GAME_DATA.races = [
  // 1月
  { id: 'nakayama_kinpai', name: '中山金杯', grade: 'g3', m: 1, w: 1, venue: '中山', surface: 'turf', distance: 2000, ages: '4+' },
  { id: 'kyoto_kinpai', name: '京都金杯', grade: 'g3', m: 1, w: 1, venue: '京都', surface: 'turf', distance: 1600, ages: '4+' },
  { id: 'fairy', name: 'フェアリーステークス', grade: 'g3', m: 1, w: 2, venue: '中山', surface: 'turf', distance: 1600, ages: '3', f: true },
  { id: 'shinzan', name: 'シンザン記念', grade: 'g3', m: 1, w: 2, venue: '京都', surface: 'turf', distance: 1600, ages: '3' },
  { id: 'keisei', name: '京成杯', grade: 'g3', m: 1, w: 3, venue: '中山', surface: 'turf', distance: 2000, ages: '3' },
  { id: 'nikkei_shinshun', name: '日経新春杯', grade: 'g2', m: 1, w: 3, venue: '京都', surface: 'turf', distance: 2400, ages: '4+' },
  { id: 'ajcc', name: 'アメリカジョッキークラブカップ', grade: 'g2', m: 1, w: 4, venue: '中山', surface: 'turf', distance: 2200, ages: '4+' },
  { id: 'tokai', name: '東海ステークス', grade: 'g2', m: 1, w: 4, venue: '中京', surface: 'dirt', distance: 1800, ages: '4+' },
  { id: 'silkroad', name: 'シルクロードステークス', grade: 'g3', m: 1, w: 4, venue: '京都', surface: 'turf', distance: 1200, ages: '4+' },
  // 2月
  { id: 'negishi', name: '根岸ステークス', grade: 'g3', m: 2, w: 1, venue: '東京', surface: 'dirt', distance: 1400, ages: '4+' },
  { id: 'kisaragi', name: 'きさらぎ賞', grade: 'g3', m: 2, w: 1, venue: '京都', surface: 'turf', distance: 1800, ages: '3' },
  { id: 'tokyo_shinbun', name: '東京新聞杯', grade: 'g3', m: 2, w: 2, venue: '東京', surface: 'turf', distance: 1600, ages: '4+' },
  { id: 'kyodo', name: '共同通信杯', grade: 'g3', m: 2, w: 2, venue: '東京', surface: 'turf', distance: 1800, ages: '3' },
  { id: 'kyoto_kinen', name: '京都記念', grade: 'g2', m: 2, w: 3, venue: '京都', surface: 'turf', distance: 2200, ages: '4+' },
  { id: 'queen_cup', name: 'クイーンカップ', grade: 'g3', m: 2, w: 3, venue: '東京', surface: 'turf', distance: 1600, ages: '3', f: true },
  { id: 'february', name: 'フェブラリーステークス', grade: 'g1', m: 2, w: 4, venue: '東京', surface: 'dirt', distance: 1600, ages: '4+', prize: 12000 },
  { id: 'kokura_daishoten', name: '小倉大賞典', grade: 'g3', m: 2, w: 4, venue: '小倉', surface: 'turf', distance: 1800, ages: '4+' },
  // 3月
  { id: 'nakayama_kinen', name: '中山記念', grade: 'g2', m: 3, w: 1, venue: '中山', surface: 'turf', distance: 1800, ages: '4+' },
  { id: 'hankyu_hai', name: '阪急杯', grade: 'g3', m: 3, w: 1, venue: '阪神', surface: 'turf', distance: 1400, ages: '4+' },
  { id: 'tulip', name: 'チューリップ賞', grade: 'g2', m: 3, w: 1, venue: '阪神', surface: 'turf', distance: 1600, ages: '3', f: true, trial: { to: 'oka', top: 3 } },
  { id: 'yayoi', name: '弥生賞ディープインパクト記念', grade: 'g2', m: 3, w: 2, venue: '中山', surface: 'turf', distance: 2000, ages: '3', trial: { to: 'satsuki', top: 3 } },
  { id: 'kinko', name: '金鯱賞', grade: 'g2', m: 3, w: 2, venue: '中京', surface: 'turf', distance: 2000, ages: '4+' },
  { id: 'spring_s', name: 'スプリングステークス', grade: 'g2', m: 3, w: 3, venue: '中山', surface: 'turf', distance: 1800, ages: '3', trial: { to: 'satsuki', top: 3 } },
  { id: 'hanshin_daishoten', name: '阪神大賞典', grade: 'g2', m: 3, w: 3, venue: '阪神', surface: 'turf', distance: 3000, ages: '4+' },
  { id: 'fillies_review', name: 'フィリーズレビュー', grade: 'g2', m: 3, w: 3, venue: '阪神', surface: 'turf', distance: 1400, ages: '3', f: true, trial: { to: 'oka', top: 3 } },
  { id: 'takamatsu', name: '高松宮記念', grade: 'g1', m: 3, w: 4, venue: '中京', surface: 'turf', distance: 1200, ages: '4+', prize: 17000 },
  { id: 'nikkei_sho', name: '日経賞', grade: 'g2', m: 3, w: 4, venue: '中山', surface: 'turf', distance: 2500, ages: '4+' },
  { id: 'mainichi_hai', name: '毎日杯', grade: 'g3', m: 3, w: 4, venue: '阪神', surface: 'turf', distance: 1800, ages: '3' },
  { id: 'march_s', name: 'マーチステークス', grade: 'g3', m: 3, w: 4, venue: '中山', surface: 'dirt', distance: 1800, ages: '4+' },
  // 4月
  { id: 'osaka_hai', name: '大阪杯', grade: 'g1', m: 4, w: 1, venue: '阪神', surface: 'turf', distance: 2000, ages: '4+', prize: 30000, crown: 'springSenior' },
  { id: 'derby_kyo', name: 'ダービー卿チャレンジトロフィー', grade: 'g3', m: 4, w: 1, venue: '中山', surface: 'turf', distance: 1600, ages: '4+' },
  { id: 'oka', name: '桜花賞', grade: 'g1', m: 4, w: 2, venue: '阪神', surface: 'turf', distance: 1600, ages: '3', f: true, prize: 15000, crown: 'tiara', trial: { to: 'oaks', top: 5 } },
  { id: 'nzt', name: 'ニュージーランドトロフィー', grade: 'g2', m: 4, w: 2, venue: '中山', surface: 'turf', distance: 1600, ages: '3', trial: { to: 'nhk_mile', top: 3 } },
  { id: 'hanshin_himba', name: '阪神牝馬ステークス', grade: 'g2', m: 4, w: 2, venue: '阪神', surface: 'turf', distance: 1600, ages: '4+', f: true },
  { id: 'satsuki', name: '皐月賞', grade: 'g1', m: 4, w: 3, venue: '中山', surface: 'turf', distance: 2000, ages: '3', prize: 20000, crown: 'classic', trial: { to: 'derby', top: 5 } },
  { id: 'antares', name: 'アンタレスステークス', grade: 'g3', m: 4, w: 3, venue: '阪神', surface: 'dirt', distance: 1800, ages: '4+' },
  { id: 'tenno_spring', name: '天皇賞（春）', grade: 'g1', m: 4, w: 4, venue: '京都', surface: 'turf', distance: 3200, ages: '4+', prize: 30000, crown: 'springSenior' },
  { id: 'flora', name: 'フローラステークス', grade: 'g2', m: 4, w: 4, venue: '東京', surface: 'turf', distance: 2000, ages: '3', f: true, trial: { to: 'oaks', top: 2 } },
  { id: 'aoba', name: '青葉賞', grade: 'g2', m: 4, w: 4, venue: '東京', surface: 'turf', distance: 2400, ages: '3', trial: { to: 'derby', top: 2 } },
  { id: 'milers_cup', name: 'マイラーズカップ', grade: 'g2', m: 4, w: 4, venue: '京都', surface: 'turf', distance: 1600, ages: '4+' },
  // 5月
  { id: 'nhk_mile', name: 'NHKマイルカップ', grade: 'g1', m: 5, w: 1, venue: '東京', surface: 'turf', distance: 1600, ages: '3', prize: 13000 },
  { id: 'kyoto_shinbun', name: '京都新聞杯', grade: 'g2', m: 5, w: 1, venue: '京都', surface: 'turf', distance: 2200, ages: '3', trial: { to: 'derby', top: 2 } },
  { id: 'victoria_mile', name: 'ヴィクトリアマイル', grade: 'g1', m: 5, w: 2, venue: '東京', surface: 'turf', distance: 1600, ages: '4+', f: true, prize: 13000 },
  { id: 'keio_spring', name: '京王杯スプリングカップ', grade: 'g2', m: 5, w: 2, venue: '東京', surface: 'turf', distance: 1400, ages: '4+' },
  { id: 'oaks', name: 'オークス（優駿牝馬）', grade: 'g1', m: 5, w: 3, venue: '東京', surface: 'turf', distance: 2400, ages: '3', f: true, prize: 15000, crown: 'tiara' },
  { id: 'heian', name: '平安ステークス', grade: 'g3', m: 5, w: 3, venue: '京都', surface: 'dirt', distance: 1900, ages: '4+' },
  { id: 'derby', name: '日本ダービー（東京優駿）', grade: 'g1', m: 5, w: 4, venue: '東京', surface: 'turf', distance: 2400, ages: '3', prize: 30000, crown: 'classic' },
  { id: 'meguro', name: '目黒記念', grade: 'g2', m: 5, w: 4, venue: '東京', surface: 'turf', distance: 2500, ages: '4+' },
  // 6月
  { id: 'yasuda', name: '安田記念', grade: 'g1', m: 6, w: 1, venue: '東京', surface: 'turf', distance: 1600, ages: '3+', prize: 18000 },
  { id: 'naruo', name: '鳴尾記念', grade: 'g3', m: 6, w: 1, venue: '阪神', surface: 'turf', distance: 2000, ages: '3+' },
  { id: 'epsom', name: 'エプソムカップ', grade: 'g3', m: 6, w: 2, venue: '東京', surface: 'turf', distance: 1800, ages: '3+' },
  { id: 'hakodate_sprint', name: '函館スプリントステークス', grade: 'g3', m: 6, w: 2, venue: '函館', surface: 'turf', distance: 1200, ages: '3+' },
  { id: 'unicorn', name: 'ユニコーンステークス', grade: 'g3', m: 6, w: 3, venue: '東京', surface: 'dirt', distance: 1600, ages: '3' },
  { id: 'mermaid', name: 'マーメイドステークス', grade: 'g3', m: 6, w: 3, venue: '阪神', surface: 'turf', distance: 2000, ages: '3+', f: true },
  { id: 'takarazuka', name: '宝塚記念', grade: 'g1', m: 6, w: 4, venue: '阪神', surface: 'turf', distance: 2200, ages: '3+', prize: 30000, crown: 'springSenior' },
  // 7月
  { id: 'radio_nikkei', name: 'ラジオNIKKEI賞', grade: 'g3', m: 7, w: 1, venue: '福島', surface: 'turf', distance: 1800, ages: '3' },
  { id: 'cbc', name: 'CBC賞', grade: 'g3', m: 7, w: 1, venue: '中京', surface: 'turf', distance: 1200, ages: '3+' },
  { id: 'tanabata', name: '七夕賞', grade: 'g3', m: 7, w: 2, venue: '福島', surface: 'turf', distance: 2000, ages: '3+' },
  { id: 'procyon', name: 'プロキオンステークス', grade: 'g3', m: 7, w: 2, venue: '中京', surface: 'dirt', distance: 1400, ages: '3+' },
  { id: 'hakodate_kinen', name: '函館記念', grade: 'g3', m: 7, w: 3, venue: '函館', surface: 'turf', distance: 2000, ages: '3+' },
  { id: 'hakodate_2yo', name: '函館2歳ステークス', grade: 'g3', m: 7, w: 3, venue: '函館', surface: 'turf', distance: 1200, ages: '2' },
  { id: 'chukyo_kinen', name: '中京記念', grade: 'g3', m: 7, w: 4, venue: '中京', surface: 'turf', distance: 1600, ages: '3+' },
  // 8月
  { id: 'ibis', name: 'アイビスサマーダッシュ', grade: 'g3', m: 8, w: 1, venue: '新潟', surface: 'turf', distance: 1000, ages: '3+' },
  { id: 'queen_s', name: 'クイーンステークス', grade: 'g3', m: 8, w: 1, venue: '札幌', surface: 'turf', distance: 1800, ages: '3+', f: true },
  { id: 'sekiya', name: '関屋記念', grade: 'g3', m: 8, w: 2, venue: '新潟', surface: 'turf', distance: 1600, ages: '3+' },
  { id: 'elm', name: 'エルムステークス', grade: 'g3', m: 8, w: 2, venue: '札幌', surface: 'dirt', distance: 1700, ages: '3+' },
  { id: 'sapporo_kinen', name: '札幌記念', grade: 'g2', m: 8, w: 3, venue: '札幌', surface: 'turf', distance: 2000, ages: '3+' },
  { id: 'kitakyushu', name: '北九州記念', grade: 'g3', m: 8, w: 3, venue: '小倉', surface: 'turf', distance: 1200, ages: '3+' },
  { id: 'niigata_2yo', name: '新潟2歳ステークス', grade: 'g3', m: 8, w: 4, venue: '新潟', surface: 'turf', distance: 1600, ages: '2' },
  { id: 'keeneland', name: 'キーンランドカップ', grade: 'g3', m: 8, w: 4, venue: '札幌', surface: 'turf', distance: 1200, ages: '3+' },
  // 9月
  { id: 'sapporo_2yo', name: '札幌2歳ステークス', grade: 'g3', m: 9, w: 1, venue: '札幌', surface: 'turf', distance: 1800, ages: '2' },
  { id: 'kokura_2yo', name: '小倉2歳ステークス', grade: 'g3', m: 9, w: 1, venue: '小倉', surface: 'turf', distance: 1200, ages: '2' },
  { id: 'niigata_kinen', name: '新潟記念', grade: 'g3', m: 9, w: 1, venue: '新潟', surface: 'turf', distance: 2000, ages: '3+' },
  { id: 'shion', name: '紫苑ステークス', grade: 'g2', m: 9, w: 2, venue: '中山', surface: 'turf', distance: 2000, ages: '3', f: true, trial: { to: 'shuka', top: 3 } },
  { id: 'centaur', name: 'セントウルステークス', grade: 'g2', m: 9, w: 2, venue: '阪神', surface: 'turf', distance: 1200, ages: '3+' },
  { id: 'keisei_ah', name: '京成杯オータムハンデキャップ', grade: 'g3', m: 9, w: 2, venue: '中山', surface: 'turf', distance: 1600, ages: '3+' },
  { id: 'rose', name: 'ローズステークス', grade: 'g2', m: 9, w: 3, venue: '阪神', surface: 'turf', distance: 1800, ages: '3', f: true, trial: { to: 'shuka', top: 3 } },
  { id: 'st_lite', name: 'セントライト記念', grade: 'g2', m: 9, w: 3, venue: '中山', surface: 'turf', distance: 2200, ages: '3', trial: { to: 'kikka', top: 3 } },
  { id: 'kobe_shinbun', name: '神戸新聞杯', grade: 'g2', m: 9, w: 4, venue: '阪神', surface: 'turf', distance: 2400, ages: '3', trial: { to: 'kikka', top: 3 } },
  { id: 'all_comers', name: 'オールカマー', grade: 'g2', m: 9, w: 4, venue: '中山', surface: 'turf', distance: 2200, ages: '3+' },
  { id: 'sprinters', name: 'スプリンターズステークス', grade: 'g1', m: 9, w: 4, venue: '中山', surface: 'turf', distance: 1200, ages: '3+', prize: 17000 },
  // 10月
  { id: 'saudi_rc', name: 'サウジアラビアロイヤルカップ', grade: 'g3', m: 10, w: 1, venue: '東京', surface: 'turf', distance: 1600, ages: '2' },
  { id: 'sirius', name: 'シリウスステークス', grade: 'g3', m: 10, w: 1, venue: '阪神', surface: 'dirt', distance: 2000, ages: '3+' },
  { id: 'mainichi_okan', name: '毎日王冠', grade: 'g2', m: 10, w: 2, venue: '東京', surface: 'turf', distance: 1800, ages: '3+' },
  { id: 'kyoto_daishoten', name: '京都大賞典', grade: 'g2', m: 10, w: 2, venue: '京都', surface: 'turf', distance: 2400, ages: '3+' },
  { id: 'shuka', name: '秋華賞', grade: 'g1', m: 10, w: 3, venue: '京都', surface: 'turf', distance: 2000, ages: '3', f: true, prize: 11000, crown: 'tiara' },
  { id: 'fuchu_himba', name: '府中牝馬ステークス', grade: 'g2', m: 10, w: 3, venue: '東京', surface: 'turf', distance: 1800, ages: '3+', f: true },
  { id: 'kikka', name: '菊花賞', grade: 'g1', m: 10, w: 4, venue: '京都', surface: 'turf', distance: 3000, ages: '3', prize: 20000, crown: 'classic' },
  { id: 'fuji_s', name: '富士ステークス', grade: 'g2', m: 10, w: 4, venue: '東京', surface: 'turf', distance: 1600, ages: '3+' },
  // 11月
  { id: 'tenno_autumn', name: '天皇賞（秋）', grade: 'g1', m: 11, w: 1, venue: '東京', surface: 'turf', distance: 2000, ages: '3+', prize: 30000, crown: 'autumnSenior' },
  { id: 'artemis', name: 'アルテミスステークス', grade: 'g3', m: 11, w: 1, venue: '東京', surface: 'turf', distance: 1600, ages: '2', f: true },
  { id: 'argentina', name: 'アルゼンチン共和国杯', grade: 'g2', m: 11, w: 1, venue: '東京', surface: 'turf', distance: 2500, ages: '3+' },
  { id: 'keio_2yo', name: '京王杯2歳ステークス', grade: 'g2', m: 11, w: 1, venue: '東京', surface: 'turf', distance: 1400, ages: '2' },
  { id: 'elizabeth', name: 'エリザベス女王杯', grade: 'g1', m: 11, w: 2, venue: '京都', surface: 'turf', distance: 2200, ages: '3+', f: true, prize: 13000 },
  { id: 'daily_2yo', name: 'デイリー杯2歳ステークス', grade: 'g2', m: 11, w: 2, venue: '京都', surface: 'turf', distance: 1600, ages: '2' },
  { id: 'musashino', name: '武蔵野ステークス', grade: 'g3', m: 11, w: 2, venue: '東京', surface: 'dirt', distance: 1600, ages: '3+' },
  { id: 'mile_cs', name: 'マイルチャンピオンシップ', grade: 'g1', m: 11, w: 3, venue: '京都', surface: 'turf', distance: 1600, ages: '3+', prize: 18000 },
  { id: 'tokyo_sports_2yo', name: '東京スポーツ杯2歳ステークス', grade: 'g2', m: 11, w: 3, venue: '東京', surface: 'turf', distance: 1800, ages: '2' },
  { id: 'japan_cup', name: 'ジャパンカップ', grade: 'g1', m: 11, w: 4, venue: '東京', surface: 'turf', distance: 2400, ages: '3+', prize: 50000, crown: 'autumnSenior' },
  { id: 'keihan_hai', name: '京阪杯', grade: 'g3', m: 11, w: 4, venue: '京都', surface: 'turf', distance: 1200, ages: '3+' },
  // 12月
  { id: 'champions_cup', name: 'チャンピオンズカップ', grade: 'g1', m: 12, w: 1, venue: '中京', surface: 'dirt', distance: 1800, ages: '3+', prize: 12000 },
  { id: 'stayers', name: 'ステイヤーズステークス', grade: 'g2', m: 12, w: 1, venue: '中山', surface: 'turf', distance: 3600, ages: '3+' },
  { id: 'challenge_cup', name: 'チャレンジカップ', grade: 'g3', m: 12, w: 1, venue: '阪神', surface: 'turf', distance: 2000, ages: '3+' },
  { id: 'hanshin_jf', name: '阪神ジュベナイルフィリーズ', grade: 'g1', m: 12, w: 2, venue: '阪神', surface: 'turf', distance: 1600, ages: '2', f: true, prize: 7000 },
  { id: 'capella', name: 'カペラステークス', grade: 'g3', m: 12, w: 2, venue: '中山', surface: 'dirt', distance: 1200, ages: '3+' },
  { id: 'asahi_fs', name: '朝日杯フューチュリティステークス', grade: 'g1', m: 12, w: 3, venue: '阪神', surface: 'turf', distance: 1600, ages: '2', prize: 7000 },
  { id: 'turquoise', name: 'ターコイズステークス', grade: 'g3', m: 12, w: 3, venue: '中山', surface: 'turf', distance: 1600, ages: '3+', f: true },
  { id: 'arima', name: '有馬記念', grade: 'g1', m: 12, w: 4, venue: '中山', surface: 'turf', distance: 2500, ages: '3+', prize: 50000, crown: 'autumnSenior' },
  { id: 'hopeful', name: 'ホープフルステークス', grade: 'g1', m: 12, w: 4, venue: '中山', surface: 'turf', distance: 2000, ages: '2', prize: 7000 },
  { id: 'hanshin_cup', name: '阪神カップ', grade: 'g2', m: 12, w: 4, venue: '阪神', surface: 'turf', distance: 1400, ages: '3+' }
];

// 平場（条件戦）を開催する競馬場（月ごと・おおよそ）
GAME_DATA.venuesByMonth = [
  ['中山', '京都'], ['東京', '京都'], ['中山', '阪神'], ['中山', '阪神'], ['東京', '京都'], ['東京', '阪神'],
  ['福島', '小倉'], ['新潟', '札幌'], ['中山', '阪神'], ['東京', '京都'], ['東京', '京都'], ['中山', '阪神']
];

// 三冠などの称号
GAME_DATA.crowns = {
  classic: { title: '三冠馬', desc: '皐月賞・日本ダービー・菊花賞' },
  tiara: { title: '牝馬三冠', desc: '桜花賞・オークス・秋華賞' },
  springSenior: { title: '春古馬三冠', desc: '大阪杯・天皇賞（春）・宝塚記念' },
  autumnSenior: { title: '秋古馬三冠', desc: '天皇賞（秋）・ジャパンカップ・有馬記念' }
};

// レース後に手に入るカードのレアリティ確率（%）
GAME_DATA.dropTable = {
  debut: { N: 60, R: 35, SR: 5, SSR: 0, UR: 0 },
  maiden: { N: 60, R: 35, SR: 5, SSR: 0, UR: 0 },
  cond: { N: 45, R: 40, SR: 13, SSR: 2, UR: 0 },
  c2: { N: 38, R: 42, SR: 16, SSR: 4, UR: 0 },
  c3: { N: 32, R: 44, SR: 19, SSR: 5, UR: 0 },
  op: { N: 30, R: 45, SR: 20, SSR: 5, UR: 0 },
  g3: { N: 10, R: 45, SR: 35, SSR: 9, UR: 1 },
  g2: { N: 0, R: 40, SR: 40, SSR: 17, UR: 3 },
  g1: { N: 0, R: 25, SR: 42, SSR: 27, UR: 6 }
};
GAME_DATA.dropTypeWeights = { sire: 25, mare: 25, skill: 32, item: 18 };

// ───────── ミッション（初心者向けに順番に進む） ─────────
// check は main.js の Missions.progress() で評価する key
GAME_DATA.missions = [
  { id: 'ms_breed', title: '最初の馬を配合しよう', hint: '🧬 配合 から父カードと母カードを選ぼう', check: 'breedCount', target: 1,
    reward: { money: 2000, cards: ['i_refresh'] } },
  { id: 'ms_train', title: '調教しよう', hint: '🐎 厩舎 → 馬を選んで調教', check: 'trainCount', target: 1,
    reward: { money: 500, cards: ['k_goodpos'] } },
  { id: 'ms_skill', title: 'スキルを装備しよう', hint: '馬の詳細画面の「スキル」から装備', check: 'equipCount', target: 1,
    reward: { money: 500, cards: ['i_speedtr', 'i_stamtr'] } },
  { id: 'ms_race', title: '初レースに出走しよう', hint: '🏇 レース →「今週のレース」から出走（2歳新馬戦は6月から）', check: 'raceCount', target: 1,
    reward: { money: 1000, cards: ['i_carrot'] } },
  { id: 'ms_win', title: '1勝しよう', hint: '調教で鍛えて、適性に合ったレースへ', check: 'winCount', target: 1,
    reward: { money: 2000, cards: ['k_kick'] } },
  { id: 'ms_sr', title: 'SR以上のカードを獲得しよう', hint: 'レースで勝つとカードがもらえる', check: 'srCount', target: 1,
    reward: { money: 2000, cards: ['i_exp'] } },
  { id: 'ms_graded', title: '重賞（GⅢ以上）に出走しよう', hint: '1勝すると2歳・3歳の重賞に挑戦できる（重賞カレンダーをチェック）', check: 'gradedRaceCount', target: 1,
    reward: { money: 3000, cards: ['i_special'] } },
  { id: 'ms_g1run', title: 'GⅠに挑戦しよう', hint: '勝ち星やトライアルの優先出走権でGⅠの舞台へ', check: 'g1RaceCount', target: 1,
    reward: { money: 5000, cards: ['i_potential'] } },
  { id: 'ms_g1win', title: 'GⅠを勝とう', hint: '適性・スキル・調子をそろえよう', check: 'g1WinCount', target: 1,
    reward: { money: 10000, cards: ['s_king'] } },
  { id: 'ms_hof', title: '殿堂馬を作ろう', hint: 'GⅠ 3勝 or 通算10勝で引退すると殿堂入り', check: 'hofCount', target: 1,
    reward: { money: 30000, cards: ['m_goddess'] } }
];

// ───────── 用語解説（？ボタン） ─────────
GAME_DATA.glossary = {
  speed: { title: '⚡ スピード', body: '最高速度に関係します。短い距離ほど大事な能力です。' },
  stamina: { title: '❤️ スタミナ', body: 'レース中の体力。長い距離では、スタミナが足りないと最後にバテて失速します。' },
  power: { title: '💪 パワー', body: '加速力に関係します。雨で馬場が重いときにも強くなります。' },
  guts: { title: '🔥 根性', body: 'バテた時や、他の馬と競り合う最終直線で粘る力です。' },
  intelligence: { title: '🧠 賢さ', body: 'スキルが発動しやすくなり、レースでの走りも安定します。' },
  distance: { title: '📏 距離適性', body: 'その馬が得意な距離です。★が多い距離のレースに出ると力を発揮できます。<br>スプリント（〜1400m）／マイル（〜1800m）／クラシック（〜2400m）／ロング（2401m〜）' },
  surface: { title: '🌱 馬場適性', body: '「芝」は草のコース、「ダート」は砂のコース。得意な方で走らせよう。' },
  ground: { title: '🌧️ 馬場状態', body: '良 → 稍重 → 重 → 不良 の順に、雨で地面がぬかるみます。重い馬場ではパワーがある馬が有利です。' },
  style: { title: '🏇 脚質', body: 'レースでの走り方のクセです。<br>🔴逃げ：最初から先頭<br>🟠先行：前の方をキープ<br>🔵差し：最後に追い抜く<br>🟣追込：最後方から一気に' },
  growth: { title: '🌱 成長タイプ', body: '早熟は若いうちに伸び、晩成は年をとってから伸びます。普通はその中間です。' },
  condition: { title: '😊 調子', body: '調子が良いほどレースで力を出せます。休養やアイテムで上がります。' },
  fatigue: { title: '😓 疲労', body: '調教やレースでたまります。疲れていると調教の効果やレースの力が下がります。休養で回復！' },
  potential: { title: '💎 素質', body: 'その馬がどこまで強くなれるかの目安です。配合で決まり、調教で限界まで伸ばせます。' },
  rarity: { title: '🃏 レアリティ', body: 'N → R → SR → SSR → UR の順に珍しいカード。でも、低レアにも特別な血統を持つカードがあります。' },
  skill: { title: '🎴 スキル', body: '1頭に3つまで装備できます。レース中に条件を満たすと自動で発動！脚質が合うスキルは効果が大きくなります。' },
  grade: { title: '🏅 クラスとレースの格', body: '勝利数でクラスが上がります。<br>0勝：新馬・未勝利 → 1勝：1勝クラス → 2勝：2勝クラス → 3勝：3勝クラス → 4勝以上（または重賞勝ち）：オープン<br>重賞（GⅢ・GⅡ・GⅠ）は格が高く、賞金やカード報酬も豪華です。2歳・3歳の重賞は1勝から挑戦できます。' },
  calendar: { title: '📅 カレンダー', body: '1年は12か月×4週。馬は1週に1回、調教・レース・休養のどれかができます。<br>重賞は実際のJRAと同じ時期に行われます（皐月賞は4月、日本ダービーは5月、有馬記念は12月など）。<br>「次の週へ」を押すと、まだ行動していない馬はおまかせ調教をして1週すすみます。' },
  newyear: { title: '🎍 1月1週（年明け）', body: '年が明けると全ての馬が1歳年をとります（JRAと同じく誕生日は1月1日扱い）。<br>前の年の成績から年度表彰（JRA賞）が選ばれ、賞金ボーナスがもらえます。<br>6歳になった馬は引退の時期です。' },
  right: { title: '🎫 優先出走権', body: 'トライアルレースで上位に入ると、GⅠ本番への優先出走権がもらえます。<br>例：弥生賞・スプリングS 3着以内 → 皐月賞、チューリップ賞 3着以内 → 桜花賞、青葉賞 2着以内 → 日本ダービー' },
  hof: { title: '🏛 殿堂入り', body: 'GⅠ 3勝、または通算10勝した馬が引退すると殿堂入りします。殿堂馬は配合カードになって、血統を次の世代へつなげます。' }
};

// ───────── 馬名ジェネレーター用 ─────────
GAME_DATA.namePrefix = ['サンダー', 'スター', 'ブルー', 'ナイト', 'ゴールド', 'シルバー', 'ミラクル', 'ホープ', 'ローズ', 'クイーン',
  'キング', 'スカイ', 'ムーン', 'サン', 'ウインド', 'フレイム', 'ドリーム', 'グランド', 'ヴィクトリー', 'ライト', 'ダーク', 'アイス',
  'ファイア', 'ブリリアント', 'エターナル', 'ルナ', 'ソレイユ', 'ハヤテ', 'サクラ', 'ヤマト', 'カゼノ', 'ホシノ', 'ユメノ', 'メイショウ', 'リュウ'];
GAME_DATA.nameSuffix = ['ロード', 'レイン', 'フレイム', 'ハート', 'ボルト', 'スター', 'ダンサー', 'ランナー', 'ブレイブ', 'ソング', 'エース',
  'クラウン', 'ウイング', 'ブリッツ', 'プリンセス', 'レディ', 'オー', 'マックス', 'ジェット', 'フラッシュ', 'ストーム', 'リーフ', 'テイオー',
  'ヒメ', 'マル', 'ダッシュ', 'キセキ', 'ノヴァ', 'アロー', 'ブーケ'];

GAME_DATA.nameFemaleOnly = ['クイーン', 'ローズ', 'プリンセス', 'レディ', 'ヒメ', 'ブーケ'];
GAME_DATA.nameMaleOnly = ['キング', 'テイオー', 'オー', 'マックス'];

// 新規プレイヤーの初期所持カード
GAME_DATA.starterCards = {
  s_hayate: 1, s_daichi: 1, s_green: 1,
  m_sakura: 1, m_tsuchi: 1, m_rose: 1,
  k_rocket: 1, k_kick: 1, k_stamkeep: 1,
  i_refresh: 2, i_speedtr: 1
};

// ───────── 特殊配合 ─────────
// 黄金配合（ニックス）：特定の組み合わせで全能力にボーナス。低レア同士の組み合わせもある。
GAME_DATA.nicks = [
  { sire: 's_hayate', mare: 'm_sakura', name: '春風の快速', bonus: 5 },
  { sire: 's_daichi', mare: 'm_tsuchi', name: '大地の恵み', bonus: 5 },
  { sire: 's_little', mare: 'm_lucky', name: '小さな奇跡', bonus: 6 },
  { sire: 's_ocean', mare: 'm_silver', name: '銀の大海', bonus: 4 },
  { sire: 's_goldrush', mare: 'm_crimson', name: '砂塵の炎', bonus: 4 },
  { sire: 's_skyhigh', mare: 'm_star', name: '天空の一番星', bonus: 4 },
  { sire: 's_thunder', mare: 'm_moon', name: '雷光と月光', bonus: 4 },
  { sire: 's_king', mare: 'm_aurora', name: '王と極光', bonus: 4 },
  { sire: 's_emperor', mare: 'm_goddess', name: '始祖の血統', bonus: 3 }
];

// ───────── カードパック ─────────
GAME_DATA.packs = [
  { id: 'p_basic', name: 'ベーシックパック', icon: '📦', price: 3000, count: 3, table: 'op',
    desc: 'カード3枚入り。N〜SSRが出る。' },
  { id: 'p_premium', name: 'プレミアムパック', icon: '🎁', price: 12000, count: 5, table: 'g2', guarantee: 'SR',
    desc: 'カード5枚入り。SR以上1枚確定！URも出る。' },
  { id: 'p_blood', name: '血統パック', icon: '🧬', price: 8000, count: 3, table: 'g3', types: ['sire', 'mare'],
    desc: '種牡馬・繁殖牝馬カードだけが3枚入り。' }
];

// ───────── リーグ戦（CPU馬主との対戦） ─────────
// statCap：出走馬の能力をこの値までに制限（レベル差だけで勝敗が決まらないように）
GAME_DATA.leagues = [
  { id: 'bronze', name: 'ブロンズリーグ', icon: '🥉', statCap: 70, npc: 55, minRating: 0, prize: 1500, grade: 'op',
    desc: '初心者向け。能力は最大70に制限されます。' },
  { id: 'silver', name: 'シルバーリーグ', icon: '🥈', statCap: 85, npc: 68, minRating: 1100, prize: 4000, grade: 'g2',
    desc: '中級者向け。能力は最大85に制限されます。' },
  { id: 'gold', name: 'ゴールドリーグ', icon: '🥇', statCap: null, npc: 82, minRating: 1250, prize: 10000, grade: 'g1',
    desc: '上級者向け。制限なしの真剣勝負！' }
];
GAME_DATA.leagueCourses = [
  { distance: 1200, surface: 'turf' }, { distance: 1600, surface: 'turf' }, { distance: 2000, surface: 'turf' },
  { distance: 2400, surface: 'turf' }, { distance: 1400, surface: 'dirt' }, { distance: 1800, surface: 'dirt' }
];
GAME_DATA.ratingDelta = [30, 18, 8, 0, -4, -8, -12, -16];
GAME_DATA.rivalOwners = ['タカハシ', 'サトウ', 'スズキ', 'ヤマモト', 'ナカムラ', 'コバヤシ', 'カトウ', 'ワタナベ',
  'イトウ', 'キムラ', 'ハヤシ', 'シミズ', 'モリ', 'イケダ', 'ハシモト', 'アベ'];
