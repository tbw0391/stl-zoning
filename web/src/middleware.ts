import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, demoAllows, openWithoutSignIn } from "@/lib/demoPaths";

// Refreshes the Supabase session cookie, and sends people to /login when sign-in is required.
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const demo = request.cookies.get(DEMO_COOKIE)?.value === "1";
  // The open demo is read-only and skips Lombardo's own pages. Saving goes through server actions, so refuse those
  // (except the sign-up form).
  if (demo) {
    if (request.method === "POST" && request.headers.has("next-action") && path !== "/signup") {
      return new NextResponse("The demo is read-only.", { status: 403 });
    }
    if (!demoAllows(path)) return NextResponse.redirect(new URL("/", request.url));
  }

  // The layout picks the Lombardo or public header from the path.
  const next = () => {
    const headers = new Headers(request.headers);
    headers.set("x-pathname", path);
    return NextResponse.next({ request: { headers } });
  };
  let response = next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = next();
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  // Sign-in required (Vercel env REQUIRE_SIGN_IN=1, switched on with supabase/pending/require_sign_in.sql): everyone
  // else goes to /login and comes back here after.
  if (process.env.REQUIRE_SIGN_IN === "1" && !user && !openWithoutSignIn(path, demo)) {
    if (request.method !== "GET") return new NextResponse("Sign in first.", { status: 401 });
    const login = new URL("/login", request.url);
    login.search = new URLSearchParams({ next: path + request.nextUrl.search }).toString();
    return NextResponse.redirect(login);
  }
  // Remember the calendar view (list / month / week) someone last picked.
  const view = request.nextUrl.searchParams.get("view");
  if (path === "/" && view && ["list", "month", "week"].includes(view)) {
    response.cookies.set("cal_view", view, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
