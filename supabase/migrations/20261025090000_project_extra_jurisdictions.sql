-- Suggestion #15 (Oct 21): a project can sit in more than one municipality. projects.jurisdiction_id stays the lead
-- municipality (it drives the timeline); project_jurisdictions holds the others.
-- No foreign key to jurisdictions: with one, PostgREST sees a second projects→jurisdictions path and every existing
-- `jurisdictions(name)` embed on projects fails as ambiguous (it took the projects list down for a few minutes).
create table if not exists public.project_jurisdictions (
  project_id bigint not null references public.projects(id) on delete cascade,
  jurisdiction_id text not null,
  created_at timestamptz not null default now(),
  primary key (project_id, jurisdiction_id)
);
alter table public.project_jurisdictions enable row level security;
drop policy if exists "team_all_project_jurisdictions" on public.project_jurisdictions;
create policy "team_all_project_jurisdictions" on public.project_jurisdictions for all to authenticated using (true) with check (true);
-- TEMPORARY while login is off; drop when sign-in returns.
drop policy if exists "public_all_project_jurisdictions" on public.project_jurisdictions;
create policy "public_all_project_jurisdictions" on public.project_jurisdictions for all to anon using (true) with check (true);

-- Case numbers are now looked for in every municipality on the project, not only the lead one.
create or replace view public.project_case_events with (security_invoker = true) as
with nums as (
  select p.id as project_id, p.jurisdiction_id,
         array(select p.jurisdiction_id union select pj.jurisdiction_id from public.project_jurisdictions pj where pj.project_id = p.id) as places,
         public.case_key(n) as k
  from public.projects p, regexp_split_to_table(coalesce(p.case_numbers, ''), '[,;]') as n
  where public.case_key(n) <> ''
)
select n.project_id, c.meeting_id, c.jurisdiction_id, c.body, c.event_date, 'agenda'::text as kind, c.item, c.case_number
from nums n join public.land_use_cases c
  on (n.jurisdiction_id is null or c.jurisdiction_id = any(n.places))
 and public.case_key(c.case_number) ~ ('(^|[^0-9])' || n.k || '($|[^0-9])')
union all
select n.project_id, m.id, m.jurisdiction_id, m.body, m.event_date, v.x->>'result', v.x->>'item', v.x->>'case_number'
from nums n join public.meetings m on (n.jurisdiction_id is null or m.jurisdiction_id = any(n.places))
cross join lateral jsonb_array_elements(case when jsonb_typeof(m.votes->'votes') = 'array' then m.votes->'votes' else '[]'::jsonb end) as v(x)
where public.case_key(v.x->>'case_number') ~ ('(^|[^0-9])' || n.k || '($|[^0-9])');
grant select on public.project_case_events to anon, authenticated;
alter table public.project_jurisdictions drop constraint if exists project_jurisdictions_jurisdiction_id_fkey;
notify pgrst, 'reload schema';
