import * as THREE from 'three';
import { GAME_FONT } from './ArcadeGateRenderer.js';
import { gateLabel } from './GateRenderer.js';

const PANEL_W = 6.6, PANEL_H = 2.3;
const STYLE = {
  good: { top: '#62e79d', bottom: '#17a05a', edge: '#c4ffdc', ink: 'rgba(8,56,30,0.92)' },
  bad: { top: '#ff7a6e', bottom: '#c8202d', edge: '#ffd0cb', ink: 'rgba(80,6,12,0.92)' },
  upgrade: { top: '#ffd96e', bottom: '#e39018', edge: '#fff0bc', ink: 'rgba(92,48,6,0.92)' },
};
const TITLES = { army_multiply: 'ضعف الجيش', weapon_upgrade: 'سلاح أقوى', fire_rate: 'رمي أسرع', damage: 'ضرر أعلى', elite_upgrade: 'جنود النخبة' };
const detail = c => c.type === 'weapon_upgrade' ? `+${c.value} LV` : c.type === 'elite_upgrade' ? `${Math.round(c.value * 100)}%` : `+${Math.round((c.value - 1) * 100)}%`;
const kindOf = c => c.type === 'army_add' ? (c.value < 0 ? 'bad' : 'good') : c.type === 'army_multiply' ? 'good' : 'upgrade';
export const choiceLabel = c => c.type === 'army_add' ? (c.value < 0 ? `${c.value}` : `+${c.value}`) : gateLabel(c);

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function drawPanel(ctx, choice) {
  const w = ctx.canvas.width, h = ctx.canvas.height, style = STYLE[kindOf(choice)];
  ctx.clearRect(0, 0, w, h);
  const grad = ctx.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, style.top); grad.addColorStop(1, style.bottom);
  ctx.globalAlpha = 0.8; ctx.fillStyle = grad; roundRect(ctx, 6, 6, w - 12, h - 12, 26); ctx.fill();
  ctx.globalAlpha = 1; ctx.lineWidth = 10; ctx.strokeStyle = style.edge; roundRect(ctx, 6, 6, w - 12, h - 12, 26); ctx.stroke();
  ctx.globalAlpha = 0.25; ctx.fillStyle = '#fff'; roundRect(ctx, 22, 18, w - 44, h * 0.3, 16); ctx.fill(); ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.strokeStyle = style.ink; ctx.fillStyle = '#fff';
  const text = (value, size, y, width, dir = 'ltr') => { ctx.direction = dir; ctx.font = `${size}px ${GAME_FONT}`; ctx.lineWidth = width; ctx.strokeText(value, w / 2, y); ctx.fillText(value, w / 2, y); };
  if (choice.type === 'army_add') text(choiceLabel(choice), 124, h * 0.52, 16);
  else if (choice.type === 'army_multiply') { text(choiceLabel(choice), 104, h * 0.43, 16); text(TITLES[choice.type], 40, h * 0.82, 9, 'rtl'); }
  else { text(TITLES[choice.type], 68, h * 0.4, 12, 'rtl'); text(detail(choice), 50, h * 0.78, 10); }
}

