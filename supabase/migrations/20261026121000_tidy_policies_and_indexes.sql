-- Fixes from the Supabase advisors after the first deploy.
--
-- * is_admin() moves to a private schema. Policies keep working (they refer to
--   the function itself, not its name), but it is no longer an API endpoint.
-- * Indexes for the foreign keys that had none.
-- * The "for all" write policies overlapped the select policies. Split them by
--   action; who can do what is unchanged.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

alter function public.is_admin() set schema private;

-- Functions that call it by name need the new name.
create or replace function public.collectors_before_write()
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
     and not private.is_admin() then
    new.status := 'submitted';
  end if;
  return new;
end $$;

create or replace function public.collectors_audit()
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
       and actor = old.owner and not private.is_admin() then
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

create or replace function public.collector_child_after_write()
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
  if private.is_admin() then
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

create or replace function public.set_collector_status(
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
  if not private.is_admin() then
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

create index collectors_vehicle_type_idx on public.collectors (vehicle_type);
create index reports_collector_idx on public.reports (collector_id);
create index reports_type_idx on public.reports (type);

-- Contacts: separate insert, update and delete policies.
drop policy contacts_write_own on public.collector_contacts;

create policy contacts_insert_own on public.collector_contacts
  for insert to authenticated
  with check ((select private.is_admin())
         or exists (select 1 from public.collectors c where c.id = collector_id and c.owner = (select auth.uid())));

create policy contacts_update_own on public.collector_contacts
  for update to authenticated
  using ((select private.is_admin())
         or exists (select 1 from public.collectors c where c.id = collector_id and c.owner = (select auth.uid())))
  with check ((select private.is_admin())
         or exists (select 1 from public.collectors c where c.id = collector_id and c.owner = (select auth.uid())));

create policy contacts_delete_own on public.collector_contacts
  for delete to authenticated
  using ((select private.is_admin())
         or exists (select 1 from public.collectors c where c.id = collector_id and c.owner = (select auth.uid())));

-- Areas and waste types: links are only inserted or deleted.
drop policy collector_areas_write_own on public.collector_areas;
drop policy collector_waste_types_write_own on public.collector_waste_types;

create policy collector_areas_insert_own on public.collector_areas
  for insert to authenticated
  with check ((select private.is_admin())
         or exists (select 1 from public.collectors c where c.id = collector_id and c.owner = (select auth.uid())));

create policy collector_areas_delete_own on public.collector_areas
  for delete to authenticated
  using ((select private.is_admin())
         or exists (select 1 from public.collectors c where c.id = collector_id and c.owner = (select auth.uid())));

create policy collector_waste_types_insert_own on public.collector_waste_types
  for insert to authenticated
  with check ((select private.is_admin())
         or exists (select 1 from public.collectors c where c.id = collector_id and c.owner = (select auth.uid())));

create policy collector_waste_types_delete_own on public.collector_waste_types
  for delete to authenticated
  using ((select private.is_admin())
         or exists (select 1 from public.collectors c where c.id = collector_id and c.owner = (select auth.uid())));
