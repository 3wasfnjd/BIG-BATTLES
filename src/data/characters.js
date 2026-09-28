const animations = { idle: 'idle', run: 'run', shoot: 'shoot', hit: 'hit', death: 'death' };
const visual = (file, scale, mode = 'instanced') => ({ modelUrl: `assets/models/${file}.glb`, artStatus: 'procedural-prototype', scale, modelScale: 1, rotationY: 0, offsetY: 0, mode, animations: { ...animations } });
const meleeAnimations = { idle: 'idle', walk: 'walk', attack: 'attack', hit: 'hit', death: 'death' };
export const CHARACTERS = {
  commander: { team: 'player', health: 150, speed: 6.2, radius: 0.3, weapon: 'commander', ...visual('commander', 1.18, 'animated') },
  recruit: { team: 'player', health: 34, speed: 6.2, radius: 0.23, weapon: 'recruit', ...visual('recruit', 0.86), artStatus: 'reference-modeled-draft' },
  elite: { team: 'player', health: 62, speed: 6.2, radius: 0.25, weapon: 'elite', ...visual('elite', 0.9) },
  enemyGrunt: { team: 'enemy', health: 18, speed: 1.7, radius: 0.24, weapon: 'enemyGrunt', ...visual('enemy-grunt', 0.87) },
  // Defence-mode heavy walker: no ranged weapon, crushes several soldiers on contact.
  enemyBrute: { team: 'enemy', health: 110, damage: 0, fireRate: 0, speed: 2.4, range: 0, radius: 0.36, trade: 3, ...visual('enemy-grunt', 1.2), modelUrl: null },
  desertBeast: { team: 'enemy', health: 5000, damage: 14, fireRate: 0.8, speed: 3.6, range: 3.8, radius: 1.1, attackLimit: 3, windup: 0.6, cooldown: 1.1, ...visual('desert-beast', 1.5, 'animated'), animations: { ...meleeAnimations } },
  giantBoss: { team: 'enemy', health: 36000, damage: 18, fireRate: 0.6, speed: 3.2, range: 4.4, radius: 1.4, attackLimit: 4, smashDamage: 29, smashRadius: 4.7, smashLimit: 12, windup: 0.8, cooldown: 1.0, ...visual('giant-boss', 2.6, 'animated'), animations: { ...meleeAnimations } },
};
