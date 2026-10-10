# Handoff: St. Charles County Entitlement Tracker (Oct 9, 2026)

## Mission
Land-entitlement tool for Chad Wilson (3-5 users, same role). St. Charles County first; St. Louis County later.
Needs: rezoning process per jurisdiction, P&Z / council / submittal calendar with weekly re-check, directory of P&Z members, council, and staff (administrator, engineer), and address → current zoning → district requirements.

## Backend
Supabase project **stl-zoning** (id `zjveevfcsqkdgenrrrcv`, us-east-2). Security advisor: clean.
Tables: jurisdictions (18), rezoning_processes (8), meetings (75; 25 deadlines linked via linked_meeting), people (0), zoning_districts (0), parcels (0), source_checks (0).
RLS: any authenticated user has full access. **To do:** disable public sign-ups and invite users.
Every fact row carries source_url + verified_on.

## Done
- Rezoning procedures: County, St. Charles, St. Peters, O'Fallon, Wentzville, Lake Saint Louis. Partial: Cottleville, Dardenne Prairie.
- 2026 schedules loaded: Wentzville (through Feb 2027), Cottleville (through Dec 2026).

## Next up
1. People directory (P&Z, council, administrator, engineer) for each jurisdiction.
2. Remaining schedules: County, St. Charles, St. Peters, O'Fallon, Lake Saint Louis, Dardenne Prairie, Weldon Spring.
3. Nine small towns/villages (some need phone calls).
4. Zoning district tables, then parcel lookup (Lake Saint Louis has a ZoningHub map; county has ArcGIS parcels).
5. Weekly scheduled task to re-check schedule URLs and log to source_checks.
6. Front end (Vercel available).

## Key sources
- County UDO §405.535: https://ecode360.com/27758355
- Wentzville 2026 schedule: https://www.wentzvillemo.gov/wp-content/uploads/2025/10/PZ-2026-Schedule-Website.pdf
- Cottleville 2026 schedule: https://www.cityofcottleville.com/wp-content/uploads/2025/12/PZ-Schedule-2026-1.pdf
