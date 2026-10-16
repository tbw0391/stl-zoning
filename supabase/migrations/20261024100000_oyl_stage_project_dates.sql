-- Suggestions #27-28 (Oct 15): an "OYL" stage ahead of Prospect, and diligence-expiration and closing dates on projects.
alter table public.projects drop constraint if exists projects_stage_check;
alter table public.projects add constraint projects_stage_check
  check (stage in ('oyl','prospect','loi','diligence','development','closed'));

alter table public.projects
  add column if not exists diligence_expires_on date,
  add column if not exists closing_on date;
