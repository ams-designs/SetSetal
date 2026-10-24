# Data model (Supabase, Phase 2)

## Tables

| Table | Holds |
|---|---|
| `collectors` | `id`, `owner` (auth user), `name`, `vehicle_type`, `description`, `phone`, `whatsapp`, `consent_at` (timestamp, null means no consent), `status` (`submitted`, `reviewed`, `verified` or `suspended`), `created_at`, `updated_at` |
| `areas` | The agreed list of neighbourhoods and districts (`id`, `name`, `district`, `active`). The single source for the filter and the registration form |
| `collector_areas` | Many-to-many link (`collector_id`, `area_id`), because one cart may serve several neighbourhoods |
| `waste_types` | Household bags, garden waste, bulky items, recyclables, business waste, and anything added later |
| `collector_waste_types` | Many-to-many link (`collector_id`, `waste_type_id`) |
| `vehicle_types` | Municipal truck, private truck, small car or van, tricycle, donkey cart, horse cart |
| `reports` | `type`, `message`, an optional `collector_id`, `created_at`, `resolution_status`. **Never stores a resident address** |
| `audit_log` | `collector_id`, `actor`, `from_status`, `to_status`, `reason`, `created_at`. This is what makes "verified" trustworthy |
| `admins` | The user IDs that hold the admin role, or use a custom JWT claim instead |

## Row-level security

- **Public (anon):** can `select` collectors only where the status is `reviewed` or `verified`, and only through a view that leaves out phone and WhatsApp unless `consent_at is not null`. Can `select` the lookup tables. Can `insert` into `reports` only, with no reading back.
- **Collector (authenticated):** can `select`, `insert` and `update` only rows where `owner = auth.uid()`. **Cannot change `status`**. Enforce this with a column privilege or a trigger.
- **Admin:** full access. Every status change writes an `audit_log` row in the same transaction, using a trigger or an RPC.
- `audit_log` is append-only. No role gets `update` or `delete` on it.

## Indexes

Add indexes on `collectors(status)`, `collector_areas(area_id)` and `collector_waste_types(waste_type_id)`.
