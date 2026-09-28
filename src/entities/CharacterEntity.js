import { CHARACTERS } from '../data/characters.js';
import { WEAPONS } from '../data/weapons.js';
let nextId = 1;
export class CharacterEntity {
  constructor(type, x = 0, z = 0) {
    this.id = nextId++;
    this.type = type;
    const definition = CHARACTERS[type];
    this.team = definition.team;
    this.maxHealth = this.health = definition.health;
    Object.assign(this, definition.weapon ? WEAPONS[definition.weapon] : { damage: definition.damage, fireRate: definition.fireRate, range: definition.range, projectileSpeed: 0, level: 1 });
    this.speed = definition.speed;
    this.radius = definition.radius;
    this.x = x; this.z = z; this.y = 0;
    this.formationSlot = { x: 0, z: 0 };
    this.state = 'idle'; this.alive = true;
    this.moving = false; this.shotFlash = 0; this.incomingDamage = 0;
    this.aimAngle = this.team === 'enemy' ? Math.PI : 0;
    this.shotTimer = (this.id % 17) / 17;
    this.hitTime = 0;
  }
  takeDamage(damage) {
    if (!this.alive) return false;
    // Treat float residue as dead: a 1e-15 HP unit could otherwise never be targeted.
    this.health = this.health - damage > 1e-6 ? this.health - damage : 0;
    this.hitTime = 0.12;
    if (this.health === 0) { this.alive = false; this.state = 'death'; return true; }
    return false;
  }
}
