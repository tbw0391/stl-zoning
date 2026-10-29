import { cookies } from "next/headers";
import { DEMO_COOKIE } from "@/lib/demoPaths";
import { inDemo } from "@/lib/siteMode";

// True while this browser is in the open demo (set by /demo, cleared by /demo/exit), and always on the public
// product's own deployment (lib/siteMode).
export async function isDemo(): Promise<boolean> {
  return inDemo((await cookies()).get(DEMO_COOKIE)?.value);
}
