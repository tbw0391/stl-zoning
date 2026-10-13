// Votes read from meeting minutes by the extract-votes function (meetings.votes), and the member_votes view
// that gives one row per member per named vote, matched to the directory by last name.

export type RollCall = { name: string; vote: string };
export type Vote = {
  item: string; case_number: string | null; motion: string; result: string;
  ayes: number | null; nays: number | null; abstentions: number | null; absent: number | null;
  unanimous: boolean | null; roll_call: RollCall[]; note: string | null;
};
export type MeetingVotes = { present: string[]; votes: Vote[] };

export type MemberVote = {
  meeting_id: number; jurisdiction_id: string; jurisdiction_name: string; county: string; body: string; event_date: string;
  vote_idx: number; item: string; case_number: string | null; motion: string; result: string;
  member_name: string; member_key: string; vote: string; person_id: number | null; person_name: string | null; roll_idx: number;
};

export const RESULT_LABEL: Record<string, string> = {
  approved: "Approved", approved_with_conditions: "Approved with conditions", recommended_approval: "Recommended approval",
  recommended_denial: "Recommended denial", denied: "Denied", tabled: "Tabled", continued: "Continued",
  withdrawn: "Withdrawn", other: "Other",
};
export const VOTE_LABEL: Record<string, string> = { aye: "Aye", nay: "Nay", abstain: "Abstain", absent: "Absent", recused: "Recused" };

// "5–4", "8–0 (unanimous)", or "" when the minutes give no count.
export function tally(v: Vote) {
  const ayes = v.ayes ?? (v.roll_call.length ? v.roll_call.filter((r) => r.vote === "aye").length : null);
  const nays = v.nays ?? (v.roll_call.length ? v.roll_call.filter((r) => r.vote === "nay").length : null);
  if (ayes == null && nays == null) return v.unanimous ? "unanimous" : "";
  return `${ayes ?? "?"}–${nays ?? 0}${v.abstentions ? `, ${v.abstentions} abstaining` : ""}`;
}

// The vote on an agenda item: same case number (from the field or the start of the title), else the same title.
// Like itemKey in supabase/functions/extract-agendas (the minutes reader copies the agenda title when it matches).
const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const caseId = (s: unknown) => norm(String(s ?? "").match(/[A-Z]{0,5}\d{2,}[\d-]*/i)?.[0]);
const itemKey = (it: { item: string; case_number?: string | null }) => caseId(it.case_number) || caseId(it.item) || norm(it.item);
export function voteFor(it: { item: string; case_number?: string | null }, votes: MeetingVotes | null | undefined) {
  const k = itemKey(it);
  return (votes?.votes ?? []).find((v) => itemKey(v) === k) ?? null;
}

// Link to a member's record on /votes.
export const memberHref = (jurisdictionId: string, key: string) => `/votes?j=${jurisdictionId}&m=${encodeURIComponent(key)}`;
