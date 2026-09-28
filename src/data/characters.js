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
  // Defence-mode bosses with their own attacks (src/systems/BossSystem.js).
  dragon: { team: 'enemy', health: 50000, damage: 0, fireRate: 0, speed: 2.4, range: 15, radius: 1.5, windup: 0.9, cooldown: 1.9, width: 1.7, limit: 14, ...visual('giant-boss', 3.3, 'animated'), modelUrl: null, animations: { ...meleeAnimations } },
  yeti: { team: 'enemy', health: 40000, damage: 0, fireRate: 0, speed: 2.4, range: 13, radius: 1.4, windup: 0.8, cooldown: 1.6, width: 2.6, limit: 10, ...visual('giant-boss', 2.9, 'animated'), modelUrl: null, animations: { ...meleeAnimations } },
  warlock: { team: 'enemy', health: 30000, damage: 0, fireRate: 0, speed: 2.2, range: 18, radius: 1.0, windup: 0.8, cooldown: 2.6, summon: 10, ...visual('giant-boss', 2.6, 'animated'), modelUrl: null, animations: { ...meleeAnimations } },
  warElephant: { team: 'enemy', health: 45000, damage: 0, fireRate: 0, speed: 2.6, range: 12, radius: 1.6, windup: 1.0, cooldown: 2.0, width: 1.9, limit: 18, charge: 15, ...visual('giant-boss', 3.2, 'animated'), modelUrl: null, animations: { ...meleeAnimations } },
  // Friendly giant summoned by the 'giants' ability (defence mode).
  allyGiant: { team: 'player', health: 6000, damage: 0, fireRate: 0, speed: 2.2, range: 0, radius: 1.2, windup: 0.45, cooldown: 0.5, ...visual('giant-boss', 3.2, 'animated'), modelUrl: null, animations: { ...meleeAnimations } },
  desertBeast: { team: 'enemy', health: 5000, damage: 14, fireRate: 0.8, speed: 3.6, range: 3.8, radius: 1.1, attackLimit: 3, windup: 0.6, cooldown: 1.1, ...visual('desert-beast', 1.5, 'animated'), animations: { ...meleeAnimations } },
  giantBoss: { team: 'enemy', health: 36000, damage: 18, fireRate: 0.6, speed: 3.2, range: 4.4, radius: 1.4, attackLimit: 4, smashDamage: 29, smashRadius: 4.7, smashLimit: 12, windup: 0.8, cooldown: 1.0, ...visual('giant-boss', 2.6, 'animated'), animations: { ...meleeAnimations } },
};
