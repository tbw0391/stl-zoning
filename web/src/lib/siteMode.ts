// Which site this deployment is (Vercel env SITE_MODE), for splitting Lombardo's tracker from the public product:
//   lombardo  Lombardo's own tracker: Missouri only, no state picker, no public front door or demo.
//   hawkeye   The public product: every visitor gets the read-only Ohio demo (no Lombardo pages, no way out of it).
//   unset     Both on one site, as before the split.
// Kept free of next/headers so middleware can use it.
export type SiteMode = "lombardo" | "hawkeye" | "both";

const raw = process.env.SITE_MODE;
export const SITE_MODE: SiteMode = raw === "lombardo" || raw === "hawkeye" ? raw : "both";

// Pages that belong to the public product only.
const PUBLIC_ONLY = ["/welcome", "/signup", "/demo"];

export const offOnLombardo = (path: string) =>
  SITE_MODE === "lombardo" && PUBLIC_ONLY.some((p) => path === p || path.startsWith(p + "/"));

// Whether a request is in the demo, given its demo cookie.
export const inDemo = (cookie: string | undefined) => SITE_MODE === "hawkeye" || (SITE_MODE === "both" && cookie === "1");
