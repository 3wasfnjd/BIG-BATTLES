import { CHARACTERS } from '../data/characters.js';
export class EnemySystem {
  constructor(onHit) { this.onHit = onHit; }
  update(dt, encounter, army) {
    if (!encounter?.active) return;
    if (encounter.horde) { encounter.horde.update(dt, army); return; }
    const unit = encounter.units[0]; if (!unit?.alive) return;
    const def = CHARACTERS[unit.type];
    unit.hitTime = Math.max(0, unit.hitTime - dt);
    unit.timer -= dt;
    const dx = army.center.x - unit.x, dz = army.center.z - unit.z;
    const distance = Math.hypot(dx, dz);
    if (unit.aiState === 'APPROACH') {
      unit.state = 'run';
      if (distance > def.range - 0.5) { unit.x += dx / distance * unit.speed * dt; unit.z += dz / distance * unit.speed * dt; }
      else { unit.aiState = 'ATTACK'; unit.state = 'shoot'; unit.timer = def.windup; unit.telegraph = 1; }
    } else if (unit.aiState === 'ATTACK' && unit.timer <= 0) {
      const smash = unit.type === 'giantBoss' && unit.attackCount % 3 === 2;
      const radius = smash ? def.smashRadius : def.range;
      const damage = smash ? def.smashDamage : def.damage;
      const candidates = army.units.filter(p => p.alive && Math.hypot(p.x - unit.x, p.z - unit.z) < radius);
      candidates.sort((a, b) => Math.hypot(a.x - unit.x, a.z - unit.z) - Math.hypot(b.x - unit.x, b.z - unit.z));
      for (const target of candidates.slice(0, smash ? def.smashLimit : def.attackLimit)) this.onHit?.(target, target.takeDamage(damage));
      unit.attackCount++; unit.telegraph = 0; unit.aiState = 'COOLDOWN'; unit.timer = def.cooldown;
    } else if (unit.aiState === 'COOLDOWN' && unit.timer <= 0) unit.aiState = 'APPROACH';
  }
}
