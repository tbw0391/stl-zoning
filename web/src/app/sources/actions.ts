"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markReviewed(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("source_watches").update({ reviewed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/sources");
  revalidatePath("/progress");
}
