import { CONFIG, ease } from '../core/Config.js';
export class FormationSystem {
  layout(units, commander = true) {
    const soldiers = commander ? units.filter(unit => unit.type !== 'commander') : units;
    const columns = Math.min(CONFIG.maxColumns, Math.max(1, Math.ceil(Math.sqrt(soldiers.length * 1.25))));
    const rows = Math.ceil(soldiers.length / columns);
    soldiers.forEach((unit, i) => {
      const row = Math.floor(i / columns);
      const inRow = Math.min(columns, soldiers.length - row * columns);
      unit.formationSlot.x = (i % columns - (inRow - 1) / 2) * CONFIG.unitSpacing;
      unit.formationSlot.z = -row * CONFIG.unitSpacing;
    });
    if (commander) {
      const leader = units.find(unit => unit.type === 'commander');
      if (leader) { leader.formationSlot.x = 0; leader.formationSlot.z = -rows * CONFIG.unitSpacing - 0.35; }
    }
    return { halfWidth: Math.max(0.4, (columns - 1) * CONFIG.unitSpacing / 2 + 0.35), depth: rows * CONFIG.unitSpacing };
  }
  update(units, center, dt, forward = true) {
    const smoothing = ease(16, dt);
    for (const unit of units) {
      unit.x += (center.x + unit.formationSlot.x - unit.x) * smoothing;
      unit.z += (center.z + unit.formationSlot.z * (forward ? 1 : -1) - unit.z) * smoothing;
      unit.hitTime = Math.max(0, unit.hitTime - dt);
    }
  }
}
