// Daily meeting collection for jurisdictions with a `collector` set (AgendaCenter, CivicClerk, Municode Meetings or Legistar).
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

const COLLECTORS: Record<string, (ref: string, year: number) => Promise<Collected[]>> = {
  agendacenter: agendaCenter, civicclerk: civicClerk, municode: municodeMeetings, legistar,
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
    const fullSchedule = j.collector !== "agendacenter";
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
      // CivicClerk and Municode list the whole schedule, so anything they lack is suspect. AgendaCenter only
      // lists posted agendas, so only past meetings (a few days' grace) count there.
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
