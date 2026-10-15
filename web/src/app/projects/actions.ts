"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { geocode, placeName } from "@/lib/geocode";
import { fmtDate } from "@/lib/format";
import { Delay, STEP_LABEL, currentStep, daysBetween, loadDelays, loadTimeline } from "@/lib/timeline";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim() || null;

const PROJECT_FIELDS = ["name", "jurisdiction_id", "address", "parcel_ids", "current_zoning", "proposed_zoning", "stage", "description", "filed_on"];

function projectFromForm(fd: FormData) {
  const row: Record<string, string | number | null> = {};
  for (const k of PROJECT_FIELDS) if (fd.has(k)) row[k] = text(fd, k);
  if (fd.has("acreage")) row.acreage = text(fd, "acreage") ? Number(fd.get("acreage")) : null;
  return row;
}

// Locate the project from its address so nearby land-use cases and radius watches work.
async function locateProject(id: number) {
  const supabase = await createClient();
  const { data: p } = await supabase.from("projects").select("address, jurisdictions(name)").eq("id", id).single();
  const jname = (p?.jurisdictions as unknown as { name: string } | null)?.name ?? "";
  const point = p?.address ? await geocode(p.address, placeName(jname)) : null;
  await supabase.from("projects").update({ lat: point?.lat ?? null, lng: point?.lng ?? null }).eq("id", id);
}

// A project's municipality is always followed (suggestion #13), so its meetings and agendas keep being collected.
async function followProjectPlace(jurisdictionId: unknown) {
  if (typeof jurisdictionId !== "string" || !jurisdictionId) return;
  const supabase = await createClient();
  await supabase.from("jurisdictions").update({ followed: true }).eq("id", jurisdictionId).eq("followed", false);
}

export async function createProject(fd: FormData) {
  const row = projectFromForm(fd);
  if (!row.name) return;
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  await followProjectPlace(row.jurisdiction_id);
  if (row.address) await locateProject(data.id);
  redirect(`/projects/${data.id}`);
}

export async function updateProject(id: number, fd: FormData) {
  const row = projectFromForm(fd);
  if ("name" in row && !row.name) return;
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  await followProjectPlace(row.jurisdiction_id);
  if ("address" in row || "jurisdiction_id" in row) await locateProject(id);
  revalidatePath("/", "layout");
}

export async function addNote(projectId: number, fd: FormData) {
  const body = text(fd, "body");
  if (!body) return;
  const supabase = await createClient();
  const { error } = await supabase.from("project_notes").insert({ project_id: projectId, body, author: text(fd, "author") });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function addChecklistItem(projectId: number, fd: FormData) {
  const body = text(fd, "body");
  if (!body) return;
  const supabase = await createClient();
  const { data: last } = await supabase.from("checklist_items").select("sort_order").eq("project_id", projectId)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("checklist_items").insert({ project_id: projectId, body, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function setChecklistDone(id: number, done: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function deleteChecklistItem(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// Default checklist (copied into each new project).
export async function addTemplateItem(fd: FormData) {
  const body = text(fd, "body");
  if (!body) return;
  const supabase = await createClient();
  const { data: last } = await supabase.from("checklist_templates").select("sort_order")
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("checklist_templates").insert({ body, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) throw new Error(error.message);
  revalidatePath("/projects/checklist");
}

export async function setTemplateActive(id: number, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_templates").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/projects/checklist");
}

// Add the active default items a project doesn't have yet (for projects created before an item was added).
export async function applyTemplate(projectId: number) {
  const supabase = await createClient();
  const [{ data: tmpl }, { data: have }] = await Promise.all([
    supabase.from("checklist_templates").select("id, body, sort_order").eq("active", true),
    supabase.from("checklist_items").select("from_template").eq("project_id", projectId),
  ]);
  const existing = new Set((have ?? []).map((h) => h.from_template));
  const rows = (tmpl ?? []).filter((t) => !existing.has(t.id))
    .map((t) => ({ project_id: projectId, body: t.body, sort_order: t.sort_order, from_template: t.id }));
  if (rows.length) {
    const { error } = await supabase.from("checklist_items").insert(rows);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/", "layout");
}

// Log a postponed P&Z hearing or council vote; the timeline shifts from it, and the team gets an alert.
// A new meeting that isn't for that board or isn't after the current date is dropped, so the step goes to the board's next meeting.
export async function addDelay(projectId: number, fd: FormData) {
  const step = fd.get("step") === "council" ? "council" : "pz";
  const supabase = await createClient();
  const { data: p } = await supabase.from("projects").select("name, jurisdiction_id, filed_on").eq("id", projectId).single();
  if (!p?.jurisdiction_id || !p.filed_on) return;
  const delays = await loadDelays(supabase, projectId);
  const before = await loadTimeline(supabase, p.jurisdiction_id, p.filed_on, delays);
  const from = currentStep(before.best, step);
  if (!from?.date) return;

  let toMeeting = Number(fd.get("to_meeting_id")) || null;
  if (toMeeting) {
    const { data: m } = await supabase.from("meetings").select("body, event_date").eq("id", toMeeting).maybeSingle();
    const body = step === "pz" ? "planning_zoning" : "governing_body";
    if (!m || m.body !== body || m.event_date <= from.date) toMeeting = null;
  }
  const delay = { project_id: projectId, step, from_date: from.date, to_meeting_id: toMeeting, reason: text(fd, "reason"), reported_by: text(fd, "reported_by") };
  const { data: row, error } = await supabase.from("project_delays").insert(delay).select("*").single();
  if (error) throw new Error(error.message);

  const after = await loadTimeline(supabase, p.jurisdiction_id, p.filed_on, [...delays, row as Delay]);
  const to = currentStep(after.best, step);
  const [was, now] = [before.best.finalDate, after.best.finalDate];
  const body = [
    `${STEP_LABEL[step]} moved from ${fmtDate(from.date)} to ${to?.date ? fmtDate(to.date) : "a date past the loaded schedule"}${delay.reason ? ` (${delay.reason})` : ""}.`,
    now && was && now !== was ? `Final council action now ${fmtDate(now)}, was ${fmtDate(was)} (+${daysBetween(was, now)} days).`
      : !now ? "Final council action is now past the loaded schedule." : "",
    delay.reported_by ? `Logged by ${delay.reported_by}.` : "",
  ].filter(Boolean).join(" ");
  await supabase.from("project_alerts").insert({ project_id: projectId, kind: "delay", title: `${p.name}: ${STEP_LABEL[step]} postponed`, body });
  revalidatePath("/", "layout");
}

// Undo a delay logged by mistake (its alert stays, as a record that it was posted).
export async function deleteDelay(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("project_delays").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
