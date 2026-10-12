-- Kirkwood 2026 City Council meetings: 1st & 3rd Thursday 7 PM (2nd & 4th in January), work sessions before.
-- From the city's printable schedule. That PDF prints Jun 20, Nov 7 and Nov 21, which are Saturdays; the city's
-- meetings calendar (read in Chrome, Oct 12) has Jun 18, Nov 5 and Nov 19, used here.
insert into public.meetings (jurisdiction_id, body, event_type, event_date, event_time, location, status, source_url, verified_on, note)
select 'kirkwood', 'governing_body', 'meeting', d::date, '19:00', 'Kirkwood City Hall, 139 S. Kirkwood Rd', 'published',
       'https://www.kirkwoodmo.org/home/showpublisheddocument/17017/639011326882470000', '2026-10-12',
       case when d in ('2026-06-18', '2026-11-05', '2026-11-19')
            then 'Date from the city meetings calendar; the printed schedule has a typo (a Saturday).' end
from unnest(array['2026-01-08','2026-01-22','2026-02-05','2026-02-19','2026-03-05','2026-03-19','2026-04-02','2026-04-16',
                  '2026-05-07','2026-05-21','2026-06-04','2026-06-18','2026-07-02','2026-07-16','2026-08-06','2026-08-20',
                  '2026-09-03','2026-09-17','2026-10-01','2026-10-15','2026-11-05','2026-11-19','2026-12-03','2026-12-17']) d
where not exists (select 1 from public.meetings m where m.jurisdiction_id = 'kirkwood' and m.body = 'governing_body'
                  and m.event_type = 'meeting' and m.event_date = d::date);

update public.jurisdiction_progress
set note = '2026 P&Z meetings and submittal deadlines, and City Council meetings, from the city schedules', updated_on = '2026-10-12'
where jurisdiction_id = 'kirkwood' and task = 'schedule';


-- Mayor, City Council and City Clerk from the council page (Oct 12), plus the P&Z staff liaison already in the
-- jurisdiction notes. All elected at large; terms in the title. P&Z members still to do.
insert into public.people (jurisdiction_id, full_name, role_group, title, email, phone, source_url, verified_on) values
  ('kirkwood', 'Liz Gibbons', 'governing_body', 'Mayor (2024-2028)', 'gibbonew@kirkwoodmo.org', '314-822-5804', 'https://www.kirkwoodmo.org/government/city-council', '2026-10-12'),
  ('kirkwood', 'Justin Arnold', 'governing_body', 'Council Member (2026-2030)', 'arnoldjl@kirkwoodmo.org', null, 'https://www.kirkwoodmo.org/government/city-council', '2026-10-12'),
  ('kirkwood', 'Sheila Burkett', 'governing_body', 'Council Member (2026-2030)', 'burketsa@kirkwoodmo.org', null, 'https://www.kirkwoodmo.org/government/city-council', '2026-10-12'),
  ('kirkwood', 'Gina Jaksetic', 'governing_body', 'Council Member (2024-2028)', 'jaksetgm@kirkwoodmo.org', null, 'https://www.kirkwoodmo.org/government/city-council', '2026-10-12'),
  ('kirkwood', 'Deb Lavender', 'governing_body', 'Council Member (2026-2030)', 'lavenddj@kirkwoodmo.org', null, 'https://www.kirkwoodmo.org/government/city-council', '2026-10-12'),
  ('kirkwood', 'Mark McLean', 'governing_body', 'Council Member (2024-2028)', 'mcleanmg@kirkwoodmo.org', null, 'https://www.kirkwoodmo.org/government/city-council', '2026-10-12'),
  ('kirkwood', 'Paul Schaefer', 'governing_body', 'Council Member (2024-2028)', 'schaefpw@kirkwoodmo.org', null, 'https://www.kirkwoodmo.org/government/city-council', '2026-10-12'),
  ('kirkwood', 'Laurie Asche', 'staff', 'City Clerk', 'aschelb@kirkwoodmo.org', '314-822-5802', 'https://www.kirkwoodmo.org/government/city-council', '2026-10-12'),
  ('kirkwood', 'Amy Lowry', 'staff', 'Planning & Zoning staff liaison', 'lowryag@kirkwoodmo.org', '314-822-5815', 'https://www.kirkwoodmo.org/home/showpublisheddocument/16773/639014784400570000', '2026-10-12');

update public.jurisdiction_progress
set status = 'in_progress', note = 'Mayor, City Council, City Clerk, P&Z staff liaison. P&Z members not loaded yet.', updated_on = '2026-10-12'
where jurisdiction_id = 'kirkwood' and task = 'people';
