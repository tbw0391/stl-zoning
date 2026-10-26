import { NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/demoPaths";

export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/welcome", request.url));
  res.cookies.delete(DEMO_COOKIE);
  return res;
}
