import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, shortName } from "@/lib/format";
import { BODY_LABEL } from "@/components/MeetingSummary";
import { updateMeeting } from "../../actions";
import { MeetingForm } from "../../MeetingForm";

export const dynamic = "force-dynamic";

export default async function EditMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const supabase = await createClient();
  const { data: m } = await supabase.from("meetings").select("*, jurisdictions(name)").eq("id", id).maybeSingle();
  if (!m) notFound();
  const what = m.event_type === "submittal_deadline" ? "submittal deadline" : "meeting";

  return (
    <>
      <p className="small"><Link href={`/meetings/${id}`}>← Meeting</Link></p>
      <h1>Edit {shortName(m.jurisdictions?.name ?? m.jurisdiction_id)} {BODY_LABEL[m.body]} {what}</h1>
      {m.verified_on && <p className="muted small">Last verified {fmtDate(m.verified_on)}. Saving marks it verified today.</p>}
      <p className="muted small">
        If it won&apos;t happen, set the status to Cancelled rather than changing the date.
        {" "}The daily collector only fills blank links, times and locations, so it won&apos;t undo your edits.
      </p>
      <MeetingForm action={updateMeeting.bind(null, id, m.agenda_url)} meeting={m} submitLabel="Save changes" />
    </>
  );
}
