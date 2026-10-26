import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from "@fortawesome/free-regular-svg-icons";
import Nav from "@/components/Nav";
import SuggestButton from "@/components/SuggestButton";
import { createClient } from "@/lib/supabase/server";
import { newAlertCount } from "@/lib/cases";
import { unseenProjectAlerts } from "@/lib/projectAlerts";
import { dismissProjectAlerts } from "@/app/alerts/actions";
import { enabledFeatures, unseenFeatureCount } from "@/lib/features";
import FeaturesProvider from "@/components/FeaturesProvider";
import HistoryAsk from "@/components/HistoryAsk";
import StatePicker from "@/components/StatePicker";
import { STATES, currentState } from "@/lib/state";
import { headers } from "next/headers";
import HawkeyeMark from "@/components/HawkeyeMark";
import { isDemo } from "@/lib/demo";
import { DEMO_NAV, PRODUCT, isPublicPage } from "@/lib/demoPaths";
import "./globals.css";

config.autoAddCss = false;

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  if (await isDemo()) return { title: `${PRODUCT} demo`, description: "Zoning meetings, agendas and votes for the Columbus, Ohio area" };
  return { title: "Entitlement Tracker", description: "St. Charles County rezoning processes, meeting calendar and contacts" };
}

// The public pages (/welcome, /signup) get their own plain header, with nothing of Lombardo's.
function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.className}>
      <body className="public-body">
        <header className="public-top">
          <Link href="/welcome" className="public-brand"><HawkeyeMark /> {PRODUCT}</Link>
          <div className="public-top-actions">
            <Link href="/login">Sign in</Link>
            <a href="/demo">See the demo</a>
            <Link href="/signup" className="btn">Sign up</Link>
          </div>
        </header>
        <main className="public">{children}</main>
        <footer className="public-foot">{PRODUCT} · AGA Technologies</footer>
      </body>
    </html>
  );
}

// The open demo: the regular site limited to the public-data pages, read-only, under the public name.
async function DemoShell({ children, featuresOn }: { children: React.ReactNode; featuresOn: string[] }) {
  const { count } = await (await createClient()).from("jurisdictions").select("id", { count: "exact", head: true })
    .eq("state", "OH").not("collector", "is", null);
  return (
    <html lang="en" className={jakarta.className}>
      <body>
        <header className="topbar">
          <Link href="/" className="brand public-brand"><HawkeyeMark /> {PRODUCT}</Link>
          <Nav only={DEMO_NAV} />
          <div className="header-actions">
            <Link href="/signup" className="btn">Sign up</Link>
            <a href="/demo/exit" className="small">Exit demo</a>
          </div>
        </header>
        <div className="alert-banner demo-banner" role="status">
          <div>
            <strong>Demo.</strong> Live meetings, agendas and votes from {count ?? "the"} Columbus-area cities, townships and
            counties, collected every day. Changes are switched off.
          </div>
          <div className="alert-banner-actions"><Link href="/signup">Get it for your market</Link></div>
        </div>
        <main><FeaturesProvider on={featuresOn}>{children}</FeaturesProvider></main>
      </body>
    </html>
  );
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  if (isPublicPage((await headers()).get("x-pathname") ?? "")) return <PublicShell>{children}</PublicShell>;
  if (await isDemo()) return <DemoShell featuresOn={await enabledFeatures()}>{children}</DemoShell>;
  const supabase = await createClient();
  const [{ data: { user } }, alerts, projectAlerts, featuresOn, newFeatures, state] = await Promise.all([
    supabase.auth.getUser(),
    newAlertCount(supabase).catch(() => 0),
    unseenProjectAlerts(supabase).catch(() => []),
    enabledFeatures(),
    unseenFeatureCount(),
    currentState(),
  ]);
  return (
    <html lang="en" className={jakarta.className}>
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <Image src="/lombardo-logo.png" alt="Lombardo Homes" width={142} height={40} priority />
            <span className="brand-name">Entitlement Tracker</span>
          </Link>
          <Nav alerts={alerts + projectAlerts.length} features={featuresOn} />
          <div className="header-actions">
            {featuresOn.includes("state-picker") && <StatePicker states={STATES} current={state} />}
            <Link href="/features" className="suggest-btn">
              <FontAwesomeIcon icon={faStar} /> New features
              {newFeatures > 0 && <span className="badge">{newFeatures}</span>}
            </Link>
            <SuggestButton />
            {user && (
              <span className="account small">
                <Link href="/team" title="Who can sign in">{user.email ?? user.phone}</Link>
                <form action="/auth/signout" method="post"><button type="submit" className="link">Sign out</button></form>
              </span>
            )}
          </div>
        </header>
        {projectAlerts.length > 0 && (
          <div className="alert-banner" role="status">
            <ul className="plain">
              {projectAlerts.slice(0, 3).map((a) => (
                <li key={a.id}>
                  <strong><Link href={`/projects/${a.project_id}`}>{a.title}</Link></strong>
                  {a.body && <span> · {a.body}</span>}
                </li>
              ))}
            </ul>
            <div className="alert-banner-actions">
              {projectAlerts.length > 3 && <Link href="/alerts">{projectAlerts.length - 3} more</Link>}
              <form action={dismissProjectAlerts}><button type="submit" className="link">Dismiss</button></form>
            </div>
          </div>
        )}
        <HistoryAsk />
        <main><FeaturesProvider on={featuresOn}>{children}</FeaturesProvider></main>
      </body>
    </html>
  );
}
