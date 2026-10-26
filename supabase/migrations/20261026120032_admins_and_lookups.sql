-- Admins, and the lookup lists that the filter and the registration form read.
-- Labels for vehicle, waste and report types live in the translation files;
-- area names are place names.
--
-- Every table revokes the platform's default grants and grants back only what
-- each role needs, so access never depends on project defaults.

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;
grant select on table public.admins to authenticated;

-- Admins are added from the dashboard or the SQL editor, never from the app.
create policy admins_select_own on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Security definer so that policies on other tables can call it without the
-- admins table's own policy getting in the way.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke execute on function public.is_admin() from public;
-- Supabase also grants it to the API roles directly; anon needs it for policies.
grant execute on function public.is_admin() to anon, authenticated;

create table public.areas (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  district text not null,
  active boolean not null default true,
  sort_order integer not null default 0
);

create table public.vehicle_types (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  active boolean not null default true,
  sort_order integer not null default 0
);

create table public.waste_types (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  active boolean not null default true,
  sort_order integer not null default 0
);

create table public.report_types (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  active boolean not null default true,
  sort_order integer not null default 0
);

-- Everyone reads active rows; only admins add or change rows. Rows are never
-- deleted, because listings refer to them: set active = false instead.
do $$
declare
  t text;
begin
  foreach t in array array['areas', 'vehicle_types', 'waste_types', 'report_types'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to anon, authenticated', t);
    execute format('grant insert, update on table public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (active or (select public.is_admin()))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.is_admin()))',
      t || '_admin_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
      t || '_admin_update', t);
  end loop;
end $$;
