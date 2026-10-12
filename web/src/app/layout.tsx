import type { Metadata } from "next";
import Link from "next/link";
import SuggestButton from "@/components/SuggestButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "Entitlement Tracker",
  description: "St. Charles County rezoning processes, meeting calendar and contacts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">Entitlement Tracker</Link>
          <nav>
            <Link href="/">Calendar</Link>
            <Link href="/projects">Projects</Link>
            <Link href="/tasks">Tasks</Link>
            <Link href="/chad">Chad&apos;s tasks</Link>
            <Link href="/meetings">Meetings</Link>
            <Link href="/jurisdictions">Jurisdictions</Link>
            <Link href="/progress">Progress</Link>
            <Link href="/directory">Directory</Link>
            <Link href="/todo">Suggestions</Link>
          </nav>
          <SuggestButton />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
