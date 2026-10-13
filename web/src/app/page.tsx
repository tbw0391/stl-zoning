import Link from "next/link";
import { cookies } from "next/headers";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight, faList, faCalendarDays, faCalendarWeek, faRss } from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/lib/supabase/server";
import { skipUnfollowed, unfollowedIds } from "@/lib/followed";
import { addDays, addMonths, fmtDate, fmtMonth, fmtTime, shortName, startOfWeek, todayCentral } from "@/lib/format";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

type Meeting = {
  id: number;
  jurisdiction_id: string;
  body: "planning_zoning" | "governing_body";
  event_type: "meeting" | "submittal_deadline";
  event_date: string;
  event_time: string | null;
  location: string | null;
  note: string | null;
  linked_meeting: number | null;
  status: string;
  source_url: string | null;
  agenda_items: unknown[] | null;
};

type CalTask = { id: number; title: string; assigned_to: string | null; due_date: string; project_id: number | null; projects: { name: string } | null };
type Item = { kind: "meeting"; date: string; meeting: Meeting } | { kind: "task"; date: string; task: CalTask };
type View = "list" | "month" | "week";

const RANGES: Record<string, number> = { "90": 90, "180": 180, "365": 365 };
const VIEWS: { id: View; label: string; icon: typeof faList }[] = [
  { id: "list", label: "List", icon: faList },
  { id: "month", label: "Month", icon: faCalendarDays },
  { id: "week", label: "Week", icon: faCalendarWeek },
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  // The last view someone picked is remembered in a cookie (set by middleware).
  const picked = sp.view ?? (await cookies()).get("cal_view")?.value;
  const view: View = picked === "month" || picked === "week" ? picked : "list";
  const days = RANGES[sp.days ?? ""] ?? 180;
  const today = todayCentral();

  // Date window for the chosen view. Month and week grids start on Sunday.
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : today.slice(0, 7);
  const weekStart = startOfWeek(/^\d{4}-\d{2}-\d{2}$/.test(sp.w ?? "") ? sp.w! : today);
  let start = today, end = addDays(today, days);
  if (view === "month") {
    start = startOfWeek(month + "-01");
    end = addDays(startOfWeek(addDays(addMonths(month, 1) + "-01", -1)), 6);
  } else if (view === "week") {
    start = weekStart;
    end = addDays(weekStart, 6);
  }

  const supabase = await createClient();
  const off = await unfollowedIds(supabase);
  const showTasks = !sp.j && (!sp.type || sp.type === "tasks");
  const showMeetings = sp.type !== "tasks";
  const [{ data: jurisdictions }, { data: meetings }, { data: tasks }] = await Promise.all([
    supabase.from("jurisdictions").select("id, name, governing_body, county").order("name"),
    (() => {
      let q = supabase.from("meetings").select("*").gte("event_date", start).lte("event_date", end).order("event_date").order("event_time");
      q = sp.j ? q.eq("jurisdiction_id", sp.j) : skipUnfollowed(q, off);
      if (sp.type === "deadlines") q = q.eq("event_type", "submittal_deadline");
      if (sp.type === "pz") q = q.eq("body", "planning_zoning").eq("event_type", "meeting");
      if (sp.type === "gov") q = q.eq("body", "governing_body");
      if (!showMeetings) q = q.limit(0);
      return q;
    })(),
    // Open tasks with a follow-up date; overdue ones show under today.
    showTasks
      ? supabase.from("tasks").select("id, title, assigned_to, due_date, project_id, projects(name)").is("done_at", null)
          .not("due_date", "is", null).lte("due_date", end).order("due_date")
      : Promise.resolve({ data: [] }),
  ]);

  const jmap = new Map((jurisdictions ?? []).map((j) => [j.id, j]));
  const rows = (meetings ?? []) as Meeting[];

  // Deadlines link to the P&Z meeting they feed; look those up even if outside the range.
  const linkedIds = rows.map((m) => m.linked_meeting).filter((x): x is number => x != null);
  const { data: linked } = linkedIds.length
    ? await supabase.from("meetings").select("id, event_date").in("id", linkedIds)
    : { data: [] as { id: number; event_date: string }[] };
  const linkedDate = new Map((linked ?? []).map((m) => [m.id, m.event_date]));

  const { data: covered } = await skipUnfollowed(supabase.from("meetings").select("jurisdiction_id").gte("event_date", today), off);
  const coveredIds = [...new Set((covered ?? []).map((c) => c.jurisdiction_id))];

  const coveredByCounty = Object.entries(
    coveredIds.reduce<Record<string, number>>((acc, id) => {
      const c = jmap.get(id)?.county ?? "Other";
      acc[c] = (acc[c] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => (a[0] === "St. Charles" ? -1 : b[0] === "St. Charles" ? 1 : a[0].localeCompare(b[0])));

  const taskRows = (tasks ?? []) as unknown as CalTask[];
  const items: Item[] = [
    ...taskRows
      .map((t): Item => ({ kind: "task", date: t.due_date < today ? today : t.due_date, task: t }))
      .filter((it) => it.date >= start),
    ...rows.map((m): Item => ({ kind: "meeting", date: m.event_date, meeting: m })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const byDay = new Map<string, Item[]>();
  for (const it of items) {
    if (!byDay.has(it.date)) byDay.set(it.date, []);
    byDay.get(it.date)!.push(it);
  }

  // Query string for a link that keeps the current filters but changes some of them.
  const href = (change: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ j: sp.j, type: sp.type, days: sp.days, view: sp.view, m: sp.m, w: sp.w, ...change })) {
      if (v) p.set(k, v);
    }
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  function label(m: Meeting) {
    if (m.event_type === "submittal_deadline") return <span className="tag due">SUBMITTAL DUE</span>;
    if (m.body === "planning_zoning") return <span className="tag pz">P&amp;Z</span>;
    return <span className="tag gov">{govName(m).toUpperCase()}</span>;
  }
  function govName(m: Meeting) {
    return jmap.get(m.jurisdiction_id)?.governing_body?.replace(/\s*\(.*\)$/, "") ?? "Council";
  }
  const place = (m: Meeting) => shortName(jmap.get(m.jurisdiction_id)?.name ?? m.jurisdiction_id);

  // Compact entry for the month and week grids.
  function chip(it: Item) {
    if (it.kind === "task") {
      const t = it.task;
      const overdue = t.due_date < today;
      return (
        <Link key={`t${t.id}`} href="/tasks" className={`chip ${overdue ? "due" : "task"}`} title={`${t.title} — ${t.assigned_to ?? "Unassigned"}`}>
          <span className="chip-kind">{overdue ? "Overdue" : "Task"}</span> {t.title}
        </Link>
      );
    }
    const m = it.meeting;
    const kind = m.event_type === "submittal_deadline" ? "due" : m.body === "planning_zoning" ? "pz" : "gov";
    const what = kind === "due" ? "Submittal due" : kind === "pz" ? "P&Z" : govName(m);
    const tentative = m.status !== "published" ? ` (${m.status})` : "";
    return (
      <Link key={m.id} href={`/jurisdictions/${m.jurisdiction_id}`} className={`chip ${kind}${m.status === "cancelled" ? " cancelled" : ""}`}
        title={`${place(m)} — ${what}${m.event_time ? " " + fmtTime(m.event_time) : ""}${tentative}${m.location ? "\n" + m.location : ""}`}>
        <span className="chip-kind">{what}</span> {place(m)}
        {m.event_time && <span className="chip-time"> {fmtTime(m.event_time)}</span>}
        {m.status === "projected" && <span className="chip-time"> ?</span>}
      </Link>
    );
  }

  const gridDays = (from: string, to: string) => {
    const out: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
    return out;
  };

  return (
    <>
      <PageTitle href="/">Upcoming dates</PageTitle>
      <p className="muted coverage">
        Schedules loaded for {coveredIds.length} jurisdictions
        {coveredByCounty.length > 0 && <> ({coveredByCounty.map(([c, n]) => `${c} County ${n}`).join(", ")})</>}.
        Pick one under Jurisdiction to see just its dates.
      </p>

      <div className="cal-toolbar">
        <div className="seg" role="tablist" aria-label="Calendar view">
          {VIEWS.map((v) => (
            <Link key={v.id} href={href({ view: v.id })} className={view === v.id ? "on" : undefined} aria-current={view === v.id ? "page" : undefined}>
              <FontAwesomeIcon icon={v.icon} /> {v.label}
            </Link>
          ))}
        </div>
        <Link href="/subscribe" className="subscribe-link"><FontAwesomeIcon icon={faRss} /> Subscribe in Outlook / Google / iPhone</Link>
      </div>

      <form className="filters" method="get">
        <input type="hidden" name="view" value={view} />
        {view === "month" && sp.m && <input type="hidden" name="m" value={sp.m} />}
        {view === "week" && sp.w && <input type="hidden" name="w" value={sp.w} />}
        <label>Jurisdiction
          <select name="j" defaultValue={sp.j ?? ""}>
            <option value="">All</option>
            {(jurisdictions ?? []).filter((j) => coveredIds.includes(j.id)).map((j) => (
              <option key={j.id} value={j.id}>{shortName(j.name)}</option>
            ))}
          </select>
        </label>
        <label>Show
          <select name="type" defaultValue={sp.type ?? ""}>
            <option value="">Everything</option>
            <option value="deadlines">Submittal deadlines</option>
            <option value="pz">P&amp;Z meetings</option>
            <option value="gov">Council / Aldermen</option>
            <option value="tasks">Tasks only</option>
          </select>
        </label>
        {view === "list" && (
          <label>Range
            <select name="days" defaultValue={String(days)}>
              <option value="90">Next 3 months</option>
              <option value="180">Next 6 months</option>
              <option value="365">Next 12 months</option>
            </select>
          </label>
        )}
        <button type="submit">Apply</button>
      </form>

      {view === "month" && (
        <section className="cal">
          <div className="cal-nav">
            <Link href={href({ m: addMonths(month, -1) })} aria-label="Previous month"><FontAwesomeIcon icon={faChevronLeft} /></Link>
            <h2>{fmtMonth(month + "-01")}</h2>
            <Link href={href({ m: addMonths(month, 1) })} aria-label="Next month"><FontAwesomeIcon icon={faChevronRight} /></Link>
            {month !== today.slice(0, 7) && <Link href={href({ m: undefined })} className="small">This month</Link>}
          </div>
          <div className="cal-grid">
            {WEEKDAYS.map((d) => <div key={d} className="cal-head">{d}</div>)}
            {gridDays(start, end).map((d) => (
              <div key={d} className={`cal-day${d.slice(0, 7) !== month ? " outside" : ""}${d === today ? " today" : ""}${d < today ? " past" : ""}`}>
                <div className="cal-num">{Number(d.slice(8))}</div>
                <div className="cal-events">{(byDay.get(d) ?? []).map(chip)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {view === "week" && (
        <section className="cal">
          <div className="cal-nav">
            <Link href={href({ w: addDays(weekStart, -7) })} aria-label="Previous week"><FontAwesomeIcon icon={faChevronLeft} /></Link>
            <h2>Week of {fmtDate(weekStart).replace(/^\w+, /, "")}</h2>
            <Link href={href({ w: addDays(weekStart, 7) })} aria-label="Next week"><FontAwesomeIcon icon={faChevronRight} /></Link>
            {weekStart !== startOfWeek(today) && <Link href={href({ w: undefined })} className="small">This week</Link>}
          </div>
          <div className="week-grid">
            {gridDays(start, end).map((d, i) => (
              <div key={d} className={`week-day${d === today ? " today" : ""}${d < today ? " past" : ""}`}>
                <div className="week-head"><span>{WEEKDAYS[i]}</span> <strong>{Number(d.slice(8))}</strong></div>
                <div className="cal-events">
                  {(byDay.get(d) ?? []).map(chip)}
                  {!byDay.has(d) && <span className="muted small">—</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {view === "list" && items.length === 0 && <div className="card empty">No dates in this range.</div>}

      {view === "list" && [...new Set(items.map((it) => it.date.slice(0, 7)))].map((mo) => (
        <section className="month" key={mo}>
          <h2>{fmtMonth(mo + "-01")}</h2>
          {[...byDay.entries()].filter(([date]) => date.startsWith(mo)).map(([date, events]) => (
            <div className="day" key={date}>
              <div className="day-date">{fmtDate(date)}</div>
              <div className="events">
                {events.map((it) => {
                  if (it.kind === "task") {
                    const t = it.task;
                    return (
                      <div className="event" key={`t${t.id}`}>
                        <span className={t.due_date < today ? "tag due" : "tag task"}>{t.due_date < today ? "OVERDUE TASK" : "TASK"}</span>
                        <Link href="/tasks"><strong>{t.title}</strong></Link>
                        <span className="where">{t.assigned_to ?? "Unassigned"}</span>
                        {t.project_id && <Link href={`/projects/${t.project_id}`} className="small">{t.projects?.name ?? "Project"}</Link>}
                        {t.due_date < today && <span className="where">was due {fmtDate(t.due_date)}</span>}
                      </div>
                    );
                  }
                  const m = it.meeting;
                  const feeds = m.linked_meeting ? linkedDate.get(m.linked_meeting) : null;
                  return (
                    <div className="event" key={m.id}>
                      {label(m)}
                      <Link href={`/jurisdictions/${m.jurisdiction_id}`}><strong>{place(m)}</strong></Link>
                      {m.event_time && <span>{m.event_type === "submittal_deadline" ? "by " : ""}{fmtTime(m.event_time)}</span>}
                      {feeds && <span className="where">for P&amp;Z on {fmtDate(feeds)}</span>}
                      {m.status !== "published" && <span className="tag tentative">{m.status}</span>}
                      {m.event_type === "meeting" && m.location && <span className="where">{m.location}</span>}
                      {m.agenda_items && m.agenda_items.length > 0 && (
                        <Link href={`/meetings/${m.id}`} className="small">Agenda: {m.agenda_items.length} item{m.agenda_items.length === 1 ? "" : "s"}</Link>
                      )}
                      <Link href={`/meetings/${m.id}/edit`} className="small muted">Edit</Link>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
