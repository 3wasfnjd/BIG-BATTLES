import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool.js';
import { CONFIG } from '../core/Config.js';
export class EffectsRenderer {
  constructor(scene) {
    this.dummy = new THREE.Object3D(); this.color = new THREE.Color();
    this.bullets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.065, 0.065, 0.42), new THREE.MeshBasicMaterial(), CONFIG.projectileCapacity);
    this.impacts = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshBasicMaterial(), CONFIG.impactCapacity);
    this.pool = new ObjectPool(CONFIG.impactCapacity, () => ({}));
    for (const mesh of [this.bullets, this.impacts]) { mesh.frustumCulled = false; mesh.count = 0; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mesh); }
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 32), new THREE.MeshBasicMaterial({ color: '#ed674c', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; scene.add(this.ring);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.34, 24), new THREE.MeshBasicMaterial({ color: '#bce9ff', transparent: true, opacity: 0.7, depthWrite: false })); this.marker.rotation.x = -Math.PI / 2; scene.add(this.marker);
  }
  hit(unit, died) { const effect = this.pool.acquire(); if (effect) Object.assign(effect, { x: unit.x, z: unit.z, life: died ? 0.35 : 0.13, maxLife: died ? 0.35 : 0.13, team: unit.team, died }); }
  update(projectiles, army, enemies, dt, time) {
    this.bullets.count = projectiles.length;
    projectiles.forEach((bullet, i) => {
      this.dummy.position.set(bullet.x, bullet.y, -bullet.z); this.dummy.rotation.set(0, Math.atan2(bullet.tx - bullet.x, -(bullet.tz - bullet.z)), 0); this.dummy.scale.setScalar(1); this.dummy.updateMatrix();
      this.bullets.setMatrixAt(i, this.dummy.matrix); this.color.set(bullet.team === 'player' ? '#fff1a9' : '#f25351'); this.bullets.setColorAt(i, this.color);
    });
    for (let i = this.pool.active.length - 1; i >= 0; i--) { const effect = this.pool.active[i]; effect.life -= dt; if (effect.life <= 0) this.pool.releaseAt(i); }
    this.impacts.count = this.pool.active.length;
    this.pool.active.forEach((e, i) => { this.dummy.position.set(e.x, 0.4 + (e.maxLife - e.life), -e.z); this.dummy.scale.setScalar(e.life / e.maxLife * (e.died ? 3 : 1.4)); this.dummy.updateMatrix(); this.impacts.setMatrixAt(i, this.dummy.matrix); this.impacts.setColorAt(i, this.color.set(e.team === 'player' ? '#81d9ff' : '#f5bc77')); });
    for (const mesh of [this.bullets, this.impacts]) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    this.marker.position.set(army.center.x, 0.07, -army.center.z - 0.75);
    const attacker = enemies.find(u => u.telegraph); this.ring.visible = !!attacker;
    if (attacker) { const radius = attacker.type === 'giantBoss' && attacker.attackCount % 3 === 2 ? 4.7 : attacker.range; this.ring.position.set(attacker.x, 0.06, -attacker.z); this.ring.scale.setScalar(radius); this.ring.material.opacity = 0.35 + Math.sin(time * 20) * 0.15; }
  }
  clear() { this.pool.clear(true); this.ring.visible = false; this.bullets.count = 0; this.impacts.count = 0; }
}
