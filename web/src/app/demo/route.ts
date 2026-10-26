import { NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/demoPaths";

// "See the demo" on /welcome: this browser sees the Columbus-area data read-only, without Lombardo's own pages.
export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/", request.url));
  res.cookies.set(DEMO_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax" });
  return res;
}
