// ===== 峠 SPIRITS : courses / story / economy data =====
(function () {
  'use strict';
  const D = {};

  // ---- Themes (render look + road condition) ----
  D.THEMES = {
    night: { label: '夜', skyTop: 0x02030c, skyBot: 0x1a2147, fog: 0x0a0f22, fogNear: 30, fogFar: 330, hemi: [0x5868a8, 0x0c0c16, 0.55], dir: [0x9fb4ff, 0.35], lamps: true, stars: true, city: true, moon: true, wet: false },
    dusk: { label: '夕暮れ', skyTop: 0x241a4d, skyBot: 0xff8048, fog: 0x5a3e55, fogNear: 40, fogFar: 420, hemi: [0xffb08a, 0x2a1830, 0.75], dir: [0xffa060, 0.9], lamps: true, stars: false, city: true, moon: false, sun: true, wet: false },
    rain: { label: '雨・夜', skyTop: 0x05070d, skyBot: 0x1b2230, fog: 0x10151f, fogNear: 15, fogFar: 210, hemi: [0x5a6a88, 0x0a0a10, 0.5], dir: [0x8899bb, 0.25], lamps: true, stars: false, city: true, moon: false, wet: true, rain: true },
    fog: { label: '朝霧', skyTop: 0x8da2bd, skyBot: 0xdfe6ee, fog: 0xc9d2dc, fogNear: 8, fogFar: 150, hemi: [0xe8eef8, 0x4a5a48, 1.0], dir: [0xfff2dd, 0.6], lamps: false, stars: false, city: false, moon: false, wet: false },
  };

  // ---- Courses: S=straight(len m), L/R=turn(angle deg, radius m, [name]) ----
  D.COURSES = {
    kirizaka: {
      name: '霧坂峠', en: 'KIRIZAKA PASS', theme: 'night', drop: 140, desc: '初心者向けの夜の峠。2連ヘアピンが勝負所。',
      segs: [['S', 88], ['R', 55, 80], ['S', 88], ['L', 90, 40], ['S', 63], ['R', 40, 100], ['S', 75], ['L', 165, 24, '第1ヘアピン'], ['S', 138], ['R', 165, 24, '第2ヘアピン'], ['S', 100], ['L', 70, 45], ['R', 75, 45], ['S', 138], ['L', 95, 34], ['S', 75], ['R', 30, 140], ['S', 100], ['R', 150, 26, '霧坂ラストヘアピン'], ['S', 113], ['L', 65, 55], ['S', 163]],
    },
    momiji: {
      name: '紅葉坂', en: 'MOMIJI SLOPE', theme: 'dusk', drop: 160, desc: '夕暮れの紅葉ライン。連続S字のリズムが重要。',
      segs: [['S', 75], ['L', 45, 90], ['S', 75], ['R', 85, 36], ['L', 85, 36], ['S', 113], ['R', 120, 30], ['S', 88], ['L', 170, 22, '紅ヘアピン'], ['S', 125], ['R', 170, 22, '蓮ヘアピン'], ['S', 88], ['L', 60, 60], ['S', 63], ['L', 50, 70], ['S', 113], ['R', 100, 32], ['S', 50], ['L', 100, 32], ['S', 125], ['R', 75, 50], ['S', 150]],
    },
    ryujin: {
      name: '龍神スカイライン', en: 'RYUJIN SKYLINE', theme: 'rain', drop: 170, desc: '雨の高速ステージ。濡れた路面はグリップが低下する。',
      segs: [['S', 100], ['R', 30, 150], ['S', 88], ['L', 100, 38], ['S', 75], ['R', 95, 40], ['S', 125], ['L', 140, 28], ['S', 63], ['R', 60, 70], ['S', 75], ['R', 150, 23, '龍の顎'], ['S', 150], ['L', 160, 23, '龍の尾'], ['S', 75], ['L', 45, 90], ['R', 45, 90], ['S', 100], ['R', 110, 30], ['S', 75], ['L', 80, 45], ['S', 175]],
    },
    tengu: {
      name: '天狗峠', en: 'TENGU PASS', theme: 'fog', drop: 190, desc: '伝説の峠。霧の中の3連ヘアピンは「天狗の階段」と呼ばれる。',
      segs: [['S', 75], ['L', 70, 50], ['R', 70, 50], ['S', 100], ['L', 175, 21, '天狗の階段・壱'], ['S', 113], ['R', 175, 21, '天狗の階段・弐'], ['S', 113], ['L', 175, 21, '天狗の階段・参'], ['S', 113], ['R', 120, 30], ['S', 75], ['L', 40, 120], ['S', 100], ['L', 90, 35], ['R', 90, 35], ['S', 125], ['R', 150, 25], ['S', 75], ['L', 80, 45], ['S', 63], ['R', 60, 60], ['S', 188]],
    },
  };

  // ---- Characters ----
  D.CHARS = {
    me: { name: '{NAME}', color: '#4fd1ff', icon: '走' },
    gen: { name: '源さん', color: '#c9a36a', icon: '源', title: '黒川オート店主' },
    mina: { name: 'ミナ', color: '#ff7eb6', icon: 'ミ', title: 'メカニック' },
    kenta: { name: 'ケンタ', color: '#9ad94b', icon: 'ケ', title: '霧坂ミッドナイツ' },
    yoshio: { name: 'ヨシオ', color: '#78c2a4', icon: 'ヨ', title: '霧坂ミッドナイツ' },
    misaki: { name: 'ミサキ', color: '#f4a9ff', icon: '咲', title: '霧坂ミッドナイツ' },
    takuma: { name: '疾風のタクマ', color: '#3fa9ff', icon: '疾', title: '霧坂ミッドナイツ リーダー' },
    daichi: { name: 'ダイチ', color: '#ff9b5e', icon: '大', title: '紅蓮連合' },
    tetsu: { name: '鉄', color: '#c0c0c0', icon: '鉄', title: '紅蓮連合' },
    yuu: { name: 'ユウ', color: '#ffb2b2', icon: '悠', title: '紅蓮連合' },
    reika: { name: '紅のレイカ', color: '#ff3b5c', icon: '紅', title: '紅蓮連合 総長' },
    sho: { name: 'ショウ', color: '#6fa8ff', icon: '翔', title: '龍神ストーム' },
    kazuma: { name: 'カズマ', color: '#ffd84f', icon: '和', title: '龍神ストーム' },
    rin: { name: 'リン', color: '#a8f0ff', icon: '凛', title: '龍神ストーム' },
    gou: { name: '雷神のゴウ', color: '#9f7bff', icon: '豪', title: '龍神ストーム 頭' },
    kuroda: { name: '黒田', color: '#777', icon: '黒', title: '天狗会' },
    shiraishi: { name: '白石', color: '#eee', icon: '白', title: '天狗会' },
    akira: { name: 'アキラ', color: '#ff6a3d', icon: '晃', title: '天狗会' },
    oboro: { name: '朧', color: '#e8f3ff', icon: '朧', title: '天狗峠の白い亡霊' },
  };

  // ---- Story chapters. car: search string (make + model fragment) ----
  D.CHAPTERS = [
    {
      id: 'c1', title: '第一章　霧坂の夜', course: 'kirizaka', bg: 'night',
      nodes: [
        { id: 'c1s0', type: 'story', title: '黒川オート', script: [
          ['nar', '山あいの町・霧坂。夜になると峠から、甲高いエキゾーストとスキール音が降りてくる。'],
          ['gen', 'よう来たな、{NAME}。じいさんの形見の車、ちゃんと動くようにしといたぞ。'],
          ['mina', 'あたしがバラして組み直したんだからね！ ほら、ガレージのカード見て。'],
          ['me', '……これが、走り屋の世界か。'],
          ['gen', '峠はな、アクセル踏むだけじゃ勝てん。コーナーの「入り」と「出口」……タイミングが全てだ。'],
          ['mina', 'まずは練習走行！ 光るリングが重なった瞬間に画面を押して、出口のリングで離す。それだけ！'],
        ] },
        { id: 'c1r0', type: 'race', format: 'ta', title: '練習走行', target: 78, reward: { yen: 3000 }, tutorial: true,
          pre: [['gen', '目標タイムは1分18秒。焦らずにリングだけ見てりゃいい。']],
          post: [['gen', 'ほう……筋は悪くねぇ。'], ['mina', '今夜、峠に「霧坂ミッドナイツ」が集まるって。顔、出してみたら？']] },
        { id: 'c1r1', type: 'race', format: 'battle', title: 'VS ケンタ', rival: 'kenta', car: 'Suzuki Alto Works RS-Z', skill: 0.25, reward: { yen: 4000, rep: 10 },
          pre: [['kenta', '見ない顔だな。ここは俺たちの峠だぜ？ 軽だからってナメんなよ！']],
          post: [['kenta', 'う、うそだろ……新入りに負けた……'], ['nar', '霧坂に、新しい走り屋の噂が流れ始めた。']] },
        { id: 'c1r2', type: 'race', format: 'battle', title: 'VS ヨシオ', rival: 'yoshio', car: 'Nissan Sunny Turbo Leprix', skill: 0.35, reward: { yen: 5000, rep: 12 },
          pre: [['yoshio', 'ケンタをやったのはお前か。ターボの加速、見せてやるよ。']],
          post: [['yoshio', '直線じゃ勝ってたのに……コーナーの立ち上がりが全然違う。'], ['mina', '出口のリリース、上手くなってるよ！']] },
        { id: 'c1s1', type: 'story', title: 'ミナの差し入れ', script: [
          ['mina', 'はいこれ！ 町内会の福引で当てたカードパック。おじいちゃんには内緒ね。'],
          ['gen', '……聞こえとるぞ。まあいい、車を揃えるのも走り屋の仕事だ。'],
          ['nar', '【ブロンズパック ×1 を手に入れた】'],
        ], reward: { pack: 'bronze' } },
        { id: 'c1r3', type: 'race', format: 'chase', title: '後追いバトル VS ミサキ', rival: 'misaki', car: 'Mazda MX-5 20th Anniversary', skill: 0.45, reward: { yen: 6000, rep: 15 },
          pre: [['misaki', '次は「後追い」よ。私の後ろに張り付いて、ゴールで1秒以内なら君の勝ち。'], ['misaki', '離されたら……その時点で負け、ね？']],
          post: [['misaki', 'ふふ、最後までミラーから消えなかったね。タクマが君を待ってる。']] },
        { id: 'c1r4', type: 'race', format: 'battle', boss: true, title: 'BOSS 疾風のタクマ', rival: 'takuma', car: "Nissan Silvia K's (S13)", skill: 0.6, reward: { yen: 12000, rep: 40, pack: 'silver' },
          pre: [['takuma', 'お前が噂の新入りか。霧坂のラストヘアピン……あそこで俺を抜いた奴はいない。'], ['gen', '（シルビアのK\'s……ターボのS13か。コーナーで離されたら勝ち目はねぇぞ）'], ['takuma', '行くぜ。カウント、始めな。']],
          post: [['takuma', '……俺の負けだ。霧坂はお前の峠だ、{NAME}。'], ['takuma', 'だが、上には上がいる。隣の紅葉坂……「紅のレイカ」に会ってみろ。'], ['nar', '【第一章 クリア】 シルバーパックを手に入れた！']] },
      ],
    },
    {
      id: 'c2', title: '第二章　紅蓮の女王', course: 'momiji', bg: 'dusk',
      nodes: [
        { id: 'c2s0', type: 'story', title: '紅葉坂へ', script: [
          ['nar', '夕暮れの紅葉坂。真っ赤な葉が路面を染める、テクニカルなS字の峠。'],
          ['mina', 'ここは「紅蓮連合」の縄張り。リーダーのレイカはロータリー使いらしいよ。'],
          ['gen', 'S字は切り返しのリズムだ。離して、すぐ押す。迷ったら負けるぞ。'],
        ] },
        { id: 'c2r1', type: 'race', format: 'battle', title: 'VS ダイチ', rival: 'daichi', car: 'Honda Prelude VTEC', skill: 0.45, reward: { yen: 7000, rep: 15 },
          pre: [['daichi', '霧坂の王者だって？ VTECの咆哮、聞かせてやる！']],
          post: [['daichi', 'くっ……FFの限界か……']] },
        { id: 'c2r2', type: 'race', format: 'battle', title: 'VS 鉄', rival: 'tetsu', car: 'Nissan Laurel Club S Turbo (C35)', skill: 0.5, req: { maxRQ: 45 }, reward: { yen: 8000, rep: 18 },
          pre: [['tetsu', 'セダンで峠を攻めて何が悪い。……RQ45以下で来い。それが紅蓮のルールだ。']],
          post: [['tetsu', 'いい走りだ。総長も喜ぶだろう。']] },
        { id: 'c2r3', type: 'race', format: 'chase', title: '後追いバトル VS ユウ', rival: 'yuu', car: '180SX Type X', skill: 0.55, reward: { yen: 9000, rep: 20 },
          pre: [['yuu', 'ワンエイティの背中、追い続けられるかな？']],
          post: [['yuu', 'しつこいなぁ……でも、嫌いじゃないよ。']] },
        { id: 'c2s1', type: 'story', title: '紅のレイカ', script: [
          ['reika', 'あなたが{NAME}？ ……タクマが負けたって聞いて、正直信じられなかった。'],
          ['reika', 'このFCは父の形見。ロータリーの回転に、私は全部を賭けてるの。'],
          ['me', '……俺も、じいさんの形見で走ってる。'],
          ['reika', 'なら話は早いわ。日が落ちる前に、決着をつけましょう。'],
        ] },
        { id: 'c2r4', type: 'race', format: 'battle', boss: true, title: 'BOSS 紅のレイカ', rival: 'reika', car: 'Mazda RX-7 Turbo II (FC)', skill: 0.7, tune: [1, 1, 1], reward: { yen: 18000, rep: 50, pack: 'silver' },
          pre: [['reika', '紅葉坂の夕日は、勝者だけが見られるのよ。']],
          post: [['reika', '……完敗ね。あなたの走り、迷いがない。'], ['reika', '雨の龍神スカイライン。そこの「雷神のゴウ」は四駆で全てをねじ伏せる。気をつけて。'], ['nar', '【第二章 クリア】']] },
      ],
    },
    {
      id: 'c3', title: '第三章　雷雨の龍神', course: 'ryujin', bg: 'rain',
      nodes: [
        { id: 'c3s0', type: 'story', title: '雨の峠', script: [
          ['nar', '龍神スカイライン。この峠には、雨の夜にしか現れないチームがいる。'],
          ['mina', '濡れた路面はグリップが落ちるの。パフォーマンスタイヤの車がおすすめ！'],
          ['gen', '四駆は雨に強い。だがな、峠を制するのは結局ドライバーだ。'],
        ] },
        { id: 'c3r1', type: 'race', format: 'battle', title: 'VS ショウ', rival: 'sho', car: 'Stagea 25t RS Four V', skill: 0.55, reward: { yen: 10000, rep: 20 },
          pre: [['sho', 'ステージアを舐めるな。RB25DETとアテーサの組み合わせだ。']],
          post: [['sho', '雨でも滑らせて、しかも速い……！？']] },
        { id: 'c3r2', type: 'race', format: 'battle', title: 'VS カズマ (FR限定)', rival: 'kazuma', car: 'Honda S2000 1999', skill: 0.6, req: { drive: 'rwd' }, reward: { yen: 11000, rep: 22 },
          pre: [['kazuma', '雨のFR対決だ。後輪駆動で来いよ。逃げは許さねぇ。']],
          post: [['kazuma', '雨の中でFRをあそこまで振り回すとはな……']] },
        { id: 'c3r3', type: 'race', format: 'chase', title: '後追いバトル VS リン', rival: 'rin', car: 'Honda Integra Type R 1995', skill: 0.65, reward: { yen: 12000, rep: 25, pack: 'silver' },
          pre: [['rin', 'インテRのライン取り、真似できる？']],
          post: [['rin', 'ゴウ兄が待ってる。……負けないでね、とは言わないけど。']] },
        { id: 'c3r4', type: 'race', format: 'battle', boss: true, title: 'BOSS 雷神のゴウ', rival: 'gou', car: 'Nissan Skyline GT-R (R32)', skill: 0.75, tune: [1, 1, 1], reward: { yen: 25000, rep: 70, pack: 'gold' },
          pre: [['gou', '雨の龍神で俺に勝てる奴はいない。RB26とアテーサE-TS……ゴジラの咆哮を聞け。'], ['gen', '（R32 GT-R……！ 直線じゃ勝てん。コーナー全部パーフェクトで行け）']],
          post: [['gou', '……雷が、止んだな。'], ['gou', '天狗峠に「白い亡霊」が出る。霧の朝にだけ現れる、正体不明の白いGT-Rだ。'], ['gen', '…………朧、か。'], ['nar', '【第三章 クリア】 ゴールドパックを手に入れた！']] },
      ],
    },
    {
      id: 'c4', title: '最終章　天狗峠の亡霊', course: 'tengu', bg: 'fog',
      nodes: [
        { id: 'c4s0', type: 'story', title: '源さんの過去', script: [
          ['gen', '……30年前、ワシは「霧坂の鬼」と呼ばれとった。ハコスカでな。'],
          ['gen', 'そのワシが唯一勝てなかった男が、朧だ。天狗峠の3連ヘアピン……「天狗の階段」で、な。'],
          ['mina', 'おじいちゃん……'],
          ['gen', '{NAME}。お前なら、あの階段を降りきれるかもしれん。'],
        ] },
        { id: 'c4r1', type: 'race', format: 'battle', title: 'VS 黒田', rival: 'kuroda', car: 'Mazda RX-7 Type RS', skill: 0.65, reward: { yen: 14000, rep: 25 },
          pre: [['kuroda', '天狗会の門番、黒田だ。FDの13B、伊達じゃないぞ。']],
          post: [['kuroda', '……通れ。']] },
        { id: 'c4r2', type: 'race', format: 'battle', title: 'VS 白石', rival: 'shiraishi', car: 'Honda NSX 1990', skill: 0.7, reward: { yen: 16000, rep: 28 },
          pre: [['shiraishi', 'ミッドシップの旋回性能、霧の中で見切れるか？']],
          post: [['shiraishi', '見事だ。君なら朧に届くかもしれない。']] },
        { id: 'c4r3', type: 'race', format: 'chase', title: '後追いバトル VS アキラ', rival: 'akira', car: 'Silvia Nismo 270R', skill: 0.75, reward: { yen: 18000, rep: 30, pack: 'gold' },
          pre: [['akira', 'ニスモの270R、限定30台の怪物だ。ついて来られるもんなら来てみな！']],
          post: [['akira', 'ははっ……最高のバトルだった！']] },
        { id: 'c4s1', type: 'story', title: '白い亡霊', script: [
          ['nar', '夜明け前。濃い霧の向こうから、白いR34が音もなく現れた。'],
          ['oboro', '…………源の孫か。'],
          ['oboro', 'あの男は階段の途中でアクセルを緩めた。恐れたのだ。お前はどうだ。'],
          ['me', '……俺は、緩めない。'],
          ['oboro', 'ならば降りてこい。霧の底まで。'],
        ] },
        { id: 'c4r4', type: 'race', format: 'battle', boss: true, title: 'FINAL 白い亡霊・朧', rival: 'oboro', car: 'Nissan Skyline GT-R (R34) 1999', skill: 0.85, tune: [1, 1, 1], reward: { yen: 50000, rep: 150, pack: 'platinum', card: 'Skyline Hardtop 2000 GT-R (C10)' },
          pre: [['gen', '{NAME}……頼んだぞ。'], ['oboro', '始めよう。']],
          post: [['oboro', '……見事だ。階段を、最後まで踏み切ったか。'], ['oboro', '源に伝えろ。「30年越しの勝負、孫に負けた」とな。'], ['gen', 'へっ……あの野郎。'], ['gen', '{NAME}、受け取れ。ワシのハコスカだ。お前に託す。'], ['nar', '【最終章 クリア】 伝説のカード「ハコスカ GT-R」を手に入れた！'], ['nar', '― 峠 SPIRITS 第一部 完 ― 　フリーバトルとオンライン対戦は引き続き楽しめます！']] },
      ],
    },
  ];

  // starter choices
  D.STARTERS = ["Nissan Silvia Q's (S13)", 'Mazda RX-7 1985', 'Honda Civic CRX Si'];

  // ---- Card packs ----
  D.PACKS = {
    bronze: { name: 'ブロンズパック', price: 5000, n: 3, color: '#cd7f32', odds: { F: 40, E: 40, D: 18, C: 2 } },
    silver: { name: 'シルバーパック', price: 15000, n: 3, color: '#c0c7d0', odds: { E: 35, D: 40, C: 20, B: 5 } },
    gold: { name: 'ゴールドパック', price: 40000, n: 3, color: '#ffcc33', odds: { D: 25, C: 40, B: 28, A: 7 } },
    platinum: { name: 'プラチナパック', price: 100000, n: 3, color: '#b9f2ff', odds: { C: 20, B: 45, A: 28, S: 7 } },
  };

  D.GRADE_COLORS = { F: '#8c949c', E: '#4caf50', D: '#2f8cf0', C: '#e6b800', B: '#ff8a1f', A: '#e8343a', S: '#a24ee8' };
  D.TUNE_NAMES = [['エンジン', '最高速・加速'], ['軽量化', '加速・ブレーキ'], ['足回り', 'グリップ']];

  window.TOUGE_DATA = D;
})();
