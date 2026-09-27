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
      unit.state = 'walk'; unit.moving = true;
      if (distance > def.range - 0.5) { unit.x += dx / distance * unit.speed * dt; unit.z += dz / distance * unit.speed * dt; unit.aimAngle = Math.atan2(-dx, dz); }
      else { unit.aiState = 'ATTACK'; unit.state = 'attack'; unit.moving = false; unit.timer = def.windup; unit.telegraph = 1; }
    } else if (unit.aiState === 'ATTACK' && unit.timer <= 0) {
      const smash = unit.type === 'giantBoss' && unit.attackCount % 3 === 2;
      const radius = smash ? def.smashRadius : def.range;
      const damage = smash ? def.smashDamage : def.damage;
      const distanceSq = p => (p.x - unit.x) ** 2 + (p.z - unit.z) ** 2;
      const candidates = army.units.filter(p => p.alive && distanceSq(p) < radius * radius);
      candidates.sort((a, b) => distanceSq(a) - distanceSq(b));
      for (const target of candidates.slice(0, smash ? def.smashLimit : def.attackLimit)) this.onHit?.(target, target.takeDamage(damage));
      unit.attackCount++; unit.telegraph = 0; unit.aiState = 'COOLDOWN'; unit.timer = def.cooldown; unit.state = 'idle';
    } else if (unit.aiState === 'COOLDOWN' && unit.timer <= 0) unit.aiState = 'APPROACH';
  }
}
