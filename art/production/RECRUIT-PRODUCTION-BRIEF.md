# Pilot asset: BIG BATTLES recruit

Deliver an actual editable, game-ready 3D character. A beautiful generated PNG or turntable alone does not satisfy this brief. The current scripted models are placeholders/studies; do not use their box-like equipment or cylindrical cloth as the quality reference.

Approved identity reference: [recruit-green.png](../references/recruit-green.png). Preserve the exact Saudi chibi identity: oversized expressive head, short heroic body, white ghutra with black double agal, green face covering and green military uniform, tan tactical equipment/kneepads, brown boots, compact rifle. No blue uniform, medieval knight helmet, swords, national inscriptions, real-world military insignia or new accessories. The original blue palette has explicitly been superseded by green.

## First approval, before rigging

Provide consistent front/side/back orthographic views, plus a rear three-quarter view at a gameplay elevation of approximately 38 degrees. Body in relaxed A-pose, rifle separate. Show the entire body with foot and cloth margins. Keep front/back proportions identical. Ghutra must have believable broad folds and a distinctive draped rear silhouette; show shoulder straps, the green sleeves, waist and separated legs. Avoid a white cylinder or sphere hiding the entire body.

The camera usually sees the soldier's back at a few dozen CSS pixels tall. Prioritize silhouette, color blocks and depth before embroidery or tiny surface scratches. The reference's face, cloth and hands require crafted geometry; do not substitute obvious cubes, plates pasted on a sphere, fused fingers, a weapon fused to the chest, or a solid skirt connecting both legs.

## Mesh/material delivery

- Production LOD0 target 1,500–3,000 **triangles**, not quads. Report the actual triangulated count, unique vertices and GLB bytes.
- Create optional LOD1 around 1,200 and LOD2 around 500 triangles preserving the head/ghutra/rifle silhouette. Runtime LOD integration is a separate task; name the files clearly.
- Prefer one shared material and one 512×512 base-color atlas containing restrained ambient occlusion. Reuse the soldier atlas across recruits. Do not bake a strong directional shadow into the color. A 1024×1024 source may be delivered for editing; show why it benefits the actual game view before using it at runtime.
- Avoid unnecessary transparent hair/cloth layers, transmission, environment reflections, 4K texture sets, unneeded metallic/normal maps, cameras, lights or scene props in the final character GLB.
- Keep clothing surfaces thick enough at visible edges; repair normals, degenerate faces, skin intersections and texture seams. Keep the gun a separate object attached to the hand bone.
- Keep original .blend, uncompressed GLB, texture source, rig/rest pose and export instructions. Do not deliver only an irreproducible compressed file.

## Rig and motion

Ground-centered origin, Y up, front toward -Z, approximately 1.45 m authored height before runtime scale. Name clips exactly `idle`, `run`, `shoot`, `hit`, `death`; time in seconds, in-place locomotion, no root travel along the path. Use a small humanoid skeleton with knees/elbows and normalized skin weights, maximum four joint influences per vertex. Aim for 15–24 useful bones; report any exception before integrating it.

Run: clear alternating steps, planted feet, slight torso bob, restrained ghutra motion; rifle held securely by both hands. Shoot: both hands and rifle recoil together, no detached grip or stretched forearm. Hit: short readable reaction. Death: one short collapse with a stable last pose, no ragdoll. Idle/run must loop without a jump. Supply rest/peak/end pose images and short actual 3D animation renders; state the renderer used.

## Verification and acceptance

1. View the GLB itself at front/back/side in the game's temporary preview; no replacement concept image.
2. Inspect every clip for finger/cloth intersections, head clipping, foot sliding and muzzle direction.
3. Compare at 390×844 CSS viewport, first one unit and then 6/32/100/200/320 units using the game's shared pose adapter.
4. Report materials, texture dimensions/decoded memory, bones, triangles, file bytes and runtime warnings.
5. The asset is accepted on visible likeness and animation plus measured mobile cost. A file passing numerical budgets alone is insufficient.

Suggested tool route: image-to-3D as a starting mesh if it produces a usable silhouette, followed by Blender cleanup, retopology, UV/AO, skinning and animation. The API's `target_polycount` is a request, not evidence of the output count. Never describe AI generation as complete until an exported GLB is inspected.
