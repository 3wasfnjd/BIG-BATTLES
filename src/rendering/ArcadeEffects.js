import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool.js';
import { CONFIG } from '../core/Config.js';

const SPARKS_PER_HIT = 4;

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas'); canvas.width = size[0]; canvas.height = size[1];
  draw(canvas.getContext('2d'), size[0], size[1]);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
const glowTexture = () => canvasTexture([64, 64], (ctx, w) => {
  const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.8)'); g.addColorStop(0.6, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
});
const starTexture = () => canvasTexture([64, 64], (ctx, w) => {
  const c = w / 2; ctx.translate(c, c);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, c);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(-c, -c, w, w);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 4 * (i ? 2 : 1)); ctx.beginPath(); ctx.moveTo(0, -c); ctx.lineTo(3, 0); ctx.lineTo(0, c); ctx.lineTo(-3, 0); ctx.fill(); }
});
// Tracer: bright head at +Z end fading to a thin tail.
const trailTexture = () => canvasTexture([32, 128], (ctx, w, h) => {
  for (let y = 0; y < h; y++) {
    const t = y / h, a = Math.pow(1 - t, 1.6);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y, w, 1);
  }
});

const additive = map => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
function instanced(geometry, material, capacity, scene) {
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.frustumCulled = false; mesh.count = 0; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, new THREE.Color()); scene.add(mesh); return mesh;
}
function flush(mesh, count) {
  mesh.count = count; mesh.visible = count > 0;
  mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, count * 16); mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) { mesh.instanceColor.clearUpdateRanges(); mesh.instanceColor.addUpdateRange(0, count * 3); mesh.instanceColor.needsUpdate = true; }
}

