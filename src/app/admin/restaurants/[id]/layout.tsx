import Link from "next/link";
import { notFound } from "next/navigation";
import { RestaurantStatusPill } from "@/components/ui";
import { PUBLICLY_VISIBLE_STATUSES } from "@/domain/restaurants/lifecycle";
import { WIZARD_STEPS, stepState } from "@/domain/restaurants/wizard";
import { requirePlatformStaff } from "@/server/guards";
import { loadReadiness, loadRestaurant } from "@/server/restaurant-config/queries";
import { StepNav, type StepStates } from "./step-nav";

/**
 * The restaurant setup wizard's frame (brief §7.2): who it is, where it stands, and the steps.
 * Every page below renders its own <main> with an h1 and calls its own guard; this layout's
 * check only decides what the frame shows.
 */
export default async function RestaurantWizardLayout({
  children,
  params,
}: LayoutProps<"/admin/restaurants/[id]">) {
  const { id } = await params;
  await requirePlatformStaff(`/admin/restaurants/${id}`, "restaurants.read");
  const [restaurant, readiness] = await Promise.all([loadRestaurant(id), loadReadiness(id)]);
  if (!restaurant) notFound();

  const checks = readiness ?? [];
  const states = Object.fromEntries(
    WIZARD_STEPS.map((s) => [s.slug, stepState(s.slug, checks)]),
  ) as StepStates;
  const passed = checks.filter((c) => c.ok).length;
  const isPublic = PUBLICLY_VISIBLE_STATUSES.includes(restaurant.status);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <nav aria-label="Breadcrumb">
          <p className="m-0 font-serif text-eyebrow text-brand-strong uppercase">
            DineFlow / <Link href="/admin/restaurants">Restaurants</Link>
          </p>
        </nav>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="m-0 min-w-0 font-sans text-title break-words text-ink">
            {restaurant.displayName}
          </p>
          <RestaurantStatusPill status={restaurant.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-sans text-small text-ink-muted">
          {readiness ? (
            <p className="m-0">
              Setup checklist:{" "}
              <Link href={`/admin/restaurants/${id}/publish`}>
                <span className="tabular-nums">
                  {passed} of {checks.length}
                </span>{" "}
                done
              </Link>
            </p>
          ) : (
            <p className="m-0">The setup checklist couldn’t be loaded. Reload the page.</p>
          )}
          {isPublic ? (
            <p className="m-0">
              <Link href={`/restaurants/${restaurant.slug}`}>
                View the restaurant page<span className="sr-only"> for customers</span>
              </Link>
            </p>
          ) : (
            <p className="m-0">Not visible to customers.</p>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-10">
        <StepNav restaurantId={id} states={states} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
