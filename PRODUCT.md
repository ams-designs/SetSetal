# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Residents of Brikama, The Gambia** who need someone to take their household waste. Many read little or no English, and some cannot read at all. They use cheap Android phones, often shared, on slow paid data, often outdoors in bright sun. Many have used little beyond WhatsApp and phone calls. They never sign in.
- **Collectors**: municipal and private trucks, vans, tricycles, donkey carts and horse carts. Many are informal, small-scale operators with the same reading level and phones as residents. They sign in with a code sent by SMS and keep one listing up to date.
- **Admins** (the SetSetal team) review every listing and report. They read well and use the admin screen; it is a working tool, not the focus of the low-literacy work.

## Product Purpose

Help residents find a local waste collector and contact them directly, and give collectors, formal and informal, a simple way to be found. Success: a person who cannot read can, alone and on the first try, (1) find a collector for their area and call or WhatsApp them, (2) report a problem, and, as a collector, (3) sign in, create a listing and say "I'm collecting today".

## Positioning

The only listing that treats donkey carts, horse carts and tricycles as equals to council trucks, built for people who don't read, on the phones and data they actually have. SetSetal takes no part in the call, the price or the payment.

## Operating Context

Pilot in Brikama (West Coast Region) first. People reach it from a QR poster or a shared link, open it in Chrome on Android, and may install it to the home screen. Contact happens by a normal phone call or WhatsApp. Collectors are signed up in person by the team (docs/pilot/onboarding-checklist.md).

## Capabilities and Constraints

- Mobile-first PWA: vanilla TypeScript + Vite, no UI framework, no heavy dependencies; first visit about 130 KB and should stay under about 150 KB; works offline after the first visit.
- All user-facing text lives in `src/i18n/en.json` (British English). Wolof and Mandinka come later, checked by native speakers; layouts must allow longer text.
- Areas, vehicle types and waste types come from the database; never hard-coded.
- Reports can be chosen by reason with the written detail optional (decided 26 Nov 2026; needs a database change).
- Call and WhatsApp may appear on the listing card itself, under the same consent rule (decided 26 Nov 2026).
- Undecided: the Brikama neighbourhood list (QUESTIONS.md Q3), what "verified" means (Q11), the final domain (Q9).

## Brand Commitments

- Name: SetSetal (from the Wolof "set setal", to make clean). Tagline: "Clean communities. A healthier Gambia."
- Existing logo mark and the green identity (`--green #147D59`, `--green-dark #174B3A`) in `public/icon.svg` and `index.html`.
- Icons are SVG, never emoji. The back chevron path is `m15 18-6-6 6-6`.
- Voice: plain, short, warm, honest. Never claims more than is true.

## Evidence on Hand

- No real collectors yet: the app shows six labelled demonstration listings. Never present them as real.
- Guide screenshots made with invented data: `docs/guide/img/` (`npm run guide:screenshots`).
- No user research, testimonials or usage data exist yet; do not invent any.

## Product Principles

1. **Trust before reach.** Demo data is always labelled, contact needs consent, "verified" appears only when a recorded check backs it, and nothing is ranked by payment.
2. **Anonymous by default.** Residents never sign in, and no resident address is ever asked for or stored.
3. **Honest about sending.** Anything not yet sent says so plainly.
4. **Picture first, word second.** Every choice and action is recognisable without reading.
5. **Cheap phone, slow data, bright sun.** Small payloads, offline first, big targets, strong contrast.

## Accessibility & Inclusion

WCAG 2.1 AA as the floor. Designed for low literacy and non-readers: icon plus short label on every action, one main action per screen, touch targets of 56 px or more, text 18 px or more, meaning never carried by colour alone, `prefers-reduced-motion` respected without losing feedback.
