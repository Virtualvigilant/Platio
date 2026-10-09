"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseConfig } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export type SignInState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string; email?: string };

const emailSchema = z.email();

/**
 * Sends a one-time sign-in link. The launch authentication method is still an open business
 * decision (brief §19); email links are the default until it is made.
 */
export async function requestSignInLink(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const raw = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter an email address like name@example.com.",
      email: raw,
    };
  }

  const config = getSupabaseConfig();
  const supabase = await createClient();
  if (!config.ok || !supabase) {
    return { status: "error", message: "Sign-in isn’t set up on this server yet.", email: raw };
  }

  const next = safeNextPath(String(formData.get("next") ?? "/"));
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${config.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    // Don't reveal whether an account exists; only rate limits get a specific message.
    const message =
      error.status === 429
        ? "Too many sign-in emails were requested. Wait a minute, then try again."
        : "We couldn’t send the link. Check the address and try again.";
    return { status: "error", message, email: raw };
  }
  return { status: "sent", email: parsed.data };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase?.auth.signOut();
  redirect("/");
}
