import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MUNICIPALITY_TO_JURISDICTION, findParcels, hasZoningSource, matchDistrict, zoningFor, type Parcel, type Zoning } from "@/lib/parcels";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

const dash = <span className="muted">—</span>;
const ft = (v: number | null) => (v == null ? dash : `${v} ft`);
const fmtLot = (sf: number | null) =>
  sf == null ? dash : sf >= 43560 && sf % 43560 === 0 ? `${sf / 43560} ac` : `${sf.toLocaleString()} sf`;

export default async function LookupPage({ searchParams }: { searchParams: Promise<{ q?: string; pid?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  let parcels: Parcel[] = [];
  let error: string | null = null;
  if (q) {
    try {
      parcels = await findParcels(sp.pid ?? q);
    } catch (e) {
      error = `Parcel search failed: ${(e as Error).message}`;
    }
  }
  const parcel = parcels.length === 1 ? parcels[0] : sp.pid ? parcels.find((p) => p.parcelId === sp.pid) : undefined;

  let zoning: Zoning = null;
  let zoningError: string | null = null;
  if (parcel) {
    try {
      zoning = await zoningFor(parcel);
    } catch (e) {
      zoningError = (e as Error).message;
    }
  }

  const jid = parcel ? MUNICIPALITY_TO_JURISDICTION[parcel.municipality] : undefined;
  const supabase = await createClient();
  const [{ data: j }, { data: districts }] = jid
    ? await Promise.all([
        supabase.from("jurisdictions").select("id, name, zoning_map_url, code_url").eq("id", jid).maybeSingle(),
        supabase.from("zoning_districts").select("*").eq("jurisdiction_id", jid).order("id"),
      ])
    : [{ data: null }, { data: null }];
  const district = zoning && districts ? matchDistrict(zoning.districtCode, districts) : undefined;

  return (
    <>
      <PageTitle href="/lookup">Parcel lookup</PageTitle>
      <p className="muted">Address or parcel ID → municipality, current zoning and that district&apos;s standards. St. Charles and St. Louis counties; city zoning where the city publishes a zoning map layer.</p>

      <form className="filters" method="get">
        <label className="grow">Address or parcel ID
          <input name="q" defaultValue={q} placeholder="e.g. 400 N Main St, St. Charles · 6-009D-D603 · 23R440916" required autoFocus />
        </label>
        <button type="submit">Look up</button>
      </form>

      {error && <p className="error">{error}</p>}

      {q && !error && parcels.length === 0 && (
        <div className="card empty">No parcel found for &ldquo;{q}&rdquo;. Try just the house number and street name (e.g. &ldquo;123 Main&rdquo;).</div>
      )}

      {parcels.length > 1 && !parcel && (
        <>
          <p>{parcels.length === 25 ? "First 25 matches" : `${parcels.length} matches`}. Pick one:</p>
          <ul className="plain card">
            {parcels.map((p) => (
              <li key={p.parcelId}>
                <Link href={`/lookup?${new URLSearchParams({ q, pid: p.parcelId })}`}>{p.address || "(no site address)"}</Link>
                <span className="muted small"> · {p.municipality}{p.county === "St. Louis" && p.municipality !== "Unincorporated St. Louis County" ? " (St. Louis County)" : ""} · {p.parcelId}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {parcel && (
        <>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>{parcel.address || parcel.parcelId}</h2>
            <div className="facts">
              <div className="muted">Parcel ID</div><div>{parcel.parcelId}</div>
              <div className="muted">Municipality</div>
              <div>{j ? <Link href={`/jurisdictions/${j.id}`}>{j.name}</Link> : parcel.municipality}</div>
              <div className="muted">Owner</div><div>{parcel.owner ?? dash}</div>
              <div className="muted">Lot size</div><div>{parcel.lotSize ?? dash}</div>
              <div className="muted">Property type</div><div>{parcel.propType ?? dash}</div>
              <div className="muted">Zoning</div>
              <div>
                {zoning ? (
                  <>
                    <strong>{zoning.code}</strong>
                    {district && district.code !== zoning.code && <span className="muted"> (code district {district.code})</span>}
                    {Object.entries(zoning.extra).map(([k, v]) => <span key={k} className="muted small"> · {k.replace(/_/g, " ")}: {v}</span>)}
                  </>
                ) : zoningError ? (
                  <span className="error">Zoning service error: {zoningError}</span>
                ) : (
                  <span className="muted">
                    {hasZoningSource(parcel.municipality)
                      ? `The ${parcel.municipality} zoning layer has no district at this parcel.`
                      : `No online zoning layer for ${parcel.municipality} yet.`}
                    {j?.zoning_map_url && <> Check the <a href={j.zoning_map_url} target="_blank" rel="noreferrer">zoning map ↗</a>.</>}
                  </span>
                )}
              </div>
            </div>
            <p className="source">
              Parcel: {parcel.county === "St. Louis" ? "St. Louis County Assessor via the county's parcel map service" : "St. Charles County Assessor via county open data"}.
              {zoning && <> Zoning: {zoning.source}. GIS layers can lag recent rezonings; confirm with the municipality before relying on it.</>}
            </p>
          </div>

          {zoning && (
            <>
              <h2>District standards</h2>
              {district ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>District</th><th>Min lot</th><th>Width</th><th>Front / side / rear</th><th>Height</th><th>Density</th><th>Notes</th></tr></thead>
                    <tbody>
                      <tr>
                        <td><strong>{district.code}</strong> <a href={district.source_url} target="_blank" rel="noreferrer" className="small">{district.name}</a></td>
                        <td>{fmtLot(district.min_lot_sf)}</td>
                        <td>{ft(district.min_lot_width_ft)}</td>
                        <td>{[district.front_setback_ft, district.side_setback_ft, district.rear_setback_ft].every((v) => v == null) ? dash
                          : `${[district.front_setback_ft, district.side_setback_ft, district.rear_setback_ft].map((v) => v ?? "—").join(" / ")} ft`}</td>
                        <td>{ft(district.max_height_ft)}</td>
                        <td>{district.max_density_du_ac == null ? dash : `${district.max_density_du_ac} du/ac`}</td>
                        <td className="small">{district.other_requirements?.note}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="card empty">
                  &ldquo;{zoning.code}&rdquo; isn&apos;t in our district table for {j?.name ?? parcel.municipality}
                  {j && <> — see <Link href={`/jurisdictions/${j.id}`}>all districts</Link></>}.
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
