import { ObjectPool } from '../core/ObjectPool.js';
import { CONFIG } from '../core/Config.js';
export class ProjectileSystem {
  constructor(onHit) { this.pool = new ObjectPool(CONFIG.projectileCapacity, () => ({})); this.onHit = onHit; this.shots = 0; this.hits = 0; }
  fire(unit, target) {
    const bullet = this.pool.acquire(); if (!bullet) return false;
    Object.assign(bullet, { kind: null, splash: 0, fire: false, x: unit.x, z: unit.z, y: 0.7, tx: target.x, tz: target.z, target, team: unit.team, damage: unit.damage, speed: unit.projectileSpeed, life: 2 });
    target.incomingDamage += unit.damage; this.shots++;
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
        this.unreserve(bullet);
        if (bullet.target.alive) {
          this.hits++;
          const died = bullet.target.takeDamage(bullet.damage);
          this.onHit?.(bullet.target, died);
          if (bullet.splash) this.onSplash?.(bullet);
        }
        this.pool.releaseAt(i);
      } else if (bullet.life <= 0) { this.unreserve(bullet); this.pool.releaseAt(i); }
      else { bullet.x += dx / distance * step; bullet.z += dz / distance * step; }
    }
  }
  unreserve(bullet) { const left = bullet.target.incomingDamage - bullet.damage; bullet.target.incomingDamage = left > 1e-6 ? left : 0; }
  clear() { for (const bullet of this.pool.active) this.unreserve(bullet); this.pool.clear(); }
}
