-- Residents report a problem by tapping a picture; writing is optional, so a
-- resident who can't write can still report (decided 26 Nov 2026).
--
-- * Two reasons residents need most, first in the list: the collector didn't
--   come, or came late.
-- * The message may be empty. It still has no room for an address: the limit
--   stays 1,000 characters and reports still never name the resident.

insert into public.report_types (id, sort_order) values
  ('no-show', 1),
  ('late', 2)
on conflict (id) do nothing;

update public.report_types set sort_order = case id
  when 'incorrect-listing' then 3
  when 'safety' then 4
  when 'general' then 5
  when 'accessibility' then 6
  else sort_order end;

alter table public.reports drop constraint if exists reports_message_check;
alter table public.reports alter column message set default '';
alter table public.reports add constraint reports_message_check check (char_length(message) <= 1000);
