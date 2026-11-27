# Google Play listing (Phase 4)

Draft text and answers for the Play Console. Everything here describes what the app does today; change it if the app changes. Nothing below claims that collectors are verified, licensed or official, because no such check is recorded yet (decision D2).

**Blocked on the owner:** a Play developer account in the data owner's name (D4, US$25), the privacy policy checked by a Gambian legal adviser, and real listings to photograph.

## Store listing

| Field | Text |
|---|---|
| App name (30) | SetSetal: Waste Collectors |
| Short description (80) | Find a local waste collector in Brikama and contact them directly. |
| Category | House & Home (alternative: Maps & Navigation is wrong; Tools is acceptable) |
| Contact email | _owner to supply (question Q7)_ |
| Privacy policy URL | https://setsetal.netlify.app/#/privacy |

### Full description

```
SetSetal helps residents of Brikama, The Gambia, find someone to collect their waste: trucks, vans, tricycles, donkey carts and horse carts.

FIND A COLLECTOR
• Choose your area from a list. No sign-up, no address, no GPS.
• See which collectors serve your area, what vehicle they use and what waste they take.
• See who has said they are collecting today.
• Call or message the collector on WhatsApp. You agree the time and the price with them directly.

LISTINGS YOU CAN RELY ON
• The SetSetal team reviews every listing before residents can see it.
• A collector's phone number appears only if they have agreed to show it.
• Found a wrong number or had a problem? Report it from the listing. Reports are anonymous.

FOR COLLECTORS
• Sign in with your phone number and a code sent by SMS. No password.
• Say what you collect and where, then submit your listing for review.
• Tap "I'm collecting today" so residents see you first.
• Change or delete your listing at any time.

BUILT FOR EVERYDAY PHONES
• Small download, and works on a slow connection.
• Listings you have seen stay available without a connection.

SetSetal does not collect waste, set prices or take payments. It is a pilot in Brikama.
```

### Graphics

| Asset | File | Note |
|---|---|---|
| App icon 512 × 512 | `public/icons/icon-512.png` | |
| Feature graphic 1024 × 500 | `feature-graphic.png` | |
| Phone screenshots 1080 × 1920 | `screenshots/1-home.png` … `6-privacy.png` | **Retake before submitting.** These show invented collectors. Play requires screenshots of the real app, and SetSetal's own rule 1 forbids presenting sample data as real. Once real listings are approved, photograph the live app, or change `tests/guide/fake-backend.ts` to match and run `npx playwright test --config playwright.guide.config.ts store` |

## Data safety form

Answer from what the code and database actually do (`docs/plan/data-model.md`, `docs/legal/privacy-notice.md`).

| Question | Answer |
|---|---|
| Does the app collect or share user data? | Yes (collects). It shares none with third parties for their own use |
| Is all data encrypted in transit? | Yes (HTTPS only) |
| Can users ask for their data to be deleted? | Yes. Collectors delete their listing and account in the app (Join → Delete my listing and account) |

| Data type | Collected? | From whom | Purpose | Required? |
|---|---|---|---|---|
| Phone number | Yes | Collectors only | Account management (sign-in), app functionality (shown to residents with consent) | Required to list a service |
| Name | Yes | Collectors only (name or business name) | App functionality | Required to list a service |
| Other user-generated content | Yes | Collectors (description); anyone (feedback text) | App functionality | Optional |
| App interactions | Yes | Everyone, **not linked to any user or device** | Analytics: counts of searches with no result, contact taps per listing, feedback by type | Collected unless the browser sends Do Not Track |
| Location | No | | Area is chosen from a list; no GPS, no address | |
| Contacts, messages, photos, files, financial, health, device IDs | No | | | |

Residents: no account, and no personal data collected. The feedback form asks them not to include contact details.

## Content rating and other declarations

- Content rating questionnaire: no violence, sexual content, gambling or user-to-user chat. Users can publish text (listings), which the team reviews **before** it is shown. Expected rating: Everyone.
- Target audience: 18 and over (the app arranges a paid service).
- Ads: none. In-app purchases: none.
- News app, COVID-19 app, government app: no. SetSetal is not a government or council service and must not be presented as one.

## Release order

Internal testing (the team's phones) → closed testing (the pilot's collectors and a few residents) → production. Google requires new personal developer accounts to run a closed test with at least 12 testers for 14 days before production, so start it early.
