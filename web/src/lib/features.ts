import { cookies } from "next/headers";

// Opt-in features: the site stays as it is for each person until they switch a feature on at /features. Choices are
// kept in a cookie, so they're per browser (there are no logins yet). Add new entries at the top with today's date;
// the Features tab shows a badge until the person opens the tab.
export type Feature = { key: string; title: string; description: string; added: string; page?: string };

export const FEATURES: Feature[] = [
  {
    key: "card-date-no-cancel",
    title: "No Cancel link on dashboard dates",
    description: "The Diligence end and Projected close boxes on dashboard cards lose their Cancel link. Press Escape to close the box without saving. (Suggestion #30)",
    added: "2026-10-19",
    page: "/dashboard",
  },
];

export const ON_COOKIE = "features_on";
export const SEEN_COOKIE = "features_seen";

export async function enabledFeatures(): Promise<string[]> {
  const raw = (await cookies()).get(ON_COOKIE)?.value ?? "";
  return raw.split(",").filter((k) => FEATURES.some((f) => f.key === k));
}

// Features added after the person last opened the Features tab.
export async function unseenFeatureCount(): Promise<number> {
  const seen = (await cookies()).get(SEEN_COOKIE)?.value ?? "";
  return FEATURES.filter((f) => f.added > seen).length;
}
