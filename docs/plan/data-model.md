# Data model (Supabase, Phase 2)

The migrations in `supabase/migrations/` are the source of truth; this page explains them. Update both in the same change. The hosted project is `gplmfpglapxicfghlkid`; its migration history matches the file names.

## Tables

| Table | Holds |
|---|---|
| `collectors` | `id`, `owner` (auth user), `name`, `vehicle_type`, `description`, `consent_at` (timestamp set by the server; null means no consent), `status` (`submitted`, `approved`, `rejected` or `suspended`), `created_at`, `updated_at` |
| `collector_contacts` | `collector_id`, `phone`, `whatsapp` (E.164). Kept apart from `collectors` so RLS decides who can read them |
| `areas` | The agreed list of neighbourhoods and districts (`id`, `name`, `district`, `active`, `sort_order`). The single source for the filter and the registration form. The pilot seeds `brikama` (D3) |
| `collector_areas` | Many-to-many link (`collector_id`, `area_id`), because one cart may serve several neighbourhoods |
| `waste_types`, `vehicle_types`, `report_types` | Ids only (`id`, `active`, `sort_order`); labels come from the translation files |
| `collector_waste_types` | Many-to-many link (`collector_id`, `waste_type_id`) |
| `reports` | `type`, `message`, an optional `collector_id`, `status` (`open`, `resolved`, `dismissed`), `resolution_note`, `resolved_by`, `resolved_at`, `created_at`. **Never stores a resident address or identity** |
| `audit_log` | `collector_id`, `actor`, `from_status`, `to_status`, `reason`, `created_at`. Every new listing and every status change writes one |
| `admins` | The user IDs that hold the admin role. Added from the dashboard or SQL editor only. Policies check it through `private.is_admin()`, which isn't exposed through the API |

There is no `verified` status yet. D2 says an admin approves listings but doesn't define what "verified" means, so listings show as approved only. Add the status in a new migration once the check is defined and recorded.

## Row-level security

Each table revokes the default grants and grants back only what each role needs.

- **Public (anon):** reads approved listings, through the `public_collectors` view (`security_invoker = on`). Can't read `owner`. Reads `collector_contacts` only when the listing is approved *and* `consent_at` is set. Reads active lookup rows. Can `insert` into `reports` (only `type`, `message`, `collector_id`, and only naming a listing it can see), with no reading back.
- **Collector (authenticated):** reads approved listings plus their own. Creates, edits and deletes only their own listing, contacts, areas and waste types. Can't set `owner`, `status` or the timestamps (column privileges). Editing the name, vehicle, description or contact details of an approved or rejected listing, or adding an area or waste type, sends it back to `submitted`, with an audit row. Only active lookup values can be used. Reads their own listing's audit history, so they can see why it was rejected.
- **Saving a listing:** collectors save through `save_my_listing(...)` (security invoker), which writes the listing, contacts, areas, waste types and consent in one transaction and returns the resulting status. It only touches the caller's own listing, even for admins, and saving without an id updates their existing listing rather than creating a second.
- **Admin:** reads everything and resolves reports. Changes a status only through `set_collector_status(collector, status, reason)`, which requires a reason and writes the audit row. Nobody, not even an admin, sets `status` directly.
- `audit_log` is append-only. The API roles, including `service_role`, can only read it; only the audit trigger writes to it. The table owner (`postgres`, which the SQL editor uses) can still change anything, so don't edit it there.
- Inserting a listing that is already approved (an import, for example) also needs a reason, so every approval is explained in the log.

## Notes for the front end

- Report inserts must not ask for the row back (`Prefer: return=minimal`, the supabase-js default without `.select()`), because residents can't read reports. The form should say the report was sent, ask people not to include addresses or phone numbers, and explain what happens next.
- `public_collectors` has no order. Sort by area match and suitability on the client, never by anything paid (rule 5).
- Never seed sample listings into this database: they would look exactly like real ones (rule 1).

## Tests

`supabase/tests/*.test.sql` are pgTAP files. For each role (anon, owner, another collector, admin) they check allowed and refused cases. `npm run test:db` runs them in PGlite with a small pgTAP subset (`scripts/db-test/`), locally and in CI. `supabase test db` runs the same files on a real local stack.

## Indexes

`collectors(status)`, `collectors(owner)`, `collector_areas(area_id)`, `collector_waste_types(waste_type_id)`, `audit_log(collector_id, created_at)` and `reports(status, created_at)`.
