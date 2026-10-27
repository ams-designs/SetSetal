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

The front-end prototype demonstrates the intended user journey and interface. Depending on the current files, it may include:

- Welcome and resident/collector entry points.
- Sample collector listings and filters.
- Collector detail pages.
- A collector registration form and local preview.
- A feedback or reporting form.
- Basic navigation and responsive layouts.
- A PWA manifest and service worker for app-shell caching.

**Important:** Sample collectors are fictional examples for interface testing. They are not verified businesses or endorsements. Registration previews are not sent to a server. Feedback is sent to the SetSetal team without your name or contact details (saved on the phone first if it can't be sent); do not include addresses or other personal information.

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
│   ├── listings.ts         # Sample data, filters, cards and profile
│   ├── forms.ts            # Registration, preview and feedback
│   ├── install.ts          # "Install app" button
│   ├── ui.ts               # $, $$, escapeHTML, toast
│   ├── data/lookups.ts     # Areas, vehicles, waste and report types
│   ├── i18n/               # en.json (source), wo.json, mnk.json, t() helper
│   └── styles.css          # Design tokens and layout
├── public/                 # icon.svg and PNG icons, copied as-is
├── tests/e2e/              # Playwright specs
├── vite.config.ts          # Build, manifest and service worker settings
└── netlify.toml            # Hosting and preview deploys
```

### Screen URLs

Every screen has a shareable URL: `#/`, `#/find`, `#/collector/<id>`, `#/join`, `#/join/preview`, `#/help` and `#/admin`.

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
npm test
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

The prototype is not yet a live waste-collection marketplace.

- No production database or backend API.
- No real account creation, authentication, or password recovery.
- No persistent collector registration or approval workflow.
- No confirmed real-time availability, location tracking, routing, or booking.
- No live messaging, payment processing, or service guarantees.
- No production moderation queue or secure administrator dashboard.
- Local demonstration state may be lost when the page is refreshed.
- The service worker caches the app shell; it does not synchronise submissions or provide live services offline.

Do not advertise or rely on these capabilities until they have been implemented and tested.

## Roadmap

### Milestone 1 — Clickable Prototype

- [x] Establish the initial HTML, CSS, and JavaScript structure.
- [x] Define the initial brand direction and user journeys.
- [ ] Test navigation and forms on Android.
- [ ] Validate the experience with residents and collectors.

### Milestone 2 — Pilot Definition

- [ ] Confirm priority neighbourhoods and service areas.
- [ ] Agree on vehicle and waste categories.
- [ ] Decide whether the pilot will use direct calls, service requests, or both.
- [ ] Establish listing approval and complaint-handling procedures.
- [ ] Confirm municipal involvement and local compliance requirements.

### Milestone 3 — Backend and Trusted Listings

- [ ] Select the backend, database, and hosting approach.
- [ ] Implement authentication and role-based access.
- [ ] Store and validate collector profiles and service areas.
- [ ] Add administrator review, moderation, and audit history.
- [ ] Implement consent-aware contact actions and secure report submission.

### Milestone 4 — Controlled Pilot

- [ ] Onboard a small, diverse group of real collectors.
- [ ] Test listing accuracy and service-area matching.
- [ ] Monitor failed contacts, complaints, and usability issues.
- [ ] Improve the product before expanding to additional areas.

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
