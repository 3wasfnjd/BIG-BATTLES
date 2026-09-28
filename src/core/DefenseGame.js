import * as THREE from 'three';
import { RELEASE } from './release.js';
import { GameLoop } from './GameLoop.js';
import { PerformanceManager } from './PerformanceManager.js';
import { DefenseSimulation } from './DefenseSimulation.js';
import { Progress, starsFor } from './Progress.js';
import { InputSystem } from '../systems/InputSystem.js';
import { CharacterVisualFactory } from '../rendering/CharacterVisualFactory.js';
import { ChibiFactory } from '../rendering/ChibiFactory.js';
import { ThemedEnvironment, THEMES, STAGE_THEME } from '../rendering/StageThemes.js';
import { ArcadeEffects } from '../rendering/ArcadeEffects.js';
import { ArcadeCameraRig } from '../rendering/ArcadeCameraRig.js';
import { DefenseProps, choiceLabel, POWER_LABELS } from '../rendering/DefenseProps.js';
import { WorldLabels } from '../rendering/WorldLabels.js';
import { ARCADE_CHARACTERS } from '../rendering/VisualProfiles.js';
import { DEFENSE_STAGES } from '../data/defenseStages.js';
import { UPGRADES } from '../data/upgrades.js';
import { WEAPON_KINDS } from '../data/weaponKinds.js';
import { clamp } from './Config.js';
import { GameAudio } from './Audio.js';
import { COIN_VALUE, ENERGY_MAX } from './DefenseSimulation.js';

const ICONS = { soldiers: '🛡️', damage: '🏹', fireRate: '⚡', fort: '🏰' };
const AR_DIGITS = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

