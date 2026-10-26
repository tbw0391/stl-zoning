-- Columbus area, fourth wave: CivicPlus Archive Center (Worthington, Marysville) and WP File Download (Newark)
-- readers in collect-meetings. Idempotent (the MCP can apply twice).

alter table public.jurisdictions drop constraint if exists jurisdictions_collector_check;
alter table public.jurisdictions add constraint jurisdictions_collector_check
  check (collector = any (array['agendacenter', 'civicclerk', 'municode', 'legistar', 'granicus', 'civicweb', 'dublin', 'pagetable', 'dcrpc',
                                'archivecenter', 'wpfd']));

insert into public.jurisdictions
  (id, name, kind, county, governing_body, website, research_status, collector, collector_ref, followed, state, time_zone, notes)
values
  ('worthington_oh', 'City of Worthington', 'city', 'Franklin', 'City Council', 'https://www.worthington.org', 'partial', 'archivecenter',
   'https://www.worthington.org pz=38,39 gov=44,45', true, 'OH', 'America/New_York',
   'Planning cases go to the Municipal Planning Commission, which meets jointly with the Architectural Review Board (ARB/MPC).'),
  ('marysville_oh', 'City of Marysville', 'city', 'Union', 'City Council', 'https://www.marysvilleohio.org', 'partial', 'archivecenter',
   'https://www.marysvilleohio.org pz=73,39', true, 'OH', 'America/New_York',
   'City Council agendas are posted in the Municode Library (munidocs), which is not collected yet; only Planning Commission meetings are.'),
  ('newark_oh', 'City of Newark', 'city', 'Licking', 'City Council', 'https://www.newarkohio.gov', 'partial', 'wpfd',
   'https://www.newarkohio.gov pz=200,199,201 gov=33,32,34', true, 'OH', 'America/New_York', null)
on conflict (id) do nothing;

insert into public.jurisdiction_progress (jurisdiction_id, task, status, note)
select j.id, t.task, case t.task when 'schedule' then 'in_progress' else 'not_started' end,
       case t.task when 'schedule' then 'Meetings collected automatically; no yearly schedule or submittal deadlines yet' end
from public.jurisdictions j
cross join (values ('rezoning'), ('schedule'), ('people'), ('districts')) as t(task)
where j.id in ('worthington_oh', 'marysville_oh', 'newark_oh')
on conflict do nothing;
