export class InputSystem {
  constructor(element, onStart, onMove, getCenter) {
    this.element = element; this.pointerId = null;
    element.addEventListener('pointerdown', event => {
      if (event.target.closest('button') || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault(); onStart();
      this.pointerId = event.pointerId; this.startX = event.clientX; this.armyX = getCenter();
      element.setPointerCapture(event.pointerId);
    });
    element.addEventListener('pointermove', event => {
      if (event.pointerId !== this.pointerId) return;
      event.preventDefault();
      const width = element.getBoundingClientRect().width;
      onMove(this.armyX + (event.clientX - this.startX) / width * 14);
    });
    const release = event => { if (event.pointerId === this.pointerId) this.pointerId = null; };
    element.addEventListener('pointerup', release); element.addEventListener('pointercancel', release); element.addEventListener('lostpointercapture', release);
    element.addEventListener('contextmenu', event => event.preventDefault());
  }
  reset() { this.pointerId = null; }
}
