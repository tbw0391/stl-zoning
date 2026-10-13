import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { skipUnfollowed, unfollowedIds } from "@/lib/followed";
import { fmtDate, shortName } from "@/lib/format";
import { AgendaItem, BODY_LABEL, SummaryItem } from "@/components/MeetingSummary";
import PageTitle from "@/components/PageTitle";
import { AgendaRequest } from "./AgendaRequest";

export const dynamic = "force-dynamic";

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("meetings").select("id, jurisdiction_id, body, event_date, video_url, summary, summary_items, agenda_url, packet_url, agenda_items, agenda_checked_on, agenda_requested_by, agenda_request_status, jurisdictions(name)")
    .or("video_url.not.is.null,agenda_url.not.is.null").order("event_date", { ascending: false });
  q = sp.j ? q.eq("jurisdiction_id", sp.j) : skipUnfollowed(q, await unfollowedIds(supabase));
  const [{ data }, { count: waiting }] = await Promise.all([
    q,
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("agenda_request_status", "pending"),
  ]);
  const rows = (data ?? []) as unknown as {
    id: number; jurisdiction_id: string; body: string; event_date: string; video_url: string | null;
    agenda_url: string | null; packet_url: string | null; agenda_items: AgendaItem[] | null;
    agenda_checked_on: string | null; agenda_requested_by: string | null; agenda_request_status: string | null;
    summary: string | null; summary_items: SummaryItem[] | null; jurisdictions: { name: string } | null;
  }[];

  return (
    <>
      <PageTitle href="/meetings">Meetings</PageTitle>
      <p className="muted">
        Posted agendas for upcoming meetings, and recorded meetings summarized from the video captions.
        {sp.j && <> <Link href="/meetings">Show all jurisdictions</Link></>}
      </p>
      <p className={waiting ? "notice" : "small"}>
        <Link href="/agenda-requests">{waiting ? `${waiting} agenda request${waiting === 1 ? "" : "s"} waiting for approval →` : "Agenda requests →"}</Link>
      </p>
      {rows.length === 0 && <div className="card empty">No agendas or recorded meetings yet.</div>}
      <div className="meeting-list">
        {rows.map((m) => (
          <div className="card" key={m.id}>
            <div className="small muted">{fmtDate(m.event_date)}</div>
            <h3 style={{ margin: "2px 0 8px" }}>
              <Link href={`/meetings/${m.id}`}>{shortName(m.jurisdictions?.name ?? m.jurisdiction_id)} {BODY_LABEL[m.body]}</Link>
            </h3>
            {!m.summary_items?.length && m.agenda_items && m.agenda_items.length > 0 && (
              <ul className="plain">
                {m.agenda_items.map((it, i) => <li key={i}><strong>{it.item}</strong> <span className="muted">· {it.request}</span></li>)}
              </ul>
            )}
            {m.summary_items && m.summary_items.length > 0 && (
              <ul className="plain">
                {m.summary_items.map((it, i) => <li key={i}><strong>{it.item}</strong> <span className="muted">· {it.result}</span></li>)}
              </ul>
            )}
            <div className="links">
              {m.video_url && <Link href={`/meetings/${m.id}`}>{m.summary ? "Read summary" : "No summary yet"}</Link>}
              {m.agenda_url && <a href={m.agenda_url} target="_blank" rel="noreferrer">Agenda ↗</a>}
              {m.packet_url && <a href={m.packet_url} target="_blank" rel="noreferrer">Full packet ↗</a>}
              {m.video_url && <a href={m.video_url} target="_blank" rel="noreferrer">Video ↗</a>}
            </div>
            <AgendaRequest m={m} compact />
          </div>
        ))}
      </div>
    </>
  );
}
