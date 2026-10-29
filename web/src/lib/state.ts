import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enabledFeatures } from "@/lib/features";
import { isDemo } from "@/lib/demo";
import { SITE_MODE } from "@/lib/siteMode";

// The site shows one state at a time. Missouri unless the "state-picker" feature is on and another state is picked
// in the header; the choice is a cookie, so it's per browser until logins exist (then it comes from the account).
export const STATES: Record<string, string> = { MO: "Missouri", OH: "Ohio" };
// The metro area each state covers, for the header menu (suggestion #17: by state and big city). One per state for
// now; a second metro in a state would need its own choice.
export const METROS: Record<string, string> = { MO: "St. Louis area (MO)", OH: "Columbus area (OH)" };
export const STATE_COOKIE = "state";

export async function currentState(): Promise<string> {
  if (SITE_MODE === "lombardo") return "MO";
  if (await isDemo()) return "OH";
  if (!(await enabledFeatures()).includes("state-picker")) return "MO";
  const picked = (await cookies()).get(STATE_COOKIE)?.value ?? "";
  return picked in STATES ? picked : "MO";
}

// Ids of every jurisdiction in the state being shown, followed or not (for lists that keep unfollowed places, like /votes).
export async function stateIds(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from("jurisdictions").select("id").eq("state", await currentState());
  return (data ?? []).map((j) => j.id);
}
