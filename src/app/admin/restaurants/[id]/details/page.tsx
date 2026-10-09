import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IdentityForm } from "@/components/restaurant-config/identity-form";
import { StepHeader, nextStepAfter } from "@/components/restaurant-config/parts";
import { requirePlatformStaff } from "@/server/guards";
import { saveIdentity } from "@/server/restaurant-config/actions";
import { loadRestaurant } from "@/server/restaurant-config/queries";

export const metadata: Metadata = { title: "Restaurant identity" };

/** Wizard step 1 (brief §7.2): names, web address, description, labels and contacts. */
export default async function IdentityStepPage(
  props: PageProps<"/admin/restaurants/[id]/details">,
) {
  const { id } = await props.params;
  await requirePlatformStaff(`/admin/restaurants/${id}/details`, "restaurants.onboard");
  const restaurant = await loadRestaurant(id);
  if (!restaurant) notFound();

  return (
    <main className="flex min-w-0 flex-col gap-6">
      <StepHeader slug="details">
        Who the restaurant is. Customers see everything except the private details.
      </StepHeader>
      <IdentityForm
        save={saveIdentity.bind(null, restaurant.id)}
        slugLocked={restaurant.firstPublishedAt !== null}
        nextStep={nextStepAfter("details")}
        saved={{
          displayName: restaurant.displayName,
          slug: restaurant.slug,
          description: restaurant.description,
          cuisineTags: restaurant.cuisineTags,
          publicPhone: restaurant.publicPhone,
          legalName: restaurant.private?.legalName ?? null,
          contactEmail: restaurant.private?.contactEmail ?? null,
          contactPhone: restaurant.private?.contactPhone ?? null,
        }}
      />
    </main>
  );
}
