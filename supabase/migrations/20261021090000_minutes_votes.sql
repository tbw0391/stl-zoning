-- Votes from meeting minutes: the collectors fill minutes_url, and extract-votes has Claude read the minutes of
-- meetings with land-use items and store how each item was decided and, when the minutes name them, each member's vote.

alter table public.meetings
  add column if not exists minutes_url text,
  add column if not exists minutes_checked_on date,      -- set once read (or found unreadable), so it isn't retried
  add column if not exists minutes_read_at timestamptz,
  add column if not exists votes jsonb;                  -- {present: [names], votes: [{item, case_number, motion, result, ayes, nays, ...}]}

-- Hourly at :45, after the agenda reader (:30).
select cron.schedule('extract-votes', '45 * * * *', $$
  select net.http_post(
    url := 'https://zjveevfcsqkdgenrrrcv.supabase.co/functions/v1/extract-votes',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-digest-token', (select value from public.app_settings where key = 'digest_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000);
$$);
