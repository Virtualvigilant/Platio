import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuBuilder } from "@/components/menu-builder";
import { ButtonLink, Callout } from "@/components/ui";
import { WIZARD_STEPS } from "@/domain/restaurants/wizard";
import { getAdminRestaurant } from "@/server/admin/restaurants";
import { requirePlatformStaff } from "@/server/guards";
import { getMenuForEditing } from "@/server/menu/queries";

export const metadata: Metadata = { title: "Menu" };

const STEP = WIZARD_STEPS.findIndex((s) => s.slug === "menu");

/** Setup wizard step 5 (brief §4.3, §7.2): categories, dishes, prices, photos and choices. */
export default async function AdminMenuPage(props: PageProps<"/admin/restaurants/[id]/menu">) {
  const { id } = await props.params;
  const { supabase } = await requirePlatformStaff(
    `/admin/restaurants/${id}/menu`,
    "restaurants.onboard",
  );
  const restaurant = await getAdminRestaurant(supabase, id);
  if (!restaurant) notFound();
  const menu = await getMenuForEditing(supabase, restaurant.id);

  const base = `/admin/restaurants/${restaurant.id}`;
  const previous = WIZARD_STEPS[STEP - 1];
  const next = WIZARD_STEPS[STEP + 1];
  const live = restaurant.status === "published" || restaurant.status === "paused";
  const activeCategories = new Set(menu.categories.filter((c) => c.active).map((c) => c.id));
  const readyToPublish = menu.items.some((i) => i.active && activeCategories.has(i.categoryId));

  return (
    <main className="mx-auto flex max-w-content flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <p className="m-0 font-serif text-eyebrow text-brand-strong uppercase">
          DineFlow / Restaurants
        </p>
        <h1 className="m-0 font-sans text-title">Menu</h1>
        <p className="m-0 font-sans text-ui text-ink-muted wrap-break-word">
          {restaurant.displayName} · Step {STEP + 1} of {WIZARD_STEPS.length}
        </p>
      </div>

      <p className="m-0 font-serif text-body">
        Build the menu customers order from: categories, dishes with their prices and photos, and
        the choices that go with them. The restaurant’s owner and managers can change it later from
        their workspace.
      </p>

      {live ? (
        <Callout tone="info" title="This restaurant is live">
          Menu changes appear on its public page as soon as you save them.
        </Callout>
      ) : null}
      {readyToPublish ? null : (
        <Callout tone="warning" title="Not ready to publish yet">
          Add at least one dish to a category that isn’t archived.
        </Callout>
      )}

      <MenuBuilder restaurantId={restaurant.id} menu={menu} />

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
