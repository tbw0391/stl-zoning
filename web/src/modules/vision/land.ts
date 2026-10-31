// Project Vision's land finder (see README.md here): large vacant, farm and lightly built parcels in an area, from the
// county assessor layers (the same services as lib/parcels.ts), with zoning matched locally against each city's or the
// county's zoning polygons.
// Government, school, church, park, utility and subdivision common-ground parcels are left out.
import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { ZONING_SOURCES } from "@/lib/parcels";

const SCC_PARCELS = "https://gis-dev.sccmo.org/scc_gis/rest/services/open_data/Tax_Information/MapServer/3";
const STL_PARCELS = "https://maps.stlouisco.com/hosting/rest/services/Maps/AGS_Parcels/MapServer/0";
// Smallest parcel fetched; the page's acreage filter works above this.
const FLOOR_ACRES = 5;

export type LandKind = "vacant" | "home";
export type LandParcel = {
  id: string; county: "St. Charles" | "St. Louis"; municipality: string; address: string; owner: string; mailing: string;
  acres: number; use: string; kind: LandKind; company: boolean; zoning: string | null; landValue: number | null;
  buildingValue: number | null; lastSale: string | null; lastSalePrice: number | null; lat: number; lng: number;
  // Feet from the parcel's edge to the nearest mapped sanitary sewer point (0 = one is on the parcel); null = none within 3 miles.
  sewerFeet: number | null; sewerProvider: string | null;
};

export const AREAS: Record<string, { label: string; note: string }> = {
  wildwood: { label: "Wildwood", note: "City of Wildwood (St. Louis County)." },
  wentzville: { label: "Wentzville", note: "City of Wentzville (St. Charles County)." },
  wentzville_area: {
    label: "Wentzville area (unincorporated)",
    note: "Unincorporated St. Charles County parcels with a Wentzville (63385) address: land outside the city that it could annex.",
  },
};

