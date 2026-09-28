// Plays every defence stage with a scripted left/right policy at several upgrade budgets.
// This measures difficulty for tuning; it is not a prediction of human win rates.
import { DefenseSimulation, ENERGY_MAX } from '../src/core/DefenseSimulation.js';
import { DEFENSE_STAGES } from '../src/data/defenseStages.js';

export function botTarget(sim) {
  const army = sim.army;
  const row = sim.gates.find(g => !g.used && g.z > 0.3 && g.z < 10);
  if (row) {
    const score = c => c.type === 'army_add' ? army.count + c.value : c.type === 'army_multiply' ? army.count * c.value : army.count * 1.35;
    const [a, b] = row.panels.map(p => score(p.choice));
    return a >= b ? -3.2 : 3.2;
  }
  let wx = 0, w = 0;
  for (const unit of sim.enemies) {
    if (unit.z > 30) continue;
    const weight = (unit.aiState ? 6 : unit.type === 'enemyBrute' ? 3 : 1) / (unit.z + 3);
    wx += unit.x * weight; w += weight;
  }
  return w ? wx / w : 0;
}
export function play(stage, levels = {}, policy = botTarget) {
  const sim = new DefenseSimulation({}, stage, levels); sim.start();
  for (let tick = 0; tick < 60 * 240 && sim.state === 'playing'; tick++) {
    if (tick % 15 === 0) sim.army.targetX = policy(sim);
    if (sim.energy >= ENERGY_MAX) sim.useRain();
    sim.useGiants(); sim.useCannons();
    sim.update(1 / 60);
  }
  return sim;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
  for (const stage of DEFENSE_STAGES.filter(s => !only || only.includes(s.id))) {
    const rows = [];
    for (const level of process.argv[2] ? process.argv[2].split(',').map(Number) : [0, 1, 2, 3, 4, 6, 8, 9, 10, 11, 12]) {
      const sim = play(stage, { soldiers: level, damage: level, fireRate: level, fort: level });
      rows.push(`L${level}:${sim.state === 'victory' ? 'WIN' : 'lose'} t=${sim.time.toFixed(0)} army=${sim.army.count}/${sim.peakArmy} base=${sim.base.hp}/${sim.base.maxHp} coins=${sim.coins} leaks=${sim.leaks}`);
    }
    console.log(`Stage ${stage.id}\n  ` + rows.join('\n  '));
  }
}
