import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CLOSED_STAGES, STAGE_LABEL, addDays, fmtDate, shortName, todayCentral } from "@/lib/format";
import { BODY_LABEL } from "@/components/MeetingSummary";
import PageTitle from "@/components/PageTitle";
import { Timeline, daysBetween, loadTimeline } from "@/lib/timeline";

export const dynamic = "force-dynamic";

// Pipeline columns, left to right. Closed projects are counted, not shown.
const PIPELINE = ["prospect", "loi", "diligence", "development"];
// Upcoming meetings and deadlines listed for the project municipalities.
const AHEAD_DAYS = 30;
// Stage moves listed under "Recent moves".
const RECENT_DAYS = 60;

type Project = {
  id: number; name: string; stage: string; jurisdiction_id: string | null; address: string | null;
  acreage: number | null; current_zoning: string | null; proposed_zoning: string | null; updated_at: string;
  jurisdictions: { name: string } | null;
  checklist_items: { done_at: string | null }[];
  tasks: { due_date: string | null; done_at: string | null }[];
  project_notes: { body: string; author: string | null; created_at: string }[];
};
type Change = { project_id: number; from_stage: string | null; to_stage: string; changed_at: string; baseline: boolean };

const dateOf = (ts: string) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
// "Oct 14" on the cards; the year only when it isn't this year.
const shortDate = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US",
  { month: "short", day: "numeric", ...(d.slice(0, 4) !== todayCentral().slice(0, 4) && { year: "numeric" }), timeZone: "UTC" });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function DashboardPage() {
  const today = todayCentral();
  const supabase = await createClient();
  const [{ data }, { data: changes }] = await Promise.all([
    supabase.from("projects")
      .select("id, name, stage, jurisdiction_id, address, acreage, current_zoning, proposed_zoning, updated_at, jurisdictions(name), checklist_items(done_at), tasks(due_date, done_at), project_notes(body, author, created_at)")
      .order("updated_at", { ascending: false }),
    supabase.from("project_stage_changes").select("project_id, from_stage, to_stage, changed_at, baseline").order("changed_at", { ascending: false }),
  ]);
  const all = (data ?? []) as unknown as Project[];
  const active = all.filter((p) => !CLOSED_STAGES.includes(p.stage));
  const closed = all.length - active.length;
  const log = (changes ?? []) as Change[];
  const lastChange = new Map<number, Change>();
  for (const c of log) if (!lastChange.has(c.project_id)) lastChange.set(c.project_id, c);

  // One timeline per municipality: what filing today would look like.
  const places = [...new Set(active.map((p) => p.jurisdiction_id).filter((j): j is string => !!j))];
  const [timelines, { data: ahead }] = await Promise.all([
    Promise.all(places.map((j) => loadTimeline(supabase, j, today))),
    places.length
      ? supabase.from("meetings").select("id, jurisdiction_id, body, event_type, event_date, status, jurisdictions(name)")
          .in("jurisdiction_id", places).gte("event_date", today).lte("event_date", addDays(today, AHEAD_DAYS))
          .neq("status", "cancelled").in("body", ["planning_zoning", "governing_body"]).order("event_date")
      : Promise.resolve({ data: [] }),
  ]);
  const timelineFor = new Map<string, Timeline>(places.map((j, i) => [j, timelines[i]]));

  const totalAcres = active.reduce((s, p) => s + (p.acreage ?? 0), 0);
  const openTasks = active.flatMap((p) => p.tasks.filter((t) => !t.done_at));
  const overdue = openTasks.filter((t) => t.due_date && t.due_date < today).length;
  const recent = log.filter((c) => !c.baseline && dateOf(c.changed_at) >= addDays(today, -RECENT_DAYS));
  const byId = new Map(all.map((p) => [p.id, p]));

  return (
    <>
      <PageTitle href="/dashboard">Dashboard</PageTitle>
      <p className="muted">
        Where each project stands. {closed > 0 && <><Link href="/projects?show=all">{closed} closed</Link> not shown. </>}
        <Link href="/projects">All projects</Link>
      </p>

      <div className="stat-row">
        <div className="card stat"><div className="stat-value">{active.length}</div><div className="stat-label">Active projects</div></div>
        <div className="card stat"><div className="stat-value">{totalAcres ? Math.round(totalAcres).toLocaleString() : "—"}</div><div className="stat-label">Acres{active.some((p) => p.acreage == null) && <> · {active.filter((p) => p.acreage != null).length} of {active.length} entered</>}</div></div>
        <div className="card stat"><div className="stat-value">{places.length}</div><div className="stat-label">Municipalities</div></div>
        <div className="card stat">
          <div className="stat-value">{openTasks.length}</div>
          <div className="stat-label">Open tasks{overdue > 0 && <> · <span className="tag due">{overdue} overdue</span></>}</div>
        </div>
      </div>

      <div className="pipeline">
        {PIPELINE.map((stage) => {
          const list = active.filter((p) => p.stage === stage);
          return (
            <section key={stage} className="pipeline-col">
              <h2><span className={`tag stage-${stage}`}>{STAGE_LABEL[stage]}</span> <span className="muted small">{list.length}</span></h2>
              {list.length === 0 && <div className="pipeline-empty small muted">None</div>}
              {list.map((p) => (
                <ProjectCard key={p.id} p={p} today={today} change={lastChange.get(p.id)}
                  timeline={p.jurisdiction_id ? timelineFor.get(p.jurisdiction_id) : undefined} />
              ))}
            </section>
          );
        })}
      </div>

      <div className="dash-lower">
        <section>
          <h2>Coming up in the next {AHEAD_DAYS} days</h2>
          <div className="card">
            {!ahead?.length ? (
              <p className="muted small" style={{ margin: 0 }}>No P&amp;Z or council meetings loaded for the project municipalities.</p>
            ) : (
              <ul className="plain dash-list">
                {(ahead as unknown as { id: number; body: string; event_type: string; event_date: string; status: string; jurisdictions: { name: string } | null }[]).map((m) => (
                  <li key={m.id}>
                    <strong>{fmtDate(m.event_date)}</strong>{" "}
                    <Link href={`/meetings/${m.id}`}>
                      {shortName(m.jurisdictions?.name ?? "")} {m.event_type === "submittal_deadline" ? `${BODY_LABEL[m.body] ?? m.body} submittal deadline` : BODY_LABEL[m.body] ?? m.body}
                    </Link>
                    {m.status === "projected" && <span className="tag tentative">est.</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section>
          <h2>Recent moves</h2>
          <div className="card">
            {recent.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>No stage changes in the last {RECENT_DAYS} days. Stage history is kept from Oct 14, 2026.</p>
            ) : (
              <ul className="plain dash-list">
                {recent.map((c, i) => (
                  <li key={i}>
                    <strong>{fmtDate(dateOf(c.changed_at))}</strong>{" "}
                    <Link href={`/projects/${c.project_id}`}>{byId.get(c.project_id)?.name ?? `Project ${c.project_id}`}</Link>:{" "}
                    {c.from_stage ? `${STAGE_LABEL[c.from_stage] ?? c.from_stage} → ` : "added as "}{STAGE_LABEL[c.to_stage] ?? c.to_stage}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function ProjectCard({ p, today, change, timeline }: { p: Project; today: string; change?: Change; timeline?: Timeline }) {
  const done = p.checklist_items.filter((c) => c.done_at).length;
  const total = p.checklist_items.length;
  const open = p.tasks.filter((t) => !t.done_at);
  const late = open.filter((t) => t.due_date && t.due_date < today).length;
  const nextDue = open.map((t) => t.due_date).filter((d): d is string => !!d).sort()[0];
  const note = [...p.project_notes].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const since = change ? dateOf(change.changed_at) : null;
  const days = since ? daysBetween(since, today) : null;
  const hearing = timeline?.best.steps.find((s) => s.label === "P&Z hearing");
  const zoning = p.current_zoning || p.proposed_zoning ? `${p.current_zoning ?? "?"} → ${p.proposed_zoning ?? "?"}` : null;

  return (
    <article className="card project-card">
      <Link href={`/projects/${p.id}`} className="project-card-name">{p.name}</Link>
      <div className="small muted">
        {p.jurisdictions ? shortName(p.jurisdictions.name) : "Municipality not set"}
        {p.acreage != null && <> · {p.acreage} ac</>}
        {zoning && <> · {zoning}</>}
      </div>

      <div className="small">
        {since && (change?.baseline
          ? <>In {STAGE_LABEL[p.stage]} since at least {shortDate(since)}</>
          : <>In {STAGE_LABEL[p.stage]} {days === 0 ? "since today" : `for ${plural(days!, "day")}`}</>)}
      </div>

      {total > 0 && (
        <div className="small">
          <div className="meter" role="img" aria-label={`Checklist ${done} of ${total}`}><span style={{ width: `${(done / total) * 100}%` }} /></div>
          Checklist {done} of {total}
        </div>
      )}

      <div className="small">
        {open.length ? plural(open.length, "open task") : "No open tasks"}
        {late > 0 && <> · <span className="tag due">{late} overdue</span></>}
        {nextDue && !late && <> · next {shortDate(nextDue)}</>}
      </div>

      {hearing && (
        <div className="small muted">
          If filed now: P&amp;Z {hearing.date ? shortDate(hearing.date) : "past the loaded schedule"}
          {timeline?.best.finalDate && <>, council {shortDate(timeline.best.finalDate)}</>}
        </div>
      )}

      {note && (
        <div className="small project-card-note">
          <span className="muted">{shortDate(dateOf(note.created_at))}{note.author ? ` · ${note.author}` : ""}:</span>{" "}
          {note.body.length > 140 ? `${note.body.slice(0, 140)}…` : note.body}
        </div>
      )}
    </article>
  );
}
