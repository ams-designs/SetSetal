-- Collector listings, their contact details, areas and waste types, and the
-- append-only audit log of every status change.
--
-- Product rules enforced here:
-- * The public sees approved listings only (rule 1).
-- * Phone and WhatsApp are visible only when the listing is approved and the
--   collector has consented (rule 2). They live in their own table so that RLS,
--   not the client, decides who can read them.
-- * Only an admin changes a status, through set_collector_status(), and every
--   change records who made it and why.

create type public.collector_status as enum ('submitted', 'approved', 'rejected', 'suspended');

create table public.collectors (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  vehicle_type text not null references public.vehicle_types (id),
  description text not null default '' check (char_length(description) <= 500),
  -- Null means no consent to be contacted. Set by the server, never backdated.
  consent_at timestamptz,
  status public.collector_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index collectors_status_idx on public.collectors (status);
create index collectors_owner_idx on public.collectors (owner);

create table public.collector_contacts (
  collector_id uuid primary key references public.collectors (id) on delete cascade,
  -- E.164, for example +2207000000
  phone text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  whatsapp text check (whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  updated_at timestamptz not null default now()
);

create table public.collector_areas (
  collector_id uuid not null references public.collectors (id) on delete cascade,
  area_id text not null references public.areas (id),
  primary key (collector_id, area_id)
);
create index collector_areas_area_idx on public.collector_areas (area_id);

create table public.collector_waste_types (
  collector_id uuid not null references public.collectors (id) on delete cascade,
  waste_type_id text not null references public.waste_types (id),
  primary key (collector_id, waste_type_id)
);
create index collector_waste_types_waste_idx on public.collector_waste_types (waste_type_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  -- Kept when a listing is deleted, so the history survives.
  collector_id uuid references public.collectors (id) on delete set null,
  actor uuid,
  from_status public.collector_status,
  to_status public.collector_status not null,
  reason text not null check (char_length(btrim(reason)) > 0),
  created_at timestamptz not null default now()
);
create index audit_log_collector_idx on public.audit_log (collector_id, created_at);

-- Triggers ----------------------------------------------------------------

-- The audit reason for a change the owner makes to a live listing.
create function public.owner_edit_reason()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'Changed by the owner, so it needs review again'::text;
$$;

-- Consent time comes from the server. Vehicle types must be active. An owner's
-- edit to an approved or rejected listing sends it back for review, so nothing
-- changes on a live listing without an admin seeing it.
create function public.collectors_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.vehicle_type is distinct from old.vehicle_type)
     and not exists (select 1 from public.vehicle_types v where v.id = new.vehicle_type and v.active) then
    raise exception 'vehicle type % is not in use', new.vehicle_type using errcode = '23503';
  end if;

  if tg_op = 'INSERT' then
    if new.consent_at is not null then
      new.consent_at := now();
    end if;
    return new;
  end if;

  new.updated_at := now();
  if new.consent_at is not null and old.consent_at is null then
    new.consent_at := now();
  elsif new.consent_at is not null then
    new.consent_at := old.consent_at;
  end if;

  if new.status = old.status
     and old.status in ('approved', 'rejected')
     and (new.name, new.vehicle_type, new.description)
         is distinct from (old.name, old.vehicle_type, old.description)
     and old.owner = (select auth.uid())
     and not public.is_admin() then
    new.status := 'submitted';
  end if;
  return new;
end $$;

create trigger collectors_before_write
  before insert or update on public.collectors
  for each row execute function public.collectors_before_write();

-- Writes the audit row for every new listing and every status change. The
-- owner's own edits get a fixed reason; any other change needs the reason that
-- set_collector_status() supplies, or it is refused. That includes inserting a
-- listing that is already approved, for example in an import.
create function public.collectors_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  given text := nullif(btrim(coalesce(current_setting('setsetal.status_reason', true), '')), '');
  why text;
begin
  if tg_op = 'INSERT' then
    if new.status = 'submitted' then
      why := 'Submitted';
    else
      why := given;
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'submitted' and old.status in ('approved', 'rejected')
       and actor = old.owner and not public.is_admin() then
      why := public.owner_edit_reason();
    else
      why := given;
    end if;
  else
    return null;
  end if;

  if why is null then
    raise exception 'a status change needs a reason; use set_collector_status()' using errcode = '22023';
  end if;
  insert into public.audit_log (collector_id, actor, from_status, to_status, reason)
  values (new.id, actor,
          case when tg_op = 'UPDATE' then old.status end,
          new.status, why);
  return null;
end $$;

create trigger collectors_audit
  after insert or update on public.collectors
  for each row execute function public.collectors_audit();

-- New or changed contact details, areas or waste types from the owner also
-- send an approved or rejected listing back for review: they decide who can
-- call and where the listing appears. Removing them doesn't.
create function public.collector_child_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Nested, because only contact rows have phone and whatsapp.
  if tg_table_name = 'collector_contacts' and tg_op = 'UPDATE' then
    if (new.phone, new.whatsapp) is not distinct from (old.phone, old.whatsapp) then
      return null;
    end if;
  end if;
  if public.is_admin() then
    return null;
  end if;
  -- Only the owner's own edits; imports by the service role are left alone.
  update public.collectors
     set status = 'submitted'
   where id = new.collector_id
     and owner = (select auth.uid())
     and status in ('approved', 'rejected');
  return null;
end $$;

create trigger collector_contacts_after_write
  after insert or update on public.collector_contacts
  for each row execute function public.collector_child_after_write();

create trigger collector_areas_after_insert
  after insert on public.collector_areas
  for each row execute function public.collector_child_after_write();

create trigger collector_waste_types_after_insert
  after insert on public.collector_waste_types
  for each row execute function public.collector_child_after_write();

-- Areas and waste types must be active when a listing adds them.
create function public.require_active_lookup()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Nested, because each table's row has only its own column.
  if tg_table_name = 'collector_areas' then
    if not exists (select 1 from public.areas a where a.id = new.area_id and a.active) then
      raise exception 'area % is not in use', new.area_id using errcode = '23503';
    end if;
  else
    if not exists (select 1 from public.waste_types w where w.id = new.waste_type_id and w.active) then
      raise exception 'waste type % is not in use', new.waste_type_id using errcode = '23503';
    end if;
  end if;
  return new;
end $$;

create trigger collector_areas_active
  before insert on public.collector_areas
  for each row execute function public.require_active_lookup();

create trigger collector_waste_types_active
  before insert on public.collector_waste_types
  for each row execute function public.require_active_lookup();

create function public.collector_contacts_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger collector_contacts_touch
  before update on public.collector_contacts
  for each row execute function public.collector_contacts_touch();

-- The only way to change a status: admins only, with a reason.
create function public.set_collector_status(
  p_collector uuid,
  p_status public.collector_status,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed boolean;
begin
  if not public.is_admin() then
    raise exception 'only an admin can change a listing''s status' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  perform set_config('setsetal.status_reason', btrim(p_reason), true);
  update public.collectors
     set status = p_status
   where id = p_collector and status is distinct from p_status;
  changed := found;
  perform set_config('setsetal.status_reason', '', true);
  if not changed then
    raise exception 'listing not found, or its status is already %', p_status using errcode = 'P0002';
  end if;
end $$;

-- Supabase grants execute on new functions to the API roles explicitly, so
-- revoking from public alone isn't enough. Trigger functions need no grant.
revoke execute on function public.set_collector_status(uuid, public.collector_status, text) from public, anon;
grant execute on function public.set_collector_status(uuid, public.collector_status, text) to authenticated;
revoke execute on function public.owner_edit_reason(), public.collectors_before_write(), public.collectors_audit(),
  public.collector_child_after_write(), public.require_active_lookup(), public.collector_contacts_touch()
  from public, anon, authenticated;

-- Privileges --------------------------------------------------------------

alter table public.collectors enable row level security;
alter table public.collector_contacts enable row level security;
alter table public.collector_areas enable row level security;
alter table public.collector_waste_types enable row level security;
alter table public.audit_log enable row level security;

revoke all on table public.collectors, public.collector_contacts, public.collector_areas,
  public.collector_waste_types, public.audit_log from anon, authenticated;

-- Residents never see who owns a listing.
grant select (id, name, vehicle_type, description, consent_at, status, created_at, updated_at)
  on table public.collectors to anon;
grant select on table public.collectors to authenticated;
-- No one sets owner, status or timestamps directly.
grant insert (name, vehicle_type, description, consent_at) on table public.collectors to authenticated;
grant update (name, vehicle_type, description, consent_at) on table public.collectors to authenticated;
grant delete on table public.collectors to authenticated;

grant select on table public.collector_contacts to anon, authenticated;
grant insert (collector_id, phone, whatsapp) on table public.collector_contacts to authenticated;
grant update (phone, whatsapp) on table public.collector_contacts to authenticated;
grant delete on table public.collector_contacts to authenticated;

grant select on table public.collector_areas, public.collector_waste_types to anon, authenticated;
grant insert, delete on table public.collector_areas, public.collector_waste_types to authenticated;

-- Append-only: only the audit trigger writes rows. The API roles, including the
-- service role, can only read. (The table owner, postgres, can still change
-- anything, which is why the SQL editor needs care.)
revoke all on table public.audit_log from service_role;
grant select on table public.audit_log to authenticated, service_role;

-- Policies ----------------------------------------------------------------

create policy collectors_anon_select on public.collectors
  for select to anon
  using (status = 'approved');

create policy collectors_auth_select on public.collectors
  for select to authenticated
  using (status = 'approved' or owner = (select auth.uid()) or (select public.is_admin()));

create policy collectors_insert_own on public.collectors
  for insert to authenticated
  with check (owner = (select auth.uid()));

create policy collectors_update_own on public.collectors
  for update to authenticated
  using (owner = (select auth.uid()) or (select public.is_admin()))
  with check (owner = (select auth.uid()) or (select public.is_admin()));

create policy collectors_delete_own on public.collectors
  for delete to authenticated
  using (owner = (select auth.uid()) or (select public.is_admin()));

create policy contacts_anon_select on public.collector_contacts
  for select to anon
  using (exists (
    select 1 from public.collectors c
     where c.id = collector_id and c.status = 'approved' and c.consent_at is not null));

create policy contacts_auth_select on public.collector_contacts
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.collectors c
       where c.id = collector_id
         and (c.owner = (select auth.uid()) or (c.status = 'approved' and c.consent_at is not null))));

