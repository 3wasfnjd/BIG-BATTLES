import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Procedural chibi characters for the arcade look. Every pose is baked once into shared
// geometry, so the crowd keeps using InstancedMesh batches with no rig per soldier.
// Model space: feet at y=0, front faces -Z (the direction the army runs).

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const PALETTES = {
  player: { cloth: '#23984c', clothDark: '#17703a', trim: '#f2c14e', metal: '#48c46f', metalDark: '#1a6a38', skin: '#f2c099', cloth2: '#f4efe2', leather: '#7b4a2a', boot: '#4a3020', wood: '#8a5630', steel: '#cfd6de' },
  enemy: { cloth: '#d8343d', clothDark: '#9c1f2b', trim: '#f4e9dc', metal: '#c92f39', metalDark: '#8a1c27', skin: '#e9a47c', cloth2: '#3b2a2e', leather: '#4a2d26', boot: '#2e2224', wood: '#6b3d24', steel: '#b9c0ca' },
};

class Rig {
  constructor(detail = 1) {
    this.parts = []; this.glow = []; this.detail = detail;
  }
  add(geometry, color, bone, matrix, { glow = false, flat = false, ao = true, shade = 1 } = {}) {
    let g = geometry.clone(); g.applyMatrix4(matrix);
    if (g.index) { const old = g; g = g.toNonIndexed(); old.dispose(); }
    g.deleteAttribute('uv');
    if (flat) g.computeVertexNormals();
    const c = new THREE.Color(color), pos = g.attributes.position, colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      // Cheap baked contact occlusion: lower vertices and undersides are darker.
      const k = glow || !ao ? 1 : shade * (0.62 + 0.38 * smooth(-0.05, 0.75, pos.getY(i)));
      colors[i * 3] = c.r * k; colors[i * 3 + 1] = c.g * k; colors[i * 3 + 2] = c.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    (glow ? this.glow : this.parts).push({ geometry: g, bone });
    return this;
  }
  bake(pose, bones) {
    const out = [];
    for (const list of [this.parts, this.glow]) {
      if (!list.length) { out.push(null); continue; }
      const geometries = list.map(({ geometry, bone }) => geometry.clone().applyMatrix4(boneMatrix(bone, pose, bones)));
      const merged = mergeGeometries(geometries, false); geometries.forEach(g => g.dispose());
      out.push(merged);
    }
    return out;
  }
}

// Bone transform = root pose * (pivot-relative rotation of the bone).
function boneMatrix(bone, pose, bones) {
  const root = new THREE.Matrix4().compose(V(pose.x || 0, pose.y || 0, pose.z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.rx || 0, pose.ry || 0, pose.rz || 0)), V(pose.sx || 1, pose.sy || 1, pose.sz || 1));
  const def = bones[bone], local = pose[bone];
  if (!def || !local) return root;
  const pivot = def.pivot;
  const m = new THREE.Matrix4().makeTranslation(pivot.x + (local.x || 0), pivot.y + (local.y || 0), pivot.z + (local.z || 0))
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(local.rx || 0, local.ry || 0, local.rz || 0)))
    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  if (def.parent) return boneMatrix(def.parent, pose, bones).multiply(m);
  return root.multiply(m);
}

const T = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));
// Capsule/cylinder spanning two points.
function span(a, b, sx = 1, sz = sx) {
  const dir = b.clone().sub(a), length = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
  return { matrix: new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(sx, 1, sz)), length };
}

