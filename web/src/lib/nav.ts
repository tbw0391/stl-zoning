import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faCalendar, faFolderOpen, faSquareCheck, faUser, faComments, faMap, faFlag, faAddressBook, faLightbulb,
} from "@fortawesome/free-regular-svg-icons";
import { faLandmark } from "@fortawesome/free-solid-svg-icons";

export const NAV: { href: string; label: string; icon: IconDefinition }[] = [
  { href: "/", label: "Calendar", icon: faCalendar },
  { href: "/projects", label: "Projects", icon: faFolderOpen },
  { href: "/tasks", label: "Tasks", icon: faSquareCheck },
  { href: "/chad", label: "Chad's tasks", icon: faUser },
  { href: "/meetings", label: "Meetings", icon: faComments },
  { href: "/lookup", label: "Parcel lookup", icon: faMap },
  { href: "/jurisdictions", label: "Jurisdictions", icon: faLandmark },
  { href: "/progress", label: "Progress", icon: faFlag },
  { href: "/directory", label: "Directory", icon: faAddressBook },
  { href: "/todo", label: "Suggestions", icon: faLightbulb },
];

export const navIcon = (href: string) => NAV.find((n) => n.href === href)!.icon;
