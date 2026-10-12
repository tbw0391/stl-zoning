-- Read new agendas with Claude every hour at :30 (extract-agendas edge function; needs the ANTHROPIC_API_KEY secret).
-- Runs with nothing to read make no API calls.
select cron.schedule('extract-agendas', '30 * * * *', $cron$
  select net.http_post(
    url := 'https://zjveevfcsqkdgenrrrcv.supabase.co/functions/v1/extract-agendas',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-digest-token', (select value from public.app_settings where key = 'digest_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
$cron$);
