"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayCentral } from "@/lib/format";
import { parseLinks, type ProfileLink } from "@/components/ProfileLinks";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim() || null;

const PERSON_FIELDS = ["jurisdiction_id", "full_name", "role_group", "title", "email", "phone", "term_expires", "source_url"];

// Saving through the site counts as a fresh check of the person's details.
function personFromForm(fd: FormData) {
  const row: Record<string, string | ProfileLink[] | null> = {};
  for (const k of PERSON_FIELDS) if (fd.has(k)) row[k] = text(fd, k);
  if (fd.has("links")) row.links = parseLinks(String(fd.get("links")));
  row.verified_on = todayCentral();
  return row;
}

function backTo(fd: FormData) {
  const j = text(fd, "jurisdiction_id");
  return j ? `/directory?j=${j}` : "/directory";
}

export async function createPerson(fd: FormData) {
  const row = personFromForm(fd);
  if (!row.full_name || !row.jurisdiction_id || !row.role_group) return;
  const supabase = await createClient();
  const { error } = await supabase.from("people").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(backTo(fd));
}

export async function updatePerson(id: number, fd: FormData) {
  const row = personFromForm(fd);
  if (!row.full_name) return;
  const supabase = await createClient();
  const { error } = await supabase.from("people").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(backTo(fd));
}

export async function removePerson(id: number, jurisdictionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("people").update({ active: false }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(`/directory?j=${jurisdictionId}`);
}
