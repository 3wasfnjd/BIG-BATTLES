import { ease } from '../core/Config.js';
export function cameraPose(progress, depth, aspect) {
  return { height: Math.max(23, 14 / aspect) + depth * 0.95, z: -progress + 19 + depth * 1.05, targetZ: -progress - 10 + depth * 0.45 };
}
export class CameraRig {
  constructor(camera) { this.camera = camera; this.reset(0); }
  reset(depth) { this.z = 0; this.depth = depth; }
  update(army, dt) {
    this.z += (army.center.z - this.z) * ease(8, dt);
    // Zoom out quickly on growth so new rear rows never leave the screen.
    this.depth += (army.depth - this.depth) * ease(army.depth > this.depth ? 12 : 2, dt);
    const pose = cameraPose(this.z, this.depth, this.camera.aspect);
    this.camera.position.set(0, pose.height, pose.z); this.camera.lookAt(0, 0, pose.targetZ);
  }
}
