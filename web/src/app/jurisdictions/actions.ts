"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentState } from "@/lib/state";

// Follow or stop following one jurisdiction, or every jurisdiction in a county (of the state being shown: Missouri and
// Ohio both have a Franklin County).
export async function setFollowed(followed: boolean, target: { id?: string; county?: string }) {
  if (!target.id && !target.county) return;
  const supabase = await createClient();
  let q = supabase.from("jurisdictions").update({ followed });
  q = target.id ? q.eq("id", target.id) : q.eq("county", target.county!).eq("state", await currentState());
  const { error } = await q;
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// Saves the checklist on /jurisdictions: checked ids are followed, every other jurisdiction in the state being shown is not.
export async function saveFollowed(fd: FormData) {
  const ids = fd.getAll("followed").map(String).filter((id) => /^[a-z0-9_]+$/.test(id));
  const supabase = await createClient();
  const st = await currentState();
  const on = ids.length ? await supabase.from("jurisdictions").update({ followed: true }).in("id", ids) : { error: null };
  const off = ids.length
    ? await supabase.from("jurisdictions").update({ followed: false }).eq("state", st).not("id", "in", `(${ids.join(",")})`)
    : await supabase.from("jurisdictions").update({ followed: false }).eq("state", st);
  const error = on.error ?? off.error;
  if (error) throw new Error(error.message);
  // Hides the "pick your jurisdictions" banner on the calendar page.
  await supabase.from("site_flags").upsert({ key: "followed_reviewed", set_at: new Date().toISOString() });
  revalidatePath("/", "layout");
}
