-- First twelve Ohio jurisdictions (Columbus area) with automated collectors. Applied after the site and edge functions
-- learned to show one state at a time (20261025100000_jurisdiction_state), so they never appear in Lombardo's Missouri view.
-- Idempotent: the MCP can apply a migration twice.

insert into public.jurisdictions
  (id, name, kind, county, governing_body, website, research_status, collector, collector_ref, followed, state, time_zone, notes)
values
  ('columbus_oh', 'City of Columbus', 'city', 'Franklin', 'City Council', 'https://www.columbus.gov', 'partial', 'legistar', 'columbus', true, 'OH', 'America/New_York',
   'Rezonings go to the Development Commission (not collected yet; columbus.gov blocks automated requests), then to City Council sitting as its Zoning Committee, which is collected as the council meeting.'),
  ('gahanna_oh', 'City of Gahanna', 'city', 'Franklin', 'City Council', 'https://www.gahanna.gov', 'partial', 'legistar', 'gahanna', true, 'OH', 'America/New_York', null),
  ('grove_city_oh', 'City of Grove City', 'city', 'Franklin', 'City Council', 'https://www.grovecityohio.gov', 'partial', 'civicclerk', 'grovecityoh', true, 'OH', 'America/New_York', null),
  ('upper_arlington_oh', 'City of Upper Arlington', 'city', 'Franklin', 'City Council', 'https://www.upperarlingtonoh.gov', 'partial', 'civicclerk', 'upperarlingtonoh', true, 'OH', 'America/New_York',
   'P&Z board is the Board of Zoning and Planning.'),
  ('reynoldsburg_oh', 'City of Reynoldsburg', 'city', 'Franklin', 'City Council', 'https://www.reynoldsburg.gov', 'partial', 'civicclerk', 'reynoldsburgoh', true, 'OH', 'America/New_York',
   'Also extends into Licking and Fairfield counties.'),
  ('whitehall_oh', 'City of Whitehall', 'city', 'Franklin', 'City Council', 'https://www.whitehall-oh.us', 'partial', 'civicclerk', 'whitehalloh', true, 'OH', 'America/New_York', null),
  ('canal_winchester_oh', 'City of Canal Winchester', 'city', 'Franklin', 'City Council', 'https://www.canalwinchesterohio.gov', 'partial', 'agendacenter', 'https://www.canalwinchesterohio.gov', true, 'OH', 'America/New_York',
   'Also extends into Fairfield County. Its CivicClerk site lists council only; AgendaCenter has both boards.'),
  ('johnstown_oh', 'City of Johnstown', 'city', 'Licking', 'City Council', 'https://www.johnstownohio.org', 'partial', 'civicclerk', 'johnstownoh', true, 'OH', 'America/New_York', null),
  ('etna_twp_oh', 'Etna Township', 'township', 'Licking', 'Board of Trustees', 'https://www.etnatownship.com', 'partial', 'agendacenter', 'https://www.etnatownship.com', true, 'OH', 'America/New_York', null),
  ('lancaster_oh', 'City of Lancaster', 'city', 'Fairfield', 'City Council', 'https://www.lancasterohio.gov', 'partial', 'agendacenter', 'https://www.lancasterohio.gov', true, 'OH', 'America/New_York', null),
  ('sunbury_oh', 'City of Sunbury', 'city', 'Delaware', 'City Council', 'https://www.sunburyohio.org', 'partial', 'agendacenter', 'https://www.sunburyohio.org', true, 'OH', 'America/New_York', null),
  ('liberty_twp_oh', 'Liberty Township', 'township', 'Delaware', 'Board of Trustees', 'https://www.libertytwp.org', 'partial', 'agendacenter', 'https://www.libertytwp.org', true, 'OH', 'America/New_York',
   'Only the Zoning Commission posts to AgendaCenter; Board of Trustees meetings are not collected yet.')
on conflict (id) do nothing;

insert into public.jurisdiction_progress (jurisdiction_id, task, status, note)
select j.id, t.task, case t.task when 'schedule' then 'in_progress' else 'not_started' end,
       case t.task when 'schedule' then 'Meetings collected automatically; no yearly schedule or submittal deadlines yet' end
from public.jurisdictions j
cross join (values ('rezoning'), ('schedule'), ('people'), ('districts')) as t(task)
where j.state = 'OH'
on conflict do nothing;
