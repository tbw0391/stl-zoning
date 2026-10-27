"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DISMISSED_COOKIE, SEEN_COOKIE } from "@/lib/projectAlerts";

const list = (fd: FormData, key: string) => {
  const v = fd.getAll(key).map(String).filter(Boolean);
  return v.length ? v : null;
};

export async function createWatch(fd: FormData) {
  const projectId = fd.get("project_id") ? Number(fd.get("project_id")) : null;
  const counties = list(fd, "counties");
  const jurisdictions = list(fd, "jurisdiction_ids");
  if (!projectId && !counties && !jurisdictions) return; // a watch needs some area
  const supabase = await createClient();
  let name = String(fd.get("name") ?? "").trim();
  if (!name && projectId) {
    const { data: p } = await supabase.from("projects").select("name").eq("id", projectId).single();
    name = `Near ${p?.name ?? "project"}`;
  }
  if (!name) name = [...(counties ?? []).map((c) => `${c} County`), ...(jurisdictions ?? [])].join(", ");
  const { error } = await supabase.from("watches").insert({
    name, project_id: projectId, radius_miles: Number(fd.get("radius_miles") || 3),
    counties, jurisdiction_ids: jurisdictions, types: list(fd, "types"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function deleteWatch(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("watches").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function markSeen(id?: number) {
  const supabase = await createClient();
  let q = supabase.from("watches").update({ last_seen_at: new Date().toISOString(), seen_cases: [] });
  q = id ? q.eq("id", id) : q.gt("id", 0);
  const { error } = await q;
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// One case marked seen (suggestion #40), under every watch so it stops counting toward the badge too.
export async function markCaseSeen(key: string) {
  const supabase = await createClient();
  const { data: watches } = await supabase.from("watches").select("id, seen_cases");
  for (const w of watches ?? []) {
    if ((w.seen_cases ?? []).includes(key)) continue;
    const { error } = await supabase.from("watches").update({ seen_cases: [...(w.seen_cases ?? []), key] }).eq("id", w.id);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/", "layout");
}

// One project alert dismissed in this browser (suggestion #40); the cookie keeps the latest 200.
export async function dismissProjectAlert(id: number) {
  const store = await cookies();
  const ids = (store.get(DISMISSED_COOKIE)?.value ?? "").split(",").filter(Boolean);
  if (!ids.includes(String(id))) ids.push(String(id));
  store.set(DISMISSED_COOKIE, ids.slice(-200).join(","), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

// Dismiss project alerts in this browser only (see lib/projectAlerts).
export async function dismissProjectAlerts() {
  (await cookies()).set(SEEN_COOKIE, new Date().toISOString(), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
