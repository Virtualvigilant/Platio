"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { looksLikeSecret } from "@/components/payments/model";
import { paymentSettingsSchema } from "@/domain/restaurants/config";
import { WIZARD_STEPS } from "@/domain/restaurants/wizard";
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

/**
 * Saving a restaurant's payment setup (brief §6.4, §7.2 step 6). Platform staff only. The
 * restaurant id is bound by the page but travels through the browser, so it is checked again here
 * and the update runs as the signed-in person under row-level security. The form never carries
 * provider secrets, and text that looks like one is refused without being stored or shown back.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND =
  "We couldn’t find that restaurant. It may have been removed, or you may not have access to it.";
const SECRET_FIELD =
  "That looks like a key, password or PIN. Enter only the public till or paybill number. Keys are set up by DineFlow’s engineers.";

export async function savePaymentSettings(
  restaurantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizePlatform("restaurants.onboard");
  if (!auth.ok) return keepValues(auth.state, formData);
  if (!UUID.test(restaurantId)) return failure(NOT_FOUND);
  const { supabase } = auth;

  const raw = {
    payAtPickupEnabled: checked(formData, "payAtPickupEnabled"),
    onlineEnabled: checked(formData, "onlineEnabled"),
    provider: text(formData, "provider"),
    merchantReference: text(formData, "merchantReference"),
    onboardingStatus: text(formData, "onboardingStatus"),
  };

  // Refuse credentials before anything else, and drop them from the values sent back.
  const secretFields = (["provider", "merchantReference"] as const).filter((k) =>
    looksLikeSecret(raw[k]),
  );
  if (secretFields.length) {
    const values = formValues(formData);
    for (const k of secretFields) values[k] = "";
    return failure("Nothing was saved. Remove the key or password and try again.", {
      fieldErrors: Object.fromEntries(secretFields.map((k) => [k, SECRET_FIELD])),
      values,
    });
  }

  const parsed = paymentSettingsSchema.safeParse(raw);
  if (!parsed.success) return fromValidation(parsed.error, formData);
  const v = parsed.data;

  const { data, error } = await supabase
    .from("restaurant_payment_settings")
    .update({
      pay_at_pickup_enabled: v.payAtPickupEnabled,
      online_enabled: v.onlineEnabled,
      provider: v.provider,
      merchant_reference: v.merchantReference,
      onboarding_status: v.onboardingStatus,
    })
    .eq("restaurant_id", restaurantId)
    .select("restaurant_id")
    .maybeSingle();
  if (error) return fromDb(error, formData);
  if (!data) return failure(NOT_FOUND, { values: formValues(formData) });

  refresh();
  // "Save and continue" posts then=<next step>; only known steps are accepted.
  const then = WIZARD_STEPS.find((s) => s.slug === text(formData, "then"));
  if (then) redirect(`/admin/restaurants/${restaurantId}/${then.slug}`);
  return success("Payment settings saved.");
}

function keepValues(state: FormState, formData: FormData): FormState {
  if (state.status !== "error") return state;
  const values = formValues(formData);
  for (const k of ["provider", "merchantReference"]) {
    if (values[k] && looksLikeSecret(values[k])) values[k] = "";
  }
  return { ...state, values };
}
