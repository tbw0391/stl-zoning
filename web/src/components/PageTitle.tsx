import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { navIcon } from "@/lib/nav";

// Page heading with the matching nav icon in a brand-colored badge.
export default function PageTitle({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <h1 className="page-title">
      <span className="title-icon"><FontAwesomeIcon icon={navIcon(href)} /></span>
      {children}
    </h1>
  );
}
