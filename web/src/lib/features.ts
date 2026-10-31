import { cookies } from "next/headers";
import { isDemo } from "@/lib/demo";
import { SITE_MODE } from "@/lib/siteMode";

// Opt-in features: the site stays as it is for each person until they switch a feature on at /features. Choices are
// kept in a cookie, so they're per browser (there are no logins yet). Add new entries at the top with today's date;
// the Features tab shows a badge until the person opens the tab.
export type Feature = { key: string; title: string; description: string; added: string; page?: string };

export const FEATURES: Feature[] = [
  {
    key: "land-finder",
    title: "Project Vision: open land in Wildwood and Wentzville",
    description: "Adds a Project Vision tab with a land finder: vacant and farm parcels (or homes on big acreage) of 5 acres and up in Wildwood, Wentzville and the unincorporated land around Wentzville, with owner and mailing address, zoning, distance to sewer, appraised values, last sale and how many rezonings were filed within a mile in the last year. Filter by size and owner type, and download the list as a spreadsheet for outreach.",
    added: "2026-10-31",
    page: "/vision",
  },

  {
    key: "calendar-multi",
    title: "Pick several municipalities on the calendar",
    description: "The calendar's Municipality menu becomes a checklist: tick one, some or all of them, then Apply. Nothing ticked shows everything, as before. (Suggestion #37)",
    added: "2026-10-29",
    page: "/",
  },

  {
    key: "project-delete",
    title: "Delete a project",
    description: "Adds \"Delete this project…\" under Details on each project page, with a confirm step. Its notes, checklist, tasks, watches, alerts and OYL lot details are deleted with it. (Suggestion #36)",
    added: "2026-10-26",
    page: "/projects",
  },

  {
    key: "alert-seen-each",
    title: "Mark alerts seen one at a time",
    description: "Each NEW case on the Alerts page, and each project timeline change, gets its own Mark seen link, so you can clear them one by one instead of a whole watch at once. (Suggestion #40)",
    added: "2026-10-26",
    page: "/alerts",
  },

  {
    key: "calendar-past",
    title: "Past meetings on the calendar list",
    description: "The calendar's Range menu (List view) gets Past month, Past 3 months and Past 6 months, newest first. Month and Week views could already go back with the arrows. (Suggestion #34)",
    added: "2026-10-26",
    page: "/",
  },

  {
    key: "oyl-lots",
    title: "OYL lots page",
    description: "Adds OYL lots to the menu: Chad's OYL Tracker spreadsheet as a page, with the working lots, the lot-count box (with dollars) and closed lots with days to flash and to customer purchase. Add and edit lots there; each lot is also a project, so it gets nearby-case alerts and satellite images. Loaded with the Oct 19 sheet.",
    added: "2026-10-26",
    page: "/oyl",
  },

  {
    key: "satellite",
    title: "Satellite images of sites",
    description: "Project pages (with a street address) and Parcel lookup results show the latest clear satellite image of the site, plus ones from about 3 months and a year earlier, so you can spot clearing or grading. Free imagery: about 10 m per pixel, new every few days when it isn't cloudy.",
    added: "2026-10-26",
    page: "/lookup",
  },

  {
    key: "state-picker",
    title: "Area picker: St. Louis or Columbus (Ohio preview)",
    description: "Adds an area menu to the header (St. Louis area or Columbus area). Pick Columbus to see the Ohio cities and townships being collected for the public version of the site: their calendar, meetings, rezonings and votes. St. Louis stays the default, and your follow list, digest and alerts don't change.",
    added: "2026-10-22",
    page: "/jurisdictions",
  },

  {
    key: "multi-place",
    title: "Projects in more than one municipality",
    description: "Under Municipality in a project's Details, add the other municipalities the site is in. Each is followed, searched for the project's case numbers, and shows its upcoming meetings on the project page; the projects list shows them too. The first municipality still sets the expected timeline. (Suggestion #15)",
    added: "2026-10-21",
    page: "/projects",
  },

  {
    key: "note-edit",
    title: "Edit or delete project notes",
    description: "Each note on a project page gets an Edit link to reword it, with Delete inside. The latest note on a dashboard card gets an Edit link that jumps to it. (Suggestion #31)",
    added: "2026-10-19",
    page: "/dashboard",
  },

  {
    key: "card-date-no-cancel",
    title: "No Cancel link on dashboard dates",
    description: "The Diligence end and Projected close boxes on dashboard cards lose their Cancel link. Press Escape to close the box without saving. (Suggestion #30)",
    added: "2026-10-19",
    page: "/dashboard",
  },
];

// What this deployment offers: Lombardo's own site has no other states to pick.
export const SITE_FEATURES = FEATURES.filter((f) => !(SITE_MODE === "lombardo" && f.key === "state-picker"));

export const ON_COOKIE = "features_on";
export const SEEN_COOKIE = "features_seen";
// The history question banner (components/HistoryAsk), hidden once answered.
export const ASK_COOKIE = "history_ask";

export async function enabledFeatures(): Promise<string[]> {
  // The demo shows everything that's been built.
  if (await isDemo()) return SITE_FEATURES.map((f) => f.key);
  const raw = (await cookies()).get(ON_COOKIE)?.value ?? "";
  return raw.split(",").filter((k) => SITE_FEATURES.some((f) => f.key === k));
}

// Features added after the person last opened the Features tab.
export async function unseenFeatureCount(): Promise<number> {
  const seen = (await cookies()).get(SEEN_COOKIE)?.value ?? "";
  return SITE_FEATURES.filter((f) => f.added > seen).length;
}
