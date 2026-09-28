// Permanent upgrades bought with coins between stages.
export const UPGRADES = [
  { id: 'soldiers', name: 'جنود البداية', detail: level => `+${level * 3} جنود`, base: 60, growth: 1.55, max: 12 },
  { id: 'damage', name: 'قوة السهام', detail: level => `+${level * 12}%`, base: 80, growth: 1.6, max: 12 },
  { id: 'fireRate', name: 'سرعة الرمي', detail: level => `+${level * 10}%`, base: 80, growth: 1.6, max: 12 },
  { id: 'fort', name: 'صلابة القلعة', detail: level => `+${level * 2} قلوب`, base: 50, growth: 1.5, max: 10 },
];
export const upgradeCost = (upgrade, level) => Math.round(upgrade.base * upgrade.growth ** level / 5) * 5;

// Converts upgrade levels into the modifiers the simulation applies at the start of a stage.
export function perksFor(levels = {}) {
  const l = id => Math.min(levels[id] || 0, UPGRADES.find(u => u.id === id).max);
  return { soldiers: l('soldiers') * 3, damage: 1 + l('damage') * 0.12, fireRate: 1 + l('fireRate') * 0.1, fort: l('fort') * 2 };
}
