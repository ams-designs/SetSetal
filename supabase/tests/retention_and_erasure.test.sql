-- Collectors can delete their account, and old rows are removed on schedule.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a');
select set_config('setsetal.status_reason', 'Imported for the test', true);
insert into public.collectors (id, owner, name, vehicle_type, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Cart', 'donkey-cart', 'approved'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'Van', 'small-van', 'approved');
select set_config('setsetal.status_reason', '', true);
insert into public.collector_contacts (collector_id, phone) values ('10000000-0000-0000-0000-000000000001', '+2207000001');
insert into public.collector_areas (collector_id, area_id) values ('10000000-0000-0000-0000-000000000001', 'brikama');
insert into public.collector_waste_types (collector_id, waste_type_id) values ('10000000-0000-0000-0000-000000000001', 'household');
insert into public.events (name, channel, collector_id) values ('contact_tap', 'call', '10000000-0000-0000-0000-000000000001');

-- Anonymous visitor ------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok($$select public.delete_my_account()$$, '42501', null, 'anon cannot call delete_my_account');
select throws_ok($$select private.apply_retention()$$, '42501', null, 'anon cannot run the clean-up');

-- Collector B deletes their account ---------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);
select throws_ok($$select private.apply_retention()$$, '42501', null, 'a collector cannot run the clean-up');
select lives_ok($$select public.delete_my_account()$$, 'a collector deletes their account');

reset role;
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-00000000000b'), 0, 'the sign-in is gone');
select is((select count(*)::int from public.collectors where id = '10000000-0000-0000-0000-000000000001'), 0, 'the listing is gone');
select is((select count(*)::int from public.collector_contacts where collector_id = '10000000-0000-0000-0000-000000000001'), 0,
  'the phone numbers are gone');
select is((select count(*)::int from public.collector_areas where collector_id = '10000000-0000-0000-0000-000000000001'), 0,
  'the areas are gone');
select is((select count(*)::int from public.events), 0, 'the counts that named the listing are gone');
select is((select count(*)::int from public.collectors), 1, 'other collectors are untouched');
select is((select count(*)::int from public.audit_log where collector_id is null), 1,
  'the history row stays for now, no longer linked to anyone');

-- Nightly clean-up ----------------------------------------------------------------
insert into public.reports (id, type, message, status, resolved_at, created_at) values
  ('20000000-0000-0000-0000-000000000001', 'general', 'Closed long ago', 'resolved', now() - interval '13 months', now() - interval '14 months'),
  ('20000000-0000-0000-0000-000000000002', 'general', 'Closed recently', 'resolved', now() - interval '1 month', now() - interval '2 months'),
  ('20000000-0000-0000-0000-000000000003', 'general', 'Open and recent', 'open', null, now() - interval '3 months'),
  ('20000000-0000-0000-0000-000000000004', 'general', 'Never closed', 'open', null, now() - interval '25 months'),
  ('20000000-0000-0000-0000-000000000005', 'general', 'Old but closed recently', 'dismissed', now() - interval '1 week', now() - interval '25 months');
insert into public.events (name, report_type, day) values
  ('report_submitted', 'general', (now() at time zone 'utc')::date - 400),
  ('report_submitted', 'general', (now() at time zone 'utc')::date - 10);
update public.audit_log set created_at = now() - interval '13 months' where collector_id is null;

select is((select private.apply_retention()), '{"reports": 2, "events": 1, "history": 1}'::jsonb,
  'the clean-up reports what it removed');
select is((select array_agg(message order by message) from public.reports), array['Closed recently', 'Old but closed recently', 'Open and recent'],
  'reports closed over 12 months ago, or never closed in 24, are removed; an old report closed recently is kept');
select is((select count(*)::int from public.events), 1, 'counts older than 12 months are removed');
select is((select count(*)::int from public.audit_log where collector_id is null), 0,
  'history of deleted listings is removed after 12 months');
select is((select count(*)::int from public.audit_log), 1, 'history of existing listings is kept');
select is((select private.apply_retention()), '{"reports": 0, "events": 0, "history": 0}'::jsonb,
  'running it again removes nothing more');

select * from finish();
rollback;
