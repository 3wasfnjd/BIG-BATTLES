import { PlayerArmy } from '../entities/PlayerArmy.js';
import { CharacterEntity } from '../entities/CharacterEntity.js';
import { DesertBeast } from '../entities/DesertBeast.js';
import { GiantBoss } from '../entities/GiantBoss.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { TargetSystem } from '../systems/TargetSystem.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { BossSystem, BOSS_TYPES } from '../systems/BossSystem.js';
import { CONFIG, clamp } from './Config.js';
import { CHARACTERS } from '../data/characters.js';
import { DEFENSE_STAGES, SPAWN_Z, PROP_SPEED, PACE } from '../data/defenseStages.js';
import { perksFor } from '../data/upgrades.js';
import { WEAPON_KINDS } from '../data/weaponKinds.js';

const HALF = CONFIG.corridorWidth / 2;
const PANEL_X = 3.6;
export const GATE_CHARGE = 20;
// Defence bows are shorter-ranged than the runner's: fights happen close to the line.
export const DEFENSE_RANGE = 17;
export const COIN_VALUE = { enemyGrunt: 1, enemyBrute: 4, desertBeast: 60, giantBoss: 150, dragon: 250, yeti: 200, warlock: 180, warElephant: 220 };
const BREACH = { enemyGrunt: 1, enemyBrute: 3 };
// Arrow-rain energy per kill; the ability is ready at ENERGY_MAX.
export const ENERGY_MAX = 100;
const ENERGY = { enemyGrunt: 1, enemyBrute: 4, desertBeast: 25, giantBoss: 40, dragon: 40, yeti: 40, warlock: 40, warElephant: 40 };
export const POWER_TIME = { freeze: 5, fire: 8, shield: 7 };
// Summoned giants and the artillery battery charge more slowly than arrow rain.
export const GIANTS_MAX = 220, CANNONS_MAX = 160, GIANTS_TIME = 16, CANNONS_TIME = 12;
export const COMBO_STEPS = [10, 25, 50, 100, 150, 200, 300];

// Gate panels and barrels are shootable props that share the projectile/damage path.
class GatePanel {
  constructor(row, choice, side) {
    this.row = row; this.choice = { ...choice }; this.side = side; this.type = 'gate'; this.team = 'enemy'; this.isProp = true;
    this.x = side * PANEL_X; this.radius = 1.4; this.alive = true; this.health = this.maxHealth = 1e9; this.incomingDamage = 0; this.hitTime = 0;
    this.id = 0; this.hits = 0;
  }
  get z() { return this.row.z; }
  // Arrows charge a growing gate: every GATE_CHARGE damage raises it by one (negative gates climb too).
  takeDamage(damage) {
    this.hitTime = 0.12;
    if (this.choice.type !== 'army_add' || this.choice.grow === false) return false;
    this.charge = (this.charge || 0) + damage;
    while (this.charge >= GATE_CHARGE) { this.charge -= GATE_CHARGE; this.choice.value += 1; this.hits++; }
    return false;
  }
}
class Barrel {
  constructor(event) {
    this.type = 'barrel'; this.team = 'enemy'; this.isProp = true;
    this.x = event.x; this.z = SPAWN_Z; this.radius = 0.9; this.alive = true;
    this.health = this.maxHealth = event.hp; this.incomingDamage = 0; this.hitTime = 0; this.reward = event.reward; this.claimed = false; this.id = 0;
  }
  takeDamage(damage) {
    if (!this.alive) return false;
    this.hitTime = 0.12; this.health -= damage;
    if (this.health > 1e-6) return false;
    this.health = 0; this.alive = false; return true;
  }
}

// Defence range cap plus the army's current weapon kind.
const wrapRange = (apply, sim) => unit => {
  apply(unit); unit.range = Math.min(unit.range, DEFENSE_RANGE);
  const kind = WEAPON_KINDS[sim.weapon] || WEAPON_KINDS.crossbow;
  unit.damage *= kind.damage; unit.fireRate *= kind.rate; unit.projectileSpeed *= kind.speed;
};

