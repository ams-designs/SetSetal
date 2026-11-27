-- Keep reports for 12 months after they were closed, however old they are
-- (docs/legal/data-retention.md). The 24-month limit applied to every report,
-- so a report opened over 24 months ago and closed last week was removed that
-- night. It now applies only to reports that were never closed.
--
-- create or replace keeps the function's owner and grants.

create or replace function private.apply_retention()
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
      or (status = 'open' and created_at < now() - interval '24 months');
  get diagnostics reports_removed = row_count;

  delete from public.events
   where day < (now() at time zone 'utc')::date - 365;
  get diagnostics events_removed = row_count;

  delete from public.audit_log
   where collector_id is null and created_at < now() - interval '12 months';
  get diagnostics history_removed = row_count;

  return jsonb_build_object('reports', reports_removed, 'events', events_removed, 'history', history_removed);
end $$;
