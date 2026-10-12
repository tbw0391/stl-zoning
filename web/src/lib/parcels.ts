// Address → parcel → zoning lookups against public ArcGIS REST services.
// Parcels come from St. Charles County's open data on gis-dev.sccmo.org (maps.sccmo.org and gis.sccmo.org sit
// behind a Cloudflare challenge that blocks server requests). Zoning comes from the county (unincorporated only)
// or from each city's own layer where one is public.

const COUNTY = "https://gis-dev.sccmo.org/scc_gis/rest/services/open_data";
const PARCELS = `${COUNTY}/Tax_Information/MapServer/3`;

// `aliases` maps a GIS code to the code-book district it falls under (e.g. subdistricts that share one table row).
// `search` is for layers republished under date-stamped names: the newest ArcGIS Online item matching it wins,
// with `url` as the fallback.
type ZoningSource = {
  url: string; field: string; label: string; extra?: string[]; aliases?: Record<string, string>; search?: string;
};

// Keyed by the county parcel layer's Municipality value.
export const ZONING_SOURCES: Record<string, ZoningSource> = {
  "Unincorporated County": {
    url: `${COUNTY}/Community_Development/MapServer/17`, field: "ZONING", label: "St. Charles County zoning districts",
  },
  "City of St Charles": {
    url: "https://services.arcgis.com/p44fQSGBTnSRR4hh/arcgis/rest/services/Zoning_Dissolve/FeatureServer/0",
    field: "CITY_ZONE", label: "City of St. Charles zoning (ArcGIS Online)",
  },
  "City of O'Fallon": {
    url: "https://gis.ofallonmo.gov/arcgis/rest/services/ZoningDistrict_Map/Zoning_Map/MapServer/38",
    field: "Zone_ID", label: "O'Fallon zoning map service", extra: ["PUD", "Special_District_Name"],
  },
  "City of St Peters": {
    url: "https://gis.stpetersmo.net/server/rest/services/Viewer/Zoning_Viewer/FeatureServer/0",
    field: "ZONE_ID", label: "St. Peters zoning viewer",
    // SD-* are the St. Peters Centre subdistricts (§405.260); SL is Lakeside 370 (§405.265).
    aliases: { "SD-I": "SPC", "SD-OC": "SPC", "SD-RC": "SPC", "SD-LI": "SPC", "SD-T": "SPC", SL: "L370" },
  },
  "City of Cottleville": {
    url: "https://services2.arcgis.com/4r0xSpHoQYNn0xY0/arcgis/rest/services/Zoning_Districts_Viewer/FeatureServer/0",
    field: "Zoning", label: "Cottleville zoning (ArcGIS Online)", aliases: { "Multi-Family": "R-2" },
  },
  "City of Lake Saint Louis": {
    url: "https://services8.arcgis.com/MkUfAWaYm2SQf4Qa/arcgis/rest/services/LA3340_Zoning_ParcelsOfficial_09152026/FeatureServer/0",
    search: "owner:Maplink_GenCode title:LA3340_Zoning_Parcels",
    field: "Base", label: "Lake Saint Louis zoning (General Code ZoningHub)", extra: ["Overlay"],
  },
  "City of Wentzville": {
    url: "https://services2.arcgis.com/PhrOBa64VhLxWQwF/arcgis/rest/services/Zoning/FeatureServer/0",
    field: "ZONING", label: "Wentzville zoning (ArcGIS Online)",
  },
};

export const MUNICIPALITY_TO_JURISDICTION: Record<string, string> = {
  "Unincorporated County": "stcharles_county",
  "City of St Charles": "stcharles_city",
  "City of O'Fallon": "ofallon",
  "City of St Peters": "stpeters",
  "City of Wentzville": "wentzville",
  "City of Lake Saint Louis": "lake_st_louis",
  "City of Cottleville": "cottleville",
  "Dardenne Prairie": "dardenne_prairie",
  "Town of Weldon Spring": "weldon_spring",
  "City of Weldon Spring Heights": "weldon_spring_heights",
  "City of Augusta": "augusta",
  "City of Flint Hill": "flint_hill",
  "City of Foristell": "foristell",
  "City of Josephville": "josephville",
  "City of New Melle": "new_melle",
  "City of Portage Des Sioux": "portage_des_sioux",
  "City of St Paul": "st_paul",
  "City of West Alton": "west_alton",
};

export type Parcel = {
  parcelId: string;
  address: string;
  municipality: string;
  owner: string | null;
  lotSize: string | null;
  propType: string | null;
  point: { x: number; y: number } | null;
};

// `code` is what the GIS layer says; `districtCode` is the code to look up in zoning_districts.
export type Zoning = { code: string; districtCode: string; extra: Record<string, string>; source: string } | null;

async function query(url: string, params: Record<string, string>) {
  const res = await fetch(`${url}/query?${new URLSearchParams({ f: "json", ...params })}`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "ArcGIS query failed");
  return data.features as { attributes: Record<string, unknown>; geometry?: { rings?: number[][][] } }[];
}

const SUFFIXES: [RegExp, string][] = [
  [/\bSTREET\b/g, "ST"], [/\bDRIVE\b/g, "DR"], [/\bROAD\b/g, "RD"], [/\bAVENUE\b/g, "AVE"], [/\bBOULEVARD\b/g, "BLVD"],
  [/\bLANE\b/g, "LN"], [/\bCOURT\b/g, "CT"], [/\bPARKWAY\b/g, "PKWY"], [/\bHIGHWAY\b/g, "HWY"], [/\bCIRCLE\b/g, "CIR"],
  [/\bPLACE\b/g, "PL"], [/\bTERRACE\b/g, "TER"], [/\bNORTH\b/g, "N"], [/\bSOUTH\b/g, "S"], [/\bEAST\b/g, "E"], [/\bWEST\b/g, "W"],
];

