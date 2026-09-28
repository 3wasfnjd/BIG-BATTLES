import { UPGRADES, upgradeCost } from '../data/upgrades.js';

// Coins, upgrade levels and unlocked stages, kept in this browser only.
const KEY = 'big-battles:defense:v1';
const fresh = () => ({ coins: 0, unlocked: 1, stage: 1, levels: Object.fromEntries(UPGRADES.map(u => [u.id, 0])) });

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
  complete(stageId, stageCount) {
    this.data.unlocked = Math.max(this.data.unlocked, Math.min(stageCount, stageId + 1));
    this.data.stage = Math.min(stageCount, stageId + 1); this.save();
  }
  select(stageId) { if (stageId >= 1 && stageId <= this.data.unlocked) { this.data.stage = stageId; this.save(); } }
}
