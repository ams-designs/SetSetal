---
name: release
description: Prepare a SetSetal release by bumping the service-worker cache version (Phase 0) or checking the Vite/PWA build (Phase 1+), syncing the app-shell list, and running checks. Use when the user says "release", "ship", "deploy", or "bump the cache".
disable-model-invocation: true
---

# Release

## Phase 0 (hand-written `sw.js`)
1. Bump `CACHE_NAME` in `sw.js`, for example `setsetal-shell-v0-4` → `setsetal-shell-v0-5`.
2. Make sure `APP_SHELL` lists every file the app loads: compare it with `<link>`, `<script>` and the manifest icons. Include any new PNG icons.
3. Check that every `APP_SHELL` path exists: `for f in index.html styles.css app.js manifest.json icon.svg; do test -f "$f" || echo "MISSING $f"; done` (adjust to the real list).
4. Run `/test-checklist`.
5. Commit with the message `release: shell vX-Y` and a short changelog.

## Phase 1+ (Vite + vite-plugin-pwa)
1. `npm run build` must pass with no type errors, and `npm run preview` must serve `dist/`.
2. Check that `dist/sw.js` exists, that its precache manifest lists hashed assets, and that there is no `CACHE_NAME` constant anywhere.
3. Run `npx playwright test`.
4. Merge to `main`. The hosting provider deploys automatically. After the deploy, open the site on a phone that already has the app installed and confirm the update arrives.

Never deploy with trust-critical test failures, meaning `trust.spec.ts` or RLS tests.
