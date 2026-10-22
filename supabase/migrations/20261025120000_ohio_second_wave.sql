-- Columbus area, second wave: Granicus (Delaware) and CivicWeb (Hilliard) collectors, and Groveport on Legistar
-- (its Granicus page stopped in 2021; council only, no P&Z online). Idempotent (the MCP can apply twice).

alter table public.jurisdictions drop constraint if exists jurisdictions_collector_check;
alter table public.jurisdictions add constraint jurisdictions_collector_check
  check (collector = any (array['agendacenter', 'civicclerk', 'municode', 'legistar', 'granicus', 'civicweb']));

insert into public.jurisdictions
  (id, name, kind, county, governing_body, website, research_status, collector, collector_ref, followed, state, time_zone, notes)
values
  ('delaware_oh', 'City of Delaware', 'city', 'Delaware', 'City Council', 'https://www.delawareohio.net', 'partial', 'granicus', 'delawareohio', true, 'OH', 'America/New_York', null),
  ('hilliard_oh', 'City of Hilliard', 'city', 'Franklin', 'City Council', 'https://hilliardohio.gov', 'partial', 'civicweb', 'hilliardohio', true, 'OH', 'America/New_York', null),
  ('groveport_oh', 'City of Groveport', 'city', 'Franklin', 'City Council', 'https://www.groveport.org', 'partial', 'legistar', 'groveport', true, 'OH', 'America/New_York',
   'Only City Council posts to Legistar; Planning & Zoning Commission meetings are not collected yet.')
on conflict (id) do nothing;

insert into public.jurisdiction_progress (jurisdiction_id, task, status, note)
select j.id, t.task, case t.task when 'schedule' then 'in_progress' else 'not_started' end,
       case t.task when 'schedule' then 'Meetings collected automatically; no yearly schedule or submittal deadlines yet' end
from public.jurisdictions j
cross join (values ('rezoning'), ('schedule'), ('people'), ('districts')) as t(task)
where j.id in ('delaware_oh', 'hilliard_oh', 'groveport_oh')
on conflict do nothing;
