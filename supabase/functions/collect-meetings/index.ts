// Daily meeting collection for jurisdictions with a `collector` set (AgendaCenter, CivicClerk, Municode Meetings, Legistar,
// Granicus, CivicWeb, or a reader for a city's own meeting pages).
// TypeScript port of scripts/collectors/*.py; keep the board-matching rules in step with agendacenter.py.
//
// For each jurisdiction: inserts meetings we don't have, fills missing agenda / packet / minutes links, times and
// locations, and marks projected meetings as published (or cancelled) once the city posts them. Never overwrites hand-researched
// values (except an upcoming meeting's agenda link, when the city posts a different one) and never deletes: meetings in our data that the city's system lacks are recorded in
// collector_runs.missing for a person to check.
//
// Requests need the x-digest-token header (shared cron token in public.app_settings). ?j=<id> runs one jurisdiction.
// Triggered daily by pg_cron (see the meeting_collectors migration). Deployed with verify_jwt off.
import { createClient } from "jsr:@supabase/supabase-js@2";

const TZ = "America/Chicago";
const UA = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const SKIP = new RegExp(
  "adjustment|appeal|BZA|architectur|historic|landmark|park|library|police|fire|pension|retire|" +
    "tif|tax increment|incentive|equalization|merit|ethics|youth|senior|arts|tree|beautif|cemetery|" +
    "traffic|personnel|audit|finance|budget|work ?session|special|port authority|road board|" +
    "committee|advisory|task force|group|steering|notices|emergency", "i");
const PZ = /planning|zoning|P\s*&\s*Z|plan commission/i;
const GOV = /aldermen|alderm|city council|county council|board of trustees|village board|^council$|\bcouncil\b(?!.*(advisory|youth|arts))/i;
const NOT_HEARING = /work ?session|study session|retreat|orientation|training|closed session|executive session/i;
// ...unless it's combined with the regular meeting ("Work Session and Council Meeting").
const REGULAR = /regular|(council|board|commission|aldermen) meeting/i;
// Postings that aren't a meeting at all ("No regular meeting to be held", "Notice of Public Hearing - Proposed Budget").
const NOT_MEETING = /no (regular )?meeting|^notice of/i;
const notHearing = (title: string) => NOT_MEETING.test(title) || (NOT_HEARING.test(title) && !REGULAR.test(title));
const CANCELLED = /cancell?ed/i;

type Body = "planning_zoning" | "governing_body";
type Collected = {
  body: Body; event_date: string; event_time: string | null; location: string | null; title: string;
  agenda_url: string | null; packet_url: string | null; minutes_url: string | null; source_url: string; cancelled: boolean;
};

// One row per board and date. A cancelled posting gives way to a live one on the same date
// (a cancelled special session alongside the regular meeting). Minutes may sit on another row for the same date.
function keep(rows: Map<string, Collected>, c: Collected) {
  const key = `${c.body}|${c.event_date}`;
  const prev = rows.get(key);
  if (!prev || (prev.cancelled && !c.cancelled)) rows.set(key, { ...c, minutes_url: c.minutes_url ?? prev?.minutes_url ?? null });
  else if (!prev.minutes_url && c.minutes_url) prev.minutes_url = c.minutes_url;
}

function bodyFor(name: string): Body | null {
  if (SKIP.test(name)) return null;
  if (PZ.test(name)) return "planning_zoning";
  if (GOV.test(name)) return "governing_body";
  return null;
}

