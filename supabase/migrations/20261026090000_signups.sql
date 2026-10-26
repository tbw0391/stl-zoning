-- Sign-up requests from the public front door (/signup, via the signup edge function). No policies: only the service
-- role reads or writes, so prospects' contact details aren't visible through the open site.
create table if not exists public.signups (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  company text not null,
  email text not null,
  phone text,
  state text,
  area text,
  role text,
  note text,
  status text not null default 'new' check (status in ('new', 'invited', 'declined')),
  notified_at timestamptz
);
alter table public.signups enable row level security;