export class DefenseSimulation {
  constructor(callbacks = {}, stage = DEFENSE_STAGES[0], levels = {}) { this.callbacks = callbacks; this.reset(stage, levels); }
  reset(stage = this.data, levels = this.levels) {
    this.data = stage; this.levels = levels; this.perks = perksFor(levels);
    this.state = 'ready'; this.time = 0; this.kills = 0; this.coins = 0; this.eventIndex = 0; this.leaks = 0;
    this.army = new PlayerArmy(stage.initialArmy + this.perks.soldiers);
    this.army.upgrades.damage = this.perks.damage; this.army.upgrades.fireRate = this.perks.fireRate;
    this.weapon = 'crossbow';
    this.army.applyWeapon = wrapRange(this.army.applyWeapon.bind(this.army), this);
    for (const unit of this.army.units) this.army.applyWeapon(unit);
    this.base = { hp: stage.baseHp + this.perks.fort, maxHp: stage.baseHp + this.perks.fort };
    this.peakArmy = this.army.count;
    // Soldiers fire continuously once the stage starts; `holding = false` pauses volleys.
    this.holding = true;
    this.energy = 0; this.giantEnergy = 0; this.cannonEnergy = 0; this.allies = []; this.turrets = []; this.rain = null; this.powers = { freeze: 0, fire: 0, shield: 0 }; this.combo = { count: 0, timer: 0, best: 0 };
    this.enemies = []; this.gates = []; this.barrels = []; this.props = []; this.targetables = []; this.archers = [];
    this.movement = new MovementSystem(); this.targets = new TargetSystem(); this.enemyAI = new EnemySystem((unit, died) => this.hit(unit, died)); this.bossAI = new BossSystem(this);
    this.projectiles = new ProjectileSystem((unit, died) => this.hit(unit, died)); this.projectiles.onSplash = bullet => this.splash(bullet);
    this.combat = new CombatSystem(this.targets, this.projectiles);
    this.lastEventTime = Math.max(...stage.events.map(e => e.t)) * PACE.time;
  }
  get progress() { return Math.min(1, this.time / (this.lastEventTime + 8)); }
  get enemyCount() { return this.enemies.length; }
  start() { if (this.state === 'ready') this.state = 'playing'; }
  coinValue(unit) { return Math.round((COIN_VALUE[unit.type] || 0) * (this.data.coinScale || 1)); }
  // Every enemy kill: coins, ability energy and the combo chain.
  registerKill(unit) {
    this.kills++; this.coins += this.coinValue(unit);
    const gain = ENERGY[unit.type] || 1;
    this.energy = Math.min(ENERGY_MAX, this.energy + gain);
    this.giantEnergy = Math.min(GIANTS_MAX, this.giantEnergy + gain); this.cannonEnergy = Math.min(CANNONS_MAX, this.cannonEnergy + gain);
    const combo = this.combo; combo.count++; combo.timer = 1.6; combo.best = Math.max(combo.best, combo.count);
    if (COMBO_STEPS.includes(combo.count)) {
      const bonus = Math.round(combo.count * 0.5 * (this.data.coinScale || 1));
      this.coins += bonus; this.callbacks.onCombo?.(combo.count, bonus);
    }
  }
  // Arrow rain: after a short flight, heavy damage to everything in front of the army.
  useRain() {
    if (this.state !== 'playing' || this.energy < ENERGY_MAX || this.rain) return false;
    this.energy = 0; this.rain = { x: this.army.center.x, timer: 0.55 };
    this.callbacks.onRain?.(this.rain.x); return true;
  }
  // Giants ability: two friendly giants step in front of the army and smash what comes.
  useGiants() {
    if (this.state !== 'playing' || this.giantEnergy < GIANTS_MAX) return false;
    this.giantEnergy = 0; const power = this.perks.abilities, cx = this.army.center.x;
    for (const side of [-1, 1]) {
      const ally = new CharacterEntity('allyGiant');
      Object.assign(ally, { ally: true, aiState: 'APPROACH', timer: 0.3, attackCount: 0, x: clamp(cx + side * 2.4, -5.6, 5.6), z: 1.2, aimAngle: 0, life: GIANTS_TIME * (1 + (power - 1) * 0.66) });
      ally.maxHealth = ally.health = 6000 * power;
      this.allies.push(ally);
    }
    this.callbacks.onGiants?.(this.allies); return true;
  }
  // Artillery ability: two cannons at the road edges shell the front of the horde.
  useCannons() {
    if (this.state !== 'playing' || this.cannonEnergy < CANNONS_MAX) return false;
    this.cannonEnergy = 0; const power = this.perks.abilities;
    this.turrets = [-1, 1].map(side => ({ x: side * 5.1, z: 2.2, timer: 0.3 + (side > 0 ? 0.2 : 0), life: CANNONS_TIME * (1 + (power - 1) * 0.66), recoil: 0 }));
    this.callbacks.onCannons?.(this.turrets); return true;
  }
  updateAllies(dt) {
    const power = this.perks.abilities;
    for (const ally of this.allies) {
      if (!ally.alive) continue;
      ally.life -= dt; ally.timer -= dt; ally.hitTime = Math.max(0, ally.hitTime - dt);
      if (ally.life <= 0 || ally.health <= 0) { ally.alive = false; ally.health = 0; this.callbacks.onHit?.(ally, true); continue; }
      // Head for the nearest threat in front, then hold near the line.
      let near = null, best = Infinity;
      for (const e of this.enemies) if (e.alive && e.z > ally.z - 1 && e.z < 18) { const d = Math.abs(e.x - ally.x) + (e.z - ally.z) * 0.5; if (d < best) { best = d; near = e; } }
      if (near) ally.x += Math.sign(near.x - ally.x) * Math.min(Math.abs(near.x - ally.x), ally.speed * dt);
      ally.x = clamp(ally.x, -6, 6);
      if (ally.z < 4.5) ally.z += ally.speed * 0.6 * dt;
      ally.moving = ally.aiState === 'APPROACH' && !!near;
      if (ally.aiState === 'APPROACH' && ally.timer <= 0 && near && Math.abs(near.x - ally.x) < 3 && near.z - ally.z < 4.5) { ally.aiState = 'ATTACK'; ally.timer = CHARACTERS.allyGiant.windup; ally.windupMax = ally.timer; }
      else if (ally.aiState === 'ATTACK' && ally.timer <= 0) {
        const sx = ally.x, sz = ally.z + 1.8;
        for (const e of this.enemies) if (e.alive && (e.x - sx) ** 2 + (e.z - sz) ** 2 < 9) this.strike(e, e.aiState ? e.maxHealth * 0.025 * power : this.data.bruteHp * 0.9 * power);
        this.callbacks.onSmash?.(sx, sz);
        ally.aiState = 'COOLDOWN'; ally.timer = CHARACTERS.allyGiant.cooldown;
      } else if (ally.aiState === 'COOLDOWN' && ally.timer <= 0) { ally.aiState = 'APPROACH'; ally.timer = 0; }
    }
    this.allies = this.allies.filter(a => a.alive);
  }
  updateTurrets(dt) {
    const power = this.perks.abilities;
    for (const turret of this.turrets) {
      turret.life -= dt; turret.timer -= dt; turret.recoil = Math.max(0, turret.recoil - dt * 4);
      if (turret.timer > 0 || turret.life <= 0) continue;
      let target = null;
      for (const e of this.enemies) if (e.alive && e.z < 28 && (!target || (e.aiState ? 0 : e.z) < (target.aiState ? 0 : target.z))) target = e;
      if (!target) { turret.timer = 0.15; continue; }
      const source = { x: turret.x, z: turret.z, team: 'player', damage: this.data.bruteHp * 0.45 * power, projectileSpeed: 26 };
      if (this.projectiles.fire(source, target)) {
        const shell = this.projectiles.pool.active[this.projectiles.pool.active.length - 1];
        Object.assign(shell, { kind: 'cannon', splash: 2.6, share: 0.7, startDist: Math.hypot(target.x - turret.x, target.z - turret.z) });
        turret.recoil = 1; this.callbacks.onTurretFire?.(turret);
      }
      turret.timer = 0.42;
    }
    this.turrets = this.turrets.filter(t => t.life > 0);
  }
  strike(unit, damage) { if (unit.alive) this.hit(unit, unit.takeDamage(damage)); }
  lightning() {
    const targets = this.enemies.filter(u => u.alive).sort((a, b) => (b.aiState ? 1e3 : b.type === 'enemyBrute' ? 50 : 0) - (a.aiState ? 1e3 : a.type === 'enemyBrute' ? 50 : 0) || a.z - b.z).slice(0, 14);
    this.callbacks.onLightning?.(targets.map(u => ({ x: u.x, z: u.z })));
    for (const unit of targets) this.strike(unit, unit.aiState ? unit.maxHealth * 0.08 : this.data.bruteHp * 1.2);
  }
  hit(unit, died) {
    if (died && unit.team === 'enemy' && !unit.isProp) this.registerKill(unit);
    this.callbacks.onHit?.(unit, died);
  }
  spawn(event) {
    if (event.type === 'gate') {
      const row = { z: SPAWN_Z, used: false, selected: -1, panels: [] };
      row.panels = event.choices.map((choice, i) => new GatePanel(row, choice, i ? 1 : -1));
      this.gates.push(row); this.props.push(...row.panels.filter(p => p.choice.type === 'army_add' && p.choice.grow !== false));
    } else if (event.type === 'barrel') {
      const barrel = new Barrel(event); this.barrels.push(barrel); this.props.push(barrel);
    } else if (event.type === 'horde') this.spawnHorde(event);
    else if (BOSS_TYPES.includes(event.type)) {
      const giant = new CharacterEntity(event.type);
      Object.assign(giant, { boss: true, aiState: 'APPROACH', timer: 0.5, attackCount: 0, telegraph: 0, tele: null, x: event.x || 0, z: SPAWN_Z + 2, aimAngle: Math.PI });
      giant.speed *= PACE.speed; giant.maxHealth = giant.health = event.health || giant.health;
      this.enemies.push(giant);
    } else {
      const giant = event.type === 'boss' ? new GiantBoss(SPAWN_Z + 2) : new DesertBeast(SPAWN_Z + 1);
      giant.x = event.x || 0; giant.speed *= PACE.speed; giant.maxHealth = giant.health = event.health || giant.health;
      this.enemies.push(giant);
    }
    this.callbacks.onSpawn?.(event);
  }
  spawnHorde(event, spawnZ = SPAWN_Z) {
    const room = CONFIG.maxEnemyUnits - this.enemies.length;
    const count = Math.min(event.count, room);
    const brutesAlive = this.enemies.filter(u => u.type === 'enemyBrute').length;
    const brutes = Math.min(event.brutes || 0, count, CONFIG.maxBrutes - brutesAlive);
    const width = event.width || 5.5, columns = Math.max(1, Math.min(Math.round(width / 0.72) + 1, Math.ceil(Math.sqrt(count * 1.6))));
    const speed = event.speed || this.data.gruntSpeed;
    for (let i = 0; i < count; i++) {
      // Brutes lead the pack.
      const type = i < brutes ? 'enemyBrute' : 'enemyGrunt';
      const unit = new CharacterEntity(type);
      const col = i % columns, row = Math.floor(i / columns);
      unit.x = clamp(event.x + (col - (columns - 1) / 2) * 0.72 + ((i * 37) % 7 - 3) * 0.03, -HALF + 0.4, HALF - 0.4);
      unit.z = spawnZ + row * 0.75 + ((i * 53) % 5) * 0.05;
      unit.walkSpeed = (type === 'enemyBrute' ? Math.min(speed, CHARACTERS.enemyBrute.speed + 0.3) : speed) * PACE.speed * (0.95 + ((i * 13) % 10) * 0.01);
      unit.state = 'run'; unit.moving = true; unit.aimAngle = Math.PI; unit.projectileSpeed = 0;
      unit.maxHealth = unit.health = type === 'enemyBrute' ? this.data.bruteHp : this.data.gruntHp;
      // Archers walk to a firing line and rain arrows on the army instead of charging.
      if (type === 'enemyGrunt' && i < brutes + (event.archers || 0)) {
        Object.assign(unit, { archer: true, projectileSpeed: 24, range: this.data.archerRange || 13, damage: this.data.archerDamage || 8, fireRate: 0.75, shotTimer: 0.5 + (i % 9) * 0.1 });
        unit.holdZ = unit.range - 1.5 + (i % 5) * 0.4;
      }
      this.enemies.push(unit);
    }
  }
  update(dt) {
    if (this.state !== 'playing') return;
    this.time += dt;
    while (this.eventIndex < this.data.events.length && this.data.events[this.eventIndex].t * PACE.time <= this.time) this.spawn(this.data.events[this.eventIndex++]);
    const army = this.army;
    this.movement.update(army, dt, false);
    // The line never advances: keep the front at z = 0.
    army.center.z = 0;
    for (const key in this.powers) this.powers[key] = Math.max(0, this.powers[key] - dt);
    if (this.combo.timer > 0 && (this.combo.timer -= dt) <= 0) this.combo.count = 0;
    if (this.rain && (this.rain.timer -= dt) <= 0) {
      const x = this.rain.x; this.rain = null;
      const power = this.perks.abilities;
      for (const unit of this.enemies) if (unit.alive && unit.z < 26 && Math.abs(unit.x - x) < 6.8) this.strike(unit, (unit.aiState ? unit.maxHealth * 0.06 : this.data.bruteHp * 0.7) * power);
      this.callbacks.onRainImpact?.(x);
    }
    const slow = this.powers.freeze > 0 ? 0.3 : 1;
    this.updateGates(dt); this.updateBarrels(dt); this.updateEnemies(dt * slow); this.updateAllies(dt); this.updateTurrets(dt);
    // Soldiers shoot enemies first; with nothing in range they shoot barrels and growing gates.
    this.targets.update(dt, army.units, this.enemies);
    this.shoot(dt);
    this.archers.length = 0;
    for (const unit of this.enemies) if (unit.archer && unit.alive) this.archers.push(unit);
    if (this.archers.length) this.combat.shoot(dt * slow, this.archers);
    this.projectiles.update(dt);
    for (const barrel of this.barrels) if (!barrel.alive && !barrel.claimed) this.claim(barrel);
    this.prune();
    army.prune();
    this.peakArmy = Math.max(this.peakArmy, army.count);
    if (!army.count || this.base.hp <= 0) this.finish('defeat');
    // Victory once every wave is spawned and beaten and no gate or barrel is still on its way.
    else if (this.eventIndex >= this.data.events.length && !this.enemies.length && this.gates.every(row => row.used) && !this.barrels.some(b => b.alive)) this.finish('victory');
  }
  shoot(dt) {
    for (const unit of this.army.units) {
      if (!unit.alive) continue;
      unit.shotFlash = Math.max(0, unit.shotFlash - dt);
      unit.shotTimer -= dt;
      if (!this.holding) { unit.shotTimer = Math.max(0, unit.shotTimer); unit.state = unit.shotFlash > 0 ? 'shoot' : unit.moving ? 'run' : 'idle'; continue; }
      unit.state = unit.shotFlash > 0 ? 'shoot' : unit.moving ? 'run' : 'idle';
      if (unit.shotTimer > 0) continue;
      const target = this.targets.select(unit) || this.propTarget(unit);
      if (target && this.fireAt(unit, target)) {
        // The triple bow looses two more arrows at other targets.
        for (let extra = 1; extra < (WEAPON_KINDS[this.weapon]?.shots || 1); extra++) { const next = this.targets.select(unit) || target; this.fireAt(unit, next); }
        unit.shotTimer = 1 / unit.fireRate; unit.shotFlash = 0.1; unit.state = 'shoot';
        unit.aimAngle = Math.atan2(unit.x - target.x, target.z - unit.z);
      } else unit.shotTimer = 0.08;
    }
  }
  fireAt(unit, target) {
    if (!this.projectiles.fire(unit, target)) return false;
    const bolt = this.projectiles.pool.active[this.projectiles.pool.active.length - 1], kind = WEAPON_KINDS[this.weapon];
    bolt.kind = this.weapon; bolt.splash = target.isProp ? 0 : kind.splash; bolt.share = kind.share;
    bolt.startDist = Math.hypot(target.x - unit.x, target.z - unit.z);
    // Fire arrows: double damage while the power lasts.
    if (this.powers.fire > 0) { bolt.damage *= 2; bolt.fire = true; }
    return true;
  }
  // Magic and cannon shots also hurt enemies around the impact point.
  splash(bullet) {
    let hits = 0;
    for (const unit of this.enemies) {
      if (hits >= 8) break;
      if (!unit.alive || unit === bullet.target || (unit.x - bullet.tx) ** 2 + (unit.z - bullet.tz) ** 2 > bullet.splash ** 2) continue;
      this.strike(unit, bullet.damage * bullet.share); hits++;
    }
    this.callbacks.onSplash?.(bullet.tx, bullet.tz, bullet.kind);
  }
  setWeapon(kind) {
    if (!WEAPON_KINDS[kind]) return;
    this.weapon = kind; for (const unit of this.army.units) this.army.applyWeapon(unit);
    this.callbacks.onWeapon?.(kind);
  }
  propTarget(unit) {
    let best = null, bestZ = Infinity;
    for (const prop of this.props) {
      if (!prop.alive || prop.z > unit.range + unit.z || prop.z < unit.z + 1) continue;
      const dx = Math.abs(prop.x - unit.x);
      if (dx > (prop.type === 'gate' ? 3.1 : 1.6)) continue;
      if (prop.type === 'barrel' && prop.health <= prop.incomingDamage) continue;
      if (prop.z < bestZ) { best = prop; bestZ = prop.z; }
    }
    return best;
  }
  updateGates(dt) {
    const army = this.army;
    for (const row of this.gates) {
      row.z -= PROP_SPEED * dt;
      if (row.used || row.z > 0.3) continue;
      row.used = true; row.selected = army.center.x < 0 ? 0 : 1;
      const choice = row.panels[row.selected].choice, before = army.count;
      for (const panel of row.panels) panel.alive = false;
      this.apply(choice);
      this.callbacks.onGate?.(row, choice, army.count - before);
    }
    this.gates = this.gates.filter(row => row.z > -6);
  }
  updateBarrels(dt) {
    for (const barrel of this.barrels) { barrel.z -= PROP_SPEED * dt; barrel.hitTime = Math.max(0, barrel.hitTime - dt); if (barrel.z < -1.5) barrel.alive = false, barrel.claimed = true; }
    for (const row of this.gates) for (const panel of row.panels) panel.hitTime = Math.max(0, panel.hitTime - dt);
    this.barrels = this.barrels.filter(b => b.z > -1.5 && !(b.claimed && !b.alive));
  }
  claim(barrel) { barrel.claimed = true; const before = this.army.count; this.apply(barrel.reward); this.callbacks.onBarrel?.(barrel, this.army.count - before); }
  apply(choice) {
    if (choice.type === 'weapon') this.setWeapon(choice.value);
    else if (choice.type === 'coins') this.coins += Math.round(choice.value * (this.data.coinScale || 1));
    else if (choice.type === 'power') { if (choice.value === 'lightning') this.lightning(); else this.powers[choice.value] = POWER_TIME[choice.value]; }
    else if (choice.type === 'army_add' && choice.value < 0) this.removeSoldiers(-choice.value);
    else this.army.upgrade(choice.type, choice.value);
  }
  // Boss strikes: kill up to `limit` soldiers matching `test` (the commander last). Shield blocks.
  killSoldiers(test, limit) {
    if (this.powers.shield > 0 || limit <= 0) return 0;
    const victims = this.army.units.filter(u => u.alive && test(u)).sort((a, b) => (a.type === 'commander') - (b.type === 'commander') || b.z - a.z).slice(0, limit);
    for (const unit of victims) { unit.health = 0; unit.alive = false; unit.state = 'death'; this.callbacks.onHit?.(unit, true); }
    return victims.length;
  }
  removeSoldiers(count) {
    // Losses come from the back rows; the commander is the last to fall.
    const units = this.army.units;
    for (let i = units.length - 1; i >= 0 && count > 0; i--) if (units[i].type !== 'commander') { units[i].alive = false; units[i].health = 0; count--; }
    this.army.prune();
  }
  updateEnemies(dt) {
    const army = this.army, rear = -army.depth - 1.2;
    for (const unit of this.enemies) {
      if (!unit.alive) continue;
      if (unit.aiState) { if (unit.boss) this.bossAI.update(dt, unit); else this.enemyAI.update(dt, { active: true, units: [unit] }, army); continue; }
      unit.hitTime = Math.max(0, unit.hitTime - dt);
      if (unit.archer && unit.z <= unit.holdZ) { unit.moving = false; continue; }
      unit.z -= unit.walkSpeed * dt; unit.moving = true;
      // Close in on the army sideways a little: dodging never fully avoids a horde.
      if (unit.z < 16) { const dx = army.center.x - unit.x; unit.x += Math.sign(dx) * Math.min(Math.abs(dx), 0.45 * dt); }
      // Summoned giants block walkers: the walker dies and the giant takes the blow.
      const wall = this.allies.find(a => a.alive && Math.abs(a.x - unit.x) < 1.5 && Math.abs(a.z - unit.z) < 1.3);
      if (wall) { wall.health -= unit.type === 'enemyBrute' ? 380 : 110; wall.hitTime = 0.12; unit.health = 0; unit.alive = false; this.registerKill(unit); this.callbacks.onClash?.(unit, 0); this.callbacks.onHit?.(unit, true); continue; }
      const inside = Math.abs(unit.x - army.center.x) <= army.halfWidth + unit.radius;
      if (inside && unit.z <= 0.35 + unit.radius) this.contact(unit);
      else if (unit.z < rear) {
        // Slipped past the army: it reaches the castle.
        unit.alive = false; this.leaks++;
        // The shield power keeps the castle safe.
        if (!this.powers.shield) this.base.hp = Math.max(0, this.base.hp - (BREACH[unit.type] || 1));
        this.callbacks.onBreach?.(unit);
      }
    }
  }
  // Mob-control trade: a walker that reaches the line dies and takes soldiers with it.
  contact(enemy) {
    // Under the shield power the line holds without losses.
    let trade = this.powers.shield > 0 ? 0 : CHARACTERS[enemy.type].trade || 1;
    while (trade-- > 0) {
      let best = null, bestD = Infinity;
      for (const unit of this.army.units) {
        if (!unit.alive) continue;
        const d = (unit.x - enemy.x) ** 2 + (unit.z - enemy.z) ** 2 * 0.5 + (unit.type === 'commander' ? 1e3 : 0);
        if (d < bestD) { bestD = d; best = unit; }
      }
      if (!best) break;
      best.health = 0; best.alive = false; best.state = 'death';
      this.callbacks.onHit?.(best, true);
    }
    enemy.health = 0; enemy.alive = false; this.registerKill(enemy);
    this.callbacks.onClash?.(enemy, CHARACTERS[enemy.type].trade || 1);
    this.callbacks.onHit?.(enemy, true);
  }
  prune() {
    let write = 0;
    for (const unit of this.enemies) if (unit.alive) this.enemies[write++] = unit;
    this.enemies.length = write;
    this.props = this.props.filter(p => p.alive);
  }
  finish(state) {
    this.state = state; this.projectiles.clear();
    if (state === 'victory') this.coins += this.data.clearBonus;
    for (const unit of this.army.units) { unit.state = 'idle'; unit.moving = false; unit.shotFlash = 0; }
    this.callbacks.onFinish?.(state);
  }
}
