import * as THREE from 'three';
import { RELEASE } from './release.js';
import { GameLoop } from './GameLoop.js';
import { PerformanceManager } from './PerformanceManager.js';
import { DefenseSimulation } from './DefenseSimulation.js';
import { Progress } from './Progress.js';
import { InputSystem } from '../systems/InputSystem.js';
import { CharacterVisualFactory } from '../rendering/CharacterVisualFactory.js';
import { ChibiFactory } from '../rendering/ChibiFactory.js';
import { ArcadeEnvironment } from '../rendering/ArcadeEnvironment.js';
import { ArcadeEffects } from '../rendering/ArcadeEffects.js';
import { ArcadeCameraRig } from '../rendering/ArcadeCameraRig.js';
import { DefenseProps, choiceLabel } from '../rendering/DefenseProps.js';
import { WorldLabels } from '../rendering/WorldLabels.js';
import { ARCADE_CHARACTERS } from '../rendering/VisualProfiles.js';
import { DEFENSE_STAGES } from '../data/defenseStages.js';
import { UPGRADES } from '../data/upgrades.js';
import { clamp } from './Config.js';

const ICONS = { soldiers: '🛡️', damage: '🏹', fireRate: '⚡', fort: '🏰' };
const AR_DIGITS = ['١', '٢', '٣', '٤', '٥'];

