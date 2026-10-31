# Project Vision

Finding land: large vacant, farm and lightly built parcels, with owner contact details, zoning, distance to sewer,
values, last sale and nearby rezoning activity. Started Oct 31, 2026 for Lombardo (Wildwood, Wentzville).

It's kept separable so it can ship either as an add-on inside Rezone This or as its own app.

## Where it lives

| Piece | Path |
| --- | --- |
| Data and rules | `web/src/modules/vision/land.ts` |
| Page | `web/src/app/vision/page.tsx` (`/vision`) |
| Spreadsheet download | `web/src/app/vision/csv/route.ts` (`/vision/csv`) |
| Menu entry | `lib/nav.ts` (`/vision`, shown with the `land-finder` feature) |
| Opt-in switch | `lib/features.ts` (`land-finder`) |

## The boundary

Vision may use the shared layer, and nothing else from the tracker:

- `lib/parcels.ts`: county parcel services and `ZONING_SOURCES` (zoning layers per municipality).
- `meetings.agenda_items` and `jurisdictions` (read only), for "cases within 1 mile".
- Shared page parts: `PageTitle`, `lib/format`, `lib/supabase`.

It must not import projects, tasks, watches, alerts, OYL or anything else that is one company's own work. Keep it that
way and either packaging below is a move, not a rewrite.

It stores nothing yet: every search reads the county services live (cached a day per area).

## Adding an area

Add an entry to `AREAS` and a loader in `land.ts`: the assessor layer and its "where" clause, the zoning source key in
`ZONING_SOURCES`, and the sewer source (`SEWER_POINTS`). St. Louis County parcels use the `wildwood()` loader shape;
St. Charles County parcels use `stCharles()`. Ohio would need the Franklin/Delaware county auditor layers.

## Shipping it

**As an add-on in Rezone This (likely first).** Once there are company accounts, replace the `land-finder` opt-in
with a per-company entitlement (a `modules` list on the company, later a Stripe price), check it in the page and the
CSV route, and show the menu entry only when it's on. Saved searches, notes on a parcel or an outreach status would be
new company-owned tables (`vision_*`), never columns on shared tables.

**As its own app.** Copy `modules/vision`, `app/vision`, `lib/parcels.ts`, `lib/format.ts`, `lib/supabase` and the
shared page parts into a new Next.js app. For "cases within 1 mile", either point it at this Supabase project with a
read-only key or drop that column. Nothing else comes along.

## Data notes

- Owners left out: government, school, church, park, utility, and subdivision trustees (owner ends TRUSTEES/TRS
  without "&" or H/W, or names a plat). St. Louis County owner names arrive run together from the source.
- Sewer: MSD's full network (`MSD_Infrastructure_Complete/1`) in Wildwood; in Wentzville only the city's
  GPS-located manholes (partial, about 1,300). St. Charles County's sewer service-area map gives the provider;
  "No sewer district" means septic.
- Values are assessor appraisals, not market prices.
