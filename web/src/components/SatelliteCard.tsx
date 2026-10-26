import { exploreUrl, siteShots } from "@/lib/satellite";
import { fmtDate } from "@/lib/format";

// Recent free satellite images of a site, latest first, with earlier ones to compare (feature "satellite").
// Wrap in <Suspense>: finding clear passes can take a few seconds the first time for a site.
export default async function SatelliteCard({ lat, lng }: { lat: number; lng: number }) {
  const shots = await siteShots(lat, lng).catch(() => null);
  return (
    <div className="card">
      {shots === null ? (
        <p className="muted small" style={{ margin: 0 }}>The satellite image service didn&apos;t answer. Try again later.</p>
      ) : shots.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>No clear pass over this site recently (clouds every time).</p>
      ) : (
        <div className="sat-grid">
          {shots.map((s) => (
            <figure key={s.date}>
              <a href={s.url} target="_blank" rel="noreferrer" className="sat-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt={`Satellite image of the site, ${fmtDate(s.date)}`} width={480} height={480} loading="lazy" />
                <span className="sat-pin" aria-hidden="true" />
              </a>
              <figcaption>
                <strong>{s.label}</strong> · {fmtDate(s.date)}
                <span className="muted small"> · {Math.round(s.green * 100)}% green</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <p className="source">
        Sentinel-2 (European Space Agency) via Microsoft Planetary Computer: free, 10 m per pixel, a pass every few days,
        cloudy passes skipped. Each image is about a mile across with the site at the center. &quot;Green&quot; is the
        share of the ground within about 250 m that reads as vegetation; a big drop usually means clearing or grading,
        but fields also go brown after harvest, so compare against a year earlier.{" "}
        <a href={exploreUrl(lat, lng)} target="_blank" rel="noreferrer">Explore every date ↗</a>
      </p>
    </div>
  );
}
