import { headers } from "next/headers";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faApple, faGoogle, faMicrosoft } from "@fortawesome/free-brands-svg-icons";
import { faRss } from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/lib/supabase/server";
import { shortName, todayCentral } from "@/lib/format";
import CopyField from "@/components/CopyField";

export const dynamic = "force-dynamic";

export default async function SubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "stl-zoning.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const supabase = await createClient();
  const [{ data: js }, { data: covered }] = await Promise.all([
    supabase.from("jurisdictions").select("id, name").order("name"),
    supabase.from("meetings").select("jurisdiction_id").gte("event_date", todayCentral()),
  ]);
  const coveredIds = new Set((covered ?? []).map((c) => c.jurisdiction_id));

  const path = `${host}/calendar.ics${sp.j ? `?j=${encodeURIComponent(sp.j)}` : ""}`;
  const httpsUrl = `${proto}://${path}`;
  const webcalUrl = `webcal://${path}`;
  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;
  const outlookUrl = `https://outlook.office.com/calendar/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent("St. Charles Co. Entitlement Dates")}`;

  return (
    <>
      <h1 className="page-title"><span className="title-icon"><FontAwesomeIcon icon={faRss} /></span>Subscribe to the calendar</h1>
      <p className="muted">
        Every P&amp;Z meeting, council meeting and submittal deadline shows up in your own calendar as a separate calendar you can turn on or off.
        It updates on its own when dates change here. Submittal deadlines come with a reminder 3 days ahead.
      </p>

      <form className="filters" method="get">
        <label>Which jurisdictions?
          <select name="j" defaultValue={sp.j ?? ""}>
            <option value="">All of them</option>
            {(js ?? []).filter((j) => coveredIds.has(j.id)).map((j) => (
              <option key={j.id} value={j.id}>{shortName(j.name)} only</option>
            ))}
          </select>
        </label>
        <button type="submit">Update link</button>
      </form>

      <div className="sub-grid">
        <div className="card sub-card">
          <h2><FontAwesomeIcon icon={faMicrosoft} /> Outlook</h2>
          <p><a className="btn" href={outlookUrl} target="_blank" rel="noreferrer">Add to Outlook (web / Microsoft 365)</a></p>
          <p className="small muted">Desktop Outlook: Home tab → <strong>Add Calendar</strong> → <strong>From Internet…</strong> → paste the link below.
            On a Mac: File → New Calendar Subscription → paste the link.</p>
        </div>
        <div className="card sub-card">
          <h2><FontAwesomeIcon icon={faGoogle} /> Google Calendar</h2>
          <p><a className="btn" href={googleUrl} target="_blank" rel="noreferrer">Add to Google Calendar</a></p>
          <p className="small muted">Or: Google Calendar → <strong>Other calendars +</strong> → <strong>From URL</strong> → paste the link below.
            Google refreshes subscribed calendars every 12–24 hours.</p>
        </div>
        <div className="card sub-card">
          <h2><FontAwesomeIcon icon={faApple} /> iPhone / Mac</h2>
          <p><a className="btn" href={webcalUrl}>Subscribe on this device</a></p>
          <p className="small muted">Open this page on your iPhone and tap the button. Or: Settings → Calendar → Accounts → Add Account → Other →
            <strong> Add Subscribed Calendar</strong> → paste the link below.</p>
        </div>
      </div>

      <h2>Calendar link</h2>
      <CopyField value={httpsUrl} />
      <p className="small muted">Anyone with this link can see the dates, which are all public meeting info. Phone and desktop alerts come from your calendar app&apos;s normal reminders.</p>
    </>
  );
}
