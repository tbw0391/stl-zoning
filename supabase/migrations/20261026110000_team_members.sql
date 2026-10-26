-- Who may use the site once sign-in is required: a signed-in user counts only if listed here, so an account made any
-- other way (Supabase's open sign-up endpoint) sees nothing. One company (Lombardo) for now; `company` is where
-- public customers will be told apart later. Rows are added and removed by the `team` edge function (/team).
create table if not exists public.team_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company text not null default 'lombardo',
  added_at timestamptz not null default now()
);
alter table public.team_members enable row level security;

create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.team_members where user_id = auth.uid()) $$;
revoke execute on function public.is_team() from public, anon;
grant execute on function public.is_team() to authenticated;

drop policy if exists "team_read_team_members" on public.team_members;
create policy "team_read_team_members" on public.team_members for select to authenticated using (public.is_team());

-- The two accounts from the first magic-link login.
insert into public.team_members (user_id)
select id from auth.users where email in ('tbw0391@gmail.com', 'chad.wilson@kw.com')
on conflict do nothing;
