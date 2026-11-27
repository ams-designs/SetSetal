---
name: supabase-migration
description: Create a SetSetal Supabase migration with RLS policies, audit triggers and policy tests, then regenerate TypeScript types. Use for any schema, policy or function change in Phase 2+.
---

# Supabase migration

The source of truth is `docs/plan/data-model.md`. Update it in the same change if the model changes.

1. `supabase migration new <snake_case_name>`
2. Template for each new table:
```sql
create table public.<t> ( id uuid primary key default gen_random_uuid(), ..., created_at timestamptz not null default now() );
alter table public.<t> enable row level security;
-- explicit policies per role; no "using (true)" for write paths
create policy "<t>_anon_select" on public.<t> for select to anon using ( ... );
```
3. Status changes to collectors go through a trigger that inserts into `audit_log (collector_id, actor, from_status, to_status, reason)`. Revoke `update` and `delete` on `audit_log` from every role.
4. Block collectors from changing `status`:
```sql
create or replace function public.guard_collector_status() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status and not public.is_admin() then
    raise exception 'status can only be changed by an admin';
  end if;
  return new;
end $$;
```
5. Public listing view: `public_collectors` exposes `phone` and `whatsapp` only `when consent_at is not null`, and filters `status in ('reviewed','verified')`. Use `security_invoker = on`.
6. Tests go in `supabase/tests/<name>.sql`. For each role (anon, collector owner, another collector, admin), check one allowed and one denied case. Run them with `supabase test db`.
7. Apply locally with `supabase db reset`, then run `supabase gen types typescript --local > src/types/db.ts`.
8. Run the `trust-safety-reviewer` agent on the diff before merging. Apply to the remote project only after review (`supabase db push`).
