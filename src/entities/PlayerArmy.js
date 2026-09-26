import { CharacterEntity } from './CharacterEntity.js';
import { FormationSystem } from '../systems/FormationSystem.js';
import { CONFIG, clamp } from '../core/Config.js';
import { CHARACTERS } from '../data/characters.js';
import { WEAPONS } from '../data/weapons.js';
export class PlayerArmy {
  constructor(count) {
    this.units = []; this.center = { x: 0, z: 0 }; this.targetX = 0;
    this.formation = new FormationSystem();
    this.upgrades = { damage: 1, fireRate: 1, level: 1 };
    this.units.push(new CharacterEntity('commander'));
    this.add(count - 1); this.snap();
  }
  get count() { return this.units.length; }
  add(count) {
    const amount = Math.min(Math.max(0, Math.floor(count)), CONFIG.maxPlayerUnits - this.count);
    for (let i = 0; i < amount; i++) {
      const unit = new CharacterEntity('recruit', this.center.x, this.center.z - (this.depth || 1));
      this.applyWeapon(unit); this.units.push(unit);
    }
    this.reform(); return amount;
  }
  applyWeapon(unit) {
    const base = WEAPONS[CHARACTERS[unit.type].weapon];
    unit.damage = base.damage * this.upgrades.damage * (1 + (this.upgrades.level - 1) * 0.3);
    unit.fireRate = base.fireRate * this.upgrades.fireRate;
    unit.level = this.upgrades.level;
  }
  upgrade(type, value) {
    if (type === 'army_add') return this.add(value);
    if (type === 'army_multiply') return this.add(this.count * (value - 1));
    if (type === 'elite_upgrade') {
      const basic = this.units.filter(unit => unit.type === 'recruit');
      basic.slice(0, Math.ceil(basic.length * value)).forEach(unit => {
        unit.type = 'elite'; unit.health += CHARACTERS.elite.health - unit.maxHealth;
        unit.maxHealth = CHARACTERS.elite.health; this.applyWeapon(unit);
      });
      return;
    }
    if (type === 'weapon_upgrade') this.upgrades.level = Math.min(5, this.upgrades.level + value);
    if (type === 'fire_rate') this.upgrades.fireRate = Math.min(3, this.upgrades.fireRate * value);
    if (type === 'damage') this.upgrades.damage = Math.min(4, this.upgrades.damage * value);
    this.units.forEach(unit => this.applyWeapon(unit));
  }
  prune() {
    const before = this.count;
    this.units = this.units.filter(unit => unit.alive);
    if (this.count !== before) this.reform();
  }
  reform() { Object.assign(this, this.formation.layout(this.units)); this.targetX = clamp(this.targetX, -this.limit, this.limit); }
  get limit() { return Math.max(0, CONFIG.corridorWidth / 2 - this.halfWidth - 0.25); }
  snap() { for (const unit of this.units) { unit.x = this.center.x + unit.formationSlot.x; unit.z = this.center.z + unit.formationSlot.z; } }
  update(dt, moving) { this.formation.update(this.units, this.center, dt); for (const u of this.units) if (u.state !== 'shoot') u.state = moving ? 'run' : 'idle'; }
}
