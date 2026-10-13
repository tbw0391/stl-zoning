// Reads posted agendas with Claude and stores the land-use items (rezonings, plats, site plans, ...) in
// meetings.agenda_items. Picks up meetings that have an agenda_url but no agenda_checked_on, newest first
// (agendas older than LOOKBACK_DAYS only when someone requests one on the site and it's approved, to keep API
// costs down; the requester is emailed when it's read, once RESEND_API_KEY and DIGEST_FROM are set),
// a batch per run; pg_cron runs it hourly so the backlog clears and new agendas are read within the hour.
// Never touches meetings already checked (including the hand-entered ones).
//
// Revisions: ?recheck=1 (pg_cron twice a day) re-fetches upcoming agendas and compares a sha-256 of the file with
// meetings.agenda_hash; a changed agenda is read again, with the old items kept in agenda_previous_items.
// Alerts: after every run, items on newly read or revised agendas are matched against the /alerts watches (same rules
// as web/src/lib/cases.ts) and the matches go out in one email to DIGEST_TO (revisions list added / removed items).
//
// Secrets: ANTHROPIC_API_KEY; RESEND_API_KEY + DIGEST_FROM (+ DIGEST_TO for alerts), optional; SITE_URL (optional).
// Requests need the x-digest-token header (shared cron token in public.app_settings).
//   ?limit=N   meetings per run (default 12)      ?id=N   one meeting (re-reads even if already checked)
//   ?geocode=1 locate item addresses on already-read agendas (no Claude calls)
//   ?recheck=1 look for revised upcoming agendas      ?to=a@b.c  send this run's alert email there instead of DIGEST_TO
// Deployed with verify_jwt off.
import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TZ = "America/Chicago";
const MODEL = "claude-opus-5-5";
const LOOKBACK_DAYS = 45; // older agendas aren't worth reading on the first pass
// The API takes PDFs up to 32 MB once base64-encoded (about 24 MB raw). Some cities bundle the whole packet
// into the agenda file; the agenda itself is at the front, so oversized files are cut to their first pages.
const MAX_PDF_BYTES = 23 * 1024 * 1024;
const FRONT_PAGES = 25;
const SITE = (Deno.env.get("SITE_URL") ?? "https://stl-zoning.vercel.app").replace(/\/$/, "");
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36" };

