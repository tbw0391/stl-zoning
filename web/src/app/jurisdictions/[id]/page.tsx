import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL, STATUS_LABEL, fmtDate, fmtTime, todayCentral } from "@/lib/format";

export const dynamic = "force-dynamic";

type Process = Record<string, unknown> & { steps?: string[] | null; application_items?: string[] | null; source_url: string; verified_on: string };

const FACTS: [string, string, (v: unknown) => string][] = [
  ["code_section", "Code section", String],
  ["who_may_apply", "Who may apply", String],
  ["preapp_required", "Pre-application meeting", (v) => (v ? "Required" : "Not required")],
  ["preapp_notes", "Pre-application notes", String],
  ["fee_notes", "Fees", String],
  ["pz_hearing_timing", "P&Z hearing timing", String],
  ["newspaper_notice_days", "Newspaper notice", (v) => `${v} days before hearing`],
  ["mailed_notice_radius_ft", "Mailed notice radius", (v) => `${Number(v).toLocaleString()} ft`],
  ["mailed_notice_days", "Mailed notice", (v) => `${v} days before hearing`],
  ["sign_posting", "Sign posting", String],
  ["governing_body_action", "Final action", String],
  ["protest_rule", "Protest petition", String],
  ["protest_deadline", "Protest deadline", String],
  ["resubmittal_wait", "Resubmittal after denial", String],
  ["special_notes", "Notes", String],
];

export default async function JurisdictionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const today = todayCentral();

  const [{ data: j }, { data: proc }, { data: meetings }, { data: people }, { data: recorded }] = await Promise.all([
    supabase.from("jurisdictions").select("*").eq("id", id).maybeSingle(),
    supabase.from("rezoning_processes").select("*").eq("jurisdiction_id", id).maybeSingle(),
    supabase.from("meetings").select("*").eq("jurisdiction_id", id).gte("event_date", today).order("event_date").limit(12),
    supabase.from("people").select("*").eq("jurisdiction_id", id).eq("active", true).order("role_group").order("id"),
    supabase.from("meetings").select("id, body, event_date, video_url, summary").eq("jurisdiction_id", id)
      .not("video_url", "is", null).order("event_date", { ascending: false }).limit(8),
  ]);
  if (!j) notFound();
  const p = proc as Process | null;

  const links: [string, string | null][] = [
    ["Website", j.website], ["Zoning code", j.code_url], ["Meeting schedule", j.schedule_url],
    ["Agendas", j.agenda_url], ["Zoning map", j.zoning_map_url],
  ];

  return (
    <>
      <p className="small"><Link href="/jurisdictions">← All jurisdictions</Link></p>
      <h1>{j.name}</h1>
      <p className="muted">
        {j.governing_body ?? "Governing body not recorded"} · <span className={`tag ${j.research_status}`}>{STATUS_LABEL[j.research_status]}</span>
      </p>
      <div className="links">
        {links.filter(([, url]) => url).map(([label, url]) => (
          <a key={label} href={url!} target="_blank" rel="noreferrer">{label} ↗</a>
        ))}
      </div>
      {j.notes && <p>{j.notes}</p>}

      <h2>Rezoning process</h2>
      {p ? (
        <div className="card">
          {p.steps && p.steps.length > 0 && (
            <>
              <h3 style={{ marginTop: 0 }}>Steps</h3>
              <ol className="steps">{p.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </>
          )}
          <h3>Details</h3>
          <dl className="facts">
            {FACTS.filter(([k]) => p[k] != null && p[k] !== "").map(([k, label, fmt]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>{label}</dt><dd>{fmt(p[k])}</dd>
              </div>
            ))}
            {p.application_items && p.application_items.length > 0 && (
              <>
                <dt>Application items</dt>
                <dd><ul className="steps">{p.application_items.map((s, i) => <li key={i}>{s}</li>)}</ul></dd>
              </>
            )}
          </dl>
          <p className="source">Source: <a href={p.source_url} target="_blank" rel="noreferrer">{p.source_url}</a> · verified {fmtDate(p.verified_on)}</p>
        </div>
      ) : (
        <div className="card empty">Not researched yet.</div>
      )}

      <h2>Upcoming dates</h2>
      {meetings && meetings.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>What</th><th>Time</th><th>Notes</th></tr></thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.id}>
                  <td>{fmtDate(m.event_date)}</td>
                  <td>{m.event_type === "submittal_deadline" ? <span className="tag due">SUBMITTAL DUE</span>
                    : m.body === "planning_zoning" ? <span className="tag pz">P&amp;Z</span>
                    : <span className="tag gov">{(j.governing_body ?? "Council").replace(/\s*\(.*\)$/, "").toUpperCase()}</span>}
                    {m.status !== "published" && <> <span className="tag tentative">{m.status}</span></>}</td>
                  <td>{fmtTime(m.event_time) || <span className="muted">—</span>}</td>
                  <td className="small">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card empty">No schedule loaded yet.</div>
      )}

      {recorded && recorded.length > 0 && (
        <>
          <h2>Recorded meetings</h2>
          <ul className="plain card">
            {recorded.map((m) => (
              <li key={m.id}>
                <strong>{fmtDate(m.event_date)}</strong> {m.body === "planning_zoning" ? "P&Z" : "Council / Aldermen"}
                {" · "}{m.summary ? <Link href={`/meetings/${m.id}`}>Summary</Link> : <span className="muted">No summary yet</span>}
                {" · "}<a href={m.video_url!} target="_blank" rel="noreferrer">Video ↗</a>
              </li>
            ))}
          </ul>
          <p className="small"><Link href={`/meetings?j=${id}`}>All recorded meetings →</Link></p>
        </>
      )}

      <h2>People</h2>
      {people && people.length > 0 ? (
        (["governing_body", "planning_zoning", "staff"] as const).map((g) => {
          const list = people.filter((x) => x.role_group === g);
          if (!list.length) return null;
          return (
            <div key={g}>
              <h3>{ROLE_LABEL[g]}</h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Title</th><th>Email</th><th>Phone</th><th>Term ends</th></tr></thead>
                  <tbody>
                    {list.map((x) => (
                      <tr key={x.id}>
                        <td>{x.full_name}</td>
                        <td>{x.title}</td>
                        <td>{x.email ? <a href={`mailto:${x.email}`}>{x.email}</a> : <span className="muted">—</span>}</td>
                        <td>{x.phone ?? <span className="muted">—</span>}</td>
                        <td>{x.term_expires ? x.term_expires.slice(0, 7) : <span className="muted">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      ) : (
        <div className="card empty">Not researched yet.</div>
      )}
    </>
  );
}
