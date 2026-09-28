import { CHARACTERS } from '../data/characters.js';

// Defence bosses. They share the APPROACH → ATTACK (wind-up) → COOLDOWN states that drive
// the baked attack animation, and each publishes a `tele` shape so the ground warning
// matches exactly what the strike will hit.
export const BOSS_TYPES = ['dragon', 'yeti', 'warlock', 'warElephant'];

export class BossSystem {
  constructor(sim) { this.sim = sim; }
  update(dt, unit) {
    const sim = this.sim, army = sim.army, def = CHARACTERS[unit.type];
    unit.hitTime = Math.max(0, unit.hitTime - dt);
    unit.timer -= dt;
    if (unit.aiState === 'APPROACH') {
      unit.state = 'walk'; unit.moving = true;
      const dx = army.center.x - unit.x;
      unit.x += Math.sign(dx) * Math.min(Math.abs(dx), unit.speed * 0.45 * dt);
      if (unit.z > def.range) unit.z -= unit.speed * dt;
      else if (unit.z < def.range - 0.5) unit.z += unit.speed * 1.4 * dt;
      else unit.moving = Math.abs(dx) > 0.05;
      if (unit.z <= def.range + 0.5 && unit.timer <= 0) this.windup(unit, def);
    } else if (unit.aiState === 'ATTACK') {
      unit.moving = false;
      if (unit.timer <= 0) this.strike(unit, def);
    } else if (unit.aiState === 'CHARGE') {
      // War elephant: thunder down the locked lane, trampling soldiers, then turn back.
      unit.moving = true; unit.z -= def.charge * dt;
      const width = def.width;
      unit.trampled = unit.trampled || 0;
      if (unit.trampled < def.limit) unit.trampled += sim.killSoldiers(s => Math.abs(s.x - unit.x) < width && Math.abs(s.z - unit.z) < 1.2, def.limit - unit.trampled);
      if (unit.z < -army.depth - 3) { unit.aiState = 'RETURN'; unit.tele = null; }
    } else if (unit.aiState === 'RETURN') {
      unit.moving = true; unit.z += unit.speed * 2.2 * dt;
      if (unit.z >= def.range) { unit.aiState = 'COOLDOWN'; unit.timer = def.cooldown * 0.5; }
    } else if (unit.aiState === 'COOLDOWN' && unit.timer <= 0) { unit.aiState = 'APPROACH'; unit.timer = 0.2; }
  }
  windup(unit, def) {
    const army = this.sim.army;
    unit.aiState = 'ATTACK'; unit.state = 'attack'; unit.timer = def.windup; unit.windupMax = def.windup; unit.moving = false; unit.attackCount = (unit.attackCount || 0) + 1;
    if (unit.type === 'dragon') unit.tele = { shape: 'strip', x: army.center.x, z0: unit.z - 1, z1: -army.depth - 0.5, width: def.width };
    else if (unit.type === 'warElephant') { unit.x = Math.max(-6, Math.min(6, army.center.x)); unit.tele = { shape: 'strip', x: unit.x, z0: unit.z - 1, z1: -army.depth - 2, width: def.width }; }
    else if (unit.type === 'yeti') unit.tele = { shape: 'ring', x: army.center.x, z: -Math.min(3, army.depth / 2), radius: def.width };
    else unit.tele = { shape: 'ring', x: unit.x, z: unit.z, radius: 2.2, color: 'summon' };
    this.sim.callbacks.onBossWindup?.(unit);
  }
  strike(unit, def) {
    const sim = this.sim, tele = unit.tele;
    unit.state = 'idle';
    if (unit.type === 'dragon') {
      sim.killSoldiers(s => Math.abs(s.x - tele.x) < tele.width, def.limit);
      sim.callbacks.onBreath?.(tele.x, unit.z);
    } else if (unit.type === 'yeti') {
      sim.killSoldiers(s => (s.x - tele.x) ** 2 + (s.z - tele.z) ** 2 < tele.radius ** 2, def.limit);
      sim.callbacks.onBoulder?.(unit, tele.x, tele.z);
    } else if (unit.type === 'warlock') {
      sim.spawnHorde({ count: def.summon + Math.min(10, unit.attackCount * 2), x: unit.x, width: 4, brutes: unit.attackCount % 3 === 0 ? 2 : 0 }, unit.z - 1.5);
      sim.callbacks.onSummon?.(unit.x, unit.z);
    }
    if (unit.type === 'warElephant') { unit.aiState = 'CHARGE'; unit.trampled = 0; sim.callbacks.onCharge?.(unit); return; }
    unit.tele = null; unit.aiState = 'COOLDOWN'; unit.timer = def.cooldown;
  }
}