// Owners whose land isn't for sale in the usual way.
const NOT_FOR_SALE = new RegExp([
  "CITY OF", "COUNTY", "STATE OF", "UNITED STATES", "\\bUSA\\b", "SCHOOL", "\\bDISTRICT\\b", "CHURCH", "PARISH", "ARCHDIOCESE",
  "DIOCESE", "CONSERVATION", "TRUSTEES OF", "HOMEOWNERS", "HOME OWNERS", "ASSOCIATION", "\\bASSN\\b", "COMMON GROUND",
  "SUBDIVISION", "CEMETERY", "SEWER", "AMEREN", "UTILIT", "RAILROAD", "RAILWAY", "WATER", "PIPELINE", "TELEPHONE", "MINISTR",
  "CONGREGATION", "\\bLUTH", "METHODIST", "BAPTIST", "PRESBYTERIAN", "CATHOLIC", "FIRE PROTECTION",
].join("|"));
// Subdivision trustees hold common ground ("WESTGLEN FARMSPLAT 1 TRUSTEES", "PINE CREEK TRUSTEES"); couples holding their
// own land in trust read "SMITH JOHN & MARY H/W TRUSTEES".
const subdivisionTrustees = (owner: string) => /\bPLA?T\s*(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\b|PLAT\s*\d/.test(owner) ||
  (/(TRUSTEES|\bTRS)\s*$/.test(owner) && !/&|H\/[WH]|ETAL/.test(owner));
const COMPANY = /\b(LLC|L L C|INC|CORP|CORPORATION|COMPANY|\bCO\b|LP|L P|LTD|PARTNERSHIP|HOLDINGS|PROPERTIES|DEVELOPMENT|HOMES|BUILDERS|INVESTMENTS?|VENTURES|REALTY|GROUP|BANK)\b/;

type Feature = { attributes: Record<string, unknown>; geometry?: { rings?: number[][][] } };

async function queryAll(url: string, params: Record<string, string>, pageSize: number): Promise<Feature[]> {
  const out: Feature[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const res = await fetch(`${url}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ f: "json", outSR: "4326", resultOffset: String(offset), resultRecordCount: String(pageSize), ...params }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message ?? "ArcGIS query failed");
    out.push(...(data.features ?? []));
    if (!data.exceededTransferLimit && (data.features ?? []).length < pageSize) return out;
  }
}

// Area-weighted centroid of the largest ring: inside the parcel for all but very odd shapes.
function centroid(rings: number[][][] = []): [number, number] | null {
  let best: number[][] | null = null, bestArea = 0;
  for (const r of rings) {
    let a = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
    if (Math.abs(a) > bestArea) { bestArea = Math.abs(a); best = r; }
  }
  if (!best || !bestArea) return null;
  let a = 0, x = 0, y = 0;
  for (let i = 0, j = best.length - 1; i < best.length; j = i++) {
    const f = best[j][0] * best[i][1] - best[i][0] * best[j][1];
    a += f; x += (best[j][0] + best[i][0]) * f; y += (best[j][1] + best[i][1]) * f;
  }
  return [x / (3 * a), y / (3 * a)];
}

function inRings(pt: [number, number], rings: number[][][]) {
  let inside = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      if ((r[i][1] > pt[1]) !== (r[j][1] > pt[1]) &&
        pt[0] < ((r[j][0] - r[i][0]) * (pt[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) inside = !inside;
    }
  }
  return inside;
}

// Zoning polygons covering the parcels' extent, then a point-in-polygon match for each parcel.
async function matchZoning(parcels: LandParcel[], source: string) {
  const src = ZONING_SOURCES[source];
  if (!src || !parcels.length) return;
  const xs = parcels.map((p) => p.lng), ys = parcels.map((p) => p.lat);
  const envelope = { xmin: Math.min(...xs), ymin: Math.min(...ys), xmax: Math.max(...xs), ymax: Math.max(...ys), spatialReference: { wkid: 4326 } };
  const polys = await queryAll(src.url, {
    where: "1=1", geometry: JSON.stringify(envelope), geometryType: "esriGeometryEnvelope", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", outFields: src.field, returnGeometry: "true", maxAllowableOffset: "0.00005",
  }, 1000);
  for (const p of parcels) {
    const hit = polys.find((z) => z.geometry?.rings && String(z.attributes[src.field] ?? "").trim() && inRings([p.lng, p.lat], z.geometry.rings));
    p.zoning = hit ? String(hit.attributes[src.field]).trim() : null;
  }
}

// Sanitary sewer points (manholes and other network points). MSD's map covers its whole system; Wentzville publishes
// only the manholes its crews have GPS-located, so a Wentzville parcel can be closer to sewer than this shows.
const SEWER_POINTS = {
  msd: "https://services2.arcgis.com/w657bnjzrjguNyOy/arcgis/rest/services/MSD_Infrastructure_Complete/FeatureServer/1",
  wentzville: "https://services2.arcgis.com/PhrOBa64VhLxWQwF/arcgis/rest/services/Water_Wastewater_GPS_DUPLICATED/FeatureServer/6",
};
// St. Charles County's map of which district or city provides sewer service where.
const SEWER_PROVIDERS = "https://gis-dev.sccmo.org/scc_gis/rest/services/open_data/Utilities/MapServer/5";
const SEWER_SEARCH_MILES = 3;

// Distance in feet between two lng/lat points, flat-earth (fine at these distances).
const FT_PER_DEG_LAT = 364_000;
function segFeet(p: [number, number], a: number[], b: number[], kx: number) {
  const px = p[0] * kx, py = p[1] * FT_PER_DEG_LAT, ax = a[0] * kx, ay = a[1] * FT_PER_DEG_LAT, bx = b[0] * kx, by = b[1] * FT_PER_DEG_LAT;
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

async function matchSewer(parcels: LandParcel[], rings: Map<string, number[][][]>, source: keyof typeof SEWER_POINTS) {
  if (!parcels.length) return;
  const pad = SEWER_SEARCH_MILES / 60;
  const xs = parcels.map((p) => p.lng), ys = parcels.map((p) => p.lat);
  const envelope = { xmin: Math.min(...xs) - pad, ymin: Math.min(...ys) - pad, xmax: Math.max(...xs) + pad, ymax: Math.max(...ys) + pad, spatialReference: { wkid: 4326 } };
  const pts = (await queryAll(SEWER_POINTS[source], {
    where: "1=1", geometry: JSON.stringify(envelope), geometryType: "esriGeometryEnvelope", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", outFields: "OBJECTID", returnGeometry: "true",
  }, 2000)).map((f) => (f.geometry as { x?: number; y?: number } | undefined)).filter((g): g is { x: number; y: number } => g?.x != null)
    .map((g) => [g.x, g.y] as [number, number]);
  // Grid of points by 0.01 degree, so each parcel looks only at nearby ones.
  const CELL = 0.01, grid = new Map<string, [number, number][]>();
  for (const pt of pts) {
    const k = `${Math.floor(pt[0] / CELL)},${Math.floor(pt[1] / CELL)}`;
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(pt);
  }
  for (const p of parcels) {
    const rs = rings.get(p.id) ?? [];
    const kx = FT_PER_DEG_LAT * Math.cos((p.lat * Math.PI) / 180);
    const all = rs.flat();
    const [x0, x1] = [Math.min(...all.map((v) => v[0])), Math.max(...all.map((v) => v[0]))];
    const [y0, y1] = [Math.min(...all.map((v) => v[1])), Math.max(...all.map((v) => v[1]))];
    let best: number | null = null;
    for (const reach of [0.25, 1, SEWER_SEARCH_MILES].map((mi) => mi / 60)) {
      for (let gx = Math.floor((x0 - reach) / CELL); gx <= Math.floor((x1 + reach) / CELL); gx++) {
        for (let gy = Math.floor((y0 - reach) / CELL); gy <= Math.floor((y1 + reach) / CELL); gy++) {
          for (const pt of grid.get(`${gx},${gy}`) ?? []) {
            if (pt[0] < x0 - reach || pt[0] > x1 + reach || pt[1] < y0 - reach || pt[1] > y1 + reach) continue;
            let d = inRings(pt, rs) ? 0 : Infinity;
            for (const r of rs) for (let i = 1; i < r.length && d > 0; i++) d = Math.min(d, segFeet(pt, r[i - 1], r[i], kx));
            if (best == null || d < best) best = d;
          }
        }
      }
      if (best != null && best <= reach * 60 * 5280) break;
    }
    p.sewerFeet = best == null || best > SEWER_SEARCH_MILES * 5280 ? null : Math.round(best);
  }
}

async function matchSewerProvider(parcels: LandParcel[]) {
  const polys = await queryAll(SEWER_PROVIDERS, { where: "1=1", outFields: "SEWER_DIST", returnGeometry: "true", maxAllowableOffset: "0.0002" }, 1000);
  for (const p of parcels) {
    const hit = polys.find((z) => z.geometry?.rings && inRings([p.lng, p.lat], z.geometry.rings));
    p.sewerProvider = hit
      ? clean(hit.attributes.SEWER_DIST).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bOf\b/g, "of").replace(/\bSt\b/g, "St.")
      : "No sewer district";
  }
}

const num = (v: unknown) => (typeof v === "number" ? v : null);
const day = (v: unknown) => (typeof v === "number" && v > 0 ? new Date(v).toISOString().slice(0, 10) : null);
const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

async function stCharles(area: "wentzville" | "wentzville_area"): Promise<LandParcel[]> {
  const where = (area === "wentzville" ? "Municipality = 'City of Wentzville'" : "Municipality = 'Unincorporated County' AND SitusZip = '63385'") +
    ` AND Parcel_Acres >= ${FLOOR_ACRES} AND (PropType LIKE 'VACANT%' OR PropType LIKE 'FARM%' OR PropType LIKE 'SINGLE FAMILY%')`;
  const fs = await queryAll(SCC_PARCELS, {
    where, returnGeometry: "true", maxAllowableOffset: "0.00005",
    outFields: "Parcel_ID,SiteAddress,Municipality,Owner,MailingAddress,Parcel_Acres,PropType,ResidentialLandValue,AgriculturalLandValue,CommercialLandValue,ResidentialImprovementValue,AgriculturalImprovementValue,CommercialImprovementValue,SaleDate1,SalePrice1",
  }, 1000);
  const out: LandParcel[] = [];
  const rings = new Map<string, number[][][]>();
  for (const f of fs) {
    const a = f.attributes, c = centroid(f.geometry?.rings);
    const owner = clean(a.Owner);
    if (!c || NOT_FOR_SALE.test(owner) || subdivisionTrustees(owner)) continue;
    rings.set(clean(a.Parcel_ID), f.geometry!.rings!);
    const use = clean(a.PropType);
    const sum = (...ks: string[]) => ks.reduce((s, k) => s + (num(a[k]) ?? 0), 0);
    out.push({
      id: clean(a.Parcel_ID), county: "St. Charles", municipality: clean(a.Municipality), address: clean(a.SiteAddress), owner,
      mailing: clean(a.MailingAddress), acres: num(a.Parcel_Acres) ?? 0, use: use.replace(/\s*\(.*\)$/, "").toLowerCase().replace(/^\w/, (s) => s.toUpperCase()),
      kind: /^SINGLE FAMILY/.test(use) ? "home" : "vacant", company: COMPANY.test(owner),
      zoning: null, landValue: sum("ResidentialLandValue", "AgriculturalLandValue", "CommercialLandValue"),
      buildingValue: sum("ResidentialImprovementValue", "AgriculturalImprovementValue", "CommercialImprovementValue"),
      lastSale: day(a.SaleDate1), lastSalePrice: num(a.SalePrice1) || null, lat: c[1], lng: c[0], sewerFeet: null, sewerProvider: null,
    });
  }
  await Promise.all([
    matchZoning(out, area === "wentzville" ? "City of Wentzville" : "Unincorporated County"),
    matchSewer(out, rings, "wentzville"), matchSewerProvider(out),
  ]);
  return out;
}

async function wildwood(): Promise<LandParcel[]> {
  const fs = await queryAll(STL_PARCELS, {
    where: `MUNICIPALITY = 'WILDWOOD' AND ACRES >= ${FLOOR_ACRES} AND PROPCLASS <> 'X' AND LUCODE IN ('Vacant/Agriculture', 'Single Family', 'Duplex/Townhome')`,
    returnGeometry: "true", maxAllowableOffset: "0.00005",
    outFields: "LOCATOR,PROP_ADD,PROP_ZIP,OWNER_NAME,CAREOF,OWN_ADD,OWN_CITY,OWN_STATE,OWN_ZIP,ACRES,LUCODE,APPLANDVAL,APPIMPVAL,RECDATEDAILY",
  }, 1000);
  const out: LandParcel[] = [];
  const rings = new Map<string, number[][][]>();
  for (const f of fs) {
    const a = f.attributes, c = centroid(f.geometry?.rings);
    const owner = clean(a.OWNER_NAME);
    if (!c || NOT_FOR_SALE.test(owner) || subdivisionTrustees(owner)) continue;
    rings.set(clean(a.LOCATOR), f.geometry!.rings!);
    const use = clean(a.LUCODE);
    const zip = clean(a.OWN_ZIP);
    out.push({
      id: clean(a.LOCATOR), county: "St. Louis", municipality: "Wildwood", address: [clean(a.PROP_ADD), clean(a.PROP_ZIP)].filter(Boolean).join(" "),
      owner, mailing: [clean(a.CAREOF), clean(a.OWN_ADD), [clean(a.OWN_CITY), clean(a.OWN_STATE), zip.length > 5 ? `${zip.slice(0, 5)}-${zip.slice(5)}` : zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      acres: num(a.ACRES) ?? 0, use: use === "Vacant/Agriculture" ? "Vacant / agricultural" : use,
      kind: use === "Vacant/Agriculture" ? "vacant" : "home", company: COMPANY.test(owner),
      zoning: null, landValue: num(a.APPLANDVAL), buildingValue: num(a.APPIMPVAL),
      lastSale: /^\d{8}$/.test(clean(a.RECDATEDAILY)) ? `${clean(a.RECDATEDAILY).slice(0, 4)}-${clean(a.RECDATEDAILY).slice(4, 6)}-${clean(a.RECDATEDAILY).slice(6)}` : null,
      lastSalePrice: null, lat: c[1], lng: c[0], sewerFeet: null, sewerProvider: "MSD",
    });
  }
  await Promise.all([matchZoning(out, "Wildwood"), matchSewer(out, rings, "msd")]);
  return out;
}

const load = (area: string) => (area === "wildwood" ? wildwood() : stCharles(area as "wentzville" | "wentzville_area"));

// Assessor data changes slowly; one fetch a day per area.
export const landParcels = (area: string) =>
  unstable_cache(() => load(area), ["land-finder-7", area], { revalidate: 24 * 3600 })();

export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

export type LandFilters = { area: string; min: number; kind: "vacant" | "home" | "all"; owner: "all" | "people" | "company"; sort: "acres" | "activity" | "sewer" };

export function landFilters(sp: Record<string, string | undefined>): LandFilters {
  const min = Number(sp.min);
  return {
    area: AREAS[sp.area ?? ""] ? sp.area! : "wentzville",
    min: Number.isFinite(min) && min >= FLOOR_ACRES ? min : 10,
    kind: sp.kind === "home" || sp.kind === "all" ? sp.kind : "vacant",
    owner: sp.owner === "people" || sp.owner === "company" ? sp.owner : "all",
    sort: sp.sort === "activity" || sp.sort === "sewer" ? sp.sort : "acres",
  };
}

export type LandRow = LandParcel & { nearby: number };

// Land-use cases (rezonings, PUDs, plats, annexations...) read from agendas in the last year, with a location.
async function recentCases(supabase: SupabaseClient) {
  const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const { data } = await supabase.from("meetings").select("agenda_items, jurisdictions!inner(state)")
    .eq("jurisdictions.state", "MO").gte("event_date", since).not("agenda_items", "is", null);
  const seen = new Set<string>();
  const pts: { lat: number; lng: number }[] = [];
  for (const m of (data ?? []) as { agenda_items: { lat?: number; lng?: number; case_number?: string | null; address?: string | null }[] }[]) {
    for (const it of m.agenda_items ?? []) {
      if (it.lat == null || it.lng == null) continue;
      // The same case shows up at P&Z and again at council.
      const key = it.case_number || it.address || `${it.lat},${it.lng}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pts.push({ lat: it.lat, lng: it.lng });
    }
  }
  return pts;
}

export async function findLand(supabase: SupabaseClient, f: LandFilters): Promise<LandRow[]> {
  const [parcels, cases] = await Promise.all([landParcels(f.area), recentCases(supabase)]);
  return parcels
    .filter((p) => p.acres >= f.min && (f.kind === "all" || p.kind === f.kind) &&
      (f.owner === "all" || (f.owner === "company") === p.company))
    .map((p) => ({ ...p, nearby: cases.filter((c) => milesBetween(p, c) <= 1).length }))
    .sort((a, b) => (f.sort === "activity" ? b.nearby - a.nearby : 0) ||
      (f.sort === "sewer" ? (a.sewerFeet ?? Infinity) - (b.sewerFeet ?? Infinity) : 0) || b.acres - a.acres);
}
