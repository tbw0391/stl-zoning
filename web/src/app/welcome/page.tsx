import type { Metadata } from "next";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendar, faFileLines, faThumbsUp, faBell, faClock, faEnvelope } from "@fortawesome/free-regular-svg-icons";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT } from "@/lib/demoPaths";
import { ITEM_TYPE_LABEL, type AgendaItem } from "@/components/MeetingSummary";

// The front page: rezonethis.com shows it at /, and it's /welcome on the app itself.
export const metadata: Metadata = {
  title: `${PRODUCT}: every zoning meeting in your market`,
  description: "Planning commission and council meetings, agendas, rezonings and votes for every city, township and county in your market, collected and read for you.",
};
export const revalidate = 3600;

const STEPS = [
  { title: "We find every meeting", body: "Planning commission, zoning board and council schedules for every city, township and county you work in, checked every day." },
  { title: "We read every agenda", body: "As soon as an agenda or packet is posted, the land-use cases are pulled out: address, applicant, acreage, current and requested zoning." },
  { title: "You hear what matters", body: "Cases near your sites, hearings for your own projects, and how each board voted, in your alerts and a Monday email." },
];

const WHAT = [
  { icon: faCalendar, title: "One meeting calendar", body: "Every planning commission and council meeting in your market, with submittal deadlines, on one calendar you can subscribe to from Outlook or Google." },
  { icon: faFileLines, title: "Agendas read for you", body: "Rezonings, PUDs, annexations, plats and special uses, pulled out of agendas and packets with the details you'd otherwise dig for." },
  { icon: faThumbsUp, title: "How each board voted", body: "Minutes are read for the outcome of each land-use case: approved, denied, tabled or continued." },
  { icon: faBell, title: "Alerts near your sites", body: "Pick a site and a radius, or a whole city. When a case lands there, or an agenda is posted where you have a project, you hear about it." },
  { icon: faClock, title: "Project timelines", body: "Enter a project's municipality to see the hearing and council dates it's headed for, and what happens when it's continued." },
  { icon: faEnvelope, title: "Monday email", body: "A weekly summary of what's coming up, what was approved and what changed, sent to your whole team." },
];

const WHO = [
  { title: "Homebuilders", body: "Know what's being proposed next to your communities and where the next approvals are coming from." },
  { title: "Land acquisition", body: "Spot rezonings and annexations early, and see how each board treats similar requests before you go under contract." },
  { title: "Developers and their teams", body: "Track your own cases through P&Z and council, with deadlines, without refreshing a dozen city websites." },
  { title: "Brokers, engineers and attorneys", body: "Follow the cases your clients care about across every jurisdiction you practice in." },
];

const FAQ = [
  { q: "Where does the information come from?", a: "Straight from each city's, township's and county's own posted schedules, agendas, packets and minutes. Every item links back to the original document." },
  { q: "How quickly do new agendas show up?", a: "Schedules are checked every day, and agendas are usually read within an hour of being posted." },
  { q: "What if my market isn't listed?", a: "Tell us when you sign up. Most local governments post to a handful of agenda systems, so new markets come online quickly." },
  { q: "Is there a password to remember?", a: "No. You sign in with a one-time code texted to your phone." },
  { q: "Can my whole team use it?", a: "Yes. Your team shares one account: the same cities, projects and alerts, and everyone gets the Monday email." },
];

const SHOWN_TYPES = ["rezoning", "pud", "annexation", "special_use", "preliminary_plat"];

type FeedMeeting = { id: number; event_date: string; agenda_items: AgendaItem[]; jurisdictions: { name: string } | null };

