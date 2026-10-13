import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, shortName } from "@/lib/format";
import { BODY_LABEL } from "@/components/MeetingSummary";
import { decideAgendaRequest } from "../meetings/actions";

export const dynamic = "force-dynamic";

type Req = {
  id: number; jurisdiction_id: string; body: string; event_date: string; agenda_url: string;
  agenda_requested_at: string; agenda_requested_by: string | null; agenda_request_status: string;
  agenda_checked_on: string | null; agenda_items: unknown[] | null; agenda_request_notified_at: string | null;
  jurisdictions: { name: string } | null;
};

const day = (ts: string) => fmtDate(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date(ts)));

export default async function AgendaRequestsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("meetings")
    .select("id, jurisdiction_id, body, event_date, agenda_url, agenda_requested_at, agenda_requested_by, agenda_request_status, agenda_checked_on, agenda_items, agenda_request_notified_at, jurisdictions(name)")
    .not("agenda_request_status", "is", null).order("agenda_requested_at", { ascending: false });
  const reqs = (data ?? []) as unknown as Req[];
  const pending = reqs.filter((r) => r.agenda_request_status === "pending");
  const approved = reqs.filter((r) => r.agenda_request_status === "approved");
  const declined = reqs.filter((r) => r.agenda_request_status === "declined");

  const title = (r: Req) => (
    <>
      <Link href={`/meetings/${r.id}`}>{shortName(r.jurisdictions?.name ?? r.jurisdiction_id)} {BODY_LABEL[r.body]}, {fmtDate(r.event_date)}</Link>
      {" "}<a href={r.agenda_url} target="_blank" rel="noreferrer" className="small">Agenda ↗</a>
    </>
  );
  const who = (r: Req) => <span className="small muted">Requested by {r.agenda_requested_by ?? "someone"} on {day(r.agenda_requested_at)}</span>;

  return (
    <>
      <p className="small"><Link href="/meetings">← Meetings</Link></p>
      <h1>Agenda requests</h1>
      <p className="muted">
        Agendas from the last 45 days and upcoming meetings are read automatically. Older ones are read only when someone
        asks, and each read is a paid call to Claude (roughly 10 to 20 cents), so requests wait here for approval.
        Approved agendas are read within the hour, and the requester gets an email when it&apos;s done.
      </p>

      <h2>Waiting for approval {pending.length > 0 && <span className="tag due">{pending.length}</span>}</h2>
      {pending.length === 0 ? <div className="card empty">No requests waiting.</div> : (
        <div className="meeting-list">
          {pending.map((r) => (
            <div className="card" key={r.id}>
              <h3 style={{ margin: "0 0 4px" }}>{title(r)}</h3>
              {who(r)}
              <div className="links" style={{ marginTop: 10 }}>
                <form action={decideAgendaRequest.bind(null, r.id, "approved")}><button type="submit">Approve</button></form>
                <form action={decideAgendaRequest.bind(null, r.id, "declined")}><button type="submit" className="link">Decline</button></form>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2>Approved</h2>
      {approved.length === 0 ? <div className="card empty">None yet.</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Meeting</th><th>Requested by</th><th>Status</th></tr></thead>
            <tbody>
              {approved.map((r) => (
                <tr key={r.id}>
                  <td>{title(r)}</td>
                  <td className="small">{r.agenda_requested_by}</td>
                  <td className="small">
                    {!r.agenda_checked_on ? "Queued (read within the hour)"
                      : r.agenda_items == null ? "Couldn't be read"
                      : `Ready: ${r.agenda_items.length} item${r.agenda_items.length === 1 ? "" : "s"}`}
                    {r.agenda_checked_on && (r.agenda_request_notified_at ? " · emailed" : " · email pending (not set up yet)")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {declined.length > 0 && (
        <>
          <h2>Declined</h2>
          <ul className="plain">{declined.map((r) => <li key={r.id}>{title(r)} {who(r)}</li>)}</ul>
        </>
      )}
    </>
  );
}
