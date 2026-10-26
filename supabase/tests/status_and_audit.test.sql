-- Status changes go through set_collector_status() and are always audited.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.collectors (id, owner, name, vehicle_type, consent_at) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Cart', 'donkey-cart', now());

select throws_ok($$insert into public.collectors (owner, name, vehicle_type, status) values ('00000000-0000-0000-0000-00000000000b', 'Imported', 'tricycle', 'approved')$$,
  '22023', null, 'a listing cannot be inserted as approved without a reason');

-- Owner ----------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);

select throws_ok($$select public.set_collector_status('10000000-0000-0000-0000-000000000001', 'approved', 'Looks fine to me')$$,
  '42501', null, 'an owner cannot approve their own listing');
select is((select count(*)::int from public.audit_log where collector_id = '10000000-0000-0000-0000-000000000001'), 1,
  'owner can read their listing''s history');

-- Admin ----------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

select throws_ok($$update public.collectors set status = 'approved' where id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'even an admin cannot set a status directly');
select throws_ok($$select public.set_collector_status('10000000-0000-0000-0000-000000000001', 'approved', '  ')$$,
  '22023', null, 'a status change needs a reason');
select lives_ok($$select public.set_collector_status('10000000-0000-0000-0000-000000000001', 'approved', 'Met in person at Brikama market')$$,
  'an admin approves with a reason');
select is((select status::text from public.collectors where id = '10000000-0000-0000-0000-000000000001'), 'approved',
  'the listing is approved');
select is(
  (select array[from_status::text, to_status::text, reason, actor::text] from public.audit_log
    where collector_id = '10000000-0000-0000-0000-000000000001' order by id desc limit 1),
  array['submitted', 'approved', 'Met in person at Brikama market', '00000000-0000-0000-0000-00000000000a'],
  'the approval is audited with who, what and why');
select throws_ok($$select public.set_collector_status('10000000-0000-0000-0000-000000000001', 'approved', 'Again')$$,
  'P0002', null, 'approving an approved listing is refused');
select throws_ok($$update public.audit_log set reason = 'Edited'$$, '42501', null, 'nobody can edit the audit log');
select throws_ok($$delete from public.audit_log$$, '42501', null, 'nobody can delete from the audit log');
select throws_ok($$insert into public.audit_log (to_status, reason) values ('approved', 'Forged')$$,
  '42501', null, 'nobody can forge an audit row');

-- Another collector and anon ---------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', true);

select is_empty($$select 1 from public.audit_log$$, 'another collector cannot read someone else''s history');

reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);

select throws_ok($$select 1 from public.audit_log$$, '42501', null, 'anon cannot read the audit log');
select throws_ok($$select public.set_collector_status('10000000-0000-0000-0000-000000000001', 'suspended', 'Anon attempt')$$,
  '42501', null, 'anon cannot call set_collector_status');

-- Service role ---------------------------------------------------------------
reset role;
set local role service_role;

select throws_ok($$delete from public.audit_log$$, '42501', null, 'the service role cannot delete audit rows either');
select throws_ok($$update public.audit_log set reason = 'Edited'$$, '42501', null, 'the service role cannot edit audit rows');
select throws_ok($$insert into public.audit_log (to_status, reason) values ('approved', 'Forged')$$,
  '42501', null, 'the service role cannot forge audit rows');

reset role;
select ok(not has_table_privilege('service_role', 'public.audit_log', 'TRIGGER, TRUNCATE, REFERENCES'),
  'the service role cannot add triggers to, truncate or reference the audit log');

select * from finish();
rollback;
