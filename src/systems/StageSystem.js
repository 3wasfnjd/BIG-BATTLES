import { EnemyHorde } from '../entities/EnemyHorde.js';
import { DesertBeast } from '../entities/DesertBeast.js';
import { GiantBoss } from '../entities/GiantBoss.js';
const EMPTY = Object.freeze([]);
export class StageSystem {
  constructor(data) { this.data = data; this.events = data.sections.filter(s => s.type !== 'gate'); this.index = 0; this.encounter = null; this.cleared = []; this.complete = false; }
  get enemies() { return this.encounter?.units || EMPTY; }
  get battling() { return !!this.encounter?.active; }
  update(army) {
    if (this.encounter) {
      if (this.encounter.horde) { this.encounter.horde.prune(); this.encounter.units = this.encounter.horde.units; }
      else if (!this.encounter.units[0]?.alive) this.encounter.units.length = 0;
      if (this.encounter.units.length === 0) { this.cleared.push(this.encounter.data.type); this.encounter = null; this.index++; }
    }
    const next = this.events[this.index];
    if (!next) { if (army.center.z >= this.data.length) this.complete = true; return; }
    if (!this.encounter && army.center.z > next.z - 42) {
      const horde = next.type === 'enemyWave' ? new EnemyHorde(next.count, next.z) : null;
      this.encounter = { data: next, horde, units: horde ? horde.units : [next.type === 'beast' ? new DesertBeast(next.z) : new GiantBoss(next.z)], active: false };
    }
    if (this.encounter && army.center.z >= next.z - next.triggerDistance) { this.encounter.active = true; if (this.encounter.horde) this.encounter.horde.active = true; }
  }
}
