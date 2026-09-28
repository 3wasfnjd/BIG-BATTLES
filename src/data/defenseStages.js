// Mob-Control style defence: the army holds its line at z = 0 and only slides left/right.
// Everything else (enemy hordes, gates, barrels, giants) spawns at SPAWN_Z and comes to it.
// `t` is the spawn time in seconds. Gates/barrels travel at PROP_SPEED.
export const SPAWN_Z = 46;
export const PROP_SPEED = 6.8;
// Global tempo: stage timelines are compressed and every walker/giant moves faster.
export const PACE = { time: 0.75, speed: 1.22 };

const horde = (t, count, x, extra = {}) => ({ t, type: 'horde', count, x, ...extra });
const gate = (t, left, right) => ({ t, type: 'gate', choices: [left, right] });
const barrel = (t, x, hp, reward) => ({ t, type: 'barrel', x, hp, reward });
const add = (value, grow = true) => ({ type: 'army_add', value, grow });
const mul = value => ({ type: 'army_multiply', value });
const up = (type, value) => ({ type, value });

export const DEFENSE_STAGES = [
  {
    id: 1, name: 'جسر الرمال', initialArmy: 10, baseHp: 10, clearBonus: 120,
    gruntSpeed: 2.5, gruntHp: 22, bruteHp: 130,
    events: [
      gate(0, add(4), add(8)),
      horde(3, 10, -3), horde(5, 10, 3),
      barrel(8, 3.5, 60, add(8, false)),
      gate(11, mul(2), add(10)),
      horde(14, 30, 0, { width: 9, brutes: 1 }),
      horde(20, 26, -4, { brutes: 2 }), horde(21, 26, 4, { brutes: 2 }),
      gate(26, up('fire_rate', 1.25), up('damage', 1.3)),
      barrel(29, -3.5, 120, add(15, false)),
      horde(32, 60, 0, { width: 12, brutes: 5 }),
      gate(38, add(-20), add(6)),
      horde(41, 50, -3.5, { brutes: 5 }), horde(43, 50, 3.5, { brutes: 5 }),
      { t: 50, type: 'beast', x: 0, health: 4000 },
      horde(53, 90, 0, { width: 13, brutes: 8, speed: 3 }),
      horde(62, 55, -4, { brutes: 5 }), horde(63, 55, 4, { brutes: 5 }),
    ],
  },
  {
    id: 2, name: 'وادي الصخور', initialArmy: 10, baseHp: 10, clearBonus: 220,
    gruntSpeed: 2.9, gruntHp: 40, bruteHp: 220,
    events: [
      gate(0, add(6), add(10)),
      horde(2, 14, -3.5), horde(4, 14, 3.5),
      barrel(7, -3.5, 80, add(12, false)),
      horde(10, 36, 0, { width: 11, brutes: 2 }),
      gate(13, add(-10), mul(2)),
      horde(17, 36, -4, { brutes: 3 }), horde(19, 36, 4, { brutes: 3 }),
      barrel(22, 3.5, 160, up('fire_rate', 1.25)),
      gate(25, up('damage', 1.35), up('elite_upgrade', 0.35)),
      horde(28, 80, 0, { width: 12, brutes: 7 }),
      { t: 36, type: 'beast', x: -3, health: 6000 },
      horde(38, 50, 4.5, { brutes: 5 }),
      gate(44, add(8), add(-25)),
      horde(47, 100, 0, { width: 13, brutes: 10, speed: 3.2 }),
      barrel(52, -3.5, 200, add(25, false)),
      horde(56, 80, -4, { brutes: 8 }), horde(57, 80, 4, { brutes: 8 }),
      { t: 64, type: 'beast', x: 3, health: 8000 },
      horde(66, 130, 0, { width: 13, brutes: 14, speed: 3.2 }),
    ],
  },
  {
    id: 3, name: 'حصن العملاق', initialArmy: 10, baseHp: 8, clearBonus: 400,
    gruntSpeed: 3.1, gruntHp: 52, bruteHp: 300,
    events: [
      gate(0, add(8), mul(2)),
      horde(2, 20, -3.5, { brutes: 1 }), horde(3, 20, 3.5, { brutes: 1 }),
      gate(8, add(-12), add(10)),
      horde(10, 50, 0, { width: 12, brutes: 4 }),
      barrel(13, 3.5, 180, add(20, false)),
      gate(17, up('fire_rate', 1.3), up('damage', 1.35)),
      horde(19, 55, -4, { brutes: 6 }), horde(20, 55, 4, { brutes: 6 }),
      { t: 26, type: 'beast', x: 0, health: 9000 },
      horde(28, 100, 0, { width: 13, brutes: 10, speed: 3.4 }),
      gate(33, add(-30), mul(2)),
      barrel(36, -3.5, 260, up('elite_upgrade', 0.5)),
      horde(38, 90, -4, { brutes: 10 }), horde(39, 90, 4, { brutes: 10 }),
      gate(45, add(10), add(-40)),
      horde(48, 140, 0, { width: 13, brutes: 14, speed: 3.4 }),
      { t: 55, type: 'boss', x: 0, health: 45000 },
      horde(58, 90, -4, { brutes: 10 }), horde(60, 90, 4, { brutes: 10 }),
      horde(72, 160, 0, { width: 13, brutes: 18, speed: 3.4 }),
    ],
  },
  {
    id: 4, name: 'معقل الظلام', initialArmy: 10, baseHp: 6, clearBonus: 700,
    gruntSpeed: 3.2, gruntHp: 58, bruteHp: 360,
    events: [
      gate(0, add(-6), mul(2)),
      horde(2, 20, -3.5, { brutes: 2 }), horde(3, 20, 3.5, { brutes: 2 }),
      gate(6, add(12), add(-15)),
      horde(9, 50, 0, { width: 13, brutes: 4, speed: 3.5 }),
      barrel(10, -3.5, 260, add(25, false)),
      { t: 15, type: 'beast', x: -3, health: 12000 },
      horde(16, 60, 4, { brutes: 8 }),
      gate(20, up('fire_rate', 1.3), add(-35)),
      horde(22, 110, 0, { width: 13, brutes: 12, speed: 3.6 }),
      barrel(25, 3.5, 360, up('damage', 1.35)),
      { t: 29, type: 'beast', x: 3, health: 14000 },
      horde(30, 90, -4, { brutes: 12 }), horde(31, 90, 4, { brutes: 12 }),
      gate(36, mul(2), add(-50)),
      horde(38, 150, 0, { width: 13, brutes: 16, speed: 3.8 }),
      { t: 44, type: 'boss', x: 0, health: 60000 },
      horde(46, 100, -4, { brutes: 14 }), horde(47, 100, 4, { brutes: 14 }),
      gate(52, add(-60), up('elite_upgrade', 0.6)),
      horde(55, 170, 0, { width: 13, brutes: 20, speed: 3.8 }),
      { t: 60, type: 'beast', x: 0, health: 16000 },
      horde(63, 120, -4, { brutes: 16 }), horde(64, 120, 4, { brutes: 16 }),
      horde(72, 200, 0, { width: 13, brutes: 24, speed: 4 }),
    ],
  },
];
