# SetSetal plan

Source: "Turning SetSetal into a real app", the code review and product plan written at commit `c9b36c6` on 19 Oct 2026.

**Strategy:** keep the web codebase. Add a backend and an admin review flow, pilot it as a PWA in one or two areas, then publish the same app to Google Play as a Trusted Web Activity (TWA). A Capacitor wrapper is the option only if the pilot shows a need for native features. Don't rewrite in React Native or Flutter.

## Phases

The phases run in order. Each one ends with something real people can use. The durations assume one or two part-time developers.

| # | Phase | Duration | Status | File |
|---|---|---|---|---|
| 0 | Fix the prototype | ~1 week | **Active** | [phase-0-fix-prototype.md](phase-0-fix-prototype.md) |
| 1 | Foundation | ~2 weeks | Not started | [phase-1-foundation.md](phase-1-foundation.md) |
| 2 | Backend and trusted listings | ~3–4 weeks | Not started | [phase-2-backend.md](phase-2-backend.md) |
| 3 | Controlled pilot | ~4–6 weeks | Not started | [phase-3-pilot.md](phase-3-pilot.md) |
| 4 | Google Play release | ~1–2 weeks | Not started | [phase-4-play-store.md](phase-4-play-store.md) |
| 5 | After the pilot | Data-driven | Not started | [phase-5-post-pilot.md](phase-5-post-pilot.md) |

When a phase's exit criterion is met, change its status here and set the next phase to **Active**.

## Supporting docs

- [code-review.md](code-review.md): review findings with file and line references
- [data-model.md](data-model.md): Supabase schema and row-level security (RLS) rules
- [decisions.md](decisions.md): open decisions for the project owner. **Phases 2 and 3 are blocked until these are answered.**

## Target stack

| Layer | Choice | Why |
|---|---|---|
| Front end | Vite + TypeScript, vanilla modules | Hashed assets, a dev server and type checking, with no framework. Revisit Preact or Svelte only if the admin tools grow large |
| Offline | `vite-plugin-pwa` (Workbox) | Automatic precache and versioning, plus a queue for reports sent offline |
| Backend | Supabase (Postgres, Auth, Storage) | RLS, phone sign-in by SMS code and a free tier, with no server to run |
| Sign-in | Phone + SMS code for collectors; none for residents | Collectors have phones, and many don't use email |
| Contact | `tel:` and `wa.me` links | Work on every phone. Shown only with consent |
| Hosting | Netlify, Cloudflare Pages or Vercel | Free HTTPS, which installation and service workers need |
| Tests | Playwright, mobile viewport | Automates the README checklist, including back navigation and offline behaviour |
