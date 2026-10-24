# Phase 1: Foundation (~2 weeks)

**Goal:** the app looks the same, but releases are automatic and every screen has its own URL.
**Agents:** `pwa-specialist` (Vite and Workbox), `i18n-localizer`, `e2e-tester`.

## Tasks

- [ ] Scaffold Vite + TypeScript (`npm create vite@latest`, vanilla-ts) around the existing files. Keep the markup and CSS as they are.
- [ ] Split `app.js` into modules:
  - `src/router.ts` (hash routes, history, back)
  - `src/listings.ts` (data, filters, cards, profile)
  - `src/forms.ts` (registration, report)
  - `src/ui.ts` (toast, `$`/`$$`, `escapeHTML`)
  - `src/install.ts`
  - `src/data/lookups.ts` (areas, vehicles, waste types)
- [ ] Hash routes: `#/`, `#/find`, `#/collector/:id`, `#/join`, `#/join/preview`, `#/help`, `#/admin`. Deep links must work on a cold load, so a WhatsApp-shared `#/collector/demo-truck` opens that profile.
- [ ] Replace `sw.js` with `vite-plugin-pwa` (`generateSW`, `registerType: 'autoUpdate'`), with the manifest moved into the Vite config. Delete the manual `CACHE_NAME`.
- [ ] Move all text into `src/i18n/en.json` and add a tiny `t(key, vars)` helper. Stub `wo.json` and `mnk.json`, and mark their strings as needing native review.
- [ ] Add Playwright with the Pixel 5 device profile and Chromium. Cover the README checklist (see `/test-checklist`), plus back navigation, deep links and offline reload.
- [ ] CI with GitHub Actions: type-check, build, then Playwright. Deploy every branch to a preview URL on Netlify or Cloudflare Pages.
- [ ] Update the README's run instructions (`npm i`, `npm run dev`).

## Exit criterion

The UI is visually unchanged. Merging to `main` deploys automatically, every screen has a shareable URL, and CI is green.
