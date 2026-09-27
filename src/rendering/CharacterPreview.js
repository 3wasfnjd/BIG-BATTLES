import * as THREE from 'three';
import { CHARACTERS } from '../data/characters.js';

// Temporary inspection view: the actual game asset, shared cache and renderer.
// Only this one close-up gets a cloned rig; the army keeps its instanced poses.
export class CharacterPreview {
  constructor(assets, definition = CHARACTERS.recruit) {
    this.assets = assets;
    this.definition = definition;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#173d2e');
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    this.scene.add(new THREE.HemisphereLight('#fff4de', '#917e60', 2.2));
    const light = new THREE.DirectionalLight('#fff3d3', 2);
    light.position.set(-3, 5, -4);
    this.scene.add(light);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.radius = 1;
    this.centerY = 0.75;
    this.pointer = null;
    this.model = null;
    this.loading = null;
    this.reset();
  }

  async load() {
    if (this.model) return;
    if (this.loading) return this.loading;
    this.loading = this.assets.animatedModel(this.definition).then(model => {
      const definition = this.definition;
      model.root.scale.setScalar(definition.scale * definition.modelScale);
      model.root.rotation.y = definition.rotationY;
      model.root.position.y = definition.offsetY;
      model.root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model.root, true);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      // Center horizontally and ground the feet, regardless of imported origin.
      model.root.position.x -= center.x;
      model.root.position.y -= bounds.min.y;
      model.root.position.z -= center.z;
      this.centerY = size.y / 2;
      // Sphere-fit leaves room for idle motion and every drag rotation.
      this.radius = Math.max(0.1, size.length() / 2) * 1.08;
      this.model = model;
      this.pivot.add(model.root);
      model.actions.idle?.play();
      model.mixer.update(0);
      this.resize(this.camera.aspect);
    }).catch(error => {
      // Permit a retry after a failed network load without touching other assets.
      this.assets.models.delete(this.definition.modelUrl);
      throw error;
    }).finally(() => { this.loading = null; });
    return this.loading;
  }

  resize(aspect) {
    this.camera.aspect = Math.max(0.1, aspect);
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    // Reserve top/bottom UI space; fit narrow portraits and short landscapes.
    const angle = Math.min(Math.atan(Math.tan(halfFov) * 0.64), Math.atan(Math.tan(halfFov) * this.camera.aspect * 0.84));
    const distance = this.radius / Math.sin(angle);
    this.camera.position.set(0, this.centerY + distance * 0.12, -distance);
    this.camera.near = Math.max(0.01, distance - this.radius * 2);
    this.camera.far = distance + this.radius * 3;
    this.camera.lookAt(0, this.centerY, 0);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  reset() {
    this.pointer = null;
    this.pivot.rotation.y = -0.22;
    this.model?.actions.idle?.reset().play();
  }

  beginDrag(pointerId, x) { this.pointer = { id: pointerId, x }; }
  drag(pointerId, x, width) {
    if (this.pointer?.id !== pointerId) return;
    this.pivot.rotation.y += (x - this.pointer.x) / Math.max(1, width) * Math.PI * 2;
    this.pointer.x = x;
  }
  endDrag(pointerId) { if (this.pointer?.id === pointerId) this.pointer = null; }
  update(dt) { this.model?.mixer.update(Math.min(dt, 0.05)); }
}
