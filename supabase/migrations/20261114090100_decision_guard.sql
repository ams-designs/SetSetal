-- An admin's decision applies only to the version of the listing they saw.
--
-- Before this, the admin screen fetched the listing again and compared it just
-- before deciding, which left a gap: a collector could change a phone number
-- between that check and the decision. Now the server checks.
--
-- * updated_at changes whenever anything an admin reviews changes: the
--   listing itself, its contact numbers, its areas or its waste types. It
--   uses the clock, not the transaction time, so two changes never share one.
-- * "Collecting today" is not reviewed, so it leaves updated_at alone.
-- * set_collector_status() takes the status and updated_at the admin saw and
--   refuses (HTTP 409) when either has changed.

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

  -- A changed updated_at is how the contact, area and waste triggers say that
  -- something reviewed has changed.
  if (new.name, new.vehicle_type, new.description, new.consent_at, new.status, new.updated_at)
     is distinct from (old.name, old.vehicle_type, old.description, old.consent_at, old.status, old.updated_at) then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end $$;

create function public.collector_child_touch()
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
  update public.collectors
     set updated_at = clock_timestamp()
   where id = case when tg_op = 'DELETE' then old.collector_id else new.collector_id end;
  return null;
end $$;
revoke execute on function public.collector_child_touch() from public, anon, authenticated;

create trigger collector_contacts_touch_listing
  after insert or update or delete on public.collector_contacts
  for each row execute function public.collector_child_touch();

create trigger collector_areas_touch_listing
  after insert or delete on public.collector_areas
  for each row execute function public.collector_child_touch();

create trigger collector_waste_types_touch_listing
  after insert or delete on public.collector_waste_types
  for each row execute function public.collector_child_touch();

drop function public.set_collector_status(uuid, public.collector_status, text);

create function public.set_collector_status(
  p_collector uuid,
  p_status public.collector_status,
  p_reason text,
  p_expected_status public.collector_status,
  p_expected_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.collector_status;
  current_updated_at timestamptz;
begin
  if not private.is_admin() then
    raise exception 'only an admin can change a listing''s status' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  if p_expected_status is null or p_expected_updated_at is null then
    raise exception 'say which version of the listing was reviewed' using errcode = '22023';
  end if;

  -- Locked, so an edit can't slip in between this check and the change.
  select status, updated_at into current_status, current_updated_at
    from public.collectors where id = p_collector for update;
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;
  if current_status is distinct from p_expected_status
     or current_updated_at is distinct from p_expected_updated_at then
    -- PostgREST turns PT409 into HTTP 409 Conflict.
    raise exception 'the listing has changed since it was reviewed' using errcode = 'PT409';
  end if;
  if current_status = p_status then
    raise exception 'the listing''s status is already %', p_status using errcode = 'P0002';
  end if;

  perform set_config('setsetal.status_reason', btrim(p_reason), true);
  update public.collectors set status = p_status where id = p_collector;
  perform set_config('setsetal.status_reason', '', true);
end $$;

revoke execute on function public.set_collector_status(uuid, public.collector_status, text, public.collector_status, timestamptz)
  from public, anon;
grant execute on function public.set_collector_status(uuid, public.collector_status, text, public.collector_status, timestamptz)
  to authenticated;
