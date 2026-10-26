"use client";

import { useActionState } from "react";
import { signUp, type SignupState } from "./actions";

export default function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(signUp, {});

  if (state.ok) {
    return (
      <div className="card signup-done">
        <h2>Thanks, {state.name}.</h2>
        <p>We&apos;ll set up your account and send a sign-in code to <strong>{state.email}</strong>. There&apos;s no password.</p>
        <p>In the meantime, <a href="/demo">look around the demo</a>.</p>
      </div>
    );
  }

  return (
    <form action={action} className="card signup-form">
      <label>Your name<input name="name" required autoComplete="name" /></label>
      <label>Company<input name="company" required autoComplete="organization" /></label>
      <label>Work email<input name="email" type="email" required autoComplete="email" /></label>
      <label>Mobile phone <span className="muted">(optional, to get sign-in codes by text)</span>
        <input name="phone" type="tel" autoComplete="tel" />
      </label>
      <label>State
        <select name="state" defaultValue="OH">
          <option value="OH">Ohio</option>
          <option value="MO">Missouri</option>
          <option value="other">Somewhere else</option>
        </select>
      </label>
      <label>Cities, townships or counties you work in
        <textarea name="area" rows={2} placeholder="e.g. Dublin, Jerome Township, Delaware County" />
      </label>
      <label>What you do
        <select name="role" defaultValue="">
          <option value="">Choose one</option>
          <option>Homebuilder</option>
          <option>Developer</option>
          <option>Land broker</option>
          <option>Attorney or consultant</option>
          <option>Engineer or planner</option>
          <option>Other</option>
        </select>
      </label>
      <label>Anything else? <span className="muted">(optional)</span><textarea name="note" rows={3} /></label>
      {/* Left empty by people; filled in by spam bots. */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
      {state.error && <p className="error">{state.error}</p>}
      <button type="submit" disabled={pending}>{pending ? "Sending…" : "Sign up"}</button>
    </form>
  );
}
