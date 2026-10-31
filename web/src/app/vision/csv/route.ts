import { createClient } from "@/lib/supabase/server";
import { findLand, landFilters } from "@/modules/vision/land";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// The Land finder's results as a spreadsheet, for mailing lists and outreach.
export async function GET(request: Request) {
  const f = landFilters(Object.fromEntries(new URL(request.url).searchParams));
  const rows = await findLand(await createClient(), f);
  const head = ["Parcel", "County", "Municipality", "Acres", "Owner", "Owner type", "Mailing address", "Site address", "Use", "Zoning", "Sewer (ft)", "Sewer map", "Sewer provider",
    "Land value", "Building value", "Last sale", "Last sale price", "Cases within 1 mi (12 mo)", "Latitude", "Longitude"];
  const lines = rows.map((r) => [r.id, r.county, r.municipality, r.acres.toFixed(2), r.owner, r.company ? "Company" : "Person / trust",
    r.mailing, r.address, r.use, r.zoning, r.sewerFeet, r.sewerMap, r.sewerProvider, r.landValue, r.buildingValue, r.lastSale, r.lastSalePrice, r.nearby,
    r.lat.toFixed(6), r.lng.toFixed(6)].map(cell).join(","));
  return new Response([head.join(","), ...lines].join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="vision-land-${f.area}-${f.min}ac.csv"` },
  });
}
