// Land-use cases read from agendas (public.land_use_cases view) and the watches that alert on them.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, todayCentral } from "@/lib/format";
import { milesBetween } from "@/lib/geocode";
import { skipUnfollowed, unfollowedIds } from "@/lib/followed";

export type Case = {
  meeting_id: number; idx: number; jurisdiction_id: string; jurisdiction_name: string; county: string;
  body: string; event_date: string; agenda_url: string | null; agenda_read_at: string | null;
  type: string | null; item: string; request: string; address: string | null; applicant: string | null;
  case_number: string | null; from_zoning: string | null; to_zoning: string | null;
  acres: number | null; units: number | null; lat: number | null; lng: number | null;
};

export type Watch = {
  id: number; name: string; project_id: number | null; radius_miles: number;
  counties: string[] | null; jurisdiction_ids: string[] | null; types: string[] | null; last_seen_at: string;
};

export type Place = { lat: number | null; lng: number | null };

// What land teams usually watch; a watch with no types set uses these.
export const ZONING_TYPES = ["rezoning", "pud", "special_use", "annexation"];
export const LOOKBACK_DAYS = 45;

// Hand-entered items have no type, so fall back to the words.
export const caseTypes = (c: Case) =>
  c.type ? [c.type] : /rezon|zoning|PUD|planned unit|special use|conditional use|annex|\bRZ[\s-]?\d|\b[A-Z]{1,3}-?\d?[A-Z]? to [A-Z]{1,3}-?\d/i.test(`${c.item} ${c.request}`) ? ["rezoning"] : ["other"];

export async function loadCases(supabase: SupabaseClient) {
  const { data } = await skipUnfollowed(supabase.from("land_use_cases").select("*")
    .gte("event_date", addDays(todayCentral(), -LOOKBACK_DAYS)).order("event_date", { ascending: false }), await unfollowedIds(supabase));
  return (data ?? []) as Case[];
}

export function distanceTo(c: Case, place: Place | undefined) {
  if (!place || place.lat == null || place.lng == null || c.lat == null || c.lng == null) return null;
  return milesBetween({ lat: place.lat, lng: place.lng }, { lat: c.lat, lng: c.lng });
}

// A case matches when it has a wanted type and passes every area rule the watch sets.
export function matches(c: Case, w: Watch, project?: Place) {
  const types = w.types?.length ? w.types : ZONING_TYPES;
  if (!caseTypes(c).some((t) => types.includes(t))) return false;
  if (w.counties?.length && !w.counties.includes(c.county)) return false;
  if (w.jurisdiction_ids?.length && !w.jurisdiction_ids.includes(c.jurisdiction_id)) return false;
  if (w.project_id) {
    const d = distanceTo(c, project);
    if (d == null || d > Number(w.radius_miles)) return false;
  }
  return true;
}

export const isNew = (c: Case, w: Watch) => !!c.agenda_read_at && c.agenda_read_at > w.last_seen_at;

// New matches across all watches (a case counts once), for the nav badge.
export async function newAlertCount(supabase: SupabaseClient) {
  const { data: watches } = await supabase.from("watches").select("*");
  if (!watches?.length) return 0;
  const oldest = watches.reduce((m, w) => (w.last_seen_at < m ? w.last_seen_at : m), watches[0].last_seen_at);
  const [{ data: cases }, { data: projects }] = await Promise.all([
    skipUnfollowed(supabase.from("land_use_cases").select("*").gt("agenda_read_at", oldest), await unfollowedIds(supabase)),
    supabase.from("projects").select("id, lat, lng"),
  ]);
  const pmap = new Map((projects ?? []).map((p) => [p.id, p as Place]));
  const hits = new Set<string>();
  for (const c of (cases ?? []) as Case[]) {
    for (const w of watches as Watch[]) {
      if (isNew(c, w) && matches(c, w, w.project_id ? pmap.get(w.project_id) : undefined)) hits.add(`${c.meeting_id}-${c.idx}`);
    }
  }
  return hits.size;
}
