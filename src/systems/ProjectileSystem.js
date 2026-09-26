import { ObjectPool } from '../core/ObjectPool.js';
import { CONFIG } from '../core/Config.js';
export class ProjectileSystem {
  constructor(onHit) { this.pool = new ObjectPool(CONFIG.projectileCapacity, () => ({})); this.onHit = onHit; }
  fire(unit, target) {
    const bullet = this.pool.acquire(); if (!bullet) return false;
    Object.assign(bullet, { x: unit.x, z: unit.z, y: 0.7, tx: target.x, tz: target.z, target, team: unit.team, damage: unit.damage, speed: unit.projectileSpeed, life: 2 });
    return true;
  }
  update(dt) {
    for (let i = this.pool.active.length - 1; i >= 0; i--) {
      const bullet = this.pool.active[i]; bullet.life -= dt;
      // Tracers track only their assigned target; dead targets do not redirect.
      if (bullet.target.alive) { bullet.tx = bullet.target.x; bullet.tz = bullet.target.z; }
      const dx = bullet.tx - bullet.x, dz = bullet.tz - bullet.z;
      const distance = Math.hypot(dx, dz), step = bullet.speed * dt;
      if (distance <= step + bullet.target.radius) {
        if (bullet.target.alive) {
          const died = bullet.target.takeDamage(bullet.damage);
          this.onHit?.(bullet.target, died);
        }
        this.pool.releaseAt(i);
      } else if (bullet.life <= 0) this.pool.releaseAt(i);
      else { bullet.x += dx / distance * step; bullet.z += dz / distance * step; }
    }
  }
  clear() { this.pool.clear(); }
}