const SYSTEM = `You read municipal Planning & Zoning and city council / board of aldermen agendas in the St. Louis, Missouri area for a homebuilder's land-entitlement team.

List every land-use item on the agenda: rezonings / zoning map amendments, planned unit developments, special or conditional use permits, preliminary and final plats, site plans, annexations, comprehensive plan amendments, zoning or subdivision code text amendments, variances, vacations of right-of-way or easements, and development agreements. Skip routine business (minutes, bills, appointments, proclamations, budgets, purchases, liquor licenses, general reports) unless it decides a land-use item.

When the same case appears more than once (public hearing and then the vote, or first and second reading of its ordinance), list it once.

For each item:
- item: the case number and short name as the agenda gives them, e.g. "RZ26-07 (Castlegate, LLC)" or "Bill 4521: Jacobs Grove preliminary plat".
- request: one plain line of what is asked, leading with the location, e.g. "613 Jacobs Station Rd: R1A to R1D" or "NW quadrant of Hwy Z / Hwy N: 20 lots, 1.8 du/ac".
- type: one of the listed categories.
- case_number, applicant, address, from_zoning, to_zoning, acres, units: exactly as the agenda states them, or null when it doesn't say. Don't guess or compute values the agenda doesn't give.

If the agenda has no land-use items, return an empty list. Only report what the document says.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "request", "type", "case_number", "applicant", "address", "from_zoning", "to_zoning", "acres", "units"],
        properties: {
          item: { type: "string" },
          request: { type: "string" },
          type: {
            type: "string",
            enum: ["rezoning", "pud", "special_use", "preliminary_plat", "final_plat", "site_plan", "annexation",
              "comprehensive_plan", "text_amendment", "variance", "vacation", "development_agreement", "other"],
          },
          case_number: { type: ["string", "null"] },
          applicant: { type: ["string", "null"] },
          address: { type: ["string", "null"] },
          from_zoning: { type: ["string", "null"] },
          to_zoning: { type: ["string", "null"] },
          acres: { type: ["number", "null"] },
          units: { type: ["integer", "null"] },
        },
      },
    },
  },
};

// Street address → lat/lng (Census geocoder, then OpenStreetMap). Same rules as web/src/lib/geocode.ts:
// only house-number addresses, and only points inside the St. Louis region.
const inRegion = (lat: number, lng: number) => lat > 37.9 && lat < 39.4 && lng > -91.7 && lng < -89.7;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function geocode(address: string, jurisdictionName: string): Promise<{ lat: number; lng: number; geo: string } | null> {
  const street = address.split(/\s+(?:and|&)\s+|;|\//i)[0].trim();
  if (!/^\d+\s+\S/.test(street)) return null;
  const place = /county/i.test(jurisdictionName) ? null : jurisdictionName.replace(/^(City|Town|Village) of /, "");
  const q = [street, place, "MO"].filter(Boolean).join(", ");
  try {
    const r = await fetch("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?" +
      new URLSearchParams({ address: q, benchmark: "Public_AR_Current", format: "json" }));
    const c = (await r.json())?.result?.addressMatches?.[0]?.coordinates;
    if (c && inRegion(c.y, c.x)) return { lat: c.y, lng: c.x, geo: "census" };
  } catch { /* fall through */ }
  try {
    await sleep(1100); // Nominatim allows one request a second
    const r = await fetch("https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({ q, format: "json", limit: "1", countrycodes: "us" }), { headers: { "User-Agent": "AGA-Entitlement-Tracker/1.0" } });
    const h = (await r.json())?.[0];
    if (h && inRegion(Number(h.lat), Number(h.lon))) return { lat: Number(h.lat), lng: Number(h.lon), geo: "osm" };
  } catch { /* no match */ }
  return null;
}

// Adds lat/lng (or geo: "none") to items that have an address and haven't been tried yet.
// deno-lint-ignore no-explicit-any
async function geocodeItems(items: any[], jurisdictionName: string) {
  for (const it of items) {
    if (!it.address || it.geo) continue;
    const p = await geocode(it.address, jurisdictionName);
    Object.assign(it, p ?? { geo: "none" });
  }
  return items;
}

// Base64 without blowing the call stack on large PDFs.
function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const sha256 = async (data: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)), (b) => b.toString(16).padStart(2, "0")).join("");

type Agenda = { block: () => Promise<Record<string, unknown>>; hash: string };

// A hash of the agenda for spotting revisions (the whole PDF, or the page's text so markup changes don't count),
// and the content block to send to Claude: a document for a PDF, text for an HTML page. The block is built only
// when asked for, so a recheck of an unchanged agenda doesn't trim and encode the PDF.
async function fetchAgenda(url: string): Promise<Agenda> {
  const res = await fetch(url, { headers: UA, redirect: "follow" });
  if (!res.ok) throw new Error(`agenda HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (type.includes("pdf") || (bytes[0] === 0x25 && bytes[1] === 0x50)) { // "%P" of %PDF
    const block = async () => {
      let pdf: Uint8Array = bytes;
      if (pdf.length > MAX_PDF_BYTES) {
        const src = await PDFDocument.load(pdf, { ignoreEncryption: true });
        const front = await PDFDocument.create();
        const pages = await front.copyPages(src, [...Array(Math.min(FRONT_PAGES, src.getPageCount())).keys()]);
        pages.forEach((p) => front.addPage(p));
        pdf = await front.save();
        if (pdf.length > MAX_PDF_BYTES) throw new Error(`agenda PDF too large even cut to ${FRONT_PAGES} pages`);
      }
      return { type: "document", source: { type: "base64", media_type: "application/pdf", data: toBase64(pdf) } };
    };
    return { block, hash: await sha256(bytes) };
  }
  // Some cities serve the agenda as an HTML page.
  const text = new TextDecoder().decode(bytes).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 200) throw new Error(`agenda isn't a PDF and has little text (${type})`);
  return { block: async () => ({ type: "text", text: `<agenda>\n${text}\n</agenda>` }), hash: await sha256(new TextEncoder().encode(text)) };
}