const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function Welcome() {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const [{ count: places }, { count: meetings }, { count: agendas }, { data: recent }] = await Promise.all([
    supabase.from("jurisdictions").select("id", { count: "exact", head: true }).not("collector", "is", null),
    supabase.from("meetings").select("id", { count: "exact", head: true }).gte("event_date", `${year}-01-01`).eq("event_type", "meeting"),
    supabase.from("meetings").select("id", { count: "exact", head: true }).not("agenda_read_at", "is", null),
    // The sample feed shows Ohio only, the market the public demo covers.
    supabase.from("meetings").select("id, event_date, agenda_items, jurisdictions!inner(name)")
      .eq("jurisdictions.state", "OH").not("agenda_items", "is", null).not("agenda_read_at", "is", null)
      .order("agenda_read_at", { ascending: false }).limit(15),
  ]);
  const n = (x: number | null) => (x ?? 0).toLocaleString("en-US");
  const feed = ((recent ?? []) as unknown as FeedMeeting[])
    .flatMap((m) => (m.agenda_items ?? []).filter((it) => it.type && SHOWN_TYPES.includes(it.type)).slice(0, 1).map((it) => ({ m, it })))
    .slice(0, 4);

  return (
    <div className="lp">
      <section className="lp-hero">
        <div>
          <p className="lp-kicker">Zoning intelligence for land and homebuilding teams</p>
          <h1>Every zoning meeting in your market, read for you.</h1>
          <p className="hero-sub">
            {PRODUCT} collects meeting schedules and agendas from every city, township and county you work in, pulls out the
            rezonings and land-use cases, and tells your team when something lands near your sites.
          </p>
          <div className="hero-actions">
            <a href="/demo" className="btn big">See the live demo</a>
            <Link href="/signup" className="btn big secondary">Sign up</Link>
          </div>
          <p className="muted small">The demo is the real software with live Columbus, Ohio data. No sign-up needed.</p>
        </div>

        {feed.length > 0 && (
          <div className="lp-feed card" aria-label="Recently read from agendas">
            <div className="lp-feed-head"><span className="lp-live" /> Just read from posted agendas</div>
            <ul className="plain">
              {feed.map(({ m, it }) => (
                <li key={m.id}>
                  <div className="lp-feed-meta">
                    <span className="tag pz">{ITEM_TYPE_LABEL[it.type!] ?? it.type}</span>
                    <span>{m.jurisdictions?.name} · {shortDate(m.event_date)}</span>
                  </div>
                  <div className="lp-feed-item">{it.address || it.item}</div>
                  <div className="muted small">
                    {[it.from_zoning && it.to_zoning ? `${it.from_zoning} → ${it.to_zoning}` : null,
                      it.acres ? `${it.acres} acres` : null, it.applicant].filter(Boolean).join(" · ") || it.request}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="stats">
        <div><strong>{n(places)}</strong><span>cities, townships and counties checked daily</span></div>
        <div><strong>{n(meetings)}</strong><span>meetings on the calendar in {year}</span></div>
        <div><strong>{n(agendas)}</strong><span>agendas read so far</span></div>
      </section>

      <section className="lp-section">
        <h2>How it works</h2>
        <ol className="lp-steps">
          {STEPS.map((s) => (
            <li key={s.title} className="card"><h3>{s.title}</h3><p>{s.body}</p></li>
          ))}
        </ol>
      </section>

      <section className="lp-section">
        <h2>What you get</h2>
        <div className="what-grid">
          {WHAT.map((w) => (
            <div key={w.title} className="card">
              <h3><FontAwesomeIcon icon={w.icon} fixedWidth /> {w.title}</h3>
              <p>{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <h2>Who it&apos;s for</h2>
        <div className="lp-who">
          {WHO.map((w) => (
            <div key={w.title}><h3>{w.title}</h3><p className="muted">{w.body}</p></div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <h2>Where it works today</h2>
        <div className="what-grid">
          <div className="card">
            <h3>Columbus, Ohio area</h3>
            <p>Columbus, Dublin, Hilliard, Upper Arlington, Worthington, New Albany, Gahanna, Grove City, Delaware, Newark, Lancaster, Marysville and more, plus townships and the Delaware County Regional Planning Commission.</p>
          </div>
          <div className="card">
            <h3>St. Louis, Missouri area</h3>
            <p>St. Charles, St. Louis and Jefferson counties: Chesterfield, Wildwood, St. Peters, Lake Saint Louis, Ballwin, Eureka, Festus and more, plus unincorporated St. Charles and Jefferson counties.</p>
          </div>
          <div className="card">
            <h3>Somewhere else?</h3>
            <p>Tell us your market when you sign up. Most cities post to a handful of agenda systems, so new markets come online quickly.</p>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <h2>Questions</h2>
        <div className="lp-faq">
          {FAQ.map((f) => (
            <details key={f.q} className="card"><summary>{f.q}</summary><p>{f.a}</p></details>
          ))}
        </div>
      </section>

      <section className="cta card">
        <div>
          <h2>Try it on your market</h2>
          <p className="muted">Sign up with your email and the cities you work in. We&apos;ll set up your account and text you a sign-in code. No password.</p>
        </div>
        <Link href="/signup" className="btn big">Sign up</Link>
      </section>
    </div>
  );
}
