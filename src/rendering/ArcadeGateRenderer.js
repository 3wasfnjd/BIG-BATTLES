import * as THREE from 'three';
import { gateLabel } from './GateRenderer.js';

export const GAME_FONT = "'Lilita One','Lalezar','Arial Black',sans-serif";
const PANEL_W = 6.5, PANEL_H = 2.3;
const STYLES = {
  army: { top: '#5fe39a', bottom: '#179a55', edge: '#b9ffd6', floor: '#35d67e' },
  upgrade: { top: '#ffd76a', bottom: '#e0901c', edge: '#fff0b8', floor: '#ffc53d' },
};
const TITLES = { army_multiply: 'ضعف الجيش', weapon_upgrade: 'سلاح أقوى', fire_rate: 'رمي أسرع', damage: 'ضرر أعلى', elite_upgrade: 'جنود النخبة' };
const detail = choice => choice.type === 'weapon_upgrade' ? `+${choice.value} LV` : choice.type === 'elite_upgrade' ? `${Math.round(choice.value * 100)}%` : `+${Math.round((choice.value - 1) * 100)}%`;

// Glassy gate panels with big outlined numbers, in the style of arcade army runners.
export class ArcadeGateRenderer {
  constructor(scene, gates) {
    this.items = []; this.textures = new Map(); this.time = 0;
    const post = new THREE.CylinderGeometry(0.22, 0.26, PANEL_H + 0.5, 12), cap = new THREE.SphereGeometry(0.34, 12, 8);
    const panel = new THREE.PlaneGeometry(PANEL_W, PANEL_H), floor = new THREE.PlaneGeometry(PANEL_W, 1.4).rotateX(-Math.PI / 2);
    const postMaterial = new THREE.MeshLambertMaterial({ color: '#f5f0e6' }), capMaterial = new THREE.MeshLambertMaterial({ color: '#f2c14e' });
    this.floorMaterials = Object.fromEntries(Object.entries(STYLES).map(([key, style]) => [key, new THREE.MeshBasicMaterial({ color: style.floor, transparent: true, opacity: 0.35, depthWrite: false })]));
    for (const gate of gates) {
      const group = new THREE.Group(); group.position.z = -gate.z;
      const panels = [];
      for (const x of [-PANEL_W - 0.25, 0, PANEL_W + 0.25]) {
        const p = new THREE.Mesh(post, postMaterial); p.position.set(x, (PANEL_H + 0.5) / 2, 0); p.castShadow = true; group.add(p);
        const c = new THREE.Mesh(cap, capMaterial); c.position.set(x, PANEL_H + 0.6, 0); group.add(c);
      }
      gate.choices.forEach((choice, index) => {
        const kind = choice.type.startsWith('army') ? 'army' : 'upgrade', x = (index ? 1 : -1) * (PANEL_W / 2 + 0.12);
        const material = new THREE.MeshBasicMaterial({ map: this.texture(choice, kind), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
        const mesh = new THREE.Mesh(panel, material); mesh.position.set(x, PANEL_H / 2 + 0.25, 0); mesh.rotation.x = -0.35;
        const base = new THREE.Mesh(floor, this.floorMaterials[kind]); base.position.set(x, 0.02, 0.2);
        group.add(mesh, base); panels.push({ mesh, base, material });
      });
      scene.add(group); this.items.push({ gate, group, panels, usedAt: null });
    }
  }
  texture(choice, kind) {
    const key = `${kind}:${gateLabel(choice)}`;
    if (this.textures.has(key)) return this.textures.get(key);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    const draw = () => { this.draw(canvas, choice, kind); texture.needsUpdate = true; };
    draw();
    // Redraw once the bundled game fonts are ready (first paint may use a fallback).
    globalThis.document?.fonts?.ready.then(draw);
    this.textures.set(key, texture); return texture;
  }
  draw(canvas, choice, kind) {
    const style = STYLES[kind];
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, r = 26;
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, style.top); grad.addColorStop(1, style.bottom);
    ctx.globalAlpha = 0.78; ctx.fillStyle = grad; roundRect(ctx, 6, 6, w - 12, h - 12, r); ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 10; ctx.strokeStyle = style.edge; roundRect(ctx, 6, 6, w - 12, h - 12, r); ctx.stroke();
    // Glass highlight.
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffffff'; roundRect(ctx, 22, 18, w - 44, h * 0.3, 16); ctx.fill(); ctx.globalAlpha = 1;
    const army = choice.type === 'army_add';
    const text = (value, size, y, width = 16) => {
      ctx.font = `${size}px ${GAME_FONT}`; ctx.lineWidth = width;
      ctx.strokeText(value, w / 2, y); ctx.fillText(value, w / 2, y);
    };
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.strokeStyle = kind === 'army' ? 'rgba(10,52,28,0.9)' : 'rgba(92,48,6,0.9)'; ctx.fillStyle = '#ffffff';
    if (army) text(gateLabel(choice), 124, h * 0.52);
    else if (choice.type === 'army_multiply') { text(gateLabel(choice), 104, h * 0.43); ctx.direction = 'rtl'; text(TITLES[choice.type], 40, h * 0.82, 9); }
    else { ctx.direction = 'rtl'; text(TITLES[choice.type], 68, h * 0.4, 12); ctx.direction = 'ltr'; text(detail(choice), 50, h * 0.78, 10); }
    ctx.direction = 'inherit';
  }
  update(z, dt = 0) {
    this.time += dt;
    for (const item of this.items) {
      const { gate, group, panels } = item;
      const near = gate.z > z - 3 && gate.z < z + 80;
      if (gate.used && item.usedAt === null) item.usedAt = this.time;
      if (!gate.used) { group.visible = near; for (const p of panels) { p.mesh.scale.setScalar(1); p.material.opacity = 1; } continue; }
      // Chosen panel pops and fades; the other one fades out.
      const t = (this.time - item.usedAt) / 0.35;
      group.visible = t < 1;
      panels.forEach((p, index) => {
        const chosen = index === gate.selected;
        p.mesh.scale.setScalar(chosen ? 1 + t * 0.35 : 1);
        p.material.opacity = Math.max(0, 1 - t);
        p.base.visible = false;
        p.mesh.visible = chosen || t < 0.5;
      });
    }
  }
  reset(gates) { this.items.forEach((item, i) => { item.gate = gates[i]; item.usedAt = null; for (const p of item.panels) p.base.visible = p.mesh.visible = true; }); }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
