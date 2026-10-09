/**
 * The change log in plain words (brief §7.2 step 8, §12, §14.3). The database writes concise,
 * sanitized audit events (an action code plus a small `safe_metadata` object); these functions turn
 * them into sentences for platform staff, e.g. "Changed the price of Pilau from KES 350 to KES 360".
 *
 * Metadata comes from the database, so every field is checked before use and anything unexpected
 * falls back to a general sentence instead of failing. Restaurant-supplied text (dish names) is
 * returned as plain text; the UI renders it escaped.
 */
import type { PlatformRole, RestaurantRole } from "../access";
import { formatKES } from "../money";
import { formatClock } from "../prep-estimate";
import { RESTAURANT_STATUS_LABELS, isRestaurantStatus } from "../restaurants/lifecycle";
import { BUSINESS_TIME_ZONE } from "../time";

/** Human names for the restaurant columns that `restaurant.updated` lists. */
export const AUDIT_FIELD_LABELS: Readonly<Record<string, string>> = {
  display_name: "display name",
  slug: "web address",
  description: "description",
  cuisine_tags: "cuisine labels",
  public_phone: "public phone number",
  logo_path: "logo",
  cover_path: "cover photo",
  brand_color: "brand colour",
  // Always changes with brand_color; one mention is enough.
  brand_on_color: "brand colour",
  storefront_layout: "layout",
  service_area: "service area",
  address: "address",
  directions: "directions",
  latitude: "map position",
  longitude: "map position",
  timezone: "time zone",
  pickup_enabled: "pickup",
  dine_in_enabled: "dine-in",
  pickup_instructions: "pickup instructions",
  prep_presets: "preparation time choices",
  default_prep_minutes: "default preparation time",
  accepting_orders: "order taking",
  pause_reason: "pause reason",
  status: "status",
};

const ROLE_WORDS: Readonly<Record<RestaurantRole, string>> = {
  owner: "owner",
  manager: "manager",
  staff: "staff",
};

const MAX_NAME = 80;

export interface DescribeOptions {
  /** A readable name (display name or email) for a user id, when the viewer may see it. */
  personName?: (userId: string) => string | null | undefined;
}

/** One sentence describing an audit event, for every action the migrations write. */
export function describeAuditEntry(
  action: string,
  safeMetadata: unknown,
  options: DescribeOptions = {},
): string {
  const meta = asRecord(safeMetadata);

  switch (action) {
    case "restaurant.created": {
      const slug = str(meta.slug);
      return slug
        ? `Created the restaurant with the web address /restaurants/${slug}`
        : "Created the restaurant";
    }

    case "restaurant.updated": {
      const fields = fieldNames(meta.fields);
      return fields.length ? `Updated ${joinWords(fields)}` : "Updated the restaurant’s details";
    }

    case "restaurant.status_changed": {
      const from = statusLabel(meta.from);
      const to = statusLabel(meta.to);
      if (from && to) return `Changed status from ${from} to ${to}`;
      if (to) return `Changed status to ${to}`;
      return "Changed the restaurant’s status";
    }

    case "restaurant.hours_changed": {
      const periods = count(meta.periods);
      return periods === 0 ? "Removed all opening hours" : "Changed opening hours";
    }

    case "restaurant.paused_orders":
      return "Paused new orders";

    case "restaurant.resumed_orders":
      return "Resumed orders";

    case "menu_item.price_changed": {
      const name = itemName(meta.name);
      const from = minor(meta.from);
      const to = minor(meta.to);
      if (from !== null && to !== null) {
        return `Changed the price of ${name} from ${formatKES(from)} to ${formatKES(to)}`;
      }
      if (to !== null) return `Changed the price of ${name} to ${formatKES(to)}`;
      return `Changed the price of ${name}`;
    }

    case "menu_item.archived":
      return `Archived ${itemName(meta.name)} from the menu`;

    case "menu_item.restored":
      return `Restored ${itemName(meta.name)} to the menu`;

    case "membership.insert": {
      const person = personFor(meta.user_id, options);
      const role = roleWord(meta.role);
      const as = role ? ` as ${role}` : "";
      if (meta.status === "invited") return `Invited ${person}${as}`;
      if (meta.status === "revoked") return `Added ${person} to the team${as}, with access removed`;
      return `Added ${person} to the team${as}`;
    }

    case "membership.update": {
      // The event records the membership as it is after the change, not what it was before.
      const person = personFor(meta.user_id, options);
      const role = roleWord(meta.role);
      if (meta.status === "revoked") return `Removed ${person} from the team`;
      if (meta.status === "invited") {
        return role
          ? `Updated the pending membership of ${person} (${role})`
          : `Updated the pending membership of ${person}`;
      }
      return role
        ? `Gave ${person} team access as ${role}`
        : `Updated the team access of ${person}`;
    }

    case "invitation.created": {
      const email = str(meta.email) ?? "someone";
      const role = roleWord(meta.role);
      return role ? `Invited ${email} as ${role}` : `Invited ${email} to the team`;
    }

    case "invitation.revoked": {
      const email = str(meta.email);
      const role = roleWord(meta.role);
      const what = role ? `the ${role} invitation` : "the invitation";
      return email ? `Withdrew ${what} for ${email}` : `Withdrew ${what}`;
    }

    case "invitation.accepted": {
      const role = roleWord(meta.role);
      return role
        ? `Accepted an invitation and joined as ${role}`
        : "Accepted an invitation and joined the team";
    }

    default:
      return fallbackSentence(action);
  }
}

