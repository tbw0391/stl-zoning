import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CLOSED_STAGES, STAGE_LABEL, fmtDate, shortName, todayCentral } from "@/lib/format";
import { createProject } from "./actions";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  name: string;
  jurisdiction_id: string | null;
  address: string | null;
  stage: string;
  updated_at: string;
  jurisdictions: { name: string } | null;
  checklist_items: { done_at: string | null }[];
  tasks: { due_date: string | null; done_at: string | null }[];
};

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const showClosed = sp.show === "all";
  const today = todayCentral();
  const supabase = await createClient();

  const [{ data }, { data: jurisdictions }] = await Promise.all([
    supabase.from("projects")
      .select("id, name, jurisdiction_id, address, stage, updated_at, jurisdictions(name), checklist_items(done_at), tasks(due_date, done_at)")
      .order("updated_at", { ascending: false }),
    supabase.from("jurisdictions").select("id, name").order("name"),
  ]);
  const all = (data ?? []) as unknown as Row[];
  const rows = showClosed ? all : all.filter((p) => !CLOSED_STAGES.includes(p.stage));
  const closedCount = all.length - all.filter((p) => !CLOSED_STAGES.includes(p.stage)).length;

  return (
    <>
      <PageTitle href="/projects">Projects</PageTitle>
      <p className="muted">
        {rows.length} {showClosed ? "" : "active "}project{rows.length === 1 ? "" : "s"}.{" "}
        {closedCount > 0 && (showClosed ? <Link href="/projects">Hide closed</Link> : <Link href="/projects?show=all">Show {closedCount} closed</Link>)}
        {" · "}<Link href="/projects/checklist">Default checklist</Link>
      </p>

      {rows.length === 0 ? (
        <div className="card empty">No projects yet. Add one below.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Project</th><th>Jurisdiction</th><th>Stage</th><th>Checklist</th><th>Open tasks</th><th>Next follow-up</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const done = p.checklist_items.filter((c) => c.done_at).length;
                const open = p.tasks.filter((t) => !t.done_at);
                const next = open.map((t) => t.due_date).filter((d): d is string => !!d).sort()[0];
                return (
                  <tr key={p.id}>
                    <td><Link href={`/projects/${p.id}`}><strong>{p.name}</strong></Link>{p.address && <div className="small muted">{p.address}</div>}</td>
                    <td>{p.jurisdictions ? <Link href={`/jurisdictions/${p.jurisdiction_id}`}>{shortName(p.jurisdictions.name)}</Link> : <span className="muted">—</span>}</td>
                    <td><span className={`tag stage-${p.stage}`}>{STAGE_LABEL[p.stage]}</span></td>
                    <td>{p.checklist_items.length ? `${done} of ${p.checklist_items.length}` : <span className="muted">—</span>}</td>
                    <td>{open.length || <span className="muted">0</span>}</td>
                    <td>{next ? <span className={next < today ? "tag due" : undefined}>{fmtDate(next)}</span> : <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2>New project</h2>
      <form action={createProject} className="card stack-form">
        <label>Name<input name="name" required placeholder="e.g. Hwy N & Bryan Rd" /></label>
        <label>Jurisdiction
          <select name="jurisdiction_id" defaultValue="">
            <option value="">Not sure yet</option>
            {(jurisdictions ?? []).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </label>
        <label>Address / location<input name="address" /></label>
        <div><button type="submit">Create project</button></div>
      </form>
    </>
  );
}
