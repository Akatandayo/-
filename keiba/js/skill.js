// スキル：装備と、レース中の自動発動判定
'use strict';

const Skills = {
  MAX_SLOTS: 3,
  STYLE_MISMATCH: 0.6, // 脚質が合わないスキルの効果倍率

  get(id) { const c = Cards.get(id); return c && c.type === 'skill' ? c : null; },

  // 優先順位：レアリティが高いほど先に判定
  priority(skill) { return Cards.rarityIndex(skill.rarity); },

  equip(h, skillId) {
    if (h.skills.length >= this.MAX_SLOTS) return { ok: false, reason: 'スキル枠がいっぱいです（最大3つ）。' };
    if (h.skills.includes(skillId)) return { ok: false, reason: '同じスキルは装備できません。' };
    if (!Player.removeCard(skillId)) return { ok: false, reason: 'スキルカードを持っていません。' };
    h.skills.push(skillId);
    Player.bump('equipCount');
    return { ok: true };
  },

  unequip(h, skillId) {
    const i = h.skills.indexOf(skillId);
    if (i < 0) return false;
    h.skills.splice(i, 1);
    Player.addCard(skillId);
    return true;
  },

  isMatch(skill, style) { return !skill.style || skill.style === style; },

  // レース中の状態 ctx がスキル条件を満たすか
  // ctx: { phase, remain, rank, distCat, ground, close }
  conditionMet(skill, ctx) {
    const c = skill.cond;
    if (c.phase && c.phase !== ctx.phase) return false;
    if (c.remainMax !== undefined && !(ctx.remain <= c.remainMax && ctx.remain > 0)) return false;
    if (c.rankMin !== undefined && ctx.rank < c.rankMin) return false;
    if (c.rankMax !== undefined && ctx.rank > c.rankMax) return false;
    if (c.distCat && c.distCat !== ctx.distCat) return false;
    if (c.groundMin !== undefined && ctx.ground < c.groundMin) return false;
    if (c.close && !ctx.close) return false;
    return true;
  },

  // 条件を満たしている間、毎秒この確率で発動判定（賢さで上がる）
  activationChance(intelligence) {
    return Util.clamp(0.18 + intelligence * 0.003, 0.18, 0.6);
  },

  // 効果（脚質が合わなければ弱くなる）
  effectFor(skill, style) {
    const m = this.isMatch(skill, style) ? 1 : this.STYLE_MISMATCH;
    return {
      speed: (skill.effect.speed || 0) * m,
      hp: (skill.effect.hp || 0) * m,
      duration: skill.effect.duration || 1
    };
  }
};
