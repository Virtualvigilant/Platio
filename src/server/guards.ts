import "server-only";
import { notFound, redirect } from "next/navigation";
import { platformCan, type PlatformPermission, type RestaurantRole } from "@/domain/access";
import { ConfigError } from "@/lib/env";
import { createClient, type ServerClient } from "@/lib/supabase/server";
import { failure, type FormState } from "./actions";
import { getViewer, type Membership, type Viewer } from "./session";

/**
 * Access checks. Pages call the require* functions in the page itself (layouts render in parallel
 * with pages, so a layout check alone does not stop the page's queries). Server Actions call the
 * authorize* functions, which return a form error instead of redirecting. These decide what to
 * render and allow; the database's row-level security decides what data comes back.
 */

export async function requireViewer(nextPath: string) {
  const supabase = await createClient();
  if (!supabase) throw new ConfigError("Supabase is not configured");
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return { supabase, viewer };
}

export async function requirePlatformStaff(nextPath: string, permission?: PlatformPermission) {
  const ctx = await requireViewer(nextPath);
  if (!ctx.viewer.platformRole) notFound();
  if (permission && !platformCan(ctx.viewer.platformRole, permission)) notFound();
  return ctx;
}

/**
 * A restaurant workspace page: the viewer's membership for the restaurant chosen with ?r=
 * (falling back to their first), limited to the given roles. Platform staff are not members and
 * use the admin console instead.
 */
export async function requireMembership(
  nextPath: string,
  requestedRestaurantId: string | undefined,
  roles: readonly RestaurantRole[] = ["owner", "manager", "staff"],
) {
  const ctx = await requireViewer(nextPath);
  const memberships = ctx.viewer.memberships;
  const current =
    memberships.find((m) => m.restaurantId === requestedRestaurantId) ?? memberships[0];
  if (!current) return { ...ctx, membership: null as Membership | null, allowed: false };
  return {
    ...ctx,
    membership: current as Membership | null,
    allowed: roles.includes(current.role),
  };
}

type Authorized = { ok: true; supabase: ServerClient; viewer: Viewer };
type Denied = { ok: false; state: FormState };

const SIGNED_OUT: Denied = {
  ok: false,
  state: failure("Your session has ended. Sign in again, then retry."),
};
const NOT_CONFIGURED: Denied = {
  ok: false,
  state: failure("Saving isn’t set up on this server yet."),
};
const NO_PERMISSION: Denied = {
  ok: false,
  state: failure("You don’t have permission to do that."),
};

/** For actions only platform staff may take. */
export async function authorizePlatform(
  permission: PlatformPermission,
): Promise<Authorized | Denied> {
  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;
  const viewer = await getViewer();
  if (!viewer) return SIGNED_OUT;
  if (!viewer.platformRole || !platformCan(viewer.platformRole, permission)) return NO_PERMISSION;
  return { ok: true, supabase, viewer };
}

/**
 * For actions on one restaurant: allowed for its members with one of `roles`, or for platform
 * staff holding `platformPermission`. The database checks again; this gives a clear message early.
 */
export async function authorizeRestaurant(
  restaurantId: string,
  roles: readonly RestaurantRole[],
  platformPermission: PlatformPermission | null = "restaurants.onboard",
): Promise<Authorized | Denied> {
  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;
  const viewer = await getViewer();
  if (!viewer) return SIGNED_OUT;
  const member = viewer.memberships.find((m) => m.restaurantId === restaurantId);
  const asMember = !!member && roles.includes(member.role);
  const asPlatform =
    !!platformPermission &&
    !!viewer.platformRole &&
    platformCan(viewer.platformRole, platformPermission);
  if (!asMember && !asPlatform) return NO_PERMISSION;
  return { ok: true, supabase, viewer };
}
