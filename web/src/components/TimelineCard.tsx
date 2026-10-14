import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { MIN_HISTORY_CASES, Path, Timeline, daysBetween } from "@/lib/timeline";

const weeks = (start: string, end: string | null) => (end ? `about ${Math.round(daysBetween(start, end) / 7)} weeks` : "past the loaded schedule");

function Steps({ path }: { path: Path }) {
  return (
    <ul className="plain timeline">
      {path.steps.map((s, i) => (
        <li key={i}>
          <strong>{s.date ? fmtDate(s.date) : "—"}</strong>{" "}
          {s.meetingId && s.label !== "Submit application" ? <Link href={`/meetings/${s.meetingId}`}>{s.label}</Link> : s.label}
          {s.estimated && s.date && <span className="tag tentative">est.</span>}
          {s.note && <span className="small muted"> · {s.note}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function TimelineCard({ t, start, today }: { t: Timeline; start: string; today: string }) {
  return (
    <div className="card">
      <form method="get" className="row-form small">
        <label className="grow">If we submit on <input type="date" name="start" defaultValue={start} min={today} /></label>
        <button type="submit">Update</button>
      </form>

      <p className="small" style={{ marginBottom: 4 }}><strong>Best case:</strong> {weeks(start, t.best.finalDate)}</p>
      <Steps path={t.best} />

      {t.continued && (
        <p className="small" style={{ marginBottom: 0 }}>
          <strong>If P&amp;Z continues it once:</strong> {weeks(start, t.continued.finalDate)}
          {t.continued.finalDate && <> (final vote {fmtDate(t.continued.finalDate)})</>}
        </p>
      )}

      {t.history.map((h) => (
        <p key={h.scope} className="small muted" style={{ marginBottom: 0 }}>
          Agendas since {fmtDate(h.since)}, {h.scope}: {h.continued} of {h.cases} P&amp;Z case{h.cases === 1 ? "" : "s"} ({Math.round((100 * h.continued) / h.cases)}%) came back for another P&amp;Z meeting
          {h.totalP50 != null && <>; first P&amp;Z to final council action took {h.totalP50} days at the median, {h.totalP80} days for 80% of cases ({h.withCouncil} cases)</>}
.
          {h.scope === "here" && h.cases < MIN_HISTORY_CASES && " Small sample."}
        </p>
      ))}

      {t.assumptions.map((a) => <p key={a} className="small muted" style={{ marginBottom: 0 }}>{a}</p>)}
      <p className="small muted" style={{ marginBottom: 0 }}>
        Built from published deadlines and meetings plus the code&apos;s rules. Doesn&apos;t count pre-application meetings or staff resubmittal rounds.
      </p>
    </div>
  );
}
