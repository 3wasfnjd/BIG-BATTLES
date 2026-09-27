import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssetManager } from '../src/core/AssetManager.js';
import { CharacterVisualFactory } from '../src/rendering/CharacterVisualFactory.js';
import { PlayerArmy } from '../src/entities/PlayerArmy.js';
import { EnemyHorde } from '../src/entities/EnemyHorde.js';

function triangleGLB() {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1.44, 0]);
  const gltf = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, translation: [0, 0.1, 0] }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], buffers: [{ byteLength: 36 }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1.44, 0] }] };
  const json = Buffer.from(JSON.stringify(gltf)), jsonSize = Math.ceil(json.length / 4) * 4;
  const output = Buffer.alloc(12 + 8 + jsonSize + 8 + 36);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jsonSize, 12); output.writeUInt32LE(0x4e4f534a, 16); output.fill(0x20, 20, 20 + jsonSize); json.copy(output, 20);
  output.writeUInt32LE(36, 20 + jsonSize); output.writeUInt32LE(0x004e4942, 24 + jsonSize); Buffer.from(positions.buffer).copy(output, 28 + jsonSize);
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
}

test('a real GLB parses and replaces a placeholder without changing entity stats', async () => {
  const gltf = await new GLTFLoader().parseAsync(triangleGLB(), '');
  const assets = new AssetManager(); assets.models.set('fixture.glb', Promise.resolve(gltf));
  const scene = new THREE.Scene(), visuals = new CharacterVisualFactory(scene, { loadModels: false }), army = new PlayerArmy(6);
  visuals.assets = assets;
  const definition = { modelUrl: 'fixture.glb', mode: 'instanced', animations: { idle: 'idle' } };
  const before = army.units.map(unit => [unit.id, unit.health, unit.damage]);
  await visuals.loadReplacement(visuals.batches.get('recruit'), definition);
  const batch = visuals.batches.get('recruit'); assert.equal(batch.custom, true);
  assert.ok(batch.meshes[0].geometry.attributes.position.getY(0) > 0.09);
  visuals.update(army.units, [], 0, 1 / 60); assert.equal(batch.meshes[0].count, 5);
  assert.deepEqual(army.units.map(unit => [unit.id, unit.health, unit.damage]), before);
  const animated = await assets.animatedModel(definition); assert.ok(animated.mixer); assert.notEqual(animated.root, gltf.scene);
});

test('320 players and 420 enemies retain bounded instance batches across reset', () => {
  const scene = new THREE.Scene(), visuals = new CharacterVisualFactory(scene, { loadModels: false }), army = new PlayerArmy(320), horde = new EnemyHorde(420, 20);
  const objectCount = scene.children.length;
  visuals.update(army.units, horde.units, 1, 1 / 60);
  assert.equal(visuals.batches.get('recruit').meshes[0].count, 319);
  assert.equal(visuals.batches.get('enemyGrunt').meshes[0].count, 420);
  army.upgrade('elite_upgrade', 0.4); visuals.update(army.units, horde.units, 2, 1 / 60);
  assert.ok(visuals.batches.get('elite').meshes[0].count > 0);
  visuals.update(new PlayerArmy(6).units, [], 0, 1 / 60);
  assert.equal(visuals.batches.get('elite').meshes[0].count, 0);
  assert.equal(visuals.batches.get('enemyGrunt').meshes[0].count, 0);
  assert.equal(scene.children.length, objectCount);
});
