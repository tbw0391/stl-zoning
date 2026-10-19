"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { setProjectDate } from "@/app/projects/actions";
import { useFeature } from "@/components/FeaturesProvider";

// A typed date is only complete once the year has four digits; until then the box reports years like 0002.
const FULL_DATE = /^(19|20)\d\d-\d\d-\d\d$/;

// A date on a dashboard card: click it to get a date box with its calendar. The box stays open while the calendar
// is in use (clicking around in it, changing months) and saves only on Save or Enter; Cancel or Escape closes it.
export default function CardDate({ id, field, label, value, display, warn }: {
  id: number; field: "diligence_expires_on" | "closing_on"; label: string; value: string | null; display: string | null; warn?: boolean;
}) {
  const noCancel = useFeature("card-date-no-cancel");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, start] = useTransition();
  const save = (v: string | null) => { setEditing(false); start(() => setProjectDate(id, field, v)); };
  const ok = FULL_DATE.test(draft);
  const input = useRef<HTMLInputElement>(null);
  // Open the calendar once when the box appears (not on every re-render while typing).
  useEffect(() => { if (editing) { try { input.current?.showPicker(); } catch { /* the box itself still works */ } } }, [editing]);

  if (editing) {
    return (
      <form className="card-date card-date-edit" onSubmit={(e) => { e.preventDefault(); if (ok) save(draft); }}>
        <span className="card-date-label">{label}:</span>
        {/* Uncontrolled: writing the value back on every keystroke resets the year as it's typed. */}
        <input type="date" className="card-date-input" defaultValue={value ?? ""} autoFocus aria-label={label}
          ref={input}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)} />
        <button type="submit" className="small" disabled={!ok}>Save</button>
        {!noCancel && <button type="button" className="link small" onClick={() => setEditing(false)}>Cancel</button>}
      </form>
    );
  }
  return (
    <div className="card-date">
      <button type="button" className="card-date-button" disabled={pending} onClick={() => { setDraft(value ?? ""); setEditing(true); }}>
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
