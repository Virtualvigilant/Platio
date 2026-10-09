import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SetupNotice } from "@/components/site/setup-notice";
import { BusinessStatus, Callout, LogoTile, MenuItem, tenantStyle } from "@/components/ui";
import { isValidSlug } from "@/domain/restaurants/slug";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantProfile } from "@/server/queries/restaurants";

async function load(slug: string) {
  if (!isValidSlug(slug)) return { supabase: true, restaurant: null } as const;
  const supabase = await createClient();
  if (!supabase) return { supabase: false, restaurant: null } as const;
  return { supabase: true, restaurant: await getRestaurantProfile(supabase, slug) } as const;
}

export async function generateMetadata(props: PageProps<"/restaurants/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const { restaurant } = await load(slug);
  return { title: restaurant?.name ?? "Restaurant" };
}

export default async function RestaurantPage(props: PageProps<"/restaurants/[slug]">) {
  const { slug } = await props.params;
  const { supabase, restaurant } = await load(slug);
  if (!supabase) {
    return (
      <main className="mx-auto max-w-content px-4 py-8">
        <SetupNotice />
      </main>
    );
  }
  if (!restaurant) notFound();

  return (
    <main
      className="mx-auto flex max-w-content flex-col gap-6 px-4 py-8"
      style={tenantStyle(restaurant.brandColor, restaurant.brandOnColor)}
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <LogoTile name={restaurant.name} logoUrl={restaurant.logoUrl} />
          <div className="min-w-0">
            <h1 className="m-0 font-serif text-display">{restaurant.name}</h1>
            {restaurant.cuisine.length ? (
              <p className="m-0 font-sans text-small text-ink-muted">
                {restaurant.cuisine.join(" · ")}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BusinessStatus
            status={restaurant.state.status}
            detail={restaurant.state.detail}
            size="lg"
          />
          {restaurant.address ? (
            <span className="font-sans text-ui text-ink">{restaurant.address}</span>
          ) : null}
        </div>
        {restaurant.description ? (
          <p className="m-0 font-serif text-body">{restaurant.description}</p>
        ) : null}
        {restaurant.state.status === "paused" ? (
          <Callout tone="warning" title="Not taking new orders right now">
            You can still browse the menu. Check back soon.
          </Callout>
        ) : null}
        {restaurant.pickupInstructions ? (
          <Callout tone="info" title="Pickup instructions">
            {restaurant.pickupInstructions}
          </Callout>
        ) : null}
      </header>

      {restaurant.categories.length === 0 ? (
        <Callout tone="info" title="The menu isn’t published yet">
          This restaurant hasn’t added dishes. Check back soon.
        </Callout>
      ) : (
        restaurant.categories.map((category) => (
          <section key={category.id} aria-labelledby={`cat-${category.id}`}>
            <h2 id={`cat-${category.id}`} className="m-0 font-sans text-heading text-brand">
              {category.name}
            </h2>
            {category.description ? (
              <p className="mt-1 mb-0 font-serif text-body-sm text-ink-muted">
                {category.description}
              </p>
            ) : null}
            {category.items.map((item) => (
              <MenuItem
                key={item.id}
                name={item.name}
                description={item.description}
                priceMinor={item.price_minor}
                prepMinutes={item.prep_minutes}
                tags={item.tags}
                imageUrl={item.imageUrl}
                available={item.availability === "available"}
              />
            ))}
          </section>
        ))
      )}
    </main>
  );
}
