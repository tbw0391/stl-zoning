// Expected rezoning timeline for a jurisdiction: the published calendar and the code's rules give the
// earliest path (deadline -> P&Z hearing -> council vote), and agenda history shows how often P&Z continues a case.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/format";

export type Step = { label: string; date: string | null; meetingId?: number; estimated: boolean; note?: string };
export type Path = { steps: Step[]; finalDate: string | null };
export type History = { scope: string; cases: number; continued: number; gapDays: number[] };
export type Timeline = { best: Path; continued: Path | null; history: History[]; assumptions: string[] };

type Meeting = { id: number; body: string; event_type: string; event_date: string; linked_meeting: number | null; status: string };

// Used when a city publishes no submittal deadlines and its code gives no filing lead time.
const DEFAULT_LEAD_DAYS = 30;
// Fewer P&Z cases than this and the page flags the sample as small.
export const MIN_HISTORY_CASES = 5;

export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

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
  const [{ data: meetings }, { data: proc }, { data: cases }] = await Promise.all([
    supabase.from("meetings").select("id, body, event_type, event_date, linked_meeting, status")
      .eq("jurisdiction_id", jurisdictionId).gte("event_date", start).neq("status", "cancelled").order("event_date"),
    supabase.from("rezoning_processes").select("pz_hearing_timing, governing_body_action").eq("jurisdiction_id", jurisdictionId).maybeSingle(),
    supabase.from("land_use_cases").select("jurisdiction_id, body, event_date, case_number").not("case_number", "is", null),
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
    return { best: { steps, finalDate: null }, continued: null, history: history(cases ?? [], jurisdictionId), assumptions };
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

  return { best, continued, history: history(cases ?? [], jurisdictionId), assumptions };
}

// From agenda history: a case number on more than one P&Z agenda was continued; P&Z -> council gap per case.
function history(rows: { jurisdiction_id: string; body: string; event_date: string; case_number: string | null }[], jurisdictionId: string): History[] {
  const tally = (only?: string): History => {
    const byCase = new Map<string, { pz: Set<string>; gb: string[] }>();
    for (const r of rows) {
      const cn = r.case_number?.trim();
      if (!cn || (only && r.jurisdiction_id !== only)) continue;
      const key = `${r.jurisdiction_id}|${cn}`;
      const c = byCase.get(key) ?? { pz: new Set(), gb: [] };
      if (r.body === "planning_zoning") c.pz.add(r.event_date); else c.gb.push(r.event_date);
      byCase.set(key, c);
    }
    let cases = 0, continued = 0;
    const gapDays: number[] = [];
    for (const c of byCase.values()) {
      if (!c.pz.size) continue;
      cases++;
      if (c.pz.size > 1) continued++;
      const lastPz = [...c.pz].sort().at(-1)!;
      const firstGb = c.gb.filter((d) => d > lastPz).sort()[0];
      if (firstGb) gapDays.push(daysBetween(lastPz, firstGb));
    }
    return { scope: only ? "here" : "all tracked boards", cases, continued, gapDays };
  };
  const local = tally(jurisdictionId);
  const all = tally();
  return local.cases ? [local, all] : [all];
}
