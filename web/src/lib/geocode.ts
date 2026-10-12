// Street address → lat/lng. US Census geocoder first (free, no key), OpenStreetMap Nominatim as the fallback.
// Only real street addresses (starting with a house number) are tried, and results outside the St. Louis region
// are thrown out, so a vague location never gets a made-up point. Keep in step with supabase/functions/extract-agendas.

export type Point = { lat: number; lng: number; source: "census" | "osm" };

const inRegion = (p: { lat: number; lng: number }) => p.lat > 37.9 && p.lat < 39.4 && p.lng > -91.7 && p.lng < -89.7;

// "1670 Stump Rd and 7393 Highway N" → "1670 Stump Rd"
export const firstAddress = (s: string) => s.split(/\s+(?:and|&)\s+|;|\//i)[0].trim();

// "City of O'Fallon" → "O'Fallon"; county jurisdictions give no city.
export const placeName = (jurisdictionName: string) =>
  /county/i.test(jurisdictionName) ? null : jurisdictionName.replace(/^(City|Town|Village) of /, "");

export async function geocode(address: string, place: string | null): Promise<Point | null> {
  const street = firstAddress(address);
  if (!/^\d+\s+\S/.test(street)) return null;
  const q = [street, place, "MO"].filter(Boolean).join(", ");
  try {
    const u = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
    u.search = new URLSearchParams({ address: q, benchmark: "Public_AR_Current", format: "json" }).toString();
    const r = await fetch(u, { cache: "no-store" });
    const m = (await r.json())?.result?.addressMatches?.[0]?.coordinates;
    if (m && inRegion({ lat: m.y, lng: m.x })) return { lat: m.y, lng: m.x, source: "census" };
  } catch { /* fall through */ }
  try {
    const u = new URL("https://nominatim.openstreetmap.org/search");
    u.search = new URLSearchParams({ q, format: "json", limit: "1", countrycodes: "us" }).toString();
    const r = await fetch(u, { headers: { "User-Agent": "AGA-Entitlement-Tracker/1.0" }, cache: "no-store" });
    const hit = (await r.json())?.[0];
    if (hit && inRegion({ lat: Number(hit.lat), lng: Number(hit.lon) })) return { lat: Number(hit.lat), lng: Number(hit.lon), source: "osm" };
  } catch { /* no match */ }
  return null;
}

export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}
