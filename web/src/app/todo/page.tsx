import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { setTodoDone, updateTodo } from "./actions";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

export default async function TodoPage() {
  const supabase = await createClient();
  const { data: todos } = await supabase.from("todos").select("*").order("done_at", { nullsFirst: true }).order("created_at", { ascending: false });
  const open = (todos ?? []).filter((t) => !t.done_at);
  const done = (todos ?? []).filter((t) => t.done_at);

  const row = (t: NonNullable<typeof todos>[number]) => (
    <li key={t.id} className={t.done_at ? "todo done" : "todo"}>
      <form action={setTodoDone.bind(null, t.id, !t.done_at)}>
        <button type="submit" className="link" aria-label={t.done_at ? "Reopen" : "Mark done"}>{t.done_at ? "☑" : "☐"}</button>
      </form>
      <div>
        <div className="todo-body">{t.body}</div>
        <div className="small muted">
          {t.created_by_email ?? "Unknown"} · {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}
          {t.page && <> · <Link href={t.page}>{t.page}</Link></>}
          {" · "}
          <details className="todo-edit">
            <summary className="link">Edit</summary>
            {/* Keyed on the text so the box shows the saved wording after a save. */}
            <form key={t.body} action={updateTodo.bind(null, t.id)} className="stack-form">
              <textarea name="body" rows={3} required defaultValue={t.body} />
              <div><button type="submit">Save</button></div>
            </form>
          </details>
        </div>
      </div>
    </li>
  );

  return (
    <>
      <PageTitle href="/todo">Suggestions</PageTitle>
      <p className="muted">Ideas and fixes for this site. Use the Suggest button in the header on any page to add one.</p>
      {open.length === 0 ? <div className="card empty">Nothing open.</div> : <ul className="todos card">{open.map(row)}</ul>}
      {done.length > 0 && (
        <>
          <h2>Done</h2>
          <ul className="todos card">{done.map(row)}</ul>
        </>
      )}
    </>
  );
}
