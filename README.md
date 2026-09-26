# BIG BATTLES · معارك كبيرة

**SMALL HEROES • BIG BATTLES — أبطال صغار • معارك كبيرة**

A small, original Saudi-inspired chibi crowd runner, built with vanilla ES modules and Three.js. Open the game, touch once, drag left/right. Forward movement, formation, targeting and combat are automatic. No accounts, backend, shop, ads, physics engine or gameplay menus.

## Play / run

GitHub Pages serves this repository directly from `main` at `/BIG-BATTLES/`. All browser dependencies are pinned and served locally; no CDN is needed. WebGL 2 and ES modules are required. Portrait is the primary layout; landscape and desktop use the same game.

```sh
npm run serve       # http://localhost:8080 (Python 3)
npm ci             # only needed for development / tests
npm test
npm run vendor     # refresh committed Three.js files from the pinned package
```

During play, drag anywhere to steer. The center marker determines the chosen gate, even when a large formation spans both lanes. The top shows army count, Stage 1 progress, and a small pause button. Switching tabs pauses play. Victory/defeat has one replay button.

## Implemented prototype

- One configurable stage: seven gate pairs, three grunt waves (16 / 48 / 190), a desert beast, a giant boss, victory, defeat and replay.
- Six distinct procedural characters: commander (shemagh/cape/beard), white-ghutra recruits, helmet/goggle elites, red grunts, four-legged rocky beast and a mace-carrying boss about three soldiers tall.
- Growth (+1/+5/+10/+20 and multipliers are generic), weapon, fire-rate, damage and elite-conversion gates. Stage 1 uses +5, +10, +20, ×2 and ×3.
- Automatic rifles, pooled visible projectiles with actual damage on arrival, unit health/death, pooled impacts, boss health and melee telegraphs. Every third boss attack is a wider heavy smash; move sideways to avoid it.
- Fictional mud-brick walls, towers, geometric details, sandstone cliffs, palms, paving, crates, jars and torches. Original geometric banner emblem; no official insignia.
- Player/enemy instancing from the start. A group formation and a central target system; no individual navigation or per-unit raycasting.

These are playable placeholders, not final production character models or art matching the reference illustrations.

## Architecture

| Area | Responsibility |
| --- | --- |
| `src/core/Simulation.js` | Renderer-independent gameplay and reset lifecycle; also runs in Node tests |
| `src/core/Game.js` | Three.js scene, camera, minimal DOM UI and lifecycle |
| `src/core/GameLoop.js` | Fixed 60 Hz simulation, bounded catch-up after stalls |
| `src/core/Config.js` | Movement, caps, spacing, resolution and pool budgets |
| `src/entities/` | Character stats/state, player formation, horde and special enemies |
| `src/systems/` | Input, movement, gates, shared targets, combat, projectiles, enemy state machine and stage |
| `src/rendering/` | Procedural character/environment builders, instanced visuals, gate labels and effects |
| `src/core/AssetManager.js` | Cached, lazy GLB loading and visual-only replacement |
| `src/data/` | Character definitions, weapons and Stage 1 events |

World gameplay coordinates use increasing `z` for forward progress; the renderer maps that to Three.js `-z`. Entities contain no Three.js meshes. Formation slots, health, targeting and gates never depend on a visual mesh. Encounter progression pauses forward movement until the wave dies; sideways control remains active.

## Replacing characters with GLB

Put the model in `assets/models/`, then edit its entry in `src/data/characters.js`:

```js
recruit: {
  // keep the gameplay stats
  modelUrl: 'assets/models/recruit.glb',
  modelScale: 1,
  rotationY: 0,
  offsetY: 0,
  mode: 'instanced',
  animations: { idle: 'idle', run: 'run', shoot: 'shoot', hit: 'hit', death: 'death' }
}
```

