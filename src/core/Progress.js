import { UPGRADES, upgradeCost } from '../data/upgrades.js';

// Coins, upgrade levels and unlocked stages, kept in this browser only.
const KEY = 'big-battles:defense:v1';
const fresh = () => ({ coins: 0, unlocked: 1, stage: 1, levels: Object.fromEntries(UPGRADES.map(u => [u.id, 0])), stars: {}, daily: '', streak: 0 });
// Stars: 3 when the castle keeps 80% of its hearts, 2 from 40%, otherwise 1.
export const starsFor = (hp, maxHp) => hp / maxHp >= 0.8 ? 3 : hp / maxHp >= 0.4 ? 2 : 1;
export const STAR_BONUS = 40;

export class Progress {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage; this.data = fresh();
    try {
      const saved = JSON.parse(storage?.getItem(KEY) || 'null');
      if (saved && typeof saved === 'object') {
        this.data.coins = Math.max(0, Math.floor(+saved.coins || 0));
        this.data.unlocked = Math.max(1, Math.floor(+saved.unlocked || 1));
        this.data.stage = Math.min(this.data.unlocked, Math.max(1, Math.floor(+saved.stage || 1)));
        for (const u of UPGRADES) this.data.levels[u.id] = Math.min(u.max, Math.max(0, Math.floor(+saved.levels?.[u.id] || 0)));
        for (const [id, n] of Object.entries(saved.stars || {})) this.data.stars[id] = Math.min(3, Math.max(0, Math.floor(+n || 0)));
        this.data.daily = typeof saved.daily === 'string' ? saved.daily : ''; this.data.streak = Math.max(0, Math.floor(+saved.streak || 0));
      }
    } catch { /* private mode or corrupt data: start fresh */ }
  }
  save() { try { this.storage?.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ } }
  get coins() { return this.data.coins; }
  get levels() { return this.data.levels; }
  cost(id) { const u = UPGRADES.find(x => x.id === id); return this.data.levels[id] >= u.max ? null : upgradeCost(u, this.data.levels[id]); }
  buy(id) {
    const cost = this.cost(id);
    if (cost === null || cost > this.data.coins) return false;
    this.data.coins -= cost; this.data.levels[id]++; this.save(); return true;
  }
  earn(coins) { this.data.coins += Math.max(0, Math.floor(coins)); this.save(); }
  // Returns the coin bonus for newly earned stars.
  complete(stageId, stageCount, stars = 1) {
    this.data.unlocked = Math.max(this.data.unlocked, Math.min(stageCount, stageId + 1));
    this.data.stage = Math.min(stageCount, stageId + 1);
    const before = this.data.stars[stageId] || 0, gained = Math.max(0, stars - before);
    this.data.stars[stageId] = Math.max(before, stars);
    const bonus = gained * STAR_BONUS * stageId; this.data.coins += bonus; this.save();
    return { gained, bonus };
  }
  stars(stageId) { return this.data.stars[stageId] || 0; }
  // Daily gift: once per calendar day; consecutive days raise it (up to 7).
  dailyReward(today) { const streak = this.nextStreak(today); return 80 + 40 * this.data.unlocked + 30 * (streak - 1); }
  nextStreak(today) {
    const yesterday = new Date(new Date(`${today}T12:00:00Z`).getTime() - 864e5).toISOString().slice(0, 10);
    return this.data.daily === yesterday ? Math.min(7, this.data.streak + 1) : 1;
  }
  dailyAvailable(today) { return this.data.daily !== today; }
  claimDaily(today) {
    if (!this.dailyAvailable(today)) return 0;
    const amount = this.dailyReward(today); this.data.streak = this.nextStreak(today); this.data.daily = today;
    this.data.coins += amount; this.save(); return amount;
  }
  select(stageId) { if (stageId >= 1 && stageId <= this.data.unlocked) { this.data.stage = stageId; this.save(); } }
}
