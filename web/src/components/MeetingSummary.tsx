export type SummaryItem = { item: string; request: string; result: string };
// Hand-entered items have item + request; items read by the extract-agendas function also carry the rest.
export type AgendaItem = {
  item: string; request: string; type?: string; case_number?: string | null; applicant?: string | null;
  address?: string | null; from_zoning?: string | null; to_zoning?: string | null; acres?: number | null; units?: number | null;
};

export const ITEM_TYPE_LABEL: Record<string, string> = {
  rezoning: "Rezoning", pud: "PUD", special_use: "Special use", preliminary_plat: "Preliminary plat", final_plat: "Final plat",
  site_plan: "Site plan", annexation: "Annexation", comprehensive_plan: "Comp plan", text_amendment: "Code change",
  variance: "Variance", vacation: "Vacation", development_agreement: "Dev. agreement", other: "Other",
};

// Renders the light markdown stored in meetings.summary: "## " headings, "- " bullets, blank-line paragraphs.
export function SummaryText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) blocks.push(<ul key={blocks.length}>{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>);
    bullets = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("- ")) { bullets.push(line.slice(2)); continue; }
    flush();
    if (line.startsWith("## ")) blocks.push(<h3 key={blocks.length}>{line.slice(3)}</h3>);
    else if (line) blocks.push(<p key={blocks.length}>{line}</p>);
  }
  flush();
  return <div className="summary">{blocks}</div>;
}

export function SummaryItems({ items }: { items: SummaryItem[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Item</th><th>Request</th><th>Result</th></tr></thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}><td>{it.item}</td><td>{it.request}</td><td>{it.result}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AgendaItems({ items }: { items: AgendaItem[] }) {
  const typed = items.some((it) => it.type);
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{typed && <th>Type</th>}<th>Item</th><th>Request</th>{typed && <th>Applicant</th>}</tr></thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              {typed && <td>{it.type && <span className={`tag case-${it.type}`}>{ITEM_TYPE_LABEL[it.type] ?? it.type}</span>}</td>}
              <td>{it.item}</td>
              <td>{it.request}</td>
              {typed && <td>{it.applicant ?? <span className="muted">—</span>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const BODY_LABEL: Record<string, string> = { planning_zoning: "Planning & Zoning", governing_body: "Council / Aldermen" };
