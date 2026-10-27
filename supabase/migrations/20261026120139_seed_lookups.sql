-- Lookup rows the app needs in every environment, so they live in a migration
-- rather than seed.sql (which only runs locally). The ids match
-- src/data/lookups.ts until the front end reads these tables.

insert into public.vehicle_types (id, sort_order) values
  ('municipal-truck', 1),
  ('private-truck', 2),
  ('small-van', 3),
  ('tricycle', 4),
  ('donkey-cart', 5),
  ('horse-cart', 6);

insert into public.waste_types (id, sort_order) values
  ('household', 1),
  ('garden', 2),
  ('bulky', 3),
  ('recyclables', 4),
  ('business', 5);

insert into public.report_types (id, sort_order) values
  ('general', 1),
  ('incorrect-listing', 2),
  ('safety', 3),
  ('accessibility', 4);

-- Pilot area (decision D3, 26 Oct 2026). The neighbourhoods within Brikama
-- are still to be agreed with the owner.
insert into public.areas (id, name, district, sort_order) values
  ('brikama', 'Brikama', 'West Coast Region', 1);
