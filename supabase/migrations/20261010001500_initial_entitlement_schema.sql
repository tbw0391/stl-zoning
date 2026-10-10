-- Initial schema for the St. Charles County entitlement tracker.
-- Applied to Supabase project stl-zoning (zjveevfcsqkdgenrrrcv) on 2026-10-09.
-- Every fact row carries source_url + verified_on so the weekly checker can re-verify it.

create table public.jurisdictions (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('county','city','town','village')),
  county text not null default 'St. Charles',
  governing_body text,
  website text,
  code_url text,
  schedule_url text,
  agenda_url text,
  zoning_map_url text,
  notes text,
  research_status text not null default 'not_started'
    check (research_status in ('not_started','partial','complete','needs_phone_call'))
);

create table public.rezoning_processes (
  jurisdiction_id text primary key references public.jurisdictions(id),
  code_section text,
  who_may_apply text,
  preapp_required boolean,
  preapp_notes text,
  application_items jsonb,
  fee_notes text,
  pz_hearing_timing text,
  newspaper_notice_days int,
  mailed_notice_radius_ft int,
  mailed_notice_days int,
  sign_posting text,
  governing_body_action text,
  protest_rule text,
  protest_deadline text,
  resubmittal_wait text,
  special_notes text,
  steps jsonb,
  source_url text not null,
  verified_on date not null
);

create table public.meetings (
  id bigint generated always as identity primary key,
  jurisdiction_id text not null references public.jurisdictions(id),
  body text not null check (body in ('planning_zoning','governing_body')),
  event_type text not null check (event_type in ('meeting','submittal_deadline')),
  event_date date not null,
  event_time time,
  location text,
  note text,
  linked_meeting bigint references public.meetings(id),  -- deadline -> the P&Z meeting it feeds
  status text not null check (status in ('published','projected','changed','cancelled')),
  source_url text,
  verified_on date,
  unique (jurisdiction_id, body, event_type, event_date)
);
create index meetings_date_idx on public.meetings (event_date);
create index meetings_linked_idx on public.meetings (linked_meeting);

create table public.people (
  id bigint generated always as identity primary key,
  jurisdiction_id text not null references public.jurisdictions(id),
  full_name text not null,
  role_group text not null check (role_group in ('planning_zoning','governing_body','staff')),
  title text,
  email text,
  phone text,
  term_expires date,
  source_url text,
  verified_on date,
  active boolean not null default true
);
create index people_jurisdiction_idx on public.people (jurisdiction_id);

create table public.zoning_districts (
  id bigint generated always as identity primary key,
  jurisdiction_id text not null references public.jurisdictions(id),
  code text not null,
  name text,
  category text,
  min_lot_sf int,
  min_lot_width_ft int,
  max_density_du_ac numeric,
  front_setback_ft numeric,
  side_setback_ft numeric,
  rear_setback_ft numeric,
  max_height_ft numeric,
  other_requirements jsonb,
  source_url text,
  verified_on date,
  unique (jurisdiction_id, code)
);

create table public.parcels (
  id bigint generated always as identity primary key,
  address text not null,
  parcel_id text,
  jurisdiction_id text references public.jurisdictions(id),
  zoning_code text,
  acreage numeric,
  lat double precision,
  lng double precision,
  notes text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now()
);
create index parcels_jurisdiction_idx on public.parcels (jurisdiction_id);
create index parcels_created_by_idx on public.parcels (created_by);

create table public.source_checks (
  id bigint generated always as identity primary key,
  jurisdiction_id text references public.jurisdictions(id),
  checked_url text,
  checked_at timestamptz default now(),
  content_hash text,
  changed boolean,
  summary text
);
create index source_checks_jurisdiction_idx on public.source_checks (jurisdiction_id);

-- All users share one role: any authenticated user can read and write.
-- Pair this with sign-ups disabled in Supabase Auth so only invited users exist.
do $$
declare t text;
begin
  foreach t in array array['jurisdictions','rezoning_processes','meetings','people',
                           'zoning_districts','parcels','source_checks'] loop
    execute format('alter table public.%1$I enable row level security;', t);
    execute format('create policy "team_all_%1$s" on public.%1$I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;
