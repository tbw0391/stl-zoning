// The public front door and the open demo (no sign-up). Kept free of next/headers so middleware can use it.
// "Project Hawkeye" is a working name for the public product until it gets a real one.
export const PRODUCT = "Project Hawkeye";
export const DEMO_COOKIE = "demo";

// Pages outside the Lombardo site: no Lombardo header, open to anyone.
export const PUBLIC_PAGES = ["/welcome", "/signup"];

// What a demo visitor can open. Everything else is Lombardo's own work (projects, tasks, suggestions, alerts).
const DEMO_PAGES = ["/rezonings", "/votes", "/meetings", "/jurisdictions", "/directory"];
const ALWAYS_OPEN = [...PUBLIC_PAGES, "/demo", "/login", "/auth", "/calendar.ics"];

const under = (path: string, base: string) => path === base || path.startsWith(base + "/");

export const isPublicPage = (path: string) => PUBLIC_PAGES.some((p) => under(path, p));

export function demoAllows(path: string) {
  if (path === "/" || ALWAYS_OPEN.some((p) => under(path, p))) return true;
  // Forms for adding meetings or people would only fail, since the demo can't save.
  return !path.endsWith("/new") && DEMO_PAGES.some((p) => under(path, p));
}

export const DEMO_NAV = ["/", ...DEMO_PAGES];
