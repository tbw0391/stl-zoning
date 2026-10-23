-- Columbus area, third wave: places that post meetings on their own web pages (readers in collect-meetings):
-- Dublin (dated blocks per meeting), New Albany (a table per board) and the Delaware County Regional Planning
-- Commission (a grid of the year's dates). Idempotent (the MCP can apply twice).

alter table public.jurisdictions drop constraint if exists jurisdictions_collector_check;
alter table public.jurisdictions add constraint jurisdictions_collector_check
  check (collector = any (array['agendacenter', 'civicclerk', 'municode', 'legistar', 'granicus', 'civicweb', 'dublin', 'pagetable', 'dcrpc']));

insert into public.jurisdictions
  (id, name, kind, county, governing_body, website, research_status, collector, collector_ref, followed, state, time_zone, notes)
values
  ('dublin_oh', 'City of Dublin', 'city', 'Franklin', 'City Council', 'https://dublinohiousa.gov', 'partial', 'dublin',
   'pz=https://dublinohiousa.gov/boards-commissions/planning-zoning-commission/ gov=https://dublinohiousa.gov/council/meeting-schedule/',
   true, 'OH', 'America/New_York', null),
  ('new_albany_oh', 'City of New Albany', 'city', 'Franklin', 'City Council', 'https://newalbanyohio.org', 'partial', 'pagetable',
   'pz=https://newalbanyohio.org/boards-commissions/planning-commission/#19:00 gov=https://newalbanyohio.org/boards-commissions/city-council-business/',
   true, 'OH', 'America/New_York', null),
  ('delaware_rpc_oh', 'Delaware County Regional Planning Commission', 'county', 'Delaware', null,
   'https://regionalplanning.co.delaware.oh.us', 'partial', 'dcrpc', 'https://regionalplanning.co.delaware.oh.us/current_events/minutes/',
   true, 'OH', 'America/New_York',
   'Reviews subdivisions and recommends on rezonings in Delaware County''s townships before the township zoning commission and trustees decide.')
on conflict (id) do nothing;

insert into public.jurisdiction_progress (jurisdiction_id, task, status, note)
select j.id, t.task, case t.task when 'schedule' then 'in_progress' else 'not_started' end,
       case t.task when 'schedule' then 'Meetings collected automatically; no yearly schedule or submittal deadlines yet' end
from public.jurisdictions j
cross join (values ('rezoning'), ('schedule'), ('people'), ('districts')) as t(task)
where j.id in ('dublin_oh', 'new_albany_oh', 'delaware_rpc_oh')
on conflict do nothing;
