import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HoursSections } from "@/components/restaurant-config/hours-sections";
import { ProfileForm } from "@/components/restaurant-config/identity-form";
import { LocationForm } from "@/components/restaurant-config/location-form";
import { ConfigSection } from "@/components/restaurant-config/parts";
import { PlatformFields } from "@/components/restaurant-config/platform-fields";
import { ProfileImagesForm } from "@/components/restaurant-config/profile-images-form";
import { NotForYourRole, NotOnTeam } from "@/components/site/not-on-team";
import { WorkspaceNav } from "@/components/site/workspace-nav";
import { getAdminRestaurant } from "@/server/admin/restaurants";
import { requireMembership } from "@/server/guards";
import {
  getUpcomingClosures,
  getWeeklyHours,
  toClosureViews,
} from "@/server/restaurant-config/queries";

export const metadata: Metadata = { title: "Settings" };

/**
 * The restaurant's own settings (brief §6.4, Appendix A). Owners edit their public profile,
 * images, location, hours and operations; managers edit hours and operations. Name, web address,
 * colour and layout stay with DineFlow. The database enforces the same split.
 */
export default async function SettingsPage(props: PageProps<"/restaurant/settings">) {
  const params = await props.searchParams;
  const requested = typeof params.r === "string" ? params.r : undefined;
  const { supabase, viewer, membership, allowed } = await requireMembership(
    "/restaurant/settings",
    requested,
    ["owner", "manager"],
  );
  if (!membership) return <NotOnTeam email={viewer.email} />;

  const nav = (
    <WorkspaceNav
      current="settings"
      role={membership.role}
      restaurantId={membership.restaurantId}
      restaurantName={membership.restaurantName}
      otherRestaurants={viewer.memberships
        .filter((m) => m.restaurantId !== membership.restaurantId)
        .map((m) => ({ id: m.restaurantId, name: m.restaurantName }))}
    />
  );

  if (!allowed) {
    return (
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        {nav}
        <NotForYourRole page="Settings" />
      </main>
    );
  }

  const now = new Date();
  const [restaurant, hours, closures] = await Promise.all([
    getAdminRestaurant(supabase, membership.restaurantId),
    getWeeklyHours(supabase, membership.restaurantId),
    getUpcomingClosures(supabase, membership.restaurantId, now),
  ]);
  if (!restaurant) notFound();
  const isOwner = membership.role === "owner";

  const sections = [
    ...(isOwner
      ? [
          { id: "profile", label: "Profile" },
          { id: "images", label: "Logo and cover" },
          { id: "location", label: "Location" },
        ]
      : []),
    { id: "opening-hours", label: "Opening hours" },
    { id: "closures", label: "Temporary closures" },
    { id: "operations", label: "Orders and preparation" },
  ];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
      {nav}
      <div className="flex flex-col gap-3">
        <h1 className="m-0 font-sans text-title text-ink">Settings</h1>
        <p className="m-0 max-w-content font-serif text-body text-ink-muted">
          {isOwner
            ? "Changes take effect as soon as you save them."
            : "As a manager you can change opening hours, closures and how orders are prepared. Changes take effect as soon as you save them."}
        </p>
        <nav aria-label="On this page">
          <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 font-sans text-label">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex min-h-touch-min items-center">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {isOwner ? (
        <>
          <ConfigSection
            id="profile"
            title="Profile"
            description="What customers read about the restaurant."
          >
            <PlatformFields
              displayName={restaurant.displayName}
              slug={restaurant.slug}
              brandColor={restaurant.brandColor}
              brandOnColor={restaurant.brandOnColor}
              layout={restaurant.storefrontLayout}
            />
            <ProfileForm
              restaurantId={restaurant.id}
              saved={{
                description: restaurant.description,
                cuisineTags: restaurant.cuisineTags,
                publicPhone: restaurant.publicPhone,
              }}
            />
          </ConfigSection>

          <ConfigSection
            id="images"
            title="Logo and cover"
            description="Shown on the restaurant page and in the marketplace."
          >
            <ProfileImagesForm
              restaurantId={restaurant.id}
              logoUrl={restaurant.logoUrl}
              coverUrl={restaurant.coverUrl}
            />
          </ConfigSection>

          <ConfigSection
            id="location"
            title="Location"
            description="How customers find the restaurant."
          >
            <LocationForm
              restaurantId={restaurant.id}
              saved={{
                address: restaurant.address,
                serviceArea: restaurant.serviceArea,
                directions: restaurant.directions,
                latitude: restaurant.latitude,
                longitude: restaurant.longitude,
              }}
            />
          </ConfigSection>
        </>
      ) : null}

      <HoursSections
        restaurantId={restaurant.id}
        hours={hours}
        closures={toClosureViews(closures, now)}
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
