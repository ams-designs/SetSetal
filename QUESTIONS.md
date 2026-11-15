# Questions for the owner

Set aside on 14–15 November 2026 while finishing the phases. None of them stopped the build: where a choice had to be made, the default taken is stated and is easy to change. They are in order of how much they block.

## Needed before the pilot can start

| # | Question | Why it matters | Default taken |
|---|---|---|---|
| Q1 | **Who legally owns the data?** (decision D4) A person, a business or an organisation, with an address and a contact | The privacy notice must name them; the Play account must be theirs | The app says "the SetSetal team". `docs/legal/privacy-notice.md` has the gaps marked |
| Q2 | **How are sign-in codes sent, and what is the monthly budget?** (D5) A paid SMS provider, or an Android phone as a gateway | Collectors cannot sign in until this is switched on in Supabase | Nothing is switched on. The app says "Sign-in isn't available yet" |
| Q3 | **Which neighbourhoods of Brikama?** (D3) | Collectors choose their areas from this list | Only `Brikama` exists. Add the rest on the admin screen under Areas: no code needed |
| Q4 | **Who is the first admin?** Their phone number | Someone has to approve listings | Nobody. The step is in `docs/pilot/launch-checklist.md` |
| Q5 | **Which Gambian legal adviser will check the privacy notice and retention policy?** | Phase 3 requires it before onboarding | Drafts are in `docs/legal/`, with questions for the adviser |
| Q6 | **May I deploy the database changes to the hosted Supabase project?** It is paused, and my access to it was refused, so I did not touch it | The new features need five new migrations there | Not deployed. Two commands, in the launch checklist |

## Needed before the Play Store

| # | Question | Default taken |
|---|---|---|
| Q7 | **A public contact email** for the store listing and for privacy requests | None. The app points people to the feedback form |
| Q8 | **Is `org.setsetal.app` the right package name?** It can never be changed after publishing | Used in `android/twa-manifest.json` |
| Q9 | **Will the site stay at setsetal.netlify.app or move to its own domain?** The posters' QR code and the Android app both point at it | setsetal.netlify.app |
| Q10 | **Who pays for and holds the Play developer account** (US$25) and keeps the signing key safe? | Not created |

## Product choices I made that you may want to change

| # | Choice | Alternative |
|---|---|---|
| Q11 | **What does "verified" mean?** (D2) Still open, so no badge exists. Approvals record what the admin checked in the reason | Suggested: "met in person and phone number confirmed by a call", recorded in the approval reason |
| Q12 | **Usage counts are kept in SetSetal's own database** instead of Plausible or Umami, which the plan named. No account, no cost, no third-party script, no cookies | Switch to Plausible (paid) or Umami: `src/analytics.ts` is the only file to change |
| Q13 | **Retention periods:** reports 12 months after closing, counts 12 months | Any other period: one SQL function |
| Q14 | **Collectors who say they're collecting today are listed first.** I judged this "suitability", not payment (rule 5) | Keep the label but sort by name only: one line in `src/listings.ts` |
| Q15 | **Three complaints of the same kind in a month lead to suspension**, in the complaints procedure | Your own threshold |
| Q16 | **The footer still says "Prototype"** ("SetSetal · Prototype for cleaner communities in The Gambia · By Ams.Designs"), and the Find screen says "This prototype does not track your GPS location". I left your wording | Change to "Pilot" when the first real listing goes live |
| Q17 | **Phase 5:** I built "Collecting today", area management and the WhatsApp starter message, and wrote specs for service requests, ratings, SMS/USSD and iOS instead of building them, because the plan says to wait for pilot data and two of them conflict with the product rules as written | Tell me which to build and I'll do it; `docs/specs/` has the cost of each |

## Things only you can do

Listed in `docs/pilot/launch-checklist.md`: restore and migrate the database, switch on SMS, add the admin, merge to `main`, test on a real low-end Android phone, onboard collectors in person, and run the Play release.
