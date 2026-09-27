import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export class GeometryBuilder {
  constructor(rigged = false) { this.parts = []; this.rigged = rigged; this.joint = 0; this.component = 0; }
  add(geometry, color, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    let g = geometry.clone();
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(m); if (g.index) { const old = g; g = g.toNonIndexed(); old.dispose(); }
    g.deleteAttribute('uv');
    const c = new THREE.Color(color), colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (this.rigged) {
      const count = g.attributes.position.count, indices = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) { indices[i * 4] = this.joint; weights[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.BufferAttribute(indices, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(weights, 4));
      g.setAttribute('_component', new THREE.Uint8BufferAttribute(new Uint8Array(count).fill(this.component), 1));
    }
    this.parts.push(g);
  }
  finish() { const merged = mergeGeometries(this.parts, false); this.parts.forEach(g => g.dispose()); this.parts = []; return merged; }
}
export class PlaceholderFactory {
  constructor() {
    this.cache = new Map();
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.sphere = new THREE.SphereGeometry(1, 8, 6);
    this.cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
    this.rock = new THREE.DodecahedronGeometry(1, 0);
    this.cone = new THREE.ConeGeometry(1, 1, 5);
  }
  create(type, rigged = false) {
    const key = `${type}:${rigged}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const b = new GeometryBuilder(rigged);
    const box = (c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => b.add(this.box, c, x, y, z, sx, sy, sz, rx, ry, rz);
    const sphere = (c, x, y, z, sx, sy, sz) => b.add(this.sphere, c, x, y, z, sx, sy, sz);
    if (type === 'desertBeast') {
      b.add(this.rock, '#b49972', 0, 0.57, 0, 0.8, 0.54, 1.04);
      b.joint = 1;
      b.add(this.rock, '#d5b485', 0, 0.62, -0.86, 0.64, 0.46, 0.51);
      let leg = 2;
      for (const x of [-0.55, 0.55]) for (const z of [-0.65, 0.65]) {
        b.joint = leg++; b.add(this.rock, '#b69a70', x, 0.29, z, 0.25, 0.31, 0.33);
        for (const claw of [-0.09, 0.09]) b.add(this.cone, '#463b31', x + claw, 0.11, z - 0.28, 0.07, 0.22, 0.07, -Math.PI / 2);
      }
      b.joint = 0;
      for (const z of [-0.45, 0.1, 0.65]) for (const x of [-0.4, 0.4]) b.add(this.cone, '#e0c090', x, 1.15, z, 0.21, 0.52, 0.23, 0, 0, x);
      b.joint = 1;
      box('#392a24', 0, 0.4, -1.22, 0.67, 0.21, 0.12);
      for (const x of [-0.24, 0.24]) { sphere('#ff623c', x, 0.72, -1.22, 0.11, 0.1, 0.06); b.add(this.cone, '#fff0c3', x, 0.44, -1.29, 0.07, 0.19, 0.07, Math.PI); }
      for (const x of [-0.12, 0, 0.12]) b.add(this.cone, '#fff0c3', x, 0.47, -1.31, 0.045, 0.12, 0.045, Math.PI);
    } else {
      const enemy = type === 'enemyGrunt' || type === 'giantBoss';
      const commander = type === 'commander', elite = type === 'elite', boss = type === 'giantBoss';
      const cloth = enemy ? '#b72e38' : '#23894f', armor = enemy ? '#3a3038' : '#c8ab72';
      for (const x of [-0.16, 0.16]) {
        b.joint = x < 0 ? 2 : 3;
        box(cloth, x, 0.24, 0, 0.19, 0.34, 0.22);
        box(enemy ? '#3a3334' : '#765a40', x, 0.075, -0.055, 0.24, 0.15, 0.36);
        box(armor, x, 0.26, -0.14, 0.15, 0.15, 0.08);
      }
      b.joint = 0;
      box(cloth, 0, 0.58, 0, 0.51, 0.49, 0.32);
      box(armor, 0, 0.6, -0.19, 0.4, 0.29, 0.09);
      box('#343343', 0, 0.39, -0.05, 0.56, 0.08, 0.36);
      for (const x of [-0.13, 0.13]) box(armor, x, 0.51, -0.25, 0.1, 0.14, 0.075);
      for (const x of [-0.35, 0.35]) {
        b.joint = x < 0 ? 4 : 5;
        b.add(this.cylinder, cloth, x, 0.57, -0.04, 0.12, 0.37, 0.12, -0.65, 0, x * -0.4);
        sphere(enemy ? '#46363a' : '#c99774', x, 0.48, -0.21, 0.115, 0.115, 0.115);
      }
      b.joint = 1;
      sphere(enemy ? '#332e37' : '#d7a37d', 0, 1.04, -0.01, 0.36, 0.35, 0.33);
      sphere(elite ? '#c5ad83' : enemy ? '#c23743' : '#f2eade', 0, 1.2, 0.04, 0.4, 0.24, 0.37);
      if (!elite) {
        box(enemy ? '#a12736' : '#eee6d8', -0.33, 0.96, 0.08, 0.14, 0.5, 0.36, 0, 0, -0.1);
        box(enemy ? '#a12736' : '#eee6d8', 0.33, 0.96, 0.08, 0.14, 0.5, 0.36, 0, 0, 0.1);
        box(enemy ? '#ac2735' : '#eee6d8', 0, 0.96, 0.28, 0.63, 0.48, 0.14);
      }
      if (!enemy) b.add(this.cylinder, '#29313b', 0, 1.26, 0.02, 0.405, 0.065, 0.365);
      if (elite) {
        box('#363b47', 0, 1.2, -0.32, 0.63, 0.16, 0.09);
        box('#9fbaaa', 0, 1.2, -0.375, 0.44, 0.1, 0.03);
        box('#215d3c', 0, 0.9, -0.3, 0.38, 0.15, 0.08);
        for (const x of [-0.33, 0.33]) box('#eee6d8', x, 1.0, 0.03, 0.1, 0.3, 0.26);
      }
      if (commander) {
        for (const x of [-0.28, -0.1, 0.1, 0.28]) for (const y of [1.07, 1.19, 1.33]) box('#ce3d4f', x, y, y < 1.3 ? 0.359 : 0.1, 0.075, 0.08, 0.03);
        for (const x of [-0.4, 0.4]) for (const y of [0.83, 0.98, 1.13]) box('#ce3d4f', x, y, -0.04, 0.025, 0.08, 0.15);
        for (const x of [-0.22, -0.08, 0.08, 0.22]) box('#ce3d4f', x, 1.38, 0, 0.06, 0.035, 0.25);
        box('#283037', 0, 0.87, -0.26, 0.43, 0.15, 0.12);
        b.joint = 6; b.component = 2;
        box('#17603b', 0, 0.53, 0.35, 0.64, 0.76, 0.045, -0.17);
        box('#f7d076', 0, 0.65, 0.408, 0.16, 0.16, 0.025, 0, 0, Math.PI / 4);
        b.component = 0; b.joint = 1;
      }
      if (type === 'recruit') box('#247547', 0, 0.91, -0.3, 0.44, 0.2, 0.1);
      if (enemy) box('#2b2c35', 0, 0.91, -0.27, 0.5, 0.23, 0.12);
      for (const x of [-0.14, 0.14]) {
        box(enemy ? '#ff684d' : '#fff8ec', x, 1.06, -0.323, 0.12, 0.09, 0.035);
        if (!enemy) box('#2d2c30', x, 1.05, -0.348, 0.045, 0.07, 0.015);
        box('#292e33', x, 1.135, -0.325, 0.15, 0.035, 0.04, 0, 0, x < 0 ? -0.2 : 0.2);
      }
      b.joint = 0;
      if (boss) {
        for (const x of [-0.39, 0.39]) {
          sphere('#6c594c', x, 0.78, 0, 0.26, 0.16, 0.3);
          b.add(this.cone, '#c4ad83', x, 0.99, 0, 0.1, 0.23, 0.1);
        }
        b.joint = 5; b.component = 1;
        box('#604439', 0.53, 0.58, -0.3, 0.1, 0.8, 0.1, 0, 0, -0.25);
        b.add(this.rock, '#514b51', 0.65, 1.05, -0.3, 0.27, 0.27, 0.27);
        for (const x of [0.4, 0.9]) b.add(this.cone, '#c5b99a', x, 1.15, -0.3, 0.1, 0.3, 0.1, 0, 0, x < 0.5 ? 1 : -1);
      } else {
        b.joint = 5; b.component = 1;
        box('#323c49', 0.19, 0.55, -0.4, 0.16, 0.17, 0.53);
        box(enemy ? '#e5484e' : '#82e69b', 0.19, 0.61, -0.46, 0.18, 0.045, 0.21);
        box(armor, 0.19, 0.43, -0.4, 0.1, 0.18, 0.13);
        box('#293039', 0.19, 0.56, -0.76, 0.08, 0.08, 0.24);
      }
    }
    const geometry = b.finish(); this.cache.set(key, geometry); return geometry;
  }
}
