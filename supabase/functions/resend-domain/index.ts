// One-off setup helper: adds a sending domain to the Resend account (with the RESEND_API_KEY secret the digest uses),
// shows the DNS records Resend wants, and asks Resend to check them. Guarded by app_settings digest_token.
//   POST ?action=add&domain=rezonethis.com | ?action=get&id=<id> | ?action=verify&id=<id>
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: tok } = await db.from("app_settings").select("value").eq("key", "digest_token").single();
  if (!tok?.value || req.headers.get("x-digest-token") !== tok.value) return new Response("Not found", { status: 404 });

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return new Response("Missing RESEND_API_KEY", { status: 500 });
  const call = (path: string, method = "GET", body?: unknown) =>
    fetch(`https://api.resend.com${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

  const action = url.searchParams.get("action");
  const id = url.searchParams.get("id") ?? "";
  const res = action === "add" ? await call("/domains", "POST", { name: url.searchParams.get("domain") })
    : action === "get" ? await call(`/domains/${id}`)
    : action === "verify" ? await call(`/domains/${id}/verify`, "POST")
    : action === "list" ? await call("/domains")
    : null;
  if (!res) return new Response("Unknown action", { status: 400 });
  return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
});
