-- Lets a signed-in collector create or update their listing in one step:
-- details, contact numbers, areas, waste types and consent, all or nothing.
--
-- Security invoker: it runs with the collector's own rights, so the existing
-- column grants, RLS policies and triggers still decide everything (no status
-- or owner changes, re-review on edits, audit rows, active lookups only).
--
-- It only ever touches the caller's own listing, even for an admin: consent
-- belongs to the collector. A collector has one listing, so saving without an
-- id updates the existing one rather than creating a second (for example when
-- a slow connection makes the app retry).
--
-- Returns {"id": …, "status": …} so the app can say what happened: a change
-- that needs review comes back "submitted"; removing an area or withdrawing
-- consent leaves an approved listing live.

create function public.save_my_listing(
  p_id uuid,
  p_name text,
  p_vehicle_type text,
  p_description text,
  p_phone text,
  p_whatsapp text,
  p_areas text[],
  p_waste_types text[],
  p_consent boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  listing uuid := p_id;
  result_status public.collector_status;
begin
  if coalesce(array_length(p_areas, 1), 0) = 0 or array_position(p_areas, null) is not null then
    raise exception 'choose at least one area' using errcode = '22023';
  end if;
  if coalesce(array_length(p_waste_types, 1), 0) = 0 or array_position(p_waste_types, null) is not null then
    raise exception 'choose at least one waste type' using errcode = '22023';
  end if;

  if listing is null then
    select id into listing from public.collectors where owner = me order by created_at limit 1;
  end if;

  if listing is null then
    insert into public.collectors (name, vehicle_type, description, consent_at)
    values (btrim(p_name), p_vehicle_type, coalesce(btrim(p_description), ''),
            case when p_consent then now() end)
    returning id into listing;
  else
    update public.collectors
       set name = btrim(p_name),
           vehicle_type = p_vehicle_type,
           description = coalesce(btrim(p_description), ''),
           consent_at = case when p_consent then now() end
     where id = listing and owner = me;
    if not found then
      raise exception 'listing not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.collector_contacts (collector_id, phone, whatsapp)
  values (listing, nullif(btrim(p_phone), ''), nullif(btrim(p_whatsapp), ''))
  on conflict (collector_id) do update
    set phone = excluded.phone, whatsapp = excluded.whatsapp;

  delete from public.collector_areas
   where collector_id = listing and area_id <> all (p_areas);
  insert into public.collector_areas (collector_id, area_id)
  select listing, area from unnest(p_areas) as area
  on conflict do nothing;

  delete from public.collector_waste_types
   where collector_id = listing and waste_type_id <> all (p_waste_types);
  insert into public.collector_waste_types (collector_id, waste_type_id)
  select listing, waste from unnest(p_waste_types) as waste
  on conflict do nothing;

  select status into result_status from public.collectors where id = listing;
  return jsonb_build_object('id', listing, 'status', result_status);
end $$;

revoke execute on function public.save_my_listing(uuid, text, text, text, text, text, text[], text[], boolean)
  from public, anon;
grant execute on function public.save_my_listing(uuid, text, text, text, text, text, text[], text[], boolean)
  to authenticated;
