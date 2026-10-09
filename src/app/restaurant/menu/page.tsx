import type { Metadata } from "next";
import { AvailabilityList, MenuBuilder } from "@/components/menu-builder";
import { NotForYourRole, NotOnTeam } from "@/components/site/not-on-team";
import { WorkspaceNav } from "@/components/site/workspace-nav";
import { restaurantCan } from "@/domain/access";
import { requireMembership } from "@/server/guards";
import { getMenuForEditing } from "@/server/menu/queries";

export const metadata: Metadata = { title: "Menu" };

/**
 * The restaurant's own menu (brief §6.3): owners and managers edit everything; counter staff
 * mark dishes unavailable and available again.
 */
export default async function RestaurantMenuPage(props: PageProps<"/restaurant/menu">) {
  const params = await props.searchParams;
  const requested = typeof params.r === "string" ? params.r : undefined;
  const { supabase, viewer, membership, allowed } = await requireMembership(
    "/restaurant/menu",
    requested,
    ["owner", "manager", "staff"],
  );
  if (!membership) return <NotOnTeam email={viewer.email} />;

  const nav = (
    <WorkspaceNav
      current="menu"
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
        <NotForYourRole page="The menu" />
      </main>
    );
  }

  const menu = await getMenuForEditing(supabase, membership.restaurantId);
  const canEdit = restaurantCan(membership.role, "menu.edit");

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      {nav}
      <div className="flex max-w-content flex-col gap-6">
        <h1 className="m-0 font-sans text-title">{canEdit ? "Menu" : "Dish availability"}</h1>
        {canEdit ? (
          <MenuBuilder restaurantId={membership.restaurantId} menu={menu} />
        ) : (
          <AvailabilityList restaurantId={membership.restaurantId} menu={menu} />
        )}
      </div>
    </main>
  );
}
