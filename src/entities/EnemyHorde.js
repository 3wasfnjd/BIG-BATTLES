import { CharacterEntity } from './CharacterEntity.js';
import { FormationSystem } from '../systems/FormationSystem.js';
import { CONFIG } from '../core/Config.js';
export class EnemyHorde {
  constructor(count, z) {
    this.center = { x: 0, z }; this.active = false;
    this.units = Array.from({ length: Math.min(count, CONFIG.maxEnemyUnits) }, () => new CharacterEntity('enemyGrunt'));
    this.formation = new FormationSystem(); this.formation.layout(this.units, false);
    for (const unit of this.units) { unit.x = unit.formationSlot.x; unit.z = z - unit.formationSlot.z; }
  }
  update(dt, army) {
    if (!this.active) return;
    this.center.z = Math.max(army.center.z + 7.5, this.center.z - 1.7 * dt);
    this.center.x += (army.center.x * 0.4 - this.center.x) * Math.min(1, dt);
    this.formation.update(this.units, this.center, dt, false);
  }
  prune() {
    const count = this.units.length;
    this.units = this.units.filter(unit => unit.alive);
    if (count !== this.units.length) this.formation.layout(this.units, false);
  }
}
