import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayCentral } from "@/lib/format";
import { TASK_SELECT, Task, TaskForm, TaskList, assignees } from "@/components/Tasks";

export const dynamic = "force-dynamic";

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const today = todayCentral();
  const weekOut = addDays(today, 7);
  const supabase = await createClient();

  let q = supabase.from("tasks").select(TASK_SELECT).is("done_at", null).order("due_date", { nullsFirst: false }).order("created_at");
  if (sp.who) q = q.eq("assigned_to", sp.who);
  const [{ data }, { data: projects }, { data: names }, { data: recentDone }] = await Promise.all([
    q,
    supabase.from("projects").select("id, name").order("name"),
    supabase.from("tasks").select("assigned_to"),
    supabase.from("tasks").select(TASK_SELECT).not("done_at", "is", null).order("done_at", { ascending: false }).limit(15),
  ]);
  const tasks = (data ?? []) as Task[];
  const people = assignees(names);

  const groups: [string, Task[]][] = [
    ["Overdue", tasks.filter((t) => t.due_date && t.due_date < today)],
    ["Today", tasks.filter((t) => t.due_date === today)],
    ["Next 7 days", tasks.filter((t) => t.due_date && t.due_date > today && t.due_date <= weekOut)],
    ["Later", tasks.filter((t) => t.due_date && t.due_date > weekOut)],
    ["No date", tasks.filter((t) => !t.due_date)],
  ];

  return (
    <>
      <h1>Tasks</h1>
      <p className="muted">Follow-ups for the team. Tasks with a date also show on the <Link href="/">calendar</Link>.</p>

      <TaskForm projects={projects ?? []} people={people} />

      {people.length > 0 && (
        <p className="small">
          Show:{" "}
          <Link href="/tasks">{sp.who ? "Everyone" : <strong>Everyone</strong>}</Link>
          {people.map((p) => (
            <span key={p}> · <Link href={`/tasks?who=${encodeURIComponent(p)}`}>{sp.who === p ? <strong>{p}</strong> : p}</Link></span>
          ))}
        </p>
      )}

      {tasks.length === 0 && <div className="card empty">No open tasks.</div>}
      {groups.filter(([, list]) => list.length).map(([label, list]) => (
        <section key={label}>
          <h2>{label} <span className="muted small">({list.length})</span></h2>
          <TaskList tasks={list} />
        </section>
      ))}

      {!sp.who && (recentDone ?? []).length > 0 && (
        <>
          <h2>Recently done</h2>
          <TaskList tasks={recentDone as Task[]} />
        </>
      )}
    </>
  );
}