export class ArcadeEffects {
  constructor(scene) {
    this.dummy = new THREE.Object3D(); this.color = new THREE.Color();
    this.colors = { halo: new THREE.Color('#ffcf4a').multiplyScalar(0.55), player: new THREE.Color('#ffa414'), enemy: new THREE.Color('#ff4b3a'), playerHit: new THREE.Color('#fff2b0'), enemyHit: new THREE.Color('#ff8a4a'), death: new THREE.Color('#ff5f45'), playerDeath: new THREE.Color('#7dffb0') };
    const glow = glowTexture(), star = starTexture(), trail = trailTexture();
    const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    // Solid bolt body (shaft + head) and an additive tracer per projectile.
    const shaft = new THREE.BoxGeometry(0.05, 0.05, 0.9), head = new THREE.ConeGeometry(0.07, 0.2, 5).rotateX(-Math.PI / 2).translate(0, 0, -0.5);
    this.bolts = instanced(mergeBolt(shaft, head), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), CONFIG.projectileCapacity, scene);
    // Normal blending keeps tracers saturated over the bright paving; a soft additive halo adds glow.
    this.trails = instanced(flat.clone().scale(0.26, 1, 2.4).translate(0, 0.02, 1.0), new THREE.MeshBasicMaterial({ map: trail, transparent: true, depthWrite: false, toneMapped: false }), CONFIG.projectileCapacity, scene);
    this.halos = instanced(flat.clone().scale(0.7, 1, 3.2).translate(0, 0, 1.0), additive(trail), CONFIG.projectileCapacity, scene);
    this.muzzles = instanced(flat, additive(star), CONFIG.maxPlayerUnits + CONFIG.maxEnemyUnits, scene);
    this.flashes = instanced(flat, additive(star), CONFIG.impactCapacity, scene);
    // Dust ring that expands where a unit falls.
    this.puffs = instanced(new THREE.RingGeometry(0.55, 1, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false }), CONFIG.impactCapacity, scene);
    this.dust = { enemy: new THREE.Color('#f3d2b8'), player: new THREE.Color('#d8f3df'), prop: new THREE.Color('#ffe7a0') };
    this.sparks = instanced(flat.clone().scale(0.5, 1, 1.6), additive(glow), CONFIG.impactCapacity * SPARKS_PER_HIT, scene);
    this.pool = new ObjectPool(CONFIG.impactCapacity, () => ({ sparks: Array.from({ length: SPARKS_PER_HIT }, () => ({ vx: 0, vz: 0, vy: 0 })) }));
    // Boss/beast telegraph: glowing ring plus a soft filled disc.
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3b2f', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3b2f', transparent: true, opacity: 0.18, depthWrite: false }));
    this.fill = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff6a3a', transparent: true, opacity: 0.25, depthWrite: false }));
    for (const mesh of [this.ring, this.disc, this.fill]) { mesh.visible = false; mesh.renderOrder = 2; scene.add(mesh); }
    this.shake = 0;
  }
  hit(unit, died) {
    const effect = this.pool.acquire(); if (!effect) return;
    const big = unit.type === 'giantBoss' || unit.type === 'desertBeast' || (died && unit.type === 'barrel');
    Object.assign(effect, { x: unit.x + (Math.random() - 0.5) * (big ? 1.2 : 0.2), z: unit.z, y: big ? 1 + Math.random() * 1.6 : 0.55, life: died ? 0.42 : 0.2, maxLife: died ? 0.42 : 0.2, team: unit.team, died, big, prop: !!unit.isProp });
    for (const spark of effect.sparks) {
      const a = Math.random() * Math.PI * 2, speed = (died ? 4.5 : 3) * (0.5 + Math.random());
      spark.vx = Math.cos(a) * speed; spark.vz = Math.sin(a) * speed; spark.vy = 1.5 + Math.random() * 2.5;
    }
    if (died && big) this.shake = 1;
  }
  update(projectiles, army, enemies, dt, time, camera) {
    const d = this.dummy;
    let count = 0;
    for (const bullet of projectiles) {
      const dx = bullet.tx - bullet.x, dz = -(bullet.tz - bullet.z), yaw = Math.atan2(dx, dz) + Math.PI;
      d.position.set(bullet.x, bullet.y, -bullet.z); d.rotation.set(0, yaw, 0); d.scale.setScalar(1); d.updateMatrix();
      this.bolts.setMatrixAt(count, d.matrix); this.trails.setMatrixAt(count, d.matrix); this.halos.setMatrixAt(count, d.matrix);
      const color = this.colors[bullet.team];
      this.trails.setColorAt(count, color); this.halos.setColorAt(count, bullet.team === 'player' ? this.colors.halo : color); this.bolts.setColorAt(count, bullet.team === 'player' ? this.colors.playerHit : color);
      count++;
    }
    flush(this.bolts, count); flush(this.trails, count); flush(this.halos, count);
    // Muzzle flashes on shooters that just fired.
    count = 0;
    for (const roster of [army.units, enemies]) for (const unit of roster) {
      if (!unit.alive || unit.shotFlash <= 0 || !unit.projectileSpeed || count >= this.muzzles.instanceMatrix.count) continue;
      const pulse = unit.shotFlash / 0.1, angle = unit.aimAngle, reach = unit.team === 'player' ? 0.75 : 0.5;
      d.position.set(unit.x - Math.sin(angle) * reach, 0.55, -unit.z - Math.cos(angle) * reach);
      d.rotation.set(0, time * 5 + unit.id, 0); d.scale.setScalar(0.35 + pulse * 0.45); d.updateMatrix();
      this.muzzles.setMatrixAt(count, d.matrix); this.muzzles.setColorAt(count, this.colors[unit.team]); count++;
    }
    flush(this.muzzles, count);
    // Impacts: flash + sparks with gravity.
    for (let i = this.pool.active.length - 1; i >= 0; i--) { const e = this.pool.active[i]; e.life -= dt; if (e.life <= 0) this.pool.releaseAt(i); }
    let flashes = 0, sparks = 0, puffs = 0;
    for (const e of this.pool.active) {
      const k = e.life / e.maxLife, age = e.maxLife - e.life;
      const color = e.died ? (e.team === 'enemy' ? this.colors.death : this.colors.playerDeath) : e.team === 'enemy' ? this.colors.playerHit : this.colors.enemyHit;
      d.position.set(e.x, e.y, -e.z); d.rotation.set(0, e.x * 7 + age * 6, 0);
      d.scale.setScalar((e.died ? 2.2 : e.big ? 1.6 : 1.1) * (0.4 + (1 - k) * 0.9) * (0.4 + k * 0.6)); d.updateMatrix();
      this.flashes.setMatrixAt(flashes, d.matrix); this.flashes.setColorAt(flashes++, color);
      if (e.died) {
        d.position.set(e.x, 0.05, -e.z); d.rotation.set(0, 0, 0); d.scale.setScalar((e.big ? 3.2 : 0.9) * (0.3 + (1 - k) * 1.1)); d.updateMatrix();
        this.puffs.setMatrixAt(puffs, d.matrix); this.puffs.setColorAt(puffs++, this.color.copy(e.prop ? this.dust.prop : this.dust[e.team] || this.dust.enemy).multiplyScalar(k));
      }
      for (const s of e.sparks) {
        d.position.set(e.x + s.vx * age, Math.max(0.05, e.y + s.vy * age - 9 * age * age), -e.z + s.vz * age);
        d.rotation.set(0, Math.atan2(s.vx, s.vz), 0); d.scale.setScalar(0.35 * k + 0.05); d.updateMatrix();
        this.sparks.setMatrixAt(sparks, d.matrix); this.sparks.setColorAt(sparks++, color);
      }
    }
    flush(this.flashes, flashes); flush(this.sparks, sparks); flush(this.puffs, puffs);
    // Telegraph: ring at full radius, inner fill grows with the wind-up.
    const attacker = enemies.find(unit => unit.alive && unit.telegraph);
    for (const mesh of [this.ring, this.disc, this.fill]) mesh.visible = !!attacker;
    if (attacker) {
      const radius = attacker.type === 'giantBoss' && attacker.attackCount % 3 === 2 ? 4.7 : attacker.range;
      const def = attacker.type === 'giantBoss' ? 0.8 : 0.6, progress = Math.min(1, Math.max(0, 1 - attacker.timer / def));
      for (const mesh of [this.ring, this.disc, this.fill]) mesh.position.set(attacker.x, 0.04, -attacker.z);
      this.ring.scale.setScalar(radius); this.disc.scale.setScalar(radius); this.fill.scale.setScalar(Math.max(0.01, radius * progress));
      this.ring.material.opacity = 0.7 + Math.sin(time * 22) * 0.25;
    }
  }
  takeShake() { const s = this.shake; this.shake = 0; return s; }
  clear() {
    this.pool.clear(true);
    for (const mesh of [this.bolts, this.trails, this.halos, this.muzzles, this.flashes, this.sparks, this.puffs]) flush(mesh, 0);
    for (const mesh of [this.ring, this.disc, this.fill]) mesh.visible = false;
  }
}

function mergeBolt(shaft, head) {
  const geometry = new THREE.BufferGeometry();
  const a = shaft.toNonIndexed(), b = head.toNonIndexed();
  const positions = new Float32Array([...a.attributes.position.array, ...b.attributes.position.array]);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  a.dispose(); b.dispose(); shaft.dispose(); head.dispose();
  return geometry;
}
