// 実在のJRA名馬（ライバル）と、その出走・撃破・カード化の処理
// 能力はゲーム用の独自査定。勝負服・馬主などは架空のままで、名前と主な勝ち鞍のみ実在のものを使う。
'use strict';

// ───────── 名馬の固有スキル（名馬カードの配合で受け継げる） ─────────
GAME_DATA.skills.push(
  { id: 'k_lg_wing', name: '英雄の翼', rarity: 'UR', style: null, icon: '🕊️', legendOnly: true,
    desc: '最終直線、飛ぶように伸びる。', condText: '最終直線・2位以下',
    cond: { phase: 'final', rankMin: 2 }, effect: { speed: 0.13, duration: 10 } },
  { id: 'k_lg_tyrant', name: '金色の暴君', rarity: 'UR', style: null, icon: '🌋',
    legendOnly: true, desc: '最終直線で後ろから全てをなぎ倒す。', condText: '最終直線・3位以下',
    cond: { phase: 'final', rankMin: 3 }, effect: { speed: 0.14, duration: 9 } },
  { id: 'k_lg_monster', name: '怪物の末脚', rarity: 'UR', style: null, icon: '👹', legendOnly: true,
    desc: '残り400mから怪物的な伸び。', condText: '残り400m・2位以下',
    cond: { remainMax: 400, rankMin: 2 }, effect: { speed: 0.12, duration: 10 } },
  { id: 'k_lg_silence', name: '異次元の逃亡者', rarity: 'UR', style: 'nige', icon: '🌠', legendOnly: true,
    desc: '中盤から後続を大きく引き離す。', condText: '中盤・1位',
    cond: { phase: 'mid', rankMax: 1 }, effect: { speed: 0.07, duration: 25 } },
  { id: 'k_lg_festival', name: '祭りの主役', rarity: 'UR', style: null, icon: '🎆', legendOnly: true,
    desc: '最終直線で先頭なら、粘って突き放す。', condText: '最終直線・1〜2位',
    cond: { phase: 'final', rankMax: 2 }, effect: { speed: 0.09, hp: 180, duration: 12 } },
  { id: 'k_lg_longspurt', name: '不沈艦のロングスパート', rarity: 'UR', style: null, icon: '🚢', legendOnly: true,
    desc: 'コーナーから長くいい脚を使う。', condText: 'コーナー・4位以下',
    cond: { phase: 'corner', rankMin: 4 }, effect: { speed: 0.09, duration: 22 } },
  { id: 'k_lg_queen', name: '女王の誇り', rarity: 'UR', style: null, icon: '👸', legendOnly: true,
    desc: '最終直線、2〜6位から女王の伸び。', condText: '最終直線・2〜6位',
    cond: { phase: 'final', rankMin: 2, rankMax: 6 }, effect: { speed: 0.12, duration: 9 } },
  { id: 'k_lg_dragon', name: '龍王の加速', rarity: 'UR', style: null, icon: '🐉', legendOnly: true,
    desc: 'スプリント戦のコーナーで一気に加速。', condText: 'スプリント・コーナー',
    cond: { phase: 'corner', distCat: 'sprint' }, effect: { speed: 0.1, duration: 14 } },
  { id: 'k_lg_sand', name: '砂塵の王', rarity: 'UR', style: null, icon: '🏜️', legendOnly: true,
    desc: 'ダートの最終直線で力強く伸びる。', condText: 'ダート・最終直線',
    cond: { phase: 'final', surface: 'dirt' }, effect: { speed: 0.11, duration: 10 } },
  { id: 'k_lg_stayer', name: '名優の貫禄', rarity: 'UR', style: null, icon: '🎭', legendOnly: true,
    desc: '長距離の終盤で体力が回復し、速度アップ。', condText: 'ロング・コーナー',
    cond: { phase: 'corner', distCat: 'long' }, effect: { speed: 0.06, hp: 300, duration: 14 } },
  { id: 'k_lg_shadow', name: 'シャドーロールの衝撃', rarity: 'UR', style: null, icon: '💥', legendOnly: true,
    desc: 'コーナーで2〜5位から圧倒的な進出。', condText: 'コーナー・2〜5位',
    cond: { phase: 'corner', rankMin: 2, rankMax: 5 }, effect: { speed: 0.1, duration: 14 } }
);

