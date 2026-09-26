import { CONFIG } from './Config.js';
export class PerformanceManager {
  constructor(renderer) { this.renderer = renderer; this.dpr = Math.min(devicePixelRatio || 1, CONFIG.maxPixelRatio); this.frames = 0; this.elapsed = 0; this.fps = 60; this.slowWindows = 0; this.renderer.setPixelRatio(this.dpr); }
  update(dt) {
    this.frames++; this.elapsed += dt;
    if (this.elapsed < 2) return;
    this.fps = this.frames / this.elapsed; this.frames = 0; this.elapsed = 0;
    this.slowWindows = this.fps < 38 ? this.slowWindows + 1 : 0;
    if (this.slowWindows >= 2 && this.dpr > CONFIG.minPixelRatio) { this.dpr = Math.max(CONFIG.minPixelRatio, this.dpr - 0.2); this.renderer.setPixelRatio(this.dpr); this.slowWindows = 0; }
  }
}
