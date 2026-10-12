-- Weekly source check: the check-sources edge function fetches each watched schedule page or PDF and flags changes
-- (new or removed document links, changed files, pages that start failing) for a person to review on /sources.
create table public.source_watches (
  id bigint generated always as identity primary key,
  jurisdiction_id text not null references public.jurisdictions(id),
  url text not null unique,
  label text not null,
  last_status int,
  last_hash text,                -- sha-256 of the file, or of a page's visible text
  last_links jsonb,              -- a page's document links [{url, text}]
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  change_summary text,
  reviewed_at timestamptz
);

alter table public.source_watches enable row level security;
create policy "team_all_source_watches" on public.source_watches for all to authenticated using (true) with check (true);
create policy "public_read_source_watches" on public.source_watches for select to anon using (true);
-- "Reviewed" on /sources sets reviewed_at.
create policy "public_update_source_watches" on public.source_watches for update to anon using (true) with check (true);

-- source_checks (unused until now) becomes the per-check log.
alter table public.source_checks add column watch_id bigint references public.source_watches(id);
alter table public.source_checks add column http_status int;

-- Jurisdictions without a daily collector, plus schedule files the collectors don't cover.
insert into public.source_watches (jurisdiction_id, url, label) values
  ('cottleville', 'https://www.cityofcottleville.com/government/boards-agendas-minutes/', 'Boards, agendas & schedules page'),
  ('cottleville', 'https://www.cityofcottleville.com/wp-content/uploads/2026/07/PZ-Schedule-2026-2.pdf', '2026 P&Z schedule (revised Jul 2026)'),
  ('dardenne_prairie', 'https://www.dardenneprairie.gov/government/boards_commissions/planning___zoning_commission_.php', 'P&Z page'),
  ('foristell', 'https://www.cityofforistell.org/meeting-agendas-minutes', 'Agendas & minutes page'),
  ('kirkwood', 'https://www.kirkwoodmo.org/home/showpublisheddocument/16773/639014784400570000', '2026 P&Z schedule'),
  ('lake_st_louis', 'https://www.lakesaintlouis.com/1291/Planning-Zoning-Commission', 'P&Z page (schedule table)'),
  ('new_melle', 'https://www.cityofnewmelle.com/planning-and-zoning-commission', 'P&Z page'),
  ('new_melle', 'https://www.cityofnewmelle.com/_files/ugd/9d38ad_16a245ef4cc8442999bcb52c3550a92a.pdf', '2025-2027 rezoning submission schedule'),
  ('ofallon', 'https://ofallon.mo.us/planning-and-zoning-commission', 'P&Z page'),
  ('stcharles_city', 'https://www.stcharlescitymo.gov/327/Planning-Zoning-Commission', 'P&Z page'),
  ('stcharles_city', 'https://www.stcharlescitymo.gov/DocumentCenter/View/14267', '2026 P&Z schedule'),
  ('stcharles_county', 'https://www.sccmo.org/582/Planning-Zoning-Commission', 'P&Z page (2026 schedule not posted yet)'),
  ('stpeters', 'https://www.stpetersmo.net/DocumentCenter/View/444/Development-Guide-and-Planning--Zoning-SubmittalMeeting-Schedule-PDF', 'Development Guide & P&Z schedule'),
  ('weldon_spring', 'https://www.weldonspring.gov/plancommission', 'Planning Commission page'),
  ('wentzville', 'https://www.wentzvillemo.gov/departments/community-development/planning-zoning-division/brochures-applications-meetings/', 'Brochures, applications & meetings page'),
  ('wentzville', 'https://www.wentzvillemo.gov/wp-content/uploads/2026/08/PZ-2026-Schedule-PZ-2026-Schedule-Revised-Website.pdf', '2026 P&Z schedule (revised Aug 2026)');

-- Mondays 11:00 UTC (6 AM Central), an hour before the weekly digest.
select cron.schedule('check-sources', '0 11 * * 1', $cron$
  select net.http_post(
    url := 'https://zjveevfcsqkdgenrrrcv.supabase.co/functions/v1/check-sources',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-digest-token', (select value from public.app_settings where key = 'digest_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
$cron$);
