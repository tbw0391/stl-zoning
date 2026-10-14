-- Suggestion #20 (Oct 14): keep the directory current. The web pages the directory was built from join the weekly
-- source check (check-sources), so a changed roster shows on /sources for review. Rows sourced from meeting minutes,
-- agendas or budget PDFs are left out (those documents never change; new minutes are the signal there).
insert into public.source_watches (jurisdiction_id, url, label)
select p.jurisdiction_id, p.source_url,
  'Directory: ' || string_agg(distinct case p.role_group
    when 'governing_body' then 'elected officials' when 'planning_zoning' then 'P&Z' else 'staff' end, ', ')
from public.people p
where p.active and p.source_url is not null
  and p.source_url !~* '(\.pdf|GetMeetingFileStream|FileOpen\.aspx|/agenda/|DocumentCenter)'
  and not exists (select 1 from public.source_watches w where w.url = p.source_url)
group by p.jurisdiction_id, p.source_url;
