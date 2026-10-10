"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      // Sign-ups are disabled: only invited users get a link.
      options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setState("error");
      setMessage("That email isn't on the team list. Ask an admin to invite you.");
    } else {
      setState("sent");
    }
  }

  return (
    <div className="login">
      <h1>Entitlement Tracker</h1>
      <p className="muted">St. Charles County rezoning, meetings and contacts.</p>
      {state === "sent" ? (
        <p className="notice">Check your email for a sign-in link. Open it in this same browser.</p>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="email">Work email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <button type="submit" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Email me a sign-in link"}
          </button>
          {state === "error" && <p className="error">{message}</p>}
        </form>
      )}
    </div>
  );
}
