"use server";

import { refresh } from "next/cache";
import {
  ROLE_PHRASES,
  invitationLink,
  memberName,
  teamPowers,
  type TeamPowers,
} from "@/components/team/model";
import { invitationSchema } from "@/domain/restaurants/config";
import { getSupabaseConfig } from "@/lib/env";
import type { ServerClient } from "@/lib/supabase/server";
import {
  dbErrorMessage,
  failure,
  formValues,
  fromDb,
  fromValidation,
  success,
  text,
  type FormState,
} from "@/server/actions";
import { authorizeRestaurant } from "@/server/guards";
import type { Viewer } from "@/server/session";
import { UUID, listTeam, type TeamMember } from "./queries";

/**
 * Managing a restaurant's team (brief §3.1, §6.4, §7.2 step 7). The restaurant id is bound by the
 * page (see TeamManager) but travels through the browser, and the member or invitation id comes
 * from the form, so neither is trusted: every action checks who is asking for this restaurant,
 * then that the member or invitation belongs to it, then writes as the signed-in person so
 * row-level security and the database's own checks (only platform staff create owners; a
 * restaurant keeps at least one owner) still apply.
 *
 *   invite, revoke invitations   platform staff who onboard (any role); owners (managers, staff)
 *   change roles, remove people  super-admins (any role); owners (managers, staff, not themselves)
 */

/** An invitation's one-time link is returned once, to the person who created it. */
export type InviteState =
  | FormState
  | { status: "success"; message: string; link: string; email: string; expiresAt: string };

const NOT_FOUND =
  "We couldn’t find that restaurant. It may have been removed, or you may not have access to it.";
const MEMBER_NOT_FOUND =
  "We couldn’t find that person on this team. They may already have been removed. Reload the page.";
const INVITATION_NOT_FOUND =
  "We couldn’t find that invitation. It may already have been revoked. Reload the page.";
const TRY_AGAIN_TEAM = "We couldn’t load the team. Reload the page and try again.";

function powersFor(viewer: Viewer, restaurantId: string): TeamPowers {
  const membership = viewer.memberships.find((m) => m.restaurantId === restaurantId);
  return teamPowers({
    platformRole: viewer.platformRole,
    restaurantRole: membership?.role ?? null,
  });
}

/** The member, looked up through the team list (which checks the viewer may see this team). */
async function findMember(
  supabase: ServerClient,
  restaurantId: string,
  membershipId: string,
): Promise<TeamMember | null | "error"> {
  try {
    const team = await listTeam(supabase, restaurantId);
    return team.find((m) => m.membershipId === membershipId) ?? null;
  } catch {
    return "error";
  }
}

// ---------------------------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------------------------

