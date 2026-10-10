-- Per-jurisdiction progress on each research task, shown on /progress and updated as work finishes.
create table public.jurisdiction_progress (
  jurisdiction_id text not null references public.jurisdictions(id) on delete cascade,
  task text not null check (task in ('rezoning','schedule','people','districts')),
  status text not null default 'not_started' check (status in ('not_started','in_progress','done','blocked')),
  note text,
  updated_on date not null default current_date,
  primary key (jurisdiction_id, task)
);
alter table public.jurisdiction_progress enable row level security;
create policy "public_read_jurisdiction_progress" on public.jurisdiction_progress for select to anon using (true);
create policy "team_all_jurisdiction_progress" on public.jurisdiction_progress for all to authenticated using (true) with check (true);

-- St. Louis County is next after St. Charles County; its municipalities get added when that work starts.
insert into public.jurisdictions (id, name, kind, county, research_status, notes)
values ('stlouis_county', 'St. Louis County (Unincorporated)', 'county', 'St. Louis', 'not_started',
        'Placeholder. Work starts after St. Charles County; municipalities to be added then.')
on conflict (id) do nothing;

-- Every jurisdiction starts with all four tasks not started.
insert into public.jurisdiction_progress (jurisdiction_id, task)
select j.id, t.task from public.jurisdictions j
cross join (values ('rezoning'),('schedule'),('people'),('districts')) t(task)
on conflict do nothing;

-- Status as of Oct 12, 2026 (see docs/HANDOFF.md).
update public.jurisdiction_progress p set status = v.status, note = v.note, updated_on = '2026-10-12'
from (values
  ('stcharles_county','rezoning','done',null),
  ('stcharles_city','rezoning','done',null),
  ('stpeters','rezoning','done',null),
  ('ofallon','rezoning','done',null),
  ('wentzville','rezoning','done',null),
  ('lake_st_louis','rezoning','done',null),
  ('cottleville','rezoning','in_progress','Partial'),
  ('dardenne_prairie','rezoning','in_progress','Partial'),
  ('wentzville','schedule','done','Through Feb 2027'),
  ('cottleville','schedule','done','Through Dec 2026'),
  ('ofallon','schedule','in_progress','Meetings loaded through Jan 2027; deadlines projected until the city confirms'),
  ('dardenne_prairie','schedule','in_progress','Meeting pattern only'),
  ('weldon_spring','schedule','in_progress','Meeting pattern only'),
  ('wentzville','people','done','22 people'),
  ('weldon_spring_heights','rezoning','blocked','Needs phone call'),
  ('josephville','rezoning','blocked','Needs phone call')
) v(jurisdiction_id, task, status, note)
where p.jurisdiction_id = v.jurisdiction_id and p.task = v.task;
