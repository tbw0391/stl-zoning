import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, shortName } from "@/lib/format";
import { BODY_LABEL, SummaryItem } from "@/components/MeetingSummary";

export const dynamic = "force-dynamic";

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("meetings").select("id, jurisdiction_id, body, event_date, video_url, summary, summary_items, jurisdictions(name)")
    .not("video_url", "is", null).order("event_date", { ascending: false });
  if (sp.j) q = q.eq("jurisdiction_id", sp.j);
  const { data } = await q;
  const rows = (data ?? []) as unknown as {
    id: number; jurisdiction_id: string; body: string; event_date: string; video_url: string;
    summary: string | null; summary_items: SummaryItem[] | null; jurisdictions: { name: string } | null;
  }[];

  return (
    <>
      <h1>Meeting summaries</h1>
      <p className="muted">
        Recorded P&amp;Z and council meetings, summarized from the video captions.
        {sp.j && <> <Link href="/meetings">Show all jurisdictions</Link></>}
      </p>
      {rows.length === 0 && <div className="card empty">No recorded meetings yet.</div>}
      <div className="meeting-list">
        {rows.map((m) => (
          <div className="card" key={m.id}>
            <div className="small muted">{fmtDate(m.event_date)}</div>
            <h3 style={{ margin: "2px 0 8px" }}>
              <Link href={`/meetings/${m.id}`}>{shortName(m.jurisdictions?.name ?? m.jurisdiction_id)} {BODY_LABEL[m.body]}</Link>
            </h3>
            {m.summary_items && m.summary_items.length > 0 && (
              <ul className="plain">
                {m.summary_items.map((it, i) => <li key={i}><strong>{it.item}</strong> <span className="muted">· {it.result}</span></li>)}
              </ul>
            )}
            <div className="links">
              <Link href={`/meetings/${m.id}`}>{m.summary ? "Read summary" : "No summary yet"}</Link>
              <a href={m.video_url} target="_blank" rel="noreferrer">Video ↗</a>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
