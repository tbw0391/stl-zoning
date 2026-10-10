-- Shared to-do list, fed by the "Suggest" button in the app header.
create table public.todos (
  id bigint generated always as identity primary key,
  body text not null check (length(trim(body)) > 0),
  page text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_by_email text,
  created_at timestamptz default now(),
  done_at timestamptz
);
create index todos_created_by_idx on public.todos (created_by);

alter table public.todos enable row level security;
create policy "team_all_todos" on public.todos for all to authenticated using (true) with check (true);
