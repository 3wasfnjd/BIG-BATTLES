import * as THREE from 'three';
import { GeometryBuilder } from './PlaceholderFactory.js';
import { chamferedStone } from './QualityGeometry.js';
import { DECK_HALF_WIDTH } from './ArcadeEnvironment.js';

// One look per defence stage. Everything is generated at runtime: canvas paving, a shader
// ground plane, instanced scenery, drifting particles and a soft cloud-shadow layer.
const rgb = hex => new THREE.Color(hex);
export const THEMES = {
  sea: {
    sky: '#7fcbe6', fog: [60, 130], exposure: 1.08, hemi: ['#fdfbf5', '#8d8a80', 1.15], sun: ['#fff0d6', 3.1], vignette: '#0b3a5a',
    paving: { bg: '#a89b88', tone: 206, spread: 30, warm: 10 },
    ground: { a: '#3bb8dc', b: '#1269b8', hi: '#1a2429', glint: 0.55, edge: '#eef8ff', edgeStrength: 0.6, speed: 1, glow: 0 },
    stone: ['#cbbda6', '#e2d6c2'], pillarCap: '#2b8f52', fort: ['#c8b393', '#ddcdb2', '#c42f3a'],
    scatter: 'rock', particles: null, clouds: 0.13,
  },
  canyon: {
    sky: '#f2c48e', fog: [55, 120], exposure: 1.05, hemi: ['#fff1dc', '#9a6a48', 1.1], sun: ['#ffe2b8', 3.2], vignette: '#5a2a10',
    paving: { bg: '#9a7a5c', tone: 196, spread: 28, warm: 26 },
    ground: { a: '#e7b173', b: '#c0703f', hi: '#fff0d0', glint: 0, edge: '#f3cf9c', edgeStrength: 0.35, speed: 0, glow: 0 },
    stone: ['#c79a6c', '#e0bb8c'], pillarCap: '#c4552e', fort: ['#b9774a', '#d49a66', '#7a2a1e'],
    scatter: 'mesa', particles: { color: '#fff1d6', count: 90, size: 0.12, fall: -0.15, drift: 1.2, additive: false, opacity: 0.5 }, clouds: 0.1,
  },
  snow: {
    sky: '#cfe4f4', fog: [45, 115], exposure: 1.0, hemi: ['#ffffff', '#9fb2c8', 1.35], sun: ['#fff6ea', 2.6], vignette: '#28476a',
    paving: { bg: '#8e97a3', tone: 196, spread: 26, warm: -8, snow: true },
    ground: { a: '#ffffff', b: '#c5d8ee', hi: '#ffffff', glint: 0.9, edge: '#ffffff', edgeStrength: 0.2, speed: 0.15, glow: 0 },
    stone: ['#b9c2cc', '#f4f8fc'], pillarCap: '#f7fbff', fort: ['#8f9aa8', '#e9f0f7', '#3a5a8a'],
    scatter: 'pine', particles: { color: '#ffffff', count: 260, size: 0.16, fall: 1.4, drift: 0.6, additive: false, opacity: 0.9 }, clouds: 0.08,
  },
  lava: {
    sky: '#2a1428', fog: [40, 105], exposure: 1.12, hemi: ['#d9b8ff', '#4a1a14', 1.0], sun: ['#ffc9a0', 2.1], vignette: '#1a0008',
    paving: { bg: '#b8440f', tone: 50, spread: 22, warm: -8, seams: true },
    ground: { a: '#241414', b: '#140a0c', hi: '#ff5a14', glint: 0.9, edge: '#ff7a24', edgeStrength: 0.75, speed: 0.45, glow: 1 },
    stone: ['#3b3036', '#56474e'], pillarCap: '#b14cff', fort: ['#2e2429', '#4a3a42', '#9a1c2c'],
    scatter: 'spire', particles: { color: '#ff8a3a', count: 160, size: 0.14, fall: -1.1, drift: 0.8, additive: true, opacity: 1 }, clouds: 0,
  },
};
export const STAGE_THEME = ['sea', 'canyon', 'snow', 'lava'];

function random(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }

