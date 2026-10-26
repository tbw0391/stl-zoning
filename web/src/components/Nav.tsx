"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { NAV } from "@/lib/nav";

// `only` limits the links (the demo shows just the public-data pages).
export default function Nav({ alerts = 0, only }: { alerts?: number; only?: string[] }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <nav>
      {NAV.filter((n) => !only || only.includes(n.href)).map((n) => (
        <Link key={n.href} href={n.href} className={active(n.href) ? "active" : undefined}>
          <FontAwesomeIcon icon={n.icon} fixedWidth />
          {n.label}
          {n.href === "/alerts" && alerts > 0 && <span className="badge">{alerts}</span>}
        </Link>
      ))}
    </nav>
  );
}
