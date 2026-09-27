export class CombatSystem {
  constructor(targets, projectiles) { this.targets = targets; this.projectiles = projectiles; }
  update(dt, players, enemies) {
    this.targets.update(dt, players, enemies);
    this.shoot(dt, players); this.shoot(dt, enemies);
  }
  shoot(dt, units) {
    for (const unit of units) {
      if (!unit.alive || !unit.projectileSpeed) continue;
      unit.shotFlash = Math.max(0, unit.shotFlash - dt);
      unit.state = unit.shotFlash > 0 ? 'shoot' : unit.moving ? 'run' : 'idle';
      unit.shotTimer -= dt;
      if (unit.shotTimer > 0) continue;
      const target = this.targets.select(unit);
      if (target && this.projectiles.fire(unit, target)) {
        unit.shotTimer = 1 / unit.fireRate; unit.shotFlash = 0.1; unit.state = 'shoot';
        unit.aimAngle = Math.atan2(unit.x - target.x, target.z - unit.z);
      } else unit.shotTimer = 0.08;
    }
  }
}
