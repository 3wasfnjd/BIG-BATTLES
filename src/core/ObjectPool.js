export class ObjectPool {
  constructor(capacity, create) { this.free = Array.from({ length: capacity }, create); this.active = []; this.capacity = capacity; this.misses = 0; }
  acquire() { const item = this.free.pop(); if (!item) { this.misses++; return null; } this.active.push(item); return item; }
  releaseAt(index) { const item = this.active[index]; const last = this.active.pop(); if (index < this.active.length) this.active[index] = last; this.free.push(item); }
  clear() { while (this.active.length) this.free.push(this.active.pop()); this.misses = 0; }
}
