import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CHARACTERS } from '../src/data/characters.js';
import { AssetManager } from '../src/core/AssetManager.js';
import { CharacterVisualFactory } from '../src/rendering/CharacterVisualFactory.js';
import { PlayerArmy } from '../src/entities/PlayerArmy.js';
import { EnemyHorde } from '../src/entities/EnemyHorde.js';

export async function loadAssets() {
  const assets = new AssetManager(), loader = new GLTFLoader();
  // The defence-only brute has no GLB; it uses the procedural chibi or placeholder.
  for (const def of Object.values(CHARACTERS).filter(d => d.modelUrl)) {
    const file = await readFile(new URL(`../${def.modelUrl}`, import.meta.url));
    const gltf = await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
    assets.models.set(def.modelUrl, Promise.resolve(gltf));
  }
  return assets;
}

test('all six committed GLBs parse, contain five working clips, and meet mobile prototype budgets', async () => {
  const assets = await loadAssets(), point = new THREE.Vector3();
  for (const [type, def] of Object.entries(CHARACTERS).filter(([, d]) => d.modelUrl)) {
    const gltf = await assets.loadModel(def.modelUrl), scene = gltf.scene;
    assert.deepEqual(gltf.animations.map(c => c.name).sort(), Object.values(def.animations).sort());
    let triangles = 0, rigs = 0;
    scene.updateMatrixWorld(true);
    scene.traverse(mesh => {
      if (!mesh.isMesh) return;
      triangles += (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3;
      assert.equal(Array.isArray(mesh.material), false);
      assert.equal(mesh.material.map, null); assert.equal(mesh.isSkinnedMesh, true); rigs++;
      mesh.skeleton.update();
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, point); assert.ok(point.toArray().every(Number.isFinite));
        assert.ok(Math.abs(point.x) < 2 && point.y >= -0.005 && point.y < 2 && Math.abs(point.z) < 2, `${type}: invalid bind pose ${point.toArray()}`);
      }
    });
    assert.ok(triangles > 200 && triangles <= (type === 'recruit' ? 3000 : 1500), `${type}: ${triangles}`); assert.ok(rigs > 0);
    assert.ok(type === 'desertBeast' || scene.getObjectByName(type === 'giantBoss' ? 'mace' : 'rifle'));
    if (type === 'commander') assert.ok(scene.getObjectByName('cape'));
    const animated = await assets.animatedModel(def);
    for (const state of Object.keys(def.animations)) {
      animated.mixer.stopAllAction(); const action = animated.actions[state]; action.reset().play();
      animated.mixer.update(action.getClip().duration * 0.36); animated.root.updateMatrixWorld(true);
      const changed = []; animated.root.traverse(o => { if (o.isBone) changed.push(Math.abs(o.quaternion.x) + Math.abs(o.quaternion.z)); });
      assert.ok(changed.some(v => v > 0.002), `${type}/${state} has no motion`);
      animated.root.traverse(mesh => {
        if (!mesh.isMesh) return; mesh.skeleton.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, point); assert.ok(point.toArray().every(Number.isFinite));
          assert.ok(point.length() < 3, `${type}/${state}: exploded rig`);
        }
      });
    }
  }
});

test('real animated crowd poses stay instanced at 320 players + 420 enemies, with bounded death playback', async () => {
  const scene = new THREE.Scene(), visuals = new CharacterVisualFactory(scene, { loadModels: false });
  visuals.assets = await loadAssets();
  const army = new PlayerArmy(320), horde = new EnemyHorde(420, 18);
  army.upgrade('elite_upgrade', 0.4);
  const before = army.units.map(u => [u.id, u.health, u.damage, u.range]);
  for (const type of ['commander', 'recruit', 'elite', 'enemyGrunt']) assert.equal(await visuals.loadReplacement(visuals.batches.get(type), CHARACTERS[type]), true);
  for (const type of ['recruit', 'elite', 'enemyGrunt']) {
    const batch = visuals.batches.get(type); assert.equal(batch.animated, null);
    assert.equal(batch.clips.run.frames.length, 8); assert.equal(batch.frames[0].parts.length, 1);
    const a = batch.frames[batch.clips.run.frames[0]].parts[0].geometry.attributes.position.array;
    const b = batch.frames[batch.clips.run.frames[2]].parts[0].geometry.attributes.position.array;
    assert.ok(a.some((v, i) => Math.abs(v - b[i]) > 0.01), `${type}: poses must differ`);
    const hitStart = batch.frames[batch.clips.hit.frames[0]].parts[0].geometry.attributes.position.array;
    const hitMiddle = batch.frames[batch.clips.hit.frames[1]].parts[0].geometry.attributes.position.array;
    assert.ok(hitStart.some((v, i) => Math.abs(v - hitMiddle[i]) > 0.01), `${type}: hit poses must include the recoil midpoint`);
  }
  for (let tick = 0; tick < 120; tick++) {
    for (const unit of [...army.units, ...horde.units]) { unit.moving = true; unit.state = 'run'; }
    visuals.update(army.units, horde.units, tick / 60, 1 / 60);
  }
  assert.equal(visuals.shadows.count, 740);
  assert.equal([...visuals.batches.values()].reduce((sum, b) => sum + b.count, 0), 740);
  assert.deepEqual(army.units.map(u => [u.id, u.health, u.damage, u.range]), before);
  assert.ok(scene.children.filter(o => o.isInstancedMesh && o.visible && o.count > 0).length <= 26);
  for (let i = 0; i < 100; i++) { const unit = horde.units[i]; unit.takeDamage(999); visuals.die(unit); }
  horde.prune(); assert.equal(visuals.corpses.length, 32);
  visuals.update(army.units, horde.units, 2, 1 / 60);
  visuals.update(army.units, horde.units, 3, 1); assert.equal(visuals.corpses.length, 0);
  visuals.clear(); visuals.update(new PlayerArmy(6).units, [], 0, 0);
  assert.equal(visuals.shadows.count, 6); assert.equal(visuals.batches.get('enemyGrunt').count, 0);
});

test('missing GLB preserves playable procedural fallback', async () => {
  const visuals = new CharacterVisualFactory(new THREE.Scene(), { loadModels: false }), batch = visuals.batches.get('recruit');
  visuals.assets.loadModel = () => Promise.reject(new Error('intentionally missing fixture'));
  const oldWarn = console.warn; console.warn = () => {};
  try { assert.equal(await visuals.loadReplacement(batch, CHARACTERS.recruit), false); } finally { console.warn = oldWarn; }
  visuals.update(new PlayerArmy(10).units, [], 0, 1 / 60);
  assert.equal(batch.custom, false); assert.equal(batch.loadState, 'fallback'); assert.equal(batch.meshes[0].count, 9);
});
