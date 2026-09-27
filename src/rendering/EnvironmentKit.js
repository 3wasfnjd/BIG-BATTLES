import * as THREE from 'three';
import { GeometryBuilder } from './PlaceholderFactory.js';
import { chamferedStone } from './QualityGeometry.js';

// Reusable decorative meshes: no textures, downloaded models or gameplay collision.
export function createEnvironmentKit(quality = false) {
  const box = new THREE.BoxGeometry(), tile = new THREE.PlaneGeometry().rotateX(-Math.PI / 2);
  const rock = new THREE.DodecahedronGeometry(1), trunk = new THREE.CylinderGeometry(0.17, 0.25, 1, 6), cone = new THREE.ConeGeometry(1, 1, 3);
  const kit = new Map();
  const build = (name, fill) => {
    const b = new GeometryBuilder();
    const add = (c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => b.add(box, c, x, y, z, sx, sy, sz, rx, ry, rz);
    fill(b, add); const geometry = b.finish(); geometry.computeBoundingSphere(); kit.set(name, geometry);
  };
  build('road', b => {
    b.add(tile, quality ? '#aa9578' : '#c4a47b', 0, -.032, -8, 14, 1, 16);
    if (quality) {
      const stone=chamferedStone(), palette=['#d8c8ab','#ddcdb0','#d6c7ab','#dacaae'];
      for (let row=0;row<8;row++) for (let col=0;col<(row%2?8:7);col++) {
        const left=Math.max(-7,-7+col*2-(row%2)),right=Math.min(7,-5+col*2-(row%2));
        b.add(stone,palette[(row*5+col*7)%4],(left+right)/2,-.062,-row*2-1,right-left-.043,.12,1.956);
      }
      stone.dispose(); return;
    }
    for (let row = 0; row < 8; row++) for (let col = 0; col < 7; col++) {
      b.add(tile, ['#d1b78f', '#d9bd95', '#ceb087'][(row * 5 + col * 7) % 3], -6 + col * 2, -.0045, -row * 2 - 1, 1.97, 1, 1.97);
    }
  });
  build('wall', (b, add) => {
    add('#b38253', 0, .65, 0, 1.1, 1.3, 8); add('#e0bc85', 0, 1.36, 0, 1.24, .15, 8);
    for (const z of [-3, -1, 1, 3]) add('#ba8d5c', 0, 1.62, z, 1.1, .52, .82);
  });
  // The tower front is local -X; rotate the opposite bank toward the corridor.
  build('tower', (b, add) => {
    add('#bd8f5d', 0, 2, 0, 2.8, 4, 3.4); add('#dec08d', 0, 4, 0, 3.04, .2, 3.65);
    for (const x of [-.95, 0, .95]) for (const z of [-1.2, 1.2]) add('#c59a68', x, 4.33, z, .46, .63, .55);
    for (const y of [1.1, 2.3]) add('#695344', -1.42, y, 0, .025, .5, .23);
    for (let i = 0; i < 3; i++) b.add(cone, '#efdbb1', -1.54, 3.5, -.6 + i * .6, .18, .3, .05, 0, Math.PI / 2, Math.PI);
  });
  for (const [name, color] of [['friendlyBanner', '#206842'], ['enemyBanner', '#a03740']]) build(name, (b, add) => {
    add(color, 0, 0, 0, .045, 1.58, .8); add('#e9c980', -.04, .1, 0, .055, .25, .25, Math.PI / 4);
  });
  build('palm', (b, add) => {
    b.add(trunk, '#725538', 0, 2.3, 0, 1, 4.6, 1);
    for (let leaf = 0; leaf < 7; leaf++) {
      const angle = leaf * Math.PI * 2 / 7;
      add(leaf % 2 ? '#657446' : '#78874e', Math.cos(angle) * .9, 4.6, Math.sin(angle) * .9, .32, .055, 2.4, .32, Math.PI / 2 - angle);
    }
  });
  build('supplies', (b, add) => { add('#8e693f', 0, .28, 0, .5, .55, .55); b.add(trunk, '#ae704c', 0, .29, -1, 1.2, .65, 1.2); });
  build('torch', (b, add) => { add('#614535', 0, 1.35, 0, .24, .65, .24); b.add(cone, '#ffcf67', 0, 1.83, 0, .21, .5, .21); });
  build('sandstone', (b, add) => { b.add(rock, '#b17d56', 0, .43, 0); add('#c89c6d', 0, .55, 0, 1.15, .035, 1.25); });
  box.dispose(); tile.dispose(); rock.dispose(); trunk.dispose(); cone.dispose();
  return kit;
}
