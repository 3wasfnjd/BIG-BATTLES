# BIG BATTLES — notes for Claude

- **Publishing:** the owner asked (2026-09-28) that every finished change be merged into `main` without asking for confirmation. After tests pass, push the working branch, open a PR and merge it. GitHub Pages serves `main`.
- Before committing runtime changes run `npm run release`, then `npm test` (it rejects a stale release stamp).
- Default mode is the Mob Control style defence (`src/core/DefenseGame.js`); `?mode=runner` keeps the forward runner. Balance check: `node tools/balance-defense.mjs`.
- Replies to the owner are in Arabic.
- Lammatna (`lammatna/`, Babylon.js family game): after editing `lammatna/src`, `lammatna/shared` or `lammatna/styles.css` run `npm run lammatna:build` (`npm test` rejects a stale bundle). Local multiplayer: `npm run lammatna:server`. Character models are configured in `lammatna/shared/characters.js`; inspect new GLBs with `node lammatna/tools/inspect-glb.mjs`.
