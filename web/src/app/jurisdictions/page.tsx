import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, todayCentral } from "@/lib/format";
import PageTitle from "@/components/PageTitle";
import FollowPicker from "./FollowPicker";

export const dynamic = "force-dynamic";

export default async function JurisdictionsPage() {
  const supabase = await createClient();
  const today = todayCentral();
  const [{ data: js }, { data: procs }, { data: meetings }, { data: people }] = await Promise.all([
    supabase.from("jurisdictions").select("id, name, kind, county, governing_body, research_status, followed").order("name"),
    supabase.from("rezoning_processes").select("jurisdiction_id"),
    supabase.from("meetings").select("jurisdiction_id, event_date").gte("event_date", today),
    supabase.from("people").select("jurisdiction_id").eq("active", true),
  ]);

  const hasProc = new Set((procs ?? []).map((p) => p.jurisdiction_id));
  const count = (rows: { jurisdiction_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.jurisdiction_id === id).length;
  const lastDate = (id: string) => (meetings ?? []).filter((m) => m.jurisdiction_id === id).map((m) => m.event_date).sort().at(-1);

  // County first, then cities, then towns and villages.
  const order = { county: 0, city: 1, town: 2, village: 3 } as Record<string, number>;
  const sorted = [...(js ?? [])].sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name));
  const followed = sorted.filter((j) => j.followed);
  const off = sorted.filter((j) => !j.followed);
  const counties = [...new Set(sorted.map((j) => j.county))].sort((a, b) =>
    a === "St. Charles" ? -1 : b === "St. Charles" ? 1 : a.localeCompare(b));

  const table = (rows: typeof sorted) => (
    <div className="table-wrap" style={{ marginTop: 8 }}>
      <table>
        <thead>
          <tr><th>Jurisdiction</th><th>County</th><th>Governing body</th><th>Research</th><th>Rezoning process</th><th>Schedule through</th><th>People</th></tr>
        </thead>
        <tbody>
          {rows.map((j) => {
            const last = lastDate(j.id);
            return (
              <tr key={j.id} className={j.followed ? undefined : "muted"}>
                <td><Link href={`/jurisdictions/${j.id}`}>{j.name}</Link></td>
                <td>{j.county}</td>
                <td>{j.governing_body ?? <span className="muted">—</span>}</td>
                <td><span className={`tag ${j.research_status}`}>{STATUS_LABEL[j.research_status] ?? j.research_status}</span></td>
                <td>{hasProc.has(j.id) ? "Yes" : <span className="muted">Not yet</span>}</td>
                <td>{last ? last : <span className="muted">Not loaded</span>}</td>
                <td>{count(people, j.id) || <span className="muted">0</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <PageTitle href="/jurisdictions">Jurisdictions</PageTitle>
      <p className="muted">St. Charles County in depth, plus St. Louis, Jefferson and Franklin County cities whose meetings are collected automatically. Click one for its rezoning process, dates and contacts.</p>
      <h2>Which jurisdictions to follow</h2>
      <p className="small">
        Untick a jurisdiction to leave it out of the calendar, meetings, rezonings, votes, alerts, directory, progress and the weekly email;
        its meetings stop being collected and its agendas and minutes stop being read. Nothing is deleted, and ticking it again picks back up.
      </p>
      <FollowPicker jurisdictions={sorted.map(({ id, name, county, followed }) => ({ id, name, county, followed }))} counties={counties} />
      <h2>Following ({followed.length})</h2>
      {followed.length ? table(followed) : <div className="card empty">Not following any jurisdictions.</div>}
      {off.length > 0 && <>
        <h2>Not following ({off.length})</h2>
        {table(off)}
      </>}
    </>
  );
}
