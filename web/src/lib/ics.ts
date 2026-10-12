// iCalendar feed of meetings and submittal deadlines, for subscribing in Outlook / Google / iPhone.
// Mirrors supabase/functions/calendar so both feeds produce the same events.

export type FeedMeeting = {
  id: number;
  jurisdiction_id: string;
  body: string;
  event_type: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  note: string | null;
  status: string;
  source_url: string | null;
  jurisdictions: { name: string; governing_body: string | null } | null;
};

export const CAL_NAME = "St. Charles Co. Entitlement Dates";
const TZ = "America/Chicago";

const VTIMEZONE = [
  "BEGIN:VTIMEZONE", "TZID:America/Chicago",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:-0600", "TZOFFSETTO:-0500", "TZNAME:CDT",
  "DTSTART:19700308T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:-0500", "TZOFFSETTO:-0600", "TZNAME:CST",
  "DTSTART:19701101T020000", "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU", "END:STANDARD",
  "END:VTIMEZONE",
];

const esc = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// RFC 5545 line folding: max 75 octets per line, continuation lines start with a space.
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "", len = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) { out.push(cur); cur = ""; len = 0; }
    cur += ch; len += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const ymd = (d: string) => d.replace(/-/g, "");
const hms = (t: string) => t.replace(/:/g, "").padEnd(6, "0").slice(0, 6);
const nextDay = (d: string) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
};
const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "AM" : "PM"}`;
};

export function buildIcs(meetings: FeedMeeting[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//stl-zoning//Entitlement Tracker//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${CAL_NAME}`, `NAME:${CAL_NAME}`, `X-WR-TIMEZONE:${TZ}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H",
    ...VTIMEZONE,
  ];

  for (const m of meetings) {
    const j = m.jurisdictions;
    const place = (j?.name ?? m.jurisdiction_id).replace(/^(City|Town|Village) of /, "");
    const isDeadline = m.event_type === "submittal_deadline";
    let label = isDeadline ? "P&Z SUBMITTAL DUE"
      : m.body === "planning_zoning" ? "P&Z Meeting"
      : (j?.governing_body ?? "Council").replace(/\s*\(.*\)$/, "");
    if (isDeadline && m.event_time) label += ` by ${fmtTime(m.event_time)}`;
    const prefix = m.status === "cancelled" ? "CANCELLED: " : m.status === "projected" ? "(Tentative) " : "";

    const ev = [
      "BEGIN:VEVENT",
      `UID:meeting-${m.id}@stl-zoning`,
      `DTSTAMP:${stamp}`,
      `SUMMARY:${esc(`${prefix}${place} - ${label}`)}`,
    ];
    // Deadlines are all-day so they stand out; meetings with a known time are 2-hour blocks.
    if (isDeadline || !m.event_time) {
      ev.push(`DTSTART;VALUE=DATE:${ymd(m.event_date)}`, `DTEND;VALUE=DATE:${ymd(nextDay(m.event_date))}`, "TRANSP:TRANSPARENT");
    } else {
      const start = hms(m.event_time);
      const endH = String(Math.min(23, Number(start.slice(0, 2)) + 2)).padStart(2, "0");
      ev.push(`DTSTART;TZID=${TZ}:${ymd(m.event_date)}T${start}`, `DTEND;TZID=${TZ}:${ymd(m.event_date)}T${endH}${start.slice(2)}`);
    }
    if (m.location) ev.push(`LOCATION:${esc(m.location)}`);
    const desc = [m.note, m.status === "projected" ? "Projected from the usual pattern; not yet published." : null,
      m.source_url ? `Source: ${m.source_url}` : null].filter(Boolean).join("\n");
    if (desc) ev.push(`DESCRIPTION:${esc(desc)}`);
    if (m.source_url) ev.push(`URL:${m.source_url}`);
    ev.push(`STATUS:${m.status === "cancelled" ? "CANCELLED" : m.status === "projected" ? "TENTATIVE" : "CONFIRMED"}`);
    if (isDeadline) {
      ev.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(`${place} P&Z submittal due`)}`,
        "TRIGGER:-P3D", "END:VALARM");
    }
    ev.push("END:VEVENT");
    lines.push(...ev);
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
