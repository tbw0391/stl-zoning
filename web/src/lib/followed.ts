// Jurisdictions switched off on /jurisdictions (jurisdictions.followed = false), plus every jurisdiction outside the
// state this browser is showing (lib/state). Lists across the site leave them out; the jurisdiction's own page and
// /jurisdictions still show unfollowed ones so they can be switched back on.
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentState } from "@/lib/state";

export async function unfollowedIds(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from("jurisdictions").select("id").or(`followed.eq.false,state.neq.${await currentState()}`);
  return (data ?? []).map((j) => j.id);
}

// Leaves out rows from unfollowed jurisdictions (no-op when every jurisdiction is followed). Ids are slugs,
// so the list needs no quoting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function skipUnfollowed<Q extends { not(column: string, operator: any, value: unknown): Q }>(q: Q, off: string[], column = "jurisdiction_id"): Q {
  return off.length ? q.not(column, "in", `(${off.join(",")})`) : q;
}
