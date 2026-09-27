import { CONFIG } from '../core/Config.js';
export class InputSystem {
  constructor(element, onStart, onMove, getCenter) {
    this.element = element; this.pointerId = null;
    element.addEventListener('pointerdown', event => {
      if (event.target.closest('button') || this.pointerId !== null || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault(); onStart();
      this.pointerId = event.pointerId; this.startX = event.clientX; this.armyX = getCenter();
      this.width = Math.max(1, element.getBoundingClientRect().width);
      element.setPointerCapture(event.pointerId);
    });
    element.addEventListener('pointermove', event => {
      if (event.pointerId !== this.pointerId) return;
      event.preventDefault();
      const next = this.armyX + (event.clientX - this.startX) / this.width * CONFIG.corridorWidth;
      // Rebase at the accepted (clamped) target so reversing at a wall responds immediately.
      this.armyX = onMove(next) ?? next; this.startX = event.clientX;
    });
    const release = event => { if (event.pointerId === this.pointerId) this.pointerId = null; };
    element.addEventListener('pointerup', release); element.addEventListener('pointercancel', release); element.addEventListener('lostpointercapture', release);
    element.addEventListener('contextmenu', event => event.preventDefault());
  }
  reset() {
    if (this.pointerId !== null && this.element.hasPointerCapture?.(this.pointerId)) this.element.releasePointerCapture(this.pointerId);
    this.pointerId = null;
  }
}
