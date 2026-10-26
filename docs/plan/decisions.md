# Owner decisions

The project owner must answer these before Phase 2 (backend) and Phase 3 (pilot). Record each answer and its date here, and update the code and plans to match.

| # | Question | Notes | Answer |
|---|---|---|---|
| D1 | **How do residents contact collectors?** Calls only, WhatsApp only, or both? | An in-app request form is a much bigger build, so leave it until after the pilot | **Both calls and WhatsApp** (26 Oct 2026) |
| D2 | **Who approves listings, and what does "verified" mean?** For example, met in person, or a municipal licence checked | The badge must describe a real check that is recorded in `audit_log` | **An admin approves listings** (26 Oct 2026). What "verified" means is still open, so until a check is defined listings show as approved only and no "verified" badge appears |
| D3 | **Which areas and languages does the pilot cover?** | Sets the `areas` seed, the translations and who to recruit. Suggested: Kanifing and Brikama, with en, Wolof and Mandinka | **Brikama, in English** (26 Oct 2026). Wolof and Mandinka wait until after the pilot. The neighbourhoods within Brikama for the `areas` seed are still to be listed |
| D4 | **Who legally owns the data?** A person, a business or a partner organisation | Needed for the privacy policy and the Play Store listing | _open_ |
| D5 | **What is the budget?** | The pilot is almost free: Supabase free tier, free hosting and US$25 for Play. The main ongoing cost is SMS sign-in codes, charged per message | _open_ |
