"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  let q = supabase.from("watches").update({ last_seen_at: new Date().toISOString() });
  q = id ? q.eq("id", id) : q.gt("id", 0);
  const { error } = await q;
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
