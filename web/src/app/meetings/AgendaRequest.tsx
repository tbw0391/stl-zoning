import Link from "next/link";
import { requestAgendaRead } from "./actions";

// Must match LOOKBACK_DAYS in supabase/functions/extract-agendas: newer agendas are read automatically.
const LOOKBACK_DAYS = 45;

export type AgendaRequestFields = {
  id: number; event_date: string; agenda_url: string | null; agenda_checked_on: string | null;
  agenda_requested_by: string | null; agenda_request_status: string | null;
};

// For a posted agenda that hasn't been read: where it stands, or a form to request an older one.
// `compact` (the meetings list) links to the meeting page instead of showing the form.
export function AgendaRequest({ m, compact = false }: { m: AgendaRequestFields; compact?: boolean }) {
  if (!m.agenda_url || m.agenda_checked_on) return null;
  const since = new Date(Date.now() - LOOKBACK_DAYS * 864e5).toISOString().slice(0, 10);
  if (m.event_date >= since) return <p className="small muted">Agenda queued to be read (usually within the hour).</p>;
  if (m.agenda_request_status === "pending") {
    return <p className="small muted">Requested by {m.agenda_requested_by}; waiting for <Link href="/agenda-requests">approval</Link>. We&apos;ll email them when it&apos;s ready.</p>;
  }
  if (m.agenda_request_status === "approved") {
    return <p className="small muted">Approved; it&apos;ll be read within the hour. We&apos;ll email {m.agenda_requested_by} when it&apos;s ready.</p>;
  }
  if (compact) return <p className="small"><Link href={`/meetings/${m.id}`}>Request this agenda be read →</Link></p>;
  return (
    <form action={requestAgendaRead.bind(null, m.id)} className="agenda-request">
      <span className="small muted">
        {m.agenda_request_status === "declined" ? "An earlier request to read this agenda was declined. " : "Older agendas are read on request. "}
        Want the land-use items from this one?
      </span>
      <input type="email" name="email" required placeholder="Your email" aria-label="Your email" />
      <button type="submit">Request</button>
      <span className="small muted">Requests are approved first; we&apos;ll email you when it&apos;s ready.</span>
    </form>
  );
}
