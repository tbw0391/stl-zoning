import Link from "next/link";
import { fmtDate, shortName } from "@/lib/format";
import { ITEM_TYPE_LABEL } from "@/components/MeetingSummary";
import { Case, caseTypes } from "@/lib/cases";

export default function CaseRow({ c, isNew, miles }: { c: Case; isNew: boolean; miles: number | null }) {
  const t = caseTypes(c)[0];
  return (
    <li className={isNew ? "fresh" : undefined}>
      <div className="case-meta">
        {isNew && <span className="tag due">NEW</span>}
        <span className={`tag case-${t}`}>{ITEM_TYPE_LABEL[t] ?? t}</span>
        <Link href={`/meetings/${c.meeting_id}`}><strong>{shortName(c.jurisdiction_name)}</strong></Link>
        <span className="small muted">{fmtDate(c.event_date)} · {c.body === "planning_zoning" ? "P&Z" : "Council"}{miles != null && ` · ${miles.toFixed(1)} mi away`}</span>
      </div>
      <div><strong>{c.item}</strong> <span className="muted">· {c.request}</span></div>
      {(c.applicant || c.acres != null || c.units != null) && (
        <div className="small muted">{[c.applicant, c.acres != null && `${c.acres} ac`, c.units != null && `${c.units} units`].filter(Boolean).join(" · ")}</div>
      )}
    </li>
  );
}
