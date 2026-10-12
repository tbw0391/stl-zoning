// Reads posted agendas with Claude and stores the land-use items (rezonings, plats, site plans, ...) in
// meetings.agenda_items. Picks up meetings that have an agenda_url but no agenda_checked_on, newest first,
// a batch per run; pg_cron runs it hourly so the backlog clears and new agendas are read within the hour.
// Never touches meetings already checked (including the hand-entered ones).
//
// Secrets: ANTHROPIC_API_KEY. Requests need the x-digest-token header (shared cron token in public.app_settings).
//   ?limit=N   meetings per run (default 12)      ?id=N   one meeting (re-reads even if already checked)
//   ?geocode=1 locate item addresses on already-read agendas (no Claude calls)
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

// A document block for a PDF agenda, or a text block for an HTML one.
async function agendaContent(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: UA, redirect: "follow" });
  if (!res.ok) throw new Error(`agenda HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (type.includes("pdf") || (bytes[0] === 0x25 && bytes[1] === 0x50)) { // "%P" of %PDF
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
  }
  // Some cities serve the agenda as an HTML page.
  const text = new TextDecoder().decode(bytes).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 200) throw new Error(`agenda isn't a PDF and has little text (${type})`);
  return { type: "text", text: `<agenda>\n${text}\n</agenda>` };
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
  let q = db.from("meetings").select("id, jurisdiction_id, body, event_date, agenda_url, jurisdictions(name)").not("agenda_url", "is", null);
  const one = url.searchParams.get("id");
  q = one ? q.eq("id", Number(one)) : q.is("agenda_checked_on", null).gte("event_date", since)
    .order("event_date", { ascending: false }).limit(Number(url.searchParams.get("limit") ?? 12));
  const { data: meetings, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  const client = new Anthropic();
  // deno-lint-ignore no-explicit-any
  const read = async (m: any) => {
    try {
      const agenda = await agendaContent(m.agenda_url);
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
          content: [agenda, { type: "text", text: `${m.jurisdictions?.name ?? m.jurisdiction_id} ${board} agenda for ${m.event_date}. List its land-use items.` }],
        }],
      // deno-lint-ignore no-explicit-any
      } as any);
      if (response.stop_reason === "refusal") throw new Error(`refused (${response.stop_details?.category ?? "no category"})`);
      if (response.stop_reason === "max_tokens") throw new Error("output cut off at max_tokens");
      const text = response.content.find((b) => b.type === "text");
      const items = JSON.parse(text && "text" in text ? text.text : "{}").items;
      if (!Array.isArray(items)) throw new Error("no items array in response");
      await geocodeItems(items, m.jurisdictions?.name ?? "");
      const { error: ue } = await db.from("meetings")
        .update({ agenda_items: items, agenda_checked_on: today, agenda_read_at: new Date().toISOString() }).eq("id", m.id);
      if (ue) throw new Error(ue.message);
      return { id: m.id, jurisdiction_id: m.jurisdiction_id, event_date: m.event_date, items: items.length,
        input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens };
    } catch (e) {
      // API trouble (rate limit, outage, bad key): leave the meeting unchecked so the next run retries it.
      // A request the API rejects as invalid (e.g. a document it can't take) won't succeed on retry, so it falls through.
      if (e instanceof Anthropic.APIError && !(e instanceof Anthropic.BadRequestError)) {
        return { id: m.id, error: `retry later: ${e.status} ${e.message}` };
      }
      // Agenda can't be read (bad link, scanned image, ...): mark checked so it isn't retried forever, but leave
      // agenda_items empty (null) so the site doesn't claim the agenda had no land-use items.
      await db.from("meetings").update({ agenda_checked_on: today }).eq("id", m.id);
      return { id: m.id, error: String((e as Error).message ?? e).slice(0, 300) };
    }
  };

  const results: unknown[] = [];
  const queue = [...(meetings ?? [])];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let m = queue.shift(); m; m = queue.shift()) results.push(await read(m));
  }));
  return new Response(JSON.stringify(results, null, 1), { headers: { "Content-Type": "application/json" } });
});