export async function inviteMember(
  restaurantId: string,
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const auth = await authorizeRestaurant(restaurantId, ["owner"], "restaurants.onboard");
  if (!auth.ok) {
    return auth.state.status === "error"
      ? { ...auth.state, values: formValues(formData) }
      : auth.state;
  }
  if (!UUID.test(restaurantId)) return failure(NOT_FOUND);
  const { supabase, viewer } = auth;

  const parsed = invitationSchema.safeParse({
    email: text(formData, "email"),
    role: text(formData, "role"),
  });
  if (!parsed.success) return fromValidation(parsed.error, formData);
  const { email, role } = parsed.data;

  if (!powersFor(viewer, restaurantId).invite.includes(role)) {
    return failure("Check the highlighted fields and try again.", {
      fieldErrors: {
        role:
          role === "owner"
            ? "Only DineFlow can invite an owner. Choose manager or staff, or contact DineFlow support."
            : "You can’t invite that role. Choose another.",
      },
      values: formValues(formData),
    });
  }

  const { data, error } = await supabase.rpc("create_restaurant_invitation", {
    p_restaurant_id: restaurantId,
    p_email: email,
    p_role: role,
  });
  if (error) {
    const message = dbErrorMessage(error, "We couldn’t create the invitation. Try again.");
    // "This person is already on the team" belongs next to the email field.
    if (error.code === "23505") {
      return failure("Check the highlighted fields and try again.", {
        fieldErrors: { email: message },
        values: formValues(formData),
      });
    }
    return failure(message, { values: formValues(formData) });
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    { invitation_id: string; token: string; expires_at: string } | undefined;
  const config = getSupabaseConfig();
  if (!row?.token || !config.ok) {
    return failure("We couldn’t create the invitation. Try again.", {
      values: formValues(formData),
    });
  }

  refresh();
  return {
    status: "success",
    message: `Invitation created for ${email}.`,
    link: invitationLink(config.siteUrl, row.token),
    email,
    expiresAt: row.expires_at,
  };
}

/** Form fields: invitationId. */
export async function revokeInvitation(
  restaurantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizeRestaurant(restaurantId, ["owner"], "restaurants.onboard");
  if (!auth.ok) return auth.state;
  const invitationId = text(formData, "invitationId");
  if (!UUID.test(restaurantId) || !UUID.test(invitationId)) return failure(INVITATION_NOT_FOUND);
  const { supabase, viewer } = auth;

  const { data: invitation, error: loadError } = await supabase
    .from("restaurant_invitations")
    .select("id, email, role, accepted_at, revoked_at")
    .eq("id", invitationId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (loadError) return fromDb(loadError);
  if (!invitation) return failure(INVITATION_NOT_FOUND);

  if (!powersFor(viewer, restaurantId).revoke.includes(invitation.role)) {
    return failure("Only DineFlow can revoke an owner invitation. Contact DineFlow support.");
  }
  if (invitation.accepted_at) {
    return failure(
      "This invitation was already accepted. Remove the person from the team instead.",
    );
  }
  if (invitation.revoked_at) {
    refresh();
    return success(`The invitation for ${invitation.email} was already revoked.`);
  }

  const { error } = await supabase.rpc("revoke_restaurant_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) return fromDb(error, undefined, "We couldn’t revoke the invitation. Try again.");

  refresh();
  return success(`Invitation for ${invitation.email} revoked. Its link no longer works.`);
}

// ---------------------------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------------------------

/**
 * Form fields: membershipId. Removing someone ends their access immediately: every page and
 * query checks the membership again on the next request.
 */
export async function removeMember(
  restaurantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizeRestaurant(restaurantId, ["owner"], "users.manage");
  if (!auth.ok) return auth.state;
  const membershipId = text(formData, "membershipId");
  if (!UUID.test(restaurantId) || !UUID.test(membershipId)) return failure(MEMBER_NOT_FOUND);
  const { supabase, viewer } = auth;

  const member = await findMember(supabase, restaurantId, membershipId);
  if (member === "error") return failure(TRY_AGAIN_TEAM);
  if (!member) return failure(MEMBER_NOT_FOUND);
  if (member.userId === viewer.userId) {
    return failure("You can’t remove yourself. Ask another owner or DineFlow support.");
  }
  if (!powersFor(viewer, restaurantId).manage.includes(member.role)) {
    return failure(
      member.role === "owner"
        ? "Only DineFlow can remove an owner. Contact DineFlow support."
        : "You don’t have permission to do that.",
    );
  }

  const { data, error } = await supabase
    .from("restaurant_memberships")
    .update({ status: "revoked" })
    .eq("id", membershipId)
    .eq("restaurant_id", restaurantId)
    .neq("status", "revoked")
    .select("id");
  if (error) return fromDb(error, undefined, "We couldn’t remove them. Try again.");
  if (!data?.length) return failure("You don’t have permission to do that.");

  refresh();
  return success(
    `${memberName(member)} was removed from the team and can no longer use this restaurant’s workspace.`,
  );
}

/** Form fields: membershipId, role. */
export async function changeRole(
  restaurantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizeRestaurant(restaurantId, ["owner"], "users.manage");
  if (!auth.ok) return auth.state;
  const membershipId = text(formData, "membershipId");
  if (!UUID.test(restaurantId) || !UUID.test(membershipId)) return failure(MEMBER_NOT_FOUND);
  const { supabase, viewer } = auth;

  const parsedRole = invitationSchema.shape.role.safeParse(text(formData, "role"));
  if (!parsedRole.success) {
    return failure("Choose a role.", { fieldErrors: { role: "Choose a role." } });
  }
  const role = parsedRole.data;

  const member = await findMember(supabase, restaurantId, membershipId);
  if (member === "error") return failure(TRY_AGAIN_TEAM);
  if (!member) return failure(MEMBER_NOT_FOUND);
  const name = memberName(member);
  if (member.userId === viewer.userId) {
    return failure("You can’t change your own role. Ask another owner or DineFlow support.");
  }
  const powers = powersFor(viewer, restaurantId);
  if (!powers.manage.includes(member.role) || !powers.manage.includes(role)) {
    return failure(
      member.role === "owner" || role === "owner"
        ? "Only DineFlow can add or change an owner. Contact DineFlow support."
        : "You don’t have permission to do that.",
      { fieldErrors: { role: "Choose manager or staff." } },
    );
  }
  if (member.role === role)
    return success(`Nothing changed: ${name} is already ${ROLE_PHRASES[role]}.`);

  const { data, error } = await supabase
    .from("restaurant_memberships")
    .update({ role })
    .eq("id", membershipId)
    .eq("restaurant_id", restaurantId)
    .neq("status", "revoked")
    .select("id");
  if (error) return fromDb(error, undefined, "We couldn’t change the role. Try again.");
  if (!data?.length) return failure("You don’t have permission to do that.");

  refresh();
  return success(`${name} is now ${ROLE_PHRASES[role]}.`);
}
