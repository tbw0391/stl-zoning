import Link from "next/link";
import { addTask, setTaskDone } from "@/app/tasks/actions";
import { fmtDate, todayCentral } from "@/lib/format";

export type Task = {
  id: number;
  project_id: number | null;
  title: string;
  assigned_to: string | null;
  due_date: string | null;
  done_at: string | null;
  projects?: { name: string } | null;
};

export const TASK_SELECT = "*, projects(name)";

export function TaskList({ tasks, showProject = true }: { tasks: Task[]; showProject?: boolean }) {
  const today = todayCentral();
  return (
    <ul className="todos card">
      {tasks.map((t) => {
        const overdue = !t.done_at && t.due_date && t.due_date < today;
        return (
          <li key={t.id} className={t.done_at ? "todo done" : "todo"}>
            <form action={setTaskDone.bind(null, t.id, !t.done_at)}>
              <button type="submit" className="link" aria-label={t.done_at ? "Reopen" : "Mark done"}>{t.done_at ? "☑" : "☐"}</button>
            </form>
            <div>
              <div className="todo-body">{t.title}</div>
              <div className="small muted">
                {t.due_date && (
                  <span className={overdue ? "tag due" : t.due_date === today ? "tag tentative" : undefined}>
                    {overdue ? "Overdue · " : t.due_date === today ? "Today · " : "Due "}{fmtDate(t.due_date)}
                  </span>
                )}
                {t.due_date && " · "}
                {t.assigned_to ?? "Unassigned"}
                {showProject && t.project_id && <> · <Link href={`/projects/${t.project_id}`}>{t.projects?.name ?? "Project"}</Link></>}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function TaskForm({ projects, projectId, people }: {
  projects?: { id: number; name: string }[];
  projectId?: number;
  people: string[];
}) {
  return (
    <form action={addTask} className="filters inline-form">
      <label className="grow">Task
        <input name="title" required placeholder="e.g. Call city engineer about sewer capacity" />
      </label>
      <label>Assigned to
        <input name="assigned_to" list="task-people" placeholder="Name" />
        <datalist id="task-people">{people.map((p) => <option key={p} value={p} />)}</datalist>
      </label>
      <label>Follow up by
        <input name="due_date" type="date" />
      </label>
      {projectId ? (
        <input type="hidden" name="project_id" value={projectId} />
      ) : (
        <label>Project
          <select name="project_id" defaultValue="">
            <option value="">None</option>
            {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}
      <button type="submit">Add task</button>
    </form>
  );
}

// Names already used as assignees, for the datalist.
export function assignees(rows: { assigned_to: string | null }[] | null) {
  return [...new Set((rows ?? []).map((r) => r.assigned_to).filter((x): x is string => !!x))].sort();
}
