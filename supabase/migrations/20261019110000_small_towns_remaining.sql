-- The last six St. Charles County small towns (suggestion #6), Oct 12. Phone numbers from the county's list of
-- political subdivisions (https://www.sccmo.org/2203/Political-Subdivisions). None has a zoning code online.
-- West Alton has a website with a full directory; the others have no website (portagedessioux.com is a parked domain).

update public.jurisdictions set website = 'https://westaltonmo.com',
  notes = 'City Hall 111 Richard Dr. (meetings with staff by appointment), 636-899-1734. Almost all of the city is in the Missouri/Mississippi floodplain and follows NFIP rules; the city asks buyers to call before purchasing. Land use permit form names a zoning district, but no zoning code, map, or meeting schedule is posted.'
where id = 'west_alton';
update public.jurisdictions set notes = 'No website. Town of Augusta, P.O. Box 42, Augusta, MO 63332, 636-228-4689.' where id = 'augusta';
update public.jurisdictions set notes = 'No website and no city hall. 636-899-1544.' where id = 'portage_des_sioux';
update public.jurisdictions set notes = 'No website. City Hall 2300 St. Paul Rd., St. Paul, MO 63366, 636-293-3718.' where id = 'st_paul';
update public.jurisdictions set notes = 'No website and no village hall. 636-300-9989.' where id = 'weldon_spring_heights';
update public.jurisdictions set notes = 'No website, no village hall, and no phone on the county list.' where id = 'josephville';

-- West Alton directory. Phone numbers kept for city offices and elected officials as the city posts them; the
-- volunteer P&Z members' listed numbers look like personal phones, so they're left out (reach them through City Hall).
insert into public.people (jurisdiction_id, full_name, role_group, title, phone, source_url, verified_on) values
  ('west_alton', 'William Richter', 'governing_body', 'Mayor', '636-233-1483', 'https://westaltonmo.com/directory/', '2026-10-12'),
  ('west_alton', 'Edward Shaub', 'governing_body', 'Alderman, Ward 1', '314-281-1793', 'https://westaltonmo.com/directory/', '2026-10-12'),
  ('west_alton', 'Shawn Lovell', 'governing_body', 'Alderman, Ward 1', '636-262-3628', 'https://westaltonmo.com/directory/', '2026-10-12'),
  ('west_alton', 'David Bonderer', 'governing_body', 'Alderman, Ward 2', '636-899-0933', 'https://westaltonmo.com/directory/', '2026-10-12'),
  ('west_alton', 'Nick Wunderlich', 'governing_body', 'Alderman, Ward 2', '636-233-1583', 'https://westaltonmo.com/directory/', '2026-10-12'),
  ('west_alton', 'Janet Neustadt', 'staff', 'City Administrator; Floodplain Administrator', '636-899-1734', 'https://westaltonmo.com/directory/', '2026-10-12'),
  ('west_alton', 'Beth Machens', 'staff', 'City Clerk', '636-899-0809', 'https://westaltonmo.com/directory/', '2026-10-12'),
  ('west_alton', 'Melvin Neustadt III', 'planning_zoning', 'Chairman', null, 'https://westaltonmo.com/directory/', '2026-10-12'),
  ('west_alton', 'Jason Farley', 'planning_zoning', 'Commissioner', null, 'https://westaltonmo.com/directory/', '2026-10-12'),
  ('west_alton', 'Glenn Grotegeers', 'planning_zoning', 'Secretary', null, 'https://westaltonmo.com/directory/', '2026-10-12'),
  ('west_alton', 'Alex Sansevere', 'planning_zoning', 'Member', null, 'https://westaltonmo.com/directory/', '2026-10-12'),
  ('west_alton', 'Matt Brown', 'planning_zoning', 'Member', null, 'https://westaltonmo.com/directory/', '2026-10-12'),
  ('west_alton', 'Brad Connoyer', 'planning_zoning', 'Member', null, 'https://westaltonmo.com/directory/', '2026-10-12'),
  ('west_alton', 'Bob Springer', 'planning_zoning', 'Member', null, 'https://westaltonmo.com/directory/', '2026-10-12');

update public.jurisdiction_progress set status = 'done', note = 'Mayor, 4 aldermen, City Administrator, City Clerk, 7 P&Z members (city directory).', updated_on = '2026-10-12'
where jurisdiction_id = 'west_alton' and task = 'people';
update public.jurisdiction_progress set status = 'blocked', note = 'Nothing online; call City Hall 636-899-1734 (on /chad).', updated_on = '2026-10-12'
where jurisdiction_id = 'west_alton' and task in ('rezoning', 'schedule', 'districts');

update public.jurisdiction_progress p set status = 'blocked', updated_on = '2026-10-12',
  note = 'No website; call ' || v.phone || ' (on /chad).'
from (values ('augusta', '636-228-4689'), ('portage_des_sioux', '636-899-1544'), ('st_paul', '636-293-3718'),
             ('weldon_spring_heights', '636-300-9989')) v(id, phone)
where p.jurisdiction_id = v.id;
update public.jurisdiction_progress set status = 'blocked', updated_on = '2026-10-12',
  note = 'No website, village hall, or listed phone; ask St. Charles County Planning (636-949-7335) for a village contact.'
where jurisdiction_id = 'josephville';

-- Phone numbers for the two existing Chad tasks, and one task per remaining town.
update public.tasks set contact = 'Village (no hall) · 636-300-9989' where id = 12 and jurisdiction_id = 'weldon_spring_heights';
update public.tasks set contact = 'No phone listed; St. Charles County Planning (636-949-7335) may have a village contact' where id = 11 and jurisdiction_id = 'josephville';
insert into public.tasks (title, details, contact, assigned_to, jurisdiction_id) values
  ('West Alton: zoning, rezoning process and meeting schedule',
   'The website lists P&Z and Board members but no code or meetings. Ask: is there a zoning code and map (the land use permit form names a zoning district), how rezonings work, and when P&Z and the Board of Aldermen meet. Floodplain rules (NFIP) apply to nearly the whole city.',
   'City Hall · 636-899-1734 · City Administrator Janet Neustadt', 'Chad', 'west_alton'),
  ('Augusta: zoning, rezoning process and meeting schedule',
   'No website. Ask: who handles zoning and rezonings, whether there is a zoning code and map, meeting schedule, and contacts for the mayor, aldermen and P&Z.',
   'Town of Augusta · 636-228-4689 · P.O. Box 42, Augusta, MO 63332', 'Chad', 'augusta'),
  ('Portage des Sioux: zoning, rezoning process and meeting schedule',
   'No website and no city hall. Ask: who handles zoning and rezonings, whether there is a zoning code and map, meeting schedule, and contacts for the mayor, aldermen and P&Z.',
   'City · 636-899-1544', 'Chad', 'portage_des_sioux'),
  ('St. Paul: zoning, rezoning process and meeting schedule',
   'No website. Ask: who handles zoning and rezonings, whether there is a zoning code and map, meeting schedule, and contacts for the mayor, aldermen and P&Z.',
   'City Hall · 636-293-3718 · 2300 St. Paul Rd.', 'Chad', 'st_paul');

-- Suggestions: #1-4 are the same calls as /chad tasks 3, 5, 6, 7; #6 (small towns) is finished as far as the web goes.
update public.todos set done_at = now() where id in (1, 2, 3, 4, 6) and done_at is null;
