"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Follow or stop following one jurisdiction, or every jurisdiction in a county.
export async function setFollowed(followed: boolean, target: { id?: string; county?: string }) {
  if (!target.id && !target.county) return;
  const supabase = await createClient();
  let q = supabase.from("jurisdictions").update({ followed });
  q = target.id ? q.eq("id", target.id) : q.eq("county", target.county!);
  const { error } = await q;
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
