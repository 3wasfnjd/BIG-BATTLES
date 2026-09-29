import * as THREE from 'three';
import { RELEASE } from './release.js';
import { Simulation } from './Simulation.js';
import { GameLoop } from './GameLoop.js';
import { PerformanceManager } from './PerformanceManager.js';
import { InputSystem } from '../systems/InputSystem.js';
import { CharacterVisualFactory } from '../rendering/CharacterVisualFactory.js';
import { EnvironmentFactory } from '../rendering/EnvironmentFactory.js';
import { GateRenderer, gateLabel } from '../rendering/GateRenderer.js';
import { EffectsRenderer } from '../rendering/EffectsRenderer.js';
import { CameraRig } from '../rendering/CameraRig.js';
import { CharacterPreview } from '../rendering/CharacterPreview.js';
import { QualityCameraRig } from '../rendering/QualityCameraRig.js';
import { visualProfile } from '../rendering/VisualProfiles.js';
import { ChibiFactory, chibiPreviewSource } from '../rendering/ChibiFactory.js';
import { ArcadeEnvironment } from '../rendering/ArcadeEnvironment.js';
import { ArcadeEffects } from '../rendering/ArcadeEffects.js';
import { ArcadeGateRenderer } from '../rendering/ArcadeGateRenderer.js';
import { ArcadeCameraRig } from '../rendering/ArcadeCameraRig.js';
import { WorldLabels } from '../rendering/WorldLabels.js';
import { clamp } from './Config.js';
export class Game {
  constructor() {
    const $ = id => document.getElementById(id);
    this.ui = Object.fromEntries(['game', 'scene', 'hud', 'start', 'start-game', 'result', 'result-title', 'result-note', 'army-count', 'progress', 'pause', 'paused', 'replay', 'boss-ui', 'boss-health', 'gate-feedback', 'debug', 'preview-soldier', 'soldier-preview', 'preview-back', 'preview-status', 'army-tag', 'horde-tag', 'giant-tag'].map(id => [id, $(id)]));
    this.debug = new URLSearchParams(location.search).get('debug') === '1';
    this.profile = visualProfile(location.search);
    if (this.debug && new URLSearchParams(location.search).get('portrait') === '1') document.body.classList.add('dev-portrait');
    this.ui.debug.hidden = !this.debug;
    const arcade = this.profile.arcade;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.ui.scene, antialias: this.profile.quality || arcade, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (this.profile.quality) this.renderer.toneMapping = THREE.NeutralToneMapping;
    if (arcade) { this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.08; this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    this.performance = new PerformanceManager(this.renderer);
    const sky = arcade ? '#7fcbe6' : '#d3b88f';
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(sky); this.scene.fog = arcade ? new THREE.Fog(sky, 55, 125) : new THREE.Fog(sky, 42, 102);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 160);
    this.scene.add(new THREE.HemisphereLight(arcade ? '#fdfbf5' : '#fff4de', arcade ? '#8d8a80' : this.profile.quality ? '#748778' : '#917e60', arcade ? 1.15 : this.profile.quality ? 1.35 : 2.2));
    const sunlight = new THREE.DirectionalLight('#fff0d6', arcade ? 3.1 : this.profile.quality ? 2.8 : 2.0); sunlight.position.set(-14, 24, 8); this.scene.add(sunlight);
    if (arcade) {
      // One shadow map that follows the army; the crowd itself uses soft instanced blobs.
      this.sun = sunlight; sunlight.castShadow = true; sunlight.shadow.mapSize.set(1024, 1024); sunlight.shadow.bias = -0.0015; sunlight.shadow.normalBias = 0.04;
      Object.assign(sunlight.shadow.camera, { left: -18, right: 18, top: 30, bottom: -24, near: 1, far: 70 }); sunlight.shadow.camera.updateProjectionMatrix();
      this.scene.add(sunlight.target);
    }
    this.effects = arcade ? new ArcadeEffects(this.scene) : new EffectsRenderer(this.scene, this.profile);
    this.sim = new Simulation({ onGate: (gate, choice, added) => this.gateFeedback(choice, added), onHit: (unit, died) => { this.effects.hit(unit, died); if (died) this.visuals.die(unit); }, onFinish: state => this.showResult(state) });
    this.chibi = arcade ? new ChibiFactory() : null;
    this.visuals = new CharacterVisualFactory(this.scene, { ...this.profile, procedural: this.chibi });
    this.environment = arcade ? new ArcadeEnvironment(this.scene, this.sim.data.length) : new EnvironmentFactory(this.scene, this.sim.data.length, this.profile);
    this.gateRenderer = arcade ? new ArcadeGateRenderer(this.scene, this.sim.gates.gates) : new GateRenderer(this.scene, this.sim.gates.gates);
    this.cameraRig = arcade ? new ArcadeCameraRig(this.camera) : this.profile.quality ? new QualityCameraRig(this.camera) : new CameraRig(this.camera); this.cameraRig.reset(this.sim.army.depth); this.feedbackTimer = 0; this.uiTimer = 0; this.sceneTime = 0; this.lastCount = -1;
    this.labels = arcade ? new WorldLabels(this.camera, { army: this.ui['army-tag'], horde: this.ui['horde-tag'], giant: this.ui['giant-tag'] }) : null;
    if (arcade) document.body.classList.add('arcade');
    this.input = new InputSystem(this.ui.game, () => this.startOrResume(), x => {
      if (this.sim.state === 'playing') this.sim.army.targetX = clamp(x, -this.sim.army.limit, this.sim.army.limit);
      return this.sim.army.targetX;
    }, () => this.sim.army.targetX);
    this.ui.pause.addEventListener('click', () => this.pause());
    this.ui['start-game'].addEventListener('click', event => { event.stopPropagation(); this.startOrResume(); });
    this.ui.replay.addEventListener('click', event => { event.stopPropagation(); this.replay(); });
    this.ui.paused.addEventListener('click', () => this.startOrResume());
    this.bindPreview();
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); this.loop.resetClock(); });
    window.addEventListener('blur', () => this.pause());
    window.addEventListener('resize', () => this.resize());
    this.contextLost = false;
    this.ui.scene.addEventListener('webglcontextlost', event => { event.preventDefault(); this.contextLost = true; this.pause(); this.ui.paused.querySelector('p').textContent = 'توقف العرض مؤقتًا'; });
    this.ui.scene.addEventListener('webglcontextrestored', () => { this.contextLost = false; this.loop.resetClock(); this.ui.paused.querySelector('p').textContent = 'المس للمتابعة'; });
    this.resize(); this.loop = new GameLoop(dt => this.sim.update(dt), (dt, raw) => this.render(dt, raw));
    $('load-status').hidden = true; $('load-line').hidden = true;
    this.ui['start-game'].disabled = false;
    if (this.profile.quality) {
      document.title = 'BIG BATTLES · تجربة الجودة';
      this.ui.start.querySelector('.start-prompt > span').textContent = 'تجربة بصرية • الشخصيات قيد التطوير';
    }
    this.loop.start();
  }
  resize() {
    const rect = this.ui.game.getBoundingClientRect(); this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / Math.max(1, rect.height); this.camera.updateProjectionMatrix();
    this.preview?.resize(this.camera.aspect);
  }
  startOrResume() {
    if (this.contextLost || this.previewVisible) return;
    if (this.sim.state === 'ready') { this.sim.start(); this.ui.start.hidden = true; this.ui.hud.hidden = false; }
    else if (this.sim.state === 'paused') { this.sim.state = 'playing'; this.ui.paused.hidden = true; this.loop.resetClock(); }
  }
  bindPreview() {
    const overlay = this.ui['soldier-preview'];
    this.ui['preview-soldier'].addEventListener('click', event => { event.stopPropagation(); this.openPreview(); });
    this.ui['preview-back'].addEventListener('click', event => { event.stopPropagation(); this.closePreview(); });
    overlay.addEventListener('pointerdown', event => {
      event.stopPropagation();
      if (!this.previewVisible || event.target.closest('button') || event.isPrimary === false || this.preview.pointer || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      this.preview.beginDrag(event.pointerId, event.clientX);
      overlay.setPointerCapture(event.pointerId);
    });
    overlay.addEventListener('pointermove', event => {
      event.stopPropagation();
      this.preview?.drag(event.pointerId, event.clientX, overlay.clientWidth);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) overlay.addEventListener(name, event => {
      event.stopPropagation();
      this.preview?.endDrag(event.pointerId);
      if (overlay.hasPointerCapture(event.pointerId)) overlay.releasePointerCapture(event.pointerId);
    });
    overlay.addEventListener('click', event => event.stopPropagation());
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); this.closePreview(); }
      // The temporary dialog has one control; keep keyboard focus inside it.
      if (event.key === 'Tab') { event.preventDefault(); this.ui['preview-back'].focus(); }
    });
  }
  async openPreview() {
    if (this.sim.state !== 'ready' || this.previewVisible || this.contextLost) return;
    this.preview ??= new CharacterPreview(this.chibi ? chibiPreviewSource(this.chibi) : this.visuals.assets, this.visuals.definitions?.recruit);
    if (this.chibi && !this.preview.arcadeLit) { this.preview.arcadeLit = true; this.preview.scene.background.set('#5fb6d6'); const fill = new THREE.DirectionalLight('#ffffff', 1.6); fill.position.set(1, 3, -5); this.preview.scene.add(fill); }
    this.preview.reset(); this.preview.resize(this.camera.aspect);
    this.previewVisible = true; this.input.reset();
    this.ui.start.hidden = true; this.ui['soldier-preview'].hidden = false;
    this.ui['preview-status'].textContent = 'جارٍ تحميل المجسم';
    this.ui['preview-back'].focus({ preventScroll: true });
    try {
      await this.preview.load();
      if (this.previewVisible) this.ui['preview-status'].textContent = '';
    } catch (error) {
      if (this.previewVisible) this.ui['preview-status'].textContent = 'تعذّر تحميل المجسم. ارجع ثم حاول مرة أخرى.';
      console.warn('Soldier preview could not load', error);
    }
  }
  closePreview() {
    if (!this.previewVisible) return;
    const overlay = this.ui['soldier-preview'], pointer = this.preview.pointer;
    if (pointer && overlay.hasPointerCapture(pointer.id)) overlay.releasePointerCapture(pointer.id);
    this.preview.reset(); this.previewVisible = false; this.input.reset();
    overlay.hidden = true; this.ui.start.hidden = false;
    this.ui['preview-soldier'].focus({ preventScroll: true });
    this.loop.resetClock();
  }
  pause() { if (this.sim.state === 'playing') { this.sim.state = 'paused'; this.ui.paused.hidden = false; this.input.reset(); } }
  replay() {
    this.sim.reset(); this.effects.clear(); this.visuals.clear(); this.input.reset(); this.gateRenderer.reset(this.sim.gates.gates);
    this.cameraRig.reset(this.sim.army.depth); this.feedbackTimer = 0; this.lastCount = -1;
    this.ui.result.hidden = true; this.ui.paused.hidden = true; this.ui['boss-ui'].hidden = true; this.ui['gate-feedback'].classList.remove('show'); this.labels?.hide();
    this.startOrResume(); this.loop.resetClock();
  }
  gateFeedback(choice, added) {
    this.ui['gate-feedback'].textContent = choice.type.startsWith('army') ? (added ? `+${added}` : 'اكتمل الجيش') : gateLabel(choice);
    this.ui['gate-feedback'].classList.remove('show'); void this.ui['gate-feedback'].offsetWidth;
    this.ui['gate-feedback'].classList.add('show'); this.feedbackTimer = 1.2;
  }
  showResult(state) {
    this.ui.result.hidden = false; this.ui.hud.hidden = true; this.ui['boss-ui'].hidden = true; this.labels?.hide();
    this.ui.result.classList.toggle('defeat', state !== 'victory');
    this.ui['result-title'].textContent = state === 'victory' ? 'انتصار' : 'حاول مجددًا';
    this.ui['result-note'].textContent = state === 'victory' ? `حُرّر الحصن · ${this.sim.army.count} بطلًا` : 'اختر بوابات النمو لتقوية جيشك';
    this.input.reset();
  }
  render(dt, raw) {
    if (this.previewVisible) {
      this.preview.update(document.hidden ? 0 : dt);
      this.renderer.render(this.preview.scene, this.preview.camera);
      return;
    }
    const { army, stage } = this.sim;
    const animDt = this.sim.state === 'paused' ? 0 : dt; this.sceneTime += animDt;
    if (this.effects.takeShake) { const shake = this.effects.takeShake(); if (shake) this.cameraRig.kick(shake); }
    this.cameraRig.update(army, animDt, stage.enemies, this.sim.gates.gates);
    this.environment.update(army.center.z, this.sceneTime, this.scene.fog); this.gateRenderer.update(army.center.z, animDt);
    this.visuals.update(army.units, stage.enemies, this.sceneTime, animDt);
    this.effects.update(this.sim.projectiles.pool.active, army, stage.enemies, animDt, this.sceneTime, this.camera);
    if (this.sun) { this.sun.target.position.set(0, 0, -army.center.z - 6); this.sun.position.set(-9, 22, -army.center.z + 6); }
    if (this.feedbackTimer > 0) { this.feedbackTimer -= animDt; if (this.feedbackTimer <= 0) this.ui['gate-feedback'].classList.remove('show'); }
    this.renderer.render(this.scene, this.camera);
    if (this.labels && !this.ui.hud.hidden) this.labels.update(this.sim, this.ui.game.clientWidth, this.ui.game.clientHeight);
    if (!document.hidden && this.sim.state === 'playing') this.performance.update(raw);
    this.uiTimer -= dt;
    if (this.uiTimer <= 0) { this.updateUI(); this.uiTimer = 0.12; }
  }
  updateUI() {
    const { army, stage } = this.sim;
    if (army.count !== this.lastCount) { this.ui['army-count'].textContent = army.count; this.lastCount = army.count; }
    this.ui.progress.style.transform = `scaleX(${Math.min(1, army.center.z / this.sim.data.length)})`;
    const boss = stage.enemies.find(unit => unit.type === 'giantBoss' && unit.alive);
    this.ui['boss-ui'].hidden = !boss || this.sim.state !== 'playing' || this.profile.arcade;
    if (boss) this.ui['boss-health'].style.transform = `scaleX(${boss.health / boss.maxHealth})`;
    if (this.debug) this.ui.debug.textContent = [
      `Build ${RELEASE || 'dev'}`,
      `Look ${this.profile.arcade ? 'arcade' : this.profile.quality ? 'quality study' : 'original'} · MSAA ${this.renderer.getContext().getContextAttributes()?.antialias ? 'on' : 'off'}`,
      `FPS ${Math.round(this.performance.fps)} · DPR ${this.performance.dpr.toFixed(2)}`,
      `Player ${army.count} · Enemy ${stage.enemies.length} · Peak ${this.sim.peakArmy}`,
      `Projectiles ${this.sim.projectiles.pool.active.length} · Peak ${this.sim.projectiles.pool.peak} · Misses ${this.sim.projectiles.pool.misses}`,
      `Draw calls ${this.renderer.info.render.calls} · Triangles ${this.renderer.info.render.triangles}`,
      `${this.sim.state} · x ${army.center.x.toFixed(2)} · z ${army.center.z.toFixed(1)} · ${this.sim.time.toFixed(1)}s`,
      `Gates ${this.sim.gates.gates.filter(gate => gate.used).length}/${this.sim.gates.gates.length} · Encounters ${stage.cleared.length}/${stage.events.length}`,
      `Models ${[...this.visuals.batches.values()].filter(b => b.custom).length}/6 · Frame p95 ${this.performance.p95.toFixed(1)}ms`,
    ].join('\n');
  }
}
