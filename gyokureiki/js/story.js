/* 東方玉霊姫 - ストーリーデータとステージ生成 */
(function (global) {
  'use strict';

  const D = global.GK_DATA;
  const KD = global.GK.KODAMA;
  const P = global.GKP;

  // who: 話し手（キャラ名）。'' はナレーション、'@' はプレイヤー
  const AREAS = [
    {
      name: '博麗神社', lv: [3, 8], ai: 'easy',
      chars: ['霊夢', 'ルーミア', '大妖精', 'リグル', 'サニー', 'ルナ', 'スター'],
      intro: [
        ['', '幻想郷の各地で、コダマたちが騒ぎ始めた――。'],
        ['霊夢', 'あら、あんたが新しい玉霊姫？ 契約したてのコダマを連れてるわね。'],
        ['霊夢', '最近、妖精やら妖怪やらがコダマを連れて暴れてるのよ。腕試しにちょうどいいわ。'],
        ['霊夢', '勝負に勝つとコダマが経験を積むわ。それから「契約書」を手に入れたら、持ち物から使ってみなさい。'],
      ],
      boss: {
        char: '霊夢', name: '博麗霊夢',
        pre: [['霊夢', 'ここまで来たなら一人前ね。最後は私が相手してあげる。'], ['霊夢', '手加減はしないわよ！']],
        post: [['霊夢', '……やるじゃない。異変の気配は魔法の森の方からするわ。'], ['霊夢', 'これ、持っていきなさい。私のコダマの契約書よ。']],
      },
    },
    {
      name: '魔法の森', lv: [8, 15], ai: 'easy',
      chars: ['魔理沙', 'アリス', '朱鷺子', 'メディスン', '穣子', '静葉', 'ミスティア'],
      intro: [['魔理沙', 'よう！ 霊夢から聞いたぜ。森のキノコよりコダマ集めのほうが面白いって？'], ['魔理沙', '森の連中は手強いぜ。私に勝てたら認めてやるよ。']],
      boss: {
        char: '魔理沙', name: '霧雨魔理沙',
        pre: [['魔理沙', '弾幕はパワーだぜ！ コダマ勝負もな！']],
        post: [['魔理沙', 'ちぇっ、負けたぜ。湖のほうで妖精たちが騒いでたぞ。'], ['魔理沙', '借りは返す主義だ。これをやるよ！']],
      },
    },
    {
      name: '霧の湖', lv: [14, 22], ai: 'easy',
      chars: ['チルノ', '大妖精', 'レティ', 'わかさぎ姫', '影狼', '赤蛮奇', 'リリーＷ'],
      intro: [['', '霧の湖。冷たい風と一緒に、元気な声が聞こえてくる。'], ['チルノ', 'あたいったら最強ね！ コダマ勝負でも最強なんだから！']],
      boss: {
        char: 'チルノ', name: 'チルノ',
        pre: [['チルノ', 'あたいの最強コダマで凍らせてやる！']],
        post: [['チルノ', 'う、うそだ……あたいが負けるなんて！'], ['大妖精', 'チルノちゃん、紅いお屋敷の人たちも最近コダマを集めてるみたいだよ。']],
      },
    },
    {
      name: '紅魔館', lv: [20, 30], ai: 'normal',
      chars: ['美鈴', '小悪魔', 'パチュリー', '咲夜', 'レミリア', 'フラン'],
      intro: [['美鈴', 'ここは紅魔館！ ……えっ、お嬢様に挑戦？ まずは門番の私を倒してからですよ！']],
      boss: {
        char: 'レミリア', name: 'レミリア・スカーレット',
        pre: [['咲夜', 'お嬢様、例の玉霊姫が参りました。'], ['レミリア', '運命は既に見えているわ。あなたの負けよ。']],
        post: [['レミリア', 'ふふ、運命を覆すなんてね。気に入ったわ。'], ['レミリア', '冥界のお嬢様もコダマを集めているそうよ。']],
      },
    },
    {
      name: '白玉楼', lv: [28, 38], ai: 'normal',
      chars: ['橙', '藍', 'ルナサ', 'メルラン', 'リリカ', '妖夢', '幽々子', 'レイラ'],
      intro: [['', '長い長い階段の先、冥界の庭園・白玉楼。'], ['妖夢', '生きた人間がここへ何の用です？ コダマ勝負なら、受けて立ちます！'], ['', '※Lv30を超えたちびコダマは「パーティ」画面で進化できるようになります。']],
      boss: {
        char: '幽々子', name: '西行寺幽々子',
        pre: [['幽々子', 'あら、可愛いコダマたち。食べちゃいたいくらい。'], ['妖夢', '幽々子様、それは比喩ですよね……？']],
        post: [['幽々子', 'お腹いっぱい楽しんだわ。竹林のお姫様にも会ってみるといいわよ。']],
      },
    },
    {
      name: '永遠亭', lv: [36, 46], ai: 'normal',
      chars: ['てゐ', '鈴仙', '永琳', '輝夜', '妹紅', '慧音', 'レイセン'],
      intro: [['てゐ', '迷いの竹林で迷子かい？ 案内してあげてもいいよ、コダマ勝負に勝てたらね！']],
      boss: {
        char: '輝夜', name: '蓬莱山輝夜',
        pre: [['輝夜', '永遠の退屈しのぎに、あなたと遊んであげる。'], ['輝夜', '私の難題、解けるかしら？']],
        post: [['輝夜', '見事ね。山の神様たちも何か企んでいるみたいよ。']],
      },
    },
    {
      name: '妖怪の山', lv: [44, 54], ai: 'normal',
      chars: ['椛', '文', 'はたて', 'にとり', '雛', '早苗', '神奈子', '諏訪子'],
      intro: [['文', 'どうも、清く正しい射命丸です！ 噂の玉霊姫さん、取材させてください！'], ['椛', '侵入者！ ……と言いたいところですが、勝負で決めましょう。']],
      boss: {
        char: '神奈子', name: '八坂神奈子',
        pre: [['早苗', '神奈子様、この方が噂の！'], ['神奈子', '信仰は力。コダマとの絆もまた力だ。見せてもらおう！']],
        post: [['神奈子', '天晴れだ。地底の連中も騒いでいる、気をつけて行け。']],
      },
    },
    {
      name: '地底', lv: [52, 62], ai: 'normal',
      chars: ['キスメ', 'ヤマメ', 'パルスィ', '勇儀', 'さとり', '燐', '空', 'こいし'],
      intro: [['パルスィ', '地上の人間が地底に何の用？ 妬ましいわね……そのコダマたち。']],
      boss: {
        char: 'さとり', name: '古明地さとり',
        pre: [['さとり', '……あなたの次の一手、もう読めていますよ。'], ['さとり', '心を読まれても勝てるかしら？']],
        post: [['さとり', '読めていても止められない……面白いですね。'], ['さとり', '地上の寺と霊廟でも、コダマが集まっているようです。']],
      },
    },
    {
      name: '命蓮寺・神霊廟', lv: [60, 70], ai: 'hard',
      chars: ['ナズーリン', '小傘', '一輪', '村紗', '星', '聖', 'ぬえ', '響子', '芳香', '青娥', '屠自古', '布都', '神子', 'マミゾウ'],
      intro: [['響子', 'おはよーございます！！'], ['ナズーリン', 'お宝の気配……と思ったら玉霊姫か。聖様が会いたがっていたよ。']],
      boss: {
        char: '聖', name: '聖白蓮',
        pre: [['聖', '人も妖怪もコダマも、みな平等。いざ、南無三――！']],
        post: [['聖', '素晴らしい絆です。月の都から不穏な気配が……どうかお気をつけて。']],
      },
    },
    {
      name: '天界・月の都', lv: [68, 80], ai: 'hard',
      chars: ['衣玖', '天子', '依姫', '豊姫', '鈴瑚', '清蘭', 'ドレミー', 'サグメ'],
      intro: [['衣玖', '空気を読むと、あなたは月へ向かう運命のようですね。'], ['天子', '退屈してたのよ！ 天人の私と勝負しなさい！']],
      boss: {
        char: '依姫', name: '綿月依姫',
        pre: [['依姫', '地上の者よ。神々の力を借りた私のコダマに勝てますか？']],
        post: [['依姫', '……見事です。異変の源は、さらに向こう――魔界にあるようです。'], ['', '★ メインストーリー クリア！ 以降はEXエリアが解放されます。']],
      },
    },
    {
      name: 'EX：魔界', lv: [78, 88], ai: 'hard',
      chars: ['サラ', 'ルイズ', 'ユキ', 'マイ', '夢子', '神綺', 'ありす', 'エリス', 'サリエル', 'キクリ', 'コンガラ', 'マガン'],
      intro: [['サラ', 'ようこそ魔界へ！ ここから先はちょっと手強いよ？']],
      boss: {
        char: '神綺', name: '神綺',
        pre: [['夢子', '神綺様、侵入者です。'], ['神綺', 'あらあら、可愛いお客さん。魔界の神が相手をしてあげる♪']],
        post: [['神綺', '強い子ね〜。夢と幻の世界にも、強いコダマ使いがいるわよ。']],
      },
    },
    {
      name: 'EX：夢幻世界', lv: [86, 96], ai: 'hard',
      chars: ['靈夢', '魅魔', '幽香', 'ユウカ', 'エリー', 'くるみ', '幻月', '夢月', 'オレンジ', '純狐', 'ヘカーテ', 'クラウン'],
      intro: [['魅魔', 'ふふ、ここまで辿り着くとはね。最後の試練を始めようか。']],
      boss: {
        char: 'ヘカーテ', name: 'ヘカーティア・ラピスラズリ',
        pre: [['ヘカーテ', 'あたいは地獄の女神。三つの身体、三倍の力で相手してあげる！'], ['純狐', '純粋な力、見せてもらいましょう。']],
        post: [['ヘカーテ', 'やるじゃない！ あなたこそ真の玉霊姫ね。'], ['', '★ 全ストーリー クリア！ おめでとうございます！']],
      },
    },
  ];

  const STAGES_PER_AREA = 5;
  const STAGE_NAMES = ['その１', 'その２', 'その３', 'その４', 'ボス'];
  const GENERIC_PRE = [
    '{c}「コダマ勝負よ！ 負けないんだから！」',
    '{c}「見ない顔ね。ちょっと腕試しさせてもらうわ」',
    '{c}「ここを通りたければ、私のコダマを倒していきなさい！」',
    '{c}「ふふん、私のコダマは強いわよ？」',
  ];
  const GENERIC_POST = ['{c}「くっ……やるわね」', '{c}「負けちゃった……次は負けないから！」', '{c}「強いのね、あなた」'];

  /* ---------- プール ---------- */
  const charKey = P.charKey;
  function lineIdsForChar(ch) {
    // その名前のキャラが属する系統（無ければキャラ名一致のコダマ）
    const ids = D.kodama.filter(k => charKey(k.name) === ch).map(k => k.id);
    const lines = new Set(ids.map(id => P.LINE_OF[id]).filter(x => x != null));
    if (lines.size) return [...lines].map(l => P.LINES[l]);
    return ids.length ? [ids] : [];
  }
  function formFor(lineIds, lv, rand, strongest) {
    const base = lineIds.filter(id => P.isBase(KD[id]));
    const evo = lineIds.filter(id => !P.isBase(KD[id]));
    let list = lv >= P.EVOLVE_LV && evo.length ? evo : (base.length ? base : evo);
    if (strongest) list = list.slice().sort((a, b) => KD[b].total - KD[a].total).slice(0, 2);
    return list[Math.floor(rand() * list.length)];
  }

  function makeRng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const stageKey = (a, j) => `${a}-${j}`;

  /* ---------- ステージ生成 ---------- */
  function stage(a, j) {
    const A = AREAS[a];
    const rand = makeRng(9173 + a * 131 + j * 17);
    const isBoss = j === STAGES_PER_AREA - 1;
    const [lo, hi] = A.lv;
    const baseLv = Math.round(lo + (hi - lo) * j / (STAGES_PER_AREA - 1));
    const size = Math.max(1, Math.min(6, 1 + Math.floor(a * 0.6) + (j >= 2 ? 1 : 0) + (isBoss ? 1 : 0)));
    let lines = A.chars.flatMap(lineIdsForChar);
    let leaderChar = isBoss ? A.boss.char : A.chars[(j + a) % A.chars.length];
    if (!isBoss && leaderChar === A.boss.char) leaderChar = A.chars[(j + a + 1) % A.chars.length];
    const leaderLines = lineIdsForChar(leaderChar);
    if (leaderLines.length) lines = lines.filter(l => l !== leaderLines[0]);
    const party = [];
    const used = new Set();
    for (let i = 0; i < size; i++) {
      const last = i === size - 1;
      let line;
      if (last && leaderLines.length) line = leaderLines[0];
      else line = lines[Math.floor(rand() * lines.length)];
      let lv = Math.max(1, Math.min(100, baseLv + Math.floor(rand() * 3) - 1 + (last && isBoss ? 2 : 0)));
      let id = formFor(line, lv, rand, last && isBoss);
      let tries = 0;
      while (!last && used.has(id) && tries++ < 10) { line = lines[Math.floor(rand() * lines.length)]; id = formFor(line, lv, rand, false); }
      used.add(id);
      party.push({ id, lv, slv: P.slvFor(lv) });
    }
    party.reverse(); // リーダーを先頭に
    const trainer = isBoss ? A.boss.name : leaderChar;
    const pre = isBoss ? A.boss.pre : [['', GENERIC_PRE[(a + j) % GENERIC_PRE.length].replace('{c}', leaderChar)]];
    const post = isBoss ? A.boss.post : [['', GENERIC_POST[(a * 3 + j) % GENERIC_POST.length].replace('{c}', leaderChar)]];
    // 初回クリア報酬
    const reward = { money: Math.round((800 + 700 * a) * (1 + j * 0.3) * (isBoss ? 2 : 1) / 10) * 10, items: {}, contracts: [] };
    if (j === 1 || j === 3) reward.items.chibi = 1;
    if (j === 2) reward.items.scroll = 1;
    if (isBoss) {
      const bl = lineIdsForChar(A.boss.char)[0];
      if (bl) {
        const base = bl.find(id => P.isBase(KD[id])) || bl[0];
        reward.contracts.push({ id: base, lv: 5 });
      }
      if (a >= 4) reward.items.book = 1;
    }
    return {
      a, j, key: stageKey(a, j), isBoss, area: A, title: `${A.name} ${STAGE_NAMES[j]}`,
      trainer, party, pre, post, reward, ai: isBoss && A.ai === 'easy' ? 'normal' : A.ai,
      speaker: leaderChar,
    };
  }

  function charSprite(ch) {
    const lines = lineIdsForChar(ch);
    if (!lines.length) return null;
    const base = lines[0].find(id => P.isBase(KD[id])) || lines[0][0];
    return base;
  }

  function isUnlocked(save, a, j) {
    if (a === 0 && j === 0) return true;
    if (j > 0) return !!save.cleared[stageKey(a, j - 1)];
    return !!save.cleared[stageKey(a - 1, STAGES_PER_AREA - 1)];
  }
  function areaCleared(save, a) { return !!save.cleared[stageKey(a, STAGES_PER_AREA - 1)]; }
  function progressArea(save) {
    let n = 0;
    while (n < AREAS.length && areaCleared(save, n)) n++;
    return n; // クリア済みエリア数
  }

  global.GKS = { AREAS, STAGES_PER_AREA, stage, stageKey, isUnlocked, areaCleared, progressArea, charSprite, lineIdsForChar };
})(typeof window !== 'undefined' ? window : globalThis);
