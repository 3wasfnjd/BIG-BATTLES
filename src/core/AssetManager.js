import * as THREE from 'three';
export class AssetManager {
  constructor() { this.models = new Map(); }
  loadModel(url) {
    if (!this.models.has(url)) this.models.set(url, import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync(url)));
    return this.models.get(url);
  }
  async staticParts(definition) {
    const gltf = await this.loadModel(definition.modelUrl);
    gltf.scene.updateMatrixWorld(true);
    const parts = [];
    gltf.scene.traverse(mesh => {
      if (!mesh.isMesh) return;
      // Bake a skinned model's bind/rest pose once for crowd instancing.
      const geometry = mesh.geometry.clone();
      const position = geometry.attributes.position, vertex = new THREE.Vector3();
      for (let i = 0; i < position.count; i++) { mesh.getVertexPosition(i, vertex); position.setXYZ(i, vertex.x, vertex.y, vertex.z); }
      geometry.applyMatrix4(mesh.matrixWorld); geometry.computeVertexNormals();
      parts.push({ geometry, material: mesh.material });
    });
    if (!parts.length) throw new Error('GLB contains no mesh');
    return parts;
  }
  async animatedModel(definition) {
    const [gltf, { clone }] = await Promise.all([this.loadModel(definition.modelUrl), import('three/addons/utils/SkeletonUtils.js')]);
    const root = clone(gltf.scene), mixer = new THREE.AnimationMixer(root), actions = {};
    for (const [state, name] of Object.entries(definition.animations)) {
      const clip = gltf.animations.find(animation => animation.name.toLowerCase() === name.toLowerCase());
      if (clip) actions[state] = mixer.clipAction(clip);
    }
    return { root, mixer, actions };
  }
}