// Mob-Control style mode: the army holds the line and only slides left/right while
// hordes, gates and barrels come to it. Coins buy permanent upgrades between stages.
export class DefenseGame {
  constructor() {
    const $ = id => document.getElementById(id);
    this.ui = Object.fromEntries(['game', 'scene', 'hud', 'start', 'result', 'result-title', 'result-note', 'result-coins', 'army-count', 'progress', 'pause', 'paused', 'replay', 'gate-feedback', 'debug',
      'army-tag', 'giant-tag', 'horde-tag', 'base-meter', 'base-hp', 'stage-label', 'defense-menu', 'menu-coins', 'stage-picker', 'open-upgrades', 'upgrades', 'upgrade-coins', 'upgrade-list',
      'close-upgrades', 'result-upgrades', 'next-stage', 'breach-flash', 'barrel-tags', 'load-status', 'load-line', 'float-layer', 'banner', 'confetti', 'lightning', 'sound', 'menu-sound', 'frost', 'powers', 'combo', 'rain-btn', 'result-stars', 'daily-gift'].map(id => [id, $(id)]));
    this.debug = new URLSearchParams(location.search).get('debug') === '1';
    this.ui.debug.hidden = !this.debug;
    document.body.classList.add('arcade', 'defense');
    this.progress = new Progress(); this.audio = new GameAudio(); this.lastShots = 0;
    this.stageId = this.progress.data.stage;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.ui.scene, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.performance = new PerformanceManager(this.renderer);
    const sky = '#7fcbe6';
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(sky); this.scene.fog = new THREE.Fog(sky, 60, 130);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.hemi = new THREE.HemisphereLight('#fdfbf5', '#8d8a80', 1.15); this.scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight('#fff0d6', 3.1); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.04;
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 34, bottom: -24, near: 1, far: 80 }); sun.shadow.camera.updateProjectionMatrix();
    sun.position.set(-9, 22, 2); sun.target.position.set(0, 0, -14); this.scene.add(sun, sun.target);

    this.chibi = new ChibiFactory();
    this.visuals = new CharacterVisualFactory(this.scene, { definitions: ARCADE_CHARACTERS, procedural: this.chibi });
    this.applyTheme();
    this.effects = new ArcadeEffects(this.scene);
    this.props = new DefenseProps(this.scene, this.chibi.model('recruit').frames[0].parts);
    this.cameraRig = new ArcadeCameraRig(this.camera, { ahead: 11, fixed: true });
    this.labels = new WorldLabels(this.camera, { army: this.ui['army-tag'], giant: this.ui['giant-tag'] });
    this.barrelTags = []; this.floats = []; this.floatVector = new THREE.Vector3(); this.giantDamage = new Map();
    // Glowing command ring under the commander.
    this.commandRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.commandRing.renderOrder = 1; this.scene.add(this.commandRing);
    // Shield power: a glowing dome over the army.
    this.shieldDome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#6ff0ff', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
    this.shieldDome.visible = false; this.scene.add(this.shieldDome);
    this.freezeTint = new THREE.Color(0.55, 0.8, 1.35);

    this.sim = new DefenseSimulation({
      onHit: (unit, died) => {
        this.effects.hit(unit, died); if (died && !unit.isProp) this.visuals.die(unit);
        if (unit.team === 'player') this.audio.hit(); else if (!unit.isProp) died ? this.audio.kill() : this.audio.hit();
        if (died && unit.type === 'barrel') this.audio.barrel();
        // Coin pops: every giant, brutes at most a few per second so big fights stay readable.
        if (died && unit.team === 'enemy' && COIN_VALUE[unit.type] >= 4 && (unit.aiState || this.sceneTime - (this.lastCoinPop || -1) > 0.3)) { this.lastCoinPop = this.sceneTime; this.floatText(`+${this.sim.coinValue(unit)}`, unit.x, unit.aiState ? 3 : 1.6, unit.z, 'coin'); this.audio.coin(); }
      },
      onSpawn: event => this.announce(event),
      onRain: x => { this.effects.rain(x); this.audio.rainStart(); },
      onRainImpact: () => { this.cameraRig.kick(0.6); this.audio.rainImpact(); },
      onLightning: points => { this.effects.lightning(points); this.audio.thunder(true); },
      onCombo: (count, bonus) => this.showCombo(count, bonus),
      onSplash: (x, z, kind) => { this.effects.explosion(x, z, kind); this.audio.blast(kind); },
      onWeapon: kind => { this.visuals.setWeapon(kind); this.banner(`${WEAPON_KINDS[kind].icon} ${WEAPON_KINDS[kind].name}`, 'سلاح جديد لكل الجيش!', 'weapon'); this.audio.power('weapon'); },
      onClash: (enemy, trade) => { this.effects.clash(enemy.x, Math.max(0.2, enemy.z), trade > 1); this.audio.clash(trade > 1); },
      onGate: (row, choice, added) => this.gateSound(added, choice) || this.feedback(choice.type.startsWith('army') ? (added >= 0 ? `+${added}` : `${added}`) : choiceLabel(choice), added < 0),
      onBarrel: (barrel, added) => { const r = barrel.reward; this.feedback(r.type === 'army_add' ? `+${added}` : r.type === 'coins' ? `💰 +${Math.round(r.value * (this.stage.coinScale || 1))}` : choiceLabel(r)); if (r.type === 'power' || r.type === 'coins') this.audio.power(r.value); },
      onBreach: () => { this.breach(); this.audio.breach(); },
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
    click('rain-btn', () => this.sim.useRain());
    click('daily-gift', () => this.claimDaily());
    for (const id of ['sound', 'menu-sound']) click(id, () => { this.audio.toggle(); this.syncSound(); });
    this.syncSound();
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
  // Each stage has its own world: sky, fog, lights, ground, scenery and particles.
  applyTheme() {
    const name = STAGE_THEME[(this.stageId - 1) % STAGE_THEME.length];
    if (this.themeName === name) return;
    this.themeName = name; const theme = THEMES[name];
    this.environment?.dispose();
    this.environment = new ThemedEnvironment(this.scene, 52, name);
    this.scene.background.set(theme.sky); this.scene.fog.color.set(theme.sky); [this.scene.fog.near, this.scene.fog.far] = theme.fog;
    this.hemi.color.set(theme.hemi[0]); this.hemi.groundColor.set(theme.hemi[1]); this.hemi.intensity = theme.hemi[2];
    this.sun.color.set(theme.sun[0]); this.sun.intensity = theme.sun[1];
    this.renderer.toneMappingExposure = theme.exposure; this.theme = theme; this.lightning = { next: 3, flash: 0 };
    document.body.dataset.theme = name; document.documentElement.style.setProperty('--vignette', theme.vignette);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme.sky);
  }
  resize() {
    const rect = this.ui.game.getBoundingClientRect(); this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / Math.max(1, rect.height); this.camera.updateProjectionMatrix();
  }
  startOrResume() {
    if (!this.ui.upgrades.hidden) return;
    this.audio.unlock();
    if (this.sim.state === 'ready' && !this.ui.start.hidden) { this.sim.start(); this.ui.start.hidden = true; this.ui.hud.hidden = false; this.ui['base-meter'].hidden = false; this.ui['rain-btn'].hidden = false; this.banner(`المرحلة ${AR_DIGITS[this.stageId - 1]}`, this.stage.name, 'stage'); }
    else if (this.sim.state === 'paused') { this.sim.state = 'playing'; this.ui.paused.hidden = true; this.loop.resetClock(); this.audio.setMode('battle'); }
  }
  pause() { if (this.sim.state === 'playing') { this.sim.state = 'paused'; this.ui.paused.hidden = false; this.input.reset(); this.audio.setMode('paused'); } }
  syncSound() { for (const id of ['sound', 'menu-sound']) { this.ui[id].textContent = this.audio.muted ? '🔇' : '🔊'; this.ui[id].setAttribute('aria-pressed', String(!this.audio.muted)); } }
  gateSound(added, choice) { this.audio.gate(!(added < 0)); return false; }
  // Rebuild the stage (also applies newly bought upgrades) and return to the start screen.
  restart(stageId, autoStart = true) {
    this.stageId = stageId; this.progress.select(stageId); this.applyTheme();
    this.sim.reset(this.stage, this.progress.levels);
    this.effects.clear(); this.visuals.clear(); this.props.clear(); this.input.reset(); this.labels.hide();
    for (const tag of this.barrelTags) tag.hidden = true;
    this.cameraRig.reset(this.sim.army.depth); this.lastCount = -1; this.lastBase = -1;
    this.ui.result.hidden = true; this.ui.paused.hidden = true; this.ui['gate-feedback'].classList.remove('show');
    this.renderMenu();
    this.giantDamage.clear(); this.visuals.setWeapon('crossbow'); this.ui['rain-btn'].hidden = true; this.ui.frost.classList.remove('on'); this.ui.powers.textContent = ''; this.lastPowers = ''; this.archerWarned = false; this.lastShots = 0; this.audio.setMode('menu', 0); for (const f of this.floats) f.el.hidden = true; this.ui.confetti.textContent = '';
    if (autoStart) { this.ui.start.hidden = false; this.startOrResume(); } else { this.ui.start.hidden = false; this.ui.hud.hidden = true; }
    this.loop.resetClock();
  }
  renderMenu() {
    const picker = this.ui['stage-picker']; picker.textContent = '';
    DEFENSE_STAGES.forEach((stage, i) => {
      const button = document.createElement('button'); button.type = 'button';
      const locked = stage.id > this.progress.data.unlocked;
      button.textContent = locked ? '🔒' : String(stage.id); button.disabled = locked;
      if (!locked) { const stars = document.createElement('small'); stars.textContent = '★'.repeat(this.progress.stars(stage.id)) || '·'; button.append(stars); }
      button.setAttribute('aria-pressed', String(stage.id === this.stageId)); button.setAttribute('aria-label', `المرحلة ${stage.id}: ${stage.name}${locked ? ' (مقفلة)' : ''}`);
      button.addEventListener('click', event => { event.stopPropagation(); this.restart(stage.id, false); });
      picker.append(button);
    });
    this.ui['menu-coins'].textContent = this.progress.coins;
    this.ui['daily-gift'].hidden = !this.progress.dailyAvailable(this.today());
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
    const victory = state === 'victory', stars = victory ? starsFor(this.sim.base.hp, this.sim.base.maxHp) : 0;
    this.progress.earn(this.sim.coins);
    const starBonus = victory ? this.progress.complete(this.stageId, DEFENSE_STAGES.length, stars).bonus : 0, earned = this.sim.coins + starBonus;
    this.ui['rain-btn'].hidden = true; this.ui.frost.classList.remove('on'); this.ui.powers.textContent = '';
    const starBox = this.ui['result-stars']; starBox.hidden = !victory; starBox.innerHTML = [1, 2, 3].map(n => `<i class="${n <= stars ? 'on' : ''}">★</i>`).join('');
    this.input.reset(); this.labels.hide(); for (const tag of this.barrelTags) tag.hidden = true;
    this.ui.hud.hidden = true; this.ui.result.hidden = false; this.ui.result.classList.toggle('defeat', !victory);
    const last = this.stageId === DEFENSE_STAGES.length;
    this.ui['result-title'].textContent = victory ? (last ? 'سقط الحصن!' : 'انتصار') : this.sim.base.hp <= 0 ? 'سقطت القلعة' : 'هُزم الجيش';
    this.ui['result-note'].textContent = victory ? `${this.stage.name} · بقي ${this.sim.army.count} جنديًا` : 'طوّر جيشك ثم حاول مجددًا';
    this.ui['result-coins'].hidden = false; this.ui['result-coins'].querySelector('b').textContent = `+${earned}`;
    if (victory && this.sim.combo.best >= 10) this.ui['result-note'].textContent += ` · أفضل كومبو ×${this.sim.combo.best}`;
    this.ui['next-stage'].hidden = !victory || last;
    this.ui['result-upgrades'].hidden = false;
    this.ui.replay.textContent = victory ? 'إعادة' : 'حاول مجددًا';
    if (victory) this.confetti();
    this.audio.fanfare(victory); this.audio.setMode('menu', 0);
  }
  // Pooled DOM pop-ups pinned to a world position: coins, damage on giants.
  floatText(text, x, y, z, kind) {
    let f = this.floats.find(item => item.life <= 0);
    if (!f) {
      if (this.floats.length >= 24) return;
      const el = document.createElement('span'); el.hidden = true; this.ui['float-layer'].append(el);
      f = { el, life: 0 }; this.floats.push(f);
    }
    Object.assign(f, { x, y, z, life: 0.9, kind });
    f.el.className = `float ${kind}`; f.el.textContent = text; f.el.hidden = false;
  }
  updateFloats(dt) {
    const w = this.ui.game.clientWidth, h = this.ui.game.clientHeight;
    // Summarise damage on each giant a few times a second.
    for (const giant of this.sim.enemies) if (giant.aiState && giant.alive) {
      const seen = this.giantDamage.get(giant) ?? { health: giant.health, timer: 0 };
      seen.timer -= dt;
      if (seen.timer <= 0) { const lost = Math.round(seen.health - giant.health); if (lost > 0) this.floatText(`-${lost}`, giant.x + (Math.random() - 0.5) * 2, giant.type === 'giantBoss' ? 4.6 : 2.8, giant.z, 'dmg'); seen.health = giant.health; seen.timer = 0.35; }
      this.giantDamage.set(giant, seen);
    }
    for (const f of this.floats) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) { f.el.hidden = true; continue; }
      const v = this.floatVector.set(f.x, f.y, -f.z).project(this.camera), t = 1 - f.life / 0.9;
      f.el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h - t * 60).toFixed(1)}px) translate(-50%, -50%) scale(${(t < 0.15 ? 0.6 + t * 3 : 1.05).toFixed(2)})`;
      f.el.style.opacity = Math.min(1, f.life * 3).toFixed(2);
    }
  }
  banner(title, subtitle = '', kind = 'wave') {
    const el = this.ui.banner; el.querySelector('b').textContent = title; el.querySelector('small').textContent = subtitle;
    el.className = kind; void el.offsetWidth; el.classList.add('show');
  }
  announce(event) {
    if (event.type === 'boss') { this.banner('⚠ الزعيم قادم', 'دمّره قبل أن يسحق جيشك', 'boss'); this.cameraRig.kick(0.8); this.audio.roar(); }
    else if (event.type === 'beast') { this.banner('وحش صخري!', 'ركّز السهام عليه', 'boss'); this.cameraRig.kick(0.5); this.audio.roar(); }
    else if (event.type === 'horde' && event.archers && !this.archerWarned) { this.archerWarned = true; this.banner('رماة الأعداء!', 'يقفون ويرمون جيشك بالسهام', 'boss'); }
    else if (event.type === 'horde' && event.count >= 100) this.banner('موجة ضخمة!', `${event.count} محارب`, 'wave');
  }
  confetti() {
    const box = this.ui.confetti, colors = ['#ffd24a', '#3a86ff', '#ffffff', '#ff6a5c', '#5fc8ff'];
    box.textContent = '';
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('i');
      piece.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${(Math.random() * 0.8).toFixed(2)}s;animation-duration:${(2.2 + Math.random() * 1.6).toFixed(2)}s;--spin:${Math.round(Math.random() * 720 - 360)}deg;--drift:${Math.round(Math.random() * 120 - 60)}px`;
      box.append(piece);
    }
  }
  showCombo(count, bonus) {
    const el = this.ui.combo; el.innerHTML = `<b>×${count}</b><small>كومبو! +${bonus} 🪙</small>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); this.audio.combo(count);
  }
  today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  claimDaily() {
    const amount = this.progress.claimDaily(this.today()); if (!amount) return;
    this.audio.unlock(); this.audio.power('coins');
    this.banner(`🎁 +${amount}`, `هدية اليوم · سلسلة ${this.progress.data.streak} ${this.progress.data.streak > 1 ? 'أيام' : 'يوم'}`, 'wave');
    this.confetti(); this.renderMenu();
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
    if (this.theme.lightning && animDt) {
      // Storm: occasional double lightning strikes light the whole field.
      const l = this.lightning; l.next -= animDt;
      if (l.next <= 0) { l.flash = 1; l.next = 4 + Math.random() * 5; this.ui['lightning'].classList.remove('on'); void this.ui['lightning'].offsetWidth; this.ui['lightning'].classList.add('on'); this.audio?.thunder(); }
      l.flash = Math.max(0, l.flash - animDt * 3.5);
      this.hemi.intensity = this.theme.hemi[2] + l.flash * 2.6 * (l.flash > 0.55 && l.flash < 0.7 ? 0.3 : 1);
    }
    if (this.sim.state === 'playing') {
      // Arrow volleys and music intensity follow the fight.
      const shots = this.sim.projectiles.shots; this.audio.volley(shots - this.lastShots, this.sim.weapon); this.lastShots = shots;
      if (this.sim.enemies.some(u => u.archer && u.shotFlash > 0.09)) this.audio.enemyArrow();
      this.audio.setMode('battle', this.sim.enemies.some(u => u.aiState && u.alive) ? 2 : 1);
    }
    // Powers: frozen enemies turn icy, the shield dome covers the army.
    const powers = this.sim.powers;
    this.visuals.enemyTint = powers.freeze > 0 ? this.freezeTint : null;
    this.ui.frost.classList.toggle('on', powers.freeze > 0);
    this.shieldDome.visible = powers.shield > 0;
    if (this.shieldDome.visible) {
      this.shieldDome.position.set(army.center.x, 0, army.depth / 2 - 0.2);
      this.shieldDome.scale.set(army.halfWidth + 1.2, 2.4 + Math.sin(this.sceneTime * 6) * 0.1, army.depth / 2 + 1.4);
      this.shieldDome.material.opacity = 0.14 + Math.min(1, powers.shield) * 0.08;
    }
    const leader = army.units.find(u => u.type === 'commander');
    this.commandRing.visible = !!leader;
    if (leader) { this.commandRing.position.set(leader.x, 0.05, -leader.z); this.commandRing.rotation.y += animDt; this.commandRing.scale.setScalar(1.6 + Math.sin(this.sceneTime * 4) * 0.12); }
    const shake = this.effects.takeShake(); if (shake) this.cameraRig.kick(shake);
    this.cameraRig.update(army, animDt, this.sim.enemies);
    this.environment.update(0, this.sceneTime, this.scene.fog, animDt);
    this.props.update(this.sim, animDt);
    this.visuals.update(army.units, this.sim.enemies, this.sceneTime, animDt);
    this.effects.update(this.sim.projectiles.pool.active, army, this.sim.enemies, animDt, this.sceneTime, this.camera);
    if (this.feedbackTimer > 0) { this.feedbackTimer -= animDt; if (this.feedbackTimer <= 0) this.ui['gate-feedback'].classList.remove('show'); }
    this.renderer.render(this.scene, this.camera);
    if (!this.ui.hud.hidden) this.updateLabels(this.ui.game.clientWidth, this.ui.game.clientHeight);
    this.updateFloats(animDt);
    if (!document.hidden && this.sim.state === 'playing') this.performance.update(raw);
    this.uiTimer -= dt;
    if (this.uiTimer <= 0) { this.updateUI(); this.uiTimer = 0.1; }
  }
  updateUI() {
    const { army, base } = this.sim;
    if (army.count !== this.lastCount) { this.ui['army-count'].textContent = army.count; this.lastCount = army.count; }
    if (base.hp !== this.lastBase) { this.ui['base-hp'].textContent = base.hp; this.lastBase = base.hp; }
    this.ui.progress.style.transform = `scaleX(${this.sim.progress.toFixed(3)})`;
    const charge = this.sim.energy / ENERGY_MAX, rain = this.ui['rain-btn'];
    rain.style.setProperty('--charge', charge.toFixed(3)); rain.classList.toggle('ready', charge >= 1 && !this.sim.rain);
    const weapon = this.sim.weapon !== 'crossbow' ? [`${WEAPON_KINDS[this.sim.weapon].icon} ${WEAPON_KINDS[this.sim.weapon].name}`] : [];
    const chips = weapon.concat(Object.entries(this.sim.powers).filter(([, t]) => t > 0).map(([k, t]) => `${POWER_LABELS[k]} ${Math.ceil(t)}`)).join('|');
    if (chips !== this.lastPowers) { this.lastPowers = chips; this.ui.powers.innerHTML = chips ? chips.split('|').map(c => `<span>${c}</span>`).join('') : ''; }
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
