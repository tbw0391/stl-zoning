import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faCalendar, faChartBar, faFileLines, faFolderOpen, faSquareCheck, faUser, faComments, faMap, faFlag, faAddressBook, faLightbulb, faThumbsUp,
} from "@fortawesome/free-regular-svg-icons";
import { faLandmark, faHouseChimney, faTreeCity } from "@fortawesome/free-solid-svg-icons";
import { faBell } from "@fortawesome/free-regular-svg-icons";

// `feature`: shown only when that opt-in feature is switched on (lib/features).
export const NAV: { href: string; label: string; icon: IconDefinition; feature?: string }[] = [
  { href: "/", label: "Calendar", icon: faCalendar },
  { href: "/dashboard", label: "Dashboard", icon: faChartBar },
  { href: "/projects", label: "Projects", icon: faFolderOpen },
  { href: "/oyl", label: "OYL lots", icon: faHouseChimney, feature: "oyl-lots" },
  { href: "/tasks", label: "Tasks", icon: faSquareCheck },
  { href: "/chad", label: "Chad's tasks", icon: faUser },
  { href: "/rezonings", label: "Rezonings", icon: faFileLines },
  { href: "/votes", label: "Votes", icon: faThumbsUp },
  { href: "/alerts", label: "Alerts", icon: faBell },
  { href: "/meetings", label: "Meetings", icon: faComments },
  { href: "/lookup", label: "Parcel lookup", icon: faMap },
  { href: "/vision", label: "Project Vision", icon: faTreeCity, feature: "land-finder" },
  { href: "/jurisdictions", label: "Municipalities", icon: faLandmark },
  { href: "/progress", label: "Progress", icon: faFlag },
  { href: "/directory", label: "Directory", icon: faAddressBook },
  { href: "/todo", label: "Suggestions", icon: faLightbulb },
];

export const navIcon = (href: string) => NAV.find((n) => n.href === href)!.icon;
