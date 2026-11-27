-- "Collecting today": a collector says they are working today, and residents
-- see it on the listing (Phase 5).
--
-- It is a date, not a flag, so it switches itself off at midnight and a
-- collector who forgets never looks available for days. The Gambia is on UTC
-- all year, so the UTC date is the local date.
--
-- It is not something an admin reviews, so setting it never sends a listing
-- back for review. It only shows on approved listings, through the view.

alter table public.collectors add column available_on date;

-- Residents read it through public_collectors, which runs with their rights.
grant select (available_on) on table public.collectors to anon;
grant update (available_on) on table public.collectors to authenticated;

create function public.set_my_availability(p_available boolean)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.collectors
     set available_on = case when p_available then (now() at time zone 'utc')::date end
   where owner = (select auth.uid());
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;
  return coalesce(p_available, false);
end $$;

revoke execute on function public.set_my_availability(boolean) from public, anon;
grant execute on function public.set_my_availability(boolean) to authenticated;

-- A new column can only be added at the end of an existing view.
create or replace view public.public_collectors
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
  c.updated_at,
  coalesce(c.available_on = (now() at time zone 'utc')::date, false) as available_today
from public.collectors c
left join public.collector_contacts cc on cc.collector_id = c.id
where c.status = 'approved';
