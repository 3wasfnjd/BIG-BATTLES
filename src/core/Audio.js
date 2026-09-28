// Procedural music and sound effects with the Web Audio API: no audio files to download.
// The music is an epic D-minor loop (taiko drums, driving bass, string ostinato and a brass
// lead that joins when a giant is on the field). All effects are throttled for big fights.
const KEY = 'big-battles:sound';
const BPM = 136, STEP = 60 / BPM / 4;
const midi = n => 440 * 2 ** ((n - 69) / 12);
// i – VI – VII – V in D minor, one bar each.
const CHORDS = [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]];
const TAIKO = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0];
const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1];
const LEAD = [74, 72, 69, 72, 70, 69, 67, 69, 72, 74, 76, 74, 73, 69, 73, 76];

export class GameAudio {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage; this.ctx = null; this.mode = 'menu'; this.intensity = 0; this.last = {};
    try { this.muted = storage?.getItem(KEY) === 'off'; } catch { this.muted = false; }
  }
  // Must run inside a user gesture (browsers block audio until then).
  unlock() {
    if (!this.ctx) {
      const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctx) return;
      const ctx = this.ctx = new Ctx();
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.music = ctx.createGain(); this.music.gain.value = 0.42; this.music.connect(this.master);
      this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
      this.layers = Object.fromEntries(['drums', 'bass', 'strings', 'lead', 'pad'].map(name => { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.music); return [name, g]; }));
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.step = 0; this.nextTime = ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 25);
      this.applyMix(0);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  get enabled() { return !!this.ctx && !this.muted; }
  toggle() {
    this.muted = !this.muted;
    try { this.storage?.setItem(KEY, this.muted ? 'off' : 'on'); } catch { /* storage unavailable */ }
    this.unlock();
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    return !this.muted;
  }
  setMode(mode, intensity = this.intensity) {
    if (mode === this.mode && intensity === this.intensity) return;
    this.mode = mode; this.intensity = intensity; this.applyMix(0.6);
  }
  applyMix(fade) {
    if (!this.ctx) return;
    const battle = this.mode === 'battle', boss = battle && this.intensity >= 2, paused = this.mode === 'paused';
    const target = { drums: battle ? 1 : paused ? 0 : 0.35, bass: battle ? 0.9 : 0.25, strings: battle ? 0.55 : 0, lead: boss ? 0.5 : 0, pad: battle ? 0.15 : 0.5 };
    for (const [name, gain] of Object.entries(this.layers)) gain.gain.setTargetAtTime(paused ? 0 : target[name], this.ctx.currentTime, fade || 0.01);
  }
  schedule() {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    while (this.nextTime < ctx.currentTime + 0.12) { this.playStep(this.step, this.nextTime); this.nextTime += STEP; this.step = (this.step + 1) % 64; }
  }
  playStep(step, t) {
    const s = step % 16, bar = Math.floor(step / 16), chord = CHORDS[bar], L = this.layers;
    if (TAIKO[s]) this.drum(L.drums, t, s === 0 ? 1 : 0.7);
    if (SNARE[s]) this.snare(L.drums, t);
    if (this.mode === 'battle' && s % 2) this.hat(L.drums, t, this.intensity >= 2 ? 0.5 : 0.3);
    if (s % 2 === 0) this.tone(L.bass, 'sawtooth', midi(chord[0] - 12 + (s % 8 === 6 ? 12 : 0)), t, STEP * 1.8, 0.32, 520);
    this.tone(L.strings, 'sawtooth', midi(chord[s % 3] + 12), t, STEP * 0.9, 0.09, 2200);
    if (s % 4 === 0) this.tone(L.lead, 'square', midi(LEAD[(bar * 4 + s / 4) % 16]), t, STEP * 3.6, 0.1, 1800, 0.03);
    if (s === 0) for (const n of chord) this.tone(L.pad, 'triangle', midi(n), t, STEP * 15, 0.08, 1200, 0.4);
  }
  // --- synth voices -------------------------------------------------------------------------
  tone(out, type, freq, t, length, volume, cutoff = 4000, attack = 0.005, detune = 0) {
    const ctx = this.ctx, osc = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    osc.type = type; osc.frequency.value = freq; osc.detune.value = detune; filter.type = 'lowpass'; filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(volume, t + attack); gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(filter).connect(gain).connect(out); osc.start(t); osc.stop(t + length + 0.05);
  }
  sweep(out, type, from, to, t, length, volume) {
    const ctx = this.ctx, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(from, t); osc.frequency.exponentialRampToValueAtTime(to, t + length);
    gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain).connect(out); osc.start(t); osc.stop(t + length + 0.02);
  }
  burst(out, t, length, volume, type = 'bandpass', freq = 1500, q = 1, freqTo = null) {
    const ctx = this.ctx, src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = this.noise; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    filter.type = type; filter.frequency.setValueAtTime(freq, t); filter.Q.value = q;
    if (freqTo) filter.frequency.exponentialRampToValueAtTime(freqTo, t + length);
    gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(filter).connect(gain).connect(out); src.start(t, Math.random() * 0.5); src.stop(t + length + 0.02);
  }
  drum(out, t, v) { this.sweep(out, 'sine', 120, 42, t, 0.45, 0.9 * v); this.burst(out, t, 0.08, 0.25 * v, 'lowpass', 900); }
  snare(out, t) { this.burst(out, t, 0.16, 0.35, 'bandpass', 1800, 0.8); this.sweep(out, 'triangle', 240, 160, t, 0.08, 0.2); }
  hat(out, t, v) { this.burst(out, t, 0.04, 0.12 * v, 'highpass', 7000); }
  // --- effects -------------------------------------------------------------------------------
  ready(name, gap) {
    if (!this.enabled) return false;
    const now = this.ctx.currentTime;
    if (now - (this.last[name] ?? -1) < gap) return false;
    this.last[name] = now; return true;
  }
  volley(count) { if (count > 0 && this.ready('volley', 0.09)) this.burst(this.sfx, this.ctx.currentTime, 0.16, Math.min(0.35, 0.06 + count * 0.008), 'bandpass', 2500, 1.4, 6500); }
  hit() { if (this.ready('hit', 0.04)) this.burst(this.sfx, this.ctx.currentTime, 0.035, 0.14, 'highpass', 2500 + Math.random() * 1500); }
  enemyArrow() { if (this.ready('enemyArrow', 0.12)) this.burst(this.sfx, this.ctx.currentTime, 0.2, 0.12, 'bandpass', 1400, 2, 600); }
  kill() { if (this.ready('kill', 0.05)) this.sweep(this.sfx, 'triangle', 360 + Math.random() * 80, 110, this.ctx.currentTime, 0.1, 0.16); }
  clash(big = false) {
    if (!this.ready('clash', big ? 0.08 : 0.06)) return;
    const t = this.ctx.currentTime;
    for (const f of [1840, 2530, 3170, 4120]) this.tone(this.sfx, 'square', f * (0.94 + Math.random() * 0.12), t, big ? 0.28 : 0.16, 0.05, 9000, 0.002);
    this.burst(this.sfx, t, 0.09, 0.3, 'highpass', 3000);
    if (big) this.sweep(this.sfx, 'sine', 160, 50, t, 0.3, 0.6);
  }
  coin() { if (!this.ready('coin', 0.08)) return; const t = this.ctx.currentTime; this.tone(this.sfx, 'sine', 1320, t, 0.08, 0.12); this.tone(this.sfx, 'sine', 1760, t + 0.06, 0.14, 0.12); }
  gate(good) {
    if (!this.ready('gate', 0.2)) return;
    const t = this.ctx.currentTime, notes = good ? [74, 78, 81, 86] : [74, 70, 67, 62];
    notes.forEach((n, i) => this.tone(this.sfx, good ? 'triangle' : 'sawtooth', midi(n), t + i * 0.07, 0.25, good ? 0.22 : 0.12, 3500));
  }
  barrel() {
    if (!this.ready('barrel', 0.15)) return;
    const t = this.ctx.currentTime; this.burst(this.sfx, t, 0.3, 0.5, 'lowpass', 900); this.sweep(this.sfx, 'square', 220, 70, t, 0.18, 0.2);
    [81, 86, 90].forEach((n, i) => this.tone(this.sfx, 'triangle', midi(n), t + 0.1 + i * 0.06, 0.2, 0.15));
  }
  roar() {
    if (!this.ready('roar', 1)) return;
    const ctx = this.ctx, t = ctx.currentTime, osc = ctx.createOscillator(), lfo = ctx.createOscillator(), lfoGain = ctx.createGain(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(95, t); osc.frequency.exponentialRampToValueAtTime(55, t + 1.4);
    lfo.frequency.value = 18; lfoGain.gain.value = 14; lfo.connect(lfoGain).connect(osc.frequency);
    filter.type = 'lowpass'; filter.frequency.value = 700;
    gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.7, t + 0.15); gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    osc.connect(filter).connect(gain).connect(this.sfx); osc.start(t); lfo.start(t); osc.stop(t + 1.6); lfo.stop(t + 1.6);
    this.burst(this.sfx, t, 1.2, 0.35, 'lowpass', 500);
  }
  breach() { if (!this.ready('breach', 0.25)) return; const t = this.ctx.currentTime; this.sweep(this.sfx, 'square', 180, 60, t, 0.35, 0.3); this.tone(this.sfx, 'sawtooth', 220, t + 0.05, 0.3, 0.12, 900); }
  thunder(near = false) { if (!this.ready('thunder', near ? 0.3 : 1)) return; const t = this.ctx.currentTime; this.burst(this.sfx, t, 0.25, 0.6, 'highpass', 1500); this.burst(this.sfx, t + 0.05, 2.4, 0.8, 'lowpass', 260, 0.7, 60); }
  fanfare(victory) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime + 0.05, notes = victory ? [62, 66, 69, 74, 74, 78] : [62, 60, 57, 50];
    notes.forEach((n, i) => {
      const at = t + i * (victory ? 0.14 : 0.28), len = i === notes.length - 1 ? 1.2 : 0.3;
      this.tone(this.sfx, 'sawtooth', midi(n), at, len, 0.14, 2600, 0.02); this.tone(this.sfx, 'square', midi(n), at, len, 0.07, 2000, 0.02, 7);
    });
    if (victory) this.drum(this.sfx, t, 1);
  }
  rainStart() { if (!this.ready('rain', 0.5)) return; const t = this.ctx.currentTime; for (let i = 0; i < 6; i++) this.burst(this.sfx, t + i * 0.06, 0.35, 0.18, 'bandpass', 3000, 1.2, 900); }
  rainImpact() { if (!this.ready('rainImpact', 0.5)) return; const t = this.ctx.currentTime; for (let i = 0; i < 8; i++) this.burst(this.sfx, t + i * 0.03, 0.12, 0.3, 'highpass', 1500 + Math.random() * 2000); this.drum(this.sfx, t, 1); }
  power(kind) {
    if (!this.ready('power', 0.2)) return;
    const t = this.ctx.currentTime, scale = kind === 'freeze' ? [84, 88, 91, 96] : kind === 'fire' ? [62, 69, 74, 81] : kind === 'shield' ? [67, 71, 74, 79] : [76, 79, 83, 88];
    scale.forEach((n, i) => this.tone(this.sfx, kind === 'fire' ? 'sawtooth' : 'triangle', midi(n), t + i * 0.06, 0.35, 0.16, 5000));
    if (kind === 'freeze') this.burst(this.sfx, t, 0.5, 0.15, 'highpass', 6000);
  }
  combo(count) { if (!this.ready('combo', 0.2)) return; const t = this.ctx.currentTime, base = 72 + Math.min(12, Math.floor(count / 25) * 2); [0, 4, 7, 12].forEach((d, i) => this.tone(this.sfx, 'square', midi(base + d), t + i * 0.05, 0.18, 0.08, 4000)); }
  click() { if (this.ready('click', 0.05)) this.tone(this.sfx, 'triangle', 880, this.ctx.currentTime, 0.06, 0.12); }
}