function paving(theme, size = 512) {
  const { bg, tone: base, spread, warm, snow, seams } = theme.paving;
  const color = document.createElement('canvas'), glow = seams ? document.createElement('canvas') : null;
  for (const c of [color, glow]) if (c) { c.width = c.height = size; }
  const ctx = color.getContext('2d'), gctx = glow?.getContext('2d'), r = random(91);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size);
  if (gctx) { gctx.fillStyle = '#c23a08'; gctx.fillRect(0, 0, size, size); }
  const unit = size / 4, gap = seams ? 3 : 4;
  for (let row = 0; row < 4; row++) {
    let x = -unit * (row * 0.37 % 1);
    while (x < size) {
      const w = unit * [1, 1.5, 1.25, 0.75][Math.floor(r() * 4)], tone = base + r() * spread, k = r() * Math.abs(warm) * Math.sign(warm);
      for (const offset of [0, size]) {
        const x0 = x - offset, y0 = row * unit;
        if (x0 + w < 0 || x0 > size) continue;
        const grad = ctx.createLinearGradient(x0, y0, x0 + w, y0 + unit);
        grad.addColorStop(0, `rgb(${tone + 10},${tone + 6 - k},${tone - 6 - k * 1.4})`);
        grad.addColorStop(1, `rgb(${tone - 8},${tone - 11 - k},${tone - 22 - k * 1.4})`);
        ctx.fillStyle = grad; ctx.fillRect(x0 + gap, y0 + gap, w - gap * 2, unit - gap * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x0 + gap, y0 + gap, w - gap * 2, 5); ctx.fillRect(x0 + gap, y0 + gap, 5, unit - gap * 2);
        ctx.fillStyle = 'rgba(40,30,20,0.25)'; ctx.fillRect(x0 + gap, y0 + unit - gap - 6, w - gap * 2, 6); ctx.fillRect(x0 + w - gap - 6, y0 + gap, 6, unit - gap * 2);
        if (gctx) { gctx.fillStyle = '#000'; gctx.fillRect(x0 + gap, y0 + gap, w - gap * 2, unit - gap * 2); }
      }
      x += w;
    }
  }
  for (let i = 0; i < 2600; i++) {
    const v = r() < 0.5 ? 255 : 60;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.04 + r() * 0.06})`; ctx.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2);
  }
  if (snow) {
    // Drifted snow gathered in patches and along seams.
    for (let i = 0; i < 12; i++) {
      const x = r() * size, y = r() * size, rad = 16 + r() * 36;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(0.6, 'rgba(245,250,255,0.5)'); g.addColorStop(1, 'rgba(245,250,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rad * 1.4, rad, r() * 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  const make = canvas => {
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  };
  return { map: make(color), emissiveMap: glow ? make(glow) : null };
}

function groundMaterial(theme) {
  const g = theme.ground;
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }, fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 2 },
      colorA: { value: rgb(g.a) }, colorB: { value: rgb(g.b) }, hi: { value: rgb(g.hi) }, edge: { value: rgb(g.edge) },
      glint: { value: g.glint }, edgeStrength: { value: g.edgeStrength }, speed: { value: g.speed }, glow: { value: g.glow },
    },
    vertexShader: `varying vec3 vWorld; varying float vDepth;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float time, glint, edgeStrength, speed, glow, fogNear, fogFar; uniform vec3 fogColor, colorA, colorB, hi, edge;
      varying vec3 vWorld; varying float vDepth;
      float wave(vec2 p, float t){ return sin(p.x*0.9+t*1.3+sin(p.y*0.35+t*0.4)*2.0)*0.5+sin(p.y*1.3-t*1.1+p.x*0.3)*0.5; }
      void main(){
        vec2 p = vWorld.xz; float t = time * speed;
        float far = smoothstep(9.0, 30.0, abs(p.x));
        vec3 col = mix(colorA, colorB, far);
        float w = wave(p*0.55, t) + 0.5*wave(p*1.4+7.0, t);
        float crest = smoothstep(0.55, 1.2, w);
        // Lava: bright molten crests. Other grounds: soft highlight.
        col = mix(col, hi, crest * (glow > 0.5 ? 0.85 : 0.12));
        float sparkle = smoothstep(1.32, 1.45, w + 0.35*sin(p.x*3.1+p.y*2.3+t*2.0 + time*0.7));
        col += hi * sparkle * glint * (glow > 0.5 ? 1.5 : 0.8);
        float near = 1.0 - smoothstep(0.0, 1.6, abs(p.x) - 8.9);
        col = mix(col, edge, near * edgeStrength * (0.75 + 0.25*sin(p.y*2.0+time*3.0)));
        float f = smoothstep(fogNear, fogFar, vDepth);
        gl_FragColor = vec4(mix(col, fogColor, f), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function cloudTexture() {
  const size = 256, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), r = random(7);
  for (let i = 0; i < 18; i++) {
    const x = r() * size, y = r() * size, rad = 30 + r() * 60;
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    }
  }
  const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function scenery(kind, theme) {
  const b = new GeometryBuilder(), rock = new THREE.DodecahedronGeometry(1, 0), cone = new THREE.ConeGeometry(1, 1, 7), cyl = new THREE.CylinderGeometry(1, 1, 1, 7);
  if (kind === 'rock') { b.add(rock, '#9aa3a8', 0, 0, 0, 1, 1, 1); b.add(rock, '#b4bcc0', 0.4, 0.3, 0.2, 0.55, 0.5, 0.55); }
  if (kind === 'mesa') {
    b.add(rock, '#b8623a', 0, 1.2, 0, 1.2, 1.4, 1.1); b.add(rock, '#d0875a', 0.1, 2.6, 0, 1.0, 0.7, 0.9); b.add(rock, '#e6a878', 0.05, 3.2, 0, 0.85, 0.25, 0.8);
  }
  if (kind === 'pine') {
    b.add(cyl, '#6b4a32', 0, 0.5, 0, 0.14, 1, 0.14);
    for (const [y, s] of [[1.3, 1], [2.1, 0.78], [2.8, 0.55]]) { b.add(cone, '#2f6a4a', 0, y, 0, 0.9 * s, 1.3 * s, 0.9 * s); b.add(cone, '#f6fbff', 0, y + 0.35 * s, 0, 0.6 * s, 0.6 * s, 0.6 * s); }
  }
  if (kind === 'spire') { b.add(cone, '#2a2026', 0, 1.6, 0, 0.7, 3.2, 0.7); b.add(rock, '#3a2c33', 0, 0.2, 0, 1.1, 0.6, 1.1); }
  const geometry = b.finish(); geometry.computeVertexNormals();
  rock.dispose(); cone.dispose(); cyl.dispose();
  return geometry;
}

export class ThemedEnvironment {
  constructor(scene, length, themeName = 'sea') {
    const theme = this.theme = THEMES[themeName]; this.scene = scene; this.objects = []; this.disposables = [];
    const add = object => { scene.add(object); this.objects.push(object); return object; };
    const material = new THREE.MeshLambertMaterial({ vertexColors: true }); this.disposables.push(material);
    this.ground = add(new THREE.Mesh(new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2), groundMaterial(theme)));
    this.ground.position.set(0, -1.6, -30);
    const deckLength = length + 120, { map, emissiveMap } = paving(theme);
    for (const t of [map, emissiveMap]) if (t) { t.repeat.set(DECK_HALF_WIDTH * 2 / 8, deckLength / 8); this.disposables.push(t); }
    const deckMaterial = new THREE.MeshLambertMaterial({ map, emissiveMap, emissive: emissiveMap ? '#ffffff' : '#000000', emissiveIntensity: emissiveMap ? 1.4 : 0 });
    this.deckMaterial = deckMaterial; this.disposables.push(deckMaterial);
    const deck = add(new THREE.Mesh(new THREE.PlaneGeometry(DECK_HALF_WIDTH * 2, deckLength).rotateX(-Math.PI / 2), deckMaterial));
    deck.position.set(0, 0, -deckLength / 2 + 40); deck.receiveShadow = true;
    const flankMaterial = new THREE.MeshLambertMaterial({ color: theme.stone[0] }); this.disposables.push(flankMaterial);
    for (const side of [-1, 1]) {
      const flank = add(new THREE.Mesh(new THREE.PlaneGeometry(deckLength, 2.4), flankMaterial));
      flank.rotation.y = side * Math.PI / 2; flank.position.set(side * (DECK_HALF_WIDTH + 0.92), -0.6, deck.position.z);
    }
    // Instanced walls, pillars, banners and themed scenery.
    const stone = chamferedStone(), cone = new THREE.ConeGeometry(1, 1, 10), box = new THREE.BoxGeometry();
    const build = fill => { const bb = new GeometryBuilder(); fill(bb); const g = bb.finish(); g.computeVertexNormals(); return g; };
    const kit = {
      block: build(bb => { bb.add(stone, theme.stone[0], 0, 0.42, 0, 0.95, 0.84, 1.96); bb.add(stone, theme.stone[1], 0, 0.92, 0, 1.12, 0.18, 1.98); }),
      pillar: build(bb => {
        bb.add(stone, theme.stone[0], 0, 1.1, 0, 1.5, 2.2, 1.5); bb.add(stone, theme.stone[1], 0, 2.3, 0, 1.75, 0.3, 1.75);
        bb.add(cone, theme.pillarCap, 0, 2.95, 0, 0.62, 1.0, 0.62);
      }),
      banner: build(bb => { bb.add(box, '#2fae5b', 0.8, 1.35, 0, 0.06, 1.6, 0.9); bb.add(box, '#f2c14e', 0.84, 1.35, 0, 0.02, 1.2, 0.18); bb.add(box, '#f2c14e', 0.8, 2.18, 0, 0.1, 0.08, 1.0); }),
      pier: build(bb => { bb.add(stone, theme.stone[0], 0, -1.2, 0, 2.6, 2.6, 2.6); }),
      scenery: scenery(theme.scatter, theme),
    };
    stone.dispose(); cone.dispose(); box.dispose();
    const list = Object.fromEntries(Object.keys(kit).map(k => [k, []])), dummy = new THREE.Object3D(), r = random(1234);
    const place = (key, x, y, z, sx = 1, sy = sx, sz = sx, ry = 0) => { dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, ry, 0); dummy.updateMatrix(); list[key].push(dummy.matrix.clone()); };
    for (let z = 40; z > -length - 80; z -= 2) for (const side of [-1, 1]) place('block', side * (DECK_HALF_WIDTH + 0.45), 0, z - 1, 1, 1 + r() * 0.06, 1);
    for (let z = 32; z > -length - 80; z -= 16) for (const side of [-1, 1]) {
      place('pillar', side * (DECK_HALF_WIDTH + 0.45), 0, z); place('pier', side * (DECK_HALF_WIDTH + 0.9), 0, z);
      place('banner', side * (DECK_HALF_WIDTH + 0.45), 0, z, 1, 1, 1, side > 0 ? Math.PI : 0);
    }
    const tall = theme.scatter === 'mesa' || theme.scatter === 'spire';
    for (let i = 0; i < (theme.scatter === 'pine' ? 130 : 70); i++) {
      const side = r() < 0.5 ? -1 : 1, z = 30 - r() * (length + 100), s = tall ? 1.5 + r() * 3 : theme.scatter === 'pine' ? 1 + r() * 1.3 : 0.5 + r() * 1.6;
      place('scenery', side * (DECK_HALF_WIDTH + (tall ? 6 : 3) + r() * (tall ? 30 : 18)), theme.scatter === 'rock' ? -1.5 : -1.6, z, s, s * (tall ? 0.8 + r() * 0.8 : 1), s, r() * 6);
    }
    for (const [key, matrices] of Object.entries(list)) {
      if (!matrices.length) continue;
      const mesh = add(new THREE.InstancedMesh(kit[key], material, matrices.length));
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = key === 'pillar' || key === 'banner'; mesh.computeBoundingSphere();
      this.disposables.push(kit[key]);
    }
    // Lava crystals glow on their own.
    if (theme.scatter === 'spire') {
      const crystal = new THREE.OctahedronGeometry(0.5, 0), glowMat = new THREE.MeshBasicMaterial({ color: '#c46bff', toneMapped: false });
      const mesh = add(new THREE.InstancedMesh(crystal, glowMat, 40)); this.disposables.push(crystal, glowMat);
      for (let i = 0; i < 40; i++) { const side = r() < 0.5 ? -1 : 1; dummy.position.set(side * (DECK_HALF_WIDTH + 2 + r() * 12), -1 + r() * 0.5, 30 - r() * (length + 90)); dummy.scale.set(0.6 + r(), 1.2 + r() * 2, 0.6 + r()); dummy.rotation.set(0, r() * 3, (r() - 0.5) * 0.6); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); }
    }
    const fort = add(this.fortress(theme)); fort.position.z = -length - 6;
    // Drifting cloud shadows over the battlefield.
    if (theme.clouds) {
      this.cloudMap = cloudTexture(); this.cloudMap.repeat.set(1.2, 2);
      const cloudMat = new THREE.MeshBasicMaterial({ color: '#0a1a2a', alphaMap: this.cloudMap, transparent: true, opacity: theme.clouds, depthWrite: false });
      this.clouds = add(new THREE.Mesh(new THREE.PlaneGeometry(40, 90).rotateX(-Math.PI / 2), cloudMat)); this.clouds.position.set(0, 0.03, -25); this.clouds.renderOrder = 1;
      this.disposables.push(this.cloudMap, cloudMat);
    }
    if (theme.particles) this.particles = add(this.makeParticles(theme.particles));
  }
  makeParticles(p) {
    const positions = new Float32Array(p.count * 3), r = random(55);
    for (let i = 0; i < p.count; i++) { positions[i * 3] = (r() - 0.5) * 40; positions[i * 3 + 1] = r() * 16; positions[i * 3 + 2] = 10 - r() * 70; }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dot = document.createElement('canvas'); dot.width = dot.height = 32; const ctx = dot.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
    const map = new THREE.CanvasTexture(dot);
    const material = new THREE.PointsMaterial({ color: p.color, size: p.size * 3, map, transparent: true, opacity: p.opacity, depthWrite: false, blending: p.additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: !p.additive });
    this.disposables.push(geometry, material, map); this.particleSpec = p;
    const points = new THREE.Points(geometry, material); points.frustumCulled = false; return points;
  }
  fortress(theme) {
    const b = new GeometryBuilder(), box = new THREE.BoxGeometry(), cone = new THREE.ConeGeometry(1, 1, 10), cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
    const [wall, top, roof] = theme.fort;
    for (const x of [-11.5, 11.5]) { b.add(cyl, wall, x, 6, 0, 3.4, 12, 3.4); b.add(cyl, top, x, 12.2, 0, 3.8, 0.6, 3.8); b.add(cone, roof, x, 15, 0, 3.9, 5, 3.9); }
    b.add(box, wall, 0, 7, 0, 20, 6, 4); b.add(box, top, 0, 10.2, 0, 20.5, 0.5, 4.4);
    for (let i = 0; i < 9; i++) b.add(box, wall, -8 + i * 2, 10.9, 1.8, 1.1, 1.0, 0.8);
    b.add(box, '#2a1c18', 0, 2.2, 0.8, 9, 4.6, 2.6);
    for (const x of [-8.2, 8.2]) b.add(box, wall, x, 2.2, 0.8, 1.8, 4.4, 3.6);
    for (const x of [-5, 5]) b.add(box, roof, x, 6.5, 2.05, 1.6, 3.4, 0.1);
    const geometry = b.finish(), material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.disposables.push(geometry, material); box.dispose(); cone.dispose(); cyl.dispose();
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; return mesh;
  }
  update(z, time, fog, dt = 0) {
    const u = this.ground.material.uniforms; u.time.value = time;
    if (fog) { u.fogColor.value.copy(fog.color); u.fogNear.value = fog.near; u.fogFar.value = fog.far; }
    if (this.cloudMap) { this.cloudMap.offset.x = time * 0.004; this.cloudMap.offset.y = -time * 0.012; }
    if (this.deckMaterial.emissiveMap) this.deckMaterial.emissiveIntensity = 0.75 + Math.sin(time * 2.2) * 0.25;
    if (this.particles && dt) {
      const p = this.particleSpec, a = this.particles.geometry.attributes.position, arr = a.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += Math.sin(time * 0.7 + i) * p.drift * dt;
        arr[i + 1] -= p.fall * dt * (0.6 + (i % 7) * 0.08);
        if (arr[i + 1] < 0) arr[i + 1] += 16; else if (arr[i + 1] > 16) arr[i + 1] -= 16;
        if (arr[i] > 20) arr[i] -= 40; else if (arr[i] < -20) arr[i] += 40;
      }
      a.needsUpdate = true;
    }
  }
  dispose() {
    for (const object of this.objects) { this.scene.remove(object); object.geometry?.dispose?.(); if (object.material?.isShaderMaterial) object.material.dispose(); }
    for (const d of this.disposables) d.dispose?.();
    this.objects.length = 0;
  }
}
