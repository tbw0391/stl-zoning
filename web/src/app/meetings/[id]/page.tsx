import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtTime, shortName } from "@/lib/format";
import { AgendaRequest } from "../AgendaRequest";
import { AgendaItem, AgendaItems, BODY_LABEL, SummaryItem, SummaryItems, SummaryText } from "@/components/MeetingSummary";
import { VotesList } from "@/components/Votes";
import { MeetingVotes, MemberVote } from "@/lib/votes";

export const dynamic = "force-dynamic";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const supabase = await createClient();
  const [{ data: m }, { data: memberRows }] = await Promise.all([
    supabase.from("meetings").select("*, jurisdictions(name)").eq("id", id).maybeSingle(),
    supabase.from("member_votes").select("*").eq("meeting_id", id),
  ]);
  if (!m) notFound();
  const votes = m.votes as MeetingVotes | null;
  const items = (m.summary_items ?? []) as SummaryItem[];
  const agenda = (m.agenda_items ?? []) as AgendaItem[];

  return (
    <>
      <p className="small"><Link href="/meetings">← All meetings</Link></p>
      <h1>{shortName(m.jurisdictions?.name ?? m.jurisdiction_id)} {BODY_LABEL[m.body]}</h1>
      <p className="muted">
        {fmtDate(m.event_date)}{m.event_time && ` · ${fmtTime(m.event_time)}`}
        {m.location && ` · ${m.location}`}
        {" · "}<Link href={`/jurisdictions/${m.jurisdiction_id}`}>{m.jurisdictions?.name}</Link>
        {m.status !== "published" && <> <span className="tag tentative">{m.status}</span></>}
        {" · "}<Link href={`/meetings/${m.id}/edit`}>Edit</Link>
      </p>
      {m.note && <p className="small">{m.note}</p>}
      {(m.video_url || m.agenda_url || m.packet_url || m.minutes_url) && (
        <p className="links">
          {m.agenda_url && <a href={m.agenda_url} target="_blank" rel="noreferrer">Posted agenda ↗</a>}
          {m.packet_url && <a href={m.packet_url} target="_blank" rel="noreferrer">Full packet (staff reports, plans) ↗</a>}
          {m.minutes_url && <a href={m.minutes_url} target="_blank" rel="noreferrer">Minutes ↗</a>}
          {m.video_url && <a href={m.video_url} target="_blank" rel="noreferrer">Watch the recording ↗</a>}
        </p>
      )}

      <AgendaRequest m={m} />
      {m.agenda_checked_on && !m.agenda_items && m.agenda_url && (
        <p className="small muted">The agenda reader couldn&apos;t read this agenda; open the posted agenda instead.</p>
      )}

      {agenda.length > 0 && items.length === 0 && (
        <>
          <h2>On the agenda</h2>
          <AgendaItems items={agenda} />
          {m.agenda_checked_on && <p className="source">Agenda checked {fmtDate(m.agenda_checked_on)}. Cities can add items until the meeting; check the posted agenda.</p>}
        </>
      )}

      {votes && votes.votes.length > 0 && (
        <>
          <h2>Votes</h2>
          <VotesList votes={votes} members={(memberRows ?? []) as MemberVote[]} jurisdictionId={m.jurisdiction_id} />
          <p className="source">
            Read from the <a href={m.minutes_url} target="_blank" rel="noreferrer">posted minutes</a>
            {m.minutes_read_at && ` on ${fmtDate(m.minutes_read_at.slice(0, 10))}`}. Members are named only where the minutes record who voted which way; check the minutes before relying on a detail.
          </p>
        </>
      )}
      {votes && votes.votes.length === 0 && (
        <p className="small muted">The minutes don&apos;t record a vote on this meeting&apos;s land-use items.</p>
      )}

      {items.length > 0 && (
        <>
          <h2>Agenda results</h2>
          <SummaryItems items={items} />
        </>
      )}

      {m.summary ? (
        <>
          <h2>Summary</h2>
          <div className="card"><SummaryText text={m.summary} /></div>
          <p className="source">Summarized {m.summarized_on ? fmtDate(m.summarized_on) : ""} from the video&apos;s auto-generated captions. Check the recording before relying on a detail.</p>
        </>
      ) : m.video_url ? (
        <div className="card empty">No summary yet.</div>
      ) : null}
    </>
  );
}
