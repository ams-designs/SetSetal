-- Data retention and erasure (Phase 3). The periods match
-- docs/legal/data-retention.md; change both together.
--
-- * A collector can delete their account. Their sign-in, listing, contact
--   numbers, areas and waste types go with it.
-- * Old rows are removed every night:
--     - reports, 12 months after they were closed (24 months if never closed)
--     - usage counts, after 12 months
--     - history rows of listings that no longer exist, after 12 months

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  -- Listings, contacts, areas, waste types and any admin row cascade.
  delete from auth.users where id = me;
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Returns how many rows of each kind were removed.
create function private.apply_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reports_removed integer;
  events_removed integer;
  history_removed integer;
begin
  delete from public.reports
   where (status <> 'open' and resolved_at < now() - interval '12 months')
      or created_at < now() - interval '24 months';
  get diagnostics reports_removed = row_count;

  delete from public.events
   where day < (now() at time zone 'utc')::date - 365;
  get diagnostics events_removed = row_count;

  delete from public.audit_log
   where collector_id is null and created_at < now() - interval '12 months';
  get diagnostics history_removed = row_count;

  return jsonb_build_object('reports', reports_removed, 'events', events_removed, 'history', history_removed);
end $$;

revoke execute on function private.apply_retention() from public, anon, authenticated;

-- Hosted Supabase has pg_cron; the test database doesn't, so it is skipped
-- there. 03:15 UTC is the middle of the night in The Gambia. If scheduling
-- isn't possible the migration still succeeds and says so: schedule it by
-- hand from the dashboard (Integrations, Cron) with the same command.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule('setsetal-retention', '15 3 * * *', 'select private.apply_retention()');
    exception when others then
      raise warning 'could not schedule the nightly clean-up (%): schedule "select private.apply_retention()" by hand', sqlerrm;
    end;
  else
    raise notice 'pg_cron is not available: the nightly clean-up is not scheduled';
  end if;
end $$;
