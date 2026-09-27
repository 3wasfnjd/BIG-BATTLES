import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/core/Simulation.js';
import { PlayerArmy } from '../src/entities/PlayerArmy.js';
import { CharacterEntity } from '../src/entities/CharacterEntity.js';
import { CHARACTERS } from '../src/data/characters.js';
import { WEAPONS } from '../src/data/weapons.js';
import { InputSystem } from '../src/systems/InputSystem.js';
import { TargetSystem } from '../src/systems/TargetSystem.js';
import { ProjectileSystem } from '../src/systems/ProjectileSystem.js';
import { PerformanceManager } from '../src/core/PerformanceManager.js';

test('running state survives firing cooldown and no-target checks', () => {
  const sim = new Simulation(); sim.start();
  for (let i = 0; i < 60 * 2; i++) {
    sim.update(1 / 60);
    assert.ok(sim.army.units.every(u => u.state === 'run'), `a soldier stopped running at tick ${i}`);
  }
});
test('elite conversion updates all weapon properties, preserves wounds and inherits upgrades', () => {
  const army = new PlayerArmy(6), unit = army.units[1]; unit.takeDamage(10);
  army.upgrade('fire_rate', 1.35); army.upgrade('damage', 1.45); army.upgrade('weapon_upgrade', 1); army.upgrade('elite_upgrade', 1);
  assert.equal(unit.maxHealth, CHARACTERS.elite.health); assert.equal(unit.health, CHARACTERS.elite.health - 10);
  assert.equal(unit.range, WEAPONS.elite.range); assert.equal(unit.projectileSpeed, WEAPONS.elite.projectileSpeed);
  assert.equal(unit.radius, CHARACTERS.elite.radius); assert.equal(unit.fireRate, WEAPONS.elite.fireRate * 1.35);
  army.add(2); assert.equal(army.units.at(-1).damage, WEAPONS.recruit.damage * 1.45 * 1.3);
});
test('reserved projectiles spread targets, release reservations and preserve pool-miss evidence', () => {
  const shooter = new CharacterEntity('commander'), a = new CharacterEntity('enemyGrunt', 0, 5), b = new CharacterEntity('enemyGrunt', 0, 6);
  shooter.damage = 18; const targets = new TargetSystem(), bullets = new ProjectileSystem();
  targets.update(0, [shooter], [a, b]); const chosen = targets.select(shooter); bullets.fire(shooter, chosen);
  assert.notEqual(targets.select(shooter), chosen); assert.equal(chosen.incomingDamage, 18);
  bullets.clear(); assert.equal(chosen.incomingDamage, 0);
  for (let i = 0; i < bullets.pool.capacity + 3; i++) bullets.fire(shooter, a);
  assert.equal(bullets.pool.misses, 3); bullets.clear(); assert.equal(a.incomingDamage, 0); assert.equal(bullets.pool.misses, 3);
  targets.update(0.001, [shooter], []); assert.equal(targets.select(shooter), null);
});
test('front target is always probed when rear rows lie outside range', () => {
  const shooter = new CharacterEntity('recruit'), enemies = [new CharacterEntity('enemyGrunt', 0, 4)];
  for (let i = 0; i < 50; i++) enemies.push(new CharacterEntity('enemyGrunt', 0, 60 + i));
  const targets = new TargetSystem(); targets.update(0, [shooter], enemies);
  for (let i = 0; i < 100; i++) assert.equal(targets.select(shooter), enemies[0]);
});
test('gate growth and casualty pruning keep entity arrays and formation bounds stable', () => {
  const army = new PlayerArmy(6), units = army.units; army.center.x = army.limit;
  army.upgrade('army_multiply', 40); army.update(1 / 60, true);
  assert.equal(units, army.units); assert.equal(army.count, 240);
  for (const u of army.units) assert.ok(Math.abs(u.x) + u.radius <= 7.00001);
  const survivors = units.filter((_, i) => i % 2); for (let i = 0; i < units.length; i += 2) units[i].takeDamage(999);
  army.prune(); assert.equal(units, army.units); assert.deepEqual(units, survivors);
});
test('reversing a touch drag at the corridor edge has no dead zone and capture resets', () => {
  const handlers = new Map(); let target = 0, captured = false;
  const element = { addEventListener: (n, f) => handlers.set(n, f), getBoundingClientRect: () => ({ width: 400 }), setPointerCapture: () => { captured = true; }, hasPointerCapture: () => captured, releasePointerCapture: () => { captured = false; } };
  const input = new InputSystem(element, () => {}, x => target = Math.max(-2, Math.min(2, x)), () => target);
  const event = x => ({ isPrimary: true, pointerId: 1, pointerType: 'touch', clientX: x, target: { closest: () => null }, preventDefault() {} });
  handlers.get('pointerdown')(event(20)); handlers.get('pointermove')(event(390)); assert.equal(target, 2);
  handlers.get('pointermove')(event(380)); assert.ok(target < 2 && target > 1);
  input.reset(); assert.equal(captured, false);
});
test('real frame intervals are measured without hiding long stalls', () => {
  const ratios = [], performance = new PerformanceManager({ setPixelRatio: value => ratios.push(value) });
  for (let i = 0; i < 10; i++) performance.update(0.5);
  assert.equal(performance.fps, 2); assert.equal(performance.p95, 500); assert.ok(ratios.length > 1);
});
test('all 128 gate routes terminate, including losing routes, with no stage softlock', () => {
  let victories = 0, defeats = 0, longest = 0;
  for (let path = 0; path < 128; path++) {
    const sim = new Simulation(); sim.start();
    for (let tick = 0; tick < 60 * 180 && sim.state === 'playing'; tick++) {
      const next = sim.gates.gates.findIndex(g => !g.used);
      sim.army.targetX = path >> next & 1 ? 2 : -2; sim.update(1 / 60);
    }
    assert.ok(['victory', 'defeat'].includes(sim.state), `path ${path} stalled at ${sim.army.center.z}`);
    if (sim.state === 'victory') { victories++; assert.equal(sim.kills, 256); } else defeats++;
    assert.equal(sim.projectiles.pool.misses, 0); longest = Math.max(longest, sim.time);
  }
  assert.ok(victories > 0 && defeats > 0);
  console.log(JSON.stringify({ gateRoutes: 128, victories, defeats, longestSeconds: +longest.toFixed(1) }));
});