class Shapes {
  constructor(detail) {
    const d = detail; this.d = detail;
    this.sphere = new THREE.SphereGeometry(1, Math.max(7, Math.round(12 * d)), Math.max(5, Math.round(8 * d)));
    this.lowSphere = new THREE.SphereGeometry(1, Math.max(5, Math.round(7 * d)), Math.max(4, Math.round(5 * d)));
    this.tinySphere = new THREE.SphereGeometry(1, 5, 3);
    this.cyl = new THREE.CylinderGeometry(1, 1, 1, Math.max(6, Math.round(12 * d)));
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.cone = new THREE.ConeGeometry(1, 1, Math.max(5, Math.round(10 * d)));
    this.rock = new THREE.DodecahedronGeometry(1, 0);
    this.rock1 = new THREE.IcosahedronGeometry(1, 0);
    this.capsules = new Map();
  }
  capsule(radius, length) {
    const key = `${radius.toFixed(3)}:${length.toFixed(3)}`;
    if (!this.capsules.has(key)) this.capsules.set(key, new THREE.CapsuleGeometry(radius, Math.max(0.001, length), this.d < 1 ? 1 : 2, this.d < 1 ? 6 : 8));
    return this.capsules.get(key);
  }
  lathe(points, segments = 14, phiStart = 0, phiLength = Math.PI * 2) {
    return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), Math.max(6, Math.round(segments * this.d)), phiStart, phiLength);
  }
  torus(radius, tube, radial, tubular, arc = Math.PI * 2) {
    return new THREE.TorusGeometry(radius, tube, Math.max(3, Math.round(radial * this.d)), Math.max(8, Math.round(tubular * this.d)), arc);
  }
  // Partial sphere with an opening centred on -Z (the face).
  hood(openingDeg, thetaLength = Math.PI) {
    const open = openingDeg * Math.PI / 180;
    return new THREE.SphereGeometry(1, Math.max(9, Math.round(14 * this.d)), Math.max(5, Math.round(8 * this.d)), Math.PI * 1.5 + open / 2, Math.PI * 2 - open, 0, thetaLength);
  }
}

const HUMAN_BONES = {
  body: { pivot: V(0, 0.34, 0) },
  head: { pivot: V(0, 0.68, 0), parent: 'body' },
  arms: { pivot: V(0, 0.58, 0), parent: 'body' },
  legL: { pivot: V(-0.12, 0.3, 0) },
  legR: { pivot: V(0.12, 0.3, 0) },
};

function limb(rig, s, color, bone, a, b, radius) {
  const { matrix, length } = span(a, b);
  rig.add(s.capsule(radius, length), color, bone, matrix);
}

