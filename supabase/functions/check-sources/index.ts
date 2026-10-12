// Weekly check of the schedule pages and PDFs in public.source_watches, for cities whose schedules we load by hand.
//
// Files (PDFs) are compared by hash. Pages are compared by their document links (a new 2027 schedule PDF, a
// removed agenda) and by a hash of their visible text. A change, or a URL that starts failing (404 after a site
// redesign, 403 from bot protection), sets last_changed_at and change_summary; /sources lists it until someone
// marks it reviewed. Every check is logged to source_checks.
//
// Requests need the x-digest-token header (shared cron token in public.app_settings). ?id=N checks one watch.
// Triggered Mondays by pg_cron (see the source_watches migration). Deployed with verify_jwt off.
import { createClient } from "jsr:@supabase/supabase-js@2";

const UA = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// Links to documents, as opposed to navigation: schedules, agendas, packets.
const DOC = /\.(pdf|docx?|xlsx?)(\?|#|$)|DocumentCenter\/View|showpublisheddocument|_files\/ugd\/|drive\.google\.com\/file|AgendaCenter\/ViewFile/i;

type Link = { url: string; text: string };

const sha256 = async (data: ArrayBuffer | string) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&nbsp;|&#160;/g, " ").replace(/&#8211;|&ndash;/g, "-")
  .replace(/&#039;|&#8217;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const clean = (s: string) => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

function readPage(html: string, base: string) {
  const body = html.replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, " ");
  const links = new Map<string, string>();
  for (const m of body.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: string;
    try { url = new URL(decode(m[1]), base).href; } catch { continue; }
    if (!DOC.test(url)) continue;
    const text = clean(m[2]) || (links.get(url) ?? "");
    links.set(url, links.get(url) || text);
  }
  return { text: clean(body), links: [...links].map(([url, text]) => ({ url, text })) };
}

const describe = (l: Link) => (l.text ? `${l.text.slice(0, 80)} (${l.url})` : l.url);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: tok } = await db.from("app_settings").select("value").eq("key", "digest_token").single();
  if (!tok || req.headers.get("x-digest-token") !== tok.value) return new Response("Not found", { status: 404 });

  let q = db.from("source_watches").select("*").order("id");
  const one = url.searchParams.get("id");
  if (one) q = q.eq("id", Number(one));
  const { data: watches, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  const results = [];
  for (const w of watches ?? []) {
    let status = 0, hash: string | null = null, links: Link[] | null = null, err = "";
    try {
      const res = await fetch(w.url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(30_000) });
      status = res.status;
      if (res.ok) {
        const type = res.headers.get("content-type") ?? "";
        if (type.includes("html")) {
          const page = readPage(await res.text(), res.url);
          hash = await sha256(page.text);
          links = page.links;
        } else {
          hash = await sha256(await res.arrayBuffer());
        }
      } else {
        await res.body?.cancel();
      }
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }

    const changes: string[] = [];
    if (status !== w.last_status) {
      if (status === 0) changes.push(`Couldn't be reached (${err || "no response"}).`);
      else if (status === 403 || status === 429) changes.push(`Blocked by the site (HTTP ${status}); check it by hand.`);
      else if (status === 404 || status === 410) changes.push(`Gone (HTTP ${status}); the city probably moved it. Find the new link.`);
      else if (status >= 400) changes.push(`Returns HTTP ${status}.`);
      else if (w.last_status) changes.push(`Back online (HTTP ${status}).`);
    }
    if (hash && w.last_hash) {
      if (links && w.last_links) {
        const before = new Set((w.last_links as Link[]).map((l) => l.url));
        const after = new Set(links.map((l) => l.url));
        const added = links.filter((l) => !before.has(l.url));
        const removed = (w.last_links as Link[]).filter((l) => !after.has(l.url));
        if (added.length) changes.push(`New documents: ${added.slice(0, 8).map(describe).join("; ")}${added.length > 8 ? ` and ${added.length - 8} more` : ""}.`);
        if (removed.length) changes.push(`Removed: ${removed.slice(0, 8).map(describe).join("; ")}${removed.length > 8 ? ` and ${removed.length - 8} more` : ""}.`);
        if (!added.length && !removed.length && hash !== w.last_hash) changes.push("Page text changed (no document links added or removed).");
      } else if (hash !== w.last_hash) {
        changes.push("The file changed. Compare it with the dates we loaded.");
      }
    }

    const now = new Date().toISOString();
    const changed = changes.length > 0;
    const summary = changes.join(" ");
    await db.from("source_watches").update({
      last_status: status || null,
      // Keep the last good copy through an outage, so the comparison picks up where it left off.
      ...(hash ? { last_hash: hash, last_links: links } : {}),
      last_checked_at: now,
      ...(changed ? { last_changed_at: now, change_summary: summary } : {}),
    }).eq("id", w.id);
    await db.from("source_checks").insert({
      jurisdiction_id: w.jurisdiction_id, watch_id: w.id, checked_url: w.url, checked_at: now,
      content_hash: hash, changed, summary: summary || null, http_status: status || null,
    });
    results.push({ id: w.id, jurisdiction_id: w.jurisdiction_id, status, changed, summary, links: links?.length ?? null });
  }
  return new Response(JSON.stringify(results, null, 2), { headers: { "Content-Type": "application/json" } });
});
