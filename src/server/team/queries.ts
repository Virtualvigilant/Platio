import "server-only";
import { invitationState, sortInvitations, type InvitationState } from "@/components/team/model";
import type { RestaurantRole } from "@/domain/access";
import type { ServerClient } from "@/lib/supabase/server";

/**
 * A restaurant's team and its invitations, read as the signed-in person so row-level security
 * decides what comes back: owners see their own restaurant, platform staff any restaurant.
 */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TeamMember {
  membershipId: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  role: RestaurantRole;
  /** "invited" only for memberships made before invitations existed; removed people aren't listed. */
  status: "invited" | "active";
  joinedAt: string;
}

/** Owners first, then managers, then staff; oldest first within a role. */
export async function listTeam(
  supabase: ServerClient,
  restaurantId: string,
): Promise<TeamMember[]> {
  if (!UUID.test(restaurantId)) return [];
  const { data, error } = await supabase.rpc("list_restaurant_team", {
    p_restaurant_id: restaurantId,
  });
  if (error) throw new Error(`Could not load the team: ${error.message}`);
  type Row = {
    membership_id: string;
    user_id: string;
    email: string | null;
    display_name: string | null;
    role: RestaurantRole;
    status: "invited" | "active" | "revoked";
    created_at: string;
  };
  return ((data ?? []) as Row[])
    .filter((r) => r.status !== "revoked")
    .map((r) => ({
      membershipId: r.membership_id,
      userId: r.user_id,
      email: r.email,
      displayName: r.display_name,
      role: r.role,
      status: r.status as "invited" | "active",
      joinedAt: r.created_at,
    }));
}

export interface Invitation {
  id: string;
  email: string;
  role: RestaurantRole;
  state: InvitationState;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

/** How many recent invitations to read for the history list. */
const HISTORY_LIMIT = 50;

const INVITATION_COLUMNS = "id, email, role, created_at, expires_at, accepted_at, revoked_at";

type InvitationRow = {
  id: string;
  email: string;
  role: RestaurantRole;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

/**
 * Every pending invitation, then recent history (accepted, expired, revoked). The token is never
 * readable: only its hash is stored, and the API can't select that column.
 */
export async function listInvitations(
  supabase: ServerClient,
  restaurantId: string,
  now: Date = new Date(),
): Promise<Invitation[]> {
  if (!UUID.test(restaurantId)) return [];
  const [pending, recent] = await Promise.all([
    supabase
      .from("restaurant_invitations")
      .select(INVITATION_COLUMNS)
      .eq("restaurant_id", restaurantId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", now.toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("restaurant_invitations")
      .select(INVITATION_COLUMNS)
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);
  const error = pending.error ?? recent.error;
  if (error) throw new Error(`Could not load invitations: ${error.message}`);

  const byId = new Map<string, Invitation>();
  for (const r of [...(pending.data ?? []), ...(recent.data ?? [])] as InvitationRow[]) {
    if (byId.has(r.id)) continue;
    byId.set(r.id, {
      id: r.id,
      email: r.email,
      role: r.role,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      acceptedAt: r.accepted_at,
      revokedAt: r.revoked_at,
      state: invitationState(
        { acceptedAt: r.accepted_at, revokedAt: r.revoked_at, expiresAt: r.expires_at },
        now,
      ),
    });
  }
  return sortInvitations([...byId.values()]);
}

/** Whether the restaurant has an owner who has accepted (publishing needs one). */
export function hasActiveOwner(team: readonly TeamMember[]): boolean {
  return team.some((m) => m.role === "owner" && m.status === "active");
}
