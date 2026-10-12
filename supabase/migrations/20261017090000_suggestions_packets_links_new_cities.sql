-- Suggestions from the site (Oct 12): full agenda packets, social media links for officials,
-- and Ballwin, Des Peres and Kirkwood added to St. Louis County coverage.

-- Agenda packets (agenda plus staff reports and plans), filled by the collectors where the city posts one.
alter table public.meetings add column packet_url text;

-- Public profile links for officials: [{"label": "Facebook", "url": "https://..."}]. Editable on /directory.
alter table public.people add column links jsonb;

-- Municode Meetings (<city>.municodemeetings.com), the third collector type.
alter table public.jurisdictions drop constraint jurisdictions_collector_check;
alter table public.jurisdictions add constraint jurisdictions_collector_check
  check (collector in ('agendacenter','civicclerk','municode'));

insert into public.jurisdictions (id, name, kind, county, governing_body, website, code_url, schedule_url, research_status, collector, collector_ref, notes) values
  ('ballwin', 'City of Ballwin', 'city', 'St. Louis', 'Board of Aldermen', 'https://www.ballwin.mo.us', 'https://library.municode.com/mo/ballwin/codes/code_of_ordinances',
   null, 'partial', 'municode', 'https://ballwin-mo.municodemeetings.com', null),
  ('des_peres', 'City of Des Peres', 'city', 'St. Louis', 'Board of Aldermen', 'https://www.desperesmo.org', null,
   null, 'partial', 'agendacenter', 'https://www.desperesmo.org', null),
  ('kirkwood', 'City of Kirkwood', 'city', 'St. Louis', 'City Council', 'https://www.kirkwoodmo.org', 'https://ecode360.com/KI3621',
   'https://www.kirkwoodmo.org/home/showpublisheddocument/16773/639014784400570000', 'partial', null, null,
   'Site is behind Akamai bot protection (blocks server requests, and event pages challenge even in Chrome), so no daily collector. A pre-application meeting with staff is required before applying; applications go through the EnerGov self-service portal. Staff liaison Amy Lowry, 314-822-5815, lowryag@kirkwoodmo.org.');

insert into public.jurisdiction_progress (jurisdiction_id, task, status, note, updated_on)
select j.id, t.task,
       case when t.task = 'schedule' then 'in_progress' else 'not_started' end,
       case when t.task = 'schedule' then
         case when j.id = 'kirkwood' then '2026 P&Z meetings and submittal deadlines from the city schedule; no City Council dates yet'
              else 'Meetings collected automatically; no yearly schedule or submittal deadlines yet' end end,
       current_date
from public.jurisdictions j
cross join (values ('rezoning'), ('schedule'), ('people'), ('districts')) as t(task)
where j.id in ('ballwin', 'des_peres', 'kirkwood')
on conflict do nothing;

-- Kirkwood 2026 P&Z schedule: 1st & 3rd Wednesday 7 PM (one meeting in Jun, Jul, Aug); applications due
-- the Friday 19 days before.
with sched(deadline, meeting) as (values
  ('2025-12-19'::date, '2026-01-07'::date),
  ('2026-01-02'::date, '2026-01-21'::date),
  ('2026-01-16'::date, '2026-02-04'::date),
  ('2026-01-30'::date, '2026-02-18'::date),
  ('2026-02-13'::date, '2026-03-04'::date),
  ('2026-02-27'::date, '2026-03-18'::date),
  ('2026-03-13'::date, '2026-04-01'::date),
  ('2026-03-27'::date, '2026-04-15'::date),
  ('2026-04-17'::date, '2026-05-06'::date),
  ('2026-05-01'::date, '2026-05-20'::date),
  ('2026-05-29'::date, '2026-06-17'::date),
  ('2026-06-26'::date, '2026-07-15'::date),
  ('2026-07-31'::date, '2026-08-19'::date),
  ('2026-08-14'::date, '2026-09-02'::date),
  ('2026-08-28'::date, '2026-09-16'::date),
  ('2026-09-18'::date, '2026-10-07'::date),
  ('2026-10-02'::date, '2026-10-21'::date),
  ('2026-10-16'::date, '2026-11-04'::date),
  ('2026-10-30'::date, '2026-11-18'::date),
  ('2026-11-13'::date, '2026-12-02'::date),
  ('2026-11-27'::date, '2026-12-16'::date)
), m as (
  insert into public.meetings (jurisdiction_id, body, event_type, event_date, event_time, location, note, status, source_url, verified_on)
  select 'kirkwood', 'planning_zoning', 'meeting', meeting, '19:00', 'Kirkwood City Hall, 139 S. Kirkwood Rd',
         case when extract(month from meeting) in (6, 7, 8) then 'Summer schedule (one meeting this month).' end,
         'published', 'https://www.kirkwoodmo.org/home/showpublisheddocument/16773/639014784400570000', date '2026-10-12'
  from sched
  returning id, event_date
)
insert into public.meetings (jurisdiction_id, body, event_type, event_date, location, note, status, source_url, verified_on, linked_meeting)
select 'kirkwood', 'planning_zoning', 'submittal_deadline', s.deadline, 'Kirkwood City Hall, 139 S. Kirkwood Rd',
       'Application deadline; feeds P&Z ' || s.meeting || '. A pre-application meeting with staff must come first.',
       'published', 'https://www.kirkwoodmo.org/home/showpublisheddocument/16773/639014784400570000', date '2026-10-12', m.id
from sched s join m on m.event_date = s.meeting;
