# BIG BATTLES · معارك كبيرة

**SMALL HEROES • BIG BATTLES — أبطال صغار • معارك كبيرة**

A lightweight, original Saudi-inspired chibi crowd runner using vanilla ES modules and Three.js. Touch once, drag left/right; movement forward, targeting and combat are automatic. One stage, no account/backend/shop, joystick, shooting button or gameplay menus.

**Current status:** Stage 1 completes in simulation, and all six animated **prototype** GLBs are integrated. These simple models are not final artwork matching the approved illustrations. Real Safari/Android visual playback and FPS remain unverified: the available cloud browser disables WebGL.

## Play / develop

[Play BIG BATTLES](https://3wasfnjd.github.io/BIG-BATTLES/)

GitHub Pages serves `main` directly. WebGL 2 and ES modules are required. All runtime dependencies/assets are self-hosted, with no CDN/build step.

```sh
npm run serve       # http://localhost:8080 (Python 3)
npm ci              # development dependencies; Three.js pinned to 0.180.0
npm test            # gameplay, controls, real GLBs, all 128 gate paths
npm run benchmark   # CPU/scene update stress harness; NOT GPU FPS
npm run models      # rebuild/overwrite the six PROCEDURAL prototype GLBs
npm run vendor      # copy pinned Three.js distribution to vendor/
```

Drag anywhere to steer. Reversing a drag responds immediately even after reaching the corridor edge. The army's front center marker chooses the gate even when the crowd spans both lanes. HUD: army size, progress, pause; a boss bar appears only for the final fight. Switching tabs pauses play. Pause freezes simulation, visual animation, effects and camera movement. Victory/defeat has one replay button.

## What existed and what changed

The existing implementation already had a modular renderer-independent simulation, one data-driven stage, seven gate pairs, formations, automatic projectiles, five encounters, a fictional desert fortress, simple UI, instanced procedural characters, a GLB adapter, and 12 Node tests. These systems were retained.

This update fixes elite upgrades that retained recruit range/projectile speed/radius, transient idle/shoot states while running, stalled touch reversal at the movement boundary, and animation continuing behind the pause overlay. New recruits enter near their slots; formation and casualty compaction preserve array identity and corridor bounds.

Shared targeting now reserves in-flight damage, checks front-line candidates reliably and refreshes immediately on population changes. Fewer soldiers waste a volley on an already-covered target. Pools retain diagnostic misses/peaks after a result rather than resetting the evidence. The beast and boss use explicit walk/attack states. Dead characters leave combat immediately and play a bounded visual death animation (maximum 32 bodies).

Six actual GLBs now replace the placeholders lazily. Ordinary soldiers share baked animation poses and InstancedMesh batches. Only the commander, beast and boss have individual mixers. Compatible body/weapon geometry sharing a material is merged, and only populated instance ranges are uploaded. Failed loads retain procedural visuals.

## Stage 1 — حصن الرمال

`src/data/stage1.js` is the source of truth for initial size, distances, gates and encounters:

1. Six starting heroes; +5/+10, then +10/×2.
2. 16-enemy guard wave.
3. Weapon/fire-rate choice; +20/×2.
4. 48-enemy battalion.
5. Elite conversion/damage choice; Desert Beast.
6. +20/×3, then ×2/+20.
7. 190-enemy fortress army; Giant Boss; victory at the end of the path.

Beast/boss encounters pause forward progress but keep sideways control. Red floor telegraphs precede melee attacks. Every third boss attack is a wider smash. Death, defeat, pause and replay are supported. The first stage has no new menus and no additional stages.

There are 128 possible gate routes. Automated fixed-lane strategies produced 100 victories and 28 defeats; no route stalled. These are deterministic control policies for regression testing, not estimates of human win rates. Weak gate combinations can lose. Human playtesting is still needed for balance and fun.

## Characters and approved identity

[Detailed asset inventory and import contract](assets/models/README.md)

| Character | Current file | Runtime animation |
| --- | --- | --- |
| Commander | `assets/models/commander.glb` | Individual rig/mixer |
| Recruit | `assets/models/recruit.glb` | Shared instanced poses |
| Elite | `assets/models/elite.glb` | Shared instanced poses |
| Enemy grunt | `assets/models/enemy-grunt.glb` | Shared instanced poses |
| Desert Beast | `assets/models/desert-beast.glb` | Individual rig/mixer |
| Giant Boss | `assets/models/giant-boss.glb` | Individual rig/mixer |

The supplied reference ZIP contained concept images, prompts and specifications, **no finished GLBs**. The committed files are reproducible procedural prototypes: 578–1,004 triangles each, one material, zero textures, 554.5 KiB total. Every humanoid supports idle/run/shoot/hit/death; beast/boss support idle/walk/attack/hit/death. Weapons and commander cape are separate mesh objects in the source GLB. Blue/tan player colors, red/black enemies, shemagh/ghutra/goggles and rocky beast were preserved. The simple geometric models do not match the reference illustrations' production quality.

Replace a model at its current path and adjust `modelScale`, `rotationY`, `offsetY`, `mode` or clip mappings in `src/data/characters.js` if needed. Set `modelUrl: null` to retain the procedural fallback. Replacing visuals never changes health, weapons, formations, gates or AI. Only assets explicitly marked as these prototypes use simplified Lambert materials; final imports preserve their materials.

## Architecture

| Area | Responsibility |
| --- | --- |
| `src/core/Simulation.js` | Renderer-independent gameplay, lifecycle, peak/kill tracking |
| `src/core/Game.js` / `GameLoop.js` | Three.js scene, fixed-step loop, UI, pause/context lifecycle |
| `src/entities/` | Gameplay data; no meshes or renderer dependency |
| `src/systems/` | Movement, formation, gates, lane-based targets, pooled projectiles, enemy state machines and stage progression |
| `src/rendering/CharacterVisualFactory.js` | Lazy GLB/fallback replacement, instanced pose batches, bounded death playback |
| `src/core/AssetManager.js` | Cached GLB parsing, material grouping, shared pose baking, singular animation clips |
| `src/rendering/EnvironmentFactory.js` | Chunked decorative Najdi-inspired walls/towers, sandstone, palms, jars, crates, banners, torches and path |
| `src/data/` | Character stats/visual contract, weapons, Stage 1 sequence |
| `tools/` / `tests/` | Reproducible model generation, CPU stress harness, regression checks |

Simulation advances along +Z; rendering maps progress to -Z. Decorative architecture has no physics dependency. Encounter activation, attacks and gate rewards remain data-driven. The environment is fictional, not a copied landmark; emblems are original geometric marks.

## Performance strategy and measurement

- Caps remain **320 player soldiers / 420 enemy grunts**; Stage 1's largest actual wave is 190.
- One crowd instance batch per active sampled pose/material, not a scene or skeleton per soldier. Run clips use eight shared poses; closeups will show stepped motion. Singular heroes/monsters animate continuously.
- Nine targeting lanes refreshed around 8 Hz plus roster changes; bounded candidate probes and damage reservations. No per-unit pathfinding, raycasts, physics engine or ragdolls.
- 1,200 pooled projectiles; 100 pooled hit/death effects. Cosmetic effects can be dropped at saturation; that never removes damage or changes combat. Heavy sustained stress reaches this visual-effect cap.
- Shared geometry/materials, static merged environment chunks, blob shadows, no shadow maps/postprocessing/large textures.
- DPR starts at ≤1.5 and reduces after sustained slow frames. Debug FPS uses real frame intervals, without clipping long stalls.
- Three.js 0.180.0, MIT license at `vendor/LICENSE`. No new runtime dependency.

Diagnostics are off by default. Open `?debug=1` for FPS, frame p95, DPR, units, projectiles/peak/misses, draw calls/triangles, model status and stage state. `?debug=1&portrait=1` limits the desktop surface to 430px for layout review; it is not phone emulation. There are no mutable game globals or cheats.

Validation on 2026-09-27:

- **23 tests pass**, including actual committed GLB parsing/skinning/clips, crowd replacement, missing-model fallback, gate upgrades, damage reservations, controls, death/pause/reset logic, boss attacks, and camera containment at portrait/landscape ratios.
- All 128 gate routes terminate within 145 simulated seconds. Growth route: 85.5 seconds, peak 320, 311 survivors; alternate route: 86.5 seconds, peak 206, 189 survivors. Timings/counts are simulation results and can vary slightly with shot staggering.
- Progressive sustained CPU/scene tests: 50+50, 100+100, 200+200, 320+320, and **320+420 = 740 simultaneous units**. Tests use actual GLB poses and raised health to retain the stress population. No projectile pool misses in any case.
- Largest stress case: median CPU simulation+scene-update **0.377 ms**, p95 **0.684 ms** on the recorded Linux/Node host. These exclude GPU drawing, gate canvas textures and browser overhead; they **cannot be converted into phone FPS**. [Raw method, host and results](docs/validation-2026-09-27.json).
- The actual GLB front/back geometry was inspected through offline CPU projection/rasterization; rigs were also numerically evaluated through every clip. This is not verification of browser-rendered animation quality.
- Available cloud Chrome reports `GL_RENDERER = Disabled` and fails context creation. Actual WebGL frames, device FPS, real browser touch gameplay and replay interaction could not be tested. No Safari/Android performance claim is made.

## Remaining work / exact next step

**Next: test one complete growth-route run on an actual iPhone in Safari with `?debug=1`, record FPS/frame p95 at 50, 100, 200 and 320 soldiers, check gate readability and drag reversal, pause/resume and replay, then repeat on Android.** Use +10 → ×2 → weapon → ×2 → elite → ×3 → ×2 to exercise the maximum army. Tune draw/pose/DPR budgets from these device measurements before increasing crowd limits.

Final concept-matched character art, full production rigs and smooth GPU crowd skinning remain future work. There is no audio yet. Stage 1 is functionally complete in simulation, but it has not received a verified mobile visual/playability pass; it should be treated as a playable prototype, not a finished release.
