import Link from "next/link";
import { SetupNotice } from "@/components/site/setup-notice";
import { Button, Callout, RestaurantCard } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { cleanSearch, listMarketplaceRestaurants } from "@/server/queries/restaurants";

export default async function MarketplacePage(props: PageProps<"/">) {
  const params = await props.searchParams;
  const q = cleanSearch(typeof params.q === "string" ? params.q : undefined);
  const supabase = await createClient();
  const restaurants = supabase ? await listMarketplaceRestaurants(supabase, q) : null;

  return (
    <main className="mx-auto flex max-w-content flex-col gap-6 px-4 py-8 sm:py-12">
      <div>
        <h1 className="m-0 font-serif text-display">What are you craving?</h1>
        <p className="mt-2 mb-0 font-serif text-lede text-ink-muted">
          Order ahead, then collect when it’s ready.
        </p>
      </div>

      <form role="search" action="/" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search restaurants
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search restaurants or dishes"
          className="min-h-touch-min min-w-0 flex-1 rounded-sm border border-line-strong bg-surface-raised px-3 font-sans text-ui text-ink placeholder:text-ink-muted"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {restaurants === null ? (
        <SetupNotice />
      ) : restaurants.length === 0 ? (
        <Callout
          tone="info"
          title={q ? `No restaurants match “${q}”` : "No restaurants are taking part yet"}
          actions={
            q ? (
              <Link href="/" className="font-sans text-label">
                Show all restaurants
              </Link>
            ) : undefined
          }
        >
          {q
            ? "Try a shorter search, or browse every restaurant."
            : "Restaurants appear here once they are published."}
        </Callout>
      ) : (
        <section aria-labelledby="restaurants-heading" className="flex flex-col gap-3">
          <h2 id="restaurants-heading" className="m-0 font-sans text-heading text-brand">
            {q ? `Results for “${q}”` : "Restaurants"}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {restaurants.map((r) => (
              <li key={r.id}>
                <RestaurantCard
                  href={`/restaurants/${r.slug}`}
                  name={r.name}
                  cuisine={r.cuisine}
                  status={r.state.status}
                  statusDetail={r.state.detail}
                  priceCue={r.priceCue}
                  logoUrl={r.logoUrl}
                  tenantColor={r.brandColor}
                  tenantOnColor={r.brandOnColor}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