function humanoid(kind, s) {
  const player = kind !== 'enemyGrunt';
  const p = player ? PALETTES.player : PALETTES.enemy;
  const elite = kind === 'elite', commander = kind === 'commander';
  const rig = new Rig();
  // Legs and boots.
  for (const side of [-1, 1]) {
    const bone = side < 0 ? 'legL' : 'legR';
    rig.add(s.sphere, p.boot, bone, T(side * 0.12, 0.07, -0.03, 0, 0, 0, 0.095, 0.075, 0.14), { shade: 1.15 });
  }
  // Robe / tunic: a soft bell silhouette reads well from above and behind.
  const robe = [[0.001, 0.16], [0.29, 0.17], [0.31, 0.22], [0.29, 0.34], [0.25, 0.48], [0.22, 0.58], [0.16, 0.66], [0.001, 0.69]];
  rig.add(s.lathe(robe, 14), p.cloth, 'body', T());
  rig.add(s.torus(0.265, 0.035, 4, 14), p.leather, 'body', T(0, 0.35, 0, Math.PI / 2));
  rig.add(s.box, p.trim, 'body', T(0, 0.35, -0.29, 0, 0, 0, 0.08, 0.07, 0.03));
  // Hem trim.
  rig.add(s.torus(0.3, 0.028, 4, 14), elite || commander ? p.trim : p.clothDark, 'body', T(0, 0.19, 0, Math.PI / 2));
  // Cape over the back (+Z).
  const capeColor = commander ? '#1c7a3e' : p.clothDark;
  const cape = commander ? [[0.2, 0.66], [0.27, 0.48], [0.36, 0.2], [0.4, 0.06]] : [[0.2, 0.65], [0.26, 0.5], [0.32, 0.3], [0.33, 0.22]];
  rig.add(s.lathe(cape, 10, -1.25, 2.5), capeColor, 'body', T());
  if (player) {
    // Quiver with bolts on the back: readable detail from the gameplay camera.
    rig.add(s.cyl, p.leather, 'body', T(0.1, 0.5, 0.27, 0.35, 0, -0.35, 0.065, 0.3, 0.065));
    for (const dx of [-0.03, 0.02, 0.06]) rig.add(s.cone, p.cloth2, 'body', T(0.16 + dx, 0.7, 0.33, 0.35, 0, -0.35, 0.03, 0.08, 0.03));
  }
  // Head.
  rig.add(s.sphere, p.skin, 'head', T(0, 0.9, 0, 0, 0, 0, 0.27, 0.26, 0.26), { ao: false });
  // Eyes, brows and cheeks: the enemy faces the camera, so its face carries its identity.
  for (const side of [-1, 1]) {
    rig.add(s.lowSphere, '#1c1418', 'head', T(side * 0.09, 0.9, -0.235, 0, 0, 0, 0.035, 0.05, 0.03), { ao: false });
    rig.add(s.tinySphere, '#ffffff', 'head', T(side * 0.09 + 0.012, 0.915, -0.26, 0, 0, 0, 0.011, 0.013, 0.01), { ao: false });
    if (!player) rig.add(s.box, '#2a1a1a', 'head', T(side * 0.085, 0.965, -0.24, 0, 0, side * 0.35, 0.09, 0.025, 0.03), { ao: false });
    else rig.add(s.tinySphere, '#ef8f7c', 'head', T(side * 0.15, 0.845, -0.2, 0, 0, 0, 0.04, 0.025, 0.02), { ao: false });
  }
  if (player && !commander) {
    // Ghutra-style cloth draping from under the helmet across neck and shoulders.
    rig.add(s.lathe([[0.27, 0.93], [0.285, 0.82], [0.25, 0.72], [0.24, 0.68]], 10, -1.2, 2.4), p.cloth2, 'head', T());
    // Rounded helmet with a pointed crest, trimmed in gold.
    // Pointed kettle helmet: a dome rising into a spike, narrower than the shoulders.
    rig.add(s.lathe([[0.275, 0.93], [0.27, 1.0], [0.24, 1.08], [0.17, 1.16], [0.08, 1.24], [0.03, 1.33], [0.001, 1.36]], 14), elite ? '#e9eef2' : p.metal, 'head', T());
    rig.add(s.torus(0.275, 0.032, 4, 16), p.trim, 'head', T(0, 0.935, 0, Math.PI / 2));
    rig.add(s.lowSphere, p.trim, 'head', T(0, 1.37, 0, 0, 0, 0, 0.045, 0.045, 0.045));
    if (elite) {
      // Plume and shoulder armour distinguish the veterans.
      rig.add(s.sphere, '#ffffff', 'head', T(0, 1.26, 0.14, 0.9, 0, 0, 0.06, 0.2, 0.07));
      for (const side of [-1, 1]) rig.add(s.hood(0, Math.PI * 0.5), '#e0e6ec', 'body', T(side * 0.24, 0.6, 0, 0, 0, side * -0.5, 0.13, 0.11, 0.14));
    }
  } else if (commander) {
    // Commander: white ghutra, black agal ring and a golden crown.
    rig.add(s.hood(110, Math.PI * 0.62), p.cloth2, 'head', T(0, 0.9, 0, 0, 0, 0, 0.3, 0.3, 0.3));
    rig.add(s.lathe([[0.27, 0.9], [0.3, 0.75], [0.3, 0.62], [0.34, 0.55]], 12, -1.4, 2.8), p.cloth2, 'head', T());
    rig.add(s.torus(0.25, 0.035, 6, 20), '#1d1b1f', 'head', T(0, 1.06, 0, Math.PI / 2 - 0.12));
    rig.add(s.cyl, p.trim, 'head', T(0, 1.14, 0, -0.12, 0, 0, 0.2, 0.1, 0.2));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      rig.add(s.cone, p.trim, 'head', T(Math.sin(a) * 0.18, 1.22, Math.cos(a) * 0.18 + 0.02, -0.12, 0, 0, 0.045, 0.12, 0.045));
    }
    rig.add(s.lowSphere, '#e0473d', 'head', T(0, 1.14, -0.2, 0, 0, 0, 0.035, 0.035, 0.02), { ao: false });
    // Sash.
    rig.add(s.box, p.trim, 'body', T(0, 0.48, 0, 0, 0, 0.75, 0.07, 0.62, 0.52));
  } else {
    // Enemy: tall pointed hood with the face open toward the player.
    rig.add(s.hood(120, Math.PI * 0.6), p.metal, 'head', T(0, 0.9, 0.01, 0, 0, 0, 0.305, 0.3, 0.3));
    rig.add(s.lathe([[0.2, 1.05], [0.15, 1.17], [0.08, 1.28], [0.001, 1.36]], 12), p.metal, 'head', T(0, 0, 0.02));
    rig.add(s.lathe([[0.28, 0.85], [0.3, 0.7], [0.3, 0.6]], 12, -1.3, 2.6), p.metalDark, 'head', T());
  }
  // Arms reach forward to the weapon; weapon moves with the arms bone.
  for (const side of [-1, 1]) {
    const shoulder = V(side * 0.2, 0.57, 0), hand = player ? V(side * 0.1, 0.5, -0.36) : side < 0 ? V(-0.25, 0.45, -0.14) : V(0.22, 0.42, -0.2);
    limb(rig, s, commander ? p.clothDark : p.cloth, 'arms', shoulder, hand, 0.062);
    rig.add(s.lowSphere, p.skin, 'arms', T(hand.x, hand.y, hand.z, 0, 0, 0, 0.062, 0.062, 0.062));
  }
  if (player) {
    // Crossbow held level, pointing forward.
    const wood = elite || commander ? '#6b3f22' : p.wood, limbColor = elite || commander ? p.trim : '#3c3f4a';
    rig.add(s.box, wood, 'arms', T(0, 0.53, -0.42, 0, 0, 0, 0.075, 0.075, 0.46));
    // Bow limbs: an arc in the horizontal plane, bending back toward the shooter.
    rig.add(s.torus(0.26, 0.026, 4, 12, Math.PI * 0.7), limbColor, 'arms', T(0, 0.55, -0.36, -Math.PI / 2, 0, Math.PI * 0.15));
    for (const side of [-1, 1]) rig.add(s.tinySphere, p.trim, 'arms', T(side * 0.23, 0.55, -0.48, 0, 0, 0, 0.035, 0.035, 0.035));
    rig.add(s.cyl, p.steel, 'arms', T(0, 0.585, -0.55, Math.PI / 2, 0, 0, 0.013, 0.34, 0.013));
    rig.add(s.cone, p.trim, 'arms', T(0, 0.585, -0.74, -Math.PI / 2, 0, 0, 0.028, 0.08, 0.028));
  } else {
    // Round shield with rings on the left arm and a short spear in the right.
    rig.add(s.cyl, p.metal, 'arms', T(-0.25, 0.46, -0.27, Math.PI / 2, 0, 0, 0.23, 0.05, 0.23));
    rig.add(s.torus(0.155, 0.03, 4, 16), p.trim, 'arms', T(-0.25, 0.46, -0.3));
    rig.add(s.lowSphere, '#e8c064', 'arms', T(-0.25, 0.46, -0.3, 0, 0, 0, 0.055, 0.055, 0.04));
    rig.add(s.cyl, p.wood, 'arms', T(0.22, 0.62, -0.2, 0.25, 0, 0, 0.02, 0.85, 0.02));
    rig.add(s.cone, p.steel, 'arms', T(0.22, 1.05, -0.31, 0.25, 0, 0, 0.045, 0.14, 0.045));
  }
  return { rig, bones: HUMAN_BONES };
}