// Mob-Control style mode: the army holds the line and only slides left/right while
// hordes, gates and barrels come to it. Coins buy permanent upgrades between stages.
export class DefenseGame {
  constructor() {
    const $ = id => document.getElementById(id);
    this.ui = Object.fromEntries(['game', 'scene', 'hud', 'start', 'result', 'result-title', 'result-note', 'result-coins', 'army-count', 'progress', 'pause', 'paused', 'replay', 'gate-feedback', 'debug',
      'army-tag', 'giant-tag', 'horde-tag', 'base-meter', 'base-hp', 'stage-label', 'defense-menu', 'menu-coins', 'stage-picker', 'open-upgrades', 'upgrades', 'upgrade-coins', 'upgrade-list',
      'close-upgrades', 'result-upgrades', 'next-stage', 'breach-flash', 'barrel-tags', 'load-status', 'load-line'].map(id => [id, $(id)]));
    this.debug = new URLSearchParams(location.search).get('debug') === '1';
    this.ui.debug.hidden = !this.debug;
    document.body.classList.add('arcade', 'defense');
    this.progress = new Progress();
    this.stageId = this.progress.data.stage;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.ui.scene, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.performance = new PerformanceManager(this.renderer);
    const sky = '#7fcbe6';
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(sky); this.scene.fog = new THREE.Fog(sky, 60, 130);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.scene.add(new THREE.HemisphereLight('#fdfbf5', '#8d8a80', 1.15));
    const sun = new THREE.DirectionalLight('#fff0d6', 3.1); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.04;
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 34, bottom: -24, near: 1, far: 80 }); sun.shadow.camera.updateProjectionMatrix();
    sun.position.set(-9, 22, 2); sun.target.position.set(0, 0, -14); this.scene.add(sun, sun.target);

    this.chibi = new ChibiFactory();
    this.visuals = new CharacterVisualFactory(this.scene, { definitions: ARCADE_CHARACTERS, procedural: this.chibi });
    this.environment = new ArcadeEnvironment(this.scene, 52);
    this.effects = new ArcadeEffects(this.scene);
    this.props = new DefenseProps(this.scene, this.chibi.model('recruit').frames[0].parts);
    this.cameraRig = new ArcadeCameraRig(this.camera, { ahead: 12 });
    this.labels = new WorldLabels(this.camera, { army: this.ui['army-tag'], giant: this.ui['giant-tag'] });
    this.barrelTags = [];

    this.sim = new DefenseSimulation({
      onHit: (unit, died) => { this.effects.hit(unit, died); if (died && !unit.isProp) this.visuals.die(unit); },
      onGate: (row, choice, added) => this.feedback(choice.type.startsWith('army') ? (added >= 0 ? `+${added}` : `${added}`) : choiceLabel(choice), added < 0),
      onBarrel: (barrel, added) => this.feedback(barrel.reward.type === 'army_add' ? `+${added}` : choiceLabel(barrel.reward)),
      onBreach: () => this.breach(),
      onFinish: state => this.finish(state),
    }, this.stage, this.progress.levels);
    this.cameraRig.reset(this.sim.army.depth);
    this.sceneTime = 0; this.uiTimer = 0; this.feedbackTimer = 0; this.lastCount = -1; this.lastBase = -1;

    this.input = new InputSystem(this.ui.game, () => this.startOrResume(), x => {
      if (this.sim.state === 'playing') this.sim.army.targetX = clamp(x, -this.sim.army.limit, this.sim.army.limit);
      return this.sim.army.targetX;
    }, () => this.sim.army.targetX);
    const click = (id, handler) => this.ui[id].addEventListener('click', event => { event.stopPropagation(); handler(); });
    click('pause', () => this.pause());
    click('replay', () => this.restart(this.stageId));
    click('next-stage', () => this.restart(Math.min(DEFENSE_STAGES.length, this.stageId + 1)));
    click('open-upgrades', () => this.openUpgrades());
    click('result-upgrades', () => this.openUpgrades());
    click('close-upgrades', () => this.closeUpgrades());
    this.ui.paused.addEventListener('click', () => this.startOrResume());
    this.ui.upgrades.addEventListener('pointerdown', event => event.stopPropagation());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); this.loop.resetClock(); });
    window.addEventListener('blur', () => this.pause());
    window.addEventListener('resize', () => this.resize());
    this.ui.scene.addEventListener('webglcontextlost', event => { event.preventDefault(); this.pause(); });

    this.ui['defense-menu'].hidden = false;
    this.ui['load-status'].textContent = 'المس للبدء'; this.ui['load-line'].hidden = true;
    this.ui.start.querySelector('.start-prompt > span').textContent = 'اسحب يمينًا ويسارًا • احمِ القلعة';
    this.renderMenu();
    this.resize(); this.loop = new GameLoop(dt => this.sim.update(dt), (dt, raw) => this.render(dt, raw)); this.loop.start();
  }
  get stage() { return DEFENSE_STAGES[this.stageId - 1]; }
  resize() {
    const rect = this.ui.game.getBoundingClientRect(); this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / Math.max(1, rect.height); this.camera.updateProjectionMatrix();
  }
  startOrResume() {
    if (!this.ui.upgrades.hidden) return;
    if (this.sim.state === 'ready' && !this.ui.start.hidden) { this.sim.start(); this.ui.start.hidden = true; this.ui.hud.hidden = false; this.ui['base-meter'].hidden = false; }
    else if (this.sim.state === 'paused') { this.sim.state = 'playing'; this.ui.paused.hidden = true; this.loop.resetClock(); }
  }
  pause() { if (this.sim.state === 'playing') { this.sim.state = 'paused'; this.ui.paused.hidden = false; this.input.reset(); } }
  // Rebuild the stage (also applies newly bought upgrades) and return to the start screen.
  restart(stageId, autoStart = true) {
    this.stageId = stageId; this.progress.select(stageId);
    this.sim.reset(this.stage, this.progress.levels);
    this.effects.clear(); this.visuals.clear(); this.props.clear(); this.input.reset(); this.labels.hide();
    for (const tag of this.barrelTags) tag.hidden = true;
    this.cameraRig.reset(this.sim.army.depth); this.lastCount = -1; this.lastBase = -1;
    this.ui.result.hidden = true; this.ui.paused.hidden = true; this.ui['gate-feedback'].classList.remove('show');
    this.renderMenu();
    if (autoStart) { this.ui.start.hidden = false; this.startOrResume(); } else { this.ui.start.hidden = false; this.ui.hud.hidden = true; }
    this.loop.resetClock();
  }
  renderMenu() {
    const picker = this.ui['stage-picker']; picker.textContent = '';
    DEFENSE_STAGES.forEach((stage, i) => {
      const button = document.createElement('button'); button.type = 'button';
      const locked = stage.id > this.progress.data.unlocked;
      button.textContent = locked ? '🔒' : String(stage.id); button.disabled = locked;
      button.setAttribute('aria-pressed', String(stage.id === this.stageId)); button.setAttribute('aria-label', `المرحلة ${stage.id}: ${stage.name}${locked ? ' (مقفلة)' : ''}`);
      button.addEventListener('click', event => { event.stopPropagation(); this.restart(stage.id, false); });
      picker.append(button);
    });
    this.ui['menu-coins'].textContent = this.progress.coins;
    this.ui["stage-label"].textContent = `المرحلة ${AR_DIGITS[this.stageId - 1]}`;
  }
  openUpgrades() { this.ui.upgrades.hidden = false; this.renderUpgrades(); this.ui['close-upgrades'].focus({ preventScroll: true }); }
  closeUpgrades() {
    this.ui.upgrades.hidden = true;
    // New levels apply from the next start; a waiting stage is rebuilt immediately.
    if (this.sim.state === 'ready') this.restart(this.stageId, false);
    this.renderMenu();
  }
  renderUpgrades() {
    const list = this.ui['upgrade-list']; list.textContent = '';
    this.ui['upgrade-coins'].textContent = this.progress.coins;
    for (const upgrade of UPGRADES) {
      const level = this.progress.levels[upgrade.id], cost = this.progress.cost(upgrade.id);
      const card = document.createElement('div'); card.className = 'upgrade-card';
      card.innerHTML = `<span class="icon" aria-hidden="true">${ICONS[upgrade.id]}</span><h3></h3><span class="lvl">LV ${level}/${upgrade.max}</span><span class="gain"></span>`;
      card.querySelector('h3').textContent = upgrade.name;
      card.querySelector('.gain').textContent = cost === null ? 'الحد الأقصى' : `التالي: ${upgrade.detail(level + 1)}`;
      const button = document.createElement('button'); button.type = 'button';
      button.innerHTML = cost === null ? 'MAX' : `<i class="coin" aria-hidden="true"></i><span>${cost}</span>`;
      button.disabled = cost === null || cost > this.progress.coins;
      button.addEventListener('click', event => { event.stopPropagation(); if (this.progress.buy(upgrade.id)) this.renderUpgrades(); });
      card.append(button); list.append(card);
    }
  }
  feedback(text, bad = false) {
    const el = this.ui['gate-feedback'];
    el.textContent = text; el.classList.toggle('bad', bad);
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); this.feedbackTimer = 1.2;
  }
  breach() {
    this.ui['breach-flash'].classList.add('on'); clearTimeout(this.breachTimer);
    this.breachTimer = setTimeout(() => this.ui['breach-flash'].classList.remove('on'), 90);
    const meter = this.ui['base-meter']; meter.classList.remove('hurt'); void meter.offsetWidth; meter.classList.add('hurt');
  }
  finish(state) {
    const victory = state === 'victory', earned = this.sim.coins;
    this.progress.earn(earned);
    if (victory) this.progress.complete(this.stageId, DEFENSE_STAGES.length);
    this.input.reset(); this.labels.hide(); for (const tag of this.barrelTags) tag.hidden = true;
    this.ui.hud.hidden = true; this.ui.result.hidden = false; this.ui.result.classList.toggle('defeat', !victory);
    const last = this.stageId === DEFENSE_STAGES.length;
    this.ui['result-title'].textContent = victory ? (last ? 'سقط الحصن!' : 'انتصار') : this.sim.base.hp <= 0 ? 'سقطت القلعة' : 'هُزم الجيش';
    this.ui['result-note'].textContent = victory ? `${this.stage.name} · بقي ${this.sim.army.count} جنديًا` : 'طوّر جيشك ثم حاول مجددًا';
    this.ui['result-coins'].hidden = false; this.ui['result-coins'].querySelector('b').textContent = `+${earned}`;
    this.ui['next-stage'].hidden = !victory || last;
    this.ui['result-upgrades'].hidden = false;
    this.ui.replay.textContent = victory ? 'إعادة' : 'حاول مجددًا';
  }
  barrelTag(i) {
    if (!this.barrelTags[i]) {
      const el = document.createElement('div'); el.className = 'world-tag'; el.hidden = true; el.innerHTML = '<b></b><small></small>';
      this.ui['barrel-tags'].append(el); this.barrelTags[i] = el; this.labels.el[`barrel${i}`] = el;
    }
    return this.barrelTags[i];
  }
  updateLabels(width, height) {
    const { army } = this.sim;
    if (this.sim.state !== 'playing' && this.sim.state !== 'paused') return;
    this.labels.place('army', army.center.x, 2.2, 0.5, width, height, String(army.count));
    const giant = this.sim.enemies.find(unit => unit.aiState && unit.alive);
    if (giant) {
      this.labels.place('giant', giant.x, giant.type === 'giantBoss' ? 6.2 : 3.8, -giant.z, width, height, String(Math.ceil(giant.health)));
      this.ui['giant-tag'].querySelector('i').style.transform = `scaleX(${(giant.health / giant.maxHealth).toFixed(3)})`;
    } else this.ui['giant-tag'].hidden = true;
    let i = 0;
    for (const barrel of this.sim.barrels) {
      if (!barrel.alive) continue;
      const tag = this.barrelTag(i);
      this.labels.place(`barrel${i}`, barrel.x, 2.6, -barrel.z, width, height, String(Math.ceil(barrel.health)));
      const reward = barrel.reward.type === 'army_add' ? `+${barrel.reward.value} جنود` : choiceLabel(barrel.reward);
      const small = tag.querySelector('small'); if (small.textContent !== reward) small.textContent = reward;
      i++;
    }
    for (; i < this.barrelTags.length; i++) this.barrelTags[i].hidden = true;
  }
  render(dt, raw) {
    const { army } = this.sim;
    const animDt = this.sim.state === 'paused' ? 0 : dt; this.sceneTime += animDt;
    const shake = this.effects.takeShake(); if (shake) this.cameraRig.kick(shake);
    this.cameraRig.update(army, animDt, this.sim.enemies);
    this.environment.update(0, this.sceneTime, this.scene.fog);
    this.props.update(this.sim, animDt);
    this.visuals.update(army.units, this.sim.enemies, this.sceneTime, animDt);
    this.effects.update(this.sim.projectiles.pool.active, army, this.sim.enemies, animDt, this.sceneTime, this.camera);
    if (this.feedbackTimer > 0) { this.feedbackTimer -= animDt; if (this.feedbackTimer <= 0) this.ui['gate-feedback'].classList.remove('show'); }
    this.renderer.render(this.scene, this.camera);
    if (!this.ui.hud.hidden) this.updateLabels(this.ui.game.clientWidth, this.ui.game.clientHeight);
    if (!document.hidden && this.sim.state === 'playing') this.performance.update(raw);
    this.uiTimer -= dt;
    if (this.uiTimer <= 0) { this.updateUI(); this.uiTimer = 0.1; }
  }
  updateUI() {
    const { army, base } = this.sim;
    if (army.count !== this.lastCount) { this.ui['army-count'].textContent = army.count; this.lastCount = army.count; }
    if (base.hp !== this.lastBase) { this.ui['base-hp'].textContent = base.hp; this.lastBase = base.hp; }
    this.ui.progress.style.transform = `scaleX(${this.sim.progress.toFixed(3)})`;
    if (this.debug) this.ui.debug.textContent = [
      `Build ${RELEASE || 'dev'} · defence stage ${this.stageId}`,
      `FPS ${Math.round(this.performance.fps)} · DPR ${this.performance.dpr.toFixed(2)} · p95 ${this.performance.p95.toFixed(1)}ms`,
      `Player ${army.count} · Enemy ${this.sim.enemies.length} · Base ${base.hp}/${base.maxHp}`,
      `Projectiles ${this.sim.projectiles.pool.active.length} · Misses ${this.sim.projectiles.pool.misses}`,
      `Draw calls ${this.renderer.info.render.calls} · Triangles ${this.renderer.info.render.triangles}`,
      `${this.sim.state} · ${this.sim.time.toFixed(1)}s · coins ${this.sim.coins} · bank ${this.progress.coins}`,
    ].join('\n');
  }
}
