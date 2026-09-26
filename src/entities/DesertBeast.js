import { CharacterEntity } from './CharacterEntity.js';
export class DesertBeast extends CharacterEntity {
  constructor(z) { super('desertBeast', 0, z); this.aiState = 'APPROACH'; this.timer = 0; this.attackCount = 0; this.telegraph = 0; }
}
