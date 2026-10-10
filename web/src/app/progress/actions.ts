"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayCentral } from "@/lib/format";

const STATUSES = ["not_started", "in_progress", "done", "blocked"];

export async function updateProgress(jurisdictionId: string, task: string, fd: FormData) {
  const status = String(fd.get("status") ?? "");
  if (!STATUSES.includes(status)) return;
  const note = String(fd.get("note") ?? "").trim() || null;
  const supabase = await createClient();
  const { error } = await supabase.from("jurisdiction_progress")
    .update({ status, note, updated_on: todayCentral() })
    .eq("jurisdiction_id", jurisdictionId).eq("task", task);
  if (error) throw new Error(error.message);
  revalidatePath("/progress");
}
