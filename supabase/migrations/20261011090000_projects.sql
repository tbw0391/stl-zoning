-- Projects: notes, checklists (default template + custom items), and assignable tasks with follow-up dates.

create table public.projects (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) > 0),
  jurisdiction_id text references public.jurisdictions(id),
  address text,
  parcel_ids text,
  acreage numeric,
  current_zoning text,
  proposed_zoning text,
  stage text not null default 'prospect'
    check (stage in ('prospect','due_diligence','pre_application','submitted','pz_hearing',
                     'governing_body','approved','denied','withdrawn','on_hold','closed')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_jurisdiction_idx on public.projects (jurisdiction_id);

create table public.project_notes (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  author text,
  created_at timestamptz not null default now()
);
create index project_notes_project_idx on public.project_notes (project_id, created_at desc);

-- Default checklist items, copied into each new project.
create table public.checklist_templates (
  id bigint generated always as identity primary key,
  body text not null check (length(trim(body)) > 0),
  sort_order int not null default 0,
  active boolean not null default true
);

create table public.checklist_items (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  sort_order int not null default 0,
  from_template bigint references public.checklist_templates(id) on delete set null,
  done_at timestamptz
);
create index checklist_items_project_idx on public.checklist_items (project_id, sort_order);
create index checklist_items_template_idx on public.checklist_items (from_template);

create table public.tasks (
  id bigint generated always as identity primary key,
  project_id bigint references public.projects(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  assigned_to text,
  due_date date,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_due_idx on public.tasks (due_date) where done_at is null;

-- New projects start with the active default checklist.
create function public.copy_checklist_template() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.checklist_items (project_id, body, sort_order, from_template)
  select new.id, t.body, t.sort_order, t.id from public.checklist_templates t where t.active;
  return new;
end $$;
create trigger projects_copy_checklist after insert on public.projects
  for each row execute function public.copy_checklist_template();

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array['projects','project_notes','checklist_templates','checklist_items','tasks'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('create policy "team_all_%1$s" on public.%1$I for all to authenticated using (true) with check (true);', t);
    -- TEMPORARY while login is off; drop when sign-in returns.
    execute format('create policy "public_all_%1$s" on public.%1$I for all to anon using (true) with check (true);', t);
  end loop;
end $$;
