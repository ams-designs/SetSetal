# SetSetal

**Clean communities. A healthier Gambia.**

SetSetal is a mobile-first web app and Progressive Web App (PWA) designed to help residents in The Gambia find local waste collection services. It aims to make discovery simple and inclusive, supporting municipal and private trucks, small vehicles, tricycles, donkey carts, and horse carts.

> **Project status:** Clickable prototype / early MVP exploration. Current listings and reports are demonstration data. The application is not yet connected to a production backend.

## Contents

- [Project Goals](#project-goals)
- [Current Prototype](#current-prototype)
- [Technology](#technology)
- [Project Structure](#project-structure)
- [Run Locally](#run-locally)
- [Install on a Phone](#install-on-a-phone)
- [Testing](#testing)
- [Design Principles](#design-principles)
- [Privacy, Safety, and Trust](#privacy-safety-and-trust)
- [Current Limitations](#current-limitations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Project Goals

SetSetal aims to:

- Help residents discover suitable waste collectors by service area, vehicle type, and waste type.
- Include formal and informal collection providers, including small-scale and traditional transport.
- Give collectors a straightforward way to prepare a service listing.
- Work well on ordinary Android phones and slower internet connections.
- Build trust through accurate information, clear verification labels, and a way to report concerns.

## Current Prototype

The app is built for a pilot in Brikama. Until the first real collector is approved it shows labelled demonstration listings.

**How to use it, with screenshots: [docs/guide/README.md](docs/guide/README.md).**

- **Residents** choose an area, compare collectors, see who is collecting today, and call or message them on WhatsApp. No sign-up, address or GPS. They can report a problem anonymously, including when offline.
- **Collectors** sign in with a code sent by SMS, submit a listing for review, see its status and the reason for any decision, say "I'm collecting today", and can edit or delete everything.
- **Admins** review the queue, approve, reject, suspend and reinstate with a recorded reason, handle reports, manage the list of areas, and see anonymous usage counts.

**Important:** demonstration listings are fictional and labelled as such; they are never mixed with real ones. No listing is called verified, licensed or official. Before the pilot can start, the owner has to switch on SMS sign-in, deploy the database changes and answer the questions in [QUESTIONS.md](QUESTIONS.md); the steps are in [docs/pilot/launch-checklist.md](docs/pilot/launch-checklist.md).

## Technology

- **Vite + TypeScript** with vanilla modules. No UI framework.
- **CSS** for the responsive layout, accessible controls and styling.
- **SVG** interface and vehicle icons, with PNG app icons for Android.
- **vite-plugin-pwa** (Workbox) generates the web app manifest and the service worker, and versions the offline cache on every build.
- **Playwright** end-to-end tests on a Pixel 5 profile.

## Project Structure

```text
setsetal/
├── index.html              # Screen markup; text comes from data-i18n keys
├── src/
│   ├── main.ts             # Start-up and event wiring
│   ├── router.ts           # Hash routes, history and back
│   ├── api.ts              # Requests to Supabase with plain fetch
│   ├── listings.ts         # Listings, filters, cards and profile
│   ├── forms.ts, reports.ts# Feedback form and its offline outbox
│   ├── auth.ts, captcha.ts # Sign-in by SMS code; optional Turnstile check
│   ├── collector.ts, join.ts # A collector's own listing and the Join screen
│   ├── admin.ts            # Admin screen
│   ├── analytics.ts        # Anonymous usage counts
│   ├── install.ts          # "Install app" button
│   ├── ui.ts               # $, $$, escapeHTML, toast
│   ├── data/lookups.ts     # Areas, vehicles, waste and report types, from the database
│   ├── i18n/               # en.json (source), wo.json, mnk.json, t() helper
│   └── styles.css          # Design tokens and layout
├── public/                 # Icons and .well-known/assetlinks.json
├── supabase/               # Migrations and database tests
├── tests/e2e/              # Playwright specs
├── tests/guide/            # Takes the guide's and the Play Store's screenshots
├── android/                # Bubblewrap configuration for Google Play
├── docs/                   # Plan, guide, pilot runbooks, legal drafts, specs, store listing
├── vite.config.ts          # Build, manifest and service worker settings
└── netlify.toml            # Hosting and preview deploys
```

### Screen URLs

Every screen has a shareable URL: `#/`, `#/find`, `#/collector/<id>`, `#/join`, `#/join/preview`, `#/help`, `#/privacy` and `#/admin`.

## Run Locally

Install Node.js 22 or later, then:

```bash
npm i
npm run dev        # development server with hot reload at http://localhost:5173
```

To try the production build, including the service worker and offline mode:

```bash
npm run build
npm run preview    # http://localhost:4173
```

The service worker is only active in the production build.

## Install on a Phone

1. Deploy the app to a host with **HTTPS**. Netlify builds every branch to a preview URL once the repository is connected.
2. Open the HTTPS URL in Chrome on Android.
3. Tap **Install app** on the home screen, or use the browser menu and choose **Install app** / **Add to Home screen**.
4. Launch SetSetal from the home screen and test the layout.

## Testing

```bash
npm run typecheck
npx playwright install chromium   # once
npm test            # end-to-end tests
npm run test:db     # database migrations and security rules
```

To use an installed Chromium instead of downloading one, set `CHROMIUM_PATH`, for example `CHROMIUM_PATH=/usr/bin/chromium npm test`.

The Playwright suite covers most of the checklist below, plus back navigation, deep links, offline reload, axe accessibility checks and console errors. CI runs the type-check, build and tests on every push and pull request.

Before sharing the app with testers, check that:

- [ ] Welcome and role-selection buttons open the expected screens.
- [ ] Residents can filter listings by area, vehicle, and waste type.
- [ ] Selecting a listing opens its details.
- [ ] Registration validation identifies missing or malformed input.
- [ ] Registration previews clearly state that they have not been published.
- [ ] Feedback says clearly whether it was sent, saved on the phone to send later, or not sent.
- [ ] Controls work with touch and keyboard input.
- [ ] Text remains readable at increased browser font sizes.
- [ ] The layout works on narrow mobile screens.
- [ ] The browser console has no unexpected JavaScript errors.
- [ ] Offline behaviour is tested separately from online behaviour.
- [ ] Sample listings are never presented as real or verified providers.
- [ ] In-app and Android hardware back return one screen at a time.
- [ ] The in-app button installs the app, and it launches standalone.

Test with Gambian residents and collectors before finalising neighbourhood names, categories, terminology, language options, or assumptions about local collection practices.

## Design Principles

SetSetal should remain:

- **Simple:** One clear primary action per screen and short, understandable forms.
- **Inclusive:** Represent different collection methods fairly, including smaller and traditional providers.
- **Mobile-first:** Large touch targets, readable typography, and minimal unnecessary data use.
- **Locally grounded:** Validate area names, language needs, and collection practices with local users.
- **Trustworthy:** Distinguish sample, submitted, reviewed, and verified information.
- **Fair:** Rank results by relevance, service area, availability, and suitability—not payment for placement.

### Visual Foundation

The current visual direction uses a warm ivory background and a green-led palette.

| Design token | Value | Purpose |
|---|---|---|
| Primary green | `#147D59` | Main actions and brand |
| Dark green | `#174B3A` | Strong text and brand accents |
| Warm ivory | `#FAF8F1` | Main background |
| Terracotta | `#C46A43` | Secondary accent |
| Sun yellow | `#E8B84A` | Sparing highlights |
| Main text | `#28302D` | Primary text |
| Muted text | `#68746D` | Supporting text |
| Border | `#E4EBE5` | Dividers and card outlines |

Use SVG or other real vector icons rather than emoji for interface controls and vehicle categories. Aim for touch targets around **48 × 48 CSS pixels** where practical, and maintain visible keyboard focus.

## Privacy, Safety, and Trust

Before public launch:

- Collect only the information necessary to provide the service.
- Do not publicly expose a resident's exact home address.
- Make phone-number visibility and contact actions clear.
- Obtain permission before publishing collector contact details.
- Never use labels such as *verified*, *licensed*, or *official* unless the relevant checks have actually been completed and recorded.
- Establish procedures for reviewing reports, correcting listings, and suspending misleading or harmful accounts.
- Protect administrator tools with authentication and role-based access.
- Define data retention, deletion, and incident-handling procedures before collecting real user data.
- Confirm applicable Gambian data-protection, business, and municipal requirements with qualified local advisers.

The prototype is not a substitute for these production safeguards.

## Current Limitations

- **Not live yet.** Sign-in needs an SMS provider switched on in Supabase, and the hosted database needs the latest migrations. Until a real listing is approved, residents see demonstrations.
- No "verified" badge: what that means is undecided, so listings are "approved" only.
- No in-app booking, messaging, payments, ratings or location tracking. Residents and collectors arrange everything by phone.
- "Collecting today" is the collector's own statement; SetSetal does not check it.
- English only. Wolof and Mandinka files exist but are empty until native speakers translate and review them.
- The privacy notice and retention policy are drafts awaiting a Gambian legal adviser.
- Not yet tested on a real low-end Android phone.

Do not advertise capabilities that are not listed under Current Prototype.

## Roadmap

The plan of record is [docs/plan/README.md](docs/plan/README.md). In short:

| Phase | State |
|---|---|
| 0 Fix the prototype | Done, apart from a test on a real phone |
| 1 Foundation | Done, apart from the owner merging to `main` |
| 2 Backend and trusted listings | Built and tested; waits for SMS sign-in and a database deploy |
| 3 Controlled pilot | Software, runbooks, poster and draft policies ready; the pilot itself has not started |
| 4 Google Play | Configuration, listing text and graphics ready; needs a developer account |
| 5 After the pilot | Three small items built; the rest specified in `docs/specs/` and waiting for pilot data |

## Contributing

When reporting a problem, include:

- The device and browser used.
- The screen where the problem occurred.
- Steps to reproduce the issue.
- What you expected and what happened instead.
- A screenshot with personal information removed, if useful.

Do not include passwords, identity documents, private addresses, or other sensitive personal information in issue reports.

## License

No open-source license has been specified yet. Unless a license is added to the repository, assume that reuse, redistribution, and modification are not automatically granted.

---

**SetSetal is a work in progress.** The goal is to build a practical, fair, and trustworthy way for communities in The Gambia to connect with waste collection services—starting with a simple prototype and improving through real local feedback.
