"use client";

import { useState, useTransition } from "react";
import { setProjectDate } from "@/app/projects/actions";

// A typed date is only complete once the year has four digits; until then the box reports years like 0002.
const FULL_DATE = /^(19|20)\d\d-\d\d-\d\d$/;

// A date on a dashboard card: click it to get a date box (its calendar opens where the browser supports that),
// and the date saves as soon as one is picked. Escape or clicking away closes the box without saving.
export default function CardDate({ id, field, label, value, display, warn }: {
  id: number; field: "diligence_expires_on" | "closing_on"; label: string; value: string | null; display: string | null; warn?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const save = (v: string | null) => { setEditing(false); start(() => setProjectDate(id, field, v)); };

  if (editing) {
    return (
      <div className="card-date">
        <span className="card-date-label">{label}:</span>
        <input type="date" className="card-date-input" defaultValue={value ?? ""} autoFocus aria-label={label}
          ref={(el) => { try { el?.showPicker(); } catch { /* the box itself still works */ } }}
          onChange={(e) => FULL_DATE.test(e.target.value) && save(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          onBlur={() => setEditing(false)} />
      </div>
    );
  }
  return (
    <div className="card-date">
      <button type="button" className="card-date-button" disabled={pending} onClick={() => setEditing(true)}>
        <span className="card-date-label">{label}:</span>{" "}
        {pending ? <span className="card-date-empty">saving…</span>
          : display ? <span className={warn ? "tag due" : undefined}>{display}</span> : <span className="card-date-empty">add date</span>}
      </button>
      {value && !pending && (
        <button type="button" className="link small card-date-clear" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => save(null)}>×</button>
      )}
    </div>
  );
}
