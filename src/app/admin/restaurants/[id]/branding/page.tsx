import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink, Callout } from "@/components/ui";
import { WIZARD_STEPS } from "@/domain/restaurants/wizard";
import { getAdminRestaurant } from "@/server/admin/restaurants";
import { requirePlatformStaff } from "@/server/guards";
import { saveBranding } from "./actions";
import { BrandingForm } from "./branding-form";

export const metadata: Metadata = { title: "Branding" };

const STEP = WIZARD_STEPS.findIndex((s) => s.slug === "branding");

/** Setup wizard step 2 (brief §7.2): colour, layout variant, logo and cover photo. */
export default async function BrandingPage(props: PageProps<"/admin/restaurants/[id]/branding">) {
  const { id } = await props.params;
  const { supabase } = await requirePlatformStaff(
    `/admin/restaurants/${id}/branding`,
    "restaurants.onboard",
  );
  const restaurant = await getAdminRestaurant(supabase, id);
  if (!restaurant) notFound();

  const base = `/admin/restaurants/${restaurant.id}`;
  const previous = WIZARD_STEPS[STEP - 1];
  const next = WIZARD_STEPS[STEP + 1];
  const live = restaurant.status === "published" || restaurant.status === "paused";

  return (
    <main className="mx-auto flex max-w-content flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <p className="m-0 font-serif text-eyebrow text-brand-strong uppercase">
          DineFlow / Restaurants
        </p>
        <h1 className="m-0 font-sans text-title">Branding</h1>
        <p className="m-0 font-sans text-ui text-ink-muted wrap-break-word">
          {restaurant.displayName} · Step {STEP + 1} of {WIZARD_STEPS.length}
        </p>
      </div>

      <p className="m-0 font-serif text-body">
        Choose the colour, layout and pictures customers see on this restaurant’s page. The page
        itself comes from DineFlow’s storefront template, so it stays readable at every restaurant.
      </p>

      {live ? (
        <Callout tone="info" title="This restaurant is live">
          Changes appear on its public page as soon as you save them.
        </Callout>
      ) : null}

      <BrandingForm
        save={saveBranding.bind(null, restaurant.id)}
        name={restaurant.displayName}
        cuisine={restaurant.cuisineTags}
        brandColor={restaurant.brandColor}
        layout={restaurant.storefrontLayout}
        logoUrl={restaurant.logoUrl}
        coverUrl={restaurant.coverUrl}
        logoKey={restaurant.logoPath ?? "no-logo"}
        coverKey={restaurant.coverPath ?? "no-cover"}
      />

      <nav
        aria-label="Setup steps"
        className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4"
      >
        {previous ? (
          <ButtonLink href={`${base}/${previous.slug}`} variant="quiet">
            Back: {previous.label}
          </ButtonLink>
        ) : null}
        <ButtonLink href={`${base}/preview`} variant="quiet">
          Preview storefront
        </ButtonLink>
        {next ? (
          <ButtonLink href={`${base}/${next.slug}`} variant="secondary">
            Next: {next.label}
          </ButtonLink>
        ) : null}
      </nav>
    </main>
  );
}
