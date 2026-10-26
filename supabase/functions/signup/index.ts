// Public sign-up form (web/src/app/signup): saves the request to public.signups and emails AGA about it.
// No account is created yet; that comes with sign-in by email or text code.
// Deployed with verify_jwt off (the form is public). Secrets: RESEND_API_KEY, DIGEST_FROM (shared with weekly-digest).
// The notice goes to app_settings 'signup_notify_to' (comma-separated); without it, sign-ups are only saved.
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const clean = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Not found", { status: 404 });
  const b = await req.json().catch(() => ({}));
  // Honeypot: people leave it empty, bots fill it. Pretend it worked.
  if (clean(b.website)) return json({ ok: true });

  const row = {
    name: clean(b.name), company: clean(b.company), email: clean(b.email).toLowerCase(),
    phone: clean(b.phone, 40) || null, state: clean(b.state, 20) || null, area: clean(b.area, 500) || null,
    role: clean(b.role, 60) || null, note: clean(b.note, 2000) || null,
  };
  if (!row.name || !row.company || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    return json({ ok: false, error: "Name, company and a valid email are needed." }, 400);
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // A repeat from the same email within a day is taken as the same request.
  const { data: recent } = await db.from("signups").select("id").eq("email", row.email)
    .gte("created_at", new Date(Date.now() - 864e5).toISOString()).limit(1);
  if (recent?.length) return json({ ok: true });
  const { data: saved, error } = await db.from("signups").insert(row).select("id").single();
  if (error) return json({ ok: false, error: "That didn't save. Try again in a minute." }, 500);

  const { data: setting } = await db.from("app_settings").select("value").eq("key", "signup_notify_to").maybeSingle();
  const to = String(setting?.value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("DIGEST_FROM");
  if (to.length && key && from) {
    const lines: [string, string | null][] = [
      ["Name", row.name], ["Company", row.company], ["Email", row.email], ["Phone", row.phone],
      ["State", row.state], ["Works in", row.area], ["Role", row.role], ["Note", row.note],
    ];
    const html = `<p>New sign-up on the public site:</p><table cellpadding="4">${
      lines.filter(([, v]) => v).map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v!)}</td></tr>`).join("")
    }</table>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, reply_to: row.email, subject: `New sign-up: ${row.name}, ${row.company}`, html }),
    });
    if (res.ok) await db.from("signups").update({ notified_at: new Date().toISOString() }).eq("id", saved.id);
  }
  return json({ ok: true });
});
