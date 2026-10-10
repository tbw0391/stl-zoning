import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAGE_LABEL, fmtDate, fmtTime, shortName, todayCentral } from "@/lib/format";
import { TASK_SELECT, Task, TaskForm, TaskList, assignees } from "@/components/Tasks";
import { addChecklistItem, addNote, applyTemplate, deleteChecklistItem, setChecklistDone, updateProject } from "../actions";

export const dynamic = "force-dynamic";

const stamp = (ts: string) =>
  new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const today = todayCentral();
  const supabase = await createClient();

  const [{ data: p }, { data: notes }, { data: checklist }, { data: tasks }, { data: names }, { data: jurisdictions }, { data: activeDefaults }] = await Promise.all([
    supabase.from("projects").select("*, jurisdictions(name)").eq("id", id).maybeSingle(),
    supabase.from("project_notes").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("checklist_items").select("*").eq("project_id", id).order("sort_order").order("id"),
    supabase.from("tasks").select(TASK_SELECT).eq("project_id", id).order("done_at", { nullsFirst: true }).order("due_date", { nullsFirst: false }),
    supabase.from("tasks").select("assigned_to"),
    supabase.from("jurisdictions").select("id, name").order("name"),
    supabase.from("checklist_templates").select("id").eq("active", true),
  ]);
  if (!p) notFound();

  const [{ data: meetings }, { data: recorded }] = p.jurisdiction_id
    ? await Promise.all([
        supabase.from("meetings").select("*").eq("jurisdiction_id", p.jurisdiction_id).gte("event_date", today).order("event_date").limit(6),
        supabase.from("meetings").select("id, body, event_date").eq("jurisdiction_id", p.jurisdiction_id)
          .not("summary", "is", null).order("event_date", { ascending: false }).limit(4),
      ])
    : [{ data: [] }, { data: [] }];

  const items = checklist ?? [];
  const done = items.filter((c) => c.done_at).length;
  const templatedIds = new Set(items.map((c) => c.from_template).filter(Boolean));
  const canApplyTemplate = (activeDefaults ?? []).some((t) => !templatedIds.has(t.id));
  const authors = [...new Set((notes ?? []).map((n) => n.author).filter(Boolean))] as string[];

  return (
    <>
      <p className="small"><Link href="/projects">← All projects</Link></p>
      <h1>{p.name}</h1>
      <p className="muted">
        <span className={`tag stage-${p.stage}`}>{STAGE_LABEL[p.stage]}</span>
        {p.jurisdictions && <> · <Link href={`/jurisdictions/${p.jurisdiction_id}`}>{p.jurisdictions.name}</Link></>}
        {p.address && <> · {p.address}</>}
      </p>

      <div className="project-grid">
        <div>
          <h2>Checklist <span className="muted small">{items.length ? `${done} of ${items.length} done` : ""}</span></h2>
          <div className="card">
            {items.length === 0 && <p className="muted small" style={{ marginTop: 0 }}>No items yet. Add one below{canApplyTemplate ? " or load the default checklist" : ""}.</p>}
            <ul className="checklist">
              {items.map((c) => (
                <li key={c.id} className={c.done_at ? "done" : undefined}>
                  <form action={setChecklistDone.bind(null, c.id, !c.done_at)}>
                    <button type="submit" className="link" aria-label={c.done_at ? "Uncheck" : "Check"}>{c.done_at ? "☑" : "☐"}</button>
                  </form>
                  <span className="grow">{c.body}{!c.from_template && <span className="small muted"> · added</span>}</span>
                  {c.done_at && <span className="small muted">{fmtDate(c.done_at.slice(0, 10))}</span>}
                  {!c.from_template && (
                    <form action={deleteChecklistItem.bind(null, c.id)}>
                      <button type="submit" className="link small" aria-label="Remove item">Remove</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <form action={addChecklistItem.bind(null, id)} className="row-form">
              <input name="body" required placeholder="Add an item for this project" />
              <button type="submit">Add</button>
            </form>
            {canApplyTemplate && (
              <form action={applyTemplate.bind(null, id)}>
                <button type="submit" className="link small">Add missing default checklist items</button>
              </form>
            )}
          </div>

          <h2>Tasks</h2>
          <TaskForm projectId={id} people={assignees(names)} />
          {(tasks ?? []).length > 0 ? <TaskList tasks={tasks as Task[]} showProject={false} /> : <div className="card empty">No tasks for this project.</div>}

          <h2>Notes</h2>
          <form action={addNote.bind(null, id)} className="card stack-form">
            <textarea name="body" rows={3} required placeholder="Call notes, meeting takeaways, anything worth keeping" />
            <div className="row-form">
              <input name="author" list="note-authors" placeholder="Your name" />
              <datalist id="note-authors">{authors.map((a) => <option key={a} value={a} />)}</datalist>
              <button type="submit">Add note</button>
            </div>
          </form>
          {(notes ?? []).map((n) => (
            <div key={n.id} className="note">
              <div className="small muted">{n.author ?? "Unknown"} · {stamp(n.created_at)}</div>
              <div className="note-body">{n.body}</div>
            </div>
          ))}
        </div>

        <aside>
          <h2>Details</h2>
          <form action={updateProject.bind(null, id)} className="card stack-form">
            <label>Name<input name="name" defaultValue={p.name} required /></label>
            <label>Stage
              <select name="stage" defaultValue={p.stage}>
                {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Jurisdiction
              <select name="jurisdiction_id" defaultValue={p.jurisdiction_id ?? ""}>
                <option value="">Not sure yet</option>
                {(jurisdictions ?? []).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </label>
            <label>Address / location<input name="address" defaultValue={p.address ?? ""} /></label>
            <label>Parcel ID(s)<input name="parcel_ids" defaultValue={p.parcel_ids ?? ""} /></label>
            <label>Acreage<input name="acreage" type="number" step="any" min="0" defaultValue={p.acreage ?? ""} /></label>
            <label>Current zoning<input name="current_zoning" defaultValue={p.current_zoning ?? ""} /></label>
            <label>Proposed zoning<input name="proposed_zoning" defaultValue={p.proposed_zoning ?? ""} /></label>
            <label>Description<textarea name="description" rows={3} defaultValue={p.description ?? ""} /></label>
            <div><button type="submit">Save</button></div>
          </form>

          {p.jurisdiction_id && (
            <>
              <h2>Upcoming in {shortName(p.jurisdictions?.name ?? "")}</h2>
              <div className="card">
                {(meetings ?? []).length === 0 ? (
                  <p className="muted small" style={{ margin: 0 }}>No schedule loaded yet for this jurisdiction.</p>
                ) : (
                  <ul className="plain">
                    {meetings!.map((m) => (
                      <li key={m.id}>
                        <strong>{fmtDate(m.event_date)}</strong>{" "}
                        {m.event_type === "submittal_deadline" ? "Submittal deadline" : m.body === "planning_zoning" ? "P&Z meeting" : "Council / Aldermen"}
                        {m.event_time && <span className="muted"> · {fmtTime(m.event_time)}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {(recorded ?? []).length > 0 && (
                <>
                  <h2>Recent meeting summaries</h2>
                  <div className="card">
                    <ul className="plain">
                      {recorded!.map((m) => (
                        <li key={m.id}>
                          <Link href={`/meetings/${m.id}`}><strong>{fmtDate(m.event_date)}</strong> {m.body === "planning_zoning" ? "P&Z" : "Council / Aldermen"}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
