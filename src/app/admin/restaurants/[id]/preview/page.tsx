import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Storefront } from "@/components/storefront";
import { ButtonLink, Callout, RestaurantStatusPill } from "@/components/ui";
import { requirePlatformStaff } from "@/server/guards";
import { getRestaurantPreview } from "@/server/queries/restaurants";
import { PreviewFrame } from "./preview-frame";

export const metadata: Metadata = {
  title: "Storefront preview",
  robots: { index: false, follow: false },
};

/**
 * The generated storefront for any restaurant, including drafts, for platform staff only
 * (brief §4.2 step 3, §7.2 step 8, §7.3). Rendered by the same component as the public page.
 */
export default async function PreviewPage(props: PageProps<"/admin/restaurants/[id]/preview">) {
  const { id } = await props.params;
  const { supabase } = await requirePlatformStaff(
    `/admin/restaurants/${id}/preview`,
    "restaurants.read",
  );
  const restaurant = await getRestaurantPreview(supabase, id);
  if (!restaurant) notFound();

  const isPublic = restaurant.status === "published" || restaurant.status === "paused";
  const base = `/admin/restaurants/${restaurant.id}`;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <p className="m-0 font-serif text-eyebrow text-brand-strong uppercase">
          DineFlow / Restaurants
        </p>
        <h1 className="m-0 font-sans text-title wrap-break-word">Preview: {restaurant.name}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <RestaurantStatusPill status={restaurant.status} />
          {isPublic ? (
            <Link
              href={`/restaurants/${restaurant.slug}`}
              className="inline-flex min-h-touch-min items-center font-sans text-label"
            >
              Open the public page
            </Link>
          ) : null}
        </div>
      </div>

      {isPublic ? (
        <Callout tone="info" title="This storefront is live">
          <p>
            Customers see it at <code>/restaurants/{restaurant.slug}</code>. Changes appear as soon
            as they’re saved.
          </p>
        </Callout>
      ) : (
        <Callout tone="warning">
          <p>
            <strong className="font-bold">Preview.</strong> Customers can’t see this restaurant
            until it’s published.
          </p>
          <p className="mt-2">
            Open, closed and paused labels show what customers would see if it were published now.
          </p>
        </Callout>
      )}

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`${base}/publish`} variant="secondary">
          Back to preview and publish
        </ButtonLink>
        <ButtonLink href={`${base}/branding`} variant="quiet">
          Edit branding
        </ButtonLink>
      </div>

      <section aria-label="Storefront preview">
        <PreviewFrame>
          <Storefront data={restaurant} headingLevel={2} />
        </PreviewFrame>
      </section>
    </main>
  );
}
