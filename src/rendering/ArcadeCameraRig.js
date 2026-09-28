import { ease } from '../core/Config.js';

// Steep, close arcade framing: the army sits in the lower third and the fight ahead fills
// the rest of the screen. Visual only; gameplay coordinates are unchanged.
export const ARCADE_PITCH = 54 * Math.PI / 180;
export const ARCADE_FOV = 44;
const SIN = Math.sin(ARCADE_PITCH), COS = Math.cos(ARCADE_PITCH), TAN = Math.tan(ARCADE_FOV / 2 * Math.PI / 180);

export function arcadeCameraPose(progress, depth, halfWidth, armyX, aspect, enemies = []) {
  const targetX = armyX * 0.35, targetY = 0, targetZ = -progress - 7.5 + depth * 0.3;
  let distance = 17;
  // Vertical limits are asymmetric: the army may use the lower 80% of the half-height,
  // the view ahead keeps the top of the screen.
  const contain = (x, y, z, margin = 0.9, vertical = 0.9) => {
    const dx = x - targetX, dy = y - targetY, dz = z - targetZ;
    const along = dy * SIN + dz * COS, up = dy * COS - dz * SIN;
    distance = Math.max(distance, Math.abs(dx) / (TAN * Math.max(0.1, aspect) * margin) + along, Math.abs(up) / (TAN * vertical) + along);
  };
  for (const x of [armyX - halfWidth - 0.4, armyX + halfWidth + 0.4])
    for (const z of [-progress - 0.6, -progress + depth + 1.1]) for (const y of [0, 1.6]) contain(x, y, z, 0.92, 0.94);
  // The full road width stays readable for gate choices.
  for (const x of [-5.6, 5.6]) contain(x, 0, -progress - 3, 0.98);
  for (const unit of enemies) if (unit.alive && (unit.type === 'giantBoss' || unit.type === 'desertBeast')) {
    const height = unit.type === 'giantBoss' ? 5.8 : 3.4;
    for (const x of [unit.x - 2.2, unit.x + 2.2]) contain(x, height, -unit.z, 0.95, 0.9);
  }
  return { x: targetX, height: targetY + distance * SIN, z: targetZ + distance * COS, targetX, targetY, targetZ, distance };
}

export class ArcadeCameraRig {
  constructor(camera) { this.camera = camera; camera.fov = ARCADE_FOV; camera.far = 200; camera.updateProjectionMatrix(); this.reset(0); }
  reset(depth) { this.z = 0; this.depth = depth; this.distance = null; this.x = 0; this.shake = 0; }
  kick(amount) { this.shake = Math.max(this.shake, amount); }
  update(army, dt, enemies = []) {
    this.z += (army.center.z - this.z) * ease(9, dt);
    this.x += (army.center.x - this.x) * ease(6, dt);
    this.depth += (army.depth - this.depth) * ease(army.depth > this.depth ? 12 : 2, dt);
    const pose = arcadeCameraPose(this.z, Math.max(army.depth, this.depth), army.halfWidth, this.x, this.camera.aspect, enemies);
    this.distance = this.distance === null ? pose.distance : Math.max(pose.distance, this.distance + (pose.distance - this.distance) * ease(2.5, dt));
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const jitter = this.shake * this.shake;
    const sx = (Math.random() - 0.5) * jitter, sy = (Math.random() - 0.5) * jitter;
    this.camera.position.set(pose.x + sx, pose.targetY + this.distance * SIN + sy, pose.targetZ + this.distance * COS);
    this.camera.lookAt(pose.targetX + sx * 0.5, pose.targetY, pose.targetZ);
  }
}
