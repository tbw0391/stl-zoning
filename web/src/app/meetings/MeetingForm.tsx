import { shortName } from "@/lib/format";
import { BODY_LABEL } from "@/components/MeetingSummary";

export type Meeting = {
  jurisdiction_id: string;
  body: string;
  event_type: string;
  event_date: string;
  event_time: string | null;
  status: string;
  location: string | null;
  note: string | null;
  agenda_url: string | null;
  packet_url: string | null;
  video_url: string | null;
  source_url: string | null;
};

export const MEETING_STATUS_LABEL: Record<string, string> = {
  published: "Published (on the city's schedule)",
  projected: "Projected (our estimate from the usual pattern)",
  changed: "Changed (moved from the published date)",
  cancelled: "Cancelled",
};

// Jurisdiction, board and type are fixed once a meeting exists; the collectors match on them.
export function MeetingForm({ action, meeting, jurisdictions, submitLabel }: {
  action: (fd: FormData) => Promise<void>;
  meeting?: Partial<Meeting>;
  jurisdictions?: { id: string; name: string }[];
  submitLabel: string;
}) {
  return (
    <form action={action} className="card stack-form">
      {jurisdictions && (
        <>
          <label>Municipality
            <select name="jurisdiction_id" required defaultValue={meeting?.jurisdiction_id ?? ""}>
              <option value="" disabled>Choose one</option>
              {jurisdictions.map((j) => <option key={j.id} value={j.id}>{shortName(j.name)}</option>)}
            </select>
          </label>
          <label>Board
            <select name="body" required defaultValue={meeting?.body ?? ""}>
              <option value="" disabled>Choose one</option>
              {Object.entries(BODY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Type
            <select name="event_type" required defaultValue={meeting?.event_type ?? "meeting"}>
              <option value="meeting">Meeting</option>
              <option value="submittal_deadline">Submittal deadline</option>
            </select>
          </label>
        </>
      )}
      <label>Date<input type="date" name="event_date" required defaultValue={meeting?.event_date ?? ""} /></label>
      <label>Time<input type="time" name="event_time" defaultValue={meeting?.event_time?.slice(0, 5) ?? ""} /></label>
      <label>Status
        <select name="status" required defaultValue={meeting?.status ?? "published"}>
          {Object.entries(MEETING_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label>Location<input name="location" defaultValue={meeting?.location ?? ""} /></label>
      <label>Note<textarea name="note" rows={2} defaultValue={meeting?.note ?? ""} placeholder="e.g. Cancelled per city clerk, no items" /></label>
      <label>Agenda link<input name="agenda_url" defaultValue={meeting?.agenda_url ?? ""} /></label>
      <label>Packet link<input name="packet_url" defaultValue={meeting?.packet_url ?? ""} /></label>
      <label>Video link<input name="video_url" defaultValue={meeting?.video_url ?? ""} /></label>
      <label>Source (where this came from)<input name="source_url" defaultValue={meeting?.source_url ?? ""} placeholder="Link, or e.g. Phone call with city clerk" /></label>
      <div><button type="submit">{submitLabel}</button></div>
    </form>
  );
}
