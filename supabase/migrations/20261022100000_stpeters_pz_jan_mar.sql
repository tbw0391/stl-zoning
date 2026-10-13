-- St. Peters P&Z, Jan 7 and Mar 4, 2026: both were held (the collector flagged them as missing from CivicClerk).
-- Jan 7: the Feb 4 agenda approves the "Minutes - January 7, 2026"; the meeting just isn't in CivicClerk.
-- Mar 4: CivicClerk files it under Mar 23, 9:30 AM (event 92), but its agenda is dated Mar 4, 6:30 PM. The collector
-- added that as a separate meeting (id 512); its links move to Mar 4 and the Mar 23 row is marked cancelled rather
-- than deleted, so the daily collector doesn't add it again.
update public.meetings set
  agenda_url = 'https://stpetersmo.api.civicclerk.com/v1/Meetings/GetMeetingFileStream(fileId=1074,plainText=false)',
  packet_url = coalesce(packet_url, 'https://stpetersmo.api.civicclerk.com/v1/Meetings/GetMeetingFileStream(fileId=1077,plainText=false)'),
  minutes_url = 'https://stpetersmo.api.civicclerk.com/v1/Meetings/GetMeetingFileStream(fileId=1160,plainText=false)',
  note = 'Applicant or representative must attend. CivicClerk files this meeting under Mar 23, 9:30 AM by mistake; the agenda is dated Mar 4, 6:30 PM.',
  verified_on = date '2026-10-13'
where jurisdiction_id = 'stpeters' and body = 'planning_zoning' and event_type = 'meeting' and event_date = '2026-03-04';

update public.meetings set
  status = 'cancelled',
  note = 'Not a separate meeting: CivicClerk lists the Mar 4 P&Z meeting under this date by mistake (its agenda is dated Mar 4). Kept so the collector does not add it again.',
  verified_on = date '2026-10-13'
where jurisdiction_id = 'stpeters' and body = 'planning_zoning' and event_type = 'meeting' and event_date = '2026-03-23';

update public.meetings set
  note = 'Applicant or representative must attend. Held, though not in CivicClerk: the Feb 4 agenda approves the Jan 7 minutes.',
  verified_on = date '2026-10-13'
where jurisdiction_id = 'stpeters' and body = 'planning_zoning' and event_type = 'meeting' and event_date = '2026-01-07';
