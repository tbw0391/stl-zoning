"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addTodo(formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  const page = String(formData.get("page") ?? "") || null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("todos").insert({ body, page, created_by_email: user?.email ?? null });
  if (error) throw new Error(error.message);
  revalidatePath("/todo");
}

export async function setTodoDone(id: number, done: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("todos").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/todo");
}
