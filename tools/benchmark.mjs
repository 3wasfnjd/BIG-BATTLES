// CPU-only stress harness. A Node timing is NOT a rendering FPS or phone benchmark.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssetManager } from '../src/core/AssetManager.js';
import { Simulation } from '../src/core/Simulation.js';
import { CharacterVisualFactory } from '../src/rendering/CharacterVisualFactory.js';
import { EffectsRenderer } from '../src/rendering/EffectsRenderer.js';
import { EnvironmentFactory } from '../src/rendering/EnvironmentFactory.js';
import { CameraRig } from '../src/rendering/CameraRig.js';
import { CHARACTERS } from '../src/data/characters.js';

const assets = new AssetManager(), loader = new GLTFLoader();
for (const def of Object.values(CHARACTERS)) {
  const bytes = await readFile(new URL(`../${def.modelUrl}`, import.meta.url));
  assets.models.set(def.modelUrl, loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), ''));
}
const scene = new THREE.Scene(), visuals = new CharacterVisualFactory(scene, { loadModels: false });
visuals.assets = assets;
for (const type of ['commander', 'recruit', 'elite', 'enemyGrunt']) await visuals.loadReplacement(visuals.batches.get(type), CHARACTERS[type]);
const effects = new EffectsRenderer(scene), environment = new EnvironmentFactory(scene, 270);
const camera = new THREE.PerspectiveCamera(45, 390 / 844, 0.1, 160), cameraRig = new CameraRig(camera);
const percentile = (values, ratio) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * ratio)];
const summarize = values => ({ median: +percentile(values, 0.5).toFixed(4), p95: +percentile(values, 0.95).toFixed(4), max: +Math.max(...values).toFixed(4) });
const report = {
  date: new Date().toISOString(), kind: 'CPU simulation + scene/matrix updates; no WebGL renderer',
  runtime: process.version, platform: `${process.platform}/${process.arch}`, cpu: cpus()[0].model,
  realDeviceFPS: null, webGLFPS: null, webGLLimitation: 'Available cloud Chrome reports GL_RENDERER Disabled; no GPU frame rendering was measured.',
  method: 'Five sustained cases. Real combat/upgrades and animated GLB crowd poses. Health raised to 100000 only to maintain population. 240 warmup ticks + 1200 measured fixed 60 Hz ticks per case. No gates/canvas text in this CPU harness.',
  cases: [],
};
for (const [players, enemies] of [[50,50], [100,100], [200,200], [320,320], [320,420]]) {
  const data = { id: 'stress', length: 1000, initialArmy: players, sections: [{ type: 'enemyWave', z: 18, triggerDistance: 18, count: enemies }] };
  visuals.clear(); effects.clear();
  const sim = new Simulation({ onHit: (unit, died) => { effects.hit(unit, died); if (died) visuals.die(unit); } }, data);
  sim.start(); sim.update(1 / 60); sim.army.upgrade('elite_upgrade', 0.4); sim.army.upgrade('fire_rate', 1.35); sim.army.upgrade('weapon_upgrade', 1);
  for (const unit of [...sim.army.units, ...sim.stage.enemies]) unit.health = unit.maxHealth = 100000;
  cameraRig.reset(sim.army.depth);
  const simulationMs = [], sceneUpdateMs = [], totalCpuMs = []; let maxVisibleMeshes = 0;
  for (let tick = 0; tick < 1440; tick++) {
    sim.army.targetX = Math.sin(tick / 130) * Math.min(2, sim.army.limit);
    const start = performance.now(); sim.update(1 / 60); const middle = performance.now();
    visuals.update(sim.army.units, sim.stage.enemies, sim.time, 1 / 60);
    effects.update(sim.projectiles.pool.active, sim.army, sim.stage.enemies, 1 / 60, sim.time);
    environment.update(sim.army.center.z); cameraRig.update(sim.army, 1 / 60); scene.updateMatrixWorld(true);
    const end = performance.now();
    if (tick >= 240) {
      simulationMs.push(middle - start); sceneUpdateMs.push(end - middle); totalCpuMs.push(end - start);
      let count = 0; scene.traverseVisible(o => { if (o.isMesh && (!o.isInstancedMesh || o.count)) count++; }); maxVisibleMeshes = Math.max(count, maxVisibleMeshes);
    }
  }
  if (sim.army.count !== players || sim.stage.enemies.length !== enemies || sim.state !== 'playing') throw new Error('Stress population changed; measurement is invalid.');
  const row = { players, enemies, simultaneousUnits: players + enemies, simulationMs: summarize(simulationMs), sceneUpdateMs: summarize(sceneUpdateMs), totalCpuMs: summarize(totalCpuMs), projectilePeak: sim.projectiles.pool.peak, projectileMisses: sim.projectiles.pool.misses, effectMisses: effects.pool.misses, visibleMeshesBeforeFrustumCulling: maxVisibleMeshes };
  report.cases.push(row); console.log(JSON.stringify(row));
}
await mkdir(new URL('../.test-output/', import.meta.url), { recursive: true });
await writeFile(new URL('../.test-output/benchmark.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