// Rock golem (the stage's beast).
function golem(s) {
  const rig = new Rig(), stone = '#8f939c', dark = '#62666f', light = '#b9bdc5';
  const bones = {
    body: { pivot: V(0, 0.55, 0) }, head: { pivot: V(0, 1.05, -0.1), parent: 'body' },
    armL: { pivot: V(-0.5, 0.95, 0), parent: 'body' }, armR: { pivot: V(0.5, 0.95, 0), parent: 'body' },
    legL: { pivot: V(-0.25, 0.45, 0) }, legR: { pivot: V(0.25, 0.45, 0) },
  };
  const flat = { flat: true };
  rig.add(s.rock, stone, 'body', T(0, 0.8, 0, 0.3, 0.4, 0, 0.5, 0.42, 0.42), flat);
  rig.add(s.rock1, dark, 'body', T(0, 1.02, 0.12, 0.2, 0.1, 0.3, 0.45, 0.3, 0.36), flat);
  rig.add(s.rock, light, 'body', T(-0.18, 0.95, -0.25, 0.5, 0, 0.2, 0.2, 0.18, 0.14), flat);
  rig.add(s.rock, light, 'body', T(0.22, 0.72, -0.3, 0.1, 0.7, 0.2, 0.18, 0.16, 0.12), flat);
  for (const [x, y, z] of [[-0.2, 1.18, 0.2], [0.18, 1.2, 0.1], [0, 1.25, 0.3]]) rig.add(s.cone, '#7ce0ff', 'body', T(x, y + 0.05, z, 0.3 * x, 0, x, 0.1, 0.36, 0.1), { flat: true, glow: true });
  rig.add(s.rock, dark, 'head', T(0, 1.14, -0.3, 0.2, 0.3, 0, 0.22, 0.18, 0.2), flat);
  for (const side of [-1, 1]) rig.add(s.lowSphere, '#9ff4ff', 'head', T(side * 0.08, 1.15, -0.47, 0, 0, 0, 0.04, 0.03, 0.02), { glow: true });
  for (const side of [-1, 1]) {
    const arm = side < 0 ? 'armL' : 'armR', leg = side < 0 ? 'legL' : 'legR';
    rig.add(s.rock, stone, arm, T(side * 0.6, 0.95, 0, 0.2, 0.5, 0.3, 0.2, 0.19, 0.2), flat);
    rig.add(s.rock1, dark, arm, T(side * 0.66, 0.66, -0.05, 0.4, 0.2, 0, 0.16, 0.2, 0.16), flat);
    rig.add(s.rock, stone, arm, T(side * 0.7, 0.36, -0.1, 0.1, 0.9, 0.3, 0.26, 0.24, 0.26), flat);
    rig.add(s.rock, dark, leg, T(side * 0.27, 0.35, 0, 0.2, 0.4, 0, 0.19, 0.2, 0.19), flat);
    rig.add(s.rock1, stone, leg, T(side * 0.28, 0.12, -0.04, 0, 0.2, 0, 0.21, 0.13, 0.24), flat);
  }
  return { rig, bones };
}

