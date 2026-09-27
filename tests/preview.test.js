import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssetManager } from '../src/core/AssetManager.js';
import { Game } from '../src/core/Game.js';
import { Simulation } from '../src/core/Simulation.js';
import { CHARACTERS } from '../src/data/characters.js';
import { CharacterPreview } from '../src/rendering/CharacterPreview.js';

async function recruitAssets() {
  const assets = new AssetManager();
  const file = await readFile(new URL('../assets/models/recruit.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  assets.models.set(CHARACTERS.recruit.modelUrl, Promise.resolve(gltf));
  return { assets, gltf };
}

test('preview uses the committed recruit with an isolated rig and fits rotated mobile views', async () => {
  const { assets, gltf } = await recruitAssets();
  assets.simplifyPrototype(gltf); // The same one-time material preparation used by gameplay.
  const before = gltf.scene.toJSON();
  const preview = new CharacterPreview(assets);
  await Promise.all([preview.load(), preview.load()]);
  assert.equal(assets.models.size, 1);
  assert.equal(preview.pivot.children.length, 1);
  assert.notEqual(preview.model.root, gltf.scene);
  assert.equal(preview.model.actions.idle.isRunning(), true);
  for (const aspect of [0.42, 390 / 844, 1, 844 / 390, 3]) {
    preview.resize(aspect);
    for (let step = 0; step < 12; step++) {
      preview.pivot.rotation.y = step / 12 * Math.PI * 2;
      preview.update(1 / 30);
      preview.scene.updateMatrixWorld(true);
      const point = new THREE.Vector3();
      preview.model.root.traverse(mesh => {
        if (!mesh.isMesh) return;
        mesh.skeleton?.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).project(preview.camera);
          assert.ok(Math.abs(point.x) < 0.85 && Math.abs(point.y) < 0.65 && Math.abs(point.z) < 1, `clipped soldier at aspect ${aspect}: ${point.toArray()}`);
        }
      });
    }
  }
  assert.deepEqual(gltf.scene.toJSON(), before, 'inspection must not alter the shared game asset');
});

// Minimal DOM event surface for lifecycle/input isolation, not browser rendering.
function element() {
  const handlers = new Map(), captures = new Set();
  return {
    hidden: false, textContent: '', clientWidth: 390, focused: false,
    addEventListener: (type, fn) => handlers.set(type, fn),
    setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id),
    focus() { this.focused = true; },
    fire(type, fields = {}) {
      const event = { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: 100, target: { closest: () => null }, stopped: false, prevented: false, stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; }, ...fields };
      handlers.get(type)?.(event);
      return event;
    },
  };
}
function gameFixture(assets) {
  const game = Object.create(Game.prototype);
  game.ui = Object.fromEntries(['start', 'hud', 'preview-soldier', 'soldier-preview', 'preview-back', 'preview-status'].map(id => [id, element()]));
  game.ui.hud.hidden = true; game.ui['soldier-preview'].hidden = true;
  game.sim = new Simulation(); game.visuals = { assets }; game.camera = { aspect: 390 / 844 };
  game.input = { reset() {} }; game.loop = { resetClock() {} };
  game.bindPreview();
  return game;
}

test('close while loading stays on the start screen; reopening never starts or changes the army', async () => {
  const { assets, gltf } = await recruitAssets();
  let resolve;
  assets.models.set(CHARACTERS.recruit.modelUrl, new Promise(done => { resolve = done; }));
  const game = gameFixture(assets), before = game.sim.army.units.map(u => [u.id, u.health, u.x, u.z]);
  const loading = game.openPreview();
  assert.equal(game.ui.start.hidden, true);
  assert.equal(game.ui['soldier-preview'].hidden, false);
  game.startOrResume(); game.sim.update(1 / 60);
  assert.equal(game.sim.state, 'ready');
  game.closePreview();
  resolve(gltf); await loading;
  assert.equal(game.previewVisible, false);
  assert.equal(game.ui.start.hidden, false);
  assert.equal(game.ui['soldier-preview'].hidden, true);
  assert.equal(game.ui.hud.hidden, true);
  await game.openPreview();
  assert.equal(game.ui['preview-status'].textContent, '');
  assert.deepEqual(game.sim.army.units.map(u => [u.id, u.health, u.x, u.z]), before);
  game.closePreview(); game.startOrResume();
  assert.equal(game.sim.state, 'playing');
  assert.equal(game.ui.hud.hidden, false);
});

test('preview drag is isolated, ignores a second finger and releases capture on back/cancel', async () => {
  const { assets } = await recruitAssets(), game = gameFixture(assets);
  await game.openPreview();
  const overlay = game.ui['soldier-preview'], original = game.preview.pivot.rotation.y;
  assert.equal(overlay.fire('pointerdown').stopped, true);
  assert.equal(overlay.hasPointerCapture(7), true);
  assert.equal(overlay.fire('pointermove', { clientX: 200 }).stopped, true);
  assert.ok(Math.abs(game.preview.pivot.rotation.y - original) > 1);
  const rotated = game.preview.pivot.rotation.y;
  overlay.fire('pointerdown', { pointerId: 8, isPrimary: false });
  overlay.fire('pointermove', { pointerId: 8, clientX: 350 });
  assert.equal(game.preview.pivot.rotation.y, rotated);
  overlay.fire('pointercancel');
  assert.equal(game.preview.pointer, null);
  assert.equal(overlay.hasPointerCapture(7), false);
  overlay.fire('pointerdown');
  assert.equal(game.ui['preview-back'].fire('click').stopped, true);
  assert.equal(overlay.hasPointerCapture(7), false);
  assert.equal(game.sim.state, 'ready');
  assert.equal(game.previewVisible, false);
});

test('failed preview has a usable back button and can retry the same asset', async t => {
  const { assets, gltf } = await recruitAssets();
  t.mock.method(console, 'warn', () => {});
  assets.models.set(CHARACTERS.recruit.modelUrl, Promise.reject(new Error('offline fixture')));
  const game = gameFixture(assets);
  await game.openPreview();
  assert.match(game.ui['preview-status'].textContent, /تعذّر/);
  game.ui['preview-back'].fire('click');
  assert.equal(game.ui.start.hidden, false);
  assets.models.set(CHARACTERS.recruit.modelUrl, Promise.resolve(gltf));
  await game.openPreview();
  assert.ok(game.preview.model);
  assert.equal(game.ui['preview-status'].textContent, '');
  assert.equal(game.sim.state, 'ready');
});
