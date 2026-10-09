/**
 * Roles and permissions (brief §3). The UI uses this to decide what to show; the database
 * enforces the same rules with row-level security, which is the actual security boundary.
 */

export const RESTAURANT_ROLES = ["owner", "manager", "staff"] as const;
export type RestaurantRole = (typeof RESTAURANT_ROLES)[number];

export const PLATFORM_ROLES = ["support", "super_admin"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const RESTAURANT_PERMISSIONS = [
  "orders.read",
  "orders.update_status",
  "orders.update_eta",
  "menu.availability",
  "menu.edit",
  "settings.hours",
  "settings.edit",
  "team.manage",
  "reports.read",
] as const;
export type RestaurantPermission = (typeof RESTAURANT_PERMISSIONS)[number];

const RESTAURANT_GRANTS: Readonly<Record<RestaurantRole, readonly RestaurantPermission[]>> = {
  owner: RESTAURANT_PERMISSIONS,
  manager: [
    "orders.read",
    "orders.update_status",
    "orders.update_eta",
    "menu.availability",
    "menu.edit",
    "settings.hours",
    "reports.read",
  ],
  staff: ["orders.read", "orders.update_status", "orders.update_eta", "menu.availability"],
};

export function restaurantCan(role: RestaurantRole, permission: RestaurantPermission): boolean {
  return RESTAURANT_GRANTS[role].includes(permission);
}

export const PLATFORM_PERMISSIONS = [
  "restaurants.read",
  "restaurants.onboard",
  "restaurants.publish",
  "restaurants.suspend",
  "orders.read",
  "payments.read",
  "payments.resolve",
  "users.manage",
  "audit.read",
  "settings.edit",
] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

const PLATFORM_GRANTS: Readonly<Record<PlatformRole, readonly PlatformPermission[]>> = {
  super_admin: PLATFORM_PERMISSIONS,
  support: [
    "restaurants.read",
    "restaurants.onboard",
    "orders.read",
    "payments.read",
    "audit.read",
  ],
};

export function platformCan(role: PlatformRole, permission: PlatformPermission): boolean {
  return PLATFORM_GRANTS[role].includes(permission);
}
