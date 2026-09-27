import { CHARACTERS } from '../data/characters.js';

// Opt-in study until the new asset style and real-device rendering are approved.
// Gameplay continues to read CHARACTERS; these overrides belong to rendering only.
export const QUALITY_CHARACTERS = {
  ...CHARACTERS,
  recruit: { ...CHARACTERS.recruit, modelUrl: 'assets/models/quality/recruit.glb', artStatus: 'quality-study' },
};
export function visualProfile(search = '') {
  const quality = new URLSearchParams(search).get('quality') === '1';
  return { quality, definitions: quality ? QUALITY_CHARACTERS : CHARACTERS };
}
