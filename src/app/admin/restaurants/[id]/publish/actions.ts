"use server";

import { refresh } from "next/cache";
import { platformCan } from "@/domain/access";
import {
  RESTAURANT_STATUS_LABELS,
  findRestaurantTransition,
  isRestaurantStatus,
  type RestaurantStatus,
} from "@/domain/restaurants/lifecycle";
import {
  checked,
  failure,
  formValues,
  fromDb,
  fromValidation,
  success,
  text,
  type FormState,
} from "@/server/actions";
import { authorizePlatform } from "@/server/guards";
import { isDestructiveMove, moveInputSchema } from "./moves";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Moves a restaurant through its lifecycle (brief §4.3 step 8, §7.2). The restaurant id and the
 * target status come from the browser, so this re-checks everything: the viewer's platform role,
 * that the move exists from the restaurant's current status, the reason and confirmation, and then
 * public.transition_restaurant() checks the role, the move, the reason and (to publish) the whole
 * readiness checklist again inside the database.
 *
 * The form also posts the status it was showing ("from"), so a move made on a stale page is
 * refused instead of doing something the person didn't see.
 */
export async function transitionRestaurant(
  restaurantId: string,
  to: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!UUID.test(restaurantId) || !isRestaurantStatus(to)) {
    return failure("That change isn’t available. Reload the page and try again.");
  }

  // Every lifecycle move needs at least onboarding rights; the move's own permission is checked
  // below, once the current status is known.
  const auth = await authorizePlatform("restaurants.onboard");
  if (!auth.ok) return auth.state;
  const { supabase, viewer } = auth;

  const { data, error: readError } = await supabase
    .from("restaurants")
    .select("status")
    .eq("id", restaurantId)
    .maybeSingle();
  if (readError) return fromDb(readError, formData, "We couldn’t check the restaurant. Try again.");
  if (!data) {
    return failure(
      "We couldn’t find that restaurant. It may have been removed, or you may not have access to it.",
    );
  }
  const from = data.status as RestaurantStatus;
  const label = (s: RestaurantStatus) => RESTAURANT_STATUS_LABELS[s];

  const shown = text(formData, "from");
  if (shown && shown !== from) {
    refresh();
    return failure(
      `This restaurant is now ${label(from)}; someone changed it while you had this page open. Check the page, then try again.`,
      { values: formValues(formData) },
    );
  }

  const move = findRestaurantTransition(from, to);
  if (!move) {
    return failure(
      `A restaurant that is ${label(from)} can’t move to ${label(to)}. Reload the page to see what you can do.`,
    );
  }
  if (!viewer.platformRole || !platformCan(viewer.platformRole, move.permission)) {
    return failure(
      `Only super-admins can ${move.action.charAt(0).toLowerCase()}${move.action.slice(1)}.`,
      { values: formValues(formData) },
    );
  }

  const parsed = moveInputSchema({
    requiresReason: move.requiresReason,
    destructive: isDestructiveMove(from, to),
  }).safeParse({ reason: text(formData, "reason"), confirm: checked(formData, "confirm") });
  if (!parsed.success) return fromValidation(parsed.error, formData);

  const { error } = await supabase.rpc("transition_restaurant", {
    p_restaurant_id: restaurantId,
    p_to: to,
    p_reason: parsed.data.reason,
  });
  // The database's message says what is missing, e.g. which checklist items fail.
  if (error) return fromDb(error, formData, "We couldn’t change the status. Try again.");

  refresh();
  return success(`Status changed from ${label(from)} to ${label(to)}.`);
}
