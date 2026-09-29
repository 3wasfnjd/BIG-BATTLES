import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DefenseSimulation, GATE_CHARGE, ENERGY_MAX, POWER_TIME, GIANTS_MAX, CANNONS_MAX } from '../src/core/DefenseSimulation.js';
import { Progress, starsFor } from '../src/core/Progress.js';
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

test('stages get harder: each needs more upgrades, and the last needs most of the tree', () => {
  const levels = [0, 1, 2, 3, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20];
  // First upgrade level (all four upgrades) at which the scripted player clears each stage.
  const firstWin = DEFENSE_STAGES.map(s => levels.find(level => play(s, all(level)).state === 'victory'));
  console.log(JSON.stringify(firstWin));
  assert.equal(DEFENSE_STAGES.length, 12);
  assert.ok(firstWin.every(level => level !== undefined), 'every stage is winnable with upgrades');
  for (let i = 1; i < firstWin.length; i++) assert.ok(firstWin[i - 1] <= firstWin[i], `required levels ${firstWin}`);
  assert.ok(firstWin[1] > 0 && firstWin[3] >= 5 && firstWin[6] >= 8 && firstWin[6] <= 10 && firstWin[11] >= 14, `required levels ${firstWin}`);
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
  assert.equal(again.coins, 300 - 80 + 40, 'first clear pays one star bonus'); assert.equal(again.levels.damage, 1); assert.equal(again.data.unlocked, 2); assert.equal(again.data.stage, 2);
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

test('every stage has its own visual theme', async () => {
  const { THEMES, STAGE_THEME } = await import('../src/rendering/StageThemes.js');
  assert.equal(new Set(STAGE_THEME.slice(0, DEFENSE_STAGES.length)).size, DEFENSE_STAGES.length);
  for (const name of STAGE_THEME) for (const key of ['sky', 'fog', 'hemi', 'sun', 'paving', 'ground', 'stone', 'fort', 'scatter']) assert.ok(THEMES[name][key] !== undefined, `${name}.${key}`);
});

test('power barrels: freeze slows walkers, shield blocks losses, lightning strikes, chests pay coins', () => {
  const walk = freeze => {
    const sim = new DefenseSimulation({}, stage([{ t: 0, type: 'horde', count: 1, x: 0 }], { gruntHp: 1e6 })); sim.start(); sim.update(1 / 60);
    if (freeze) sim.apply({ type: 'power', value: 'freeze' });
    const z = sim.enemies[0].z; run(sim, 2, 0); return z - sim.enemies[0].z;
  };
  assert.ok(walk(true) < walk(false) * 0.4);
  const shielded = new DefenseSimulation({}, stage([{ t: 0, type: 'horde', count: 3, x: 0, brutes: 3 }], { bruteHp: 1e6 }));
  shielded.start(); shielded.update(1 / 60); shielded.powers.shield = 1e3; run(shielded, 30, 0);
  assert.equal(shielded.army.count, 10); assert.equal(shielded.kills, 3);
  const zap = new DefenseSimulation({}, stage([{ t: 0, type: 'horde', count: 20, x: 0 }])); zap.start(); zap.update(1 / 60);
  zap.apply({ type: 'power', value: 'lightning' }); assert.equal(zap.kills, 14);
  const rich = new DefenseSimulation({}, stage([], { coinScale: 2 })); rich.apply({ type: 'coins', value: 50 }); assert.equal(rich.coins, 100);
  assert.equal(POWER_TIME.fire > 0, true);
});

test('arrow rain needs full energy, then hits everything in front after its flight', () => {
  const sim = new DefenseSimulation({}, stage([{ t: 0, type: 'horde', count: 30, x: 0, width: 10 }], { gruntHp: 1e3, bruteHp: 2000 }));
  sim.start(); sim.update(1 / 60);
  assert.equal(sim.useRain(), false);
  sim.energy = ENERGY_MAX; for (const u of sim.enemies) u.z = 12;
  assert.equal(sim.useRain(), true); assert.equal(sim.energy, 0);
  const before = sim.enemies.reduce((sum, u) => sum + u.health, 0);
  for (let i = 0; i < 40; i++) sim.update(1 / 60);
  assert.ok(sim.enemies.reduce((sum, u) => sum + u.health, 0) < before - 29 * 1000);
});

test('kill combos pay milestone bonuses; stars and daily gifts are saved', () => {
  const combos = [], sim = new DefenseSimulation({ onCombo: (n, bonus) => combos.push([n, bonus]) }, stage([]));
  for (let i = 0; i < 25; i++) sim.registerKill({ type: 'enemyGrunt' });
  assert.deepEqual(combos, [[10, 5], [25, 13]]);
  assert.equal(starsFor(10, 10), 3); assert.equal(starsFor(5, 10), 2); assert.equal(starsFor(1, 10), 1);
  const store = new Map(), storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const progress = new Progress(storage);
  assert.equal(progress.complete(2, 7, 2).bonus, 2 * 40 * 2);
  assert.equal(progress.complete(2, 7, 3).bonus, 40 * 2); assert.equal(progress.complete(2, 7, 1).bonus, 0);
  const first = progress.claimDaily('2026-09-28'); assert.ok(first > 0); assert.equal(progress.claimDaily('2026-09-28'), 0);
  const second = progress.claimDaily('2026-09-29'); assert.ok(second > first); assert.equal(progress.data.streak, 2);
  const again = new Progress(storage); assert.equal(again.stars(2), 3); assert.equal(again.dailyAvailable('2026-09-29'), false);
});

test('weapon rewards change damage, shots and splash for the whole army', async () => {
  const sim = new DefenseSimulation({}, stage([{ t: 0, type: 'horde', count: 40, x: 0, width: 6 }], { gruntHp: 1e5 }));
  sim.start(); sim.update(1 / 60);
  const base = sim.army.units[1].damage;
  sim.apply({ type: 'weapon', value: 'rifle' });
  assert.equal(sim.weapon, 'rifle'); assert.ok(Math.abs(sim.army.units[1].damage - base * 1.8) < 1e-9);
  sim.army.add(5); assert.ok(Math.abs(sim.army.units.at(-1).damage - base * 1.8) < 1e-9, 'new recruits get the weapon too');
  sim.apply({ type: 'weapon', value: 'triple' });
  for (const u of sim.enemies) u.z = 8;
  sim.targets.timer = 0; sim.targets.update(1, sim.army.units, sim.enemies);
  const shooter = sim.army.units[1]; shooter.shotTimer = 0;
  const before = sim.projectiles.pool.active.length; sim.shoot(1 / 60);
  assert.ok(sim.projectiles.pool.active.length - before >= 3 * 1, 'triple bow fires three arrows');
  sim.apply({ type: 'weapon', value: 'cannon' });
  const splashes = []; sim.callbacks.onSplash = (x, z, kind) => splashes.push(kind);
  const target = sim.enemies[0], hurt = () => sim.enemies.filter(u => u.health < u.maxHealth).length;
  const already = hurt();
  sim.splash({ tx: target.x, tz: target.z, target, damage: 100, share: 0.7, splash: 2.4, kind: 'cannon' });
  assert.ok(hurt() > already + 2); assert.deepEqual(splashes, ['cannon']);
  const { ChibiFactory } = await import('../src/rendering/ChibiFactory.js');
  const f = new ChibiFactory();
  for (const w of ['crossbow', 'triple', 'rifle', 'magic', 'cannon']) assert.ok(ChibiFactory.triangles(f.model('recruit', w)) < 1600, w);
  assert.notEqual(f.model('recruit', 'rifle'), f.model('recruit', 'magic'));
});

test('new bosses: dragon breath burns a lane, the yeti hits a circle, the warlock summons, the elephant charges', () => {
  const boss = (type, extra = {}) => {
    const sim = new DefenseSimulation({}, stage([{ t: 0, type, x: 0, health: 1e7 }], { initialArmy: 80, ...extra })); sim.start(); sim.update(1 / 60);
    const unit = sim.enemies[0]; assert.ok(unit.boss); return { sim, unit };
  };
  const dragon = boss('dragon'); run(dragon.sim, 20, 0);
  assert.ok(dragon.unit.attackCount >= 1 && dragon.sim.army.count < 80, 'dragon breath kills soldiers');
  assert.ok(dragon.unit.z > 10, 'the dragon keeps its distance');
  const yeti = boss('yeti'); run(yeti.sim, 20, 0); assert.ok(yeti.sim.army.count < 80);
  const warlock = boss('warlock'); run(warlock.sim, 20, 0);
  assert.ok(warlock.unit.attackCount >= 1 && warlock.sim.kills + warlock.sim.enemies.length > 1, 'warlock summons minions');
  const elephant = boss('warElephant'); let charged = false;
  for (let i = 0; i < 60 * 20 && elephant.sim.state === 'playing'; i++) { elephant.sim.update(1 / 60); if (elephant.unit.aiState === 'CHARGE') charged = true; }
  assert.ok(charged && elephant.sim.army.count < 80, 'elephant charges through the line');
  // The shield power blocks boss strikes.
  const safe = boss('dragon'); safe.sim.powers.shield = 1e3; run(safe.sim, 20, 0); assert.equal(safe.sim.army.count, 80);
});

test('giants and artillery abilities: charged by kills, then fight on the army\'s side', () => {
  const sim = new DefenseSimulation({}, stage([{ t: 0, type: 'horde', count: 60, x: 0, width: 8, brutes: 6 }], { gruntHp: 400, bruteHp: 900 }));
  sim.start(); sim.update(1 / 60);
  assert.equal(sim.useGiants(), false); assert.equal(sim.useCannons(), false);
  sim.giantEnergy = GIANTS_MAX; sim.cannonEnergy = CANNONS_MAX;
  assert.equal(sim.useGiants(), true); assert.equal(sim.allies.length, 2); assert.equal(sim.giantEnergy, 0);
  assert.equal(sim.useCannons(), true); assert.equal(sim.turrets.length, 2);
  const army = sim.army.count;
  run(sim, 14, 0);
  assert.ok(sim.kills >= 20, `abilities killed ${sim.kills}`);
  assert.ok(sim.army.count >= army - 5, 'giants shield the line');
  run(sim, 10, 0);
  assert.equal(sim.turrets.length, 0, 'artillery expires');
  for (let i = 0; i < 25; i++) sim.registerKill({ type: 'enemyBrute' });
  assert.ok(sim.giantEnergy > 0 && sim.cannonEnergy > 0);
});

test('arrows fly only while the player holds the screen', () => {
  const sim = new DefenseSimulation({}, stage([{ t: 0, type: 'horde', count: 20, x: 0 }], { gruntHp: 1e6 }));
  sim.start(); sim.update(1 / 60); for (const u of sim.enemies) u.z = 10;
  sim.holding = false; for (let i = 0; i < 60; i++) sim.update(1 / 60);
  assert.equal(sim.projectiles.shots, 0);
  sim.holding = true; for (let i = 0; i < 30; i++) sim.update(1 / 60);
  assert.ok(sim.projectiles.shots > 5, 'soldiers fire as soon as the player presses');
});
