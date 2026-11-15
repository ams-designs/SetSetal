# Phase 5 specs

Phase 5 says: build an item only if the pilot's data shows demand, and write a spec first. Two small items were built now because they are cheap, break no product rule, and make the pilot's data more useful. The rest are specified here and wait for evidence.

| Item | Status | Why |
|---|---|---|
| "Collecting today" availability | **Built** | One date column; no review burden; switches itself off. See below |
| Expansion to more areas | **Built** (the tooling) | Admins add and switch off areas on the admin screen; no code change or deploy is needed |
| A message to start the WhatsApp chat | **Built** | The lightest form of a "service request": nothing is stored |
| Service requests in the app | [Spec](service-requests.md), not built | Needs a resident's contact or address, which rule 3 forbids as things stand |
| Ratings | [Spec](ratings.md), not built | Anonymous ratings are easy to fake and would break rule 5 (fair ranking) |
| SMS or USSD for residents without smartphones | [Spec](sms-ussd.md), not built | Needs a contract with a Gambian operator or aggregator, and a budget (D5) |
| Push notifications (Capacitor) | Not specified | Only needed if in-app service requests are built |
| iOS App Store | [Note](ios.md), not built | US$99 a year; the web app already installs on iPhones from Safari |

## What the pilot data should show before building

| Build | When the Activity section and reports show |
|---|---|
| Service requests | Residents report that calls go unanswered, or contact taps are high but collectors say few jobs result |
| Ratings | Repeated reports about the same few collectors, and residents asking how to choose between listings |
| SMS or USSD | Collectors or community leaders report residents without smartphones asking for numbers |
| iOS release | A meaningful share of visitors on iPhones (Netlify's analytics or the server logs show the device mix; the app itself does not record it) |

## "Collecting today": what was built

- A collector with an approved listing taps **I'm collecting today**. It lasts until midnight (UTC, which is Gambian time) and then switches itself off, so a forgotten switch never misleads for days.
- Residents see a **Collecting today** label; those listings come first, then the rest by name. That ordering is by suitability, never payment (rule 5).
- It is the collector's own statement. The profile says so: "SetSetal hasn't checked this, so confirm when you call."
- It is not reviewed by an admin and does not send the listing back for review.
- A listing saved on a phone on an earlier day never shows the label.
- Code: `supabase/migrations/20261114090000_availability.sql`, `src/join.ts`, `src/listings.ts`. Tests: `supabase/tests/availability.test.sql`, `tests/e2e/collector.spec.ts`.
