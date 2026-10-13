-- One-off site flags the web app reads and sets (app_settings holds the cron token and stays private).
-- followed_reviewed: set the first time someone saves the follow checklist on /jurisdictions; until then the
-- calendar page shows a banner asking the team to untick the jurisdictions they don't need.
create table if not exists public.site_flags (
  key text primary key,
  set_at timestamptz not null default now()
);
alter table public.site_flags enable row level security;
drop policy if exists "public_read_site_flags" on public.site_flags;
create policy "public_read_site_flags" on public.site_flags for select to anon using (true);
drop policy if exists "public_insert_site_flags" on public.site_flags;
create policy "public_insert_site_flags" on public.site_flags for insert to anon with check (true);
drop policy if exists "public_update_site_flags" on public.site_flags;
create policy "public_update_site_flags" on public.site_flags for update to anon using (true) with check (true);
grant select, insert, update on public.site_flags to anon;
