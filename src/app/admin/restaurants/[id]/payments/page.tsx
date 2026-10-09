import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaymentSettingsForm } from "@/components/payments/payment-settings-form";
import { formatDayAndTime } from "@/components/team/model";
import { Callout } from "@/components/ui";
import { PUBLICLY_VISIBLE_STATUSES } from "@/domain/restaurants/lifecycle";
import { WIZARD_STEPS } from "@/domain/restaurants/wizard";
import { getAdminRestaurant } from "@/server/admin/restaurants";
import { requirePlatformStaff } from "@/server/guards";
import { savePaymentSettings } from "@/server/payments/actions";
import { getPaymentSettings } from "@/server/payments/settings";

export const metadata: Metadata = { title: "Payment setup" };

const STEP = "payments";

/**
 * Wizard step 6 (brief §6.4, §7.2 step 6): which payment methods the restaurant accepts, its
 * provider and public merchant reference, and provider onboarding. Secrets are never entered here.
 */
export default async function PaymentsStepPage(
  props: PageProps<"/admin/restaurants/[id]/payments">,
) {
  const { id } = await props.params;
  const { supabase } = await requirePlatformStaff(
    `/admin/restaurants/${id}/payments`,
    "restaurants.onboard",
  );
  const restaurant = await getAdminRestaurant(supabase, id);
  if (!restaurant) notFound();
  const settings = await getPaymentSettings(supabase, restaurant.id);

  const index = WIZARD_STEPS.findIndex((s) => s.slug === STEP);
  const next = WIZARD_STEPS[index + 1];
  const live = PUBLICLY_VISIBLE_STATUSES.includes(restaurant.status);

  return (
    <main className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="m-0 font-sans text-small text-ink-muted">
          Step {index + 1} of {WIZARD_STEPS.length}
        </p>
        <h1 className="m-0 font-sans text-title text-ink">{WIZARD_STEPS[index].label}</h1>
        <p className="m-0 max-w-content font-serif text-body text-ink-muted">
          How customers pay {restaurant.displayName}, and how far its payment provider setup has
          got.
        </p>
      </div>

      <Callout tone="warning" title="Provider keys and secrets are never entered here.">
        <p>They’re set up by DineFlow’s engineers in secure storage.</p>
      </Callout>

      {live ? (
        <Callout title="This restaurant is live">
          <p>
            Changes apply to new orders as soon as you save. Orders already placed keep the way they
            were paid.
          </p>
        </Callout>
      ) : null}

      {settings ? (
        <>
          <p className="m-0 font-sans text-small text-ink-muted">
            Last changed{" "}
            <time dateTime={settings.updatedAt}>{formatDayAndTime(settings.updatedAt)}</time>.
          </p>
          <PaymentSettingsForm
            save={savePaymentSettings.bind(null, restaurant.id)}
            saved={settings}
            nextStep={next ? { slug: next.slug, label: next.label } : undefined}
          />
        </>
      ) : (
        <Callout tone="danger" title="Payment settings couldn’t be loaded">
          <p>
            Reload the page. If this keeps happening, ask an engineer to check this restaurant’s
            payment record.
          </p>
        </Callout>
      )}
    </main>
  );
}
