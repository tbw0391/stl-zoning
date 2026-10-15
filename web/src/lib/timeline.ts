// Expected rezoning timeline for a jurisdiction: the published calendar and the code's rules give the
// earliest path (deadline -> P&Z hearing -> council vote), and agenda history shows how often P&Z continues a case.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/format";

// postponed: the step was moved off this date (the reason, or "" when none was given); the next step is the new date.
export type Step = { label: string; date: string | null; meetingId?: number; estimated: boolean; note?: string; postponed?: string };
export type Path = { steps: Step[]; finalDate: string | null };
// A postponed P&Z hearing or council vote (project_delays). With no to_meeting_id it goes to the board's next meeting.
export type Delay = { id: number; step: "pz" | "council"; from_date: string | null; to_meeting_id: number | null; reason: string | null;
  reported_by: string | null; created_at: string };
// From the board_history view (agenda history): cases seen at P&Z, how many came back for another P&Z meeting, and
// calendar days from first P&Z to final council action.
export type History = {
  scope: string; since: string; cases: number; continued: number; withCouncil: number;
  totalP50: number | null; totalP80: number | null;
};
// From this board's history: the hearing date plus the median and 80th-percentile days from first P&Z to final
// council action. Only when the board has MIN_HISTORY_CASES cases that reached council.
export type Typical = { hearing: string; p50: string; p80: string; cases: number; since: string };
// original: the final date before any delays, when there are some.
export type Timeline = { best: Path; continued: Path | null; typical: Typical | null; history: History[]; assumptions: string[];
  original?: string | null };

type Meeting = { id: number; body: string; event_type: string; event_date: string; linked_meeting: number | null; status: string };

// Used when a city publishes no submittal deadlines and its code gives no filing lead time.
const DEFAULT_LEAD_DAYS = 30;
// Fewer P&Z cases than this and the page flags the sample as small.
export const MIN_HISTORY_CASES = 5;


export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);

// Applies postponements in the order they were logged: each one moves the step from its current meeting to the chosen
// meeting, or to the board's next meeting after it. Returns the struck-through steps and the meeting it ends up at.
// A delay whose from_date the step has already passed is skipped, so a postponed meeting that is also marked cancelled
// (and so drops out of the schedule) doesn't shift the step twice.
function postpone(label: string, first: Meeting | undefined, board: Meeting[], all: Meeting[], delays: Delay[]) {
  const moved: Step[] = [];
  let at = first;
  for (const d of delays) {
    if (!at) break;
    if (d.from_date && at.event_date > d.from_date) continue;
    moved.push({ label, date: at.event_date, meetingId: at.id, estimated: at.status === "projected", postponed: d.reason ?? "" });
    const from = at.event_date;
    at = (d.to_meeting_id ? all.find((m) => m.id === d.to_meeting_id && m.event_date > from) : undefined)
      ?? board.find((m) => m.event_date > from);
  }
  return { moved, at };
}

// From the hearing on, the council side: next governing-body meeting, plus a second one when the code needs two readings.
// A council delay moves the first council meeting, and the second reading follows from there.
function councilSteps(hearing: Meeting, gb: Meeting[], readings: number, delays: Delay[] = [], all: Meeting[] = gb): Path {
  const firstLabel = readings === 1 ? "Council / Board vote" : "Council / Board first reading";
  const { moved, at } = postpone(firstLabel, gb.find((m) => m.event_date > hearing.event_date), gb, all, delays);
  const after = at ? gb.filter((m) => m.event_date >= at.event_date) : [];
  const steps: Step[] = [...moved];
  for (let i = 0; i < readings; i++) {
    const m = after[i];
    const label = readings === 1 ? "Council / Board vote" : i === 0 ? "Council / Board first reading" : "Council / Board final vote";
    steps.push(m
      ? { label, date: m.event_date, meetingId: m.id, estimated: m.status === "projected" }
      : { label, date: null, estimated: true, note: gb.length ? "past the loaded schedule" : "no council meetings loaded for this city" });
  }
  return { steps, finalDate: steps[steps.length - 1].date };
}

// start is the filing date (the project's filed_on, or a what-if date). delays are the project's postponements.
export async function loadTimeline(supabase: SupabaseClient, jurisdictionId: string, start: string, delays: Delay[] = []): Promise<Timeline> {
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
    return { best: { steps, finalDate: null }, continued: null, typical: null, history: history(boards ?? [], jurisdictionId), assumptions };
  }
  const pzDelays = delays.filter((d) => d.step === "pz");
  const gbDelays = delays.filter((d) => d.step === "council");
  const scheduled = hearing;
  const { moved, at } = postpone("P&Z hearing", hearing, pz, ms, pzDelays);
  steps.push(...moved);
  if (!at) {
    steps.push({ label: "P&Z hearing", date: null, estimated: true, note: "new date past the loaded schedule" });
    return { best: { steps, finalDate: null }, continued: null, typical: null, history: history(boards ?? [], jurisdictionId), assumptions,
      original: delays.length ? councilSteps(scheduled, gb, readings).finalDate : undefined };
  }
  hearing = at;
  steps.push({ label: "P&Z hearing", date: hearing.event_date, meetingId: hearing.id, estimated: hearing.status === "projected" });
  const council = councilSteps(hearing, gb, readings, gbDelays, ms);
  const best = { steps: [...steps, ...council.steps], finalDate: council.finalDate };
  const original = best.steps.some((s) => s.postponed != null) ? councilSteps(scheduled, gb, readings).finalDate : undefined;

  // Same path, but P&Z continues the case once more to its next meeting.
  const nextPz = pz.find((p) => p.event_date > hearing!.event_date);
  const c = nextPz ? councilSteps(nextPz, gb, readings) : null;
  const continued = {
    steps: [...steps, nextPz
      ? { label: "P&Z continued hearing", date: nextPz.event_date, meetingId: nextPz.id, estimated: nextPz.status === "projected" }
      : { label: "P&Z continued hearing", date: null, estimated: true, note: "past the loaded schedule" }, ...(c?.steps ?? [])],
    finalDate: c?.finalDate ?? null,
  };

  const hist = history(boards ?? [], jurisdictionId);
  const local = hist.find((h) => h.scope === "here");
  const typical = local && local.withCouncil >= MIN_HISTORY_CASES && local.totalP50 != null && local.totalP80 != null
    ? { hearing: hearing.event_date, p50: addDays(hearing.event_date, local.totalP50), p80: addDays(hearing.event_date, local.totalP80),
        cases: local.withCouncil, since: local.since }
    : null;
  return { best, continued, typical, history: hist, assumptions, original };
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

export const STEP_LABEL: Record<Delay["step"], string> = { pz: "P&Z hearing", council: "Council vote" };

// A project's postponements, oldest first. Empty when the table can't be read.
export async function loadDelays(supabase: SupabaseClient, projectId: number): Promise<Delay[]> {
  const { data } = await supabase.from("project_delays").select("*").eq("project_id", projectId).order("created_at");
  return (data ?? []) as Delay[];
}

// Where the step stands now (after any postponements): the P&Z hearing, or the first council meeting.
export function currentStep(path: Path, step: Delay["step"]): Step | undefined {
  const live = path.steps.filter((s) => !s.postponed);
  return step === "pz" ? live.find((s) => s.label === "P&Z hearing") : live.find((s) => s.label.startsWith("Council"));
}
