import { cookies } from "next/headers";
import { DEMO_COOKIE } from "@/lib/demoPaths";

// True while this browser is in the open demo (set by /demo, cleared by /demo/exit).
export async function isDemo(): Promise<boolean> {
  return (await cookies()).get(DEMO_COOKIE)?.value === "1";
}
