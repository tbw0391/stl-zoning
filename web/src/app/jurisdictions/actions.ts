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

// Saves the checklist on /jurisdictions: checked ids are followed, every other jurisdiction is not.
export async function saveFollowed(fd: FormData) {
  const ids = fd.getAll("followed").map(String).filter((id) => /^[a-z0-9_]+$/.test(id));
  const supabase = await createClient();
  const on = ids.length ? await supabase.from("jurisdictions").update({ followed: true }).in("id", ids) : { error: null };
  const off = ids.length
    ? await supabase.from("jurisdictions").update({ followed: false }).not("id", "in", `(${ids.join(",")})`)
    : await supabase.from("jurisdictions").update({ followed: false }).neq("id", "");
  const error = on.error ?? off.error;
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
