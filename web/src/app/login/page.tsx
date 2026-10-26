import type { Metadata } from "next";
import LoginForm from "./LoginForm";
import { safeNext } from "@/lib/demoPaths";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="login">
      <h1>Sign in</h1>
      <p className="muted">We&apos;ll send you a 6-digit code. No password.</p>
      {sp.error === "link" && <p className="error">That sign-in link didn&apos;t work or has expired. Ask for a new code below.</p>}
      <LoginForm next={safeNext(sp.next)} />
    </div>
  );
}