// Giant armoured knight boss with a spiked flail.
function knight(s) {
  const rig = new Rig();
  const steel = '#6a7690', steelDark = '#3a4152', silver = '#dfe5ee', red = '#c3222e', gold = '#f0c050';
  const bones = {
    body: { pivot: V(0, 0.5, 0) }, head: { pivot: V(0, 1.0, 0), parent: 'body' },
    armL: { pivot: V(-0.36, 0.95, 0), parent: 'body' }, armR: { pivot: V(0.36, 0.95, 0), parent: 'body' },
    legL: { pivot: V(-0.17, 0.45, 0) }, legR: { pivot: V(0.17, 0.45, 0) },
  };
  for (const side of [-1, 1]) {
    const leg = side < 0 ? 'legL' : 'legR';
    limb(rig, s, steelDark, leg, V(side * 0.17, 0.46, 0), V(side * 0.18, 0.12, 0), 0.11);
    rig.add(s.sphere, silver, leg, T(side * 0.18, 0.3, -0.08, 0, 0, 0, 0.1, 0.09, 0.08));
    rig.add(s.box, steel, leg, T(side * 0.18, 0.06, -0.05, 0, 0, 0, 0.2, 0.12, 0.3));
  }
  rig.add(s.lathe([[0.001, 0.4], [0.3, 0.42], [0.36, 0.6], [0.4, 0.82], [0.38, 0.96], [0.22, 1.04], [0.001, 1.06]], 16), steel, 'body', T());
  rig.add(s.box, red, 'body', T(0, 0.52, -0.3, -0.12, 0, 0, 0.36, 0.42, 0.04));
  // Long cape behind the giant.
  rig.add(s.lathe([[0.3, 1.0], [0.42, 0.7], [0.5, 0.35], [0.55, 0.08]], 12, -1.2, 2.4), red, 'body', T());
  rig.add(s.torus(0.33, 0.04, 6, 18), steelDark, 'body', T(0, 0.52, 0, Math.PI / 2));
  rig.add(s.lowSphere, gold, 'body', T(0, 0.52, -0.33, 0, 0, 0, 0.06, 0.06, 0.04));
  // Chest plate ridges.
  rig.add(s.lowSphere, '#ff4a3a', 'body', T(0, 0.8, -0.4, 0, 0, 0, 0.05, 0.05, 0.03), { glow: true });
  for (const side of [-1, 1]) {
    const arm = side < 0 ? 'armL' : 'armR';
    rig.add(s.hood(0, Math.PI * 0.55), steel, arm, T(side * 0.4, 0.98, 0, 0, 0, side * -0.4, 0.2, 0.18, 0.2));
    for (const [dx, dy] of [[0.05, 0.17], [0.16, 0.1]]) rig.add(s.cone, silver, arm, T(side * (0.4 + dx), 0.98 + dy, 0, 0, 0, side * -0.7, 0.045, 0.16, 0.045));
    const hand = side < 0 ? V(-0.48, 0.5, -0.12) : V(0.5, 0.55, -0.2);
    limb(rig, s, steelDark, arm, V(side * 0.42, 0.9, 0), hand, 0.085);
    rig.add(s.sphere, steel, arm, T(hand.x, hand.y, hand.z, 0, 0, 0, 0.11, 0.1, 0.11));
  }
  // Flail: handle, chain and spiked ball in the right hand.
  rig.add(s.cyl, '#5a3a24', 'armR', T(0.5, 0.55, -0.34, Math.PI / 2, 0, 0, 0.025, 0.3, 0.025));
  for (let i = 0; i < 4; i++) rig.add(s.torus(0.035, 0.012, 4, 8), steelDark, 'armR', T(0.52 + i * 0.03, 0.5 - i * 0.07, -0.5 - i * 0.02, 0, i % 2 ? Math.PI / 2 : 0, 0.4));
  rig.add(s.sphere, '#2a2d36', 'armR', T(0.65, 0.18, -0.58, 0, 0, 0, 0.17, 0.17, 0.17));
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, dir = V(Math.cos(a), Math.sin(a) * 0.7, Math.sin(a * 2) * 0.6).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    rig.add(s.cone, silver, 'armR', new THREE.Matrix4().compose(V(0.65, 0.18, -0.58).add(dir.clone().multiplyScalar(0.19)), q, V(0.045, 0.14, 0.045)));
  }
  // Helm with visor slit, glowing eyes and horns.
  rig.add(s.sphere, steel, 'head', T(0, 1.16, -0.02, 0, 0, 0, 0.21, 0.23, 0.22));
  rig.add(s.box, '#0e0f14', 'head', T(0, 1.15, -0.21, 0, 0, 0, 0.26, 0.04, 0.04));
  for (const side of [-1, 1]) {
    rig.add(s.lowSphere, '#ff4a3a', 'head', T(side * 0.06, 1.15, -0.235, 0, 0, 0, 0.03, 0.018, 0.01), { glow: true });
    rig.add(s.cone, silver, 'head', T(side * 0.2, 1.3, 0, 0, 0, side * -0.6, 0.05, 0.22, 0.05));
  }
  rig.add(s.box, silver, 'head', T(0, 1.32, 0, 0, 0, 0, 0.04, 0.12, 0.3));
  return { rig, bones };
}

