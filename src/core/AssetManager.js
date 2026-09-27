import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { releaseAssetUrl } from './release.js';

// Pose geometry is shared by every unit using that pose: no rig or mixer per crowd soldier.
const POSE_SAMPLES = { idle: 1, run: 8, shoot: 3, hit: 3, death: 4 };
export class AssetManager {
  constructor() { this.models = new Map(); this.simpleMaterials = new WeakMap(); }
  simplifyPrototype(gltf) {
    let prototype = false;
    gltf.scene.traverse(object => { if (object.userData.artStatus === 'procedural-prototype') prototype = true; });
    if (!prototype) return;
    gltf.scene.traverse(mesh => {
      if (!mesh.isMesh || Array.isArray(mesh.material) || mesh.material.isMeshLambertMaterial) return;
      const source = mesh.material;
      if (!this.simpleMaterials.has(source)) this.simpleMaterials.set(source, new THREE.MeshLambertMaterial({ name: source.name, color: source.color, vertexColors: source.vertexColors, side: source.side }));
      mesh.material = this.simpleMaterials.get(source);
    });
  }
  loadModel(url) {
    if (!this.models.has(url)) this.models.set(url, import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync(releaseAssetUrl(url))));
    return this.models.get(url);
  }
  bakeParts(root) {
    root.updateMatrixWorld(true);
    const groups = new Map(), vertex = new THREE.Vector3();
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) throw new Error('Crowd GLB must use one material per mesh; split material groups before export.');
      mesh.skeleton?.update();
      const geometry = mesh.geometry.clone(), position = geometry.attributes.position;
      for (let i = 0; i < position.count; i++) { mesh.getVertexPosition(i, vertex); position.setXYZ(i, vertex.x, vertex.y, vertex.z); }
      geometry.morphAttributes = {};
      geometry.deleteAttribute('skinIndex'); geometry.deleteAttribute('skinWeight');
      geometry.applyMatrix4(mesh.matrixWorld); geometry.computeVertexNormals();
      if (!groups.has(mesh.material)) groups.set(mesh.material, []);
      groups.get(mesh.material).push(geometry);
    });
    if (!groups.size) throw new Error('GLB contains no mesh');
    const parts = [];
    for (const [material, geometries] of groups) {
      const merged = geometries.length > 1 ? mergeGeometries(geometries, false) : geometries[0];
      if (merged && geometries.length > 1) geometries.forEach(g => g.dispose());
      if (merged) parts.push({ geometry: merged, material });
      else for (const geometry of geometries) parts.push({ geometry, material });
    }
    return parts;
  }
  async staticParts(definition) {
    const gltf = await this.loadModel(definition.modelUrl);
    return this.bakeParts(gltf.scene);
  }
  async crowdModel(definition) {
    const gltf = await this.loadModel(definition.modelUrl);
    this.simplifyPrototype(gltf);
    const rest = this.bakeParts(gltf.scene), frames = [{ parts: rest }], clips = {};
    // Honor arbitrary static GLBs; large/multipart imports stay on the cheap rest-pose path.
    const vertices = rest.reduce((sum, p) => sum + p.geometry.attributes.position.count, 0);
    if (!gltf.animations.length || vertices > 12000 || rest.length > 2) return { frames, clips };
    const { clone } = await import('three/addons/utils/SkeletonUtils.js');
    const root = clone(gltf.scene), mixer = new THREE.AnimationMixer(root);
    for (const [state, samples] of Object.entries(POSE_SAMPLES)) {
      const name = definition.animations?.[state];
      const clip = gltf.animations.find(c => c.name.toLowerCase() === name?.toLowerCase());
      if (!clip) continue;
      mixer.stopAllAction(); const action = mixer.clipAction(clip); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
      const indices = [];
      for (let frame = 0; frame < samples; frame++) {
        // Loop poses omit the duplicate last frame; one-shot poses include their endpoint.
        const phase = frame / ((state === 'run' || state === 'idle') ? samples : Math.max(1, samples - 1));
        mixer.setTime(clip.duration * phase);
        indices.push(frames.length); frames.push({ parts: this.bakeParts(root) });
      }
      clips[state] = { frames: indices, duration: clip.duration, loop: state === 'run' || state === 'idle' };
      // Keep a long asset bake from monopolizing the browser's first input frames.
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    mixer.stopAllAction(); mixer.uncacheRoot(root);
    return { frames, clips };
  }
  async animatedModel(definition) {
    const [gltf, { clone }] = await Promise.all([this.loadModel(definition.modelUrl), import('three/addons/utils/SkeletonUtils.js')]);
    this.simplifyPrototype(gltf);
    const root = clone(gltf.scene), mixer = new THREE.AnimationMixer(root), actions = {};
    for (const [state, name] of Object.entries(definition.animations || {})) {
      const clip = gltf.animations.find(animation => animation.name.toLowerCase() === name.toLowerCase());
      if (clip) {
        const action = mixer.clipAction(clip);
        if (['hit', 'death', 'attack', 'shoot'].includes(state)) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
        actions[state] = action;
      }
    }
    return { root, mixer, actions };
  }
}
