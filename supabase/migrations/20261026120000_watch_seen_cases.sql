-- Suggestion #40: mark alert matches seen one at a time. Each watch keeps the cases marked seen individually
-- ("<meeting_id>-<idx>", the land_use_cases key) on top of its last_seen_at; "Mark seen" on the whole watch clears it.
alter table public.watches add column if not exists seen_cases text[] not null default '{}';
