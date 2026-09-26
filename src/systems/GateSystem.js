export class GateSystem {
  constructor(sections, onGate) { this.gates = sections.filter(s => s.type === 'gate').map(s => ({ ...s, used: false, selected: -1 })); this.onGate = onGate; }
  update(army) {
    for (const gate of this.gates) {
      if (gate.used || army.center.z < gate.z) continue;
      gate.used = true;
      gate.selected = army.center.x < 0 ? 0 : 1;
      const choice = gate.choices[gate.selected];
      const before = army.count;
      army.upgrade(choice.type, choice.value);
      this.onGate?.(gate, choice, army.count - before);
    }
  }
}
