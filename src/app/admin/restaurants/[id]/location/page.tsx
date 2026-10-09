import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocationForm } from "@/components/restaurant-config/location-form";
import { StepHeader, nextStepAfter } from "@/components/restaurant-config/parts";
import { requirePlatformStaff } from "@/server/guards";
import { saveLocation } from "@/server/restaurant-config/actions";
import { loadRestaurant } from "@/server/restaurant-config/queries";

export const metadata: Metadata = { title: "Restaurant location" };

/** Wizard step 3 (brief §7.2): address, service area, directions and map position. */
export default async function LocationStepPage(
  props: PageProps<"/admin/restaurants/[id]/location">,
) {
  const { id } = await props.params;
  await requirePlatformStaff(`/admin/restaurants/${id}/location`, "restaurants.onboard");
  const restaurant = await loadRestaurant(id);
  if (!restaurant) notFound();

  return (
    <main className="flex min-w-0 flex-col gap-6">
      <StepHeader slug="location">How customers find the restaurant on campus.</StepHeader>
      <LocationForm
        save={saveLocation.bind(null, restaurant.id)}
        wizard
        nextStep={nextStepAfter("location")}
        saved={{
          address: restaurant.address,
          serviceArea: restaurant.serviceArea,
          directions: restaurant.directions,
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
        }}
      />
    </main>
  );
}
