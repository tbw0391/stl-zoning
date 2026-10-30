// Weekly email digest: the next two weeks of dates, overdue tasks, and what changed in the last 7 days.
// Sent through Resend to a distribution list. Triggered Mondays by pg_cron (see the change_log_and_digest migration).
//
// Secrets (Supabase dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY  Resend API key
//   DIGEST_TO       recipient(s), comma-separated, e.g. the company distribution list
//   DIGEST_FROM     sender on a domain verified in Resend, e.g. "Entitlement Tracker <tracker@example.com>"
//   SITE_URL        optional, defaults to https://app.rezonethis.com
//
// Requests need the x-digest-token header (value in public.app_settings). Add ?preview=1 to get the
// HTML back without sending, or ?to=someone@example.com to send a test to one address instead of the list.
// Deployed with verify_jwt off; the token guards access.
import { createClient } from "jsr:@supabase/supabase-js@2";

const TZ = "America/Chicago";
const SITE = (Deno.env.get("SITE_URL") ?? "https://app.rezonethis.com").replace(/\/$/, "");

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const todayCentral = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const addDays = (d: string, n: number) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const fmtDate = (d: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(d + "T00:00:00Z"));
const fmtTime = (t: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "AM" : "PM"}`;
};
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const shortName = (n: string) => n.replace(/^(City|Town|Village) of /, "");

const STAGE: Record<string, string> = {
  oyl: "OYL", prospect: "Prospect", loi: "LOI", diligence: "Diligence", development: "Development", closed: "Closed",
};

const C = { teal: "#096764", amber: "#ffb549", orange: "#c4502a", green: "#2d6a3e", text: "#1d2a28", muted: "#5f6b67", border: "#e3e1da", bg: "#f6f5f1" };
const pill = (text: string, color: string) =>
  `<span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:.03em;padding:2px 8px;border-radius:99px;background:${color}1a;color:${color};white-space:nowrap">${esc(text)}</span>`;
const section = (title: string, body: string) =>
  `<tr><td style="padding:20px 24px 4px"><h2 style="margin:0 0 10px;font-size:16px;color:${C.text};border-bottom:2px solid ${C.amber};display:inline-block;padding-bottom:4px">${esc(title)}</h2>${body}</td></tr>`;