// Tells the person who requested an older agenda that it's been read. Skipped (and retried next run) until email is set up.
// deno-lint-ignore no-explicit-any
async function notifyRequester(db: any, m: any, items: number | null) {
  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("DIGEST_FROM");
  if (!key || !from || !m.agenda_requested_by || m.agenda_request_notified_at) return;
  const what = `${m.jurisdictions?.name ?? m.jurisdiction_id} ${m.body === "planning_zoning" ? "Planning & Zoning" : "council / aldermen"} agenda for ${m.event_date}`;
  const result = items == null ? "couldn't be read automatically (open the posted agenda instead)"
    : items === 0 ? "has been read: it has no land-use items" : `has been read: ${items} land-use item${items === 1 ? "" : "s"}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: [m.agenda_requested_by], subject: `Agenda ready: ${what}`,
      html: `<p>The ${what} you requested ${result}.</p><p><a href="${SITE}/meetings/${m.id}">Open it in the Entitlement Tracker</a></p>`,
    }),
  });
  if (res.ok) await db.from("meetings").update({ agenda_request_notified_at: new Date().toISOString() }).eq("id", m.id);
}

// ---- Watch alerts. Same matching as web/src/lib/cases.ts; keep the two in step.
const ZONING_TYPES = ["rezoning", "pud", "special_use", "annexation"];
const ALERT_WINDOW_DAYS = 7; // agendas for meetings older than this (approved requests for old agendas) never alert
const TYPE_LABEL: Record<string, string> = {
  rezoning: "Rezoning", pud: "PUD", special_use: "Special use", preliminary_plat: "Preliminary plat", final_plat: "Final plat",
  site_plan: "Site plan", annexation: "Annexation", comprehensive_plan: "Comp plan", text_amendment: "Text amendment",
  variance: "Variance", vacation: "Vacation", development_agreement: "Development agreement", other: "Other",
};
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
const caseTypes = (it: Row) =>
  it.type ? [it.type] : /rezon|zoning|PUD|planned unit|special use|conditional use|annex|\bRZ[\s-]?\d|\b[A-Z]{1,3}-?\d?[A-Z]? to [A-Z]{1,3}-?\d/i.test(`${it.item} ${it.request}`) ? ["rezoning"] : ["other"];
function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}
// The watch's description of the match ("Sagebrook, 1.2 mi"), or null when the item doesn't match it.
function watchMatch(it: Row, county: string, jurisdictionId: string, w: Row, project?: Row): string | null {
  const types = w.types?.length ? w.types : ZONING_TYPES;
  if (!caseTypes(it).some((t: string) => types.includes(t))) return null;
  if (w.counties?.length && !w.counties.includes(county)) return null;
  if (w.jurisdiction_ids?.length && !w.jurisdiction_ids.includes(jurisdictionId)) return null;
  const name = w.name || `Watch ${w.id}`;
  if (!w.project_id) return name;
  if (project?.lat == null || it.lat == null) return null;
  const d = milesBetween({ lat: project.lat, lng: project.lng }, { lat: it.lat, lng: it.lng });
  return d <= Number(w.radius_miles) ? `${name}, ${d.toFixed(1)} mi` : null;
}
// Identity of an item across two reads of the same agenda: its case number (from the field, or the start of the title,
// since hand-entered items have only a title like "RZ26-07 (Castlegate, LLC)"), else address, else the title.
const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const caseId = (s: unknown) => norm(String(s ?? "").match(/[A-Z]{0,5}\d{2,}[\d-]*/i)?.[0]);
const itemKey = (it: Row) => caseId(it.case_number) || caseId(it.item) || norm(it.address) || norm(it.item);

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtDate = (d: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(d + "T00:00:00Z"));
const shortName = (n: string) => n.replace(/^(City|Town|Village) of /, "");

// Checks every newly read or revised agenda against the watches and emails the matches in one message.
// A meeting is marked alerted once checked; if the email can't go out it stays pending for the next run.
// toOverride (?to= on the request) sends to that address instead of DIGEST_TO, for testing.
// deno-lint-ignore no-explicit-any
async function sendAlerts(db: any, toOverride?: string | null) {
  const since = new Date(Date.now() - ALERT_WINDOW_DAYS * 864e5).toISOString();
  const { data: rows } = await db.from("meetings")
    .select("id, jurisdiction_id, body, event_date, agenda_url, agenda_items, agenda_previous_items, agenda_read_at, agenda_revised_at, agenda_alerted_at")
    .gte("agenda_read_at", since);
  const pending = ((rows ?? []) as Row[]).filter((m) => !m.agenda_alerted_at || m.agenda_alerted_at < m.agenda_read_at);
  if (!pending.length) return { checked: 0 };

  const [{ data: watches }, { data: projects }, { data: js }] = await Promise.all([
    db.from("watches").select("*"), db.from("projects").select("id, name, lat, lng"),
    db.from("jurisdictions").select("id, name, county, governing_body"),
  ]);
  const pmap = new Map(((projects ?? []) as Row[]).map((p) => [p.id, p]));
  const jmap = new Map(((js ?? []) as Row[]).map((j) => [j.id, j]));
  const oldest = new Date(Date.now() - ALERT_WINDOW_DAYS * 864e5).toISOString().slice(0, 10);

  type Hit = { it: Row; why: string[]; removed: boolean };
  const sections: { m: Row; revised: boolean; hits: Hit[] }[] = [];
  for (const m of pending) {
    if (m.event_date < oldest) continue;
    const j = jmap.get(m.jurisdiction_id) ?? {};
    const items = (Array.isArray(m.agenda_items) ? m.agenda_items : []) as Row[];
    const revised = !!m.agenda_revised_at && Array.isArray(m.agenda_previous_items) &&
      (!m.agenda_alerted_at || m.agenda_revised_at > m.agenda_alerted_at);
    const before = revised ? (m.agenda_previous_items as Row[]) : [];
    const oldKeys = new Set(before.map(itemKey)), newKeys = new Set(items.map(itemKey));
    const candidates = [
      ...items.filter((it) => !oldKeys.has(itemKey(it))).map((it) => ({ it, removed: false })),
      ...before.filter((it) => !newKeys.has(itemKey(it))).map((it) => ({ it, removed: true })),
    ];
    const hits: Hit[] = [];
    for (const c of candidates) {
      const why = ((watches ?? []) as Row[])
        .map((w) => watchMatch(c.it, j.county, m.jurisdiction_id, w, w.project_id ? pmap.get(w.project_id) : undefined))
        .filter((x): x is string => !!x);
      if (why.length) hits.push({ ...c, why });
    }
    if (hits.length) sections.push({ m, revised, hits });
  }

  const markAlerted = (ids: number[]) =>
    ids.length ? db.from("meetings").update({ agenda_alerted_at: new Date().toISOString() }).in("id", ids) : null;
  const quiet = pending.filter((m) => !sections.some((s) => s.m.id === m.id)).map((m) => m.id);
  await markAlerted(quiet);
  if (!sections.length) return { checked: pending.length, emailed: 0 };

  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("DIGEST_FROM");
  const to = (toOverride ?? Deno.env.get("DIGEST_TO") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!key || !from || !to.length) return { checked: pending.length, emailed: 0, waiting: "email secrets not set" };

  const C = { teal: "#096764", amber: "#ffb549", orange: "#c4502a", text: "#1d2a28", muted: "#5f6b67", border: "#e3e1da", bg: "#f6f5f1" };
  const pill = (text: string, color: string) =>
    `<span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:.03em;padding:2px 8px;border-radius:99px;background:${color}1a;color:${color};white-space:nowrap">${esc(text)}</span>`;
  const board = (m: Row) => m.body === "planning_zoning" ? "Planning & Zoning"
    : (jmap.get(m.jurisdiction_id)?.governing_body ?? "Council").replace(/\s*\(.*\)$/, "");
  const place = (m: Row) => shortName(jmap.get(m.jurisdiction_id)?.name ?? m.jurisdiction_id);
  const count = sections.reduce((n, s) => n + s.hits.length, 0);
  const body = sections.map(({ m, revised, hits }) => `
<tr><td style="padding:18px 24px 4px">
  <div style="font-size:16px;font-weight:700;color:${C.text}">${esc(place(m))} ${esc(board(m))} · ${fmtDate(m.event_date)}
    ${revised ? pill("REVISED AGENDA", C.orange) : pill("NEW AGENDA", C.teal)}</div>
  <div style="font-size:13px;margin:4px 0 8px"><a href="${SITE}/meetings/${m.id}" style="color:${C.teal}">Open in the tracker</a>
    ${m.agenda_url ? ` · <a href="${esc(m.agenda_url)}" style="color:${C.teal}">Posted agenda</a>` : ""}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${hits.map(({ it, why, removed }) => `
    <tr><td style="padding:8px 0;border-top:1px solid ${C.border};font-size:14px;color:${C.text}">
      ${removed ? pill("REMOVED", C.orange) + " " : revised ? pill("ADDED", C.teal) + " " : ""}${pill(TYPE_LABEL[caseTypes(it)[0]] ?? "Item", "#8a5a00")}
      <strong${removed ? ' style="text-decoration:line-through"' : ""}>${esc(it.item)}</strong>
      <div style="margin-top:2px">${esc(it.request)}</div>
      <div style="font-size:12px;color:${C.muted};margin-top:2px">Matches: ${why.map(esc).join("; ")}</div>
    </td></tr>`).join("")}
  </table>
</td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border:1px solid ${C.border};border-radius:12px;overflow:hidden">
<tr><td style="padding:18px 24px;border-bottom:3px solid ${C.amber};font-weight:700;font-size:15px;color:${C.text}">Entitlement Tracker · Agenda alert</td></tr>
${body}
<tr><td style="padding:20px 24px"><a href="${SITE}/alerts" style="color:${C.teal};font-size:13px">See all alerts and watches</a></td></tr>
</table>
<p style="color:${C.muted};font-size:12px;margin:12px 0 0">Sent when a newly posted or revised agenda has items matching a watch.</p>
</td></tr></table></body></html>`;
  const first = sections[0].m;
  const subject = `Agenda alert: ${count} item${count === 1 ? "" : "s"} · ${place(first)} ${board(first)} ${fmtDate(first.event_date)}` +
    (sections.length > 1 ? ` + ${sections.length - 1} more` : "");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  const out = await res.json().catch(() => ({}));
  await db.from("digest_log").insert({
    kind: "agenda_alert", recipients: to.join(", "), resend_id: out?.id ?? null,
    error: res.ok ? null : JSON.stringify(out).slice(0, 1000),
  });
  if (res.ok) await markAlerted(sections.map((s) => s.m.id));
  return { checked: pending.length, emailed: res.ok ? count : 0, error: res.ok ? undefined : out };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: tok } = await db.from("app_settings").select("value").eq("key", "digest_token").single();
  if (!tok || req.headers.get("x-digest-token") !== tok.value) return new Response("Not found", { status: 404 });
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return new Response("Missing ANTHROPIC_API_KEY secret", { status: 500 });

  // ?geocode=1: locate addresses on items already read (no Claude calls).
  if (url.searchParams.get("geocode")) {
    const { data: rows } = await db.from("meetings").select("id, agenda_items, jurisdictions(name)")
      .not("agenda_items", "is", null).not("agenda_read_at", "is", null);
    const started = Date.now();
    let located = 0, tried = 0, remaining = 0;
    for (const r of rows ?? []) {
      // deno-lint-ignore no-explicit-any
      const items = (r.agenda_items ?? []) as any[];
      if (!items.some((it) => it.address && !it.geo)) continue;
      if (Date.now() - started > 90_000) { remaining++; continue; } // stay under the function time limit; call again
      const before = items.filter((it) => it.geo).length;
      // deno-lint-ignore no-explicit-any
      await geocodeItems(items, (r as any).jurisdictions?.name ?? "");
      tried += items.filter((it) => it.geo).length - before;
      located += items.filter((it) => it.lat != null).length;
      await db.from("meetings").update({ agenda_items: items }).eq("id", r.id);
    }
    return new Response(JSON.stringify({ tried, located, meetings_remaining: remaining }), { headers: { "Content-Type": "application/json" } });
  }

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const since = new Date(Date.now() - LOOKBACK_DAYS * 864e5).toISOString().slice(0, 10);
  // Read agendas whose requester hasn't been emailed yet (email wasn't set up, or sending failed).
  const { data: unsent } = await db.from("meetings").select("id, jurisdiction_id, body, event_date, agenda_items, agenda_requested_by, jurisdictions(name)")
    .eq("agenda_request_status", "approved").not("agenda_checked_on", "is", null).is("agenda_request_notified_at", null).limit(20);
  for (const m of unsent ?? []) await notifyRequester(db, m, Array.isArray(m.agenda_items) ? m.agenda_items.length : null);

  const FIELDS = "id, jurisdiction_id, body, event_date, agenda_url, agenda_items, agenda_hash, agenda_request_status, agenda_requested_by, agenda_request_notified_at, jurisdictions(name)";
  const recheck = !!url.searchParams.get("recheck");
  let q = db.from("meetings").select(FIELDS).not("agenda_url", "is", null);
  const one = url.searchParams.get("id");
  if (recheck) {
    // Upcoming agendas already read, least recently re-fetched first.
    q = q.not("agenda_checked_on", "is", null).gte("event_date", today)
      .order("agenda_rechecked_at", { ascending: true, nullsFirst: true }).limit(Number(url.searchParams.get("limit") ?? 80));
  } else {
    // Older agendas are read only when a request on the site has been approved; those go first.
    q = one ? q.eq("id", Number(one)) : q.is("agenda_checked_on", null)
      .or(`event_date.gte.${since},agenda_request_status.eq.approved`)
      .order("agenda_requested_at", { ascending: false, nullsFirst: false })
      .order("event_date", { ascending: false }).limit(Number(url.searchParams.get("limit") ?? 12));
  }
  const { data: meetings, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  const client = new Anthropic();
  // An agenda read before (a revision, or ?id=N) keeps its old items in agenda_previous_items for the alert email.
  // deno-lint-ignore no-explicit-any
  const read = async (m: any, fetched?: Agenda) => {
    let agenda = fetched;
    try {
      agenda ??= await fetchAgenda(m.agenda_url);
      const content = await agenda.block();
      const board = m.body === "planning_zoning" ? "Planning & Zoning Commission" : "governing body (council / board of aldermen)";
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM,
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        messages: [{
          role: "user",
          content: [content, { type: "text", text: `${m.jurisdictions?.name ?? m.jurisdiction_id} ${board} agenda for ${m.event_date}. List its land-use items.` }],
        }],
      // deno-lint-ignore no-explicit-any
      } as any);
      if (response.stop_reason === "refusal") throw new Error(`refused (${response.stop_details?.category ?? "no category"})`);
      if (response.stop_reason === "max_tokens") throw new Error("output cut off at max_tokens");
      const text = response.content.find((b) => b.type === "text");
      const items = JSON.parse(text && "text" in text ? text.text : "{}").items;
      if (!Array.isArray(items)) throw new Error("no items array in response");
      await geocodeItems(items, m.jurisdictions?.name ?? "");
      const now = new Date().toISOString();
      const revised = Array.isArray(m.agenda_items);
      const reread = revised ? { agenda_previous_items: m.agenda_items, agenda_revised_at: now } : {};
      const { error: ue } = await db.from("meetings").update({
        agenda_items: items, agenda_checked_on: today, agenda_read_at: now, agenda_hash: agenda.hash, agenda_rechecked_at: now, ...reread,
      }).eq("id", m.id);
      if (ue) throw new Error(ue.message);
      if (m.agenda_request_status === "approved") await notifyRequester(db, m, items.length);
      return { id: m.id, jurisdiction_id: m.jurisdiction_id, event_date: m.event_date, items: items.length, revised,
        input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens };
    } catch (e) {
      // API trouble (rate limit, outage, bad key): leave the meeting unchecked so the next run retries it.
      // A request the API rejects as invalid (e.g. a document it can't take) won't succeed on retry, so it falls through.
      if (e instanceof Anthropic.APIError && !(e instanceof Anthropic.BadRequestError)) {
        return { id: m.id, error: `retry later: ${e.status} ${e.message}` };
      }
      // Agenda can't be read (bad link, scanned image, ...): mark checked so it isn't retried forever, but leave
      // agenda_items empty (null) so the site doesn't claim the agenda had no land-use items.
      // The hash is kept too, so a revision that can't be read isn't sent to Claude again on every recheck.
      await db.from("meetings").update({ agenda_checked_on: today, agenda_hash: agenda?.hash ?? m.agenda_hash, agenda_rechecked_at: new Date().toISOString() }).eq("id", m.id);
      if (m.agenda_request_status === "approved") await notifyRequester(db, m, null);
      return { id: m.id, error: String((e as Error).message ?? e).slice(0, 300) };
    }
  };

  // ?recheck=1: re-fetch each agenda and read it again only if the file changed. Agendas read before hashes
  // existed just get their hash stored.
  // deno-lint-ignore no-explicit-any
  const recheckOne = async (m: any) => {
    const stamp = (patch: Record<string, unknown> = {}) =>
      db.from("meetings").update({ agenda_rechecked_at: new Date().toISOString(), ...patch }).eq("id", m.id);
    let agenda: Agenda;
    try {
      agenda = await fetchAgenda(m.agenda_url);
    } catch (e) {
      await stamp();
      return { id: m.id, error: String((e as Error).message ?? e).slice(0, 300) };
    }
    if (!m.agenda_hash) { await stamp({ agenda_hash: agenda.hash }); return { id: m.id, hashed: true }; }
    if (m.agenda_hash === agenda.hash) { await stamp(); return null; }
    return await read(m, agenda);
  };

  const results: unknown[] = [];
  const queue = [...(meetings ?? [])];
  const started = Date.now();
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let m = queue.shift(); m; m = queue.shift()) {
      if (recheck && Date.now() - started > 100_000) break; // stay under the time limit; the rest go first next time
      const r = recheck ? await recheckOne(m) : await read(m);
      if (r) results.push(r);
    }
  }));
  const alerts = await sendAlerts(db, url.searchParams.get("to"));
  return new Response(JSON.stringify({ results, alerts }, null, 1), { headers: { "Content-Type": "application/json" } });
});
