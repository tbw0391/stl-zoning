# Handoff: St. Charles County Entitlement Tracker (Oct 9, 2026)

## Mission
Land-entitlement tool for Chad Wilson (3-5 users, same role). St. Charles County first; St. Louis County later.
Needs: rezoning process per jurisdiction, P&Z / council / submittal calendar with weekly re-check, directory of P&Z members, council, and staff (administrator, engineer), and address → current zoning → district requirements.

## Backend
Supabase project **stl-zoning** (id `zjveevfcsqkdgenrrrcv`, us-east-2). Security advisor: clean.
Tables: jurisdictions (18), rezoning_processes (8), meetings (123; 38 deadlines linked via linked_meeting), people (22, Wentzville), zoning_districts (0), parcels (0), source_checks (0).
Access: login was removed (commit 97a5e6a). The site is open to anyone with the URL; anon can read all tables and insert/update todos. Revisit if project data is sensitive.
Every fact row carries source_url + verified_on.

## Done
- Rezoning procedures: County, St. Charles, St. Peters, O'Fallon, Wentzville, Lake Saint Louis. Partial: Cottleville, Dardenne Prairie.
- 2026 schedules loaded: Wentzville (through Feb 2027), Cottleville (through Dec 2026), O'Fallon (through Jan 2027; Oct 10). O'Fallon hasn't posted a 2026 schedule: its P&Z page still links a 2024 PDF, now a dead Drive link. Held meetings come from the AgendaQuick archive (P&Z 1st Thursday 7 PM; Council 2nd & 4th Thursday 7:30 PM, Nov/Dec 3rd Thursday only). Deadlines are `projected` from the 2024 rule (Friday 34 days before, noon). Confirm with Tracy Coffman (tcoffman@ofallonmo.gov, 636-379-5544) and flip them to published.
- Front end: projects (with checklist), tasks, todo/suggestions, and meetings pages with YouTube-caption summaries (meetings.video_url, summary, summary_items, summarized_on).

## Next up
1. **Start here:** remaining 2026 schedules, in order St. Peters, St. Charles, County, Lake Saint Louis, then Dardenne Prairie, Weldon Spring. Link deadlines to meetings, rebuild data/upcoming_dates.ics. O'Fallon and County post meeting videos (OFallonTV, SCCMOTV) for summaries.
2. People directory (P&Z, council, administrator, engineer) for the same jurisdictions. Wentzville done Oct 9 (P&Z roster from Jul 6, 2026 minutes, since the city's P&Z page no longer lists members).
3. Nine small towns/villages (some need phone calls).
4. Zoning district tables, then parcel lookup (Lake Saint Louis has a ZoningHub map; county has ArcGIS parcels).
5. Weekly scheduled task to re-check schedule URLs and log to source_checks.
6. Front end: `web/` (Next.js + Supabase, no login) deployed on Vercel. Next: parcel lookup page, editing forms.

## Key sources
- County UDO §405.535: https://ecode360.com/27758355
- Wentzville 2026 schedule: https://www.wentzvillemo.gov/wp-content/uploads/2025/10/PZ-2026-Schedule-Website.pdf
- O'Fallon agendas (AgendaQuick): https://public.destinyhosted.com/agenda_publish.cfm?id=63255 (mt=PZ / CCREG, get_month, get_year; cert chain is incomplete, curl needs -k)
- O'Fallon 2024 P&Z schedule (archived): https://web.archive.org/web/20240627035239/https://drive.google.com/file/d/1MTJgjQ8XAMqMc-tjYuibT2Mfc0ZGXoWd/view
- Cottleville 2026 schedule: https://www.cityofcottleville.com/wp-content/uploads/2025/12/PZ-Schedule-2026-1.pdf