async function fetchText(url: string, form?: Record<string, string | number>, accept?: string) {
  // Form posts are AgendaCenter's year lists, which some sites (Etna Township OH) answer only for the page's own script.
  const res = await fetch(url, {
    method: form ? "POST" : "GET",
    headers: form ? { ...UA, "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" }
      : accept ? { ...UA, Accept: accept } : UA,
    body: form ? new URLSearchParams(Object.entries(form).map(([k, v]) => [k, String(v)])) : undefined,
    redirect: "follow",
  });
  const text = await res.text();
  if (/Attention Required! \| Cloudflare|cf-error-details|Just a moment\.\.\./.test(text)) throw new Error(`blocked by bot protection: ${url}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return { url: res.url, text };
}

const unescape = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

// ---- CivicPlus AgendaCenter: only meetings whose agenda has been posted.
async function agendaCenter(site: string, year: number): Promise<Collected[]> {
  const { url, text: page } = await fetchText(site.replace(/\/$/, "") + "/AgendaCenter");
  const base = new URL(url).origin;
  const rows = new Map<string, Collected>();
  // Boards are <h2> headings, or <h3> on sites that group boards under section headings (Des Peres).
  for (const m of page.matchAll(/id="cat(\d+)">\s*<h[23][^>]*>([^<]+)<\/h[23]>/g)) {
    const [, cid, rawName] = m;
    const name = unescape(rawName).trim();
    const body = bodyFor(name);
    const years = [...page.matchAll(new RegExp(`changeYear\\((\\d{4}), ${cid}\\b`, "g"))].map((y) => Number(y[1]));
    if (!body || Math.max(0, ...years) < year) continue;
    const { text: part } = await fetchText(base + "/AgendaCenter/UpdateCategoryList", { year, catID: cid });
    for (const r of part.matchAll(/<tr id="row\w+" class="catAgendaRow">([\s\S]*?)<\/tr>/g)) {
      const row = r[1];
      const a = row.match(/name="_(\d{2})(\d{2})(\d{4})-(\d+)"/);
      if (!a) continue;
      const [, mm, dd, yyyy, id] = a;
      const t = row.match(/aria-describedby="h4[^"]*">\s*([\s\S]*?)\s*<\/a>/);
      const title = t ? unescape(t[1].replace(/\s+/g, " ")).trim() : "";
      if (notHearing(title)) continue;
      const agendaUrl = `${base}/AgendaCenter/ViewFile/Agenda/_${mm}${dd}${yyyy}-${id}`;
      // Agendas built in AgendaCenter also offer the compiled packet (agenda plus staff reports and plans).
      const packet = row.includes(`_${mm}${dd}${yyyy}-${id}?packet=true`) ? `${agendaUrl}?packet=true` : null;
      const minutes = row.match(/href="(\/AgendaCenter\/ViewFile\/Minutes\/[^"]+)"/);
      keep(rows, {
        body, event_date: `${yyyy}-${mm}-${dd}`, event_time: null, location: null, title, agenda_url: agendaUrl,
        packet_url: packet, minutes_url: minutes ? base + unescape(minutes[1]) : null, source_url: `${base}/AgendaCenter`, cancelled: CANCELLED.test(title),
      });
    }
  }
  return [...rows.values()];
}

// ---- CivicClerk: public OData API, includes scheduled future meetings. Times are local despite the "Z".
async function civicClerk(tenant: string, year: number): Promise<Collected[]> {
  const api = (path: string, q: Record<string, string | number> = {}) =>
    `https://${tenant}.api.civicclerk.com/v1/${path}?` + Object.entries(q).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
  const flt = `startDateTime ge ${year}-01-01T00:00:00Z and startDateTime lt ${year + 1}-01-01T00:00:00Z`;
  // deno-lint-ignore no-explicit-any
  const events: any[] = [];
  for (;;) { // 15 per page whatever $top says
    const { text } = await fetchText(api("Events", { $filter: flt, $orderby: "startDateTime", $skip: events.length }));
    const page = JSON.parse(text).value ?? [];
    if (!page.length) break;
    events.push(...page);
    if (events.length > 2000) break;
  }
  const rows = new Map<string, Collected>();
  for (const e of events) {
    const body = bodyFor(e.categoryName ?? e.eventCategoryName ?? "");
    if (!body || notHearing(e.eventName) || e.isDeleted) continue;
    const local: string = e.startDateTime.slice(0, 16);
    // deno-lint-ignore no-explicit-any
    const file = (type: string) => (e.publishedFiles ?? []).find((f: any) => f.type === type);
    const fileUrl = (f: { fileId: number } | undefined) =>
      f ? api(`Meetings/GetMeetingFileStream(fileId=${f.fileId},plainText=false)`).replace(/\?$/, "") : null;
    const loc = e.eventLocation ?? {};
    const time = local.slice(11, 16);
    keep(rows, {
      body, event_date: local.slice(0, 10), event_time: time && time !== "00:00" ? time : null,
      location: [loc.address1, loc.address2].filter(Boolean).join(", ") || null,
      title: e.eventName,
      agenda_url: fileUrl(file("Agenda")), packet_url: fileUrl(file("Agenda Packet")), minutes_url: fileUrl(file("Minutes")),
      source_url: `https://${tenant}.portal.civicclerk.com/event/${e.id}/files`, cancelled: CANCELLED.test(e.eventName),
    });
  }
  return [...rows.values()];
}

// ---- Municode Meetings (<city>.municodemeetings.com): a filterable table of past and scheduled meetings.
// Boards come from the board filter; committee meetings and workshops are filed under their parent board.
const SIDE_MEETING = /committee|workshop/i;

async function municodeMeetings(site: string, year: number): Promise<Collected[]> {
  const base = site.replace(/\/$/, "");
  const { text: first } = await fetchText(base + "/meetings3");
  const filter = first.slice(first.indexOf('name="field_microsite_tid_selective"'));
  const boards = [...filter.slice(0, filter.indexOf("</select>")).matchAll(/<option value="(\d+)"[^>]*>([^<]*)/g)];
  const range = {
    "date_filter[value][year]": year, "date_filter[value][month]": 1, "date_filter[value][day]": 1,
    "date_filter_1[value][year]": year, "date_filter_1[value][month]": 12, "date_filter_1[value][day]": 31,
  };
  const rows = new Map<string, Collected>();
  for (const [, tid, rawName] of boards) {
    const body = bodyFor(unescape(rawName).trim());
    if (!body) continue;
    for (let page = 0; page < 20; page++) {
      const q = new URLSearchParams(Object.entries({ ...range, field_microsite_tid_selective: tid, page }).map(([k, v]) => [k, String(v)]));
      const { text } = await fetchText(`${base}/meetings3?${q}`);
      const trs = [...text.matchAll(/<tr class="[^"]*">([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
      for (const tr of trs) {
        const when = tr.match(/content="(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/); // local time, with offset
        const t = tr.match(/data-th="Meeting">\s*([\s\S]*?)\s*<\/td>/);
        if (!when || !t) continue;
        const title = unescape(t[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ")).trim();
        if (notHearing(title) || SIDE_MEETING.test(title)) continue;
        const cell = (th: string) => tr.match(new RegExp(`data-th="${th}">\\s*<a href="([^"]+\\.pdf)"`))?.[1] ?? null;
        const view = tr.match(/href="(\/[^"]+)"[^>]*>View Details/);
        keep(rows, {
          body, event_date: when[1], event_time: when[2] !== "00:00" ? when[2] : null, location: null, title,
          agenda_url: cell("Agenda"), packet_url: cell("Agenda Packet"), minutes_url: cell("Minutes"),
          source_url: view ? base + view[1] : `${base}/meetings3`, cancelled: CANCELLED.test(title),
        });
      }
      if (!text.includes(`page=${page + 1}`)) break;
    }
  }
  return [...rows.values()];
}

// ---- Legistar (webapi.legistar.com/v1/<client>): public API with the whole schedule, agenda and minutes PDFs.
// Columbus votes on rezonings with City Council sitting as its Zoning Committee, the same evening as the regular
// council meeting, so that committee counts as the governing body and wins the date.
const ZONING_COMMITTEE = /^zoning committee$/i;
const clock = (t: string | null) => {
  const m = t?.match(/(\d{1,2}):(\d{2})\s*([AP])M/i);
  if (!m) return null;
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === "P" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${m[2]}`;
};

async function legistar(client: string, year: number): Promise<Collected[]> {
  const flt = `EventDate ge datetime'${year}-01-01' and EventDate lt datetime'${year + 1}-01-01'`;
  const { text } = await fetchText(`https://webapi.legistar.com/v1/${client}/events?$filter=${encodeURIComponent(flt)}&$orderby=EventDate`, undefined, "application/json");
  const rows = new Map<string, Collected>();
  const zoningDates = new Set<string>();
  // deno-lint-ignore no-explicit-any
  for (const e of JSON.parse(text) as any[]) {
    const name: string = (e.EventBodyName ?? "").trim();
    const zc = ZONING_COMMITTEE.test(name);
    const body = zc ? "governing_body" : bodyFor(name);
    const title = [name, e.EventComment].filter(Boolean).join(" - ");
    if (!body || notHearing(title)) continue;
    const c: Collected = {
      body, event_date: String(e.EventDate).slice(0, 10), event_time: clock(e.EventTime), location: e.EventLocation || null, title,
      agenda_url: e.EventAgendaFile || null, packet_url: null, minutes_url: e.EventMinutesFile || null,
      source_url: e.EventInSiteURL || `https://${client}.legistar.com/Calendar.aspx`,
      cancelled: CANCELLED.test(`${title} ${e.EventAgendaStatusName ?? ""}`),
    };
    if (zc && !c.cancelled) {
      rows.delete(`${body}|${c.event_date}`);
      zoningDates.add(c.event_date);
    } else if (!zc && zoningDates.has(c.event_date)) continue;
    keep(rows, c);
  }
  return [...rows.values()];
}

// ---- Granicus ViewPublisher (<client>.granicus.com/ViewPublisher.php?view_id=1): one page with upcoming events
// (no links yet) and every past meeting by board and year, linking agenda, minutes and packet PDFs.
// The ref is the subdomain, optionally with the view: "delawareohio" or "delawareohio/2".
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

async function granicus(ref: string, year: number): Promise<Collected[]> {
  const [client, view = "1"] = ref.split("/");
  const source = `https://${client}.granicus.com/ViewPublisher.php?view_id=${view}`;
  const { text: page } = await fetchText(source);
  const rows = new Map<string, Collected>();
  for (const r of page.matchAll(/<tr class="listingRow">([\s\S]*?)<\/tr>/g)) {
    const row = unescape(r[1]).replace(/\s+/g, " ");
    const name = row.match(/headers="Name"[^>]*>([^<]*)</)?.[1].trim() ?? "";
    const when = row.match(/headers="Date[^"]*">\s*([A-Z][a-z]{2})\s*(\d{1,2}),\s*(\d{4})(?:\s*-\s*(\d{1,2}:\d{2}\s*[AP]M))?/);
    const body = bodyFor(name);
    if (!body || !when || Number(when[3]) !== year || notHearing(name)) continue;
    const date = `${when[3]}-${String(MONTHS.indexOf(when[1].toLowerCase()) + 1).padStart(2, "0")}-${when[2].padStart(2, "0")}`;
    const link = (re: RegExp) => {
      const href = row.match(re)?.[1];
      return href ? (href.startsWith("//") ? "https:" + href : href) : null;
    };
    const c: Collected = {
      body, event_date: date, event_time: clock(when[4] ?? null), location: null, title: name,
      agenda_url: link(/href="([^"]*AgendaViewer\.php[^"]*)"/), packet_url: link(/href="([^"]+)"[^>]*>\s*Agenda Packet/),
      minutes_url: link(/href="([^"]*MinutesViewer\.php[^"]*)"/), source_url: source, cancelled: CANCELLED.test(name),
    };
    // The same meeting can be listed under Upcoming Events (no links) and in the archive (links): merge them.
    const prev = rows.get(`${body}|${date}`);
    if (prev) {
      prev.agenda_url ??= c.agenda_url; prev.packet_url ??= c.packet_url; prev.minutes_url ??= c.minutes_url; prev.event_time ??= c.event_time;
    } else keep(rows, c);
  }
  return [...rows.values()];
}

// ---- CivicWeb (<client>.civicweb.net): a JSON meeting list, then each P&Z / council meeting's documents
// (Type 1 = agenda, as HTML (DocumentType 1) and the PDF packet (DocumentType 4); Type 2 = minutes).
async function civicWeb(client: string, year: number): Promise<Collected[]> {
  const base = `https://${client}.civicweb.net`;
  const { text } = await fetchText(`${base}/Services/MeetingsService.svc/meetings?from=${year}-01-01&to=${year}-12-31`, undefined, "application/json");
  const rows = new Map<string, Collected>();
  // deno-lint-ignore no-explicit-any
  for (const m of JSON.parse(text) as any[]) {
    const title = unescape(m.Name ?? "").trim();
    const body = bodyFor(title.split(" - ")[0]);
    if (!body || notHearing(title)) continue;
    // deno-lint-ignore no-explicit-any
    let docs: any[] = [];
    if (m.Published) docs = JSON.parse((await fetchText(`${base}/Services/MeetingsService.svc/meetings/${m.Id}/meetingDocuments`, undefined, "application/json")).text);
    const doc = (type: number, docType?: number) => {
      const d = docs.find((x) => x.Type === type && (docType == null || x.DocumentType === docType));
      return d ? `${base}/document/${d.Id}/` : null;
    };
    const time = String(m.MeetingDateTime ?? "").slice(11, 16);
    keep(rows, {
      body, event_date: m.MeetingDate, event_time: time && time !== "00:00" ? time : null, location: m.MeetingLocation || null, title,
      agenda_url: doc(1, 1) ?? doc(1), packet_url: doc(1, 4), minutes_url: doc(2),
      source_url: `${base}/Portal/MeetingInformation.aspx?Id=${m.Id}`, cancelled: CANCELLED.test(title),
    });
  }
  return [...rows.values()];
}

// ---- Cities that post meetings on their own web pages. The ref names one page per board, with the board's usual
// start time when the page doesn't give one: "pz=<url>#19:00 gov=<url>".
const pages = (ref: string) =>
  ref.split(/\s+/).filter((p) => p.includes("=")).map((p) => {
    const [, k, url, time] = p.match(/^(\w+)=([^#]+)(?:#(\d{2}:\d{2}))?$/)!;
    return { body: (k === "pz" ? "planning_zoning" : "governing_body") as Body, url, time: time ?? null };
  });
const MONTH_DAY = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(\d{3,4}))?/i;
const ymdOf = (m: RegExpMatchArray, year: number) => {
  // "February 26, 202" (a typo on the page) falls back to the page's year.
  const y = m[3]?.length === 4 ? Number(m[3]) : year;
  return `${y}-${String(MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
};
// "7 p.m.", "6:30 p.m.", "3 PM" -> "19:00"
const clockText = (s: string) => {
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\b/i);
  if (!m) return null;
  const h = (Number(m[1]) % 12) + (m[3].toLowerCase() === "p" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
};
const linkTo = (html: string, label: RegExp, base: string) => {
  for (const a of html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (label.test(a[2].replace(/<[^>]+>/g, ""))) return new URL(unescape(a[1]), base).href;
  }
  return null;
};
const plain = (html: string) => unescape(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const SIDE_EVENT = /workshop|interview|reception|retreat|training|joint/i;

// Dublin (dublinohiousa.gov): an <h4> per date ("Monday, Oct. 26"), then a <p> per meeting ("Executive Session | 5:30 p.m.
// Regular Meeting | 7 p.m. | Council Chamber Agenda | Watch | Action | Minutes"). Dates leave the year off unless it
// differs from the page's ("2026 Meetings"). The council page's committee schedule (the <h3> after) is left out.
async function dublin(ref: string, year: number): Promise<Collected[]> {
  const rows = new Map<string, Collected>();
  for (const { body, url } of pages(ref)) {
    const { text } = await fetchText(url);
    const h3 = [...text.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)];
    const pageYear = Number(plain(h3[0]?.[1] ?? "").match(/\d{4}/)?.[0] ?? year);
    const end = h3.find((h) => /committee/i.test(plain(h[1])))?.index ?? text.length;
    for (const b of text.slice(0, end).matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h[1-4][\s>]|$)/g)) {
      const when = plain(b[1]).match(new RegExp("^[A-Z][a-z]+day,\\s*" + MONTH_DAY.source.slice(2), "i"));
      if (!when) continue;
      const date = ymdOf(when, pageYear);
      if (Number(date.slice(0, 4)) !== year) continue;
      for (const seg of b[2].split(/<\/p>/)) {
        const text = plain(seg);
        // The meeting's own name is the last "<name> | <time>" in the segment ("Executive Session | 5:30 p.m. Regular Meeting | 7 p.m.").
        const named = [...text.matchAll(/([A-Z][A-Za-z/&' ]*?)\s*\|\s*(\d{1,2}(?::\d{2})?\s*[ap]\.m\.|\[?Meeting Cancelled)/g)].pop();
        if (!named) continue;
        const title = named[1].trim();
        const agenda = linkTo(seg, /agenda/i, url);
        if (!/regular|special|organizational/i.test(title) || notHearing(title) || SIDE_EVENT.test(title) || /training/i.test(agenda ?? "")) continue;
        keep(rows, {
          body, event_date: date, event_time: clockText(named[2]), location: null, title,
          agenda_url: agenda, packet_url: null, minutes_url: linkTo(seg, /minutes/i, url), source_url: url,
          cancelled: CANCELLED.test(text),
        });
      }
    }
  }
  return [...rows.values()];
}

// A table per board with a header row naming its columns (Date | Agenda | Minutes | Meeting Packet), one row per
// meeting: "Monday, October 19, 2026" or "October 6, 2026 3 PM Executive Session". New Albany.
async function pageTable(ref: string, year: number): Promise<Collected[]> {
  const rows = new Map<string, Collected>();
  for (const { body, url, time } of pages(ref)) {
    const { text } = await fetchText(url);
    for (const t of text.matchAll(/<table[\s\S]*?<\/table>/g)) {
      const trs = [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((r) => [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1]));
      const head = trs[0]?.map(plain) ?? [];
      const col = (re: RegExp) => head.findIndex((h) => re.test(h));
      const [ai, mi, pi] = [col(/agenda/i), col(/minutes/i), col(/packet/i)];
      if (ai < 0) continue;
      for (const cells of trs.slice(1)) {
        const first = plain(cells[0] ?? "");
        const when = first.match(MONTH_DAY);
        if (!when || when.index! > 12 || when[3]?.length !== 4 || Number(when[3]) !== year) continue;
        const title = first.slice(when.index! + when[0].length).trim();
        if (notHearing(title) || SIDE_EVENT.test(title)) continue;
        const cell = (i: number) => (i >= 0 ? cells[i] ?? "" : "");
        keep(rows, {
          body, event_date: ymdOf(when, year), event_time: clockText(title) ?? time, location: null, title: title || first,
          agenda_url: linkTo(cell(ai), /./, url), packet_url: linkTo(cell(pi), /packet/i, url),
          minutes_url: linkTo(cell(mi), /minutes/i, url), source_url: url, cancelled: CANCELLED.test(plain(cell(ai)) + title),
        });
      }
    }
  }
  return [...rows.values()];
}

// Delaware County Regional Planning Commission: the year's dates laid out in grids, one grid per kind of document
// ("2026 Preliminary Agendas", "2026 Meeting Minutes", and the staff Technical Review Committee's, which is skipped).
// Every date is a meeting; it's a link once that document is posted. Meetings are 6 p.m. at the Byxbe Building.
async function dcrpc(url: string, year: number): Promise<Collected[]> {
  const { text } = await fetchText(url);
  const rows = new Map<string, Collected>();
  for (const t of text.matchAll(/<table[\s\S]*?<\/table>/g)) {
    const heading = plain(t[0].match(/<th[^>]*>([\s\S]*?)<\/th>/)?.[1] ?? "");
    if (!heading.includes(String(year)) || /technical review/i.test(heading)) continue;
    const kind = /minutes/i.test(heading) ? "minutes_url" : /agenda/i.test(heading) ? "agenda_url" : null;
    if (!kind) continue;
    for (const c of t[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)) {
      const when = plain(c[1]).match(MONTH_DAY);
      if (!when) continue;
      const date = ymdOf(when, year);
      const href = c[1].match(/href="([^"]+\.pdf)"/i)?.[1] ?? null;
      const row = rows.get(date) ?? {
        body: "planning_zoning" as Body, event_date: date, event_time: "18:00", location: "Byxbe Building, 1610 State Route 521, Delaware",
        title: "Regional Planning Commission", agenda_url: null, packet_url: null, minutes_url: null, source_url: url, cancelled: false,
      };
      // January's minutes link points at that month's agenda.
      if (href !== row.agenda_url) row[kind] ??= href;
      rows.set(date, row);
    }
  }
  return [...rows.values()];
}

// ---- CivicPlus Archive Center (<site>/Archive.aspx?AMID=<n>): one list per kind of document, each item titled with its
// date ("October 6, 2026 Meeting Packet", "July 20, 2026 (Special)"). The ref is the site, then each board's lists:
// "https://www.worthington.org pz=38,39 gov=44,45" (agendas, then minutes). Only posted documents are listed.
async function archiveCenter(ref: string, year: number): Promise<Collected[]> {
  const site = ref.split(/\s+/)[0].replace(/\/$/, "");
  const rows = new Map<string, Collected>();
  for (const { body, url: lists, time } of pages(ref)) {
    const [agendas, minutes] = lists.split(",");
    const docs = new Map<string, Collected>();
    for (const [amid, kind] of [[agendas, "agenda_url"], [minutes, "minutes_url"]] as const) {
      if (!amid) continue;
      const source = `${site}/Archive.aspx?AMID=${amid}`;
      const { text } = await fetchText(source);
      for (const a of text.matchAll(/href="Archive\.aspx\?ADID=(\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
        const title = plain(a[2]);
        const when = title.match(MONTH_DAY);
        if (!when || when[3]?.length !== 4 || Number(when[3]) !== year) continue;
        const rest = title.slice(when.index! + when[0].length);
        if (notHearing(rest) || SIDE_EVENT.test(rest)) continue;
        const date = ymdOf(when, year);
        // A regular and a special meeting the same day: the regular one's documents win.
        const key = `${date}|${/special/i.test(rest) ? "s" : "r"}`;
        const c = docs.get(key) ?? {
          body, event_date: date, event_time: time, location: null, title: rest || title, agenda_url: null, packet_url: null,
          minutes_url: null, source_url: `${site}/Archive.aspx?AMID=${agendas}`, cancelled: CANCELLED.test(rest),
        };
        c[kind] ??= `${site}/Archive.aspx?ADID=${a[1]}`;
        docs.set(key, c);
      }
    }
    for (const c of [...docs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, c]) => c)) keep(rows, c);
  }
  return [...rows.values()];
}

// ---- WP File Download (WordPress plugin; Newark): folders of PDFs titled "2026-10-13_AGENDA-PC", read through the
// plugin's JSON. The ref is the site, then each board's folder ids: "https://www.newarkohio.gov pz=200,199,201"
// (agendas, minutes, packets). Only posted documents are listed.
async function wpfd(ref: string, year: number): Promise<Collected[]> {
  const site = ref.split(/\s+/)[0].replace(/\/$/, "");
  const rows = new Map<string, Collected>();
  for (const { body, url: folders, time } of pages(ref)) {
    const [agendas, minutes, packets] = folders.split(",");
    const docs = new Map<string, Collected>();
    for (const [id, kind] of [[agendas, "agenda_url"], [minutes, "minutes_url"], [packets, "packet_url"]] as const) {
      if (!id) continue;
      const api = `${site}/wp-admin/admin-ajax.php?juwpfisadmin=false&action=wpfd&task=files.display&view=files&id=${id}&rootcat=${id}&page_limit=200`;
      // deno-lint-ignore no-explicit-any
      const files: any[] = JSON.parse((await fetchText(api, undefined, "application/json")).text).files ?? [];
      // Titles come newest first; oldest first puts a split packet's part 1 ahead of part 2.
      for (const f of files.reverse()) {
        const title = String(f.post_title ?? "");
        const d = title.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!d || Number(d[1]) !== year || notHearing(title) || SIDE_EVENT.test(title)) continue;
        const date = `${d[1]}-${d[2]}-${d[3]}`;
        const key = `${date}|${/special/i.test(title) ? "s" : "r"}`;
        const c = docs.get(key) ?? {
          body, event_date: date, event_time: time, location: null, title, agenda_url: null, packet_url: null, minutes_url: null,
          source_url: site + "/meeting-agendas/", cancelled: CANCELLED.test(title),
        };
        c[kind] ??= f.linkdownload || null;
        docs.set(key, c);
      }
    }
    for (const c of [...docs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, c]) => c)) keep(rows, c);
  }
  return [...rows.values()];
}

const COLLECTORS: Record<string, (ref: string, year: number) => Promise<Collected[]>> = {
  agendacenter: agendaCenter, civicclerk: civicClerk, municode: municodeMeetings, legistar, granicus, civicweb: civicWeb,
  dublin, pagetable: pageTable, dcrpc, archivecenter: archiveCenter, wpfd,
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: tok } = await db.from("app_settings").select("value").eq("key", "digest_token").single();
  if (!tok || req.headers.get("x-digest-token") !== tok.value) return new Response("Not found", { status: 404 });

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const year = Number(today.slice(0, 4));
  // Late in the year, also pick up next year's meetings as cities post them. ?years=2021,2022 backfills past years
  // (one jurisdiction and year per call keeps CivicClerk's 15-per-page paging under the time limit).
  const asked = (url.searchParams.get("years") ?? "").split(",").map(Number).filter((y) => y >= 2000 && y <= year + 1);
  const years = asked.length ? asked.sort((a, b) => a - b) : Number(today.slice(5, 7)) >= 11 ? [year, year + 1] : [year];

  let q = db.from("jurisdictions").select("id, collector, collector_ref").not("collector", "is", null);
  const only = url.searchParams.get("j");
  q = only ? q.eq("id", only) : q.eq("followed", true);
  const { data: js, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  const runOne = async (j: { id: string; collector: string; collector_ref: string }) => {
    // Readers that only see posted documents (not the whole schedule).
    const fullSchedule = !["agendacenter", "archivecenter", "wpfd"].includes(j.collector);
    try {
      const collected: Collected[] = [];
      for (const y of years) {
        collected.push(...await COLLECTORS[j.collector](j.collector_ref, y));
      }
      const { data: existing } = await db.from("meetings")
        .select("id, body, event_date, event_time, location, agenda_url, packet_url, minutes_url, status")
        .eq("jurisdiction_id", j.id).eq("event_type", "meeting")
        .gte("event_date", `${years[0]}-01-01`).lte("event_date", `${years[years.length - 1]}-12-31`);
      const have = new Map((existing ?? []).map((m) => [`${m.body}|${m.event_date}`, m]));
      const seen = new Set(collected.map((c) => `${c.body}|${c.event_date}`));

      const inserts = [];
      let updated = 0;
      for (const c of collected) {
        const m = have.get(`${c.body}|${c.event_date}`);
        if (!m) {
          inserts.push({
            jurisdiction_id: j.id, body: c.body, event_type: "meeting", event_date: c.event_date, event_time: c.event_time,
            location: c.location, status: c.cancelled ? "cancelled" : "published", source_url: c.source_url,
            agenda_url: c.agenda_url, packet_url: c.packet_url, minutes_url: c.minutes_url, verified_on: today,
            note: /special/i.test(c.title) ? "Special meeting" : null,
          });
          continue;
        }
        const patch: Record<string, unknown> = {};
        if (!m.agenda_url && c.agenda_url) patch.agenda_url = c.agenda_url;
        // A different agenda link for an upcoming meeting is usually an amended agenda; extract-agendas' recheck
        // sees the new file and reads it again.
        else if (m.agenda_url && c.agenda_url && c.agenda_url !== m.agenda_url && c.event_date >= today) patch.agenda_url = c.agenda_url;
        if (!m.packet_url && c.packet_url) patch.packet_url = c.packet_url;
        if (!m.minutes_url && c.minutes_url) patch.minutes_url = c.minutes_url;
        if (!m.event_time && c.event_time) patch.event_time = c.event_time;
        if (!m.location && c.location) patch.location = c.location;
        if (m.status === "projected" && c.cancelled) patch.status = "cancelled";
        else if (m.status === "projected" && (c.agenda_url || fullSchedule)) patch.status = "published";
        if (Object.keys(patch).length) {
          patch.verified_on = today;
          const { error: ue } = await db.from("meetings").update(patch).eq("id", m.id);
          if (ue) throw new Error(ue.message);
          updated++;
        }
      }
      if (inserts.length) {
        const { error: ie } = await db.from("meetings").insert(inserts);
        if (ie) throw new Error(ie.message);
      }
      // CivicClerk and Municode list the whole schedule, so anything they lack is suspect. AgendaCenter (and the other
      // posted-documents-only readers) list posted agendas, so only past meetings (a few days' grace) count there.
      const cutoff = fullSchedule ? "9999-12-31" : new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
      const missing = collected.length
        ? (existing ?? []).filter((m) => m.status !== "cancelled" && m.event_date <= cutoff && !seen.has(`${m.body}|${m.event_date}`))
          .map((m) => ({ event_date: m.event_date, body: m.body }))
        : [];
      await db.from("jurisdictions").update({ collected_on: new Date().toISOString() }).eq("id", j.id);
      const run = { jurisdiction_id: j.id, ok: true, found: collected.length, inserted: inserts.length, updated, missing: missing.length ? missing : null };
      await db.from("collector_runs").insert(run);
      return run;
    } catch (e) {
      const run = { jurisdiction_id: j.id, ok: false, error: String((e as Error).message ?? e).slice(0, 500) };
      await db.from("collector_runs").insert(run);
      return run;
    }
  };

  // A few sites at a time, to stay polite to small-town web servers.
  const results: unknown[] = [];
  const queue = [...(js ?? [])];
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) results.push(await runOne(j));
  }));
  return new Response(JSON.stringify(results, null, 1), { headers: { "Content-Type": "application/json" } });
});
