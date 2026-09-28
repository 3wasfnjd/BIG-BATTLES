export const CONFIG = Object.freeze({
  corridorWidth: 14, forwardSpeed: 6.2, lateralResponse: 14,
  maxPlayerUnits: 320, maxEnemyUnits: 420, unitSpacing: 0.68, maxColumns: 17,
  projectileCapacity: 1200, impactCapacity: 100, targetInterval: 0.12,
  maxPixelRatio: 1.5, minPixelRatio: 0.85, fixedStep: 1 / 60, maxSubsteps: 5,
});
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const ease = (speed, dt) => 1 - Math.exp(-speed * dt);
