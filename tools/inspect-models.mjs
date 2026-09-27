import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssetManager } from '../src/core/AssetManager.js';
import { CHARACTERS } from '../src/data/characters.js';
const assets = new AssetManager(), loader = new GLTFLoader(), output = [];
for (const [type, def] of Object.entries(CHARACTERS)) {
  const bytes = await readFile(new URL(`../${def.modelUrl}`, import.meta.url));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  assets.models.set(def.modelUrl, Promise.resolve(gltf));
  const parts = await assets.staticParts(def);
  for (const view of ['front', 'back']) {
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(view === 'front' ? 2.5 : -2.5, 2.0, view === 'front' ? -3.6 : 3.6);
    camera.lookAt(0, 0.7, 0); camera.updateMatrixWorld(true);
    const faces = [], vertex = new THREE.Vector3(), world = new THREE.Vector3(), normal = new THREE.Vector3(), light = new THREE.Vector3(-2, 5, -3).normalize();
    for (const { geometry, material } of parts) {
      const positions = geometry.attributes.position, colors = geometry.attributes.color, indices = geometry.index;
      const count = indices?.count || positions.count;
      for (let i = 0; i < count; i += 3) {
        const face = [], c = new THREE.Color(0, 0, 0); let shade = 0;
        for (let k = 0; k < 3; k++) {
          const index = indices ? indices.getX(i + k) : i + k;
          world.fromBufferAttribute(positions, index); vertex.copy(world).project(camera); face.push([vertex.x, vertex.y, vertex.z]);
          normal.fromBufferAttribute(geometry.attributes.normal, index);
          shade += Math.max(0, normal.dot(light)) / 3;
          const color = colors ? new THREE.Color().fromBufferAttribute(colors, index) : material.color;
          c.r += color.r / 3; c.g += color.g / 3; c.b += color.b / 3;
        }
        c.multiplyScalar(0.55 + shade * 0.6).convertLinearToSRGB();
        faces.push({ p: face, c: c.toArray().map(v => Math.round(Math.max(0, Math.min(1, v)) * 255)) });
      }
    }
    output.push({ type, view, faces });
  }
}
await mkdir(new URL('../.test-output/', import.meta.url), { recursive: true });
await writeFile(new URL('../.test-output/model-views.json', import.meta.url), JSON.stringify(output));
console.log('Projected actual GLB triangle geometry to .test-output/model-views.json');
