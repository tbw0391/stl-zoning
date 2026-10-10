-- Open editing (no login, same as todos): anyone with the URL can add and edit people and update progress.
-- People are never deleted from the site; "Remove" sets active = false so the row and its source stay on record.
create policy "public_insert_people" on public.people for insert to anon with check (true);
create policy "public_update_people" on public.people for update to anon using (true) with check (true);
create policy "public_update_jurisdiction_progress" on public.jurisdiction_progress for update to anon using (true) with check (true);
