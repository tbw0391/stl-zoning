import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import Nav from "@/components/Nav";
import SuggestButton from "@/components/SuggestButton";
import { createClient } from "@/lib/supabase/server";
import { newAlertCount } from "@/lib/cases";
import { unseenProjectAlerts } from "@/lib/projectAlerts";
import { dismissProjectAlerts } from "@/app/alerts/actions";
import "./globals.css";

config.autoAddCss = false;

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Entitlement Tracker",
  description: "St. Charles County rezoning processes, meeting calendar and contacts",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [alerts, projectAlerts] = await Promise.all([
    newAlertCount(supabase).catch(() => 0),
    unseenProjectAlerts(supabase).catch(() => []),
  ]);
  return (
    <html lang="en" className={jakarta.className}>
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <Image src="/lombardo-logo.png" alt="Lombardo Homes" width={142} height={40} priority />
            <span className="brand-name">Entitlement Tracker</span>
          </Link>
          <Nav alerts={alerts + projectAlerts.length} />
          <SuggestButton />
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
        <main>{children}</main>
      </body>
    </html>
  );
}
