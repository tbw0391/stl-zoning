-- NOT APPLIED YET. Apply together with REQUIRE_SIGN_IN=1 on Vercel, once the team can sign in (see docs/HANDOFF.md,
-- "Sign-in"). Applying it alone empties every Lombardo page for anyone not signed in.
--
-- Every table's policies are replaced with two rules:
--   * public meeting data (what the open demo and /welcome show) stays readable without signing in;
--   * everything else, and every write, needs a signed-in user on the team list (public.is_team()).
-- Tables with no policies today (app_settings, change_log, digest_log, signups) stay service-role only.

do $$
declare
  r record;
  public_read text[] := array['jurisdictions', 'meetings', 'people', 'jurisdiction_progress', 'parcels',
                              'rezoning_processes', 'zoning_districts', 'collector_runs'];
  t text;
begin
  for t in
    select distinct tablename from pg_policies where schemaname = 'public' and tablename <> 'team_members'
  loop
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', r.policyname, t);
    end loop;
    execute format('create policy "team_all_%1$s" on public.%1$I for all to authenticated using (public.is_team()) with check (public.is_team())', t);
    if t = any(public_read) then
      execute format('create policy "public_read_%1$s" on public.%1$I for select to anon, authenticated using (true)', t);
    end if;
  end loop;
end $$;

-- Functions that run with owner rights: only the team (and the scheduled jobs, which run as the owner) may call them.
revoke execute on function public.check_project_delays(bigint) from public, anon;
revoke execute on function public.email_project_alerts() from public, anon;
