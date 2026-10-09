"use server";

import { redirect } from "next/navigation";
import { isPlausibleInvitationToken } from "@/components/team/model";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, failure, type FormState } from "@/server/actions";
import { getViewer } from "@/server/session";
import { UUID } from "@/server/team/queries";

/**
 * Accepting a restaurant invitation (brief §3.1). The database checks everything that matters:
 * the token's hash, expiry, withdrawal, and that the signed-in, confirmed email is the invited
 * one. The token is never logged or repeated in a message.
 */

const INVALID =
  "This invitation link isn’t valid. Check you copied the whole link, or ask for a new one.";

/**
 * Bound to the token by the page and used with useActionState (which also passes the previous
 * state and the form data; neither is needed: the form has no fields).
 */
export async function acceptInvitation(token: string): Promise<FormState> {
  if (!isPlausibleInvitationToken(token)) return failure(INVALID);
  const supabase = await createClient();
  if (!supabase) return failure("Accepting invitations isn’t set up on this server yet.");
  const viewer = await getViewer();
  if (!viewer) return failure("Your session has ended. Sign in again, then accept the invitation.");

  const { data, error } = await supabase.rpc("accept_restaurant_invitation", { p_token: token });
  if (error) {
    if (error.code === "P0002") return failure(INVALID);
    return failure(dbErrorMessage(error, "We couldn’t accept the invitation. Try again."));
  }

  const restaurantId = typeof data === "string" && UUID.test(data) ? data : null;
  redirect(restaurantId ? `/restaurant?r=${restaurantId}` : "/restaurant");
}

/** Signs out so the invitee can sign in with the invited address, then comes back here. */
export async function switchAccount(token: string): Promise<void> {
  const supabase = await createClient();
  await supabase?.auth.signOut();
  redirect(
    isPlausibleInvitationToken(token)
      ? `/login?next=${encodeURIComponent(`/invitations/${token}`)}`
      : "/login",
  );
}
