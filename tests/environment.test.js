import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentFactory } from '../src/rendering/EnvironmentFactory.js';

function buffers(scene) {
  let geometryBytes = 0, instanceBytes = 0;
  const geometry = new Set();
  scene.traverse(o => { if (o.geometry) geometry.add(o.geometry); if (o.instanceMatrix) instanceBytes += o.instanceMatrix.array.byteLength; });
  for (const g of geometry) {
    for (const a of Object.values(g.attributes)) geometryBytes += a.array.byteLength;
    geometryBytes += g.index?.array.byteLength || 0;
  }
  return { geometryBytes, instanceBytes, geometryCount: geometry.size };
}

test('repeated corridor keeps geometry constant when the stage is four times longer', () => {
  const scene = new THREE.Scene(), environment = new EnvironmentFactory(scene, 270);
  const longerScene = new THREE.Scene(); new EnvironmentFactory(longerScene, 1080);
  const short = buffers(scene), long = buffers(longerScene);
  assert.equal(short.geometryBytes, long.geometryBytes);
  assert.equal(short.geometryCount, long.geometryCount);
  assert.ok(short.geometryBytes < 100_000);
  assert.ok(long.instanceBytes < 20_000);
  const materials = new Set();
  for (const [key, { mesh }] of environment.batches) {
    assert.equal(mesh.isInstancedMesh, true);
    assert.equal(mesh.geometry, environment.kit.get(key)); materials.add(mesh.material);
  }
  assert.equal(materials.size, 1);
});

test('corridor stays continuous through scrolling and replay without per-frame uploads', () => {
  const environment = new EnvironmentFactory(new THREE.Scene(), 270), matrix = new THREE.Matrix4();
  for (const z of [0, 15.99, 16, 78, 159, 191, 225, 270, 0]) {
    environment.update(z);
    const road = environment.batches.get('road').mesh, starts = [];
    for (let i = 0; i < road.count; i++) { road.getMatrixAt(i, matrix); starts.push(-matrix.elements[14]); }
    assert.ok(starts[0] <= z && starts.at(-1) + 16 >= z + 32);
    for (let i = 1; i < starts.length; i++) assert.equal(starts[i] - starts[i - 1], 16, 'No missing or overlapping road segments');
    for (const { mesh } of environment.batches.values()) {
      assert.ok(mesh.count <= mesh.instanceMatrix.count);
      assert.ok(mesh.instanceMatrix.array.slice(0, mesh.count * 16).every(Number.isFinite));
      const version = mesh.instanceMatrix.version;
      environment.update(z); assert.equal(mesh.instanceMatrix.version, version);
    }
  }
  assert.equal(environment.batches.get('enemyBanner').mesh.count, 0);
  environment.update(270);
  assert.ok(environment.batches.get('enemyBanner').mesh.count > 0);
});
