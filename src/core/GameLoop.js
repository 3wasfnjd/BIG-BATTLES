import { CONFIG } from './Config.js';
export class GameLoop {
  constructor(update, render) { this.update = update; this.render = render; this.last = 0; this.accumulator = 0; this.running = false; }
  start() {
    this.running = true;
    const frame = now => {
      if (!this.running) return;
      const raw = this.last ? (now - this.last) / 1000 : CONFIG.fixedStep;
      const dt = Math.min(0.1, raw); this.last = now;
      this.accumulator += dt; let steps = 0;
      while (this.accumulator >= CONFIG.fixedStep && steps < CONFIG.maxSubsteps) { this.update(CONFIG.fixedStep); this.accumulator -= CONFIG.fixedStep; steps++; }
      if (steps === CONFIG.maxSubsteps) this.accumulator = 0;
      this.render(dt, raw); requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  resetClock() { this.last = 0; this.accumulator = 0; }
}
