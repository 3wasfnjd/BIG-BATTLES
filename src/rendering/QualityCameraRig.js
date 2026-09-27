import { ease } from '../core/Config.js';

const PITCH = 38 * Math.PI / 180;
const SIN = Math.sin(PITCH), COS = Math.cos(PITCH), TAN = Math.tan(Math.PI / 8);

// Fit the army, its growth margin and a full gate pair; avoid a fixed distant camera.
// This is a visual profile only: world coordinates, collision and controls are unchanged.
export function qualityCameraPose(progress, depth, halfWidth, armyX, aspect, enemies = [], gates = []) {
  const targetX = armyX * 0.5, targetY = 0.45, targetZ = -progress - 5 + depth * 0.4;
  let distance = 20;
  const contain = (x, y, z) => {
    const dx = x - targetX, dy = y - targetY, dz = z - targetZ;
    const along = dy * SIN + dz * COS, up = dy * COS - dz * SIN;
    distance = Math.max(distance, Math.abs(dx) / (TAN * Math.max(0.1, aspect) * 0.88) + along, Math.abs(up) / (TAN * 0.76) + along);
  };
  for (const x of [armyX - halfWidth - 0.45, armyX + halfWidth + 0.45])
    for (const z of [-progress - 0.6, -progress + depth + 1.35])
      for (const y of [0, 1.95]) contain(x, y, z);
  // Both choices must remain readable before reaching a gate, including at a lane edge.
  for (const x of [-6.8, 6.8]) for (const y of [0, 2.6]) contain(x, y, -progress - 14);
  for (const gate of gates) if (!gate.used && gate.z - progress >= -2 && gate.z - progress < 14) {
    for (const x of [-6.8, 6.8]) for (const y of [0, 2.8]) contain(x, y, -gate.z);
  }
  for (const unit of enemies) if (unit.alive && (unit.type === 'giantBoss' || unit.type === 'desertBeast')) {
    const radius = unit.radius + 0.5, height = unit.type === 'giantBoss' ? 4.4 : 2.9;
    for (const x of [unit.x - radius, unit.x + radius]) for (const y of [0, height]) contain(x, y, -unit.z);
  }
  return { x: targetX, height: targetY + distance * SIN, z: targetZ + distance * COS, targetX, targetY, targetZ, distance };
}

export class QualityCameraRig {
  constructor(camera) { this.camera = camera; this.reset(0); }
  reset(depth) { this.z = 0; this.depth = depth; this.distance = null; }
  update(army, dt, enemies = [], gates = []) {
    this.z += (army.center.z - this.z) * ease(8, dt);
    this.depth += (army.depth - this.depth) * ease(army.depth > this.depth ? 12 : 2, dt);
    // Fit new rows immediately; smooth the return after casualties.
    const pose = qualityCameraPose(this.z, Math.max(army.depth, this.depth), army.halfWidth, army.center.x, this.camera.aspect, enemies, gates);
    this.distance = this.distance === null ? pose.distance : Math.max(pose.distance, this.distance + (pose.distance - this.distance) * ease(3, dt));
    pose.height = pose.targetY + this.distance * SIN; pose.z = pose.targetZ + this.distance * COS;
    this.camera.position.set(pose.x, pose.height, pose.z);
    this.camera.lookAt(pose.targetX, pose.targetY, pose.targetZ);
  }
}
