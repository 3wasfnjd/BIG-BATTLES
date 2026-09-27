import * as THREE from 'three';

export function clipsFor(type, bones) {
  const creature = type === 'desertBeast', melee = creature || type === 'giantBoss';
  const states = ['idle', melee ? 'walk' : 'run', melee ? 'attack' : 'shoot', 'hit', 'death'];
  return states.map(state => {
    const duration = { idle: 2, run: 0.8, walk: 1, shoot: 0.22, attack: 0.8, hit: 0.22, death: 0.65 }[state];
    const times = Array.from({ length: 9 }, (_, i) => duration * i / 8);
    const rotations = bones.map(() => []), positions = bones.map(() => []);
    times.forEach((t, i) => {
      const u = i / 8, phase = u * Math.PI * 2, wave = Math.sin(phase), pulse = Math.sin(Math.PI * u);
      for (let j = 0; j < bones.length; j++) {
        const p = bones[j].position.clone(), euler = new THREE.Euler();
        if (state === 'idle') {
          if (j === 0) p.y += Math.sin(phase) * 0.008;
          if (j === 1) euler.x = wave * 0.018;
          if (j === 6) euler.x = wave * 0.025;
        } else if (state === 'run' || state === 'walk') {
          if (j === 0) p.y += (1 - Math.cos(phase * 2)) * 0.016;
          if (j === 2 || j === 3) euler.x = wave * (j === 2 ? 0.45 : -0.45);
          if (creature && (j === 4 || j === 5)) euler.x = wave * (j === 4 ? -0.4 : 0.4);
          if (!creature && (j === 4 || j === 5)) euler.x = wave * 0.06;
          if (j === 1) euler.x = -0.02 + wave * 0.025;
          if (j === 6) euler.x = 0.12 + wave * 0.05;
        } else if (state === 'shoot') {
          if (j === 0) p.z += pulse * 0.035;
          if (j === 5) euler.x = -pulse * 0.14;
          if (j === 1) euler.x = -pulse * 0.06;
        } else if (state === 'attack') {
          if (j === 0) { p.z -= pulse * (creature ? 0.2 : 0.1); euler.x = pulse * 0.1; }
          if (j === 1) euler.x = -pulse * (creature ? 0.3 : 0.05);
          if (j === 5 && !creature) euler.x = -Math.sin(u * Math.PI * 1.6) * 1.2;
          if (creature && (j === 2 || j === 4)) euler.x = pulse * 0.2;
        } else if (state === 'hit') {
          if (j === 0) { euler.x = -pulse * 0.14; p.z += pulse * 0.045; }
          if (j === 1) euler.x = -pulse * 0.1;
        } else if (state === 'death') {
          if (j === 0) { euler.x = u * (creature ? 0.1 : 1.32); euler.z = u * 0.22; p.y -= u * (creature ? 0.3 : 0.025); }
          if (j === 4 || j === 5) euler.z = u * (j === 4 ? -0.25 : 0.25);
        }
        const q = new THREE.Quaternion().setFromEuler(euler);
        rotations[j].push(q.x, q.y, q.z, q.w); positions[j].push(p.x, p.y, p.z);
      }
    });
    const tracks = [];
    bones.forEach((bone, i) => {
      const add = (Type, suffix, values, size) => {
        const constant = values.every((v, index) => Math.abs(v - values[index % size]) < 1e-8);
        tracks.push(new Type(`${bone.name}.${suffix}`, constant ? [0, duration] : times, constant ? [...values.slice(0, size), ...values.slice(0, size)] : values));
      };
      add(THREE.QuaternionKeyframeTrack, 'quaternion', rotations[i], 4);
      add(THREE.VectorKeyframeTrack, 'position', positions[i], 3);
    });
    return new THREE.AnimationClip(state, duration, tracks);
  });
}
