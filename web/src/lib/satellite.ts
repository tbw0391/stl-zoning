import { unstable_cache } from "next/cache";

// Free Sentinel-2 satellite images of a site (10 m per pixel, a pass every few days) from Microsoft Planetary Computer,
// which needs no account. Each pass's scene classification (SCL band) is checked over the area pictured, so a pass
// that's clear overall but cloudy here, or that only partly covers the area (site on a tile edge), is skipped. Picks the latest clear image plus ones from about 3 and 12
// months earlier, to show change. If the free service stops, swap this file for a paid source (Planet, Nearmap).
const STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
const DATA = "https://planetarycomputer.microsoft.com/api/data/v1/item";
const COLLECTION = "sentinel-2-l2a";

export type Shot = { label: string; date: string; green: number; url: string };

// SCL classes: 4 vegetation, 5 bare ground or built, 6 water; 0-3 and 7-10 are no data, shadow or cloud.
const CLEAR = [4, 5, 6, 11];

type Item = { id: string; date: string; cloud: number };

// Square box `half` meters each side of the point, as [west, south, east, north].
function box(lat: number, lng: number, half: number) {
  const dLat = half / 111_320;
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map((v) => +v.toFixed(5));
}

async function search(lat: number, lng: number): Promise<Item[]> {
  const to = new Date();
  const from = new Date(to.getTime() - 400 * 864e5);
  const res = await fetch(STAC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collections: [COLLECTION],
      intersects: { type: "Point", coordinates: [lng, lat] },
      datetime: `${from.toISOString()}/${to.toISOString()}`,
      query: { "eo:cloud_cover": { lt: 60 } },
      sortby: [{ field: "datetime", direction: "desc" }],
      limit: 200,
      fields: { include: ["id", "properties.datetime", "properties.eo:cloud_cover"], exclude: ["assets", "links", "geometry"] },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Imagery search failed (${res.status})`);
  // A site near a tile edge comes back once per tile for the same pass; the coverage check picks the full one.
  const { features } = await res.json();
  return (features as { id: string; properties: Record<string, string | number> }[])
    .map((f) => ({ id: f.id, date: String(f.properties.datetime).slice(0, 10), cloud: Number(f.properties["eo:cloud_cover"]) }));
}

// Share of the box (`half` meters each side) that's clear, and of that, the share that's vegetation.
async function cover(item: Item, lat: number, lng: number, half: number) {
  const [w, s, e, n] = box(lat, lng, half);
  const feature = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } };
  const res = await fetch(`${DATA}/statistics?collection=${COLLECTION}&item=${item.id}&assets=SCL&categorical=true`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(feature), cache: "no-store",
  });
  if (!res.ok) return null;
  const stats = (await res.json()).properties?.statistics?.SCL_b1;
  if (!stats?.histogram) return null;
  const [counts, classes] = stats.histogram as [number[], number[]];
  const count = (pick: (c: number) => boolean) => classes.reduce((sum, c, i) => sum + (pick(c) ? counts[i] : 0), 0);
  const total = count(() => true);
  const clear = count((c) => CLEAR.includes(c));
  // Pixels outside the tile (site near its edge) are masked out of the histogram, so count them as not clear.
  const covered = (stats.valid_percent ?? 100) / 100;
  return total ? { clear: (clear / total) * covered, green: clear ? count((c) => c === 4) / clear : 0 } : null;
}

const PICTURED = 800; // meters each side of the site in the image
const SITE = 250; // meters each side counted for "green"

// First pass among `items` (in order) that's clear across the whole picture, checking four at a time; then its green
// share over the site itself.
async function firstClear(items: Item[], lat: number, lng: number) {
  for (let i = 0; i < Math.min(items.length, 20); i += 4) {
    const batch = items.slice(i, i + 4);
    const covers = await Promise.all(batch.map((it) => cover(it, lat, lng, PICTURED).catch(() => null)));
    // Strict, because the 20 m classification misses thin and small clouds: even 1% flagged usually means visible haze.
    const k = covers.findIndex((c) => c && c.clear >= 0.995);
    if (k < 0) continue;
    const site = await cover(batch[k], lat, lng, SITE).catch(() => null);
    return { item: batch[k], green: site?.green ?? covers[k]!.green };
  }
  return null;
}

const imageUrl = (id: string, lat: number, lng: number) =>
  `${DATA}/bbox/${box(lat, lng, PICTURED).join(",")}.png?collection=${COLLECTION}&item=${id}&assets=visual&width=480&height=480&resampling=bilinear`;

async function findShots(lat: number, lng: number): Promise<Shot[]> {
  const items = await search(lat, lng);
  const latest = await firstClear(items, lat, lng);
  if (!latest) return [];
  const shots: Shot[] = [{ label: "Latest", date: latest.item.date, green: latest.green, url: imageUrl(latest.item.id, lat, lng) }];
  // Earlier passes nearest each target date (within 45 days of it).
  const day = (d: string) => new Date(d + "T00:00:00Z").getTime() / 864e5;
  for (const [label, back] of [["3 months earlier", 91], ["A year earlier", 365]] as const) {
    const target = day(latest.item.date) - back;
    const near = items.filter((it) => Math.abs(day(it.date) - target) <= 45)
      .sort((a, b) => Math.abs(day(a.date) - target) - Math.abs(day(b.date) - target));
    const hit = await firstClear(near, lat, lng);
    if (hit) shots.push({ label, date: hit.item.date, green: hit.green, url: imageUrl(hit.item.id, lat, lng) });
  }
  return shots;
}

// Cached for six hours per site (rounded to about 10 m) so page loads don't repeat the search.
export const siteShots = (lat: number, lng: number) =>
  unstable_cache(() => findShots(lat, lng), ["satellite-3", lat.toFixed(4), lng.toFixed(4)], { revalidate: 6 * 3600 })();

export const exploreUrl = (lat: number, lng: number) =>
  `https://browser.dataspace.copernicus.eu/?zoom=15&lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`;
