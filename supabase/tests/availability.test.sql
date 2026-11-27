-- "Collecting today" is set by the owner, shown to residents, and expires by itself.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-00000000000d');
select set_config('setsetal.status_reason', 'Imported for the test', true);
insert into public.collectors (id, owner, name, vehicle_type, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Cart', 'donkey-cart', 'approved'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'Van', 'small-van', 'approved');
select set_config('setsetal.status_reason', '', true);

-- Anonymous visitor ------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);

select is((select available_today from public.public_collectors where id = '10000000-0000-0000-0000-000000000001'), false,
  'a listing is not shown as collecting today until its owner says so');
select throws_ok($$select public.set_my_availability(true)$$, '42501', null, 'anon cannot set availability');
select throws_ok($$update public.collectors set available_on = current_date$$, '42501', null,
  'anon cannot write the column either');

-- Collector B ------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);

select is((select public.set_my_availability(true)), true, 'a collector says they are collecting today');
select is((select available_today from public.public_collectors where id = '10000000-0000-0000-0000-000000000001'), true,
  'residents see it');
select is((select available_today from public.public_collectors where id = '10000000-0000-0000-0000-000000000002'), false,
  'another collector''s listing is untouched');
select is((select status::text from public.collectors where id = '10000000-0000-0000-0000-000000000001'), 'approved',
  'it does not send the listing back for review');
select is((select public.set_my_availability(false)), false, 'the collector switches it off');
select is((select available_today from public.public_collectors where id = '10000000-0000-0000-0000-000000000001'), false,
  'and residents no longer see it');

-- Yesterday ----------------------------------------------------------------------
reset role;
update public.collectors set available_on = (now() at time zone 'utc')::date - 1
 where id = '10000000-0000-0000-0000-000000000001';
select is((select available_today from public.public_collectors where id = '10000000-0000-0000-0000-000000000001'), false,
  'yesterday''s availability has expired');

-- A collector without a listing --------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d"}', true);
select throws_ok($$select public.set_my_availability(true)$$, 'P0002', null, 'someone without a listing is told so');

select * from finish();
rollback;
