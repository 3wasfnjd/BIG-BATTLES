import * as THREE from 'three';
import { GeometryBuilder } from './PlaceholderFactory.js';
// Environment pieces are decorative only. Replace this renderer without changing the stage.
export class EnvironmentFactory {
  constructor(scene, length) {
    this.chunks = []; const box = new THREE.BoxGeometry(), rock = new THREE.DodecahedronGeometry(1), trunk = new THREE.CylinderGeometry(0.17, 0.25, 1, 6), cone = new THREE.ConeGeometry(1, 1, 3);
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    let seed = 7421;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, length + 170), new THREE.MeshLambertMaterial({ color: '#d1ad79' }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.13, -length / 2); scene.add(ground);
    for (let start = -32; start <= length + 40; start += 32) {
      const b = new GeometryBuilder();
      const add = (c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => b.add(box, c, x, y, z, sx, sy, sz, rx, ry, rz);
      add('#c4a47b', 0, -0.08, -16, 14, 0.13, 32);
      for (let row = 0; row < 16; row++) for (let col = 0; col < 7; col++) {
        const c = ['#d1b78f', '#d9bd95', '#ceb087'][Math.floor(random() * 3)];
        add(c, -6 + col * 2, -0.017, -row * 2 - 1, 1.97, 0.025, 1.97);
      }
      for (const side of [-1, 1]) {
        add('#b38253', side * 7.7, 0.65, -16, 1.1, 1.3, 32);
        add('#e0bc85', side * 7.7, 1.36, -16, 1.24, 0.15, 32);
        for (let z = -2; z > -32; z -= 2.5) add('#ba8d5c', side * 7.7, 1.62, z, 1.1, 0.52, 0.82);
        for (let z = -4; z > -32; z -= 16) {
          const h = 3.7 + random();
          add('#bd8f5d', side * 9, h / 2, z, 2.8, h, 3.4);
          add('#dec08d', side * 9, h, z, 3.04, 0.2, 3.65);
          for (const dx of [-0.95, 0, 0.95]) { add('#c59a68', side * 9 + dx, h + 0.33, z + 1.2, 0.46, 0.63, 0.55); add('#c59a68', side * 9 + dx, h + 0.33, z - 1.2, 0.46, 0.63, 0.55); }
          for (const level of [1.1, 2.3]) add('#695344', side * 7.58, level, z, 0.025, 0.5, 0.23);
          const flag = start > 190 ? '#a03740' : '#1e5991';
          add(flag, side * 7.51, 2.35, z + 0.9, 0.045, 1.58, 0.8);
          add('#e9c980', side * 7.47, 2.45, z + 0.9, 0.055, 0.25, 0.25, Math.PI / 4);
          for (let triangle = 0; triangle < 3; triangle++) b.add(cone, '#efdbb1', side * 7.46, h - 0.5, z - 0.6 + triangle * 0.6, 0.18, 0.3, 0.05, 0, Math.PI / 2, Math.PI);
          add('#614535', side * 7.04, 1.35, z - 1.3, 0.24, 0.65, 0.24);
          b.add(cone, '#ffcf67', side * 7.04, 1.83, z - 1.3, 0.21, 0.5, 0.21);
        }
        for (const z of [-10, -26]) {
          const x = side * (11 + random() * 2), h = 4.2 + random();
          b.add(trunk, '#725538', x, h / 2, z, 1, h, 1, 0, 0, -side * 0.09);
          for (let leaf = 0; leaf < 7; leaf++) {
            const angle = leaf * Math.PI * 2 / 7;
            add(leaf % 2 ? '#657446' : '#78874e', x + Math.cos(angle) * 0.9, h, z + Math.sin(angle) * 0.9, 0.32, 0.055, 2.4, 0.32, Math.PI / 2 - angle);
          }
          add('#8e693f', side * 6.75, 0.28, z, 0.5, 0.55, 0.55);
          b.add(trunk, '#ae704c', side * 6.7, 0.29, z - 1, 1.2, 0.65, 1.2);
        }
        for (let i = 0; i < 4; i++) {
          const x = side * (17 + random() * 9), z = -random() * 32, h = 5 + random() * 8;
          b.add(rock, i % 2 ? '#bd8c60' : '#b17d56', x, h * 0.43, z, 2.5 + random() * 2, h, 3 + random() * 2, 0, random(), 0.1);
          add('#c89c6d', x, h * 0.55, z, 4, 0.3, 5);
        }
      }
      const mesh = new THREE.Mesh(b.finish(), material); mesh.position.z = -start; scene.add(mesh); this.chunks.push({ mesh, z: start });
    }
    box.dispose(); rock.dispose(); trunk.dispose(); cone.dispose();
    // A fictional final fortress with a broad open arch; never blocks the formation.
    const b = new GeometryBuilder();
    for (const x of [-10, 10]) { b.add(new THREE.BoxGeometry(), '#a47550', x, 5, -length - 8, 6, 10, 5); for (let i = 0; i < 4; i++) b.add(new THREE.BoxGeometry(), '#ba9465', x - 2.3 + i * 1.5, 10.5, -length - 8, 0.8, 1.2, 5); }
    b.add(new THREE.BoxGeometry(), '#b58a5f', 0, 8.4, -length - 8, 17, 3.2, 3);
    const fortress = new THREE.Mesh(b.finish(), material); scene.add(fortress);
  }
  update(z) { for (const chunk of this.chunks) chunk.mesh.visible = chunk.z > z - 60 && chunk.z < z + 105; }
}
