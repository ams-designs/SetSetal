-- Residents send reports anonymously and cannot read them back; only admins
-- change lookup lists.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a');
-- Fixtures that start approved need a reason, as an import would.
select set_config('setsetal.status_reason', 'Test fixture', true);
insert into public.collectors (id, owner, name, vehicle_type, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Approved', 'tricycle', 'approved'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'Submitted', 'tricycle', 'submitted');
select set_config('setsetal.status_reason', '', true);
insert into public.areas (id, name, district, active) values ('old-area', 'Old area', 'Test', false);

-- Anonymous resident ---------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);

select lives_ok($$insert into public.reports (type, message, collector_id) values ('incorrect-listing', 'Wrong number', '10000000-0000-0000-0000-000000000001')$$,
  'anon can report an approved listing');
select throws_ok($$select * from public.reports$$, '42501', null, 'anon cannot read reports back');
select throws_ok($$insert into public.reports (type, message, status) values ('general', 'Hi', 'resolved')$$,
  '42501', null, 'anon cannot set a report''s status');
select throws_ok($$insert into public.reports (type, message, collector_id) values ('general', 'Hi', '10000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'anon cannot report a listing they cannot see');
select throws_ok($$insert into public.reports (type, message) values ('made-up', 'Hi')$$,
  '23503', null, 'a report needs a known type');
select is((select count(*)::int from public.areas where id = 'brikama'), 1, 'the Brikama pilot area is seeded');
select is_empty($$select 1 from public.areas where id = 'old-area'$$, 'inactive areas are hidden');
select is((select count(*)::int from public.vehicle_types), 6, 'all six vehicle types are seeded');
select throws_ok($$insert into public.areas (id, name, district) values ('x', 'X', 'X')$$,
  '42501', null, 'anon cannot add an area');
select throws_ok($$update public.reports set status = 'dismissed'$$, '42501', null, 'anon cannot change reports');
select throws_ok($$delete from public.reports$$, '42501', null, 'anon cannot delete reports');

-- Collector ------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);

select is_empty($$select 1 from public.reports$$, 'a collector cannot read reports');
select throws_ok($$insert into public.areas (id, name, district) values ('x', 'X', 'X')$$,
  '42501', null, 'a collector cannot add an area');
select lives_ok($$update public.reports set status = 'dismissed'$$, 'a collector''s update of reports runs but matches nothing');
select lives_ok($$update public.areas set name = 'Hacked' where id = 'brikama'$$, 'a collector''s update of an area runs but matches nothing');

-- Admin ----------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

select is((select array[count(*)::text, min(status::text)] from public.reports), array['1', 'open'],
  'admin reads reports, and the collector''s update changed nothing');
select lives_ok($$update public.reports set status = 'resolved', resolution_note = 'Number corrected'$$,
  'admin resolves a report');
select is((select resolved_by::text from public.reports), '00000000-0000-0000-0000-00000000000a',
  'the resolution records which admin resolved it');
select lives_ok($$insert into public.areas (id, name, district) values ('nyambai', 'Nyambai', 'West Coast Region')$$,
  'admin adds an area');
select is((select name from public.areas where id = 'brikama'), 'Brikama', 'the collector''s area update changed nothing');
select is_empty($$select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'reports'
                    and column_name ~ '(address|street|house|resident|email|phone)'$$,
  'reports have no column for a resident''s address or identity');

select * from finish();
rollback;
