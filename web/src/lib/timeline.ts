// Expected rezoning timeline for a jurisdiction: the published calendar and the code's rules give the
// earliest path (deadline -> P&Z hearing -> council vote), and agenda history shows how often P&Z continues a case.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/format";

export type Step = { label: string; date: string | null; meetingId?: number; estimated: boolean; note?: string };
export type Path = { steps: Step[]; finalDate: string | null };
// From the board_history view (agenda history): cases seen at P&Z, how many came back for another P&Z meeting, and
// calendar days from first P&Z to final council action.
export type History = {
  scope: string; since: string; cases: number; continued: number; withCouncil: number;
  totalP50: number | null; totalP80: number | null;
};
export type Timeline = { best: Path; continued: Path | null; history: History[]; assumptions: string[] };

type Meeting = { id: number; body: string; event_type: string; event_date: string; linked_meeting: number | null; status: string };

// Used when a city publishes no submittal deadlines and its code gives no filing lead time.
const DEFAULT_LEAD_DAYS = 30;
// Fewer P&Z cases than this and the page flags the sample as small.
export const MIN_HISTORY_CASES = 5;


export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);

// From the hearing on, the council side: next governing-body meeting, plus a second one when the code needs two readings.
function councilSteps(hearing: Meeting, gb: Meeting[], readings: number): Path {
  const after = gb.filter((m) => m.event_date > hearing.event_date);
  const steps: Step[] = [];
  for (let i = 0; i < readings; i++) {
    const m = after[i];
    const label = readings === 1 ? "Council / Board vote" : i === 0 ? "Council / Board first reading" : "Council / Board final vote";
    steps.push(m
      ? { label, date: m.event_date, meetingId: m.id, estimated: m.status === "projected" }
      : { label, date: null, estimated: true, note: gb.length ? "past the loaded schedule" : "no council meetings loaded for this city" });
  }
  return { steps, finalDate: steps[steps.length - 1].date };
}

export async function loadTimeline(supabase: SupabaseClient, jurisdictionId: string, start: string): Promise<Timeline> {
  const [{ data: meetings }, { data: proc }, { data: boards }] = await Promise.all([
    supabase.from("meetings").select("id, body, event_type, event_date, linked_meeting, status")
      .eq("jurisdiction_id", jurisdictionId).gte("event_date", start).neq("status", "cancelled").order("event_date"),
    supabase.from("rezoning_processes").select("pz_hearing_timing, governing_body_action").eq("jurisdiction_id", jurisdictionId).maybeSingle(),
    supabase.from("board_history").select("*").or(`jurisdiction_id.eq.${jurisdictionId},jurisdiction_id.is.null`),
  ]);
  const ms = (meetings ?? []) as Meeting[];
  const pz = ms.filter((m) => m.body === "planning_zoning" && m.event_type === "meeting");
  const gb = ms.filter((m) => m.body === "governing_body" && m.event_type === "meeting");
  const assumptions: string[] = [];

  const gbText = proc?.governing_body_action ?? "";
  const readings = /two readings|second reading|2nd reading|1st reading/i.test(gbText) ? 2 : 1;
  if (readings === 2) assumptions.push("Code calls for two readings, so the final vote is at the second council meeting after P&Z.");

  // The hearing: the P&Z meeting the first upcoming deadline feeds, or the first P&Z after a lead time.
  const steps: Step[] = [];
  let hearing: Meeting | undefined;
  const deadline = ms.find((m) => m.event_type === "submittal_deadline" && m.linked_meeting && pz.some((p) => p.id === m.linked_meeting));
  if (deadline) {
    hearing = pz.find((p) => p.id === deadline.linked_meeting);
    steps.push({ label: "Submittal deadline", date: deadline.event_date, meetingId: deadline.id, estimated: deadline.status === "projected" });
  } else {
    const lead = Number((proc?.pz_hearing_timing ?? "").match(/at least (\d+) days before/i)?.[1] ?? DEFAULT_LEAD_DAYS);
    hearing = pz.find((p) => p.event_date >= addDays(start, lead));
    steps.push({ label: "Submit application", date: start, estimated: true, note: `no published deadline; assumes ${lead} days before P&Z` });
    assumptions.push(`No published submittal deadline, so this assumes filing ${lead} days before the P&Z meeting. Confirm with staff.`);
  }

  if (!hearing) {
    steps.push({ label: "P&Z hearing", date: null, estimated: true, note: pz.length ? "past the loaded schedule" : "no upcoming P&Z meetings loaded for this city" });
    return { best: { steps, finalDate: null }, continued: null, history: history(boards ?? [], jurisdictionId), assumptions };
  }
  steps.push({ label: "P&Z hearing", date: hearing.event_date, meetingId: hearing.id, estimated: hearing.status === "projected" });
  const council = councilSteps(hearing, gb, readings);
  const best = { steps: [...steps, ...council.steps], finalDate: council.finalDate };

  // Same path, but P&Z continues the case once to its next meeting.
  const nextPz = pz.find((p) => p.event_date > hearing.event_date);
  const c = nextPz ? councilSteps(nextPz, gb, readings) : null;
  const continued = {
    steps: [...steps, nextPz
      ? { label: "P&Z continued hearing", date: nextPz.event_date, meetingId: nextPz.id, estimated: nextPz.status === "projected" }
      : { label: "P&Z continued hearing", date: null, estimated: true, note: "past the loaded schedule" }, ...(c?.steps ?? [])],
    finalDate: c?.finalDate ?? null,
  };

  return { best, continued, history: history(boards ?? [], jurisdictionId), assumptions };
}

// This board's history first (when it has any), then all tracked boards.
function history(rows: Record<string, unknown>[], jurisdictionId: string): History[] {
  const toHistory = (r: Record<string, unknown>, scope: string): History => ({
    scope, since: r.since as string, cases: r.cases as number, continued: r.continued as number, withCouncil: r.with_council as number,
    totalP50: r.total_p50 as number | null, totalP80: r.total_p80 as number | null,
  });
  const local = rows.find((r) => r.jurisdiction_id === jurisdictionId);
  const all = rows.find((r) => r.jurisdiction_id == null);
  return [...(local ? [toHistory(local, "here")] : []), ...(all ? [toHistory(all, "all tracked boards")] : [])];
}
