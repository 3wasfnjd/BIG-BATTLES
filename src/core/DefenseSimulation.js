import { PlayerArmy } from '../entities/PlayerArmy.js';
import { CharacterEntity } from '../entities/CharacterEntity.js';
import { DesertBeast } from '../entities/DesertBeast.js';
import { GiantBoss } from '../entities/GiantBoss.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { TargetSystem } from '../systems/TargetSystem.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { CONFIG, clamp } from './Config.js';
import { CHARACTERS } from '../data/characters.js';
import { DEFENSE_STAGES, SPAWN_Z, PROP_SPEED, PACE } from '../data/defenseStages.js';
import { perksFor } from '../data/upgrades.js';

const HALF = CONFIG.corridorWidth / 2;
const PANEL_X = 3.6;
export const GATE_CHARGE = 20;
// Defence bows are shorter-ranged than the runner's: fights happen close to the line.
export const DEFENSE_RANGE = 17;
export const COIN_VALUE = { enemyGrunt: 1, enemyBrute: 4, desertBeast: 60, giantBoss: 150 };
const BREACH = { enemyGrunt: 1, enemyBrute: 3 };

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

const wrapRange = apply => unit => { apply(unit); unit.range = Math.min(unit.range, DEFENSE_RANGE); };

export class DefenseSimulation {
  constructor(callbacks = {}, stage = DEFENSE_STAGES[0], levels = {}) { this.callbacks = callbacks; this.reset(stage, levels); }
  reset(stage = this.data, levels = this.levels) {
    this.data = stage; this.levels = levels; this.perks = perksFor(levels);
    this.state = 'ready'; this.time = 0; this.kills = 0; this.coins = 0; this.eventIndex = 0; this.leaks = 0;
    this.army = new PlayerArmy(stage.initialArmy + this.perks.soldiers);
    this.army.upgrades.damage = this.perks.damage; this.army.upgrades.fireRate = this.perks.fireRate;
    this.army.applyWeapon = wrapRange(this.army.applyWeapon.bind(this.army));
    for (const unit of this.army.units) this.army.applyWeapon(unit);
    this.base = { hp: stage.baseHp + this.perks.fort, maxHp: stage.baseHp + this.perks.fort };
    this.peakArmy = this.army.count;
    this.enemies = []; this.gates = []; this.barrels = []; this.props = []; this.targetables = [];
    this.movement = new MovementSystem(); this.targets = new TargetSystem(); this.enemyAI = new EnemySystem((unit, died) => this.hit(unit, died));
    this.projectiles = new ProjectileSystem((unit, died) => this.hit(unit, died));
    this.combat = new CombatSystem(this.targets, this.projectiles);
    this.lastEventTime = Math.max(...stage.events.map(e => e.t)) * PACE.time;
  }
  get progress() { return Math.min(1, this.time / (this.lastEventTime + 8)); }
  get enemyCount() { return this.enemies.length; }
  start() { if (this.state === 'ready') this.state = 'playing'; }
  hit(unit, died) {
    if (died && unit.team === 'enemy' && !unit.isProp) { this.kills++; this.coins += COIN_VALUE[unit.type] || 0; }
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
    else {
      const giant = event.type === 'boss' ? new GiantBoss(SPAWN_Z + 2) : new DesertBeast(SPAWN_Z + 1);
      giant.x = event.x || 0; giant.speed *= PACE.speed; giant.maxHealth = giant.health = event.health || giant.health;
      this.enemies.push(giant);
    }
    this.callbacks.onSpawn?.(event);
  }
  spawnHorde(event) {
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
      unit.z = SPAWN_Z + row * 0.75 + ((i * 53) % 5) * 0.05;
      unit.walkSpeed = (type === 'enemyBrute' ? Math.min(speed, CHARACTERS.enemyBrute.speed + 0.3) : speed) * PACE.speed * (0.95 + ((i * 13) % 10) * 0.01);
      unit.state = 'run'; unit.moving = true; unit.aimAngle = Math.PI; unit.projectileSpeed = 0;
      unit.maxHealth = unit.health = type === 'enemyBrute' ? this.data.bruteHp : this.data.gruntHp;
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
    this.updateGates(dt); this.updateBarrels(dt); this.updateEnemies(dt);
    // Soldiers shoot enemies first; with nothing in range they shoot barrels and growing gates.
    this.targets.update(dt, army.units, this.enemies);
    this.shoot(dt);
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
      unit.state = unit.shotFlash > 0 ? 'shoot' : unit.moving ? 'run' : 'idle';
      if (unit.shotTimer > 0) continue;
      const target = this.targets.select(unit) || this.propTarget(unit);
      if (target && this.projectiles.fire(unit, target)) {
        unit.shotTimer = 1 / unit.fireRate; unit.shotFlash = 0.1; unit.state = 'shoot';
        unit.aimAngle = Math.atan2(unit.x - target.x, target.z - unit.z);
      } else unit.shotTimer = 0.08;
    }
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
    if (choice.type === 'army_add' && choice.value < 0) this.removeSoldiers(-choice.value);
    else this.army.upgrade(choice.type, choice.value);
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
      if (unit.aiState) { this.enemyAI.update(dt, { active: true, units: [unit] }, army); continue; }
      unit.hitTime = Math.max(0, unit.hitTime - dt);
      unit.z -= unit.walkSpeed * dt; unit.moving = true;
      // Close in on the army sideways a little: dodging never fully avoids a horde.
      if (unit.z < 16) { const dx = army.center.x - unit.x; unit.x += Math.sign(dx) * Math.min(Math.abs(dx), 0.45 * dt); }
      const inside = Math.abs(unit.x - army.center.x) <= army.halfWidth + unit.radius;
      if (inside && unit.z <= 0.35 + unit.radius) this.contact(unit);
      else if (unit.z < rear) {
        // Slipped past the army: it reaches the castle.
        unit.alive = false; this.leaks++;
        this.base.hp = Math.max(0, this.base.hp - (BREACH[unit.type] || 1));
        this.callbacks.onBreach?.(unit);
      }
    }
  }
  // Mob-control trade: a walker that reaches the line dies and takes soldiers with it.
  contact(enemy) {
    let trade = CHARACTERS[enemy.type].trade || 1;
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
    enemy.health = 0; enemy.alive = false; this.kills++; this.coins += COIN_VALUE[enemy.type] || 0;
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
