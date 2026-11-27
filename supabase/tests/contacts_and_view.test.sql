-- Phone and WhatsApp appear only for approved listings with consent (rule 2).
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a');

-- Fixtures that start approved need a reason, as an import would.
select set_config('setsetal.status_reason', 'Test fixture', true);
insert into public.collectors (id, owner, name, vehicle_type, consent_at, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Consented', 'donkey-cart', now(), 'approved'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'Not yet approved', 'small-van', now(), 'submitted'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000c', 'No consent', 'tricycle', null, 'approved'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000b', 'Suspended', 'tricycle', now(), 'suspended'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000b', 'Approved, no phone yet', 'tricycle', now(), 'approved'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000b', 'Approved, one area', 'tricycle', now(), 'approved'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-00000000000b', 'Approved, withdrawing', 'tricycle', now(), 'approved');
select set_config('setsetal.status_reason', '', true);
insert into public.areas (id, name, district, active) values
  ('nyambai', 'Nyambai', 'West Coast Region', true),
  ('old-area', 'Old area', 'Test', false);
insert into public.collector_contacts (collector_id, phone, whatsapp) values
  ('10000000-0000-0000-0000-000000000001', '+2207000001', '+2207000001'),
  ('10000000-0000-0000-0000-000000000002', '+2207000002', null),
  ('10000000-0000-0000-0000-000000000003', '+2207000003', '+2207000003'),
  ('10000000-0000-0000-0000-000000000004', '+2207000004', null),
  ('10000000-0000-0000-0000-000000000007', '+2207000007', null);
insert into public.collector_areas (collector_id, area_id) values
  ('10000000-0000-0000-0000-000000000001', 'brikama'),
  ('10000000-0000-0000-0000-000000000002', 'brikama'),
  ('10000000-0000-0000-0000-000000000006', 'brikama');

-- Anonymous resident ---------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);

select is((select phone from public.public_collectors where id = '10000000-0000-0000-0000-000000000001'), '+2207000001',
  'an approved listing with consent shows its phone');
select is((select phone from public.public_collectors where id = '10000000-0000-0000-0000-000000000003'), null::text,
  'an approved listing without consent hides its phone');
select is((select count(*)::int from public.public_collectors), 5, 'the public view lists approved listings only');
select is_empty($$select 1 from public.public_collectors where id = '10000000-0000-0000-0000-000000000004'$$,
  'a suspended listing is hidden');
select is((select phone from public.collector_contacts where collector_id = '10000000-0000-0000-0000-000000000001'), '+2207000001',
  'anon can read consented contacts of an approved listing from the table');
select is((select areas from public.public_collectors where id = '10000000-0000-0000-0000-000000000001'), array['brikama'],
  'the public view includes a listing''s areas');
select is_empty($$select 1 from public.collector_contacts where collector_id = '10000000-0000-0000-0000-000000000003'$$,
  'anon cannot read contacts without consent from the table either');
select is_empty($$select 1 from public.collector_contacts where collector_id = '10000000-0000-0000-0000-000000000002'$$,
  'anon cannot read contacts of an unapproved listing');
select is_empty($$select 1 from public.collector_areas where collector_id = '10000000-0000-0000-0000-000000000002'$$,
  'anon cannot see the areas of an unapproved listing');
select throws_ok($$insert into public.collector_contacts (collector_id, phone) values ('10000000-0000-0000-0000-000000000001', '+2207999999')$$,
  '42501', null, 'anon cannot add contact details');

-- Owner ----------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);

select is((select phone from public.collector_contacts where collector_id = '10000000-0000-0000-0000-000000000002'), '+2207000002',
  'owner reads their own contact details before approval');
select lives_ok($$update public.collector_contacts set phone = '+2207555555' where collector_id = '10000000-0000-0000-0000-000000000001'$$,
  'owner can change their phone number');
select is((select status::text from public.collectors where id = '10000000-0000-0000-0000-000000000001'), 'submitted',
  'changing the phone on an approved listing sends it back for review');
select lives_ok($$insert into public.collector_contacts (collector_id, phone) values ('10000000-0000-0000-0000-000000000005', '+2207000005')$$,
  'owner can add a phone number');
select is((select status::text from public.collectors where id = '10000000-0000-0000-0000-000000000005'), 'submitted',
  'adding a phone to an approved listing sends it back for review');
select lives_ok($$insert into public.collector_areas (collector_id, area_id) values ('10000000-0000-0000-0000-000000000006', 'nyambai')$$,
  'owner can add an area');
select is((select status::text from public.collectors where id = '10000000-0000-0000-0000-000000000006'), 'submitted',
  'adding an area to an approved listing sends it back for review');
select throws_ok($$insert into public.collector_areas (collector_id, area_id) values ('10000000-0000-0000-0000-000000000002', 'old-area')$$,
  '23503', null, 'a listing cannot add an area that is no longer in use');
select lives_ok($$update public.collectors set consent_at = null where id = '10000000-0000-0000-0000-000000000007'$$,
  'owner can withdraw consent');

-- Another collector ----------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', true);

select throws_ok($$insert into public.collector_waste_types (collector_id, waste_type_id) values ('10000000-0000-0000-0000-000000000002', 'household')$$,
  '42501', null, 'another collector cannot add waste types to someone else''s listing');
select throws_ok($$insert into public.collector_areas (collector_id, area_id) values ('10000000-0000-0000-0000-000000000002', 'nyambai')$$,
  '42501', null, 'another collector cannot add areas to someone else''s listing');
select throws_ok($$insert into public.collector_contacts (collector_id, phone) values ('10000000-0000-0000-0000-000000000006', '+2207666666')$$,
  '42501', null, 'another collector cannot add contacts to someone else''s listing');
select is_empty($$select 1 from public.collector_contacts where collector_id = '10000000-0000-0000-0000-000000000007'$$,
  'withdrawn consent hides contacts straight away');
select is_empty($$select 1 from public.collector_contacts where collector_id = '10000000-0000-0000-0000-000000000002'$$,
  'another collector cannot read contacts of an unapproved listing');

-- Admin ----------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

select is((select phone from public.collector_contacts where collector_id = '10000000-0000-0000-0000-000000000002'), '+2207000002',
  'admin reads contacts of an unapproved listing to review it');

select * from finish();
rollback;
