import type { Metadata } from "next";
import { NotForYourRole, NotOnTeam } from "@/components/site/not-on-team";
import { WorkspaceNav } from "@/components/site/workspace-nav";
import { teamPowers } from "@/components/team/model";
import { TeamManager } from "@/components/team/team-manager";
import { Callout } from "@/components/ui";
import { requireMembership } from "@/server/guards";
import { listInvitations, listTeam } from "@/server/team/queries";

export const metadata: Metadata = { title: "Team" };

/**
 * The owner's team page (brief §6.4): invite managers and staff, change their roles, remove
 * them. Owners themselves are added, removed and transferred by DineFlow.
 */
export default async function TeamPage(props: PageProps<"/restaurant/team">) {
  const params = await props.searchParams;
  const requested = typeof params.r === "string" ? params.r : undefined;
  const { supabase, viewer, membership, allowed } = await requireMembership(
    "/restaurant/team",
    requested,
    ["owner"],
  );
  if (!membership) return <NotOnTeam email={viewer.email} />;

  const nav = (
    <WorkspaceNav
      current="team"
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
        <NotForYourRole page="Team" />
      </main>
    );
  }

  const restaurantId = membership.restaurantId;
  const [members, invitations, restaurant] = await Promise.all([
    listTeam(supabase, restaurantId),
    listInvitations(supabase, restaurantId),
    supabase.from("restaurants").select("status").eq("id", restaurantId).maybeSingle(),
  ]);
  const archived = restaurant.data?.status === "archived";
  const powers = teamPowers({ platformRole: viewer.platformRole, restaurantRole: membership.role });

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
      {nav}
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-sans text-title text-ink">Team</h1>
        <p className="m-0 max-w-content font-serif text-body text-ink-muted">
          Invite managers and kitchen and counter staff, change their roles, or remove them. To add
          or remove an owner, contact DineFlow support.
        </p>
      </div>

      <TeamManager
        restaurantId={restaurantId}
        members={members}
        invitations={invitations}
        powers={powers}
        viewerUserId={viewer.userId}
        defaultRole="staff"
        inviteNote="Each invitation is for one email address and lasts 7 days. Inviting the same address again replaces the earlier invitation."
        inviteBlocked={
          archived ? (
            <Callout tone="warning" title="This restaurant is archived">
              <p>New people can’t be invited while it’s archived. Contact DineFlow support.</p>
            </Callout>
          ) : undefined
        }
        memberLockedNote="Only DineFlow can change or remove an owner."
        invitationLockedNote="Only DineFlow can revoke an owner invitation."
      />
    </main>
  );
}
