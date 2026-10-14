-- Fills the gaps the project timeline estimate hit (Oct 14).

-- Wildwood: the AgendaCenter collector only sees meetings once an agenda is posted, so upcoming meetings come from
-- the city calendar's iCal feeds (P&Z = calendar 28, City Council = 30). Both meet at 6:30 PM; feeds run through Dec.
insert into public.meetings (jurisdiction_id, body, event_type, event_date, event_time, location, status, source_url, verified_on)
select 'wildwood', v.body, 'meeting', v.d::date, '18:30', 'Wildwood Municipal Building, Council Chambers, 16860 Main St.', 'published',
       'https://www.cityofwildwood.com/Calendar.aspx', '2026-10-14'
from (values ('planning_zoning', '2026-11-02'), ('planning_zoning', '2026-12-07'),
             ('governing_body', '2026-11-09'), ('governing_body', '2026-12-14')) v(body, d)
where not exists (select 1 from public.meetings m where m.jurisdiction_id = 'wildwood' and m.body = v.body
                  and m.event_type = 'meeting' and m.event_date = v.d::date);

update public.jurisdictions set schedule_url = 'https://www.cityofwildwood.com/Calendar.aspx',
  notes = coalesce(notes || ' ', '') || 'P&Z 1st Monday, City Council 2nd Monday, both 6:30 PM (city calendar). No published submittal deadlines.'
where id = 'wildwood' and schedule_url is null;

-- Cottleville Board of Aldermen, 2026: 3rd Wednesday, 7 PM, City Hall Board Room. From the city's 2026 BOA schedule.
-- Its deadlines are for items going straight to the Board; rezonings follow the P&Z deadlines, so they aren't loaded.
-- Jun 23 special meeting from the city's agendas page.
insert into public.meetings (jurisdiction_id, body, event_type, event_date, event_time, location, status, source_url, verified_on, note)
select 'cottleville', 'governing_body', 'meeting', d::date, '19:00', 'Cottleville City Hall Board Room, 5490 Fifth St.', 'published',
       case when d = '2026-06-23' then 'https://www.cityofcottleville.com/boards-agendas-minutes/'
            else 'https://www.cityofcottleville.com/wp-content/uploads/2025/12/BOA-Schedule-2026.pdf' end,
       '2026-10-14', case when d = '2026-06-23' then 'Special meeting' end
from unnest(array['2026-01-21','2026-02-18','2026-03-18','2026-04-15','2026-05-20','2026-06-17','2026-06-23','2026-07-15',
                  '2026-08-19','2026-09-16','2026-10-21','2026-11-18','2026-12-16']) d
where not exists (select 1 from public.meetings m where m.jurisdiction_id = 'cottleville' and m.body = 'governing_body'
                  and m.event_type = 'meeting' and m.event_date = d::date);

update public.jurisdictions set notes = replace(notes, 'BOA usually 3rd Wednesday 7 PM (from notices; confirm).',
  'BOA 3rd Wednesday 7 PM (2026 BOA schedule).')
where id = 'cottleville';

-- St. Charles County Council takes two meetings on a rezoning: introduced (with public comment) at one, final passage
-- at the next. RZ26-04 (Bill 5518): introduced Aug 10, 2026, passed Aug 31. CUP26-05/06 followed the same path.
update public.rezoning_processes set governing_body_action =
  'County Council approves, denies, or amends. Two readings: the bill is introduced (with public comment) at one Council meeting and passed at the next, e.g. RZ26-04 introduced Aug 10, 2026 and passed Aug 31 (Council agendas).'
where jurisdiction_id = 'stcharles_county';

update public.jurisdiction_progress set note = 'Meetings collected automatically; Nov-Dec P&Z and Council from the city calendar. No submittal deadlines published.', updated_on = '2026-10-14'
where jurisdiction_id = 'wildwood' and task = 'schedule';

update public.jurisdiction_progress set note = 'Through Dec 2026: P&Z from the revised 2026 schedule (Jul 2026), Board of Aldermen from the 2026 BOA schedule. Watched weekly on /sources.', updated_on = '2026-10-14'
where jurisdiction_id = 'cottleville' and task = 'schedule';
