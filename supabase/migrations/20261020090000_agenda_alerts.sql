-- Agenda alert emails: when a new or revised agenda has land-use items matching a watch, extract-agendas emails
-- the digest list (DIGEST_TO). Revised agendas are found by re-fetching upcoming agendas and comparing a hash.

alter table public.meetings
  add column agenda_hash text,                 -- sha-256 of the agenda file (PDF bytes, or the text of an HTML agenda)
  add column agenda_rechecked_at timestamptz,  -- last time the posted agenda was re-fetched to look for a revision
  add column agenda_revised_at timestamptz,    -- when a revision was found and re-read
  add column agenda_previous_items jsonb,      -- agenda_items before the latest revision, for "added / removed"
  add column agenda_alerted_at timestamptz;    -- when the current read was checked against watches (and emailed if it matched)

-- Agendas already read are treated as alerted, so turning this on doesn't email the backlog.
update public.meetings set agenda_alerted_at = now()
  where agenda_read_at is not null and agenda_alerted_at is null;

alter table public.digest_log add column kind text not null default 'digest';  -- 'digest' or 'agenda_alert'

-- Re-fetch upcoming agendas twice a day (6 AM and 4 PM Central in daylight time) to catch revisions.
select cron.schedule('recheck-agendas', '15 11,21 * * *', $$
  select net.http_post(
    url := 'https://zjveevfcsqkdgenrrrcv.supabase.co/functions/v1/extract-agendas?recheck=1',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-digest-token', (select value from public.app_settings where key = 'digest_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000);
$$);
