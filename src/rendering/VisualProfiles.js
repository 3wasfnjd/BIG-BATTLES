import { CHARACTERS } from '../data/characters.js';

// Opt-in study until the new asset style and real-device rendering are approved.
// Gameplay continues to read CHARACTERS; these overrides belong to rendering only.
export const QUALITY_CHARACTERS = {
  ...CHARACTERS,
  recruit: { ...CHARACTERS.recruit, modelUrl: 'assets/models/quality/recruit.glb', artStatus: 'quality-study' },
};
// Arcade chibi proportions: bigger bodies in the same gameplay slots (radius and
// spacing are unchanged), so the crowd reads as a packed army like arcade runners.
const ARCADE_SCALE = { commander: 1.55, recruit: 1.14, elite: 1.2, enemyGrunt: 1.16, enemyBrute: 1.55, desertBeast: 2.6, giantBoss: 4.1 };
export const ARCADE_CHARACTERS = Object.fromEntries(Object.entries(CHARACTERS).map(([key, def]) => [key, { ...def, scale: ARCADE_SCALE[key] ?? def.scale, artStatus: 'procedural-chibi' }]));
// Default look: procedural chibi arcade renderer. ?classic=1 and ?quality=1 keep the
// earlier GLB-based looks available for comparison.
export function visualProfile(search = '') {
  const params = new URLSearchParams(search);
  const quality = params.get('quality') === '1';
  const arcade = !quality && params.get('classic') !== '1';
  return { quality, arcade, definitions: quality ? QUALITY_CHARACTERS : arcade ? ARCADE_CHARACTERS : CHARACTERS };
}
