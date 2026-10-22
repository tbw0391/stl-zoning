"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ON_COOKIE, SEEN_COOKIE, enabledFeatures } from "@/lib/features";
import { STATES, STATE_COOKIE } from "@/lib/state";
import { todayCentral } from "@/lib/format";

const KEEP = { maxAge: 60 * 60 * 24 * 365 * 5, path: "/", sameSite: "lax" as const };

export async function setFeature(key: string, on: boolean) {
  const current = (await enabledFeatures()).filter((k) => k !== key);
  (await cookies()).set(ON_COOKIE, (on ? [...current, key] : current).join(","), KEEP);
  revalidatePath("/", "layout");
}

export async function markFeaturesSeen() {
  (await cookies()).set(SEEN_COOKIE, todayCentral(), KEEP);
  revalidatePath("/", "layout");
}

// The header's State menu (feature "state-picker").
export async function pickState(state: string) {
  if (!(state in STATES)) return;
  (await cookies()).set(STATE_COOKIE, state, KEEP);
  revalidatePath("/", "layout");
}
