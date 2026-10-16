import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAGE_LABEL, fmtDate, fmtTime, shortName, todayCentral } from "@/lib/format";
import { TASK_SELECT, Task, TaskForm, TaskList, assignees } from "@/components/Tasks";
import { distanceTo, loadCases, caseTypes, ZONING_TYPES } from "@/lib/cases";
import CaseRow from "@/components/CaseRow";
import { RESULT_LABEL } from "@/lib/votes";
import TimelineCard from "@/components/TimelineCard";
import { STEP_LABEL, currentStep, loadDelays, loadTimeline } from "@/lib/timeline";
import { createWatch } from "@/app/alerts/actions";
import { addChecklistItem, addDelay, addNote, applyTemplate, confirmPossibleDelay, deleteChecklistItem, deleteDelay, dismissPossibleDelay,
  setChecklistDone, updateProject } from "../actions";

export const dynamic = "force-dynamic";

// Suggestions for the delay reason field.
const DELAY_REASONS = ["Applicant requested continuance", "Staff report not ready", "Continued by P&Z", "Tabled by council",
  "Meeting cancelled", "No quorum", "Public notice issue", "Resubmittal required"];

const stamp = (ts: string) =>
  new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ start?: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const today = todayCentral();
  const { start: startParam } = await searchParams;
  const start = startParam && /^\d{4}-\d{2}-\d{2}$/.test(startParam) && startParam >= today ? startParam : today;
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

  // Once a filing date is set the timeline is the project's own schedule, and postponements shift it.
  const filed = !!p.filed_on;
  const timelineStart = p.filed_on ?? start;
  const [delays, { data: possible }, { data: sightings }] = await Promise.all([
    loadDelays(supabase, id),
    supabase.from("project_alerts").select("id, title, body, created_at").eq("project_id", id).eq("kind", "possible_delay")
      .is("resolved_at", null).order("created_at"),
    supabase.from("project_case_events").select("meeting_id, body, event_date, kind").eq("project_id", id).order("event_date"),
  ]);

  const [{ data: meetings }, { data: recorded }, timeline, { data: boardMeetings }] = p.jurisdiction_id
    ? await Promise.all([
        supabase.from("meetings").select("*").eq("jurisdiction_id", p.jurisdiction_id).gte("event_date", today).order("event_date").limit(6),
        supabase.from("meetings").select("id, body, event_date").eq("jurisdiction_id", p.jurisdiction_id)
          .not("summary", "is", null).order("event_date", { ascending: false }).limit(4),
        loadTimeline(supabase, p.jurisdiction_id, timelineStart, filed ? delays : []),
        supabase.from("meetings").select("id, body, event_date, status").eq("jurisdiction_id", p.jurisdiction_id).eq("event_type", "meeting")
          .in("body", ["planning_zoning", "governing_body"]).neq("status", "cancelled").gte("event_date", today).order("event_date").limit(40),
      ])
    : [{ data: [] }, { data: [] }, null, { data: [] }];
  const pzNow = timeline && filed ? currentStep(timeline.best, "pz") : undefined;
  const councilNow = timeline && filed ? currentStep(timeline.best, "council") : undefined;
  const meetingName = (m: { body: string; event_date: string; status: string }) =>
    `${m.body === "planning_zoning" ? "P&Z" : "Council"} ${fmtDate(m.event_date)}${m.status === "projected" ? " (projected)" : ""}`;

  // Land-use cases near the site (rezonings, PUDs, special uses, annexations, plats, site plans) within 3 miles.
  const NEAR_MILES = 3;
  const nearby = p.lat != null
    ? (await loadCases(supabase))
        .map((c) => ({ c, d: distanceTo(c, p) }))
        .filter(({ c, d }) => d != null && d <= NEAR_MILES && caseTypes(c).some((t) => [...ZONING_TYPES, "preliminary_plat", "final_plat", "site_plan"].includes(t)))
        .sort((a, b) => a.d! - b.d!)
    : [];
  const { data: watching } = await supabase.from("watches").select("id").eq("project_id", id).limit(1);

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
          {/* Keyed on updated_at: React resets the form after a save, and a <select> would otherwise snap back to the old stage (suggestion #18). */}
          <form key={p.updated_at} action={updateProject.bind(null, id)} className="card stack-form">
            <label>Name<input name="name" defaultValue={p.name} required /></label>
            <label>Stage
              <select name="stage" defaultValue={p.stage}>
                {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Municipality
              <select name="jurisdiction_id" defaultValue={p.jurisdiction_id ?? ""}>
                <option value="">Not sure yet</option>
                {(jurisdictions ?? []).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </label>
            <label>Diligence expires<input name="diligence_expires_on" type="date" defaultValue={p.diligence_expires_on ?? ""} /></label>
            <label>Projected close date<input name="closing_on" type="date" defaultValue={p.closing_on ?? ""} /></label>
            <label>City case number(s)<input name="case_numbers" defaultValue={p.case_numbers ?? ""} placeholder="e.g. P.Z. 13-26, comma-separated" /></label>
            <label>Application filed (or planned)<input name="filed_on" type="date" defaultValue={p.filed_on ?? ""} /></label>
            <label>Address / location<input name="address" defaultValue={p.address ?? ""} /></label>
            <label>Parcel ID(s)<input name="parcel_ids" defaultValue={p.parcel_ids ?? ""} /></label>
            <label>Acreage<input name="acreage" type="number" step="any" min="0" defaultValue={p.acreage ?? ""} /></label>
            <label>Current zoning<input name="current_zoning" defaultValue={p.current_zoning ?? ""} /></label>
            <label>Proposed zoning<input name="proposed_zoning" defaultValue={p.proposed_zoning ?? ""} /></label>
            <label>Description<textarea name="description" rows={3} defaultValue={p.description ?? ""} /></label>
            <div><button type="submit">Save</button></div>
          </form>

          <h2>Nearby land-use cases</h2>
          <div className="card">
            {p.lat == null ? (
              <p className="muted small" style={{ margin: 0 }}>Add a street address in Details to see cases near this site.</p>
            ) : nearby.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>Nothing within {NEAR_MILES} miles on agendas from the last 45 days or upcoming.</p>
            ) : (
              <ul className="case-list compact">
                {nearby.map(({ c, d }) => <CaseRow key={`${c.meeting_id}-${c.idx}`} c={c} isNew={false} miles={d} />)}
              </ul>
            )}
            {p.lat != null && (watching?.length ? (
              <p className="small" style={{ marginBottom: 0 }}><Link href="/alerts">You&apos;re watching this area →</Link></p>
            ) : (
              <form action={createWatch} style={{ marginTop: 10 }}>
                <input type="hidden" name="project_id" value={p.id} />
                <input type="hidden" name="radius_miles" value={NEAR_MILES} />
                <button type="submit" className="link">+ Watch this area (alert on new cases within {NEAR_MILES} mi)</button>
              </form>
            ))}
          </div>

          {p.jurisdiction_id && (
            <>
              <h2>Expected timeline</h2>
              {timeline && <TimelineCard t={timeline} start={timelineStart} today={today} filed={filed} />}

              {(possible ?? []).length > 0 && (
                <div className="card possible-delays">
                  <strong className="small">Possible delays found on agendas and minutes</strong>
                  <ul className="plain small">
                    {possible!.map((a) => (
                      <li key={a.id}>
                        <div>{a.body}</div>
                        <div className="row-actions">
                          {filed ? (
                            <form action={confirmPossibleDelay.bind(null, a.id)}><button type="submit" className="link">Log as delay</button></form>
                          ) : <span className="muted">Set the filing date to log it.</span>}
                          <form action={dismissPossibleDelay.bind(null, a.id)}><button type="submit" className="link">Not a delay</button></form>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {filed && (pzNow?.date || councilNow?.date) && (
                <form action={addDelay.bind(null, id)} className="card stack-form">
                  <strong className="small">Log a delay</strong>
                  <label>What was postponed
                    <select name="step" defaultValue={pzNow?.date && pzNow.date >= today ? "pz" : "council"}>
                      {pzNow?.date && <option value="pz">P&amp;Z hearing ({fmtDate(pzNow.date)})</option>}
                      {councilNow?.date && <option value="council">Council vote ({fmtDate(councilNow.date)})</option>}
                    </select>
                  </label>
                  <label>New date
                    <select name="to_meeting_id" defaultValue="">
                      <option value="">The board&apos;s next meeting</option>
                      {(boardMeetings ?? []).map((m) => <option key={m.id} value={m.id}>{meetingName(m)}</option>)}
                    </select>
                  </label>
                  <label>Reason<input name="reason" list="delay-reasons" placeholder="e.g. Applicant requested continuance" /></label>
                  <datalist id="delay-reasons">{DELAY_REASONS.map((r) => <option key={r} value={r} />)}</datalist>
                  <label>Your name<input name="reported_by" list="note-authors" /></label>
                  <div><button type="submit">Log delay and alert the team</button></div>
                </form>
              )}
              {(sightings ?? []).length > 0 && (
                <div className="card">
                  <strong className="small">This case on agendas and in minutes</strong>
                  <ul className="plain small">
                    {[...new Map(sightings!.map((e) => [`${e.meeting_id}-${e.kind}`, e])).values()].map((e) => (
                      <li key={`${e.meeting_id}-${e.kind}`}>
                        <Link href={`/meetings/${e.meeting_id}`}>{fmtDate(e.event_date)} {e.body === "planning_zoning" ? "P&Z" : "Council"}</Link>
                        {e.kind === "agenda" ? <span className="muted"> · on the agenda</span> : <> <span className={`tag result-${e.kind}`}>{RESULT_LABEL[e.kind] ?? e.kind}</span></>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!filed && (
                <p className="small muted">Set the filing date in Details to track this project&apos;s own schedule and log delays.</p>
              )}
              {delays.length > 0 && (
                <div className="card">
                  <strong className="small">Delays</strong>
                  <ul className="plain small">
                    {delays.map((d) => (
                      <li key={d.id}>
                        {STEP_LABEL[d.step]}{d.from_date && <> from {fmtDate(d.from_date)}</>}{d.reason && <> · {d.reason}</>}
                        <span className="muted"> · {d.reported_by ? `${d.reported_by}, ` : ""}{stamp(d.created_at)}</span>{" "}
                        <form action={deleteDelay.bind(null, d.id)} style={{ display: "inline" }}>
                          <button type="submit" className="link small">Remove</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <h2>Upcoming in {shortName(p.jurisdictions?.name ?? "")}</h2>
              <div className="card">
                {(meetings ?? []).length === 0 ? (
                  <p className="muted small" style={{ margin: 0 }}>No schedule loaded yet for this municipality.</p>
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
