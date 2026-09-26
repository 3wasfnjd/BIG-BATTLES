import * as THREE from 'three';
export const GATE_LABELS = { weapon_upgrade: 'سلاح ↑', fire_rate: 'سرعة ↑', damage: 'قوة ↑', elite_upgrade: 'نخبة ★' };
export function gateLabel(choice) { return choice.type === 'army_add' ? `+${choice.value}` : choice.type === 'army_multiply' ? `×${choice.value}` : GATE_LABELS[choice.type]; }
export class GateRenderer {
  constructor(scene, gates) {
    this.items = []; this.textures = new Map();
    const postGeometry = new THREE.BoxGeometry(0.2, 2.5, 0.25);
    this.frameMaterials = [new THREE.MeshBasicMaterial({ color: '#5bd3ff' }), new THREE.MeshBasicMaterial({ color: '#ffe2a0' })];
    this.panelMaterials = [new THREE.MeshBasicMaterial({ color: '#278fed', transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false }), new THREE.MeshBasicMaterial({ color: '#edb444', transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false })];
    for (const gate of gates) {
      const group = new THREE.Group(); group.position.z = -gate.z;
      gate.choices.forEach((choice, index) => {
        const gold = choice.type.startsWith('army') ? 0 : 1, x = index ? 3.5 : -3.5;
        for (const dx of [-3.05, 3.05]) { const post = new THREE.Mesh(postGeometry, this.frameMaterials[gold]); post.position.set(x + dx, 1.25, 0); group.add(post); }
        const top = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.13, 0.2), this.frameMaterials[gold]); top.position.set(x, 2.5, 0); group.add(top);
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.42), this.panelMaterials[gold]); panel.position.set(x, 1.27, 0); group.add(panel);
        const base = new THREE.Mesh(new THREE.PlaneGeometry(6.3, 0.8), this.panelMaterials[gold]); base.rotation.x = -Math.PI / 2; base.position.set(x, 0.05, 0); group.add(base);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.labelTexture(choice), depthWrite: false })); label.position.set(x, 1.8, 0.15); label.scale.set(4, 2, 1); group.add(label);
      });
      scene.add(group); this.items.push({ gate, group });
    }
  }
  labelTexture(choice) {
    const label = gateLabel(choice); if (this.textures.has(label)) return this.textures.get(label);
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#184d78'; ctx.lineWidth = 5; ctx.font = '900 65px Arial';
    if (!choice.type.startsWith('army')) ctx.font = 'bold 43px Arial';
    ctx.strokeText(label, 128, 45); ctx.fillText(label, 128, 45);
    if (choice.type.startsWith('army')) for (const x of [107, 128, 149]) { ctx.beginPath(); ctx.arc(x, 94, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - 7, 103, 14, 15); }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.set(label, texture); return texture;
  }
  update(z) { for (const { gate, group } of this.items) group.visible = !gate.used && gate.z > z - 3 && gate.z < z + 72; }
  reset(gates) { this.items.forEach((item, i) => { item.gate = gates[i]; }); }
}
