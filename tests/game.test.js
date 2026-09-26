import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/core/Simulation.js';
import { CONFIG } from '../src/core/Config.js';
import { PlayerArmy } from '../src/entities/PlayerArmy.js';
import { GateSystem } from '../src/systems/GateSystem.js';
import { ProjectileSystem } from '../src/systems/ProjectileSystem.js';
import { CharacterEntity } from '../src/entities/CharacterEntity.js';
import { ObjectPool } from '../src/core/ObjectPool.js';

export function completeStage(strategy) {
  const sim = new Simulation(); sim.start();
  const route = [];
  for (let tick = 0; tick < 60 * 300 && sim.state === 'playing'; tick++) {
    const next = sim.gates.gates.find(g => !g.used);
    if (next) {
      const selected = strategy(next, sim.gates.gates.indexOf(next));
      sim.army.targetX = selected === 0 ? -2 : 2;
    }
    sim.update(1 / 60);
    if (tick % 60 === 0) assert.ok(Number.isFinite(sim.army.center.x));
  }
  for (const gate of sim.gates.gates) route.push(gate.choices[gate.selected]?.type);
  return { sim, route };
}

test('complete Stage 1 through boss on the growth route', () => {
  const { sim } = completeStage((gate, i) => [1, 1, 0, 1, 0, 1, 0, 0][i] ?? 0);
  assert.equal(sim.state, 'victory', `state=${sim.state}, z=${sim.army.center.z}, army=${sim.army.count}, enemies=${sim.stage.enemies.length}`);
  assert.equal(sim.stage.cleared.length, 5); assert.equal(sim.kills, 256);
  assert.ok(sim.peakArmy >= 200); assert.ok(sim.time < 180);
  assert.equal(sim.gates.gates.filter(g => g.used).length, 7);
  console.log(JSON.stringify({ route: 'growth', seconds: +sim.time.toFixed(1), peak: sim.peakArmy, survivors: sim.army.count, poolMisses: sim.projectiles.pool.misses }));
});
test('alternate gate path completes and applies fire-rate/damage upgrades', () => {
  const { sim } = completeStage(() => 1);
  assert.equal(sim.state, 'victory'); assert.ok(sim.army.upgrades.fireRate > 1); assert.ok(sim.army.upgrades.damage > 1);
  console.log(JSON.stringify({ route: 'right', seconds: +sim.time.toFixed(1), peak: sim.peakArmy, survivors: sim.army.count }));
});
test('formation supports 5–320 units inside corridor including after shrink', () => {
  for (const count of [5, 10, 20, 50, 100, 200, 320]) {
    const army = new PlayerArmy(count);
    for (const sign of [-1, 1]) for (const unit of army.units) assert.ok(Math.abs(sign * army.limit + unit.formationSlot.x) + unit.radius < 7);
    const leader = army.units.find(u => u.type === 'commander');
    assert.ok(leader.formationSlot.z < army.units.find(u => u.type === 'recruit').formationSlot.z);
    army.units[1].takeDamage(999); army.prune(); assert.equal(army.count, count - 1);
  }
});
test('one gate choice fires once and respects army cap', () => {
  const army = new PlayerArmy(5); const gates = new GateSystem([{ type: 'gate', z: 2, choices: [{ type: 'army_add', value: 5 }, { type: 'army_multiply', value: 3 }] }]);
  army.center.z = 3; army.center.x = -1; gates.update(army); gates.update(army); assert.equal(army.count, 10);
  army.upgrade('army_multiply', 100); assert.equal(army.count, CONFIG.maxPlayerUnits);
});
test('pool reuse, projectile damage and dead target do not double-kill', () => {
  const pool = new ObjectPool(2, () => ({})); const first = pool.acquire(); pool.acquire(); assert.equal(pool.acquire(), null); pool.releaseAt(0); assert.equal(pool.acquire(), first);
  let deaths = 0; const bullets = new ProjectileSystem((unit, died) => { if (died) deaths++; });
  const shooter = new CharacterEntity('commander'), target = new CharacterEntity('enemyGrunt', 0, 1);
  shooter.damage = 99; bullets.fire(shooter, target); bullets.fire(shooter, target); bullets.update(1); assert.equal(deaths, 1); assert.equal(bullets.pool.active.length, 0);
});
test('defeat, pause and replay fully reset state', () => {
  const sim = new Simulation(); sim.start(); sim.state = 'paused'; sim.update(5); assert.equal(sim.time, 0);
  sim.state = 'playing'; sim.army.units.forEach(u => u.takeDamage(999)); sim.update(1 / 60); assert.equal(sim.state, 'defeat');
  sim.reset(); assert.equal(sim.state, 'ready'); assert.equal(sim.army.count, 6); assert.equal(sim.stage.index, 0); assert.equal(sim.projectiles.pool.active.length, 0); assert.equal(sim.gates.gates.some(g => g.used), false);
});

test('primary touch drag, cancellation and mouse use the same input path', async () => {
  const { InputSystem } = await import('../src/systems/InputSystem.js');
  const handlers = new Map(); let starts = 0, moved = null, captured = null;
  const element = { addEventListener: (type, listener) => handlers.set(type, listener), getBoundingClientRect: () => ({ width: 390 }), setPointerCapture: id => { captured = id; } };
  const input = new InputSystem(element, () => starts++, x => { moved = x; }, () => 1);
  const event = overrides => ({ isPrimary: true, pointerId: 5, pointerType: 'touch', clientX: 100, button: 0, target: { closest: () => null }, preventDefault() {}, ...overrides });
  handlers.get('pointerdown')(event()); handlers.get('pointermove')(event({ clientX: 178 }));
  assert.equal(starts, 1); assert.equal(captured, 5); assert.ok(Math.abs(moved - 3.8) < 0.001);
  handlers.get('pointermove')(event({ pointerId: 7, clientX: 300 })); assert.ok(Math.abs(moved - 3.8) < 0.001);
  handlers.get('pointercancel')(event()); moved = null; handlers.get('pointermove')(event({ clientX: 250 })); assert.equal(moved, null);
  handlers.get('pointerdown')(event({ pointerType: 'mouse', button: 2 })); assert.equal(starts, 1);
  handlers.get('pointerdown')(event({ pointerType: 'mouse' })); assert.equal(starts, 2); input.reset(); assert.equal(input.pointerId, null);
});

test('boss telegraphs normal attacks and every third smash with bounded victims', async () => {
  const { GiantBoss } = await import('../src/entities/GiantBoss.js');
  const { EnemySystem } = await import('../src/systems/EnemySystem.js');
  const army = new PlayerArmy(30), boss = new GiantBoss(2.5);
  const encounter = { active: true, units: [boss] }; let hits = 0;
  const enemies = new EnemySystem(() => hits++);
  enemies.update(1 / 60, encounter, army); assert.equal(boss.aiState, 'ATTACK'); assert.equal(boss.telegraph, 1);
  for (let i = 0; i < 420; i++) enemies.update(1 / 60, encounter, army);
  assert.ok(boss.attackCount >= 3); assert.ok(hits > 0); assert.ok(hits <= boss.attackCount * 12);
});
