import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AREAS, findLand, landFilters } from "@/modules/vision/land";
import { fmtDate } from "@/lib/format";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

const money = (n: number | null) => (n ? `$${Math.round(n).toLocaleString("en-US")}` : "");
const SHOWN = 300;
const sewer = (ft: number | null) => (ft == null ? "Over 3 mi" : ft === 0 ? "On site" : ft < 5280 ? `${Math.round(ft / 10) * 10} ft` : `${(ft / 5280).toFixed(1)} mi`);

// Project Vision's land finder: large vacant and farm parcels (or homes on big acreage) for acquisition, with owner contact details.
export default async function LandPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const f = landFilters(sp);
  const supabase = await createClient();
  let rows: Awaited<ReturnType<typeof findLand>> = [];
  let error: string | null = null;
  try {
    rows = await findLand(supabase, f);
  } catch (e) {
    error = (e as Error).message;
  }
  const acres = rows.reduce((s, r) => s + r.acres, 0);
  const csv = `/vision/csv?${new URLSearchParams({ area: f.area, min: String(f.min), kind: f.kind, owner: f.owner, sort: f.sort })}`;

  return (
    <>
      <PageTitle href="/vision">Project Vision</PageTitle>
      <h2 className="lp-sub">Land finder</h2>
      <p className="muted">
        Large parcels from the county assessor records, with owner mailing addresses for outreach. Government, school, church,
        park, utility and subdivision common-ground land is left out. {AREAS[f.area].note}
      </p>

      <form className="filters" method="get">
        <label>Area
          <select name="area" defaultValue={f.area}>
            {Object.entries(AREAS).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}
          </select>
        </label>
        <label>At least
          <select name="min" defaultValue={String(f.min)}>
            {[5, 10, 20, 40, 80].map((n) => <option key={n} value={n}>{n} acres</option>)}
          </select>
        </label>
        <label>Land
          <select name="kind" defaultValue={f.kind}>
            <option value="vacant">Vacant or farm</option>
            <option value="home">Home on acreage</option>
            <option value="all">Both</option>
          </select>
        </label>
        <label>Owner
          <select name="owner" defaultValue={f.owner}>
            <option value="all">Anyone</option>
            <option value="people">People and trusts</option>
            <option value="company">Companies</option>
          </select>
        </label>
        <label>Sort by
          <select name="sort" defaultValue={f.sort}>
            <option value="acres">Size</option>
            <option value="activity">Nearby rezoning activity</option>
            <option value="sewer">Closest to sewer</option>
          </select>
        </label>
        <button type="submit">Apply</button>
      </form>

      {error ? (
        <div className="card empty">The county parcel service didn&apos;t answer ({error}). Try again in a minute.</div>
      ) : rows.length === 0 ? (
        <div className="card empty">No parcels match.</div>
      ) : (
        <>
          <p className="small">
            <strong>{rows.length.toLocaleString("en-US")}</strong> parcels, {Math.round(acres).toLocaleString("en-US")} acres.{" "}
            <a href={csv}>Download as a spreadsheet (CSV)</a>
            {rows.length > SHOWN && <span className="muted"> · showing the first {SHOWN}; the download has them all</span>}
          </p>
          <div className="table-wrap">
            <table className="land-table">
              <thead>
                <tr>
                  <th className="num">Acres</th><th>Owner</th><th>Site</th><th>Zoning</th>
                  <th className="num" title="From the parcel's edge to the nearest mapped sanitary sewer manhole or line point">Sewer</th>
                  <th className="num" title="Rezonings and other land-use cases within a mile, on agendas in the last 12 months">Cases within 1 mi</th>
                  <th className="num">Land value</th><th className="num">Building value</th><th>Use</th><th>Last sale</th><th>Mailing address</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, SHOWN).map((r) => (
                  <tr key={r.id}>
                    <td className="num"><strong>{r.acres.toFixed(1)}</strong></td>
                    <td>{r.owner}{r.company && <span className="tag pz">Company</span>}</td>
                    <td><Link href={`/lookup?q=${encodeURIComponent(r.id)}`}>{r.address || r.id}</Link></td>
                    <td>{r.zoning ?? <span className="muted">—</span>}</td>
                    <td className="num">{sewer(r.sewerFeet)}{r.sewerProvider && <div className="muted small">{r.sewerProvider}</div>}</td>
                    <td className="num">{r.nearby || ""}</td>
                    <td className="num">{money(r.landValue)}</td>
                    <td className="num">{money(r.buildingValue)}</td>
                    <td className="small">{r.use}</td>
                    <td className="small">{r.lastSale ? `${fmtDate(r.lastSale)}${r.lastSalePrice ? ` · ${money(r.lastSalePrice)}` : ""}` : ""}</td>
                    <td className="small">{r.mailing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            Values are the assessor&apos;s appraisal, not market price. Zoning is matched from the city&apos;s or county&apos;s
            zoning map at the middle of the parcel; check it on Parcel lookup (click the site) before relying on it.
            Sewer is the distance from the parcel&apos;s edge to the nearest mapped sanitary sewer point: MSD&apos;s full map in
            Wildwood, but in Wentzville only the manholes the city has GPS-located, so real sewer may be closer. In St. Charles
            County the provider is the county&apos;s sewer service area map. Neither says whether a line has capacity.
          </p>
        </>
      )}
    </>
  );
}
