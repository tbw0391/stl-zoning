-- Followed jurisdictions: switching one off hides it from the calendar, meetings, rezonings, votes, alerts,
-- directory, progress and the digest, and the background jobs (collect-meetings, extract-agendas, extract-votes,
-- check-sources) skip it. Nothing is deleted; switching it back on picks up where it left off.
alter table public.jurisdictions add column if not exists followed boolean not null default true;

-- Anyone with the URL can flip the switch (same open editing as progress), but only that column.
revoke update on public.jurisdictions from anon;
grant update (followed) on public.jurisdictions to anon;
drop policy if exists "public_update_jurisdictions_followed" on public.jurisdictions;
create policy "public_update_jurisdictions_followed" on public.jurisdictions for update to anon using (true) with check (true);
