// Emails project alerts (logged delays and possible delays found on agendas or in minutes) to the team as soon as
// they're posted. Called by the project_alerts insert trigger and an hourly sweep (see the
// delay_detection_and_email migration); sends every alert not yet emailed in one message.
//
// Secrets: RESEND_API_KEY, DIGEST_FROM, DIGEST_TO (shared with weekly-digest); SITE_URL optional.
// Requests need the x-digest-token header (value in public.app_settings). ?preview=1 returns the HTML without
// sending or marking anything; ?to=a@b.c sends to that address instead of DIGEST_TO.
// Deployed with verify_jwt off; the token guards access.
import { createClient } from "jsr:@supabase/supabase-js@2";

const TZ = "America/Chicago";
const SITE = (Deno.env.get("SITE_URL") ?? "https://stl-zoning.vercel.app").replace(/\/$/, "");
const C = { teal: "#096764", amber: "#ffb549", orange: "#c4502a", warn: "#8a5a00", text: "#1d2a28", muted: "#5f6b67", border: "#e3e1da", bg: "#f6f5f1" };

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pill = (text: string, color: string) =>
  `<span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:.03em;padding:2px 8px;border-radius:99px;background:${color}1a;color:${color};white-space:nowrap">${esc(text)}</span>`;
const stamp = (ts: string) =>
  new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: tok } = await db.from("app_settings").select("value").eq("key", "digest_token").single();
  if (!tok || req.headers.get("x-digest-token") !== tok.value) return new Response("Not found", { status: 404 });

  const { data: alerts } = await db.from("project_alerts").select("*").is("emailed_at", null).order("created_at");
  const rows = (alerts ?? []) as Row[];
  if (!rows.length) return Response.json({ emailed: 0 });

  const items = rows.map((a) => `
    <tr><td style="padding:12px 0;border-top:1px solid ${C.border};font-size:14px;color:${C.text}">
      ${a.kind === "delay" ? pill("DELAY", C.orange) : pill("POSSIBLE DELAY", C.warn)}
      <a href="${SITE}/projects/${a.project_id}" style="color:${C.teal};font-weight:700;text-decoration:none">${esc(a.title)}</a>
      ${a.body ? `<div style="margin-top:4px">${esc(a.body)}</div>` : ""}
      <div style="font-size:12px;color:${C.muted};margin-top:2px">${stamp(a.created_at)}</div>
    </td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border:1px solid ${C.border};border-radius:12px;overflow:hidden">
<tr><td style="padding:18px 24px;border-bottom:3px solid ${C.amber};font-weight:700;font-size:15px;color:${C.text}">Entitlement Tracker · Project timeline</td></tr>
<tr><td style="padding:8px 24px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${items}</table></td></tr>
<tr><td style="padding:20px 24px"><a href="${SITE}/alerts" style="color:${C.teal};font-size:13px">See all alerts</a></td></tr>
</table>
<p style="color:${C.muted};font-size:12px;margin:12px 0 0">Sent when a project's hearing or vote is postponed, or its case looks continued on an agenda or in minutes.</p>
</td></tr></table></body></html>`;

  if (url.searchParams.get("preview")) return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });

  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("DIGEST_FROM");
  const to = (url.searchParams.get("to") ?? Deno.env.get("DIGEST_TO") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const missing = [!key && "RESEND_API_KEY", !from && "DIGEST_FROM", !to.length && "DIGEST_TO"].filter(Boolean);
  if (missing.length) return new Response(`Missing secret: ${missing.join(", ")}`, { status: 500 });

  const subject = rows.length === 1 ? rows[0].title : `${rows.length} project timeline alerts: ${rows[0].title}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  const out = await res.json().catch(() => ({}));
  await db.from("digest_log").insert({
    kind: "project_alert", recipients: to.join(", "), resend_id: out?.id ?? null,
    error: res.ok ? null : JSON.stringify(out).slice(0, 1000),
  });
  // A test send (?to=) leaves the alerts for the real list.
  if (res.ok && !url.searchParams.get("to")) {
    await db.from("project_alerts").update({ emailed_at: new Date().toISOString() }).in("id", rows.map((a) => a.id));
  }
  return Response.json({ emailed: res.ok ? rows.length : 0, error: res.ok ? undefined : out }, { status: res.ok ? 200 : 502 });
});
