export class CombatSystem {
  constructor(targets, projectiles) { this.targets = targets; this.projectiles = projectiles; }
  update(dt, players, enemies) {
    this.targets.update(dt, players, enemies);
    this.shoot(dt, players); this.shoot(dt, enemies);
  }
  shoot(dt, units) {
    for (const unit of units) {
      if (!unit.alive || !unit.projectileSpeed) continue;
      unit.shotTimer -= dt;
      if (unit.shotTimer > 0) continue;
      const target = this.targets.select(unit);
      if (target) { this.projectiles.fire(unit, target); unit.shotTimer = 1 / unit.fireRate; unit.state = 'shoot'; }
      else { unit.shotTimer = 0.08; unit.state = 'idle'; }
    }
  }
}
