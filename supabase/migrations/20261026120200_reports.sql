-- Reports from residents: problems with a listing, safety, accessibility or
-- general feedback. Residents send them anonymously and cannot read them back.
--
-- Product rule 3: never add a column for a resident's address or identity.

create type public.report_status as enum ('open', 'resolved', 'dismissed');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  type text not null references public.report_types (id),
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  collector_id uuid references public.collectors (id) on delete set null,
  status public.report_status not null default 'open',
  resolution_note text check (char_length(resolution_note) <= 1000),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at);

create function public.reports_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'open' then
      new.resolved_by := null;
      new.resolved_at := null;
    else
      new.resolved_by := (select auth.uid());
      new.resolved_at := now();
    end if;
  end if;
  return new;
end $$;

create trigger reports_before_update
  before update on public.reports
  for each row execute function public.reports_before_update();

alter table public.reports enable row level security;
revoke all on table public.reports from anon, authenticated;

grant insert (type, message, collector_id) on table public.reports to anon, authenticated;
grant select on table public.reports to authenticated;
grant update (status, resolution_note) on table public.reports to authenticated;

-- A report may name a listing only if the sender can see that listing.
create policy reports_insert on public.reports
  for insert to anon, authenticated
  with check (
    status = 'open'
    and (collector_id is null
         or exists (select 1 from public.collectors c where c.id = collector_id)));

create policy reports_admin_select on public.reports
  for select to authenticated
  using ((select public.is_admin()));

create policy reports_admin_update on public.reports
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
