# Handoff: St. Charles County Entitlement Tracker (Oct 9, 2026)

## Mission
Land-entitlement tool for Chad Wilson (3-5 users, same role). St. Charles County first; St. Louis County later.
Needs: rezoning process per jurisdiction, P&Z / council / submittal calendar with weekly re-check, directory of P&Z members, council, and staff (administrator, engineer), and address → current zoning → district requirements.

## Backend
Supabase project **stl-zoning** (id `zjveevfcsqkdgenrrrcv`, us-east-2). Security advisor: clean.
Tables: jurisdictions (19, incl. St. Louis County placeholder), jurisdiction_progress (76), rezoning_processes (8), meetings (373; 101 deadlines linked via linked_meeting), people (185 across the 9 main jurisdictions), zoning_districts (0), parcels (0), source_checks (0).
Access: login was removed (commit 97a5e6a). The site is open to anyone with the URL; anon can read all tables, insert/update todos and people ("Remove" sets active=false), and update jurisdiction_progress (migration 20261013090000). Revisit if project data is sensitive.
Every fact row carries source_url + verified_on.

## Progress tracker
`jurisdiction_progress` (one row per jurisdiction × task: rezoning, schedule, people, districts; status not_started / in_progress / done / blocked) drives the /progress page, grouped by county. **When a task finishes, update its row in the same session**, e.g.
`update jurisdiction_progress set status='done', note='Through Dec 2026', updated_on=current_date where jurisdiction_id='stpeters' and task='schedule';`
St. Louis County is a single placeholder row (`stlouis_county`); add its municipalities to `jurisdictions` and `jurisdiction_progress` when that work starts.

## Done
- Rezoning procedures: County, St. Charles, St. Peters, O'Fallon, Wentzville, Lake Saint Louis. Partial: Cottleville, Dardenne Prairie.
- 2026 schedules loaded: Wentzville (through Feb 2027), Cottleville (through Dec 2026), O'Fallon (through Jan 2027; Oct 10), St. Peters (through Jan 2027; Oct 12, official schedule incl. initial-plan and rezoning deadlines), City of St. Charles (through Dec 2026; Oct 12), St. Charles County (through Dec 2026; Oct 12; deadlines `projected` from the 2025 rule, Friday 26 days before, since only the 2025 schedule is posted; Apr, Aug, Sep 2026 P&Z cancelled), Lake Saint Louis (through Jan 2027; Oct 12, table on the P&Z page), Dardenne Prairie (meetings through Dec 2026; Oct 12; city publishes no submittal deadlines, ask City Administrator 636-755-5303), Weldon Spring (Oct-Dec 2026 from the city calendar; no archive or deadlines online). O'Fallon hasn't posted a 2026 schedule: its P&Z page still links a 2024 PDF, now a dead Drive link. Held meetings come from the AgendaQuick archive (P&Z 1st Thursday 7 PM; Council 2nd & 4th Thursday 7:30 PM, Nov/Dec 3rd Thursday only). Deadlines are `projected` from the 2024 rule (Friday 34 days before, noon). Confirm with Tracy Coffman (tcoffman@ofallonmo.gov, 636-379-5544) and flip them to published.
- People directory (Oct 10): all nine main jurisdictions, 185 rows. Sources: city directories, P&Z pages, and roll calls in recent minutes (O'Fallon AgendaQuick, St. Peters CivicClerk API `stpetersmo.api.civicclerk.com/v1/Events`, Cottleville scanned PDFs). O'Fallon is partial: its ward pages are stale, so council comes from the Sep 10, 2026 roll call and 2026 ballot (Wexler, Boyer, Taylor first names/wards unconfirmed) and P&Z is last names only from Jul 2, 2026 minutes. Weldon Spring's site renders rosters client-side (read via Chrome).
- Front end: projects (with checklist), tasks, todo/suggestions, and meetings pages with YouTube-caption summaries (meetings.video_url, summary, summary_items, summarized_on).

## Next up
1. **Start here:** schedules are loaded for all eight main jurisdictions. Open items: confirm projected deadlines for O'Fallon (Tracy Coffman) and St. Charles County, and get deadlines for Dardenne Prairie and Weldon Spring (phone). Run `python3 scripts/build_meetings.py data` after any change. O'Fallon and County post meeting videos (OFallonTV, SCCMOTV) for summaries.
2. People follow-ups: O'Fallon full names/wards and planning director (ask Tracy Coffman); confirm City of St. Charles PW Director (Jim Wright vs. Nicholas Galla); County P&Z holdovers (Ellis, Shell); St. Peters planning title after Julie Powers retired Sep 11. Note: the Supabase MCP cancels UPDATE statements without approval; inserts go through.
3. Nine small towns/villages (some need phone calls).
4. Zoning district tables, then parcel lookup (Lake Saint Louis has a ZoningHub map; county has ArcGIS parcels).
5. Weekly scheduled task to re-check schedule URLs and log to source_checks.
6. Front end: `web/` (Next.js + Supabase, no login) deployed on Vercel. Edit forms live for people (/directory → Edit, /directory/new) and progress (/progress → Edit in each cell). Next: meeting edit forms, parcel lookup page.

## Key sources
- County UDO §405.535: https://ecode360.com/27758355
- Wentzville 2026 schedule: https://www.wentzvillemo.gov/wp-content/uploads/2025/10/PZ-2026-Schedule-Website.pdf
- O'Fallon agendas (AgendaQuick): https://public.destinyhosted.com/agenda_publish.cfm?id=63255 (mt=PZ / CCREG, get_month, get_year; cert chain is incomplete, curl needs -k)
- O'Fallon 2024 P&Z schedule (archived): https://web.archive.org/web/20240627035239/https://drive.google.com/file/d/1MTJgjQ8XAMqMc-tjYuibT2Mfc0ZGXoWd/view
- St. Peters 2026 schedule (Development Guide p.4): https://www.stpetersmo.net/DocumentCenter/View/444/Development-Guide-and-Planning--Zoning-SubmittalMeeting-Schedule-PDF (site returns 403 to curl/WebFetch; read via Chrome)
- City of St. Charles 2026 P&Z schedule: https://www.stcharlescitymo.gov/DocumentCenter/View/14267 (Agenda Center years via /AgendaCenter/UpdateCategoryList?year=YYYY&catID=1 for Council)
- St. Charles County 2025 P&Z schedule (latest posted): https://www.sccmo.org/DocumentCenter/View/26026 ; agendas via /AgendaCenter/UpdateCategoryList?year=YYYY&catID=11 (P&Z) or 1 (Council)
- Lake Saint Louis 2026 schedule (table on page): https://www.lakesaintlouis.com/1291/Planning-Zoning-Commission
- Cottleville 2026 schedule: https://www.cityofcottleville.com/wp-content/uploads/2025/12/PZ-Schedule-2026-1.pdf
