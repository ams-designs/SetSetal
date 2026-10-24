# Code review: commit c9b36c6

The app is about 1,550 lines across 7 files. It is a single HTML file with 7 screens toggled by `app.js`, plus a stylesheet and a cache-first service worker.

## Keep doing

- Every value placed into `innerHTML` goes through `escapeHTML`.
- The accessibility basics are in place: a skip link, `aria-live` on results and toasts, `aria-current` on the nav, labelled controls, safe-area padding, and support for reduced motion.
- Fake data is never presented as real. Samples are labelled, calling is disabled, and forms say that nothing is sent.
- The service worker is correct for an app shell: network-first for navigations, cache-first for assets, and old caches are deleted.

## Bugs (Phase 0)

| ID | Bug | Where | Fix |
|---|---|---|---|
| B1 | Back skips a screen. `back()` pops twice, then `go()` pushes again, so Home → Find → Profile → Back lands on Home and the stack keeps growing | `app.js:175-183` | Pop once, then call `go(prev, { back: true })` |
| B2 | Three back arrows draw a broken line because the path is `m15 18-6-6 6 6` | `index.html:212, 224, 253` | Change the path to `m15 18-6-6 6-6` |
| B3 | Android's hardware back button exits the app because navigation never uses `history.pushState` or `popstate` | `app.js` `go()` | Push a history entry for each screen and handle `popstate` |
| B4 | "Other / not listed" is treated like "All areas" and shows every listing | `app.js:190-192` | Show no area matches and offer guidance in the empty state |
| B5 | The install button is never shown. `installPWA()` is unused, and the toast tells users to use the browser menu instead | `app.js:363, 429` | Add a visible Install button, shown only once `beforeinstallprompt` has fired |

## Gaps

| ID | Gap | Where | Phase |
|---|---|---|---|
| G1 | The only icon is an SVG marked `"any maskable"`. PNGs at 192 and 512 px, a maskable icon and an `apple-touch-icon` PNG are needed | `manifest.json:19`, `index.html:12` | 0 |
| G2 | Collectors can pick only one waste type | `index.html:190` | 0 |
| G3 | Areas, vehicle types and waste types are duplicated across filters, the form and the sample data | `index.html`, `app.js` | 0 (dedupe), 2 (DB) |
| G4 | The cache version is bumped by hand | `sw.js:3` | 1 |
| G5 | No translations, tests or URL routing, and the admin screen is reachable only from the console | whole app | 1, 2 |
