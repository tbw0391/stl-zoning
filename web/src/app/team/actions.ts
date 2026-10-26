"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Member = { id: string; email: string | null; phone: string | null; added_at: string; last_sign_in_at: string | null };

// Calls the `team` edge function as the signed-in user (it checks they're on the team).
export async function team<T>(body: Record<string, string>): Promise<T & { error?: string }> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Sign in first." } as T & { error?: string };
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/team`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { error: "The team service didn't answer. Try again." } as T & { error?: string };
  return res.json().catch(() => ({ error: `Team service error (${res.status}).` }));
}

export type AddState = { ok?: boolean; error?: string };

export async function addMember(_: AddState, fd: FormData): Promise<AddState> {
  const out = await team<{ ok?: boolean }>({ action: "add", email: String(fd.get("email") ?? ""), phone: String(fd.get("phone") ?? "") });
  if (out.error) return { error: out.error };
  revalidatePath("/team");
  return { ok: true };
}

export async function removeMember(id: string) {
  const out = await team<{ ok?: boolean }>({ action: "remove", id });
  if (out.error) throw new Error(out.error);
  revalidatePath("/team");
}
