import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import Nav from "@/components/Nav";
import SuggestButton from "@/components/SuggestButton";
import "./globals.css";

config.autoAddCss = false;

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Entitlement Tracker",
  description: "St. Charles County rezoning processes, meeting calendar and contacts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.className}>
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <Image src="/lombardo-logo.png" alt="Lombardo Homes" width={114} height={32} priority />
            <span className="brand-name">Entitlement Tracker</span>
          </Link>
          <Nav />
          <SuggestButton />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
