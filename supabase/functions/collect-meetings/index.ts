// Daily meeting collection for jurisdictions with a `collector` set (AgendaCenter or CivicClerk).
// TypeScript port of scripts/collectors/*.py; keep the board-matching rules in step with agendacenter.py.
//
// For each jurisdiction: inserts meetings we don't have, fills missing agenda links / times / locations,
// and marks projected meetings as published once the city posts them. Never overwrites hand-researched
// values and never deletes: meetings in our data that the city's system lacks are recorded in
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
  "adjustment|appeals|BZA|architectur|historic|landmark|park|library|police|fire|pension|retire|" +
    "tif|tax increment|equalization|merit|ethics|youth|senior|arts|tree|beautif|cemetery|" +
    "traffic|personnel|audit|finance|budget|work ?session|special|port authority|road board|" +
    "committee|advisory|task force|group|steering|notices|emergency", "i");
const PZ = /planning|zoning|P\s*&\s*Z|plan commission/i;
const GOV = /aldermen|alderm|city council|county council|board of trustees|village board|^council$|\bcouncil\b(?!.*(advisory|youth|arts))/i;
const NOT_HEARING = /work ?session|study session|retreat|orientation|training|closed session|executive session/i;
// ...unless it's combined with the regular meeting ("Work Session and Council Meeting").
const REGULAR = /regular|(council|board|commission|aldermen) meeting/i;
const notHearing = (title: string) => NOT_HEARING.test(title) && !REGULAR.test(title);

type Body = "planning_zoning" | "governing_body";
type Collected = {
  body: Body; event_date: string; event_time: string | null; location: string | null; title: string;
  agenda_url: string | null; source_url: string;
};

function bodyFor(name: string): Body | null {
  if (SKIP.test(name)) return null;
  if (PZ.test(name)) return "planning_zoning";
  if (GOV.test(name)) return "governing_body";
  return null;
}

async function fetchText(url: string, form?: Record<string, string | number>) {
  const res = await fetch(url, {
    method: form ? "POST" : "GET",
    headers: form ? { ...UA, "Content-Type": "application/x-www-form-urlencoded" } : UA,
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
  for (const m of page.matchAll(/id="cat(\d+)">\s*<h2[^>]*>([^<]+)<\/h2>/g)) {
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
      const date = `${yyyy}-${mm}-${dd}`;
      const key = `${body}|${date}`;
      if (rows.has(key)) continue;
      const agendaUrl = `${base}/AgendaCenter/ViewFile/Agenda/_${mm}${dd}${yyyy}-${id}`;
      rows.set(key, { body, event_date: date, event_time: null, location: null, title, agenda_url: agendaUrl, source_url: `${base}/AgendaCenter` });
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
    const key = `${body}|${local.slice(0, 10)}`;
    if (rows.has(key)) continue;
    // deno-lint-ignore no-explicit-any
    const agenda = (e.publishedFiles ?? []).find((f: any) => f.type === "Agenda");
    const loc = e.eventLocation ?? {};
    const time = local.slice(11, 16);
    rows.set(key, {
      body, event_date: local.slice(0, 10), event_time: time && time !== "00:00" ? time : null,
      location: [loc.address1, loc.address2].filter(Boolean).join(", ") || null,
      title: e.eventName,
      agenda_url: agenda ? api(`Meetings/GetMeetingFileStream(fileId=${agenda.fileId},plainText=false)`).replace(/\?$/, "") : null,
      source_url: `https://${tenant}.portal.civicclerk.com/event/${e.id}/files`,
    });
  }
  return [...rows.values()];
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: tok } = await db.from("app_settings").select("value").eq("key", "digest_token").single();
  if (!tok || req.headers.get("x-digest-token") !== tok.value) return new Response("Not found", { status: 404 });

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const year = Number(today.slice(0, 4));
  // Late in the year, also pick up next year's meetings as cities post them.
  const years = Number(today.slice(5, 7)) >= 11 ? [year, year + 1] : [year];

  let q = db.from("jurisdictions").select("id, collector, collector_ref").not("collector", "is", null);
  const only = url.searchParams.get("j");
  if (only) q = q.eq("id", only);
  const { data: js, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  const runOne = async (j: { id: string; collector: string; collector_ref: string }) => {
    try {
      const collected: Collected[] = [];
      for (const y of years) {
        collected.push(...(j.collector === "civicclerk" ? await civicClerk(j.collector_ref, y) : await agendaCenter(j.collector_ref, y)));
      }
      const { data: existing } = await db.from("meetings")
        .select("id, body, event_date, event_time, location, agenda_url, status")
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
            location: c.location, status: "published", source_url: c.source_url, agenda_url: c.agenda_url, verified_on: today,
            note: /special/i.test(c.title) ? "Special meeting" : null,
          });
          continue;
        }
        const patch: Record<string, unknown> = {};
        if (!m.agenda_url && c.agenda_url) patch.agenda_url = c.agenda_url;
        if (!m.event_time && c.event_time) patch.event_time = c.event_time;
        if (!m.location && c.location) patch.location = c.location;
        if (m.status === "projected" && (c.agenda_url || j.collector === "civicclerk")) patch.status = "published";
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
      // CivicClerk lists the whole schedule, so anything it lacks is suspect. AgendaCenter only lists
      // posted agendas, so only past meetings (a few days' grace) count there.
      const cutoff = j.collector === "civicclerk" ? "9999-12-31" : new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
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
  const results = [];
  const queue = [...(js ?? [])];
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) results.push(await runOne(j));
  }));
  return new Response(JSON.stringify(results, null, 1), { headers: { "Content-Type": "application/json" } });
});
