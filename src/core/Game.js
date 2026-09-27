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
import { clamp } from './Config.js';
export class Game {
  constructor() {
    const $ = id => document.getElementById(id);
    this.ui = Object.fromEntries(['game', 'scene', 'hud', 'start', 'result', 'result-title', 'result-note', 'army-count', 'progress', 'pause', 'paused', 'replay', 'boss-ui', 'boss-health', 'gate-feedback', 'debug'].map(id => [id, $(id)]));
    this.debug = new URLSearchParams(location.search).get('debug') === '1';
    if (this.debug && new URLSearchParams(location.search).get('portrait') === '1') document.body.classList.add('dev-portrait');
    this.ui.debug.hidden = !this.debug;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.ui.scene, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.performance = new PerformanceManager(this.renderer);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#d3b88f'); this.scene.fog = new THREE.Fog('#d3b88f', 42, 102);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 160);
    this.scene.add(new THREE.HemisphereLight('#fff4de', '#917e60', 2.2));
    const sunlight = new THREE.DirectionalLight('#fff3d3', 2.0); sunlight.position.set(-14, 24, 8); this.scene.add(sunlight);
    this.effects = new EffectsRenderer(this.scene);
    this.sim = new Simulation({ onGate: (gate, choice, added) => this.gateFeedback(choice, added), onHit: (unit, died) => { this.effects.hit(unit, died); if (died) this.visuals.die(unit); }, onFinish: state => this.showResult(state) });
    this.visuals = new CharacterVisualFactory(this.scene);
    this.environment = new EnvironmentFactory(this.scene, this.sim.data.length);
    this.gateRenderer = new GateRenderer(this.scene, this.sim.gates.gates);
    this.cameraRig = new CameraRig(this.camera); this.cameraRig.reset(this.sim.army.depth); this.feedbackTimer = 0; this.uiTimer = 0; this.sceneTime = 0; this.lastCount = -1;
    this.input = new InputSystem(this.ui.game, () => this.startOrResume(), x => {
      if (this.sim.state === 'playing') this.sim.army.targetX = clamp(x, -this.sim.army.limit, this.sim.army.limit);
      return this.sim.army.targetX;
    }, () => this.sim.army.targetX);
    this.ui.pause.addEventListener('click', () => this.pause());
    this.ui.replay.addEventListener('click', event => { event.stopPropagation(); this.replay(); });
    this.ui.paused.addEventListener('click', () => this.startOrResume());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); this.loop.resetClock(); });
    window.addEventListener('blur', () => this.pause());
    window.addEventListener('resize', () => this.resize());
    this.contextLost = false;
    this.ui.scene.addEventListener('webglcontextlost', event => { event.preventDefault(); this.contextLost = true; this.pause(); this.ui.paused.querySelector('p').textContent = 'توقف العرض مؤقتًا'; });
    this.ui.scene.addEventListener('webglcontextrestored', () => { this.contextLost = false; this.loop.resetClock(); this.ui.paused.querySelector('p').textContent = 'المس للمتابعة'; });
    this.resize(); this.loop = new GameLoop(dt => this.sim.update(dt), (dt, raw) => this.render(dt, raw));
    $('load-status').textContent = 'المس للبدء'; $('load-line').hidden = true;
    this.loop.start();
  }
  resize() {
    const rect = this.ui.game.getBoundingClientRect(); this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / Math.max(1, rect.height); this.camera.updateProjectionMatrix();
  }
  startOrResume() {
    if (this.contextLost) return;
    if (this.sim.state === 'ready') { this.sim.start(); this.ui.start.hidden = true; this.ui.hud.hidden = false; }
    else if (this.sim.state === 'paused') { this.sim.state = 'playing'; this.ui.paused.hidden = true; this.loop.resetClock(); }
  }
  pause() { if (this.sim.state === 'playing') { this.sim.state = 'paused'; this.ui.paused.hidden = false; this.input.reset(); } }
  replay() {
    this.sim.reset(); this.effects.clear(); this.visuals.clear(); this.input.reset(); this.gateRenderer.reset(this.sim.gates.gates);
    this.cameraRig.reset(this.sim.army.depth); this.feedbackTimer = 0; this.lastCount = -1;
    this.ui.result.hidden = true; this.ui.paused.hidden = true; this.ui['boss-ui'].hidden = true; this.ui['gate-feedback'].classList.remove('show');
    this.startOrResume(); this.loop.resetClock();
  }
  gateFeedback(choice, added) {
    this.ui['gate-feedback'].textContent = choice.type.startsWith('army') ? (added ? `+${added}` : 'اكتمل الجيش') : gateLabel(choice);
    this.ui['gate-feedback'].classList.add('show'); this.feedbackTimer = 1.2;
  }
  showResult(state) {
    this.ui.result.hidden = false; this.ui.hud.hidden = true; this.ui['boss-ui'].hidden = true;
    this.ui['result-title'].textContent = state === 'victory' ? 'انتصار' : 'حاول مجددًا';
    this.ui['result-note'].textContent = state === 'victory' ? `حُرّر الحصن · ${this.sim.army.count} بطلًا` : 'اختر بوابات النمو لتقوية جيشك';
    this.input.reset();
  }
  render(dt, raw) {
    const { army, stage } = this.sim;
    const animDt = this.sim.state === 'paused' ? 0 : dt; this.sceneTime += animDt;
    this.cameraRig.update(army, animDt);
    this.environment.update(army.center.z); this.gateRenderer.update(army.center.z);
    this.visuals.update(army.units, stage.enemies, this.sceneTime, animDt);
    this.effects.update(this.sim.projectiles.pool.active, army, stage.enemies, animDt, this.sceneTime);
    if (this.feedbackTimer > 0) { this.feedbackTimer -= animDt; if (this.feedbackTimer <= 0) this.ui['gate-feedback'].classList.remove('show'); }
    this.renderer.render(this.scene, this.camera);
    if (!document.hidden && this.sim.state === 'playing') this.performance.update(raw);
    this.uiTimer -= dt;
    if (this.uiTimer <= 0) { this.updateUI(); this.uiTimer = 0.12; }
  }
  updateUI() {
    const { army, stage } = this.sim;
    if (army.count !== this.lastCount) { this.ui['army-count'].textContent = army.count; this.lastCount = army.count; }
    this.ui.progress.style.transform = `scaleX(${Math.min(1, army.center.z / this.sim.data.length)})`;
    const boss = stage.enemies.find(unit => unit.type === 'giantBoss' && unit.alive);
    this.ui['boss-ui'].hidden = !boss || this.sim.state !== 'playing';
    if (boss) this.ui['boss-health'].style.transform = `scaleX(${boss.health / boss.maxHealth})`;
    if (this.debug) this.ui.debug.textContent = [
      `Build ${RELEASE || 'dev'}`,
      `FPS ${Math.round(this.performance.fps)} · DPR ${this.performance.dpr.toFixed(2)}`,
      `Player ${army.count} · Enemy ${stage.enemies.length} · Peak ${this.sim.peakArmy}`,
      `Projectiles ${this.sim.projectiles.pool.active.length} · Peak ${this.sim.projectiles.pool.peak} · Misses ${this.sim.projectiles.pool.misses}`,
      `Draw calls ${this.renderer.info.render.calls} · Triangles ${this.renderer.info.render.triangles}`,
      `${this.sim.state} · x ${army.center.x.toFixed(2)} · z ${army.center.z.toFixed(1)} · ${this.sim.time.toFixed(1)}s`,
      `Gates ${this.sim.gates.gates.filter(gate => gate.used).length}/${this.sim.gates.gates.length} · Encounters ${stage.cleared.length}/${stage.events.length}`,
      `GLB ${[...this.visuals.batches.values()].filter(b => b.custom).length}/6 · Frame p95 ${this.performance.p95.toFixed(1)}ms`,
    ].join('\n');
  }
}
