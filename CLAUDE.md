# SetSetal

Mobile-first PWA that helps residents in The Gambia find local waste collectors (municipal and private trucks, vans, tricycles, donkey carts, horse carts). Repo: `ams-designs/SetSetal`.

**Status:** built for the Brikama pilot, not yet live. Listings are demonstration data until a real one is approved. The hosted database has every migration (deployed 23 Nov 2026; next steps in `docs/pilot/launch-checklist.md`), and `QUESTIONS.md` lists what the owner still has to decide.
**Plan of record:** [docs/plan/README.md](docs/plan/README.md). Check which phase is active there before starting work.

## Current layout

Vite + TypeScript with vanilla modules, no UI framework. `npm run dev` for development; `npm run build && npm run preview` for the production build (the service worker only exists there). `npm test` runs Playwright against the build; set `CHROMIUM_PATH` to use an installed Chromium, or `BASE_URL` to test a deployed preview. `npm run test:db` runs the database tests.

| File | Role |
|---|---|
| `index.html` | All 8 screens as `<section class="screen" id="...">`: home, find, profile, join, preview, help, privacy, admin. No literal text: elements carry `data-i18n` / `data-i18n-aria-label` / `data-i18n-placeholder` keys |
| `src/router.ts` | Hash routes (`#/`, `#/find`, `#/collector/:id`, `#/join`, `#/join/preview`, `#/help`, `#/privacy`, `#/admin`), `go`, `back`, popstate. Browser history is the only back stack |
| `src/listings.ts`, `src/forms.ts`, `src/install.ts`, `src/ui.ts` | Listings and filters; registration, preview and feedback; install button; `$`, `escapeHTML`, `toast` |
| `src/admin.ts` | Admin screen: review queue, reports, live and hidden listings, history, areas, activity counts. Decisions go through `set_collector_status` with a reason and the version reviewed (the server answers 409 if the listing changed) |
| `src/analytics.ts` | Anonymous usage counts into the `events` table. Never add a user, device, address or free-text field (rule 3) |
| `src/captcha.ts` | Optional Turnstile check before a sign-in code is sent; on only when `VITE_TURNSTILE_SITE_KEY` is set |
| `src/auth.ts`, `src/collector.ts`, `src/join.ts` | Collector sign-in by SMS code (plain fetch to Supabase Auth); their own listing, `save_my_listing()`, `set_my_availability()` and `delete_my_account()`; the Join screen (sign-in, form, preview, status) |
| `src/api.ts`, `.env` | Reads approved listings from Supabase with plain `fetch` and the publishable key. Real listings replace all demos once one exists; never mixed. `.env` holds public values only; secrets never go in the repo. `src/types/db.ts` is generated |
| `src/data/lookups.ts` | Areas, vehicles, waste and report types, loaded from `app_lookups()` and saved for offline. It holds no list of ids: a type is offered if the database has it in use and `en.json` has a `lookup.*` label for it |
| `src/i18n/` | `en.json` is the source of truth; `wo.json`/`mnk.json` are stubs; `review-status.json` tracks native review; `t(key, vars)` |
| `src/styles.css` | Design tokens on `:root` (`--green`, `--ivory`, …) and the layout |
| `vite.config.ts` | Manifest and `vite-plugin-pwa` (Workbox `generateSW`). Cache versioning is automatic |
| `public/` | `icon.svg` and PNG icons |
| `tests/guide/` | `npm run guide:screenshots` photographs the app for `docs/guide` with a made-up backend. Not part of `npm test` |
| `android/`, `docs/play-store/` | Phase 4: Bubblewrap config, store text, data-safety answers and graphics |
| `docs/pilot/`, `docs/legal/`, `docs/specs/` | Pilot runbooks and poster (`npm run poster`), draft privacy notice and retention policy, Phase 5 specs |
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
- **Lists:** areas, vehicle types and waste types have a single source, the database. Don't add a hard-coded copy. A new vehicle or waste type needs a row in its table, a `lookup.*` label in `en.json` and, for vehicles, an icon in `src/listings.ts`.
- **Database:** `src/types/db.ts` is generated from the hosted project; regenerate it after every migration you deploy. The free-tier project pauses after a week unused: restore it from the dashboard before deploying. Retention periods live in `private.apply_retention()` and `docs/legal/data-retention.md`: change both together.
- **Copy:** use British English, plain and short. From Phase 1 all user-facing text lives in translation files (en first, then Wolof and Mandinka, checked by native speakers). The pilot runs in English only (D3).
- **Commits:** keep them small and focused, and tie each one to a task in the active phase file.

## Claude tooling in this repo

- Agents in `.claude/agents/`: `pwa-specialist`, `supabase-backend`, `trust-safety-reviewer`, `a11y-mobile-reviewer`, `e2e-tester`, `i18n-localizer`.
- Skills in `.claude/skills/`: `/next-task`, `/phase0-fixes`, `/release`, `/pwa-icons`, `/add-screen`, `/supabase-migration`, `/test-checklist`, `/trust-check`, `/twa-release`.
- After finishing a task, tick it off in the phase file under `docs/plan/`.
