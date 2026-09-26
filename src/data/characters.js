const animations = { idle: 'idle', run: 'run', shoot: 'shoot', hit: 'hit', death: 'death' };
const visual = (scale, mode = 'instanced') => ({ modelUrl: null, scale, modelScale: 1, rotationY: 0, offsetY: 0, mode, animations: { ...animations } });
export const CHARACTERS = {
  commander: { team: 'player', health: 150, speed: 4.6, radius: 0.3, weapon: 'commander', ...visual(1.18, 'animated') },
  recruit: { team: 'player', health: 34, speed: 4.6, radius: 0.23, weapon: 'recruit', ...visual(0.86) },
  elite: { team: 'player', health: 62, speed: 4.6, radius: 0.25, weapon: 'elite', ...visual(0.9) },
  enemyGrunt: { team: 'enemy', health: 18, speed: 1.7, radius: 0.24, weapon: 'enemyGrunt', ...visual(0.87) },
  desertBeast: { team: 'enemy', health: 5000, damage: 14, fireRate: 0.8, speed: 3, range: 3.8, radius: 1.1, attackLimit: 3, windup: 0.6, cooldown: 1.1, ...visual(1.5) },
  giantBoss: { team: 'enemy', health: 36000, damage: 18, fireRate: 0.6, speed: 2.7, range: 4.4, radius: 1.4, attackLimit: 4, smashDamage: 29, smashRadius: 4.7, smashLimit: 12, windup: 0.8, cooldown: 1.0, ...visual(2.6, 'animated') },
};
