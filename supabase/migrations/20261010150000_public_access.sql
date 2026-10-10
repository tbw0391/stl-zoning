-- Login removed from the web app: anonymous visitors can read everything and manage the to-do list.
do $$
declare t text;
begin
  foreach t in array array['jurisdictions','rezoning_processes','meetings','people',
                           'zoning_districts','parcels','source_checks','todos'] loop
    execute format('create policy "public_read_%1$s" on public.%1$I for select to anon using (true);', t);
  end loop;
end $$;
create policy "public_insert_todos" on public.todos for insert to anon with check (created_by is null);
create policy "public_update_todos" on public.todos for update to anon using (true) with check (true);
