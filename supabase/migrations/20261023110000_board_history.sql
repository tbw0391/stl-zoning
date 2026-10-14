-- How long cases take at each board, from agenda history (the project timeline card reads board_history).
-- A case is a jurisdiction + case number seen on a P&Z agenda. Council dates count only within a year after its last
-- P&Z meeting, so a case number reused years later isn't joined to an old case.
create or replace view public.case_history with (security_invoker = true) as
with c as (
  select jurisdiction_id, upper(btrim(case_number)) as case_number, body, event_date
  from public.land_use_cases where nullif(btrim(case_number), '') is not null
), pz as (
  select jurisdiction_id, case_number, min(event_date) as first_pz, max(event_date) as last_pz, count(distinct event_date)::int as pz_meetings
  from c where body = 'planning_zoning' group by 1, 2
)
select pz.*, g.first_gb, g.last_gb
from pz
left join lateral (
  select min(c.event_date) as first_gb, max(c.event_date) as last_gb from c
  where c.jurisdiction_id = pz.jurisdiction_id and c.case_number = pz.case_number and c.body = 'governing_body'
    and c.event_date > pz.last_pz and c.event_date <= pz.last_pz + 365
) g on true;

-- One row per board, plus an all-boards row (jurisdiction_id null). Days are calendar days.
create or replace view public.board_history with (security_invoker = true) as
select jurisdiction_id, min(first_pz) as since, count(*)::int as cases,
       count(*) filter (where pz_meetings > 1)::int as continued,
       count(first_gb)::int as with_council,
       percentile_disc(0.5) within group (order by first_gb - last_pz) as pz_to_council_p50,
       percentile_disc(0.5) within group (order by last_gb - first_pz) as total_p50,
       percentile_disc(0.8) within group (order by last_gb - first_pz) as total_p80
from public.case_history
group by grouping sets ((jurisdiction_id), ());

grant select on public.case_history, public.board_history to anon, authenticated;
