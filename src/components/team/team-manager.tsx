import type { ReactNode } from "react";
import type { RestaurantRole } from "@/domain/access";
import { changeRole, inviteMember, removeMember, revokeInvitation } from "@/server/team/actions";
import type { Invitation, TeamMember } from "@/server/team/queries";
import { InvitationList } from "./invitation-list";
import { InviteForm } from "./invite-form";
import type { TeamPowers } from "./model";
import { TeamMembers } from "./team-members";

/**
 * A restaurant's team, for the admin setup wizard and the owner's workspace: who is on it, an
 * invite form limited to the viewer's powers, and the invitations waiting to be accepted.
 *
 * A Server Component on purpose: it binds each Server Action to the restaurant here and hands the
 * bound actions to the client forms (see FormAction in ./model for why not .bind() in the client).
 * The actions still re-check who is asking for this restaurant; a bound id is never trusted.
 */
export function TeamManager({
  restaurantId,
  members,
  invitations,
  powers,
  viewerUserId,
  defaultRole,
  inviteNote,
  inviteBlocked,
  membersNote,
  memberLockedNote,
  invitationLockedNote,
}: {
  restaurantId: string;
  members: readonly TeamMember[];
  invitations: readonly Invitation[];
  powers: TeamPowers;
  viewerUserId: string;
  defaultRole: RestaurantRole;
  /** What this viewer can invite, in a sentence. */
  inviteNote: ReactNode;
  /** Why inviting is closed right now (an archived restaurant), instead of the form. */
  inviteBlocked?: ReactNode;
  /** A note above the list, e.g. why this viewer can't change anyone. */
  membersNote?: ReactNode;
  /** Shown on each member this viewer can't change (other than themselves). */
  memberLockedNote?: string;
  invitationLockedNote?: string;
}) {
  const pendingCount = invitations.filter((i) => i.state === "pending").length;

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <Section
        id="team-members"
        title={`People on the team (${members.length})`}
        description="Removing someone ends their access immediately. The next thing they try is refused, even on a screen they already have open."
      >
        {membersNote ? (
          <p className="m-0 font-sans text-small text-ink-muted">{membersNote}</p>
        ) : null}
        <TeamMembers
          remove={removeMember.bind(null, restaurantId)}
          changeRole={changeRole.bind(null, restaurantId)}
          members={members}
          viewerUserId={viewerUserId}
          powers={powers}
          lockedNote={memberLockedNote}
        />
      </Section>

      {powers.invite.length ? (
        <Section id="team-invite" title="Invite someone" description={inviteNote}>
          {inviteBlocked ?? (
            <InviteForm
              invite={inviteMember.bind(null, restaurantId)}
              roles={powers.invite}
              defaultRole={defaultRole}
            />
          )}
        </Section>
      ) : null}

      <Section
        id="team-invitations"
        title={`Waiting to be accepted (${pendingCount})`}
        description="Each link was shown once, when the invitation was created. If one is lost, invite the same address again: the old link stops working."
      >
        <InvitationList
          revoke={revokeInvitation.bind(null, restaurantId)}
          invitations={invitations}
          revokeRoles={powers.revoke}
          lockedNote={invitationLockedNote}
        />
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="m-0 font-sans text-heading text-brand">
          {title}
        </h2>
        {description ? (
          <p className="m-0 max-w-content font-serif text-body-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
