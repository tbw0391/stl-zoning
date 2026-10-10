import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, todayCentral } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function JurisdictionsPage() {
  const supabase = await createClient();
  const today = todayCentral();
  const [{ data: js }, { data: procs }, { data: meetings }, { data: people }] = await Promise.all([
    supabase.from("jurisdictions").select("id, name, kind, governing_body, research_status").order("name"),
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

  return (
    <>
      <h1>Jurisdictions</h1>
      <p className="muted">St. Charles County and its municipalities, plus a St. Louis County placeholder. Click one for its rezoning process, dates and contacts.</p>
      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr><th>Jurisdiction</th><th>Governing body</th><th>Research</th><th>Rezoning process</th><th>Schedule through</th><th>People</th></tr>
          </thead>
          <tbody>
            {sorted.map((j) => {
              const last = lastDate(j.id);
              return (
                <tr key={j.id}>
                  <td><Link href={`/jurisdictions/${j.id}`}>{j.name}</Link></td>
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
    </>
  );
}
