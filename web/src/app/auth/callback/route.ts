import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/demoPaths";

// Target of the email's sign-in link when the template sends a link instead of (or as well as) the code.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext(searchParams.get("next"))}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