const list = (items: string[], empty: string) =>
  items.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${items.join("")}</table>`
    : `<p style="margin:0;color:${C.muted};font-size:14px">${esc(empty)}</p>`;
const li = (left: string, right: string) =>
  `<tr><td style="padding:6px 10px 6px 0;vertical-align:top;white-space:nowrap;font-size:13px;color:${C.muted};width:92px">${left}</td><td style="padding:6px 0;font-size:14px;color:${C.text};border-bottom:1px solid ${C.border}">${right}</td></tr>`;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: tok } = await db.from("app_settings").select("value").eq("key", "digest_token").single();
  if (!tok || req.headers.get("x-digest-token") !== tok.value) return new Response("Not found", { status: 404 });

  const today = todayCentral();
  const horizon = addDays(today, 14);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const [{ data: js }, { data: meetings }, { data: tasks }, { data: changes }, { data: projects }, { data: sources }, { data: timeline }] = await Promise.all([
    // The digest goes to Lombardo, so Missouri only (other states are collected for the public product).
    db.from("jurisdictions").select("id, name, governing_body, followed, state"),
    db.from("meetings").select("*, jurisdictions!inner(followed, state)").eq("jurisdictions.followed", true).eq("jurisdictions.state", "MO").gte("event_date", today).lte("event_date", horizon).neq("status", "cancelled")
      .order("event_date").order("event_time"),
    db.from("tasks").select("id, title, assigned_to, due_date, project_id").is("done_at", null)
      .not("due_date", "is", null).lte("due_date", horizon).order("due_date"),
    db.from("change_log").select("*").gte("at", weekAgo).order("at"),
    db.from("projects").select("id, name"),
    // Same rule as needsReview in web/src/app/sources/review.ts; check-sources runs an hour before this.
    db.from("source_watches").select("jurisdiction_id, url, label, last_status, last_changed_at, change_summary, reviewed_at, jurisdictions!inner(followed, state)")
      .eq("jurisdictions.followed", true).eq("jurisdictions.state", "MO").not("last_changed_at", "is", null).order("jurisdiction_id"),
    // Logged delays and possible delays from agendas/minutes (each was also emailed when posted, by project-alerts).
    db.from("project_alerts").select("project_id, kind, title, body, created_at").in("kind", ["delay", "possible_delay"])
      .gte("created_at", weekAgo).order("created_at"),
  ]);
  const jmap = new Map((js ?? []).map((j: Row) => [j.id, j]));
  const pmap = new Map((projects ?? []).map((p: Row) => [p.id, p.name]));
  const place = (id: string) => esc(shortName(jmap.get(id)?.name ?? id));
  const gov = (id: string) => (jmap.get(id)?.governing_body ?? "Council").replace(/\s*\(.*\)$/, "");
  const link = (path: string, text: string) => `<a href="${SITE}${path}" style="color:${C.teal};text-decoration:none;font-weight:600">${text}</a>`;

  // ---- Coming up (next 14 days)
  const deadlines = (meetings ?? []).filter((m: Row) => m.event_type === "submittal_deadline");
  const hearings = (meetings ?? []).filter((m: Row) => m.event_type === "meeting");
  const meetingLine = (m: Row) => {
    const kind = m.body === "planning_zoning" ? pill("P&Z", C.teal) : pill(gov(m.jurisdiction_id).toUpperCase(), C.green);
    const tentative = m.status === "projected" ? ` ${pill("tentative", "#8a5a00")}` : "";
    return li(fmtDate(m.event_date), `${kind} ${link(`/jurisdictions/${m.jurisdiction_id}`, place(m.jurisdiction_id))}${m.event_time ? ` · ${fmtTime(m.event_time)}` : ""}${tentative}`);
  };
  const deadlineLine = (m: Row) =>
    li(fmtDate(m.event_date), `${pill("SUBMITTAL DUE", C.orange)} ${link(`/jurisdictions/${m.jurisdiction_id}`, place(m.jurisdiction_id))}${m.event_time ? ` by ${fmtTime(m.event_time)}` : ""}`);

  const overdue = (tasks ?? []).filter((t: Row) => t.due_date < today);
  const dueSoon = (tasks ?? []).filter((t: Row) => t.due_date >= today);
  const taskLine = (t: Row) =>
    li(fmtDate(t.due_date), `${esc(t.title)} <span style="color:${C.muted}">— ${esc(t.assigned_to ?? "Unassigned")}${t.project_id ? ` · ${esc(pmap.get(t.project_id) ?? "")}` : ""}</span>`);

  // ---- What changed (last 7 days)
  const changeLines: string[] = [];
  const newDates = new Map<string, number>();
  for (const c of (changes ?? []) as Row[]) {
    const o = c.old_row ?? {}, n = c.new_row ?? {};
    const when = fmtDate(new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(c.at)));
    if (c.table_name === "meetings") {
      const r = c.action === "delete" ? o : n;
      if (jmap.get(r.jurisdiction_id)?.followed === false || (jmap.get(r.jurisdiction_id)?.state ?? "MO") !== "MO") continue;
      const what = r.event_type === "submittal_deadline" ? "submittal deadline" : r.body === "planning_zoning" ? "P&Z meeting" : gov(r.jurisdiction_id);
      if (c.action === "insert") { newDates.set(r.jurisdiction_id, (newDates.get(r.jurisdiction_id) ?? 0) + 1); continue; }
      if (c.action === "delete") { changeLines.push(li(when, `${pill("REMOVED", C.orange)} ${place(r.jurisdiction_id)} ${esc(what)} on ${fmtDate(r.event_date)}`)); continue; }
      if (n.status === "cancelled" && o.status !== "cancelled") {
        changeLines.push(li(when, `${pill("CANCELLED", C.orange)} ${place(n.jurisdiction_id)} ${esc(what)} on ${fmtDate(n.event_date)}`));
      } else if (o.event_date !== n.event_date || o.event_time !== n.event_time) {
        changeLines.push(li(when, `${pill("MOVED", "#8a5a00")} ${place(n.jurisdiction_id)} ${esc(what)}: ${fmtDate(o.event_date)} ${fmtTime(o.event_time)} → <strong>${fmtDate(n.event_date)} ${fmtTime(n.event_time)}</strong>`));
      } else if (o.status === "projected" && n.status === "published") {
        changeLines.push(li(when, `${pill("CONFIRMED", C.green)} ${place(n.jurisdiction_id)} ${esc(what)} on ${fmtDate(n.event_date)}`));
      } else if (o.location !== n.location) {
        changeLines.push(li(when, `${pill("NEW LOCATION", "#8a5a00")} ${place(n.jurisdiction_id)} ${esc(what)} on ${fmtDate(n.event_date)}: ${esc(n.location)}`));
      }
    } else if (c.table_name === "projects") {
      if (c.action === "insert") changeLines.push(li(when, `${pill("NEW PROJECT", C.teal)} ${link(`/projects/${n.id}`, esc(n.name))}`));
      else if (c.action === "update" && o.stage !== n.stage)
        changeLines.push(li(when, `${pill("STAGE", C.teal)} ${link(`/projects/${n.id}`, esc(n.name))}: ${esc(STAGE[o.stage] ?? o.stage)} → <strong>${esc(STAGE[n.stage] ?? n.stage)}</strong>`));
    } else if (c.table_name === "tasks") {
      if (c.action === "insert") changeLines.push(li(when, `${pill("NEW TASK", "#9a5a00")} ${esc(n.title)} <span style="color:${C.muted}">— ${esc(n.assigned_to ?? "Unassigned")}</span>`));
      else if (c.action === "update" && !o.done_at && n.done_at) changeLines.push(li(when, `${pill("DONE", C.green)} ${esc(n.title)}`));
    }
  }
  for (const [jid, count] of newDates) {
    changeLines.unshift(li("This week", `${pill("NEW DATES", C.teal)} ${count} date${count === 1 ? "" : "s"} added for ${link(`/jurisdictions/${jid}`, place(jid))}`));
  }

  // ---- Project timeline changes (last 7 days)
  const timelineLines = ((timeline ?? []) as Row[]).map((a) =>
    li(fmtDate(new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(a.created_at))),
      `${a.kind === "delay" ? pill("DELAY", C.orange) : pill("POSSIBLE DELAY", "#8a5a00")} ${link(`/projects/${a.project_id}`, esc(a.title))}` +
      (a.body ? `<div style="color:${C.muted};font-size:13px;margin-top:2px">${esc(a.body)}</div>` : "")));

  // ---- Schedule sources that changed and nobody has marked reviewed on /sources
  const toReview = ((sources ?? []) as Row[]).filter((w) => !w.reviewed_at || w.reviewed_at < w.last_changed_at);
  const sourceLines = toReview.map((w) => {
    const when = fmtDate(new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(w.last_changed_at)));
    const status = w.last_status && w.last_status !== 200 ? ` ${pill(`HTTP ${w.last_status}`, C.orange)}` : "";
    return li(when, `${place(w.jurisdiction_id)}: <a href="${esc(w.url)}" style="color:${C.teal}">${esc(w.label ?? "source")}</a>${status}` +
      (w.change_summary ? ` <span style="color:${C.muted}">— ${esc(w.change_summary)}</span>` : ""));
  });

  const subject = `Entitlement dates: week of ${fmtDate(today)}` +
    (deadlines.length ? ` · ${deadlines.length} submittal deadline${deadlines.length === 1 ? "" : "s"}` : "");

  const html = `<!doctype html><html><body style="margin:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border:1px solid ${C.border};border-radius:12px;overflow:hidden">
