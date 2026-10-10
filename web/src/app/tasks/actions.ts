"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addTask(fd: FormData) {
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return;
  const opt = (k: string) => String(fd.get(k) ?? "").trim() || null;
  const project = opt("project_id");
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    title,
    assigned_to: opt("assigned_to"),
    due_date: opt("due_date"),
    project_id: project ? Number(project) : null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function setTaskDone(id: number, done: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
