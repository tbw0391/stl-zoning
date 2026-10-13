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

// Ask for an older agenda to be read (the reader skips agendas past its 45-day window). It waits for approval on
// /agenda-requests, since each read is a paid API call; the requester is emailed when it's done.
export async function requestAgendaRead(id: number, fd: FormData) {
  const email = text(fd, "email");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("meetings")
    .update({ agenda_requested_at: new Date().toISOString(), agenda_requested_by: email, agenda_request_status: "pending", agenda_request_notified_at: null })
    .eq("id", id).is("agenda_checked_on", null);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function decideAgendaRequest(id: number, status: "approved" | "declined") {
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").update({ agenda_request_status: status }).eq("id", id).eq("agenda_request_status", "pending");
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
