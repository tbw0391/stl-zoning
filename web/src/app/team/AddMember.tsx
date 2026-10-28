"use client";

import { useActionState } from "react";
import { addMember, type AddState } from "./actions";

export default function AddMember() {
  const [state, action, pending] = useActionState<AddState, FormData>(addMember, {});
  return (
    <form action={action} className="inline-form">
      <label>Mobile number<input name="phone" type="tel" required placeholder="314-555-0100" /></label>
      <label className="grow">Email (optional)<input name="email" type="email" placeholder="name@company.com" /></label>
      <button type="submit" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
      {state.error && <p className="error" style={{ flexBasis: "100%", margin: 0 }}>{state.error}</p>}
      {state.ok && <p className="small" style={{ flexBasis: "100%", margin: 0 }}>Added. They sign in at /login with a code texted to that number.</p>}
    </form>
  );
}
