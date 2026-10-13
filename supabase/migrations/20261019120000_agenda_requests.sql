-- Older agendas (past extract-agendas' 45-day window) are read only on request, after approval, to keep API
-- costs down. "Request" on /meetings sets agenda_requested_at/by with status pending; /agenda-requests approves or
-- declines; the hourly reader takes approved requests first and emails the requester when the agenda is read.
alter table public.meetings add column if not exists agenda_requested_at timestamptz;
alter table public.meetings add column if not exists agenda_requested_by text;
alter table public.meetings add column if not exists agenda_request_status text
  check (agenda_request_status in ('pending', 'approved', 'declined'));
alter table public.meetings add column if not exists agenda_request_notified_at timestamptz;
