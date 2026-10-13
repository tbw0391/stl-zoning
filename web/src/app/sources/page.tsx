import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, shortName } from "@/lib/format";
import { markReviewed } from "./actions";
import { needsReview } from "./review";

export const dynamic = "force-dynamic";

type Watch = {
  id: number; jurisdiction_id: string; url: string; label: string; last_status: number | null;
  last_checked_at: string | null; last_changed_at: string | null; change_summary: string | null; reviewed_at: string | null;
  jurisdictions: { name: string } | null;
};

const day = (ts: string) => fmtDate(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date(ts)));

export default async function SourcesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("source_watches")
    .select("id, jurisdiction_id, url, label, last_status, last_checked_at, last_changed_at, change_summary, reviewed_at, jurisdictions!inner(name)")
    .eq("jurisdictions.followed", true).order("jurisdiction_id").order("id");
  const watches = (data ?? []) as unknown as Watch[];
  const review = watches.filter(needsReview);
  const lastRun = watches.map((w) => w.last_checked_at).filter(Boolean).sort().at(-1);
  const name = (w: Watch) => shortName(w.jurisdictions?.name ?? w.jurisdiction_id);

  return (
    <>
      <p className="small"><Link href="/progress">← Progress</Link></p>
      <h1>Schedule sources</h1>
      <p className="muted">
        Every Monday morning these pages and files are checked for changes: a new schedule or agenda posted, a file
        replaced, or a link that stopped working. Cities with a daily collector are covered by it and aren&apos;t listed.
        {lastRun && <> Last checked {day(lastRun)}.</>}
      </p>

      <h2>To review {review.length > 0 && <span className="tag due">{review.length}</span>}</h2>
      {review.length === 0 ? <div className="card empty">Nothing changed since the last review.</div> : (
        <div className="meeting-list">
          {review.map((w) => (
            <div className="card" key={w.id}>
              <div className="small muted">{w.last_changed_at && `Changed ${day(w.last_changed_at)}`}</div>
              <h3 style={{ margin: "2px 0 6px" }}>
                <Link href={`/jurisdictions/${w.jurisdiction_id}`}>{name(w)}</Link>: <a href={w.url} target="_blank" rel="noreferrer">{w.label} ↗</a>
              </h3>
              <p style={{ margin: "0 0 10px", overflowWrap: "anywhere" }}>{w.change_summary}</p>
              <form action={markReviewed.bind(null, w.id)}>
                <button type="submit">Reviewed</button>
                <span className="muted small"> after updating the dates (or confirming nothing needs to change)</span>
              </form>
            </div>
          ))}
        </div>
      )}

      <h2>All watched sources</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Municipality</th><th>Source</th><th>Last checked</th><th>Last change</th></tr></thead>
          <tbody>
            {watches.map((w) => (
              <tr key={w.id}>
                <td><Link href={`/jurisdictions/${w.jurisdiction_id}`}>{name(w)}</Link></td>
                <td>
                  <a href={w.url} target="_blank" rel="noreferrer">{w.label} ↗</a>
                  {w.last_status && w.last_status !== 200 && <> <span className="tag partial">HTTP {w.last_status}</span></>}
                </td>
                <td className="small">{w.last_checked_at ? day(w.last_checked_at) : <span className="muted">Not yet</span>}</td>
                <td className="small">{w.last_changed_at ? day(w.last_changed_at) : <span className="muted">None</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
