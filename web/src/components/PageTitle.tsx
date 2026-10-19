import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { navIcon } from "@/lib/nav";

// Page heading with the matching nav icon in a brand-colored badge.
export default function PageTitle({ href, icon, children }: { href: string; icon?: IconDefinition; children: React.ReactNode }) {
  return (
    <h1 className="page-title">
      <span className="title-icon"><FontAwesomeIcon icon={icon ?? navIcon(href)} /></span>
      {children}
    </h1>
  );
}
