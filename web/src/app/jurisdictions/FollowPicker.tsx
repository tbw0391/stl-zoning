"use client";

import { useMemo, useState } from "react";
import { saveFollowed } from "./actions";

type J = { id: string; name: string; county: string; followed: boolean };

// Checklist of every jurisdiction, grouped by county with an all / none box per county. Nothing changes until Save.
// Until the list has been saved once, it starts with just the municipalities that have open projects ticked.
export default function FollowPicker({ jurisdictions, counties, projectCount, reviewed }: {
  jurisdictions: J[]; counties: string[]; projectCount: Record<string, number>; reviewed: boolean;
}) {
  const withProjects = useMemo(() => jurisdictions.filter((j) => projectCount[j.id]).map((j) => j.id), [jurisdictions, projectCount]);
  const saved = useMemo(() => new Set(jurisdictions.filter((j) => j.followed).map((j) => j.id)), [jurisdictions]);
  const initial = useMemo(() => (reviewed || !withProjects.length ? saved : new Set(withProjects)), [reviewed, saved, withProjects]);
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);
  const differs = (a: Set<string>, b: Set<string>) => a.size !== b.size || [...a].some((id) => !b.has(id));
  const changed = !reviewed || differs(on, saved);

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
                  {projectCount[j.id] > 0 && <span className="tag">{projectCount[j.id]} project{projectCount[j.id] === 1 ? "" : "s"}</span>}
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
      <div className="follow-actions">
        <button type="submit" disabled={!changed || saving}>{saving ? "Saving…" : `Save (${on.size} followed)`}</button>
        {withProjects.length > 0 && <button type="button" className="link" onClick={() => setOn(new Set(withProjects))}>Only ones with projects</button>}
        {differs(on, initial) && !saving && <button type="button" className="link" onClick={() => setOn(new Set(initial))}>Undo changes</button>}
      </div>
    </form>
  );
}
