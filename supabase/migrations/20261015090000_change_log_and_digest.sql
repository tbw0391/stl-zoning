-- Change log for the weekly email digest, plus the schedule that sends it.

create table public.change_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  table_name text not null,
  row_id bigint not null,
  action text not null check (action in ('insert','update','delete')),
  old_row jsonb,
  new_row jsonb
);
create index change_log_at_idx on public.change_log (at desc);
alter table public.change_log enable row level security;  -- only the digest function (service role) reads it

-- Logs inserts and deletes, and updates only when a field people care about changed,
-- so re-running the data loaders doesn't flood the digest.
create function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  watched text[] := tg_argv;
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  f text;
  changed boolean := false;
begin
  if tg_op = 'UPDATE' then
    foreach f in array watched loop
      if (o -> f) is distinct from (n -> f) then changed := true; end if;
    end loop;
    if not changed then return new; end if;
  end if;
  insert into public.change_log (table_name, row_id, action, old_row, new_row)
  values (tg_table_name, coalesce((n ->> 'id'), (o ->> 'id'))::bigint, lower(tg_op), o, n);
  return coalesce(new, old);
end $$;

create trigger meetings_log after insert or update or delete on public.meetings
  for each row execute function public.log_change('event_date','event_time','status','location');
create trigger projects_log after insert or update or delete on public.projects
  for each row execute function public.log_change('stage','name');
create trigger tasks_log after insert or update or delete on public.tasks
  for each row execute function public.log_change('done_at','assigned_to','due_date');

-- Private settings the digest function and cron job share (no RLS policies = not readable from the site).
create table public.app_settings (key text primary key, value text not null);
alter table public.app_settings enable row level security;
insert into public.app_settings (key, value)
values ('digest_token', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));

create table public.digest_log (
  id bigint generated always as identity primary key,
  sent_at timestamptz not null default now(),
  recipients text not null,
  resend_id text,
  error text
);
alter table public.digest_log enable row level security;

-- Weekly send: Mondays 12:00 UTC (7 AM Central in daylight time, 6 AM in standard time).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('weekly-digest', '0 12 * * 1', $cron$
  select net.http_post(
    url := 'https://zjveevfcsqkdgenrrrcv.supabase.co/functions/v1/weekly-digest',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-digest-token', (select value from public.app_settings where key = 'digest_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$cron$);
