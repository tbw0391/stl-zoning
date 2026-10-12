-- Posted agendas (most cities post Friday before the meeting). Filled by the weekly agenda check.
alter table public.meetings
  add column agenda_url text,
  add column agenda_items jsonb,      -- [{item, request}] land-use items on the agenda
  add column agenda_checked_on date;
create index meetings_agenda_idx on public.meetings (event_date desc) where agenda_url is not null;
