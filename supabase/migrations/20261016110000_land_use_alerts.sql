-- Alerts for new land-use cases: geocoded projects, saved watches, and one row per case read from agendas.

alter table public.projects
  add column lat double precision,
  add column lng double precision;

-- When extract-agendas read the agenda (agenda_checked_on is only a date). Drives "new since you last looked".
alter table public.meetings add column agenda_read_at timestamptz;
update public.meetings set agenda_read_at = agenda_checked_on::timestamptz
  where agenda_checked_on is not null and agenda_items is not null;

-- A watch is a radius around a project, and/or a set of counties or jurisdictions, for some case types.
create table public.watches (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) > 0),
  project_id bigint references public.projects(id) on delete cascade,
  radius_miles numeric not null default 3 check (radius_miles > 0 and radius_miles <= 50),
  counties text[],                 -- e.g. {St. Charles}; null = any
  jurisdiction_ids text[],         -- null = any
  types text[],                    -- extract-agendas item types; null = rezonings, PUDs, special uses, annexations
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.watches enable row level security;
create policy "public_all_watches" on public.watches for all to anon using (true) with check (true);
create policy "team_all_watches" on public.watches for all to authenticated using (true) with check (true);

-- Every land-use item from every read agenda, flattened. lat/lng come from extract-agendas' geocoding.
create view public.land_use_cases with (security_invoker = true) as
select m.id as meeting_id, (it.ord - 1)::int as idx, m.jurisdiction_id, j.name as jurisdiction_name, j.county,
       m.body, m.event_date, m.agenda_url, m.agenda_read_at,
       it.v->>'type' as type, it.v->>'item' as item, it.v->>'request' as request, it.v->>'address' as address,
       it.v->>'applicant' as applicant, it.v->>'case_number' as case_number,
       it.v->>'from_zoning' as from_zoning, it.v->>'to_zoning' as to_zoning,
       (it.v->>'acres')::numeric as acres, (it.v->>'units')::int as units,
       (it.v->>'lat')::double precision as lat, (it.v->>'lng')::double precision as lng
from public.meetings m
join public.jurisdictions j on j.id = m.jurisdiction_id
cross join lateral jsonb_array_elements(m.agenda_items) with ordinality as it(v, ord)
where m.agenda_items is not null and jsonb_typeof(m.agenda_items) = 'array';
grant select on public.land_use_cases to anon, authenticated;