// ───────── 名馬リスト ─────────
// [id, 名前, 性別(m/f), 脚質, 馬場(t芝/dダート/b両方), 得意距離(s短 mマ c中 l長), 格(S/A/B), 主な勝ち鞍, 固有スキル, 毛色]
GAME_DATA.legendList = [
  ['rudolf', 'シンボリルドルフ', 'm', 'senko', 't', 'cl', 'S', '三冠・ジャパンカップ・有馬記念', 'k_emperor', '鹿毛'],
  ['deep', 'ディープインパクト', 'm', 'oikomi', 't', 'cl', 'S', '三冠・天皇賞（春）・有馬記念', 'k_lg_wing', '鹿毛'],
  ['orfevre', 'オルフェーヴル', 'm', 'oikomi', 't', 'cl', 'S', '三冠・宝塚記念・有馬記念', 'k_lg_tyrant', '栗毛'],
  ['brian', 'ナリタブライアン', 'm', 'senko', 't', 'cl', 'S', '三冠・朝日杯・有馬記念', 'k_lg_shadow', '黒鹿毛'],
  ['mrcb', 'ミスターシービー', 'm', 'oikomi', 't', 'cl', 'A', '三冠・天皇賞（秋）', 'k_lg_longspurt', '黒鹿毛'],
  ['shinzan', 'シンザン', 'm', 'senko', 't', 'cl', 'S', '五冠（三冠・天皇賞・有馬記念）', 'k_lg_festival', '鹿毛'],
  ['contrail', 'コントレイル', 'm', 'sashi', 't', 'mc', 'S', '三冠・ジャパンカップ', 'k_lg_wing', '青鹿毛'],
  ['kitasan', 'キタサンブラック', 'm', 'nige', 't', 'cl', 'S', '天皇賞（春秋）・ジャパンカップ・有馬記念', 'k_lg_festival', '鹿毛'],
  ['opera', 'テイエムオペラオー', 'm', 'senko', 't', 'cl', 'S', '年間無敗・天皇賞（春秋）・有馬記念', 'k_lg_stayer', '栗毛'],
  ['oguri', 'オグリキャップ', 'm', 'sashi', 'b', 'mc', 'S', '有馬記念2勝・安田記念・マイルCS', 'k_lg_monster', '芦毛'],
  ['teio', 'トウカイテイオー', 'm', 'senko', 't', 'c', 'A', '皐月賞・ダービー・ジャパンカップ・有馬記念', 'k_lg_festival', '鹿毛'],
  ['mcqueen', 'メジロマックイーン', 'm', 'senko', 't', 'l', 'S', '菊花賞・天皇賞（春）2勝・宝塚記念', 'k_lg_stayer', '芦毛'],
  ['suzuka', 'サイレンススズカ', 'm', 'nige', 't', 'mc', 'S', '宝塚記念・毎日王冠・金鯱賞', 'k_lg_silence', '栗毛'],
  ['elcondor', 'エルコンドルパサー', 'm', 'senko', 't', 'mc', 'S', 'NHKマイルC・ジャパンカップ', null, '黒鹿毛'],
  ['grass', 'グラスワンダー', 'm', 'sashi', 't', 'mc', 'A', '朝日杯・宝塚記念・有馬記念2勝', null, '栗毛'],
  ['special', 'スペシャルウィーク', 'm', 'sashi', 't', 'cl', 'A', 'ダービー・天皇賞（春秋）・ジャパンカップ', null, '黒鹿毛'],
  ['shuttle', 'タイキシャトル', 'm', 'senko', 't', 'sm', 'S', '安田記念・マイルCS2勝・スプリンターズS', null, '栗毛'],
  ['kamehameha', 'キングカメハメハ', 'm', 'senko', 't', 'mc', 'A', 'NHKマイルC・日本ダービー', null, '鹿毛'],
  ['goldship', 'ゴールドシップ', 'm', 'oikomi', 't', 'cl', 'S', '皐月賞・菊花賞・宝塚記念2勝・有馬記念', 'k_lg_longspurt', '芦毛'],
  ['equinox', 'イクイノックス', 'm', 'sashi', 't', 'c', 'S', '天皇賞（秋）2勝・ジャパンカップ・有馬記念', 'k_lg_wing', '青鹿毛'],
  ['almond', 'アーモンドアイ', 'f', 'sashi', 't', 'mc', 'S', '牝馬三冠・ジャパンカップ2勝・天皇賞（秋）2勝', 'k_lg_queen', '鹿毛'],
  ['vodka', 'ウオッカ', 'f', 'sashi', 't', 'mc', 'S', '日本ダービー・安田記念2勝・天皇賞（秋）', 'k_lg_queen', '鹿毛'],
  ['scarlet', 'ダイワスカーレット', 'f', 'nige', 't', 'mc', 'S', '桜花賞・秋華賞・有馬記念', 'k_lg_festival', '栗毛'],
  ['gentil', 'ジェンティルドンナ', 'f', 'sashi', 't', 'c', 'S', '牝馬三冠・ジャパンカップ2勝・有馬記念', 'k_lg_queen', '鹿毛'],
  ['buena', 'ブエナビスタ', 'f', 'sashi', 't', 'mc', 'A', '桜花賞・オークス・天皇賞（秋）・ジャパンカップ', 'k_lg_queen', '黒鹿毛'],
  ['chrono', 'クロノジェネシス', 'f', 'sashi', 't', 'c', 'A', '宝塚記念2勝・有馬記念・秋華賞', null, '芦毛'],
  ['lys', 'リスグラシュー', 'f', 'sashi', 't', 'c', 'A', '宝塚記念・有馬記念・エリザベス女王杯', null, '黒鹿毛'],
  ['gran', 'グランアレグリア', 'f', 'sashi', 't', 'sm', 'S', '桜花賞・安田記念・マイルCS2勝・スプリンターズS', 'k_lg_queen', '鹿毛'],
  ['daring', 'デアリングタクト', 'f', 'sashi', 't', 'mc', 'A', '牝馬三冠', null, '青鹿毛'],
  ['liberty', 'リバティアイランド', 'f', 'sashi', 't', 'mc', 'S', '牝馬三冠・阪神JF', 'k_lg_queen', '鹿毛'],
  ['sodashi', 'ソダシ', 'f', 'senko', 'b', 'm', 'B', '桜花賞・ヴィクトリアマイル・阪神JF', null, '白毛'],
  ['dober', 'メジロドーベル', 'f', 'sashi', 't', 'mc', 'B', 'オークス・秋華賞・エリザベス女王杯2勝', null, '鹿毛'],
  ['airgroove', 'エアグルーヴ', 'f', 'senko', 't', 'c', 'A', 'オークス・天皇賞（秋）', null, '鹿毛'],
  ['hishiamazon', 'ヒシアマゾン', 'f', 'oikomi', 't', 'mc', 'B', '阪神3歳牝馬S・エリザベス女王杯', null, '黒鹿毛'],
  ['stillinlove', 'スティルインラブ', 'f', 'sashi', 't', 'mc', 'B', '牝馬三冠', null, '栗毛'],
  ['apapane', 'アパパネ', 'f', 'senko', 't', 'mc', 'B', '牝馬三冠・ヴィクトリアマイル・阪神JF', null, '鹿毛'],
  ['lilac', 'ラッキーライラック', 'f', 'senko', 't', 'mc', 'B', '阪神JF・エリザベス女王杯2勝・大阪杯', null, '栗毛'],
  ['curren', 'カレンチャン', 'f', 'senko', 't', 's', 'B', 'スプリンターズS・高松宮記念', null, '鹿毛'],
  ['canaloa', 'ロードカナロア', 'm', 'senko', 't', 'sm', 'S', 'スプリンターズS2勝・高松宮記念・安田記念', 'k_lg_dragon', '鹿毛'],
  ['bakushin', 'サクラバクシンオー', 'm', 'senko', 't', 's', 'S', 'スプリンターズS2勝', 'k_lg_dragon', '鹿毛'],
  ['nishinoflower', 'ニシノフラワー', 'f', 'senko', 't', 'sm', 'B', '桜花賞・スプリンターズS・阪神3歳牝馬S', null, '黒鹿毛'],
  ['durandal', 'デュランダル', 'm', 'oikomi', 't', 'sm', 'A', 'スプリンターズS・マイルCS2勝', null, '栗毛'],
  ['daiwamajor', 'ダイワメジャー', 'm', 'senko', 't', 'm', 'A', '皐月賞・天皇賞（秋）・マイルCS2勝・安田記念', null, '栗毛'],
  ['maurice', 'モーリス', 'm', 'senko', 't', 'mc', 'S', '安田記念・マイルCS・天皇賞（秋）', null, '鹿毛'],
  ['staygold', 'ステイゴールド', 'm', 'sashi', 't', 'cl', 'B', '目黒記念・日経新春杯・香港ヴァーズ', null, '黒鹿毛'],
  ['heartscry', 'ハーツクライ', 'm', 'sashi', 't', 'cl', 'A', '有馬記念・ドバイシーマクラシック', null, '鹿毛'],
  ['justaway', 'ジャスタウェイ', 'm', 'sashi', 't', 'mc', 'A', '天皇賞（秋）・安田記念・ドバイDF', null, '鹿毛'],
  ['dodeuce', 'ドウデュース', 'm', 'sashi', 't', 'c', 'A', '日本ダービー・有馬記念・天皇賞（秋）・JC', null, '鹿毛'],
  ['efforia', 'エフフォーリア', 'm', 'senko', 't', 'c', 'A', '皐月賞・天皇賞（秋）・有馬記念', null, '鹿毛'],
  ['satonodia', 'サトノダイヤモンド', 'm', 'sashi', 't', 'cl', 'A', '菊花賞・有馬記念', null, '鹿毛'],
  ['kizuna', 'キズナ', 'm', 'oikomi', 't', 'c', 'B', '日本ダービー', null, '青鹿毛'],
  ['duramente', 'ドゥラメンテ', 'm', 'sashi', 't', 'c', 'A', '皐月賞・日本ダービー', null, '鹿毛'],
  ['topgun', 'マヤノトップガン', 'm', 'senko', 't', 'cl', 'A', '菊花賞・有馬記念・宝塚記念・天皇賞（春）', null, '栗毛'],
  ['riceshower', 'ライスシャワー', 'm', 'senko', 't', 'l', 'A', '菊花賞・天皇賞（春）2勝', 'k_lg_stayer', '黒鹿毛'],
  ['biwa', 'ビワハヤヒデ', 'm', 'senko', 't', 'cl', 'A', '菊花賞・宝塚記念・天皇賞（春）', null, '芦毛'],
  ['manhattan', 'マンハッタンカフェ', 'm', 'sashi', 't', 'l', 'A', '菊花賞・有馬記念・天皇賞（春）', null, '青鹿毛'],
  ['jungle', 'ジャングルポケット', 'm', 'sashi', 't', 'c', 'B', '日本ダービー・ジャパンカップ', null, '鹿毛'],
  ['tachyon', 'アグネスタキオン', 'm', 'senko', 't', 'mc', 'A', '朝日杯・皐月賞（4戦4勝）', null, '栗毛'],
  ['neouniverse', 'ネオユニヴァース', 'm', 'sashi', 't', 'c', 'B', '皐月賞・日本ダービー', null, '鹿毛'],
  ['roblox', 'ゼンノロブロイ', 'm', 'sashi', 't', 'c', 'A', '天皇賞（秋）・ジャパンカップ・有馬記念', null, '黒鹿毛'],
  ['samson', 'メイショウサムソン', 'm', 'senko', 't', 'cl', 'B', '皐月賞・ダービー・天皇賞（春秋）', null, '鹿毛'],
  ['pisa', 'ヴィクトワールピサ', 'm', 'senko', 't', 'c', 'B', '皐月賞・有馬記念・ドバイWC', null, '黒鹿毛'],
  ['flash', 'エイシンフラッシュ', 'm', 'sashi', 't', 'c', 'B', '日本ダービー・天皇賞（秋）', null, '黒鹿毛'],
  ['bourbon', 'ミホノブルボン', 'm', 'nige', 't', 'mc', 'A', '朝日杯・皐月賞・日本ダービー', null, '栗毛'],
  ['laurel', 'サクラローレル', 'm', 'sashi', 't', 'l', 'A', '天皇賞（春）・有馬記念', null, '栗毛'],
  ['creek', 'スーパークリーク', 'm', 'senko', 't', 'l', 'A', '菊花賞・天皇賞（春秋）', 'k_lg_stayer', '鹿毛'],
  ['inariwan', 'イナリワン', 'm', 'sashi', 't', 'l', 'B', '天皇賞（春）・宝塚記念・有馬記念', null, '鹿毛'],
  ['tamamo', 'タマモクロス', 'm', 'sashi', 't', 'cl', 'A', '天皇賞（春秋）・宝塚記念', null, '芦毛'],
  ['ryan', 'メジロライアン', 'm', 'sashi', 't', 'c', 'B', '宝塚記念', null, '鹿毛'],
  ['helios', 'ダイタクヘリオス', 'm', 'nige', 't', 'm', 'B', 'マイルCS2勝', null, '黒鹿毛'],
  ['turbo', 'ツインターボ', 'm', 'nige', 't', 'c', 'B', 'オールカマー・七夕賞', 'k_lg_silence', '鹿毛'],
  ['seiunsky', 'セイウンスカイ', 'm', 'nige', 't', 'cl', 'A', '皐月賞・菊花賞', null, '芦毛'],
  ['kinghalo', 'キングヘイロー', 'm', 'sashi', 't', 's', 'B', '高松宮記念', null, '鹿毛'],
  ['digital', 'アグネスデジタル', 'm', 'sashi', 'b', 'm', 'A', 'マイルCS・天皇賞（秋）・フェブラリーS', null, '栗毛'],
  ['kurofune', 'クロフネ', 'm', 'senko', 'b', 'm', 'S', 'NHKマイルC・ジャパンCダート', 'k_lg_sand', '芦毛'],
  ['allure', 'ゴールドアリュール', 'm', 'senko', 'd', 'mc', 'A', 'ジャパンダートダービー・フェブラリーS', 'k_lg_sand', '栗毛'],
  ['kanehikiri', 'カネヒキリ', 'm', 'senko', 'd', 'mc', 'A', 'フェブラリーS・ジャパンCダート', 'k_lg_sand', '栗毛'],
  ['vermilion', 'ヴァーミリアン', 'm', 'senko', 'd', 'c', 'A', 'ジャパンCダート・フェブラリーS', null, '黒鹿毛'],
  ['espoir', 'エスポワールシチー', 'm', 'nige', 'd', 'm', 'B', 'フェブラリーS・ジャパンCダート', null, '栗毛'],
  ['transcend', 'トランセンド', 'm', 'nige', 'd', 'mc', 'B', 'フェブラリーS・ジャパンCダート2勝', null, '鹿毛'],
  ['hokko', 'ホッコータルマエ', 'm', 'senko', 'd', 'c', 'A', 'チャンピオンズC・川崎記念3連覇', null, '鹿毛'],
  ['rikki', 'コパノリッキー', 'm', 'nige', 'd', 'm', 'A', 'フェブラリーS2勝', null, '栗毛'],
  ['golddream', 'ゴールドドリーム', 'm', 'sashi', 'd', 'm', 'B', 'フェブラリーS・チャンピオンズC', null, '鹿毛'],
  ['chrysoberyl', 'クリソベリル', 'm', 'senko', 'd', 'c', 'A', 'チャンピオンズC・JDD・帝王賞', null, '栗毛'],
  ['lemonpop', 'レモンポップ', 'm', 'nige', 'd', 'sm', 'A', 'フェブラリーS・チャンピオンズC', 'k_lg_sand', '栗毛'],
  ['falcon', 'スマートファルコン', 'm', 'nige', 'd', 'c', 'A', '東京大賞典・帝王賞・JBCクラシック', 'k_lg_sand', '栗毛'],
  ['tapdance', 'タップダンスシチー', 'm', 'nige', 't', 'c', 'B', 'ジャパンカップ・宝塚記念', null, '鹿毛'],
  ['cesario', 'シーザリオ', 'f', 'sashi', 't', 'c', 'B', 'オークス・アメリカンオークス', null, '青鹿毛'],
  ['linecraft', 'ラインクラフト', 'f', 'senko', 't', 'm', 'B', '桜花賞・NHKマイルC', null, '鹿毛'],
  ['kawakami', 'カワカミプリンセス', 'f', 'sashi', 't', 'c', 'B', 'オークス・秋華賞（無敗）', null, '鹿毛'],
  ['straight', 'ストレイトガール', 'f', 'sashi', 't', 'sm', 'B', 'ヴィクトリアマイル2勝・スプリンターズS', null, '鹿毛'],
  ['believe', 'ビリーヴ', 'f', 'senko', 't', 's', 'B', 'スプリンターズS・高松宮記念', null, '鹿毛'],
  ['sweep', 'スイープトウショウ', 'f', 'oikomi', 't', 'mc', 'B', '秋華賞・宝塚記念・エリザベス女王杯', null, '鹿毛'],
  ['journey', 'ドリームジャーニー', 'm', 'oikomi', 't', 'c', 'B', '朝日杯・宝塚記念・有馬記念', null, '鹿毛'],
  ['titleholder', 'タイトルホルダー', 'm', 'nige', 't', 'l', 'A', '菊花賞・天皇賞（春）・宝塚記念', 'k_lg_festival', '鹿毛'],
  ['finemotion', 'ファインモーション', 'f', 'senko', 't', 'mc', 'B', '秋華賞・エリザベス女王杯', null, '鹿毛'],
  ['zephyr', 'ヤマニンゼファー', 'm', 'senko', 't', 'sm', 'B', '安田記念2勝・天皇賞（秋）', null, '栗毛'],
  ['reydeoro', 'レイデオロ', 'm', 'sashi', 't', 'c', 'B', '日本ダービー・天皇賞（秋）', null, '鹿毛'],
  ['fierement', 'フィエールマン', 'm', 'sashi', 't', 'l', 'A', '菊花賞・天皇賞（春）2勝', null, '鹿毛'],
  ['songline', 'ソングライン', 'f', 'senko', 't', 'm', 'B', '安田記念2勝・ヴィクトリアマイル', null, '鹿毛'],
  ['topload', 'ナリタトップロード', 'm', 'senko', 't', 'l', 'B', '菊花賞', null, '栗毛'],
  ['admirevega', 'アドマイヤベガ', 'm', 'sashi', 't', 'c', 'B', '日本ダービー', null, '鹿毛'],
  ['pirowinner', 'ニホンピロウイナー', 'm', 'senko', 't', 'sm', 'B', 'マイルCS2勝・安田記念', null, '黒鹿毛'],
  ['northflight', 'ノースフライト', 'f', 'sashi', 't', 'm', 'B', '安田記念・マイルCS', null, '鹿毛'],
  ['karston', 'カルストンライトオ', 'm', 'nige', 't', 's', 'B', 'スプリンターズS・アイビスSD2勝', null, '鹿毛'],
  ['hishimiracle', 'ヒシミラクル', 'm', 'sashi', 't', 'l', 'B', '菊花賞・天皇賞（春）・宝塚記念', null, '芦毛'],
  ['shahryar', 'シャフリヤール', 'm', 'sashi', 't', 'c', 'B', '日本ダービー・ドバイシーマクラシック', null, '黒鹿毛'],
  ['justinmilano', 'ジャスティンミラノ', 'm', 'senko', 't', 'c', 'A', '皐月賞', null, '鹿毛'],
  ['danondecile', 'ダノンデサイル', 'm', 'senko', 't', 'c', 'B', '日本ダービー', null, '鹿毛'],
  ['soleoriens', 'ソールオリエンス', 'm', 'oikomi', 't', 'c', 'B', '皐月賞', null, '鹿毛'],
  ['tastiera', 'タスティエーラ', 'm', 'senko', 't', 'c', 'B', '日本ダービー', null, '鹿毛'],
  ['durezza', 'ドゥレッツァ', 'm', 'senko', 't', 'l', 'B', '菊花賞', null, '栗毛'],
  ['starsonearth', 'スターズオンアース', 'f', 'sashi', 't', 'mc', 'A', '桜花賞・オークス', null, '鹿毛'],
  ['geoglyph', 'ジオグリフ', 'm', 'sashi', 't', 'c', 'B', '皐月賞', null, '栗毛'],
  ['askvictormore', 'アスクビクターモア', 'm', 'senko', 't', 'l', 'B', '菊花賞', null, '鹿毛'],
  ['jackdor', 'ジャックドール', 'm', 'nige', 't', 'c', 'B', '大阪杯・金鯱賞', null, '栗毛'],
  ['panthalassa', 'パンサラッサ', 'm', 'nige', 'b', 'c', 'A', 'サウジカップ・ドバイターフ', 'k_lg_silence', '鹿毛'],
  ['ushba', 'ウシュバテソーロ', 'm', 'oikomi', 'd', 'c', 'A', 'ドバイワールドカップ・東京大賞典', 'k_lg_sand', '栗毛'],
  ['namur', 'ナミュール', 'f', 'sashi', 't', 'm', 'B', 'マイルCS', null, '栗毛'],
  ['serifos', 'セリフォス', 'm', 'sashi', 't', 'm', 'B', 'マイルCS', null, '鹿毛'],
  ['schnell', 'シュネルマイスター', 'm', 'sashi', 't', 'm', 'B', 'NHKマイルC', null, '鹿毛'],
  ['pixieknight', 'ピクシーナイト', 'm', 'senko', 't', 's', 'B', 'スプリンターズS', null, '栗毛'],
  ['mamacocha', 'ママコチャ', 'f', 'senko', 't', 's', 'B', 'スプリンターズS', null, '栗毛'],
  ['lugal', 'ルガル', 'm', 'senko', 't', 's', 'B', 'スプリンターズS', null, '鹿毛'],
  ['namuraclair', 'ナムラクレア', 'f', 'sashi', 't', 's', 'B', '函館スプリントS・キーンランドC', null, '栗毛'],
  ['fastforce', 'ファストフォース', 'm', 'senko', 't', 's', 'B', '高松宮記念', null, '鹿毛'],
  ['danonsmash', 'ダノンスマッシュ', 'm', 'senko', 't', 's', 'B', '高松宮記念・香港スプリント', null, '鹿毛'],
  ['mozuascot', 'モズアスコット', 'm', 'sashi', 'b', 'm', 'B', '安田記念・フェブラリーS', null, '栗毛'],
  ['indychamp', 'インディチャンプ', 'm', 'senko', 't', 'm', 'A', '安田記念・マイルCS', null, '鹿毛'],
  ['admiremars', 'アドマイヤマーズ', 'm', 'senko', 't', 'm', 'B', '朝日杯FS・NHKマイルC・香港マイル', null, '栗毛'],
  ['salios', 'サリオス', 'm', 'senko', 't', 'm', 'B', '朝日杯FS', null, '栗毛'],
  ['stelvio', 'ステルヴィオ', 'm', 'sashi', 't', 'm', 'B', 'マイルCS', null, '黒鹿毛'],
  ['persianknight', 'ペルシアンナイト', 'm', 'sashi', 't', 'm', 'B', 'マイルCS', null, '黒鹿毛'],
  ['mikkyisle', 'ミッキーアイル', 'm', 'nige', 't', 'sm', 'B', 'NHKマイルC・マイルCS', null, '鹿毛'],
  ['logotype', 'ロゴタイプ', 'm', 'senko', 't', 'm', 'B', '朝日杯FS・皐月賞・安田記念', null, '黒鹿毛'],
  ['goldactor', 'ゴールドアクター', 'm', 'senko', 't', 'l', 'B', '有馬記念', null, '青鹿毛'],
  ['satonocrown', 'サトノクラウン', 'm', 'sashi', 't', 'c', 'B', '宝塚記念・香港ヴァーズ', null, '黒鹿毛'],
  ['cheval', 'シュヴァルグラン', 'm', 'sashi', 't', 'l', 'B', 'ジャパンカップ', null, '栗毛'],
  ['kiseki', 'キセキ', 'm', 'senko', 't', 'cl', 'B', '菊花賞', null, '黒鹿毛'],
  ['alain', 'アルアイン', 'm', 'senko', 't', 'c', 'B', '皐月賞・大阪杯', null, '鹿毛'],
  ['raypapale', 'レイパパレ', 'f', 'nige', 't', 'c', 'B', '大阪杯（無敗で制覇）', null, '鹿毛'],
  ['potager', 'ポタジェ', 'm', 'sashi', 't', 'c', 'B', '大阪杯', null, '鹿毛'],
  ['wagnerian', 'ワグネリアン', 'm', 'sashi', 't', 'c', 'B', '日本ダービー', null, '鹿毛'],
  ['blastonepiece', 'ブラストワンピース', 'm', 'senko', 't', 'c', 'B', '有馬記念', null, '鹿毛'],
  ['worldpremiere', 'ワールドプレミア', 'm', 'sashi', 't', 'l', 'B', '菊花賞・天皇賞（春）', null, '鹿毛'],
  ['geraldina', 'ジェラルディーナ', 'f', 'sashi', 't', 'c', 'B', 'エリザベス女王杯', null, '鹿毛'],
  ['akaiito', 'アカイイト', 'f', 'oikomi', 't', 'c', 'B', 'エリザベス女王杯', null, '鹿毛'],
  ['lovesonlyyou', 'ラヴズオンリーユー', 'f', 'sashi', 't', 'c', 'A', 'オークス・BCフィリー＆メアターフ', 'k_lg_queen', '鹿毛'],
  ['noomcore', 'ノームコア', 'f', 'senko', 't', 'm', 'B', 'ヴィクトリアマイル・香港カップ', null, '芦毛'],
  ['aerolithe', 'アエロリット', 'f', 'nige', 't', 'm', 'B', 'NHKマイルC', null, '芦毛'],
  ['letsgodonki', 'レッツゴードンキ', 'f', 'senko', 't', 'sm', 'B', '桜花賞', null, '栗毛'],
  ['harpstar', 'ハープスター', 'f', 'oikomi', 't', 'mc', 'B', '桜花賞', null, '鹿毛'],
  ['mambo', 'メイショウマンボ', 'f', 'sashi', 't', 'c', 'B', 'オークス・秋華賞・エリザベス女王杯', null, '鹿毛'],
  ['mikkyqueen', 'ミッキークイーン', 'f', 'sashi', 't', 'c', 'B', 'オークス・秋華賞', null, '鹿毛'],
  ['pandora', 'ショウナンパンドラ', 'f', 'sashi', 't', 'c', 'B', '秋華賞・ジャパンカップ', null, '鹿毛'],
  ['marialite', 'マリアライト', 'f', 'sashi', 't', 'c', 'B', '宝塚記念・エリザベス女王杯', null, '黒鹿毛'],
  ['reddesire', 'レッドディザイア', 'f', 'sashi', 't', 'mc', 'B', '秋華賞', null, '鹿毛'],
  ['danceinthedark', 'ダンスインザダーク', 'm', 'sashi', 't', 'l', 'A', '菊花賞', null, '鹿毛'],
  ['fusaichi', 'フサイチコンコルド', 'm', 'sashi', 't', 'c', 'B', '日本ダービー（キャリア3戦目で制覇）', null, '鹿毛'],
  ['taishin', 'ナリタタイシン', 'm', 'oikomi', 't', 'c', 'B', '皐月賞', null, '黒鹿毛'],
  ['ticket', 'ウイニングチケット', 'm', 'sashi', 't', 'c', 'A', '日本ダービー', null, '黒鹿毛'],
  ['yaeno', 'ヤエノムテキ', 'm', 'senko', 't', 'c', 'B', '皐月賞・天皇賞（秋）', null, '栗毛'],
  ['chiyonoo', 'サクラチヨノオー', 'm', 'senko', 't', 'c', 'B', '朝日杯3歳S・日本ダービー', null, '鹿毛'],
  ['ines', 'アイネスフウジン', 'm', 'nige', 't', 'c', 'B', '朝日杯3歳S・日本ダービー', null, '黒鹿毛'],
  ['legacyworld', 'レガシーワールド', 'm', 'senko', 't', 'c', 'B', 'ジャパンカップ', null, '栗毛'],
  ['marvelous', 'マーベラスサンデー', 'm', 'sashi', 't', 'cl', 'B', '宝塚記念', null, '栗毛'],
  ['bubblegum', 'バブルガムフェロー', 'm', 'senko', 't', 'c', 'B', '朝日杯3歳S・天皇賞（秋）', null, '鹿毛'],
  ['dantsuflame', 'ダンツフレーム', 'm', 'sashi', 't', 'c', 'B', '宝塚記念', null, '鹿毛'],
  ['kris', 'シンボリクリスエス', 'm', 'senko', 't', 'c', 'A', '天皇賞（秋）2勝・有馬記念2勝', null, '黒鹿毛'],
  ['noreason', 'ノーリーズン', 'm', 'senko', 't', 'c', 'B', '皐月賞', null, '鹿毛'],
  ['deepsky', 'ディープスカイ', 'm', 'sashi', 't', 'mc', 'B', 'NHKマイルC・日本ダービー', null, '栗毛'],
  ['oken', 'オウケンブルースリ', 'm', 'oikomi', 't', 'l', 'B', '菊花賞', null, '栗毛'],
  ['rogiuniverse', 'ロジユニヴァース', 'm', 'senko', 't', 'c', 'B', '日本ダービー（不良馬場）', null, '鹿毛'],
  ['screenhero', 'スクリーンヒーロー', 'm', 'senko', 't', 'c', 'B', 'ジャパンカップ', null, '栗毛'],
  ['admiremoon', 'アドマイヤムーン', 'm', 'sashi', 't', 'c', 'A', '宝塚記念・ジャパンカップ・ドバイDF', null, '鹿毛'],
  ['festa', 'ナカヤマフェスタ', 'm', 'sashi', 't', 'c', 'B', '宝塚記念・凱旋門賞2着', null, '鹿毛'],
  ['jordan', 'トーセンジョーダン', 'm', 'senko', 't', 'c', 'B', '天皇賞（秋）', null, '鹿毛'],
  ['oneandonly', 'ワンアンドオンリー', 'm', 'sashi', 't', 'c', 'B', '日本ダービー', null, '黒鹿毛'],
  ['islabonita', 'イスラボニータ', 'm', 'senko', 't', 'mc', 'B', '皐月賞', null, '黒鹿毛'],
  ['jackal', 'トーホウジャッカル', 'm', 'senko', 't', 'l', 'B', '菊花賞', null, '栗毛'],
  ['lovelyday', 'ラブリーデイ', 'm', 'senko', 't', 'c', 'B', '宝塚記念・天皇賞（秋）', null, '黒鹿毛'],
  ['makahiki', 'マカヒキ', 'm', 'oikomi', 't', 'c', 'B', '日本ダービー', null, '鹿毛'],
  ['southvigorous', 'サウスヴィグラス', 'm', 'nige', 'd', 's', 'B', 'JBCスプリント', null, '栗毛'],
  ['wonderacute', 'ワンダーアキュート', 'm', 'senko', 'd', 'c', 'B', 'JBCクラシック・かしわ記念', null, '鹿毛'],
  ['teokeynes', 'テーオーケインズ', 'm', 'senko', 'd', 'c', 'B', 'チャンピオンズC・帝王賞', null, '栗毛'],
  ['cafepharoah', 'カフェファラオ', 'm', 'senko', 'd', 'm', 'B', 'フェブラリーS2勝', null, '鹿毛'],
  ['moanin', 'モーニン', 'm', 'senko', 'd', 'm', 'B', 'フェブラリーS', null, '栗毛'],
  ['sanvista', 'サンビスタ', 'f', 'sashi', 'd', 'c', 'B', 'チャンピオンズC', null, '黒鹿毛'],
  ['chuwawizard', 'チュウワウィザード', 'm', 'senko', 'd', 'c', 'B', 'チャンピオンズC・川崎記念', null, '鹿毛'],
  ['luvansleve', 'ルヴァンスレーヴ', 'm', 'senko', 'd', 'mc', 'A', 'チャンピオンズC・JBCクラシック', null, '鹿毛'],
  ['fineneedle', 'ファインニードル', 'm', 'senko', 't', 's', 'B', '高松宮記念・スプリンターズS', null, '鹿毛'],
  ['bigarthur', 'ビッグアーサー', 'm', 'senko', 't', 's', 'B', '高松宮記念', null, '鹿毛'],
  ['redfalx', 'レッドファルクス', 'm', 'oikomi', 't', 's', 'B', 'スプリンターズS2勝', null, '芦毛'],
  ['marchan', 'アストンマーチャン', 'f', 'nige', 't', 's', 'B', 'スプリンターズS', null, '栗毛'],
  ['sleepless', 'スリープレスナイト', 'f', 'senko', 't', 's', 'B', 'スプリンターズS', null, '栗毛'],
  ['laurelguerreiro', 'ローレルゲレイロ', 'm', 'nige', 't', 's', 'B', '高松宮記念・スプリンターズS', null, '青鹿毛'],
  ['flowerpark', 'フラワーパーク', 'f', 'senko', 't', 's', 'B', '高松宮杯・スプリンターズS', null, '鹿毛'],
  ['haiseiko', 'ハイセイコー', 'm', 'senko', 'b', 'c', 'A', '皐月賞（国民的アイドルホース）', null, '鹿毛'],
  ['toshoboy', 'トウショウボーイ', 'm', 'senko', 't', 'mc', 'A', '皐月賞・有馬記念', 'k_lg_wing', '鹿毛'],
  ['tenpoint', 'テンポイント', 'm', 'senko', 't', 'cl', 'A', '天皇賞（春）・有馬記念', null, '栗毛'],
  ['greengrass', 'グリーングラス', 'm', 'senko', 't', 'l', 'A', '菊花賞・天皇賞（春）・有馬記念', 'k_lg_stayer', '青鹿毛'],
  ['maruzensky', 'マルゼンスキー', 'm', 'nige', 't', 'sm', 'S', '朝日杯3歳S（8戦無敗）', 'k_lg_silence', '鹿毛'],
  ['katsuragi', 'カツラギエース', 'm', 'nige', 't', 'c', 'B', 'ジャパンカップ・宝塚記念', null, '鹿毛'],
  ['nippoteio', 'ニッポーテイオー', 'm', 'senko', 't', 'm', 'B', '天皇賞（秋）・マイルCS・安田記念', null, '鹿毛'],
  ['ramonu', 'メジロラモーヌ', 'f', 'sashi', 't', 'mc', 'A', '史上初の牝馬三冠', 'k_lg_queen', '鹿毛'],
  ['starou', 'サクラスターオー', 'm', 'sashi', 't', 'cl', 'B', '皐月賞・菊花賞', null, '栗毛'],
  ['speedsymboli', 'スピードシンボリ', 'm', 'senko', 't', 'l', 'B', '有馬記念2勝・天皇賞（春）', null, '黒鹿毛'],
  ['mihoshinzan', 'ミホシンザン', 'm', 'senko', 't', 'cl', 'B', '皐月賞・菊花賞・天皇賞（春）', null, '鹿毛'],
  ['kaburaya', 'カブラヤオー', 'm', 'nige', 't', 'c', 'A', '皐月賞・日本ダービー', 'k_lg_silence', '黒鹿毛'],
  ['hokutovega', 'ホクトベガ', 'f', 'senko', 'b', 'c', 'A', 'エリザベス女王杯・川崎記念', null, '鹿毛'],
  ['vega', 'ベガ', 'f', 'sashi', 't', 'mc', 'B', '桜花賞・オークス', null, '鹿毛'],
  ['dancepartner', 'ダンスパートナー', 'f', 'sashi', 't', 'c', 'B', 'オークス・エリザベス女王杯', null, '青鹿毛'],
  ['maxbeauty', 'マックスビューティ', 'f', 'senko', 't', 'mc', 'B', '桜花賞・オークス', null, '栗毛']
];

