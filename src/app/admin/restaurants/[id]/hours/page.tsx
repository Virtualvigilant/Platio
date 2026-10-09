import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HoursSections } from "@/components/restaurant-config/hours-sections";
import { StepHeader, nextStepAfter } from "@/components/restaurant-config/parts";
import { requirePlatformStaff } from "@/server/guards";
import {
  getUpcomingClosures,
  getWeeklyHours,
  loadRestaurant,
  toClosureViews,
} from "@/server/restaurant-config/queries";

export const metadata: Metadata = { title: "Hours and operations" };

/** Wizard step 4 (brief §7.2, §6.4): weekly hours, temporary closures, order types, prep times. */
export default async function HoursStepPage(props: PageProps<"/admin/restaurants/[id]/hours">) {
  const { id } = await props.params;
  const { supabase } = await requirePlatformStaff(
    `/admin/restaurants/${id}/hours`,
    "restaurants.onboard",
  );
  const restaurant = await loadRestaurant(id);
  if (!restaurant) notFound();

  const now = new Date();
  const [hours, closures] = await Promise.all([
    getWeeklyHours(supabase, restaurant.id),
    getUpcomingClosures(supabase, restaurant.id, now),
  ]);

  return (
    <main className="flex min-w-0 flex-col gap-10">
      <StepHeader slug="hours">
        When customers can order, how they collect, and the preparation times the kitchen starts
        from.
      </StepHeader>
      <HoursSections
        restaurantId={restaurant.id}
        hours={hours}
        closures={toClosureViews(closures, now)}
        wizard
        nextStep={nextStepAfter("hours")}
        operations={{
          pickupEnabled: restaurant.pickupEnabled,
          dineInEnabled: restaurant.dineInEnabled,
          pickupInstructions: restaurant.pickupInstructions,
          prepPresets: restaurant.prepPresets,
          defaultPrepMinutes: restaurant.defaultPrepMinutes,
        }}
      />
    </main>
  );
}
