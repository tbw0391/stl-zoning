import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addTemplateItem, setTemplateActive } from "../actions";

export const dynamic = "force-dynamic";

export default async function DefaultChecklistPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("checklist_templates").select("*").order("sort_order").order("id");
  const active = (data ?? []).filter((t) => t.active);
  const retired = (data ?? []).filter((t) => !t.active);

  return (
    <>
      <p className="small"><Link href="/projects">← All projects</Link></p>
      <h1>Default checklist</h1>
      <p className="muted">
        These items are copied into every new project. Each project can also have its own extra items.
        Changes here don&apos;t alter existing projects; use &ldquo;Add missing default checklist items&rdquo; on a project to bring it up to date.
      </p>
      <div className="card">
        {active.length === 0 && <p className="muted small" style={{ marginTop: 0 }}>No default items yet.</p>}
        <ol className="checklist numbered">
          {active.map((t) => (
            <li key={t.id}>
              <span className="grow">{t.body}</span>
              <form action={setTemplateActive.bind(null, t.id, false)}>
                <button type="submit" className="link small">Remove</button>
              </form>
            </li>
          ))}
        </ol>
        <form action={addTemplateItem} className="row-form">
          <input name="body" required placeholder="Add a default item" />
          <button type="submit">Add</button>
        </form>
      </div>
      {retired.length > 0 && (
        <>
          <h2>Removed</h2>
          <ul className="checklist card">
            {retired.map((t) => (
              <li key={t.id} className="done">
                <span className="grow">{t.body}</span>
                <form action={setTemplateActive.bind(null, t.id, true)}>
                  <button type="submit" className="link small">Restore</button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
