import "server-only";
import { isOnboardingStatus, type PaymentOnboardingStatus } from "@/components/payments/model";
import type { ServerClient } from "@/lib/supabase/server";

/**
 * A restaurant's payment setup (brief §6.4, §7.2 step 6): which methods are on, the provider and
 * its public merchant reference, and how far provider onboarding has got. Provider secrets are not
 * stored in the database at all. Readable by the restaurant's owners and managers and by platform
 * staff (row-level security); only platform staff who onboard restaurants can change it.
 */
export interface PaymentSettingsRecord {
  payAtPickupEnabled: boolean;
  onlineEnabled: boolean;
  provider: string | null;
  merchantReference: string | null;
  onboardingStatus: PaymentOnboardingStatus;
  updatedAt: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Null when the restaurant doesn't exist or the viewer can't see its payment setup. */
export async function getPaymentSettings(
  supabase: ServerClient,
  restaurantId: string,
): Promise<PaymentSettingsRecord | null> {
  if (!UUID.test(restaurantId)) return null;
  const { data, error } = await supabase
    .from("restaurant_payment_settings")
    .select(
      "pay_at_pickup_enabled, online_enabled, provider, merchant_reference, onboarding_status, updated_at",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw new Error(`Could not load payment settings: ${error.message}`);
  if (!data) return null;
  const row = data as {
    pay_at_pickup_enabled: boolean;
    online_enabled: boolean;
    provider: string | null;
    merchant_reference: string | null;
    onboarding_status: string;
    updated_at: string;
  };
  return {
    payAtPickupEnabled: row.pay_at_pickup_enabled,
    onlineEnabled: row.online_enabled,
    provider: row.provider,
    merchantReference: row.merchant_reference,
    onboardingStatus: isOnboardingStatus(row.onboarding_status)
      ? row.onboarding_status
      : "not_started",
    updatedAt: row.updated_at,
  };
}
