-- A collector saves their own listing in one step, within the existing rules.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.areas (id, name, district) values ('nyambai', 'Nyambai', 'West Coast Region');
insert into public.areas (id, name, district, active) values ('old-area', 'Old area', 'Test', false);

-- Anonymous visitor ------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);

select throws_ok($$select public.save_my_listing(null, 'Sneaky', 'tricycle', '', null, null, array['brikama'], array['household'], true)$$,
  '42501', null, 'anon cannot save a listing');

-- Collector B ------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);

select lives_ok($$select public.save_my_listing(null, '  Fatou''s carts  ', 'donkey-cart', 'Weekly pickups',
                   '+2207000001', '+2207000001', array['brikama', 'nyambai'], array['household', 'garden'], true)$$,
  'a collector creates their listing in one step');
select is((select array[name, status::text] from public.collectors where owner = '00000000-0000-0000-0000-00000000000b'),
  array['Fatou''s carts', 'submitted'], 'it is saved, trimmed and waiting for review');
select ok((select consent_at is not null from public.collectors where owner = '00000000-0000-0000-0000-00000000000b'),
  'consent is recorded');
select is((select array_agg(area_id order by area_id) from public.collector_areas a
             join public.collectors c on c.id = a.collector_id where c.owner = '00000000-0000-0000-0000-00000000000b'),
  array['brikama', 'nyambai'], 'both areas are saved');
select is((select phone from public.collector_contacts cc
             join public.collectors c on c.id = cc.collector_id where c.owner = '00000000-0000-0000-0000-00000000000b'),
  '+2207000001', 'the phone number is saved');
select throws_ok($$select public.save_my_listing(null, 'No areas', 'tricycle', '', null, null, array[]::text[], array['household'], false)$$,
  '22023', null, 'a listing needs at least one area');
select throws_ok($$select public.save_my_listing(null, 'Old', 'tricycle', '', null, null, array['old-area'], array['household'], false)$$,
  '23503', null, 'an area no longer in use is refused');
select throws_ok($$select public.save_my_listing(null, 'Bad phone', 'tricycle', '', '7000001', null, array['brikama'], array['household'], false)$$,
  '23514', null, 'a phone number must be in international format');
select is((select count(*)::int from public.collectors where owner = '00000000-0000-0000-0000-00000000000b'), 1,
  'a refused save leaves nothing half-saved');
select is((select public.save_my_listing(null, 'Fatou''s carts', 'donkey-cart', 'Weekly pickups',
             '+2207000001', '+2207000001', array['brikama', 'nyambai'], array['household', 'garden'], true) ->> 'status'),
  'submitted', 'saving again without an id returns the status');
select is((select count(*)::int from public.collectors where owner = '00000000-0000-0000-0000-00000000000b'), 1,
  'saving again without an id updates the listing instead of adding a second');

-- Admin approves, then B edits ---------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
select public.set_collector_status(
  (select id from public.collectors where owner = '00000000-0000-0000-0000-00000000000b'), 'approved', 'Met in person');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);

select lives_ok(format($$select public.save_my_listing(%L, 'Fatou''s carts', 'donkey-cart', 'Weekly pickups',
                   '+2207000001', '+2207000001', array['brikama'], array['household'], false)$$,
                   (select id from public.collectors where owner = '00000000-0000-0000-0000-00000000000b')),
  'the collector can edit their listing');
select is((select array_agg(area_id) from public.collector_areas a
             join public.collectors c on c.id = a.collector_id where c.owner = '00000000-0000-0000-0000-00000000000b'),
  array['brikama'], 'removed areas are removed');
select ok((select consent_at is null from public.collectors where owner = '00000000-0000-0000-0000-00000000000b'),
  'unticking consent withdraws it');
select is((select status::text from public.collectors where owner = '00000000-0000-0000-0000-00000000000b'), 'approved',
  'removing an area or consent does not need review again');
select lives_ok(format($$select public.save_my_listing(%L, 'Fatou''s big carts', 'donkey-cart', 'Weekly pickups',
                   '+2207000001', '+2207000001', array['brikama'], array['household'], true)$$,
                   (select id from public.collectors where owner = '00000000-0000-0000-0000-00000000000b')),
  'the collector renames the listing');
select is((select status::text from public.collectors where owner = '00000000-0000-0000-0000-00000000000b'), 'submitted',
  'renaming an approved listing sends it back for review');

-- Look up the id while it is still visible, for the next check.
select set_config('test.listing', (select id::text from public.collectors where owner = '00000000-0000-0000-0000-00000000000b'), true);

-- Admin --------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

select throws_ok(format($$select public.save_my_listing(%L, 'Admin edit', 'tricycle', '', null, null, array['brikama'], array['household'], true)$$,
                   current_setting('test.listing')),
  'P0002', null, 'even an admin cannot save over a collector''s listing or give consent for them');
select is((select name from public.collectors where id = current_setting('test.listing')::uuid), 'Fatou''s big carts',
  'the admin''s attempt changed nothing');

-- Collector C --------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', true);

select throws_ok(format($$select public.save_my_listing(%L, 'Hijacked', 'tricycle', '', null, null, array['brikama'], array['household'], false)$$,
                   current_setting('test.listing')),
  'P0002', null, 'another collector cannot save over someone else''s listing');

select * from finish();
rollback;