// Gate rows and barrels that travel toward the defending army.
export class DefenseProps {
  constructor(scene, soldierParts = null) {
    this.scene = scene; this.rows = new Map(); this.barrels = new Map(); this.soldierParts = soldierParts;
    this.post = new THREE.CylinderGeometry(0.22, 0.26, PANEL_H + 0.5, 12); this.cap = new THREE.SphereGeometry(0.34, 12, 8);
    this.panel = new THREE.PlaneGeometry(PANEL_W, PANEL_H);
    this.postMaterial = new THREE.MeshLambertMaterial({ color: '#f5f0e6' }); this.capMaterial = new THREE.MeshLambertMaterial({ color: '#f2c14e' });
    this.barrelBody = new THREE.CylinderGeometry(0.62, 0.62, 1.1, 16); this.hoop = new THREE.TorusGeometry(0.64, 0.05, 6, 20).rotateX(Math.PI / 2);
    this.woodMaterial = new THREE.MeshLambertMaterial({ color: '#b07038' }); this.hoopMaterial = new THREE.MeshLambertMaterial({ color: '#e0b04a' });
    this.flash = new THREE.Color(1.8, 1.8, 1.8); this.white = new THREE.Color(1, 1, 1);
    globalThis.document?.fonts?.ready.then(() => { for (const row of this.rows.values()) for (const p of row.panels) p.key = ''; });
  }
  makeRow(row) {
    const group = new THREE.Group(), panels = [];
    for (const x of [-PANEL_W - 0.2, 0, PANEL_W + 0.2]) {
      const post = new THREE.Mesh(this.post, this.postMaterial); post.position.set(x, (PANEL_H + 0.5) / 2, 0); post.castShadow = true; group.add(post);
      const cap = new THREE.Mesh(this.cap, this.capMaterial); cap.position.set(x, PANEL_H + 0.6, 0); group.add(cap);
    }
    for (const source of row.panels) {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const mesh = new THREE.Mesh(this.panel, material); mesh.position.set(source.x, PANEL_H / 2 + 0.25, 0); mesh.rotation.x = -0.35;
      group.add(mesh); panels.push({ source, mesh, material, texture, ctx: canvas.getContext('2d'), key: '', pulse: 0 });
    }
    this.scene.add(group);
    const item = { group, panels, usedAt: -1 }; this.rows.set(row, item); return item;
  }
  makeBarrel() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.barrelBody, this.woodMaterial); body.position.y = 0.55; body.castShadow = true; group.add(body);
    for (const y of [0.2, 0.9]) { const hoop = new THREE.Mesh(this.hoop, this.hoopMaterial); hoop.position.y = y; group.add(hoop); }
    if (this.soldierParts) for (const x of [-0.28, 0.28]) for (const part of this.soldierParts) {
      const soldier = new THREE.Mesh(part.geometry, part.material); soldier.position.set(x, 1.1, 0); soldier.scale.setScalar(0.95); soldier.rotation.y = Math.PI; group.add(soldier);
    }
    this.scene.add(group); return { group, body };
  }
  update(sim, dt) {
    // Gate rows.
    const seen = new Set();
    for (const row of sim.gates) {
      seen.add(row);
      const item = this.rows.get(row) || this.makeRow(row);
      item.group.position.z = -row.z;
      if (row.used && item.usedAt < 0) item.usedAt = 0;
      if (row.used) item.usedAt += dt;
      const t = Math.min(1, Math.max(0, item.usedAt) / 0.35);
      item.group.visible = !row.used || t < 1;
      item.panels.forEach((p, i) => {
        const key = `${p.source.choice.type}:${p.source.choice.value}`;
        if (key !== p.key) { if (p.key) p.pulse = 1; p.key = key; drawPanel(p.ctx, p.source.choice); p.texture.needsUpdate = true; }
        p.pulse = Math.max(0, p.pulse - dt * 6);
        const chosen = row.used && i === row.selected;
        p.mesh.scale.setScalar((chosen ? 1 + t * 0.35 : 1) * (1 + p.pulse * 0.06));
        p.material.opacity = row.used ? 1 - t : 1;
        p.mesh.visible = !row.used || chosen || t < 0.5;
      });
    }
    for (const [row, item] of this.rows) if (!seen.has(row)) { this.scene.remove(item.group); for (const p of item.panels) { p.texture.dispose(); p.material.dispose(); } this.rows.delete(row); }
    // Barrels.
    const alive = new Set();
    for (const barrel of sim.barrels) {
      if (!barrel.alive) continue;
      alive.add(barrel);
      const item = this.barrels.get(barrel) || (this.barrels.set(barrel, this.makeBarrel()), this.barrels.get(barrel));
      const shake = barrel.hitTime > 0 ? Math.sin(barrel.hitTime * 120) * 0.06 : 0;
      item.group.position.set(barrel.x + shake, 0, -barrel.z);
    }
    for (const [barrel, item] of this.barrels) if (!alive.has(barrel)) { this.scene.remove(item.group); this.barrels.delete(barrel); }
  }
  clear() {
    for (const item of this.rows.values()) { this.scene.remove(item.group); for (const p of item.panels) { p.texture.dispose(); p.material.dispose(); } }
    for (const item of this.barrels.values()) this.scene.remove(item.group);
    this.rows.clear(); this.barrels.clear();
  }
}