const Legends = {
  TIER: { S: { base: 94, rarity: 'UR' }, A: { base: 89, rarity: 'SSR' }, B: { base: 85, rarity: 'SR' } },
  DIST_CODE: { s: 'sprint', m: 'mile', c: 'classic', l: 'long' },
  STYLE_SKILLS: {
    nige: ['k_escape', 'k_keeplead', 'k_rocket'],
    senko: ['k_breakout', 'k_senkoaccel', 'k_goodpos'],
    sashi: ['k_sashikiri', 'k_kick', 'k_outside'],
    oikomi: ['k_doto', 'k_ooso', 'k_lastaccel']
  },
  _list: null,

  hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  },

  // 名馬の能力（格・得意距離・馬場・脚質から査定）
  all() {
    if (this._list) return this._list;
    this._list = GAME_DATA.legendList.map(([id, name, sex, style, surf, dists, tier, wins, sig, coat]) => {
      const h = this.hash(id);
      const v = k => ((h >>> (k * 3)) % 7) - 3;     // 馬ごとの個性（-3〜+3）
      const base = this.TIER[tier].base;
      const ds = dists.split('').map(c => this.DIST_CODE[c]);
      const stats = { speed: base + v(0), stamina: base + v(1), power: base + v(2), guts: base + v(3), intelligence: base - 2 + v(4) };
      if (ds.includes('sprint')) { stats.speed += 5; stats.power += 4; stats.stamina -= 10; }
      if (ds.includes('mile')) { stats.speed += 3; stats.stamina -= 2; }
      if (ds.includes('long')) { stats.stamina += 8; stats.speed -= 2; }
      if (surf === 'd') { stats.power += 5; }
      if (style === 'nige') stats.guts += 3;
      if (style === 'oikomi' || style === 'sashi') stats.speed += 2;
      const aptitude = {};
      Object.values(this.DIST_CODE).forEach(k => { aptitude[k] = ds.includes(k) ? 95 : 50; });
      const order = ['sprint', 'mile', 'classic', 'long'];
      ds.forEach(k => {
        const i = order.indexOf(k);
        [order[i - 1], order[i + 1]].forEach(n => { if (n && aptitude[n] < 72) aptitude[n] = 72; });
      });
      aptitude.turf = surf === 'd' ? 45 : surf === 'b' ? 88 : 96;
      aptitude.dirt = surf === 't' ? 40 : surf === 'b' ? 88 : 96;
      const pool = this.STYLE_SKILLS[style];
      const skills = [];
      if (sig) skills.push(sig);
      skills.push(pool[0]);
      if (ds.includes('long')) skills.push('k_stayer');
      else if (ds.includes('sprint')) skills.push('k_sprintking');
      else skills.push(tier === 'B' ? pool[1] : 'k_tataki');
      return {
        id, name, gender: sex === 'f' ? 'female' : 'male', style, surf, dists: ds, tier, wins, coat,
        stats, aptitude, skills: [...new Set(skills)].slice(0, 3), rarity: this.TIER[tier].rarity
      };
    });
    return this._list;
  },

  get(id) { return this.all().find(l => l.id === id); },

  // 名馬カード（配合に使える）
  card(l) {
    const stats = {};
    STAT_KEYS.forEach(k => { stats[k] = Math.min(98, Math.round(l.stats[k] * 0.97)); });
    const trait = STAT_KEYS.reduce((a, b) => (stats[b] > stats[a] ? b : a));
    return {
      id: 'lc_' + l.id, type: l.gender === 'male' ? 'sire' : 'mare', legend: true, legendId: l.id,
      name: l.name, rarity: l.rarity, stats, apt: Object.assign({}, l.aptitude),
      style: l.style, growth: l.dists.includes('long') ? 'late' : l.dists.includes('sprint') ? 'early' : 'normal',
      trait, skill: l.skills[0],
      desc: `👑 実在の名馬。主な勝ち鞍：${l.wins}`
    };
  },

  enabled() { return Player.data.settings.legends !== false; },

  // ── 写真：自分で設定した写真 → Wikimedia Commons の写真 → なし ──
  _photoUrls: {},
  photoUrl(id) {
    const custom = typeof Media !== 'undefined' && Media.url('photo:' + id);
    if (custom) return custom;
    const p = GAME_DATA.legendPhotos && GAME_DATA.legendPhotos[id];
    if (!p) return null;
    if (!this._photoUrls[id]) {
      // data URI を blob URL にして、画面のHTMLを軽くする
      try {
        const bin = atob(p.src.split(',')[1]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        this._photoUrls[id] = URL.createObjectURL(new Blob([arr], { type: 'image/jpeg' }));
      } catch (e) { this._photoUrls[id] = p.src; }
    }
    return this._photoUrls[id];
  },
  photoCredit(id) {
    if (typeof Media !== 'undefined' && Media.url('photo:' + id)) return { custom: true };
    return (GAME_DATA.legendPhotos || {})[id] || null;
  },
  async setPhoto(id, file) {
    const blob = await Media.resizeImage(file, 420);
    await Media.put('photo:' + id, blob, { name: file.name });
  },
  resetPhoto(id) { return Media.del('photo:' + id); },

  // このレースに出てくる名馬を選ぶ（重賞のみ、適性が合う馬）
  pickFor(race) {
    if (!this.enabled() || race.kind !== 'graded' || race.ages === '2') return [];
    const n = race.grade === 'g1' ? 1 + (Math.random() < 0.6 ? 1 : 0) + (Math.random() < 0.25 ? 1 : 0)
      : race.grade === 'g2' ? (Math.random() < 0.6 ? 1 : 0) : (Math.random() < 0.35 ? 1 : 0);
    if (!n) return [];
    const cat = Horse.distCat(race.distance);
    const cands = this.all().filter(l => (!race.female || l.gender === 'female')
      && l.aptitude[cat] >= 72 && l.aptitude[race.surface] >= 80);
    const out = [];
    while (out.length < n && cands.length) {
      // 格の高い名馬ほどGⅠに、格下の名馬ほどGⅢに出やすい
      const w = cands.map(l => (race.grade === 'g1' ? { S: 3, A: 2, B: 1 } : race.grade === 'g2' ? { S: 1, A: 2, B: 2 } : { S: 0.5, A: 1, B: 3 })[l.tier]
        * (l.aptitude[cat] >= 95 ? 2 : 1));
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      let i = 0;
      while ((r -= w[i]) > 0) i++;
      out.push(cands.splice(i, 1)[0]);
    }
    return out;
  },

  entrant(l, race) {
    const adj = Race.ageAdjust(race);
    const stats = {};
    STAT_KEYS.forEach(k => { stats[k] = Math.round(l.stats[k] + adj + Util.gauss() * 1.5); });
    return {
      id: Util.uid('lg_'), legendId: l.id, name: l.name, owner: '👑 名馬', isPlayer: false, isLegend: true,
      stats, aptitude: Object.assign({}, l.aptitude), runningStyle: l.style, skills: l.skills.slice(),
      condition: Util.randInt(80, 100), fatigue: 0, coat: l.coat
    };
  },

  // 記録（出会った・先着した・カード入手）
  rec(id) {
    const p = Player.data;
    if (!p.legends) p.legends = {};
    if (!p.legends[id]) p.legends[id] = { met: 0, beaten: 0, lost: 0 };
    return p.legends[id];
  },

  CARD_CHANCE: { g1: 0.35, g2: 0.25, g3: 0.2 },

  // レース結果の反映：先着した名馬から一定確率でカード入手
  applyResult(race, result) {
    const me = result.finish.find(f => f.isPlayer);
    const out = { met: [], beaten: [], card: null };
    if (!me) return out;
    const legends = result.finish.filter(f => f.legendId);
    legends.forEach(f => {
      const r = this.rec(f.legendId);
      r.met++;
      const l = this.get(f.legendId);
      out.met.push(l);
      if (me.place < f.place) { r.beaten++; out.beaten.push(l); } else r.lost++;
    });
    const chance = this.CARD_CHANCE[race.grade] || 0;
    const target = out.beaten.slice().sort((a, b) => 'SAB'.indexOf(a.tier) - 'SAB'.indexOf(b.tier))[0];
    if (target && Math.random() < chance) {
      const c = Cards.get('lc_' + target.id);
      const isNew = !Player.data.seenCards.includes(c.id);
      Player.addCard(c.id);
      out.card = { card: c, isNew };
    }
    return out;
  },

  stats() {
    const p = Player.data.legends || {};
    const v = Object.values(p);
    return {
      met: v.filter(r => r.met).length,
      beaten: v.filter(r => r.beaten).length,
      cards: this.all().filter(l => Player.data.seenCards.includes('lc_' + l.id)).length,
      total: this.all().length
    };
  }
};
