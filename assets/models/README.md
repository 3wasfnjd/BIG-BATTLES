# Character assets — prototype status

These six GLBs are **procedural, animated prototypes**, not finished reconstructions of the approved illustrations. The supplied BIG-BATTLES-3D-CHARACTER-PACK contained images, prompts and specifications, but no GLB files. The existing silhouettes were preserved and the player palette was changed from blue to green at the user’s request on 2026-09-27, with masks, ghutra, shemagh pattern, eyebrows, pouches, claws and fangs refined. The approved reference artwork remains the target for final production art. The recruit has an improved scripted mesh from Higgsfield 3D Jutsu: it is a modeled draft, not an approved final reconstruction. The other five shapes are unchanged.

Every file has a compact seven-joint rigid skin, one vertex-color material, no textures, no cameras/lights/background, and five named clips. Rigid joints are appropriate to these simple shapes; this is not a full anatomical/humanoid production rig. Weapons are separate meshes; the commander's cape is separate. The recruit now falls within its 1,500–3,000 triangle target. The other five prototypes remain below their final-art budgets.

| File | Triangles | Bytes | Clips |
| --- | ---: | ---: | --- |
| `commander.glb` | 1,004 | 124,024 | idle, run, shoot, hit, death |
| `recruit.glb` | 2,640 | 204,764 | idle, run, shoot, hit, death |
| `elite.glb` | 728 | 91,500 | idle, run, shoot, hit, death |
| `enemy-grunt.glb` | 660 | 85,584 | idle, run, shoot, hit, death |
| `desert-beast.glb` | 578 | 82,628 | idle, walk, attack, hit, death |
| `giant-boss.glb` | 860 | 93,888 | idle, walk, attack, hit, death |

Total: 682,388 bytes (666.4 KiB), loaded as each character type first appears. `manifest.json` contains machine-readable measurements. `npm run models` regenerates the procedural prototypes and then packages the committed Higgsfield recruit source with the shared rigid animation clips. `tools/art/package-recruit.mjs` strips workshop cameras/lights, orients the mesh to -Z, merges body/rifle separately, packs vertex colors and builds the seven-joint rig. Do not run this recipe over later hand-authored final assets.

## Final asset replacement contract

- Keep the exact six filenames; change only `src/data/characters.js` visual settings if dimensions/clip names differ.
- Self-contained glTF 2.0 binary; Y up, face -Z, origin at ground between feet, applied transforms. Humanoid reference height about 1.44 units **before** the role scale; beast about 1.41. Boss shares the human source height and gets 2.6 role scale (about 3× a recruit's final height).
- Crowd meshes should share one material and use compatible attributes so body/weapon can merge into one draw per sampled pose. At most two merged materials and 12,000 vertices for pose baking; larger crowds assets retain static instancing. A single mesh with a material array is rejected safely to the procedural fallback; split material groups on export.
- Prefer 512–1024px opaque atlases if textures are needed. Current prototypes use zero textures. Draco/KTX2 decoders are not bundled.
- Recruit/elite/grunt clips are sampled into shared geometry on first load (8 run, 3 shoot, 3 hit, 4 death, 1 idle poses). That saves per-soldier skeleton/mixer evaluation but has visible stepped motion in closeups. Commander/beast/boss use continuous AnimationMixer clips.
- Set `modelUrl: null` to explicitly use the original procedural fallback. Network/parser failures also retain it; gameplay entities never depend on a model.

Validation loads the actual committed binaries through GLTFLoader, evaluates all clips, checks ground origin/bounds/finite skinned vertices, verifies separate weapons, merges crowd parts, and updates 320 players + 420 enemies. `node tools/inspect-models.mjs` writes projected triangle/color data to `.test-output/model-views.json` for offline inspection. The front/back views were checked with a CPU rasterizer; browser/GPU visual playback was unavailable in this environment.
