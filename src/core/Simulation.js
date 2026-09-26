import { PlayerArmy } from '../entities/PlayerArmy.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { GateSystem } from '../systems/GateSystem.js';
import { StageSystem } from '../systems/StageSystem.js';
import { TargetSystem } from '../systems/TargetSystem.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { STAGE_1 } from '../data/stage1.js';
export class Simulation {
  constructor(callbacks = {}, data = STAGE_1) { this.callbacks = callbacks; this.data = data; this.reset(); }
  reset() {
    this.state = 'ready'; this.time = 0; this.kills = 0; this.peakArmy = this.data.initialArmy;
    this.army = new PlayerArmy(this.data.initialArmy); this.movement = new MovementSystem();
    this.stage = new StageSystem(this.data); this.gates = new GateSystem(this.data.sections, (...args) => this.callbacks.onGate?.(...args));
    this.targets = new TargetSystem();
    const hit = (unit, died) => { if (died && unit.team === 'enemy') this.kills++; this.callbacks.onHit?.(unit, died); };
    this.projectiles = new ProjectileSystem(hit); this.combat = new CombatSystem(this.targets, this.projectiles); this.enemies = new EnemySystem(hit);
  }
  start() { if (this.state === 'ready') this.state = 'playing'; }
  update(dt) {
    if (this.state !== 'playing') return;
    this.time += dt;
    this.stage.update(this.army);
    this.movement.update(this.army, dt, !this.stage.battling);
    this.gates.update(this.army);
    this.enemies.update(dt, this.stage.encounter, this.army);
    this.combat.update(dt, this.army.units, this.stage.battling ? this.stage.enemies : []);
    this.projectiles.update(dt);
    this.army.prune();
    this.peakArmy = Math.max(this.peakArmy, this.army.count);
    if (!this.army.count) this.finish('defeat');
    else if (this.stage.complete) this.finish('victory');
  }
  finish(state) { this.state = state; this.projectiles.clear(); this.callbacks.onFinish?.(state); }
}
