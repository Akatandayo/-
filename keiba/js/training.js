// 調教・休養・アイテム使用
'use strict';

const Training = {
  menus: {
    // 1年＝48週なので、1回あたりの伸びは控えめ
    speed: { label: 'スピード調教', icon: '⚡', gains: { speed: 2, power: 0.5 }, fatigue: 13, exp: 10 },
    stamina: { label: 'スタミナ調教', icon: '❤️', gains: { stamina: 2, guts: 0.5 }, fatigue: 13, exp: 10 },
    power: { label: 'パワー調教', icon: '💪', gains: { power: 2, speed: 0.5 }, fatigue: 13, exp: 10 },
    guts: { label: '根性調教', icon: '🔥', gains: { guts: 2, stamina: 0.5 }, fatigue: 11, exp: 10 },
    intelligence: { label: '賢さ調教', icon: '🧠', gains: { intelligence: 2, speed: 0.5 }, fatigue: 7, exp: 10 },
    light: { label: '軽め調教', icon: '🚶', gains: { speed: 0.5, stamina: 0.5, power: 0.5 }, fatigue: 3, condition: 4, exp: 6,
      desc: '少しだけ鍛える。疲れにくく調子をキープ。' },
    rest: { label: '休養', icon: '💤', gains: {}, fatigue: -45, condition: 12, exp: 0, desc: '疲労を大きく回復する。' }
  },

  // 路線ごとに重視する能力
  routeWeights: {
    sprint: { speed: 3, power: 2.5, guts: 1, stamina: 0.6, intelligence: 1 },
    mile: { speed: 3, stamina: 2, power: 1.5, guts: 1, intelligence: 1 },
    classic: { stamina: 2.5, speed: 2.5, power: 1.8, guts: 1.2, intelligence: 1 },
    filly: { speed: 2.8, stamina: 2.2, power: 1.5, guts: 1, intelligence: 1 },
    senior: { stamina: 3, speed: 2.2, guts: 1.8, power: 1.5, intelligence: 1 }
  },

  canTrain(h) {
    if (Horse.mustRetire(h)) return { ok: false, reason: '引退の時期です。' };
    if (Horse.acted(h)) return { ok: false, reason: '今週はもう行動しました。「次の週へ」で進めよう' };
    return { ok: true };
  },

  // 調教効果の倍率（成長タイプ・調子・疲労）
  efficiency(h) {
    const cond = 0.8 + 0.4 * h.condition / 100;
    const fat = h.fatigue >= 80 ? 0.35 : h.fatigue >= 60 ? 0.6 : h.fatigue >= 35 ? 0.85 : 1;
    return Horse.growthMult(h) * cond * fat;
  },

  // 確率的に丸める（小さな値でも成長の可能性を残す）
  roundRandom(v) {
    const f = Math.floor(v);
    return f + (Math.random() < v - f ? 1 : 0);
  },

  train(h, menuKey, itemMult = 1) {
    const menu = this.menus[menuKey];
    const eff = this.efficiency(h);
    const gains = {};
    Object.entries(menu.gains).forEach(([k, base]) => {
      const raw = base * eff * Util.rand(0.8, 1.2) * (k === menuKey ? itemMult : 1);
      const add = Math.min(this.roundRandom(raw), h.caps[k] - h.stats[k]);
      if (add > 0) { h.stats[k] += add; gains[k] = add; }
    });

    let conditionDelta = menu.condition || 0;
    if (menu.fatigue > 0 && h.fatigue >= 70) conditionDelta -= 10; // 疲れているのに追い込むと調子が落ちる
    h.fatigue = Util.clamp(h.fatigue + menu.fatigue, 0, 100);
    Horse.act(h);
    const birthday = false;
    h.condition = Util.clamp(h.condition + conditionDelta, 0, 100);
    const levelUps = Horse.addExp(h, menu.exp);
    Player.bump('trainCount');
    return { menu, gains, levelUps, birthday, capped: Object.keys(menu.gains).length > 0 && Object.keys(gains).length === 0 && eff > 0.5 };
  },

  // おまかせ調教：路線・次のレース・疲労から自動で決める
  autoPlan(h) {
    if (h.fatigue >= 60) return { menu: 'rest', reason: '疲れがたまっているので、休ませます。' };
    if (h.fatigue >= 40 || h.condition < 30) return { menu: 'light', reason: '疲れ気味なので、軽めに調整します。' };

    const route = h.route || Horse.recommendRoute(h);
    const target = Race.targetRace(h);
    const next = target ? target.race : null;
    let weights = Object.assign({}, this.routeWeights[route]);
    let lead = `目標は${Horse.routeInfo(route).name}路線です。`;
    if (target && target.weeks <= 1) {
      return { menu: 'light', reason: `「${next.name}」が${target.weeks === 0 ? '今週' : '来週'}です。レースに向けて軽めに調整します。` };
    }
    if (next) {
      const cat = Horse.distCat(next.distance);
      const catLabel = GAME_DATA.distances.find(d => d.key === cat).label;
      lead = `目標は${Calendar.label(next.week)}の「${next.name}」（${catLabel}・${next.distance}m・あと${target.weeks}週）。`;
      if (cat === 'sprint') { weights.speed += 1; weights.power += 0.5; }
      if (cat === 'long') { weights.stamina += 1.5; }
      if (cat === 'classic') { weights.stamina += 0.7; }
      if (next.surface === 'dirt') weights.power += 0.8;
    }
    // 伸びしろ（限界との差）× 重要度 が一番大きい能力を鍛える
    let best = null, bestScore = -1;
    STAT_KEYS.forEach(k => {
      const room = h.caps[k] - h.stats[k];
      const score = room > 0 ? weights[k] * (room + 3) : 0;
      if (score > bestScore) { bestScore = score; best = k; }
    });
    if (bestScore <= 0) return { menu: 'light', reason: `${lead} 能力が限界に近いので、軽めに調整します。` };
    const label = GAME_DATA.stats.find(s => s.key === best).label;
    return { menu: best, reason: `${lead} ${label}中心に調整します。` };
  },

  // 限界値アップの残り（1頭あたりの上限まで）
  capRoom(h) { return Math.max(0, GAME_DATA.capBoostMax - (h.capBoost || 0)); },

  // アイテム使用（使えないときは { error } を返す）
  useItem(h, itemId) {
    const item = Cards.get(itemId);
    if (!item || item.type !== 'item') return null;
    if (item.use.train && !this.canTrain(h).ok) return { error: this.canTrain(h).reason };
    if (item.use.allCaps && !item.use.allStats && this.capRoom(h) <= 0) return { error: `この馬の限界値はもう上げられません（1頭につき合計+${GAME_DATA.capBoostMax}まで）` };
    if (!Player.removeCard(itemId)) return null;
    const u = item.use;
    let result;
    if (u.train) {
      result = this.train(h, u.train, u.mult);
    } else {
      result = { gains: {}, levelUps: 0 };
      if (u.fatigue) h.fatigue = Util.clamp(h.fatigue + u.fatigue, 0, 100);
      if (u.condition) h.condition = Util.clamp(h.condition + u.condition, 0, 100);
      if (u.exp) result.levelUps = Horse.addExp(h, u.exp);
      if (u.allCaps) {
        const add = Math.min(u.allCaps, this.capRoom(h));
        h.capBoost = (h.capBoost || 0) + add;
        STAT_KEYS.forEach(k => { h.caps[k] += add; });
        result.capAdd = add;
      }
      if (u.allStats) STAT_KEYS.forEach(k => {
        const add = Math.min(u.allStats, h.caps[k] - h.stats[k]);
        if (add > 0) { h.stats[k] += add; result.gains[k] = add; }
      });
    }
    result.item = item;
    return result;
  }
};
