-- The parts of a Supabase database that the migrations rely on, for running
-- them in PGlite. A real Supabase project already has all of this.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

-- Same lookup order as Supabase: the legacy claim first, then the JWT claims.
create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ), ''
  )::uuid;
$$;

-- Supabase grants the API roles everything in public by default and relies on
-- RLS. Mirror that so the tests catch any table that forgets to revoke.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
