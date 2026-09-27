// Reproducible prototype art. These are NOT final reconstructions of the reference illustrations.
import { mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { clipsFor } from './art/animation-clips.mjs';
import { PlaceholderFactory } from '../src/rendering/PlaceholderFactory.js';

// The exporter uses this browser API only to read the in-memory binary Blob.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
};
const names = { commander: 'commander', recruit: 'recruit', elite: 'elite', enemyGrunt: 'enemy-grunt', desertBeast: 'desert-beast', giantBoss: 'giant-boss' };
const factory = new PlaceholderFactory(), exporter = new GLTFExporter();
const folder = new URL('../assets/models/', import.meta.url);
await mkdir(folder, { recursive: true });
const report = { status: 'procedural-prototype', generator: 'tools/generate-models.mjs', finalReferenceArt: false, models: [] };

function componentGeometry(source, component) {
  const selected = [];
  for (let i = 0; i < source.attributes.position.count; i++) if (source.attributes._component.getX(i) === component) selected.push(i);
  if (!selected.length) return null;
  const geometry = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(source.attributes)) {
    if (name === '_component') continue;
    const data = new attr.array.constructor(selected.length * attr.itemSize);
    for (let i = 0; i < selected.length; i++) for (let k = 0; k < attr.itemSize; k++) data[i * attr.itemSize + k] = attr.array[selected[i] * attr.itemSize + k];
    geometry.setAttribute(name, new THREE.BufferAttribute(data, attr.itemSize));
  }
  const colors = geometry.attributes.color;
  geometry.setAttribute('color', new THREE.Uint8BufferAttribute(Uint8Array.from(colors.array, x => Math.round(x * 255)), 3, true));
  const welded = mergeVertices(geometry); geometry.dispose(); return welded;
}
for (const [type, filename] of Object.entries(names)) {
  const source = factory.create(type, true), group = new THREE.Group(); group.name = `BIG_BATTLES_${filename}`;
  group.userData = { artStatus: 'procedural-prototype', finalReferenceArt: false, forward: '-Z', origin: 'ground-center', textureCount: 0 };
  const pivots = type === 'desertBeast'
    ? [[0,0,0],[0,0.65,-0.75],[-0.55,0.4,-0.65],[-0.55,0.4,0.65],[0.55,0.4,-0.65],[0.55,0.4,0.65],[0,0,0]]
    : [[0,0,0],[0,0.91,0],[-0.16,0.4,0],[0.16,0.4,0],[-0.35,0.73,0],[0.35,0.73,0],[0,0.88,0.28]];
  const bones = pivots.map((position, i) => { const bone = new THREE.Bone(); bone.name = `joint_${i}`; bone.position.fromArray(position); return bone; });
  for (let i = 1; i < bones.length; i++) bones[0].add(bones[i]);
  group.add(bones[0]); group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones); skeleton.calculateInverses();
  const material = new THREE.MeshStandardMaterial({ name: 'SharedVertexPalette', vertexColors: true, roughness: 1, metalness: 0 });
  let triangles = 0, vertices = 0, meshes = 0;
  for (let i = 0; i < 3; i++) {
    const geometry = componentGeometry(source, i); if (!geometry) continue;
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = ['body', type === 'giantBoss' ? 'mace' : 'rifle', 'cape'][i];
    group.add(mesh); mesh.bind(skeleton, new THREE.Matrix4());
    triangles += geometry.index.count / 3; vertices += geometry.attributes.position.count; meshes++;
  }
  const animations = clipsFor(type, bones);
  const binary = await exporter.parseAsync(group, { binary: true, animations, onlyVisible: true });
  await writeFile(new URL(`${filename}.glb`, folder), Buffer.from(binary));
  report.models.push({ type, file: `${filename}.glb`, bytes: binary.byteLength, triangles, vertices, materials: 1, meshes, bones: bones.length, animations: animations.map(a => a.name) });
}
await writeFile(new URL('manifest.json', folder), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
