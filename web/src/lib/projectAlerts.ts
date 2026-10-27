// Project alerts (timeline delays for now). The site has no logins, so "seen" is kept per browser in a cookie:
// each person dismisses alerts on their own device without clearing them for the rest of the team.
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const SEEN_COOKIE = "project_alerts_seen";
// Alerts dismissed one at a time (comma-separated ids).
export const DISMISSED_COOKIE = "project_alerts_dismissed";
// A browser that has never dismissed anything sees alerts from this many days back.
const FIRST_VISIT_DAYS = 14;

export type ProjectAlert = { id: number; project_id: number; kind: string; title: string; body: string | null; created_at: string };

export async function unseenProjectAlerts(supabase: SupabaseClient): Promise<ProjectAlert[]> {
  const store = await cookies();
  const seen = store.get(SEEN_COOKIE)?.value ?? new Date(Date.now() - FIRST_VISIT_DAYS * 86400000).toISOString();
  const dismissed = new Set((store.get(DISMISSED_COOKIE)?.value ?? "").split(","));
  const { data } = await supabase.from("project_alerts").select("*").gt("created_at", seen).order("created_at", { ascending: false });
  return ((data ?? []) as ProjectAlert[]).filter((a) => !dismissed.has(String(a.id)));
}
