"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { geocode, placeName } from "@/lib/geocode";
import { DATE_FIELDS, MONEY_FIELDS, TEXT_FIELDS, parseMoney } from "@/lib/oyl";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim() || null;

function lotFromForm(fd: FormData) {
  const row: Record<string, string | number | null> = { updated_at: new Date().toISOString() };
  for (const k of TEXT_FIELDS) row[k] = text(fd, k);
  for (const k of DATE_FIELDS) row[k] = text(fd, k);
  for (const k of MONEY_FIELDS) row[k] = parseMoney(fd.get(k));
  return row;
}

// The project side: address and municipality (re-located on change), diligence end and purchase date. A lot the
// customer has bought moves the project to Closed; a closed one that's reopened goes back to OYL. A new lot's project
// is named after its address; editing the lot leaves the project's name alone.
function projectFromForm(fd: FormData) {
  const address = text(fd, "address");
  const customer = text(fd, "ownership") === "Customer" || text(fd, "sales_status") === "Customer Purchased";
  return {
    address,
    jurisdiction_id: text(fd, "jurisdiction_id"),
    diligence_expires_on: text(fd, "diligence_expires_on"),
    closing_on: text(fd, "closing_on"),
    customer,
  };
}

async function locate(projectId: number) {
  const supabase = await createClient();
  const { data: p } = await supabase.from("projects").select("address, jurisdictions(name)").eq("id", projectId).single();
  const jname = (p?.jurisdictions as unknown as { name: string } | null)?.name ?? "";
  const point = p?.address ? await geocode(p.address, placeName(jname)) : null;
  await supabase.from("projects").update({ lat: point?.lat ?? null, lng: point?.lng ?? null }).eq("id", projectId);
}

export async function createLot(fd: FormData) {
  const { customer, ...project } = projectFromForm(fd);
  if (!project.address) return;
  const supabase = await createClient();
  const { data: p, error } = await supabase.from("projects").insert({ ...project, name: project.address, stage: customer ? "closed" : "oyl" }).select("id").single();
  if (error) throw new Error(error.message);
  const { error: lotError } = await supabase.from("oyl_lots").insert({ ...lotFromForm(fd), project_id: p.id });
  if (lotError) throw new Error(lotError.message);
  if (project.jurisdiction_id) await supabase.from("jurisdictions").update({ followed: true }).eq("id", project.jurisdiction_id).eq("followed", false);
  await locate(p.id);
  revalidatePath("/", "layout");
  redirect("/oyl");
}

export async function updateLot(lotId: number, fd: FormData) {
  const supabase = await createClient();
  const { data: lot } = await supabase.from("oyl_lots").select("project_id, projects(address, jurisdiction_id, stage)").eq("id", lotId).single();
  if (!lot) return;
  const before = lot.projects as unknown as { address: string | null; jurisdiction_id: string | null; stage: string };
  const { customer, ...project } = projectFromForm(fd);
  const stage = customer ? "closed" : before.stage === "closed" ? "oyl" : before.stage;
  const { error } = await supabase.from("projects").update({ ...project, stage }).eq("id", lot.project_id);
  if (error) throw new Error(error.message);
  const { error: lotError } = await supabase.from("oyl_lots").update(lotFromForm(fd)).eq("id", lotId);
  if (lotError) throw new Error(lotError.message);
  if (project.address !== before.address || project.jurisdiction_id !== before.jurisdiction_id) await locate(lot.project_id);
  revalidatePath("/", "layout");
  redirect("/oyl");
}
