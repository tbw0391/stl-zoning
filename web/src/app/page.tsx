import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDays, fmtDate, fmtMonth, fmtTime, shortName, todayCentral } from "@/lib/format";

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
};

const RANGES: Record<string, number> = { "90": 90, "180": 180, "365": 365 };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const days = RANGES[sp.days ?? ""] ?? 180;
  const today = todayCentral();
  const supabase = await createClient();

  const [{ data: jurisdictions }, { data: meetings }] = await Promise.all([
    supabase.from("jurisdictions").select("id, name, governing_body").order("name"),
    (() => {
      let q = supabase.from("meetings").select("*").gte("event_date", today).lte("event_date", addDays(today, days)).order("event_date").order("event_time");
      if (sp.j) q = q.eq("jurisdiction_id", sp.j);
      if (sp.type === "deadlines") q = q.eq("event_type", "submittal_deadline");
      if (sp.type === "pz") q = q.eq("body", "planning_zoning").eq("event_type", "meeting");
      if (sp.type === "gov") q = q.eq("body", "governing_body");
      return q;
    })(),
  ]);

  const jmap = new Map((jurisdictions ?? []).map((j) => [j.id, j]));
  const rows = (meetings ?? []) as Meeting[];

  // Deadlines link to the P&Z meeting they feed; look those up even if outside the range.
  const linkedIds = rows.map((m) => m.linked_meeting).filter((x): x is number => x != null);
  const { data: linked } = linkedIds.length
    ? await supabase.from("meetings").select("id, event_date").in("id", linkedIds)
    : { data: [] as { id: number; event_date: string }[] };
  const linkedDate = new Map((linked ?? []).map((m) => [m.id, m.event_date]));

  const { data: covered } = await supabase.from("meetings").select("jurisdiction_id").gte("event_date", today);
  const coveredIds = [...new Set((covered ?? []).map((c) => c.jurisdiction_id))];

  const byMonth = new Map<string, Map<string, Meeting[]>>();
  for (const m of rows) {
    const month = m.event_date.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, new Map());
    const dayMap = byMonth.get(month)!;
    if (!dayMap.has(m.event_date)) dayMap.set(m.event_date, []);
    dayMap.get(m.event_date)!.push(m);
  }

  function label(m: Meeting) {
    if (m.event_type === "submittal_deadline") return <span className="tag due">SUBMITTAL DUE</span>;
    if (m.body === "planning_zoning") return <span className="tag pz">P&amp;Z</span>;
    const gb = jmap.get(m.jurisdiction_id)?.governing_body?.replace(/\s*\(.*\)$/, "") ?? "Council";
    return <span className="tag gov">{gb.toUpperCase()}</span>;
  }

  return (
    <>
      <h1>Upcoming dates</h1>
      <p className="muted coverage">
        Schedules loaded for: {coveredIds.map((id) => shortName(jmap.get(id)?.name ?? id)).join(", ") || "none yet"}.
        Other jurisdictions are still being researched.
      </p>

      <form className="filters" method="get">
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
          </select>
        </label>
        <label>Range
          <select name="days" defaultValue={String(days)}>
            <option value="90">Next 3 months</option>
            <option value="180">Next 6 months</option>
            <option value="365">Next 12 months</option>
          </select>
        </label>
        <button type="submit">Apply</button>
      </form>

      {rows.length === 0 && <div className="card empty">No dates in this range.</div>}

      {[...byMonth.entries()].map(([month, dayMap]) => (
        <section className="month" key={month}>
          <h2>{fmtMonth(month + "-01")}</h2>
          {[...dayMap.entries()].map(([date, events]) => (
            <div className="day" key={date}>
              <div className="day-date">{fmtDate(date)}</div>
              <div className="events">
                {events.map((m) => {
                  const j = jmap.get(m.jurisdiction_id);
                  const feeds = m.linked_meeting ? linkedDate.get(m.linked_meeting) : null;
                  return (
                    <div className="event" key={m.id}>
                      {label(m)}
                      <Link href={`/jurisdictions/${m.jurisdiction_id}`}><strong>{shortName(j?.name ?? m.jurisdiction_id)}</strong></Link>
                      {m.event_time && <span>{m.event_type === "submittal_deadline" ? "by " : ""}{fmtTime(m.event_time)}</span>}
                      {feeds && <span className="where">for P&amp;Z on {fmtDate(feeds)}</span>}
                      {m.status !== "published" && <span className="tag tentative">{m.status}</span>}
                      {m.event_type === "meeting" && m.location && <span className="where">{m.location}</span>}
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
