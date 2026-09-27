import { CONFIG } from './Config.js';
export class PerformanceManager {
  constructor(renderer) {
    this.renderer = renderer; this.dpr = Math.min(globalThis.devicePixelRatio || 1, CONFIG.maxPixelRatio);
    this.frames = 0; this.elapsed = 0; this.fps = 0; this.p95 = 0; this.slowWindows = 0;
    this.samples = new Float32Array(240); this.renderer.setPixelRatio(this.dpr);
  }
  update(dt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    this.samples[this.frames % this.samples.length] = dt * 1000;
    this.frames++; this.elapsed += dt;
    if (this.elapsed < 2) return;
    this.fps = this.frames / this.elapsed;
    const samples = this.samples.slice(0, Math.min(this.frames, this.samples.length)).sort();
    this.p95 = samples[Math.floor((samples.length - 1) * 0.95)]; this.frames = 0; this.elapsed = 0;
    this.slowWindows = this.fps < 38 ? this.slowWindows + 1 : 0;
    if (this.slowWindows >= 2 && this.dpr > CONFIG.minPixelRatio) { this.dpr = Math.max(CONFIG.minPixelRatio, this.dpr - 0.2); this.renderer.setPixelRatio(this.dpr); this.slowWindows = 0; }
  }
}
