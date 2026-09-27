import { CONFIG, clamp } from '../core/Config.js';
const LANES = 9;
export class TargetSystem {
  constructor() {
    this.timer = 0; this.player = Array.from({ length: LANES }, () => []); this.enemy = Array.from({ length: LANES }, () => []);
    this.cursor = 0; this.playerCount = -1; this.enemyCount = -1;
  }
  lane(x) { return clamp(Math.floor((x / CONFIG.corridorWidth + 0.5) * LANES), 0, LANES - 1); }
  update(dt, players, enemies) {
    this.timer -= dt;
    if (this.timer > 0 && players.length === this.playerCount && enemies.length === this.enemyCount) return;
    this.timer = CONFIG.targetInterval;
    this.playerCount = players.length; this.enemyCount = enemies.length;
    for (let i = 0; i < LANES; i++) { this.player[i].length = 0; this.enemy[i].length = 0; }
    for (const unit of players) if (unit.alive) this.player[this.lane(unit.x)].push(unit);
    for (const unit of enemies) if (unit.alive) this.enemy[this.lane(unit.x)].push(unit);
    // Keep each lane's front unit accessible even when rear rows are out of range.
    for (const bucket of this.player) bucket.sort((a, b) => b.z - a.z);
    for (const bucket of this.enemy) bucket.sort((a, b) => a.z - b.z);
  }
  select(unit) {
    const buckets = unit.team === 'player' ? this.enemy : this.player;
    const lane = this.lane(unit.x);
    for (let radius = 0; radius < LANES; radius++) {
      for (let side = 0; side < (radius ? 2 : 1); side++) {
        const bucket = buckets[lane + radius * (side ? 1 : -1)];
        if (!bucket?.length) continue;
        const start = this.cursor++ % bucket.length;
        // One front probe plus rotating candidates; never all-against-all.
        for (let probe = 0; probe <= Math.min(5, bucket.length); probe++) {
          const target = bucket[probe === 0 ? 0 : (start + probe - 1) % bucket.length];
          const dz = target.z - unit.z, dx = target.x - unit.x;
          if (target.alive && target.health > target.incomingDamage && (unit.team === 'enemy' || dz > -1) && dx * dx + dz * dz <= unit.range * unit.range) return target;
        }
      }
    }
    return null;
  }
}
