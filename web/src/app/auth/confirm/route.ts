import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/demoPaths";

// Magic-link target for the email template's {{ .TokenHash }} link. Unlike /auth/callback,
// this works on any device, not only the browser that requested the link.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;
  if (token_hash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(`${origin}${safeNext(searchParams.get("next"))}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
