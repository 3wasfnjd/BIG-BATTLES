import { CharacterEntity } from './CharacterEntity.js';
export class GiantBoss extends CharacterEntity {
  constructor(z) { super('giantBoss', 0, z); this.aiState = 'APPROACH'; this.timer = 0; this.attackCount = 0; this.telegraph = 0; }
}
