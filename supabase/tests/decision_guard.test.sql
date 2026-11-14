-- An admin's decision applies only to the version of the listing they saw.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.areas (id, name, district) values ('nyambai', 'Nyambai', 'West Coast Region');
insert into public.collectors (id, owner, name, vehicle_type, consent_at) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Cart', 'donkey-cart', now());
insert into public.collector_contacts (collector_id, phone) values ('10000000-0000-0000-0000-000000000001', '+2207000001');
insert into public.collector_areas (collector_id, area_id) values ('10000000-0000-0000-0000-000000000001', 'brikama');
insert into public.collector_waste_types (collector_id, waste_type_id) values ('10000000-0000-0000-0000-000000000001', 'household');

-- What the admin saw when they opened the review queue.
select set_config('test.seen', (select updated_at::text from public.collectors where id = '10000000-0000-0000-0000-000000000001'), true);
create function pg_temp.seen() returns timestamptz language sql as $$ select current_setting('test.seen')::timestamptz $$;
create function pg_temp.remember() returns void language sql as
  $$ select set_config('test.seen', (select updated_at::text from public.collectors where id = '10000000-0000-0000-0000-000000000001'), true) $$;
create function pg_temp.changed() returns boolean language sql as
  $$ select updated_at > pg_temp.seen() from public.collectors where id = '10000000-0000-0000-0000-000000000001' $$;

-- Owner edits ----------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);

update public.collector_contacts set phone = '+2207000002' where collector_id = '10000000-0000-0000-0000-000000000001';
select ok(pg_temp.changed(), 'a new phone number changes the listing''s updated_at');
select pg_temp.remember();

update public.collector_contacts set phone = '+2207000002' where collector_id = '10000000-0000-0000-0000-000000000001';
select ok(not pg_temp.changed(), 'saving the same phone number again does not');

insert into public.collector_areas (collector_id, area_id) values ('10000000-0000-0000-0000-000000000001', 'nyambai');
select ok(pg_temp.changed(), 'adding an area changes updated_at');
select pg_temp.remember();

delete from public.collector_areas where collector_id = '10000000-0000-0000-0000-000000000001' and area_id = 'nyambai';
select ok(pg_temp.changed(), 'removing an area changes updated_at');
select pg_temp.remember();

insert into public.collector_waste_types (collector_id, waste_type_id) values ('10000000-0000-0000-0000-000000000001', 'garden');
select ok(pg_temp.changed(), 'adding a waste type changes updated_at');
select pg_temp.remember();

select lives_ok($$select public.set_my_availability(true)$$, 'the owner says they are collecting today');
select ok(not pg_temp.changed(), 'which is not reviewed, so updated_at stays the same');
select is((select status::text from public.collectors where id = '10000000-0000-0000-0000-000000000001'), 'submitted',
  'and the status is untouched');

-- Admin ----------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

select throws_ok($$select public.set_collector_status('10000000-0000-0000-0000-000000000001', 'approved', 'Met in person', null, null)$$,
  '22023', null, 'a decision must say which version was reviewed');
select throws_ok($$select public.set_collector_status('10000000-0000-0000-0000-000000000001', 'approved', 'Met in person', 'submitted', pg_temp.seen() - interval '1 second')$$,
  'PT409', null, 'a decision on an older version is refused');
select throws_ok($$select public.set_collector_status('10000000-0000-0000-0000-000000000001', 'rejected', 'Wrong number', 'approved', pg_temp.seen())$$,
  'PT409', null, 'a decision that expects a different status is refused');
select is((select status::text from public.collectors where id = '10000000-0000-0000-0000-000000000001'), 'submitted',
  'refused decisions change nothing');
select throws_ok($$select public.set_collector_status('10000000-0000-0000-0000-0000000000ff', 'approved', 'Met in person', 'submitted', now())$$,
  'P0002', null, 'a listing that does not exist is reported as missing');
select lives_ok($$select public.set_collector_status('10000000-0000-0000-0000-000000000001', 'approved', 'Met in person', 'submitted', pg_temp.seen())$$,
  'a decision on the version the admin saw goes through');
select ok(pg_temp.changed(), 'the decision itself changes updated_at');
select throws_ok($$select public.set_collector_status('10000000-0000-0000-0000-000000000001', 'suspended', 'Reports', 'approved', pg_temp.seen())$$,
  'PT409', null, 'so a second admin working from the old version is refused');
select pg_temp.remember();
select lives_ok($$select public.set_collector_status('10000000-0000-0000-0000-000000000001', 'suspended', 'Reports', 'approved', pg_temp.seen())$$,
  'and goes through once they have seen the latest version');

select * from finish();
rollback;
