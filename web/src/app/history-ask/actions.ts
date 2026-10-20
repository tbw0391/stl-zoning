"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ASK_COOKIE } from "@/lib/features";

// The banner asking whether to read older agendas: the answer lands on /todo as a suggestion, and the banner hides in
// this browser.
export async function answerHistoryAsk(fd: FormData) {
  const yes = fd.get("choice") === "yes";
  const other = String(fd.get("other") ?? "").trim();
  const parts = [
    yes ? "Yes: read past agendas (2021 on) for Chesterfield and St. Charles County." : "Not now for Chesterfield and St. Charles County history.",
    other ? `Also wants ${other} history sooner.` : "",
  ].filter(Boolean);
  if (yes || other) {
    const supabase = await createClient();
    const { error } = await supabase.from("todos").insert({ body: `History banner: ${parts.join(" ")}`, page: "/" });
    if (error) throw new Error(error.message);
  }
  (await cookies()).set(ASK_COOKIE, yes ? "yes" : other ? "other" : "no", { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}
