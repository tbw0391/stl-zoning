"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayCentral } from "@/lib/format";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim() || null;

const MEETING_FIELDS = ["jurisdiction_id", "body", "event_type", "event_date", "event_time", "status", "location", "note",
  "agenda_url", "packet_url", "video_url", "source_url"];

// Saving through the site counts as a fresh check of the meeting's details.
function meetingFromForm(fd: FormData) {
  const row: Record<string, string | null> = {};
  for (const k of MEETING_FIELDS) if (fd.has(k)) row[k] = text(fd, k);
  row.verified_on = todayCentral();
  return row;
}

export async function createMeeting(fd: FormData) {
  const row = meetingFromForm(fd);
  if (!row.jurisdiction_id || !row.body || !row.event_type || !row.event_date) return;
  const supabase = await createClient();
  const { data, error } = await supabase.from("meetings").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(`/meetings/${data.id}`);
}

export async function updateMeeting(id: number, oldAgendaUrl: string | null, fd: FormData) {
  const row: Record<string, string | null> = meetingFromForm(fd);
  if (!row.event_date || !row.status) return;
  // A new agenda link goes back in the agenda reader's queue.
  if (row.agenda_url !== oldAgendaUrl) row.agenda_checked_on = null;
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(`/meetings/${id}`);
}
