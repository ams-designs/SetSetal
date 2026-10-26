# Phase 2: Backend and trusted listings (~3–4 weeks)

**Goal:** a collector can sign up on their phone, an admin can approve them, and a resident can then find and call them.
**Decisions:** D1–D3 answered on 26 Oct 2026 in [decisions.md](decisions.md): calls and WhatsApp, an admin approves, and the pilot is Brikama in English. What "verified" means is still open, so build approval without a "verified" badge.
**Agents:** `supabase-backend` (schema, RLS, auth), `trust-safety-reviewer` (must review every PR in this phase), `e2e-tester`.

## Tasks

- [x] Create the Supabase project and set up the CLI locally (`supabase init`, `supabase start`).
  - [x] `supabase/` initialised (`config.toml`, migrations, tests).
  - [x] Hosted project `SetSetal` (ref `gplmfpglapxicfghlkid`, eu-west-1), owned by the owner's organisation; Adlai is Administrator. All migrations applied and recorded (26 Oct 2026). Docker for `supabase start` is still optional.
- [x] Write migrations for the schema in [data-model.md](data-model.md), using `/supabase-migration`.
- [x] RLS: the public sees only approved listings, collectors edit only their own (and can't change `status`), and admins see everything. Write SQL tests for each policy. `npm run test:db` runs them in PGlite (CI too); `supabase test db` runs the same files on a real stack.
- [ ] Seed `areas`, `waste_types` and `vehicle_types` from the D3 answer (Brikama and its neighbourhoods). The front end reads these tables, so delete the hard-coded lists.
  - [x] Seeded in a migration: vehicle, waste and report types, and the `brikama` area.
  - [ ] Brikama neighbourhoods (owner to list), then switch the front end to the tables.
- [ ] Phone OTP sign-in for collectors (Supabase Auth with an SMS provider). Residents get no sign-in.
  - [x] App side (`src/auth.ts`): code by SMS, session refresh, sign-out, and sign-in ends after 7 days unused (shared phones).
  - [ ] Switch on the phone provider in the Supabase dashboard, with test numbers for development.
  - [ ] Choose how codes are sent for the pilot (decision D5): an Android phone as SMS gateway through Supabase's Send SMS hook, or a paid provider.
  - [ ] **Before launch:** set Supabase Auth SMS rate limits and turn on a captcha for `/otp` (needs `captcha_token` in the request), so nobody can run up the SMS bill.
- [x] Collector flow: submit a listing (multiple areas and waste types, with an explicit consent checkbox that writes `consent_at`), view its status, and edit it. `src/join.ts` and `save_my_listing()`; one listing per collector; the form's areas come from the database.
- [ ] Admin screen behind sign-in and the admin role:
  - [ ] review queue
  - [ ] approve, reject or suspend, with a required reason
  - [ ] reports list
  - [ ] audit history
- [x] Contact buttons (`tel:` and `wa.me/<E.164 number without +>`) appear only when the status is approved and `consent_at` is set, following D1 (both). The Find and profile screens read `public_collectors` (`src/api.ts`); saved copies lose contact details after 48 hours and expire after 7 days.
- [x] Offline report queue: Workbox `BackgroundSyncPlugin` on the reports insert, or a small IndexedDB outbox. Tell the user clearly that the report is queued. A localStorage outbox (`src/reports.ts`) sends on start-up and when the phone comes back online; reports can be linked to a real listing from its profile.
- [x] Generate TypeScript types from the schema (`supabase gen types`). In `src/types/db.ts`; regenerate after each migration.
- [x] Keep the "Demonstration listing" labels for any remaining sample data, and never mix samples with real listings. Real listings replace all samples as soon as one is approved.

## Exit criterion

The full flow (collector signs up, admin approves, resident finds and calls) works end to end on a phone, and Playwright plus the RLS tests pass.
