-- Delay follow-ups (Oct 15).
-- 1. Project alerts are emailed to the team (DIGEST_TO) as soon as they're posted: an insert trigger calls the
--    project-alerts edge function, and an hourly sweep retries anything not yet emailed.
-- 2. Projects get city case number(s). check_project_delays() (hourly at :50, after extract-agendas at :30 and
--    extract-votes at :45) posts a 'possible_delay' alert when minutes show the case continued or tabled, or when
--    the case comes back on a later P&Z agenda. The project page offers "Log as delay" or "Not a delay" (resolved_at).

alter table public.projects add column if not exists case_numbers text;  -- comma-separated, as the city writes them

alter table public.project_alerts
  add column if not exists meeting_id bigint references public.meetings(id) on delete set null,  -- possible_delay: where it was seen
  add column if not exists step text check (step in ('pz', 'council')),
  add column if not exists emailed_at timestamptz,
  add column if not exists resolved_at timestamptz;  -- possible_delay: logged as a delay or dismissed
update public.project_alerts set emailed_at = created_at where emailed_at is null;
create unique index if not exists project_alerts_seen_once on public.project_alerts (project_id, kind, meeting_id)
  where meeting_id is not null;

-- Agenda appearances and minutes results for each project's case numbers (same city when the project has one).
-- Case numbers are compared without spaces or punctuation other than '-', and match inside a longer number field
-- ("P.Z. 10-25 and 11-25" matches "PZ 10-25"), but not as part of a longer number ("10-251").
create or replace function public.case_key(t text) returns text language sql immutable as
  $$ select regexp_replace(upper(coalesce(t, '')), '[^A-Z0-9-]', '', 'g') $$;
create or replace view public.project_case_events with (security_invoker = true) as
with nums as (
  select p.id as project_id, p.jurisdiction_id, public.case_key(n) as k
  from public.projects p, regexp_split_to_table(coalesce(p.case_numbers, ''), '[,;]') as n
  where public.case_key(n) <> ''
)
select n.project_id, c.meeting_id, c.jurisdiction_id, c.body, c.event_date, 'agenda'::text as kind, c.item, c.case_number
from nums n join public.land_use_cases c
  on (n.jurisdiction_id is null or c.jurisdiction_id = n.jurisdiction_id)
 and public.case_key(c.case_number) ~ ('(^|[^0-9])' || n.k || '($|[^0-9])')
union all
select n.project_id, m.id, m.jurisdiction_id, m.body, m.event_date, v.x->>'result', v.x->>'item', v.x->>'case_number'
from nums n join public.meetings m on (n.jurisdiction_id is null or m.jurisdiction_id = n.jurisdiction_id)
cross join lateral jsonb_array_elements(case when jsonb_typeof(m.votes->'votes') = 'array' then m.votes->'votes' else '[]'::jsonb end) as v(x)
where public.case_key(v.x->>'case_number') ~ ('(^|[^0-9])' || n.k || '($|[^0-9])');
grant select on public.project_case_events to anon, authenticated;

-- Looks back RECENT days so entering a case number for an old case doesn't flood the team with history.
create or replace function public.check_project_delays(only_project bigint default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  recent constant int := 45;
  added int;
begin
  with ev as (
    select e.*, p.name,
           lag(e.event_date) over (partition by e.project_id, e.body order by e.event_date) as prev_date
    from (select distinct project_id, meeting_id, body, event_date, kind from project_case_events where kind = 'agenda') e
    join projects p on p.id = e.project_id
    where (only_project is null or e.project_id = only_project)
  ), found as (
    -- Back on a later P&Z agenda: it wasn't decided at the earlier one.
    select project_id, meeting_id, 'pz' as step,
           name || ': case back on the P&Z agenda' as title,
           format('On the P&Z agenda for %s after being on the one for %s, so it was likely continued. If the schedule moved, log it as a delay on the project.',
                  to_char(event_date, 'FMMon FMDD'), to_char(prev_date, 'FMMon FMDD')) as body
    from ev where body = 'planning_zoning' and prev_date is not null and event_date >= current_date - recent
    union all
    -- Minutes say continued or tabled.
    select e.project_id, e.meeting_id, case when e.body = 'planning_zoning' then 'pz' else 'council' end,
           p.name || ': case ' || e.kind || case when e.body = 'planning_zoning' then ' at P&Z' else ' by council' end,
           format('Minutes for %s show the case %s. If the schedule moved, log it as a delay on the project.',
                  to_char(e.event_date, 'FMMon FMDD'), e.kind)
    from project_case_events e join projects p on p.id = e.project_id
    where e.kind in ('continued', 'tabled') and e.event_date >= current_date - recent
      and (only_project is null or e.project_id = only_project)
  )
  insert into project_alerts (project_id, kind, meeting_id, step, title, body)
  select distinct on (project_id, meeting_id) project_id, 'possible_delay', meeting_id, step, title, body from found
  order by project_id, meeting_id
  on conflict do nothing;
  get diagnostics added = row_count;
  return added;
end $$;
grant execute on function public.check_project_delays(bigint) to anon, authenticated;

-- Email new alerts right away (the function sends everything not yet emailed, so a burst goes out together).
create or replace function public.email_project_alerts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from new_rows) then return null; end if;
  perform net.http_post(
    url := 'https://zjveevfcsqkdgenrrrcv.supabase.co/functions/v1/project-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-digest-token', (select value from public.app_settings where key = 'digest_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
  return null;
end $$;
drop trigger if exists project_alerts_email on public.project_alerts;
create trigger project_alerts_email after insert on public.project_alerts
  referencing new table as new_rows for each statement execute function public.email_project_alerts();

select cron.schedule('check-project-delays', '50 * * * *', $$ select public.check_project_delays(); $$);
select cron.schedule('email-project-alerts', '55 * * * *', $$
  select net.http_post(
    url := 'https://zjveevfcsqkdgenrrrcv.supabase.co/functions/v1/project-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-digest-token', (select value from public.app_settings where key = 'digest_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
$$);
