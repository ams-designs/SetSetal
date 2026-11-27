-- A resident's phone gives each report its own random id, so a report sent
-- again after a timeout (the first attempt reached the server, but the answer
-- didn't come back) is refused as a duplicate instead of stored twice. The id
-- is random and says nothing about the resident or the phone (product rule 3).
grant insert (id) on table public.reports to anon, authenticated;
