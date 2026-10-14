-- Jan-Mar 2027 meetings projected from each body's standing schedule, for the cities with active projects, so the
-- project timeline (and its "continued once" path) can run past December. None has posted a 2027 schedule yet
-- (Oct 14); status 'projected' shows as "est." and the weekly source check flags the real schedule when it posts.
-- Time, location and source link copy the body's latest loaded meeting. Meetings only: deadlines aren't guessed.
--   St. Charles County: P&Z 3rd Wed; Council 2nd and 4th Mon      Cottleville: P&Z 1st Mon; Board 3rd Wed
--   Dardenne Prairie: P&Z 2nd Wed; Board 1st and 3rd Wed           Wildwood: P&Z 1st Mon; Council 2nd Mon
insert into public.meetings (jurisdiction_id, body, event_type, event_date, event_time, location, status, source_url, note)
select v.j, v.body, 'meeting', v.d::date, last.event_time, last.location, 'projected', last.source_url,
       'Projected from the standing schedule; the 2027 schedule is not posted yet.'
from (values
  ('stcharles_county', 'planning_zoning', '2027-01-20'), ('stcharles_county', 'planning_zoning', '2027-02-17'), ('stcharles_county', 'planning_zoning', '2027-03-17'),
  ('stcharles_county', 'governing_body', '2027-01-11'), ('stcharles_county', 'governing_body', '2027-01-25'), ('stcharles_county', 'governing_body', '2027-02-08'),
  ('stcharles_county', 'governing_body', '2027-02-22'), ('stcharles_county', 'governing_body', '2027-03-08'), ('stcharles_county', 'governing_body', '2027-03-22'),
  ('cottleville', 'planning_zoning', '2027-01-04'), ('cottleville', 'planning_zoning', '2027-02-01'), ('cottleville', 'planning_zoning', '2027-03-01'),
  ('cottleville', 'governing_body', '2027-01-20'), ('cottleville', 'governing_body', '2027-02-17'), ('cottleville', 'governing_body', '2027-03-17'),
  ('dardenne_prairie', 'planning_zoning', '2027-01-13'), ('dardenne_prairie', 'planning_zoning', '2027-02-10'), ('dardenne_prairie', 'planning_zoning', '2027-03-10'),
  ('dardenne_prairie', 'governing_body', '2027-01-06'), ('dardenne_prairie', 'governing_body', '2027-01-20'), ('dardenne_prairie', 'governing_body', '2027-02-03'),
  ('dardenne_prairie', 'governing_body', '2027-02-17'), ('dardenne_prairie', 'governing_body', '2027-03-03'), ('dardenne_prairie', 'governing_body', '2027-03-17'),
  ('wildwood', 'planning_zoning', '2027-01-04'), ('wildwood', 'planning_zoning', '2027-02-01'), ('wildwood', 'planning_zoning', '2027-03-01'),
  ('wildwood', 'governing_body', '2027-01-11'), ('wildwood', 'governing_body', '2027-02-08'), ('wildwood', 'governing_body', '2027-03-08')
) v(j, body, d)
cross join lateral (
  select m.event_time, m.location, m.source_url from public.meetings m
  where m.jurisdiction_id = v.j and m.body = v.body and m.event_type = 'meeting' and m.status <> 'cancelled'
  order by m.event_date desc limit 1
) last
where not exists (select 1 from public.meetings m where m.jurisdiction_id = v.j and m.body = v.body
                  and m.event_type = 'meeting' and m.event_date = v.d::date);
