import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDay, memberName, teamPowers } from "@/components/team/model";
import { TeamManager } from "@/components/team/team-manager";
import { ButtonLink, Callout } from "@/components/ui";
import { WIZARD_STEPS } from "@/domain/restaurants/wizard";
import { getAdminRestaurant } from "@/server/admin/restaurants";
import { requirePlatformStaff } from "@/server/guards";
import { listInvitations, listTeam } from "@/server/team/queries";

export const metadata: Metadata = { title: "Owner and staff" };

const STEP = "team";

/**
 * Wizard step 7 (brief §4.3 step 6, §7.2 step 7): invite the owner and any managers or staff,
 * and see who has accepted. Publishing needs an owner who has accepted, not just an invitation.
 */
export default async function TeamStepPage(props: PageProps<"/admin/restaurants/[id]/team">) {
  const { id } = await props.params;
  const { supabase, viewer } = await requirePlatformStaff(
    `/admin/restaurants/${id}/team`,
    "restaurants.onboard",
  );
  const restaurant = await getAdminRestaurant(supabase, id);
  if (!restaurant) notFound();

  const [members, invitations] = await Promise.all([
    listTeam(supabase, restaurant.id),
    listInvitations(supabase, restaurant.id),
  ]);
  const powers = teamPowers({
    platformRole: viewer.platformRole,
    restaurantRole: viewer.memberships.find((m) => m.restaurantId === restaurant.id)?.role ?? null,
  });
  const owners = members.filter((m) => m.role === "owner" && m.status === "active");
  const ownerInvitation = invitations.find((i) => i.state === "pending" && i.role === "owner");
  const index = WIZARD_STEPS.findIndex((s) => s.slug === STEP);
  const next = WIZARD_STEPS[index + 1];

  return (
    <main className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="m-0 font-sans text-small text-ink-muted">
          Step {index + 1} of {WIZARD_STEPS.length}
        </p>
        <h1 className="m-0 font-sans text-title text-ink">{WIZARD_STEPS[index].label}</h1>
        <p className="m-0 max-w-content font-serif text-body text-ink-muted">
          Invite the people who will run {restaurant.displayName} on DineFlow: an owner, and any
          managers or kitchen and counter staff.
        </p>
      </div>

      {owners.length ? (
        <Callout title="An owner has accepted">
          <p>
            {owners.map((o) => memberName(o)).join(", ")} {owners.length === 1 ? "has" : "have"}{" "}
            joined as {owners.length === 1 ? "owner" : "owners"}, so this step is done.
          </p>
        </Callout>
      ) : ownerInvitation ? (
        <Callout tone="warning" title="Waiting for the owner to accept">
          <p>
            Publishing needs an owner who has accepted their invitation, so someone at the
            restaurant can take orders. The invitation for{" "}
            <span className="break-all">{ownerInvitation.email}</span> expires on{" "}
            {formatDay(ownerInvitation.expiresAt)}. If the link was lost, invite the same address
            again to get a new one.
          </p>
        </Callout>
      ) : (
        <Callout tone="warning" title="Invite an owner">
          <p>
            Publishing needs an owner who has accepted their invitation, so someone at the
            restaurant can take orders. A pending invitation isn’t enough.
          </p>
        </Callout>
      )}

      <TeamManager
        restaurantId={restaurant.id}
        members={members}
        invitations={invitations}
        powers={powers}
        viewerUserId={viewer.userId}
        defaultRole={owners.length || ownerInvitation ? "staff" : "owner"}
        inviteNote="Each invitation is for one email address and lasts 7 days. Inviting the same address again replaces the earlier invitation."
        inviteBlocked={
          restaurant.status === "archived" ? (
            <Callout tone="warning" title="This restaurant is archived">
              <p>Reactivate it from Preview and publish before inviting people.</p>
            </Callout>
          ) : undefined
        }
        membersNote={
          powers.manage.length
            ? undefined
            : "Only a super-admin can change someone’s role or remove them from a team."
        }
      />

      {next ? (
        <div>
          <ButtonLink href={`/admin/restaurants/${restaurant.id}/${next.slug}`} variant="secondary">
            Continue to {next.label}
          </ButtonLink>
        </div>
      ) : null}
    </main>
  );
}
