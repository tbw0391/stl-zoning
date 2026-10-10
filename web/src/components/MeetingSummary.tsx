export type SummaryItem = { item: string; request: string; result: string };

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

export const BODY_LABEL: Record<string, string> = { planning_zoning: "Planning & Zoning", governing_body: "Council / Aldermen" };
