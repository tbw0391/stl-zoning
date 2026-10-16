// Dates in the database are plain calendar dates (no time zone), so format them as UTC
// to keep them from shifting a day.
const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

export const fmtDate = (d: string) => dateFmt.format(new Date(d + "T00:00:00Z"));
export const fmtMonth = (d: string) => monthFmt.format(new Date(d + "T00:00:00Z"));

export function fmtTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "AM" : "PM"}`;
}

export function todayCentral() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
}

export function addDays(d: string, n: number) {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export const shortName = (name: string) => name.replace(/^(City|Town|Village) of /, "");

export const STATUS_LABEL: Record<string, string> = {
  complete: "Complete",
  partial: "Partial",
  not_started: "Not started",
  needs_phone_call: "Needs phone call",
};

export const ROLE_LABEL: Record<string, string> = {
  planning_zoning: "Planning & Zoning",
  governing_body: "Elected officials",
  staff: "Staff",
};

export const STAGE_LABEL: Record<string, string> = {
  oyl: "OYL",
  prospect: "Prospect",
  loi: "LOI",
  diligence: "Diligence",
  development: "Development",
  closed: "Closed",
};

// Stages hidden from /projects unless "Show closed".
export const CLOSED_STAGES = ["closed"];

// Day of week for a plain date, 0 = Sunday.
export const weekday = (d: string) => new Date(d + "T00:00:00Z").getUTCDay();
export const startOfWeek = (d: string) => addDays(d, -weekday(d));

export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1 + n, 1));
  return x.toISOString().slice(0, 7);
}
