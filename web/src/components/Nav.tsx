"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { NAV } from "@/lib/nav";

export default function Nav({ alerts = 0 }: { alerts?: number }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <nav>
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className={active(n.href) ? "active" : undefined}>
          <FontAwesomeIcon icon={n.icon} fixedWidth />
          {n.label}
          {n.href === "/alerts" && alerts > 0 && <span className="badge">{alerts}</span>}
        </Link>
      ))}
    </nav>
  );
}
