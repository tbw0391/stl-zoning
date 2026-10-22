import { createClient } from "@supabase/supabase-js";
import { addDays, todayCentral } from "@/lib/format";
import { buildIcs, type FeedMeeting } from "@/lib/ics";

export const dynamic = "force-dynamic";

// Public calendar feed of followed jurisdictions in Missouri (or ?state=OH). Optional ?j=wentzville,cottleville limits it
// to certain jurisdictions.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  let q = db.from("meetings")
    .select("id, jurisdiction_id, body, event_type, event_date, event_time, location, note, status, source_url, jurisdictions!inner(name, governing_body, time_zone)")
    .gte("event_date", addDays(todayCentral(), -60))
    .order("event_date");
  const only = url.searchParams.get("j");
  const state = /^[A-Z]{2}$/.test(url.searchParams.get("state") ?? "") ? url.searchParams.get("state")! : "MO";
  q = only ? q.in("jurisdiction_id", only.split(",").map((s) => s.trim())) : q.eq("jurisdictions.followed", true).eq("jurisdictions.state", state);
  const { data, error } = await q;
  if (error) return new Response("Error loading meetings", { status: 500 });

  return new Response(buildIcs((data ?? []) as unknown as FeedMeeting[], state === "MO" ? undefined : "Columbus Area Entitlement Dates"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="entitlement-dates.ics"',
      "Cache-Control": "public, max-age=900",
    },
  });
}
