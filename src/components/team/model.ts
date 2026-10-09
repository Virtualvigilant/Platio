/**
 * Team rules for the screens and Server Actions (brief §3, §3.1, §6.4, §7.2 step 7): who may
 * invite, withdraw invitations, change roles and remove people, plus the wording and dates the
 * team screens show. Plain TypeScript, safe in client bundles. The database enforces the same
 * rules (create_restaurant_invitation, the membership policies and guard_membership_change); this
 * decides what to offer and gives a clear message before a request is refused.
 */
import {
  RESTAURANT_ROLES,
  platformCan,
  restaurantCan,
  type PlatformRole,
  type RestaurantRole,
} from "@/domain/access";
import { BUSINESS_TIME_ZONE } from "@/domain/time";
import type { FormState } from "@/server/actions";

/** The starting state for useActionState (IDLE in src/server/actions.ts, without its imports). */
export const IDLE: FormState = { status: "idle" };

/**
 * A Server Action already bound to its restaurant (or token), passed from a Server Component.
 * Binding in the Server Component (not with .bind() in the client) matters: when a form is posted
 * without JavaScript, React re-renders the client component and checks the action's bound
 * arguments; a client-side .bind() makes a new pending promise on every attempt, so that render
 * never finishes and the request spins.
 */
export type FormAction<S = FormState> = (state: S, formData: FormData) => Promise<S>;

export const ROLE_LABELS: Readonly<Record<RestaurantRole, string>> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
};

/** "You’ve been invited to join X as an owner." */
export const ROLE_PHRASES: Readonly<Record<RestaurantRole, string>> = {
  owner: "an owner",
  manager: "a manager",
  staff: "a member of staff",
};

/** What each role can do, from RESTAURANT_GRANTS in src/domain/access.ts. */
export const ROLE_DESCRIPTIONS: Readonly<Record<RestaurantRole, string>> = {
  owner: "Everything for this restaurant: orders, menu, settings, reports and the team.",
  manager: "Orders, menu, opening hours and reports. Can’t manage the team.",
  staff: "Orders and sold-out items, for the kitchen and counter.",
};

export interface TeamPowers {
  /** Roles this person may invite. Empty means they can't invite anyone. */
  invite: RestaurantRole[];
  /** Roles whose pending invitations this person may revoke. */
  revoke: RestaurantRole[];
  /** Roles of members this person may change or remove; also the roles they may give. */
  manage: RestaurantRole[];
}

/**
 * Platform staff who onboard restaurants invite any role, owners included. Changing roles and
 * removing people is a platform-wide account change, kept to staff who can manage users
 * (super-admins). A restaurant's owners invite and manage managers and staff; adding, removing or
 * transferring an owner is left to the platform.
 */
export function teamPowers(viewer: {
  platformRole: PlatformRole | null;
  restaurantRole: RestaurantRole | null;
}): TeamPowers {
  const onboards = !!viewer.platformRole && platformCan(viewer.platformRole, "restaurants.onboard");
  const managesUsers = !!viewer.platformRole && platformCan(viewer.platformRole, "users.manage");
  const runsTeam = !!viewer.restaurantRole && restaurantCan(viewer.restaurantRole, "team.manage");
  const limited: RestaurantRole[] = runsTeam ? ["manager", "staff"] : [];
  return {
    invite: onboards ? [...RESTAURANT_ROLES] : limited,
    revoke: onboards ? [...RESTAURANT_ROLES] : limited,
    manage: managesUsers ? [...RESTAURANT_ROLES] : limited,
  };
}

/** Nobody changes their own role or removes themselves here; another owner or DineFlow does. */
export function canManageMember(
  powers: TeamPowers,
  member: { role: RestaurantRole; userId: string },
  viewerUserId: string,
): boolean {
  return member.userId !== viewerUserId && powers.manage.includes(member.role);
}

export function memberName(member: { displayName: string | null; email: string | null }): string {
  return member.displayName?.trim() || member.email || "Unnamed account";
}

// ---------------------------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------------------------

export type InvitationState = "pending" | "expired" | "accepted" | "revoked";

/** Same order of precedence as public.get_restaurant_invitation. */
export function invitationState(
  invitation: { acceptedAt: string | null; revokedAt: string | null; expiresAt: string },
  now: Date,
): InvitationState {
  if (invitation.revokedAt) return "revoked";
  if (invitation.acceptedAt) return "accepted";
  if (new Date(invitation.expiresAt).getTime() <= now.getTime()) return "expired";
  return "pending";
}

/** Pending invitations first, then the rest; newest first within each group. */
export function sortInvitations<T extends { state: InvitationState; createdAt: string }>(
  list: readonly T[],
): T[] {
  return [...list].sort((a, b) => {
    const pa = a.state === "pending" ? 0 : 1;
    const pb = b.state === "pending" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/** The one-time link an invitee opens: <site>/invitations/<token>. */
export function invitationLink(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/invitations/${encodeURIComponent(token)}`;
}

/** Tokens from create_restaurant_invitation are 64 hex characters; this rejects obvious junk. */
export function isPlausibleInvitationToken(token: string): boolean {
  return /^[A-Za-z0-9]{32,128}$/.test(token);
}

/**
 * Whether a signed-in address could be the one an invitation was sent to, judged from the
 * masked hint ("ow•••@example.com": the first two characters and the domain). A false result is
 * certain; a true one still needs the database's check.
 */
export function emailMatchesHint(email: string | null, hint: string): boolean {
  if (!email) return false;
  const [prefix, suffix] = hint.toLowerCase().split("•••");
  if (prefix === undefined || suffix === undefined) return true;
  const e = email.trim().toLowerCase();
  return e.startsWith(prefix) && e.endsWith(suffix);
}

// ---------------------------------------------------------------------------------------------
// Dates, shown in the business time zone
// ---------------------------------------------------------------------------------------------

const DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "short",
});
const DAY_YEAR = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});
const CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "16 Oct", or "16 Oct 2026" with the year. */
export function formatDay(iso: string, withYear = false): string {
  return (withYear ? DAY_YEAR : DAY).format(new Date(iso));
}

/** "16 Oct at 14:05". */
export function formatDayAndTime(iso: string): string {
  const d = new Date(iso);
  return `${DAY.format(d)} at ${CLOCK.format(d)}`;
}
