# Phase 3: Controlled pilot (~4–6 weeks)

**Goal:** residents in the pilot areas reach real collectors, and the complaint process has handled real reports.
**Blocked by:** decisions D2, D3 and D4 in [decisions.md](decisions.md).

## Tasks

- [ ] Choose one or two pilot areas, for example Kanifing and Brikama.
- [ ] Onboard 10–20 real collectors **in person**, including cart and tricycle operators, and record the verification check described in D2.
- [ ] Distribute the app as an installable PWA through a link and QR posters, with no app store yet.
- [ ] Privacy-respecting analytics (Plausible or Umami, with no cookies) tracking these events:
  - [ ] `search_no_results` (area, vehicle, waste)
  - [ ] `contact_tap` (call or WhatsApp; the collector ID is fine, the resident's identity is not)
  - [ ] `report_submitted` (type)
  - [ ] `listing_marked_wrong`
- [ ] Write a privacy notice and a data-retention policy, and **have a Gambian legal adviser check them** before onboarding.
- [ ] Run the complaint-handling procedure on real reports, and log what goes wrong.
- [ ] Test the Wolof and Mandinka wording with real users.

## Exit criterion

There is real contact traffic in the pilot areas, and at least one real report has been resolved through the admin flow.
