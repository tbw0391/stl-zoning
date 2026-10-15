import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { MIN_HISTORY_CASES, Path, Timeline, daysBetween } from "@/lib/timeline";

const weeks = (start: string, end: string | null) => (end ? `about ${Math.round(daysBetween(start, end) / 7)} weeks` : "past the loaded schedule");

function Steps({ path }: { path: Path }) {
  return (
    <ul className="plain timeline">
      {path.steps.map((s, i) => (
        <li key={i} className={s.postponed != null ? "postponed" : undefined}>
          <strong>{s.date ? fmtDate(s.date) : "—"}</strong>{" "}
          <span className="step-label">{s.meetingId && s.label !== "Submit application" ? <Link href={`/meetings/${s.meetingId}`}>{s.label}</Link> : s.label}</span>
          {s.postponed != null && <span className="tag postponed">postponed</span>}
          {s.postponed && <span className="small muted"> · {s.postponed}</span>}
          {s.estimated && s.date && s.postponed == null && <span className="tag tentative">est.</span>}
          {s.note && <span className="small muted"> · {s.note}</span>}
        </li>
      ))}
    </ul>
  );
}

// filed: the project's filing date is set, so this is its schedule (delays included) rather than a what-if.
export default function TimelineCard({ t, start, today, filed = false }: { t: Timeline; start: string; today: string; filed?: boolean }) {
  const slip = t.original && t.best.finalDate ? daysBetween(t.original, t.best.finalDate) : null;
  return (
    <div className="card">
      {filed ? (
        <p className="small" style={{ marginTop: 0 }}>Filed {fmtDate(start)}. Change the filing date in Details.</p>
      ) : (
        <form method="get" className="row-form small">
          <label className="grow">If we submit on <input type="date" name="start" defaultValue={start} min={today} /></label>
          <button type="submit">Update</button>
        </form>
      )}

      {t.original !== undefined && (
        <p className="small" style={{ marginBottom: 8 }}>
          <span className="tag postponed">Delayed</span>{" "}
          {slip === 0
            ? <>Final council action still {fmtDate(t.best.finalDate!)}.</>
            : slip != null
            ? <>Final council action {fmtDate(t.best.finalDate!)}, {slip} days later than the original {t.original ? fmtDate(t.original) : "date"}.</>
            : <>Final council action is now past the loaded schedule{t.original ? ` (was ${fmtDate(t.original)})` : ""}.</>}
        </p>
      )}

      {t.typical && (
        <p className="small" style={{ marginBottom: 8 }}>
          <strong>Typical here:</strong> final council action around {fmtDate(t.typical.p50)} ({weeks(start, t.typical.p50)}),
          and by {fmtDate(t.typical.p80)} for 80% of past cases. From {t.typical.cases} cases on this board&apos;s agendas since {fmtDate(t.typical.since)},
          counted from the P&amp;Z hearing on {fmtDate(t.typical.hearing)}.
        </p>
      )}

      <p className="small" style={{ marginBottom: 4 }}><strong>{filed ? "Schedule" : "Best case"}{t.typical ? " (calendar)" : ""}:</strong> {weeks(start, t.best.finalDate)}</p>
      <Steps path={t.best} />

      {t.continued && (
        <p className="small" style={{ marginBottom: 0 }}>
          <strong>If P&amp;Z continues it once:</strong> {weeks(start, t.continued.finalDate)}
          {t.continued.finalDate && <> (final vote {fmtDate(t.continued.finalDate)})</>}
        </p>
      )}

      {t.history.map((h) => (
        <p key={h.scope} className="small muted" style={{ marginBottom: 0 }}>
          Agendas since {fmtDate(h.since)}, {h.scope}: {h.continued} of {h.cases} P&amp;Z case{h.cases === 1 ? "" : "s"} ({Math.round((100 * h.continued) / h.cases)}%) were on more than one P&amp;Z agenda
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
