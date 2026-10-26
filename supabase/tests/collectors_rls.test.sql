-- Who can read, create, edit and delete listings.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Admin, an owner and another collector.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a');

-- Fixtures that start approved need a reason, as an import would.
select set_config('setsetal.status_reason', 'Test fixture', true);
insert into public.collectors (id, owner, name, vehicle_type, consent_at, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Approved cart', 'donkey-cart', now(), 'approved'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'Submitted van', 'small-van', now(), 'submitted'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000c', 'Rejected tricycle', 'tricycle', now(), 'rejected'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000b', 'Second cart', 'horse-cart', now(), 'approved'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000b', 'Third cart', 'horse-cart', now(), 'approved');
select set_config('setsetal.status_reason', '', true);
update public.vehicle_types set active = false where id = 'municipal-truck';

-- Anonymous resident ---------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);

select is((select count(*)::int from public.collectors), 3, 'anon sees only approved listings');
select throws_ok('select owner from public.collectors', '42501', null, 'anon cannot read who owns a listing');
select throws_ok($$insert into public.collectors (name, vehicle_type) values ('Sneaky', 'tricycle')$$,
  '42501', null, 'anon cannot create a listing');
select is((select count(*)::int from public.collectors where id = '10000000-0000-0000-0000-000000000001'), 1,
  'anon can read an approved listing');

-- Owner ----------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);

select is((select count(*)::int from public.collectors where owner = '00000000-0000-0000-0000-00000000000b'), 4,
  'owner sees their own listings, approved or not');
select lives_ok($$insert into public.collectors (name, vehicle_type, consent_at) values ('New cart', 'horse-cart', '2020-01-01')$$,
  'owner can create a listing');
select is((select status::text from public.collectors where name = 'New cart'), 'submitted',
  'a new listing starts as submitted');
select ok((select consent_at > now() - interval '1 minute' from public.collectors where name = 'New cart'),
  'consent time is set by the server, not the client');
select throws_ok($$insert into public.collectors (owner, name, vehicle_type) values ('00000000-0000-0000-0000-00000000000c', 'Fake', 'tricycle')$$,
  '42501', null, 'owner cannot create a listing for someone else');
select throws_ok($$update public.collectors set status = 'approved' where id = '10000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'owner cannot change a status');
select lives_ok($$update public.collectors set description = 'Now with Sunday pickups' where id = '10000000-0000-0000-0000-000000000001'$$,
  'owner can edit their listing');
select is((select status::text from public.collectors where id = '10000000-0000-0000-0000-000000000001'), 'submitted',
  'editing an approved listing sends it back for review');
select is(
  (select array[actor::text, reason] from public.audit_log
    where collector_id = '10000000-0000-0000-0000-000000000001' order by id desc limit 1),
  array['00000000-0000-0000-0000-00000000000b', 'Changed by the owner, so it needs review again'],
  'the owner''s edit is audited with the owner as actor');
select lives_ok($$update public.collectors set description = 'Weekdays only'
                   where id in ('10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005')$$,
  'owner can edit two approved listings in one statement');
select is((select count(*)::int from public.audit_log
            where collector_id in ('10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005')
              and to_status = 'submitted'), 2,
  'both edits are audited');
select throws_ok($$insert into public.collectors (name, vehicle_type) values ('Old truck', 'municipal-truck')$$,
  '23503', null, 'a listing cannot use a vehicle type that is no longer in use');

-- Another collector ----------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', true);

select is_empty($$select 1 from public.collectors where id = '10000000-0000-0000-0000-000000000002'$$,
  'another collector cannot see an unapproved listing');
select lives_ok($$update public.collectors set name = 'Hijacked' where id = '10000000-0000-0000-0000-000000000002'$$,
  'an update of someone else''s listing runs but matches nothing');
select lives_ok($$delete from public.collectors where id = '10000000-0000-0000-0000-000000000002'$$,
  'a delete of someone else''s listing runs but matches nothing');
select lives_ok($$update public.collectors set name = 'Fixed tricycle' where id = '10000000-0000-0000-0000-000000000003'$$,
  'a collector can edit their own rejected listing');
select is((select status::text from public.collectors where id = '10000000-0000-0000-0000-000000000003'), 'submitted',
  'editing a rejected listing resubmits it');
select is((select count(*)::int from public.public_collectors where id = '10000000-0000-0000-0000-000000000002'), 0,
  'the public view hides other people''s unapproved listings from signed-in users');

-- Admin ----------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

select is((select name from public.collectors where id = '10000000-0000-0000-0000-000000000002'), 'Submitted van',
  'the other collector''s update and delete changed nothing');
select is((select count(*)::int from public.collectors), 6, 'admin sees every listing');

select * from finish();
rollback;
