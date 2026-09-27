// Reproducible prototype art. These are NOT final reconstructions of the reference illustrations.
import { mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
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
function clipsFor(type, bones) {
  const creature = type === 'desertBeast', melee = creature || type === 'giantBoss';
  const states = ['idle', melee ? 'walk' : 'run', melee ? 'attack' : 'shoot', 'hit', 'death'];
  return states.map(state => {
    const duration = { idle: 2, run: 0.8, walk: 1, shoot: 0.22, attack: 0.8, hit: 0.22, death: 0.65 }[state];
    const times = Array.from({ length: 9 }, (_, i) => duration * i / 8);
    const rotations = bones.map(() => []), positions = bones.map(() => []);
    times.forEach((t, i) => {
      const u = i / 8, phase = u * Math.PI * 2, wave = Math.sin(phase), pulse = Math.sin(Math.PI * u);
      for (let j = 0; j < bones.length; j++) {
        const p = bones[j].position.clone(), euler = new THREE.Euler();
        if (state === 'idle') {
          if (j === 0) p.y += Math.sin(phase) * 0.008;
          if (j === 1) euler.x = wave * 0.018;
          if (j === 6) euler.x = wave * 0.025;
        } else if (state === 'run' || state === 'walk') {
          if (j === 0) p.y += (1 - Math.cos(phase * 2)) * 0.016;
          if (j === 2 || j === 3) euler.x = wave * (j === 2 ? 0.45 : -0.45);
          if (creature && (j === 4 || j === 5)) euler.x = wave * (j === 4 ? -0.4 : 0.4);
          if (!creature && (j === 4 || j === 5)) euler.x = wave * 0.06;
          if (j === 1) euler.x = -0.02 + wave * 0.025;
          if (j === 6) euler.x = 0.12 + wave * 0.05;
        } else if (state === 'shoot') {
          if (j === 0) p.z += pulse * 0.035;
          if (j === 5) euler.x = -pulse * 0.14;
          if (j === 1) euler.x = -pulse * 0.06;
        } else if (state === 'attack') {
          if (j === 0) { p.z -= pulse * (creature ? 0.2 : 0.1); euler.x = pulse * 0.1; }
          if (j === 1) euler.x = -pulse * (creature ? 0.3 : 0.05);
          if (j === 5 && !creature) euler.x = -Math.sin(u * Math.PI * 1.6) * 1.2;
          if (creature && (j === 2 || j === 4)) euler.x = pulse * 0.2;
        } else if (state === 'hit') {
          if (j === 0) { euler.x = -pulse * 0.14; p.z += pulse * 0.045; }
          if (j === 1) euler.x = -pulse * 0.1;
        } else if (state === 'death') {
          if (j === 0) { euler.x = u * (creature ? 0.1 : 1.32); euler.z = u * 0.22; p.y -= u * (creature ? 0.3 : 0.025); }
          if (j === 4 || j === 5) euler.z = u * (j === 4 ? -0.25 : 0.25);
        }
        const q = new THREE.Quaternion().setFromEuler(euler);
        rotations[j].push(q.x, q.y, q.z, q.w); positions[j].push(p.x, p.y, p.z);
      }
    });
    const tracks = [];
    bones.forEach((bone, i) => {
      const add = (Type, suffix, values, size) => {
        const constant = values.every((v, index) => Math.abs(v - values[index % size]) < 1e-8);
        tracks.push(new Type(`${bone.name}.${suffix}`, constant ? [0, duration] : times, constant ? [...values.slice(0, size), ...values.slice(0, size)] : values));
      };
      add(THREE.QuaternionKeyframeTrack, 'quaternion', rotations[i], 4);
      add(THREE.VectorKeyframeTrack, 'position', positions[i], 3);
    });
    return new THREE.AnimationClip(state, duration, tracks);
  });
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
