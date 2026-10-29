-- Suggestions #38 and #39 (Oct 29): project alerts for new agendas and minutes.
-- 'agenda_posted': an agenda was read for an upcoming meeting in a municipality with an open project. One alert per
--   meeting (project_id null, since a city can hold several projects); the body names the projects and any agenda
--   item within NEAR_M meters of one.
-- 'minutes_posted': minutes were read for a meeting whose agenda had the project's case (case number, or an item
--   within NEAR_M meters of the project). One alert per project and meeting.
-- check_meeting_alerts() runs hourly at :52 (after extract-agendas at :30 and extract-votes at :45) and only looks
-- at reads from the last two days, so the backlog is never alerted. The insert trigger emails them like the others.

alter table public.project_alerts alter column project_id drop not null;
create unique index if not exists project_alerts_agenda_once on public.project_alerts (meeting_id)
  where kind = 'agenda_posted';

-- Rough distance in meters (fine at city scale; no PostGIS here).
create or replace function public.approx_meters(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns float8
language sql immutable as $$
  select 111320 * sqrt(power(lat2 - lat1, 2) + power((lng2 - lng1) * cos(radians((lat1 + lat2) / 2)), 2))
$$;

create or replace function public.check_meeting_alerts() returns int
language plpgsql security definer set search_path = public as $$
declare
  near_m constant int := 200;
  added int;
  total int := 0;
begin
  -- New agendas in project municipalities.
  with m as (
    select m.id, m.jurisdiction_id, m.body, m.event_date,
           regexp_replace(j.name, '^(City|Village|Town|Township) of ', '') as place
    from meetings m join jurisdictions j on j.id = m.jurisdiction_id
    where m.agenda_read_at > now() - interval '2 days' and m.event_date >= current_date
      and exists (select 1 from projects p where p.jurisdiction_id = m.jurisdiction_id and p.stage <> 'closed')
  ), near as (
    select c.meeting_id, string_agg(distinct format('%s (about %s m from %s)', coalesce(nullif(c.address, ''), c.item),
             round(approx_meters(c.lat, c.lng, p.lat, p.lng) / 10) * 10, p.name), '; ') as hits
    from land_use_cases c join m on m.id = c.meeting_id
    join projects p on p.jurisdiction_id = m.jurisdiction_id and p.stage <> 'closed' and p.lat is not null
    where c.lat is not null and approx_meters(c.lat, c.lng, p.lat, p.lng) <= near_m
    group by c.meeting_id
  )
  insert into project_alerts (project_id, kind, meeting_id, step, title, body)
  select null, 'agenda_posted', m.id, case when m.body = 'planning_zoning' then 'pz' else 'council' end,
         format('%s %s agenda posted (%s)', m.place, case when m.body = 'planning_zoning' then 'P&Z' else 'council' end,
                to_char(m.event_date, 'FMMon FMDD')),
         concat_ws(' ',
           (select case count(*) when 0 then 'No land-use items.' when 1 then '1 land-use item.' else count(*) || ' land-use items.' end
              from land_use_cases c where c.meeting_id = m.id),
           'Projects here: ' || (select string_agg(p.name, ', ' order by p.name) from projects p
                                 where p.jurisdiction_id = m.jurisdiction_id and p.stage <> 'closed') || '.',
           'Near a project: ' || n.hits || '.')
  from m left join near n on n.meeting_id = m.id
  on conflict do nothing;
  get diagnostics added = row_count;
  total := total + added;

  -- Minutes for meetings that had a project's case.
  with hit as (
    select e.project_id, e.meeting_id from project_case_events e where e.kind = 'agenda'
    union
    select p.id, c.meeting_id from land_use_cases c
    join projects p on p.jurisdiction_id = c.jurisdiction_id and p.lat is not null
    where c.lat is not null and approx_meters(c.lat, c.lng, p.lat, p.lng) <= near_m
  )
  insert into project_alerts (project_id, kind, meeting_id, step, title, body)
  select p.id, 'minutes_posted', m.id, case when m.body = 'planning_zoning' then 'pz' else 'council' end,
         format('%s: %s minutes posted (%s)', p.name, case when m.body = 'planning_zoning' then 'P&Z' else 'council' end,
                to_char(m.event_date, 'FMMon FMDD')),
         format('The minutes for the %s meeting are posted; its agenda had this project''s case or an item at this site.',
                to_char(m.event_date, 'FMMon FMDD'))
  from hit h join projects p on p.id = h.project_id and p.stage <> 'closed'
  join meetings m on m.id = h.meeting_id
  where m.minutes_read_at > now() - interval '2 days'
  on conflict do nothing;
  get diagnostics added = row_count;
  return total + added;
end $$;
revoke execute on function public.check_meeting_alerts() from anon, authenticated, public;

select cron.schedule('check-meeting-alerts', '52 * * * *', $$ select public.check_meeting_alerts(); $$);
