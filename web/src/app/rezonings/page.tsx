import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDays, fmtDate, shortName, todayCentral } from "@/lib/format";
import { AgendaItem, BODY_LABEL, ITEM_TYPE_LABEL } from "@/components/MeetingSummary";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

// Groups for the type filter; "zoning" is what most land teams watch.
const GROUPS: Record<string, { label: string; types: string[] }> = {
  zoning: { label: "Rezonings, PUDs & special uses", types: ["rezoning", "pud", "special_use", "annexation"] },
  plats: { label: "Plats & site plans", types: ["preliminary_plat", "final_plat", "site_plan"] },
  policy: { label: "Code & comp plan changes", types: ["text_amendment", "comprehensive_plan"] },
  all: { label: "All land-use items", types: [] },
};
const RANGES: Record<string, { label: string; from: number; to: number }> = {
  upcoming: { label: "Upcoming", from: 0, to: 365 },
  recent: { label: "Last 45 days", from: -45, to: -1 },
  both: { label: "Last 45 days and upcoming", from: -45, to: 365 },
};

type Row = {
  id: number; jurisdiction_id: string; body: string; event_date: string; agenda_url: string | null;
  agenda_items: AgendaItem[]; jurisdictions: { name: string; county: string } | null;
};

export default async function RezoningsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const group = GROUPS[sp.type ?? ""] ? sp.type! : "zoning";
  const range = RANGES[sp.when ?? ""] ? sp.when! : "both";
  const today = todayCentral();
  const supabase = await createClient();

  const { data } = await supabase.from("meetings")
    .select("id, jurisdiction_id, body, event_date, agenda_url, agenda_items, jurisdictions(name, county)")
    .not("agenda_items", "is", null)
    .gte("event_date", addDays(today, RANGES[range].from)).lte("event_date", addDays(today, RANGES[range].to))
    .order("event_date", { ascending: range === "upcoming" });
  const meetings = ((data ?? []) as unknown as Row[]).filter((m) => !sp.county || m.jurisdictions?.county === sp.county);
  const counties = [...new Set(((data ?? []) as unknown as Row[]).map((m) => m.jurisdictions?.county).filter(Boolean))].sort() as string[];

  const types = GROUPS[group].types;
  const rows = meetings.flatMap((m) =>
    (m.agenda_items ?? []).filter((it) => !types.length || (it.type ? types.includes(it.type) : group === "zoning" && /rezon|zoning|PUD|special use|conditional use/i.test(`${it.item} ${it.request}`)))
      .map((it, i) => ({ m, it, key: `${m.id}-${i}` })));

  return (
    <>
      <PageTitle href="/rezonings">Rezonings</PageTitle>
      <p className="muted">
        Land-use cases on posted P&amp;Z and council agendas across every jurisdiction we track, read from the agendas automatically.
        Check the posted agenda before relying on a detail.
      </p>

      <form className="filters" method="get">
        <label>Show
          <select name="type" defaultValue={group}>
            {Object.entries(GROUPS).map(([k, g]) => <option key={k} value={k}>{g.label}</option>)}
          </select>
        </label>
        <label>When
          <select name="when" defaultValue={range}>
            {Object.entries(RANGES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
          </select>
        </label>
        <label>County
          <select name="county" defaultValue={sp.county ?? ""}>
            <option value="">All</option>
            {counties.map((c) => <option key={c} value={c}>{c} County</option>)}
          </select>
        </label>
        <button type="submit">Apply</button>
      </form>

      {rows.length === 0 ? (
        <div className="card empty">No matching items yet. Agendas are read within an hour of being posted.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Meeting</th><th>Type</th><th>Case</th><th>Request</th><th>Applicant</th></tr>
            </thead>
            <tbody>
              {rows.map(({ m, it, key }) => (
                <tr key={key}>
                  <td>
                    <Link href={`/meetings/${m.id}`}><strong>{shortName(m.jurisdictions?.name ?? m.jurisdiction_id)}</strong></Link>
                    <div className="small muted">{fmtDate(m.event_date)} · {m.body === "planning_zoning" ? "P&Z" : BODY_LABEL[m.body]}</div>
                  </td>
                  <td>{it.type ? <span className={`tag case-${it.type}`}>{ITEM_TYPE_LABEL[it.type] ?? it.type}</span> : <span className="muted">—</span>}</td>
                  <td>{it.item}</td>
                  <td>
                    {it.request}
                    {(it.acres != null || it.units != null) && (
                      <div className="small muted">{[it.acres != null && `${it.acres} ac`, it.units != null && `${it.units} units`].filter(Boolean).join(" · ")}</div>
                    )}
                  </td>
                  <td>{it.applicant ?? <span className="muted">—</span>}{m.agenda_url && <div className="small"><a href={m.agenda_url} target="_blank" rel="noreferrer">Agenda ↗</a></div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
