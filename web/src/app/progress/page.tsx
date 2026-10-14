import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { updateProgress } from "./actions";
import PageTitle from "@/components/PageTitle";
import { needsReview } from "../sources/review";

export const dynamic = "force-dynamic";

const TASKS = [
  { id: "rezoning", label: "Rezoning process" },
  { id: "schedule", label: "Schedule" },
  { id: "people", label: "People" },
  { id: "districts", label: "Zoning districts" },
];

const PROGRESS_LABEL: Record<string, string> = {
  done: "Done",
  in_progress: "In progress",
  blocked: "Blocked",
  not_started: "Not started",
};

type Row = { jurisdiction_id: string; task: string; status: string; note: string | null; updated_on: string };

export default async function ProgressPage() {
  const supabase = await createClient();
  const [{ data: js }, { data: rows }, { data: watches }] = await Promise.all([
    supabase.from("jurisdictions").select("id, name, kind, county").eq("followed", true),
    supabase.from("jurisdiction_progress").select("jurisdiction_id, task, status, note, updated_on"),
    supabase.from("source_watches").select("last_changed_at, reviewed_at, jurisdictions!inner(followed)").eq("jurisdictions.followed", true),
  ]);
  const toReview = (watches ?? []).filter(needsReview).length;

  const byJ = new Map<string, Map<string, Row>>();
  for (const r of (rows ?? []) as Row[]) {
    if (!byJ.has(r.jurisdiction_id)) byJ.set(r.jurisdiction_id, new Map());
    byJ.get(r.jurisdiction_id)!.set(r.task, r);
  }
  const isComplete = (id: string) => TASKS.every((t) => byJ.get(id)?.get(t.id)?.status === "done");
  const lastUpdate = (rows ?? []).map((r) => r.updated_on).sort().at(-1);

  // St. Charles first (current focus), then other counties alphabetically.
  const counties = [...new Set((js ?? []).map((j) => j.county))].sort((a, b) =>
    a === "St. Charles" ? -1 : b === "St. Charles" ? 1 : a.localeCompare(b));
  const order = { county: 0, city: 1, town: 2, village: 3 } as Record<string, number>;

  return (
    <>
      <PageTitle href="/progress">Progress</PageTitle>
      <p className="muted">
        Research status for every municipality, by county. A municipality is complete when all four tasks are done.
        Use Edit in any cell to change its status or note.
        {lastUpdate && <> Last updated {fmtDate(lastUpdate)}.</>}
      </p>
      <p className={toReview ? "notice" : "small"}>
        <Link href="/sources">{toReview ? `${toReview} schedule source${toReview === 1 ? "" : "s"} changed and need${toReview === 1 ? "s" : ""} review →` : "Schedule sources (checked weekly) →"}</Link>
      </p>

      {counties.map((county) => {
        const list = (js ?? [])
          .filter((j) => j.county === county)
          .sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name));
        const complete = list.filter((j) => isComplete(j.id)).length;
        return (
          <section key={county} style={{ marginTop: 28 }}>
            <h2>
              {county} County{" "}
              <span className={`tag ${complete === list.length ? "complete" : "not_started"}`}>
                {complete} of {list.length} complete
              </span>
            </h2>
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table>
                <thead>
                  <tr>
                    <th>Municipality</th>
                    {TASKS.map((t) => {
                      const done = list.filter((j) => byJ.get(j.id)?.get(t.id)?.status === "done").length;
                      return <th key={t.id}>{t.label} <span className="muted">({done}/{list.length})</span></th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {list.map((j) => (
                    <tr key={j.id}>
                      <td>
                        <Link href={`/jurisdictions/${j.id}`}>{j.name}</Link>
                        {isComplete(j.id) && <> <span className="tag complete">Complete</span></>}
                      </td>
                      {TASKS.map((t) => {
                        const r = byJ.get(j.id)?.get(t.id);
                        const status = r?.status ?? "not_started";
                        return (
                          <td key={t.id}>
                            <span className={`tag progress-${status}`}>{PROGRESS_LABEL[status]}</span>
                            {r?.note && <div className="muted" style={{ fontSize: ".8rem", marginTop: 4 }}>{r.note}</div>}
                            {r && (
                              <details className="cell-edit">
                                <summary>Edit</summary>
                                <form key={`${status}|${r.note ?? ""}`} action={updateProgress.bind(null, j.id, t.id)} className="stack-form">
                                  <select name="status" defaultValue={status} aria-label="Status">
                                    {Object.entries(PROGRESS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                  </select>
                                  <textarea name="note" rows={3} defaultValue={r.note ?? ""} aria-label="Note" placeholder="Note" />
                                  <div><button type="submit">Save</button></div>
                                </form>
                              </details>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}
