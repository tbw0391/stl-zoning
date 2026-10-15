-- Timeline delays (Oct 15). A project gets a filing date, so its timeline is its own schedule rather than a what-if.
-- When the P&Z hearing or council vote is postponed, a project_delays row moves that step to a later meeting (or the
-- board's next one when the new date isn't known) and everything after it shifts. Each delay also posts a
-- project_alerts row, shown to the team as a banner and on /alerts until each browser dismisses it.

alter table public.projects add column if not exists filed_on date;  -- application filed (or planned filing date)

create table if not exists public.project_delays (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  step text not null check (step in ('pz', 'council')),            -- which step was postponed
  from_date date,                                                  -- the date it was on when postponed
  to_meeting_id bigint references public.meetings(id) on delete set null,  -- null: the board's next meeting after from_date
  reason text,
  reported_by text,
  created_at timestamptz not null default now()
);
create index if not exists project_delays_project on public.project_delays (project_id, created_at);

create table if not exists public.project_alerts (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  kind text not null default 'delay',
  title text not null,
  body text,
  created_at timestamptz not null default now()
);
create index if not exists project_alerts_created on public.project_alerts (created_at desc);

-- Same access as the other project tables while the site has no logins.
alter table public.project_delays enable row level security;
alter table public.project_alerts enable row level security;
drop policy if exists "team_all_project_delays" on public.project_delays;
drop policy if exists "public_all_project_delays" on public.project_delays;
drop policy if exists "team_all_project_alerts" on public.project_alerts;
drop policy if exists "public_all_project_alerts" on public.project_alerts;
create policy "team_all_project_delays" on public.project_delays for all to authenticated using (true) with check (true);
create policy "public_all_project_delays" on public.project_delays for all to anon using (true) with check (true);
create policy "team_all_project_alerts" on public.project_alerts for all to authenticated using (true) with check (true);
create policy "public_all_project_alerts" on public.project_alerts for all to anon using (true) with check (true);
grant select, insert, update, delete on public.project_delays, public.project_alerts to anon, authenticated;
