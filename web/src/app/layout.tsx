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
import "./globals.css";

config.autoAddCss = false;

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Entitlement Tracker",
  description: "St. Charles County rezoning processes, meeting calendar and contacts",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const alerts = await newAlertCount(await createClient()).catch(() => 0);
  return (
    <html lang="en" className={jakarta.className}>
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <Image src="/lombardo-logo.png" alt="Lombardo Homes" width={142} height={40} priority />
            <span className="brand-name">Entitlement Tracker</span>
          </Link>
          <Nav alerts={alerts} />
          <SuggestButton />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
