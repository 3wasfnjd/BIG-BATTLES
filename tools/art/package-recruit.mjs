// Package the inspected Higgsfield mesh with the game's cheap shared rigid rig.
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { clipsFor } from './animation-clips.mjs';

globalThis.FileReader = class { readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); } };
const sourceFile = new URL('../../art/sources/recruit-workshop.glb', import.meta.url);
const data = await readFile(sourceFile);
const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
gltf.scene.updateMatrixWorld(true);
const body = [], rifle = [], turn = new THREE.Matrix4().makeRotationY(Math.PI);
gltf.scene.traverse(object => {
  if (!object.isMesh) return;
  const joint = object.userData.rig_joint;
  if (!Number.isInteger(joint) || joint < 0 || joint > 6) throw new Error(`Missing joint metadata: ${object.name}`);
  let geometry = object.geometry.clone();
  geometry.applyMatrix4(turn.clone().multiply(object.matrixWorld));
  if (geometry.index) { const indexed = geometry; geometry = geometry.toNonIndexed(); indexed.dispose(); }
  const count = geometry.attributes.position.count, sourceColors = geometry.attributes.color;
  if (!sourceColors) throw new Error('Workshop mesh must have vertex colors');
  const colors = new Uint8Array(count * 3), joints = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = Math.round(sourceColors.getX(i) * 255); colors[i * 3 + 1] = Math.round(sourceColors.getY(i) * 255); colors[i * 3 + 2] = Math.round(sourceColors.getZ(i) * 255);
    joints[i * 4] = joint; weights[i * 4] = 1;
  }
  for (const key of Object.keys(geometry.attributes)) if (!['position', 'normal'].includes(key)) geometry.deleteAttribute(key);
  geometry.setAttribute('color', new THREE.Uint8BufferAttribute(colors, 3, true));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(joints, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  (object.userData.component === 'rifle' ? rifle : body).push(geometry);
});
const group = new THREE.Group(); group.name = 'BIG_BATTLES_recruit';
group.userData = { artStatus: 'procedural-prototype', modelStyle: 'reference-modeled-draft', finalReferenceArt: false, source: 'Higgsfield 3D Jutsu workshop; scripted mesh, not Meshy generation', forward: '-Z', origin: 'ground-center', textureCount: 0 };
const pivots = [[0,0,0],[0,.91,0],[.137,.4,0],[-.137,.4,0],[.231,.704,.008],[-.231,.704,.008],[0,.88,.28]];
const bones = pivots.map((p, i) => { const bone = new THREE.Bone(); bone.name = `joint_${i}`; bone.position.fromArray(p); return bone; });
for (let i = 1; i < bones.length; i++) bones[0].add(bones[i]);
group.add(bones[0]); group.updateMatrixWorld(true);
const skeleton = new THREE.Skeleton(bones); skeleton.calculateInverses();
const material = new THREE.MeshStandardMaterial({ name: 'SharedVertexPalette', vertexColors: true, roughness: 1, metalness: 0 });
let triangles = 0, vertices = 0;
for (const [name, parts] of [['body', body], ['rifle', rifle]]) {
  if (!parts.length) throw new Error(`Missing ${name}`);
  const merged = mergeGeometries(parts, false), geometry = mergeVertices(merged); merged.dispose(); parts.forEach(g => g.dispose());
  const mesh = new THREE.SkinnedMesh(geometry, material); mesh.name = name; group.add(mesh); mesh.bind(skeleton, new THREE.Matrix4());
  triangles += geometry.index.count / 3; vertices += geometry.attributes.position.count;
}
if (triangles > 3000 || vertices > 12000) throw new Error(`Recruit over budget: ${triangles} triangles / ${vertices} vertices`);
const animations = clipsFor('recruit', bones);
const binary = await new GLTFExporter().parseAsync(group, { binary: true, animations, onlyVisible: true });
const output = new URL('../../assets/models/recruit.glb', import.meta.url);
await writeFile(output, Buffer.from(binary));
const manifestPath = new URL('../../assets/models/manifest.json', import.meta.url);
const report = JSON.parse(await readFile(manifestPath, 'utf8'));
const entry = { type: 'recruit', file: 'recruit.glb', bytes: binary.byteLength, triangles, vertices, materials: 1, meshes: 2, bones: 7, animations: animations.map(a => a.name), artStatus: 'reference-modeled-draft', generator: 'tools/art/package-recruit.mjs', source: 'art/sources/recruit-workshop.glb' };
report.models[report.models.findIndex(m => m.type === 'recruit')] = entry;
report.generator = 'npm run models';
await writeFile(manifestPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(entry));