create policy contacts_write_own on public.collector_contacts
  for all to authenticated
  using ((select public.is_admin())
         or exists (select 1 from public.collectors c where c.id = collector_id and c.owner = (select auth.uid())))
  with check ((select public.is_admin())
         or exists (select 1 from public.collectors c where c.id = collector_id and c.owner = (select auth.uid())));

-- Links follow the listing: visible when the listing is visible.
create policy collector_areas_select on public.collector_areas
  for select to anon, authenticated
  using (exists (select 1 from public.collectors c where c.id = collector_id));

create policy collector_areas_write_own on public.collector_areas
  for all to authenticated
  using ((select public.is_admin())
         or exists (select 1 from public.collectors c where c.id = collector_id and c.owner = (select auth.uid())))
  with check ((select public.is_admin())
         or exists (select 1 from public.collectors c where c.id = collector_id and c.owner = (select auth.uid())));

create policy collector_waste_types_select on public.collector_waste_types
  for select to anon, authenticated
  using (exists (select 1 from public.collectors c where c.id = collector_id));

create policy collector_waste_types_write_own on public.collector_waste_types
  for all to authenticated
  using ((select public.is_admin())
         or exists (select 1 from public.collectors c where c.id = collector_id and c.owner = (select auth.uid())))
  with check ((select public.is_admin())
         or exists (select 1 from public.collectors c where c.id = collector_id and c.owner = (select auth.uid())));

-- Owners read their own listing's history, so they can see why it was rejected.
create policy audit_log_select on public.audit_log
  for select to authenticated
  using ((select public.is_admin())
         or exists (select 1 from public.collectors c where c.id = collector_id and c.owner = (select auth.uid())));

-- Public listing view --------------------------------------------------------

-- What residents browse. Runs with the caller's rights, so the policies above
-- still decide what appears; the consent check is repeated as a second guard.
create view public.public_collectors
with (security_invoker = on) as
select
  c.id,
  c.name,
  c.vehicle_type,
  c.description,
  case when c.consent_at is not null then cc.phone end as phone,
  case when c.consent_at is not null then cc.whatsapp end as whatsapp,
  coalesce((select array_agg(a.area_id order by a.area_id)
              from public.collector_areas a where a.collector_id = c.id), '{}') as areas,
  coalesce((select array_agg(w.waste_type_id order by w.waste_type_id)
              from public.collector_waste_types w where w.collector_id = c.id), '{}') as waste_types,
  c.updated_at
from public.collectors c
left join public.collector_contacts cc on cc.collector_id = c.id
where c.status = 'approved';

revoke all on table public.public_collectors from anon, authenticated;
grant select on table public.public_collectors to anon, authenticated;
