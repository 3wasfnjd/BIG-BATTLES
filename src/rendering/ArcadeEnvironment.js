import * as THREE from 'three';
import { GeometryBuilder } from './PlaceholderFactory.js';
import { chamferedStone } from './QualityGeometry.js';

// Bright stone causeway over the sea. Everything is generated locally: one small canvas
// texture for the paving, one shader plane for water and a handful of instanced props.
export const DECK_HALF_WIDTH = 8.4;

function pavingTexture(size = 512) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  let seed = 91;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  ctx.fillStyle = '#a89b88'; ctx.fillRect(0, 0, size, size);
  // 8 x 8 m texture: rows of 2 m flagstones with staggered widths.
  const unit = size / 4, gap = 4;
  for (let row = 0; row < 4; row++) {
    let x = -unit * (row * 0.37 % 1);
    while (x < size) {
      const w = unit * [1, 1.5, 1.25, 0.75][Math.floor(random() * 4)];
      const tone = 206 + random() * 30, warm = random() * 10;
      for (const offset of [0, size]) {
        const x0 = x - offset;
        if (x0 + w < 0 || x0 > size) continue;
        const y0 = row * unit;
        const grad = ctx.createLinearGradient(x0, y0, x0 + w, y0 + unit);
        grad.addColorStop(0, `rgb(${tone + 10},${tone + 6 - warm},${tone - 6 - warm})`);
        grad.addColorStop(1, `rgb(${tone - 8},${tone - 11 - warm},${tone - 22 - warm})`);
        ctx.fillStyle = grad; ctx.fillRect(x0 + gap, y0 + gap, w - gap * 2, unit - gap * 2);
        // Bevel: light top/left edge, darker bottom/right edge.
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x0 + gap, y0 + gap, w - gap * 2, 5); ctx.fillRect(x0 + gap, y0 + gap, 5, unit - gap * 2);
        ctx.fillStyle = 'rgba(80,60,40,0.25)'; ctx.fillRect(x0 + gap, y0 + unit - gap - 6, w - gap * 2, 6); ctx.fillRect(x0 + w - gap - 6, y0 + gap, 6, unit - gap * 2);
      }
      x += w;
    }
  }
  // Fine speckle and a few cracks keep large surfaces from looking flat.
  for (let i = 0; i < 2600; i++) {
    const v = random() < 0.5 ? 255 : 90;
    ctx.fillStyle = `rgba(${v},${v - 10},${v - 25},${0.04 + random() * 0.06})`;
    ctx.fillRect(random() * size, random() * size, 1 + random() * 2, 1 + random() * 2);
  }
  ctx.strokeStyle = 'rgba(90,75,60,0.35)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    let x = random() * size, y = random() * size; ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (random() - 0.5) * 30; y += random() * 18; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function waterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 2 } },
    vertexShader: `varying vec3 vWorld; varying float vDepth;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float time; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
      varying vec3 vWorld; varying float vDepth;
      float wave(vec2 p){ return sin(p.x*0.9+time*1.3+sin(p.y*0.35+time*0.4)*2.0)*0.5+sin(p.y*1.3-time*1.1+p.x*0.3)*0.5; }
      void main(){
        vec2 p = vWorld.xz;
        float edge = smoothstep(9.0, 30.0, abs(p.x));
        vec3 shallow = vec3(0.23,0.72,0.86), deep = vec3(0.07,0.42,0.72);
        vec3 col = mix(shallow, deep, edge);
        float w = wave(p*0.55) + 0.5*wave(p*1.4+7.0);
        col += vec3(0.10,0.14,0.16) * smoothstep(0.55, 1.2, w);
        // Glints and foam along the causeway.
        float glint = smoothstep(1.32, 1.45, w + 0.35*sin(p.x*3.1+p.y*2.3+time*2.0));
        col += vec3(0.55) * glint;
        float foam = 1.0 - smoothstep(0.0, 1.6, abs(p.x) - 8.9);
        col = mix(col, vec3(0.92,0.97,1.0), foam * (0.55 + 0.25*sin(p.y*2.0+time*3.0)));
        float f = smoothstep(fogNear, fogFar, vDepth);
        gl_FragColor = vec4(mix(col, fogColor, f), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export class ArcadeEnvironment {
  constructor(scene, length) {
    this.length = length; this.scene = scene;
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    // Sea.
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2), waterMaterial());
    this.water.position.y = -1.6; scene.add(this.water);
    // Deck with a tiled canvas texture (4 m repeat).
    const deckLength = length + 120, texture = pavingTexture();
    texture.repeat.set(DECK_HALF_WIDTH * 2 / 8, deckLength / 8);
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(DECK_HALF_WIDTH * 2, deckLength).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: texture }));
    deck.position.set(0, 0, -deckLength / 2 + 40); deck.receiveShadow = true; scene.add(deck);
    this.deck = deck;
    // Bridge flanks down to the water.
    const flankTexture = texture.clone(); flankTexture.repeat.set(deckLength / 8, 0.3); flankTexture.needsUpdate = true;
    const flankMaterial = new THREE.MeshLambertMaterial({ map: flankTexture, color: '#b8ab98' });
    for (const side of [-1, 1]) {
      const flank = new THREE.Mesh(new THREE.PlaneGeometry(deckLength, 2.4), flankMaterial);
      flank.rotation.y = side * Math.PI / 2; flank.position.set(side * (DECK_HALF_WIDTH + 0.92), -0.6, deck.position.z); scene.add(flank);
    }
    const dummy = new THREE.Object3D(), list = new Map();
    const place = (key, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => {
      dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, ry, 0); dummy.updateMatrix();
      if (!list.has(key)) list.set(key, []); list.get(key).push(dummy.matrix.clone());
    };
    let seed = 1234;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const kit = this.kit();
    for (let z = 40; z > -length - 80; z -= 2) {
      for (const side of [-1, 1]) {
        const tone = random() * 0.06;
        place(random() < 0.5 ? 'blockA' : 'blockB', side * (DECK_HALF_WIDTH + 0.45), 0, z - 1, 1, 1 + tone, 1);
      }
    }
    for (let z = 32; z > -length - 80; z -= 16) {
      for (const side of [-1, 1]) {
        place('pillar', side * (DECK_HALF_WIDTH + 0.45), 0, z);
        place('banner', side * (DECK_HALF_WIDTH + 0.45), 0, z, 1, 1, 1, side > 0 ? Math.PI : 0);
        place('pier', side * (DECK_HALF_WIDTH + 0.9), 0, z);
      }
    }
    // Rocks in the water near the bridge.
    for (let i = 0; i < 70; i++) {
      const side = random() < 0.5 ? -1 : 1, z = 30 - random() * (length + 100);
      const s = 0.5 + random() * 1.6;
      place('rock', side * (DECK_HALF_WIDTH + 3 + random() * 16), -1.5, z, s, s * (0.5 + random() * 0.5), s, random() * 6);
    }
    this.meshes = [];
    for (const [key, matrices] of list) {
      const mesh = new THREE.InstancedMesh(kit[key], material, matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = key === 'pillar' || key === 'banner'; mesh.receiveShadow = false;
      mesh.computeBoundingSphere(); scene.add(mesh); this.meshes.push(mesh);
    }
    // Final fortress gate, a single mesh past the end of the route.
    const fort = this.fortress(); fort.position.z = -length - 6; scene.add(fort);
  }
  kit() {
    const stone = chamferedStone(), box = new THREE.BoxGeometry(), cyl = new THREE.CylinderGeometry(1, 1, 1, 10), cone = new THREE.ConeGeometry(1, 1, 10);
    const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
    const build = fill => { const b = new GeometryBuilder(); fill(b); const g = b.finish(); g.computeVertexNormals(); return g; };
    const kit = {
      blockA: build(b => { b.add(stone, '#cbbda6', 0, 0.42, 0, 0.95, 0.84, 1.96); b.add(stone, '#e2d6c2', 0, 0.92, 0, 1.12, 0.18, 1.98); }),
      blockB: build(b => { b.add(stone, '#c2b39b', 0, 0.42, 0, 0.95, 0.84, 1.96); b.add(stone, '#ddd0ba', 0, 0.92, 0, 1.12, 0.18, 1.98); }),
      pillar: build(b => {
        b.add(stone, '#c9baa2', 0, 1.1, 0, 1.5, 2.2, 1.5); b.add(stone, '#e6dac6', 0, 2.3, 0, 1.75, 0.3, 1.75);
        b.add(cone, '#2b8f52', 0, 2.95, 0, 0.62, 1.0, 0.62); b.add(new THREE.SphereGeometry(1, 8, 6), '#f2c14e', 0, 3.5, 0, 0.13, 0.13, 0.13);
      }),
      banner: build(b => {
        b.add(box, '#2fae5b', 0.8, 1.35, 0, 0.06, 1.6, 0.9); b.add(box, '#f2c14e', 0.84, 1.35, 0, 0.02, 1.2, 0.18);
        b.add(box, '#f2c14e', 0.8, 2.18, 0, 0.1, 0.08, 1.0);
      }),
      pier: build(b => { b.add(stone, '#a99a84', 0, -1.2, 0, 2.6, 2.6, 2.6); b.add(stone, '#b8a992', 0, -0.2, 0, 2.2, 0.4, 2.2); }),
      rock: build(b => { b.add(rockGeometry, '#9aa3a8', 0, 0, 0, 1, 1, 1); b.add(rockGeometry, '#b4bcc0', 0.4, 0.3, 0.2, 0.55, 0.5, 0.55); }),
    };
    stone.dispose(); box.dispose(); cyl.dispose(); cone.dispose(); rockGeometry.dispose();
    return kit;
  }
  fortress() {
    const b = new GeometryBuilder(), box = new THREE.BoxGeometry(), cone = new THREE.ConeGeometry(1, 1, 10), cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
    const wall = '#c8b393', top = '#ddcdb2', red = '#c42f3a';
    for (const x of [-11.5, 11.5]) {
      b.add(cyl, wall, x, 6, 0, 3.4, 12, 3.4);
      b.add(cyl, top, x, 12.2, 0, 3.8, 0.6, 3.8);
      b.add(cone, red, x, 15, 0, 3.9, 5, 3.9);
      b.add(box, '#3b2a24', x + (x < 0 ? 3.3 : -3.3), 7, 1, 0.1, 1.6, 0.6);
    }
    b.add(box, wall, 0, 7, 0, 20, 6, 4);
    b.add(box, top, 0, 10.2, 0, 20.5, 0.5, 4.4);
    for (let i = 0; i < 9; i++) b.add(box, wall, -8 + i * 2, 10.9, 1.8, 1.1, 1.0, 0.8);
    b.add(box, '#4a3328', 0, 2.2, 0.8, 9, 4.6, 2.6);
    for (const x of [-8.2, 8.2]) b.add(box, wall, x, 2.2, 0.8, 1.8, 4.4, 3.6);
    for (const x of [-5, 5]) { b.add(box, red, x, 6.5, 2.05, 1.6, 3.4, 0.1); b.add(box, '#f4e9dc', x, 6.8, 2.12, 0.5, 0.5, 0.05); }
    const mesh = new THREE.Mesh(b.finish(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.castShadow = true;
    box.dispose(); cone.dispose(); cyl.dispose();
    return mesh;
  }
  update(z, time = 0, fog = null) {
    this.water.position.x = 0; this.water.position.z = -z - 30;
    const u = this.water.material.uniforms; u.time.value = time;
    if (fog) { u.fogColor.value.copy(fog.color); u.fogNear.value = fog.near; u.fogFar.value = fog.far; }
  }
}
