-- Usage counts: residents add them anonymously, only admins read them, and
-- nothing in them can identify a resident.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a');
select set_config('setsetal.status_reason', 'Imported for the test', true);
insert into public.collectors (id, owner, name, vehicle_type, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Cart', 'donkey-cart', 'approved');
select set_config('setsetal.status_reason', '', true);
insert into public.collectors (id, owner, name, vehicle_type) values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'Hidden', 'tricycle');

select is(
  (select array_agg(column_name::text order by column_name::text) from information_schema.columns
    where table_schema = 'public' and table_name = 'events'),
  array['area', 'channel', 'collector_id', 'day', 'id', 'name', 'report_type', 'vehicle', 'waste'],
  'the table has no column for a person, a device, an address or free text');

-- Anonymous visitor ------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);

select lives_ok($$insert into public.events (name, area, vehicle, waste) values ('search_no_results', 'brikama', 'all', 'bulky')$$,
  'a search with no results is counted');
select lives_ok($$insert into public.events (name, channel, collector_id) values ('contact_tap', 'call', '10000000-0000-0000-0000-000000000001')$$,
  'a tap on Call is counted');
select lives_ok($$insert into public.events (name, channel, collector_id) values ('contact_tap', 'whatsapp', '10000000-0000-0000-0000-000000000001')$$,
  'a tap on WhatsApp is counted');
select lives_ok($$insert into public.events (name, report_type) values ('report_submitted', 'safety')$$,
  'a report is counted by type');
select lives_ok($$insert into public.events (name, collector_id) values ('listing_marked_wrong', '10000000-0000-0000-0000-000000000001')$$,
  'a listing marked wrong is counted');

select throws_ok($$insert into public.events (name) values ('page_view')$$, '42501', null, 'an unknown event is refused');
select throws_ok($$insert into public.events (name, area) values ('search_no_results', '12 Mosque Road, Brikama')$$,
  '23514', null, 'free text such as an address is refused');
select throws_ok($$insert into public.events (name, channel, collector_id) values ('contact_tap', 'email', '10000000-0000-0000-0000-000000000001')$$,
  '23514', null, 'an unknown contact channel is refused');
select throws_ok($$insert into public.events (name, channel) values ('contact_tap', 'call')$$,
  '42501', null, 'a contact tap must name a listing');
select throws_ok($$insert into public.events (name, channel, collector_id) values ('contact_tap', 'call', '10000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'an event cannot name a listing that residents cannot see');
select throws_ok($$insert into public.events (name, report_type, area) values ('report_submitted', 'safety', 'brikama')$$,
  '42501', null, 'an event cannot carry fields it does not need');
select throws_ok($$insert into public.events (name, area, day) values ('search_no_results', 'brikama', '2020-01-01')$$,
  '42501', null, 'the day cannot be chosen by the sender');
select throws_ok($$select 1 from public.events$$, '42501', null, 'anon cannot read events');
select throws_ok($$select public.admin_activity(30)$$, '42501', null, 'anon cannot read the summary');
select throws_ok($$delete from public.events$$, '42501', null, 'anon cannot delete events');

-- Collector --------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);

select is_empty($$select 1 from public.events$$, 'a collector cannot read events');
select throws_ok($$select public.admin_activity(30)$$, '42501', null, 'a collector cannot read the summary');

-- Admin ------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

select is((select count(*)::int from public.events), 5, 'an admin reads the events');
select is((select public.admin_activity(30) -> 'totals'),
  '{"contact_tap": 2, "report_submitted": 1, "search_no_results": 1, "listing_marked_wrong": 1}'::jsonb,
  'the summary counts each kind of event');
select is((select public.admin_activity(30) -> 'contacts'),
  '[{"name": "Cart", "call": 1, "whatsapp": 1}]'::jsonb, 'and contact taps per listing');
select is((select public.admin_activity(30) -> 'no_results'),
  '[{"area": "brikama", "vehicle": "all", "waste": "bulky", "count": 1}]'::jsonb, 'and the searches that found nothing');

select * from finish();
rollback;
