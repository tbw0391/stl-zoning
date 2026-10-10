# stl-zoning

Land entitlement tracker for St. Charles County, Missouri (St. Louis County to follow).
Built for a small team (3-5 users, one shared role).

## What it tracks
- **Rezoning process** for every municipality and unincorporated St. Charles County, pulled from each code.
- **Calendar** of Planning & Zoning meetings, council / Board of Aldermen meetings, and submittal deadlines, with each deadline linked to the meeting it feeds. A weekly check re-verifies published schedules.
- **Directory** of P&Z members, elected officials, and key staff (city administrator, city engineer).
- **Parcel lookup**: address → jurisdiction → current zoning → district requirements (lot size, density, setbacks).

## Layout
| Path | Contents |
|---|---|
| `supabase/migrations/` | Schema as applied to the live Supabase project `stl-zoning` |
| `data/` | Seed data (JSON + CSV) and `upcoming_dates.ics` for Outlook / Google Calendar |
| `scripts/build_meetings.py` | Rebuilds meeting seed data and the .ics from published schedules |
| `web/` | Next.js front end (deployed on Vercel): calendar, jurisdictions, directory, projects, tasks, meetings. No login: open to anyone with the URL |
| `docs/HANDOFF.md` | Current status and next objectives |

Every fact row carries `source_url` and `verified_on`, so nothing unverified is presented as fact.

## Status (Oct 9, 2026)
| Jurisdiction | Rezoning process | 2026 schedule |
|---|---|---|
| St. Charles County (uninc.) | Done | Not found yet |
| City of St. Charles | Done | Not found yet |
| St. Peters | Done | Not found yet |
| O'Fallon | Done | Meetings loaded through Jan 2027; deadlines projected (2026 schedule not posted) |
| Wentzville | Done | Loaded through Feb 2027 |
| Lake Saint Louis | Done | Not found yet |
| Cottleville | Partial | Loaded through Dec 2026 |
| Dardenne Prairie | Partial | Pattern only |
| Weldon Spring | Not yet | Pattern only |
| 9 small towns/villages | Not yet | Not yet |

People directory: Wentzville done (22 people). Zoning districts, parcel lookup and the weekly checker are not built yet.

## Security
Login was removed: anonymous users can read all tables and insert/update todos. Anyone with the URL has that access,
so revisit if project data becomes sensitive. Keep Supabase keys out of this repo.
