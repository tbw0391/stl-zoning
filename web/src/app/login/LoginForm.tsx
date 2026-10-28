"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Mobile number → a one-time code by text (Supabase phone sign-in through Twilio Verify) → signed in. No sign-in
// emails. Numbers are added on /team; this never creates an account.

// "(314) 555-0100" → "+13145550100"
function e164(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return input.trim().startsWith("+") && digits.length > 10 ? `+${digits}` : null;
}

function sendError(message: string) {
  if (/signups? not allowed|not found|otp_disabled/i.test(message)) {
    return "That number isn't on the team list. Ask a teammate to add it on the Team page.";
  }
  if (/rate|security purposes|seconds/i.test(message)) return "Wait a minute before asking for another code.";
  if (/phone provider|unsupported/i.test(message)) return "Text sign-in isn't switched on yet.";
  return `Couldn't send a code: ${message}`;
}

const pretty = (p: string) => p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");

export default function LoginForm({ next }: { next: string }) {
  const [input, setInput] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const p = e164(input);
    if (!p) return setError("Enter your 10-digit mobile number.");
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.signInWithOtp({ phone: p, options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) return setError(sendError(error.message));
    setPhone(p);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) return;
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.verifyOtp({ phone, token: code.replace(/\D/g, ""), type: "sms" });
    if (error) {
      setBusy(false);
      return setError("That code didn't work or has expired. Check it, or send a new one.");
    }
    // A full page load, so the header and every page pick up the new session.
    location.assign(next);
  }

  if (phone) {
    return (
      <form onSubmit={verify}>
        <p className="notice" style={{ marginTop: 0 }}>We texted a code to <strong>{pretty(phone)}</strong>.</p>
        <label htmlFor="code">6-digit code</label>
        <input id="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus value={code}
          onChange={(e) => setCode(e.target.value)} className="code-input" maxLength={10} />
        <button type="submit" disabled={busy}>{busy ? "Checking…" : "Sign in"}</button>
        {error && <p className="error">{error}</p>}
        <button type="button" className="link" onClick={() => { setPhone(null); setCode(""); setError(""); }}>
          Use a different number
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={send}>
      <label htmlFor="who">Mobile number</label>
      <input id="who" type="tel" required autoFocus value={input} onChange={(e) => setInput(e.target.value)}
        autoComplete="tel" placeholder="(314) 555-0100" />
      <button type="submit" disabled={busy}>{busy ? "Sending…" : "Text me a code"}</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
