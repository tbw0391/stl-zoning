"use client";

import { useMemo, useState } from "react";
import { saveFollowed } from "./actions";

type J = { id: string; name: string; county: string; followed: boolean };

// Checklist of every jurisdiction, grouped by county with an all / none box per county. Nothing changes until Save.
export default function FollowPicker({ jurisdictions, counties }: { jurisdictions: J[]; counties: string[] }) {
  const initial = useMemo(() => new Set(jurisdictions.filter((j) => j.followed).map((j) => j.id)), [jurisdictions]);
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);
  const changed = on.size !== initial.size || [...on].some((id) => !initial.has(id));

  const toggle = (ids: string[], value: boolean) =>
    setOn((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (value ? next.add(id) : next.delete(id)));
      return next;
    });

  return (
    <form action={async (fd) => { setSaving(true); try { await saveFollowed(fd); } finally { setSaving(false); } }} className="card follow-picker">
      {counties.map((c) => {
        const list = jurisdictions.filter((j) => j.county === c);
        const ids = list.map((j) => j.id);
        const n = ids.filter((id) => on.has(id)).length;
        return (
          <fieldset key={c}>
            <legend>
              <label>
                <input type="checkbox" checked={n === ids.length} ref={(el) => { if (el) el.indeterminate = n > 0 && n < ids.length; }}
                  onChange={(e) => toggle(ids, e.target.checked)} />
                <strong>{c} County</strong> <span className="muted small">({n} of {ids.length})</span>
              </label>
            </legend>
            <div className="follow-grid">
              {list.map((j) => (
                <label key={j.id}>
                  <input type="checkbox" name="followed" value={j.id} checked={on.has(j.id)} onChange={(e) => toggle([j.id], e.target.checked)} />
                  {j.name}
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
      <div className="follow-actions">
        <button type="submit" disabled={!changed || saving}>{saving ? "Saving…" : `Save (${on.size} followed)`}</button>
        {changed && !saving && <button type="button" className="link" onClick={() => setOn(new Set(initial))}>Undo changes</button>}
      </div>
    </form>
  );
}
