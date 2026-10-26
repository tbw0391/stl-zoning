"use client";

import { useActionState } from "react";
import { addMember, type AddState } from "./actions";

export default function AddMember() {
  const [state, action, pending] = useActionState<AddState, FormData>(addMember, {});
  return (
    <form action={action} className="inline-form">
      <label className="grow">Work email<input name="email" type="email" placeholder="name@company.com" /></label>
      <label>Mobile (optional)<input name="phone" type="tel" placeholder="314-555-0100" /></label>
      <button type="submit" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
      {state.error && <p className="error" style={{ flexBasis: "100%", margin: 0 }}>{state.error}</p>}
      {state.ok && <p className="small" style={{ flexBasis: "100%", margin: 0 }}>Added. They can sign in at /login with a code.</p>}
    </form>
  );
}
