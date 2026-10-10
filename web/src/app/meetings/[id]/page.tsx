import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtTime, shortName } from "@/lib/format";
import { BODY_LABEL, SummaryItem, SummaryItems, SummaryText } from "@/components/MeetingSummary";

export const dynamic = "force-dynamic";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const supabase = await createClient();
  const { data: m } = await supabase.from("meetings").select("*, jurisdictions(name)").eq("id", id).maybeSingle();
  if (!m) notFound();
  const items = (m.summary_items ?? []) as SummaryItem[];

  return (
    <>
      <p className="small"><Link href="/meetings">← All meeting summaries</Link></p>
      <h1>{shortName(m.jurisdictions?.name ?? m.jurisdiction_id)} {BODY_LABEL[m.body]}</h1>
      <p className="muted">
        {fmtDate(m.event_date)}{m.event_time && ` · ${fmtTime(m.event_time)}`}
        {" · "}<Link href={`/jurisdictions/${m.jurisdiction_id}`}>{m.jurisdictions?.name}</Link>
      </p>
      {m.video_url && (
        <p className="links"><a href={m.video_url} target="_blank" rel="noreferrer">Watch the recording ↗</a></p>
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
      ) : (
        <div className="card empty">No summary yet.</div>
      )}
    </>
  );
}
