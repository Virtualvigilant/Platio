/**
 * The restaurant lifecycle (brief §7.2): Draft → Ready for review (optional) → Published →
 * Paused or Suspended → Archived. Archived records are kept for audit and history.
 *
 * The database enforces the same table in `public.restaurant_status_transitions` through
 * `public.transition_restaurant()`; a database test keeps the two identical.
 */
import type { PlatformPermission } from "../access";

export const RESTAURANT_STATUSES = [
  "draft",
  "ready_for_review",
  "published",
  "paused",
  "suspended",
  "archived",
] as const;

export type RestaurantStatus = (typeof RESTAURANT_STATUSES)[number];

export interface RestaurantTransition {
  to: RestaurantStatus;
  /** The platform permission needed (see access.ts). */
  permission: Extract<
    PlatformPermission,
    "restaurants.onboard" | "restaurants.publish" | "restaurants.suspend"
  >;
  /** Pausing, suspending, unpublishing, reactivating and archiving need an audit reason (§4.3 step 8). */
  requiresReason: boolean;
  /** Button label for this move. */
  action: string;
}

export const RESTAURANT_TRANSITIONS: Readonly<
  Record<RestaurantStatus, readonly RestaurantTransition[]>
> = {
  draft: [
    {
      to: "ready_for_review",
      permission: "restaurants.onboard",
      requiresReason: false,
      action: "Mark ready for review",
    },
    {
      to: "published",
      permission: "restaurants.publish",
      requiresReason: false,
      action: "Publish",
    },
    { to: "archived", permission: "restaurants.suspend", requiresReason: true, action: "Archive" },
  ],
  ready_for_review: [
    {
      to: "draft",
      permission: "restaurants.onboard",
      requiresReason: false,
      action: "Move back to draft",
    },
    {
      to: "published",
      permission: "restaurants.publish",
      requiresReason: false,
      action: "Publish",
    },
    { to: "archived", permission: "restaurants.suspend", requiresReason: true, action: "Archive" },
  ],
  published: [
    { to: "paused", permission: "restaurants.publish", requiresReason: true, action: "Pause" },
    { to: "suspended", permission: "restaurants.suspend", requiresReason: true, action: "Suspend" },
    { to: "draft", permission: "restaurants.publish", requiresReason: true, action: "Unpublish" },
    { to: "archived", permission: "restaurants.suspend", requiresReason: true, action: "Archive" },
  ],
  paused: [
    { to: "published", permission: "restaurants.publish", requiresReason: true, action: "Resume" },
    { to: "suspended", permission: "restaurants.suspend", requiresReason: true, action: "Suspend" },
    { to: "draft", permission: "restaurants.publish", requiresReason: true, action: "Unpublish" },
    { to: "archived", permission: "restaurants.suspend", requiresReason: true, action: "Archive" },
  ],
  suspended: [
    { to: "published", permission: "restaurants.suspend", requiresReason: true, action: "Restore" },
    {
      to: "draft",
      permission: "restaurants.suspend",
      requiresReason: true,
      action: "Move back to draft",
    },
    { to: "archived", permission: "restaurants.suspend", requiresReason: true, action: "Archive" },
  ],
  archived: [
    {
      to: "draft",
      permission: "restaurants.suspend",
      requiresReason: true,
      action: "Reactivate as draft",
    },
  ],
};

export const RESTAURANT_STATUS_LABELS: Readonly<Record<RestaurantStatus, string>> = {
  draft: "Draft",
  ready_for_review: "Ready for review",
  published: "Published",
  paused: "Paused",
  suspended: "Suspended",
  archived: "Archived",
};

/** Statuses whose storefront the public can see. Only published ones take orders. */
export const PUBLICLY_VISIBLE_STATUSES: readonly RestaurantStatus[] = ["published", "paused"];

export function isRestaurantStatus(value: unknown): value is RestaurantStatus {
  return typeof value === "string" && (RESTAURANT_STATUSES as readonly string[]).includes(value);
}

export function findRestaurantTransition(from: RestaurantStatus, to: RestaurantStatus) {
  return RESTAURANT_TRANSITIONS[from].find((t) => t.to === to);
}
