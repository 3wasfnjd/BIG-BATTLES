import { CONFIG, clamp, ease } from '../core/Config.js';
export class MovementSystem {
  update(army, dt, moving) {
    army.targetX = clamp(army.targetX, -army.limit, army.limit);
    army.center.x += (army.targetX - army.center.x) * ease(CONFIG.lateralResponse, dt);
    army.center.x = clamp(army.center.x, -army.limit, army.limit);
    if (moving) army.center.z += CONFIG.forwardSpeed * dt;
    army.update(dt, moving);
  }
}
