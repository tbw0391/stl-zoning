-- Tasks can point at a jurisdiction and carry who to contact and what to ask (Chad's call list).
alter table public.tasks
  add column jurisdiction_id text references public.jurisdictions(id),
  add column details text,
  add column contact text,
  add column answer text;           -- what the call turned up, so the data can be loaded
create index tasks_jurisdiction_idx on public.tasks (jurisdiction_id);
