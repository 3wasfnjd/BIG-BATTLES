import * as THREE from 'three';
import { GeometryBuilder } from './PlaceholderFactory.js';
import { createEnvironmentKit } from './EnvironmentKit.js';

// Data-driven stage distances remain independent of the reusable decorative kit.
export class EnvironmentFactory {
  constructor(scene, length) {
    this.kit = createEnvironmentKit(); this.batches = new Map(); this.window = NaN;
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const placements = new Map([...this.kit.keys()].map(key => [key, []]));
    const dummy = new THREE.Object3D();
    const place = (key, segment, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => {
      dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, ry, 0); dummy.updateMatrix();
      placements.get(key).push({ segment, matrix: new Float32Array(dummy.matrix.elements) });
    };
    let seed = 7421;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, length + 170), new THREE.MeshLambertMaterial({ color: '#d1ad79' }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.13, -length / 2); scene.add(ground);
    for (let start = -32; start <= length + 40; start += 16) {
      place('road', start, 0, 0, -start);
      for (const side of [-1, 1]) {
        const rotation = side > 0 ? 0 : Math.PI;
        for (const local of [4, 12]) place('wall', start, side * 7.7, 0, -start - local);
        const towerHeight = (3.7 + random()) / 4;
        place('tower', start, side * 9, 0, -start - 4, 1, towerHeight, 1, rotation);
        place(start > 190 ? 'enemyBanner' : 'friendlyBanner', start, side * 7.51, 2.35 * towerHeight, -start - 4 + side * .9, 1, 1, 1, rotation);
        place('torch', start, side * 7.04, 0, -start - 4 - side * 1.3);
        const palmHeight = (4.2 + random()) / 4.6;
        place('palm', start, side * (11 + random() * 2), 0, -start - 10, 1, palmHeight, 1, random());
        place('supplies', start, side * 6.75, 0, -start - 10);
        for (let i = 0; i < 2; i++) place('sandstone', start, side * (17 + random() * 9), 0, -start - random() * 16, 2.5 + random() * 2, 5 + random() * 8, 3 + random() * 2, random());
      }
    }
    for (const [key, entries] of placements) {
      // Placements are ordered by segment. Only the moving 176 m window needs GPU capacity.
      let capacity = 0, end = 0;
      for (let first = 0; first < entries.length; first++) {
        while (end < entries.length && entries[end].segment <= entries[first].segment + 176) end++;
        capacity = Math.max(capacity, end - first);
      }
      const mesh = new THREE.InstancedMesh(this.kit.get(key), material, Math.max(1, capacity));
      mesh.name = `environment:${key}`; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Explicit segment culling avoids a stale instance bound after advancing the window.
      mesh.frustumCulled = false; mesh.count = 0; scene.add(mesh);
      this.batches.set(key, { mesh, entries });
    }
    // Single original fortress, with an arch wider than the army corridor.
    const b = new GeometryBuilder(), box = new THREE.BoxGeometry();
    for (const x of [-10, 10]) {
      b.add(box, '#a47550', x, 5, -length - 8, 6, 10, 5);
      for (let i = 0; i < 4; i++) b.add(box, '#ba9465', x - 2.3 + i * 1.5, 10.5, -length - 8, .8, 1.2, 5);
    }
    b.add(box, '#b58a5f', 0, 8.4, -length - 8, 17, 3.2, 3);
    scene.add(new THREE.Mesh(b.finish(), material)); box.dispose();
    this.update(0);
  }
  update(z) {
    const window = Math.floor(z / 16);
    if (window === this.window) return;
    this.window = window;
    const near = window * 16 - 64, far = window * 16 + 112;
    for (const { mesh, entries } of this.batches.values()) {
      let count = 0;
      for (const entry of entries) if (entry.segment >= near && entry.segment <= far) mesh.instanceMatrix.array.set(entry.matrix, count++ * 16);
      mesh.count = count; mesh.visible = count > 0;
      mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, count * 16); mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
