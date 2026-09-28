import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ChibiFactory } from '../src/rendering/ChibiFactory.js';
import { CharacterVisualFactory } from '../src/rendering/CharacterVisualFactory.js';
import { arcadeCameraPose, ARCADE_FOV } from '../src/rendering/ArcadeCameraRig.js';
import { ARCADE_CHARACTERS } from '../src/rendering/VisualProfiles.js';
import { PlayerArmy } from '../src/entities/PlayerArmy.js';
import { EnemyHorde } from '../src/entities/EnemyHorde.js';
import { GiantBoss } from '../src/entities/GiantBoss.js';
import { CONFIG } from '../src/core/Config.js';

test('procedural chibi models bake every clip within mobile triangle budgets', () => {
  const factory = new ChibiFactory();
  for (const type of ['recruit', 'elite', 'enemyGrunt', 'commander']) {
    const model = factory.model(type);
    assert.deepEqual(Object.keys(model.clips).sort(), ['death', 'hit', 'idle', 'run', 'shoot']);
    const budget = type === 'commander' ? 3000 : 1400;
    assert.ok(ChibiFactory.triangles(model) <= budget, `${type} ${ChibiFactory.triangles(model)}`);
    for (const clip of Object.values(model.clips)) for (const index of clip.frames) assert.ok(model.frames[index].parts[0].geometry.attributes.color);
  }
  for (const type of ['desertBeast', 'giantBoss']) {
    const model = factory.model(type);
    assert.ok(model.clips.attack && model.clips.run && model.clips.death);
    assert.ok(ChibiFactory.triangles(model) <= 3500);
  }
  assert.equal(factory.model('recruit'), factory.model('recruit'));
});

test('procedural crowd stays instanced at 320 players + 420 enemies and the boss swings on its wind-up', () => {
  const scene = new THREE.Scene(), visuals = new CharacterVisualFactory(scene, { definitions: ARCADE_CHARACTERS, procedural: new ChibiFactory() });
  const army = new PlayerArmy(CONFIG.maxPlayerUnits), horde = new EnemyHorde(CONFIG.maxEnemyUnits, 40);
  for (const unit of army.units) { unit.moving = true; unit.state = 'run'; }
  visuals.update(army.units, horde.units, 1, 1 / 60);
  assert.equal(visuals.batches.get('recruit').count, 319);
  assert.equal(visuals.batches.get('enemyGrunt').count, 420);
  assert.equal(visuals.shadows.count, 740);
  for (const batch of visuals.batches.values()) assert.equal(batch.loadState, 'procedural');
  const meshes = scene.children.filter(child => child.isInstancedMesh && child !== visuals.shadows);
  assert.ok(meshes.length < 80, `${meshes.length} instanced meshes`);
  const boss = new GiantBoss(20), batch = visuals.batches.get('giantBoss');
  boss.aiState = 'ATTACK'; boss.timer = 0.01;
  const raised = visuals.giantFrame(batch, boss, 0);
  boss.aiState = 'COOLDOWN'; boss.timer = ARCADE_CHARACTERS.giantBoss.cooldown - 0.3;
  const strike = visuals.giantFrame(batch, boss, 0);
  assert.ok(batch.clips.attack.frames.includes(batch.frames.indexOf(raised)));
  assert.ok(batch.frames.indexOf(strike) > batch.frames.indexOf(raised));
});

test('arcade camera keeps the army, both gate lanes and the boss on screen', () => {
  for (const aspect of [0.42, 390 / 844, 1, 844 / 390]) for (const count of [6, 50, 200, 320]) for (const side of [-1, 0, 1]) {
    const army = new PlayerArmy(count), center = side * army.limit;
    const boss = { type: 'giantBoss', alive: true, x: 0, z: 13, radius: 1.4 };
    const pose = arcadeCameraPose(0, army.depth, army.halfWidth, center, aspect, [boss]);
    const camera = new THREE.PerspectiveCamera(ARCADE_FOV, aspect, 0.1, 200);
    camera.position.set(pose.x, pose.height, pose.z); camera.lookAt(pose.targetX, pose.targetY, pose.targetZ); camera.updateMatrixWorld();
    const points = [[boss.x, 5.8, -boss.z], [-5.6, 0, -3], [5.6, 0, -3]];
    for (const unit of army.units) points.push([center + unit.formationSlot.x, 0, -unit.formationSlot.z], [center + unit.formationSlot.x, 1.5, -unit.formationSlot.z]);
    for (const position of points) {
      const p = new THREE.Vector3(...position).project(camera);
      assert.ok(Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && p.z < 1, `aspect ${aspect} army ${count} side ${side}: ${p.toArray()}`);
    }
  }
});
