// Team list for /team: list, add and remove the people who can sign in. Called by the web app's server actions with the
// signed-in user's access token; only someone already on the team (public.team_members) may use it. Adding creates the
// Supabase Auth user (email and/or mobile, both pre-confirmed so a one-time code works right away) and the team row.
// Deployed with verify_jwt off; the token is checked here instead.
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// "(314) 555-0100" → "+13145550100"
function e164(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return input.trim().startsWith("+") && digits.length > 10 ? `+${digits}` : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Not found", { status: 404 });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user: me } } = await admin.auth.getUser(jwt);
  if (!me) return json({ error: "Sign in first." }, 401);
  const { data: mine } = await admin.from("team_members").select("company").eq("user_id", me.id).maybeSingle();
  if (!mine) return json({ error: "You're not on the team list." }, 403);

  const b = await req.json().catch(() => ({}));

  if (b.action === "list") {
    const [{ data: rows }, { data: users, error }] = await Promise.all([
      admin.from("team_members").select("user_id, added_at").eq("company", mine.company),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ]);
    if (error) return json({ error: error.message }, 500);
    const byId = new Map(users.users.map((u) => [u.id, u]));
    return json({
      me: me.id,
      members: (rows ?? []).map((r) => {
        const u = byId.get(r.user_id);
        return { id: r.user_id, email: u?.email ?? null, phone: u?.phone ? `+${u.phone.replace(/^\+/, "")}` : null,
          added_at: r.added_at, last_sign_in_at: u?.last_sign_in_at ?? null };
      }),
    });
  }

  if (b.action === "add") {
    const email = String(b.email ?? "").trim().toLowerCase() || null;
    const phoneIn = String(b.phone ?? "").trim();
    const phone = phoneIn ? e164(phoneIn) : null;
    if (phoneIn && !phone) return json({ error: "Enter the mobile number as 10 digits, e.g. 314-555-0100." }, 400);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "That email doesn't look right." }, 400);
    if (!email && !phone) return json({ error: "Enter an email, a mobile number, or both." }, 400);

    // Someone who already has an account (matched by email) gets the phone added and joins the team.
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = email ? list?.users.find((u) => u.email?.toLowerCase() === email) : null;
    let userId: string;
    if (existing) {
      if (phone) {
        const { error } = await admin.auth.admin.updateUserById(existing.id, { phone, phone_confirm: true });
        if (error) return json({ error: error.message }, 400);
      }
      userId = existing.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        ...(email ? { email, email_confirm: true } : {}),
        ...(phone ? { phone, phone_confirm: true } : {}),
      });
      if (error) return json({ error: /already/i.test(error.message) ? "That email or number already has an account." : error.message }, 400);
      userId = data.user.id;
    }
    const { error } = await admin.from("team_members").upsert({ user_id: userId, company: mine.company });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (b.action === "remove") {
    const id = String(b.id ?? "");
    if (id === me.id) return json({ error: "You can't remove yourself." }, 400);
    // Off the team list only; the login itself stays (it can't see anything without the team row).
    const { error } = await admin.from("team_members").delete().eq("user_id", id).eq("company", mine.company);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: "Unknown action." }, 400);
});