// "123 Main Street, St. Charles, MO 63301" → "123 MAIN ST"
export function normalizeAddress(input: string) {
  let s = input.toUpperCase().split(",")[0].replace(/[.#]/g, " ").replace(/\s+/g, " ").trim();
  for (const [re, abbr] of SUFFIXES) s = s.replace(re, abbr);
  return s;
}

// Area-weighted centroid of the outer ring; falls back to the vertex average for degenerate rings.
function centroid(rings: number[][][]) {
  const r = rings[0];
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < r.length - 1; i++) {
    const [x0, y0] = r[i], [x1, y1] = r[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-12) return { x: r.reduce((s, p) => s + p[0], 0) / r.length, y: r.reduce((s, p) => s + p[1], 0) / r.length };
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

const toParcel = (f: { attributes: Record<string, unknown>; geometry?: { rings?: number[][][] } }): Parcel => ({
  parcelId: String(f.attributes.Parcel_ID),
  address: String(f.attributes.SiteAddress ?? "").trim(),
  municipality: String(f.attributes.Municipality ?? ""),
  owner: (f.attributes.Owner as string) ?? null,
  lotSize: (f.attributes.LotSize as string) ?? null,
  propType: (f.attributes.PropType as string) ?? null,
  point: f.geometry?.rings?.length ? centroid(f.geometry.rings) : null,
});

const PARCEL_FIELDS = "Parcel_ID,SiteAddress,Municipality,Owner,LotSize,PropType";

// Matches a street address prefix, or an exact parcel ID when the input looks like one. Text after the first comma
// narrows the results: a ZIP filters on SitusZip, and a city name is preferred when it matches the municipality
// (it is often only the postal city, so non-matching parcels are kept if nothing matches).
export async function findParcels(input: string): Promise<Parcel[]> {
  const q = input.trim();
  const isParcelId = /^[0-9A-Z]-[0-9A-Z]{3,4}-/i.test(q);
  const value = (isParcelId ? q.toUpperCase() : normalizeAddress(q)).replace(/'/g, "''");
  if (value.length < 3) return [];
  const rest = isParcelId ? "" : q.split(",").slice(1).join(" ").toUpperCase();
  const zip = rest.match(/\b(63\d{3})\b/)?.[1];
  const city = rest.replace(/\b(MO|MISSOURI|63\d{3}(-\d{4})?)\b/g, "").replace(/[.,']/g, "").replace(/\bSAINT\b/g, "ST").replace(/\s+/g, " ").trim();
  let where = isParcelId ? `Parcel_ID LIKE '${value}%'` : `SiteAddress LIKE '${value}%'`;
  if (zip) where += ` AND SitusZip = '${zip}'`;
  const features = await query(PARCELS, {
    where, outFields: PARCEL_FIELDS, returnGeometry: "true", outSR: "4326", orderByFields: "SiteAddress", resultRecordCount: "25",
  });
  const parcels = features.map(toParcel);
  if (!city) return parcels;
  const muni = (p: Parcel) => p.municipality.toUpperCase().replace(/[.']/g, "").replace(/\bSAINT\b/g, "ST");
  const inCity = parcels.filter((p) => muni(p).includes(city));
  return inCity.length ? inCity : parcels;
}

async function layerUrl(src: ZoningSource) {
  if (!src.search) return src.url;
  try {
    const res = await fetch(`https://www.arcgis.com/sharing/rest/search?${new URLSearchParams({
      f: "json", q: `${src.search} type:"Feature Service"`, sortField: "modified", sortOrder: "desc", num: "1",
    })}`, { next: { revalidate: 86400 } });
    const url = (await res.json()).results?.[0]?.url;
    return url ? `${url}/0` : src.url;
  } catch {
    return src.url;
  }
}

export async function zoningFor(parcel: Parcel): Promise<Zoning> {
  const src = ZONING_SOURCES[parcel.municipality];
  if (!src || !parcel.point) return null;
  const features = await query(await layerUrl(src), {
    geometry: JSON.stringify({ ...parcel.point, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
    outFields: [src.field, ...(src.extra ?? [])].join(","), returnGeometry: "false",
  });
  const a = features[0]?.attributes;
  const code = String(a?.[src.field] ?? "").trim();
  if (!code) return null;
  const extra: Record<string, string> = {};
  for (const k of src.extra ?? []) {
    const v = String(a?.[k] ?? "").trim();
    if (v && v !== "None" && v !== "No") extra[k] = v;
  }
  return { code, districtCode: src.aliases?.[code] ?? code, extra, source: src.label };
}

// GIS codes vary in punctuation ("R1C" vs "R-1C", "PD-R" vs "PD"); compare on letters and digits, then on the
// part before the first "/" (overlays like "RR/FF") or "-" (planned-district subtypes).
export function matchDistrict<T extends { code: string }>(gisCode: string, districts: T[]): T | undefined {
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const tries = [gisCode, gisCode.split("/")[0], gisCode.split(/[-/]/)[0]];
  for (const t of tries) {
    const hit = districts.find((d) => norm(d.code) === norm(t));
    if (hit) return hit;
  }
}
