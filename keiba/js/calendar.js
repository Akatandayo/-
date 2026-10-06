// ゲーム内カレンダー（全馬共通の日付）と、年明け（1月1週）の処理
'use strict';

const Calendar = {
  W: 48,

  get() {
    const p = Player.data;
    if (!p.calendar) p.calendar = { year: 1, week: GAME_DATA.startWeek };
    return p.calendar;
  },

  // 通算週（何年目・何週目を1つの数にしたもの）。行動済み判定に使う
  abs() { const c = this.get(); return c.year * this.W + c.week; },

  month(week) { return Math.floor(week / 4) + 1; },
  wom(week) { return (week % 4) + 1; },
  weekOf(m, w) { return (m - 1) * 4 + (w - 1); },
  label(week) { return `${this.month(week)}月${this.wom(week)}週`; },
  now() { const c = this.get(); return { year: c.year, week: c.week, month: this.month(c.week), wom: this.wom(c.week) }; },
  fullLabel() { const c = this.get(); return `${c.year}年目 ${this.label(c.week)}`; },

  // 今週から target 週まであと何週か（0〜47）
  until(targetWeek) { return (targetWeek - this.get().week + this.W) % this.W; },

  // 1週すすめる。年が明けたら true
  advance() {
    const c = this.get();
    c.week++;
    if (c.week >= this.W) {
      c.week = 0;
      c.year++;
      return true;
    }
    return false;
  }
};

// 年度表彰（JRA賞）。年明けに前年の成績から選ぶ
const Awards = {
  BONUS: 3000,
  BEST_BONUS: 10000,

  yearHistory(h, year) { return h.history.filter(x => x.year === year); },

  // 前年の成績まとめと受賞
  evaluate(year) {
    const horses = Player.data.horses;
    const awards = [];
    const g1Wins = h => this.yearHistory(h, year).filter(x => x.place === 1 && x.grade === 'g1');
    const give = (h, title, bonus) => {
      awards.push({ horse: h, title, bonus });
      h.titles = h.titles || [];
      h.titles.push(`${year}年目 ${title}`);
      Player.addMoney(bonus);
    };

    // 年度代表馬：その年GⅠを2勝以上した中で、GⅠ勝利数→賞金の多い馬
    const candidates = horses.filter(h => g1Wins(h).length >= 2)
      .sort((a, b) => g1Wins(b).length - g1Wins(a).length || this.prize(b, year) - this.prize(a, year));
    if (candidates.length) give(candidates[0], '年度代表馬', this.BEST_BONUS);

    horses.forEach(h => {
      const wins = g1Wins(h);
      if (!wins.length) return;
      const age = wins[0].age;
      const sex = h.gender === 'male' ? '牡馬' : '牝馬';
      if (age === 2) give(h, `最優秀2歳${sex}`, this.BONUS);
      else if (age === 3) give(h, `最優秀3歳${sex}`, this.BONUS);
      else give(h, `最優秀4歳以上${sex}`, this.BONUS);
      if (wins.some(x => x.distance <= 1400 && x.surface === 'turf')) give(h, '最優秀短距離馬', this.BONUS);
      if (wins.some(x => x.surface === 'dirt')) give(h, '最優秀ダートホース', this.BONUS);
    });

    const summary = { races: 0, wins: 0, g1Wins: 0, prize: 0 };
    horses.forEach(h => this.yearHistory(h, year).forEach(x => {
      summary.races++;
      if (x.place === 1) summary.wins++;
      if (x.place === 1 && x.grade === 'g1') summary.g1Wins++;
      summary.prize += x.prize || 0;
    }));
    return { year, awards, summary };
  },

  prize(h, year) { return this.yearHistory(h, year).reduce((s, x) => s + (x.prize || 0), 0); }
};
