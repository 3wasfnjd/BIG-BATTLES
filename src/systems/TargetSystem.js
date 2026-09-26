import { CONFIG, clamp } from '../core/Config.js';
const LANES = 9;
export class TargetSystem {
  constructor() { this.timer = 0; this.player = Array.from({ length: LANES }, () => []); this.enemy = Array.from({ length: LANES }, () => []); this.cursor = 0; }
  lane(x) { return clamp(Math.floor((x + 7) / 14 * LANES), 0, LANES - 1); }
  update(dt, players, enemies) {
    this.timer -= dt; if (this.timer > 0) return;
    this.timer = CONFIG.targetInterval;
    for (const bucket of [...this.player, ...this.enemy]) bucket.length = 0;
    for (const unit of players) if (unit.alive) this.player[this.lane(unit.x)].push(unit);
    for (const unit of enemies) if (unit.alive) this.enemy[this.lane(unit.x)].push(unit);
  }
  select(unit) {
    const buckets = unit.team === 'player' ? this.enemy : this.player;
    const lane = this.lane(unit.x);
    for (let radius = 0; radius < LANES; radius++) {
      for (const side of radius ? [-1, 1] : [1]) {
        const bucket = buckets[lane + radius * side];
        if (!bucket?.length) continue;
        const start = this.cursor++ % bucket.length;
        // Bounded probes: no all-against-all search, even in a large crowd.
        for (let probe = 0; probe < Math.min(4, bucket.length); probe++) {
          const target = bucket[(start + probe) % bucket.length];
          const dz = target.z - unit.z, dx = target.x - unit.x;
          if (target.alive && (unit.team === 'enemy' || dz > -1) && dx * dx + dz * dz <= unit.range * unit.range) return target;
        }
      }
    }
    return null;
  }
}
