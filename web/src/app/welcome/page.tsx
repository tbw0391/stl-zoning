import type { Metadata } from "next";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendar, faFileLines, faThumbsUp, faBell, faClock, faEnvelope } from "@fortawesome/free-regular-svg-icons";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT } from "@/lib/demoPaths";

export const metadata: Metadata = {
  title: `${PRODUCT}: every zoning meeting in your market`,
  description: "Planning commission and council meetings, agendas, rezonings and votes for every city, township and county in your market, collected and read for you.",
};
export const revalidate = 3600;

const WHAT = [
  { icon: faCalendar, title: "One meeting calendar", body: "Every planning commission and council meeting in your market, with submittal deadlines, on one calendar you can subscribe to from Outlook or Google." },
  { icon: faFileLines, title: "Agendas read for you", body: "New agendas are read as soon as they're posted. Rezonings, PUDs, annexations and special uses are pulled out with the address, applicant and acreage." },
  { icon: faThumbsUp, title: "How each board voted", body: "Minutes are read for the outcome of each land-use case: approved, denied, tabled or continued." },
  { icon: faBell, title: "Alerts near your sites", body: "Pick a site and a radius, or a whole city. When a case lands there, it shows up in your alerts and your weekly email." },
  { icon: faClock, title: "Project timelines", body: "Enter a project's municipality and case number to see the hearing and council dates it's headed for, and what happens when it's continued." },
  { icon: faEnvelope, title: "Monday email", body: "A weekly summary of what's coming up, what was approved and what changed, sent to your whole team." },
];

export default async function Welcome() {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const [{ count: places }, { count: meetings }, { count: agendas }] = await Promise.all([
    supabase.from("jurisdictions").select("id", { count: "exact", head: true }).not("collector", "is", null),
    supabase.from("meetings").select("id", { count: "exact", head: true }).gte("event_date", `${year}-01-01`).eq("event_type", "meeting"),
    supabase.from("meetings").select("id", { count: "exact", head: true }).not("agenda_read_at", "is", null),
  ]);
  const n = (x: number | null) => (x ?? 0).toLocaleString("en-US");

  return (
    <>
      <section className="hero">
        <h1>Every zoning meeting in your market, read for you.</h1>
        <p className="hero-sub">
          {PRODUCT} collects meeting schedules and agendas from every city, township and county you work in, pulls out the
          rezonings and land-use cases, and tells your team when something lands near your sites.
        </p>
        <div className="hero-actions">
          <a href="/demo" className="btn big">See the demo</a>
          <Link href="/signup" className="btn big secondary">Sign up</Link>
        </div>
        <p className="muted small">The demo is the real site with live Columbus, Ohio data. No sign-up needed.</p>
      </section>

      <section className="stats">
        <div><strong>{n(places)}</strong><span>cities, townships and counties collected daily</span></div>
        <div><strong>{n(meetings)}</strong><span>meetings on the calendar in {year}</span></div>
        <div><strong>{n(agendas)}</strong><span>agendas read so far</span></div>
      </section>

      <section>
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

      <section>
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

      <section className="cta card">
        <div>
          <h2>Try it on your market</h2>
          <p className="muted">Sign up with your email and the cities you work in. We&apos;ll set up your account and send you a sign-in code. No password.</p>
        </div>
        <Link href="/signup" className="btn big">Sign up</Link>
      </section>
    </>
  );
}
