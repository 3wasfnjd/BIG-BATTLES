# Character production references

The player palette changed from blue/tan to **green/tan** at the owner's request on 2026-09-27. This applies to commander, recruit and elite. Preserve the approved silhouettes, clothing, weapons and enemy identity.

`references/recruit-green.png` is a transparent image reference, **not a 3D model or game screenshot**. It was edited from `02_recruit_soldier/main_view.png` in the user-supplied BIG-BATTLES-3D-CHARACTER-PACK using the built-in image-generation tool. It is a production source and is never downloaded by the game.

Prompt: “Edit the approved BIG BATTLES recruit reference. Isolate the single large foreground Saudi chibi soldier on a transparent background. Keep the oversized head, short limbs, brown eyes and eyebrows, white ghutra, black agal, tan equipment and kneepads, brown boots, compact rifle, hand grip, proportions and pose. Change blue fabric to emerald military green (#23894f), the mask to darker green (#247547), and rifle panels to matching green. Keep the white, tan, skin, brown and black colors. Remove the desert, ground, banner, text, inset characters and card borders. Do not add accessories, scenery, text or a pedestal. Show the complete character and boots with a small transparent margin.”

The runtime `assets/models/*.glb` files remain lightweight animated prototypes. Their colors have been updated directly in both the GLBs and the procedural fallback source. Creating this image does not complete the final-model work.

## Recruit workshop and game export

[Higgsfield 3D Jutsu workshop](https://higgsfield.ai/3d-jutsu/140449dd-91e5-475a-94a9-2c0e86eec170), settled revision 3. This is custom scripted Blender modeling guided by the supplied art, not Meshy image-to-3D. The catalog exposed Meshy but the connected tool set did not expose its required generation command. No Meshy generation was submitted.

- `sources/recruit-workshop.glb`: committed static workshop export, 171,708 bytes, 2,640 triangles; editable semantic mesh names and one vertex-palette material. Source cameras/lights are stripped when packaging the game model. This file is not requested by the runtime.
- `../tools/art/build_recruit.py`, `refine_recruit.py`, `fix_recruit_eyes.py`: ordered Blender 5.2 workshop edits. Run the first only in an empty scene, followed by the other two. The Higgsfield `artifacts` registry publishes inspection renders.
- `../tools/art/package-recruit.mjs`: reproducibly converts the saved source to `assets/models/recruit.glb`: 204,764 bytes, two meshes sharing one material, zero textures, seven rigid joints and idle/run/shoot/hit/death. `animation-clips.mjs` is shared with the existing prototype generator.

Run `npm run models` to rebuild the current six game assets, including the workshop recruit. The game still uses the simple green procedural recruit if the GLB fails to load. The new recruit shares cached poses across crowds; it adds no per-soldier skeleton.

The workshop render was inspected in Eevee and the actual packaged GLB was checked through the game's loader and offline projection. This remains a draft with limited rigid animation and simplified folds, eyes and equipment; it is not an approved final likeness. Real phone rendering and performance remain unverified.

## Quality study, workshop revision 4

`tools/art/quality_recruit.py` edits the settled revision 3 once. It reshapes the ghutra's rear silhouette, adds rear vest details and eye rims, then bakes contact occlusion into vertex colors. Revision 4 was rendered from front/back in Eevee and visually inspected. `art/reviews/recruit-quality-front.png` and `recruit-quality-back.png` are those renders, not browser screenshots. This test remains visibly primitive in the face, clothing, hands and equipment; it was **not accepted as production-quality art**.

`sources/recruit-quality-workshop.glb` is the exact 220,992-byte workshop source. `npm run models:quality` produces `assets/models/quality/recruit.glb` (263,560 bytes, 3,384 triangles, 3,881 vertices, two meshes sharing one material, zero textures, seven rigid joints and five clips). It deliberately uses a separate path; the approved runtime replacement contract and original six files remain intact. Only `?quality=1` uses this candidate.

The concrete next art task is described in [production/RECRUIT-PRODUCTION-BRIEF.md](production/RECRUIT-PRODUCTION-BRIEF.md) and [production/quality-contract.json](production/quality-contract.json). Numerical correctness alone does not establish visual quality. This study is not a Meshy output; no image-to-3D generation was submitted.