function humanClips() {
  const run = [], shoot = [], hit = [], death = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, swing = Math.sin(a) * 0.75;
    run.push({ y: Math.abs(Math.cos(a)) * 0.06, rx: -0.12, legL: { rx: swing }, legR: { rx: -swing }, arms: { rx: Math.sin(a) * 0.08, y: Math.cos(a * 2) * 0.01 }, head: { rx: 0.05 }, body: { rz: Math.sin(a) * 0.05 } });
  }
  for (let i = 0; i < 3; i++) { const k = [1, 0.6, 0.2][i]; shoot.push({ rx: 0.1 * k, arms: { z: 0.08 * k, rx: -0.12 * k }, head: { rx: -0.05 * k } }); }
  hit.push({ rx: 0.28, arms: { rx: 0.3 }, head: { rx: -0.2 } }, { rx: 0.14, arms: { rx: 0.15 } });
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    death.push({ rx: 1.45 * smooth(0, 1, t), y: 0.1 * Math.sin(t * Math.PI), z: 0.25 * t, sy: 1 - 0.25 * t, arms: { rx: 0.6 * t }, legL: { rx: -0.4 * t }, legR: { rx: -0.3 * t } });
  }
  return { idle: { poses: [{ arms: { rx: 0 } }], duration: 1, loop: true }, run: { poses: run, duration: 0.42, loop: true }, shoot: { poses: shoot, duration: 0.3 }, hit: { poses: hit, duration: 0.2 }, death: { poses: death, duration: 0.6 } };
}