/** "logo" , "logo and description", "logo, description and address". */
export function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** Human field names for a `restaurant.updated` field list, de-duplicated, in the given order. */
export function fieldNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string" || raw.trim() === "") continue;
    const label = AUDIT_FIELD_LABELS[raw] ?? humanize(raw.replace(/_path$/, ""));
    if (!out.includes(label)) out.push(label);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Who made a change
// ---------------------------------------------------------------------------------------------

export type ActorKind = "platform" | "restaurant" | "system";

export interface ActorFacts {
  actorId: string | null;
  /** From profiles, when readable. */
  displayName?: string | null;
  /** A team member's sign-in email, when readable. */
  email?: string | null;
  /** Known only when the viewer may read platform_staff (super-admins see everyone). */
  platformRole?: PlatformRole | null;
  /** The actor's membership of this restaurant, in any status. */
  membershipRole?: RestaurantRole | null;
}

export interface ActorLabel {
  kind: ActorKind;
  /** The person's name or email, or "Platform staff" / "Restaurant team" / "System". */
  name: string;
  /** A second line, e.g. "Platform staff" under a name, or "Owner" under "Restaurant team". */
  detail: string | null;
}

const PLATFORM_ROLE_WORDS: Readonly<Record<PlatformRole, string>> = {
  super_admin: "Super-admin",
  support: "Support",
};

/**
 * Who made a change, from what the viewer may read. A change with no actor came from the system.
 * Only platform staff and the restaurant's own team can change a restaurant, so an actor who is not
 * on its team is platform staff even when platform_staff is not readable (support staff see only
 * their own row).
 */
export function describeActor(facts: ActorFacts): ActorLabel {
  if (!facts.actorId) return { kind: "system", name: "System", detail: null };
  const personal = clean(facts.displayName);

  if (facts.platformRole || !facts.membershipRole) {
    const role = facts.platformRole ? PLATFORM_ROLE_WORDS[facts.platformRole] : null;
    if (personal) {
      return {
        kind: "platform",
        name: personal,
        detail: role ? `Platform staff · ${role}` : "Platform staff",
      };
    }
    return { kind: "platform", name: "Platform staff", detail: role };
  }

  const roleWord = capitalize(ROLE_WORDS[facts.membershipRole]);
  const name = personal ?? clean(facts.email);
  if (name) return { kind: "restaurant", name, detail: `Restaurant team · ${roleWord}` };
  return { kind: "restaurant", name: "Restaurant team", detail: roleWord };
}

// ---------------------------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------------------------

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "9 Oct 2026, 14:05" in Nairobi time. Times are stored in UTC and shown locally. */
export function formatAuditTime(at: string | Date): string {
  const date = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return `${DATE_FORMAT.format(date)}, ${formatClock(date, BUSINESS_TIME_ZONE)}`;
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return clean(value);
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(/\s+/g, " ").trim();
  if (!v) return null;
  return v.length > MAX_NAME ? `${v.slice(0, MAX_NAME - 1)}…` : v;
}

function itemName(value: unknown): string {
  return str(value) ?? "a dish";
}

function minor(value: unknown): number | null {
  const n = typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : value;
  return typeof n === "number" && Number.isSafeInteger(n) ? n : null;
}

function count(value: unknown): number | null {
  const n = minor(value);
  return n !== null && n >= 0 ? n : null;
}

function statusLabel(value: unknown): string | null {
  if (isRestaurantStatus(value)) return RESTAURANT_STATUS_LABELS[value];
  const s = str(value);
  return s ? capitalize(humanize(s)) : null;
}

function roleWord(value: unknown): string | null {
  return typeof value === "string" && value in ROLE_WORDS
    ? ROLE_WORDS[value as RestaurantRole]
    : null;
}

function personFor(userId: unknown, options: DescribeOptions): string {
  const id = typeof userId === "string" ? userId : null;
  const name = id ? clean(options.personName?.(id) ?? null) : null;
  return name ?? "a team member";
}

function humanize(code: string): string {
  return code
    .replace(/[_.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "order.refund_flagged" → "Order refund flagged"; an empty code → "Made a change". */
function fallbackSentence(action: string): string {
  const words = typeof action === "string" ? humanize(action) : "";
  return words ? capitalize(words) : "Made a change";
}
