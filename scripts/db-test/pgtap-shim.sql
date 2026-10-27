-- The subset of pgTAP that supabase/tests uses, so the same files run in PGlite
-- (npm run test:db) and under `supabase test db`. Keep to these functions in
-- the tests, or add the missing one here.
--
-- Counters live in transaction-local settings, because the tests switch roles
-- and a non-superuser cannot write to a table owned by postgres.

create schema tap;
grant usage on schema tap to public;

create function tap.bump(name text)
returns integer
language plpgsql
as $$
declare
  n integer := coalesce(nullif(current_setting('tap.' || name, true), ''), '0')::integer + 1;
begin
  perform set_config('tap.' || name, n::text, true);
  return n;
end $$;

create function public.plan(n integer)
returns text
language plpgsql
as $$
begin
  perform set_config('tap.planned', n::text, true);
  perform set_config('tap.run', '0', true);
  perform set_config('tap.failed', '0', true);
  return '1..' || n;
end $$;

create function public.ok(pass boolean, description text default '')
returns text
language plpgsql
as $$
declare
  n integer := tap.bump('run');
begin
  if coalesce(pass, false) then
    return 'ok ' || n || ' - ' || description;
  end if;
  perform tap.bump('failed');
  return 'not ok ' || n || ' - ' || description;
end $$;

create function public.is(have anyelement, want anyelement, description text default '')
returns text
language plpgsql
as $$
declare
  pass boolean := have is not distinct from want;
  result text := public.ok(pass, description);
begin
  if not pass then
    result := result || E'\n#   have: ' || coalesce(have::text, 'NULL')
                     || E'\n#   want: ' || coalesce(want::text, 'NULL');
  end if;
  return result;
end $$;

create function public.isnt(have anyelement, want anyelement, description text default '')
returns text
language plpgsql
as $$
declare
  pass boolean := have is distinct from want;
  result text := public.ok(pass, description);
begin
  if not pass then
    result := result || E'\n#   both: ' || coalesce(have::text, 'NULL');
  end if;
  return result;
end $$;

-- Pass a null errmsg to accept any message.
create function public.throws_ok(sql text, errcode text, errmsg text, description text)
returns text
language plpgsql
as $$
begin
  begin
    execute sql;
  exception when others then
    if (errcode is null or sqlstate = errcode) and (errmsg is null or sqlerrm = errmsg) then
      return public.ok(true, description);
    end if;
    return public.ok(false, description) || E'\n#   got:  ' || sqlstate || ' ' || sqlerrm
                                         || E'\n#   want: ' || coalesce(errcode, 'any') || ' ' || coalesce(errmsg, '');
  end;
  return public.ok(false, description) || E'\n#   no error was raised';
end $$;

create function public.lives_ok(sql text, description text)
returns text
language plpgsql
as $$
begin
  begin
    execute sql;
  exception when others then
    return public.ok(false, description) || E'\n#   died: ' || sqlstate || ' ' || sqlerrm;
  end;
  return public.ok(true, description);
end $$;

create function public.is_empty(sql text, description text)
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  execute 'select count(*) from (' || sql || ') q' into n;
  if n = 0 then
    return public.ok(true, description);
  end if;
  return public.ok(false, description) || E'\n#   rows: ' || n;
end $$;

create function public.finish()
returns setof text
language plpgsql
as $$
declare
  planned integer := coalesce(nullif(current_setting('tap.planned', true), ''), '0')::integer;
  ran integer := coalesce(nullif(current_setting('tap.run', true), ''), '0')::integer;
  failed integer := coalesce(nullif(current_setting('tap.failed', true), ''), '0')::integer;
begin
  if ran <> planned then
    return next '# Looks like you planned ' || planned || ' tests but ran ' || ran;
  end if;
  if failed > 0 then
    return next '# Looks like you failed ' || failed || ' test(s) of ' || ran;
  end if;
end $$;
