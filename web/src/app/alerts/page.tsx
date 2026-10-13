import { createClient } from "@/lib/supabase/server";
import { shortName } from "@/lib/format";
import { ITEM_TYPE_LABEL } from "@/components/MeetingSummary";
import { Place, Watch, ZONING_TYPES, distanceTo, isNew, loadCases, matches } from "@/lib/cases";
import CaseRow from "@/components/CaseRow";
import PageTitle from "@/components/PageTitle";
import { createWatch, deleteWatch, markSeen } from "./actions";

export const dynamic = "force-dynamic";

const TYPE_CHOICES = ["rezoning", "pud", "special_use", "annexation", "preliminary_plat", "final_plat", "site_plan", "text_amendment", "comprehensive_plan", "variance"];

export default async function AlertsPage() {
  const supabase = await createClient();
  const [{ data: watchRows }, { data: projects }, { data: jurisdictions }, cases] = await Promise.all([
    supabase.from("watches").select("*").order("created_at"),
    supabase.from("projects").select("id, name, lat, lng").order("name"),
    supabase.from("jurisdictions").select("id, name, county").eq("followed", true).order("name"),
    loadCases(supabase),
  ]);
  const watches = (watchRows ?? []) as Watch[];
  const pmap = new Map((projects ?? []).map((p) => [p.id, p as Place & { name: string }]));
  const counties = [...new Set((jurisdictions ?? []).map((j) => j.county))].sort();
  const totalNew = watches.reduce((n, w) => n + cases.filter((c) => isNew(c, w) && matches(c, w, pmap.get(w.project_id ?? -1))).length, 0);

  return (
    <>
      <PageTitle href="/alerts">Alerts</PageTitle>
      <p className="muted">
        Watches flag land-use cases as soon as their agenda is read: near a project, or anywhere in the counties or cities you pick.
        Cases from the last 45 days and upcoming meetings are shown; <strong>NEW</strong> marks ones that arrived since you last marked a watch as seen.
      </p>

      {watches.length > 0 && totalNew > 0 && (
        <form action={async () => { "use server"; await markSeen(); }} style={{ margin: "12px 0" }}>
          <button type="submit">Mark everything as seen</button>
        </form>
      )}

      {watches.length === 0 && <div className="card empty">No watches yet. Add one below, or use “Watch this area” on a project.</div>}

      {watches.map((w) => {
        const project = w.project_id ? pmap.get(w.project_id) : undefined;
        const hits = cases.filter((c) => matches(c, w, project));
        const fresh = hits.filter((c) => isNew(c, w)).length;
        const area = [
          project && `within ${Number(w.radius_miles)} mi of ${project.name}`,
          w.counties?.length && w.counties.map((c) => `${c} County`).join(", "),
          w.jurisdiction_ids?.length && w.jurisdiction_ids.map((id) => shortName((jurisdictions ?? []).find((j) => j.id === id)?.name ?? id)).join(", "),
        ].filter(Boolean).join(" · ");
        const types = (w.types?.length ? w.types : ZONING_TYPES).map((t) => ITEM_TYPE_LABEL[t] ?? t).join(", ");
        return (
          <section key={w.id} className="card watch">
            <div className="watch-head">
              <div>
                <h2>{w.name} {fresh > 0 && <span className="tag due">{fresh} NEW</span>}</h2>
                <div className="small muted">{area} · {types}</div>
                {project && project.lat == null && <div className="small error">This project has no map location yet: add a street address on the project to use the radius.</div>}
              </div>
              <div className="watch-actions">
                {fresh > 0 && <form action={async () => { "use server"; await markSeen(w.id); }}><button type="submit" className="link">Mark seen</button></form>}
                <form action={async () => { "use server"; await deleteWatch(w.id); }}><button type="submit" className="link">Remove</button></form>
              </div>
            </div>
            {hits.length === 0 ? (
              <p className="muted small" style={{ marginBottom: 0 }}>Nothing matching in the last 45 days or on upcoming agendas.</p>
            ) : (
              <ul className="case-list">
                {hits.map((c) => <CaseRow key={`${c.meeting_id}-${c.idx}`} c={c} isNew={isNew(c, w)} miles={distanceTo(c, project)} />)}
              </ul>
            )}
          </section>
        );
      })}

      <h2>Add a watch</h2>
      <form action={createWatch} className="card stack-form watch-form">
        <label>Name (optional)<input name="name" placeholder="e.g. West St. Charles County rezonings" /></label>
        <div className="watch-grid">
          <label>Near a project
            <select name="project_id" defaultValue="">
              <option value="">No project</option>
              {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.lat == null ? " (no location)" : ""}</option>)}
            </select>
          </label>
          <label>Radius (miles)<input name="radius_miles" type="number" min="0.5" max="50" step="0.5" defaultValue="3" /></label>
        </div>
        <fieldset>
          <legend>Counties (any selected)</legend>
          {counties.map((c) => <label key={c} className="check"><input type="checkbox" name="counties" value={c} /> {c} County</label>)}
        </fieldset>
        <label>Or specific cities
          <select name="jurisdiction_ids" multiple size={6}>
            {(jurisdictions ?? []).map((j) => <option key={j.id} value={j.id}>{shortName(j.name)}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>Case types (none checked = rezonings, PUDs, special uses, annexations)</legend>
          {TYPE_CHOICES.map((t) => <label key={t} className="check"><input type="checkbox" name="types" value={t} /> {ITEM_TYPE_LABEL[t]}</label>)}
        </fieldset>
        <div><button type="submit">Add watch</button> <span className="small muted">Pick a project, a county or a city.</span></div>
      </form>
    </>
  );
}
