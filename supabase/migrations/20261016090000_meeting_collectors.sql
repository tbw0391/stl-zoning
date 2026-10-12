-- Automated meeting collectors (scripts/collectors/*.py, run daily by the collect-meetings edge function).

alter table public.jurisdictions
  add column collector text check (collector in ('agendacenter','civicclerk')),
  add column collector_ref text,          -- AgendaCenter site address, or CivicClerk tenant name
  add column collected_on timestamptz;

-- One row per jurisdiction per run: what was found and anything that looks off.
create table public.collector_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  jurisdiction_id text not null references public.jurisdictions(id) on delete cascade,
  ok boolean not null,
  found int not null default 0,
  inserted int not null default 0,
  updated int not null default 0,
  missing jsonb,                          -- [{event_date, body}] in our data but not in the city's system
  error text
);
create index collector_runs_j_idx on public.collector_runs (jurisdiction_id, ran_at desc);
alter table public.collector_runs enable row level security;
create policy "public_read_collector_runs" on public.collector_runs for select to anon using (true);

update public.jurisdictions set collector = 'agendacenter', collector_ref = 'https://www.sccmo.org' where id = 'stcharles_county';
update public.jurisdictions set collector = 'agendacenter', collector_ref = 'https://www.lakesaintlouis.com' where id = 'lake_st_louis';
update public.jurisdictions set collector = 'civicclerk', collector_ref = 'stpetersmo' where id = 'stpeters';

-- First automated jurisdictions outside St. Charles County (found by the Oct 12 platform survey).
insert into public.jurisdictions (id, name, kind, county, governing_body, website, research_status, collector, collector_ref) values
  ('st_clair', 'City of St. Clair', 'city', 'Franklin', 'Board of Aldermen', 'https://saintclairmo.portal.civicclerk.com', 'partial', 'civicclerk', 'saintclairmo'),
  ('de_soto', 'City of De Soto', 'city', 'Jefferson', 'City Council', 'http://www.desotomo.com/', 'partial', 'civicclerk', 'desotomo'),
  ('festus', 'City of Festus', 'city', 'Jefferson', 'City Council', 'http://www.cityoffestus.org/', 'partial', 'civicclerk', 'festusmo'),
  ('herculaneum', 'City of Herculaneum', 'city', 'Jefferson', 'Board of Aldermen', 'http://www.cityofherculaneum.org', 'partial', 'civicclerk', 'herculaneummo'),
  ('jefferson_county', 'Jefferson County (Unincorporated)', 'county', 'Jefferson', 'County Council', 'https://jeffersoncomo.portal.civicclerk.com', 'partial', 'civicclerk', 'jeffersoncomo'),
  ('black_jack', 'City of Black Jack', 'city', 'St. Louis', 'City Council', 'https://www.cityofblackjack.com', 'partial', 'agendacenter', 'https://www.cityofblackjack.com'),
  ('brentwood', 'City of Brentwood', 'city', 'St. Louis', 'Board of Aldermen', 'https://www.brentwoodmo.org', 'partial', 'agendacenter', 'https://www.brentwoodmo.org'),
  ('bridgeton', 'City of Bridgeton', 'city', 'St. Louis', 'City Council', 'https://www.bridgetonmo.com', 'partial', 'agendacenter', 'https://www.bridgetonmo.com'),
  ('chesterfield', 'City of Chesterfield', 'city', 'St. Louis', 'City Council', 'https://www.chesterfield.mo.us/', 'partial', 'civicclerk', 'chesterfieldmo'),
  ('creve_coeur', 'City of Creve Coeur', 'city', 'St. Louis', 'City Council', 'http://www.creve-coeur.org', 'partial', 'civicclerk', 'crevecoeurmo'),
  ('ellisville', 'City of Ellisville', 'city', 'St. Louis', 'City Council', 'https://www.ellisville.mo.us', 'partial', 'agendacenter', 'https://www.ellisville.mo.us'),
  ('eureka', 'City of Eureka', 'city', 'St. Louis', 'Board of Aldermen', 'https://www.eureka.mo.us', 'partial', 'agendacenter', 'https://www.eureka.mo.us'),
  ('fenton', 'City of Fenton', 'city', 'St. Louis', 'Board of Aldermen', 'http://www.fentonmo.org', 'partial', 'agendacenter', 'http://www.fentonmo.org'),
  ('ferguson', 'City of Ferguson', 'city', 'St. Louis', 'City Council', 'http://www.fergusoncity.com', 'partial', 'agendacenter', 'http://www.fergusoncity.com'),
  ('hazelwood', 'City of Hazelwood', 'city', 'St. Louis', 'City Council', 'http://www.hazelwoodmo.org', 'partial', 'civicclerk', 'hazelwoodmo'),
  ('jennings', 'City of Jennings', 'city', 'St. Louis', 'City Council', 'https://www.cityofjennings.org', 'partial', 'agendacenter', 'https://www.cityofjennings.org'),
  ('manchester', 'City of Manchester', 'city', 'St. Louis', 'Board of Aldermen', 'https://www.manchestermo.gov', 'partial', 'agendacenter', 'https://www.manchestermo.gov'),
  ('olivette', 'City of Olivette', 'city', 'St. Louis', 'City Council', 'https://www.olivettemo.com', 'partial', 'agendacenter', 'https://www.olivettemo.com'),
  ('overland', 'City of Overland', 'city', 'St. Louis', 'City Council', 'http://www.overlandmo.org', 'partial', 'agendacenter', 'http://www.overlandmo.org'),
  ('sunset_hills', 'City of Sunset Hills', 'city', 'St. Louis', 'Board of Aldermen', 'https://www.sunset-hills.com', 'partial', 'agendacenter', 'https://www.sunset-hills.com'),
  ('town_and_country', 'City of Town and Country', 'city', 'St. Louis', 'Board of Aldermen', 'https://www.town-and-country.org', 'partial', 'agendacenter', 'https://www.town-and-country.org'),
  ('valley_park', 'City of Valley Park', 'city', 'St. Louis', 'Board of Aldermen', 'https://www.valleyparkmo.org', 'partial', 'agendacenter', 'https://www.valleyparkmo.org'),
  ('webster_groves', 'City of Webster Groves', 'city', 'St. Louis', 'City Council', 'https://www.webstergrovesmo.gov', 'partial', 'agendacenter', 'https://www.webstergrovesmo.gov'),
  ('wildwood', 'City of Wildwood', 'city', 'St. Louis', 'City Council', 'https://www.cityofwildwood.com', 'partial', 'agendacenter', 'https://www.cityofwildwood.com');

insert into public.jurisdiction_progress (jurisdiction_id, task, status, note, updated_on)
select j.id, t.task,
       case when t.task = 'schedule' then 'in_progress' else 'not_started' end,
       case when t.task = 'schedule' then 'Meetings collected automatically; no yearly schedule or submittal deadlines yet' end,
       current_date
from public.jurisdictions j
cross join (values ('rezoning'), ('schedule'), ('people'), ('districts')) as t(task)
where j.id in ('wildwood', 'jennings', 'webster_groves', 'olivette', 'eureka', 'sunset_hills', 'brentwood', 'valley_park', 'town_and_country', 'bridgeton', 'overland', 'fenton', 'manchester', 'ellisville', 'ferguson', 'black_jack', 'chesterfield', 'creve_coeur', 'de_soto', 'festus', 'hazelwood', 'herculaneum', 'st_clair', 'jefferson_county')
on conflict do nothing;

-- Daily at 10:00 UTC (5 AM Central in daylight time, 4 AM in standard time).
select cron.schedule('collect-meetings', '0 10 * * *', $cron$
  select net.http_post(
    url := 'https://zjveevfcsqkdgenrrrcv.supabase.co/functions/v1/collect-meetings',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-digest-token', (select value from public.app_settings where key = 'digest_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
$cron$);
