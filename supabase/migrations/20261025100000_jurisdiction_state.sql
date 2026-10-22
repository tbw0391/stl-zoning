-- Columbus, Ohio area: a state and time zone per jurisdiction, Ohio townships (Zoning Commission -> Board of
-- Trustees) and the Legistar collector.
-- The site shows one state at a time (Missouri unless the "state-picker" feature is switched on), so Lombardo's
-- view, follow checklist, digest and alerts stay Missouri-only. The Ohio rows are in 20261025110000_ohio_columbus.

alter table public.jurisdictions
  add column if not exists state text not null default 'MO' check (state ~ '^[A-Z]{2}$'),
  add column if not exists time_zone text not null default 'America/Chicago';

alter table public.jurisdictions drop constraint if exists jurisdictions_kind_check;
alter table public.jurisdictions add constraint jurisdictions_kind_check
  check (kind = any (array['county', 'city', 'town', 'village', 'township']));

alter table public.jurisdictions drop constraint if exists jurisdictions_collector_check;
alter table public.jurisdictions add constraint jurisdictions_collector_check
  check (collector = any (array['agendacenter', 'civicclerk', 'municode', 'legistar']));

