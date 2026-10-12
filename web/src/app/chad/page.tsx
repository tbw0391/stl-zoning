import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, shortName } from "@/lib/format";
import { saveTaskAnswer, setTaskDone } from "@/app/tasks/actions";

export const dynamic = "force-dynamic";

const WHO = "Chad";

type CallTask = {
  id: number;
  title: string;
  jurisdiction_id: string | null;
  contact: string | null;
  details: string | null;
  answer: string | null;
  due_date: string | null;
  done_at: string | null;
  jurisdictions: { name: string } | null;
};

// Turns phone numbers and emails in the contact line into tap-to-call / mail links.
function ContactLine({ text }: { text: string }) {
  const parts = text.split(/(\(?\d{3}\)?[ -]?\d{3}-\d{4}(?: x\d+)?|[\w.+-]+@[\w.-]+\.\w+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (/@/.test(p)) return <a key={i} href={`mailto:${p}`}>{p}</a>;
        if (/\d{3}-\d{4}/.test(p)) return <a key={i} href={`tel:${p.replace(/ x/, ",").replace(/[^\d,]/g, "")}`}>{p}</a>;
        return p;
      })}
    </>
  );
}

function CallCard({ t }: { t: CallTask }) {
  return (
    <div className={t.done_at ? "card call done" : "card call"}>
      <div className="call-head">
        <form action={setTaskDone.bind(null, t.id, !t.done_at)}>
          <button type="submit" className="link" aria-label={t.done_at ? "Reopen" : "Mark done"}>{t.done_at ? "☑" : "☐"}</button>
        </form>
        <div className="grow">
          <strong>{t.title}</strong>
          {t.due_date && <span className="small muted"> · by {fmtDate(t.due_date)}</span>}
          {t.contact && <div className="small">Call: <ContactLine text={t.contact} /></div>}
        </div>
      </div>
      {t.details && <p className="call-details">{t.details}</p>}
      <form action={saveTaskAnswer.bind(null, t.id)} className="stack-form">
        <label>What you found out
          <textarea name="answer" rows={2} defaultValue={t.answer ?? ""} placeholder="Dates, names, the rule they gave you…" />
        </label>
        <div><button type="submit">Save</button></div>
      </form>
    </div>
  );
}

export default async function ChadPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("tasks")
    .select("id, title, jurisdiction_id, contact, details, answer, due_date, done_at, jurisdictions(name)")
    .eq("assigned_to", WHO).order("due_date", { nullsFirst: false }).order("id");
  const tasks = (data ?? []) as unknown as CallTask[];
  const open = tasks.filter((t) => !t.done_at);
  const done = tasks.filter((t) => t.done_at);

  const byJ = new Map<string, CallTask[]>();
  for (const t of open) {
    const k = t.jurisdiction_id ?? "";
    if (!byJ.has(k)) byJ.set(k, []);
    byJ.get(k)!.push(t);
  }

  return (
    <>
      <h1>Chad&apos;s tasks</h1>
      <p className="muted">
        Calls and emails the website can&apos;t answer. Write down what you learn and check the box; it gets loaded into the tracker.
        These also appear on the <Link href={`/tasks?who=${WHO}`}>Tasks</Link> page.
      </p>

      {open.length === 0 && <div className="card empty">Nothing open. Nice.</div>}
      {[...byJ.entries()].map(([jid, list]) => (
        <section key={jid}>
          <h2>{jid ? <Link href={`/jurisdictions/${jid}`}>{shortName(list[0].jurisdictions?.name ?? jid)}</Link> : "General"}</h2>
          <div className="meeting-list">{list.map((t) => <CallCard key={t.id} t={t} />)}</div>
        </section>
      ))}

      {done.length > 0 && (
        <>
          <h2>Done <span className="muted small">({done.length})</span></h2>
          <div className="meeting-list">{done.map((t) => <CallCard key={t.id} t={t} />)}</div>
        </>
      )}
    </>
  );
}
