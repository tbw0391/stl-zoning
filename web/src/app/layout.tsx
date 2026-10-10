import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Entitlement Tracker",
  description: "St. Charles County rezoning processes, meeting calendar and contacts",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body>
        {user && (
          <header className="topbar">
            <Link href="/" className="brand">Entitlement Tracker</Link>
            <nav>
              <Link href="/">Calendar</Link>
              <Link href="/jurisdictions">Jurisdictions</Link>
              <Link href="/directory">Directory</Link>
            </nav>
            <form action="/auth/signout" method="post" className="signout">
              <span className="muted small">{user.email}</span>
              <button type="submit" className="link">Sign out</button>
            </form>
          </header>
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}
