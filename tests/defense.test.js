import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DefenseSimulation, GATE_CHARGE } from '../src/core/DefenseSimulation.js';
import { Progress } from '../src/core/Progress.js';
import { DEFENSE_STAGES, SPAWN_Z } from '../src/data/defenseStages.js';
import { play } from '../tools/balance-defense.mjs';
import { CharacterVisualFactory } from '../src/rendering/CharacterVisualFactory.js';
import { ChibiFactory } from '../src/rendering/ChibiFactory.js';
import { ARCADE_CHARACTERS } from '../src/rendering/VisualProfiles.js';

const all = level => ({ soldiers: level, damage: level, fireRate: level, fort: level });
const stage = (events, extra = {}) => ({ id: 9, name: 't', initialArmy: 10, baseHp: 5, clearBonus: 10, gruntSpeed: 3, gruntHp: 30, bruteHp: 150, events, ...extra });
const run = (sim, seconds, x = 0) => { for (let i = 0; i < seconds * 60 && sim.state === 'playing'; i++) { sim.army.targetX = x; sim.update(1 / 60); } };

test('the army holds its line: only sideways movement, the front stays at z = 0', () => {
  const sim = new DefenseSimulation({}, stage([{ t: 30, type: 'horde', count: 1, x: 0 }])); sim.start();
  run(sim, 3, 5);
  assert.equal(sim.army.center.z, 0);
  assert.ok(sim.army.center.x > 3);
  assert.ok(Math.max(...sim.army.units.map(u => u.z)) <= 0.05);
});

test('stages get harder: each needs more upgrades, and the last cannot be won early', () => {
  const results = DEFENSE_STAGES.map(s => [0, 1, 2, 3, 4, 6].map(level => play(s, all(level)).state === 'victory'));
  console.log(JSON.stringify(results));
  const firstWin = results.map(r => r.indexOf(true));
  assert.ok(firstWin.every(i => i >= 0), 'every stage is winnable with upgrades');
  assert.ok(firstWin[0] < firstWin[1] && firstWin[1] < firstWin[2], `required levels ${firstWin}`);
  assert.equal(results[0][0], false, 'stage 1 is not won by the scripted player without upgrades');
  assert.ok(firstWin[2] >= 3);
});

test('arrows charge growing gates; a negative gate costs soldiers but never the commander', () => {
  const sim = new DefenseSimulation({}, stage([{ t: 0, type: 'gate', choices: [{ type: 'army_add', value: -30, grow: true }, { type: 'army_add', value: 2, grow: true }] }]));
  sim.start(); sim.update(1 / 60);
  const panel = sim.gates[0].panels[1];
  for (let i = 0; i < 5; i++) panel.takeDamage(GATE_CHARGE);
  assert.equal(panel.choice.value, 7);
  run(sim, 12, -4);
  assert.equal(sim.gates.find(r => r.used)?.selected ?? 0, 0);
  assert.equal(sim.army.count, 1); assert.equal(sim.army.units[0].type, 'commander');
});

test('barrels pay out when shot open; walkers that slip past damage the castle', () => {
  const sim = new DefenseSimulation({}, stage([{ t: 0, type: 'barrel', x: 0, hp: 20, reward: { type: 'army_add', value: 12, grow: false } }]));
  sim.start(); run(sim, 9, 0);
  assert.equal(sim.army.count, 22);
  const leak = new DefenseSimulation({}, stage([{ t: 0, type: 'horde', count: 6, x: 6.4 }], { gruntHp: 1e6 }));
  leak.start(); run(leak, 25, -5);
  assert.equal(leak.base.hp, 0); assert.equal(leak.state, 'defeat'); assert.ok(leak.leaks >= 5);
});

test('walkers that reach the line trade themselves for soldiers; brutes take three', () => {
  const sim = new DefenseSimulation({}, stage([{ t: 0, type: 'horde', count: 1, x: 0, brutes: 1 }], { bruteHp: 1e6 }));
  sim.start(); run(sim, 25, 0);
  assert.equal(sim.army.count, 10 - 3); assert.equal(sim.kills, 1); assert.equal(sim.enemies.length, 0);
});

test('coins, upgrades and unlocked stages persist through storage', () => {
  const store = new Map(), storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const progress = new Progress(storage);
  assert.equal(progress.buy('damage'), false);
  progress.earn(300); assert.equal(progress.buy('damage'), true); assert.equal(progress.levels.damage, 1);
  progress.complete(1, 3);
  const again = new Progress(storage);
  assert.equal(again.coins, 300 - 80); assert.equal(again.levels.damage, 1); assert.equal(again.data.unlocked, 2); assert.equal(again.data.stage, 2);
  const broken = new Progress({ getItem: () => '{bad json', setItem() { throw new Error('full'); } });
  assert.equal(broken.coins, 0); broken.earn(5); assert.equal(broken.coins, 5);
});

test('brutes render in their own bounded instanced batch', () => {
  const scene = new THREE.Scene(), visuals = new CharacterVisualFactory(scene, { definitions: ARCADE_CHARACTERS, procedural: new ChibiFactory() });
  const sim = new DefenseSimulation({}, stage([{ t: 0, type: 'horde', count: 60, x: 0, brutes: 20 }]));
  sim.start(); sim.update(1 / 60);
  assert.equal(sim.enemies.length, 60); assert.ok(sim.enemies.every(u => u.z >= SPAWN_Z - 1));
  visuals.update(sim.army.units, sim.enemies, 0, 1 / 60);
  assert.equal(visuals.batches.get('enemyBrute').count, 20); assert.equal(visuals.batches.get('enemyGrunt').count, 40);
});
