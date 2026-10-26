"use server";

export type SignupState = { ok?: boolean; error?: string; name?: string; email?: string };

const FIELDS = ["name", "company", "email", "phone", "state", "area", "role", "note", "website"];

// Hands the form to the signup edge function, which saves it and emails AGA. No account is made yet: that comes with
// sign-in by email or text code.
export async function signUp(_: SignupState, fd: FormData): Promise<SignupState> {
  const body = Object.fromEntries(FIELDS.map((k) => [k, String(fd.get(k) ?? "").trim()]));
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
    body: JSON.stringify(body),
  }).catch(() => null);
  const out = res ? await res.json().catch(() => ({})) : {};
  if (!res?.ok || !out.ok) return { error: out.error ?? "That didn't go through. Try again in a minute." };
  return { ok: true, name: body.name.split(" ")[0], email: body.email };
}
