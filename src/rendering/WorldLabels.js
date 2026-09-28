import * as THREE from 'three';

// Screen-space tags pinned to world positions: army size, enemy wave size and the
// health of the beast/boss. Plain DOM, updated only when values change.
export class WorldLabels {
  constructor(camera, elements) {
    this.camera = camera; this.el = elements; this.v = new THREE.Vector3(); this.last = {};
  }
  place(name, x, y, z, width, height, text) {
    const el = this.el[name]; if (!el) return;
    this.v.set(x, y, z).project(this.camera);
    const visible = this.v.z < 1 && Math.abs(this.v.x) < 1.1 && this.v.y < 0.95 && this.v.y > -1.1;
    el.hidden = !visible;
    if (!visible) return;
    // Keep tags below the HUD strip.
    const top = Math.max(name === 'army' ? 0 : 150, (1 - this.v.y) / 2 * height);
    el.style.transform = `translate(${((this.v.x + 1) / 2 * width).toFixed(1)}px, ${top.toFixed(1)}px) translate(-50%, -100%)`;
    if (text !== undefined && this.last[name] !== text) { (el.querySelector('b') || el).textContent = text; this.last[name] = text; }
  }
  hide() { for (const el of Object.values(this.el)) if (el) el.hidden = true; this.last = {}; }
  update(sim, width, height) {
    const { army, stage } = sim;
    if (!army.count || sim.state === 'ready') { this.hide(); return; }
    // Above the front rows of the army.
    this.place('army', army.center.x, 2.2, -army.center.z + 0.5, width, height, String(army.count));
    const horde = stage.encounter?.horde, giant = stage.enemies.find(unit => unit.alive && (unit.type === 'giantBoss' || unit.type === 'desertBeast'));
    if (horde && horde.units.length) {
      let far = -Infinity; for (const unit of horde.units) far = Math.max(far, unit.z);
      this.place('horde', horde.center.x, 2.2, -far - 0.5, width, height, String(horde.units.length));
    } else if (this.el.horde) this.el.horde.hidden = true;
    if (giant) {
      const top = giant.type === 'giantBoss' ? 6.2 : 3.8;
      this.place('giant', giant.x, top, -giant.z, width, height, String(Math.ceil(giant.health)));
      const bar = this.el.giant?.querySelector('i');
      if (bar) bar.style.transform = `scaleX(${(giant.health / giant.maxHealth).toFixed(3)})`;
    } else if (this.el.giant) this.el.giant.hidden = true;
  }
}
