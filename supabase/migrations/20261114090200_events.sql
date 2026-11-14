-- Anonymous usage counts for the pilot (Phase 3): which searches find nothing,
-- how often residents tap Call or WhatsApp, and how many reports are sent.
--
-- Product rule 3: nothing here identifies a resident. There is no user id, no
-- device id, no IP address, no free text, and only the day (not the time) is
-- kept. A row names a listing, never the person who tapped it.
--
-- The app keeps these in its own database rather than a third-party analytics
-- service: no cookies, no extra script to download, and nothing leaves the
-- project.

create table public.events (
  id bigint generated always as identity primary key,
  name text not null check (name in ('search_no_results', 'contact_tap', 'report_submitted', 'listing_marked_wrong')),
  -- Filter values and lookup ids only, so nobody can post free text.
  area text check (area ~ '^[a-z0-9-]{1,40}$'),
  vehicle text check (vehicle ~ '^[a-z0-9-]{1,40}$'),
  waste text check (waste ~ '^[a-z0-9-]{1,40}$'),
  channel text check (channel in ('call', 'whatsapp')),
  report_type text check (report_type ~ '^[a-z0-9-]{1,40}$'),
  collector_id uuid references public.collectors (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date
);
create index events_day_idx on public.events (day, name);
create index events_collector_idx on public.events (collector_id);

alter table public.events enable row level security;
revoke all on table public.events from anon, authenticated;

-- Residents add rows and can never read them. The day always comes from the
-- server, because the column isn't granted.
grant insert (name, area, vehicle, waste, channel, report_type, collector_id) on table public.events to anon, authenticated;
grant select on table public.events to authenticated;

-- Each kind of event carries only the fields it needs, and may name only a
-- listing the sender can see.
create policy events_insert on public.events
  for insert to anon, authenticated
  with check (
    case name
      when 'search_no_results' then channel is null and report_type is null and collector_id is null
      when 'contact_tap' then channel is not null and collector_id is not null
                              and area is null and vehicle is null and waste is null and report_type is null
      when 'report_submitted' then report_type is not null and channel is null and collector_id is null
                                   and area is null and vehicle is null and waste is null
      when 'listing_marked_wrong' then collector_id is not null and channel is null and report_type is null
                                       and area is null and vehicle is null and waste is null
      else false
    end
    and (collector_id is null
         or exists (select 1 from public.collectors c where c.id = collector_id)));

create policy events_admin_select on public.events
  for select to authenticated
  using ((select private.is_admin()));

-- The admin screen's summary. Runs with the caller's rights and says no to
-- anyone who isn't an admin.
create function public.admin_activity(p_days integer default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  since date := (now() at time zone 'utc')::date - greatest(1, least(coalesce(p_days, 30), 366)) + 1;
begin
  if not private.is_admin() then
    raise exception 'only an admin can read activity' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'days', greatest(1, least(coalesce(p_days, 30), 366)),
    'totals', coalesce((
      select jsonb_object_agg(name, n)
        from (select name, count(*) as n from public.events where day >= since group by name) t), '{}'::jsonb),
    'no_results', coalesce((
      select jsonb_agg(jsonb_build_object('area', area, 'vehicle', vehicle, 'waste', waste, 'count', n) order by n desc, area)
        from (select area, vehicle, waste, count(*) as n
                from public.events
               where day >= since and name = 'search_no_results'
               group by area, vehicle, waste
               order by n desc, area
               limit 10) t), '[]'::jsonb),
    'contacts', coalesce((
      select jsonb_agg(jsonb_build_object('name', listing, 'call', calls, 'whatsapp', whatsapps) order by calls + whatsapps desc, listing)
        from (select c.name as listing,
                     count(*) filter (where e.channel = 'call') as calls,
                     count(*) filter (where e.channel = 'whatsapp') as whatsapps
                from public.events e
                join public.collectors c on c.id = e.collector_id
               where e.day >= since and e.name = 'contact_tap'
               group by c.id, c.name
               order by count(*) desc, c.name
               limit 20) t), '[]'::jsonb));
end $$;

revoke execute on function public.admin_activity(integer) from public, anon;
grant execute on function public.admin_activity(integer) to authenticated;
