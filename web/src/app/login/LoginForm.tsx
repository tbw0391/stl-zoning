"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Email or mobile number → a one-time code (email through Supabase, texts through Twilio Verify) → signed in.
// Accounts are added on /team; this never creates one.
type Target = { email: string } | { phone: string };

// "(314) 555-0100" → "+13145550100"; anything with an @ is an email.
function target(input: string): Target | null {
  const s = input.trim();
  if (s.includes("@")) return { email: s.toLowerCase() };
  const digits = s.replace(/\D/g, "");
  if (digits.length === 10) return { phone: `+1${digits}` };
  if (digits.length === 11 && digits.startsWith("1")) return { phone: `+${digits}` };
  if (s.startsWith("+") && digits.length > 10) return { phone: `+${digits}` };
  return null;
}

function sendError(message: string, byText: boolean) {
  if (/signups? not allowed|not found|otp_disabled/i.test(message)) {
    return byText
      ? "That number isn't on the team list. Sign in by email, or ask a teammate to add your number on the Team page."
      : "That email isn't on the team list. Ask a teammate to add you on the Team page.";
  }
  if (/rate|security purposes|seconds/i.test(message)) return "Wait a minute before asking for another code.";
  if (/phone provider|sms/i.test(message)) return "Text codes aren't set up yet. Use your email.";
  return `Couldn't send a code: ${message}`;
}

export default function LoginForm({ next }: { next: string }) {
  const [input, setInput] = useState("");
  const [sentTo, setSentTo] = useState<Target | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = target(input);
    if (!t) return setError("Enter your work email or a 10-digit mobile number.");
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = "email" in t
      ? await supabase.auth.signInWithOtp({
          email: t.email,
          options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
        })
      : await supabase.auth.signInWithOtp({ phone: t.phone, options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) return setError(sendError(error.message, "phone" in t));
    setSentTo(t);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setBusy(true);
    setError("");
    const token = code.replace(/\D/g, "");
    const supabase = createClient();
    const { error } = "email" in sentTo
      ? await supabase.auth.verifyOtp({ email: sentTo.email, token, type: "email" })
      : await supabase.auth.verifyOtp({ phone: sentTo.phone, token, type: "sms" });
    if (error) {
      setBusy(false);
      return setError("That code didn't work or has expired. Check it, or send a new one.");
    }
    // A full page load, so the header and every page pick up the new session.
    location.assign(next);
  }

  if (sentTo) {
    const where = "email" in sentTo ? sentTo.email : sentTo.phone;
    return (
      <form onSubmit={verify}>
        <p className="notice" style={{ marginTop: 0 }}>
          We sent a code to <strong>{where}</strong>.
          {"email" in sentTo && " If the email has a sign-in link instead, click it in this browser."}
        </p>
        <label htmlFor="code">6-digit code</label>
        <input id="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus value={code}
          onChange={(e) => setCode(e.target.value)} className="code-input" maxLength={10} />
        <button type="submit" disabled={busy}>{busy ? "Checking…" : "Sign in"}</button>
        {error && <p className="error">{error}</p>}
        <button type="button" className="link" onClick={() => { setSentTo(null); setCode(""); setError(""); }}>
          Use a different email or number
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={send}>
      <label htmlFor="who">Work email or mobile number</label>
      <input id="who" required autoFocus value={input} onChange={(e) => setInput(e.target.value)} autoComplete="username" />
      <button type="submit" disabled={busy}>{busy ? "Sending…" : "Send me a code"}</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
