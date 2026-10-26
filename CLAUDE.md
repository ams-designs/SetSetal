# SetSetal

Mobile-first PWA that helps residents in The Gambia find local waste collectors (municipal and private trucks, vans, tricycles, donkey carts, horse carts). Repo: `ams-designs/SetSetal`.

**Status:** clickable prototype. All listings are demonstration data. No backend.
**Plan of record:** [docs/plan/README.md](docs/plan/README.md). Check which phase is active there before starting work.

## Current layout (Phase 1)

Vite + TypeScript with vanilla modules, no UI framework. `npm run dev` for development; `npm run build && npm run preview` for the production build (the service worker only exists there). `npm test` runs Playwright against the build; set `CHROMIUM_PATH` to use an installed Chromium, or `BASE_URL` to test a deployed preview. `npm run test:db` runs the database tests.

| File | Role |
|---|---|
| `index.html` | All 7 screens as `<section class="screen" id="...">`: home, find, profile, join, preview, help, admin. No literal text: elements carry `data-i18n` / `data-i18n-aria-label` / `data-i18n-placeholder` keys |
| `src/router.ts` | Hash routes (`#/`, `#/find`, `#/collector/:id`, `#/join`, `#/join/preview`, `#/help`, `#/admin`), `go`, `back`, popstate. Browser history is the only back stack |
| `src/listings.ts`, `src/forms.ts`, `src/install.ts`, `src/ui.ts` | Listings and filters; registration, preview and feedback; install button; `$`, `escapeHTML`, `toast` |
| `src/auth.ts`, `src/collector.ts`, `src/join.ts` | Collector sign-in by SMS code (plain fetch to Supabase Auth); their own listing and `save_my_listing()`; the Join screen (sign-in, form, preview, status) |
| `src/api.ts`, `.env` | Reads approved listings from Supabase with plain `fetch` and the publishable key. Real listings replace all demos once one exists; never mixed. `.env` holds public values only; secrets never go in the repo. `src/types/db.ts` is generated |
| `src/data/lookups.ts` | The single source for areas, vehicles, waste and report types (ids; labels come from i18n) |
| `src/i18n/` | `en.json` is the source of truth; `wo.json`/`mnk.json` are stubs; `review-status.json` tracks native review; `t(key, vars)` |
| `src/styles.css` | Design tokens on `:root` (`--green`, `--ivory`, …) and the layout |
| `vite.config.ts` | Manifest and `vite-plugin-pwa` (Workbox `generateSW`). Cache versioning is automatic |
| `public/` | `icon.svg` and PNG icons |
| `tests/e2e/` | Playwright specs (Pixel 5). Every test fails on a console error, and every Supabase call is mocked (`mockListings`), so tests never touch the live database |
| `supabase/` | Phase 2 backend: `migrations/` (schema, RLS, lookup seeds) and `tests/` (pgTAP). Hosted project `gplmfpglapxicfghlkid` |
| `scripts/test-db.mjs` | `npm run test:db`: applies the migrations and runs the pgTAP tests in PGlite, with no Docker. `scripts/db-test/` stubs the Supabase roles and a pgTAP subset |

The target stack is in [docs/plan/README.md](docs/plan/README.md#target-stack).

## Non-negotiable product rules

These rules make the product trustworthy, so treat them as constraints, not preferences.

1. **Never present demo or unverified data as real.** Sample listings carry a visible "Demonstration listing" label. "Verified", "licensed" and "official" appear only when a recorded check (in `audit_log`) backs them.
2. **Contact needs consent.** Show the Call and WhatsApp buttons only when a listing is approved *and* has `consent_at` recorded.
3. **No resident addresses.** Residents browse anonymously, and reports never store a resident address.
4. **Be honest about sending.** Any form that doesn't reach a server must say so.
5. **Rank results fairly.** Order results by relevance, area and suitability, never by payment.
6. **Escape all interpolated HTML.** Every value placed into `innerHTML` goes through `escapeHTML`. Prefer `textContent`.

## Engineering conventions

- **Target device:** a low-end Android phone on slow, paid data. Keep payloads small, add no heavy dependencies, and make it work offline-first.
- **Accessibility:** touch targets of 48×48 px or larger, visible focus, labelled controls, `aria-live` for results and toasts, `aria-current` on the nav, and respect for `prefers-reduced-motion`.
- **Icons:** use SVG, never emoji. The back chevron path is `m15 18-6-6 6-6`.
- **Lists:** keep areas, vehicle types and waste types in a single source. Today that's `src/data/lookups.ts`; from Phase 2 it's the database. Don't add another hard-coded copy.
- **Copy:** use British English, plain and short. From Phase 1 all user-facing text lives in translation files (en first, then Wolof and Mandinka, checked by native speakers). The pilot runs in English only (D3).
- **Commits:** keep them small and focused, and tie each one to a task in the active phase file.

## Claude tooling in this repo

- Agents in `.claude/agents/`: `pwa-specialist`, `supabase-backend`, `trust-safety-reviewer`, `a11y-mobile-reviewer`, `e2e-tester`, `i18n-localizer`.
- Skills in `.claude/skills/`: `/next-task`, `/phase0-fixes`, `/release`, `/pwa-icons`, `/add-screen`, `/supabase-migration`, `/test-checklist`, `/trust-check`, `/twa-release`.
- After finishing a task, tick it off in the phase file under `docs/plan/`.
