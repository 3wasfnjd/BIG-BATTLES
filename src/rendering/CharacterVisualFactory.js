import * as THREE from 'three';
import { PlaceholderFactory } from './PlaceholderFactory.js';
import { AssetManager } from '../core/AssetManager.js';
import { CHARACTERS } from '../data/characters.js';
import { CONFIG } from '../core/Config.js';
import { softDirectionalShadow } from './QualityGeometry.js';
const CORPSE_LIMIT = 32;
export class CharacterVisualFactory {
  constructor(scene, { loadModels = true, definitions = CHARACTERS, quality = false, procedural = null } = {}) {
    this.definitions = definitions; this.procedural = procedural;
    this.scene = scene; this.assets = new AssetManager(); this.placeholders = new PlaceholderFactory(); this.loadModels = loadModels;
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.batches = new Map(); this.dummy = new THREE.Object3D(); this.corpses = [];
    this.white = new THREE.Color('#ffffff'); this.flash = procedural ? new THREE.Color(2.1, 2.1, 2.1) : new THREE.Color('#ffb298');
    // Giants are hit constantly; a softer flash keeps their colours readable.
    this.softFlash = procedural ? new THREE.Color(1.3, 1.25, 1.25) : this.flash;
    for (const type of Object.keys(CHARACTERS)) this.addBatch(type);
    const soft = quality || !!procedural;
    this.shadows = new THREE.InstancedMesh(soft ? softDirectionalShadow() : new THREE.CircleGeometry(0.32, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: procedural ? '#3a4a5c' : quality ? '#354b42' : '#624d38', vertexColors: soft, transparent: true, opacity: procedural ? 0.42 : quality ? 0.32 : 0.2, depthWrite: false, side: soft ? THREE.DoubleSide : THREE.FrontSide }), CONFIG.maxPlayerUnits + CONFIG.maxEnemyUnits + 2);
    this.shadows.frustumCulled = false; this.shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.shadows);
  }
  addBatch(type) {
    const capacity = type === 'enemyGrunt' ? CONFIG.maxEnemyUnits : ['recruit', 'elite'].includes(type) ? CONFIG.maxPlayerUnits : 1;
    const batch = { type, capacity, meshes: [], frames: [], clips: {}, count: 0, custom: false, animated: null, action: null, loadState: 'placeholder' };
    if (this.procedural) {
      // Procedural chibi poses are ready synchronously; no GLB request or fallback swap.
      const model = this.procedural.model(type);
      batch.frames = model.frames.map(frame => ({ parts: frame.parts, count: 0 })); batch.clips = model.clips;
      batch.custom = true; batch.loadState = 'procedural'; this.instantiateFrame(batch, batch.frames[0]);
    } else this.setParts(batch, [{ geometry: this.placeholders.create(type), material: this.material }]);
    this.batches.set(type, batch);
  }
  instantiateFrame(batch, frame) {
    if (frame.meshes) return;
    frame.meshes = frame.parts.map(part => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, batch.capacity + (batch.capacity > 1 ? CORPSE_LIMIT : 0));
      mesh.frustumCulled = false; mesh.count = 0; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Heroes and giants cast real shadows; the crowd keeps cheap instanced blobs.
      mesh.castShadow = !!this.procedural && batch.capacity === 1;
      this.scene.add(mesh); batch.meshes.push(mesh); return mesh;
    });
  }
  removeMeshes(batch) { for (const mesh of batch.meshes) { this.scene.remove(mesh); mesh.dispose(); } batch.meshes.length = 0; }
  setParts(batch, parts) {
    this.removeMeshes(batch); batch.frames = parts.length ? [{ parts, count: 0 }] : [];
    if (parts.length) this.instantiateFrame(batch, batch.frames[0]);
  }
  async loadReplacement(batch, def) {
    batch.loadState = 'loading';
    try {
      if (def.mode === 'animated' && batch.capacity === 1) {
        const animated = await this.assets.animatedModel(def); animated.root.visible = false;
        if (batch.animated) { batch.animated.mixer.stopAllAction(); this.scene.remove(batch.animated.root); }
        batch.animated = animated; batch.action = null; this.scene.add(animated.root); this.setParts(batch, []);
      } else {
        const model = await this.assets.crowdModel(def);
        this.removeMeshes(batch); batch.frames = model.frames; batch.clips = model.clips;
        for (const frame of batch.frames) frame.count = 0;
        this.instantiateFrame(batch, batch.frames[0]);
      }
      batch.custom = true; batch.loadState = 'ready'; return true;
    } catch (error) { batch.loadState = 'fallback'; console.warn(`Model fallback: ${batch.type}`, error); return false; }
  }
  die(unit) {
    // Rendering owns death playback; dead units are removed from gameplay immediately.
    if (this.corpses.length >= CORPSE_LIMIT) this.corpses.shift();
    const batch = this.batches.get(unit.type);
    const duration = batch.animated?.actions.death?.getClip().duration || batch.clips.death?.duration || 0.65;
    this.corpses.push({ unit: { ...unit, state: 'death', telegraph: 0, moving: false, hitTime: 0 }, time: 0, duration: Math.min(3, duration + 0.05) });
  }
  clear() {
    this.corpses.length = 0;
    for (const batch of this.batches.values()) if (batch.animated) {
      batch.animated.mixer.stopAllAction(); batch.animated.root.visible = false; batch.action = null;
    }
  }
  frameFor(batch, unit, time, deathTime) {
    if (deathTime === null && unit.aiState) return this.giantFrame(batch, unit, time);
    const state = deathTime !== null ? 'death' : unit.hitTime > 0 ? 'hit' : unit.moving ? 'run' : unit.state;
    const clip = batch.clips[state] || batch.clips.idle;
    if (!clip) return batch.frames[0];
    const clock = deathTime ?? (state === 'hit' ? (1 - unit.hitTime / 0.12) * clip.duration : state === 'shoot' ? (1 - unit.shotFlash / 0.1) * clip.duration : time + (unit.id % 19) * 0.11);
    const phase = clip.loop ? (clock % clip.duration) / clip.duration : Math.min(1, Math.max(0, clock) / clip.duration);
    return batch.frames[clip.frames[Math.min(clip.frames.length - 1, Math.floor(phase * clip.frames.length))]];
  }
  // Giants: wind-up raises the weapon, the strike lands at the start of the cooldown.
  giantFrame(batch, unit, time) {
    const def = this.definitions[unit.type], attack = batch.clips.attack;
    let clip = unit.moving ? batch.clips.run : batch.clips.idle, phase = null;
    if (attack && unit.aiState === 'ATTACK') { clip = attack; phase = 0.5 * (1 - Math.max(0, unit.timer) / def.windup); }
    else if (attack && unit.aiState === 'COOLDOWN' && def.cooldown - unit.timer < 0.45) { clip = attack; phase = 0.5 + 0.5 * (def.cooldown - unit.timer) / 0.45; }
    clip ||= batch.clips.idle;
    if (!clip) return batch.frames[0];
    if (phase === null) phase = ((time + (unit.id % 19) * 0.11) % clip.duration) / clip.duration;
    return batch.frames[clip.frames[Math.min(clip.frames.length - 1, Math.floor(phase * clip.frames.length))]];
  }
  renderUnit(unit, time, dt, deathTime = null) {
    if (!unit.alive && deathTime === null) return;
    const batch = this.batches.get(unit.type), def = this.definitions[unit.type];
    if (batch.count >= batch.capacity + (deathTime !== null && batch.capacity > 1 ? CORPSE_LIMIT : 0)) return;
    if (this.loadModels && def.modelUrl && batch.loadState === 'placeholder') this.loadReplacement(batch, def);
    const scale = def.scale * (batch.custom ? def.modelScale : 1);
    const bob = !batch.custom && unit.moving ? Math.sin(time * 13 + unit.id * 1.4) * 0.035 : 0;
    // Procedural crowds get a stable per-unit offset/yaw so ranks never look like a grid.
    const crowd = this.procedural && batch.capacity > 1, jx = crowd ? ((unit.id * 37) % 11 - 5) * 0.022 : 0, jz = crowd ? ((unit.id * 53) % 13 - 6) * 0.02 : 0;
    this.dummy.position.set(unit.x + jx, bob + (batch.custom ? def.offsetY : 0), -unit.z + jz);
    this.dummy.rotation.set(!batch.custom && unit.telegraph ? Math.sin(time * 14) * 0.035 : 0, unit.aimAngle + (batch.custom ? def.rotationY : 0) + (crowd ? ((unit.id * 29) % 9 - 4) * 0.035 : 0), 0);
    this.dummy.scale.setScalar(scale);
    if (deathTime !== null && !batch.custom) { this.dummy.rotation.z = deathTime * 2; this.dummy.scale.multiplyScalar(Math.max(0.05, 1 - deathTime / 0.7)); }
    this.dummy.updateMatrix();
    if (batch.animated) {
      const { root, mixer, actions } = batch.animated;
      root.visible = true; root.position.copy(this.dummy.position); root.rotation.copy(this.dummy.rotation); root.scale.copy(this.dummy.scale);
      // Boss hit flashes must not interrupt its attack/death clip every projectile.
      const state = deathTime !== null ? 'death' : unit.state === 'idle' && unit.hitTime > 0 ? 'hit' : unit.state;
      const action = actions[state] || actions.idle;
      if (action !== batch.action) { batch.action?.fadeOut(0.08); action?.reset().fadeIn(0.08).play(); batch.action = action; }
      mixer.update(dt);
    } else {
      const frame = this.frameFor(batch, unit, time, deathTime); if (!frame) return;
      this.instantiateFrame(batch, frame);
      for (const mesh of frame.meshes) { mesh.setMatrixAt(frame.count, this.dummy.matrix); mesh.setColorAt(frame.count, unit.hitTime > 0 ? (batch.capacity === 1 ? this.softFlash : this.flash) : this.white); }
      frame.count++;
    }
    batch.count++;
    if (deathTime === null) {
      this.dummy.position.set(unit.x, 0.035, -unit.z); this.dummy.rotation.set(0, 0, 0); this.dummy.scale.setScalar(def.scale); this.dummy.updateMatrix();
      this.shadows.setMatrixAt(this.shadowCount++, this.dummy.matrix);
    }
  }
  update(players, enemies, time, dt) {
    for (const batch of this.batches.values()) { batch.count = 0; for (const frame of batch.frames) frame.count = 0; if (batch.animated) batch.animated.root.visible = false; }
    this.shadowCount = 0;
    for (const unit of players) this.renderUnit(unit, time, dt);
    for (const unit of enemies) this.renderUnit(unit, time, dt);
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const corpse = this.corpses[i]; corpse.time += dt;
      if (corpse.time >= corpse.duration) { this.corpses.splice(i, 1); continue; }
      this.renderUnit(corpse.unit, time, dt, corpse.time);
    }
    for (const batch of this.batches.values()) for (const frame of batch.frames) for (const mesh of frame.meshes || []) {
      mesh.count = frame.count; mesh.visible = frame.count > 0;
      if (!mesh.visible) continue;
      mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, frame.count * 16); mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) { mesh.instanceColor.clearUpdateRanges(); mesh.instanceColor.addUpdateRange(0, frame.count * 3); mesh.instanceColor.needsUpdate = true; }
    }
    this.shadows.count = this.shadowCount;
    this.shadows.instanceMatrix.clearUpdateRanges(); this.shadows.instanceMatrix.addUpdateRange(0, this.shadowCount * 16); this.shadows.instanceMatrix.needsUpdate = true;
  }
}
