// Army-wide weapons won from gates and barrels during a defence stage. Multipliers apply on
// top of the soldier's base weapon and upgrades. Splash hits nearby enemies for a share.
export const WEAPON_KINDS = {
  crossbow: { name: 'قوس ونشاب', icon: '🏹', damage: 1, rate: 1, speed: 1, splash: 0, share: 0, shots: 1 },
  triple: { name: 'قوس ثلاثي', icon: '🏹', damage: 0.62, rate: 1, speed: 1.05, splash: 0, share: 0, shots: 3 },
  rifle: { name: 'بندقية', icon: '🎯', damage: 1.8, rate: 0.8, speed: 1.8, splash: 0, share: 0, shots: 1 },
  magic: { name: 'عصا سحرية', icon: '🔮', damage: 0.9, rate: 1.05, speed: 0.75, splash: 1.5, share: 0.6, shots: 1 },
  cannon: { name: 'مدفع', icon: '💣', damage: 2.6, rate: 0.45, speed: 0.65, splash: 2.4, share: 0.7, shots: 1 },
};
