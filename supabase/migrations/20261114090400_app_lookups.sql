-- The lists the app offers (areas, vehicle types, waste types, report types)
-- in one request instead of four: the target phone is on slow, paid data.
--
-- Runs with the caller's rights, so the lookup tables' policies still decide
-- what is returned. Only rows in use are included, in their sort order.

create function public.app_lookups()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'areas', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort_order, name)
                         from public.areas where active), '[]'::jsonb),
    'vehicle_types', coalesce((select jsonb_agg(id order by sort_order, id) from public.vehicle_types where active), '[]'::jsonb),
    'waste_types', coalesce((select jsonb_agg(id order by sort_order, id) from public.waste_types where active), '[]'::jsonb),
    'report_types', coalesce((select jsonb_agg(id order by sort_order, id) from public.report_types where active), '[]'::jsonb));
$$;

revoke execute on function public.app_lookups() from public;
grant execute on function public.app_lookups() to anon, authenticated;