The other planned names are `commander.glb`, `elite.glb`, `enemy-grunt.glb`, `desert-beast.glb` and `giant-boss.glb`. All `modelUrl` values initially are `null`. The loader retains the procedural visual while loading, and keeps it on failure with a console warning.

Requirements: glTF 2.0 binary, Y up, forward **-Z**, feet at origin, transforms applied, self-contained textures, no lights/cameras required. For `modelScale: 1`, export approximately **1.44 units high** before the character definition's team/role scale. Aim for ≤1,500 triangles and one material per ordinary soldier, ≤512px atlas textures, opaque surfaces, and no Draco/KTX2 compression unless decoder support is added. More materials/parts mean more draw calls.

`instanced` is the crowd path: mesh parts are instanced, including a baked rest pose for skinned models. Crowd skeletal animations are intentionally not evaluated per soldier. Commander and boss default to `animated`, using one cloned rig each, cached clips and a mixer when a model exists. Clip mappings are prepared for idle/run/shoot/hit/death; missing clips fall back to idle. Death currently removes the entity immediately and emits a pooled effect, so a full GLB death clip is **not** played yet. Animated crowds need a later shared-animation/GPU implementation, not hundreds of cloned GLTF scenes. GLB models from the user have not yet been supplied or visually verified.

Environment rendering is isolated in `EnvironmentFactory`; it can be replaced by a GLB environment adapter without modifying simulation/collision logic. There is no terrain collision dependency on the decorative meshes.

## Stage / balancing data

`src/data/stage1.js` defines length, initial army, ordered gates and encounters. For example:

```js
{ type: 'gate', z: 32, choices: [
  { type: 'army_add', value: 10 },       // left
  { type: 'army_multiply', value: 2 }    // right
] },
{ type: 'enemyWave', z: 58, count: 16, triggerDistance: 18 }
```

Supported encounters: `enemyWave`, `beast`, `boss`. An encounter becomes visible before its activation distance. Clear it to resume running. Keep gates before the next encounter's stop line. Combat stats live in `characters.js` / `weapons.js`, not rendering code. The first stage intentionally favors growth while testing all major systems. Further playtesting is needed to judge difficulty and fun.

## Performance strategy

- One merged, vertex-colored mesh instanced per placeholder character type; shared geometries/materials. No scene per crowd unit.
- Bounded nine-lane target buckets rebuilt at ~8 Hz, staggered firing, short bounded candidate probes. Beast/boss scan only on an attack, not per unit per frame.
- Pool limits: 1,200 projectiles, 100 impact effects. Current hard caps: 320 player / 420 grunt units. Raise only after measuring the target devices.
- Static environment chunks merged and culled by distance. Blob shadows only; no shadow maps, physics, postprocessing or large textures/audio.
- Pixel ratio starts at ≤1.5 and reduces after sustained slow frames. No player graphics settings.
- Self-hosted Three.js 0.180.0 (MIT; license in `vendor/LICENSE`). ~720 KB uncompressed for the two core minified modules; no bundler/runtime framework. GLB loader helpers load only when a model URL is configured.

Development diagnostics are **off** by default. Use `?debug=1` for FPS, units, projectiles, pool misses, triangles/draw calls and stage state. `?debug=1&portrait=1` constrains the desktop game surface to 430px for layout review; it is not iPhone emulation. No cheats or exported mutable game state are exposed.

## Validation and current limits

`npm test` covers complete stage runs through all five encounters, growth and alternate upgrade routes, formation bounds at 5–320 units, one-shot gate selection, pool reuse, projectile deaths, pause/reset/defeat, pointer lifecycle, and boss telegraph/attack cadence. Simulation tests do not measure rendering FPS or prove Safari compatibility.

Browser verification results are recorded after testing the deployed build. Real iPhone Safari and Android hardware testing is still required; no mobile-device FPS promise is made. Audio and final GLB art are intentionally absent. Next step: device playtesting to tune camera/drag feel, gate readability and encounter difficulty, then integrate one optimized recruit GLB before replacing the rest.
