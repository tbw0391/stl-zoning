-- Stage history for the projects dashboard (#24, Oct 14). A trigger logs every stage a project enters, whatever
-- path writes it (web form, SQL, future imports). Existing projects get one baseline row at their current stage,
-- dated now: earlier changes weren't recorded.
create table if not exists public.project_stage_changes (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_at timestamptz not null default now(),
  baseline boolean not null default false
);
create index if not exists project_stage_changes_project on public.project_stage_changes (project_id, changed_at);

create or replace function public.log_project_stage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into public.project_stage_changes (project_id, from_stage, to_stage)
    values (new.id, case when tg_op = 'UPDATE' then old.stage end, new.stage);
  end if;
  return new;
end $$;

drop trigger if exists projects_log_stage on public.projects;
create trigger projects_log_stage after insert or update of stage on public.projects
  for each row execute function public.log_project_stage();

insert into public.project_stage_changes (project_id, to_stage, baseline)
select p.id, p.stage, true from public.projects p
where not exists (select 1 from public.project_stage_changes c where c.project_id = p.id);

alter table public.project_stage_changes enable row level security;
drop policy if exists "public_read_project_stage_changes" on public.project_stage_changes;
create policy "public_read_project_stage_changes" on public.project_stage_changes for select to anon, authenticated using (true);
grant select on public.project_stage_changes to anon, authenticated;
