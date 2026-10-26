# Phase 2: Backend and trusted listings (~3–4 weeks)

**Goal:** a collector can sign up on their phone, an admin can approve them, and a resident can then find and call them.
**Decisions:** D1–D3 answered on 26 Oct 2026 in [decisions.md](decisions.md): calls and WhatsApp, an admin approves, and the pilot is Brikama in English. What "verified" means is still open, so build approval without a "verified" badge.
**Agents:** `supabase-backend` (schema, RLS, auth), `trust-safety-reviewer` (must review every PR in this phase), `e2e-tester`.

## Tasks

- [ ] Create the Supabase project and set up the CLI locally (`supabase init`, `supabase start`).
- [ ] Write migrations for the schema in [data-model.md](data-model.md), using `/supabase-migration`.
- [ ] RLS: the public sees only approved listings, collectors edit only their own (and can't change `status`), and admins see everything. Write SQL tests for each policy.
- [ ] Seed `areas`, `waste_types` and `vehicle_types` from the D3 answer (Brikama and its neighbourhoods). The front end reads these tables, so delete the hard-coded lists.
- [ ] Phone OTP sign-in for collectors (Supabase Auth with an SMS provider). Residents get no sign-in.
- [ ] Collector flow: submit a listing (multiple areas and waste types, with an explicit consent checkbox that writes `consent_at`), view its status, and edit it.
- [ ] Admin screen behind sign-in and the admin role:
  - [ ] review queue
  - [ ] approve, reject or suspend, with a required reason
  - [ ] reports list
  - [ ] audit history
- [ ] Contact buttons (`tel:` and `wa.me/<E.164 number without +>`) appear only when the status is approved and `consent_at` is set, following D1 (both).
- [ ] Offline report queue: Workbox `BackgroundSyncPlugin` on the reports insert, or a small IndexedDB outbox. Tell the user clearly that the report is queued.
- [ ] Generate TypeScript types from the schema (`supabase gen types`).
- [ ] Keep the "Demonstration listing" labels for any remaining sample data, and never mix samples with real listings.

## Exit criterion

The full flow (collector signs up, admin approves, resident finds and calls) works end to end on a phone, and Playwright plus the RLS tests pass.
