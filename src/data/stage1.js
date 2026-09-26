export const STAGE_1 = {
  id: 1, name: 'حصن الرمال', length: 270, initialArmy: 6,
  sections: [
    { type: 'gate', z: 15, choices: [{ type: 'army_add', value: 5 }, { type: 'army_add', value: 10 }] },
    { type: 'gate', z: 32, choices: [{ type: 'army_add', value: 10 }, { type: 'army_multiply', value: 2 }] },
    { type: 'enemyWave', z: 58, count: 16, triggerDistance: 18, label: 'الحرس' },
    { type: 'gate', z: 78, choices: [{ type: 'weapon_upgrade', value: 1 }, { type: 'fire_rate', value: 1.35 }] },
    { type: 'gate', z: 96, choices: [{ type: 'army_add', value: 20 }, { type: 'army_multiply', value: 2 }] },
    { type: 'enemyWave', z: 124, count: 48, triggerDistance: 19, label: 'الكتيبة' },
    { type: 'gate', z: 144, choices: [{ type: 'elite_upgrade', value: 0.4 }, { type: 'damage', value: 1.45 }] },
    { type: 'beast', z: 164, triggerDistance: 14 },
    { type: 'gate', z: 184, choices: [{ type: 'army_add', value: 20 }, { type: 'army_multiply', value: 3 }] },
    { type: 'gate', z: 202, choices: [{ type: 'army_multiply', value: 2 }, { type: 'army_add', value: 20 }] },
    { type: 'enemyWave', z: 230, count: 190, triggerDistance: 20, label: 'جيش الحصن' },
    { type: 'boss', z: 261, triggerDistance: 17 },
  ],
};
