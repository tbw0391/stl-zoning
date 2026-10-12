-- Meeting edit forms (/meetings/[id]/edit, /meetings/new): anyone with the URL can add and edit meetings,
-- same as people. Meetings are never deleted from the site; a meeting that won't happen is set to cancelled.
create policy "public_insert_meetings" on public.meetings for insert to anon with check (true);
create policy "public_update_meetings" on public.meetings for update to anon using (true) with check (true);