<tr><td style="padding:18px 24px;border-bottom:3px solid ${C.amber}">
  <img src="${SITE}/lombardo-logo.png" alt="Lombardo Homes" width="142" height="40" style="vertical-align:middle">
  <span style="vertical-align:middle;margin-left:12px;padding-left:12px;border-left:1px solid ${C.border};color:#8f9a8e;font-weight:700;font-size:15px">Entitlement Tracker</span>
</td></tr>
<tr><td style="padding:20px 24px 0"><h1 style="margin:0;font-size:22px;color:${C.text}">Week of ${fmtDate(today)}</h1>
<p style="margin:6px 0 0;color:${C.muted};font-size:14px">${deadlines.length} submittal deadline${deadlines.length === 1 ? "" : "s"}, ${hearings.length} meeting${hearings.length === 1 ? "" : "s"} and ${dueSoon.length + overdue.length} open task${dueSoon.length + overdue.length === 1 ? "" : "s"} in the next two weeks.</p></td></tr>
${section("Submittal deadlines — next 2 weeks", list(deadlines.map(deadlineLine), "No submittal deadlines in the next two weeks."))}
${section("Meetings — next 2 weeks", list(hearings.map(meetingLine), "No meetings in the next two weeks."))}
${overdue.length ? section("Overdue tasks", list(overdue.map(taskLine), "")) : ""}
${section("Tasks due — next 2 weeks", list(dueSoon.map(taskLine), "No tasks due."))}
${timelineLines.length ? section("Project timeline changes", list(timelineLines, "")) : ""}
${section("What changed this week", list(changeLines, "No changes this week."))}
${sourceLines.length ? section(`Schedule sources to review (${sourceLines.length})`, list(sourceLines, "") +
  `<p style="margin:8px 0 0;font-size:13px">${link("/sources", "Review them on the Sources page")}</p>`) : ""}
<tr><td style="padding:24px">
  <a href="${SITE}/" style="display:inline-block;background:${C.teal};color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:7px;font-size:14px">Open the calendar</a>
  <a href="${SITE}/subscribe" style="margin-left:14px;color:${C.teal};font-size:13px">Add these dates to your calendar</a>
</td></tr>
</table>
<p style="color:${C.muted};font-size:12px;margin:12px 0 0">Sent every Monday by the Entitlement Tracker.</p>
</td></tr></table></body></html>`;

  if (url.searchParams.get("preview")) {
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("DIGEST_FROM");
  const to = (url.searchParams.get("to") ?? Deno.env.get("DIGEST_TO") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const missing = [!key && "RESEND_API_KEY", !from && "DIGEST_FROM", !to.length && "DIGEST_TO"].filter(Boolean);
  if (missing.length) {
    return new Response(`Missing secret: ${missing.join(", ")}`, { status: 500 });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  const out = await res.json().catch(() => ({}));
  await db.from("digest_log").insert({
    recipients: to.join(", "),
    resend_id: out?.id ?? null,
    error: res.ok ? null : JSON.stringify(out).slice(0, 1000),
  });
  return new Response(JSON.stringify({ ok: res.ok, id: out?.id, error: res.ok ? undefined : out }), {
    status: res.ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
});
