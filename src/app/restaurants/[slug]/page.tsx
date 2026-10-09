import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SetupNotice } from "@/components/site/setup-notice";
import { Storefront } from "@/components/storefront";
import { isValidSlug } from "@/domain/restaurants/slug";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantProfile } from "@/server/queries/restaurants";

// Once per request: metadata and the page share the result.
const load = cache(async (slug: string) => {
  if (!isValidSlug(slug)) return { supabase: true, restaurant: null } as const;
  const supabase = await createClient();
  if (!supabase) return { supabase: false, restaurant: null } as const;
  return { supabase: true, restaurant: await getRestaurantProfile(supabase, slug) } as const;
});

export async function generateMetadata(props: PageProps<"/restaurants/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const { restaurant } = await load(slug);
  return {
    title: restaurant?.name ?? "Restaurant",
    description: restaurant?.description ?? undefined,
  };
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
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <Storefront data={restaurant} />
    </main>
  );
}
