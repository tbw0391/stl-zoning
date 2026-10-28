import type { Metadata } from "next";
import LoginForm from "./LoginForm";
import { safeNext } from "@/lib/demoPaths";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="login">
      <h1>Sign in</h1>
      <p className="muted">We&apos;ll text you a 6-digit code. No password.</p>
      <LoginForm next={safeNext(sp.next)} />
    </div>
  );
}