function giantClips(heavy) {
  const walk = [], attack = [], death = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, swing = Math.sin(a) * 0.45;
    walk.push({ y: Math.abs(Math.cos(a)) * 0.04, rz: Math.sin(a) * 0.05, legL: { rx: swing }, legR: { rx: -swing }, armL: { rx: -swing * 0.6 }, armR: { rx: swing * 0.6 } });
  }
  const keys = [
    { armR: { rx: 0 }, armL: { rx: 0 } },
    { rx: 0.15, armR: { rx: -2.3, rz: 0.2 }, armL: { rx: -0.3 }, head: { rx: -0.2 } },
    { rx: 0.2, armR: { rx: -2.8, rz: 0.3 }, armL: { rx: -0.5 }, head: { rx: -0.25 } },
    { rx: -0.25, y: -0.03, armR: { rx: 0.6 }, armL: { rx: 0.4 }, head: { rx: 0.15 } },
    { rx: -0.2, y: -0.04, armR: { rx: 0.5 }, armL: { rx: 0.3 }, head: { rx: 0.1 } },
    { rx: -0.05, armR: { rx: 0.1 }, armL: { rx: 0.05 } },
  ];
  if (!heavy) keys[1] = { rx: 0.1, armR: { rx: -1.6 }, armL: { rx: -1.6 } }, keys[2] = { rx: 0.15, armR: { rx: -2.2 }, armL: { rx: -2.2 } }, keys[3] = { rx: -0.3, armR: { rx: 0.5 }, armL: { rx: 0.5 } };
  attack.push(...keys);
  for (let i = 0; i < 5; i++) { const t = i / 4; death.push({ rx: 1.4 * smooth(0, 1, t), z: 0.4 * t, y: -0.05 * t, sy: 1 - 0.2 * t, armL: { rz: -0.8 * t }, armR: { rz: 0.8 * t } }); }
  return { idle: { poses: [{}, { y: -0.015, armL: { rz: -0.05 }, armR: { rz: 0.05 } }], duration: 1.6, loop: true }, run: { poses: walk, duration: 0.9, loop: true }, attack: { poses: attack, duration: 1 }, hit: { poses: [{ rx: 0.08 }], duration: 0.2 }, death: { poses: death, duration: 1.4 } };
}

export class ChibiFactory {
  // Crowd soldiers use a lighter tessellation; singular heroes and giants keep full detail.
  constructor() { this.shapes = new Shapes(1); this.crowdShapes = new Shapes(0.62); this.cache = new Map(); }
  materials() {
    if (!this.body) {
      this.body = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
      // Toon-style silhouette darkening keeps neighbours in a packed crowd distinct.
      this.body.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
          'float rim = 1.0 - saturate(abs(dot(normal, normalize(vViewPosition))));\n  outgoingLight *= 1.0 - 0.5 * pow(rim, 2.2);\n  #include <opaque_fragment>');
      };
      this.body.customProgramCacheKey = () => 'chibi-rim';
    }
    this.glow ??= new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    return { body: this.body, glow: this.glow };
  }
  // Returns { frames: [{ parts }], clips } matching the shared crowd batch format.
  model(type) {
    if (this.cache.has(type)) return this.cache.get(type);
    const shapes = ['recruit', 'elite', 'enemyGrunt'].includes(type) ? this.crowdShapes : this.shapes;
    const { rig, bones } = type === 'desertBeast' ? golem(shapes) : type === 'giantBoss' ? knight(shapes) : humanoid(type, shapes);
    const clips = ['desertBeast', 'giantBoss'].includes(type) ? giantClips(type === 'giantBoss') : humanClips();
    const { body, glow } = this.materials();
    const frames = [], outClips = {};
    for (const [state, clip] of Object.entries(clips)) {
      const indices = [];
      for (const pose of clip.poses) {
        const [geometry, glowGeometry] = rig.bake(pose, bones);
        const parts = [{ geometry, material: body }];
        if (glowGeometry) parts.push({ geometry: glowGeometry, material: glow });
        indices.push(frames.length); frames.push({ parts, count: 0 });
      }
      outClips[state] = { frames: indices, duration: clip.duration, loop: !!clip.loop };
    }
    for (const { geometry } of [...rig.parts, ...rig.glow]) geometry.dispose();
    const model = { frames, clips: outClips };
    this.cache.set(type, model);
    return model;
  }
  static triangles(model) { return model.frames[0].parts.reduce((sum, part) => sum + part.geometry.attributes.position.count / 3, 0); }
}

// Minimal stand-in for AssetManager.animatedModel so the start-screen preview can
// inspect the procedural soldier without a GLB request.
export function chibiPreviewSource(factory) {
  return {
    models: new Map(),
    async animatedModel(definition) {
      const model = factory.model(definition.previewType || 'recruit');
      const root = new THREE.Group();
      for (const part of model.frames[0].parts) root.add(new THREE.Mesh(part.geometry, part.material));
      const idle = { play() { return idle; }, reset() { return idle; } };
      return { root, mixer: { update() {} }, actions: { idle } };
    },
  };
}
