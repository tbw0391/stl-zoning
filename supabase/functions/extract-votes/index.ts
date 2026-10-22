// Reads posted minutes with Claude and stores how each land-use item was decided in meetings.votes: the motion,
// the result, the tally and, when the minutes name them, each member's vote. Only meetings whose agenda had
// land-use items (meetings.agenda_items) are read, newest first, MINUTES_LOOKBACK_DAYS back (minutes are
// approved at the next meeting, so they post weeks late). pg_cron runs it hourly; each meeting is read once.
//
// Secrets: ANTHROPIC_API_KEY. Requests need the x-digest-token header (shared cron token in public.app_settings).
//   ?limit=N   meetings per run (default 8)      ?id=N   one meeting (re-reads even if already checked)
// Deployed with verify_jwt off.
import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TZ = "America/Chicago";
const MODEL = "claude-opus-5-5";
const MINUTES_LOOKBACK_DAYS = 120;
// Same PDF limits as extract-agendas: the API takes about 24 MB raw; bigger files are cut to their first pages.
const MAX_PDF_BYTES = 23 * 1024 * 1024;
const FRONT_PAGES = 40;
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36" };

const SYSTEM = `You read the minutes of municipal Planning & Zoning and city council / board of aldermen meetings in the St. Louis, Missouri and Columbus, Ohio areas (Ohio townships: zoning commission and board of trustees) for a homebuilder's land-entitlement team.

You are given the land-use items from that meeting's agenda. For each one the minutes act on, record the vote:
- item: the item as the agenda list names it (copy it exactly when it matches one; otherwise as the minutes name it).
- case_number: as the minutes or agenda give it, or null.
- motion: one plain line, e.g. "Recommend approval with staff conditions" or "Approve Bill 4521 on second reading".
- result: approved, approved_with_conditions, recommended_approval, recommended_denial, denied, tabled, continued, withdrawn, or other. Planning commissions that advise the council "recommend"; use the recommended_ values for them.
- ayes, nays, abstentions, absent: the counts the minutes state, or null when they don't say.
- unanimous: true when the minutes say the vote was unanimous (or "all in favor" with no dissent), false when someone voted no, null when unclear.
- roll_call: each member's vote, only when the minutes name who voted which way (a roll call, or "motion carried, Smith voting no"). Use the names as written. vote is aye, nay, abstain, absent or recused. Don't fill in names the minutes don't tie to a vote.
- note: anything else the team would want (amendments to the motion, conditions added, the item continued to a date), or null.

If an item was voted on more than once (a motion to amend, then the main motion), record the final vote on the item itself and mention the others in note. Skip agenda items the minutes don't act on. Also list the members recorded as present.

Only report what the minutes say.`;

const VOTE = ["aye", "nay", "abstain", "absent", "recused"];
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["present", "votes"],
  properties: {
    present: { type: "array", items: { type: "string" } },
    votes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "case_number", "motion", "result", "ayes", "nays", "abstentions", "absent", "unanimous", "roll_call", "note"],
        properties: {
          item: { type: "string" },
          case_number: { type: ["string", "null"] },
          motion: { type: "string" },
          result: {
            type: "string",
            enum: ["approved", "approved_with_conditions", "recommended_approval", "recommended_denial", "denied",
              "tabled", "continued", "withdrawn", "other"],
          },
          ayes: { type: ["integer", "null"] },
          nays: { type: ["integer", "null"] },
          abstentions: { type: ["integer", "null"] },
          absent: { type: ["integer", "null"] },
          unanimous: { type: ["boolean", "null"] },
          roll_call: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "vote"],
              properties: { name: { type: "string" }, vote: { type: "string", enum: VOTE } },
            },
          },
          note: { type: ["string", "null"] },
        },
      },
    },
  },
};

// Base64 without blowing the call stack on large PDFs.
function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// A document block for PDF minutes, or a text block for an HTML page (same handling as extract-agendas).
async function minutesContent(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: UA, redirect: "follow" });
  if (!res.ok) throw new Error(`minutes HTTP ${res.status}`);
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
      if (pdf.length > MAX_PDF_BYTES) throw new Error(`minutes PDF too large even cut to ${FRONT_PAGES} pages`);
    }
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: toBase64(pdf) } };
  }
  const text = new TextDecoder().decode(bytes).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 200) throw new Error(`minutes aren't a PDF and have little text (${type})`);
  return { type: "text", text: `<minutes>\n${text}\n</minutes>` };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: tok } = await db.from("app_settings").select("value").eq("key", "digest_token").single();
  if (!tok || req.headers.get("x-digest-token") !== tok.value) return new Response("Not found", { status: 404 });
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return new Response("Missing ANTHROPIC_API_KEY secret", { status: 500 });

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const since = new Date(Date.now() - MINUTES_LOOKBACK_DAYS * 864e5).toISOString().slice(0, 10);
  let q = db.from("meetings").select("id, jurisdiction_id, body, event_date, minutes_url, agenda_items, jurisdictions!inner(name)")
    .not("minutes_url", "is", null);
  const one = url.searchParams.get("id");
  if (!one) q = q.eq("jurisdictions.followed", true);
  q = one ? q.eq("id", Number(one)) : q.is("minutes_checked_on", null).gte("event_date", since).lt("event_date", today)
    .not("agenda_items", "is", null).neq("agenda_items", "[]")
    .order("event_date", { ascending: false }).limit(Number(url.searchParams.get("limit") ?? 8));
  const { data: meetings, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  const client = new Anthropic();
  // deno-lint-ignore no-explicit-any
  const read = async (m: any) => {
    try {
      const minutes = await minutesContent(m.minutes_url);
      // deno-lint-ignore no-explicit-any
      const items = ((m.agenda_items ?? []) as any[]).map((it) => ({ item: it.item, request: it.request, case_number: it.case_number ?? null }));
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
          content: [minutes, {
            type: "text",
            text: `Minutes of the ${m.jurisdictions?.name ?? m.jurisdiction_id} ${board} meeting of ${m.event_date}.\n` +
              `Land-use items on its agenda:\n${JSON.stringify(items, null, 1)}\n\nRecord the votes on these items.`,
          }],
        }],
      // deno-lint-ignore no-explicit-any
      } as any);
      if (response.stop_reason === "refusal") throw new Error(`refused (${response.stop_details?.category ?? "no category"})`);
      if (response.stop_reason === "max_tokens") throw new Error("output cut off at max_tokens");
      const text = response.content.find((b) => b.type === "text");
      const out = JSON.parse(text && "text" in text ? text.text : "{}");
      if (!Array.isArray(out.votes)) throw new Error("no votes array in response");
      const { error: ue } = await db.from("meetings")
        .update({ votes: out, minutes_checked_on: today, minutes_read_at: new Date().toISOString() }).eq("id", m.id);
      if (ue) throw new Error(ue.message);
      return { id: m.id, jurisdiction_id: m.jurisdiction_id, event_date: m.event_date, votes: out.votes.length,
        named: out.votes.filter((v: { roll_call: unknown[] }) => v.roll_call.length).length,
        input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens };
    } catch (e) {
      // API trouble: leave it for the next run. Anything else (bad link, unreadable scan): mark checked, votes stay null.
      if (e instanceof Anthropic.APIError && !(e instanceof Anthropic.BadRequestError)) {
        return { id: m.id, error: `retry later: ${e.status} ${e.message}` };
      }
      await db.from("meetings").update({ minutes_checked_on: today }).eq("id", m.id);
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
