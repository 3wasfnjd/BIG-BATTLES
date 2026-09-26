import * as THREE from 'three';
import { PlaceholderFactory } from './PlaceholderFactory.js';
import { AssetManager } from '../core/AssetManager.js';
import { CHARACTERS } from '../data/characters.js';
import { CONFIG } from '../core/Config.js';
export class CharacterVisualFactory {
  constructor(scene) {
    this.scene = scene; this.assets = new AssetManager(); this.placeholders = new PlaceholderFactory();
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.batches = new Map(); this.dummy = new THREE.Object3D();
    this.white = new THREE.Color('#ffffff'); this.flash = new THREE.Color('#ffb298');
    for (const type of Object.keys(CHARACTERS)) this.addBatch(type);
    this.shadows = new THREE.InstancedMesh(new THREE.CircleGeometry(0.32, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#624d38', transparent: true, opacity: 0.2, depthWrite: false }), CONFIG.maxPlayerUnits + CONFIG.maxEnemyUnits + 2);
    this.shadows.frustumCulled = false; this.shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.shadows);
  }
  addBatch(type) {
    const capacity = type === 'enemyGrunt' ? CONFIG.maxEnemyUnits : ['recruit', 'elite'].includes(type) ? CONFIG.maxPlayerUnits : 1;
    const batch = { type, capacity, meshes: [], count: 0, custom: false, animated: null, lastState: null };
    this.setParts(batch, [{ geometry: this.placeholders.create(type), material: this.material }]);
    this.batches.set(type, batch);
    const def = CHARACTERS[type];
    if (def.modelUrl) this.loadReplacement(batch, def);
  }
  setParts(batch, parts) {
    for (const mesh of batch.meshes) { this.scene.remove(mesh); mesh.dispose(); }
    batch.meshes = parts.map(part => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, batch.capacity);
      mesh.frustumCulled = false; mesh.count = 0; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.scene.add(mesh); return mesh;
    });
  }
  async loadReplacement(batch, def) {
    try {
      if (def.mode === 'animated' && batch.capacity === 1) {
        batch.animated = await this.assets.animatedModel(def); this.scene.add(batch.animated.root);
        batch.animated.root.visible = false; this.setParts(batch, []);
      } else this.setParts(batch, await this.assets.staticParts(def));
      batch.custom = true;
    } catch (error) { console.warn(`Model fallback: ${batch.type}`, error); }
  }
  update(players, enemies, time, dt) {
    for (const batch of this.batches.values()) { batch.count = 0; if (batch.animated) batch.animated.root.visible = false; }
    let shadowCount = 0;
    const renderUnit = unit => {
      if (!unit.alive) return;
      const batch = this.batches.get(unit.type), def = CHARACTERS[unit.type];
      if (batch.count >= batch.capacity) return;
      const scale = def.scale * (batch.custom ? def.modelScale : 1);
      const bob = unit.state === 'run' ? Math.sin(time * 13 + unit.id * 1.4) * 0.035 : 0;
      const windup = unit.telegraph ? Math.sin(time * 14) * 0.025 : 0;
      this.dummy.position.set(unit.x, bob + (batch.custom ? def.offsetY : 0), -unit.z);
      this.dummy.rotation.set(windup, (unit.team === 'enemy' ? Math.PI : 0) + (batch.custom ? def.rotationY : 0), 0);
      this.dummy.scale.setScalar(scale); this.dummy.updateMatrix();
      if (batch.animated) {
        const { root, mixer, actions } = batch.animated;
        root.visible = true; root.position.copy(this.dummy.position); root.rotation.copy(this.dummy.rotation); root.scale.copy(this.dummy.scale);
        const state = unit.hitTime > 0 ? 'hit' : unit.state;
        if (state !== batch.lastState) { actions[batch.lastState]?.fadeOut(0.1); const action = actions[state] || actions.idle; action?.reset().fadeIn(0.1).play(); batch.lastState = state; }
        mixer.update(dt);
      } else for (const mesh of batch.meshes) { mesh.setMatrixAt(batch.count, this.dummy.matrix); mesh.setColorAt(batch.count, unit.hitTime > 0 ? this.flash : this.white); }
      batch.count++;
      this.dummy.position.set(unit.x, 0.035, -unit.z); this.dummy.rotation.set(0, 0, 0); this.dummy.scale.setScalar(def.scale); this.dummy.updateMatrix();
      this.shadows.setMatrixAt(shadowCount++, this.dummy.matrix);
    };
    players.forEach(renderUnit); enemies.forEach(renderUnit);
    for (const batch of this.batches.values()) for (const mesh of batch.meshes) { mesh.count = batch.count; mesh.visible = batch.count > 0; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    this.shadows.count = shadowCount; this.shadows.instanceMatrix.needsUpdate = true;
  }
}
